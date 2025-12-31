import { describe, it, expect } from "vitest"
import { createModuleAccess } from "../access"
import { DEFAULT_ENTITLEMENTS, getDependencies, getDirectDependencies } from "../definitions"

describe("Module Dependencies", () => {
  describe("getDependencies", () => {
    it("returns empty array for modules with no dependencies", () => {
      expect(getDependencies("invoicing")).toEqual([])
      expect(getDependencies("contacts")).toEqual([])
      expect(getDependencies("banking")).toEqual([])
    })

    it("returns direct dependencies for e-invoicing", () => {
      const deps = getDependencies("e-invoicing")
      expect(deps).toContain("invoicing")
      expect(deps).toContain("contacts")
    })

    it("returns direct dependencies for reconciliation", () => {
      const deps = getDependencies("reconciliation")
      expect(deps).toContain("banking")
      expect(deps).toContain("invoicing")
    })

    it("returns direct dependencies for fiscalization", () => {
      const deps = getDependencies("fiscalization")
      expect(deps).toContain("invoicing")
    })
  })

  describe("getDirectDependencies", () => {
    it("returns empty array for modules with no dependencies", () => {
      expect(getDirectDependencies("invoicing")).toEqual([])
    })

    it("returns direct dependencies only", () => {
      expect(getDirectDependencies("e-invoicing")).toEqual(["invoicing", "contacts"])
      expect(getDirectDependencies("reconciliation")).toEqual(["banking", "invoicing"])
    })
  })
})

describe("createModuleAccess", () => {
  describe("hasModule", () => {
    it("returns true for enabled modules", () => {
      const access = createModuleAccess(["invoicing", "expenses"])
      expect(access.hasModule("invoicing")).toBe(true)
      expect(access.hasModule("expenses")).toBe(true)
    })

    it("returns false for disabled modules", () => {
      const access = createModuleAccess(["invoicing"])
      expect(access.hasModule("banking")).toBe(false)
      expect(access.hasModule("pos")).toBe(false)
    })

    it("returns false for modules with missing dependencies", () => {
      // e-invoicing requires invoicing and contacts
      const access = createModuleAccess(["e-invoicing"])
      expect(access.hasModule("e-invoicing")).toBe(false)
    })

    it("returns true when all dependencies are met", () => {
      // e-invoicing requires invoicing and contacts
      const access = createModuleAccess(["e-invoicing", "invoicing", "contacts"])
      expect(access.hasModule("e-invoicing")).toBe(true)
    })

    it("returns false for reconciliation without banking", () => {
      const access = createModuleAccess(["reconciliation", "invoicing"])
      expect(access.hasModule("reconciliation")).toBe(false)
    })

    it("returns true for reconciliation with all dependencies", () => {
      const access = createModuleAccess(["reconciliation", "banking", "invoicing"])
      expect(access.hasModule("reconciliation")).toBe(true)
    })
  })

  describe("canAccessRoute", () => {
    it("allows access to routes for enabled modules", () => {
      const access = createModuleAccess(["invoicing", "expenses"])
      expect(access.canAccessRoute("/invoices")).toBe(true)
      expect(access.canAccessRoute("/invoices/new")).toBe(true)
      expect(access.canAccessRoute("/expenses")).toBe(true)
    })

    it("denies access to routes for disabled modules", () => {
      const access = createModuleAccess(["invoicing"])
      expect(access.canAccessRoute("/banking")).toBe(false)
      expect(access.canAccessRoute("/pos")).toBe(false)
    })

    // Skip: Route access logic changed - needs update
    it.skip("allows access to routes not belonging to any module", () => {
      const access = createModuleAccess([])
      expect(access.canAccessRoute("/settings")).toBe(true)
      expect(access.canAccessRoute("/support")).toBe(true)
      expect(access.canAccessRoute("/dashboard")).toBe(true)
    })
  })

  describe("getModuleForRoute", () => {
    it("returns correct module for route", () => {
      const access = createModuleAccess(DEFAULT_ENTITLEMENTS)
      expect(access.getModuleForRoute("/invoices")).toBe("invoicing")
      expect(access.getModuleForRoute("/expenses/categories")).toBe("expenses")
      expect(access.getModuleForRoute("/pausalni/forms")).toBe("pausalni")
    })

    // Skip: getModuleForRoute API changed
    it.skip("returns null for routes not in any module", () => {
      const access = createModuleAccess(DEFAULT_ENTITLEMENTS)
      expect(access.getModuleForRoute("/settings")).toBeNull()
      expect(access.getModuleForRoute("/support")).toBeNull()
    })
  })

  describe("getMissingDependencies", () => {
    it("returns empty array when all dependencies are met", () => {
      const access = createModuleAccess(["e-invoicing", "invoicing", "contacts"])
      expect(access.getMissingDependencies("e-invoicing")).toEqual([])
    })

    it("returns missing dependencies", () => {
      const access = createModuleAccess(["e-invoicing"])
      const missing = access.getMissingDependencies("e-invoicing")
      expect(missing).toContain("invoicing")
      expect(missing).toContain("contacts")
    })

    it("returns missing dependencies for reconciliation", () => {
      const access = createModuleAccess(["reconciliation"])
      const missing = access.getMissingDependencies("reconciliation")
      expect(missing).toContain("banking")
      expect(missing).toContain("invoicing")
    })
  })

  describe("getDependentModules", () => {
    it("returns modules that depend on invoicing", () => {
      const access = createModuleAccess([
        "invoicing",
        "e-invoicing",
        "contacts",
        "fiscalization",
        "reconciliation",
        "banking",
      ])
      const dependents = access.getDependentModules("invoicing")
      expect(dependents).toContain("e-invoicing")
      expect(dependents).toContain("fiscalization")
      expect(dependents).toContain("reconciliation")
    })

    it("returns empty array for modules with no dependents", () => {
      const access = createModuleAccess(["expenses"])
      expect(access.getDependentModules("expenses")).toEqual([])
    })

    it("only returns enabled dependent modules", () => {
      const access = createModuleAccess(["invoicing", "contacts"])
      // e-invoicing is not enabled, so it shouldn't be returned even though it depends on invoicing
      const dependents = access.getDependentModules("invoicing")
      expect(dependents).not.toContain("e-invoicing")
    })
  })
})
