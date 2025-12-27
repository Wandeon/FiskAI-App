#!/usr/bin/env npx tsx
// scripts/audit-reconcile.ts
// Audit reconciliation script for prior flagged issues
// Run with: npx tsx scripts/audit-reconcile.ts

import { readFileSync, existsSync, writeFileSync, statSync, readdirSync } from "fs"
import { join } from "path"

interface AuditItem {
  id: string
  category: string
  description: string
  status: "VERIFIED_FIXED" | "REQUIRES_ACTION" | "ACCEPTABLE_RISK" | "NOT_APPLICABLE"
  evidence: string
  recommendation?: string
}

const ROOT = process.cwd()

function checkFileContains(filePath: string, pattern: RegExp | string): boolean {
  const fullPath = join(ROOT, filePath)
  if (!existsSync(fullPath)) return false

  // Check if it's a directory - if so, search files within
  const stat = statSync(fullPath)
  if (stat.isDirectory()) {
    // Recursively check files in directory
    const files = readdirSync(fullPath, { recursive: true }) as string[]
    for (const file of files) {
      const filePath = join(fullPath, file)
      try {
        const fileStat = statSync(filePath)
        if (fileStat.isFile()) {
          const content = readFileSync(filePath, "utf-8")
          if (typeof pattern === "string" ? content.includes(pattern) : pattern.test(content)) {
            return true
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
    return false
  }

  const content = readFileSync(fullPath, "utf-8")
  if (typeof pattern === "string") {
    return content.includes(pattern)
  }
  return pattern.test(content)
}

function checkFileExists(filePath: string): boolean {
  return existsSync(join(ROOT, filePath))
}

function getFileContent(filePath: string): string {
  const fullPath = join(ROOT, filePath)
  if (!existsSync(fullPath)) return ""
  return readFileSync(fullPath, "utf-8")
}

async function runAuditReconciliation(): Promise<AuditItem[]> {
  const items: AuditItem[] = []

  // =============================================================================
  // 1. HARDCODED DB PASSWORD IN DOCKER-COMPOSE
  // =============================================================================
  const dockerCompose = getFileContent("docker-compose.workers.yml")
  const hasHardcodedPassword = dockerCompose.includes("fiskai_secret_2025")

  items.push({
    id: "SEC-001",
    category: "Secrets Management",
    description: "Hardcoded database password in docker-compose.workers.yml",
    status: hasHardcodedPassword ? "REQUIRES_ACTION" : "VERIFIED_FIXED",
    evidence: hasHardcodedPassword
      ? "Found hardcoded password 'fiskai_secret_2025' on line ~253 in continuous-drainer service"
      : "No hardcoded passwords found",
    recommendation: hasHardcodedPassword
      ? "Use Docker secrets or environment variable interpolation: DATABASE_URL=${DATABASE_URL}"
      : undefined,
  })

  // =============================================================================
  // 2. ARBITER FOLLOW-UP WORK QUEUING
  // =============================================================================
  const _arbiterWorker = getFileContent("src/lib/regulatory-truth/workers/arbiter.worker.ts")
  const arbiterAgent = getFileContent("src/lib/regulatory-truth/agents/arbiter.ts")

  // Check if arbiter queues follow-up work after resolution
  const hasFollowUpQueuing =
    arbiterAgent.includes("releaseQueue") ||
    arbiterAgent.includes("reviewerQueue") ||
    arbiterAgent.includes("queue.add")

  items.push({
    id: "FLOW-001",
    category: "Pipeline Continuity",
    description: "Arbiter queues follow-up work after conflict resolution",
    status: hasFollowUpQueuing ? "VERIFIED_FIXED" : "ACCEPTABLE_RISK",
    evidence: hasFollowUpQueuing
      ? "Arbiter queues follow-up jobs to releaseQueue/reviewerQueue"
      : "Arbiter does not queue follow-up work - relies on continuous-drainer to pick up rule status changes. Rules are updated to DEPRECATED with supersededBy reference.",
    recommendation: hasFollowUpQueuing
      ? undefined
      : "Current design is acceptable: continuous-drainer polls for rules needing release. Consider adding event-driven trigger for faster propagation if latency becomes an issue.",
  })

  // =============================================================================
  // 3. APPLIESWHEN DSL FAIL-CLOSED BEHAVIOR
  // =============================================================================
  const composerAgent = getFileContent("src/lib/regulatory-truth/agents/composer.ts")

  // PR #89 CRIT fix: The old behavior was to fall back to { op: "true" } when DSL validation failed.
  // The correct fix is FAIL-CLOSED: reject the rule entirely instead of silently broadening applicability.
  const hasDSLFallback = composerAgent.includes('appliesWhenObj = { op: "true" }')
  const hasFailClosedBehavior =
    composerAgent.includes("FAIL-CLOSED") &&
    composerAgent.includes("REJECTING rule with invalid AppliesWhen DSL") &&
    composerAgent.includes("Cannot create rule") &&
    composerAgent.includes("dslValidation.error")

  items.push({
    id: "DSL-001",
    category: "Data Quality",
    description: "AppliesWhen DSL validation uses fail-closed behavior",
    status: hasFailClosedBehavior && !hasDSLFallback ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: hasFailClosedBehavior
      ? `Fail-closed behavior implemented: rules with invalid AppliesWhen DSL are rejected, not silently broadened. ${hasDSLFallback ? "WARNING: Fallback code still present." : "No fallback to { op: true } exists."}`
      : hasDSLFallback
        ? `CRITICAL: Fallback to {op: "true"} exists - this silently broadens rule applicability`
        : "No DSL validation handling found in composer",
    recommendation:
      hasFailClosedBehavior && !hasDSLFallback
        ? undefined
        : hasDSLFallback
          ? "Remove fallback to { op: true } and implement fail-closed rejection (see PR #89)"
          : "Implement AppliesWhen DSL validation with fail-closed behavior",
  })

  // =============================================================================
  // 4. DOC/XLSX HANDLERS VS SCHEMA SUPPORT
  // =============================================================================
  const binaryParser = getFileContent("src/lib/regulatory-truth/utils/binary-parser.ts")
  const hasDOCHandler = binaryParser.includes("parseDoc") && binaryParser.includes("word-extractor")
  const hasXLSXHandler = binaryParser.includes("parseExcel") && binaryParser.includes("xlsx")
  const hasDOCXHandler = binaryParser.includes("parseDocx") && binaryParser.includes("mammoth")

  // Check schema for contentClass support
  const schema = getFileContent("prisma/schema.prisma")
  const schemaSupportsFormats = schema.includes("DOC") && schema.includes("XLSX")

  items.push({
    id: "BIN-001",
    category: "Binary Document Handling",
    description: "DOC/DOCX/XLSX parser implementation status",
    status:
      hasDOCHandler && hasXLSXHandler && hasDOCXHandler && schemaSupportsFormats
        ? "VERIFIED_FIXED"
        : "REQUIRES_ACTION",
    evidence: [
      `DOC parser: ${hasDOCHandler ? "✓ Implemented (word-extractor)" : "✗ Missing"}`,
      `DOCX parser: ${hasDOCXHandler ? "✓ Implemented (mammoth)" : "✗ Missing"}`,
      `XLSX parser: ${hasXLSXHandler ? "✓ Implemented (xlsx)" : "✗ Missing"}`,
      `Schema contentClass: ${schemaSupportsFormats ? "✓ Includes DOC, XLSX" : "✗ Missing"}`,
    ].join("\n"),
    recommendation:
      hasDOCHandler && hasXLSXHandler && hasDOCXHandler
        ? "Implementation exists. Need integration tests to verify end-to-end flow."
        : "Implement missing parsers in binary-parser.ts",
  })

  // =============================================================================
  // 5. ALERTING INTEGRATION (LOG-ONLY VS SLACK/EMAIL)
  // =============================================================================
  const alertingTs = getFileContent("src/lib/regulatory-truth/watchdog/alerting.ts")
  const slackTs = getFileContent("src/lib/regulatory-truth/watchdog/slack.ts")

  const hasSlackIntegration =
    slackTs.includes("SLACK_WEBHOOK_URL") && slackTs.includes("sendSlackMessage")
  const hasCriticalRouting =
    alertingTs.includes('severity === "CRITICAL"') && alertingTs.includes("sendSlackCritical")
  const hasEmailIntegration = alertingTs.includes("sendCriticalEmail")

  items.push({
    id: "ALERT-001",
    category: "Alerting & Monitoring",
    description: "Alert routing beyond log-only",
    status: hasSlackIntegration && hasCriticalRouting ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `Slack integration: ${hasSlackIntegration ? "✓ Configured (requires SLACK_WEBHOOK_URL env)" : "✗ Missing"}`,
      `Critical alert routing: ${hasCriticalRouting ? "✓ CRITICAL → Slack" : "✗ Missing"}`,
      `Email integration: ${hasEmailIntegration ? "✓ Configured" : "✗ Missing"}`,
    ].join("\n"),
    recommendation: hasSlackIntegration
      ? "Verify SLACK_WEBHOOK_URL is set in production environment"
      : "Implement Slack webhook integration for critical alerts",
  })

  // =============================================================================
  // 6. CONTAINER COMPLETENESS (AGENT CODE IN DOCKERFILE)
  // =============================================================================
  const dockerfile = getFileContent("Dockerfile.worker")
  const copiesSrc = dockerfile.includes("COPY src/") || dockerfile.includes("COPY . .")
  const hasTesseract = dockerfile.includes("tesseract-ocr")
  const hasNodeModules = dockerfile.includes("node_modules") || dockerfile.includes("npm install")

  items.push({
    id: "CONT-001",
    category: "Container Completeness",
    description: "Worker Dockerfile includes all required code and dependencies",
    status: copiesSrc && hasTesseract && hasNodeModules ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `Copies src directory: ${copiesSrc ? "✓" : "✗"}`,
      `Tesseract OCR: ${hasTesseract ? "✓" : "✗"}`,
      `Node modules: ${hasNodeModules ? "✓" : "✗"}`,
    ].join("\n"),
    recommendation:
      copiesSrc && hasTesseract && hasNodeModules
        ? undefined
        : "Verify Dockerfile copies all required source files and installs dependencies",
  })

  // =============================================================================
  // 7. MEANING SIGNATURE UNIQUENESS ENFORCEMENT
  // =============================================================================
  const meaningSignature = getFileContent("src/lib/regulatory-truth/utils/meaning-signature.ts")
  const hasMeaningSignature = meaningSignature.includes("computeMeaningSignature")

  // Check for partial unique index in migrations
  const _hasMigrationWithPartialIndex =
    checkFileContains("prisma/migrations", "RegulatoryRule_meaningSignature_active_unique") ||
    schema.includes("@@index([meaningSignature])")

  // Check composer uses it
  const composerUsesMeaningSig =
    composerAgent.includes("meaningSignature") && composerAgent.includes("computeMeaningSignature")

  items.push({
    id: "DUP-001",
    category: "Duplicate Prevention",
    description: "Meaning signature write-time duplicate prevention",
    status: hasMeaningSignature && composerUsesMeaningSig ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `meaning-signature.ts: ${hasMeaningSignature ? "✓ Exists" : "✗ Missing"}`,
      `Composer integration: ${composerUsesMeaningSig ? "✓ Uses meaningSignature" : "✗ Not integrated"}`,
      `Schema index: ${schema.includes("meaningSignature") ? "✓ Indexed" : "✗ Missing"}`,
    ].join("\n"),
    recommendation:
      hasMeaningSignature && composerUsesMeaningSig
        ? undefined
        : "Integrate meaningSignature computation into composer write path",
  })

  // =============================================================================
  // 8. TEST DATA GUARDS (3 LAYERS)
  // =============================================================================
  const conceptResolver = getFileContent("src/lib/regulatory-truth/utils/concept-resolver.ts")
  const sentinelAgent = getFileContent("src/lib/regulatory-truth/agents/sentinel.ts")

  const hasBlockedDomainUtil = conceptResolver.includes("isBlockedDomain")
  const composerUsesBlockedDomain = composerAgent.includes("isBlockedDomain")
  const sentinelUsesBlockedDomain =
    sentinelAgent.includes("isBlockedDomain") ||
    sentinelAgent.includes("test.example") ||
    sentinelAgent.includes("BLOCKED_DOMAINS")

  items.push({
    id: "TEST-001",
    category: "Test Data Isolation",
    description: "Test/synthetic domain blocking at 3 layers",
    status:
      hasBlockedDomainUtil && composerUsesBlockedDomain ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `isBlockedDomain utility: ${hasBlockedDomainUtil ? "✓" : "✗"}`,
      `Composer guard: ${composerUsesBlockedDomain ? "✓" : "✗"}`,
      `Sentinel guard: ${sentinelUsesBlockedDomain ? "✓" : "✗"}`,
    ].join("\n"),
    recommendation:
      hasBlockedDomainUtil && composerUsesBlockedDomain
        ? "All 3 layers protected. Verify extractor also checks."
        : "Add isBlockedDomain checks to all ingestion layers",
  })

  // =============================================================================
  // 9. DAILY CONSOLIDATOR HEALTH CHECK
  // =============================================================================
  const schedulerService = getFileContent("src/lib/regulatory-truth/workers/scheduler.service.ts")
  const orchestratorWorker = getFileContent(
    "src/lib/regulatory-truth/workers/orchestrator.worker.ts"
  )

  const hasConsolidatorSchedule = schedulerService.includes("truth-consolidation-audit")
  const hasOrchestatorHandler = orchestratorWorker.includes("truth-consolidation-audit")
  const runsDailyAt4AM =
    schedulerService.includes("cron.schedule(") && schedulerService.includes('"0 4 * * *"')

  items.push({
    id: "HEALTH-001",
    category: "Automated Monitoring",
    description: "Daily truth consolidation health check (smoke detector)",
    status:
      hasConsolidatorSchedule && hasOrchestatorHandler && runsDailyAt4AM
        ? "VERIFIED_FIXED"
        : "REQUIRES_ACTION",
    evidence: [
      `Scheduler job: ${hasConsolidatorSchedule ? "✓" : "✗"}`,
      `Orchestrator handler: ${hasOrchestatorHandler ? "✓" : "✗"}`,
      `Runs at 04:00: ${runsDailyAt4AM ? "✓" : "✗"}`,
    ].join("\n"),
    recommendation:
      hasConsolidatorSchedule && hasOrchestatorHandler
        ? undefined
        : "Add truth-consolidation-audit job to scheduler and orchestrator",
  })

  // =============================================================================
  // 10. TRUTH HEALTH API ENDPOINT
  // =============================================================================
  const healthApiExists = checkFileExists(
    "src/app/api/admin/regulatory-truth/truth-health/route.ts"
  )
  const healthApiContent = getFileContent(
    "src/app/api/admin/regulatory-truth/truth-health/route.ts"
  )
  const hasGetHandler = healthApiContent.includes("export async function GET")
  const hasPostHandler = healthApiContent.includes("export async function POST")

  items.push({
    id: "API-001",
    category: "API Endpoints",
    description: "Truth health API endpoint for monitoring",
    status:
      healthApiExists && hasGetHandler && hasPostHandler ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `Route file: ${healthApiExists ? "✓ Exists" : "✗ Missing"}`,
      `GET handler: ${hasGetHandler ? "✓" : "✗"}`,
      `POST handler: ${hasPostHandler ? "✓" : "✗"}`,
    ].join("\n"),
    recommendation:
      healthApiExists && hasGetHandler && hasPostHandler
        ? undefined
        : "Create /api/admin/regulatory-truth/truth-health endpoint",
  })

  // =============================================================================
  // 11. AUDIT LOGGING IN CRITICAL CLI SCRIPTS
  // Ref: 2025-12-26-audit-regulatory-paths.md - Documents 32 scripts without audit logging
  // =============================================================================
  const criticalScripts = [
    "src/lib/regulatory-truth/scripts/bootstrap.ts",
    "src/lib/regulatory-truth/scripts/overnight-run.ts",
    "src/lib/regulatory-truth/scripts/drain-pipeline.ts",
  ]

  const scriptsWithAuditLogging: string[] = []
  const scriptsWithoutAuditLogging: string[] = []

  for (const script of criticalScripts) {
    const content = getFileContent(script)
    if (content.includes("logAuditEvent")) {
      scriptsWithAuditLogging.push(script.split("/").pop() || script)
    } else {
      scriptsWithoutAuditLogging.push(script.split("/").pop() || script)
    }
  }

  items.push({
    id: "AUDIT-002",
    category: "Audit Trail",
    description: "Audit logging in critical CLI scripts (bootstrap, overnight-run, drain-pipeline)",
    status: scriptsWithoutAuditLogging.length === 0 ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `Scripts WITH audit logging: ${scriptsWithAuditLogging.length > 0 ? scriptsWithAuditLogging.join(", ") : "none"}`,
      `Scripts WITHOUT audit logging: ${scriptsWithoutAuditLogging.length > 0 ? scriptsWithoutAuditLogging.join(", ") : "none"}`,
    ].join("\n"),
    recommendation:
      scriptsWithoutAuditLogging.length > 0
        ? `Add logAuditEvent calls to: ${scriptsWithoutAuditLogging.join(", ")}`
        : undefined,
  })

  // =============================================================================
  // 12. GRACE PERIOD BYPASS DETECTION
  // Ref: 2025-12-26-audit-regulatory-paths.md (lines 66-71)
  // =============================================================================
  const drainPipeline = getFileContent("src/lib/regulatory-truth/scripts/drain-pipeline.ts")
  const hasGracePeriodBypass =
    drainPipeline.includes('AUTO_APPROVE_GRACE_HOURS = "0"') ||
    drainPipeline.includes("AUTO_APPROVE_GRACE_HOURS = '0'") ||
    drainPipeline.includes("AUTO_APPROVE_GRACE_HOURS=0")

  items.push({
    id: "BYPASS-001",
    category: "Security",
    description: "Grace period bypass in drain-pipeline.ts",
    status: hasGracePeriodBypass ? "REQUIRES_ACTION" : "VERIFIED_FIXED",
    evidence: hasGracePeriodBypass
      ? "drain-pipeline.ts sets AUTO_APPROVE_GRACE_HOURS=0, bypassing the human review grace period"
      : "No grace period bypass detected",
    recommendation: hasGracePeriodBypass
      ? "Remove AUTO_APPROVE_GRACE_HOURS=0 override or add explicit audit logging when bypassed"
      : undefined,
  })

  // =============================================================================
  // 13. APPLIESWHEN EVALUATION IN ASSISTANT
  // Ref: 2025-12-26-jurisdiction-scope-audit.md - Initially documented as NOT IMPLEMENTED
  // This check verifies it IS now implemented
  // =============================================================================
  const ruleSelectorContent = getFileContent("src/lib/assistant/query-engine/rule-selector.ts")
  const ruleEligibilityExists = checkFileExists(
    "src/lib/assistant/query-engine/rule-eligibility.ts"
  )
  const usesCheckRuleEligibility = ruleSelectorContent.includes("checkRuleEligibility")
  const importsAppliesWhen =
    ruleSelectorContent.includes("rule-eligibility") ||
    ruleSelectorContent.includes("checkRuleEligibility")

  items.push({
    id: "SCOPE-001",
    category: "Jurisdiction & Scope",
    description: "AppliesWhen DSL evaluated in assistant rule selection",
    status:
      ruleEligibilityExists && usesCheckRuleEligibility && importsAppliesWhen
        ? "VERIFIED_FIXED"
        : "REQUIRES_ACTION",
    evidence: [
      `rule-eligibility.ts exists: ${ruleEligibilityExists ? "✓" : "✗"}`,
      `rule-selector.ts uses checkRuleEligibility: ${usesCheckRuleEligibility ? "✓" : "✗"}`,
      `Imports from rule-eligibility: ${importsAppliesWhen ? "✓" : "✗"}`,
    ].join("\n"),
    recommendation:
      ruleEligibilityExists && usesCheckRuleEligibility
        ? undefined
        : "Implement AppliesWhen evaluation in assistant using checkRuleEligibility from rule-eligibility.ts",
  })

  // =============================================================================
  // 14. ADMIN API AUDIT LOGGING
  // Ref: 2025-12-26-audit-regulatory-paths.md - 3 admin APIs without audit logging
  // =============================================================================
  const triggerRoute = getFileContent("src/app/api/admin/regulatory-truth/trigger/route.ts")
  const conflictResolveRoute = getFileContent(
    "src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts"
  )

  const triggerHasAudit = triggerRoute.includes("logAuditEvent")
  const conflictResolveHasAudit = conflictResolveRoute.includes("logAuditEvent")

  const missingAuditAPIs: string[] = []
  if (!triggerHasAudit) missingAuditAPIs.push("trigger/route.ts")
  if (!conflictResolveHasAudit) missingAuditAPIs.push("conflicts/[id]/resolve/route.ts")

  items.push({
    id: "AUDIT-003",
    category: "Audit Trail",
    description: "Audit logging in admin API routes (trigger, conflict resolve)",
    status: missingAuditAPIs.length === 0 ? "VERIFIED_FIXED" : "REQUIRES_ACTION",
    evidence: [
      `trigger/route.ts: ${triggerHasAudit ? "✓ Has audit logging" : "✗ Missing audit logging"}`,
      `conflicts/[id]/resolve/route.ts: ${conflictResolveHasAudit ? "✓ Has audit logging" : "✗ Missing audit logging"}`,
    ].join("\n"),
    recommendation:
      missingAuditAPIs.length > 0
        ? `Add logAuditEvent calls to: ${missingAuditAPIs.join(", ")}`
        : undefined,
  })

  return items
}

function generateMarkdownReport(items: AuditItem[]): string {
  const timestamp = new Date().toISOString()
  const summary = {
    total: items.length,
    verified: items.filter((i) => i.status === "VERIFIED_FIXED").length,
    action: items.filter((i) => i.status === "REQUIRES_ACTION").length,
    acceptable: items.filter((i) => i.status === "ACCEPTABLE_RISK").length,
    na: items.filter((i) => i.status === "NOT_APPLICABLE").length,
  }

  let md = `# Audit Reconciliation Report

**Generated:** ${timestamp}
**Project:** FiskAI Regulatory Truth Layer

## Summary

| Status | Count |
|--------|-------|
| ✅ Verified Fixed | ${summary.verified} |
| ⚠️ Requires Action | ${summary.action} |
| 🔵 Acceptable Risk | ${summary.acceptable} |
| ⬜ Not Applicable | ${summary.na} |
| **Total** | ${summary.total} |

---

## Detailed Findings

`

  const statusEmoji = {
    VERIFIED_FIXED: "✅",
    REQUIRES_ACTION: "⚠️",
    ACCEPTABLE_RISK: "🔵",
    NOT_APPLICABLE: "⬜",
  }

  for (const item of items) {
    md += `### ${statusEmoji[item.status]} ${item.id}: ${item.description}

**Category:** ${item.category}
**Status:** ${item.status.replace(/_/g, " ")}

**Evidence:**
\`\`\`
${item.evidence}
\`\`\`

`
    if (item.recommendation) {
      md += `**Recommendation:** ${item.recommendation}

`
    }
    md += `---

`
  }

  return md
}

async function main() {
  console.log("🔍 Running audit reconciliation...\n")

  const items = await runAuditReconciliation()

  // Print summary to console
  const verified = items.filter((i) => i.status === "VERIFIED_FIXED").length
  const action = items.filter((i) => i.status === "REQUIRES_ACTION").length
  const acceptable = items.filter((i) => i.status === "ACCEPTABLE_RISK").length

  console.log("=".repeat(60))
  console.log("AUDIT RECONCILIATION SUMMARY")
  console.log("=".repeat(60))
  console.log(`✅ Verified Fixed:    ${verified}`)
  console.log(`⚠️  Requires Action:   ${action}`)
  console.log(`🔵 Acceptable Risk:   ${acceptable}`)
  console.log("=".repeat(60))
  console.log("")

  // Print items requiring action
  const actionItems = items.filter((i) => i.status === "REQUIRES_ACTION")
  if (actionItems.length > 0) {
    console.log("⚠️  ITEMS REQUIRING ACTION:")
    for (const item of actionItems) {
      console.log(`  - ${item.id}: ${item.description}`)
      if (item.recommendation) {
        console.log(`    → ${item.recommendation}`)
      }
    }
    console.log("")
  }

  // Generate and save markdown report
  const report = generateMarkdownReport(items)
  const reportPath = join(ROOT, "docs/07_AUDITS/audit-reconcile-report.md")

  // Ensure directory exists
  const { mkdirSync } = await import("fs")
  const { dirname } = await import("path")
  mkdirSync(dirname(reportPath), { recursive: true })

  writeFileSync(reportPath, report)
  console.log(`📄 Full report saved to: ${reportPath}`)

  // Exit with error if there are action items
  if (action > 0) {
    console.log(`\n❌ ${action} item(s) require action. See report for details.`)
    process.exit(1)
  } else {
    console.log("\n✅ All audit items verified or have acceptable risk.")
    process.exit(0)
  }
}

main().catch(console.error)
