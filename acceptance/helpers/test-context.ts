import { existsSync } from "fs"
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { TenantScopedContext, TenantIdentity } from "@/infrastructure/shared/TenantScopedContext"

// Load environment variables (same pattern as prisma.config.ts)
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
} else if (existsSync(".env")) {
  config({ path: ".env" })
}

export interface TestContextConfig {
  companyId?: string
  userId?: string
  poreznaBaseUrl?: string
}

// Extended PrismaClient type for test configuration
interface TestPrismaClient extends PrismaClient {
  __testConfig?: TestContextConfig
}

// Shared pool for test contexts
let sharedPool: Pool | null = null

function getPool(): Pool {
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return sharedPool
}

export function createTestContext(config: TestContextConfig = {}): TenantScopedContext {
  const identity: TenantIdentity = {
    companyId: config.companyId ?? "test-company",
    userId: config.userId ?? "test-user",
    correlationId: `test-${Date.now()}`,
  }

  const pool = getPool()
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter }) as TestPrismaClient

  // Store config for services to access
  prisma.__testConfig = {
    poreznaBaseUrl: config.poreznaBaseUrl,
  }

  return new TenantScopedContext(identity, prisma)
}

export function getTestConfig(prisma: PrismaClient): TestContextConfig {
  return (prisma as TestPrismaClient).__testConfig ?? {}
}
