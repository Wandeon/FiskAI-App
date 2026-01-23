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
    name: "Nacrti računa",
    description: "Računi spremni za izdavanje ili brisanje",
    capabilityIds: ["INV-002", "INV-003", "INV-004"],
    entityType: "EInvoice",
  },
  {
    id: "pending-fiscalization",
    name: "Čekaju fiskalizaciju",
    description: "Računi koji čekaju fiskalizaciju (rok 48h)",
    capabilityIds: ["INV-005"],
    entityType: "EInvoice",
  },
  {
    id: "unmatched-transactions",
    name: "Neuparene transakcije",
    description: "Bankovne transakcije koje treba obraditi",
    capabilityIds: ["BNK-005", "BNK-007"],
    entityType: "BankTransaction",
  },
  {
    id: "unpaid-invoices",
    name: "Neplaćeni računi",
    description: "Računi koji čekaju uplatu",
    capabilityIds: ["INV-008"],
    entityType: "EInvoice",
  },
  {
    id: "unpaid-expenses",
    name: "Neplaćeni troškovi",
    description: "Troškovi koji čekaju plaćanje",
    capabilityIds: ["EXP-004"],
    entityType: "Expense",
  },
]
