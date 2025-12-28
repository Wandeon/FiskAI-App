// src/lib/regulatory-truth/content-sync/__tests__/concept-registry.test.ts
import { describe, it, expect } from "vitest"
import * as path from "path"
import {
  CONCEPT_REGISTRY,
  getConceptMapping,
  resolveContentPaths,
  getAllConceptIds,
  getConceptsForFile,
  getConceptsForTool,
  type ConceptMapping,
} from "../concept-registry"

describe("concept-registry", () => {
  describe("CONCEPT_REGISTRY", () => {
    it("should have at least 20 concepts", () => {
      expect(CONCEPT_REGISTRY.length).toBeGreaterThanOrEqual(20)
    })

    it("should have no duplicate conceptIds", () => {
      const ids = CONCEPT_REGISTRY.map((m) => m.conceptId)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it("should have all mdxPaths ending with .mdx", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        for (const mdxPath of mapping.mdxPaths) {
          expect(mdxPath).toMatch(/\.mdx$/)
        }
      }
    })

    it("should have non-empty conceptId for all mappings", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        expect(mapping.conceptId).toBeTruthy()
        expect(mapping.conceptId.length).toBeGreaterThan(0)
      }
    })

    it("should have non-empty description for all mappings", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        expect(mapping.description).toBeTruthy()
        expect(mapping.description.length).toBeGreaterThan(0)
      }
    })

    it("should have at least one mdxPath for all mappings", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        expect(mapping.mdxPaths.length).toBeGreaterThan(0)
      }
    })

    it("should have no duplicate mdxPaths within a single mapping", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        const uniquePaths = new Set(mapping.mdxPaths)
        expect(uniquePaths.size).toBe(mapping.mdxPaths.length)
      }
    })

    it("should have valid relative paths (no leading slash)", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        for (const mdxPath of mapping.mdxPaths) {
          expect(mdxPath).not.toMatch(/^\//)
          expect(mdxPath).not.toMatch(/^\.\./)
        }
      }
    })
  })

  describe("getConceptMapping", () => {
    it("should find mapping by conceptId", () => {
      const mapping = getConceptMapping("pdv-threshold")
      expect(mapping).toBeDefined()
      expect(mapping?.conceptId).toBe("pdv-threshold")
      expect(mapping?.mdxPaths).toContain("vodici/pausalni-obrt.mdx")
    })

    it("should return undefined for unknown conceptId", () => {
      const mapping = getConceptMapping("non-existent-concept")
      expect(mapping).toBeUndefined()
    })

    it("should return undefined for empty string", () => {
      const mapping = getConceptMapping("")
      expect(mapping).toBeUndefined()
    })

    it("should find pausalni-revenue-limit concept", () => {
      const mapping = getConceptMapping("pausalni-revenue-limit")
      expect(mapping).toBeDefined()
      expect(mapping?.description.toLowerCase()).toContain("pausalni")
    })

    it("should find mirovinsko-rate concept", () => {
      const mapping = getConceptMapping("mirovinsko-rate")
      expect(mapping).toBeDefined()
      expect(mapping?.mdxPaths).toContain("rjecnik/mio.mdx")
    })

    it("should find jdoo-capital-requirement concept", () => {
      const mapping = getConceptMapping("jdoo-capital-requirement")
      expect(mapping).toBeDefined()
      expect(mapping?.mdxPaths).toContain("rjecnik/jdoo.mdx")
    })
  })

  describe("resolveContentPaths", () => {
    it("should resolve paths to absolute", () => {
      const mapping: ConceptMapping = {
        conceptId: "test",
        description: "Test concept",
        mdxPaths: ["vodici/test.mdx", "rjecnik/test.mdx"],
      }
      const contentDir = "/home/user/project/content"
      const resolved = resolveContentPaths(mapping, contentDir)

      expect(resolved).toHaveLength(2)
      expect(resolved[0]).toBe("/home/user/project/content/vodici/test.mdx")
      expect(resolved[1]).toBe("/home/user/project/content/rjecnik/test.mdx")
    })

    it("should handle paths with content directory ending in slash", () => {
      const mapping: ConceptMapping = {
        conceptId: "test",
        description: "Test concept",
        mdxPaths: ["vodici/test.mdx"],
      }
      const resolved = resolveContentPaths(mapping, "/content/")

      // path.join normalizes the trailing slash
      expect(resolved[0]).toBe("/content/vodici/test.mdx")
    })

    it("should return empty array for mapping with no paths", () => {
      const mapping: ConceptMapping = {
        conceptId: "test",
        description: "Test concept",
        mdxPaths: [],
      }
      const resolved = resolveContentPaths(mapping, "/content")

      expect(resolved).toHaveLength(0)
    })

    it("should work with real registry mapping", () => {
      const mapping = getConceptMapping("pdv-threshold")!
      const contentDir = "/var/www/fiskai/content"
      const resolved = resolveContentPaths(mapping, contentDir)

      expect(resolved.length).toBe(mapping.mdxPaths.length)
      expect(resolved[0]).toMatch(/^\/var\/www\/fiskai\/content\//)
      expect(resolved[0]).toMatch(/\.mdx$/)
    })
  })

  describe("getAllConceptIds", () => {
    it("should return all concept IDs", () => {
      const ids = getAllConceptIds()
      expect(ids.length).toBe(CONCEPT_REGISTRY.length)
    })

    it("should include known concept IDs", () => {
      const ids = getAllConceptIds()
      expect(ids).toContain("pdv-threshold")
      expect(ids).toContain("pausalni-revenue-limit")
      expect(ids).toContain("zdravstveno-rate")
      expect(ids).toContain("mirovinsko-rate")
      expect(ids).toContain("fiskalizacija-required")
      expect(ids).toContain("posd-deadline")
      expect(ids).toContain("joppd-deadline")
      expect(ids).toContain("jdoo-capital-requirement")
      expect(ids).toContain("doo-capital-requirement")
      expect(ids).toContain("porez-na-dohodak-rates")
      expect(ids).toContain("osobni-odbitak")
      expect(ids).toContain("porez-na-dobit-rate")
      expect(ids).toContain("e-racun-mandatory")
      expect(ids).toContain("reverse-charge-eu")
      expect(ids).toContain("minimalna-placa")
      expect(ids).toContain("opg-pdv-threshold")
      expect(ids).toContain("opg-pausalni-limit")
    })

    it("should return unique IDs", () => {
      const ids = getAllConceptIds()
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe("getConceptsForFile", () => {
    it("should find concepts that affect a specific MDX file", () => {
      const concepts = getConceptsForFile("vodici/pausalni-obrt.mdx")
      expect(concepts.length).toBeGreaterThan(0)

      const conceptIds = concepts.map((c) => c.conceptId)
      expect(conceptIds).toContain("pdv-threshold")
      expect(conceptIds).toContain("pausalni-revenue-limit")
      expect(conceptIds).toContain("pausalni-tax-rate")
    })

    it("should return empty array for non-existent file", () => {
      const concepts = getConceptsForFile("non-existent/file.mdx")
      expect(concepts).toHaveLength(0)
    })

    it("should find concepts for rjecnik/pdv.mdx", () => {
      const concepts = getConceptsForFile("rjecnik/pdv.mdx")
      expect(concepts.length).toBeGreaterThan(0)

      const conceptIds = concepts.map((c) => c.conceptId)
      expect(conceptIds).toContain("pdv-threshold")
      expect(conceptIds).toContain("pdv-standard-rate")
    })
  })

  describe("getConceptsForTool", () => {
    it("should find concepts that affect pausalni-calculator", () => {
      const concepts = getConceptsForTool("pausalni-calculator")
      expect(concepts.length).toBeGreaterThan(0)

      const conceptIds = concepts.map((c) => c.conceptId)
      expect(conceptIds).toContain("pdv-threshold")
      expect(conceptIds).toContain("pausalni-revenue-limit")
      expect(conceptIds).toContain("pausalni-tax-rate")
      expect(conceptIds).toContain("zdravstveno-rate")
      expect(conceptIds).toContain("mirovinsko-rate")
    })

    it("should return empty array for non-existent tool", () => {
      const concepts = getConceptsForTool("non-existent-tool")
      expect(concepts).toHaveLength(0)
    })

    it("should find concepts for deadline-tracker", () => {
      const concepts = getConceptsForTool("deadline-tracker")
      expect(concepts.length).toBeGreaterThan(0)

      const conceptIds = concepts.map((c) => c.conceptId)
      expect(conceptIds).toContain("posd-deadline")
      expect(conceptIds).toContain("joppd-deadline")
    })

    it("should find concepts for income-tax-calculator", () => {
      const concepts = getConceptsForTool("income-tax-calculator")
      expect(concepts.length).toBeGreaterThan(0)

      const conceptIds = concepts.map((c) => c.conceptId)
      expect(conceptIds).toContain("porez-na-dohodak-rates")
      expect(conceptIds).toContain("osobni-odbitak")
    })
  })

  describe("required concepts from specification", () => {
    const requiredConcepts = [
      "pdv-threshold",
      "pausalni-revenue-limit",
      "pausalni-tax-rate",
      "pausalni-contribution-base",
      "zdravstveno-rate",
      "mirovinsko-rate",
      "fiskalizacija-required",
      "posd-deadline",
      "joppd-deadline",
      "jdoo-capital-requirement",
      "doo-capital-requirement",
      "porez-na-dohodak-rates",
      "osobni-odbitak",
      "porez-na-dobit-rate",
      "e-racun-mandatory",
      "reverse-charge-eu",
      "minimalna-placa",
      "opg-pdv-threshold",
      "opg-pausalni-limit",
    ]

    it.each(requiredConcepts)("should have %s concept defined", (conceptId) => {
      const mapping = getConceptMapping(conceptId)
      expect(mapping).toBeDefined()
      expect(mapping?.mdxPaths.length).toBeGreaterThan(0)
    })
  })

  describe("ConceptMapping interface compliance", () => {
    it("should have required fields for all mappings", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        // Required fields
        expect(typeof mapping.conceptId).toBe("string")
        expect(typeof mapping.description).toBe("string")
        expect(Array.isArray(mapping.mdxPaths)).toBe(true)

        // Optional toolIds should be array if present
        if (mapping.toolIds !== undefined) {
          expect(Array.isArray(mapping.toolIds)).toBe(true)
        }
      }
    })

    it("should have valid toolIds when present", () => {
      for (const mapping of CONCEPT_REGISTRY) {
        if (mapping.toolIds) {
          for (const toolId of mapping.toolIds) {
            expect(typeof toolId).toBe("string")
            expect(toolId.length).toBeGreaterThan(0)
          }
        }
      }
    })
  })
})
