export interface LanguageIssue {
  kind: "english" | "placeholder"
  matches: string[]
  ratio?: number
}

const englishWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "your",
  "you",
  "pricing",
  "features",
  "feature",
  "learn",
  "more",
  "sign",
  "up",
  "get",
  "started",
  "contact",
  "support",
  "dashboard",
  "manage",
  "business",
  "report",
  "reports",
  "account",
  "login",
  "register",
  "terms",
  "privacy",
  "policy",
  "upgrade",
  "plan",
  "plans",
  "compare",
  "integrations",
  "calculator",
  "calculators",
  "solution",
  "solutions",
  "fast",
  "simple",
  "easy",
  "secure",
  "securely",
  "start",
  "trial",
])

const placeholderPhrases = ["lorem", "ipsum", "todo", "tbd", "coming soon", "placeholder"]

function stripDiacritics(input: string) {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

export function detectEnglishLeakage(text: string, threshold = 0.02) {
  const issues: LanguageIssue[] = []
  const normalized = stripDiacritics(text.toLowerCase())
  const words = normalized.match(/\p{L}+/gu) ?? []

  if (words.length === 0) {
    return issues
  }

  const englishHits = words.filter((word) => englishWords.has(word))
  const ratio = englishHits.length / words.length

  if (englishHits.length > 0 && ratio >= threshold) {
    issues.push({
      kind: "english",
      matches: Array.from(new Set(englishHits)),
      ratio,
    })
  }

  const placeholderHits = placeholderPhrases.filter((phrase) => normalized.includes(phrase))

  if (placeholderHits.length > 0) {
    issues.push({
      kind: "placeholder",
      matches: placeholderHits,
    })
  }

  return issues
}
