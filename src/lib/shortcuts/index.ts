// src/lib/shortcuts/index.ts
// Keyboard shortcut definitions and formatting utilities

export interface Shortcut {
  id: string
  keys: string[] // e.g., ["cmd", "n"] or ["ctrl", "n"]
  action: string
  description: string
  href?: string
  category?: ShortcutCategory
}

export type ShortcutCategory = "navigation" | "actions" | "forms" | "modals" | "lists"

// Navigation shortcuts
export const NAVIGATION_SHORTCUTS: Shortcut[] = [
  {
    id: "dashboard",
    keys: ["cmd", "d"],
    action: "dashboard",
    description: "Dashboard",
    href: "/dashboard",
    category: "navigation",
  },
  {
    id: "invoices",
    keys: ["cmd", "i"],
    action: "invoices",
    description: "Računi",
    href: "/invoices",
    category: "navigation",
  },
  {
    id: "contacts",
    keys: ["cmd", "shift", "o"],
    action: "contacts",
    description: "Kontakti",
    href: "/contacts",
    category: "navigation",
  },
  {
    id: "expenses",
    keys: ["cmd", "e"],
    action: "expenses",
    description: "Troškovi",
    href: "/expenses",
    category: "navigation",
  },
]

// Quick action shortcuts
export const ACTION_SHORTCUTS: Shortcut[] = [
  {
    id: "new-invoice",
    keys: ["cmd", "n"],
    action: "newInvoice",
    description: "Novi račun",
    href: "/invoices/new",
    category: "actions",
  },
  {
    id: "new-contact",
    keys: ["cmd", "shift", "c"],
    action: "newContact",
    description: "Novi kontakt",
    href: "/contacts/new",
    category: "actions",
  },
  {
    id: "new-product",
    keys: ["cmd", "shift", "p"],
    action: "newProduct",
    description: "Novi proizvod",
    href: "/products/new",
    category: "actions",
  },
  {
    id: "new-expense",
    keys: ["cmd", "shift", "e"],
    action: "newExpense",
    description: "Novi trošak",
    href: "/expenses/new",
    category: "actions",
  },
  {
    id: "search",
    keys: ["cmd", "k"],
    action: "search",
    description: "Pretraga",
    category: "actions",
  },
]

// Form shortcuts
export const FORM_SHORTCUTS: Shortcut[] = [
  {
    id: "save",
    keys: ["cmd", "s"],
    action: "save",
    description: "Spremi",
    category: "forms",
  },
  {
    id: "cancel",
    keys: ["escape"],
    action: "cancel",
    description: "Odustani",
    category: "forms",
  },
  {
    id: "submit",
    keys: ["cmd", "enter"],
    action: "submit",
    description: "Pošalji",
    category: "forms",
  },
]

// Modal shortcuts
export const MODAL_SHORTCUTS: Shortcut[] = [
  {
    id: "close-modal",
    keys: ["escape"],
    action: "closeModal",
    description: "Zatvori",
    category: "modals",
  },
  {
    id: "confirm-modal",
    keys: ["cmd", "enter"],
    action: "confirmModal",
    description: "Potvrdi",
    category: "modals",
  },
]

// List navigation shortcuts
export const LIST_SHORTCUTS: Shortcut[] = [
  {
    id: "next-item",
    keys: ["↓"],
    action: "nextItem",
    description: "Sljedeća stavka",
    category: "lists",
  },
  {
    id: "prev-item",
    keys: ["↑"],
    action: "prevItem",
    description: "Prethodna stavka",
    category: "lists",
  },
  {
    id: "first-item",
    keys: ["home"],
    action: "firstItem",
    description: "Prva stavka",
    category: "lists",
  },
  {
    id: "last-item",
    keys: ["end"],
    action: "lastItem",
    description: "Zadnja stavka",
    category: "lists",
  },
  {
    id: "select-item",
    keys: ["enter"],
    action: "selectItem",
    description: "Odaberi",
    category: "lists",
  },
]

// Legacy: Keep GLOBAL_SHORTCUTS for backward compatibility
export const GLOBAL_SHORTCUTS: Shortcut[] = [
  ...ACTION_SHORTCUTS.slice(0, 4), // new-invoice, new-contact, new-product
  NAVIGATION_SHORTCUTS[0], // dashboard
  ACTION_SHORTCUTS[4], // search
]

// All shortcuts grouped by category
export const ALL_SHORTCUTS: Record<ShortcutCategory, Shortcut[]> = {
  navigation: NAVIGATION_SHORTCUTS,
  actions: ACTION_SHORTCUTS,
  forms: FORM_SHORTCUTS,
  modals: MODAL_SHORTCUTS,
  lists: LIST_SHORTCUTS,
}

// Category labels for UI
export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigacija",
  actions: "Brze akcije",
  forms: "Forme",
  modals: "Modalni prozori",
  lists: "Liste",
}

export function formatShortcut(keys: string[]): string {
  return keys
    .map((key) => {
      if (key === "cmd") return "⌘"
      if (key === "ctrl") return "Ctrl"
      if (key === "shift") return "⇧"
      if (key === "alt") return "⌥"
      if (key === "↓") return "↓"
      if (key === "↑") return "↑"
      if (key === "escape") return "Esc"
      if (key === "enter") return "↵"
      if (key === "home") return "Home"
      if (key === "end") return "End"
      return key.toUpperCase()
    })
    .join("")
}

/**
 * Get platform-specific key label
 * Uses ⌘ on Mac, Ctrl on Windows/Linux
 */
export function getPlatformKey(): string {
  if (typeof window === "undefined") return "⌘"
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+"
}
