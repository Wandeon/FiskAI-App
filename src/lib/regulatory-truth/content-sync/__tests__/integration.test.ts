// src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts
/**
 * Integration tests for the RTL -> Content Sync pipeline.
 *
 * These tests verify end-to-end flows:
 * 1. Event emission with correct ID generation and database storage
 * 2. Concept registry mapping to valid MDX files
 * 3. Frontmatter patching with changelog entries
 *
 * NOTE: Database tests require a running database connection.
 * They are skipped in CI if DATABASE_URL is not set.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { describe, it, expect, afterEach, beforeAll } from "vitest"

import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import { eq } from "drizzle-orm"

import { emitContentSyncEvent, type EmitEventParams } from "../emit-event"
import { getConceptMapping, resolveContentPaths } from "../concept-registry"
import { patchFrontmatter } from "../patcher"
import type { ContentSyncEventV1 } from "../types"

// =============================================================================
// Test Constants
// =============================================================================

// Check if database is available
const hasDatabase = !!process.env.DATABASE_URL

// Content directory path (relative to project root)
const CONTENT_DIR = path.resolve(process.cwd(), "content")

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEventParams(overrides: Partial<EmitEventParams> = {}): EmitEventParams {
  return {
    type: "RULE_RELEASED",
    ruleId: `test-rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conceptId: "pdv-threshold",
    domain: "tax",
    effectiveFrom: new Date("2025-01-01"),
    changeType: "update",
    ruleTier: "T1",
    sourcePointerIds: ["ptr-test-1", "ptr-test-2"],
    confidenceLevel: 95,
    previousValue: "300000.00 HRK",
    newValue: "39816.84 EUR",
    valueType: "threshold",
    ...overrides,
  }
}

function createMockEventV1(overrides: Partial<ContentSyncEventV1> = {}): ContentSyncEventV1 {
  return {
    version: 1,
    id: `evt_integration_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type: "RULE_RELEASED",
    ruleId: `rule_integration_${Date.now()}`,
    conceptId: "pdv-threshold",
    domain: "tax",
    changeType: "update",
    effectiveFrom: "2025-01-01",
    previousValue: "300000.00 HRK",
    newValue: "39816.84 EUR",
    valueType: "threshold",
    sourcePointerIds: ["ptr_integration_1", "ptr_integration_2"],
    primarySourceUrl: "https://narodne-novine.nn.hr/test",
    confidenceLevel: 95,
    severity: "major",
    signature: {
      ruleId: `rule_integration_${Date.now()}`,
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2025-01-01",
      newValue: "39816.84 EUR",
      sourcePointerIdsHash: "test-hash-integration",
    },
    ...overrides,
  }
}

const SAMPLE_MDX_CONTENT = `---
title: Test Guide
description: A test guide for integration testing
lastUpdated: "2024-01-01"
---

# Test Guide

This is test content that should be preserved after patching.

## Section 1

Some more content here.
`

// =============================================================================
// Integration Tests
// =============================================================================

describe("Content Sync Integration", () => {
  // Track created event IDs for cleanup
  const createdEventIds: string[] = []
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "content-sync-integration-"))
  })

  afterEach(async () => {
    // Cleanup: delete test events from database
    for (const eventId of createdEventIds) {
      try {
        await drizzleDb.delete(contentSyncEvents).where(eq(contentSyncEvents.eventId, eventId))
      } catch {
        // Ignore cleanup errors
      }
    }
    createdEventIds.length = 0

    // Cleanup temp directory contents
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file))
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  // ===========================================================================
  // Test 1: Event Emission with Correct ID Generation
  // ===========================================================================

  describe.skipIf(!hasDatabase)("emits event with correct ID generation", () => {
    it("generates a 64-character sha256 eventId", async () => {
      const params = createTestEventParams()
      const result = await emitContentSyncEvent(params)

      // Track for cleanup
      createdEventIds.push(result.eventId)

      // Verify eventId is 64 characters (sha256 hex digest)
      expect(result.eventId).toHaveLength(64)
      expect(result.eventId).toMatch(/^[a-f0-9]{64}$/)
    })

    it("creates event in database with PENDING status", async () => {
      const params = createTestEventParams()
      const result = await emitContentSyncEvent(params)

      // Track for cleanup
      createdEventIds.push(result.eventId)

      // Verify event exists in database
      const events = await drizzleDb
        .select()
        .from(contentSyncEvents)
        .where(eq(contentSyncEvents.eventId, result.eventId))

      expect(events).toHaveLength(1)
      expect(events[0].status).toBe("PENDING")
      expect(events[0].ruleId).toBe(params.ruleId)
      expect(events[0].conceptId).toBe(params.conceptId)
    })

    it("stores payload with correct severity (T1 = major)", async () => {
      const params = createTestEventParams({ ruleTier: "T1", changeType: "update" })
      const result = await emitContentSyncEvent(params)

      // Track for cleanup
      createdEventIds.push(result.eventId)

      // Verify payload contains correct severity
      const events = await drizzleDb
        .select()
        .from(contentSyncEvents)
        .where(eq(contentSyncEvents.eventId, result.eventId))

      expect(events).toHaveLength(1)
      const payload = events[0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("major")
      expect(payload.version).toBe(1)
      expect(payload.sourcePointerIds).toEqual(params.sourcePointerIds)
    })

    it("stores payload with breaking severity for T0 tier", async () => {
      const params = createTestEventParams({ ruleTier: "T0" })
      const result = await emitContentSyncEvent(params)

      // Track for cleanup
      createdEventIds.push(result.eventId)

      const events = await drizzleDb
        .select()
        .from(contentSyncEvents)
        .where(eq(contentSyncEvents.eventId, result.eventId))

      const payload = events[0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("breaking")
    })

    it("stores payload with breaking severity for repeal changes", async () => {
      const params = createTestEventParams({ ruleTier: "T3", changeType: "repeal" })
      const result = await emitContentSyncEvent(params)

      // Track for cleanup
      createdEventIds.push(result.eventId)

      const events = await drizzleDb
        .select()
        .from(contentSyncEvents)
        .where(eq(contentSyncEvents.eventId, result.eventId))

      const payload = events[0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("breaking")
    })
  })

  // ===========================================================================
  // Test 2: Concept Registry Maps to Valid MDX Files
  // ===========================================================================

  describe("concept registry maps to valid MDX files", () => {
    it("returns mapping for pdv-threshold concept", () => {
      const mapping = getConceptMapping("pdv-threshold")

      expect(mapping).toBeDefined()
      expect(mapping!.conceptId).toBe("pdv-threshold")
      expect(mapping!.mdxPaths.length).toBeGreaterThan(0)
    })

    it("resolves at least one MDX path that exists on disk", async () => {
      const mapping = getConceptMapping("pdv-threshold")
      expect(mapping).toBeDefined()

      const absolutePaths = resolveContentPaths(mapping!, CONTENT_DIR)
      expect(absolutePaths.length).toBeGreaterThan(0)

      // Check that at least one file exists
      let foundExistingFile = false
      for (const filePath of absolutePaths) {
        try {
          await fs.access(filePath)
          foundExistingFile = true
          break
        } catch {
          // File doesn't exist, try next
        }
      }

      expect(foundExistingFile).toBe(true)
    })

    it("returns undefined for unknown concept", () => {
      const mapping = getConceptMapping("unknown-concept-xyz")
      expect(mapping).toBeUndefined()
    })

    it("maps pausalni-revenue-limit to valid files", async () => {
      const mapping = getConceptMapping("pausalni-revenue-limit")
      expect(mapping).toBeDefined()
      expect(mapping!.mdxPaths).toContain("vodici/pausalni-obrt.mdx")

      // Verify the file exists
      const absolutePath = path.join(CONTENT_DIR, "vodici/pausalni-obrt.mdx")
      await expect(fs.access(absolutePath)).resolves.toBeUndefined()
    })
  })

  // ===========================================================================
  // Test 3: Patcher Creates Valid Frontmatter with Changelog
  // ===========================================================================

  describe("patcher creates valid frontmatter with changelog", () => {
    it("patches temp MDX file with rtl section and changelog", async () => {
      // Create temp MDX file
      const tempFilePath = path.join(tempDir, "test-guide.mdx")
      await fs.writeFile(tempFilePath, SAMPLE_MDX_CONTENT)

      // Create test event
      const event = createMockEventV1()

      // Patch the frontmatter
      const patchedContent = await patchFrontmatter(tempFilePath, event)

      // Verify output contains rtl.conceptId
      expect(patchedContent).toContain("rtl:")
      expect(patchedContent).toContain("conceptId: pdv-threshold")

      // Verify output contains changelog with eventId
      expect(patchedContent).toContain("changelog:")
      expect(patchedContent).toContain(`eventId: ${event.id}`)

      // Verify original content is preserved
      expect(patchedContent).toContain("# Test Guide")
      expect(patchedContent).toContain(
        "This is test content that should be preserved after patching."
      )
      expect(patchedContent).toContain("## Section 1")
    })

    it("includes all required changelog fields", async () => {
      const tempFilePath = path.join(tempDir, "changelog-test.mdx")
      await fs.writeFile(tempFilePath, SAMPLE_MDX_CONTENT)

      const event = createMockEventV1()
      const patchedContent = await patchFrontmatter(tempFilePath, event)

      // Verify changelog entry contains required fields
      expect(patchedContent).toContain(`eventId: ${event.id}`)
      expect(patchedContent).toContain("severity: major")
      expect(patchedContent).toContain("changeType: update")
      expect(patchedContent).toContain("effectiveFrom:")
      expect(patchedContent).toContain("sourcePointerIds:")
      expect(patchedContent).toContain("confidenceLevel: 95")
    })

    it("includes ruleId in rtl section", async () => {
      const tempFilePath = path.join(tempDir, "ruleid-test.mdx")
      await fs.writeFile(tempFilePath, SAMPLE_MDX_CONTENT)

      const event = createMockEventV1()
      const patchedContent = await patchFrontmatter(tempFilePath, event)

      expect(patchedContent).toContain(`ruleId: ${event.ruleId}`)
    })

    it("updates lastUpdated date", async () => {
      const tempFilePath = path.join(tempDir, "lastUpdated-test.mdx")
      await fs.writeFile(tempFilePath, SAMPLE_MDX_CONTENT)

      const event = createMockEventV1()
      const patchedContent = await patchFrontmatter(tempFilePath, event)

      // Should have today's date format YYYY-MM-DD
      const today = new Date().toISOString().split("T")[0]
      expect(patchedContent).toContain(`lastUpdated: '${today}'`)
    })

    it("preserves existing frontmatter fields", async () => {
      const mdxWithExtraFields = `---
title: My Custom Guide
description: Custom description
author: Test Author
category: fiscal
customField: custom value
lastUpdated: "2024-01-01"
---

# Content here
`
      const tempFilePath = path.join(tempDir, "preserve-fields-test.mdx")
      await fs.writeFile(tempFilePath, mdxWithExtraFields)

      const event = createMockEventV1()
      const patchedContent = await patchFrontmatter(tempFilePath, event)

      expect(patchedContent).toContain("title: My Custom Guide")
      expect(patchedContent).toContain("description: Custom description")
      expect(patchedContent).toContain("author: Test Author")
      expect(patchedContent).toContain("category: fiscal")
      expect(patchedContent).toContain("customField: custom value")
    })
  })
})
