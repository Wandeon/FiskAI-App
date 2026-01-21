#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db } = await import("../src/lib/db")

  const runId = process.argv[2] || "cmkn2qveo0000nlwim22czwx0"

  // Get the agent run that was just created
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      agentType: true,
      status: true,
      outcome: true,
      error: true,
      rawOutput: true,
      tokensUsed: true,
      durationMs: true,
      inputChars: true,
      evidenceId: true,
    },
  })

  console.log("=== AgentRun Details ===")
  console.log(JSON.stringify(run, null, 2))

  // Check raw output (it may have the partial response)
  if (run?.rawOutput) {
    const raw = typeof run.rawOutput === "string" ? run.rawOutput : JSON.stringify(run.rawOutput)
    console.log("\n=== Raw Output Preview ===")
    console.log(raw.slice(0, 5000))
    console.log("...")
    console.log(`Total length: ${raw.length} chars`)
  }

  await db.$disconnect()
}

main().catch(console.error)
