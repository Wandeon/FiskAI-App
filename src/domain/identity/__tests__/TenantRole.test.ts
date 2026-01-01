// src/domain/identity/__tests__/TenantRole.test.ts
import { describe, it, expect } from "vitest"
import { TenantRole } from "../TenantRole"

describe("TenantRole", () => {
  describe("values", () => {
    it("returns all role values", () => {
      const values = TenantRole.values()
      expect(values).toContain("OWNER")
      expect(values).toContain("ADMIN")
      expect(values).toContain("MEMBER")
      expect(values).toContain("ACCOUNTANT")
      expect(values).toContain("VIEWER")
      expect(values.length).toBe(5)
    })

    it("returns a readonly array", () => {
      const values = TenantRole.values()
      expect(Array.isArray(values)).toBe(true)
    })
  })

  describe("isValid", () => {
    it("returns true for valid roles", () => {
      expect(TenantRole.isValid("OWNER")).toBe(true)
      expect(TenantRole.isValid("ADMIN")).toBe(true)
      expect(TenantRole.isValid("MEMBER")).toBe(true)
      expect(TenantRole.isValid("ACCOUNTANT")).toBe(true)
      expect(TenantRole.isValid("VIEWER")).toBe(true)
    })

    it("returns false for invalid roles", () => {
      expect(TenantRole.isValid("INVALID")).toBe(false)
      expect(TenantRole.isValid("owner")).toBe(false) // Case sensitive
      expect(TenantRole.isValid("")).toBe(false)
      expect(TenantRole.isValid("SUPER_ADMIN")).toBe(false)
    })
  })

  describe("hasPermission", () => {
    describe("OWNER permissions", () => {
      it("has all permissions including delete_tenant", () => {
        expect(TenantRole.hasPermission("OWNER", "delete_tenant")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "manage_members")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "manage_settings")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "view_invoices")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "create_invoices")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "edit_invoices")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "delete_invoices")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "view_reports")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "export_data")).toBe(true)
        expect(TenantRole.hasPermission("OWNER", "manage_integrations")).toBe(true)
      })
    })

    describe("ADMIN permissions", () => {
      it("has all permissions except delete_tenant", () => {
        expect(TenantRole.hasPermission("ADMIN", "delete_tenant")).toBe(false)
        expect(TenantRole.hasPermission("ADMIN", "manage_members")).toBe(true)
        expect(TenantRole.hasPermission("ADMIN", "manage_settings")).toBe(true)
        expect(TenantRole.hasPermission("ADMIN", "view_invoices")).toBe(true)
        expect(TenantRole.hasPermission("ADMIN", "delete_invoices")).toBe(true)
      })
    })

    describe("MEMBER permissions", () => {
      it("has standard business operations", () => {
        expect(TenantRole.hasPermission("MEMBER", "view_invoices")).toBe(true)
        expect(TenantRole.hasPermission("MEMBER", "create_invoices")).toBe(true)
        expect(TenantRole.hasPermission("MEMBER", "edit_invoices")).toBe(true)
        expect(TenantRole.hasPermission("MEMBER", "view_reports")).toBe(true)
      })

      it("cannot manage members or settings", () => {
        expect(TenantRole.hasPermission("MEMBER", "manage_members")).toBe(false)
        expect(TenantRole.hasPermission("MEMBER", "manage_settings")).toBe(false)
        expect(TenantRole.hasPermission("MEMBER", "delete_invoices")).toBe(false)
      })
    })

    describe("ACCOUNTANT permissions", () => {
      it("has financial view and export permissions", () => {
        expect(TenantRole.hasPermission("ACCOUNTANT", "view_invoices")).toBe(true)
        expect(TenantRole.hasPermission("ACCOUNTANT", "view_reports")).toBe(true)
        expect(TenantRole.hasPermission("ACCOUNTANT", "export_data")).toBe(true)
      })

      it("cannot create or edit invoices", () => {
        expect(TenantRole.hasPermission("ACCOUNTANT", "create_invoices")).toBe(false)
        expect(TenantRole.hasPermission("ACCOUNTANT", "edit_invoices")).toBe(false)
        expect(TenantRole.hasPermission("ACCOUNTANT", "delete_invoices")).toBe(false)
      })
    })

    describe("VIEWER permissions", () => {
      it("has read-only permissions", () => {
        expect(TenantRole.hasPermission("VIEWER", "view_invoices")).toBe(true)
        expect(TenantRole.hasPermission("VIEWER", "view_reports")).toBe(true)
      })

      it("cannot modify anything", () => {
        expect(TenantRole.hasPermission("VIEWER", "create_invoices")).toBe(false)
        expect(TenantRole.hasPermission("VIEWER", "edit_invoices")).toBe(false)
        expect(TenantRole.hasPermission("VIEWER", "export_data")).toBe(false)
        expect(TenantRole.hasPermission("VIEWER", "manage_members")).toBe(false)
      })
    })

    it("returns false for unknown permission", () => {
      expect(TenantRole.hasPermission("OWNER", "unknown_permission")).toBe(false)
    })

    it("returns false for unknown role", () => {
      expect(TenantRole.hasPermission("UNKNOWN" as "OWNER", "view_invoices")).toBe(false)
    })
  })

  describe("compare", () => {
    it("returns positive when first role is higher", () => {
      expect(TenantRole.compare("OWNER", "ADMIN")).toBeGreaterThan(0)
      expect(TenantRole.compare("ADMIN", "MEMBER")).toBeGreaterThan(0)
      expect(TenantRole.compare("MEMBER", "ACCOUNTANT")).toBeGreaterThan(0)
      expect(TenantRole.compare("ACCOUNTANT", "VIEWER")).toBeGreaterThan(0)
    })

    it("returns negative when first role is lower", () => {
      expect(TenantRole.compare("VIEWER", "OWNER")).toBeLessThan(0)
      expect(TenantRole.compare("ACCOUNTANT", "MEMBER")).toBeLessThan(0)
      expect(TenantRole.compare("MEMBER", "ADMIN")).toBeLessThan(0)
      expect(TenantRole.compare("ADMIN", "OWNER")).toBeLessThan(0)
    })

    it("returns zero for same roles", () => {
      expect(TenantRole.compare("OWNER", "OWNER")).toBe(0)
      expect(TenantRole.compare("VIEWER", "VIEWER")).toBe(0)
    })

    it("OWNER is highest in hierarchy", () => {
      for (const role of TenantRole.values()) {
        if (role !== "OWNER") {
          expect(TenantRole.compare("OWNER", role as "ADMIN")).toBeGreaterThan(0)
        }
      }
    })

    it("VIEWER is lowest in hierarchy", () => {
      for (const role of TenantRole.values()) {
        if (role !== "VIEWER") {
          expect(TenantRole.compare("VIEWER", role as "OWNER")).toBeLessThan(0)
        }
      }
    })
  })

  describe("constants", () => {
    it("exports role constants", () => {
      expect(TenantRole.OWNER).toBe("OWNER")
      expect(TenantRole.ADMIN).toBe("ADMIN")
      expect(TenantRole.MEMBER).toBe("MEMBER")
      expect(TenantRole.ACCOUNTANT).toBe("ACCOUNTANT")
      expect(TenantRole.VIEWER).toBe("VIEWER")
    })
  })
})
