// src/components/ui/command-palette/CommandPalette.tsx

"use client"

import { useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Command } from "lucide-react"
import { CommandResults } from "./CommandResults"
import { useCommandPalette } from "./useCommandPalette"
import { cn } from "@/lib/utils"

interface CommandPaletteProps {
  className?: string
  triggerType?: "button" | "fab"
}

export function CommandPalette({ className, triggerType = "button" }: CommandPaletteProps) {
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
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
    return undefined
  }, [isOpen])

  const handleRecentClick = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery)
    },
    [setQuery]
  )

  return (
    <>
      {/* Trigger button */}
      {triggerType === "button" ? (
        <button
          type="button"
          onClick={open}
          className={cn(
            "group hidden items-center gap-2 rounded-full border border-default bg-surface-1 px-4 py-2 text-sm text-secondary transition-all duration-200 hover:bg-surface-2 hover:text-foreground lg:flex",
            className
          )}
          aria-label="Otvori pretraživanje (⌘K)"
        >
          <Search className="h-4 w-4" />
          <span className="whitespace-nowrap">Pretraži...</span>
          <span className="ml-auto flex items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-lg shadow-black/20 ring-1 ring-border-default transition-transform hover:scale-105 active:scale-95 md:hidden"
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
              className="fixed inset-0 z-[100] bg-overlay backdrop-blur-sm"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
              }}
              className="fixed left-1/2 top-[15%] z-[101] w-[95vw] max-w-xl -translate-x-1/2"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                className="overflow-hidden rounded-2xl bg-surface-elevated shadow-2xl ring-1 ring-border-default"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search input */}
                <div className="relative flex items-center border-b border-default">
                  <Search className="pointer-events-none absolute left-4 h-5 w-5 text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pretražite alate, vodiče, akcije..."
                    aria-label="Pretražite alate, vodiče, akcije"
                    className="h-14 w-full bg-transparent pl-12 pr-4 text-base text-foreground placeholder:text-muted focus:outline-none"
                  />
                  <div className="absolute right-4 flex items-center gap-2">
                    <kbd className="rounded bg-surface-2 px-2 py-1 text-xs text-muted">Esc</kbd>
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
                <div className="flex items-center justify-between border-t border-default px-4 py-2 text-xs text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-surface-2 px-1">↑</kbd>
                      <kbd className="rounded bg-surface-2 px-1">↓</kbd>
                      navigacija
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-surface-2 px-1">↵</kbd>
                      odabir
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-surface-2 px-1">⌘</kbd>
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
