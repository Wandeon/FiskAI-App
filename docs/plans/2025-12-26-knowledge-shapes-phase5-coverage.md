# Knowledge Shapes Phase 5: Coverage Gate

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create extraction coverage tracking and quality gates to ensure complete knowledge extraction.

**Architecture:** Add CoverageReport model, reviewer gate logic, and admin dashboard for visibility.

**Tech Stack:** Prisma, TypeScript, Next.js, React

**Prerequisites:**

- Complete Phases 1-4
- Read `docs/plans/2025-12-26-knowledge-shapes-design.md` for context

---

## Task 1: Create CoverageReport Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add CoverageReport model**

```prisma
// Add to prisma/schema.prisma after existing models

// ============================================================================
// COVERAGE TRACKING
// ============================================================================

model CoverageReport {
  id              String   @id @default(cuid())
  evidenceId      String
  createdAt       DateTime @default(now())

  // Extraction counts by shape
  claimsCount           Int   @default(0)
  processesCount        Int   @default(0)
  referenceTablesCount  Int   @default(0)
  assetsCount           Int   @default(0)
  provisionsCount       Int   @default(0)

  // Legacy extraction (for comparison)
  sourcePointersCount   Int   @default(0)

  // Classification
  primaryContentType    String?  // LOGIC, PROCESS, REFERENCE, etc.
  classificationConfidence Float @default(0)

  // Coverage assessment
  coverageScore         Float    @default(0)  // 0-1, overall coverage
  isComplete            Boolean  @default(false)
  missingShapes         String[] // ["claims", "processes"]
  warnings              String[] // Quality warnings

  // Reviewer status
  reviewerApproved      Boolean  @default(false)
  reviewerNotes         String?
  reviewedAt            DateTime?
  reviewedBy            String?

  // Relations
  evidence              Evidence @relation(fields: [evidenceId], references: [id], onDelete: Cascade)

  @@unique([evidenceId])
  @@index([coverageScore])
  @@index([isComplete])
  @@index([createdAt])
}
```

**Step 2: Add relation to Evidence model**

```prisma
// In Evidence model, add:
coverageReport    CoverageReport?
```

**Step 3: Run migration**

```bash
npx prisma migrate dev --name add_coverage_report
```

**Step 4: Generate client**

```bash
npx prisma generate
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add CoverageReport model for extraction tracking"
```

---

## Task 2: Create Coverage Metrics Calculator

**Files:**

- Create: `src/lib/regulatory-truth/quality/coverage-report.ts`

**Step 1: Create the coverage report module**

```typescript
// src/lib/regulatory-truth/quality/coverage-report.ts
import { db } from "@/lib/db"
import type { ContentType } from "../schemas/content-classifier"

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
function getExpectedShapes(contentType: ContentType | null): string[] {
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
      status: "completed",
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
  const expectedShapes = getExpectedShapes(primaryContentType as ContentType | null)

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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/quality/coverage-report.ts
git commit -m "feat(quality): add coverage report calculator"
```

---

## Task 3: Create Coverage Gate for Reviewer

**Files:**

- Create: `src/lib/regulatory-truth/quality/coverage-gate.ts`

**Step 1: Create coverage gate module**

```typescript
// src/lib/regulatory-truth/quality/coverage-gate.ts
import { db } from "@/lib/db"
import { generateCoverageReport, saveCoverageReport, type CoverageMetrics } from "./coverage-report"

export interface GateResult {
  passed: boolean
  coverageReport: CoverageMetrics
  blockers: string[]
  recommendations: string[]
}

/**
 * Minimum requirements for each content type
 */
const MINIMUM_REQUIREMENTS: Record<string, { minScore: number; required: string[] }> = {
  LOGIC: {
    minScore: 0.6,
    required: ["claims"],
  },
  PROCESS: {
    minScore: 0.7,
    required: ["processes"],
  },
  REFERENCE: {
    minScore: 0.8,
    required: ["referenceTables"],
  },
  DOCUMENT: {
    minScore: 0.7,
    required: ["assets"],
  },
  TRANSITIONAL: {
    minScore: 0.8,
    required: ["provisions"],
  },
  MIXED: {
    minScore: 0.5,
    required: [], // At least some extraction
  },
  GENERAL: {
    minScore: 0.4,
    required: [],
  },
}

/**
 * Run coverage gate - determines if extraction is complete enough for review
 */
export async function runCoverageGate(evidenceId: string): Promise<GateResult> {
  // Generate coverage report
  const coverageReport = await generateCoverageReport(evidenceId)
  await saveCoverageReport(coverageReport)

  const blockers: string[] = []
  const recommendations: string[] = []

  // Get requirements for this content type
  const contentType = coverageReport.primaryContentType ?? "GENERAL"
  const requirements = MINIMUM_REQUIREMENTS[contentType] ?? MINIMUM_REQUIREMENTS.GENERAL

  // Check minimum score
  if (coverageReport.coverageScore < requirements.minScore) {
    blockers.push(
      `Coverage score ${(coverageReport.coverageScore * 100).toFixed(0)}% below minimum ${(requirements.minScore * 100).toFixed(0)}%`
    )
  }

  // Check required shapes
  for (const shape of requirements.required) {
    if (coverageReport.missingShapes.includes(shape)) {
      blockers.push(`Missing required shape: ${shape}`)
    }
  }

  // Add recommendations based on warnings
  for (const warning of coverageReport.warnings) {
    if (warning.includes("Low classification confidence")) {
      recommendations.push("Consider manual content classification")
    }
    if (warning.includes("legacy source pointers")) {
      recommendations.push("Re-run multi-shape extraction to get atomic claims")
    }
    if (warning.includes("No extractions")) {
      recommendations.push("Review content manually - may be empty or OCR failed")
    }
  }

  // Additional recommendations based on content type
  if (contentType === "MIXED" && coverageReport.missingShapes.length > 2) {
    recommendations.push(
      "Content classified as MIXED but few shapes extracted - consider re-classification"
    )
  }

  const passed = blockers.length === 0

  return {
    passed,
    coverageReport,
    blockers,
    recommendations,
  }
}

/**
 * Block publication if coverage gate fails
 */
export async function canPublish(evidenceId: string): Promise<{
  allowed: boolean
  reason: string
}> {
  const gateResult = await runCoverageGate(evidenceId)

  if (!gateResult.passed) {
    return {
      allowed: false,
      reason: `Coverage gate failed: ${gateResult.blockers.join("; ")}`,
    }
  }

  // Check if reviewer has approved
  const report = await db.coverageReport.findUnique({
    where: { evidenceId },
  })

  if (!report?.reviewerApproved) {
    return {
      allowed: false,
      reason: "Pending reviewer approval",
    }
  }

  return {
    allowed: true,
    reason: "Coverage gate passed and reviewer approved",
  }
}

/**
 * Mark coverage report as reviewed
 */
export async function approveForPublication(
  evidenceId: string,
  reviewerId: string,
  notes?: string
): Promise<void> {
  await db.coverageReport.update({
    where: { evidenceId },
    data: {
      reviewerApproved: true,
      reviewerNotes: notes,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    },
  })
}

/**
 * Reject coverage - requires re-extraction
 */
export async function rejectCoverage(
  evidenceId: string,
  reviewerId: string,
  notes: string
): Promise<void> {
  await db.coverageReport.update({
    where: { evidenceId },
    data: {
      reviewerApproved: false,
      reviewerNotes: notes,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    },
  })
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/quality/coverage-gate.ts
git commit -m "feat(quality): add coverage gate for reviewer blocking"
```

---

## Task 4: Create Quality Index Exports

**Files:**

- Create: `src/lib/regulatory-truth/quality/index.ts`

**Step 1: Create index file**

```typescript
// src/lib/regulatory-truth/quality/index.ts

// Coverage report
export {
  generateCoverageReport,
  saveCoverageReport,
  getCoverageSummary,
  type CoverageMetrics,
} from "./coverage-report"

// Coverage gate
export {
  runCoverageGate,
  canPublish,
  approveForPublication,
  rejectCoverage,
  type GateResult,
} from "./coverage-gate"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/quality/index.ts
git commit -m "feat(quality): add index exports"
```

---

## Task 5: Create Admin API for Coverage Dashboard

**Files:**

- Create: `src/app/api/admin/regulatory-truth/coverage/route.ts`

**Step 1: Create API route**

```typescript
// src/app/api/admin/regulatory-truth/coverage/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCoverageSummary } from "@/lib/regulatory-truth/quality"

export async function GET() {
  const session = await auth()

  if (!session?.user || session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get overall summary
    const summary = await getCoverageSummary()

    // Get recent reports with issues
    const reportsWithIssues = await db.coverageReport.findMany({
      where: {
        OR: [{ isComplete: false }, { warnings: { isEmpty: false } }],
      },
      include: {
        evidence: {
          select: {
            id: true,
            url: true,
            fetchedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    // Get pending reviews
    const pendingReviews = await db.coverageReport.findMany({
      where: {
        isComplete: true,
        reviewerApproved: false,
        reviewedAt: null,
      },
      include: {
        evidence: {
          select: {
            id: true,
            url: true,
          },
        },
      },
      take: 10,
    })

    return NextResponse.json({
      summary,
      reportsWithIssues: reportsWithIssues.map((r) => ({
        id: r.id,
        evidenceId: r.evidenceId,
        evidenceUrl: r.evidence.url,
        coverageScore: r.coverageScore,
        isComplete: r.isComplete,
        missingShapes: r.missingShapes,
        warnings: r.warnings,
        createdAt: r.createdAt,
      })),
      pendingReviews: pendingReviews.map((r) => ({
        id: r.id,
        evidenceId: r.evidenceId,
        evidenceUrl: r.evidence.url,
        coverageScore: r.coverageScore,
        primaryContentType: r.primaryContentType,
      })),
    })
  } catch (error) {
    console.error("Error fetching coverage data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/regulatory-truth/coverage/route.ts
git commit -m "feat(api): add admin coverage dashboard API"
```

---

## Task 6: Create Admin Coverage Dashboard Component

**Files:**

- Create: `src/app/(admin)/admin/regulatory-truth/coverage/page.tsx`

**Step 1: Create dashboard page**

```typescript
// src/app/(admin)/admin/regulatory-truth/coverage/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CoverageDashboard } from "./coverage-dashboard"

export default async function CoveragePage() {
  const session = await auth()

  if (!session?.user || session.user.systemRole !== "ADMIN") {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-2xl font-bold">Knowledge Shape Coverage</h1>
      <CoverageDashboard />
    </div>
  )
}
```

**Step 2: Create dashboard component**

```typescript
// src/app/(admin)/admin/regulatory-truth/coverage/coverage-dashboard.tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface CoverageData {
  summary: {
    total: number
    complete: number
    incomplete: number
    avgScore: number
    byContentType: Record<string, { count: number; avgScore: number }>
  }
  reportsWithIssues: Array<{
    id: string
    evidenceId: string
    evidenceUrl: string
    coverageScore: number
    isComplete: boolean
    missingShapes: string[]
    warnings: string[]
    createdAt: string
  }>
  pendingReviews: Array<{
    id: string
    evidenceId: string
    evidenceUrl: string
    coverageScore: number
    primaryContentType: string | null
  }>
}

export function CoverageDashboard() {
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/admin/regulatory-truth/coverage")
        if (!response.ok) throw new Error("Failed to fetch")
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.summary.complete}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Incomplete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.summary.incomplete}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.summary.avgScore * 100).toFixed(0)}%</div>
            <Progress value={data.summary.avgScore * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* By Content Type */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage by Content Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.summary.byContentType).map(([type, stats]) => (
              <div key={type} className="flex items-center justify-between">
                <div>
                  <Badge variant="outline">{type}</Badge>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {stats.count} evidence records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{(stats.avgScore * 100).toFixed(0)}%</span>
                  <Progress value={stats.avgScore * 100} className="w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence with Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.reportsWithIssues.map((report) => (
              <div key={report.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <a
                      href={report.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {new URL(report.evidenceUrl).hostname}
                    </a>
                    <div className="mt-1 flex gap-2">
                      {!report.isComplete && <Badge variant="destructive">Incomplete</Badge>}
                      {report.missingShapes.map((shape) => (
                        <Badge key={shape} variant="outline">
                          Missing: {shape}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {(report.coverageScore * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                {report.warnings.length > 0 && (
                  <div className="mt-2 text-sm text-yellow-600">
                    {report.warnings.join("; ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews ({data.pendingReviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.pendingReviews.map((review) => (
              <div key={review.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Badge variant="secondary">{review.primaryContentType ?? "UNKNOWN"}</Badge>
                  <span className="ml-2 text-sm">
                    {new URL(review.evidenceUrl).hostname}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{(review.coverageScore * 100).toFixed(0)}%</span>
                  <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/regulatory-truth/coverage/
git commit -m "feat(admin): add coverage dashboard UI"
```

---

## Task 7: Integrate Coverage Gate with Pipeline

**Files:**

- Modify: `src/lib/regulatory-truth/agents/extractor.ts`

**Step 1: Add coverage report generation after extraction**

Add this at the end of `runExtractor` function:

```typescript
// Add import at top
import { generateCoverageReport, saveCoverageReport } from "../quality/coverage-report"

// Add at end of runExtractor, before return
// Generate and save coverage report
try {
  const coverageReport = await generateCoverageReport(evidenceId)
  await saveCoverageReport(coverageReport)
  console.log(
    `[extractor] Coverage: ${(coverageReport.coverageScore * 100).toFixed(0)}% (${coverageReport.isComplete ? "complete" : "incomplete"})`
  )
} catch (coverageError) {
  console.warn(`[extractor] Failed to generate coverage report: ${coverageError}`)
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/agents/extractor.ts
git commit -m "feat(extractor): integrate coverage report generation"
```

---

## Task 8: Write Coverage Tests

**Files:**

- Create: `src/lib/regulatory-truth/quality/__tests__/coverage-gate.test.ts`

**Step 1: Create test file**

```typescript
// src/lib/regulatory-truth/quality/__tests__/coverage-gate.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    atomicClaim: { count: vi.fn() },
    regulatoryProcess: { count: vi.fn() },
    referenceTable: { count: vi.fn() },
    regulatoryAsset: { count: vi.fn() },
    transitionalProvision: { count: vi.fn() },
    sourcePointer: { count: vi.fn() },
    agentRun: { findFirst: vi.fn() },
    coverageReport: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"

describe("Coverage Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("generateCoverageReport", () => {
    it("calculates coverage score for LOGIC content", async () => {
      // Mock counts
      vi.mocked(db.atomicClaim.count).mockResolvedValue(5)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(10)

      // Mock classification
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)

      // Import and run
      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.claimsCount).toBe(5)
      expect(report.coverageScore).toBe(1.0) // LOGIC needs claims, we have claims
      expect(report.isComplete).toBe(true)
    })

    it("marks as incomplete when required shapes are missing", async () => {
      // Mock counts - no claims
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(5)

      // Mock classification as LOGIC
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)

      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.claimsCount).toBe(0)
      expect(report.coverageScore).toBe(0) // Missing required claims
      expect(report.isComplete).toBe(false)
      expect(report.missingShapes).toContain("claims")
    })
  })

  describe("runCoverageGate", () => {
    it("blocks publication when coverage is insufficient", async () => {
      // Setup mocks for low coverage
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.passed).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
    })

    it("allows publication when coverage meets requirements", async () => {
      // Setup mocks for good coverage
      vi.mocked(db.atomicClaim.count).mockResolvedValue(3)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(5)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.passed).toBe(true)
      expect(result.blockers.length).toBe(0)
    })
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/regulatory-truth/quality/__tests__/coverage-gate.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/quality/__tests__/
git commit -m "test(quality): add coverage gate tests"
```

---

## Task 9: Create Coverage CLI

**Files:**

- Create: `src/lib/regulatory-truth/scripts/coverage-cli.ts`

**Step 1: Create CLI script**

```typescript
// src/lib/regulatory-truth/scripts/coverage-cli.ts
import {
  generateCoverageReport,
  saveCoverageReport,
  getCoverageSummary,
} from "../quality/coverage-report"
import { runCoverageGate, approveForPublication } from "../quality/coverage-gate"

async function main() {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  switch (command) {
    case "report": {
      const evidenceId = args[0]
      if (!evidenceId) {
        console.error("Usage: coverage-cli report <evidenceId>")
        process.exit(1)
      }

      console.log(`Generating coverage report for: ${evidenceId}\n`)
      const report = await generateCoverageReport(evidenceId)

      console.log("=== Coverage Report ===")
      console.log(`Evidence ID: ${report.evidenceId}`)
      console.log(`Content Type: ${report.primaryContentType}`)
      console.log(`Classification Confidence: ${report.classificationConfidence}`)
      console.log(`\nExtractions:`)
      console.log(`  Claims: ${report.claimsCount}`)
      console.log(`  Processes: ${report.processesCount}`)
      console.log(`  Reference Tables: ${report.referenceTablesCount}`)
      console.log(`  Assets: ${report.assetsCount}`)
      console.log(`  Provisions: ${report.provisionsCount}`)
      console.log(`  Legacy Source Pointers: ${report.sourcePointersCount}`)
      console.log(`\nScore: ${(report.coverageScore * 100).toFixed(0)}%`)
      console.log(`Complete: ${report.isComplete}`)

      if (report.missingShapes.length > 0) {
        console.log(`Missing: ${report.missingShapes.join(", ")}`)
      }

      if (report.warnings.length > 0) {
        console.log(`\nWarnings:`)
        report.warnings.forEach((w) => console.log(`  - ${w}`))
      }

      // Save report
      await saveCoverageReport(report)
      console.log("\nReport saved.")
      break
    }

    case "gate": {
      const evidenceId = args[0]
      if (!evidenceId) {
        console.error("Usage: coverage-cli gate <evidenceId>")
        process.exit(1)
      }

      console.log(`Running coverage gate for: ${evidenceId}\n`)
      const result = await runCoverageGate(evidenceId)

      console.log(`Gate: ${result.passed ? "PASSED ✓" : "BLOCKED ✗"}`)
      console.log(`Coverage: ${(result.coverageReport.coverageScore * 100).toFixed(0)}%`)

      if (result.blockers.length > 0) {
        console.log(`\nBlockers:`)
        result.blockers.forEach((b) => console.log(`  ✗ ${b}`))
      }

      if (result.recommendations.length > 0) {
        console.log(`\nRecommendations:`)
        result.recommendations.forEach((r) => console.log(`  → ${r}`))
      }

      process.exit(result.passed ? 0 : 1)
    }

    case "summary": {
      console.log("Fetching coverage summary...\n")
      const summary = await getCoverageSummary()

      console.log("=== Coverage Summary ===")
      console.log(`Total: ${summary.total}`)
      console.log(`Complete: ${summary.complete}`)
      console.log(`Incomplete: ${summary.incomplete}`)
      console.log(`Average Score: ${(summary.avgScore * 100).toFixed(0)}%`)
      console.log(`\nBy Content Type:`)

      for (const [type, stats] of Object.entries(summary.byContentType)) {
        console.log(`  ${type}: ${stats.count} records, ${(stats.avgScore * 100).toFixed(0)}% avg`)
      }
      break
    }

    case "approve": {
      const evidenceId = args[0]
      const reviewerId = args[1] || "cli-user"
      const notes = args.slice(2).join(" ") || "Approved via CLI"

      if (!evidenceId) {
        console.error("Usage: coverage-cli approve <evidenceId> [reviewerId] [notes]")
        process.exit(1)
      }

      await approveForPublication(evidenceId, reviewerId, notes)
      console.log(`Evidence ${evidenceId} approved for publication.`)
      break
    }

    default:
      console.log(`
Coverage CLI

Commands:
  report <evidenceId>     Generate coverage report
  gate <evidenceId>       Run coverage gate (pass/fail)
  summary                 Show overall coverage summary
  approve <id> [reviewer] Approve for publication
      `)
      break
  }

  process.exit(0)
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/scripts/coverage-cli.ts
git commit -m "feat(scripts): add coverage CLI"
```

---

## Phase 5 Complete

**Summary of changes:**

- CoverageReport schema for tracking all 7 shapes
- Coverage metrics calculator
- Coverage gate with content-type-specific requirements
- Admin API for coverage dashboard
- Admin dashboard UI with summary cards and issue list
- Integration with extraction pipeline
- Test coverage
- CLI for coverage operations

---

## All Phases Complete

**Overall Implementation Summary:**

| Phase | Focus                  | Key Deliverables                                         |
| ----- | ---------------------- | -------------------------------------------------------- |
| 1     | Schema Migration       | 8 new Prisma models, 8 enums, Zod schemas                |
| 2     | Multi-Shape Extraction | Content classifier, 5 extractors, orchestrator           |
| 3     | Taxonomy + Precedence  | Concept graph, query expansion, OVERRIDES edges, arbiter |
| 4     | Retrieval Router       | Intent classifier, 5 specialized engines                 |
| 5     | Coverage Gate          | Coverage metrics, quality gates, admin dashboard         |

**Total Tasks:** 50 (10 per phase)

**Execution:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement.
