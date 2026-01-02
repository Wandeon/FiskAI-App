/**
 * Period-Affecting Entities Registry
 *
 * AUTHORITATIVE LIST of all entities whose mutations must be blocked
 * when an accounting period is locked.
 *
 * Entity Type Classification:
 * - DIRECT: Has its own effective date field; checked directly
 * - DERIVED: Inherits effective date from parent entity; checked via parent
 *
 * @module period-locking
 * @since PHASE 1 - Enterprise Hardening
 */

import type { PeriodStatus } from "@prisma/client"

/**
 * Period statuses that block write operations.
 *
 * CLOSED: Period has been closed for regular operations
 * LOCKED: Period has been locked for auditing/compliance
 */
export const LOCKED_PERIOD_STATUSES: ReadonlySet<PeriodStatus> = new Set<PeriodStatus>([
  "CLOSED",
  "LOCKED",
])

/**
 * Period statuses that allow write operations.
 *
 * FUTURE: Period has not started yet
 * OPEN: Period is currently active
 * SOFT_CLOSE: Period is in soft-close (some operations allowed)
 */
export const WRITABLE_PERIOD_STATUSES: ReadonlySet<PeriodStatus> = new Set<PeriodStatus>([
  "FUTURE",
  "OPEN",
  "SOFT_CLOSE",
])

/**
 * Entity types for period lock enforcement.
 */
export type EntityType = "DIRECT" | "DERIVED"

/**
 * Date derivation strategy for derived entities.
 */
export type DateDerivationStrategy =
  | { type: "PARENT_FIELD"; parentModel: string; foreignKey: string; dateField: string }
  | { type: "SELF_FIELD"; field: string }

/**
 * Configuration for a period-affecting entity.
 */
export interface PeriodAffectingEntity {
  /**
   * Prisma model name (must match schema.prisma exactly).
   */
  readonly model: string

  /**
   * Prisma client accessor name (lowercase first letter).
   */
  readonly client: string

  /**
   * Entity type classification.
   */
  readonly entityType: EntityType

  /**
   * Field containing the effective date for period determination.
   * For DIRECT entities: field on this model
   * For DERIVED entities: resolved via parent lookup
   */
  readonly effectiveDateField: string

  /**
   * How to derive the effective date.
   */
  readonly dateDerivation: DateDerivationStrategy

  /**
   * Whether this entity requires period lock check on CREATE.
   */
  readonly checkOnCreate: boolean

  /**
   * Whether this entity requires period lock check on UPDATE.
   */
  readonly checkOnUpdate: boolean

  /**
   * Whether this entity requires period lock check on DELETE.
   */
  readonly checkOnDelete: boolean

  /**
   * Human-readable description for error messages.
   */
  readonly description: string
}

/**
 * AUTHORITATIVE REGISTRY of all period-affecting entities.
 *
 * This is the single source of truth for which entities are blocked
 * when an accounting period is locked.
 *
 * Categories:
 * 1. Invoicing: EInvoice, EInvoiceLine, RevenueRegisterEntry
 * 2. Expenses: Expense, ExpenseLine, UraInput
 * 3. Banking: BankTransaction, Transaction, Statement, MatchRecord
 * 4. Payroll: Payout, PayoutLine
 * 5. Assets: DepreciationEntry
 * 6. General Ledger: JournalEntry, JournalLine
 */
export const PERIOD_AFFECTING_ENTITIES: readonly PeriodAffectingEntity[] = [
  // ============================================
  // INVOICING DOMAIN
  // ============================================
  {
    model: "EInvoice",
    client: "eInvoice",
    entityType: "DIRECT",
    effectiveDateField: "issueDate",
    dateDerivation: { type: "SELF_FIELD", field: "issueDate" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Invoice (issue date)",
  },
  {
    model: "EInvoiceLine",
    client: "eInvoiceLine",
    entityType: "DERIVED",
    effectiveDateField: "issueDate",
    dateDerivation: {
      type: "PARENT_FIELD",
      parentModel: "EInvoice",
      foreignKey: "eInvoiceId",
      dateField: "issueDate",
    },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Invoice line (from parent invoice issue date)",
  },
  {
    model: "RevenueRegisterEntry",
    client: "revenueRegisterEntry",
    entityType: "DIRECT",
    effectiveDateField: "issueDate",
    dateDerivation: { type: "SELF_FIELD", field: "issueDate" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Revenue register entry (issue date)",
  },

  // ============================================
  // EXPENSES DOMAIN
  // ============================================
  {
    model: "Expense",
    client: "expense",
    entityType: "DIRECT",
    effectiveDateField: "date",
    dateDerivation: { type: "SELF_FIELD", field: "date" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Expense (date)",
  },
  {
    model: "ExpenseLine",
    client: "expenseLine",
    entityType: "DERIVED",
    effectiveDateField: "date",
    dateDerivation: {
      type: "PARENT_FIELD",
      parentModel: "Expense",
      foreignKey: "expenseId",
      dateField: "date",
    },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Expense line (from parent expense date)",
  },
  {
    model: "UraInput",
    client: "uraInput",
    entityType: "DIRECT",
    effectiveDateField: "date",
    dateDerivation: { type: "SELF_FIELD", field: "date" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "URA input record (date)",
  },

  // ============================================
  // BANKING DOMAIN
  // ============================================
  {
    model: "BankTransaction",
    client: "bankTransaction",
    entityType: "DIRECT",
    effectiveDateField: "date",
    dateDerivation: { type: "SELF_FIELD", field: "date" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Bank transaction (date)",
  },
  {
    model: "Transaction",
    client: "transaction",
    entityType: "DIRECT",
    effectiveDateField: "date",
    dateDerivation: { type: "SELF_FIELD", field: "date" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Statement transaction (date)",
  },
  {
    model: "Statement",
    client: "statement",
    entityType: "DIRECT",
    effectiveDateField: "statementDate",
    dateDerivation: { type: "SELF_FIELD", field: "statementDate" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Bank statement (statement date)",
  },
  {
    model: "MatchRecord",
    client: "matchRecord",
    entityType: "DERIVED",
    effectiveDateField: "date",
    dateDerivation: {
      type: "PARENT_FIELD",
      parentModel: "BankTransaction",
      foreignKey: "bankTransactionId",
      dateField: "date",
    },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Reconciliation match (from bank transaction date)",
  },

  // ============================================
  // PAYROLL DOMAIN
  // ============================================
  {
    model: "Payout",
    client: "payout",
    entityType: "DIRECT",
    effectiveDateField: "payoutDate",
    dateDerivation: { type: "SELF_FIELD", field: "payoutDate" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Payroll payout (payout date)",
  },
  {
    model: "PayoutLine",
    client: "payoutLine",
    entityType: "DERIVED",
    effectiveDateField: "payoutDate",
    dateDerivation: {
      type: "PARENT_FIELD",
      parentModel: "Payout",
      foreignKey: "payoutId",
      dateField: "payoutDate",
    },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Payout line (from parent payout date)",
  },

  // ============================================
  // ASSETS DOMAIN
  // ============================================
  {
    model: "DepreciationEntry",
    client: "depreciationEntry",
    entityType: "DIRECT",
    effectiveDateField: "periodEnd",
    dateDerivation: { type: "SELF_FIELD", field: "periodEnd" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Depreciation entry (period end date)",
  },

  // ============================================
  // GENERAL LEDGER DOMAIN
  // ============================================
  {
    model: "JournalEntry",
    client: "journalEntry",
    entityType: "DIRECT",
    effectiveDateField: "entryDate",
    dateDerivation: { type: "SELF_FIELD", field: "entryDate" },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Journal entry (entry date)",
  },
  {
    model: "JournalLine",
    client: "journalLine",
    entityType: "DERIVED",
    effectiveDateField: "entryDate",
    dateDerivation: {
      type: "PARENT_FIELD",
      parentModel: "JournalEntry",
      foreignKey: "journalEntryId",
      dateField: "entryDate",
    },
    checkOnCreate: true,
    checkOnUpdate: true,
    checkOnDelete: true,
    description: "Journal line (from parent entry date)",
  },
] as const

/**
 * Index by model name for O(1) lookup.
 */
export const PERIOD_AFFECTING_ENTITIES_BY_MODEL: ReadonlyMap<
  string,
  PeriodAffectingEntity
> = new Map(PERIOD_AFFECTING_ENTITIES.map((e) => [e.model, e]))

/**
 * Set of all model names for quick membership check.
 */
export const PERIOD_AFFECTING_MODEL_NAMES: ReadonlySet<string> = new Set(
  PERIOD_AFFECTING_ENTITIES.map((e) => e.model)
)

/**
 * Direct entities only (for primary enforcement).
 */
export const DIRECT_PERIOD_AFFECTING_ENTITIES: readonly PeriodAffectingEntity[] =
  PERIOD_AFFECTING_ENTITIES.filter((e) => e.entityType === "DIRECT")

/**
 * Derived entities only (for cascading enforcement).
 */
export const DERIVED_PERIOD_AFFECTING_ENTITIES: readonly PeriodAffectingEntity[] =
  PERIOD_AFFECTING_ENTITIES.filter((e) => e.entityType === "DERIVED")

/**
 * Get entity configuration by model name.
 *
 * @param model - Prisma model name
 * @returns Entity configuration or undefined if not period-affecting
 */
export function getEntityConfig(
  model: string
): PeriodAffectingEntity | undefined {
  return PERIOD_AFFECTING_ENTITIES_BY_MODEL.get(model)
}

/**
 * Check if a model is period-affecting.
 *
 * @param model - Prisma model name
 * @returns true if the model is subject to period lock enforcement
 */
export function isPeriodAffectingModel(model: string): boolean {
  return PERIOD_AFFECTING_MODEL_NAMES.has(model)
}

/**
 * Get all entities in a specific domain.
 *
 * @param domain - Domain name (invoicing, expenses, banking, payroll, assets, gl)
 * @returns Array of entities in that domain
 */
export function getEntitiesByDomain(
  domain: "invoicing" | "expenses" | "banking" | "payroll" | "assets" | "gl"
): readonly PeriodAffectingEntity[] {
  const domainModels: Record<string, string[]> = {
    invoicing: ["EInvoice", "EInvoiceLine", "RevenueRegisterEntry"],
    expenses: ["Expense", "ExpenseLine", "UraInput"],
    banking: ["BankTransaction", "Transaction", "Statement", "MatchRecord"],
    payroll: ["Payout", "PayoutLine"],
    assets: ["DepreciationEntry"],
    gl: ["JournalEntry", "JournalLine"],
  }

  const models = domainModels[domain] ?? []
  return PERIOD_AFFECTING_ENTITIES.filter((e) => models.includes(e.model))
}
