# Phase 1A: Database Schema & Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add RuleFact and CandidateFact models with all required enums and types to support Mode 1/Mode 2 architecture.

**Architecture:** Extend existing Prisma schema with new models that coexist with RegulatoryRule during migration. RuleFact is the strict Mode 1 envelope; CandidateFact captures Mode 2 exploratory signals. Both link to existing Evidence via soft references.

**Tech Stack:** Prisma 7, PostgreSQL, Zod schemas, TypeScript

**Prerequisites:**
- Read: `docs/design/PHASE_1_CANONICAL_AND_EXPLORATORY_DESIGN.md` (Sections 2-3)
- Read: `prisma/schema.prisma` (existing RegulatoryRule, SourcePointer models)

---

## Task 1: Add New Enums to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma` (after existing enums ~line 200)

**Step 1: Write test for enum existence**

Create: `src/lib/regulatory-truth/__tests__/schema-enums.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  SubjectType,
  ObjectType,
  ValueType,
  MatchType,
  CandidateStatus,
} from '@prisma/client'

describe('Phase 1 Schema Enums', () => {
  it('SubjectType has all required values', () => {
    expect(SubjectType.PDV_OBVEZNIK).toBe('PDV_OBVEZNIK')
    expect(SubjectType.POREZNI_OBVEZNIK).toBe('POREZNI_OBVEZNIK')
    expect(SubjectType.OBRTNIK).toBe('OBRTNIK')
    expect(SubjectType.PRAVNA_OSOBA).toBe('PRAVNA_OSOBA')
    expect(SubjectType.FIZICKA_OSOBA).toBe('FIZICKA_OSOBA')
    expect(SubjectType.POSLODAVAC).toBe('POSLODAVAC')
    expect(SubjectType.OSIGURANIK).toBe('OSIGURANIK')
    expect(SubjectType.OBVEZNIK_FISKALIZACIJE).toBe('OBVEZNIK_FISKALIZACIJE')
  })

  it('ObjectType has all required values', () => {
    expect(ObjectType.POREZNA_STOPA).toBe('POREZNA_STOPA')
    expect(ObjectType.PRAG_PRIHODA).toBe('PRAG_PRIHODA')
    expect(ObjectType.OSNOVICA).toBe('OSNOVICA')
    expect(ObjectType.ROK).toBe('ROK')
    expect(ObjectType.OBVEZA).toBe('OBVEZA')
    expect(ObjectType.IZNOS).toBe('IZNOS')
    expect(ObjectType.POSTOTAK).toBe('POSTOTAK')
  })

  it('ValueType has all required values', () => {
    expect(ValueType.PERCENTAGE).toBe('PERCENTAGE')
    expect(ValueType.CURRENCY_EUR).toBe('CURRENCY_EUR')
    expect(ValueType.CURRENCY_HRK).toBe('CURRENCY_HRK')
    expect(ValueType.DEADLINE_DAY).toBe('DEADLINE_DAY')
    expect(ValueType.DEADLINE_DESCRIPTION).toBe('DEADLINE_DESCRIPTION')
    expect(ValueType.BOOLEAN).toBe('BOOLEAN')
    expect(ValueType.COUNT).toBe('COUNT')
  })

  it('MatchType has all required values', () => {
    expect(MatchType.EXACT).toBe('EXACT')
    expect(MatchType.NORMALIZED).toBe('NORMALIZED')
  })

  it('CandidateStatus has all required values', () => {
    expect(CandidateStatus.CAPTURED).toBe('CAPTURED')
    expect(CandidateStatus.UNDER_REVIEW).toBe('UNDER_REVIEW')
    expect(CandidateStatus.NEEDS_EVIDENCE).toBe('NEEDS_EVIDENCE')
    expect(CandidateStatus.PROMOTABLE).toBe('PROMOTABLE')
    expect(CandidateStatus.REJECTED).toBe('REJECTED')
    expect(CandidateStatus.PROMOTED).toBe('PROMOTED')
    expect(CandidateStatus.ARCHIVED).toBe('ARCHIVED')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/__tests__/schema-enums.test.ts`
Expected: FAIL with "Cannot find module" or enum value errors

**Step 3: Add enums to Prisma schema**

Add to `prisma/schema.prisma` after existing enums:

```prisma
// === Phase 1: Mode 1/Mode 2 Enums ===

enum SubjectType {
  PDV_OBVEZNIK           // VAT-registered entity
  POREZNI_OBVEZNIK       // Any taxpayer
  OBRTNIK                // Sole proprietor
  PRAVNA_OSOBA           // Legal entity (d.o.o., d.d., etc.)
  FIZICKA_OSOBA          // Natural person
  POSLODAVAC             // Employer
  OSIGURANIK             // Insured person
  OBVEZNIK_FISKALIZACIJE // Entity subject to fiscalization
}

enum ObjectType {
  POREZNA_STOPA  // Tax rate
  PRAG_PRIHODA   // Revenue threshold
  OSNOVICA       // Tax/contribution base
  ROK            // Deadline
  OBVEZA         // Obligation (boolean)
  IZNOS          // Amount
  POSTOTAK       // Percentage
}

enum ValueType {
  PERCENTAGE           // e.g., 25 (means 25%)
  CURRENCY_EUR         // e.g., 40000 (means 40,000 EUR)
  CURRENCY_HRK         // Legacy, converted to EUR
  DEADLINE_DAY         // e.g., 20 (means 20th day of month)
  DEADLINE_DESCRIPTION // e.g., "15 dana od isplate"
  BOOLEAN              // true/false
  COUNT                // Integer count
}

enum MatchType {
  EXACT      // Quote found byte-for-byte
  NORMALIZED // Quote found after whitespace/diacritic normalization
}

enum CandidateStatus {
  CAPTURED       // Initial extraction, awaiting review
  UNDER_REVIEW   // Human is reviewing
  NEEDS_EVIDENCE // Grounding insufficient, needs more sources
  PROMOTABLE     // Ready for Mode 1 promotion
  REJECTED       // Not valid regulatory content
  PROMOTED       // Successfully promoted to Mode 1
  ARCHIVED       // No longer relevant
}
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`
Expected: Success with no errors

**Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/__tests__/schema-enums.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/regulatory-truth/__tests__/schema-enums.test.ts
git commit -m "feat(schema): add Phase 1 enums for Mode 1/Mode 2 architecture"
```

---

## Task 2: Create GroundingQuote Embedded Type

**Files:**
- Create: `src/lib/regulatory-truth/types/grounding-quote.ts`
- Create: `src/lib/regulatory-truth/types/__tests__/grounding-quote.test.ts`

**Step 1: Write test for GroundingQuote schema**

Create: `src/lib/regulatory-truth/types/__tests__/grounding-quote.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  GroundingQuoteSchema,
  type GroundingQuote,
} from '../grounding-quote'

describe('GroundingQuote', () => {
  it('validates complete grounding quote', () => {
    const quote: GroundingQuote = {
      evidenceId: 'clx123abc',
      exactQuote: 'Stopa poreza na dodanu vrijednost iznosi 25%',
      quoteLocation: {
        startOffset: 1234,
        endOffset: 1280,
      },
      matchType: 'EXACT',
    }

    const result = GroundingQuoteSchema.safeParse(quote)
    expect(result.success).toBe(true)
  })

  it('rejects empty exactQuote', () => {
    const quote = {
      evidenceId: 'clx123abc',
      exactQuote: '',
      quoteLocation: { startOffset: 0, endOffset: 0 },
      matchType: 'EXACT',
    }

    const result = GroundingQuoteSchema.safeParse(quote)
    expect(result.success).toBe(false)
  })

  it('rejects missing evidenceId', () => {
    const quote = {
      exactQuote: 'Some quote',
      quoteLocation: { startOffset: 0, endOffset: 10 },
      matchType: 'EXACT',
    }

    const result = GroundingQuoteSchema.safeParse(quote)
    expect(result.success).toBe(false)
  })

  it('validates NORMALIZED matchType', () => {
    const quote = {
      evidenceId: 'clx123abc',
      exactQuote: 'Some normalized quote',
      quoteLocation: { startOffset: 100, endOffset: 121 },
      matchType: 'NORMALIZED',
    }

    const result = GroundingQuoteSchema.safeParse(quote)
    expect(result.success).toBe(true)
  })

  it('rejects invalid matchType', () => {
    const quote = {
      evidenceId: 'clx123abc',
      exactQuote: 'Some quote',
      quoteLocation: { startOffset: 0, endOffset: 10 },
      matchType: 'FUZZY',
    }

    const result = GroundingQuoteSchema.safeParse(quote)
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/grounding-quote.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement GroundingQuote schema**

Create: `src/lib/regulatory-truth/types/grounding-quote.ts`

```typescript
import { z } from 'zod'

export const QuoteLocationSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
})

export const GroundingQuoteSchema = z.object({
  evidenceId: z.string().min(1),
  exactQuote: z.string().min(1),
  quoteLocation: QuoteLocationSchema,
  matchType: z.enum(['EXACT', 'NORMALIZED']),
})

export type QuoteLocation = z.infer<typeof QuoteLocationSchema>
export type GroundingQuote = z.infer<typeof GroundingQuoteSchema>

// For Mode 2 CandidateFacts - relaxed validation
export const CandidateGroundingQuoteSchema = z.object({
  evidenceId: z.string().min(1),
  exactQuote: z.string().min(1),
  quoteLocation: QuoteLocationSchema.optional(),
  matchType: z.enum(['EXACT', 'NORMALIZED']).nullable(),
})

export type CandidateGroundingQuote = z.infer<typeof CandidateGroundingQuoteSchema>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/grounding-quote.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/types/
git commit -m "feat(types): add GroundingQuote schema for Mode 1/Mode 2"
```

---

## Task 3: Create RuleFact Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/regulatory-truth/types/rule-fact.ts`
- Create: `src/lib/regulatory-truth/types/__tests__/rule-fact.test.ts`

**Step 1: Write test for RuleFact Zod schema**

Create: `src/lib/regulatory-truth/types/__tests__/rule-fact.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { RuleFactSchema, type RuleFact } from '../rule-fact'

describe('RuleFact Schema', () => {
  const validRuleFact: RuleFact = {
    id: 'clx123abc',
    conceptSlug: 'pdv-standard-rate',
    subject: {
      type: 'PDV_OBVEZNIK',
      description: 'PDV obveznik',
    },
    object: {
      type: 'POREZNA_STOPA',
      description: 'Standardna stopa PDV-a',
    },
    conditions: { always: true },
    value: '25',
    valueType: 'PERCENTAGE',
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
        evidenceId: 'clx456def',
        exactQuote: 'Stopa poreza na dodanu vrijednost iznosi 25%',
        quoteLocation: { startOffset: 1234, endOffset: 1280 },
        matchType: 'EXACT',
      },
    ],
    riskTier: 'T0',
    confidence: 0.95,
    status: 'PUBLISHED',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('validates complete RuleFact', () => {
    const result = RuleFactSchema.safeParse(validRuleFact)
    expect(result.success).toBe(true)
  })

  it('rejects RuleFact without grounding quotes', () => {
    const invalid = { ...validRuleFact, groundingQuotes: [] }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 1')
    }
  })

  it('rejects RuleFact with confidence below 0.90', () => {
    const invalid = { ...validRuleFact, confidence: 0.85 }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects RuleFact without effectiveFrom', () => {
    const invalid = { ...validRuleFact, effectiveFrom: null }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects effectiveUntil as string "unknown"', () => {
    const invalid = { ...validRuleFact, effectiveUntil: 'unknown' as any }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts null effectiveUntil (ongoing)', () => {
    const valid = { ...validRuleFact, effectiveUntil: null }
    const result = RuleFactSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects missing legalReference.law', () => {
    const invalid = {
      ...validRuleFact,
      legalReference: { article: '38' },
    }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid conceptSlug format', () => {
    const invalid = { ...validRuleFact, conceptSlug: 'INVALID SLUG' }
    const result = RuleFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/rule-fact.test.ts`
Expected: FAIL

**Step 3: Implement RuleFact schema**

Create: `src/lib/regulatory-truth/types/rule-fact.ts`

```typescript
import { z } from 'zod'
import { GroundingQuoteSchema } from './grounding-quote'

// Concept slug must be kebab-case
const ConceptSlugSchema = z.string().regex(
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  'Concept slug must be kebab-case (e.g., pdv-standard-rate)'
)

const SubjectSchema = z.object({
  type: z.enum([
    'PDV_OBVEZNIK',
    'POREZNI_OBVEZNIK',
    'OBRTNIK',
    'PRAVNA_OSOBA',
    'FIZICKA_OSOBA',
    'POSLODAVAC',
    'OSIGURANIK',
    'OBVEZNIK_FISKALIZACIJE',
  ]),
  description: z.string().min(1),
  constraints: z.record(z.unknown()).optional(),
})

const ObjectSchema = z.object({
  type: z.enum([
    'POREZNA_STOPA',
    'PRAG_PRIHODA',
    'OSNOVICA',
    'ROK',
    'OBVEZA',
    'IZNOS',
    'POSTOTAK',
  ]),
  description: z.string().min(1),
  constraints: z.record(z.unknown()).optional(),
})

const LegalReferenceSchema = z.object({
  law: z.string().min(1),
  article: z.string().optional(),
  paragraph: z.string().optional(),
  officialUrl: z.string().url().optional(),
})

export const RuleFactSchema = z.object({
  id: z.string(),
  conceptSlug: ConceptSlugSchema,

  // Applicability
  subject: SubjectSchema,
  object: ObjectSchema,
  conditions: z.record(z.unknown()),

  // Value
  value: z.string(),
  valueType: z.enum([
    'PERCENTAGE',
    'CURRENCY_EUR',
    'CURRENCY_HRK',
    'DEADLINE_DAY',
    'DEADLINE_DESCRIPTION',
    'BOOLEAN',
    'COUNT',
  ]),
  displayValue: z.string().min(1),

  // Temporal validity
  effectiveFrom: z.date(),
  effectiveUntil: z.date().nullable(),

  // Authority
  authority: z.enum(['LAW', 'GUIDANCE', 'PROCEDURE', 'PRACTICE']),
  legalReference: LegalReferenceSchema,

  // Grounding (MANDATORY)
  groundingQuotes: z.array(GroundingQuoteSchema).min(1, 'RuleFact must have at least 1 grounding quote'),

  // Metadata
  riskTier: z.enum(['T0', 'T1', 'T2', 'T3']),
  confidence: z.number().min(0.90, 'Mode 1 facts require confidence >= 0.90').max(1),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'DEPRECATED', 'REJECTED']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type RuleFact = z.infer<typeof RuleFactSchema>
export type RuleFactSubject = z.infer<typeof SubjectSchema>
export type RuleFactObject = z.infer<typeof ObjectSchema>
export type LegalReference = z.infer<typeof LegalReferenceSchema>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/rule-fact.test.ts`
Expected: PASS

**Step 5: Add RuleFact model to Prisma schema**

Add to `prisma/schema.prisma`:

```prisma
// === Phase 1: RuleFact (Mode 1) ===

model RuleFact {
  id            String    @id @default(cuid())
  conceptSlug   String    // Must be from Canonical Registry
  conceptId     String?   // FK to Concept

  // Applicability
  subjectType        SubjectType
  subjectDescription String
  subjectConstraints Json?
  objectType         ObjectType
  objectDescription  String
  objectConstraints  Json?
  conditions         Json      @default("{\"always\": true}")

  // Value
  value        String
  valueType    ValueType
  displayValue String

  // Temporal validity
  effectiveFrom  DateTime
  effectiveUntil DateTime?  // null = ongoing

  // Authority
  authority      AuthorityLevel
  legalReference Json       // { law, article?, paragraph?, officialUrl? }

  // Grounding (stored as JSON array)
  groundingQuotes Json      // Array of GroundingQuote

  // Metadata
  riskTier   RiskTier
  confidence Float        @default(0.90)
  status     RuleStatus   @default(DRAFT)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  concept Concept? @relation(fields: [conceptId], references: [id])

  // Indexes
  @@unique([conceptSlug, effectiveFrom, status])
  @@index([conceptSlug])
  @@index([status])
  @@index([effectiveFrom, effectiveUntil])
}
```

**Step 6: Generate Prisma client and create migration**

Run: `npx prisma migrate dev --name add_rule_fact_model`
Expected: Migration created successfully

**Step 7: Commit**

```bash
git add prisma/ src/lib/regulatory-truth/types/
git commit -m "feat(schema): add RuleFact model for Mode 1 facts"
```

---

## Task 4: Create CandidateFact Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/regulatory-truth/types/candidate-fact.ts`
- Create: `src/lib/regulatory-truth/types/__tests__/candidate-fact.test.ts`

**Step 1: Write test for CandidateFact schema**

Create: `src/lib/regulatory-truth/types/__tests__/candidate-fact.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { CandidateFactSchema, type CandidateFact } from '../candidate-fact'

describe('CandidateFact Schema', () => {
  const validCandidateFact: CandidateFact = {
    id: 'clx789ghi',
    suggestedConceptSlug: 'e-racuni-b2g-deadline',
    suggestedDomain: 'e-racuni',
    subject: {
      description: 'Obveznik e-racuna',
      confidence: 0.75,
    },
    object: {
      description: 'Rok za implementaciju',
      confidence: 0.70,
    },
    conditions: 'Za B2G transakcije',
    conditionsConfidence: 0.65,
    extractedValue: '2025-07-01',
    suggestedValueType: 'date',
    valueConfidence: 0.80,
    effectiveFrom: null,
    effectiveUntil: null,
    temporalConfidence: 0.50,
    temporalNotes: 'Datum implementacije nije jasno naveden',
    suggestedAuthority: 'GUIDANCE',
    legalReferenceRaw: 'Pravilnik o e-racunima',
    groundingQuotes: [
      {
        evidenceId: 'clx456def',
        exactQuote: 'E-racuni za B2G trebaju biti implementirani do sredine 2025.',
        quoteLocation: null,
        matchType: null,
      },
    ],
    status: 'CAPTURED',
    overallConfidence: 0.65,
    extractorNotes: 'Extracted from draft document',
    reviewNotes: null,
    createdAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    suggestedPillar: 'E-Racuni',
    promotionCandidate: false,
  }

  it('validates complete CandidateFact', () => {
    const result = CandidateFactSchema.safeParse(validCandidateFact)
    expect(result.success).toBe(true)
  })

  it('allows low confidence (below 0.90)', () => {
    const lowConfidence = { ...validCandidateFact, overallConfidence: 0.45 }
    const result = CandidateFactSchema.safeParse(lowConfidence)
    expect(result.success).toBe(true)
  })

  it('allows missing effectiveFrom with temporalNotes', () => {
    const missing = {
      ...validCandidateFact,
      effectiveFrom: null,
      temporalNotes: 'Date not specified in source',
    }
    const result = CandidateFactSchema.safeParse(missing)
    expect(result.success).toBe(true)
  })

  it('allows null matchType in grounding quotes', () => {
    const result = CandidateFactSchema.safeParse(validCandidateFact)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.groundingQuotes[0].matchType).toBeNull()
    }
  })

  it('still requires at least one grounding quote', () => {
    const invalid = { ...validCandidateFact, groundingQuotes: [] }
    const result = CandidateFactSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates all CandidateStatus values', () => {
    const statuses = [
      'CAPTURED', 'UNDER_REVIEW', 'NEEDS_EVIDENCE',
      'PROMOTABLE', 'REJECTED', 'PROMOTED', 'ARCHIVED'
    ] as const

    for (const status of statuses) {
      const fact = { ...validCandidateFact, status }
      const result = CandidateFactSchema.safeParse(fact)
      expect(result.success).toBe(true)
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/candidate-fact.test.ts`
Expected: FAIL

**Step 3: Implement CandidateFact schema**

Create: `src/lib/regulatory-truth/types/candidate-fact.ts`

```typescript
import { z } from 'zod'
import { CandidateGroundingQuoteSchema } from './grounding-quote'

const CandidateSubjectSchema = z.object({
  description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

const CandidateObjectSchema = z.object({
  description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export const CandidateFactSchema = z.object({
  id: z.string(),
  suggestedConceptSlug: z.string().nullable(),
  suggestedDomain: z.string().nullable(),

  // Applicability (partial)
  subject: CandidateSubjectSchema,
  object: CandidateObjectSchema,
  conditions: z.string().nullable(),
  conditionsConfidence: z.number().min(0).max(1),

  // Value
  extractedValue: z.string().nullable(),
  suggestedValueType: z.string().nullable(),
  valueConfidence: z.number().min(0).max(1),

  // Temporal (partial)
  effectiveFrom: z.date().nullable(),
  effectiveUntil: z.date().nullable(),
  temporalConfidence: z.number().min(0).max(1),
  temporalNotes: z.string().nullable(),

  // Authority (partial)
  suggestedAuthority: z.string().nullable(),
  legalReferenceRaw: z.string().nullable(),

  // Grounding (still mandatory)
  groundingQuotes: z.array(CandidateGroundingQuoteSchema).min(1, 'CandidateFact must have at least 1 grounding quote'),

  // Metadata
  status: z.enum([
    'CAPTURED',
    'UNDER_REVIEW',
    'NEEDS_EVIDENCE',
    'PROMOTABLE',
    'REJECTED',
    'PROMOTED',
    'ARCHIVED',
  ]),
  overallConfidence: z.number().min(0).max(1),
  extractorNotes: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  createdAt: z.date(),
  reviewedAt: z.date().nullable(),
  reviewedBy: z.string().nullable(),

  // Suggestion
  suggestedPillar: z.string().nullable(),
  promotionCandidate: z.boolean(),
})

export type CandidateFact = z.infer<typeof CandidateFactSchema>
export type CandidateSubject = z.infer<typeof CandidateSubjectSchema>
export type CandidateObject = z.infer<typeof CandidateObjectSchema>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/types/__tests__/candidate-fact.test.ts`
Expected: PASS

**Step 5: Add CandidateFact model to Prisma schema**

Add to `prisma/schema.prisma`:

```prisma
// === Phase 1: CandidateFact (Mode 2) ===

model CandidateFact {
  id                   String    @id @default(cuid())
  suggestedConceptSlug String?
  suggestedDomain      String?

  // Applicability (partial)
  subjectDescription     String?
  subjectConfidence      Float     @default(0)
  objectDescription      String?
  objectConfidence       Float     @default(0)
  conditions             String?   @db.Text
  conditionsConfidence   Float     @default(0)

  // Value
  extractedValue     String?
  suggestedValueType String?
  valueConfidence    Float     @default(0)

  // Temporal (partial)
  effectiveFrom      DateTime?
  effectiveUntil     DateTime?
  temporalConfidence Float     @default(0)
  temporalNotes      String?   @db.Text

  // Authority (partial)
  suggestedAuthority String?
  legalReferenceRaw  String?   @db.Text

  // Grounding (mandatory JSON array)
  groundingQuotes Json

  // Metadata
  status            CandidateStatus @default(CAPTURED)
  overallConfidence Float           @default(0)
  extractorNotes    String?         @db.Text
  reviewNotes       String?         @db.Text
  createdAt         DateTime        @default(now())
  reviewedAt        DateTime?
  reviewedBy        String?

  // Suggestion
  suggestedPillar    String?
  promotionCandidate Boolean @default(false)

  // If promoted, link to resulting RuleFact
  promotedToRuleFactId String?

  // Indexes
  @@index([status])
  @@index([suggestedDomain])
  @@index([promotionCandidate])
  @@index([overallConfidence])
}
```

**Step 6: Generate Prisma client and create migration**

Run: `npx prisma migrate dev --name add_candidate_fact_model`
Expected: Migration created successfully

**Step 7: Commit**

```bash
git add prisma/ src/lib/regulatory-truth/types/
git commit -m "feat(schema): add CandidateFact model for Mode 2 signals"
```

---

## Task 5: Create Type Index and Exports

**Files:**
- Create: `src/lib/regulatory-truth/types/index.ts`
- Modify: `src/lib/regulatory-truth/index.ts` (if exists)

**Step 1: Create type index**

Create: `src/lib/regulatory-truth/types/index.ts`

```typescript
// Grounding
export {
  GroundingQuoteSchema,
  CandidateGroundingQuoteSchema,
  QuoteLocationSchema,
  type GroundingQuote,
  type CandidateGroundingQuote,
  type QuoteLocation,
} from './grounding-quote'

// Mode 1: RuleFact
export {
  RuleFactSchema,
  type RuleFact,
  type RuleFactSubject,
  type RuleFactObject,
  type LegalReference,
} from './rule-fact'

// Mode 2: CandidateFact
export {
  CandidateFactSchema,
  type CandidateFact,
  type CandidateSubject,
  type CandidateObject,
} from './candidate-fact'
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/types/
git commit -m "feat(types): add Phase 1 type exports"
```

---

## Task 6: Update Concept Model for Canonical Registry

**Files:**
- Modify: `prisma/schema.prisma` (Concept model)

**Step 1: Add canonical registry fields to Concept**

Modify existing Concept model in `prisma/schema.prisma`:

```prisma
model Concept {
  id          String   @id @default(cuid())
  slug        String   @unique
  nameHr      String
  nameEn      String?
  aliases     String[]
  tags        String[]
  description String?  @db.Text
  parentId    String?

  // === Phase 1: Canonical Registry Fields ===
  isCanonical     Boolean   @default(false)  // Part of Mode 1 canonical set
  domain          String?                     // pdv, pausalni, doprinosi, etc.
  expectedValueType String?                  // Expected value type for validation
  riskTier        RiskTier?                  // Default risk tier for this concept
  pillarTags      String[]                   // Which pillars this concept feeds

  // Relations
  parent    Concept?        @relation("ConceptHierarchy", fields: [parentId], references: [id])
  children  Concept[]       @relation("ConceptHierarchy")
  rules     RegulatoryRule[]
  ruleFacts RuleFact[]
  embedding ConceptEmbedding?

  @@index([isCanonical])
  @@index([domain])
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_canonical_registry_fields`
Expected: Migration created successfully

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add canonical registry fields to Concept model"
```

---

## Summary

After completing all tasks, you will have:

1. **New Enums**: SubjectType, ObjectType, ValueType, MatchType, CandidateStatus
2. **GroundingQuote**: Embedded type for evidence-backed quotes
3. **RuleFact**: Mode 1 model with strict validation (confidence >= 0.90)
4. **CandidateFact**: Mode 2 model with relaxed validation
5. **Updated Concept**: Canonical registry support

**Next Phase**: Phase 1B - Seed Canonical Concept Registry
