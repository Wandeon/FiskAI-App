"use client"

import { useEffect } from "react"
import { AlertCircle, Home, RefreshCw } from "lucide-react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"

interface ErrorDisplayProps {
  error: Error & { digest?: string }
  reset: () => void
  showHomeButton?: boolean
  title?: string
  message?: string
}

export function ErrorDisplay({
  error,
  reset,
  showHomeButton = true,
  title = "Došlo je do greške",
  message = "Nažalost, došlo je do neočekivane greške. Molimo pokušajte ponovno.",
}: ErrorDisplayProps) {
  useEffect(() => {
    // Capture error to Sentry for monitoring
    Sentry.captureException(error, {
      tags: {
        boundary: "route-error",
        errorTitle: title,
      },
      extra: {
        digest: error.digest,
      },
    })

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error boundary caught:", error)
      console.error("Stack trace:", error.stack)
    }
  }, [error, title])

  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-danger-bg p-4">
            <AlertCircle className="h-12 w-12 text-danger-text" />
          </div>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-foreground">{title}</h1>

        <p className="mb-6 text-base text-secondary">{message}</p>

        {isDevelopment && (
          <div className="mb-6 rounded-lg bg-surface-1 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Development Mode - Error Details:
            </p>
            <p className="mb-2 text-xs text-foreground">
              <strong>Message:</strong> {error.message}
            </p>
            {error.digest && (
              <p className="mb-2 text-xs text-foreground">
                <strong>Digest:</strong> {error.digest}
              </p>
            )}
            {error.stack && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-foreground">Stack Trace:</p>
                <pre className="max-h-48 overflow-auto rounded bg-base p-3 text-xs text-foreground">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-interactive px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-interactive-hover focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </button>

          {showHomeButton && (
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-default bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
            >
              <Home className="h-4 w-4" />
              Natrag na početnu
            </Link>
          )}
        </div>

        <div className="mt-6">
          <p className="text-sm text-tertiary">
            Ako se problem nastavi, molimo{" "}
            <Link href="/kontakt" className="font-medium text-link hover:text-link hover:underline">
              kontaktirajte našu podršku
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
