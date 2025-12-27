import { describe, it, expect } from "vitest"
import {
  RefusalCode,
  getRefusalTemplate,
  buildRefusalPayload,
  determineRefusalCode,
  type RefusalPayload,
  type RefusalTemplate,
  type RefusalContext,
  type NextStep,
} from "../refusal-policy"

describe("Refusal Policy", () => {
  describe("RefusalCode enum", () => {
    it("should have 8 refusal codes", () => {
      const codes = Object.values(RefusalCode)
      expect(codes).toHaveLength(8)
    })

    it("should have all expected codes", () => {
      expect(RefusalCode.NO_RULES_FOUND).toBe("NO_RULES_FOUND")
      expect(RefusalCode.MISSING_REQUIRED_DIMENSION).toBe("MISSING_REQUIRED_DIMENSION")
      expect(RefusalCode.GRAY_ZONE).toBe("GRAY_ZONE")
      expect(RefusalCode.UNRESOLVED_CONFLICT).toBe("UNRESOLVED_CONFLICT")
      expect(RefusalCode.MISSING_STRATEGY_DATA).toBe("MISSING_STRATEGY_DATA")
      expect(RefusalCode.UNSUPPORTED_JURISDICTION).toBe("UNSUPPORTED_JURISDICTION")
      expect(RefusalCode.OUT_OF_SCOPE).toBe("OUT_OF_SCOPE")
      expect(RefusalCode.FUTURE_LAW_UNCERTAIN).toBe("FUTURE_LAW_UNCERTAIN")
    })
  })

  describe("getRefusalTemplate", () => {
    it("should return template for MISSING_REQUIRED_DIMENSION", () => {
      const template = getRefusalTemplate(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(template).toBeDefined()
      expect(template.code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(template.severity).toBe("warning")
      expect(template.nextSteps).toHaveLength(2)
    })

    it("should return template for NO_RULES_FOUND", () => {
      const template = getRefusalTemplate(RefusalCode.NO_RULES_FOUND)
      expect(template.severity).toBe("info")
    })

    it("should return template for GRAY_ZONE", () => {
      const template = getRefusalTemplate(RefusalCode.GRAY_ZONE)
      expect(template.requiresHumanReview).toBe(true)
      expect(template.severity).toBe("warning")
    })

    it("should return template for UNRESOLVED_CONFLICT", () => {
      const template = getRefusalTemplate(RefusalCode.UNRESOLVED_CONFLICT)
      expect(template.requiresHumanReview).toBe(true)
      expect(template.severity).toBe("critical")
    })

    it("should return template for MISSING_STRATEGY_DATA", () => {
      const template = getRefusalTemplate(RefusalCode.MISSING_STRATEGY_DATA)
      expect(template.severity).toBe("info")
      expect(template.requiresHumanReview).toBe(false)
    })

    it("should return template for UNSUPPORTED_JURISDICTION", () => {
      const template = getRefusalTemplate(RefusalCode.UNSUPPORTED_JURISDICTION)
      expect(template.severity).toBe("info")
    })

    it("should return template for OUT_OF_SCOPE", () => {
      const template = getRefusalTemplate(RefusalCode.OUT_OF_SCOPE)
      expect(template.severity).toBe("info")
    })

    it("should return template for FUTURE_LAW_UNCERTAIN", () => {
      const template = getRefusalTemplate(RefusalCode.FUTURE_LAW_UNCERTAIN)
      expect(template.severity).toBe("warning")
    })

    it("should have messageHr and messageEn for all templates", () => {
      const codes = Object.values(RefusalCode) as RefusalCode[]
      for (const code of codes) {
        const template = getRefusalTemplate(code)
        expect(template.messageHr).toBeTruthy()
        expect(template.messageEn).toBeTruthy()
      }
    })

    it("should have at least one nextStep for all templates", () => {
      const codes = Object.values(RefusalCode) as RefusalCode[]
      for (const code of codes) {
        const template = getRefusalTemplate(code)
        expect(template.nextSteps.length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe("buildRefusalPayload", () => {
    it("should build payload with missing dimensions", () => {
      const payload = buildRefusalPayload(RefusalCode.MISSING_REQUIRED_DIMENSION, {
        missingDimensions: ["Item", "BuyerType"],
      })

      expect(payload.template.code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(payload.context?.missingDimensions).toEqual(["Item", "BuyerType"])
    })

    it("should build payload with conflicting rules", () => {
      const payload = buildRefusalPayload(RefusalCode.UNRESOLVED_CONFLICT, {
        conflictingRules: ["rule-1", "rule-2"],
      })

      expect(payload.context?.conflictingRules).toEqual(["rule-1", "rule-2"])
    })

    it("should build payload with gray zone topic", () => {
      const payload = buildRefusalPayload(RefusalCode.GRAY_ZONE, {
        grayZoneTopic: "cryptocurrency taxation",
      })

      expect(payload.template.code).toBe(RefusalCode.GRAY_ZONE)
      expect(payload.context?.grayZoneTopic).toBe("cryptocurrency taxation")
    })

    it("should build payload with jurisdiction", () => {
      const payload = buildRefusalPayload(RefusalCode.UNSUPPORTED_JURISDICTION, {
        jurisdiction: "Slovenia",
      })

      expect(payload.context?.jurisdiction).toBe("Slovenia")
    })

    it("should build payload without context", () => {
      const payload = buildRefusalPayload(RefusalCode.OUT_OF_SCOPE)

      expect(payload.template.code).toBe(RefusalCode.OUT_OF_SCOPE)
      expect(payload.context).toBeUndefined()
    })
  })

  describe("determineRefusalCode", () => {
    it("should return MISSING_REQUIRED_DIMENSION when requiredScore < 1", () => {
      const code = determineRefusalCode(0.5, true, false, false)
      expect(code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
    })

    it("should return NO_RULES_FOUND when hasRules is false", () => {
      const code = determineRefusalCode(1.0, false, false, false)
      expect(code).toBe(RefusalCode.NO_RULES_FOUND)
    })

    it("should return UNRESOLVED_CONFLICT when hasConflicts is true", () => {
      const code = determineRefusalCode(1.0, true, true, false)
      expect(code).toBe(RefusalCode.UNRESOLVED_CONFLICT)
    })

    it("should return GRAY_ZONE when isGrayZone is true", () => {
      const code = determineRefusalCode(1.0, true, false, true)
      expect(code).toBe(RefusalCode.GRAY_ZONE)
    })

    it("should return null when no refusal is needed", () => {
      const code = determineRefusalCode(1.0, true, false, false)
      expect(code).toBeNull()
    })

    it("should prioritize requiredScore check over hasRules", () => {
      const code = determineRefusalCode(0.5, false, false, false)
      expect(code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
    })

    it("should prioritize hasRules check over hasConflicts", () => {
      const code = determineRefusalCode(1.0, false, true, false)
      expect(code).toBe(RefusalCode.NO_RULES_FOUND)
    })

    it("should prioritize hasConflicts over isGrayZone", () => {
      const code = determineRefusalCode(1.0, true, true, true)
      expect(code).toBe(RefusalCode.UNRESOLVED_CONFLICT)
    })
  })

  describe("NextStep interface", () => {
    it("should have valid next step types in templates", () => {
      const validTypes = ["CLARIFY", "CONTACT_ADVISOR", "TRY_DIFFERENT_QUESTION", "PROVIDE_CONTEXT"]
      const codes = Object.values(RefusalCode) as RefusalCode[]

      for (const code of codes) {
        const template = getRefusalTemplate(code)
        for (const step of template.nextSteps) {
          expect(validTypes).toContain(step.type)
        }
      }
    })
  })
})
