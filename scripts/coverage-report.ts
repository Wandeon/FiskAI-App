#!/usr/bin/env npx tsx
/**
 * Coverage Report for NN Document
 *
 * Analyzes a Narodne Novine document to show:
 * 1. What sections/articles exist
 * 2. What was extracted
 * 3. What assertion types were found vs expected
 * 4. Gaps in extraction
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { JSDOM } from "jsdom"

interface ArticleSection {
  number: string
  title: string
  content: string
  startOffset: number
  endOffset: number
}

interface ExtractionResult {
  conceptSlug: string
  extractedValue: string
  valueType: string
  confidence: number
  groundingQuote: string
  articleRef: string
}

interface CoverageReport {
  documentId: string
  documentUrl: string
  documentTitle: string
  totalArticles: number
  articles: ArticleSection[]
  existingExtractions: ExtractionResult[]
  extractionsByArticle: Map<string, ExtractionResult[]>
  assertionTypesCounts: Record<string, number>
  articlesWithNoExtractions: string[]
  coveragePercentage: number
}

function stripHtml(html: string): string {
  const dom = new JSDOM(html)
  return dom.window.document.body?.textContent || ""
}

function parseArticles(text: string): ArticleSection[] {
  const articles: ArticleSection[] = []

  // Croatian law article pattern: "Članak X." or "Članak X"
  const articleRegex = /(?:^|\n)\s*(Članak\s+(\d+)\.?)\s*\n/gi

  let match: RegExpExecArray | null
  const matches: Array<{ index: number; fullMatch: string; number: string }> = []

  while ((match = articleRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      fullMatch: match[1],
      number: match[2],
    })
  }

  // Extract content between articles
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i < matches.length - 1 ? matches[i + 1].index : text.length
    const content = text.slice(start, end).trim()

    // Try to extract title (first line after "Članak X")
    const lines = content.split("\n").filter((l) => l.trim())
    const title = lines.length > 1 ? lines[1].trim().slice(0, 100) : ""

    articles.push({
      number: matches[i].number,
      title,
      content,
      startOffset: start,
      endOffset: end,
    })
  }

  return articles
}

async function main() {
  const { db } = await import("../src/lib/db")
  const { dbReg } = await import("../src/lib/db")

  // Evidence ID for the tax exchange regulation
  const evidenceId = process.argv[2] || "cmkivgiit001801rtfn33iza3"

  // 1. Get the document
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      url: true,
      rawContent: true,
      source: { select: { name: true } },
    },
  })

  if (!evidence) {
    console.error("Evidence not found:", evidenceId)
    process.exit(1)
  }

  console.log("=".repeat(80))
  console.log("COVERAGE REPORT")
  console.log("=".repeat(80))
  console.log()
  console.log("Document ID:", evidence.id)
  console.log("URL:", evidence.url)
  console.log("Source:", evidence.source?.name)
  console.log("Raw content size:", evidence.rawContent?.length, "chars")
  console.log()

  // 2. Parse the HTML to get clean text
  const rawContent = evidence.rawContent || ""
  const cleanText = stripHtml(rawContent)

  console.log("Clean text size:", cleanText.length, "chars")
  console.log()

  // Extract document title from HTML
  const titleMatch = rawContent.match(/<title>\s*(.*?)\s*<\/title>/i)
  const documentTitle = titleMatch ? titleMatch[1] : "Unknown"
  console.log("Document Title:", documentTitle)
  console.log()

  // 3. Parse articles
  const articles = parseArticles(cleanText)
  console.log("=".repeat(80))
  console.log("DOCUMENT STRUCTURE")
  console.log("=".repeat(80))
  console.log()
  console.log(`Total Articles (Članak): ${articles.length}`)
  console.log()

  // Show first 10 articles as sample
  console.log("Sample articles (first 10):")
  for (const art of articles.slice(0, 10)) {
    const preview = art.content.slice(0, 150).replace(/\n/g, " ")
    console.log(`  Članak ${art.number}: ${preview}...`)
  }
  if (articles.length > 10) {
    console.log(`  ... and ${articles.length - 10} more`)
  }
  console.log()

  // 4. Check for existing AgentRuns for this evidence
  const agentRuns = await db.agentRun.findMany({
    where: { evidenceId: evidenceId },
    select: {
      id: true,
      agentType: true,
      status: true,
      output: true,
      rawOutput: true,
      error: true,
      outcome: true,
      startedAt: true,
      itemsProduced: true,
      tokensUsed: true,
      durationMs: true,
      inputChars: true,
    },
    orderBy: { startedAt: "desc" },
  })

  console.log("=".repeat(80))
  console.log("EXTRACTION STATUS")
  console.log("=".repeat(80))
  console.log()
  console.log(`AgentRuns for this evidence: ${agentRuns.length}`)

  for (const run of agentRuns) {
    console.log(
      `  - ${run.agentType} (${run.status}): ${run.itemsProduced} items, ${run.startedAt.toISOString()}`
    )
    console.log(`    Outcome: ${run.outcome || "N/A"}`)
    console.log(`    Tokens: ${run.tokensUsed || 0}, Duration: ${run.durationMs || 0}ms`)
    if (run.error) {
      console.log(`    Error: ${run.error.slice(0, 100)}...`)
    }
  }
  console.log()

  // Parse partial extractions from rawOutput if available
  const partialExtractions: Array<{
    id: string
    domain: string
    value_type: string
    extracted_value: string
    exact_quote: string
  }> = []

  for (const run of agentRuns) {
    if (run.rawOutput && typeof run.rawOutput === "object") {
      const rawOut = run.rawOutput as { rawContent?: string; jsonContent?: string }
      const content = rawOut.rawContent || rawOut.jsonContent || ""

      // Try to extract partial JSON extractions
      const extractionsMatch = content.match(/"extractions":\s*\[([\s\S]*)/i)
      if (extractionsMatch) {
        // Try to parse individual extraction objects
        const extractionPattern =
          /\{\s*"id":\s*"([^"]+)"[^}]*"domain":\s*"([^"]+)"[^}]*"value_type":\s*"([^"]+)"[^}]*"extracted_value":\s*"([^"]+)"[^}]*"exact_quote":\s*"([^"]+)"/g
        let match
        while ((match = extractionPattern.exec(content)) !== null) {
          partialExtractions.push({
            id: match[1],
            domain: match[2],
            value_type: match[3],
            extracted_value: match[4],
            exact_quote: match[5].slice(0, 80) + "...",
          })
        }
      }
    }
  }

  if (partialExtractions.length > 0) {
    console.log("=".repeat(80))
    console.log("PARTIAL EXTRACTIONS (from truncated responses)")
    console.log("=".repeat(80))
    console.log()
    console.log(`Found ${partialExtractions.length} extractions before truncation:`)
    for (const ext of partialExtractions) {
      console.log(`  ${ext.id}: [${ext.domain}] ${ext.value_type}`)
      console.log(`    Value: ${ext.extracted_value}`)
      console.log(`    Quote: "${ext.exact_quote}"`)
    }
    console.log()
  }

  // 5. Check CandidateFacts - search by groundingQuotes that reference this URL
  // Since there's no direct link, we search by URL in quotes
  const urlPattern = evidence.url || ""
  const candidateFacts = await db.candidateFact.findMany({
    where: {
      OR: [
        // Check if any quote contains our URL
        { legalReferenceRaw: { contains: urlPattern.slice(-20) } },
        // Or created around the same time as the agentRuns
        ...(agentRuns.length > 0
          ? [
              {
                createdAt: {
                  gte: new Date(agentRuns[agentRuns.length - 1].startedAt.getTime() - 60000),
                  lte: new Date(agentRuns[0].startedAt.getTime() + 60000),
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      suggestedConceptSlug: true,
      extractedValue: true,
      suggestedValueType: true,
      overallConfidence: true,
      groundingQuotes: true,
      legalReferenceRaw: true,
      status: true,
    },
    take: 100,
  })

  console.log(`CandidateFacts potentially linked: ${candidateFacts.length}`)

  // Group by value type
  const byType: Record<string, number> = {}
  for (const cf of candidateFacts) {
    const t = cf.suggestedValueType || "unknown"
    byType[t] = (byType[t] || 0) + 1
  }

  if (Object.keys(byType).length > 0) {
    console.log("\nBy value type:")
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`)
    }
  }
  console.log()

  // 6. Show what SHOULD be extracted (assertion types expected for this document type)
  console.log("=".repeat(80))
  console.log("EXPECTED ASSERTION TYPES (for tax exchange regulation)")
  console.log("=".repeat(80))
  console.log()
  console.log("This document type typically contains:")
  console.log("  - OBLIGATION: Reporting requirements")
  console.log("  - DEFINITION: What constitutes reportable information")
  console.log("  - THRESHOLD: Reporting thresholds (amounts, counts)")
  console.log("  - DEADLINE: Submission deadlines")
  console.log("  - RATE: Tax rates or penalties")
  console.log("  - ENTITY: Institutions responsible")
  console.log()

  // 7. Sample content analysis - look for key patterns
  console.log("=".repeat(80))
  console.log("CONTENT ANALYSIS (sampling for patterns)")
  console.log("=".repeat(80))
  console.log()

  // Look for numeric values (potential thresholds/rates)
  const numericPatterns =
    cleanText.match(/\d+[\.,]?\d*\s*(%|EUR|HRK|kuna|eura|dana|godina)/gi) || []
  console.log(`Numeric values with units found: ${numericPatterns.length}`)
  const sampleNumerics = [...new Set(numericPatterns)].slice(0, 10)
  for (const n of sampleNumerics) {
    console.log(`  "${n}"`)
  }
  console.log()

  // Look for obligation keywords
  const obligationKeywords = [
    "mora",
    "moraju",
    "dužan",
    "dužni",
    "obveza",
    "obveznik",
    "potrebno je",
    "treba",
  ]
  let obligationCount = 0
  for (const kw of obligationKeywords) {
    const regex = new RegExp(kw, "gi")
    const matches = cleanText.match(regex) || []
    obligationCount += matches.length
  }
  console.log(`Obligation keywords found: ${obligationCount}`)

  // Look for deadline keywords
  const deadlineKeywords = ["rok", "rokovi", "do dana", "u roku", "najkasnije", "prije"]
  let deadlineCount = 0
  for (const kw of deadlineKeywords) {
    const regex = new RegExp(kw, "gi")
    const matches = cleanText.match(regex) || []
    deadlineCount += matches.length
  }
  console.log(`Deadline keywords found: ${deadlineCount}`)

  // Look for definition patterns
  const definitionKeywords = ["podrazumijeva", "smatra se", "znači", "definira", "jest"]
  let definitionCount = 0
  for (const kw of definitionKeywords) {
    const regex = new RegExp(kw, "gi")
    const matches = cleanText.match(regex) || []
    definitionCount += matches.length
  }
  console.log(`Definition keywords found: ${definitionCount}`)

  console.log()

  // 8. Coverage Gap Analysis
  console.log("=".repeat(80))
  console.log("COVERAGE GAP ANALYSIS")
  console.log("=".repeat(80))
  console.log()

  const hasExtractions = candidateFacts.length > 0
  const extractionRuns = agentRuns.filter((r) => r.agentType === "EXTRACTOR")

  if (!hasExtractions && extractionRuns.length === 0) {
    console.log("STATUS: NO EXTRACTION ATTEMPTED")
    console.log()
    console.log("This document has NOT been processed by the extractor yet.")
    console.log(`Potential extractions (based on content analysis):`)
    console.log(`  - ~${Math.floor(obligationCount / 3)} obligation assertions`)
    console.log(`  - ~${Math.floor(deadlineCount / 2)} deadline assertions`)
    console.log(`  - ~${Math.floor(definitionCount / 2)} definition assertions`)
    console.log(`  - ~${numericPatterns.length} numeric value assertions`)
    console.log()
  } else if (hasExtractions) {
    const coverage = (candidateFacts.length / articles.length) * 100
    console.log(`STATUS: PARTIALLY EXTRACTED`)
    console.log(
      `Coverage: ${coverage.toFixed(1)}% (${candidateFacts.length} extractions / ${articles.length} articles)`
    )
    console.log()

    // Show sample extractions
    console.log("Sample extractions:")
    for (const cf of candidateFacts.slice(0, 5)) {
      console.log(
        `  - ${cf.suggestedConceptSlug}: "${cf.extractedValue?.slice(0, 50)}" (${cf.suggestedValueType}, conf: ${cf.overallConfidence})`
      )
    }
  } else {
    console.log("STATUS: EXTRACTION RUN BUT NO RESULTS")
    console.log("Extractor ran but produced no CandidateFacts.")
    for (const run of extractionRuns) {
      console.log(`  Run ${run.id}: ${run.status}, items: ${run.itemsProduced}`)
    }
  }

  console.log()
  console.log("=".repeat(80))
  console.log("RECOMMENDATION")
  console.log("=".repeat(80))
  console.log()

  if (!hasExtractions) {
    console.log("Run extraction on this document:")
    console.log(`  npx tsx scripts/run-extractor-coverage.ts ${evidenceId}`)
    console.log()
    console.log("Expected output should include structured LegalAssertions for:")
    console.log("  - OBLIGATION assertions (reporting duties)")
    console.log("  - DEFINITION assertions (legal terms)")
    console.log("  - THRESHOLD assertions (numeric limits)")
    console.log("  - DEADLINE assertions (temporal requirements)")
  }

  await db.$disconnect()
  await dbReg.$disconnect()
}

main().catch(console.error)
