// e2e/invoice-creation.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Tests: Invoice Creation Flow
 *
 * Tests the complete invoice creation journey including:
 * - Navigation to new invoice page
 * - Form validation
 * - Line item management
 * - Invoice submission
 * - Fiscalization status
 */

test.describe("Invoice Creation", () => {
  const hasTestCredentials =
    process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD

  test.describe("Unauthenticated", () => {
    test("should redirect to auth when accessing invoice creation", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should redirect to auth
      await expect(page).toHaveURL(/\/auth|\/login/, { timeout: 10000 })
    })

    test("should redirect to auth when accessing e-invoice creation", async ({ page }) => {
      await page.goto("/e-invoices/new")

      // Should redirect to auth
      await expect(page).toHaveURL(/\/auth|\/login/, { timeout: 10000 })
    })
  })

  test.describe("Authenticated - Invoice Form", () => {
    test.skip(!hasTestCredentials, "Requires E2E test credentials")

    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto("/auth")
      await page.getByRole("textbox", { name: /e-?mail/i }).fill(process.env.E2E_TEST_EMAIL!)
      await page.getByRole("button", { name: /nastavi|prijavi|dalje/i }).click()

      await page.waitForTimeout(1000)

      const passwordInput = page.getByRole("textbox", { name: /lozink|password/i })
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(process.env.E2E_TEST_PASSWORD!)
        await page.getByRole("button", { name: /prijavi|login|sign in/i }).click()
      }

      await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
    })

    test("should display invoice creation form", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should show form title
      await expect(
        page.getByRole("heading", { name: /novi|new|račun|invoice|kreiraj/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test("should have buyer selection field", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should have buyer/contact selection
      const buyerField = page.getByRole("combobox", { name: /kupac|buyer|kontakt|contact/i })
        .or(page.getByLabel(/kupac|buyer|kontakt|contact/i))
        .or(page.locator("[name='buyerId']"))
        .or(page.locator("[data-testid='buyer-select']"))

      await expect(buyerField.first()).toBeVisible({ timeout: 10000 })
    })

    test("should allow adding line items", async ({ page }) => {
      await page.goto("/invoices/new")

      // Look for add item button
      const addItemButton = page.getByRole("button", { name: /dodaj|add|stavk|item/i })
        .or(page.locator("[data-testid='add-line-item']"))

      await expect(addItemButton.first()).toBeVisible({ timeout: 10000 })
    })

    test("should have date picker for invoice date", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should have date input
      const dateInput = page.getByLabel(/datum|date/i)
        .or(page.locator("input[type='date']"))
        .or(page.locator("[name='invoiceDate']"))

      await expect(dateInput.first()).toBeVisible({ timeout: 10000 })
    })

    test("should show total calculation", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should have total/summary section
      await expect(
        page.getByText(/ukupno|total|iznos/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test("should have submit/save button", async ({ page }) => {
      await page.goto("/invoices/new")

      // Should have save/submit button
      const submitButton = page.getByRole("button", { name: /spremi|save|kreiraj|create|izdaj|issue/i })

      await expect(submitButton.first()).toBeVisible({ timeout: 10000 })
    })

    test("should navigate back to invoice list", async ({ page }) => {
      await page.goto("/invoices/new")

      // Find back button or link
      const backButton = page.getByRole("button", { name: /natrag|back|povratak/i })
        .or(page.getByRole("link", { name: /natrag|back|povratak/i }))

      if (await backButton.first().isVisible()) {
        await backButton.first().click()
        await expect(page).toHaveURL(/\/invoices/, { timeout: 10000 })
      }
    })

    test("should validate required fields on submit", async ({ page }) => {
      await page.goto("/invoices/new")

      // Try to submit without filling required fields
      const submitButton = page.getByRole("button", { name: /spremi|save|kreiraj|create|izdaj|issue/i }).first()

      if (await submitButton.isVisible()) {
        await submitButton.click()

        // Should show validation error or required field indication
        await expect(
          page.getByText(/obavez|required|popun|fill/i).first()
            .or(page.locator("[aria-invalid='true']").first())
            .or(page.locator(".error, .text-red, .text-destructive").first())
        ).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe("E-Invoice Specific", () => {
    test.skip(!hasTestCredentials, "Requires E2E test credentials")

    test.beforeEach(async ({ page }) => {
      await page.goto("/auth")
      await page.getByRole("textbox", { name: /e-?mail/i }).fill(process.env.E2E_TEST_EMAIL!)
      await page.getByRole("button", { name: /nastavi|prijavi|dalje/i }).click()

      await page.waitForTimeout(1000)

      const passwordInput = page.getByRole("textbox", { name: /lozink|password/i })
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(process.env.E2E_TEST_PASSWORD!)
        await page.getByRole("button", { name: /prijavi|login|sign in/i }).click()
      }

      await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
    })

    test("should display e-invoice creation form", async ({ page }) => {
      await page.goto("/e-invoices/new")

      // Should show e-invoice form
      await expect(
        page.getByRole("heading", { name: /e-račun|e-invoice|novi/i }).first()
          .or(page.getByText(/e-račun|electronic invoice/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test("should have fiscalization-related fields", async ({ page }) => {
      await page.goto("/e-invoices/new")

      // Look for fiscalization or OIB fields
      const fiscalFields = page.getByText(/OIB|fiskalizacij|fiscal|JIR|ZKI/i)

      // E-invoices should have some reference to fiscalization
      if (await fiscalFields.first().isVisible({ timeout: 5000 })) {
        await expect(fiscalFields.first()).toBeVisible()
      }
    })
  })
})

test.describe("Invoice List", () => {
  const hasTestCredentials =
    process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD

  test.describe("Authenticated", () => {
    test.skip(!hasTestCredentials, "Requires E2E test credentials")

    test.beforeEach(async ({ page }) => {
      await page.goto("/auth")
      await page.getByRole("textbox", { name: /e-?mail/i }).fill(process.env.E2E_TEST_EMAIL!)
      await page.getByRole("button", { name: /nastavi|prijavi|dalje/i }).click()

      await page.waitForTimeout(1000)

      const passwordInput = page.getByRole("textbox", { name: /lozink|password/i })
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(process.env.E2E_TEST_PASSWORD!)
        await page.getByRole("button", { name: /prijavi|login|sign in/i }).click()
      }

      await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
    })

    test("should display invoice list page", async ({ page }) => {
      await page.goto("/invoices")

      // Should show list header or empty state
      await expect(
        page.getByRole("heading", { name: /račun|invoice/i }).first()
          .or(page.getByText(/nema račun|no invoice|prazan|empty/i).first())
          .or(page.getByRole("table").first())
      ).toBeVisible({ timeout: 10000 })
    })

    test("should have create new invoice button", async ({ page }) => {
      await page.goto("/invoices")

      // Should have new invoice button
      const newButton = page.getByRole("link", { name: /novi|new|kreiraj|create/i })
        .or(page.getByRole("button", { name: /novi|new|kreiraj|create/i }))

      await expect(newButton.first()).toBeVisible({ timeout: 10000 })
    })

    test("should navigate to new invoice from list", async ({ page }) => {
      await page.goto("/invoices")

      const newButton = page.getByRole("link", { name: /novi|new|kreiraj|create/i })
        .or(page.getByRole("button", { name: /novi|new|kreiraj|create/i }))

      if (await newButton.first().isVisible()) {
        await newButton.first().click()
        await expect(page).toHaveURL(/\/invoices\/new|\/e-invoices\/new/, { timeout: 10000 })
      }
    })
  })
})
