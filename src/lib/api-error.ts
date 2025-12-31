// src/lib/api-error.ts
// Standardized error response utility for API routes
// Prevents sensitive error details from leaking to clients

import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getContext } from "@/lib/context"

export interface ApiErrorOptions {
  /**
   * HTTP status code (default: 500)
   */
  status?: number

  /**
   * Error code for client-side handling (default: "INTERNAL_ERROR")
   */
  code?: string

  /**
   * Safe message to return to client (default: "Internal server error")
   */
  message?: string

  /**
   * Request ID for support correlation (auto-populated from context)
   */
  requestId?: string

  /**
   * Additional context to log server-side (not sent to client)
   */
  logContext?: Record<string, unknown>
}

/**
 * Creates a standardized error response for API routes.
 *
 * - Logs full error details server-side with sensitive data redacted
 * - Returns safe, consistent error response to client
 * - Includes request ID for support correlation
 * - Prevents exposure of internal error messages, stack traces, or DB schema
 *
 * @example
 * ```typescript
 * try {
 *   // ... API logic
 * } catch (error) {
 *   return apiError(error, {
 *     status: 500,
 *     code: "INVOICE_PROCESSING_FAILED",
 *     message: "Neuspjelo procesiranje računa",
 *     logContext: { invoiceId: id }
 *   })
 * }
 * ```
 */
export function apiError(error: unknown, options: ApiErrorOptions = {}): NextResponse {
  const {
    status = 500,
    code = "INTERNAL_ERROR",
    message = "Internal server error",
    requestId: explicitRequestId,
    logContext = {},
  } = options

  // Get request ID from context or use explicit value
  const context = getContext()
  const requestId = explicitRequestId || context?.requestId

  // Log full error server-side (pino will redact sensitive fields)
  logger.error(
    {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      code,
      status,
      requestId,
      ...logContext,
    },
    "API error"
  )

  // Return safe response to client
  return NextResponse.json(
    {
      error: message,
      code,
      ...(requestId && { requestId }),
    },
    { status }
  )
}

/**
 * Common error responses for frequently used scenarios
 */
export const ApiErrors = {
  /**
   * Generic internal server error (500)
   */
  internal(error: unknown, logContext?: Record<string, unknown>) {
    return apiError(error, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      logContext,
    })
  },

  /**
   * Unauthorized (401)
   */
  unauthorized(message = "Unauthorized") {
    return NextResponse.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 })
  },

  /**
   * Forbidden (403)
   */
  forbidden(message = "Forbidden") {
    return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 })
  },

  /**
   * Not found (404)
   */
  notFound(message = "Not found") {
    return NextResponse.json({ error: message, code: "NOT_FOUND" }, { status: 404 })
  },

  /**
   * Bad request (400)
   */
  badRequest(message = "Bad request", details?: unknown) {
    return NextResponse.json(
      {
        error: message,
        code: "BAD_REQUEST",
        ...(details && { details }),
      },
      { status: 400 }
    )
  },

  /**
   * Conflict (409)
   */
  conflict(message = "Conflict", details?: unknown) {
    return NextResponse.json(
      {
        error: message,
        code: "CONFLICT",
        ...(details && { details }),
      },
      { status: 409 }
    )
  },
}
