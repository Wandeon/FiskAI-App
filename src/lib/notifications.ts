import { db, setTenantContext, getTenantContext } from "@/lib/db"
import type { NotificationItem, NotificationType } from "@/types/notifications"
import type { AuditAction, Company } from "@prisma/client"
import { SupportTicketStatus } from "@prisma/client"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
import { getChecklist } from "@/lib/guidance/checklist"

type NotificationCenterContext = {
  userId: string
  company: Pick<Company, "id" | "name" | "eInvoiceProvider">
}

export type NotificationFeed = {
  items: NotificationItem[]
  latestEventAt: Date | null
}

const STATUS_LABELS: Record<string, string> = {
  FISCALIZED: "Račun fiskaliziran",
  DELIVERED: "Račun dostavljen",
  ACCEPTED: "Kupac je prihvatio račun",
  SENT: "Račun poslan prema kupcu",
  ERROR: "Greška kod slanja",
  REJECTED: "Kupac odbio račun",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
}

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  // Core CRUD operations
  CREATE: "Kreirano",
  UPDATE: "Ažurirano",
  DELETE: "Obrisano",
  VIEW: "Pregledano",
  EXPORT: "Izvezeno",
  LOGIN: "Prijava",
  LOGOUT: "Odjava",

  // Regulatory Truth Layer - Evidence
  EVIDENCE_FETCHED: "Dokaz dohvaćen",
  EVIDENCE_HASH_REPAIRED: "Hash dokaza popravljen",

  // Regulatory Truth Layer - Rules
  RULE_CREATED: "Pravilo kreirano",
  RULE_APPROVED: "Pravilo odobreno",
  RULE_PUBLISHED: "Pravilo objavljeno",
  RULE_AUTO_PUBLISHED: "Pravilo automatski objavljeno",
  RULE_REJECTED: "Pravilo odbijeno",
  RULE_REJECTED_TEST_DATA: "Pravilo odbijeno (test podaci)",
  RULE_DELETED: "Pravilo obrisano",
  RULE_MERGED: "Pravilo spojeno",
  RULE_ROLLBACK: "Pravilo vraćeno",
  RULE_QUEUED_FOR_REVIEW: "Pravilo u redu za pregled",
  RULE_CONCEPT_LINKED: "Pravilo povezano s konceptom",
  MERGE_RULES: "Pravila spojena",

  // Regulatory Truth Layer - Concepts
  CONCEPT_CREATED: "Koncept kreiran",
  CONCEPT_MERGED: "Koncept spojen",
  CONFIDENCE_DECAY_APPLIED: "Primjenjen pad pouzdanosti",

  // Regulatory Truth Layer - Conflicts
  CONFLICT_CREATED: "Konflikt kreiran",
  CONFLICT_RESOLVED: "Konflikt riješen",
  CONFLICT_ESCALATED: "Konflikt eskaliran",

  // Regulatory Truth Layer - Releases
  RELEASE_PUBLISHED: "Izdanje objavljeno",
  RELEASE_ROLLED_BACK: "Izdanje vraćeno",
  RELEASE_HASH_REPAIRED: "Hash izdanja popravljen",

  // Regulatory Truth Layer - Status Transitions & Pipeline
  RULE_STATUS_CHANGED: "Status pravila promijenjen",
  PIPELINE_STAGE_COMPLETE: "Faza cjevovoda završena",
}

const ENTITY_LABELS: Record<string, string> = {
  EInvoice: "E-račun",
  Contact: "Kontakt",
  Product: "Proizvod",
  Company: "Tvrtka",
  BankAccount: "Bankovni račun",
}

export async function getNotificationCenterFeed({
  userId,
  company,
}: NotificationCenterContext): Promise<NotificationFeed> {
  if (!userId || !company?.id) {
    return { items: [], latestEventAt: null }
  }

  const previousContext = getTenantContext()
  setTenantContext({ companyId: company.id, userId })

  try {
    const [
      draftCount,
      pendingFiscalizationCount,
      errorInvoiceCount,
      overdueInvoiceCount,
      recentInvoices,
      recentActivity,
      openTicketCount,
      recentTickets,
      staleTicketCount,
      unassignedTicketCount,
      overdueExpenseCount,
      upcomingDeadlines,
      checklistItems,
    ] = await Promise.all([
      db.eInvoice.count({
        where: { companyId: company.id, status: "DRAFT" },
      }),
      db.eInvoice.count({
        where: { companyId: company.id, status: "PENDING_FISCALIZATION" },
      }),
      db.eInvoice.count({
        where: {
          companyId: company.id,
          status: { in: ["ERROR", "REJECTED"] },
        },
      }),
      db.eInvoice.count({
        where: {
          companyId: company.id,
          paidAt: null,
          dueDate: { lt: new Date() },
          status: { notIn: ["DRAFT", "ARCHIVED"] },
        },
      }),
      db.eInvoice.findMany({
        where: {
          companyId: company.id,
          status: {
            in: ["FISCALIZED", "DELIVERED", "ACCEPTED", "SENT", "REJECTED", "ERROR"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          updatedAt: true,
          buyer: { select: { name: true } },
        },
      }),
      db.auditLog.findMany({
        where: { companyId: company.id },
        orderBy: { timestamp: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          timestamp: true,
          changes: true,
        },
      }),
      db.supportTicket.count({
        where: {
          companyId: company.id,
          status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
        },
      }),
      db.supportTicket.findMany({
        where: {
          companyId: company.id,
          status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
        },
      }),
      db.supportTicket.count({
        where: {
          companyId: company.id,
          status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
          updatedAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 48) },
        },
      }),
      db.supportTicket.count({
        where: {
          companyId: company.id,
          status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
          assignedToId: null,
        },
      }),
      db.expense.count({
        where: {
          companyId: company.id,
          status: { not: "PAID" },
          date: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
        },
      }),
      getUpcomingDeadlines(14, undefined, 5), // Next 14 days deadlines
      getChecklist({ userId, companyId: company.id, limit: 5 }),
    ])

    const alerts: NotificationItem[] = []
    const nowLabel = "upravo ažurirano"

    if (!company.eInvoiceProvider) {
      alerts.push({
        id: "provider-missing",
        type: "warning",
        title: "Povežite posrednika za e-račune",
        description: `Tvrtka ${company.name} još nije povezana s državnim posrednikom.`,
        timestamp: nowLabel,
        action: { label: "Postavke", href: "/settings" },
      })
    }

    if (errorInvoiceCount > 0) {
      alerts.push({
        id: "invoice-errors",
        type: "warning",
        title: `${errorInvoiceCount} rač. ima grešku`,
        description: "Provjerite odbijene ili vraćene e-račune",
        timestamp: nowLabel,
        action: { label: "Pregledaj", href: "/e-invoices?status=ERROR" },
      })
    }

    if (pendingFiscalizationCount > 0) {
      alerts.push({
        id: "pending-fiscalization",
        type: "info",
        title: `${pendingFiscalizationCount} rač. čeka fiskalizaciju`,
        description: "Dovršite fiskalizaciju kako bi računi bili valjani",
        timestamp: nowLabel,
        action: { label: "Otvorite listu", href: "/e-invoices?status=PENDING_FISCALIZATION" },
      })
    }

    if (draftCount > 0) {
      alerts.push({
        id: "draft-invoices",
        type: "info",
        title: `${draftCount} nacrta spremno za slanje`,
        description: "Dovršite nacrte i pošaljite kupcima",
        timestamp: nowLabel,
        action: { label: "Nacrti", href: "/e-invoices?status=DRAFT" },
      })
    }

    if (overdueInvoiceCount > 0) {
      alerts.push({
        id: "overdue-invoices",
        type: "warning",
        title: `${overdueInvoiceCount} rač. je dospjelo`,
        description: "Provjerite plaćanje i pošaljite podsjetnik",
        timestamp: nowLabel,
        action: { label: "Pregledaj", href: "/e-invoices?status=SENT" },
      })
    }

    if (openTicketCount > 0) {
      alerts.push({
        id: "open-tickets",
        type: "info",
        title: `${openTicketCount} ticket${openTicketCount === 1 ? "" : "a"} čeka odgovor`,
        description: "Komunikacija s klijentima ostaje u aplikaciji",
        timestamp: nowLabel,
        action: { label: "Ticket centar", href: "/support" },
      })
    }

    if (unassignedTicketCount > 0) {
      alerts.push({
        id: "unassigned-tickets",
        type: "warning",
        title: `${unassignedTicketCount} ticket${unassignedTicketCount === 1 ? "" : "a"} bez dodjele`,
        description: "Dodijelite računovođi kako bi se obradio",
        timestamp: nowLabel,
        action: { label: "Dodijeli", href: "/support" },
      })
    }

    if (staleTicketCount > 0) {
      alerts.push({
        id: "stale-tickets",
        type: "warning",
        title: `${staleTicketCount} ticket${staleTicketCount === 1 ? "" : "a"} čeka >48h`,
        description: "Odgovorite ili promijenite status",
        timestamp: nowLabel,
        action: { label: "Ticket centar", href: "/support" },
      })
    }

    if (overdueExpenseCount > 0) {
      alerts.push({
        id: "overdue-expenses",
        type: "warning",
        title: `${overdueExpenseCount} trošak${overdueExpenseCount === 1 ? "" : "a"} starije od 30d`,
        description: "Ažurirajte status plaćanja ili dodajte dokaz",
        timestamp: nowLabel,
        action: { label: "Troškovi", href: "/expenses" },
      })
    }

    // Deadline notifications
    const deadlineAlerts: NotificationItem[] = upcomingDeadlines
      .filter((d) => {
        const daysLeft = Math.ceil(
          (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return daysLeft <= 7 // Only show deadlines within 7 days
      })
      .map((deadline) => {
        const daysLeft = Math.ceil(
          (new Date(deadline.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        const isUrgent = daysLeft <= 3

        return {
          id: `deadline-${deadline.id}`,
          type: isUrgent ? ("warning" as NotificationType) : ("info" as NotificationType),
          title: deadline.title,
          description:
            daysLeft <= 0
              ? "Rok je prošao!"
              : daysLeft === 1
                ? "Rok je sutra!"
                : `Rok za ${daysLeft} dana`,
          timestamp: new Date(deadline.deadlineDate).toLocaleDateString("hr-HR"),
          action: { label: "Kalendar", href: "/alati/kalendar" },
        }
      })

    // Add checklist deadlines to notifications
    const checklistAlerts: NotificationItem[] = []
    try {
      const urgentItems = (checklistItems?.items || []).filter(
        (item) =>
          !(item as any).completedAt &&
          !(item as any).dismissedAt &&
          (item.urgency === "critical" || item.urgency === "soon")
      )

      for (const item of urgentItems.slice(0, 3)) {
        const isOverdue = item.urgency === "critical"
        checklistAlerts.push({
          id: `checklist-${item.id}`,
          type: isOverdue ? "warning" : "info",
          title: item.title,
          description: item.description,
          timestamp: item.dueDate ? formatRelativeDate(new Date(item.dueDate)) : undefined,
          action: item.action?.href
            ? { label: "Otvori", href: item.action.href }
            : { label: "Pogledaj", href: "/checklist" },
        })
      }
    } catch (error) {
      console.error("Failed to fetch checklist for notifications:", error)
    }

    const invoiceNotifications: NotificationItem[] = recentInvoices.map((invoice) => {
      const amount = Number(invoice.totalAmount || 0)
      return {
        id: `invoice-${invoice.id}`,
        type: statusToNotificationType(invoice.status),
        title: STATUS_LABELS[invoice.status] || invoice.status,
        description: [
          invoice.invoiceNumber || "Bez broja",
          invoice.buyer?.name,
          `${amount.toLocaleString("hr-HR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} €`,
        ]
          .filter(Boolean)
          .join(" · "),
        timestamp: formatRelativeTime(invoice.updatedAt),
        rawTimestamp: invoice.updatedAt.toISOString(),
        action: { label: "Otvori račun", href: `/e-invoices/${invoice.id}` },
      }
    })

    const activityNotifications = recentActivity.map((entry) => {
      const entityLabel = ENTITY_LABELS[entry.entity] || entry.entity
      const targetName = extractEntityName(entry.changes) || entry.entityId
      const actionLabel = AUDIT_ACTION_LABELS[entry.action] || entry.action

      return {
        id: `activity-${entry.id}`,
        type: (entry.action === "DELETE" ? "warning" : "info") as NotificationType,
        title: `${actionLabel} – ${entityLabel}`,
        description: targetName,
        timestamp: formatRelativeTime(entry.timestamp),
        rawTimestamp: entry.timestamp.toISOString(),
        action: { label: "Audit log", href: "/settings/audit-log" },
      }
    })

    const ticketNotifications: NotificationItem[] = recentTickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      type: "info",
      title: `Ticket: ${ticket.title}`,
      description: `${ticket.status === "OPEN" ? "Otvoreno" : "U radu"} · ${ticket.priority.toLowerCase()}`,
      timestamp: formatRelativeTime(ticket.updatedAt),
      rawTimestamp: ticket.updatedAt.toISOString(),
      action: { label: "Otvori ticket", href: `/support/${ticket.id}` },
    }))

    const items = [
      ...deadlineAlerts, // Add deadline alerts first (high priority)
      ...checklistAlerts, // Add checklist alerts (high priority)
      ...alerts,
      ...ticketNotifications,
      ...invoiceNotifications,
      ...activityNotifications,
    ].slice(0, 15) // Increase limit to accommodate deadlines
    const latestEventAt = items.reduce<Date | null>((latest, item) => {
      if (!item.rawTimestamp) return latest
      const ts = new Date(item.rawTimestamp)
      if (!latest || ts > latest) return ts
      return latest
    }, null)

    return { items, latestEventAt }
  } finally {
    setTenantContext(previousContext)
  }
}

export async function getNotificationCenterItems(context: NotificationCenterContext) {
  const feed = await getNotificationCenterFeed(context)
  return feed.items
}

export function countUnreadNotifications(
  items: NotificationItem[],
  lastSeen: Date | null | undefined
) {
  if (!lastSeen) {
    return items.filter((item) => Boolean(item.rawTimestamp)).length
  }

  const lastSeenTime = lastSeen.getTime()
  return items.filter((item) => {
    if (!item.rawTimestamp) return false
    const ts = new Date(item.rawTimestamp).getTime()
    return ts > lastSeenTime
  }).length
}

function statusToNotificationType(status: string): NotificationType {
  if (status === "FISCALIZED" || status === "DELIVERED" || status === "ACCEPTED") {
    return "success"
  }
  if (status === "ERROR" || status === "REJECTED") {
    return "warning"
  }
  return "info"
}

function formatRelativeTime(date: Date) {
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  if (diff < minute) {
    return "prije nekoliko sekundi"
  }
  const minutes = Math.floor(diff / minute)
  if (minutes < 60) {
    return `prije ${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `prije ${hours} h`
  }
  const days = Math.floor(hours / 24)
  return `prije ${days} d`
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} dana kasni`
  if (diffDays === 0) return "Danas"
  if (diffDays === 1) return "Sutra"
  return `Za ${diffDays} dana`
}

function extractEntityName(changes: unknown): string | undefined {
  if (!changes || typeof changes !== "object") return undefined
  const payload = changes as Record<string, unknown>
  const after = isRecord(payload.after) ? payload.after : undefined
  const before = isRecord(payload.before) ? payload.before : undefined

  const candidates = [
    after?.name,
    before?.name,
    after?.invoiceNumber,
    before?.invoiceNumber,
    after?.iban,
    before?.iban,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate
    }
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
