import { describe, it, expect, vi, beforeEach } from "vitest"
import { getTenantList } from "@/lib/admin/tenant-list"
import type { TenantFilters, TenantSort, TenantPagination } from "@/lib/admin/tenant-list"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Mock THRESHOLDS
vi.mock("@/lib/fiscal-data/data/thresholds", () => ({
  THRESHOLDS: {
    pausalni: {
      value: 60000,
    },
  },
}))

import { db } from "@/lib/db"

describe("Tenant List", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockCompany = (overrides: any = {}) => ({
    id: "company-1",
    name: "Test Company",
    oib: "12345678901",
    legalForm: "OBRT_PAUSAL",
    isVatPayer: false,
    createdAt: new Date("2024-01-01"),
    fiscalEnabled: true,
    subscriptionPlan: "pro",
    subscriptionStatus: "active",
    entitlements: ["invoicing", "fiscalization"],
    users: [
      {
        user: {
          email: "owner@test.com",
          name: "Test Owner",
          updatedAt: new Date(),
        },
      },
    ],
    eInvoices: [{ totalAmount: 10000 }],
    _count: {
      users: 1,
      eInvoices: 1,
    },
    ...overrides,
  })

  describe("getTenantList", () => {
    it("returns paginated results with correct structure", async () => {
      const mockCompanies = [createMockCompany(), createMockCompany({ id: "company-2" })]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList()

      expect(result).toHaveProperty("tenants")
      expect(result).toHaveProperty("total")
      expect(result).toHaveProperty("page")
      expect(result).toHaveProperty("pageSize")
      expect(result).toHaveProperty("totalPages")

      expect(result.tenants).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      expect(result.totalPages).toBe(1)
    })

    it("filters by legalForm", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      await getTenantList({ legalForm: "OBRT_PAUSAL" })

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.where?.legalForm).toBe("OBRT_PAUSAL")
    })

    it("filters by subscriptionStatus", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      await getTenantList({ subscriptionStatus: "active" })

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.where?.subscriptionStatus).toBe("active")
    })

    it("filters by search (name or OIB)", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      await getTenantList({ search: "test" })

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.where?.OR).toBeDefined()
      expect((call?.[0]?.where?.OR as unknown[])?.[0]).toHaveProperty("name")
      expect((call?.[0]?.where?.OR as unknown[])?.[1]).toHaveProperty("oib")
    })

    it("filters by flags", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const mockCompanies = [
        createMockCompany({
          fiscalEnabled: false,
          createdAt: eightDaysAgo,
        }),
        createMockCompany({ id: "company-2", fiscalEnabled: true }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({ flags: "stuck-onboarding" })

      // Should only include the stuck company
      expect(result.tenants.length).toBeLessThanOrEqual(1)
      if (result.tenants.length > 0) {
        expect(result.tenants[0].flags).toContain("stuck-onboarding")
      }
    })

    it("filters by hasAlerts=true", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const mockCompanies = [
        createMockCompany({
          fiscalEnabled: false,
          createdAt: eightDaysAgo,
        }), // Has stuck-onboarding flag
        createMockCompany({ id: "company-2" }), // No flags
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({ hasAlerts: true })

      expect(result.tenants.every((t) => t.flags.length > 0)).toBe(true)
    })

    it("filters by hasAlerts=false", async () => {
      const mockCompanies = [createMockCompany(), createMockCompany({ id: "company-2" })]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({ hasAlerts: false })

      expect(result.tenants.every((t) => t.flags.length === 0)).toBe(true)
    })

    it("sorts by name ascending", async () => {
      const mockCompanies = [
        createMockCompany({ name: "Zebra Company" }),
        createMockCompany({ id: "company-2", name: "Alpha Company" }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "name", order: "asc" })

      expect(result.tenants[0].name).toBe("Alpha Company")
      expect(result.tenants[1].name).toBe("Zebra Company")
    })

    it("sorts by name descending", async () => {
      const mockCompanies = [
        createMockCompany({ name: "Alpha Company" }),
        createMockCompany({ id: "company-2", name: "Zebra Company" }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "name", order: "desc" })

      expect(result.tenants[0].name).toBe("Zebra Company")
      expect(result.tenants[1].name).toBe("Alpha Company")
    })

    it("sorts by createdAt ascending", async () => {
      const mockCompanies = [
        createMockCompany({ createdAt: new Date("2024-06-01") }),
        createMockCompany({ id: "company-2", createdAt: new Date("2024-01-01") }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "createdAt", order: "asc" })

      expect(result.tenants[0].createdAt.getTime()).toBeLessThan(
        result.tenants[1].createdAt.getTime()
      )
    })

    it("sorts by createdAt descending", async () => {
      const mockCompanies = [
        createMockCompany({ createdAt: new Date("2024-01-01") }),
        createMockCompany({ id: "company-2", createdAt: new Date("2024-06-01") }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "createdAt", order: "desc" })

      expect(result.tenants[0].createdAt.getTime()).toBeGreaterThan(
        result.tenants[1].createdAt.getTime()
      )
    })

    it("sorts by revenue ascending", async () => {
      const mockCompanies = [
        createMockCompany({ eInvoices: [{ totalAmount: 50000 }] }),
        createMockCompany({ id: "company-2", eInvoices: [{ totalAmount: 10000 }] }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "revenue", order: "asc" })

      expect(result.tenants[0].yearlyRevenue).toBeLessThan(result.tenants[1].yearlyRevenue)
    })

    it("sorts by revenue descending", async () => {
      const mockCompanies = [
        createMockCompany({ eInvoices: [{ totalAmount: 10000 }] }),
        createMockCompany({ id: "company-2", eInvoices: [{ totalAmount: 50000 }] }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "revenue", order: "desc" })

      expect(result.tenants[0].yearlyRevenue).toBeGreaterThan(result.tenants[1].yearlyRevenue)
    })

    it("sorts by lastLogin ascending", async () => {
      const mockCompanies = [
        createMockCompany({
          users: [
            { user: { email: "test@test.com", name: "Test", updatedAt: new Date("2024-06-01") } },
          ],
        }),
        createMockCompany({
          id: "company-2",
          users: [
            { user: { email: "test2@test.com", name: "Test2", updatedAt: new Date("2024-01-01") } },
          ],
        }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "lastLogin", order: "asc" })

      expect(result.tenants[0].lastLoginAt!.getTime()).toBeLessThan(
        result.tenants[1].lastLoginAt!.getTime()
      )
    })

    it("sorts by lastLogin descending", async () => {
      const mockCompanies = [
        createMockCompany({
          users: [
            { user: { email: "test@test.com", name: "Test", updatedAt: new Date("2024-01-01") } },
          ],
        }),
        createMockCompany({
          id: "company-2",
          users: [
            { user: { email: "test2@test.com", name: "Test2", updatedAt: new Date("2024-06-01") } },
          ],
        }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(2)

      const result = await getTenantList({}, { field: "lastLogin", order: "desc" })

      expect(result.tenants[0].lastLoginAt!.getTime()).toBeGreaterThan(
        result.tenants[1].lastLoginAt!.getTime()
      )
    })

    it("handles pagination correctly", async () => {
      const mockCompanies = Array.from({ length: 5 }, (_, i) =>
        createMockCompany({ id: `company-${i}` })
      )

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(50)

      const result = await getTenantList(
        {},
        { field: "createdAt", order: "desc" },
        { page: 2, pageSize: 10 }
      )

      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
      expect(result.totalPages).toBe(5) // 50 / 10
    })

    it("applies pagination skip and take", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      await getTenantList({}, { field: "createdAt", order: "desc" }, { page: 3, pageSize: 15 })

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.skip).toBe(30) // (3-1) * 15
      expect(call?.[0]?.take).toBe(15)
    })

    it("includes required tenant fields", async () => {
      const mockCompanies = [createMockCompany()]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(1)

      const result = await getTenantList()

      const tenant = result.tenants[0]
      expect(tenant).toHaveProperty("id")
      expect(tenant).toHaveProperty("name")
      expect(tenant).toHaveProperty("oib")
      expect(tenant).toHaveProperty("legalForm")
      expect(tenant).toHaveProperty("subscriptionStatus")
      expect(tenant).toHaveProperty("subscriptionPlan")
      expect(tenant).toHaveProperty("createdAt")
      expect(tenant).toHaveProperty("yearlyRevenue")
      expect(tenant).toHaveProperty("lastLoginAt")
      expect(tenant).toHaveProperty("flags")
      expect(tenant).toHaveProperty("userCount")
      expect(tenant).toHaveProperty("invoiceCount")
      expect(tenant).toHaveProperty("moduleCount")
    })

    it("calculates yearlyRevenue from eInvoices", async () => {
      const mockCompanies = [
        createMockCompany({
          eInvoices: [{ totalAmount: 10000 }, { totalAmount: 20000 }, { totalAmount: 15000 }],
        }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(1)

      const result = await getTenantList()

      expect(result.tenants[0].yearlyRevenue).toBe(45000)
    })

    it("calculates moduleCount from entitlements", async () => {
      const mockCompanies = [
        createMockCompany({
          entitlements: ["invoicing", "fiscalization", "expenses", "contacts"],
        }),
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(1)

      const result = await getTenantList()

      expect(result.tenants[0].moduleCount).toBe(4)
    })

    it("handles empty results", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      const result = await getTenantList()

      expect(result.tenants).toEqual([])
      expect(result.total).toBe(0)
      expect(result.totalPages).toBe(0)
    })

    it("combines multiple filters", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)

      await getTenantList({
        legalForm: "OBRT_PAUSAL",
        subscriptionStatus: "active",
        search: "test company",
      })

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.where?.legalForm).toBe("OBRT_PAUSAL")
      expect(call?.[0]?.where?.subscriptionStatus).toBe("active")
      expect(call?.[0]?.where?.OR).toBeDefined()
    })

    it("handles companies without owner", async () => {
      const mockCompanies = [createMockCompany({ users: [] })]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)
      vi.mocked(db.company.count).mockResolvedValue(1)

      const result = await getTenantList()

      expect(result.tenants[0].lastLoginAt).toBeNull()
    })
  })
})
