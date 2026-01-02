import { PrismaClient } from "@prisma/client"
import { TenantScopedContext, TenantIdentity } from "@/infrastructure/shared/TenantScopedContext"

export interface TestContextConfig {
  companyId?: string
  userId?: string
  poreznaBaseUrl?: string
}

// Extended PrismaClient type for test configuration
interface TestPrismaClient extends PrismaClient {
  __testConfig?: TestContextConfig
}

export function createTestContext(config: TestContextConfig = {}): TenantScopedContext {
  const identity: TenantIdentity = {
    companyId: config.companyId ?? "test-company",
    userId: config.userId ?? "test-user",
    correlationId: `test-${Date.now()}`,
  }

  const prisma = new PrismaClient() as TestPrismaClient

  // Store config for services to access
  prisma.__testConfig = {
    poreznaBaseUrl: config.poreznaBaseUrl,
  }

  return new TenantScopedContext(identity, prisma)
}

export function getTestConfig(prisma: PrismaClient): TestContextConfig {
  return (prisma as TestPrismaClient).__testConfig ?? {}
}
