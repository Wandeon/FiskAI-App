// src/app/(app)/app-control-center/page.tsx
/**
 * Client Control Center
 *
 * Shows actionable queues for the client/company operator.
 * All data comes from capability resolution.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ControlCenterShell, QueueRenderer, type QueueItem } from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities/server"
import { CLIENT_QUEUES } from "./queues"

export const metadata = {
  title: "Control Center | FiskAI",
}

async function getQueueItems(queue: (typeof CLIENT_QUEUES)[number]): Promise<QueueItem[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      companies: {
        where: { isDefault: true },
        select: { companyId: true },
        take: 1,
      },
    },
  })

  // Fall back to first company if no default set
  const companyId = user?.companies[0]?.companyId
  if (!companyId) return []

  // Fetch entities based on queue type
  let entities: Array<{ id: string; title: string; status: string; timestamp: string }> = []

  switch (queue.entityType) {
    case "EInvoice": {
      const invoices = await db.eInvoice.findMany({
        where: {
          companyId,
          status:
            queue.id === "draft-invoices"
              ? "DRAFT"
              : queue.id === "pending-fiscalization"
                ? "PENDING_FISCALIZATION"
                : { in: ["FISCALIZED", "SENT"] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          createdAt: true,
          buyer: { select: { name: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      })
      entities = invoices.map((inv) => ({
        id: inv.id,
        title: `${inv.invoiceNumber} - ${inv.buyer?.name || "Unknown"}`,
        status: inv.status,
        timestamp: inv.createdAt.toISOString(),
      }))
      break
    }
    case "BankTransaction": {
      const transactions = await db.bankTransaction.findMany({
        where: {
          bankAccount: { companyId },
          matchStatus: "UNMATCHED",
        },
        select: {
          id: true,
          description: true,
          matchStatus: true,
          date: true,
          amount: true,
        },
        take: 10,
        orderBy: { date: "desc" },
      })
      entities = transactions.map((tx) => ({
        id: tx.id,
        title: `${tx.description || "Transaction"} (${tx.amount})`,
        status: tx.matchStatus,
        timestamp: tx.date.toISOString(),
      }))
      break
    }
    case "Expense": {
      const expenses = await db.expense.findMany({
        where: {
          companyId,
          status: { in: ["DRAFT", "PENDING"] },
        },
        select: {
          id: true,
          description: true,
          status: true,
          date: true,
          vendor: { select: { name: true } },
        },
        take: 10,
        orderBy: { date: "desc" },
      })
      entities = expenses.map((exp) => ({
        id: exp.id,
        title: exp.description || exp.vendor?.name || "Expense",
        status: exp.status,
        timestamp: exp.date.toISOString(),
      }))
      break
    }
  }

  // Resolve capabilities for each entity
  const items: QueueItem[] = await Promise.all(
    entities.map(async (entity) => {
      const capabilities = await resolveCapabilitiesForUser(queue.capabilityIds, {
        entityId: entity.id,
        entityType: queue.entityType,
      })
      return {
        id: entity.id,
        type: queue.entityType,
        title: entity.title,
        status: entity.status,
        timestamp: entity.timestamp,
        capabilities,
      }
    })
  )

  return items
}

export default async function ClientControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    CLIENT_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue),
    }))
  )

  return (
    <ControlCenterShell title="What Needs Attention" role="Client">
      {queueData.map(({ queue, items }) => (
        <QueueRenderer
          key={queue.id}
          queue={queue}
          items={items}
          emptyMessage={`No ${queue.name.toLowerCase()}`}
        />
      ))}
    </ControlCenterShell>
  )
}
