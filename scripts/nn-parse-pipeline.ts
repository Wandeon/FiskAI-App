#!/usr/bin/env npx tsx
/**
 * Run NN Parser on an Evidence record
 *
 * Usage: npx tsx scripts/nn-parse-pipeline.ts <evidenceId>
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")
  const { NNParser } = await import("../src/lib/regulatory-truth/nn-parser")
  const { getParentPath } = await import("../src/lib/regulatory-truth/nn-parser/node-path")

  const evidenceId = process.argv[2]
  if (!evidenceId) {
    console.error("Usage: npx tsx scripts/nn-parse-pipeline.ts <evidenceId>")
    process.exit(1)
  }

  console.log("=== NN Parser ===")
  console.log("Evidence ID:", evidenceId)
  console.log("Parser:", NNParser.parserId, NNParser.parserVersion)

  // 1. Load Evidence
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      artifacts: true,
    },
  })

  if (!evidence) {
    console.error("Evidence not found:", evidenceId)
    process.exit(1)
  }

  console.log("Content class:", evidence.contentClass)
  console.log("Content length:", evidence.rawContent?.length || 0, "chars")

  // 2. Check for existing parse
  const existingParse = await dbReg.parsedDocument.findFirst({
    where: {
      evidenceId,
      parserId: NNParser.parserId,
      parserVersion: NNParser.parserVersion,
      parseConfigHash: NNParser.parseConfigHash,
      status: "SUCCESS",
    },
  })

  if (existingParse) {
    console.log("\nExisting successful parse found:", existingParse.id)
    console.log("Use --force to reparse")

    if (!process.argv.includes("--force")) {
      await dbReg.$disconnect()
      return
    }
    console.log("--force specified, reparsing...")
  }

  // 3. Get primary artifact (HTML_CLEANED or fall back to rawContent)
  let content = evidence.rawContent
  let artifactId: string | undefined

  const cleanedArtifact = evidence.artifacts.find(
    (a: { kind: string }) => a.kind === "HTML_CLEANED"
  )
  if (cleanedArtifact) {
    content = cleanedArtifact.content
    artifactId = cleanedArtifact.id
    console.log("Using HTML_CLEANED artifact:", artifactId)
  } else {
    console.log("Using rawContent (no HTML_CLEANED artifact)")
  }

  if (!content) {
    console.error("No content to parse")
    process.exit(1)
  }

  // 4. Parse
  console.log("\nParsing...")
  const startTime = Date.now()

  const result = await NNParser.parse({
    evidenceId,
    contentClass: evidence.contentClass as "HTML",
    artifact: {
      id: artifactId || "raw",
      kind: "HTML_RAW",
      content,
      contentHash: evidence.contentHash,
    },
  })

  const durationMs = Date.now() - startTime
  console.log("Parse completed in", durationMs, "ms")
  console.log("Status:", result.status)
  console.log("Nodes:", result.stats.nodeCount)
  console.log("Coverage:", result.stats.coveragePercent.toFixed(1) + "%")

  if (result.warnings.length > 0) {
    console.log("\nWarnings:")
    for (const w of result.warnings.slice(0, 5)) {
      console.log(`  - [${w.code}] ${w.message}`)
    }
    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more`)
    }
  }

  // 5. Store results
  console.log("\nStoring results...")

  // Create clean text artifact if not exists
  let cleanTextArtifactId: string | undefined
  const existingCleanText = evidence.artifacts.find(
    (a: { kind: string; contentHash: string }) =>
      a.kind === "CLEAN_TEXT" && a.contentHash === result.cleanTextHash
  )

  await dbReg.$transaction(async (tx) => {
    if (existingCleanText) {
      cleanTextArtifactId = existingCleanText.id
    } else {
      const newArtifact = await tx.evidenceArtifact.create({
        data: {
          evidenceId,
          kind: "CLEAN_TEXT",
          content: result.cleanText,
          contentHash: result.cleanTextHash,
        },
      })
      cleanTextArtifactId = newArtifact.id
      console.log("Created clean text artifact:", cleanTextArtifactId)
    }

    const previousParse = await tx.parsedDocument.findFirst({
      where: {
        evidenceId,
        parserId: NNParser.parserId,
        isLatest: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const parsedDoc = await tx.parsedDocument.create({
      data: {
        evidenceId,
        parserId: NNParser.parserId,
        parserVersion: NNParser.parserVersion,
        parseConfigHash: NNParser.parseConfigHash,
        status: result.status,
        errorMessage: result.errorMessage,
        warnings: result.warnings,
        unparsedSegments: result.unparsedSegments,
        docMeta: result.docMeta,
        cleanTextArtifactId,
        cleanTextLength: result.cleanText.length,
        cleanTextHash: result.cleanTextHash,
        offsetUnit: "UTF16",
        nodeCount: result.stats.nodeCount,
        maxDepth: result.stats.maxDepth,
        statsByType: result.stats.byType,
        coverageChars: result.stats.coverageChars,
        coveragePercent: result.stats.coveragePercent,
        isLatest: true,
        supersedesId: previousParse?.id,
        parseDurationMs: durationMs,
      },
    })

    const sortedNodes = [...result.nodes].sort((a, b) => a.depth - b.depth)
    const nodeIdByPath = new Map<string, string>()

    for (const node of sortedNodes) {
      const parentPath = getParentPath(node.nodePath)
      const parentId = parentPath ? nodeIdByPath.get(parentPath) || null : null

      const created = await tx.provisionNode.create({
        data: {
          parsedDocumentId: parsedDoc.id,
          nodeType: node.nodeType,
          nodePath: node.nodePath,
          label: node.label,
          orderIndex: node.orderIndex,
          depth: node.depth,
          rawText: node.rawText,
          normalizedText: node.normalizedText,
          startOffset: node.startOffset,
          endOffset: node.endOffset,
          isContainer: node.isContainer,
          htmlSelector: node.htmlSelector,
          parentId,
        },
      })
      nodeIdByPath.set(node.nodePath, created.id)
    }

    if (previousParse) {
      await tx.parsedDocument.update({
        where: { id: previousParse.id },
        data: {
          isLatest: false,
          supersededById: parsedDoc.id,
        },
      })
    }

    console.log("Created ParsedDocument:", parsedDoc.id)
    console.log("Created", sortedNodes.length, "ProvisionNodes")
  })

  // Summary
  console.log("\n=== Parse Complete ===")
  console.log("Status:", result.status)
  console.log("Node count:", result.stats.nodeCount)
  console.log("Coverage:", result.stats.coveragePercent.toFixed(1) + "%")

  console.log("\nNode breakdown:")
  for (const [type, count] of Object.entries(result.stats.byType)) {
    console.log(`  ${type}: ${count}`)
  }

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
