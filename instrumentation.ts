// instrumentation.ts
// Next.js instrumentation file for Sentry integration and server startup tasks
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from "@sentry/nextjs"

export async function register() {
  // Server-side initialization (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry
    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Sample rate for performance monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

      // Only send errors in production
      enabled: process.env.NODE_ENV === "production",

      // Disable debug logging
      debug: false,

      // Capture console.error calls
      integrations: [
        Sentry.captureConsoleIntegration({
          levels: ["error"],
        }),
      ],

      // Filter out sensitive data before sending
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers["authorization"]
          delete event.request.headers["cookie"]
          delete event.request.headers["x-api-key"]
        }
        return event
      },

      // Ignore common non-actionable errors
      ignoreErrors: [
        // Network errors users can't control
        "Failed to fetch",
        "NetworkError",
        "Load failed",
        // Browser extensions
        "ResizeObserver loop",
        // Auth redirects (expected behavior)
        "NEXT_REDIRECT",
      ],
    })

    // NOTE: Regulatory truth scheduler moved to fiskai-intelligence service
    // The scheduler is now managed separately and accessed via Intelligence API
  }

  // Edge runtime Sentry initialization (middleware, edge routes)
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Lower sample rate for edge (high volume)
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1,

      // Only send errors in production
      enabled: process.env.NODE_ENV === "production",

      debug: false,
    })
  }
}

// Capture errors from nested React Server Components
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-server-components
export const onRequestError = Sentry.captureRequestError
