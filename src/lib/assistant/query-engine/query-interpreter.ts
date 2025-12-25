// src/lib/assistant/query-engine/query-interpreter.ts
/**
 * QUERY INTERPRETATION MODULE
 *
 * Stage 1 of the 3-stage fail-closed pipeline.
 * Must run BEFORE any retrieval or answer generation.
 *
 * This module:
 * 1. Classifies topic, intent, and jurisdiction
 * 2. Detects personalization needs
 * 3. Extracts entities
 * 4. Computes confidence score
 *
 * If confidence < threshold, pipeline must NOT proceed to retrieval.
 */

import type { Surface, Topic } from "../types"
import { normalizeDiacritics, extractKeywords } from "./text-utils"

// === INTERPRETATION TYPES ===

export type Intent =
  | "EXPLAIN"
  | "CALCULATE"
  | "DEADLINE"
  | "CHECKLIST"
  | "DEFINITION"
  | "PROCEDURE"
  | "UNKNOWN"

export type Jurisdiction = "HR" | "EU" | "OTHER" | "UNKNOWN"

export interface Interpretation {
  topic: Topic
  intent: Intent
  jurisdiction: Jurisdiction
  personalizationNeeded: boolean
  entities: string[]
  timeContext?: string
  confidence: number
  // For clarification flow
  clarificationNeeded: boolean
  suggestedClarifications?: string[]
  // Debug info
  matchedPatterns: string[]
  rawTokenCount: number
  meaningfulTokenCount: number
}

// === CONFIDENCE THRESHOLD ===
// Below this, we MUST NOT proceed to retrieval
export const INTERPRETATION_CONFIDENCE_THRESHOLD = 0.4

// === PATTERN DICTIONARIES ===

// Topic classification patterns (Croatian + English)
const REGULATORY_PATTERNS = [
  // Tax
  "porez",
  "pdv",
  "vat",
  "dohodak",
  "dobit",
  "prirez",
  // Contributions
  "doprinos",
  "mio",
  "mzo",
  "hzzo",
  "hzmo",
  // Business forms
  "obrt",
  "pausaln",
  "doo",
  "jdoo",
  "firma",
  "tvrtka",
  // Fiscalization
  "fiskal",
  "racun",
  "blagajna",
  "pos",
  // Thresholds
  "prag",
  "limit",
  "granica",
  "prelaz",
  // Regulations
  "zakon",
  "propis",
  "uredba",
  "pravilnik",
  "direktiva",
  // Croatian regulatory bodies
  "porezna",
  "fina",
  "hgk",
  "minf",
]

const PRODUCT_PATTERNS = [
  "fiskai",
  "aplikacija",
  "registr",
  "prijav",
  "plan",
  "cijena",
  "pretplat",
  "funkcij",
  "modul",
  "postavk",
  "racun",
  "konto",
]

const SUPPORT_PATTERNS = [
  "pomoc",
  "podrsk",
  "gresk",
  "bug",
  "problem",
  "neradi",
  "ne-radi",
  "zastoj",
  "spor",
  "error",
  "help",
  "support",
]

// Intent classification patterns
const INTENT_PATTERNS: Record<Intent, string[]> = {
  EXPLAIN: ["sto", "koji", "koja", "koje", "what", "which", "explain", "objasn"],
  CALCULATE: ["koliko", "izracun", "obracun", "izracunaj", "calculate", "compute", "iznos"],
  DEADLINE: ["kada", "rok", "datum", "do-kad", "deadline", "when", "due"],
  CHECKLIST: ["koraci", "postupak", "popis", "lista", "checklist", "steps", "how-to"],
  DEFINITION: ["definicij", "znacenj", "pojam", "termin", "definition", "meaning"],
  PROCEDURE: ["kako", "postupak", "procedur", "proces", "how", "procedure"],
  UNKNOWN: [],
}

// Jurisdiction indicators
const HR_JURISDICTION_PATTERNS = [
  "hrvat",
  "croatia",
  "zagreb",
  "rh",
  "hrvatska",
  "porezna-uprava",
  "fina",
  "hgk",
  "minf",
  "kuna",
  "hrk",
  "eur", // EUR since Croatia uses EUR now
  "oib",
  "iban-hr",
]

const EU_JURISDICTION_PATTERNS = [
  "eu",
  "europsk",
  "europe",
  "direktiv",
  "uredba-eu",
  "intrastat",
  "vies",
  "moss",
  "oss",
]

// Personalization indicators (Croatian)
const PERSONALIZATION_PATTERNS = [
  // Possessives (all cases)
  "moj",
  "moja",
  "moje",
  "moji",
  "moju",
  "mojim",
  "mojoj",
  "mojih",
  "mojeg",
  "tvoj",
  "tvoja",
  "tvoje",
  "tvoji",
  "tvoju",
  "tvojim",
  "tvojoj",
  // First person verbs
  "trebam",
  "moram",
  "placam",
  "imam",
  "radim",
  "vodim",
  "prestajem",
  "prelazim",
  "prijavim",
  "registriram",
  // Calculation requests with personal context
  "koliko-mi",
  "preostaje",
  "ostalo-mi",
  "do-praga",
  // Specific to user's situation
  "za-mene",
  "u-mom",
  "moje-poslovanje",
  "moja-tvrtka",
  "moj-obrt",
]

// Time context patterns
const TIME_PATTERNS = [
  { pattern: /202[4-9]/, extract: (m: string) => m },
  { pattern: /ove?\s+godin[aeu]/, extract: () => new Date().getFullYear().toString() },
  { pattern: /prosle?\s+godin[aeu]/, extract: () => (new Date().getFullYear() - 1).toString() },
  { pattern: /sljedece?\s+godin[aeu]/, extract: () => (new Date().getFullYear() + 1).toString() },
  {
    pattern:
      /sijecanj|veljaca|ozujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac/i,
    extract: (m: string) => m,
  },
  { pattern: /q[1-4]/i, extract: (m: string) => m.toUpperCase() },
]

// Entity extraction patterns (regulatory concepts)
const ENTITY_PATTERNS = [
  { pattern: /pdv/i, entity: "PDV" },
  { pattern: /porez\s*(na)?\s*dohodak/i, entity: "POREZ_NA_DOHODAK" },
  { pattern: /porez\s*(na)?\s*dobit/i, entity: "POREZ_NA_DOBIT" },
  { pattern: /pausaln/i, entity: "PAUSALNI_OBRT" },
  { pattern: /fiskaliz/i, entity: "FISKALIZACIJA" },
  { pattern: /doprinos/i, entity: "DOPRINOSI" },
  { pattern: /prag/i, entity: "VAT_THRESHOLD" },
  { pattern: /e-?racun/i, entity: "E_RACUN" },
  { pattern: /joppd/i, entity: "JOPPD" },
  { pattern: /po-?sd/i, entity: "PO_SD" },
  { pattern: /mio|mzo|hzzo|hzmo/i, entity: "SOCIAL_CONTRIBUTIONS" },
]

// === HELPER FUNCTIONS ===

function tokenize(text: string): string[] {
  const normalized = normalizeDiacritics(text).toLowerCase()
  return normalized
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((t) => t.length >= 2)
}

function countPatternMatches(tokens: string[], patterns: string[]): number {
  let count = 0
  for (const token of tokens) {
    for (const pattern of patterns) {
      if (token.includes(pattern) || pattern.includes(token)) {
        count++
        break
      }
    }
  }
  return count
}

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  const normalized = normalizeDiacritics(text).toLowerCase()
  return patterns.some((p) => normalized.includes(p))
}

// === MAIN INTERPRETATION FUNCTION ===

export function interpretQuery(query: string, surface: Surface): Interpretation {
  const tokens = tokenize(query)
  const normalized = normalizeDiacritics(query).toLowerCase()
  const matchedPatterns: string[] = []

  // Track raw vs meaningful tokens
  const rawTokenCount = query.split(/\s+/).filter(Boolean).length
  const meaningfulTokenCount = tokens.length

  // === 1. TOPIC CLASSIFICATION ===
  const regulatoryScore = countPatternMatches(tokens, REGULATORY_PATTERNS)
  const productScore = countPatternMatches(tokens, PRODUCT_PATTERNS)
  const supportScore = countPatternMatches(tokens, SUPPORT_PATTERNS)

  let topic: Topic = "REGULATORY"
  if (productScore > regulatoryScore && productScore > supportScore) {
    topic = "PRODUCT"
    matchedPatterns.push("topic:PRODUCT")
  } else if (supportScore > regulatoryScore && supportScore > productScore) {
    topic = "SUPPORT"
    matchedPatterns.push("topic:SUPPORT")
  } else if (regulatoryScore > 0) {
    topic = "REGULATORY"
    matchedPatterns.push("topic:REGULATORY")
  } else {
    // No clear topic - could be offtopic or ambiguous
    topic = "REGULATORY" // Default to regulatory, will have low confidence
  }

  // === 2. INTENT CLASSIFICATION ===
  let intent: Intent = "UNKNOWN"
  let maxIntentScore = 0
  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intentType === "UNKNOWN") continue
    const score = countPatternMatches(tokens, patterns)
    if (score > maxIntentScore) {
      maxIntentScore = score
      intent = intentType as Intent
      matchedPatterns.push(`intent:${intentType}`)
    }
  }

  // === 3. JURISDICTION DETECTION ===
  let jurisdiction: Jurisdiction = "UNKNOWN"
  const hrScore = countPatternMatches(tokens, HR_JURISDICTION_PATTERNS)
  const euScore = countPatternMatches(tokens, EU_JURISDICTION_PATTERNS)

  if (hrScore > 0 || topic === "REGULATORY") {
    // Default to HR for regulatory questions (this is a Croatian assistant)
    jurisdiction = "HR"
    if (hrScore > 0) matchedPatterns.push("jurisdiction:HR")
  }
  if (euScore > hrScore) {
    jurisdiction = "EU"
    matchedPatterns.push("jurisdiction:EU")
  }

  // === 4. PERSONALIZATION DETECTION ===
  let personalizationNeeded = false
  for (const pattern of PERSONALIZATION_PATTERNS) {
    if (
      normalized.includes(pattern) ||
      normalized.replace(/-/g, "").includes(pattern.replace(/-/g, ""))
    ) {
      personalizationNeeded = true
      matchedPatterns.push(`personalization:${pattern}`)
      break
    }
  }

  // === 5. ENTITY EXTRACTION ===
  const entities: string[] = []
  for (const { pattern, entity } of ENTITY_PATTERNS) {
    if (pattern.test(normalized)) {
      entities.push(entity)
      matchedPatterns.push(`entity:${entity}`)
    }
  }

  // === 6. TIME CONTEXT EXTRACTION ===
  let timeContext: string | undefined
  for (const { pattern, extract } of TIME_PATTERNS) {
    const match = normalized.match(pattern)
    if (match) {
      timeContext = extract(match[0])
      matchedPatterns.push(`time:${timeContext}`)
      break
    }
  }

  // === 7. CONFIDENCE SCORING ===
  let confidence = 0

  // Base confidence from meaningful tokens
  if (meaningfulTokenCount === 0) {
    confidence = 0 // Gibberish or empty
  } else if (meaningfulTokenCount === 1) {
    confidence = 0.2 // Single word - ambiguous
  } else if (meaningfulTokenCount === 2) {
    confidence = 0.35 // Two words - still fairly ambiguous
  } else {
    confidence = 0.45 // Multiple words - base confidence
  }

  // Boost for topic match
  if (regulatoryScore > 0 || productScore > 0 || supportScore > 0) {
    confidence += 0.15
  }

  // Boost for intent match
  if (intent !== "UNKNOWN") {
    confidence += 0.1
  }

  // Boost for entity matches
  confidence += Math.min(entities.length * 0.1, 0.2)

  // Penalty for no jurisdiction on regulatory
  if (topic === "REGULATORY" && jurisdiction === "UNKNOWN") {
    confidence -= 0.1
  }

  // Cap at 0.95 (never 100% confident)
  confidence = Math.max(0, Math.min(0.95, confidence))

  // === 8. CLARIFICATION FLOW ===
  const clarificationNeeded = confidence < INTERPRETATION_CONFIDENCE_THRESHOLD
  let suggestedClarifications: string[] | undefined

  if (clarificationNeeded) {
    suggestedClarifications = generateClarifications(topic, intent, entities)
  }

  return {
    topic,
    intent,
    jurisdiction,
    personalizationNeeded,
    entities,
    timeContext,
    confidence,
    clarificationNeeded,
    suggestedClarifications,
    matchedPatterns,
    rawTokenCount,
    meaningfulTokenCount,
  }
}

// === CLARIFICATION GENERATION ===

function generateClarifications(topic: Topic, intent: Intent, entities: string[]): string[] {
  const clarifications: string[] = []

  if (topic === "REGULATORY") {
    if (entities.length === 0) {
      clarifications.push("Koja je opća stopa PDV-a u Hrvatskoj?")
      clarifications.push("Koji je prag za paušalni obrt u 2025?")
      clarifications.push("Kako fiskalizirati račun?")
      clarifications.push("Kada moram u sustav PDV-a?")
    } else if (intent === "UNKNOWN") {
      // Have entities but unclear intent
      if (entities.includes("PDV")) {
        clarifications.push("Koje su stope PDV-a?")
        clarifications.push("Kada moram u sustav PDV-a?")
      }
      if (entities.includes("PAUSALNI_OBRT")) {
        clarifications.push("Koji je prag za paušalni obrt?")
        clarifications.push("Kako postati paušalac?")
      }
      if (entities.includes("DOPRINOSI")) {
        clarifications.push("Koliki su doprinosi za obrtnike?")
        clarifications.push("Kada se plaćaju doprinosi?")
      }
    }
  }

  // Ensure we have at least 2 and at most 4 suggestions
  if (clarifications.length < 2) {
    clarifications.push("Koja je opća stopa PDV-a u Hrvatskoj?")
    clarifications.push("Koji je prag za paušalni obrt?")
  }

  return clarifications.slice(0, 4)
}

// === VALIDATION HELPERS ===

export function isJurisdictionValid(interpretation: Interpretation): boolean {
  // For regulatory questions, we only support HR jurisdiction
  if (interpretation.topic === "REGULATORY") {
    return interpretation.jurisdiction === "HR" || interpretation.jurisdiction === "EU"
  }
  return true
}

export function shouldProceedToRetrieval(interpretation: Interpretation): boolean {
  // Must meet confidence threshold
  if (interpretation.confidence < INTERPRETATION_CONFIDENCE_THRESHOLD) {
    return false
  }

  // Must be a topic we can handle
  if (interpretation.topic === "REGULATORY") {
    // Must be HR or EU jurisdiction
    if (!isJurisdictionValid(interpretation)) {
      return false
    }
    return true
  }

  // Product and support questions don't need retrieval from regulatory DB
  return false
}
