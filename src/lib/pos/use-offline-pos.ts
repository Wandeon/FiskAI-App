/**
 * React hook for POS offline mode support
 *
 * Handles:
 * - Online/offline detection
 * - Queue management
 * - Automatic sync when back online
 * - Cart persistence
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { CartItem } from "@/app/(app)/pos/types"
import {
  isOnline,
  subscribeToConnectivity,
  queueOfflineSale,
  getPendingSales,
  getPendingSaleCount,
  removePendingSale,
  updateSyncAttempt,
  backupCart,
  restoreCart,
  clearCartBackup,
  type PendingSale,
} from "./offline-queue"
import { processPosSale } from "@/app/actions/pos"

interface UseOfflinePosOptions {
  onSyncSuccess?: (saleId: string) => void
  onSyncError?: (saleId: string, error: string) => void
}

interface UseOfflinePosReturn {
  /** Whether we're currently online */
  online: boolean
  /** Number of pending sales waiting to sync */
  pendingCount: number
  /** Whether sync is currently in progress */
  syncing: boolean
  /** Queue a sale for offline processing */
  queueSale: (
    items: CartItem[],
    paymentMethod: "CASH" | "CARD",
    total: number
  ) => Promise<PendingSale>
  /** Manually trigger sync */
  syncNow: () => Promise<void>
  /** Backup cart items to IndexedDB */
  saveCart: (items: CartItem[]) => Promise<void>
  /** Restore cart items from IndexedDB */
  loadCart: () => Promise<CartItem[] | null>
  /** Clear saved cart */
  clearSavedCart: () => Promise<void>
}

export function useOfflinePos(options: UseOfflinePosOptions = {}): UseOfflinePosReturn {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingSaleCount()
      setPendingCount(count)
    } catch (error) {
      console.error("Failed to get pending count:", error)
    }
  }, [])

  const syncPendingSales = useCallback(async () => {
    // Prevent concurrent syncs
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)

    try {
      const pending = await getPendingSales()

      for (const sale of pending) {
        // Skip if too many attempts (manual intervention needed)
        if (sale.syncAttempts >= 5) continue

        try {
          await updateSyncAttempt(sale.id)

          const result = await processPosSale({
            items: sale.items.map((item) => ({
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
            })),
            paymentMethod: sale.paymentMethod,
          })

          if (result.success) {
            await removePendingSale(sale.id)
            optionsRef.current.onSyncSuccess?.(sale.id)
          } else {
            optionsRef.current.onSyncError?.(sale.id, result.error || "Unknown error")
          }
        } catch (error) {
          console.error(`Failed to sync sale ${sale.id}:`, error)
          optionsRef.current.onSyncError?.(
            sale.id,
            error instanceof Error ? error.message : "Network error"
          )
        }
      }

      await updatePendingCount()
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [updatePendingCount])

  // Initialize online status
  useEffect(() => {
    setOnline(isOnline())

    const unsubscribe = subscribeToConnectivity((isNowOnline) => {
      setOnline(isNowOnline)
      if (isNowOnline) {
        // Auto-sync when back online
        syncPendingSales()
      }
    })

    return unsubscribe
  }, [syncPendingSales])

  // Load pending count on mount
  useEffect(() => {
    updatePendingCount()
  }, [updatePendingCount])

  const queueSale = useCallback(
    async (
      items: CartItem[],
      paymentMethod: "CASH" | "CARD",
      total: number
    ): Promise<PendingSale> => {
      const sale = await queueOfflineSale({ items, paymentMethod, total })
      await updatePendingCount()
      return sale
    },
    [updatePendingCount]
  )

  const saveCart = useCallback(async (items: CartItem[]) => {
    await backupCart(items)
  }, [])

  const loadCart = useCallback(async () => {
    return restoreCart()
  }, [])

  const clearSavedCart = useCallback(async () => {
    await clearCartBackup()
  }, [])

  return {
    online,
    pendingCount,
    syncing,
    queueSale,
    syncNow: syncPendingSales,
    saveCart,
    loadCart,
    clearSavedCart,
  }
}
