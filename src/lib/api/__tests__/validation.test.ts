/**
 * Validation Helpers Tests
 * Following TDD: Write tests first, then implement
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { z } from "zod"
import {
  parseBody,
  parseQuery,
  parseParams,
  ValidationError,
  isValidationError,
  formatValidationError,
} from "../validation"

describe("ValidationError", () => {
  it("creates error with flattened Zod errors", () => {
    // Use schema validation to generate proper ZodError
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })

    assert.ok(!result.success)
    const error = new ValidationError(result.error.flatten())

    assert.ok(error instanceof Error)
    assert.ok(error instanceof ValidationError)
    assert.strictEqual(error.name, "ValidationError")
    assert.ok(error.errors.fieldErrors.name)
    assert.ok(error.errors.fieldErrors.name.length > 0)
  })

  it("has descriptive message", () => {
    // Use schema validation to generate proper ZodError
    const schema = z.object({ email: z.string().min(1) })
    const result = schema.safeParse({ email: "" })

    assert.ok(!result.success)
    const error = new ValidationError(result.error.flatten())

    assert.ok(error.message.includes("Validation failed"))
  })
})

describe("isValidationError", () => {
  it("returns true for ValidationError instances", () => {
    const zodError = new z.ZodError([])
    const error = new ValidationError(zodError.flatten())

    assert.strictEqual(isValidationError(error), true)
  })

  it("returns false for other errors", () => {
    const error = new Error("Regular error")

    assert.strictEqual(isValidationError(error), false)
  })

  it("returns false for non-errors", () => {
    assert.strictEqual(isValidationError("string"), false)
    assert.strictEqual(isValidationError(null), false)
    assert.strictEqual(isValidationError(undefined), false)
  })
})

describe("formatValidationError", () => {
  it("formats errors for API response", () => {
    // Use schema validation to generate proper ZodError
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
    })
    const result = schema.safeParse({ name: undefined, email: "not-email" })

    assert.ok(!result.success)
    const error = new ValidationError(result.error.flatten())
    const formatted = formatValidationError(error)

    assert.strictEqual(formatted.error, "Validation failed")
    assert.ok(formatted.details)
    assert.ok(formatted.details.fieldErrors.name)
    assert.ok(formatted.details.fieldErrors.email)
  })
})

describe("parseBody", () => {
  const userSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().optional(),
  })

  it("parses valid JSON body", async () => {
    const body = { name: "John", email: "john@example.com", age: 30 }
    const request = new Request("http://test.com", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })

    const result = await parseBody(request, userSchema)

    assert.deepStrictEqual(result, body)
  })

  it("throws ValidationError for invalid data", async () => {
    const body = { name: "", email: "not-an-email" }
    const request = new Request("http://test.com", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })

    await assert.rejects(
      async () => parseBody(request, userSchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })

  it("throws ValidationError for non-JSON body", async () => {
    const request = new Request("http://test.com", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "text/plain" },
    })

    await assert.rejects(
      async () => parseBody(request, userSchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })

  it("handles empty body", async () => {
    const request = new Request("http://test.com", {
      method: "POST",
      body: "",
    })

    await assert.rejects(
      async () => parseBody(request, userSchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })
})

describe("parseQuery", () => {
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    search: z.string().optional(),
  })

  it("parses valid query parameters", () => {
    const url = new URL("http://test.com?page=2&limit=20&search=test")

    const result = parseQuery(url.searchParams, querySchema)

    assert.deepStrictEqual(result, { page: 2, limit: 20, search: "test" })
  })

  it("applies defaults for missing optional params", () => {
    const url = new URL("http://test.com")

    const result = parseQuery(url.searchParams, querySchema)

    assert.deepStrictEqual(result, { page: 1, limit: 10 })
  })

  it("throws ValidationError for invalid params", () => {
    const url = new URL("http://test.com?page=0&limit=200")

    assert.throws(
      () => parseQuery(url.searchParams, querySchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })

  it("coerces string numbers", () => {
    const url = new URL("http://test.com?page=5&limit=50")

    const result = parseQuery(url.searchParams, querySchema)

    assert.strictEqual(result.page, 5)
    assert.strictEqual(result.limit, 50)
  })
})

describe("parseParams", () => {
  const paramsSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(["invoice", "expense"]),
  })

  it("parses valid route params", () => {
    const params = { id: "550e8400-e29b-41d4-a716-446655440000", type: "invoice" }

    const result = parseParams(params, paramsSchema)

    assert.deepStrictEqual(result, params)
  })

  it("throws ValidationError for invalid params", () => {
    const params = { id: "not-a-uuid", type: "invalid" }

    assert.throws(
      () => parseParams(params, paramsSchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })

  it("handles missing required params", () => {
    const params = { id: "550e8400-e29b-41d4-a716-446655440000" }

    assert.throws(
      () => parseParams(params, paramsSchema),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        return true
      }
    )
  })
})
