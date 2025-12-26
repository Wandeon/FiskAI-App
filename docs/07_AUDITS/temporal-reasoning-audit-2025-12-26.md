# Temporal Reasoning Audit Report

**Date:** 2025-12-26
**Auditor:** Claude Opus 4.5 (Automated Security Audit)
**Scope:** Regulatory pipeline temporal correctness
**Verdict:** **FAIL** - Critical issues found requiring immediate remediation

---

## Executive Summary

This audit examined temporal reasoning correctness across the FiskAI regulatory pipeline, focusing on `effectiveFrom`/`effectiveUntil` handling, rule selection logic, and answer time-anchoring. **Multiple critical vulnerabilities were discovered** that could lead to users receiving legally incorrect information.

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | Requires immediate fix |
| HIGH | 2 | Requires fix before production |
| MEDIUM | 3 | Should be addressed |
| LOW | 1 | Recommended improvement |

---

## Verification Results

### 1. Future rules never applied to current queries

**FAIL** - `/api/rules/search` has no temporal filtering

**Evidence:** `src/app/api/rules/search/route.ts:64-66`
```typescript
const where: Record<string, unknown> = {
  status: "PUBLISHED",
}
```

The search endpoint only filters by `status: "PUBLISHED"` and does NOT check:
- `effectiveFrom <= now`
- `effectiveUntil IS NULL OR effectiveUntil > now`

**Counterexample:** A rule with `effectiveFrom: "2026-01-01"` (future) would be returned by the search API today, potentially misleading users about current regulations.

**Rule Selector:** Correctly implements temporal filtering at `src/lib/assistant/query-engine/rule-selector.ts:52-53`:
```typescript
effectiveFrom: { lte: now },
OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
```

### 2. Repealed/expired rules never selected

**PARTIAL PASS** - Core selector works, but inconsistent boundary conditions

The assistant's `selectRules()` correctly filters expired rules. However, there's an **inconsistency** between components:

| Component | Boundary Condition | Rule valid on expiry day? |
|-----------|-------------------|---------------------------|
| `rule-selector.ts:53` | `effectiveUntil: { gt: now }` | NO |
| `evaluate/route.ts:87` | `until >= asOfDate` | YES |
| `knowledge-graph.ts:189` | `effectiveUntil >= new Date()` | YES |

**Counterexample:** On 2025-06-30, a rule with `effectiveUntil: "2025-06-30"`:
- Would be **EXCLUDED** by the assistant (rule-selector uses `>`)
- Would be **INCLUDED** by the evaluate API (uses `>=`)

This inconsistency could cause:
- Users getting different answers from different endpoints
- Caching/sync issues between systems

### 3. Overlapping effective windows resolved deterministically

**PASS** - Authority hierarchy properly enforced

The conflict resolution system correctly implements Croatian legal hierarchy:

1. **Arbiter Agent** (`src/lib/regulatory-truth/agents/arbiter.ts:31-43`):
   ```typescript
   LAW: 1, GUIDANCE: 2, PROCEDURE: 3, PRACTICE: 4
   ```

2. **Conflict Detector** (`src/lib/assistant/query-engine/conflict-detector.ts:49-65`):
   - Sorts by authority rank
   - Returns `canResolve: false` only when multiple rules at same authority conflict

3. **Structural Conflict Detection** (`src/lib/regulatory-truth/utils/conflict-detector.ts:48-77`):
   - Detects `VALUE_MISMATCH` for overlapping dates
   - Detects `AUTHORITY_SUPERSEDE` for hierarchy conflicts

**Note:** Escalation to human review is properly triggered for equal-authority conflicts.

### 4. Answers anchor to a time context

**FAIL** - No time anchoring implemented

**Evidence:** `src/lib/assistant/types.ts:204` defines `asOfDate?: string` but `src/lib/assistant/query-engine/answer-builder.ts` **NEVER sets this field**.

The response is built at line 390-405 with no `asOfDate`:
```typescript
return {
  ...baseResponse,
  kind: "ANSWER",
  topic: interpretation.topic,
  headline: primaryRule.titleHr,
  // ... no asOfDate!
}
```

**Impact:**
- Users have no way to know when the answer was computed
- Cached answers cannot be verified for staleness
- No warning when rules are about to change

### 5. Guidance dates never override law dates

**PASS** - Authority hierarchy takes precedence over temporal ordering

The arbiter prompt explicitly states (`src/lib/regulatory-truth/prompts/index.ts:350-358`):
```
LEGAL HIERARCHY (highest to lowest):
1. Ustav RH (Constitution)
2. Zakon (Parliamentary law)
...
```

Resolution strategies prioritize hierarchy over temporal:
1. Hierarchy: Higher authority source wins
2. Temporal: Only used when authority is equal (lex posterior)
3. Specificity: Only used when authority is equal

---

## Critical Vulnerabilities

### CVE-TR-001: Search API Returns Future/Expired Rules

**Severity:** CRITICAL
**CVSS Estimate:** 7.5 (High)
**Location:** `src/app/api/rules/search/route.ts`

**Description:**
The `/api/rules/search` endpoint returns all PUBLISHED rules without temporal filtering, allowing queries to return:
- Rules not yet effective (future rules)
- Expired/repealed rules

**Attack Vector:**
A user or automated system could:
1. Query the search API for a regulatory topic
2. Receive a future rule (e.g., new tax rate effective 2026-01-01)
3. Apply this rule TODAY, resulting in incorrect compliance

**Recommended Fix:**
```typescript
const now = new Date()
const where: Record<string, unknown> = {
  status: "PUBLISHED",
  effectiveFrom: { lte: now },
  OR: [
    { effectiveUntil: null },
    { effectiveUntil: { gt: now } }
  ],
}
```

### CVE-TR-002: Boundary Condition Inconsistency

**Severity:** HIGH
**Location:** Multiple files

**Description:**
Different components use incompatible boundary conditions for `effectiveUntil`:
- `>` (exclusive) vs `>=` (inclusive)

**Impact:**
On the exact expiry day, different endpoints give different answers.

**Recommended Fix:**
Standardize on exclusive boundary (`effectiveUntil > now`):
- A rule expiring on 2025-06-30 is valid until 2025-06-29 23:59:59
- On 2025-06-30 00:00:00, it is no longer valid

Update all instances to use `gt` / `>` consistently.

### CVE-TR-003: Missing Answer Time Anchoring

**Severity:** HIGH
**Location:** `src/lib/assistant/query-engine/answer-builder.ts`

**Description:**
Answers are returned without any temporal context, making it impossible to:
- Verify when the answer was computed
- Detect stale cached responses
- Warn users about upcoming regulatory changes

**Recommended Fix:**
```typescript
return {
  ...baseResponse,
  kind: "ANSWER",
  asOfDate: new Date().toISOString(),
  // ...
}
```

---

## Counterexamples Constructed

### Counterexample 1: Query Today About Future Rule

**Scenario:**
- Rule A: `effectiveFrom: "2026-01-01"`, value: "30%"
- Rule B: `effectiveFrom: "2024-01-01"`, `effectiveUntil: null`, value: "25%"

**Query:** "What is the tax rate?"
**Date:** 2025-12-26

| Component | Returns | Correct? |
|-----------|---------|----------|
| `/api/rules/search` | Both A and B | NO - should only return B |
| `selectRules()` | Only B | YES |

### Counterexample 2: Query After effectiveUntil Date

**Scenario:**
- Rule: `effectiveFrom: "2024-01-01"`, `effectiveUntil: "2025-06-30"`, value: "25%"

**Query:** "What is the rate?"
**Date:** 2025-06-30 (expiry day)

| Component | Returns Rule? | Reason |
|-----------|--------------|--------|
| `selectRules()` | NO | Uses `effectiveUntil: { gt: now }` |
| `/api/rules/evaluate` | YES | Uses `until >= asOfDate` |

**Result:** Inconsistent behavior on boundary day.

### Counterexample 3: Overlapping Windows - Same Authority

**Scenario:**
- Rule A: LAW, value: "25%", `effectiveFrom: "2024-01-01"`
- Rule B: LAW, value: "30%", `effectiveFrom: "2025-01-01"`

**Query:** "What is the rate?" on 2025-06-01

**Expected:** B wins (lex posterior - later effective date)
**Actual:** Conflict escalated to human review (correct behavior for equal authority)

---

## Missing Invariants

The `invariant-validator.ts` should include temporal invariants:

### Proposed INV-9: No Future Rule Selection
```typescript
async function validateINV9(): Promise<InvariantResult> {
  const now = new Date()
  const futureRulesSelected = await db.queryLog.count({
    where: {
      responseContainsFutureRule: true,
    },
  })
  // ...
}
```

### Proposed INV-10: No Expired Rule Selection
```typescript
async function validateINV10(): Promise<InvariantResult> {
  const now = new Date()
  const expiredRulesInResponse = await db.assistantResponse.count({
    where: {
      ruleEffectiveUntil: { lt: now },
    },
  })
  // ...
}
```

---

## Recommendations

### Immediate (Before Next Release)

1. **Fix `/api/rules/search`** - Add temporal filtering
2. **Standardize boundary conditions** - Use exclusive (`>`) everywhere
3. **Add `asOfDate` to answers** - Populate in answer-builder.ts

### Short-Term (Next Sprint)

4. **Add temporal invariants** - INV-9 and INV-10
5. **Add answer phrasing context** - Include "as of [date]" in directAnswer
6. **Add expiry warnings** - When rule expires within 30 days

### Long-Term

7. **Time-travel API** - Allow querying rules as of a specific date
8. **Temporal audit log** - Track what rules were returned when
9. **Client-side caching** - Include cache validity based on nearest effectiveUntil

---

## Files Audited

| File | Status | Issues |
|------|--------|--------|
| `src/lib/assistant/query-engine/rule-selector.ts` | PASS | Correct temporal filtering |
| `src/lib/assistant/query-engine/answer-builder.ts` | FAIL | Missing asOfDate |
| `src/lib/assistant/query-engine/conflict-detector.ts` | PASS | Proper hierarchy |
| `src/app/api/rules/search/route.ts` | FAIL | No temporal filtering |
| `src/app/api/rules/evaluate/route.ts` | PARTIAL | Boundary condition issue |
| `src/lib/regulatory-truth/agents/arbiter.ts` | PASS | Correct hierarchy |
| `src/lib/regulatory-truth/utils/conflict-detector.ts` | PASS | Proper overlap detection |
| `src/lib/fiscal-data/utils/effective-date.ts` | PASS | Correct temporal logic |
| `src/lib/regulatory-truth/graph/knowledge-graph.ts` | PARTIAL | Boundary condition issue |
| `src/lib/regulatory-truth/e2e/invariant-validator.ts` | PARTIAL | Missing temporal invariants |

---

## Verdict

**FAIL** - The regulatory pipeline has critical temporal reasoning vulnerabilities that must be addressed before the system can be considered safe for production use in compliance-critical contexts.

**Risk Summary:**
- Users could receive legally incorrect information based on future rules
- Expired rules could be returned by some endpoints
- No way to verify the temporal validity of cached answers
- Boundary condition inconsistencies could cause different answers on expiry days

**Remediation Priority:**
1. CRITICAL: Fix `/api/rules/search` temporal filtering
2. HIGH: Standardize boundary conditions
3. HIGH: Add `asOfDate` to responses
4. MEDIUM: Add temporal invariant validators

---

*Report generated by automated security audit. Human review recommended for all findings.*
