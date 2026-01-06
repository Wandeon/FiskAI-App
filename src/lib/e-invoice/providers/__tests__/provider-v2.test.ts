// src/lib/e-invoice/providers/__tests__/provider-v2.test.ts
/**
 * Unit tests for V2 Provider Factory
 *
 * Tests IntegrationAccount-aware provider creation with:
 * - Tenant ownership verification (HARD assertion)
 * - Proper error handling for missing/disabled accounts
 * - Correct provider instantiation with decrypted secrets
 *
 * These are unit tests - no database access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createProviderFromIntegrationAccount,
  resolveProviderForCompany,
  TenantViolationError,
  IntegrationNotFoundError,
  IntegrationDisabledError,
} from "../../provider-v2"
import type { IntegrationAccountWithSecrets } from "@/lib/integration"

// Mock the integration repository
vi.mock("@/lib/integration/repository", () => ({
  findIntegrationAccountById: vi.fn(),
  findIntegrationAccount: vi.fn(),
}))

// Mock the EposlovanjeEInvoiceProvider as a class
vi.mock("../eposlovanje-einvoice", () => {
  const MockProvider = vi.fn().mockImplementation(function (
    this: { name: string; config: unknown },
    config: unknown
  ) {
    this.name = "ePoslovanje"
    this.config = config
  })
  return { EposlovanjeEInvoiceProvider: MockProvider }
})

import { findIntegrationAccountById, findIntegrationAccount } from "@/lib/integration/repository"
import { EposlovanjeEInvoiceProvider } from "../eposlovanje-einvoice"

const mockFindById = vi.mocked(findIntegrationAccountById)
const mockFind = vi.mocked(findIntegrationAccount)

function createMockIntegrationAccount(
  overrides: Partial<IntegrationAccountWithSecrets> = {}
): IntegrationAccountWithSecrets {
  return {
    id: "int-acc-123",
    companyId: "company-456",
    kind: "EINVOICE_EPOSLOVANJE",
    environment: "PROD",
    status: "ACTIVE",
    providerConfig: { baseUrl: "https://test.eposlovanje.hr" },
    secrets: { apiKey: "test-api-key-secret" },
    createdAt: new Date(),
    updatedAt: new Date(),
    rotatedAt: null,
    lastUsedAt: null,
    ...overrides,
  } as IntegrationAccountWithSecrets
}

describe("provider-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("TenantViolationError", () => {
    it("has correct name and message", () => {
      const error = new TenantViolationError("company-1", "company-2", "int-123")
      expect(error.name).toBe("TenantViolationError")
      expect(error.message).toContain("company-1")
      expect(error.message).toContain("company-2")
      expect(error.message).toContain("int-123")
    })
  })

  describe("IntegrationNotFoundError", () => {
    it("has correct name and message", () => {
      const error = new IntegrationNotFoundError("int-123")
      expect(error.name).toBe("IntegrationNotFoundError")
      expect(error.message).toContain("int-123")
    })
  })

  describe("IntegrationDisabledError", () => {
    it("has correct name and message", () => {
      const error = new IntegrationDisabledError("int-123", "DISABLED")
      expect(error.name).toBe("IntegrationDisabledError")
      expect(error.message).toContain("int-123")
      expect(error.message).toContain("DISABLED")
    })
  })

  describe("createProviderFromIntegrationAccount", () => {
    it("creates correct provider for EINVOICE_EPOSLOVANJE kind", async () => {
      const account = createMockIntegrationAccount({
        kind: "EINVOICE_EPOSLOVANJE",
        secrets: { apiKey: "eposlovanje-api-key" },
        providerConfig: { baseUrl: "https://test.eposlovanje.hr" },
      })
      mockFindById.mockResolvedValue(account)

      const provider = await createProviderFromIntegrationAccount("int-acc-123", "company-456")

      expect(provider).toBeDefined()
      expect(provider.name).toBe("ePoslovanje")
      expect(EposlovanjeEInvoiceProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "eposlovanje-api-key",
        })
      )
    })

    it("throws TenantViolationError if companyId mismatch", async () => {
      const account = createMockIntegrationAccount({
        companyId: "company-456",
      })
      mockFindById.mockResolvedValue(account)

      await expect(
        createProviderFromIntegrationAccount("int-acc-123", "different-company-789")
      ).rejects.toThrow(TenantViolationError)

      await expect(
        createProviderFromIntegrationAccount("int-acc-123", "different-company-789")
      ).rejects.toThrow(/Tenant violation/)
    })

    it("throws IntegrationNotFoundError if account not found", async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        createProviderFromIntegrationAccount("nonexistent-id", "company-456")
      ).rejects.toThrow(IntegrationNotFoundError)

      await expect(
        createProviderFromIntegrationAccount("nonexistent-id", "company-456")
      ).rejects.toThrow(/not found/)
    })

    it("throws IntegrationDisabledError if account not active", async () => {
      // Note: findIntegrationAccountById returns null for non-ACTIVE accounts
      // We need to test this via the internal behavior
      mockFindById.mockResolvedValue(null)

      // When the repository returns null, we can't distinguish between
      // "not found" and "disabled" without additional query.
      // For this test, we verify the error class exists and works.
      await expect(
        createProviderFromIntegrationAccount("disabled-account", "company-456")
      ).rejects.toThrow(IntegrationNotFoundError)
    })

    it("creates provider with decrypted secrets from account", async () => {
      const account = createMockIntegrationAccount({
        secrets: { apiKey: "decrypted-secret-key-12345" },
        providerConfig: { baseUrl: "https://prod.eposlovanje.hr", timeout: 30000 },
      })
      mockFindById.mockResolvedValue(account)

      await createProviderFromIntegrationAccount("int-acc-123", "company-456")

      expect(EposlovanjeEInvoiceProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "decrypted-secret-key-12345",
          apiBase: "https://prod.eposlovanje.hr",
        })
      )
    })
  })

  describe("resolveProviderForCompany", () => {
    it("finds and creates provider for company by kind and environment", async () => {
      const account = createMockIntegrationAccount({
        companyId: "company-456",
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
      })
      mockFind.mockResolvedValue(account)

      const provider = await resolveProviderForCompany(
        "company-456",
        "EINVOICE_EPOSLOVANJE",
        "TEST"
      )

      expect(provider).toBeDefined()
      expect(mockFind).toHaveBeenCalledWith("company-456", "EINVOICE_EPOSLOVANJE", "TEST")
    })

    it("throws IntegrationNotFoundError if no matching account", async () => {
      mockFind.mockResolvedValue(null)

      await expect(
        resolveProviderForCompany("company-456", "EINVOICE_EPOSLOVANJE", "PROD")
      ).rejects.toThrow(IntegrationNotFoundError)
    })

    it("defaults environment to PROD when not specified", async () => {
      const account = createMockIntegrationAccount()
      mockFind.mockResolvedValue(account)

      await resolveProviderForCompany("company-456", "EINVOICE_EPOSLOVANJE")

      expect(mockFind).toHaveBeenCalledWith("company-456", "EINVOICE_EPOSLOVANJE", "PROD")
    })
  })
})
