export type DesignTokenIssueKind = "hex" | "rgb" | "hsl" | "inline-style" | "tailwind-arbitrary"

export interface DesignTokenIssue {
  kind: DesignTokenIssueKind
  match: string
  index: number
  context: string
  reason: string
}

const hexPattern = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const rgbPattern = /\brgba?\([^)]*\)/gi
const hslPattern = /\bhsla?\([^)]*\)/gi
const inlineStylePattern = /style\s*=\s*{?\{[^}]*\}?/gi
const tailwindArbitraryPattern = /\b(?:bg|text|border|from|to|via|stroke|fill)-\[[^\]]+\]/g

function buildContext(text: string, index: number, match: string) {
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + match.length + 40)
  return text.slice(start, end).replace(/\s+/g, " ").trim()
}

function pushIssue(
  issues: DesignTokenIssue[],
  kind: DesignTokenIssueKind,
  text: string,
  match: RegExpMatchArray,
  reason: string
) {
  const index = match.index ?? 0
  issues.push({
    kind,
    match: match[0],
    index,
    context: buildContext(text, index, match[0]),
    reason,
  })
}

export function detectNonTokenColors(text: string) {
  const issues: DesignTokenIssue[] = []

  for (const match of text.matchAll(hexPattern)) {
    if (match[0].includes("var(--")) {
      continue
    }
    pushIssue(issues, "hex", text, match, "Hardcoded hex color detected.")
  }

  for (const match of text.matchAll(rgbPattern)) {
    pushIssue(issues, "rgb", text, match, "Hardcoded rgb/rgba color detected.")
  }

  for (const match of text.matchAll(hslPattern)) {
    pushIssue(issues, "hsl", text, match, "Hardcoded hsl/hsla color detected.")
  }

  for (const match of text.matchAll(tailwindArbitraryPattern)) {
    const value = match[0].slice(match[0].indexOf("[") + 1, -1)
    const normalized = value.toLowerCase()
    const isAllowed = normalized.includes("var(--") || normalized.includes("theme(")
    const hasHardcodedColor = /#|rgb|hsl/.test(normalized)

    if (!isAllowed && hasHardcodedColor) {
      pushIssue(
        issues,
        "tailwind-arbitrary",
        text,
        match,
        "Arbitrary Tailwind color detected; prefer design tokens."
      )
    }
  }

  for (const match of text.matchAll(inlineStylePattern)) {
    if (/color|background|border/.test(match[0])) {
      pushIssue(
        issues,
        "inline-style",
        text,
        match,
        "Inline styles detected; ensure design tokens are used."
      )
    }
  }

  return issues
}
