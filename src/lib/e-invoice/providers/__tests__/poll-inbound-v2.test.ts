/**
 * Tests for V2 Inbound Polling with IntegrationAccount
 *
 * Unit tests that mock external dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock all external dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    providerSyncState: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
    },
    eInvoice: {
      create: vi.fn().mockResolvedValue({}),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/integration", () => ({
  findIntegrationAccountById: vi.fn(),
  findIntegrationAccount: vi.fn(),
  touchIntegrationAccount: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/integration/types", () => ({
  parseEInvoiceSecrets: vi.fn().mockReturnValue({ apiKey: "test-api-key" }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create mock functions at module scope
const mockFetchIncomingInvoices = vi.fn()
const mockTestConnection = vi.fn()

// Mock the provider module - path must match what poll-inbound-v2.ts imports
// poll-inbound-v2.ts uses: "./providers/eposlovanje-einvoice"
// From test perspective (providers/__tests__/), same module is: "../eposlovanje-einvoice"
vi.mock("../eposlovanje-einvoice", () => {
  return {
    EposlovanjeEInvoiceProvider: class MockEposlovanjeProvider {
      fetchIncomingInvoices = mockFetchIncomingInvoices
      testConnection = mockTestConnection
    },
  }
})

// Now import the module under test
import { pollInboundForAccount, pollInboundForCompany } from "../../poll-inbound-v2"
import { findIntegrationAccountById, findIntegrationAccount } from "@/lib/integration"
import { db } from "@/lib/db"

describe("Poll Inbound V2", () => {
  const mockAccount = {
    id: "acc-123",
    companyId: "comp-456",
    kind: "EINVOICE_EPOSLOVANJE" as const,
    environment: "PROD" as const,
    status: "ACTIVE" as const,
    providerConfig: { baseUrl: "https://api.eposlovanje.hr" },
    secrets: { apiKey: "test-api-key" },
    createdAt: new Date(),
    updatedAt: new Date(),
    rotatedAt: null,
    lastUsedAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockTestConnection.mockResolvedValue(true)
    mockFetchIncomingInvoices.mockResolvedValue([])

    // Setup default mock for providerSyncState.findUnique
    vi.mocked(db.providerSyncState.findUnique).mockResolvedValue({
      id: "sync-1",
      lastSuccessfulPollAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      integrationAccountId: "acc-123",
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("pollInboundForAccount", () => {
    it("throws TenantViolationError if companyId mismatch", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)

      await expect(pollInboundForAccount("acc-123", "wrong-company")).rejects.toThrow(
        "does not match IntegrationAccount"
      )
    })

    it("throws IntegrationNotFoundError if account not found", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(null)

      await expect(pollInboundForAccount("nonexistent", "comp-456")).rejects.toThrow(
        "IntegrationAccount not found"
      )
    })

    it("throws IntegrationDisabledError if account not active", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: "DISABLED" as const,
      })

      await expect(pollInboundForAccount("acc-123", "comp-456")).rejects.toThrow("is disabled")
    })

    it("returns poll result with integrationAccountId on success", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)

      const result = await pollInboundForAccount("acc-123", "comp-456")

      expect(result.integrationAccountId).toBe("acc-123")
      expect(result.companyId).toBe("comp-456")
      expect(result.success).toBe(true)
      expect(result.fetched).toBe(0)
      expect(result.inserted).toBe(0)
    })

    it("returns failure if provider connectivity test fails", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
      mockTestConnection.mockResolvedValue(false)

      const result = await pollInboundForAccount("acc-123", "comp-456")

      expect(result.success).toBe(false)
      expect(result.errorMessages).toContain("Provider connectivity test failed")
    })

    it("creates sync state if not exists", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
      vi.mocked(db.providerSyncState.findUnique).mockResolvedValue(null)
      vi.mocked(db.providerSyncState.create).mockResolvedValue({
        id: "new-sync-1",
        lastSuccessfulPollAt: new Date(),
      } as never)

      await pollInboundForAccount("acc-123", "comp-456")

      expect(db.providerSyncState.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: "comp-456",
            provider: "eposlovanje",
            direction: "INBOUND",
            integrationAccountId: "acc-123",
          }),
        })
      )
    })

    it("updates sync state integrationAccountId if not set", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
      vi.mocked(db.providerSyncState.findUnique).mockResolvedValue({
        id: "sync-1",
        lastSuccessfulPollAt: new Date(),
        integrationAccountId: null, // Not set
      } as never)

      await pollInboundForAccount("acc-123", "comp-456")

      expect(db.providerSyncState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sync-1" },
          data: { integrationAccountId: "acc-123" },
        })
      )
    })
  })

  describe("pollInboundForCompany", () => {
    it("resolves IntegrationAccount and polls", async () => {
      vi.mocked(findIntegrationAccount).mockResolvedValue(mockAccount)
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)

      const result = await pollInboundForCompany("comp-456", "EINVOICE_EPOSLOVANJE", "PROD")

      expect(findIntegrationAccount).toHaveBeenCalledWith(
        "comp-456",
        "EINVOICE_EPOSLOVANJE",
        "PROD"
      )
      expect(result.integrationAccountId).toBe("acc-123")
    })

    it("throws if no IntegrationAccount found", async () => {
      vi.mocked(findIntegrationAccount).mockResolvedValue(null)

      await expect(
        pollInboundForCompany("comp-456", "EINVOICE_EPOSLOVANJE", "PROD")
      ).rejects.toThrow("IntegrationAccount not found")
    })
  })
})
