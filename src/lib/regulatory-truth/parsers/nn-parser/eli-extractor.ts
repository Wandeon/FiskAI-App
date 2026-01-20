// src/lib/regulatory-truth/parsers/nn-parser/eli-extractor.ts
/**
 * ELI Metadata Extractor for Narodne Novine HTML
 *
 * Extracts European Legislation Identifier (ELI) metadata from NN HTML documents.
 * NN includes rich ELI metadata in <meta> tags following the ELI ontology.
 *
 * Example NN ELI: https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505
 *
 * @see https://eur-lex.europa.eu/eli-register/about.html
 */

import type { EliMetadata, EliRelation } from "./types"

/**
 * ELI ontology namespace prefix in NN HTML.
 */
const ELI_NS = "http://data.europa.eu/eli/ontology#"

/**
 * NN-specific vocabulary prefixes.
 */
const NN_VOCAB = {
  institutions: "https://narodne-novine.nn.hr/eli/vocabularies/nn-institutions/",
  documentType: "https://narodne-novine.nn.hr/resource/authority/document-type/",
  legalArea: "https://narodne-novine.nn.hr/eli/vocabularies/nn-legal-area/",
  contentType: "https://narodne-novine.nn.hr/eli/vocabularies/nn-content-type/",
  indexTerms: "https://narodne-novine.nn.hr/eli/vocabularies/nn-index-terms/",
}

/**
 * Eurovoc vocabulary prefix.
 */
const EUROVOC_NS = "http://eurovoc.europa.eu/"

/**
 * Relation property to type mapping.
 */
const RELATION_TYPES: Record<string, EliRelation["type"]> = {
  amends: "amends",
  changes: "changes",
  repeals: "repeals",
  consolidates: "consolidates",
  implements: "implements",
  transposes: "transposes",
  is_amended_by: "amends",
  is_changed_by: "changes",
  is_repealed_by: "repeals",
}

/**
 * Extract ELI metadata from NN HTML document.
 *
 * Parses <meta> tags with ELI ontology properties and extracts:
 * - Document identification (ELI URI, number, dates)
 * - Document type and issuing authority
 * - Relations to other documents (amends, repeals, etc.)
 * - Subject classification (Eurovoc, legal area, index terms)
 *
 * @param html Raw HTML content
 * @returns Parsed ELI metadata
 */
export function extractEliMetadata(html: string): EliMetadata {
  const metadata: EliMetadata = {
    eli: "",
    typeDocument: null,
    number: null,
    dateDocument: null,
    datePublication: null,
    passedBy: null,
    title: null,
    language: null,
    relations: [],
    eurovocTags: [],
    legalAreaTags: [],
    indexTerms: [],
  }

  // Extract the primary ELI URI from the first LegalResource meta tag
  const eliMatch = html.match(
    /<meta[^>]+about="([^"]+\/eli\/sluzbeni\/[^"]+)"[^>]+typeof="[^"]*LegalResource[^"]*"[^>]*\/?>/i
  )
  if (eliMatch) {
    metadata.eli = eliMatch[1]
  }

  // Extract all meta tags for parsing
  const metaRegex = /<meta[^>]+>/gi
  const metaTags = html.match(metaRegex) || []

  for (const tag of metaTags) {
    // Extract about, property, content, resource attributes
    const about = extractAttribute(tag, "about")
    const property = extractAttribute(tag, "property")
    const content = extractAttribute(tag, "content")
    const resource = extractAttribute(tag, "resource")
    const lang = extractAttribute(tag, "lang")

    if (!property) continue

    // Extract property name (remove namespace)
    const propName = property.replace(ELI_NS, "")

    switch (propName) {
      case "type_document":
        if (resource) {
          // Extract document type from resource URI
          metadata.typeDocument = resource.replace(NN_VOCAB.documentType, "")
        }
        break

      case "number":
        metadata.number = content || null
        break

      case "date_document":
        metadata.dateDocument = content || null
        break

      case "date_publication":
        metadata.datePublication = content || null
        break

      case "passed_by":
        if (resource) {
          metadata.passedBy = resource.replace(NN_VOCAB.institutions, "")
        }
        break

      case "title":
        if (content && (lang === "hrv" || !metadata.title)) {
          metadata.title = content
        }
        break

      case "language":
        if (resource) {
          // Extract language code from resource URI
          const langMatch = resource.match(/\/([A-Z]{3})$/)
          if (langMatch) {
            metadata.language = langMatch[1]
          }
        }
        break

      case "amends":
      case "changes":
      case "repeals":
      case "consolidates":
      case "implements":
      case "transposes":
      case "is_amended_by":
      case "is_changed_by":
      case "is_repealed_by":
        if (resource) {
          metadata.relations.push({
            type: RELATION_TYPES[propName] || "other",
            targetEli: resource,
            rawProperty: propName,
          })
        }
        break

      case "is_about":
        if (resource) {
          // Classify the tag based on vocabulary
          if (resource.startsWith(EUROVOC_NS)) {
            metadata.eurovocTags.push(resource)
          } else if (resource.includes(NN_VOCAB.legalArea)) {
            metadata.legalAreaTags.push(resource.replace(NN_VOCAB.legalArea, ""))
          } else if (resource.includes(NN_VOCAB.indexTerms)) {
            metadata.indexTerms.push(resource.replace(NN_VOCAB.indexTerms, ""))
          }
        }
        break
    }
  }

  // If no ELI found, try to construct from URL patterns in the HTML
  if (!metadata.eli) {
    const urlMatch = html.match(/narodne-novine\.nn\.hr\/eli\/sluzbeni\/(\d{4})\/(\d+)\/(\d+)/)
    if (urlMatch) {
      metadata.eli = `https://narodne-novine.nn.hr/eli/sluzbeni/${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}`
    }
  }

  return metadata
}

/**
 * Extract an attribute value from an HTML tag string.
 */
function extractAttribute(tag: string, name: string): string | null {
  // Match attribute with double quotes
  const doubleQuoteMatch = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))
  if (doubleQuoteMatch) return doubleQuoteMatch[1]

  // Match attribute with single quotes
  const singleQuoteMatch = tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"))
  if (singleQuoteMatch) return singleQuoteMatch[1]

  return null
}

/**
 * Extract document type in human-readable form.
 */
export function getDocumentTypeName(typeDocument: string | null): string {
  if (!typeDocument) return "Unknown"

  const types: Record<string, string> = {
    ZAKON: "Zakon",
    PRAVILNIK: "Pravilnik",
    UREDBA: "Uredba",
    ODLUKA: "Odluka",
    NAREDBA: "Naredba",
    UPUTA: "Uputa",
    PRAVILAC: "Pravilac",
    STATUT: "Statut",
    PROGRAM: "Program",
    PLAN: "Plan",
    NAPUTAK: "Naputak",
    PRESUDA: "Presuda",
    RJESENJE: "Rješenje",
    UGOVOR: "Ugovor",
  }

  return types[typeDocument] || typeDocument
}

/**
 * Parse ELI URI into components.
 */
export function parseEliUri(eli: string): {
  section: string // sluzbeni, medjunarodni, etc.
  year: number
  issue: number
  article: number
} | null {
  const match = eli.match(/eli\/(\w+)\/(\d{4})\/(\d+)\/(\d+)/)
  if (!match) return null

  return {
    section: match[1],
    year: parseInt(match[2], 10),
    issue: parseInt(match[3], 10),
    article: parseInt(match[4], 10),
  }
}

/**
 * Build canonical NN URL from ELI.
 */
export function eliToNNUrl(eli: string): string | null {
  const parts = parseEliUri(eli)
  if (!parts) return null

  // NN URL format: /clanci/sluzbeni/YYYY_MM_ISSUE_ARTICLE.html
  // Note: Month is embedded in the URL but we don't have it from ELI
  // For now, return the ELI-based URL which NN supports
  return eli
    .replace("https://narodne-novine.nn.hr/eli/", "https://narodne-novine.nn.hr/clanci/")
    .replace(/\/(\d+)\/(\d+)$/, "/$1_$2.html")
}

/**
 * Validate ELI metadata completeness.
 */
export function validateEliMetadata(metadata: EliMetadata): {
  valid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!metadata.eli) missing.push("eli")
  if (!metadata.datePublication) missing.push("datePublication")

  // Recommended fields
  if (!metadata.typeDocument) warnings.push("typeDocument not specified")
  if (!metadata.title) warnings.push("title not specified")
  if (!metadata.dateDocument) warnings.push("dateDocument not specified")
  if (metadata.relations.length === 0) {
    // Not a warning for standalone documents
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}
