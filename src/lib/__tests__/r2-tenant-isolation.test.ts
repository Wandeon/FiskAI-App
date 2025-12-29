/**
 * R2 Storage Cryptographic Tenant Isolation Tests
 *
 * Tests the HMAC-based tenant isolation for R2 storage:
 * 1. Key generation includes cryptographic signature
 * 2. Signature verification prevents cross-tenant access
 * 3. Legacy keys are handled for backward compatibility
 * 4. Timing-safe comparison prevents timing attacks
 *
 * See: https://github.com/[org]/FiskAI/issues/820
 */

import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import {
  generateR2Key,
  generateTenantSignature,
  verifyTenantSignature,
} from "../r2-client"

describe("R2 Tenant Isolation", () => {
  // Store original env vars
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    // Save and clear relevant env vars
    originalEnv.R2_TENANT_ISOLATION_SECRET = process.env.R2_TENANT_ISOLATION_SECRET
    originalEnv.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
    originalEnv.NODE_ENV = process.env.NODE_ENV

    // Set test values
    process.env.R2_TENANT_ISOLATION_SECRET = "test-isolation-secret-32chars!!"
    process.env.NODE_ENV = "test"
  })

  afterEach(() => {
    // Restore original env vars
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
  })

  describe("generateTenantSignature", () => {
    it("should generate consistent signatures for same inputs", () => {
      const companyId = "company-123"
      const contentHash = "abc123def456"
      const path = "2025/01/pdf"

      const sig1 = generateTenantSignature(companyId, contentHash, path)
      const sig2 = generateTenantSignature(companyId, contentHash, path)

      assert.strictEqual(sig1, sig2, "Same inputs should produce same signature")
    })

    it("should generate different signatures for different company IDs", () => {
      const contentHash = "abc123def456"
      const path = "2025/01/pdf"

      const sig1 = generateTenantSignature("company-A", contentHash, path)
      const sig2 = generateTenantSignature("company-B", contentHash, path)

      assert.notStrictEqual(sig1, sig2, "Different companies should have different signatures")
    })

    it("should generate different signatures for different content hashes", () => {
      const companyId = "company-123"
      const path = "2025/01/pdf"

      const sig1 = generateTenantSignature(companyId, "hash1", path)
      const sig2 = generateTenantSignature(companyId, "hash2", path)

      assert.notStrictEqual(sig1, sig2, "Different content should have different signatures")
    })

    it("should generate 8-character hex signatures", () => {
      const sig = generateTenantSignature("company-123", "hash", "2025/01/pdf")

      assert.strictEqual(sig.length, 8, "Signature should be 8 characters")
      assert.match(sig, /^[0-9a-f]{8}$/, "Signature should be hex")
    })
  })

  describe("generateR2Key", () => {
    it("should generate keys with signature prefix", () => {
      const key = generateR2Key("company-123", "abc123def456", "receipt.pdf")

      // Key format: attachments/{companyId}/{year}/{month}/{sig}_{hash}.{ext}
      const parts = key.split("/")
      assert.strictEqual(parts[0], "attachments")
      assert.strictEqual(parts[1], "company-123")
      assert.match(parts[2], /^\d{4}$/, "Year should be 4 digits")
      assert.match(parts[3], /^\d{2}$/, "Month should be 2 digits")

      // Filename should have signature prefix
      const filename = parts[4]
      assert.match(filename, /^[0-9a-f]{8}_abc123def456\.pdf$/, "Filename should include signature")
    })

    it("should use correct file extension", () => {
      const pdfKey = generateR2Key("company-123", "hash", "document.pdf")
      const jpgKey = generateR2Key("company-123", "hash", "image.jpg")
      const binKey = generateR2Key("company-123", "hash", "noextension")

      assert.ok(pdfKey.endsWith(".pdf"))
      assert.ok(jpgKey.endsWith(".jpg"))
      assert.ok(binKey.endsWith(".bin"))
    })

    it("should generate unique keys for different companies with same content", () => {
      const key1 = generateR2Key("company-A", "samehash", "file.pdf")
      const key2 = generateR2Key("company-B", "samehash", "file.pdf")

      // Keys should differ due to company ID and signature
      assert.notStrictEqual(key1, key2)

      // But should contain respective company IDs
      assert.ok(key1.includes("/company-A/"))
      assert.ok(key2.includes("/company-B/"))
    })
  })

  describe("verifyTenantSignature", () => {
    it("should verify valid signature for correct tenant", () => {
      const companyId = "company-123"
      const key = generateR2Key(companyId, "abc123def456", "receipt.pdf")

      const isValid = verifyTenantSignature(key, companyId)

      assert.strictEqual(isValid, true, "Valid signature should verify")
    })

    it("should reject signature for wrong tenant", () => {
      const key = generateR2Key("company-A", "abc123def456", "receipt.pdf")

      // Try to verify as company-B
      const isValid = verifyTenantSignature(key, "company-B")

      assert.strictEqual(isValid, false, "Should reject wrong tenant")
    })

    it("should reject malformed keys", () => {
      const badKeys = [
        "",
        "invalid-key",
        "attachments/company-123",
        "attachments/company-123/2025",
        "attachments/company-123/2025/01",
        "wrong-prefix/company-123/2025/01/abc_hash.pdf",
      ]

      badKeys.forEach((key) => {
        const isValid = verifyTenantSignature(key, "company-123")
        assert.strictEqual(isValid, false, `Should reject malformed key: ${key}`)
      })
    })

    it("should reject key with company ID mismatch in path", () => {
      const key = generateR2Key("company-A", "abc123def456", "receipt.pdf")

      // Company ID in path doesn't match claimed company
      const isValid = verifyTenantSignature(key, "company-A-imposter")

      assert.strictEqual(isValid, false, "Should reject company ID mismatch")
    })

    it("should accept legacy keys without signature for backward compatibility", () => {
      // Legacy key format: attachments/{companyId}/{year}/{month}/{hash}.{ext}
      const legacyKey = "attachments/company-123/2025/01/abc123def456.pdf"

      const isValid = verifyTenantSignature(legacyKey, "company-123")

      assert.strictEqual(isValid, true, "Legacy keys should be accepted")
    })

    it("should reject legacy key for wrong tenant", () => {
      const legacyKey = "attachments/company-A/2025/01/abc123def456.pdf"

      // Try to access as company-B - should fail on company ID check
      const isValid = verifyTenantSignature(legacyKey, "company-B")

      assert.strictEqual(isValid, false, "Legacy key should still check company ID")
    })

    it("should reject tampered signature", () => {
      const key = generateR2Key("company-123", "abc123def456", "receipt.pdf")

      // Tamper with signature (flip first character)
      const parts = key.split("/")
      const filename = parts[4]
      const tamperedFilename = (
        filename[0] === "0" ? "1" : "0"
      ) + filename.slice(1)
      parts[4] = tamperedFilename
      const tamperedKey = parts.join("/")

      const isValid = verifyTenantSignature(tamperedKey, "company-123")

      assert.strictEqual(isValid, false, "Tampered signature should be rejected")
    })

    it("should reject forged signature attempt", () => {
      // Attacker creates key with wrong signature
      const forgedKey = "attachments/company-123/2025/01/deadbeef_abc123def456.pdf"

      const isValid = verifyTenantSignature(forgedKey, "company-123")

      assert.strictEqual(isValid, false, "Forged signature should be rejected")
    })
  })

  describe("Cross-Tenant Attack Prevention", () => {
    it("should prevent tenant A from accessing tenant B's files", () => {
      // Tenant B uploads a file
      const tenantBKey = generateR2Key("tenant-B", "sensitive-data-hash", "secret.pdf")

      // Tenant A tries to access it
      const canTenantAAccess = verifyTenantSignature(tenantBKey, "tenant-A")

      assert.strictEqual(canTenantAAccess, false, "Cross-tenant access should be prevented")
    })

    it("should prevent signature replay across tenants", () => {
      const contentHash = "same-content"
      const filename = "document.pdf"

      // Generate keys for same content but different tenants
      const tenantAKey = generateR2Key("tenant-A", contentHash, filename)
      const tenantBKey = generateR2Key("tenant-B", contentHash, filename)

      // Extract signature from tenant A's key
      const sigA = tenantAKey.split("/")[4].split("_")[0]
      const sigB = tenantBKey.split("/")[4].split("_")[0]

      // Signatures should be different
      assert.notStrictEqual(sigA, sigB, "Same content should have different signatures per tenant")

      // Trying to use tenant A's signature for tenant B should fail
      const forgedKey = tenantBKey.replace(sigB, sigA)
      const isValid = verifyTenantSignature(forgedKey, "tenant-B")

      assert.strictEqual(isValid, false, "Replayed signature should be rejected")
    })

    it("should prevent path traversal attacks", () => {
      // Attacker tries to access another tenant via path traversal
      const attackKey = "attachments/../tenant-B/2025/01/sig_hash.pdf"

      const isValid = verifyTenantSignature(attackKey, "tenant-A")

      // Should fail because path doesn't match expected format
      assert.strictEqual(isValid, false, "Path traversal should be rejected")
    })

    it("should handle URL-encoded company IDs safely", () => {
      // Company ID might be URL-encoded in attack
      const normalKey = generateR2Key("company-123", "hash", "file.pdf")

      // Attacker tries with URL-encoded company ID
      const isValid = verifyTenantSignature(normalKey, "company%2D123")

      assert.strictEqual(isValid, false, "URL-encoded company ID should not match")
    })
  })

  describe("Secret Key Rotation Support", () => {
    it("should use R2_TENANT_ISOLATION_SECRET when available", () => {
      process.env.R2_TENANT_ISOLATION_SECRET = "secret-1"

      const sig1 = generateTenantSignature("company", "hash", "path")

      process.env.R2_TENANT_ISOLATION_SECRET = "secret-2"

      const sig2 = generateTenantSignature("company", "hash", "path")

      // Different secrets should produce different signatures
      assert.notStrictEqual(sig1, sig2, "Different secrets should produce different signatures")
    })

    it("should fall back to R2_SECRET_ACCESS_KEY if isolation secret not set", () => {
      delete process.env.R2_TENANT_ISOLATION_SECRET
      process.env.R2_SECRET_ACCESS_KEY = "fallback-secret"

      const sig = generateTenantSignature("company", "hash", "path")

      assert.ok(sig, "Should generate signature with fallback secret")
      assert.strictEqual(sig.length, 8, "Signature should still be 8 characters")
    })
  })
})
