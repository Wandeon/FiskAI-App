// src/domain/identity/TenantRepository.ts
import { Tenant } from "./Tenant"
import { OIB } from "./OIB"

export interface TenantRepository {
  /**
   * Save a tenant (create or update)
   */
  save(tenant: Tenant): Promise<void>

  /**
   * Find a tenant by its ID
   */
  findById(id: string): Promise<Tenant | null>

  /**
   * Find a tenant by its OIB
   */
  findByOib(oib: OIB): Promise<Tenant | null>

  /**
   * Find all tenants a user is a member of
   */
  findByUserId(userId: string): Promise<Tenant[]>

  /**
   * Check if a tenant with the given OIB exists
   */
  existsByOib(oib: OIB): Promise<boolean>

  /**
   * Delete a tenant
   */
  delete(id: string): Promise<void>
}
