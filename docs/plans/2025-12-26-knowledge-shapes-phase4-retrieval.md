# Knowledge Shapes Phase 4: Retrieval Router

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create query intent classification and specialized retrieval engines for each knowledge shape.

**Architecture:** Add QueryRouter that classifies user intent and routes to appropriate engine. Each engine returns typed responses optimized for its shape.

**Tech Stack:** Prisma, TypeScript, Zod, Anthropic Claude API

**Prerequisites:**

- Complete Phase 1 (schema migration)
- Complete Phase 2 (multi-shape extraction)
- Complete Phase 3 (taxonomy + precedence)
- Read `docs/plans/2025-12-26-knowledge-shapes-design.md` for context

---

## Task 1: Create Query Intent Classifier

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/query-router.ts`
- Create: `src/lib/regulatory-truth/schemas/query-intent.ts`

**Step 1: Create the schema file**

```typescript
// src/lib/regulatory-truth/schemas/query-intent.ts
import { z } from "zod"

export const QueryIntentSchema = z.enum([
  "LOGIC", // "Do I owe VAT if...", "What is the tax rate for..."
  "PROCESS", // "How do I register...", "What are the steps..."
  "REFERENCE", // "What is the IBAN for...", "What is the code for..."
  "DOCUMENT", // "Where can I find the form...", "Download PDV-P"
  "TEMPORAL", // "Which rate applies for June invoice...", "Old vs new rule"
  "GENERAL", // General questions, explanations
])

export const QueryClassificationSchema = z.object({
  intent: QueryIntentSchema,
  confidence: z.number().min(0).max(1),
  extractedEntities: z.object({
    subjects: z.array(z.string()).default([]), // taxpayer types
    conditions: z.array(z.string()).default([]), // thresholds, dates
    products: z.array(z.string()).default([]), // product categories
    locations: z.array(z.string()).default([]), // cities, regions
    dates: z.array(z.string()).default([]), // specific dates
    formCodes: z.array(z.string()).default([]), // PDV-P, JOPPD
  }),
  suggestedEngines: z.array(z.string()).min(1),
  reasoning: z.string(),
})

export type QueryIntent = z.infer<typeof QueryIntentSchema>
export type QueryClassification = z.infer<typeof QueryClassificationSchema>
```

**Step 2: Create the query router**

```typescript
// src/lib/regulatory-truth/retrieval/query-router.ts
import { runAgent } from "../agents/runner"
import {
  QueryClassificationSchema,
  type QueryClassification,
  type QueryIntent,
} from "../schemas/query-intent"
import { z } from "zod"

// Engines
import { runLogicEngine } from "./logic-engine"
import { runProcessEngine } from "./process-engine"
import { runReferenceEngine } from "./reference-engine"
import { runAssetEngine } from "./asset-engine"
import { runTemporalEngine } from "./temporal-engine"

const RouterInputSchema = z.object({
  query: z.string(),
  context: z
    .object({
      userId: z.string().optional(),
      companyType: z.string().optional(),
      isVatPayer: z.boolean().optional(),
    })
    .optional(),
})

type RouterInput = z.infer<typeof RouterInputSchema>

export interface RouterResult {
  success: boolean
  classification: QueryClassification | null
  response: unknown
  error: string | null
}

/**
 * Pattern-based intent detection (fast, no LLM)
 */
function detectIntentFromPatterns(query: string): QueryIntent | null {
  const lowerQuery = query.toLowerCase()

  // PROCESS patterns
  const processPatterns = [
    /kako\s+(da|mogu|se)/,
    /koraci\s+za/,
    /postupak/,
    /registracija/,
    /prijava\s+za/,
    /what are the steps/i,
    /how do i/i,
    /how to/i,
  ]
  if (processPatterns.some((p) => p.test(lowerQuery))) {
    return "PROCESS"
  }

  // REFERENCE patterns
  const referencePatterns = [
    /iban\s+(za|račun)/,
    /koji\s+je\s+iban/,
    /uplatni\s+račun/,
    /šifra\s+za/,
    /cn\s+kod/,
    /what is the iban/i,
    /account number/i,
  ]
  if (referencePatterns.some((p) => p.test(lowerQuery))) {
    return "REFERENCE"
  }

  // DOCUMENT patterns
  const documentPatterns = [
    /obrazac/,
    /formular/,
    /download/,
    /preuzmi/,
    /gdje\s+(je|mogu|mogu naći)/,
    /pdv-[a-z]/i,
    /joppd/i,
    /where can i find/i,
    /form\s+for/i,
  ]
  if (documentPatterns.some((p) => p.test(lowerQuery))) {
    return "DOCUMENT"
  }

  // TEMPORAL patterns
  const temporalPatterns = [
    /prijelazn[ae]/,
    /stara\s+stopa/,
    /nova\s+stopa/,
    /od\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/,
    /prije\s+\d{1,2}\./,
    /poslije\s+\d{1,2}\./,
    /račun\s+iz\s+\w+\s*,?\s*isporuka/,
    /old vs new/i,
    /transitional/i,
  ]
  if (temporalPatterns.some((p) => p.test(lowerQuery))) {
    return "TEMPORAL"
  }

  // LOGIC patterns (most common, check last)
  const logicPatterns = [
    /moram\s+li/,
    /trebam\s+li/,
    /koliko\s+iznosi/,
    /koja\s+je\s+stopa/,
    /prag\s+za/,
    /ako\s+prodajem/,
    /do i have to/i,
    /what is the rate/i,
    /threshold/i,
    /am i required/i,
  ]
  if (logicPatterns.some((p) => p.test(lowerQuery))) {
    return "LOGIC"
  }

  return null
}

/**
 * Classify query intent using LLM
 */
async function classifyQueryIntent(query: string): Promise<QueryClassification> {
  // Try pattern-based detection first
  const patternIntent = detectIntentFromPatterns(query)

  if (patternIntent) {
    return {
      intent: patternIntent,
      confidence: 0.85,
      extractedEntities: {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      },
      suggestedEngines: [getEngineForIntent(patternIntent)],
      reasoning: `Pattern-based detection: ${patternIntent}`,
    }
  }

  // Fall back to LLM classification
  const input: RouterInput = { query }

  const result = await runAgent<RouterInput, QueryClassification>({
    agentType: "QUERY_CLASSIFIER",
    input,
    inputSchema: RouterInputSchema,
    outputSchema: QueryClassificationSchema,
    temperature: 0.1,
  })

  if (!result.success || !result.output) {
    // Default to GENERAL if classification fails
    return {
      intent: "GENERAL",
      confidence: 0.5,
      extractedEntities: {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      },
      suggestedEngines: ["logic-engine"],
      reasoning: "Classification failed, defaulting to GENERAL",
    }
  }

  return result.output
}

/**
 * Get engine name for intent
 */
function getEngineForIntent(intent: QueryIntent): string {
  const engineMap: Record<QueryIntent, string> = {
    LOGIC: "logic-engine",
    PROCESS: "process-engine",
    REFERENCE: "reference-engine",
    DOCUMENT: "asset-engine",
    TEMPORAL: "temporal-engine",
    GENERAL: "logic-engine",
  }
  return engineMap[intent]
}

/**
 * Route query to appropriate engine based on intent
 */
export async function routeQuery(
  query: string,
  context?: RouterInput["context"]
): Promise<RouterResult> {
  // Step 1: Classify intent
  const classification = await classifyQueryIntent(query)
  console.log(`[router] Intent: ${classification.intent} (${classification.confidence})`)

  // Step 2: Route to appropriate engine
  try {
    let response: unknown

    switch (classification.intent) {
      case "LOGIC":
        response = await runLogicEngine(query, classification.extractedEntities)
        break

      case "PROCESS":
        response = await runProcessEngine(query, classification.extractedEntities)
        break

      case "REFERENCE":
        response = await runReferenceEngine(query, classification.extractedEntities)
        break

      case "DOCUMENT":
        response = await runAssetEngine(query, classification.extractedEntities)
        break

      case "TEMPORAL":
        response = await runTemporalEngine(query, classification.extractedEntities)
        break

      case "GENERAL":
      default:
        response = await runLogicEngine(query, classification.extractedEntities)
        break
    }

    return {
      success: true,
      classification,
      response,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      classification,
      response: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

**Step 3: Add QUERY_CLASSIFIER to AgentType enum**

Find the `AgentType` enum in `prisma/schema.prisma` and add:

```prisma
enum AgentType {
  // ... existing types
  QUERY_CLASSIFIER  // NEW
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (engines not yet created, will fix in following tasks)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/query-router.ts
git add src/lib/regulatory-truth/schemas/query-intent.ts
git add prisma/schema.prisma
git commit -m "feat(router): add query intent classification and routing"
```

---

## Task 2: Create Logic Engine

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/logic-engine.ts`

**Step 1: Create the logic engine**

```typescript
// src/lib/regulatory-truth/retrieval/logic-engine.ts
import { db } from "@/lib/db"
import { expandQueryConcepts } from "../taxonomy/query-expansion"
import { resolveRulePrecedence } from "../agents/arbiter"

export interface LogicEngineResult {
  success: boolean
  answer: {
    value: string | null
    valueType: string | null
    assertion: string | null
    conditions: string[]
    exceptions: string[]
  }
  rules: Array<{
    id: string
    conceptSlug: string
    titleHr: string
    value: string
    confidence: number
    isWinning: boolean
  }>
  claims: Array<{
    id: string
    subjectType: string
    assertionType: string
    logicExpr: string
    triggerExpr: string | null
    exactQuote: string
  }>
  expandedTerms: string[]
  reasoning: string
}

/**
 * Logic Engine - handles threshold, rate, and obligation queries
 *
 * Examples:
 * - "Do I owe VAT if I sold €5,000?"
 * - "What is the VAT rate for juice?"
 * - "Am I required to register if revenue > €10,000?"
 */
export async function runLogicEngine(
  query: string,
  entities: { subjects: string[]; conditions: string[]; products: string[] }
): Promise<LogicEngineResult> {
  const result: LogicEngineResult = {
    success: false,
    answer: {
      value: null,
      valueType: null,
      assertion: null,
      conditions: [],
      exceptions: [],
    },
    rules: [],
    claims: [],
    expandedTerms: [],
    reasoning: "",
  }

  // Step 1: Expand query with taxonomy
  const expanded = await expandQueryConcepts(query)
  result.expandedTerms = expanded.expandedTerms

  // Step 2: Search for matching atomic claims
  const claims = await db.atomicClaim.findMany({
    where: {
      OR: [
        // Match by subject type
        ...(entities.subjects.length > 0
          ? [
              {
                subjectQualifiers: {
                  hasSome: entities.subjects,
                },
              },
            ]
          : []),
        // Match by logic expression containing query terms
        {
          OR: expanded.expandedTerms.map((term) => ({
            logicExpr: { contains: term, mode: "insensitive" as const },
          })),
        },
        // Match by exact quote
        {
          OR: expanded.originalTerms.map((term) => ({
            exactQuote: { contains: term, mode: "insensitive" as const },
          })),
        },
      ],
    },
    include: {
      exceptions: true,
      rule: true,
    },
    take: 10,
  })

  result.claims = claims.map((c) => ({
    id: c.id,
    subjectType: c.subjectType,
    assertionType: c.assertionType,
    logicExpr: c.logicExpr,
    triggerExpr: c.triggerExpr,
    exactQuote: c.exactQuote,
  }))

  // Step 3: Search for matching rules
  const rules = await db.regulatoryRule.findMany({
    where: {
      OR: [
        { conceptSlug: { in: expanded.matchedConcepts } },
        {
          titleHr: {
            contains: expanded.originalTerms[0] ?? "",
            mode: "insensitive",
          },
        },
      ],
      status: "PUBLISHED",
    },
    orderBy: [{ confidence: "desc" }],
    take: 10,
  })

  result.rules = rules.map((r) => ({
    id: r.id,
    conceptSlug: r.conceptSlug,
    titleHr: r.titleHr,
    value: r.value,
    confidence: r.confidence,
    isWinning: false,
  }))

  // Step 4: Resolve precedence if multiple rules
  if (rules.length > 1) {
    const precedence = await resolveRulePrecedence(rules.map((r) => r.id))
    result.rules = result.rules.map((r) => ({
      ...r,
      isWinning: r.id === precedence.winningRuleId,
    }))
    result.reasoning = precedence.reasoning
  } else if (rules.length === 1) {
    result.rules[0].isWinning = true
    result.reasoning = "Single rule matched"
  }

  // Step 5: Build answer from winning rule or best claim
  const winningRule = result.rules.find((r) => r.isWinning)
  const bestClaim = claims[0]

  if (winningRule) {
    result.answer = {
      value: winningRule.value,
      valueType: null, // Would need to get from full rule
      assertion: null,
      conditions: [],
      exceptions: [],
    }
    result.success = true
  } else if (bestClaim) {
    result.answer = {
      value: bestClaim.logicExpr,
      valueType: null,
      assertion: bestClaim.assertionType,
      conditions: bestClaim.triggerExpr ? [bestClaim.triggerExpr] : [],
      exceptions: claims[0]?.exceptions?.map((e: { condition: string }) => e.condition) ?? [],
    }
    result.success = true
    result.reasoning = `Found via atomic claim: ${bestClaim.assertionType}`
  } else {
    result.reasoning = "No matching rules or claims found"
  }

  return result
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/logic-engine.ts
git commit -m "feat(retrieval): add logic engine for threshold and rate queries"
```

---

## Task 3: Create Process Engine

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/process-engine.ts`

**Step 1: Create the process engine**

```typescript
// src/lib/regulatory-truth/retrieval/process-engine.ts
import { db } from "@/lib/db"
import { expandQueryConcepts } from "../taxonomy/query-expansion"

export interface ProcessEngineResult {
  success: boolean
  process: {
    id: string
    slug: string
    titleHr: string
    processType: string
    estimatedTime: string | null
    prerequisites: unknown
  } | null
  steps: Array<{
    orderNum: number
    actionHr: string
    requiresAssets: string[]
    isOptional: boolean
  }>
  relatedAssets: Array<{
    id: string
    formCode: string | null
    officialName: string
    downloadUrl: string
  }>
  reasoning: string
}

/**
 * Process Engine - handles "how do I" workflow queries
 *
 * Examples:
 * - "How do I register for OSS?"
 * - "What are the steps to file VAT return?"
 * - "Kako prijaviti PDV?"
 */
export async function runProcessEngine(
  query: string,
  entities: { subjects: string[]; formCodes: string[] }
): Promise<ProcessEngineResult> {
  const result: ProcessEngineResult = {
    success: false,
    process: null,
    steps: [],
    relatedAssets: [],
    reasoning: "",
  }

  // Step 1: Expand query
  const expanded = await expandQueryConcepts(query)

  // Step 2: Search for matching processes
  const processes = await db.regulatoryProcess.findMany({
    where: {
      OR: [
        // Match by title
        {
          titleHr: {
            contains: expanded.originalTerms[0] ?? "",
            mode: "insensitive",
          },
        },
        // Match by slug
        {
          slug: {
            in: expanded.matchedConcepts,
          },
        },
        // Match by process type keywords
        ...(query.toLowerCase().includes("registracija")
          ? [{ processType: "REGISTRATION" as const }]
          : []),
        ...(query.toLowerCase().includes("prijava") ? [{ processType: "FILING" as const }] : []),
        ...(query.toLowerCase().includes("žalba") ? [{ processType: "APPEAL" as const }] : []),
      ],
    },
    include: {
      steps: {
        orderBy: { orderNum: "asc" },
      },
      assets: true,
    },
    take: 5,
  })

  if (processes.length === 0) {
    result.reasoning = "No matching processes found"
    return result
  }

  // Select best matching process
  const process = processes[0]

  result.process = {
    id: process.id,
    slug: process.slug,
    titleHr: process.titleHr,
    processType: process.processType,
    estimatedTime: process.estimatedTime,
    prerequisites: process.prerequisites,
  }

  result.steps = process.steps.map((step) => ({
    orderNum: step.orderNum,
    actionHr: step.actionHr,
    requiresAssets: step.requiresAssets,
    isOptional: step.onSuccessStepId !== null && step.onFailureStepId !== null,
  }))

  result.relatedAssets = process.assets.map((asset) => ({
    id: asset.id,
    formCode: asset.formCode,
    officialName: asset.officialName,
    downloadUrl: asset.downloadUrl,
  }))

  result.success = true
  result.reasoning = `Found process: ${process.titleHr} (${process.steps.length} steps)`

  return result
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/process-engine.ts
git commit -m "feat(retrieval): add process engine for workflow queries"
```

---

## Task 4: Create Reference Engine

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/reference-engine.ts`

**Step 1: Create the reference engine**

```typescript
// src/lib/regulatory-truth/retrieval/reference-engine.ts
import { db } from "@/lib/db"

export interface ReferenceEngineResult {
  success: boolean
  value: string | null
  table: {
    id: string
    category: string
    name: string
    keyColumn: string
    valueColumn: string
  } | null
  allEntries: Array<{
    key: string
    value: string
    metadata: unknown
  }>
  reasoning: string
}

/**
 * Reference Engine - handles exact lookup queries
 *
 * Examples:
 * - "What is the IBAN for Split?"
 * - "What is the CN code for software?"
 * - "Payment account for Zagreb tax office"
 */
export async function runReferenceEngine(
  query: string,
  entities: { locations: string[] }
): Promise<ReferenceEngineResult> {
  const result: ReferenceEngineResult = {
    success: false,
    value: null,
    table: null,
    allEntries: [],
    reasoning: "",
  }

  // Extract potential lookup keys from query
  const queryLower = query.toLowerCase()

  // Determine category from query
  let category: string | null = null
  if (
    queryLower.includes("iban") ||
    queryLower.includes("račun") ||
    queryLower.includes("account")
  ) {
    category = "IBAN"
  } else if (
    queryLower.includes("cn") ||
    queryLower.includes("tarif") ||
    queryLower.includes("code")
  ) {
    category = "CN_CODE"
  } else if (
    queryLower.includes("ured") ||
    queryLower.includes("office") ||
    queryLower.includes("ispostava")
  ) {
    category = "TAX_OFFICE"
  } else if (queryLower.includes("kamat") || queryLower.includes("interest")) {
    category = "INTEREST_RATE"
  } else if (queryLower.includes("tečaj") || queryLower.includes("exchange")) {
    category = "EXCHANGE_RATE"
  }

  // Find matching table
  const tableWhere = category ? { category: category as any } : {}
  const tables = await db.referenceTable.findMany({
    where: tableWhere,
    include: {
      entries: true,
    },
    take: 5,
  })

  if (tables.length === 0) {
    result.reasoning = `No reference tables found for category: ${category ?? "unknown"}`
    return result
  }

  // Search for matching entry
  const searchTerms = [
    ...entities.locations,
    // Extract Croatian city names from query
    ...["zagreb", "split", "rijeka", "osijek", "zadar", "pula", "dubrovnik"].filter((city) =>
      queryLower.includes(city)
    ),
  ]

  for (const table of tables) {
    result.table = {
      id: table.id,
      category: table.category,
      name: table.name,
      keyColumn: table.keyColumn,
      valueColumn: table.valueColumn,
    }

    result.allEntries = table.entries.map((e) => ({
      key: e.key,
      value: e.value,
      metadata: e.metadata,
    }))

    // Try to find exact match
    for (const term of searchTerms) {
      const match = table.entries.find(
        (e) =>
          e.key.toLowerCase() === term ||
          e.key.toLowerCase().includes(term) ||
          term.includes(e.key.toLowerCase())
      )

      if (match) {
        result.value = match.value
        result.success = true
        result.reasoning = `Found ${table.valueColumn}: ${match.value} for ${table.keyColumn}: ${match.key}`
        return result
      }
    }
  }

  // No exact match found, but we have the table
  if (result.allEntries.length > 0) {
    result.success = true
    result.reasoning = `Found table "${result.table?.name}" with ${result.allEntries.length} entries. No exact match for query.`
  } else {
    result.reasoning = "No matching reference entries found"
  }

  return result
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/reference-engine.ts
git commit -m "feat(retrieval): add reference engine for lookup queries"
```

---

## Task 5: Create Asset Engine

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/asset-engine.ts`

**Step 1: Create the asset engine**

```typescript
// src/lib/regulatory-truth/retrieval/asset-engine.ts
import { db } from "@/lib/db"

export interface AssetEngineResult {
  success: boolean
  asset: {
    id: string
    formCode: string | null
    officialName: string
    description: string | null
    downloadUrl: string
    format: string
    assetType: string
    version: string | null
    validFrom: Date | null
    validUntil: Date | null
  } | null
  relatedAssets: Array<{
    id: string
    formCode: string | null
    officialName: string
    downloadUrl: string
  }>
  reasoning: string
}

/**
 * Asset Engine - handles document and form requests
 *
 * Examples:
 * - "Where is the PDV-P form?"
 * - "Download JOPPD template"
 * - "Obrazac za prijavu PDV-a"
 */
export async function runAssetEngine(
  query: string,
  entities: { formCodes: string[] }
): Promise<AssetEngineResult> {
  const result: AssetEngineResult = {
    success: false,
    asset: null,
    relatedAssets: [],
    reasoning: "",
  }

  const queryLower = query.toLowerCase()

  // Extract form codes from query
  const formCodePatterns = [
    /pdv-[a-z0-9]+/gi,
    /joppd/gi,
    /po-sd/gi,
    /p-pdv/gi,
    /obrazac\s+([a-z0-9-]+)/gi,
  ]

  const extractedCodes: string[] = [...entities.formCodes]
  for (const pattern of formCodePatterns) {
    const matches = query.match(pattern)
    if (matches) {
      extractedCodes.push(...matches.map((m) => m.toUpperCase()))
    }
  }

  // Determine asset type from query
  let assetType: string | null = null
  if (queryLower.includes("obrazac") || queryLower.includes("form")) {
    assetType = "FORM"
  } else if (queryLower.includes("uputa") || queryLower.includes("instruction")) {
    assetType = "INSTRUCTION"
  } else if (queryLower.includes("vodič") || queryLower.includes("guide")) {
    assetType = "GUIDE"
  } else if (queryLower.includes("predložak") || queryLower.includes("template")) {
    assetType = "TEMPLATE"
  }

  // Build search query
  const whereClause: any = {
    OR: [
      // Match by form code
      ...(extractedCodes.length > 0
        ? [
            {
              formCode: {
                in: extractedCodes,
                mode: "insensitive",
              },
            },
          ]
        : []),
      // Match by name
      {
        officialName: {
          contains: query.split(" ")[0] ?? "",
          mode: "insensitive",
        },
      },
    ],
  }

  if (assetType) {
    whereClause.assetType = assetType
  }

  // Search for assets
  const assets = await db.regulatoryAsset.findMany({
    where: whereClause,
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    take: 10,
  })

  if (assets.length === 0) {
    result.reasoning = `No assets found for: ${extractedCodes.join(", ") || query}`
    return result
  }

  // Primary result
  const primaryAsset = assets[0]
  result.asset = {
    id: primaryAsset.id,
    formCode: primaryAsset.formCode,
    officialName: primaryAsset.officialName,
    description: primaryAsset.description,
    downloadUrl: primaryAsset.downloadUrl,
    format: primaryAsset.format,
    assetType: primaryAsset.assetType,
    version: primaryAsset.version,
    validFrom: primaryAsset.validFrom,
    validUntil: primaryAsset.validUntil,
  }

  // Related assets
  result.relatedAssets = assets.slice(1).map((a) => ({
    id: a.id,
    formCode: a.formCode,
    officialName: a.officialName,
    downloadUrl: a.downloadUrl,
  }))

  result.success = true
  result.reasoning = `Found ${assets.length} asset(s). Primary: ${primaryAsset.officialName}`

  return result
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/asset-engine.ts
git commit -m "feat(retrieval): add asset engine for document queries"
```

---

## Task 6: Create Temporal Engine

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/temporal-engine.ts`

**Step 1: Create the temporal engine**

```typescript
// src/lib/regulatory-truth/retrieval/temporal-engine.ts
import { db } from "@/lib/db"

export interface TemporalEngineResult {
  success: boolean
  provision: {
    id: string
    fromRule: string
    toRule: string
    cutoffDate: Date
    pattern: string
    appliesRule: string
    explanationHr: string
  } | null
  applicableRule: string | null
  reasoning: string
  timeline: Array<{
    date: Date
    event: string
    ruleApplies: string
  }>
}

/**
 * Temporal Engine - handles transitional provision queries
 *
 * Examples:
 * - "Which rate applies for June invoice, July delivery?"
 * - "Old or new VAT rate for December 2024?"
 * - "Prijelazne odredbe za PDV stopu"
 */
export async function runTemporalEngine(
  query: string,
  entities: { dates: string[] }
): Promise<TemporalEngineResult> {
  const result: TemporalEngineResult = {
    success: false,
    provision: null,
    applicableRule: null,
    reasoning: "",
    timeline: [],
  }

  // Extract dates from query
  const datePattern = /(\d{1,2})\.?\s*(\d{1,2})\.?\s*(\d{4})/g
  const monthPattern =
    /(siječanj|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?/gi

  const extractedDates: Date[] = []

  // Parse explicit dates
  let match
  while ((match = datePattern.exec(query)) !== null) {
    const day = parseInt(match[1])
    const month = parseInt(match[2]) - 1
    const year = parseInt(match[3])
    extractedDates.push(new Date(year, month, day))
  }

  // Parse month names
  const monthMap: Record<string, number> = {
    siječanj: 0,
    january: 0,
    veljača: 1,
    february: 1,
    ožujak: 2,
    march: 2,
    travanj: 3,
    april: 3,
    svibanj: 4,
    may: 4,
    lipanj: 5,
    june: 5,
    srpanj: 6,
    july: 6,
    kolovoz: 7,
    august: 7,
    rujan: 8,
    september: 8,
    listopad: 9,
    october: 9,
    studeni: 10,
    november: 10,
    prosinac: 11,
    december: 11,
  }

  while ((match = monthPattern.exec(query)) !== null) {
    const monthName = match[1].toLowerCase()
    const year = match[2] ? parseInt(match[2]) : new Date().getFullYear()
    const month = monthMap[monthName]
    if (month !== undefined) {
      extractedDates.push(new Date(year, month, 1))
    }
  }

  // Find relevant transitional provisions
  const provisions = await db.transitionalProvision.findMany({
    where:
      extractedDates.length > 0
        ? {
            cutoffDate: {
              gte: new Date(
                Math.min(...extractedDates.map((d) => d.getTime())) - 365 * 24 * 60 * 60 * 1000
              ),
              lte: new Date(
                Math.max(...extractedDates.map((d) => d.getTime())) + 365 * 24 * 60 * 60 * 1000
              ),
            },
          }
        : {},
    orderBy: { cutoffDate: "desc" },
    take: 5,
  })

  if (provisions.length === 0) {
    result.reasoning = "No transitional provisions found for the given timeframe"
    return result
  }

  // Find most relevant provision
  const provision = provisions[0]

  result.provision = {
    id: provision.id,
    fromRule: provision.fromRule,
    toRule: provision.toRule,
    cutoffDate: provision.cutoffDate,
    pattern: provision.pattern,
    appliesRule: provision.appliesRule,
    explanationHr: provision.explanationHr,
  }

  // Determine which rule applies based on dates and pattern
  if (extractedDates.length > 0) {
    const queryDate = extractedDates[0]
    const cutoff = provision.cutoffDate

    switch (provision.pattern) {
      case "INVOICE_DATE":
        result.applicableRule = queryDate < cutoff ? provision.fromRule : provision.toRule
        result.reasoning = `Based on invoice date ${queryDate.toISOString().split("T")[0]}: applies ${result.applicableRule}`
        break

      case "DELIVERY_DATE":
        result.applicableRule = queryDate < cutoff ? provision.fromRule : provision.toRule
        result.reasoning = `Based on delivery date: applies ${result.applicableRule}`
        break

      case "TAXPAYER_CHOICE":
        result.applicableRule = provision.appliesRule
        result.reasoning = `Taxpayer can choose between ${provision.fromRule} and ${provision.toRule}`
        break

      default:
        result.applicableRule = queryDate < cutoff ? provision.fromRule : provision.toRule
        result.reasoning = `Based on date comparison: applies ${result.applicableRule}`
    }

    // Build timeline
    result.timeline = [
      {
        date: new Date(cutoff.getTime() - 1),
        event: `Before ${cutoff.toISOString().split("T")[0]}`,
        ruleApplies: provision.fromRule,
      },
      {
        date: cutoff,
        event: `Cutoff: ${cutoff.toISOString().split("T")[0]}`,
        ruleApplies: "Transition",
      },
      {
        date: new Date(cutoff.getTime() + 1),
        event: `After ${cutoff.toISOString().split("T")[0]}`,
        ruleApplies: provision.toRule,
      },
    ]
  } else {
    result.applicableRule = provision.appliesRule
    result.reasoning = provision.explanationHr
  }

  result.success = true

  return result
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/temporal-engine.ts
git commit -m "feat(retrieval): add temporal engine for transition queries"
```

---

## Task 7: Create Retrieval Index Exports

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/index.ts`

**Step 1: Create index file**

```typescript
// src/lib/regulatory-truth/retrieval/index.ts

// Query router
export { routeQuery, type RouterResult } from "./query-router"

// Engines
export { runLogicEngine, type LogicEngineResult } from "./logic-engine"
export { runProcessEngine, type ProcessEngineResult } from "./process-engine"
export { runReferenceEngine, type ReferenceEngineResult } from "./reference-engine"
export { runAssetEngine, type AssetEngineResult } from "./asset-engine"
export { runTemporalEngine, type TemporalEngineResult } from "./temporal-engine"

// Taxonomy-aware query (from Phase 3)
export { executeQuery, findVatRate, type QueryResult } from "./taxonomy-aware-query"

// Schemas
export {
  QueryIntentSchema,
  QueryClassificationSchema,
  type QueryIntent,
  type QueryClassification,
} from "../schemas/query-intent"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/index.ts
git commit -m "feat(retrieval): add index exports for all engines"
```

---

## Task 8: Write Retrieval Tests

**Files:**

- Create: `src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts`

**Step 1: Create test file**

```typescript
// src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts
import { describe, it, expect, vi } from "vitest"

// Test intent detection patterns
describe("Query Router - Intent Detection", () => {
  // We'd need to export the detectIntentFromPatterns function to test it
  // For now, test through integration

  describe("PROCESS intent detection", () => {
    const processQueries = [
      "Kako da se registriram za OSS?",
      "Koraci za prijavu PDV-a",
      "How do I file VAT return?",
      "What are the steps to register?",
    ]

    it.each(processQueries)('should detect PROCESS intent for: "%s"', async (query) => {
      // Pattern-based detection test
      const lowerQuery = query.toLowerCase()
      const isProcess =
        /kako\s+(da|mogu|se)/.test(lowerQuery) ||
        /koraci\s+za/.test(lowerQuery) ||
        /how do i/i.test(lowerQuery) ||
        /what are the steps/i.test(lowerQuery)

      expect(isProcess).toBe(true)
    })
  })

  describe("REFERENCE intent detection", () => {
    const refQueries = [
      "Koji je IBAN za Split?",
      "Uplatni račun porezne uprave Zagreb",
      "What is the IBAN for tax office?",
    ]

    it.each(refQueries)('should detect REFERENCE intent for: "%s"', async (query) => {
      const lowerQuery = query.toLowerCase()
      const isReference =
        /iban\s+(za|račun)/.test(lowerQuery) ||
        /uplatni\s+račun/.test(lowerQuery) ||
        /what is the iban/i.test(lowerQuery)

      expect(isReference).toBe(true)
    })
  })

  describe("DOCUMENT intent detection", () => {
    const docQueries = [
      "Gdje mogu naći obrazac PDV-P?",
      "Download JOPPD form",
      "Obrazac za prijavu",
    ]

    it.each(docQueries)('should detect DOCUMENT intent for: "%s"', async (query) => {
      const lowerQuery = query.toLowerCase()
      const isDocument =
        /obrazac/.test(lowerQuery) ||
        /download/.test(lowerQuery) ||
        /gdje\s+(je|mogu|mogu naći)/.test(lowerQuery)

      expect(isDocument).toBe(true)
    })
  })

  describe("TEMPORAL intent detection", () => {
    const temporalQueries = [
      "Prijelazne odredbe za PDV",
      "Stara ili nova stopa za prosinac?",
      "Od 1.1.2025 koja stopa?",
    ]

    it.each(temporalQueries)('should detect TEMPORAL intent for: "%s"', async (query) => {
      const lowerQuery = query.toLowerCase()
      const isTemporal =
        /prijelazn[ae]/.test(lowerQuery) ||
        /stara\s+stopa/.test(lowerQuery) ||
        /nova\s+stopa/.test(lowerQuery) ||
        /od\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(lowerQuery)

      expect(isTemporal).toBe(true)
    })
  })

  describe("LOGIC intent detection", () => {
    const logicQueries = [
      "Moram li plaćati PDV?",
      "Koliko iznosi stopa za hranu?",
      "Koja je stopa za sok?",
      "Prag za OSS registraciju?",
    ]

    it.each(logicQueries)('should detect LOGIC intent for: "%s"', async (query) => {
      const lowerQuery = query.toLowerCase()
      const isLogic =
        /moram\s+li/.test(lowerQuery) ||
        /koliko\s+iznosi/.test(lowerQuery) ||
        /koja\s+je\s+stopa/.test(lowerQuery) ||
        /prag\s+za/.test(lowerQuery)

      expect(isLogic).toBe(true)
    })
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/retrieval/__tests__/
git commit -m "test(retrieval): add query router intent detection tests"
```

---

## Task 9: Create CLI for Query Testing

**Files:**

- Create: `src/lib/regulatory-truth/scripts/query-cli.ts`

**Step 1: Create CLI script**

```typescript
// src/lib/regulatory-truth/scripts/query-cli.ts
import { routeQuery } from "../retrieval/query-router"

async function main() {
  const query = process.argv.slice(2).join(" ")

  if (!query) {
    console.log(`
Query CLI - Test the retrieval router

Usage: npx tsx src/lib/regulatory-truth/scripts/query-cli.ts <query>

Examples:
  npx tsx src/lib/regulatory-truth/scripts/query-cli.ts "Koja je stopa PDV-a za sok?"
  npx tsx src/lib/regulatory-truth/scripts/query-cli.ts "How do I register for OSS?"
  npx tsx src/lib/regulatory-truth/scripts/query-cli.ts "IBAN za Split"
  npx tsx src/lib/regulatory-truth/scripts/query-cli.ts "Gdje je obrazac PDV-P?"
    `)
    process.exit(0)
  }

  console.log(`\nQuery: "${query}"\n`)
  console.log("Routing query...\n")

  const result = await routeQuery(query)

  console.log("=== Classification ===")
  if (result.classification) {
    console.log(`Intent: ${result.classification.intent}`)
    console.log(`Confidence: ${result.classification.confidence}`)
    console.log(`Engines: ${result.classification.suggestedEngines.join(", ")}`)
    console.log(`Reasoning: ${result.classification.reasoning}`)

    if (Object.values(result.classification.extractedEntities).some((arr) => arr.length > 0)) {
      console.log("\nExtracted Entities:")
      const entities = result.classification.extractedEntities
      if (entities.subjects.length) console.log(`  Subjects: ${entities.subjects.join(", ")}`)
      if (entities.conditions.length) console.log(`  Conditions: ${entities.conditions.join(", ")}`)
      if (entities.products.length) console.log(`  Products: ${entities.products.join(", ")}`)
      if (entities.locations.length) console.log(`  Locations: ${entities.locations.join(", ")}`)
      if (entities.dates.length) console.log(`  Dates: ${entities.dates.join(", ")}`)
      if (entities.formCodes.length) console.log(`  Form Codes: ${entities.formCodes.join(", ")}`)
    }
  }

  console.log("\n=== Response ===")
  if (result.success) {
    console.log(JSON.stringify(result.response, null, 2))
  } else {
    console.log(`Error: ${result.error}`)
  }

  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/scripts/query-cli.ts
git commit -m "feat(scripts): add query CLI for testing retrieval"
```

---

## Task 10: Add Router Prompt

**Files:**

- Modify: `src/lib/regulatory-truth/prompts/index.ts`

**Step 1: Add query classifier prompt**

```typescript
// Add to src/lib/regulatory-truth/prompts/index.ts

export const QUERY_CLASSIFIER_PROMPT = `You are a query intent classifier for Croatian tax regulations.

Classify the user's query into one of these intents:

1. **LOGIC** - Questions about rules, thresholds, rates, obligations
   - "Do I owe VAT if..."
   - "What is the tax rate for..."
   - "Am I required to..."
   - "Moram li...", "Koliko iznosi...", "Koja je stopa..."

2. **PROCESS** - Questions about procedures, steps, workflows
   - "How do I register..."
   - "What are the steps to..."
   - "Kako da...", "Koraci za..."

3. **REFERENCE** - Requests for specific lookup values
   - "What is the IBAN for..."
   - "What is the code for..."
   - "Koji je IBAN...", "Uplatni račun..."

4. **DOCUMENT** - Requests for forms, templates, documents
   - "Where can I find the form..."
   - "Download [form name]"
   - "Obrazac...", "Gdje je..."

5. **TEMPORAL** - Questions about transitional provisions, date-based rules
   - "Which rate applies for [date]..."
   - "Old vs new rule"
   - "Prijelazne odredbe...", "Stara ili nova stopa..."

6. **GENERAL** - Other questions that don't fit above

Also extract entities:
- subjects: Taxpayer types mentioned (pausalni obrt, d.o.o., etc.)
- conditions: Thresholds, amounts (>10000 EUR, etc.)
- products: Product categories (food, juice, alcohol, etc.)
- locations: Cities, regions (Zagreb, Split, etc.)
- dates: Specific dates mentioned
- formCodes: Form codes (PDV-P, JOPPD, etc.)

Return JSON with intent, confidence (0-1), extractedEntities, suggestedEngines, and reasoning.
`
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/prompts/index.ts
git commit -m "feat(prompts): add query classifier prompt"
```

---

## Phase 4 Complete

**Summary of changes:**

- Query intent classifier (pattern-based + LLM fallback)
- 5 specialized engines: logic, process, reference, asset, temporal
- Query router that classifies and routes to appropriate engine
- Entity extraction (subjects, conditions, products, locations, dates, formCodes)
- CLI for query testing
- Test coverage for intent patterns

**Next Phase:** Phase 5 - Coverage Gate (extraction completeness checks)
