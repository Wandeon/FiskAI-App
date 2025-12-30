import { getContext } from "./context"
import { getAuditContext } from "./audit-context"
import { computeAuditChecksum } from "./audit-utils"
import { logger } from "./logger"

// Entities to audit - add more as needed
const AUDITED_MODELS = [
  "EInvoice",
  "Contact",
  "Organization",
  "Address",
  "TaxIdentity",
  "Product",
  "Company",
  "EInvoiceLine",
  "Expense",
  "BankTransaction",
  "Person",
  "PersonContactRole",
  "PersonEmployeeRole",
  "PersonDirectorRole",
]

// Map Prisma actions to our AuditAction enum
const ACTION_MAP: Record<string, "CREATE" | "UPDATE" | "DELETE"> = {
  create: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
  createMany: "CREATE",
  updateMany: "UPDATE",
  deleteMany: "DELETE",
  upsert: "UPDATE",
}

interface AuditQueueItem {
  companyId: string
  userId: string | null
  actor: string
  action: "CREATE" | "UPDATE" | "DELETE"
  entity: string
  entityId: string
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null
  reason: string
  timestamp: Date
  checksum: string
}

// Prisma middleware types for v7+
type MiddlewareParams = {
  model?: string
  action: string
  args: unknown
  dataPath: string[]
  runInTransaction: boolean
}

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>

// Queue for batch processing - avoid circular import issues
const auditQueue: AuditQueueItem[] = []
let isProcessing = false

async function processAuditQueue() {
  if (isProcessing || auditQueue.length === 0) return
  isProcessing = true

  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import("./db")

    while (auditQueue.length > 0) {
      const item = auditQueue.shift()
      if (!item) continue

      try {
        await db.auditLog.create({
          data: {
            companyId: item.companyId,
            userId: item.userId,
            actor: item.actor,
            action: item.action,
            entity: item.entity,
            entityId: item.entityId,
            changes: item.changes ?? undefined,
            reason: item.reason,
            checksum: item.checksum,
            timestamp: item.timestamp,
          },
        })
      } catch (error) {
        logger.error(
          { error, entity: item.entity, entityId: item.entityId },
          "Failed to create audit log"
        )
      }
    }
  } finally {
    isProcessing = false
  }
}

/**
 * Prisma middleware that automatically logs CREATE, UPDATE, DELETE operations
 * for specified models. Uses a queue to avoid blocking the main operation.
 */
export const auditMiddleware = async (params: MiddlewareParams, next: MiddlewareNext) => {
  // Skip if not an audited model or action
  if (!params.model || !AUDITED_MODELS.includes(params.model)) {
    return next(params)
  }

  const action = ACTION_MAP[params.action]
  if (!action) {
    return next(params)
  }

  // Execute the operation first
  const result = await next(params)

  // Skip if no result (e.g., deleteMany with no matches)
  if (!result) {
    return result
  }

  // Get user context from AsyncLocalStorage
  const ctx = getContext()
  const userId = ctx?.userId ?? null
  const auditContext = getAuditContext()
  const actor = auditContext?.actorId ?? userId ?? "system"
  const reason = auditContext?.reason ?? "unspecified"
  const timestamp = new Date()

  // Helper to queue an audit item
  const queueAuditItem = (
    companyId: string,
    entityId: string,
    changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null
  ) => {
    auditQueue.push({
      companyId,
      userId,
      actor,
      action,
      entity: params.model!,
      entityId,
      changes,
      reason,
      timestamp,
      checksum: computeAuditChecksum({
        actor,
        action,
        entity: params.model!,
        entityId,
        reason,
        timestamp: timestamp.toISOString(),
      }),
    })
  }

  // Handle different result types
  if (Array.isArray(result)) {
    // Batch operations - log each item
    for (const item of result) {
      if (typeof item === "object" && item !== null) {
        const companyId = (item as Record<string, unknown>).companyId as string
        const entityId = (item as Record<string, unknown>).id as string
        if (companyId && entityId) {
          queueAuditItem(
            companyId,
            entityId,
            action === "CREATE" ? { after: item as Record<string, unknown> } : null
          )
        }
      }
    }
  } else if (typeof result === "object" && result !== null) {
    const companyId = (result as Record<string, unknown>).companyId as string
    const entityId = (result as Record<string, unknown>).id as string

    if (companyId && entityId) {
      const changes =
        action === "DELETE"
          ? { before: result as Record<string, unknown> }
          : { after: result as Record<string, unknown> }
      queueAuditItem(companyId, entityId, changes)
    }
  }

  // Process queue asynchronously (fire and forget)
  processAuditQueue().catch((err) => logger.error({ err }, "Audit queue processing failed"))

  return result
}
