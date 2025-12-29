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

export { db, prisma }
export {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  runWithRegulatoryContext,
  getRegulatoryContext,
  RegulatoryRuleStatusTransitionError,
  RegulatoryRuleUpdateManyStatusNotAllowedError,
} from "./prisma-extensions"
export type {
  TenantContext,
  RegulatoryTransitionContext,
  RegulatorySystemAction,
} from "./prisma-extensions"
