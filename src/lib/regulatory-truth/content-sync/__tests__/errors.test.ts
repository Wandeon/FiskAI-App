// src/lib/regulatory-truth/content-sync/__tests__/errors.test.ts
import { describe, it, expect } from "vitest"
import {
  ContentSyncError,
  UnmappedConceptError,
  InvalidPayloadError,
  MissingPointersError,
  ContentNotFoundError,
  FrontmatterParseError,
  PatchConflictError,
  RepoWriteFailedError,
  DbWriteFailedError,
  classifyError,
} from "../errors"

// =============================================================================
// Base Error Class
// =============================================================================

describe("ContentSyncError", () => {
  it("should be abstract and not directly instantiable", () => {
    // ContentSyncError is abstract, so we verify by checking subclasses
    const error = new UnmappedConceptError("test-concept")
    expect(error).toBeInstanceOf(ContentSyncError)
    expect(error).toBeInstanceOf(Error)
  })
})

// =============================================================================
// PERMANENT Errors
// =============================================================================

describe("UnmappedConceptError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new UnmappedConceptError("unknown-concept")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("UNMAPPED_CONCEPT")
  })

  it("should include conceptId in message", () => {
    const error = new UnmappedConceptError("pdv-new-threshold")

    expect(error.message).toContain("pdv-new-threshold")
    expect(error.conceptId).toBe("pdv-new-threshold")
  })

  it("should set correct name", () => {
    const error = new UnmappedConceptError("test")
    expect(error.name).toBe("UnmappedConceptError")
  })
})

describe("InvalidPayloadError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new InvalidPayloadError("missing required field")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("INVALID_PAYLOAD")
  })

  it("should include reason in message", () => {
    const error = new InvalidPayloadError("version field must be 1")

    expect(error.message).toContain("version field must be 1")
    expect(error.reason).toBe("version field must be 1")
  })

  it("should optionally store payload", () => {
    const payload = { version: 2, invalid: true }
    const error = new InvalidPayloadError("unsupported version", payload)

    expect(error.payload).toEqual(payload)
  })

  it("should work without payload", () => {
    const error = new InvalidPayloadError("missing field")
    expect(error.payload).toBeUndefined()
  })

  it("should set correct name", () => {
    const error = new InvalidPayloadError("test")
    expect(error.name).toBe("InvalidPayloadError")
  })
})

describe("MissingPointersError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new MissingPointersError("rule-123")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("MISSING_POINTERS")
  })

  it("should include ruleId in message", () => {
    const error = new MissingPointersError("rule-pdv-2024")

    expect(error.message).toContain("rule-pdv-2024")
    expect(error.message).toContain("sourcePointerIds")
    expect(error.ruleId).toBe("rule-pdv-2024")
  })

  it("should set correct name", () => {
    const error = new MissingPointersError("test")
    expect(error.name).toBe("MissingPointersError")
  })
})

describe("ContentNotFoundError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new ContentNotFoundError("/content/vodici/pdv.mdx", "pdv-threshold")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("CONTENT_NOT_FOUND")
  })

  it("should include path and conceptId in message", () => {
    const error = new ContentNotFoundError("/content/vodici/pausalni.mdx", "pausalni-limit")

    expect(error.message).toContain("/content/vodici/pausalni.mdx")
    expect(error.message).toContain("pausalni-limit")
    expect(error.contentPath).toBe("/content/vodici/pausalni.mdx")
    expect(error.conceptId).toBe("pausalni-limit")
  })

  it("should set correct name", () => {
    const error = new ContentNotFoundError("/path", "concept")
    expect(error.name).toBe("ContentNotFoundError")
  })
})

describe("FrontmatterParseError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new FrontmatterParseError("/content/vodici/pdv.mdx", "Invalid YAML")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("FRONTMATTER_PARSE_ERROR")
  })

  it("should include path and parse error in message", () => {
    const error = new FrontmatterParseError(
      "/content/vodici/test.mdx",
      "Unexpected token at line 5"
    )

    expect(error.message).toContain("/content/vodici/test.mdx")
    expect(error.message).toContain("Unexpected token at line 5")
    expect(error.contentPath).toBe("/content/vodici/test.mdx")
    expect(error.parseError).toBe("Unexpected token at line 5")
  })

  it("should set correct name", () => {
    const error = new FrontmatterParseError("/path", "error")
    expect(error.name).toBe("FrontmatterParseError")
  })
})

describe("PatchConflictError", () => {
  it("should have correct kind and deadLetterReason", () => {
    const error = new PatchConflictError("evt-abc123", "/content/vodici/pdv.mdx")

    expect(error.kind).toBe("PERMANENT")
    expect(error.deadLetterReason).toBe("PATCH_CONFLICT")
  })

  it("should include eventId and path in message", () => {
    const error = new PatchConflictError("evt-xyz789", "/content/vodici/pausalni.mdx")

    expect(error.message).toContain("evt-xyz789")
    expect(error.message).toContain("/content/vodici/pausalni.mdx")
    expect(error.message).toContain("changelog")
    expect(error.eventId).toBe("evt-xyz789")
    expect(error.contentPath).toBe("/content/vodici/pausalni.mdx")
  })

  it("should set correct name", () => {
    const error = new PatchConflictError("evt", "/path")
    expect(error.name).toBe("PatchConflictError")
  })
})

// =============================================================================
// TRANSIENT Errors
// =============================================================================

describe("RepoWriteFailedError", () => {
  it("should have correct kind and no deadLetterReason", () => {
    const error = new RepoWriteFailedError("git push")

    expect(error.kind).toBe("TRANSIENT")
    expect(error.deadLetterReason).toBeUndefined()
  })

  it("should include operation in message", () => {
    const error = new RepoWriteFailedError("git commit")

    expect(error.message).toContain("git commit")
    expect(error.operation).toBe("git commit")
  })

  it("should include cause message when provided", () => {
    const cause = new Error("Permission denied")
    const error = new RepoWriteFailedError("git push", cause)

    expect(error.message).toContain("git push")
    expect(error.message).toContain("Permission denied")
    expect(error.cause).toBe(cause)
  })

  it("should work without cause", () => {
    const error = new RepoWriteFailedError("git status")
    expect(error.cause).toBeUndefined()
  })

  it("should set correct name", () => {
    const error = new RepoWriteFailedError("op")
    expect(error.name).toBe("RepoWriteFailedError")
  })
})

describe("DbWriteFailedError", () => {
  it("should have correct kind and no deadLetterReason", () => {
    const error = new DbWriteFailedError("update status")

    expect(error.kind).toBe("TRANSIENT")
    expect(error.deadLetterReason).toBeUndefined()
  })

  it("should include operation in message", () => {
    const error = new DbWriteFailedError("insert event")

    expect(error.message).toContain("insert event")
    expect(error.operation).toBe("insert event")
  })

  it("should include cause message when provided", () => {
    const cause = new Error("Connection timeout")
    const error = new DbWriteFailedError("update record", cause)

    expect(error.message).toContain("update record")
    expect(error.message).toContain("Connection timeout")
    expect(error.cause).toBe(cause)
  })

  it("should work without cause", () => {
    const error = new DbWriteFailedError("delete")
    expect(error.cause).toBeUndefined()
  })

  it("should set correct name", () => {
    const error = new DbWriteFailedError("op")
    expect(error.name).toBe("DbWriteFailedError")
  })
})

// =============================================================================
// classifyError Function
// =============================================================================

describe("classifyError", () => {
  describe("PERMANENT errors", () => {
    it("should classify UnmappedConceptError correctly", () => {
      const error = new UnmappedConceptError("unknown")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("UNMAPPED_CONCEPT")
      expect(result.message).toContain("unknown")
    })

    it("should classify InvalidPayloadError correctly", () => {
      const error = new InvalidPayloadError("bad data")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("INVALID_PAYLOAD")
      expect(result.message).toContain("bad data")
    })

    it("should classify MissingPointersError correctly", () => {
      const error = new MissingPointersError("rule-123")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("MISSING_POINTERS")
      expect(result.message).toContain("rule-123")
    })

    it("should classify ContentNotFoundError correctly", () => {
      const error = new ContentNotFoundError("/path/file.mdx", "concept")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("CONTENT_NOT_FOUND")
      expect(result.message).toContain("/path/file.mdx")
    })

    it("should classify FrontmatterParseError correctly", () => {
      const error = new FrontmatterParseError("/path/file.mdx", "parse error")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("FRONTMATTER_PARSE_ERROR")
      expect(result.message).toContain("parse error")
    })

    it("should classify PatchConflictError correctly", () => {
      const error = new PatchConflictError("evt-123", "/path/file.mdx")
      const result = classifyError(error)

      expect(result.kind).toBe("PERMANENT")
      expect(result.deadLetterReason).toBe("PATCH_CONFLICT")
      expect(result.message).toContain("evt-123")
    })
  })

  describe("TRANSIENT errors", () => {
    it("should classify RepoWriteFailedError correctly", () => {
      const error = new RepoWriteFailedError("git push")
      const result = classifyError(error)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toContain("git push")
    })

    it("should classify DbWriteFailedError correctly", () => {
      const error = new DbWriteFailedError("insert")
      const result = classifyError(error)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toContain("insert")
    })
  })

  describe("unknown errors", () => {
    it("should classify standard Error as TRANSIENT", () => {
      const error = new Error("Something went wrong")
      const result = classifyError(error)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("Something went wrong")
    })

    it("should classify TypeError as TRANSIENT", () => {
      const error = new TypeError("undefined is not a function")
      const result = classifyError(error)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("undefined is not a function")
    })

    it("should classify string errors as TRANSIENT", () => {
      const result = classifyError("string error message")

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("string error message")
    })

    it("should classify object errors as TRANSIENT with JSON message", () => {
      const result = classifyError({ code: "ERR_001", detail: "failed" })

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toContain("ERR_001")
      expect(result.message).toContain("failed")
    })

    it("should classify null as TRANSIENT", () => {
      const result = classifyError(null)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("null")
    })

    it("should classify undefined as TRANSIENT", () => {
      const result = classifyError(undefined)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("undefined")
    })

    it("should classify number as TRANSIENT", () => {
      const result = classifyError(42)

      expect(result.kind).toBe("TRANSIENT")
      expect(result.deadLetterReason).toBeUndefined()
      expect(result.message).toBe("42")
    })
  })
})

// =============================================================================
// All Error Types Verification
// =============================================================================

describe("all error types", () => {
  it("should have all PERMANENT errors with deadLetterReason", () => {
    const permanentErrors = [
      new UnmappedConceptError("concept"),
      new InvalidPayloadError("reason"),
      new MissingPointersError("rule"),
      new ContentNotFoundError("/path", "concept"),
      new FrontmatterParseError("/path", "error"),
      new PatchConflictError("event", "/path"),
    ]

    for (const error of permanentErrors) {
      expect(error.kind).toBe("PERMANENT")
      expect(error.deadLetterReason).toBeDefined()
      expect(typeof error.deadLetterReason).toBe("string")
    }
  })

  it("should have all TRANSIENT errors without deadLetterReason", () => {
    const transientErrors = [
      new RepoWriteFailedError("operation"),
      new DbWriteFailedError("operation"),
    ]

    for (const error of transientErrors) {
      expect(error.kind).toBe("TRANSIENT")
      expect(error.deadLetterReason).toBeUndefined()
    }
  })

  it("should have unique deadLetterReasons for each PERMANENT error type", () => {
    const reasons = [
      new UnmappedConceptError("").deadLetterReason,
      new InvalidPayloadError("").deadLetterReason,
      new MissingPointersError("").deadLetterReason,
      new ContentNotFoundError("", "").deadLetterReason,
      new FrontmatterParseError("", "").deadLetterReason,
      new PatchConflictError("", "").deadLetterReason,
    ]

    const uniqueReasons = new Set(reasons)
    expect(uniqueReasons.size).toBe(reasons.length)
  })
})
