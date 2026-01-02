// src/lib/guidance/checklist.ts
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS, OBLIGATION_TYPES } from "@/lib/db/schema/pausalni"
import { complianceDeadlines } from "@/lib/db/schema/deadlines"
import {
  checklistInteractions,
  CHECKLIST_ITEM_TYPES,
  CHECKLIST_ACTIONS,
  type GuidanceCategory,
} from "@/lib/db/schema/guidance"
import { eq, and, or, gte, lte, inArray, sql } from "drizzle-orm"
import { OBLIGATION_LABELS } from "@/lib/pausalni/constants"
import { getAllPatternInsights } from "./patterns"

// Re-export constants from schema for convenience
export { CHECKLIST_ITEM_TYPES }

// Urgency levels for checklist items
export const URGENCY_LEVELS = {
  CRITICAL: "critical", // Overdue or due today
  SOON: "soon", // Due within 3 days
  UPCOMING: "upcoming", // Due within 7 days
  OPTIONAL: "optional", // Suggestions, no deadline
} as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[keyof typeof URGENCY_LEVELS]

// Action types for checklist items
export const ACTION_TYPES = {
  LINK: "link",
  WIZARD: "wizard",
  QUICK_ACTION: "quick_action",
} as const

export interface ChecklistItem {
  id: string
  category: GuidanceCategory
  type: (typeof CHECKLIST_ITEM_TYPES)[keyof typeof CHECKLIST_ITEM_TYPES]
  title: string
  description: string
  dueDate?: Date
  urgency: UrgencyLevel
  action: {
    type: (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES]
    href?: string
    wizardId?: string
  }
  reference: string // For tracking interactions (e.g., "obligation:abc123")
}

interface GetChecklistParams {
  userId: string
  companyId: string
  businessType?: string
  includeCompleted?: boolean
  includeDismissed?: boolean
  limit?: number
}

/**
 * Calculate urgency level based on due date
 */
function calculateUrgency(dueDate: Date | null | undefined): UrgencyLevel {
  if (!dueDate) return URGENCY_LEVELS.OPTIONAL

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) return URGENCY_LEVELS.CRITICAL // Overdue
  if (daysUntil === 0) return URGENCY_LEVELS.CRITICAL // Due today
  if (daysUntil <= 3) return URGENCY_LEVELS.SOON
  if (daysUntil <= 7) return URGENCY_LEVELS.UPCOMING
  return URGENCY_LEVELS.OPTIONAL
}

/**
 * Map obligation type to guidance category
 */
function getObligationCategory(obligationType: string): GuidanceCategory {
  if (obligationType === OBLIGATION_TYPES.PDV) return "eu"
  return "financije"
}

/**
 * Map deadline type to guidance category
 */
function getDeadlineCategory(deadlineType: string): GuidanceCategory {
  if (deadlineType.includes("pdv") || deadlineType.includes("eu")) return "eu"
  if (deadlineType.includes("racun") || deadlineType.includes("faktur")) return "fakturiranje"
  return "financije"
}

/**
 * Get completed/dismissed item references for filtering
 */
async function getInteractedReferences(
  userId: string,
  companyId: string,
  actions: string[]
): Promise<Set<string>> {
  const interactions = await drizzleDb
    .select({ ref: checklistInteractions.itemReference })
    .from(checklistInteractions)
    .where(
      and(
        eq(checklistInteractions.userId, userId),
        eq(checklistInteractions.companyId, companyId),
        inArray(checklistInteractions.action, actions)
      )
    )

  return new Set(interactions.map((i) => i.ref))
}

/**
 * Get currently snoozed item references (where snoozedUntil > now)
 * These items should be hidden until their snooze expires
 */
async function getSnoozedReferences(userId: string, companyId: string): Promise<Set<string>> {
  const now = new Date()
  const snoozedInteractions = await drizzleDb
    .select({ ref: checklistInteractions.itemReference })
    .from(checklistInteractions)
    .where(
      and(
        eq(checklistInteractions.userId, userId),
        eq(checklistInteractions.companyId, companyId),
        eq(checklistInteractions.action, CHECKLIST_ACTIONS.SNOOZED),
        gte(checklistInteractions.snoozedUntil, now)
      )
    )

  return new Set(snoozedInteractions.map((i) => i.ref))
}

/**
 * Get count of completed items for a user/company
 * This counts all items marked as completed in the interactions table
 */
async function getCompletedCount(userId: string, companyId: string): Promise<number> {
  const result = await drizzleDb
    .select({ count: sql<number>`count(*)` })
    .from(checklistInteractions)
    .where(
      and(
        eq(checklistInteractions.userId, userId),
        eq(checklistInteractions.companyId, companyId),
        eq(checklistInteractions.action, CHECKLIST_ACTIONS.COMPLETED)
      )
    )

  return Number(result[0]?.count ?? 0)
}

/**
 * Get unpaid payment obligations as checklist items
 */
async function getObligationItems(
  companyId: string,
  excludeRefs: Set<string>
): Promise<ChecklistItem[]> {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const obligations = await drizzleDb
    .select()
    .from(paymentObligation)
    .where(
      and(
        eq(paymentObligation.companyId, companyId),
        or(
          eq(paymentObligation.status, OBLIGATION_STATUS.PENDING),
          eq(paymentObligation.status, OBLIGATION_STATUS.DUE_SOON),
          eq(paymentObligation.status, OBLIGATION_STATUS.OVERDUE)
        ),
        lte(paymentObligation.dueDate, thirtyDaysFromNow.toISOString().split("T")[0])
      )
    )

  return obligations
    .map((ob) => {
      const reference = `obligation:${ob.id}`
      if (excludeRefs.has(reference)) return null

      const label = OBLIGATION_LABELS[ob.obligationType] || ob.obligationType
      const amount = parseFloat(ob.amount)

      return {
        id: ob.id,
        category: getObligationCategory(ob.obligationType),
        type: CHECKLIST_ITEM_TYPES.PAYMENT,
        title: `${label} - plaćanje`,
        description:
          amount > 0
            ? `${amount.toFixed(2)} EUR za ${ob.periodMonth}/${ob.periodYear}`
            : `Rok: ${new Date(ob.dueDate).toLocaleDateString("hr-HR")}`,
        dueDate: new Date(ob.dueDate),
        urgency: calculateUrgency(new Date(ob.dueDate)),
        action: {
          type: ACTION_TYPES.LINK,
          href: `/pausalni/obligations?highlight=${ob.id}`,
        },
        reference,
      } as ChecklistItem
    })
    .filter((item): item is ChecklistItem => item !== null)
}

/**
 * Get upcoming compliance deadlines as checklist items
 */
async function getDeadlineItems(
  businessType: string,
  excludeRefs: Set<string>
): Promise<ChecklistItem[]> {
  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const deadlines = await drizzleDb
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        gte(complianceDeadlines.deadlineDate, today),
        lte(complianceDeadlines.deadlineDate, thirtyDaysFromNow.toISOString().split("T")[0]),
        sql`${complianceDeadlines.appliesTo}::jsonb @> ${JSON.stringify([businessType])}::jsonb OR ${complianceDeadlines.appliesTo}::jsonb @> '["all"]'::jsonb`
      )
    )

  return deadlines
    .map((d) => {
      const reference = `deadline:${d.id}`
      if (excludeRefs.has(reference)) return null

      return {
        id: d.id,
        category: getDeadlineCategory(d.deadlineType || ""),
        type: CHECKLIST_ITEM_TYPES.DEADLINE,
        title: d.title,
        description: d.description || "",
        dueDate: new Date(d.deadlineDate),
        urgency: calculateUrgency(new Date(d.deadlineDate)),
        action: {
          type: ACTION_TYPES.LINK,
          href: `/rokovi/${d.id}`,
        },
        reference,
      } as ChecklistItem
    })
    .filter((item): item is ChecklistItem => item !== null)
}

/**
 * Get pending actions (draft invoices, etc.) as checklist items
 */
async function getPendingActionItems(
  companyId: string,
  excludeRefs: Set<string>
): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = []

  // Draft invoices
  const draftInvoices = await db.eInvoice.findMany({
    where: {
      companyId,
      status: "DRAFT",
    },
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      buyer: { select: { name: true } },
    },
  })

  for (const invoice of draftInvoices) {
    const reference = `draft_invoice:${invoice.id}`
    if (excludeRefs.has(reference)) continue

    items.push({
      id: invoice.id,
      category: "fakturiranje",
      type: CHECKLIST_ITEM_TYPES.ACTION,
      title: "Dovrši nacrt računa",
      description: invoice.buyer?.name
        ? `${invoice.buyer.name} - ${Number(invoice.totalAmount).toFixed(2)} EUR`
        : `Račun ${invoice.invoiceNumber || "bez broja"}`,
      urgency: URGENCY_LEVELS.UPCOMING,
      action: {
        type: ACTION_TYPES.LINK,
        href: `/e-invoices/${invoice.id}/edit`,
      },
      reference,
    })
  }

  return items
}

/**
 * Get onboarding gap items
 */
async function getOnboardingItems(
  companyId: string,
  excludeRefs: Set<string>
): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = []

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      oib: true,
      address: true,
      eInvoiceProvider: true,
      _count: {
        select: {
          contacts: true,
          products: true,
          eInvoices: true,
        },
      },
    },
  })

  if (!company) return items

  // Missing company data
  if (!company.oib || !company.address) {
    const ref = "onboarding:company_data"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_company",
        category: "fakturiranje",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Dopuni podatke o tvrtki",
        description: "Dodaj OIB i adresu za pravilno fakturiranje",
        urgency: URGENCY_LEVELS.UPCOMING,
        action: {
          type: ACTION_TYPES.LINK,
          href: "/settings",
        },
        reference: ref,
      })
    }
  }

  // No e-invoice provider - Issue #885: Updated href to dedicated e-invoice settings page
  if (!company.eInvoiceProvider) {
    const ref = "onboarding:einvoice_provider"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_provider",
        category: "fakturiranje",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Poveži informacijskog posrednika",
        description: "Konfiguriraj IE-Računi ili drugi posrednik za slanje e-računa",
        urgency: URGENCY_LEVELS.UPCOMING,
        action: {
          type: ACTION_TYPES.WIZARD,
          wizardId: "einvoice_setup",
          href: "/settings/e-invoice",
        },
        reference: ref,
      })
    }
  }

  // Issue #885: First invoice guidance
  if (company._count.eInvoices === 0) {
    const ref = "onboarding:first_invoice"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_first_invoice",
        category: "fakturiranje",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Kreiraj prvi račun",
        description: "Izradite svoj prvi e-račun koristeći vodič korak-po-korak",
        urgency: URGENCY_LEVELS.UPCOMING,
        action: {
          type: ACTION_TYPES.WIZARD,
          wizardId: "first_invoice",
          href: "/e-invoices/new",
        },
        reference: ref,
      })
    }
  }

  // No contacts
  if (company._count.contacts === 0) {
    const ref = "onboarding:first_contact"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_contact",
        category: "fakturiranje",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Dodaj prvi kontakt",
        description: "Kreiraj kupca ili dobavljača za fakturiranje",
        urgency: URGENCY_LEVELS.OPTIONAL,
        action: {
          type: ACTION_TYPES.LINK,
          href: "/contacts/new",
        },
        reference: ref,
      })
    }
  }

  // No products
  if (company._count.products === 0) {
    const ref = "onboarding:first_product"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_product",
        category: "fakturiranje",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Dodaj proizvod ili uslugu",
        description: "Kreiraj artikl za fakturiranje",
        urgency: URGENCY_LEVELS.OPTIONAL,
        action: {
          type: ACTION_TYPES.LINK,
          href: "/products/new",
        },
        reference: ref,
      })
    }
  }

  // Issue #885: Bank import and bank account guidance
  const bankAccounts = await db.bankAccount.count({ where: { companyId } })
  const bankImports = await db.statementImport.count({ where: { companyId } })

  // First bank account guidance
  if (bankAccounts === 0) {
    const ref = "onboarding:first_bank_account"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_first_bank_account",
        category: "financije",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Dodaj bankovni račun",
        description: "Povežite bankovni račun za praćenje transakcija",
        urgency: URGENCY_LEVELS.OPTIONAL,
        action: {
          type: ACTION_TYPES.LINK,
          href: "/banking/accounts",
        },
        reference: ref,
      })
    }
  }

  // Bank import guidance (only if they have accounts but no imports)
  if (bankAccounts > 0 && bankImports === 0) {
    const ref = "onboarding:bank_import"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_bank_import",
        category: "financije",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Uvezi bankovne izvode",
        description: "Importirajte bankovne izvode za automatsko uparivanje transakcija",
        urgency: URGENCY_LEVELS.UPCOMING,
        action: {
          type: ACTION_TYPES.WIZARD,
          wizardId: "bank_import",
          href: "/banking/import",
        },
        reference: ref,
      })
    }
  }

  // Issue #885: First expense guidance
  const expenses = await db.expense.count({ where: { companyId } })
  if (expenses === 0) {
    const ref = "onboarding:first_expense"
    if (!excludeRefs.has(ref)) {
      items.push({
        id: "onboarding_first_expense",
        category: "financije",
        type: CHECKLIST_ITEM_TYPES.ONBOARDING,
        title: "Evidentiraj prvi trošak",
        description: "Dodajte prvi trošak za praćenje rashoda i kategorizaciju",
        urgency: URGENCY_LEVELS.OPTIONAL,
        action: {
          type: ACTION_TYPES.WIZARD,
          wizardId: "first_expense",
          href: "/expenses/new",
        },
        reference: ref,
      })
    }
  }

  return items
}

/**
 * Get seasonal/annual task items
 */
async function getSeasonalItems(
  companyId: string,
  businessType: string,
  excludeRefs: Set<string>
): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = []
  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  // PO-SD reminder in December/January (for paušalni)
  if (businessType === "pausalni" && (currentMonth === 12 || currentMonth === 1)) {
    const ref = `seasonal:posd:${currentYear}`
    if (!excludeRefs.has(ref)) {
      items.push({
        id: `seasonal_posd_${currentYear}`,
        category: "financije",
        type: CHECKLIST_ITEM_TYPES.SEASONAL,
        title: "Pripremi PO-SD obrazac",
        description:
          currentMonth === 12
            ? `Počni pripremati PO-SD za ${currentYear}. godinu`
            : `Rok za predaju PO-SD za ${currentYear - 1}. godinu je 31. siječnja`,
        dueDate: new Date(currentYear + (currentMonth === 12 ? 1 : 0), 0, 31),
        urgency:
          currentMonth === 1
            ? calculateUrgency(new Date(currentYear, 0, 31))
            : URGENCY_LEVELS.UPCOMING,
        action: {
          type: ACTION_TYPES.WIZARD,
          wizardId: "posd",
          href: "/pausalni/po-sd",
        },
        reference: ref,
      })
    }
  }

  return items
}

/**
 * Main function to aggregate all checklist items
 */
export async function getChecklist(params: GetChecklistParams): Promise<{
  items: ChecklistItem[]
  stats: {
    total: number
    completed: number
    critical: number
    soon: number
    upcoming: number
    optional: number
    byCategory: Record<GuidanceCategory, number>
  }
}> {
  const {
    userId,
    companyId,
    businessType = "all",
    includeCompleted = false,
    includeDismissed = false,
    limit = 20,
  } = params

  // Get excluded references based on user interactions
  const excludeActions: string[] = []
  if (!includeCompleted) excludeActions.push(CHECKLIST_ACTIONS.COMPLETED)
  if (!includeDismissed) excludeActions.push(CHECKLIST_ACTIONS.DISMISSED)

  // Fetch completed/dismissed refs and currently snoozed refs in parallel
  const [interactedRefs, snoozedRefs] = await Promise.all([
    excludeActions.length > 0
      ? getInteractedReferences(userId, companyId, excludeActions)
      : Promise.resolve(new Set<string>()),
    getSnoozedReferences(userId, companyId),
  ])

  // Merge both sets - exclude completed/dismissed AND currently snoozed items
  const excludeRefs = new Set([...interactedRefs, ...snoozedRefs])

  // Aggregate from all sources in parallel
  const [obligationItems, deadlineItems, actionItems, onboardingItems, seasonalItems] =
    await Promise.all([
      getObligationItems(companyId, excludeRefs),
      getDeadlineItems(businessType, excludeRefs),
      getPendingActionItems(companyId, excludeRefs),
      getOnboardingItems(companyId, excludeRefs),
      getSeasonalItems(companyId, businessType, excludeRefs),
    ])

  // Combine all items
  let allItems = [
    ...obligationItems,
    ...deadlineItems,
    ...actionItems,
    ...onboardingItems,
    ...seasonalItems,
  ]

  // Add smart suggestions from pattern detection
  try {
    const patterns = await getAllPatternInsights(companyId)

    for (const pattern of patterns) {
      // Generate stable reference based on pattern type and data
      // This allows proper tracking of dismissed/completed suggestions
      let reference: string
      if (pattern.type === "invoice_reminder") {
        // For invoice reminders: pattern-invoice_reminder-{buyerId}
        reference = `pattern-invoice_reminder-${pattern.data?.buyerId || "unknown"}`
      } else if (pattern.type === "expense_pattern") {
        // For expense patterns: pattern-expense_pattern-{categoryId}-{monthKey}
        const monthKey = pattern.data?.thisMonthAmount
          ? new Date().toISOString().slice(0, 7) // YYYY-MM format
          : "unknown"
        reference = `pattern-expense_pattern-${pattern.data?.categoryId || "unknown"}-${monthKey}`
      } else if (pattern.type === "revenue_trend") {
        // For revenue trends: pattern-revenue_trend-{direction}-{monthKey}
        const direction = (Number(pattern.data?.trend) || 0) > 0 ? "up" : "down"
        const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM format
        reference = `pattern-revenue_trend-${direction}-${monthKey}`
      } else {
        // Fallback for unknown pattern types
        reference = `pattern-${pattern.type}-unknown`
      }

      if (excludeRefs.has(reference)) continue

      allItems.push({
        id: reference,
        category: pattern.type === "invoice_reminder" ? "fakturiranje" : "financije",
        type: CHECKLIST_ITEM_TYPES.SUGGESTION,
        title: pattern.title,
        description: pattern.description,
        urgency: pattern.confidence >= 80 ? URGENCY_LEVELS.UPCOMING : URGENCY_LEVELS.OPTIONAL,
        action: pattern.suggestedAction
          ? {
              type: ACTION_TYPES.LINK,
              href: pattern.suggestedAction.href,
            }
          : {
              type: ACTION_TYPES.LINK,
              href: "/dashboard",
            },
        reference,
      })
    }
  } catch (error) {
    console.error("Failed to get pattern insights:", error)
  }

  // Sort by urgency (critical first), then by due date
  const urgencyOrder = {
    [URGENCY_LEVELS.CRITICAL]: 0,
    [URGENCY_LEVELS.SOON]: 1,
    [URGENCY_LEVELS.UPCOMING]: 2,
    [URGENCY_LEVELS.OPTIONAL]: 3,
  }

  allItems.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgencyDiff !== 0) return urgencyDiff

    // Sort by due date within same urgency
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime()
    }
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  // Get completed count from interactions table
  const completedCount = await getCompletedCount(userId, companyId)

  // Calculate stats before limiting
  // Note: 'total' represents total items including completed (remaining + completed)
  const stats = {
    total: allItems.length + completedCount,
    completed: completedCount,
    critical: allItems.filter((i) => i.urgency === URGENCY_LEVELS.CRITICAL).length,
    soon: allItems.filter((i) => i.urgency === URGENCY_LEVELS.SOON).length,
    upcoming: allItems.filter((i) => i.urgency === URGENCY_LEVELS.UPCOMING).length,
    optional: allItems.filter((i) => i.urgency === URGENCY_LEVELS.OPTIONAL).length,
    byCategory: {
      fakturiranje: allItems.filter((i) => i.category === "fakturiranje").length,
      financije: allItems.filter((i) => i.category === "financije").length,
      eu: allItems.filter((i) => i.category === "eu").length,
    },
  }

  // Apply limit
  if (limit > 0) {
    allItems = allItems.slice(0, limit)
  }

  return { items: allItems, stats }
}

/**
 * Mark a checklist item as completed
 */
export async function completeChecklistItem(
  userId: string,
  companyId: string,
  itemType: string,
  itemReference: string
) {
  await drizzleDb.insert(checklistInteractions).values({
    userId,
    companyId,
    itemType,
    itemReference,
    action: CHECKLIST_ACTIONS.COMPLETED,
  })
}

/**
 * Dismiss a checklist item
 */
export async function dismissChecklistItem(
  userId: string,
  companyId: string,
  itemType: string,
  itemReference: string
) {
  await drizzleDb.insert(checklistInteractions).values({
    userId,
    companyId,
    itemType,
    itemReference,
    action: CHECKLIST_ACTIONS.DISMISSED,
  })
}

/**
 * Snooze a checklist item until a specific date
 */
export async function snoozeChecklistItem(
  userId: string,
  companyId: string,
  itemType: string,
  itemReference: string,
  snoozeUntil: Date
) {
  await drizzleDb.insert(checklistInteractions).values({
    userId,
    companyId,
    itemType,
    itemReference,
    action: CHECKLIST_ACTIONS.SNOOZED,
    snoozedUntil: snoozeUntil,
  })
}
