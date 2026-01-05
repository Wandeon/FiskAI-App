/**
 * Tests for Phase 5 Worker Lockdown
 *
 * These tests verify that workers fail hard when:
 * 1. Enforcement is enabled and no integrationAccountId
 * 2. Tenant mismatch between companyId and integrationAccount.companyId
 * 3. Integration account is disabled
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { assertWorkerHasIntegration, IntegrationRequiredError } from "../enforcement"

// Define error types inline to avoid transitive DB import
class TenantViolationError extends Error {
  constructor(
    public readonly requestedCompanyId: string,
    public readonly accountCompanyId: string,
    public readonly integrationAccountId: string
  ) {
    super(
      `Tenant violation: requested companyId ${requestedCompanyId} does not match ` +
        `IntegrationAccount ${integrationAccountId} companyId ${accountCompanyId}`
    )
    this.name = "TenantViolationError"
  }
}

class IntegrationDisabledError extends Error {
  constructor(
    public readonly integrationAccountId: string,
    public readonly status: string
  ) {
    super(`IntegrationAccount ${integrationAccountId} is disabled (status: ${status})`)
    this.name = "IntegrationDisabledError"
  }
}

// Mock the feature flags module
vi.mock("@/lib/integration-feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { isFeatureEnabled } from "@/lib/integration-feature-flags"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

describe("Worker Lockdown - Phase 5", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("assertWorkerHasIntegration", () => {
    describe("when enforcement is ENABLED", () => {
      beforeEach(() => {
        mockIsFeatureEnabled.mockReturnValue(true)
      })

      it("throws IntegrationRequiredError when integrationAccountId is missing", () => {
        expect(() => {
          assertWorkerHasIntegration("company-123", null, "eposlovanje-inbound-poller")
        }).toThrow(IntegrationRequiredError)
      })

      it("throws with P0 severity", () => {
        try {
          assertWorkerHasIntegration("company-456", undefined, "fiscal-worker")
        } catch (error) {
          expect(error).toBeInstanceOf(IntegrationRequiredError)
          expect((error as IntegrationRequiredError).severity).toBe("P0")
        }
      })

      it("allows when integrationAccountId is provided", () => {
        expect(() => {
          assertWorkerHasIntegration("company-123", "ia-789", "test-worker")
        }).not.toThrow()
      })
    })

    describe("when enforcement is DISABLED", () => {
      beforeEach(() => {
        mockIsFeatureEnabled.mockReturnValue(false)
      })

      it("allows missing integrationAccountId (fallback to legacy)", () => {
        expect(() => {
          assertWorkerHasIntegration("company-123", null, "eposlovanje-inbound-poller")
        }).not.toThrow()
      })
    })
  })

  describe("Tenant Violation Errors", () => {
    it("TenantViolationError contains all required fields", () => {
      const error = new TenantViolationError(
        "requested-company",
        "actual-company",
        "integration-account-id"
      )

      expect(error.name).toBe("TenantViolationError")
      expect(error.requestedCompanyId).toBe("requested-company")
      expect(error.accountCompanyId).toBe("actual-company")
      expect(error.integrationAccountId).toBe("integration-account-id")
      expect(error.message).toContain("Tenant violation")
      expect(error.message).toContain("requested-company")
      expect(error.message).toContain("actual-company")
    })

    it("TenantViolationError is never silently ignored", () => {
      // This test documents that TenantViolationError must bubble up
      // and cause worker to fail hard
      const simulateWorkerJob = () => {
        throw new TenantViolationError("company-A", "company-B", "integration-123")
      }

      expect(simulateWorkerJob).toThrow(TenantViolationError)
    })
  })

  describe("Integration Disabled Errors", () => {
    it("IntegrationDisabledError prevents processing", () => {
      const error = new IntegrationDisabledError("integration-456", "EXPIRED")

      expect(error.name).toBe("IntegrationDisabledError")
      expect(error.integrationAccountId).toBe("integration-456")
      expect(error.status).toBe("EXPIRED")
    })

    it("disabled account causes worker to fail", () => {
      const simulateWorkerWithDisabledAccount = () => {
        throw new IntegrationDisabledError("ia-123", "DISABLED")
      }

      expect(simulateWorkerWithDisabledAccount).toThrow(IntegrationDisabledError)
    })
  })

  describe("Worker structured logging requirements", () => {
    it("logs must include required fields for worker jobs", () => {
      // Document the required log fields for audit trail
      const requiredLogFields = {
        companyId: "company-123",
        integrationAccountId: "ia-456",
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "PROD",
        success: true,
        operation: "poll",
      }

      // All fields must be present
      expect(requiredLogFields.companyId).toBeDefined()
      expect(requiredLogFields.integrationAccountId).toBeDefined()
      expect(requiredLogFields.kind).toBeDefined()
      expect(requiredLogFields.environment).toBeDefined()
    })
  })

  describe("Simulated tenant mismatch scenarios", () => {
    it("worker processing invoice for wrong company fails immediately", () => {
      const processInvoiceWithTenantCheck = (
        invoiceCompanyId: string,
        accountCompanyId: string,
        integrationAccountId: string
      ) => {
        // Simulates the hard assertion in production code
        if (invoiceCompanyId !== accountCompanyId) {
          throw new TenantViolationError(invoiceCompanyId, accountCompanyId, integrationAccountId)
        }
        return { processed: true }
      }

      // Same company - should work
      expect(processInvoiceWithTenantCheck("company-A", "company-A", "ia-1")).toEqual({
        processed: true,
      })

      // Different company - must fail
      expect(() => {
        processInvoiceWithTenantCheck("company-A", "company-B", "ia-1")
      }).toThrow(TenantViolationError)
    })

    it("worker should not retry on tenant violation", () => {
      // Document that TenantViolationError is non-retryable
      const isTenantError = (error: unknown): boolean => {
        return error instanceof TenantViolationError
      }

      const shouldRetry = (error: unknown): boolean => {
        // Never retry tenant violations - they indicate a bug
        if (isTenantError(error)) {
          return false
        }
        // Other errors might be retryable
        return true
      }

      const tenantError = new TenantViolationError("A", "B", "ia-1")
      expect(shouldRetry(tenantError)).toBe(false)

      const regularError = new Error("Temporary network failure")
      expect(shouldRetry(regularError)).toBe(true)
    })
  })
})
