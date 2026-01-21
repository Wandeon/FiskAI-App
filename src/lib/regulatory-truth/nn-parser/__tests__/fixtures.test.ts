import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { NNParser } from "../index"

const FIXTURES_DIR = join(process.cwd(), "src/lib/regulatory-truth/nn-parser/__fixtures__")

interface FixtureManifest {
  version: string
  fixtures: Array<{
    id: string
    category: string
    expectedArticles?: number
  }>
}

interface ExpectedNodes {
  requiredPaths: string[]
  minNodeCount: number
  minCoveragePercent: number
}

describe("NN Parser Fixtures", () => {
  // Skip if fixtures don't exist
  if (!existsSync(FIXTURES_DIR)) {
    it.skip("fixtures directory does not exist", () => {})
    return
  }

  const manifest = JSON.parse(
    readFileSync(join(FIXTURES_DIR, "manifest.json"), "utf-8")
  ) as FixtureManifest

  for (const fixture of manifest.fixtures) {
    describe(`Fixture: ${fixture.id}`, () => {
      const fixtureDir = join(FIXTURES_DIR, fixture.category, fixture.id)

      if (!existsSync(fixtureDir)) {
        it.skip(`fixture directory missing: ${fixtureDir}`, () => {})
        return
      }

      const inputPath = join(fixtureDir, "input.html")
      const expectedNodesPath = join(fixtureDir, "expected-nodes.json")
      const expectedMetaPath = join(fixtureDir, "expected-meta.json")

      it("parses successfully", async () => {
        const html = readFileSync(inputPath, "utf-8")

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        expect(result.status).toMatch(/SUCCESS|PARTIAL/)
      })

      it("extracts expected metadata", async () => {
        if (!existsSync(expectedMetaPath)) {
          return // Skip if no expected meta
        }

        const html = readFileSync(inputPath, "utf-8")
        const expectedMeta = JSON.parse(readFileSync(expectedMetaPath, "utf-8"))

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        if (expectedMeta.title) {
          expect(result.docMeta.title).toContain(expectedMeta.title.substring(0, 20))
        }
        if (expectedMeta.textType) {
          expect(result.docMeta.textType).toBe(expectedMeta.textType)
        }
      })

      it("produces expected node structure", async () => {
        if (!existsSync(expectedNodesPath)) {
          return // Skip if no expected nodes
        }

        const html = readFileSync(inputPath, "utf-8")
        const expected = JSON.parse(readFileSync(expectedNodesPath, "utf-8")) as ExpectedNodes

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        // Check required paths
        const actualPaths = new Set(result.nodes.map((n) => n.nodePath))
        for (const requiredPath of expected.requiredPaths) {
          expect(actualPaths.has(requiredPath), `Missing path: ${requiredPath}`).toBe(true)
        }

        // Check min node count
        expect(result.stats.nodeCount).toBeGreaterThanOrEqual(expected.minNodeCount)

        // Check min coverage
        expect(result.stats.coveragePercent).toBeGreaterThanOrEqual(expected.minCoveragePercent)
      })
    })
  }
})
