# AUDIT 003: Extractor Accuracy Audit

**Date:** 2025-12-27
**Auditor:** Claude Code (Automated)
**Status:** COMPLETED
**Branch:** `claude/audit-extractor-accuracy-1TRN3`

---

## Executive Summary

This audit evaluates the Extractor stage of the Regulatory Truth system for accuracy, hallucination prevention, and quote verification integrity. The audit was conducted through comprehensive code review due to database access limitations.

### Overall Assessment: **PASS WITH WARNINGS**

| Category | Status | Details |
|----------|--------|---------|
| Hallucination Prevention (Prompt) | PASS | Strong anti-inference language in prompts |
| Quote Verification | PASS | `validateValueInQuote` checks value presence |
| Dead-Letter Handling | PASS | ExtractionRejected table captures failures |
| Domain Validation | PASS | Domain-specific ranges enforced |
| Test Coverage | PASS | Comprehensive validator tests |
| Claim Extractor Validation | **FAIL** | Missing deterministic validation |
| Cross-System Consistency | **WARN** | Schema mismatches between components |

---

## Detailed Findings

### CRITICAL FINDINGS

#### CRIT-01: AtomicClaim Extractor Lacks Deterministic Validation

**Location:** `src/lib/regulatory-truth/agents/claim-extractor.ts:76-116`

**Issue:** The claim extractor stores extracted claims directly from LLM output without running the `validateValueInQuote` or `validateExtraction` functions that protect the legacy SourcePointer flow.

**Evidence:**
```typescript
// claim-extractor.ts - Claims stored without quote verification
for (const claim of result.output.claims) {
  const dbClaim = await db.atomicClaim.create({
    data: {
      // ... fields stored directly from LLM output
      exactQuote: claim.exactQuote,  // NOT VERIFIED!
      value: claim.value,            // NOT VERIFIED!
    },
  })
}
```

Compare with `extractor.ts:192`:
```typescript
// extractor.ts - Proper validation before storage
const validation = validateExtraction(extraction)
if (!validation.valid) {
  // Rejected and stored in dead-letter
}
```

**Risk:** HIGH - Hallucinated claims can enter the database unvalidated.

**Recommendation:** Add `validateValueInQuote` check before storing atomic claims.

---

### HIGH SEVERITY FINDINGS

#### HIGH-01: OCR Diacritic Corruption Causes False Negatives

**Location:** `src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts:428-433`

**Issue:** The test suite explicitly documents that OCR corruption of Croatian diacritics causes quote verification to fail incorrectly. When OCR produces "sijecnja" instead of "siječnja", the date pattern "15. siječnja 2025" won't match.

**Evidence:**
```typescript
// Known issue: OCR diacritic corruption causes false negatives
it("fails on OCR diacritic corruption (known issue HIGH-02)", () => {
  const result = validateValueInQuote("2025-01-15", "do 15. sijecnja 2025.")
  // Currently fails - diacritics not normalized
  assert.strictEqual(result.valid, false)
})
```

**Risk:** Valid extractions from OCR'd PDFs may be incorrectly rejected.

**Recommendation:** Add diacritic normalization layer (ć→c, č→c, š→s, ž→z, đ→d) before quote matching.

---

#### HIGH-02: JSON Quote Auto-Correction Bypasses Verification

**Location:** `src/lib/regulatory-truth/agents/extractor.ts:181-189`

**Issue:** When JSON content is detected, the extractor auto-corrects quotes by extracting them from the JSON structure. This synthetic quote generation could mask cases where the LLM fabricated a value.

**Evidence:**
```typescript
// For JSON content, fix the quote to be a verbatim JSON fragment
if (evidence.contentType === "json" || isJsonContent(content)) {
  const jsonQuote = extractQuoteFromJson(content, String(extraction.extracted_value))
  if (jsonQuote) {
    extraction.exact_quote = jsonQuote  // OVERWRITES LLM's quote
  }
}
```

**Risk:** If LLM hallucinates a value that happens to exist in JSON (e.g., wrong field), the auto-correction will "validate" it by finding a matching JSON fragment.

**Recommendation:** Log when quotes are auto-corrected and flag for human review, or require the LLM's original quote to roughly match the JSON value first.

---

### MEDIUM SEVERITY FINDINGS

#### MED-01: Schema Mismatch Between DomainSchema and Validators

**Location:**
- `src/lib/regulatory-truth/schemas/common.ts:50-59`
- `src/lib/regulatory-truth/utils/deterministic-validators.ts:178-188`

**Issue:** The Zod DomainSchema only includes 7 domains, but validators reference 9 domains:

| Schema Domains | Validator Domains |
|---------------|-------------------|
| pausalni | pausalni |
| pdv | pdv |
| porez_dohodak | porez_dohodak |
| doprinosi | doprinosi |
| fiskalizacija | fiskalizacija |
| rokovi | rokovi |
| obrasci | obrasci |
| - | **interest_rates** |
| - | **exchange_rates** |

**Risk:** Extractions with domain "interest_rates" or "exchange_rates" would fail Zod validation if schema is strictly enforced.

**Recommendation:** Add missing domains to DomainSchema or refactor validators to use a separate domain list.

---

#### MED-02: ValueTypeSchema Missing Types

**Location:** `src/lib/regulatory-truth/schemas/common.ts:61-72`

**Issue:** ValueTypeSchema doesn't include "interest_rate" or "exchange_rate" but validators handle these types.

**Current Schema:**
```typescript
export const ValueTypeSchema = z.enum([
  "currency", "percentage", "date", "threshold", "text",
  "currency_hrk", "currency_eur", "count",
])
// Missing: "interest_rate", "exchange_rate"
```

**Recommendation:** Add missing value types to maintain consistency.

---

#### MED-03: Content Truncation in Claim Extractor

**Location:** `src/lib/regulatory-truth/agents/claim-extractor.ts:54`

**Issue:** Content is truncated to 50,000 characters before extraction:
```typescript
content: cleanedContent.slice(0, 50000), // Limit content size
```

For large regulatory documents (e.g., complete laws), important provisions in later sections may be lost.

**Recommendation:** Implement chunked extraction with overlap for documents exceeding threshold.

---

### LOW SEVERITY FINDINGS

#### LOW-01: Minimum Quote Length Too Short

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:452`

**Issue:** Quote minimum length is only 5 characters:
```typescript
if (!extraction.exact_quote || extraction.exact_quote.trim().length < 5) {
  errors.push("Exact quote is required and must be at least 5 characters")
}
```

A 5-character quote like "25%" provides insufficient context for verification.

**Recommendation:** Increase minimum to 20-30 characters for meaningful citation context.

---

#### LOW-02: No Cross-Extractor Deduplication

**Issue:** The multi-shape extractor system (claim-extractor, process-extractor, reference-extractor, asset-extractor) can produce overlapping extractions from the same evidence.

**Recommendation:** Add deduplication layer based on (evidenceId, extractedValue, exactQuote) tuple.

---

## Strength Analysis

### What Works Well

1. **Anti-Hallucination Prompt (PASS)**

   Location: `src/lib/regulatory-truth/prompts/index.ts:50-67`

   The EXTRACTOR_PROMPT has explicit, strongly-worded anti-inference instructions:
   ```
   CRITICAL RULE - NO INFERENCE ALLOWED:
   You may ONLY extract values that are EXPLICITLY STATED in the text.
   - If a value is not written character-for-character, DO NOT extract it
   - If you would need to calculate, derive, or infer a value, DO NOT extract it
   ```

2. **Value-in-Quote Verification (PASS)**

   Location: `src/lib/regulatory-truth/utils/deterministic-validators.ts:287-363`

   The `validateValueInQuote` function:
   - Handles Croatian date formats (15. siječnja 2025)
   - Normalizes thousand separators (40.000 → 40000)
   - Handles decimal comma/period variants (25,5% vs 25.5%)
   - Prevents substring matches (25 in 2025)
   - Supports JSON quote fragments

3. **Domain-Aware Validation (PASS)**

   Location: `src/lib/regulatory-truth/utils/deterministic-validators.ts:199-206`

   Domain-specific ranges prevent out-of-bounds values:
   - PDV: max 30%
   - Doprinosi: max 50%
   - Porez_dohodak: max 60%
   - Pausalni: max 1M EUR
   - Interest rates: max 20%

4. **Dead-Letter Table (PASS)**

   Location: `src/lib/regulatory-truth/agents/extractor.ts:201-218`

   Failed extractions are preserved for analysis:
   ```typescript
   await db.extractionRejected.create({
     data: {
       evidenceId: evidence.id,
       rejectionType,  // OUT_OF_RANGE, NO_QUOTE_MATCH, etc.
       rawOutput: extraction,
       errorDetails: validation.errors.join("; "),
     },
   })
   ```

5. **Coverage Gate (PASS)**

   Location: `src/lib/regulatory-truth/quality/coverage-gate.ts`

   Publication is blocked until:
   - Coverage score meets minimum (60-80% depending on content type)
   - Required shapes are present
   - Reviewer has approved

6. **Comprehensive Test Coverage (PASS)**

   Location: `src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts`

   Tests cover:
   - Percentage bounds
   - Currency validation
   - Date format validation
   - Value-in-quote verification
   - Domain-specific ranges
   - Edge cases (thousand separators, Croatian dates)

---

## Recommendations Summary

### Immediate (P0)

1. **Add validation to claim-extractor.ts** - Critical hallucination risk
   ```typescript
   // Before storing claim, validate quote
   const quoteCheck = validateValueInQuote(claim.value, claim.exactQuote)
   if (!quoteCheck.valid) {
     // Store in dead-letter and skip
   }
   ```

### Short-Term (P1)

2. **Add diacritic normalization** to handle OCR corruption
3. **Log JSON quote auto-corrections** for audit trail
4. **Update schemas** to include missing domains and value types

### Medium-Term (P2)

5. **Increase minimum quote length** to 20-30 characters
6. **Implement chunked extraction** for large documents
7. **Add cross-extractor deduplication**

---

## Test Queries for Database Verification

When database access is available, run these queries to verify extraction quality:

```sql
-- 1. Domain distribution and confidence
SELECT domain, COUNT(*), AVG(confidence)
FROM "SourcePointer"
GROUP BY domain
ORDER BY COUNT(*) DESC;

-- 2. Rejection patterns
SELECT "rejectionType", COUNT(*)
FROM "ExtractionRejected"
GROUP BY "rejectionType"
ORDER BY COUNT(*) DESC;

-- 3. High-confidence sample for manual verification
SELECT id, "extractedValue", "exactQuote", confidence
FROM "SourcePointer"
WHERE confidence > 0.95
ORDER BY RANDOM()
LIMIT 10;

-- 4. Low-coverage reports
SELECT "evidenceId", "primaryContentType", "coverageScore", "missingShapes"
FROM "CoverageReport"
WHERE "coverageScore" < 0.5
LIMIT 10;

-- 5. Recent rejections for review
SELECT er.id, er."rejectionType", er."errorDetails", e.url
FROM "ExtractionRejected" er
JOIN "Evidence" e ON er."evidenceId" = e.id
ORDER BY er."createdAt" DESC
LIMIT 5;
```

---

## Audit Artifacts

- **Audit Script Created:** `src/lib/regulatory-truth/scripts/audit-extractor.ts`
- **This Report:** `docs/07_AUDITS/AUDIT-003-EXTRACTOR-ACCURACY.md`

---

## Conclusion

The Extractor system has strong foundations for preventing hallucinations through:
- Explicit prompt instructions
- Deterministic quote verification
- Domain-specific validation
- Dead-letter tracking

However, the **AtomicClaim extraction path bypasses these protections** (CRIT-01), creating a critical gap that should be addressed immediately. With this fix and the recommended improvements, the system would provide robust hallucination prevention for regulatory fact extraction.

**Next Steps:**
1. Fix CRIT-01 (claim validation)
2. Address HIGH-01 and HIGH-02
3. Run database queries when access available
4. Schedule follow-up audit after fixes
