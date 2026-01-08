// src/app/(admin)/admin-control-center/queues.ts
/**
 * Admin Control Center Queue Definitions
 *
 * Based on UX_CAPABILITY_BLUEPRINT.md section 4.3
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const ADMIN_QUEUES: QueueDefinition[] = [
  {
    id: "system-alerts",
    name: "System Alerts",
    description: "Platform alerts requiring investigation",
    capabilityIds: ["ADM-007"],
    entityType: "Alert",
  },
  {
    id: "rtl-conflicts",
    name: "RTL Conflicts",
    description: "Regulatory rule conflicts to resolve",
    capabilityIds: ["ADM-006", "ADM-007"],
    entityType: "RegulatoryConflict",
  },
  {
    id: "pending-news",
    name: "Pending News",
    description: "News items awaiting review and publish",
    capabilityIds: ["ADM-008"],
    entityType: "NewsPost",
  },
  {
    id: "failed-jobs",
    name: "Failed Jobs",
    description: "Background jobs in dead letter queue",
    capabilityIds: ["ADM-007"],
    entityType: "FailedJob",
  },
]
