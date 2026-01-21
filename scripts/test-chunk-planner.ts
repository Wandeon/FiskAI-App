#!/usr/bin/env npx tsx
/**
 * Test the chunk planner on a real NN document
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { planChunks, printChunkPlan } from "../src/lib/regulatory-truth/extraction/chunk-planner"

async function main() {
  const { dbReg } = await import("../src/lib/db")

  const evidenceId = process.argv[2] || "cmkivgiit001801rtfn33iza3"

  // Get the document
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      url: true,
      rawContent: true,
    },
  })

  if (!evidence || !evidence.rawContent) {
    console.error("Evidence not found or has no content:", evidenceId)
    process.exit(1)
  }

  console.log("=".repeat(80))
  console.log("CHUNK PLANNER TEST")
  console.log("=".repeat(80))
  console.log()
  console.log("Evidence ID:", evidence.id)
  console.log("URL:", evidence.url)
  console.log("Raw content size:", evidence.rawContent.length, "chars")
  console.log()

  // Plan chunks
  const plan = planChunks(evidence.id, evidence.rawContent)

  printChunkPlan(plan)

  // Show detailed job list
  console.log("\n=== ALL JOBS ===")
  for (const job of plan.jobs) {
    const preview = job.text.slice(0, 80).replace(/\n/g, " ")
    console.log(`${job.nodePath} [${job.level}] ${job.text.length} chars: "${preview}..."`)
  }

  await dbReg.$disconnect()
}

main().catch(console.error)
