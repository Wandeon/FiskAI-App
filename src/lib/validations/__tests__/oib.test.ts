import { describe, it, expect } from "vitest"
import { validateOib, oibSchema, oibOptionalSchema } from "../oib"

describe("validateOib", () => {
  describe("valid OIBs", () => {
    it("should accept valid OIB with correct checksum (64404746483)", () => {
      // Verified checksum: for 6440474648, check digit = 3
      expect(validateOib("64404746483")).toBe(true)
    })

    it("should accept valid OIB with correct checksum (12345678903)", () => {
      // Verified checksum: for 1234567890, check digit = 3
      expect(validateOib("12345678903")).toBe(true)
    })

    it("should accept OIB starting with zeros", () => {
      // Verified checksum: for 0000000000, check digit = 1
      expect(validateOib("00000000001")).toBe(true)
    })

    it("should accept another valid OIB (98765432106)", () => {
      // Verified checksum: for 9876543210, check digit = 6
      expect(validateOib("98765432106")).toBe(true)
    })
  })

  describe("invalid OIBs", () => {
    it("should reject OIB with wrong checksum (12345678901)", () => {
      expect(validateOib("12345678901")).toBe(false)
    })

    it("should reject OIB that is too short (10 digits)", () => {
      expect(validateOib("1234567890")).toBe(false)
    })

    it("should reject OIB that is too long (12 digits)", () => {
      expect(validateOib("123456789012")).toBe(false)
    })

    it("should reject OIB with non-digit characters", () => {
      expect(validateOib("abcdefghijk")).toBe(false)
      expect(validateOib("1234567890a")).toBe(false)
      expect(validateOib("123456789O1")).toBe(false) // Letter O instead of 0
    })

    it("should reject empty string", () => {
      expect(validateOib("")).toBe(false)
    })

    it("should reject OIB with spaces", () => {
      expect(validateOib("1234 5678901")).toBe(false)
      expect(validateOib(" 12345678901")).toBe(false)
      expect(validateOib("12345678901 ")).toBe(false)
    })

    it("should reject OIB with special characters", () => {
      expect(validateOib("123-456-7890")).toBe(false)
      expect(validateOib("12345.67890")).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("should reject null-like values", () => {
      // @ts-expect-error - testing null
      expect(validateOib(null)).toBe(false)
      // @ts-expect-error - testing undefined
      expect(validateOib(undefined)).toBe(false)
    })

    it("should handle numeric input as false", () => {
      // @ts-expect-error - testing number
      expect(validateOib(12345678903)).toBe(false)
    })
  })
})

describe("oibSchema", () => {
  it("should validate correct OIB", () => {
    const result = oibSchema.safeParse("12345678903")
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("12345678903")
    }
  })

  it("should reject invalid format", () => {
    const result = oibSchema.safeParse("1234567890")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("11 digits")
    }
  })

  it("should reject invalid checksum", () => {
    const result = oibSchema.safeParse("12345678901")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("checksum")
    }
  })
})

describe("oibOptionalSchema", () => {
  it("should accept valid OIB", () => {
    const result = oibOptionalSchema.safeParse("12345678903")
    expect(result.success).toBe(true)
  })

  it("should accept empty string", () => {
    const result = oibOptionalSchema.safeParse("")
    expect(result.success).toBe(true)
  })

  it("should accept undefined", () => {
    const result = oibOptionalSchema.safeParse(undefined)
    expect(result.success).toBe(true)
  })

  it("should reject invalid OIB", () => {
    const result = oibOptionalSchema.safeParse("12345678901")
    expect(result.success).toBe(false)
  })
})
