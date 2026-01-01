// src/domain/identity/StaffAssignment.ts
import { IdentityError } from "./IdentityError"
import { AssignmentStatus, AssignmentStatusType } from "./AssignmentStatus"

export interface StaffAssignmentProps {
  id: string
  staffUserId: string
  tenantId: string
  assignedBy: string
  assignedAt: Date
  notes?: string
  status: AssignmentStatusType
  revokedBy?: string
  revokedAt?: Date
}

interface CreateStaffAssignmentInput {
  staffUserId: string
  tenantId: string
  assignedBy: string
  notes?: string
}

/**
 * StaffAssignment Entity - represents a staff member's assignment to a tenant
 *
 * Invariants:
 * - staffUserId cannot equal assignedBy (cannot self-assign)
 * - Cannot revoke an already revoked assignment
 */
export class StaffAssignment {
  private props: StaffAssignmentProps

  private constructor(props: StaffAssignmentProps) {
    this.props = props
  }

  /**
   * Factory method to create a new StaffAssignment
   */
  static create(input: CreateStaffAssignmentInput): StaffAssignment {
    // Validate staffUserId
    const staffUserId = input.staffUserId?.trim()
    if (!staffUserId) {
      throw new IdentityError("staffUserId cannot be empty")
    }

    // Validate tenantId
    const tenantId = input.tenantId?.trim()
    if (!tenantId) {
      throw new IdentityError("tenantId cannot be empty")
    }

    // Validate assignedBy
    const assignedBy = input.assignedBy?.trim()
    if (!assignedBy) {
      throw new IdentityError("assignedBy cannot be empty")
    }

    // Invariant: cannot self-assign
    if (staffUserId === assignedBy) {
      throw new IdentityError("Cannot self-assign: staffUserId cannot equal assignedBy")
    }

    const notes = input.notes?.trim() || undefined

    return new StaffAssignment({
      id: crypto.randomUUID(),
      staffUserId,
      tenantId,
      assignedBy,
      assignedAt: new Date(),
      notes,
      status: AssignmentStatus.ACTIVE,
    })
  }

  /**
   * Reconstitutes a StaffAssignment from stored props (e.g., from database)
   */
  static reconstitute(props: StaffAssignmentProps): StaffAssignment {
    return new StaffAssignment(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }

  get staffUserId(): string {
    return this.props.staffUserId
  }

  get tenantId(): string {
    return this.props.tenantId
  }

  get assignedBy(): string {
    return this.props.assignedBy
  }

  get assignedAt(): Date {
    return this.props.assignedAt
  }

  get notes(): string | undefined {
    return this.props.notes
  }

  get status(): AssignmentStatusType {
    return this.props.status
  }

  get revokedBy(): string | undefined {
    return this.props.revokedBy
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt
  }

  // Business Methods

  /**
   * Revokes this assignment
   * @param revokedBy - The user ID of who is revoking the assignment
   * @throws IdentityError if assignment is already revoked or revokedBy is empty
   */
  revoke(revokedBy: string): void {
    const trimmedRevokedBy = revokedBy?.trim()
    if (!trimmedRevokedBy) {
      throw new IdentityError("revokedBy cannot be empty")
    }

    if (this.props.status === AssignmentStatus.REVOKED) {
      throw new IdentityError("Assignment is already revoked")
    }

    this.props.status = AssignmentStatus.REVOKED
    this.props.revokedBy = trimmedRevokedBy
    this.props.revokedAt = new Date()
  }

  /**
   * Checks if the assignment is currently active
   */
  isActive(): boolean {
    return this.props.status === AssignmentStatus.ACTIVE
  }

  /**
   * Calculates the number of days since the assignment was created
   * @returns Number of whole days since assignment
   */
  getAssignmentDuration(): number {
    const now = new Date()
    const diffMs = now.getTime() - this.props.assignedAt.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return diffDays
  }
}
