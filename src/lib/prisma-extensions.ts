// src/lib/prisma-extensions.ts
import { PrismaClient, AuditAction, Prisma, PeriodStatus } from "@prisma/client"
import { AsyncLocalStorage } from "node:async_hooks"
import { getAuditContext } from "./audit-context"
import { computeAuditChecksum } from "./audit-utils"

// Context for current request
export type TenantContext = {
  companyId: string
  userId: string
}

// AsyncLocalStorage for request-scoped tenant context (thread-safe)
const tenantContextStore = new AsyncLocalStorage<TenantContext>()

// ============================================
// REGULATORY STATUS TRANSITION CONTEXT
// ============================================
// Context for regulatory status transitions.
// Stored in AsyncLocalStorage so Prisma extensions can enforce transition rules
// without threading extra params through every call.
//
// POLICY ENFORCEMENT:
// - `autoApprove`: Must pass allowlist check in rule-status-service.ts
// - `systemAction`: Explicit downgrade actions (quarantine, etc.)
// - Normal transitions follow ALLOWED_STATUS_TRANSITIONS map
//
// CRITICAL: bypassApproval is DEPRECATED. Use systemAction instead.
// bypassApproval only allows DOWNGRADES, never approve/publish.

/** System actions that allow specific non-standard transitions */
export type RegulatorySystemAction =
  | "QUARANTINE_DOWNGRADE" // APPROVED/PUBLISHED → PENDING_REVIEW
  | "ROLLBACK" // PUBLISHED → APPROVED

export type RegulatoryTransitionContext = {
  /** Audit trail: who/what is performing this action */
  source?: string
  /** User ID for audit trail (if human-initiated) */
  actorUserId?: string
  /**
   * DEPRECATED: Use systemAction instead.
   * Only allows downgrades (→ PENDING_REVIEW) and rollbacks.
   * NEVER allows approve or publish.
   */
  bypassApproval?: boolean
  /**
   * Request auto-approval via pipeline.
   * Requires passing allowlist check in rule-status-service.ts.
   * Does NOT bypass provenance validation.
   */
  autoApprove?: boolean
  /**
   * Explicit system action for non-standard transitions.
   * More restrictive than bypassApproval - only allows specific transitions.
   */
  systemAction?: RegulatorySystemAction
}

const regulatoryContextStore = new AsyncLocalStorage<RegulatoryTransitionContext>()

/** Get current regulatory transition context (if any). */
export function getRegulatoryContext(): RegulatoryTransitionContext | null {
  return regulatoryContextStore.getStore() ?? null
}

/** Run a function within a regulatory transition context. */
export function runWithRegulatoryContext<T>(context: RegulatoryTransitionContext, fn: () => T): T {
  return regulatoryContextStore.run(context, fn)
}

/**
 * Sets the tenant context for the current async context.
 * IMPORTANT: For proper isolation, prefer using `runWithTenant()` which
 * wraps your code in an AsyncLocalStorage context.
 *
 * When called outside of `runWithTenant()`, this will NOT set context
 * (as there's no AsyncLocalStorage store to update).
 */
export function setTenantContext(context: TenantContext | null) {
  // Note: This function now requires being inside runWithTenant()
  // The context is automatically set by runWithTenant, but this function
  // exists for backward compatibility during migration
  const store = tenantContextStore.getStore()
  if (store && context) {
    // Update the existing store (mutates in place within the current async context)
    Object.assign(store, context)
  }
}

export function getTenantContext(): TenantContext | null {
  return tenantContextStore.getStore() ?? null
}

/**
 * Run a function with tenant context properly scoped.
 * This ensures the tenant context is isolated per-request and won't leak
 * between concurrent requests (fixes race condition from global variable).
 *
 * Usage:
 *   return runWithTenant({ companyId, userId }, async () => {
 *     // All db operations here will have tenant isolation
 *     return await db.contact.findMany()
 *   })
 */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return tenantContextStore.run(context, fn)
}

// ============================================
// GENERAL LEDGER (GL) SAFETY GUARDS
// ============================================

const LOCKED_PERIOD_STATUSES = new Set<PeriodStatus>(["CLOSED", "LOCKED"])

export class PeriodStatusLockedError extends Error {
  constructor(periodId: string) {
    super(`AccountingPeriod ${periodId} is locked and cannot accept entries.`)
    this.name = "PeriodStatusLockedError"
  }
}

export class JournalEntryBalanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JournalEntryBalanceError"
  }
}

export class JournalEntryImmutableError extends Error {
  constructor(entryId: string) {
    super(`JournalEntry ${entryId} is already posted and cannot be modified.`)
    this.name = "JournalEntryImmutableError"
  }
}

export class JournalLineAmountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JournalLineAmountError"
  }
}

const INVOICE_EVENT_STATUSES = new Set(["SENT", "FISCALIZED", "DELIVERED", "ACCEPTED"])
const EXPENSE_EVENT_STATUSES = new Set(["PENDING", "PAID"])

type OperationalEventInput = {
  companyId: string
  sourceType: "INVOICE" | "EXPENSE" | "BANK_TRANSACTION" | "PAYROLL" | "ASSET" | "INVENTORY"
  eventType:
    | "INVOICE_ISSUED"
    | "EXPENSE_RECORDED"
    | "BANK_TRANSACTION_INCOMING"
    | "BANK_TRANSACTION_OUTGOING"
    | "PAYROLL_POSTED"
    | "ASSET_ACQUIRED"
    | "ASSET_DEPRECIATION"
    | "ASSET_DISPOSED"
    | "INVENTORY_RECEIPT"
    | "INVENTORY_ISSUE"
    | "INVENTORY_ADJUSTMENT"
  sourceId: string
  entryDate: Date
  payload?: Prisma.InputJsonValue
}

async function upsertOperationalEvent(
  prismaBase: PrismaClient,
  event: OperationalEventInput
): Promise<void> {
  await prismaBase.operationalEvent.upsert({
    where: {
      companyId_sourceType_sourceId_eventType: {
        companyId: event.companyId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        eventType: event.eventType,
      },
    },
    create: event,
    update: {},
  })
}

function buildInvoiceEvent(record: {
  id: string
  companyId: string
  status: string
  direction: string
  issueDate: Date
}): OperationalEventInput | null {
  if (record.direction !== "OUTBOUND") return null
  if (!INVOICE_EVENT_STATUSES.has(record.status)) return null
  return {
    companyId: record.companyId,
    sourceType: "INVOICE",
    eventType: "INVOICE_ISSUED",
    sourceId: record.id,
    entryDate: record.issueDate,
    payload: { status: record.status },
  }
}

function buildExpenseEvent(record: {
  id: string
  companyId: string
  status: string
  date: Date
}): OperationalEventInput | null {
  if (!EXPENSE_EVENT_STATUSES.has(record.status)) return null
  return {
    companyId: record.companyId,
    sourceType: "EXPENSE",
    eventType: "EXPENSE_RECORDED",
    sourceId: record.id,
    entryDate: record.date,
    payload: { status: record.status },
  }
}

function buildTransactionEvent(record: {
  id: string
  companyId: string
  direction: string
  date: Date
}): OperationalEventInput {
  return {
    companyId: record.companyId,
    sourceType: "BANK_TRANSACTION",
    eventType:
      record.direction === "INCOMING" ? "BANK_TRANSACTION_INCOMING" : "BANK_TRANSACTION_OUTGOING",
    sourceId: record.id,
    entryDate: record.date,
    payload: { direction: record.direction },
  }
}

function buildPayrollEvent(record: {
  id: string
  companyId: string
  payoutDate: Date
  status?: string | null
}): OperationalEventInput | null {
  if (record.status && record.status !== "LOCKED") return null
  return {
    companyId: record.companyId,
    sourceType: "PAYROLL",
    eventType: "PAYROLL_POSTED",
    sourceId: record.id,
    entryDate: record.payoutDate,
    payload: { status: record.status ?? "LOCKED" },
  }
}

function buildAssetAcquisitionEvent(record: {
  id: string
  companyId: string
  acquisitionDate: Date
}): OperationalEventInput {
  return {
    companyId: record.companyId,
    sourceType: "ASSET",
    eventType: "ASSET_ACQUIRED",
    sourceId: record.id,
    entryDate: record.acquisitionDate,
  }
}

function buildAssetDepreciationEvent(record: {
  id: string
  companyId: string
  periodEnd: Date
}): OperationalEventInput {
  return {
    companyId: record.companyId,
    sourceType: "ASSET",
    eventType: "ASSET_DEPRECIATION",
    sourceId: record.id,
    entryDate: record.periodEnd,
  }
}

function buildAssetDisposalEvent(record: {
  id: string
  companyId: string
  disposalDate: Date
}): OperationalEventInput {
  return {
    companyId: record.companyId,
    sourceType: "ASSET",
    eventType: "ASSET_DISPOSED",
    sourceId: record.id,
    entryDate: record.disposalDate,
  }
}

function buildInventoryEvent(record: {
  id: string
  companyId: string
  movementType: string
  movementDate: Date
}): OperationalEventInput {
  const eventType =
    record.movementType === "PRIMKA"
      ? "INVENTORY_RECEIPT"
      : record.movementType === "IZDATNICA"
        ? "INVENTORY_ISSUE"
        : "INVENTORY_ADJUSTMENT"

  return {
    companyId: record.companyId,
    sourceType: "INVENTORY",
    eventType,
    sourceId: record.id,
    entryDate: record.movementDate,
    payload: { movementType: record.movementType },
  }
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value
  }
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value)
  }
  return new Prisma.Decimal(0)
}

function extractConnectId(data: Record<string, unknown>, field: string): string | null {
  const nested = data[field]
  if (!nested || typeof nested !== "object") return null
  const connect = (nested as { connect?: { id?: string } }).connect
  if (!connect || typeof connect !== "object") return null
  return typeof connect.id === "string" ? connect.id : null
}

function extractJournalEntryPeriodId(data: Record<string, unknown>): string | null {
  if (typeof data.periodId === "string") {
    return data.periodId
  }
  return extractConnectId(data, "period")
}

function extractJournalEntryIdFromLine(data: Record<string, unknown>): string | null {
  if (typeof data.journalEntryId === "string") {
    return data.journalEntryId
  }
  return extractConnectId(data, "journalEntry")
}

function assertLineAmounts(line: { debit?: unknown; credit?: unknown }): void {
  const debit = toDecimal(line.debit ?? 0)
  const credit = toDecimal(line.credit ?? 0)
  const debitPositive = debit.gt(0)
  const creditPositive = credit.gt(0)

  if ((debitPositive && creditPositive) || (!debitPositive && !creditPositive)) {
    throw new JournalLineAmountError("Each journal line must have either debit or credit amount.")
  }

  if (debit.lt(0) || credit.lt(0)) {
    throw new JournalLineAmountError("Journal line amounts cannot be negative.")
  }
}

function assertBalancedLines(lines: Array<{ debit?: unknown; credit?: unknown }>): void {
  const totals = lines.reduce<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>(
    (acc, line) => {
      const debit = toDecimal(line.debit ?? 0)
      const credit = toDecimal(line.credit ?? 0)
      return {
        debit: acc.debit.plus(debit),
        credit: acc.credit.plus(credit),
      }
    },
    { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) }
  )

  if (!totals.debit.equals(totals.credit)) {
    throw new JournalEntryBalanceError(
      `Unbalanced journal entry. debit=${totals.debit.toFixed(2)} credit=${totals.credit.toFixed(2)}`
    )
  }
}

function extractLineInputs(
  data: Record<string, unknown>
): Array<{ debit?: unknown; credit?: unknown }> {
  const lines = data.lines
  if (!lines || typeof lines !== "object") return []
  const create = (lines as { create?: unknown }).create
  if (Array.isArray(create)) {
    return create as Array<{ debit?: unknown; credit?: unknown }>
  }
  const createMany = (lines as { createMany?: { data?: unknown } }).createMany
  if (createMany && Array.isArray(createMany.data)) {
    return createMany.data as Array<{ debit?: unknown; credit?: unknown }>
  }
  return []
}

async function assertPeriodOpen(prismaBase: PrismaClient, periodId: string): Promise<void> {
  const period = await prismaBase.accountingPeriod.findUnique({
    where: { id: periodId },
    select: { status: true },
  })

  if (!period) {
    return
  }

  if (LOCKED_PERIOD_STATUSES.has(period.status)) {
    throw new PeriodStatusLockedError(periodId)
  }
}

async function assertEntryNotPosted(prismaBase: PrismaClient, entryId: string): Promise<void> {
  const entry = await prismaBase.journalEntry.findUnique({
    where: { id: entryId },
    select: { status: true },
  })

  if (entry?.status === "POSTED") {
    throw new JournalEntryImmutableError(entryId)
  }
}

async function assertEntryBalanced(prismaBase: PrismaClient, entryId: string): Promise<void> {
  const totals = await prismaBase.journalLine.aggregate({
    where: { journalEntryId: entryId },
    _sum: { debit: true, credit: true },
  })

  const debit = totals._sum.debit ?? new Prisma.Decimal(0)
  const credit = totals._sum.credit ?? new Prisma.Decimal(0)

  if (!debit.equals(credit)) {
    throw new JournalEntryBalanceError(
      `Unbalanced journal entry. debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`
    )
  }
}

// Models that require tenant filtering
const TENANT_MODELS = [
  "Contact",
  "Organization",
  "Address",
  "TaxIdentity",
  "Product",
  "EInvoice",
  "EInvoiceLine",
  "RevenueRegisterEntry",
  "InvoiceEvent",
  "AuditLog",
  "AccountingPeriod",
  "Artifact",
  "CashIn",
  "CashOut",
  "CashDayClose",
  "CashLimitSetting",
  "BankAccount",
  "BankTransaction",
  "MatchRecord",
  "StatementImport",
  "ImportJob",
  "Statement",
  "StatementPage",
  "Transaction",
  "Expense",
  "ExpenseLine",
  "UraInput",
  "SupplierBill",
  "Attachment",
  "ExpenseCorrection",
  "FixedAssetCandidate",
  "FixedAsset",
  "DepreciationSchedule",
  "DepreciationEntry",
  "DisposalEvent",
  "AssetCandidate",
  "ExpenseCategory",
  "RecurringExpense",
  "SavedReport",
  "SupportTicket",
  "SupportTicketMessage",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  "ChartOfAccounts",
  "AccountingPeriod",
  "JournalEntry",
  "JournalLine",
  "TrialBalance",
  "PostingRule",
  "OperationalEvent",
  "AccountMapping",
  "ExportProfile",
  "ExportJob",
  "Payout",
  "PayoutLine",
  "Payslip",
  "JoppdSubmission",
  "JoppdSubmissionLine",
  "PayslipArtifact",
  "CalculationSnapshot",
  "BankPaymentExport",
  "BankPaymentLine",
  "ReportingStatus",
  "ReviewQueueItem",
  "ReviewDecision",
  "Employee",
  "EmployeeRole",
  "EmploymentContract",
  "EmploymentContractVersion",
  "EmploymentTerminationEvent",
  "Dependent",
  "Allowance",
  "PensionPillar",
  "Warehouse",
  "StockItem",
  "StockMovement",
  "ValuationSnapshot",
  // Note: CompanyUser intentionally NOT included - it's filtered by userId, not companyId
  // Including it breaks getCurrentCompany() which queries CompanyUser before tenant context exists
] as const

// Models to audit (exclude AuditLog itself to prevent infinite loops)
const AUDITED_MODELS = [
  "Contact",
  "Organization",
  "Address",
  "TaxIdentity",
  "Product",
  "EInvoice",
  "Company",
  "AccountingPeriod",
  "Artifact",
  "CashIn",
  "CashOut",
  "CashDayClose",
  "CashLimitSetting",
  "BankAccount",
  "MatchRecord",
  "StatementImport",
  "Expense",
  "ExpenseLine",
  "UraInput",
  "SupplierBill",
  "Attachment",
  "ExpenseCorrection",
  "FixedAssetCandidate",
  "ExpenseCategory",
  "RecurringExpense",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  "SupportTicket",
  "ReportingStatus",
  "ReviewQueueItem",
  "ReviewDecision",
] as const
type AuditedModel = (typeof AUDITED_MODELS)[number]

// ============================================
// ACCOUNTING PERIOD LOCK ENFORCEMENT
// ============================================

const PERIOD_LOCK_MODELS = {
  EInvoice: { dateField: "issueDate", client: "eInvoice" },
  Expense: { dateField: "date", client: "expense" },
  BankTransaction: { dateField: "date", client: "bankTransaction" },
  Transaction: { dateField: "date", client: "transaction" },
  Statement: { dateField: "statementDate", client: "statement" },
} as const

type PeriodLockModel = keyof typeof PERIOD_LOCK_MODELS

export class AccountingPeriodLockedError extends Error {
  constructor(model: string, date: Date) {
    super(`Cannot modify ${model} on ${date.toISOString()}: accounting period is locked.`)
    this.name = "AccountingPeriodLockedError"
  }
}

function extractDate(data: Record<string, unknown>, field: string): Date | null {
  const value = data[field]
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (value && typeof value === "object") {
    const setValue = (value as { set?: unknown }).set
    if (setValue instanceof Date) return setValue
    if (typeof setValue === "string") {
      const parsed = new Date(setValue)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }
  return null
}

async function assertPeriodUnlocked(
  prismaBase: PrismaClient,
  companyId: string,
  date: Date,
  model: string
): Promise<void> {
  const lockedPeriod = await prismaBase.accountingPeriod.findFirst({
    where: {
      companyId,
      status: { in: Array.from(LOCKED_PERIOD_STATUSES) },
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  })

  if (lockedPeriod) {
    throw new AccountingPeriodLockedError(model, date)
  }
}

async function resolvePeriodLockContext(
  prismaBase: PrismaClient,
  model: string,
  args: { data?: Record<string, unknown>; where?: Record<string, unknown> }
): Promise<{ companyId: string | null; date: Date | null }> {
  if (!(model in PERIOD_LOCK_MODELS)) {
    return { companyId: null, date: null }
  }

  const { dateField, client } = PERIOD_LOCK_MODELS[model as PeriodLockModel]
  const context = getTenantContext()
  const companyId = context?.companyId ?? (args.data?.companyId as string | undefined) ?? null

  const directDate = args.data ? extractDate(args.data, dateField) : null
  if (companyId && directDate) {
    return { companyId, date: directDate }
  }

  if (!args.where) {
    return { companyId, date: directDate }
  }

  const modelClient = (prismaBase as unknown as Record<string, unknown>)[client] as
    | {
        findUnique?: (params: unknown) => Promise<Record<string, unknown> | null>
        findFirst?: (params: unknown) => Promise<Record<string, unknown> | null>
      }
    | undefined

  if (!modelClient) {
    return { companyId, date: directDate }
  }

  const finder = modelClient.findUnique ?? modelClient.findFirst
  if (!finder) {
    return { companyId, date: directDate }
  }

  const existing = await finder({
    where: args.where,
    select: { companyId: true, [dateField]: true },
  })

  if (!existing) {
    return { companyId, date: directDate }
  }

  return {
    companyId: (existing.companyId as string) ?? companyId,
    date: (existing[dateField] as Date) ?? directDate,
  }
}

async function enforcePeriodLockForBulk(
  prismaBase: PrismaClient,
  model: string,
  args: { where?: Record<string, unknown> }
): Promise<void> {
  if (!(model in PERIOD_LOCK_MODELS)) return
  const { dateField, client } = PERIOD_LOCK_MODELS[model as PeriodLockModel]
  const context = getTenantContext()
  const companyId = context?.companyId ?? (args.where?.companyId as string | undefined) ?? null

  if (!companyId) return

  const lockedPeriods = await prismaBase.accountingPeriod.findMany({
    where: { companyId, status: { in: Array.from(LOCKED_PERIOD_STATUSES) } },
    select: { startDate: true, endDate: true },
  })

  if (lockedPeriods.length === 0) return

  const modelClient = (prismaBase as unknown as Record<string, unknown>)[client] as
    | {
        findFirst?: (params: unknown) => Promise<Record<string, unknown> | null>
      }
    | undefined

  if (!modelClient?.findFirst) return

  const lockedWhere = {
    ...args.where,
    OR: lockedPeriods.map((period) => ({
      [dateField]: { gte: period.startDate, lte: period.endDate },
    })),
  }

  const existing = await modelClient.findFirst({
    where: lockedWhere,
    select: { [dateField]: true },
  })

  if (existing && existing[dateField]) {
    throw new AccountingPeriodLockedError(model, existing[dateField] as Date)
  }
}

// ============================================
// INVOICE IMMUTABILITY PROTECTION
// ============================================

const INVOICE_MUTABLE_FIELDS_AFTER_ISSUE = new Set<string>([
  "status",
  "fiscalStatus",
  "jir",
  "zki",
  "fiscalizedAt",
  "sentAt",
  "receivedAt",
  "archivedAt",
  "providerRef",
  "providerStatus",
  "providerError",
  "ublXml",
  "paidAt",
  "emailMessageId",
  "emailDeliveredAt",
  "emailOpenedAt",
  "emailClickedAt",
  "emailBouncedAt",
  "emailBounceReason",
  "importJobId",
])

export class InvoiceImmutabilityError extends Error {
  constructor(details: string) {
    super(`Issued invoices are immutable. ${details}`)
    this.name = "InvoiceImmutabilityError"
  }
}

async function enforceInvoiceImmutability(
  prismaBase: PrismaClient,
  args: { where: unknown; data?: Record<string, unknown> }
): Promise<void> {
  if (!args.data || typeof args.data !== "object") return

  const updateKeys = Object.keys(args.data)
  if (updateKeys.length === 0) return

  const disallowedKeys = updateKeys.filter((key) => !INVOICE_MUTABLE_FIELDS_AFTER_ISSUE.has(key))
  if (disallowedKeys.length === 0) return

  const existing = await prismaBase.eInvoice.findUnique({
    where: args.where as Prisma.EInvoiceWhereUniqueInput,
    select: { status: true, jir: true, fiscalizedAt: true },
  })

  if (!existing) return

  if (existing.status !== "DRAFT" || existing.jir || existing.fiscalizedAt) {
    throw new InvoiceImmutabilityError(
      `Attempted to update fields [${disallowedKeys.join(", ")}] on invoice in status ${
        existing.status
      }. Use a credit note for corrections.`
    )
  }
}

async function enforceInvoiceLineImmutability(
  prismaBase: PrismaClient,
  where: Prisma.EInvoiceLineWhereInput,
  action: "update" | "delete"
): Promise<void> {
  const lockedLine = await prismaBase.eInvoiceLine.findFirst({
    where: {
      ...where,
      eInvoice: {
        OR: [{ status: { not: "DRAFT" } }, { jir: { not: null } }, { fiscalizedAt: { not: null } }],
      },
    },
    select: { id: true, eInvoiceId: true },
  })

  if (lockedLine) {
    throw new InvoiceImmutabilityError(
      `Cannot ${action} invoice line ${lockedLine.id} because invoice ${lockedLine.eInvoiceId} has been issued.`
    )
  }
}

async function enforceInvoiceDeleteImmutability(
  prismaBase: PrismaClient,
  where: Prisma.EInvoiceWhereUniqueInput,
  action: "delete"
): Promise<void> {
  const existing = await prismaBase.eInvoice.findUnique({
    where,
    select: { status: true, jir: true, fiscalizedAt: true },
  })

  if (existing && (existing.status !== "DRAFT" || existing.jir || existing.fiscalizedAt)) {
    throw new InvoiceImmutabilityError(
      `Cannot ${action} invoice in status ${existing.status}. Use a credit note for corrections.`
    )
  }
}

async function enforceInvoiceUpdateManyImmutability(
  prismaBase: PrismaClient,
  args: { where?: Prisma.EInvoiceWhereInput; data?: Record<string, unknown> }
): Promise<void> {
  if (!args.data || typeof args.data !== "object") return

  const updateKeys = Object.keys(args.data)
  if (updateKeys.length === 0) return

  const disallowedKeys = updateKeys.filter((key) => !INVOICE_MUTABLE_FIELDS_AFTER_ISSUE.has(key))
  if (disallowedKeys.length === 0) return

  const lockedInvoice = await prismaBase.eInvoice.findFirst({
    where: {
      ...(args.where ?? {}),
      OR: [{ status: { not: "DRAFT" } }, { jir: { not: null } }, { fiscalizedAt: { not: null } }],
    },
    select: { id: true, status: true },
  })

  if (lockedInvoice) {
    throw new InvoiceImmutabilityError(
      `Attempted to update fields [${disallowedKeys.join(", ")}] on invoice ${lockedInvoice.id} in status ${
        lockedInvoice.status
      }. Use a credit note for corrections.`
    )
  }
}

// ============================================
// EVIDENCE IMMUTABILITY PROTECTION
// ============================================
// Evidence.rawContent is the source of truth for the regulatory chain.
// Once created, it MUST NOT be modified to preserve audit integrity.

const EVIDENCE_IMMUTABLE_FIELDS = ["rawContent", "contentHash", "fetchedAt"] as const

// ============================================
// PAYOUT SNAPSHOT IMMUTABILITY PROTECTION
// ============================================

export class CalculationSnapshotImmutabilityError extends Error {
  constructor() {
    super("Cannot modify CalculationSnapshot records. Snapshots are immutable once created.")
    this.name = "CalculationSnapshotImmutabilityError"
  }
}

/**
 * Error thrown when attempting to modify immutable evidence fields.
 */
export class EvidenceImmutabilityError extends Error {
  constructor(field: string) {
    super(
      `Cannot modify Evidence.${field}: Evidence content is immutable once created. ` +
        "Create a new Evidence record if the source has changed."
    )
    this.name = "EvidenceImmutabilityError"
  }
}

/**
 * Check if an update operation attempts to modify immutable Evidence fields.
 */
function checkEvidenceImmutability(data: Record<string, unknown>): void {
  for (const field of EVIDENCE_IMMUTABLE_FIELDS) {
    if (field in data) {
      throw new EvidenceImmutabilityError(field)
    }
  }
}

// ============================================
// JOPPD SUBMISSION IMMUTABILITY PROTECTION
// ============================================
// JOPPD submissions become immutable once signed or submitted to tax authority.
// After signing: signedXmlStorageKey and signedXmlHash are locked.
// After submission: all core fields are locked; only status transitions allowed.

/**
 * Fields that can be updated after JOPPD is signed (signedXmlStorageKey set).
 * This is the most restrictive lock - only status transitions and submission tracking.
 */
const JOPPD_MUTABLE_FIELDS_AFTER_SIGNED = new Set<string>([
  "status",
  "submissionReference",
  "submittedAt",
  "acceptedAt",
  "rejectedAt",
  "rejectionReason",
  "updatedAt",
])

/**
 * Statuses that indicate a JOPPD has been submitted to the tax authority.
 * Records in these states are immutable except for status tracking fields.
 */
const JOPPD_SUBMITTED_STATUSES = new Set(["SUBMITTED", "ACCEPTED", "REJECTED"])

export class JoppdImmutabilityError extends Error {
  constructor(details: string) {
    super(`JOPPD submissions are immutable after signing/submission. ${details}`)
    this.name = "JoppdImmutabilityError"
  }
}

/**
 * Check if a JOPPD submission is locked (signed or submitted).
 */
function isJoppdLocked(record: { status: string; signedXmlStorageKey?: string | null }): boolean {
  return (
    JOPPD_SUBMITTED_STATUSES.has(record.status) ||
    (record.signedXmlStorageKey != null && record.signedXmlStorageKey !== "")
  )
}

/**
 * Enforce immutability for JOPPD update operations.
 */
async function enforceJoppdImmutability(
  prismaBase: PrismaClient,
  args: { where: unknown; data?: Record<string, unknown> }
): Promise<void> {
  if (!args.data || typeof args.data !== "object") return

  const updateKeys = Object.keys(args.data)
  if (updateKeys.length === 0) return

  const disallowedKeys = updateKeys.filter((key) => !JOPPD_MUTABLE_FIELDS_AFTER_SIGNED.has(key))
  if (disallowedKeys.length === 0) return

  const existing = await prismaBase.joppdSubmission.findUnique({
    where: args.where as Prisma.JoppdSubmissionWhereUniqueInput,
    select: { status: true, signedXmlStorageKey: true },
  })

  if (!existing) return

  if (isJoppdLocked(existing)) {
    throw new JoppdImmutabilityError(
      `Attempted to update fields [${disallowedKeys.join(", ")}] on JOPPD in status ${existing.status}. ` +
        "Signed/submitted JOPPD records cannot be modified. Use a correction submission instead."
    )
  }
}

/**
 * Enforce immutability for JOPPD delete operations.
 */
async function enforceJoppdDeleteImmutability(
  prismaBase: PrismaClient,
  where: Prisma.JoppdSubmissionWhereUniqueInput
): Promise<void> {
  const existing = await prismaBase.joppdSubmission.findUnique({
    where,
    select: { status: true, signedXmlStorageKey: true },
  })

  if (existing && isJoppdLocked(existing)) {
    throw new JoppdImmutabilityError(
      `Cannot delete JOPPD in status ${existing.status}. ` +
        "Signed/submitted JOPPD records are immutable. Use a correction submission instead."
    )
  }
}

/**
 * Enforce immutability for JOPPD updateMany operations.
 */
async function enforceJoppdUpdateManyImmutability(
  prismaBase: PrismaClient,
  args: { where?: Prisma.JoppdSubmissionWhereInput; data?: Record<string, unknown> }
): Promise<void> {
  if (!args.data || typeof args.data !== "object") return

  const updateKeys = Object.keys(args.data)
  if (updateKeys.length === 0) return

  const disallowedKeys = updateKeys.filter((key) => !JOPPD_MUTABLE_FIELDS_AFTER_SIGNED.has(key))
  if (disallowedKeys.length === 0) return

  // Check if any locked records would be affected
  const lockedSubmission = await prismaBase.joppdSubmission.findFirst({
    where: {
      ...(args.where ?? {}),
      OR: [
        { status: { in: ["SUBMITTED", "ACCEPTED", "REJECTED"] } },
        { signedXmlStorageKey: { not: null } },
      ],
    },
    select: { id: true, status: true },
  })

  if (lockedSubmission) {
    throw new JoppdImmutabilityError(
      `Attempted to update fields [${disallowedKeys.join(", ")}] on JOPPD ${lockedSubmission.id} ` +
        `in status ${lockedSubmission.status}. Use a correction submission instead.`
    )
  }
}

/**
 * Enforce immutability for JOPPD line operations.
 * Lines inherit lock status from their parent submission.
 */
async function enforceJoppdLineImmutability(
  prismaBase: PrismaClient,
  where: Prisma.JoppdSubmissionLineWhereInput,
  action: "update" | "delete"
): Promise<void> {
  const lockedLine = await prismaBase.joppdSubmissionLine.findFirst({
    where: {
      ...where,
      submission: {
        OR: [
          { status: { in: ["SUBMITTED", "ACCEPTED", "REJECTED"] } },
          { signedXmlStorageKey: { not: null } },
        ],
      },
    },
    select: { id: true, submissionId: true },
  })

  if (lockedLine) {
    throw new JoppdImmutabilityError(
      `Cannot ${action} JOPPD line ${lockedLine.id} because submission ${lockedLine.submissionId} has been signed/submitted.`
    )
  }
}

// ============================================
// ATTACHMENT IMMUTABILITY PROTECTION
// ============================================
// Source attachments (email/import) must remain immutable for audit integrity.

/**
 * Error thrown when attempting to modify immutable attachments.
 */
export class AttachmentImmutabilityError extends Error {
  constructor(id: string) {
    super(
      `Cannot modify Attachment ${id}: source attachments are immutable once stored. ` +
        "Create a new attachment record for corrections."
    )
    this.name = "AttachmentImmutabilityError"
  }
}

async function ensureAttachmentMutable(
  prismaBase: PrismaClient,
  where: Prisma.AttachmentWhereInput | Prisma.AttachmentWhereUniqueInput
) {
  const baseWhere = (where ?? {}) as Prisma.AttachmentWhereInput
  const immutable = await prismaBase.attachment.findFirst({
    where: { ...baseWhere, isSourceImmutable: true },
    select: { id: true },
  })

  if (immutable) {
    throw new AttachmentImmutabilityError(immutable.id)
  }
}

// ============================================
// ARTIFACT IMMUTABILITY PROTECTION
// ============================================
// Artifacts are content-addressed and must remain immutable once stored.

export class ArtifactImmutabilityError extends Error {
  constructor(action: string) {
    super(`Cannot ${action} Artifact records: artifacts are immutable once stored.`)
    this.name = "ArtifactImmutabilityError"
  }
}

// ============================================
// REGULATORY RULE STATUS TRANSITION PROTECTION
// ============================================
// RegulatoryRule.status transitions must go through proper gates.
// Direct status updates bypass provenance validation, tier checks, and audit.

/**
 * Allowed status transitions for RegulatoryRule.
 * This is the source of truth for what transitions are legal.
 *
 * Valid paths:
 *   DRAFT → PENDING_REVIEW (submit for review)
 *   PENDING_REVIEW → APPROVED (human/auto approval)
 *   PENDING_REVIEW → REJECTED (rejection)
 *   PENDING_REVIEW → DRAFT (send back for edits)
 *   APPROVED → PUBLISHED (release)
 *   APPROVED → PENDING_REVIEW (revoke approval, rare)
 *   PUBLISHED → DEPRECATED (superseded)
 *   REJECTED → DRAFT (retry)
 *
 * FORBIDDEN (shortcuts that bypass gates):
 *   DRAFT → APPROVED (must go through PENDING_REVIEW)
 *   DRAFT → PUBLISHED (must go through PENDING_REVIEW → APPROVED)
 *   PENDING_REVIEW → PUBLISHED (must be APPROVED first)
 */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PUBLISHED", "PENDING_REVIEW"],
  PUBLISHED: ["DEPRECATED"],
  DEPRECATED: [], // Terminal state
  REJECTED: ["DRAFT"],
}

/**
 * Error thrown when attempting forbidden status transitions on RegulatoryRule.
 */
export class RegulatoryRuleStatusTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RegulatoryRuleStatusTransitionError"
  }
}

/**
 * Error thrown when attempting to use updateMany to change RegulatoryRule.status.
 * updateMany is forbidden for status transitions because it bypasses per-rule validation.
 */
export class RegulatoryRuleUpdateManyStatusNotAllowedError extends Error {
  constructor() {
    super(
      "Cannot update RegulatoryRule.status using updateMany. " +
        "Use the rule status service (approve/publish) so per-rule gates are enforced."
    )
    this.name = "RegulatoryRuleUpdateManyStatusNotAllowedError"
  }
}

// ============================================
// CASH OPERATIONS: BALANCE + DAY CLOSE PROTECTION
// ============================================
export class CashDayClosedError extends Error {
  constructor(action: string, businessDate: Date) {
    super(`Cannot ${action}: cash day ${businessDate.toISOString().slice(0, 10)} is closed.`)
    this.name = "CashDayClosedError"
  }
}

export class CashBalanceNegativeError extends Error {
  constructor() {
    super("Cannot complete cash operation: cash balance cannot be negative.")
    this.name = "CashBalanceNegativeError"
  }
}

export class CashAmountNegativeError extends Error {
  constructor() {
    super("Cash amount must be non-negative.")
    this.name = "CashAmountNegativeError"
  }
}

export class CashLimitExceededError extends Error {
  constructor(limit: string, nextBalance: string) {
    super(
      `Cash limit exceeded: adding this amount would result in ${nextBalance} EUR, ` +
        `which exceeds the configured limit of ${limit} EUR.`
    )
    this.name = "CashLimitExceededError"
  }
}

export class CashBulkMutationNotAllowedError extends Error {
  constructor(model: string, action: string) {
    super(`Cannot ${action} ${model} in bulk. Use individual operations for cash integrity.`)
    this.name = "CashBulkMutationNotAllowedError"
  }
}

export class CashDayCloseImmutableError extends Error {
  constructor(action: string) {
    super(`Cannot ${action} CashDayClose: close events are immutable.`)
    this.name = "CashDayCloseImmutableError"
  }
}

const CASH_MODELS = ["CashIn", "CashOut"] as const

type CashModel = (typeof CASH_MODELS)[number]

function getPrismaFieldValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value
  if ("set" in value) {
    return (value as { set?: unknown }).set
  }
  return value
}

function getDateValue(value: unknown): Date | null {
  const raw = getPrismaFieldValue(value)
  if (!raw) return null
  if (raw instanceof Date) return raw
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function getDecimalValue(value: unknown): Prisma.Decimal | null {
  const raw = getPrismaFieldValue(value)
  if (raw === null || typeof raw === "undefined") return null
  if (raw instanceof Prisma.Decimal) return raw
  if (typeof raw === "number" || typeof raw === "string") return new Prisma.Decimal(raw)
  return null
}

function assertAmountNonNegative(amount: Prisma.Decimal) {
  if (amount.lessThan(0)) {
    throw new CashAmountNegativeError()
  }
}

export class StockValuationMethodMismatchError extends Error {
  constructor(companyId: string, method: string) {
    super(`Stock valuation method mismatch for company ${companyId}: ${method}`)
    this.name = "StockValuationMethodMismatchError"
  }
}

export class StockValuationMethodChangeError extends Error {
  constructor(companyId: string) {
    super(
      `Stock valuation method cannot be changed for company ${companyId} once stock activity exists.`
    )
    this.name = "StockValuationMethodChangeError"
  }
}

export class StockMovementReconciliationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StockMovementReconciliationError"
  }
}

function assertStockMovementQuantity(movementType: string, quantity: Prisma.Decimal | null): void {
  if (!quantity) return
  if (quantity.isZero()) {
    throw new StockMovementReconciliationError("Stock movement quantity cannot be zero.")
  }
  if ((movementType === "PRIMKA" || movementType === "IZDATNICA") && quantity.lte(0)) {
    throw new StockMovementReconciliationError(
      `Stock movement ${movementType} requires a positive quantity.`
    )
  }
}

async function assertStockItemRelations(
  prismaBase: PrismaClient,
  data: Record<string, unknown>
): Promise<void> {
  const companyId = data.companyId as string | undefined
  const warehouseId = data.warehouseId as string | undefined
  const productId = data.productId as string | undefined
  if (!companyId || !warehouseId || !productId) return

  const [warehouse, product] = await Promise.all([
    prismaBase.warehouse.findUnique({ where: { id: warehouseId }, select: { companyId: true } }),
    prismaBase.product.findUnique({ where: { id: productId }, select: { companyId: true } }),
  ])

  if (!warehouse || warehouse.companyId !== companyId) {
    throw new StockMovementReconciliationError("Warehouse does not belong to company.")
  }

  if (!product || product.companyId !== companyId) {
    throw new StockMovementReconciliationError("Product does not belong to company.")
  }
}

async function assertStockMovementRelations(
  prismaBase: PrismaClient,
  data: Record<string, unknown>
): Promise<void> {
  const companyId = (data.companyId as string | undefined) ?? getTenantContext()?.companyId
  const warehouseId = data.warehouseId as string | undefined
  const productId = data.productId as string | undefined
  const stockItemId = data.stockItemId as string | undefined

  if (!companyId) return

  if (warehouseId) {
    const warehouse = await prismaBase.warehouse.findUnique({
      where: { id: warehouseId },
      select: { companyId: true },
    })
    if (!warehouse || warehouse.companyId !== companyId) {
      throw new StockMovementReconciliationError("Warehouse does not belong to company.")
    }
  }

  if (productId) {
    const product = await prismaBase.product.findUnique({
      where: { id: productId },
      select: { companyId: true },
    })
    if (!product || product.companyId !== companyId) {
      throw new StockMovementReconciliationError("Product does not belong to company.")
    }
  }

  if (stockItemId) {
    const stockItem = await prismaBase.stockItem.findUnique({
      where: { id: stockItemId },
      select: { companyId: true, warehouseId: true, productId: true },
    })

    if (!stockItem || stockItem.companyId !== companyId) {
      throw new StockMovementReconciliationError("Stock item does not belong to company.")
    }

    if (warehouseId && stockItem.warehouseId !== warehouseId) {
      throw new StockMovementReconciliationError("Stock item does not match warehouse.")
    }

    if (productId && stockItem.productId !== productId) {
      throw new StockMovementReconciliationError("Stock item does not match product.")
    }
  }
}

async function assertStockValuationMethod(
  prismaBase: PrismaClient,
  companyId: string,
  valuationMethod: string
): Promise<void> {
  const company = await prismaBase.company.findUnique({
    where: { id: companyId },
    select: { stockValuationMethod: true },
  })

  if (company && company.stockValuationMethod !== valuationMethod) {
    throw new StockValuationMethodMismatchError(companyId, valuationMethod)
  }
}

async function assertStockValuationMethodChange(
  prismaBase: PrismaClient,
  companyId: string
): Promise<void> {
  const [activityCount, snapshotCount] = await Promise.all([
    prismaBase.stockMovement.count({ where: { companyId } }),
    prismaBase.valuationSnapshot.count({ where: { companyId } }),
  ])

  if (activityCount > 0 || snapshotCount > 0) {
    throw new StockValuationMethodChangeError(companyId)
  }
}

async function isCashDayClosed(
  prismaBase: PrismaClient,
  companyId: string,
  businessDate: Date
): Promise<boolean> {
  const closed = await prismaBase.cashDayClose.findUnique({
    where: { companyId_businessDate: { companyId, businessDate } },
    select: { id: true },
  })
  return Boolean(closed)
}

async function assertCashDayOpen(
  prismaBase: PrismaClient,
  companyId: string,
  businessDate: Date,
  action: string
): Promise<void> {
  if (await isCashDayClosed(prismaBase, companyId, businessDate)) {
    throw new CashDayClosedError(action, businessDate)
  }
}

async function getCashBalance(
  prismaBase: PrismaClient,
  companyId: string
): Promise<Prisma.Decimal> {
  const [cashInSum, cashOutSum] = await Promise.all([
    prismaBase.cashIn.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
    prismaBase.cashOut.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
  ])

  return toDecimal(cashInSum._sum.amount).minus(toDecimal(cashOutSum._sum.amount))
}

type CashRecord = {
  amount: Prisma.Decimal
  businessDate: Date
  companyId: string
}

async function getCashRecord(
  prismaBase: PrismaClient,
  model: CashModel,
  where: Prisma.CashInWhereUniqueInput | Prisma.CashOutWhereUniqueInput
): Promise<CashRecord | null> {
  if (model === "CashIn") {
    return prismaBase.cashIn.findUnique({
      where: where as Prisma.CashInWhereUniqueInput,
      select: { amount: true, businessDate: true, companyId: true },
    })
  }

  return prismaBase.cashOut.findUnique({
    where: where as Prisma.CashOutWhereUniqueInput,
    select: { amount: true, businessDate: true, companyId: true },
  })
}

async function enforceCashTransactionCreate(
  prismaBase: PrismaClient,
  model: CashModel,
  data: Record<string, unknown>,
  companyId: string
) {
  const businessDate = getDateValue(data.businessDate)
  const amount = getDecimalValue(data.amount)

  if (!businessDate || !amount) return

  assertAmountNonNegative(amount)
  await assertCashDayOpen(prismaBase, companyId, businessDate, "create cash entry")

  const balance = await getCashBalance(prismaBase, companyId)
  const newBalance = model === "CashIn" ? balance.plus(amount) : balance.minus(amount)

  if (newBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }
}

async function enforceCashTransactionUpdate(
  prismaBase: PrismaClient,
  model: CashModel,
  args: { where: unknown; data: unknown }
) {
  const existing = await getCashRecord(
    prismaBase,
    model,
    args.where as Prisma.CashInWhereUniqueInput
  )

  if (!existing) return

  await assertCashDayOpen(
    prismaBase,
    existing.companyId,
    existing.businessDate,
    "update cash entry"
  )

  const data = (args.data ?? {}) as Record<string, unknown>
  const requestedDate = getDateValue(data.businessDate)

  if (requestedDate && requestedDate.getTime() !== existing.businessDate.getTime()) {
    await assertCashDayOpen(prismaBase, existing.companyId, requestedDate, "update cash entry")
  }

  const nextAmount = getDecimalValue(data.amount) ?? existing.amount
  assertAmountNonNegative(nextAmount)

  const balance = await getCashBalance(prismaBase, existing.companyId)
  const newBalance =
    model === "CashIn"
      ? balance.minus(existing.amount).plus(nextAmount)
      : balance.plus(existing.amount).minus(nextAmount)

  if (newBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }
}

async function enforceCashTransactionDelete(
  prismaBase: PrismaClient,
  model: CashModel,
  args: { where: unknown }
) {
  const existing = await getCashRecord(
    prismaBase,
    model,
    args.where as Prisma.CashInWhereUniqueInput
  )

  if (!existing) return

  await assertCashDayOpen(
    prismaBase,
    existing.companyId,
    existing.businessDate,
    "delete cash entry"
  )

  const balance = await getCashBalance(prismaBase, existing.companyId)
  const newBalance =
    model === "CashIn" ? balance.minus(existing.amount) : balance.plus(existing.amount)

  if (newBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }
}

/**
 * Safely extract status from update data if present.
 *
 * Handles both direct assignment and Prisma set syntax:
 * - { status: "APPROVED" }           -> "APPROVED"
 * - { status: { set: "APPROVED" } }  -> "APPROVED"
 *
 * CRITICAL: Both forms must be caught to prevent bypass.
 */
function getRequestedRuleStatus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const s = d.status

  // Direct string assignment: { status: "APPROVED" }
  if (typeof s === "string") return s

  // Prisma set syntax: { status: { set: "APPROVED" } }
  if (s && typeof s === "object") {
    const setObj = s as Record<string, unknown>
    if (typeof setObj.set === "string") return setObj.set
  }

  return null
}

function getRequestedPayoutStatus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const s = d.status

  if (typeof s === "string") return s

  if (s && typeof s === "object") {
    const setObj = s as Record<string, unknown>
    if (typeof setObj.set === "string") return setObj.set
  }

  return null
}

const PAYOUT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["LOCKED"],
  LOCKED: ["REPORTED"],
  REPORTED: [],
}

export class PayoutStatusTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PayoutStatusTransitionError"
  }
}

function validatePayoutTransition(
  currentStatus: string,
  newStatus: string
): { allowed: boolean; error?: string } {
  if (currentStatus === newStatus) {
    return { allowed: true }
  }

  const allowedTargets = PAYOUT_ALLOWED_TRANSITIONS[currentStatus] ?? []
  if (!allowedTargets.includes(newStatus)) {
    return {
      allowed: false,
      error:
        `Illegal payout status transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed transitions from ${currentStatus}: [${allowedTargets.join(", ") || "none"}].`,
    }
  }

  return { allowed: true }
}

/**
 * Validate status transitions for RegulatoryRule.
 * Returns allowed: true if transition is valid.
 */
function validateStatusTransitionInternal(
  currentStatus: string,
  newStatus: string,
  context?: {
    source?: string
    bypassApproval?: boolean
    systemAction?: RegulatorySystemAction
  }
): { allowed: boolean; error?: string } {
  // Same status = no transition, always allowed
  if (currentStatus === newStatus) {
    return { allowed: true }
  }

  // Check if transition is in allowed list
  const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? []
  if (!allowedTargets.includes(newStatus)) {
    // ========================================
    // SYSTEM ACTIONS (preferred over bypassApproval)
    // ========================================
    if (context?.systemAction && context?.source) {
      // QUARANTINE_DOWNGRADE: Only allows → PENDING_REVIEW
      if (context.systemAction === "QUARANTINE_DOWNGRADE") {
        if (newStatus === "PENDING_REVIEW") {
          if (currentStatus === "APPROVED" || currentStatus === "PUBLISHED") {
            return { allowed: true }
          }
        }
        return {
          allowed: false,
          error: `QUARANTINE_DOWNGRADE only allows APPROVED/PUBLISHED → PENDING_REVIEW`,
        }
      }

      // ROLLBACK: Only allows PUBLISHED → APPROVED
      if (context.systemAction === "ROLLBACK") {
        if (currentStatus === "PUBLISHED" && newStatus === "APPROVED") {
          return { allowed: true }
        }
        return {
          allowed: false,
          error: `ROLLBACK only allows PUBLISHED → APPROVED`,
        }
      }
    }

    // ========================================
    // DEPRECATED: bypassApproval
    // Only allows DOWNGRADES (→ PENDING_REVIEW) and rollbacks
    // NEVER allows approve or publish
    // ========================================
    if (context?.bypassApproval && context?.source) {
      // BLOCK: bypassApproval NEVER allows approval transitions
      if (newStatus === "APPROVED") {
        // Exception: rollback (PUBLISHED → APPROVED) still allowed for backward compat
        if (currentStatus === "PUBLISHED" && context.source.toLowerCase().includes("rollback")) {
          return { allowed: true }
        }
        return {
          allowed: false,
          error: `bypassApproval cannot be used for approval. Use autoApprove with allowlist.`,
        }
      }

      // BLOCK: bypassApproval NEVER allows publish
      if (newStatus === "PUBLISHED") {
        return {
          allowed: false,
          error: `bypassApproval cannot be used for publishing. Publishing requires normal approval flow.`,
        }
      }

      // ALLOW: Downgrades to PENDING_REVIEW (quarantine use case)
      if (newStatus === "PENDING_REVIEW") {
        if (currentStatus === "APPROVED" || currentStatus === "PUBLISHED") {
          return { allowed: true }
        }
      }
    }

    return {
      allowed: false,
      error:
        `Illegal status transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed transitions from ${currentStatus}: [${allowedTargets.join(", ") || "none"}].`,
    }
  }

  // PUBLISHED requires explicit source context (no silent publishes)
  if (newStatus === "PUBLISHED") {
    if (!context?.source) {
      return {
        allowed: false,
        error: "Publishing requires explicit source context. Use runWithRegulatoryContext().",
      }
    }
  }

  return { allowed: true }
}

// Audit queue to avoid blocking main operations
interface AuditQueueItem {
  companyId: string
  userId: string | null
  actor: string
  action: AuditAction
  entity: string
  entityId: string
  changes: Record<string, unknown> | null
  reason: string
  timestamp: Date
  checksum: string
}

const auditQueue: AuditQueueItem[] = []
let isProcessingAudit = false

async function processAuditQueue(prismaBase: PrismaClient) {
  if (isProcessingAudit || auditQueue.length === 0) return
  isProcessingAudit = true

  try {
    while (auditQueue.length > 0) {
      const item = auditQueue.shift()
      if (!item) continue

      try {
        await prismaBase.auditLog.create({
          data: {
            companyId: item.companyId,
            userId: item.userId,
            actor: item.actor,
            action: item.action,
            entity: item.entity,
            entityId: item.entityId,
            changes: item.changes as Record<string, never> | undefined,
            reason: item.reason,
            checksum: item.checksum,
            timestamp: item.timestamp,
          },
        })
      } catch (error) {
        console.error("[Audit] Failed to log:", error)
      }
    }
  } finally {
    isProcessingAudit = false
  }
}

function queueAuditLog(
  prismaBase: PrismaClient,
  model: string,
  action: AuditAction,
  result: Record<string, unknown>,
  beforeState?: Record<string, unknown> | null
) {
  const companyId = result.companyId as string
  const entityId = result.id as string
  const context = getTenantContext()
  const auditContext = getAuditContext()

  if (!companyId || !entityId) return

  // Create a JSON-serializable changes object
  // For DELETE: capture before state (the deleted record)
  // For CREATE: capture after state (the created record)
  // For UPDATE: capture both before and after states for complete audit trail
  let changes: Record<string, unknown>
  if (action === "DELETE") {
    changes = { before: JSON.parse(JSON.stringify(result)) }
  } else if (action === "UPDATE" && beforeState) {
    changes = {
      before: JSON.parse(JSON.stringify(beforeState)),
      after: JSON.parse(JSON.stringify(result)),
    }
  } else {
    changes = { after: JSON.parse(JSON.stringify(result)) }
  }

  const timestamp = new Date()
  const actor = auditContext?.actorId ?? context?.userId ?? "system"
  const reason = auditContext?.reason ?? "unspecified"
  const checksum = computeAuditChecksum({
    actor,
    action,
    entity: model,
    entityId,
    reason,
    timestamp: timestamp.toISOString(),
  })

  auditQueue.push({
    companyId,
    userId: context?.userId ?? null,
    actor,
    action,
    entity: model,
    entityId,
    changes,
    reason,
    timestamp,
    checksum,
  })

  // Process queue asynchronously
  setImmediate(() => processAuditQueue(prismaBase))
}

// Extension to automatically add companyId filter to queries
export function withTenantIsolation(prisma: PrismaClient) {
  // Keep reference to base prisma for audit logging
  const prismaBase = prisma

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async findUnique({ model, args, query }) {
          // For findUnique, we verify after fetch instead of modifying where
          const result = await query(args)
          const context = getTenantContext()
          if (
            context &&
            result &&
            TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])
          ) {
            if ((result as { companyId?: string }).companyId !== context.companyId) {
              return null // Hide records from other tenants
            }
          }
          return result
        },
        async create({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.data = {
              ...args.data,
              companyId: context.companyId,
            } as typeof args.data
          }

          if (model in PERIOD_LOCK_MODELS) {
            const { companyId, date } = await resolvePeriodLockContext(prismaBase, model, {
              data: args.data as Record<string, unknown>,
            })
            if (companyId && date) {
              await assertPeriodUnlocked(prismaBase, companyId, date, model)
            }
          }

          if (model === "JournalEntry" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            const periodId = extractJournalEntryPeriodId(data)
            if (periodId) {
              await assertPeriodOpen(prismaBase, periodId)
            }
            const status = typeof data.status === "string" ? data.status : "DRAFT"
            const lines = extractLineInputs(data)
            if (status === "POSTED") {
              if (lines.length === 0) {
                throw new JournalEntryBalanceError("Posted journal entries must include lines.")
              }
              lines.forEach(assertLineAmounts)
              assertBalancedLines(lines)
            }
          }

          if (model === "JournalLine" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            const entryId = extractJournalEntryIdFromLine(data)
            if (entryId) {
              const entry = await prismaBase.journalEntry.findUnique({
                where: { id: entryId },
                select: { status: true, periodId: true },
              })
              if (entry?.status === "POSTED") {
                throw new JournalEntryImmutableError(entryId)
              }
              if (entry?.periodId) {
                await assertPeriodOpen(prismaBase, entry.periodId)
              }
            }
            assertLineAmounts({
              debit: data.debit,
              credit: data.credit,
            })
          }

          if (model === "CashIn" || model === "CashOut") {
            const data = args.data as Record<string, unknown>
            const companyId = data.companyId as string | undefined
            if (companyId) {
              await enforceCashTransactionCreate(prismaBase, model, data, companyId)
            }
          }

          if (model === "StockItem" && args.data && typeof args.data === "object") {
            await assertStockItemRelations(prismaBase, args.data as Record<string, unknown>)
          }

          if (model === "StockMovement" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            const movementType = data.movementType as string | undefined
            const quantity = getDecimalValue(data.quantity)
            if (movementType) {
              assertStockMovementQuantity(movementType, quantity)
            }
            await assertStockMovementRelations(prismaBase, data)
          }

          if (model === "ValuationSnapshot" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            const companyId =
              (data.companyId as string | undefined) ?? getTenantContext()?.companyId
            const valuationMethod = data.valuationMethod as string | undefined
            if (companyId && valuationMethod) {
              await assertStockValuationMethod(prismaBase, companyId, valuationMethod)
            }
          }

          const result = await query(args)

          // Audit logging for create operations
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            queueAuditLog(prismaBase, model, "CREATE", result as Record<string, unknown>)
          }

          if (model === "EInvoice" && result && typeof result === "object") {
            const event = buildInvoiceEvent(
              result as {
                id: string
                companyId: string
                status: string
                direction: string
                issueDate: Date
              }
            )
            if (event) {
              await upsertOperationalEvent(prismaBase, event)
            }
          }

          if (model === "Expense" && result && typeof result === "object") {
            const event = buildExpenseEvent(
              result as {
                id: string
                companyId: string
                status: string
                date: Date
              }
            )
            if (event) {
              await upsertOperationalEvent(prismaBase, event)
            }
          }

          if (model === "Transaction" && result && typeof result === "object") {
            const event = buildTransactionEvent(
              result as {
                id: string
                companyId: string
                direction: string
                date: Date
              }
            )
            await upsertOperationalEvent(prismaBase, event)
          }

          if (model === "FixedAsset" && result && typeof result === "object") {
            const event = buildAssetAcquisitionEvent(
              result as { id: string; companyId: string; acquisitionDate: Date }
            )
            await upsertOperationalEvent(prismaBase, event)
          }

          if (model === "DepreciationEntry" && result && typeof result === "object") {
            const event = buildAssetDepreciationEvent(
              result as { id: string; companyId: string; periodEnd: Date }
            )
            await upsertOperationalEvent(prismaBase, event)
          }

          if (model === "DisposalEvent" && result && typeof result === "object") {
            const event = buildAssetDisposalEvent(
              result as { id: string; companyId: string; disposalDate: Date }
            )
            await upsertOperationalEvent(prismaBase, event)
          }

          if (model === "StockMovement" && result && typeof result === "object") {
            const event = buildInventoryEvent(
              result as {
                id: string
                companyId: string
                movementType: string
                movementDate: Date
              }
            )
            await upsertOperationalEvent(prismaBase, event)
          }

          return result
        },
        async update({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields
          if (model === "Evidence" && args.data && typeof args.data === "object") {
            checkEvidenceImmutability(args.data as Record<string, unknown>)
          }

          if (model === "Artifact") {
            throw new ArtifactImmutabilityError("update")
          }

          // AUDIT: Capture before-state for audited models BEFORE the update
          // This is essential for complete audit trails showing what changed
          let auditBeforeState: Record<string, unknown> | null = null
          if (AUDITED_MODELS.includes(model as AuditedModel)) {
            try {
              // Use dynamic model access to fetch the current state
              const modelClient = (prismaBase as unknown as Record<string, unknown>)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ] as
                | {
                    findUnique: (args: { where: unknown }) => Promise<unknown>
                  }
                | undefined
              if (modelClient?.findUnique) {
                const existing = await modelClient.findUnique({
                  where: args.where,
                })
                if (existing && typeof existing === "object") {
                  auditBeforeState = existing as Record<string, unknown>
                }
              }
            } catch {
              // If we can't fetch before-state, continue without it
              // This allows the update to proceed while logging what we can
            }
          }

          if (model in PERIOD_LOCK_MODELS) {
            const { companyId, date } = await resolvePeriodLockContext(prismaBase, model, {
              data: args.data as Record<string, unknown>,
              where: args.where as Record<string, unknown>,
            })
            if (companyId && date) {
              await assertPeriodUnlocked(prismaBase, companyId, date, model)
            }
          }

          if (model === "EInvoice") {
            await enforceInvoiceImmutability(prismaBase, args)
          }

          if (model === "EInvoiceLine") {
            await enforceInvoiceLineImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceLineWhereInput,
              "update"
            )
          }

          // JOPPD IMMUTABILITY: Block updates on signed/submitted submissions
          if (model === "JoppdSubmission") {
            await enforceJoppdImmutability(prismaBase, args)
          }

          if (model === "JoppdSubmissionLine") {
            await enforceJoppdLineImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionLineWhereInput,
              "update"
            )
          }

          if (model === "CalculationSnapshot") {
            throw new CalculationSnapshotImmutabilityError()
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(
              prismaBase,
              args.where as Prisma.AttachmentWhereUniqueInput
            )
          }

          if (model === "Company" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            if ("stockValuationMethod" in data && data.stockValuationMethod) {
              const existing = await prismaBase.company.findUnique({
                where: args.where as Prisma.CompanyWhereUniqueInput,
                select: { id: true, stockValuationMethod: true },
              })
              const nextMethod = data.stockValuationMethod as string
              if (existing && existing.stockValuationMethod !== nextMethod) {
                await assertStockValuationMethodChange(prismaBase, existing.id)
              }
            }
          }

          if (model === "StockItem" && args.data && typeof args.data === "object") {
            const existing = await prismaBase.stockItem.findUnique({
              where: args.where as Prisma.StockItemWhereUniqueInput,
              select: { companyId: true, warehouseId: true, productId: true },
            })
            if (!existing) {
              throw new StockMovementReconciliationError("Stock item not found.")
            }
            const next = { ...existing, ...(args.data as Record<string, unknown>) }
            await assertStockItemRelations(prismaBase, next)
          }

          if (model === "StockMovement" && args.data && typeof args.data === "object") {
            const existing = await prismaBase.stockMovement.findUnique({
              where: args.where as Prisma.StockMovementWhereUniqueInput,
              select: {
                companyId: true,
                warehouseId: true,
                productId: true,
                stockItemId: true,
                movementType: true,
                quantity: true,
              },
            })
            if (!existing) {
              throw new StockMovementReconciliationError("Stock movement not found.")
            }
            const next = { ...existing, ...(args.data as Record<string, unknown>) }
            const movementType = next.movementType as string
            const quantity = getDecimalValue(next.quantity)
            assertStockMovementQuantity(movementType, quantity)
            await assertStockMovementRelations(prismaBase, next)
          }

          if (model === "ValuationSnapshot" && args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>
            const companyId =
              (data.companyId as string | undefined) ?? getTenantContext()?.companyId
            const valuationMethod = data.valuationMethod as string | undefined
            if (companyId && valuationMethod) {
              await assertStockValuationMethod(prismaBase, companyId, valuationMethod)
            }
          }

          // REGULATORY RULE STATUS TRANSITIONS: enforce allowed transitions (hard backstop)
          let operationalEvent: OperationalEventInput | null = null

          if (model === "RegulatoryRule") {
            const newStatus = getRequestedRuleStatus(args.data)

            if (newStatus) {
              // We must load the current status to validate the transition.
              const existing = await prismaBase.regulatoryRule.findUnique({
                where: args.where as Prisma.RegulatoryRuleWhereUniqueInput,
                select: { status: true },
              })

              if (!existing) {
                throw new RegulatoryRuleStatusTransitionError(
                  "Cannot transition RegulatoryRule status: rule not found."
                )
              }

              const ctx = getRegulatoryContext()
              const transition = validateStatusTransitionInternal(existing.status, newStatus, {
                source: ctx?.source,
                bypassApproval: ctx?.bypassApproval,
                systemAction: ctx?.systemAction,
              })

              if (!transition.allowed) {
                throw new RegulatoryRuleStatusTransitionError(
                  transition.error ?? "RegulatoryRule status transition not allowed."
                )
              }
            }
          }

          if (model === "EInvoice") {
            const existing = await prismaBase.eInvoice.findUnique({
              where: args.where as Prisma.EInvoiceWhereUniqueInput,
              select: { id: true, companyId: true, status: true, direction: true, issueDate: true },
            })
            const data = args.data as Record<string, unknown>
            const nextStatus = typeof data.status === "string" ? data.status : existing?.status
            if (existing && nextStatus && nextStatus !== existing.status) {
              operationalEvent = buildInvoiceEvent({
                ...existing,
                status: nextStatus,
              })
            }
          }

          if (model === "Expense") {
            const existing = await prismaBase.expense.findUnique({
              where: args.where as Prisma.ExpenseWhereUniqueInput,
              select: { id: true, companyId: true, status: true, date: true },
            })
            const data = args.data as Record<string, unknown>
            const nextStatus = typeof data.status === "string" ? data.status : existing?.status
            if (existing && nextStatus && nextStatus !== existing.status) {
              operationalEvent = buildExpenseEvent({
                ...existing,
                status: nextStatus,
              })
            }
          }

          if (model === "JournalEntry") {
            const existing = await prismaBase.journalEntry.findUnique({
              where: args.where as Prisma.JournalEntryWhereUniqueInput,
              select: { id: true, status: true, periodId: true },
            })

            if (!existing) {
              throw new JournalEntryBalanceError("JournalEntry not found.")
            }

            if (existing.status === "POSTED") {
              throw new JournalEntryImmutableError(existing.id)
            }

            const data = args.data as Record<string, unknown>
            const nextPeriodId = extractJournalEntryPeriodId(data) ?? existing.periodId
            if (nextPeriodId) {
              await assertPeriodOpen(prismaBase, nextPeriodId)
            }

            const newStatus = typeof data.status === "string" ? data.status : null
            if (newStatus === "POSTED") {
              await assertEntryBalanced(prismaBase, existing.id)
            }
          }

          if (model === "JournalLine") {
            const existing = await prismaBase.journalLine.findUnique({
              where: args.where as Prisma.JournalLineWhereUniqueInput,
              select: {
                id: true,
                debit: true,
                credit: true,
                journalEntry: { select: { id: true, status: true, periodId: true } },
              },
            })

            if (!existing) {
              throw new JournalLineAmountError("JournalLine not found.")
            }

            const entry = existing.journalEntry
            if (entry.status === "POSTED") {
              throw new JournalEntryImmutableError(entry.id)
            }

            if (entry.periodId) {
              await assertPeriodOpen(prismaBase, entry.periodId)
            }

            if (args.data && typeof args.data === "object") {
              const data = args.data as Record<string, unknown>
              const nextDebit = "debit" in data ? data.debit : existing.debit
              const nextCredit = "credit" in data ? data.credit : existing.credit
              assertLineAmounts({ debit: nextDebit, credit: nextCredit })
            }
          }

          if (model === "Payout") {
            const newStatus = getRequestedPayoutStatus(args.data)
            const existing = await prismaBase.payout.findUnique({
              where: args.where as Prisma.PayoutWhereUniqueInput,
              select: { id: true, status: true, companyId: true, payoutDate: true },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError("Cannot transition payout: payout not found.")
            }

            const nextStatus = newStatus ?? existing.status
            if (nextStatus && nextStatus !== existing.status) {
              const event = buildPayrollEvent({
                id: existing.id,
                companyId: existing.companyId,
                payoutDate: existing.payoutDate,
                status: nextStatus,
              })
              if (event) {
                operationalEvent = event
              }
            }

            if (!newStatus || newStatus === existing.status) {
              if (existing.status !== "DRAFT") {
                throw new PayoutStatusTransitionError(
                  `Cannot edit payout in ${existing.status} state. Locked payouts are immutable.`
                )
              }
            } else {
              const transition = validatePayoutTransition(existing.status, newStatus)
              if (!transition.allowed) {
                throw new PayoutStatusTransitionError(
                  transition.error ?? "Payout status transition not allowed."
                )
              }

              const allowedKeys =
                existing.status === "DRAFT" && newStatus === "LOCKED"
                  ? new Set(["status", "lockedAt", "lockedById"])
                  : new Set(["status", "reportedAt", "reportedById"])

              const disallowedKeys = Object.keys(args.data ?? {}).filter(
                (key) => !allowedKeys.has(key)
              )

              if (disallowedKeys.length > 0) {
                throw new PayoutStatusTransitionError(
                  `Payout updates during ${existing.status} → ${newStatus} may only set ${Array.from(
                    allowedKeys
                  ).join(", ")}. Disallowed: ${disallowedKeys.join(", ")}.`
                )
              }
            }
          }

          if (model === "PayoutLine") {
            const existing = await prismaBase.payoutLine.findUnique({
              where: args.where as Prisma.PayoutLineWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot edit payout line: payout line not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot edit payout lines in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "Payslip") {
            const existing = await prismaBase.payslip.findUnique({
              where: args.where as Prisma.PayslipWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError("Cannot edit payslip: payslip not found.")
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot edit payslips in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "Payslip") {
            const existing = await prismaBase.payslip.findUnique({
              where: args.where as Prisma.PayslipWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError("Cannot delete payslip: payslip not found.")
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete payslips in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "PayslipArtifact") {
            const existing = await prismaBase.payslipArtifact.findUnique({
              where: args.where as Prisma.PayslipArtifactWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot edit payslip artifact: payslip artifact not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot edit payslip artifacts in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "BankPaymentExport") {
            const existing = await prismaBase.bankPaymentExport.findUnique({
              where: args.where as Prisma.BankPaymentExportWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot edit bank payment export: export not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot edit bank payment exports in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "BankPaymentLine") {
            const existing = await prismaBase.bankPaymentLine.findUnique({
              where: args.where as Prisma.BankPaymentLineWhereUniqueInput,
              select: { export: { select: { payout: { select: { status: true } } } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot edit bank payment line: payment line not found."
              )
            }

            if (existing.export.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot edit bank payment lines in ${existing.export.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "CashDayClose") {
            throw new CashDayCloseImmutableError("update")
          }

          if (model === "CashIn" || model === "CashOut") {
            await enforceCashTransactionUpdate(prismaBase, model, {
              where: args.where,
              data: args.data,
            })
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          const result = await query(args)

          // Audit logging for update operations (with before-state for complete audit trail)
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            queueAuditLog(
              prismaBase,
              model,
              "UPDATE",
              result as Record<string, unknown>,
              auditBeforeState
            )
          }

          if (operationalEvent) {
            await upsertOperationalEvent(prismaBase, operationalEvent)
          }

          return result
        },
        async delete({ model, args, query }) {
          if (model === "Artifact") {
            throw new ArtifactImmutabilityError("delete")
          }

          if (model === "EInvoice") {
            await enforceInvoiceDeleteImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceWhereUniqueInput,
              "delete"
            )
          }

          if (model === "EInvoiceLine") {
            await enforceInvoiceLineImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceLineWhereInput,
              "delete"
            )
          }

          // JOPPD IMMUTABILITY: Block deletion of signed/submitted submissions
          if (model === "JoppdSubmission") {
            await enforceJoppdDeleteImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionWhereUniqueInput
            )
          }

          if (model === "JoppdSubmissionLine") {
            await enforceJoppdLineImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionLineWhereInput,
              "delete"
            )
          }

          if (model === "JournalEntry") {
            const existing = await prismaBase.journalEntry.findUnique({
              where: args.where as Prisma.JournalEntryWhereUniqueInput,
              select: { id: true, status: true },
            })

            if (existing?.status === "POSTED") {
              throw new JournalEntryImmutableError(existing.id)
            }
          }

          if (model === "JournalLine") {
            const existing = await prismaBase.journalLine.findUnique({
              where: args.where as Prisma.JournalLineWhereUniqueInput,
              select: { journalEntry: { select: { id: true, status: true, periodId: true } } },
            })

            if (existing?.journalEntry.status === "POSTED") {
              throw new JournalEntryImmutableError(existing.journalEntry.id)
            }

            if (existing?.journalEntry.periodId) {
              await assertPeriodOpen(prismaBase, existing.journalEntry.periodId)
            }
          }

          if (model === "CalculationSnapshot") {
            throw new CalculationSnapshotImmutabilityError()
          }

          if (model === "Payout") {
            const existing = await prismaBase.payout.findUnique({
              where: args.where as Prisma.PayoutWhereUniqueInput,
              select: { status: true },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError("Cannot delete payout: payout not found.")
            }

            if (existing.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete payout in ${existing.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "PayoutLine") {
            const existing = await prismaBase.payoutLine.findUnique({
              where: args.where as Prisma.PayoutLineWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot delete payout line: payout line not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete payout lines in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "PayslipArtifact") {
            const existing = await prismaBase.payslipArtifact.findUnique({
              where: args.where as Prisma.PayslipArtifactWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot delete payslip artifact: payslip artifact not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete payslip artifacts in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "BankPaymentExport") {
            const existing = await prismaBase.bankPaymentExport.findUnique({
              where: args.where as Prisma.BankPaymentExportWhereUniqueInput,
              select: { payout: { select: { status: true } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot delete bank payment export: export not found."
              )
            }

            if (existing.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete bank payment exports in ${existing.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "BankPaymentLine") {
            const existing = await prismaBase.bankPaymentLine.findUnique({
              where: args.where as Prisma.BankPaymentLineWhereUniqueInput,
              select: { export: { select: { payout: { select: { status: true } } } } },
            })

            if (!existing) {
              throw new PayoutStatusTransitionError(
                "Cannot delete bank payment line: payment line not found."
              )
            }

            if (existing.export.payout.status !== "DRAFT") {
              throw new PayoutStatusTransitionError(
                `Cannot delete bank payment lines in ${existing.export.payout.status} state. Locked payouts are immutable.`
              )
            }
          }

          if (model === "CashDayClose") {
            throw new CashDayCloseImmutableError("delete")
          }

          if (model === "CashIn" || model === "CashOut") {
            await enforceCashTransactionDelete(prismaBase, model, { where: args.where })
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(
              prismaBase,
              args.where as Prisma.AttachmentWhereUniqueInput
            )
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }

          if (model in PERIOD_LOCK_MODELS) {
            const { companyId, date } = await resolvePeriodLockContext(prismaBase, model, {
              where: args.where as Record<string, unknown>,
            })
            if (companyId && date) {
              await assertPeriodUnlocked(prismaBase, companyId, date, model)
            }
          }

          const result = await query(args)

          // Audit logging for delete operations
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            queueAuditLog(prismaBase, model, "DELETE", result as Record<string, unknown>)
          }

          return result
        },
        // === Missing operations for full tenant isolation ===
        async createMany({ model, args, query }) {
          if (model === "CashDayClose") {
            throw new CashBulkMutationNotAllowedError(model, "createMany")
          }

          if (model === "CashIn" || model === "CashOut") {
            throw new CashBulkMutationNotAllowedError(model, "createMany")
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            // Add companyId to each record being created
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: Record<string, unknown>) => ({
                ...item,
                companyId: context.companyId,
              })) as typeof args.data
            } else {
              args.data = {
                ...args.data,
                companyId: context.companyId,
              }
            }
          }

          if (model in PERIOD_LOCK_MODELS) {
            const entries = Array.isArray(args.data) ? args.data : [args.data]
            for (const entry of entries) {
              const { companyId, date } = await resolvePeriodLockContext(prismaBase, model, {
                data: entry as Record<string, unknown>,
              })
              if (companyId && date) {
                await assertPeriodUnlocked(prismaBase, companyId, date, model)
              }
            }
          }

          return query(args)
        },
        async updateMany({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields
          if (model === "Evidence" && args.data && typeof args.data === "object") {
            checkEvidenceImmutability(args.data as Record<string, unknown>)
          }

          if (model === "Artifact") {
            throw new ArtifactImmutabilityError("updateMany")
          }

          await enforcePeriodLockForBulk(prismaBase, model, {
            where: args.where as Record<string, unknown>,
          })

          if (model === "EInvoice") {
            await enforceInvoiceUpdateManyImmutability(prismaBase, {
              where: args.where as Prisma.EInvoiceWhereInput,
              data: args.data as Record<string, unknown>,
            })
          }

          if (model === "EInvoiceLine") {
            await enforceInvoiceLineImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceLineWhereInput,
              "update"
            )
          }

          // JOPPD IMMUTABILITY: Block updateMany on signed/submitted submissions
          if (model === "JoppdSubmission") {
            await enforceJoppdUpdateManyImmutability(prismaBase, {
              where: args.where as Prisma.JoppdSubmissionWhereInput,
              data: args.data as Record<string, unknown>,
            })
          }

          if (model === "JoppdSubmissionLine") {
            await enforceJoppdLineImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionLineWhereInput,
              "update"
            )
          }

          if (model === "CalculationSnapshot") {
            throw new CalculationSnapshotImmutabilityError()
          }

          if (model === "Payout") {
            const newStatus = getRequestedPayoutStatus(args.data)
            if (newStatus) {
              throw new PayoutStatusTransitionError(
                "Cannot update Payout.status using updateMany. Use explicit status transition methods."
              )
            }
          }

          if (
            model === "PayoutLine" ||
            model === "Payslip" ||
            model === "PayslipArtifact" ||
            model === "BankPaymentExport" ||
            model === "BankPaymentLine"
          ) {
            throw new PayoutStatusTransitionError(
              "Cannot update payout lines, payslips, bank payment exports, or payslip artifacts using updateMany. Use per-record updates."
            )
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(prismaBase, args.where as Prisma.AttachmentWhereInput)
          }

          // REGULATORY RULE: forbid updateMany for status transitions
          // updateMany bypasses per-rule validation (conflicts, provenance, tier checks)
          if (model === "RegulatoryRule") {
            const newStatus = getRequestedRuleStatus(args.data)
            if (newStatus) {
              throw new RegulatoryRuleUpdateManyStatusNotAllowedError()
            }
          }

          if (model === "CashDayClose") {
            throw new CashDayCloseImmutableError("updateMany")
          }

          if (model === "CashIn" || model === "CashOut") {
            throw new CashBulkMutationNotAllowedError(model, "updateMany")
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async deleteMany({ model, args, query }) {
          if (model === "Artifact") {
            throw new ArtifactImmutabilityError("deleteMany")
          }

          if (model === "EInvoice") {
            const lockedInvoice = await prismaBase.eInvoice.findFirst({
              where: {
                ...(args.where as Prisma.EInvoiceWhereInput),
                status: { not: "DRAFT" },
              },
              select: { id: true, status: true },
            })

            if (lockedInvoice) {
              throw new InvoiceImmutabilityError(
                `Cannot delete invoice ${lockedInvoice.id} in status ${lockedInvoice.status}. Use a credit note for corrections.`
              )
            }
          }

          if (model === "EInvoiceLine") {
            await enforceInvoiceLineImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceLineWhereInput,
              "delete"
            )
          }

          // JOPPD IMMUTABILITY: Block deleteMany on signed/submitted submissions
          if (model === "JoppdSubmission") {
            const lockedSubmission = await prismaBase.joppdSubmission.findFirst({
              where: {
                ...(args.where as Prisma.JoppdSubmissionWhereInput),
                OR: [
                  { status: { in: ["SUBMITTED", "ACCEPTED", "REJECTED"] } },
                  { signedXmlStorageKey: { not: null } },
                ],
              },
              select: { id: true, status: true },
            })

            if (lockedSubmission) {
              throw new JoppdImmutabilityError(
                `Cannot delete JOPPD ${lockedSubmission.id} in status ${lockedSubmission.status}. ` +
                  "Use a correction submission instead."
              )
            }
          }

          if (model === "JoppdSubmissionLine") {
            await enforceJoppdLineImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionLineWhereInput,
              "delete"
            )
          }

          if (model === "CalculationSnapshot") {
            throw new CalculationSnapshotImmutabilityError()
          }

          if (
            model === "PayoutLine" ||
            model === "Payslip" ||
            model === "PayslipArtifact" ||
            model === "BankPaymentExport" ||
            model === "BankPaymentLine"
          ) {
            throw new PayoutStatusTransitionError(
              "Cannot delete payout lines, payslips, bank payment exports, or payslip artifacts in bulk. Use per-record deletes."
            )
          }

          if (model === "CashDayClose") {
            throw new CashDayCloseImmutableError("deleteMany")
          }

          if (model === "CashIn" || model === "CashOut") {
            throw new CashBulkMutationNotAllowedError(model, "deleteMany")
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(prismaBase, args.where as Prisma.AttachmentWhereInput)
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }

          await enforcePeriodLockForBulk(prismaBase, model, {
            where: args.where as Record<string, unknown>,
          })

          return query(args)
        },
        async upsert({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields in upsert
          if (model === "Evidence" && args.update && typeof args.update === "object") {
            checkEvidenceImmutability(args.update as Record<string, unknown>)
          }

          if (model === "Artifact") {
            throw new ArtifactImmutabilityError("upsert")
          }

          // AUDIT: Capture before-state for audited models BEFORE the upsert
          // If record exists (update case), we need the before-state for audit trail
          let upsertBeforeState: Record<string, unknown> | null = null
          if (AUDITED_MODELS.includes(model as AuditedModel)) {
            try {
              const modelClient = (prismaBase as unknown as Record<string, unknown>)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ] as
                | {
                    findUnique: (args: { where: unknown }) => Promise<unknown>
                  }
                | undefined
              if (modelClient?.findUnique) {
                const existing = await modelClient.findUnique({
                  where: args.where,
                })
                if (existing && typeof existing === "object") {
                  upsertBeforeState = existing as Record<string, unknown>
                }
              }
            } catch {
              // If we can't fetch before-state, continue without it
            }
          }

          if (model in PERIOD_LOCK_MODELS) {
            const { companyId, date } = await resolvePeriodLockContext(prismaBase, model, {
              data: args.update as Record<string, unknown>,
              where: args.where as Record<string, unknown>,
            })
            if (companyId && date) {
              await assertPeriodUnlocked(prismaBase, companyId, date, model)
            }
          }

          if (model === "EInvoice") {
            await enforceInvoiceImmutability(prismaBase, {
              where: args.where as Prisma.EInvoiceWhereUniqueInput,
              data: args.update as Record<string, unknown>,
            })
          }

          if (model === "EInvoiceLine") {
            await enforceInvoiceLineImmutability(
              prismaBase,
              args.where as Prisma.EInvoiceLineWhereInput,
              "update"
            )
          }

          // JOPPD IMMUTABILITY: Block upsert updates on signed/submitted submissions
          if (model === "JoppdSubmission") {
            await enforceJoppdImmutability(prismaBase, {
              where: args.where as Prisma.JoppdSubmissionWhereUniqueInput,
              data: args.update as Record<string, unknown>,
            })
          }

          if (model === "JoppdSubmissionLine") {
            await enforceJoppdLineImmutability(
              prismaBase,
              args.where as Prisma.JoppdSubmissionLineWhereInput,
              "update"
            )
          }

          if (model === "CalculationSnapshot") {
            throw new CalculationSnapshotImmutabilityError()
          }

          if (model === "CashDayClose") {
            throw new CashDayCloseImmutableError("upsert")
          }

          if (model === "CashIn" || model === "CashOut") {
            const existing = await getCashRecord(
              prismaBase,
              model,
              args.where as Prisma.CashInWhereUniqueInput
            )

            if (existing) {
              await enforceCashTransactionUpdate(prismaBase, model, {
                where: args.where,
                data: args.update,
              })
            } else {
              const data = args.create as Record<string, unknown>
              const context = getTenantContext()
              const companyId = (data.companyId ?? context?.companyId) as string | undefined
              if (companyId) {
                await enforceCashTransactionCreate(prismaBase, model, data, companyId)
              }
            }
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(
              prismaBase,
              args.where as Prisma.AttachmentWhereUniqueInput
            )
          }

          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            // Add tenant filter to where clause
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
            // Add companyId to create data
            args.create = {
              ...args.create,
              companyId: context.companyId,
            } as typeof args.create
            // Note: update data doesn't need companyId as it can't change
          }
          const result = await query(args)

          // Audit logging for upsert operations
          // If before-state existed, this was an UPDATE; otherwise it was a CREATE
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            const action = upsertBeforeState ? "UPDATE" : "CREATE"
            queueAuditLog(
              prismaBase,
              model,
              action,
              result as Record<string, unknown>,
              upsertBeforeState
            )
          }

          return result
        },
        async count({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async aggregate({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async groupBy({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
      },
    },
  })
}
