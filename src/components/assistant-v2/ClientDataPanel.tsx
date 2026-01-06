"use client"

import React from "react"
import { motion } from "framer-motion"
import { Loader2, AlertCircle } from "lucide-react"
import type { ClientContextBlock, ControllerStatus } from "@/lib/assistant/client"
import { DataPointList } from "./DataPointList"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface ClientDataPanelProps {
  clientContext: ClientContextBlock | undefined
  status: ControllerStatus
  onConnectData?: () => void
  className?: string
  variant?: AssistantVariant
}

// Scan-line animation for loading state
function ScanLineOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-x-0 h-6 bg-gradient-to-b from-accent/5 to-transparent"
        initial={{ y: "-100%" }}
        animate={{ y: "100%" }}
        transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
      />
    </motion.div>
  )
}

export function ClientDataPanel({
  clientContext,
  status,
  onConnectData,
  className,
  variant = "light",
}: ClientDataPanelProps) {
  const isLoading = status === "LOADING"
  const isPartialComplete = status === "PARTIAL_COMPLETE"
  const isEmpty = !clientContext && status !== "LOADING"
  const isDark = variant === "dark"

  const baseCardClass = isDark
    ? "bg-surface-elevated/40 backdrop-blur-md border border-subtle/50 rounded-xl"
    : "border rounded-lg"

  return (
    <section
      id="assistant-client-data"
      aria-label="Your data"
      className={cn(baseCardClass, className)}
    >
      <header
        className={cn(
          "p-4 border-b flex items-center justify-between",
          isDark ? "border-subtle/50" : "border-border"
        )}
      >
        <h3 className={cn("font-medium", isDark ? "text-white" : "text-foreground")}>Your data</h3>
        {clientContext?.completeness && (
          <span className={cn("text-xs", isDark ? "text-muted" : "text-muted-foreground")}>
            {Math.round(clientContext.completeness.score * 100)}% complete
          </span>
        )}
      </header>

      <div className="p-4 relative">
        {/* Loading skeleton */}
        {isLoading && (
          <div data-testid="client-data-skeleton" className="space-y-3 relative">
            {isDark && <ScanLineOverlay />}
            <div
              className={cn(
                "h-4 rounded w-1/2",
                isDark ? "bg-surface-elevated/50 animate-pulse" : "bg-muted animate-pulse"
              )}
            />
            <div
              className={cn(
                "h-8 rounded",
                isDark ? "bg-surface-elevated/50 animate-pulse" : "bg-muted animate-pulse"
              )}
            />
            <div
              className={cn(
                "h-4 rounded w-3/4",
                isDark ? "bg-surface-elevated/50 animate-pulse" : "bg-muted animate-pulse"
              )}
            />
            {isDark && (
              <motion.span
                className="text-accent-light/70 text-xs"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Učitavam podatke...
              </motion.span>
            )}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <p className={cn("text-sm", isDark ? "text-muted" : "text-muted-foreground")}>
            Your data will appear here
          </p>
        )}

        {/* Syncing indicator */}
        {isPartialComplete && (
          <div
            className={cn(
              "flex items-center gap-2 text-sm mb-4",
              isDark ? "text-accent-light" : "text-muted-foreground"
            )}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Still syncing your data...</span>
          </div>
        )}

        {/* Client context content */}
        {clientContext && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Computed result (highlighted) */}
            {clientContext.computedResult && (
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  isDark ? "bg-accent/10 border-interactive/30" : "bg-primary/5 border-primary/20"
                )}
              >
                <p className={cn("text-xs", isDark ? "text-muted" : "text-muted-foreground")}>
                  {clientContext.computedResult.label}
                </p>
                <p
                  className={cn(
                    "text-xl font-semibold",
                    isDark ? "text-accent-light" : "text-primary"
                  )}
                >
                  {clientContext.computedResult.value}
                </p>
                {clientContext.computedResult.explanation && (
                  <p
                    className={cn("text-xs mt-1", isDark ? "text-muted" : "text-muted-foreground")}
                  >
                    {clientContext.computedResult.explanation}
                  </p>
                )}
              </div>
            )}

            {/* Data points used */}
            {clientContext.used.length > 0 && (
              <DataPointList dataPoints={clientContext.used} theme={variant} />
            )}

            {/* Completeness notes */}
            {clientContext.completeness.notes && (
              <p className={cn("text-xs", isDark ? "text-muted" : "text-muted-foreground")}>
                {clientContext.completeness.notes}
              </p>
            )}

            {/* Assumptions */}
            {clientContext.assumptions && clientContext.assumptions.length > 0 && (
              <div className="text-xs">
                <p
                  className={cn(
                    "font-medium mb-1",
                    isDark ? "text-muted" : "text-muted-foreground"
                  )}
                >
                  Assumptions:
                </p>
                <ul className="space-y-0.5">
                  {clientContext.assumptions.map((assumption, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex gap-1",
                        isDark ? "text-tertiary" : "text-muted-foreground"
                      )}
                    >
                      <span>•</span>
                      <span>{assumption}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing data */}
            {clientContext.missing && clientContext.missing.length > 0 && (
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  isDark
                    ? "bg-warning-bg/30 border-warning/30"
                    : "bg-warning-bg border-warning-border"
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className={cn(
                      "w-4 h-4 mt-0.5 shrink-0",
                      isDark ? "text-warning" : "text-warning-text"
                    )}
                  />
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-warning-text" : "text-warning-text"
                      )}
                    >
                      Missing data
                    </p>
                    <ul className="mt-1 space-y-1">
                      {clientContext.missing.map((item, i) => (
                        <li
                          key={i}
                          className={cn(
                            "text-xs",
                            isDark ? "text-warning/80" : "text-warning-text"
                          )}
                        >
                          <strong>{item.label}</strong>
                          {item.impact && <span> — {item.impact}</span>}
                        </li>
                      ))}
                    </ul>
                    {onConnectData && (
                      <motion.button
                        type="button"
                        onClick={onConnectData}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "mt-2 text-xs px-3 py-1.5 rounded transition-colors",
                          isDark
                            ? "bg-warning-bg/20 text-warning-text border border-warning/30 hover:bg-warning-bg/30"
                            : "bg-warning text-white hover:bg-warning/80"
                        )}
                      >
                        Connect your data
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  )
}
