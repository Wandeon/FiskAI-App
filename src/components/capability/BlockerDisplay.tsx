// src/components/capability/BlockerDisplay.tsx
/**
 * Blocker Display
 *
 * Renders blockers that prevent capability execution.
 * Shows machine-readable codes and resolution hints.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { BlockerDisplayProps } from "./types"

export function BlockerDisplay({ blockers, showResolution = true }: BlockerDisplayProps) {
  if (blockers.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {blockers.map((blocker, index) => (
        <Alert key={index} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-mono text-xs">{blocker.type}</AlertTitle>
          <AlertDescription>
            <p>{blocker.message}</p>
            {showResolution && blocker.resolution && (
              <p className="mt-1 text-xs opacity-80">Rješenje: {blocker.resolution}</p>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
