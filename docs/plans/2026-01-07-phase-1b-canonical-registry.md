# Phase 1B: Canonical Concept Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed the 21 canonical concepts defined in the design document and create validation utilities for the registry.

**Architecture:** Create a seed script that populates the Concept table with all 21 canonical concepts, with `isCanonical: true`. Build a registry service that validates concept slugs against the canonical set.

**Tech Stack:** Prisma seed, TypeScript, Vitest

**Prerequisites:**
- Phase 1A complete (database schema with updated Concept model)
- Read: `docs/design/PHASE_1_CANONICAL_AND_EXPLORATORY_DESIGN.md` (Section 1)

---

## Task 1: Define Canonical Concept Data

**Files:**
- Create: `src/lib/regulatory-truth/registry/canonical-concepts.ts`
- Create: `src/lib/regulatory-truth/registry/__tests__/canonical-concepts.test.ts`

**Step 1: Write test for canonical concept data**

Create: `src/lib/regulatory-truth/registry/__tests__/canonical-concepts.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { CANONICAL_CONCEPTS, getCanonicalConceptBySlug } from '../canonical-concepts'

describe('Canonical Concepts', () => {
  it('has exactly 21 canonical concepts', () => {
    expect(CANONICAL_CONCEPTS).toHaveLength(21)
  })

  it('all concepts have unique slugs', () => {
    const slugs = CANONICAL_CONCEPTS.map((c) => c.slug)
    const uniqueSlugs = new Set(slugs)
    expect(uniqueSlugs.size).toBe(21)
  })

  it('all concepts have required fields', () => {
    for (const concept of CANONICAL_CONCEPTS) {
      expect(concept.slug).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
      expect(concept.nameHr).toBeTruthy()
      expect(concept.domain).toBeTruthy()
      expect(concept.expectedValueType).toBeTruthy()
      expect(concept.riskTier).toMatch(/^T[0-3]$/)
      expect(concept.pillarTags.length).toBeGreaterThan(0)
    }
  })

  // PDV concepts
  it('includes pdv-standard-rate', () => {
    const concept = getCanonicalConceptBySlug('pdv-standard-rate')
    expect(concept).toBeDefined()
    expect(concept?.domain).toBe('pdv')
    expect(concept?.expectedValueType).toBe('PERCENTAGE')
    expect(concept?.riskTier).toBe('T0')
  })

  it('includes pdv-registration-threshold', () => {
    const concept = getCanonicalConceptBySlug('pdv-registration-threshold')
    expect(concept).toBeDefined()
    expect(concept?.expectedValueType).toBe('CURRENCY_EUR')
    expect(concept?.riskTier).toBe('T1')
  })

  // Pausalni concepts
  it('includes pausalni-revenue-threshold', () => {
    const concept = getCanonicalConceptBySlug('pausalni-revenue-threshold')
    expect(concept).toBeDefined()
    expect(concept?.domain).toBe('pausalni')
  })

  // Doprinosi concepts
  it('includes doprinosi-health-rate', () => {
    const concept = getCanonicalConceptBySlug('doprinosi-health-rate')
    expect(concept).toBeDefined()
    expect(concept?.domain).toBe('doprinosi')
    expect(concept?.riskTier).toBe('T0')
  })

  // Rokovi concepts
  it('includes rokovi-pdv-monthly', () => {
    const concept = getCanonicalConceptBySlug('rokovi-pdv-monthly')
    expect(concept).toBeDefined()
    expect(concept?.domain).toBe('rokovi')
  })

  // Fiskalizacija concepts
  it('includes fiskalizacija-obveza', () => {
    const concept = getCanonicalConceptBySlug('fiskalizacija-obveza')
    expect(concept).toBeDefined()
    expect(concept?.domain).toBe('fiskalizacija')
    expect(concept?.expectedValueType).toBe('BOOLEAN')
  })

  it('returns undefined for non-canonical slug', () => {
    const concept = getCanonicalConceptBySlug('non-existent-concept')
    expect(concept).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/canonical-concepts.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement canonical concepts data**

Create: `src/lib/regulatory-truth/registry/canonical-concepts.ts`

```typescript
export interface CanonicalConcept {
  slug: string
  nameHr: string
  nameEn: string
  description: string
  domain: string
  expectedValueType: string
  riskTier: 'T0' | 'T1' | 'T2' | 'T3'
  pillarTags: string[]
  aliases: string[]
}

export const CANONICAL_CONCEPTS: CanonicalConcept[] = [
  // === PDV (5 concepts) ===
  {
    slug: 'pdv-standard-rate',
    nameHr: 'Standardna stopa PDV-a',
    nameEn: 'Standard VAT Rate',
    description: 'The standard rate of value-added tax applicable to most goods and services',
    domain: 'pdv',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['PDV'],
    aliases: ['stopa pdv', 'pdv stopa', 'vat rate'],
  },
  {
    slug: 'pdv-reduced-rate-13',
    nameHr: 'Snizena stopa PDV-a 13%',
    nameEn: 'Reduced VAT Rate 13%',
    description: 'Reduced VAT rate for hospitality, newspapers, etc.',
    domain: 'pdv',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['PDV'],
    aliases: ['snizena stopa', 'pdv 13'],
  },
  {
    slug: 'pdv-reduced-rate-5',
    nameHr: 'Snizena stopa PDV-a 5%',
    nameEn: 'Super-reduced VAT Rate 5%',
    description: 'Super-reduced VAT rate for basic necessities',
    domain: 'pdv',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['PDV'],
    aliases: ['pdv 5', 'najniza stopa'],
  },
  {
    slug: 'pdv-registration-threshold',
    nameHr: 'Prag za ulazak u sustav PDV-a',
    nameEn: 'VAT Registration Threshold',
    description: 'Annual revenue threshold requiring VAT registration',
    domain: 'pdv',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['PDV', 'Pausalni Obrt'],
    aliases: ['prag pdv', 'limit pdv', 'granica pdv'],
  },
  {
    slug: 'pdv-filing-deadline',
    nameHr: 'Rok za predaju PDV prijave',
    nameEn: 'VAT Filing Deadline',
    description: 'Monthly/quarterly VAT return submission deadline',
    domain: 'pdv',
    expectedValueType: 'DEADLINE_DAY',
    riskTier: 'T1',
    pillarTags: ['PDV', 'Rokovi'],
    aliases: ['rok pdv', 'pdv obrazac rok'],
  },

  // === Pausalni (3 concepts) ===
  {
    slug: 'pausalni-revenue-threshold',
    nameHr: 'Prag prihoda za pausalni obrt',
    nameEn: 'Flat-Rate Revenue Threshold',
    description: 'Maximum annual revenue to qualify for flat-rate taxation',
    domain: 'pausalni',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Pausalni Obrt'],
    aliases: ['prag pausalni', 'limit pausalni', 'granica pausalni'],
  },
  {
    slug: 'pausalni-tax-rate',
    nameHr: 'Stopa poreza za pausalni obrt',
    nameEn: 'Flat-Rate Tax Rate',
    description: 'Fixed tax rate for flat-rate businesses',
    domain: 'pausalni',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Pausalni Obrt'],
    aliases: ['porez pausalni', 'pausalni porez'],
  },
  {
    slug: 'pausalni-contribution-base',
    nameHr: 'Osnovica doprinosa za pausalni obrt',
    nameEn: 'Flat-Rate Contribution Base',
    description: 'Base amount for calculating social contributions',
    domain: 'pausalni',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Pausalni Obrt', 'Doprinosi'],
    aliases: ['osnovica pausalni', 'doprinosi pausalni'],
  },

  // === Porez na Dohodak (4 concepts) ===
  {
    slug: 'porez-dohodak-rate-lower',
    nameHr: 'Niza stopa poreza na dohodak',
    nameEn: 'Lower Income Tax Rate',
    description: 'Lower bracket income tax rate',
    domain: 'porez_dohodak',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Porez na Dohodak'],
    aliases: ['niza stopa dohodak', 'porez dohodak 20'],
  },
  {
    slug: 'porez-dohodak-rate-higher',
    nameHr: 'Visa stopa poreza na dohodak',
    nameEn: 'Higher Income Tax Rate',
    description: 'Higher bracket income tax rate',
    domain: 'porez_dohodak',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Porez na Dohodak'],
    aliases: ['visa stopa dohodak', 'porez dohodak 30'],
  },
  {
    slug: 'porez-dohodak-bracket-threshold',
    nameHr: 'Granica poreznih razreda',
    nameEn: 'Income Tax Bracket Threshold',
    description: 'Income threshold between lower and higher tax brackets',
    domain: 'porez_dohodak',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Porez na Dohodak'],
    aliases: ['razred dohodak', 'granica razreda'],
  },
  {
    slug: 'porez-dohodak-osobni-odbitak',
    nameHr: 'Osobni odbitak',
    nameEn: 'Personal Allowance',
    description: 'Basic personal allowance (tax-free amount)',
    domain: 'porez_dohodak',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Porez na Dohodak'],
    aliases: ['odbitak', 'neoporezivi dio'],
  },

  // === Doprinosi (5 concepts) ===
  {
    slug: 'doprinosi-health-rate',
    nameHr: 'Stopa doprinosa za zdravstveno',
    nameEn: 'Health Insurance Contribution Rate',
    description: 'Health insurance contribution rate',
    domain: 'doprinosi',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Doprinosi'],
    aliases: ['zdravstveno doprinos', 'hzzo stopa'],
  },
  {
    slug: 'doprinosi-pension-1-rate',
    nameHr: 'Stopa doprinosa za I. mirovinski stup',
    nameEn: 'First Pillar Pension Contribution Rate',
    description: 'First pillar pension contribution rate',
    domain: 'doprinosi',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Doprinosi'],
    aliases: ['prvi stup', 'mio i stup'],
  },
  {
    slug: 'doprinosi-pension-2-rate',
    nameHr: 'Stopa doprinosa za II. mirovinski stup',
    nameEn: 'Second Pillar Pension Contribution Rate',
    description: 'Second pillar pension contribution rate',
    domain: 'doprinosi',
    expectedValueType: 'PERCENTAGE',
    riskTier: 'T0',
    pillarTags: ['Doprinosi'],
    aliases: ['drugi stup', 'mio ii stup'],
  },
  {
    slug: 'doprinosi-base-minimum',
    nameHr: 'Najniza osnovica za doprinose',
    nameEn: 'Minimum Contribution Base',
    description: 'Minimum contribution base',
    domain: 'doprinosi',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Doprinosi'],
    aliases: ['minimalna osnovica', 'najniza osnovica'],
  },
  {
    slug: 'doprinosi-base-maximum',
    nameHr: 'Najvisa osnovica za doprinose',
    nameEn: 'Maximum Contribution Base',
    description: 'Maximum contribution base',
    domain: 'doprinosi',
    expectedValueType: 'CURRENCY_EUR',
    riskTier: 'T1',
    pillarTags: ['Doprinosi'],
    aliases: ['maksimalna osnovica', 'najvisa osnovica'],
  },

  // === Rokovi (3 concepts) ===
  {
    slug: 'rokovi-pdv-monthly',
    nameHr: 'Rok za mjesecnu PDV prijavu',
    nameEn: 'Monthly VAT Filing Deadline',
    description: 'Monthly VAT return filing deadline',
    domain: 'rokovi',
    expectedValueType: 'DEADLINE_DAY',
    riskTier: 'T1',
    pillarTags: ['Rokovi', 'PDV'],
    aliases: ['pdv mjesecni rok', '20. u mjesecu'],
  },
  {
    slug: 'rokovi-joppd',
    nameHr: 'Rok za predaju JOPPD obrasca',
    nameEn: 'JOPPD Filing Deadline',
    description: 'JOPPD form submission deadline',
    domain: 'rokovi',
    expectedValueType: 'DEADLINE_DESCRIPTION',
    riskTier: 'T1',
    pillarTags: ['Rokovi', 'Obrasci'],
    aliases: ['joppd rok', '15. u mjesecu'],
  },
  {
    slug: 'rokovi-godisnja-prijava',
    nameHr: 'Rok za godisnju poreznu prijavu',
    nameEn: 'Annual Tax Return Deadline',
    description: 'Annual tax return filing deadline',
    domain: 'rokovi',
    expectedValueType: 'DEADLINE_DESCRIPTION',
    riskTier: 'T1',
    pillarTags: ['Rokovi'],
    aliases: ['godisnja prijava', 'doh obrazac rok'],
  },

  // === Fiskalizacija (1 concept) ===
  {
    slug: 'fiskalizacija-obveza',
    nameHr: 'Obveza fiskalizacije',
    nameEn: 'Fiscalization Obligation',
    description: 'Legal obligation to fiscalize cash transactions',
    domain: 'fiskalizacija',
    expectedValueType: 'BOOLEAN',
    riskTier: 'T0',
    pillarTags: ['Fiskalizacija'],
    aliases: ['fiskalizacija', 'fiskalna blagajna'],
  },
]

// Lookup map for O(1) access
const CANONICAL_CONCEPT_MAP = new Map(
  CANONICAL_CONCEPTS.map((c) => [c.slug, c])
)

export function getCanonicalConceptBySlug(slug: string): CanonicalConcept | undefined {
  return CANONICAL_CONCEPT_MAP.get(slug)
}

export function isCanonicalConceptSlug(slug: string): boolean {
  return CANONICAL_CONCEPT_MAP.has(slug)
}

export function getCanonicalConceptsByDomain(domain: string): CanonicalConcept[] {
  return CANONICAL_CONCEPTS.filter((c) => c.domain === domain)
}

export function getAllCanonicalSlugs(): string[] {
  return CANONICAL_CONCEPTS.map((c) => c.slug)
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/canonical-concepts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/registry/
git commit -m "feat(registry): add 21 canonical concepts data"
```

---

## Task 2: Create Concept Slug Validator

**Files:**
- Create: `src/lib/regulatory-truth/registry/concept-validator.ts`
- Create: `src/lib/regulatory-truth/registry/__tests__/concept-validator.test.ts`

**Step 1: Write test for concept validator**

Create: `src/lib/regulatory-truth/registry/__tests__/concept-validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  validateConceptSlug,
  validateConceptForMode1,
  ConceptValidationError,
} from '../concept-validator'

describe('Concept Validator', () => {
  describe('validateConceptSlug', () => {
    it('accepts valid canonical slug', () => {
      const result = validateConceptSlug('pdv-standard-rate')
      expect(result.valid).toBe(true)
      expect(result.concept).toBeDefined()
    })

    it('rejects non-canonical slug', () => {
      const result = validateConceptSlug('unknown-concept')
      expect(result.valid).toBe(false)
      expect(result.error).toBe(ConceptValidationError.NOT_IN_REGISTRY)
    })

    it('rejects empty slug', () => {
      const result = validateConceptSlug('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe(ConceptValidationError.INVALID_FORMAT)
    })

    it('rejects malformed slug', () => {
      const result = validateConceptSlug('INVALID_SLUG')
      expect(result.valid).toBe(false)
      expect(result.error).toBe(ConceptValidationError.INVALID_FORMAT)
    })
  })

  describe('validateConceptForMode1', () => {
    it('accepts canonical concept with matching value type', () => {
      const result = validateConceptForMode1('pdv-standard-rate', 'PERCENTAGE')
      expect(result.valid).toBe(true)
    })

    it('rejects mismatched value type', () => {
      const result = validateConceptForMode1('pdv-standard-rate', 'CURRENCY_EUR')
      expect(result.valid).toBe(false)
      expect(result.error).toBe(ConceptValidationError.VALUE_TYPE_MISMATCH)
    })

    it('rejects non-canonical concept', () => {
      const result = validateConceptForMode1('unknown-concept', 'PERCENTAGE')
      expect(result.valid).toBe(false)
      expect(result.error).toBe(ConceptValidationError.NOT_IN_REGISTRY)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/concept-validator.test.ts`
Expected: FAIL

**Step 3: Implement concept validator**

Create: `src/lib/regulatory-truth/registry/concept-validator.ts`

```typescript
import {
  getCanonicalConceptBySlug,
  isCanonicalConceptSlug,
  type CanonicalConcept,
} from './canonical-concepts'

export enum ConceptValidationError {
  INVALID_FORMAT = 'INVALID_FORMAT',
  NOT_IN_REGISTRY = 'NOT_IN_REGISTRY',
  VALUE_TYPE_MISMATCH = 'VALUE_TYPE_MISMATCH',
  RISK_TIER_MISMATCH = 'RISK_TIER_MISMATCH',
}

export interface ConceptValidationResult {
  valid: boolean
  error?: ConceptValidationError
  concept?: CanonicalConcept
  details?: string
}

const SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export function validateConceptSlug(slug: string): ConceptValidationResult {
  // Check format
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      error: ConceptValidationError.INVALID_FORMAT,
      details: `Slug must be kebab-case (e.g., pdv-standard-rate), got: "${slug}"`,
    }
  }

  // Check if in canonical registry
  const concept = getCanonicalConceptBySlug(slug)
  if (!concept) {
    return {
      valid: false,
      error: ConceptValidationError.NOT_IN_REGISTRY,
      details: `Concept slug "${slug}" is not in the Canonical Registry`,
    }
  }

  return {
    valid: true,
    concept,
  }
}

export function validateConceptForMode1(
  slug: string,
  valueType: string
): ConceptValidationResult {
  // First validate slug
  const slugResult = validateConceptSlug(slug)
  if (!slugResult.valid) {
    return slugResult
  }

  const concept = slugResult.concept!

  // Check value type matches expected
  if (concept.expectedValueType !== valueType) {
    return {
      valid: false,
      error: ConceptValidationError.VALUE_TYPE_MISMATCH,
      concept,
      details: `Concept "${slug}" expects valueType "${concept.expectedValueType}", got "${valueType}"`,
    }
  }

  return {
    valid: true,
    concept,
  }
}

export function validateConceptRiskTier(
  slug: string,
  riskTier: string
): ConceptValidationResult {
  const slugResult = validateConceptSlug(slug)
  if (!slugResult.valid) {
    return slugResult
  }

  const concept = slugResult.concept!

  if (concept.riskTier !== riskTier) {
    return {
      valid: false,
      error: ConceptValidationError.RISK_TIER_MISMATCH,
      concept,
      details: `Concept "${slug}" has default riskTier "${concept.riskTier}", got "${riskTier}"`,
    }
  }

  return {
    valid: true,
    concept,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/concept-validator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/registry/
git commit -m "feat(registry): add concept slug validator"
```

---

## Task 3: Create Database Seed Script

**Files:**
- Create: `prisma/seed-canonical-concepts.ts`

**Step 1: Create seed script**

Create: `prisma/seed-canonical-concepts.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import { CANONICAL_CONCEPTS } from '../src/lib/regulatory-truth/registry/canonical-concepts'

const prisma = new PrismaClient()

async function seedCanonicalConcepts() {
  console.log('Seeding canonical concepts...')

  let created = 0
  let updated = 0

  for (const concept of CANONICAL_CONCEPTS) {
    const existing = await prisma.concept.findUnique({
      where: { slug: concept.slug },
    })

    if (existing) {
      // Update existing concept to mark as canonical
      await prisma.concept.update({
        where: { slug: concept.slug },
        data: {
          nameHr: concept.nameHr,
          nameEn: concept.nameEn,
          description: concept.description,
          aliases: concept.aliases,
          isCanonical: true,
          domain: concept.domain,
          expectedValueType: concept.expectedValueType,
          riskTier: concept.riskTier as any,
          pillarTags: concept.pillarTags,
        },
      })
      updated++
      console.log(`  Updated: ${concept.slug}`)
    } else {
      // Create new concept
      await prisma.concept.create({
        data: {
          slug: concept.slug,
          nameHr: concept.nameHr,
          nameEn: concept.nameEn,
          description: concept.description,
          aliases: concept.aliases,
          tags: [concept.domain],
          isCanonical: true,
          domain: concept.domain,
          expectedValueType: concept.expectedValueType,
          riskTier: concept.riskTier as any,
          pillarTags: concept.pillarTags,
        },
      })
      created++
      console.log(`  Created: ${concept.slug}`)
    }
  }

  console.log(`\nCanonical concepts seeded:`)
  console.log(`  Created: ${created}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Total: ${CANONICAL_CONCEPTS.length}`)
}

async function main() {
  try {
    await seedCanonicalConcepts()
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
```

**Step 2: Add seed script to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "db:seed:concepts": "npx tsx prisma/seed-canonical-concepts.ts"
  }
}
```

**Step 3: Run seed script**

Run: `npm run db:seed:concepts`
Expected: 21 concepts created/updated

**Step 4: Verify seed in database**

Run: `npx prisma studio` and check Concept table
Expected: 21 concepts with isCanonical=true

**Step 5: Commit**

```bash
git add prisma/seed-canonical-concepts.ts package.json
git commit -m "feat(seed): add canonical concept seeding script"
```

---

## Task 4: Create Registry Service

**Files:**
- Create: `src/lib/regulatory-truth/registry/registry-service.ts`
- Create: `src/lib/regulatory-truth/registry/__tests__/registry-service.db.test.ts`

**Step 1: Write test for registry service**

Create: `src/lib/regulatory-truth/registry/__tests__/registry-service.db.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { RegistryService } from '../registry-service'

const prisma = new PrismaClient()

describe('RegistryService (DB)', () => {
  let service: RegistryService

  beforeAll(async () => {
    service = new RegistryService(prisma)
    // Ensure at least one canonical concept exists
    await prisma.concept.upsert({
      where: { slug: 'pdv-standard-rate' },
      update: { isCanonical: true },
      create: {
        slug: 'pdv-standard-rate',
        nameHr: 'Standardna stopa PDV-a',
        isCanonical: true,
        domain: 'pdv',
        expectedValueType: 'PERCENTAGE',
        riskTier: 'T0',
        pillarTags: ['PDV'],
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('getCanonicalConcept returns concept from DB', async () => {
    const concept = await service.getCanonicalConcept('pdv-standard-rate')
    expect(concept).toBeDefined()
    expect(concept?.isCanonical).toBe(true)
  })

  it('getCanonicalConcept returns null for non-existent', async () => {
    const concept = await service.getCanonicalConcept('non-existent')
    expect(concept).toBeNull()
  })

  it('isConceptCanonical returns true for canonical', async () => {
    const result = await service.isConceptCanonical('pdv-standard-rate')
    expect(result).toBe(true)
  })

  it('isConceptCanonical returns false for non-canonical', async () => {
    const result = await service.isConceptCanonical('non-existent')
    expect(result).toBe(false)
  })

  it('listCanonicalConcepts returns all canonical concepts', async () => {
    const concepts = await service.listCanonicalConcepts()
    expect(concepts.length).toBeGreaterThan(0)
    expect(concepts.every((c) => c.isCanonical)).toBe(true)
  })

  it('listCanonicalConceptsByDomain filters by domain', async () => {
    const concepts = await service.listCanonicalConceptsByDomain('pdv')
    expect(concepts.length).toBeGreaterThan(0)
    expect(concepts.every((c) => c.domain === 'pdv')).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/registry-service.db.test.ts`
Expected: FAIL

**Step 3: Implement registry service**

Create: `src/lib/regulatory-truth/registry/registry-service.ts`

```typescript
import type { PrismaClient, Concept } from '@prisma/client'

export class RegistryService {
  constructor(private prisma: PrismaClient) {}

  async getCanonicalConcept(slug: string): Promise<Concept | null> {
    return this.prisma.concept.findFirst({
      where: {
        slug,
        isCanonical: true,
      },
    })
  }

  async isConceptCanonical(slug: string): Promise<boolean> {
    const concept = await this.getCanonicalConcept(slug)
    return concept !== null
  }

  async listCanonicalConcepts(): Promise<Concept[]> {
    return this.prisma.concept.findMany({
      where: { isCanonical: true },
      orderBy: { slug: 'asc' },
    })
  }

  async listCanonicalConceptsByDomain(domain: string): Promise<Concept[]> {
    return this.prisma.concept.findMany({
      where: {
        isCanonical: true,
        domain,
      },
      orderBy: { slug: 'asc' },
    })
  }

  async getCanonicalConceptCount(): Promise<number> {
    return this.prisma.concept.count({
      where: { isCanonical: true },
    })
  }

  async validateSlugIsCanonical(slug: string): Promise<{
    valid: boolean
    concept?: Concept
    error?: string
  }> {
    const concept = await this.getCanonicalConcept(slug)

    if (!concept) {
      return {
        valid: false,
        error: `Concept slug "${slug}" is not in the Canonical Registry`,
      }
    }

    return {
      valid: true,
      concept,
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/registry/__tests__/registry-service.db.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/registry/
git commit -m "feat(registry): add RegistryService for DB-backed concept lookup"
```

---

## Task 5: Create Registry Index and Exports

**Files:**
- Create: `src/lib/regulatory-truth/registry/index.ts`

**Step 1: Create index file**

Create: `src/lib/regulatory-truth/registry/index.ts`

```typescript
// Canonical concept data
export {
  CANONICAL_CONCEPTS,
  getCanonicalConceptBySlug,
  isCanonicalConceptSlug,
  getCanonicalConceptsByDomain,
  getAllCanonicalSlugs,
  type CanonicalConcept,
} from './canonical-concepts'

// Validation
export {
  validateConceptSlug,
  validateConceptForMode1,
  validateConceptRiskTier,
  ConceptValidationError,
  type ConceptValidationResult,
} from './concept-validator'

// DB service
export { RegistryService } from './registry-service'
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/registry/
git commit -m "feat(registry): add registry exports"
```

---

## Summary

After completing all tasks, you will have:

1. **Canonical Concepts Data**: All 21 concepts defined with full metadata
2. **Concept Validator**: Validates slugs against canonical registry
3. **Seed Script**: Seeds database with canonical concepts
4. **Registry Service**: DB-backed concept lookup and validation

**Next Phase**: Phase 1C - RuleFact Validation Layer
