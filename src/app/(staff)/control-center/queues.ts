// src/app/(staff)/control-center/queues.ts
/**
 * Accountant Control Center Queue Definitions
 *
 * Based on UX_CAPABILITY_BLUEPRINT.md section 4.2
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const ACCOUNTANT_QUEUES: QueueDefinition[] = [
  {
    id: "clients-pending-review",
    name: "Clients Pending Review",
    description: "Clients requiring review and sign-off",
    capabilityIds: ["STF-002", "STF-004"],
    entityType: "Company",
  },
  {
    id: "period-lock-requests",
    name: "Period Lock Requests",
    description: "Period close requests from clients",
    capabilityIds: ["PER-002", "PER-003"],
    entityType: "AccountingPeriod",
  },
  {
    id: "pending-invitations",
    name: "Pending Invitations",
    description: "Client invitations awaiting response",
    capabilityIds: ["STF-003"],
    entityType: "Invitation",
  },
]
