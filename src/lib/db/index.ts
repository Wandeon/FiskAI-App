// src/lib/db/index.ts
// Central export point for database clients
//
// USAGE RULES:
// - Business/tenant code: import { db } from "@/lib/db"
// - RTL/regulatory code: import { dbReg } from "@/lib/db"
// - Drizzle code: import { drizzleDb } from "@/lib/db/drizzle"
//
// DO NOT:
// - Import db in RTL modules (src/lib/regulatory-truth/**)
// - Import dbReg in business modules (src/app/**, etc.)

// Core Prisma client (with tenant isolation)
export { db } from "./core"
export type { ExtendedPrismaClient, TransactionClient } from "./core"

// Backwards compatibility alias
import { db } from "./core"
export const prisma = db

// Regulatory Prisma client (no tenant isolation)
export { dbReg } from "./regulatory"
export type { RegulatoryPrismaClient, RegulatoryTransactionClient } from "./regulatory"

// Re-export tenant context utilities for convenience
export {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  runWithRegulatoryContext,
  getRegulatoryContext,
  RegulatoryRuleStatusTransitionError,
  RegulatoryRuleUpdateManyStatusNotAllowedError,
  AccountingPeriodLockedError,
} from "./core"

export type { TenantContext, RegulatoryTransitionContext, RegulatorySystemAction } from "./core"
