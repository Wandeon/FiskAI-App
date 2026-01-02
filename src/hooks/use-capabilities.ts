/**
 * Capabilities Hook
 *
 * Fetches and caches capability resolutions with SWR.
 * Supports revalidation for auto-refresh after actions.
 *
 * @module hooks
 * @since Control Center Shells
 * @updated PHASE 3 - Capability State Refresh
 */

"use client"

import useSWR, { mutate as globalMutate } from "swr"
import type { CapabilityResponse } from "@/lib/capabilities/types"

/**
 * Options for the useCapabilities hook.
 */
export interface UseCapabilitiesOptions {
  /** Capability IDs to resolve */
  capabilityIds: string[]

  /** Entity ID for entity-specific resolution */
  entityId?: string

  /** Entity type */
  entityType?: string

  /** Initial data for SSR hydration */
  initialData?: CapabilityResponse[]

  /** Refresh interval in ms (0 = disabled) */
  refreshInterval?: number
}

/**
 * Return type for the useCapabilities hook.
 */
export interface UseCapabilitiesReturn {
  /** Resolved capabilities */
  capabilities: CapabilityResponse[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: Error | undefined

  /** Trigger revalidation */
  revalidate: () => Promise<void>

  /** Mutate cache (for optimistic updates) */
  mutate: (
    data?:
      | CapabilityResponse[]
      | Promise<CapabilityResponse[]>
      | ((current?: CapabilityResponse[]) => CapabilityResponse[])
  ) => Promise<CapabilityResponse[] | undefined>
}

/**
 * Build cache key for capability resolution.
 * Sorts capability IDs for consistent caching regardless of input order.
 */
function buildCacheKey(opts: UseCapabilitiesOptions): string {
  const parts = ["capabilities", ...opts.capabilityIds.slice().sort()]
  if (opts.entityId) parts.push(`entity:${opts.entityId}`)
  if (opts.entityType) parts.push(`type:${opts.entityType}`)
  return parts.join(":")
}

/**
 * Build API URL for capability resolution.
 * Sorts capability IDs for consistent requests.
 */
function buildApiUrl(opts: UseCapabilitiesOptions): string {
  const params = new URLSearchParams()

  // Sort capability IDs for consistent ordering
  opts.capabilityIds
    .slice()
    .sort()
    .forEach((id) => params.append("capability", id))

  if (opts.entityId) params.set("entityId", opts.entityId)
  if (opts.entityType) params.set("entityType", opts.entityType)

  return `/api/capabilities/resolve?${params.toString()}`
}

/**
 * Fetch capabilities from API.
 */
async function fetchCapabilities(url: string): Promise<CapabilityResponse[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to fetch capabilities")
  }
  const data = await response.json()
  return data.capabilities ?? data.results ?? []
}

/**
 * Hook for fetching capability resolutions with caching.
 *
 * @example
 * const { capabilities, revalidate, isLoading } = useCapabilities({
 *   capabilityIds: ["INV-003", "INV-004"],
 *   entityId: invoice.id,
 *   entityType: "EInvoice",
 * })
 *
 * // After action completes:
 * onSuccess: () => revalidate()
 */
export function useCapabilities(options: UseCapabilitiesOptions): UseCapabilitiesReturn {
  const cacheKey = buildCacheKey(options)
  const apiUrl = buildApiUrl(options)

  const { data, error, isLoading, mutate } = useSWR<CapabilityResponse[]>(
    options.capabilityIds.length > 0 ? cacheKey : null,
    () => fetchCapabilities(apiUrl),
    {
      fallbackData: options.initialData,
      refreshInterval: options.refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 2000, // Prevent duplicate requests within 2s
    }
  )

  const revalidate = async (): Promise<void> => {
    await mutate()
  }

  const mutateFn = async (
    newData?:
      | CapabilityResponse[]
      | Promise<CapabilityResponse[]>
      | ((current?: CapabilityResponse[]) => CapabilityResponse[])
  ): Promise<CapabilityResponse[] | undefined> => {
    return await mutate(newData)
  }

  return {
    capabilities: data ?? [],
    isLoading,
    error,
    revalidate,
    mutate: mutateFn,
  }
}

/**
 * Cache key prefix for capability caches.
 */
const CAPABILITY_CACHE_PREFIX = "capabilities:"

/**
 * Revalidate all capability caches matching a pattern.
 * Call this after an action to refresh all Control Centers.
 *
 * @param entityId - Optional entity ID to filter revalidation
 *
 * @example
 * // Revalidate all capabilities for an entity after action
 * await revalidateCapabilities(invoice.id)
 *
 * // Revalidate all capability caches
 * await revalidateCapabilities()
 */
export async function revalidateCapabilities(entityId?: string): Promise<void> {
  // Revalidate all keys starting with "capabilities:"
  await globalMutate(
    (key) =>
      typeof key === "string" &&
      key.startsWith(CAPABILITY_CACHE_PREFIX) &&
      (entityId ? key.includes(entityId) : true),
    undefined,
    { revalidate: true }
  )
}
