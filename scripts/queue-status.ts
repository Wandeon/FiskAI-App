// scripts/queue-status.ts
// CLI tool to monitor queue status (replaces Bull Board)

import IORedis from "ioredis"
import { PrismaClient } from "@prisma/client"

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

const db = new PrismaClient()

const QUEUES = [
  "sentinel",
  "extract",
  "ocr",
  "compose",
  "review",
  "arbiter",
  "release",
  "scheduled",
  "deadletter", // DLQ for permanently failed jobs
]

// DLQ configuration (mirrors queues.ts)
const DLQ_THRESHOLD = parseInt(process.env.DLQ_ALERT_THRESHOLD || "10")

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

async function getQueueStats(queue: string): Promise<QueueStats> {
  const prefix = "fiskai"
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    connection.llen(`${prefix}:${queue}:wait`).catch(() => 0),
    connection.llen(`${prefix}:${queue}:active`).catch(() => 0),
    connection.zcard(`${prefix}:${queue}:completed`).catch(() => 0),
    connection.zcard(`${prefix}:${queue}:failed`).catch(() => 0),
    connection.zcard(`${prefix}:${queue}:delayed`).catch(() => 0),
  ])

  return {
    name: queue,
    waiting: waiting as number,
    active: active as number,
    completed: completed as number,
    failed: failed as number,
    delayed: delayed as number,
  }
}

async function getDbStats() {
  const [discoveredItems, rules, evidence, pointers, conflicts] = await Promise.all([
    db.discoveredItem.groupBy({
      by: ["status"],
      _count: true,
    }),
    db.regulatoryRule.groupBy({
      by: ["status"],
      _count: true,
    }),
    db.evidence.count(),
    db.sourcePointer.count(),
    db.regulatoryConflict.count({ where: { status: "OPEN" } }),
  ])

  return {
    discoveredItems: Object.fromEntries(discoveredItems.map((d) => [d.status, d._count])),
    rules: Object.fromEntries(rules.map((r) => [r.status, r._count])),
    evidence,
    pointers,
    openConflicts: conflicts,
  }
}

async function main() {
  console.log("\n==================================================================")
  console.log("              FiskAI Queue & Pipeline Status                   ")
  console.log("==================================================================")
  console.log(`\nTimestamp: ${new Date().toISOString()}`)

  // Queue stats
  console.log("\n------------------------------------------------------------------")
  console.log("                    Queue Statistics                          ")
  console.log("------------------------------------------------------------------")
  console.log("Queue       | Waiting | Active | Completed | Failed | Delayed")
  console.log("------------|---------|--------|-----------|--------|--------")

  let dlqTotal = 0
  for (const queue of QUEUES) {
    const stats = await getQueueStats(queue)
    const isDLQ = queue === "deadletter"

    // Track DLQ total for alert check
    if (isDLQ) {
      dlqTotal = stats.waiting + stats.active
    }

    console.log(
      `${stats.name.padEnd(11)} | ${String(stats.waiting).padStart(7)} | ${String(stats.active).padStart(6)} | ${String(stats.completed).padStart(9)} | ${String(stats.failed).padStart(6)} | ${String(stats.delayed).padStart(6)}`
    )
  }

  // DLQ Alert
  if (dlqTotal >= DLQ_THRESHOLD) {
    console.log("\n!! DLQ ALERT: Dead letter queue depth exceeds threshold!")
    console.log(`   Current: ${dlqTotal} jobs, Threshold: ${DLQ_THRESHOLD}`)
    console.log("   Run: npx tsx scripts/dlq-inspect.ts for details")
  }

  // Database stats
  const dbStats = await getDbStats()

  console.log("\n------------------------------------------------------------------")
  console.log("                   Database Statistics                        ")
  console.log("------------------------------------------------------------------")

  console.log("\nDiscovered Items:")
  for (const [status, count] of Object.entries(dbStats.discoveredItems)) {
    console.log(`  ${status}: ${count}`)
  }

  console.log("\nRegulation Rules:")
  for (const [status, count] of Object.entries(dbStats.rules)) {
    console.log(`  ${status}: ${count}`)
  }

  console.log(`\nEvidence records: ${dbStats.evidence}`)
  console.log(`Source pointers: ${dbStats.pointers}`)
  console.log(`Open conflicts: ${dbStats.openConflicts}`)

  // Calculate backlog
  const totalPending =
    (dbStats.discoveredItems["PENDING"] || 0) +
    (dbStats.discoveredItems["FETCHED"] || 0) +
    (dbStats.rules["DRAFT"] || 0) +
    (dbStats.rules["PENDING_REVIEW"] || 0)

  const published = dbStats.rules["PUBLISHED"] || 0

  console.log("\n------------------------------------------------------------------")
  console.log("                    Pipeline Health                           ")
  console.log("------------------------------------------------------------------")
  console.log(`  Total backlog: ${totalPending}`)
  console.log(`  Published rules: ${published}`)
  console.log(`  Dead letter queue: ${dlqTotal} ${dlqTotal >= DLQ_THRESHOLD ? "(ALERT)" : ""}`)
  console.log(`  Saturation: ${totalPending === 0 ? "SATURATED" : "PROCESSING"}`)

  await connection.quit()
  await db.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
