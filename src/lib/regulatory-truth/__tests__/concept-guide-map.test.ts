import { describe, it } from "node:test"
import assert from "node:assert"
import { CONCEPT_GUIDE_MAP, getAffectedGuides, getConceptsForGuide } from "../concept-guide-map"

describe("CONCEPT_GUIDE_MAP", () => {
  it("has entries for key regulatory concepts", () => {
    assert.ok("pdv" in CONCEPT_GUIDE_MAP)
    assert.ok("pausalni" in CONCEPT_GUIDE_MAP)
    assert.ok("fiskalizacija" in CONCEPT_GUIDE_MAP)
    assert.ok("doprinosi" in CONCEPT_GUIDE_MAP)
  })
})

describe("getAffectedGuides", () => {
  it("returns guides for known concept", () => {
    assert.ok(getAffectedGuides("pdv").includes("pdv"))
    assert.ok(getAffectedGuides("pdv").length > 0)
  })

  it("returns multiple guides for concept affecting several guides", () => {
    const guides = getAffectedGuides("doprinosi")
    assert.ok(guides.includes("pausalni-obrt"))
    assert.ok(guides.includes("obrt-dohodak"))
    assert.ok(guides.includes("doo"))
  })

  it("returns empty array for unknown concept", () => {
    assert.deepStrictEqual(getAffectedGuides("nonexistent"), [])
  })

  it("returns correct guides for pdv-threshold", () => {
    const guides = getAffectedGuides("pdv-threshold")
    assert.ok(guides.includes("pdv"))
    assert.ok(guides.includes("pausalni-obrt"))
  })
})

describe("getConceptsForGuide", () => {
  it("returns concepts that affect a guide", () => {
    const concepts = getConceptsForGuide("pausalni-obrt")
    assert.ok(concepts.includes("pausalni"))
    assert.ok(concepts.includes("doprinosi"))
  })

  it("returns multiple concepts for guides affected by many concepts", () => {
    const concepts = getConceptsForGuide("pdv")
    assert.ok(concepts.includes("pdv"))
    assert.ok(concepts.includes("pdv-threshold"))
    assert.ok(concepts.includes("pdv-rates"))
  })

  it("returns empty for unknown guide", () => {
    assert.deepStrictEqual(getConceptsForGuide("nonexistent"), [])
  })

  it("returns correct concepts for doo guide", () => {
    const concepts = getConceptsForGuide("doo")
    assert.ok(concepts.includes("doprinosi"))
    assert.ok(concepts.includes("doo"))
    assert.ok(concepts.includes("porezna-prijava"))
  })
})
