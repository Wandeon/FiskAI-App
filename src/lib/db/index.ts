// src/lib/db/index.ts
// Central export point for database clients
//
// USAGE RULES:
// - Business/tenant code: import { db } from "@/lib/db"
// - Drizzle code: import { drizzleDb } from "@/lib/db/drizzle"
//
// NOTE: Regulatory database access has been moved to fiskai-intelligence repo.
// Accounting app must use Intelligence API for regulatory data.

// Core Prisma client (with tenant isolation)
export { db } from "./core"
export type { ExtendedPrismaClient, TransactionClient } from "./core"

// Backwards compatibility alias
import { db } from "./core"
export const prisma = db

// Re-export tenant context utilities for convenience
export {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  AccountingPeriodLockedError,
} from "./core"

export type { TenantContext } from "./core"
