/**
 * Error Taxonomy
 *
 * Standardized, machine-readable error codes and types.
 * All errors in the system should use these codes for consistency.
 *
 * @module errors
 * @since Enterprise Hardening - Error Taxonomy
 */

/**
 * Error domains for categorization.
 */
export type ErrorDomain =
  | "PERIOD"      // Accounting period related
  | "ENTITY"      // Entity state/immutability related
  | "AUTH"        // Authentication/authorization
  | "VALIDATION"  // Input validation
  | "WORKFLOW"    // Business workflow state
  | "EXTERNAL"    // External service/dependency
  | "SYSTEM"      // Internal system errors

/**
 * Standardized error codes.
 */
export type ErrorCode =
  // Period errors
  | "PERIOD_LOCKED"
  | "PERIOD_CLOSED"
  | "PERIOD_NOT_FOUND"

  // Entity errors
  | "ENTITY_IMMUTABLE"
  | "ENTITY_NOT_FOUND"
  | "ENTITY_ALREADY_EXISTS"

  // Auth errors
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "INVALID_TOKEN"

  // Validation errors
  | "VALIDATION_FAILED"
  | "INVALID_INPUT"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_FORMAT"
  | "OUT_OF_RANGE"

  // Workflow errors
  | "INVALID_STATE_TRANSITION"
  | "PREREQUISITE_NOT_MET"
  | "CONCURRENT_MODIFICATION"

  // External errors
  | "EXTERNAL_SERVICE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"

  // System errors
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "CONFIGURATION_ERROR"

/**
 * Machine-readable error structure.
 */
export interface MachineReadableError {
  /** Error code for programmatic handling */
  code: ErrorCode

  /** Error domain for categorization */
  domain: ErrorDomain

  /** HTTP status code */
  httpStatus: number

  /** Human-readable message */
  message: string

  /** Additional details for debugging/UI */
  details?: Record<string, unknown>

  /** Suggested resolution for the user */
  resolution?: string

  /** Link to documentation */
  docsUrl?: string

  /** Timestamp */
  timestamp: string

  /** Request ID for tracing */
  requestId?: string
}

/**
 * Error metadata registry.
 */
export const ERROR_METADATA: Record<ErrorCode, {
  domain: ErrorDomain
  httpStatus: number
  defaultMessage: string
  defaultResolution?: string
}> = {
  // Period errors
  PERIOD_LOCKED: {
    domain: "PERIOD",
    httpStatus: 409,
    defaultMessage: "The accounting period is locked and cannot be modified",
    defaultResolution: "Contact an administrator to unlock the period",
  },
  PERIOD_CLOSED: {
    domain: "PERIOD",
    httpStatus: 409,
    defaultMessage: "The accounting period is closed",
    defaultResolution: "Reopen the period or use a different date",
  },
  PERIOD_NOT_FOUND: {
    domain: "PERIOD",
    httpStatus: 404,
    defaultMessage: "The accounting period was not found",
  },

  // Entity errors
  ENTITY_IMMUTABLE: {
    domain: "ENTITY",
    httpStatus: 409,
    defaultMessage: "This record cannot be modified",
    defaultResolution: "Use the appropriate correction mechanism",
  },
  ENTITY_NOT_FOUND: {
    domain: "ENTITY",
    httpStatus: 404,
    defaultMessage: "The requested record was not found",
  },
  ENTITY_ALREADY_EXISTS: {
    domain: "ENTITY",
    httpStatus: 409,
    defaultMessage: "A record with this identifier already exists",
  },

  // Auth errors
  UNAUTHORIZED: {
    domain: "AUTH",
    httpStatus: 401,
    defaultMessage: "Authentication required",
    defaultResolution: "Please log in to continue",
  },
  FORBIDDEN: {
    domain: "AUTH",
    httpStatus: 403,
    defaultMessage: "You do not have permission to perform this action",
    defaultResolution: "Contact an administrator for access",
  },
  SESSION_EXPIRED: {
    domain: "AUTH",
    httpStatus: 401,
    defaultMessage: "Your session has expired",
    defaultResolution: "Please log in again",
  },
  INVALID_TOKEN: {
    domain: "AUTH",
    httpStatus: 401,
    defaultMessage: "Invalid authentication token",
    defaultResolution: "Please log in again",
  },

  // Validation errors
  VALIDATION_FAILED: {
    domain: "VALIDATION",
    httpStatus: 400,
    defaultMessage: "Validation failed",
  },
  INVALID_INPUT: {
    domain: "VALIDATION",
    httpStatus: 400,
    defaultMessage: "Invalid input provided",
  },
  MISSING_REQUIRED_FIELD: {
    domain: "VALIDATION",
    httpStatus: 400,
    defaultMessage: "A required field is missing",
  },
  INVALID_FORMAT: {
    domain: "VALIDATION",
    httpStatus: 400,
    defaultMessage: "Invalid format",
  },
  OUT_OF_RANGE: {
    domain: "VALIDATION",
    httpStatus: 400,
    defaultMessage: "Value is out of acceptable range",
  },

  // Workflow errors
  INVALID_STATE_TRANSITION: {
    domain: "WORKFLOW",
    httpStatus: 409,
    defaultMessage: "This state transition is not allowed",
  },
  PREREQUISITE_NOT_MET: {
    domain: "WORKFLOW",
    httpStatus: 409,
    defaultMessage: "Prerequisites for this action are not met",
  },
  CONCURRENT_MODIFICATION: {
    domain: "WORKFLOW",
    httpStatus: 409,
    defaultMessage: "The record was modified by another process",
    defaultResolution: "Refresh and try again",
  },

  // External errors
  EXTERNAL_SERVICE_ERROR: {
    domain: "EXTERNAL",
    httpStatus: 502,
    defaultMessage: "An external service is unavailable",
    defaultResolution: "Please try again later",
  },
  RATE_LIMITED: {
    domain: "EXTERNAL",
    httpStatus: 429,
    defaultMessage: "Too many requests",
    defaultResolution: "Please wait before trying again",
  },
  TIMEOUT: {
    domain: "EXTERNAL",
    httpStatus: 504,
    defaultMessage: "The request timed out",
    defaultResolution: "Please try again",
  },

  // System errors
  INTERNAL_ERROR: {
    domain: "SYSTEM",
    httpStatus: 500,
    defaultMessage: "An internal error occurred",
    defaultResolution: "Please try again or contact support",
  },
  DATABASE_ERROR: {
    domain: "SYSTEM",
    httpStatus: 500,
    defaultMessage: "A database error occurred",
    defaultResolution: "Please try again or contact support",
  },
  CONFIGURATION_ERROR: {
    domain: "SYSTEM",
    httpStatus: 500,
    defaultMessage: "A configuration error occurred",
    defaultResolution: "Please contact support",
  },
}

/**
 * Base class for machine-readable errors.
 */
export class ApplicationError extends Error {
  readonly code: ErrorCode
  readonly domain: ErrorDomain
  readonly httpStatus: number
  readonly details?: Record<string, unknown>
  readonly resolution?: string
  readonly timestamp: string

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      details?: Record<string, unknown>
      resolution?: string
    }
  ) {
    const metadata = ERROR_METADATA[code]
    super(message ?? metadata.defaultMessage)

    this.name = "ApplicationError"
    this.code = code
    this.domain = metadata.domain
    this.httpStatus = metadata.httpStatus
    this.details = options?.details
    this.resolution = options?.resolution ?? metadata.defaultResolution
    this.timestamp = new Date().toISOString()

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert to machine-readable format.
   */
  toJSON(): MachineReadableError {
    return {
      code: this.code,
      domain: this.domain,
      httpStatus: this.httpStatus,
      message: this.message,
      details: this.details,
      resolution: this.resolution,
      timestamp: this.timestamp,
    }
  }
}

/**
 * Period-specific error class.
 */
export class PeriodError extends ApplicationError {
  constructor(
    code: "PERIOD_LOCKED" | "PERIOD_CLOSED" | "PERIOD_NOT_FOUND",
    message?: string,
    options?: {
      details?: Record<string, unknown>
      resolution?: string
    }
  ) {
    super(code, message, options)
    this.name = "PeriodError"
  }
}

/**
 * Entity-specific error class.
 */
export class EntityError extends ApplicationError {
  constructor(
    code: "ENTITY_IMMUTABLE" | "ENTITY_NOT_FOUND" | "ENTITY_ALREADY_EXISTS",
    message?: string,
    options?: {
      details?: Record<string, unknown>
      resolution?: string
    }
  ) {
    super(code, message, options)
    this.name = "EntityError"
  }
}

/**
 * Validation error class.
 */
export class ValidationError extends ApplicationError {
  readonly fields?: Record<string, string>

  constructor(
    message?: string,
    options?: {
      details?: Record<string, unknown>
      fields?: Record<string, string>
    }
  ) {
    super("VALIDATION_FAILED", message, { details: options?.details })
    this.name = "ValidationError"
    this.fields = options?.fields
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields,
    }
  }
}

/**
 * Convert any error to a machine-readable format.
 */
export function toMachineReadableError(
  error: unknown,
  requestId?: string
): MachineReadableError {
  if (error instanceof ApplicationError) {
    return {
      ...error.toJSON(),
      requestId,
    }
  }

  if (error instanceof Error) {
    // Map known error types
    if (error.name === "AccountingPeriodLockedError") {
      return {
        code: "PERIOD_LOCKED",
        domain: "PERIOD",
        httpStatus: 409,
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId,
      }
    }

    if (error.name === "JournalEntryImmutableError") {
      return {
        code: "ENTITY_IMMUTABLE",
        domain: "ENTITY",
        httpStatus: 409,
        message: error.message,
        resolution: "Posted journal entries cannot be modified",
        timestamp: new Date().toISOString(),
        requestId,
      }
    }

    // Generic error
    return {
      code: "INTERNAL_ERROR",
      domain: "SYSTEM",
      httpStatus: 500,
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
    }
  }

  // Unknown error type
  return {
    code: "INTERNAL_ERROR",
    domain: "SYSTEM",
    httpStatus: 500,
    message: "An unexpected error occurred",
    timestamp: new Date().toISOString(),
    requestId,
  }
}
