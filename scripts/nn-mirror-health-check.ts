#!/usr/bin/env npx tsx
/**
 * NN Mirror Health Check
 *
 * Usage: npx tsx scripts/nn-mirror-health-check.ts
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")

  const [evidenceCount, artifactCount, parsedTotal, parsedSuccess, latestParsed, nodeCount] =
    await Promise.all([
      dbReg.evidence.count(),
      dbReg.evidenceArtifact.count(),
      dbReg.parsedDocument.count(),
      dbReg.parsedDocument.count({ where: { status: "SUCCESS" } }),
      dbReg.parsedDocument.findFirst({ orderBy: { createdAt: "desc" } }),
      dbReg.provisionNode.count(),
    ])

  const successRate = parsedTotal > 0 ? (parsedSuccess / parsedTotal) * 100 : 0

  console.log("=== NN Mirror Health Check ===")
  console.log("Evidence:", evidenceCount)
  console.log("Artifacts:", artifactCount)
  console.log("ParsedDocuments:", parsedTotal)
  console.log("Parse Success Rate:", successRate.toFixed(2) + "%")
  console.log("ProvisionNodes:", nodeCount)

  if (latestParsed) {
    console.log("Latest ParsedDocument:", latestParsed.id)
    console.log("Latest Status:", latestParsed.status)
    console.log("Latest Coverage:", latestParsed.coveragePercent ?? "n/a")
  }

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Health check failed:", error)
  process.exit(1)
})
