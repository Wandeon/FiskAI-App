import { describe, it, expect } from "vitest"
import { validateChangelog } from "../validate-frontmatter"
import type { ChangelogEntry } from "../types"

describe("validateChangelog", () => {
  it("passes for valid changelog", () => {
    const changelog: ChangelogEntry[] = [
      {
        id: "2025-01-15-pdv-threshold",
        date: "2025-01-15",
        severity: "breaking",
        summary: "PDV prag povećan na 60.000 EUR",
        affectedSections: ["pdv-obveza", "pdv-prijava"],
        sourceRef: "NN 123/2024",
      },
      {
        id: "2025-01-10-info-update",
        date: "2025-01-10",
        severity: "info",
        summary: "Ažurirano objašnjenje postupka",
      },
    ]

    const result = validateChangelog(changelog)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("fails when not sorted by date descending", () => {
    const changelog: ChangelogEntry[] = [
      {
        id: "2025-01-10-older",
        date: "2025-01-10",
        severity: "info",
        summary: "Starija promjena",
      },
      {
        id: "2025-01-15-newer",
        date: "2025-01-15",
        severity: "info",
        summary: "Novija promjena",
      },
    ]

    const result = validateChangelog(changelog)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Changelog must be sorted by date descending")
  })

  it("fails when critical/breaking lacks affectedSections", () => {
    const changelogCritical: ChangelogEntry[] = [
      {
        id: "2025-01-15-critical-change",
        date: "2025-01-15",
        severity: "critical",
        summary: "Kritična promjena bez pogođenih sekcija",
      },
    ]

    const resultCritical = validateChangelog(changelogCritical)

    expect(resultCritical.valid).toBe(false)
    expect(resultCritical.errors).toContain(
      "Entry '2025-01-15-critical-change' with severity 'critical' must have at least one affectedSection"
    )

    const changelogBreaking: ChangelogEntry[] = [
      {
        id: "2025-01-15-breaking-change",
        date: "2025-01-15",
        severity: "breaking",
        summary: "Breaking promjena bez pogođenih sekcija",
      },
    ]

    const resultBreaking = validateChangelog(changelogBreaking)

    expect(resultBreaking.valid).toBe(false)
    expect(resultBreaking.errors).toContain(
      "Entry '2025-01-15-breaking-change' with severity 'breaking' must have at least one affectedSection"
    )
  })

  it("fails when ids are not unique", () => {
    const changelog: ChangelogEntry[] = [
      {
        id: "2025-01-15-duplicate",
        date: "2025-01-15",
        severity: "info",
        summary: "Prva promjena",
      },
      {
        id: "2025-01-15-duplicate",
        date: "2025-01-14",
        severity: "info",
        summary: "Druga promjena s istim id-om",
      },
    ]

    const result = validateChangelog(changelog)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Duplicate changelog id: '2025-01-15-duplicate'")
  })

  it("passes for empty changelog", () => {
    const changelog: ChangelogEntry[] = []

    const result = validateChangelog(changelog)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("fails when breaking entry has empty affectedSections", () => {
    const changelog: ChangelogEntry[] = [
      {
        id: "2025-01-15-breaking-empty",
        date: "2025-01-15",
        severity: "breaking",
        summary: "Breaking promjena s praznim nizom",
        affectedSections: [],
      },
    ]

    const result = validateChangelog(changelog)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      "Entry '2025-01-15-breaking-empty' with severity 'breaking' must have at least one affectedSection"
    )
  })
})
