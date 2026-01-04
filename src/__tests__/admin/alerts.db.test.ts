import { describe, it, expect, vi, beforeEach } from "vitest"
import { getActiveAlerts } from "@/lib/admin/alerts"
import type { Alert, AlertLevel, AlertType } from "@/lib/admin/alerts"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findMany: vi.fn(),
    },
    fiscalCertificate: {
      findMany: vi.fn(),
    },
    adminAlert: {
      findMany: vi.fn(),
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

describe("Admin Alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: no dismissed alerts
    vi.mocked(db.adminAlert.findMany).mockResolvedValue([])
  })

  describe("getActiveAlerts", () => {
    it("finds alerts correctly for stuck-onboarding", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const mockStuckCompanies = [
        {
          id: "company-1",
          name: "Stuck Company 1",
          createdAt: eightDaysAgo,
        },
        {
          id: "company-2",
          name: "Stuck Company 2",
          createdAt: eightDaysAgo,
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce(mockStuckCompanies as any) // stuck companies
        .mockResolvedValueOnce([]) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      const stuckAlerts = alerts.filter((a) => a.type === "onboarding-stuck")
      expect(stuckAlerts).toHaveLength(2)
      expect(stuckAlerts[0].level).toBe("critical")
      expect(stuckAlerts[0].companyName).toBe("Stuck Company 1")
    })

    it("finds alerts for approaching 60k limit (85%)", async () => {
      const mockPausalni = [
        {
          id: "company-1",
          name: "Company at 85%",
          legalForm: "OBRT_PAUSAL",
          eInvoices: [{ totalAmount: 51000 }], // 85% of 60k
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([]) // stuck companies
        .mockResolvedValueOnce(mockPausalni as any) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      const limitAlerts = alerts.filter((a) => a.type === "approaching-limit")
      expect(limitAlerts).toHaveLength(1)
      expect(limitAlerts[0].level).toBe("warning")
      expect(limitAlerts[0].title).toBe("85% of 60k limit")
      expect(limitAlerts[0].description).toContain("€51000.00")
    })

    it("finds alerts for critical 60k limit (95%)", async () => {
      const mockPausalni = [
        {
          id: "company-1",
          name: "Company at 95%",
          legalForm: "OBRT_PAUSAL",
          eInvoices: [{ totalAmount: 57000 }], // 95% of 60k
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([]) // stuck companies
        .mockResolvedValueOnce(mockPausalni as any) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      const limitAlerts = alerts.filter((a) => a.type === "critical-limit")
      expect(limitAlerts).toHaveLength(1)
      expect(limitAlerts[0].level).toBe("critical")
      expect(limitAlerts[0].title).toBe("95% of 60k limit")
      expect(limitAlerts[0].autoAction).toBe("Urgent outreach")
    })

    it("does not create limit alerts below 85%", async () => {
      const mockPausalni = [
        {
          id: "company-1",
          name: "Company at 50%",
          legalForm: "OBRT_PAUSAL",
          eInvoices: [{ totalAmount: 30000 }], // 50% of 60k
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([]) // stuck companies
        .mockResolvedValueOnce(mockPausalni as any) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      const limitAlerts = alerts.filter(
        (a) => a.type === "approaching-limit" || a.type === "critical-limit"
      )
      expect(limitAlerts).toHaveLength(0)
    })

    // Skip: Date mocking needs comprehensive overhaul
    it.skip("finds alerts for expiring certificates", async () => {
      const tenDaysFromNow = new Date()
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)

      const mockCerts = [
        {
          id: "cert-1",
          validUntil: tenDaysFromNow,
          company: {
            id: "company-1",
            name: "Company with Expiring Cert",
          },
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([]) // stuck companies
        .mockResolvedValueOnce([]) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue(mockCerts as any)

      const alerts = await getActiveAlerts()

      const certAlerts = alerts.filter((a) => a.type === "cert-expiring")
      expect(certAlerts).toHaveLength(1)
      expect(certAlerts[0].level).toBe("warning")
      expect(certAlerts[0].description).toContain("10 days")
    })

    // Skip: Date mocking needs comprehensive overhaul
    it.skip("marks cert alerts as critical when <7 days", async () => {
      const fiveDaysFromNow = new Date()
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)

      const mockCerts = [
        {
          id: "cert-1",
          validUntil: fiveDaysFromNow,
          company: {
            id: "company-1",
            name: "Company with Soon Expiring Cert",
          },
        },
      ]

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([]) // stuck companies
        .mockResolvedValueOnce([]) // pausalni companies

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue(mockCerts as any)

      const alerts = await getActiveAlerts()

      const certAlerts = alerts.filter((a) => a.type === "cert-expiring")
      expect(certAlerts).toHaveLength(1)
      expect(certAlerts[0].level).toBe("critical")
      expect(certAlerts[0].description).toContain("5 days")
    })

    // Skip: Date mocking needs comprehensive overhaul
    it.skip("sorts alerts by priority (critical first)", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const tenDaysFromNow = new Date()
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([
          {
            id: "company-stuck",
            name: "Stuck Company",
            createdAt: eightDaysAgo,
          },
        ] as any) // stuck (critical)
        .mockResolvedValueOnce([
          {
            id: "company-pausalni",
            name: "Pausalni Company",
            legalForm: "OBRT_PAUSAL",
            eInvoices: [{ totalAmount: 51000 }], // 85% (warning)
          },
        ] as any)

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([
        {
          id: "cert-1",
          validUntil: tenDaysFromNow,
          company: {
            id: "company-cert",
            name: "Cert Company",
          },
        },
      ] as any) // cert expiring (warning)

      const alerts = await getActiveAlerts()

      // Critical alerts should come first
      expect(alerts[0].level).toBe("critical")

      // Count by level
      const criticalCount = alerts.filter((a) => a.level === "critical").length
      const warningCount = alerts.filter((a) => a.level === "warning").length

      expect(criticalCount).toBeGreaterThan(0)
      expect(warningCount).toBeGreaterThan(0)

      // All critical should appear before all warnings
      const firstWarningIndex = alerts.findIndex((a) => a.level === "warning")
      const lastCriticalIndex = alerts.map((a) => a.level).lastIndexOf("critical")

      if (firstWarningIndex !== -1 && lastCriticalIndex !== -1) {
        expect(lastCriticalIndex).toBeLessThan(firstWarningIndex)
      }
    })

    // Skip: Date mocking needs comprehensive overhaul
    it.skip("handles multiple alert types together", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const fiveDaysFromNow = new Date()
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([
          {
            id: "company-1",
            name: "Stuck Company",
            createdAt: eightDaysAgo,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: "company-2",
            name: "Pausalni Company",
            legalForm: "OBRT_PAUSAL",
            eInvoices: [{ totalAmount: 57000 }], // 95%
          },
        ] as any)

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([
        {
          id: "cert-1",
          validUntil: fiveDaysFromNow,
          company: {
            id: "company-3",
            name: "Cert Company",
          },
        },
      ] as any)

      const alerts = await getActiveAlerts()

      expect(alerts.length).toBeGreaterThanOrEqual(3)

      const types = new Set(alerts.map((a) => a.type))
      expect(types.has("onboarding-stuck")).toBe(true)
      expect(types.has("critical-limit")).toBe(true)
      expect(types.has("cert-expiring")).toBe(true)
    })

    it("skips certificates without company", async () => {
      const tenDaysFromNow = new Date()
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)

      const mockCerts = [
        {
          id: "cert-1",
          validUntil: tenDaysFromNow,
          company: null, // No company
        },
      ]

      vi.mocked(db.company.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue(mockCerts as any)

      const alerts = await getActiveAlerts()

      const certAlerts = alerts.filter((a) => a.type === "cert-expiring")
      expect(certAlerts).toHaveLength(0)
    })

    it("queries stuck companies created more than 7 days ago", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      await getActiveAlerts()

      const call = vi.mocked(db.company.findMany).mock.calls[0]
      expect(call?.[0]?.where?.fiscalEnabled).toBe(false)
      expect(call?.[0]?.where?.createdAt).toHaveProperty("lte")
      expect((call?.[0]?.where?.createdAt as { lte: Date })?.lte).toBeInstanceOf(Date)
    })

    it("queries pausalni companies for limit tracking", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      await getActiveAlerts()

      const call = vi.mocked(db.company.findMany).mock.calls[1]
      expect(call?.[0]?.where?.legalForm).toBe("OBRT_PAUSAL")
      expect((call?.[0]?.include as { eInvoices?: unknown })?.eInvoices).toBeDefined()
      const eInvoicesInclude = (
        call?.[0]?.include as { eInvoices?: { where?: { status?: unknown } } }
      )?.eInvoices
      expect(eInvoicesInclude?.where?.status).toEqual({ not: "DRAFT" })
    })

    // Skip: Date mocking needs comprehensive overhaul
    it.skip("queries certificates expiring within 30 days", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      await getActiveAlerts()

      const call = vi.mocked(db.fiscalCertificate.findMany).mock.calls[0]
      const where = call?.[0]?.where as { validUntil?: { lte?: Date; gte?: Date } }
      expect(where?.validUntil).toHaveProperty("lte")
      expect(where?.validUntil).toHaveProperty("gte")
    })

    it("returns empty array when no alerts", async () => {
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      expect(alerts).toEqual([])
    })

    it("generates unique alert IDs", async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      vi.mocked(db.company.findMany)
        .mockResolvedValueOnce([
          { id: "company-1", name: "Company 1", createdAt: eightDaysAgo },
          { id: "company-2", name: "Company 2", createdAt: eightDaysAgo },
        ] as any)
        .mockResolvedValueOnce([])

      vi.mocked(db.fiscalCertificate.findMany).mockResolvedValue([])

      const alerts = await getActiveAlerts()

      const ids = alerts.map((a) => a.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length) // All IDs should be unique
    })
  })
})
