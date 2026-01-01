/**
 * StaffAssignment Entity Tests
 * Following TDD: Write tests first, then implement
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { StaffAssignment, StaffAssignmentProps } from "../StaffAssignment"
import { AssignmentStatus } from "../AssignmentStatus"
import { IdentityError } from "../IdentityError"

// ============================================================================
// AssignmentStatus Value Object Tests
// ============================================================================

describe("AssignmentStatus", () => {
  it("has ACTIVE status", () => {
    assert.strictEqual(AssignmentStatus.ACTIVE, "ACTIVE")
  })

  it("has REVOKED status", () => {
    assert.strictEqual(AssignmentStatus.REVOKED, "REVOKED")
  })

  it("values() returns all statuses", () => {
    const values = AssignmentStatus.values()
    assert.strictEqual(values.length, 2)
    assert.ok(values.includes(AssignmentStatus.ACTIVE))
    assert.ok(values.includes(AssignmentStatus.REVOKED))
  })

  it("isValid() returns true for valid statuses", () => {
    assert.strictEqual(AssignmentStatus.isValid("ACTIVE"), true)
    assert.strictEqual(AssignmentStatus.isValid("REVOKED"), true)
  })

  it("isValid() returns false for invalid statuses", () => {
    assert.strictEqual(AssignmentStatus.isValid("INVALID"), false)
    assert.strictEqual(AssignmentStatus.isValid(""), false)
    assert.strictEqual(AssignmentStatus.isValid("active"), false) // Case sensitive
  })
})

// ============================================================================
// StaffAssignment Entity Tests
// ============================================================================

describe("StaffAssignment", () => {
  // Helper to create a valid assignment for testing
  function createTestAssignment(
    overrides: Partial<{
      staffUserId: string
      tenantId: string
      assignedBy: string
      notes: string
    }> = {}
  ): StaffAssignment {
    return StaffAssignment.create({
      staffUserId: overrides.staffUserId ?? "staff-user-123",
      tenantId: overrides.tenantId ?? "tenant-456",
      assignedBy: overrides.assignedBy ?? "admin-789",
      notes: overrides.notes,
    })
  }

  describe("creation", () => {
    it("creates assignment with valid inputs", () => {
      const assignment = createTestAssignment()

      assert.ok(assignment.id)
      assert.strictEqual(assignment.staffUserId, "staff-user-123")
      assert.strictEqual(assignment.tenantId, "tenant-456")
      assert.strictEqual(assignment.assignedBy, "admin-789")
      assert.strictEqual(assignment.status, AssignmentStatus.ACTIVE)
      assert.ok(assignment.assignedAt instanceof Date)
    })

    it("creates assignment with optional notes", () => {
      const assignment = createTestAssignment({ notes: "Primary accountant" })

      assert.strictEqual(assignment.notes, "Primary accountant")
    })

    it("creates assignment without notes (undefined)", () => {
      const assignment = createTestAssignment()

      assert.strictEqual(assignment.notes, undefined)
    })

    it("generates unique ID for each assignment", () => {
      const assignment1 = createTestAssignment()
      const assignment2 = createTestAssignment()

      assert.notStrictEqual(assignment1.id, assignment2.id)
    })

    it("sets initial status to ACTIVE", () => {
      const assignment = createTestAssignment()

      assert.strictEqual(assignment.status, AssignmentStatus.ACTIVE)
    })

    it("throws on empty staffUserId", () => {
      assert.throws(
        () => createTestAssignment({ staffUserId: "" }),
        (err: Error) => err instanceof IdentityError && err.message.includes("staffUserId")
      )
    })

    it("throws on whitespace-only staffUserId", () => {
      assert.throws(
        () => createTestAssignment({ staffUserId: "   " }),
        (err: Error) => err instanceof IdentityError && err.message.includes("staffUserId")
      )
    })

    it("throws on empty tenantId", () => {
      assert.throws(
        () => createTestAssignment({ tenantId: "" }),
        (err: Error) => err instanceof IdentityError && err.message.includes("tenantId")
      )
    })

    it("throws on empty assignedBy", () => {
      assert.throws(
        () => createTestAssignment({ assignedBy: "" }),
        (err: Error) => err instanceof IdentityError && err.message.includes("assignedBy")
      )
    })

    it("throws when staffUserId equals assignedBy (cannot self-assign)", () => {
      assert.throws(
        () =>
          createTestAssignment({
            staffUserId: "user-123",
            assignedBy: "user-123",
          }),
        (err: Error) => err instanceof IdentityError && err.message.includes("self-assign")
      )
    })

    it("trims whitespace from string inputs", () => {
      const assignment = StaffAssignment.create({
        staffUserId: "  staff-123  ",
        tenantId: "  tenant-456  ",
        assignedBy: "  admin-789  ",
        notes: "  Some notes  ",
      })

      assert.strictEqual(assignment.staffUserId, "staff-123")
      assert.strictEqual(assignment.tenantId, "tenant-456")
      assert.strictEqual(assignment.assignedBy, "admin-789")
      assert.strictEqual(assignment.notes, "Some notes")
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes from props", () => {
      const assignedAt = new Date("2025-01-01")
      const revokedAt = new Date("2025-01-15")
      const props: StaffAssignmentProps = {
        id: "assignment-123",
        staffUserId: "staff-user-abc",
        tenantId: "tenant-xyz",
        assignedBy: "admin-def",
        assignedAt,
        notes: "Test assignment",
        status: AssignmentStatus.REVOKED,
        revokedBy: "admin-other",
        revokedAt,
      }

      const assignment = StaffAssignment.reconstitute(props)

      assert.strictEqual(assignment.id, "assignment-123")
      assert.strictEqual(assignment.staffUserId, "staff-user-abc")
      assert.strictEqual(assignment.tenantId, "tenant-xyz")
      assert.strictEqual(assignment.assignedBy, "admin-def")
      assert.deepStrictEqual(assignment.assignedAt, assignedAt)
      assert.strictEqual(assignment.notes, "Test assignment")
      assert.strictEqual(assignment.status, AssignmentStatus.REVOKED)
      assert.strictEqual(assignment.revokedBy, "admin-other")
      assert.deepStrictEqual(assignment.revokedAt, revokedAt)
    })

    it("reconstitutes active assignment without revocation fields", () => {
      const assignedAt = new Date("2025-01-01")
      const props: StaffAssignmentProps = {
        id: "assignment-123",
        staffUserId: "staff-user-abc",
        tenantId: "tenant-xyz",
        assignedBy: "admin-def",
        assignedAt,
        status: AssignmentStatus.ACTIVE,
      }

      const assignment = StaffAssignment.reconstitute(props)

      assert.strictEqual(assignment.status, AssignmentStatus.ACTIVE)
      assert.strictEqual(assignment.revokedBy, undefined)
      assert.strictEqual(assignment.revokedAt, undefined)
    })
  })

  describe("revoke", () => {
    it("revokes an active assignment", () => {
      const assignment = createTestAssignment()

      assignment.revoke("admin-revoker")

      assert.strictEqual(assignment.status, AssignmentStatus.REVOKED)
      assert.strictEqual(assignment.revokedBy, "admin-revoker")
      assert.ok(assignment.revokedAt instanceof Date)
    })

    it("throws when revoking an already revoked assignment", () => {
      const assignment = createTestAssignment()
      assignment.revoke("admin-revoker")

      assert.throws(
        () => assignment.revoke("another-admin"),
        (err: Error) => err instanceof IdentityError && err.message.includes("already revoked")
      )
    })

    it("throws when revokedBy is empty", () => {
      const assignment = createTestAssignment()

      assert.throws(
        () => assignment.revoke(""),
        (err: Error) => err instanceof IdentityError && err.message.includes("revokedBy")
      )
    })

    it("trims whitespace from revokedBy", () => {
      const assignment = createTestAssignment()

      assignment.revoke("  admin-revoker  ")

      assert.strictEqual(assignment.revokedBy, "admin-revoker")
    })
  })

  describe("isActive", () => {
    it("returns true for ACTIVE status", () => {
      const assignment = createTestAssignment()

      assert.strictEqual(assignment.isActive(), true)
    })

    it("returns false for REVOKED status", () => {
      const assignment = createTestAssignment()
      assignment.revoke("admin-revoker")

      assert.strictEqual(assignment.isActive(), false)
    })
  })

  describe("getAssignmentDuration", () => {
    it("returns 0 for assignment created today", () => {
      const assignment = createTestAssignment()

      const duration = assignment.getAssignmentDuration()

      assert.strictEqual(duration, 0)
    })

    it("returns correct number of days since assignment", () => {
      const assignedAt = new Date()
      assignedAt.setDate(assignedAt.getDate() - 10) // 10 days ago

      const props: StaffAssignmentProps = {
        id: "assignment-123",
        staffUserId: "staff-user-abc",
        tenantId: "tenant-xyz",
        assignedBy: "admin-def",
        assignedAt,
        status: AssignmentStatus.ACTIVE,
      }

      const assignment = StaffAssignment.reconstitute(props)
      const duration = assignment.getAssignmentDuration()

      assert.strictEqual(duration, 10)
    })

    it("returns whole days only (floors the result)", () => {
      const assignedAt = new Date()
      assignedAt.setDate(assignedAt.getDate() - 5)
      assignedAt.setHours(assignedAt.getHours() - 12) // 5.5 days ago

      const props: StaffAssignmentProps = {
        id: "assignment-123",
        staffUserId: "staff-user-abc",
        tenantId: "tenant-xyz",
        assignedBy: "admin-def",
        assignedAt,
        status: AssignmentStatus.ACTIVE,
      }

      const assignment = StaffAssignment.reconstitute(props)
      const duration = assignment.getAssignmentDuration()

      // Should floor to 5 days
      assert.strictEqual(duration, 5)
    })
  })

  describe("invariants", () => {
    it("staffUserId cannot equal assignedBy", () => {
      assert.throws(
        () =>
          StaffAssignment.create({
            staffUserId: "same-user",
            tenantId: "tenant-123",
            assignedBy: "same-user",
          }),
        (err: Error) => err instanceof IdentityError && err.message.includes("self-assign")
      )
    })

    it("cannot revoke an already revoked assignment", () => {
      const assignment = createTestAssignment()
      assignment.revoke("admin-1")

      assert.throws(
        () => assignment.revoke("admin-2"),
        (err: Error) => err instanceof IdentityError && err.message.includes("already revoked")
      )
    })
  })

  describe("getters immutability", () => {
    it("assignedAt returns the date value", () => {
      const assignment = createTestAssignment()
      const date1 = assignment.assignedAt
      const date2 = assignment.assignedAt

      assert.deepStrictEqual(date1, date2)
    })

    it("revokedAt returns undefined for active assignment", () => {
      const assignment = createTestAssignment()

      assert.strictEqual(assignment.revokedAt, undefined)
    })

    it("revokedAt returns date for revoked assignment", () => {
      const assignment = createTestAssignment()
      assignment.revoke("admin-revoker")

      assert.ok(assignment.revokedAt instanceof Date)
    })
  })
})
