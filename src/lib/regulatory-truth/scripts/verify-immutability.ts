// src/lib/regulatory-truth/scripts/verify-immutability.ts
// Verify Evidence immutability: sha256(rawContent) == storedContentHash

import { config } from "dotenv"
config({ path: ".env.local" })

import { Pool } from "pg"
import { createHash } from "crypto"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

interface EvidenceRow {
  id: string
  contentType: string
  contentHash: string
  rawContent: string
}

/**
 * Normalize HTML content (same as content-hash.ts normalizeHtmlContent)
 */
function normalizeHtmlContent(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\b\d{10,13}\b/g, "")
    .replace(/[a-f0-9]{32,}/gi, "")
    .trim()
}

/**
 * Hash content based on type (matching content-hash.ts logic)
 */
function hashContent(content: string, contentType: string): string {
  const isJson =
    contentType.includes("json") ||
    (content.trim().startsWith("{") && content.trim().endsWith("}")) ||
    (content.trim().startsWith("[") && content.trim().endsWith("]"))

  if (isJson) {
    // JSON: raw hash
    return createHash("sha256").update(content).digest("hex")
  }

  // HTML: normalized hash
  const normalized = normalizeHtmlContent(content)
  return createHash("sha256").update(normalized).digest("hex")
}

async function main() {
  const client = await pool.connect()

  try {
    // Get 5 JSON + 5 HTML evidence samples
    const result = await client.query<EvidenceRow>(`
      (
        SELECT id, "contentType", "contentHash", "rawContent"
        FROM "Evidence"
        WHERE "contentType" IN ('json', 'json-ld')
        ORDER BY "fetchedAt" DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT id, "contentType", "contentHash", "rawContent"
        FROM "Evidence"
        WHERE "contentType" = 'html'
        ORDER BY "fetchedAt" DESC
        LIMIT 5
      )
    `)

    console.log("=== EVIDENCE IMMUTABILITY VERIFICATION ===\n")
    console.log("| ID | Type | Stored Hash | Recomputed | Match |")
    console.log("|---|---|---|---|---|")

    let passed = 0
    let failed = 0
    const results: Array<{
      evidenceId: string
      contentType: string
      storedHash: string
      recomputedHash: string
      match: boolean
    }> = []

    for (const row of result.rows) {
      const recomputed = hashContent(row.rawContent, row.contentType)
      const match = recomputed === row.contentHash

      results.push({
        evidenceId: row.id,
        contentType: row.contentType,
        storedHash: row.contentHash,
        recomputedHash: recomputed,
        match,
      })

      console.log(
        `| ${row.id.slice(0, 12)}... | ${row.contentType} | ${row.contentHash.slice(0, 16)}... | ${recomputed.slice(0, 16)}... | ${match ? "✅" : "❌"} |`
      )

      if (match) passed++
      else failed++
    }

    console.log("\n=== SUMMARY ===")
    console.log(`Total: ${result.rows.length}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Pass Rate: ${((passed / result.rows.length) * 100).toFixed(1)}%`)

    // Output JSON for artifact
    console.log("\n=== JSON ARTIFACT ===")
    console.log(JSON.stringify(results, null, 2))

    process.exit(failed > 0 ? 1 : 0)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
