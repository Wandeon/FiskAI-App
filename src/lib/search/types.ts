// src/lib/search/types.ts

export type SearchEntryType =
  | "action"
  | "tool"
  | "guide"
  | "comparison"
  | "how-to"
  | "dictionary"
  | "nav"

export interface SearchEntry {
  id: string
  type: SearchEntryType
  title: string
  description?: string
  keywords: string[]
  href: string
  icon?: string
  shortcut?: string
}

export interface SearchIndex {
  version: string
  generatedAt: string
  entries: SearchEntry[]
}

export interface RecentSearch {
  query: string
  timestamp: number
  resultId?: string
}
