// src/lib/regulatory-truth/watchdog/audit.ts

import { db } from "@/lib/db"
import type { AuditResult } from "@prisma/client"
import type { AuditReport, RuleAuditResult, AuditCheckResult } from "./types"
import { notifyAuditResult } from "./alerting"
import { createHash } from "crypto"
import { normalizeQuotes } from "../utils/quote-normalizer"

/**
 * Hash content for comparison
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

/**
 * Select a random run from the last 7 days
 * Weighted toward recent (50% chance of last 2 days)
 */
async function selectRandomRun(): Promise<Date | null> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  // 50% chance to pick from last 2 days
  const useRecent = Math.random() < 0.5

  const rules = await db.regulatoryRule.findMany({
    where: {
      createdAt: { gte: useRecent ? recentCutoff : cutoff },
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  if (rules.length === 0) return null

  // Get unique dates
  const dateStrings = rules.map((r) => r.createdAt.toISOString().split("T")[0])
  const uniqueDates = Array.from(new Set(dateStrings))
  if (uniqueDates.length === 0) return null

  const randomDate = uniqueDates[Math.floor(Math.random() * uniqueDates.length)] as string
  return new Date(randomDate)
}

/**
 * Select random rules from a run
 */
async function selectRandomRules(runDate: Date, count: number = 5) {
  const startOfDay = new Date(runDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(runDate)
  endOfDay.setHours(23, 59, 59, 999)

  const rules = await db.regulatoryRule.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
    include: {
      sourcePointers: {
        include: {
          evidence: true,
        },
      },
    },
  })

  if (rules.length === 0) return []

  // Shuffle and take count
  const shuffled = rules.sort(() => Math.random() - 0.5)

  // Try to include mix of high/low confidence
  const highConf = shuffled.filter((r) => r.confidence >= 0.9)
  const lowConf = shuffled.filter((r) => r.confidence < 0.9)

  const selected: typeof shuffled = []
  if (highConf.length > 0) selected.push(highConf[0])
  if (lowConf.length > 0) selected.push(lowConf[0])

  // Fill rest randomly
  const remaining = shuffled.filter((r) => !selected.includes(r))
  selected.push(...remaining.slice(0, count - selected.length))

  return selected.slice(0, count)
}

/**
 * Audit a single rule
 */
async function auditRule(
  rule: Awaited<ReturnType<typeof selectRandomRules>>[0]
): Promise<RuleAuditResult> {
  const checks: AuditCheckResult[] = []

  // Check 1: Evidence exists (weight 10)
  const hasEvidence =
    rule.sourcePointers.length > 0 && rule.sourcePointers.some((sp) => sp.evidence)
  checks.push({
    name: "evidence_exists",
    passed: hasEvidence,
    weight: 10,
    details: hasEvidence ? `${rule.sourcePointers.length} source pointers` : "No source pointers",
  })

  if (!hasEvidence) {
    // Can't do other checks without evidence
    return {
      ruleId: rule.id,
      conceptSlug: rule.conceptSlug,
      checks,
      score: 0,
      passed: false,
    }
  }

  const primaryPointer = rule.sourcePointers[0]
  const evidence = primaryPointer.evidence

  // Check 2: Quote in content (weight 8)
  // Normalize both quote and content to handle smart quote variants
  const normalizedQuote = normalizeQuotes(primaryPointer.exactQuote)
  const normalizedContent = evidence?.rawContent ? normalizeQuotes(evidence.rawContent) : ""
  const quoteExists = normalizedContent.includes(normalizedQuote)
  checks.push({
    name: "quote_in_content",
    passed: quoteExists,
    weight: 8,
    details: quoteExists ? "Quote found in content" : "Quote not found in content",
  })

  // Check 3: Content hash matches (weight 7) - skip if no stored hash
  if (evidence?.contentHash) {
    const currentHash = hashContent(evidence.rawContent || "")
    const hashMatches = currentHash === evidence.contentHash
    checks.push({
      name: "content_hash_matches",
      passed: hashMatches,
      weight: 7,
      details: hashMatches ? "Content unchanged" : "Content has changed since extraction",
    })
  }

  // Check 4: URL still accessible (weight 5)
  let urlAccessible = false
  if (evidence?.url) {
    try {
      const response = await fetch(evidence.url, { method: "HEAD" })
      urlAccessible = response.ok
    } catch {
      urlAccessible = false
    }
  }
  checks.push({
    name: "url_still_accessible",
    passed: urlAccessible,
    weight: 5,
    details: urlAccessible ? "URL accessible" : "URL not accessible or 404",
  })

  // Check 5: Dates logical (weight 6)
  const effectiveUntil = rule.effectiveUntil ?? new Date("2100-01-01")
  const datesLogical = rule.effectiveFrom <= effectiveUntil
  checks.push({
    name: "dates_logical",
    passed: datesLogical,
    weight: 6,
    details: datesLogical
      ? `${rule.effectiveFrom.toISOString().split("T")[0]} to ${effectiveUntil.toISOString().split("T")[0]}`
      : "effectiveFrom > effectiveUntil",
  })

  // Check 6: Value extractable (weight 9)
  // Use normalized content for consistent comparison
  const valueInContent = normalizedContent.includes(String(rule.value))
  checks.push({
    name: "value_extractable",
    passed: valueInContent,
    weight: 9,
    details: valueInContent
      ? `Value "${rule.value}" found in content`
      : `Value "${rule.value}" not found`,
  })

  // Calculate score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const passedWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0)
  const score = (passedWeight / totalWeight) * 100

  return {
    ruleId: rule.id,
    conceptSlug: rule.conceptSlug,
    checks,
    score,
    passed: score >= 70,
  }
}

/**
 * Run a random audit
 */
export async function runRandomAudit(): Promise<AuditReport | null> {
  console.log("[audit] Starting random audit...")

  const runDate = await selectRandomRun()
  if (!runDate) {
    console.log("[audit] No rules to audit")
    return null
  }

  console.log(`[audit] Selected run date: ${runDate.toISOString().split("T")[0]}`)

  const rules = await selectRandomRules(runDate, 5)
  if (rules.length === 0) {
    console.log("[audit] No rules found for selected date")
    return null
  }

  console.log(`[audit] Auditing ${rules.length} rules...`)

  const findings: RuleAuditResult[] = []
  for (const rule of rules) {
    const result = await auditRule(rule)
    findings.push(result)
    console.log(
      `[audit] ${rule.conceptSlug}: ${result.score.toFixed(1)}% (${result.passed ? "PASS" : "FAIL"})`
    )
  }

  const rulesPassed = findings.filter((f) => f.passed).length
  const rulesFailed = findings.length - rulesPassed
  const overallScore = findings.reduce((sum, f) => sum + f.score, 0) / findings.length

  let result: AuditResult = "PASS"
  if (overallScore < 70) result = "FAIL"
  else if (overallScore < 90) result = "PARTIAL"

  const report: AuditReport = {
    runDate,
    rulesAudited: findings.length,
    rulesPassed,
    rulesFailed,
    overallScore,
    result,
    findings,
  }

  // Store in database
  await db.watchdogAudit.create({
    data: {
      runDate,
      rulesAudited: report.rulesAudited,
      rulesPassed: report.rulesPassed,
      rulesFailed: report.rulesFailed,
      overallScore: report.overallScore,
      result: report.result,
      findings: report.findings as any,
      alertsRaised: [],
    },
  })

  // Notify
  await notifyAuditResult(report)

  console.log(`[audit] Complete: ${result} (${overallScore.toFixed(1)}%)`)

  return report
}
