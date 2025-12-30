import { drizzleDb } from "@/lib/db/drizzle"
import {
  paymentObligation,
  pausalniProfile,
  OBLIGATION_TYPES,
  OBLIGATION_STATUS,
} from "@/lib/db/schema/pausalni"
import { DOPRINOSI_2025, DEADLINES, HOK_CONFIG, CROATIAN_MONTHS } from "./constants"
import { eq, and } from "drizzle-orm"
import {
  THRESHOLDS,
  exceedsPausalniLimit,
  lookupPostalCode,
  calculatePausalTaxWithPrirez,
} from "@/lib/fiscal-data"
import { prisma } from "@/lib/db/prisma"
import { differenceInYears, startOfMonth, isBefore, isAfter } from "date-fns"

/**
 * Custom error for when annual income exceeds paušalni threshold
 */
export class PausalniThresholdExceededError extends Error {
  public readonly income: number
  public readonly threshold: number

  constructor(income: number) {
    const threshold = THRESHOLDS.pausalni.value
    super(
      \`Godišnji primitak (\${income.toLocaleString("hr-HR")} EUR) prelazi granicu za paušalno oporezivanje (\${threshold.toLocaleString("hr-HR")} EUR). Morate prijeći na obrt na dohodak i registrirati se za PDV.\`
    )
    this.name = "PausalniThresholdExceededError"
    this.income = income
    this.threshold = threshold
  }
}

interface GenerateOptions {
  companyId: string
  year: number
  month?: number // If provided, generate only for this month
  annualIncome?: number // If provided, validate against 60,000 EUR threshold
}

/**
 * Generate all payment obligations for a paušalni obrt company
 */
export async function generateObligations({
  companyId,
  year,
  month,
  annualIncome,
}: GenerateOptions) {
  // Get company's paušalni profile
  const profile = await drizzleDb
    .select()
    .from(pausalniProfile)
    .where(eq(pausalniProfile.companyId, companyId))
    .limit(1)

  const hasProfile = profile.length > 0
  const hasPdvId = hasProfile && profile[0].hasPdvId
  const hokMemberSince = hasProfile ? profile[0].hokMemberSince : null
  const registrationDate =
    hasProfile && profile[0].registrationDate ? new Date(profile[0].registrationDate) : null

  // Get company details for prirez calculation
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { postalCode: true, city: true },
  })

  // Look up prirez rate based on postal code
  let prirezRate = 0
  if (company?.postalCode) {
    const postalCodeData = lookupPostalCode(company.postalCode)
    if (postalCodeData) {
      prirezRate = postalCodeData.prirezRate
    }
  }

  const obligations: Array<{
    companyId: string
    obligationType: string
    periodMonth: number
    periodYear: number
    amount: string
    dueDate: string
    status: string
  }> = []

  const months = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  for (const m of months) {
    // Skip months before business registration
    // Doprinosi are paid in current month for previous month's work
    // So if registered in June, first doprinosi payment is in July (for June)
    if (registrationDate) {
      const periodMonth = m === 1 ? 12 : m - 1
      const periodYear = m === 1 ? year - 1 : year
      const obligationPeriod = startOfMonth(new Date(periodYear, periodMonth - 1, 1))

      // Skip if the obligation period is before registration date
      if (isBefore(obligationPeriod, startOfMonth(registrationDate))) {
        continue
      }
    }

    // Monthly doprinosi (due 15th of current month for previous month)
    const doprinosiDueDate = new Date(year, m - 1, DEADLINES.DOPRINOSI)

    obligations.push({
      companyId,
      obligationType: OBLIGATION_TYPES.DOPRINOSI_MIO_I,
      periodMonth: m === 1 ? 12 : m - 1, // Previous month
      periodYear: m === 1 ? year - 1 : year,
      amount: DOPRINOSI_2025.MIO_I.amount.toFixed(2),
      dueDate: doprinosiDueDate.toISOString().split("T")[0],
      status: OBLIGATION_STATUS.PENDING,
    })

    obligations.push({
      companyId,
      obligationType: OBLIGATION_TYPES.DOPRINOSI_MIO_II,
      periodMonth: m === 1 ? 12 : m - 1,
      periodYear: m === 1 ? year - 1 : year,
      amount: DOPRINOSI_2025.MIO_II.amount.toFixed(2),
      dueDate: doprinosiDueDate.toISOString().split("T")[0],
      status: OBLIGATION_STATUS.PENDING,
    })

    obligations.push({
      companyId,
      obligationType: OBLIGATION_TYPES.DOPRINOSI_ZDRAVSTVENO,
      periodMonth: m === 1 ? 12 : m - 1,
      periodYear: m === 1 ? year - 1 : year,
      amount: DOPRINOSI_2025.ZDRAVSTVENO.amount.toFixed(2),
      dueDate: doprinosiDueDate.toISOString().split("T")[0],
      status: OBLIGATION_STATUS.PENDING,
    })

    // PDV forms and payment (only if has PDV-ID)
    if (hasPdvId) {
      // PDV period is the current month (unlike doprinosi which are for previous month)
      // Skip if PDV period is before registration
      let skipPdv = false
      if (registrationDate) {
        const pdvPeriod = startOfMonth(new Date(year, m - 1, 1))
        if (isBefore(pdvPeriod, startOfMonth(registrationDate))) {
          skipPdv = true
        }
      }

      if (!skipPdv) {
        // PDV forms due 20th of following month
        const pdvFormsDueDate = new Date(year, m, DEADLINES.PDV_FORMS)

        // PDV payment due last day of following month
        const pdvPaymentDueDate = new Date(year, m + 1, 0) // Day 0 of next month = last day of current month

        obligations.push({
          companyId,
          obligationType: OBLIGATION_TYPES.PDV,
          periodMonth: m,
          periodYear: year,
          amount: "0.00", // Will be calculated from EU transactions
          dueDate: pdvPaymentDueDate.toISOString().split("T")[0],
          status: OBLIGATION_STATUS.PENDING,
        })
      }
    }
  }

  // Quarterly porez na dohodak
  const quarters = [
    { q: 1, deadline: DEADLINES.POREZ_Q1 },
    { q: 2, deadline: DEADLINES.POREZ_Q2 },
    { q: 3, deadline: DEADLINES.POREZ_Q3 },
    { q: 4, deadline: DEADLINES.POREZ_Q4 },
  ]

  for (const { q, deadline } of quarters) {
    if (!month || (month <= deadline.month && month >= (q - 1) * 3 + 1)) {
      // Skip quarters that end before registration
      // Q1 ends March 31, Q2 ends June 30, Q3 ends Sept 30, Q4 ends Dec 31
      let skipQuarter = false
      if (registrationDate) {
        const quarterEndMonth = q * 3 // Q1=3, Q2=6, Q3=9, Q4=12
        const quarterEndDate = new Date(year, quarterEndMonth, 0) // Last day of quarter

        // If registration is after the quarter ends, skip this quarter
        if (isAfter(registrationDate, quarterEndDate)) {
          skipQuarter = true
        }
      }

      if (!skipQuarter) {
        const dueDate = new Date(year, deadline.month - 1, deadline.day)

        // Calculate quarterly tax amount with prirez
        let quarterlyTaxAmount = "0.00"
        if (annualIncome !== undefined) {
          const taxWithPrirez = calculatePausalTaxWithPrirez(annualIncome, prirezRate)
          quarterlyTaxAmount = taxWithPrirez.quarterly.toFixed(2)
        } else {
          // If annualIncome not provided, use the lowest bracket but still apply prirez
          const taxWithPrirez = calculatePausalTaxWithPrirez(0, prirezRate)
          quarterlyTaxAmount = taxWithPrirez.quarterly.toFixed(2)
        }

        obligations.push({
          companyId,
          obligationType: OBLIGATION_TYPES.POREZ_DOHODAK,
          periodMonth: q, // Q1, Q2, Q3, Q4
          periodYear: year,
          amount: quarterlyTaxAmount,
          dueDate: dueDate.toISOString().split("T")[0],
          status: OBLIGATION_STATUS.PENDING,
        })
      }
    }
  }

  // HOK quarterly (if member for > 2 years)
  if (hokMemberSince) {
    // Use date-fns for precise year calculation instead of 365.25 days
    const membershipYears = differenceInYears(new Date(), new Date(hokMemberSince))
    if (membershipYears >= HOK_CONFIG.exemptYears) {
      for (const { q, deadline } of quarters) {
        if (!month || (month <= deadline.month && month >= (q - 1) * 3 + 1)) {
          // Skip quarters that end before HOK membership started
          let skipHokQuarter = false
          if (registrationDate) {
            const quarterEndMonth = q * 3
            const quarterEndDate = new Date(year, quarterEndMonth, 0)
            if (isAfter(registrationDate, quarterEndDate)) {
              skipHokQuarter = true
            }
          }

          if (!skipHokQuarter) {
            const dueDate = new Date(year, deadline.month - 1, deadline.day)
            obligations.push({
              companyId,
              obligationType: OBLIGATION_TYPES.HOK,
              periodMonth: q,
              periodYear: year,
              amount: HOK_CONFIG.quarterlyAmount.toFixed(2),
              dueDate: dueDate.toISOString().split("T")[0],
              status: OBLIGATION_STATUS.PENDING,
            })
          }
        }
      }
    }
  }

  // Annual PO-SD (January 31 for previous year)
  if (!month || month === 1) {
    // Skip if registered in current year (no previous year to report)
    let skipPoSd = false
    if (registrationDate) {
      const registrationYear = registrationDate.getFullYear()
      // If registered in the same year or after the reporting year, skip
      if (registrationYear >= year) {
        skipPoSd = true
      }
    }

    if (!skipPoSd) {
      const posdDueDate = new Date(year, DEADLINES.PO_SD.month - 1, DEADLINES.PO_SD.day)
      obligations.push({
        companyId,
        obligationType: OBLIGATION_TYPES.PO_SD,
        periodMonth: 12, // For full previous year
        periodYear: year - 1,
        amount: "0.00", // No payment, just filing
        dueDate: posdDueDate.toISOString().split("T")[0],
        status: OBLIGATION_STATUS.PENDING,
      })
    }
  }

  // Insert obligations (skip if already exist)
  for (const ob of obligations) {
    await drizzleDb.insert(paymentObligation).values(ob).onConflictDoNothing()
  }

  return obligations
}

/**
 * Update obligation statuses based on current date
 */
export async function updateObligationStatuses(companyId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const threeDaysFromNow = new Date(today)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  // Get all pending obligations
  const pending = await drizzleDb
    .select()
    .from(paymentObligation)
    .where(
      and(
        eq(paymentObligation.companyId, companyId),
        eq(paymentObligation.status, OBLIGATION_STATUS.PENDING)
      )
    )

  for (const ob of pending) {
    const dueDate = new Date(ob.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    let newStatus = ob.status

    if (dueDate < today) {
      newStatus = OBLIGATION_STATUS.OVERDUE
    } else if (dueDate <= threeDaysFromNow) {
      newStatus = OBLIGATION_STATUS.DUE_SOON
    }

    if (newStatus !== ob.status) {
      await drizzleDb
        .update(paymentObligation)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(paymentObligation.id, ob.id))
    }
  }
}
