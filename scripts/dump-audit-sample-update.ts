import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { Prisma } from "@prisma/client"
import { db } from "../src/lib/db"

function readArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  const value = process.argv[idx + 1]
  if (!value || value.startsWith("--")) return null
  return value
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function usage(): never {
  process.stderr.write(
    [
      "Usage:",
      "  npx tsx scripts/dump-audit-sample-update.ts --correlationId SHATTER-S3 --out audit/operation-shatter/evidence/h2-sample-update-shatter-s3.json",
      "",
    ].join("\n")
  )
  process.exit(2)
}

async function main() {
  const correlationId = readArg("--correlationId")
  if (!correlationId) usage()

  const outPathRaw = readArg("--out")

  const rows = await db.$queryRaw<
    Array<{
      id: string
      companyId: string
      userId: string | null
      actor: string
      action: string
      entity: string
      entityId: string
      changes: unknown
      timestamp: Date
      reason: string
      checksum: string | null
    }>
  >(Prisma.sql`
    select
      id,
      "companyId" as "companyId",
      "userId" as "userId",
      actor,
      action,
      entity,
      "entityId" as "entityId",
      changes,
      timestamp,
      reason,
      checksum
    from "AuditLog"
    where action = 'UPDATE'
      and changes->>'correlationId' = ${correlationId}
    order by timestamp asc, id asc
    limit 50
  `)

  const withBeforeAfter = rows.find((row) => {
    if (!row.changes || typeof row.changes !== "object") return false
    const changes = row.changes as Record<string, unknown>
    return "before" in changes && "after" in changes
  })

  const selected = withBeforeAfter ?? rows[0]
  if (!selected) {
    process.stderr.write(
      `No UPDATE AuditLog rows found for correlationId=${JSON.stringify(correlationId)}\n`
    )
    process.exit(1)
  }

  const payload = {
    correlationId,
    selected,
    count: rows.length,
    sampledAt: new Date().toISOString(),
  }

  const json = JSON.stringify(payload, null, 2) + "\n"
  process.stdout.write(json)

  if (outPathRaw) {
    const outPath = resolve(outPathRaw)
    writeFileSync(outPath, json, "utf8")
  }

  if (hasFlag("--check")) {
    const changes = (selected.changes ?? null) as unknown
    if (!changes || typeof changes !== "object") {
      process.stderr.write("Selected AuditLog row has null/non-object changes.\n")
      process.exit(1)
    }
    const record = changes as Record<string, unknown>
    if (!("correlationId" in record)) {
      process.stderr.write("Selected AuditLog row missing changes.correlationId.\n")
      process.exit(1)
    }
    if (!("before" in record)) {
      process.stderr.write("Selected AuditLog row missing changes.before.\n")
      process.exit(1)
    }
    if (!("after" in record)) {
      process.stderr.write("Selected AuditLog row missing changes.after.\n")
      process.exit(1)
    }
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
