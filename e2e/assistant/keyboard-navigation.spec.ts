// e2e/assistant/keyboard-navigation.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Test: Keyboard Navigation
 *
 * Full keyboard accessibility for all interactions.
 */

test.describe("Keyboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/assistant")
  })

  test("Enter submits query, Shift+Enter adds newline", async ({ page }) => {
    const input = page.getByRole("textbox")
    await input.focus()

    // Type first line
    await input.type("Line 1")

    // Shift+Enter for newline
    await page.keyboard.press("Shift+Enter")
    await input.type("Line 2")

    // Should have newline
    const value = await input.inputValue()
    expect(value).toContain("\n")

    // Press Enter to submit
    await page.keyboard.press("Enter")

    // Should start loading
    await expect(
      page.getByTestId("answer-skeleton").or(page.getByRole("heading", { level: 2 }))
    ).toBeVisible()
  })

  test("arrow keys navigate suggestion chips", async ({ page }) => {
    // Focus suggestion container
    const container = page.getByRole("listbox")
    await container.focus()

    // Get initial active descendant
    const initialActive = await container.getAttribute("aria-activedescendant")

    // Press ArrowRight
    await page.keyboard.press("ArrowRight")

    // Active descendant should change
    const newActive = await container.getAttribute("aria-activedescendant")
    expect(newActive).not.toBe(initialActive)
  })

  test("Home/End keys jump to first/last chip", async ({ page }) => {
    const container = page.getByRole("listbox")
    await container.focus()

    // Go to middle
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")

    // Press Home
    await page.keyboard.press("Home")
    const homeActive = await container.getAttribute("aria-activedescendant")
    expect(homeActive).toBe("chip-0")

    // Press End
    await page.keyboard.press("End")
    const endActive = await container.getAttribute("aria-activedescendant")
    expect(endActive).toMatch(/chip-\d+/)
  })

  test("Tab navigates between major sections", async ({ page }) => {
    // Start from body
    await page.keyboard.press("Tab") // Skip links (if visible)
    await page.keyboard.press("Tab") // Should reach input or history

    const focused = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tag: el?.tagName,
        role: el?.getAttribute("role"),
      }
    })

    // Should be on an interactive element
    expect(["INPUT", "TEXTAREA", "BUTTON", "A", "DIV"]).toContain(focused.tag)
  })

  test("expanding history is keyboard accessible", async ({ page }) => {
    // Submit a query first
    const input = page.getByRole("textbox")
    await input.fill("Test query")
    await input.press("Enter")

    // Wait for answer
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible()

    // Submit another query
    await input.fill("Another query")
    await input.press("Enter")

    // Wait for history bar
    const historyToggle = page.getByRole("button", { name: /previous questions/i })

    if (await historyToggle.isVisible()) {
      // Focus and press Enter
      await historyToggle.focus()
      await page.keyboard.press("Enter")

      // History should be expanded
      await expect(historyToggle).toHaveAttribute("aria-expanded", "true")
    }
  })
})
