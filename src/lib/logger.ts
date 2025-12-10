// src/lib/logger.ts
import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    env: process.env.NODE_ENV,
    app: "fiskai",
  },
  redact: {
    paths: ["password", "passwordHash", "apiKey", "secret", "token"],
    censor: "[REDACTED]",
  },
})

// Create child loggers for different contexts
export const createLogger = (context: string) => logger.child({ context })

// Pre-configured loggers for common use cases
export const authLogger = createLogger("auth")
export const dbLogger = createLogger("database")
export const invoiceLogger = createLogger("e-invoice")
export const apiLogger = createLogger("api")
