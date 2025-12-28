/**
 * Regulatory Pack Exporter
 *
 * Exports registry data as a structured ZIP package for regulatory compliance audits.
 *
 * Output structure:
 * regulatory-export-YYYY-MM-DD/
 * ├── manifest.json
 * ├── ownership-matrix.csv
 * ├── critical-paths.json
 * ├── drift-report.md
 * ├── governance-config.json
 * └── component-details/
 *     ├── lib-auth.json
 *     └── ...
 */

import type { Readable } from "stream"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver") as typeof import("archiver")
import type {
  SystemComponent,
  CriticalPath,
  ComponentType,
  ComponentCriticality,
  DriftEntry,
} from "../schema"
import {
  LIB_EXCLUSIONS,
  WORKER_SERVICE_EXCLUSIONS,
  IGNORED_COMPONENTS,
  ALLOWED_OWNERS,
  INTEGRATION_PATTERNS,
  ENFORCEMENT_ROADMAP,
  type ExclusionEntry,
  type IgnoredComponent,
  type IntegrationPattern,
} from "../governance"
import { escapeCsvField } from "./csv"

/**
 * Regulatory pack export options.
 */
export interface RegulatoryPackExportOptions {
  /** Include full component metadata */
  includeMetadata?: boolean
  /** Version string for the export */
  version?: string
  /** Drift entries to include in drift report */
  driftEntries?: DriftEntry[]
  /** Generation timestamp (default: current time) */
  generatedAt?: Date
}

/**
 * Manifest file structure for regulatory pack.
 */
export interface RegulatoryPackManifest {
  exportVersion: string
  generatedAt: string
  generatedBy: string
  componentCount: number
  criticalCount: number
  files: string[]
}

/**
 * Regulatory pack structure (JSON format, for backwards compatibility).
 */
export interface RegulatoryPack {
  exportedAt: string
  version: string
  summary: {
    totalComponents: number
    criticalPathCount: number
    componentsByType: Record<string, number>
    componentsByCriticality: Record<string, number>
  }
  criticalPaths: Array<{
    pathId: string
    name: string
    reason: string
    sloTarget?: string
    components: string[]
  }>
  components: Array<{
    componentId: string
    type: ComponentType
    name: string
    status: string
    criticality: ComponentCriticality
    owner: string | null
    docsRef: string | null
    codeRef: string | null
    criticalPaths?: string[]
  }>
}

/**
 * Governance configuration export structure.
 */
export interface GovernanceConfig {
  libExclusions: ExclusionEntry[]
  workerServiceExclusions: ExclusionEntry[]
  ignoredComponents: IgnoredComponent[]
  allowedOwners: readonly string[]
  integrationPatterns: IntegrationPattern[]
  enforcementRoadmap: typeof ENFORCEMENT_ROADMAP
}

/**
 * Count components by type.
 */
function countByType(components: SystemComponent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of components) {
    counts[c.type] = (counts[c.type] ?? 0) + 1
  }
  return counts
}

/**
 * Count components by criticality.
 */
function countByCriticality(components: SystemComponent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of components) {
    counts[c.criticality] = (counts[c.criticality] ?? 0) + 1
  }
  return counts
}

/**
 * Generate the manifest.json content.
 */
function generateManifest(
  components: SystemComponent[],
  files: string[],
  generatedAt: Date,
  version: string
): RegulatoryPackManifest {
  const criticalCount = components.filter((c) => c.criticality === "CRITICAL").length

  return {
    exportVersion: version,
    generatedAt: generatedAt.toISOString(),
    generatedBy: "system-registry-export",
    componentCount: components.length,
    criticalCount,
    files,
  }
}

/**
 * Generate the ownership-matrix.csv content.
 *
 * Columns: component_id,type,name,owner,criticality,codeRef,docsRef
 */
function generateOwnershipMatrix(components: SystemComponent[]): string {
  const headers = ["component_id", "type", "name", "owner", "criticality", "codeRef", "docsRef"]
  const delimiter = ","

  const headerRow = headers.join(delimiter)

  const dataRows = components.map((c) => {
    const fields = [
      c.componentId,
      c.type,
      c.name,
      c.owner ?? "",
      c.criticality,
      c.codeRef ?? "",
      c.docsRef ?? "",
    ]
    return fields.map((field) => escapeCsvField(field, delimiter)).join(delimiter)
  })

  return [headerRow, ...dataRows].join("\n")
}

/**
 * Generate the critical-paths.json content.
 */
function generateCriticalPathsJson(
  criticalPaths: CriticalPath[],
  components: SystemComponent[]
): string {
  // Create a map for quick component lookup
  const componentMap = new Map(components.map((c) => [c.componentId, c]))

  const enrichedPaths = criticalPaths.map((path) => ({
    pathId: path.pathId,
    name: path.name,
    reason: path.reason,
    sloTarget: path.sloTarget,
    components: path.components.map((compId) => {
      const comp = componentMap.get(compId)
      return {
        componentId: compId,
        name: comp?.name ?? "Unknown",
        type: comp?.type ?? "Unknown",
        owner: comp?.owner ?? null,
        criticality: comp?.criticality ?? "Unknown",
      }
    }),
  }))

  return JSON.stringify(enrichedPaths, null, 2)
}

/**
 * Generate the drift-report.md content.
 */
function generateDriftReport(driftEntries: DriftEntry[], generatedAt: Date): string {
  const lines: string[] = []

  lines.push("# Drift Report")
  lines.push("")
  lines.push(`> Generated: ${generatedAt.toISOString()}`)
  lines.push("")

  if (driftEntries.length === 0) {
    lines.push("No drift entries detected.")
    lines.push("")
    return lines.join("\n")
  }

  // Group by drift type
  const byType = new Map<string, DriftEntry[]>()
  for (const entry of driftEntries) {
    const existing = byType.get(entry.driftType) ?? []
    existing.push(entry)
    byType.set(entry.driftType, existing)
  }

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push("| Drift Type | Count |")
  lines.push("|------------|-------|")
  for (const [type, entries] of Array.from(byType.entries())) {
    lines.push(`| ${type} | ${entries.length} |`)
  }
  lines.push("")

  // Detail sections
  for (const [type, entries] of Array.from(byType.entries())) {
    lines.push(`## ${type}`)
    lines.push("")
    lines.push("| Component ID | Type | Risk | Reason |")
    lines.push("|--------------|------|------|--------|")
    for (const entry of entries) {
      const reason = entry.reason ?? entry.gaps?.join(", ") ?? "-"
      lines.push(`| ${entry.componentId} | ${entry.type} | ${entry.risk} | ${reason} |`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Generate the governance-config.json content.
 */
function generateGovernanceConfig(): string {
  const config: GovernanceConfig = {
    libExclusions: [...LIB_EXCLUSIONS],
    workerServiceExclusions: [...WORKER_SERVICE_EXCLUSIONS],
    ignoredComponents: [...IGNORED_COMPONENTS],
    allowedOwners: ALLOWED_OWNERS,
    integrationPatterns: [...INTEGRATION_PATTERNS],
    enforcementRoadmap: ENFORCEMENT_ROADMAP,
  }

  return JSON.stringify(config, null, 2)
}

/**
 * Generate component detail JSON for a single component.
 */
function generateComponentDetail(component: SystemComponent): string {
  return JSON.stringify(component, null, 2)
}

/**
 * Get the folder name for the export based on date.
 */
function getExportFolderName(generatedAt: Date): string {
  const yyyy = generatedAt.getFullYear()
  const mm = String(generatedAt.getMonth() + 1).padStart(2, "0")
  const dd = String(generatedAt.getDate()).padStart(2, "0")
  return `regulatory-export-${yyyy}-${mm}-${dd}`
}

/**
 * Export to regulatory pack ZIP format.
 *
 * Creates a ZIP archive with the structure:
 * regulatory-export-YYYY-MM-DD/
 * ├── manifest.json
 * ├── ownership-matrix.csv
 * ├── critical-paths.json
 * ├── drift-report.md
 * ├── governance-config.json
 * └── component-details/
 *     ├── lib-auth.json
 *     └── ...
 *
 * @param components - Components to export
 * @param criticalPaths - Critical paths to include
 * @param options - Export options
 * @returns Promise<Buffer> - ZIP file as buffer
 */
export async function exportRegulatoryPackZip(
  components: SystemComponent[],
  criticalPaths: CriticalPath[],
  options: RegulatoryPackExportOptions = {}
): Promise<Buffer> {
  const version = options.version ?? "1.0.0"
  const generatedAt = options.generatedAt ?? new Date()
  const driftEntries = options.driftEntries ?? []

  const folderName = getExportFolderName(generatedAt)

  // Build file list
  const files = [
    "manifest.json",
    "ownership-matrix.csv",
    "critical-paths.json",
    "drift-report.md",
    "governance-config.json",
    ...components.map((c) => `component-details/${c.componentId}.json`),
  ]

  // Generate file contents
  const manifest = generateManifest(components, files, generatedAt, version)
  const ownershipMatrix = generateOwnershipMatrix(components)
  const criticalPathsJson = generateCriticalPathsJson(criticalPaths, components)
  const driftReport = generateDriftReport(driftEntries, generatedAt)
  const governanceConfig = generateGovernanceConfig()

  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    })

    const chunks: Buffer[] = []

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on("end", () => {
      resolve(Buffer.concat(chunks))
    })

    archive.on("error", (err: Error) => {
      reject(err)
    })

    // Add files to archive
    archive.append(JSON.stringify(manifest, null, 2), {
      name: `${folderName}/manifest.json`,
    })

    archive.append(ownershipMatrix, {
      name: `${folderName}/ownership-matrix.csv`,
    })

    archive.append(criticalPathsJson, {
      name: `${folderName}/critical-paths.json`,
    })

    archive.append(driftReport, {
      name: `${folderName}/drift-report.md`,
    })

    archive.append(governanceConfig, {
      name: `${folderName}/governance-config.json`,
    })

    // Add component details
    for (const component of components) {
      archive.append(generateComponentDetail(component), {
        name: `${folderName}/component-details/${component.componentId}.json`,
      })
    }

    // Finalize the archive
    archive.finalize()
  })
}

/**
 * Export to regulatory pack format (JSON string).
 * This is the legacy format for backwards compatibility.
 *
 * @param components - Components to export
 * @param criticalPaths - Critical paths to include
 * @param options - Export options
 * @returns JSON string
 */
export function exportRegulatoryPack(
  components: SystemComponent[],
  criticalPaths: CriticalPath[],
  options: RegulatoryPackExportOptions = {}
): string {
  const pack: RegulatoryPack = {
    exportedAt: new Date().toISOString(),
    version: options.version ?? "1.0",
    summary: {
      totalComponents: components.length,
      criticalPathCount: criticalPaths.length,
      componentsByType: countByType(components),
      componentsByCriticality: countByCriticality(components),
    },
    criticalPaths: criticalPaths.map((p) => ({
      pathId: p.pathId,
      name: p.name,
      reason: p.reason,
      sloTarget: p.sloTarget,
      components: p.components,
    })),
    components: options.includeMetadata
      ? (components as RegulatoryPack["components"])
      : components.map((c) => ({
          componentId: c.componentId,
          type: c.type,
          name: c.name,
          status: c.status,
          criticality: c.criticality,
          owner: c.owner,
          docsRef: c.docsRef,
          codeRef: c.codeRef,
          criticalPaths: c.criticalPaths,
        })),
  }

  return JSON.stringify(pack, null, 2)
}

/**
 * Stream version of ZIP export for large datasets.
 *
 * @param components - Components to export
 * @param criticalPaths - Critical paths to include
 * @param options - Export options
 * @returns Readable stream of ZIP data
 */
export function exportRegulatoryPackZipStream(
  components: SystemComponent[],
  criticalPaths: CriticalPath[],
  options: RegulatoryPackExportOptions = {}
): Readable {
  const version = options.version ?? "1.0.0"
  const generatedAt = options.generatedAt ?? new Date()
  const driftEntries = options.driftEntries ?? []

  const folderName = getExportFolderName(generatedAt)

  // Build file list
  const files = [
    "manifest.json",
    "ownership-matrix.csv",
    "critical-paths.json",
    "drift-report.md",
    "governance-config.json",
    ...components.map((c) => `component-details/${c.componentId}.json`),
  ]

  // Generate file contents
  const manifest = generateManifest(components, files, generatedAt, version)
  const ownershipMatrix = generateOwnershipMatrix(components)
  const criticalPathsJson = generateCriticalPathsJson(criticalPaths, components)
  const driftReport = generateDriftReport(driftEntries, generatedAt)
  const governanceConfig = generateGovernanceConfig()

  // Create ZIP archive
  const archive = archiver("zip", {
    zlib: { level: 9 },
  })

  // Add files to archive
  archive.append(JSON.stringify(manifest, null, 2), {
    name: `${folderName}/manifest.json`,
  })

  archive.append(ownershipMatrix, {
    name: `${folderName}/ownership-matrix.csv`,
  })

  archive.append(criticalPathsJson, {
    name: `${folderName}/critical-paths.json`,
  })

  archive.append(driftReport, {
    name: `${folderName}/drift-report.md`,
  })

  archive.append(governanceConfig, {
    name: `${folderName}/governance-config.json`,
  })

  // Add component details
  for (const component of components) {
    archive.append(generateComponentDetail(component), {
      name: `${folderName}/component-details/${component.componentId}.json`,
    })
  }

  // Finalize the archive (async, but stream is returned immediately)
  archive.finalize()

  return archive as unknown as Readable
}
