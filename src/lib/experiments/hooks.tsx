/**
 * React Hooks for A/B Testing
 *
 * Client-side hooks for using experiments in React components.
 * @see GitHub issue #292
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import type { ExperimentAssignmentResult } from "./types"

/**
 * Hook to assign user to an experiment and get their variant
 */
export function useExperiment(experimentId: string) {
  const [assignment, setAssignment] = useState<ExperimentAssignmentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const assignUser = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/experiments/assign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ experimentId }),
        })

        if (!response.ok) {
          if (response.status === 404) {
            // User not eligible for experiment
            setAssignment(null)
            return
          }
          throw new Error("Failed to assign user to experiment")
        }

        const data = await response.json()
        setAssignment(data.assignment)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    assignUser()
  }, [experimentId])

  return {
    assignment,
    variant: assignment?.variantName,
    config: assignment?.config,
    isControl: assignment?.isControl,
    loading,
    error,
  }
}

/**
 * Hook to check if user is in a specific variant
 */
export function useVariant(experimentId: string, variantName: string): boolean {
  const { variant, loading } = useExperiment(experimentId)

  if (loading) {
    return false
  }

  return variant === variantName
}

/**
 * Hook to get variant config value
 */
export function useVariantConfig<T = unknown>(
  experimentId: string,
  configKey: string,
  defaultValue: T
): T {
  const { config, loading } = useExperiment(experimentId)

  if (loading || !config) {
    return defaultValue
  }

  return (config[configKey] as T) ?? defaultValue
}

/**
 * Hook to track experiment exposure
 */
export function useExperimentTracking(experimentId: string) {
  const trackExposure = useCallback(async () => {
    try {
      await fetch(`/api/experiments/${experimentId}/exposure`, {
        method: "POST",
      })
    } catch (err) {
      console.error("Failed to track exposure:", err)
    }
  }, [experimentId])

  const trackConversion = useCallback(
    async (conversionName: string, properties?: Record<string, unknown>) => {
      try {
        await fetch(`/api/experiments/${experimentId}/conversion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ conversionName, properties }),
        })
      } catch (err) {
        console.error("Failed to track conversion:", err)
      }
    },
    [experimentId]
  )

  return {
    trackExposure,
    trackConversion,
  }
}

/**
 * Component to conditionally render content based on variant
 */
interface VariantProps {
  experimentId: string
  variant: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Variant({ experimentId, variant, children, fallback = null }: VariantProps) {
  const isVariant = useVariant(experimentId, variant)

  if (!isVariant) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Hook for A/B testing with feature flags
 * Combines experiment assignment with feature flag evaluation
 */
export function useFeatureExperiment(
  experimentId: string,
  featureFlagKey: string
): {
  enabled: boolean
  variant?: string
  config?: Record<string, unknown>
} {
  const { assignment, loading } = useExperiment(experimentId)

  if (loading || !assignment) {
    return { enabled: false }
  }

  // Check if variant enables the feature
  const enabled = assignment.config?.[featureFlagKey] === true

  return {
    enabled,
    variant: assignment.variantName,
    config: assignment.config,
  }
}
