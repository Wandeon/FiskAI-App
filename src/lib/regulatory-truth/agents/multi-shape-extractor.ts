// src/lib/regulatory-truth/agents/multi-shape-extractor.ts
import { classifyContent } from "./content-classifier"
import { runClaimExtractor } from "./claim-extractor"
import { runProcessExtractor } from "./process-extractor"
import { runReferenceExtractor } from "./reference-extractor"
import { runAssetExtractor } from "./asset-extractor"
import { runTransitionalExtractor } from "./transitional-extractor"
import { detectComparisonContent, runComparisonExtractor } from "./comparison-extractor"
import { db } from "@/lib/db"
import type { ContentClassification } from "../schemas/content-classifier"

export interface MultiShapeExtractionResult {
  success: boolean
  classification: ContentClassification | null
  extractedShapes: {
    claims: string[]
    processes: string[]
    tables: string[]
    assets: string[]
    provisions: string[]
  }
  comparisonMatrixIds?: string[]
  errors: string[]
}

/**
 * Run multi-shape extraction on evidence
 * 1. Classify content
 * 2. Run appropriate extractors
 * 3. Return all extracted entity IDs
 */
export async function runMultiShapeExtraction(
  evidenceId: string
): Promise<MultiShapeExtractionResult> {
  const result: MultiShapeExtractionResult = {
    success: false,
    classification: null,
    extractedShapes: {
      claims: [],
      processes: [],
      tables: [],
      assets: [],
      provisions: [],
    },
    errors: [],
  }

  // Step 1: Classify content
  console.log(`[multi-shape] Classifying content for ${evidenceId}`)
  const classification = await classifyContent(evidenceId)

  if (!classification.success || !classification.classification) {
    result.errors.push(classification.error ?? "Classification failed")
    return result
  }

  result.classification = classification.classification
  console.log(
    `[multi-shape] Classified as ${classification.classification.primaryType} (${classification.classification.confidence})`
  )

  // Step 2: Get extractors to run from classification
  const extractors = classification.classification.suggestedExtractors
  console.log(`[multi-shape] Running extractors: ${extractors.join(", ")}`)

  // Step 3: Run each extractor in sequence
  for (const extractor of extractors) {
    try {
      switch (extractor) {
        case "claim-extractor": {
          const claimResult = await runClaimExtractor(evidenceId)
          if (claimResult.success) {
            result.extractedShapes.claims.push(...claimResult.claimIds)
          } else if (claimResult.error) {
            result.errors.push(`claim-extractor: ${claimResult.error}`)
          }
          break
        }

        case "process-extractor": {
          const processResult = await runProcessExtractor(evidenceId)
          if (processResult.success) {
            result.extractedShapes.processes.push(...processResult.processIds)
          } else if (processResult.error) {
            result.errors.push(`process-extractor: ${processResult.error}`)
          }
          break
        }

        case "reference-extractor": {
          const refResult = await runReferenceExtractor(evidenceId)
          if (refResult.success) {
            result.extractedShapes.tables.push(...refResult.tableIds)
          } else if (refResult.error) {
            result.errors.push(`reference-extractor: ${refResult.error}`)
          }
          break
        }

        case "asset-extractor": {
          const assetResult = await runAssetExtractor(evidenceId)
          if (assetResult.success) {
            result.extractedShapes.assets.push(...assetResult.assetIds)
          } else if (assetResult.error) {
            result.errors.push(`asset-extractor: ${assetResult.error}`)
          }
          break
        }

        case "transitional-extractor": {
          const transResult = await runTransitionalExtractor(evidenceId)
          if (transResult.success) {
            result.extractedShapes.provisions.push(...transResult.provisionIds)
          } else if (transResult.error) {
            result.errors.push(`transitional-extractor: ${transResult.error}`)
          }
          break
        }

        default:
          console.warn(`[multi-shape] Unknown extractor: ${extractor}`)
      }
    } catch (error) {
      result.errors.push(`${extractor}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Step 4: ComparisonMatrix extraction (runs independently of classification)
  try {
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: { rawContent: true },
    })

    if (evidence && detectComparisonContent(evidence.rawContent)) {
      console.log(`[multi-shape] Running comparison extractor for ${evidenceId}`)
      const comparisonResult = await runComparisonExtractor(evidenceId)
      if (comparisonResult.extracted && comparisonResult.matrixId) {
        result.comparisonMatrixIds = [comparisonResult.matrixId]
        console.log(`[multi-shape] Extracted comparison matrix: ${comparisonResult.matrixId}`)
      } else if (comparisonResult.error) {
        result.errors.push(`comparison-extractor: ${comparisonResult.error}`)
      }
    }
  } catch (error) {
    result.errors.push(
      `comparison-extractor: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // Calculate total extractions
  const totalExtracted =
    result.extractedShapes.claims.length +
    result.extractedShapes.processes.length +
    result.extractedShapes.tables.length +
    result.extractedShapes.assets.length +
    result.extractedShapes.provisions.length +
    (result.comparisonMatrixIds?.length ?? 0)

  result.success = totalExtracted > 0 || result.errors.length === 0

  console.log(
    `[multi-shape] Extraction complete: ${totalExtracted} shapes extracted, ${result.errors.length} errors`
  )

  return result
}
