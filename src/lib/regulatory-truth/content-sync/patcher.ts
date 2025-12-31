// src/lib/regulatory-truth/content-sync/patcher.ts
/**
 * Frontmatter patching utilities for MDX content files.
 *
 * This module handles reading, patching, and writing MDX frontmatter
 * to synchronize regulatory changes from the RTL to content guides.
 */

import * as fs from "fs/promises"

import matter from "gray-matter"

import type { EventSeverity, ChangeType, ContentSyncEventV1 } from "./types"
import {
  ContentNotFoundError,
  FrontmatterParseError,
  InvalidPayloadError,
  PatchConflictError,
} from "./errors"

// =============================================================================
// Types
// =============================================================================

/**
 * Changelog entry stored in MDX frontmatter.
 * Records the history of regulatory changes applied to content.
 */
export interface ChangelogEntry {
  /** Unique event ID for idempotency */
  eventId: string
  /** Date the change was recorded (YYYY-MM-DD) */
  date: string
  /** Severity of the change */
  severity: EventSeverity
  /** Type of regulatory change */
  changeType: ChangeType
  /** Human-readable summary of the change */
  summary: string
  /** Date from which the regulatory change is effective (YYYY-MM-DD) */
  effectiveFrom: string
  /** IDs of source pointers providing evidence */
  sourcePointerIds: string[]
  /** URL to the primary authoritative source */
  primarySourceUrl?: string
  /** Confidence level (0-100) */
  confidenceLevel: number
}

/**
 * RTL section in MDX frontmatter.
 * Links content to the Regulatory Truth Layer.
 */
export interface RtlFrontmatter {
  /** The concept ID from the concept registry */
  conceptId: string
  /** The regulatory rule ID from RTL */
  ruleId: string
}

/**
 * Result of reading an MDX file.
 */
export interface MdxReadResult {
  /** Parsed frontmatter data */
  data: Record<string, unknown>
  /** Markdown content after frontmatter */
  content: string
  /** Raw file contents */
  raw: string
}

// =============================================================================
// Read/Write Functions
// =============================================================================

/**
 * Read and parse an MDX file's frontmatter.
 *
 * @param filePath - Absolute path to the MDX file
 * @returns Parsed frontmatter data, content, and raw file contents
 * @throws ContentNotFoundError if the file doesn't exist
 * @throws FrontmatterParseError if gray-matter fails to parse
 */
export async function readMdxFrontmatter(filePath: string): Promise<MdxReadResult> {
  let raw: string

  try {
    raw = await fs.readFile(filePath, "utf-8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Extract conceptId from path for error message
      const conceptId =
        filePath
          .split("/")
          .pop()
          ?.replace(/\.mdx?$/, "") ?? "unknown"
      throw new ContentNotFoundError(filePath, conceptId)
    }
    throw err
  }

  try {
    const parsed = matter(raw)
    return {
      data: parsed.data as Record<string, unknown>,
      content: parsed.content,
      raw,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new FrontmatterParseError(filePath, message)
  }
}

/**
 * Write patched content to an MDX file.
 *
 * @param filePath - Absolute path to the MDX file
 * @param content - The complete file content to write
 */
export async function writeMdxFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf-8")
}

// =============================================================================
// Changelog Generation
// =============================================================================

/**
 * Generate a human-readable summary for a changelog entry.
 *
 * @param event - The content sync event
 * @returns A summary string describing the change
 *
 * @example
 * // Repeal: "Rule repealed."
 * // Create with newValue: "New threshold: 39816.84 EUR."
 * // Update with prev/new: "Updated from 300000.00 HRK to 39816.84 EUR."
 */
export function generateChangelogSummary(event: ContentSyncEventV1): string {
  const { changeType, previousValue, newValue, valueType } = event

  if (changeType === "repeal") {
    return "Rule repealed."
  }

  if (changeType === "create") {
    if (newValue) {
      const type = valueType ?? "value"
      return `New ${type}: ${newValue}.`
    }
    return "New rule created."
  }

  // changeType === "update"
  if (previousValue && newValue) {
    return `Updated from ${previousValue} to ${newValue}.`
  }

  if (newValue) {
    return `Updated to ${newValue}.`
  }

  return "Rule updated."
}

/**
 * Create a changelog entry from a content sync event.
 *
 * @param event - The content sync event
 * @returns A changelog entry for the MDX frontmatter
 */
export function createChangelogEntry(event: ContentSyncEventV1): ChangelogEntry {
  const today = new Date().toISOString().split("T")[0]

  const entry: ChangelogEntry = {
    eventId: event.id,
    date: today,
    severity: event.severity,
    changeType: event.changeType,
    summary: generateChangelogSummary(event),
    effectiveFrom: event.effectiveFrom,
    sourcePointerIds: event.sourcePointerIds,
    confidenceLevel: event.confidenceLevel,
  }

  if (event.primarySourceUrl) {
    entry.primarySourceUrl = event.primarySourceUrl
  }

  return entry
}

// =============================================================================
// Frontmatter Patching
// =============================================================================

/**
 * Patch an MDX file's frontmatter with a content sync event.
 *
 * This function:
 * - Updates lastUpdated to today's date
 * - Sets rtl.conceptId and rtl.ruleId
 * - Adds a changelog entry (newest first)
 *
 * @param filePath - Absolute path to the MDX file
 * @param event - The content sync event to apply
 * @returns The new file content as a string
 * @throws ContentNotFoundError if the file doesn't exist
 * @throws FrontmatterParseError if gray-matter fails to parse
 * @throws PatchConflictError if the eventId already exists in the changelog (idempotency)
 */
export async function patchFrontmatter(
  filePath: string,
  event: ContentSyncEventV1
): Promise<string> {
  // Read and parse existing file
  const { data, content } = await readMdxFrontmatter(filePath)

  // Validate changelog type - must be array or undefined
  // If present but not an array, this is a malformed file (PERMANENT error)
  if (data.changelog !== undefined && !Array.isArray(data.changelog)) {
    throw new InvalidPayloadError(
      `changelog in ${filePath} is not an array (got ${typeof data.changelog})`,
      data.changelog
    )
  }

  // Check for duplicate eventId (idempotency)
  const existingChangelog = (data.changelog ?? []) as ChangelogEntry[]
  const duplicateEntry = existingChangelog.find((entry) => entry.eventId === event.id)

  if (duplicateEntry) {
    throw new PatchConflictError(event.id, filePath)
  }

  // Update lastUpdated
  const today = new Date().toISOString().split("T")[0]
  data.lastUpdated = today

  // Update RTL section
  const rtl: RtlFrontmatter = {
    conceptId: event.conceptId,
    ruleId: event.ruleId,
  }
  data.rtl = rtl

  // Add changelog entry (newest first)
  const newEntry = createChangelogEntry(event)
  data.changelog = [newEntry, ...existingChangelog]

  // Serialize back to MDX
  return matter.stringify(content, data)
}
