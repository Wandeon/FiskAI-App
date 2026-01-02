import { Builder } from "xml2js"
import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction, pausalniProfile } from "@/lib/db/schema/pausalni"
import { eq, and, sql } from "drizzle-orm"
import { PDV_CONFIG, EU_COUNTRY_NAMES } from "../constants"
import { Money } from "@/domain/shared"

export interface CountryBreakdown {
  countryCode: string
  countryName: string
  transactionCount: number
  baseAmount: number
  pdvAmount: number
}

export interface PdvSFormData {
  companyOib: string
  companyName: string
  pdvId: string
  periodMonth: number
  periodYear: number
  countryBreakdowns: CountryBreakdown[]
  totals: {
    totalCountries: number
    totalTransactions: number
    baseAmount: number
    pdvAmount: number
    totalAmount: number
  }
}

export interface PdvSXmlOptions {
  includeDeclaration?: boolean
  formattedOutput?: boolean
}

/**
 * Fetch EU transactions grouped by country for a specific month
 */
export async function getEuTransactionsByCountry(
  companyId: string,
  month: number,
  year: number
): Promise<CountryBreakdown[]> {
  // Fetch all EU transactions for the month (services received from EU)
  const transactions = await drizzleDb
    .select()
    .from(euTransaction)
    .where(
      and(
        eq(euTransaction.companyId, companyId),
        eq(euTransaction.reportingMonth, month),
        eq(euTransaction.reportingYear, year),
        eq(euTransaction.direction, "RECEIVED") // Services received from EU
      )
    )

  // Group by country and calculate totals using Money for precision
  const countryMap = new Map<
    string,
    {
      countryCode: string
      countryName: string
      transactionCount: number
      baseAmount: Money
      pdvAmount: Money
    }
  >()

  for (const tx of transactions) {
    const countryCode = tx.counterpartyCountry || "XX"

    if (!countryMap.has(countryCode)) {
      countryMap.set(countryCode, {
        countryCode,
        countryName: EU_COUNTRY_NAMES[countryCode] || countryCode,
        transactionCount: 0,
        baseAmount: Money.zero(),
        pdvAmount: Money.zero(),
      })
    }

    const breakdown = countryMap.get(countryCode)!
    breakdown.transactionCount++
    breakdown.baseAmount = breakdown.baseAmount.add(Money.fromString(tx.amount))
    breakdown.pdvAmount = breakdown.pdvAmount.add(Money.fromString(tx.pdvAmount || "0"))
  }

  // Convert to array, sort by country code, and convert Money to numbers
  const breakdowns: CountryBreakdown[] = Array.from(countryMap.values())
    .map((bd) => ({
      countryCode: bd.countryCode,
      countryName: bd.countryName,
      transactionCount: bd.transactionCount,
      baseAmount: bd.baseAmount.toDisplayNumber(),
      pdvAmount: bd.pdvAmount.toDisplayNumber(),
    }))
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode))

  return breakdowns
}

/**
 * Calculate totals from country breakdowns using Money for precision
 */
export function calculatePdvSTotals(breakdowns: CountryBreakdown[]) {
  const totalCountries = breakdowns.length
  let totalTransactions = 0
  let baseAmountMoney = Money.zero()
  let pdvAmountMoney = Money.zero()

  for (const bd of breakdowns) {
    totalTransactions += bd.transactionCount
    baseAmountMoney = baseAmountMoney.add(Money.fromString(String(bd.baseAmount)))
    pdvAmountMoney = pdvAmountMoney.add(Money.fromString(String(bd.pdvAmount)))
  }

  const totalAmountMoney = baseAmountMoney.add(pdvAmountMoney)

  return {
    totalCountries,
    totalTransactions,
    baseAmount: baseAmountMoney.toDisplayNumber(),
    pdvAmount: pdvAmountMoney.toDisplayNumber(),
    totalAmount: totalAmountMoney.toDisplayNumber(),
  }
}

/**
 * Prepare PDV-S form data from database
 */
export async function preparePdvSFormData(
  companyId: string,
  companyOib: string,
  companyName: string,
  month: number,
  year: number
): Promise<PdvSFormData> {
  // Fetch paušalni profile to get PDV-ID
  const [profile] = await drizzleDb
    .select()
    .from(pausalniProfile)
    .where(eq(pausalniProfile.companyId, companyId))
    .limit(1)

  if (!profile?.hasPdvId || !profile.pdvId) {
    throw new Error("Company does not have PDV-ID registered")
  }

  // Fetch transactions grouped by country
  const countryBreakdowns = await getEuTransactionsByCountry(companyId, month, year)

  // Calculate totals
  const totals = calculatePdvSTotals(countryBreakdowns)

  return {
    companyOib,
    companyName,
    pdvId: profile.pdvId,
    periodMonth: month,
    periodYear: year,
    countryBreakdowns,
    totals,
  }
}

/**
 * Generate PDV-S XML for ePorezna submission
 *
 * PDV-S is the summary form showing EU transactions grouped by country of origin.
 * This form breaks down EU services received by the country where the supplier is located.
 */
export function generatePdvSXml(data: PdvSFormData, options: PdvSXmlOptions = {}): string {
  const { includeDeclaration = true, formattedOutput = true } = options

  // Format period as YYYY-MM
  const period = `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`

  // Build XML structure following ePorezna PDV-S format
  const xmlObject = {
    PdvSPrijava: {
      $: {
        xmlns: "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPDV-S/v1-0",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      },
      Metapodaci: {
        Datum: new Date().toISOString().split("T")[0],
        Vrijeme: new Date().toISOString().split("T")[1].split(".")[0],
        Oblik: "PDV-S",
        Verzija: "1.0",
      },
      Porezni_obveznik: {
        OIB: data.companyOib,
        Naziv: data.companyName,
        PDV_ID: data.pdvId,
      },
      Razdoblje: {
        Godina: data.periodYear,
        Mjesec: data.periodMonth,
        Period: period,
      },
      Sazetak: {
        // Summary section
        Ukupno_Drzava: data.totals.totalCountries.toString(),
        Ukupno_Transakcija: data.totals.totalTransactions.toString(),
        Ukupno_Osnovica: formatAmount(data.totals.baseAmount),
        Ukupno_PDV: formatAmount(data.totals.pdvAmount),
        PDV_Stopa: PDV_CONFIG.rate.toString(),
      },
      Drzave:
        data.countryBreakdowns.length > 0
          ? {
              // Country breakdown section
              Drzava: data.countryBreakdowns.map((bd) => ({
                Kod: bd.countryCode,
                Naziv: bd.countryName,
                Broj_Transakcija: bd.transactionCount.toString(),
                Osnovica: formatAmount(bd.baseAmount),
                PDV: formatAmount(bd.pdvAmount),
                Ukupno: formatAmount(bd.baseAmount + bd.pdvAmount),
              })),
            }
          : undefined,
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
 * Format amount to 2 decimal places for XML
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Generate PDV-S XML for a company and period
 *
 * This is the main entry point for generating PDV-S forms.
 */
export async function generatePdvSFormForPeriod(
  companyId: string,
  companyOib: string,
  companyName: string,
  month: number,
  year: number,
  options?: PdvSXmlOptions
): Promise<{ xml: string; data: PdvSFormData }> {
  // Prepare form data
  const data = await preparePdvSFormData(companyId, companyOib, companyName, month, year)

  // Generate XML
  const xml = generatePdvSXml(data, options)

  return { xml, data }
}

/**
 * Validate PDV-S form data before submission
 */
export function validatePdvSFormData(data: PdvSFormData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate OIB (11 digits)
  if (!/^\d{11}$/.test(data.companyOib)) {
    errors.push("OIB mora imati točno 11 znamenki")
  }

  // Validate PDV-ID format (HR + 11 digits)
  if (!/^HR\d{11}$/.test(data.pdvId)) {
    errors.push("PDV-ID mora biti u formatu HR + 11 znamenki")
  }

  // Validate period
  if (data.periodMonth < 1 || data.periodMonth > 12) {
    errors.push("Mjesec mora biti između 1 i 12")
  }

  if (data.periodYear < 2000 || data.periodYear > 2100) {
    errors.push("Godina nije validna")
  }

  // Validate amounts
  if (data.totals.baseAmount < 0) {
    errors.push("Ukupna osnovica ne može biti negativna")
  }

  if (data.totals.pdvAmount < 0) {
    errors.push("Ukupni PDV iznos ne može biti negativan")
  }

  // Check if PDV amount matches calculation (25% of base) using Money for precision
  const expectedPdvMoney = Money.fromString(String(data.totals.baseAmount)).multiply("0.25")
  const actualPdvMoney = Money.fromString(String(data.totals.pdvAmount))
  const differenceMoney = expectedPdvMoney.subtract(actualPdvMoney)
  const toleranceMoney = Money.fromString("0.02") // 2 cent tolerance for rounding

  if (
    differenceMoney.toDisplayNumber() > toleranceMoney.toDisplayNumber() ||
    differenceMoney.toDisplayNumber() < -toleranceMoney.toDisplayNumber()
  ) {
    errors.push(
      `Ukupni PDV iznos (${actualPdvMoney.toDisplayNumber()}) ne odgovara očekivanom iznosu (${expectedPdvMoney.toDisplayNumber()})`
    )
  }

  // Validate country breakdowns
  for (let i = 0; i < data.countryBreakdowns.length; i++) {
    const bd = data.countryBreakdowns[i]

    if (bd.baseAmount <= 0) {
      errors.push(`Država ${bd.countryName}: osnovica mora biti pozitivna`)
    }

    if (!bd.countryCode || bd.countryCode.length !== 2) {
      errors.push(`Država ${i + 1}: nedostaje valjan kod države`)
    }

    if (bd.transactionCount <= 0) {
      errors.push(`Država ${bd.countryName}: broj transakcija mora biti pozitivan`)
    }

    // Check if country PDV matches calculation using Money for precision
    const expectedCountryPdvMoney = Money.fromString(String(bd.baseAmount)).multiply("0.25")
    const actualCountryPdvMoney = Money.fromString(String(bd.pdvAmount))
    const countryDifferenceMoney = expectedCountryPdvMoney.subtract(actualCountryPdvMoney)

    if (
      countryDifferenceMoney.toDisplayNumber() > toleranceMoney.toDisplayNumber() ||
      countryDifferenceMoney.toDisplayNumber() < -toleranceMoney.toDisplayNumber()
    ) {
      errors.push(
        `Država ${bd.countryName}: PDV iznos (${actualCountryPdvMoney.toDisplayNumber()}) ne odgovara očekivanom (${expectedCountryPdvMoney.toDisplayNumber()})`
      )
    }
  }

  // Verify totals match sum of breakdowns using Money for precision
  let sumBaseMoney = Money.zero()
  let sumPdvMoney = Money.zero()
  let sumTransactions = 0

  for (const bd of data.countryBreakdowns) {
    sumBaseMoney = sumBaseMoney.add(Money.fromString(String(bd.baseAmount)))
    sumPdvMoney = sumPdvMoney.add(Money.fromString(String(bd.pdvAmount)))
    sumTransactions += bd.transactionCount
  }

  const baseDiffMoney = sumBaseMoney.subtract(Money.fromString(String(data.totals.baseAmount)))
  const pdvDiffMoney = sumPdvMoney.subtract(Money.fromString(String(data.totals.pdvAmount)))

  if (
    baseDiffMoney.toDisplayNumber() > toleranceMoney.toDisplayNumber() ||
    baseDiffMoney.toDisplayNumber() < -toleranceMoney.toDisplayNumber()
  ) {
    errors.push("Zbroj osnovica po državama ne odgovara ukupnoj osnovici")
  }

  if (
    pdvDiffMoney.toDisplayNumber() > toleranceMoney.toDisplayNumber() ||
    pdvDiffMoney.toDisplayNumber() < -toleranceMoney.toDisplayNumber()
  ) {
    errors.push("Zbroj PDV-a po državama ne odgovara ukupnom PDV-u")
  }

  if (sumTransactions !== data.totals.totalTransactions) {
    errors.push("Zbroj transakcija po državama ne odgovara ukupnom broju transakcija")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
