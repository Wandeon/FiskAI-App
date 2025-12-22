# Regulatory Truth Accuracy & Trust Sprint

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve extraction accuracy and stakeholder trust through no-inference validation, deterministic pre-checks, temporal re-validation, and article-level source anchoring.

**Architecture:** Four independent improvements that each add a validation or tracking layer to the existing pipeline. No changes to core agent flow - only additions of validators, schema fields, and background jobs.

**Tech Stack:** TypeScript, Zod validation, Prisma migrations, BullMQ workers, node-cron scheduler

---

## Phase 1: Deterministic Pre-AI Validation (Day 1)

### Task 1: Create validation utilities module

**Files:**

- Create: `src/lib/regulatory-truth/utils/deterministic-validators.ts`
- Test: `src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  validatePercentage,
  validateCurrency,
  validateDate,
  validateNumericRange,
  validateExtraction,
} from "../utils/deterministic-validators"

describe("deterministic-validators", () => {
  describe("validatePercentage", () => {
    it("accepts valid percentages 0-100", () => {
      assert.strictEqual(validatePercentage(25).valid, true)
      assert.strictEqual(validatePercentage(0).valid, true)
      assert.strictEqual(validatePercentage(100).valid, true)
    })

    it("rejects percentages > 100", () => {
      const result = validatePercentage(150)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 100"))
    })

    it("rejects negative percentages", () => {
      const result = validatePercentage(-5)
      assert.strictEqual(result.valid, false)
    })
  })

  describe("validateCurrency", () => {
    it("accepts reasonable EUR amounts", () => {
      assert.strictEqual(validateCurrency(40000, "eur").valid, true)
      assert.strictEqual(validateCurrency(1000000, "eur").valid, true)
    })

    it("rejects negative amounts", () => {
      const result = validateCurrency(-100, "eur")
      assert.strictEqual(result.valid, false)
    })

    it("rejects absurdly large amounts", () => {
      const result = validateCurrency(999999999999, "eur")
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("unrealistic"))
    })
  })

  describe("validateDate", () => {
    it("accepts valid ISO dates", () => {
      assert.strictEqual(validateDate("2025-01-15").valid, true)
    })

    it("rejects invalid date formats", () => {
      assert.strictEqual(validateDate("15/01/2025").valid, false)
      assert.strictEqual(validateDate("2025-13-01").valid, false)
    })

    it("rejects dates too far in past", () => {
      const result = validateDate("1900-01-01")
      assert.strictEqual(result.valid, false)
    })

    it("rejects dates too far in future", () => {
      const result = validateDate("2100-01-01")
      assert.strictEqual(result.valid, false)
    })
  })

  describe("validateExtraction", () => {
    it("passes valid extraction", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 25,
        exact_quote: "PDV stopa iznosi 25%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
      assert.deepStrictEqual(result.errors, [])
    })

    it("catches invalid percentage", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 150,
        exact_quote: "stopa iznosi 150%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.length > 0)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Implement the validators**

```typescript
// src/lib/regulatory-truth/utils/deterministic-validators.ts

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface ExtractionValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Percentage must be 0-100
export function validatePercentage(value: number): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Percentage must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Percentage cannot be negative" }
  }
  if (value > 100) {
    return { valid: false, error: "Percentage cannot exceed 100" }
  }
  return { valid: true }
}

// Currency must be positive and reasonable
export function validateCurrency(value: number, currency: "eur" | "hrk"): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Currency amount must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Currency amount cannot be negative" }
  }
  // Max reasonable regulatory amount: 100 billion EUR
  const maxAmount = currency === "eur" ? 100_000_000_000 : 750_000_000_000
  if (value > maxAmount) {
    return { valid: false, error: `Currency amount ${value} is unrealistic` }
  }
  return { valid: true }
}

// Date must be valid ISO format and within reasonable range
export function validateDate(value: string): ValidationResult {
  // Must match YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, error: "Date must be ISO format YYYY-MM-DD" }
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date" }
  }

  // Check month/day validity (JS Date accepts 2025-13-01 as 2026-01-01)
  const [year, month, day] = value.split("-").map(Number)
  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month" }
  }
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: "Invalid day for month" }
  }

  // Reasonable range: 1990 to 2050
  if (year < 1990) {
    return { valid: false, error: "Date too far in the past (before 1990)" }
  }
  if (year > 2050) {
    return { valid: false, error: "Date too far in the future (after 2050)" }
  }

  return { valid: true }
}

// Validate numeric is within expected range for type
export function validateNumericRange(value: number, min: number, max: number): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Value must be a number" }
  }
  if (value < min) {
    return { valid: false, error: `Value ${value} below minimum ${min}` }
  }
  if (value > max) {
    return { valid: false, error: `Value ${value} above maximum ${max}` }
  }
  return { valid: true }
}

// Known domains for validation
const VALID_DOMAINS = [
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
]

// Known value types
const VALID_VALUE_TYPES = [
  "currency",
  "percentage",
  "date",
  "threshold",
  "text",
  "currency_hrk",
  "currency_eur",
  "count",
]

// Validate a complete extraction before it goes to AI review
export function validateExtraction(extraction: {
  domain: string
  value_type: string
  extracted_value: string | number
  exact_quote: string
  confidence: number
}): ExtractionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Domain validation
  if (!VALID_DOMAINS.includes(extraction.domain)) {
    errors.push(`Unknown domain: ${extraction.domain}`)
  }

  // Value type validation
  if (!VALID_VALUE_TYPES.includes(extraction.value_type)) {
    errors.push(`Unknown value_type: ${extraction.value_type}`)
  }

  // Type-specific validation
  const value = extraction.extracted_value
  const numValue = typeof value === "number" ? value : parseFloat(String(value))

  switch (extraction.value_type) {
    case "percentage": {
      const result = validatePercentage(numValue)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_eur":
    case "currency": {
      const result = validateCurrency(numValue, "eur")
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_hrk": {
      const result = validateCurrency(numValue, "hrk")
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "date": {
      const result = validateDate(String(value))
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "count": {
      const result = validateNumericRange(numValue, 0, 1_000_000_000)
      if (!result.valid) errors.push(result.error!)
      break
    }
  }

  // Confidence validation
  if (extraction.confidence < 0 || extraction.confidence > 1) {
    errors.push(`Confidence ${extraction.confidence} must be between 0 and 1`)
  }

  // Exact quote validation
  if (!extraction.exact_quote || extraction.exact_quote.trim().length < 5) {
    errors.push("Exact quote is required and must be at least 5 characters")
  }

  // Warning for low confidence
  if (extraction.confidence < 0.7) {
    warnings.push(`Low confidence extraction: ${extraction.confidence}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/utils/deterministic-validators.ts src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
git commit -m "feat(regulatory): add deterministic pre-AI validators

- validatePercentage: 0-100 range check
- validateCurrency: positive, reasonable amount check
- validateDate: ISO format, 1990-2050 range
- validateExtraction: combines all checks for extraction records"
```

---

### Task 2: Integrate validators into extractor

**Files:**

- Modify: `src/lib/regulatory-truth/agents/extractor.ts:77-97`

**Step 1: Add validation before storing source pointers**

After line 76 in extractor.ts (before the for loop that stores pointers), add validation:

```typescript
// src/lib/regulatory-truth/agents/extractor.ts
// Add import at top
import { validateExtraction } from "../utils/deterministic-validators"

// ... existing code ...

// Store source pointers (with validation)
const sourcePointerIds: string[] = []
const rejectedExtractions: Array<{ extraction: unknown; errors: string[] }> = []

for (const extraction of result.output.extractions) {
  // Validate extraction before storing
  const validation = validateExtraction({
    domain: extraction.domain,
    value_type: extraction.value_type,
    extracted_value: extraction.extracted_value,
    exact_quote: extraction.exact_quote,
    confidence: extraction.confidence,
  })

  if (!validation.valid) {
    console.log(`[extractor] Rejected extraction: ${validation.errors.join(", ")}`)
    rejectedExtractions.push({ extraction, errors: validation.errors })
    continue // Skip invalid extractions
  }

  if (validation.warnings.length > 0) {
    console.log(`[extractor] Warnings: ${validation.warnings.join(", ")}`)
  }

  const pointer = await db.sourcePointer.create({
    data: {
      evidenceId: evidence.id,
      domain: extraction.domain,
      valueType: extraction.value_type,
      extractedValue: String(extraction.extracted_value),
      displayValue: extraction.display_value ?? String(extraction.extracted_value),
      exactQuote: extraction.exact_quote,
      contextBefore: extraction.context_before,
      contextAfter: extraction.context_after,
      selector: extraction.selector,
      confidence: extraction.confidence,
      extractionNotes: extraction.extraction_notes,
    },
  })
  sourcePointerIds.push(pointer.id)
}

// Log rejection stats
if (rejectedExtractions.length > 0) {
  console.log(
    `[extractor] Rejected ${rejectedExtractions.length}/${result.output.extractions.length} extractions due to validation`
  )
}
```

**Step 2: Run existing tests**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts
```

Expected: PASS (existing tests still work)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/agents/extractor.ts
git commit -m "feat(extractor): integrate deterministic validators

Extractions are now validated before storage:
- Invalid extractions are rejected with logged errors
- Warnings logged for low-confidence extractions
- Rejection stats tracked per batch"
```

---

## Phase 2: No-Inference Extraction Mode (Day 2)

### Task 3: Add string-match validation for exact quotes

**Files:**

- Modify: `src/lib/regulatory-truth/utils/deterministic-validators.ts`
- Modify: `src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts`

**Step 1: Add failing test for quote validation**

```typescript
// Add to deterministic-validators.test.ts

describe("validateValueInQuote", () => {
  it("accepts when value appears in quote", () => {
    const result = validateValueInQuote("25", "PDV stopa iznosi 25%")
    assert.strictEqual(result.valid, true)
  })

  it("accepts numeric match with formatting", () => {
    const result = validateValueInQuote("40000", "Prag iznosi 40.000 EUR")
    assert.strictEqual(result.valid, true)
  })

  it("accepts date match", () => {
    const result = validateValueInQuote("2025-01-15", "do 15. siječnja 2025.")
    assert.strictEqual(result.valid, true)
  })

  it("rejects when value NOT in quote", () => {
    const result = validateValueInQuote("30", "PDV stopa iznosi 25%")
    assert.strictEqual(result.valid, false)
    assert.ok(result.error?.includes("not found"))
  })

  it("rejects inferred values", () => {
    // Quote mentions revenue but not the specific threshold
    const result = validateValueInQuote("39816.84", "Paušalni obrt ima prag prihoda")
    assert.strictEqual(result.valid, false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
```

Expected: FAIL with "validateValueInQuote is not a function"

**Step 3: Implement quote validation**

```typescript
// Add to deterministic-validators.ts

/**
 * Normalize a number for matching: remove formatting like "40.000" → "40000"
 */
function normalizeNumber(value: string): string[] {
  const cleaned = value.replace(/[.,\s]/g, "")
  // Return both original and cleaned for matching
  return [value, cleaned]
}

/**
 * Convert ISO date to Croatian format patterns for matching
 * 2025-01-15 → ["15. siječnja 2025", "15.01.2025", "15.1.2025", "15/01/2025"]
 */
function dateToPatterns(isoDate: string): string[] {
  const months = [
    "siječnja",
    "veljače",
    "ožujka",
    "travnja",
    "svibnja",
    "lipnja",
    "srpnja",
    "kolovoza",
    "rujna",
    "listopada",
    "studenoga",
    "prosinca",
  ]

  const [year, month, day] = isoDate.split("-")
  const monthNum = parseInt(month)
  const dayNum = parseInt(day)

  return [
    isoDate, // 2025-01-15
    `${dayNum}. ${months[monthNum - 1]} ${year}`, // 15. siječnja 2025
    `${dayNum}.${month}.${year}`, // 15.01.2025
    `${dayNum}.${monthNum}.${year}`, // 15.1.2025
    `${day}.${month}.${year}`, // 15.01.2025
    `${dayNum}/${month}/${year}`, // 15/01/2025
  ]
}

/**
 * Validate that the extracted value actually appears in the exact quote.
 * This prevents AI "inference" where values are derived but not explicitly stated.
 */
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string
): ValidationResult {
  const value = String(extractedValue)
  const quote = exactQuote.toLowerCase()

  // Generate patterns to search for
  let patterns: string[] = []

  // Check if it's a date (YYYY-MM-DD format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    patterns = dateToPatterns(value)
  }
  // Check if it's numeric
  else if (/^[\d.,]+$/.test(value)) {
    patterns = normalizeNumber(value)
  }
  // Plain text match
  else {
    patterns = [value]
  }

  // Check if any pattern appears in the quote
  const quoteLower = quote.toLowerCase()
  const found = patterns.some((pattern) => {
    const patternLower = pattern.toLowerCase()
    // For numbers, also check without thousand separators
    if (/^\d+$/.test(patternLower)) {
      // Match the number with possible formatting in quote
      const numRegex = new RegExp(patternLower.split("").join("[.,\\s]?"), "i")
      return numRegex.test(quote)
    }
    return quoteLower.includes(patternLower)
  })

  if (!found) {
    return {
      valid: false,
      error: `Value "${value}" not found in quote. Possible inference detected.`,
    }
  }

  return { valid: true }
}
```

**Step 4: Integrate into validateExtraction**

```typescript
// Update validateExtraction in deterministic-validators.ts

export function validateExtraction(extraction: {
  domain: string
  value_type: string
  extracted_value: string | number
  exact_quote: string
  confidence: number
}): ExtractionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // ... existing validation code ...

  // NO-INFERENCE CHECK: Value must appear in quote
  if (extraction.value_type !== "text") {
    const quoteCheck = validateValueInQuote(extraction.extracted_value, extraction.exact_quote)
    if (!quoteCheck.valid) {
      errors.push(quoteCheck.error!)
    }
  }

  // ... rest of existing code ...
}
```

**Step 5: Run tests**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/lib/regulatory-truth/utils/deterministic-validators.ts src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
git commit -m "feat(validators): add no-inference quote validation

Values must appear explicitly in exact_quote:
- Numeric matching with thousand-separator tolerance
- Croatian date format matching (15. siječnja 2025)
- Rejects extractions where value is inferred, not stated"
```

---

### Task 4: Update extractor prompt to emphasize no-inference

**Files:**

- Modify: `src/lib/regulatory-truth/prompts/index.ts:44-106`

**Step 1: Add explicit no-inference instructions to prompt**

Update the EXTRACTOR_PROMPT constant:

```typescript
export const EXTRACTOR_PROMPT = `
ROLE: You are the Extractor Agent. You parse regulatory documents and
extract specific data points with precise citations.

INPUT: An Evidence record containing regulatory content.

CRITICAL RULE - NO INFERENCE ALLOWED:
You may ONLY extract values that are EXPLICITLY STATED in the text.
- If a value is not written character-for-character, DO NOT extract it
- If you would need to calculate, derive, or infer a value, DO NOT extract it
- If the text says "threshold" but doesn't give the number, DO NOT guess
- The exact_quote MUST contain the extracted_value (or its formatted equivalent)

EXAMPLES OF WHAT NOT TO DO:
- Text says "paušalni obrt" → DO NOT infer the 40,000 EUR threshold
- Text says "standard VAT rate applies" → DO NOT infer 25%
- Text says "deadline is end of month" → DO NOT convert to specific date

EXAMPLES OF CORRECT EXTRACTION:
- Text says "stopa PDV-a iznosi 25%" → Extract 25, percentage ✓
- Text says "prag od 40.000 EUR" → Extract 40000, currency_eur ✓
- Text says "do 15. siječnja 2025." → Extract 2025-01-15, date ✓

TASK:
1. Identify all regulatory values, thresholds, rates, and deadlines
2. For each, extract:
   - The exact value (number, date, percentage, etc.)
   - The exact quote containing this value (MUST include the value!)
   - Surrounding context (sentence before and after)
   - A CSS selector or XPath to locate this in the original
3. Classify each extraction by regulatory domain

DOMAINS:
- pausalni: Paušalni obrt thresholds, rates, deadlines
- pdv: VAT rates, thresholds, exemptions
- porez_dohodak: Income tax brackets, deductions
- doprinosi: Contribution rates (health, pension)
- fiskalizacija: Fiscalization rules, schemas
- rokovi: Deadlines, calendars
- obrasci: Form requirements, field specs

OUTPUT FORMAT:
{
  "evidence_id": "ID of the input evidence",
  "extractions": [
    {
      "id": "unique extraction ID",
      "domain": "one of the domains above",
      "value_type": "currency" | "percentage" | "date" | "threshold" | "text",
      "extracted_value": "the value (e.g., 40000, 0.25, 2024-01-31)",
      "display_value": "human readable (e.g., €40,000, 25%, 31. siječnja 2024.)",
      "exact_quote": "the exact text from source CONTAINING THIS VALUE",
      "context_before": "previous sentence or paragraph",
      "context_after": "following sentence or paragraph",
      "selector": "CSS selector or XPath to locate",
      "confidence": 0.0-1.0,
      "extraction_notes": "any ambiguity or concerns"
    }
  ],
  "extraction_metadata": {
    "total_extractions": number,
    "by_domain": { "domain": count },
    "low_confidence_count": number,
    "processing_notes": "any issues encountered"
  }
}

CONFIDENCE SCORING:
- 1.0: Explicit, unambiguous value in clear context
- 0.9: Clear value but context could apply to multiple scenarios
- 0.8: Value present but requires interpretation of scope
- <0.8: DO NOT EXTRACT - if you're not 80% sure, skip it

CONSTRAINTS:
- NEVER infer values not explicitly stated (CRITICAL!)
- Quote EXACTLY, preserve Croatian characters
- The exact_quote MUST contain the extracted_value
- If unsure, DO NOT extract - fewer correct extractions beats many wrong ones
- Flag any ambiguous language in extraction_notes
`.trim()
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/prompts/index.ts
git commit -m "feat(prompts): add strict no-inference rules to extractor

- CRITICAL RULE section explaining no-inference policy
- Examples of what NOT to do (inferring thresholds)
- Examples of correct extraction
- Lowered confidence threshold to 0.8 minimum"
```

---

## Phase 3: Article-Level Anchoring (Day 3-4)

### Task 5: Add article reference fields to schema

**Files:**

- Create: `prisma/migrations/YYYYMMDD_add_article_anchoring/migration.sql`
- Modify: `prisma/schema.prisma:1745-1767`

**Step 1: Add fields to Prisma schema**

Update the SourcePointer model in schema.prisma:

```prisma
model SourcePointer {
  id              String   @id @default(cuid())
  evidenceId      String
  domain          String   // pausalni, pdv, doprinosi, fiskalizacija, etc.
  valueType       String   // currency, percentage, date, threshold, text
  extractedValue  String   // Stored as string, parsed by application
  displayValue    String   // Human-readable format
  exactQuote      String   @db.Text  // Exact text from source
  contextBefore   String?  @db.Text  // Previous sentence/paragraph
  contextAfter    String?  @db.Text  // Following sentence/paragraph
  selector        String?  // CSS selector or XPath

  // NEW: Article-level anchoring
  articleNumber   String?  // e.g., "38", "12a"
  paragraphNumber String?  // e.g., "1", "2"
  lawReference    String?  // e.g., "Zakon o PDV-u (NN 73/13)"

  confidence      Float    @default(0.8)
  extractionNotes String?
  createdAt       DateTime @default(now())
  deletedAt       DateTime?

  evidence        Evidence @relation(fields: [evidenceId], references: [id], onDelete: SetNull)
  rules           RegulatoryRule[] @relation("RuleSourcePointers")

  @@index([evidenceId])
  @@index([domain])
  @@index([confidence])
  @@index([articleNumber])  // NEW: Index for article lookups
}
```

**Step 2: Generate and apply migration**

```bash
npx prisma migrate dev --name add_article_anchoring
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add article-level anchoring to SourcePointer

New fields:
- articleNumber: Article reference (e.g., '38', '12a')
- paragraphNumber: Paragraph within article
- lawReference: Full law citation (e.g., 'Zakon o PDV-u (NN 73/13)')

Enables auditors to verify exact legal source"
```

---

### Task 6: Update extractor schema for article extraction

**Files:**

- Modify: `src/lib/regulatory-truth/schemas/extractor.ts:21-34`

**Step 1: Add article fields to ExtractionItemSchema**

```typescript
export const ExtractionItemSchema = z.object({
  id: z.string().nullish().default(""),
  domain: DomainSchema,
  value_type: ValueTypeSchema,
  extracted_value: z.union([z.string(), z.number()]),
  display_value: z.string().nullish().default(""),
  exact_quote: z.string().min(1),
  context_before: z.string().nullish().default(""),
  context_after: z.string().nullish().default(""),
  selector: z.string().nullish().default(""),

  // Article-level anchoring
  article_number: z.string().nullish().default(null),
  paragraph_number: z.string().nullish().default(null),
  law_reference: z.string().nullish().default(null),

  confidence: ConfidenceSchema,
  extraction_notes: z.string().nullish().default(""),
})
```

**Step 2: Update extractor agent to store new fields**

```typescript
// In extractor.ts, update the db.sourcePointer.create call:
const pointer = await db.sourcePointer.create({
  data: {
    evidenceId: evidence.id,
    domain: extraction.domain,
    valueType: extraction.value_type,
    extractedValue: String(extraction.extracted_value),
    displayValue: extraction.display_value ?? String(extraction.extracted_value),
    exactQuote: extraction.exact_quote,
    contextBefore: extraction.context_before,
    contextAfter: extraction.context_after,
    selector: extraction.selector,
    // Article anchoring
    articleNumber: extraction.article_number,
    paragraphNumber: extraction.paragraph_number,
    lawReference: extraction.law_reference,
    confidence: extraction.confidence,
    extractionNotes: extraction.extraction_notes,
  },
})
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/schemas/extractor.ts src/lib/regulatory-truth/agents/extractor.ts
git commit -m "feat(extractor): support article-level anchoring fields

ExtractionItemSchema now includes:
- article_number
- paragraph_number
- law_reference

These flow through to SourcePointer storage"
```

---

### Task 7: Update extractor prompt for article extraction

**Files:**

- Modify: `src/lib/regulatory-truth/prompts/index.ts`

**Step 1: Add article extraction instructions**

Add to EXTRACTOR_PROMPT output format:

```typescript
// In the OUTPUT FORMAT section, update the extraction object:
{
  "id": "unique extraction ID",
  "domain": "one of the domains above",
  "value_type": "currency" | "percentage" | "date" | "threshold" | "text",
  "extracted_value": "the value",
  "display_value": "human readable",
  "exact_quote": "the exact text from source CONTAINING THIS VALUE",
  "context_before": "previous sentence or paragraph",
  "context_after": "following sentence or paragraph",
  "selector": "CSS selector or XPath to locate",

  "article_number": "article number if identifiable (e.g., '38', '12a')",
  "paragraph_number": "paragraph number within article if identifiable",
  "law_reference": "full law citation if identifiable (e.g., 'Zakon o PDV-u (NN 73/13)')",

  "confidence": 0.0-1.0,
  "extraction_notes": "any ambiguity or concerns"
}
```

Add new section to prompt:

```typescript
ARTICLE EXTRACTION:
When extracting values, also identify the legal source:
- article_number: Look for "članak X", "čl. X", "Article X"
- paragraph_number: Look for "stavak X", "st. X", "(X)"
- law_reference: Look for "Zakon o...", "Pravilnik o...", "(NN XX/YY)"

Examples:
- "Prema članku 38. stavku 1. Zakona o PDV-u (NN 73/13)..."
  → article_number: "38", paragraph_number: "1", law_reference: "Zakon o PDV-u (NN 73/13)"

- "...sukladno čl. 12a Pravilnika..."
  → article_number: "12a", law_reference: "Pravilnik"

If article reference is not clear, leave these fields null - DO NOT guess.
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/prompts/index.ts
git commit -m "feat(prompts): add article extraction instructions

Extractor now attempts to identify:
- Article numbers (članak, čl., Article)
- Paragraph numbers (stavak, st.)
- Law references (NN citations)"
```

---

## Phase 4: Temporal Re-validation Job (Day 4)

### Task 8: Create confidence decay function

**Files:**

- Create: `src/lib/regulatory-truth/utils/confidence-decay.ts`
- Test: `src/lib/regulatory-truth/__tests__/confidence-decay.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/regulatory-truth/__tests__/confidence-decay.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { calculateConfidenceDecay, getRulesNeedingRevalidation } from "../utils/confidence-decay"

describe("confidence-decay", () => {
  describe("calculateConfidenceDecay", () => {
    it("returns 0 decay for rules under 3 months old", () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(oneMonthAgo)
      assert.strictEqual(decay, 0)
    })

    it("returns 0.05 decay for rules 3-6 months old", () => {
      const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(fourMonthsAgo)
      assert.strictEqual(decay, 0.05)
    })

    it("returns 0.10 decay for rules 6-12 months old", () => {
      const eightMonthsAgo = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(eightMonthsAgo)
      assert.strictEqual(decay, 0.1)
    })

    it("returns 0.20 decay for rules over 12 months old", () => {
      const fifteenMonthsAgo = new Date(Date.now() - 450 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(fifteenMonthsAgo)
      assert.strictEqual(decay, 0.2)
    })

    it("caps decay at 0.30", () => {
      const threeYearsAgo = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(threeYearsAgo)
      assert.ok(decay <= 0.3)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/confidence-decay.test.ts
```

**Step 3: Implement confidence decay**

```typescript
// src/lib/regulatory-truth/utils/confidence-decay.ts
import { db } from "@/lib/db"

/**
 * Calculate confidence decay based on rule age.
 *
 * Decay schedule:
 * - 0-3 months: 0% decay
 * - 3-6 months: 5% decay
 * - 6-12 months: 10% decay
 * - 12+ months: 20% decay
 * - Max decay: 30%
 */
export function calculateConfidenceDecay(lastVerifiedAt: Date): number {
  const now = new Date()
  const ageMs = now.getTime() - lastVerifiedAt.getTime()
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000)

  if (ageMonths < 3) return 0
  if (ageMonths < 6) return 0.05
  if (ageMonths < 12) return 0.1
  if (ageMonths < 24) return 0.2
  return 0.3 // Cap at 30% decay
}

/**
 * Apply confidence decay to stale rules.
 * Returns count of rules updated.
 */
export async function applyConfidenceDecay(): Promise<{
  checked: number
  decayed: number
  details: Array<{
    ruleId: string
    oldConfidence: number
    newConfidence: number
    ageMonths: number
  }>
}> {
  // Get published/approved rules
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED"] },
    },
    select: {
      id: true,
      conceptSlug: true,
      confidence: true,
      updatedAt: true,
      riskTier: true,
    },
  })

  const details: Array<{
    ruleId: string
    oldConfidence: number
    newConfidence: number
    ageMonths: number
  }> = []

  let decayed = 0

  for (const rule of rules) {
    const decay = calculateConfidenceDecay(rule.updatedAt)

    if (decay > 0) {
      const newConfidence = Math.max(0.5, rule.confidence - decay) // Floor at 0.5

      // Only update if meaningful change
      if (Math.abs(newConfidence - rule.confidence) > 0.001) {
        await db.regulatoryRule.update({
          where: { id: rule.id },
          data: {
            confidence: newConfidence,
            reviewerNotes: JSON.stringify({
              temporal_decay_applied: true,
              previous_confidence: rule.confidence,
              decay_amount: decay,
              applied_at: new Date().toISOString(),
            }),
          },
        })

        const ageMs = Date.now() - rule.updatedAt.getTime()
        const ageMonths = Math.round(ageMs / (30 * 24 * 60 * 60 * 1000))

        details.push({
          ruleId: rule.id,
          oldConfidence: rule.confidence,
          newConfidence,
          ageMonths,
        })

        decayed++
        console.log(
          `[decay] ${rule.conceptSlug}: ${rule.confidence.toFixed(2)} → ${newConfidence.toFixed(2)} (${ageMonths} months old)`
        )
      }
    }
  }

  return { checked: rules.length, decayed, details }
}

/**
 * Get rules that need human re-validation due to age + low confidence.
 */
export async function getRulesNeedingRevalidation(
  maxConfidence: number = 0.75
): Promise<Array<{ id: string; conceptSlug: string; confidence: number; ageMonths: number }>> {
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED"] },
      confidence: { lte: maxConfidence },
    },
    select: {
      id: true,
      conceptSlug: true,
      confidence: true,
      updatedAt: true,
    },
    orderBy: { confidence: "asc" },
  })

  return rules.map((r) => ({
    id: r.id,
    conceptSlug: r.conceptSlug,
    confidence: r.confidence,
    ageMonths: Math.round((Date.now() - r.updatedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  }))
}
```

**Step 4: Run tests**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/confidence-decay.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/utils/confidence-decay.ts src/lib/regulatory-truth/__tests__/confidence-decay.test.ts
git commit -m "feat(regulatory): add temporal confidence decay

Decay schedule:
- 0-3 months: no decay
- 3-6 months: 5% decay
- 6-12 months: 10% decay
- 12+ months: 20% decay
- Max: 30% (floor at 0.5 confidence)

Adds getRulesNeedingRevalidation for dashboard"
```

---

### Task 9: Add decay job to scheduler

**Files:**

- Modify: `src/lib/regulatory-truth/workers/scheduler.service.ts`
- Modify: `src/lib/regulatory-truth/workers/orchestrator.worker.ts`

**Step 1: Add decay job type to orchestrator**

```typescript
// In orchestrator.worker.ts, add to ScheduledJobData type:
interface ScheduledJobData {
  type: "pipeline-run" | "audit" | "digest" | "auto-approve" | "arbiter-sweep" | "release-batch" | "confidence-decay"
  runId: string
  triggeredBy?: string
}

// Add case in switch statement:
case "confidence-decay": {
  const { applyConfidenceDecay } = await import("../utils/confidence-decay")
  const result = await applyConfidenceDecay()
  return {
    success: true,
    duration: Date.now() - start,
    data: { checked: result.checked, decayed: result.decayed },
  }
}
```

**Step 2: Schedule weekly decay job**

```typescript
// In scheduler.service.ts, add:

// Weekly confidence decay on Sundays at 03:00
cron.schedule(
  "0 3 * * 0",
  async () => {
    console.log("[scheduler] Triggering weekly confidence decay")
    await scheduledQueue.add("scheduled", {
      type: "confidence-decay",
      runId: `decay-${Date.now()}`,
      triggeredBy: "cron",
    })
  },
  { timezone: TIMEZONE }
)
console.log("[scheduler] Scheduled: Confidence decay on Sundays at 03:00")
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/workers/scheduler.service.ts src/lib/regulatory-truth/workers/orchestrator.worker.ts
git commit -m "feat(scheduler): add weekly confidence decay job

Runs every Sunday at 03:00 Zagreb time.
Applies temporal decay to stale rules, flagging
those needing human re-validation."
```

---

### Task 10: Add revalidation API endpoint

**Files:**

- Create: `src/app/api/admin/regulatory-truth/revalidation/route.ts`

**Step 1: Create API endpoint**

```typescript
// src/app/api/admin/regulatory-truth/revalidation/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getRulesNeedingRevalidation,
  applyConfidenceDecay,
} from "@/lib/regulatory-truth/utils/confidence-decay"

export async function GET(req: NextRequest) {
  try {
    const maxConfidence = parseFloat(req.nextUrl.searchParams.get("maxConfidence") || "0.75")
    const rules = await getRulesNeedingRevalidation(maxConfidence)

    return NextResponse.json({
      count: rules.length,
      rules,
    })
  } catch (error) {
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to get rules needing revalidation" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await applyConfidenceDecay()

    return NextResponse.json({
      success: true,
      checked: result.checked,
      decayed: result.decayed,
      details: result.details,
    })
  } catch (error) {
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to apply confidence decay" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/regulatory-truth/revalidation/route.ts
git commit -m "feat(api): add revalidation endpoints

GET /api/admin/regulatory-truth/revalidation
  - Returns rules needing human revalidation

POST /api/admin/regulatory-truth/revalidation
  - Manually triggers confidence decay"
```

---

## Final Integration Test

### Task 11: End-to-end validation test

**Step 1: Run all tests**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/*.test.ts
```

**Step 2: Manual integration test**

```bash
# Trigger a pipeline run
curl -X POST http://localhost:3000/api/regulatory/trigger

# Wait for processing, then check status
curl http://localhost:3000/api/regulatory/status | jq .

# Check for rules needing revalidation
curl http://localhost:3000/api/admin/regulatory-truth/revalidation | jq .

# Manually trigger decay
curl -X POST http://localhost:3000/api/admin/regulatory-truth/revalidation | jq .
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(regulatory): complete accuracy & trust sprint

Phase 1: Deterministic pre-AI validation
- Percentage 0-100, currency positive, date format checks
- Integrated into extractor, rejects invalid before storage

Phase 2: No-inference extraction mode
- Value must appear in exact_quote
- Prompt updated with strict no-inference rules

Phase 3: Article-level anchoring
- New schema fields: articleNumber, paragraphNumber, lawReference
- Extractor prompt updated for legal citations

Phase 4: Temporal re-validation
- Confidence decay: 5%/10%/20% based on age
- Weekly scheduled job
- API endpoints for monitoring"
```

---

## Summary

| Phase | Feature                  | Files Changed           | Estimated Time |
| ----- | ------------------------ | ----------------------- | -------------- |
| 1     | Deterministic Validators | 2 new, 1 modified       | 4 hours        |
| 2     | No-Inference Mode        | 2 modified              | 3 hours        |
| 3     | Article Anchoring        | 1 migration, 3 modified | 4 hours        |
| 4     | Temporal Re-validation   | 3 new, 2 modified       | 4 hours        |

**Total: ~15 hours (2 days)**

---

Plan complete and saved to `docs/plans/2025-12-22-accuracy-trust-sprint.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
