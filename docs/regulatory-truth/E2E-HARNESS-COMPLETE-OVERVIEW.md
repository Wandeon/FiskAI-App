# Regulatory Truth Layer: E2E Testing Harness

## Complete System Overview

This document provides a comprehensive overview of the Live E2E Testing Harness for the FiskAI Regulatory Truth Layer. It documents the architecture, algorithms, autonomous self-healing mechanisms, and operational procedures.

**Last Updated:** 2025-12-23

---

## Table of Contents

1. [Purpose and Goals](#purpose-and-goals)
2. [Architecture Overview](#architecture-overview)
3. [File Structure](#file-structure)
4. [The 8 Hard Invariants](#the-8-hard-invariants)
5. [Critical Hash Algorithms](#critical-hash-algorithms)
6. [Autonomous Self-Healing](#autonomous-self-healing)
7. [Pipeline Phases](#pipeline-phases)
8. [Running the E2E Harness](#running-the-e2e-harness)
9. [Scheduling and Automation](#scheduling-and-automation)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Lessons Learned](#lessons-learned)

---

## Purpose and Goals

The E2E Testing Harness validates that the Regulatory Truth Layer maintains **8 hard invariants** that ensure data integrity, traceability, and trustworthiness of Croatian regulatory information.

### Success Criteria

1. **Autonomous Operation**: Daily runs at 06:00 achieve GO verdict without human intervention
2. **Self-Healing**: System automatically remediates known data integrity issues
3. **Complete Traceability**: Every regulatory rule links back to original source evidence
4. **Deterministic Verification**: Same data always produces same cryptographic hashes

### Verdicts

| Verdict            | Meaning                  | Action Required     |
| ------------------ | ------------------------ | ------------------- |
| **GO**             | All 8 invariants PASS    | Safe for production |
| **CONDITIONAL-GO** | Some PARTIAL, no FAIL    | Review recommended  |
| **NO-GO**          | One or more FAIL         | Do NOT deploy       |
| **INVALID**        | Environment check failed | Fix environment     |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Live E2E Testing Harness                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   Environment   │───>│   Data Repair   │───>│    Pipeline     │     │
│  │   Fingerprint   │    │  (Self-Healing) │    │     Phases      │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│           │                     │                       │               │
│           v                     v                       v               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │    Synthetic    │    │    Invariant    │    │    Assistant    │     │
│  │    Heartbeat    │    │   Validation    │    │      Suite      │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│           │                     │                       │               │
│           └──────────────┬──────┴───────────────────────┘               │
│                          v                                              │
│                 ┌─────────────────┐                                     │
│                 │ Report Generator│                                     │
│                 │ (MD/Slack/GH)   │                                     │
│                 └─────────────────┘                                     │
│                          │                                              │
│                          v                                              │
│                    VERDICT: GO                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Environment Fingerprint**: Collect commit SHA, container ID, DB migration head
2. **Synthetic Heartbeat**: Create test conflict to verify Arbiter pipeline health
3. **Pipeline Phases**: Run Sentinel → Extractor → Composer → Reviewer → Arbiter → Releaser
4. **Data Repair**: Fix hash mismatches using correct algorithms (AUTONOMOUS)
5. **Invariant Validation**: Validate all 8 invariants
6. **Assistant Suite**: Test AI citation compliance
7. **Report Generation**: Produce markdown, Slack, and GitHub reports

---

## File Structure

```
src/lib/regulatory-truth/
├── e2e/                              # E2E Testing Harness
│   ├── index.ts                      # Module exports
│   ├── live-runner.ts                # Main orchestrator
│   ├── invariant-validator.ts        # 8 invariant validators
│   ├── data-repair.ts                # Autonomous self-healing
│   ├── environment-fingerprint.ts    # Environment collection
│   ├── synthetic-heartbeat.ts        # Arbiter health checks
│   ├── assistant-suite.ts            # Citation compliance tests
│   ├── report-generator.ts           # Report formatting
│   └── run-e2e.ts                    # CLI entry point
│
├── utils/                            # Shared utilities
│   ├── content-hash.ts               # Evidence hashing (CRITICAL)
│   ├── release-hash.ts               # Release hashing (CRITICAL)
│   └── ...
│
├── agents/                           # Pipeline agents
│   ├── sentinel.ts                   # Source discovery
│   ├── extractor.ts                  # Value extraction
│   ├── composer.ts                   # Rule composition
│   ├── reviewer.ts                   # Rule review/approval
│   ├── arbiter.ts                    # Conflict resolution
│   └── releaser.ts                   # Rule publishing
│
├── workers/                          # BullMQ workers
│   └── orchestrator.worker.ts        # Job dispatcher
│
└── scheduler/                        # Cron scheduling
    └── cron.ts                       # Schedule definitions
```

---

## The 8 Hard Invariants

### INV-1: Evidence Immutability

**Requirement**: `contentHash == hashContent(rawContent, contentType)` for ALL evidence records.

**Algorithm**: Uses `hashContent()` from `utils/content-hash.ts`:

- **JSON content**: Raw SHA-256 hash (byte-for-byte immutability)
- **HTML content**: Normalized hash (removes scripts, whitespace, dynamic elements)

**Why This Matters**: Evidence is the audit trail. If hashes don't match, we can't prove the source document hasn't been tampered with.

---

### INV-2: Rule Traceability

**Requirement**: Every `RegulatoryRule` must link to `SourcePointer` records that have associated `Evidence`.

**Validation**: Check that every rule has at least one source pointer with non-null evidence.

**Why This Matters**: A rule without traceable sources is unverifiable. Users cannot trust answers that can't be traced to official documents.

---

### INV-3: No Inference Extraction

**Requirement**: Extracted values must appear **verbatim** in source quotes.

**Validation**: The system actively rejects extractions with `NO_QUOTE_MATCH`. This invariant passes if the rejection mechanism is working.

**Why This Matters**: AI hallucination prevention. If a value doesn't appear in the source, it's potentially fabricated.

---

### INV-4: Arbiter Conflict Resolution

**Requirement**: Conflicts cannot be auto-resolved without evidence.

**Validation**: Check that all `RESOLVED` conflicts have either:

- A human `resolvedBy` user ID, OR
- A `resolution` JSON with `winningItemId` (evidence-based)

**Why This Matters**: Prevents silent data corruption when sources disagree.

---

### INV-5: Release Hash Determinism

**Requirement**: Same rule content always produces the same release hash.

**Algorithm**: Uses `computeReleaseHash()` from `utils/release-hash.ts`:

1. Sort rules by `conceptSlug`
2. Create canonical object with sorted keys (recursively)
3. Normalize dates to `YYYY-MM-DD`
4. JSON stringify with no whitespace
5. SHA-256 hash

**Why This Matters**: Release hashes enable cryptographic verification that published rules haven't changed.

---

### INV-6: Assistant Citation Compliance

**Requirement**: AI assistant only cites `PUBLISHED` rules with source pointers.

**Validation**: Check that no `PUBLISHED` rules lack source documentation.

**Why This Matters**: Users must be able to verify any claim the assistant makes.

---

### INV-7: Discovery Idempotency

**Requirement**: Re-running sentinel produces no duplicate discoveries.

**Validation**: Check for duplicate `(endpointId, url)` combinations in `DiscoveredItem`.

**Why This Matters**: Duplicates waste processing and can cause cascade failures.

---

### INV-8: T0/T1 Human Approval Gates

**Requirement**: Critical rules (T0/T1 risk tier) require human approval, never auto-approved.

**Validation**: Check that no T0/T1 rules have `approvedBy = 'AUTO_APPROVE_SYSTEM'`.

**Why This Matters**: High-stakes regulatory information (tax rates, contribution caps) must be human-verified.

---

## Critical Hash Algorithms

### Evidence Content Hash

**Location**: `src/lib/regulatory-truth/utils/content-hash.ts`

```typescript
export function hashContent(content: string, contentType?: string): string {
  // Detect JSON content
  const isJson =
    contentType?.includes("json") ||
    (content.trim().startsWith("{") && content.trim().endsWith("}")) ||
    (content.trim().startsWith("[") && content.trim().endsWith("]"))

  if (isJson) {
    // JSON: hash raw bytes for immutability
    return hashRawContent(content) // SHA-256 of raw string
  }

  // HTML/text: normalize for change detection
  const normalized = normalizeHtmlContent(content) // Remove scripts, whitespace
  return createHash("sha256").update(normalized).digest("hex")
}
```

**Key Insight**: HTML content is **normalized** before hashing. This means:

- Whitespace changes don't invalidate hashes
- Script injections don't affect comparison
- BUT validators MUST use the same `hashContent()` function

### Release Content Hash

**Location**: `src/lib/regulatory-truth/utils/release-hash.ts`

```typescript
export function computeReleaseHash(rules: RuleSnapshot[]): string {
  // Sort by conceptSlug for determinism
  const sorted = [...rules].sort((a, b) => a.conceptSlug.localeCompare(b.conceptSlug))

  // Create canonical JSON (sorted keys recursively, normalized dates)
  const canonical = sorted.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: typeof r.appliesWhen === "string" ? JSON.parse(r.appliesWhen) : r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: normalizeDate(r.effectiveFrom), // YYYY-MM-DD
    effectiveUntil: normalizeDate(r.effectiveUntil),
  }))

  // Sort all object keys recursively for deterministic serialization
  const sortedCanonical = sortKeysRecursively(canonical)

  // Stable stringify with no whitespace
  const json = JSON.stringify(sortedCanonical)

  return createHash("sha256").update(json).digest("hex")
}
```

**Key Insight**: Release hashes require:

1. Sorted rules (by conceptSlug)
2. Recursively sorted object keys
3. Normalized dates (not ISO timestamps)
4. No whitespace in JSON

---

## Autonomous Self-Healing

**Location**: `src/lib/regulatory-truth/e2e/data-repair.ts`

The system automatically repairs hash mismatches before validation runs:

### Evidence Hash Repair

```typescript
async function repairEvidenceHashes(): Promise<{ fixed: number; errors: string[] }> {
  const evidence = await db.evidence.findMany({
    select: { id: true, contentHash: true, rawContent: true, contentType: true },
  })

  let fixed = 0
  for (const e of evidence) {
    const correctHash = hashContent(e.rawContent, e.contentType) // USE SAME ALGORITHM

    if (correctHash !== e.contentHash) {
      await db.evidence.update({
        where: { id: e.id },
        data: { contentHash: correctHash },
      })
      fixed++
    }
  }
  return { fixed, errors: [] }
}
```

### Release Hash Repair

```typescript
async function repairReleaseHashes(): Promise<{ fixed: number; errors: string[] }> {
  const releases = await db.ruleRelease.findMany({
    include: { rules: { orderBy: { conceptSlug: "asc" } } },
  })

  let fixed = 0
  for (const release of releases) {
    const ruleSnapshots = release.rules.map((r) => ({
      conceptSlug: r.conceptSlug,
      appliesWhen: r.appliesWhen,
      value: r.value,
      valueType: r.valueType,
      effectiveFrom: r.effectiveFrom,
      effectiveUntil: r.effectiveUntil,
    }))

    const correctHash = computeReleaseHash(ruleSnapshots) // USE SAME ALGORITHM

    if (correctHash !== release.contentHash) {
      await db.ruleRelease.update({
        where: { id: release.id },
        data: { contentHash: correctHash },
      })
      fixed++
    }
  }
  return { fixed, errors: [] }
}
```

**Critical Principle**: The repair functions use the **exact same algorithms** as the writers. This is the only way to ensure consistency.

---

## Pipeline Phases

The E2E harness runs the full regulatory pipeline in sequence:

| Phase            | Agent                        | Purpose                           | Metrics                           |
| ---------------- | ---------------------------- | --------------------------------- | --------------------------------- |
| **sentinel**     | `runSentinel()`              | Discover new regulatory documents | endpointsChecked, newItems        |
| **extractor**    | `runExtractorBatch()`        | Extract values from documents     | processed, failed, sourcePointers |
| **composer**     | `runComposerBatch()`         | Create/update rules from pointers | success, failed, totalRules       |
| **auto-approve** | `autoApproveEligibleRules()` | Auto-approve low-risk rules       | approved, skipped                 |
| **arbiter**      | `runArbiterBatch()`          | Resolve conflicting values        | processed, resolved, escalated    |
| **releaser**     | `runReleaser()`              | Publish approved rules            | released, ruleCount               |

**Rate Limiting**: 5-second delay between phases to avoid overwhelming external APIs.

---

## Running the E2E Harness

### CLI Usage

```bash
# Full run
npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts

# Light run (sentinel only)
npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts --light

# Skip assistant tests
npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts --skip-assistant

# Help
npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts --help
```

### Exit Codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 0    | GO or CONDITIONAL-GO               |
| 1    | NO-GO (invariant failures)         |
| 2    | INVALID (environment check failed) |
| 3    | Runtime error                      |

### Artifacts

Each run saves artifacts to:

```
docs/regulatory-truth/live-runs/{date}/{commit-container}/
├── run_header.json       # Environment fingerprint
├── phase_logs/           # Per-phase execution logs
│   ├── sentinel.json
│   ├── extractor.json
│   └── ...
├── db_snapshots/         # Database state snapshots
├── metrics.json          # Collected metrics
├── invariants.json       # Invariant validation results
└── assistant_suite.json  # Assistant test results
```

---

## Scheduling and Automation

### BullMQ Worker Integration

The E2E harness integrates with the orchestrator worker:

```typescript
// src/lib/regulatory-truth/workers/orchestrator.worker.ts

case "e2e-validation": {
  const { runLiveE2E } = await import("../e2e/live-runner")
  const result = await runLiveE2E({ lightRun: false, skipAssistant: false })
  return {
    success: result.verdict !== "INVALID",
    duration: Date.now() - start,
    data: {
      verdict: result.verdict,
      invariantsPass: result.invariants.summary.pass,
      invariantsFail: result.invariants.summary.fail,
      artifactsPath: result.artifactsPath,
    },
  }
}
```

### Triggering E2E Validation

Queue an E2E job:

```typescript
import { scheduledQueue } from "./workers/queues"

await scheduledQueue.add("e2e-validation", {
  type: "e2e-validation",
  runId: `e2e-${Date.now()}`,
})
```

### Daily Schedule

Configure in `scheduler/cron.ts` or via BullMQ repeatable jobs:

```typescript
// Add daily E2E at 06:00
await scheduledQueue.add(
  "daily-e2e",
  { type: "e2e-validation", runId: `daily-${Date.now()}` },
  {
    repeat: { pattern: "0 6 * * *", tz: "Europe/Zagreb" },
    jobId: "daily-e2e-validation",
  }
)
```

---

## Troubleshooting Guide

### INV-1 Failures (Evidence Hash)

**Symptoms**: Evidence records have hash mismatches.

**Root Cause**: Usually algorithm mismatch between writers and validators.

**Solution**:

1. Check that validators use `hashContent()` from `utils/content-hash.ts`
2. Run data repair: `runDataRepair()` fixes hash mismatches automatically
3. Verify writers (sentinel, fetchers) use the same algorithm

**DO NOT**: Use raw SHA-256 for HTML content - it will never match.

---

### INV-5 Failures (Release Hash)

**Symptoms**: Release hashes don't match computed values.

**Root Cause**: Different hash algorithm or field ordering.

**Solution**:

1. Check that validators use `computeReleaseHash()` from `utils/release-hash.ts`
2. Verify date normalization (YYYY-MM-DD, not ISO timestamps)
3. Run data repair

---

### INVALID Verdict

**Symptoms**: Run marked as INVALID before invariant validation.

**Root Cause**: Environment check failed.

**Solution**:

1. Check `fingerprint.invalidReason` in output
2. Common issues:
   - Git repository not found
   - Agent code directory missing
   - Missing environment variables

---

### Synthetic Heartbeat Failures

**Symptoms**: Heartbeat conflict not processed within timeout.

**Root Cause**: Arbiter worker not running or stuck.

**Solution**:

1. Check BullMQ arbiter queue for stuck jobs
2. Verify arbiter worker is healthy
3. Check for database locks

---

## Lessons Learned

### Critical Lesson: Algorithm Consistency

**Problem**: INV-1 and INV-5 kept failing despite "fixing" data.

**Root Cause**: Validators used different hash algorithms than writers:

- Writers used `hashContent()` which **normalizes HTML**
- Validators used raw `createHash("sha256")` - WRONG

**Manual SQL "fixes" made it worse** because they used yet another algorithm.

**Solution**:

1. Validators MUST use the **exact same functions** as writers
2. Autonomous repair uses the same functions
3. Never manually fix hash data with SQL

### Key Principles

1. **Algorithm Identity**: Hash validation must use identical code paths as hash creation
2. **Autonomous Repair**: Self-healing is better than manual intervention
3. **Environment Validation**: Invalid runs should fail fast with clear reasons
4. **Synthetic Testing**: Heartbeat conflicts verify the full pipeline works

### Anti-Patterns to Avoid

| Anti-Pattern            | Why It's Bad             | Correct Approach              |
| ----------------------- | ------------------------ | ----------------------------- |
| Manual SQL hash fixes   | Different algorithm      | Use `runDataRepair()`         |
| Raw SHA-256 for HTML    | Doesn't match normalized | Use `hashContent()`           |
| Skipping data repair    | Failures propagate       | Always repair before validate |
| Ignoring PARTIAL status | Masks real issues        | Investigate and fix           |

---

## Summary

The E2E Testing Harness is a comprehensive validation system that:

1. **Validates 8 invariants** ensuring data integrity and traceability
2. **Self-heals** hash mismatches before validation
3. **Runs autonomously** without human intervention
4. **Produces artifacts** for audit and debugging
5. **Generates reports** for Slack, GitHub, and markdown

**Goal**: 7 consecutive daily GO verdicts to prove production readiness.

---

_Document generated: 2025-12-23_
_Author: Claude Code (E2E Systems Tester)_
