// src/app/(app)/cc/queues.ts
/**
 * Client Control Center Queue Definitions
 *
 * Defines the queues shown to clients based on UX_CAPABILITY_BLUEPRINT.md
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const CLIENT_QUEUES: QueueDefinition[] = [
  {
    id: "draft-invoices",
    name: "Draft Invoices",
    description: "Invoices ready to issue or delete",
    capabilityIds: ["INV-002", "INV-003", "INV-004"],
    entityType: "EInvoice",
  },
  {
    id: "pending-fiscalization",
    name: "Pending Fiscalization",
    description: "Invoices awaiting fiscalization (48h deadline)",
    capabilityIds: ["INV-005"],
    entityType: "EInvoice",
  },
  {
    id: "unmatched-transactions",
    name: "Unmatched Transactions",
    description: "Bank transactions needing attention",
    capabilityIds: ["BNK-005", "BNK-007"],
    entityType: "BankTransaction",
  },
  {
    id: "unpaid-invoices",
    name: "Unpaid Invoices",
    description: "Invoices awaiting payment",
    capabilityIds: ["INV-008"],
    entityType: "EInvoice",
  },
  {
    id: "unpaid-expenses",
    name: "Unpaid Expenses",
    description: "Expenses awaiting payment",
    capabilityIds: ["EXP-004"],
    entityType: "Expense",
  },
]
