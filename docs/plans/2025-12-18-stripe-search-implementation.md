# Stripe-Style Command Palette Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace navigation-only command palette with Stripe-style global search featuring grouped results, quick actions, recent searches, and smooth animations.

**Architecture:** Build-time index generation scans MDX files and tool configs, outputs JSON to `public/`. Client loads index on first ⌘K, uses Fuse.js for fuzzy search. Framer Motion powers all animations.

**Tech Stack:** Fuse.js (fuzzy search), Framer Motion (animations), gray-matter (MDX parsing), tsx (build script)

---

## Task 1: Install Fuse.js

**Files:**

- Modify: `package.json`

**Step 1: Install fuse.js**

Run: `npm install fuse.js`

**Step 2: Verify installation**

Run: `npm ls fuse.js`
Expected: `fuse.js@7.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fuse.js for fuzzy search"
```

---

## Task 2: Create Search Types

**Files:**

- Create: `src/lib/search/types.ts`

**Step 1: Create the types file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/search/types.ts
git commit -m "feat(search): add search index types"
```

---

## Task 3: Create Build Script for Search Index

**Files:**

- Create: `scripts/build-search-index.ts`

**Step 1: Create the build script**

```typescript
// scripts/build-search-index.ts

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import type { SearchEntry, SearchIndex } from "../src/lib/search/types"

const CONTENT_DIR = path.join(process.cwd(), "content")
const OUTPUT_PATH = path.join(process.cwd(), "public", "search-index.json")

// Quick actions - hardcoded for instant access
const QUICK_ACTIONS: SearchEntry[] = [
  {
    id: "action-calc-salary",
    type: "action",
    title: "Izračunaj neto plaću",
    description: "Bruto-neto kalkulator",
    keywords: ["plaća", "neto", "bruto", "kalkulator"],
    href: "/alati/bruto-neto",
    icon: "Calculator",
    shortcut: "⌘1",
  },
  {
    id: "action-check-pdv",
    type: "action",
    title: "Provjeri PDV prag",
    description: "Koliko ste blizu 60.000€ praga",
    keywords: ["pdv", "prag", "60000", "limit"],
    href: "/alati/pdv-kalkulator",
    icon: "TrendingUp",
    shortcut: "⌘2",
  },
  {
    id: "action-compare",
    type: "action",
    title: "Usporedi obrt vs d.o.o.",
    description: "Koja forma je bolja za vas",
    keywords: ["usporedba", "obrt", "doo", "firma"],
    href: "/usporedbe/firma",
    icon: "Scale",
    shortcut: "⌘3",
  },
  {
    id: "action-contributions",
    type: "action",
    title: "Izračunaj doprinose",
    description: "MIO, HZZO doprinosi",
    keywords: ["doprinosi", "mio", "hzzo", "kalkulator"],
    href: "/alati/kalkulator-doprinosa",
    icon: "Coins",
    shortcut: "⌘4",
  },
  {
    id: "action-posd",
    type: "action",
    title: "POSD kalkulator",
    description: "Porez na samostalnu djelatnost",
    keywords: ["posd", "porez", "dohodak", "kalkulator"],
    href: "/alati/posd-kalkulator",
    icon: "FileText",
    shortcut: "⌘5",
  },
]

// Tools from /alati page
const TOOLS: SearchEntry[] = [
  {
    id: "tool-doprinosi",
    type: "tool",
    title: "Kalkulator doprinosa",
    description: "Izračunajte mjesečne doprinose za MIO i HZZO",
    keywords: ["doprinosi", "mio", "hzzo", "kalkulator", "mjesečno"],
    href: "/alati/kalkulator-doprinosa",
    icon: "Calculator",
  },
  {
    id: "tool-porez",
    type: "tool",
    title: "Kalkulator poreza",
    description: "Izračunajte paušalni porez na temelju prihoda",
    keywords: ["porez", "paušal", "kalkulator", "prihod"],
    href: "/alati/kalkulator-poreza",
    icon: "BarChart3",
  },
  {
    id: "tool-pdv",
    type: "tool",
    title: "PDV prag (60.000€)",
    description: "Provjerite koliko ste blizu praga i kada postajete PDV obveznik",
    keywords: ["pdv", "prag", "60000", "obveznik", "limit"],
    href: "/alati/pdv-kalkulator",
    icon: "Scale",
  },
  {
    id: "tool-uplatnice",
    type: "tool",
    title: "Generator uplatnica",
    description: "Generirajte HUB3 barkod za uplate doprinosa i poreza",
    keywords: ["uplatnica", "hub3", "barkod", "uplata"],
    href: "/alati/uplatnice",
    icon: "CreditCard",
  },
  {
    id: "tool-kalendar",
    type: "tool",
    title: "Kalendar rokova",
    description: "Podsjetnik za važne rokove prijava i uplata",
    keywords: ["kalendar", "rok", "datum", "prijava", "uplata"],
    href: "/alati/kalendar",
    icon: "Calendar",
  },
  {
    id: "tool-oib",
    type: "tool",
    title: "OIB Validator",
    description: "Provjerite valjanost OIB-a",
    keywords: ["oib", "validator", "provjera", "identifikacijski"],
    href: "/alati/oib-validator",
    icon: "Shield",
  },
  {
    id: "tool-eracun",
    type: "tool",
    title: "E-Račun Generator",
    description: "Generirajte UBL 2.1 XML e-račune",
    keywords: ["e-račun", "eracun", "ubl", "xml", "faktura"],
    href: "/alati/e-racun",
    icon: "FileText",
  },
  {
    id: "tool-bruto-neto",
    type: "tool",
    title: "Bruto-neto kalkulator",
    description: "Izračunajte neto plaću iz bruto iznosa",
    keywords: ["bruto", "neto", "plaća", "kalkulator"],
    href: "/alati/bruto-neto",
    icon: "Calculator",
  },
  {
    id: "tool-posd",
    type: "tool",
    title: "POSD kalkulator",
    description: "Porez na samostalnu djelatnost za obrtnike",
    keywords: ["posd", "porez", "obrt", "dohodak"],
    href: "/alati/posd-kalkulator",
    icon: "FileText",
  },
]

// Navigation items (app sections)
const NAV_ITEMS: SearchEntry[] = [
  {
    id: "nav-dashboard",
    type: "nav",
    title: "Nadzorna ploča",
    description: "Pregled poslovanja",
    keywords: ["dashboard", "pregled", "nadzorna"],
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    id: "nav-pos",
    type: "nav",
    title: "Blagajna",
    description: "POS sustav za izdavanje računa",
    keywords: ["blagajna", "pos", "račun", "kasa"],
    href: "/pos",
    icon: "ShoppingCart",
  },
  {
    id: "nav-documents",
    type: "nav",
    title: "Dokumenti",
    description: "Računi, e-računi, troškovi",
    keywords: ["dokumenti", "računi", "fakture", "troškovi"],
    href: "/documents",
    icon: "FileText",
  },
  {
    id: "nav-contacts",
    type: "nav",
    title: "Kontakti",
    description: "Kupci i dobavljači",
    keywords: ["kontakti", "kupci", "dobavljači", "partneri"],
    href: "/contacts",
    icon: "Users",
  },
  {
    id: "nav-products",
    type: "nav",
    title: "Proizvodi",
    description: "Katalog proizvoda i usluga",
    keywords: ["proizvodi", "usluge", "artikli", "katalog"],
    href: "/products",
    icon: "Package",
  },
  {
    id: "nav-settings",
    type: "nav",
    title: "Postavke",
    description: "Postavke računa i tvrtke",
    keywords: ["postavke", "settings", "konfiguracija"],
    href: "/settings",
    icon: "Settings",
  },
]

function scanMdxFiles(dir: string, type: SearchEntry["type"], hrefPrefix: string): SearchEntry[] {
  const entries: SearchEntry[] = []

  if (!fs.existsSync(dir)) {
    console.log(`[build-search-index] Directory not found: ${dir}`)
    return entries
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))

  for (const file of files) {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, "utf-8")
    const { data: frontmatter } = matter(content)

    const slug = file.replace(".mdx", "")

    entries.push({
      id: `${type}-${slug}`,
      type,
      title: frontmatter.title || slug,
      description: frontmatter.description || "",
      keywords: [
        slug,
        ...(frontmatter.title?.toLowerCase().split(" ") || []),
        ...(frontmatter.keywords || []),
      ],
      href: `${hrefPrefix}/${slug}`,
      icon:
        type === "guide"
          ? "BookOpen"
          : type === "comparison"
            ? "Scale"
            : type === "how-to"
              ? "HelpCircle"
              : "FileText",
    })
  }

  return entries
}

async function buildIndex(): Promise<void> {
  console.log("[build-search-index] Building search index...")

  const entries: SearchEntry[] = [
    ...QUICK_ACTIONS,
    ...TOOLS,
    ...scanMdxFiles(path.join(CONTENT_DIR, "vodici"), "guide", "/vodic"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "usporedbe"), "comparison", "/usporedbe"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "kako-da"), "how-to", "/kako-da"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "rjecnik"), "dictionary", "/rjecnik"),
    ...NAV_ITEMS,
  ]

  const index: SearchIndex = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    entries,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2))

  console.log(`[build-search-index] Generated ${entries.length} entries`)
  console.log(`[build-search-index] Output: ${OUTPUT_PATH}`)
}

buildIndex().catch(console.error)
```

**Step 2: Run the script to verify**

Run: `npx tsx scripts/build-search-index.ts`
Expected: Output showing entry count and file path

**Step 3: Verify output**

Run: `head -30 public/search-index.json`
Expected: Valid JSON with entries array

**Step 4: Commit**

```bash
git add scripts/build-search-index.ts public/search-index.json
git commit -m "feat(search): add build-time index generation script"
```

---

## Task 4: Add prebuild Script to package.json

**Files:**

- Modify: `package.json:5-6`

**Step 1: Add prebuild script**

Edit `package.json` scripts section to add:

```json
"prebuild": "tsx scripts/build-search-index.ts",
```

The scripts section should look like:

```json
"scripts": {
  "dev": "next dev",
  "prebuild": "tsx scripts/build-search-index.ts",
  "build": "next build",
  ...
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add prebuild script for search index generation"
```

---

## Task 5: Create Search Utilities

**Files:**

- Create: `src/lib/search/index.ts`

**Step 1: Create the search utilities**

```typescript
// src/lib/search/index.ts

import Fuse from "fuse.js"
import type { SearchEntry, SearchIndex, RecentSearch } from "./types"

const RECENT_SEARCHES_KEY = "fiskai-recent-searches"
const MAX_RECENT_SEARCHES = 5

let searchIndex: SearchIndex | null = null
let fuseInstance: Fuse<SearchEntry> | null = null

export async function loadSearchIndex(): Promise<SearchIndex> {
  if (searchIndex) return searchIndex

  const response = await fetch("/search-index.json")
  searchIndex = await response.json()

  // Initialize Fuse with loaded entries
  fuseInstance = new Fuse(searchIndex!.entries, {
    keys: [
      { name: "title", weight: 2 },
      { name: "description", weight: 1 },
      { name: "keywords", weight: 1.5 },
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
  })

  return searchIndex!
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
```

**Step 2: Commit**

```bash
git add src/lib/search/index.ts
git commit -m "feat(search): add fuzzy search utilities with recent searches"
```

---

## Task 6: Create Command Palette Hook

**Files:**

- Create: `src/components/ui/command-palette/useCommandPalette.ts`

**Step 1: Create the hook**

```typescript
// src/components/ui/command-palette/useCommandPalette.ts

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
```

**Step 2: Commit**

```bash
git add src/components/ui/command-palette/useCommandPalette.ts
git commit -m "feat(search): add command palette hook with keyboard navigation"
```

---

## Task 7: Create CommandItem Component

**Files:**

- Create: `src/components/ui/command-palette/CommandItem.tsx`

**Step 1: Create the component with animations**

```typescript
// src/components/ui/command-palette/CommandItem.tsx

'use client'

import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  TrendingUp,
  Scale,
  Coins,
  FileText,
  BarChart3,
  CreditCard,
  Calendar,
  Shield,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchEntry } from '@/lib/search'

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  TrendingUp,
  Scale,
  Coins,
  FileText,
  BarChart3,
  CreditCard,
  Calendar,
  Shield,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
}

interface CommandItemProps {
  entry: SearchEntry
  isSelected: boolean
  index: number
  onSelect: () => void
  onHover: () => void
}

export const CommandItem = forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ entry, isSelected, index, onSelect, onHover }, ref) => {
    const Icon = entry.icon ? ICON_MAP[entry.icon] : FileText

    return (
      <motion.button
        ref={ref}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.15 }}
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          'group relative w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150',
          'focus:outline-none',
          isSelected
            ? 'bg-white/10'
            : 'hover:bg-white/5'
        )}
      >
        {/* Selection indicator */}
        <motion.div
          initial={false}
          animate={{
            opacity: isSelected ? 1 : 0,
            scaleY: isSelected ? 1 : 0.5,
          }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-cyan-500"
        />

        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
              entry.type === 'action'
                ? 'bg-cyan-500/20 text-cyan-400'
                : entry.type === 'tool'
                ? 'bg-emerald-500/20 text-emerald-400'
                : entry.type === 'guide'
                ? 'bg-violet-500/20 text-violet-400'
                : entry.type === 'comparison'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-white/10 text-white/60'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-white">
                {entry.title}
              </span>
              {entry.shortcut && (
                <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50 sm:inline-block">
                  {entry.shortcut}
                </kbd>
              )}
            </div>
            {entry.description && (
              <p className="truncate text-sm text-white/50">
                {entry.description}
              </p>
            )}
          </div>

          {/* Enter indicator */}
          <motion.div
            initial={false}
            animate={{ opacity: isSelected ? 1 : 0 }}
            className="flex-shrink-0"
          >
            <CornerDownLeft className="h-4 w-4 text-white/40" />
          </motion.div>
        </div>
      </motion.button>
    )
  }
)

CommandItem.displayName = 'CommandItem'
```

**Step 2: Commit**

```bash
git add src/components/ui/command-palette/CommandItem.tsx
git commit -m "feat(search): add CommandItem component with animations"
```

---

## Task 8: Create CommandResults Component

**Files:**

- Create: `src/components/ui/command-palette/CommandResults.tsx`

**Step 1: Create the grouped results component**

```typescript
// src/components/ui/command-palette/CommandResults.tsx

'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Clock, X } from 'lucide-react'
import { CommandItem } from './CommandItem'
import { getTypeLabel, type SearchEntry, type RecentSearch } from '@/lib/search'
import { cn } from '@/lib/utils'

interface CommandResultsProps {
  query: string
  results: Map<string, SearchEntry[]>
  recentSearches: RecentSearch[]
  quickActions: SearchEntry[]
  selectedIndex: number
  isLoading: boolean
  onSelect: (entry: SearchEntry) => void
  onSelectIndex: (index: number) => void
  onRemoveRecent: (query: string) => void
  onRecentClick: (query: string) => void
}

export function CommandResults({
  query,
  results,
  recentSearches,
  quickActions,
  selectedIndex,
  isLoading,
  onSelect,
  onSelectIndex,
  onRemoveRecent,
  onRecentClick,
}: CommandResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }

  const hasQuery = query.trim().length > 0
  const hasResults = results.size > 0

  // No query - show recent + quick actions
  if (!hasQuery) {
    let globalIndex = 0

    return (
      <div ref={containerRef} className="max-h-[400px] overflow-y-auto px-2 py-2">
        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 px-3 text-xs font-medium uppercase tracking-wider text-white/40">
              <Clock className="h-3 w-3" />
              Nedavno
            </div>
            <div className="space-y-1">
              {recentSearches.map((recent) => (
                <motion.button
                  key={recent.query}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onRecentClick(recent.query)}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/5"
                >
                  <span className="truncate">{recent.query}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveRecent(recent.query)
                    }}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-white/40" />
                  </button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        {quickActions.length > 0 && (
          <div>
            <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-white/40">
              {getTypeLabel('action')}
            </div>
            <div className="space-y-0.5">
              {quickActions.map((action, i) => {
                const currentIndex = globalIndex++
                return (
                  <CommandItem
                    key={action.id}
                    ref={currentIndex === selectedIndex ? selectedRef : undefined}
                    entry={action}
                    isSelected={currentIndex === selectedIndex}
                    index={i}
                    onSelect={() => onSelect(action)}
                    onHover={() => onSelectIndex(currentIndex)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Has query but no results
  if (!hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 py-12 text-center"
      >
        <p className="text-sm text-white/50">
          Nema rezultata za &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-xs text-white/30">
          Pokušajte s drugim pojmom
        </p>
      </motion.div>
    )
  }

  // Has results - show grouped
  let globalIndex = 0

  return (
    <div ref={containerRef} className="max-h-[400px] overflow-y-auto px-2 py-2">
      <AnimatePresence mode="popLayout">
        {Array.from(results.entries()).map(([type, entries]) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 last:mb-0"
          >
            <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-white/40">
              {getTypeLabel(type)}
            </div>
            <div className="space-y-0.5">
              {entries.map((entry, i) => {
                const currentIndex = globalIndex++
                return (
                  <CommandItem
                    key={entry.id}
                    ref={currentIndex === selectedIndex ? selectedRef : undefined}
                    entry={entry}
                    isSelected={currentIndex === selectedIndex}
                    index={i}
                    onSelect={() => onSelect(entry)}
                    onHover={() => onSelectIndex(currentIndex)}
                  />
                )
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ui/command-palette/CommandResults.tsx
git commit -m "feat(search): add CommandResults with grouped display"
```

---

## Task 9: Create New CommandPalette Component

**Files:**

- Create: `src/components/ui/command-palette/CommandPalette.tsx`

**Step 1: Create the main component with modal animations**

```typescript
// src/components/ui/command-palette/CommandPalette.tsx

'use client'

import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Command } from 'lucide-react'
import { CommandResults } from './CommandResults'
import { useCommandPalette } from './useCommandPalette'
import { cn } from '@/lib/utils'

interface CommandPaletteProps {
  className?: string
  triggerType?: 'button' | 'fab'
}

export function CommandPalette({ className, triggerType = 'button' }: CommandPaletteProps) {
  const {
    isOpen,
    query,
    setQuery,
    results,
    recentSearches,
    quickActions,
    selectedIndex,
    isLoading,
    open,
    close,
    selectItem,
    selectIndex,
    removeRecent,
  } = useCommandPalette()

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  const handleRecentClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery)
  }, [setQuery])

  return (
    <>
      {/* Trigger button */}
      {triggerType === 'button' ? (
        <button
          type="button"
          onClick={open}
          className={cn(
            'group hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white/90 lg:flex',
            className
          )}
          aria-label="Otvori pretraživanje (⌘K)"
        >
          <Search className="h-4 w-4" />
          <span className="whitespace-nowrap">Pretraži...</span>
          <span className="ml-auto flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-cyan-400 shadow-lg shadow-black/20 ring-1 ring-white/10 transition-transform hover:scale-105 active:scale-95 md:hidden"
          aria-label="Pretraži"
        >
          <Search className="h-5 w-5" />
        </button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
              }}
              className="fixed left-1/2 top-[15%] z-[101] w-[95vw] max-w-xl -translate-x-1/2"
            >
              <div
                className="overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search input */}
                <div className="relative flex items-center border-b border-white/10">
                  <Search className="pointer-events-none absolute left-4 h-5 w-5 text-white/40" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pretražite alate, vodiče, akcije..."
                    className="h-14 w-full bg-transparent pl-12 pr-4 text-base text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <div className="absolute right-4 flex items-center gap-2">
                    <kbd className="rounded bg-white/10 px-2 py-1 text-xs text-white/40">
                      Esc
                    </kbd>
                  </div>
                </div>

                {/* Results */}
                <CommandResults
                  query={query}
                  results={results}
                  recentSearches={recentSearches}
                  quickActions={quickActions}
                  selectedIndex={selectedIndex}
                  isLoading={isLoading}
                  onSelect={selectItem}
                  onSelectIndex={selectIndex}
                  onRemoveRecent={removeRecent}
                  onRecentClick={handleRecentClick}
                />

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-white/30">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-white/10 px-1">↑</kbd>
                      <kbd className="rounded bg-white/10 px-1">↓</kbd>
                      navigacija
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-white/10 px-1">↵</kbd>
                      odabir
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-white/10 px-1">⌘</kbd>
                    <span>1-5 brze akcije</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ui/command-palette/CommandPalette.tsx
git commit -m "feat(search): add main CommandPalette with modal animations"
```

---

## Task 10: Create Index Export

**Files:**

- Create: `src/components/ui/command-palette/index.ts`

**Step 1: Create the barrel export**

```typescript
// src/components/ui/command-palette/index.ts

export { CommandPalette } from "./CommandPalette"
export { CommandItem } from "./CommandItem"
export { CommandResults } from "./CommandResults"
export { useCommandPalette } from "./useCommandPalette"
```

**Step 2: Commit**

```bash
git add src/components/ui/command-palette/index.ts
git commit -m "feat(search): add barrel export for command palette"
```

---

## Task 11: Update Header to Use New CommandPalette

**Files:**

- Modify: `src/components/layout/header.tsx`

**Step 1: Update import path**

Find and replace:

```typescript
import { CommandPalette } from "@/components/ui/command-palette"
```

With:

```typescript
import { CommandPalette } from "@/components/ui/command-palette"
```

(Path stays same, but now points to new folder with index.ts)

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "refactor: update header to use new command palette"
```

---

## Task 12: Update Mobile Nav to Use New CommandPalette

**Files:**

- Modify: `src/components/layout/mobile-nav.tsx`

**Step 1: Update import path if needed**

Verify the import path points to the new command palette folder.

**Step 2: Test on mobile viewport**

Run dev server and test on mobile viewport (or Chrome DevTools)

**Step 3: Commit if changes made**

```bash
git add src/components/layout/mobile-nav.tsx
git commit -m "refactor: update mobile nav to use new command palette"
```

---

## Task 13: Delete Old Command Palette File

**Files:**

- Delete: `src/components/ui/command-palette.tsx`

**Step 1: Remove old file**

Run: `rm src/components/ui/command-palette.tsx`

**Step 2: Verify no broken imports**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old command palette implementation"
```

---

## Task 14: Add Search Index to .gitignore

**Files:**

- Modify: `.gitignore`

**Step 1: Add search index to gitignore**

Add this line to `.gitignore`:

```
# Generated search index
public/search-index.json
```

**Step 2: Remove from git tracking if already added**

Run: `git rm --cached public/search-index.json`

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore generated search index"
```

---

## Task 15: Final Integration Test

**Step 1: Generate fresh index**

Run: `npx tsx scripts/build-search-index.ts`

**Step 2: Start dev server**

Run: `npm run dev`

**Step 3: Test keyboard shortcut**

Press ⌘K (or Ctrl+K on Windows/Linux)
Expected: Modal opens with smooth animation

**Step 4: Test quick actions**

Press ⌘1
Expected: Navigates to Bruto-neto kalkulator

**Step 5: Test search**

Type "pdv"
Expected: Grouped results show PDV-related tools and guides

**Step 6: Test recent searches**

1. Search "doprinosi" and select a result
2. Close and reopen with ⌘K
3. Should see "doprinosi" in recent searches

**Step 7: Test keyboard navigation**

Use ↑↓ arrows and Enter to navigate and select

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat(search): complete Stripe-style command palette implementation

- Build-time search index generation
- Fuzzy search with Fuse.js
- Grouped results by type
- Recent searches with localStorage
- Full keyboard navigation (⌘K, arrows, ⌘1-5)
- Smooth Framer Motion animations
"
```

---

## Summary

| Task | Description          | Files                                                  |
| ---- | -------------------- | ------------------------------------------------------ |
| 1    | Install Fuse.js      | package.json                                           |
| 2    | Create search types  | src/lib/search/types.ts                                |
| 3    | Build script         | scripts/build-search-index.ts                          |
| 4    | Add prebuild         | package.json                                           |
| 5    | Search utilities     | src/lib/search/index.ts                                |
| 6    | Command palette hook | src/components/ui/command-palette/useCommandPalette.ts |
| 7    | CommandItem          | src/components/ui/command-palette/CommandItem.tsx      |
| 8    | CommandResults       | src/components/ui/command-palette/CommandResults.tsx   |
| 9    | CommandPalette       | src/components/ui/command-palette/CommandPalette.tsx   |
| 10   | Index export         | src/components/ui/command-palette/index.ts             |
| 11   | Update header        | src/components/layout/header.tsx                       |
| 12   | Update mobile nav    | src/components/layout/mobile-nav.tsx                   |
| 13   | Delete old file      | src/components/ui/command-palette.tsx                  |
| 14   | Update gitignore     | .gitignore                                             |
| 15   | Integration test     | N/A                                                    |
