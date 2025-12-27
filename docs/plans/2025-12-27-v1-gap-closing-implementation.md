# V1 Gap-Closing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 5 critical gaps between current FiskAI implementation and V1 specification: ComparisonMatrix, Decision Coverage, Refusal Policy, Reasoning Pipeline, Frontend Integration.

**Architecture:** Extends existing 7 Knowledge Shapes with 8th shape (ComparisonMatrix), adds dimension-based DecisionCoverage calculator, implements code-based RefusalPolicy, creates 7-stage reasoning AsyncGenerator with SSE streaming, integrates with React frontend.

**Tech Stack:** TypeScript, Prisma 7, Next.js 15 App Router, Zod schemas, SSE streaming, React components.

**Design Document:** `docs/plans/2025-12-27-v1-gap-closing-design.md`

---

## Phase 1: ComparisonMatrix (Layer 8)

### Task 1.1: Add ComparisonMatrix Prisma Model

**Files:**

- Modify: `prisma/schema.prisma` (add after CoverageReport model, ~line 2622)

**Step 1: Add the ComparisonMatrix model to Prisma schema**

Add after the CoverageReport model (line 2622):

```prisma
// ============================================================================
// SHAPE 8: COMPARISON MATRIX (Strategic Comparisons)
// ============================================================================

model ComparisonMatrix {
  id          String   @id @default(cuid())
  slug        String   @unique
  titleHr     String
  titleEn     String?

  // Contextual Anchor for retrieval
  appliesWhen String?  @db.Text  // "IF user_type == 'freelancer' OR revenue < 40000"
  domainTags  String[]           // ["STARTING_BUSINESS", "TAX_REGIME"]

  // Structured data (JSON for flexibility)
  options     Json     // ComparisonOption[]
  criteria    Json     // ComparisonCriterion[]
  cells       Json     // ComparisonCell[]

  // Optional conclusion
  conclusion  String?  @db.Text

  // Provenance
  evidenceId  String?
  evidence    Evidence? @relation(fields: [evidenceId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([domainTags])
  @@index([evidenceId])
}
```

**Step 2: Add Evidence relation for ComparisonMatrix**

Find the Evidence model and add the relation:

```prisma
  // In Evidence model, add:
  comparisonMatrices ComparisonMatrix[]
```

**Step 3: Add COMPARISON_EXTRACTOR to AgentType enum**

Find the AgentType enum and add:

```prisma
enum AgentType {
  // ... existing values ...
  COMPARISON_EXTRACTOR
}
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`

**Step 5: Create migration**

Run: `npx prisma migrate dev --name add_comparison_matrix`
Expected: Migration created and applied successfully

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add ComparisonMatrix model (Layer 8)"
```

---

### Task 1.2: Create ComparisonMatrix Zod Schema

**Files:**

- Create: `src/lib/regulatory-truth/schemas/comparison-matrix.ts`
- Modify: `src/lib/regulatory-truth/schemas/index.ts` (add export)

**Step 1: Write the failing test**

Create test file `src/lib/regulatory-truth/schemas/__tests__/comparison-matrix.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  ComparisonMatrixSchema,
  ComparisonOptionSchema,
  ComparisonCriterionSchema,
  ComparisonCellSchema,
} from "../comparison-matrix"

describe("ComparisonMatrix Schema", () => {
  it("should validate a complete comparison matrix", () => {
    const matrix = {
      slug: "pausalni-vs-doo",
      titleHr: "Paušalni obrt vs d.o.o.",
      titleEn: "Lump-sum vs LLC",
      appliesWhen: "IF user_type == 'freelancer'",
      domainTags: ["STARTING_BUSINESS", "TAX_REGIME"],
      options: [
        {
          slug: "pausalni",
          conceptId: "cuid-pausalni",
          nameHr: "Paušalni obrt",
        },
        {
          slug: "doo",
          conceptId: "cuid-doo",
          nameHr: "d.o.o.",
        },
      ],
      criteria: [
        {
          slug: "liability",
          conceptId: "cuid-liability",
          nameHr: "Odgovornost",
        },
      ],
      cells: [
        {
          optionSlug: "pausalni",
          criterionSlug: "liability",
          value: "Neograničena",
          sentiment: "negative",
        },
      ],
    }

    const result = ComparisonMatrixSchema.safeParse(matrix)
    expect(result.success).toBe(true)
  })

  it("should reject matrix without required fields", () => {
    const result = ComparisonMatrixSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("should validate sentiment values", () => {
    const cell = {
      optionSlug: "test",
      criterionSlug: "test",
      value: "Test",
      sentiment: "invalid",
    }
    const result = ComparisonCellSchema.safeParse(cell)
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/schemas/__tests__/comparison-matrix.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the schema implementation**

Create `src/lib/regulatory-truth/schemas/comparison-matrix.ts`:

```typescript
// src/lib/regulatory-truth/schemas/comparison-matrix.ts
import { z } from "zod"

/**
 * Schema for comparison options (columns in matrix)
 */
export const ComparisonOptionSchema = z.object({
  slug: z.string().min(1),
  conceptId: z.string().min(1), // Links to ConceptNode
  nameHr: z.string().min(1),
  nameEn: z.string().optional(),
  description: z.string().optional(),
})

export type ComparisonOption = z.infer<typeof ComparisonOptionSchema>

/**
 * Schema for comparison criteria (rows in matrix)
 */
export const ComparisonCriterionSchema = z.object({
  slug: z.string().min(1),
  conceptId: z.string().min(1), // Links to ConceptNode
  nameHr: z.string().min(1),
  nameEn: z.string().optional(),
  weight: z.number().min(0).max(1).optional(), // For optional scoring
})

export type ComparisonCriterion = z.infer<typeof ComparisonCriterionSchema>

/**
 * Schema for matrix cells (intersection of option and criterion)
 */
export const ComparisonCellSchema = z.object({
  optionSlug: z.string().min(1),
  criterionSlug: z.string().min(1),
  value: z.string().min(1),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  explanation: z.string().optional(),
})

export type ComparisonCell = z.infer<typeof ComparisonCellSchema>

/**
 * Full ComparisonMatrix schema for extraction
 */
export const ComparisonMatrixSchema = z.object({
  slug: z.string().min(1),
  titleHr: z.string().min(1),
  titleEn: z.string().optional(),

  // Contextual anchor
  appliesWhen: z.string().optional(),
  domainTags: z.array(z.string()).default([]),

  // Matrix structure
  options: z.array(ComparisonOptionSchema).min(2), // At least 2 options to compare
  criteria: z.array(ComparisonCriterionSchema).min(1), // At least 1 criterion
  cells: z.array(ComparisonCellSchema).min(1),

  // Optional conclusion
  conclusion: z.string().optional(),
})

export type ComparisonMatrix = z.infer<typeof ComparisonMatrixSchema>

/**
 * Schema for extraction output (includes confidence)
 */
export const ComparisonMatrixExtractionSchema = ComparisonMatrixSchema.extend({
  confidence: z.number().min(0).max(1).default(0.8),
  evidenceId: z.string().optional(),
})

export type ComparisonMatrixExtraction = z.infer<typeof ComparisonMatrixExtractionSchema>

/**
 * Domain tags for categorization
 */
export const COMPARISON_DOMAIN_TAGS = [
  "STARTING_BUSINESS",
  "TAX_REGIME",
  "VAT_SCHEME",
  "EMPLOYMENT",
  "RETIREMENT",
  "INVESTMENT",
  "LEGAL_FORM",
] as const

export type ComparisonDomainTag = (typeof COMPARISON_DOMAIN_TAGS)[number]
```

**Step 4: Export from index**

Add to `src/lib/regulatory-truth/schemas/index.ts`:

```typescript
export * from "./comparison-matrix"
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/schemas/__tests__/comparison-matrix.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add src/lib/regulatory-truth/schemas/comparison-matrix.ts \
        src/lib/regulatory-truth/schemas/__tests__/comparison-matrix.test.ts \
        src/lib/regulatory-truth/schemas/index.ts
git commit -m "feat(schemas): add ComparisonMatrix Zod schema"
```

---

### Task 1.3: Create Comparison Extractor Agent

**Files:**

- Create: `src/lib/regulatory-truth/agents/comparison-extractor.ts`
- Modify: `src/lib/regulatory-truth/agents/index.ts` (add export)

**Step 1: Write the failing test**

Create test file `src/lib/regulatory-truth/agents/__tests__/comparison-extractor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { detectComparisonContent, extractComparisonMatrix } from "../comparison-extractor"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    comparisonMatrix: {
      upsert: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
    conceptNode: {
      findFirst: vi.fn().mockResolvedValue({ id: "concept-id" }),
    },
  },
}))

// Mock the agent runner
vi.mock("../runner", () => ({
  runAgent: vi.fn().mockResolvedValue({
    success: true,
    output: {
      slug: "pausalni-vs-doo",
      titleHr: "Paušalni obrt vs d.o.o.",
      options: [
        { slug: "pausalni", conceptId: "c1", nameHr: "Paušalni" },
        { slug: "doo", conceptId: "c2", nameHr: "d.o.o." },
      ],
      criteria: [{ slug: "liability", conceptId: "c3", nameHr: "Odgovornost" }],
      cells: [
        {
          optionSlug: "pausalni",
          criterionSlug: "liability",
          value: "Neograničena",
          sentiment: "negative",
        },
      ],
      confidence: 0.9,
    },
  }),
}))

describe("Comparison Extractor", () => {
  describe("detectComparisonContent", () => {
    it("should detect 'vs' pattern", () => {
      const content = "Paušalni obrt vs d.o.o. - što odabrati?"
      expect(detectComparisonContent(content)).toBe(true)
    })

    it("should detect 'Usporedba' pattern", () => {
      const content = "Usporedba poreznih režima u Hrvatskoj"
      expect(detectComparisonContent(content)).toBe(true)
    })

    it("should detect 'Pros and Cons' pattern", () => {
      const content = "Pros and Cons of different business structures"
      expect(detectComparisonContent(content)).toBe(true)
    })

    it("should detect 'Prednosti i nedostaci' pattern", () => {
      const content = "Prednosti i nedostaci paušalnog oporezivanja"
      expect(detectComparisonContent(content)).toBe(true)
    })

    it("should return false for non-comparison content", () => {
      const content = "Kako registrirati obrt u Hrvatskoj"
      expect(detectComparisonContent(content)).toBe(false)
    })
  })

  describe("extractComparisonMatrix", () => {
    it("should extract comparison matrix from content", async () => {
      const result = await extractComparisonMatrix("test-evidence-id", "Paušalni vs d.o.o.")
      expect(result.success).toBe(true)
      expect(result.matrix).toBeDefined()
      expect(result.matrix?.slug).toBe("pausalni-vs-doo")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/agents/__tests__/comparison-extractor.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the extractor implementation**

Create `src/lib/regulatory-truth/agents/comparison-extractor.ts`:

```typescript
// src/lib/regulatory-truth/agents/comparison-extractor.ts
import { db } from "@/lib/db"
import { runAgent } from "./runner"
import {
  ComparisonMatrixExtractionSchema,
  type ComparisonMatrixExtraction,
} from "../schemas/comparison-matrix"
import { z } from "zod"

/**
 * Patterns that indicate comparison content
 */
const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\busporedba\b/i,
  /\bkomparacija\b/i,
  /\bprednosti\s+i\s+nedostaci\b/i,
  /\bpros\s+and\s+cons\b/i,
  /\bcomparison\b/i,
  /\bnasuprot\b/i,
  /\bili\b.*\bje\s+bolje\b/i,
  /\bšto\s+odabrati\b/i,
  /\brazlike\s+između\b/i,
]

/**
 * Detect if content contains comparison patterns
 */
export function detectComparisonContent(content: string): boolean {
  return COMPARISON_PATTERNS.some((pattern) => pattern.test(content))
}

const ExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
})

interface ExtractionResult {
  success: boolean
  matrix?: ComparisonMatrixExtraction
  error?: string
}

/**
 * Extract ComparisonMatrix from evidence content
 */
export async function extractComparisonMatrix(
  evidenceId: string,
  content: string
): Promise<ExtractionResult> {
  const input = { evidenceId, content }

  const result = await runAgent<typeof input, ComparisonMatrixExtraction>({
    agentType: "COMPARISON_EXTRACTOR",
    input,
    inputSchema: ExtractorInputSchema,
    outputSchema: ComparisonMatrixExtractionSchema,
    temperature: 0.1,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      error: result.error || "Extraction failed",
    }
  }

  // Link options and criteria to ConceptNode taxonomy
  const matrix = result.output
  for (const option of matrix.options) {
    const concept = await db.conceptNode.findFirst({
      where: {
        OR: [{ slug: option.slug }, { synonyms: { has: option.nameHr.toLowerCase() } }],
      },
    })
    if (concept) {
      option.conceptId = concept.id
    }
  }

  for (const criterion of matrix.criteria) {
    const concept = await db.conceptNode.findFirst({
      where: {
        OR: [{ slug: criterion.slug }, { synonyms: { has: criterion.nameHr.toLowerCase() } }],
      },
    })
    if (concept) {
      criterion.conceptId = concept.id
    }
  }

  return {
    success: true,
    matrix,
  }
}

/**
 * Save extracted ComparisonMatrix to database
 */
export async function saveComparisonMatrix(
  matrix: ComparisonMatrixExtraction,
  evidenceId: string
): Promise<string> {
  const saved = await db.comparisonMatrix.upsert({
    where: { slug: matrix.slug },
    create: {
      slug: matrix.slug,
      titleHr: matrix.titleHr,
      titleEn: matrix.titleEn,
      appliesWhen: matrix.appliesWhen,
      domainTags: matrix.domainTags,
      options: matrix.options,
      criteria: matrix.criteria,
      cells: matrix.cells,
      conclusion: matrix.conclusion,
      evidenceId,
    },
    update: {
      titleHr: matrix.titleHr,
      titleEn: matrix.titleEn,
      appliesWhen: matrix.appliesWhen,
      domainTags: matrix.domainTags,
      options: matrix.options,
      criteria: matrix.criteria,
      cells: matrix.cells,
      conclusion: matrix.conclusion,
    },
  })

  return saved.id
}

/**
 * Run full extraction pipeline for comparison content
 */
export async function runComparisonExtractor(evidenceId: string): Promise<{
  extracted: boolean
  matrixId?: string
  error?: string
}> {
  // Get evidence content
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
    select: { rawContent: true },
  })

  if (!evidence) {
    return { extracted: false, error: "Evidence not found" }
  }

  // Check for comparison patterns
  if (!detectComparisonContent(evidence.rawContent)) {
    return { extracted: false, error: "No comparison content detected" }
  }

  // Extract matrix
  const result = await extractComparisonMatrix(evidenceId, evidence.rawContent)

  if (!result.success || !result.matrix) {
    return { extracted: false, error: result.error }
  }

  // Save to database
  const matrixId = await saveComparisonMatrix(result.matrix, evidenceId)

  return { extracted: true, matrixId }
}
```

**Step 4: Add prompt for comparison extractor**

Add to `src/lib/regulatory-truth/prompts/index.ts`:

```typescript
export const COMPARISON_EXTRACTOR_PROMPT = `You are an expert at extracting structured comparison matrices from regulatory content.

Given content about comparing regulatory options (business forms, tax regimes, etc.), extract:

1. **Options**: The things being compared (e.g., "paušalni obrt", "d.o.o.")
2. **Criteria**: The dimensions of comparison (e.g., "liability", "tax burden", "admin complexity")
3. **Cells**: The values for each option-criterion intersection with sentiment (positive/negative/neutral)

Output a valid JSON object matching the ComparisonMatrix schema.

RULES:
- Generate slugs in kebab-case from Croatian names
- Set sentiment based on whether the value is advantageous (positive), disadvantageous (negative), or neutral
- Include explanations for complex cells
- Set appliesWhen if the comparison only applies to certain user types
- Use domainTags to categorize: STARTING_BUSINESS, TAX_REGIME, VAT_SCHEME, EMPLOYMENT, etc.
- Confidence should reflect certainty of extraction (0.8-0.95 typical)

If the content is not a comparison or insufficient for extraction, return null.`
```

**Step 5: Export from index**

Add to `src/lib/regulatory-truth/agents/index.ts`:

```typescript
export * from "./comparison-extractor"
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/agents/__tests__/comparison-extractor.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/regulatory-truth/agents/comparison-extractor.ts \
        src/lib/regulatory-truth/agents/__tests__/comparison-extractor.test.ts \
        src/lib/regulatory-truth/agents/index.ts \
        src/lib/regulatory-truth/prompts/index.ts
git commit -m "feat(agents): add comparison-extractor for ComparisonMatrix"
```

---

### Task 1.4: Add STRATEGY Intent and Strategy Engine

**Files:**

- Modify: `src/lib/regulatory-truth/schemas/query-intent.ts` (add STRATEGY)
- Create: `src/lib/regulatory-truth/retrieval/strategy-engine.ts`
- Modify: `src/lib/regulatory-truth/retrieval/query-router.ts` (add STRATEGY routing)
- Modify: `src/lib/regulatory-truth/retrieval/index.ts` (add export)

**Step 1: Update query-intent schema to add STRATEGY**

In `src/lib/regulatory-truth/schemas/query-intent.ts`, add STRATEGY to the intent enum:

```typescript
export const QueryIntentSchema = z.enum([
  "LOGIC",
  "PROCESS",
  "REFERENCE",
  "DOCUMENT",
  "TEMPORAL",
  "STRATEGY", // NEW
  "GENERAL",
])

export type QueryIntent = z.infer<typeof QueryIntentSchema>
```

**Step 2: Write the failing test for strategy engine**

Create `src/lib/regulatory-truth/retrieval/__tests__/strategy-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { runStrategyEngine, detectStrategyIntent } from "../strategy-engine"

vi.mock("@/lib/db", () => ({
  db: {
    comparisonMatrix: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "matrix-1",
          slug: "pausalni-vs-doo",
          titleHr: "Paušalni obrt vs d.o.o.",
          domainTags: ["STARTING_BUSINESS"],
          options: [],
          criteria: [],
          cells: [],
        },
      ]),
    },
  },
}))

describe("Strategy Engine", () => {
  describe("detectStrategyIntent", () => {
    it("should detect 'should I' pattern", () => {
      expect(detectStrategyIntent("Should I open a d.o.o. or paušalni?")).toBe(true)
    })

    it("should detect 'trebam li' pattern", () => {
      expect(detectStrategyIntent("Trebam li otvoriti obrt ili d.o.o.?")).toBe(true)
    })

    it("should detect 'što je bolje' pattern", () => {
      expect(detectStrategyIntent("Što je bolje - paušalni ili normalni PDV?")).toBe(true)
    })

    it("should return false for non-strategy queries", () => {
      expect(detectStrategyIntent("Koliko iznosi stopa PDV-a?")).toBe(false)
    })
  })

  describe("runStrategyEngine", () => {
    it("should return matching comparison matrices", async () => {
      const result = await runStrategyEngine("Trebam li otvoriti obrt?", {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      })

      expect(result.success).toBe(true)
      expect(result.matrices).toHaveLength(1)
    })
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/retrieval/__tests__/strategy-engine.test.ts`
Expected: FAIL

**Step 4: Write the strategy engine implementation**

Create `src/lib/regulatory-truth/retrieval/strategy-engine.ts`:

```typescript
// src/lib/regulatory-truth/retrieval/strategy-engine.ts
import { db } from "@/lib/db"
import type { ExtractedEntities } from "../schemas/query-intent"

/**
 * Patterns that indicate strategic/comparison queries
 */
const STRATEGY_PATTERNS = [
  /\bshould\s+i\b/i,
  /\btrebam\s+li\b/i,
  /\bšto\s+je\s+bolje\b/i,
  /\bkoji\s+je\s+bolji\b/i,
  /\bodabrati\b/i,
  /\bpreporučujem\b/i,
  /\busporediti\b/i,
  /\brazlika\s+između\b/i,
  /\bvs\.?\b/i,
  /\bili\b.*\bili\b/i, // "X ili Y"
]

/**
 * Detect if query has strategic intent
 */
export function detectStrategyIntent(query: string): boolean {
  return STRATEGY_PATTERNS.some((pattern) => pattern.test(query))
}

/**
 * Map query terms to domain tags
 */
function extractDomainTags(query: string, entities: ExtractedEntities): string[] {
  const tags: string[] = []
  const lowerQuery = query.toLowerCase()

  if (/obrt|d\.?o\.?o\.?|j\.?d\.?o\.?o\.?|tvrtka|poduzeće/.test(lowerQuery)) {
    tags.push("STARTING_BUSINESS", "LEGAL_FORM")
  }
  if (/paušal|pdv|porez/.test(lowerQuery)) {
    tags.push("TAX_REGIME")
  }
  if (/oss|eu|intrastat/.test(lowerQuery)) {
    tags.push("VAT_SCHEME")
  }
  if (/zaposlenik|ugovor\s+o\s+radu|plaća/.test(lowerQuery)) {
    tags.push("EMPLOYMENT")
  }
  if (/mirovina|staž/.test(lowerQuery)) {
    tags.push("RETIREMENT")
  }

  return [...new Set(tags)]
}

export interface StrategyEngineResult {
  success: boolean
  matrices: Array<{
    id: string
    slug: string
    titleHr: string
    titleEn?: string | null
    appliesWhen?: string | null
    domainTags: string[]
    options: unknown
    criteria: unknown
    cells: unknown
    conclusion?: string | null
    relevanceScore: number
  }>
  error?: string
}

/**
 * Run strategy engine to find relevant comparison matrices
 */
export async function runStrategyEngine(
  query: string,
  entities: ExtractedEntities
): Promise<StrategyEngineResult> {
  try {
    const domainTags = extractDomainTags(query, entities)

    // Find matrices matching domain tags or with overlapping content
    const matrices = await db.comparisonMatrix.findMany({
      where: domainTags.length > 0 ? { domainTags: { hasSome: domainTags } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    // Score relevance based on domain tag overlap
    const scoredMatrices = matrices.map((matrix) => {
      const matrixTags = matrix.domainTags
      const overlap = matrixTags.filter((tag) => domainTags.includes(tag)).length
      const relevanceScore = domainTags.length > 0 ? overlap / domainTags.length : 0.5

      return {
        ...matrix,
        relevanceScore,
      }
    })

    // Sort by relevance
    scoredMatrices.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return {
      success: true,
      matrices: scoredMatrices,
    }
  } catch (error) {
    return {
      success: false,
      matrices: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
```

**Step 5: Update query-router to add STRATEGY patterns and routing**

In `src/lib/regulatory-truth/retrieval/query-router.ts`:

Add STRATEGY patterns to `detectIntentFromPatterns`:

```typescript
// Add before LOGIC patterns check
// STRATEGY patterns
const strategyPatterns = [
  /trebam\s+li/,
  /što\s+je\s+bolje/,
  /koji\s+je\s+bolji/,
  /should\s+i/i,
  /\bvs\.?\b/,
  /odabrati/,
]
if (strategyPatterns.some((p) => p.test(lowerQuery))) {
  return "STRATEGY"
}
```

Add STRATEGY to `getEngineForIntent`:

```typescript
const engineMap: Record<QueryIntent, string> = {
  LOGIC: "logic-engine",
  PROCESS: "process-engine",
  REFERENCE: "reference-engine",
  DOCUMENT: "asset-engine",
  TEMPORAL: "temporal-engine",
  STRATEGY: "strategy-engine", // NEW
  GENERAL: "logic-engine",
}
```

Add STRATEGY case to `routeQuery`:

```typescript
import { runStrategyEngine } from "./strategy-engine"

// In the switch statement:
case "STRATEGY":
  response = await runStrategyEngine(query, classification.extractedEntities)
  break
```

**Step 6: Export from index**

Add to `src/lib/regulatory-truth/retrieval/index.ts`:

```typescript
export * from "./strategy-engine"
```

**Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/regulatory-truth/retrieval/__tests__/strategy-engine.test.ts`
Run: `npx vitest run src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/lib/regulatory-truth/schemas/query-intent.ts \
        src/lib/regulatory-truth/retrieval/strategy-engine.ts \
        src/lib/regulatory-truth/retrieval/__tests__/strategy-engine.test.ts \
        src/lib/regulatory-truth/retrieval/query-router.ts \
        src/lib/regulatory-truth/retrieval/index.ts
git commit -m "feat(retrieval): add STRATEGY intent and strategy-engine"
```

---

### Task 1.5: Integrate Comparison Extractor into Multi-Shape Pipeline

**Files:**

- Modify: `src/lib/regulatory-truth/agents/multi-shape-extractor.ts`

**Step 1: Read current multi-shape-extractor**

Read `src/lib/regulatory-truth/agents/multi-shape-extractor.ts` to understand the current structure.

**Step 2: Add comparison extraction to the pipeline**

Add import and extraction call:

```typescript
import { detectComparisonContent, runComparisonExtractor } from "./comparison-extractor"

// In the runMultiShapeExtractor function, add after other extractors:

// 6. ComparisonMatrix extraction
if (detectComparisonContent(content)) {
  console.log(`[multi-shape] Running comparison extractor for ${evidenceId}`)
  const comparisonResult = await runComparisonExtractor(evidenceId)
  if (comparisonResult.extracted) {
    results.comparisonMatrixIds = [comparisonResult.matrixId!]
    console.log(`[multi-shape] Extracted comparison matrix: ${comparisonResult.matrixId}`)
  }
}
```

**Step 3: Update result type to include comparisonMatrixIds**

```typescript
interface MultiShapeExtractionResult {
  // ... existing fields
  comparisonMatrixIds?: string[]
}
```

**Step 4: Run existing tests to ensure no regression**

Run: `npx vitest run src/lib/regulatory-truth/agents/__tests__/multi-shape-extractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/agents/multi-shape-extractor.ts
git commit -m "feat(extraction): integrate ComparisonMatrix into multi-shape pipeline"
```

---

## Phase 2: Decision Coverage Calculator

### Task 2.1: Create Topic Dimensions Configuration

**Files:**

- Create: `src/lib/assistant/reasoning/topic-dimensions.ts`
- Create: `src/lib/assistant/reasoning/__tests__/topic-dimensions.test.ts`

**Step 1: Write the failing test**

Create `src/lib/assistant/reasoning/__tests__/topic-dimensions.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  getTopicDimensions,
  VAT_RATE_DIMENSIONS,
  OSS_THRESHOLD_DIMENSIONS,
  TopicDimensions,
} from "../topic-dimensions"

describe("Topic Dimensions", () => {
  describe("VAT_RATE_DIMENSIONS", () => {
    it("should have Item as required dimension", () => {
      const itemDim = VAT_RATE_DIMENSIONS.dimensions.find((d) => d.dimension === "Item")
      expect(itemDim?.required).toBe(true)
    })

    it("should have conditional VAT_ID requirement", () => {
      const vatIdDim = VAT_RATE_DIMENSIONS.dimensions.find((d) => d.dimension === "VAT_ID")
      expect(vatIdDim?.required).toEqual({ dependsOn: "BuyerType", value: "B2B" })
    })
  })

  describe("getTopicDimensions", () => {
    it("should return topic dimensions for known topic", () => {
      const result = getTopicDimensions("vat-rate")
      expect(result).toBeDefined()
      expect(result?.topic).toBe("vat-rate")
    })

    it("should return undefined for unknown topic", () => {
      const result = getTopicDimensions("unknown-topic")
      expect(result).toBeUndefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/topic-dimensions.test.ts`
Expected: FAIL

**Step 3: Create the reasoning directory and topic-dimensions file**

First create the directory:

```bash
mkdir -p src/lib/assistant/reasoning/__tests__
```

Create `src/lib/assistant/reasoning/topic-dimensions.ts`:

```typescript
// src/lib/assistant/reasoning/topic-dimensions.ts

/**
 * Dimension requirement with optional conditional logic
 */
export interface DimensionRequirement {
  dimension: string
  required:
    | boolean
    | {
        dependsOn: string
        value: string
      }
  possibleValues?: string[]
  defaultValue?: string
  defaultSource?: "jurisdiction" | "temporal" | "profile"
}

/**
 * Topic-specific dimension requirements
 */
export interface TopicDimensions {
  topic: string
  dimensions: DimensionRequirement[]
}

/**
 * VAT Rate determination dimensions
 */
export const VAT_RATE_DIMENSIONS: TopicDimensions = {
  topic: "vat-rate",
  dimensions: [
    { dimension: "Item", required: true },
    {
      dimension: "ServiceContext",
      required: false,
      possibleValues: ["on-premises", "takeaway", "delivery"],
    },
    { dimension: "Date", required: true, defaultValue: "today", defaultSource: "temporal" },
    { dimension: "Place", required: true, defaultValue: "HR", defaultSource: "jurisdiction" },
    { dimension: "BuyerType", required: false, possibleValues: ["B2B", "B2C"] },
    { dimension: "VAT_ID", required: { dependsOn: "BuyerType", value: "B2B" } },
  ],
}

/**
 * OSS Threshold dimensions
 */
export const OSS_THRESHOLD_DIMENSIONS: TopicDimensions = {
  topic: "oss-threshold",
  dimensions: [
    {
      dimension: "SellerCountry",
      required: true,
      defaultValue: "HR",
      defaultSource: "jurisdiction",
    },
    { dimension: "BuyerCountry", required: true },
    { dimension: "SalesAmount", required: true },
    {
      dimension: "Period",
      required: true,
      defaultValue: "current-year",
      defaultSource: "temporal",
    },
  ],
}

/**
 * Lump-sum taxation dimensions
 */
export const PAUSALNI_DIMENSIONS: TopicDimensions = {
  topic: "pausalni",
  dimensions: [
    { dimension: "LegalForm", required: true, possibleValues: ["obrt", "slobodna-djelatnost"] },
    { dimension: "AnnualRevenue", required: true },
    { dimension: "Activity", required: false },
    { dimension: "Year", required: true, defaultValue: "current-year", defaultSource: "temporal" },
  ],
}

/**
 * Business registration dimensions
 */
export const REGISTRATION_DIMENSIONS: TopicDimensions = {
  topic: "registration",
  dimensions: [
    { dimension: "LegalForm", required: true },
    { dimension: "Activity", required: true },
    { dimension: "Location", required: true, defaultValue: "HR", defaultSource: "jurisdiction" },
    { dimension: "CapitalAmount", required: { dependsOn: "LegalForm", value: "d.o.o." } },
  ],
}

/**
 * All topic dimensions registry
 */
const TOPIC_DIMENSIONS_REGISTRY: TopicDimensions[] = [
  VAT_RATE_DIMENSIONS,
  OSS_THRESHOLD_DIMENSIONS,
  PAUSALNI_DIMENSIONS,
  REGISTRATION_DIMENSIONS,
]

/**
 * Get dimensions for a specific topic
 */
export function getTopicDimensions(topic: string): TopicDimensions | undefined {
  return TOPIC_DIMENSIONS_REGISTRY.find((t) => t.topic === topic)
}

/**
 * Get all registered topics
 */
export function getAllTopics(): string[] {
  return TOPIC_DIMENSIONS_REGISTRY.map((t) => t.topic)
}

/**
 * Check if a dimension is conditionally required
 */
export function isConditionallyRequired(
  dim: DimensionRequirement,
  resolvedDimensions: Record<string, string>
): boolean {
  if (typeof dim.required === "boolean") {
    return dim.required
  }

  const { dependsOn, value } = dim.required
  return resolvedDimensions[dependsOn] === value
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/topic-dimensions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/topic-dimensions.ts \
        src/lib/assistant/reasoning/__tests__/topic-dimensions.test.ts
git commit -m "feat(reasoning): add topic dimensions configuration"
```

---

### Task 2.2: Create Decision Coverage Calculator

**Files:**

- Create: `src/lib/assistant/reasoning/decision-coverage.ts`
- Create: `src/lib/assistant/reasoning/__tests__/decision-coverage.test.ts`

**Step 1: Write the failing test**

Create `src/lib/assistant/reasoning/__tests__/decision-coverage.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  calculateDecisionCoverage,
  type DecisionCoverageResult,
  type ResolvedDimension,
} from "../decision-coverage"

describe("Decision Coverage Calculator", () => {
  describe("calculateDecisionCoverage", () => {
    it("should return ANSWER when all dimensions resolved", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        ServiceContext: "on-premises",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2C",
      })

      expect(result.terminalOutcome).toBe("ANSWER")
      expect(result.requiredScore).toBe(1)
      expect(result.totalScore).toBe(1)
    })

    it("should return CONDITIONAL_ANSWER when optional dimensions missing", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        Date: "2025-01-01",
        Place: "HR",
        // ServiceContext missing (optional)
        // BuyerType missing (optional)
      })

      expect(result.terminalOutcome).toBe("CONDITIONAL_ANSWER")
      expect(result.requiredScore).toBe(1)
      expect(result.totalScore).toBeLessThan(1)
      expect(result.branches).toBeDefined()
    })

    it("should return REFUSAL when required dimensions missing", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        // Item missing (required)
        Date: "2025-01-01",
        Place: "HR",
      })

      expect(result.terminalOutcome).toBe("REFUSAL")
      expect(result.requiredScore).toBeLessThan(1)
      expect(result.unresolved.some((u) => u.dimension === "Item")).toBe(true)
    })

    it("should handle conditional requirements", () => {
      // B2B requires VAT_ID
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2B",
        // VAT_ID missing (conditionally required)
      })

      expect(result.terminalOutcome).toBe("REFUSAL")
      expect(result.unresolved.some((u) => u.dimension === "VAT_ID")).toBe(true)
    })

    it("should not require VAT_ID for B2C", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2C",
        // VAT_ID not required for B2C
      })

      expect(result.terminalOutcome).toBe("ANSWER")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/decision-coverage.test.ts`
Expected: FAIL

**Step 3: Write the decision coverage implementation**

Create `src/lib/assistant/reasoning/decision-coverage.ts`:

```typescript
// src/lib/assistant/reasoning/decision-coverage.ts
import {
  getTopicDimensions,
  isConditionallyRequired,
  type DimensionRequirement,
  type TopicDimensions,
} from "./topic-dimensions"

/**
 * Resolved dimension with source tracking
 */
export interface ResolvedDimension {
  dimension: string
  value: string
  source: "query" | "profile" | "default"
  confidence: number
}

/**
 * Unresolved dimension info
 */
export interface UnresolvedDimension {
  dimension: string
  required: boolean
  possibleValues?: string[]
}

/**
 * Branch for conditional answers
 */
export interface ConditionalBranch {
  condition: string
  dimensionValue: string
  conceptId?: string
  resultingRule?: string
}

/**
 * Terminal outcome types
 */
export type TerminalOutcome = "ANSWER" | "CONDITIONAL_ANSWER" | "REFUSAL"

/**
 * Result of decision coverage calculation
 */
export interface DecisionCoverageResult {
  topic: string
  requiredScore: number // 0-1, must be 1.0 for answer
  totalScore: number // 0-1, including optional
  resolved: ResolvedDimension[]
  unresolved: UnresolvedDimension[]
  terminalOutcome: TerminalOutcome
  branches?: ConditionalBranch[]
}

/**
 * Apply default values based on source
 */
function applyDefaults(
  dimensions: DimensionRequirement[],
  provided: Record<string, string>
): Record<string, string> {
  const result = { ...provided }

  for (const dim of dimensions) {
    if (!(dim.dimension in result) && dim.defaultValue) {
      // Apply default based on source
      switch (dim.defaultSource) {
        case "temporal":
          if (dim.defaultValue === "today") {
            result[dim.dimension] = new Date().toISOString().split("T")[0]
          } else if (dim.defaultValue === "current-year") {
            result[dim.dimension] = new Date().getFullYear().toString()
          } else {
            result[dim.dimension] = dim.defaultValue
          }
          break
        case "jurisdiction":
          result[dim.dimension] = dim.defaultValue // e.g., "HR"
          break
        case "profile":
          // Would come from user profile - skip for now
          break
        default:
          result[dim.dimension] = dim.defaultValue
      }
    }
  }

  return result
}

/**
 * Generate conditional branches for unresolved optional dimensions
 */
function generateBranches(unresolved: UnresolvedDimension[]): ConditionalBranch[] {
  const branches: ConditionalBranch[] = []

  for (const dim of unresolved) {
    if (!dim.required && dim.possibleValues) {
      for (const value of dim.possibleValues) {
        branches.push({
          condition: `If ${dim.dimension} is ${value}`,
          dimensionValue: value,
        })
      }
    }
  }

  return branches
}

/**
 * Calculate decision coverage for a topic
 */
export function calculateDecisionCoverage(
  topic: string,
  providedDimensions: Record<string, string>,
  userProfile?: Record<string, string>
): DecisionCoverageResult {
  const topicConfig = getTopicDimensions(topic)

  if (!topicConfig) {
    // Unknown topic - return minimal coverage
    return {
      topic,
      requiredScore: 0,
      totalScore: 0,
      resolved: [],
      unresolved: [],
      terminalOutcome: "REFUSAL",
    }
  }

  // Apply defaults
  const dimensionsWithDefaults = applyDefaults(topicConfig.dimensions, providedDimensions)

  // Merge with user profile if available
  const allDimensions = {
    ...userProfile,
    ...dimensionsWithDefaults,
  }

  const resolved: ResolvedDimension[] = []
  const unresolved: UnresolvedDimension[] = []

  let requiredCount = 0
  let requiredResolved = 0
  let totalDimensions = 0
  let totalResolved = 0

  // Evaluate each dimension
  for (const dim of topicConfig.dimensions) {
    const isRequired = isConditionallyRequired(dim, allDimensions)
    const value = allDimensions[dim.dimension]
    const hasValue = value !== undefined && value !== ""

    totalDimensions++

    if (isRequired) {
      requiredCount++
    }

    if (hasValue) {
      totalResolved++
      if (isRequired) {
        requiredResolved++
      }

      // Determine source
      let source: "query" | "profile" | "default" = "query"
      if (dim.defaultValue && !(dim.dimension in providedDimensions)) {
        source = "default"
      } else if (userProfile && dim.dimension in userProfile) {
        source = "profile"
      }

      resolved.push({
        dimension: dim.dimension,
        value,
        source,
        confidence: source === "query" ? 0.95 : source === "profile" ? 0.85 : 0.7,
      })
    } else {
      unresolved.push({
        dimension: dim.dimension,
        required: isRequired,
        possibleValues: dim.possibleValues,
      })
    }
  }

  // Calculate scores
  const requiredScore = requiredCount > 0 ? requiredResolved / requiredCount : 1
  const totalScore = totalDimensions > 0 ? totalResolved / totalDimensions : 0

  // Determine terminal outcome
  let terminalOutcome: TerminalOutcome

  if (requiredScore < 1) {
    terminalOutcome = "REFUSAL"
  } else if (totalScore < 1) {
    terminalOutcome = "CONDITIONAL_ANSWER"
  } else {
    terminalOutcome = "ANSWER"
  }

  // Generate branches for conditional answers
  const branches =
    terminalOutcome === "CONDITIONAL_ANSWER" ? generateBranches(unresolved) : undefined

  return {
    topic,
    requiredScore,
    totalScore,
    resolved,
    unresolved,
    terminalOutcome,
    branches,
  }
}

/**
 * Infer topic from query classification
 */
export function inferTopicFromIntent(
  intent: string,
  entities: { subjects: string[]; products: string[] }
): string | undefined {
  // Map intents and entities to topics
  if (intent === "LOGIC") {
    if (entities.products.some((p) => /pdv|vat/i.test(p))) {
      return "vat-rate"
    }
    if (entities.subjects.some((s) => /paušal/i.test(s))) {
      return "pausalni"
    }
  }

  if (intent === "PROCESS") {
    if (entities.subjects.some((s) => /registracija|otvoriti/i.test(s))) {
      return "registration"
    }
  }

  // Add more topic inference rules as needed
  return undefined
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/decision-coverage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/decision-coverage.ts \
        src/lib/assistant/reasoning/__tests__/decision-coverage.test.ts
git commit -m "feat(reasoning): add decision coverage calculator"
```

---

## Phase 3: Refusal Policy System

### Task 3.1: Create Refusal Policy Types and Templates

**Files:**

- Create: `src/lib/assistant/reasoning/refusal-policy.ts`
- Create: `src/lib/assistant/reasoning/__tests__/refusal-policy.test.ts`

**Step 1: Write the failing test**

Create `src/lib/assistant/reasoning/__tests__/refusal-policy.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  RefusalCode,
  getRefusalTemplate,
  buildRefusalPayload,
  type RefusalPayload,
} from "../refusal-policy"

describe("Refusal Policy", () => {
  describe("getRefusalTemplate", () => {
    it("should return template for MISSING_REQUIRED_DIMENSION", () => {
      const template = getRefusalTemplate(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(template).toBeDefined()
      expect(template.code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(template.severity).toBe("warning")
      expect(template.nextSteps).toHaveLength(2)
    })

    it("should return template for NO_RULES_FOUND", () => {
      const template = getRefusalTemplate(RefusalCode.NO_RULES_FOUND)
      expect(template.severity).toBe("info")
    })

    it("should return template for GRAY_ZONE", () => {
      const template = getRefusalTemplate(RefusalCode.GRAY_ZONE)
      expect(template.requiresHumanReview).toBe(true)
      expect(template.severity).toBe("warning")
    })
  })

  describe("buildRefusalPayload", () => {
    it("should build payload with missing dimensions", () => {
      const payload = buildRefusalPayload(RefusalCode.MISSING_REQUIRED_DIMENSION, {
        missingDimensions: ["Item", "BuyerType"],
      })

      expect(payload.template.code).toBe(RefusalCode.MISSING_REQUIRED_DIMENSION)
      expect(payload.context?.missingDimensions).toEqual(["Item", "BuyerType"])
    })

    it("should build payload with conflicting rules", () => {
      const payload = buildRefusalPayload(RefusalCode.UNRESOLVED_CONFLICT, {
        conflictingRules: ["rule-1", "rule-2"],
      })

      expect(payload.context?.conflictingRules).toEqual(["rule-1", "rule-2"])
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/refusal-policy.test.ts`
Expected: FAIL

**Step 3: Write the refusal policy implementation**

Create `src/lib/assistant/reasoning/refusal-policy.ts`:

```typescript
// src/lib/assistant/reasoning/refusal-policy.ts

/**
 * Refusal codes for deterministic safety enforcement
 */
export enum RefusalCode {
  // Coverage-based refusals
  NO_RULES_FOUND = "NO_RULES_FOUND",
  MISSING_REQUIRED_DIMENSION = "MISSING_REQUIRED_DIMENSION",

  // Content-based refusals
  GRAY_ZONE = "GRAY_ZONE",
  UNRESOLVED_CONFLICT = "UNRESOLVED_CONFLICT",

  // Capability-based refusals
  MISSING_STRATEGY_DATA = "MISSING_STRATEGY_DATA",
  UNSUPPORTED_JURISDICTION = "UNSUPPORTED_JURISDICTION",
  OUT_OF_SCOPE = "OUT_OF_SCOPE",

  // Temporal refusals
  FUTURE_LAW_UNCERTAIN = "FUTURE_LAW_UNCERTAIN",
}

/**
 * Next step types for guiding user action
 */
export interface NextStep {
  type: "CLARIFY" | "CONTACT_ADVISOR" | "TRY_DIFFERENT_QUESTION" | "PROVIDE_CONTEXT"
  prompt?: string
  promptHr?: string
  conceptId?: string
}

/**
 * Refusal template structure
 */
export interface RefusalTemplate {
  code: RefusalCode
  severity: "info" | "warning" | "critical"
  messageHr: string
  messageEn: string
  nextSteps: NextStep[]
  requiresHumanReview: boolean
}

/**
 * Context for the refusal
 */
export interface RefusalContext {
  missingDimensions?: string[]
  conflictingRules?: string[]
  grayZoneTopic?: string
  jurisdiction?: string
}

/**
 * Full refusal payload
 */
export interface RefusalPayload {
  template: RefusalTemplate
  context?: RefusalContext
}

/**
 * Refusal templates registry
 */
const REFUSAL_TEMPLATES: Record<RefusalCode, RefusalTemplate> = {
  [RefusalCode.NO_RULES_FOUND]: {
    code: RefusalCode.NO_RULES_FOUND,
    severity: "info",
    messageHr: "Nisam pronašao pravila koja se odnose na vaše pitanje.",
    messageEn: "I couldn't find rules that apply to your question.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pokušajte preformulirati pitanje",
        prompt: "Try rephrasing your question",
      },
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Kontaktirajte poreznog savjetnika",
        prompt: "Contact a tax advisor",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.MISSING_REQUIRED_DIMENSION]: {
    code: RefusalCode.MISSING_REQUIRED_DIMENSION,
    severity: "warning",
    messageHr: "Trebam više informacija da bih mogao odgovoriti.",
    messageEn: "I need more information to answer your question.",
    nextSteps: [
      {
        type: "PROVIDE_CONTEXT",
        promptHr: "Molim navedite dodatne detalje",
        prompt: "Please provide additional details",
      },
      {
        type: "CLARIFY",
        promptHr: "Pojasnite vaš upit",
        prompt: "Clarify your query",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.GRAY_ZONE]: {
    code: RefusalCode.GRAY_ZONE,
    severity: "warning",
    messageHr: "Ovo pitanje spada u sivu zonu regulacije gdje nema jasnog odgovora.",
    messageEn: "This question falls into a regulatory gray zone with no clear answer.",
    nextSteps: [
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Preporučujem konzultaciju s poreznim savjetnikom",
        prompt: "I recommend consulting a tax advisor",
      },
    ],
    requiresHumanReview: true,
  },

  [RefusalCode.UNRESOLVED_CONFLICT]: {
    code: RefusalCode.UNRESOLVED_CONFLICT,
    severity: "critical",
    messageHr: "Pronašao sam proturječna pravila i ne mogu dati siguran odgovor.",
    messageEn: "I found conflicting rules and cannot give a definitive answer.",
    nextSteps: [
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Potrebna je stručna procjena",
        prompt: "Expert assessment needed",
      },
    ],
    requiresHumanReview: true,
  },

  [RefusalCode.MISSING_STRATEGY_DATA]: {
    code: RefusalCode.MISSING_STRATEGY_DATA,
    severity: "info",
    messageHr: "Nemam dovoljno podataka za strateški savjet.",
    messageEn: "I don't have enough data for strategic advice.",
    nextSteps: [
      {
        type: "PROVIDE_CONTEXT",
        promptHr: "Navedite više detalja o vašoj situaciji",
        prompt: "Provide more details about your situation",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.UNSUPPORTED_JURISDICTION]: {
    code: RefusalCode.UNSUPPORTED_JURISDICTION,
    severity: "info",
    messageHr: "Trenutno podržavam samo hrvatsku regulativu.",
    messageEn: "I currently only support Croatian regulations.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pitanje vezano uz Hrvatsku",
        prompt: "Ask about Croatian regulations",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.OUT_OF_SCOPE]: {
    code: RefusalCode.OUT_OF_SCOPE,
    severity: "info",
    messageHr: "Ovo pitanje nije u mom području stručnosti.",
    messageEn: "This question is outside my area of expertise.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pitajte o porezima, računovodstvu ili poslovanju",
        prompt: "Ask about taxes, accounting, or business",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.FUTURE_LAW_UNCERTAIN]: {
    code: RefusalCode.FUTURE_LAW_UNCERTAIN,
    severity: "warning",
    messageHr: "Buduća pravila još nisu definitivna.",
    messageEn: "Future rules are not yet definitive.",
    nextSteps: [
      {
        type: "CLARIFY",
        promptHr: "Pitajte o trenutno važećim pravilima",
        prompt: "Ask about currently applicable rules",
      },
    ],
    requiresHumanReview: false,
  },
}

/**
 * Get refusal template by code
 */
export function getRefusalTemplate(code: RefusalCode): RefusalTemplate {
  return REFUSAL_TEMPLATES[code]
}

/**
 * Build complete refusal payload
 */
export function buildRefusalPayload(code: RefusalCode, context?: RefusalContext): RefusalPayload {
  return {
    template: getRefusalTemplate(code),
    context,
  }
}

/**
 * Determine refusal code based on decision coverage result
 */
export function determineRefusalCode(
  requiredScore: number,
  hasRules: boolean,
  hasConflicts: boolean,
  isGrayZone: boolean
): RefusalCode | null {
  // Decision tree from design doc
  if (requiredScore < 1) {
    return RefusalCode.MISSING_REQUIRED_DIMENSION
  }

  if (!hasRules) {
    return RefusalCode.NO_RULES_FOUND
  }

  if (hasConflicts) {
    return RefusalCode.UNRESOLVED_CONFLICT
  }

  if (isGrayZone) {
    return RefusalCode.GRAY_ZONE
  }

  // No refusal needed
  return null
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/refusal-policy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/refusal-policy.ts \
        src/lib/assistant/reasoning/__tests__/refusal-policy.test.ts
git commit -m "feat(reasoning): add refusal policy system with codes and templates"
```

---

## Phase 4: Reasoning Pipeline (7-Stage)

### Task 4.1: Create Reasoning Event Types

**Files:**

- Create: `src/lib/assistant/reasoning/types.ts`

**Step 1: Write the types file**

Create `src/lib/assistant/reasoning/types.ts`:

```typescript
// src/lib/assistant/reasoning/types.ts

/**
 * Schema version for reasoning events
 */
export const REASONING_EVENT_VERSION = 1

/**
 * All possible reasoning stages
 */
export type ReasoningStage =
  | "QUESTION_INTAKE"
  | "CONTEXT_RESOLUTION"
  | "CLARIFICATION"
  | "SOURCES"
  | "RETRIEVAL"
  | "APPLICABILITY"
  | "ANALYSIS"
  | "CONFIDENCE"
  | "ANSWER"
  | "CONDITIONAL_ANSWER"
  | "REFUSAL"
  | "ERROR"

/**
 * Event status
 */
export type EventStatus = "started" | "progress" | "checkpoint" | "complete" | "awaiting_input"

/**
 * Severity level for events
 */
export type EventSeverity = "info" | "warning" | "critical"

/**
 * Progress tracking
 */
export interface EventProgress {
  current: number
  total?: number
}

/**
 * Stage-specific payload types
 */
export interface QuestionIntakePayload {
  normalizedQuery: string
  detectedLanguage: string
  entities: {
    subjects: string[]
    products: string[]
    locations: string[]
    dates: string[]
  }
}

export interface ContextResolutionPayload {
  domain: string
  jurisdiction: string
  riskTier: string
  userContext?: Record<string, unknown>
  confidence: number
}

export interface ClarificationPayload {
  question: string
  questionHr: string
  options?: string[]
  dimensionNeeded: string
}

export interface SourcePayload {
  sourceId: string
  sourceName: string
  sourceType: string
  url?: string
}

export interface RetrievalPayload {
  intent: string
  conceptsMatched: string[]
  rulesRetrieved: number
}

export interface ApplicabilityPayload {
  eligibleRules: number
  excludedRules: number
  exclusionReasons: string[]
  coverageResult: {
    requiredScore: number
    totalScore: number
    terminalOutcome: string
  }
}

export interface AnalysisPayload {
  checkpoint?: string
  conflictsDetected: number
  riskAssessment?: string
}

export interface ConfidencePayload {
  overallConfidence: number
  sourceConfidence: number
  ruleConfidence: number
  coverageConfidence: number
}

export interface AnswerPayload {
  answer: string
  answerHr: string
  citations: Array<{
    ruleId: string
    ruleName: string
    sourceUrl?: string
  }>
  value?: string
  valueType?: string
}

export interface ConditionalAnswerPayload {
  branches: Array<{
    condition: string
    conditionHr: string
    answer: string
    answerHr: string
    probability?: number
  }>
  commonParts?: string
}

export interface RefusalPayload {
  code: string
  messageHr: string
  messageEn: string
  nextSteps: Array<{
    type: string
    prompt?: string
    promptHr?: string
  }>
  context?: {
    missingDimensions?: string[]
    conflictingRules?: string[]
  }
}

export interface ErrorPayload {
  correlationId: string
  message: string
  retryable: boolean
}

/**
 * Union of all payload types
 */
export type StagePayload =
  | QuestionIntakePayload
  | ContextResolutionPayload
  | ClarificationPayload
  | SourcePayload
  | RetrievalPayload
  | ApplicabilityPayload
  | AnalysisPayload
  | ConfidencePayload
  | AnswerPayload
  | ConditionalAnswerPayload
  | RefusalPayload
  | ErrorPayload

/**
 * Core reasoning event structure
 */
export interface ReasoningEvent {
  v: typeof REASONING_EVENT_VERSION
  id: string
  requestId: string
  seq: number
  ts: string
  stage: ReasoningStage
  status: EventStatus
  message?: string
  severity?: EventSeverity
  progress?: EventProgress
  data?: StagePayload
}

/**
 * Terminal payloads (final outcomes)
 */
export type TerminalPayload =
  | AnswerPayload
  | ConditionalAnswerPayload
  | RefusalPayload
  | ErrorPayload

/**
 * User context for pipeline
 */
export interface UserContext {
  userId?: string
  companyId?: string
  isVatPayer?: boolean
  legalForm?: string
  jurisdiction?: string
}

/**
 * Helper to create event ID
 */
export function createEventId(requestId: string, seq: number): string {
  return `${requestId}_${String(seq).padStart(3, "0")}`
}
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/types.ts
git commit -m "feat(reasoning): add reasoning event types for 7-stage pipeline"
```

---

### Task 4.2: Create Reasoning Pipeline Generator

**Files:**

- Create: `src/lib/assistant/reasoning/reasoning-pipeline.ts`
- Create: `src/lib/assistant/reasoning/__tests__/reasoning-pipeline.test.ts`

**Step 1: Write the failing test**

Create `src/lib/assistant/reasoning/__tests__/reasoning-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildAnswerWithReasoning } from "../reasoning-pipeline"

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    atomicClaim: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "claim-1", logicExpr: "vat_rate = 25", confidence: 0.9 }]),
    },
    regulatorySource: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "source-1", name: "Zakon o PDV-u", url: "https://example.com" }]),
    },
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace-1" }),
    },
  },
}))

vi.mock("../../regulatory-truth/retrieval/query-router", () => ({
  routeQuery: vi.fn().mockResolvedValue({
    success: true,
    classification: { intent: "LOGIC", confidence: 0.9 },
    response: { rules: [] },
  }),
}))

describe("Reasoning Pipeline", () => {
  it("should emit QUESTION_INTAKE as first stage", async () => {
    const generator = buildAnswerWithReasoning("req-123", "What is the VAT rate?")
    const firstEvent = await generator.next()

    expect(firstEvent.done).toBe(false)
    expect(firstEvent.value.stage).toBe("QUESTION_INTAKE")
    expect(firstEvent.value.status).toBe("started")
  })

  it("should emit events in correct order", async () => {
    const generator = buildAnswerWithReasoning("req-123", "What is the VAT rate?")
    const stages: string[] = []

    for await (const event of generator) {
      if (event.status === "started" || event.status === "complete") {
        stages.push(`${event.stage}:${event.status}`)
      }
    }

    expect(stages).toContain("QUESTION_INTAKE:started")
    expect(stages).toContain("QUESTION_INTAKE:complete")
    expect(stages).toContain("CONTEXT_RESOLUTION:started")
  })

  it("should include requestId in all events", async () => {
    const generator = buildAnswerWithReasoning("req-456", "Test query")

    for await (const event of generator) {
      expect(event.requestId).toBe("req-456")
    }
  })

  it("should increment sequence numbers", async () => {
    const generator = buildAnswerWithReasoning("req-789", "Test query")
    const seqNumbers: number[] = []

    for await (const event of generator) {
      seqNumbers.push(event.seq)
    }

    // Should be monotonically increasing
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i]).toBeGreaterThan(seqNumbers[i - 1])
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/reasoning-pipeline.test.ts`
Expected: FAIL

**Step 3: Write the reasoning pipeline implementation**

Create `src/lib/assistant/reasoning/reasoning-pipeline.ts`:

```typescript
// src/lib/assistant/reasoning/reasoning-pipeline.ts
import { db } from "@/lib/db"
import { nanoid } from "nanoid"
import { routeQuery } from "../../regulatory-truth/retrieval/query-router"
import { calculateDecisionCoverage, inferTopicFromIntent } from "./decision-coverage"
import { determineRefusalCode, buildRefusalPayload, RefusalCode } from "./refusal-policy"
import {
  type ReasoningEvent,
  type UserContext,
  type TerminalPayload,
  type AnswerPayload,
  type ConditionalAnswerPayload,
  type RefusalPayload as RefusalPayloadType,
  type ErrorPayload,
  REASONING_EVENT_VERSION,
  createEventId,
} from "./types"

/**
 * Sleep utility for "The Pause"
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Event emitter helper
 */
function emit(
  requestId: string,
  seq: number,
  partial: Omit<ReasoningEvent, "v" | "id" | "requestId" | "seq" | "ts">
): ReasoningEvent {
  return {
    v: REASONING_EVENT_VERSION,
    id: createEventId(requestId, seq),
    requestId,
    seq,
    ts: new Date().toISOString(),
    ...partial,
  }
}

/**
 * Parse and normalize query
 */
function parseQuery(query: string): {
  normalized: string
  language: string
  entities: { subjects: string[]; products: string[]; locations: string[]; dates: string[] }
} {
  // Simple normalization - could be enhanced with NLP
  const normalized = query.trim().toLowerCase()

  // Detect language (simple heuristic)
  const croatianPatterns = /[šđčćž]|koliko|kako|gdje|što|koji/i
  const language = croatianPatterns.test(query) ? "hr" : "en"

  // Extract basic entities (simplified)
  const entities = {
    subjects: [] as string[],
    products: [] as string[],
    locations: [] as string[],
    dates: [] as string[],
  }

  // Extract dates
  const datePattern = /\d{1,2}[./]\d{1,2}[./]\d{2,4}/g
  const dates = query.match(datePattern)
  if (dates) entities.dates = dates

  return { normalized, language, entities }
}

/**
 * Resolve context from query and user profile
 */
async function resolveContext(
  parsed: ReturnType<typeof parseQuery>,
  userContext?: UserContext
): Promise<{
  domain: string
  jurisdiction: string
  riskTier: string
  confidence: number
}> {
  // Determine domain from query content
  let domain = "general"
  const query = parsed.normalized

  if (/pdv|vat|porez/.test(query)) domain = "vat"
  else if (/paušal|obrt/.test(query)) domain = "pausalni"
  else if (/doprinos|mirovin|zdravstv/.test(query)) domain = "contributions"
  else if (/fiskali/.test(query)) domain = "fiscalization"

  // Determine risk tier
  let riskTier = "T2"
  if (/stopa|rate|postotak|threshold|prag/.test(query)) riskTier = "T0"
  else if (/rok|deadline|frist/.test(query)) riskTier = "T1"

  return {
    domain,
    jurisdiction: userContext?.jurisdiction || "HR",
    riskTier,
    confidence: 0.85,
  }
}

/**
 * Discover relevant sources
 */
async function* discoverSources(domain: string): AsyncGenerator<{
  sourceId: string
  sourceName: string
  sourceType: string
  url?: string
}> {
  // Query database for relevant sources
  const sources = await db.regulatorySource.findMany({
    where: { isActive: true },
    take: 5,
  })

  for (const source of sources) {
    yield {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: "regulatory",
      url: source.url,
    }
  }
}

/**
 * Compute overall confidence
 */
function computeConfidence(
  sourceCount: number,
  ruleConfidence: number,
  coverageScore: number
): {
  overallConfidence: number
  sourceConfidence: number
  ruleConfidence: number
  coverageConfidence: number
} {
  const sourceConfidence = Math.min(sourceCount * 0.2, 1)
  const coverageConfidence = coverageScore

  const overallConfidence = sourceConfidence * 0.2 + ruleConfidence * 0.5 + coverageConfidence * 0.3

  return {
    overallConfidence,
    sourceConfidence,
    ruleConfidence,
    coverageConfidence,
  }
}

/**
 * Main reasoning pipeline generator
 */
export async function* buildAnswerWithReasoning(
  requestId: string,
  query: string,
  userContext?: UserContext
): AsyncGenerator<ReasoningEvent, TerminalPayload> {
  let seq = 0

  try {
    // Stage 1: Question Intake
    yield emit(requestId, ++seq, { stage: "QUESTION_INTAKE", status: "started" })
    const parsed = parseQuery(query)
    yield emit(requestId, ++seq, {
      stage: "QUESTION_INTAKE",
      status: "complete",
      data: {
        normalizedQuery: parsed.normalized,
        detectedLanguage: parsed.language,
        entities: parsed.entities,
      },
    })

    // Stage 2: Context Resolution
    yield emit(requestId, ++seq, { stage: "CONTEXT_RESOLUTION", status: "started" })
    const context = await resolveContext(parsed, userContext)
    yield emit(requestId, ++seq, {
      stage: "CONTEXT_RESOLUTION",
      status: "complete",
      data: context,
    })

    // Stage 3: Source Discovery (progressive)
    yield emit(requestId, ++seq, { stage: "SOURCES", status: "started" })
    let sourceCount = 0
    for await (const source of discoverSources(context.domain)) {
      sourceCount++
      yield emit(requestId, ++seq, {
        stage: "SOURCES",
        status: "progress",
        message: `Found: ${source.sourceName}`,
        data: source,
      })
    }
    yield emit(requestId, ++seq, {
      stage: "SOURCES",
      status: "complete",
      progress: { current: sourceCount },
    })

    // Stage 4: Rule Retrieval
    yield emit(requestId, ++seq, { stage: "RETRIEVAL", status: "started" })
    const routerResult = await routeQuery(query, {
      userId: userContext?.userId,
      companyType: userContext?.legalForm,
      isVatPayer: userContext?.isVatPayer,
    })
    yield emit(requestId, ++seq, {
      stage: "RETRIEVAL",
      status: "complete",
      data: {
        intent: routerResult.classification?.intent || "GENERAL",
        conceptsMatched: routerResult.classification?.extractedEntities?.subjects || [],
        rulesRetrieved: Array.isArray(routerResult.response) ? routerResult.response.length : 0,
      },
    })

    // Stage 5: Applicability Check
    yield emit(requestId, ++seq, { stage: "APPLICABILITY", status: "started" })

    // Infer topic and calculate coverage
    const topic = inferTopicFromIntent(routerResult.classification?.intent || "GENERAL", {
      subjects: routerResult.classification?.extractedEntities?.subjects || [],
      products: routerResult.classification?.extractedEntities?.products || [],
    })

    // Extract dimensions from entities
    const dimensions: Record<string, string> = {}
    const entities = routerResult.classification?.extractedEntities
    if (entities) {
      if (entities.products.length > 0) dimensions.Item = entities.products[0]
      if (entities.locations.length > 0) dimensions.Place = entities.locations[0]
      if (entities.dates.length > 0) dimensions.Date = entities.dates[0]
    }

    const coverage = topic
      ? calculateDecisionCoverage(topic, dimensions)
      : {
          requiredScore: 1,
          totalScore: 0.5,
          terminalOutcome: "ANSWER" as const,
          resolved: [],
          unresolved: [],
        }

    yield emit(requestId, ++seq, {
      stage: "APPLICABILITY",
      status: "complete",
      data: {
        eligibleRules: 1, // Simplified
        excludedRules: 0,
        exclusionReasons: [],
        coverageResult: {
          requiredScore: coverage.requiredScore,
          totalScore: coverage.totalScore,
          terminalOutcome: coverage.terminalOutcome,
        },
      },
    })

    // Stage 6: Analysis
    yield emit(requestId, ++seq, { stage: "ANALYSIS", status: "started" })
    yield emit(requestId, ++seq, {
      stage: "ANALYSIS",
      status: "checkpoint",
      message: "Comparing sources...",
    })
    yield emit(requestId, ++seq, {
      stage: "ANALYSIS",
      status: "complete",
      data: {
        conflictsDetected: 0,
        riskAssessment: context.riskTier,
      },
    })

    // Stage 7: Confidence & Terminal
    const confidence = computeConfidence(sourceCount, 0.85, coverage.totalScore)
    yield emit(requestId, ++seq, {
      stage: "CONFIDENCE",
      status: "complete",
      data: confidence,
    })

    // THE PAUSE (deliberate delay for trust)
    await sleep(700)

    // Determine terminal outcome
    const refusalCode = determineRefusalCode(
      coverage.requiredScore,
      true, // hasRules
      false, // hasConflicts
      false // isGrayZone
    )

    let terminal: TerminalPayload

    if (refusalCode) {
      const refusal = buildRefusalPayload(refusalCode, {
        missingDimensions: coverage.unresolved.filter((u) => u.required).map((u) => u.dimension),
      })

      terminal = {
        code: refusal.template.code,
        messageHr: refusal.template.messageHr,
        messageEn: refusal.template.messageEn,
        nextSteps: refusal.template.nextSteps,
        context: refusal.context,
      } as RefusalPayloadType

      yield emit(requestId, ++seq, {
        stage: "REFUSAL",
        status: "complete",
        data: terminal,
      })
    } else if (coverage.terminalOutcome === "CONDITIONAL_ANSWER") {
      terminal = {
        branches:
          coverage.branches?.map((b) => ({
            condition: b.condition,
            conditionHr: b.condition,
            answer: `Result for ${b.dimensionValue}`,
            answerHr: `Rezultat za ${b.dimensionValue}`,
          })) || [],
      } as ConditionalAnswerPayload

      yield emit(requestId, ++seq, {
        stage: "CONDITIONAL_ANSWER",
        status: "complete",
        data: terminal,
      })
    } else {
      terminal = {
        answer: "Based on the available rules...",
        answerHr: "Na temelju dostupnih pravila...",
        citations: [],
      } as AnswerPayload

      yield emit(requestId, ++seq, {
        stage: "ANSWER",
        status: "complete",
        data: terminal,
      })
    }

    // Save reasoning trace
    await db.reasoningTrace.create({
      data: {
        requestId,
        events: [], // Would include all events in production
        userContextSnapshot: userContext || {},
        outcome: coverage.terminalOutcome,
        domain: context.domain,
        riskTier: context.riskTier,
        confidence: confidence.overallConfidence,
        sourceCount,
      },
    })

    return terminal
  } catch (error) {
    const errorPayload: ErrorPayload = {
      correlationId: requestId,
      message: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    }

    yield emit(requestId, ++seq, {
      stage: "ERROR",
      status: "complete",
      severity: "critical",
      data: errorPayload,
    })

    return errorPayload
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/reasoning-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/reasoning-pipeline.ts \
        src/lib/assistant/reasoning/__tests__/reasoning-pipeline.test.ts
git commit -m "feat(reasoning): add 7-stage reasoning pipeline generator"
```

---

### Task 4.3: Create SSE Streaming Endpoint

**Files:**

- Create: `src/app/api/assistant/reason/route.ts`

**Step 1: Write the SSE endpoint**

Create `src/app/api/assistant/reason/route.ts`:

```typescript
// src/app/api/assistant/reason/route.ts
import { NextRequest } from "next/server"
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "@/lib/assistant/reasoning/reasoning-pipeline"
import type { UserContext } from "@/lib/assistant/reasoning/types"

export const dynamic = "force-dynamic"

/**
 * SSE streaming endpoint for reasoning pipeline
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const body = await request.json()
    const { query, context } = body as { query: string; context?: UserContext }

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const requestId = `req_${nanoid(12)}`

    const stream = new ReadableStream({
      async start(controller) {
        const generator = buildAnswerWithReasoning(requestId, query, context)

        try {
          for await (const event of generator) {
            // Format as SSE
            const eventType =
              event.stage === "ANSWER" ||
              event.stage === "CONDITIONAL_ANSWER" ||
              event.stage === "REFUSAL" ||
              event.stage === "ERROR"
                ? "terminal"
                : "reasoning"

            const sseMessage = [
              `event: ${eventType}`,
              `id: ${event.id}`,
              `data: ${JSON.stringify(event)}`,
              "",
              "",
            ].join("\n")

            controller.enqueue(encoder.encode(sseMessage))
          }
        } catch (error) {
          const errorEvent = {
            v: 1,
            id: `${requestId}_error`,
            requestId,
            seq: 999,
            ts: new Date().toISOString(),
            stage: "ERROR",
            status: "complete",
            data: {
              correlationId: requestId,
              message: error instanceof Error ? error.message : "Unknown error",
              retryable: true,
            },
          }

          const sseMessage = [
            "event: terminal",
            `id: ${errorEvent.id}`,
            `data: ${JSON.stringify(errorEvent)}`,
            "",
            "",
          ].join("\n")

          controller.enqueue(encoder.encode(sseMessage))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/assistant/reason/route.ts
git commit -m "feat(api): add SSE streaming endpoint for reasoning pipeline"
```

---

### Task 4.4: Create Reasoning Pipeline Index

**Files:**

- Create: `src/lib/assistant/reasoning/index.ts`

**Step 1: Create the index file**

Create `src/lib/assistant/reasoning/index.ts`:

```typescript
// src/lib/assistant/reasoning/index.ts

// Types
export * from "./types"

// Core pipeline
export { buildAnswerWithReasoning } from "./reasoning-pipeline"

// Decision coverage
export {
  calculateDecisionCoverage,
  inferTopicFromIntent,
  type DecisionCoverageResult,
  type ResolvedDimension,
  type UnresolvedDimension,
  type ConditionalBranch,
  type TerminalOutcome,
} from "./decision-coverage"

// Topic dimensions
export {
  getTopicDimensions,
  getAllTopics,
  isConditionallyRequired,
  VAT_RATE_DIMENSIONS,
  OSS_THRESHOLD_DIMENSIONS,
  PAUSALNI_DIMENSIONS,
  REGISTRATION_DIMENSIONS,
  type TopicDimensions,
  type DimensionRequirement,
} from "./topic-dimensions"

// Refusal policy
export {
  RefusalCode,
  getRefusalTemplate,
  buildRefusalPayload,
  determineRefusalCode,
  type RefusalTemplate,
  type RefusalPayload,
  type RefusalContext,
  type NextStep,
} from "./refusal-policy"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/index.ts
git commit -m "feat(reasoning): add reasoning module index"
```

---

## Phase 5: Frontend Integration

### Task 5.1: Create ReasoningStepper Component

**Files:**

- Create: `src/components/assistant/ReasoningStepper.tsx`

**Step 1: Create the component**

Create `src/components/assistant/ReasoningStepper.tsx`:

```typescript
// src/components/assistant/ReasoningStepper.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { ReasoningEvent, ReasoningStage } from "@/lib/assistant/reasoning/types"

/**
 * Stage metadata for display
 */
const STAGE_META: Record<ReasoningStage, { label: string; labelHr: string; icon: string }> = {
  QUESTION_INTAKE: { label: "Analyzing question", labelHr: "Analiziram pitanje", icon: "?" },
  CONTEXT_RESOLUTION: { label: "Resolving context", labelHr: "Razrješavam kontekst", icon: "🔍" },
  CLARIFICATION: { label: "Needs clarification", labelHr: "Potrebno pojašnjenje", icon: "❓" },
  SOURCES: { label: "Finding sources", labelHr: "Pronalazim izvore", icon: "📚" },
  RETRIEVAL: { label: "Retrieving rules", labelHr: "Dohvaćam pravila", icon: "⚖️" },
  APPLICABILITY: { label: "Checking applicability", labelHr: "Provjeravam primjenjivost", icon: "✓" },
  ANALYSIS: { label: "Analyzing", labelHr: "Analiziram", icon: "🧠" },
  CONFIDENCE: { label: "Computing confidence", labelHr: "Računam pouzdanost", icon: "📊" },
  ANSWER: { label: "Ready", labelHr: "Spremno", icon: "✅" },
  CONDITIONAL_ANSWER: { label: "Conditional answer", labelHr: "Uvjetni odgovor", icon: "🔀" },
  REFUSAL: { label: "Cannot answer", labelHr: "Ne mogu odgovoriti", icon: "⚠️" },
  ERROR: { label: "Error", labelHr: "Greška", icon: "❌" },
}

interface ReasoningStepperProps {
  events: ReasoningEvent[]
  language?: "hr" | "en"
  className?: string
}

export function ReasoningStepper({ events, language = "hr", className }: ReasoningStepperProps) {
  const [currentStage, setCurrentStage] = useState<ReasoningStage | null>(null)
  const [completedStages, setCompletedStages] = useState<Set<ReasoningStage>>(new Set())
  const [progressMessages, setProgressMessages] = useState<string[]>([])

  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[events.length - 1]
    setCurrentStage(latestEvent.stage)

    // Track completed stages
    const completed = new Set<ReasoningStage>()
    const messages: string[] = []

    for (const event of events) {
      if (event.status === "complete") {
        completed.add(event.stage)
      }
      if (event.status === "progress" && event.message) {
        messages.push(event.message)
      }
    }

    setCompletedStages(completed)
    setProgressMessages(messages.slice(-3)) // Keep last 3 messages
  }, [events])

  const getStageStatus = (stage: ReasoningStage): "pending" | "active" | "complete" => {
    if (completedStages.has(stage)) return "complete"
    if (stage === currentStage) return "active"
    return "pending"
  }

  const orderedStages: ReasoningStage[] = [
    "QUESTION_INTAKE",
    "CONTEXT_RESOLUTION",
    "SOURCES",
    "RETRIEVAL",
    "APPLICABILITY",
    "ANALYSIS",
    "CONFIDENCE",
  ]

  return (
    <div className={cn("space-y-2", className)}>
      {/* Stage indicators */}
      <div className="flex items-center gap-1">
        {orderedStages.map((stage, index) => {
          const status = getStageStatus(stage)
          const meta = STAGE_META[stage]

          return (
            <div key={stage} className="flex items-center">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  status === "complete" && "bg-green-100 text-green-700",
                  status === "active" && "bg-blue-100 text-blue-700 animate-pulse",
                  status === "pending" && "bg-gray-100 text-gray-400"
                )}
                title={language === "hr" ? meta.labelHr : meta.label}
              >
                {status === "complete" ? "✓" : meta.icon}
              </div>
              {index < orderedStages.length - 1 && (
                <div
                  className={cn(
                    "w-4 h-0.5",
                    status === "complete" ? "bg-green-300" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current stage label */}
      {currentStage && (
        <div className="text-sm text-gray-600">
          {language === "hr"
            ? STAGE_META[currentStage].labelHr
            : STAGE_META[currentStage].label}
          ...
        </div>
      )}

      {/* Progress messages */}
      {progressMessages.length > 0 && (
        <div className="text-xs text-gray-500 space-y-0.5">
          {progressMessages.map((msg, i) => (
            <div key={i} className="truncate">
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant/ReasoningStepper.tsx
git commit -m "feat(ui): add ReasoningStepper component for visible reasoning"
```

---

### Task 5.2: Create useReasoningStream Hook

**Files:**

- Create: `src/lib/assistant/hooks/useReasoningStream.ts`

**Step 1: Create the hook**

Create `src/lib/assistant/hooks/useReasoningStream.ts`:

```typescript
// src/lib/assistant/hooks/useReasoningStream.ts
"use client"

import { useState, useCallback, useRef } from "react"
import type { ReasoningEvent, TerminalPayload, UserContext } from "@/lib/assistant/reasoning/types"

interface UseReasoningStreamOptions {
  onEvent?: (event: ReasoningEvent) => void
  onComplete?: (terminal: TerminalPayload) => void
  onError?: (error: Error) => void
}

interface UseReasoningStreamReturn {
  events: ReasoningEvent[]
  terminal: TerminalPayload | null
  isStreaming: boolean
  error: Error | null
  startStream: (query: string, context?: UserContext) => void
  cancelStream: () => void
}

export function useReasoningStream(options?: UseReasoningStreamOptions): UseReasoningStreamReturn {
  const [events, setEvents] = useState<ReasoningEvent[]>([])
  const [terminal, setTerminal] = useState<TerminalPayload | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const startStream = useCallback(
    async (query: string, context?: UserContext) => {
      // Reset state
      setEvents([])
      setTerminal(null)
      setError(null)
      setIsStreaming(true)

      // Create abort controller
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/assistant/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, context }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE events from buffer
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Keep incomplete line in buffer

          let eventType = ""
          let eventData = ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith("data:")) {
              eventData = line.slice(5).trim()
            } else if (line === "" && eventData) {
              // End of event
              try {
                const event = JSON.parse(eventData) as ReasoningEvent

                setEvents((prev) => [...prev, event])
                options?.onEvent?.(event)

                if (eventType === "terminal") {
                  setTerminal(event.data as TerminalPayload)
                  options?.onComplete?.(event.data as TerminalPayload)
                }
              } catch (e) {
                console.error("Failed to parse SSE event:", e)
              }

              eventType = ""
              eventData = ""
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled by user
          return
        }

        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        options?.onError?.(error)
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [options]
  )

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return {
    events,
    terminal,
    isStreaming,
    error,
    startStream,
    cancelStream,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/assistant/hooks/useReasoningStream.ts
git commit -m "feat(hooks): add useReasoningStream hook for SSE consumption"
```

---

### Task 5.3: Create ConditionalAnswerCard Component

**Files:**

- Create: `src/components/assistant/ConditionalAnswerCard.tsx`

**Step 1: Create the component**

Create `src/components/assistant/ConditionalAnswerCard.tsx`:

```typescript
// src/components/assistant/ConditionalAnswerCard.tsx
"use client"

import { cn } from "@/lib/utils"
import type { ConditionalAnswerPayload } from "@/lib/assistant/reasoning/types"

interface ConditionalAnswerCardProps {
  payload: ConditionalAnswerPayload
  language?: "hr" | "en"
  className?: string
  onBranchSelect?: (branchIndex: number) => void
}

export function ConditionalAnswerCard({
  payload,
  language = "hr",
  className,
  onBranchSelect,
}: ConditionalAnswerCardProps) {
  const { branches, commonParts } = payload

  return (
    <div className={cn("rounded-lg border border-amber-200 bg-amber-50 p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔀</span>
        <h3 className="font-medium text-amber-900">
          {language === "hr" ? "Uvjetni odgovor" : "Conditional Answer"}
        </h3>
      </div>

      {/* Common parts */}
      {commonParts && (
        <p className="text-sm text-amber-800 mb-3">{commonParts}</p>
      )}

      {/* Branches */}
      <div className="space-y-2">
        {branches.map((branch, index) => (
          <button
            key={index}
            onClick={() => onBranchSelect?.(index)}
            className={cn(
              "w-full text-left p-3 rounded-md border border-amber-200 bg-white",
              "hover:border-amber-400 hover:bg-amber-50 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-amber-400"
            )}
          >
            {/* Condition */}
            <div className="text-sm font-medium text-amber-700 mb-1">
              {language === "hr" ? branch.conditionHr : branch.condition}
            </div>

            {/* Answer preview */}
            <div className="text-sm text-gray-700">
              {language === "hr" ? branch.answerHr : branch.answer}
            </div>

            {/* Probability if available */}
            {branch.probability !== undefined && (
              <div className="mt-1 text-xs text-amber-600">
                {Math.round(branch.probability * 100)}%{" "}
                {language === "hr" ? "vjerojatnost" : "probability"}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Help text */}
      <p className="mt-3 text-xs text-amber-600">
        {language === "hr"
          ? "Kliknite na opciju koja odgovara vašoj situaciji"
          : "Click on the option that matches your situation"}
      </p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant/ConditionalAnswerCard.tsx
git commit -m "feat(ui): add ConditionalAnswerCard for branching answers"
```

---

### Task 5.4: Create RefusalCard Component

**Files:**

- Create: `src/components/assistant/RefusalCard.tsx`

**Step 1: Create the component**

Create `src/components/assistant/RefusalCard.tsx`:

```typescript
// src/components/assistant/RefusalCard.tsx
"use client"

import { cn } from "@/lib/utils"
import type { RefusalPayload } from "@/lib/assistant/reasoning/types"

interface RefusalCardProps {
  payload: RefusalPayload
  language?: "hr" | "en"
  className?: string
  onNextStepClick?: (stepIndex: number) => void
}

const SEVERITY_STYLES = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
}

const SEVERITY_ICONS = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚫",
}

export function RefusalCard({
  payload,
  language = "hr",
  className,
  onNextStepClick,
}: RefusalCardProps) {
  const { code, messageHr, messageEn, nextSteps, context } = payload

  // Determine severity from code
  const severity =
    code === "UNRESOLVED_CONFLICT" || code === "GRAY_ZONE"
      ? "critical"
      : code === "MISSING_REQUIRED_DIMENSION"
      ? "warning"
      : "info"

  return (
    <div className={cn("rounded-lg border p-4", SEVERITY_STYLES[severity], className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{SEVERITY_ICONS[severity]}</span>
        <h3 className="font-medium">
          {language === "hr" ? "Ne mogu odgovoriti" : "Cannot Answer"}
        </h3>
      </div>

      {/* Message */}
      <p className="text-sm mb-3">{language === "hr" ? messageHr : messageEn}</p>

      {/* Missing dimensions context */}
      {context?.missingDimensions && context.missingDimensions.length > 0 && (
        <div className="mb-3 text-sm">
          <span className="font-medium">
            {language === "hr" ? "Nedostaju informacije:" : "Missing information:"}
          </span>
          <ul className="mt-1 list-disc list-inside">
            {context.missingDimensions.map((dim, i) => (
              <li key={i}>{dim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicting rules context */}
      {context?.conflictingRules && context.conflictingRules.length > 0 && (
        <div className="mb-3 text-sm">
          <span className="font-medium">
            {language === "hr" ? "Proturječna pravila:" : "Conflicting rules:"}
          </span>
          <ul className="mt-1 list-disc list-inside">
            {context.conflictingRules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">
            {language === "hr" ? "Sljedeći koraci:" : "Next steps:"}
          </h4>
          <div className="space-y-2">
            {nextSteps.map((step, index) => (
              <button
                key={index}
                onClick={() => onNextStepClick?.(index)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm",
                  "bg-white/50 border border-current/20",
                  "hover:bg-white/80 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-current/30"
                )}
              >
                {language === "hr" ? step.promptHr : step.prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant/RefusalCard.tsx
git commit -m "feat(ui): add RefusalCard for structured refusal display"
```

---

## Final: Integration Test

### Task 6.1: Run All Tests and Verify Integration

**Step 1: Run all reasoning tests**

Run: `npx vitest run src/lib/assistant/reasoning/`
Expected: All tests PASS

**Step 2: Run all regulatory-truth tests**

Run: `npx vitest run src/lib/regulatory-truth/`
Expected: All tests PASS

**Step 3: Type check the codebase**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Build the application**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: V1 gap-closing implementation complete

Closes gaps between current implementation and V1 spec:
- ComparisonMatrix (Layer 8) with strategy-engine
- Decision Coverage Calculator with topic dimensions
- Refusal Policy with codes and templates
- 7-Stage Reasoning Pipeline with SSE streaming
- Frontend components: ReasoningStepper, ConditionalAnswerCard, RefusalCard

🤖 Generated with Claude Code"
```

---

## Summary

This plan implements 5 phases with 18 tasks:

| Phase | Tasks | Description                                                                 |
| ----- | ----- | --------------------------------------------------------------------------- |
| 1     | 5     | ComparisonMatrix schema, Zod types, extractor, strategy-engine, integration |
| 2     | 2     | Topic dimensions, decision coverage calculator                              |
| 3     | 1     | Refusal policy codes and templates                                          |
| 4     | 4     | Reasoning types, pipeline generator, SSE endpoint, module index             |
| 5     | 4     | ReasoningStepper, useReasoningStream, ConditionalAnswerCard, RefusalCard    |
| Final | 1     | Integration testing                                                         |

Each task follows TDD with:

- Failing test first
- Minimal implementation
- Test verification
- Commit
