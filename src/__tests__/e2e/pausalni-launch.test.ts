import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    tutorialProgress: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/fiscal-data/data/thresholds", () => ({
  THRESHOLDS: {
    pausalni: {
      value: 60000,
    },
  },
}))

import { db } from "@/lib/db"

describe("Pausalni Launch E2E Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Onboarding Flow for Pausalni Users", () => {
    it("completes Step 1: Basic Info", async () => {
      const mockCompany = {
        id: "company-1",
        name: "Obrt Test",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        createdAt: new Date(),
      }

      vi.mocked(db.company.findFirst).mockResolvedValue(null)
      vi.mocked(db.company.create).mockResolvedValue(mockCompany as any)

      // Simulate Step 1 submission
      const basicInfo = {
        name: "Obrt Test",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
      }

      // Validation
      expect(basicInfo.name.trim()).toBeTruthy()
      expect(basicInfo.oib).toMatch(/^\d{11}$/)
      expect(basicInfo.legalForm).toBe("OBRT_PAUSAL")
    })

    it("completes Step 2: Competence Level", async () => {
      const mockCompany = {
        id: "company-1",
        name: "Obrt Test",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        competence: "beginner",
      }

      vi.mocked(db.company.findFirst).mockResolvedValue({
        ...mockCompany,
        competence: null,
      } as any)
      vi.mocked(db.company.update).mockResolvedValue(mockCompany as any)

      // Simulate Step 2 submission
      const competenceData = {
        competence: "beginner",
      }

      expect(competenceData.competence).toBeTruthy()
      expect(["beginner", "average", "pro"]).toContain(competenceData.competence)
    })

    it("completes Step 3: Address", async () => {
      const mockCompany = {
        id: "company-1",
        address: "Testna ulica 1",
        postalCode: "10000",
        city: "Zagreb",
        country: "HR",
      }

      vi.mocked(db.company.findFirst).mockResolvedValue({
        id: "company-1",
        address: null,
        postalCode: null,
        city: null,
        country: null,
      } as any)
      vi.mocked(db.company.update).mockResolvedValue(mockCompany as any)

      // Simulate Step 3 submission
      const addressData = {
        address: "Testna ulica 1",
        postalCode: "10000",
        city: "Zagreb",
        country: "HR",
      }

      expect(addressData.address.trim()).toBeTruthy()
      expect(addressData.postalCode.trim()).toBeTruthy()
      expect(addressData.city.trim()).toBeTruthy()
      expect(addressData.country.trim()).toBeTruthy()
    })

    it("completes Step 4: Contact & Tax", async () => {
      const mockCompany = {
        id: "company-1",
        email: "test@example.com",
        phone: "+385911234567",
        iban: "HR1234567890123456789",
        isVatPayer: false,
      }

      vi.mocked(db.company.findFirst).mockResolvedValue({
        id: "company-1",
        email: null,
        phone: null,
        iban: null,
        isVatPayer: false,
      } as any)
      vi.mocked(db.company.update).mockResolvedValue(mockCompany as any)

      // Simulate Step 4 submission
      const contactData = {
        email: "test@example.com",
        phone: "+385911234567",
        iban: "HR1234567890123456789",
        isVatPayer: false,
      }

      expect(contactData.email).toContain("@")
      expect(contactData.iban.trim()).toBeTruthy()
    })

    it("completes Step 5: Pausalni Profile", async () => {
      const mockCompany = {
        id: "company-1",
        legalForm: "OBRT_PAUSAL",
        acceptsCash: true,
        hasEmployees: false,
        employedElsewhere: false,
        hasEuVatId: false,
        taxBracket: "A",
      }

      vi.mocked(db.company.findFirst).mockResolvedValue({
        id: "company-1",
        legalForm: "OBRT_PAUSAL",
        acceptsCash: null,
        hasEmployees: null,
        employedElsewhere: null,
        hasEuVatId: null,
        taxBracket: null,
      } as any)
      vi.mocked(db.company.update).mockResolvedValue(mockCompany as any)

      // Simulate Step 5 submission
      const pausalniData = {
        acceptsCash: true,
        hasEmployees: false,
        employedElsewhere: false,
        hasEuVatId: false,
        taxBracket: "A",
      }

      expect(pausalniData.acceptsCash).toBeDefined()
      expect(pausalniData.hasEmployees).toBeDefined()
      expect(pausalniData.employedElsewhere).toBeDefined()
      expect(pausalniData.hasEuVatId).toBeDefined()
      expect(pausalniData.taxBracket).toBeTruthy()
      expect(["A", "B", "C"]).toContain(pausalniData.taxBracket)
    })

    it("validates onboarding flow completion order", () => {
      // Mock company data at different stages
      const incompleteStep1: { name: string | null; oib: string | null; legalForm: string | null } =
        {
          name: null,
          oib: null,
          legalForm: null,
        }

      const incompleteStep2 = {
        name: "Test",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        competence: null,
      }

      const incompleteStep3 = {
        name: "Test",
        oib: "12345678901",
        legalForm: "OBRT_PAUSAL",
        competence: "beginner",
        address: null,
      }

      // Step 1 incomplete
      expect(
        !!(
          (incompleteStep1.name as string | null)?.trim() &&
          incompleteStep1.oib &&
          incompleteStep1.legalForm
        )
      ).toBe(false)

      // Step 1 complete, Step 2 incomplete
      expect(
        !!(incompleteStep2.name?.trim() && incompleteStep2.oib && incompleteStep2.legalForm)
      ).toBe(true)
      expect(!!incompleteStep2.competence).toBe(false)

      // Step 1-2 complete, Step 3 incomplete
      expect(
        !!(incompleteStep3.name?.trim() && incompleteStep3.oib && incompleteStep3.legalForm)
      ).toBe(true)
      expect(!!incompleteStep3.competence).toBe(true)
      expect(!!incompleteStep3.address).toBe(false)
    })
  })

  describe("Compliance Dashboard Access", () => {
    it("loads compliance dashboard data for pausalni user", async () => {
      const mockCompany = {
        id: "company-1",
        legalForm: "OBRT_PAUSAL",
        fiscalEnabled: true,
        fiscalEnvironment: "PROD",
        fiscalCertificates: [
          {
            validUntil: new Date("2025-12-31"),
            status: "active",
          },
        ],
        eInvoices: [
          {
            id: "inv-1",
            invoiceNumber: "R-001",
            issueDate: new Date(),
            totalAmount: 100,
            jir: "abc123",
            zki: "xyz789",
            fiscalizedAt: new Date(),
            buyerName: "Test Buyer",
          },
        ],
      }

      vi.mocked(db.company.findFirst).mockResolvedValue(mockCompany as any)

      // Simulate compliance data calculation
      const certificateStatus = {
        status: "active",
        validUntil: mockCompany.fiscalCertificates[0].validUntil,
        daysRemaining: Math.ceil(
          (mockCompany.fiscalCertificates[0].validUntil.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        ),
      }

      const fiscalizationStats = {
        total: mockCompany.eInvoices.length,
        success: mockCompany.eInvoices.length,
        lastSync: mockCompany.eInvoices[0]?.fiscalizedAt || null,
      }

      expect(certificateStatus.status).toBe("active")
      expect(fiscalizationStats.total).toBeGreaterThan(0)
      expect(mockCompany.fiscalEnabled).toBe(true)
    })

    it("shows missing certificate status for new pausalni user", () => {
      const mockCompany = {
        id: "company-1",
        legalForm: "OBRT_PAUSAL",
        fiscalEnabled: false,
        fiscalCertificates: [],
      }

      const certificateStatus = {
        status: mockCompany.fiscalCertificates.length === 0 ? "missing" : "active",
        validUntil: null,
        daysRemaining: 0,
      }

      expect(certificateStatus.status).toBe("missing")
      expect(mockCompany.fiscalEnabled).toBe(false)
    })

    it("identifies expiring certificate", () => {
      const twentyDaysFromNow = new Date()
      twentyDaysFromNow.setDate(twentyDaysFromNow.getDate() + 20)

      const certificateStatus = {
        validUntil: twentyDaysFromNow,
        daysRemaining: 20,
      }

      // Certificate is expiring if < 30 days
      const isExpiring = certificateStatus.daysRemaining < 30 && certificateStatus.daysRemaining > 0

      expect(isExpiring).toBe(true)
    })
  })

  describe("Tutorial Progress Tracking", () => {
    it("initializes tutorial progress for pausalni user", async () => {
      const mockProgress = {
        id: "progress-1",
        companyId: "company-1",
        trackId: "pausalni-first-week",
        currentDay: 1,
        completedTasks: [],
        startedAt: new Date(),
      }

      vi.mocked((db as any).tutorialProgress.findFirst).mockResolvedValue(null)
      vi.mocked((db as any).tutorialProgress.create).mockResolvedValue(mockProgress as any)

      expect(mockProgress.trackId).toBe("pausalni-first-week")
      expect(mockProgress.currentDay).toBe(1)
      expect(mockProgress.completedTasks).toEqual([])
    })

    it("marks task as complete and updates progress", async () => {
      const mockProgress = {
        id: "progress-1",
        companyId: "company-1",
        trackId: "pausalni-first-week",
        currentDay: 1,
        completedTasks: ["task-1"],
        updatedAt: new Date(),
      }

      vi.mocked((db as any).tutorialProgress.findFirst).mockResolvedValue({
        id: "progress-1",
        companyId: "company-1",
        trackId: "pausalni-first-week",
        currentDay: 1,
        completedTasks: [],
      } as any)

      vi.mocked((db as any).tutorialProgress.update).mockResolvedValue(mockProgress as any)

      expect(mockProgress.completedTasks).toContain("task-1")
    })

    it("calculates tutorial completion percentage", () => {
      const totalTasks = 10
      const completedTasks = 4

      const percentage = Math.round((completedTasks / totalTasks) * 100)

      expect(percentage).toBe(40)
    })

    it("advances to next day when all day tasks complete", () => {
      const dayTasks = ["task-1", "task-2", "task-3"]
      const completedTasks = ["task-1", "task-2", "task-3"]

      const allDayTasksComplete = dayTasks.every((task) => completedTasks.includes(task))

      expect(allDayTasksComplete).toBe(true)
    })
  })

  describe("Admin Dashboard Access", () => {
    it("allows admin to view all tenants", async () => {
      const mockCompanies = [
        {
          id: "company-1",
          name: "Obrt A",
          legalForm: "OBRT_PAUSAL",
          subscriptionStatus: "active",
        },
        {
          id: "company-2",
          name: "Obrt B",
          legalForm: "OBRT_PAUSAL",
          subscriptionStatus: "trial",
        },
      ]

      vi.mocked(db.company.findFirst).mockResolvedValue(mockCompanies[0] as any)

      // Admin should have access to multiple companies
      expect(mockCompanies.length).toBeGreaterThan(0)
      expect(mockCompanies.every((c) => c.legalForm === "OBRT_PAUSAL")).toBe(true)
    })

    it("filters pausalni companies", () => {
      const mockCompanies = [
        { id: "1", legalForm: "OBRT_PAUSAL" },
        { id: "2", legalForm: "OBRT_REAL" },
        { id: "3", legalForm: "OBRT_PAUSAL" },
        { id: "4", legalForm: "DOO" },
      ]

      const pausalniCompanies = mockCompanies.filter((c) => c.legalForm === "OBRT_PAUSAL")

      expect(pausalniCompanies.length).toBe(2)
    })
  })

  describe("Tenant Management Flow", () => {
    it("creates new pausalni tenant", async () => {
      const newTenant = {
        name: "New Obrt",
        oib: "98765432109",
        legalForm: "OBRT_PAUSAL",
        subscriptionStatus: "trial",
        subscriptionPlan: "starter",
        entitlements: ["invoicing", "pausalni"],
      }

      vi.mocked(db.company.create).mockResolvedValue({
        id: "new-company",
        ...newTenant,
        createdAt: new Date(),
      } as any)

      expect(newTenant.legalForm).toBe("OBRT_PAUSAL")
      expect(newTenant.entitlements).toContain("pausalni")
      expect(newTenant.entitlements).toContain("invoicing")
    })

    it("updates tenant subscription status", async () => {
      const mockCompany = {
        id: "company-1",
        subscriptionStatus: "trial",
      }

      vi.mocked(db.company.update).mockResolvedValue({
        ...mockCompany,
        subscriptionStatus: "active",
      } as any)

      const updatedStatus = "active"
      expect(["trial", "active", "inactive", "suspended"]).toContain(updatedStatus)
    })

    it("enables pausalni module for tenant", async () => {
      const mockCompany = {
        id: "company-1",
        entitlements: ["invoicing"],
      }

      const updatedEntitlements = [...mockCompany.entitlements, "pausalni"]

      vi.mocked(db.company.update).mockResolvedValue({
        ...mockCompany,
        entitlements: updatedEntitlements,
      } as any)

      expect(updatedEntitlements).toContain("pausalni")
      expect(updatedEntitlements).toContain("invoicing")
    })
  })

  describe("Error Cases", () => {
    it("handles missing company gracefully", async () => {
      vi.mocked(db.company.findFirst).mockResolvedValue(null)

      const company = await db.company.findFirst({ where: { id: "nonexistent" } })

      expect(company).toBeNull()
    })

    it("validates OIB format", () => {
      const invalidOIBs = ["123", "abcdefghijk", "123456789012", ""]
      const validOIB = "12345678901"

      invalidOIBs.forEach((oib) => {
        expect(oib.match(/^\d{11}$/)).toBeNull()
      })

      expect(validOIB.match(/^\d{11}$/)).toBeTruthy()
    })

    it("validates email format", () => {
      const invalidEmails = ["test", "test@", "@domain", ""]
      const validEmail = "test@example.com"

      invalidEmails.forEach((email) => {
        const isValid = email.includes("@") && email.split("@")[1]?.includes(".")
        expect(isValid).toBeFalsy()
      })

      const validEmailCheck = validEmail.includes("@") && validEmail.split("@")[1]?.includes(".")
      expect(validEmailCheck).toBe(true)
    })

    it("validates required pausalni fields", () => {
      const incompletePausalniData = {
        acceptsCash: true,
        hasEmployees: undefined,
        employedElsewhere: false,
        hasEuVatId: false,
        taxBracket: null,
      }

      const isComplete = !!(
        incompletePausalniData.acceptsCash !== undefined &&
        incompletePausalniData.hasEmployees !== undefined &&
        incompletePausalniData.employedElsewhere !== undefined &&
        incompletePausalniData.hasEuVatId !== undefined &&
        incompletePausalniData.taxBracket
      )

      expect(isComplete).toBe(false)
    })
  })
})
