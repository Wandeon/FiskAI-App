#!/usr/bin/env npx tsx
// scripts/audit-ocr.ts
// OCR Processing Audit Script
// Run with: npx tsx scripts/audit-ocr.ts
// For local development: DATABASE_URL="postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai" npx tsx scripts/audit-ocr.ts

import { db } from "../src/lib/db"
import { Prisma } from "@prisma/client"

// Handle --help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OCR Processing Audit Script

Usage:
  npx tsx scripts/audit-ocr.ts [options]

Options:
  -h, --help    Show this help message

Description:
  This script audits the OCR processing pipeline for regulatory truth evidence.
  It checks:
  - OCR queue health (pending scanned PDFs)
  - Artifact generation rates
  - Sample OCR artifacts with quality metrics
  - Failed OCR processing
  - Overall processing metrics

Environment:
  DATABASE_URL    PostgreSQL connection string (required)

  For local development with Docker:
    DATABASE_URL="postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai" npx tsx scripts/audit-ocr.ts

Exit codes:
  0    All checks passed or only warnings
  1    One or more checks failed
`)
  process.exit(0)
}

async function auditOcr() {
  console.log("=" + "=".repeat(70))
  console.log("OCR PROCESSING AUDIT")
  console.log("=" + "=".repeat(70))
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // 1. OCR QUEUE HEALTH
  console.log("1. OCR QUEUE HEALTH")
  console.log("-".repeat(50))

  const pendingScanned = await db.evidence.count({
    where: { contentClass: "PDF_SCANNED", primaryTextArtifactId: null },
  })
  console.log(`PDF_SCANNED awaiting OCR (no text artifact): ${pendingScanned}`)

  const totalScanned = await db.evidence.count({
    where: { contentClass: "PDF_SCANNED" },
  })
  console.log(`Total PDF_SCANNED Evidence records: ${totalScanned}`)

  // Check for stuck jobs (Evidence with ocrMetadata showing processing but no artifact)
  const stuckOcr = await db.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      primaryTextArtifactId: null,
      ocrMetadata: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      ocrMetadata: true,
      fetchedAt: true,
    },
    take: 10,
  })
  console.log(`Evidence with OCR metadata but no artifact: ${stuckOcr.length}`)
  if (stuckOcr.length > 0) {
    console.log(
      "Sample stuck IDs:",
      stuckOcr
        .slice(0, 5)
        .map((e) => e.id)
        .join(", ")
    )
  }

  // 2. ARTIFACT GENERATION
  console.log("\n2. ARTIFACT GENERATION")
  console.log("-".repeat(50))

  const artifactStats = await db.$queryRaw<Array<{ kind: string; count: bigint }>>`
    SELECT kind, COUNT(*)::bigint as count
    FROM "EvidenceArtifact"
    GROUP BY kind
    ORDER BY count DESC
  `
  console.log("Artifacts by kind:")
  for (const stat of artifactStats) {
    console.log(`  ${stat.kind}: ${stat.count}`)
  }

  // Check PDF_SCANNED with OCR_TEXT artifacts
  const scannedWithOcr = await db.evidence.count({
    where: {
      contentClass: "PDF_SCANNED",
      artifacts: { some: { kind: "OCR_TEXT" } },
    },
  })
  console.log(`\nPDF_SCANNED with OCR_TEXT artifact: ${scannedWithOcr}/${totalScanned}`)

  // Check artifact content lengths
  const artifactLengths = await db.$queryRaw<
    Array<{ kind: string; avg_len: number; min_len: number; max_len: number }>
  >`
    SELECT
      kind,
      AVG(LENGTH(content))::int as avg_len,
      MIN(LENGTH(content))::int as min_len,
      MAX(LENGTH(content))::int as max_len
    FROM "EvidenceArtifact"
    WHERE kind IN ('OCR_TEXT', 'PDF_TEXT')
    GROUP BY kind
  `
  console.log("\nArtifact content lengths:")
  for (const stat of artifactLengths) {
    console.log(`  ${stat.kind}: avg=${stat.avg_len}, min=${stat.min_len}, max=${stat.max_len}`)
  }

  // 3. SAMPLE OCR ARTIFACTS
  console.log("\n3. SAMPLE OCR_TEXT ARTIFACTS (up to 5)")
  console.log("-".repeat(50))

  const sampleArtifacts = await db.evidenceArtifact.findMany({
    where: { kind: "OCR_TEXT" },
    include: {
      evidence: {
        select: { id: true, url: true, ocrMetadata: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  for (const artifact of sampleArtifacts) {
    console.log(`\nArtifact ID: ${artifact.id}`)
    console.log(`Evidence ID: ${artifact.evidenceId}`)
    console.log(`URL: ${artifact.evidence.url}`)
    console.log(`Content length: ${artifact.content.length} chars`)

    const metadata = artifact.evidence.ocrMetadata as Record<string, unknown> | null
    if (metadata) {
      console.log(`OCR metadata:`)
      console.log(`  Method: ${metadata.method || "unknown"}`)
      console.log(`  Pages: ${metadata.pages || "unknown"}`)
      console.log(
        `  Avg Confidence: ${typeof metadata.avgConfidence === "number" ? metadata.avgConfidence.toFixed(1) + "%" : "unknown"}`
      )
      console.log(`  Processing time: ${metadata.processingMs || "unknown"}ms`)
    }

    // Sample text (first 500 chars)
    const sampleText = artifact.content.substring(0, 500).replace(/\n/g, " ").trim()
    console.log(`Sample text: "${sampleText.substring(0, 200)}..."`)

    // Check for Croatian diacritics
    const croatianChars = (artifact.content.match(/[čćđšžČĆĐŠŽ]/g) || []).length
    console.log(`Croatian diacritics found: ${croatianChars}`)
  }

  // 4. FAILED OCR
  console.log("\n4. FAILED OCR PROCESSING")
  console.log("-".repeat(50))

  const failedOcr = await db.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      ocrMetadata: {
        path: ["error"],
        not: null as unknown as undefined,
      },
    },
    select: {
      id: true,
      url: true,
      ocrMetadata: true,
      fetchedAt: true,
    },
    orderBy: { fetchedAt: "desc" },
    take: 10,
  })

  console.log(`Evidence with OCR errors: ${failedOcr.length}`)
  for (const evidence of failedOcr) {
    const metadata = evidence.ocrMetadata as Record<string, unknown> | null
    console.log(`\n  ID: ${evidence.id}`)
    console.log(`  URL: ${evidence.url}`)
    console.log(`  Error: ${metadata?.error || "unknown"}`)
  }

  // 5. OCR PROCESSING METRICS
  console.log("\n5. OCR PROCESSING METRICS")
  console.log("-".repeat(50))

  const ocrMetrics = await db.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      ocrMetadata: { not: Prisma.JsonNull },
      primaryTextArtifactId: { not: null },
    },
    select: {
      ocrMetadata: true,
    },
    take: 100,
  })

  if (ocrMetrics.length > 0) {
    let totalTime = 0
    let totalPages = 0
    let totalConfidence = 0
    let visionCount = 0
    let count = 0

    for (const e of ocrMetrics) {
      const m = e.ocrMetadata as Record<string, unknown> | null
      if (m) {
        if (typeof m.processingMs === "number") totalTime += m.processingMs
        if (typeof m.pages === "number") totalPages += m.pages
        if (typeof m.avgConfidence === "number") {
          totalConfidence += m.avgConfidence
          count++
        }
        if (m.method === "vision" || m.method === "hybrid") visionCount++
      }
    }

    console.log(`Processed evidence count: ${ocrMetrics.length}`)
    console.log(`Avg processing time: ${Math.round(totalTime / ocrMetrics.length)}ms`)
    console.log(`Avg pages per document: ${(totalPages / ocrMetrics.length).toFixed(1)}`)
    console.log(`Avg confidence: ${count > 0 ? (totalConfidence / count).toFixed(1) : "N/A"}%`)
    console.log(
      `Vision fallback used: ${visionCount} (${((visionCount / ocrMetrics.length) * 100).toFixed(1)}%)`
    )

    if (totalPages > 0) {
      const avgTimePerPage = totalTime / totalPages
      console.log(`Avg time per page: ${Math.round(avgTimePerPage)}ms`)
    }
  } else {
    console.log("No processed OCR metrics found")
  }

  // 6. QUALITY METRICS SUMMARY
  console.log("\n6. QUALITY METRICS SUMMARY")
  console.log("-".repeat(50))

  const ocrRate = totalScanned > 0 ? (scannedWithOcr / totalScanned) * 100 : 0
  const failedRate = totalScanned > 0 ? (failedOcr.length / totalScanned) * 100 : 0

  console.log(`OCR completion rate: ${ocrRate.toFixed(1)}%`)
  console.log(`OCR failure rate: ${failedRate.toFixed(1)}%`)
  console.log(`Pending OCR backlog: ${pendingScanned}`)

  // AUDIT VERDICT
  console.log("\n" + "=".repeat(70))
  console.log("AUDIT VERDICT")
  console.log("=".repeat(70))

  const verdicts: { check: string; status: "PASS" | "WARN" | "FAIL"; note: string }[] = []

  // OCR Queue Backlog
  if (pendingScanned === 0) {
    verdicts.push({ check: "OCR Queue Backlog", status: "PASS", note: "No pending items" })
  } else if (pendingScanned < 100) {
    verdicts.push({
      check: "OCR Queue Backlog",
      status: "PASS",
      note: `${pendingScanned} items (< 100 threshold)`,
    })
  } else if (pendingScanned < 500) {
    verdicts.push({
      check: "OCR Queue Backlog",
      status: "WARN",
      note: `${pendingScanned} items pending`,
    })
  } else {
    verdicts.push({
      check: "OCR Queue Backlog",
      status: "FAIL",
      note: `${pendingScanned} items pending (>500)`,
    })
  }

  // OCR Failure Rate
  if (failedRate < 5) {
    verdicts.push({
      check: "OCR Failure Rate",
      status: "PASS",
      note: `${failedRate.toFixed(1)}% (< 5% threshold)`,
    })
  } else if (failedRate < 10) {
    verdicts.push({ check: "OCR Failure Rate", status: "WARN", note: `${failedRate.toFixed(1)}%` })
  } else {
    verdicts.push({
      check: "OCR Failure Rate",
      status: "FAIL",
      note: `${failedRate.toFixed(1)}% (>10%)`,
    })
  }

  // Artifact Generation
  if (scannedWithOcr === totalScanned && totalScanned > 0) {
    verdicts.push({
      check: "Artifact Generation",
      status: "PASS",
      note: "All PDF_SCANNED have OCR_TEXT",
    })
  } else if (ocrRate >= 90) {
    verdicts.push({
      check: "Artifact Generation",
      status: "PASS",
      note: `${ocrRate.toFixed(1)}% have artifacts`,
    })
  } else if (ocrRate >= 70) {
    verdicts.push({
      check: "Artifact Generation",
      status: "WARN",
      note: `${ocrRate.toFixed(1)}% have artifacts`,
    })
  } else if (totalScanned === 0) {
    verdicts.push({ check: "Artifact Generation", status: "PASS", note: "No PDF_SCANNED evidence" })
  } else {
    verdicts.push({
      check: "Artifact Generation",
      status: "FAIL",
      note: `Only ${ocrRate.toFixed(1)}% have artifacts`,
    })
  }

  // Stuck Jobs
  if (stuckOcr.length === 0) {
    verdicts.push({ check: "Stuck Jobs", status: "PASS", note: "No stuck OCR jobs" })
  } else if (stuckOcr.length < 10) {
    verdicts.push({
      check: "Stuck Jobs",
      status: "WARN",
      note: `${stuckOcr.length} possibly stuck`,
    })
  } else {
    verdicts.push({ check: "Stuck Jobs", status: "FAIL", note: `${stuckOcr.length} stuck jobs` })
  }

  // Print verdicts
  for (const v of verdicts) {
    const statusIcon = v.status === "PASS" ? "✓" : v.status === "WARN" ? "⚠" : "✗"
    console.log(`[${v.status}] ${statusIcon} ${v.check}: ${v.note}`)
  }

  const overallPass = verdicts.every((v) => v.status !== "FAIL")
  const hasWarnings = verdicts.some((v) => v.status === "WARN")

  console.log("\n" + "-".repeat(50))
  if (overallPass && !hasWarnings) {
    console.log("OVERALL: PASS - OCR processing is healthy")
  } else if (overallPass) {
    console.log("OVERALL: PASS with WARNINGS - Review recommended")
  } else {
    console.log("OVERALL: FAIL - Immediate attention required")
  }

  await db.$disconnect()

  // Exit with error code if any check failed
  if (!overallPass) {
    process.exit(1)
  }
}

auditOcr().catch((error) => {
  if (error.code === "ECONNREFUSED") {
    console.error("\nDatabase connection failed (ECONNREFUSED)")
    console.error("This typically means the database server is not accessible.")
    console.error("\nFor local development, set DATABASE_URL to use localhost:")
    console.error(
      '  DATABASE_URL="postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai" npx tsx scripts/audit-ocr.ts'
    )
    console.error(
      "\nCurrent DATABASE_URL points to:",
      process.env.DATABASE_URL?.replace(/:[^@]+@/, ":****@") || "(not set)"
    )
  } else {
    console.error(error)
  }
  process.exit(1)
})
