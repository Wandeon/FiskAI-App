import { describe, it, expect, vi } from "vitest"

// Mock database - this test only tests pure functions
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import {
  canAccessSubdomain,
  canAccessPath,
  getAvailablePaths,
  getAvailableSubdomains,
  hasMultipleRoles,
  shouldShowRoleSelection,
} from "../system-role"

describe("System Role Tests", () => {
  describe("Subdomain Access (path-based architecture)", () => {
    it("all roles can access app subdomain", () => {
      expect(canAccessSubdomain("ADMIN", "app")).toBe(true)
      expect(canAccessSubdomain("STAFF", "app")).toBe(true)
      expect(canAccessSubdomain("USER", "app")).toBe(true)
    })

    it("all roles can access marketing subdomain (public)", () => {
      expect(canAccessSubdomain("ADMIN", "marketing")).toBe(true)
      expect(canAccessSubdomain("STAFF", "marketing")).toBe(true)
      expect(canAccessSubdomain("USER", "marketing")).toBe(true)
    })

    it("rejects invalid subdomains", () => {
      // admin/staff subdomains no longer exist
      expect(canAccessSubdomain("ADMIN", "admin")).toBe(false)
      expect(canAccessSubdomain("ADMIN", "staff")).toBe(false)
      expect(canAccessSubdomain("STAFF", "staff")).toBe(false)
      expect(canAccessSubdomain("USER", "unknown")).toBe(false)
    })
  })

  describe("Path-based Access Control", () => {
    it("ADMIN can access all paths", () => {
      expect(canAccessPath("ADMIN", "/admin")).toBe(true)
      expect(canAccessPath("ADMIN", "/admin/tenants")).toBe(true)
      expect(canAccessPath("ADMIN", "/staff")).toBe(true)
      expect(canAccessPath("ADMIN", "/staff/clients")).toBe(true)
      expect(canAccessPath("ADMIN", "/dashboard")).toBe(true)
    })

    it("STAFF can access staff and regular paths", () => {
      expect(canAccessPath("STAFF", "/admin")).toBe(false)
      expect(canAccessPath("STAFF", "/admin/tenants")).toBe(false)
      expect(canAccessPath("STAFF", "/staff")).toBe(true)
      expect(canAccessPath("STAFF", "/staff/clients")).toBe(true)
      expect(canAccessPath("STAFF", "/dashboard")).toBe(true)
    })

    it("USER can only access regular paths", () => {
      expect(canAccessPath("USER", "/admin")).toBe(false)
      expect(canAccessPath("USER", "/staff")).toBe(false)
      expect(canAccessPath("USER", "/dashboard")).toBe(true)
      expect(canAccessPath("USER", "/invoices")).toBe(true)
    })
  })

  describe("Available Paths/Subdomains", () => {
    it("getAvailablePaths returns correct paths for each role", () => {
      expect(getAvailablePaths("ADMIN")).toEqual(["/admin", "/staff", "/dashboard"])
      expect(getAvailablePaths("STAFF")).toEqual(["/staff", "/dashboard"])
      expect(getAvailablePaths("USER")).toEqual(["/dashboard"])
    })

    it("getAvailableSubdomains returns only app (deprecated)", () => {
      // All roles now use app subdomain only
      expect(getAvailableSubdomains("ADMIN")).toEqual(["app"])
      expect(getAvailableSubdomains("STAFF")).toEqual(["app"])
      expect(getAvailableSubdomains("USER")).toEqual(["app"])
    })
  })

  describe("Multi-role helpers", () => {
    it("hasMultipleRoles works correctly", () => {
      expect(hasMultipleRoles("ADMIN")).toBe(true)
      expect(hasMultipleRoles("STAFF")).toBe(true)
      expect(hasMultipleRoles("USER")).toBe(false)
    })

    it("shouldShowRoleSelection works correctly", async () => {
      expect(await shouldShowRoleSelection("id1", "ADMIN")).toBe(true)
      expect(await shouldShowRoleSelection("id2", "STAFF")).toBe(true)
      expect(await shouldShowRoleSelection("id3", "USER")).toBe(false)
    })
  })
})
