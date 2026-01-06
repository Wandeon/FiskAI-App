// src/app/(admin)/admin-control-center/page.tsx
/**
 * Admin Control Center
 *
 * Shows platform health and system queues.
 * No tenant data - only platform-level operations.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ControlCenterShell, QueueRenderer, type QueueItem } from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities/server"
import { ADMIN_QUEUES } from "./queues"

export const metadata = {
  title: "Admin Control Center | FiskAI",
}

async function getQueueItems(queue: (typeof ADMIN_QUEUES)[number]): Promise<QueueItem[]> {
  let entities: Array<{ id: string; title: string; status: string; timestamp: string }> = []

  switch (queue.entityType) {
    case "Alert": {
      // Platform alerts - would come from monitoring system
      // Placeholder for now
      entities = []
      break
    }
    case "RegulatoryConflict": {
      // RTL conflicts - placeholder for Phase 2
      // Will query regulatoryRule with NEEDS_REVIEW status
      entities = []
      break
    }
    case "NewsPost": {
      // Pending news posts - placeholder for Phase 2
      // Will query news_posts with pending status
      entities = []
      break
    }
    case "FailedJob": {
      // Would query job queue - placeholder
      entities = []
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

export default async function AdminControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Verify user is ADMIN
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })

  if (user?.systemRole !== "ADMIN") {
    redirect("/")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    ADMIN_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue),
    }))
  )

  return (
    <ControlCenterShell title="Platform Health" role="Admin">
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
