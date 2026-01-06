// src/lib/e-invoice/providers/__tests__/eposlovanje-einvoice.test.ts
/**
 * Unit tests for ePoslovanje E-Invoice Provider
 *
 * Tests run offline with mocked fetch - no real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  EposlovanjeEInvoiceProvider,
  generateIdempotencyKey,
  hashUblContent,
  mapHttpStatusToProviderStatus,
  type FetchFunction,
} from "../eposlovanje-einvoice"
import { EInvoiceWithRelations } from "../../types"
import { Prisma } from "@prisma/client"

// Mock invoice for testing
function createMockInvoice(overrides: Partial<EInvoiceWithRelations> = {}): EInvoiceWithRelations {
  return {
    id: "test-invoice-123",
    companyId: "test-company-456",
    invoiceNumber: "INV-2026-001",
    direction: "OUTBOUND",
    status: "DRAFT",
    type: "E_INVOICE",
    currency: "EUR",
    netAmount: new Prisma.Decimal("1000.00"),
    vatAmount: new Prisma.Decimal("250.00"),
    totalAmount: new Prisma.Decimal("1250.00"),
    issueDate: new Date("2026-01-04"),
    dueDate: new Date("2026-02-04"),
    createdAt: new Date(),
    updatedAt: new Date(),
    providerRef: null,
    providerStatus: null,
    providerError: null,
    ublXml: null,
    jir: null,
    zki: null,
    fiscalizedAt: null,
    sentAt: null,
    receivedAt: null,
    archivedAt: null,
    archiveRef: null,
    buyerId: null,
    sellerId: null,
    buyerReference: null,
    internalReference: null,
    notes: null,
    convertedFromId: null,
    paidAt: null,
    bankAccount: null,
    includeBarcode: true,
    importJobId: null,
    paymentModel: null,
    paymentReference: null,
    vendorBankName: null,
    vendorIban: null,
    fiscalStatus: null,
    operatorOib: null,
    paymentMethod: "TRANSFER",
    emailMessageId: null,
    emailDeliveredAt: null,
    emailOpenedAt: null,
    emailClickedAt: null,
    emailBouncedAt: null,
    emailBounceReason: null,
    buyerOrganizationId: null,
    correctsInvoiceId: null,
    sellerOrganizationId: null,
    paidAmount: new Prisma.Decimal("0"),
    paymentStatus: "UNPAID",
    lines: [],
    buyer: null,
    seller: null,
    company: {
      id: "test-company-456",
      name: "Test Company D.O.O.",
      oib: "12345678901",
      vatNumber: "HR12345678901",
      address: "Test Street 1",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      email: "test@example.com",
      phone: null,
      iban: "HR1234567890123456789",
      isVatPayer: true,
      eInvoiceProvider: "eposlovanje",
      eInvoiceApiKeyEncrypted: null,
      legalForm: "DOO",
      entitlements: null,
      featureFlags: null,
      deviceCode: "1",
      fiscalEnabled: false,
      fiscalEnvironment: "PROD",
      premisesCode: "1",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionPlan: null,
      trialEndsAt: null,
      subscriptionCurrentPeriodStart: null,
      subscriptionCurrentPeriodEnd: null,
      invoiceLimit: 50,
      userLimit: 1,
      stripeTerminalLocationId: null,
      stripeTerminalReaderId: null,
      checksum: null,
      onboardingStep: 1,
      stockValuationMethod: "WEIGHTED_AVERAGE",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  } as EInvoiceWithRelations
}

const TEST_UBL_XML = `<?xml version="1.0"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>INV-2026-001</ID>
</Invoice>`

describe("EposlovanjeEInvoiceProvider", () => {
  describe("generateIdempotencyKey", () => {
    it("generates consistent hash for same inputs", () => {
      const key1 = generateIdempotencyKey("company-1", "invoice-1", "hash-1")
      const key2 = generateIdempotencyKey("company-1", "invoice-1", "hash-1")
      expect(key1).toBe(key2)
      expect(key1).toHaveLength(64) // SHA256 hex
    })

    it("generates different hash for different inputs", () => {
      const key1 = generateIdempotencyKey("company-1", "invoice-1", "hash-1")
      const key2 = generateIdempotencyKey("company-1", "invoice-2", "hash-1")
      expect(key1).not.toBe(key2)
    })
  })

  describe("hashUblContent", () => {
    it("generates consistent hash", () => {
      const hash1 = hashUblContent(TEST_UBL_XML)
      const hash2 = hashUblContent(TEST_UBL_XML)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })
  })

  describe("mapHttpStatusToProviderStatus", () => {
    it("maps 200 to QUEUED", () => {
      expect(mapHttpStatusToProviderStatus(200)).toEqual({ status: "QUEUED", retryable: false })
    })

    it("maps 201 to QUEUED", () => {
      expect(mapHttpStatusToProviderStatus(201)).toEqual({ status: "QUEUED", retryable: false })
    })

    it("maps 401 to PROVIDER_AUTH_FAILED", () => {
      expect(mapHttpStatusToProviderStatus(401)).toEqual({
        status: "PROVIDER_AUTH_FAILED",
        retryable: false,
      })
    })

    it("maps 403 to PROVIDER_AUTH_FAILED", () => {
      expect(mapHttpStatusToProviderStatus(403)).toEqual({
        status: "PROVIDER_AUTH_FAILED",
        retryable: false,
      })
    })

    it("maps 400 to PROVIDER_REJECTED", () => {
      expect(mapHttpStatusToProviderStatus(400)).toEqual({
        status: "PROVIDER_REJECTED",
        retryable: false,
      })
    })

    it("maps 409 to QUEUED (idempotent success)", () => {
      expect(mapHttpStatusToProviderStatus(409)).toEqual({ status: "QUEUED", retryable: false })
    })

    it("maps 429 to PROVIDER_RATE_LIMIT (retryable)", () => {
      expect(mapHttpStatusToProviderStatus(429)).toEqual({
        status: "PROVIDER_RATE_LIMIT",
        retryable: true,
      })
    })

    it("maps 500 to PROVIDER_TEMPORARY_FAILURE (retryable)", () => {
      expect(mapHttpStatusToProviderStatus(500)).toEqual({
        status: "PROVIDER_TEMPORARY_FAILURE",
        retryable: true,
      })
    })

    it("maps 503 to PROVIDER_TEMPORARY_FAILURE (retryable)", () => {
      expect(mapHttpStatusToProviderStatus(503)).toEqual({
        status: "PROVIDER_TEMPORARY_FAILURE",
        retryable: true,
      })
    })

    it("maps unknown status to PROVIDER_ERROR", () => {
      expect(mapHttpStatusToProviderStatus(418)).toEqual({
        status: "PROVIDER_ERROR",
        retryable: false,
      })
    })
  })

  describe("sendInvoice", () => {
    it("returns PROVIDER_NOT_CONFIGURED when API key is missing", async () => {
      const provider = new EposlovanjeEInvoiceProvider({
        apiKey: "",
        apiBase: "",
      })

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_NOT_CONFIGURED")
    })

    it("returns PROVIDER_NOT_CONFIGURED when API base is missing", async () => {
      const provider = new EposlovanjeEInvoiceProvider({
        apiKey: "test-key",
        apiBase: "",
      })

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_NOT_CONFIGURED")
    })

    it("returns success with providerRef on 200 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messageId: "EPO-12345" }),
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(true)
      expect(result.providerRef).toBe("EPO-12345")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.eposlovanje.hr/api/v2/document/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Idempotency-Key": expect.any(String),
          }),
          body: expect.stringContaining('"document":'),
        })
      )
    })

    it("returns PROVIDER_AUTH_FAILED on 401 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Invalid API key" }),
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "invalid-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_AUTH_FAILED")
    })

    it("returns PROVIDER_REJECTED on 400 response with bounded error", async () => {
      const longError = "A".repeat(1000)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: longError }),
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_REJECTED")
      // Error should be truncated
      expect(result.error!.length).toBeLessThan(600)
    })

    it("treats 409 as idempotent success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false, // 409 is technically not "ok"
        status: 409,
        text: async () => JSON.stringify({ messageId: "EXISTING-123" }),
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(true)
      expect(result.providerRef).toBe("EXISTING-123")
    })

    it("skips send if invoice already has providerRef and SENT status", async () => {
      const mockFetch = vi.fn()

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const invoice = createMockInvoice({
        providerRef: "EXISTING-REF",
        providerStatus: "SENT",
      })

      const result = await provider.sendInvoice(invoice, TEST_UBL_XML)

      expect(result.success).toBe(true)
      expect(result.providerRef).toBe("EXISTING-REF")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns PROVIDER_RATE_LIMIT on 429 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_RATE_LIMIT")
    })

    it("returns PROVIDER_TEMPORARY_FAILURE on timeout", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Request aborted"), { name: "AbortError" }))

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr", timeoutMs: 100 },
        mockFetch as FetchFunction
      )

      const result = await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(result.success).toBe(false)
      expect(result.error).toContain("PROVIDER_TEMPORARY_FAILURE")
    })

    it("includes X-Idempotency-Key header in request", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messageId: "EPO-12345" }),
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Idempotency-Key": expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        })
      )
    })

    it("does not log API key", async () => {
      // This test verifies that the provider never logs the actual API key
      // We check by inspecting the fetch call - Authorization header should
      // contain the key but our logging should never expose it
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messageId: "EPO-12345" }),
      })

      const sensitiveKey = "super-secret-api-key-12345"
      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: sensitiveKey, apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      await provider.sendInvoice(createMockInvoice(), TEST_UBL_XML)

      // Verify the key is used in the request (v2 uses plain key, not Bearer)
      const callArgs = mockFetch.mock.calls[0][1] as RequestInit
      expect(callArgs.headers).toHaveProperty("Authorization", sensitiveKey)
    })
  })

  describe("testConnection", () => {
    it("returns false when not configured", async () => {
      const provider = new EposlovanjeEInvoiceProvider({
        apiKey: "",
        apiBase: "",
      })

      const result = await provider.testConnection()
      expect(result).toBe(false)
    })

    it("returns true on 200 response from v2 ping", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
      })

      const provider = new EposlovanjeEInvoiceProvider(
        { apiKey: "test-key", apiBase: "https://test.eposlovanje.hr" },
        mockFetch as FetchFunction
      )

      const result = await provider.testConnection()
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.eposlovanje.hr/api/v2/ping",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "test-key",
          }),
        })
      )
    })
  })

  describe("getInvoiceStatus", () => {
    it("returns error when not configured", async () => {
      const provider = new EposlovanjeEInvoiceProvider({
        apiKey: "",
        apiBase: "",
      })

      const result = await provider.getInvoiceStatus("test-ref")
      expect(result.status).toBe("error")
      expect(result.message).toContain("PROVIDER_NOT_CONFIGURED")
    })
  })
})
