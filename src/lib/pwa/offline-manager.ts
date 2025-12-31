/**
 * Offline Data Manager
 *
 * Provides offline-first data access with:
 * - Network-first with IndexedDB fallback for reads
 * - Optimistic updates with background sync for writes
 * - Automatic sync when connection is restored
 */

import {
  STORES,
  type SyncQueueItem,
  getByCompany,
  getById,
  putMany,
  put,
  remove,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  updateCacheMeta,
  isCacheStale,
} from "./offline-db"

// Cache expiry times in milliseconds
const CACHE_MAX_AGE = {
  [STORES.INVOICES]: 5 * 60 * 1000, // 5 minutes
  [STORES.EXPENSES]: 5 * 60 * 1000,
  [STORES.CONTACTS]: 30 * 60 * 1000, // 30 minutes
  [STORES.PRODUCTS]: 30 * 60 * 1000,
} as const

// API endpoints for each store
const API_ENDPOINTS = {
  [STORES.INVOICES]: "/api/invoices",
  [STORES.EXPENSES]: "/api/expenses",
  [STORES.CONTACTS]: "/api/contacts",
  [STORES.PRODUCTS]: "/api/products",
} as const

export type OfflineDataStore = keyof typeof API_ENDPOINTS

interface FetchOptions {
  forceNetwork?: boolean
  companyId: string
}

interface MutateOptions {
  companyId: string
  offlineEnabled?: boolean
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

/**
 * Fetch data with offline-first strategy
 * 1. If online and cache is stale, fetch from network and update cache
 * 2. If online and cache is fresh, return cached data
 * 3. If offline, return cached data
 */
export async function fetchWithOffline<T>(
  storeName: OfflineDataStore,
  options: FetchOptions
): Promise<{ data: T[]; fromCache: boolean }> {
  const { forceNetwork = false, companyId } = options

  // Try network first if online
  if (isOnline()) {
    const shouldFetchNetwork =
      forceNetwork || (await isCacheStale(storeName, CACHE_MAX_AGE[storeName]))

    if (shouldFetchNetwork) {
      try {
        const response = await fetch(`${API_ENDPOINTS[storeName]}?companyId=${companyId}`)
        if (response.ok) {
          const data = (await response.json()) as T[]
          // Update cache
          await putMany(storeName, data as (T & { id: string })[])
          await updateCacheMeta(storeName)
          return { data, fromCache: false }
        }
      } catch {
        // Network failed, fall through to cache
      }
    }
  }

  // Return cached data
  const cached = await getByCompany<T>(storeName, companyId)
  return { data: cached, fromCache: true }
}

/**
 * Fetch a single item with offline fallback
 */
export async function fetchOneWithOffline<T>(
  storeName: OfflineDataStore,
  id: string,
  options: FetchOptions
): Promise<{ data: T | null; fromCache: boolean }> {
  const { companyId } = options

  // Try network first if online
  if (isOnline()) {
    try {
      const response = await fetch(`${API_ENDPOINTS[storeName]}/${id}?companyId=${companyId}`)
      if (response.ok) {
        const data = (await response.json()) as T
        // Update cache
        await put(storeName, data as T & { id: string })
        return { data, fromCache: false }
      }
    } catch {
      // Network failed, fall through to cache
    }
  }

  // Return cached data
  const cached = await getById<T>(storeName, id)
  return { data: cached ?? null, fromCache: true }
}

/**
 * Create an item with offline support
 * - If online, create on server and cache
 * - If offline, cache locally and queue for sync
 */
export async function createWithOffline<T extends { id: string }>(
  storeName: OfflineDataStore,
  data: T,
  options: MutateOptions
): Promise<{ data: T; queued: boolean }> {
  const { offlineEnabled = true } = options

  // Save to local cache immediately (optimistic update)
  await put(storeName, data)

  if (isOnline()) {
    try {
      const response = await fetch(API_ENDPOINTS[storeName], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        const serverData = (await response.json()) as T
        // Update cache with server response (may have different id or timestamps)
        await put(storeName, serverData)
        return { data: serverData, queued: false }
      }
    } catch {
      // Network failed, queue for sync
    }
  }

  // Queue for background sync if offline support is enabled
  if (offlineEnabled) {
    await addToSyncQueue({
      action: "create",
      store: storeName,
      data: data as Record<string, unknown>,
    })
  }

  return { data, queued: true }
}

/**
 * Update an item with offline support
 */
export async function updateWithOffline<T extends { id: string }>(
  storeName: OfflineDataStore,
  data: T,
  options: MutateOptions
): Promise<{ data: T; queued: boolean }> {
  const { offlineEnabled = true } = options

  // Save to local cache immediately (optimistic update)
  await put(storeName, data)

  if (isOnline()) {
    try {
      const response = await fetch(`${API_ENDPOINTS[storeName]}/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        const serverData = (await response.json()) as T
        await put(storeName, serverData)
        return { data: serverData, queued: false }
      }
    } catch {
      // Network failed, queue for sync
    }
  }

  if (offlineEnabled) {
    await addToSyncQueue({
      action: "update",
      store: storeName,
      data: data as Record<string, unknown>,
    })
  }

  return { data, queued: true }
}

/**
 * Delete an item with offline support
 */
export async function deleteWithOffline(
  storeName: OfflineDataStore,
  id: string,
  options: MutateOptions
): Promise<{ queued: boolean }> {
  const { offlineEnabled = true } = options

  // Remove from local cache immediately
  await remove(storeName, id)

  if (isOnline()) {
    try {
      const response = await fetch(`${API_ENDPOINTS[storeName]}/${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        return { queued: false }
      }
    } catch {
      // Network failed, queue for sync
    }
  }

  if (offlineEnabled) {
    await addToSyncQueue({
      action: "delete",
      store: storeName,
      data: { id },
    })
  }

  return { queued: true }
}

/**
 * Process the sync queue (called when connection is restored)
 */
export async function processSyncQueue(): Promise<{
  processed: number
  failed: number
}> {
  const queue = await getSyncQueue()
  let processed = 0
  let failed = 0

  for (const item of queue) {
    try {
      const success = await processSyncItem(item)
      if (success) {
        await removeFromSyncQueue(item.id)
        processed++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { processed, failed }
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
  const endpoint = API_ENDPOINTS[item.store as OfflineDataStore]
  if (!endpoint) return false

  try {
    let response: Response

    switch (item.action) {
      case "create":
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        })
        break
      case "update":
        response = await fetch(`${endpoint}/${item.data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        })
        break
      case "delete":
        response = await fetch(`${endpoint}/${item.data.id}`, {
          method: "DELETE",
        })
        break
      default:
        return false
    }

    return response.ok
  } catch {
    return false
  }
}

/**
 * Get the count of pending sync items
 */
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue()
  return queue.length
}

/**
 * Clear all offline data and sync queue
 */
export async function clearOfflineData(): Promise<void> {
  const { clear } = await import("./offline-db")
  await Promise.all([
    clear(STORES.INVOICES),
    clear(STORES.EXPENSES),
    clear(STORES.CONTACTS),
    clear(STORES.PRODUCTS),
    clear(STORES.SYNC_QUEUE),
    clear(STORES.CACHE_META),
  ])
}
