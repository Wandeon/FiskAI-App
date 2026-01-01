// src/domain/identity/TenantMember.ts
import { IdentityError } from "./IdentityError"
import { TenantRole, TenantRoleType } from "./TenantRole"

export interface TenantMemberProps {
  userId: string
  role: TenantRoleType
  joinedAt: Date
}

/**
 * Value object representing a member within a tenant
 */
export class TenantMember {
  private readonly props: TenantMemberProps

  private constructor(props: TenantMemberProps) {
    this.props = props
  }

  static create(userId: string, role: TenantRoleType, joinedAt?: Date): TenantMember {
    if (!userId || userId.trim() === "") {
      throw new IdentityError("Member userId cannot be empty")
    }

    if (!TenantRole.isValid(role)) {
      throw new IdentityError(`Invalid member role: ${role}`)
    }

    return new TenantMember({
      userId: userId.trim(),
      role,
      joinedAt: joinedAt ?? new Date(),
    })
  }

  get userId(): string {
    return this.props.userId
  }

  get role(): TenantRoleType {
    return this.props.role
  }

  get joinedAt(): Date {
    return this.props.joinedAt
  }

  /**
   * Check if this member is an owner
   */
  isOwner(): boolean {
    return this.props.role === TenantRole.OWNER
  }

  /**
   * Check if this member has a specific permission
   */
  hasPermission(permission: string): boolean {
    return TenantRole.hasPermission(this.props.role, permission)
  }

  /**
   * Create a new TenantMember with a different role
   */
  withRole(newRole: TenantRoleType): TenantMember {
    return new TenantMember({
      ...this.props,
      role: newRole,
    })
  }

  /**
   * Check equality based on userId (identity, not role)
   */
  equals(other: TenantMember): boolean {
    return this.props.userId === other.props.userId
  }
}
