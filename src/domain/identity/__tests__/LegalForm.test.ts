// src/domain/identity/__tests__/LegalForm.test.ts
import { describe, it, expect } from "vitest"
import { LegalForm } from "../LegalForm"

describe("LegalForm", () => {
  describe("values", () => {
    it("returns all legal form values", () => {
      const values = LegalForm.values()
      expect(values).toContain("OBRT_PAUSAL")
      expect(values).toContain("OBRT_REAL")
      expect(values).toContain("DOO")
      expect(values).toContain("DIONICKO_DRUSTVO")
      expect(values.length).toBe(4)
    })

    it("returns a readonly array", () => {
      const values = LegalForm.values()
      expect(Array.isArray(values)).toBe(true)
    })
  })

  describe("isValid", () => {
    it("returns true for valid legal forms", () => {
      expect(LegalForm.isValid("OBRT_PAUSAL")).toBe(true)
      expect(LegalForm.isValid("OBRT_REAL")).toBe(true)
      expect(LegalForm.isValid("DOO")).toBe(true)
      expect(LegalForm.isValid("DIONICKO_DRUSTVO")).toBe(true)
    })

    it("returns false for invalid legal forms", () => {
      expect(LegalForm.isValid("INVALID")).toBe(false)
      expect(LegalForm.isValid("doo")).toBe(false) // Case sensitive
      expect(LegalForm.isValid("")).toBe(false)
      expect(LegalForm.isValid("LLC")).toBe(false)
      expect(LegalForm.isValid("GmbH")).toBe(false)
    })
  })

  describe("getDisplayName", () => {
    it("returns Croatian display name for OBRT_PAUSAL", () => {
      expect(LegalForm.getDisplayName("OBRT_PAUSAL")).toBe("Obrt (pausalni)")
    })

    it("returns Croatian display name for OBRT_REAL", () => {
      expect(LegalForm.getDisplayName("OBRT_REAL")).toBe("Obrt (realni)")
    })

    it("returns Croatian display name for DOO", () => {
      expect(LegalForm.getDisplayName("DOO")).toBe("d.o.o.")
    })

    it("returns Croatian display name for DIONICKO_DRUSTVO", () => {
      expect(LegalForm.getDisplayName("DIONICKO_DRUSTVO")).toBe("d.d.")
    })

    it("returns the form itself for unknown forms", () => {
      expect(LegalForm.getDisplayName("UNKNOWN" as "DOO")).toBe("UNKNOWN")
    })
  })

  describe("constants", () => {
    it("exports legal form constants", () => {
      expect(LegalForm.OBRT_PAUSAL).toBe("OBRT_PAUSAL")
      expect(LegalForm.OBRT_REAL).toBe("OBRT_REAL")
      expect(LegalForm.DOO).toBe("DOO")
      expect(LegalForm.DIONICKO_DRUSTVO).toBe("DIONICKO_DRUSTVO")
    })
  })

  describe("Croatian business type coverage", () => {
    it("covers sole proprietorships (obrti)", () => {
      // Croatian "obrt" can be taxed either as flat-rate (pausalni) or real income
      expect(LegalForm.isValid("OBRT_PAUSAL")).toBe(true)
      expect(LegalForm.isValid("OBRT_REAL")).toBe(true)
    })

    it("covers limited liability companies", () => {
      // d.o.o. = društvo s ograničenom odgovornošću
      expect(LegalForm.isValid("DOO")).toBe(true)
      expect(LegalForm.getDisplayName("DOO")).toBe("d.o.o.")
    })

    it("covers joint stock companies", () => {
      // d.d. = dioničko društvo
      expect(LegalForm.isValid("DIONICKO_DRUSTVO")).toBe(true)
      expect(LegalForm.getDisplayName("DIONICKO_DRUSTVO")).toBe("d.d.")
    })
  })
})
