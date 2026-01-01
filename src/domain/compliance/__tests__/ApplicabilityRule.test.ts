// src/domain/compliance/__tests__/ApplicabilityRule.test.ts
import { describe, it, expect } from "vitest"
import { ApplicabilityRule } from "../ApplicabilityRule"
import { ComplianceError } from "../ComplianceError"

describe("ApplicabilityRule", () => {
  describe("all", () => {
    it("creates a rule that applies to all business types", () => {
      const rule = ApplicabilityRule.all()
      expect(rule.appliesTo("doo")).toBe(true)
      expect(rule.appliesTo("obrt")).toBe(true)
      expect(rule.appliesTo("anything")).toBe(true)
    })
  })

  describe("forTypes", () => {
    it("creates a rule for specific business types", () => {
      const rule = ApplicabilityRule.forTypes(["doo", "dd"])
      expect(rule.appliesTo("doo")).toBe(true)
      expect(rule.appliesTo("dd")).toBe(true)
      expect(rule.appliesTo("obrt")).toBe(false)
    })

    it("normalizes business types to lowercase and trims", () => {
      const rule = ApplicabilityRule.forTypes(["  DOO  ", " DD "])
      expect(rule.appliesTo("doo")).toBe(true)
      expect(rule.appliesTo("DOO")).toBe(true)
      expect(rule.appliesTo("  doo  ")).toBe(true)
    })

    it("throws for empty array", () => {
      expect(() => ApplicabilityRule.forTypes([])).toThrow(ComplianceError)
      expect(() => ApplicabilityRule.forTypes([])).toThrow("Business types array cannot be empty")
    })

    it("throws for null/undefined", () => {
      expect(() => ApplicabilityRule.forTypes(null as unknown as string[])).toThrow(ComplianceError)
    })
  })

  describe("except", () => {
    it("creates a rule that excludes specific business types", () => {
      const rule = ApplicabilityRule.except(["obrt"])
      expect(rule.appliesTo("doo")).toBe(true)
      expect(rule.appliesTo("dd")).toBe(true)
      expect(rule.appliesTo("obrt")).toBe(false)
    })

    it("normalizes business types to lowercase and trims", () => {
      const rule = ApplicabilityRule.except(["  OBRT  "])
      expect(rule.appliesTo("doo")).toBe(true)
      expect(rule.appliesTo("obrt")).toBe(false)
      expect(rule.appliesTo("OBRT")).toBe(false)
    })

    it("throws for empty array", () => {
      expect(() => ApplicabilityRule.except([])).toThrow(ComplianceError)
      expect(() => ApplicabilityRule.except([])).toThrow("Business types array cannot be empty")
    })
  })

  describe("appliesTo", () => {
    it("normalizes input business type", () => {
      const includeRule = ApplicabilityRule.forTypes(["doo"])
      expect(includeRule.appliesTo("DOO")).toBe(true)
      expect(includeRule.appliesTo("  doo  ")).toBe(true)
      expect(includeRule.appliesTo("Doo")).toBe(true)

      const excludeRule = ApplicabilityRule.except(["obrt"])
      expect(excludeRule.appliesTo("OBRT")).toBe(false)
      expect(excludeRule.appliesTo("  obrt  ")).toBe(false)
    })

    it("ALL rule always returns true", () => {
      const rule = ApplicabilityRule.all()
      expect(rule.appliesTo("")).toBe(true)
      expect(rule.appliesTo("any-type")).toBe(true)
      expect(rule.appliesTo("UPPERCASE")).toBe(true)
    })

    it("INCLUDE rule returns true only for listed types", () => {
      const rule = ApplicabilityRule.forTypes(["a", "b", "c"])
      expect(rule.appliesTo("a")).toBe(true)
      expect(rule.appliesTo("b")).toBe(true)
      expect(rule.appliesTo("c")).toBe(true)
      expect(rule.appliesTo("d")).toBe(false)
    })

    it("EXCLUDE rule returns false only for listed types", () => {
      const rule = ApplicabilityRule.except(["a", "b"])
      expect(rule.appliesTo("a")).toBe(false)
      expect(rule.appliesTo("b")).toBe(false)
      expect(rule.appliesTo("c")).toBe(true)
      expect(rule.appliesTo("d")).toBe(true)
    })
  })

  describe("toJSON / fromJSON", () => {
    it("serializes and deserializes ALL rule", () => {
      const original = ApplicabilityRule.all()
      const json = original.toJSON()
      expect(json).toEqual({ type: "ALL" })

      const restored = ApplicabilityRule.fromJSON(json)
      expect(restored.appliesTo("anything")).toBe(true)
    })

    it("serializes and deserializes INCLUDE rule", () => {
      const original = ApplicabilityRule.forTypes(["doo", "dd"])
      const json = original.toJSON()
      expect(json.type).toBe("INCLUDE")
      expect(json.businessTypes).toEqual(["doo", "dd"])

      const restored = ApplicabilityRule.fromJSON(json)
      expect(restored.appliesTo("doo")).toBe(true)
      expect(restored.appliesTo("obrt")).toBe(false)
    })

    it("serializes and deserializes EXCLUDE rule", () => {
      const original = ApplicabilityRule.except(["obrt"])
      const json = original.toJSON()
      expect(json.type).toBe("EXCLUDE")
      expect(json.businessTypes).toEqual(["obrt"])

      const restored = ApplicabilityRule.fromJSON(json)
      expect(restored.appliesTo("doo")).toBe(true)
      expect(restored.appliesTo("obrt")).toBe(false)
    })

    it("JSON businessTypes is a copy (not reference)", () => {
      const original = ApplicabilityRule.forTypes(["doo"])
      const json = original.toJSON()
      json.businessTypes!.push("hacked")

      // Original should not be affected
      expect(original.appliesTo("hacked")).toBe(false)
    })

    it("throws for unknown rule type in fromJSON", () => {
      const invalidJson = { type: "UNKNOWN" as "ALL" | "INCLUDE" | "EXCLUDE" }
      expect(() => ApplicabilityRule.fromJSON(invalidJson)).toThrow(ComplianceError)
      expect(() => ApplicabilityRule.fromJSON(invalidJson)).toThrow(
        "Unknown applicability rule type"
      )
    })
  })
})
