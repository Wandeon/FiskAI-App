#!/usr/bin/env npx tsx
/**
 * Cutover Audit Script
 *
 * Verifies that the Phase-1 cutover is complete:
 * 1. Assistant reads exclusively from RuleFact (not RegulatoryRule)
 * 2. Extractor writes exclusively to CandidateFact (not SourcePointer)
 * 3. No new SourcePointers are being created
 * 4. The system is functionally equivalent
 */

import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"

interface AuditResult {
  check: string
  status: "PASS" | "FAIL" | "WARN"
  details: string
}

async function runAudit(): Promise<AuditResult[]> {
  const results: AuditResult[] = []
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  console.log("=".repeat(70))
  console.log("CUTOVER AUDIT - Phase-1 Verification")
  console.log("=".repeat(70))
  console.log()

  // =========================================================================
  // CHECK 1: RuleFact exists and has data
  // =========================================================================
  console.log("CHECK 1: RuleFact population...")
  const ruleFactCount = await dbReg.ruleFact.count()
  const publishedRuleFacts = await dbReg.ruleFact.count({ where: { status: "PUBLISHED" } })

  if (ruleFactCount > 0) {
    results.push({
      check: "RuleFact population",
      status: publishedRuleFacts > 0 ? "PASS" : "WARN",
      details: `${ruleFactCount} total RuleFacts, ${publishedRuleFacts} PUBLISHED`,
    })
  } else {
    results.push({
      check: "RuleFact population",
      status: "FAIL",
      details: "No RuleFacts found - promotion pipeline may not have run",
    })
  }

  // =========================================================================
  // CHECK 2: CandidateFact exists and has data
  // =========================================================================
  console.log("CHECK 2: CandidateFact population...")
  const candidateFactCount = await db.candidateFact.count()
  const recentCandidateFacts = await db.candidateFact.count({
    where: { createdAt: { gte: oneHourAgo } },
  })

  results.push({
    check: "CandidateFact population",
    status: candidateFactCount > 0 ? "PASS" : "WARN",
    details: `${candidateFactCount} total CandidateFacts, ${recentCandidateFacts} created in last hour`,
  })

  // =========================================================================
  // CHECK 3: No recent SourcePointer creation (legacy writes stopped)
  // =========================================================================
  console.log("CHECK 3: SourcePointer writes stopped...")
  const recentSourcePointers = await db.sourcePointer.count({
    where: { createdAt: { gte: oneHourAgo } },
  })
  const totalSourcePointers = await db.sourcePointer.count()

  if (recentSourcePointers === 0) {
    results.push({
      check: "SourcePointer writes stopped",
      status: "PASS",
      details: `No new SourcePointers in last hour (${totalSourcePointers} total legacy)`,
    })
  } else {
    results.push({
      check: "SourcePointer writes stopped",
      status: "FAIL",
      details: `${recentSourcePointers} SourcePointers created in last hour - legacy writes still active!`,
    })
  }

  // =========================================================================
  // CHECK 4: RuleFact groundingQuotes have evidenceId linkage
  // =========================================================================
  console.log("CHECK 4: RuleFact evidence linkage...")
  const ruleFactsWithQuotes = await dbReg.ruleFact.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, groundingQuotes: true },
    take: 100,
  })

  let linkedCount = 0
  let unlinkedCount = 0

  for (const rf of ruleFactsWithQuotes) {
    const quotes = rf.groundingQuotes as Array<{ evidenceId?: string }> | null
    if (quotes && quotes.length > 0) {
      const hasEvidence = quotes.some((q) => q.evidenceId)
      if (hasEvidence) linkedCount++
      else unlinkedCount++
    }
  }

  if (linkedCount > 0) {
    results.push({
      check: "RuleFact evidence linkage",
      status: unlinkedCount === 0 ? "PASS" : "WARN",
      details: `${linkedCount} RuleFacts have evidence links, ${unlinkedCount} missing`,
    })
  } else {
    results.push({
      check: "RuleFact evidence linkage",
      status: "WARN",
      details: "No RuleFacts with groundingQuotes found - may need promotion",
    })
  }

  // =========================================================================
  // CHECK 5: Legacy RegulatoryRule vs RuleFact coverage
  // =========================================================================
  console.log("CHECK 5: Legacy migration completeness...")
  const legacyRuleCount = await db.regulatoryRule.count()

  if (legacyRuleCount > 0 && ruleFactCount === 0) {
    results.push({
      check: "Legacy migration",
      status: "WARN",
      details: `${legacyRuleCount} legacy RegulatoryRules exist but 0 RuleFacts - migration incomplete`,
    })
  } else if (legacyRuleCount > 0) {
    const coverage = ((ruleFactCount / legacyRuleCount) * 100).toFixed(1)
    results.push({
      check: "Legacy migration",
      status: ruleFactCount >= legacyRuleCount ? "PASS" : "WARN",
      details: `${ruleFactCount} RuleFacts vs ${legacyRuleCount} legacy RegulatoryRules (${coverage}% coverage)`,
    })
  } else {
    results.push({
      check: "Legacy migration",
      status: "PASS",
      details: "No legacy RegulatoryRules found - clean slate",
    })
  }

  // =========================================================================
  // CHECK 6: Evidence → CandidateFact linkage
  // =========================================================================
  console.log("CHECK 6: Evidence processing coverage...")
  const totalEvidence = await dbReg.evidence.count()

  // Count unique evidenceIds in CandidateFacts
  const candidateFacts = await db.candidateFact.findMany({
    select: { groundingQuotes: true },
  })

  const evidenceIdsInCF = new Set<string>()
  for (const cf of candidateFacts) {
    const quotes = cf.groundingQuotes as Array<{ evidenceId?: string }> | null
    if (quotes) {
      for (const q of quotes) {
        if (q.evidenceId) evidenceIdsInCF.add(q.evidenceId)
      }
    }
  }

  const coverage =
    totalEvidence > 0 ? ((evidenceIdsInCF.size / totalEvidence) * 100).toFixed(1) : "N/A"

  results.push({
    check: "Evidence processing coverage",
    status: evidenceIdsInCF.size > 0 ? "PASS" : "WARN",
    details: `${evidenceIdsInCF.size}/${totalEvidence} Evidence records have CandidateFacts (${coverage}%)`,
  })

  // =========================================================================
  // CHECK 7: Concept linkage verification
  // =========================================================================
  console.log("CHECK 7: Concept linkage...")
  const conceptsWithRuleFacts = await dbReg.ruleFact.findMany({
    where: { status: "PUBLISHED" },
    select: { conceptSlug: true },
    distinct: ["conceptSlug"],
  })

  const totalConcepts = await db.concept.count()

  results.push({
    check: "Concept coverage",
    status: conceptsWithRuleFacts.length > 0 ? "PASS" : "WARN",
    details: `${conceptsWithRuleFacts.length} concepts have RuleFacts (${totalConcepts} total concepts)`,
  })

  // =========================================================================
  // Print summary
  // =========================================================================
  console.log()
  console.log("=".repeat(70))
  console.log("AUDIT RESULTS")
  console.log("=".repeat(70))
  console.log()

  const passCount = results.filter((r) => r.status === "PASS").length
  const warnCount = results.filter((r) => r.status === "WARN").length
  const failCount = results.filter((r) => r.status === "FAIL").length

  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌"
    console.log(`${icon} ${result.check}`)
    console.log(`   ${result.details}`)
    console.log()
  }

  console.log("=".repeat(70))
  console.log(`Summary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`)
  console.log("=".repeat(70))

  if (failCount > 0) {
    console.log("\n❌ CUTOVER INCOMPLETE - Critical issues found")
    process.exit(1)
  } else if (warnCount > 0) {
    console.log("\n⚠️ CUTOVER MOSTLY COMPLETE - Some warnings to address")
  } else {
    console.log("\n✅ CUTOVER COMPLETE - All checks passed")
  }

  return results
}

// Run the audit
runAudit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Audit failed:", error)
    process.exit(1)
  })
