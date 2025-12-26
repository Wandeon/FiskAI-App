// src/lib/regulatory-truth/retrieval/asset-engine.ts
import { db } from "@/lib/db"
import { AssetType } from "@prisma/client"

export interface AssetEngineResult {
  success: boolean
  asset: {
    id: string
    formCode: string | null
    officialName: string
    description: string | null
    downloadUrl: string
    format: string
    assetType: string
    version: string | null
    validFrom: Date | null
    validUntil: Date | null
  } | null
  relatedAssets: Array<{
    id: string
    formCode: string | null
    officialName: string
    downloadUrl: string
  }>
  reasoning: string
}

/**
 * Asset Engine - handles document and form requests
 *
 * Examples:
 * - "Where is the PDV-P form?"
 * - "Download JOPPD template"
 * - "Obrazac za prijavu PDV-a"
 */
export async function runAssetEngine(
  query: string,
  entities: { formCodes: string[] }
): Promise<AssetEngineResult> {
  const result: AssetEngineResult = {
    success: false,
    asset: null,
    relatedAssets: [],
    reasoning: "",
  }

  const queryLower = query.toLowerCase()

  // Extract form codes from query
  const formCodePatterns = [
    /pdv-[a-z0-9]+/gi,
    /joppd/gi,
    /po-sd/gi,
    /p-pdv/gi,
    /obrazac\s+([a-z0-9-]+)/gi,
  ]

  const extractedCodes: string[] = [...entities.formCodes]
  for (const pattern of formCodePatterns) {
    const matches = query.match(pattern)
    if (matches) {
      extractedCodes.push(...matches.map((m) => m.toUpperCase()))
    }
  }

  // Determine asset type from query
  let assetType: AssetType | null = null
  if (queryLower.includes("obrazac") || queryLower.includes("form")) {
    assetType = AssetType.FORM
  } else if (queryLower.includes("uputa") || queryLower.includes("instruction")) {
    assetType = AssetType.INSTRUCTION
  } else if (queryLower.includes("vodic") || queryLower.includes("guide")) {
    assetType = AssetType.GUIDE
  } else if (queryLower.includes("predlozak") || queryLower.includes("template")) {
    assetType = AssetType.TEMPLATE
  }

  // Build search query conditions
  const orConditions: Array<Record<string, unknown>> = []

  // Match by form code
  if (extractedCodes.length > 0) {
    orConditions.push({
      formCode: {
        in: extractedCodes,
        mode: "insensitive",
      },
    })
  }

  // Match by name - extract first meaningful word from query
  const queryWords = query.split(/\s+/).filter((w) => w.length > 2)
  if (queryWords.length > 0) {
    orConditions.push({
      officialName: {
        contains: queryWords[0],
        mode: "insensitive",
      },
    })
  }

  // If no conditions, we can't search meaningfully
  if (orConditions.length === 0) {
    result.reasoning = "No form codes or keywords found in query"
    return result
  }

  // Build where clause
  const whereClause: Record<string, unknown> = {
    OR: orConditions,
  }

  if (assetType) {
    whereClause.assetType = assetType
  }

  // Search for assets
  const assets = await db.regulatoryAsset.findMany({
    where: whereClause,
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    take: 10,
  })

  if (assets.length === 0) {
    result.reasoning = `No assets found for: ${extractedCodes.join(", ") || query}`
    return result
  }

  // Primary result
  const primaryAsset = assets[0]
  result.asset = {
    id: primaryAsset.id,
    formCode: primaryAsset.formCode,
    officialName: primaryAsset.officialName,
    description: primaryAsset.description,
    downloadUrl: primaryAsset.downloadUrl,
    format: primaryAsset.format,
    assetType: primaryAsset.assetType,
    version: primaryAsset.version,
    validFrom: primaryAsset.validFrom,
    validUntil: primaryAsset.validUntil,
  }

  // Related assets
  result.relatedAssets = assets.slice(1).map((a) => ({
    id: a.id,
    formCode: a.formCode,
    officialName: a.officialName,
    downloadUrl: a.downloadUrl,
  }))

  result.success = true
  result.reasoning = `Found ${assets.length} asset(s). Primary: ${primaryAsset.officialName}`

  return result
}
