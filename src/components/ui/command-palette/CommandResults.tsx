// src/components/ui/command-palette/CommandResults.tsx

"use client"

import { useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Clock, X } from "lucide-react"
import { CommandItem } from "./CommandItem"
import { getTypeLabel, type SearchEntry, type RecentSearch } from "@/lib/search"
import { cn } from "@/lib/utils"

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
      selectedRef.current.scrollIntoView({ block: "nearest" })
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
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Search results"
        className="max-h-[400px] overflow-y-auto px-2 py-2"
      >
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
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-surface/5"
                >
                  <span className="truncate">{recent.query}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveRecent(recent.query)
                    }}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-surface/10 group-hover:opacity-100"
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
              {getTypeLabel("action")}
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
        <p className="text-sm text-white/50">Nema rezultata za &ldquo;{query}&rdquo;</p>
        <p className="mt-1 text-xs text-white/30">Pokušajte s drugim pojmom</p>
      </motion.div>
    )
  }

  // Has results - show grouped
  let globalIndex = 0

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Search results"
      className="max-h-[400px] overflow-y-auto px-2 py-2"
    >
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
