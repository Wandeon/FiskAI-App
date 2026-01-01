// src/domain/identity/AssignmentStatus.ts

/**
 * AssignmentStatus - Enum for StaffAssignment status
 *
 * ACTIVE: The assignment is currently active
 * REVOKED: The assignment has been revoked
 */
export type AssignmentStatusType = "ACTIVE" | "REVOKED"

export const AssignmentStatus = {
  ACTIVE: "ACTIVE" as const,
  REVOKED: "REVOKED" as const,

  /**
   * Returns all valid status values
   */
  values(): AssignmentStatusType[] {
    return [AssignmentStatus.ACTIVE, AssignmentStatus.REVOKED]
  },

  /**
   * Check if a string is a valid AssignmentStatus
   */
  isValid(value: string): value is AssignmentStatusType {
    return AssignmentStatus.values().includes(value as AssignmentStatusType)
  },
}
