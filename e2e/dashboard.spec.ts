// e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Tests: Dashboard
 *
 * Tests the dashboard functionality including:
 * - Page load and accessibility
 * - Key metrics display
 * - Navigation elements
 * - Quick action cards
 */

test.describe("Dashboard", () => {
  // Skip tests that require authentication if no test credentials
  const hasTestCredentials =
    process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD

  test.describe("Unauthenticated", () => {
    test("should redirect to auth when not logged in", async ({ page }) => {
      await page.goto("/dashboard")

      // Should redirect to auth page
      await expect(page).toHaveURL(/\/auth|\/login/, { timeout: 10000 })
    })
  })

  test.describe("Authenticated", () => {
    test.skip(!hasTestCredentials, "Requires E2E test credentials")

    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto("/auth")
      await page.getByRole("textbox", { name: /e-?mail/i }).fill(process.env.E2E_TEST_EMAIL!)
      await page.getByRole("button", { name: /nastavi|prijavi|dalje/i }).click()

      await page.waitForTimeout(1000)

      const passwordInput = page.getByRole("textbox", { name: /lozink|password/i })
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(process.env.E2E_TEST_PASSWORD!)
        await page.getByRole("button", { name: /prijavi|login|sign in/i }).click()
      }

      // Wait for dashboard or onboarding
      await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
    })

    test("should display dashboard with key metrics", async ({ page }) => {
      // Navigate to dashboard if on onboarding
      if (page.url().includes("onboarding")) {
        await page.goto("/dashboard")
      }

      // Should have revenue or statistics section
      await expect(
        page.getByText(/prihod|revenue|statistika|e-račun/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test("should have navigation sidebar with key links", async ({ page }) => {
      if (page.url().includes("onboarding")) {
        await page.goto("/dashboard")
      }

      // Check for main navigation items
      const nav = page.locator("nav, aside, [role='navigation']")
      await expect(nav).toBeVisible()

      // Should have links to main sections
      const invoicesLink = page.getByRole("link", { name: /račun|invoice|faktur/i }).first()
      const contactsLink = page.getByRole("link", { name: /kontakt|contact|kupci/i }).first()
      const productsLink = page.getByRole("link", { name: /proizvod|product|artikl/i }).first()

      // At least one navigation link should be present
      await expect(invoicesLink.or(contactsLink).or(productsLink)).toBeVisible()
    })

    test("should navigate to invoices from dashboard", async ({ page }) => {
      if (page.url().includes("onboarding")) {
        await page.goto("/dashboard")
      }

      // Find and click invoices link
      const invoicesLink = page.getByRole("link", { name: /račun|invoice|faktur/i }).first()
      if (await invoicesLink.isVisible()) {
        await invoicesLink.click()
        await expect(page).toHaveURL(/\/invoices|\/e-invoices/, { timeout: 10000 })
      }
    })

    test("should have quick action buttons", async ({ page }) => {
      if (page.url().includes("onboarding")) {
        await page.goto("/dashboard")
      }

      // Look for action buttons/cards
      const newInvoiceButton = page.getByRole("link", { name: /novi račun|new invoice|kreiraj/i })
      const actionCard = page.locator("[data-testid='action-card']")

      // Should have either action button or action cards
      await expect(newInvoiceButton.or(actionCard).first()).toBeVisible({ timeout: 10000 })
    })

    test("should show user greeting or company name", async ({ page }) => {
      if (page.url().includes("onboarding")) {
        await page.goto("/dashboard")
      }

      // Should show personalized greeting or company identifier
      await expect(
        page.getByText(/dobrodošl|pozdrav|dashboard|pregled/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })
})

test.describe("Dashboard - Visual Smoke Tests", () => {
  test("should load dashboard page structure", async ({ page }) => {
    // Go to dashboard - will redirect to auth if not logged in
    const response = await page.goto("/dashboard")

    // Should get a valid response (either dashboard or redirect to auth)
    expect(response?.status()).toBeLessThan(500)
  })
})
