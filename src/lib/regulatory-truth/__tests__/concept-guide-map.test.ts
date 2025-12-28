import { describe, it, expect } from "vitest"
import { CONCEPT_GUIDE_MAP, getAffectedGuides, getConceptsForGuide } from "../concept-guide-map"

describe("CONCEPT_GUIDE_MAP", () => {
  it("has entries for key regulatory concepts", () => {
    expect(CONCEPT_GUIDE_MAP).toHaveProperty("pdv")
    expect(CONCEPT_GUIDE_MAP).toHaveProperty("pausalni")
    expect(CONCEPT_GUIDE_MAP).toHaveProperty("fiskalizacija")
    expect(CONCEPT_GUIDE_MAP).toHaveProperty("doprinosi")
  })
})

describe("getAffectedGuides", () => {
  it("returns guides for known concept", () => {
    expect(getAffectedGuides("pdv")).toContain("pdv")
    expect(getAffectedGuides("pdv").length).toBeGreaterThan(0)
  })

  it("returns multiple guides for concept affecting several guides", () => {
    const guides = getAffectedGuides("doprinosi")
    expect(guides).toContain("pausalni-obrt")
    expect(guides).toContain("obrt-dohodak")
    expect(guides).toContain("doo")
  })

  it("returns empty array for unknown concept", () => {
    expect(getAffectedGuides("nonexistent")).toEqual([])
  })

  it("returns correct guides for pdv-threshold", () => {
    const guides = getAffectedGuides("pdv-threshold")
    expect(guides).toContain("pdv")
    expect(guides).toContain("pausalni-obrt")
  })
})

describe("getConceptsForGuide", () => {
  it("returns concepts that affect a guide", () => {
    const concepts = getConceptsForGuide("pausalni-obrt")
    expect(concepts).toContain("pausalni")
    expect(concepts).toContain("doprinosi")
  })

  it("returns multiple concepts for guides affected by many concepts", () => {
    const concepts = getConceptsForGuide("pdv")
    expect(concepts).toContain("pdv")
    expect(concepts).toContain("pdv-threshold")
    expect(concepts).toContain("pdv-rates")
  })

  it("returns empty for unknown guide", () => {
    expect(getConceptsForGuide("nonexistent")).toEqual([])
  })

  it("returns correct concepts for doo guide", () => {
    const concepts = getConceptsForGuide("doo")
    expect(concepts).toContain("doprinosi")
    expect(concepts).toContain("doo")
    expect(concepts).toContain("porezna-prijava")
  })
})
