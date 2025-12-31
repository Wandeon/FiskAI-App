// src/lib/assistant/scripts/generate-concept-embeddings.ts
/**
 * Generate embeddings for all concepts
 *
 * This script:
 * 1. Fetches all concepts from the database
 * 2. Generates embeddings for each concept (nameHr + aliases)
 * 3. Stores embeddings in ConceptEmbedding table
 *
 * Usage:
 *   npx tsx src/lib/assistant/scripts/generate-concept-embeddings.ts
 */

import { prisma } from "@/lib/prisma"
import { embedBatch } from "@/lib/article-agent/verification/embedder"

async function generateConceptEmbeddings() {
  console.log("🚀 Starting concept embedding generation...")

  // Fetch all concepts
  const concepts = await prisma.concept.findMany({
    select: {
      id: true,
      slug: true,
      nameHr: true,
      aliases: true,
    },
  })

  console.log(`📊 Found ${concepts.length} concepts`)

  if (concepts.length === 0) {
    console.log("⚠️  No concepts found. Exiting.")
    return
  }

  // Prepare texts for embedding (nameHr + aliases)
  const conceptTexts = concepts.map((c) => {
    const aliases = c.aliases || []
    return [c.nameHr, ...aliases].join(" ")
  })

  console.log("🔄 Generating embeddings (batch mode)...")

  // Generate embeddings in batches to avoid memory issues
  const BATCH_SIZE = 50
  let processed = 0

  for (let i = 0; i < concepts.length; i += BATCH_SIZE) {
    const batch = concepts.slice(i, i + BATCH_SIZE)
    const batchTexts = conceptTexts.slice(i, i + BATCH_SIZE)

    try {
      // Generate embeddings for this batch
      const embeddings = await embedBatch(batchTexts)

      // Store embeddings in database
      for (let j = 0; j < batch.length; j++) {
        const concept = batch[j]
        const embedding = embeddings[j]
        const embeddingText = batchTexts[j]

        // Use raw SQL for vector insertion
        await prisma.$executeRaw`
          INSERT INTO "ConceptEmbedding" (id, "conceptId", embedding, "embeddingText", "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid()::text,
            ${concept.id},
            ${`[${embedding.join(",")}]`}::vector,
            ${embeddingText},
            NOW(),
            NOW()
          )
          ON CONFLICT ("conceptId")
          DO UPDATE SET
            embedding = EXCLUDED.embedding,
            "embeddingText" = EXCLUDED."embeddingText",
            "updatedAt" = NOW()
        `

        processed++
      }

      console.log(`✅ Processed ${processed}/${concepts.length} concepts`)
    } catch (error) {
      console.error(`❌ Error processing batch ${i / BATCH_SIZE + 1}:`, error)
      throw error
    }
  }

  console.log(`🎉 Successfully generated embeddings for ${processed} concepts`)
}

// Run the script
generateConceptEmbeddings()
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })
