// src/lib/regulatory-truth/utils/error-classifier.ts
//
// Error classification for RTL pipeline monitoring and alerting.
// Classifies errors into categories for better observability.

/**
 * Error categories for RTL pipeline.
 * Use these for structured logging and alerting.
 */
export enum ErrorCategory {
  /** Authentication or authorization failure */
  AUTH = "AUTH",
  /** Rate limit or quota exceeded */
  QUOTA = "QUOTA",
  /** Network connectivity or DNS issues */
  NETWORK = "NETWORK",
  /** JSON parse or response format error */
  PARSE = "PARSE",
  /** Schema or business rule validation failed */
  VALIDATION = "VALIDATION",
  /** Empty response or no extractable content */
  EMPTY = "EMPTY",
  /** Timeout exceeded */
  TIMEOUT = "TIMEOUT",
  /** Unknown or unclassified error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Classified error with category and metadata.
 */
export interface ClassifiedError {
  category: ErrorCategory
  originalMessage: string
  isRetryable: boolean
  suggestedAction: string
}

/**
 * Classify an error message into a category.
 * Useful for metrics, logging, and alerting.
 */
export function classifyError(errorMessage: string | null | undefined): ClassifiedError {
  if (!errorMessage) {
    return {
      category: ErrorCategory.UNKNOWN,
      originalMessage: "",
      isRetryable: false,
      suggestedAction: "Investigate missing error message",
    }
  }

  const msg = errorMessage.toLowerCase()

  // AUTH errors
  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("authentication")
  ) {
    return {
      category: ErrorCategory.AUTH,
      originalMessage: errorMessage,
      isRetryable: false,
      suggestedAction: "Check API credentials and permissions",
    }
  }

  // QUOTA errors (rate limiting)
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("quota exceeded") ||
    msg.includes("throttl")
  ) {
    return {
      category: ErrorCategory.QUOTA,
      originalMessage: errorMessage,
      isRetryable: true,
      suggestedAction: "Wait and retry with backoff, consider reducing concurrency",
    }
  }

  // NETWORK errors
  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up") ||
    msg.includes("dns") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  ) {
    return {
      category: ErrorCategory.NETWORK,
      originalMessage: errorMessage,
      isRetryable: true,
      suggestedAction: "Check network connectivity and retry",
    }
  }

  // TIMEOUT errors
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    msg.includes("deadline exceeded")
  ) {
    return {
      category: ErrorCategory.TIMEOUT,
      originalMessage: errorMessage,
      isRetryable: true,
      suggestedAction: "Increase timeout or break into smaller chunks",
    }
  }

  // PARSE errors
  if (
    msg.includes("json") ||
    msg.includes("parse") ||
    msg.includes("syntax error") ||
    msg.includes("unexpected token") ||
    msg.includes("no json object found")
  ) {
    return {
      category: ErrorCategory.PARSE,
      originalMessage: errorMessage,
      isRetryable: true, // LLM might produce valid JSON on retry
      suggestedAction: "Check prompt for JSON format requirements, retry",
    }
  }

  // VALIDATION errors
  if (
    msg.includes("validation") ||
    msg.includes("schema") ||
    msg.includes("invalid") ||
    msg.includes("required") ||
    msg.includes("not found in content")
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      originalMessage: errorMessage,
      isRetryable: false,
      suggestedAction: "Check input data quality and schema requirements",
    }
  }

  // EMPTY errors
  if (
    msg.includes("empty") ||
    msg.includes("no content") ||
    msg.includes("no text") ||
    msg.includes("no extractable") ||
    msg.includes("too small")
  ) {
    return {
      category: ErrorCategory.EMPTY,
      originalMessage: errorMessage,
      isRetryable: false,
      suggestedAction: "Check source content quality",
    }
  }

  // Default to UNKNOWN
  return {
    category: ErrorCategory.UNKNOWN,
    originalMessage: errorMessage,
    isRetryable: false,
    suggestedAction: "Investigate error details manually",
  }
}

/**
 * Get error category counts from a list of errors.
 * Useful for batch monitoring.
 */
export function categorizeErrors(errors: string[]): Record<ErrorCategory, number> {
  const counts: Record<ErrorCategory, number> = {
    [ErrorCategory.AUTH]: 0,
    [ErrorCategory.QUOTA]: 0,
    [ErrorCategory.NETWORK]: 0,
    [ErrorCategory.PARSE]: 0,
    [ErrorCategory.VALIDATION]: 0,
    [ErrorCategory.EMPTY]: 0,
    [ErrorCategory.TIMEOUT]: 0,
    [ErrorCategory.UNKNOWN]: 0,
  }

  for (const error of errors) {
    const classified = classifyError(error)
    counts[classified.category]++
  }

  return counts
}
