"use client"

/**
 * Selection Context
 *
 * React context for managing multi-select state across queue components.
 * Enables batch operations by tracking which items are selected.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"

/**
 * Selection context state and actions.
 */
interface SelectionContextValue {
  /** Array of selected entity IDs */
  selectedIds: string[]

  /** Check if an ID is selected */
  isSelected: (id: string) => boolean

  /** Toggle selection for an ID */
  toggle: (id: string) => void

  /** Select a specific ID (idempotent) */
  select: (id: string) => void

  /** Deselect a specific ID (idempotent) */
  deselect: (id: string) => void

  /** Select multiple IDs (replaces current selection) */
  selectAll: (ids: string[]) => void

  /** Clear all selections */
  deselectAll: () => void

  /** Whether any items are selected */
  hasSelection: boolean

  /** Number of selected items */
  count: number
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

/**
 * Provider component for selection state.
 */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }, [])

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((i) => i !== id))
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids)
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  const value = useMemo(
    (): SelectionContextValue => ({
      selectedIds,
      isSelected,
      toggle,
      select,
      deselect,
      selectAll,
      deselectAll,
      hasSelection: selectedIds.length > 0,
      count: selectedIds.length,
    }),
    [selectedIds, isSelected, toggle, select, deselect, selectAll, deselectAll]
  )

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

/**
 * Hook to access selection state.
 * Must be used within a SelectionProvider.
 */
export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider")
  }
  return context
}

/**
 * Optional hook that returns null if outside provider.
 * Useful for components that may or may not be in selection mode.
 */
export function useSelectionOptional(): SelectionContextValue | null {
  return useContext(SelectionContext)
}
