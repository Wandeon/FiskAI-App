// src/lib/action-result.ts

// Standardized action result type
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; field?: string }

// Helper functions for creating results
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function err(error: string, code?: string, field?: string): ActionResult<never> {
  return { success: false, error, code, field }
}

// Common error codes
export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TENANT_VIOLATION: "TENANT_VIOLATION",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

// Type guard to check if result is successful
export function isOk<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true
}

// Type guard to check if result is error
export function isErr<T>(result: ActionResult<T>): result is { success: false; error: string; code?: string; field?: string } {
  return result.success === false
}
