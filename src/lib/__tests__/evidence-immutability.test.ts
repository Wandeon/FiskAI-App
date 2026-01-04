// src/lib/__tests__/evidence-immutability.test.ts
// Tests for Evidence immutability protection

import { describe, it, expect } from "vitest"
import { EvidenceImmutabilityError } from "../db/regulatory"
import {
  verifyEvidenceIntegrity,
  verifyEvidenceBatch,
  hashContent,
} from "../regulatory-truth/utils/content-hash"

describe("Evidence Immutability", () => {
  describe("EvidenceImmutabilityError", () => {
    it("creates error with correct message for rawContent", () => {
      const error = new EvidenceImmutabilityError("rawContent")

      expect(error.name).toBe("EvidenceImmutabilityError")
      expect(error.message).toContain("Cannot modify Evidence.rawContent")
      expect(error.message).toContain("immutable")
    })

    it("creates error with correct message for contentHash", () => {
      const error = new EvidenceImmutabilityError("contentHash")

      expect(error.name).toBe("EvidenceImmutabilityError")
      expect(error.message).toContain("Cannot modify Evidence.contentHash")
    })
  })

  describe("verifyEvidenceIntegrity", () => {
    it("returns valid for matching hash", () => {
      const content = "This is test regulatory content from Porezna uprava."
      const contentHash = hashContent(content, "html")

      const result = verifyEvidenceIntegrity({
        id: "test-evidence-1",
        rawContent: content,
        contentHash,
        contentType: "html",
      })

      expect(result.valid).toBe(true)
      expect(result.expectedHash).toBe(contentHash)
      expect(result.actualHash).toBe(contentHash)
      expect(result.error).toBeUndefined()
    })

    it("returns invalid for mismatched hash", () => {
      const content = "This is test regulatory content from Porezna uprava."
      const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000"

      const result = verifyEvidenceIntegrity({
        id: "test-evidence-2",
        rawContent: content,
        contentHash: wrongHash,
        contentType: "html",
      })

      expect(result.valid).toBe(false)
      expect(result.expectedHash).toBe(wrongHash)
      expect(result.actualHash).not.toBe(wrongHash)
      expect(result.error).toContain("tampered")
    })

    it("detects content tampering", () => {
      const originalContent = "Porez iznosi 25%."
      const tamperedContent = "Porez iznosi 10%." // Malicious change
      const originalHash = hashContent(originalContent, "html")

      const result = verifyEvidenceIntegrity({
        id: "test-evidence-3",
        rawContent: tamperedContent, // Using tampered content
        contentHash: originalHash, // With original hash
        contentType: "html",
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe("verifyEvidenceBatch", () => {
    it("returns empty array when all evidence is valid", () => {
      const content1 = "Evidence 1 content"
      const content2 = "Evidence 2 content"

      const evidenceRecords = [
        {
          id: "ev1",
          rawContent: content1,
          contentHash: hashContent(content1, "html"),
          contentType: "html",
        },
        {
          id: "ev2",
          rawContent: content2,
          contentHash: hashContent(content2, "html"),
          contentType: "html",
        },
      ]

      const results = verifyEvidenceBatch(evidenceRecords)

      expect(results).toHaveLength(0)
    })

    it("returns invalid evidence records", () => {
      const content1 = "Valid evidence"
      const content2 = "Original evidence"
      const tamperedContent2 = "Tampered evidence"

      const evidenceRecords = [
        {
          id: "ev1",
          rawContent: content1,
          contentHash: hashContent(content1, "html"),
          contentType: "html",
        },
        {
          id: "ev2",
          rawContent: tamperedContent2, // Tampered
          contentHash: hashContent(content2, "html"), // Original hash
          contentType: "html",
        },
      ]

      const results = verifyEvidenceBatch(evidenceRecords)

      expect(results).toHaveLength(1)
      expect(results[0].evidenceId).toBe("ev2")
      expect(results[0].valid).toBe(false)
    })
  })
})
