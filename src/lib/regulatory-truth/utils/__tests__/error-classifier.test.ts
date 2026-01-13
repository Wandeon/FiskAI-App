// src/lib/regulatory-truth/utils/__tests__/error-classifier.test.ts

import { describe, it, expect } from "vitest"
import { classifyError, categorizeErrors, ErrorCategory } from "../error-classifier"

describe("error-classifier", () => {
  describe("classifyError", () => {
    it("classifies null/undefined as UNKNOWN", () => {
      expect(classifyError(null).category).toBe(ErrorCategory.UNKNOWN)
      expect(classifyError(undefined).category).toBe(ErrorCategory.UNKNOWN)
      expect(classifyError("").category).toBe(ErrorCategory.UNKNOWN)
    })

    it("classifies 401/403 as AUTH", () => {
      expect(classifyError("HTTP 401 Unauthorized").category).toBe(ErrorCategory.AUTH)
      expect(classifyError("HTTP 403 Forbidden").category).toBe(ErrorCategory.AUTH)
      expect(classifyError("Authentication failed").category).toBe(ErrorCategory.AUTH)
    })

    it("classifies 429 as QUOTA", () => {
      expect(classifyError("HTTP 429 Too Many Requests").category).toBe(ErrorCategory.QUOTA)
      expect(classifyError("Rate limit exceeded").category).toBe(ErrorCategory.QUOTA)
      expect(classifyError("Quota exceeded for API").category).toBe(ErrorCategory.QUOTA)
      expect(classifyError("Request throttled").category).toBe(ErrorCategory.QUOTA)
    })

    it("classifies network errors as NETWORK", () => {
      expect(classifyError("ECONNREFUSED").category).toBe(ErrorCategory.NETWORK)
      expect(classifyError("ENOTFOUND").category).toBe(ErrorCategory.NETWORK)
      expect(classifyError("DNS lookup failed").category).toBe(ErrorCategory.NETWORK)
      expect(classifyError("socket hang up").category).toBe(ErrorCategory.NETWORK)
      expect(classifyError("fetch failed").category).toBe(ErrorCategory.NETWORK)
    })

    it("classifies timeouts as TIMEOUT", () => {
      expect(classifyError("Request timeout").category).toBe(ErrorCategory.TIMEOUT)
      expect(classifyError("Operation timed out").category).toBe(ErrorCategory.TIMEOUT)
      expect(classifyError("Request aborted").category).toBe(ErrorCategory.TIMEOUT)
    })

    it("classifies JSON errors as PARSE", () => {
      expect(classifyError("No JSON object found in response").category).toBe(ErrorCategory.PARSE)
      expect(classifyError("JSON.parse: unexpected token").category).toBe(ErrorCategory.PARSE)
      expect(classifyError("Syntax error in JSON").category).toBe(ErrorCategory.PARSE)
    })

    it("classifies validation errors as VALIDATION", () => {
      expect(classifyError("Schema validation failed").category).toBe(ErrorCategory.VALIDATION)
      expect(classifyError("Invalid input: required field missing").category).toBe(
        ErrorCategory.VALIDATION
      )
      expect(classifyError("Quote not found in content").category).toBe(ErrorCategory.VALIDATION)
    })

    it("classifies empty content as EMPTY", () => {
      expect(classifyError("Input too small: 50 bytes").category).toBe(ErrorCategory.EMPTY)
      expect(classifyError("No extractable content").category).toBe(ErrorCategory.EMPTY)
      expect(classifyError("Empty response from LLM").category).toBe(ErrorCategory.EMPTY)
    })

    it("marks retryable errors correctly", () => {
      expect(classifyError("HTTP 429").isRetryable).toBe(true)
      expect(classifyError("ECONNREFUSED").isRetryable).toBe(true)
      expect(classifyError("Request timeout").isRetryable).toBe(true)
      expect(classifyError("JSON parse error").isRetryable).toBe(true)

      expect(classifyError("HTTP 401").isRetryable).toBe(false)
      expect(classifyError("Validation failed").isRetryable).toBe(false)
    })
  })

  describe("categorizeErrors", () => {
    it("counts errors by category", () => {
      const errors = [
        "HTTP 429 rate limited",
        "HTTP 429 too many requests",
        "ECONNREFUSED",
        "JSON parse error",
        "Something unknown happened",
      ]

      const counts = categorizeErrors(errors)

      expect(counts[ErrorCategory.QUOTA]).toBe(2)
      expect(counts[ErrorCategory.NETWORK]).toBe(1)
      expect(counts[ErrorCategory.PARSE]).toBe(1)
      expect(counts[ErrorCategory.UNKNOWN]).toBe(1)
      expect(counts[ErrorCategory.AUTH]).toBe(0)
    })

    it("handles empty array", () => {
      const counts = categorizeErrors([])
      expect(counts[ErrorCategory.UNKNOWN]).toBe(0)
    })
  })
})
