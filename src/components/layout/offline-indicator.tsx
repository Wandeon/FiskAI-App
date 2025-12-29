"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePendingSyncCount, useBackgroundSync } from "@/lib/pwa/use-offline"

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState<boolean | null>(null)
  const pendingSyncCount = usePendingSyncCount()
  const { isSyncing, lastSyncResult } = useBackgroundSync()
  const [showSyncSuccess, setShowSyncSuccess] = useState(false)

  useEffect(() => {
    const updateStatus = () => setIsOffline(!navigator.onLine)
    updateStatus()
    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)
    return () => {
      window.removeEventListener("online", updateStatus)
      window.removeEventListener("offline", updateStatus)
    }
  }, [])

  // Show success message briefly after sync completes
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.processed > 0) {
      setShowSyncSuccess(true)
      const timer = setTimeout(() => setShowSyncSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [lastSyncResult])

  // Show sync success toast
  if (showSyncSuccess && !isOffline) {
    return (
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        )}
        role="status"
        aria-live="polite"
      >
        <Check className="h-4 w-4" />
        Sinkronizirano: {lastSyncResult?.processed} promjena spremljeno.
      </div>
    )
  }

  // Show syncing indicator
  if (isSyncing && !isOffline) {
    return (
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-interactive px-4 py-2 text-sm font-semibold text-white shadow-lg"
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="h-4 w-4 animate-spin" />
        Sinkronizacija...
      </div>
    )
  }

  if (!isOffline) return null

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4" />
      Izvan mreže: izmjene će se spremiti kada se veza vrati.
      {pendingSyncCount > 0 && (
        <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {pendingSyncCount} na čekanju
        </span>
      )}
    </div>
  )
}
