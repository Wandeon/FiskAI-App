// src/components/capability/QueueRenderer.tsx
/**
 * Queue Renderer
 *
 * Renders a queue of items with capability-driven state.
 * This is a server component - resolution happens server-side.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { QueueItemCard } from "./QueueItem"
import type { QueueItem, QueueDefinition } from "./types"

interface Props {
  /** Queue definition */
  queue: QueueDefinition
  /** Items in the queue with resolved capabilities */
  items: QueueItem[]
  /** Show diagnostics */
  showDiagnostics?: boolean
  /** Empty state message */
  emptyMessage?: string
}

export function QueueRenderer({
  queue,
  items,
  showDiagnostics = false,
  emptyMessage = "No items in this queue",
}: Props) {
  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">{queue.name}</h3>
        <p className="text-sm text-muted-foreground">{queue.description}</p>
        {showDiagnostics && (
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Capabilities: {queue.capabilityIds.join(", ")}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <QueueItemCard key={item.id} item={item} showDiagnostics={showDiagnostics} />
          ))}
        </div>
      )}
    </div>
  )
}
