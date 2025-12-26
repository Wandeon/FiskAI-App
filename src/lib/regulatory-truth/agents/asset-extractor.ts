// src/lib/regulatory-truth/agents/asset-extractor.ts

import { db } from "@/lib/db"
import { runAgent } from "./runner"
import { RegulatoryAssetSchema, type RegulatoryAsset } from "../schemas/asset"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
import { z } from "zod"

const AssetExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
})

const AssetExtractorOutputSchema = z.object({
  assets: z.array(RegulatoryAssetSchema),
  extractionNotes: z.string().optional(),
})

type AssetExtractorInput = z.infer<typeof AssetExtractorInputSchema>
type AssetExtractorOutput = z.infer<typeof AssetExtractorOutputSchema>

export interface AssetExtractionResult {
  success: boolean
  assets: RegulatoryAsset[]
  assetIds: string[]
  error: string | null
}

/**
 * Extract regulatory assets (forms, templates, documents) from content
 */
export async function runAssetExtractor(evidenceId: string): Promise<AssetExtractionResult> {
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      assets: [],
      assetIds: [],
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  const { text: content } = await getExtractableContent(evidenceId)
  const cleanedContent = cleanContent(content, evidence.url)

  const input: AssetExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent.slice(0, 50000),
    url: evidence.url,
  }

  const result = await runAgent<AssetExtractorInput, AssetExtractorOutput>({
    agentType: "ASSET_EXTRACTOR",
    input,
    inputSchema: AssetExtractorInputSchema,
    outputSchema: AssetExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      assets: [],
      assetIds: [],
      error: result.error ?? "Asset extraction failed",
    }
  }

  const assetIds: string[] = []

  for (const asset of result.output.assets) {
    // Check for existing asset by download URL (upsert logic)
    const existing = await db.regulatoryAsset.findFirst({
      where: { downloadUrl: asset.downloadUrl },
    })

    if (existing) {
      // Update existing asset
      await db.regulatoryAsset.update({
        where: { id: existing.id },
        data: {
          officialName: asset.officialName,
          description: asset.description,
          version: asset.version,
          // Handle DateTime conversion for validFrom/validUntil
          validFrom: asset.validFrom ? new Date(asset.validFrom) : null,
          validUntil: asset.validUntil ? new Date(asset.validUntil) : null,
        },
      })
      assetIds.push(existing.id)
      console.log(`[asset-extractor] Updated existing asset: ${asset.officialName}`)
      continue
    }

    // Create new asset
    const dbAsset = await db.regulatoryAsset.create({
      data: {
        formCode: asset.formCode,
        officialName: asset.officialName,
        description: asset.description,
        downloadUrl: asset.downloadUrl,
        format: asset.format,
        fileSize: asset.fileSize,
        assetType: asset.assetType,
        stepNumber: asset.stepNumber,
        // Handle DateTime conversion for validFrom/validUntil
        validFrom: asset.validFrom ? new Date(asset.validFrom) : null,
        validUntil: asset.validUntil ? new Date(asset.validUntil) : null,
        version: asset.version,
        sourceUrl: asset.sourceUrl,
        evidenceId: evidence.id,
      },
    })

    assetIds.push(dbAsset.id)
  }

  console.log(`[asset-extractor] Extracted ${assetIds.length} assets from ${evidence.url}`)

  return {
    success: true,
    assets: result.output.assets,
    assetIds,
    error: null,
  }
}
