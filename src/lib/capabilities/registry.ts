/**
 * Capability Registry
 *
 * Authoritative list of all capabilities in the system.
 * Each capability has metadata for resolution.
 *
 * @module capabilities
 * @since Enterprise Hardening - Capability Resolution API
 */

import type { CapabilityMetadata } from "./types"

/**
 * All registered capabilities.
 */
export const CAPABILITY_REGISTRY: readonly CapabilityMetadata[] = [
  // ============================================
  // INVOICING DOMAIN
  // ============================================
  {
    id: "INV-001",
    name: "Create Invoice",
    description: "Create a new sales invoice",
    domain: "invoicing",
    requiredInputs: ["buyerId", "issueDate", "lines"],
    optionalInputs: ["dueDate", "notes", "paymentTerms"],
    requiredPermissions: ["invoicing:write"],
    affectedEntities: ["EInvoice", "EInvoiceLine"],
  },
  {
    id: "INV-002",
    name: "Send Invoice",
    description: "Send invoice to customer via email or e-invoicing",
    domain: "invoicing",
    requiredInputs: ["invoiceId"],
    optionalInputs: ["deliveryMethod"],
    requiredPermissions: ["invoicing:write"],
    affectedEntities: ["EInvoice"],
  },
  {
    id: "INV-003",
    name: "Fiscalize Invoice",
    description: "Submit invoice to tax authority for fiscalization",
    domain: "invoicing",
    requiredInputs: ["invoiceId"],
    optionalInputs: [],
    requiredPermissions: ["fiscalization:write"],
    affectedEntities: ["EInvoice", "FiscalRequest"],
  },
  {
    id: "INV-004",
    name: "Issue Credit Note",
    description: "Create a credit note for an existing invoice",
    domain: "invoicing",
    requiredInputs: ["originalInvoiceId", "reason"],
    optionalInputs: ["partialAmount", "lines"],
    requiredPermissions: ["invoicing:write"],
    affectedEntities: ["EInvoice", "EInvoiceLine"],
  },
  {
    id: "INV-005",
    name: "Record Payment",
    description: "Mark invoice as paid",
    domain: "invoicing",
    requiredInputs: ["invoiceId", "paymentDate"],
    optionalInputs: ["paymentMethod", "bankTransactionId"],
    requiredPermissions: ["invoicing:write"],
    affectedEntities: ["EInvoice"],
  },

  // ============================================
  // EXPENSES DOMAIN
  // ============================================
  {
    id: "EXP-001",
    name: "Record Expense",
    description: "Record a business expense",
    domain: "expenses",
    requiredInputs: ["date", "categoryId", "amount"],
    optionalInputs: ["vendorId", "description", "receipt"],
    requiredPermissions: ["expenses:write"],
    affectedEntities: ["Expense", "ExpenseLine"],
  },
  {
    id: "EXP-002",
    name: "Approve Expense",
    description: "Approve an expense for payment",
    domain: "expenses",
    requiredInputs: ["expenseId"],
    optionalInputs: ["notes"],
    requiredPermissions: ["expenses:approve"],
    affectedEntities: ["Expense"],
  },
  {
    id: "EXP-003",
    name: "Correct Expense",
    description: "Create a correction for an existing expense",
    domain: "expenses",
    requiredInputs: ["expenseId", "correctionReason"],
    optionalInputs: ["newAmount", "newCategory"],
    requiredPermissions: ["expenses:write"],
    affectedEntities: ["Expense", "ExpenseCorrection"],
  },

  // ============================================
  // BANKING DOMAIN
  // ============================================
  {
    id: "BNK-001",
    name: "Import Bank Statement",
    description: "Import bank transactions from statement file",
    domain: "banking",
    requiredInputs: ["bankAccountId", "statementFile"],
    optionalInputs: [],
    requiredPermissions: ["banking:write"],
    affectedEntities: ["Statement", "BankTransaction"],
  },
  {
    id: "BNK-002",
    name: "Match Transaction",
    description: "Match a bank transaction to an invoice or expense",
    domain: "banking",
    requiredInputs: ["transactionId"],
    optionalInputs: ["invoiceId", "expenseId"],
    requiredPermissions: ["banking:write", "reconciliation:write"],
    affectedEntities: ["BankTransaction", "MatchRecord"],
  },
  {
    id: "BNK-003",
    name: "Reconcile Account",
    description: "Mark account as reconciled for a period",
    domain: "banking",
    requiredInputs: ["bankAccountId", "statementDate", "statementBalance"],
    optionalInputs: [],
    requiredPermissions: ["reconciliation:write"],
    affectedEntities: ["BankTransaction"],
  },

  // ============================================
  // PAYROLL DOMAIN
  // ============================================
  {
    id: "PAY-001",
    name: "Create Payout",
    description: "Create a new payroll payout batch",
    domain: "payroll",
    requiredInputs: ["periodMonth", "periodYear"],
    optionalInputs: ["employees"],
    requiredPermissions: ["payroll:write"],
    affectedEntities: ["Payout", "PayoutLine"],
  },
  {
    id: "PAY-002",
    name: "Calculate Payout",
    description: "Calculate payout amounts for employees",
    domain: "payroll",
    requiredInputs: ["payoutId"],
    optionalInputs: [],
    requiredPermissions: ["payroll:write"],
    affectedEntities: ["Payout", "PayoutLine"],
  },
  {
    id: "PAY-003",
    name: "Lock Payout",
    description: "Lock payout for reporting",
    domain: "payroll",
    requiredInputs: ["payoutId"],
    optionalInputs: [],
    requiredPermissions: ["payroll:approve"],
    affectedEntities: ["Payout"],
  },

  // ============================================
  // ASSETS DOMAIN
  // ============================================
  {
    id: "AST-001",
    name: "Register Asset",
    description: "Register a new fixed asset",
    domain: "assets",
    requiredInputs: ["name", "acquisitionDate", "acquisitionCost", "category"],
    optionalInputs: ["usefulLife", "residualValue"],
    requiredPermissions: ["assets:write"],
    affectedEntities: ["FixedAsset"],
  },
  {
    id: "AST-002",
    name: "Post Depreciation",
    description: "Post depreciation entries for a period",
    domain: "assets",
    requiredInputs: ["periodEnd"],
    optionalInputs: ["assetIds"],
    requiredPermissions: ["assets:write", "gl:write"],
    affectedEntities: ["DepreciationEntry", "JournalEntry"],
  },
  {
    id: "AST-003",
    name: "Dispose Asset",
    description: "Record asset disposal",
    domain: "assets",
    requiredInputs: ["assetId", "disposalDate"],
    optionalInputs: ["proceeds", "notes"],
    requiredPermissions: ["assets:write"],
    affectedEntities: ["FixedAsset", "DisposalEvent"],
  },

  // ============================================
  // GENERAL LEDGER DOMAIN
  // ============================================
  {
    id: "GL-001",
    name: "Create Journal Entry",
    description: "Create a manual journal entry",
    domain: "system",
    requiredInputs: ["entryDate", "description", "lines"],
    optionalInputs: ["reference"],
    requiredPermissions: ["gl:write"],
    affectedEntities: ["JournalEntry", "JournalLine"],
  },
  {
    id: "GL-002",
    name: "Post Journal Entry",
    description: "Post a draft journal entry to the ledger",
    domain: "system",
    requiredInputs: ["journalEntryId"],
    optionalInputs: [],
    requiredPermissions: ["gl:write"],
    affectedEntities: ["JournalEntry"],
  },
  {
    id: "GL-003",
    name: "Close Period",
    description: "Close an accounting period",
    domain: "system",
    requiredInputs: ["periodId"],
    optionalInputs: ["reason"],
    requiredPermissions: ["admin:periods"],
    affectedEntities: ["AccountingPeriod"],
  },
  {
    id: "GL-004",
    name: "Lock Period",
    description: "Lock an accounting period (prevents all modifications)",
    domain: "system",
    requiredInputs: ["periodId", "reason"],
    optionalInputs: [],
    requiredPermissions: ["admin:periods"],
    affectedEntities: ["AccountingPeriod"],
  },
] as const

/**
 * Index by capability ID for O(1) lookup.
 */
export const CAPABILITY_BY_ID: ReadonlyMap<string, CapabilityMetadata> = new Map(
  CAPABILITY_REGISTRY.map((c) => [c.id, c])
)

/**
 * Get capability metadata by ID.
 */
export function getCapabilityMetadata(id: string): CapabilityMetadata | undefined {
  return CAPABILITY_BY_ID.get(id)
}

/**
 * Get all capabilities for a domain.
 */
export function getCapabilitiesByDomain(
  domain: CapabilityMetadata["domain"]
): readonly CapabilityMetadata[] {
  return CAPABILITY_REGISTRY.filter((c) => c.domain === domain)
}

/**
 * Get all capabilities that affect a given entity type.
 */
export function getCapabilitiesAffectingEntity(
  entityType: string
): readonly CapabilityMetadata[] {
  return CAPABILITY_REGISTRY.filter((c) => c.affectedEntities.includes(entityType))
}
