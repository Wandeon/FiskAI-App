# RTL Phase 2: Quote Remediation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 35 PENDING_REVIEW rules by addressing the root cause: orphaned source pointers referencing non-existent evidence.

**Architecture:** Clean up orphaned data, then re-run extraction pipeline for affected rules to regenerate valid source pointers with provenance.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, BullMQ

---

## Problem Analysis

### Root Cause Investigation (2026-01-16)

Of 101 NOT_FOUND source pointers blocking 35 rules:

| Category                    | Count | %   | Issue                                              |
| --------------------------- | ----- | --- | -------------------------------------------------- |
| Orphaned (evidence deleted) | 99    | 98% | `evidenceId` points to non-existent evidence       |
| Quote mismatch              | 2     | 2%  | Evidence exists but LLM quote diverges from source |

**Key Finding:** The majority of failures are due to source pointers referencing evidence IDs that no longer exist in the regulatory database. These are orphaned references from a previous evidence cleanup or sync failure.

### Impact Assessment

- **35 rules** stuck in PENDING_REVIEW
- **101 source pointers** failing validation
- **52 unique orphaned evidence IDs** referenced

---

## Solution Design

### Option A: Clean Slate Re-extraction (Recommended)

**Approach:** Delete orphaned pointers, mark affected rules for re-extraction, let the pipeline regenerate everything.

**Pros:**

- Simple, deterministic
- Uses existing pipeline (no new code)
- Ensures all pointers have valid evidence

**Cons:**

- May lose some manually-curated quote selections
- Requires full re-extraction run

### Option B: Evidence Recovery

**Approach:** Try to recover the deleted evidence from backups or re-fetch from sources.

**Pros:**

- Preserves existing pointer selections

**Cons:**

- Evidence may no longer exist at source
- Complex, uncertain success rate
- May recover stale content

**Decision:** Option A - Clean slate is simpler and more reliable.

---

## Implementation Plan

### Task 1: Create Orphan Cleanup Script

**Files:**

- Create: `scripts/cleanup-orphan-pointers.ts`

**Purpose:** Identify and delete source pointers that reference non-existent evidence.

**Steps:**

1. Query all source pointer evidence IDs
2. Check which exist in regulatory evidence table
3. Delete pointers referencing missing evidence
4. Update affected rules to DRAFT status for re-extraction

**Script outline:**

```typescript
// 1. Get all evidence IDs in regulatory DB
const existingEvidence = await dbReg.evidence.findMany({ select: { id: true } })
const validIds = new Set(existingEvidence.map((e) => e.id))

// 2. Find orphaned pointers
const orphanedPointers = await db.sourcePointer.findMany({
  where: { evidenceId: { notIn: [...validIds] } },
})

// 3. Get affected rules
const affectedRules = await db.regulatoryRule.findMany({
  where: { sourcePointers: { some: { id: { in: orphanedPointers.map((p) => p.id) } } } },
})

// 4. Delete orphaned pointers (cascade handled by Prisma)
await db.sourcePointer.deleteMany({
  where: { id: { in: orphanedPointers.map((p) => p.id) } },
})

// 5. Mark affected rules as DRAFT for re-extraction
await db.regulatoryRule.updateMany({
  where: { id: { in: affectedRules.map((r) => r.id) } },
  data: { status: "DRAFT" },
})
```

---

### Task 2: Run Cleanup Script

**Command:**

```bash
npx tsx scripts/cleanup-orphan-pointers.ts --dry-run  # Verify first
npx tsx scripts/cleanup-orphan-pointers.ts            # Execute
```

**Expected outcome:**

- ~99 orphaned pointers deleted
- ~35 rules reset to DRAFT status
- No data loss (orphaned data was invalid anyway)

---

### Task 3: Trigger Re-extraction for Affected Rules

**Approach:** Queue affected rules for the extractor worker to reprocess.

**Option A: Manual queue trigger**

```bash
npx tsx scripts/queue-extraction.ts --rule-ids <comma-separated-ids>
```

**Option B: Mark and let scheduler pick up**
Rules in DRAFT status with existing evidence references will be picked up by the orchestrator.

**Verification:**

```sql
SELECT status, COUNT(*) FROM "RegulatoryRule" GROUP BY status;
```

---

### Task 4: Monitor Re-extraction Progress

**Steps:**

1. Watch extractor worker logs: `docker logs fiskai-worker-extractor -f`
2. Monitor queue depth: `npx tsx scripts/queue-status.ts`
3. Check rule status transitions: DRAFT → PENDING_REVIEW

---

### Task 5: Run Approval Process Again

**Command:**

```bash
npx tsx scripts/run-rule-approval.ts --publish
```

**Expected outcome:**

- All 35 previously-stuck rules now have valid source pointers
- Rules should transition: PENDING_REVIEW → APPROVED → PUBLISHED

---

### Task 6: Validate Final State

**Verification queries:**

```sql
-- Check rule status distribution
SELECT status, COUNT(*) FROM "RegulatoryRule" GROUP BY status;

-- Verify no orphaned pointers remain
SELECT COUNT(*) FROM "SourcePointer" sp
LEFT JOIN regulatory."Evidence" e ON sp."evidenceId" = e.id
WHERE e.id IS NULL;

-- Check provenance validation status
SELECT "matchType", COUNT(*) FROM "SourcePointer" GROUP BY "matchType";
```

**Success criteria:**

- 0 orphaned pointers
- 0 NOT_FOUND match types
- All rules in PUBLISHED or DRAFT (no stuck PENDING_REVIEW)

---

## Risk Mitigation

### Before starting:

1. **Backup database:** `./scripts/backup-database.sh`
2. **Snapshot current state:** Record counts of rules by status

### Rollback plan:

If cleanup causes issues:

1. Restore from backup
2. Investigate specific failures
3. Consider Option B (evidence recovery) for specific cases

---

## Timeline

| Task                          | Duration  |
| ----------------------------- | --------- |
| Task 1: Create cleanup script | 15 min    |
| Task 2: Run cleanup           | 5 min     |
| Task 3: Trigger re-extraction | 10 min    |
| Task 4: Monitor (async)       | 30-60 min |
| Task 5: Run approval          | 10 min    |
| Task 6: Validate              | 10 min    |

**Total active time:** ~1 hour
**Total elapsed time:** ~2 hours (including async extraction)

---

## Success Metrics

- [ ] 0 orphaned source pointers
- [ ] 0 rules stuck in PENDING_REVIEW
- [ ] All valid rules reach PUBLISHED status
- [ ] No regression in existing PUBLISHED rules
