import { Builder } from "xml2js"
import { drizzleDb } from "@/lib/db/drizzle"
import { pausalniProfile } from "@/lib/db/schema/pausalni"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"

// Expense brackets for paušalni obrt (based on Croatian tax law)
export const EXPENSE_BRACKETS = [
  { value: 25, label: "Uslužne djelatnosti" },
  { value: 30, label: "Proizvodne i trgovačke djelatnosti" },
  { value: 34, label: "Trgovina na malo" },
  { value: 40, label: "Promet na veliko" },
] as const

export type ExpenseBracket = (typeof EXPENSE_BRACKETS)[number]["value"]

export interface PosdFormData {
  companyOib: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyPostalCode: string
  activityCode?: string // NKDI activity code
  periodYear: number
  grossIncome: number
  expenseBracket: ExpenseBracket
  calculatedExpenses: number
  netIncome: number // Taxable base
  monthlyBreakdown?: {
    month: number
    income: number
    invoiceCount: number
  }[]
  invoiceCount: number
}

export interface PosdXmlOptions {
  includeDeclaration?: boolean
  formattedOutput?: boolean
}

/**
 * Calculate expenses and net income based on gross income and expense bracket
 */
export function calculatePosdAmounts(
  grossIncome: number,
  expenseBracket: ExpenseBracket
): { calculatedExpenses: number; netIncome: number } {
  const calculatedExpenses = Math.round(grossIncome * (expenseBracket / 100) * 100) / 100
  const netIncome = Math.round((grossIncome - calculatedExpenses) * 100) / 100
  return { calculatedExpenses, netIncome }
}

/**
 * Fetch annual income summary for a company
 */
export async function getAnnualIncomeSummary(
  companyId: string,
  year: number
): Promise<{
  totalIncome: number
  invoiceCount: number
  monthlyBreakdown: { month: number; income: number; invoiceCount: number }[]
}> {
  // Query invoices for the year
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      issueDate: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
      status: {
        notIn: ["DRAFT", "CANCELLED"],
      },
    },
    select: {
      totalAmount: true,
      issueDate: true,
    },
  })

  // Calculate monthly breakdown
  const monthlyMap = new Map<number, { income: number; count: number }>()
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, { income: 0, count: 0 })
  }

  let totalIncome = 0
  for (const inv of invoices) {
    const month = inv.issueDate.getMonth() + 1
    const amount = Number(inv.totalAmount)
    totalIncome += amount

    const current = monthlyMap.get(month)!
    current.income += amount
    current.count += 1
  }

  const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    income: Math.round(data.income * 100) / 100,
    invoiceCount: data.count,
  }))

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    invoiceCount: invoices.length,
    monthlyBreakdown,
  }
}

/**
 * Prepare PO-SD form data from database
 */
export async function preparePosdFormData(
  companyId: string,
  year: number,
  expenseBracket: ExpenseBracket,
  overrideGrossIncome?: number
): Promise<PosdFormData> {
  // Fetch company info
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      oib: true,
      name: true,
      address: true,
      city: true,
      postalCode: true,
    },
  })

  // Fetch paušalni profile for activity code
  const [profile] = await drizzleDb
    .select()
    .from(pausalniProfile)
    .where(eq(pausalniProfile.companyId, companyId))
    .limit(1)

  // Get income summary
  const incomeSummary = await getAnnualIncomeSummary(companyId, year)

  // Use override income if provided, otherwise use calculated
  const grossIncome = overrideGrossIncome ?? incomeSummary.totalIncome

  // Calculate expenses and net income
  const { calculatedExpenses, netIncome } = calculatePosdAmounts(grossIncome, expenseBracket)

  return {
    companyOib: company.oib,
    companyName: company.name,
    companyAddress: company.address || "",
    companyCity: company.city || "",
    companyPostalCode: company.postalCode || "",
    activityCode: profile?.activityCode || undefined,
    periodYear: year,
    grossIncome,
    expenseBracket,
    calculatedExpenses,
    netIncome,
    monthlyBreakdown: incomeSummary.monthlyBreakdown,
    invoiceCount: incomeSummary.invoiceCount,
  }
}

/**
 * Generate PO-SD XML for ePorezna submission
 *
 * Format follows Croatian Tax Authority (Porezna uprava) XML schema for PO-SD form.
 * PO-SD is the annual income report for paušalni obrt.
 */
export function generatePosdXml(data: PosdFormData, options: PosdXmlOptions = {}): string {
  const { includeDeclaration = true, formattedOutput = true } = options

  // Build XML structure following ePorezna format
  const xmlObject = {
    PoSdPrijava: {
      $: {
        xmlns: "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPOSD/v1-0",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      },
      Metapodaci: {
        Datum: new Date().toISOString().split("T")[0],
        Vrijeme: new Date().toISOString().split("T")[1].split(".")[0],
        Oblik: "PO-SD",
        Verzija: "1.0",
      },
      Porezni_obveznik: {
        OIB: data.companyOib,
        Naziv: data.companyName,
        Adresa: data.companyAddress,
        Mjesto: data.companyCity,
        PostanskiBroj: data.companyPostalCode,
        ...(data.activityCode && { SifraObrta: data.activityCode }),
      },
      Razdoblje: {
        Godina: data.periodYear,
        VrstaPrijave: "GODISNJA",
      },
      Prihodi: {
        // I. Ukupan primitak
        I_UkupanPrimitak: formatAmount(data.grossIncome),
        // II. Priznati izdaci (paušalni)
        II_StopaPriznatihIzdataka: data.expenseBracket.toString(),
        II_IznosPriznatihIzdataka: formatAmount(data.calculatedExpenses),
        // III. Dohodak (porezna osnovica)
        III_Dohodak: formatAmount(data.netIncome),
      },
      MjesecniPregled:
        data.monthlyBreakdown && data.monthlyBreakdown.length > 0
          ? {
              Mjesec: data.monthlyBreakdown.map((m) => ({
                RedniBroj: m.month,
                Primitak: formatAmount(m.income),
                BrojRacuna: m.invoiceCount,
              })),
            }
          : undefined,
      Izjava: {
        Tekst:
          "Pod materijalnom i kaznenom odgovornošću izjavljujem da su podaci u ovoj prijavi istiniti i potpuni.",
        DatumIzjave: new Date().toISOString().split("T")[0],
      },
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
 * Generate PO-SD form for a company and period
 *
 * This is the main entry point for generating PO-SD forms.
 */
export async function generatePosdFormForPeriod(
  companyId: string,
  year: number,
  expenseBracket: ExpenseBracket,
  overrideGrossIncome?: number,
  options?: PosdXmlOptions
): Promise<{ xml: string; data: PosdFormData }> {
  // Prepare form data
  const data = await preparePosdFormData(companyId, year, expenseBracket, overrideGrossIncome)

  // Generate XML
  const xml = generatePosdXml(data, options)

  return { xml, data }
}

/**
 * Validate PO-SD form data before submission
 */
export function validatePosdFormData(data: PosdFormData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate OIB (11 digits)
  if (!/^\d{11}$/.test(data.companyOib)) {
    errors.push("OIB mora imati točno 11 znamenki")
  }

  // Validate period
  if (data.periodYear < 2000 || data.periodYear > 2100) {
    errors.push("Godina nije validna")
  }

  // Validate expense bracket
  if (![25, 30, 34, 40].includes(data.expenseBracket)) {
    errors.push("Stopa priznatih troškova mora biti 25%, 30%, 34% ili 40%")
  }

  // Validate amounts
  if (data.grossIncome < 0) {
    errors.push("Ukupan primitak ne može biti negativan")
  }

  // Validate expense calculation
  const expectedExpenses =
    Math.round(data.grossIncome * (data.expenseBracket / 100) * 100) / 100
  if (Math.abs(expectedExpenses - data.calculatedExpenses) > 0.02) {
    errors.push(
      `Iznos priznatih troškova (${data.calculatedExpenses}) ne odgovara očekivanom iznosu (${expectedExpenses})`
    )
  }

  // Validate net income calculation
  const expectedNetIncome =
    Math.round((data.grossIncome - data.calculatedExpenses) * 100) / 100
  if (Math.abs(expectedNetIncome - data.netIncome) > 0.02) {
    errors.push(
      `Dohodak (${data.netIncome}) ne odgovara očekivanom iznosu (${expectedNetIncome})`
    )
  }

  // Validate company info
  if (!data.companyName || data.companyName.trim().length === 0) {
    errors.push("Naziv tvrtke je obavezan")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Generate PDF summary for PO-SD form (human-readable)
 * Returns data suitable for PDF rendering
 */
export function generatePosdPdfData(data: PosdFormData) {
  return {
    title: `PO-SD Obrazac - ${data.periodYear}. godina`,
    subtitle: "Prijava poreza na dohodak za paušalni obrt",
    company: {
      name: data.companyName,
      oib: data.companyOib,
      address: data.companyAddress,
      city: `${data.companyPostalCode} ${data.companyCity}`,
    },
    period: {
      year: data.periodYear,
      type: "Godišnja prijava",
    },
    income: {
      grossIncome: data.grossIncome,
      expenseRate: data.expenseBracket,
      expenseRateLabel:
        EXPENSE_BRACKETS.find((b) => b.value === data.expenseBracket)?.label || "",
      calculatedExpenses: data.calculatedExpenses,
      netIncome: data.netIncome,
    },
    monthlyBreakdown: data.monthlyBreakdown,
    invoiceCount: data.invoiceCount,
    generatedAt: new Date().toISOString(),
  }
}
