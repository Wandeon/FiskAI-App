# Audit: Traceability Chain (INV-2 / INV-5)

**Generated:** 2025-12-26
**Auditor:** Claude Code (claude-opus-4-5-20251101)
**Scope:** End-to-end traceability guarantees for Regulatory Truth Layer

---

## Executive Summary

This audit examines the traceability chain from SourcePointer → Evidence → Rule → Release. The system implements strong enforcement gates but has **3 identified gaps** that could allow rules to be published with thin/invalid evidence.

| Aspect              | Status         | Notes                              |
| ------------------- | -------------- | ---------------------------------- |
| Schema constraints  | ✅ Strong      | FK relationships enforced          |
| Reviewer gates      | ✅ Strong      | Blocks rules without pointers      |
| Releaser gates      | ✅ Strong      | T0/T1 approval + evidence strength |
| Bypass paths        | ⚠️ 3 gaps      | Scripts, consolidator, admin API   |
| meaningSignature    | ✅ Good        | Prevents semantic duplicates       |
| Violation detection | ✅ Implemented | INV-2 and INV-6 validators         |

---

## Part A: Traceability Chain Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REGULATORY TRUTH TRACEABILITY                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ RegulatorySource│────▶│    Evidence     │◀────│ DiscoveredItem  │
│                 │  1:N│                 │     │   (optional)    │
│  • slug (U)     │     │  • rawContent   │     └─────────────────┘
│  • name         │     │  • contentHash  │
│  • url          │     │  • contentClass │
│  • hierarchy    │     │  • url (U)      │
└─────────────────┘     │  • sourceId FK  │
                        └────────┬────────┘
                                 │
                                 │ 1:N
                                 ▼
                        ┌─────────────────┐
                        │EvidenceArtifact │ (OCR_TEXT, PDF_TEXT, etc.)
                        │  • kind         │
                        │  • content      │
                        │  • contentHash  │
                        └─────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           │                                           │
           ▼                                           ▼
┌─────────────────────┐                    ┌─────────────────────┐
│   SourcePointer     │                    │  ExtractionRejected │
│                     │                    │   (dead letter Q)   │
│  • evidenceId FK    │ (REQUIRED)         │  • evidenceId FK    │
│  • exactQuote       │                    │  • rejectionType    │
│  • extractedValue   │                    │  • rawOutput        │
│  • confidence       │                    └─────────────────────┘
│  • articleNumber    │
│  • domain           │
└──────────┬──────────┘
           │
           │ M:N (implicit join table: _RuleSourcePointers)
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RegulatoryRule                                     │
│                                                                              │
│  REQUIRED FIELDS:                                                           │
│  • conceptSlug           • status (DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED) │
│  • value                 • riskTier (T0, T1, T2, T3)                        │
│  • valueType             • authorityLevel (LAW, GUIDANCE, PROCEDURE, PRACTICE)│
│  • effectiveFrom         • meaningSignature (uniqueness)                    │
│  • appliesWhen (DSL)     • approvedBy (REQUIRED for T0/T1 to publish)       │
│                                                                              │
│  GATES:                                                                      │
│  • T0/T1 require human approvedBy to publish                                │
│  • SINGLE_SOURCE requires LAW authority OR multi-source corroboration       │
│  • meaningSignature prevents semantic duplicates                            │
└────────────────────────────────────────────────────────────────────────────┘
           │
           │ M:N (implicit join table: _ReleaseRules)
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RuleRelease                                     │
│                                                                              │
│  • version (semver, UNIQUE)                                                  │
│  • contentHash (SHA-256 of sorted rule snapshots)                           │
│  • auditTrail JSON:                                                          │
│    - sourceEvidenceCount (count of distinct Evidence records)               │
│    - sourcePointerCount (count of SourcePointer records)                    │
│    - reviewCount (count of REVIEWER agent runs)                             │
│    - humanApprovals (count of rules with approvedBy)                        │
│  • approvedBy[] (list of approver IDs)                                      │
└─────────────────────────────────────────────────────────────────────────────┘

LEGEND:
  FK = Foreign Key (enforced by Prisma/Postgres)
  (U) = Unique constraint
  1:N = One-to-many relationship
  M:N = Many-to-many relationship
```

---

## Part B: Enforcement Checks

### B.1 Composer Agent (src/lib/regulatory-truth/agents/composer.ts)

| Check                         | Location      | Enforcement                                             |
| ----------------------------- | ------------- | ------------------------------------------------------- |
| Blocked domain guard          | Lines 69-79   | Test/synthetic domains blocked from creating rules      |
| Source pointer validation     | Lines 203-237 | Rules MUST have ≥1 source pointer with valid evidenceId |
| Existing pointer verification | Lines 218-236 | Verifies pointers exist in DB before linking            |
| Meaning signature             | Lines 293-299 | Computes hash to prevent semantic duplicates            |

**Code excerpt (critical validation):**

```typescript
// Lines 203-215
if (validSourcePointerIds.length === 0) {
  console.error(`[composer] Cannot create rule without source pointers`)
  return {
    success: false,
    error: `Cannot create rule without source pointers. Rules must be traceable to evidence.`,
  }
}
```

### B.2 Reviewer Agent (src/lib/regulatory-truth/agents/reviewer.ts)

| Check                    | Location               | Enforcement                           |
| ------------------------ | ---------------------- | ------------------------------------- |
| Pointer count check      | Lines 104-114, 229-240 | BLOCKS approval if pointerCount === 0 |
| T0/T1 auto-approve block | Lines 66-73, 241-246   | T0/T1 NEVER auto-approved             |
| Confidence threshold     | Line 249               | ≥0.95 required for T2/T3 auto-approve |

**Code excerpt (invariant):**

```typescript
// Lines 229-240
if (pointerCount === 0) {
  newStatus = "PENDING_REVIEW"
  console.log(`[reviewer] BLOCKED: Rule has 0 source pointers - cannot approve without evidence`)
  break
}
```

### B.3 Releaser Agent (src/lib/regulatory-truth/agents/releaser.ts)

| Check                    | Location      | Enforcement                                         |
| ------------------------ | ------------- | --------------------------------------------------- |
| T0/T1 approval gate      | Lines 116-132 | HARD GATE - blocks if approvedBy missing            |
| Evidence strength policy | Lines 134-151 | SINGLE_SOURCE blocked unless LAW authority          |
| Audit trail capture      | Lines 224-236 | Records evidenceCount, pointerCount, humanApprovals |
| Content hash             | Lines 212-221 | Deterministic hash for reproducibility              |

**Code excerpt (hard gate):**

```typescript
// Lines 116-131
const unapprovedCritical = rules.filter(
  (r) => (r.riskTier === "T0" || r.riskTier === "T1") && !r.approvedBy
)

if (unapprovedCritical.length > 0) {
  return {
    success: false,
    error: `Cannot release T0/T1 rules without approvedBy`,
  }
}
```

### B.4 Health Gates (src/lib/regulatory-truth/utils/health-gates.ts)

| Gate                       | Function                                | Threshold                       |
| -------------------------- | --------------------------------------- | ------------------------------- |
| T0/T1 approval compliance  | `checkT0T1ApprovalCompliance()`         | 0 unapproved (CRITICAL)         |
| Published pointer coverage | `checkSourcePointerCoveragePublished()` | 0 without pointers (CRITICAL)   |
| Draft pointer coverage     | `checkSourcePointerCoverageDraft()`     | <5% without pointers (CRITICAL) |
| Quote validation           | `checkQuoteValidationRate()`            | >5% failure = CRITICAL          |

### B.5 Invariant Validators (src/lib/regulatory-truth/e2e/invariant-validator.ts)

| ID    | Name                     | Validation                              |
| ----- | ------------------------ | --------------------------------------- |
| INV-1 | Evidence Immutability    | contentHash === hashContent(rawContent) |
| INV-2 | Rule Traceability        | Every rule has ≥1 pointer with evidence |
| INV-5 | Release Hash Determinism | Same rules produce same hash            |
| INV-6 | Citation Compliance      | PUBLISHED rules have pointers           |
| INV-8 | T0/T1 Human Approval     | No T0/T1 auto-approved                  |

---

## Part C: Identified Gaps / Bypass Paths

### GAP-1: Admin Approval API (MEDIUM RISK)

**File:** `src/app/api/admin/regulatory-truth/rules/[id]/approve/route.ts`

**Issue:** Admin can approve rules directly without verifying source pointer existence.

```typescript
// Lines 37-44
const updatedRule = await db.regulatoryRule.update({
  where: { id },
  data: {
    status: "APPROVED",
    approvedBy: user.id,
    approvedAt: new Date(),
  },
})
```

**Missing check:** No validation that rule has ≥1 source pointer before approving.

**Impact:** An admin could approve a rule without evidence, bypassing reviewer gates.

**Mitigation:** Add pointer count check before approval.

### GAP-2: Consolidator Merge (LOW RISK)

**File:** `src/lib/regulatory-truth/utils/consolidator.ts`

**Issue:** When merging duplicate rules, pointers are reassigned but the canonical rule's pointer count isn't validated post-merge.

```typescript
// Lines 308-339 (mergeDuplicateRules)
// Disconnect pointers from duplicate, connect to canonical
// No validation that canonical ends up with ≥1 pointer
```

**Impact:** If all pointers are somehow filtered during reassignment, canonical rule could be left with 0 pointers.

**Mitigation:** Add post-merge assertion that canonical has ≥1 pointer.

### GAP-3: Direct Database Access via Scripts

**Files:** Various scripts in `src/lib/regulatory-truth/scripts/`

**Issue:** Scripts using `cliDb` or raw SQL can bypass enforcement gates.

**Examples:**

- `approve-bundle.ts` - Approves rules after status check but no pointer check
- Direct Prisma/SQL updates in maintenance scripts

**Impact:** Operator error during maintenance could publish rules without proper evidence.

**Mitigation:**

- Add invariant check to scripts that modify status
- Run INV-2 validator after any bulk operation

---

## Part D: meaningSignature Uniqueness Logic

**File:** `src/lib/regulatory-truth/utils/meaning-signature.ts`

### Algorithm

```typescript
function computeMeaningSignature(params: {
  conceptSlug: string
  value: string
  valueType: string
  effectiveFrom: Date
  effectiveUntil?: Date | null
}): string {
  const input = [
    conceptSlug,
    value,
    valueType,
    effectiveFrom.toISOString(),
    effectiveUntil?.toISOString() ?? "",
  ].join("|")

  return createHash("md5").update(input).digest("hex")
}
```

### Schema Constraint

```prisma
// RegulatoryRule
@@unique([conceptSlug, effectiveFrom, status])
```

### Analysis

| Aspect            | Finding                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| Collision risk    | MD5 collision is cryptographically unlikely for this use case                   |
| Uniqueness scope  | Signature is stored but NOT enforced by unique constraint                       |
| Silent overwrite  | **NO** - Prisma unique constraint prevents duplicate (slug, date, status)       |
| Conflict workflow | **WORKS** - Multiple DRAFT rules can exist; only one PUBLISHED per (slug, date) |

**Risk:** meaningSignature is computed and stored but not enforced by DB constraint. Two rules with different meaningSignatures but same (conceptSlug, effectiveFrom, PUBLISHED) would violate the unique constraint, which is correct behavior.

**Recommendation:** Consider adding unique index on meaningSignature for explicit enforcement:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_rule_meaning_signature
ON "RegulatoryRule"("meaningSignature")
WHERE status = 'PUBLISHED';
```

---

## Part E: Violation Detection SQL Queries

### Query 1: PUBLISHED Rules Without Source Pointers (INV-2/INV-6)

```sql
-- CRITICAL: Find PUBLISHED rules with no source pointers
SELECT
  r.id,
  r."conceptSlug",
  r.status,
  r."riskTier",
  r."createdAt"
FROM "RegulatoryRule" r
LEFT JOIN "_RuleSourcePointers" rsp ON r.id = rsp."B"
WHERE r.status = 'PUBLISHED'
  AND rsp."A" IS NULL
ORDER BY r."riskTier" ASC, r."createdAt" DESC;
```

### Query 2: Source Pointers Without Valid Evidence

```sql
-- Find source pointers referencing deleted or missing evidence
SELECT
  sp.id AS pointer_id,
  sp.domain,
  sp."extractedValue",
  sp."evidenceId",
  e.id AS evidence_id,
  e."deletedAt"
FROM "SourcePointer" sp
LEFT JOIN "Evidence" e ON sp."evidenceId" = e.id
WHERE e.id IS NULL
   OR e."deletedAt" IS NOT NULL;
```

### Query 3: T0/T1 Rules Approved Without Human Reviewer

```sql
-- T0/T1 rules that reached APPROVED/PUBLISHED without human approval
SELECT
  r.id,
  r."conceptSlug",
  r."riskTier",
  r.status,
  r."approvedBy",
  r."approvedAt"
FROM "RegulatoryRule" r
WHERE r."riskTier" IN ('T0', 'T1')
  AND r.status IN ('APPROVED', 'PUBLISHED')
  AND (r."approvedBy" IS NULL OR r."approvedBy" = 'AUTO_APPROVE_SYSTEM');
```

### Query 4: Releases Without Audit Trail

```sql
-- Releases missing audit trail data
SELECT
  rr.id,
  rr.version,
  rr."releasedAt",
  rr."auditTrail"
FROM "RuleRelease" rr
WHERE rr."auditTrail" IS NULL
   OR (rr."auditTrail"->>'sourcePointerCount')::int = 0
   OR (rr."auditTrail"->>'sourceEvidenceCount')::int = 0;
```

### Query 5: Release Hash Integrity Check

```sql
-- Verify release hash determinism (requires app-level recomputation)
-- This query identifies releases to check
SELECT
  rr.id,
  rr.version,
  rr."contentHash",
  COUNT(r.id) AS rule_count
FROM "RuleRelease" rr
JOIN "_ReleaseRules" lr ON rr.id = lr."A"
JOIN "RegulatoryRule" r ON lr."B" = r.id
GROUP BY rr.id, rr.version, rr."contentHash"
ORDER BY rr."releasedAt" DESC
LIMIT 10;
```

### Query 6: Orphaned Pointers (Not Linked to Any Rule)

```sql
-- Source pointers not linked to any rule (potential extraction waste)
SELECT
  sp.id,
  sp.domain,
  sp."extractedValue",
  sp."createdAt",
  e.url AS evidence_url
FROM "SourcePointer" sp
LEFT JOIN "_RuleSourcePointers" rsp ON sp.id = rsp."A"
LEFT JOIN "Evidence" e ON sp."evidenceId" = e.id
WHERE rsp."B" IS NULL
  AND sp."deletedAt" IS NULL
ORDER BY sp."createdAt" DESC
LIMIT 50;
```

### Query 7: Duplicate Meaning Signatures (Conflict Detection)

```sql
-- Find rules with same meaning signature (potential duplicates)
SELECT
  r1."meaningSignature",
  COUNT(*) AS duplicate_count,
  array_agg(r1.id) AS rule_ids,
  array_agg(r1."conceptSlug") AS concept_slugs,
  array_agg(r1.status) AS statuses
FROM "RegulatoryRule" r1
WHERE r1."meaningSignature" IS NOT NULL
  AND r1.status NOT IN ('REJECTED', 'DEPRECATED')
GROUP BY r1."meaningSignature"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

---

## Recommendations

### Immediate (P0)

1. **Patch GAP-1:** Add pointer count check to admin approval API
   ```typescript
   const pointerCount = await db.sourcePointer.count({
     where: { rules: { some: { id } } },
   })
   if (pointerCount === 0) {
     return NextResponse.json({ error: "Cannot approve rule without evidence" }, { status: 400 })
   }
   ```

### Short-term (P1)

2. **Add post-merge validation to consolidator** to ensure canonical rule has ≥1 pointer
3. **Create CI job** to run violation detection queries after migrations/data operations
4. **Add meaningSignature partial unique index** for explicit enforcement on PUBLISHED rules

### Medium-term (P2)

5. **Add database trigger** to prevent status transition to PUBLISHED if no pointers exist
6. **Create runbook** for safe bulk operations that require invariant checks
7. **Integrate violation queries** into watchdog health checks

---

## Appendix: Related Invariants

| ID    | Name                        | Enforced By                         |
| ----- | --------------------------- | ----------------------------------- |
| INV-1 | Evidence Immutability       | contentHash verification            |
| INV-2 | Rule Traceability           | Composer, Reviewer, Health Gates    |
| INV-3 | No Inference Extraction     | Quote validation in Extractor       |
| INV-4 | Arbiter Conflict Resolution | Arbiter agent with escalation       |
| INV-5 | Release Hash Determinism    | computeReleaseHash()                |
| INV-6 | Citation Compliance         | Health gate, INV-2                  |
| INV-7 | Discovery Idempotency       | Unique constraint (endpointId, url) |
| INV-8 | T0/T1 Human Approval        | Reviewer, Releaser gates            |
