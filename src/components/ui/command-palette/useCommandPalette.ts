// src/components/ui/command-palette/useCommandPalette.ts

"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  loadSearchIndex,
  search,
  getQuickActions,
  groupResultsByType,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  type SearchEntry,
  type RecentSearch,
} from "@/lib/search"

export interface UseCommandPaletteReturn {
  isOpen: boolean
  query: string
  setQuery: (query: string) => void
  results: Map<string, SearchEntry[]>
  recentSearches: RecentSearch[]
  quickActions: SearchEntry[]
  selectedIndex: number
  flatResults: SearchEntry[]
  isLoading: boolean
  open: () => void
  close: () => void
  toggle: () => void
  selectItem: (entry: SearchEntry) => void
  selectIndex: (index: number) => void
  moveSelection: (direction: "up" | "down") => void
  removeRecent: (query: string) => void
  executeShortcut: (num: number) => void
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Map<string, SearchEntry[]>>(new Map())
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [quickActions, setQuickActions] = useState<SearchEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const indexLoadedRef = useRef(false)

  // Load index on first open
  useEffect(() => {
    if (isOpen && !indexLoadedRef.current) {
      setIsLoading(true)
      loadSearchIndex()
        .then(() => {
          indexLoadedRef.current = true
          setQuickActions(getQuickActions())
          setRecentSearches(getRecentSearches())
          setIsLoading(false)
        })
        .catch((err) => {
          console.error("Failed to load search index:", err)
          setIsLoading(false)
        })
    }
  }, [isOpen])

  // Search when query changes
  useEffect(() => {
    if (!indexLoadedRef.current) return

    if (query.trim()) {
      const searchResults = search(query)
      setResults(groupResultsByType(searchResults))
    } else {
      setResults(new Map())
    }
    setSelectedIndex(0)
  }, [query])

  // Flatten results for keyboard navigation
  const flatResults: SearchEntry[] = query.trim()
    ? Array.from(results.values()).flat()
    : quickActions

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery("")
    setSelectedIndex(0)
    setRecentSearches(getRecentSearches())
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setSelectedIndex(0)
  }, [])

  const toggle = useCallback(() => {
    if (isOpen) close()
    else open()
  }, [isOpen, open, close])

  const selectItem = useCallback(
    (entry: SearchEntry) => {
      if (query.trim()) {
        addRecentSearch(query, entry.id)
      }
      router.push(entry.href)
      close()
    },
    [router, close, query]
  )

  const selectIndex = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  const moveSelection = useCallback(
    (direction: "up" | "down") => {
      setSelectedIndex((prev) => {
        const max = flatResults.length - 1
        if (direction === "up") {
          return prev <= 0 ? max : prev - 1
        } else {
          return prev >= max ? 0 : prev + 1
        }
      })
    },
    [flatResults.length]
  )

  const removeRecent = useCallback((queryToRemove: string) => {
    removeRecentSearch(queryToRemove)
    setRecentSearches(getRecentSearches())
  }, [])

  const executeShortcut = useCallback(
    (num: number) => {
      // Only works when query is empty (showing quick actions)
      if (query.trim()) return

      const action = quickActions[num - 1]
      if (action) {
        selectItem(action)
      }
    },
    [query, quickActions, selectItem]
  )

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        toggle()
        return
      }

      // ⌘G / Ctrl+G to cycle guidance level
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("toggle-guidance-level"))
        return
      }

      if (!isOpen) return

      // Escape to close
      if (e.key === "Escape") {
        e.preventDefault()
        close()
        return
      }

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault()
        moveSelection("down")
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        moveSelection("up")
        return
      }

      // Enter to select
      if (e.key === "Enter") {
        e.preventDefault()
        const selected = flatResults[selectedIndex]
        if (selected) {
          selectItem(selected)
        }
        return
      }

      // ⌘1-5 shortcuts for quick actions
      if ((e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        executeShortcut(parseInt(e.key))
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    isOpen,
    toggle,
    close,
    moveSelection,
    selectItem,
    flatResults,
    selectedIndex,
    executeShortcut,
  ])

  return {
    isOpen,
    query,
    setQuery,
    results,
    recentSearches,
    quickActions,
    selectedIndex,
    flatResults,
    isLoading,
    open,
    close,
    toggle,
    selectItem,
    selectIndex,
    moveSelection,
    removeRecent,
    executeShortcut,
  }
}
