#!/usr/bin/env npx tsx
/**
 * Manually queue OCR jobs for PDF_SCANNED Evidence
 * This bypasses the continuous-drainer to test OCR worker directly
 */

import { ocrQueue } from "../src/lib/regulatory-truth/workers/queues"
import { dbReg } from "../src/lib/db/regulatory"

async function main() {
  console.log("=== Manual OCR Queue Test ===")

  // Find PDF_SCANNED Evidence without OCR artifacts
  const pending = await dbReg.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      primaryTextArtifactId: null,
    },
    select: { id: true },
    take: 5,
  })

  console.log(`Found ${pending.length} PDF_SCANNED Evidence without OCR`)

  if (pending.length === 0) {
    console.log("No pending OCR work")
    process.exit(0)
  }

  const runId = `manual-ocr-${Date.now()}`

  for (const evidence of pending) {
    await ocrQueue.add("ocr", { evidenceId: evidence.id, runId })
    console.log(`Queued OCR for: ${evidence.id}`)
  }

  // Check queue status
  const waiting = await ocrQueue.getWaitingCount()
  const active = await ocrQueue.getActiveCount()
  console.log(`\nOCR queue: waiting=${waiting}, active=${active}`)

  await ocrQueue.close()
  process.exit(0)
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
