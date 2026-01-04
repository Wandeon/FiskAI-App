# Regulation Absence Audit

**Date:** 2025-12-26
**Auditor:** Claude Opus 4.5
**Scope:** How the system handles absence of regulation
**Goal:** Ensure the assistant can correctly say "there is no obligation" without hallucinating requirements

---

## Executive Summary

| Area                        | Verdict          | Risk Level |
| --------------------------- | ---------------- | ---------- |
| REFUSAL Logic               | PASS             | Low        |
| Rule-Absence Detection      | CONDITIONAL PASS | Medium     |
| "No Obligation" Affirmation | FAIL             | High       |
| Over-Compliance Bias        | FAIL             | High       |
| Silence → REFUSAL           | PASS             | Low        |
| UX Pressure on Compliance   | PASS             | Low        |

**OVERALL VERDICT: FAIL**

The system has excellent fail-closed behavior for missing sources, but **cannot distinguish between "we don't know" and "no obligation exists"**. Additionally, the Arbiter's "conservative" strategy explicitly biases toward over-compliance.

---

## 1. REFUSAL Logic Analysis

### Findings: PASS

The system uses a robust three-stage fail-closed pipeline:

**File:** `src/lib/assistant/query-engine/answer-builder.ts`

```
Stage 1: Query Interpretation (interpretQuery)
  - Classifies topic, intent, jurisdiction
  - Detects personalization needs, nonsense, foreign jurisdictions
  - Computes confidence score
  - CONFIDENCE TIERS:
    - < 0.6 → NEEDS_CLARIFICATION (always)
    - 0.6-0.75 → Stricter retrieval (need 2+ entities)
    - >= 0.75 → Normal retrieval

Stage 2: Retrieval Gate (matchConcepts + selectRules)
  - Only runs if interpretation passes threshold
  - If no matches → NEEDS_CLARIFICATION (for vague queries)
  - If no matches but high confidence → NO_CITABLE_RULES

Stage 3: Answer Eligibility Gate
  - Validates citations exist
  - Checks for unresolved conflicts
  - Validates personalization requirements
```

**RefusalReason Enum (`src/lib/assistant/types.ts:64-70`):**

```typescript
export type RefusalReason =
  | "NO_CITABLE_RULES" // No published rules found
  | "OUT_OF_SCOPE" // Topic outside system scope
  | "MISSING_CLIENT_DATA" // Needs personalization data
  | "UNRESOLVED_CONFLICT" // Multiple conflicting sources
  | "NEEDS_CLARIFICATION" // Query too vague
  | "UNSUPPORTED_JURISDICTION" // Foreign country detected
```

**Key Invariants (answer-builder.ts:51-52):**

```
INVARIANT: The system REFUSES more often than it answers.
INVARIANT: Vague queries always get clarification, never "no sources found".
```

---

## 2. Rule-Absence Detection

### Findings: CONDITIONAL PASS

The system correctly identifies when no rules exist:

**answer-builder.ts:284-298:**

```typescript
if (conceptMatches.length === 0) {
  // INVARIANT: Vague queries get clarification, not "no sources found"
  if (interpretation.confidence < CONFIDENCE_THRESHOLD_STRICT) {
    return buildClarificationRefusal(baseResponse, interpretation)
  }
  return buildNoCitableRulesRefusal(baseResponse, interpretation.topic, interpretation)
}
```

**Issue:** The detection works for "we have no sources" but cannot affirm "no obligation exists."

---

## 3. "No Obligation" Affirmation: CRITICAL GAP

### Findings: FAIL

**The outcome DSL lacks a `NO_OBLIGATION` type.**

**File:** `src/lib/regulatory-truth/dsl/outcome.ts`

Current outcome kinds:

```typescript
const outcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("VALUE"), ... }),
  z.object({ kind: z.literal("OBLIGATION"), ... }),
  z.object({ kind: z.literal("PROCEDURE"), ... }),
])
```

**Missing:**

- `NO_OBLIGATION` - affirms that something is NOT required
- `EXEMPTION` - affirms that a requirement does not apply to the user

### Impact

When a user asks "Do I need to report X?" where X is genuinely not regulated:

| Current Behavior                                                   | Expected Behavior                                   |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| Returns `NO_CITABLE_RULES`                                         | Should return `ANSWER` with `NO_OBLIGATION`         |
| User sees: "We have no sources"                                    | User should see: "No, there is no such requirement" |
| Ambiguous - user can't tell if it's a gap or genuinely unregulated | Clear affirmation of non-applicability              |

### Example Scenarios

**Scenario 1: Unregulated Activity**

- Query: "Do I need to file a report for cryptocurrency donations to charity?"
- Current: `NO_CITABLE_RULES` (silent on whether requirement exists)
- Expected: `ANSWER` + explicit "No such reporting requirement exists in Croatian tax law"

**Scenario 2: Exemption Applies**

- Query: "Do I need to register for VAT?" (business under threshold)
- Current: May find VAT rules but cannot affirm exemption
- Expected: `ANSWER` with `NO_OBLIGATION` outcome + citation to exemption provision

---

## 4. Over-Compliance Bias: CRITICAL ISSUE

### Findings: FAIL

**File:** `src/lib/regulatory-truth/agents/ARBITER_README.md:40-46`

```markdown
### 4. Conservative

When uncertain, choose stricter interpretation:

- Higher tax rates
- Shorter deadlines
- Stricter compliance requirements
```

**File:** `src/lib/regulatory-truth/prompts/index.ts:369`

```
4. Conservative: When uncertain, choose stricter interpretation
```

### Impact

The Arbiter explicitly biases toward over-compliance when resolving conflicts. This creates:

1. **False Positives:** Telling users they have obligations they don't legally have
2. **Higher Costs:** Users may pay more tax or comply with stricter requirements than necessary
3. **Trust Erosion:** When users verify with accountants, they may find the system was too conservative

### Example

**Conflict:**

- Source A (LAW): "VAT threshold is 40,000 EUR"
- Source B (GUIDANCE): "VAT threshold is 39,816.84 EUR"
- Both same authority and date

**Current behavior with "conservative" strategy:**

- System chooses lower threshold (39,816.84 EUR) = stricter
- User may register for VAT unnecessarily

**Correct behavior:**

- Escalate to human review (which it does for equal authority)
- But if it doesn't escalate, it should not default to stricter

---

## 5. Silence in Corpus → REFUSAL

### Findings: PASS

The system correctly returns `NO_CITABLE_RULES` when no sources exist:

**answer-builder.ts:434-458:**

```typescript
function buildNoCitableRulesRefusal(
  base: Partial<AssistantResponse>,
  topic: Topic,
  interpretation?: Interpretation
): AssistantResponse {
  return {
    kind: "REFUSAL",
    refusalReason: "NO_CITABLE_RULES",
    headline: "Nema dostupnih službenih izvora",
    refusal: {
      message: "Nismo pronašli službene izvore koji odgovaraju na vaše pitanje.",
      relatedTopics: suggestions,
    },
  }
}
```

---

## 6. UX Pressure on Over-Compliance

### Findings: PASS

The UX does not pressure users into over-compliance. The refusal messages are neutral:

- "Nismo pronašli službene izvore" (We didn't find official sources)
- Not: "You should comply with X to be safe"

---

## 7. Test Coverage for Absence Scenarios

**File:** `src/lib/regulatory-truth/e2e/assistant-suite.ts`

### Existing Tests

```typescript
// Fictitious domain - should refuse
{
  id: "nonexistent-regulation",
  question: "Koja je stopa poreza na sunčanje?", // "What's the sunbathing tax rate?"
  expectedBehavior: "REFUSE_NO_SOURCE",
  domain: "fictitious",
},
// Future date - should refuse
{
  id: "future-rate",
  question: "Koja će biti stopa PDV-a 2030. godine?",
  expectedBehavior: "REFUSE_NO_SOURCE",
  domain: "pdv",
},
```

### Missing Tests

1. **Exemption Affirmation:** Test that the system can confirm "No, you don't need to do X"
2. **Threshold-Based Exemption:** Test that sub-threshold businesses get exemption confirmation
3. **Over-Compliance Detection:** Test that system doesn't invent obligations

---

## 8. Recommendations

### Critical (Must Fix)

1. **Add `NO_OBLIGATION` Outcome Kind**

   ```typescript
   // ABSENCE_OF_OBLIGATION: Affirm that no requirement exists
   z.object({
     kind: z.literal("ABSENCE_OF_OBLIGATION"),
     affirmation: z.object({
       code: z.string(), // e.g., "NO_CRYPTO_CHARITY_REPORTING"
       description: z.string(),
       scope: z.string(), // What this non-requirement applies to
       citation: z.string().optional(), // Citation to exemption or scope limit
     }),
   }),
   ```

2. **Remove "Conservative" Bias from Arbiter**

   Change from:

   ```
   4. Conservative: When uncertain, choose stricter interpretation
   ```

   To:

   ```
   4. Escalate: When uncertain, escalate to human review (never guess)
   ```

3. **Add Explicit Exemption Rules**

   Create rules that explicitly state when obligations DON'T apply:

   ```typescript
   {
     conceptSlug: "vat-exemption-under-threshold",
     outcome: { kind: "ABSENCE_OF_OBLIGATION", ... },
     appliesWhen: { op: "lt", field: "counters.revenueYtd", value: 39816.84 }
   }
   ```

### Medium Priority

4. **Distinguish "Unknown" vs "Not Required"**

   Add a new refusal reason:

   ```typescript
   | "ABSENCE_AFFIRMED" // We confirm there is no such requirement
   ```

5. **Add Over-Compliance Tests**

   ```typescript
   {
     id: "no-vat-under-threshold",
     question: "Moram li se prijaviti za PDV ako zarađujem 20.000 EUR godišnje?",
     expectedBehavior: "ANSWER_EXEMPTION", // NOT ANSWER_WITH_CITATION forcing obligation
     domain: "pdv",
   }
   ```

### Low Priority

6. **Log Conservative Resolutions**

   Track when "conservative" strategy is used to identify systematic over-compliance.

---

## 9. Fallback Paths That Produce Over-Compliance

| Path                          | Trigger                   | Risk                                                |
| ----------------------------- | ------------------------- | --------------------------------------------------- |
| Arbiter Conservative          | Equal authority conflict  | Chooses stricter option                             |
| Missing Exemption Rules       | Query about exemptions    | Returns "no sources" instead of "exempt"            |
| Conflation of Vague vs Absent | Low confidence + no rules | Asks for clarification instead of affirming absence |

---

## 10. Verdict Details

### PASS Criteria Met

- [x] System does not fabricate obligations from nothing
- [x] Silence in corpus → REFUSAL (not ANSWER)
- [x] UX does not pressure into over-compliance
- [x] Fail-closed behavior works correctly

### FAIL Criteria Not Met

- [ ] System cannot affirm "no obligation exists" with evidence
- [ ] Arbiter biases toward stricter interpretation (over-compliance)
- [ ] No `NO_OBLIGATION` outcome type
- [ ] Cannot distinguish "we don't know" from "it doesn't apply"

---

## 11. Test Queries for Future Validation

When fixes are implemented, test with:

1. **"Do I need to report X?" where X is not regulated**
   - Query: "Moram li prijaviti donacije u kriptovaluti udruzi?"
   - Expected: `NO_OBLIGATION` with citation to what IS regulated

2. **"Is there a deadline for Y?" where none exists**
   - Query: "Koji je rok za prijavu prodaje rabljenog automobila?"
   - Expected: `ABSENCE_AFFIRMED` or clear answer that no specific deadline exists

3. **Exemption scenarios**
   - Query: "Moram li plaćati PDV ako zarađujem 15.000 EUR?"
   - Expected: `ANSWER` with exemption confirmation + threshold citation

---

**Report Generated:** 2025-12-26T12:00:00Z
**Next Review:** After fixes implemented
