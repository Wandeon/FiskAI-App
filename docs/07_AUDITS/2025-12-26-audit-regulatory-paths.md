# Audit Report: Non-Standard and Emergency Regulatory Truth Paths

**Date:** 2025-12-26
**Auditor:** AI Audit System
**Scope:** CLI scripts, backfills, migrations, admin APIs, consolidator/repair scripts
**Verdict:** FAIL - Critical gaps in audit logging and health gate enforcement

---

## Executive Summary

This audit examined all non-standard paths that can modify regulatory truth data.
**35 CLI scripts** and **12 admin API routes** were analyzed.

**Critical Finding:** Multiple emergency and maintenance scripts can modify truth data without audit logging, bypassing the traceability requirements essential for legal defense (RTL-009).

| Category           | Total | With Audit Logging | Without Audit Logging |
| ------------------ | ----- | ------------------ | --------------------- |
| CLI Scripts        | 35    | 3                  | 32                    |
| Admin APIs (write) | 8     | 5                  | 3                     |
| Agents             | 7     | 7                  | 0                     |

---

## 1. Unsafe or Weakly-Guarded Paths

### 1.1 CRITICAL - Scripts Without Audit Logging

| Script                          | Path                                    | Risk         | Operations                                                          |
| ------------------------------- | --------------------------------------- | ------------ | ------------------------------------------------------------------- |
| `bootstrap.ts`                  | `scripts/bootstrap.ts`                  | **CRITICAL** | Seeds sources, creates evidence, approves rules, publishes releases |
| `overnight-run.ts`              | `scripts/overnight-run.ts`              | **CRITICAL** | Full pipeline execution, auto-approves rules, creates releases      |
| `drain-pipeline.ts`             | `scripts/drain-pipeline.ts`             | **CRITICAL** | Bypasses grace period, auto-approves rules, releases                |
| `data-repair.ts`                | `e2e/data-repair.ts`                    | **HIGH**     | Modifies Evidence.contentHash and RuleRelease.contentHash           |
| `cleanup-duplicate-evidence.ts` | `scripts/cleanup-duplicate-evidence.ts` | **HIGH**     | DELETES Evidence records, migrates pointers                         |
| `cleanup-stuck-runs.ts`         | `scripts/cleanup-stuck-runs.ts`         | **MEDIUM**   | Marks agent runs as failed                                          |
| `migrate-applieswhen-dsl.ts`    | `scripts/migrate-applieswhen-dsl.ts`    | **HIGH**     | Modifies RegulatoryRule.appliesWhen                                 |
| `baseline-backfill.ts`          | `scripts/baseline-backfill.ts`          | **MEDIUM**   | Creates Evidence and DiscoveredItem records                         |
| `backfill-content-class.ts`     | `scripts/backfill-content-class.ts`     | **MEDIUM**   | Modifies Evidence.contentClass                                      |
| `backfill-concepts.ts`          | `scripts/backfill-concepts.ts`          | **MEDIUM**   | Links rules to concepts                                             |

### 1.2 CRITICAL - Admin APIs Without Audit Logging

| API Route                                            | Method | Risk         | Operations                                                          |
| ---------------------------------------------------- | ------ | ------------ | ------------------------------------------------------------------- |
| `/api/admin/regulatory-truth/trigger`                | POST   | **CRITICAL** | Triggers full pipeline (discovery, extraction, composition, review) |
| `/api/admin/regulatory-truth/conflicts/[id]/resolve` | POST   | **HIGH**     | Resolves conflicts, deprecates rules, no audit trail                |
| `/api/admin/regulatory-truth/truth-health`           | POST   | **MEDIUM**   | Creates health snapshots                                            |

### 1.3 Scripts WITH Proper Audit Logging (Reference)

These scripts correctly implement audit logging:

- `approve-bundle.ts` - Logs RULE_APPROVED, RULE_REJECTED
- `consolidator.ts` - Logs RULE_MERGED, RULE_REJECTED_TEST_DATA, CONCEPT_MERGED
- All agents (sentinel, composer, reviewer, arbiter, releaser)

---

## 2. Health Gate Bypass Vulnerabilities

### 2.1 Grace Period Bypass in drain-pipeline.ts

**File:** `src/lib/regulatory-truth/scripts/drain-pipeline.ts:119-134`

```typescript
// Phase 3.5: Auto-approve eligible T2/T3 rules
// First, reduce grace period for initial drain
const originalGrace = process.env.AUTO_APPROVE_GRACE_HOURS
process.env.AUTO_APPROVE_GRACE_HOURS = "0" // No grace period for drain  <-- BYPASS
```

**Issue:** This bypasses the configured grace period for auto-approval, potentially approving rules before human review.

### 2.2 Missing Pointer Validation in Bootstrap

**File:** `src/lib/regulatory-truth/scripts/bootstrap.ts`

The bootstrap script calls `runReleaser()` without validating that rules have proper source pointers, potentially publishing rules that violate RTL-009 (all rules must be evidence-backed).

### 2.3 Direct Database Modifications in Backfill Scripts

Scripts like `backfill-content-class.ts` and `migrate-applieswhen-dsl.ts` modify data directly without:

- Pre-modification snapshots
- Rollback capability
- Validation against business rules

---

## 3. Emergency Tooling Degradation Analysis

### 3.1 Temporary Scripts Becoming Permanent

| Script                          | Created For                | Status        | Degradation Risk                     |
| ------------------------------- | -------------------------- | ------------- | ------------------------------------ |
| `cleanup-duplicate-evidence.ts` | One-time deduplication     | No expiration | Could be re-run accidentally         |
| `migrate-applieswhen-dsl.ts`    | DSL format migration       | No expiration | Could corrupt already-migrated data  |
| `backfill-content-class.ts`     | Content classification fix | No expiration | Could re-apply fixes to correct data |

**Recommendation:** Add idempotency guards or expiration dates to one-time scripts.

### 3.2 Missing Audit Actions in Type System

**File:** `src/lib/regulatory-truth/utils/audit-log.ts:6-17`

The `AuditAction` type is incomplete:

```typescript
export type AuditAction = "RULE_CREATED" | "RULE_APPROVED" | "RULE_REJECTED" | "RULE_PUBLISHED"
// ... missing:
// | "RULE_MERGED"           (used by consolidator but not typed)
// | "RULE_DELETED"          (used by check-pointers but not typed)
// | "EVIDENCE_MODIFIED"     (not used)
// | "EVIDENCE_DELETED"      (not used)
// | "PIPELINE_TRIGGERED"    (not used)
// | "DATA_REPAIRED"         (not used)
```

---

## 4. Traceability Gaps (Who, When, Why)

### 4.1 Missing "Who" Attribution

| Component               | Issue                              |
| ----------------------- | ---------------------------------- |
| `bootstrap.ts`          | Uses "SYSTEM" but no human context |
| `overnight-run.ts`      | No attribution at all              |
| `drain-pipeline.ts`     | No attribution at all              |
| `cleanup-stuck-runs.ts` | No attribution at all              |
| `data-repair.ts`        | No attribution at all              |

### 4.2 Missing "Why" Context

Most scripts lack structured reason logging. Examples:

```typescript
// data-repair.ts - No reason logged
await db.evidence.update({
  where: { id: e.id },
  data: { contentHash: correctHash }, // Why was this changed?
})
```

```typescript
// cleanup-stuck-runs.ts - Reason in error field but not in audit log
await db.agentRun.update({
  data: {
    status: "failed",
    error: `Marked as failed: stuck in running state for ${runningMinutes} minutes`,
    // No audit log entry created
  },
})
```

---

## 5. Unverifiable State Risks

### 5.1 Evidence Hash Modification

**File:** `src/lib/regulatory-truth/e2e/data-repair.ts:27-35`

```typescript
// This changes the immutable hash without verification
await db.evidence.update({
  where: { id: e.id },
  data: { contentHash: correctHash },
})
```

**Issue:** Evidence is supposed to be immutable. Changing `contentHash` could make existing SourcePointer references invalid without detection.

### 5.2 Cascade Delete of Evidence Artifacts

**File:** `prisma/migrations/20251224_add_ocr_support/migration.sql`

```sql
ALTER TABLE "EvidenceArtifact" ADD CONSTRAINT "EvidenceArtifact_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**Issue:** Deleting Evidence cascades to artifacts, potentially losing OCR data without audit trail.

---

## 6. Remediation Plan

### 6.1 IMMEDIATE (P0) - Add Audit Logging to Critical Paths

| File                              | Action                                          | Priority |
| --------------------------------- | ----------------------------------------------- | -------- |
| `bootstrap.ts`                    | Add logAuditEvent for each phase                | P0       |
| `overnight-run.ts`                | Add logAuditEvent for pipeline start/completion | P0       |
| `drain-pipeline.ts`               | Add logAuditEvent, remove grace period bypass   | P0       |
| `trigger/route.ts`                | Add logAuditEvent with user context             | P0       |
| `conflicts/[id]/resolve/route.ts` | Add logAuditEvent for resolution                | P0       |

### 6.2 HIGH (P1) - Add Audit Logging to Maintenance Scripts

| File                            | Action                                     | Priority |
| ------------------------------- | ------------------------------------------ | -------- |
| `data-repair.ts`                | Log DATA_REPAIRED with before/after hashes | P1       |
| `cleanup-duplicate-evidence.ts` | Log EVIDENCE_DELETED                       | P1       |
| `cleanup-stuck-runs.ts`         | Log AGENT_RUN_CLEANUP                      | P1       |
| `migrate-applieswhen-dsl.ts`    | Log RULE_MODIFIED                          | P1       |
| `backfill-content-class.ts`     | Log EVIDENCE_MODIFIED                      | P1       |

### 6.3 MEDIUM (P2) - Structural Improvements

1. **Expand AuditAction type** to include all actions used in codebase
2. **Add idempotency guards** to one-time migration scripts
3. **Create pre-execution snapshots** for destructive operations
4. **Add --audit-user flag** to CLI scripts for attribution
5. **Remove grace period bypass** from drain-pipeline.ts

### 6.4 LOW (P3) - Long-term Improvements

1. Create centralized audit logging middleware for all admin APIs
2. Implement audit log integrity verification (hash chain)
3. Add expiration dates to temporary scripts
4. Create rollback procedures for each script type

---

## 7. Verification Tests

The following should be verified after remediation:

```bash
# Check all scripts import logAuditEvent
grep -rL "logAuditEvent" src/lib/regulatory-truth/scripts/*.ts | wc -l
# Should be 0

# Check all admin API POST routes log audit events
grep -rL "logAuditEvent" src/app/api/admin/regulatory-truth/**/route.ts | grep POST
# Should be 0

# Verify no grace period bypasses remain
grep -r "AUTO_APPROVE_GRACE_HOURS.*=.*0" src/
# Should be 0
```

---

## 8. Verdict

**FAIL** - This audit identifies critical gaps in audit logging and health gate enforcement:

1. **11 scripts** can modify truth data without audit logging
2. **3 admin API routes** lack audit logging for destructive operations
3. **1 script** (drain-pipeline.ts) explicitly bypasses health gates
4. **Multiple scripts** can leave the system in an unverifiable state

**Immediate action required** to implement P0 remediations before next production deployment.

---

## Appendix A: Complete Script Inventory

### Scripts WITH Audit Logging (3/35)

- `approve-bundle.ts`
- `run-consolidator.ts` (via consolidator.ts)

### Agents WITH Audit Logging (7/7)

- `sentinel.ts`
- `extractor.ts` (via composer/reviewer)
- `composer.ts`
- `reviewer.ts`
- `arbiter.ts`
- `releaser.ts`
- `knowledge-graph.ts`

### Scripts WITHOUT Audit Logging (32/35)

- `bootstrap.ts`
- `overnight-run.ts`
- `drain-pipeline.ts`
- `monitor.ts`
- `run-sentinel.ts`
- `run-extractor.ts`
- `run-composer.ts`
- `run-reviewer.ts`
- `run-arbiter.ts`
- `run-releaser.ts`
- `generate-review-bundle.ts`
- `seed-sources.ts`
- `seed-endpoints.ts`
- `baseline-backfill.ts`
- `backfill-concepts.ts`
- `backfill-content-class.ts`
- `migrate-applieswhen-dsl.ts`
- `cleanup-stuck-runs.ts`
- `check-duplicates.ts`
- `verify-immutability.ts`
- `verify-fiscal-data.ts`
- `test-sitemap-scanner.ts`
- `test-content-cleaner.ts`
- `coverage-report.ts`
- `queue-status.ts`
- `trigger-pipeline.ts`
- `trigger-full-pipeline.ts`
- `trigger-arbiter.ts`
- `cleanup-duplicate-evidence.ts`
- `check-conflicts.ts`
- `test-pipeline.ts`
- `test-single-extraction.ts`
