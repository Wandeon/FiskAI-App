# NN Mirror Phase 2: Instrument Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform gazette items into navigable instrument histories with confidence-tracked linking, event typing, and timeline ordering.

**Architecture:** Resolver attempts to link Evidence to Instruments via ELI match or title fuzzy match. Each attempt is logged for audit. Successful links create InstrumentEvidenceLink with event type and timeline position. InstrumentCoverage is derived and recalculable.

**Tech Stack:** Prisma 7 (migrations), TypeScript (resolver), string-similarity (fuzzy match), Vitest (tests)

**Reference:** `docs/specs/nn-mirror-v1.md` Sections 2.6-2.9, 3.3

**Prerequisite:** Phase 1 complete with ALL exit criteria met:

- ParsedDocument, ProvisionNode tables exist
- ⚠️ AUDIT FIX: docMeta must include (nnYear, nnIssue, nnItem, publishedAt) - resolver depends on this
- CLEAN_TEXT artifacts created (not HTML_CLEANED)
- Offset integrity verified (no PARSE-INV-003 violations)

---

## Part A: App Repository (Schema & Migrations)

### Task A1: Add Instrument-Related Enums

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Write the enum definitions**

Add after existing enums:

```prisma
enum InstrumentEventType {
  ORIGINAL          // Izvorni tekst
  AMENDMENT         // Izmjene i dopune
  CONSOLIDATED      // Pročišćeni tekst
  CORRECTION        // Ispravak
  DECISION          // Odluka
  INTERPRETATION    // Autentično tumačenje
  REPEAL            // Prestanak važenja
  UNKNOWN
}

enum InstrumentLinkMethod {
  ELI               // Matched via ELI URI
  TITLE_FUZZY       // Fuzzy title match
  CANONICAL_KEY     // NN canonical key match
  MANUAL            // Human curation
}

enum InstrumentLinkConfidence {
  HIGH              // ELI match or manual confirmation
  MEDIUM            // Strong title match (>0.85 similarity)
  LOW               // Weak match, needs review
}

enum ResolutionFailReason {
  NO_ELI            // No ELI found in document
  LOW_SCORE         // Best match below threshold
  AMBIGUOUS         // Multiple equally good matches
  MULTI_MATCH       // Multiple instruments matched
  MISSING_METADATA  // Required metadata not extractable
  PARSE_FAILED      // ParsedDocument not available
}
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add instrument linking enums

InstrumentEventType for timeline events (ORIGINAL, AMENDMENT, etc.)
InstrumentLinkMethod for resolution tracking (ELI, TITLE_FUZZY, etc.)
InstrumentLinkConfidence for quality tiers
ResolutionFailReason for audit trail
Spec: docs/specs/nn-mirror-v1.md Section 2.1

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A2: Add Instrument Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the Instrument model**

```prisma
model Instrument {
  id              String    @id @default(cuid())

  // Identity - at least one must be present
  canonicalId     String    @unique  // Deterministic dedup key: "hr:zakon:2024:pdv"
  eliUri          String?   @unique  // ELI URI if available
  nnCanonicalKey  String?            // Fallback: "zakon-o-pdv-u"

  // Display
  title           String             // Full official title
  shortTitle      String?            // Common short name

  // Lifecycle
  status          String    @default("TRACKING")  // TRACKING, BASELINED, ARCHIVED

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  evidenceLinks   InstrumentEvidenceLink[]
  coverage        InstrumentCoverage?

  @@index([nnCanonicalKey])
  @@index([status])
}
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Instrument model for legal instrument identity

Unique canonicalId for deduplication.
Optional eliUri for ELI-compliant linking.
Fallback nnCanonicalKey for legacy references.
Spec: docs/specs/nn-mirror-v1.md Section 2.6

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A3: Add InstrumentEvidenceLink Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the InstrumentEvidenceLink model**

```prisma
model InstrumentEvidenceLink {
  id              String                    @id @default(cuid())
  instrumentId    String
  evidenceId      String

  // Resolution metadata
  method          InstrumentLinkMethod
  confidence      InstrumentLinkConfidence
  matchedBy       String?                   // "resolver-v1.2.3", userId for manual
  matchMeta       Json?                     // { score, eliCandidate, titleSimilarity }

  // Timeline position
  eventType       InstrumentEventType       @default(UNKNOWN)
  publishedAt     DateTime?                 // From NN metadata (publication date)
  effectiveFrom   DateTime?                 // "Stupa na snagu..." (effective date)
  effectiveUntil  DateTime?                 // Explicit end date if known

  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  // Relations
  instrument      Instrument                @relation(fields: [instrumentId], references: [id])
  evidence        Evidence                  @relation(fields: [evidenceId], references: [id])

  @@unique([instrumentId, evidenceId])
  @@index([evidenceId])
  @@index([instrumentId, publishedAt])
  @@index([instrumentId, confidence])
  @@index([eventType])
}
```

**Step 2: Add relation to Evidence model**

Find the Evidence model and add:

```prisma
  instrumentLinks     InstrumentEvidenceLink[]
```

**Step 3: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add InstrumentEvidenceLink for timeline join

Links Evidence to Instrument with confidence tracking.
Stores event type, publication date, effective dates.
Enables instrument timeline queries.
Spec: docs/specs/nn-mirror-v1.md Section 2.7

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A4: Add InstrumentResolutionAttempt Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the InstrumentResolutionAttempt model**

```prisma
model InstrumentResolutionAttempt {
  id                  String                    @id @default(cuid())
  evidenceId          String
  sourceKey           String?                   // Snapshot of Evidence.sourceKey at resolution time

  // Candidates considered during resolution
  candidates          Json                      // [{ instrumentId, score, method, matchMeta }]

  // Outcome - what was chosen (if any)
  chosenInstrumentId  String?
  confidence          InstrumentLinkConfidence?
  method              InstrumentLinkMethod?

  // If unresolved, why
  failReason          ResolutionFailReason?
  failDetail          String?                   // Human-readable explanation

  // Resolver identity for reproducibility
  resolverVersion     String                    // "resolver-v1.2.3"

  createdAt           DateTime                  @default(now())

  // Relations
  evidence            Evidence                  @relation(fields: [evidenceId], references: [id])

  @@index([evidenceId, createdAt])
  @@index([chosenInstrumentId])
  @@index([failReason])
  @@index([resolverVersion])
}
```

**Step 2: Add relation to Evidence model**

Find the Evidence model and add:

```prisma
  resolutionAttempts  InstrumentResolutionAttempt[]
```

**Step 3: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add InstrumentResolutionAttempt for resolver audit

Logs every resolution attempt with candidates considered.
Tracks success/failure with detailed reason codes.
Enables resolver quality analysis and debugging.
Spec: docs/specs/nn-mirror-v1.md Section 2.8

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A5: Add InstrumentCoverage Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the InstrumentCoverage model**

```prisma
model InstrumentCoverage {
  id              String              @id @default(cuid())
  instrumentId    String              @unique

  // Timeline bounds
  startDate       DateTime?           // Earliest known publication
  endDate         DateTime?           // Latest known publication (null = ongoing)
  startEvidenceId String?             // Evidence for the ORIGINAL
  startType       InstrumentEventType @default(UNKNOWN)

  // Gap analysis
  gapNote         String?             // Human note about coverage gaps
  missingIssues   Json?               // [{ nnYear, nnIssue, reason }]

  // Computation metadata (for cache invalidation)
  computedAt      DateTime            @default(now())
  computedBy      String              // "coverage-computer-v1.0.0"

  // Relations
  instrument      Instrument          @relation(fields: [instrumentId], references: [id])

  @@index([computedAt])
}
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add InstrumentCoverage for derived timeline stats

Stores computed timeline bounds and gap analysis.
Rebuildable from InstrumentEvidenceLinks.
Spec: docs/specs/nn-mirror-v1.md Section 2.9

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A6: Generate and Run Migration

**Files:**

- Create: `prisma/migrations/YYYYMMDDHHMMSS_nn_mirror_phase2/migration.sql` (auto-generated)

**Step 1: Generate the migration**

Run: `npx prisma migrate dev --name nn_mirror_phase2_instruments --create-only`
Expected: Migration file created

**Step 2: Review the generated SQL**

Verify:

- All enums created
- Tables: Instrument, InstrumentEvidenceLink, InstrumentResolutionAttempt, InstrumentCoverage
- Unique constraints on (instrumentId, evidenceId) and (instrumentId) for coverage
- All indexes present
- Foreign keys correct

**Step 3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: Migration applied

**Step 4: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: Client updated with new types

**Step 5: Commit**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat(db): apply nn_mirror_phase2_instruments migration

Creates Instrument, InstrumentEvidenceLink, InstrumentResolutionAttempt,
InstrumentCoverage tables with full indexing strategy.
Spec: docs/specs/nn-mirror-v1.md

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Part B: Workers Repository (Resolver Implementation)

### Task B1: Create Resolver Types and Interfaces

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/types.ts`

**Step 1: Write the failing test**

Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import type {
  ResolverInput,
  ResolverOutput,
  ResolverCandidate,
  ResolverConfig,
  EventTypeClassification,
} from "../types"
import {
  InstrumentEventType,
  InstrumentLinkMethod,
  InstrumentLinkConfidence,
  ResolutionFailReason,
} from "@prisma/client"

describe("Resolver Types", () => {
  it("ResolverInput has required fields", () => {
    const input: ResolverInput = {
      evidenceId: "test-123",
      sourceKey: "nn:item:2024:152:2505",
      docMeta: {
        title: "Zakon o porezu na dohodak",
        nnYear: 2024,
        nnIssue: 152,
        nnItem: 2505,
      },
    }
    expect(input.evidenceId).toBe("test-123")
  })

  it("ResolverCandidate tracks scoring", () => {
    const candidate: ResolverCandidate = {
      instrumentId: "inst-123",
      score: 0.92,
      method: InstrumentLinkMethod.TITLE_FUZZY,
      matchMeta: { titleSimilarity: 0.92 },
    }
    expect(candidate.score).toBeGreaterThan(0.9)
  })

  it("ResolverOutput captures success or failure", () => {
    const success: ResolverOutput = {
      resolved: true,
      instrumentId: "inst-123",
      confidence: InstrumentLinkConfidence.HIGH,
      method: InstrumentLinkMethod.ELI,
      candidates: [],
    }
    expect(success.resolved).toBe(true)

    const failure: ResolverOutput = {
      resolved: false,
      failReason: ResolutionFailReason.AMBIGUOUS,
      failDetail: "Two instruments matched with equal scores",
      candidates: [],
    }
    expect(failure.resolved).toBe(false)
  })

  it("EventTypeClassification captures classification", () => {
    const classification: EventTypeClassification = {
      eventType: InstrumentEventType.AMENDMENT,
      confidence: 0.95,
      signals: ["title contains 'izmjene i dopune'"],
    }
    expect(classification.eventType).toBe(InstrumentEventType.AMENDMENT)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

**Step 3: Write the types file**

Create: `src/lib/regulatory-truth/instrument-resolver/types.ts`

```typescript
import {
  InstrumentEventType,
  InstrumentLinkMethod,
  InstrumentLinkConfidence,
  ResolutionFailReason,
} from "@prisma/client"

/**
 * Input to the resolver from parsed document metadata
 */
export interface ResolverInput {
  evidenceId: string
  sourceKey?: string | null

  // From ParsedDocument.docMeta or Evidence metadata
  docMeta: DocumentMetaForResolution
}

export interface DocumentMetaForResolution {
  title?: string
  eli?: string
  nnYear?: number
  nnIssue?: number
  nnItem?: number
  textType?: string
  publishedAt?: Date
  effectiveFrom?: Date
}

/**
 * A candidate instrument match with scoring
 */
export interface ResolverCandidate {
  instrumentId: string
  score: number // 0.0 - 1.0
  method: InstrumentLinkMethod
  matchMeta: Record<string, unknown> // Method-specific details
}

/**
 * Output from resolver - either success or failure with audit trail
 */
export type ResolverOutput = ResolverSuccess | ResolverFailure

export interface ResolverSuccess {
  resolved: true
  instrumentId: string
  confidence: InstrumentLinkConfidence
  method: InstrumentLinkMethod
  matchMeta?: Record<string, unknown>
  candidates: ResolverCandidate[] // All candidates considered
}

export interface ResolverFailure {
  resolved: false
  failReason: ResolutionFailReason
  failDetail: string
  candidates: ResolverCandidate[] // What was considered
}

/**
 * Event type classification result
 */
export interface EventTypeClassification {
  eventType: InstrumentEventType
  confidence: number // 0.0 - 1.0
  signals: string[] // What triggered this classification
}

/**
 * Resolver configuration
 */
export interface ResolverConfig {
  // Thresholds
  highConfidenceThreshold: number // Score >= this → HIGH (default: 0.95)
  mediumConfidenceThreshold: number // Score >= this → MEDIUM (default: 0.85)
  minimumMatchThreshold: number // Score < this → reject (default: 0.70)

  // Behavior
  allowCreateInstrument: boolean // Create new Instrument if no match
  preferEliOverTitle: boolean // ELI match wins over higher title score
  maxCandidates: number // Max candidates to consider (default: 10)

  // Version tracking
  resolverVersion: string // For audit trail
}

export const DEFAULT_RESOLVER_CONFIG: ResolverConfig = {
  highConfidenceThreshold: 0.95,
  mediumConfidenceThreshold: 0.85,
  minimumMatchThreshold: 0.7,
  allowCreateInstrument: true,
  preferEliOverTitle: true,
  maxCandidates: 10,
  resolverVersion: "resolver-v1.0.0",
}

/**
 * Timeline entry for instrument history
 */
export interface TimelineEntry {
  evidenceId: string
  eventType: InstrumentEventType
  publishedAt: Date | null
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  confidence: InstrumentLinkConfidence
  title?: string
}

/**
 * Full instrument timeline
 */
export interface InstrumentTimeline {
  instrumentId: string
  canonicalId: string
  title: string
  entries: TimelineEntry[] // Ordered by publishedAt
  coverage: {
    startDate: Date | null
    endDate: Date | null
    hasGaps: boolean
    gapCount: number
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): add resolver types and interfaces

ResolverInput, ResolverOutput, ResolverCandidate for resolution flow.
EventTypeClassification for timeline typing.
TimelineEntry and InstrumentTimeline for history queries.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B2: Implement ELI Matcher

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/matchers/eli-matcher.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/eli-matcher.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { parseEli, matchByEli, normalizeEli } from "../eli-matcher"

describe("ELI Matcher", () => {
  describe("parseEli", () => {
    it("parses standard Croatian ELI", () => {
      const eli = "eli/hr/zakon/2024/152/2505/cro"
      const parsed = parseEli(eli)

      expect(parsed).toEqual({
        jurisdiction: "hr",
        type: "zakon",
        year: 2024,
        issue: 152,
        item: 2505,
        language: "cro",
        version: null,
      })
    })

    it("parses ELI with version", () => {
      const eli = "eli/hr/zakon/2024/152/2505/cro/konsolidirana"
      const parsed = parseEli(eli)

      expect(parsed?.version).toBe("konsolidirana")
    })

    it("returns null for invalid ELI", () => {
      expect(parseEli("not-an-eli")).toBeNull()
      expect(parseEli("")).toBeNull()
    })
  })

  describe("normalizeEli", () => {
    it("normalizes ELI variants to canonical form", () => {
      const variants = [
        "eli/hr/zakon/2024/152/2505/cro",
        "ELI/HR/ZAKON/2024/152/2505/CRO",
        "/eli/hr/zakon/2024/152/2505/cro/",
        "https://narodne-novine.nn.hr/eli/hr/zakon/2024/152/2505/cro",
      ]

      const normalized = variants.map(normalizeEli)
      expect(new Set(normalized).size).toBe(1) // All normalize to same
    })
  })

  describe("matchByEli", () => {
    it("returns exact match for identical ELI", async () => {
      const mockInstruments = [
        { id: "inst-1", eliUri: "eli/hr/zakon/2024/152/2505/cro" },
        { id: "inst-2", eliUri: "eli/hr/zakon/2024/100/1000/cro" },
      ]

      const result = await matchByEli("eli/hr/zakon/2024/152/2505/cro", mockInstruments)

      expect(result).not.toBeNull()
      expect(result?.instrumentId).toBe("inst-1")
      expect(result?.score).toBe(1.0)
    })

    it("returns null when no match", async () => {
      const mockInstruments = [{ id: "inst-1", eliUri: "eli/hr/zakon/2024/100/1000/cro" }]

      const result = await matchByEli("eli/hr/zakon/2024/152/2505/cro", mockInstruments)

      expect(result).toBeNull()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/eli-matcher.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/matchers/eli-matcher.ts`

```typescript
import { InstrumentLinkMethod } from "@prisma/client"
import type { ResolverCandidate } from "../types"

/**
 * Parsed ELI components
 */
export interface ParsedEli {
  jurisdiction: string // "hr"
  type: string // "zakon", "pravilnik", etc.
  year: number
  issue: number
  item: number
  language: string // "cro"
  version: string | null // "konsolidirana", etc.
}

/**
 * Parse an ELI URI into components
 *
 * Formats supported:
 * - eli/hr/zakon/2024/152/2505/cro
 * - eli/hr/zakon/2024/152/2505/cro/konsolidirana
 * - /eli/hr/... (leading slash)
 * - https://narodne-novine.nn.hr/eli/hr/... (full URL)
 */
export function parseEli(eli: string): ParsedEli | null {
  if (!eli) return null

  // Normalize: remove URL prefix, leading/trailing slashes, lowercase
  let normalized = eli.toLowerCase().trim()
  normalized = normalized.replace(/^https?:\/\/[^/]+/, "")
  normalized = normalized.replace(/^\/+|\/+$/g, "")

  // Match pattern: eli/{jurisdiction}/{type}/{year}/{issue}/{item}/{lang}[/{version}]
  const match = normalized.match(
    /^eli\/([a-z]{2})\/([a-z]+)\/(\d{4})\/(\d+)\/(\d+)\/([a-z]{2,3})(?:\/([a-z]+))?$/
  )

  if (!match) return null

  return {
    jurisdiction: match[1],
    type: match[2],
    year: parseInt(match[3], 10),
    issue: parseInt(match[4], 10),
    item: parseInt(match[5], 10),
    language: match[6],
    version: match[7] || null,
  }
}

/**
 * Normalize ELI to canonical form for comparison
 */
export function normalizeEli(eli: string): string {
  const parsed = parseEli(eli)
  if (!parsed) return eli.toLowerCase().trim()

  // Canonical form without version
  return `eli/${parsed.jurisdiction}/${parsed.type}/${parsed.year}/${parsed.issue}/${parsed.item}/${parsed.language}`
}

/**
 * Build ELI from NN metadata
 */
export function buildEliFromMetadata(meta: {
  textType?: string
  nnYear?: number
  nnIssue?: number
  nnItem?: number
}): string | null {
  if (!meta.textType || !meta.nnYear || !meta.nnIssue || !meta.nnItem) {
    return null
  }

  // Map Croatian text types to ELI types
  const typeMap: Record<string, string> = {
    zakon: "zakon",
    pravilnik: "pravilnik",
    uredba: "uredba",
    odluka: "odluka",
    naredba: "naredba",
  }

  const eliType = typeMap[meta.textType.toLowerCase()]
  if (!eliType) return null

  return `eli/hr/${eliType}/${meta.nnYear}/${meta.nnIssue}/${meta.nnItem}/cro`
}

/**
 * Match evidence against instruments by ELI
 *
 * @param evidenceEli - ELI from the evidence
 * @param instruments - Instruments to match against
 * @returns Best matching candidate or null
 */
export async function matchByEli(
  evidenceEli: string,
  instruments: Array<{ id: string; eliUri: string | null }>
): Promise<ResolverCandidate | null> {
  const normalizedEvidence = normalizeEli(evidenceEli)

  for (const instrument of instruments) {
    if (!instrument.eliUri) continue

    const normalizedInstrument = normalizeEli(instrument.eliUri)

    if (normalizedEvidence === normalizedInstrument) {
      return {
        instrumentId: instrument.id,
        score: 1.0, // Exact ELI match is perfect score
        method: InstrumentLinkMethod.ELI,
        matchMeta: {
          evidenceEli,
          instrumentEli: instrument.eliUri,
          matchType: "exact",
        },
      }
    }
  }

  return null
}

/**
 * Extract potential ELI from document HTML/text
 */
export function extractEliFromContent(content: string): string | null {
  // Look for ELI patterns in content
  const eliPattern = /eli\/hr\/[a-z]+\/\d{4}\/\d+\/\d+\/[a-z]{2,3}/gi
  const matches = content.match(eliPattern)

  if (matches && matches.length > 0) {
    // Return first valid match
    for (const match of matches) {
      if (parseEli(match)) {
        return match
      }
    }
  }

  return null
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/eli-matcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement ELI matcher

Parses and normalizes Croatian ELI URIs.
Supports URL variants and versioned ELIs.
Returns perfect 1.0 score for exact matches.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B3: Implement Title Fuzzy Matcher

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/matchers/title-matcher.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/title-matcher.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import {
  normalizeTitle,
  computeTitleSimilarity,
  matchByTitle,
  extractBaseTitle,
} from "../title-matcher"
import { InstrumentLinkMethod } from "@prisma/client"

describe("Title Matcher", () => {
  describe("normalizeTitle", () => {
    it("lowercases and removes extra whitespace", () => {
      expect(normalizeTitle("  ZAKON   O  PDV-u  ")).toBe("zakon o pdv-u")
    })

    it("removes common prefixes", () => {
      expect(normalizeTitle("Zakon o izmjenama i dopunama Zakona o PDV-u")).toBe("zakon o pdv-u")
    })

    it("removes NN citation suffixes", () => {
      expect(normalizeTitle("Zakon o PDV-u (NN 115/16)")).toBe("zakon o pdv-u")
    })
  })

  describe("extractBaseTitle", () => {
    it("extracts base title from amendment", () => {
      const title = "Zakon o izmjenama i dopunama Zakona o porezu na dohodak"
      expect(extractBaseTitle(title)).toBe("zakon o porezu na dohodak")
    })

    it("returns original for non-amendment", () => {
      const title = "Zakon o porezu na dohodak"
      expect(extractBaseTitle(title)).toBe("zakon o porezu na dohodak")
    })
  })

  describe("computeTitleSimilarity", () => {
    it("returns 1.0 for identical titles", () => {
      expect(computeTitleSimilarity("Zakon o PDV-u", "Zakon o PDV-u")).toBe(1.0)
    })

    it("returns high score for similar titles", () => {
      const score = computeTitleSimilarity(
        "Zakon o porezu na dohodak",
        "Zakon o porezu na dohodak (NN 115/16)"
      )
      expect(score).toBeGreaterThan(0.9)
    })

    it("returns low score for different titles", () => {
      const score = computeTitleSimilarity("Zakon o PDV-u", "Zakon o porezu na dobit")
      expect(score).toBeLessThan(0.5)
    })
  })

  describe("matchByTitle", () => {
    const instruments = [
      { id: "inst-1", title: "Zakon o porezu na dohodak", shortTitle: "ZPD" },
      { id: "inst-2", title: "Zakon o porezu na dodanu vrijednost", shortTitle: "ZPDV" },
      { id: "inst-3", title: "Pravilnik o paušalnom oporezivanju", shortTitle: null },
    ]

    it("finds best match above threshold", async () => {
      const result = await matchByTitle("Zakon o porezu na dohodak", instruments, 0.8)

      expect(result).not.toBeNull()
      expect(result?.instrumentId).toBe("inst-1")
      expect(result?.score).toBeGreaterThan(0.95)
    })

    it("matches amendment to base instrument", async () => {
      const result = await matchByTitle(
        "Zakon o izmjenama Zakona o porezu na dohodak",
        instruments,
        0.8
      )

      expect(result).not.toBeNull()
      expect(result?.instrumentId).toBe("inst-1")
    })

    it("returns null when no match above threshold", async () => {
      const result = await matchByTitle("Zakon o radu", instruments, 0.8)
      expect(result).toBeNull()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/title-matcher.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/matchers/title-matcher.ts`

```typescript
import { InstrumentLinkMethod } from "@prisma/client"
import type { ResolverCandidate } from "../types"

/**
 * Amendment/modification prefixes in Croatian legal titles
 */
const AMENDMENT_PATTERNS = [
  /^zakon o izmjenama i dopunama zakona/i,
  /^zakon o izmjenama zakona/i,
  /^zakon o dopunama zakona/i,
  /^pravilnik o izmjenama i dopunama pravilnika/i,
  /^pravilnik o izmjenama pravilnika/i,
  /^uredba o izmjenama i dopunama uredbe/i,
  /^ispravak/i,
]

/**
 * Patterns to remove from titles for normalization
 */
const CLEANUP_PATTERNS = [
  /\(nn\s*\d+\/\d+[^)]*\)/gi, // (NN 115/16) citations
  /\(nar\.\s*nov\.[^)]*\)/gi, // (Nar. nov. ...) citations
  /\s*-\s*pročišćeni tekst/gi, // Consolidated text suffix
  /\s*-\s*neslužbeni pročišćeni/gi,
  /["„""]/g, // Quotes
  /\s+/g, // Multiple spaces → single
]

/**
 * Normalize title for comparison
 */
export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase().trim()

  // Remove amendment prefixes to get base title
  for (const pattern of AMENDMENT_PATTERNS) {
    normalized = normalized.replace(pattern, "")
  }

  // Clean up patterns
  for (const pattern of CLEANUP_PATTERNS) {
    normalized = normalized.replace(pattern, " ")
  }

  return normalized.trim().replace(/\s+/g, " ")
}

/**
 * Extract the base title from an amendment title
 *
 * "Zakon o izmjenama i dopunama Zakona o porezu na dohodak"
 * → "zakon o porezu na dohodak"
 */
export function extractBaseTitle(title: string): string {
  const lower = title.toLowerCase()

  // Pattern: "o izmjenama [i dopunama] {type} o ..."
  const match = lower.match(
    /o\s+(?:izmjenama\s+(?:i\s+dopunama\s+)?)?(?:zakona|pravilnika|uredbe|odluke|naredbe)\s+(.+)/i
  )

  if (match) {
    // Reconstruct base title
    const typeMatch = lower.match(/(zakona|pravilnika|uredbe|odluke|naredbe)/i)
    const type = typeMatch ? typeMatch[1].replace(/a$/, "") : "zakon"
    return (type + " " + match[1]).replace(/\s+/g, " ").trim()
  }

  return normalizeTitle(title)
}

/**
 * Compute similarity between two titles (0.0 - 1.0)
 *
 * Uses Levenshtein-based similarity with Croatian-specific normalization
 */
export function computeTitleSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1)
  const norm2 = normalizeTitle(title2)

  if (norm1 === norm2) return 1.0

  // Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2)
  const maxLen = Math.max(norm1.length, norm2.length)

  if (maxLen === 0) return 1.0

  return 1 - distance / maxLen
}

/**
 * Classic Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[a.length][b.length]
}

/**
 * Match evidence title against instruments
 *
 * @param evidenceTitle - Title from evidence metadata
 * @param instruments - Instruments to match against
 * @param threshold - Minimum similarity score to consider
 * @returns Best matching candidate or null
 */
export async function matchByTitle(
  evidenceTitle: string,
  instruments: Array<{ id: string; title: string; shortTitle: string | null }>,
  threshold: number
): Promise<ResolverCandidate | null> {
  const normalizedEvidence = normalizeTitle(evidenceTitle)
  const baseTitle = extractBaseTitle(evidenceTitle)

  let bestMatch: ResolverCandidate | null = null
  let bestScore = threshold

  for (const instrument of instruments) {
    // Compare with full title
    const titleScore = computeTitleSimilarity(evidenceTitle, instrument.title)

    // Compare with base title (for amendments)
    const baseScore = computeTitleSimilarity(baseTitle, instrument.title)

    // Compare with short title if available
    let shortScore = 0
    if (instrument.shortTitle) {
      shortScore = computeTitleSimilarity(evidenceTitle, instrument.shortTitle)
    }

    const maxScore = Math.max(titleScore, baseScore, shortScore)

    if (maxScore > bestScore) {
      bestScore = maxScore
      bestMatch = {
        instrumentId: instrument.id,
        score: maxScore,
        method: InstrumentLinkMethod.TITLE_FUZZY,
        matchMeta: {
          evidenceTitle,
          instrumentTitle: instrument.title,
          normalizedEvidence,
          titleScore,
          baseScore,
          shortScore,
          matchedOn:
            titleScore >= baseScore && titleScore >= shortScore
              ? "title"
              : baseScore >= shortScore
                ? "base"
                : "short",
        },
      }
    }
  }

  return bestMatch
}

/**
 * Find all matches above threshold (for ambiguity detection)
 */
export async function findAllTitleMatches(
  evidenceTitle: string,
  instruments: Array<{ id: string; title: string; shortTitle: string | null }>,
  threshold: number
): Promise<ResolverCandidate[]> {
  const results: ResolverCandidate[] = []
  const baseTitle = extractBaseTitle(evidenceTitle)

  for (const instrument of instruments) {
    const titleScore = computeTitleSimilarity(evidenceTitle, instrument.title)
    const baseScore = computeTitleSimilarity(baseTitle, instrument.title)
    const maxScore = Math.max(titleScore, baseScore)

    if (maxScore >= threshold) {
      results.push({
        instrumentId: instrument.id,
        score: maxScore,
        method: InstrumentLinkMethod.TITLE_FUZZY,
        matchMeta: {
          evidenceTitle,
          instrumentTitle: instrument.title,
          titleScore,
          baseScore,
        },
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/matchers/__tests__/title-matcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement title fuzzy matcher

Croatian-specific title normalization (amendments, citations).
Levenshtein-based similarity scoring.
Handles amendment→base title extraction.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B4: Implement Event Type Classifier

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/event-classifier.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/event-classifier.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { classifyEventType } from "../event-classifier"
import { InstrumentEventType } from "@prisma/client"

describe("Event Type Classifier", () => {
  describe("ORIGINAL detection", () => {
    it("classifies base law as ORIGINAL", () => {
      const result = classifyEventType({
        title: "Zakon o porezu na dohodak",
        textType: "zakon",
      })
      expect(result.eventType).toBe(InstrumentEventType.ORIGINAL)
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it("classifies base pravilnik as ORIGINAL", () => {
      const result = classifyEventType({
        title: "Pravilnik o paušalnom oporezivanju",
        textType: "pravilnik",
      })
      expect(result.eventType).toBe(InstrumentEventType.ORIGINAL)
    })
  })

  describe("AMENDMENT detection", () => {
    it("classifies 'izmjene i dopune' as AMENDMENT", () => {
      const result = classifyEventType({
        title: "Zakon o izmjenama i dopunama Zakona o PDV-u",
      })
      expect(result.eventType).toBe(InstrumentEventType.AMENDMENT)
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it("classifies 'izmjene' only as AMENDMENT", () => {
      const result = classifyEventType({
        title: "Zakon o izmjenama Zakona o radu",
      })
      expect(result.eventType).toBe(InstrumentEventType.AMENDMENT)
    })
  })

  describe("CONSOLIDATED detection", () => {
    it("classifies 'pročišćeni tekst' as CONSOLIDATED", () => {
      const result = classifyEventType({
        title: "Zakon o PDV-u - pročišćeni tekst",
      })
      expect(result.eventType).toBe(InstrumentEventType.CONSOLIDATED)
    })
  })

  describe("CORRECTION detection", () => {
    it("classifies 'ispravak' as CORRECTION", () => {
      const result = classifyEventType({
        title: "Ispravak Zakona o porezu na dohodak",
      })
      expect(result.eventType).toBe(InstrumentEventType.CORRECTION)
    })
  })

  describe("REPEAL detection", () => {
    it("classifies 'prestanak važenja' as REPEAL", () => {
      const result = classifyEventType({
        title: "Odluka o prestanku važenja Pravilnika X",
      })
      expect(result.eventType).toBe(InstrumentEventType.REPEAL)
    })

    it("classifies 'stavlja se izvan snage' as REPEAL", () => {
      const result = classifyEventType({
        title: "Odluka kojom se stavlja izvan snage Uredba Y",
      })
      expect(result.eventType).toBe(InstrumentEventType.REPEAL)
    })
  })

  describe("UNKNOWN fallback", () => {
    it("returns UNKNOWN with low confidence for unclear titles", () => {
      const result = classifyEventType({
        title: "Dokument",
      })
      expect(result.eventType).toBe(InstrumentEventType.UNKNOWN)
      expect(result.confidence).toBeLessThan(0.5)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/event-classifier.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/event-classifier.ts`

```typescript
import { InstrumentEventType } from "@prisma/client"
import type { EventTypeClassification, DocumentMetaForResolution } from "./types"

/**
 * Classification rules with patterns and confidence
 */
interface ClassificationRule {
  eventType: InstrumentEventType
  patterns: RegExp[]
  confidence: number
  priority: number // Higher = checked first
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // CONSOLIDATED - highest priority (overrides amendment signals)
  {
    eventType: InstrumentEventType.CONSOLIDATED,
    patterns: [/pročišćeni\s+tekst/i, /konsolidirani\s+tekst/i, /neslužbeni\s+pročišćeni/i],
    confidence: 0.95,
    priority: 100,
  },

  // CORRECTION - before amendment (ispravak is specific)
  {
    eventType: InstrumentEventType.CORRECTION,
    patterns: [/^ispravak/i, /ispravak\s+(zakona|pravilnika|uredbe|odluke)/i],
    confidence: 0.95,
    priority: 90,
  },

  // REPEAL
  {
    eventType: InstrumentEventType.REPEAL,
    patterns: [
      /prestanak\s+važenja/i,
      /stavlja\s+se\s+izvan\s+snage/i,
      /prestaje\s+važiti/i,
      /ukida\s+se/i,
    ],
    confidence: 0.9,
    priority: 80,
  },

  // INTERPRETATION
  {
    eventType: InstrumentEventType.INTERPRETATION,
    patterns: [/autentično\s+tumačenje/i, /tumačenje\s+(zakona|pravilnika)/i],
    confidence: 0.9,
    priority: 75,
  },

  // DECISION
  {
    eventType: InstrumentEventType.DECISION,
    patterns: [/^odluka\s+o\s+proglašenju/i, /^odluka\s+ustavnog\s+suda/i],
    confidence: 0.85,
    priority: 70,
  },

  // AMENDMENT
  {
    eventType: InstrumentEventType.AMENDMENT,
    patterns: [
      /o\s+izmjenama\s+i\s+dopunama/i,
      /o\s+izmjenama\s+(zakona|pravilnika|uredbe)/i,
      /o\s+dopunama\s+(zakona|pravilnika|uredbe)/i,
      /o\s+dopuni\s+(zakona|pravilnika|uredbe)/i,
      /o\s+izmjeni\s+(zakona|pravilnika|uredbe)/i,
    ],
    confidence: 0.95,
    priority: 60,
  },

  // ORIGINAL - base documents without modification signals
  {
    eventType: InstrumentEventType.ORIGINAL,
    patterns: [
      /^zakon\s+o\s+(?!izmjen)/i, // "Zakon o" NOT followed by "izmjen"
      /^pravilnik\s+o\s+(?!izmjen)/i,
      /^uredba\s+o\s+(?!izmjen)/i,
      /^odluka\s+o\s+(?!izmjen|proglašenju)/i,
      /^naredba\s+o\s+(?!izmjen)/i,
    ],
    confidence: 0.8,
    priority: 50,
  },
]

/**
 * Classify event type from document metadata
 */
export function classifyEventType(meta: DocumentMetaForResolution): EventTypeClassification {
  const title = meta.title || ""
  const signals: string[] = []

  // Sort rules by priority (highest first)
  const sortedRules = [...CLASSIFICATION_RULES].sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(title)) {
        signals.push(`title matches: ${pattern.source}`)

        return {
          eventType: rule.eventType,
          confidence: rule.confidence,
          signals,
        }
      }
    }
  }

  // Fallback: check text type for ORIGINAL
  if (meta.textType) {
    const baseTypes = ["zakon", "pravilnik", "uredba", "odluka", "naredba"]
    if (baseTypes.includes(meta.textType.toLowerCase())) {
      return {
        eventType: InstrumentEventType.ORIGINAL,
        confidence: 0.7,
        signals: [`textType is ${meta.textType} (assumed original)`],
      }
    }
  }

  // Cannot determine
  return {
    eventType: InstrumentEventType.UNKNOWN,
    confidence: 0.3,
    signals: ["no classification signals found"],
  }
}

/**
 * Check if event type indicates this is a new version of base instrument
 */
export function isModificationEvent(eventType: InstrumentEventType): boolean {
  return [
    InstrumentEventType.AMENDMENT,
    InstrumentEventType.CORRECTION,
    InstrumentEventType.CONSOLIDATED,
    InstrumentEventType.INTERPRETATION,
  ].includes(eventType)
}

/**
 * Check if event type indicates end of instrument lifecycle
 */
export function isTerminalEvent(eventType: InstrumentEventType): boolean {
  return eventType === InstrumentEventType.REPEAL
}

/**
 * Get human-readable Croatian label for event type
 */
export function getEventTypeLabel(eventType: InstrumentEventType): string {
  const labels: Record<InstrumentEventType, string> = {
    ORIGINAL: "Izvorni tekst",
    AMENDMENT: "Izmjene i dopune",
    CONSOLIDATED: "Pročišćeni tekst",
    CORRECTION: "Ispravak",
    DECISION: "Odluka",
    INTERPRETATION: "Autentično tumačenje",
    REPEAL: "Prestanak važenja",
    UNKNOWN: "Nepoznato",
  }
  return labels[eventType]
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/event-classifier.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement event type classifier

Pattern-based classification with priority ordering.
Handles ORIGINAL, AMENDMENT, CONSOLIDATED, CORRECTION, REPEAL, etc.
Croatian-specific patterns for legal document titles.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B5: Implement Resolver Orchestrator

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/resolver.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/resolver.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { InstrumentResolver } from "../resolver"
import {
  InstrumentLinkMethod,
  InstrumentLinkConfidence,
  ResolutionFailReason,
} from "@prisma/client"

describe("InstrumentResolver", () => {
  const mockInstruments = [
    {
      id: "inst-1",
      canonicalId: "hr:zakon:pdv",
      title: "Zakon o porezu na dodanu vrijednost",
      shortTitle: "ZPDV",
      eliUri: "eli/hr/zakon/2024/100/1000/cro",
    },
    {
      id: "inst-2",
      canonicalId: "hr:zakon:porez-dohodak",
      title: "Zakon o porezu na dohodak",
      shortTitle: "ZPD",
      eliUri: null,
    },
  ]

  let resolver: InstrumentResolver

  beforeEach(() => {
    resolver = new InstrumentResolver({
      highConfidenceThreshold: 0.95,
      mediumConfidenceThreshold: 0.85,
      minimumMatchThreshold: 0.7,
      allowCreateInstrument: false,
      preferEliOverTitle: true,
      maxCandidates: 10,
      resolverVersion: "test-v1",
    })
  })

  describe("resolve with ELI", () => {
    it("matches by ELI with HIGH confidence", async () => {
      const result = await resolver.resolve(
        {
          evidenceId: "ev-1",
          docMeta: {
            eli: "eli/hr/zakon/2024/100/1000/cro",
            title: "Some title",
          },
        },
        mockInstruments
      )

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.instrumentId).toBe("inst-1")
        expect(result.method).toBe(InstrumentLinkMethod.ELI)
        expect(result.confidence).toBe(InstrumentLinkConfidence.HIGH)
      }
    })
  })

  describe("resolve with title", () => {
    it("matches by title with MEDIUM confidence when score >= 0.85", async () => {
      const result = await resolver.resolve(
        {
          evidenceId: "ev-1",
          docMeta: {
            title: "Zakon o porezu na dohodak",
          },
        },
        mockInstruments
      )

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.instrumentId).toBe("inst-2")
        expect(result.method).toBe(InstrumentLinkMethod.TITLE_FUZZY)
        expect(result.confidence).toBe(InstrumentLinkConfidence.HIGH)
      }
    })

    it("matches amendment to base instrument", async () => {
      const result = await resolver.resolve(
        {
          evidenceId: "ev-1",
          docMeta: {
            title: "Zakon o izmjenama Zakona o porezu na dohodak",
          },
        },
        mockInstruments
      )

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.instrumentId).toBe("inst-2")
      }
    })
  })

  describe("resolution failures", () => {
    it("fails with NO_ELI when no match possible", async () => {
      const result = await resolver.resolve(
        {
          evidenceId: "ev-1",
          docMeta: {
            title: "Completely unrelated document",
          },
        },
        mockInstruments
      )

      expect(result.resolved).toBe(false)
      if (!result.resolved) {
        expect(result.failReason).toBe(ResolutionFailReason.LOW_SCORE)
      }
    })

    it("fails with AMBIGUOUS when multiple equal matches", async () => {
      // Create instruments with similar titles
      const ambiguousInstruments = [
        { id: "i1", canonicalId: "c1", title: "Zakon o X", shortTitle: null, eliUri: null },
        { id: "i2", canonicalId: "c2", title: "Zakon o X", shortTitle: null, eliUri: null },
      ]

      const result = await resolver.resolve(
        {
          evidenceId: "ev-1",
          docMeta: { title: "Zakon o X" },
        },
        ambiguousInstruments
      )

      expect(result.resolved).toBe(false)
      if (!result.resolved) {
        expect(result.failReason).toBe(ResolutionFailReason.AMBIGUOUS)
      }
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/resolver.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/resolver.ts`

```typescript
import {
  InstrumentLinkMethod,
  InstrumentLinkConfidence,
  ResolutionFailReason,
} from "@prisma/client"
import type {
  ResolverInput,
  ResolverOutput,
  ResolverCandidate,
  ResolverConfig,
  DEFAULT_RESOLVER_CONFIG,
} from "./types"
import { matchByEli, buildEliFromMetadata, extractEliFromContent } from "./matchers/eli-matcher"
import { matchByTitle, findAllTitleMatches } from "./matchers/title-matcher"

export class InstrumentResolver {
  private config: ResolverConfig

  constructor(config: Partial<ResolverConfig> = {}) {
    this.config = { ...DEFAULT_RESOLVER_CONFIG, ...config }
  }

  /**
   * Resolve evidence to an instrument
   */
  async resolve(
    input: ResolverInput,
    instruments: Array<{
      id: string
      canonicalId: string
      title: string
      shortTitle: string | null
      eliUri: string | null
    }>
  ): Promise<ResolverOutput> {
    const candidates: ResolverCandidate[] = []

    // Step 1: Try ELI match (highest priority)
    const eliMatch = await this.tryEliMatch(input, instruments)
    if (eliMatch) {
      candidates.push(eliMatch)

      // ELI match is definitive
      return {
        resolved: true,
        instrumentId: eliMatch.instrumentId,
        confidence: InstrumentLinkConfidence.HIGH,
        method: InstrumentLinkMethod.ELI,
        matchMeta: eliMatch.matchMeta,
        candidates,
      }
    }

    // Step 2: Try title match
    const titleCandidates = await this.tryTitleMatch(input, instruments)
    candidates.push(...titleCandidates)

    // Step 3: Evaluate candidates
    return this.evaluateCandidates(candidates, input)
  }

  /**
   * Try to match by ELI
   */
  private async tryEliMatch(
    input: ResolverInput,
    instruments: Array<{ id: string; eliUri: string | null }>
  ): Promise<ResolverCandidate | null> {
    // Check docMeta.eli first
    if (input.docMeta.eli) {
      const match = await matchByEli(input.docMeta.eli, instruments)
      if (match) return match
    }

    // Try to build ELI from metadata
    const builtEli = buildEliFromMetadata(input.docMeta)
    if (builtEli) {
      const match = await matchByEli(builtEli, instruments)
      if (match) {
        return {
          ...match,
          matchMeta: { ...match.matchMeta, eliSource: "built_from_metadata" },
        }
      }
    }

    return null
  }

  /**
   * Try to match by title
   */
  private async tryTitleMatch(
    input: ResolverInput,
    instruments: Array<{ id: string; title: string; shortTitle: string | null }>
  ): Promise<ResolverCandidate[]> {
    if (!input.docMeta.title) return []

    return findAllTitleMatches(input.docMeta.title, instruments, this.config.minimumMatchThreshold)
  }

  /**
   * Evaluate candidates and return resolution result
   */
  private evaluateCandidates(
    candidates: ResolverCandidate[],
    input: ResolverInput
  ): ResolverOutput {
    if (candidates.length === 0) {
      return {
        resolved: false,
        failReason: ResolutionFailReason.LOW_SCORE,
        failDetail: "No candidates found above minimum threshold",
        candidates: [],
      }
    }

    // Sort by score descending
    const sorted = [...candidates].sort((a, b) => b.score - a.score)
    const best = sorted[0]

    // Check for ambiguity: multiple candidates with similar top scores
    const ambiguityThreshold = 0.02
    const topTier = sorted.filter((c) => c.score >= best.score - ambiguityThreshold)

    if (topTier.length > 1) {
      // Check if they're actually different instruments
      const uniqueInstruments = new Set(topTier.map((c) => c.instrumentId))
      if (uniqueInstruments.size > 1) {
        return {
          resolved: false,
          failReason: ResolutionFailReason.AMBIGUOUS,
          failDetail: `${uniqueInstruments.size} instruments matched with similar scores: ${Array.from(uniqueInstruments).join(", ")}`,
          candidates: sorted.slice(0, this.config.maxCandidates),
        }
      }
    }

    // Determine confidence level
    const confidence = this.scoreToConfidence(best.score)

    return {
      resolved: true,
      instrumentId: best.instrumentId,
      confidence,
      method: best.method,
      matchMeta: best.matchMeta,
      candidates: sorted.slice(0, this.config.maxCandidates),
    }
  }

  /**
   * Convert score to confidence level
   */
  private scoreToConfidence(score: number): InstrumentLinkConfidence {
    if (score >= this.config.highConfidenceThreshold) {
      return InstrumentLinkConfidence.HIGH
    }
    if (score >= this.config.mediumConfidenceThreshold) {
      return InstrumentLinkConfidence.MEDIUM
    }
    return InstrumentLinkConfidence.LOW
  }

  /**
   * Get resolver version for audit trail
   */
  getVersion(): string {
    return this.config.resolverVersion
  }
}

// Re-export for convenience
export { DEFAULT_RESOLVER_CONFIG } from "./types"
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/resolver.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement resolver orchestrator

Combines ELI and title matching with priority ordering.
Handles ambiguity detection for multiple similar matches.
Converts scores to confidence levels per thresholds.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B6: Implement Timeline Builder

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/timeline.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/timeline.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { buildTimeline, orderTimelineEntries, detectGaps } from "../timeline"
import { InstrumentEventType, InstrumentLinkConfidence } from "@prisma/client"
import type { TimelineEntry } from "../types"

describe("Timeline Builder", () => {
  const mockEntries: TimelineEntry[] = [
    {
      evidenceId: "ev-1",
      eventType: InstrumentEventType.ORIGINAL,
      publishedAt: new Date("2020-01-15"),
      effectiveFrom: new Date("2020-02-01"),
      effectiveUntil: null,
      confidence: InstrumentLinkConfidence.HIGH,
      title: "Zakon o X",
    },
    {
      evidenceId: "ev-2",
      eventType: InstrumentEventType.AMENDMENT,
      publishedAt: new Date("2021-06-20"),
      effectiveFrom: new Date("2021-07-01"),
      effectiveUntil: null,
      confidence: InstrumentLinkConfidence.HIGH,
      title: "Zakon o izmjenama Zakona o X",
    },
    {
      evidenceId: "ev-3",
      eventType: InstrumentEventType.AMENDMENT,
      publishedAt: new Date("2022-03-10"),
      effectiveFrom: new Date("2022-04-01"),
      effectiveUntil: null,
      confidence: InstrumentLinkConfidence.MEDIUM,
      title: "Zakon o izmjenama i dopunama Zakona o X",
    },
  ]

  describe("orderTimelineEntries", () => {
    it("orders by publishedAt ascending", () => {
      const shuffled = [mockEntries[2], mockEntries[0], mockEntries[1]]
      const ordered = orderTimelineEntries(shuffled)

      expect(ordered[0].evidenceId).toBe("ev-1")
      expect(ordered[1].evidenceId).toBe("ev-2")
      expect(ordered[2].evidenceId).toBe("ev-3")
    })

    it("uses eventType priority for same date", () => {
      const sameDate: TimelineEntry[] = [
        { ...mockEntries[0], eventType: InstrumentEventType.AMENDMENT },
        { ...mockEntries[0], eventType: InstrumentEventType.ORIGINAL, evidenceId: "ev-0" },
      ]

      const ordered = orderTimelineEntries(sameDate)
      expect(ordered[0].eventType).toBe(InstrumentEventType.ORIGINAL)
    })
  })

  describe("buildTimeline", () => {
    it("builds complete timeline with coverage", () => {
      const timeline = buildTimeline({
        instrumentId: "inst-1",
        canonicalId: "hr:zakon:x",
        title: "Zakon o X",
        entries: mockEntries,
      })

      expect(timeline.entries).toHaveLength(3)
      expect(timeline.coverage.startDate).toEqual(new Date("2020-01-15"))
      expect(timeline.coverage.endDate).toEqual(new Date("2022-03-10"))
    })
  })

  describe("detectGaps", () => {
    it("detects large time gaps", () => {
      const entriesWithGap: TimelineEntry[] = [
        {
          ...mockEntries[0],
          publishedAt: new Date("2010-01-01"),
        },
        {
          ...mockEntries[1],
          publishedAt: new Date("2020-01-01"), // 10 year gap
        },
      ]

      const gaps = detectGaps(entriesWithGap, { maxGapDays: 365 * 5 }) // 5 year threshold

      expect(gaps.length).toBeGreaterThan(0)
      expect(gaps[0].startDate).toEqual(new Date("2010-01-01"))
      expect(gaps[0].endDate).toEqual(new Date("2020-01-01"))
    })

    it("returns empty for continuous timeline", () => {
      const gaps = detectGaps(mockEntries, { maxGapDays: 365 * 5 })
      expect(gaps).toHaveLength(0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/timeline.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/timeline.ts`

```typescript
import { InstrumentEventType } from "@prisma/client"
import type { TimelineEntry, InstrumentTimeline } from "./types"

/**
 * Event type priority for ordering (lower = earlier in timeline for same date)
 */
const EVENT_TYPE_PRIORITY: Record<InstrumentEventType, number> = {
  ORIGINAL: 0,
  DECISION: 1,
  AMENDMENT: 2,
  CORRECTION: 3,
  INTERPRETATION: 4,
  CONSOLIDATED: 5,
  REPEAL: 6,
  UNKNOWN: 99,
}

/**
 * Order timeline entries by publication date, then by event type priority
 */
export function orderTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    // Primary sort: publishedAt ascending
    const dateA = a.publishedAt?.getTime() ?? 0
    const dateB = b.publishedAt?.getTime() ?? 0

    if (dateA !== dateB) {
      return dateA - dateB
    }

    // Secondary sort: event type priority
    const priorityA = EVENT_TYPE_PRIORITY[a.eventType]
    const priorityB = EVENT_TYPE_PRIORITY[b.eventType]

    return priorityA - priorityB
  })
}

/**
 * Build a complete instrument timeline
 */
export function buildTimeline(params: {
  instrumentId: string
  canonicalId: string
  title: string
  entries: TimelineEntry[]
}): InstrumentTimeline {
  const { instrumentId, canonicalId, title, entries } = params

  const ordered = orderTimelineEntries(entries)

  // Compute coverage
  const dates = ordered.map((e) => e.publishedAt).filter((d): d is Date => d !== null)

  const startDate = dates.length > 0 ? dates[0] : null
  const endDate = dates.length > 0 ? dates[dates.length - 1] : null

  // Detect gaps
  const gaps = detectGaps(ordered, { maxGapDays: 365 * 5 }) // 5 years

  return {
    instrumentId,
    canonicalId,
    title,
    entries: ordered,
    coverage: {
      startDate,
      endDate,
      hasGaps: gaps.length > 0,
      gapCount: gaps.length,
    },
  }
}

/**
 * Gap detection result
 */
export interface TimelineGap {
  startDate: Date
  endDate: Date
  durationDays: number
  afterEntry: TimelineEntry
  beforeEntry: TimelineEntry
}

/**
 * Detect significant gaps in timeline
 */
export function detectGaps(
  entries: TimelineEntry[],
  options: { maxGapDays: number }
): TimelineGap[] {
  const ordered = orderTimelineEntries(entries)
  const gaps: TimelineGap[] = []

  for (let i = 0; i < ordered.length - 1; i++) {
    const current = ordered[i]
    const next = ordered[i + 1]

    if (!current.publishedAt || !next.publishedAt) continue

    const durationMs = next.publishedAt.getTime() - current.publishedAt.getTime()
    const durationDays = durationMs / (1000 * 60 * 60 * 24)

    if (durationDays > options.maxGapDays) {
      gaps.push({
        startDate: current.publishedAt,
        endDate: next.publishedAt,
        durationDays,
        afterEntry: current,
        beforeEntry: next,
      })
    }
  }

  return gaps
}

/**
 * Get the latest effective version from timeline
 */
export function getLatestEffectiveEntry(entries: TimelineEntry[]): TimelineEntry | null {
  const ordered = orderTimelineEntries(entries)

  // Find the last entry that has become effective
  const now = new Date()
  let latest: TimelineEntry | null = null

  for (const entry of ordered) {
    if (entry.effectiveFrom && entry.effectiveFrom <= now) {
      latest = entry
    }
  }

  return latest
}

/**
 * Find the ORIGINAL entry in timeline
 */
export function findOriginalEntry(entries: TimelineEntry[]): TimelineEntry | null {
  return entries.find((e) => e.eventType === InstrumentEventType.ORIGINAL) ?? null
}

/**
 * Check if instrument is repealed
 */
export function isRepealed(entries: TimelineEntry[]): boolean {
  return entries.some((e) => e.eventType === InstrumentEventType.REPEAL)
}

/**
 * Get amendment count
 */
export function getAmendmentCount(entries: TimelineEntry[]): number {
  return entries.filter((e) => e.eventType === InstrumentEventType.AMENDMENT).length
}

/**
 * Get timeline summary for display
 */
export interface TimelineSummary {
  originalDate: Date | null
  latestAmendmentDate: Date | null
  amendmentCount: number
  isRepealed: boolean
  repealDate: Date | null
}

export function getTimelineSummary(entries: TimelineEntry[]): TimelineSummary {
  const original = findOriginalEntry(entries)
  const amendments = entries.filter((e) => e.eventType === InstrumentEventType.AMENDMENT)
  const repeal = entries.find((e) => e.eventType === InstrumentEventType.REPEAL)

  const latestAmendment =
    amendments.length > 0 ? orderTimelineEntries(amendments)[amendments.length - 1] : null

  return {
    originalDate: original?.publishedAt ?? null,
    latestAmendmentDate: latestAmendment?.publishedAt ?? null,
    amendmentCount: amendments.length,
    isRepealed: !!repeal,
    repealDate: repeal?.publishedAt ?? null,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/timeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement timeline builder

Orders entries by publication date and event type priority.
Detects gaps exceeding configurable threshold.
Provides timeline summary helpers (amendments, repeal status).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B7: Implement Coverage Computer

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/coverage.ts`
- Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/coverage.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { computeCoverage, detectMissingIssues } from "../coverage"
import { InstrumentEventType, InstrumentLinkConfidence } from "@prisma/client"
import type { TimelineEntry } from "../types"

describe("Coverage Computer", () => {
  describe("computeCoverage", () => {
    it("computes basic coverage from entries", () => {
      const entries: TimelineEntry[] = [
        {
          evidenceId: "ev-1",
          eventType: InstrumentEventType.ORIGINAL,
          publishedAt: new Date("2020-01-15"),
          effectiveFrom: new Date("2020-02-01"),
          effectiveUntil: null,
          confidence: InstrumentLinkConfidence.HIGH,
        },
        {
          evidenceId: "ev-2",
          eventType: InstrumentEventType.AMENDMENT,
          publishedAt: new Date("2022-06-20"),
          effectiveFrom: null,
          effectiveUntil: null,
          confidence: InstrumentLinkConfidence.HIGH,
        },
      ]

      const coverage = computeCoverage("inst-1", entries)

      expect(coverage.instrumentId).toBe("inst-1")
      expect(coverage.startDate).toEqual(new Date("2020-01-15"))
      expect(coverage.endDate).toEqual(new Date("2022-06-20"))
      expect(coverage.startEvidenceId).toBe("ev-1")
      expect(coverage.startType).toBe(InstrumentEventType.ORIGINAL)
    })

    it("handles empty entries", () => {
      const coverage = computeCoverage("inst-1", [])

      expect(coverage.startDate).toBeNull()
      expect(coverage.endDate).toBeNull()
    })
  })

  describe("detectMissingIssues", () => {
    it("detects year gaps in coverage", () => {
      const entriesWithGap: Array<{ nnYear: number; nnIssue: number }> = [
        { nnYear: 2020, nnIssue: 10 },
        { nnYear: 2020, nnIssue: 50 },
        // Missing 2021 entirely
        { nnYear: 2022, nnIssue: 30 },
      ]

      const missing = detectMissingIssues(entriesWithGap)

      expect(missing.some((m) => m.nnYear === 2021)).toBe(true)
    })

    it("returns empty for continuous years", () => {
      const continuous: Array<{ nnYear: number; nnIssue: number }> = [
        { nnYear: 2020, nnIssue: 10 },
        { nnYear: 2021, nnIssue: 20 },
        { nnYear: 2022, nnIssue: 30 },
      ]

      const missing = detectMissingIssues(continuous)

      expect(missing).toHaveLength(0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/coverage.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/instrument-resolver/coverage.ts`

```typescript
import { InstrumentEventType } from "@prisma/client"
import type { TimelineEntry } from "./types"
import { orderTimelineEntries, findOriginalEntry, detectGaps } from "./timeline"

/**
 * Coverage computation result (matches InstrumentCoverage model structure)
 */
export interface CoverageResult {
  instrumentId: string
  startDate: Date | null
  endDate: Date | null
  startEvidenceId: string | null
  startType: InstrumentEventType
  gapNote: string | null
  missingIssues: MissingIssue[]
  computedBy: string
}

export interface MissingIssue {
  nnYear: number
  nnIssue: number | null // null = entire year missing
  reason: string
}

const COVERAGE_VERSION = "coverage-computer-v1.0.0"

/**
 * Compute coverage for an instrument from its linked evidence
 */
export function computeCoverage(instrumentId: string, entries: TimelineEntry[]): CoverageResult {
  if (entries.length === 0) {
    return {
      instrumentId,
      startDate: null,
      endDate: null,
      startEvidenceId: null,
      startType: InstrumentEventType.UNKNOWN,
      gapNote: "No linked evidence",
      missingIssues: [],
      computedBy: COVERAGE_VERSION,
    }
  }

  const ordered = orderTimelineEntries(entries)

  // Find bounds
  const dates = ordered.map((e) => e.publishedAt).filter((d): d is Date => d !== null)

  const startDate = dates.length > 0 ? dates[0] : null
  const endDate = dates.length > 0 ? dates[dates.length - 1] : null

  // Find original
  const original = findOriginalEntry(entries)
  const startEntry = original ?? ordered[0]

  // Detect gaps
  const gaps = detectGaps(ordered, { maxGapDays: 365 * 3 }) // 3 year threshold
  let gapNote: string | null = null

  if (gaps.length > 0) {
    const gapDescriptions = gaps.map(
      (g) =>
        `${g.startDate.toISOString().slice(0, 10)} to ${g.endDate.toISOString().slice(0, 10)} (${Math.round(g.durationDays)} days)`
    )
    gapNote = `${gaps.length} gap(s) detected: ${gapDescriptions.join("; ")}`
  }

  return {
    instrumentId,
    startDate,
    endDate,
    startEvidenceId: startEntry.evidenceId,
    startType: startEntry.eventType,
    gapNote,
    missingIssues: [], // Filled by detectMissingIssues if metadata available
    computedBy: COVERAGE_VERSION,
  }
}

/**
 * Detect potentially missing NN issues in the timeline
 */
export function detectMissingIssues(
  entries: Array<{ nnYear: number; nnIssue: number }>
): MissingIssue[] {
  if (entries.length < 2) return []

  const missing: MissingIssue[] = []

  // Get year range
  const years = entries.map((e) => e.nnYear)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  // Check for missing years
  const yearSet = new Set(years)
  for (let year = minYear; year <= maxYear; year++) {
    if (!yearSet.has(year)) {
      missing.push({
        nnYear: year,
        nnIssue: null,
        reason: "entire_year_missing",
      })
    }
  }

  return missing
}

/**
 * Full coverage analysis with metadata
 */
export interface CoverageAnalysis {
  coverage: CoverageResult
  stats: {
    totalEntries: number
    originalCount: number
    amendmentCount: number
    consolidatedCount: number
    correctionCount: number
    otherCount: number
  }
  quality: {
    hasOriginal: boolean
    hasRecentActivity: boolean // Activity in last 2 years
    confidenceDistribution: {
      high: number
      medium: number
      low: number
    }
  }
}

export function analyzeCoverage(instrumentId: string, entries: TimelineEntry[]): CoverageAnalysis {
  const coverage = computeCoverage(instrumentId, entries)

  // Count by type
  const stats = {
    totalEntries: entries.length,
    originalCount: entries.filter((e) => e.eventType === InstrumentEventType.ORIGINAL).length,
    amendmentCount: entries.filter((e) => e.eventType === InstrumentEventType.AMENDMENT).length,
    consolidatedCount: entries.filter((e) => e.eventType === InstrumentEventType.CONSOLIDATED)
      .length,
    correctionCount: entries.filter((e) => e.eventType === InstrumentEventType.CORRECTION).length,
    otherCount: entries.filter(
      (e) =>
        ![
          InstrumentEventType.ORIGINAL,
          InstrumentEventType.AMENDMENT,
          InstrumentEventType.CONSOLIDATED,
          InstrumentEventType.CORRECTION,
        ].includes(e.eventType)
    ).length,
  }

  // Quality checks
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const hasRecentActivity = entries.some((e) => e.publishedAt && e.publishedAt >= twoYearsAgo)

  const confidenceDistribution = {
    high: entries.filter((e) => e.confidence === "HIGH").length,
    medium: entries.filter((e) => e.confidence === "MEDIUM").length,
    low: entries.filter((e) => e.confidence === "LOW").length,
  }

  return {
    coverage,
    stats,
    quality: {
      hasOriginal: stats.originalCount > 0,
      hasRecentActivity,
      confidenceDistribution,
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/coverage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): implement coverage computer

Computes timeline bounds and detects gaps.
Identifies missing NN years in coverage.
Provides coverage quality analysis (confidence distribution, recency).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B8: Create Resolver Entrypoint and Index

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/index.ts`

**Step 1: Write the entrypoint**

```typescript
// Re-export types
export * from "./types"

// Re-export resolver
export { InstrumentResolver, DEFAULT_RESOLVER_CONFIG } from "./resolver"

// Re-export matchers
export {
  parseEli,
  normalizeEli,
  buildEliFromMetadata,
  extractEliFromContent,
  matchByEli,
} from "./matchers/eli-matcher"

export {
  normalizeTitle,
  extractBaseTitle,
  computeTitleSimilarity,
  matchByTitle,
  findAllTitleMatches,
} from "./matchers/title-matcher"

// Re-export event classifier
export {
  classifyEventType,
  isModificationEvent,
  isTerminalEvent,
  getEventTypeLabel,
} from "./event-classifier"

// Re-export timeline
export {
  orderTimelineEntries,
  buildTimeline,
  detectGaps,
  getLatestEffectiveEntry,
  findOriginalEntry,
  isRepealed,
  getAmendmentCount,
  getTimelineSummary,
} from "./timeline"

// Re-export coverage
export { computeCoverage, detectMissingIssues, analyzeCoverage } from "./coverage"

// Version constant
export const RESOLVER_VERSION = "resolver-v1.0.0"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/
git commit -m "feat(instrument-resolver): add module entrypoint

Re-exports all public APIs from instrument-resolver.
Single import point for consumers.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B9: Create Resolver Pipeline Script

**Files:**

- Create: `scripts/run-instrument-resolver.ts`

**Step 1: Write the script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Run Instrument Resolver on a ParsedDocument
 *
 * Usage: npx tsx scripts/run-instrument-resolver.ts <evidenceId>
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")
  const { InstrumentResolver, classifyEventType, RESOLVER_VERSION } =
    await import("../src/lib/regulatory-truth/instrument-resolver")

  const evidenceId = process.argv[2]
  if (!evidenceId) {
    console.error("Usage: npx tsx scripts/run-instrument-resolver.ts <evidenceId>")
    process.exit(1)
  }

  console.log("=== Instrument Resolver ===")
  console.log("Evidence ID:", evidenceId)
  console.log("Resolver version:", RESOLVER_VERSION)

  // 1. Load Evidence with latest parse
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      parsedDocuments: {
        where: { isLatest: true, status: "SUCCESS" },
        take: 1,
      },
    },
  })

  if (!evidence) {
    console.error("Evidence not found:", evidenceId)
    process.exit(1)
  }

  const parsedDoc = evidence.parsedDocuments[0]
  if (!parsedDoc) {
    console.error("No successful parse found for evidence")
    process.exit(1)
  }

  console.log("ParsedDocument ID:", parsedDoc.id)

  // 2. Extract metadata for resolution
  const docMeta = (parsedDoc.docMeta as Record<string, unknown>) || {}
  const resolverInput = {
    evidenceId,
    sourceKey: evidence.sourceKey,
    docMeta: {
      title: docMeta.title as string | undefined,
      eli: docMeta.eli as string | undefined,
      nnYear: docMeta.nnYear as number | undefined,
      nnIssue: docMeta.nnIssue as number | undefined,
      nnItem: docMeta.nnItem as number | undefined,
      textType: docMeta.textType as string | undefined,
      publishedAt: docMeta.publishedAt ? new Date(docMeta.publishedAt as string) : undefined,
      effectiveFrom: docMeta.effectiveFrom ? new Date(docMeta.effectiveFrom as string) : undefined,
    },
  }

  console.log("\nDocument metadata:")
  console.log("  Title:", resolverInput.docMeta.title || "(none)")
  console.log("  ELI:", resolverInput.docMeta.eli || "(none)")
  console.log("  Text type:", resolverInput.docMeta.textType || "(none)")

  // 3. Classify event type
  const eventClassification = classifyEventType(resolverInput.docMeta)
  console.log("\nEvent classification:")
  console.log("  Type:", eventClassification.eventType)
  console.log("  Confidence:", (eventClassification.confidence * 100).toFixed(0) + "%")
  console.log("  Signals:", eventClassification.signals.join(", "))

  // 4. Load all instruments for matching
  const instruments = await dbReg.instrument.findMany({
    select: {
      id: true,
      canonicalId: true,
      title: true,
      shortTitle: true,
      eliUri: true,
    },
  })

  console.log("\nInstruments in database:", instruments.length)

  // 5. Resolve
  const resolver = new InstrumentResolver()
  const result = await resolver.resolve(resolverInput, instruments)

  console.log("\n=== Resolution Result ===")

  // 6. Log attempt
  const attempt = await dbReg.instrumentResolutionAttempt.create({
    data: {
      evidenceId,
      sourceKey: evidence.sourceKey,
      candidates: result.candidates,
      chosenInstrumentId: result.resolved ? result.instrumentId : null,
      confidence: result.resolved ? result.confidence : null,
      method: result.resolved ? result.method : null,
      failReason: !result.resolved ? result.failReason : null,
      failDetail: !result.resolved ? result.failDetail : null,
      resolverVersion: RESOLVER_VERSION,
    },
  })

  console.log("Logged attempt:", attempt.id)

  if (result.resolved) {
    console.log("Status: RESOLVED")
    console.log("Instrument ID:", result.instrumentId)
    console.log("Method:", result.method)
    console.log("Confidence:", result.confidence)

    // Find instrument details
    const instrument = instruments.find((i) => i.id === result.instrumentId)
    if (instrument) {
      console.log("Instrument title:", instrument.title)
    }

    // 7. Create or update link
    const existingLink = await dbReg.instrumentEvidenceLink.findUnique({
      where: {
        instrumentId_evidenceId: {
          instrumentId: result.instrumentId,
          evidenceId,
        },
      },
    })

    if (existingLink) {
      // Update if new resolution is better
      if (
        result.confidence === "HIGH" ||
        (result.confidence === "MEDIUM" && existingLink.confidence === "LOW")
      ) {
        await dbReg.instrumentEvidenceLink.update({
          where: { id: existingLink.id },
          data: {
            method: result.method,
            confidence: result.confidence,
            matchedBy: RESOLVER_VERSION,
            matchMeta: result.matchMeta,
            eventType: eventClassification.eventType,
            publishedAt: resolverInput.docMeta.publishedAt,
            effectiveFrom: resolverInput.docMeta.effectiveFrom,
          },
        })
        console.log("Updated existing link:", existingLink.id)
      } else {
        console.log("Existing link has equal or better confidence, skipping update")
      }
    } else {
      const link = await dbReg.instrumentEvidenceLink.create({
        data: {
          instrumentId: result.instrumentId,
          evidenceId,
          method: result.method,
          confidence: result.confidence,
          matchedBy: RESOLVER_VERSION,
          matchMeta: result.matchMeta,
          eventType: eventClassification.eventType,
          publishedAt: resolverInput.docMeta.publishedAt,
          effectiveFrom: resolverInput.docMeta.effectiveFrom,
        },
      })
      console.log("Created link:", link.id)
    }

    // 8. Show candidates
    if (result.candidates.length > 0) {
      console.log("\nAll candidates considered:")
      for (const c of result.candidates.slice(0, 5)) {
        const inst = instruments.find((i) => i.id === c.instrumentId)
        console.log(`  ${c.score.toFixed(3)} - ${inst?.title || c.instrumentId}`)
      }
    }
  } else {
    console.log("Status: FAILED")
    console.log("Reason:", result.failReason)
    console.log("Detail:", result.failDetail)

    if (result.candidates.length > 0) {
      console.log("\nNear-miss candidates:")
      for (const c of result.candidates.slice(0, 3)) {
        const inst = instruments.find((i) => i.id === c.instrumentId)
        console.log(`  ${c.score.toFixed(3)} - ${inst?.title || c.instrumentId}`)
      }
    }
  }

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
```

**Step 2: Make executable**

Run: `chmod +x scripts/run-instrument-resolver.ts`

**Step 3: Commit**

```bash
git add scripts/run-instrument-resolver.ts
git commit -m "feat(scripts): add run-instrument-resolver.ts pipeline script

Resolves Evidence to Instruments with audit logging.
Creates InstrumentEvidenceLink with event type and timeline position.
Usage: npx tsx scripts/run-instrument-resolver.ts <evidenceId>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B10: Integration Test - Full Linking Flow

**Files:**

- Create: `src/lib/regulatory-truth/instrument-resolver/__tests__/integration.db.test.ts`

**Step 1: Write the integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { dbReg } from "@/lib/db"
import { InstrumentResolver, classifyEventType, computeCoverage, RESOLVER_VERSION } from "../index"
import { InstrumentEventType, InstrumentLinkMethod, InstrumentLinkConfidence } from "@prisma/client"
import { createHash } from "crypto"

describe.skipIf(!process.env.REGULATORY_DATABASE_URL)("Instrument Resolver Integration", () => {
  const testPrefix = `test-${Date.now()}`
  const testSourceId = `${testPrefix}-source`
  const testInstrumentId = `${testPrefix}-instrument`
  const testEvidenceIds = [`${testPrefix}-ev-original`, `${testPrefix}-ev-amendment`]

  beforeAll(async () => {
    // Create source
    await dbReg.regulatorySource.create({
      data: {
        id: testSourceId,
        name: "Test Source",
        slug: `test-${Date.now()}`,
        url: "https://test.example.com",
        isActive: true,
        scrapeFrequency: "daily",
        priority: 1,
      },
    })

    // Create instrument
    await dbReg.instrument.create({
      data: {
        id: testInstrumentId,
        canonicalId: `hr:test:${Date.now()}`,
        title: "Zakon o testiranju integracija",
        shortTitle: "ZTI",
        eliUri: `eli/hr/zakon/2024/${Date.now()}/1/cro`,
      },
    })

    // Create evidence for original
    await dbReg.evidence.create({
      data: {
        id: testEvidenceIds[0],
        sourceId: testSourceId,
        url: "https://test.example.com/original",
        rawContent: "<html>Zakon o testiranju integracija</html>",
        contentHash: createHash("sha256").update("original").digest("hex"),
        contentType: "html",
        contentClass: "HTML",
        stalenessStatus: "FRESH",
      },
    })

    // Create evidence for amendment
    await dbReg.evidence.create({
      data: {
        id: testEvidenceIds[1],
        sourceId: testSourceId,
        url: "https://test.example.com/amendment",
        rawContent: "<html>Zakon o izmjenama Zakona o testiranju integracija</html>",
        contentHash: createHash("sha256").update("amendment").digest("hex"),
        contentType: "html",
        contentClass: "HTML",
        stalenessStatus: "FRESH",
      },
    })
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await dbReg.instrumentResolutionAttempt.deleteMany({
      where: { evidenceId: { in: testEvidenceIds } },
    })
    await dbReg.instrumentEvidenceLink.deleteMany({
      where: { instrumentId: testInstrumentId },
    })
    await dbReg.instrumentCoverage.deleteMany({
      where: { instrumentId: testInstrumentId },
    })
    await dbReg.evidence.deleteMany({
      where: { id: { in: testEvidenceIds } },
    })
    await dbReg.instrument.delete({
      where: { id: testInstrumentId },
    })
    await dbReg.regulatorySource.delete({
      where: { id: testSourceId },
    })
  })

  it("resolves evidence to instrument by title", async () => {
    const instrument = await dbReg.instrument.findUnique({
      where: { id: testInstrumentId },
    })

    const resolver = new InstrumentResolver()
    const result = await resolver.resolve(
      {
        evidenceId: testEvidenceIds[0],
        docMeta: {
          title: "Zakon o testiranju integracija",
        },
      },
      [{ ...instrument!, shortTitle: instrument!.shortTitle }]
    )

    expect(result.resolved).toBe(true)
    if (result.resolved) {
      expect(result.instrumentId).toBe(testInstrumentId)
    }
  })

  it("resolves amendment to base instrument", async () => {
    const instrument = await dbReg.instrument.findUnique({
      where: { id: testInstrumentId },
    })

    const resolver = new InstrumentResolver()
    const result = await resolver.resolve(
      {
        evidenceId: testEvidenceIds[1],
        docMeta: {
          title: "Zakon o izmjenama Zakona o testiranju integracija",
        },
      },
      [{ ...instrument!, shortTitle: instrument!.shortTitle }]
    )

    expect(result.resolved).toBe(true)
    if (result.resolved) {
      expect(result.instrumentId).toBe(testInstrumentId)
    }
  })

  it("classifies event types correctly", () => {
    const original = classifyEventType({
      title: "Zakon o testiranju integracija",
    })
    expect(original.eventType).toBe(InstrumentEventType.ORIGINAL)

    const amendment = classifyEventType({
      title: "Zakon o izmjenama Zakona o testiranju integracija",
    })
    expect(amendment.eventType).toBe(InstrumentEventType.AMENDMENT)
  })

  it("creates and retrieves instrument links", async () => {
    // Create links
    await dbReg.instrumentEvidenceLink.create({
      data: {
        instrumentId: testInstrumentId,
        evidenceId: testEvidenceIds[0],
        method: InstrumentLinkMethod.TITLE_FUZZY,
        confidence: InstrumentLinkConfidence.HIGH,
        matchedBy: "test",
        eventType: InstrumentEventType.ORIGINAL,
        publishedAt: new Date("2024-01-01"),
      },
    })

    await dbReg.instrumentEvidenceLink.create({
      data: {
        instrumentId: testInstrumentId,
        evidenceId: testEvidenceIds[1],
        method: InstrumentLinkMethod.TITLE_FUZZY,
        confidence: InstrumentLinkConfidence.HIGH,
        matchedBy: "test",
        eventType: InstrumentEventType.AMENDMENT,
        publishedAt: new Date("2024-06-01"),
      },
    })

    // Query timeline
    const links = await dbReg.instrumentEvidenceLink.findMany({
      where: { instrumentId: testInstrumentId },
      orderBy: { publishedAt: "asc" },
    })

    expect(links).toHaveLength(2)
    expect(links[0].eventType).toBe(InstrumentEventType.ORIGINAL)
    expect(links[1].eventType).toBe(InstrumentEventType.AMENDMENT)
  })

  it("logs resolution attempts", async () => {
    await dbReg.instrumentResolutionAttempt.create({
      data: {
        evidenceId: testEvidenceIds[0],
        candidates: [{ instrumentId: testInstrumentId, score: 0.95 }],
        chosenInstrumentId: testInstrumentId,
        confidence: InstrumentLinkConfidence.HIGH,
        method: InstrumentLinkMethod.TITLE_FUZZY,
        resolverVersion: "test-v1",
      },
    })

    const attempts = await dbReg.instrumentResolutionAttempt.findMany({
      where: { evidenceId: testEvidenceIds[0] },
    })

    expect(attempts).toHaveLength(1)
    expect(attempts[0].chosenInstrumentId).toBe(testInstrumentId)
  })
})
```

**Step 2: Run the test (requires database)**

Run: `npx vitest run src/lib/regulatory-truth/instrument-resolver/__tests__/integration.db.test.ts`
Expected: PASS (or SKIP if no database)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/instrument-resolver/__tests__/
git commit -m "feat(instrument-resolver): add integration test for full linking flow

Tests resolution, event classification, link creation, and audit logging.
Validates timeline ordering and coverage computation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Exit Criteria Verification

> **AUDIT FIX:** Exit criteria now include resolution attempt logging and confidence tracking.

After completing all tasks, verify:

| Criteria                       | Verification                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Schema migrations applied      | `npx prisma migrate status` shows all migrations applied                                                                 |
| Resolver unit tests pass       | `npx vitest run src/lib/regulatory-truth/instrument-resolver/` all green                                                 |
| Event classifier accurate      | >90% accuracy on test titles                                                                                             |
| Timeline ordering correct      | Entries ordered by date, then event type priority                                                                        |
| Integration test passes        | DB test creates links and logs attempts successfully                                                                     |
| >80% HIGH/MEDIUM links         | `SELECT COUNT(*) FILTER (WHERE confidence IN ('HIGH','MEDIUM'))::float / COUNT(*) FROM "InstrumentEvidenceLink";` ≥ 0.80 |
| **Resolution attempts logged** | Every Evidence processed has an InstrumentResolutionAttempt row                                                          |
| **Ambiguity rate < 5%**        | `SELECT COUNT(*) FILTER (WHERE "failReason" = 'AMBIGUOUS')::float / COUNT(*) FROM "InstrumentResolutionAttempt";` < 0.05 |
| **publishedAt populated**      | All InstrumentEvidenceLinks have publishedAt from docMeta                                                                |

---

## Notes for Implementer

1. **string-similarity dependency**: If needed for more sophisticated fuzzy matching, install: `npm install string-similarity @types/string-similarity`

2. **ELI format**: Croatian ELI follows pattern `eli/hr/{type}/{year}/{issue}/{item}/{lang}`. Some older documents may not have ELI.

3. **Event type classification**: Patterns are priority-ordered. CONSOLIDATED beats AMENDMENT because consolidated texts contain "pročišćeni tekst" even if they're amendments.

4. **Timeline gaps**: 3-year threshold is conservative. Adjust based on instrument type (laws change less frequently than pravilniks).

5. **Confidence calibration**: Initial thresholds (0.95/0.85/0.70) should be validated against real data and potentially adjusted.

6. **Coverage recomputation**: InstrumentCoverage should be recomputed when links change. Consider a background job for this.

7. **⚠️ AUDIT FIX - Never update Evidence.instrumentId directly**: The linking relationship lives in InstrumentEvidenceLink, NOT Evidence. Never set `evidence.instrumentId` directly. This maintains proper separation and allows multiple links (e.g., an amendment linking to multiple instruments).

8. **⚠️ AUDIT FIX - Linking prerequisites**: Resolver MUST only run on Evidence with:
   - A successful ParsedDocument with `isLatest=true`
   - Stable docMeta with at least (nnYear, nnIssue, nnItem) populated
   - If docMeta is incomplete, log ResolutionAttempt with `failReason: MISSING_METADATA`

9. **⚠️ AUDIT FIX - Confidence calibration loop**: Add a task to track confidence distribution per resolver version:
   ```sql
   -- Weekly analysis query for calibration
   SELECT
     "resolverVersion",
     confidence,
     COUNT(*) as count,
     COUNT(*)::float / SUM(COUNT(*)) OVER (PARTITION BY "resolverVersion") as ratio
   FROM "InstrumentEvidenceLink" iel
   JOIN "InstrumentResolutionAttempt" ira ON ira."chosenInstrumentId" = iel."instrumentId"
     AND ira."evidenceId" = iel."evidenceId"
   GROUP BY "resolverVersion", confidence
   ORDER BY "resolverVersion", confidence;
   ```
   If HIGH drops below 60% or LOW exceeds 20%, review threshold calibration.
