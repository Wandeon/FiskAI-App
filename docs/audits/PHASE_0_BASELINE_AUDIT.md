# Phase 0: Baseline Truth Audit

**Date:** 2026-01-07
**Auditor:** Claude (Bridge & Cutover Engineer)
**Purpose:** Establish exact state before bridge implementation

---

## Summary of Critical Findings

| Finding                      | Severity | Impact                                                    |
| ---------------------------- | -------- | --------------------------------------------------------- |
| Evidence split-brain         | CRITICAL | Two Evidence tables with referential integrity issues     |
| Phase-1 models orphaned      | HIGH     | CandidateFact, RuleFact exist in DB but not in Prisma     |
| public.Evidence schema drift | HIGH     | Table exists in DB but removed from Prisma                |
| SourcePointer FK violation   | MEDIUM   | References both Evidence tables (soft ref, no constraint) |

---

## Section 1: Entity Row Counts

### Production Tables (Active)

| Schema     | Table          | Row Count | In Prisma?       | Production Write?      | Production Read?           |
| ---------- | -------------- | --------- | ---------------- | ---------------------- | -------------------------- |
| public     | RegulatoryRule | 615       | YES              | YES (composer.ts:379)  | YES (rule-selector.ts:131) |
| public     | SourcePointer  | 2,177     | YES              | YES (extractor.ts:278) | YES (via rule include)     |
| public     | Concept        | 480       | YES              | YES                    | YES                        |
| public     | Evidence       | 2,022     | **NO** (removed) | NO (legacy)            | NO                         |
| regulatory | Evidence       | 169       | YES              | YES (fetchers)         | YES (extractor.ts:110)     |

### Phase-1 Tables (Empty)

| Schema     | Table         | Row Count | In Prisma? | Write Path | Read Path |
| ---------- | ------------- | --------- | ---------- | ---------- | --------- |
| public     | CandidateFact | 0         | **NO**     | None       | None      |
| public     | AtomicClaim   | 0         | **NO**     | None       | None      |
| regulatory | RuleFact      | 0         | **NO**     | None       | None      |

---

## Section 2: Evidence Split-Brain Analysis

### The Problem

SourcePointers reference **BOTH** Evidence tables via soft reference (no FK constraint):

```sql
-- Query results:
References public.Evidence     | 1,995
References regulatory.Evidence |   182
Orphaned (no match)            |     0
```

### Timeline of Divergence

| Date                     | Evidence Table      | SourcePointer Count |
| ------------------------ | ------------------- | ------------------- |
| 2025-12-21 to 2025-12-25 | public.Evidence     | 1,995               |
| 2026-01-06               | regulatory.Evidence | 182                 |

### Root Cause

1. **Original design:** Evidence lived in `public` schema, managed by `prisma/schema.prisma`
2. **Migration:** Evidence was moved to `regulatory` schema in `prisma/regulatory.prisma`
3. **Schema drift:** `public.Evidence` was removed from `schema.prisma` but table remained in DB
4. **Fetchers updated:** Now write to `dbReg.evidence` (regulatory.Evidence)
5. **Result:** Historical SourcePointers still reference old `public.Evidence` IDs

### Current Write Paths

**Fetchers (create Evidence):**

```typescript
// src/lib/regulatory-truth/fetchers/hnb-fetcher.ts:133
const evidence = await dbReg.evidence.create({...})  // regulatory.Evidence
```

**Extractor (reads Evidence, creates SourcePointer):**

```typescript
// src/lib/regulatory-truth/agents/extractor.ts:110
const evidence = await dbReg.evidence.findUnique({...})  // regulatory.Evidence

// src/lib/regulatory-truth/agents/extractor.ts:278
const pointer = await db.sourcePointer.create({
  data: {
    evidenceId: evidence.id,  // References regulatory.Evidence
    ...
  }
})
```

---

## Section 3: Prisma Schema Drift

### Tables in DB but NOT in Prisma

| Table         | Database Location    | Prisma Location    | Status   |
| ------------- | -------------------- | ------------------ | -------- |
| Evidence      | public.Evidence      | **NONE** (removed) | ORPHANED |
| CandidateFact | public.CandidateFact | **NONE**           | ORPHANED |
| AtomicClaim   | public.AtomicClaim   | **NONE**           | ORPHANED |
| RuleFact      | regulatory.RuleFact  | **NONE**           | ORPHANED |

### Prisma File Inventory

| File                       | Tables Defined                                     | Evidence Model?         |
| -------------------------- | -------------------------------------------------- | ----------------------- |
| `prisma/schema.prisma`     | SourcePointer, RegulatoryRule, Concept, etc.       | NO                      |
| `prisma/regulatory.prisma` | RegulatorySource, Evidence, EvidenceArtifact, etc. | YES (regulatory schema) |

### Verification Commands

```bash
# Check for Evidence in schema.prisma
grep -c "model Evidence" prisma/schema.prisma
# Result: 0

# Check for Evidence in regulatory.prisma
grep -c "model Evidence" prisma/regulatory.prisma
# Result: 1 (in regulatory schema)
```

---

## Section 4: Write Path Mapping

### SourcePointer Writes (PRODUCTION ACTIVE)

| File                                               | Function         | Line | Target                      | Active? |
| -------------------------------------------------- | ---------------- | ---- | --------------------------- | ------- |
| `src/lib/regulatory-truth/agents/extractor.ts`     | `runExtractor()` | 278  | `db.sourcePointer.create()` | **YES** |
| `src/lib/regulatory-truth/fetchers/hnb-fetcher.ts` | N/A              | N/A  | SKIPPED (domain leakage)    | NO      |

### RegulatoryRule Writes (PRODUCTION ACTIVE)

| File                                               | Function           | Line | Target                       | Active? |
| -------------------------------------------------- | ------------------ | ---- | ---------------------------- | ------- |
| `src/lib/regulatory-truth/agents/composer.ts`      | `runComposer()`    | 379  | `db.regulatoryRule.create()` | **YES** |
| `src/lib/regulatory-truth/fetchers/hnb-fetcher.ts` | `createHNBRules()` | ~180 | `db.regulatoryRule.create()` | **YES** |

### Evidence Writes (PRODUCTION ACTIVE)

| File                                                  | Function           | Line    | Target                    | Active? |
| ----------------------------------------------------- | ------------------ | ------- | ------------------------- | ------- |
| `src/lib/regulatory-truth/fetchers/hnb-fetcher.ts`    | `createHNBRules()` | 133     | `dbReg.evidence.create()` | **YES** |
| `src/lib/regulatory-truth/fetchers/eurlex-fetcher.ts` | `fetchEurLex()`    | ~168    | `dbReg.evidence.create()` | **YES** |
| `src/lib/regulatory-truth/fetchers/mrms-fetcher.ts`   | Various            | Various | `dbReg.evidence.create()` | **YES** |

### CandidateFact Writes

**NONE** - No production code writes to CandidateFact

### RuleFact Writes

**NONE** - No production code writes to RuleFact

---

## Section 5: Read Path Mapping

### Assistant Query Path (ONLY PATH TO ANSWERS)

```typescript
// src/lib/assistant/query-engine/rule-selector.ts:131-140
const allRulesRaw = await prisma.regulatoryRule.findMany({
  where: {
    conceptSlug: { in: conceptSlugs },
    status: "PUBLISHED",
  },
  include: {
    sourcePointers: true, // For grounding citations
  },
  orderBy: [{ authorityLevel: "asc" }, { confidence: "desc" }, { effectiveFrom: "desc" }],
})
```

### Verified: NO Phase-1 Model Queries

```bash
grep -r "ruleFact" src/lib/assistant/
# Result: 0 matches

grep -r "candidateFact" src/lib/assistant/
# Result: 0 matches
```

---

## Section 6: Database FK Constraints

### SourcePointer Foreign Keys

```sql
-- Result: NO FK constraints on SourcePointer.evidenceId
SELECT * FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name = 'SourcePointer';
-- 0 rows
```

**Impact:** SourcePointer.evidenceId is a soft reference. Database does not enforce which Evidence table it references.

---

## Section 7: Canonical Truth Decision Required

### Evidence Table Decision

| Option                             | Pros                                   | Cons                                     |
| ---------------------------------- | -------------------------------------- | ---------------------------------------- |
| `regulatory.Evidence` as canonical | Already in Prisma, fetchers write here | 1,995 SourcePointers orphaned            |
| `public.Evidence` as canonical     | Has historical data                    | Not in Prisma, would need re-adding      |
| Migrate public → regulatory        | Preserves data                         | Complex migration, ID conflicts possible |

### Recommended: `regulatory.Evidence` as Canonical

1. It's the forward-looking architecture (RTL isolation)
2. It's already active in production fetchers
3. Historical `public.Evidence` data can be migrated with new IDs
4. SourcePointer.evidenceId can be updated in batch

---

## Section 8: Pre-Bridge State Summary

### What Exists and Works

```
Evidence (regulatory) → Fetchers → ✓ ACTIVE
Evidence (regulatory) → Extractor → SourcePointer → ✓ ACTIVE
SourcePointer → Composer → RegulatoryRule → ✓ ACTIVE
RegulatoryRule → Assistant → ✓ ACTIVE
```

### What Exists but Doesn't Work

```
Evidence (public) → 2,022 rows → ✗ ORPHANED (not in Prisma)
SourcePointers → 1,995 reference public.Evidence → ✗ SPLIT-BRAIN
CandidateFact → 0 rows → ✗ NOT CONNECTED
RuleFact → 0 rows → ✗ NOT CONNECTED
```

### Target End State

```
Evidence (regulatory ONLY) → Extractor → CandidateFact → (Promotion) → RuleFact → Assistant
```

---

## Verification SQL Snippets

```sql
-- Count all tables
SELECT 'public.Evidence' as t, COUNT(*) FROM public."Evidence"
UNION ALL SELECT 'regulatory.Evidence', COUNT(*) FROM regulatory."Evidence"
UNION ALL SELECT 'public.SourcePointer', COUNT(*) FROM public."SourcePointer"
UNION ALL SELECT 'public.RegulatoryRule', COUNT(*) FROM public."RegulatoryRule"
UNION ALL SELECT 'public.CandidateFact', COUNT(*) FROM public."CandidateFact"
UNION ALL SELECT 'regulatory.RuleFact', COUNT(*) FROM regulatory."RuleFact";

-- Check SourcePointer evidence references
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM public."Evidence" e WHERE e.id = sp."evidenceId")
    THEN 'public.Evidence'
    WHEN EXISTS (SELECT 1 FROM regulatory."Evidence" re WHERE re.id = sp."evidenceId")
    THEN 'regulatory.Evidence'
    ELSE 'ORPHANED'
  END as evidence_table,
  COUNT(*)
FROM public."SourcePointer" sp
GROUP BY 1;
```

---

## Phase 1 Decision: Evidence Consolidation

**Date:** 2026-01-07

### Decision: `regulatory.Evidence` is Canonical

**Rationale:**

1. All production code already uses `dbReg.evidence` (98 access patterns, 0 using `db.evidence`)
2. `regulatory.Evidence` is in `prisma/regulatory.prisma` (managed by Prisma)
3. `public.Evidence` was removed from `schema.prisma` (orphaned table)
4. Active fetchers write to `regulatory.Evidence`

### Historical Data Strategy

| Table                     | Rows  | Decision                    |
| ------------------------- | ----- | --------------------------- |
| `public.Evidence`         | 2,022 | DEPRECATED - Do not migrate |
| `public.RegulatorySource` | 75    | DEPRECATED - Do not migrate |

**Justification for NOT migrating:**

1. SourcePointers are self-contained (have `exactQuote` embedded)
2. Historical SourcePointers still work for assistant answers
3. Migration risk outweighs benefit (ID conflicts, FK issues)
4. Old Evidence is not being updated anyway

### Accepted Trade-offs

1. 1,995 historical SourcePointers have orphaned `evidenceId` (pointing to `public.Evidence`)
2. These SourcePointers cannot trace provenance to source document
3. Re-verification of old quotes is not possible

### Future Retirement Plan (Phase 5)

After Phase-1 cutover is complete:

1. Add `@deprecated` comment to any code that might reference `public.Evidence`
2. Create migration to DROP `public.Evidence` and `public.RegulatorySource`
3. Update SourcePointer to make `evidenceId` nullable OR delete orphaned records

---

## Phase 2: Prisma/DB Alignment

**Date:** 2026-01-07
**Status:** COMPLETE

### Changes Made

1. **Added CandidateFact to `prisma/schema.prisma`:**
   - CandidateStatus enum (CAPTURED, UNDER_REVIEW, NEEDS_EVIDENCE, PROMOTABLE, REJECTED, PROMOTED, ARCHIVED)
   - CandidateFact model matching existing DB table structure (29 columns)
   - Indexes on status, promotionCandidate, conceptSlug, etc.

2. **Added RuleFact to `prisma/regulatory.prisma`:**
   - RuleFactSubjectType enum (TAXPAYER, EMPLOYER, COMPANY, INDIVIDUAL, ALL)
   - RuleFactObjectType enum (POREZNA_STOPA, PRAG_PRIHODA, OSNOVICA, ROK, OBVEZA, IZNOS, POSTOTAK)
   - RuleFactValueType enum (PERCENTAGE, CURRENCY_EUR, CURRENCY_HRK, DEADLINE_DAY, DEADLINE_DESCRIPTION, BOOLEAN, COUNT)
   - RuleFactAuthorityLevel enum (LAW, GUIDANCE, PROCEDURE, PRACTICE)
   - RuleFactRiskTier enum (T0, T1, T2, T3)
   - RuleFactStatus enum (DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, DEPRECATED, REJECTED)
   - RuleFact model matching existing DB table structure

### Verification

```bash
npx prisma validate --schema=prisma/schema.prisma
# ✓ Valid

npx prisma validate --schema=prisma/regulatory.prisma
# ✓ Valid
```

---

## Phase 3: Write-Path Cutover (Extractor)

**Date:** 2026-01-07
**Status:** COMPLETE

### Changes Made

Modified `src/lib/regulatory-truth/agents/extractor.ts`:

```typescript
// PHASE-3 BRIDGE: Also create CandidateFact for Phase-1 system
// This dual-write allows gradual migration while maintaining backward compatibility
try {
  await db.candidateFact.create({
    data: {
      suggestedDomain: extraction.domain,
      suggestedValueType: extraction.value_type,
      extractedValue: String(extraction.extracted_value),
      overallConfidence: extraction.confidence,
      valueConfidence: extraction.confidence,
      groundingQuotes: [...],
      suggestedConceptSlug: `${extraction.domain}-${extraction.value_type}`.toLowerCase(),
      legalReferenceRaw: extraction.law_reference || null,
      extractorNotes: extraction.extraction_notes || null,
      suggestedPillar: extraction.domain,
      status: "CAPTURED",
      promotionCandidate: extraction.confidence >= 0.9,
    },
  })
} catch (cfError) {
  // Log but don't fail - CandidateFact is Phase-3 bridge, not critical path
  console.warn(`[extractor] Failed to create CandidateFact: ${cfError}`)
}
```

### Behavior Change

| Before                               | After                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| Extractor creates SourcePointer only | Extractor creates BOTH SourcePointer AND CandidateFact |
| CandidateFact = 0 rows               | CandidateFact grows with each extraction               |

### Backward Compatibility

- SourcePointer creation unchanged (critical path)
- CandidateFact wrapped in try/catch (non-blocking)
- If CandidateFact fails, extractor continues normally

---

## Phase 4: Read-Path Cutover (Assistant)

**Date:** 2026-01-07
**Status:** COMPLETE

### Changes Made

Modified `src/lib/assistant/query-engine/rule-selector.ts`:

```typescript
// PHASE-4 BRIDGE: Try RuleFact first (new canonical system), fallback to RegulatoryRule
// This dual-query allows gradual migration while maintaining backward compatibility
// Eventually, only RuleFact should be queried (Phase 5 retirement)
let useRuleFact = false
let ruleFactCount = 0

try {
  // Check if RuleFact has any published data for these concepts
  ruleFactCount = await dbReg.ruleFact.count({
    where: {
      conceptSlug: { in: conceptSlugs },
      status: "PUBLISHED",
    },
  })
  useRuleFact = ruleFactCount > 0
  if (useRuleFact) {
    console.log(`[rule-selector] Phase-4: Using RuleFact (${ruleFactCount} published rules)`)
  }
} catch (error) {
  // RuleFact query failed - fall back to RegulatoryRule
  console.warn(
    `[rule-selector] Phase-4: RuleFact query failed, using RegulatoryRule fallback:`,
    error
  )
}
```

### Behavior Change

| Before                                | After                                                         |
| ------------------------------------- | ------------------------------------------------------------- |
| Assistant queries RegulatoryRule only | Assistant checks RuleFact first, falls back to RegulatoryRule |
| RuleFact = ignored                    | RuleFact used when it has PUBLISHED data                      |

### Current State

- RuleFact = 0 PUBLISHED rows → Fallback to RegulatoryRule (no change in behavior)
- When RuleFact has PUBLISHED data → Assistant uses new canonical system

---

## Phase 5: Legacy Retirement

**Date:** 2026-01-07
**Status:** DOCUMENTED (Awaiting RuleFact data)

### Current State

The bridge is in place but cannot retire legacy because:

| Component          | Current State                       | Required for Retirement                   |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| CandidateFact      | 0 rows (will grow with extractions) | N/A (staging table)                       |
| RuleFact           | 0 rows                              | ≥1 PUBLISHED rule per concept             |
| Promotion Pipeline | NOT IMPLEMENTED                     | Required to move CandidateFact → RuleFact |

### Missing Component: Promotion Pipeline

To retire the legacy system, we need a promotion pipeline:

```
CandidateFact (CAPTURED)
    ↓ [Human Review or Auto-Promote high-confidence]
CandidateFact (PROMOTABLE)
    ↓ [Promotion Script]
RuleFact (DRAFT)
    ↓ [Review/Approval]
RuleFact (PUBLISHED)
    ↓ [Assistant queries RuleFact]
Legacy Retired ✓
```

### Retirement Criteria

Legacy stack (RegulatoryRule, SourcePointer) can be retired when:

1. **Coverage:** RuleFact has PUBLISHED rules for ALL concepts currently in RegulatoryRule
2. **Quality:** RuleFact data passes quality checks (confidence ≥ 0.8, valid grounding quotes)
3. **Verification:** Assistant produces equivalent answers using RuleFact vs RegulatoryRule
4. **Stability:** No regressions in 7 days of dual-query operation

### Deprecation Markers Added

The following code now has bridge comments indicating future retirement:

| File               | Line | Comment                                                               |
| ------------------ | ---- | --------------------------------------------------------------------- |
| `extractor.ts`     | ~299 | `// PHASE-3 BRIDGE: Also create CandidateFact for Phase-1 system`     |
| `rule-selector.ts` | ~128 | `// PHASE-4 BRIDGE: Try RuleFact first, fallback to RegulatoryRule`   |
| `rule-selector.ts` | ~130 | `// Eventually, only RuleFact should be queried (Phase 5 retirement)` |

### Tables to DROP (After Retirement)

| Table              | Schema | Rows  | Retirement Action                     |
| ------------------ | ------ | ----- | ------------------------------------- |
| `Evidence`         | public | 2,022 | DROP TABLE                            |
| `RegulatorySource` | public | 75    | DROP TABLE                            |
| `RegulatoryRule`   | public | 615   | DROP TABLE (after RuleFact populated) |

### SourcePointer Retirement Strategy

SourcePointer has 2,177 rows referenced by RegulatoryRule:

**Option A: Keep Forever (Recommended)**

- SourcePointer contains grounding quotes (self-contained)
- Can still be used for citations even after RegulatoryRule retired
- RuleFact.groundingQuotes will duplicate this data

**Option B: Migrate to RuleFact**

- Copy SourcePointer data into RuleFact.groundingQuotes during promotion
- Then DROP SourcePointer table

**Decision:** Option A - Keep SourcePointer as historical record. RuleFact will have its own groundingQuotes.

---

## Phase 6: Proof-Run Audit

**Date:** 2026-01-07
**Status:** IN PROGRESS

### Verification Checklist

- [x] Phase 0: Baseline audit documented
- [x] Phase 1: regulatory.Evidence declared canonical
- [x] Phase 2: CandidateFact and RuleFact in Prisma schemas
- [x] Phase 3: Extractor dual-writes to CandidateFact
- [x] Phase 4: Assistant checks RuleFact first
- [x] Phase 5: Retirement criteria documented
- [ ] CI passing on all changes
- [ ] No production regressions

### Bridge State Summary

```
CURRENT PRODUCTION FLOW (Active):
Evidence (regulatory) → Extractor → SourcePointer → Composer → RegulatoryRule → Assistant

BRIDGE ADDITIONS (In Place):
Evidence (regulatory) → Extractor → CandidateFact ─┐
                                                    ├─→ (Promotion) → RuleFact → Assistant
                                                    │
RegulatoryRule ─────────────────────────────────────┘ (Fallback when RuleFact empty)

TARGET FLOW (When RuleFact populated):
Evidence (regulatory) → Extractor → CandidateFact → (Promotion) → RuleFact → Assistant
```

### Next Actions

1. **Immediate:** Wait for CI green on PR #1349
2. **Short-term:** Run Extractor batch to populate CandidateFact
3. **Medium-term:** Implement promotion pipeline (CandidateFact → RuleFact)
4. **Long-term:** Retire legacy stack when retirement criteria met

---

**Audit Complete:** 2026-01-07
**PR:** #1349
**Status:** Bridge in place, awaiting RuleFact population for full cutover
