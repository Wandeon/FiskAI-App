// scripts/test-outcome-taxonomy.ts
// Quick test to validate outcome taxonomy is working

import { db } from "@/lib/db"
import { runAgent } from "@/lib/regulatory-truth/agents/runner"
import { z } from "zod"

async function testOutcomeTaxonomy() {
  console.log("Testing outcome taxonomy...")

  // Test 1: Content too small should trigger CONTENT_LOW_QUALITY
  const result = await runAgent({
    agentType: "EXTRACTOR",
    input: {
      evidenceId: "test-123",
      content: "x", // Too small
      contentType: "html",
      sourceUrl: "https://test.hr/test",
    },
    inputSchema: z.object({
      evidenceId: z.string(),
      content: z.string(),
      contentType: z.string(),
      sourceUrl: z.string(),
    }),
    outputSchema: z.any(),
    runId: "test-run-taxonomy",
    jobId: "test-job-taxonomy",
    queueName: "test-queue",
    sourceSlug: "test-source",
  })

  console.log("\n=== Result ===")
  console.log("success:", result.success)
  console.log("outcome:", result.outcome)
  console.log("error:", result.error)
  console.log("runId:", result.runId)

  // Check the DB record
  const run = await db.agentRun.findUnique({
    where: { id: result.runId },
    select: {
      id: true,
      agentType: true,
      status: true,
      outcome: true,
      noChangeCode: true,
      noChangeDetail: true,
      queueName: true,
      runId: true,
      jobId: true,
      sourceSlug: true,
      inputChars: true,
      inputBytes: true,
      promptTemplateId: true,
      promptHash: true,
    },
  })

  console.log("\n=== DB Record ===")
  console.log(JSON.stringify(run, null, 2))

  // Cleanup
  await db.agentRun.delete({ where: { id: result.runId } })
  console.log("\nTest record cleaned up.")

  await db.$disconnect()
}

testOutcomeTaxonomy().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})
