import { Queue } from "bullmq"
import IORedis from "ioredis"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

async function main() {
  // Find evidence without pointers (cross-schema query)
  const evidenceWithPointers = new Set(
    (await db.sourcePointer.findMany({ select: { evidenceId: true } })).map((p) => p.evidenceId)
  )
  const allEvidence = await dbReg.evidence.findMany({ select: { id: true }, take: 100 })
  const evidence = allEvidence.filter((e) => !evidenceWithPointers.has(e.id)).slice(0, 10)

  console.log(`Found ${evidence.length} evidence without pointers`)

  if (evidence.length > 0) {
    const extractQueue = new Queue("extract", { connection, prefix: "fiskai" })
    const runId = "manual-" + Date.now()

    await extractQueue.addBulk(
      evidence.map((e) => ({
        name: "extract",
        data: { evidenceId: e.id, runId },
      }))
    )

    console.log(`Queued ${evidence.length} extract jobs`)
  }

  await connection.quit()
}

main().catch(console.error)
