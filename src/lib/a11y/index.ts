/**
 * Accessibility utilities for WCAG compliance
 * Provides helper functions for aria labels, focus management, and screen reader announcements
 */

import { useEffect, useRef, useCallback } from "react"

// ============================================================================
// Aria Label Helpers
// ============================================================================

/**
 * Generate aria-label for navigation items
 */
export function getNavAriaLabel(
  name: string,
  isActive: boolean,
  locale: "hr" | "en" = "hr"
): string {
  const activeText = locale === "hr" ? "trenutna stranica" : "current page"
  return isActive ? `${name}, ${activeText}` : name
}

/**
 * Generate aria-label for progress indicators
 */
export function getProgressAriaLabel(
  current: number,
  total: number,
  locale: "hr" | "en" = "hr"
): string {
  const percentage = Math.round((current / total) * 100)
  if (locale === "hr") {
    return `Napredak: ${current} od ${total} zadataka, ${percentage} posto završeno`
  }
  return `Progress: ${current} of ${total} tasks, ${percentage} percent complete`
}

/**
 * Generate aria-label for status badges
 */
export function getStatusAriaLabel(
  status: string,
  description?: string,
  locale: "hr" | "en" = "hr"
): string {
  const statusText = locale === "hr" ? "Status" : "Status"
  const base = `${statusText}: ${status}`
  return description ? `${base}. ${description}` : base
}

/**
 * Generate aria-label for sortable table headers
 */
export function getSortAriaLabel(
  columnName: string,
  currentSort?: { field: string; order: "asc" | "desc" },
  fieldName?: string,
  locale: "hr" | "en" = "hr"
): string {
  if (!currentSort || !fieldName || currentSort.field !== fieldName) {
    const sortText = locale === "hr" ? "Sortiraj po" : "Sort by"
    return `${sortText} ${columnName}`
  }

  const direction =
    currentSort.order === "asc"
      ? locale === "hr"
        ? "uzlazno"
        : "ascending"
      : locale === "hr"
        ? "silazno"
        : "descending"

  const sortedText = locale === "hr" ? "Sortirano po" : "Sorted by"
  return `${sortedText} ${columnName}, ${direction}`
}

/**
 * Generate aria-label for pagination
 */
export function getPaginationAriaLabel(
  page: number,
  totalPages: number,
  locale: "hr" | "en" = "hr"
): string {
  if (locale === "hr") {
    return `Stranica ${page} od ${totalPages}`
  }
  return `Page ${page} of ${totalPages}`
}

// ============================================================================
// Focus Trap Hook
// ============================================================================

/**
 * Hook to trap focus within a modal or dialog
 * Returns ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(isActive: boolean = true) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element on mount
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Allow consumer to handle escape
        container.dispatchEvent(new CustomEvent("escapekeypressed"))
      }
    }

    container.addEventListener("keydown", handleTabKey as EventListener)
    container.addEventListener("keydown", handleEscapeKey as EventListener)

    return () => {
      container.removeEventListener("keydown", handleTabKey as EventListener)
      container.removeEventListener("keydown", handleEscapeKey as EventListener)
    }
  }, [isActive])

  return containerRef
}

// ============================================================================
// Screen Reader Announcer
// ============================================================================

/**
 * Hook to announce messages to screen readers
 * Returns announce function to trigger announcements
 */
export function useScreenReaderAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Create live region for announcements
    const announcer = document.createElement("div")
    announcer.setAttribute("role", "status")
    announcer.setAttribute("aria-live", "polite")
    announcer.setAttribute("aria-atomic", "true")
    announcer.className = "sr-only"
    document.body.appendChild(announcer)
    announcerRef.current = announcer

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current)
      }
    }
  }, [])

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (!announcerRef.current) return

    announcerRef.current.setAttribute("aria-live", priority)
    announcerRef.current.textContent = message

    // Clear after announcement
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = ""
      }
    }, 1000)
  }, [])

  return announce
}

/**
 * Standalone function to announce to screen readers
 * Use this when you can't use the hook
 */
export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite"
) {
  const announcer = document.createElement("div")
  announcer.setAttribute("role", "status")
  announcer.setAttribute("aria-live", priority)
  announcer.setAttribute("aria-atomic", "true")
  announcer.className = "sr-only"
  announcer.textContent = message
  document.body.appendChild(announcer)

  setTimeout(() => {
    document.body.removeChild(announcer)
  }, 1000)
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Hook to restore focus when a component unmounts
 */
export function useFocusReturn() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement

    return () => {
      if (
        previousActiveElement.current &&
        typeof previousActiveElement.current.focus === "function"
      ) {
        previousActiveElement.current.focus()
      }
    }
  }, [])
}

/**
 * Set focus to an element by selector
 */
export function focusElement(selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  element?.focus()
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false

  const focusableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]
  if (focusableTags.includes(element.tagName)) return true

  return element.hasAttribute("tabindex") && element.getAttribute("tabindex") !== "-1"
}

// ============================================================================
// Keyboard Navigation Helpers
// ============================================================================

/**
 * Hook for arrow key navigation in lists
 */
export function useArrowKeyNavigation<T extends HTMLElement = HTMLElement>(
  itemsCount: number,
  onSelect?: (index: number) => void
) {
  const currentIndex = useRef(0)
  const containerRef = useRef<T>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { key } = e

      if (key === "ArrowDown") {
        e.preventDefault()
        currentIndex.current = Math.min(currentIndex.current + 1, itemsCount - 1)
        focusItemAtIndex(currentIndex.current)
      } else if (key === "ArrowUp") {
        e.preventDefault()
        currentIndex.current = Math.max(currentIndex.current - 1, 0)
        focusItemAtIndex(currentIndex.current)
      } else if (key === "Enter" && onSelect) {
        e.preventDefault()
        onSelect(currentIndex.current)
      } else if (key === "Home") {
        e.preventDefault()
        currentIndex.current = 0
        focusItemAtIndex(0)
      } else if (key === "End") {
        e.preventDefault()
        currentIndex.current = itemsCount - 1
        focusItemAtIndex(itemsCount - 1)
      }
    },
    [itemsCount, onSelect]
  )

  const focusItemAtIndex = (index: number) => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll<HTMLElement>(
      '[role="option"], [role="menuitem"], button, a'
    )
    items[index]?.focus()
  }

  return { containerRef, handleKeyDown }
}

// ============================================================================
// ARIA Utilities
// ============================================================================

/**
 * Generate unique ID for aria-describedby and aria-labelledby
 */
let idCounter = 0
export function generateAriaId(prefix: string = "aria"): string {
  idCounter += 1
  return `${prefix}-${idCounter}-${Date.now()}`
}

/**
 * Visually hidden but accessible to screen readers
 * Use this class in your components
 */
export const visuallyHiddenClass = "sr-only"

/**
 * CSS for sr-only class (add to global styles)
 */
export const srOnlyStyles = `
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`
