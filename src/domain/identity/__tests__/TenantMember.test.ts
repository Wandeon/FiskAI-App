// src/domain/identity/__tests__/TenantMember.test.ts
import { describe, it, expect, vi } from "vitest"
import { TenantMember } from "../TenantMember"
import { TenantRole } from "../TenantRole"
import { IdentityError } from "../IdentityError"

describe("TenantMember", () => {
  describe("create", () => {
    it("creates a member with valid userId and role", () => {
      const member = TenantMember.create("user-123", TenantRole.MEMBER)
      expect(member.userId).toBe("user-123")
      expect(member.role).toBe(TenantRole.MEMBER)
    })

    it("creates a member with default joinedAt date", () => {
      const before = new Date()
      const member = TenantMember.create("user-123", TenantRole.MEMBER)
      const after = new Date()

      expect(member.joinedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(member.joinedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("creates a member with custom joinedAt date", () => {
      const customDate = new Date(2024, 0, 15)
      const member = TenantMember.create("user-123", TenantRole.MEMBER, customDate)
      expect(member.joinedAt).toEqual(customDate)
    })

    it("trims whitespace from userId", () => {
      const member = TenantMember.create("  user-123  ", TenantRole.MEMBER)
      expect(member.userId).toBe("user-123")
    })

    it("throws for empty userId", () => {
      expect(() => TenantMember.create("", TenantRole.MEMBER)).toThrow(IdentityError)
      expect(() => TenantMember.create("", TenantRole.MEMBER)).toThrow(
        "Member userId cannot be empty"
      )
    })

    it("throws for whitespace-only userId", () => {
      expect(() => TenantMember.create("   ", TenantRole.MEMBER)).toThrow(IdentityError)
    })

    it("throws for null userId", () => {
      expect(() => TenantMember.create(null as unknown as string, TenantRole.MEMBER)).toThrow(
        IdentityError
      )
    })

    it("throws for invalid role", () => {
      expect(() => TenantMember.create("user-123", "INVALID_ROLE" as "OWNER")).toThrow(
        IdentityError
      )
      expect(() => TenantMember.create("user-123", "INVALID_ROLE" as "OWNER")).toThrow(
        "Invalid member role"
      )
    })

    it("accepts all valid roles", () => {
      for (const role of TenantRole.values()) {
        const member = TenantMember.create("user-123", role as "OWNER")
        expect(member.role).toBe(role)
      }
    })
  })

  describe("isOwner", () => {
    it("returns true for OWNER role", () => {
      const member = TenantMember.create("user-123", TenantRole.OWNER)
      expect(member.isOwner()).toBe(true)
    })

    it("returns false for ADMIN role", () => {
      const member = TenantMember.create("user-123", TenantRole.ADMIN)
      expect(member.isOwner()).toBe(false)
    })

    it("returns false for MEMBER role", () => {
      const member = TenantMember.create("user-123", TenantRole.MEMBER)
      expect(member.isOwner()).toBe(false)
    })

    it("returns false for VIEWER role", () => {
      const member = TenantMember.create("user-123", TenantRole.VIEWER)
      expect(member.isOwner()).toBe(false)
    })
  })

  describe("hasPermission", () => {
    it("OWNER has all permissions", () => {
      const member = TenantMember.create("user-123", TenantRole.OWNER)
      expect(member.hasPermission("delete_tenant")).toBe(true)
      expect(member.hasPermission("manage_members")).toBe(true)
      expect(member.hasPermission("view_invoices")).toBe(true)
    })

    it("ADMIN has most permissions except delete_tenant", () => {
      const member = TenantMember.create("user-123", TenantRole.ADMIN)
      expect(member.hasPermission("delete_tenant")).toBe(false)
      expect(member.hasPermission("manage_members")).toBe(true)
      expect(member.hasPermission("view_invoices")).toBe(true)
    })

    it("MEMBER has limited permissions", () => {
      const member = TenantMember.create("user-123", TenantRole.MEMBER)
      expect(member.hasPermission("delete_tenant")).toBe(false)
      expect(member.hasPermission("manage_members")).toBe(false)
      expect(member.hasPermission("view_invoices")).toBe(true)
      expect(member.hasPermission("create_invoices")).toBe(true)
    })

    it("VIEWER has read-only permissions", () => {
      const member = TenantMember.create("user-123", TenantRole.VIEWER)
      expect(member.hasPermission("view_invoices")).toBe(true)
      expect(member.hasPermission("view_reports")).toBe(true)
      expect(member.hasPermission("create_invoices")).toBe(false)
      expect(member.hasPermission("edit_invoices")).toBe(false)
    })

    it("ACCOUNTANT has financial view permissions", () => {
      const member = TenantMember.create("user-123", TenantRole.ACCOUNTANT)
      expect(member.hasPermission("view_invoices")).toBe(true)
      expect(member.hasPermission("view_reports")).toBe(true)
      expect(member.hasPermission("export_data")).toBe(true)
      expect(member.hasPermission("create_invoices")).toBe(false)
    })

    it("returns false for non-existent permission", () => {
      const member = TenantMember.create("user-123", TenantRole.OWNER)
      expect(member.hasPermission("non_existent_permission")).toBe(false)
    })
  })

  describe("withRole", () => {
    it("creates a new member with changed role", () => {
      const original = TenantMember.create("user-123", TenantRole.MEMBER)
      const promoted = original.withRole(TenantRole.ADMIN)

      expect(promoted.role).toBe(TenantRole.ADMIN)
      expect(promoted.userId).toBe(original.userId)
      expect(promoted.joinedAt).toEqual(original.joinedAt)
    })

    it("does not modify the original member", () => {
      const original = TenantMember.create("user-123", TenantRole.MEMBER)
      original.withRole(TenantRole.ADMIN)

      expect(original.role).toBe(TenantRole.MEMBER)
    })

    it("can demote from OWNER to VIEWER", () => {
      const owner = TenantMember.create("user-123", TenantRole.OWNER)
      const demoted = owner.withRole(TenantRole.VIEWER)

      expect(demoted.role).toBe(TenantRole.VIEWER)
      expect(demoted.isOwner()).toBe(false)
    })
  })

  describe("equals", () => {
    it("returns true for members with same userId", () => {
      const member1 = TenantMember.create("user-123", TenantRole.MEMBER)
      const member2 = TenantMember.create("user-123", TenantRole.ADMIN)
      expect(member1.equals(member2)).toBe(true)
    })

    it("returns false for members with different userId", () => {
      const member1 = TenantMember.create("user-123", TenantRole.MEMBER)
      const member2 = TenantMember.create("user-456", TenantRole.MEMBER)
      expect(member1.equals(member2)).toBe(false)
    })
  })
})
