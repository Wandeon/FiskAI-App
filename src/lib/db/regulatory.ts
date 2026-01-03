// src/lib/db/regulatory.ts
// OWNER: Prisma (regulatory client)
// This is the Prisma client for the Regulatory Truth Layer (RTL).
// Uses REGULATORY_DATABASE_URL and has NO tenant isolation.
// RTL tables are system-wide, not tenant-scoped.

import { PrismaClient } from "../../generated/regulatory-client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Global singleton for regulatory database pool and client
const globalForRegulatory = globalThis as unknown as {
  regulatoryPool: Pool | undefined
  regulatoryClient: PrismaClient | undefined
}

// Regulatory database pool - separate from core to prevent resource contention
// RTL can run heavy queries (evidence scans, claim joins) that shouldn't starve core
const regulatoryPool =
  globalForRegulatory.regulatoryPool ??
  new Pool({
    connectionString: process.env.REGULATORY_DATABASE_URL || process.env.DATABASE_URL,
  })

// Regulatory Prisma client - NO tenant isolation
// RTL tables don't have companyId, they're system-wide
const dbReg =
  globalForRegulatory.regulatoryClient ??
  new PrismaClient({ adapter: new PrismaPg(regulatoryPool) })

// Cache in development to survive hot-reload
if (process.env.NODE_ENV !== "production") {
  globalForRegulatory.regulatoryPool = regulatoryPool
  globalForRegulatory.regulatoryClient = dbReg
}

/**
 * Regulatory Prisma client type
 * No tenant isolation - RTL is system-wide
 */
export type RegulatoryPrismaClient = typeof dbReg

/**
 * Transaction client type for regulatory transactions
 */
export type RegulatoryTransactionClient = Parameters<
  Parameters<RegulatoryPrismaClient["$transaction"]>[0]
>[0]

// Export regulatory client
export { dbReg }
