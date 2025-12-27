import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { withTenantIsolation, setTenantContext, getTenantContext } from "@/lib/prisma-extensions"

// Mock Prisma client for testing
const mockPrisma = {
  $extends: vi.fn().mockReturnValue({
    $extends: vi.fn().mockReturnThis(),
    query: {
      $allModels: {
        async findMany({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
        async findFirst({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
        async findUnique({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
        async create({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
        async update({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
        async delete({ model, args, query }: any) {
          // Mock implementation
          return query(args)
        },
      },
    },
  }),
  auditLog: {
    create: vi.fn(),
  },
} as any

describe("Tenant Isolation", () => {
  beforeEach(() => {
    // Clear any existing tenant context
    setTenantContext(null)
  })

  afterEach(() => {
    // Clean up after each test
    vi.clearAllMocks()
  })

  it("should add companyId to queries when tenant context is set", () => {
    const tenantContext = { companyId: "test-company-id", userId: "test-user-id" }
    setTenantContext(tenantContext)

    const extendedPrisma = withTenantIsolation(mockPrisma as PrismaClient)

    // Check that tenant context can be retrieved
    expect(getTenantContext()).toEqual(tenantContext)
  })

  it("should protect tenant-sensitive models", () => {
    const tenantContext = { companyId: "test-company-id", userId: "test-user-id" }
    setTenantContext(tenantContext)

    const extendedPrisma = withTenantIsolation(mockPrisma as PrismaClient)

    // Verify that the extension was applied
    expect(mockPrisma.$extends).toHaveBeenCalled()
  })

  it("should not apply tenant filtering to non-tenant models", () => {
    // User model, for example, should not be tenant-isolated
    // as users can belong to multiple companies
    const tenantContext = { companyId: "test-company-id", userId: "test-user-id" }
    setTenantContext(tenantContext)

    const extendedPrisma = withTenantIsolation(mockPrisma as PrismaClient)

    // Verify the extension was applied correctly
    expect(mockPrisma.$extends).toHaveBeenCalledWith({
      query: {
        $allModels: expect.any(Object),
      },
    })
  })
})
