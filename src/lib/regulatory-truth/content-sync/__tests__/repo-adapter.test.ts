// src/lib/regulatory-truth/content-sync/__tests__/repo-adapter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
  generateBranchName,
  generatePRTitle,
  generatePRBody,
  type GeneratePRBodyParams,
} from "../repo-adapter"

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockPRBodyParams(
  overrides: Partial<GeneratePRBodyParams> = {}
): GeneratePRBodyParams {
  return {
    eventId: "evt_abc12345xyz",
    conceptId: "pdv-threshold",
    ruleId: "rule_pdv_threshold_2025",
    changeType: "update",
    effectiveFrom: "2025-01-01",
    sourcePointerIds: ["ptr_abc123", "ptr_def456"],
    primarySourceUrl: "https://narodne-novine.nn.hr/clanci/1234",
    patchedFiles: ["content/vodici/pdv-prag.mdx"],
    ...overrides,
  }
}

// =============================================================================
// generateBranchName
// =============================================================================

describe("generateBranchName", () => {
  beforeEach(() => {
    // Mock Date to ensure consistent test results
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-01-15T10:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("generates branch name in correct format", () => {
    const branchName = generateBranchName("evt_abc12345xyz", "pdv-threshold")

    expect(branchName).toBe("content-sync/2025-01-15-pdv-threshold-evt_abc1")
  })

  it("uses first 8 characters of eventId as shortId", () => {
    const branchName = generateBranchName("abcdefghijklmnopqrstuvwxyz", "test-concept")

    expect(branchName).toContain("abcdefgh")
    expect(branchName).not.toContain("ijklmnop")
  })

  it("handles short eventId gracefully", () => {
    const branchName = generateBranchName("short", "test-concept")

    expect(branchName).toBe("content-sync/2025-01-15-test-concept-short")
  })

  it("uses current date in YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2024-06-30T23:59:59.999Z"))

    const branchName = generateBranchName("evt_xyz", "my-concept")

    expect(branchName).toMatch(/^content-sync\/2024-06-30-/)
  })

  it("handles conceptId with special characters", () => {
    const branchName = generateBranchName("evt_123", "pausalni-obrtnik")

    expect(branchName).toBe("content-sync/2025-01-15-pausalni-obrtnik-evt_123")
  })
})

// =============================================================================
// generatePRTitle
// =============================================================================

describe("generatePRTitle", () => {
  it("generates title for create changeType", () => {
    const title = generatePRTitle("pdv-threshold", "create")

    expect(title).toBe("docs: Add pdv-threshold content from RTL")
  })

  it("generates title for update changeType", () => {
    const title = generatePRTitle("pdv-threshold", "update")

    expect(title).toBe("docs: Update pdv-threshold content from RTL")
  })

  it("generates title for repeal changeType", () => {
    const title = generatePRTitle("pdv-threshold", "repeal")

    expect(title).toBe("docs: Remove pdv-threshold content from RTL")
  })

  it("includes conceptId in title", () => {
    const title = generatePRTitle("pausalni-limit", "update")

    expect(title).toContain("pausalni-limit")
  })
})

// =============================================================================
// generatePRBody
// =============================================================================

describe("generatePRBody", () => {
  it("includes event ID in the body", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("`evt_abc12345xyz`")
  })

  it("includes concept ID in the body", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("`pdv-threshold`")
  })

  it("includes rule ID in the body", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("`rule_pdv_threshold_2025`")
  })

  it("includes change type in the body", () => {
    const params = createMockPRBodyParams({ changeType: "update" })
    const body = generatePRBody(params)

    expect(body).toContain("| Change Type | update |")
  })

  it("includes effective from date in the body", () => {
    const params = createMockPRBodyParams({ effectiveFrom: "2025-01-01" })
    const body = generatePRBody(params)

    expect(body).toContain("| Effective From | 2025-01-01 |")
  })

  it("includes all source pointer IDs", () => {
    const params = createMockPRBodyParams({
      sourcePointerIds: ["ptr_abc123", "ptr_def456", "ptr_ghi789"],
    })
    const body = generatePRBody(params)

    expect(body).toContain("- `ptr_abc123`")
    expect(body).toContain("- `ptr_def456`")
    expect(body).toContain("- `ptr_ghi789`")
  })

  it("includes primary source URL when provided", () => {
    const params = createMockPRBodyParams({
      primarySourceUrl: "https://narodne-novine.nn.hr/clanci/1234",
    })
    const body = generatePRBody(params)

    expect(body).toContain("### Primary Source")
    expect(body).toContain(
      "[https://narodne-novine.nn.hr/clanci/1234](https://narodne-novine.nn.hr/clanci/1234)"
    )
  })

  it("omits primary source section when URL is not provided", () => {
    const params = createMockPRBodyParams({ primarySourceUrl: undefined })
    const body = generatePRBody(params)

    expect(body).not.toContain("### Primary Source")
  })

  it("includes all patched files", () => {
    const params = createMockPRBodyParams({
      patchedFiles: ["content/vodici/pdv-prag.mdx", "content/vodici/pdv-registracija.mdx"],
    })
    const body = generatePRBody(params)

    expect(body).toContain("### Patched Files")
    expect(body).toContain("- `content/vodici/pdv-prag.mdx`")
    expect(body).toContain("- `content/vodici/pdv-registracija.mdx`")
  })

  it("includes human review note", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("requires human review before merging")
    expect(body).toContain(
      "verify that the content changes accurately reflect the regulatory update"
    )
  })

  it("includes RTL Content Sync header", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("## RTL Content Sync")
    expect(body).toContain("automatically generated by the Regulatory Truth Layer")
  })

  it("formats event details as markdown table", () => {
    const params = createMockPRBodyParams()
    const body = generatePRBody(params)

    expect(body).toContain("### Event Details")
    expect(body).toContain("| Field | Value |")
    expect(body).toContain("| --- | --- |")
  })

  it("handles different change types", () => {
    const createBody = generatePRBody(createMockPRBodyParams({ changeType: "create" }))
    const updateBody = generatePRBody(createMockPRBodyParams({ changeType: "update" }))
    const repealBody = generatePRBody(createMockPRBodyParams({ changeType: "repeal" }))

    expect(createBody).toContain("| Change Type | create |")
    expect(updateBody).toContain("| Change Type | update |")
    expect(repealBody).toContain("| Change Type | repeal |")
  })

  it("handles empty source pointer IDs array", () => {
    const params = createMockPRBodyParams({ sourcePointerIds: [] })
    const body = generatePRBody(params)

    expect(body).toContain("### Source Pointers")
    // Should still have the section, just no list items
    expect(body).toContain("Evidence trail for this change:")
  })

  it("handles empty patched files array", () => {
    const params = createMockPRBodyParams({ patchedFiles: [] })
    const body = generatePRBody(params)

    expect(body).toContain("### Patched Files")
    // Should still have the section header
  })
})
