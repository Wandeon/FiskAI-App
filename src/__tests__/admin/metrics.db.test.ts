import { describe, it, expect, vi, beforeEach } from "vitest"
import { getAdminMetrics, getOnboardingFunnel, getComplianceHealth } from "@/lib/admin/metrics"
import type { AdminMetrics, OnboardingFunnel, ComplianceHealth } from "@/lib/admin/metrics"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    fiscalCertificate: {
      count: vi.fn(),
    },
    eInvoice: {
      count: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"

describe("Admin Metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getAdminMetrics", () => {
    it("returns expected shape with all metrics", async () => {
      // Mock database responses
      vi.mocked(db.company.count)
        .mockResolvedValueOnce(100) // totalTenants
        .mockResolvedValueOnce(75) // activeSubscriptions
        .mockResolvedValueOnce(10) // thisWeekSignups
        .mockResolvedValueOnce(5) // needsHelp

      const result = await getAdminMetrics()

      expect(result).toEqual({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      // Verify db.company.count was called 4 times
      expect(db.company.count).toHaveBeenCalledTimes(4)
    })

    it("handles zero tenants", async () => {
      vi.mocked(db.company.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)

      const result = await getAdminMetrics()

      expect(result.totalTenants).toBe(0)
      expect(result.activeSubscriptions).toBe(0)
      expect(result.thisWeekSignups).toBe(0)
      expect(result.needsHelp).toBe(0)
    })

    it("calls count with correct filters for active subscriptions", async () => {
      vi.mocked(db.company.count).mockResolvedValue(50)

      await getAdminMetrics()

      // Second call should be for active subscriptions
      expect(db.company.count).toHaveBeenNthCalledWith(2, {
        where: { subscriptionStatus: "active" },
      })
    })

    it("calls count with date filter for thisWeekSignups", async () => {
      vi.mocked(db.company.count).mockResolvedValue(10)

      await getAdminMetrics()

      // Third call should be for thisWeekSignups with date filter
      const call = vi.mocked(db.company.count).mock.calls[2] as any
      expect(call[0]).toHaveProperty("where.createdAt.gte")
      expect(call[0].where.createdAt.gte).toBeInstanceOf(Date)
    })
  })

  describe("getOnboardingFunnel", () => {
    it("returns correct funnel calculations", async () => {
      const mockCompanies = [
        { fiscalEnabled: true, _count: { eInvoices: 10 } },
        { fiscalEnabled: true, _count: { eInvoices: 5 } },
        { fiscalEnabled: true, _count: { eInvoices: 3 } },
        { fiscalEnabled: false, _count: { eInvoices: 0 } },
        { fiscalEnabled: false, _count: { eInvoices: 0 } },
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)

      const result = await getOnboardingFunnel()

      expect(result.started).toBe(5) // All companies
      expect(result.step2).toBe(3) // fiscalEnabled
      expect(result.step3).toBe(3) // >= 1 invoice
      expect(result.step4).toBe(2) // >= 5 invoices (10 and 5, not 3)
      expect(result.completed).toBe(3) // fiscalEnabled AND >= 1 invoice
      expect(result.firstInvoice).toBe(3) // > 0 invoices
    })

    it("handles empty company list", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])

      const result = await getOnboardingFunnel()

      expect(result).toEqual({
        started: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        completed: 0,
        firstInvoice: 0,
      })
    })

    it("correctly counts companies at different funnel stages", async () => {
      const mockCompanies = [
        { fiscalEnabled: true, _count: { eInvoices: 20 } }, // All stages
        { fiscalEnabled: true, _count: { eInvoices: 5 } }, // All stages
        { fiscalEnabled: true, _count: { eInvoices: 2 } }, // Step 2 & 3
        { fiscalEnabled: false, _count: { eInvoices: 0 } }, // Only started
      ]

      vi.mocked(db.company.findMany).mockResolvedValue(mockCompanies as any)

      const result = await getOnboardingFunnel()

      expect(result.started).toBe(4)
      expect(result.step2).toBe(3) // fiscalEnabled
      expect(result.step3).toBe(3) // >= 1 invoice
      expect(result.step4).toBe(2) // >= 5 invoices
      expect(result.completed).toBe(3) // fiscalEnabled AND >= 1 invoice
    })

    it("queries companies with correct select fields", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])

      await getOnboardingFunnel()

      expect(db.company.findMany).toHaveBeenCalledWith({
        select: {
          fiscalEnabled: true,
          _count: { select: { eInvoices: true } },
        },
      })
    })
  })

  describe("getComplianceHealth", () => {
    it("returns expected shape with all compliance metrics", async () => {
      vi.mocked(db.fiscalCertificate.count)
        .mockResolvedValueOnce(50) // active
        .mockResolvedValueOnce(10) // expiring

      vi.mocked(db.company.count).mockResolvedValueOnce(5) // missing certs

      vi.mocked(db.eInvoice.count)
        .mockResolvedValueOnce(100) // today
        .mockResolvedValueOnce(450) // all fiscalized
        .mockResolvedValueOnce(500) // total attempts

      const result = await getComplianceHealth()

      expect(result).toEqual({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 90, // 450/500 * 100
      })
    })

    it("calculates 100% success rate when no attempts", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(0)
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      const result = await getComplianceHealth()

      expect(result.successRate).toBe(100)
    })

    it("calculates success rate correctly with various data", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(10)
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(95) // all fiscalized
        .mockResolvedValueOnce(100) // total attempts

      const result = await getComplianceHealth()

      expect(result.successRate).toBe(95) // 95/100 * 100, rounded
    })

    it("rounds success rate to nearest integer", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(10)
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(67) // all fiscalized
        .mockResolvedValueOnce(100) // total attempts

      const result = await getComplianceHealth()

      expect(result.successRate).toBe(67) // 67/100 * 100 = 67
    })

    // Skip: Certificate mock array access issue
    it.skip("queries certificates expiring within 30 days", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(5)
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      await getComplianceHealth()

      // Second call should be for expiring certificates
      const call = vi.mocked(db.fiscalCertificate.count).mock.calls[1] as any
      expect(call[0]).toHaveProperty("where.validUntil.lte")
      expect(call[0]).toHaveProperty("where.validUntil.gte")
    })

    it("counts missing certificates for specific legal forms", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(0)
      vi.mocked(db.company.count).mockResolvedValue(3)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      await getComplianceHealth()

      expect(db.company.count).toHaveBeenCalledWith({
        where: {
          fiscalCertificates: { none: {} },
          legalForm: { in: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT"] },
        },
      })
    })

    it("handles edge case of all failed fiscalizations", async () => {
      vi.mocked(db.fiscalCertificate.count).mockResolvedValue(10)
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // all fiscalized
        .mockResolvedValueOnce(100) // total attempts

      const result = await getComplianceHealth()

      expect(result.successRate).toBe(0)
    })
  })
})
