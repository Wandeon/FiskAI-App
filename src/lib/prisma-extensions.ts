// src/lib/prisma-extensions.ts
import { PrismaClient, AuditAction, Prisma } from "@prisma/client"
import { AsyncLocalStorage } from "node:async_hooks"

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

// Models that require tenant filtering
const TENANT_MODELS = [
  "Contact",
  "Product",
  "EInvoice",
  "EInvoiceLine",
  "AuditLog",
  "CashIn",
  "CashOut",
  "CashDayClose",
  "BankAccount",
  "BankTransaction",
  "BankImport",
  "ImportJob",
  "Statement",
  "StatementPage",
  "Transaction",
  "Expense",
  "ExpenseLine",
  "UraInput",
  "Attachment",
  "ExpenseCorrection",
  "FixedAssetCandidate",
  "ExpenseCategory",
  "RecurringExpense",
  "SavedReport",
  "SupportTicket",
  "SupportTicketMessage",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  "Employee",
  "EmployeeRole",
  "EmploymentContract",
  "EmploymentContractVersion",
  "EmploymentTerminationEvent",
  "Dependent",
  "Allowance",
  "PensionPillar",
  // Note: CompanyUser intentionally NOT included - it's filtered by userId, not companyId
  // Including it breaks getCurrentCompany() which queries CompanyUser before tenant context exists
] as const

// Models to audit (exclude AuditLog itself to prevent infinite loops)
const AUDITED_MODELS = [
  "Contact",
  "Product",
  "EInvoice",
  "Company",
  "CashIn",
  "CashOut",
  "CashDayClose",
  "BankAccount",
  "Expense",
  "ExpenseLine",
  "UraInput",
  "Attachment",
  "ExpenseCorrection",
  "FixedAssetCandidate",
  "ExpenseCategory",
  "RecurringExpense",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  "SupportTicket",
] as const
type AuditedModel = (typeof AUDITED_MODELS)[number]

// ============================================
// EVIDENCE IMMUTABILITY PROTECTION
// ============================================
// Evidence.rawContent is the source of truth for the regulatory chain.
// Once created, it MUST NOT be modified to preserve audit integrity.

const EVIDENCE_IMMUTABLE_FIELDS = ["rawContent", "contentHash", "fetchedAt"] as const

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

function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(value ?? 0)
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
  action: AuditAction
  entity: string
  entityId: string
  changes: Record<string, unknown> | null
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
            action: item.action,
            entity: item.entity,
            entityId: item.entityId,
            changes: item.changes as Record<string, never> | undefined,
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
  result: Record<string, unknown>
) {
  const companyId = result.companyId as string
  const entityId = result.id as string
  const context = getTenantContext()

  if (!companyId || !entityId) return

  // Create a JSON-serializable changes object
  const changes: Record<string, unknown> =
    action === "DELETE"
      ? { before: JSON.parse(JSON.stringify(result)) }
      : { after: JSON.parse(JSON.stringify(result)) }

  auditQueue.push({
    companyId,
    userId: context?.userId ?? null,
    action,
    entity: model,
    entityId,
    changes,
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

          if (model === "CashIn" || model === "CashOut") {
            const data = args.data as Record<string, unknown>
            const companyId = data.companyId as string | undefined
            if (companyId) {
              await enforceCashTransactionCreate(prismaBase, model, data, companyId)
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

          return result
        },
        async update({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields
          if (model === "Evidence" && args.data && typeof args.data === "object") {
            checkEvidenceImmutability(args.data as Record<string, unknown>)
          }

          if (model === "Attachment") {
            await ensureAttachmentMutable(
              prismaBase,
              args.where as Prisma.AttachmentWhereUniqueInput
            )
          }

          // REGULATORY RULE STATUS TRANSITIONS: enforce allowed transitions (hard backstop)
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

          // Audit logging for update operations
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            queueAuditLog(prismaBase, model, "UPDATE", result as Record<string, unknown>)
          }

          return result
        },
        async delete({ model, args, query }) {
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
          return query(args)
        },
        async updateMany({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields
          if (model === "Evidence" && args.data && typeof args.data === "object") {
            checkEvidenceImmutability(args.data as Record<string, unknown>)
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
          return query(args)
        },
        async upsert({ model, args, query }) {
          // EVIDENCE IMMUTABILITY: Block updates to immutable fields in upsert
          if (model === "Evidence" && args.update && typeof args.update === "object") {
            checkEvidenceImmutability(args.update as Record<string, unknown>)
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
          if (
            AUDITED_MODELS.includes(model as AuditedModel) &&
            result &&
            typeof result === "object"
          ) {
            queueAuditLog(prismaBase, model, "UPDATE", result as Record<string, unknown>)
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
