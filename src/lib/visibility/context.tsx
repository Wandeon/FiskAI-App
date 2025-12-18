"use client"

// src/lib/visibility/context.tsx
// React Context for visibility state management

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { LegalForm } from "@/lib/capabilities"
import type { ElementId } from "./elements"
import {
  type CompetenceLevel,
  type ProgressionStage,
  calculateActualStage,
  getEffectiveStage,
  isHiddenByBusinessType,
  isHiddenByCompetence,
  isLockedByProgression,
  getUnlockHintForElement,
  getNextAction,
  STAGE_ORDER,
} from "./rules"

// ============================================================================
// Types
// ============================================================================

export interface VisibilityState {
  legalForm: LegalForm
  competence: CompetenceLevel
  actualStage: ProgressionStage
  effectiveStage: ProgressionStage
  counts: {
    contacts: number
    products: number
    invoices: number
    statements: number
  }
}

export interface VisibilityContextValue {
  /**
   * Check if an element should be rendered at all.
   * Returns false if hidden by business type or competence level.
   */
  isVisible: (id: ElementId) => boolean

  /**
   * Check if an element is locked (visible but disabled).
   * Returns true if locked by progression requirements.
   */
  isLocked: (id: ElementId) => boolean

  /**
   * Get the unlock hint for a locked element.
   * Returns null if element is not locked.
   */
  getUnlockHint: (id: ElementId) => string | null

  /**
   * Check both visibility and lock status at once.
   * Returns { visible: boolean, locked: boolean, hint: string | null }
   */
  getStatus: (id: ElementId) => {
    visible: boolean
    locked: boolean
    hint: string | null
  }

  /**
   * Get the next action the user should take.
   * Returns null if user has completed all stages.
   */
  getNextAction: () => { href: string; label: string; icon: string } | null

  /**
   * Current visibility state for display/debugging.
   */
  state: VisibilityState

  /**
   * Get progress percentage (0-100)
   */
  getProgressPercentage: () => number
}

// ============================================================================
// Context
// ============================================================================

const VisibilityContext = createContext<VisibilityContextValue | null>(null)

// ============================================================================
// Provider Props
// ============================================================================

export interface VisibilityProviderProps {
  children: ReactNode
  legalForm: LegalForm
  competence: CompetenceLevel
  counts: {
    contacts: number
    products: number
    invoices: number
    statements: number
  }
  hasCompletedOnboarding: boolean
}

// ============================================================================
// Provider Component
// ============================================================================

export function VisibilityProvider({
  children,
  legalForm,
  competence,
  counts,
  hasCompletedOnboarding,
}: VisibilityProviderProps) {
  const value = useMemo<VisibilityContextValue>(() => {
    // Calculate stages
    const actualStage = calculateActualStage({
      ...counts,
      hasCompletedOnboarding,
    })
    const effectiveStage = getEffectiveStage(actualStage, competence)

    // Build state object
    const state: VisibilityState = {
      legalForm,
      competence,
      actualStage,
      effectiveStage,
      counts,
    }

    // Helper functions
    const isVisible = (id: ElementId): boolean => {
      // Check business type rules
      if (isHiddenByBusinessType(id, legalForm)) return false
      // Check competence rules
      if (isHiddenByCompetence(id, competence)) return false
      return true
    }

    const isLocked = (id: ElementId): boolean => {
      return isLockedByProgression(id, effectiveStage)
    }

    const getUnlockHint = (id: ElementId): string | null => {
      return getUnlockHintForElement(id, effectiveStage)
    }

    const getStatus = (id: ElementId) => {
      const visible = isVisible(id)
      const locked = visible ? isLocked(id) : false
      const hint = locked ? getUnlockHint(id) : null
      return { visible, locked, hint }
    }

    const getProgressPercentage = (): number => {
      const currentIndex = STAGE_ORDER.indexOf(effectiveStage)
      // complete is the last stage, so we need to handle it specially
      if (effectiveStage === "complete") return 100
      return Math.round((currentIndex / (STAGE_ORDER.length - 1)) * 100)
    }

    return {
      isVisible,
      isLocked,
      getUnlockHint,
      getStatus,
      getNextAction: () => getNextAction(effectiveStage),
      state,
      getProgressPercentage,
    }
  }, [legalForm, competence, counts, hasCompletedOnboarding])

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access visibility state and helpers.
 * Must be used within a VisibilityProvider.
 */
export function useVisibility(): VisibilityContextValue {
  const context = useContext(VisibilityContext)
  if (!context) {
    throw new Error("useVisibility must be used within a VisibilityProvider")
  }
  return context
}

/**
 * Optional hook that returns null if used outside provider.
 * Useful for components that may or may not be within the provider.
 */
export function useVisibilityOptional(): VisibilityContextValue | null {
  return useContext(VisibilityContext)
}
