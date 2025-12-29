"use client"

import { WifiOff, RefreshCw, Check, AlertCircle } from "lucide-react"

interface OfflineIndicatorProps {
  online: boolean
  pendingCount: number
  syncing: boolean
}

export function OfflineIndicator({ online, pendingCount, syncing }: OfflineIndicatorProps) {
  // Show nothing if online and no pending sales
  if (online && pendingCount === 0) {
    return null
  }

  // Syncing state
  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-link bg-info-bg px-2 py-1 rounded">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Sinkronizacija...</span>
      </div>
    )
  }

  // Online with pending sales (syncing completed)
  if (online && pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning-text bg-warning-bg px-2 py-1 rounded">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{pendingCount} na čekanju</span>
      </div>
    )
  }

  // Offline mode
  return (
    <div className="flex items-center gap-1.5 text-xs text-danger-text bg-danger-bg px-2 py-1 rounded">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline{pendingCount > 0 ? ` (${pendingCount})` : ""}</span>
    </div>
  )
}
