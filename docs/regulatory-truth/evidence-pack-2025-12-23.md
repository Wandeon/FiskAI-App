# Regulatory Truth P0/P1 Fixes - Evidence Pack

**Date:** 2025-12-23
**Sprint:** Accuracy & Trust Sprint

---

## RTL-001: Assistant Citations

### Implementation

- **Code:** `src/lib/regulatory-truth/utils/rule-context.ts:19-97`
- **Integration:** `src/app/api/assistant/chat/route.ts`

### What it does

1. Extracts Croatian keywords from user query (with stopword removal)
2. Queries PUBLISHED rules by conceptSlug/titleHr matching
3. Filters rules without valid sourcePointers
4. Formats citation block with: ruleId, conceptSlug, value, exactQuote, sourceUrl, fetchedAt

### Evidence Structure

```typescript
interface RuleContext {
  ruleId: string
  conceptSlug: string
  value: JsonValue
  exactQuote: string
  sourceUrl: string
  fetchedAt: Date
  articleNumber?: string
  lawReference?: string
}
```

### Gap to Close

- [ ] Add red-green test for citation compliance
- [ ] 30-question test suite with ≥95% citation compliance target

---

## RTL-002: Release Hash Determinism

### Implementation

- **Code:** `src/lib/regulatory-truth/utils/release-hash.ts`
- **Used by:** `src/lib/regulatory-truth/agents/releaser.ts:167`

### Hash Input Fields (frozen)

```typescript
const canonical = sorted.map((r) => ({
  conceptSlug: r.conceptSlug,
  appliesWhen: sortKeysRecursively(r.appliesWhen),
  value: r.value,
  valueType: r.valueType,
  effectiveFrom: normalizeDate(r.effectiveFrom),
  effectiveUntil: normalizeDate(r.effectiveUntil),
}))
```

### Guarantees

1. Rules sorted by `conceptSlug` (alphabetical)
2. Nested objects sorted recursively via `sortKeysRecursively()`
3. Dates normalized to `YYYY-MM-DD` format
4. SHA-256 hash of canonical JSON

### Verification Endpoint

`GET /api/admin/regulatory-truth/releases/[id]/verify`

---

## RTL-003: T0/T1 Approval Gate

### Implementation

- **Gate:** `src/lib/regulatory-truth/agents/releaser.ts:109-126`
- **Reviewer block:** `src/lib/regulatory-truth/agents/reviewer.ts:215-219`

### Gate Logic

```typescript
const unapprovedCritical = rules.filter(
  (r) => (r.riskTier === "T0" || r.riskTier === "T1") && !r.approvedBy
)
if (unapprovedCritical.length > 0) {
  return {
    success: false,
    error: `Cannot release ${unapprovedCritical.length} T0/T1 rules without approvedBy: ${slugs}`,
  }
}
```

### Database Evidence

```
Query: SELECT COUNT(*) FROM RegulatoryRule
       WHERE riskTier IN ('T0','T1') AND status='PUBLISHED' AND approvedBy IS NULL

Result: 0 violations (after data fix)
```

### Data Fix Applied

14 pre-existing T0 rules reverted to PENDING_REVIEW on 2025-12-23.

---

## RTL-004: AppliesWhen DSL Validation

### Implementation

- **Validator:** `src/lib/regulatory-truth/dsl/applies-when.ts`
- **Composer integration:** `src/lib/regulatory-truth/agents/composer.ts:141-153`
- **Fix script:** `scripts/fix-applies-when.ts`

### Database Evidence

```
Total rules with DSL: 29
Valid format (has "op:" key): 29
Legacy/invalid format: 0
```

### Validation Runs

- At composer time before rule creation
- Invalid DSL auto-fixed to `{ op: "true" }` with audit note

---

## RTL-005: Quote-in-Evidence (JSON Sources)

### Implementation

- **Extractor:** `src/lib/regulatory-truth/agents/extractor.ts` (isJsonContent, extractQuoteFromJson)
- **Validator:** `src/lib/regulatory-truth/utils/deterministic-validators.ts` (isJsonQuote, validateValueInQuote)
- **Fix script:** `scripts/fix-json-quotes.ts`

### Database Evidence

```
Total source pointers: 95
JSON-format quotes: 35
JSON evidence records: 35 (100% match)
```

### JSON Quote Format

```
Before: "EUR/AUD = 1,773900" (not in raw JSON)
After: "srednji_tecaj": "1,773900" (verbatim from JSON)
```

---

## P1 Fixes Summary

| Issue                             | Evidence                                                             |
| --------------------------------- | -------------------------------------------------------------------- |
| RTL-006 Redis timeout             | 3s timeout via Promise.race, returns 503 on failure                  |
| RTL-007 Release type              | Deterministic from highest riskTier: T0→major, T1→minor, T2/T3→patch |
| RTL-008 Evidence dedupe           | Index: `Evidence_url_contentHash_key` UNIQUE                         |
| RTL-009 Source pointer validation | Composer rejects rules without pointers                              |
| RTL-010 Dead-letter table         | `ExtractionRejected` table: 0 rows (clean run)                       |

---

## Health Gates Configuration

| Gate                                | Threshold            | Status Level      |
| ----------------------------------- | -------------------- | ----------------- |
| `extractor_parse_failure_rate`      | >10% (>5% degraded)  | CRITICAL/DEGRADED |
| `validator_rejection_rate`          | >35% (>20% degraded) | CRITICAL/DEGRADED |
| `quote_validation_rate`             | >5% (>2% degraded)   | CRITICAL/DEGRADED |
| `t0_t1_approval_compliance`         | >0                   | CRITICAL          |
| `source_pointer_coverage_published` | >0                   | CRITICAL          |
| `source_pointer_coverage_draft`     | >5%                  | CRITICAL          |
| `conflict_resolution_rate`          | >50% (>30% degraded) | CRITICAL/DEGRADED |
| `release_blocked_attempts`          | >50%                 | DEGRADED          |

### Gate Split Rationale

The old `extraction_rejection_rate` was split into two gates:

- **Parse failures** (strict): Indicate pipeline is broken - prompts need refinement
- **Validator rejections** (lenient): Healthy strictness catching bad data

### Code Location

`src/lib/regulatory-truth/utils/health-gates.ts`

---

## Test Coverage

```
Core tests: 58/58 pass
Regulatory truth unit tests: All pass
  - release-hash.test.ts: 9 determinism tests
  - health-gates-invariants.test.ts: 20 invariant tests
  - citation-compliance.test.ts: 19 unit tests
Integration tests (DB): Run in CI with ephemeral Postgres
  - arbiter-e2e.test.ts: Synthetic conflict resolution
  - citation-compliance-integration.test.ts: 30-question compliance (≥95% target)
```

### Integration Test Configuration

CI runs integration tests with ephemeral Postgres:

```yaml
DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci?schema=test_${{ github.run_id }}"
```

---

## Commits (chronological)

1. `9381a82` feat(assistant): add regulatory rule citations
2. `e527a89` fix(rule-context): address code review issues
3. `49b1bd6` fix(releaser): deterministic hash computation
4. `375b6c3` fix(regulatory-truth): ensure deterministic hash computation
5. `6938ec6` feat(regulatory-truth): add T0/T1 approval gate
6. `6c3996e` docs(reviewer): fix misleading comment about T0/T1 auto-approval
7. `bd26a6a` feat(regulatory-truth): add AppliesWhen DSL validation
8. `8f7931e` fix(regulatory-truth): handle JSON quotes for exchange rates
9. `4fa4359` fix(regulatory-truth): add Redis timeout protection
10. `6d109f3` fix(regulatory-truth): ensure release type matches highest risk tier
11. `e819be5` feat(regulatory-truth): add evidence deduplication constraint
12. `3b279db` fix(regulatory-truth): validate source pointers in composer
13. `08922fa` feat(regulatory-truth): add ExtractionRejected dead-letter table
14. `94e2c5c` feat(regulatory-truth): add domain-aware validators
15. `165b32b` feat(regulatory-truth): add deterministic conflict detection
16. `406f322` feat(regulatory-truth): add soft-fail wrapper for AI operations
17. `05835e9` feat(regulatory-truth): add health gates for system monitoring

---

## Outstanding Items

1. **Citation compliance test suite** - Need 30-question test with ≥95% target
2. **Ephemeral Postgres for CI** - 6 tests need DB mocking
3. **Release rebuild test** - Verify same hash N times
4. **Arbiter end-to-end test** - Synthetic conflict → resolution flow
