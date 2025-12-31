/**
 * POS Offline Queue
 *
 * Provides IndexedDB-based storage for offline POS sales.
 * Croatian compliance: ZKI can be generated offline, JIR requires CIS connection.
 * JIR must be obtained within 48 hours.
 */

import type { CartItem } from "@/app/(app)/pos/types"

export interface PendingSale {
  id: string
  items: CartItem[]
  paymentMethod: "CASH" | "CARD"
  total: number
  zki?: string // Generated offline
  createdAt: number // Timestamp
  syncAttempts: number
  lastSyncAttempt?: number
}

const DB_NAME = "fiskai-pos-offline"
const DB_VERSION = 1
const STORE_NAME = "pending-sales"
const CART_STORE = "cart-backup"

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Store for pending sales
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }

      // Store for cart backup (single entry)
      if (!db.objectStoreNames.contains(CART_STORE)) {
        db.createObjectStore(CART_STORE, { keyPath: "id" })
      }
    }
  })

  return dbPromise
}

/**
 * Add a sale to the offline queue
 */
export async function queueOfflineSale(
  sale: Omit<PendingSale, "id" | "createdAt" | "syncAttempts">
): Promise<PendingSale> {
  const db = await openDB()

  const pendingSale: PendingSale = {
    ...sale,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    syncAttempts: 0,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    const request = store.add(pendingSale)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(pendingSale)
  })
}

/**
 * Get all pending sales from the queue
 */
export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const index = store.index("createdAt")

    const request = index.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Get count of pending sales
 */
export async function getPendingSaleCount(): Promise<number> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)

    const request = store.count()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Remove a sale from the queue (after successful sync)
 */
export async function removePendingSale(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Update sync attempt count for a sale
 */
export async function updateSyncAttempt(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    const getRequest = store.get(id)
    getRequest.onerror = () => reject(getRequest.error)
    getRequest.onsuccess = () => {
      const sale = getRequest.result as PendingSale | undefined
      if (!sale) {
        resolve()
        return
      }

      sale.syncAttempts++
      sale.lastSyncAttempt = Date.now()

      const putRequest = store.put(sale)
      putRequest.onerror = () => reject(putRequest.error)
      putRequest.onsuccess = () => resolve()
    }
  })
}

/**
 * Backup current cart to IndexedDB
 */
export async function backupCart(items: CartItem[]): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CART_STORE, "readwrite")
    const store = tx.objectStore(CART_STORE)

    const request = store.put({ id: "current", items, updatedAt: Date.now() })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Restore cart from IndexedDB backup
 */
export async function restoreCart(): Promise<CartItem[] | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CART_STORE, "readonly")
    const store = tx.objectStore(CART_STORE)

    const request = store.get("current")
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result as { items: CartItem[] } | undefined
      resolve(result?.items || null)
    }
  })
}

/**
 * Clear cart backup
 */
export async function clearCartBackup(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CART_STORE, "readwrite")
    const store = tx.objectStore(CART_STORE)

    const request = store.delete("current")
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

/**
 * Subscribe to online/offline changes
 */
export function subscribeToConnectivity(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}
