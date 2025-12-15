import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { withTenantIsolation } from './prisma-extensions'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withTenantIsolation> | undefined
  pool: Pool | undefined
}

const pool = globalForPrisma.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
const basePrisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const db = globalForPrisma.prisma ?? withTenantIsolation(basePrisma)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.pool = pool
}

export { db }
export { setTenantContext, getTenantContext, runWithTenant } from './prisma-extensions'
export type { TenantContext } from './prisma-extensions'
