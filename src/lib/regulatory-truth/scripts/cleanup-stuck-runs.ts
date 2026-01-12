// src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts

import { config } from "dotenv"
import { resolve } from "path"

const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

import { db } from "@/lib/db"

const STUCK_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

async function cleanupStuckRuns() {
  console.log("[cleanup] Checking for stuck agent runs...")

  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS)

  const stuckRuns = await db.agentRun.findMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: stuckThreshold },
    },
  })

  console.log(`[cleanup] Found ${stuckRuns.length} stuck runs`)

  for (const run of stuckRuns) {
    const runningMinutes = Math.round((Date.now() - run.startedAt.getTime()) / 60000)

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: `Marked as failed: stuck in running state for ${runningMinutes} minutes`,
        completedAt: new Date(),
      },
    })

    console.log(`[cleanup] ✓ Marked run ${run.id} (${run.agentType}) as failed`)
  }

  console.log(`[cleanup] Complete: ${stuckRuns.length} runs cleaned up`)
}

cleanupStuckRuns()
  .catch(console.error)
  .finally(() => process.exit(0))
