#!/usr/bin/env tsx
// scripts/test-embedding-sync.ts
// Test script to verify embedding generation for published rules

import { db } from "@/lib/db"
import {
  generateEmbeddingsForRule,
  getEmbeddingStats,
} from "@/lib/regulatory-truth/services/embedding-service"

async function main() {
  console.log("=".repeat(80))
  console.log("Embedding Sync Test")
  console.log("=".repeat(80))

  // Get current embedding stats
  console.log("\n📊 Current Embedding Stats:")
  const statsBefore = await getEmbeddingStats()
  console.log(`  - Total chunks: ${statsBefore.totalChunks}`)
  console.log(`  - Rules with embeddings: ${statsBefore.rulesWithEmbeddings}`)
  console.log(
    `  - Published rules without embeddings: ${statsBefore.publishedRulesWithoutEmbeddings}`
  )

  // Get a published rule to test
  const publishedRule = await db.regulatoryRule.findFirst({
    where: { status: "PUBLISHED" },
    include: {
      sourcePointers: true,
    },
  })

  if (!publishedRule) {
    console.log("\n❌ No published rules found to test")
    process.exit(1)
  }

  // Note: Evidence is now in regulatory schema, accessed via evidenceId soft ref
  const pointerCount = await db.sourcePointer.count({
    where: { rules: { some: { id: publishedRule.id } } },
  })

  console.log(`\n🎯 Testing embedding generation for rule: ${publishedRule.id}`)
  console.log(`  - Concept: ${publishedRule.conceptSlug}`)
  console.log(`  - Title: ${publishedRule.titleHr}`)
  console.log(`  - Source pointers: ${pointerCount}`)

  // Generate embeddings
  console.log("\n⚙️  Generating embeddings...")
  const result = await generateEmbeddingsForRule(publishedRule.id)

  if (result.success) {
    console.log(`✅ Success! Generated ${result.chunkCount} embedding chunks`)
  } else {
    console.log(`❌ Failed: ${result.error}`)
    process.exit(1)
  }

  // Get updated stats
  console.log("\n📊 Updated Embedding Stats:")
  const statsAfter = await getEmbeddingStats()
  console.log(
    `  - Total chunks: ${statsAfter.totalChunks} (+${statsAfter.totalChunks - statsBefore.totalChunks})`
  )
  console.log(`  - Rules with embeddings: ${statsAfter.rulesWithEmbeddings}`)
  console.log(
    `  - Published rules without embeddings: ${statsAfter.publishedRulesWithoutEmbeddings}`
  )

  console.log("\n" + "=".repeat(80))
  console.log("✅ Test completed successfully!")
  console.log("=".repeat(80))
}

main()
  .catch((error) => {
    console.error("\n❌ Test failed:", error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
