/**
 * Capability Resolution Hook
 *
 * Fetches and caches capability resolutions with SWR.
 * Used by Control Centers to determine what actions are available.
 * Supports revalidation for auto-refresh after actions.
 *
 * @module hooks
 * @since PHASE 3 - Capability State Refresh
 */

"use client"

import useSWR, { mutate as globalMutate } from "swr"
import type { CapabilityResponse } from "@/lib/capabilities/types"

/** Cache key prefix for capability resolution */
const CAPABILITY_CACHE_PREFIX = "capabilities:"

export interface UseCapabilityResolutionOptions {
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

export interface UseCapabilityResolutionReturn {
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
 * Build cache key from resolution options.
 * Sorts capability IDs for consistent caching regardless of input order.
 */
function buildCacheKey(opts: UseCapabilityResolutionOptions): string {
  const parts = [CAPABILITY_CACHE_PREFIX, ...opts.capabilityIds.slice().sort()]
  if (opts.entityId) parts.push(`entity:${opts.entityId}`)
  if (opts.entityType) parts.push(`type:${opts.entityType}`)
  return parts.join(":")
}

/**
 * Build API URL for capability resolution.
 */
function buildApiUrl(opts: UseCapabilityResolutionOptions): string {
  const params = new URLSearchParams()
  opts.capabilityIds.forEach((id) => params.append("capability", id))
  if (opts.entityId) params.set("entityId", opts.entityId)
  if (opts.entityType) params.set("entityType", opts.entityType)
  return `/api/capabilities/resolve?${params.toString()}`
}

/**
 * Fetch capabilities from API.
 */
async function fetchCapabilities(
  opts: UseCapabilityResolutionOptions
): Promise<CapabilityResponse[]> {
  const url = buildApiUrl(opts)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch capabilities: ${response.statusText}`)
  }
  const data = await response.json()
  // Handle both possible response shapes
  return data.capabilities ?? data.results ?? []
}

/**
 * Hook for fetching capability resolutions with caching and revalidation.
 *
 * @example
 * const { capabilities, revalidate, isLoading } = useCapabilityResolution({
 *   capabilityIds: ["INV-003", "INV-004"],
 *   entityId: invoice.id,
 *   entityType: "EInvoice",
 * })
 *
 * // After action completes:
 * onSuccess: () => revalidate()
 */
export function useCapabilityResolution(
  options: UseCapabilityResolutionOptions
): UseCapabilityResolutionReturn {
  const cacheKey = buildCacheKey(options)

  const { data, error, isLoading, mutate } = useSWR<CapabilityResponse[]>(
    options.capabilityIds.length > 0 ? cacheKey : null,
    () => fetchCapabilities(options),
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
 * Revalidate all capability resolution caches matching a pattern.
 * Call this after an action to refresh all Control Centers.
 *
 * @param entityId - If provided, only revalidates caches for this entity
 */
export async function revalidateCapabilityResolution(entityId?: string): Promise<void> {
  await globalMutate(
    (key) =>
      typeof key === "string" &&
      key.startsWith(CAPABILITY_CACHE_PREFIX) &&
      (entityId ? key.includes(entityId) : true),
    undefined,
    { revalidate: true }
  )
}
