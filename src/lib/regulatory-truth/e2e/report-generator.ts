// src/lib/regulatory-truth/e2e/report-generator.ts
// Generate daily progress reports for the Regulatory Truth Layer

import { writeFileSync } from "fs"
import { join } from "path"
import type { EnvironmentFingerprint } from "./environment-fingerprint"
import type { InvariantResults, InvariantResult } from "./invariant-validator"
import type { AssistantSuiteResults } from "./assistant-suite"
import type { PhaseResult, RunMetrics } from "./live-runner"

export interface LiveRunReport {
  markdown: string
  summary: string
  verdict: "GO" | "NO-GO" | "CONDITIONAL-GO" | "INVALID"
  timestamp: string
}

interface ReportInput {
  fingerprint: EnvironmentFingerprint
  verdict: "GO" | "NO-GO" | "CONDITIONAL-GO" | "INVALID"
  phases: PhaseResult[]
  invariants: InvariantResults
  metrics: RunMetrics
  assistantSuite: AssistantSuiteResults | null
}

function formatInvariantTable(invariants: InvariantResults): string {
  const rows = Object.values(invariants.results).map((inv: InvariantResult) => {
    const statusIcon = inv.status === "PASS" ? "✅" : inv.status === "FAIL" ? "❌" : "⚠️"
    return `| ${inv.id} | ${inv.name} | ${statusIcon} ${inv.status} |`
  })

  return `| Invariant | Description | Status |
|-----------|-------------|--------|
${rows.join("\n")}`
}

function formatPhaseTable(phases: PhaseResult[]): string {
  if (phases.length === 0) return "*No phases executed*"

  const rows = phases.map((p) => {
    const statusIcon = p.success ? "✅" : "❌"
    const metricsStr = Object.entries(p.metrics)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    return `| ${p.phase} | ${statusIcon} | ${p.duration}ms | ${metricsStr || "-"} |`
  })

  return `| Phase | Status | Duration | Metrics |
|-------|--------|----------|---------|
${rows.join("\n")}`
}

function formatMetricsSummary(metrics: RunMetrics): string {
  return `### Evidence
- New (24h): ${metrics.evidenceFetched.new}
- Total: ${metrics.evidenceFetched.total}
- Idempotency duplicate rate: ${(metrics.idempotencyDuplicateRate * 100).toFixed(2)}%

### Extraction
- Parse failure rate: ${(metrics.extractorParseFailureRate * 100).toFixed(2)}%
- Validation rejection rate: ${(metrics.extractorValidationRejectionRate * 100).toFixed(2)}%
- Quote mismatch rate: ${(metrics.quoteMismatchRate * 100).toFixed(2)}%

### Rules by Status
- Draft: ${metrics.rulesByStatus.draft}
- Pending Review: ${metrics.rulesByStatus.pending}
- Approved: ${metrics.rulesByStatus.approved}
- Published: ${metrics.rulesByStatus.published}

### Rules by Risk Tier
- T0 (Critical): ${metrics.rulesByTier.t0}
- T1 (High): ${metrics.rulesByTier.t1}
- T2 (Medium): ${metrics.rulesByTier.t2}
- T3 (Low): ${metrics.rulesByTier.t3}

### Conflicts
- Total: ${metrics.conflicts.created}
- Resolved: ${metrics.conflicts.resolved}
- Escalated: ${metrics.conflicts.escalated}
- Unresolved >7 days: ${metrics.conflicts.unresolvedOver7Days}

### Releases
- Total: ${metrics.releases.created}
- Hash verified: ${metrics.releases.hashVerified}`
}

function formatAssistantResults(suite: AssistantSuiteResults | null): string {
  if (!suite) return "*Assistant suite not run*"

  return `### Citation Compliance
- Tests run: ${suite.summary.total}
- Passed: ${suite.summary.passed}
- Failed: ${suite.summary.failed}
- Errors: ${suite.summary.errors}

### Metrics
- Citation compliance: ${(suite.citationCompliance * 100).toFixed(1)}%
- Refusal correctness: ${(suite.refusalRate * 100).toFixed(1)}%
- Error rate: ${(suite.errorRate * 100).toFixed(1)}%`
}

function generateSummary(input: ReportInput): string {
  const { verdict, invariants, metrics, assistantSuite } = input
  const passCount = invariants.summary.pass
  const totalInvariants = passCount + invariants.summary.fail + invariants.summary.partial

  let summary = `**${verdict}** - ${passCount}/${totalInvariants} invariants passed`

  if (verdict === "NO-GO") {
    const failures = Object.values(invariants.results)
      .filter((r: InvariantResult) => r.status === "FAIL")
      .map((r: InvariantResult) => r.id)
    summary += ` | FAILURES: ${failures.join(", ")}`
  } else if (verdict === "CONDITIONAL-GO") {
    const partials = Object.values(invariants.results)
      .filter((r: InvariantResult) => r.status === "PARTIAL")
      .map((r: InvariantResult) => r.id)
    summary += ` | PARTIAL: ${partials.join(", ")}`
  }

  if (assistantSuite) {
    summary += ` | Assistant: ${(assistantSuite.citationCompliance * 100).toFixed(0)}% compliance`
  }

  if (metrics.conflicts.unresolvedOver7Days > 0) {
    summary += ` | ⚠️ ${metrics.conflicts.unresolvedOver7Days} conflicts >7 days`
  }

  return summary
}

/**
 * Generate the full markdown report
 */
export function generateReport(input: ReportInput): LiveRunReport {
  const { fingerprint, verdict, phases, invariants, metrics, assistantSuite } = input
  const timestamp = new Date().toISOString()

  const verdictEmoji =
    verdict === "GO"
      ? "🟢"
      : verdict === "NO-GO"
        ? "🔴"
        : verdict === "CONDITIONAL-GO"
          ? "🟡"
          : "⚫"

  const markdown = `# Regulatory Truth Layer - Daily E2E Report

**Date:** ${timestamp.split("T")[0]}
**Time:** ${timestamp.split("T")[1].split(".")[0]} UTC
**Commit:** \`${fingerprint.commitSha}\`
**Container:** ${fingerprint.containerImage || "N/A"}
**DB Migration:** ${fingerprint.dbMigrationHead}

---

## ${verdictEmoji} Verdict: ${verdict}

${generateSummary(input)}

---

## Invariant Results

${formatInvariantTable(invariants)}

---

## Phase Execution

${formatPhaseTable(phases)}

---

## Metrics

${formatMetricsSummary(metrics)}

---

## Assistant Suite

${formatAssistantResults(assistantSuite)}

---

## Environment Fingerprint

| Field | Value |
|-------|-------|
| Commit SHA | \`${fingerprint.commitSha}\` |
| Container | ${fingerprint.containerImage || "N/A"} |
| Container ID | ${fingerprint.containerId || "N/A"} |
| DB Head | ${fingerprint.dbMigrationHead} |
| Env Hash | ${fingerprint.envFingerprint} |
| Agent Code | ${fingerprint.agentCodeExists ? "EXISTS" : "MISSING"} |
| Valid Run | ${fingerprint.isValid ? "YES" : `NO - ${fingerprint.invalidReason}`} |

---

*Report generated: ${timestamp}*
`

  const summary = generateSummary(input)

  return {
    markdown,
    summary,
    verdict,
    timestamp,
  }
}

/**
 * Save report to file
 */
export function saveReport(report: LiveRunReport, basePath: string): string {
  const date = report.timestamp.split("T")[0]
  const filename = `${date}-e2e-report.md`
  const fullPath = join(basePath, filename)

  writeFileSync(fullPath, report.markdown)
  console.log(`[report-generator] Saved report to: ${fullPath}`)

  return fullPath
}

/**
 * Format report for Slack posting
 */
export function formatSlackMessage(report: LiveRunReport): {
  text: string
  blocks: unknown[]
} {
  const verdictEmoji =
    report.verdict === "GO"
      ? ":large_green_circle:"
      : report.verdict === "NO-GO"
        ? ":red_circle:"
        : report.verdict === "CONDITIONAL-GO"
          ? ":large_yellow_circle:"
          : ":black_circle:"

  return {
    text: `Regulatory Truth E2E: ${report.verdict}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${verdictEmoji} Regulatory Truth E2E: ${report.verdict}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: report.summary,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Timestamp:* ${report.timestamp}`,
          },
        ],
      },
    ],
  }
}

/**
 * Format report for GitHub issue/comment
 */
export function formatGitHubComment(report: LiveRunReport): string {
  const verdictEmoji =
    report.verdict === "GO"
      ? "✅"
      : report.verdict === "NO-GO"
        ? "❌"
        : report.verdict === "CONDITIONAL-GO"
          ? "⚠️"
          : "⚫"

  return `## ${verdictEmoji} Daily E2E Report - ${report.timestamp.split("T")[0]}

${report.summary}

<details>
<summary>Full Report</summary>

${report.markdown}

</details>`
}
