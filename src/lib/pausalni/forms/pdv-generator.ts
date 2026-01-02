import { Builder } from "xml2js"
import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction, pausalniProfile } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { PDV_CONFIG } from "../constants"
import { Money } from "@/domain/shared"

export interface PdvFormData {
  companyOib: string
  companyName: string
  pdvId: string
  periodMonth: number
  periodYear: number
  transactions: {
    id: string
    counterpartyName: string | null
    counterpartyCountry: string | null
    counterpartyVatId: string | null
    transactionDate: Date
    baseAmount: number
    pdvAmount: number
  }[]
  totals: {
    baseAmount: number
    pdvAmount: number
    totalAmount: number
  }
}

export interface PdvXmlOptions {
  includeDeclaration?: boolean
  formattedOutput?: boolean
}

/**
 * Fetch EU transactions for a specific month and company
 */
export async function getEuTransactionsForMonth(
  companyId: string,
  month: number,
  year: number
): Promise<PdvFormData["transactions"]> {
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

  return transactions.map((tx) => ({
    id: tx.id,
    counterpartyName: tx.counterpartyName,
    counterpartyCountry: tx.counterpartyCountry,
    counterpartyVatId: tx.counterpartyVatId,
    transactionDate: new Date(tx.transactionDate),
    baseAmount: Money.fromString(tx.amount).toDisplayNumber(),
    pdvAmount: Money.fromString(tx.pdvAmount || "0").toDisplayNumber(),
  }))
}

/**
 * Calculate totals from EU transactions using Money class for precision
 */
export function calculatePdvTotals(transactions: PdvFormData["transactions"]) {
  let baseAmountMoney = Money.zero()
  let pdvAmountMoney = Money.zero()

  for (const tx of transactions) {
    baseAmountMoney = baseAmountMoney.add(Money.fromString(String(tx.baseAmount)))
    pdvAmountMoney = pdvAmountMoney.add(Money.fromString(String(tx.pdvAmount)))
  }

  const totalAmountMoney = baseAmountMoney.add(pdvAmountMoney)

  return {
    baseAmount: baseAmountMoney.toDisplayNumber(),
    pdvAmount: pdvAmountMoney.toDisplayNumber(),
    totalAmount: totalAmountMoney.toDisplayNumber(),
  }
}

/**
 * Prepare PDV form data from database
 */
export async function preparePdvFormData(
  companyId: string,
  companyOib: string,
  companyName: string,
  month: number,
  year: number
): Promise<PdvFormData> {
  // Fetch paušalni profile to get PDV-ID
  const [profile] = await drizzleDb
    .select()
    .from(pausalniProfile)
    .where(eq(pausalniProfile.companyId, companyId))
    .limit(1)

  if (!profile?.hasPdvId || !profile.pdvId) {
    throw new Error("Company does not have PDV-ID registered")
  }

  // Fetch transactions for the month
  const transactions = await getEuTransactionsForMonth(companyId, month, year)

  // Calculate totals
  const totals = calculatePdvTotals(transactions)

  return {
    companyOib,
    companyName,
    pdvId: profile.pdvId,
    periodMonth: month,
    periodYear: year,
    transactions,
    totals,
  }
}

/**
 * Generate PDV XML for ePorezna submission
 *
 * Format follows Croatian Tax Authority (Porezna uprava) XML schema for PDV form.
 * This is specifically for paušalni obrt reporting reverse charge VAT on EU services received.
 */
export function generatePdvXml(data: PdvFormData, options: PdvXmlOptions = {}): string {
  const { includeDeclaration = true, formattedOutput = true } = options

  // Format period as YYYY-MM
  const period = `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`

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
        PDV_ID: data.pdvId,
      },
      Razdoblje: {
        Godina: data.periodYear,
        Mjesec: data.periodMonth,
        Period: period,
      },
      I_Dostave: {
        // Section I: Deliveries (outgoing) - empty for paušalni receiving EU services
        I_1_Osnovica: "0.00",
        I_1_Porez: "0.00",
      },
      II_Nabave: {
        // Section II: Acquisitions (incoming) - EU services received (reverse charge)
        II_1_Osnovica_EU_Usluge: formatAmount(data.totals.baseAmount),
        II_1_Porez_EU_Usluge: formatAmount(data.totals.pdvAmount),
        II_1_Stopa: PDV_CONFIG.rate.toString(),
      },
      III_Obracun: {
        // Section III: Calculation
        III_1_PDV_Za_Uplatu: formatAmount(data.totals.pdvAmount),
        III_2_PDV_Za_Povrat: "0.00",
      },
      Transakcije:
        data.transactions.length > 0
          ? {
              Transakcija: data.transactions.map((tx) => ({
                Datum: tx.transactionDate.toISOString().split("T")[0],
                Dobavljac: tx.counterpartyName || "Nepoznat",
                Drzava: tx.counterpartyCountry || "XX",
                PDV_ID_Dobavljaca: tx.counterpartyVatId || "",
                Osnovica: formatAmount(tx.baseAmount),
                PDV: formatAmount(tx.pdvAmount),
                Tip: "PRIMLJENA_USLUGA", // Received service
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
 * Generate PDV XML for a company and period
 *
 * This is the main entry point for generating PDV forms.
 */
export async function generatePdvFormForPeriod(
  companyId: string,
  companyOib: string,
  companyName: string,
  month: number,
  year: number,
  options?: PdvXmlOptions
): Promise<{ xml: string; data: PdvFormData }> {
  // Prepare form data
  const data = await preparePdvFormData(companyId, companyOib, companyName, month, year)

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
    errors.push("Osnovica ne može biti negativna")
  }

  if (data.totals.pdvAmount < 0) {
    errors.push("PDV iznos ne može biti negativan")
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
      `PDV iznos (${actualPdvMoney.toDisplayNumber()}) ne odgovara očekivanom iznosu (${expectedPdvMoney.toDisplayNumber()})`
    )
  }

  // Validate transactions
  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i]

    if (tx.baseAmount <= 0) {
      errors.push(`Transakcija ${i + 1}: osnovica mora biti pozitivna`)
    }

    if (!tx.counterpartyCountry || tx.counterpartyCountry.length !== 2) {
      errors.push(`Transakcija ${i + 1}: nedostaje valjan kod države`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
