// e2e/assistant/api-integration.spec.ts
/**
 * E2E Test: UI-API Integration
 *
 * CRITICAL: Verifies that the UI actually calls the real API
 * and displays responses correctly. This proves the system works
 * end-to-end, not just with fixtures.
 *
 * These tests use the /assistant page (not /assistant-demo which uses fixtures)
 */
import { test, expect } from "@playwright/test"

test.describe("UI-API Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Use the actual assistant page, not the demo fixtures page
    await page.goto("/assistant")
    // Wait for the page to be interactive - use label or placeholder instead of role
    await expect(page.getByLabel("Question input")).toBeVisible({ timeout: 30000 })
  })

  test("submitting a valid multi-token query returns ANSWER", async ({ page }) => {
    const input = page.getByLabel("Question input")

    // Type a valid multi-token query that should match concepts
    await input.fill("koja je stopa PDV")
    await input.press("Enter")

    // Wait for loading to complete (no more spinner)
    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // Should show an answer (not a refusal amber box)
    // Check for answer content - either headline or confidence badge
    const answerSection = page.getByTestId("answer-column")
    await expect(answerSection).toBeVisible()

    // Look for HIGH/MEDIUM/LOW confidence badge which only appears on ANSWERs
    const confidenceBadge = page.getByText(/confidence/i)
    const hasAnswer = await confidenceBadge.isVisible().catch(() => false)

    // OR look for citations which only appear on ANSWERs
    const evidenceSection = page.getByTestId("evidence-column")
    const citationsVisible = await evidenceSection
      .getByText("Primary:")
      .isVisible()
      .catch(() => false)

    // Either confidence or citations should be visible for an ANSWER
    expect(hasAnswer || citationsVisible).toBe(true)
  })

  test("submitting gibberish returns REFUSAL", async ({ page }) => {
    const input = page.getByLabel("Question input")

    // Type gibberish that should not match any concepts
    await input.fill("xyz123 asdfghjkl qwerty zxcvbn")
    await input.press("Enter")

    // Wait for loading to complete
    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // Should show refusal (amber/yellow box with "Cannot provide answer")
    const refusalText = page.getByText(/Cannot provide answer|Nema dostupnih|No official sources/i)
    await expect(refusalText).toBeVisible()
  })

  test("submitting single-token query returns REFUSAL asking for clarification", async ({
    page,
  }) => {
    const input = page.getByLabel("Question input")

    // Single token should trigger minimum intent check
    await input.fill("pdv")
    await input.press("Enter")

    // Wait for loading to complete
    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // Should show refusal asking for more details
    const clarificationText = page.getByText(/precizirajte|more details|navedite/i)
    await expect(clarificationText).toBeVisible()
  })

  test("API response contains required schema fields", async ({ page }) => {
    // Intercept the API call to verify response structure
    let apiResponse: any = null

    page.on("response", async (response) => {
      if (response.url().includes("/api/assistant/chat")) {
        apiResponse = await response.json()
      }
    })

    const input = page.getByLabel("Question input")
    await input.fill("koja je stopa PDV u Hrvatskoj")
    await input.press("Enter")

    // Wait for response
    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // Verify API response structure
    expect(apiResponse).toBeTruthy()
    expect(apiResponse.schemaVersion).toBe("1.0.0")
    expect(apiResponse.requestId).toMatch(/^req_/)
    expect(apiResponse.traceId).toMatch(/^trace_/)
    expect(apiResponse.kind).toMatch(/^(ANSWER|REFUSAL)$/)
    expect(apiResponse.surface).toBe("MARKETING")
    expect(apiResponse.createdAt).toBeTruthy()
  })

  test("ANSWER response has citations", async ({ page }) => {
    let apiResponse: any = null

    page.on("response", async (response) => {
      if (response.url().includes("/api/assistant/chat")) {
        apiResponse = await response.json()
      }
    })

    const input = page.getByLabel("Question input")
    await input.fill("koja je opća stopa PDV")
    await input.press("Enter")

    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // If we got an ANSWER, it must have citations (fail-closed guarantee)
    if (apiResponse?.kind === "ANSWER" && apiResponse?.topic === "REGULATORY") {
      expect(apiResponse.citations).toBeTruthy()
      expect(apiResponse.citations.primary).toBeTruthy()
      expect(apiResponse.citations.primary.url).toBeTruthy()
    }
  })
})

test.describe("Surface Differentiation", () => {
  test("MARKETING surface does not include clientContext", async ({ page }) => {
    let apiResponse: any = null

    page.on("response", async (response) => {
      if (response.url().includes("/api/assistant/chat")) {
        apiResponse = await response.json()
      }
    })

    await page.goto("/assistant")
    const input = page.getByLabel("Question input")
    await input.fill("koja je stopa PDV")
    await input.press("Enter")

    await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
      timeout: 10000,
    })

    // MARKETING surface should not include clientContext
    expect(apiResponse).toBeTruthy()
    expect(apiResponse.surface).toBe("MARKETING")

    // clientContext should be undefined for MARKETING surface with non-personalized query
    if (apiResponse?.kind === "ANSWER") {
      expect(apiResponse.clientContext).toBeUndefined()
    }
  })
})

test.describe("Fail-Closed Behavior", () => {
  test("no hallucinated answers without citations", async ({ page }) => {
    // Test multiple gibberish queries to ensure none produce answers
    const gibberishQueries = [
      "xyz123 qwerty asdf",
      "asdfjkl wertyui zxcvbn",
      "random nonsense words here",
      "ab cd ef gh ij kl",
    ]

    for (const query of gibberishQueries) {
      await page.goto("/assistant")
      const input = page.getByLabel("Question input")
      await input.fill(query)
      await input.press("Enter")

      await expect(page.getByText("Searching...", { exact: false })).not.toBeVisible({
        timeout: 10000,
      })

      // Should NOT see any confidence badge (which only appears on ANSWERs)
      const confidenceBadge = page.getByText(/confidence/i)
      const hasConfidence = await confidenceBadge.isVisible().catch(() => false)

      if (hasConfidence) {
        throw new Error(`Gibberish query "${query}" produced an ANSWER - fail-closed violation!`)
      }
    }
  })
})
