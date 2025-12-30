// src/lib/reports/pdv-xml-generator.ts
// Croatian VAT Form (PDV obrazac) XML generator for ePorezna submission
// This is a generic implementation for all entity types (not just pausalni)

import { Builder } from "xml2js"
import { db } from "@/lib/db"

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
  baseAmount: number
  vatAmount: number
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
      goods: number // Base amount
      services: number // Base amount
    }
    // I.3 Exports (zero-rated)
    exports: number // Base amount
    // I.4 Exempt deliveries
    exempt: number // Base amount
    // I.5 Total output VAT
    totalOutputVat: number
    totalBaseOutput: number
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
    nonDeductible: number
    // II.5 Total input VAT (deductible)
    totalInputVat: number
    totalBaseInput: number
  }

  // Section III - Calculation
  section3: {
    outputVat: number // Total output VAT
    inputVat: number // Total deductible input VAT
    vatPayable: number // Positive = pay, negative = refund
  }

  // Section IV - Special provisions
  section4?: {
    marginScheme?: number // Margin scheme transactions
    travelAgency?: number // Travel agency transactions
    usedGoods?: number // Used goods scheme
  }
}

export interface PdvXmlOptions {
  includeDeclaration?: boolean
  formattedOutput?: boolean
}

/**
 * Fetch VAT report data from invoices and expenses
 */
export async function fetchVatReportData(
  companyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{
  outputVat: { net: number; vat: number; total: number }
  inputVat: { deductible: number; nonDeductible: number; total: number }
  vatPayable: number
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

  const outputVat = {
    net: invoices.reduce((sum, i) => sum + Number(i.netAmount), 0),
    vat: invoices.reduce((sum, i) => sum + Number(i.vatAmount), 0),
    total: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
  }

  const inputVat = uraInputs.length
    ? {
        deductible: uraInputs.reduce((sum, input) => sum + Number(input.deductibleVatAmount), 0),
        nonDeductible: uraInputs.reduce(
          (sum, input) => sum + Number(input.nonDeductibleVatAmount),
          0
        ),
        total: uraInputs.reduce((sum, input) => sum + Number(input.vatAmount), 0),
      }
    : {
        deductible: expenses
          .filter((e) => e.vatDeductible)
          .reduce((sum, e) => sum + Number(e.vatAmount), 0),
        nonDeductible: expenses
          .filter((e) => !e.vatDeductible)
          .reduce((sum, e) => sum + Number(e.vatAmount), 0),
        total: expenses.reduce((sum, e) => sum + Number(e.vatAmount), 0),
      }

  return {
    outputVat,
    inputVat,
    vatPayable: outputVat.vat - inputVat.deductible,
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

  // Get VAT data
  const vatData = await fetchVatReportData(companyId, dateFrom, dateTo)

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
          baseAmount: vatData.outputVat.net,
          vatAmount: vatData.outputVat.vat,
        },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: 0, vatAmount: 0 },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: 0, vatAmount: 0 },
      },
      euDeliveries: { goods: 0, services: 0 },
      exports: 0,
      exempt: 0,
      totalOutputVat: vatData.outputVat.vat,
      totalBaseOutput: vatData.outputVat.net,
    },

    section2: {
      domestic: {
        standard: {
          rate: VAT_RATES.STANDARD,
          baseAmount: vatData.inputVat.deductible / 0.25, // Reverse calculate base
          vatAmount: vatData.inputVat.deductible,
        },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: 0, vatAmount: 0 },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: 0, vatAmount: 0 },
      },
      euAcquisitions: {
        goods: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
        services: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
      },
      imports: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
      nonDeductible: vatData.inputVat.nonDeductible,
      totalInputVat: vatData.inputVat.deductible,
      totalBaseInput: vatData.inputVat.deductible / 0.25,
    },

    section3: {
      outputVat: vatData.outputVat.vat,
      inputVat: vatData.inputVat.deductible,
      vatPayable: vatData.vatPayable,
    },
  }
}

/**
 * Format amount for XML (2 decimal places)
 */
function formatAmount(amount: number): string {
  return Math.round(amount * 100) / 100 + ""
}

/**
 * Generate PDV XML for ePorezna submission
 *
 * Format follows Croatian Tax Authority (Porezna uprava) XML schema for PDV form.
 * This is the standard PDV form for VAT-registered entities.
 */
export function generatePdvXml(data: PdvFormData, options: PdvXmlOptions = {}): string {
  const { includeDeclaration = true, formattedOutput = true } = options

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
        Datum: new Date().toISOString().split("T")[0],
        Vrijeme: new Date().toISOString().split("T")[1].split(".")[0],
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
  if (data.section1.totalOutputVat < 0) {
    errors.push("Izlazni PDV ne moze biti negativan")
  }

  if (data.section2.totalInputVat < 0) {
    errors.push("Ulazni PDV ne moze biti negativan")
  }

  // Verify section 3 calculation matches
  const calculatedVatPayable = data.section3.outputVat - data.section3.inputVat
  const tolerance = 0.02 // 2 cent tolerance for rounding

  if (Math.abs(calculatedVatPayable - data.section3.vatPayable) > tolerance) {
    errors.push(
      `PDV za uplatu/povrat (${data.section3.vatPayable}) ne odgovara izracunu (${calculatedVatPayable})`
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
