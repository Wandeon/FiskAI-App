// src/lib/regulatory-truth/quality/coverage-report.ts
import { db } from "@/lib/db"
import type { ClassificationContentType } from "../schemas/content-classifier"

export interface CoverageMetrics {
  evidenceId: string
  claimsCount: number
  processesCount: number
  referenceTablesCount: number
  assetsCount: number
  provisionsCount: number
  sourcePointersCount: number
  primaryContentType: string | null
  classificationConfidence: number
  coverageScore: number
  isComplete: boolean
  missingShapes: string[]
  warnings: string[]
}

/**
 * Calculate expected shapes based on content type
 */
function getExpectedShapes(contentType: ClassificationContentType | null): string[] {
  switch (contentType) {
    case "LOGIC":
      return ["claims"]
    case "PROCESS":
      return ["processes"]
    case "REFERENCE":
      return ["referenceTables"]
    case "DOCUMENT":
      return ["assets"]
    case "TRANSITIONAL":
      return ["provisions"]
    case "MIXED":
      return ["claims", "processes", "referenceTables", "assets"]
    default:
      return ["claims"] // Default expectation
  }
}

/**
 * Calculate coverage score based on expected vs actual extractions
 */
function calculateCoverageScore(
  metrics: Omit<CoverageMetrics, "coverageScore" | "isComplete" | "warnings">,
  expectedShapes: string[]
): number {
  if (expectedShapes.length === 0) return 1.0

  let extractedCount = 0

  for (const shape of expectedShapes) {
    switch (shape) {
      case "claims":
        if (metrics.claimsCount > 0) extractedCount++
        break
      case "processes":
        if (metrics.processesCount > 0) extractedCount++
        break
      case "referenceTables":
        if (metrics.referenceTablesCount > 0) extractedCount++
        break
      case "assets":
        if (metrics.assetsCount > 0) extractedCount++
        break
      case "provisions":
        if (metrics.provisionsCount > 0) extractedCount++
        break
    }
  }

  return extractedCount / expectedShapes.length
}

/**
 * Generate coverage report for evidence
 */
export async function generateCoverageReport(evidenceId: string): Promise<CoverageMetrics> {
  // Count all extractions
  const [
    claimsCount,
    processesCount,
    referenceTablesCount,
    assetsCount,
    provisionsCount,
    sourcePointersCount,
  ] = await Promise.all([
    db.atomicClaim.count({ where: { evidenceId } }),
    db.regulatoryProcess.count({ where: { evidenceId } }),
    db.referenceTable.count({ where: { evidenceId } }),
    db.regulatoryAsset.count({ where: { evidenceId } }),
    db.transitionalProvision.count({ where: { evidenceId } }),
    db.sourcePointer.count({ where: { evidenceId } }),
  ])

  // Get classification if available (from AgentRun or stored)
  const classificationRun = await db.agentRun.findFirst({
    where: {
      evidenceId,
      agentType: "CONTENT_CLASSIFIER",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
  })

  const classification = classificationRun?.output as {
    primaryType?: string
    confidence?: number
  } | null

  const primaryContentType = classification?.primaryType ?? null
  const classificationConfidence = classification?.confidence ?? 0

  // Calculate expected shapes
  const expectedShapes = getExpectedShapes(primaryContentType as ClassificationContentType | null)

  // Build base metrics
  const baseMetrics: Omit<CoverageMetrics, "coverageScore" | "isComplete" | "warnings"> = {
    evidenceId,
    claimsCount,
    processesCount,
    referenceTablesCount,
    assetsCount,
    provisionsCount,
    sourcePointersCount,
    primaryContentType,
    classificationConfidence,
    missingShapes: [],
  }

  // Calculate coverage score
  const coverageScore = calculateCoverageScore(baseMetrics, expectedShapes)

  // Determine missing shapes
  const missingShapes: string[] = []
  for (const shape of expectedShapes) {
    switch (shape) {
      case "claims":
        if (claimsCount === 0) missingShapes.push("claims")
        break
      case "processes":
        if (processesCount === 0) missingShapes.push("processes")
        break
      case "referenceTables":
        if (referenceTablesCount === 0) missingShapes.push("referenceTables")
        break
      case "assets":
        if (assetsCount === 0) missingShapes.push("assets")
        break
      case "provisions":
        if (provisionsCount === 0) missingShapes.push("provisions")
        break
    }
  }

  // Generate warnings
  const warnings: string[] = []

  if (classificationConfidence < 0.7) {
    warnings.push(`Low classification confidence: ${classificationConfidence}`)
  }

  if (claimsCount === 0 && sourcePointersCount > 0) {
    warnings.push("Has legacy source pointers but no atomic claims - may need re-extraction")
  }

  const totalExtractions =
    claimsCount + processesCount + referenceTablesCount + assetsCount + provisionsCount
  if (totalExtractions === 0 && sourcePointersCount === 0) {
    warnings.push("No extractions at all - content may be empty or unsuitable")
  }

  // Determine if complete
  const isComplete = coverageScore >= 0.8 && missingShapes.length === 0

  return {
    ...baseMetrics,
    coverageScore,
    isComplete,
    missingShapes,
    warnings,
  }
}

/**
 * Save coverage report to database
 */
export async function saveCoverageReport(metrics: CoverageMetrics): Promise<string> {
  const report = await db.coverageReport.upsert({
    where: { evidenceId: metrics.evidenceId },
    create: {
      evidenceId: metrics.evidenceId,
      claimsCount: metrics.claimsCount,
      processesCount: metrics.processesCount,
      referenceTablesCount: metrics.referenceTablesCount,
      assetsCount: metrics.assetsCount,
      provisionsCount: metrics.provisionsCount,
      sourcePointersCount: metrics.sourcePointersCount,
      primaryContentType: metrics.primaryContentType,
      classificationConfidence: metrics.classificationConfidence,
      coverageScore: metrics.coverageScore,
      isComplete: metrics.isComplete,
      missingShapes: metrics.missingShapes,
      warnings: metrics.warnings,
    },
    update: {
      claimsCount: metrics.claimsCount,
      processesCount: metrics.processesCount,
      referenceTablesCount: metrics.referenceTablesCount,
      assetsCount: metrics.assetsCount,
      provisionsCount: metrics.provisionsCount,
      sourcePointersCount: metrics.sourcePointersCount,
      primaryContentType: metrics.primaryContentType,
      classificationConfidence: metrics.classificationConfidence,
      coverageScore: metrics.coverageScore,
      isComplete: metrics.isComplete,
      missingShapes: metrics.missingShapes,
      warnings: metrics.warnings,
    },
  })

  return report.id
}

/**
 * Get coverage summary for all evidence
 */
export async function getCoverageSummary(): Promise<{
  total: number
  complete: number
  incomplete: number
  avgScore: number
  byContentType: Record<string, { count: number; avgScore: number }>
}> {
  const reports = await db.coverageReport.findMany()

  const total = reports.length
  const complete = reports.filter((r) => r.isComplete).length
  const incomplete = total - complete
  const avgScore = total > 0 ? reports.reduce((sum, r) => sum + r.coverageScore, 0) / total : 0

  const byContentType: Record<string, { count: number; avgScore: number }> = {}
  for (const report of reports) {
    const type = report.primaryContentType ?? "UNKNOWN"
    if (!byContentType[type]) {
      byContentType[type] = { count: 0, avgScore: 0 }
    }
    byContentType[type].count++
    byContentType[type].avgScore += report.coverageScore
  }

  // Calculate averages
  for (const type in byContentType) {
    byContentType[type].avgScore /= byContentType[type].count
  }

  return { total, complete, incomplete, avgScore, byContentType }
}
