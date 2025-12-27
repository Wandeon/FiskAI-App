// src/lib/search/index.ts

import Fuse from "fuse.js"
import type { SearchEntry, SearchIndex, RecentSearch } from "./types"

const RECENT_SEARCHES_KEY = "fiskai-recent-searches"
const MAX_RECENT_SEARCHES = 5

let searchIndex: SearchIndex | null = null
let fuseInstance: Fuse<SearchEntry> | null = null

export async function loadSearchIndex(): Promise<SearchIndex> {
  if (searchIndex) return searchIndex

  try {
    const response = await fetch("/search-index.json")

    if (!response.ok) {
      throw new Error(`Failed to load search index: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data || !Array.isArray(data.entries)) {
      throw new Error("Invalid search index format")
    }

    searchIndex = data as SearchIndex

    // Initialize Fuse with loaded entries
    fuseInstance = new Fuse(searchIndex.entries, {
      keys: [
        { name: "title", weight: 2 },
        { name: "description", weight: 1 },
        { name: "keywords", weight: 1.5 },
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
    })

    return searchIndex
  } catch (error) {
    console.error("Error loading search index:", error)
    // Return empty index as fallback
    const emptyIndex: SearchIndex = {
      entries: [],
      version: "0",
      generatedAt: new Date().toISOString(),
    }
    searchIndex = emptyIndex
    fuseInstance = new Fuse([], {
      keys: [
        { name: "title", weight: 2 },
        { name: "description", weight: 1 },
        { name: "keywords", weight: 1.5 },
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
    })
    return searchIndex
  }
}

export function search(query: string): SearchEntry[] {
  if (!fuseInstance || !query.trim()) return []

  const results = fuseInstance.search(query, { limit: 15 })
  return results.map((r) => r.item)
}

export function getQuickActions(): SearchEntry[] {
  if (!searchIndex) return []
  return searchIndex.entries.filter((e) => e.type === "action")
}

export function groupResultsByType(entries: SearchEntry[]): Map<string, SearchEntry[]> {
  const groups = new Map<string, SearchEntry[]>()
  const order = ["action", "tool", "guide", "comparison", "how-to", "dictionary", "nav"]

  // Initialize groups in order
  for (const type of order) {
    groups.set(type, [])
  }

  // Group entries
  for (const entry of entries) {
    const group = groups.get(entry.type)
    if (group) {
      group.push(entry)
    }
  }

  // Remove empty groups
  for (const [key, value] of groups) {
    if (value.length === 0) {
      groups.delete(key)
    }
  }

  return groups
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    action: "Brze akcije",
    tool: "Alati",
    guide: "Vodiči",
    comparison: "Usporedbe",
    "how-to": "Kako da...",
    dictionary: "Rječnik",
    nav: "Navigacija",
  }
  return labels[type] || type
}

// Recent searches
export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function addRecentSearch(query: string, resultId?: string): void {
  if (typeof window === "undefined" || !query.trim()) return

  const searches = getRecentSearches()

  // Remove duplicates
  const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase())

  // Add new search at beginning
  filtered.unshift({
    query: query.trim(),
    timestamp: Date.now(),
    resultId,
  })

  // Keep only last N searches
  const trimmed = filtered.slice(0, MAX_RECENT_SEARCHES)

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed))
}

export function removeRecentSearch(query: string): void {
  if (typeof window === "undefined") return

  const searches = getRecentSearches()
  const filtered = searches.filter((s) => s.query !== query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered))
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RECENT_SEARCHES_KEY)
}

export * from "./types"
