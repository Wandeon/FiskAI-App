"use client"

import React from "react"
import { Loader2, AlertCircle } from "lucide-react"
import type { ClientContextBlock, ControllerStatus } from "@/lib/assistant/client"
import { DataPointList } from "./DataPointList"
import { cn } from "@/lib/utils"

interface ClientDataPanelProps {
  clientContext: ClientContextBlock | undefined
  status: ControllerStatus
  onConnectData?: () => void
  className?: string
}

export function ClientDataPanel({
  clientContext,
  status,
  onConnectData,
  className,
}: ClientDataPanelProps) {
  const isLoading = status === "LOADING"
  const isPartialComplete = status === "PARTIAL_COMPLETE"
  const isEmpty = !clientContext && status !== "LOADING"

  return (
    <section
      id="assistant-client-data"
      aria-label="Your data"
      className={cn("border rounded-lg", className)}
    >
      <header className="p-4 border-b flex items-center justify-between">
        <h3 className="font-medium">Your data</h3>
        {clientContext?.completeness && (
          <span className="text-xs text-muted-foreground">
            {Math.round(clientContext.completeness.score * 100)}% complete
          </span>
        )}
      </header>

      <div className="p-4">
        {/* Loading skeleton */}
        {isLoading && (
          <div data-testid="client-data-skeleton" className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && <p className="text-sm text-muted-foreground">Your data will appear here</p>}

        {/* Syncing indicator */}
        {isPartialComplete && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Still syncing your data...</span>
          </div>
        )}

        {/* Client context content */}
        {clientContext && (
          <div className="space-y-4">
            {/* Computed result (highlighted) */}
            {clientContext.computedResult && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  {clientContext.computedResult.label}
                </p>
                <p className="text-xl font-semibold text-primary">
                  {clientContext.computedResult.value}
                </p>
                {clientContext.computedResult.explanation && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientContext.computedResult.explanation}
                  </p>
                )}
              </div>
            )}

            {/* Data points used */}
            {clientContext.used.length > 0 && <DataPointList dataPoints={clientContext.used} />}

            {/* Completeness notes */}
            {clientContext.completeness.notes && (
              <p className="text-xs text-muted-foreground">{clientContext.completeness.notes}</p>
            )}

            {/* Assumptions */}
            {clientContext.assumptions && clientContext.assumptions.length > 0 && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">Assumptions:</p>
                <ul className="space-y-0.5">
                  {clientContext.assumptions.map((assumption, i) => (
                    <li key={i} className="text-muted-foreground flex gap-1">
                      <span>•</span>
                      <span>{assumption}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing data */}
            {clientContext.missing && clientContext.missing.length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">Missing data</p>
                    <ul className="mt-1 space-y-1">
                      {clientContext.missing.map((item, i) => (
                        <li key={i} className="text-xs text-yellow-700">
                          <strong>{item.label}</strong>
                          {item.impact && <span> — {item.impact}</span>}
                        </li>
                      ))}
                    </ul>
                    {onConnectData && (
                      <button
                        type="button"
                        onClick={onConnectData}
                        className="mt-2 text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        Connect your data
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
