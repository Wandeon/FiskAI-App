"use client"

import { useState, useEffect } from "react"
import { Modal, ModalFooter } from "./modal"
import { Button } from "./button"
import {
  ALL_SHORTCUTS,
  CATEGORY_LABELS,
  formatShortcut,
  getPlatformKey,
  type ShortcutCategory,
} from "@/lib/shortcuts"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

interface KeyboardShortcutsDialogProps {
  /** Categories to show. Defaults to all. */
  categories?: ShortcutCategory[]
}

export function KeyboardShortcutsDialog({
  categories = ["navigation", "actions", "forms", "modals", "lists"],
}: KeyboardShortcutsDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [platformKey, setPlatformKey] = useState("⌘")

  // Detect platform on mount
  useEffect(() => {
    setPlatformKey(getPlatformKey())
  }, [])

  // Register ? shortcut to open dialog
  useKeyboardShortcuts({
    shortcuts: [
      {
        keys: "shift+?",
        handler: () => setIsOpen(true),
        description: "Show keyboard shortcuts",
        ignoreInputs: true,
      },
    ],
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Tipkovnicki precaci"
      description="Koristite tipkovnicke precace za brzi rad"
      size="lg"
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {categories.map((category) => {
          const shortcuts = ALL_SHORTCUTS[category]
          if (!shortcuts || shortcuts.length === 0) return null

          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-secondary)]"
                  >
                    <span className="text-sm text-[var(--foreground)]">{shortcut.description}</span>
                    <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded shadow-sm">
                      {formatShortcut(shortcut.keys).replace("⌘", platformKey)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          Zatvori
        </Button>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Trigger button to open keyboard shortcuts dialog
 */
export function KeyboardShortcutsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [platformKey, setPlatformKey] = useState("⌘")

  useEffect(() => {
    setPlatformKey(getPlatformKey())
  }, [])

  // Register ? shortcut
  useKeyboardShortcuts({
    shortcuts: [
      {
        keys: "shift+?",
        handler: () => setIsOpen(true),
        description: "Show keyboard shortcuts",
        ignoreInputs: true,
      },
    ],
  })

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        aria-label="Keyboard shortcuts"
      >
        <span>Tipkovnicki precaci</span>
        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--surface-secondary)] border border-[var(--border)] rounded">
          ?
        </kbd>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Tipkovnicki precaci"
        description="Koristite tipkovnicke precace za brzi rad"
        size="lg"
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {(["navigation", "actions", "forms", "modals", "lists"] as ShortcutCategory[]).map(
            (category) => {
              const shortcuts = ALL_SHORTCUTS[category]
              if (!shortcuts || shortcuts.length === 0) return null

              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-secondary)]"
                      >
                        <span className="text-sm text-[var(--foreground)]">
                          {shortcut.description}
                        </span>
                        <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded shadow-sm">
                          {formatShortcut(shortcut.keys).replace("⌘", platformKey)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Zatvori
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
