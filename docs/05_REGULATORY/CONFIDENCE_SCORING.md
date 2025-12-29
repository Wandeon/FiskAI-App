# RTL Extraction Confidence Scoring System

> **Status:** Canonical Reference
> **Last Updated:** 2025-12-29
> **Related:** [RTL Architecture](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)

## Table of Contents

1. [Overview](#overview)
2. [Confidence Score Definition](#confidence-score-definition)
3. [Scoring at Each Pipeline Stage](#scoring-at-each-pipeline-stage)
4. [Thresholds and Gates](#thresholds-and-gates)
5. [Confidence Decay](#confidence-decay)
6. [Implementation Details](#implementation-details)
7. [Production Analysis](#production-analysis)
8. [Best Practices](#best-practices)

---

## Overview

### Purpose

The confidence scoring system is a critical component of the Regulatory Truth Layer (RTL) that:

1. **Quantifies certainty** - Provides a numerical measure (0.0-1.0) of how confident the system is in extracted data
2. **Gates progression** - Controls which rules advance through the pipeline based on risk tier
3. **Enables fail-closed operation** - Prevents low-confidence extractions from reaching production
4. **Supports human review** - Flags ambiguous content for manual verification

### Core Principle

> **Fail-Closed by Default:** When uncertain, the system escalates to human review rather than publishing potentially incorrect regulatory guidance.

### Confidence Range

All confidence scores are expressed as a decimal value between 0.0 and 1.0:

- **1.0** - Maximum confidence (explicit, unambiguous)
- **0.9-0.99** - High confidence (clear but some context sensitivity)
- **0.8-0.89** - Moderate confidence (requires some interpretation)
- **< 0.8** - Low confidence (DO NOT EXTRACT - reject or escalate)

---

## Confidence Score Definition

### Extractor Agent Scoring Criteria

The Extractor agent assigns confidence scores based on these criteria (defined in `prompts/index.ts`):

| Score | Criteria | Example |
|-------|----------|---------|
| **1.0** | Explicit, unambiguous value in clear context | "Stopa PDV-a iznosi 25%" → 25, percentage |
| **0.9** | Clear value but context could apply to multiple scenarios | "Prag od 40.000 EUR" (unclear if annual/total/per-transaction) |
| **0.8** | Value present but requires interpretation of scope | "Obveznici plaćaju..." (who qualifies as obveznik?) |
| **< 0.8** | Ambiguous, inferred, or uncertain | DO NOT EXTRACT |

### Key Rules

1. **No Inference Allowed** - Only extract values explicitly stated in text
2. **Quote Must Contain Value** - The `exact_quote` field must contain the `extracted_value`
3. **Reject Below 0.8** - Low confidence extractions are automatically rejected

### What Gets Rejected

❌ **Examples of Rejected Extractions:**

- Text says "paušalni obrt" → DO NOT infer 40,000 EUR threshold
- Text says "standard VAT rate applies" → DO NOT infer 25%
- Text says "deadline is end of month" → DO NOT convert to specific date

✅ **Examples of Valid Extractions:**

- Text says "stopa PDV-a iznosi 25%" → Extract 25, percentage ✓
- Text says "prag od 40.000 EUR" → Extract 40000, currency_eur ✓
- Text says "do 15. siječnja 2025." → Extract 2025-01-15, date ✓

---

## Scoring at Each Pipeline Stage

### Stage 1: Extractor

**File:** `agents/extractor.ts`, `schemas/extractor.ts`

**Confidence Source:** LLM-assigned based on prompt criteria

**Schema Definition:**

```typescript
export const ConfidenceSchema = z.number().min(0).max(1)
```

**Validation:**

```typescript
// From utils/deterministic-validators.ts
export function validateExtraction(extraction: {
  confidence: number
  // ... other fields
}): ExtractionValidationResult {
  // Confidence validation
  if (extraction.confidence < 0 || extraction.confidence > 1) {
    errors.push(`Confidence ${extraction.confidence} must be between 0 and 1`)
  }

  // Warning for low confidence
  if (extraction.confidence < 0.7) {
    warnings.push(`Low confidence extraction: ${extraction.confidence}`)
  }
}
```

**Rejection Logic:**

- Confidence < 0.8 in prompt guidance → LLM should not extract
- Extracted with confidence < 0.7 → Warning logged
- Failed validation → Moved to `ExtractionRejected` table for analysis

### Stage 2: Composer

**File:** `agents/composer.ts`

**Confidence Calculation:** Inherits from source pointers, adjusted for:

- Multiple conflicting sources → Lower confidence
- Single authoritative source → Higher confidence
- Ambiguous AppliesWhen conditions → Lower confidence

**Composer Prompt Guidance:**

```
CONSTRAINTS:
- Mark confidence < 0.8 if any ambiguity exists
- If multiple sources conflict, flag for Arbiter (do not resolve yourself)
```

### Stage 3: Reviewer

**File:** `agents/reviewer.ts`, `policy/auto-approval-policy.ts`

**Confidence Impact:** Gates auto-approval decisions

**Auto-Approval Matrix:**

| Risk Tier | Minimum Confidence | Auto-Approve? |
|-----------|-------------------|---------------|
| T0 (Critical) | N/A | Never (Infinity) |
| T1 (High) | N/A | Never (Infinity) |
| T2 (Medium) | 0.95 | Yes, if ≥ 0.95 |
| T3 (Low) | 0.90 | Yes, if ≥ 0.90 |

**Reviewer Prompt Guidance:**

```
AUTHORITY MATRIX:
- T2/T3 rules with confidence ≥ 0.95: AUTO-APPROVE
- T1 rules with confidence ≥ 0.98: FLAG for expedited human review
- T0 rules: ALWAYS require human approval (never auto-approve)
- Any rule with confidence < 0.9: ESCALATE with concerns
```

### Stage 4: Releaser

**File:** `agents/releaser.ts`, `utils/publish-gate.ts`

**Confidence Gate:** Minimum confidence required for publication

**Publish Gate Check:**

```typescript
// Minimum confidence: 0.70
if (rule.confidence < 0.70) {
  return {
    canPublish: false,
    reason: `Confidence ${rule.confidence} below minimum threshold (0.70)`
  }
}
```

---

## Thresholds and Gates

### Tier-Specific Confidence Thresholds

**File:** `schemas/common.ts`

```typescript
export const CONFIDENCE_THRESHOLDS = {
  T0: 0.99,  // Critical: Tax rates, legal deadlines, penalties
  T1: 0.95,  // High: Thresholds triggering obligations
  T2: 0.90,  // Medium: Procedural requirements
  T3: 0.85,  // Low: UI labels, non-binding guidance
} as const
```

### Auto-Approval Thresholds

```typescript
export const AUTO_APPROVE_THRESHOLDS = {
  T0: Infinity, // Never auto-approve (requires human review)
  T1: Infinity, // Never auto-approve (requires human review)
  T2: 0.95,     // Auto-approve if confidence ≥ 0.95
  T3: 0.90,     // Auto-approve if confidence ≥ 0.90
} as const
```

### Pipeline Gates

| Gate | Location | Threshold | Action |
|------|----------|-----------|--------|
| **Extraction Gate** | `validateExtraction()` | < 0.7 | Warning |
| **Auto-Approval Gate** | `auto-approval-policy.ts` | < tier threshold | Escalate to human |
| **Publish Gate** | `publish-gate.ts` | < 0.70 | Block publication |

---

## Confidence Decay

### Purpose

Rules degrade in confidence over time as regulatory landscapes change. This ensures stale rules are re-validated.

**File:** `utils/confidence-decay.ts`

### Decay Schedule

| Age | Decay Amount | Final Floor |
|-----|--------------|-------------|
| 0-3 months | 0% | - |
| 3-6 months | 5% | - |
| 6-12 months | 10% | - |
| 12-24 months | 20% | - |
| 24+ months | 30% (capped) | 0.50 minimum |

### Implementation

```typescript
export function calculateConfidenceDecay(lastVerifiedAt: Date): number {
  const ageMonths = (Date.now() - lastVerifiedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)

  if (ageMonths < 3) return 0
  if (ageMonths < 6) return 0.05
  if (ageMonths < 12) return 0.1
  if (ageMonths < 24) return 0.2
  return 0.3 // Cap at 30% decay
}
```

### Decay Application

**Scheduled Job:** Sunday 03:00 Europe/Zagreb

```typescript
export async function applyConfidenceDecay(): Promise<{
  checked: number
  decayed: number
  details: Array<{
    ruleId: string
    oldConfidence: number
    newConfidence: number
    ageMonths: number
  }>
}>
```

### Revalidation Queue

Rules that drop below 0.75 confidence due to age are flagged for human re-validation:

```typescript
export async function getRulesNeedingRevalidation(
  maxConfidence: number = 0.75
): Promise<Array<{
  id: string
  conceptSlug: string
  confidence: number
  ageMonths: number
}>>
```

---

## Implementation Details

### Database Schema

**SourcePointer Table:**

```prisma
model SourcePointer {
  confidence      Float    @default(0.8)
  // ... other fields
}
```

**RegulatoryRule Table:**

```prisma
model RegulatoryRule {
  confidence      Float    @default(0.8)
  // ... other fields
}
```

### Validation Pipeline

**File:** `utils/deterministic-validators.ts`

```typescript
export interface ExtractionValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateExtraction(extraction: {
  domain: string
  value_type: string
  extracted_value: string | number
  exact_quote: string
  confidence: number
}): ExtractionValidationResult
```

**Validation Steps:**

1. **Domain validation** - Check domain is known
2. **Value type validation** - Check value type is valid
3. **Range validation** - Check value is within reasonable range for domain
4. **Quote verification** - Verify extracted value appears in exact quote (NO INFERENCE)
5. **Confidence bounds** - Check confidence is between 0 and 1
6. **Warning threshold** - Warn if confidence < 0.7

### Quote Verification

**Critical Anti-Hallucination Check:**

```typescript
// From utils/deterministic-validators.ts
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string,
  options: { fuzzyThreshold?: number } = {}
): ValidationResult
```

This function ensures the `extracted_value` actually appears in the `exact_quote`, preventing LLM "inference" where values are derived but not explicitly stated.

**Supports:**

- Croatian diacritic normalization (č, š, ž, đ)
- Fuzzy matching for OCR errors (default threshold: 0.85)
- Date format matching with Croatian month names
- Numeric format variations (40.000 vs 40000)

---

## Production Analysis

### Current State (as of 2025-12-29)

**Query:** Issue #179 audit findings

#### Rule Confidence Distribution

| Confidence | Count | Percentage |
|------------|-------|------------|
| 1.0 | 428 | 69.6% |
| 0.95 | 80 | 13.0% |
| 0.9 | 68 | 11.1% |
| 0.85 | 15 | 2.4% |
| 0.8 | 6 | 1.0% |
| < 0.8 | 18 | 2.9% |

**Total Rules:** 615

#### SourcePointer Confidence Distribution

| Confidence | Count | Percentage |
|------------|-------|------------|
| 1.0 | 1,915 | 96.0% |
| 0.95 | 8 | 0.4% |
| 0.9 | 68 | 3.4% |
| 0.85 | 3 | 0.2% |
| 0.8 | 1 | 0.1% |

**Total Source Pointers:** 1,995

### Observations

1. ✅ **High confidence baseline** - 69.6% of rules have maximum confidence (1.0)
2. ✅ **Strong extraction quality** - 96.0% of source pointers have confidence 1.0
3. ✅ **Conservative scoring** - Only 2.9% of rules below 0.8 threshold
4. ⚠️ **Status bottleneck** - 428 rules with 1.0 confidence still in DRAFT (not a confidence issue)

### Confidence is Not the Bottleneck

The low publication rate (few rules in PUBLISHED status) is **not** due to confidence scoring. The issue is:

- Rules stuck in DRAFT/PENDING_REVIEW status
- Composer/Reviewer agents not running frequently enough
- Queue processing backlog

**Recommendation:** Focus on status progression and queue draining, not confidence scoring.

---

## Best Practices

### For LLM Prompts

1. **Be Explicit** - Clearly define confidence criteria in prompts
2. **Provide Examples** - Show what 1.0, 0.9, 0.8 look like
3. **Set Floor** - Explicitly state "< 0.8 = DO NOT EXTRACT"
4. **No Inference** - Emphasize extracting only explicit values

### For Validation Code

1. **Fail-Closed** - Reject on uncertainty, don't guess
2. **Quote Verification** - Always verify extracted value appears in quote
3. **Domain-Aware** - Use domain-specific range validation
4. **Log Rejections** - Store rejected extractions for analysis

### For Pipeline Configuration

1. **Tier-Appropriate Thresholds** - Higher thresholds for higher risk
2. **Never Auto-Approve T0/T1** - Always require human review for critical rules
3. **Monitor Rejection Rates** - Track why extractions are rejected
4. **Decay Stale Rules** - Apply temporal confidence decay

### For Human Review

1. **Prioritize Low Confidence** - Review rules with confidence < 0.9 first
2. **Check Quote Accuracy** - Verify LLM didn't infer or hallucinate
3. **Validate AppliesWhen** - Ensure conditions correctly capture rule scope
4. **Update Confidence** - Manually adjust if LLM over/under-estimated

---

## Related Documentation

- [RTL Architecture](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md) - Complete system architecture
- [Pipeline Details](./PIPELINE.md) - Agent pipeline flow
- [Trust Guarantees](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md#trust-guarantees) - Evidence-backed claims
- [Auto-Approval Policy](../../src/lib/regulatory-truth/policy/auto-approval-policy.ts) - Code implementation

---

## Appendix: Code References

### Key Files

| File | Purpose |
|------|---------|
| `schemas/common.ts` | Confidence thresholds and constants |
| `schemas/extractor.ts` | Extractor output schema with confidence |
| `prompts/index.ts` | LLM prompt with confidence scoring guidance |
| `utils/deterministic-validators.ts` | Validation functions including quote verification |
| `utils/confidence-decay.ts` | Temporal confidence decay logic |
| `policy/auto-approval-policy.ts` | Auto-approval decision logic |
| `utils/publish-gate.ts` | Publication gate checks |

### Schemas

**ConfidenceSchema:**

```typescript
// From schemas/common.ts
export const ConfidenceSchema = z.number().min(0).max(1)
```

**ExtractionItemSchema:**

```typescript
// From schemas/extractor.ts
export const ExtractionItemSchema = z.object({
  // ... other fields
  confidence: ConfidenceSchema,
  extraction_notes: z.string().nullish().default(""),
})
```

### Helper Functions

**Domain-Aware Validation:**

```typescript
export function validateByDomain(
  domain: string,
  valueType: string,
  value: number | string
): ValidationResult
```

**Quote Verification (Anti-Hallucination):**

```typescript
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string,
  options: { fuzzyThreshold?: number }
): ValidationResult
```

**Confidence Decay:**

```typescript
export function calculateConfidenceDecay(lastVerifiedAt: Date): number
export async function applyConfidenceDecay(): Promise<{
  checked: number
  decayed: number
  details: Array<{...}>
}>
```

---

**Document Status:** Complete
**Audit Compliance:** Addresses GitHub Issue #179
**Maintenance:** Update when confidence thresholds or scoring criteria change
