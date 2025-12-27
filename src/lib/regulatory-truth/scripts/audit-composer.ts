#!/usr/bin/env npx tsx
/**
 * AUDIT 4: Composer Stage Audit
 *
 * Validates that composed RegulatoryRules correctly synthesize SourcePointers
 * into accurate, non-conflicting rules.
 *
 * Usage:
 *   npx tsx src/lib/regulatory-truth/scripts/audit-composer.ts
 */

import { db } from "@/lib/db"

interface AuditResult {
  check: string
  status: "PASS" | "WARN" | "FAIL"
  details: string
  data?: unknown
}

const results: AuditResult[] = []

function log(result: AuditResult) {
  const icon = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌"
  console.log(`\n${icon} [${result.status}] ${result.check}`)
  console.log(`   ${result.details}`)
  if (result.data) {
    console.log(`   Data:`, JSON.stringify(result.data, null, 2).split("\n").map(l => `   ${l}`).join("\n"))
  }
  results.push(result)
}

async function auditRuleStatus() {
  console.log("\n" + "=".repeat(60))
  console.log("1. RULE STATUS DISTRIBUTION")
  console.log("=".repeat(60))

  const statusCounts = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  console.log("\nStatus Distribution:")
  for (const s of statusCounts) {
    console.log(`  ${s.status}: ${s._count}`)
  }

  const draftCount = statusCounts.find(s => s.status === "DRAFT")?._count || 0
  const publishedCount = statusCounts.find(s => s.status === "PUBLISHED")?._count || 0
  const approvedCount = statusCounts.find(s => s.status === "APPROVED")?._count || 0

  log({
    check: "Rule status distribution",
    status: publishedCount > 0 || approvedCount > 0 ? "PASS" : "WARN",
    details: `DRAFT: ${draftCount}, APPROVED: ${approvedCount}, PUBLISHED: ${publishedCount}`,
    data: statusCounts,
  })

  return statusCounts
}

async function auditRiskTierDistribution() {
  console.log("\n" + "=".repeat(60))
  console.log("2. RISK TIER DISTRIBUTION")
  console.log("=".repeat(60))

  const tierStats = await db.regulatoryRule.groupBy({
    by: ["riskTier"],
    _count: true,
  })

  // Get average explanation length per tier
  const rules = await db.regulatoryRule.findMany({
    select: { riskTier: true, explanationHr: true },
  })

  const tierAvgLen: Record<string, { count: number; totalLen: number }> = {}
  for (const r of rules) {
    if (!tierAvgLen[r.riskTier]) tierAvgLen[r.riskTier] = { count: 0, totalLen: 0 }
    tierAvgLen[r.riskTier].count++
    tierAvgLen[r.riskTier].totalLen += r.explanationHr?.length || 0
  }

  console.log("\nRisk Tier Distribution:")
  for (const t of tierStats) {
    const avgLen = tierAvgLen[t.riskTier]?.totalLen / tierAvgLen[t.riskTier]?.count || 0
    console.log(`  ${t.riskTier}: ${t._count} rules, avg explanation len: ${avgLen.toFixed(0)} chars`)
  }

  const t0Count = tierStats.find(t => t.riskTier === "T0")?._count || 0
  const t3Count = tierStats.find(t => t.riskTier === "T3")?._count || 0

  log({
    check: "Risk tier distribution",
    status: t0Count > 0 ? "PASS" : "WARN",
    details: `T0 (critical): ${t0Count}, T3 (low impact): ${t3Count}`,
    data: tierStats,
  })

  return tierStats
}

async function auditRulePointerLinkage() {
  console.log("\n" + "=".repeat(60))
  console.log("3. RULE-POINTER LINKAGE")
  console.log("=".repeat(60))

  // Find rules with no source pointers
  const rulesWithPointers = await db.regulatoryRule.findMany({
    select: {
      id: true,
      conceptSlug: true,
      value: true,
      status: true,
      sourcePointers: { select: { id: true } },
    },
  })

  const rulesWithNoPointers = rulesWithPointers.filter(r => r.sourcePointers.length === 0)
  const singlePointerRules = rulesWithPointers.filter(r => r.sourcePointers.length === 1)
  const multiPointerRules = rulesWithPointers.filter(r => r.sourcePointers.length > 1)

  console.log("\nPointer Linkage Stats:")
  console.log(`  Rules with 0 pointers: ${rulesWithNoPointers.length}`)
  console.log(`  Rules with 1 pointer: ${singlePointerRules.length}`)
  console.log(`  Rules with 2+ pointers: ${multiPointerRules.length}`)

  if (rulesWithNoPointers.length > 0) {
    console.log("\n  Rules missing source pointers:")
    for (const r of rulesWithNoPointers.slice(0, 10)) {
      console.log(`    - ${r.id}: ${r.conceptSlug} (${r.status})`)
    }
    if (rulesWithNoPointers.length > 10) {
      console.log(`    ... and ${rulesWithNoPointers.length - 10} more`)
    }
  }

  log({
    check: "Rule-pointer linkage",
    status: rulesWithNoPointers.length === 0 ? "PASS" : "FAIL",
    details: `${rulesWithNoPointers.length} rules have no source pointers (orphaned rules)`,
    data: { noPointers: rulesWithNoPointers.length, singlePointer: singlePointerRules.length, multiPointer: multiPointerRules.length },
  })

  return { rulesWithNoPointers, singlePointerRules, multiPointerRules }
}

async function auditConceptResolution() {
  console.log("\n" + "=".repeat(60))
  console.log("4. CONCEPT RESOLUTION")
  console.log("=".repeat(60))

  // Check concept slug conventions
  const rules = await db.regulatoryRule.findMany({
    select: { id: true, conceptSlug: true },
  })

  const kebabCaseRegex = /^[a-z0-9-]+$/
  const nonKebabCase = rules.filter(r => !kebabCaseRegex.test(r.conceptSlug))

  console.log("\nConcept Slug Convention:")
  console.log(`  Total rules: ${rules.length}`)
  console.log(`  Following kebab-case: ${rules.length - nonKebabCase.length}`)
  console.log(`  Not kebab-case: ${nonKebabCase.length}`)

  if (nonKebabCase.length > 0) {
    console.log("\n  Non-kebab-case slugs:")
    for (const r of nonKebabCase.slice(0, 10)) {
      console.log(`    - ${r.conceptSlug}`)
    }
  }

  // Check for orphaned concepts (concepts with no rules)
  const concepts = await db.concept.findMany({
    select: {
      id: true,
      slug: true,
      _count: { select: { rules: true } },
    },
  })

  const orphanedConcepts = concepts.filter(c => c._count.rules === 0)

  console.log(`\n  Total concepts: ${concepts.length}`)
  console.log(`  Orphaned concepts (no rules): ${orphanedConcepts.length}`)

  log({
    check: "Concept resolution",
    status: nonKebabCase.length === 0 ? "PASS" : "WARN",
    details: `${nonKebabCase.length} slugs not following kebab-case convention`,
    data: { nonKebabCase: nonKebabCase.slice(0, 5).map(r => r.conceptSlug), orphanedConcepts: orphanedConcepts.length },
  })

  return { nonKebabCase, orphanedConcepts }
}

async function auditValueConsistency() {
  console.log("\n" + "=".repeat(60))
  console.log("5. VALUE CONSISTENCY (Sample 5 rules)")
  console.log("=".repeat(60))

  // Get 5 rules with their source pointers
  const sampleRules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED", "DRAFT"] },
    },
    include: {
      sourcePointers: {
        include: {
          evidence: { select: { rawContent: true, domain: true } },
        },
      },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  })

  let consistentCount = 0
  let inconsistentCount = 0

  for (const rule of sampleRules) {
    console.log(`\n  Rule: ${rule.conceptSlug}`)
    console.log(`    Value: ${rule.value} (${rule.valueType})`)
    console.log(`    Dates: ${rule.effectiveFrom?.toISOString().split("T")[0]} - ${rule.effectiveUntil?.toISOString().split("T")[0] || "ongoing"}`)
    console.log(`    Source Pointers: ${rule.sourcePointers.length}`)

    // Check each pointer's extracted value matches rule value
    const pointerValues = rule.sourcePointers.map(sp => sp.extractedValue)
    const allMatch = pointerValues.every(pv => pv === rule.value)

    if (allMatch) {
      console.log(`    ✓ All pointer values match rule value`)
      consistentCount++
    } else {
      console.log(`    ✗ Pointer values mismatch:`)
      for (const sp of rule.sourcePointers) {
        console.log(`      - ${sp.extractedValue} (from ${sp.domain})`)
      }
      inconsistentCount++
    }
  }

  log({
    check: "Value consistency (sample)",
    status: inconsistentCount === 0 ? "PASS" : "WARN",
    details: `${consistentCount}/5 rules have consistent pointer values`,
    data: { consistent: consistentCount, inconsistent: inconsistentCount },
  })

  return { consistentCount, inconsistentCount }
}

async function auditConflictDetection() {
  console.log("\n" + "=".repeat(60))
  console.log("6. CONFLICT DETECTION")
  console.log("=".repeat(60))

  const conflictStats = await db.regulatoryConflict.groupBy({
    by: ["status", "conflictType"],
    _count: true,
  })

  console.log("\nConflict Status Distribution:")
  for (const c of conflictStats) {
    console.log(`  ${c.status} - ${c.conflictType}: ${c._count}`)
  }

  const openConflicts = conflictStats.filter(c => c.status === "OPEN")
  const totalOpen = openConflicts.reduce((sum, c) => sum + c._count, 0)

  // Get sample of open conflicts
  const sampleOpenConflicts = await db.regulatoryConflict.findMany({
    where: { status: "OPEN" },
    include: {
      itemA: { select: { id: true, conceptSlug: true, value: true } },
      itemB: { select: { id: true, conceptSlug: true, value: true } },
    },
    take: 5,
  })

  if (sampleOpenConflicts.length > 0) {
    console.log("\n  Sample OPEN Conflicts:")
    for (const c of sampleOpenConflicts) {
      console.log(`    [${c.conflictType}] ${c.id}`)
      if (c.itemA) console.log(`      Rule A: ${c.itemA.conceptSlug} = ${c.itemA.value}`)
      if (c.itemB) console.log(`      Rule B: ${c.itemB.conceptSlug} = ${c.itemB.value}`)
      console.log(`      Desc: ${c.description?.substring(0, 80)}...`)
    }
  }

  log({
    check: "Conflict detection",
    status: totalOpen === 0 ? "PASS" : "WARN",
    details: `${totalOpen} open conflicts pending resolution`,
    data: conflictStats,
  })

  return conflictStats
}

async function auditAppliesWhenValidation() {
  console.log("\n" + "=".repeat(60))
  console.log("7. APPLIES-WHEN DSL VALIDATION")
  console.log("=".repeat(60))

  const rules = await db.regulatoryRule.findMany({
    select: { id: true, conceptSlug: true, appliesWhen: true },
    where: { status: { in: ["PUBLISHED", "APPROVED", "DRAFT"] } },
  })

  let validDsl = 0
  let invalidDsl = 0
  let alwaysTrue = 0
  const invalidRules: { id: string; slug: string; dsl: string }[] = []

  for (const rule of rules) {
    if (!rule.appliesWhen) {
      invalidDsl++
      invalidRules.push({ id: rule.id, slug: rule.conceptSlug, dsl: "null" })
      continue
    }

    try {
      const parsed = JSON.parse(rule.appliesWhen)
      if (parsed.op === "true" || parsed.always === true) {
        alwaysTrue++
      }
      if (parsed.op?.includes("INVALID")) {
        invalidDsl++
        invalidRules.push({ id: rule.id, slug: rule.conceptSlug, dsl: rule.appliesWhen })
      } else {
        validDsl++
      }
    } catch {
      invalidDsl++
      invalidRules.push({ id: rule.id, slug: rule.conceptSlug, dsl: rule.appliesWhen })
    }
  }

  console.log("\nAppliesWhen DSL Stats:")
  console.log(`  Total rules: ${rules.length}`)
  console.log(`  Valid DSL: ${validDsl}`)
  console.log(`  Invalid DSL: ${invalidDsl}`)
  console.log(`  Always-true: ${alwaysTrue}`)

  if (invalidRules.length > 0) {
    console.log("\n  Invalid DSL rules:")
    for (const r of invalidRules.slice(0, 5)) {
      console.log(`    - ${r.slug}: ${r.dsl.substring(0, 50)}...`)
    }
  }

  log({
    check: "AppliesWhen DSL validation",
    status: invalidDsl === 0 ? "PASS" : "FAIL",
    details: `${invalidDsl}/${rules.length} rules have invalid DSL conditions`,
    data: { valid: validDsl, invalid: invalidDsl, alwaysTrue },
  })

  return { validDsl, invalidDsl, alwaysTrue, invalidRules }
}

async function auditMeaningSignatures() {
  console.log("\n" + "=".repeat(60))
  console.log("8. MEANING SIGNATURE UNIQUENESS")
  console.log("=".repeat(60))

  const rules = await db.regulatoryRule.findMany({
    where: { status: { in: ["PUBLISHED", "APPROVED"] } },
    select: { id: true, conceptSlug: true, meaningSignature: true, value: true },
  })

  const sigMap = new Map<string, typeof rules>()
  let nullSigs = 0

  for (const r of rules) {
    if (!r.meaningSignature) {
      nullSigs++
      continue
    }
    if (!sigMap.has(r.meaningSignature)) sigMap.set(r.meaningSignature, [])
    sigMap.get(r.meaningSignature)!.push(r)
  }

  const duplicateSigs = [...sigMap.entries()].filter(([, rules]) => rules.length > 1)

  console.log("\nMeaning Signature Stats:")
  console.log(`  Total published/approved rules: ${rules.length}`)
  console.log(`  Null signatures: ${nullSigs}`)
  console.log(`  Unique signatures: ${sigMap.size}`)
  console.log(`  Duplicate signature groups: ${duplicateSigs.length}`)

  if (duplicateSigs.length > 0) {
    console.log("\n  Duplicate signatures:")
    for (const [sig, dupeRules] of duplicateSigs.slice(0, 5)) {
      console.log(`    Signature: ${sig.substring(0, 16)}...`)
      for (const r of dupeRules) {
        console.log(`      - ${r.conceptSlug} = ${r.value}`)
      }
    }
  }

  log({
    check: "Meaning signature uniqueness",
    status: duplicateSigs.length === 0 && nullSigs === 0 ? "PASS" : duplicateSigs.length > 0 ? "FAIL" : "WARN",
    details: `${duplicateSigs.length} duplicate signatures, ${nullSigs} null signatures`,
    data: { unique: sigMap.size, duplicates: duplicateSigs.length, nulls: nullSigs },
  })

  return { duplicateSigs, nullSigs }
}

async function auditSpecificTestCases() {
  console.log("\n" + "=".repeat(60))
  console.log("9. SPECIFIC TEST CASES")
  console.log("=".repeat(60))

  // Test Case 1: Find a T0 rule (pausalni threshold)
  console.log("\n[Test 1] Find T0 rule (pausalni threshold)")
  const t0Rule = await db.regulatoryRule.findFirst({
    where: {
      riskTier: "T0",
      conceptSlug: { contains: "pausalni" },
    },
    include: {
      sourcePointers: {
        include: {
          evidence: { select: { domain: true } },
        },
      },
    },
  })

  if (t0Rule) {
    console.log(`  Found: ${t0Rule.conceptSlug}`)
    console.log(`  Value: ${t0Rule.value}`)
    console.log(`  Sources: ${t0Rule.sourcePointers.map(sp => sp.evidence?.domain).join(", ")}`)
    log({
      check: "T0 pausalni threshold rule",
      status: "PASS",
      details: `Found T0 rule: ${t0Rule.conceptSlug} = ${t0Rule.value}`,
    })
  } else {
    console.log(`  Not found`)
    log({
      check: "T0 pausalni threshold rule",
      status: "WARN",
      details: "No T0 pausalni rule found in database",
    })
  }

  // Test Case 2: Find rule with 3+ source pointers
  console.log("\n[Test 2] Find rule with 3+ SourcePointers")
  const multiSourceRule = await db.regulatoryRule.findFirst({
    where: {
      sourcePointers: { some: {} },
    },
    include: {
      sourcePointers: {
        select: { id: true, extractedValue: true, domain: true },
      },
    },
    orderBy: {
      sourcePointers: { _count: "desc" },
    },
  })

  if (multiSourceRule && multiSourceRule.sourcePointers.length >= 3) {
    const values = multiSourceRule.sourcePointers.map(sp => sp.extractedValue)
    const allAgree = values.every(v => v === multiSourceRule.value)

    console.log(`  Found: ${multiSourceRule.conceptSlug}`)
    console.log(`  Rule Value: ${multiSourceRule.value}`)
    console.log(`  Source Pointer Values:`)
    for (const sp of multiSourceRule.sourcePointers) {
      console.log(`    - ${sp.extractedValue} (${sp.domain})`)
    }
    console.log(`  All agree: ${allAgree ? "YES" : "NO"}`)

    log({
      check: "Multi-source rule agreement",
      status: allAgree ? "PASS" : "FAIL",
      details: `Rule ${multiSourceRule.conceptSlug} has ${multiSourceRule.sourcePointers.length} sources, all agree: ${allAgree}`,
    })
  } else {
    console.log(`  No rule with 3+ sources found`)
    log({
      check: "Multi-source rule agreement",
      status: "WARN",
      details: "No rule with 3+ source pointers found",
    })
  }

  // Test Case 3: Find an OPEN conflict
  console.log("\n[Test 3] Find OPEN conflict and verify")
  const openConflict = await db.regulatoryConflict.findFirst({
    where: { status: "OPEN" },
    include: {
      itemA: { select: { id: true, conceptSlug: true, value: true } },
      itemB: { select: { id: true, conceptSlug: true, value: true } },
    },
  })

  if (openConflict) {
    console.log(`  Conflict ID: ${openConflict.id}`)
    console.log(`  Type: ${openConflict.conflictType}`)
    console.log(`  Description: ${openConflict.description}`)
    if (openConflict.itemA) console.log(`  Rule A: ${openConflict.itemA.conceptSlug} = ${openConflict.itemA.value}`)
    if (openConflict.itemB) console.log(`  Rule B: ${openConflict.itemB.conceptSlug} = ${openConflict.itemB.value}`)

    log({
      check: "Open conflict verification",
      status: "WARN",
      details: `Found OPEN ${openConflict.conflictType} conflict: ${openConflict.id}`,
    })
  } else {
    console.log(`  No OPEN conflicts found`)
    log({
      check: "Open conflict verification",
      status: "PASS",
      details: "No unresolved conflicts in the system",
    })
  }
}

async function auditConsistencyCheck() {
  console.log("\n" + "=".repeat(60))
  console.log("10. CONSISTENCY CHECK (3 PUBLISHED rules)")
  console.log("=".repeat(60))

  const publishedRules = await db.regulatoryRule.findMany({
    where: { status: { in: ["PUBLISHED", "APPROVED"] } },
    include: {
      sourcePointers: {
        include: {
          evidence: {
            select: { id: true, rawContent: true, domain: true },
          },
        },
      },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  })

  if (publishedRules.length === 0) {
    console.log("\n  No PUBLISHED or APPROVED rules found")
    log({
      check: "Consistency check",
      status: "WARN",
      details: "No published rules to verify",
    })
    return
  }

  let passCount = 0

  for (const rule of publishedRules) {
    console.log(`\n  Rule: ${rule.conceptSlug}`)
    console.log(`  Value: ${rule.value} (${rule.valueType})`)
    console.log(`  Explanation (HR): ${rule.explanationHr?.substring(0, 100)}...`)

    // Check all source pointers
    console.log(`  Source Pointers (${rule.sourcePointers.length}):`)
    let derivable = true

    for (const sp of rule.sourcePointers) {
      console.log(`    - Evidence ${sp.evidenceId}:`)
      console.log(`      Domain: ${sp.domain}`)
      console.log(`      Extracted: ${sp.extractedValue}`)
      console.log(`      Quote: ${sp.exactQuote?.substring(0, 80)}...`)

      // Check if rule value matches extracted value
      if (sp.extractedValue !== rule.value) {
        console.log(`      ⚠️ Extracted value differs from rule value!`)
        derivable = false
      }
    }

    // Check if explanation contains only sourced information
    const hasUnsourcedInfo = rule.explanationHr?.includes("hallucinated") ||
                            rule.explanationHr?.includes("hypothetical")

    if (hasUnsourcedInfo) {
      console.log(`    ⚠️ Explanation may contain unsourced information`)
      derivable = false
    }

    if (derivable) {
      console.log(`  ✓ Rule value is derivable from sources`)
      passCount++
    } else {
      console.log(`  ✗ Consistency issue detected`)
    }
  }

  log({
    check: "Consistency check (3 rules)",
    status: passCount === publishedRules.length ? "PASS" : "WARN",
    details: `${passCount}/${publishedRules.length} rules have consistent values with sources`,
  })
}

async function generateSummary() {
  console.log("\n" + "=".repeat(60))
  console.log("AUDIT SUMMARY")
  console.log("=".repeat(60))

  const passCount = results.filter(r => r.status === "PASS").length
  const warnCount = results.filter(r => r.status === "WARN").length
  const failCount = results.filter(r => r.status === "FAIL").length

  console.log(`\n  PASS: ${passCount}`)
  console.log(`  WARN: ${warnCount}`)
  console.log(`  FAIL: ${failCount}`)

  if (failCount > 0) {
    console.log("\n  Failed Checks:")
    for (const r of results.filter(r => r.status === "FAIL")) {
      console.log(`    ❌ ${r.check}: ${r.details}`)
    }
  }

  if (warnCount > 0) {
    console.log("\n  Warnings:")
    for (const r of results.filter(r => r.status === "WARN")) {
      console.log(`    ⚠️ ${r.check}: ${r.details}`)
    }
  }

  const overallStatus = failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS"
  console.log(`\n  OVERALL STATUS: ${overallStatus}`)

  return { passCount, warnCount, failCount, overallStatus, results }
}

async function main() {
  console.log("=" .repeat(60))
  console.log("AUDIT 4: COMPOSER STAGE AUDIT")
  console.log("Regulatory Truth System - Rule Composition Validation")
  console.log("=" .repeat(60))
  console.log(`\nAudit started: ${new Date().toISOString()}`)

  try {
    await auditRuleStatus()
    await auditRiskTierDistribution()
    await auditRulePointerLinkage()
    await auditConceptResolution()
    await auditValueConsistency()
    await auditConflictDetection()
    await auditAppliesWhenValidation()
    await auditMeaningSignatures()
    await auditSpecificTestCases()
    await auditConsistencyCheck()

    const summary = await generateSummary()

    console.log(`\nAudit completed: ${new Date().toISOString()}`)

    await db.$disconnect()

    process.exit(summary.overallStatus === "FAIL" ? 1 : 0)
  } catch (error) {
    console.error("\nAudit failed with error:", error)
    await db.$disconnect()
    process.exit(1)
  }
}

main()
