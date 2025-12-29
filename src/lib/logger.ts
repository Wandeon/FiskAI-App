// src/lib/logger.ts
import pino from "pino"
import { getContext } from "./context"

const isDev = process.env.NODE_ENV !== "production"
const lokiUrl = process.env.LOKI_URL
const lokiEnabled = !!lokiUrl && !isDev

// Build transport targets for log aggregation
function buildTransport() {
  if (isDev) {
    // In dev mode, use synchronous stdout only
    return undefined
  }

  const targets: pino.TransportTargetOptions[] = [
    // Always output to stdout for container logs
    { target: "pino/file", options: { destination: 1 }, level: "info" },
  ]

  // Add Loki transport if configured
  if (lokiEnabled) {
    targets.push({
      target: "pino-loki",
      options: {
        host: lokiUrl,
        labels: { app: "fiskai", env: process.env.NODE_ENV || "production" },
        batching: true,
        interval: 5, // Send logs every 5 seconds
      },
      level: "info",
    })
  }

  return pino.transport({ targets })
}

// In dev mode, don't use pino-pretty transport (worker threads crash with Next.js HMR)
// Instead use synchronous pretty printing via pino's built-in formatters
const transport = buildTransport()
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    base: {
      env: process.env.NODE_ENV,
      app: "fiskai",
    },
    // Use synchronous formatting in dev instead of worker-based transport
    ...(isDev && {
      formatters: {
        level: (label) => ({ level: label }),
      },
    }),
    mixin() {
      const context = getContext()
      if (!context) return {}
      return {
        requestId: context.requestId,
        userId: context.userId,
        companyId: context.companyId,
        path: context.path,
        method: context.method,
      }
    },
    redact: {
      // Use wildcard paths to redact sensitive fields at any nesting level
      // e.g., user.password, data.credentials.apiKey, etc.
      paths: [
        // Top-level sensitive fields
        "password",
        "passwordHash",
        "apiKey",
        "secret",
        "token",
        "accessToken",
        "refreshToken",
        "authorization",
        "cookie",
        "sessionId",
        "creditCard",
        "cardNumber",
        "cvv",
        "ssn",
        // Nested sensitive fields (any depth)
        "*.password",
        "*.passwordHash",
        "*.apiKey",
        "*.secret",
        "*.token",
        "*.accessToken",
        "*.refreshToken",
        "*.authorization",
        "*.cookie",
        "*.sessionId",
        "*.creditCard",
        "*.cardNumber",
        "*.cvv",
        "*.ssn",
        // Deeply nested (2+ levels)
        "*.*.password",
        "*.*.passwordHash",
        "*.*.apiKey",
        "*.*.secret",
        "*.*.token",
        "*.*.accessToken",
        "*.*.refreshToken",
        // Common nested patterns
        "headers.authorization",
        "headers.cookie",
        "body.password",
        "body.passwordHash",
        "data.password",
        "data.secret",
        "user.password",
        "user.passwordHash",
        "credentials.password",
        "credentials.apiKey",
        "credentials.secret",
      ],
      censor: "[REDACTED]",
    },
  },
  transport
)

// Create child loggers for different contexts
export const createLogger = (context: string) => logger.child({ context })

// Pre-configured loggers for common use cases
export const authLogger = createLogger("auth")
export const dbLogger = createLogger("database")
export const invoiceLogger = createLogger("e-invoice")
export const apiLogger = createLogger("api")
export const assistantLogger = createLogger("assistant")
export const bankingLogger = createLogger("banking")
