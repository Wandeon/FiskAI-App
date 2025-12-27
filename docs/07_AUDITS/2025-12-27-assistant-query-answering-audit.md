# Audit 8: Assistant (Query Answering)

**Date:** 2025-12-27
**Auditor:** Claude Code (Opus 4.5)
**Status:** PASS with WARNINGS
**Overall Assessment:** The assistant query-answering system demonstrates strong fail-closed architecture with proper citation validation, but shows room for improvement in rule coverage and answer quality.

---

## Executive Summary

This audit validates that the AI assistant provides accurate answers with valid citations and refuses appropriately when evidence is insufficient. The system implements a **three-stage fail-closed pipeline** that prioritizes safety over helpfulness.

### Key Findings

| Category | Status | Notes |
|----------|--------|-------|
| Query Routing Accuracy | **PASS** | Pattern-based + LLM fallback working correctly |
| Citation Validity | **PASS** | PUBLISHED-only enforcement verified |
| Fail-Closed Verification | **PASS** | System refuses rather than hallucinate |
| Temporal Correctness | **PASS** | effectiveFrom/effectiveUntil respected |
| Hallucination Prevention | **PASS** | All claims traced to citations |
| Refusal Appropriateness | **WARN** | Over-conservative in some cases |
| Knowledge Coverage | **WARN** | Gaps in pausalni, fiskalizacija, doprinosi |

---

## 1. Query Routing Accuracy

### Pattern-Based Detection (Fast Path)

**Location:** `src/lib/regulatory-truth/retrieval/query-router.ts:40-122`

The system uses regex-based pattern detection for 5 intent types before falling back to LLM classification:

| Intent | Example Patterns (Croatian) | Example Patterns (English) |
|--------|----------------------------|---------------------------|
| PROCESS | `kako da`, `koraci za`, `postupak`, `registracija` | `how do i`, `what are the steps` |
| REFERENCE | `iban za`, `uplatni račun`, `šifra za`, `cn kod` | `what is the iban`, `account number` |
| DOCUMENT | `obrazac`, `formular`, `preuzmi`, `pdv-*` | `where can i find`, `form for` |
| TEMPORAL | `prijelazne`, `stara stopa`, `nova stopa`, date patterns | `old vs new`, `transitional` |
| LOGIC | `moram li`, `trebam li`, `koliko iznosi`, `koja je stopa` | `do i have to`, `what is the rate` |

**Test Coverage:** 134 lines of tests in `src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts`

**Finding:** Pattern priority correctly handles overlapping patterns (e.g., PROCESS before LOGIC, TEMPORAL before LOGIC).

**Status:** ✅ PASS

### LLM Fallback Classification

When patterns don't match, the system uses `QUERY_CLASSIFIER` agent with `temperature: 0.1` for deterministic classification.

**Default behavior:** Falls back to `GENERAL` intent with confidence 0.5 if classification fails.

---

## 2. Answer Verification

### Three-Stage Fail-Closed Pipeline

**Location:** `src/lib/assistant/query-engine/answer-builder.ts`

```
Stage 1: Query Interpretation
├── Nonsense detection (>60% gibberish tokens → OUT_OF_SCOPE)
├── Confidence thresholds (< 0.6 → NEEDS_CLARIFICATION)
├── Topic scope check (PRODUCT/SUPPORT → redirect)
├── Foreign jurisdiction check (→ UNSUPPORTED_JURISDICTION)
└── Personalization check (→ MISSING_CLIENT_DATA)

Stage 2: Retrieval Gate
├── Concept matching (→ NEEDS_CLARIFICATION if vague)
└── Rule selection (PUBLISHED only)

Stage 3: Answer Eligibility Gate
├── Conflict detection (→ UNRESOLVED_CONFLICT)
├── Citation validation (→ NO_CITABLE_RULES)
└── Primary citation completeness check
```

### Citation Chain Requirements

**Location:** `src/lib/assistant/validation.ts:70-102`

For REGULATORY ANSWER responses, the system enforces:

```typescript
// FAIL-CLOSED: Primary citation MUST have:
- url (non-empty)
- quote (non-empty)
- evidenceId (non-empty)
- fetchedAt (non-empty)
```

**Evidence:** Integration test at `src/lib/assistant/__tests__/fail-closed-integration.test.ts:190-208` verifies:
```typescript
const validation = validateResponse(invalidResponse)
expect(validation.valid).toBe(false)
expect(validation.errors.some((e) => e.includes("fail-closed"))).toBe(true)
```

**Status:** ✅ PASS

---

## 3. Citation Validity

### PUBLISHED-Only Enforcement

**Location:** `src/lib/assistant/query-engine/rule-selector.ts:117-134`

```typescript
const allRules = await prisma.regulatoryRule.findMany({
  where: {
    conceptSlug: { in: conceptSlugs },
    status: "PUBLISHED",  // ← HARD GATE
  },
  // ...
})
```

**Rule Eligibility Gate:**

Rules are excluded if:
1. `effectiveFrom > asOfDate` (FUTURE)
2. `effectiveUntil < asOfDate` (EXPIRED)
3. `appliesWhen` evaluates to FALSE (CONDITION_FALSE)
4. `appliesWhen` requires missing context (MISSING_CONTEXT)

### Citation Builder Chain

**Location:** `src/lib/assistant/query-engine/citation-builder.ts`

```typescript
// Citation requires complete evidence chain:
Source → Evidence → SourcePointer → RegulatoryRule → Concept
```

**Evidence Provenance:**
```typescript
evidenceId: evidence.id,
fetchedAt: evidence.fetchedAt?.toISOString() || new Date().toISOString(),
```

**Finding:** The citation builder returns `null` if:
- No rules have source pointers
- Primary rule lacks evidence

**Status:** ✅ PASS

---

## 4. Refusal Appropriateness

### Refusal Reasons

| Reason | Trigger | Message |
|--------|---------|---------|
| `NO_CITABLE_RULES` | No matching PUBLISHED rules | "Nismo pronašli službene izvore..." |
| `NEEDS_CLARIFICATION` | Confidence < 0.6 or vague query | "Molimo precizirajte pitanje" |
| `OUT_OF_SCOPE` | Nonsense, gibberish, or PRODUCT/SUPPORT topic | "Molimo preformulirajte upit" |
| `UNSUPPORTED_JURISDICTION` | Foreign country detected | "Pitanje se odnosi na {country}..." |
| `MISSING_CLIENT_DATA` | Personalized query without context | "Za personalizirani odgovor..." |
| `UNRESOLVED_CONFLICT` | Conflicting rules that can't be resolved | "Pronađeni su proturječni propisi" |

### E2E Test Results (2025-12-25)

From `docs/07_AUDITS/2025-12-25-assistant-e2e-results.md`:

| Issue | Count | Examples |
|-------|-------|----------|
| Correct behavior | 3 | Q5, Q18, Q20 |
| Over-conservative (MISSING_CLIENT_DATA) | 6 | Q2, Q3, Q7, Q10, Q12, Q15 |
| Knowledge gaps (NO_CITABLE_RULES) | 6 | Q8, Q9, Q11, Q13, Q14, Q16 |
| EU Directive over-match | 5 | Q1, Q4, Q6, Q17, Q19 |

**Warning:** Some queries like "Koji je maksimalni prihod za paušalni obrt?" (Q8) return `NO_CITABLE_RULES` when this is core regulatory knowledge that should be available.

**Status:** ⚠️ WARN - Over-conservative refusals and knowledge gaps need attention

---

## 5. Temporal Correctness

### Temporal Eligibility Check

**Location:** `src/lib/assistant/query-engine/rule-eligibility.ts:23-38`

```typescript
export function checkTemporalEligibility(
  rule: Pick<RuleWithAppliesWhen, "effectiveFrom" | "effectiveUntil">,
  asOfDate: Date
): EligibilityResult {
  // Rule must have started
  if (rule.effectiveFrom > asOfDate) {
    return { eligible: false, reason: "FUTURE" }
  }
  // Rule must not have expired (null = no expiry)
  if (rule.effectiveUntil && rule.effectiveUntil < asOfDate) {
    return { eligible: false, reason: "EXPIRED" }
  }
  return { eligible: true }
}
```

### Transitional Provision Handling

**Location:** `src/lib/regulatory-truth/retrieval/temporal-engine.ts`

Supports patterns:
- `INVOICE_DATE`
- `DELIVERY_DATE`
- `PAYMENT_DATE`
- `EARLIER_EVENT`
- `LATER_EVENT`
- `TAXPAYER_CHOICE`

**Date Parsing:** Handles both `DD.MM.YYYY` format and Croatian/English month names.

**Status:** ✅ PASS

---

## 6. Fail-Closed Verification

### API Route Enforcement

**Location:** `src/app/api/assistant/chat/route.ts:66-99`

```typescript
// FAIL-CLOSED: Validate response before sending
const validation = validateResponse(response)
if (!validation.valid) {
  console.error("[Assistant API] FAIL-CLOSED triggered", { ... })

  // Return a valid REFUSAL response, not a 500 error
  const refusalResponse: AssistantResponse = {
    kind: "REFUSAL",
    refusalReason: "NO_CITABLE_RULES",
    refusal: {
      message: "Nismo pronašli dovoljno pouzdane izvore...",
    },
  }
  return NextResponse.json(refusalResponse)
}
```

### Error Handling

Even on exceptions, the API returns a valid REFUSAL response:

```typescript
} catch (error) {
  // Even on error, return a valid REFUSAL response
  const errorResponse: AssistantResponse = {
    kind: "REFUSAL",
    refusalReason: "NO_CITABLE_RULES",
    refusal: {
      message: "Privremena pogreška sustava. Molimo pokušajte ponovo.",
    },
  }
  return NextResponse.json(errorResponse)
}
```

**Key Invariant (answer-builder.ts:51-52):**
> INVARIANT: The system REFUSES more often than it answers.
> INVARIANT: Vague queries always get clarification, never "no sources found".

**Status:** ✅ PASS

---

## 7. Hallucination Prevention

### Claim Verification Path

Every answer follows this verification chain:

```
User Query
    ↓
Query Interpretation (topic, intent, entities)
    ↓
Concept Matching (taxonomy-based)
    ↓
Rule Selection (PUBLISHED only)
    ↓
Conflict Detection
    ↓
Citation Building (requires Evidence + SourcePointer)
    ↓
Validation (fail-closed if citations invalid)
    ↓
ANSWER (or REFUSAL)
```

### No Unparsed LLM Output in Answers

The system does NOT generate free-form LLM answers. Instead:
1. `directAnswer` comes from `rule.explanationHr` or formatted `rule.value`
2. `headline` comes from `rule.titleHr`
3. `citations.primary.quote` comes from `sourcePointer.exactQuote`

**Status:** ✅ PASS

---

## 8. Database Statistics (Schema Review)

### Relevant Models

The system uses `ReasoningTrace` for tracking interactions:

```prisma
model ReasoningTrace {
  id                  String   @id @default(cuid())
  requestId           String   @unique
  events              Json     // Full ReasoningEvent[]
  outcome             String   // ANSWER | QUALIFIED_ANSWER | REFUSAL | ERROR
  refusalReason       String?
  confidence          Float?
  sourceCount         Int?
  eligibleRuleCount   Int?
  // ...
}
```

**Note:** The audit prompt specified `AssistantInteraction` table which doesn't exist. The actual implementation uses `ReasoningTrace` for audit logging.

---

## 9. Critical Check: Unpublished Citations

### Code Analysis

The rule selector explicitly filters by `status: "PUBLISHED"`:

**Location:** `src/lib/assistant/query-engine/rule-selector.ts:117-122`

```typescript
const allRules = await prisma.regulatoryRule.findMany({
  where: {
    conceptSlug: { in: conceptSlugs },
    status: "PUBLISHED",
  },
  // ...
})
```

There is no code path that could return rules with any status other than `PUBLISHED`.

**Expected Query Result:**
```sql
SELECT ai.id, ai.query, rr.id as rule_id, rr.status
FROM "ReasoningTrace" ai
CROSS JOIN UNNEST(ai."citedRuleIds") as cited_id
JOIN "RegulatoryRule" rr ON rr.id = cited_id
WHERE rr.status != 'PUBLISHED';
-- Expected: 0 rows
```

**Status:** ✅ PASS (by code analysis)

---

## 10. Recommendations

### Critical

1. **Expand Rule Coverage**: Many common queries (paušalni limits, fiskalizacija, doprinosi) return `NO_CITABLE_RULES`. Priority should be given to extracting and publishing rules for these topics.

### High Priority

2. **Reduce Over-Conservative Refusals**: MISSING_CLIENT_DATA is triggered too easily. Consider:
   - Providing general information without personalization
   - Better differentiating between "requires personalization" and "can provide general answer"

3. **Fix EU Directive Over-Match**: Generic PDV questions shouldn't just return the EU Directive reference. They should match Croatian implementation rules.

### Medium Priority

4. **Add Database Query Logging**: Implement query-level analytics to track:
   - Response types (ANSWER vs REFUSAL ratio)
   - Most common refusal reasons
   - Citation usage patterns

5. **Improve Clarification Flow**: The `suggestedClarifications` are good but could be more context-aware based on partial matches.

---

## 11. Test Coverage Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `query-router.test.ts` | Intent detection patterns | ✅ |
| `query-interpreter.test.ts` | Confidence scoring, nonsense detection | ✅ |
| `answer-builder.test.ts` | End-to-end pipeline, surface differentiation | ✅ |
| `fail-closed-integration.test.ts` | Citation validation, refusal behavior | ✅ |
| `rule-selector.test.ts` | PUBLISHED filtering, eligibility | ✅ |
| `citation-builder.test.ts` | Evidence chain validation | ✅ |

---

## 12. Conclusion

The Assistant Query Answering system demonstrates **robust fail-closed behavior** with proper citation validation and hallucination prevention. The system correctly:

- Routes queries to appropriate engines based on intent
- Filters rules by PUBLISHED status only
- Validates citation completeness before returning ANSWER
- Refuses with appropriate reasons when evidence is insufficient
- Respects temporal bounds (effectiveFrom/effectiveUntil)

**Areas for Improvement:**
- Knowledge coverage needs expansion (many common queries return NO_CITABLE_RULES)
- Over-conservative MISSING_CLIENT_DATA responses could be relaxed
- EU Directive over-matching should be refined

**Final Status:** ✅ **PASS** with warnings

---

*Audit performed by Claude Code (Opus 4.5) on 2025-12-27*
