/**
 * API Validation Helpers
 *
 * Standardized validation utilities for all API routes.
 * Uses Zod for schema validation with consistent error handling.
 */

import { z } from "zod"

/**
 * Flattened Zod error structure for API responses
 */
export interface ValidationErrorDetails {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  public readonly errors: ValidationErrorDetails

  constructor(errors: ValidationErrorDetails) {
    super("Validation failed")
    this.name = "ValidationError"
    this.errors = errors

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Format ValidationError for API response
 */
export function formatValidationError(error: ValidationError): {
  error: string
  details: ValidationErrorDetails
} {
  return {
    error: "Validation failed",
    details: error.errors,
  }
}

/**
 * Parse and validate JSON request body
 *
 * @param request - The incoming Request object
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated data
 * @throws ValidationError if validation fails or JSON is invalid
 *
 * @example
 * ```typescript
 * const userSchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * })
 *
 * export async function POST(request: Request) {
 *   try {
 *     const data = await parseBody(request, userSchema)
 *     // data is fully typed as { name: string; email: string }
 *   } catch (error) {
 *     if (isValidationError(error)) {
 *       return NextResponse.json(formatValidationError(error), { status: 400 })
 *     }
 *     throw error
 *   }
 * }
 * ```
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown

  try {
    const text = await request.text()
    if (!text) {
      throw new ValidationError({
        formErrors: ["Request body is required"],
        fieldErrors: {},
      })
    }
    body = JSON.parse(text)
  } catch (error) {
    if (isValidationError(error)) {
      throw error
    }
    throw new ValidationError({
      formErrors: ["Invalid JSON in request body"],
      fieldErrors: {},
    })
  }

  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ValidationError(result.error.flatten())
  }

  return result.data
}

/**
 * Parse and validate URL query parameters
 *
 * @param searchParams - URLSearchParams from request URL
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated query params
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const querySchema = z.object({
 *   page: z.coerce.number().min(1).default(1),
 *   limit: z.coerce.number().min(1).max(100).default(10),
 * })
 *
 * export async function GET(request: Request) {
 *   try {
 *     const url = new URL(request.url)
 *     const query = parseQuery(url.searchParams, querySchema)
 *     // query.page and query.limit are numbers with defaults applied
 *   } catch (error) {
 *     if (isValidationError(error)) {
 *       return NextResponse.json(formatValidationError(error), { status: 400 })
 *     }
 *     throw error
 *   }
 * }
 * ```
 */
export function parseQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries())
  const result = schema.safeParse(params)

  if (!result.success) {
    throw new ValidationError(result.error.flatten())
  }

  return result.data
}

/**
 * Parse and validate route parameters
 *
 * @param params - Route params object from Next.js
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated params
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const paramsSchema = z.object({
 *   id: z.string().uuid(),
 * })
 *
 * export async function GET(
 *   request: Request,
 *   { params }: { params: { id: string } }
 * ) {
 *   try {
 *     const { id } = parseParams(params, paramsSchema)
 *     // id is validated as a UUID
 *   } catch (error) {
 *     if (isValidationError(error)) {
 *       return NextResponse.json(formatValidationError(error), { status: 400 })
 *     }
 *     throw error
 *   }
 * }
 * ```
 */
export function parseParams<T extends z.ZodType>(
  params: Record<string, unknown>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params)

  if (!result.success) {
    throw new ValidationError(result.error.flatten())
  }

  return result.data
}

/**
 * Common validation schemas for reuse across routes
 */
export const commonSchemas = {
  /** UUID validation */
  uuid: z.string().uuid("Invalid UUID format"),

  /** Pagination query params */
  pagination: z.object({
    page: z.coerce.number().min(1, "Page must be at least 1").default(1),
    limit: z.coerce.number().min(1).max(100, "Limit cannot exceed 100").default(25),
  }),

  /** Date range query params */
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),

  /** Search query param */
  search: z.object({
    search: z.string().optional(),
    q: z.string().optional(),
  }),

  /** Sorting query params */
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
}
