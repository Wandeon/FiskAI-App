"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import useSWR from "swr"

/**
 * Feature flag evaluation result from API
 */
interface FeatureFlagResult {
  enabled: boolean
  source: "default" | "rollout" | "override" | "status"
}

/**
 * Multiple flags evaluation result
 */
type FlagsResult = Record<string, boolean>

/**
 * Hook return type
 */
interface UseFeatureFlagReturn {
  enabled: boolean
  loading: boolean
  error: Error | undefined
  source: FeatureFlagResult["source"] | null
  refresh: () => Promise<void>
}

/**
 * Hook return type for multiple flags
 */
interface UseFeatureFlagsReturn {
  flags: FlagsResult
  loading: boolean
  error: Error | undefined
  refresh: () => Promise<void>
}

// API fetcher
const fetcher = async (url: string): Promise<FeatureFlagResult> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch feature flag: ${res.statusText}`)
  }
  return res.json()
}

const flagsFetcher = async (url: string): Promise<FlagsResult> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch feature flags: ${res.statusText}`)
  }
  return res.json()
}

/**
 * React hook for evaluating a single feature flag
 *
 * @param key - Feature flag key
 * @param defaultValue - Default value while loading or on error
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { enabled, loading } = useFeatureFlag("new_dashboard")
 *
 *   if (loading) return <Skeleton />
 *   if (!enabled) return <OldDashboard />
 *   return <NewDashboard />
 * }
 * ```
 */
export function useFeatureFlag(key: string, defaultValue = false): UseFeatureFlagReturn {
  const { data, error, isLoading, mutate } = useSWR<FeatureFlagResult>(
    `/api/feature-flags/evaluate?key=${encodeURIComponent(key)}`,
    fetcher,
    {
      // Cache for 60 seconds, revalidate in background
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      revalidateIfStale: true,
      // Fallback to default on error
      fallbackData: { enabled: defaultValue, source: "default" },
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return {
    enabled: data?.enabled ?? defaultValue,
    loading: isLoading,
    error,
    source: data?.source ?? null,
    refresh,
  }
}

/**
 * React hook for evaluating multiple feature flags at once
 *
 * @param keys - Array of feature flag keys
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { flags, loading } = useFeatureFlags(["new_dashboard", "dark_mode"])
 *
 *   if (loading) return <Skeleton />
 *   return (
 *     <div className={flags.dark_mode ? "dark" : ""}>
 *       {flags.new_dashboard ? <NewDashboard /> : <OldDashboard />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFeatureFlags(keys: string[]): UseFeatureFlagsReturn {
  const queryString = useMemo(
    () => keys.map((k) => `keys=${encodeURIComponent(k)}`).join("&"),
    [keys]
  )

  const { data, error, isLoading, mutate } = useSWR<FlagsResult>(
    keys.length > 0 ? `/api/feature-flags/evaluate-batch?${queryString}` : null,
    flagsFetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      revalidateIfStale: true,
      fallbackData: Object.fromEntries(keys.map((k) => [k, false])),
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return {
    flags: data ?? Object.fromEntries(keys.map((k) => [k, false])),
    loading: isLoading,
    error,
    refresh,
  }
}

/**
 * Simple synchronous hook for feature flags with localStorage fallback
 * Use when you need immediate access without API call
 *
 * @param key - Feature flag key
 * @param defaultValue - Default value
 */
export function useFeatureFlagSync(key: string, defaultValue = false): boolean {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return defaultValue
    const cached = localStorage.getItem(`ff_${key}`)
    if (cached) {
      try {
        const { value, expiry } = JSON.parse(cached)
        if (expiry > Date.now()) return value
        localStorage.removeItem(`ff_${key}`)
      } catch {
        localStorage.removeItem(`ff_${key}`)
      }
    }
    return defaultValue
  })

  useEffect(() => {
    // Fetch and cache in background
    fetch(`/api/feature-flags/evaluate?key=${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data: FeatureFlagResult) => {
        setEnabled(data.enabled)
        // Cache for 5 minutes
        const expiry = Date.now() + 5 * 60 * 1000
        localStorage.setItem(`ff_${key}`, JSON.stringify({ value: data.enabled, expiry }))
      })
      .catch(() => {
        // Silently fail, use cached or default
      })
  }, [key])

  return enabled
}
