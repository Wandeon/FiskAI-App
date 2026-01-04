// src/lib/regulatory-truth/agents/comparison-extractor.ts
import { db, dbReg } from "@/lib/db"
import { runAgent } from "./runner"
import {
  ComparisonMatrixExtractionSchema,
  type ComparisonMatrixExtraction,
} from "../schemas/comparison-matrix"
import { z } from "zod"

/**
 * Patterns that indicate comparison content
 */
const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\busporedba\b/i,
  /\bkomparacija\b/i,
  /\bprednosti\s+i\s+nedostaci\b/i,
  /\bpros\s+and\s+cons\b/i,
  /\bcomparison\b/i,
  /\bnasuprot\b/i,
  /\bje\s+bolje\b/i,
  /što\s+odabrati/i, // No \b for Croatian characters
  /razlike\s+između/i, // No \b for Croatian characters
]

/**
 * Detect if content contains comparison patterns
 */
export function detectComparisonContent(content: string): boolean {
  if (!content || content.trim() === "") {
    return false
  }
  return COMPARISON_PATTERNS.some((pattern) => pattern.test(content))
}

const ExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
})

type ExtractorInput = z.infer<typeof ExtractorInputSchema>

export interface ExtractionResult {
  success: boolean
  matrix?: ComparisonMatrixExtraction
  error?: string
}

/**
 * Extract ComparisonMatrix from evidence content
 */
export async function extractComparisonMatrix(
  evidenceId: string,
  content: string
): Promise<ExtractionResult> {
  const input: ExtractorInput = { evidenceId, content }

  const result = await runAgent<ExtractorInput, ComparisonMatrixExtraction>({
    agentType: "COMPARISON_EXTRACTOR",
    input,
    inputSchema: ExtractorInputSchema,
    outputSchema: ComparisonMatrixExtractionSchema,
    temperature: 0.1,
    evidenceId,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      error: result.error || "Extraction failed",
    }
  }

  // Link options and criteria to ConceptNode taxonomy
  const matrix = result.output
  for (const option of matrix.options) {
    const concept = await db.conceptNode.findFirst({
      where: {
        OR: [{ slug: option.slug }, { synonyms: { has: option.nameHr.toLowerCase() } }],
      },
    })
    if (concept) {
      option.conceptId = concept.id
    }
  }

  for (const criterion of matrix.criteria) {
    const concept = await db.conceptNode.findFirst({
      where: {
        OR: [{ slug: criterion.slug }, { synonyms: { has: criterion.nameHr.toLowerCase() } }],
      },
    })
    if (concept) {
      criterion.conceptId = concept.id
    }
  }

  return {
    success: true,
    matrix,
  }
}

/**
 * Save extracted ComparisonMatrix to database
 */
export async function saveComparisonMatrix(
  matrix: ComparisonMatrixExtraction,
  evidenceId: string
): Promise<string> {
  const saved = await db.comparisonMatrix.upsert({
    where: { slug: matrix.slug },
    create: {
      slug: matrix.slug,
      titleHr: matrix.titleHr,
      titleEn: matrix.titleEn,
      appliesWhen: matrix.appliesWhen,
      domainTags: matrix.domainTags,
      options: matrix.options,
      criteria: matrix.criteria,
      cells: matrix.cells,
      conclusion: matrix.conclusion,
      evidenceId,
    },
    update: {
      titleHr: matrix.titleHr,
      titleEn: matrix.titleEn,
      appliesWhen: matrix.appliesWhen,
      domainTags: matrix.domainTags,
      options: matrix.options,
      criteria: matrix.criteria,
      cells: matrix.cells,
      conclusion: matrix.conclusion,
    },
  })

  return saved.id
}

export interface ComparisonExtractionResult {
  extracted: boolean
  matrixId?: string
  error?: string
}

/**
 * Run full extraction pipeline for comparison content
 */
export async function runComparisonExtractor(
  evidenceId: string
): Promise<ComparisonExtractionResult> {
  // Get evidence content
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: { rawContent: true },
  })

  if (!evidence) {
    return { extracted: false, error: "Evidence not found" }
  }

  // Check for comparison patterns
  if (!detectComparisonContent(evidence.rawContent)) {
    return { extracted: false, error: "No comparison content detected" }
  }

  // Extract matrix
  const result = await extractComparisonMatrix(evidenceId, evidence.rawContent)

  if (!result.success || !result.matrix) {
    return { extracted: false, error: result.error }
  }

  // Save to database
  const matrixId = await saveComparisonMatrix(result.matrix, evidenceId)

  console.log(`[comparison-extractor] Saved matrix ${result.matrix.slug} with ID ${matrixId}`)

  return { extracted: true, matrixId }
}
