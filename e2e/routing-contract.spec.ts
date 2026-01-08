// e2e/routing-contract.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Tests: Unified Auth Routing Contract
 *
 * Verifies the new routing contract:
 * - fiskai.hr/login → redirects to app.fiskai.hr/auth
 * - admin.fiskai.hr/* → 308 to app.fiskai.hr/admin/*
 * - staff.fiskai.hr/* → 308 to app.fiskai.hr/staff/*
 * - app.fiskai.hr (unauth) → redirects to app.fiskai.hr/auth
 *
 * Note: Set PLAYWRIGHT_PROD_URL=https://fiskai.hr to test production
 */

const PROD_BASE = process.env.PLAYWRIGHT_PROD_URL || ""

// Skip these tests unless PLAYWRIGHT_PROD_URL is set
const runProdTests = !!PROD_BASE

test.describe("Unified Auth Routing Contract", () => {
  test.describe.configure({ mode: "serial" })

  test.describe("Marketing → App Auth Redirect", () => {
    test.skip(!runProdTests, "PLAYWRIGHT_PROD_URL not set")

    test("fiskai.hr/login redirects to app.fiskai.hr/auth", async ({ page }) => {
      const response = await page.goto(`${PROD_BASE}/login`, {
        waitUntil: "commit",
      })

      // Should redirect (not 200)
      const status = response?.status()
      expect([301, 302, 307, 308]).toContain(status)

      // Final URL should be app.fiskai.hr/auth
      await page.waitForURL(/app\.fiskai\.hr\/auth/)
      expect(page.url()).toContain("app.fiskai.hr/auth")
    })
  })

  test.describe("Legacy Subdomain 308 Redirects", () => {
    test.skip(!runProdTests, "PLAYWRIGHT_PROD_URL not set")

    test("admin.fiskai.hr redirects to app.fiskai.hr/admin", async ({
      request,
    }) => {
      const response = await request.get("https://admin.fiskai.hr/", {
        maxRedirects: 0,
      })

      expect(response.status()).toBe(308)
      expect(response.headers()["location"]).toContain("app.fiskai.hr/admin")
    })

    test("staff.fiskai.hr redirects to app.fiskai.hr/staff", async ({
      request,
    }) => {
      const response = await request.get("https://staff.fiskai.hr/", {
        maxRedirects: 0,
      })

      expect(response.status()).toBe(308)
      expect(response.headers()["location"]).toContain("app.fiskai.hr/staff")
    })

    test("admin.fiskai.hr/tenants preserves path", async ({ request }) => {
      const response = await request.get("https://admin.fiskai.hr/tenants", {
        maxRedirects: 0,
      })

      expect(response.status()).toBe(308)
      expect(response.headers()["location"]).toBe(
        "https://app.fiskai.hr/admin/tenants"
      )
    })
  })

  test.describe("App Subdomain Auth Redirect", () => {
    test.skip(!runProdTests, "PLAYWRIGHT_PROD_URL not set")

    test("app.fiskai.hr (unauth) redirects to auth", async ({ request }) => {
      const response = await request.get("https://app.fiskai.hr/", {
        maxRedirects: 0,
      })

      // Should redirect to auth
      expect([301, 302, 307, 308]).toContain(response.status())
      expect(response.headers()["location"]).toContain("app.fiskai.hr/auth")
    })
  })
})
