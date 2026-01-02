/**
 * React hooks for offline data access
 *
 * Provides convenient hooks for components to access offline-first data
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchWithOffline,
  fetchOneWithOffline,
  createWithOffline,
  updateWithOffline,
  deleteWithOffline,
  processSyncQueue,
  getPendingSyncCount,
  isOnline,
  OfflineDataStore,
} from "./offline-manager"

/**
 * Hook to track online/offline status
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return online
}

/**
 * Hook to track pending sync count
 */
export function usePendingSyncCount() {
  const [count, setCount] = useState(0)
  const online = useOnlineStatus()

  useEffect(() => {
    const updateCount = async () => {
      const pendingCount = await getPendingSyncCount()
      setCount(pendingCount)
    }

    void updateCount()

    // Update count periodically
    const interval = setInterval(() => void updateCount(), 5000)
    return () => clearInterval(interval)
  }, [])

  // Process sync queue when coming back online
  useEffect(() => {
    if (online) {
      void processSyncQueue().then(async () => {
        const pendingCount = await getPendingSyncCount()
        setCount(pendingCount)
      })
    }
  }, [online])

  return count
}

interface UseOfflineDataOptions {
  companyId: string
  enabled?: boolean
}

interface UseOfflineDataResult<T> {
  data: T[]
  isLoading: boolean
  isFromCache: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching data with offline support
 */
export function useOfflineData<T>(
  storeName: OfflineDataStore,
  options: UseOfflineDataOptions
): UseOfflineDataResult<T> {
  const { companyId, enabled = true } = options
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled || !companyId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchWithOffline<T>(storeName, { companyId })
      setData(result.data)
      setIsFromCache(result.fromCache)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch data"))
    } finally {
      setIsLoading(false)
    }
  }, [storeName, companyId, enabled])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    isFromCache,
    error,
    refetch: fetchData,
  }
}

interface UseOfflineItemOptions {
  companyId: string
  enabled?: boolean
}

interface UseOfflineItemResult<T> {
  data: T | null
  isLoading: boolean
  isFromCache: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching a single item with offline support
 */
export function useOfflineItem<T>(
  storeName: OfflineDataStore,
  id: string | null,
  options: UseOfflineItemOptions
): UseOfflineItemResult<T> {
  const { companyId, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled || !companyId || !id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchOneWithOffline<T>(storeName, id, { companyId })
      setData(result.data)
      setIsFromCache(result.fromCache)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch item"))
    } finally {
      setIsLoading(false)
    }
  }, [storeName, id, companyId, enabled])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    isFromCache,
    error,
    refetch: fetchData,
  }
}

interface UseOfflineMutationResult<T> {
  create: (data: T) => Promise<{ data: T; queued: boolean }>
  update: (data: T) => Promise<{ data: T; queued: boolean }>
  remove: (id: string) => Promise<{ queued: boolean }>
  isPending: boolean
}

/**
 * Hook for mutations with offline support
 */
export function useOfflineMutation<T extends { id: string }>(
  storeName: OfflineDataStore,
  options: UseOfflineDataOptions
): UseOfflineMutationResult<T> {
  const { companyId } = options
  const [isPending, setIsPending] = useState(false)

  const create = useCallback(
    async (data: T) => {
      setIsPending(true)
      try {
        return await createWithOffline(storeName, data, { companyId })
      } finally {
        setIsPending(false)
      }
    },
    [storeName, companyId]
  )

  const update = useCallback(
    async (data: T) => {
      setIsPending(true)
      try {
        return await updateWithOffline(storeName, data, { companyId })
      } finally {
        setIsPending(false)
      }
    },
    [storeName, companyId]
  )

  const remove = useCallback(
    async (id: string) => {
      setIsPending(true)
      try {
        return await deleteWithOffline(storeName, id, { companyId })
      } finally {
        setIsPending(false)
      }
    },
    [storeName, companyId]
  )

  return {
    create,
    update,
    remove,
    isPending,
  }
}

/**
 * Hook to sync data when coming back online
 */
export function useBackgroundSync() {
  const online = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    processed: number
    failed: number
  } | null>(null)

  const sync = useCallback(async () => {
    if (!isOnline()) return

    setIsSyncing(true)
    try {
      const result = await processSyncQueue()
      setLastSyncResult(result)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (online) {
      void sync()
    }
  }, [online, sync])

  return {
    isSyncing,
    lastSyncResult,
    sync,
    isOnline: online,
  }
}
