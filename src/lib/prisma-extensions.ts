// src/lib/prisma-extensions.ts
import { PrismaClient, AuditAction } from "@prisma/client"

// Context for current request
export type TenantContext = {
  companyId: string
  userId: string
}

// Global variable to hold current tenant context (set per-request)
let currentTenantContext: TenantContext | null = null

export function setTenantContext(context: TenantContext | null) {
  currentTenantContext = context
}

export function getTenantContext(): TenantContext | null {
  return currentTenantContext
}

// Models that require tenant filtering
const TENANT_MODELS = ["Contact", "Product", "EInvoice", "EInvoiceLine", "AuditLog", "BankAccount", "BankTransaction", "BankImport"] as const

// Models to audit (exclude AuditLog itself to prevent infinite loops)
const AUDITED_MODELS = ["Contact", "Product", "EInvoice", "Company", "BankAccount"] as const
type AuditedModel = typeof AUDITED_MODELS[number]

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
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
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
          if (context && result && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            if ((result as { companyId?: string }).companyId !== context.companyId) {
              return null // Hide records from other tenants
            }
          }
          return result
        },
        async create({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            args.data = {
              ...args.data,
              companyId: context.companyId,
            } as typeof args.data
          }
          const result = await query(args)

          // Audit logging for create operations
          if (AUDITED_MODELS.includes(model as AuditedModel) && result && typeof result === "object") {
            queueAuditLog(prismaBase, model, "CREATE", result as Record<string, unknown>)
          }

          return result
        },
        async update({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          const result = await query(args)

          // Audit logging for update operations
          if (AUDITED_MODELS.includes(model as AuditedModel) && result && typeof result === "object") {
            queueAuditLog(prismaBase, model, "UPDATE", result as Record<string, unknown>)
          }

          return result
        },
        async delete({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          const result = await query(args)

          // Audit logging for delete operations
          if (AUDITED_MODELS.includes(model as AuditedModel) && result && typeof result === "object") {
            queueAuditLog(prismaBase, model, "DELETE", result as Record<string, unknown>)
          }

          return result
        },
      },
    },
  })
}
