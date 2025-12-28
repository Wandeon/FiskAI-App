import type { ChangelogEntry, ValidationResult } from "./types"

/**
 * Validates a changelog array according to Living Truth Infrastructure rules.
 *
 * Rules:
 * 1. Changelog must be sorted by date descending (newest first)
 * 2. `breaking` and `critical` entries MUST have at least one affectedSection
 * 3. `id` must be unique within the array
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

  // Rule 2: Check that breaking/critical entries have affectedSections
  for (const entry of changelog) {
    if (entry.severity === "breaking" || entry.severity === "critical") {
      const hasAffectedSections = entry.affectedSections && entry.affectedSections.length > 0
      if (!hasAffectedSections) {
        errors.push(
          `Entry '${entry.id}' with severity '${entry.severity}' must have at least one affectedSection`
        )
      }
    }
  }

  // Rule 3: Check for unique ids
  const seenIds = new Set<string>()
  for (const entry of changelog) {
    if (seenIds.has(entry.id)) {
      errors.push(`Duplicate changelog id: '${entry.id}'`)
    } else {
      seenIds.add(entry.id)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
