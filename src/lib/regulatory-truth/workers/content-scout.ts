// src/lib/regulatory-truth/workers/content-scout.ts
//
// Content Scout: Pre-LLM quality assessment
// Runs BEFORE extractor/composer to determine if content is worth processing.
// Uses deterministic checks first, optional local Ollama only if uncertain.
//

import crypto from "crypto"

// Document types for routing decisions
export type DocumentType =
  | "LEGISLATION" // Laws, acts, amendments
  | "REGULATION" // Official regulations
  | "GUIDELINE" // Tax guides, instructions
  | "ANNOUNCEMENT" // Public announcements
  | "FORM" // Tax forms, templates
  | "FAQ" // Q&A content
  | "NEWS" // News articles
  | "BOILERPLATE" // Navigation, footer, header content
  | "UNKNOWN"

// Scout output for routing decisions
export interface ScoutResult {
  worthItScore: number // 0-1, probability content has extractable value
  docType: DocumentType
  needsOCR: boolean
  duplicateOf?: string // Hash of duplicate content if found
  skipReason?: string // Human-readable reason if score < threshold
  contentLength: number
  language: string // Detected language code
  boilerplateRatio: number // 0-1, proportion of boilerplate content
  hasStructuredData: boolean // Contains tables, lists, dates
  estimatedTokens: number
  determinismConfidence: number // How confident we are without LLM
}

// Scouting configuration
export interface ScoutConfig {
  minContentLength: number
  maxContentLength: number
  boilerplateThreshold: number // Max ratio before skip
  worthItThreshold: number // Min score to proceed
  localLlmThreshold: number // Score uncertainty range to use local LLM
  supportedLanguages: string[]
}

const DEFAULT_SCOUT_CONFIG: ScoutConfig = {
  minContentLength: 100,
  maxContentLength: 500000, // 500KB text
  boilerplateThreshold: 0.7, // Skip if >70% boilerplate
  worthItThreshold: 0.4, // Proceed if score >= 0.4
  localLlmThreshold: 0.3, // Use local LLM if score between 0.3-0.7
  supportedLanguages: ["hr", "en", "de"], // Croatian, English, German
}

// Common boilerplate patterns for Croatian regulatory sites
const BOILERPLATE_PATTERNS = [
  // Navigation
  /(?:glavna stranica|naslovnica|navigacija|izbornik)/gi,
  /(?:početna|kontakt|o nama|impressum|privatnost)/gi,
  // Footer content
  /(?:sva prava pridržana|copyright|©)/gi,
  /(?:uvjeti korištenja|politika privatnosti)/gi,
  // Cookie/GDPR banners
  /(?:kolačić|cookie|pristanak|suglasnost)/gi,
  // Social media
  /(?:facebook|twitter|linkedin|instagram|podijeli)/gi,
  // Generic UI
  /(?:učitavanje|loading|pretraži|search|prijava|login)/gi,
  /(?:prethodno|sljedeće|previous|next|stranica \d+)/gi,
]

// Regulatory signal patterns (increase score)
const REGULATORY_PATTERNS = [
  // Legal references
  /(?:narodne novine|nn|broj \d+\/\d+)/gi,
  /(?:članak|stavak|točka|alineja)/gi,
  /(?:zakon|uredba|pravilnik|odluka|naredba)/gi,
  // Tax-specific
  /(?:porez|pdv|doprinos|doprinosi|pristojba)/gi,
  /(?:porezna uprava|carinska uprava)/gi,
  /(?:oib|osobni identifikacijski broj)/gi,
  // Financial
  /(?:kuna|kn|euro|eur|hrk|iznos|svota)/gi,
  /(?:stopa|postotak|%|posto)/gi,
  /(?:rok|datum|do \d+\.\d+\.\d+)/gi,
  // Document structure
  /(?:obrazac|prilog|tablica|tabela)/gi,
]

// PDF content class detection patterns
const PDF_SCANNED_INDICATORS = [
  /[^\x20-\x7E\u00A0-\u017F]{10,}/g, // Long sequences of non-printable chars
]

/**
 * Hash content for duplicate detection
 */
export function hashContent(content: string): string {
  const normalized = content.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 10000) // Hash first 10K chars
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16)
}

/**
 * Detect language from content (simple heuristic)
 */
export function detectLanguage(content: string): string {
  const sample = content.slice(0, 2000).toLowerCase()

  // Croatian indicators
  const croatianPatterns = /\b(i|u|na|za|od|se|je|su|će|bi|da|ako|ili|te|pa)\b/g
  const croatianChars = /[čćžšđ]/gi
  const croatianScore =
    (sample.match(croatianPatterns)?.length || 0) * 2 +
    (sample.match(croatianChars)?.length || 0) * 5

  // English indicators
  const englishPatterns = /\b(the|and|of|to|in|is|for|that|with|are|be|this)\b/g
  const englishScore = (sample.match(englishPatterns)?.length || 0) * 2

  // German indicators
  const germanPatterns = /\b(der|die|das|und|ist|von|mit|für|bei|auf|den|dem)\b/g
  const germanChars = /[äöüß]/gi
  const germanScore =
    (sample.match(germanPatterns)?.length || 0) * 2 + (sample.match(germanChars)?.length || 0) * 3

  if (croatianScore > englishScore && croatianScore > germanScore) {
    return "hr"
  } else if (germanScore > englishScore) {
    return "de"
  } else {
    return "en"
  }
}

/**
 * Calculate boilerplate ratio
 */
export function calculateBoilerplateRatio(content: string): number {
  const trimmed = content.trim()
  if (trimmed.length === 0) return 1
  const words = trimmed.split(/\s+/).length

  let boilerplateMatches = 0
  for (const pattern of BOILERPLATE_PATTERNS) {
    const matches = content.match(pattern)
    boilerplateMatches += matches?.length || 0
  }

  // Normalize by content length
  return Math.min(1, boilerplateMatches / Math.max(1, words / 20))
}

/**
 * Calculate regulatory signal strength
 */
export function calculateRegulatorySignal(content: string): number {
  const words = content.split(/\s+/).length
  if (words === 0) return 0

  let regulatoryMatches = 0
  for (const pattern of REGULATORY_PATTERNS) {
    const matches = content.match(pattern)
    regulatoryMatches += matches?.length || 0
  }

  // Normalize by content length (more matches in longer content is less signal)
  const density = regulatoryMatches / Math.max(1, words / 50)
  return Math.min(1, density)
}

/**
 * Detect if content has structured data
 */
export function hasStructuredData(content: string): boolean {
  // Table patterns
  const hasTable = /<table/i.test(content) || /\|.*\|.*\|/m.test(content)

  // List patterns
  const hasList =
    /<[ou]l/i.test(content) || /^[\s]*[-•*]\s/m.test(content) || /^\s*\d+\.\s/m.test(content)

  // Date patterns (Croatian format)
  const hasDate = /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(content)

  // Amount patterns
  const hasAmount = /\d+[.,]\d{2}\s*(kn|kuna|€|eur|hrk)/i.test(content)

  return hasTable || hasList || (hasDate && hasAmount)
}

/**
 * Determine document type from content
 */
export function classifyDocumentType(content: string): DocumentType {
  const sample = content.slice(0, 5000).toLowerCase()

  // Check for specific document types
  if (/(?:zakon o|zakona o|zakonom)/i.test(sample)) {
    return "LEGISLATION"
  }
  if (/(?:pravilnik|uredba|naredba|odluka)/i.test(sample)) {
    return "REGULATION"
  }
  if (/(?:uputa|vodič|smjernic|priručnik)/i.test(sample)) {
    return "GUIDELINE"
  }
  if (/(?:obrazac|prilog \d|form)/i.test(sample)) {
    return "FORM"
  }
  if (/(?:pitanja i odgovori|faq|česta pitanja)/i.test(sample)) {
    return "FAQ"
  }
  if (/(?:priopćenje|vijest|objava|novost)/i.test(sample)) {
    return "NEWS"
  }
  if (/(?:obavijest|najava|poziv)/i.test(sample)) {
    return "ANNOUNCEMENT"
  }

  // Check boilerplate indicators
  const boilerplateRatio = calculateBoilerplateRatio(sample)
  if (boilerplateRatio > 0.5) {
    return "BOILERPLATE"
  }

  return "UNKNOWN"
}

/**
 * Check if PDF content needs OCR
 * Only returns true for PDFs with very short content (OCR likely failed)
 * or content with many non-printable characters (garbled text)
 */
export function needsOCR(content: string, contentType: string): boolean {
  if (contentType !== "pdf") {
    return false
  }

  // Very short PDF content suggests OCR failed (threshold: 50 chars)
  // Normal PDFs with text layers should have more extractable text
  if (content.length < 50) {
    return true
  }

  // Check for OCR failure indicators (long non-printable sequences)
  for (const pattern of PDF_SCANNED_INDICATORS) {
    if (pattern.test(content)) {
      return true
    }
  }

  // Check for text layer quality
  const printableRatio =
    content.replace(/[^\x20-\x7E\u00A0-\u017F]/g, "").length / Math.max(1, content.length)

  return printableRatio < 0.8
}

/**
 * Main scout function: Deterministic content quality assessment
 */
export function scoutContent(
  content: string,
  contentType: string = "html",
  existingHashes?: Set<string>,
  config: ScoutConfig = DEFAULT_SCOUT_CONFIG
): ScoutResult {
  const contentLength = content.length
  const estimatedTokens = Math.ceil(contentLength / 4)

  // Base result structure
  const result: ScoutResult = {
    worthItScore: 0,
    docType: "UNKNOWN",
    needsOCR: false,
    contentLength,
    language: "hr",
    boilerplateRatio: 0,
    hasStructuredData: false,
    estimatedTokens,
    determinismConfidence: 0,
  }

  // Check minimum length
  if (contentLength < config.minContentLength) {
    result.skipReason = `Content too short: ${contentLength} < ${config.minContentLength}`
    result.determinismConfidence = 1
    return result
  }

  // Check maximum length
  if (contentLength > config.maxContentLength) {
    result.skipReason = `Content too long: ${contentLength} > ${config.maxContentLength}`
    result.determinismConfidence = 1
    return result
  }

  // Detect language
  result.language = detectLanguage(content)
  if (!config.supportedLanguages.includes(result.language)) {
    result.skipReason = `Unsupported language: ${result.language}`
    result.determinismConfidence = 0.9
    return result
  }

  // Check for duplicates
  const contentHash = hashContent(content)
  if (existingHashes?.has(contentHash)) {
    result.duplicateOf = contentHash
    result.skipReason = `Duplicate content: hash ${contentHash}`
    result.determinismConfidence = 1
    return result
  }

  // Calculate boilerplate ratio
  result.boilerplateRatio = calculateBoilerplateRatio(content)
  if (result.boilerplateRatio > config.boilerplateThreshold) {
    result.skipReason = `High boilerplate ratio: ${(result.boilerplateRatio * 100).toFixed(1)}%`
    result.docType = "BOILERPLATE"
    result.determinismConfidence = 0.85
    return result
  }

  // Check for structured data
  result.hasStructuredData = hasStructuredData(content)

  // Classify document type
  result.docType = classifyDocumentType(content)

  // Check if OCR is needed
  result.needsOCR = needsOCR(content, contentType)

  // Calculate regulatory signal strength
  const regulatorySignal = calculateRegulatorySignal(content)

  // Calculate worth-it score
  let score = 0.3 // Base score

  // Document type scoring
  const docTypeScores: Record<DocumentType, number> = {
    LEGISLATION: 0.4,
    REGULATION: 0.35,
    GUIDELINE: 0.25,
    FORM: 0.15,
    FAQ: 0.2,
    NEWS: 0.1,
    ANNOUNCEMENT: 0.15,
    BOILERPLATE: -0.3,
    UNKNOWN: 0,
  }
  score += docTypeScores[result.docType]

  // Add regulatory signal
  score += regulatorySignal * 0.3

  // Bonus for structured data
  if (result.hasStructuredData) {
    score += 0.1
  }

  // Penalty for high boilerplate
  score -= result.boilerplateRatio * 0.2

  // Normalize score to 0-1
  result.worthItScore = Math.max(0, Math.min(1, score))

  // Determine confidence in this score
  // High confidence if clear signals (regulatory patterns, known doc types)
  if (result.docType !== "UNKNOWN" && regulatorySignal > 0.3) {
    result.determinismConfidence = 0.9
  } else if (result.docType !== "UNKNOWN" || regulatorySignal > 0.1) {
    result.determinismConfidence = 0.7
  } else {
    result.determinismConfidence = 0.5
  }

  // Set skip reason if score too low
  if (result.worthItScore < config.worthItThreshold) {
    result.skipReason = `Low worth-it score: ${(result.worthItScore * 100).toFixed(1)}%`
  }

  return result
}

/**
 * Check if local LLM should be used to refine scout result
 */
export function shouldUseLocalLlm(
  result: ScoutResult,
  config: ScoutConfig = DEFAULT_SCOUT_CONFIG
): boolean {
  // Don't use LLM if we're very confident in the result
  if (result.determinismConfidence >= 0.85) {
    return false
  }

  // Don't use LLM if already skipping with high confidence
  if (result.skipReason && result.determinismConfidence >= 0.7) {
    return false
  }

  // Use local LLM if score is in uncertain range
  const uncertainRange =
    result.worthItScore >= config.worthItThreshold - config.localLlmThreshold &&
    result.worthItScore <= config.worthItThreshold + config.localLlmThreshold

  return uncertainRange && result.determinismConfidence < 0.8
}

// Export config for testing
export { DEFAULT_SCOUT_CONFIG }
