import { dbReg } from "../src/lib/db/regulatory"
import { db } from "../src/lib/db"

// Full pipeline trace for one randomly selected Evidence from LOCKED sources
async function main() {
  console.log("=== PIPELINE TRACE AUDIT ===")
  console.log(`Date: ${new Date().toISOString()}`)
  console.log("")

  // LOCKED sources only
  const lockedSlugs = ["porezna-uprava-gov-hr", "hzzo-hr", "narodne-novine", "mfin", "hzmo", "fina"]

  // Get LOCKED sources that exist
  const sources = await dbReg.regulatorySource.findMany({
    where: { slug: { in: lockedSlugs } },
    select: { id: true, slug: true, url: true, name: true },
  })

  const sourceIds = sources.map((s) => s.id)

  // Find Evidence from LOCKED sources with SourcePointers
  const evidence = await dbReg.evidence.findMany({
    where: {
      sourceId: { in: sourceIds },
      contentClass: { in: ["HTML", "PDF_TEXT"] },
    },
    select: {
      id: true,
      url: true,
      sourceId: true,
      contentClass: true,
      fetchedAt: true,
      contentHash: true,
      rawContent: true,
      stalenessStatus: true,
      lastVerifiedAt: true,
      embeddingStatus: true,
      source: {
        select: { slug: true, name: true, hierarchy: true, url: true },
      },
      artifacts: {
        select: { id: true, kind: true, contentHash: true, createdAt: true, content: true },
      },
    },
    orderBy: { fetchedAt: "desc" },
  })

  // Filter to only Evidence with SourcePointers
  const evidenceWithPointers = []
  for (const e of evidence) {
    const pointerCount = await db.sourcePointer.count({
      where: { evidenceId: e.id },
    })
    if (pointerCount > 0) {
      evidenceWithPointers.push({ ...e, pointerCount })
    }
  }

  console.log(`Total Evidence with SourcePointers: ${evidenceWithPointers.length}`)

  if (evidenceWithPointers.length === 0) {
    console.log("No Evidence with SourcePointers found!")
    return
  }

  // RANDOM SELECTION using crypto
  const crypto = await import("crypto")
  const randomIndex = crypto.randomInt(0, evidenceWithPointers.length)
  const selected = evidenceWithPointers[randomIndex]

  console.log(`\n=== RANDOM SELECTION (index ${randomIndex}/${evidenceWithPointers.length}) ===\n`)

  // STEP 1: Raw Internet Capture
  console.log("## STEP 1: RAW INTERNET CAPTURE")
  console.log(`Evidence ID: ${selected.id}`)
  console.log(`Source URL: ${selected.url}`)
  console.log(`Source Slug: ${selected.source?.slug}`)
  console.log(`Source Name: ${selected.source?.name}`)
  console.log(`Source Hierarchy: ${selected.source?.hierarchy}`)
  console.log(`Content Class: ${selected.contentClass}`)
  console.log(`Fetched At: ${selected.fetchedAt}`)
  console.log(`Content Hash: ${selected.contentHash}`)
  console.log(`Content Length: ${selected.rawContent?.length || 0} chars`)
  console.log(`Staleness Status: ${selected.stalenessStatus}`)
  console.log(`Last Verified: ${selected.lastVerifiedAt || "N/A"}`)
  console.log(`Embedding Status: ${selected.embeddingStatus}`)
  console.log("")

  // Content preview (first 500 chars)
  const contentPreview = selected.rawContent?.substring(0, 500) || "N/A"
  console.log(`Content Preview (first 500 chars):`)
  console.log("---")
  console.log(contentPreview)
  console.log("---")
  console.log("")

  // STEP 2: Normalization Output (Artifacts)
  console.log("## STEP 2: NORMALIZATION OUTPUT (ARTIFACTS)")
  console.log(`Total Artifacts: ${selected.artifacts.length}`)
  for (const art of selected.artifacts) {
    console.log(`  Artifact ID: ${art.id}`)
    console.log(`    Kind: ${art.kind}`)
    console.log(`    Content Hash: ${art.contentHash}`)
    console.log(`    Created: ${art.createdAt}`)
    console.log(`    Content Length: ${art.content?.length || 0} chars`)
    // Preview first 200 chars of artifact content
    const artPreview = art.content?.substring(0, 200) || "N/A"
    console.log(`    Content Preview: ${artPreview}...`)
    console.log("")
  }

  // STEP 3: LLM Extraction Output (SourcePointers)
  console.log("## STEP 3: LLM EXTRACTION OUTPUT (SOURCEPOINTERS)")
  const pointers = await db.sourcePointer.findMany({
    where: { evidenceId: selected.id },
    include: {
      rules: {
        select: {
          id: true,
          conceptSlug: true,
          titleHr: true,
          value: true,
          valueType: true,
          effectiveFrom: true,
          effectiveUntil: true,
          derivedConfidence: true,
          status: true,
        },
      },
    },
  })

  console.log(`Total SourcePointers: ${pointers.length}`)
  console.log("")

  for (const p of pointers) {
    console.log(`SourcePointer ID: ${p.id}`)
    console.log(`  Domain: ${p.domain}`)
    console.log(`  Value Type: ${p.valueType}`)
    console.log(`  Extracted Value: ${p.extractedValue}`)
    console.log(`  Exact Quote: ${p.exactQuote?.substring(0, 150)}...`)
    console.log(`  Article Number: ${p.articleNumber || "N/A"}`)
    console.log(`  Law Reference: ${p.lawReference || "N/A"}`)
    console.log(`  Confidence: ${p.confidence}`)
    console.log(`  Created At: ${p.createdAt}`)

    // Check linked rules
    if (p.rules && p.rules.length > 0) {
      console.log(`  Linked Rules: ${p.rules.length}`)
      for (const r of p.rules) {
        console.log(`    Rule ID: ${r.id}`)
        console.log(`      Concept: ${r.conceptSlug}`)
        console.log(`      Title: ${r.titleHr}`)
        console.log(`      Value: ${r.value} (${r.valueType})`)
        console.log(`      Status: ${r.status}`)
        console.log(`      Confidence: ${r.derivedConfidence}`)
        console.log(`      Effective: ${r.effectiveFrom} to ${r.effectiveUntil || "ongoing"}`)
      }
    } else {
      console.log(`  Linked Rules: 0 (orphan pointer)`)
    }
    console.log("")
  }

  // STEP 4: Grounded Correctness Check
  console.log("## STEP 4: GROUNDED CORRECTNESS CHECK")

  // For PDF_TEXT, check against artifact content (extracted text), not raw PDF
  // For HTML, check against rawContent
  const textArtifact = selected.artifacts.find(
    (a) => a.kind === "PDF_TEXT" || a.kind === "HTML_CLEANED"
  )
  const contentToCheck =
    selected.contentClass === "PDF_TEXT" && textArtifact
      ? textArtifact.content
      : selected.rawContent

  console.log(
    `Checking against: ${selected.contentClass === "PDF_TEXT" && textArtifact ? "artifact (PDF_TEXT)" : "rawContent"}`
  )
  console.log(`Content length: ${contentToCheck?.length || 0} chars`)
  console.log("")

  // For each pointer, verify the exactQuote exists in content
  let groundedCount = 0
  let ungroundedCount = 0
  const groundingResults = []

  for (const p of pointers) {
    if (p.exactQuote) {
      // Normalize whitespace for comparison
      const normalizedQuote = p.exactQuote.replace(/\s+/g, " ").trim()
      const normalizedContent = contentToCheck?.replace(/\s+/g, " ") || ""

      const found = normalizedContent.includes(normalizedQuote)
      if (found) {
        groundedCount++
        groundingResults.push({ id: p.id, quote: normalizedQuote.substring(0, 50), grounded: true })
      } else {
        ungroundedCount++
        groundingResults.push({
          id: p.id,
          quote: normalizedQuote.substring(0, 50),
          grounded: false,
        })
      }
    }
  }

  console.log(`Grounded Quotes: ${groundedCount}/${pointers.length}`)
  console.log(`Ungrounded Quotes: ${ungroundedCount}/${pointers.length}`)
  console.log("")

  for (const r of groundingResults) {
    console.log(`  ${r.id}: ${r.grounded ? "✓ GROUNDED" : "✗ NOT GROUNDED"} - "${r.quote}..."`)
  }
  console.log("")

  // STEP 5: Check for Extraction Rejections (Dead Letter Queue)
  console.log("## STEP 5: EXTRACTION REJECTIONS (DLQ)")
  const rejections = await dbReg.extractionRejected.findMany({
    where: { evidenceId: selected.id },
    select: {
      id: true,
      rejectionType: true,
      errorDetails: true,
      attemptCount: true,
      lastAttemptAt: true,
      resolvedAt: true,
    },
  })

  console.log(`Total Rejections: ${rejections.length}`)
  for (const rej of rejections) {
    console.log(`  Rejection ID: ${rej.id}`)
    console.log(`    Type: ${rej.rejectionType}`)
    console.log(`    Error: ${rej.errorDetails}`)
    console.log(`    Attempts: ${rej.attemptCount}`)
    console.log(`    Last Attempt: ${rej.lastAttemptAt}`)
    console.log(`    Resolved: ${rej.resolvedAt || "N/A"}`)
    console.log("")
  }

  // STEP 6: Summary Statistics
  console.log("## STEP 6: FINAL VERDICT")
  const groundingRate =
    pointers.length > 0 ? ((groundedCount / pointers.length) * 100).toFixed(1) : 0
  const rulesLinked = pointers.reduce((sum, p) => sum + (p.rules?.length || 0), 0)

  console.log(`Evidence ID: ${selected.id}`)
  console.log(`Source: ${selected.source?.slug} (${selected.source?.name})`)
  console.log(`Source URL: ${selected.url}`)
  console.log(`Content Class: ${selected.contentClass}`)
  console.log(`Content Size: ${selected.rawContent?.length || 0} chars`)
  console.log(`Artifacts Generated: ${selected.artifacts.length}`)
  console.log(`SourcePointers Extracted: ${pointers.length}`)
  console.log(`Rules Linked: ${rulesLinked}`)
  console.log(`Grounding Rate: ${groundingRate}%`)
  console.log(`Extraction Rejections: ${rejections.length}`)

  // Determine overall status
  let status = "PASS"
  const issues = []

  if (pointers.length === 0) {
    status = "FAIL"
    issues.push("No SourcePointers extracted")
  }
  if (ungroundedCount > 0) {
    status = "WARN"
    issues.push(`${ungroundedCount} ungrounded quotes detected`)
  }
  if (rejections.length > 0 && !rejections.some((r) => r.resolvedAt)) {
    status = "WARN"
    issues.push(
      `${rejections.filter((r) => !r.resolvedAt).length} unresolved extraction rejections`
    )
  }

  console.log(`\nOVERALL STATUS: ${status}`)
  if (issues.length > 0) {
    console.log(`Issues:`)
    issues.forEach((i) => console.log(`  - ${i}`))
  }

  console.log("\n=== END OF TRACE ===")
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
