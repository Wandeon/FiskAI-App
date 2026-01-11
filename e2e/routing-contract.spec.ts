// e2e/routing-contract.spec.ts
import { test, expect } from "@playwright/test"

/**
 * E2E Tests: Unified Auth Routing Contract
 *
 * Verifies the routing contract (2026-01):
 * - www.fiskai.hr → marketing site
 * - app.fiskai.hr → app with path-based portals (/admin, /staff)
 * - app.fiskai.hr (unauth) → redirects to app.fiskai.hr/auth
 *
 * Legacy subdomains (admin.fiskai.hr, staff.fiskai.hr) have been permanently
 * removed. DNS records do not exist. See docs/architecture/DOMAIN_OWNERSHIP.md.
 *
 * Note: Set PLAYWRIGHT_PROD_URL=https://app.fiskai.hr to test production
 */

const PROD_BASE = process.env.PLAYWRIGHT_PROD_URL || ""

// Skip these tests unless PLAYWRIGHT_PROD_URL is set
const runProdTests = !!PROD_BASE

test.describe("Unified Auth Routing Contract", () => {
  test.describe.configure({ mode: "serial" })

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

    test("app.fiskai.hr/admin (unauth) redirects to auth", async ({ request }) => {
      const response = await request.get("https://app.fiskai.hr/admin", {
        maxRedirects: 0,
      })

      // Should redirect to auth with callback
      expect([301, 302, 307, 308]).toContain(response.status())
      expect(response.headers()["location"]).toContain("app.fiskai.hr/auth")
    })

    test("app.fiskai.hr/staff (unauth) redirects to auth", async ({ request }) => {
      const response = await request.get("https://app.fiskai.hr/staff", {
        maxRedirects: 0,
      })

      // Should redirect to auth with callback
      expect([301, 302, 307, 308]).toContain(response.status())
      expect(response.headers()["location"]).toContain("app.fiskai.hr/auth")
    })
  })

  test.describe("Auth Pages Are Public", () => {
    test.skip(!runProdTests, "PLAYWRIGHT_PROD_URL not set")

    test("app.fiskai.hr/auth returns 200", async ({ request }) => {
      const response = await request.get("https://app.fiskai.hr/auth")

      // Auth page should load without redirect loop
      expect(response.status()).toBe(200)
    })
  })

  test.describe("Health Endpoint", () => {
    test.skip(!runProdTests, "PLAYWRIGHT_PROD_URL not set")

    test("app.fiskai.hr/api/health returns 200", async ({ request }) => {
      const response = await request.get("https://app.fiskai.hr/api/health")

      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(body.status).toBe("ok")
    })
  })
})
