// src/lib/prisma-extensions.ts
import { PrismaClient } from "@prisma/client"

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
const TENANT_MODELS = ["Contact", "Product", "EInvoice", "EInvoiceLine"] as const

// Extension to automatically add companyId filter to queries
export function withTenantIsolation(prisma: PrismaClient) {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args.data = {
              ...args.data,
              companyId: context.companyId,
            } as any
          }
          return query(args)
        },
        async update({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async delete({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as typeof TENANT_MODELS[number])) {
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
