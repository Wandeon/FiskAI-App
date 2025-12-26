# Composer Conflict & Canonicalization Audit Report

**Date:** 2025-12-26
**Auditor:** Claude (Opus 4.5)
**Scope:** Composer rule creation pipeline, canonicalization, duplicate/conflict handling

---

## Executive Summary

The Composer pipeline has a multi-layered approach to preventing duplicates and detecting conflicts, but several gaps remain that could allow duplicates to persist or conflicts to be missed.

**Key Findings:**
1. **Canonicalization is reactive, not preventive** - Alias resolution only works for known aliases in the hardcoded map
2. **AppliesWhen fallback broadens applicability silently** - Invalid DSL defaults to `{ op: "true" }` (applies to everyone)
3. **meaningSignature is an index, not a unique constraint** - No DB-level prevention of semantic duplicates
4. **No write-time duplicate gate** - Duplicates are detected after creation, not prevented
5. **Missing metrics** - No tracking of duplicate creation rate, appliesWhen fallback rate, or cross-slug conflicts

---

## (a) Confirmed Canonicalization Flow

### Alias Resolution Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                     resolveCanonicalConcept()                    │
│                    (concept-resolver.ts:177)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Check ALIAS_TO_CANONICAL map                           │
│  ├── Pre-built inverted map from CANONICAL_ALIASES              │
│  └── O(1) lookup for known aliases                              │
│                                                                  │
│  Step 2: Find existing Concept by canonical slug                │
│  └── db.concept.findFirst({ where: { slug: canonicalSlug } })   │
│                                                                  │
│  Step 3: Normalized slug comparison (fallback)                  │
│  ├── Loads ALL concepts from DB                                 │
│  ├── removeDiacritics() on slug (č→c, ž→z, etc.)               │
│  └── Matches by normalized or alias family                      │
│                                                                  │
│  Step 4: Check for existing rule with same value/valueType      │
│  ├── Queries RegulatoryRule where:                              │
│  │   - value = proposed value                                   │
│  │   - valueType = proposed valueType                           │
│  │   - status IN (PUBLISHED, APPROVED, PENDING_REVIEW, DRAFT)   │
│  │   - Date overlap (effectiveFrom <= new OR effectiveUntil >=) │
│  └── If found: shouldMerge = true                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CANONICAL_ALIASES Registry

Location: `src/lib/regulatory-truth/utils/concept-resolver.ts:15-106`

Currently contains 11 canonical concepts with ~45 total aliases:
- `pdv-standardna-stopa` (4 aliases)
- `pdv-drzavni-proracun-iban` (6 aliases)
- `prag-promidzbenih-darova` (7 aliases)
- `rok-cuvanja-dokumentacije` (3 aliases)
- `fiskalizacija-2-0-datum` (4 aliases)
- `stope-pdv-hrvatska` (4 aliases)
- `eracun-kpd-uskladenost` (4 aliases)
- `fiksni-tecaj-konverzije-hrk-eur` (3 aliases)
- `upravna-pristojba-zalba-rjesenje` (1 alias)
- `regulatory-deadline-2025-12-04` (5 aliases)
- `standardni-radni-tjedan-zo` (2 aliases)
- `required-professional-experience-years` (2 aliases)

### Merge-on-Match Behavior

When `resolveCanonicalConcept()` returns `shouldMerge: true`:

```typescript
// composer.ts:251-279
if (resolution.shouldMerge && resolution.existingRuleId) {
  const mergeResult = await mergePointersToExistingRule(
    resolution.existingRuleId,
    validSourcePointerIds
  )
  // Returns existing rule ID, no new rule created
}
```

**Verified Behavior:** Pointers are added to existing rule, composer notes updated with merge timestamp.

---

## (b) Paths That Still Create Duplicates or Miss Conflicts

### Path 1: Unknown Alias (CRITICAL)

**Scenario:** LLM generates a slug not in `CANONICAL_ALIASES`

```
LLM generates: "pausalni-limit-prihoda"
Known canonical: "pausalni-revenue-threshold"
```

**Flow:**
1. ALIAS_TO_CANONICAL lookup fails → use proposed slug
2. db.concept.findFirst fails → no existing concept
3. Normalized slug comparison: `"pausalniлimitprihoda"` ≠ `"pausalnirevenuethreshold"`
4. Value match check only finds exact value+valueType matches
5. **Result:** New rule created with new slug → DUPLICATE

**Current Mitigation:** Consolidator runs later and may merge via token overlap (≥50% + ≥2 tokens)

### Path 2: Race Condition (HIGH)

**Scenario:** Two Composer workers process same domain simultaneously

```
Worker A: runComposer(["ptr1", "ptr2"])
Worker B: runComposer(["ptr3", "ptr4"])  // Same domain, same value
```

**Timeline:**
1. t0: Worker A calls `resolveCanonicalConcept()` → no existing rule
2. t1: Worker B calls `resolveCanonicalConcept()` → no existing rule (A hasn't committed)
3. t2: Worker A creates rule, commits
4. t3: Worker B creates rule, commits
5. **Result:** Two rules with same value → DUPLICATE

**No write-time lock** exists in the current implementation.

### Path 3: Value Format Variation (MEDIUM)

**Scenario:** Extractor produces different formats for same value

```
Evidence A: "39.816,84 EUR" (European format)
Evidence B: "39816.84 EUR" (US format)
```

**Flow:**
1. Extractor outputs string values as extracted
2. `resolveCanonicalConcept()` checks `value = "39.816,84 EUR"` vs `"39816.84 EUR"`
3. String mismatch → both pass
4. **Result:** Two rules for same regulatory value → SEMANTIC DUPLICATE

### Path 4: Non-Overlapping Time Windows (LOW)

**Scenario:** Same concept, same value, different effective dates

```
Rule A: effectiveFrom=2024-01-01, effectiveUntil=2024-12-31
Rule B: effectiveFrom=2025-01-01, effectiveUntil=null
```

**Flow:** `checkDateOverlap()` returns false → no conflict detected

**Note:** This may be INTENTIONAL for regulatory updates, but should be tracked as supersession.

### Path 5: Cross-Slug Without Alias (MEDIUM)

**detectCrossSlugDuplicates flow:**

```typescript
// conflict-detector.ts:125-127
const aliasSlugSet = getRelatedSlugs(newRule.conceptSlug)

if (aliasSlugSet.size === 0) {
  // Falls back to exact value match across ALL slugs
}
```

**Gap:** When no aliases are known, relies on exact value match. Slight value variations escape detection.

---

## (c) DB Constraints: Help vs Block

### Unique Constraint Analysis

**Current constraint:**
```prisma
@@unique([conceptSlug, effectiveFrom, status])
```

| Scenario | Prevented by Constraint? |
|----------|------------------------|
| Exact duplicate (same slug, date, status) | ✅ Yes |
| Same slug, same date, different status (DRAFT + PUBLISHED) | ❌ No |
| Different slug (alias), same date, same status | ❌ No |
| Same slug, different date, same status | ❌ No |

**Intentional:** The constraint ALLOWS draft/pending variants to coexist (see schema comment line 1860-1861).

### meaningSignature Field

```prisma
meaningSignature  String?
@@index([meaningSignature])  // INDEX, not UNIQUE
```

**Computed from:** `conceptSlug | value | valueType | effectiveFrom | effectiveUntil`

**Gap:** It's computed and stored but NOT enforced as unique. Duplicates can exist.

**Recommended Fix:** Add unique constraint with status filter:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS
  "RegulatoryRule_meaning_active_unique"
  ON "RegulatoryRule" ("meaningSignature")
  WHERE "status" IN ('APPROVED', 'PUBLISHED');
```

### Evidence Constraint

```prisma
// SourcePointer
@@unique([evidenceId, exactQuote])
```

**Helps:** Prevents exact duplicate extractions from same evidence.

### Conflict Constraint

**No unique constraint** on `(itemAId, itemBId)` for conflicts. The `seedConflicts()` function checks manually:

```typescript
// conflict-detector.ts:276-284
const existing = await db.regulatoryConflict.findFirst({
  where: {
    OR: [
      { itemAId: conflict.existingRuleId, itemBId: conflict.newRuleId },
      { itemAId: conflict.newRuleId, itemBId: conflict.existingRuleId },
    ],
    status: "OPEN",
  },
})
```

**Gap:** Relies on application-level check, not DB constraint. Race condition possible.

---

## (d) AppliesWhen DSL Safety Analysis

### Fallback Behavior (CRITICAL ISSUE)

```typescript
// composer.ts:176-187
const dslValidation = validateAppliesWhen(appliesWhenObj)
if (!dslValidation.valid) {
  console.warn(`[composer] Invalid AppliesWhen DSL...`)
  console.warn(`[composer] Replacing with { op: "true" } as fallback`)

  appliesWhenObj = { op: "true" }  // ⚠️ APPLIES TO EVERYONE

  draftRule.composer_notes = `...Original appliesWhen was invalid: ${dslValidation.error}`
}
```

**Risk:** Invalid DSL (e.g., LLM typo in field name) silently broadens the rule to apply universally.

**Example:**
- LLM intended: `{ op: "cmp", field: "entity.obrtSubtype", cmp: "eq", value: "PAUSALNI" }`
- LLM generated: `{ op: "cmp", field: "entiy.obrtSubtype", ... }` (typo)
- Validation fails → fallback to `{ op: "true" }`
- Rule now applies to ALL entity types, not just PAUSALNI

### Validation Schema

```typescript
// applies-when.ts:58-86
const appliesWhenSchema = z.discriminatedUnion("op", [
  // Valid operators
])
```

**Validates:** Structure and operator types
**Does NOT validate:** Field name correctness, value semantics

---

## (e) Consolidator Safety Conditions

### Merge Criteria (SAFE)

```typescript
// consolidator.ts:148-168
function areSlugsRelated(slug1: string, slug2: string): boolean {
  // 1. Same slug
  if (slug1 === slug2) return true

  // 2. Same alias family
  const canonical1 = resolveToCanonical(slug1)
  const canonical2 = resolveToCanonical(slug2)
  if (canonical1 === canonical2) return true

  // 3. Token overlap (≥50% AND ≥2 tokens)
  const intersection = ...
  return intersection.size >= Math.ceil(minSize * 0.5) && intersection.size >= 2
}
```

**Safety:** Never merges unrelated concepts (e.g., "25%" VAT vs "25%" discount).

### Stop Word Filtering

```typescript
// consolidator.ts:175-207
const stopWords = new Set([
  "the", "a", "rate", "value", "threshold", // etc.
])
```

**Risk:** If meaningful tokens are in stop words, related slugs might not match.

---

## (f) Recommended Hard Gates and Metrics

### Immediate Action Required

#### 1. Add Write-Time Duplicate Gate

```typescript
// Before db.regulatoryRule.create():
const existingByMeaning = await db.regulatoryRule.findFirst({
  where: {
    meaningSignature,
    status: { in: ["APPROVED", "PUBLISHED"] }
  }
})
if (existingByMeaning) {
  throw new DuplicateRuleError(existingByMeaning.id)
}
```

#### 2. Fix AppliesWhen Fallback Behavior

**Option A (Recommended):** Fail-closed - reject rule creation if DSL invalid
```typescript
if (!dslValidation.valid) {
  return {
    success: false,
    error: `Invalid AppliesWhen DSL: ${dslValidation.error}. Manual review required.`,
    ruleId: null,
  }
}
```

**Option B:** Create but flag for human review
```typescript
if (!dslValidation.valid) {
  status: "PENDING_REVIEW",  // Not DRAFT
  reviewerNotes: `[AUTO-FLAGGED] Invalid AppliesWhen requires manual correction`,
}
```

#### 3. Add DB Unique Constraint on meaningSignature

```sql
CREATE UNIQUE INDEX CONCURRENTLY
  "RegulatoryRule_meaning_active_unique"
  ON "RegulatoryRule" ("meaningSignature")
  WHERE "status" IN ('APPROVED', 'PUBLISHED')
    AND "meaningSignature" IS NOT NULL;
```

### Metrics to Track

| Metric Name | Definition | Alert Threshold |
|-------------|------------|-----------------|
| `duplicate_creation_rate_24h` | Rules created that match existing meaningSignature | >0 |
| `applies_when_fallback_rate_24h` | Rules with `{ op: "true" }` due to validation failure | >0 |
| `unknown_alias_rate_24h` | Slugs that didn't resolve via CANONICAL_ALIASES | >10% |
| `cross_slug_conflict_rate_7d` | CROSS_SLUG_DUPLICATE conflicts created | Trend up |
| `consolidator_merge_count_7d` | Rules merged by consolidator (cleanup metric) | >5/week |
| `test_data_leakage_count` | Test domain pointers in non-rejected rules | >0 |

### Health Gate Additions

Add to `health-gates.ts`:

```typescript
/**
 * Gate 7: AppliesWhen Fallback Rate
 * Alert if ANY rules have fallback appliesWhen
 */
async function checkAppliesWhenFallbackRate(): Promise<HealthGate> {
  const fallbackRules = await db.regulatoryRule.count({
    where: {
      status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED"] },
      composerNotes: { contains: "[AUTO-FIX] Original appliesWhen" }
    }
  })

  return {
    name: "applies_when_fallback_rate",
    status: fallbackRules > 0 ? "critical" : "healthy",
    value: fallbackRules,
    threshold: 0,
    message: `${fallbackRules} rules with fallback appliesWhen`,
    recommendation: fallbackRules > 0
      ? "Rules with fallback appliesWhen apply universally. Review and fix DSL manually."
      : undefined
  }
}

/**
 * Gate 8: Duplicate Meaning Signatures
 * Alert if duplicate meaningSignatures exist
 */
async function checkDuplicateMeaningSignatures(): Promise<HealthGate> {
  const duplicates = await db.$queryRaw`
    SELECT "meaningSignature", COUNT(*) as cnt
    FROM "RegulatoryRule"
    WHERE "status" IN ('APPROVED', 'PUBLISHED')
      AND "meaningSignature" IS NOT NULL
    GROUP BY "meaningSignature"
    HAVING COUNT(*) > 1
  `

  const count = (duplicates as any[]).length

  return {
    name: "duplicate_meaning_signatures",
    status: count > 0 ? "critical" : "healthy",
    value: count,
    threshold: 0,
    message: `${count} meaning signatures have duplicates`,
    recommendation: count > 0
      ? "Duplicate meaning signatures indicate failed deduplication. Run consolidator immediately."
      : undefined
  }
}
```

---

## Summary Matrix

| Component | Current State | Risk Level | Fix Priority |
|-----------|--------------|------------|--------------|
| Canonicalization | Reactive (alias map) | MEDIUM | P2 - Add learning mechanism |
| Duplicate Prevention | Post-hoc (consolidator) | HIGH | P1 - Add write-time gate |
| AppliesWhen Fallback | Broadens silently | CRITICAL | P0 - Fail-closed or flag |
| DB Constraints | Partial | MEDIUM | P1 - Add meaningSignature unique |
| Conflict Detection | Good for known aliases | MEDIUM | P2 - Improve cross-slug detection |
| Consolidator Safety | Strong | LOW | OK - Monitor only |
| Metrics/Monitoring | Incomplete | HIGH | P1 - Add missing gates |

---

## Appendix: Files Audited

1. `src/lib/regulatory-truth/agents/composer.ts` - Rule creation pipeline
2. `src/lib/regulatory-truth/utils/concept-resolver.ts` - Canonicalization logic
3. `src/lib/regulatory-truth/utils/conflict-detector.ts` - Structural conflict detection
4. `src/lib/regulatory-truth/utils/consolidator.ts` - Duplicate merging
5. `src/lib/regulatory-truth/dsl/applies-when.ts` - DSL validation
6. `src/lib/regulatory-truth/utils/meaning-signature.ts` - Uniqueness hash
7. `src/lib/regulatory-truth/utils/health-gates.ts` - Existing health checks
8. `src/lib/regulatory-truth/utils/truth-health.ts` - Truth health metrics
9. `src/lib/regulatory-truth/monitoring/metrics.ts` - Pipeline metrics
10. `prisma/schema.prisma` - Database constraints
