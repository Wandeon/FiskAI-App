/**
 * Accessibility aria-label helpers
 * These are pure functions safe to use in both server and client components
 */

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
