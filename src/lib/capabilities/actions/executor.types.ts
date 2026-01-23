/**
 * Input for executing a capability action.
 */
export interface ExecuteActionInput {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity ID if operating on existing entity */
  entityId?: string

  /** Entity type (e.g., "Invoice") */
  entityType?: string

  /** Additional action-specific parameters */
  params?: Record<string, unknown>
}
