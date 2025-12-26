# Jurisdiction & Scope Enforcement Audit

**Date:** 2025-12-26
**Scope:** Jurisdiction detection logic, concept metadata, rule selection filters, answer phrasing, scope enforcement
**Verdict:** **CONDITIONAL PASS** with medium-severity gaps requiring remediation

---

## Executive Summary

The FiskAI assistant has **partial jurisdiction enforcement** that works correctly for its current Croatia-centric design but has architectural gaps that create scope leakage risks. The system relies entirely on query-level filtering with **no defense-in-depth** at the rule selection layer.

### Key Findings

| Area | Status | Risk Level |
|------|--------|------------|
| Foreign jurisdiction detection | ✅ PASS | Low |
| Croatian rules outside Croatia | ✅ PASS (implicit) | Low |
| EU vs national law override | ⚠️ PARTIAL | Medium |
| Sector-specific rule leakage | ❌ FAIL | Medium |
| Guidance vs binding law phrasing | ⚠️ PARTIAL | Medium |
| AppliesWhen DSL usage | ❌ FAIL | High |

---

## 1. Jurisdiction Detection Analysis

### 1.1 Foreign Country Detection (PASS)

**Location:** `src/lib/assistant/query-engine/query-interpreter.ts:199-220`

The system correctly detects and refuses queries about foreign jurisdictions:

```typescript
const FOREIGN_COUNTRY_PATTERNS: { pattern: RegExp; country: string }[] = [
  { pattern: /\b(njem|german|deutsch|berlin|münchen|munchen)\w*/i, country: "Germany" },
  { pattern: /\b(austri|österreich|wien|vienna|beč)\w*/i, country: "Austria" },
  // ... 18 more country patterns
]
```

**Test Coverage:** `query-interpreter.test.ts:82-147` - Comprehensive tests for German, Austrian, Serbian, USA, UK detection.

**Gate Implementation:** `answer-builder.ts:190-211` (GATE 1C)
```typescript
if (interpretation.foreignCountryDetected) {
  return { kind: "REFUSAL", refusalReason: "UNSUPPORTED_JURISDICTION" }
}
```

### 1.2 Jurisdiction Type System

**Location:** `query-interpreter.ts:38`

```typescript
type Jurisdiction = "HR" | "EU" | "OTHER" | "UNKNOWN"
```

**Behavior:**
- Regulatory questions default to HR if no explicit jurisdiction detected (`query-interpreter.ts:544-548`)
- EU patterns recognized: `eu`, `europsk`, `direktiv`, `uredba-eu`, `intrastat`, `vies`, `moss`, `oss`
- `isJurisdictionValid()` accepts both HR and EU for regulatory topics

---

## 2. Croatian Rules Outside Croatia (PASS - Implicit Design)

### Verification 1: Croatian Rules Never Applied Outside Croatia

**Current State:** The system is designed as 100% Croatia-centric. There is no mechanism to apply Croatian rules to foreign jurisdictions because:

1. Foreign country queries are refused at GATE 1C
2. There is no user context for "country of operation"
3. All rules implicitly assume Croatian scope

**Risk Assessment:** LOW - Current design makes cross-border leakage impossible.

**However:** No defensive metadata exists if data model expands. See Gap #1.

---

## 3. EU vs National Law Override (PARTIAL)

### Analysis

The system stores `authorityLevel` on rules:
```typescript
const AUTHORITY_ORDER = ["LAW", "REGULATION", "GUIDANCE", "PRACTICE"] as const
```

**Location:** `rule-selector.ts:4-9`
```typescript
const AUTHORITY_RANK: Record<string, number> = {
  LAW: 1,
  REGULATION: 2,
  GUIDANCE: 3,
  PRACTICE: 4,
}
```

**Sorting Logic:** Rules are sorted by authority level, so national LAW ranks higher than EU GUIDANCE.

### Gap Identified

**Problem:** No mechanism distinguishes between:
- Croatian LAW (e.g., Zakon o PDV-u)
- EU Regulation (directly applicable)
- EU Directive (requires national transposition)

**Risk:** EU regulations might be incorrectly subordinated to national guidance when they should take precedence.

**Example Scenario:**
- EU Regulation on VAT: authorityLevel = "REGULATION" (rank 2)
- Croatian Porezna Uprava guidance: authorityLevel = "GUIDANCE" (rank 3)
- Result: ✅ Correct (EU Regulation ranks higher)

But:
- EU Regulation (directly applicable): authorityLevel = "REGULATION"
- Croatian Law implementing directive: authorityLevel = "LAW" (rank 1)
- Result: ⚠️ Croatian law ranks higher even if EU regulation should override

---

## 4. Sector-Specific Rule Leakage (FAIL)

### Critical Gap: No Sector/Scope Filtering

**Location:** `rule-selector.ts:43-80`

```typescript
export async function selectRules(conceptSlugs: string[]): Promise<RuleCandidate[]> {
  const rules = await prisma.regulatoryRule.findMany({
    where: {
      conceptSlug: { in: conceptSlugs },  // Only filter by concept
      status: "PUBLISHED",
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
    },
    // NO sector/scope filtering
  })
}
```

### Problem Demonstration

**Query:** "Koji je prag za PDV?"

**Expected Behavior:** Return VAT threshold for general businesses.

**Actual Behavior:** Returns ALL rules matching "pdv" and "prag" concepts, including:
- Paušalni-specific thresholds
- General VAT thresholds
- Industry-specific thresholds (if any)

### AppliesWhen DSL Not Evaluated

**Location:** `applies-when.ts`

The `appliesWhen` field exists on RegulatoryRule and contains predicates like:
```json
{ "op": "and", "args": [
  { "op": "cmp", "field": "entity.type", "cmp": "eq", "value": "OBRT" },
  { "op": "cmp", "field": "entity.obrtSubtype", "cmp": "eq", "value": "PAUSALNI" }
]}
```

**But:** This DSL is **NEVER evaluated** in the assistant's rule selection path.

- Grep for `appliesWhen` in `src/lib/assistant/`: **0 matches**
- The DSL exists but is only used in the rules/evaluate API, not in the assistant

### Impact

| Query | Intended Scope | Actual Result |
|-------|---------------|---------------|
| "PDV prag" | General | Returns pausalni + general rules |
| "Pausalni prag" | Paušalni obrt only | Correct (concept filtering) |
| "VAT threshold" | General | Returns all threshold rules |

---

## 5. Guidance vs Binding Law Phrasing (PARTIAL)

### Current State

The `authorityLevel` is included in the citation response:

**Location:** `citation-builder.ts:37`
```typescript
authority: rule.authorityLevel as AuthorityLevel,
```

**SourceCard Interface:** `types.ts:81`
```typescript
interface SourceCard {
  authority: AuthorityLevel  // LAW | REGULATION | GUIDANCE | PRACTICE
  // ...
}
```

### Gap Identified

1. **No Textual Distinction:** The `directAnswer` and `headline` fields do not indicate whether the response is based on binding law or guidance.

2. **No Disclaimer:** There is no automatic disclaimer when a response is based on GUIDANCE or PRACTICE level sources.

3. **UI Responsibility:** The frontend is expected to display the authority level, but there's no backend enforcement that GUIDANCE responses include a caveat.

**Example:**
- Query: "How to file quarterly VAT?"
- Source: Porezna Uprava guidance document (authorityLevel: GUIDANCE)
- Response: Procedural steps presented without caveat
- Risk: User may assume this is legally binding when it's administrative guidance

---

## 6. Cross-Scope Query Scenarios

### Scenario A: EU-Only Topic Framed as Croatian (PARTIAL PASS)

**Query:** "Koja je direktiva za e-račune u Hrvatskoj?"

**Interpretation:**
- jurisdiction: EU (detected "direktiva")
- foreignCountryDetected: undefined
- isJurisdictionValid: true (EU accepted)

**Result:** Query proceeds to retrieval. Rules with "e-racun" concept returned.

**Issue:** No filtering to return only EU directive rules. Croatian implementation rules may be returned equally.

### Scenario B: Sector-Specific Obligations Asked Generically (FAIL)

**Query:** "Koliki su doprinosi za obrtnike?"

**Expected:** General contribution rates for sole traders.

**Actual:** Returns ALL contribution-related rules, including:
- Paušalni-specific reduced contributions
- Full-time obrtnik contributions
- Part-time obrtnik contributions

**Impact:** Answer may present paušalni rates to non-paušalni users.

### Scenario C: Guidance Presented as Law (PARTIAL FAIL)

**Query:** "Kako ispuniti JOPPD obrazac?"

**Source:** Porezna Uprava procedural guidance (authorityLevel: GUIDANCE)

**Response:** Step-by-step procedure without caveat.

**Issue:** User cannot distinguish between:
- Legal requirements (must do X)
- Administrative guidance (recommended to do X)

---

## 7. Summary of Gaps

| ID | Gap Description | Location | Risk | Remediation |
|----|-----------------|----------|------|-------------|
| G1 | No jurisdiction field on RegulatoryRule | `schema.prisma:1820` | Medium | Add `jurisdiction String @default("HR")` |
| G2 | No jurisdiction filter in selectRules() | `rule-selector.ts:43` | High | Add jurisdiction to WHERE clause |
| G3 | AppliesWhen DSL not evaluated in assistant | `answer-builder.ts:302` | High | Evaluate appliesWhen before returning rules |
| G4 | No sector/scope metadata on concepts | `schema.prisma:1801` | Medium | Add `scope String[]` field |
| G5 | No guidance disclaimer in response | `answer-builder.ts:390-405` | Medium | Add caveat for non-LAW sources |
| G6 | EU Regulation vs Directive not distinguished | `types.ts:53-54` | Low | Extend AuthorityLevel enum |
| G7 | EvaluationContext.country hardcoded to HR | `applies-when.ts:96` | Low | Already correct for current scope |

---

## 8. Recommendations

### Priority 1 (High - Before Production Use)

1. **Evaluate AppliesWhen in Assistant**
   ```typescript
   // In answer-builder.ts after selectRules()
   const filteredRules = rules.filter(rule => {
     const context = buildEvaluationContext(companyId)
     return evaluateAppliesWhen(parseAppliesWhen(rule.appliesWhen), context)
   })
   ```

2. **Add Sector Scope to Concepts**
   ```prisma
   model Concept {
     scope String[] @default(["general"])  // ["pausalni"], ["doo"], ["general"]
   }
   ```

### Priority 2 (Medium - Before Scale)

3. **Add Guidance Disclaimer**
   ```typescript
   if (primaryRule.authorityLevel === "GUIDANCE" || primaryRule.authorityLevel === "PRACTICE") {
     response.directAnswer = `[Napomena: Ovo je administrativna smjernica, ne zakonska obveza]\n\n${response.directAnswer}`
   }
   ```

4. **Add Jurisdiction Metadata to Rules**
   ```prisma
   model RegulatoryRule {
     jurisdiction String @default("HR")  // HR, EU, HR+EU
   }
   ```

### Priority 3 (Low - Future-Proofing)

5. **Distinguish EU Regulation from Directive**
   ```typescript
   type AuthorityLevel = "CONSTITUTIONAL" | "LAW" | "EU_REGULATION" | "REGULATION" | "GUIDANCE" | "PRACTICE"
   ```

---

## 9. Verdict

### Overall: **CONDITIONAL PASS**

The system is safe for its current Croatia-only scope but has architectural gaps that would cause scope leakage if:
1. Multi-jurisdiction support is added
2. Sector-specific rules proliferate
3. Users rely on responses without checking authority level

### Pass Conditions

| Requirement | Status | Notes |
|-------------|--------|-------|
| Croatian rules never applied outside Croatia | ✅ PASS | Implicit by design |
| EU rules not applied where national law overrides | ⚠️ PARTIAL | Authority ranking works but no directive vs regulation distinction |
| Sector-specific rules don't leak | ❌ FAIL | AppliesWhen not evaluated |
| Guidance never presented as binding law | ⚠️ PARTIAL | Authority in citation but no textual disclaimer |

### Remediation Required

Before expanding beyond current scope:
1. Implement AppliesWhen evaluation in assistant (G3) - **BLOCKING**
2. Add guidance disclaimer (G5) - **RECOMMENDED**
3. Add jurisdiction metadata (G1, G2) - **RECOMMENDED for multi-jurisdiction**

---

## Appendix A: Code Path References

| Component | File | Line(s) | Purpose |
|-----------|------|---------|---------|
| Jurisdiction Type | query-interpreter.ts | 38 | Jurisdiction enum definition |
| Foreign Detection | query-interpreter.ts | 199-220, 471-481 | Country pattern matching |
| GATE 1C | answer-builder.ts | 190-211 | Foreign jurisdiction refusal |
| GATE 1D | answer-builder.ts | 213-228 | Jurisdiction validity check |
| isJurisdictionValid | query-interpreter.ts | 745-755 | HR/EU validation |
| selectRules | rule-selector.ts | 43-80 | Rule selection (no jurisdiction filter) |
| AppliesWhen DSL | applies-when.ts | 44-86, 178-245 | Predicate evaluation |
| EvaluationContext | applies-when.ts | 88-114 | Context with hardcoded HR |
| Authority Ranking | rule-selector.ts | 4-9 | LAW > REGULATION > GUIDANCE |
| Citation Authority | citation-builder.ts | 37 | Authority in response |

---

## Appendix B: Test Coverage Summary

| Test File | Coverage | Gap |
|-----------|----------|-----|
| query-interpreter.test.ts | Foreign jurisdiction detection | ✅ Good |
| query-interpreter.test.ts | Jurisdiction validation | ✅ Good |
| rule-selector.test.ts | Published/temporal filtering | ✅ Good |
| rule-selector.test.ts | Jurisdiction filtering | ❌ Not tested (not implemented) |
| answer-builder.test.ts | Sector scope filtering | ❌ Not tested (not implemented) |
| applies-when.test.ts | DSL evaluation | ✅ Good (but not used in assistant) |

---

**Audit Performed By:** Claude (Automated Audit)
**Review Required:** Yes - before production use with sector-specific rules
