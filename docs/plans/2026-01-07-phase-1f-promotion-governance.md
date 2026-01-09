# Phase 1F: Promotion Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the governance workflow for promoting CandidateFacts (Mode 2) to RuleFacts (Mode 1), including evidence thresholds, confidence requirements, human review, and audit trail.

**Architecture:** Promotion service with eligibility checking, governance approval workflow, and RuleFact creation from validated CandidateFacts. Full audit logging of all promotion decisions.

**Tech Stack:** TypeScript, Prisma, existing validation modules

**Dependencies:** Phase 1A (types), Phase 1C (RuleFact validation), Phase 1D (CandidateFact capture)

---

## Task 1: Promotion Eligibility Checker

**Files:**
- Create: `src/lib/regulatory-truth/promotion/eligibility-checker.ts`
- Test: `src/lib/regulatory-truth/promotion/__tests__/eligibility-checker.test.ts`

**Step 1: Write the failing test for eligibility checking**

```typescript
// src/lib/regulatory-truth/promotion/__tests__/eligibility-checker.test.ts
import { describe, it, expect } from 'vitest'
import {
  checkPromotionEligibility,
  PromotionEligibility,
  EligibilityRequirement,
} from '../eligibility-checker'

describe('checkPromotionEligibility', () => {
  const baseCandidateFact = {
    id: 'cf-123',
    suggestedConceptSlug: 'pdv-standard-rate',
    overallConfidence: 0.92,
    temporalConfidence: 0.96,
    valueConfidence: 0.97,
    groundingQuotes: [
      { evidenceId: 'ev-1', exactQuote: 'Stopa iznosi 25%' },
      { evidenceId: 'ev-2', exactQuote: 'PDV 25%' },
    ],
    status: 'PROMOTABLE',
  }

  it('should pass all requirements for eligible candidate', () => {
    const result = checkPromotionEligibility(baseCandidateFact)

    expect(result.eligible).toBe(true)
    expect(result.passedRequirements).toContain('EVIDENCE_THRESHOLD')
    expect(result.passedRequirements).toContain('OVERALL_CONFIDENCE')
    expect(result.passedRequirements).toContain('TEMPORAL_CONFIDENCE')
    expect(result.passedRequirements).toContain('VALUE_CONFIDENCE')
    expect(result.passedRequirements).toContain('STATUS_PROMOTABLE')
  })

  it('should fail EVIDENCE_THRESHOLD with only 1 evidence', () => {
    const candidate = {
      ...baseCandidateFact,
      groundingQuotes: [{ evidenceId: 'ev-1', exactQuote: 'Quote 1' }],
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('EVIDENCE_THRESHOLD')
    expect(result.reasons['EVIDENCE_THRESHOLD']).toContain('2 independent')
  })

  it('should fail OVERALL_CONFIDENCE below 0.90', () => {
    const candidate = {
      ...baseCandidateFact,
      overallConfidence: 0.85,
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('OVERALL_CONFIDENCE')
  })

  it('should fail TEMPORAL_CONFIDENCE below 0.95', () => {
    const candidate = {
      ...baseCandidateFact,
      temporalConfidence: 0.90,
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('TEMPORAL_CONFIDENCE')
  })

  it('should fail VALUE_CONFIDENCE below 0.95', () => {
    const candidate = {
      ...baseCandidateFact,
      valueConfidence: 0.90,
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('VALUE_CONFIDENCE')
  })

  it('should fail STATUS_PROMOTABLE when not in PROMOTABLE status', () => {
    const candidate = {
      ...baseCandidateFact,
      status: 'UNDER_REVIEW',
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('STATUS_PROMOTABLE')
  })

  it('should count unique evidence sources', () => {
    const candidate = {
      ...baseCandidateFact,
      groundingQuotes: [
        { evidenceId: 'ev-1', exactQuote: 'Quote 1' },
        { evidenceId: 'ev-1', exactQuote: 'Quote 2' }, // Same evidence
      ],
    }

    const result = checkPromotionEligibility(candidate)

    expect(result.eligible).toBe(false)
    expect(result.failedRequirements).toContain('EVIDENCE_THRESHOLD')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/eligibility-checker.test.ts`
Expected: FAIL with "Cannot find module '../eligibility-checker'"

**Step 3: Implement eligibility checker**

```typescript
// src/lib/regulatory-truth/promotion/eligibility-checker.ts

/**
 * Eligibility requirements for promotion from Mode 2 to Mode 1.
 *
 * From design doc Section 5: Promotion Governance
 */
export type EligibilityRequirement =
  | 'EVIDENCE_THRESHOLD'    // Minimum 2 independent Evidence sources
  | 'OVERALL_CONFIDENCE'    // Overall confidence >= 0.90
  | 'TEMPORAL_CONFIDENCE'   // Temporal confidence >= 0.95
  | 'VALUE_CONFIDENCE'      // Value confidence >= 0.95
  | 'STATUS_PROMOTABLE'     // Must be in PROMOTABLE status
  | 'NO_CONFLICTS'          // No conflicting extractions

/**
 * Thresholds for promotion eligibility.
 */
const THRESHOLDS = {
  minEvidenceSources: 2,
  minOverallConfidence: 0.90,
  minTemporalConfidence: 0.95,
  minValueConfidence: 0.95,
} as const

/**
 * Result of eligibility check.
 */
export interface PromotionEligibility {
  eligible: boolean
  passedRequirements: EligibilityRequirement[]
  failedRequirements: EligibilityRequirement[]
  reasons: Partial<Record<EligibilityRequirement, string>>
}

/**
 * CandidateFact input for eligibility checking.
 */
export interface CandidateForPromotion {
  id: string
  suggestedConceptSlug?: string | null
  overallConfidence: number
  temporalConfidence?: number | null
  valueConfidence?: number | null
  groundingQuotes: Array<{ evidenceId: string; exactQuote: string }>
  status: string
}

/**
 * Check if a CandidateFact is eligible for promotion to Mode 1.
 *
 * Requirements from design doc:
 * 1. Evidence Threshold: Min 2 independent Evidence sources
 * 2. Confidence Threshold: Overall >= 0.90, Temporal >= 0.95, Value >= 0.95
 * 3. Status: Must be PROMOTABLE
 * 4. No conflicts (checked separately)
 */
export function checkPromotionEligibility(
  candidate: CandidateForPromotion
): PromotionEligibility {
  const passed: EligibilityRequirement[] = []
  const failed: EligibilityRequirement[] = []
  const reasons: Partial<Record<EligibilityRequirement, string>> = {}

  // Check 1: Evidence threshold (unique evidence sources)
  const uniqueEvidenceIds = new Set(
    candidate.groundingQuotes.map((q) => q.evidenceId)
  )
  if (uniqueEvidenceIds.size >= THRESHOLDS.minEvidenceSources) {
    passed.push('EVIDENCE_THRESHOLD')
  } else {
    failed.push('EVIDENCE_THRESHOLD')
    reasons['EVIDENCE_THRESHOLD'] =
      `Requires ${THRESHOLDS.minEvidenceSources} independent Evidence sources, found ${uniqueEvidenceIds.size}`
  }

  // Check 2: Overall confidence
  if (candidate.overallConfidence >= THRESHOLDS.minOverallConfidence) {
    passed.push('OVERALL_CONFIDENCE')
  } else {
    failed.push('OVERALL_CONFIDENCE')
    reasons['OVERALL_CONFIDENCE'] =
      `Overall confidence ${candidate.overallConfidence.toFixed(2)} below threshold ${THRESHOLDS.minOverallConfidence}`
  }

  // Check 3: Temporal confidence
  const temporalConf = candidate.temporalConfidence ?? 0
  if (temporalConf >= THRESHOLDS.minTemporalConfidence) {
    passed.push('TEMPORAL_CONFIDENCE')
  } else {
    failed.push('TEMPORAL_CONFIDENCE')
    reasons['TEMPORAL_CONFIDENCE'] =
      `Temporal confidence ${temporalConf.toFixed(2)} below threshold ${THRESHOLDS.minTemporalConfidence}`
  }

  // Check 4: Value confidence
  const valueConf = candidate.valueConfidence ?? 0
  if (valueConf >= THRESHOLDS.minValueConfidence) {
    passed.push('VALUE_CONFIDENCE')
  } else {
    failed.push('VALUE_CONFIDENCE')
    reasons['VALUE_CONFIDENCE'] =
      `Value confidence ${valueConf.toFixed(2)} below threshold ${THRESHOLDS.minValueConfidence}`
  }

  // Check 5: Status must be PROMOTABLE
  if (candidate.status === 'PROMOTABLE') {
    passed.push('STATUS_PROMOTABLE')
  } else {
    failed.push('STATUS_PROMOTABLE')
    reasons['STATUS_PROMOTABLE'] =
      `Status is ${candidate.status}, must be PROMOTABLE`
  }

  return {
    eligible: failed.length === 0,
    passedRequirements: passed,
    failedRequirements: failed,
    reasons,
  }
}

/**
 * Get human-readable summary of eligibility status.
 */
export function getEligibilitySummary(eligibility: PromotionEligibility): string {
  if (eligibility.eligible) {
    return `Eligible for promotion. All ${eligibility.passedRequirements.length} requirements passed.`
  }

  const failureReasons = eligibility.failedRequirements
    .map((req) => eligibility.reasons[req] || req)
    .join('; ')

  return `Not eligible. ${eligibility.failedRequirements.length} requirement(s) failed: ${failureReasons}`
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/eligibility-checker.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/promotion/
git commit -m "feat(rtl): add promotion eligibility checker"
```

---

## Task 2: Governance Approval Record

**Files:**
- Create: `src/lib/regulatory-truth/promotion/governance-record.ts`
- Test: `src/lib/regulatory-truth/promotion/__tests__/governance-record.test.ts`

**Step 1: Write the failing test for governance records**

```typescript
// src/lib/regulatory-truth/promotion/__tests__/governance-record.test.ts
import { describe, it, expect } from 'vitest'
import {
  createGovernanceRecord,
  GovernanceDecision,
  GovernanceRecord,
} from '../governance-record'

describe('createGovernanceRecord', () => {
  it('should create approval record', () => {
    const record = createGovernanceRecord({
      candidateFactId: 'cf-123',
      decision: 'APPROVED',
      reviewerId: 'user-456',
      reviewerRole: 'domain_expert',
      notes: 'Verified against official source',
    })

    expect(record.candidateFactId).toBe('cf-123')
    expect(record.decision).toBe('APPROVED')
    expect(record.reviewerId).toBe('user-456')
    expect(record.reviewerRole).toBe('domain_expert')
    expect(record.notes).toBe('Verified against official source')
    expect(record.timestamp).toBeInstanceOf(Date)
    expect(record.id).toBeDefined()
  })

  it('should create rejection record with reason', () => {
    const record = createGovernanceRecord({
      candidateFactId: 'cf-789',
      decision: 'REJECTED',
      reviewerId: 'user-456',
      reviewerRole: 'domain_expert',
      notes: 'Incorrect interpretation of law',
      rejectionReason: 'INCORRECT_VALUE',
    })

    expect(record.decision).toBe('REJECTED')
    expect(record.rejectionReason).toBe('INCORRECT_VALUE')
  })

  it('should create request-changes record', () => {
    const record = createGovernanceRecord({
      candidateFactId: 'cf-111',
      decision: 'REQUEST_CHANGES',
      reviewerId: 'user-456',
      reviewerRole: 'domain_expert',
      notes: 'Need more evidence from official source',
      requestedChanges: ['Add evidence from Zakon o PDV-u'],
    })

    expect(record.decision).toBe('REQUEST_CHANGES')
    expect(record.requestedChanges).toContain('Add evidence from Zakon o PDV-u')
  })
})

describe('GovernanceRecord validation', () => {
  it('should require notes for rejection', () => {
    expect(() => createGovernanceRecord({
      candidateFactId: 'cf-123',
      decision: 'REJECTED',
      reviewerId: 'user-456',
      reviewerRole: 'domain_expert',
      notes: '', // Empty notes
    })).toThrow('notes required')
  })

  it('should require requestedChanges for REQUEST_CHANGES decision', () => {
    expect(() => createGovernanceRecord({
      candidateFactId: 'cf-123',
      decision: 'REQUEST_CHANGES',
      reviewerId: 'user-456',
      reviewerRole: 'domain_expert',
      notes: 'Need changes',
      requestedChanges: [], // Empty
    })).toThrow('requestedChanges required')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/governance-record.test.ts`
Expected: FAIL with "Cannot find module '../governance-record'"

**Step 3: Implement governance record**

```typescript
// src/lib/regulatory-truth/promotion/governance-record.ts
import { createId } from '@paralleldrive/cuid2'

/**
 * Governance decision types.
 */
export type GovernanceDecision =
  | 'APPROVED'          // Ready to promote
  | 'REJECTED'          // Not valid for promotion
  | 'REQUEST_CHANGES'   // Needs modifications before approval

/**
 * Rejection reasons.
 */
export type RejectionReason =
  | 'INCORRECT_VALUE'         // Value doesn't match source
  | 'INVALID_TEMPORAL'        // Temporal validity incorrect
  | 'INSUFFICIENT_GROUNDING'  // Not enough evidence
  | 'CONFLICTING_SOURCES'     // Sources contradict each other
  | 'NOT_REGULATORY'          // Not regulatory content
  | 'DUPLICATE'               // Already exists in Mode 1
  | 'OTHER'                   // Other reason (see notes)

/**
 * Reviewer role types.
 */
export type ReviewerRole =
  | 'domain_expert'    // Tax/regulatory domain expert
  | 'legal_reviewer'   // Legal compliance reviewer
  | 'system_admin'     // System administrator

/**
 * Governance record for audit trail.
 */
export interface GovernanceRecord {
  id: string
  candidateFactId: string
  decision: GovernanceDecision
  reviewerId: string
  reviewerRole: ReviewerRole
  notes: string
  rejectionReason?: RejectionReason
  requestedChanges?: string[]
  timestamp: Date
}

/**
 * Input for creating a governance record.
 */
export interface GovernanceRecordInput {
  candidateFactId: string
  decision: GovernanceDecision
  reviewerId: string
  reviewerRole: ReviewerRole
  notes: string
  rejectionReason?: RejectionReason
  requestedChanges?: string[]
}

/**
 * Create a governance record for audit trail.
 *
 * From design doc: Governance Record
 * - Promotion request logged
 * - Reviewer identity recorded
 * - Approval timestamp recorded
 * - Original CandidateFact preserved
 */
export function createGovernanceRecord(
  input: GovernanceRecordInput
): GovernanceRecord {
  // Validation
  if (input.decision === 'REJECTED' && (!input.notes || input.notes.trim() === '')) {
    throw new Error('Governance record: notes required for rejection')
  }

  if (input.decision === 'REQUEST_CHANGES') {
    if (!input.requestedChanges || input.requestedChanges.length === 0) {
      throw new Error('Governance record: requestedChanges required for REQUEST_CHANGES decision')
    }
  }

  return {
    id: createId(),
    candidateFactId: input.candidateFactId,
    decision: input.decision,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    notes: input.notes,
    rejectionReason: input.rejectionReason,
    requestedChanges: input.requestedChanges,
    timestamp: new Date(),
  }
}

/**
 * Validate that a reviewer has permission for governance actions.
 */
export function canReviewForPromotion(role: ReviewerRole): boolean {
  // Only domain experts and legal reviewers can approve promotion
  return role === 'domain_expert' || role === 'legal_reviewer'
}

/**
 * Get human-readable decision summary.
 */
export function getDecisionSummary(record: GovernanceRecord): string {
  switch (record.decision) {
    case 'APPROVED':
      return `Approved by ${record.reviewerRole} (${record.reviewerId}) at ${record.timestamp.toISOString()}`
    case 'REJECTED':
      return `Rejected by ${record.reviewerRole}: ${record.rejectionReason || 'See notes'}`
    case 'REQUEST_CHANGES':
      return `Changes requested: ${record.requestedChanges?.join(', ') || 'See notes'}`
    default:
      return `Decision: ${record.decision}`
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/governance-record.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/promotion/
git commit -m "feat(rtl): add governance record for promotion audit trail"
```

---

## Task 3: Promotion Service

**Files:**
- Create: `src/lib/regulatory-truth/promotion/promotion-service.ts`
- Test: `src/lib/regulatory-truth/promotion/__tests__/promotion-service.test.ts`

**Step 1: Write the failing test for promotion service**

```typescript
// src/lib/regulatory-truth/promotion/__tests__/promotion-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromotionService } from '../promotion-service'

describe('PromotionService', () => {
  const mockPrisma = {
    candidateFact: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ruleFact: {
      create: vi.fn(),
    },
    governanceRecord: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  }

  const service = new PromotionService(mockPrisma as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validCandidateFact = {
    id: 'cf-123',
    suggestedConceptSlug: 'pdv-standard-rate',
    suggestedDomain: 'pdv',
    subject: { description: 'PDV obveznik', confidence: 0.95 },
    object: { description: 'Stopa', confidence: 0.95 },
    conditions: '{ "always": true }',
    extractedValue: '25',
    suggestedValueType: 'percentage',
    valueConfidence: 0.97,
    effectiveFrom: new Date('2013-01-01'),
    effectiveUntil: null,
    temporalConfidence: 0.98,
    suggestedAuthority: 'LAW',
    legalReferenceRaw: 'Zakon o PDV-u čl. 38',
    groundingQuotes: [
      { evidenceId: 'ev-1', exactQuote: 'Stopa iznosi 25%', matchType: 'EXACT' },
      { evidenceId: 'ev-2', exactQuote: 'PDV 25%', matchType: 'EXACT' },
    ],
    overallConfidence: 0.95,
    status: 'PROMOTABLE',
  }

  describe('promote', () => {
    it('should promote eligible CandidateFact to RuleFact', async () => {
      mockPrisma.candidateFact.findUnique.mockResolvedValue(validCandidateFact)
      mockPrisma.ruleFact.create.mockResolvedValue({ id: 'rf-456' })
      mockPrisma.candidateFact.update.mockResolvedValue({ ...validCandidateFact, status: 'PROMOTED' })
      mockPrisma.governanceRecord.create.mockResolvedValue({ id: 'gr-789' })

      const result = await service.promote('cf-123', {
        reviewerId: 'user-456',
        reviewerRole: 'domain_expert',
        notes: 'Verified against official source',
        conceptSlug: 'pdv-standard-rate', // Confirming the concept
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.ruleFactId).toBe('rf-456')
        expect(result.governanceRecordId).toBe('gr-789')
      }
    })

    it('should fail if CandidateFact not found', async () => {
      mockPrisma.candidateFact.findUnique.mockResolvedValue(null)

      const result = await service.promote('cf-999', {
        reviewerId: 'user-456',
        reviewerRole: 'domain_expert',
        notes: 'Test',
        conceptSlug: 'pdv-standard-rate',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail if not eligible for promotion', async () => {
      const ineligible = { ...validCandidateFact, status: 'UNDER_REVIEW' }
      mockPrisma.candidateFact.findUnique.mockResolvedValue(ineligible)

      const result = await service.promote('cf-123', {
        reviewerId: 'user-456',
        reviewerRole: 'domain_expert',
        notes: 'Test',
        conceptSlug: 'pdv-standard-rate',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not eligible')
    })

    it('should fail if concept slug not in canonical registry', async () => {
      mockPrisma.candidateFact.findUnique.mockResolvedValue(validCandidateFact)

      const result = await service.promote('cf-123', {
        reviewerId: 'user-456',
        reviewerRole: 'domain_expert',
        notes: 'Test',
        conceptSlug: 'unknown-concept', // Invalid
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not in Canonical Registry')
    })
  })

  describe('reject', () => {
    it('should reject CandidateFact with governance record', async () => {
      mockPrisma.candidateFact.findUnique.mockResolvedValue({ ...validCandidateFact, status: 'PROMOTABLE' })
      mockPrisma.candidateFact.update.mockResolvedValue({ ...validCandidateFact, status: 'REJECTED' })
      mockPrisma.governanceRecord.create.mockResolvedValue({ id: 'gr-111' })

      const result = await service.reject('cf-123', {
        reviewerId: 'user-456',
        reviewerRole: 'domain_expert',
        notes: 'Incorrect interpretation',
        reason: 'INCORRECT_VALUE',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.candidateFact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cf-123' },
          data: expect.objectContaining({ status: 'REJECTED' }),
        })
      )
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/promotion-service.test.ts`
Expected: FAIL with "Cannot find module '../promotion-service'"

**Step 3: Implement promotion service**

```typescript
// src/lib/regulatory-truth/promotion/promotion-service.ts
import { PrismaClient } from '@prisma/client'
import { checkPromotionEligibility, getEligibilitySummary } from './eligibility-checker'
import { createGovernanceRecord, GovernanceDecision, RejectionReason, ReviewerRole } from './governance-record'
import { CANONICAL_CONCEPTS } from '../canonical/concepts'
import { validateRuleFact } from '../validation/rule-fact-validator'

/**
 * Promotion input for governance approval.
 */
export interface PromotionInput {
  reviewerId: string
  reviewerRole: ReviewerRole
  notes: string
  conceptSlug: string  // Confirmed canonical concept
  legalReference?: {
    law: string
    article?: string
    paragraph?: string
    officialUrl?: string
  }
}

/**
 * Rejection input.
 */
export interface RejectionInput {
  reviewerId: string
  reviewerRole: ReviewerRole
  notes: string
  reason: RejectionReason
}

/**
 * Result of promotion attempt.
 */
export interface PromotionResult {
  success: boolean
  ruleFactId?: string
  governanceRecordId?: string
  error?: string
}

/**
 * Service for promoting CandidateFacts to RuleFacts.
 *
 * Implements the promotion workflow from design doc:
 * 1. Check eligibility
 * 2. Verify concept is in Canonical Registry
 * 3. Create RuleFact from CandidateFact
 * 4. Update CandidateFact status to PROMOTED
 * 5. Create governance record
 */
export class PromotionService {
  private validConceptSlugs: string[]

  constructor(private prisma: PrismaClient) {
    this.validConceptSlugs = CANONICAL_CONCEPTS.map((c) => c.slug)
  }

  /**
   * Promote a CandidateFact to Mode 1 RuleFact.
   */
  async promote(
    candidateFactId: string,
    input: PromotionInput
  ): Promise<PromotionResult> {
    // Step 1: Fetch CandidateFact
    const candidateFact = await this.prisma.candidateFact.findUnique({
      where: { id: candidateFactId },
    })

    if (!candidateFact) {
      return { success: false, error: `CandidateFact ${candidateFactId} not found` }
    }

    // Step 2: Check eligibility
    const eligibility = checkPromotionEligibility(candidateFact as any)
    if (!eligibility.eligible) {
      return {
        success: false,
        error: `CandidateFact not eligible for promotion: ${getEligibilitySummary(eligibility)}`,
      }
    }

    // Step 3: Verify concept is in Canonical Registry
    if (!this.validConceptSlugs.includes(input.conceptSlug)) {
      return {
        success: false,
        error: `Concept slug '${input.conceptSlug}' not in Canonical Registry`,
      }
    }

    // Step 4: Build RuleFact from CandidateFact
    const ruleFactInput = this.buildRuleFactInput(candidateFact, input)

    // Step 5: Validate RuleFact input
    const validation = validateRuleFact(ruleFactInput)
    if (!validation.success) {
      return {
        success: false,
        error: `RuleFact validation failed: ${validation.error.message}`,
      }
    }

    // Step 6: Execute promotion in transaction
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Create RuleFact
        const ruleFact = await tx.ruleFact.create({
          data: ruleFactInput,
        })

        // Update CandidateFact status
        await tx.candidateFact.update({
          where: { id: candidateFactId },
          data: {
            status: 'PROMOTED',
            reviewedAt: new Date(),
            reviewedBy: input.reviewerId,
            reviewNotes: input.notes,
          },
        })

        // Create governance record
        const governanceRecord = await tx.governanceRecord.create({
          data: {
            candidateFactId,
            ruleFactId: ruleFact.id,
            decision: 'APPROVED',
            reviewerId: input.reviewerId,
            reviewerRole: input.reviewerRole,
            notes: input.notes,
          },
        })

        return { ruleFact, governanceRecord }
      })

      return {
        success: true,
        ruleFactId: result.ruleFact.id,
        governanceRecordId: result.governanceRecord.id,
      }
    } catch (error) {
      return {
        success: false,
        error: `Promotion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Reject a CandidateFact with governance record.
   */
  async reject(
    candidateFactId: string,
    input: RejectionInput
  ): Promise<PromotionResult> {
    const candidateFact = await this.prisma.candidateFact.findUnique({
      where: { id: candidateFactId },
    })

    if (!candidateFact) {
      return { success: false, error: `CandidateFact ${candidateFactId} not found` }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Update CandidateFact status
        await tx.candidateFact.update({
          where: { id: candidateFactId },
          data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedBy: input.reviewerId,
            reviewNotes: input.notes,
          },
        })

        // Create governance record
        await tx.governanceRecord.create({
          data: {
            candidateFactId,
            decision: 'REJECTED',
            reviewerId: input.reviewerId,
            reviewerRole: input.reviewerRole,
            notes: input.notes,
            rejectionReason: input.reason,
          },
        })
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Rejection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Build RuleFact input from CandidateFact.
   */
  private buildRuleFactInput(candidateFact: any, input: PromotionInput): any {
    return {
      conceptSlug: input.conceptSlug,
      subject: {
        type: this.inferSubjectType(candidateFact.suggestedDomain),
        description: candidateFact.subject?.description || '',
      },
      object: {
        type: this.inferObjectType(candidateFact.suggestedValueType),
        description: candidateFact.object?.description || '',
      },
      conditions: candidateFact.conditions
        ? JSON.parse(candidateFact.conditions)
        : { always: true },
      value: candidateFact.extractedValue,
      valueType: candidateFact.suggestedValueType || 'percentage',
      displayValue: this.formatDisplayValue(
        candidateFact.extractedValue,
        candidateFact.suggestedValueType
      ),
      effectiveFrom: candidateFact.effectiveFrom,
      effectiveUntil: candidateFact.effectiveUntil,
      authority: candidateFact.suggestedAuthority || 'LAW',
      legalReference: input.legalReference || {
        law: candidateFact.legalReferenceRaw || 'Unknown',
      },
      groundingQuotes: candidateFact.groundingQuotes,
      riskTier: this.inferRiskTier(input.conceptSlug),
      confidence: candidateFact.overallConfidence,
      status: 'ACTIVE',
    }
  }

  private inferSubjectType(domain?: string | null): string {
    const domainToSubject: Record<string, string> = {
      pdv: 'pdv_obveznik',
      pausalni: 'obrtnik',
      porez_dohodak: 'fizicka_osoba',
      doprinosi: 'osiguranik',
      fiskalizacija: 'obveznik_fiskalizacije',
    }
    return domainToSubject[domain || ''] || 'porezni_obveznik'
  }

  private inferObjectType(valueType?: string | null): string {
    const typeToObject: Record<string, string> = {
      percentage: 'postotak',
      currency_eur: 'iznos',
      deadline_day: 'rok',
      boolean: 'obveza',
    }
    return typeToObject[valueType || ''] || 'iznos'
  }

  private formatDisplayValue(value?: string | null, type?: string | null): string {
    if (!value) return ''
    switch (type) {
      case 'percentage':
        return `${value}%`
      case 'currency_eur':
        return `${Number(value).toLocaleString('hr-HR')} EUR`
      default:
        return value
    }
  }

  private inferRiskTier(conceptSlug: string): 'T0' | 'T1' | 'T2' | 'T3' {
    // Rate concepts are T0 (critical)
    if (conceptSlug.includes('rate') || conceptSlug.includes('stopa')) {
      return 'T0'
    }
    // Threshold concepts are T1 (high)
    if (conceptSlug.includes('threshold') || conceptSlug.includes('prag')) {
      return 'T1'
    }
    // Deadline concepts are T2 (medium)
    if (conceptSlug.includes('rok') || conceptSlug.includes('deadline')) {
      return 'T2'
    }
    return 'T2' // Default to medium
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/promotion-service.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/promotion/
git commit -m "feat(rtl): implement promotion service for Mode 2 to Mode 1"
```

---

## Task 4: Conflict Detector

**Files:**
- Create: `src/lib/regulatory-truth/promotion/conflict-detector.ts`
- Test: `src/lib/regulatory-truth/promotion/__tests__/conflict-detector.test.ts`

**Step 1: Write the failing test for conflict detection**

```typescript
// src/lib/regulatory-truth/promotion/__tests__/conflict-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictDetector, ConflictType } from '../conflict-detector'

describe('ConflictDetector', () => {
  const mockPrisma = {
    ruleFact: {
      findMany: vi.fn(),
    },
    candidateFact: {
      findMany: vi.fn(),
    },
  }

  const detector = new ConflictDetector(mockPrisma as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectConflicts', () => {
    it('should detect value conflict with existing RuleFact', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '25',
          effectiveFrom: new Date('2013-01-01'),
          effectiveUntil: null,
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.detectConflicts({
        conceptSlug: 'pdv-standard-rate',
        value: '20', // Different value
        effectiveFrom: new Date('2013-01-01'),
        effectiveUntil: null,
      })

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].type).toBe('VALUE_MISMATCH')
      expect(result.conflicts[0].conflictingFactId).toBe('rf-123')
    })

    it('should detect temporal overlap conflict', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '25',
          effectiveFrom: new Date('2013-01-01'),
          effectiveUntil: new Date('2020-01-01'),
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.detectConflicts({
        conceptSlug: 'pdv-standard-rate',
        value: '25',
        effectiveFrom: new Date('2019-06-01'), // Overlaps
        effectiveUntil: null,
      })

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].type).toBe('TEMPORAL_OVERLAP')
    })

    it('should not detect conflict when temporal periods are disjoint', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([
        {
          id: 'rf-123',
          conceptSlug: 'pdv-standard-rate',
          value: '25',
          effectiveFrom: new Date('2013-01-01'),
          effectiveUntil: new Date('2020-01-01'),
        },
      ])
      mockPrisma.candidateFact.findMany.mockResolvedValue([])

      const result = await detector.detectConflicts({
        conceptSlug: 'pdv-standard-rate',
        value: '25',
        effectiveFrom: new Date('2020-01-01'), // After previous ends
        effectiveUntil: null,
      })

      expect(result.hasConflicts).toBe(false)
    })

    it('should detect conflict with same-concept CandidateFact', async () => {
      mockPrisma.ruleFact.findMany.mockResolvedValue([])
      mockPrisma.candidateFact.findMany.mockResolvedValue([
        {
          id: 'cf-456',
          suggestedConceptSlug: 'pdv-standard-rate',
          extractedValue: '20',
          effectiveFrom: new Date('2013-01-01'),
          status: 'UNDER_REVIEW',
        },
      ])

      const result = await detector.detectConflicts({
        conceptSlug: 'pdv-standard-rate',
        value: '25',
        effectiveFrom: new Date('2013-01-01'),
        effectiveUntil: null,
      })

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].type).toBe('PENDING_CONFLICT')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/conflict-detector.test.ts`
Expected: FAIL with "Cannot find module '../conflict-detector'"

**Step 3: Implement conflict detector**

```typescript
// src/lib/regulatory-truth/promotion/conflict-detector.ts
import { PrismaClient } from '@prisma/client'

/**
 * Types of conflicts detected.
 */
export type ConflictType =
  | 'VALUE_MISMATCH'     // Same concept, different value, overlapping time
  | 'TEMPORAL_OVERLAP'   // Same concept/value, overlapping time (duplicate)
  | 'PENDING_CONFLICT'   // Conflict with another CandidateFact in review

/**
 * Detected conflict.
 */
export interface Conflict {
  type: ConflictType
  conflictingFactId: string
  conflictingFactType: 'RuleFact' | 'CandidateFact'
  description: string
}

/**
 * Result of conflict detection.
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean
  conflicts: Conflict[]
}

/**
 * Input for conflict detection.
 */
export interface ConflictCheckInput {
  conceptSlug: string
  value: string
  effectiveFrom: Date
  effectiveUntil: Date | null
}

/**
 * Detects conflicts between a potential promotion and existing facts.
 *
 * From design doc: No conflicting extractions allowed for promotion.
 */
export class ConflictDetector {
  constructor(private prisma: PrismaClient) {}

  /**
   * Detect conflicts with existing RuleFacts and pending CandidateFacts.
   */
  async detectConflicts(input: ConflictCheckInput): Promise<ConflictDetectionResult> {
    const conflicts: Conflict[] = []

    // Check against existing RuleFacts
    const existingRuleFacts = await this.prisma.ruleFact.findMany({
      where: {
        conceptSlug: input.conceptSlug,
        status: { not: 'DEPRECATED' },
      },
    })

    for (const rf of existingRuleFacts) {
      const temporalOverlap = this.checkTemporalOverlap(
        { effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil },
        { effectiveFrom: rf.effectiveFrom, effectiveUntil: rf.effectiveUntil }
      )

      if (temporalOverlap) {
        if (rf.value !== input.value) {
          conflicts.push({
            type: 'VALUE_MISMATCH',
            conflictingFactId: rf.id,
            conflictingFactType: 'RuleFact',
            description: `Existing RuleFact ${rf.id} has value '${rf.value}' but candidate has '${input.value}' for same temporal period`,
          })
        } else {
          conflicts.push({
            type: 'TEMPORAL_OVERLAP',
            conflictingFactId: rf.id,
            conflictingFactType: 'RuleFact',
            description: `Existing RuleFact ${rf.id} already covers this concept and time period`,
          })
        }
      }
    }

    // Check against pending CandidateFacts
    const pendingCandidates = await this.prisma.candidateFact.findMany({
      where: {
        suggestedConceptSlug: input.conceptSlug,
        status: { in: ['UNDER_REVIEW', 'PROMOTABLE'] },
      },
    })

    for (const cf of pendingCandidates) {
      if (cf.extractedValue && cf.extractedValue !== input.value) {
        const temporalOverlap = this.checkTemporalOverlap(
          { effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil },
          { effectiveFrom: cf.effectiveFrom, effectiveUntil: cf.effectiveUntil }
        )

        if (temporalOverlap) {
          conflicts.push({
            type: 'PENDING_CONFLICT',
            conflictingFactId: cf.id,
            conflictingFactType: 'CandidateFact',
            description: `Pending CandidateFact ${cf.id} (${cf.status}) has different value '${cf.extractedValue}'`,
          })
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    }
  }

  /**
   * Check if two temporal periods overlap.
   *
   * From design doc: effectiveFrom is INCLUSIVE, effectiveUntil is EXCLUSIVE.
   * null effectiveUntil means "ongoing".
   */
  private checkTemporalOverlap(
    period1: { effectiveFrom: Date; effectiveUntil: Date | null },
    period2: { effectiveFrom: Date | null; effectiveUntil: Date | null }
  ): boolean {
    if (!period2.effectiveFrom) {
      return false // Can't determine overlap without start date
    }

    const start1 = period1.effectiveFrom.getTime()
    const end1 = period1.effectiveUntil?.getTime() ?? Infinity

    const start2 = period2.effectiveFrom.getTime()
    const end2 = period2.effectiveUntil?.getTime() ?? Infinity

    // Overlap exists if: start1 < end2 AND start2 < end1
    return start1 < end2 && start2 < end1
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/conflict-detector.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/promotion/
git commit -m "feat(rtl): add conflict detector for promotion validation"
```

---

## Task 5: Promotion Module Exports

**Files:**
- Create: `src/lib/regulatory-truth/promotion/index.ts`

**Step 1: Write the failing test for exports**

```typescript
// src/lib/regulatory-truth/promotion/__tests__/exports.test.ts
import { describe, it, expect } from 'vitest'

describe('promotion module exports', () => {
  it('should export all promotion functions and types', async () => {
    const promotion = await import('../index')

    // Eligibility
    expect(promotion.checkPromotionEligibility).toBeDefined()
    expect(promotion.getEligibilitySummary).toBeDefined()

    // Governance record
    expect(promotion.createGovernanceRecord).toBeDefined()
    expect(promotion.canReviewForPromotion).toBeDefined()
    expect(promotion.getDecisionSummary).toBeDefined()

    // Promotion service
    expect(promotion.PromotionService).toBeDefined()

    // Conflict detector
    expect(promotion.ConflictDetector).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/exports.test.ts`
Expected: FAIL with "Cannot find module '../index'"

**Step 3: Create promotion index**

```typescript
// src/lib/regulatory-truth/promotion/index.ts

// Eligibility checker
export {
  checkPromotionEligibility,
  getEligibilitySummary,
  type EligibilityRequirement,
  type PromotionEligibility,
  type CandidateForPromotion,
} from './eligibility-checker'

// Governance record
export {
  createGovernanceRecord,
  canReviewForPromotion,
  getDecisionSummary,
  type GovernanceDecision,
  type RejectionReason,
  type ReviewerRole,
  type GovernanceRecord,
  type GovernanceRecordInput,
} from './governance-record'

// Promotion service
export {
  PromotionService,
  type PromotionInput,
  type RejectionInput,
  type PromotionResult,
} from './promotion-service'

// Conflict detector
export {
  ConflictDetector,
  type ConflictType,
  type Conflict,
  type ConflictDetectionResult,
  type ConflictCheckInput,
} from './conflict-detector'
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/promotion/__tests__/exports.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/promotion/
git commit -m "feat(rtl): add promotion module exports"
```

---

## Summary

Phase 1F implements:

1. **Eligibility Checker** - Validates promotion requirements
2. **Governance Record** - Audit trail for all promotion decisions
3. **Promotion Service** - Executes promotion with transaction safety
4. **Conflict Detector** - Prevents conflicting facts
5. **Module Exports** - Clean public API

Promotion requirements enforced:

| Requirement | Threshold |
|-------------|-----------|
| Evidence sources | >= 2 independent |
| Overall confidence | >= 0.90 |
| Temporal confidence | >= 0.95 |
| Value confidence | >= 0.95 |
| Status | Must be PROMOTABLE |
| No conflicts | No overlapping facts |

Promotion workflow:

```
CandidateFact (PROMOTABLE)
    │
    ▼
[Eligibility Check] ─── FAIL ──→ Return error
    │
    PASS
    │
    ▼
[Conflict Detection] ─── HAS CONFLICTS ──→ Return error
    │
    NO CONFLICTS
    │
    ▼
[Canonical Registry Check] ─── NOT FOUND ──→ Return error
    │
    FOUND
    │
    ▼
[RuleFact Validation] ─── FAIL ──→ Return error
    │
    PASS
    │
    ▼
[Transaction]
    ├── Create RuleFact
    ├── Update CandidateFact → PROMOTED
    └── Create GovernanceRecord
    │
    ▼
SUCCESS
```
