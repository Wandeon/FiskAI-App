/**
 * Capability Resolution Types
 *
 * Defines the machine-readable contract for capability resolution.
 * UI and AI clients use this to determine what actions are available.
 *
 * @module capabilities
 * @since Enterprise Hardening - Capability Resolution API
 */

/**
 * Capability state - what can the user do right now?
 */
export type CapabilityState =
  | "READY"           // All conditions met, action can be taken
  | "BLOCKED"         // External blocker prevents action (e.g., locked period)
  | "MISSING_INPUTS"  // Required inputs are not provided
  | "UNAUTHORIZED"    // User lacks permission for this action

/**
 * Input status for a capability.
 */
export interface CapabilityInput {
  /** Field key (e.g., "invoiceId", "amount") */
  key: string

  /** Is this input required? */
  required: boolean

  /** Has a value been provided? */
  provided: boolean

  /** Current value if provided */
  value?: unknown

  /** Validation error if value is invalid */
  validationError?: string
}

/**
 * A blocker preventing capability execution.
 */
export interface CapabilityBlocker {
  /** Blocker type for programmatic handling */
  type:
    | "PERIOD_LOCKED"
    | "ENTITY_IMMUTABLE"
    | "WORKFLOW_STATE"
    | "MISSING_PREREQUISITE"
    | "EXTERNAL_DEPENDENCY"
    | "RATE_LIMITED"

  /** Human-readable message */
  message: string

  /** How to resolve this blocker */
  resolution?: string

  /** Machine-readable details */
  details?: Record<string, unknown>
}

/**
 * An action available for a capability.
 */
export interface CapabilityAction {
  /** Action identifier */
  id: string

  /** Human-readable label */
  label: string

  /** Is this action currently enabled? */
  enabled: boolean

  /** Why is this action disabled? */
  disabledReason?: string

  /** Is this the primary action? */
  primary?: boolean
}

/**
 * Capability resolution response.
 */
export interface CapabilityResponse {
  /** The capability being resolved */
  capability: string

  /** Current state */
  state: CapabilityState

  /** Input status */
  inputs: CapabilityInput[]

  /** Active blockers (if state is BLOCKED) */
  blockers: CapabilityBlocker[]

  /** Available actions */
  actions: CapabilityAction[]

  /** Timestamp of resolution */
  resolvedAt: string
}

/**
 * Capability resolution request.
 */
export interface CapabilityRequest {
  /** Capability ID (e.g., "INV-001", "EXP-002") */
  capability: string

  /** Context for resolution */
  context: {
    /** Company ID (optional - derived from session if not provided) */
    companyId?: string

    /** Entity ID if operating on existing entity */
    entityId?: string

    /** Entity type if operating on existing entity */
    entityType?: string

    /** Input values to evaluate */
    inputs?: Record<string, unknown>

    /** Target date for period check (optional - uses entity date if not provided) */
    targetDate?: string
  }
}

/**
 * Capability metadata for registration.
 */
export interface CapabilityMetadata {
  /** Unique capability ID */
  id: string

  /** Human-readable name */
  name: string

  /** Description */
  description: string

  /** Domain this capability belongs to */
  domain:
    | "invoicing"
    | "expenses"
    | "banking"
    | "payroll"
    | "assets"
    | "reports"
    | "admin"
    | "system"

  /** Required inputs */
  requiredInputs: string[]

  /** Optional inputs */
  optionalInputs: string[]

  /** Required permissions */
  requiredPermissions: string[]

  /** Entity types this capability affects (for period lock checks) */
  affectedEntities: string[]
}
