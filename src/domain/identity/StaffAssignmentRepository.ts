// src/domain/identity/StaffAssignmentRepository.ts
import { StaffAssignment } from "./StaffAssignment"

export interface StaffAssignmentRepository {
  /**
   * Save a staff assignment (create or update)
   */
  save(assignment: StaffAssignment): Promise<void>

  /**
   * Find a staff assignment by its ID
   */
  findById(id: string): Promise<StaffAssignment | null>

  /**
   * Find all assignments for a staff user
   */
  findByStaffUserId(staffUserId: string): Promise<StaffAssignment[]>

  /**
   * Find all assignments for a tenant
   */
  findByTenantId(tenantId: string): Promise<StaffAssignment[]>

  /**
   * Find an active assignment for a specific staff user and tenant combination
   * Returns null if no active assignment exists
   */
  findActiveByStaffAndTenant(staffUserId: string, tenantId: string): Promise<StaffAssignment | null>

  /**
   * Delete a staff assignment
   */
  delete(id: string): Promise<void>
}
