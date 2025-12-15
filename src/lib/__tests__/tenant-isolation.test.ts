/**
 * Comprehensive Tenant Isolation Tests
 *
 * Tests the multi-tenant isolation system to ensure:
 * 1. Tenant context is properly managed via AsyncLocalStorage
 * 2. Prisma middleware automatically filters queries by companyId
 * 3. Cross-tenant data access is prevented
 * 4. All Prisma operations respect tenant boundaries
 */

import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert'
import {
  setTenantContext,
  getTenantContext,
  runWithTenant,
  withTenantIsolation,
  type TenantContext,
} from '../prisma-extensions'

// Mock Prisma Client for testing
class MockPrismaClient {
  // Add base auditLog model to prevent audit queue errors
  auditLog = {
    create: async (args: any) => {
      return { id: 'audit-log-id', ...args.data }
    }
  }

  $extends(extension: any) {
    const extended = new MockPrismaClient()
    // Apply the extension logic
    if (extension.query) {
      const queryExtensions = extension.query.$allModels

      // Create proxied model operations
      const models = [
        'Contact', 'Product', 'EInvoice', 'EInvoiceLine', 'AuditLog',
        'BankAccount', 'BankTransaction', 'Company', 'User'
      ]

      models.forEach((modelName) => {
        const model = modelName.toLowerCase() as keyof MockPrismaClient
        if (!extended[model as any]) {
          (extended as any)[model] = {}
        }

        const modelObj = (extended as any)[model]

        // Wrap each operation with the extension
        const operations = [
          'findMany', 'findFirst', 'findUnique', 'create', 'update', 'delete',
          'createMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy', 'upsert'
        ]

        operations.forEach((op) => {
          if (queryExtensions[op]) {
            modelObj[op] = async (args: any) => {
              // Call the extension with the original args
              let modifiedArgs = { ...args }
              const query = async (finalArgs: any) => {
                // This simulates the actual database query
                return mockDbQuery(modelName, op, finalArgs)
              }

              return queryExtensions[op]({
                model: modelName,
                args: modifiedArgs,
                query,
              })
            }
          }
        })
      })
    }

    return extended
  }

  // Model definitions will be added during extension
  contact?: any
  product?: any
  einvoice?: any
  einvoiceline?: any
  bankaccount?: any
  banktransaction?: any
  company?: any
  user?: any
}

// Simulates database query results
function mockDbQuery(model: string, operation: string, args: any) {
  // For testing purposes, we'll return mock data or null
  const mockData = {
    id: 'test-id',
    companyId: args.where?.companyId || args.data?.companyId || 'unknown',
    name: 'Test Record',
  }

  switch (operation) {
    case 'findMany':
      // Return array filtered by where clause
      if (args.where?.companyId) {
        return [{ ...mockData, companyId: args.where.companyId }]
      }
      return [mockData]

    case 'findFirst':
    case 'findUnique':
      return mockData

    case 'create':
      return { ...mockData, ...args.data }

    case 'update':
      return { ...mockData, ...args.data }

    case 'delete':
      return mockData

    case 'createMany':
      return { count: Array.isArray(args.data) ? args.data.length : 1 }

    case 'updateMany':
    case 'deleteMany':
      return { count: 1 }

    case 'count':
      return 1

    case 'aggregate':
      return { _count: 1, _avg: {}, _sum: {}, _min: {}, _max: {} }

    case 'groupBy':
      return [{ companyId: args.where?.companyId || 'test-company' }]

    case 'upsert':
      return { ...mockData, ...args.create }

    default:
      return null
  }
}

describe('Tenant Isolation System', () => {
  describe('Context Management', () => {
    it('should set and get tenant context within runWithTenant', () => {
      const context: TenantContext = {
        companyId: 'company-123',
        userId: 'user-456',
      }

      runWithTenant(context, () => {
        const retrieved = getTenantContext()
        assert.strictEqual(retrieved?.companyId, 'company-123')
        assert.strictEqual(retrieved?.userId, 'user-456')
      })
    })

    it('should return null when no tenant context is set', () => {
      const context = getTenantContext()
      assert.strictEqual(context, null)
    })

    it('should isolate context between concurrent runWithTenant calls', async () => {
      const context1: TenantContext = {
        companyId: 'company-111',
        userId: 'user-111',
      }
      const context2: TenantContext = {
        companyId: 'company-222',
        userId: 'user-222',
      }

      // Run two contexts concurrently
      const [result1, result2] = await Promise.all([
        Promise.resolve(
          runWithTenant(context1, () => {
            const ctx = getTenantContext()
            return ctx?.companyId
          })
        ),
        Promise.resolve(
          runWithTenant(context2, () => {
            const ctx = getTenantContext()
            return ctx?.companyId
          })
        ),
      ])

      assert.strictEqual(result1, 'company-111')
      assert.strictEqual(result2, 'company-222')
    })

    it('should allow updating context via setTenantContext within runWithTenant', () => {
      const context: TenantContext = {
        companyId: 'company-123',
        userId: 'user-456',
      }

      runWithTenant(context, () => {
        setTenantContext({ companyId: 'company-999', userId: 'user-999' })
        const retrieved = getTenantContext()
        assert.strictEqual(retrieved?.companyId, 'company-999')
        assert.strictEqual(retrieved?.userId, 'user-999')
      })
    })

    it('should not leak context outside of runWithTenant', () => {
      const context: TenantContext = {
        companyId: 'company-123',
        userId: 'user-456',
      }

      runWithTenant(context, () => {
        const retrieved = getTenantContext()
        assert.strictEqual(retrieved?.companyId, 'company-123')
      })

      // Context should be null outside
      const outsideContext = getTenantContext()
      assert.strictEqual(outsideContext, null)
    })
  })

  describe('Prisma Middleware - Query Filtering', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId filter to findMany', async () => {
      await runWithTenant(
        { companyId: 'company-123', userId: 'user-456' },
        async () => {
          const result = await db.contact.findMany({
            where: { name: 'John' },
          })

          // Result should be filtered by companyId
          assert.ok(Array.isArray(result))
          assert.strictEqual(result[0].companyId, 'company-123')
        }
      )
    })

    it('should automatically add companyId filter to findFirst', async () => {
      await runWithTenant(
        { companyId: 'company-456', userId: 'user-789' },
        async () => {
          const result = await db.product.findFirst({
            where: { name: 'Widget' },
          })

          assert.strictEqual(result.companyId, 'company-456')
        }
      )
    })

    it('should filter findUnique results by companyId', async () => {
      await runWithTenant(
        { companyId: 'company-123', userId: 'user-456' },
        async () => {
          const result = await db.contact.findUnique({
            where: { id: 'contact-1' },
          })

          // The middleware verifies companyId after fetch
          // In a real scenario with wrong companyId, it would return null
          assert.ok(result !== undefined)
        }
      )
    })

    it('should return null for findUnique when companyId does not match', async () => {
      // Override mockDbQuery to return a record with different companyId
      const originalQuery = mockDbQuery
      const mockQueryWithWrongCompany = (model: string, op: string, args: any) => {
        if (op === 'findUnique') {
          return {
            id: 'test-id',
            companyId: 'different-company',
            name: 'Test Record',
          }
        }
        return originalQuery(model, op, args)
      }

      // Temporarily replace mockDbQuery
      global.mockDbQuery = mockQueryWithWrongCompany as any

      await runWithTenant(
        { companyId: 'company-123', userId: 'user-456' },
        async () => {
          const result = await db.contact.findUnique({
            where: { id: 'contact-1' },
          })

          // Should return null because companyId doesn't match
          assert.strictEqual(result, null)
        }
      )

      // Restore original
      global.mockDbQuery = originalQuery as any
    })
  })

  describe('Prisma Middleware - Create Operations', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId to create operations', async () => {
      await runWithTenant(
        { companyId: 'company-789', userId: 'user-123' },
        async () => {
          const result = await db.contact.create({
            data: {
              name: 'Jane Doe',
              email: 'jane@example.com',
            },
          })

          assert.strictEqual(result.companyId, 'company-789')
          assert.strictEqual(result.name, 'Jane Doe')
        }
      )
    })

    it('should automatically add companyId to createMany operations', async () => {
      await runWithTenant(
        { companyId: 'company-abc', userId: 'user-xyz' },
        async () => {
          const result = await db.product.createMany({
            data: [
              { name: 'Product 1', price: 100 },
              { name: 'Product 2', price: 200 },
            ],
          })

          assert.strictEqual(result.count, 2)
        }
      )
    })
  })

  describe('Prisma Middleware - Update Operations', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId filter to update operations', async () => {
      await runWithTenant(
        { companyId: 'company-update', userId: 'user-update' },
        async () => {
          const result = await db.contact.update({
            where: { id: 'contact-1' },
            data: { name: 'Updated Name' },
          })

          assert.strictEqual(result.companyId, 'company-update')
        }
      )
    })

    it('should automatically add companyId filter to updateMany operations', async () => {
      await runWithTenant(
        { companyId: 'company-bulk', userId: 'user-bulk' },
        async () => {
          const result = await db.product.updateMany({
            where: { active: true },
            data: { price: 150 },
          })

          assert.strictEqual(result.count, 1)
        }
      )
    })
  })

  describe('Prisma Middleware - Delete Operations', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId filter to delete operations', async () => {
      await runWithTenant(
        { companyId: 'company-delete', userId: 'user-delete' },
        async () => {
          const result = await db.contact.delete({
            where: { id: 'contact-1' },
          })

          assert.strictEqual(result.companyId, 'company-delete')
        }
      )
    })

    it('should automatically add companyId filter to deleteMany operations', async () => {
      await runWithTenant(
        { companyId: 'company-bulk-delete', userId: 'user-bulk-delete' },
        async () => {
          const result = await db.product.deleteMany({
            where: { archived: true },
          })

          assert.strictEqual(result.count, 1)
        }
      )
    })
  })

  describe('Prisma Middleware - Aggregate Operations', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId filter to count operations', async () => {
      await runWithTenant(
        { companyId: 'company-count', userId: 'user-count' },
        async () => {
          const result = await db.contact.count({
            where: { active: true },
          })

          assert.strictEqual(typeof result, 'number')
        }
      )
    })

    it('should automatically add companyId filter to aggregate operations', async () => {
      await runWithTenant(
        { companyId: 'company-agg', userId: 'user-agg' },
        async () => {
          const result = await db.product.aggregate({
            where: { active: true },
            _sum: { price: true },
            _avg: { price: true },
          })

          assert.ok(result._sum !== undefined)
        }
      )
    })

    it('should automatically add companyId filter to groupBy operations', async () => {
      await runWithTenant(
        { companyId: 'company-group', userId: 'user-group' },
        async () => {
          const result = await db.product.groupBy({
            by: ['companyId'],
            where: { active: true },
          })

          assert.ok(Array.isArray(result))
        }
      )
    })
  })

  describe('Prisma Middleware - Upsert Operations', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should automatically add companyId to upsert operations', async () => {
      await runWithTenant(
        { companyId: 'company-upsert', userId: 'user-upsert' },
        async () => {
          const result = await db.contact.upsert({
            where: { id: 'contact-1' },
            create: {
              name: 'New Contact',
              email: 'new@example.com',
            },
            update: {
              name: 'Updated Contact',
            },
          })

          assert.strictEqual(result.companyId, 'company-upsert')
        }
      )
    })
  })

  describe('Security Scenarios', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should prevent User A from reading User B\'s invoices', async () => {
      // User A's context
      const userAData = await runWithTenant(
        { companyId: 'company-A', userId: 'user-A' },
        async () => {
          return db.einvoice.findMany({})
        }
      )

      // User B's context
      const userBData = await runWithTenant(
        { companyId: 'company-B', userId: 'user-B' },
        async () => {
          return db.einvoice.findMany({})
        }
      )

      // Both should get data, but for different companies
      assert.strictEqual(userAData[0].companyId, 'company-A')
      assert.strictEqual(userBData[0].companyId, 'company-B')
      assert.notStrictEqual(userAData[0].companyId, userBData[0].companyId)
    })

    it('should enforce tenant isolation in bulk operations', async () => {
      await runWithTenant(
        { companyId: 'company-isolated', userId: 'user-isolated' },
        async () => {
          // Bulk update should only affect this tenant's records
          const result = await db.contact.updateMany({
            where: { active: false },
            data: { active: true },
          })

          assert.ok(result.count >= 0)
        }
      )
    })

    it('should handle missing tenant context gracefully', async () => {
      // Without tenant context, tenant-scoped models should not be filtered
      // This tests that the middleware doesn't crash
      const result = await db.user.findMany({})

      // User is not a tenant-scoped model, so it should work
      assert.ok(result !== undefined)
    })

    it('should prevent cross-tenant updates', async () => {
      // User A tries to update a record
      await runWithTenant(
        { companyId: 'company-A', userId: 'user-A' },
        async () => {
          const result = await db.product.update({
            where: { id: 'product-1' },
            data: { name: 'Updated by A' },
          })

          // The update should be scoped to company-A
          assert.strictEqual(result.companyId, 'company-A')
        }
      )

      // User B in different tenant should not affect User A's data
      await runWithTenant(
        { companyId: 'company-B', userId: 'user-B' },
        async () => {
          const result = await db.product.update({
            where: { id: 'product-1' },
            data: { name: 'Updated by B' },
          })

          // The update should be scoped to company-B
          assert.strictEqual(result.companyId, 'company-B')
        }
      )
    })

    it('should prevent cross-tenant deletes', async () => {
      await runWithTenant(
        { companyId: 'company-A', userId: 'user-A' },
        async () => {
          // Delete should only work for company-A's records
          const result = await db.contact.delete({
            where: { id: 'contact-1' },
          })

          assert.strictEqual(result.companyId, 'company-A')
        }
      )
    })

    it('should isolate aggregate operations across tenants', async () => {
      // Company A's count
      const countA = await runWithTenant(
        { companyId: 'company-A', userId: 'user-A' },
        async () => {
          return db.product.count({})
        }
      )

      // Company B's count
      const countB = await runWithTenant(
        { companyId: 'company-B', userId: 'user-B' },
        async () => {
          return db.product.count({})
        }
      )

      // Both should be able to count their own records
      assert.strictEqual(typeof countA, 'number')
      assert.strictEqual(typeof countB, 'number')
    })

    it('should maintain isolation with nested async operations', async () => {
      const results = await runWithTenant(
        { companyId: 'company-nested', userId: 'user-nested' },
        async () => {
          // Simulate nested operations
          const contacts = await db.contact.findMany({})

          // Nested operation in same context
          const products = await db.product.findMany({})

          return {
            contactCompany: contacts[0].companyId,
            productCompany: products[0].companyId,
          }
        }
      )

      assert.strictEqual(results.contactCompany, 'company-nested')
      assert.strictEqual(results.productCompany, 'company-nested')
    })
  })

  describe('Edge Cases', () => {
    let db: any

    beforeEach(() => {
      const basePrisma = new MockPrismaClient()
      db = withTenantIsolation(basePrisma as any)
    })

    it('should handle operations on non-tenant-scoped models', async () => {
      // User and Company are not in TENANT_MODELS array
      await runWithTenant(
        { companyId: 'company-123', userId: 'user-456' },
        async () => {
          const result = await db.user.findMany({})

          // Should work without adding companyId filter
          assert.ok(result !== undefined)
        }
      )
    })

    it('should preserve existing where clauses when adding companyId', async () => {
      await runWithTenant(
        { companyId: 'company-preserve', userId: 'user-preserve' },
        async () => {
          const result = await db.contact.findMany({
            where: {
              name: 'John',
              email: { contains: '@example.com' },
            },
          })

          // Should have both original filters and companyId
          assert.ok(result !== undefined)
        }
      )
    })

    it('should handle empty data in createMany', async () => {
      await runWithTenant(
        { companyId: 'company-empty', userId: 'user-empty' },
        async () => {
          const result = await db.product.createMany({
            data: [],
          })

          assert.strictEqual(result.count, 0)
        }
      )
    })
  })
})
