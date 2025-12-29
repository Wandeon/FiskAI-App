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
 * 5. Detects nonsense/gibberish input
 * 6. Detects unsupported jurisdictions (foreign countries)
 *
 * CONFIDENCE TIERS:
 * - confidence < 0.6 → NEEDS_CLARIFICATION (always)
 * - 0.6 ≤ confidence < 0.75 → Retrieval with stricter matching (need 2+ entities)
 * - confidence ≥ 0.75 → Normal retrieval path
 *
 * If confidence < threshold, pipeline must NOT proceed to retrieval.
 */

import type { Surface, Topic } from "../types"
import { normalizeDiacritics } from "./text-utils"
import { generateContextualClarifications } from "./contextual-questions"

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
  // Nonsense detection
  isNonsense: boolean
  nonsenseRatio: number
  // Foreign jurisdiction
  foreignCountryDetected?: string
  // Debug info
  matchedPatterns: string[]
  rawTokenCount: number
  meaningfulTokenCount: number
}

// === CONFIDENCE THRESHOLDS ===
// Tiered thresholds for different quality gates

/** Below this → always NEEDS_CLARIFICATION */
export const CONFIDENCE_THRESHOLD_CLARIFY = 0.6

/** Between CLARIFY and STRICT → require 2+ entities for retrieval */
export const CONFIDENCE_THRESHOLD_STRICT = 0.75

/** Legacy export for backwards compatibility */
export const INTERPRETATION_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD_CLARIFY

/** Minimum entities required for medium-confidence retrieval */
export const MIN_ENTITIES_FOR_MEDIUM_CONFIDENCE = 2

/** Nonsense ratio threshold - above this, input is considered gibberish */
export const NONSENSE_RATIO_THRESHOLD = 0.6

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
  // E-invoicing standards (Pillar 6)
  "en16931",
  "ubl",
  "cii",
  "enabava",
  "nabav",
  "xml",
  "peppol",
  // Forms and submissions (Pillar 7)
  "obrazac",
  "obrazc",
  "joppd",
  "posd",
  "po-sd",
  "iod-doh",
  "prijav",
  // Corporate tax (Pillar 8)
  "porez-na-dobit",
  "profitni-porez",
  "porezdob",
  "capital-gain",
  "kapitalni-dobita",
  // Banking & reconciliation
  "banka",
  "bank",
  "sepa",
  "iban",
  "transakcij",
  "placan",
  "izvod",
  "statement",
  "reconcil",
  "uskladiv",
  "usklađiv",
  // Labor law
  "ugovor-o-radu",
  "zaposlenik",
  "radnik",
  "placa",
  "plaća",
  "otpremnin",
  "godišnji",
  "odmor",
  "bolovanje",
  "porodiljni",
  "otkaz",
  "prekid",
  // Corporate governance
  "skupstin",
  "skupštin",
  "no",
  "nadzorni-odbor",
  "upravni-odbor",
  "direktor",
  "skupština",
  "glasovanje",
  "odluka",
  // Customs & import
  "carin",
  "uvoz",
  "izvoz",
  "intrastat",
  "carinica",
  "pdv-uvoz",
  // Environmental
  "ekološk",
  "ekološka-pristojba",
  "otpad",
  "okoliš",
  "reciklaž",
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

// Foreign country patterns - explicitly unsupported jurisdictions
const FOREIGN_COUNTRY_PATTERNS: { pattern: RegExp; country: string }[] = [
  { pattern: /\b(njem|german|deutsch|berlin|münchen|munchen)\w*/i, country: "Germany" },
  { pattern: /\b(austri|österreich|wien|vienna|beč)\w*/i, country: "Austria" },
  { pattern: /\b(sloven|ljubljana)\w*/i, country: "Slovenia" },
  { pattern: /\b(srbi|serbia|beograd|belgrade)\w*/i, country: "Serbia" },
  { pattern: /\b(mađar|hungar|budapest|magyar)\w*/i, country: "Hungary" },
  { pattern: /\b(ital|roma|milano|rim)\w*/i, country: "Italy" },
  { pattern: /\b(franc|paris|pariz)\w*/i, country: "France" },
  { pattern: /\b(brit|england|london|uk)\w*/i, country: "United Kingdom" },
  { pattern: /\b(švi?c|swiss|switzerland|zürich|zurich)\w*/i, country: "Switzerland" },
  { pattern: /\b(polj|poland|warszaw|varsava)\w*/i, country: "Poland" },
  { pattern: /\b(češ|czech|praha|prague)\w*/i, country: "Czech Republic" },
  { pattern: /\b(slovač|slovak|bratislava)\w*/i, country: "Slovakia" },
  { pattern: /\b(rumunj|roman|bukurešt|bucharest)\w*/i, country: "Romania" },
  { pattern: /\b(bugar|bulgar|sofij|sofia)\w*/i, country: "Bulgaria" },
  { pattern: /\b(grec|greek|athen|atena)\w*/i, country: "Greece" },
  { pattern: /\b(španj|spain|madrid|barcelona)\w*/i, country: "Spain" },
  { pattern: /\b(portug|lisbon|lisabon)\w*/i, country: "Portugal" },
  { pattern: /\b(nizozem|dutch|amsterdam|holland|netherlands)\w*/i, country: "Netherlands" },
  { pattern: /\b(belgi|bruxelles|brussel|brussels)\w*/i, country: "Belgium" },
  { pattern: /\b(amerik|usa|united states|washington)\w*/i, country: "United States" },
]

// Valid Croatian/English word patterns for nonsense detection
// Words should be 3-20 chars, letters only (including Croatian diacritics)
const VALID_WORD_PATTERN = /^[a-zA-ZčćžšđČĆŽŠĐ]{3,20}$/

// Common Croatian stopwords and short valid words (not nonsense)
const VALID_SHORT_WORDS = new Set([
  "ja",
  "ti",
  "on",
  "mi",
  "vi",
  "to",
  "je",
  "se",
  "su",
  "od",
  "do",
  "za",
  "na",
  "po",
  "iz",
  "sa",
  "te",
  "ili",
  "ako",
  "što",
  "sto",
  "šta",
  "sta",
  "tko",
  "ko",
  "kad",
  "kako",
  "dok",
  "sve",
  "što",
  "da",
  "ne",
  "li",
  "bi",
  "me",
  "mu",
  "im",
  "ih",
  "nam",
  "vam",
  "njim",
  "njoj",
  "moj",
  "moja",
  "pdv",
  "vat",
  "eu",
  "rh",
  "hr",
  "oib",
])

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
  // Pillar 1: PDV (VAT)
  { pattern: /pdv/i, entity: "PDV" },
  { pattern: /\bvat\b/i, entity: "PDV" },
  { pattern: /prag\s*(za)?\s*pdv/i, entity: "VAT_THRESHOLD" },
  { pattern: /oss/i, entity: "OSS" },
  { pattern: /moss/i, entity: "MOSS" },

  // Pillar 2: Porez na dohodak (Income Tax)
  { pattern: /porez\s*(na)?\s*dohodak/i, entity: "POREZ_NA_DOHODAK" },
  { pattern: /iod-?doh/i, entity: "IOD_DOH" },
  { pattern: /prirez/i, entity: "PRIREZ" },

  // Pillar 3: Doprinosi (Contributions)
  { pattern: /doprinos/i, entity: "DOPRINOSI" },
  { pattern: /mio\s*(i|1)/i, entity: "MIO_I" },
  { pattern: /mio\s*(ii|2)/i, entity: "MIO_II" },
  { pattern: /\bmio\b/i, entity: "MIO" },
  { pattern: /\bmzo\b/i, entity: "MZO" },
  { pattern: /hzzo/i, entity: "HZZO" },
  { pattern: /hzmo/i, entity: "HZMO" },

  // Pillar 4: Fiskalizacija (Fiscalization)
  { pattern: /fiskaliz/i, entity: "FISKALIZACIJA" },
  { pattern: /\bjir\b/i, entity: "JIR" },
  { pattern: /\bzki\b/i, entity: "ZKI" },
  { pattern: /\bcis\b/i, entity: "CIS" },
  { pattern: /blagajna/i, entity: "BLAGAJNA" },
  { pattern: /fisk.*racun/i, entity: "FISKALNI_RACUN" },

  // Pillar 5: Paušalni obrt (Flat-rate business)
  { pattern: /pausaln/i, entity: "PAUSALNI_OBRT" },
  { pattern: /paušalni/i, entity: "PAUSALNI_OBRT" },
  { pattern: /po-?sd/i, entity: "PO_SD" },
  { pattern: /obrazac\s*po-?sd/i, entity: "PO_SD" },

  // Pillar 6: E-računi (E-invoicing)
  { pattern: /e-?racun/i, entity: "E_RACUN" },
  { pattern: /en\s*16931/i, entity: "EN16931" },
  { pattern: /\bubl\b/i, entity: "UBL" },
  { pattern: /\bcii\b/i, entity: "CII" },
  { pattern: /peppol/i, entity: "PEPPOL" },
  { pattern: /e-?nabav/i, entity: "ENABAVA" },

  // Pillar 7: JOPPD/Obrasci (Forms)
  { pattern: /joppd/i, entity: "JOPPD" },
  { pattern: /obrazac/i, entity: "OBRAZAC" },
  { pattern: /iod/i, entity: "IOD" },
  { pattern: /po-?k/i, entity: "POK" },

  // Pillar 8: Corporate tax (Porez na dobit)
  { pattern: /porez\s*(na)?\s*dobit/i, entity: "POREZ_NA_DOBIT" },
  { pattern: /por.*dob/i, entity: "POREZ_NA_DOBIT" },
  { pattern: /kapit.*dobita/i, entity: "KAPITALNI_DOBITAK" },
  { pattern: /dividenda/i, entity: "DIVIDENDA" },

  // Banking & Reconciliation
  { pattern: /sepa/i, entity: "SEPA" },
  { pattern: /\biban\b/i, entity: "IBAN" },
  { pattern: /bank.*sync/i, entity: "BANK_SYNC" },
  { pattern: /izvo.*banke/i, entity: "IZVOD_BANKE" },
  { pattern: /reconcil/i, entity: "RECONCILIATION" },
  { pattern: /uskladiv/i, entity: "RECONCILIATION" },

  // Labor law
  { pattern: /ugovor\s*(o|o-)?\s*radu/i, entity: "UGOVOR_O_RADU" },
  { pattern: /otpremnin/i, entity: "OTPREMNINA" },
  { pattern: /godišnji\s*odmor/i, entity: "GODISNJI_ODMOR" },
  { pattern: /bolovanje/i, entity: "BOLOVANJE" },
  { pattern: /porodiljni/i, entity: "PORODILJNI_DOPUST" },

  // Corporate governance
  { pattern: /skupštin/i, entity: "SKUPSTINA" },
  { pattern: /skupstin/i, entity: "SKUPSTINA" },
  { pattern: /nadzorni\s*odbor/i, entity: "NADZORNI_ODBOR" },
  { pattern: /upravni\s*odbor/i, entity: "UPRAVNI_ODBOR" },

  // Customs & Import
  { pattern: /carin/i, entity: "CARINA" },
  { pattern: /uvoz/i, entity: "UVOZ" },
  { pattern: /izvoz/i, entity: "IZVOZ" },
  { pattern: /intrastat/i, entity: "INTRASTAT" },

  // Environmental
  { pattern: /ekološk.*pristojb/i, entity: "EKOLOSKA_PRISTOJBA" },
  { pattern: /otpad/i, entity: "OTPAD" },
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

/**
 * Tokenize preserving original characters (for nonsense detection)
 */
function tokenizeRaw(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-ZčćžšđČĆŽŠĐ0-9\s-]/g, " ")
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

/**
 * Detect if a token is likely nonsense (random characters)
 * Returns true if the token doesn't look like a real word
 */
function isNonsenseToken(token: string): boolean {
  // Short valid words are not nonsense
  if (VALID_SHORT_WORDS.has(token.toLowerCase())) {
    return false
  }

  // Check if it matches valid word pattern (letters only, 3-20 chars)
  if (!VALID_WORD_PATTERN.test(token)) {
    // Contains numbers or is too short/long
    // Numbers in regulatory context (like "2025") are not nonsense
    if (/^\d+$/.test(token)) {
      return false
    }
    return true
  }

  // Check for keyboard-mash patterns (repeated chars, qwerty sequences)
  const lower = token.toLowerCase()

  // Check for 3+ consecutive same character
  if (/(.)\1{2,}/.test(lower)) {
    return true
  }

  // Check for common keyboard mash patterns
  const keyboardPatterns = [
    /asdf/i,
    /qwer/i,
    /zxcv/i,
    /hjkl/i,
    /yuio/i,
    /bnm/i,
    /^[qweasdzxc]+$/i,
    /^[yuiophjklbnm]+$/i,
  ]
  for (const pattern of keyboardPatterns) {
    if (pattern.test(lower)) {
      return true
    }
  }

  // Check consonant-only or vowel-only strings (unlikely in real words)
  const vowels = lower.replace(/[^aeiou]/g, "")
  const consonants = lower.replace(/[aeiou]/g, "")

  if (lower.length >= 4) {
    // All consonants or all vowels is suspicious
    if (vowels.length === 0 || consonants.length === 0) {
      return true
    }
    // Very low vowel ratio is suspicious (less than 15% vowels)
    if (vowels.length / lower.length < 0.15) {
      return true
    }
  }

  return false
}

/**
 * Calculate the ratio of nonsense tokens in the query
 */
function calculateNonsenseRatio(query: string): number {
  const tokens = tokenizeRaw(query)
  if (tokens.length === 0) return 1.0

  let nonsenseCount = 0
  for (const token of tokens) {
    if (isNonsenseToken(token)) {
      nonsenseCount++
    }
  }

  return nonsenseCount / tokens.length
}

/**
 * Detect if query mentions a foreign country explicitly
 */
function detectForeignCountry(query: string): string | undefined {
  const normalized = normalizeDiacritics(query).toLowerCase()

  for (const { pattern, country } of FOREIGN_COUNTRY_PATTERNS) {
    if (pattern.test(normalized)) {
      return country
    }
  }

  return undefined
}

// === MAIN INTERPRETATION FUNCTION ===

export async function interpretQuery(query: string, surface: Surface): Promise<Interpretation> {
  const tokens = tokenize(query)
  const normalized = normalizeDiacritics(query).toLowerCase()
  const matchedPatterns: string[] = []

  // Track raw vs meaningful tokens
  const rawTokenCount = query.split(/\s+/).filter(Boolean).length
  const meaningfulTokenCount = tokens.length

  // === 0. NONSENSE DETECTION (before any classification) ===
  const nonsenseRatio = calculateNonsenseRatio(query)
  const isNonsense = nonsenseRatio >= NONSENSE_RATIO_THRESHOLD
  if (isNonsense) {
    matchedPatterns.push(`nonsense:${nonsenseRatio.toFixed(2)}`)
  }

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

  // Check for foreign country FIRST
  const foreignCountryDetected = detectForeignCountry(query)
  if (foreignCountryDetected) {
    jurisdiction = "OTHER"
    matchedPatterns.push(`jurisdiction:OTHER:${foreignCountryDetected}`)
  } else if (hrScore > 0 || topic === "REGULATORY") {
    // Default to HR for regulatory questions (this is a Croatian assistant)
    jurisdiction = "HR"
    if (hrScore > 0) matchedPatterns.push("jurisdiction:HR")
  }
  if (euScore > hrScore && !foreignCountryDetected) {
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

  // === 7. CONFIDENCE SCORING (revised for 0.6/0.75 thresholds) ===
  let confidence = 0

  // If nonsense detected, confidence is 0
  if (isNonsense) {
    confidence = 0
  } else {
    // Base confidence from meaningful tokens (scaled higher for new thresholds)
    if (meaningfulTokenCount === 0) {
      confidence = 0 // Empty
    } else if (meaningfulTokenCount === 1) {
      confidence = 0.25 // Single word - too vague for answer
    } else if (meaningfulTokenCount === 2) {
      confidence = 0.45 // Two words - still vague, likely needs clarification
    } else if (meaningfulTokenCount === 3) {
      confidence = 0.55 // Three words - getting better but might need clarification
    } else {
      confidence = 0.65 // Multiple words - reasonable base confidence
    }

    // Boost for topic match (regulatory questions with topic get more credit)
    if (regulatoryScore > 0) {
      confidence += 0.1
    } else if (productScore > 0 || supportScore > 0) {
      confidence += 0.05 // Non-regulatory topics get less boost
    }

    // Boost for intent match
    if (intent !== "UNKNOWN") {
      confidence += 0.1
    }

    // Boost for entity matches (each distinct entity adds confidence)
    confidence += Math.min(entities.length * 0.08, 0.24)

    // Bonus for multiple entities (indicates a specific question)
    if (entities.length >= 2) {
      confidence += 0.05
    }

    // Penalty for no jurisdiction on regulatory
    if (topic === "REGULATORY" && jurisdiction === "UNKNOWN") {
      confidence -= 0.1
    }

    // Penalty for foreign jurisdiction
    if (foreignCountryDetected) {
      confidence -= 0.2 // Will likely be rejected anyway
    }

    // Cap at 0.95 (never 100% confident)
    confidence = Math.max(0, Math.min(0.95, confidence))
  }

  // === 8. CLARIFICATION FLOW ===
  // Use the new threshold: < 0.6 always needs clarification
  const clarificationNeeded = confidence < CONFIDENCE_THRESHOLD_CLARIFY
  let suggestedClarifications: string[] | undefined

  if (clarificationNeeded && !isNonsense) {
    // Use contextual LLM-based clarifications instead of hardcoded ones
    suggestedClarifications = await generateContextualClarifications(query, topic, entities)
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
    isNonsense,
    nonsenseRatio,
    foreignCountryDetected,
    matchedPatterns,
    rawTokenCount,
    meaningfulTokenCount,
  }
}

// === CLARIFICATION GENERATION ===
// Removed generateClarifications - now using generateContextualClarifications from contextual-questions.ts

// === VALIDATION HELPERS ===

export function isJurisdictionValid(interpretation: Interpretation): boolean {
  // For regulatory questions, we only support HR and EU jurisdictions
  if (interpretation.topic === "REGULATORY") {
    // Foreign country explicitly detected = invalid
    if (interpretation.foreignCountryDetected) {
      return false
    }
    return interpretation.jurisdiction === "HR" || interpretation.jurisdiction === "EU"
  }
  return true
}

/**
 * Determine if we should proceed to retrieval based on interpretation.
 * Uses tiered confidence thresholds:
 * - < 0.6: Never proceed (needs clarification)
 * - 0.6-0.75: Proceed only with 2+ entities (stricter matching)
 * - >= 0.75: Normal retrieval
 */
export function shouldProceedToRetrieval(interpretation: Interpretation): boolean {
  // Nonsense never proceeds
  if (interpretation.isNonsense) {
    return false
  }

  // Below clarification threshold = always needs clarification
  if (interpretation.confidence < CONFIDENCE_THRESHOLD_CLARIFY) {
    return false
  }

  // Medium confidence (0.6-0.75) requires stricter matching
  if (interpretation.confidence < CONFIDENCE_THRESHOLD_STRICT) {
    // Must have at least 2 distinct entities for medium-confidence retrieval
    if (interpretation.entities.length < MIN_ENTITIES_FOR_MEDIUM_CONFIDENCE) {
      return false
    }
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

/**
 * Get the retrieval mode based on confidence level.
 * Returns 'strict' for medium confidence, 'normal' for high confidence.
 */
export function getRetrievalMode(interpretation: Interpretation): "strict" | "normal" | "none" {
  if (!shouldProceedToRetrieval(interpretation)) {
    return "none"
  }

  if (interpretation.confidence < CONFIDENCE_THRESHOLD_STRICT) {
    return "strict"
  }

  return "normal"
}
