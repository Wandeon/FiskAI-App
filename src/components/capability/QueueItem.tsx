// src/components/capability/QueueItem.tsx
/**
 * Queue Item
 *
 * Renders a single item in a queue with its capability state.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CapabilityStateIndicator } from "./CapabilityStateIndicator"
import { BlockerDisplay } from "./BlockerDisplay"
import { ActionButton } from "./ActionButton"
import type { QueueItem as QueueItemType } from "./types"

interface Props {
  item: QueueItemType
  showDiagnostics?: boolean
}

export function QueueItemCard({ item, showDiagnostics = false }: Props) {
  // Find the primary capability (first READY, or first in list)
  const primaryCapability =
    item.capabilities.find((c) => c.state === "READY") || item.capabilities[0]

  return (
    <Card className="relative">
      {showDiagnostics && (
        <div className="absolute top-2 right-2 text-[10px] font-mono bg-muted px-2 py-1 rounded">
          {item.type}:{item.id.slice(0, 8)}
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{item.title}</CardTitle>
          {primaryCapability && <CapabilityStateIndicator state={primaryCapability.state} />}
        </div>
        <p className="text-sm text-muted-foreground">
          Status: {item.status} | {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent>
        {/* Show blockers if any capability is blocked */}
        {item.capabilities.some((c) => c.state === "BLOCKED") && (
          <div className="mb-4">
            <BlockerDisplay
              blockers={item.capabilities.flatMap((c) => c.blockers)}
              showResolution
            />
          </div>
        )}

        {/* Show available actions */}
        <div className="flex flex-wrap gap-2">
          {item.capabilities.map((cap) =>
            cap.actions
              .filter((a) => cap.state === "READY" || !a.enabled)
              .map((action) => (
                <ActionButton
                  key={`${cap.capability}-${action.id}`}
                  action={action}
                  capabilityId={cap.capability}
                  showDiagnostics={showDiagnostics}
                />
              ))
          )}
        </div>

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-mono text-muted-foreground">
              Capability Diagnostics
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
              {JSON.stringify(item.capabilities, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
