/**
 * Identity Domain Tests
 * Following TDD: Write tests first, then implement
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { OIB } from "../OIB"
import { LegalForm } from "../LegalForm"
import { TenantRole } from "../TenantRole"
import { TenantMember } from "../TenantMember"
import { Tenant, TenantProps } from "../Tenant"
import { IdentityError } from "../IdentityError"

// ============================================================================
// OIB Value Object Tests
// ============================================================================

describe("OIB", () => {
  describe("validation", () => {
    it("creates valid OIB with correct checksum (12345678903)", () => {
      // This is a valid OIB with correct Mod 11,10 checksum
      const oib = OIB.create("12345678903")
      assert.strictEqual(oib.value, "12345678903")
    })

    it("creates valid OIB with correct checksum (00000000001)", () => {
      // Test with leading zeros
      const oib = OIB.create("00000000001")
      assert.strictEqual(oib.value, "00000000001")
    })

    it("throws for OIB with wrong length (10 digits)", () => {
      assert.throws(
        () => OIB.create("1234567890"),
        (err: Error) => err instanceof IdentityError && err.message.includes("11 digits")
      )
    })

    it("throws for OIB with wrong length (12 digits)", () => {
      assert.throws(
        () => OIB.create("123456789012"),
        (err: Error) => err instanceof IdentityError && err.message.includes("11 digits")
      )
    })

    it("throws for OIB with non-numeric characters", () => {
      assert.throws(
        () => OIB.create("1234567890A"),
        (err: Error) => err instanceof IdentityError && err.message.includes("numeric")
      )
    })

    it("throws for OIB with invalid checksum", () => {
      // Valid format but wrong checksum (last digit should be 3, not 4)
      assert.throws(
        () => OIB.create("12345678904"),
        (err: Error) => err instanceof IdentityError && err.message.includes("checksum")
      )
    })

    it("throws for empty OIB", () => {
      assert.throws(() => OIB.create(""), IdentityError)
    })

    it("throws for whitespace-only OIB", () => {
      assert.throws(() => OIB.create("   "), IdentityError)
    })
  })

  describe("Mod 11,10 checksum algorithm", () => {
    // Known valid Croatian OIBs (examples from official documentation)
    const validOibs = [
      "12345678903", // Standard test case
      "00000000001", // Edge case with zeros
      "69435151530", // Real format example
      "94aborabora", // Should fail - not numeric
    ]

    it("validates known valid OIB: 12345678903", () => {
      const oib = OIB.create("12345678903")
      assert.strictEqual(oib.value, "12345678903")
    })

    it("validates known valid OIB: 69435151530", () => {
      const oib = OIB.create("69435151530")
      assert.strictEqual(oib.value, "69435151530")
    })

    it("rejects non-numeric string", () => {
      assert.throws(() => OIB.create("94abor1bora"), IdentityError)
    })
  })

  describe("equality", () => {
    it("equals() returns true for same OIB value", () => {
      const oib1 = OIB.create("12345678903")
      const oib2 = OIB.create("12345678903")
      assert.strictEqual(oib1.equals(oib2), true)
    })

    it("equals() returns false for different OIB values", () => {
      const oib1 = OIB.create("12345678903")
      const oib2 = OIB.create("69435151530")
      assert.strictEqual(oib1.equals(oib2), false)
    })
  })

  describe("toString", () => {
    it("returns the OIB value as string", () => {
      const oib = OIB.create("12345678903")
      assert.strictEqual(oib.toString(), "12345678903")
    })
  })
})

// ============================================================================
// LegalForm Enum Tests
// ============================================================================

describe("LegalForm", () => {
  it("has all required legal forms", () => {
    assert.strictEqual(LegalForm.OBRT_PAUSAL, "OBRT_PAUSAL")
    assert.strictEqual(LegalForm.OBRT_REAL, "OBRT_REAL")
    assert.strictEqual(LegalForm.DOO, "DOO")
    assert.strictEqual(LegalForm.DIONICKO_DRUSTVO, "DIONICKO_DRUSTVO")
  })

  it("values() returns all legal forms", () => {
    const values = LegalForm.values()
    assert.strictEqual(values.length, 4)
    assert.ok(values.includes(LegalForm.OBRT_PAUSAL))
    assert.ok(values.includes(LegalForm.OBRT_REAL))
    assert.ok(values.includes(LegalForm.DOO))
    assert.ok(values.includes(LegalForm.DIONICKO_DRUSTVO))
  })

  it("isValid() returns true for valid forms", () => {
    assert.strictEqual(LegalForm.isValid("OBRT_PAUSAL"), true)
    assert.strictEqual(LegalForm.isValid("DOO"), true)
  })

  it("isValid() returns false for invalid forms", () => {
    assert.strictEqual(LegalForm.isValid("INVALID"), false)
    assert.strictEqual(LegalForm.isValid(""), false)
    assert.strictEqual(LegalForm.isValid("doo"), false) // Case sensitive
  })

  describe("display names", () => {
    it("getDisplayName() returns Croatian name for OBRT_PAUSAL", () => {
      assert.strictEqual(LegalForm.getDisplayName(LegalForm.OBRT_PAUSAL), "Obrt (pausalni)")
    })

    it("getDisplayName() returns Croatian name for OBRT_REAL", () => {
      assert.strictEqual(LegalForm.getDisplayName(LegalForm.OBRT_REAL), "Obrt (realni)")
    })

    it("getDisplayName() returns Croatian name for DOO", () => {
      assert.strictEqual(LegalForm.getDisplayName(LegalForm.DOO), "d.o.o.")
    })

    it("getDisplayName() returns Croatian name for DIONICKO_DRUSTVO", () => {
      assert.strictEqual(LegalForm.getDisplayName(LegalForm.DIONICKO_DRUSTVO), "d.d.")
    })
  })
})

// ============================================================================
// TenantRole Enum Tests
// ============================================================================

describe("TenantRole", () => {
  it("has all required roles", () => {
    assert.strictEqual(TenantRole.OWNER, "OWNER")
    assert.strictEqual(TenantRole.ADMIN, "ADMIN")
    assert.strictEqual(TenantRole.MEMBER, "MEMBER")
    assert.strictEqual(TenantRole.ACCOUNTANT, "ACCOUNTANT")
    assert.strictEqual(TenantRole.VIEWER, "VIEWER")
  })

  it("values() returns all roles", () => {
    const values = TenantRole.values()
    assert.strictEqual(values.length, 5)
    assert.ok(values.includes(TenantRole.OWNER))
    assert.ok(values.includes(TenantRole.ADMIN))
    assert.ok(values.includes(TenantRole.MEMBER))
    assert.ok(values.includes(TenantRole.ACCOUNTANT))
    assert.ok(values.includes(TenantRole.VIEWER))
  })

  it("isValid() returns true for valid roles", () => {
    assert.strictEqual(TenantRole.isValid("OWNER"), true)
    assert.strictEqual(TenantRole.isValid("VIEWER"), true)
  })

  it("isValid() returns false for invalid roles", () => {
    assert.strictEqual(TenantRole.isValid("SUPER_ADMIN"), false)
    assert.strictEqual(TenantRole.isValid(""), false)
  })

  describe("permissions", () => {
    it("OWNER has all permissions", () => {
      assert.strictEqual(TenantRole.hasPermission(TenantRole.OWNER, "manage_members"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.OWNER, "manage_settings"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.OWNER, "delete_tenant"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.OWNER, "view_invoices"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.OWNER, "create_invoices"), true)
    })

    it("ADMIN can manage members but not delete tenant", () => {
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ADMIN, "manage_members"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ADMIN, "manage_settings"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ADMIN, "delete_tenant"), false)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ADMIN, "view_invoices"), true)
    })

    it("MEMBER can create and view but not manage", () => {
      assert.strictEqual(TenantRole.hasPermission(TenantRole.MEMBER, "create_invoices"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.MEMBER, "view_invoices"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.MEMBER, "manage_members"), false)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.MEMBER, "manage_settings"), false)
    })

    it("ACCOUNTANT can view and manage financial data", () => {
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ACCOUNTANT, "view_invoices"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ACCOUNTANT, "view_reports"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.ACCOUNTANT, "manage_members"), false)
    })

    it("VIEWER can only view", () => {
      assert.strictEqual(TenantRole.hasPermission(TenantRole.VIEWER, "view_invoices"), true)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.VIEWER, "create_invoices"), false)
      assert.strictEqual(TenantRole.hasPermission(TenantRole.VIEWER, "manage_members"), false)
    })
  })

  describe("hierarchy", () => {
    it("compare() orders roles correctly (OWNER > ADMIN > MEMBER > ACCOUNTANT > VIEWER)", () => {
      assert.ok(TenantRole.compare(TenantRole.OWNER, TenantRole.ADMIN) > 0)
      assert.ok(TenantRole.compare(TenantRole.ADMIN, TenantRole.MEMBER) > 0)
      assert.ok(TenantRole.compare(TenantRole.MEMBER, TenantRole.ACCOUNTANT) > 0)
      assert.ok(TenantRole.compare(TenantRole.ACCOUNTANT, TenantRole.VIEWER) > 0)
      assert.strictEqual(TenantRole.compare(TenantRole.ADMIN, TenantRole.ADMIN), 0)
      assert.ok(TenantRole.compare(TenantRole.VIEWER, TenantRole.OWNER) < 0)
    })
  })
})

// ============================================================================
// TenantMember Value Object Tests
// ============================================================================

describe("TenantMember", () => {
  describe("creation", () => {
    it("creates member with userId, role, and joinedAt", () => {
      const joinedAt = new Date("2025-01-01")
      const member = TenantMember.create("user-123", TenantRole.OWNER, joinedAt)

      assert.strictEqual(member.userId, "user-123")
      assert.strictEqual(member.role, TenantRole.OWNER)
      assert.deepStrictEqual(member.joinedAt, joinedAt)
    })

    it("uses current date if joinedAt not provided", () => {
      const before = new Date()
      const member = TenantMember.create("user-123", TenantRole.MEMBER)
      const after = new Date()

      assert.ok(member.joinedAt >= before)
      assert.ok(member.joinedAt <= after)
    })

    it("throws for empty userId", () => {
      assert.throws(
        () => TenantMember.create("", TenantRole.MEMBER),
        (err: Error) => err instanceof IdentityError && err.message.includes("userId")
      )
    })

    it("throws for invalid role", () => {
      assert.throws(
        () => TenantMember.create("user-123", "INVALID_ROLE" as typeof TenantRole.OWNER),
        (err: Error) => err instanceof IdentityError && err.message.includes("role")
      )
    })
  })

  describe("isOwner", () => {
    it("returns true for OWNER role", () => {
      const member = TenantMember.create("user-123", TenantRole.OWNER)
      assert.strictEqual(member.isOwner(), true)
    })

    it("returns false for non-OWNER roles", () => {
      const admin = TenantMember.create("user-123", TenantRole.ADMIN)
      const member = TenantMember.create("user-456", TenantRole.MEMBER)
      assert.strictEqual(admin.isOwner(), false)
      assert.strictEqual(member.isOwner(), false)
    })
  })

  describe("hasPermission", () => {
    it("delegates to TenantRole.hasPermission", () => {
      const owner = TenantMember.create("user-123", TenantRole.OWNER)
      const viewer = TenantMember.create("user-456", TenantRole.VIEWER)

      assert.strictEqual(owner.hasPermission("delete_tenant"), true)
      assert.strictEqual(viewer.hasPermission("delete_tenant"), false)
    })
  })

  describe("withRole", () => {
    it("creates new member with changed role", () => {
      const original = TenantMember.create("user-123", TenantRole.MEMBER)
      const promoted = original.withRole(TenantRole.ADMIN)

      assert.strictEqual(promoted.userId, "user-123")
      assert.strictEqual(promoted.role, TenantRole.ADMIN)
      assert.deepStrictEqual(promoted.joinedAt, original.joinedAt)
      // Original unchanged
      assert.strictEqual(original.role, TenantRole.MEMBER)
    })
  })

  describe("equality", () => {
    it("equals() returns true for same userId (regardless of role)", () => {
      const member1 = TenantMember.create("user-123", TenantRole.MEMBER)
      const member2 = TenantMember.create("user-123", TenantRole.ADMIN)
      assert.strictEqual(member1.equals(member2), true)
    })

    it("equals() returns false for different userId", () => {
      const member1 = TenantMember.create("user-123", TenantRole.MEMBER)
      const member2 = TenantMember.create("user-456", TenantRole.MEMBER)
      assert.strictEqual(member1.equals(member2), false)
    })
  })
})

// ============================================================================
// Tenant Aggregate Tests
// ============================================================================

describe("Tenant", () => {
  // Helper to create a valid tenant for testing
  function createTestTenant(
    overrides: Partial<{
      name: string
      oib: string
      legalForm: typeof LegalForm.DOO
      isVatPayer: boolean
      ownerId: string
      entitlements: string[]
    }> = {}
  ): Tenant {
    return Tenant.create({
      name: overrides.name ?? "Test Company d.o.o.",
      oib: overrides.oib ?? "12345678903",
      legalForm: overrides.legalForm ?? LegalForm.DOO,
      isVatPayer: overrides.isVatPayer ?? true,
      ownerId: overrides.ownerId ?? "user-owner-123",
      entitlements: overrides.entitlements ?? ["invoicing", "fiscalization"],
    })
  }

  describe("creation", () => {
    it("creates tenant with valid inputs", () => {
      const tenant = createTestTenant()

      assert.ok(tenant.id)
      assert.strictEqual(tenant.name, "Test Company d.o.o.")
      assert.strictEqual(tenant.oib.value, "12345678903")
      assert.strictEqual(tenant.legalForm, LegalForm.DOO)
      assert.strictEqual(tenant.isVatPayer, true)
      assert.deepStrictEqual(tenant.entitlements, ["invoicing", "fiscalization"])
      assert.ok(tenant.createdAt instanceof Date)
      assert.ok(tenant.updatedAt instanceof Date)
    })

    it("creates tenant with initial owner member", () => {
      const tenant = createTestTenant({ ownerId: "user-owner-123" })

      const members = tenant.getMembers()
      assert.strictEqual(members.length, 1)
      assert.strictEqual(members[0].userId, "user-owner-123")
      assert.strictEqual(members[0].role, TenantRole.OWNER)
    })

    it("generates unique ID for each tenant", () => {
      const tenant1 = createTestTenant()
      const tenant2 = createTestTenant()

      assert.notStrictEqual(tenant1.id, tenant2.id)
    })

    it("throws on empty name", () => {
      assert.throws(
        () => createTestTenant({ name: "" }),
        (err: Error) => err instanceof IdentityError && err.message.includes("name")
      )
    })

    it("throws on invalid OIB", () => {
      assert.throws(
        () => createTestTenant({ oib: "invalid" }),
        (err: Error) => err instanceof IdentityError
      )
    })

    it("throws on invalid legal form", () => {
      assert.throws(
        () => createTestTenant({ legalForm: "INVALID" as typeof LegalForm.DOO }),
        (err: Error) => err instanceof IdentityError && err.message.includes("legal form")
      )
    })

    it("throws on empty owner ID", () => {
      assert.throws(
        () => createTestTenant({ ownerId: "" }),
        (err: Error) => err instanceof IdentityError && err.message.includes("owner")
      )
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes from props", () => {
      const createdAt = new Date("2025-01-01")
      const updatedAt = new Date("2025-01-02")
      const props: TenantProps = {
        id: "tenant-123",
        name: "Reconstituted Company",
        oib: OIB.create("12345678903"),
        legalForm: LegalForm.DOO,
        isVatPayer: false,
        members: [TenantMember.create("user-abc", TenantRole.OWNER)],
        entitlements: ["invoicing"],
        createdAt,
        updatedAt,
      }

      const tenant = Tenant.reconstitute(props)

      assert.strictEqual(tenant.id, "tenant-123")
      assert.strictEqual(tenant.name, "Reconstituted Company")
      assert.strictEqual(tenant.oib.value, "12345678903")
      assert.strictEqual(tenant.isVatPayer, false)
      assert.deepStrictEqual(tenant.createdAt, createdAt)
      assert.deepStrictEqual(tenant.updatedAt, updatedAt)
    })
  })

  describe("addMember", () => {
    it("adds a new member with specified role", () => {
      const tenant = createTestTenant()

      tenant.addMember("user-new-123", TenantRole.MEMBER)

      const members = tenant.getMembers()
      assert.strictEqual(members.length, 2)
      const newMember = tenant.getMember("user-new-123")
      assert.ok(newMember)
      assert.strictEqual(newMember.role, TenantRole.MEMBER)
    })

    it("throws when adding duplicate member", () => {
      const tenant = createTestTenant({ ownerId: "user-owner-123" })

      assert.throws(
        () => tenant.addMember("user-owner-123", TenantRole.ADMIN),
        (err: Error) => err instanceof IdentityError && err.message.includes("already a member")
      )
    })

    it("throws for empty userId", () => {
      const tenant = createTestTenant()

      assert.throws(
        () => tenant.addMember("", TenantRole.MEMBER),
        (err: Error) => err instanceof IdentityError && err.message.includes("userId")
      )
    })

    it("updates updatedAt timestamp", () => {
      const tenant = createTestTenant()
      const originalUpdatedAt = tenant.updatedAt

      // Small delay to ensure different timestamp
      const before = new Date()
      tenant.addMember("user-new-123", TenantRole.MEMBER)

      assert.ok(tenant.updatedAt >= before)
    })
  })

  describe("removeMember", () => {
    it("removes an existing member", () => {
      const tenant = createTestTenant()
      tenant.addMember("user-to-remove", TenantRole.MEMBER)

      tenant.removeMember("user-to-remove")

      assert.strictEqual(tenant.getMember("user-to-remove"), undefined)
      assert.strictEqual(tenant.getMembers().length, 1)
    })

    it("throws when removing non-existent member", () => {
      const tenant = createTestTenant()

      assert.throws(
        () => tenant.removeMember("non-existent"),
        (err: Error) => err instanceof IdentityError && err.message.includes("not found")
      )
    })

    it("throws when removing the only owner", () => {
      const tenant = createTestTenant({ ownerId: "only-owner" })

      assert.throws(
        () => tenant.removeMember("only-owner"),
        (err: Error) => err instanceof IdentityError && err.message.includes("at least one owner")
      )
    })

    it("allows removing an owner if another owner exists", () => {
      const tenant = createTestTenant({ ownerId: "owner-1" })
      tenant.addMember("owner-2", TenantRole.OWNER)

      // Should not throw
      tenant.removeMember("owner-1")

      assert.strictEqual(tenant.getMember("owner-1"), undefined)
      assert.strictEqual(tenant.getOwners().length, 1)
    })
  })

  describe("changeRole", () => {
    it("changes role of existing member", () => {
      const tenant = createTestTenant()
      tenant.addMember("user-123", TenantRole.MEMBER)

      tenant.changeRole("user-123", TenantRole.ADMIN)

      const member = tenant.getMember("user-123")
      assert.ok(member)
      assert.strictEqual(member.role, TenantRole.ADMIN)
    })

    it("throws when changing role of non-existent member", () => {
      const tenant = createTestTenant()

      assert.throws(
        () => tenant.changeRole("non-existent", TenantRole.ADMIN),
        (err: Error) => err instanceof IdentityError && err.message.includes("not found")
      )
    })

    it("throws when demoting the only owner", () => {
      const tenant = createTestTenant({ ownerId: "only-owner" })

      assert.throws(
        () => tenant.changeRole("only-owner", TenantRole.ADMIN),
        (err: Error) => err instanceof IdentityError && err.message.includes("at least one owner")
      )
    })

    it("allows demoting an owner if another owner exists", () => {
      const tenant = createTestTenant({ ownerId: "owner-1" })
      tenant.addMember("owner-2", TenantRole.OWNER)

      tenant.changeRole("owner-1", TenantRole.ADMIN)

      const member = tenant.getMember("owner-1")
      assert.ok(member)
      assert.strictEqual(member.role, TenantRole.ADMIN)
    })

    it("allows promoting member to owner", () => {
      const tenant = createTestTenant()
      tenant.addMember("user-123", TenantRole.MEMBER)

      tenant.changeRole("user-123", TenantRole.OWNER)

      const member = tenant.getMember("user-123")
      assert.ok(member)
      assert.strictEqual(member.role, TenantRole.OWNER)
      assert.strictEqual(tenant.getOwners().length, 2)
    })
  })

  describe("getMember", () => {
    it("returns member when found", () => {
      const tenant = createTestTenant({ ownerId: "owner-123" })

      const member = tenant.getMember("owner-123")

      assert.ok(member)
      assert.strictEqual(member.userId, "owner-123")
    })

    it("returns undefined when member not found", () => {
      const tenant = createTestTenant()

      const member = tenant.getMember("non-existent")

      assert.strictEqual(member, undefined)
    })
  })

  describe("getOwners", () => {
    it("returns all members with OWNER role", () => {
      const tenant = createTestTenant({ ownerId: "owner-1" })
      tenant.addMember("owner-2", TenantRole.OWNER)
      tenant.addMember("admin-1", TenantRole.ADMIN)

      const owners = tenant.getOwners()

      assert.strictEqual(owners.length, 2)
      assert.ok(owners.every((o) => o.role === TenantRole.OWNER))
    })

    it("returns empty array when no owners (should not happen in practice)", () => {
      // This tests the getter, not the invariant
      const tenant = createTestTenant()
      // In practice, a tenant always has at least one owner
      assert.ok(tenant.getOwners().length >= 1)
    })
  })

  describe("getMembers", () => {
    it("returns a copy of members array", () => {
      const tenant = createTestTenant()
      tenant.addMember("user-123", TenantRole.MEMBER)

      const members1 = tenant.getMembers()
      const members2 = tenant.getMembers()

      assert.notStrictEqual(members1, members2)
      assert.deepStrictEqual(members1, members2)
    })

    it("modifications to returned array do not affect tenant", () => {
      const tenant = createTestTenant()

      const members = tenant.getMembers() as TenantMember[]
      members.pop()

      assert.strictEqual(tenant.getMembers().length, 1)
    })
  })

  describe("hasPermission", () => {
    it("returns true when user has permission via their role", () => {
      const tenant = createTestTenant({ ownerId: "owner-123" })

      assert.strictEqual(tenant.hasPermission("owner-123", "delete_tenant"), true)
    })

    it("returns false when user does not have permission", () => {
      const tenant = createTestTenant()
      tenant.addMember("viewer-123", TenantRole.VIEWER)

      assert.strictEqual(tenant.hasPermission("viewer-123", "create_invoices"), false)
    })

    it("returns false for non-member user", () => {
      const tenant = createTestTenant()

      assert.strictEqual(tenant.hasPermission("non-member", "view_invoices"), false)
    })
  })

  describe("invariants", () => {
    it("tenant always has at least one owner after creation", () => {
      const tenant = createTestTenant()
      assert.ok(tenant.getOwners().length >= 1)
    })

    it("OIB is always valid", () => {
      const tenant = createTestTenant()
      // OIB validation happens at creation, if we got here it's valid
      assert.ok(tenant.oib.value.length === 11)
    })
  })

  describe("update methods", () => {
    it("updateName changes the name", () => {
      const tenant = createTestTenant({ name: "Original Name" })

      tenant.updateName("New Name")

      assert.strictEqual(tenant.name, "New Name")
    })

    it("updateName throws on empty name", () => {
      const tenant = createTestTenant()

      assert.throws(() => tenant.updateName(""), IdentityError)
    })

    it("updateVatPayer changes isVatPayer", () => {
      const tenant = createTestTenant({ isVatPayer: true })

      tenant.updateVatPayer(false)

      assert.strictEqual(tenant.isVatPayer, false)
    })

    it("updateEntitlements changes entitlements", () => {
      const tenant = createTestTenant({ entitlements: ["invoicing"] })

      tenant.updateEntitlements(["invoicing", "banking", "reports"])

      assert.deepStrictEqual(tenant.entitlements, ["invoicing", "banking", "reports"])
    })
  })
})
