# Phase 1E: Assistant Policy Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Assistant policies for answering from Mode 1 (confident) vs Mode 2 (cautious) sources, ensuring appropriate tone, citations, and disclaimers.

**Architecture:** Policy layer between query engine and response generation. Mode detector classifies facts by source. Response formatter applies mode-appropriate templates. Decision matrix determines strategy based on availability.

**Tech Stack:** TypeScript, existing Assistant query engine

**Dependencies:** Phase 1A (types), Phase 1C (RuleFact), Phase 1D (CandidateFact)

---

## Task 1: Mode Classification Types

**Files:**
- Create: `src/lib/assistant/policy/mode-types.ts`
- Test: `src/lib/assistant/policy/__tests__/mode-types.test.ts`

**Step 1: Write the failing test for mode types**

```typescript
// src/lib/assistant/policy/__tests__/mode-types.test.ts
import { describe, it, expect } from 'vitest'
import {
  FactMode,
  FactWithMode,
  classifyFactMode,
  isMode1Fact,
  isMode2Fact,
} from '../mode-types'

describe('mode classification', () => {
  describe('classifyFactMode', () => {
    it('should classify RuleFact as MODE_1', () => {
      const ruleFact = {
        id: 'rf-123',
        conceptSlug: 'pdv-standard-rate',
        confidence: 0.95,
        // RuleFact-specific fields
        subject: { type: 'pdv_obveznik', description: 'PDV obveznik' },
        riskTier: 'T0',
      }

      const result = classifyFactMode(ruleFact)
      expect(result).toBe('MODE_1')
    })

    it('should classify CandidateFact as MODE_2', () => {
      const candidateFact = {
        id: 'cf-456',
        suggestedConceptSlug: 'possible-concept',
        overallConfidence: 0.65,
        // CandidateFact-specific fields
        status: 'UNDER_REVIEW',
        extractorNotes: 'Uncertain extraction',
      }

      const result = classifyFactMode(candidateFact)
      expect(result).toBe('MODE_2')
    })
  })

  describe('type guards', () => {
    const mode1Fact: FactWithMode = {
      mode: 'MODE_1',
      fact: {
        id: 'rf-123',
        conceptSlug: 'pdv-standard-rate',
        value: '25',
        displayValue: '25%',
        confidence: 0.95,
        effectiveFrom: new Date('2013-01-01'),
        authority: 'LAW',
        legalReference: { law: 'Zakon o PDV-u (NN 73/13)', article: '38' },
        groundingQuotes: [{ evidenceId: 'ev-1', exactQuote: 'iznosi 25%' }],
      },
    }

    const mode2Fact: FactWithMode = {
      mode: 'MODE_2',
      fact: {
        id: 'cf-456',
        suggestedConceptSlug: 'new-concept',
        extractedValue: '18',
        overallConfidence: 0.65,
        status: 'UNDER_REVIEW',
        groundingQuotes: [{ evidenceId: 'ev-2', exactQuote: 'možda 18%' }],
      },
    }

    it('should identify MODE_1 facts', () => {
      expect(isMode1Fact(mode1Fact)).toBe(true)
      expect(isMode1Fact(mode2Fact)).toBe(false)
    })

    it('should identify MODE_2 facts', () => {
      expect(isMode2Fact(mode2Fact)).toBe(true)
      expect(isMode2Fact(mode1Fact)).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/assistant/policy/__tests__/mode-types.test.ts`
Expected: FAIL with "Cannot find module '../mode-types'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/assistant/policy/mode-types.ts

/**
 * Mode classification for facts.
 *
 * MODE_1: Canonical, high-confidence facts from RuleFact table
 * MODE_2: Exploratory signals from CandidateFact table
 */
export type FactMode = 'MODE_1' | 'MODE_2'

/**
 * Fact with mode classification attached.
 */
export interface FactWithMode {
  mode: FactMode
  fact: Mode1Fact | Mode2Fact
}

/**
 * Mode 1 fact structure (from RuleFact).
 */
export interface Mode1Fact {
  id: string
  conceptSlug: string
  value: string
  displayValue: string
  confidence: number
  effectiveFrom: Date
  effectiveUntil?: Date | null
  authority: 'LAW' | 'GUIDANCE' | 'PROCEDURE' | 'PRACTICE'
  legalReference: {
    law: string
    article?: string
    paragraph?: string
    officialUrl?: string
  }
  groundingQuotes: Array<{
    evidenceId: string
    exactQuote: string
  }>
}

/**
 * Mode 2 fact structure (from CandidateFact).
 */
export interface Mode2Fact {
  id: string
  suggestedConceptSlug?: string | null
  suggestedDomain?: string | null
  extractedValue?: string | null
  overallConfidence: number
  status: string
  temporalNotes?: string | null
  legalReferenceRaw?: string | null
  groundingQuotes: Array<{
    evidenceId: string
    exactQuote: string
  }>
  extractorNotes?: string | null
}

/**
 * Classify a fact as Mode 1 or Mode 2 based on its structure.
 *
 * Detection heuristics:
 * - Mode 1: Has `conceptSlug` (not `suggestedConceptSlug`)
 * - Mode 1: Has `riskTier` field
 * - Mode 2: Has `suggestedConceptSlug`
 * - Mode 2: Has `status` field
 * - Mode 2: Has `overallConfidence` (not just `confidence`)
 */
export function classifyFactMode(fact: Record<string, unknown>): FactMode {
  // Mode 1 indicators (RuleFact)
  if ('conceptSlug' in fact && 'riskTier' in fact) {
    return 'MODE_1'
  }

  // Mode 2 indicators (CandidateFact)
  if ('suggestedConceptSlug' in fact || 'status' in fact || 'overallConfidence' in fact) {
    return 'MODE_2'
  }

  // Default to Mode 2 for safety (more cautious)
  return 'MODE_2'
}

/**
 * Type guard for Mode 1 facts.
 */
export function isMode1Fact(factWithMode: FactWithMode): factWithMode is FactWithMode & { mode: 'MODE_1'; fact: Mode1Fact } {
  return factWithMode.mode === 'MODE_1'
}

/**
 * Type guard for Mode 2 facts.
 */
export function isMode2Fact(factWithMode: FactWithMode): factWithMode is FactWithMode & { mode: 'MODE_2'; fact: Mode2Fact } {
  return factWithMode.mode === 'MODE_2'
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/assistant/policy/__tests__/mode-types.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/lib/assistant/policy/
git commit -m "feat(assistant): add mode classification types for facts"
```

---

## Task 2: Answer Policy Rules

**Files:**
- Create: `src/lib/assistant/policy/answer-policy.ts`
- Test: `src/lib/assistant/policy/__tests__/answer-policy.test.ts`

**Step 1: Write the failing test for answer policy**

```typescript
// src/lib/assistant/policy/__tests__/answer-policy.test.ts
import { describe, it, expect } from 'vitest'
import {
  AnswerPolicy,
  getAnswerPolicy,
  determineResponseStrategy,
  ResponseStrategy,
} from '../answer-policy'

describe('getAnswerPolicy', () => {
  it('should return confident policy for MODE_1', () => {
    const policy = getAnswerPolicy('MODE_1')

    expect(policy.tone).toBe('confident')
    expect(policy.showConfidence).toBe(false)
    expect(policy.requireCitation).toBe(true)
    expect(policy.requireLegalReference).toBe(true)
    expect(policy.requireTemporalContext).toBe(true)
    expect(policy.requireDisclaimer).toBe(false)
  })

  it('should return cautious policy for MODE_2', () => {
    const policy = getAnswerPolicy('MODE_2')

    expect(policy.tone).toBe('cautious')
    expect(policy.showConfidence).toBe(true)
    expect(policy.requireCitation).toBe(true)
    expect(policy.requireLegalReference).toBe(false) // Show if available
    expect(policy.requireTemporalContext).toBe(false) // Show if available
    expect(policy.requireDisclaimer).toBe(true)
  })
})

describe('determineResponseStrategy', () => {
  it('should use Mode 1 for exact fact query when available', () => {
    const strategy = determineResponseStrategy({
      queryType: 'exact_fact',
      mode1Available: true,
      mode2Available: false,
    })

    expect(strategy.primaryMode).toBe('MODE_1')
    expect(strategy.showAlternative).toBe(false)
  })

  it('should use Mode 2 with disclaimer when only Mode 2 available', () => {
    const strategy = determineResponseStrategy({
      queryType: 'exact_fact',
      mode1Available: false,
      mode2Available: true,
    })

    expect(strategy.primaryMode).toBe('MODE_2')
    expect(strategy.requireDisclaimer).toBe(true)
  })

  it('should return NO_DATA when neither mode available', () => {
    const strategy = determineResponseStrategy({
      queryType: 'exact_fact',
      mode1Available: false,
      mode2Available: false,
    })

    expect(strategy.primaryMode).toBeNull()
    expect(strategy.fallbackResponse).toBe('NO_DATA')
  })

  it('should prefer Mode 1 first for exploratory query', () => {
    const strategy = determineResponseStrategy({
      queryType: 'exploratory',
      mode1Available: true,
      mode2Available: true,
    })

    expect(strategy.primaryMode).toBe('MODE_1')
    expect(strategy.showAlternative).toBe(true)
    expect(strategy.alternativeMode).toBe('MODE_2')
  })

  it('should use Mode 2 with strong disclaimer for exploratory when only Mode 2', () => {
    const strategy = determineResponseStrategy({
      queryType: 'exploratory',
      mode1Available: false,
      mode2Available: true,
    })

    expect(strategy.primaryMode).toBe('MODE_2')
    expect(strategy.requireDisclaimer).toBe(true)
    expect(strategy.disclaimerStrength).toBe('strong')
  })

  it('should use Mode 1 for calculation queries', () => {
    const strategy = determineResponseStrategy({
      queryType: 'calculation',
      mode1Available: true,
      mode2Available: true,
    })

    expect(strategy.primaryMode).toBe('MODE_1')
    expect(strategy.allowMode2Inputs).toBe(false) // Never calculate from Mode 2
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/assistant/policy/__tests__/answer-policy.test.ts`
Expected: FAIL with "Cannot find module '../answer-policy'"

**Step 3: Implement answer policy**

```typescript
// src/lib/assistant/policy/answer-policy.ts
import { FactMode } from './mode-types'

/**
 * Answer policy for a specific mode.
 *
 * From design doc Section 4: Assistant Policy
 */
export interface AnswerPolicy {
  /** Tone of the response */
  tone: 'confident' | 'cautious'

  /** Whether to display confidence percentage */
  showConfidence: boolean

  /** Whether citation is required */
  requireCitation: boolean

  /** Whether legal reference is required */
  requireLegalReference: boolean

  /** Whether temporal context is required */
  requireTemporalContext: boolean

  /** Whether uncertainty disclaimer is required */
  requireDisclaimer: boolean

  /** Example phrases for this mode */
  examplePhrases: string[]
}

/**
 * Mode 1 Answer Policy:
 * - Confident, declarative tone
 * - High certainty: "The VAT rate is 25%"
 * - Citation required
 * - Legal reference required
 * - Temporal context required
 * - No confidence display (implied high)
 */
const MODE_1_POLICY: AnswerPolicy = {
  tone: 'confident',
  showConfidence: false,
  requireCitation: true,
  requireLegalReference: true,
  requireTemporalContext: true,
  requireDisclaimer: false,
  examplePhrases: [
    'iznosi',
    'je',
    'primjenjuje se',
    'vrijedi',
    'propisano je',
  ],
}

/**
 * Mode 2 Answer Policy:
 * - Cautious, hedged tone
 * - Low certainty: "According to preliminary analysis..."
 * - Citation required with uncertainty
 * - Legal reference if available
 * - Temporal context if available
 * - Confidence display required
 * - Disclaimer required
 */
const MODE_2_POLICY: AnswerPolicy = {
  tone: 'cautious',
  showConfidence: true,
  requireCitation: true,
  requireLegalReference: false, // Show if available
  requireTemporalContext: false, // Show if available
  requireDisclaimer: true,
  examplePhrases: [
    'prema preliminarnoj analizi',
    'čini se da',
    'moguće je da',
    'postoje naznake da',
    'uz određenu nesigurnost',
  ],
}

/**
 * Get the answer policy for a fact mode.
 */
export function getAnswerPolicy(mode: FactMode): AnswerPolicy {
  return mode === 'MODE_1' ? MODE_1_POLICY : MODE_2_POLICY
}

/**
 * Query type classification.
 */
export type QueryType = 'exact_fact' | 'exploratory' | 'calculation'

/**
 * Response strategy determination input.
 */
export interface StrategyInput {
  queryType: QueryType
  mode1Available: boolean
  mode2Available: boolean
}

/**
 * Response strategy output.
 */
export interface ResponseStrategy {
  /** Primary mode to use for response */
  primaryMode: FactMode | null

  /** Whether to show alternative mode info */
  showAlternative: boolean

  /** Alternative mode if showing */
  alternativeMode?: FactMode

  /** Whether disclaimer is required */
  requireDisclaimer: boolean

  /** Strength of disclaimer */
  disclaimerStrength?: 'standard' | 'strong'

  /** Whether Mode 2 inputs can be used for calculations */
  allowMode2Inputs: boolean

  /** Fallback response type when no data */
  fallbackResponse?: 'NO_DATA'
}

/**
 * Determine response strategy based on query type and data availability.
 *
 * Decision matrix from design doc:
 *
 * | Query Type        | Mode 1 | Mode 2 | Strategy                     |
 * |-------------------|--------|--------|------------------------------|
 * | Exact fact query  | Yes    | -      | Use Mode 1, confident        |
 * | Exact fact query  | No     | Yes    | Use Mode 2 with disclaimer   |
 * | Exact fact query  | No     | No     | "Nemam informacija o tome"   |
 * | Exploratory       | Yes    | Yes    | Mode 1 first, mention Mode 2 |
 * | Exploratory       | No     | Yes    | Mode 2 with strong disclaimer|
 * | Calculation       | Yes    | -      | Calculate from Mode 1        |
 */
export function determineResponseStrategy(input: StrategyInput): ResponseStrategy {
  const { queryType, mode1Available, mode2Available } = input

  // No data available
  if (!mode1Available && !mode2Available) {
    return {
      primaryMode: null,
      showAlternative: false,
      requireDisclaimer: false,
      allowMode2Inputs: false,
      fallbackResponse: 'NO_DATA',
    }
  }

  switch (queryType) {
    case 'exact_fact':
      if (mode1Available) {
        return {
          primaryMode: 'MODE_1',
          showAlternative: false,
          requireDisclaimer: false,
          allowMode2Inputs: false,
        }
      }
      return {
        primaryMode: 'MODE_2',
        showAlternative: false,
        requireDisclaimer: true,
        disclaimerStrength: 'standard',
        allowMode2Inputs: false,
      }

    case 'exploratory':
      if (mode1Available && mode2Available) {
        return {
          primaryMode: 'MODE_1',
          showAlternative: true,
          alternativeMode: 'MODE_2',
          requireDisclaimer: false,
          allowMode2Inputs: false,
        }
      }
      if (mode1Available) {
        return {
          primaryMode: 'MODE_1',
          showAlternative: false,
          requireDisclaimer: false,
          allowMode2Inputs: false,
        }
      }
      return {
        primaryMode: 'MODE_2',
        showAlternative: false,
        requireDisclaimer: true,
        disclaimerStrength: 'strong',
        allowMode2Inputs: false,
      }

    case 'calculation':
      // NEVER calculate from Mode 2 inputs
      if (mode1Available) {
        return {
          primaryMode: 'MODE_1',
          showAlternative: false,
          requireDisclaimer: false,
          allowMode2Inputs: false, // Explicitly false - propagates uncertainty
        }
      }
      // Can't calculate without Mode 1
      return {
        primaryMode: null,
        showAlternative: false,
        requireDisclaimer: false,
        allowMode2Inputs: false,
        fallbackResponse: 'NO_DATA',
      }

    default:
      return {
        primaryMode: mode1Available ? 'MODE_1' : 'MODE_2',
        showAlternative: false,
        requireDisclaimer: !mode1Available,
        allowMode2Inputs: false,
      }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/assistant/policy/__tests__/answer-policy.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/assistant/policy/
git commit -m "feat(assistant): implement answer policy rules per mode"
```

---

## Task 3: Response Formatter

**Files:**
- Create: `src/lib/assistant/policy/response-formatter.ts`
- Test: `src/lib/assistant/policy/__tests__/response-formatter.test.ts`

**Step 1: Write the failing test for response formatter**

```typescript
// src/lib/assistant/policy/__tests__/response-formatter.test.ts
import { describe, it, expect } from 'vitest'
import {
  formatMode1Response,
  formatMode2Response,
  formatNoDataResponse,
} from '../response-formatter'
import { Mode1Fact, Mode2Fact } from '../mode-types'

describe('formatMode1Response', () => {
  const mode1Fact: Mode1Fact = {
    id: 'rf-123',
    conceptSlug: 'pdv-standard-rate',
    value: '25',
    displayValue: '25%',
    confidence: 0.95,
    effectiveFrom: new Date('2013-01-01'),
    effectiveUntil: null,
    authority: 'LAW',
    legalReference: {
      law: 'Zakon o porezu na dodanu vrijednost (NN 73/13)',
      article: '38',
    },
    groundingQuotes: [
      { evidenceId: 'ev-1', exactQuote: 'Standardna stopa PDV-a iznosi 25%.' },
    ],
  }

  it('should format Mode 1 response with citation', () => {
    const response = formatMode1Response(mode1Fact, 'Kolika je stopa PDV-a?')

    expect(response.answer).toContain('25%')
    expect(response.citation).toBeDefined()
    expect(response.citation!.law).toContain('Zakon o porezu na dodanu vrijednost')
    expect(response.citation!.article).toBe('38')
    expect(response.effectiveFrom).toEqual(new Date('2013-01-01'))
    expect(response.disclaimer).toBeUndefined()
  })

  it('should include temporal context', () => {
    const response = formatMode1Response(mode1Fact, 'Stopa PDV-a?')

    expect(response.effectiveFrom).toBeDefined()
    expect(response.effectiveUntil).toBeNull() // Ongoing
  })
})

describe('formatMode2Response', () => {
  const mode2Fact: Mode2Fact = {
    id: 'cf-456',
    suggestedConceptSlug: 'new-e-invoice-deadline',
    suggestedDomain: 'rokovi',
    extractedValue: '2025-07-01',
    overallConfidence: 0.65,
    status: 'UNDER_REVIEW',
    temporalNotes: 'Date inferred from document context',
    legalReferenceRaw: 'Porezna uprava - Mišljenje',
    groundingQuotes: [
      { evidenceId: 'ev-2', exactQuote: 'implementacija e-računa od 1. srpnja 2025.' },
    ],
    extractorNotes: 'Extracted from draft announcement',
  }

  it('should format Mode 2 response with disclaimer', () => {
    const response = formatMode2Response(mode2Fact, 'Kada kreće e-račun?')

    expect(response.answer).toBeDefined()
    expect(response.disclaimer).toBeDefined()
    expect(response.disclaimer).toContain('NAPOMENA')
    expect(response.confidence).toBe(0.65)
    expect(response.confidenceDisplay).toContain('65%')
  })

  it('should include source uncertainty marker', () => {
    const response = formatMode2Response(mode2Fact, 'E-račun rokovi?')

    expect(response.sourceNote).toContain('neprovjerenog')
  })

  it('should show temporal uncertainty when notes present', () => {
    const response = formatMode2Response(mode2Fact, 'Rok?')

    expect(response.temporalNote).toContain('Date inferred')
  })
})

describe('formatNoDataResponse', () => {
  it('should return standard no-data message', () => {
    const response = formatNoDataResponse('Koja je stopa poreza na dobit?')

    expect(response.answer).toContain('Nemam informacija')
    expect(response.suggestion).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/assistant/policy/__tests__/response-formatter.test.ts`
Expected: FAIL with "Cannot find module '../response-formatter'"

**Step 3: Implement response formatter**

```typescript
// src/lib/assistant/policy/response-formatter.ts
import { Mode1Fact, Mode2Fact } from './mode-types'

/**
 * Formatted Mode 1 response.
 */
export interface Mode1Response {
  answer: string
  citation?: {
    law: string
    article?: string
    paragraph?: string
    officialUrl?: string
  }
  effectiveFrom: Date
  effectiveUntil: Date | null
  disclaimer?: undefined // Never has disclaimer
}

/**
 * Formatted Mode 2 response.
 */
export interface Mode2Response {
  answer: string
  disclaimer: string
  confidence: number
  confidenceDisplay: string
  sourceNote: string
  temporalNote?: string
  citation?: {
    rawReference: string
    verified: false
  }
}

/**
 * No-data response.
 */
export interface NoDataResponse {
  answer: string
  suggestion: string
}

/**
 * Format a Mode 1 (confident) response.
 *
 * Example output:
 * "Standardna stopa PDV-a iznosi 25%.
 *
 * **Izvor**: Zakon o porezu na dodanu vrijednost, čl. 38
 * **Vrijedi od**: 1. siječnja 2013."
 */
export function formatMode1Response(
  fact: Mode1Fact,
  _query: string
): Mode1Response {
  const answer = `${fact.displayValue}`

  return {
    answer,
    citation: {
      law: fact.legalReference.law,
      article: fact.legalReference.article,
      paragraph: fact.legalReference.paragraph,
      officialUrl: fact.legalReference.officialUrl,
    },
    effectiveFrom: fact.effectiveFrom,
    effectiveUntil: fact.effectiveUntil ?? null,
  }
}

/**
 * Format a Mode 2 (cautious) response.
 *
 * Example output:
 * "Prema preliminarnoj analizi naših izvora, čini se da postoje novi rokovi
 * za implementaciju e-računa za B2G transakcije.
 *
 * **VAŽNA NAPOMENA**: Ova informacija dolazi iz neprovjerenog izvora i
 * ima nisku pouzdanost (65%). Preporučam provjeru s Poreznom upravom
 * prije donošenja odluka.
 *
 * **Izvor**: Dokument u pregledu (nije službeno potvrđeno)
 * **Pouzdanost**: 65%"
 */
export function formatMode2Response(
  fact: Mode2Fact,
  _query: string
): Mode2Response {
  const confidencePercent = Math.round(fact.overallConfidence * 100)

  // Build answer with cautious phrasing
  let answer = 'Prema preliminarnoj analizi naših izvora, '
  if (fact.extractedValue) {
    answer += `čini se da vrijednost iznosi ${fact.extractedValue}.`
  } else {
    answer += 'pronašao sam relevantne informacije.'
  }

  // Build disclaimer
  const disclaimer = `**VAŽNA NAPOMENA**: Ova informacija dolazi iz neprovjerenog izvora i ima nisku pouzdanost (${confidencePercent}%). Preporučam provjeru s Poreznom upravom prije donošenja odluka.`

  // Source note
  const sourceNote = fact.legalReferenceRaw
    ? `Dokument: ${fact.legalReferenceRaw} (iz neprovjerenog izvora)`
    : 'Izvor: Dokument u pregledu (nije službeno potvrđeno)'

  // Temporal note if uncertain
  const temporalNote = fact.temporalNotes || undefined

  return {
    answer,
    disclaimer,
    confidence: fact.overallConfidence,
    confidenceDisplay: `${confidencePercent}%`,
    sourceNote,
    temporalNote,
    citation: fact.legalReferenceRaw
      ? { rawReference: fact.legalReferenceRaw, verified: false }
      : undefined,
  }
}

/**
 * Format a no-data response.
 */
export function formatNoDataResponse(query: string): NoDataResponse {
  return {
    answer: 'Nemam informacija o tome u mojoj bazi znanja.',
    suggestion: `Preporučam da provjerite s Poreznom upravom ili konzultirate poreznog savjetnika za pitanje: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`,
  }
}

/**
 * Build full response text with all components.
 */
export function buildMode1ResponseText(response: Mode1Response): string {
  let text = response.answer

  if (response.citation) {
    text += `\n\n**Izvor**: ${response.citation.law}`
    if (response.citation.article) {
      text += `, čl. ${response.citation.article}`
    }
    if (response.citation.paragraph) {
      text += `, st. ${response.citation.paragraph}`
    }
  }

  text += `\n**Vrijedi od**: ${formatDate(response.effectiveFrom)}`
  if (response.effectiveUntil) {
    text += `\n**Vrijedi do**: ${formatDate(response.effectiveUntil)}`
  }

  return text
}

/**
 * Build full response text for Mode 2.
 */
export function buildMode2ResponseText(response: Mode2Response): string {
  let text = response.answer

  text += `\n\n${response.disclaimer}`
  text += `\n\n**Izvor**: ${response.sourceNote}`
  text += `\n**Pouzdanost**: ${response.confidenceDisplay}`

  if (response.temporalNote) {
    text += `\n**Napomena o datumu**: ${response.temporalNote}`
  }

  return text
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/assistant/policy/__tests__/response-formatter.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/assistant/policy/
git commit -m "feat(assistant): implement response formatter for Mode 1/2"
```

---

## Task 4: Prohibited Behaviors Validator

**Files:**
- Create: `src/lib/assistant/policy/behavior-validator.ts`
- Test: `src/lib/assistant/policy/__tests__/behavior-validator.test.ts`

**Step 1: Write the failing test for behavior validation**

```typescript
// src/lib/assistant/policy/__tests__/behavior-validator.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateResponseBehavior,
  BehaviorViolation,
} from '../behavior-validator'

describe('validateResponseBehavior', () => {
  it('should pass valid Mode 1 only response', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_1'],
      hasDisclaimer: false,
      isCalculation: false,
      calculationInputModes: [],
    })

    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('should detect missing disclaimer for Mode 2', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_2'],
      hasDisclaimer: false,
      isCalculation: false,
      calculationInputModes: [],
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContain('MISSING_MODE2_DISCLAIMER')
  })

  it('should detect mixed modes in same claim', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_1', 'MODE_2'],
      mixedInSameClaim: true,
      hasDisclaimer: true,
      isCalculation: false,
      calculationInputModes: [],
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContain('MIXED_MODES_SAME_CLAIM')
  })

  it('should detect calculation from Mode 2 inputs', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_2'],
      hasDisclaimer: true,
      isCalculation: true,
      calculationInputModes: ['MODE_2'],
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContain('CALCULATION_FROM_MODE2')
  })

  it('should allow calculation from Mode 1 inputs only', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_1'],
      hasDisclaimer: false,
      isCalculation: true,
      calculationInputModes: ['MODE_1'],
    })

    expect(result.valid).toBe(true)
  })

  it('should detect stating Mode 2 as fact', () => {
    const result = validateResponseBehavior({
      modes: ['MODE_2'],
      hasDisclaimer: false, // Missing disclaimer
      usesConfidentTone: true, // Using confident tone
      isCalculation: false,
      calculationInputModes: [],
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContain('MODE2_STATED_AS_FACT')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/assistant/policy/__tests__/behavior-validator.test.ts`
Expected: FAIL with "Cannot find module '../behavior-validator'"

**Step 3: Implement behavior validator**

```typescript
// src/lib/assistant/policy/behavior-validator.ts
import { FactMode } from './mode-types'

/**
 * Prohibited behavior types from design doc.
 */
export type BehaviorViolation =
  | 'MIXED_MODES_SAME_CLAIM'   // Mixing Mode 1 and Mode 2 in same claim
  | 'MISSING_MODE2_DISCLAIMER' // Omitting disclaimer for Mode 2
  | 'MODE2_STATED_AS_FACT'     // Stating Mode 2 as fact
  | 'CALCULATION_FROM_MODE2'   // Calculating from Mode 2 inputs
  | 'IGNORING_TEMPORAL'        // Ignoring temporal validity

/**
 * Input for behavior validation.
 */
export interface BehaviorValidationInput {
  /** Modes used in the response */
  modes: FactMode[]

  /** Whether modes are mixed in the same claim (not just same response) */
  mixedInSameClaim?: boolean

  /** Whether response has a disclaimer */
  hasDisclaimer: boolean

  /** Whether response uses confident/declarative tone */
  usesConfidentTone?: boolean

  /** Whether this is a calculation response */
  isCalculation: boolean

  /** Modes of inputs used in calculation */
  calculationInputModes: FactMode[]

  /** Whether temporal context is included */
  includesTemporalContext?: boolean
}

/**
 * Result of behavior validation.
 */
export interface BehaviorValidationResult {
  valid: boolean
  violations: BehaviorViolation[]
  explanations: Record<BehaviorViolation, string>
}

/**
 * Validate response against prohibited behaviors.
 *
 * Prohibited behaviors from design doc:
 * 1. Mixing Mode 1 and Mode 2 in same claim - confuses certainty
 * 2. Omitting disclaimer for Mode 2 - user assumes high confidence
 * 3. Stating Mode 2 as fact - violates truth integrity
 * 4. Calculating from Mode 2 inputs - propagates uncertainty
 * 5. Ignoring temporal validity - may provide outdated info
 */
export function validateResponseBehavior(
  input: BehaviorValidationInput
): BehaviorValidationResult {
  const violations: BehaviorViolation[] = []
  const explanations: Record<BehaviorViolation, string> = {} as any

  const hasMode2 = input.modes.includes('MODE_2')
  const hasMode1 = input.modes.includes('MODE_1')

  // Check: Mixed modes in same claim
  if (hasMode1 && hasMode2 && input.mixedInSameClaim) {
    violations.push('MIXED_MODES_SAME_CLAIM')
    explanations['MIXED_MODES_SAME_CLAIM'] =
      'Mode 1 and Mode 2 facts cannot be mixed in the same claim. This confuses certainty levels for the user.'
  }

  // Check: Missing disclaimer for Mode 2
  if (hasMode2 && !input.hasDisclaimer) {
    violations.push('MISSING_MODE2_DISCLAIMER')
    explanations['MISSING_MODE2_DISCLAIMER'] =
      'Mode 2 responses must include a disclaimer. Users will otherwise assume high confidence.'
  }

  // Check: Mode 2 stated as fact (no disclaimer + confident tone)
  if (hasMode2 && !input.hasDisclaimer && input.usesConfidentTone) {
    violations.push('MODE2_STATED_AS_FACT')
    explanations['MODE2_STATED_AS_FACT'] =
      'Mode 2 content cannot be stated as fact. This violates truth integrity.'
  }

  // Check: Calculation from Mode 2
  if (input.isCalculation && input.calculationInputModes.includes('MODE_2')) {
    violations.push('CALCULATION_FROM_MODE2')
    explanations['CALCULATION_FROM_MODE2'] =
      'Calculations cannot use Mode 2 inputs. This propagates uncertainty into the result.'
  }

  // Check: Ignoring temporal validity (only if Mode 1 and no temporal context)
  if (hasMode1 && !hasMode2 && input.includesTemporalContext === false) {
    violations.push('IGNORING_TEMPORAL')
    explanations['IGNORING_TEMPORAL'] =
      'Mode 1 responses must include temporal context. Omitting this may provide outdated information.'
  }

  return {
    valid: violations.length === 0,
    violations,
    explanations,
  }
}

/**
 * Get human-readable explanation for a violation.
 */
export function getViolationExplanation(violation: BehaviorViolation): string {
  const explanations: Record<BehaviorViolation, string> = {
    MIXED_MODES_SAME_CLAIM:
      'Ne možete miješati provjerene (Mode 1) i neprovjerene (Mode 2) informacije u istoj tvrdnji.',
    MISSING_MODE2_DISCLAIMER:
      'Neprovjerene informacije moraju imati jasno označeno upozorenje.',
    MODE2_STATED_AS_FACT:
      'Neprovjerene informacije ne smiju se predstavljati kao činjenice.',
    CALCULATION_FROM_MODE2:
      'Izračuni se ne mogu temeljiti na neprovjerenim podacima.',
    IGNORING_TEMPORAL:
      'Mora se navesti od kada vrijedi propis.',
  }
  return explanations[violation]
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/assistant/policy/__tests__/behavior-validator.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/assistant/policy/
git commit -m "feat(assistant): implement prohibited behavior validator"
```

---

## Task 5: Policy Module Exports

**Files:**
- Create: `src/lib/assistant/policy/index.ts`

**Step 1: Write the failing test for exports**

```typescript
// src/lib/assistant/policy/__tests__/exports.test.ts
import { describe, it, expect } from 'vitest'

describe('policy module exports', () => {
  it('should export all policy functions and types', async () => {
    const policy = await import('../index')

    // Mode types
    expect(policy.classifyFactMode).toBeDefined()
    expect(policy.isMode1Fact).toBeDefined()
    expect(policy.isMode2Fact).toBeDefined()

    // Answer policy
    expect(policy.getAnswerPolicy).toBeDefined()
    expect(policy.determineResponseStrategy).toBeDefined()

    // Response formatter
    expect(policy.formatMode1Response).toBeDefined()
    expect(policy.formatMode2Response).toBeDefined()
    expect(policy.formatNoDataResponse).toBeDefined()
    expect(policy.buildMode1ResponseText).toBeDefined()
    expect(policy.buildMode2ResponseText).toBeDefined()

    // Behavior validator
    expect(policy.validateResponseBehavior).toBeDefined()
    expect(policy.getViolationExplanation).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/assistant/policy/__tests__/exports.test.ts`
Expected: FAIL with "Cannot find module '../index'"

**Step 3: Create policy index**

```typescript
// src/lib/assistant/policy/index.ts

// Mode types
export {
  classifyFactMode,
  isMode1Fact,
  isMode2Fact,
  type FactMode,
  type FactWithMode,
  type Mode1Fact,
  type Mode2Fact,
} from './mode-types'

// Answer policy
export {
  getAnswerPolicy,
  determineResponseStrategy,
  type AnswerPolicy,
  type QueryType,
  type StrategyInput,
  type ResponseStrategy,
} from './answer-policy'

// Response formatter
export {
  formatMode1Response,
  formatMode2Response,
  formatNoDataResponse,
  buildMode1ResponseText,
  buildMode2ResponseText,
  type Mode1Response,
  type Mode2Response,
  type NoDataResponse,
} from './response-formatter'

// Behavior validator
export {
  validateResponseBehavior,
  getViolationExplanation,
  type BehaviorViolation,
  type BehaviorValidationInput,
  type BehaviorValidationResult,
} from './behavior-validator'
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/assistant/policy/__tests__/exports.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/policy/
git commit -m "feat(assistant): add policy module exports"
```

---

## Summary

Phase 1E implements:

1. **Mode Classification Types** - FactMode, Mode1Fact, Mode2Fact with type guards
2. **Answer Policy Rules** - Tone, citations, disclaimers per mode
3. **Response Formatter** - Mode-appropriate response templates
4. **Behavior Validator** - Enforces prohibited behaviors
5. **Module Exports** - Clean public API

Key policies enforced:

| Mode    | Tone      | Confidence | Citation | Disclaimer |
|---------|-----------|------------|----------|------------|
| MODE_1  | Confident | Hidden     | Required | None       |
| MODE_2  | Cautious  | Shown      | Required | Required   |

Prohibited behaviors prevented:
- Mixing modes in same claim
- Missing Mode 2 disclaimer
- Stating Mode 2 as fact
- Calculating from Mode 2 inputs
- Ignoring temporal validity
