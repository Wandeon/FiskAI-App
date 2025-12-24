// e2e/assistant/fill-only.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Test: Fill-Only Behavior
 *
 * CRITICAL: Suggestions must NEVER auto-submit.
 * They must only fill the input field.
 */

test.describe("Fill-Only Behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/assistant-demo")
  })

  test("clicking initial suggestion fills input but does not submit", async ({ page }) => {
    // Wait for suggestions to appear
    const suggestion = page.getByRole("option").first()
    await expect(suggestion).toBeVisible()

    // Get the suggestion text
    const suggestionText = await suggestion.textContent()

    // Click the suggestion
    await suggestion.click()

    // Input should contain the suggestion text
    const input = page.getByRole("textbox")
    await expect(input).toHaveValue(suggestionText!)

    // Should NOT have loading state (no submission)
    await expect(page.getByTestId("answer-skeleton")).not.toBeVisible()

    // Input should be focused
    await expect(input).toBeFocused()
  })

  test("clicking related question fills input but does not submit", async ({ page }) => {
    // First, submit a query to get related questions
    const input = page.getByRole("textbox")
    await input.fill("What is VAT rate?")
    await input.press("Enter")

    // Wait for answer
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible()

    // Find related question chip
    const relatedQuestion = page
      .getByRole("button")
      .filter({ hasText: /when|how|what/i })
      .first()

    if (await relatedQuestion.isVisible()) {
      const questionText = await relatedQuestion.textContent()

      // Click related question
      await relatedQuestion.click()

      // Input should contain the question text
      await expect(input).toHaveValue(questionText!)

      // Should NOT have started a new request yet
      // (Old answer should still be visible)
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible()
    }
  })

  test("keyboard Enter on suggestion fills input but does not submit", async ({ page }) => {
    // Focus the suggestion container
    const suggestionContainer = page.getByRole("listbox")
    await suggestionContainer.focus()

    // Press Enter on first suggestion
    await page.keyboard.press("Enter")

    // Input should be filled
    const input = page.getByRole("textbox")
    const value = await input.inputValue()
    expect(value.length).toBeGreaterThan(0)

    // Should NOT have loading state
    await expect(page.getByTestId("answer-skeleton")).not.toBeVisible()
  })

  test("suggestion click followed by manual Enter submits", async ({ page }) => {
    // Click suggestion to fill
    const suggestion = page.getByRole("option").first()
    await suggestion.click()

    // Now manually press Enter to submit
    const input = page.getByRole("textbox")
    await input.press("Enter")

    // Should now see loading or answer
    await expect(
      page.getByTestId("answer-skeleton").or(page.getByRole("heading", { level: 2 }))
    ).toBeVisible()
  })
})
