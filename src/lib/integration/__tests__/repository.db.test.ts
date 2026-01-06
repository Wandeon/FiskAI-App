import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { db } from "@/lib/db"
import {
  createIntegrationAccount,
  findIntegrationAccount,
  findIntegrationAccountById,
  updateIntegrationAccountSecrets,
  disableIntegrationAccount,
  touchIntegrationAccount,
} from "../repository"

describe("IntegrationAccount Repository", () => {
  let testCompanyId: string

  beforeAll(async () => {
    // Create test company with unique OIB
    const uniqueOib = String(Math.floor(Math.random() * 1e11)).padStart(11, "0")
    const company = await db.company.create({
      data: {
        name: "Integration Test Co",
        oib: uniqueOib,
        address: "Test Address",
        city: "Zagreb",
        postalCode: "10000",
        country: "HR",
      },
    })
    testCompanyId = company.id
  })

  afterAll(async () => {
    // Cleanup
    await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
    await db.company.delete({ where: { id: testCompanyId } })
    await db.$disconnect()
  })

  beforeEach(async () => {
    // Clean integration accounts before each test
    await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
  })

  describe("createIntegrationAccount", () => {
    it("creates account with encrypted secrets", async () => {
      const account = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "test-key-123" },
        providerConfig: { baseUrl: "https://test.example.com" },
      })

      expect(account.id).toBeDefined()
      expect(account.companyId).toBe(testCompanyId)
      expect(account.kind).toBe("EINVOICE_EPOSLOVANJE")
      expect(account.status).toBe("ACTIVE")
      expect(account.secretEnvelope).toBeDefined()
      expect(account.secretEnvelope).not.toContain("test-key-123")
    })

    it("enforces unique constraint on (companyId, kind, environment)", async () => {
      await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "key1" },
      })

      await expect(
        createIntegrationAccount({
          companyId: testCompanyId,
          kind: "EINVOICE_EPOSLOVANJE",
          environment: "TEST",
          secrets: { apiKey: "key2" },
        })
      ).rejects.toThrow()
    })
  })

  describe("findIntegrationAccount", () => {
    it("returns null for non-existent account", async () => {
      const account = await findIntegrationAccount(testCompanyId, "EINVOICE_EPOSLOVANJE", "PROD")
      expect(account).toBeNull()
    })

    it("returns account with decrypted secrets", async () => {
      await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_FINA",
        environment: "PROD",
        secrets: { apiKey: "my-secret-key" },
      })

      const account = await findIntegrationAccount(testCompanyId, "EINVOICE_FINA", "PROD")

      expect(account).not.toBeNull()
      expect(account!.secrets).toEqual({ apiKey: "my-secret-key" })
    })

    it("returns null for disabled account", async () => {
      const created = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "x" },
      })

      await disableIntegrationAccount(created.id)

      const found = await findIntegrationAccount(testCompanyId, "EINVOICE_EPOSLOVANJE", "TEST")
      expect(found).toBeNull()
    })
  })

  describe("findIntegrationAccountById", () => {
    it("returns account with decrypted secrets by ID", async () => {
      const created = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "secret-by-id" },
      })

      const found = await findIntegrationAccountById(created.id)

      expect(found).not.toBeNull()
      expect(found!.secrets).toEqual({ apiKey: "secret-by-id" })
    })

    it("returns null for non-existent ID", async () => {
      const found = await findIntegrationAccountById("non-existent-id")
      expect(found).toBeNull()
    })

    it("returns null for disabled account", async () => {
      const created = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "disabled-account" },
      })

      await disableIntegrationAccount(created.id)

      const found = await findIntegrationAccountById(created.id)
      expect(found).toBeNull()
    })
  })

  describe("updateIntegrationAccountSecrets", () => {
    it("rotates secrets and updates rotatedAt", async () => {
      const account = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "old-key" },
      })

      const originalEnvelope = account.secretEnvelope

      const updated = await updateIntegrationAccountSecrets(account.id, { apiKey: "new-key" })

      expect(updated.secretEnvelope).not.toBe(originalEnvelope)
      expect(updated.rotatedAt).not.toBeNull()
    })
  })

  describe("touchIntegrationAccount", () => {
    it("updates lastUsedAt timestamp", async () => {
      const account = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: "EINVOICE_EPOSLOVANJE",
        environment: "TEST",
        secrets: { apiKey: "touch-test" },
      })

      // Initial lastUsedAt should be null
      const beforeTouch = await db.integrationAccount.findUnique({
        where: { id: account.id },
      })
      expect(beforeTouch!.lastUsedAt).toBeNull()

      await touchIntegrationAccount(account.id)

      const afterTouch = await db.integrationAccount.findUnique({
        where: { id: account.id },
      })
      expect(afterTouch!.lastUsedAt).not.toBeNull()
    })
  })
})
