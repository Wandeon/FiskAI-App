"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import type { AssistantError, ErrorType } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface ErrorCardProps {
  error: AssistantError
  onRetry: () => void
  isRetrying?: boolean
  className?: string
}

const RETRYABLE_ERRORS: ErrorType[] = ["NETWORK_TIMEOUT", "NETWORK_FAILURE", "SERVER_ERROR"]

export function ErrorCard({ error, onRetry, isRetrying = false, className }: ErrorCardProps) {
  const isRetryable = RETRYABLE_ERRORS.includes(error.type)
  const isRateLimited = error.type === "RATE_LIMITED"

  return (
    <article
      role="alert"
      className={cn("p-6 border border-destructive/50 rounded-lg bg-destructive/5", className)}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          data-testid="error-icon"
          className="w-5 h-5 text-destructive mt-0.5 shrink-0"
        />
        <div className="flex-1">
          <h2 className="font-medium text-destructive">
            {isRateLimited ? "Rate limit exceeded" : "Something went wrong"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>

          {isRetryable && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className={cn(
                "mt-3 inline-flex items-center gap-2 text-sm px-3 py-1.5",
                "border rounded-md transition-colors",
                "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
              {isRetrying ? "Trying..." : "Try again"}
            </button>
          )}

          {isRateLimited && (
            <p className="mt-2 text-xs text-muted-foreground">
              Please wait a moment before trying again.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
