# Phase 1D: CandidateFact Capture System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Mode 2 exploratory signal capture system for novel regulatory content that doesn't meet Mode 1 requirements.

**Architecture:** CandidateFact capture with relaxed validation, partial confidence scores, and status workflow. Integrates with existing extraction pipeline to capture signals that fall below Mode 1 thresholds or contain novel concepts.

**Tech Stack:** TypeScript, Zod, Prisma

**Dependencies:** Phase 1A (database schema), Phase 1C (validation - for contrast)

---

## Task 1: CandidateFact Validator

**Files:**
- Create: `src/lib/regulatory-truth/validation/candidate-fact-validator.ts`
- Test: `src/lib/regulatory-truth/validation/__tests__/candidate-fact-validator.test.ts`

**Step 1: Write the failing test for CandidateFact validation**

```typescript
// src/lib/regulatory-truth/validation/__tests__/candidate-fact-validator.test.ts
import { describe, it, expect } from 'vitest'
import { validateCandidateFact, CandidateFactValidationError } from '../candidate-fact-validator'
import { CandidateFactInput } from '../../types'

describe('validateCandidateFact', () => {
  const validCandidateFactInput: CandidateFactInput = {
    suggestedConceptSlug: 'possible-new-concept',
    suggestedDomain: 'pdv',
    subject: {
      description: 'Porezni obveznik',
      confidence: 0.75,
    },
    object: {
      description: 'Nova stopa',
      confidence: 0.70,
    },
    conditions: 'Primjenjuje se na određene kategorije',
    conditionsConfidence: 0.65,
    extractedValue: '18',
    suggestedValueType: 'percentage',
    valueConfidence: 0.80,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    temporalConfidence: 0.60,
    temporalNotes: 'Date uncertain - inferred from document date',
    suggestedAuthority: 'GUIDANCE',
    legalReferenceRaw: 'Porezna uprava, neko mišljenje',
    groundingQuotes: [
      {
        evidenceId: 'evidence-456',
        exactQuote: 'Nova smanjena stopa od 18% mogla bi se primjenjivati...',
        quoteLocation: { startOffset: 200, endOffset: 260 },
        matchType: 'NORMALIZED',
      },
    ],
    overallConfidence: 0.65,
    extractorNotes: 'Extracted from draft document, uncertain validity',
    suggestedPillar: 'PDV',
    promotionCandidate: false,
  }

  it('should accept a valid CandidateFact with partial data', () => {
    const result = validateCandidateFact(validCandidateFactInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.suggestedConceptSlug).toBe('possible-new-concept')
      expect(result.data.status).toBe('CAPTURED') // Default status
    }
  })

  it('should accept CandidateFact with missing effectiveFrom', () => {
    const input = {
      ...validCandidateFactInput,
      effectiveFrom: null,
      temporalNotes: 'Could not determine effective date',
    }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(true) // Mode 2 allows missing temporal
  })

  it('should accept CandidateFact with low confidence', () => {
    const input = { ...validCandidateFactInput, overallConfidence: 0.35 }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(true) // Mode 2 allows low confidence
  })

  it('should accept CandidateFact with unknown domain', () => {
    const input = {
      ...validCandidateFactInput,
      suggestedDomain: 'some-new-domain',
    }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(true) // Mode 2 accepts unknown domains
  })

  it('should accept CandidateFact with NORMALIZED match on any tier', () => {
    const input = {
      ...validCandidateFactInput,
      groundingQuotes: [
        {
          ...validCandidateFactInput.groundingQuotes[0],
          matchType: 'NORMALIZED',
        },
      ],
    }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(true) // Mode 2 allows NORMALIZED anywhere
  })

  it('should STILL reject empty groundingQuotes', () => {
    const input = { ...validCandidateFactInput, groundingQuotes: [] }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('NO_GROUNDING')
    }
  })

  it('should STILL reject missing evidenceId in quote', () => {
    const input = {
      ...validCandidateFactInput,
      groundingQuotes: [
        {
          evidenceId: '', // Empty
          exactQuote: 'Some quote',
          quoteLocation: { startOffset: 0, endOffset: 10 },
          matchType: 'EXACT' as const,
        },
      ],
    }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_GROUNDING')
    }
  })

  it('should STILL reject missing exactQuote', () => {
    const input = {
      ...validCandidateFactInput,
      groundingQuotes: [
        {
          evidenceId: 'evidence-456',
          exactQuote: '', // Empty quote
          quoteLocation: { startOffset: 0, endOffset: 0 },
          matchType: 'EXACT' as const,
        },
      ],
    }
    const result = validateCandidateFact(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_GROUNDING')
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/candidate-fact-validator.test.ts`
Expected: FAIL with "Cannot find module '../candidate-fact-validator'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/regulatory-truth/validation/candidate-fact-validator.ts
import { z } from 'zod'
import { CandidateFactInputSchema, CandidateFactInput } from '../types'

export type CandidateFactRejectionCode =
  | 'NO_GROUNDING'
  | 'INVALID_GROUNDING'
  | 'SCHEMA_ERROR'

export interface CandidateFactValidationError {
  code: CandidateFactRejectionCode
  message: string
  field?: string
  details?: Record<string, unknown>
}

export type CandidateFactValidationResult =
  | { success: true; data: CandidateFactInput & { status: 'CAPTURED' } }
  | { success: false; error: CandidateFactValidationError }

/**
 * Validates a CandidateFact input with RELAXED requirements.
 *
 * Mode 2 differences from Mode 1:
 * - ALLOWS missing effectiveFrom (with temporalNotes)
 * - ALLOWS low confidence (< 0.90)
 * - ALLOWS unknown domain suggestions
 * - ALLOWS NORMALIZED match on any tier
 * - ALLOWS unstructured conditions
 *
 * Mode 2 STILL REQUIRES:
 * - At least one grounding quote
 * - Each quote has evidenceId and exactQuote
 */
export function validateCandidateFact(
  input: unknown
): CandidateFactValidationResult {
  // Step 1: Basic schema validation (relaxed)
  const parseResult = CandidateFactInputSchema.safeParse(input)

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return {
      success: false,
      error: {
        code: 'SCHEMA_ERROR',
        message: firstError.message,
        field: firstError.path.join('.'),
      },
    }
  }

  const data = parseResult.data

  // Step 2: Grounding requirements (STILL MANDATORY in Mode 2)
  if (!data.groundingQuotes || data.groundingQuotes.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_GROUNDING',
        message: 'CandidateFact must have at least one grounding quote',
        field: 'groundingQuotes',
      },
    }
  }

  // Step 3: Validate each grounding quote has required fields
  for (let i = 0; i < data.groundingQuotes.length; i++) {
    const quote = data.groundingQuotes[i]

    if (!quote.evidenceId || quote.evidenceId.trim() === '') {
      return {
        success: false,
        error: {
          code: 'INVALID_GROUNDING',
          message: `Grounding quote ${i} is missing evidenceId`,
          field: `groundingQuotes[${i}].evidenceId`,
        },
      }
    }

    if (!quote.exactQuote || quote.exactQuote.trim() === '') {
      return {
        success: false,
        error: {
          code: 'INVALID_GROUNDING',
          message: `Grounding quote ${i} is missing exactQuote`,
          field: `groundingQuotes[${i}].exactQuote`,
        },
      }
    }
  }

  // Set default status to CAPTURED
  return {
    success: true,
    data: {
      ...data,
      status: 'CAPTURED',
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/validation/__tests__/candidate-fact-validator.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add CandidateFact validator with relaxed Mode 2 rules"
```

---

## Task 2: CandidateFact Status Workflow

**Files:**
- Create: `src/lib/regulatory-truth/capture/candidate-status.ts`
- Test: `src/lib/regulatory-truth/capture/__tests__/candidate-status.test.ts`

**Step 1: Write the failing test for status transitions**

```typescript
// src/lib/regulatory-truth/capture/__tests__/candidate-status.test.ts
import { describe, it, expect } from 'vitest'
import {
  CandidateStatus,
  isValidTransition,
  getNextValidStatuses,
  transitionCandidateStatus,
} from '../candidate-status'

describe('CandidateStatus transitions', () => {
  describe('isValidTransition', () => {
    it('should allow CAPTURED -> UNDER_REVIEW', () => {
      expect(isValidTransition('CAPTURED', 'UNDER_REVIEW')).toBe(true)
    })

    it('should allow CAPTURED -> NEEDS_EVIDENCE', () => {
      expect(isValidTransition('CAPTURED', 'NEEDS_EVIDENCE')).toBe(true)
    })

    it('should allow UNDER_REVIEW -> PROMOTABLE', () => {
      expect(isValidTransition('UNDER_REVIEW', 'PROMOTABLE')).toBe(true)
    })

    it('should allow UNDER_REVIEW -> REJECTED', () => {
      expect(isValidTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
    })

    it('should allow UNDER_REVIEW -> NEEDS_EVIDENCE', () => {
      expect(isValidTransition('UNDER_REVIEW', 'NEEDS_EVIDENCE')).toBe(true)
    })

    it('should allow PROMOTABLE -> PROMOTED', () => {
      expect(isValidTransition('PROMOTABLE', 'PROMOTED')).toBe(true)
    })

    it('should allow NEEDS_EVIDENCE -> UNDER_REVIEW', () => {
      expect(isValidTransition('NEEDS_EVIDENCE', 'UNDER_REVIEW')).toBe(true)
    })

    it('should NOT allow CAPTURED -> PROMOTED (skip states)', () => {
      expect(isValidTransition('CAPTURED', 'PROMOTED')).toBe(false)
    })

    it('should NOT allow REJECTED -> any state', () => {
      expect(isValidTransition('REJECTED', 'CAPTURED')).toBe(false)
      expect(isValidTransition('REJECTED', 'UNDER_REVIEW')).toBe(false)
    })

    it('should NOT allow PROMOTED -> any state', () => {
      expect(isValidTransition('PROMOTED', 'CAPTURED')).toBe(false)
      expect(isValidTransition('PROMOTED', 'ARCHIVED')).toBe(false)
    })

    it('should allow ARCHIVED as terminal state from various states', () => {
      expect(isValidTransition('CAPTURED', 'ARCHIVED')).toBe(true)
      expect(isValidTransition('NEEDS_EVIDENCE', 'ARCHIVED')).toBe(true)
    })
  })

  describe('getNextValidStatuses', () => {
    it('should return valid next states for CAPTURED', () => {
      const next = getNextValidStatuses('CAPTURED')
      expect(next).toContain('UNDER_REVIEW')
      expect(next).toContain('NEEDS_EVIDENCE')
      expect(next).toContain('ARCHIVED')
      expect(next).not.toContain('PROMOTED')
    })

    it('should return empty array for terminal states', () => {
      expect(getNextValidStatuses('PROMOTED')).toEqual([])
      expect(getNextValidStatuses('REJECTED')).toEqual([])
    })
  })

  describe('transitionCandidateStatus', () => {
    const candidateFact = {
      id: 'cf-123',
      status: 'CAPTURED' as CandidateStatus,
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null,
    }

    it('should transition with metadata', () => {
      const result = transitionCandidateStatus(
        candidateFact,
        'UNDER_REVIEW',
        { reviewedBy: 'user-456', reviewNotes: 'Starting review' }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('UNDER_REVIEW')
        expect(result.data.reviewedBy).toBe('user-456')
        expect(result.data.reviewNotes).toBe('Starting review')
        expect(result.data.reviewedAt).toBeInstanceOf(Date)
      }
    })

    it('should reject invalid transition', () => {
      const result = transitionCandidateStatus(
        candidateFact,
        'PROMOTED',
        { reviewedBy: 'user-456' }
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid transition')
      }
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/candidate-status.test.ts`
Expected: FAIL with "Cannot find module '../candidate-status'"

**Step 3: Implement status workflow**

```typescript
// src/lib/regulatory-truth/capture/candidate-status.ts

export type CandidateStatus =
  | 'CAPTURED'        // Initial extraction, awaiting review
  | 'UNDER_REVIEW'    // Human is reviewing
  | 'NEEDS_EVIDENCE'  // Grounding insufficient, needs more sources
  | 'PROMOTABLE'      // Ready for Mode 1 promotion
  | 'REJECTED'        // Not valid regulatory content
  | 'PROMOTED'        // Successfully promoted to Mode 1
  | 'ARCHIVED'        // No longer relevant

/**
 * Valid status transitions per design doc workflow:
 *
 * CAPTURED → UNDER_REVIEW (confidence >= 0.85)
 * CAPTURED → NEEDS_EVIDENCE (confidence < 0.85)
 * CAPTURED → ARCHIVED (no longer relevant)
 *
 * UNDER_REVIEW → PROMOTABLE (ready for promotion)
 * UNDER_REVIEW → REJECTED (invalid content)
 * UNDER_REVIEW → NEEDS_EVIDENCE (insufficient grounding)
 *
 * NEEDS_EVIDENCE → UNDER_REVIEW (evidence added)
 * NEEDS_EVIDENCE → ARCHIVED (abandoned)
 *
 * PROMOTABLE → PROMOTED (governance approved)
 * PROMOTABLE → REJECTED (governance rejected)
 *
 * PROMOTED → (terminal, no transitions out)
 * REJECTED → (terminal, no transitions out)
 * ARCHIVED → (terminal, no transitions out)
 */
const STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  CAPTURED: ['UNDER_REVIEW', 'NEEDS_EVIDENCE', 'ARCHIVED'],
  UNDER_REVIEW: ['PROMOTABLE', 'REJECTED', 'NEEDS_EVIDENCE'],
  NEEDS_EVIDENCE: ['UNDER_REVIEW', 'ARCHIVED'],
  PROMOTABLE: ['PROMOTED', 'REJECTED'],
  REJECTED: [],  // Terminal
  PROMOTED: [],  // Terminal
  ARCHIVED: [],  // Terminal
}

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  from: CandidateStatus,
  to: CandidateStatus
): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

/**
 * Get all valid next statuses from current status.
 */
export function getNextValidStatuses(
  current: CandidateStatus
): CandidateStatus[] {
  return STATUS_TRANSITIONS[current]
}

export interface CandidateFactForTransition {
  id: string
  status: CandidateStatus
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
}

export interface TransitionMetadata {
  reviewedBy: string
  reviewNotes?: string
}

export type TransitionResult =
  | {
      success: true
      data: CandidateFactForTransition
    }
  | {
      success: false
      error: string
    }

/**
 * Transition a CandidateFact to a new status with metadata.
 */
export function transitionCandidateStatus(
  candidateFact: CandidateFactForTransition,
  newStatus: CandidateStatus,
  metadata: TransitionMetadata
): TransitionResult {
  if (!isValidTransition(candidateFact.status, newStatus)) {
    return {
      success: false,
      error: `Invalid transition from ${candidateFact.status} to ${newStatus}. Valid transitions: ${STATUS_TRANSITIONS[candidateFact.status].join(', ') || 'none (terminal state)'}`,
    }
  }

  return {
    success: true,
    data: {
      ...candidateFact,
      status: newStatus,
      reviewedBy: metadata.reviewedBy,
      reviewNotes: metadata.reviewNotes || candidateFact.reviewNotes,
      reviewedAt: new Date(),
    },
  }
}

/**
 * Check if a status is terminal (no further transitions).
 */
export function isTerminalStatus(status: CandidateStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0
}

/**
 * Auto-determine initial status based on confidence.
 * Per design doc: confidence < 0.85 → NEEDS_EVIDENCE
 */
export function determineInitialStatus(
  overallConfidence: number
): CandidateStatus {
  if (overallConfidence < 0.85) {
    return 'NEEDS_EVIDENCE'
  }
  return 'UNDER_REVIEW'
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/candidate-status.test.ts`
Expected: PASS (all 13 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/capture/
git commit -m "feat(rtl): implement CandidateFact status workflow transitions"
```

---

## Task 3: CandidateFact Capture Service

**Files:**
- Create: `src/lib/regulatory-truth/capture/capture-service.ts`
- Test: `src/lib/regulatory-truth/capture/__tests__/capture-service.test.ts`

**Step 1: Write the failing test for capture service**

```typescript
// src/lib/regulatory-truth/capture/__tests__/capture-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CandidateFactCaptureService } from '../capture-service'
import { CandidateFactInput } from '../../types'

describe('CandidateFactCaptureService', () => {
  const mockPrisma = {
    candidateFact: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    evidence: {
      findUnique: vi.fn(),
    },
  }

  const service = new CandidateFactCaptureService(mockPrisma as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validInput: CandidateFactInput = {
    suggestedConceptSlug: 'possible-concept',
    suggestedDomain: 'pdv',
    subject: { description: 'Test subject', confidence: 0.7 },
    object: { description: 'Test object', confidence: 0.7 },
    conditions: 'Test conditions',
    conditionsConfidence: 0.6,
    extractedValue: '10',
    suggestedValueType: 'percentage',
    valueConfidence: 0.8,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    temporalConfidence: 0.5,
    temporalNotes: 'Uncertain',
    suggestedAuthority: 'GUIDANCE',
    legalReferenceRaw: 'Some reference',
    groundingQuotes: [
      {
        evidenceId: 'ev-123',
        exactQuote: 'Test quote with 10%',
        quoteLocation: { startOffset: 0, endOffset: 18 },
        matchType: 'EXACT',
      },
    ],
    overallConfidence: 0.65,
    extractorNotes: 'Test notes',
    suggestedPillar: 'PDV',
    promotionCandidate: false,
  }

  describe('capture', () => {
    it('should capture a valid CandidateFact', async () => {
      mockPrisma.evidence.findUnique.mockResolvedValue({
        id: 'ev-123',
        rawContent: 'Test quote with 10% rate',
      })
      mockPrisma.candidateFact.create.mockResolvedValue({
        id: 'cf-123',
        ...validInput,
        status: 'NEEDS_EVIDENCE', // overallConfidence < 0.85
      })

      const result = await service.capture(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('NEEDS_EVIDENCE')
        expect(mockPrisma.candidateFact.create).toHaveBeenCalled()
      }
    })

    it('should auto-assign UNDER_REVIEW for high confidence', async () => {
      const highConfidenceInput = {
        ...validInput,
        overallConfidence: 0.90,
      }

      mockPrisma.evidence.findUnique.mockResolvedValue({
        id: 'ev-123',
        rawContent: 'Test quote with 10% rate',
      })
      mockPrisma.candidateFact.create.mockResolvedValue({
        id: 'cf-123',
        ...highConfidenceInput,
        status: 'UNDER_REVIEW',
      })

      const result = await service.capture(highConfidenceInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(mockPrisma.candidateFact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'UNDER_REVIEW',
            }),
          })
        )
      }
    })

    it('should reject when Evidence not found', async () => {
      mockPrisma.evidence.findUnique.mockResolvedValue(null)

      const result = await service.capture(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Evidence')
      }
    })

    it('should reject when grounding quote not in Evidence', async () => {
      mockPrisma.evidence.findUnique.mockResolvedValue({
        id: 'ev-123',
        rawContent: 'Completely different content',
      })

      const result = await service.capture(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found in Evidence')
      }
    })
  })

  describe('findPendingReview', () => {
    it('should return CandidateFacts awaiting review', async () => {
      mockPrisma.candidateFact.findMany.mockResolvedValue([
        { id: 'cf-1', status: 'UNDER_REVIEW' },
        { id: 'cf-2', status: 'UNDER_REVIEW' },
      ])

      const result = await service.findPendingReview()

      expect(result.length).toBe(2)
      expect(mockPrisma.candidateFact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'UNDER_REVIEW' },
        })
      )
    })
  })

  describe('findNeedingEvidence', () => {
    it('should return CandidateFacts needing more evidence', async () => {
      mockPrisma.candidateFact.findMany.mockResolvedValue([
        { id: 'cf-3', status: 'NEEDS_EVIDENCE' },
      ])

      const result = await service.findNeedingEvidence()

      expect(result.length).toBe(1)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/capture-service.test.ts`
Expected: FAIL with "Cannot find module '../capture-service'"

**Step 3: Implement capture service**

```typescript
// src/lib/regulatory-truth/capture/capture-service.ts
import { PrismaClient } from '@prisma/client'
import { validateCandidateFact } from '../validation/candidate-fact-validator'
import { verifyGroundingQuote } from '../validation/rule-fact-validator'
import { determineInitialStatus, CandidateStatus } from './candidate-status'
import { CandidateFactInput } from '../types'

export interface CaptureResult {
  success: boolean
  data?: {
    id: string
    status: CandidateStatus
  }
  error?: string
}

/**
 * Service for capturing Mode 2 CandidateFacts.
 *
 * Responsibilities:
 * - Validate input against Mode 2 rules
 * - Verify grounding quotes exist in Evidence
 * - Auto-assign initial status based on confidence
 * - Persist to database
 */
export class CandidateFactCaptureService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Capture a new CandidateFact from extraction output.
   */
  async capture(input: CandidateFactInput): Promise<CaptureResult> {
    // Step 1: Validate input
    const validationResult = validateCandidateFact(input)
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.message}`,
      }
    }

    // Step 2: Verify all grounding quotes
    for (const quote of input.groundingQuotes) {
      const evidence = await this.prisma.evidence.findUnique({
        where: { id: quote.evidenceId },
        select: { id: true, rawContent: true },
      })

      if (!evidence) {
        return {
          success: false,
          error: `Evidence ${quote.evidenceId} not found`,
        }
      }

      // Mode 2 still requires quote to exist in evidence
      const groundingResult = verifyGroundingQuote(
        {
          evidenceId: quote.evidenceId,
          exactQuote: quote.exactQuote,
          quoteLocation: quote.quoteLocation || { startOffset: 0, endOffset: 0 },
          matchType: quote.matchType || 'NORMALIZED',
        },
        evidence.rawContent || ''
      )

      if (!groundingResult.verified) {
        return {
          success: false,
          error: `Quote not found in Evidence ${quote.evidenceId}: "${quote.exactQuote.substring(0, 50)}..."`,
        }
      }
    }

    // Step 3: Determine initial status
    const initialStatus = determineInitialStatus(input.overallConfidence)

    // Step 4: Persist to database
    const candidateFact = await this.prisma.candidateFact.create({
      data: {
        suggestedConceptSlug: input.suggestedConceptSlug,
        suggestedDomain: input.suggestedDomain,
        subject: input.subject,
        object: input.object,
        conditions: input.conditions,
        conditionsConfidence: input.conditionsConfidence,
        extractedValue: input.extractedValue,
        suggestedValueType: input.suggestedValueType,
        valueConfidence: input.valueConfidence,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
        temporalConfidence: input.temporalConfidence,
        temporalNotes: input.temporalNotes,
        suggestedAuthority: input.suggestedAuthority,
        legalReferenceRaw: input.legalReferenceRaw,
        groundingQuotes: input.groundingQuotes,
        overallConfidence: input.overallConfidence,
        extractorNotes: input.extractorNotes,
        suggestedPillar: input.suggestedPillar,
        promotionCandidate: input.promotionCandidate,
        status: initialStatus,
      },
    })

    return {
      success: true,
      data: {
        id: candidateFact.id,
        status: candidateFact.status as CandidateStatus,
      },
    }
  }

  /**
   * Find CandidateFacts pending human review.
   */
  async findPendingReview() {
    return this.prisma.candidateFact.findMany({
      where: { status: 'UNDER_REVIEW' },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * Find CandidateFacts needing more evidence.
   */
  async findNeedingEvidence() {
    return this.prisma.candidateFact.findMany({
      where: { status: 'NEEDS_EVIDENCE' },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * Find CandidateFacts ready for promotion.
   */
  async findPromotable() {
    return this.prisma.candidateFact.findMany({
      where: { status: 'PROMOTABLE' },
      orderBy: { overallConfidence: 'desc' },
    })
  }

  /**
   * Get CandidateFact by ID with full details.
   */
  async getById(id: string) {
    return this.prisma.candidateFact.findUnique({
      where: { id },
    })
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/capture-service.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/capture/
git commit -m "feat(rtl): implement CandidateFact capture service"
```

---

## Task 4: Duplicate Detection

**Files:**
- Create: `src/lib/regulatory-truth/capture/duplicate-detector.ts`
- Test: `src/lib/regulatory-truth/capture/__tests__/duplicate-detector.test.ts`

**Step 1: Write the failing test for duplicate detection**

```typescript
// src/lib/regulatory-truth/capture/__tests__/duplicate-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DuplicateDetector } from '../duplicate-detector'
import { CandidateFactInput } from '../../types'

describe('DuplicateDetector', () => {
  const mockPrisma = {
    ruleFact: {
      findMany: vi.fn(),
    },
    candidateFact: {
      findMany: vi.fn(),
    },
  }

  const detector = new DuplicateDetector(mockPrisma as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkForDuplicates', () => {
    const input: Partial<CandidateFactInput> = {
      suggestedConceptSlug: 'pdv-standard-rate',
      extractedValue: '25',
      effectiveFrom: new Date('2013-01-01'),
    }

    it('should detect duplicate Mode 1 RuleFact', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '25',
          effectiveFrom: new Date('2013-01-01'),
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.checkForDuplicates(input as CandidateFactInput)

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateType).toBe('MODE_1')
      expect(result.duplicateId).toBe('rf-123')
    })

    it('should detect duplicate Mode 2 CandidateFact', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([])
      mockPrisma.candidateFact.findMany.mockResolvedValue([
        {
          id: 'cf-456',
          suggestedConceptSlug: 'pdv-standard-rate',
          extractedValue: '25',
          effectiveFrom: new Date('2013-01-01'),
          status: 'UNDER_REVIEW',
        },
      ])

      const result = await detector.checkForDuplicates(input as CandidateFactInput)

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateType).toBe('MODE_2')
      expect(result.duplicateId).toBe('cf-456')
    })

    it('should not flag as duplicate if value differs', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '13', // Different value
          effectiveFrom: new Date('2013-01-01'),
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.checkForDuplicates(input as CandidateFactInput)

      expect(result.isDuplicate).toBe(false)
    })

    it('should not flag as duplicate if temporal period differs', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '25',
          effectiveFrom: new Date('2020-01-01'), // Different date
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.checkForDuplicates(input as CandidateFactInput)

      expect(result.isDuplicate).toBe(false)
    })

    it('should ignore ARCHIVED/REJECTED CandidateFacts', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([])
      mockPrisma.candidateFact.findMany.mockResolvedValue([
        {
          id: 'cf-456',
          suggestedConceptSlug: 'pdv-standard-rate',
          extractedValue: '25',
          effectiveFrom: new Date('2013-01-01'),
          status: 'REJECTED', // Archived or rejected
        },
      ])

      const result = await detector.checkForDuplicates(input as CandidateFactInput)

      expect(result.isDuplicate).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/duplicate-detector.test.ts`
Expected: FAIL with "Cannot find module '../duplicate-detector'"

**Step 3: Implement duplicate detector**

```typescript
// src/lib/regulatory-truth/capture/duplicate-detector.ts
import { PrismaClient } from '@prisma/client'
import { CandidateFactInput } from '../types'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicateType?: 'MODE_1' | 'MODE_2'
  duplicateId?: string
  reason?: string
}

/**
 * Detects duplicate CandidateFacts against:
 * 1. Existing Mode 1 RuleFacts (can't create Mode 2 for something already canonical)
 * 2. Existing Mode 2 CandidateFacts (avoid duplicate work)
 */
export class DuplicateDetector {
  constructor(private prisma: PrismaClient) {}

  async checkForDuplicates(
    input: CandidateFactInput
  ): Promise<DuplicateCheckResult> {
    // Only check if we have enough info to compare
    if (!input.suggestedConceptSlug || !input.extractedValue) {
      return { isDuplicate: false }
    }

    // Check Mode 1 RuleFacts first
    const existingRuleFacts = await this.prisma.ruleFact.findMany({
      where: {
        conceptSlug: input.suggestedConceptSlug,
      },
      select: {
        id: true,
        conceptSlug: true,
        value: true,
        effectiveFrom: true,
        effectiveUntil: true,
      },
    })

    for (const rf of existingRuleFacts) {
      if (this.isValueMatch(rf.value, input.extractedValue) &&
          this.isTemporalOverlap(rf, input)) {
        return {
          isDuplicate: true,
          duplicateType: 'MODE_1',
          duplicateId: rf.id,
          reason: `Existing RuleFact ${rf.id} covers same concept, value, and time period`,
        }
      }
    }

    // Check Mode 2 CandidateFacts (excluding terminal states)
    const existingCandidateFacts = await this.prisma.candidateFact.findMany({
      where: {
        suggestedConceptSlug: input.suggestedConceptSlug,
        status: {
          notIn: ['REJECTED', 'ARCHIVED', 'PROMOTED'],
        },
      },
      select: {
        id: true,
        suggestedConceptSlug: true,
        extractedValue: true,
        effectiveFrom: true,
        effectiveUntil: true,
        status: true,
      },
    })

    for (const cf of existingCandidateFacts) {
      if (cf.extractedValue &&
          this.isValueMatch(cf.extractedValue, input.extractedValue) &&
          this.isTemporalOverlap(cf, input)) {
        return {
          isDuplicate: true,
          duplicateType: 'MODE_2',
          duplicateId: cf.id,
          reason: `Existing CandidateFact ${cf.id} (${cf.status}) covers same concept, value, and time period`,
        }
      }
    }

    return { isDuplicate: false }
  }

  private isValueMatch(value1: string, value2: string): boolean {
    // Normalize values for comparison
    const normalize = (v: string) => v.replace(/[.,\s%]/g, '').toLowerCase()
    return normalize(value1) === normalize(value2)
  }

  private isTemporalOverlap(
    existing: { effectiveFrom: Date | null; effectiveUntil: Date | null },
    input: { effectiveFrom: Date | null; effectiveUntil: Date | null }
  ): boolean {
    // If either has no effectiveFrom, we can't determine overlap precisely
    if (!existing.effectiveFrom || !input.effectiveFrom) {
      // Conservative: assume overlap if dates unknown
      return true
    }

    // Check if same effectiveFrom date
    const existingDate = existing.effectiveFrom.getTime()
    const inputDate = input.effectiveFrom.getTime()

    return existingDate === inputDate
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/duplicate-detector.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/capture/
git commit -m "feat(rtl): add duplicate detection for CandidateFacts"
```

---

## Task 5: Capture Module Exports

**Files:**
- Create: `src/lib/regulatory-truth/capture/index.ts`
- Modify: `src/lib/regulatory-truth/validation/index.ts` (add CandidateFact exports)

**Step 1: Write the failing test for exports**

```typescript
// src/lib/regulatory-truth/capture/__tests__/exports.test.ts
import { describe, it, expect } from 'vitest'

describe('capture module exports', () => {
  it('should export all capture functions and classes', async () => {
    const capture = await import('../index')

    expect(capture.CandidateFactCaptureService).toBeDefined()
    expect(capture.DuplicateDetector).toBeDefined()
    expect(capture.isValidTransition).toBeDefined()
    expect(capture.getNextValidStatuses).toBeDefined()
    expect(capture.transitionCandidateStatus).toBeDefined()
    expect(capture.determineInitialStatus).toBeDefined()
    expect(capture.isTerminalStatus).toBeDefined()
  })
})

describe('validation module exports CandidateFact validator', () => {
  it('should export CandidateFact validator', async () => {
    const validation = await import('../../validation')

    expect(validation.validateCandidateFact).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/exports.test.ts`
Expected: FAIL with "Cannot find module '../index'"

**Step 3: Create capture index**

```typescript
// src/lib/regulatory-truth/capture/index.ts
export { CandidateFactCaptureService, type CaptureResult } from './capture-service'
export { DuplicateDetector, type DuplicateCheckResult } from './duplicate-detector'
export {
  isValidTransition,
  getNextValidStatuses,
  transitionCandidateStatus,
  determineInitialStatus,
  isTerminalStatus,
  type CandidateStatus,
  type CandidateFactForTransition,
  type TransitionMetadata,
  type TransitionResult,
} from './candidate-status'
```

```typescript
// Update src/lib/regulatory-truth/validation/index.ts
// Add to existing exports:
export {
  validateCandidateFact,
  type CandidateFactRejectionCode,
  type CandidateFactValidationError,
  type CandidateFactValidationResult,
} from './candidate-fact-validator'
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/capture/__tests__/exports.test.ts`
Expected: PASS (both tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/capture/ src/lib/regulatory-truth/validation/
git commit -m "feat(rtl): add capture module exports"
```

---

## Summary

Phase 1D implements:

1. **CandidateFact Validator** - Relaxed validation for Mode 2 signals
2. **Status Workflow** - CAPTURED → UNDER_REVIEW → PROMOTABLE → PROMOTED
3. **Capture Service** - Validates, verifies grounding, persists CandidateFacts
4. **Duplicate Detection** - Prevents redundant Mode 2 captures
5. **Module Exports** - Clean public API

Mode 2 differences from Mode 1:
- ALLOWS missing effectiveFrom (with temporalNotes)
- ALLOWS low confidence (< 0.90)
- ALLOWS unknown domain suggestions
- ALLOWS NORMALIZED match on any tier
- ALLOWS unstructured conditions

Mode 2 STILL REQUIRES:
- At least one grounding quote
- Each quote has evidenceId and exactQuote
- Quote exists in Evidence (verified)
