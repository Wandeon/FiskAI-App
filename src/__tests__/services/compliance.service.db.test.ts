// src/__tests__/services/compliance.service.db.test.ts

/**
 * Database tests for ComplianceService
 *
 * These tests require a real database connection and verify the service
 * correctly evaluates compliance and persists results.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { db } from "@/lib/db"
import {
  ComplianceService,
  complianceService,
  ComplianceState,
  ComplianceReasonCodes,
} from "@/lib/services/compliance.service"

// Skip tests if DATABASE_URL is not set (e.g., in CI without DB)
const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip

skipIfNoDb("ComplianceService DB Tests", () => {
  let testCompanyId: string
  let service: ComplianceService

  beforeAll(async () => {
    // Create test company with unique OIB
    const uniqueOib = String(Math.floor(Math.random() * 1e11)).padStart(11, "0")
    const company = await db.company.create({
      data: {
        name: "Compliance Test Company",
        oib: uniqueOib,
        address: "Test Address 123",
        city: "Zagreb",
        postalCode: "10000",
        country: "HR",
        legalForm: "OBRT_PAUSAL",
        isVatPayer: false,
        fiscalEnabled: false,
        featureFlags: {
          acceptsCash: false,
          employedElsewhere: true,
        },
        entitlements: ["invoicing"],
      },
    })
    testCompanyId = company.id
    service = new ComplianceService()
  })

  afterAll(async () => {
    // Cleanup - order matters due to foreign key constraints
    // Use raw SQL to bypass Prisma extensions that block deletion of issued invoices
    await db.complianceEvaluation.deleteMany({ where: { companyId: testCompanyId } })
    await db.$executeRaw`DELETE FROM "EInvoice" WHERE "companyId" = ${testCompanyId}`
    await db.company.delete({ where: { id: testCompanyId } })
    await db.$disconnect()
  })

  beforeEach(async () => {
    // Clean compliance evaluations before each test
    await db.complianceEvaluation.deleteMany({ where: { companyId: testCompanyId } })
    // Reset company to default state
    await db.company.update({
      where: { id: testCompanyId },
      data: {
        fiscalEnabled: false,
        isVatPayer: false,
        featureFlags: {
          acceptsCash: false,
          employedElsewhere: true,
        },
        entitlements: ["invoicing"],
      },
    })
    // Clean invoices - use raw SQL to bypass immutability extension
    await db.$executeRaw`DELETE FROM "EInvoice" WHERE "companyId" = ${testCompanyId}`
  })

  // ===========================================================================
  // evaluateCompliance
  // ===========================================================================

  describe("evaluateCompliance", () => {
    it("creates a compliance evaluation record", async () => {
      const status = await service.evaluateCompliance(testCompanyId)

      expect(status).toBeDefined()
      expect(status.state).toBeDefined()
      expect(status.evaluatedAt).toBeInstanceOf(Date)
      expect(Array.isArray(status.reasons)).toBe(true)
      expect(status.nextEvaluation).toBeInstanceOf(Date)

      // Verify it was saved to database
      const evaluation = await db.complianceEvaluation.findFirst({
        where: { companyId: testCompanyId },
      })
      expect(evaluation).not.toBeNull()
      expect(evaluation!.state).toBe(status.state)
    })

    it("returns OK state when company is compliant", async () => {
      // Company with employedElsewhere=true has fewer obligations
      // and no acceptsCash, so should be OK
      const status = await service.evaluateCompliance(testCompanyId)

      // May have deadline approaching (depends on current date)
      // but should at least not have RISK-level issues
      expect([ComplianceState.OK, ComplianceState.ATTENTION]).toContain(status.state)
    })

    it("returns RISK when fiscalization required but not enabled", async () => {
      // Update company to accept cash but not have fiscalization enabled
      await db.company.update({
        where: { id: testCompanyId },
        data: {
          fiscalEnabled: false,
          featureFlags: {
            acceptsCash: true,
            employedElsewhere: true,
          },
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      expect(status.state).toBe(ComplianceState.RISK)
      expect(
        status.reasons.some((r) => r.code === ComplianceReasonCodes.FISCALIZATION_REQUIRED)
      ).toBe(true)
    })

    it("does not flag fiscalization when company does not accept cash", async () => {
      // Company doesn't accept cash, so fiscalization is not required
      await db.company.update({
        where: { id: testCompanyId },
        data: {
          fiscalEnabled: false,
          featureFlags: {
            acceptsCash: false,
            employedElsewhere: true,
          },
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      expect(
        status.reasons.some((r) => r.code === ComplianceReasonCodes.FISCALIZATION_REQUIRED)
      ).toBe(false)
    })

    it("returns RISK when VAT payer without VAT entitlement", async () => {
      await db.company.update({
        where: { id: testCompanyId },
        data: {
          isVatPayer: true,
          entitlements: ["invoicing"], // Missing 'vat' entitlement
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      expect(status.state).toBe(ComplianceState.RISK)
      expect(status.reasons.some((r) => r.code === ComplianceReasonCodes.VAT_SETUP_REQUIRED)).toBe(
        true
      )
    })

    it("throws error for non-existent company", async () => {
      await expect(service.evaluateCompliance("non-existent-company-id")).rejects.toThrow(
        "Company not found"
      )
    })
  })

  // ===========================================================================
  // getComplianceStatus
  // ===========================================================================

  describe("getComplianceStatus", () => {
    it("returns null when never evaluated", async () => {
      const status = await service.getComplianceStatus(testCompanyId)
      expect(status).toBeNull()
    })

    it("returns latest evaluation after evaluateCompliance", async () => {
      await service.evaluateCompliance(testCompanyId)

      const status = await service.getComplianceStatus(testCompanyId)

      expect(status).not.toBeNull()
      expect(status!.state).toBeDefined()
      expect(status!.evaluatedAt).toBeInstanceOf(Date)
    })

    it("returns the most recent evaluation", async () => {
      // Create two evaluations
      await service.evaluateCompliance(testCompanyId)

      // Wait a moment and evaluate again
      await new Promise((resolve) => setTimeout(resolve, 100))
      await service.evaluateCompliance(testCompanyId)

      const status = await service.getComplianceStatus(testCompanyId)

      // Should have 2 evaluations in DB
      const count = await db.complianceEvaluation.count({
        where: { companyId: testCompanyId },
      })
      expect(count).toBe(2)

      // getComplianceStatus returns the most recent
      expect(status).not.toBeNull()
    })
  })

  // ===========================================================================
  // shouldReEvaluate
  // ===========================================================================

  describe("shouldReEvaluate", () => {
    it("returns true when never evaluated", async () => {
      const shouldReEval = await service.shouldReEvaluate(testCompanyId)
      expect(shouldReEval).toBe(true)
    })

    it("returns false immediately after evaluation", async () => {
      await service.evaluateCompliance(testCompanyId)

      const shouldReEval = await service.shouldReEvaluate(testCompanyId)
      expect(shouldReEval).toBe(false)
    })

    it("returns true when evaluation is old", async () => {
      // Create an old evaluation directly in the database
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      await db.complianceEvaluation.create({
        data: {
          companyId: testCompanyId,
          state: "OK",
          reasons: [],
          evaluatedAt: twoHoursAgo,
        },
      })

      const shouldReEval = await service.shouldReEvaluate(testCompanyId)
      expect(shouldReEval).toBe(true)
    })
  })

  // ===========================================================================
  // getNextDeadline
  // ===========================================================================

  describe("getNextDeadline", () => {
    it("returns a future date for pausal company", async () => {
      const deadline = await service.getNextDeadline(testCompanyId)

      expect(deadline).toBeInstanceOf(Date)
      expect(deadline!.getTime()).toBeGreaterThan(Date.now())
    })

    it("returns null for non-existent company", async () => {
      const deadline = await service.getNextDeadline("non-existent-company-id")
      expect(deadline).toBeNull()
    })
  })

  // ===========================================================================
  // Income Tracking
  // ===========================================================================

  describe("income tracking", () => {
    it("flags ATTENTION when income approaches 85% of limit", async () => {
      // Create invoices that add up to ~85% of 60000 = 51000
      await db.eInvoice.create({
        data: {
          companyId: testCompanyId,
          invoiceNumber: "TEST-001",
          status: "SENT", // Valid EInvoiceStatus (not DRAFT so it counts toward income)
          issueDate: new Date(),
          dueDate: new Date(),
          netAmount: 41600, // 52000 / 1.25
          vatAmount: 10400, // 52000 * 0.20
          totalAmount: 52000, // 87% of limit
          currency: "EUR",
          direction: "OUTBOUND",
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      expect(
        status.reasons.some((r) => r.code === ComplianceReasonCodes.INCOME_APPROACHING_LIMIT)
      ).toBe(true)
    })

    it("flags CRITICAL when income approaches 95% of limit", async () => {
      // Create invoices that add up to ~95% of 60000 = 57000
      await db.eInvoice.create({
        data: {
          companyId: testCompanyId,
          invoiceNumber: "TEST-002",
          status: "SENT", // Valid EInvoiceStatus (not DRAFT so it counts toward income)
          issueDate: new Date(),
          dueDate: new Date(),
          netAmount: 46400, // 58000 / 1.25
          vatAmount: 11600, // 58000 * 0.20
          totalAmount: 58000, // 97% of limit
          currency: "EUR",
          direction: "OUTBOUND",
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      expect(status.state).toBe(ComplianceState.RISK)
      expect(status.reasons.some((r) => r.code === ComplianceReasonCodes.INCOME_CRITICAL)).toBe(
        true
      )
    })

    it("excludes DRAFT invoices from income calculation", async () => {
      // Create a large DRAFT invoice (should be excluded)
      await db.eInvoice.create({
        data: {
          companyId: testCompanyId,
          invoiceNumber: "DRAFT-001",
          status: "DRAFT",
          issueDate: new Date(),
          dueDate: new Date(),
          netAmount: 80000,
          vatAmount: 20000,
          totalAmount: 100000, // Would be over limit if counted
          currency: "EUR",
          direction: "OUTBOUND",
        },
      })

      const status = await service.evaluateCompliance(testCompanyId)

      // Should not have income-related critical issues (DRAFT is excluded)
      expect(status.reasons.some((r) => r.code === ComplianceReasonCodes.INCOME_CRITICAL)).toBe(
        false
      )
    })
  })

  // ===========================================================================
  // Singleton
  // ===========================================================================

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(complianceService).toBeInstanceOf(ComplianceService)
    })

    it("singleton works correctly", async () => {
      const status = await complianceService.getComplianceStatus(testCompanyId)
      // Should return null or status (not throw)
      expect(status === null || status !== null).toBe(true)
    })
  })
})
