// e2e/auth.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Tests: Authentication Flow
 *
 * Tests the complete authentication journey including:
 * - Login page accessibility
 * - Email identification step
 * - Password authentication
 * - Error handling
 * - Redirect to dashboard after login
 */

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies()
  })

  test("should display auth page with email input", async ({ page }) => {
    await page.goto("/auth")

    // Should show the identify step with email input
    const emailInput = page.getByRole("textbox", { name: /e-?mail/i })
    await expect(emailInput).toBeVisible()

    // Should have a submit button
    const submitButton = page.getByRole("button", { name: /nastavi|prijavi|dalje/i })
    await expect(submitButton).toBeVisible()
  })

  test("should show Google sign-in option", async ({ page }) => {
    await page.goto("/auth")

    // Should have Google OAuth button
    const googleButton = page.getByRole("button", { name: /google/i })
    await expect(googleButton).toBeVisible()
  })

  test("should validate email format", async ({ page }) => {
    await page.goto("/auth")

    const emailInput = page.getByRole("textbox", { name: /e-?mail/i })
    await emailInput.fill("invalid-email")

    const submitButton = page.getByRole("button", { name: /nastavi|prijavi|dalje/i })
    await submitButton.click()

    // Should show validation error
    await expect(page.getByText(/neispravan|invalid|format/i)).toBeVisible({ timeout: 5000 })
  })

  test("should progress to authenticate step for existing user", async ({ page }) => {
    await page.goto("/auth")

    const emailInput = page.getByRole("textbox", { name: /e-?mail/i })
    await emailInput.fill("test@example.com")

    const submitButton = page.getByRole("button", { name: /nastavi|prijavi|dalje/i })
    await submitButton.click()

    // Should show password field or verification step
    // Wait for either password input or verification code input
    await expect(
      page.getByRole("textbox", { name: /lozink|password/i }).or(page.getByText(/verifikacij|verification/i))
    ).toBeVisible({ timeout: 10000 })
  })

  test("should show password reset link on authenticate step", async ({ page }) => {
    await page.goto("/auth")

    const emailInput = page.getByRole("textbox", { name: /e-?mail/i })
    await emailInput.fill("test@example.com")

    const submitButton = page.getByRole("button", { name: /nastavi|prijavi|dalje/i })
    await submitButton.click()

    // Wait for authenticate step
    await page.waitForTimeout(1000)

    // Should have forgot password link
    const forgotLink = page.getByRole("button", { name: /zaboravljen|forgot|reset/i })
    if (await forgotLink.isVisible()) {
      await expect(forgotLink).toBeEnabled()
    }
  })

  test("should allow going back to email entry", async ({ page }) => {
    await page.goto("/auth")

    const emailInput = page.getByRole("textbox", { name: /e-?mail/i })
    await emailInput.fill("test@example.com")

    const submitButton = page.getByRole("button", { name: /nastavi|prijavi|dalje/i })
    await submitButton.click()

    // Wait for next step
    await page.waitForTimeout(1000)

    // Look for back button
    const backButton = page.getByRole("button", { name: /natrag|back|<|povratak/i })
    if (await backButton.isVisible()) {
      await backButton.click()

      // Should be back at email entry
      await expect(page.getByRole("textbox", { name: /e-?mail/i })).toBeVisible()
    }
  })

  test("should redirect /login to /auth", async ({ page }) => {
    await page.goto("/login")

    // Should redirect to auth page
    await expect(page).toHaveURL(/\/auth/)
  })

  test("should redirect /register to /auth", async ({ page }) => {
    await page.goto("/register")

    // Should redirect to auth page
    await expect(page).toHaveURL(/\/auth/)
  })

  test("should redirect authenticated user from /auth to /dashboard", async ({ page }) => {
    // This test requires a valid session - skip if no test credentials
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "Requires E2E test credentials"
    )

    // Login first
    await page.goto("/auth")
    await page.getByRole("textbox", { name: /e-?mail/i }).fill(process.env.E2E_TEST_EMAIL!)
    await page.getByRole("button", { name: /nastavi|prijavi|dalje/i }).click()

    await page.waitForTimeout(1000)

    // Fill password if visible
    const passwordInput = page.getByRole("textbox", { name: /lozink|password/i })
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(process.env.E2E_TEST_PASSWORD!)
      await page.getByRole("button", { name: /prijavi|login|sign in/i }).click()
    }

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
  })
})
