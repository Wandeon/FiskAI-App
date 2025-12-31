import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { withTenantIsolation } from "./prisma-extensions"

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withTenantIsolation> | undefined
  pool: Pool | undefined
}

const pool = globalForPrisma.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
const basePrisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const db = globalForPrisma.prisma ?? withTenantIsolation(basePrisma)

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
  globalForPrisma.pool = pool
}

// Alias for backwards compatibility with experiments module (fixes #926)
const prisma = db

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

export { db, prisma }
export {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  runWithRegulatoryContext,
  getRegulatoryContext,
  RegulatoryRuleStatusTransitionError,
  RegulatoryRuleUpdateManyStatusNotAllowedError,
  AccountingPeriodLockedError,
} from "./prisma-extensions"
export type {
  TenantContext,
  RegulatoryTransitionContext,
  RegulatorySystemAction,
} from "./prisma-extensions"
