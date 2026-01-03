// src/lib/db/core.ts
// OWNER: Prisma (core client)
// This is the primary Prisma client for tenant-scoped business data.
// Uses DATABASE_URL and includes tenant isolation middleware.

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { withTenantIsolation } from "../prisma-extensions"

// Global singleton for core database pool and client
const globalForCore = globalThis as unknown as {
  corePool: Pool | undefined
  coreClient: ReturnType<typeof withTenantIsolation> | undefined
}

// Core database pool - tenant-scoped business data
const corePool = globalForCore.corePool ?? new Pool({ connectionString: process.env.DATABASE_URL })

// Base Prisma client with pg adapter
const basePrisma = new PrismaClient({ adapter: new PrismaPg(corePool) })

// Extended client with tenant isolation
const db = globalForCore.coreClient ?? withTenantIsolation(basePrisma)

// Cache in development to survive hot-reload
if (process.env.NODE_ENV !== "production") {
  globalForCore.corePool = corePool
  globalForCore.coreClient = db
}

/**
 * Extended Prisma client type with tenant isolation
 * Use this instead of PrismaClient for proper type inference
 */
export type ExtendedPrismaClient = typeof db

/**
 * Transaction client type for use within db.$transaction callbacks
 * In Prisma 7+, the transaction callback receives the same extended client type
 * but with $transaction and other methods omitted
 *
 * Usage:
 *   import { db, type TransactionClient } from "@/lib/db"
 *   function myHelper(tx: TransactionClient) { ... }
 *   await db.$transaction(async (tx) => { myHelper(tx) })
 */
export type TransactionClient = Parameters<Parameters<ExtendedPrismaClient["$transaction"]>[0]>[0]

// Export core client
export { db }

// Re-export tenant context utilities from prisma-extensions
export {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  runWithRegulatoryContext,
  getRegulatoryContext,
  RegulatoryRuleStatusTransitionError,
  RegulatoryRuleUpdateManyStatusNotAllowedError,
  AccountingPeriodLockedError,
} from "../prisma-extensions"

export type {
  TenantContext,
  RegulatoryTransitionContext,
  RegulatorySystemAction,
} from "../prisma-extensions"
