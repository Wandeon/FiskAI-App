import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  parseDriftHistoryLine,
  formatDriftHistoryLine,
  readDriftHistory,
  writeDriftHistory,
  appendDriftHistoryEntry,
  appendDriftHistoryEntries,
  filterDriftHistory,
  calculateDriftHistorySummary,
  exportDriftHistory,
  exportDriftHistoryJsonl,
  driftEntryToHistoryEntry,
  captureDriftToHistory,
  type DriftHistoryEntry,
} from "../exporters/drift-history"
import type { DriftEntry } from "../schema"

describe("Drift History Exporter", () => {
  let testDir: string
  let historyFile: string

  beforeEach(() => {
    testDir = join(tmpdir(), `drift-history-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    historyFile = "test-history.jsonl"
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe("parseDriftHistoryLine", () => {
    it("parses valid JSONL line", () => {
      const line = '{"timestamp":"2025-01-15T10:00:00Z","runId":"abc123","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":false}'
      const entry = parseDriftHistoryLine(line)

      assert.ok(entry)
      assert.equal(entry.timestamp, "2025-01-15T10:00:00Z")
      assert.equal(entry.runId, "abc123")
      assert.equal(entry.component, "lib-auth")
      assert.equal(entry.issue, "owner_missing")
      assert.equal(entry.severity, "CRITICAL")
      assert.equal(entry.resolved, false)
    })

    it("parses entry with optional fields", () => {
      const line = '{"timestamp":"2025-01-15T10:00:00Z","runId":"abc123","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":true,"resolution":"Added owner","prNumber":42}'
      const entry = parseDriftHistoryLine(line)

      assert.ok(entry)
      assert.equal(entry.resolved, true)
      assert.equal(entry.resolution, "Added owner")
      assert.equal(entry.prNumber, 42)
    })

    it("returns null for empty line", () => {
      assert.equal(parseDriftHistoryLine(""), null)
      assert.equal(parseDriftHistoryLine("  "), null)
    })

    it("returns null for comment line", () => {
      assert.equal(parseDriftHistoryLine("# This is a comment"), null)
    })

    it("returns null for invalid JSON", () => {
      assert.equal(parseDriftHistoryLine("not json"), null)
      assert.equal(parseDriftHistoryLine("{invalid}"), null)
    })

    it("returns null for missing required fields", () => {
      assert.equal(parseDriftHistoryLine('{"timestamp":"2025-01-15T10:00:00Z"}'), null)
      assert.equal(parseDriftHistoryLine('{"runId":"abc"}'), null)
    })
  })

  describe("formatDriftHistoryLine", () => {
    it("formats entry as compact JSON", () => {
      const entry: DriftHistoryEntry = {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "abc123",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: false,
      }

      const line = formatDriftHistoryLine(entry)
      const parsed = JSON.parse(line)

      assert.equal(parsed.timestamp, entry.timestamp)
      assert.equal(parsed.runId, entry.runId)
      assert.equal(parsed.component, entry.component)
      assert.equal(parsed.issue, entry.issue)
      assert.equal(parsed.severity, entry.severity)
      assert.equal(parsed.resolved, entry.resolved)
    })

    it("includes optional fields when present", () => {
      const entry: DriftHistoryEntry = {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "abc123",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: true,
        resolution: "Fixed in PR",
        prNumber: 99,
      }

      const line = formatDriftHistoryLine(entry)
      const parsed = JSON.parse(line)

      assert.equal(parsed.resolution, "Fixed in PR")
      assert.equal(parsed.prNumber, 99)
    })

    it("omits optional fields when not present", () => {
      const entry: DriftHistoryEntry = {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "abc123",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: false,
      }

      const line = formatDriftHistoryLine(entry)
      const parsed = JSON.parse(line)

      assert.ok(!("resolution" in parsed))
      assert.ok(!("prNumber" in parsed))
    })
  })

  describe("readDriftHistory", () => {
    it("returns empty array for non-existent file", () => {
      const entries = readDriftHistory("non-existent.jsonl", testDir)
      assert.deepEqual(entries, [])
    })

    it("reads all valid entries from file", () => {
      const content = [
        '{"timestamp":"2025-01-15T10:00:00Z","runId":"run1","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":false}',
        '{"timestamp":"2025-01-15T11:00:00Z","runId":"run2","component":"lib-billing","issue":"docs_missing","severity":"HIGH","resolved":true}',
      ].join("\n")

      writeFileSync(join(testDir, historyFile), content)

      const entries = readDriftHistory(historyFile, testDir)

      assert.equal(entries.length, 2)
      assert.equal(entries[0].component, "lib-auth")
      assert.equal(entries[1].component, "lib-billing")
    })

    it("skips invalid lines", () => {
      const content = [
        '{"timestamp":"2025-01-15T10:00:00Z","runId":"run1","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":false}',
        "invalid line",
        "",
        '{"timestamp":"2025-01-15T11:00:00Z","runId":"run2","component":"lib-billing","issue":"docs_missing","severity":"HIGH","resolved":true}',
      ].join("\n")

      writeFileSync(join(testDir, historyFile), content)

      const entries = readDriftHistory(historyFile, testDir)

      assert.equal(entries.length, 2)
    })
  })

  describe("writeDriftHistory", () => {
    it("writes entries to file", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-15T11:00:00Z",
          runId: "run2",
          component: "lib-billing",
          issue: "docs_missing",
          severity: "HIGH",
          resolved: true,
        },
      ]

      writeDriftHistory(entries, historyFile, testDir)

      const content = readFileSync(join(testDir, historyFile), "utf-8")
      const lines = content.trim().split("\n")

      assert.equal(lines.length, 2)
    })

    it("creates directory if it does not exist", () => {
      const nestedPath = "nested/dir/history.jsonl"
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
      ]

      writeDriftHistory(entries, nestedPath, testDir)

      assert.ok(existsSync(join(testDir, nestedPath)))
    })

    it("handles empty array", () => {
      writeDriftHistory([], historyFile, testDir)

      const content = readFileSync(join(testDir, historyFile), "utf-8")
      assert.equal(content, "")
    })
  })

  describe("appendDriftHistoryEntry", () => {
    it("appends single entry to file", () => {
      const entry: DriftHistoryEntry = {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "run1",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: false,
      }

      appendDriftHistoryEntry(entry, historyFile, testDir)
      appendDriftHistoryEntry(entry, historyFile, testDir)

      const entries = readDriftHistory(historyFile, testDir)
      assert.equal(entries.length, 2)
    })

    it("creates file if it does not exist", () => {
      const entry: DriftHistoryEntry = {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "run1",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: false,
      }

      appendDriftHistoryEntry(entry, historyFile, testDir)

      assert.ok(existsSync(join(testDir, historyFile)))
    })
  })

  describe("appendDriftHistoryEntries", () => {
    it("appends multiple entries", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-15T11:00:00Z",
          runId: "run1",
          component: "lib-billing",
          issue: "docs_missing",
          severity: "HIGH",
          resolved: false,
        },
      ]

      appendDriftHistoryEntries(entries, historyFile, testDir)

      const readEntries = readDriftHistory(historyFile, testDir)
      assert.equal(readEntries.length, 2)
    })
  })

  describe("filterDriftHistory", () => {
    const entries: DriftHistoryEntry[] = [
      {
        timestamp: "2025-01-10T10:00:00Z",
        runId: "run1",
        component: "lib-auth",
        issue: "owner_missing",
        severity: "CRITICAL",
        resolved: false,
      },
      {
        timestamp: "2025-01-15T10:00:00Z",
        runId: "run2",
        component: "lib-billing",
        issue: "docs_missing",
        severity: "HIGH",
        resolved: true,
      },
      {
        timestamp: "2025-01-20T10:00:00Z",
        runId: "run3",
        component: "route-group-auth",
        issue: "observed_not_declared",
        severity: "CRITICAL",
        resolved: false,
      },
    ]

    it("filters by since date", () => {
      const filtered = filterDriftHistory(entries, {
        since: new Date("2025-01-14T00:00:00Z"),
      })

      assert.equal(filtered.length, 2)
      assert.equal(filtered[0].component, "lib-billing")
      assert.equal(filtered[1].component, "route-group-auth")
    })

    it("filters by until date", () => {
      const filtered = filterDriftHistory(entries, {
        until: new Date("2025-01-16T00:00:00Z"),
      })

      assert.equal(filtered.length, 2)
      assert.equal(filtered[0].component, "lib-auth")
      assert.equal(filtered[1].component, "lib-billing")
    })

    it("filters by component pattern", () => {
      const filtered = filterDriftHistory(entries, {
        componentPattern: "lib-",
      })

      assert.equal(filtered.length, 2)
    })

    it("filters by severities", () => {
      const filtered = filterDriftHistory(entries, {
        severities: ["CRITICAL"],
      })

      assert.equal(filtered.length, 2)
    })

    it("filters unresolved only", () => {
      const filtered = filterDriftHistory(entries, {
        unresolvedOnly: true,
      })

      assert.equal(filtered.length, 2)
      assert.ok(filtered.every((e) => !e.resolved))
    })

    it("applies limit", () => {
      const filtered = filterDriftHistory(entries, {
        limit: 2,
      })

      assert.equal(filtered.length, 2)
      // Should take last 2
      assert.equal(filtered[0].component, "lib-billing")
      assert.equal(filtered[1].component, "route-group-auth")
    })

    it("combines multiple filters", () => {
      const filtered = filterDriftHistory(entries, {
        severities: ["CRITICAL"],
        unresolvedOnly: true,
      })

      assert.equal(filtered.length, 2)
    })
  })

  describe("calculateDriftHistorySummary", () => {
    it("calculates correct summary", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-10T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run2",
          component: "lib-billing",
          issue: "owner_missing",
          severity: "HIGH",
          resolved: true,
        },
        {
          timestamp: "2025-01-20T10:00:00Z",
          runId: "run3",
          component: "route-group-auth",
          issue: "observed_not_declared",
          severity: "CRITICAL",
          resolved: false,
        },
      ]

      const summary = calculateDriftHistorySummary(entries)

      assert.equal(summary.totalEntries, 3)
      assert.equal(summary.unresolvedCount, 2)
      assert.equal(summary.resolvedCount, 1)
      assert.equal(summary.bySeverity.CRITICAL, 2)
      assert.equal(summary.bySeverity.HIGH, 1)
      assert.equal(summary.byIssue.owner_missing, 2)
      assert.equal(summary.byIssue.observed_not_declared, 1)
      assert.equal(summary.oldestEntry, "2025-01-10T10:00:00Z")
      assert.equal(summary.newestEntry, "2025-01-20T10:00:00Z")
    })

    it("handles empty entries", () => {
      const summary = calculateDriftHistorySummary([])

      assert.equal(summary.totalEntries, 0)
      assert.equal(summary.unresolvedCount, 0)
      assert.equal(summary.resolvedCount, 0)
      assert.equal(summary.oldestEntry, null)
      assert.equal(summary.newestEntry, null)
    })
  })

  describe("driftEntryToHistoryEntry", () => {
    it("converts OBSERVED_NOT_DECLARED drift entry", () => {
      const driftEntry: DriftEntry = {
        componentId: "route-group-auth",
        type: "ROUTE_GROUP",
        driftType: "OBSERVED_NOT_DECLARED",
        risk: "CRITICAL",
        observedAt: ["src/app/api/auth"],
      }

      const historyEntry = driftEntryToHistoryEntry(driftEntry, "run123", "2025-01-15T10:00:00Z")

      assert.equal(historyEntry.component, "route-group-auth")
      assert.equal(historyEntry.issue, "observed_not_declared")
      assert.equal(historyEntry.severity, "CRITICAL")
      assert.equal(historyEntry.runId, "run123")
      assert.equal(historyEntry.resolved, false)
    })

    it("converts METADATA_GAP with NO_OWNER gap", () => {
      const driftEntry: DriftEntry = {
        componentId: "lib-auth",
        type: "LIB",
        driftType: "METADATA_GAP",
        risk: "CRITICAL",
        gaps: ["NO_OWNER"],
      }

      const historyEntry = driftEntryToHistoryEntry(driftEntry, "run123")

      assert.equal(historyEntry.issue, "owner_missing")
    })

    it("converts METADATA_GAP with NO_DOCS gap", () => {
      const driftEntry: DriftEntry = {
        componentId: "lib-auth",
        type: "LIB",
        driftType: "METADATA_GAP",
        risk: "HIGH",
        gaps: ["NO_DOCS"],
      }

      const historyEntry = driftEntryToHistoryEntry(driftEntry, "run123")

      assert.equal(historyEntry.issue, "docs_missing")
    })

    it("converts CODEREF_INVALID drift entry", () => {
      const driftEntry: DriftEntry = {
        componentId: "lib-missing",
        type: "LIB",
        driftType: "CODEREF_INVALID",
        risk: "HIGH",
        declaredSource: "src/lib/missing",
      }

      const historyEntry = driftEntryToHistoryEntry(driftEntry, "run123")

      assert.equal(historyEntry.issue, "coderef_invalid")
    })
  })

  describe("captureDriftToHistory", () => {
    it("captures drift entries to history file", () => {
      const driftEntries: DriftEntry[] = [
        {
          componentId: "route-group-auth",
          type: "ROUTE_GROUP",
          driftType: "OBSERVED_NOT_DECLARED",
          risk: "CRITICAL",
        },
        {
          componentId: "lib-billing",
          type: "LIB",
          driftType: "METADATA_GAP",
          risk: "HIGH",
          gaps: ["NO_OWNER"],
        },
      ]

      const captured = captureDriftToHistory(driftEntries, "test-run", historyFile, testDir)

      assert.equal(captured.length, 2)

      const entries = readDriftHistory(historyFile, testDir)
      assert.equal(entries.length, 2)
    })

    it("does not write when no entries", () => {
      const captured = captureDriftToHistory([], "test-run", historyFile, testDir)

      assert.equal(captured.length, 0)
      assert.ok(!existsSync(join(testDir, historyFile)))
    })
  })

  describe("exportDriftHistory", () => {
    it("exports history as structured JSON", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
      ]

      writeDriftHistory(entries, historyFile, testDir)

      const exportJson = exportDriftHistory(historyFile, {}, testDir)
      const parsed = JSON.parse(exportJson)

      assert.ok(parsed.exportedAt)
      assert.equal(parsed.version, "1.0")
      assert.equal(parsed.historyFile, historyFile)
      assert.ok(parsed.summary)
      assert.equal(parsed.summary.totalEntries, 1)
      assert.ok(Array.isArray(parsed.entries))
      assert.equal(parsed.entries.length, 1)
    })

    it("applies filters to export", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-10T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-20T10:00:00Z",
          runId: "run2",
          component: "lib-billing",
          issue: "docs_missing",
          severity: "HIGH",
          resolved: true,
        },
      ]

      writeDriftHistory(entries, historyFile, testDir)

      const exportJson = exportDriftHistory(historyFile, { unresolvedOnly: true }, testDir)
      const parsed = JSON.parse(exportJson)

      assert.equal(parsed.entries.length, 1)
      assert.equal(parsed.entries[0].component, "lib-auth")
    })
  })

  describe("exportDriftHistoryJsonl", () => {
    it("exports history as JSONL", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-16T10:00:00Z",
          runId: "run2",
          component: "lib-billing",
          issue: "docs_missing",
          severity: "HIGH",
          resolved: false,
        },
      ]

      writeDriftHistory(entries, historyFile, testDir)

      const jsonl = exportDriftHistoryJsonl(historyFile, {}, testDir)
      const lines = jsonl.split("\n")

      assert.equal(lines.length, 2)

      // Verify each line is valid JSON
      const parsed1 = JSON.parse(lines[0])
      const parsed2 = JSON.parse(lines[1])

      assert.equal(parsed1.component, "lib-auth")
      assert.equal(parsed2.component, "lib-billing")
    })

    it("applies filters to JSONL export", () => {
      const entries: DriftHistoryEntry[] = [
        {
          timestamp: "2025-01-15T10:00:00Z",
          runId: "run1",
          component: "lib-auth",
          issue: "owner_missing",
          severity: "CRITICAL",
          resolved: false,
        },
        {
          timestamp: "2025-01-16T10:00:00Z",
          runId: "run2",
          component: "lib-billing",
          issue: "docs_missing",
          severity: "HIGH",
          resolved: false,
        },
      ]

      writeDriftHistory(entries, historyFile, testDir)

      const jsonl = exportDriftHistoryJsonl(
        historyFile,
        { severities: ["CRITICAL"] },
        testDir
      )
      const lines = jsonl.split("\n").filter(Boolean)

      assert.equal(lines.length, 1)
      assert.ok(lines[0].includes("lib-auth"))
    })
  })
})
