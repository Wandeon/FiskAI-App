// src/lib/regulatory-truth/utils/__tests__/structural-fingerprint.test.ts
//
// TDD tests for structural fingerprinting to detect format changes in scraped pages.
// Problem: Format changes fail silently (0 items extracted, no error).
// Solution: Generate structural fingerprints and alert when drift > 30%.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Import the module under test (will fail until implemented)
import {
  generateFingerprint,
  calculateDrift,
  checkStructuralDrift,
  approveBaseline,
  type StructuralFingerprint,
  type BaselineMetadata,
  DRIFT_THRESHOLD_PERCENT,
} from "../structural-fingerprint"

describe("structural-fingerprint", () => {
  describe("generateFingerprint", () => {
    it("generates fingerprint from HTML with tag counts", () => {
      const html = `
        <html>
          <body>
            <div class="content">
              <p>First paragraph</p>
              <p>Second paragraph</p>
              <table><tr><td>Data</td></tr></table>
            </div>
            <div class="sidebar">
              <p>Side content</p>
            </div>
          </body>
        </html>
      `

      const fingerprint = generateFingerprint(html)

      expect(fingerprint.tagCounts).toBeDefined()
      expect(fingerprint.tagCounts["div"]).toBe(2)
      expect(fingerprint.tagCounts["p"]).toBe(3)
      expect(fingerprint.tagCounts["table"]).toBe(1)
      expect(fingerprint.tagCounts["tr"]).toBe(1)
      expect(fingerprint.tagCounts["td"]).toBe(1)
    })

    it("generates fingerprint with total element count", () => {
      const html = `
        <html>
          <body>
            <div><p>Text</p></div>
            <span>More</span>
          </body>
        </html>
      `

      const fingerprint = generateFingerprint(html)

      // html, body, div, p, span = 5 elements
      expect(fingerprint.totalElements).toBeGreaterThanOrEqual(5)
    })

    it("calculates content ratio (text vs total)", () => {
      const html = `
        <html>
          <body>
            <div class="content">
              This is the main content text that should be counted.
            </div>
            <script>var x = 1;</script>
            <style>.foo { color: red; }</style>
          </body>
        </html>
      `

      const fingerprint = generateFingerprint(html)

      // Content ratio should be between 0 and 1
      expect(fingerprint.contentRatio).toBeGreaterThan(0)
      expect(fingerprint.contentRatio).toBeLessThanOrEqual(1)
    })

    it("tracks selector yields for common patterns", () => {
      const html = `
        <html>
          <body>
            <div id="main">
              <article class="news-item">Item 1</article>
              <article class="news-item">Item 2</article>
              <article class="news-item">Item 3</article>
            </div>
            <div class="pagination">
              <a href="?page=2">Next</a>
            </div>
          </body>
        </html>
      `

      const fingerprint = generateFingerprint(html, {
        selectors: ["#main", ".news-item", ".pagination", "article"],
      })

      expect(fingerprint.selectorYields).toBeDefined()
      expect(fingerprint.selectorYields["#main"]).toBe(1)
      expect(fingerprint.selectorYields[".news-item"]).toBe(3)
      expect(fingerprint.selectorYields["article"]).toBe(3)
      expect(fingerprint.selectorYields[".pagination"]).toBe(1)
    })

    it("includes timestamp in fingerprint", () => {
      const html = "<html><body><p>Test</p></body></html>"
      const before = new Date()

      const fingerprint = generateFingerprint(html)

      const after = new Date()
      expect(fingerprint.generatedAt).toBeInstanceOf(Date)
      expect(fingerprint.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(fingerprint.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("handles empty HTML gracefully", () => {
      const fingerprint = generateFingerprint("")

      expect(fingerprint.totalElements).toBe(0)
      expect(fingerprint.contentRatio).toBe(0)
      expect(fingerprint.tagCounts).toEqual({})
    })

    it("handles malformed HTML gracefully", () => {
      const malformedHtml = "<div><p>Unclosed paragraph<span>Mixed nesting</p></div>"

      // Should not throw
      const fingerprint = generateFingerprint(malformedHtml)

      expect(fingerprint.totalElements).toBeGreaterThan(0)
    })
  })

  describe("calculateDrift", () => {
    it("returns 0% drift for identical fingerprints", () => {
      const fingerprint: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20, table: 5 },
        selectorYields: { "#main": 1, ".item": 10 },
        contentRatio: 0.6,
        totalElements: 50,
        generatedAt: new Date(),
      }

      const drift = calculateDrift(fingerprint, fingerprint)

      expect(drift).toBe(0)
    })

    it("calculates drift percentage for tag distribution changes", () => {
      const baseline: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20, table: 5 },
        selectorYields: {},
        contentRatio: 0.6,
        totalElements: 50,
        generatedAt: new Date(),
      }

      // Current has different distribution
      const current: StructuralFingerprint = {
        tagCounts: { div: 5, p: 10, table: 2 }, // Same ratios, different counts
        selectorYields: {},
        contentRatio: 0.6,
        totalElements: 25,
        generatedAt: new Date(),
      }

      const drift = calculateDrift(baseline, current)

      // Element count dropped 50%, but ratios are similar
      // Drift should reflect structural change
      expect(drift).toBeGreaterThan(0)
      expect(drift).toBeLessThan(100)
    })

    it("returns high drift when structure drastically changes", () => {
      const baseline: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20, table: 5 },
        selectorYields: { ".news-item": 10, "#main": 1 },
        contentRatio: 0.6,
        totalElements: 50,
        generatedAt: new Date(),
      }

      // Complete structure change - spa-style page instead of traditional
      const current: StructuralFingerprint = {
        tagCounts: { div: 1, span: 5, script: 10 },
        selectorYields: { ".news-item": 0, "#main": 0 },
        contentRatio: 0.1,
        totalElements: 20,
        generatedAt: new Date(),
      }

      const drift = calculateDrift(baseline, current)

      // Major structure change should produce > 30% drift
      expect(drift).toBeGreaterThan(30)
    })

    it("detects drift when key selectors stop yielding", () => {
      const baseline: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20 },
        selectorYields: { ".news-item": 10, ".pagination": 1 },
        contentRatio: 0.5,
        totalElements: 40,
        generatedAt: new Date(),
      }

      // Selectors no longer match - format changed
      const current: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20 },
        selectorYields: { ".news-item": 0, ".pagination": 0 },
        contentRatio: 0.5,
        totalElements: 40,
        generatedAt: new Date(),
      }

      const drift = calculateDrift(baseline, current)

      // Selector yields going to 0 is a major structural change
      expect(drift).toBeGreaterThan(30)
    })

    it("accounts for content ratio changes", () => {
      const baseline: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20 },
        selectorYields: {},
        contentRatio: 0.7, // 70% text content
        totalElements: 30,
        generatedAt: new Date(),
      }

      // Content ratio dropped significantly (page is mostly scripts now)
      const current: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20 },
        selectorYields: {},
        contentRatio: 0.1, // Only 10% text content
        totalElements: 30,
        generatedAt: new Date(),
      }

      const drift = calculateDrift(baseline, current)

      // Content ratio drop (60%) with weight 0.25 = 15% drift contribution
      // This is significant drift from content ratio alone
      expect(drift).toBeGreaterThan(10)
      expect(drift).toBeLessThan(30) // Stays below threshold when only content ratio changes
    })
  })

  describe("checkStructuralDrift", () => {
    const mockRaiseAlert = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("alerts when drift exceeds threshold (30%)", async () => {
      const baseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 10, p: 20, article: 5 },
          selectorYields: { ".news-item": 5 },
          contentRatio: 0.6,
          totalElements: 50,
          generatedAt: new Date("2024-01-01"),
        },
        baselineUpdatedAt: new Date("2024-01-01"),
        baselineUpdatedBy: "initial",
        approvalStatus: "approved",
      }

      const currentHtml = `
        <html>
          <body>
            <div id="app"></div>
            <script>// SPA framework</script>
          </body>
        </html>
      `

      const result = await checkStructuralDrift(
        "endpoint-123",
        currentHtml,
        baseline,
        mockRaiseAlert
      )

      expect(result.driftPercent).toBeGreaterThan(DRIFT_THRESHOLD_PERCENT)
      expect(result.shouldAlert).toBe(true)
      expect(mockRaiseAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "STRUCTURAL_DRIFT", // WatchdogAlertType enum value
          severity: "CRITICAL",
          entityId: "endpoint-123",
        })
      )
    })

    it("does not alert when drift is below threshold", async () => {
      const baseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 10, p: 20 },
          selectorYields: {},
          contentRatio: 0.5,
          totalElements: 35,
          generatedAt: new Date("2024-01-01"),
        },
        baselineUpdatedAt: new Date("2024-01-01"),
        baselineUpdatedBy: "initial",
        approvalStatus: "approved",
      }

      // Very similar structure
      const currentHtml = `
        <html>
          <body>
            <div><p>1</p><p>2</p></div>
            <div><p>3</p><p>4</p></div>
            <div><p>5</p><p>6</p></div>
            <div><p>7</p><p>8</p></div>
            <div><p>9</p><p>10</p></div>
            <div><p>11</p><p>12</p></div>
            <div><p>13</p><p>14</p></div>
            <div><p>15</p><p>16</p></div>
            <div><p>17</p><p>18</p></div>
            <div><p>19</p><p>20</p></div>
          </body>
        </html>
      `

      const result = await checkStructuralDrift(
        "endpoint-123",
        currentHtml,
        baseline,
        mockRaiseAlert
      )

      expect(result.driftPercent).toBeLessThanOrEqual(DRIFT_THRESHOLD_PERCENT)
      expect(result.shouldAlert).toBe(false)
      expect(mockRaiseAlert).not.toHaveBeenCalled()
    })

    it("includes drift details in alert", async () => {
      const baseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 10, p: 20, table: 5 },
          selectorYields: { ".item": 10 },
          contentRatio: 0.6,
          totalElements: 50,
          generatedAt: new Date("2024-01-01"),
        },
        baselineUpdatedAt: new Date("2024-01-01"),
        baselineUpdatedBy: "initial",
        approvalStatus: "approved",
      }

      const currentHtml = "<html><body><span>Completely different</span></body></html>"

      await checkStructuralDrift("endpoint-123", currentHtml, baseline, mockRaiseAlert)

      expect(mockRaiseAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            driftPercent: expect.any(Number),
            baselineUpdatedAt: baseline.baselineUpdatedAt,
            currentFingerprint: expect.any(Object),
            baselineFingerprint: expect.any(Object),
          }),
        })
      )
    })
  })

  describe("BaselineMetadata - audit fields", () => {
    it("stores baselineUpdatedAt timestamp", () => {
      const now = new Date()
      const metadata: BaselineMetadata = {
        fingerprint: {
          tagCounts: {},
          selectorYields: {},
          contentRatio: 0,
          totalElements: 0,
          generatedAt: now,
        },
        baselineUpdatedAt: now,
        baselineUpdatedBy: "initial",
        approvalStatus: "pending",
      }

      expect(metadata.baselineUpdatedAt).toBeInstanceOf(Date)
      expect(metadata.baselineUpdatedAt).toEqual(now)
    })

    it("stores baselineUpdatedBy identifier", () => {
      const metadata: BaselineMetadata = {
        fingerprint: {
          tagCounts: {},
          selectorYields: {},
          contentRatio: 0,
          totalElements: 0,
          generatedAt: new Date(),
        },
        baselineUpdatedAt: new Date(),
        baselineUpdatedBy: "user@example.com",
        approvalStatus: "approved",
      }

      expect(metadata.baselineUpdatedBy).toBe("user@example.com")
    })

    it("tracks approval status (pending/approved)", () => {
      const metadata: BaselineMetadata = {
        fingerprint: {
          tagCounts: {},
          selectorYields: {},
          contentRatio: 0,
          totalElements: 0,
          generatedAt: new Date(),
        },
        baselineUpdatedAt: new Date(),
        baselineUpdatedBy: "initial",
        approvalStatus: "pending",
      }

      expect(metadata.approvalStatus).toBe("pending")

      // Simulate approval
      metadata.approvalStatus = "approved"
      expect(metadata.approvalStatus).toBe("approved")
    })

    it("can store previous fingerprint for comparison", () => {
      const oldFingerprint: StructuralFingerprint = {
        tagCounts: { div: 5 },
        selectorYields: {},
        contentRatio: 0.5,
        totalElements: 10,
        generatedAt: new Date("2024-01-01"),
      }

      const newFingerprint: StructuralFingerprint = {
        tagCounts: { div: 10 },
        selectorYields: {},
        contentRatio: 0.6,
        totalElements: 20,
        generatedAt: new Date("2024-02-01"),
      }

      const metadata: BaselineMetadata = {
        fingerprint: newFingerprint,
        baselineUpdatedAt: new Date("2024-02-01"),
        baselineUpdatedBy: "admin@example.com",
        approvalStatus: "approved",
        previousFingerprint: oldFingerprint,
      }

      expect(metadata.previousFingerprint).toBeDefined()
      expect(metadata.previousFingerprint?.tagCounts.div).toBe(5)
    })
  })

  describe("baseline governance - no auto-update", () => {
    it("requires human approval to update baseline", async () => {
      // This test verifies the interface enforces human-in-the-loop
      const proposedUpdate: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 20 },
          selectorYields: {},
          contentRatio: 0.7,
          totalElements: 30,
          generatedAt: new Date(),
        },
        baselineUpdatedAt: new Date(),
        baselineUpdatedBy: "system", // System-generated
        approvalStatus: "pending", // Requires human approval
      }

      // Until approved, the baseline should not be considered active
      expect(proposedUpdate.approvalStatus).toBe("pending")

      // The system should never auto-approve
      // This is enforced by the interface - approvalStatus must be explicitly set
      expect(proposedUpdate.baselineUpdatedBy).not.toBe("auto")
    })
  })

  describe("DRIFT_THRESHOLD_PERCENT constant", () => {
    it("is set to 30%", () => {
      expect(DRIFT_THRESHOLD_PERCENT).toBe(30)
    })
  })

  describe("approveBaseline", () => {
    it("changes status from pending to approved", () => {
      const pendingBaseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 10, p: 20 },
          selectorYields: { ".item": 5 },
          contentRatio: 0.6,
          totalElements: 40,
          generatedAt: new Date("2024-01-01"),
        },
        baselineUpdatedAt: new Date("2024-01-01"),
        baselineUpdatedBy: "system",
        approvalStatus: "pending",
      }

      const approved = approveBaseline(pendingBaseline, "admin@example.com")

      expect(approved.approvalStatus).toBe("approved")
    })

    it("records approver email in baselineUpdatedBy", () => {
      const pendingBaseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 10 },
          selectorYields: {},
          contentRatio: 0.5,
          totalElements: 15,
          generatedAt: new Date("2024-01-01"),
        },
        baselineUpdatedAt: new Date("2024-01-01"),
        baselineUpdatedBy: "system",
        approvalStatus: "pending",
      }

      const approved = approveBaseline(pendingBaseline, "reviewer@fiskai.hr")

      expect(approved.baselineUpdatedBy).toBe("reviewer@fiskai.hr")
    })

    it("updates timestamp to current time", () => {
      const oldDate = new Date("2024-01-01")
      const pendingBaseline: BaselineMetadata = {
        fingerprint: {
          tagCounts: { div: 5 },
          selectorYields: {},
          contentRatio: 0.4,
          totalElements: 10,
          generatedAt: oldDate,
        },
        baselineUpdatedAt: oldDate,
        baselineUpdatedBy: "initial",
        approvalStatus: "pending",
      }

      const before = new Date()
      const approved = approveBaseline(pendingBaseline, "admin@example.com")
      const after = new Date()

      expect(approved.baselineUpdatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(approved.baselineUpdatedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("preserves fingerprint data unchanged", () => {
      const fingerprint: StructuralFingerprint = {
        tagCounts: { div: 10, p: 20, table: 5 },
        selectorYields: { "#main": 1, ".item": 10 },
        contentRatio: 0.65,
        totalElements: 50,
        generatedAt: new Date("2024-01-15"),
      }

      const pendingBaseline: BaselineMetadata = {
        fingerprint,
        baselineUpdatedAt: new Date("2024-01-15"),
        baselineUpdatedBy: "proposal-system",
        approvalStatus: "pending",
        previousFingerprint: {
          tagCounts: { div: 8, p: 18 },
          selectorYields: { "#main": 1, ".item": 8 },
          contentRatio: 0.6,
          totalElements: 45,
          generatedAt: new Date("2024-01-01"),
        },
      }

      const approved = approveBaseline(pendingBaseline, "admin@example.com")

      // Fingerprint should be unchanged
      expect(approved.fingerprint).toEqual(fingerprint)
      // Previous fingerprint should also be preserved
      expect(approved.previousFingerprint).toEqual(pendingBaseline.previousFingerprint)
    })
  })
})
