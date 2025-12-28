import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { createReadStream } from "fs"
import { promisify } from "util"
import { pipeline } from "stream"
import * as yauzl from "yauzl"

import {
  exportRegulatoryPack,
  exportRegulatoryPackZip,
  exportRegulatoryPackZipStream,
  type RegulatoryPackExportOptions,
  type RegulatoryPackManifest,
  type RegulatoryPack,
  type GovernanceConfig,
} from "../exporters/regulatory-pack"
import type { SystemComponent, CriticalPath, DriftEntry } from "../schema"

const pipelineAsync = promisify(pipeline)

/**
 * Create a minimal test component.
 */
function createTestComponent(overrides: Partial<SystemComponent> = {}): SystemComponent {
  return {
    componentId: overrides.componentId ?? "lib-test",
    type: overrides.type ?? "LIB",
    name: overrides.name ?? "Test Component",
    status: overrides.status ?? "STABLE",
    criticality: overrides.criticality ?? "MEDIUM",
    owner: overrides.owner ?? "team:platform",
    docsRef: overrides.docsRef ?? "docs/test.md",
    codeRef: overrides.codeRef ?? "src/lib/test",
    dependencies: overrides.dependencies ?? [],
    ...overrides,
  }
}

/**
 * Create a minimal test critical path.
 */
function createTestCriticalPath(overrides: Partial<CriticalPath> = {}): CriticalPath {
  return {
    pathId: overrides.pathId ?? "path-test",
    name: overrides.name ?? "Test Path",
    reason: overrides.reason ?? "Test reason",
    components: overrides.components ?? ["lib-test"],
    sloTarget: overrides.sloTarget,
    ...overrides,
  }
}

/**
 * Create a test drift entry.
 */
function createTestDriftEntry(overrides: Partial<DriftEntry> = {}): DriftEntry {
  return {
    componentId: overrides.componentId ?? "lib-undeclared",
    type: overrides.type ?? "LIB",
    driftType: overrides.driftType ?? "OBSERVED_NOT_DECLARED",
    risk: overrides.risk ?? "MEDIUM",
    reason: overrides.reason,
    observedAt: overrides.observedAt,
    declaredSource: overrides.declaredSource,
    gaps: overrides.gaps,
    ...overrides,
  }
}

/**
 * Extract a ZIP buffer to an object mapping filenames to contents.
 */
async function extractZipBuffer(buffer: Buffer): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const files = new Map<string, string>()

    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      if (!zipfile) {
        reject(new Error("No zipfile returned"))
        return
      }

      zipfile.readEntry()

      zipfile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry - skip
          zipfile.readEntry()
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err)
              return
            }

            if (!readStream) {
              reject(new Error("No read stream returned"))
              return
            }

            const chunks: Buffer[] = []
            readStream.on("data", (chunk) => chunks.push(chunk))
            readStream.on("end", () => {
              files.set(entry.fileName, Buffer.concat(chunks).toString("utf-8"))
              zipfile.readEntry()
            })
            readStream.on("error", reject)
          })
        }
      })

      zipfile.on("end", () => {
        resolve(files)
      })

      zipfile.on("error", reject)
    })
  })
}

describe("Regulatory Pack Exporter", () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `regulatory-pack-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe("exportRegulatoryPack (JSON)", () => {
    it("exports valid JSON structure", () => {
      const components = [createTestComponent()]
      const criticalPaths = [createTestCriticalPath()]

      const result = exportRegulatoryPack(components, criticalPaths)
      const pack = JSON.parse(result) as RegulatoryPack

      assert.ok(pack.exportedAt)
      assert.ok(pack.version)
      assert.ok(pack.summary)
      assert.ok(pack.criticalPaths)
      assert.ok(Array.isArray(pack.components))
    })

    it("includes summary statistics", () => {
      const components = [
        createTestComponent({ componentId: "lib-a", type: "LIB", criticality: "CRITICAL" }),
        createTestComponent({ componentId: "lib-b", type: "LIB", criticality: "HIGH" }),
        createTestComponent({ componentId: "worker-a", type: "WORKER", criticality: "MEDIUM" }),
      ]
      const criticalPaths = [createTestCriticalPath()]

      const result = exportRegulatoryPack(components, criticalPaths)
      const pack = JSON.parse(result) as RegulatoryPack

      assert.equal(pack.summary.totalComponents, 3)
      assert.equal(pack.summary.criticalPathCount, 1)
      assert.equal(pack.summary.componentsByType["LIB"], 2)
      assert.equal(pack.summary.componentsByType["WORKER"], 1)
      assert.equal(pack.summary.componentsByCriticality["CRITICAL"], 1)
      assert.equal(pack.summary.componentsByCriticality["HIGH"], 1)
      assert.equal(pack.summary.componentsByCriticality["MEDIUM"], 1)
    })

    it("respects version option", () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []

      const result = exportRegulatoryPack(components, criticalPaths, { version: "2.0" })
      const pack = JSON.parse(result) as RegulatoryPack

      assert.equal(pack.version, "2.0")
    })

    it("includes critical paths with components", () => {
      const components = [createTestComponent({ componentId: "lib-auth" })]
      const criticalPaths = [
        createTestCriticalPath({
          pathId: "path-auth",
          name: "Auth Flow",
          reason: "Critical for security",
          components: ["lib-auth"],
          sloTarget: "99.9%",
        }),
      ]

      const result = exportRegulatoryPack(components, criticalPaths)
      const pack = JSON.parse(result) as RegulatoryPack

      assert.equal(pack.criticalPaths.length, 1)
      assert.equal(pack.criticalPaths[0].pathId, "path-auth")
      assert.equal(pack.criticalPaths[0].name, "Auth Flow")
      assert.equal(pack.criticalPaths[0].sloTarget, "99.9%")
      assert.deepEqual(pack.criticalPaths[0].components, ["lib-auth"])
    })
  })

  describe("exportRegulatoryPackZip", () => {
    it("creates a valid ZIP buffer", async () => {
      const components = [createTestComponent()]
      const criticalPaths = [createTestCriticalPath()]

      const buffer = await exportRegulatoryPackZip(components, criticalPaths)

      assert.ok(Buffer.isBuffer(buffer))
      assert.ok(buffer.length > 0)

      // Check ZIP magic number
      assert.equal(buffer[0], 0x50) // P
      assert.equal(buffer[1], 0x4b) // K
    })

    it("includes manifest.json with correct structure", async () => {
      const components = [
        createTestComponent({ componentId: "lib-a", criticality: "CRITICAL" }),
        createTestComponent({ componentId: "lib-b", criticality: "HIGH" }),
      ]
      const criticalPaths = [createTestCriticalPath()]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, {
        version: "1.0.0",
        generatedAt,
      })

      const files = await extractZipBuffer(buffer)
      const manifestPath = "regulatory-export-2025-01-15/manifest.json"
      assert.ok(files.has(manifestPath), `Missing ${manifestPath}`)

      const manifest = JSON.parse(files.get(manifestPath)!) as RegulatoryPackManifest
      assert.equal(manifest.exportVersion, "1.0.0")
      assert.equal(manifest.generatedAt, "2025-01-15T10:00:00.000Z")
      assert.equal(manifest.generatedBy, "system-registry-export")
      assert.equal(manifest.componentCount, 2)
      assert.equal(manifest.criticalCount, 1)
      assert.ok(Array.isArray(manifest.files))
      assert.ok(manifest.files.includes("manifest.json"))
      assert.ok(manifest.files.includes("ownership-matrix.csv"))
      assert.ok(manifest.files.includes("critical-paths.json"))
      assert.ok(manifest.files.includes("drift-report.md"))
      assert.ok(manifest.files.includes("governance-config.json"))
    })

    it("includes ownership-matrix.csv", async () => {
      const components = [
        createTestComponent({
          componentId: "lib-auth",
          name: "Auth Library",
          owner: "team:security",
          criticality: "CRITICAL",
        }),
      ]
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const csvPath = "regulatory-export-2025-01-15/ownership-matrix.csv"
      assert.ok(files.has(csvPath), `Missing ${csvPath}`)

      const csv = files.get(csvPath)!
      const lines = csv.split("\n")

      // Header row
      assert.ok(lines[0].includes("component_id"))
      assert.ok(lines[0].includes("owner"))
      assert.ok(lines[0].includes("criticality"))

      // Data row
      assert.ok(lines[1].includes("lib-auth"))
      assert.ok(lines[1].includes("team:security"))
      assert.ok(lines[1].includes("CRITICAL"))
    })

    it("includes critical-paths.json with enriched component data", async () => {
      const components = [
        createTestComponent({
          componentId: "lib-auth",
          name: "Auth Library",
          type: "LIB",
          owner: "team:security",
          criticality: "CRITICAL",
        }),
      ]
      const criticalPaths = [
        createTestCriticalPath({
          pathId: "path-auth",
          name: "Authentication Flow",
          reason: "Security critical",
          components: ["lib-auth"],
          sloTarget: "99.9%",
        }),
      ]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const pathsPath = "regulatory-export-2025-01-15/critical-paths.json"
      assert.ok(files.has(pathsPath), `Missing ${pathsPath}`)

      const paths = JSON.parse(files.get(pathsPath)!)
      assert.equal(paths.length, 1)
      assert.equal(paths[0].pathId, "path-auth")
      assert.equal(paths[0].name, "Authentication Flow")
      assert.equal(paths[0].sloTarget, "99.9%")

      // Check enriched component data
      assert.equal(paths[0].components.length, 1)
      assert.equal(paths[0].components[0].componentId, "lib-auth")
      assert.equal(paths[0].components[0].name, "Auth Library")
      assert.equal(paths[0].components[0].type, "LIB")
      assert.equal(paths[0].components[0].owner, "team:security")
      assert.equal(paths[0].components[0].criticality, "CRITICAL")
    })

    it("includes drift-report.md", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []
      const driftEntries = [
        createTestDriftEntry({
          componentId: "lib-undeclared",
          driftType: "OBSERVED_NOT_DECLARED",
          risk: "HIGH",
          reason: "Shadow system detected",
        }),
      ]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, {
        generatedAt,
        driftEntries,
      })

      const files = await extractZipBuffer(buffer)
      const driftPath = "regulatory-export-2025-01-15/drift-report.md"
      assert.ok(files.has(driftPath), `Missing ${driftPath}`)

      const md = files.get(driftPath)!
      assert.ok(md.includes("# Drift Report"))
      assert.ok(md.includes("OBSERVED_NOT_DECLARED"))
      assert.ok(md.includes("lib-undeclared"))
      assert.ok(md.includes("HIGH"))
      assert.ok(md.includes("Shadow system detected"))
    })

    it("includes drift-report.md with empty message when no drift", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, {
        generatedAt,
        driftEntries: [],
      })

      const files = await extractZipBuffer(buffer)
      const driftPath = "regulatory-export-2025-01-15/drift-report.md"
      const md = files.get(driftPath)!

      assert.ok(md.includes("# Drift Report"))
      assert.ok(md.includes("No drift entries detected"))
    })

    it("includes governance-config.json", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const govPath = "regulatory-export-2025-01-15/governance-config.json"
      assert.ok(files.has(govPath), `Missing ${govPath}`)

      const gov = JSON.parse(files.get(govPath)!) as GovernanceConfig
      assert.ok(Array.isArray(gov.libExclusions))
      assert.ok(Array.isArray(gov.workerServiceExclusions))
      assert.ok(Array.isArray(gov.ignoredComponents))
      assert.ok(Array.isArray(gov.allowedOwners))
      assert.ok(Array.isArray(gov.integrationPatterns))
      assert.ok(gov.enforcementRoadmap)
    })

    it("includes component-details/ folder with individual JSON files", async () => {
      const components = [
        createTestComponent({ componentId: "lib-auth" }),
        createTestComponent({ componentId: "lib-billing" }),
      ]
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const authPath = "regulatory-export-2025-01-15/component-details/lib-auth.json"
      const billingPath = "regulatory-export-2025-01-15/component-details/lib-billing.json"

      assert.ok(files.has(authPath), `Missing ${authPath}`)
      assert.ok(files.has(billingPath), `Missing ${billingPath}`)

      const authComponent = JSON.parse(files.get(authPath)!)
      assert.equal(authComponent.componentId, "lib-auth")

      const billingComponent = JSON.parse(files.get(billingPath)!)
      assert.equal(billingComponent.componentId, "lib-billing")
    })

    it("uses correct folder name based on date", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []

      // Test different dates
      const date1 = new Date("2024-12-25T10:00:00Z")
      const buffer1 = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt: date1 })
      const files1 = await extractZipBuffer(buffer1)
      assert.ok(
        Array.from(files1.keys()).some((k) => k.startsWith("regulatory-export-2024-12-25/")),
        "Should use 2024-12-25 folder"
      )

      const date2 = new Date("2025-03-01T10:00:00Z")
      const buffer2 = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt: date2 })
      const files2 = await extractZipBuffer(buffer2)
      assert.ok(
        Array.from(files2.keys()).some((k) => k.startsWith("regulatory-export-2025-03-01/")),
        "Should use 2025-03-01 folder"
      )
    })

    it("handles empty components list", async () => {
      const components: SystemComponent[] = []
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const manifestPath = "regulatory-export-2025-01-15/manifest.json"
      const manifest = JSON.parse(files.get(manifestPath)!) as RegulatoryPackManifest

      assert.equal(manifest.componentCount, 0)
      assert.equal(manifest.criticalCount, 0)
    })

    it("handles components with special characters in name", async () => {
      const components = [
        createTestComponent({
          componentId: "lib-test",
          name: 'Component with "quotes" and, commas',
        }),
      ]
      const criticalPaths: CriticalPath[] = []
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const csvPath = "regulatory-export-2025-01-15/ownership-matrix.csv"
      const csv = files.get(csvPath)!

      // CSV should escape quotes properly
      assert.ok(csv.includes('quotes""'), "Quotes should be escaped in CSV")
    })
  })

  describe("exportRegulatoryPackZipStream", () => {
    it("returns a readable stream", async () => {
      const components = [createTestComponent()]
      const criticalPaths = [createTestCriticalPath()]

      const stream = exportRegulatoryPackZipStream(components, criticalPaths)

      assert.ok(stream.readable !== false)
    })

    it("produces valid ZIP data", async () => {
      const components = [createTestComponent()]
      const criticalPaths = [createTestCriticalPath()]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const stream = exportRegulatoryPackZipStream(components, criticalPaths, { generatedAt })

      // Collect stream into buffer
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk))
        stream.on("end", () => resolve())
        stream.on("error", reject)
      })

      const buffer = Buffer.concat(chunks)

      // Verify ZIP magic number
      assert.equal(buffer[0], 0x50) // P
      assert.equal(buffer[1], 0x4b) // K

      // Verify contents
      const files = await extractZipBuffer(buffer)
      const manifestPath = "regulatory-export-2025-01-15/manifest.json"
      assert.ok(files.has(manifestPath))
    })

    it("can be piped to a file", async () => {
      const components = [createTestComponent()]
      const criticalPaths = [createTestCriticalPath()]
      const generatedAt = new Date("2025-01-15T10:00:00Z")
      const outputPath = join(testDir, "test-export.zip")

      const stream = exportRegulatoryPackZipStream(components, criticalPaths, { generatedAt })

      // Write stream to file
      const { createWriteStream } = await import("fs")
      const writeStream = createWriteStream(outputPath)

      await pipelineAsync(stream, writeStream)

      // Verify file exists and is valid ZIP
      assert.ok(existsSync(outputPath))

      const fileBuffer = readFileSync(outputPath)
      const files = await extractZipBuffer(fileBuffer)
      assert.ok(files.has("regulatory-export-2025-01-15/manifest.json"))
    })
  })

  describe("Drift Report Generation", () => {
    it("groups drift entries by type", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []
      const driftEntries = [
        createTestDriftEntry({ componentId: "lib-a", driftType: "OBSERVED_NOT_DECLARED" }),
        createTestDriftEntry({ componentId: "lib-b", driftType: "OBSERVED_NOT_DECLARED" }),
        createTestDriftEntry({ componentId: "lib-c", driftType: "METADATA_GAP", gaps: ["NO_OWNER"] }),
      ]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, {
        generatedAt,
        driftEntries,
      })

      const files = await extractZipBuffer(buffer)
      const md = files.get("regulatory-export-2025-01-15/drift-report.md")!

      // Check summary table
      assert.ok(md.includes("| OBSERVED_NOT_DECLARED | 2 |"))
      assert.ok(md.includes("| METADATA_GAP | 1 |"))

      // Check sections
      assert.ok(md.includes("## OBSERVED_NOT_DECLARED"))
      assert.ok(md.includes("## METADATA_GAP"))
    })

    it("includes reason or gaps in drift entries", async () => {
      const components = [createTestComponent()]
      const criticalPaths: CriticalPath[] = []
      const driftEntries = [
        createTestDriftEntry({
          componentId: "lib-a",
          driftType: "METADATA_GAP",
          gaps: ["NO_OWNER", "NO_DOCS"],
        }),
        createTestDriftEntry({
          componentId: "lib-b",
          driftType: "CODEREF_INVALID",
          reason: "Path does not exist: src/lib/missing",
        }),
      ]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, {
        generatedAt,
        driftEntries,
      })

      const files = await extractZipBuffer(buffer)
      const md = files.get("regulatory-export-2025-01-15/drift-report.md")!

      assert.ok(md.includes("NO_OWNER, NO_DOCS"))
      assert.ok(md.includes("Path does not exist: src/lib/missing"))
    })
  })

  describe("Critical Paths with Unknown Components", () => {
    it("shows Unknown for missing component data", async () => {
      const components = [createTestComponent({ componentId: "lib-auth" })]
      const criticalPaths = [
        createTestCriticalPath({
          pathId: "path-mixed",
          components: ["lib-auth", "lib-missing"],
        }),
      ]
      const generatedAt = new Date("2025-01-15T10:00:00Z")

      const buffer = await exportRegulatoryPackZip(components, criticalPaths, { generatedAt })

      const files = await extractZipBuffer(buffer)
      const paths = JSON.parse(files.get("regulatory-export-2025-01-15/critical-paths.json")!)

      assert.equal(paths[0].components.length, 2)
      assert.equal(paths[0].components[0].name, "Test Component")
      assert.equal(paths[0].components[1].name, "Unknown")
      assert.equal(paths[0].components[1].type, "Unknown")
      assert.equal(paths[0].components[1].owner, null)
      assert.equal(paths[0].components[1].criticality, "Unknown")
    })
  })
})
