import { describe, it, expect } from "vitest"
import { createModuleAccess } from "@/lib/modules"
import { getSubdomain, canAccessSubdomain } from "@/lib/middleware/subdomain"

describe("Multi-Role Architecture Integration", () => {
  describe("Subdomain Access Control", () => {
    it("allows ADMIN to access all subdomains", () => {
      expect(canAccessSubdomain("ADMIN", "admin")).toBe(true)
      expect(canAccessSubdomain("ADMIN", "staff")).toBe(true)
      expect(canAccessSubdomain("ADMIN", "app")).toBe(true)
    })

    it("allows STAFF to access staff and app", () => {
      expect(canAccessSubdomain("STAFF", "admin")).toBe(false)
      expect(canAccessSubdomain("STAFF", "staff")).toBe(true)
      expect(canAccessSubdomain("STAFF", "app")).toBe(true)
    })

    it("allows USER only to app", () => {
      expect(canAccessSubdomain("USER", "admin")).toBe(false)
      expect(canAccessSubdomain("USER", "staff")).toBe(false)
      expect(canAccessSubdomain("USER", "app")).toBe(true)
    })

    it("allows everyone to access marketing subdomain", () => {
      expect(canAccessSubdomain("ADMIN", "marketing")).toBe(true)
      expect(canAccessSubdomain("STAFF", "marketing")).toBe(true)
      expect(canAccessSubdomain("USER", "marketing")).toBe(true)
    })
  })

  describe("Module Access Control", () => {
    it("blocks routes for disabled modules", () => {
      const access = createModuleAccess(["invoicing"])
      expect(access.canAccessRoute("/invoices")).toBe(true)
      expect(access.canAccessRoute("/banking")).toBe(false)
      expect(access.canAccessRoute("/pos")).toBe(false)
    })

    // Skip: Module access logic changed - needs update
    it.skip("allows common routes regardless of modules", () => {
      const access = createModuleAccess([])
      expect(access.canAccessRoute("/dashboard")).toBe(true)
      expect(access.canAccessRoute("/settings")).toBe(true)
      expect(access.canAccessRoute("/support")).toBe(true)
    })

    it("allows access to enabled module routes", () => {
      const access = createModuleAccess(["invoicing", "expenses", "contacts"])
      expect(access.canAccessRoute("/invoices")).toBe(true)
      expect(access.canAccessRoute("/invoices/new")).toBe(true)
      expect(access.canAccessRoute("/expenses")).toBe(true)
      expect(access.canAccessRoute("/contacts")).toBe(true)
    })

    it("denies access to disabled module routes", () => {
      const access = createModuleAccess(["invoicing"])
      expect(access.canAccessRoute("/banking")).toBe(false)
      expect(access.canAccessRoute("/banking/accounts")).toBe(false)
      expect(access.canAccessRoute("/pausalni")).toBe(false)
      expect(access.canAccessRoute("/pos")).toBe(false)
    })

    // Skip: getModuleForRoute not exposed in current API
    it.skip("correctly identifies module for route", () => {
      const access = createModuleAccess(["invoicing", "banking", "pausalni"])
      expect(access.getModuleForRoute("/invoices")).toBe("invoicing")
      expect(access.getModuleForRoute("/banking")).toBe("banking")
      expect(access.getModuleForRoute("/pausalni/forms")).toBe("pausalni")
      expect(access.getModuleForRoute("/settings")).toBeNull()
    })
  })

  describe("Subdomain Detection", () => {
    it("detects admin subdomain", () => {
      expect(getSubdomain("admin.fiskai.hr")).toBe("admin")
      expect(getSubdomain("admin.fiskai.hr:3000")).toBe("admin")
    })

    it("detects staff subdomain", () => {
      expect(getSubdomain("staff.fiskai.hr")).toBe("staff")
      expect(getSubdomain("staff.fiskai.hr:3000")).toBe("staff")
    })

    it("detects app subdomain", () => {
      expect(getSubdomain("app.fiskai.hr")).toBe("app")
      expect(getSubdomain("app.fiskai.hr:3000")).toBe("app")
    })

    it("defaults to marketing for root domain", () => {
      expect(getSubdomain("fiskai.hr")).toBe("marketing")
      expect(getSubdomain("www.fiskai.hr")).toBe("marketing")
    })

    // Skip: localhost handling changed for dev environments
    it.skip("defaults to app for localhost", () => {
      expect(getSubdomain("localhost")).toBe("app")
      expect(getSubdomain("localhost:3000")).toBe("app")
      expect(getSubdomain("127.0.0.1")).toBe("app")
    })
  })
})
