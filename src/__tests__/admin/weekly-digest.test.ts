import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateWeeklyDigest, formatDigestEmail } from "@/lib/admin/weekly-digest"
import type { WeeklyDigestData } from "@/lib/admin/weekly-digest"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    eInvoice: {
      count: vi.fn(),
    },
    fiscalCertificate: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Mock the admin modules
vi.mock("@/lib/admin/metrics", () => ({
  getAdminMetrics: vi.fn(),
  getOnboardingFunnel: vi.fn(),
  getComplianceHealth: vi.fn(),
}))

vi.mock("@/lib/admin/alerts", () => ({
  getActiveAlerts: vi.fn(),
}))

import { db } from "@/lib/db"
import { getAdminMetrics, getOnboardingFunnel, getComplianceHealth } from "@/lib/admin/metrics"
import { getActiveAlerts } from "@/lib/admin/alerts"

describe("Weekly Digest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("generateWeeklyDigest", () => {
    it("aggregates data from all sources", async () => {
      // Mock metrics
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 100,
        step2: 80,
        step3: 60,
        step4: 40,
        completed: 50,
        firstInvoice: 60,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 95,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([
        {
          id: "alert-1",
          type: "critical-limit",
          level: "critical",
          companyId: "company-1",
          companyName: "Test Company",
          title: "Critical Alert",
          description: "Test description",
          createdAt: new Date(),
          autoAction: "Test action",
        },
      ])

      // Mock new customers
      vi.mocked(db.company.findMany).mockResolvedValue([
        {
          id: "company-1",
          name: "New Company",
          subscriptionStatus: "active",
          createdAt: new Date(),
          users: [{ user: { email: "test@test.com" } }],
        },
      ] as any)

      // Mock active companies count
      vi.mocked(db.company.count)
        .mockResolvedValueOnce(75) // active subscriptions
        .mockResolvedValueOnce(2) // churned this week

      // Mock invoices
      vi.mocked(db.eInvoice.count).mockResolvedValue(50)

      const result = await generateWeeklyDigest()

      expect(result).toHaveProperty("weekStart")
      expect(result).toHaveProperty("weekEnd")
      expect(result).toHaveProperty("newCustomers")
      expect(result).toHaveProperty("mrr")
      expect(result).toHaveProperty("compliance")
      expect(result).toHaveProperty("support")
      expect(result).toHaveProperty("actionItems")
      expect(result).toHaveProperty("totalTenants")
      expect(result).toHaveProperty("activeSubscriptions")
      expect(result).toHaveProperty("onboardingFunnel")
    })

    it("calculates MRR metrics correctly", async () => {
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 100,
        step2: 80,
        step3: 60,
        step4: 40,
        completed: 50,
        firstInvoice: 60,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 95,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([])

      // Mock new customers - 3 active
      vi.mocked(db.company.findMany).mockResolvedValue([
        {
          id: "company-1",
          name: "Company 1",
          subscriptionStatus: "active",
          createdAt: new Date(),
          users: [{ user: { email: "test1@test.com" } }],
        },
        {
          id: "company-2",
          name: "Company 2",
          subscriptionStatus: "active",
          createdAt: new Date(),
          users: [{ user: { email: "test2@test.com" } }],
        },
        {
          id: "company-3",
          name: "Company 3",
          subscriptionStatus: "active",
          createdAt: new Date(),
          users: [{ user: { email: "test3@test.com" } }],
        },
      ] as any)

      // Mock active companies count
      vi.mocked(db.company.count)
        .mockResolvedValueOnce(100) // total active
        .mockResolvedValueOnce(5) // churned this week

      vi.mocked(db.eInvoice.count).mockResolvedValue(50)

      const result = await generateWeeklyDigest()

      expect(result.mrr.currentMRR).toBe(3000) // 100 * 30
      expect(result.mrr.newMRR).toBe(90) // 3 * 30
      expect(result.mrr.churnedMRR).toBe(150) // 5 * 30
    })

    it("filters critical alerts for action items", async () => {
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 100,
        step2: 80,
        step3: 60,
        step4: 40,
        completed: 50,
        firstInvoice: 60,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 95,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([
        {
          id: "alert-1",
          type: "critical-limit",
          level: "critical",
          companyId: "company-1",
          companyName: "Critical Company",
          title: "Critical Alert",
          description: "Test",
          createdAt: new Date(),
        },
        {
          id: "alert-2",
          type: "approaching-limit",
          level: "warning",
          companyId: "company-2",
          companyName: "Warning Company",
          title: "Warning Alert",
          description: "Test",
          createdAt: new Date(),
        },
      ])

      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      const result = await generateWeeklyDigest()

      // Only critical alerts should be in actionItems
      expect(result.actionItems).toHaveLength(1)
      expect(result.actionItems[0].level).toBe("critical")
    })

    it("calculates onboarding funnel conversion rate", async () => {
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 100,
        step2: 80,
        step3: 60,
        step4: 40,
        completed: 60, // 60 out of 100
        firstInvoice: 60,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 95,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([])
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      const result = await generateWeeklyDigest()

      expect(result.onboardingFunnel.conversionRate).toBe(60) // 60/100 * 100
    })

    it("handles zero started companies for conversion rate", async () => {
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 0,
        activeSubscriptions: 0,
        thisWeekSignups: 0,
        needsHelp: 0,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        completed: 0,
        firstInvoice: 0,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 0,
        certificatesExpiring: 0,
        certificatesMissing: 0,
        fiscalizedToday: 0,
        successRate: 100,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([])
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(0)

      const result = await generateWeeklyDigest()

      expect(result.onboardingFunnel.conversionRate).toBe(0)
    })

    it("includes fiscalized this week count", async () => {
      vi.mocked(getAdminMetrics).mockResolvedValue({
        totalTenants: 100,
        activeSubscriptions: 75,
        thisWeekSignups: 10,
        needsHelp: 5,
      })

      vi.mocked(getOnboardingFunnel).mockResolvedValue({
        started: 100,
        step2: 80,
        step3: 60,
        step4: 40,
        completed: 50,
        firstInvoice: 60,
      })

      vi.mocked(getComplianceHealth).mockResolvedValue({
        certificatesActive: 50,
        certificatesExpiring: 10,
        certificatesMissing: 5,
        fiscalizedToday: 100,
        successRate: 95,
      })

      vi.mocked(getActiveAlerts).mockResolvedValue([])
      vi.mocked(db.company.findMany).mockResolvedValue([])
      vi.mocked(db.company.count).mockResolvedValue(0)
      vi.mocked(db.eInvoice.count).mockResolvedValue(250) // fiscalized this week

      const result = await generateWeeklyDigest()

      expect(result.compliance.fiscalizedThisWeek).toBe(250)
    })
  })

  describe("formatDigestEmail", () => {
    const createMockDigestData = (): WeeklyDigestData => ({
      weekStart: new Date("2024-12-14"),
      weekEnd: new Date("2024-12-21"),
      newCustomers: {
        count: 3,
        list: [
          {
            id: "company-1",
            name: "New Company 1",
            email: "test1@test.com",
            createdAt: new Date("2024-12-15"),
            subscriptionStatus: "active",
          },
          {
            id: "company-2",
            name: "New Company 2",
            email: "test2@test.com",
            createdAt: new Date("2024-12-16"),
            subscriptionStatus: "trial",
          },
        ],
      },
      mrr: {
        currentMRR: 3000,
        newMRR: 90,
        churnedMRR: 60,
        upgrades: 0,
        downgrades: 0,
      },
      compliance: {
        certificatesActive: 50,
        certificatesExpiring: 10,
        fiscalizedThisWeek: 250,
        successRate: 95,
      },
      support: {
        open: 5,
        closedThisWeek: 12,
        avgResponseTime: "2h",
      },
      actionItems: [
        {
          id: "alert-1",
          type: "critical-limit",
          level: "critical",
          companyId: "company-1",
          companyName: "Critical Company",
          title: "95% of limit reached",
          description: "Current: €57,000",
          createdAt: new Date(),
          autoAction: "Urgent outreach",
        },
      ],
      totalTenants: 100,
      activeSubscriptions: 75,
      onboardingFunnel: {
        started: 100,
        completed: 60,
        conversionRate: 60,
      },
    })

    it("produces valid HTML", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("<!DOCTYPE html>")
      expect(html).toContain("<html")
      expect(html).toContain("</html>")
      expect(html).toContain("<body")
      expect(html).toContain("</body>")
    })

    it("includes all major sections", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("FiskAI Admin Digest")
      expect(html).toContain("Pregled") // Overview
      expect(html).toContain("Novi klijenti") // New customers
      expect(html).toContain("MRR metrike") // MRR metrics
      expect(html).toContain("Compliance status")
      expect(html).toContain("Onboarding lijevak") // Onboarding funnel
    })

    it("displays total tenants correctly", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("100") // totalTenants
    })

    it("displays active subscriptions correctly", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("75") // activeSubscriptions
    })

    it("displays new customers count", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("Novi klijenti (3)")
    })

    it("lists new customer names and emails", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("New Company 1")
      expect(html).toContain("test1@test.com")
      expect(html).toContain("New Company 2")
      expect(html).toContain("test2@test.com")
    })

    it("displays MRR values correctly", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("€3,000") // currentMRR formatted
      expect(html).toContain("€90") // newMRR
      expect(html).toContain("€60") // churnedMRR
    })

    it("displays compliance metrics", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("50") // certificatesActive
      expect(html).toContain("10") // certificatesExpiring
      expect(html).toContain("250") // fiscalizedThisWeek
      expect(html).toContain("95%") // successRate
    })

    it("displays onboarding funnel metrics", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("100") // started
      expect(html).toContain("60") // completed or conversionRate
    })

    it("displays action items when present", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("Kritične akcije (1)")
      expect(html).toContain("95% of limit reached")
      expect(html).toContain("Critical Company")
      expect(html).toContain("Urgent outreach")
    })

    it("shows message when no new customers", () => {
      const data = createMockDigestData()
      data.newCustomers.count = 0
      data.newCustomers.list = []

      const html = formatDigestEmail(data)

      expect(html).toContain("Nema novih klijenata")
    })

    it("shows positive message when no critical alerts", () => {
      const data = createMockDigestData()
      data.actionItems = []

      const html = formatDigestEmail(data)

      expect(html).toContain("Nema kritičnih upozorenja")
    })

    it("limits new customers display to 10", () => {
      const data = createMockDigestData()
      data.newCustomers.count = 15
      data.newCustomers.list = Array.from({ length: 15 }, (_, i) => ({
        id: `company-${i}`,
        name: `Company ${i}`,
        email: `test${i}@test.com`,
        createdAt: new Date(),
        subscriptionStatus: "active",
      }))

      const html = formatDigestEmail(data)

      expect(html).toContain("i još 5") // "and 5 more"
    })

    it("limits action items display to 10", () => {
      const data = createMockDigestData()
      data.actionItems = Array.from({ length: 15 }, (_, i) => ({
        id: `alert-${i}`,
        type: "critical-limit" as const,
        level: "critical" as const,
        companyId: `company-${i}`,
        companyName: `Company ${i}`,
        title: `Alert ${i}`,
        description: "Test",
        createdAt: new Date(),
      }))

      const html = formatDigestEmail(data)

      expect(html).toContain("i još 5 kritičnih upozorenja") // "and 5 more critical alerts"
    })

    it("includes link to admin dashboard", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      expect(html).toContain("https://admin.fiskai.hr/dashboard")
      expect(html).toContain("Otvori Admin Dashboard")
    })

    it("formats Croatian dates correctly", () => {
      const data = createMockDigestData()
      const html = formatDigestEmail(data)

      // Should contain Croatian month names (genitive case: prosinca, siječnja, etc.)
      expect(html).toMatch(
        /(siječnja|veljače|ožujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenog|prosinca)/i
      )
    })
  })
})
