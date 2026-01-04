# Quote Alignment Validator Audit (INV-3)

Date: 2025-12-26
Version: 1.0
Auditor: Claude (automated code review)
Scope: Deterministic validators enforcing "no hallucination" guarantee in Regulatory Truth Layer

## Executive Summary

**Overall assessment:** PARTIALLY PRODUCTION READY

**Go/No-Go recommendation:** CONDITIONAL GO - Core validation is sound but edge cases need attention

The quote alignment validator (`validateValueInQuote`) successfully prevents most AI inference/hallucination scenarios. However, several edge cases in date, number, and locale formatting could cause either false negatives (blocking valid extractions) or false positives (accepting partial matches).

**Key findings:**

- No IBAN-specific validation exists despite IBAN concepts in the system
- OCR artifacts and Croatian diacritics are not explicitly normalized before matching
- Space-separated thousand separators (European "40 000") are not handled
- Short date formats (D.M.YYYY) may not match
- Decimal ambiguity in European vs US formats could cause confusion

**Severity counts:**

- Critical: 0
- High: 2
- Medium: 4 (1 verified as non-issue)
- Low: 3

---

## Section A: Normalization Rules Currently in Effect

### A.1 Number Normalization (`normalizeNumber`)

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:225-239`

| Input Type                       | Transformation                         | Example                     |
| -------------------------------- | -------------------------------------- | --------------------------- |
| Integer with thousand separators | Remove `.`, `,`, space                 | `40.000` → `40000`          |
| Decimal number                   | Provide both comma and period variants | `25.5` → `["25.5", "25,5"]` |
| Plain integer                    | Return as-is plus cleaned version      | `123` → `["123"]`           |

**Detection logic:**

- Decimal: Regex `/^\d+[.,]\d+$/` (exactly one separator followed by digits)
- Integer: Everything else - strip all separators

**Gap identified:** This regex treats `40.000` as an integer (correct for European thousands), but also treats `7.53` as a decimal. The heuristic is length-unaware and relies on pattern alone.

### A.2 Date Normalization (`dateToPatterns`)

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:244-272`

Converts ISO date (YYYY-MM-DD) to 6 Croatian format patterns:

| Pattern # | Format                   | Example (2025-01-15) |
| --------- | ------------------------ | -------------------- |
| 1         | ISO                      | `2025-01-15`         |
| 2         | Croatian genitive        | `15. siječnja 2025`  |
| 3         | DD.MM.YYYY               | `15.01.2025`         |
| 4         | D.M.YYYY                 | `15.1.2025`          |
| 5         | DD.MM.YYYY (zero-padded) | `15.01.2025`         |
| 6         | DD/MM/YYYY               | `15/01/2025`         |

**Croatian months (genitive case):**

```
siječnja, veljače, ožujka, travnja, svibnja, lipnja,
srpnja, kolovoza, rujna, listopada, studenoga, prosinca
```

**Gap identified:** Missing formats:

- `15.siječnja 2025.` (with trailing period, common in legal documents)
- `15.01.2025.` (with trailing period)
- `15.I.2025` (Roman numeral month, seen in older documents)

### A.3 Quote Matching Logic (`validateValueInQuote`)

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:287-363`

**Algorithm:**

1. If quote is JSON fragment → Extract value after colon, compare normalized
2. If value is ISO date → Generate 6 Croatian patterns, check if any in quote
3. If value is numeric → Generate normalized variants, use regex with boundary checks
4. Else → Simple lowercase substring match

**Number boundary regex (lines 336-350):**

```javascript
// For 4+ digit numbers: Add optional separators between digits
regexPattern = patternLower.split("").join("[.,\\s]?")
// Boundary check: (?:^|[^\d])PATTERN(?![.,\s]?\d)
```

**Purpose:** Prevents "25" from matching in "2025", prevents "40" from matching in "40.000"

### A.4 JSON Quote Handling

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:277-321`

For API responses (e.g., HNB exchange rates), handles quotes like:

```json
"middle_rate": 7.5345
```

Extracts the value after colon and compares with aggressive normalization (removes all separators).

### A.5 Domain-Specific Validation (`validateByDomain`)

**Location:** `src/lib/regulatory-truth/utils/deterministic-validators.ts:135-175`

| Domain         | Value Type    | Constraint    |
| -------------- | ------------- | ------------- |
| pdv            | percentage    | max 30%       |
| doprinosi      | percentage    | max 50%       |
| porez_dohodak  | percentage    | max 60%       |
| pausalni       | currency_eur  | max 1,000,000 |
| interest_rates | interest_rate | max 20%       |
| exchange_rates | exchange_rate | 0.0001-10,000 |

---

## Section B: Top 10 Risky Edge Cases with Reproduction

### HIGH-01: No IBAN Validation

**Evidence:**

- IBANs mentioned in concept aliases (`pdv-drzavni-proracun-iban` at `concept-resolver.ts:24-31`)
- No IBAN-specific validator exists in `deterministic-validators.ts`
- No IBAN value_type in `VALID_VALUE_TYPES` array (line 209-220)

**Reproduction:**

```typescript
// This should fail but currently silently passes with value_type: "text"
validateExtraction({
  domain: "pdv",
  value_type: "text", // No "iban" type!
  extracted_value: "HR1234567890123456789",
  exact_quote: "IBAN: HR1234567890123456789",
  confidence: 0.95,
})
```

**Risk:** Invalid IBANs pass validation. LLM could extract malformed IBANs.
**Recommendation:** Add IBAN value_type with MOD-97 checksum validation (ISO 7064).

---

### HIGH-02: OCR Artifacts Corrupt Croatian Diacritics

**Evidence:**

- Tesseract OCR runs with `hrv+eng` language pack (`tesseract.ts:37`)
- No post-OCR diacritic normalization before quote matching
- Croatian diacritics (č, ž, š, đ, ć) often become (c, z, s, d, c) or garbage

**Reproduction:**

```typescript
// OCR extracts "sijecnja" instead of "siječnja"
validateValueInQuote("2025-01-15", "do 15. sijecnja 2025.")
// Returns: { valid: false } - FALSE NEGATIVE

// OCR produces garbage: "sij€čnja"
validateValueInQuote("2025-01-15", "do 15. sij€čnja 2025.")
// Returns: { valid: false } - FALSE NEGATIVE
```

**Risk:** Valid extractions blocked due to OCR quality issues (false negatives).
**Recommendation:**

1. Add diacritic normalization layer: `čžšđć → czsdj` in both value and quote before comparison
2. For OCR content, reduce matching strictness or flag for human review

---

### MED-01: Space as Thousand Separator - VERIFIED WORKING

**Evidence:**

- `normalizeNumber` strips `.`, `,`, but regex also includes `\s`
- European/Croatian documents often use space: "40 000 EUR"

**Reproduction:**

```typescript
validateValueInQuote("40000", "prag iznosi 40 000 EUR")
// Regex pattern: "4[.,\\s]?0[.,\\s]?0[.,\\s]?0[.,\\s]?0"
// Result: PASS - correctly matches
```

**Verified:** 2025-12-26 - Test added to `deterministic-validators.test.ts:388-391`
**Status:** NOT A VULNERABILITY - working as expected

---

### MED-02: Trailing Period in Croatian Dates

**Evidence:**

- Legal documents often write: "do 15. siječnja 2025."
- `dateToPatterns` generates "15. siječnja 2025" (no trailing period)

**Reproduction:**

```typescript
validateValueInQuote("2025-01-15", "Rok je do 15. siječnja 2025.")
// Pattern "15. siječnja 2025" matches substring - OK

validateValueInQuote("2025-01-15", "do 15.01.2025.")
// Pattern "15.01.2025" matches - OK (substring match)
```

**Analysis:** Actually works due to substring matching. Not a vulnerability.
**Status:** FALSE POSITIVE IN AUDIT - no action needed.

---

### MED-03: Decimal vs Integer Ambiguity

**Evidence:**

- `40.000` treated as integer (40000) by regex `/^\d+[.,]\d+$/`
- `7.53` treated as decimal

**Reproduction:**

```typescript
// European thousand separator
validateValueInQuote("40000", "prag od 40.000 EUR")
// Works correctly - treats as integer

// Exchange rate with 4 decimals
validateValueInQuote("7.5345", "tečaj: 7.5345")
// Works correctly - treated as decimal

// EDGE CASE: Three-digit decimal
validateValueInQuote("40.000", "postotak: 40.000%")
// Regex: /^\d+[.,]\d+$/ matches → treated as DECIMAL
// Returns patterns: ["40.000", "40,000", "40.000"]
// Should find match - OK
```

**Risk:** Low - the heuristic works for most cases.
**Recommendation:** Consider explicit value_type hint from LLM to disambiguate.

---

### MED-04: Short Numbers May Match in Longer Context

**Evidence:**

- Boundary regex prevents "25" matching "2025"
- But what about "5" matching "25" or "15"?

**Reproduction:**

```typescript
validateValueInQuote("5", "stopa iznosi 25%")
// Regex: (?:^|[^\d])5(?![.,\s]?\d)
// "25%" - the "5" is preceded by "2" (a digit) → No match - CORRECT

validateValueInQuote("5", "PDV je 5%")
// "5%" - preceded by space, followed by % → Match - CORRECT
```

**Analysis:** Boundary protection works correctly.
**Status:** NOT A VULNERABILITY - validation is sound.

---

### MED-05: Partial Year Match in Date Context

**Evidence:**

- The test case at line 159-163 checks this explicitly

**Reproduction:**

```typescript
validateValueInQuote("25", "Za 2025. godinu stopa iznosi 13%")
// Pattern: 25 (short number, < 4 digits)
// Regex: (?:^|[^\d])25(?![.,\s]?\d)
// In "2025." - "25" preceded by "0" (digit) → No match - CORRECT
```

**Status:** PROTECTED - test case exists, validation correct.

---

### LOW-01: Case Sensitivity in Text Matching

**Evidence:**

- Quote is lowercased: `quote.toLowerCase()` (line 292)
- Value is converted to string but patterns use `toLowerCase()` (line 335)

**Risk:** Very low - case-insensitive matching is correct behavior.

---

### LOW-02: Unicode Normalization Not Applied

**Evidence:**

- No explicit Unicode NFC/NFD normalization before comparison
- Croatian characters may have composed vs decomposed forms

**Reproduction:**

```typescript
// "č" as single character (NFC: U+010D)
// "č" as c + combining caron (NFD: U+0063 + U+030C)
// These may not compare equal without normalization
```

**Risk:** Very low - most text is already NFC normalized.
**Recommendation:** Add `.normalize('NFC')` as defensive measure.

---

### LOW-03: Selector Field Not Validated

**Evidence:**

- `selector` field stored in SourcePointer (`extractor.ts:239`)
- No validation that selector actually locates the quote in source

**Risk:** Low - selector is informational, not used for verification.

---

## Section C: Recommended Split Storage Architecture

### Current State

Currently, extracted values are stored in two columns:

- `extractedValue: String` - the normalized/parsed value
- `displayValue: String` - human-readable format

### Recommendation: Three-Column Model

```prisma
model SourcePointer {
  // Existing
  extractedValue   String   // Normalized: "40000", "2025-01-15", "25"
  displayValue     String   // Display: "€40,000", "15. siječnja 2025.", "25%"

  // NEW: Add literal preservation
  literalValue     String?  // Exact from source: "40.000", "15. siječnja 2025.", "25"
  normalization    Json?    // { "method": "number_eu", "original": "40.000" }
}
```

### Benefits

1. **Audit trail:** Can verify exactly what was in the source
2. **Debugging:** When validation fails, can see original vs normalized
3. **Locale handling:** Store locale hint with normalization method
4. **Reversibility:** Can regenerate display values from literal + locale

### Migration Path

1. Add nullable `literalValue` column
2. For new extractions, populate from `exact_quote` parsing
3. Backfill existing data where possible
4. Update validation to log normalization method

---

## Section D: Acceptance Thresholds and Recommended Tests

### D.1 Current Thresholds

**From `schemas/common.ts` (lines 73-85):**

```typescript
CONFIDENCE_THRESHOLDS = {
  T0: 0.99, // Critical rules
  T1: 0.95, // High-risk rules
  T2: 0.9, // Medium-risk rules
  T3: 0.85, // Low-risk rules
}

AUTO_APPROVE_THRESHOLDS = {
  T0: never, // Always human review
  T1: never, // Always human review
  T2: 0.95, // Auto-approve if ≥0.95
  T3: 0.9, // Auto-approve if ≥0.90
}
```

### D.2 Quote Validation Acceptance Criteria

| Criterion                                    | Threshold             | Current Status     |
| -------------------------------------------- | --------------------- | ------------------ |
| Value appears in quote (exact or normalized) | 100% required         | ✅ Implemented     |
| Date patterns supported                      | 6 Croatian formats    | ✅ Implemented     |
| Number thousand separator handling           | `.`, `,`              | ✅ Implemented     |
| Decimal comma/period equivalence             | Both accepted         | ✅ Implemented     |
| Boundary protection (no partial matches)     | 100% for numbers      | ✅ Implemented     |
| IBAN validation                              | Checksum verified     | ❌ Not implemented |
| OCR artifact tolerance                       | Diacritic fuzzy match | ❌ Not implemented |

### D.3 Recommended Additional Tests

Add to `deterministic-validators.test.ts`:

```typescript
describe("validateValueInQuote - edge cases", () => {
  // HIGH-01: IBAN support (after implementing)
  it("validates Croatian IBAN format", () => {
    const result = validateValueInQuote(
      "HR1210010051863000160",
      "Uplatiti na IBAN: HR1210010051863000160"
    )
    assert.strictEqual(result.valid, true)
  })

  // HIGH-02: Diacritic normalization (after implementing)
  it("matches date despite OCR diacritic corruption", () => {
    const result = validateValueInQuote(
      "2025-01-15",
      "do 15. sijecnja 2025." // OCR: č→c
    )
    assert.strictEqual(result.valid, true)
  })

  // MED-01: Space thousand separator
  it("matches number with space thousand separator", () => {
    const result = validateValueInQuote("40000", "iznosi 40 000 EUR")
    assert.strictEqual(result.valid, true)
  })

  // Additional date formats
  it("matches date with trailing period", () => {
    const result = validateValueInQuote("2025-01-15", "do 15.01.2025.")
    assert.strictEqual(result.valid, true)
  })

  // Exchange rate edge case
  it("matches exchange rate with many decimals", () => {
    const result = validateValueInQuote("7.53450", '"middle_rate": 7.53450')
    assert.strictEqual(result.valid, true)
  })

  // Negative test: partial IBAN
  it("rejects partial IBAN match", () => {
    const result = validateValueInQuote("HR12", "IBAN: HR1210010051863000160")
    assert.strictEqual(result.valid, false)
  })
})
```

### D.4 Health Gate Thresholds

**From `health-gates.ts` (lines 135-183):**

| Gate                     | Metric                                    | Critical | Degraded | Current Behavior |
| ------------------------ | ----------------------------------------- | -------- | -------- | ---------------- |
| Gate 2: Quote Validation | % extractions rejected for NO_QUOTE_MATCH | >10%     | >5%      | ✅ Monitored     |

**Recommendation:** Add additional health gates:

- Gate for OCR confidence (avg < 60% = degraded)
- Gate for specific rejection types (IBAN validation failures)

---

## Section E: Summary of Recommendations

### Immediate Actions (Before Production)

| ID      | Finding            | Action                          | Effort |
| ------- | ------------------ | ------------------------------- | ------ |
| HIGH-01 | No IBAN validation | Add IBAN value_type with MOD-97 | 4h     |
| HIGH-02 | OCR diacritics     | Add normalization layer         | 8h     |

### Short-Term Improvements

| ID         | Finding              | Action                            | Effort          |
| ---------- | -------------------- | --------------------------------- | --------------- |
| ~~MED-01~~ | ~~Space separators~~ | ~~Verify/fix regex handling~~     | ~~VERIFIED OK~~ |
| MED-03     | Decimal ambiguity    | Add value_type hint to extraction | 4h              |
| LOW-02     | Unicode NFC          | Add `.normalize('NFC')`           | 1h              |

### Architectural Enhancements

| ID  | Recommendation          | Benefit                | Effort |
| --- | ----------------------- | ---------------------- | ------ |
| C-1 | Three-column model      | Audit trail, debugging | 16h    |
| D-4 | Additional health gates | Proactive monitoring   | 4h     |

---

## Appendix: Code References

| File                                         | Lines   | Purpose                               |
| -------------------------------------------- | ------- | ------------------------------------- |
| `utils/deterministic-validators.ts`          | 287-363 | `validateValueInQuote` implementation |
| `utils/deterministic-validators.ts`          | 225-239 | `normalizeNumber`                     |
| `utils/deterministic-validators.ts`          | 244-272 | `dateToPatterns`                      |
| `utils/deterministic-validators.ts`          | 365-466 | `validateExtraction`                  |
| `agents/extractor.ts`                        | 179-220 | Extraction validation pipeline        |
| `utils/ocr-processor.ts`                     | 35-83   | OCR processing with confidence        |
| `utils/tesseract.ts`                         | 22-51   | Tesseract OCR wrapper                 |
| `__tests__/deterministic-validators.test.ts` | 132-180 | Quote validation tests                |
| `__tests__/deterministic-validators.test.ts` | 387-434 | Edge case tests (added by this audit) |

---

## Verification Summary

All edge case tests added and verified:

- ✅ Space thousand separators: WORKING
- ✅ Trailing period on date: WORKING
- ✅ Short date format D.M.YYYY: WORKING
- ✅ JSON exchange rate: WORKING
- ✅ IBAN text match: WORKING
- ✅ Partial year rejection: WORKING
- ✅ Decimal comma locale: WORKING
- ❌ OCR diacritic corruption: CONFIRMED FAILURE (HIGH-02)

Total tests: 58 pass, 0 fail

---

## Revision History

| Version | Date       | Author | Changes       |
| ------- | ---------- | ------ | ------------- |
| 1.0     | 2025-12-26 | Claude | Initial audit |
