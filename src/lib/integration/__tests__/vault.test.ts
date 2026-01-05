import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { encryptSecretEnvelope, decryptSecretEnvelope, VaultError } from "../vault"

describe("Integration Vault", () => {
  const originalEnv = process.env.INTEGRATION_VAULT_KEY

  beforeEach(() => {
    // 32-byte key = 64 hex chars
    process.env.INTEGRATION_VAULT_KEY = "a".repeat(64)
  })

  afterEach(() => {
    process.env.INTEGRATION_VAULT_KEY = originalEnv
  })

  describe("encryptSecretEnvelope", () => {
    it("encrypts JSON payload and returns envelope with key version", () => {
      const secrets = { apiKey: "test-api-key-12345" }

      const result = encryptSecretEnvelope(secrets)

      expect(result.envelope).toBeDefined()
      expect(result.envelope).not.toContain("test-api-key")
      expect(result.keyVersion).toBe(1)
    })

    it("produces different ciphertext for same input (random IV)", () => {
      const secrets = { apiKey: "same-key" }

      const result1 = encryptSecretEnvelope(secrets)
      const result2 = encryptSecretEnvelope(secrets)

      expect(result1.envelope).not.toBe(result2.envelope)
    })

    it("throws VaultError if master key not configured", () => {
      delete process.env.INTEGRATION_VAULT_KEY

      expect(() => encryptSecretEnvelope({ apiKey: "x" })).toThrow(VaultError)
    })

    it("throws VaultError if master key is wrong length", () => {
      process.env.INTEGRATION_VAULT_KEY = "tooshort"

      expect(() => encryptSecretEnvelope({ apiKey: "x" })).toThrow(VaultError)
    })
  })

  describe("decryptSecretEnvelope", () => {
    it("decrypts what was encrypted", () => {
      const original = { apiKey: "secret-123", nested: { value: 42 } }
      const { envelope, keyVersion } = encryptSecretEnvelope(original)

      const decrypted = decryptSecretEnvelope(envelope, keyVersion)

      expect(decrypted).toEqual(original)
    })

    it("throws VaultError on tampered ciphertext", () => {
      const { envelope, keyVersion } = encryptSecretEnvelope({ apiKey: "x" })
      const tampered = envelope.slice(0, -2) + "ff"

      expect(() => decryptSecretEnvelope(tampered, keyVersion)).toThrow(VaultError)
    })

    it("throws VaultError on invalid format", () => {
      expect(() => decryptSecretEnvelope("not:valid:format:here", 1)).toThrow(VaultError)
    })
  })

  describe("key version handling", () => {
    it("includes version in encrypted result for future rotation", () => {
      const { keyVersion } = encryptSecretEnvelope({ apiKey: "x" })

      expect(keyVersion).toBe(1)
    })
  })
})
