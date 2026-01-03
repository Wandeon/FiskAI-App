// src/lib/reports/pdv-xml-generator.ts
// Croatian VAT Form (PDV obrazac) XML generator for ePorezna submission
// This is a generic implementation for all entity types (not just pausalni)

import { Builder } from "xml2js"
import { db } from "@/lib/db"
import { Money } from "@/domain/shared"
import { Prisma } from "@prisma/client"

const Decimal = Prisma.Decimal

// VAT rate in Croatia (25%)
const VAT_RATE = 25

// Croatian VAT rate tiers
export const VAT_RATES = {
  STANDARD: 25, // Standard rate
  REDUCED: 13, // Reduced rate (food, hotels, etc.)
  SUPER_REDUCED: 5, // Super reduced rate (bread, milk, etc.)
} as const

export interface VatBreakdown {
  rate: number
  baseAmount: string
  vatAmount: string
}

export interface PdvFormData {
  // Company info
  companyOib: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyPostalCode: string

  // Period
  periodType: "MONTHLY" | "QUARTERLY"
  periodMonth?: number // 1-12 for monthly
  periodQuarter?: number // 1-4 for quarterly
  periodYear: number

  // Section I - Deliveries (Output VAT)
  section1: {
    // I.1 Domestic deliveries of goods and services
    domestic: {
      standard: VatBreakdown // 25%
      reduced: VatBreakdown // 13%
      superReduced: VatBreakdown // 5%
    }
    // I.2 EU deliveries (zero-rated)
    euDeliveries: {
      goods: string // Base amount
      services: string // Base amount
    }
    // I.3 Exports (zero-rated)
    exports: string // Base amount
    // I.4 Exempt deliveries
    exempt: string // Base amount
    // I.5 Total output VAT
    totalOutputVat: string
    totalBaseOutput: string
  }

  // Section II - Acquisitions (Input VAT)
  section2: {
    // II.1 Domestic acquisitions
    domestic: {
      standard: VatBreakdown
      reduced: VatBreakdown
      superReduced: VatBreakdown
    }
    // II.2 EU acquisitions (reverse charge)
    euAcquisitions: {
      goods: VatBreakdown // Intra-community acquisitions
      services: VatBreakdown // B2B services received
    }
    // II.3 Imports
    imports: VatBreakdown
    // II.4 Non-deductible input VAT
    nonDeductible: string
    // II.5 Total input VAT (deductible)
    totalInputVat: string
    totalBaseInput: string
  }

  // Section III - Calculation
  section3: {
    outputVat: string // Total output VAT
    inputVat: string // Total deductible input VAT
    vatPayable: string // Positive = pay, negative = refund
  }

  // Section IV - Special provisions
  section4?: {
    marginScheme?: string // Margin scheme transactions
    travelAgency?: string // Travel agency transactions
    usedGoods?: string // Used goods scheme
  }
}

export interface PdvXmlOptions {
  includeDeclaration?: boolean
  formattedOutput?: boolean
  generatedAt?: Date
}

/**
 * Fetch VAT report data from invoices and expenses
 */
export async function fetchVatReportData(
  companyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{
  outputVat: { net: string; vat: string; total: string }
  inputVat: { deductible: string; nonDeductible: string; total: string }
  vatPayable: string
}> {
  // Get invoices (output VAT)
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      issueDate: { gte: dateFrom, lte: dateTo },
      status: { not: "DRAFT" },
    },
    select: { netAmount: true, vatAmount: true, totalAmount: true },
  })

  // Get expenses (input VAT)
  const uraInputs = await db.uraInput.findMany({
    where: {
      companyId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: {
      deductibleVatAmount: true,
      nonDeductibleVatAmount: true,
      vatAmount: true,
    },
  })

  const expenses =
    uraInputs.length === 0
      ? await db.expense.findMany({
          where: {
            companyId,
            date: { gte: dateFrom, lte: dateTo },
            status: { in: ["PAID", "PENDING"] },
          },
          select: { netAmount: true, vatAmount: true, totalAmount: true, vatDeductible: true },
        })
      : []

  // Calculate output VAT using Money class for precision
  let outputNet = Money.zero()
  let outputVatAmount = Money.zero()
  let outputTotal = Money.zero()
  for (const i of invoices) {
    outputNet = outputNet.add(Money.fromString(String(i.netAmount)))
    outputVatAmount = outputVatAmount.add(Money.fromString(String(i.vatAmount)))
    outputTotal = outputTotal.add(Money.fromString(String(i.totalAmount)))
  }

  const outputVat = {
    net: outputNet.toDisplayNumber(),
    vat: outputVatAmount.toDisplayNumber(),
    total: outputTotal.toDisplayNumber(),
  }

  // Calculate input VAT using Money class for precision
  let inputDeductible = Money.zero()
  let inputNonDeductible = Money.zero()
  let inputTotal = Money.zero()

  if (uraInputs.length) {
    for (const input of uraInputs) {
      inputDeductible = inputDeductible.add(Money.fromString(String(input.deductibleVatAmount)))
      inputNonDeductible = inputNonDeductible.add(
        Money.fromString(String(input.nonDeductibleVatAmount))
      )
      inputTotal = inputTotal.add(Money.fromString(String(input.vatAmount)))
    }
  } else {
    for (const e of expenses) {
      const vatAmount = Money.fromString(String(e.vatAmount))
      if (e.vatDeductible) {
        inputDeductible = inputDeductible.add(vatAmount)
      } else {
        inputNonDeductible = inputNonDeductible.add(vatAmount)
      }
      inputTotal = inputTotal.add(vatAmount)
    }
  }

  const inputVat = {
    deductible: inputDeductible.toDisplayNumber(),
    nonDeductible: inputNonDeductible.toDisplayNumber(),
    total: inputTotal.toDisplayNumber(),
  }

  // Calculate VAT payable using Money for precision
  const vatPayable = outputVatAmount.subtract(inputDeductible)

  return {
    outputVat,
    inputVat,
    vatPayable: vatPayable.toDisplayNumber(),
  }
}

/**
 * Prepare PDV form data from database
 */
export async function preparePdvFormData(
  companyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<PdvFormData> {
  // Get company info
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      oib: true,
      name: true,
      address: true,
      city: true,
      postalCode: true,
    },
  })

  if (!company) {
    throw new Error("Company not found")
  }

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      issueDate: { gte: dateFrom, lte: dateTo },
      status: { not: "DRAFT" },
    },
    include: {
      buyer: { select: { vatNumber: true, country: true } },
      lines: { select: { netAmount: true, vatAmount: true, vatRate: true } },
    },
  })

  const uraInputs = await db.uraInput.findMany({
    where: {
      companyId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: {
      netAmount: true,
      vatRate: true,
      deductibleVatAmount: true,
      nonDeductibleVatAmount: true,
    },
  })

  let outBase25 = new Decimal(0)
  let outVat25 = new Decimal(0)
  let outBase13 = new Decimal(0)
  let outVat13 = new Decimal(0)
  let outBase5 = new Decimal(0)
  let outVat5 = new Decimal(0)
  const outEuGoods = new Decimal(0)
  let outEuServices = new Decimal(0)

  for (const inv of invoices) {
    const buyerVat = (inv.buyer?.vatNumber ?? "").toUpperCase()
    const isEuReverseCharge =
      buyerVat.length > 0 &&
      !buyerVat.startsWith("HR") &&
      new Decimal(inv.vatAmount).equals(0) &&
      inv.lines.some((l) => new Decimal(l.vatRate).equals(0))

    if (isEuReverseCharge) {
      outEuServices = outEuServices.plus(new Decimal(inv.netAmount))
      continue
    }

    for (const line of inv.lines) {
      const rate = new Decimal(line.vatRate)
      if (rate.equals(VAT_RATES.STANDARD)) {
        outBase25 = outBase25.plus(new Decimal(line.netAmount))
        outVat25 = outVat25.plus(new Decimal(line.vatAmount))
      } else if (rate.equals(VAT_RATES.REDUCED)) {
        outBase13 = outBase13.plus(new Decimal(line.netAmount))
        outVat13 = outVat13.plus(new Decimal(line.vatAmount))
      } else if (rate.equals(VAT_RATES.SUPER_REDUCED)) {
        outBase5 = outBase5.plus(new Decimal(line.netAmount))
        outVat5 = outVat5.plus(new Decimal(line.vatAmount))
      }
    }
  }

  let inBase25 = new Decimal(0)
  let inVat25 = new Decimal(0)
  let inBase13 = new Decimal(0)
  let inVat13 = new Decimal(0)
  let inBase5 = new Decimal(0)
  let inVat5 = new Decimal(0)
  let nonDeductible = new Decimal(0)

  for (const row of uraInputs) {
    const rate = new Decimal(row.vatRate)
    nonDeductible = nonDeductible.plus(new Decimal(row.nonDeductibleVatAmount))
    if (rate.equals(VAT_RATES.STANDARD)) {
      inBase25 = inBase25.plus(new Decimal(row.netAmount))
      inVat25 = inVat25.plus(new Decimal(row.deductibleVatAmount))
    } else if (rate.equals(VAT_RATES.REDUCED)) {
      inBase13 = inBase13.plus(new Decimal(row.netAmount))
      inVat13 = inVat13.plus(new Decimal(row.deductibleVatAmount))
    } else if (rate.equals(VAT_RATES.SUPER_REDUCED)) {
      inBase5 = inBase5.plus(new Decimal(row.netAmount))
      inVat5 = inVat5.plus(new Decimal(row.deductibleVatAmount))
    }
  }

  const totalOutputVat = outVat25.plus(outVat13).plus(outVat5)
  const totalBaseOutput = outBase25
    .plus(outBase13)
    .plus(outBase5)
    .plus(outEuGoods)
    .plus(outEuServices)
  const totalInputVat = inVat25.plus(inVat13).plus(inVat5)
  const totalBaseInput = inBase25.plus(inBase13).plus(inBase5)

  const toMoneyString = (value: Prisma.Decimal) =>
    value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

  const vatPayable = totalOutputVat.sub(totalInputVat)

  // Determine period type (monthly vs quarterly)
  const monthDiff =
    (dateTo.getFullYear() - dateFrom.getFullYear()) * 12 + (dateTo.getMonth() - dateFrom.getMonth())
  const isQuarterly = monthDiff >= 2

  // Calculate period
  const periodYear = dateFrom.getFullYear()
  const periodMonth = dateFrom.getMonth() + 1
  const periodQuarter = Math.ceil(periodMonth / 3)

  return {
    companyOib: company.oib,
    companyName: company.name,
    companyAddress: company.address || "",
    companyCity: company.city || "",
    companyPostalCode: company.postalCode || "",

    periodType: isQuarterly ? "QUARTERLY" : "MONTHLY",
    periodMonth: isQuarterly ? undefined : periodMonth,
    periodQuarter: isQuarterly ? periodQuarter : undefined,
    periodYear,

    section1: {
      domestic: {
        standard: {
          rate: VAT_RATES.STANDARD,
          baseAmount: toMoneyString(outBase25),
          vatAmount: toMoneyString(outVat25),
        },
        reduced: {
          rate: VAT_RATES.REDUCED,
          baseAmount: toMoneyString(outBase13),
          vatAmount: toMoneyString(outVat13),
        },
        superReduced: {
          rate: VAT_RATES.SUPER_REDUCED,
          baseAmount: toMoneyString(outBase5),
          vatAmount: toMoneyString(outVat5),
        },
      },
      euDeliveries: { goods: toMoneyString(outEuGoods), services: toMoneyString(outEuServices) },
      exports: "0.00",
      exempt: "0.00",
      totalOutputVat: toMoneyString(totalOutputVat),
      totalBaseOutput: toMoneyString(totalBaseOutput),
    },

    section2: {
      domestic: {
        standard: {
          rate: VAT_RATES.STANDARD,
          baseAmount: toMoneyString(inBase25),
          vatAmount: toMoneyString(inVat25),
        },
        reduced: {
          rate: VAT_RATES.REDUCED,
          baseAmount: toMoneyString(inBase13),
          vatAmount: toMoneyString(inVat13),
        },
        superReduced: {
          rate: VAT_RATES.SUPER_REDUCED,
          baseAmount: toMoneyString(inBase5),
          vatAmount: toMoneyString(inVat5),
        },
      },
      euAcquisitions: {
        goods: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
        services: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
      },
      imports: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
      nonDeductible: toMoneyString(nonDeductible),
      totalInputVat: toMoneyString(totalInputVat),
      totalBaseInput: toMoneyString(totalBaseInput),
    },

    section3: {
      outputVat: toMoneyString(totalOutputVat),
      inputVat: toMoneyString(totalInputVat),
      vatPayable: toMoneyString(vatPayable),
    },
  }
}

/**
 * Format amount for XML (2 decimal places)
 * Uses Money class for proper rounding
 */
function formatAmount(amount: string): string {
  return new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
}

/**
 * Generate PDV XML for ePorezna submission
 *
 * Format follows Croatian Tax Authority (Porezna uprava) XML schema for PDV form.
 * This is the standard PDV form for VAT-registered entities.
 */
export function generatePdvXml(data: PdvFormData, options: PdvXmlOptions = {}): string {
  const { includeDeclaration = true, formattedOutput = true } = options
  const generatedAt = options.generatedAt ?? new Date()

  // Format period
  const period =
    data.periodType === "MONTHLY"
      ? `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`
      : `${data.periodYear}-Q${data.periodQuarter}`

  // Build XML structure following ePorezna format
  const xmlObject = {
    PdvPrijava: {
      $: {
        xmlns: "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPDV/v1-0",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      },
      Metapodaci: {
        Datum: generatedAt.toISOString().split("T")[0],
        Vrijeme: generatedAt.toISOString().split("T")[1].split(".")[0],
        Oblik: "PDV",
        Verzija: "1.0",
      },
      Porezni_obveznik: {
        OIB: data.companyOib,
        Naziv: data.companyName,
        Adresa: data.companyAddress,
        Grad: data.companyCity,
        PostanskiBroj: data.companyPostalCode,
      },
      Razdoblje: {
        Vrsta: data.periodType,
        Godina: data.periodYear,
        ...(data.periodMonth && { Mjesec: data.periodMonth }),
        ...(data.periodQuarter && { Kvartal: data.periodQuarter }),
        Period: period,
      },
      I_Isporuke: {
        // Section I: Deliveries (output VAT)
        I_1_Tuzemne: {
          // I.1 Domestic deliveries
          Stopa_25: {
            Osnovica: formatAmount(data.section1.domestic.standard.baseAmount),
            PDV: formatAmount(data.section1.domestic.standard.vatAmount),
          },
          Stopa_13: {
            Osnovica: formatAmount(data.section1.domestic.reduced.baseAmount),
            PDV: formatAmount(data.section1.domestic.reduced.vatAmount),
          },
          Stopa_5: {
            Osnovica: formatAmount(data.section1.domestic.superReduced.baseAmount),
            PDV: formatAmount(data.section1.domestic.superReduced.vatAmount),
          },
        },
        I_2_EU: {
          // I.2 EU deliveries (zero-rated)
          Dobra: formatAmount(data.section1.euDeliveries.goods),
          Usluge: formatAmount(data.section1.euDeliveries.services),
        },
        I_3_Izvoz: formatAmount(data.section1.exports),
        I_4_Oslobodeno: formatAmount(data.section1.exempt),
        I_5_Ukupno_Osnovica: formatAmount(data.section1.totalBaseOutput),
        I_5_Ukupno_PDV: formatAmount(data.section1.totalOutputVat),
      },
      II_Nabave: {
        // Section II: Acquisitions (input VAT)
        II_1_Tuzemne: {
          Stopa_25: {
            Osnovica: formatAmount(data.section2.domestic.standard.baseAmount),
            PDV: formatAmount(data.section2.domestic.standard.vatAmount),
          },
          Stopa_13: {
            Osnovica: formatAmount(data.section2.domestic.reduced.baseAmount),
            PDV: formatAmount(data.section2.domestic.reduced.vatAmount),
          },
          Stopa_5: {
            Osnovica: formatAmount(data.section2.domestic.superReduced.baseAmount),
            PDV: formatAmount(data.section2.domestic.superReduced.vatAmount),
          },
        },
        II_2_EU: {
          Dobra: {
            Osnovica: formatAmount(data.section2.euAcquisitions.goods.baseAmount),
            PDV: formatAmount(data.section2.euAcquisitions.goods.vatAmount),
          },
          Usluge: {
            Osnovica: formatAmount(data.section2.euAcquisitions.services.baseAmount),
            PDV: formatAmount(data.section2.euAcquisitions.services.vatAmount),
          },
        },
        II_3_Uvoz: {
          Osnovica: formatAmount(data.section2.imports.baseAmount),
          PDV: formatAmount(data.section2.imports.vatAmount),
        },
        II_4_Nepriznati: formatAmount(data.section2.nonDeductible),
        II_5_Ukupno_Osnovica: formatAmount(data.section2.totalBaseInput),
        II_5_Ukupno_PDV: formatAmount(data.section2.totalInputVat),
      },
      III_Obracun: {
        // Section III: Calculation
        III_1_Izlazni_PDV: formatAmount(data.section3.outputVat),
        III_2_Ulazni_PDV: formatAmount(data.section3.inputVat),
        III_3_Razlika: formatAmount(Math.abs(data.section3.vatPayable)),
        III_3_Vrsta: data.section3.vatPayable >= 0 ? "UPLATA" : "POVRAT",
      },
      ...(data.section4 && {
        IV_Posebne_odredbe: {
          ...(data.section4.marginScheme && {
            Marza: formatAmount(data.section4.marginScheme),
          }),
          ...(data.section4.travelAgency && {
            Turisticke_agencije: formatAmount(data.section4.travelAgency),
          }),
          ...(data.section4.usedGoods && {
            Rabljena_dobra: formatAmount(data.section4.usedGoods),
          }),
        },
      }),
    },
  }

  const builder = new Builder({
    xmldec: includeDeclaration
      ? { version: "1.0", encoding: "UTF-8", standalone: false }
      : undefined,
    renderOpts: {
      pretty: formattedOutput,
      indent: "  ",
      newline: "\n",
    },
  })

  return builder.buildObject(xmlObject)
}

/**
 * Generate PDV form XML for a company and period
 */
export async function generatePdvFormForPeriod(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  options?: PdvXmlOptions
): Promise<{ xml: string; data: PdvFormData }> {
  // Prepare form data
  const data = await preparePdvFormData(companyId, dateFrom, dateTo)

  // Generate XML
  const xml = generatePdvXml(data, options)

  return { xml, data }
}

/**
 * Validate PDV form data before submission
 */
export function validatePdvFormData(data: PdvFormData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate OIB (11 digits)
  if (!/^\d{11}$/.test(data.companyOib)) {
    errors.push("OIB mora imati tocno 11 znamenki")
  }

  // Validate period
  if (data.periodType === "MONTHLY" && (data.periodMonth! < 1 || data.periodMonth! > 12)) {
    errors.push("Mjesec mora biti izmedu 1 i 12")
  }

  if (data.periodType === "QUARTERLY" && (data.periodQuarter! < 1 || data.periodQuarter! > 4)) {
    errors.push("Kvartal mora biti izmedu 1 i 4")
  }

  if (data.periodYear < 2000 || data.periodYear > 2100) {
    errors.push("Godina nije validna")
  }

  // Validate amounts are not negative (except vatPayable which can be refund)
  if (new Decimal(data.section1.totalOutputVat).lessThan(0)) {
    errors.push("Izlazni PDV ne moze biti negativan")
  }

  if (new Decimal(data.section2.totalInputVat).lessThan(0)) {
    errors.push("Ulazni PDV ne moze biti negativan")
  }

  // Verify section 3 calculation matches
  const calculatedVatPayable = new Decimal(data.section3.outputVat).sub(
    new Decimal(data.section3.inputVat)
  )
  const reported = new Decimal(data.section3.vatPayable)
  const tolerance = new Decimal("0.02") // 2 cent tolerance for rounding

  if (calculatedVatPayable.sub(reported).abs().greaterThan(tolerance)) {
    errors.push(
      `PDV za uplatu/povrat (${data.section3.vatPayable}) ne odgovara izracunu (${calculatedVatPayable.toFixed(2)})`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get period description in Croatian
 */
export function getPeriodDescription(data: PdvFormData): string {
  const monthNames = [
    "sijecanj",
    "veljaca",
    "ozujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ]

  if (data.periodType === "MONTHLY") {
    return `${monthNames[data.periodMonth! - 1]} ${data.periodYear}`
  } else {
    return `${data.periodQuarter}. kvartal ${data.periodYear}`
  }
}
