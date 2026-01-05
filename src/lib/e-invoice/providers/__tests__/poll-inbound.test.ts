/**
 * Tests for Dual-Path Polling Orchestrator
 *
 * Unit tests that mock external dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Create hoisted mocks before vi.mock calls
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
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

// Mock all external dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: mockDb,
}))

vi.mock("@/lib/integration", () => ({
  findIntegrationAccount: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock poll-inbound-v2 - use vi.hoisted to properly hoist the mock
const { mockPollInboundForAccount } = vi.hoisted(() => ({
  mockPollInboundForAccount: vi.fn(),
}))

vi.mock("../../poll-inbound-v2", () => ({
  pollInboundForAccount: mockPollInboundForAccount,
}))

// Mock the provider
const mockFetchIncomingInvoices = vi.fn()
const mockTestConnection = vi.fn()

vi.mock("../eposlovanje-einvoice", () => {
  return {
    EposlovanjeEInvoiceProvider: class MockEposlovanjeProvider {
      fetchIncomingInvoices = mockFetchIncomingInvoices
      testConnection = mockTestConnection
    },
  }
})

// Now import the module under test (no db import - use mockDb instead)
import { pollInbound, getPollPath, isV2Result } from "../../poll-inbound"
import { findIntegrationAccount } from "@/lib/integration"

describe("Dual-Path Polling Orchestrator", () => {
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

  const v2Result = {
    integrationAccountId: "acc-123",
    companyId: "comp-456",
    success: true,
    fetched: 5,
    inserted: 3,
    skipped: 2,
    errors: 0,
    errorMessages: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockTestConnection.mockResolvedValue(true)
    mockFetchIncomingInvoices.mockResolvedValue([])
    mockPollInboundForAccount.mockResolvedValue(v2Result)

    // Reset environment variable
    delete process.env.USE_INTEGRATION_ACCOUNT_INBOUND
    delete process.env.EPOSLOVANJE_API_BASE
    delete process.env.EPOSLOVANJE_API_KEY

    // Setup default mock for providerSyncState.findUnique
    mockDb.providerSyncState.findUnique.mockResolvedValue({
      id: "sync-1",
      lastSuccessfulPollAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.USE_INTEGRATION_ACCOUNT_INBOUND
    delete process.env.EPOSLOVANJE_API_BASE
    delete process.env.EPOSLOVANJE_API_KEY
  })

  describe("pollInbound", () => {
    describe("when feature flag is disabled", () => {
      it("uses V1 path when flag is not set", async () => {
        process.env.EPOSLOVANJE_API_BASE = "https://api.test.com"
        process.env.EPOSLOVANJE_API_KEY = "test-key"

        const result = await pollInbound("comp-456")

        expect(findIntegrationAccount).not.toHaveBeenCalled()
        expect(mockPollInboundForAccount).not.toHaveBeenCalled()
        expect(result.companyId).toBe("comp-456")
        expect("integrationAccountId" in result).toBe(false)
      })

      it("uses V1 path when flag is explicitly false", async () => {
        process.env.USE_INTEGRATION_ACCOUNT_INBOUND = "false"
        process.env.EPOSLOVANJE_API_BASE = "https://api.test.com"
        process.env.EPOSLOVANJE_API_KEY = "test-key"

        const result = await pollInbound("comp-456")

        expect(findIntegrationAccount).not.toHaveBeenCalled()
        expect(mockPollInboundForAccount).not.toHaveBeenCalled()
        expect(isV2Result(result)).toBe(false)
      })

      it("returns error when V1 env vars not set", async () => {
        const result = await pollInbound("comp-456")

        expect(result.success).toBe(false)
        expect(result.errorMessages).toContain(
          "V1: EPOSLOVANJE_API_BASE and EPOSLOVANJE_API_KEY required"
        )
      })
    })

    describe("when feature flag is enabled", () => {
      beforeEach(() => {
        process.env.USE_INTEGRATION_ACCOUNT_INBOUND = "true"
      })

      it("uses V2 path when IntegrationAccount exists", async () => {
        vi.mocked(findIntegrationAccount).mockResolvedValue(mockAccount)

        const result = await pollInbound("comp-456")

        expect(findIntegrationAccount).toHaveBeenCalledWith(
          "comp-456",
          "EINVOICE_EPOSLOVANJE",
          "PROD"
        )
        expect(mockPollInboundForAccount).toHaveBeenCalledWith("acc-123", "comp-456")
        expect(isV2Result(result)).toBe(true)
        if (isV2Result(result)) {
          expect(result.integrationAccountId).toBe("acc-123")
        }
      })

      it("falls back to V1 when no IntegrationAccount found", async () => {
        vi.mocked(findIntegrationAccount).mockResolvedValue(null)
        process.env.EPOSLOVANJE_API_BASE = "https://api.test.com"
        process.env.EPOSLOVANJE_API_KEY = "test-key"

        const result = await pollInbound("comp-456")

        expect(findIntegrationAccount).toHaveBeenCalled()
        expect(mockPollInboundForAccount).not.toHaveBeenCalled()
        expect(isV2Result(result)).toBe(false)
      })

      it("falls back to V1 with error when no account and no env vars", async () => {
        vi.mocked(findIntegrationAccount).mockResolvedValue(null)

        const result = await pollInbound("comp-456")

        expect(result.success).toBe(false)
        expect(result.errorMessages).toContain(
          "V1: EPOSLOVANJE_API_BASE and EPOSLOVANJE_API_KEY required"
        )
      })
    })
  })

  describe("getPollPath", () => {
    it("returns v1 when feature flag disabled", async () => {
      const path = await getPollPath("comp-456")
      expect(path).toBe("v1")
    })

    it("returns v2 when flag enabled and account exists", async () => {
      process.env.USE_INTEGRATION_ACCOUNT_INBOUND = "true"
      vi.mocked(findIntegrationAccount).mockResolvedValue(mockAccount)

      const path = await getPollPath("comp-456")

      expect(path).toBe("v2")
    })

    it("returns v1 when flag enabled but no account", async () => {
      process.env.USE_INTEGRATION_ACCOUNT_INBOUND = "true"
      vi.mocked(findIntegrationAccount).mockResolvedValue(null)

      const path = await getPollPath("comp-456")

      expect(path).toBe("v1")
    })
  })

  describe("isV2Result", () => {
    it("returns true for V2 result", () => {
      expect(isV2Result(v2Result)).toBe(true)
    })

    it("returns false for V1 result", () => {
      const v1Result = {
        companyId: "comp-456",
        success: true,
        fetched: 5,
        inserted: 3,
        skipped: 2,
        errors: 0,
        errorMessages: [],
      }
      expect(isV2Result(v1Result)).toBe(false)
    })
  })
})
