/**
 * Tests for V2 Fiscal Signer with IntegrationAccount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Create hoisted mocks before vi.mock calls
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    integrationAccount: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock dependencies
vi.mock("@/lib/db", () => ({ db: mockDb }))

vi.mock("@/lib/integration/repository", () => ({
  findIntegrationAccountById: vi.fn(),
  touchIntegrationAccount: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/integration/types", () => ({
  parseFiscalizationSecrets: vi.fn().mockReturnValue({
    p12Base64: "dGVzdA==",
    p12Password: "password",
  }),
  extractP12FromSecrets: vi.fn().mockReturnValue({
    p12Buffer: Buffer.from("test"),
    password: "password",
  }),
}))

vi.mock("../certificate-parser", () => ({
  parseP12Certificate: vi.fn().mockResolvedValue({
    subject: "CN=Test Company",
    oib: "12345678903",
    serial: "12345",
    notBefore: new Date("2024-01-01"),
    notAfter: new Date("2026-01-01"),
    issuer: "Test CA",
    sha256: "abc123",
    privateKey: {},
    certificate: {},
  }),
  forgeToPem: vi.fn().mockReturnValue({
    privateKeyPem: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
    certificatePem: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Now import the module under test
import { createSignerFromIntegrationAccount } from "../signer-v2"
import { findIntegrationAccountById } from "@/lib/integration/repository"

describe("Fiscal Signer V2", () => {
  const mockP12Base64 = Buffer.from("mock-p12-data").toString("base64")

  const mockAccount = {
    id: "acc-fiscal-123",
    companyId: "comp-456",
    kind: "FISCALIZATION_CIS" as const,
    environment: "TEST" as const,
    status: "ACTIVE" as const,
    providerConfig: {
      certSubject: "CN=Test Company",
      certSerial: "12345",
      oibExtracted: "12345678903",
    },
    secrets: {
      p12Base64: mockP12Base64,
      p12Password: "test-password",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    rotatedAt: null,
    lastUsedAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("createSignerFromIntegrationAccount", () => {
    it("throws TenantViolationError if companyId mismatch", async () => {
      await expect(
        createSignerFromIntegrationAccount("acc-fiscal-123", "wrong-company")
      ).rejects.toThrow("does not match IntegrationAccount")
    })

    it("throws IntegrationNotFoundError if account not found", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(null)

      await expect(createSignerFromIntegrationAccount("nonexistent", "comp-456")).rejects.toThrow(
        "IntegrationAccount not found"
      )
    })

    it("throws IntegrationDisabledError if account expired", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: "EXPIRED" as const,
      })

      await expect(
        createSignerFromIntegrationAccount("acc-fiscal-123", "comp-456")
      ).rejects.toThrow("is disabled")
    })

    it("throws IntegrationDisabledError if account disabled", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: "DISABLED" as const,
      })

      await expect(
        createSignerFromIntegrationAccount("acc-fiscal-123", "comp-456")
      ).rejects.toThrow("is disabled")
    })

    it("throws if wrong integration kind", async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        kind: "EINVOICE_EPOSLOVANJE" as const,
      })

      await expect(
        createSignerFromIntegrationAccount("acc-fiscal-123", "comp-456")
      ).rejects.toThrow("Invalid integration kind")
    })

    it("returns signer with certificate data on success", async () => {
      const signer = await createSignerFromIntegrationAccount("acc-fiscal-123", "comp-456")

      expect(signer.oib).toBe("12345678903")
      expect(signer.integrationAccountId).toBe("acc-fiscal-123")
      expect(signer.companyId).toBe("comp-456")
      expect(signer.certSubject).toBe("CN=Test Company")
      expect(signer.credentials.privateKeyPem).toContain("BEGIN PRIVATE KEY")
      expect(signer.credentials.certificatePem).toContain("BEGIN CERTIFICATE")
    })
  })
})
