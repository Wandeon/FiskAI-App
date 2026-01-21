/**
 * Coverage Review Report Generator
 *
 * Produces an auditor-friendly verdict for a single NN document:
 * 1. Deterministic coverage assessment (cheap, no LLM)
 * 2. Usability classification (bindable vs unbound)
 * 3. Quality sampling with LLM verification (bounded tokens)
 * 4. Final verdict: READY_FOR_AUTO_INGEST or not
 */

import { db } from "../../db"
import { dbReg } from "../../db"
import { parseProvisionTree, stripHtml, ProvisionNode } from "./chunk-planner"

// ============================================================================
// TYPES
// ============================================================================

export interface SignalCounts {
  obligationHits: number
  deadlineHits: number
  definitionHits: number
  numericHits: number
  total: number
}

export interface NodeCoverage {
  nodePath: string
  level: "article" | "paragraph" | "point"
  articleNumber?: string
  paragraphNumber?: string
  textSnippet: string
  charCount: number
  hasAssertions: boolean
  assertionCount: number
  assertionTypes: string[]
  expectedSignals: SignalCounts
  extractedSignals: SignalCounts
  signalMismatch: boolean
  numericMissed: boolean // Has numeric signals but no THRESHOLD/RATE/VALUE
}

export interface AssertionUsability {
  assertionId: string
  conceptSlug: string
  assertionType: string
  extractedValue: string
  classification: "bindable" | "unbound" | "referenceOnly" | "needsResolution"
  classificationReason: string
  missingBindings?: string[]
}

export interface SampleVerification {
  assertionId: string
  conceptSlug: string
  assertionType: string
  extractedValue: string
  nodePath: string
  checks: {
    quoteExists: "PASS" | "PARTIAL" | "FAIL"
    valueParsing: "PASS" | "PARTIAL" | "FAIL"
    conditionMatch: "PASS" | "PARTIAL" | "FAIL"
    subjectAction: "PASS" | "PARTIAL" | "FAIL"
  }
  overallResult: "PASS" | "PARTIAL" | "FAIL"
  failureReasons: string[]
}

export interface CoverageReviewReport {
  evidenceId: string
  evidenceUrl: string
  documentTitle: string
  generatedAt: string

  // Section 1: Deterministic Coverage
  structuralCoverage: {
    totalNodes: number
    coveredNodes: number
    coveragePercent: number
    byLevel: Record<string, { total: number; covered: number; percent: number }>
    uncoveredNodes: Array<{ nodePath: string; snippet: string; expectedSignals: SignalCounts }>
    heatmapByArticle: Record<string, { covered: number; uncovered: number }>
  }

  signalAnalysis: {
    nodesWithHighExpectedLowExtracted: Array<{
      nodePath: string
      expected: SignalCounts
      extracted: SignalCounts
      gap: string
    }>
    criticalNumericMisses: Array<{
      nodePath: string
      numericHits: number
      snippet: string
    }>
  }

  // Section 2: Usability
  usability: {
    totalAssertions: number
    bindable: number
    bindablePercent: number
    unbound: number
    unboundPercent: number
    referenceOnly: number
    needsResolution: number
    executableRulesCount: number
    citeableAssertionsCount: number
    topMissingBindings: string[]
    classifications: AssertionUsability[]
  }

  // Section 3: Quality Sampling
  qualitySampling: {
    sampleSize: number
    samplingStrategy: string
    byType: Record<string, { sampled: number; passed: number; accuracy: number }>
    overallAccuracy: number
    topFailureModes: string[]
    samples: SampleVerification[]
  }

  // Section 4: Final Verdict
  verdict: {
    readyForAutoIngest: boolean
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
    blockers: string[]
    nextFixes: string[]
    assessmentCroatian: string
  }
}

// ============================================================================
// SIGNAL DETECTION (keyword-based)
// ============================================================================

const OBLIGATION_KEYWORDS = [
  "mora",
  "moraju",
  "dužan",
  "dužni",
  "obveza",
  "obveznik",
  "potrebno je",
  "treba",
  "obvezan",
  "obvezna",
]
const DEADLINE_KEYWORDS = ["rok", "rokovi", "do dana", "u roku", "najkasnije", "prije", "dana"]
const DEFINITION_KEYWORDS = ["podrazumijeva", "smatra se", "znači", "definira", "jest", "označava"]

// Semantic numeric patterns - detect actual thresholds/rates, not structural references
// These patterns look for numbers WITH regulatory context (amounts, percentages, time limits)
const SEMANTIC_NUMERIC_PATTERNS = [
  // Monetary amounts: "1.000.000 EUR", "50.000 kuna", "500,00 €"
  /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:EUR|HRK|kuna|€|eura?)/gi,
  // Percentages with context: "50 %", "25%", "12,5 posto"
  /\d+(?:[.,]\d+)?\s*(?:%|posto|postotaka)/gi,
  // Time periods with context: "30 dana", "12 mjeseci", "3 godine"
  /\d+\s+(?:dana|mjeseci|mjesec|godina|godine|godinu|tjedana|tjedan|sati)/gi,
  // Thresholds with context keywords: "najmanje 50", "do 100.000", "više od 10"
  /(?:najmanje|najviše|do|preko|više od|manje od|iznad|ispod)\s+\d+(?:[.,]\d+)?/gi,
  // Amounts with decimal: "250.000,00" (Croatian number format with context)
  /\d{1,3}(?:\.\d{3})+,\d{2}/g,
]

// Patterns to EXCLUDE (structural references, not thresholds)
const STRUCTURAL_REFERENCE_PATTERNS = [
  // Article references: "članak 57.a", "članaka 8.a do 8.f"
  /članci?k?a?\s+\d+\.?[a-z]*/gi,
  // Paragraph references: "stavak 2", "stavka 3"
  /stavk[aeiou]?\s+\d+/gi,
  // Point references: "točka 1", "točke a)"
  /točk[aeiou]?\s+\d+|točk[aeiou]?\s+[a-z]\)/gi,
  // Cross-references: "iz stavka 2. članka 5"
  /iz\s+(?:stavka|članka|točke)\s+\d+/gi,
  // Article numbering in definitions: "8.a do 8.f", "57.zi do 57.cc"
  /\d+\.[a-z]+\s+do\s+\d+\.[a-z]+/gi,
]

/**
 * Count semantic numeric signals, filtering out structural references
 * This prevents false positives from article numbering like "članak 57.a"
 */
function countSemanticNumericSignals(text: string): number {
  // First, remove structural references to avoid false positives
  let cleanText = text
  for (const pattern of STRUCTURAL_REFERENCE_PATTERNS) {
    cleanText = cleanText.replace(pattern, " ")
  }

  // Count matches from semantic patterns
  let numericHits = 0
  const matchedPositions = new Set<string>()

  for (const pattern of SEMANTIC_NUMERIC_PATTERNS) {
    const matches = cleanText.match(pattern) || []
    for (const match of matches) {
      // Avoid double-counting overlapping matches
      const key = match.toLowerCase().trim()
      if (!matchedPositions.has(key)) {
        matchedPositions.add(key)
        numericHits++
      }
    }
    pattern.lastIndex = 0 // Reset regex
  }

  return numericHits
}

function countSignals(text: string): SignalCounts {
  const lowerText = text.toLowerCase()

  let obligationHits = 0
  for (const kw of OBLIGATION_KEYWORDS) {
    const matches = lowerText.match(new RegExp(kw, "gi"))
    obligationHits += matches?.length || 0
  }

  let deadlineHits = 0
  for (const kw of DEADLINE_KEYWORDS) {
    const matches = lowerText.match(new RegExp(kw, "gi"))
    deadlineHits += matches?.length || 0
  }

  let definitionHits = 0
  for (const kw of DEFINITION_KEYWORDS) {
    const matches = lowerText.match(new RegExp(kw, "gi"))
    definitionHits += matches?.length || 0
  }

  // Use semantic numeric detection instead of naive pattern
  const numericHits = countSemanticNumericSignals(text)

  return {
    obligationHits,
    deadlineHits,
    definitionHits,
    numericHits,
    total: obligationHits + deadlineHits + definitionHits + numericHits,
  }
}

function signalsFromAssertionTypes(types: string[]): SignalCounts {
  return {
    obligationHits: types.filter((t) => ["OBLIGATION", "PROHIBITION", "PROCEDURE"].includes(t))
      .length,
    deadlineHits: types.filter((t) => t === "DEADLINE").length,
    definitionHits: types.filter((t) => t === "DEFINITION").length,
    numericHits: types.filter((t) => ["THRESHOLD", "RATE", "VALUE"].includes(t)).length,
    total: types.length,
  }
}

// ============================================================================
// USABILITY CLASSIFICATION
// ============================================================================

// Known bindable concepts (maps to EvaluationContext fields)
const BINDABLE_CONCEPTS = new Set([
  "porez_dohodak",
  "pdv",
  "paušal",
  "rok_prijave",
  "rok_plaćanja",
  "prag_prihoda",
  "stopa_poreza",
  "stopa_pdv",
  "obveznik_pdv",
  "obveznik_poreza",
])

// Reference-only assertion types
const REFERENCE_TYPES = new Set(["REFERENCE"])

// Types that typically need resolution
const NEEDS_RESOLUTION_TYPES = new Set(["EXCEPTION", "PROCEDURE"])

function classifyAssertion(
  conceptSlug: string,
  assertionType: string,
  extractedValue: string,
  conditions?: string[]
): AssertionUsability {
  const domain = conceptSlug.split("/")[0]

  // Reference types are always referenceOnly
  if (REFERENCE_TYPES.has(assertionType)) {
    return {
      assertionId: "",
      conceptSlug,
      assertionType,
      extractedValue,
      classification: "referenceOnly",
      classificationReason: "Cross-reference to other article/law",
    }
  }

  // Check if domain is bindable
  if (BINDABLE_CONCEPTS.has(domain)) {
    return {
      assertionId: "",
      conceptSlug,
      assertionType,
      extractedValue,
      classification: "bindable",
      classificationReason: `Domain "${domain}" maps to known EvaluationContext fields`,
    }
  }

  // Check if needs resolution (depends on conditions/other articles)
  if (NEEDS_RESOLUTION_TYPES.has(assertionType) || (conditions && conditions.length > 0)) {
    return {
      assertionId: "",
      conceptSlug,
      assertionType,
      extractedValue,
      classification: "needsResolution",
      classificationReason: "Has conditions or procedural dependencies",
    }
  }

  // Default: unbound (no mapping exists)
  return {
    assertionId: "",
    conceptSlug,
    assertionType,
    extractedValue,
    classification: "unbound",
    classificationReason: `Domain "${domain}" has no known field mapping`,
    missingBindings: [domain],
  }
}

// ============================================================================
// NODE COVERAGE ANALYSIS
// ============================================================================

function buildNodePath(
  articleNumber?: string,
  paragraphNumber?: string,
  pointNumber?: string
): string {
  let path = ""
  if (articleNumber) path += `/članak:${articleNumber}`
  if (paragraphNumber) path += `/stavak:${paragraphNumber}`
  if (pointNumber) path += `/točka:${pointNumber}`
  return path || "/document"
}

/**
 * Normalize a fact's nodePath to match expected paths
 * Handles nested article formats like /članak:6/članak:8.a/stavak:1 -> /članak:6
 * And sub-article formats like /članak:57.bb -> find parent article from text content
 */
function findBestMatchingPath(
  factPath: string,
  expectedPaths: Set<string>,
  subArticleParentMap?: Map<string, string>
): string | null {
  // 1. Exact match
  if (expectedPaths.has(factPath)) {
    return factPath
  }

  // 2. Try progressively shorter paths for nested structure
  // e.g., /članak:6/članak:8.a/stavak:1 -> /članak:6/članak:8.a -> /članak:6
  const segments = factPath.split("/").filter(Boolean)
  for (let len = segments.length - 1; len >= 1; len--) {
    const shorterPath = "/" + segments.slice(0, len).join("/")
    if (expectedPaths.has(shorterPath)) {
      return shorterPath
    }
  }

  // 3. Try extracting just the first article number
  // e.g., /članak:6/članak:8.a -> extract "6" -> /članak:6
  const articleMatch = factPath.match(/\/članak:(\d+)/)
  if (articleMatch) {
    const simplePath = `/članak:${articleMatch[1]}`
    if (expectedPaths.has(simplePath)) {
      return simplePath
    }
  }

  // 4. Handle sub-article references like /članak:57.bb using the parent map
  // These are new articles defined within parent articles in amendment documents
  if (subArticleParentMap) {
    const subArticleMatch = factPath.match(/\/članak:(\d+)\.([a-z]+)/)
    if (subArticleMatch) {
      const baseNum = subArticleMatch[1]
      const suffix = subArticleMatch[2]
      const fullSubArticle = `${baseNum}.${suffix}`

      // Try exact sub-article match first
      const parentPath = subArticleParentMap.get(fullSubArticle)
      if (parentPath && expectedPaths.has(parentPath)) {
        return parentPath
      }

      // Try base number mapping (e.g., BASE:57 -> /članak:15)
      const baseKey = `BASE:${baseNum}`
      const baseParentPath = subArticleParentMap.get(baseKey)
      if (baseParentPath && expectedPaths.has(baseParentPath)) {
        return baseParentPath
      }
    }
  }

  return null
}

/**
 * Build a map from sub-article base numbers to their parent articles based on text content
 * E.g., if članak:15 contains text "dodaju se članci 57.zi do 57.cc", map base "57" -> "/članak:15"
 * This allows all 57.* paths to be mapped to članak 15
 */
function buildSubArticleParentMap(allNodes: NodeCoverage[]): Map<string, string> {
  const map = new Map<string, string>()

  // Look for patterns mentioning sub-article numbers like "članak 57.zh" or "članci 57.zi do 57.cc"
  const subArticlePattern = /članci?k?a?\s+(\d+)\.([a-z]+)/gi

  for (const node of allNodes) {
    const text = node.textSnippet
    const parentPath = `/članak:${node.articleNumber}`

    let match
    while ((match = subArticlePattern.exec(text)) !== null) {
      const baseNum = match[1]
      const suffix = match[2]

      // Map specific sub-article to parent
      const fullSubArticle = `${baseNum}.${suffix}`
      if (!map.has(fullSubArticle)) {
        map.set(fullSubArticle, parentPath)
      }

      // Also map the base number to this parent (so all 57.* can find the parent)
      // Use a special key like "BASE:57" to indicate this is a base mapping
      const baseKey = `BASE:${baseNum}`
      if (!map.has(baseKey)) {
        map.set(baseKey, parentPath)
      }
    }
    subArticlePattern.lastIndex = 0 // Reset regex
  }

  return map
}

function flattenNodes(
  nodes: ProvisionNode[],
  parentArticle?: string,
  parentParagraph?: string
): NodeCoverage[] {
  const result: NodeCoverage[] = []

  for (const node of nodes) {
    const articleNum = node.type === "article" ? node.number : parentArticle
    // Points inherit paragraph number from parent, paragraphs set their own
    const paragraphNum =
      node.type === "paragraph" ? node.number : node.type === "point" ? parentParagraph : undefined
    const pointNum = node.type === "point" ? node.number : undefined

    const nodePath = buildNodePath(articleNum, paragraphNum, pointNum)
    const signals = countSignals(node.text)

    result.push({
      nodePath,
      level: node.type,
      articleNumber: articleNum,
      paragraphNumber: paragraphNum,
      textSnippet: node.text.slice(0, 300).replace(/\n/g, " "),
      charCount: node.text.length,
      hasAssertions: false, // Will be filled later
      assertionCount: 0,
      assertionTypes: [],
      expectedSignals: signals,
      extractedSignals: {
        obligationHits: 0,
        deadlineHits: 0,
        definitionHits: 0,
        numericHits: 0,
        total: 0,
      },
      signalMismatch: false,
      numericMissed: false,
    })

    // Recurse into children, passing paragraph number for points to inherit
    if (node.children.length > 0) {
      const childParagraph = node.type === "paragraph" ? node.number : parentParagraph
      result.push(...flattenNodes(node.children, articleNum, childParagraph))
    }
  }

  return result
}

// ============================================================================
// QUALITY SAMPLING
// ============================================================================

interface CandidateFactForSampling {
  id: string
  suggestedConceptSlug: string | null
  extractedValue: string | null
  suggestedValueType: string | null
  overallConfidence: number
  groundingQuotes: unknown
  extractorNotes: string | null
  // V2 fields for span-anchored extraction
  assertionType: string | null
  assertionPayload: unknown
  payloadVersion: number
}

function stratifiedSample(
  facts: CandidateFactForSampling[],
  maxSamples: number = 30
): CandidateFactForSampling[] {
  const samples: CandidateFactForSampling[] = []

  // Parse assertion types from extractorNotes
  const byType = new Map<string, CandidateFactForSampling[]>()
  for (const fact of facts) {
    let assertionType = "UNKNOWN"
    if (fact.extractorNotes) {
      try {
        const notes = JSON.parse(fact.extractorNotes)
        assertionType = notes.assertionType || "UNKNOWN"
      } catch {
        // ignore
      }
    }
    if (!byType.has(assertionType)) {
      byType.set(assertionType, [])
    }
    byType.get(assertionType)!.push(fact)
  }

  // Priority types (always include if available)
  const priorityTypes = ["THRESHOLD", "RATE", "DEADLINE", "VALUE"]

  // First pass: get priority types (up to 3 each)
  for (const ptype of priorityTypes) {
    const typeFacts = byType.get(ptype) || []
    samples.push(...typeFacts.slice(0, 3))
    if (samples.length >= maxSamples) break
  }

  // Second pass: fill remaining slots with other types
  const remaining = maxSamples - samples.length
  if (remaining > 0) {
    const otherTypes = [...byType.keys()].filter((t) => !priorityTypes.includes(t))
    const perType = Math.ceil(remaining / Math.max(otherTypes.length, 1))

    for (const otype of otherTypes) {
      const typeFacts = byType.get(otype) || []
      const alreadySampled = new Set(samples.map((s) => s.id))
      const toAdd = typeFacts.filter((f) => !alreadySampled.has(f.id)).slice(0, perType)
      samples.push(...toAdd)
      if (samples.length >= maxSamples) break
    }
  }

  return samples.slice(0, maxSamples)
}

// ============================================================================
// DETERMINISTIC VERIFICATION (cheap, always runs)
// ============================================================================

const MIN_SAMPLES = 12 // Mandatory minimum for quality assessment

// ============================================================================
// RUBRIC-BASED TYPE VALIDATION
// Each type has multiple signals scored 0-1, pass on aggregate >= threshold
// This replaces "keyword police" with evidence-backed scoring
// ============================================================================

interface RubricSignal {
  name: string
  patterns: RegExp[]
  weight: number // 0.0-1.0
}

interface TypeRubric {
  signals: RubricSignal[]
  passThreshold: number // aggregate score to PASS
  partialThreshold: number // aggregate score for PARTIAL (below = UNVERIFIED)
  // No FAIL unless contradicted - absence of evidence != evidence of absence
}

const TYPE_RUBRICS: Record<string, TypeRubric> = {
  DEADLINE: {
    signals: [
      {
        name: "hasDateToken",
        patterns: [
          /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/i, // 31.12.2025
          /\d{4}-\d{2}-\d{2}/i, // 2025-12-31
          /\d{1,2}\.\s*(siječnja|veljače|ožujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenoga|prosinca)/i,
        ],
        weight: 0.4,
      },
      {
        name: "hasTemporalPreposition",
        patterns: [/\bdo\b/i, /najkasnije/i, /u roku/i, /prije/i, /nakon/i, /od dana/i],
        weight: 0.3,
      },
      {
        name: "hasDeadlineKeyword",
        patterns: [/\brok\b/i, /rokovi/i, /do dana/i, /dana\b/i],
        weight: 0.2,
      },
      {
        name: "hasPeriodExpression",
        patterns: [/u roku od \d+/i, /\d+\s+dana/i, /\d+\s+mjeseci/i, /\d+\s+godina/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.5,
    partialThreshold: 0.3,
  },

  THRESHOLD: {
    signals: [
      {
        name: "hasNumericValue",
        patterns: [
          /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/i, // Croatian number format
          /\d+\s*(?:EUR|HRK|kuna|eura|€)/i,
          /\d+\s*%/i,
        ],
        weight: 0.4,
      },
      {
        name: "hasComparatorConstraint",
        patterns: [
          /najmanje/i,
          /najviše/i,
          /manje od/i,
          /više od/i,
          /prelazi/i,
          /ne prelazi/i,
          /iznosi/i,
          /do\s+\d/i,
          /iznad/i,
          /ispod/i,
          /preko/i,
        ],
        weight: 0.3,
      },
      {
        name: "hasSubjectScope",
        patterns: [/prihod/i, /promet/i, /iznos/i, /ukupn/i, /vrijednost/i, /prag/i, /limit/i],
        weight: 0.2,
      },
      {
        name: "hasUnitMarker",
        patterns: [/EUR/i, /HRK/i, /kuna/i, /eura/i, /%/, /posto/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.5,
    partialThreshold: 0.3,
  },

  RATE: {
    signals: [
      {
        name: "hasPercentage",
        patterns: [/\d+\s*%/, /\d+\s+posto/i, /postotak/i],
        weight: 0.5,
      },
      {
        name: "hasRateKeyword",
        patterns: [/stopa/i, /postotak/i, /omjer/i, /udio/i],
        weight: 0.3,
      },
      {
        name: "hasNumericValue",
        patterns: [/\d+[.,]\d+/, /\d+/],
        weight: 0.2,
      },
    ],
    passThreshold: 0.5,
    partialThreshold: 0.3,
  },

  OBLIGATION: {
    signals: [
      {
        name: "hasObligationVerb",
        patterns: [/\bmora\b/i, /moraju/i, /dužan/i, /dužni/i, /obvezan/i, /obvezna/i],
        weight: 0.4,
      },
      {
        name: "hasNecessityMarker",
        patterns: [/potrebno/i, /treba/i, /nužno/i, /neophodno/i],
        weight: 0.3,
      },
      {
        name: "hasObligationNoun",
        patterns: [/obvez/i, /dužnost/i, /zahtjev/i],
        weight: 0.2,
      },
      {
        name: "hasActionVerb",
        patterns: [/dostaviti/i, /podnijeti/i, /izvijestiti/i, /prijaviti/i, /osigurati/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },

  PROHIBITION: {
    signals: [
      {
        name: "hasProhibitionVerb",
        patterns: [/zabran/i, /ne smije/i, /ne mogu/i, /zabranjeno/i],
        weight: 0.5,
      },
      {
        name: "hasNegativePermission",
        patterns: [/nije dozvoljeno/i, /nije dopušteno/i, /ne dopušta/i],
        weight: 0.3,
      },
      {
        name: "hasRestriction",
        patterns: [/ograničen/i, /ne može/i, /isključen/i],
        weight: 0.2,
      },
    ],
    passThreshold: 0.5,
    partialThreshold: 0.3,
  },

  DEFINITION: {
    signals: [
      {
        name: "hasDefinitionMarker",
        patterns: [/podrazumijeva/i, /znači/i, /označava/i, /definira/i],
        weight: 0.4,
      },
      {
        name: "hasConceptIntro",
        patterns: [/pojam/i, /u smislu/i, /smatra se/i, /jest\b/i],
        weight: 0.3,
      },
      {
        name: "hasTermPattern",
        patterns: [/».*«/i, /".*"/i, /„.*"/i], // Quoted terms
        weight: 0.2,
      },
      {
        name: "hasClassification",
        patterns: [/je\s+\w+\s+koji/i, /je\s+svaki/i, /obuhvaća/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },

  PROCEDURE: {
    signals: [
      {
        name: "hasProceduralVerb",
        patterns: [
          /evidentira/i,
          /upisuje/i,
          /vodi/i,
          /dostavlja/i,
          /prijavljuje/i,
          /podnosi/i,
          /izvještava/i,
          /sastavlja/i,
          /izdaje/i,
          /čuva/i,
          /omogućuje/i,
          /provodi/i,
          /utvrđuje/i,
          /obrađuje/i,
        ],
        weight: 0.4,
      },
      {
        name: "hasProcedureNoun",
        patterns: [/postupak/i, /procedura/i, /proces/i, /obrada/i],
        weight: 0.3,
      },
      {
        name: "hasStepMarker",
        patterns: [/prvo/i, /zatim/i, /nakon toga/i, /potom/i, /na temelju/i],
        weight: 0.2,
      },
      {
        name: "hasAdministrativeAction",
        patterns: [/prijava/i, /obrazac/i, /zahtjev/i, /izvješće/i, /evidencija/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },

  EXCEPTION: {
    signals: [
      {
        name: "hasExceptionMarker",
        patterns: [/izuzet/i, /iznimk/i, /osim/i, /isključ/i],
        weight: 0.4,
      },
      {
        name: "hasNonApplicability",
        patterns: [/ne odnosi se/i, /ne primjenjuje/i, /ne vrijedi/i],
        weight: 0.3,
      },
      {
        name: "hasConditionalException",
        patterns: [/osim ako/i, /osim u slučaju/i, /izuzev/i],
        weight: 0.2,
      },
      {
        name: "hasExclusionPhrase",
        patterns: [/ne uključuje/i, /ne obuhvaća/i, /izvan/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },

  REFERENCE: {
    signals: [
      {
        name: "hasLegalReference",
        patterns: [/članak/i, /stavak/i, /točka/i, /alineja/i],
        weight: 0.4,
      },
      {
        name: "hasLawName",
        patterns: [/pravilnik/i, /zakon/i, /uredba/i, /direktiva/i, /odluka/i],
        weight: 0.3,
      },
      {
        name: "hasReferencePhrase",
        patterns: [/u skladu s/i, /sukladno/i, /prema/i, /iz članka/i],
        weight: 0.2,
      },
      {
        name: "hasOfficialGazette",
        patterns: [/narodne novine/i, /nn/i, /službeni list/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },

  ENTITY: {
    signals: [
      {
        name: "hasEntityType",
        patterns: [/institucija/i, /subjekt/i, /tijelo/i, /organizacija/i, /društvo/i],
        weight: 0.4,
      },
      {
        name: "hasActorRole",
        patterns: [/obveznik/i, /osoba/i, /stranka/i, /korisnik/i, /posrednik/i],
        weight: 0.3,
      },
      {
        name: "hasOfficialBody",
        patterns: [/porezna uprava/i, /ministarstvo/i, /agencija/i, /nadležno tijelo/i],
        weight: 0.2,
      },
      {
        name: "hasLegalPerson",
        patterns: [/pravna osoba/i, /fizička osoba/i, /trgovačko društvo/i],
        weight: 0.1,
      },
    ],
    passThreshold: 0.4,
    partialThreshold: 0.2,
  },
}

// ============================================================================
// V2 SPAN VERIFICATION
// For span-anchored assertions, verify verbatim text appears at specified offset
// ============================================================================

interface V2AtomicPayload {
  type: "atomic"
  assertionType: string
  value: {
    verbatim: string
    canonical: string
    unit: string
    span: { start: number; end: number }
  }
}

interface V2TextualPayload {
  type: "textual"
  assertionType: string
  statement: {
    verbatim: string
    span: { start: number; end: number }
  }
}

type V2AssertionPayload = V2AtomicPayload | V2TextualPayload

function isV2Payload(payload: unknown): payload is V2AssertionPayload {
  if (!payload || typeof payload !== "object") return false
  const p = payload as Record<string, unknown>
  return p.type === "atomic" || p.type === "textual"
}

/**
 * Verify a V2 span-anchored assertion
 * Checks that verbatim text appears at the specified character offsets in the quote
 */
function verifyV2SpanAssertion(
  payload: V2AssertionPayload,
  quote: string
): {
  spanMatches: "PASS" | "PARTIAL" | "FAIL"
  spanMatchesReason: string
  verbatimInQuote: boolean
  atCorrectOffset: boolean
} {
  let verbatim: string
  let span: { start: number; end: number }

  if (payload.type === "atomic") {
    verbatim = payload.value.verbatim
    span = payload.value.span
  } else {
    verbatim = payload.statement.verbatim
    span = payload.statement.span
  }

  // Check 1: Does verbatim appear anywhere in quote?
  const verbatimInQuote = quote.includes(verbatim)

  // Check 2: Does verbatim appear at the specified span position?
  let atCorrectOffset = false
  if (span && typeof span.start === "number" && typeof span.end === "number") {
    // Extract text at span position
    const textAtSpan = quote.slice(span.start, span.end)
    atCorrectOffset = textAtSpan === verbatim
  }

  // Determine result
  let spanMatches: "PASS" | "PARTIAL" | "FAIL"
  let spanMatchesReason: string

  if (atCorrectOffset) {
    spanMatches = "PASS"
    spanMatchesReason = `Verbatim "${verbatim.slice(0, 30)}..." found at span [${span.start}:${span.end}]`
  } else if (verbatimInQuote) {
    // Verbatim exists but at wrong position - might be off-by-some chars
    spanMatches = "PARTIAL"
    // Find actual position for diagnostic
    const actualStart = quote.indexOf(verbatim)
    spanMatchesReason = `Verbatim found but at offset ${actualStart}, not ${span.start} (off by ${Math.abs(actualStart - span.start)} chars)`
  } else {
    // Verbatim not in quote at all
    spanMatches = "FAIL"
    spanMatchesReason = `Verbatim "${verbatim.slice(0, 30)}..." not found in quote`
  }

  return { spanMatches, spanMatchesReason, verbatimInQuote, atCorrectOffset }
}

/**
 * Score an assertion type using rubric-based evaluation
 * Returns score 0.0-1.0 and breakdown of which signals matched
 */
function scoreTypeWithRubric(
  assertionType: string,
  textToCheck: string
): { score: number; matchedSignals: string[]; outcome: "PASS" | "PARTIAL" | "UNVERIFIED" } {
  const rubric = TYPE_RUBRICS[assertionType]

  if (!rubric) {
    // Unknown type - can't validate, mark as UNVERIFIED (not FAIL)
    return { score: 0, matchedSignals: [], outcome: "UNVERIFIED" }
  }

  let totalScore = 0
  const matchedSignals: string[] = []

  for (const signal of rubric.signals) {
    const hasMatch = signal.patterns.some((p) => p.test(textToCheck))
    if (hasMatch) {
      totalScore += signal.weight
      matchedSignals.push(signal.name)
    }
  }

  let outcome: "PASS" | "PARTIAL" | "UNVERIFIED"
  if (totalScore >= rubric.passThreshold) {
    outcome = "PASS"
  } else if (totalScore >= rubric.partialThreshold) {
    outcome = "PARTIAL"
  } else {
    // No evidence != contradiction. Mark as UNVERIFIED, not FAIL.
    outcome = "UNVERIFIED"
  }

  return { score: totalScore, matchedSignals, outcome }
}

/**
 * Deterministic verification - cheap checks that don't require LLM
 * V2 assertions use span-based verification for higher precision
 */
function verifyAssertionDeterministic(
  fact: CandidateFactForSampling,
  evidenceText: string
): {
  quoteExists: "PASS" | "PARTIAL" | "FAIL"
  quoteExistsReason: string
  valueParsing: "PASS" | "PARTIAL" | "FAIL" | "SKIP"
  valueParsingReason: string
  typeMatches: "PASS" | "PARTIAL" | "FAIL"
  typeMatchesReason: string
  needsLlmVerification: boolean
} {
  let assertionType = "UNKNOWN"
  let quote = ""

  if (fact.extractorNotes) {
    try {
      const notes = JSON.parse(fact.extractorNotes)
      assertionType = notes.assertionType || "UNKNOWN"
    } catch {
      // ignore
    }
  }

  // Use assertionType from fact if available (v2)
  if (fact.assertionType) {
    assertionType = fact.assertionType
  }

  if (fact.groundingQuotes && Array.isArray(fact.groundingQuotes)) {
    const gq = fact.groundingQuotes[0] as { quote?: string }
    quote = gq?.quote || ""
  }

  // Check 1: Quote exists in evidence
  let quoteExists: "PASS" | "PARTIAL" | "FAIL" = "FAIL"
  let quoteExistsReason = ""

  if (!quote) {
    quoteExists = "FAIL"
    quoteExistsReason = "No quote provided"
  } else {
    // Normalize whitespace for comparison
    const normalizedQuote = quote.replace(/\s+/g, " ").trim().toLowerCase()
    const normalizedEvidence = evidenceText.replace(/\s+/g, " ").toLowerCase()

    if (normalizedEvidence.includes(normalizedQuote)) {
      quoteExists = "PASS"
      quoteExistsReason = "Quote found verbatim in evidence"
    } else if (normalizedQuote.length > 20) {
      // Try partial match with first 50 chars
      const partialQuote = normalizedQuote.slice(0, 50)
      if (normalizedEvidence.includes(partialQuote)) {
        quoteExists = "PARTIAL"
        quoteExistsReason = "Partial quote match (first 50 chars)"
      } else {
        quoteExists = "FAIL"
        quoteExistsReason = "Quote not found in evidence"
      }
    } else {
      quoteExists = "FAIL"
      quoteExistsReason = "Quote not found in evidence"
    }
  }

  // =========================================================================
  // V2 SPAN-BASED VERIFICATION
  // If this is a v2 payload, use span verification instead of word overlap
  // =========================================================================
  if (fact.payloadVersion >= 2 && isV2Payload(fact.assertionPayload)) {
    const v2Result = verifyV2SpanAssertion(fact.assertionPayload, quote)

    // For v2, span verification replaces both value parsing AND type matching
    // because the span itself proves the value was extracted correctly
    const valueParsing = v2Result.spanMatches
    const valueParsingReason = v2Result.spanMatchesReason

    // Type matching for v2: if span is correct, type is validated
    // (the extractor is responsible for correct type assignment)
    let typeMatches: "PASS" | "PARTIAL" | "FAIL"
    let typeMatchesReason: string

    if (v2Result.spanMatches === "PASS") {
      typeMatches = "PASS"
      typeMatchesReason = `V2 span-verified ${assertionType}`
    } else if (v2Result.spanMatches === "PARTIAL") {
      // Span offset is wrong but verbatim exists - still valid type
      typeMatches = "PASS"
      typeMatchesReason = `V2 verbatim verified (offset drift) for ${assertionType}`
    } else {
      // Verbatim not in quote - cannot verify type
      typeMatches = "PARTIAL"
      typeMatchesReason = `V2 verbatim missing - cannot verify ${assertionType}`
    }

    // V2 needs LLM only if verbatim completely missing
    const needsLlmVerification =
      quoteExists === "PARTIAL" || (!v2Result.verbatimInQuote && quoteExists === "PASS")

    return {
      quoteExists,
      quoteExistsReason,
      valueParsing,
      valueParsingReason,
      typeMatches,
      typeMatchesReason,
      needsLlmVerification,
    }
  }

  // =========================================================================
  // V1 FALLBACK: Word overlap and rubric-based verification
  // =========================================================================

  // Check 2: Value appears in quote (when applicable)
  let valueParsing: "PASS" | "PARTIAL" | "FAIL" | "SKIP" = "SKIP"
  let valueParsingReason = ""

  const extractedValue = fact.extractedValue || ""
  if (!extractedValue || extractedValue.length < 2) {
    valueParsing = "SKIP"
    valueParsingReason = "No extractable value"
  } else if (!quote) {
    valueParsing = "FAIL"
    valueParsingReason = "No quote to check value against"
  } else {
    const normalizedValue = extractedValue.replace(/\s+/g, " ").trim().toLowerCase()
    const normalizedQuote = quote.replace(/\s+/g, " ").toLowerCase()

    // For short values (numbers, dates), check exact presence
    if (normalizedValue.length < 20) {
      if (normalizedQuote.includes(normalizedValue)) {
        valueParsing = "PASS"
        valueParsingReason = "Value found in quote"
      } else {
        valueParsing = "PARTIAL"
        valueParsingReason = "Value not found verbatim in quote (may be paraphrased)"
      }
    } else {
      // For longer values, check partial overlap
      const valueWords = normalizedValue.split(/\s+/).filter((w) => w.length > 3)
      const matchedWords = valueWords.filter((w) => normalizedQuote.includes(w))
      const matchRatio = matchedWords.length / Math.max(valueWords.length, 1)

      if (matchRatio >= 0.7) {
        valueParsing = "PASS"
        valueParsingReason = `${Math.round(matchRatio * 100)}% of value words found in quote`
      } else if (matchRatio >= 0.4) {
        valueParsing = "PARTIAL"
        valueParsingReason = `Only ${Math.round(matchRatio * 100)}% of value words found`
      } else {
        valueParsing = "FAIL"
        valueParsingReason = `Value poorly matches quote (${Math.round(matchRatio * 100)}% overlap)`
      }
    }
  }

  // Check 3: Assertion type validation using rubric-based scoring
  // This replaces naive keyword matching with multi-signal evidence scoring
  const textToCheck = (quote + " " + extractedValue).toLowerCase()
  const rubricResult = scoreTypeWithRubric(assertionType, textToCheck)

  // Map rubric outcome to validation result
  // UNVERIFIED means "can't prove it" not "it's wrong"
  let typeMatches: "PASS" | "PARTIAL" | "FAIL"
  let typeMatchesReason = ""

  if (rubricResult.outcome === "PASS") {
    typeMatches = "PASS"
    typeMatchesReason = `Strong evidence for ${assertionType} (score: ${rubricResult.score.toFixed(2)}, signals: ${rubricResult.matchedSignals.join(", ")})`
  } else if (rubricResult.outcome === "PARTIAL") {
    typeMatches = "PARTIAL"
    typeMatchesReason = `Weak evidence for ${assertionType} (score: ${rubricResult.score.toFixed(2)}, signals: ${rubricResult.matchedSignals.join(", ") || "none"})`
  } else {
    // UNVERIFIED - no evidence to confirm, but also no contradiction
    // Treat as PARTIAL (not FAIL) - absence of evidence != evidence of absence
    typeMatches = "PARTIAL"
    typeMatchesReason = `Unverified ${assertionType} - insufficient deterministic evidence (score: ${rubricResult.score.toFixed(2)})`
  }

  // Determine if LLM verification is needed
  // Only needed for genuinely ambiguous cases, not just "unverified"
  const needsLlmVerification =
    quoteExists === "PARTIAL" ||
    valueParsing === "PARTIAL" ||
    (rubricResult.outcome === "UNVERIFIED" && quoteExists === "PASS" && valueParsing !== "FAIL")

  return {
    quoteExists,
    quoteExistsReason,
    valueParsing,
    valueParsingReason,
    typeMatches,
    typeMatchesReason,
    needsLlmVerification,
  }
}

/**
 * Convert deterministic results to SampleVerification format
 */
function deterministicToSampleVerification(
  fact: CandidateFactForSampling,
  deterministicResult: ReturnType<typeof verifyAssertionDeterministic>
): SampleVerification {
  let assertionType = "UNKNOWN"
  let nodePath = ""

  if (fact.extractorNotes) {
    try {
      const notes = JSON.parse(fact.extractorNotes)
      assertionType = notes.assertionType || "UNKNOWN"
    } catch {
      // ignore
    }
  }

  if (fact.groundingQuotes && Array.isArray(fact.groundingQuotes)) {
    const gq = fact.groundingQuotes[0] as { nodePath?: string }
    nodePath = gq?.nodePath || ""
  }

  const checks = {
    quoteExists: deterministicResult.quoteExists,
    valueParsing:
      deterministicResult.valueParsing === "SKIP"
        ? ("PASS" as const)
        : deterministicResult.valueParsing,
    conditionMatch: "PASS" as const, // Can't check deterministically, assume pass
    subjectAction: deterministicResult.typeMatches,
  }

  const failureReasons: string[] = []
  if (checks.quoteExists === "FAIL") failureReasons.push(deterministicResult.quoteExistsReason)
  if (checks.valueParsing === "FAIL") failureReasons.push(deterministicResult.valueParsingReason)
  if (checks.subjectAction === "FAIL") failureReasons.push(deterministicResult.typeMatchesReason)

  // Calculate overall result
  const results = [checks.quoteExists, checks.valueParsing, checks.subjectAction]
  let overallResult: "PASS" | "PARTIAL" | "FAIL"
  if (results.every((r) => r === "PASS")) {
    overallResult = "PASS"
  } else if (results.some((r) => r === "FAIL")) {
    overallResult = "FAIL"
  } else {
    overallResult = "PARTIAL"
  }

  return {
    assertionId: fact.id,
    conceptSlug: fact.suggestedConceptSlug || "",
    assertionType,
    extractedValue: fact.extractedValue || "",
    nodePath,
    checks,
    overallResult,
    failureReasons,
  }
}

async function verifyAssertionSample(
  fact: CandidateFactForSampling,
  evidenceText: string,
  ollamaEndpoint: string,
  ollamaApiKey: string,
  ollamaModel: string
): Promise<SampleVerification> {
  let assertionType = "UNKNOWN"
  let nodePath = ""
  let conditions: string[] = []

  if (fact.extractorNotes) {
    try {
      const notes = JSON.parse(fact.extractorNotes)
      assertionType = notes.assertionType || "UNKNOWN"
      conditions = notes.conditions || []
    } catch {
      // ignore
    }
  }

  // Get quote from groundingQuotes
  let quote = ""
  if (fact.groundingQuotes && Array.isArray(fact.groundingQuotes)) {
    const gq = fact.groundingQuotes[0] as { quote?: string; nodePath?: string }
    quote = gq?.quote || ""
    nodePath = gq?.nodePath || ""
  }

  // Verification prompt
  const prompt = `You are verifying an extracted legal assertion. Check if it's accurate.

ASSERTION:
- Type: ${assertionType}
- Value: ${fact.extractedValue}
- Quote: "${quote}"
- Conditions: ${JSON.stringify(conditions)}

Check these 4 things:
1. QUOTE_EXISTS: Does the quote appear verbatim (or near-verbatim) in the evidence?
2. VALUE_PARSING: Is the extracted value correctly parsed from the quote? (dates as YYYY-MM-DD, numbers correctly, percentages with %)
3. CONDITION_MATCH: Do the conditions accurately reflect what's in the text? (not hallucinated)
4. SUBJECT_ACTION: Is the subject and action correctly identified at a high level?

Respond ONLY with JSON:
{
  "quoteExists": "PASS" | "PARTIAL" | "FAIL",
  "quoteExistsReason": "...",
  "valueParsing": "PASS" | "PARTIAL" | "FAIL",
  "valueParsingReason": "...",
  "conditionMatch": "PASS" | "PARTIAL" | "FAIL",
  "conditionMatchReason": "...",
  "subjectAction": "PASS" | "PARTIAL" | "FAIL",
  "subjectActionReason": "..."
}

EVIDENCE TEXT (search for quote here):
${evidenceText.slice(0, 10000)}
`

  try {
    const response = await fetch(`${ollamaEndpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ollamaApiKey}`,
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`)
    }

    const data = await response.json()
    const rawResponse = data.choices?.[0]?.message?.content || ""

    // Parse JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON in response")
    }

    const result = JSON.parse(jsonMatch[0])

    const checks = {
      quoteExists: result.quoteExists || "FAIL",
      valueParsing: result.valueParsing || "FAIL",
      conditionMatch: result.conditionMatch || "PASS", // Default to PASS if no conditions
      subjectAction: result.subjectAction || "FAIL",
    }

    const failureReasons: string[] = []
    if (checks.quoteExists === "FAIL")
      failureReasons.push(result.quoteExistsReason || "Quote not found")
    if (checks.valueParsing === "FAIL")
      failureReasons.push(result.valueParsingReason || "Value parsing error")
    if (checks.conditionMatch === "FAIL")
      failureReasons.push(result.conditionMatchReason || "Condition mismatch")
    if (checks.subjectAction === "FAIL")
      failureReasons.push(result.subjectActionReason || "Subject/action error")

    const passCount = Object.values(checks).filter((c) => c === "PASS").length
    const overallResult = passCount >= 3 ? "PASS" : passCount >= 2 ? "PARTIAL" : "FAIL"

    return {
      assertionId: fact.id,
      conceptSlug: fact.suggestedConceptSlug || "",
      assertionType,
      extractedValue: fact.extractedValue || "",
      nodePath,
      checks,
      overallResult,
      failureReasons,
    }
  } catch (error) {
    return {
      assertionId: fact.id,
      conceptSlug: fact.suggestedConceptSlug || "",
      assertionType,
      extractedValue: fact.extractedValue || "",
      nodePath,
      checks: {
        quoteExists: "FAIL",
        valueParsing: "FAIL",
        conditionMatch: "FAIL",
        subjectAction: "FAIL",
      },
      overallResult: "FAIL",
      failureReasons: [
        `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

// ============================================================================
// MAIN REPORT GENERATOR
// ============================================================================

export async function generateCoverageReview(
  evidenceId: string,
  options: {
    ollamaEndpoint: string
    ollamaApiKey: string
    ollamaModel: string
    maxSamples?: number
    skipLlmVerification?: boolean
  }
): Promise<CoverageReviewReport> {
  const maxSamples = options.maxSamples || 30

  // 1. Get evidence
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      url: true,
      rawContent: true,
    },
  })

  if (!evidence || !evidence.rawContent) {
    throw new Error(`Evidence not found: ${evidenceId}`)
  }

  // Parse document
  const isHtml =
    evidence.rawContent.trim().startsWith("<!") || evidence.rawContent.trim().startsWith("<html")
  const cleanText = isHtml ? stripHtml(evidence.rawContent) : evidence.rawContent

  // Extract title
  const titleMatch = evidence.rawContent.match(/<title>\s*(.*?)\s*<\/title>/i)
  const documentTitle = titleMatch ? titleMatch[1] : "Unknown"

  // Parse provision tree
  const provisionTree = parseProvisionTree(cleanText)
  const allNodes = flattenNodes(provisionTree)

  // 2. Get extracted assertions (CandidateFacts)
  const candidateFacts = await db.candidateFact.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  // Filter to facts that have groundingQuotes referencing this evidence
  // (simplified: we check all recent facts since we don't have direct link)
  const relevantFacts = candidateFacts.filter((f) => {
    if (!f.groundingQuotes) return false
    const gq = f.groundingQuotes as Array<{ quote?: string }>
    return gq.some((q) => q.quote && cleanText.includes(q.quote.slice(0, 50)))
  })

  // 3. Map assertions to nodes
  // First, build set of expected paths from allNodes for normalization
  const expectedPaths = new Set(allNodes.map((n) => n.nodePath))

  // Build map from sub-article numbers to parent articles (for amendment documents)
  const subArticleParentMap = buildSubArticleParentMap(allNodes)

  const nodeAssertions = new Map<string, Array<{ type: string; value: string }>>()
  let unmatchedFactPaths = 0

  for (const fact of relevantFacts) {
    let nodePath = ""
    let assertionType = "UNKNOWN"

    if (fact.groundingQuotes && Array.isArray(fact.groundingQuotes)) {
      const gq = fact.groundingQuotes[0] as { nodePath?: string }
      nodePath = gq?.nodePath || ""
    }
    if (fact.extractorNotes) {
      try {
        const notes = JSON.parse(fact.extractorNotes)
        assertionType = notes.assertionType || "UNKNOWN"
      } catch {
        // ignore
      }
    }

    if (!nodePath) continue

    // Normalize path to match expected paths (handles nested articles, sub-articles)
    const normalizedPath = findBestMatchingPath(nodePath, expectedPaths, subArticleParentMap)
    if (!normalizedPath) {
      unmatchedFactPaths++
      continue // Skip facts we can't map to any node
    }

    if (!nodeAssertions.has(normalizedPath)) {
      nodeAssertions.set(normalizedPath, [])
    }
    nodeAssertions
      .get(normalizedPath)!
      .push({ type: assertionType, value: fact.extractedValue || "" })
  }

  // Log path normalization stats for debugging
  if (unmatchedFactPaths > 0) {
    console.log(`  Path normalization: ${unmatchedFactPaths} facts could not be mapped to any node`)
  }

  // 4. Update node coverage with assertion info
  for (const node of allNodes) {
    const assertions = nodeAssertions.get(node.nodePath) || []
    node.hasAssertions = assertions.length > 0
    node.assertionCount = assertions.length
    node.assertionTypes = [...new Set(assertions.map((a) => a.type))]
    node.extractedSignals = signalsFromAssertionTypes(node.assertionTypes)

    // Check signal mismatch
    const expectedTotal = node.expectedSignals.total
    const extractedTotal = node.extractedSignals.total
    node.signalMismatch = expectedTotal > 3 && extractedTotal === 0

    // Check numeric miss
    node.numericMissed =
      node.expectedSignals.numericHits > 0 && node.extractedSignals.numericHits === 0
  }

  // 4b. Propagate coverage from paragraphs to child points
  // When extraction happens at paragraph level (because paragraph fits in MAX_CHUNK_CHARS),
  // child points inherit coverage since they were extracted as part of the parent.
  // Build a map of paragraph paths to their coverage info for inheritance
  const paragraphCoverage = new Map<string, { covered: boolean; types: string[]; count: number }>()
  for (const node of allNodes) {
    if (node.level === "paragraph" && node.hasAssertions) {
      paragraphCoverage.set(node.nodePath, {
        covered: true,
        types: node.assertionTypes,
        count: node.assertionCount,
      })
    }
  }

  // Now propagate to points - a point inherits from its parent paragraph
  for (const node of allNodes) {
    if (node.level === "point" && !node.hasAssertions) {
      // Point path is /članak:X/stavak:Y/točka:Z
      // Parent paragraph path is /članak:X/stavak:Y
      const parentPath = node.nodePath.replace(/\/točka:[^/]+$/, "")
      const parentCoverage = paragraphCoverage.get(parentPath)
      if (parentCoverage) {
        node.hasAssertions = true
        node.assertionCount = parentCoverage.count
        node.assertionTypes = parentCoverage.types
        node.extractedSignals = signalsFromAssertionTypes(parentCoverage.types)
        node.signalMismatch = false // Inherited, so no mismatch
        node.numericMissed = false // Check against inherited types
      }
    }
  }

  // 5. Build structural coverage
  const coveredNodes = allNodes.filter((n) => n.hasAssertions)
  const uncoveredNodes = allNodes.filter((n) => !n.hasAssertions)

  const byLevel: Record<string, { total: number; covered: number; percent: number }> = {}
  for (const level of ["article", "paragraph", "point"]) {
    const levelNodes = allNodes.filter((n) => n.level === level)
    const levelCovered = levelNodes.filter((n) => n.hasAssertions)
    byLevel[level] = {
      total: levelNodes.length,
      covered: levelCovered.length,
      percent:
        levelNodes.length > 0 ? Math.round((levelCovered.length / levelNodes.length) * 100) : 0,
    }
  }

  // Heatmap by article
  const heatmapByArticle: Record<string, { covered: number; uncovered: number }> = {}
  for (const node of allNodes) {
    const article = node.articleNumber || "unknown"
    if (!heatmapByArticle[article]) {
      heatmapByArticle[article] = { covered: 0, uncovered: 0 }
    }
    if (node.hasAssertions) {
      heatmapByArticle[article].covered++
    } else {
      heatmapByArticle[article].uncovered++
    }
  }

  // 6. Signal analysis
  const nodesWithHighExpectedLowExtracted = allNodes
    .filter((n) => n.signalMismatch)
    .map((n) => ({
      nodePath: n.nodePath,
      expected: n.expectedSignals,
      extracted: n.extractedSignals,
      gap: `Expected ${n.expectedSignals.total} signals, got 0`,
    }))

  const criticalNumericMisses = allNodes
    .filter((n) => n.numericMissed)
    .map((n) => ({
      nodePath: n.nodePath,
      numericHits: n.expectedSignals.numericHits,
      snippet: n.textSnippet,
    }))

  // 7. Usability classification
  const classifications: AssertionUsability[] = []
  for (const fact of relevantFacts) {
    let assertionType = "UNKNOWN"
    let conditions: string[] = []
    if (fact.extractorNotes) {
      try {
        const notes = JSON.parse(fact.extractorNotes)
        assertionType = notes.assertionType || "UNKNOWN"
        conditions = notes.conditions || []
      } catch {
        // ignore
      }
    }

    const classification = classifyAssertion(
      fact.suggestedConceptSlug || "",
      assertionType,
      fact.extractedValue || "",
      conditions
    )
    classification.assertionId = fact.id
    classifications.push(classification)
  }

  const bindable = classifications.filter((c) => c.classification === "bindable")
  const unbound = classifications.filter((c) => c.classification === "unbound")
  const referenceOnly = classifications.filter((c) => c.classification === "referenceOnly")
  const needsResolution = classifications.filter((c) => c.classification === "needsResolution")

  // Top missing bindings
  const missingBindings = new Map<string, number>()
  for (const u of unbound) {
    for (const mb of u.missingBindings || []) {
      missingBindings.set(mb, (missingBindings.get(mb) || 0) + 1)
    }
  }
  const topMissingBindings = [...missingBindings.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([binding, count]) => `${binding} (${count})`)

  // 8. Quality sampling - MANDATORY (N >= MIN_SAMPLES)
  // The quality gate MUST run on every review, not be optional
  const samples = stratifiedSample(relevantFacts, Math.max(maxSamples, MIN_SAMPLES))
  const sampleVerifications: SampleVerification[] = []

  // Check minimum sample requirement
  if (samples.length < MIN_SAMPLES) {
    // This is a pipeline failure, not a quality failure
    // Return a report that clearly indicates the pipeline is broken
    console.error(
      `INVALID_REVIEW_PIPELINE: Only ${samples.length} samples available, need ${MIN_SAMPLES}`
    )

    // We'll still generate the report but with clear blockers
    // This ensures the review process doesn't silently produce meaningless metrics
  }

  // Phase 1: ALWAYS run deterministic verification (cheap, no LLM)
  console.log(`Running deterministic verification on ${samples.length} samples...`)
  const hardCases: {
    sample: CandidateFactForSampling
    deterministicResult: ReturnType<typeof verifyAssertionDeterministic>
  }[] = []

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    console.log(`  [${i + 1}/${samples.length}] Deterministic check: ${sample.id}`)

    const deterministicResult = verifyAssertionDeterministic(sample, cleanText)

    // Convert deterministic result to SampleVerification
    const verification = deterministicToSampleVerification(sample, deterministicResult)
    sampleVerifications.push(verification)

    // Track hard cases that need LLM verification
    if (deterministicResult.needsLlmVerification) {
      hardCases.push({ sample, deterministicResult })
    }
  }

  // Phase 2: LLM verification ONLY for hard cases (max 5)
  const MAX_LLM_VERIFICATIONS = 5
  const llmCandidates = hardCases.slice(0, MAX_LLM_VERIFICATIONS)

  if (!options.skipLlmVerification && llmCandidates.length > 0) {
    console.log(`Running LLM verification on ${llmCandidates.length} hard cases...`)

    for (let i = 0; i < llmCandidates.length; i++) {
      const { sample } = llmCandidates[i]
      console.log(`  [${i + 1}/${llmCandidates.length}] LLM verify: ${sample.id}`)

      const llmVerification = await verifyAssertionSample(
        sample,
        cleanText,
        options.ollamaEndpoint,
        options.ollamaApiKey,
        options.ollamaModel
      )

      // Replace the deterministic result with the LLM result
      const existingIdx = sampleVerifications.findIndex((v) => v.assertionId === sample.id)
      if (existingIdx >= 0) {
        sampleVerifications[existingIdx] = llmVerification
      }

      // Rate limiting between LLM calls
      if (i < llmCandidates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  console.log(
    `Quality sampling complete: ${sampleVerifications.length} verified (${hardCases.length} hard cases, ${llmCandidates.length} LLM-verified)`
  )

  // Calculate accuracy by type
  const byType: Record<string, { sampled: number; passed: number; accuracy: number }> = {}
  for (const sv of sampleVerifications) {
    if (!byType[sv.assertionType]) {
      byType[sv.assertionType] = { sampled: 0, passed: 0, accuracy: 0 }
    }
    byType[sv.assertionType].sampled++
    if (sv.overallResult === "PASS") {
      byType[sv.assertionType].passed++
    }
  }
  for (const type of Object.keys(byType)) {
    byType[type].accuracy =
      byType[type].sampled > 0 ? Math.round((byType[type].passed / byType[type].sampled) * 100) : 0
  }

  const overallPassed = sampleVerifications.filter((sv) => sv.overallResult === "PASS").length
  const overallAccuracy =
    sampleVerifications.length > 0
      ? Math.round((overallPassed / sampleVerifications.length) * 100)
      : 0

  // Top failure modes
  const failureModes = new Map<string, number>()
  for (const sv of sampleVerifications) {
    for (const reason of sv.failureReasons) {
      failureModes.set(reason, (failureModes.get(reason) || 0) + 1)
    }
  }
  const topFailureModes = [...failureModes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mode, count]) => `${mode} (${count}x)`)

  // 9. Final verdict
  const coveragePercent =
    allNodes.length > 0 ? Math.round((coveredNodes.length / allNodes.length) * 100) : 0
  const bindablePercent =
    classifications.length > 0 ? Math.round((bindable.length / classifications.length) * 100) : 0

  const blockers: string[] = []
  const nextFixes: string[] = []

  // CRITICAL: Pipeline validity check FIRST - if sampling can't run, metrics are meaningless
  if (sampleVerifications.length < MIN_SAMPLES) {
    blockers.push(
      `INVALID_REVIEW_PIPELINE: Only ${sampleVerifications.length} samples (need ${MIN_SAMPLES})`
    )
    nextFixes.push("Run full extraction to generate enough assertions for quality sampling")
  }

  if (coveragePercent < 50) {
    blockers.push(`Low coverage: only ${coveragePercent}% of nodes have assertions`)
    nextFixes.push("Improve extraction prompt to capture more assertions")
  }

  if (criticalNumericMisses.length > 5) {
    blockers.push(
      `${criticalNumericMisses.length} nodes with numeric values but no THRESHOLD/RATE extracted`
    )
    nextFixes.push("Add numeric value extraction patterns for Croatian formats")
  }

  if (bindablePercent < 20) {
    blockers.push(`Only ${bindablePercent}% of assertions are bindable to evaluation context`)
    nextFixes.push(`Add binder mappings for: ${topMissingBindings.slice(0, 3).join(", ")}`)
  }

  if (overallAccuracy < 70 && sampleVerifications.length > 0) {
    blockers.push(`Quality accuracy only ${overallAccuracy}%`)
    if (topFailureModes.length > 0) {
      nextFixes.push(`Fix top failure mode: ${topFailureModes[0]}`)
    }
  }

  const readyForAutoIngest = blockers.length === 0
  const confidenceLevel = blockers.length === 0 ? "HIGH" : blockers.length <= 2 ? "MEDIUM" : "LOW"

  // Croatian assessment
  let assessmentCroatian = ""
  if (readyForAutoIngest) {
    assessmentCroatian = `Dokument je spreman za automatsku obradu. Pokrivenost: ${coveragePercent}%, točnost: ${overallAccuracy}%, izvršive tvrdnje: ${bindablePercent}%.`
  } else {
    assessmentCroatian = `Dokument NIJE spreman za automatsku obradu. Problemi: ${blockers.join("; ")}. Potrebne izmjene: ${nextFixes.join("; ")}.`
  }

  return {
    evidenceId,
    evidenceUrl: evidence.url || "",
    documentTitle,
    generatedAt: new Date().toISOString(),

    structuralCoverage: {
      totalNodes: allNodes.length,
      coveredNodes: coveredNodes.length,
      coveragePercent,
      byLevel,
      uncoveredNodes: uncoveredNodes.slice(0, 30).map((n) => ({
        nodePath: n.nodePath,
        snippet: n.textSnippet,
        expectedSignals: n.expectedSignals,
      })),
      heatmapByArticle,
    },

    signalAnalysis: {
      nodesWithHighExpectedLowExtracted,
      criticalNumericMisses: criticalNumericMisses.slice(0, 20),
    },

    usability: {
      totalAssertions: classifications.length,
      bindable: bindable.length,
      bindablePercent,
      unbound: unbound.length,
      unboundPercent:
        classifications.length > 0
          ? Math.round((unbound.length / classifications.length) * 100)
          : 0,
      referenceOnly: referenceOnly.length,
      needsResolution: needsResolution.length,
      executableRulesCount: bindable.length,
      citeableAssertionsCount: classifications.length - bindable.length,
      topMissingBindings,
      classifications,
    },

    qualitySampling: {
      sampleSize: sampleVerifications.length,
      samplingStrategy: `Deterministic verification (N>=${MIN_SAMPLES}), LLM for hard cases only (max 5)`,
      byType,
      overallAccuracy,
      topFailureModes,
      samples: sampleVerifications,
    },

    verdict: {
      readyForAutoIngest,
      confidenceLevel,
      blockers,
      nextFixes,
      assessmentCroatian,
    },
  }
}

// ============================================================================
// REPORT FORMATTING
// ============================================================================

export function formatReportMarkdown(report: CoverageReviewReport): string {
  const lines: string[] = []

  lines.push(`# Coverage Review Report`)
  lines.push(``)
  lines.push(`**Evidence ID:** ${report.evidenceId}`)
  lines.push(`**URL:** ${report.evidenceUrl}`)
  lines.push(`**Document:** ${report.documentTitle}`)
  lines.push(`**Generated:** ${report.generatedAt}`)
  lines.push(``)

  // Verdict summary at top
  lines.push(`## Verdict`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(
    `| Ready for Auto-Ingest | **${report.verdict.readyForAutoIngest ? "YES ✓" : "NO ✗"}** |`
  )
  lines.push(`| Confidence | ${report.verdict.confidenceLevel} |`)
  lines.push(`| Coverage | ${report.structuralCoverage.coveragePercent}% |`)
  lines.push(`| Bindable | ${report.usability.bindablePercent}% |`)
  lines.push(`| Quality Accuracy | ${report.qualitySampling.overallAccuracy}% |`)
  lines.push(``)

  if (report.verdict.blockers.length > 0) {
    lines.push(`### Blockers`)
    for (const b of report.verdict.blockers) {
      lines.push(`- ❌ ${b}`)
    }
    lines.push(``)
  }

  if (report.verdict.nextFixes.length > 0) {
    lines.push(`### Next Fixes (ordered)`)
    for (let i = 0; i < report.verdict.nextFixes.length; i++) {
      lines.push(`${i + 1}. ${report.verdict.nextFixes[i]}`)
    }
    lines.push(``)
  }

  lines.push(`### Assessment (Croatian)`)
  lines.push(`> ${report.verdict.assessmentCroatian}`)
  lines.push(``)

  // Section 1: Structural Coverage
  lines.push(`---`)
  lines.push(`## 1. Structural Coverage`)
  lines.push(``)
  lines.push(`| Level | Total | Covered | % |`)
  lines.push(`|-------|-------|---------|---|`)
  for (const [level, stats] of Object.entries(report.structuralCoverage.byLevel)) {
    lines.push(`| ${level} | ${stats.total} | ${stats.covered} | ${stats.percent}% |`)
  }
  lines.push(
    `| **TOTAL** | **${report.structuralCoverage.totalNodes}** | **${report.structuralCoverage.coveredNodes}** | **${report.structuralCoverage.coveragePercent}%** |`
  )
  lines.push(``)

  if (report.signalAnalysis.criticalNumericMisses.length > 0) {
    lines.push(`### Critical: Numeric Values Not Extracted`)
    lines.push(``)
    for (const miss of report.signalAnalysis.criticalNumericMisses.slice(0, 10)) {
      lines.push(`- **${miss.nodePath}**: ${miss.numericHits} numeric values detected`)
      lines.push(`  > "${miss.snippet.slice(0, 100)}..."`)
    }
    lines.push(``)
  }

  // Section 2: Usability
  lines.push(`---`)
  lines.push(`## 2. Usability Classification`)
  lines.push(``)
  lines.push(`| Classification | Count | % |`)
  lines.push(`|----------------|-------|---|`)
  lines.push(
    `| Bindable (executable) | ${report.usability.bindable} | ${report.usability.bindablePercent}% |`
  )
  lines.push(
    `| Unbound (missing mapping) | ${report.usability.unbound} | ${report.usability.unboundPercent}% |`
  )
  lines.push(`| Reference only | ${report.usability.referenceOnly} | - |`)
  lines.push(`| Needs resolution | ${report.usability.needsResolution} | - |`)
  lines.push(``)

  if (report.usability.topMissingBindings.length > 0) {
    lines.push(`### Top Missing Bindings`)
    for (const mb of report.usability.topMissingBindings) {
      lines.push(`- ${mb}`)
    }
    lines.push(``)
  }

  // Section 3: Quality Sampling
  lines.push(`---`)
  lines.push(`## 3. Quality Sampling`)
  lines.push(``)
  lines.push(`**Sample size:** ${report.qualitySampling.sampleSize}`)
  lines.push(`**Strategy:** ${report.qualitySampling.samplingStrategy}`)
  lines.push(`**Overall accuracy:** ${report.qualitySampling.overallAccuracy}%`)
  lines.push(``)

  if (Object.keys(report.qualitySampling.byType).length > 0) {
    lines.push(`### Accuracy by Type`)
    lines.push(``)
    lines.push(`| Type | Sampled | Passed | Accuracy |`)
    lines.push(`|------|---------|--------|----------|`)
    for (const [type, stats] of Object.entries(report.qualitySampling.byType)) {
      lines.push(`| ${type} | ${stats.sampled} | ${stats.passed} | ${stats.accuracy}% |`)
    }
    lines.push(``)
  }

  if (report.qualitySampling.topFailureModes.length > 0) {
    lines.push(`### Top Failure Modes`)
    for (const fm of report.qualitySampling.topFailureModes) {
      lines.push(`- ${fm}`)
    }
    lines.push(``)
  }

  return lines.join("\n")
}
