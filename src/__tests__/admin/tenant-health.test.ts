import { describe, it, expect, vi, beforeEach } from "vitest"
import { getTenantDetail } from "@/lib/admin/tenant-health"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: vi.fn(),
    },
    eInvoice: {
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

describe("Tenant Health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getTenantDetail", () => {
    it("returns all required fields", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing", "fiscalization"],
        featureFlags: { competence: "intermediate" },
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date("2024-12-01"),
            },
          },
        ],
        eInvoices: [{ totalAmount: 10000 }, { totalAmount: 15000 }],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(5)

      const result = await getTenantDetail("company-123")

      expect(result).toBeDefined()
      expect(result).toHaveProperty("profile")
      expect(result).toHaveProperty("subscription")
      expect(result).toHaveProperty("owner")
      expect(result).toHaveProperty("health")
      expect(result).toHaveProperty("limitTracker")
      expect(result).toHaveProperty("modules")
      expect(result).toHaveProperty("flags")
    })

    it("returns null for non-existent company", async () => {
      vi.mocked(db.company.findUnique).mockResolvedValue(null)

      const result = await getTenantDetail("non-existent")

      expect(result).toBeNull()
    })

    it("calculates flags correctly for stuck-onboarding", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: eightDaysAgo,
        fiscalEnabled: false, // Not enabled
        subscriptionPlan: "free",
        subscriptionStatus: "none",
        subscriptionCurrentPeriodStart: null,
        entitlements: [],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      const result = await getTenantDetail("company-123")

      expect(result?.flags).toContain("stuck-onboarding")
    })

    it("calculates flags correctly for approaching-limit (85%)", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 51000 }], // 85% of 60k
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.flags).toContain("approaching-limit")
    })

    it("calculates flags correctly for critical-limit (95%)", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 57000 }], // 95% of 60k
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.flags).toContain("critical-limit")
      expect(result?.flags).toContain("approaching-limit")
    })

    it("calculates flags correctly for inactive (>30 days)", async () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: fortyDaysAgo,
            },
          },
        ],
        eInvoices: [{ totalAmount: 10000 }],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.flags).toContain("inactive")
    })

    it("calculates 60k limit percentage correctly", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 10000 }, { totalAmount: 20000 }], // Total: 30000
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(2)

      const result = await getTenantDetail("company-123")

      expect(result?.limitTracker.currentRevenue).toBe(30000)
      expect(result?.limitTracker.limit).toBe(60000)
      expect(result?.limitTracker.percentage).toBe(50) // 30000/60000 * 100
      expect(result?.limitTracker.status).toBe("safe")
    })

    it("calculates limit status as warning at 85%", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 51000 }],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.limitTracker.status).toBe("warning")
    })

    it("calculates limit status as critical at 95%", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 58000 }],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.limitTracker.status).toBe("critical")
    })

    it("handles company without owner", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [], // No owner
        eInvoices: [{ totalAmount: 10000 }],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      expect(result?.owner).toBeNull()
      expect(result?.health.lastLoginAt).toBeNull()
    })

    it("calculates projected yearly revenue correctly", async () => {
      // Mock current date to be June (month 6)
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-06-15"))

      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [
          {
            user: {
              email: "owner@test.com",
              name: "Test Owner",
              updatedAt: new Date(),
            },
          },
        ],
        eInvoices: [{ totalAmount: 30000 }], // 30k in 6 months
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(1)

      const result = await getTenantDetail("company-123")

      // 30000 / 6 * 12 = 60000
      expect(result?.limitTracker.projectedYearly).toBe(60000)

      vi.useRealTimers()
    })

    it("queries for invoices in current year only", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
        users: [],
        eInvoices: [],
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      await getTenantDetail("company-123")

      const call = vi.mocked(db.company.findUnique).mock.calls[0]
      expect(call[0].include.eInvoices.where.createdAt.gte).toEqual(
        new Date(new Date().getFullYear(), 0, 1)
      )
      expect(call[0].include.eInvoices.where.status).toEqual({ not: "DRAFT" })
    })

    it("calculates 30-day activity count", async () => {
      const mockCompany = {
        id: "company-123",
        name: "Test Company",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        createdAt: new Date("2024-01-01"),
        fiscalEnabled: true,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionCurrentPeriodStart: new Date("2024-01-01"),
        entitlements: ["invoicing"],
        featureFlags: {},
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
      }

      vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as any)
      vi.mocked(db.eInvoice.count).mockResolvedValue(15)

      const result = await getTenantDetail("company-123")

      expect(result?.health.thirtyDayActivity).toBe(15)
    })
  })
})
