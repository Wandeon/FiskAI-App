/**
 * Tests for dual-path e-invoice send function
 *
 * These are unit tests that mock external dependencies.
 * No database access is required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock all external dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    eInvoice: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock("@/lib/integration-feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_FLAGS: {
    USE_INTEGRATION_ACCOUNT_OUTBOUND: false,
  },
}))

vi.mock("@/lib/secrets", () => ({
  decryptOptionalSecret: vi.fn(),
}))

vi.mock("@/lib/integration", () => ({
  touchIntegrationAccount: vi.fn().mockResolvedValue(undefined),
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

const mockSendInvoice = vi.fn()

vi.mock("../../provider", () => ({
  createEInvoiceProvider: vi.fn(() => ({
    sendInvoice: mockSendInvoice,
    name: "mock",
    testConnection: vi.fn(),
    fetchIncomingInvoices: vi.fn(),
    getInvoiceStatus: vi.fn(),
    archiveInvoice: vi.fn(),
  })),
}))

vi.mock("../../provider-v2", () => ({
  createProviderFromIntegrationAccount: vi.fn(() => ({
    sendInvoice: mockSendInvoice,
    name: "eposlovanje",
    testConnection: vi.fn(),
    fetchIncomingInvoices: vi.fn(),
    getInvoiceStatus: vi.fn(),
    archiveInvoice: vi.fn(),
  })),
  resolveProviderForCompany: vi.fn(() => ({
    sendInvoice: mockSendInvoice,
    name: "eposlovanje",
    testConnection: vi.fn(),
    fetchIncomingInvoices: vi.fn(),
    getInvoiceStatus: vi.fn(),
    archiveInvoice: vi.fn(),
  })),
}))

vi.mock("../../ubl-generator", () => ({
  generateUBLInvoice: vi.fn(() => "<Invoice>UBL XML</Invoice>"),
}))

// Now import the module under test
import { sendEInvoice, type SendEInvoiceInput } from "../../send-invoice"
import { isFeatureEnabled } from "@/lib/integration-feature-flags"
import { decryptOptionalSecret } from "@/lib/secrets"
import { findIntegrationAccount, touchIntegrationAccount } from "@/lib/integration"
import { createEInvoiceProvider } from "../../provider"
import { createProviderFromIntegrationAccount, resolveProviderForCompany } from "../../provider-v2"
import { db } from "@/lib/db"

describe("sendEInvoice", () => {
  const mockInvoice: SendEInvoiceInput["invoice"] = {
    id: "inv-123",
    companyId: "company-123",
    direction: "OUTBOUND",
    invoiceNumber: "2024-001",
    issueDate: new Date("2024-01-15"),
    dueDate: null,
    currency: "EUR",
    buyerReference: null,
    netAmount: { toNumber: () => 100 } as never,
    vatAmount: { toNumber: () => 25 } as never,
    totalAmount: { toNumber: () => 125 } as never,
    status: "DRAFT",
    jir: null,
    zki: null,
    fiscalizedAt: null,
    ublXml: null,
    providerRef: null,
    providerStatus: null,
    providerError: null,
    archivedAt: null,
    archiveRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sentAt: null,
    receivedAt: null,
    type: "E_INVOICE",
    internalReference: null,
    notes: null,
    convertedFromId: null,
    correctsInvoiceId: null,
    paidAt: null,
    paidAmount: { toNumber: () => 0 } as never,
    paymentStatus: "UNPAID",
    bankAccount: null,
    includeBarcode: true,
    importJobId: null,
    paymentModel: null,
    paymentReference: null,
    vendorBankName: null,
    vendorIban: null,
    fiscalStatus: null,
    operatorOib: null,
    paymentMethod: null,
    emailMessageId: null,
    emailDeliveredAt: null,
    emailOpenedAt: null,
    emailClickedAt: null,
    emailBouncedAt: null,
    emailBounceReason: null,
    sellerId: null,
    buyerId: "buyer-123",
    sellerOrganizationId: null,
    buyerOrganizationId: null,
    integrationAccountId: null,
    lines: [
      {
        id: "line-1",
        eInvoiceId: "inv-123",
        lineNumber: 1,
        description: "Test product",
        quantity: { toNumber: () => 1 } as never,
        unit: "C62",
        unitPrice: { toNumber: () => 100 } as never,
        netAmount: { toNumber: () => 100 } as never,
        vatRate: { toNumber: () => 25 } as never,
        vatCategory: "S",
        vatAmount: { toNumber: () => 25 } as never,
        vatRuleId: null,
      },
    ],
    buyer: {
      id: "buyer-123",
      companyId: "company-123",
      type: "CUSTOMER",
      name: "Test Buyer",
      email: "buyer@test.com",
      phone: null,
      address: "123 Test St",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      oib: "12345678901",
      vatNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      organizationId: null,
      paymentTermsDays: 15,
    },
    seller: null,
    company: {
      id: "company-123",
      name: "Test Company",
      email: "company@test.com",
      address: "456 Company St",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      oib: "98765432109",
      vatId: "HR98765432109",
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      entitlements: [],
      eInvoiceProvider: "eposlovanje",
      eInvoiceApiKeyEncrypted: "encrypted-key",
      invoiceNumberFormat: "{YYYY}-{NNN}",
      invoiceNumberCounter: 1,
      defaultCurrency: "EUR",
      registrationId: null,
      website: null,
      bankIban: null,
      bankBic: null,
      bankName: null,
      subscriptionTier: "FREE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      fiscalDeviceType: null,
      fiscalLocationId: null,
      certificateEncrypted: null,
      certificatePassword: null,
      certificateExpiresAt: null,
      isNaturalPerson: false,
      invoiceNumberLastYear: null,
      invoiceNumberLastReset: null,
      invoiceNumberResetPolicy: "NEVER",
      invoiceDueDays: 15,
      invoiceNotes: null,
      bankAccounts: null,
      logoUrl: null,
      fiscalCertValidated: false,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendInvoice.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("when USE_INTEGRATION_ACCOUNT_OUTBOUND is OFF", () => {
    beforeEach(() => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false)
      vi.mocked(decryptOptionalSecret).mockReturnValue("decrypted-api-key")
    })

    it("uses legacy path and returns success", async () => {
      mockSendInvoice.mockResolvedValue({
        success: true,
        providerRef: "prov-ref-123",
        jir: "jir-123",
        zki: "zki-123",
      })

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(true)
      expect(result.path).toBe("legacy")
      expect(result.providerRef).toBe("prov-ref-123")
      expect(result.jir).toBe("jir-123")
      expect(createEInvoiceProvider).toHaveBeenCalledWith("eposlovanje", {
        apiKey: "decrypted-api-key",
      })
    })

    it("returns error when API key decryption fails", async () => {
      vi.mocked(decryptOptionalSecret).mockImplementation(() => {
        throw new Error("Decryption failed")
      })

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(false)
      expect(result.path).toBe("legacy")
      expect(result.error).toContain("decrypt")
    })

    it("returns error when provider send fails", async () => {
      mockSendInvoice.mockResolvedValue({
        success: false,
        error: "Provider connection failed",
      })

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(false)
      expect(result.path).toBe("legacy")
      expect(result.error).toBe("Provider connection failed")
    })
  })

  describe("when USE_INTEGRATION_ACCOUNT_OUTBOUND is ON", () => {
    beforeEach(() => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)
    })

    it("uses specified integrationAccountId", async () => {
      mockSendInvoice.mockResolvedValue({
        success: true,
        providerRef: "prov-ref-456",
      })

      const result = await sendEInvoice({
        invoice: mockInvoice,
        integrationAccountId: "int-account-123",
      })

      expect(result.success).toBe(true)
      expect(result.path).toBe("integration-account")
      expect(result.integrationAccountId).toBe("int-account-123")
      expect(createProviderFromIntegrationAccount).toHaveBeenCalledWith(
        "int-account-123",
        "company-123"
      )
      expect(touchIntegrationAccount).toHaveBeenCalledWith("int-account-123")
      expect(db.eInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { integrationAccountId: "int-account-123" },
      })
    })

    it("resolves IntegrationAccount when not specified", async () => {
      vi.mocked(findIntegrationAccount).mockResolvedValue({
        id: "resolved-account-123",
        companyId: "company-123",
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "PROD",
        status: "ACTIVE",
        providerConfig: null,
        secrets: { apiKey: "api-key" },
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
        lastUsedAt: null,
      })

      mockSendInvoice.mockResolvedValue({
        success: true,
        providerRef: "prov-ref-789",
      })

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(true)
      expect(result.path).toBe("integration-account")
      expect(result.integrationAccountId).toBe("resolved-account-123")
      expect(findIntegrationAccount).toHaveBeenCalled()
      expect(resolveProviderForCompany).toHaveBeenCalledWith(
        "company-123",
        "EINVOICE_EPOSLOVANJE",
        "PROD"
      )
    })

    it("returns error when no IntegrationAccount found", async () => {
      vi.mocked(findIntegrationAccount).mockResolvedValue(null)

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(false)
      expect(result.path).toBe("integration-account")
      expect(result.error).toContain("No active e-invoice integration")
    })

    it("handles provider error gracefully", async () => {
      vi.mocked(findIntegrationAccount).mockResolvedValue({
        id: "account-123",
        companyId: "company-123",
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "PROD",
        status: "ACTIVE",
        providerConfig: null,
        secrets: { apiKey: "api-key" },
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
        lastUsedAt: null,
      })

      mockSendInvoice.mockResolvedValue({
        success: false,
        error: "Provider API error",
      })

      const result = await sendEInvoice({ invoice: mockInvoice })

      expect(result.success).toBe(false)
      expect(result.path).toBe("integration-account")
      expect(result.error).toBe("Provider API error")
      // Should not update lastUsedAt on failure
      expect(touchIntegrationAccount).not.toHaveBeenCalled()
    })

    it("handles exceptions gracefully", async () => {
      vi.mocked(createProviderFromIntegrationAccount).mockRejectedValue(
        new Error("Tenant violation")
      )

      const result = await sendEInvoice({
        invoice: mockInvoice,
        integrationAccountId: "wrong-tenant-account",
      })

      expect(result.success).toBe(false)
      expect(result.path).toBe("integration-account")
      expect(result.error).toBe("Tenant violation")
    })
  })
})
