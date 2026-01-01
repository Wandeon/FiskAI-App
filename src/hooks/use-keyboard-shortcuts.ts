// src/hooks/use-keyboard-shortcuts.ts
// Centralized keyboard shortcuts hook for consistent keyboard navigation

"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export interface KeyboardShortcut {
  /** Key combination (e.g., "ctrl+s", "escape", "arrowdown") */
  keys: string
  /** Handler function */
  handler: (e: KeyboardEvent) => void
  /** Description for accessibility */
  description?: string
  /** Prevent default browser behavior */
  preventDefault?: boolean
  /** Only trigger when no input/textarea is focused */
  ignoreInputs?: boolean
  /** Enabled state */
  enabled?: boolean
}

interface UseKeyboardShortcutsOptions {
  /** Shortcuts to register */
  shortcuts: KeyboardShortcut[]
  /** Global scope (window) vs element scope */
  global?: boolean
}

/**
 * Parse a key combination string into its components
 * e.g., "ctrl+shift+s" -> { ctrl: true, shift: true, key: "s" }
 */
function parseKeyCombo(combo: string): {
  ctrl: boolean
  meta: boolean
  shift: boolean
  alt: boolean
  key: string
} {
  const parts = combo.toLowerCase().split("+")
  const key = parts[parts.length - 1]

  return {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key,
  }
}

/**
 * Check if an event matches a key combination
 */
function matchesKeyCombo(e: KeyboardEvent, combo: string): boolean {
  const parsed = parseKeyCombo(combo)
  const eventKey = e.key.toLowerCase()

  // For special keys, match the key name directly
  const specialKeys: Record<string, string> = {
    escape: "escape",
    enter: "enter",
    space: " ",
    arrowup: "arrowup",
    arrowdown: "arrowdown",
    arrowleft: "arrowleft",
    arrowright: "arrowright",
    tab: "tab",
    backspace: "backspace",
    delete: "delete",
  }

  const targetKey = specialKeys[parsed.key] || parsed.key
  const matchedKey = eventKey === targetKey

  // For cmd/ctrl shortcuts, accept either metaKey or ctrlKey
  const cmdOrCtrl = parsed.ctrl || parsed.meta
  const hasCmdOrCtrl = e.metaKey || e.ctrlKey

  const modifiersMatch = cmdOrCtrl
    ? hasCmdOrCtrl && e.shiftKey === parsed.shift && e.altKey === parsed.alt
    : e.ctrlKey === parsed.ctrl &&
      e.metaKey === parsed.meta &&
      e.shiftKey === parsed.shift &&
      e.altKey === parsed.alt

  return matchedKey && modifiersMatch
}

/**
 * Check if the active element is an input or textarea
 */
function isInputFocused(): boolean {
  const active = document.activeElement
  if (!active) return false

  const tagName = active.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  // Check for contenteditable
  if (active.getAttribute("contenteditable") === "true") {
    return true
  }

  return false
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts({ shortcuts, global = true }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue

        // Skip if input is focused and ignoreInputs is true
        if (shortcut.ignoreInputs && isInputFocused()) continue

        if (matchesKeyCombo(e, shortcut.keys)) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault()
          }
          shortcut.handler(e)
          return
        }
      }
    }

    if (global) {
      window.addEventListener("keydown", handler)
      return () => window.removeEventListener("keydown", handler)
    }
    return undefined
  }, [global])
}

/**
 * Hook for common form shortcuts (Ctrl+S to save, Escape to cancel)
 */
export function useFormShortcuts({
  onSave,
  onCancel,
  enabled = true,
}: {
  onSave?: () => void
  onCancel?: () => void
  enabled?: boolean
}) {
  const shortcuts: KeyboardShortcut[] = []

  if (onSave) {
    shortcuts.push({
      keys: "ctrl+s",
      handler: () => onSave(),
      description: "Save form",
      enabled,
    })
  }

  if (onCancel) {
    shortcuts.push({
      keys: "escape",
      handler: () => onCancel(),
      description: "Cancel",
      enabled,
      ignoreInputs: false,
    })
  }

  useKeyboardShortcuts({ shortcuts })
}

/**
 * Hook for list/table navigation with arrow keys
 */
export function useListNavigation({
  itemCount,
  selectedIndex,
  onSelect,
  onActivate,
  enabled = true,
}: {
  itemCount: number
  selectedIndex: number
  onSelect: (index: number) => void
  onActivate?: (index: number) => void
  enabled?: boolean
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      keys: "arrowdown",
      handler: () => {
        const next = selectedIndex < itemCount - 1 ? selectedIndex + 1 : 0
        onSelect(next)
      },
      description: "Move to next item",
      enabled,
      ignoreInputs: true,
    },
    {
      keys: "arrowup",
      handler: () => {
        const prev = selectedIndex > 0 ? selectedIndex - 1 : itemCount - 1
        onSelect(prev)
      },
      description: "Move to previous item",
      enabled,
      ignoreInputs: true,
    },
  ]

  if (onActivate) {
    shortcuts.push({
      keys: "enter",
      handler: () => onActivate(selectedIndex),
      description: "Activate selected item",
      enabled,
      ignoreInputs: true,
    })
  }

  // Add Home/End navigation
  shortcuts.push(
    {
      keys: "home",
      handler: () => onSelect(0),
      description: "Go to first item",
      enabled,
      ignoreInputs: true,
    },
    {
      keys: "end",
      handler: () => onSelect(itemCount - 1),
      description: "Go to last item",
      enabled,
      ignoreInputs: true,
    }
  )

  useKeyboardShortcuts({ shortcuts })
}

/**
 * Hook for modal keyboard handling
 */
export function useModalShortcuts({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      keys: "escape",
      handler: onClose,
      description: "Close modal",
      enabled: isOpen,
    },
  ]

  if (onConfirm) {
    shortcuts.push({
      keys: "ctrl+enter",
      handler: onConfirm,
      description: "Confirm",
      enabled: isOpen,
    })
  }

  useKeyboardShortcuts({ shortcuts })
}

/**
 * Hook for navigation shortcuts (go to dashboard, new invoice, etc.)
 */
export function useNavigationShortcuts() {
  const router = useRouter()

  const shortcuts: KeyboardShortcut[] = [
    {
      keys: "ctrl+n",
      handler: () => router.push("/invoices/new"),
      description: "New invoice",
      ignoreInputs: true,
    },
    {
      keys: "ctrl+shift+c",
      handler: () => router.push("/contacts/new"),
      description: "New contact",
      ignoreInputs: true,
    },
    {
      keys: "ctrl+shift+p",
      handler: () => router.push("/products/new"),
      description: "New product",
      ignoreInputs: true,
    },
    {
      keys: "ctrl+d",
      handler: () => router.push("/dashboard"),
      description: "Go to dashboard",
      ignoreInputs: true,
    },
    {
      keys: "ctrl+shift+e",
      handler: () => router.push("/expenses/new"),
      description: "New expense",
      ignoreInputs: true,
    },
  ]

  useKeyboardShortcuts({ shortcuts })
}
