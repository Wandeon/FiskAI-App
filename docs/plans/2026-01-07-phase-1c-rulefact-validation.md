# Phase 1C: RuleFact Validation Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the validation layer that ensures Mode 1 RuleFacts meet strict quality requirements before acceptance.

**Architecture:** Zod-based validation schemas with custom refinements for business rules. Validation functions are pure, composable, and return structured rejection reasons. Integration with existing Evidence model for grounding verification.

**Tech Stack:** TypeScript, Zod, Prisma (read-only for Evidence lookup)

**Dependencies:** Phase 1A (database schema), Phase 1B (canonical registry)

---

## Task 1: RuleFact Validator Core

**Files:**
- Create: `src/lib/regulatory-truth/validation/rule-fact-validator.ts`
- Create: `src/lib/regulatory-truth/validation/index.ts`
- Test: `src/lib/regulatory-truth/validation/__tests__/rule-fact-validator.test.ts`

**Step 1: Write the failing test for basic validation**

```typescript
// src/lib/regulatory-truth/validation/__tests__/rule-fact-validator.test.ts
import { describe, it, expect } from 'vitest'
import { validateRuleFact, RuleFactValidationError } from '../rule-fact-validator'
import { RuleFactInput } from '../../types'

describe('validateRuleFact', () => {
  const validRuleFactInput: RuleFactInput = {
    conceptSlug: 'pdv-standard-rate',
    subject: {
      type: 'pdv_obveznik',
      description: 'PDV obveznik',
    },
    object: {
      type: 'porezna_stopa',
      description: 'Standardna stopa PDV-a',
    },
    conditions: { always: true },
    value: '25',
    valueType: 'percentage',
    displayValue: '25%',
    effectiveFrom: new Date('2013-01-01'),
    effectiveUntil: null,
    authority: 'LAW',
    legalReference: {
      law: 'Zakon o porezu na dodanu vrijednost (NN 73/13)',
      article: '38',
    },
    groundingQuotes: [
      {
        evidenceId: 'evidence-123',
        exactQuote: 'Standardna stopa PDV-a iznosi 25%.',
        quoteLocation: { startOffset: 100, endOffset: 135 },
        matchType: 'EXACT',
      },
    ],
    riskTier: 'T0',
    confidence: 0.95,
  }

  it('should accept a valid RuleFact input', () => {
    const result = validateRuleFact(validRuleFactInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.conceptSlug).toBe('pdv-standard-rate')
    }
  })

  it('should reject conceptSlug not in canonical registry', () => {
    const input = { ...validRuleFactInput, conceptSlug: 'unknown-concept' }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_CONCEPT')
    }
  })

  it('should reject confidence below 0.90', () => {
    const input = { ...validRuleFactInput, confidence: 0.85 }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('LOW_CONFIDENCE')
    }
  })

  it('should reject empty groundingQuotes', () => {
    const input = { ...validRuleFactInput, groundingQuotes: [] }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('NO_GROUNDING')
    }
  })

  it('should reject missing effectiveFrom', () => {
    const input = { ...validRuleFactInput, effectiveFrom: null as any }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_TEMPORAL')
    }
  })

  it('should reject effectiveUntil as string "unknown"', () => {
    const input = { ...validRuleFactInput, effectiveUntil: 'unknown' as any }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('AMBIGUOUS_TEMPORAL')
    }
  })

  it('should reject missing legalReference.law', () => {
    const input = {
      ...validRuleFactInput,
      legalReference: { article: '38' } as any,
    }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_LEGAL_REF')
    }
  })

  it('should reject invalid subject type', () => {
    const input = {
      ...validRuleFactInput,
      subject: { type: 'invalid_type', description: 'Test' },
    }
    const result = validateRuleFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_SUBJECT')
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/rule-fact-validator.test.ts`
Expected: FAIL with "Cannot find module '../rule-fact-validator'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/regulatory-truth/validation/rule-fact-validator.ts
import { z } from 'zod'
import { CANONICAL_CONCEPTS } from '../canonical/concepts'
import {
  RuleFactInputSchema,
  RuleFactInput,
  RuleFact,
  GroundingQuote,
} from '../types'

// Validation error codes from design doc
export type RuleFactRejectionCode =
  | 'INVALID_CONCEPT'
  | 'INVALID_SUBJECT'
  | 'INVALID_OBJECT'
  | 'MISSING_CONDITIONS'
  | 'MISSING_TEMPORAL'
  | 'AMBIGUOUS_TEMPORAL'
  | 'MISSING_AUTHORITY'
  | 'MISSING_LEGAL_REF'
  | 'NO_GROUNDING'
  | 'GROUNDING_MISMATCH'
  | 'LOW_CONFIDENCE'
  | 'VALUE_NOT_GROUNDED'
  | 'NORMALIZED_NOT_ALLOWED'

export interface RuleFactValidationError {
  code: RuleFactRejectionCode
  message: string
  field?: string
  details?: Record<string, unknown>
}

export type RuleFactValidationResult =
  | { success: true; data: RuleFactInput }
  | { success: false; error: RuleFactValidationError }

// Get valid concept slugs from canonical registry
const validConceptSlugs = CANONICAL_CONCEPTS.map((c) => c.slug)

/**
 * Validates a RuleFact input against Mode 1 requirements.
 *
 * Validation rules from design doc:
 * - conceptSlug must be in Canonical Registry
 * - subject.type must be valid SubjectType
 * - conditions must not be empty or null
 * - effectiveFrom required, effectiveUntil cannot be "unknown"
 * - authority required
 * - legalReference.law required
 * - groundingQuotes must have at least 1 entry
 * - confidence must be >= 0.90
 */
export function validateRuleFact(input: unknown): RuleFactValidationResult {
  // Step 1: Basic schema validation
  const parseResult = RuleFactInputSchema.safeParse(input)

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return mapZodErrorToRejection(firstError)
  }

  const data = parseResult.data

  // Step 2: Canonical registry validation
  if (!validConceptSlugs.includes(data.conceptSlug)) {
    return {
      success: false,
      error: {
        code: 'INVALID_CONCEPT',
        message: `Concept slug '${data.conceptSlug}' is not in the Canonical Registry`,
        field: 'conceptSlug',
        details: { validSlugs: validConceptSlugs },
      },
    }
  }

  // Step 3: Confidence threshold (Mode 1 requires >= 0.90)
  if (data.confidence < 0.90) {
    return {
      success: false,
      error: {
        code: 'LOW_CONFIDENCE',
        message: `Confidence ${data.confidence} is below Mode 1 threshold of 0.90`,
        field: 'confidence',
        details: { threshold: 0.90, actual: data.confidence },
      },
    }
  }

  // Step 4: Grounding requirements
  if (!data.groundingQuotes || data.groundingQuotes.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_GROUNDING',
        message: 'RuleFact must have at least one grounding quote',
        field: 'groundingQuotes',
      },
    }
  }

  // Step 5: Temporal validity
  if (!data.effectiveFrom) {
    return {
      success: false,
      error: {
        code: 'MISSING_TEMPORAL',
        message: 'effectiveFrom is required for Mode 1 RuleFacts',
        field: 'effectiveFrom',
      },
    }
  }

  if (data.effectiveUntil === 'unknown' || data.effectiveUntil === 'UNKNOWN') {
    return {
      success: false,
      error: {
        code: 'AMBIGUOUS_TEMPORAL',
        message: 'effectiveUntil cannot be "unknown" - use null for ongoing validity',
        field: 'effectiveUntil',
      },
    }
  }

  // Step 6: Legal reference
  if (!data.legalReference?.law) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEGAL_REF',
        message: 'legalReference.law is required for Mode 1 RuleFacts',
        field: 'legalReference.law',
      },
    }
  }

  // Step 7: Authority
  if (!data.authority) {
    return {
      success: false,
      error: {
        code: 'MISSING_AUTHORITY',
        message: 'authority is required for Mode 1 RuleFacts',
        field: 'authority',
      },
    }
  }

  return { success: true, data }
}

function mapZodErrorToRejection(error: z.ZodIssue): RuleFactValidationResult {
  const path = error.path.join('.')

  // Map specific field errors to rejection codes
  if (path === 'subject.type' || path.startsWith('subject')) {
    return {
      success: false,
      error: {
        code: 'INVALID_SUBJECT',
        message: error.message,
        field: path,
      },
    }
  }

  if (path === 'object.type' || path.startsWith('object')) {
    return {
      success: false,
      error: {
        code: 'INVALID_OBJECT',
        message: error.message,
        field: path,
      },
    }
  }

  if (path === 'conditions') {
    return {
      success: false,
      error: {
        code: 'MISSING_CONDITIONS',
        message: error.message,
        field: path,
      },
    }
  }

  if (path === 'effectiveFrom') {
    return {
      success: false,
      error: {
        code: 'MISSING_TEMPORAL',
        message: error.message,
        field: path,
      },
    }
  }

  if (path === 'groundingQuotes') {
    return {
      success: false,
      error: {
        code: 'NO_GROUNDING',
        message: error.message,
        field: path,
      },
    }
  }

  // Default fallback
  return {
    success: false,
    error: {
      code: 'INVALID_CONCEPT', // Generic fallback
      message: error.message,
      field: path,
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/rule-fact-validator.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add RuleFact validator core with rejection codes"
```

---

## Task 2: Grounding Quote Verification

**Files:**
- Modify: `src/lib/regulatory-truth/validation/rule-fact-validator.ts`
- Test: `src/lib/regulatory-truth/validation/__tests__/grounding-verification.test.ts`

**Step 1: Write the failing test for grounding verification**

```typescript
// src/lib/regulatory-truth/validation/__tests__/grounding-verification.test.ts
import { describe, it, expect } from 'vitest'
import {
  verifyGroundingQuote,
  GroundingVerificationResult,
} from '../rule-fact-validator'

describe('verifyGroundingQuote', () => {
  const evidenceContent = `
    Članak 38.
    (1) Standardna stopa PDV-a iznosi 25%.
    (2) Sniženа stopa PDV-a iznosi 13%.
  `.trim()

  it('should verify EXACT match when quote exists verbatim', () => {
    const result = verifyGroundingQuote(
      {
        evidenceId: 'test-evidence',
        exactQuote: 'Standardna stopa PDV-a iznosi 25%.',
        quoteLocation: { startOffset: 22, endOffset: 56 },
        matchType: 'EXACT',
      },
      evidenceContent
    )
    expect(result.verified).toBe(true)
    expect(result.matchType).toBe('EXACT')
  })

  it('should verify NORMALIZED match with whitespace differences', () => {
    const contentWithExtraSpaces = 'Standardna  stopa   PDV-a iznosi 25%.'
    const result = verifyGroundingQuote(
      {
        evidenceId: 'test-evidence',
        exactQuote: 'Standardna stopa PDV-a iznosi 25%.',
        quoteLocation: { startOffset: 0, endOffset: 37 },
        matchType: 'NORMALIZED',
      },
      contentWithExtraSpaces
    )
    expect(result.verified).toBe(true)
    expect(result.matchType).toBe('NORMALIZED')
  })

  it('should fail verification when quote not found', () => {
    const result = verifyGroundingQuote(
      {
        evidenceId: 'test-evidence',
        exactQuote: 'This quote does not exist in the content.',
        quoteLocation: { startOffset: 0, endOffset: 41 },
        matchType: 'EXACT',
      },
      evidenceContent
    )
    expect(result.verified).toBe(false)
    expect(result.error).toBe('GROUNDING_MISMATCH')
  })

  it('should fail when EXACT is claimed but only NORMALIZED matches', () => {
    const contentWithVariation = 'Standardna  stopa PDV-a iznosi 25%.'
    const result = verifyGroundingQuote(
      {
        evidenceId: 'test-evidence',
        exactQuote: 'Standardna stopa PDV-a iznosi 25%.',
        quoteLocation: { startOffset: 0, endOffset: 35 },
        matchType: 'EXACT', // Claims EXACT but has whitespace diff
      },
      contentWithVariation
    )
    expect(result.verified).toBe(false)
    expect(result.error).toBe('GROUNDING_MISMATCH')
    expect(result.actualMatchType).toBe('NORMALIZED')
  })
})

describe('verifyValueInQuote', () => {
  it('should verify value appears in quote', () => {
    const result = verifyValueInQuote('25', 'Standardna stopa PDV-a iznosi 25%.')
    expect(result.found).toBe(true)
  })

  it('should verify percentage value appears in quote', () => {
    const result = verifyValueInQuote('25', 'Stopa od 25% primjenjuje se...')
    expect(result.found).toBe(true)
  })

  it('should verify currency value with formatting', () => {
    const result = verifyValueInQuote('40000', 'Prag iznosi 40.000 EUR godišnje.')
    expect(result.found).toBe(true)
  })

  it('should fail when value not in quote', () => {
    const result = verifyValueInQuote('30', 'Standardna stopa PDV-a iznosi 25%.')
    expect(result.found).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/grounding-verification.test.ts`
Expected: FAIL with "verifyGroundingQuote is not exported"

**Step 3: Add grounding verification implementation**

```typescript
// Add to src/lib/regulatory-truth/validation/rule-fact-validator.ts

export interface GroundingVerificationResult {
  verified: boolean
  matchType?: 'EXACT' | 'NORMALIZED'
  actualMatchType?: 'EXACT' | 'NORMALIZED' | 'NOT_FOUND'
  error?: 'GROUNDING_MISMATCH' | 'VALUE_NOT_GROUNDED'
  details?: string
}

/**
 * Verifies that a grounding quote exists in the evidence content.
 *
 * EXACT match: Quote found byte-for-byte
 * NORMALIZED match: Quote found after whitespace/diacritic normalization
 */
export function verifyGroundingQuote(
  quote: {
    evidenceId: string
    exactQuote: string
    quoteLocation: { startOffset: number; endOffset: number }
    matchType: 'EXACT' | 'NORMALIZED'
  },
  evidenceContent: string
): GroundingVerificationResult {
  // Try exact match first
  const exactFound = evidenceContent.includes(quote.exactQuote)

  if (exactFound) {
    return {
      verified: true,
      matchType: quote.matchType,
      actualMatchType: 'EXACT',
    }
  }

  // Try normalized match
  const normalizedQuote = normalizeText(quote.exactQuote)
  const normalizedContent = normalizeText(evidenceContent)
  const normalizedFound = normalizedContent.includes(normalizedQuote)

  if (normalizedFound) {
    // If EXACT was claimed but only NORMALIZED works, fail
    if (quote.matchType === 'EXACT') {
      return {
        verified: false,
        error: 'GROUNDING_MISMATCH',
        actualMatchType: 'NORMALIZED',
        details: 'Quote claimed EXACT match but only NORMALIZED match found',
      }
    }
    return {
      verified: true,
      matchType: 'NORMALIZED',
      actualMatchType: 'NORMALIZED',
    }
  }

  // Neither match found
  return {
    verified: false,
    error: 'GROUNDING_MISMATCH',
    actualMatchType: 'NOT_FOUND',
    details: 'Quote not found in evidence content',
  }
}

/**
 * Normalize text for comparison:
 * - Collapse multiple whitespace to single space
 * - Normalize Croatian diacritics
 * - Trim
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC')
}

export interface ValueVerificationResult {
  found: boolean
  location?: number
}

/**
 * Verifies that a fact's value appears in its grounding quote.
 * Handles common formatting variations:
 * - 40000 matches "40.000" (European thousands separator)
 * - 25 matches "25%"
 * - Decimal variations (16,5 vs 16.5)
 */
export function verifyValueInQuote(
  value: string,
  quote: string
): ValueVerificationResult {
  // Direct match
  if (quote.includes(value)) {
    return { found: true, location: quote.indexOf(value) }
  }

  // Try with European thousands separator (40000 -> 40.000)
  const numericValue = parseInt(value, 10)
  if (!isNaN(numericValue) && numericValue >= 1000) {
    const europeanFormatted = numericValue
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    if (quote.includes(europeanFormatted)) {
      return { found: true, location: quote.indexOf(europeanFormatted) }
    }
  }

  // Try as percentage without the % sign
  if (quote.includes(value + '%')) {
    return { found: true, location: quote.indexOf(value + '%') }
  }

  // Try decimal comma vs dot (16.5 vs 16,5)
  if (value.includes('.')) {
    const commaVersion = value.replace('.', ',')
    if (quote.includes(commaVersion)) {
      return { found: true, location: quote.indexOf(commaVersion) }
    }
  }
  if (value.includes(',')) {
    const dotVersion = value.replace(',', '.')
    if (quote.includes(dotVersion)) {
      return { found: true, location: quote.indexOf(dotVersion) }
    }
  }

  return { found: false }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/grounding-verification.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add grounding quote verification with value matching"
```

---

## Task 3: Risk Tier Constraints

**Files:**
- Modify: `src/lib/regulatory-truth/validation/rule-fact-validator.ts`
- Test: `src/lib/regulatory-truth/validation/__tests__/risk-tier-validation.test.ts`

**Step 1: Write the failing test for risk tier constraints**

```typescript
// src/lib/regulatory-truth/validation/__tests__/risk-tier-validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateRiskTierConstraints } from '../rule-fact-validator'

describe('validateRiskTierConstraints', () => {
  it('should allow EXACT match for T0 risk tier', () => {
    const result = validateRiskTierConstraints('T0', 'EXACT')
    expect(result.valid).toBe(true)
  })

  it('should allow EXACT match for T1 risk tier', () => {
    const result = validateRiskTierConstraints('T1', 'EXACT')
    expect(result.valid).toBe(true)
  })

  it('should reject NORMALIZED match for T0 risk tier', () => {
    const result = validateRiskTierConstraints('T0', 'NORMALIZED')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('NORMALIZED_NOT_ALLOWED')
    expect(result.message).toContain('T0')
  })

  it('should reject NORMALIZED match for T1 risk tier', () => {
    const result = validateRiskTierConstraints('T1', 'NORMALIZED')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('NORMALIZED_NOT_ALLOWED')
  })

  it('should allow NORMALIZED match for T2 risk tier', () => {
    const result = validateRiskTierConstraints('T2', 'NORMALIZED')
    expect(result.valid).toBe(true)
  })

  it('should allow NORMALIZED match for T3 risk tier', () => {
    const result = validateRiskTierConstraints('T3', 'NORMALIZED')
    expect(result.valid).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/risk-tier-validation.test.ts`
Expected: FAIL with "validateRiskTierConstraints is not exported"

**Step 3: Add risk tier constraint validation**

```typescript
// Add to src/lib/regulatory-truth/validation/rule-fact-validator.ts

export interface RiskTierConstraintResult {
  valid: boolean
  error?: 'NORMALIZED_NOT_ALLOWED'
  message?: string
}

/**
 * Validates that the match type is appropriate for the risk tier.
 *
 * From design doc:
 * - T0 (Critical: rates, penalties) and T1 (High: thresholds, bases)
 *   require EXACT quote match
 * - T2 (Medium: procedures) and T3 (Low: labels) allow NORMALIZED
 */
export function validateRiskTierConstraints(
  riskTier: 'T0' | 'T1' | 'T2' | 'T3',
  matchType: 'EXACT' | 'NORMALIZED'
): RiskTierConstraintResult {
  // T0 and T1 require EXACT match
  const criticalTiers = ['T0', 'T1']

  if (criticalTiers.includes(riskTier) && matchType === 'NORMALIZED') {
    return {
      valid: false,
      error: 'NORMALIZED_NOT_ALLOWED',
      message: `Risk tier ${riskTier} requires EXACT quote match, NORMALIZED not allowed for critical facts`,
    }
  }

  return { valid: true }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/risk-tier-validation.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add risk tier constraints for quote match types"
```

---

## Task 4: Full Validation Pipeline

**Files:**
- Modify: `src/lib/regulatory-truth/validation/rule-fact-validator.ts`
- Test: `src/lib/regulatory-truth/validation/__tests__/validation-pipeline.test.ts`

**Step 1: Write the failing test for full pipeline**

```typescript
// src/lib/regulatory-truth/validation/__tests__/validation-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  validateRuleFactComplete,
  ValidationContext,
} from '../rule-fact-validator'
import { RuleFactInput } from '../../types'

describe('validateRuleFactComplete', () => {
  // Mock evidence lookup
  const mockEvidenceLookup = vi.fn()

  const context: ValidationContext = {
    lookupEvidence: mockEvidenceLookup,
  }

  const validInput: RuleFactInput = {
    conceptSlug: 'pdv-standard-rate',
    subject: {
      type: 'pdv_obveznik',
      description: 'PDV obveznik',
    },
    object: {
      type: 'porezna_stopa',
      description: 'Standardna stopa PDV-a',
    },
    conditions: { always: true },
    value: '25',
    valueType: 'percentage',
    displayValue: '25%',
    effectiveFrom: new Date('2013-01-01'),
    effectiveUntil: null,
    authority: 'LAW',
    legalReference: {
      law: 'Zakon o porezu na dodanu vrijednost (NN 73/13)',
      article: '38',
    },
    groundingQuotes: [
      {
        evidenceId: 'evidence-123',
        exactQuote: 'Standardna stopa PDV-a iznosi 25%.',
        quoteLocation: { startOffset: 100, endOffset: 135 },
        matchType: 'EXACT',
      },
    ],
    riskTier: 'T0',
    confidence: 0.95,
  }

  beforeEach(() => {
    mockEvidenceLookup.mockReset()
  })

  it('should pass full validation with valid input and evidence', async () => {
    mockEvidenceLookup.mockResolvedValue({
      id: 'evidence-123',
      rawContent: 'Članak 38. Standardna stopa PDV-a iznosi 25%.',
    })

    const result = await validateRuleFactComplete(validInput, context)
    expect(result.success).toBe(true)
    expect(result.validationSteps).toContain('SCHEMA')
    expect(result.validationSteps).toContain('CANONICAL')
    expect(result.validationSteps).toContain('GROUNDING')
    expect(result.validationSteps).toContain('VALUE')
    expect(result.validationSteps).toContain('RISK_TIER')
  })

  it('should fail when evidence lookup fails', async () => {
    mockEvidenceLookup.mockResolvedValue(null)

    const result = await validateRuleFactComplete(validInput, context)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('GROUNDING_MISMATCH')
    expect(result.error?.details?.reason).toBe('Evidence not found')
  })

  it('should fail when value not in quote', async () => {
    mockEvidenceLookup.mockResolvedValue({
      id: 'evidence-123',
      rawContent: 'Članak 38. Standardna stopa PDV-a iznosi 13%.', // Wrong value
    })

    const input = {
      ...validInput,
      groundingQuotes: [
        {
          evidenceId: 'evidence-123',
          exactQuote: 'Standardna stopa PDV-a iznosi 13%.', // Quote has 13%
          quoteLocation: { startOffset: 11, endOffset: 45 },
          matchType: 'EXACT' as const,
        },
      ],
      value: '25', // But fact claims 25%
    }

    const result = await validateRuleFactComplete(input, context)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('VALUE_NOT_GROUNDED')
  })

  it('should fail T0 fact with NORMALIZED match', async () => {
    mockEvidenceLookup.mockResolvedValue({
      id: 'evidence-123',
      rawContent: 'Standardna  stopa PDV-a iznosi 25%.', // Extra space
    })

    const input = {
      ...validInput,
      groundingQuotes: [
        {
          ...validInput.groundingQuotes[0],
          matchType: 'NORMALIZED' as const, // Claims NORMALIZED
        },
      ],
    }

    const result = await validateRuleFactComplete(input, context)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NORMALIZED_NOT_ALLOWED')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/validation-pipeline.test.ts`
Expected: FAIL with "validateRuleFactComplete is not exported"

**Step 3: Implement full validation pipeline**

```typescript
// Add to src/lib/regulatory-truth/validation/rule-fact-validator.ts

export interface ValidationContext {
  lookupEvidence: (evidenceId: string) => Promise<{
    id: string
    rawContent: string
  } | null>
}

export type ValidationStep =
  | 'SCHEMA'
  | 'CANONICAL'
  | 'CONFIDENCE'
  | 'TEMPORAL'
  | 'AUTHORITY'
  | 'GROUNDING'
  | 'VALUE'
  | 'RISK_TIER'

export interface CompleteValidationResult {
  success: boolean
  validationSteps: ValidationStep[]
  error?: RuleFactValidationError
  data?: RuleFactInput
}

/**
 * Complete validation pipeline for Mode 1 RuleFacts.
 *
 * Steps:
 * 1. SCHEMA - Zod schema validation
 * 2. CANONICAL - Concept slug in registry
 * 3. CONFIDENCE - >= 0.90 threshold
 * 4. TEMPORAL - effectiveFrom required, effectiveUntil not "unknown"
 * 5. AUTHORITY - Authority and legal reference present
 * 6. GROUNDING - All quotes verified in Evidence
 * 7. VALUE - Value appears in grounding quote
 * 8. RISK_TIER - Match type appropriate for risk tier
 */
export async function validateRuleFactComplete(
  input: unknown,
  context: ValidationContext
): Promise<CompleteValidationResult> {
  const completedSteps: ValidationStep[] = []

  // Step 1-5: Basic validation (synchronous)
  const basicResult = validateRuleFact(input)
  if (!basicResult.success) {
    return {
      success: false,
      validationSteps: completedSteps,
      error: basicResult.error,
    }
  }
  completedSteps.push('SCHEMA', 'CANONICAL', 'CONFIDENCE', 'TEMPORAL', 'AUTHORITY')

  const data = basicResult.data

  // Step 6: Grounding verification (async - requires Evidence lookup)
  for (const quote of data.groundingQuotes) {
    const evidence = await context.lookupEvidence(quote.evidenceId)
    if (!evidence) {
      return {
        success: false,
        validationSteps: completedSteps,
        error: {
          code: 'GROUNDING_MISMATCH',
          message: `Evidence ${quote.evidenceId} not found`,
          field: 'groundingQuotes',
          details: { evidenceId: quote.evidenceId, reason: 'Evidence not found' },
        },
      }
    }

    const groundingResult = verifyGroundingQuote(quote, evidence.rawContent)
    if (!groundingResult.verified) {
      return {
        success: false,
        validationSteps: completedSteps,
        error: {
          code: 'GROUNDING_MISMATCH',
          message: `Quote not found in Evidence ${quote.evidenceId}`,
          field: 'groundingQuotes',
          details: { evidenceId: quote.evidenceId, quote: quote.exactQuote },
        },
      }
    }
  }
  completedSteps.push('GROUNDING')

  // Step 7: Value verification
  const primaryQuote = data.groundingQuotes[0]
  const valueResult = verifyValueInQuote(data.value, primaryQuote.exactQuote)
  if (!valueResult.found) {
    return {
      success: false,
      validationSteps: completedSteps,
      error: {
        code: 'VALUE_NOT_GROUNDED',
        message: `Value '${data.value}' not found in grounding quote`,
        field: 'value',
        details: { value: data.value, quote: primaryQuote.exactQuote },
      },
    }
  }
  completedSteps.push('VALUE')

  // Step 8: Risk tier constraints
  for (const quote of data.groundingQuotes) {
    const riskResult = validateRiskTierConstraints(data.riskTier, quote.matchType)
    if (!riskResult.valid) {
      return {
        success: false,
        validationSteps: completedSteps,
        error: {
          code: 'NORMALIZED_NOT_ALLOWED',
          message: riskResult.message || 'Match type not allowed for risk tier',
          field: 'groundingQuotes',
          details: { riskTier: data.riskTier, matchType: quote.matchType },
        },
      }
    }
  }
  completedSteps.push('RISK_TIER')

  return {
    success: true,
    validationSteps: completedSteps,
    data,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/validation-pipeline.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): implement complete RuleFact validation pipeline"
```

---

## Task 5: Validation Index and Exports

**Files:**
- Create: `src/lib/regulatory-truth/validation/index.ts`
- Modify: `src/lib/regulatory-truth/index.ts` (add validation export)

**Step 1: Write the failing test for exports**

```typescript
// src/lib/regulatory-truth/validation/__tests__/exports.test.ts
import { describe, it, expect } from 'vitest'

describe('validation module exports', () => {
  it('should export all validation functions', async () => {
    const validation = await import('../index')

    expect(validation.validateRuleFact).toBeDefined()
    expect(validation.validateRuleFactComplete).toBeDefined()
    expect(validation.verifyGroundingQuote).toBeDefined()
    expect(validation.verifyValueInQuote).toBeDefined()
    expect(validation.validateRiskTierConstraints).toBeDefined()
  })

  it('should export types', async () => {
    // TypeScript will catch if types don't exist
    const _: typeof import('../index') = await import('../index')
    // If this compiles, types are exported
    expect(true).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/exports.test.ts`
Expected: FAIL with "Cannot find module '../index'"

**Step 3: Create validation index**

```typescript
// src/lib/regulatory-truth/validation/index.ts
export {
  validateRuleFact,
  validateRuleFactComplete,
  verifyGroundingQuote,
  verifyValueInQuote,
  validateRiskTierConstraints,
  type RuleFactRejectionCode,
  type RuleFactValidationError,
  type RuleFactValidationResult,
  type GroundingVerificationResult,
  type ValueVerificationResult,
  type RiskTierConstraintResult,
  type ValidationContext,
  type ValidationStep,
  type CompleteValidationResult,
} from './rule-fact-validator'
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/exports.test.ts`
Expected: PASS (both tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add validation module exports"
```

---

## Summary

Phase 1C implements:

1. **RuleFact Validator Core** - Basic schema and business rule validation
2. **Grounding Quote Verification** - Exact and normalized matching
3. **Risk Tier Constraints** - T0/T1 require EXACT match
4. **Full Validation Pipeline** - Async validation with Evidence lookup
5. **Module Exports** - Clean public API

All validation follows the design document rejection codes:
- `INVALID_CONCEPT` - Concept slug not in registry
- `INVALID_SUBJECT` / `INVALID_OBJECT` - Invalid type enum
- `MISSING_CONDITIONS` - Empty conditions
- `MISSING_TEMPORAL` - No effectiveFrom
- `AMBIGUOUS_TEMPORAL` - effectiveUntil is "unknown"
- `MISSING_AUTHORITY` / `MISSING_LEGAL_REF` - Required fields missing
- `NO_GROUNDING` - Empty grounding quotes
- `GROUNDING_MISMATCH` - Quote not found in Evidence
- `LOW_CONFIDENCE` - Below 0.90 threshold
- `VALUE_NOT_GROUNDED` - Value not in quote
- `NORMALIZED_NOT_ALLOWED` - T0/T1 with NORMALIZED match
