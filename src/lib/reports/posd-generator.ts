// src/lib/reports/posd-generator.ts
// Croatian Annual Income Tax Return (PO-SD) generator for ePorezna

import { db } from "@/lib/db"
import { Company, EInvoice, Expense, User } from "@prisma/client"
import { logger } from "@/lib/logger"

export interface POSDData {
  year: number
  company: {
    oib: string
    name: string
    address: string
    city: string
    postalCode: string
    legalForm: string
    isVatPayer: boolean
  }
  income: {
    totalIncome: number // Total business income
    revenueFromOibCustomers: number // Revenue from OIB-obligated customers
    revenueFromNonOibCustomers: number // Revenue from non-OIB customers
    otherIncome: number // Other income sources
    exemptIncome: number // Income exempt from taxation
  }
  expenses: {
    totalExpenses: number
    deductibleExpenses: number // Expenses that can be deducted for tax purposes
    nonDeductibleExpenses: number // Expenses that cannot be deducted
    categorizedExpenses: Record<string, number> // Expenses by category
  }
  taxes: {
    calculatedTax: number // Calculated tax amount
    advancePayments: number // Already paid advances
    taxDue: number // Tax due (could be negative for refund)
    socialContributions: number // Social contributions due
  }
  socialContributions: {
    pensionFund: number // Pension fund contribution (15% of income)
    disabilityFund: number // Disability fund contribution (0.5% of income)
    healthInsurance: number // Health insurance (13.5% of income)
    unemploymentInsurance: number // Unemployment insurance (0.5% of income)
    totalContributions: number // Total contributions
  }
  vatInfo: {
    totalVatCollected: number // Total VAT collected from customers
    totalVatPaid: number // Total VAT paid to suppliers (deductible)
    vatDue: number // Net VAT due (could be negative for refund)
  }
  additionalInfo: {
    numberOfEmployees: number // Number of employees (if any)
    businessPremisesCount: number // Number of business premises
    receivedForeignServices: boolean // Whether we received foreign services
  }
}

export interface POSDTaxBracket {
  minIncome: number
  maxIncome: number | null // null means infinite
  taxRate: number // In percent
  fixedAmount?: number // Fixed amount for progressive brackets
}

// Croatian tax brackets for 2025 (progressive income tax)
const CROATIAN_TAX_BRACKETS: POSDTaxBracket[] = [
  { minIncome: 0, maxIncome: 12000, taxRate: 12 },
  { minIncome: 12000, maxIncome: 30000, taxRate: 20 },
  { minIncome: 30000, maxIncome: null, taxRate: 30 }, // No upper limit
]

// Social contribution rates for 2025 (paušalni obrt)
export const SOCIAL_CONTRIBUTION_RATES = {
  pension: 0.15, // 15% pension fund
  disability: 0.005, // 0.5% disability fund
  health: 0.135, // 13.5% health insurance
  unemployment: 0.005, // 0.5% unemployment insurance
}

/**
 * Generate PO-SD (Annual Income Tax Return) for Croatian entrepreneurs
 */
export async function generatePOSD(companyId: string, year: number): Promise<POSDData> {
  try {
    // Get company information
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        oib: true,
        name: true,
        address: true,
        city: true,
        postalCode: true,
        legalForm: true,
        isVatPayer: true,
      },
    })

    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`)
    }

    // Get start and end dates for the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Get all invoices for the year that are fiscalized
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
        direction: "OUTBOUND", // Only issued invoices count toward income
      },
      include: {
        buyer: true,
        lines: {
          orderBy: { lineNumber: "asc" },
        },
      },
      orderBy: { issueDate: "asc" },
    })

    // Get all expenses for the year
    const expenses = await db.expense.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: "PAID", // Only paid expenses are deductible
      },
      include: {
        category: true,
        vendor: true,
      },
      orderBy: { date: "asc" },
    })

    // Calculate income from invoices
    let totalIncome = 0
    let revenueFromOibCustomers = 0 // Sales to OIB-obligated customers
    let revenueFromNonOibCustomers = 0 // Sales to non-OIB customers (cash basis)
    const exemptIncome = 0 // Income exempt from taxation (if any)

    for (const invoice of invoices) {
      const amount = Number(invoice.totalAmount)
      totalIncome += amount

      if (invoice.buyer?.oib) {
        revenueFromOibCustomers += amount
      } else {
        revenueFromNonOibCustomers += amount
      }
    }

    // Calculate expenses
    let totalExpenses = 0
    let deductibleExpenses = 0
    const nonDeductibleExpenses = 0
    const categorizedExpenses: Record<string, number> = {}

    for (const expense of expenses) {
      const amount = Number(expense.totalAmount)
      totalExpenses += amount

      // For paušalni obrt - classify expenses for tax purposes
      // In real implementation, certain expenses may be partially or fully non-deductible
      const category = expense.category?.name || "Ostalo"
      categorizedExpenses[category] = (categorizedExpenses[category] || 0) + amount

      // For now, we'll consider all expenses as deductible
      // In reality, some expenses (like luxury items) may be non-deductible
      deductibleExpenses += amount
    }

    // Calculate social contributions based on estimated income
    const estimatedIncome = totalIncome
    const socialContributions = {
      pensionFund: estimatedIncome * SOCIAL_CONTRIBUTION_RATES.pension,
      disabilityFund: estimatedIncome * SOCIAL_CONTRIBUTION_RATES.disability,
      healthInsurance: estimatedIncome * SOCIAL_CONTRIBUTION_RATES.health,
      unemploymentInsurance: estimatedIncome * SOCIAL_CONTRIBUTION_RATES.unemployment,
      totalContributions:
        estimatedIncome *
        (SOCIAL_CONTRIBUTION_RATES.pension +
          SOCIAL_CONTRIBUTION_RATES.disability +
          SOCIAL_CONTRIBUTION_RATES.health +
          SOCIAL_CONTRIBUTION_RATES.unemployment),
    }

    // Calculate VAT info (if company is VAT payer)
    let vatInfo = {
      totalVatCollected: 0,
      totalVatPaid: 0,
      vatDue: 0,
    }

    if (company.isVatPayer) {
      // Calculate VAT collected from sales invoices
      const vatCollected = invoices.reduce((sum, invoice) => {
        return sum + Number(invoice.vatAmount || 0)
      }, 0)

      // Calculate VAT paid on purchase expenses (if tracked separately)
      const vatPaid = expenses.reduce((sum, expense) => {
        return sum + Number(expense.vatAmount || 0)
      }, 0)

      vatInfo = {
        totalVatCollected: vatCollected,
        totalVatPaid: vatPaid,
        vatDue: vatCollected - vatPaid,
      }
    }

    // Calculate taxable income (income - deductible expenses)
    const taxableIncome = Math.max(0, totalIncome - deductibleExpenses)

    // Calculate tax based on Croatian progressive brackets
    const taxCalculation = calculateTaxForIncome(taxableIncome)

    // For now, assume no advance payments (would need to track from previous submissions)
    const advancePayments = 0

    // Calculate final tax due (could be negative for refund)
    const taxDue = taxCalculation.taxAmount - advancePayments

    // Calculate total taxes due
    const totalTaxes = taxDue + socialContributions.totalContributions

    const posdData: POSDData = {
      year,
      company: {
        oib: company.oib,
        name: company.name,
        address: company.address || "",
        city: company.city || "",
        postalCode: company.postalCode || "",
        legalForm: company.legalForm || "",
        isVatPayer: company.isVatPayer || false,
      },
      income: {
        totalIncome: Number(totalIncome.toFixed(2)),
        revenueFromOibCustomers: Number(revenueFromOibCustomers.toFixed(2)),
        revenueFromNonOibCustomers: Number(revenueFromNonOibCustomers.toFixed(2)),
        otherIncome: 0, // Could be calculated from other sources if needed
        exemptIncome: 0,
      },
      expenses: {
        totalExpenses: Number(totalExpenses.toFixed(2)),
        deductibleExpenses: Number(deductibleExpenses.toFixed(2)),
        nonDeductibleExpenses: Number(nonDeductibleExpenses.toFixed(2)),
        categorizedExpenses,
      },
      taxes: {
        calculatedTax: Number(taxCalculation.taxAmount.toFixed(2)),
        advancePayments: Number(advancePayments.toFixed(2)),
        taxDue: Number(taxDue.toFixed(2)),
        socialContributions: Number(socialContributions.totalContributions.toFixed(2)),
      },
      socialContributions: {
        pensionFund: Number(socialContributions.pensionFund.toFixed(2)),
        disabilityFund: Number(socialContributions.disabilityFund.toFixed(2)),
        healthInsurance: Number(socialContributions.healthInsurance.toFixed(2)),
        unemploymentInsurance: Number(socialContributions.unemploymentInsurance.toFixed(2)),
        totalContributions: Number(socialContributions.totalContributions.toFixed(2)),
      },
      vatInfo: {
        totalVatCollected: Number(vatInfo.totalVatCollected.toFixed(2)),
        totalVatPaid: Number(vatInfo.totalVatPaid.toFixed(2)),
        vatDue: Number(vatInfo.vatDue.toFixed(2)),
      },
      additionalInfo: {
        numberOfEmployees: 0, // Would need employee tracking system
        businessPremisesCount: 1, // Assuming at least 1 business premises
        receivedForeignServices: false, // Would need tracking for this
      },
    }

    logger.info(
      {
        companyId,
        year,
        totalIncome: posdData.income.totalIncome,
        taxDue: posdData.taxes.taxDue,
        operation: "posd_generated",
      },
      "PO-SD report generated successfully"
    )

    return posdData
  } catch (error) {
    logger.error(
      {
        error,
        companyId,
        year,
      },
      "Failed to generate PO-SD report"
    )

    throw error
  }
}

/**
 * Calculate tax based on Croatian progressive tax brackets
 */
function calculateTaxForIncome(income: number): {
  taxAmount: number
  effectiveRate: number
} {
  let taxAmount = 0
  let remainingIncome = income

  for (const bracket of CROATIAN_TAX_BRACKETS) {
    if (remainingIncome <= 0) break

    let taxableInBracket
    if (bracket.maxIncome === null) {
      // This is the top bracket - apply to all remaining income
      taxableInBracket = remainingIncome
    } else {
      // Take the minimum of remaining income and bracket range
      taxableInBracket = Math.min(remainingIncome, bracket.maxIncome - bracket.minIncome)
    }

    if (taxableInBracket > 0) {
      taxAmount += taxableInBracket * (bracket.taxRate / 100)
      remainingIncome -= taxableInBracket
    }
  }

  const effectiveRate = income > 0 ? (taxAmount / income) * 100 : 0

  return {
    taxAmount,
    effectiveRate: Number(effectiveRate.toFixed(2)),
  }
}

/**
 * Generate POSD in XML format for ePorezna submission
 */
export async function generatePOSDForePorezna(companyId: string, year: number): Promise<string> {
  try {
    const posdData = await generatePOSD(companyId, year)

    // Generate XML in the format required by Croatian Tax Authority
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<ObrazacPOSD xmlns="http://e-porezna.porezna-uprava.hr/shema/OPO-POSD/v1">\n'
    xml += `  <Oib>${posdData.company.oib}</Oib>\n`
    xml += `  <Godina>${posdData.year}</Godina>\n`
    xml += "  <PozivNaBroj>PO-SD</PozivNaBroj>\n"

    // Income section
    xml += "  <Prihodi>\n"
    xml += `    <UkupniPrihod>${posdData.income.totalIncome.toFixed(2)}</UkupniPrihod>\n`
    xml += `    <PrihodOdProdajeRobeUSlucaju>${posdData.income.revenueFromOibCustomers.toFixed(2)}</PrihodOdProdajeRobeUSlucaju>\n`
    xml += `    <PrihodOdDjelatnostiBezOibObveznika>${posdData.income.revenueFromNonOibCustomers.toFixed(2)}</PrihodOdDjelatnostiBezOibObveznika>\n`
    xml += `    <OstaliPrihodi>${posdData.income.otherIncome.toFixed(2)}</OstaliPrihodi>\n`
    xml += "  </Prihodi>\n"

    // Expenses section
    xml += "  <Odbici>\n"
    xml += `    <UkupniOdbici>${posdData.expenses.totalExpenses.toFixed(2)}</UkupniOdbici>\n`
    xml += `    <OdbiciOdPoreza>${posdData.expenses.deductibleExpenses.toFixed(2)}</OdbiciOdPoreza>\n`
    xml += "  </Odbici>\n"

    // Tax calculation section
    xml += "  <Porez>\n"
    xml += `    <IznosPoretka>${posdData.taxes.calculatedTax.toFixed(2)}</IznosPoretka>\n`
    xml += `    <PredplaceniPorez>${posdData.taxes.advancePayments.toFixed(2)}</PredplaceniPorez>\n`
    xml += `    <PorezZaPlatiti>${posdData.taxes.taxDue.toFixed(2)}</PorezZaPlatiti>\n`
    xml += "  </Porez>\n"

    // Social contributions section
    xml += "  <Doprinosi>\n"
    xml += `    <DoprinosZaMirovinsko>${posdData.socialContributions.pensionFund.toFixed(2)}</DoprinosZaMirovinsko>\n`
    xml += `    <DoprinosZaNezgodno>${posdData.socialContributions.disabilityFund.toFixed(2)}</DoprinosZaNezgodno>\n`
    xml += `    <DoprinosZaZdravstveno>${posdData.socialContributions.healthInsurance.toFixed(2)}</DoprinosZaZdravstveno>\n`
    xml += `    <DoprinosZaNezapostavljenost>${posdData.socialContributions.unemploymentInsurance.toFixed(2)}</DoprinosZaNezapostavljenost>\n`
    xml += `    <UkupnoDoprinosi>${posdData.socialContributions.totalContributions.toFixed(2)}</UkupnoDoprinosi>\n`
    xml += "  </Doprinosi>\n"

    // VAT information (if company is VAT payer)
    if (posdData.company.isVatPayer) {
      xml += "  <Pdv>\n"
      xml += `    <UkupnoPdvPrimio>${posdData.vatInfo.totalVatCollected.toFixed(2)}</UkupnoPdvPrimio>\n`
      xml += `    <UkupnoPdvPovratio>${posdData.vatInfo.totalVatPaid.toFixed(2)}</UkupnoPdvPovratio>\n`
      xml += `    <NetoPdvZaPlatiti>${posdData.vatInfo.vatDue.toFixed(2)}</NetoPdvZaPlatiti>\n`
      xml += "  </Pdv>\n"
    }

    // Additional information
    xml += "  <DodatniPodaci>\n"
    xml += `    <BrojZaposlenika>${posdData.additionalInfo.numberOfEmployees}</BrojZaposlenika>\n`
    xml += `    <BrojPoslovnihProstora>${posdData.additionalInfo.businessPremisesCount}</BrojPoslovnihProstora>\n`
    xml += `    <KoristenjeStranihUsluga>${posdData.additionalInfo.receivedForeignServices ? "DA" : "NE"}</KoristenjeStranihUsluga>\n`
    xml += "  </DodatniPodaci>\n"

    xml += "</ObrazacPOSD>"

    logger.info(
      {
        companyId,
        year,
        operation: "posd_xml_generated",
      },
      "PO-SD XML generated for ePorezna submission"
    )

    return xml
  } catch (error) {
    logger.error(
      {
        error,
        companyId,
        year,
      },
      "Failed to generate PO-SD XML for ePorezna"
    )

    throw error
  }
}

/**
 * Generate quarterly POSD summary for monitoring
 */
export async function generateQuarterlyPOSDSummary(
  companyId: string,
  year: number
): Promise<{
  year: number
  company: POSDData["company"]
  quarters: Array<{
    quarter: number
    income: number
    expenses: number
    taxableIncome: number
    estimatedTax: number
    estimatedSocialContributions: number
  }>
}> {
  try {
    const quarters = []

    for (let quarter = 1; quarter <= 4; quarter++) {
      const startMonth = (quarter - 1) * 3
      const endMonth = startMonth + 2

      const startDate = new Date(year, startMonth, 1)
      const endDate = new Date(year, endMonth + 1, 0) // Last day of quarter

      // Get invoices for the quarter
      const quarterlyInvoices = await db.eInvoice.findMany({
        where: {
          companyId,
          issueDate: {
            gte: startDate,
            lte: endDate,
          },
          status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
          direction: "OUTBOUND",
        },
        select: {
          totalAmount: true,
          vatAmount: true,
        },
      })

      // Get expenses for the quarter
      const quarterlyExpenseRecords = await db.expense.findMany({
        where: {
          companyId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: "PAID",
        },
        select: {
          totalAmount: true,
          vatAmount: true,
        },
      })

      const quarterlyIncome = quarterlyInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0
      )
      const quarterlyExpensesTotal = quarterlyExpenseRecords.reduce(
        (sum, exp) => sum + Number(exp.totalAmount),
        0
      )
      const quarterlyTaxableIncome = Math.max(0, quarterlyIncome - quarterlyExpensesTotal)

      // Calculate estimated tax for the quarter
      const quarterlyTax = calculateTaxForIncome(quarterlyTaxableIncome)
      const quarterlySocialContrib =
        quarterlyIncome *
        (SOCIAL_CONTRIBUTION_RATES.pension +
          SOCIAL_CONTRIBUTION_RATES.disability +
          SOCIAL_CONTRIBUTION_RATES.health +
          SOCIAL_CONTRIBUTION_RATES.unemployment)

      quarters.push({
        quarter,
        income: Number(quarterlyIncome.toFixed(2)),
        expenses: Number(quarterlyExpensesTotal.toFixed(2)),
        taxableIncome: Number(quarterlyTaxableIncome.toFixed(2)),
        estimatedTax: Number(quarterlyTax.taxAmount.toFixed(2)),
        estimatedSocialContributions: Number(quarterlySocialContrib.toFixed(2)),
      })
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        oib: true,
        name: true,
        address: true,
        city: true,
        postalCode: true,
        legalForm: true,
        isVatPayer: true,
      },
    })

    logger.info(
      {
        companyId,
        year,
        quarterCount: quarters.length,
        operation: "quarterly_posd_summary_generated",
      },
      "Quarterly PO-SD summary generated"
    )

    return {
      year,
      company: company
        ? { ...company, legalForm: company.legalForm || "" }
        : {
            oib: "unknown",
            name: "unknown",
            address: "",
            city: "",
            postalCode: "",
            legalForm: "",
            isVatPayer: false,
          },
      quarters,
    }
  } catch (error) {
    logger.error(
      {
        error,
        companyId,
        year,
      },
      "Failed to generate quarterly PO-SD summary"
    )

    throw error
  }
}
