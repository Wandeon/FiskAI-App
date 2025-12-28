/**
 * Drift History Exporter
 *
 * Exports and parses drift tracking history in JSONL format.
 * Each line in the history file represents a single drift event.
 *
 * JSONL format is used for:
 * - Easy appending without reading entire file
 * - Line-by-line streaming for large histories
 * - Simple parsing and querying
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { mkdirSync } from "fs"
import type { ComponentCriticality, DriftEntry } from "../schema"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Severity alias for drift history entries.
 * Maps to ComponentCriticality for consistency.
 */
export type Severity = ComponentCriticality

/**
 * A single drift entry in history.
 * This is the schema for each line in the JSONL file.
 */
export interface DriftHistoryEntry {
  /** ISO 8601 timestamp when this drift was captured */
  timestamp: string
  /** Unique identifier for the CI/capture run */
  runId: string
  /** Component that has drift */
  component: string
  /** Type of drift issue detected */
  issue:
    | "observed_not_declared"
    | "declared_not_observed"
    | "metadata_gap"
    | "coderef_invalid"
    | "owner_missing"
    | "docs_missing"
    | "governance_violation"
    | "unknown_integration"
  /** Severity level of the issue */
  severity: Severity
  /** Whether this issue has been resolved */
  resolved: boolean
  /** How the issue was resolved (if resolved) */
  resolution?: string
  /** PR number that resolved this (if applicable) */
  prNumber?: number
}

/**
 * Drift history export options.
 */
export interface DriftHistoryExportOptions {
  /** Only include entries since this date */
  since?: Date
  /** Only include entries until this date */
  until?: Date
  /** Filter by component ID pattern */
  componentPattern?: string
  /** Filter by severity levels */
  severities?: Severity[]
  /** Only include unresolved entries */
  unresolvedOnly?: boolean
  /** Maximum number of entries to return */
  limit?: number
}

/**
 * Drift history summary statistics.
 */
export interface DriftHistorySummary {
  totalEntries: number
  unresolvedCount: number
  resolvedCount: number
  bySeverity: Record<Severity, number>
  byIssue: Record<string, number>
  oldestEntry: string | null
  newestEntry: string | null
}

/**
 * Full drift history export structure.
 */
export interface DriftHistoryExport {
  exportedAt: string
  version: string
  historyFile: string
  summary: DriftHistorySummary
  entries: DriftHistoryEntry[]
}

// =============================================================================
// DEFAULT HISTORY FILE PATH
// =============================================================================

/**
 * Default path to the drift history JSONL file.
 */
export const DEFAULT_HISTORY_FILE = "docs/system-registry/drift-history.jsonl"

// =============================================================================
// JSONL PARSING
// =============================================================================

/**
 * Parse a single JSONL line into a DriftHistoryEntry.
 * Returns null if the line is empty or invalid.
 */
export function parseDriftHistoryLine(line: string): DriftHistoryEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }

  try {
    const entry = JSON.parse(trimmed) as DriftHistoryEntry

    // Validate required fields
    if (!entry.timestamp || !entry.runId || !entry.component || !entry.issue || !entry.severity) {
      return null
    }

    // Ensure resolved has a boolean value
    entry.resolved = entry.resolved === true

    return entry
  } catch {
    return null
  }
}

/**
 * Read and parse all entries from a drift history JSONL file.
 */
export function readDriftHistory(
  historyFile: string = DEFAULT_HISTORY_FILE,
  projectRoot: string = process.cwd()
): DriftHistoryEntry[] {
  const fullPath = join(projectRoot, historyFile)

  if (!existsSync(fullPath)) {
    return []
  }

  const content = readFileSync(fullPath, "utf-8")
  const lines = content.split("\n")
  const entries: DriftHistoryEntry[] = []

  for (const line of lines) {
    const entry = parseDriftHistoryLine(line)
    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}

/**
 * Filter drift history entries based on options.
 */
export function filterDriftHistory(
  entries: DriftHistoryEntry[],
  options: DriftHistoryExportOptions = {}
): DriftHistoryEntry[] {
  let filtered = [...entries]

  // Filter by date range
  if (options.since) {
    const sinceTime = options.since.getTime()
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= sinceTime)
  }
  if (options.until) {
    const untilTime = options.until.getTime()
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= untilTime)
  }

  // Filter by component pattern
  if (options.componentPattern) {
    const pattern = new RegExp(options.componentPattern, "i")
    filtered = filtered.filter((e) => pattern.test(e.component))
  }

  // Filter by severities
  if (options.severities && options.severities.length > 0) {
    filtered = filtered.filter((e) => options.severities!.includes(e.severity))
  }

  // Filter by resolution status
  if (options.unresolvedOnly) {
    filtered = filtered.filter((e) => !e.resolved)
  }

  // Apply limit
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(-options.limit)
  }

  return filtered
}

/**
 * Calculate summary statistics from drift history entries.
 */
export function calculateDriftHistorySummary(entries: DriftHistoryEntry[]): DriftHistorySummary {
  const bySeverity: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  }
  const byIssue: Record<string, number> = {}

  let unresolvedCount = 0
  let resolvedCount = 0
  let oldestTimestamp: string | null = null
  let newestTimestamp: string | null = null

  for (const entry of entries) {
    // Count by severity
    bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1

    // Count by issue type
    byIssue[entry.issue] = (byIssue[entry.issue] || 0) + 1

    // Count resolved vs unresolved
    if (entry.resolved) {
      resolvedCount++
    } else {
      unresolvedCount++
    }

    // Track date range
    if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp
    }
    if (!newestTimestamp || entry.timestamp > newestTimestamp) {
      newestTimestamp = entry.timestamp
    }
  }

  return {
    totalEntries: entries.length,
    unresolvedCount,
    resolvedCount,
    bySeverity,
    byIssue,
    oldestEntry: oldestTimestamp,
    newestEntry: newestTimestamp,
  }
}

// =============================================================================
// JSONL WRITING
// =============================================================================

/**
 * Format a DriftHistoryEntry as a JSONL line.
 */
export function formatDriftHistoryLine(entry: DriftHistoryEntry): string {
  // Create a clean object with only the fields we want
  const output: DriftHistoryEntry = {
    timestamp: entry.timestamp,
    runId: entry.runId,
    component: entry.component,
    issue: entry.issue,
    severity: entry.severity,
    resolved: entry.resolved,
  }

  // Add optional fields only if present
  if (entry.resolution) {
    output.resolution = entry.resolution
  }
  if (entry.prNumber !== undefined) {
    output.prNumber = entry.prNumber
  }

  return JSON.stringify(output)
}

/**
 * Append a drift history entry to the JSONL file.
 */
export function appendDriftHistoryEntry(
  entry: DriftHistoryEntry,
  historyFile: string = DEFAULT_HISTORY_FILE,
  projectRoot: string = process.cwd()
): void {
  const fullPath = join(projectRoot, historyFile)

  // Ensure directory exists
  const dir = dirname(fullPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const line = formatDriftHistoryLine(entry) + "\n"
  appendFileSync(fullPath, line, "utf-8")
}

/**
 * Append multiple drift history entries to the JSONL file.
 */
export function appendDriftHistoryEntries(
  entries: DriftHistoryEntry[],
  historyFile: string = DEFAULT_HISTORY_FILE,
  projectRoot: string = process.cwd()
): void {
  const fullPath = join(projectRoot, historyFile)

  // Ensure directory exists
  const dir = dirname(fullPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const lines = entries.map((e) => formatDriftHistoryLine(e)).join("\n") + "\n"
  appendFileSync(fullPath, lines, "utf-8")
}

/**
 * Write a complete drift history file (overwrites existing).
 */
export function writeDriftHistory(
  entries: DriftHistoryEntry[],
  historyFile: string = DEFAULT_HISTORY_FILE,
  projectRoot: string = process.cwd()
): void {
  const fullPath = join(projectRoot, historyFile)

  // Ensure directory exists
  const dir = dirname(fullPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const lines = entries.map((e) => formatDriftHistoryLine(e)).join("\n")
  writeFileSync(fullPath, lines + (entries.length > 0 ? "\n" : ""), "utf-8")
}

// =============================================================================
// DRIFT CAPTURE HELPERS
// =============================================================================

/**
 * Map a DriftEntry issue type to a DriftHistoryEntry issue type.
 */
function mapDriftTypeToIssue(
  driftType: DriftEntry["driftType"],
  gaps?: DriftEntry["gaps"]
): DriftHistoryEntry["issue"] {
  switch (driftType) {
    case "OBSERVED_NOT_DECLARED":
      return "observed_not_declared"
    case "DECLARED_NOT_OBSERVED":
      return "declared_not_observed"
    case "CODEREF_INVALID":
      return "coderef_invalid"
    case "METADATA_GAP":
      // Determine specific gap type
      if (gaps?.includes("NO_OWNER")) {
        return "owner_missing"
      }
      if (gaps?.includes("NO_DOCS")) {
        return "docs_missing"
      }
      return "metadata_gap"
    default:
      return "metadata_gap"
  }
}

/**
 * Convert a DriftEntry from compute-drift to a DriftHistoryEntry.
 */
export function driftEntryToHistoryEntry(
  drift: DriftEntry,
  runId: string,
  timestamp: string = new Date().toISOString()
): DriftHistoryEntry {
  return {
    timestamp,
    runId,
    component: drift.componentId,
    issue: mapDriftTypeToIssue(drift.driftType, drift.gaps),
    severity: drift.risk,
    resolved: false,
  }
}

/**
 * Capture drift entries from a drift result and append to history.
 */
export function captureDriftToHistory(
  driftEntries: DriftEntry[],
  runId: string,
  historyFile: string = DEFAULT_HISTORY_FILE,
  projectRoot: string = process.cwd()
): DriftHistoryEntry[] {
  const timestamp = new Date().toISOString()
  const historyEntries = driftEntries.map((d) =>
    driftEntryToHistoryEntry(d, runId, timestamp)
  )

  if (historyEntries.length > 0) {
    appendDriftHistoryEntries(historyEntries, historyFile, projectRoot)
  }

  return historyEntries
}

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

/**
 * Export drift history.
 *
 * Reads from the JSONL history file, filters based on options,
 * and returns a structured JSON export.
 *
 * @param historyFile - Path to drift history JSONL file
 * @param options - Export options for filtering
 * @param projectRoot - Project root directory
 * @returns JSON string of drift history export
 */
export function exportDriftHistory(
  historyFile: string = DEFAULT_HISTORY_FILE,
  options: DriftHistoryExportOptions = {},
  projectRoot: string = process.cwd()
): string {
  // Read all entries
  const allEntries = readDriftHistory(historyFile, projectRoot)

  // Apply filters
  const filteredEntries = filterDriftHistory(allEntries, options)

  // Calculate summary
  const summary = calculateDriftHistorySummary(filteredEntries)

  // Build export structure
  const exportData: DriftHistoryExport = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    historyFile,
    summary,
    entries: filteredEntries,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Export drift history as JSONL (raw format).
 *
 * Returns the filtered entries in JSONL format for streaming/piping.
 */
export function exportDriftHistoryJsonl(
  historyFile: string = DEFAULT_HISTORY_FILE,
  options: DriftHistoryExportOptions = {},
  projectRoot: string = process.cwd()
): string {
  // Read all entries
  const allEntries = readDriftHistory(historyFile, projectRoot)

  // Apply filters
  const filteredEntries = filterDriftHistory(allEntries, options)

  // Format as JSONL
  return filteredEntries.map((e) => formatDriftHistoryLine(e)).join("\n")
}
