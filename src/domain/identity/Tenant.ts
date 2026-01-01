// src/domain/identity/Tenant.ts
import { IdentityError } from "./IdentityError"
import { OIB } from "./OIB"
import { LegalForm, LegalFormType } from "./LegalForm"
import { TenantRole, TenantRoleType } from "./TenantRole"
import { TenantMember } from "./TenantMember"

export interface TenantProps {
  id: string
  name: string
  oib: OIB
  legalForm: LegalFormType
  isVatPayer: boolean
  members: TenantMember[]
  entitlements: string[]
  createdAt: Date
  updatedAt: Date
}

interface CreateTenantInput {
  name: string
  oib: string
  legalForm: LegalFormType
  isVatPayer: boolean
  ownerId: string
  entitlements?: string[]
}

/**
 * Tenant Aggregate - represents a company/business entity
 *
 * Invariants:
 * - Must have at least one OWNER
 * - Cannot remove the only owner
 * - OIB must be valid (11 digits with valid checksum)
 */
export class Tenant {
  private props: TenantProps

  private constructor(props: TenantProps) {
    this.props = props
  }

  /**
   * Factory method to create a new Tenant
   */
  static create(input: CreateTenantInput): Tenant {
    // Validate name
    if (!input.name || input.name.trim() === "") {
      throw new IdentityError("Tenant name cannot be empty")
    }

    // Validate OIB (will throw if invalid)
    const oib = OIB.create(input.oib)

    // Validate legal form
    if (!LegalForm.isValid(input.legalForm)) {
      throw new IdentityError(`Invalid legal form: ${input.legalForm}`)
    }

    // Validate owner ID
    if (!input.ownerId || input.ownerId.trim() === "") {
      throw new IdentityError("Tenant must have an owner")
    }

    const now = new Date()
    const owner = TenantMember.create(input.ownerId.trim(), TenantRole.OWNER, now)

    return new Tenant({
      id: crypto.randomUUID(),
      name: input.name.trim(),
      oib,
      legalForm: input.legalForm,
      isVatPayer: input.isVatPayer,
      members: [owner],
      entitlements: input.entitlements ?? [],
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * Reconstitutes a Tenant from stored props (e.g., from database)
   */
  static reconstitute(props: TenantProps): Tenant {
    return new Tenant(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get oib(): OIB {
    return this.props.oib
  }

  get legalForm(): LegalFormType {
    return this.props.legalForm
  }

  get isVatPayer(): boolean {
    return this.props.isVatPayer
  }

  get entitlements(): string[] {
    return [...this.props.entitlements]
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /**
   * Returns a copy of the members array
   */
  getMembers(): readonly TenantMember[] {
    return [...this.props.members]
  }

  /**
   * Find a member by userId
   */
  getMember(userId: string): TenantMember | undefined {
    return this.props.members.find((m) => m.userId === userId)
  }

  /**
   * Get all members with OWNER role
   */
  getOwners(): TenantMember[] {
    return this.props.members.filter((m) => m.isOwner())
  }

  // Business Methods

  /**
   * Add a new member to the tenant
   */
  addMember(userId: string, role: TenantRoleType): void {
    if (!userId || userId.trim() === "") {
      throw new IdentityError("Member userId cannot be empty")
    }

    const existingMember = this.getMember(userId.trim())
    if (existingMember) {
      throw new IdentityError(`User ${userId} is already a member of this tenant`)
    }

    const newMember = TenantMember.create(userId.trim(), role)
    this.props.members.push(newMember)
    this.props.updatedAt = new Date()
  }

  /**
   * Remove a member from the tenant
   * Throws if removing would leave no owners
   */
  removeMember(userId: string): void {
    const memberIndex = this.props.members.findIndex((m) => m.userId === userId)
    if (memberIndex === -1) {
      throw new IdentityError(`Member ${userId} not found`)
    }

    const member = this.props.members[memberIndex]

    // Check if this would leave no owners
    if (member.isOwner()) {
      const ownerCount = this.getOwners().length
      if (ownerCount <= 1) {
        throw new IdentityError(
          "Cannot remove the only owner. Tenant must have at least one owner."
        )
      }
    }

    this.props.members.splice(memberIndex, 1)
    this.props.updatedAt = new Date()
  }

  /**
   * Change a member's role
   * Throws if demoting the only owner
   */
  changeRole(userId: string, newRole: TenantRoleType): void {
    const member = this.getMember(userId)
    if (!member) {
      throw new IdentityError(`Member ${userId} not found`)
    }

    // Check if demoting the only owner
    if (member.isOwner() && newRole !== TenantRole.OWNER) {
      const ownerCount = this.getOwners().length
      if (ownerCount <= 1) {
        throw new IdentityError(
          "Cannot demote the only owner. Tenant must have at least one owner."
        )
      }
    }

    // Replace the member with updated role
    const memberIndex = this.props.members.findIndex((m) => m.userId === userId)
    this.props.members[memberIndex] = member.withRole(newRole)
    this.props.updatedAt = new Date()
  }

  /**
   * Check if a user has a specific permission
   */
  hasPermission(userId: string, permission: string): boolean {
    const member = this.getMember(userId)
    if (!member) {
      return false
    }
    return member.hasPermission(permission)
  }

  // Update Methods

  /**
   * Update the tenant name
   */
  updateName(name: string): void {
    if (!name || name.trim() === "") {
      throw new IdentityError("Tenant name cannot be empty")
    }
    this.props.name = name.trim()
    this.props.updatedAt = new Date()
  }

  /**
   * Update VAT payer status
   */
  updateVatPayer(isVatPayer: boolean): void {
    this.props.isVatPayer = isVatPayer
    this.props.updatedAt = new Date()
  }

  /**
   * Update entitlements
   */
  updateEntitlements(entitlements: string[]): void {
    this.props.entitlements = [...entitlements]
    this.props.updatedAt = new Date()
  }
}
