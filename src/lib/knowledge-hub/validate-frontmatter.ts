import type { ChangelogEntry, RtlFrontmatter, ValidationResult } from "./types"
import { isRtlChangelogEntry, isLegacyChangelogEntry } from "./types"

/**
 * Validates RTL frontmatter section.
 */
export function validateRtlFrontmatter(rtl: unknown): ValidationResult {
  const errors: string[] = []

  // RTL is optional
  if (!rtl || typeof rtl !== "object") {
    return { valid: true, errors: [] }
  }

  const { conceptId, ruleId } = rtl as Record<string, unknown>

  if (conceptId !== undefined && typeof conceptId !== "string") {
    errors.push("rtl.conceptId must be a string")
  }

  if (ruleId !== undefined && typeof ruleId !== "string") {
    errors.push("rtl.ruleId must be a string")
  }

  // If one is set, both should be set
  if ((conceptId && !ruleId) || (!conceptId && ruleId)) {
    errors.push("rtl.conceptId and rtl.ruleId must both be set or both be unset")
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a changelog array according to Living Truth Infrastructure rules.
 *
 * Rules:
 * 1. Changelog must be sorted by date descending (newest first)
 * 2. Legacy `breaking` and `critical` entries MUST have at least one affectedSection
 * 3. Legacy `id` and RTL `eventId` must be unique within the array
 * 4. RTL entries must have valid sourcePointerIds and confidenceLevel
 */
export function validateChangelog(changelog: ChangelogEntry[]): ValidationResult {
  const errors: string[] = []

  // Empty changelog is valid
  if (changelog.length === 0) {
    return { valid: true, errors: [] }
  }

  // Rule 1: Check date sorting (descending)
  for (let i = 1; i < changelog.length; i++) {
    const prevDate = new Date(changelog[i - 1].date)
    const currDate = new Date(changelog[i].date)
    if (currDate > prevDate) {
      errors.push("Changelog must be sorted by date descending")
      break // Only report once
    }
  }

  // Track unique IDs across both entry types
  const seenIds = new Set<string>()
  const seenEventIds = new Set<string>()

  for (const entry of changelog) {
    if (isLegacyChangelogEntry(entry)) {
      // Rule 2: Check that breaking/critical entries have affectedSections
      if (entry.severity === "breaking" || entry.severity === "critical") {
        const hasAffectedSections = entry.affectedSections && entry.affectedSections.length > 0
        if (!hasAffectedSections) {
          errors.push(
            `Entry '${entry.id}' with severity '${entry.severity}' must have at least one affectedSection`
          )
        }
      }

      // Rule 3a: Check for unique legacy ids
      if (seenIds.has(entry.id)) {
        errors.push(`Duplicate changelog id: '${entry.id}'`)
      } else {
        seenIds.add(entry.id)
      }
    } else if (isRtlChangelogEntry(entry)) {
      // Rule 3b: Check for unique eventIds
      if (seenEventIds.has(entry.eventId)) {
        errors.push(`Duplicate changelog eventId: '${entry.eventId}'`)
      } else {
        seenEventIds.add(entry.eventId)
      }

      // Rule 4a: sourcePointerIds must be an array
      if (!Array.isArray(entry.sourcePointerIds)) {
        errors.push(`Changelog entry ${entry.eventId}: sourcePointerIds must be an array`)
      } else if (entry.sourcePointerIds.length === 0) {
        errors.push(`Changelog entry ${entry.eventId}: sourcePointerIds must not be empty`)
      }

      // Rule 4b: confidenceLevel must be 0-100
      if (
        typeof entry.confidenceLevel !== "number" ||
        entry.confidenceLevel < 0 ||
        entry.confidenceLevel > 100
      ) {
        errors.push(`Changelog entry ${entry.eventId}: confidenceLevel must be 0-100`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
