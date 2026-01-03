#!/usr/bin/env npx tsx
// scripts/test-pipeline.ts
// End-to-end pipeline test for Croatian Regulatory Truth Layer

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"

// Mock the rate limiter for testing
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface TestResult {
  category: string
  step: string
  success: boolean
  duration: number
  details: Record<string, unknown>
}

const results: TestResult[] = []

async function log(
  category: string,
  step: string,
  success: boolean,
  details: Record<string, unknown>,
  startTime: number
) {
  const duration = Date.now() - startTime
  results.push({ category, step, success, duration, details })
  console.log(`[${category}] ${step}: ${success ? "✅" : "❌"} (${duration}ms)`)
  if (!success && details.error) {
    console.log(`  Error: ${details.error}`)
  }
}

async function testDiscoveryEndpoints() {
  console.log("\n=== STEP 1: DISCOVERY ENDPOINTS ===\n")

  const endpoints = await db.discoveryEndpoint.findMany({
    where: { isActive: true },
    take: 5,
    orderBy: { priority: "asc" },
  })

  console.log(`Found ${endpoints.length} active discovery endpoints:`)
  for (const ep of endpoints) {
    console.log(`  - ${ep.name} (${ep.domain}${ep.path})`)
  }

  return endpoints
}

async function testDiscoveredItems() {
  console.log("\n=== STEP 2: DISCOVERED ITEMS ===\n")

  const items = await db.discoveredItem.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { endpoint: true },
  })

  console.log(`Found ${items.length} recent discovered items:`)
  for (const item of items) {
    console.log(`  - [${item.status}] ${item.title || item.url.slice(0, 60)}...`)
  }

  // Count by status
  const counts = await db.discoveredItem.groupBy({
    by: ["status"],
    _count: true,
  })

  console.log("\nDiscovered items by status:")
  for (const c of counts) {
    console.log(`  ${c.status}: ${c._count}`)
  }

  return items
}

async function testEvidenceRecords() {
  console.log("\n=== STEP 3: EVIDENCE RECORDS ===\n")

  const evidence = await dbReg.evidence.findMany({
    take: 10,
    orderBy: { fetchedAt: "desc" },
    include: { source: true },
  })

  console.log(`Found ${evidence.length} evidence records:`)
  for (const e of evidence) {
    const contentSize = e.rawContent?.length || 0
    console.log(
      `  - [${e.source?.name || "Unknown"}] ${e.url.slice(0, 50)}... (${contentSize} chars)`
    )
  }

  return evidence
}

async function testSourcePointers() {
  console.log("\n=== STEP 4: SOURCE POINTERS (Extraction Results) ===\n")

  const pointers = await db.sourcePointer.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
  })

  console.log(`Found ${pointers.length} source pointers:`)
  for (const p of pointers) {
    console.log(`  - [${p.domain}] ${p.extractedValue?.slice(0, 50)}... (conf: ${p.confidence})`)
    if (p.exactQuote) {
      console.log(`    Quote: "${p.exactQuote.slice(0, 80)}..."`)
    }
  }

  // Group by domain
  const byDomain = await db.sourcePointer.groupBy({
    by: ["domain"],
    _count: true,
  })

  console.log("\nSource pointers by domain:")
  for (const d of byDomain) {
    console.log(`  ${d.domain}: ${d._count}`)
  }

  return pointers
}

async function testRegulatoryRules() {
  console.log("\n=== STEP 5: REGULATORY RULES (Composer Output) ===\n")

  const rules = await db.regulatoryRule.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      sourcePointers: true,
      concept: true,
    },
  })

  console.log(`Found ${rules.length} regulatory rules:`)
  for (const r of rules) {
    console.log(`  - [${r.status}] ${r.conceptSlug} (${r.riskTier}, conf: ${r.confidence})`)
    console.log(`    Title: ${r.titleHr?.slice(0, 60)}...`)
    console.log(`    Value: ${r.value?.slice(0, 40)}...`)
    console.log(`    Sources: ${r.sourcePointers.length} pointers`)
  }

  // Count by status
  const byStatus = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  console.log("\nRules by status:")
  for (const s of byStatus) {
    console.log(`  ${s.status}: ${s._count}`)
  }

  return rules
}

async function testReleases() {
  console.log("\n=== STEP 6: RELEASES (Releaser Output) ===\n")

  const releases = await db.ruleRelease.findMany({
    take: 5,
    orderBy: { releasedAt: "desc" },
    include: {
      rules: true,
    },
  })

  console.log(`Found ${releases.length} releases:`)
  for (const rel of releases) {
    console.log(`  - v${rel.version} (${rel.releaseType}) - ${rel.rules.length} rules`)
    console.log(`    Hash: ${rel.contentHash?.slice(0, 16)}...`)
    console.log(`    Changelog: ${rel.changelogHr?.slice(0, 60)}...`)
  }

  return releases
}

async function testConflicts() {
  console.log("\n=== STEP 7: CONFLICTS (Arbiter Queue) ===\n")

  const conflicts = await db.regulatoryConflict.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  })

  console.log(`Found ${conflicts.length} conflicts:`)
  for (const c of conflicts) {
    console.log(`  - [${c.status}] ${c.conflictType}: ${c.description?.slice(0, 60)}...`)
  }

  return conflicts
}

async function testAgentRuns() {
  console.log("\n=== STEP 8: AGENT RUNS (Processing History) ===\n")

  const runs = await db.agentRun.findMany({
    take: 20,
    orderBy: { startedAt: "desc" },
  })

  console.log(`Found ${runs.length} recent agent runs:`)

  // Group by agent type and status
  const byType = await db.agentRun.groupBy({
    by: ["agentType", "status"],
    _count: true,
    _avg: { durationMs: true },
  })

  console.log("\nAgent runs by type/status:")
  for (const t of byType) {
    console.log(
      `  ${t.agentType} (${t.status}): ${t._count} runs, avg ${Math.round(t._avg.durationMs || 0)}ms`
    )
  }

  return runs
}

async function testAuditLog() {
  console.log("\n=== STEP 9: AUDIT LOG ===\n")

  const logs = await db.auditLog.findMany({
    take: 20,
    orderBy: { timestamp: "desc" },
  })

  console.log(`Found ${logs.length} audit log entries:`)

  // Group by action
  const byAction = await db.auditLog.groupBy({
    by: ["action"],
    _count: true,
  })

  console.log("\nAudit events by action:")
  for (const a of byAction) {
    console.log(`  ${a.action}: ${a._count}`)
  }

  return logs
}

async function testTier1Fetchers() {
  console.log("\n=== STEP 10: TIER 1 STRUCTURED DATA ===\n")

  // Check for HNB exchange rates in rules
  const hnbRules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug: { startsWith: "hnb-exchange-rate" },
    },
    take: 5,
  })

  console.log(`HNB Exchange Rate Rules: ${hnbRules.length}`)
  for (const r of hnbRules) {
    console.log(`  - ${r.conceptSlug}: ${r.value}`)
  }

  // Check for NN metadata evidence
  const nnEvidence = await dbReg.evidence.findMany({
    where: {
      contentType: "json-ld",
    },
    take: 3,
  })

  console.log(`\nNarodne novine JSON-LD Evidence: ${nnEvidence.length}`)

  return { hnbRules, nnEvidence }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗")
  console.log("║   CROATIAN REGULATORY TRUTH LAYER - PIPELINE STATUS REPORT     ║")
  console.log("╚════════════════════════════════════════════════════════════════╝")
  console.log(`\nTimestamp: ${new Date().toISOString()}`)

  try {
    // Run all tests
    await testDiscoveryEndpoints()
    await delay(100)

    await testDiscoveredItems()
    await delay(100)

    await testEvidenceRecords()
    await delay(100)

    await testSourcePointers()
    await delay(100)

    await testRegulatoryRules()
    await delay(100)

    await testReleases()
    await delay(100)

    await testConflicts()
    await delay(100)

    await testAgentRuns()
    await delay(100)

    await testAuditLog()
    await delay(100)

    await testTier1Fetchers()

    // Summary
    console.log("\n" + "═".repeat(70))
    console.log("PIPELINE STATUS SUMMARY")
    console.log("═".repeat(70))

    const endpoints = await db.discoveryEndpoint.count({ where: { isActive: true } })
    const discovered = await db.discoveredItem.count()
    const evidence = await dbReg.evidence.count()
    const pointers = await db.sourcePointer.count()
    const rules = await db.regulatoryRule.count()
    const published = await db.regulatoryRule.count({ where: { status: "PUBLISHED" } })
    const releases = await db.ruleRelease.count()
    const conflicts = await db.regulatoryConflict.count({ where: { status: "OPEN" } })

    console.log(`
┌─────────────────────────────┬─────────┐
│ Metric                      │ Count   │
├─────────────────────────────┼─────────┤
│ Active Discovery Endpoints  │ ${String(endpoints).padStart(7)} │
│ Discovered Items            │ ${String(discovered).padStart(7)} │
│ Evidence Records            │ ${String(evidence).padStart(7)} │
│ Source Pointers             │ ${String(pointers).padStart(7)} │
│ Regulatory Rules            │ ${String(rules).padStart(7)} │
│ Published Rules             │ ${String(published).padStart(7)} │
│ Releases                    │ ${String(releases).padStart(7)} │
│ Open Conflicts              │ ${String(conflicts).padStart(7)} │
└─────────────────────────────┴─────────┘
`)
  } catch (error) {
    console.error("Pipeline test failed:", error)
    process.exit(1)
  }

  process.exit(0)
}

main()
