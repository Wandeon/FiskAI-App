/**
 * NodePath builder - creates stable paths from numbering tokens
 *
 * Format: /članak:N/stavak:N/točka:X/podtočka:N/alineja:N
 *
 * PARSE-INV-002: nodePath derived from numbering tokens, not content
 */

export interface NodePathComponents {
  doc?: string // Root document (optional, usually omitted)
  glava?: string // Chapter (Glava)
  dio?: string // Part (Dio)
  title?: string // Section title (Naslov)
  article?: string // Article number (Članak)
  stavak?: string // Paragraph number (Stavak)
  tocka?: string // Point (Točka)
  podtocka?: string // Subpoint (Podtočka)
  alineja?: string // Bullet (Alineja)
  prilog?: string // Annex (Prilog)
}

/**
 * Parse article number from text like "Članak 28." or "Članak 1.a"
 */
export function parseArticleNumber(text: string): string | null {
  // Match: "Članak" + space + number + optional letter + period
  const match = text.match(/Članak\s+(\d+\.?[a-z]?)\.?/i)
  if (!match) return null

  // Clean up: remove dots, keep letter suffix
  return match[1].replace(/\./g, "")
}

/**
 * Parse stavak (paragraph) number from text like "(1)" at start
 */
export function parseStavakNumber(text: string): string | null {
  // Match: opening paren + number + closing paren at start of text
  const match = text.match(/^\s*\((\d+)\)/)
  if (!match) return null
  return match[1]
}

/**
 * Parse točka (point) label from text like "a)", "1.", "–"
 */
export function parseTockaLabel(text: string): string | null {
  const trimmed = text.trim()

  // Letter with closing paren: "a)", "b)", etc.
  const letterMatch = trimmed.match(/^([a-z])\)/i)
  if (letterMatch) return letterMatch[1].toLowerCase()

  // Number with period: "1.", "2.", etc.
  const numMatch = trimmed.match(/^(\d+)\./)
  if (numMatch) return numMatch[1]

  // Bullet characters: "–", "-", "•"
  if (/^[–\-•]/.test(trimmed)) return "bullet"

  return null
}

/**
 * Parse podtočka (subpoint) label
 */
export function parsePodtockaLabel(text: string): string | null {
  // Typically nested numbers or double letters
  const match = text.trim().match(/^(\d+)\)/)
  if (match) return match[1]

  const doubleMatch = text.trim().match(/^([a-z]{2})\)/i)
  if (doubleMatch) return doubleMatch[1].toLowerCase()

  return null
}

/**
 * Build a nodePath from components
 * PARSE-INV-002: Path derived from numbering, stable across content changes
 */
export function buildNodePath(components: NodePathComponents): string {
  const parts: string[] = []

  // Build path in hierarchical order
  if (components.dio) parts.push(`dio:${components.dio}`)
  if (components.glava) parts.push(`glava:${components.glava}`)
  if (components.title) parts.push(`naslov:${components.title}`)
  if (components.prilog) parts.push(`prilog:${components.prilog}`)
  if (components.article) parts.push(`članak:${components.article}`)
  if (components.stavak) parts.push(`stavak:${components.stavak}`)
  if (components.tocka) parts.push(`točka:${components.tocka}`)
  if (components.podtocka) parts.push(`podtočka:${components.podtocka}`)
  if (components.alineja) parts.push(`alineja:${components.alineja}`)

  return "/" + parts.join("/")
}

/**
 * Get parent path from a nodePath
 */
export function getParentPath(nodePath: string): string | null {
  const parts = nodePath.split("/").filter(Boolean)
  if (parts.length <= 1) return null
  return "/" + parts.slice(0, -1).join("/")
}

/**
 * Get the depth of a nodePath (number of components)
 */
export function getNodeDepth(nodePath: string): number {
  return nodePath.split("/").filter(Boolean).length
}
