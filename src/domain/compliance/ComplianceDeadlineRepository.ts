// src/domain/compliance/ComplianceDeadlineRepository.ts
import { ComplianceDeadline } from "./ComplianceDeadline"

export interface ComplianceDeadlineRepository {
  /**
   * Saves a compliance deadline (create or update)
   */
  save(deadline: ComplianceDeadline): Promise<void>

  /**
   * Finds a deadline by its ID
   */
  findById(id: string): Promise<ComplianceDeadline | null>

  /**
   * Finds all deadlines applicable to a specific business type
   */
  findByBusinessType(businessType: string): Promise<ComplianceDeadline[]>

  /**
   * Finds all deadlines of a specific type
   */
  findByDeadlineType(type: string): Promise<ComplianceDeadline[]>

  /**
   * Finds all upcoming deadlines within a specified number of days
   */
  findUpcoming(days: number): Promise<ComplianceDeadline[]>

  /**
   * Deletes a deadline by its ID
   */
  delete(id: string): Promise<void>
}
