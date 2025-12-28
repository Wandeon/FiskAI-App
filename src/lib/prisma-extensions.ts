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
  "BankAccount",
  "BankTransaction",
  "BankImport",
  "ImportJob",
  "Statement",
  "StatementPage",
  "Transaction",
  "Expense",
  "ExpenseCategory",
  "RecurringExpense",
  "SavedReport",
  "SupportTicket",
  "SupportTicketMessage",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  // Note: CompanyUser intentionally NOT included - it's filtered by userId, not companyId
  // Including it breaks getCurrentCompany() which queries CompanyUser before tenant context exists
] as const

// Models to audit (exclude AuditLog itself to prevent infinite loops)
const AUDITED_MODELS = [
  "Contact",
  "Product",
  "EInvoice",
  "Company",
  "BankAccount",
  "Expense",
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

/**
 * Safely extract status from update data if present.
 */
function getRequestedRuleStatus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const s = d.status
  if (typeof s !== "string") return null
  return s
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

          // REGULATORY RULE: forbid updateMany for status transitions
          // updateMany bypasses per-rule validation (conflicts, provenance, tier checks)
          if (model === "RegulatoryRule") {
            const newStatus = getRequestedRuleStatus(args.data)
            if (newStatus) {
              throw new RegulatoryRuleUpdateManyStatusNotAllowedError()
            }
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
