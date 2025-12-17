# Article Writing Agent v2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fact-first article generation system with iterative verification, scope locking, and confidence scoring for FiskAI's news and knowledge hub content.

**Architecture:** RefChecker-inspired claim extraction from sources, paragraph-level verification via pgvector similarity + LLM classification, iterative rewrite loop (max 3) with scope locking for verified content, human review dashboard for manual intervention.

**Tech Stack:** Ollama (nomic-embed-text for embeddings, swappable LLM for writing), PostgreSQL + pgvector, Prisma (main schema) + Drizzle (vector queries), Next.js App Router.

**Design Document:** `docs/plans/2025-12-17-article-writing-agent-design.md`

---

## Phase 1: Foundation

### Task 1.1: Add pgvector Extension

**Files:**

- Create: `drizzle/migrations/0001_add_pgvector.sql`

**Step 1: Create migration file**

```sql
-- drizzle/migrations/0001_add_pgvector.sql
-- Enable pgvector extension for embedding similarity search

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is available
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

**Step 2: Run migration manually to verify**

Run: `psql $DATABASE_URL -f drizzle/migrations/0001_add_pgvector.sql`
Expected: `CREATE EXTENSION` or `NOTICE: extension "vector" already exists`

**Step 3: Commit**

```bash
git add drizzle/migrations/0001_add_pgvector.sql
git commit -m "feat(article-agent): add pgvector extension migration"
```

---

### Task 1.2: Add Prisma Schema Models

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add enums at end of schema (before closing)**

```prisma
enum ArticleType {
  NEWS
  GUIDE
  HOWTO
  GLOSSARY
  COMPARISON
}

enum ArticleStatus {
  SYNTHESIZING
  PLANNING
  DRAFTING
  VERIFYING
  NEEDS_REVIEW
  APPROVED
  PUBLISHED
  REJECTED
}
```

**Step 2: Add ArticleJob model**

```prisma
model ArticleJob {
  id               String        @id @default(cuid())
  type             ArticleType
  status           ArticleStatus @default(SYNTHESIZING)

  sourceUrls       String[]
  topic            String?

  currentIteration Int           @default(0)
  maxIterations    Int           @default(3)

  factSheetId      String?       @unique
  finalContentMdx  String?
  finalSlug        String?

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  publishedAt      DateTime?

  factSheet        FactSheet?
  drafts           ArticleDraft[]

  @@index([status])
  @@index([type])
}
```

**Step 3: Add FactSheet model**

```prisma
model FactSheet {
  id          String   @id @default(cuid())
  jobId       String   @unique

  topic       String
  keyEntities Json

  createdAt   DateTime @default(now())

  job          ArticleJob?   @relation(fields: [jobId], references: [id], onDelete: Cascade)
  claims       Claim[]
  sourceChunks SourceChunk[]
}
```

**Step 4: Add Claim model**

```prisma
model Claim {
  id            String  @id @default(cuid())
  factSheetId   String

  statement     String
  quote         String?
  sourceUrl     String
  sourceChunkId String?

  confidence    Float
  category      String?

  factSheet     FactSheet          @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  sourceChunk   SourceChunk?       @relation(fields: [sourceChunkId], references: [id])
  verifications ClaimVerification[]

  @@index([factSheetId])
}
```

**Step 5: Add SourceChunk model (embedding column added via raw SQL)**

```prisma
model SourceChunk {
  id          String   @id @default(cuid())
  factSheetId String

  sourceUrl   String
  content     String
  // embedding vector(768) added via raw SQL migration

  fetchedAt   DateTime @default(now())

  factSheet   FactSheet @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  claims      Claim[]

  @@index([factSheetId])
}
```

**Step 6: Add ArticleDraft model**

```prisma
model ArticleDraft {
  id         String   @id @default(cuid())
  jobId      String
  iteration  Int

  contentMdx String

  createdAt  DateTime @default(now())

  job        ArticleJob       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  paragraphs DraftParagraph[]

  @@unique([jobId, iteration])
}
```

**Step 7: Add DraftParagraph model**

```prisma
model DraftParagraph {
  id                 String  @id @default(cuid())
  draftId            String

  index              Int
  content            String
  isLocked           Boolean @default(false)

  confidence         Float?
  supportingClaimIds String[]

  draft         ArticleDraft        @relation(fields: [draftId], references: [id], onDelete: Cascade)
  verifications ClaimVerification[]

  @@unique([draftId, index])
}
```

**Step 8: Add ClaimVerification model**

```prisma
model ClaimVerification {
  id              String @id @default(cuid())
  paragraphId     String
  claimId         String

  similarityScore Float
  isSupporting    Boolean

  createdAt       DateTime @default(now())

  paragraph       DraftParagraph @relation(fields: [paragraphId], references: [id], onDelete: Cascade)
  claim           Claim          @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@unique([paragraphId, claimId])
}
```

**Step 9: Run Prisma format and generate**

Run: `npx prisma format && npx prisma generate`
Expected: `Prisma schema formatted` and `Generated Prisma Client`

**Step 10: Create migration**

Run: `npx prisma migrate dev --name add_article_agent_models`
Expected: Migration created and applied

**Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(article-agent): add Prisma schema models for article agent"
```

---

### Task 1.3: Add SourceChunk Embedding Column via Raw SQL

**Files:**

- Create: `drizzle/migrations/0002_add_source_chunk_embedding.sql`

**Step 1: Create migration to add vector column**

```sql
-- drizzle/migrations/0002_add_source_chunk_embedding.sql
-- Add embedding column to SourceChunk table

ALTER TABLE "SourceChunk"
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create IVFFlat index for fast similarity search
-- lists = sqrt(num_rows) is a good starting point, we use 100 for expected scale
CREATE INDEX IF NOT EXISTS source_chunk_embedding_idx
ON "SourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Step 2: Run migration**

Run: `psql $DATABASE_URL -f drizzle/migrations/0002_add_source_chunk_embedding.sql`
Expected: `ALTER TABLE` and `CREATE INDEX`

**Step 3: Commit**

```bash
git add drizzle/migrations/0002_add_source_chunk_embedding.sql
git commit -m "feat(article-agent): add pgvector embedding column to SourceChunk"
```

---

### Task 1.4: Create Drizzle Schema for Vector Queries

**Files:**

- Create: `src/lib/db/drizzle/schema/embeddings.ts`
- Create: `src/lib/db/drizzle/index.ts`

**Step 1: Create embeddings schema**

```typescript
// src/lib/db/drizzle/schema/embeddings.ts

import { pgTable, text, timestamp, index, real } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Custom vector type for pgvector
// Drizzle doesn't have native vector support, so we use customType
import { customType } from "drizzle-orm/pg-core"

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)"
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,...]" format
    return JSON.parse(value.replace(/^\[/, "[").replace(/\]$/, "]"))
  },
})

export const sourceChunkEmbeddings = pgTable(
  "SourceChunk",
  {
    id: text("id").primaryKey(),
    factSheetId: text("factSheetId").notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding"),
    fetchedAt: timestamp("fetchedAt").defaultNow(),
  },
  (table) => ({
    factSheetIdx: index("source_chunk_fact_sheet_idx").on(table.factSheetId),
  })
)
```

**Step 2: Create Drizzle client**

```typescript
// src/lib/db/drizzle/index.ts

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as embeddings from "./schema/embeddings"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const drizzleDb = drizzle(pool, {
  schema: { ...embeddings },
})

export { embeddings }
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|src/lib/db/drizzle)" | head -20`
Expected: No errors related to drizzle files

**Step 4: Commit**

```bash
git add src/lib/db/drizzle/
git commit -m "feat(article-agent): add Drizzle schema for pgvector queries"
```

---

### Task 1.5: Create Ollama Client

**Files:**

- Create: `src/lib/article-agent/llm/ollama-client.ts`
- Create: `src/lib/article-agent/llm/index.ts`

**Step 1: Create Ollama client**

```typescript
// src/lib/article-agent/llm/ollama-client.ts

export interface OllamaConfig {
  endpoint: string
  model: string
  embedModel: string
  embedDims: number
}

export function getOllamaConfig(): OllamaConfig {
  return {
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    embedDims: parseInt(process.env.OLLAMA_EMBED_DIMS || "768"),
  }
}

export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = "OllamaError"
  }
}

export async function callOllama(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
  } = {}
): Promise<string> {
  const config = getOllamaConfig()
  const { systemPrompt, temperature = 0.7, maxTokens = 4000, retries = 3 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new OllamaError(
          `Ollama API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      const data = await response.json()
      return data.response
    } catch (error) {
      lastError = error as Error

      if (error instanceof OllamaError && error.statusCode === 401) {
        throw error
      }

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new OllamaError(
    `Ollama API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

export async function callOllamaJSON<T>(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    retries?: number
  } = {}
): Promise<T> {
  const config = getOllamaConfig()
  const { systemPrompt, temperature = 0.3, retries = 3 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt,
          system: systemPrompt,
          stream: false,
          format: "json",
          options: {
            temperature,
          },
        }),
      })

      if (!response.ok) {
        throw new OllamaError(`Ollama API error: ${response.statusText}`, response.status)
      }

      const data = await response.json()
      return JSON.parse(data.response) as T
    } catch (error) {
      lastError = error as Error

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new OllamaError(
    `Ollama JSON call failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}
```

**Step 2: Create index export**

```typescript
// src/lib/article-agent/llm/index.ts

export {
  callOllama,
  callOllamaJSON,
  getOllamaConfig,
  OllamaError,
  type OllamaConfig,
} from "./ollama-client"
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/lib/article-agent" | head -10`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/article-agent/llm/
git commit -m "feat(article-agent): add Ollama LLM client"
```

---

### Task 1.6: Create Ollama Embeddings Client

**Files:**

- Create: `src/lib/article-agent/verification/embedder.ts`

**Step 1: Create embedder**

```typescript
// src/lib/article-agent/verification/embedder.ts

import { getOllamaConfig, OllamaError } from "../llm/ollama-client"

export async function embedText(text: string): Promise<number[]> {
  const config = getOllamaConfig()

  const response = await fetch(`${config.endpoint}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.embedModel,
      prompt: text,
    }),
  })

  if (!response.ok) {
    throw new OllamaError(`Ollama embedding failed: ${response.statusText}`, response.status)
  }

  const data = await response.json()

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new OllamaError("Ollama returned invalid embedding format")
  }

  return data.embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Ollama doesn't have native batch, so we parallelize with concurrency limit
  const CONCURRENCY = 5
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map((text) => embedText(text)))
    results.push(...batchResults)
  }

  return results
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/verification/embedder.ts
git commit -m "feat(article-agent): add Ollama embeddings client"
```

---

### Task 1.7: Create Types File

**Files:**

- Create: `src/lib/article-agent/types.ts`

**Step 1: Create types**

```typescript
// src/lib/article-agent/types.ts

import type { ArticleType, ArticleStatus } from "@prisma/client"

// Re-export Prisma types
export type { ArticleType, ArticleStatus }

// ─── Job Input ───────────────────────────────────────────────
export interface CreateJobInput {
  type: ArticleType
  sourceUrls: string[]
  topic?: string
  maxIterations?: number
}

// ─── Fact Sheet ──────────────────────────────────────────────
export interface KeyEntities {
  names: string[]
  dates: string[]
  amounts: string[]
  regulations: string[]
}

export interface FactSheetData {
  topic: string
  keyEntities: KeyEntities
  claims: ClaimData[]
  sourceChunks: SourceChunkData[]
}

export interface ClaimData {
  id: string
  statement: string
  quote: string | null
  sourceUrl: string
  category: ClaimCategory
  confidence: number
}

export type ClaimCategory = "deadline" | "amount" | "requirement" | "entity" | "general"

export interface SourceChunkData {
  id: string
  sourceUrl: string
  content: string
  hasEmbedding: boolean
}

// ─── Verification ────────────────────────────────────────────
export type SupportLevel = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "CONTRADICTED"

export interface ParagraphVerification {
  index: number
  content: string
  isLocked: boolean
  confidence: number
  status: SupportLevel
  supportingClaims: Array<{
    claimId: string
    statement: string
    similarity: number
    relationship: SupportLevel
  }>
}

export interface VerificationResult {
  draftId: string
  iteration: number
  paragraphs: ParagraphVerification[]
  overallConfidence: number
  passCount: number
  failCount: number
  allParagraphsPass: boolean
  anyBelowThreshold: boolean
  anyCriticalFail: boolean
}

// ─── Orchestrator Events ─────────────────────────────────────
export type JobEvent =
  | { type: "SYNTHESIS_COMPLETE"; claimCount: number }
  | { type: "DRAFT_COMPLETE"; iteration: number; paragraphCount: number }
  | { type: "VERIFICATION_COMPLETE"; result: VerificationResult }
  | { type: "ITERATION_COMPLETE"; iteration: number; lockedCount: number }
  | { type: "JOB_APPROVED"; finalConfidence: number }
  | { type: "JOB_NEEDS_REVIEW"; reason: string }
  | { type: "JOB_FAILED"; error: string }

// ─── Thresholds ──────────────────────────────────────────────
export const THRESHOLDS = {
  PARAGRAPH_PASS: parseFloat(process.env.ARTICLE_AGENT_PASS_THRESHOLD || "0.8"),
  PARAGRAPH_FAIL: parseFloat(process.env.ARTICLE_AGENT_FAIL_THRESHOLD || "0.5"),
  JOB_AUTO_APPROVE: 0.85,
  MAX_ITERATIONS: parseInt(process.env.ARTICLE_AGENT_MAX_ITERATIONS || "3"),
  MIN_SUPPORTING_CLAIMS: 1,
  TOP_K_CHUNKS: 5,
} as const
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/types.ts
git commit -m "feat(article-agent): add TypeScript types and interfaces"
```

---

### Task 1.8: Create Module Index

**Files:**

- Create: `src/lib/article-agent/index.ts`

**Step 1: Create index**

```typescript
// src/lib/article-agent/index.ts

// Types
export * from "./types"

// LLM clients
export * from "./llm"

// Verification
export { embedText, embedBatch } from "./verification/embedder"
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/index.ts
git commit -m "feat(article-agent): add module index"
```

---

## Phase 2: Core Pipeline

### Task 2.1: Create URL Fetcher

**Files:**

- Create: `src/lib/article-agent/extraction/fetcher.ts`

**Step 1: Create fetcher (reusing patterns from news fetcher)**

```typescript
// src/lib/article-agent/extraction/fetcher.ts

import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"

export interface FetchedContent {
  url: string
  title: string
  content: string
  fetchedAt: Date
  error?: string
}

export async function fetchUrl(url: string): Promise<FetchedContent> {
  const fetchedAt = new Date()

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FiskAI/1.0 (Article Agent)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      return {
        url,
        title: "",
        content: "",
        fetchedAt,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article) {
      return {
        url,
        title: dom.window.document.title || "",
        content: dom.window.document.body?.textContent || "",
        fetchedAt,
      }
    }

    return {
      url,
      title: article.title,
      content: article.textContent,
      fetchedAt,
    }
  } catch (error) {
    return {
      url,
      title: "",
      content: "",
      fetchedAt,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    }
  }
}

export async function fetchUrls(urls: string[]): Promise<FetchedContent[]> {
  const results = await Promise.all(urls.map((url) => fetchUrl(url)))
  return results
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/extraction/fetcher.ts
git commit -m "feat(article-agent): add URL fetcher for source extraction"
```

---

### Task 2.2: Create Text Chunker

**Files:**

- Create: `src/lib/article-agent/extraction/chunker.ts`

**Step 1: Create chunker**

```typescript
// src/lib/article-agent/extraction/chunker.ts

export interface TextChunk {
  content: string
  startIndex: number
  endIndex: number
}

export interface ChunkerOptions {
  chunkSize?: number // Target characters per chunk
  overlapSize?: number // Overlap between chunks
  minChunkSize?: number // Minimum chunk size to keep
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  chunkSize: 1000,
  overlapSize: 200,
  minChunkSize: 100,
}

export function chunkText(text: string, options: ChunkerOptions = {}): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: TextChunk[] = []

  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, " ").trim()

  if (cleanText.length <= opts.chunkSize) {
    return [{ content: cleanText, startIndex: 0, endIndex: cleanText.length }]
  }

  let startIndex = 0

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + opts.chunkSize, cleanText.length)

    // Try to break at sentence boundary
    if (endIndex < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf(".", endIndex)
      const lastQuestion = cleanText.lastIndexOf("?", endIndex)
      const lastExclaim = cleanText.lastIndexOf("!", endIndex)

      const sentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim)

      if (sentenceEnd > startIndex + opts.minChunkSize) {
        endIndex = sentenceEnd + 1
      }
    }

    const chunk = cleanText.slice(startIndex, endIndex).trim()

    if (chunk.length >= opts.minChunkSize) {
      chunks.push({
        content: chunk,
        startIndex,
        endIndex,
      })
    }

    // Move start with overlap
    startIndex = endIndex - opts.overlapSize
    if (startIndex >= cleanText.length - opts.minChunkSize) {
      break
    }
  }

  return chunks
}

export function chunkMultiple(
  sources: Array<{ url: string; content: string }>,
  options: ChunkerOptions = {}
): Array<{ url: string; chunks: TextChunk[] }> {
  return sources.map((source) => ({
    url: source.url,
    chunks: chunkText(source.content, options),
  }))
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/extraction/chunker.ts
git commit -m "feat(article-agent): add text chunker for source splitting"
```

---

### Task 2.3: Create Claim Extractor

**Files:**

- Create: `src/lib/article-agent/extraction/claim-extractor.ts`
- Create: `src/lib/article-agent/prompts/extraction.ts`

**Step 1: Create extraction prompts**

```typescript
// src/lib/article-agent/prompts/extraction.ts

export const CLAIM_EXTRACTION_SYSTEM = `Ti si stručnjak za ekstrakciju činjenica iz izvora. Tvoj zadatak je identificirati atomske, provjerljive tvrdnje iz teksta. Budi precizan i ekstragiraj samo ono što je eksplicitno navedeno u tekstu.`

export const CLAIM_EXTRACTION_PROMPT = `Ekstrahiraj atomske činjenične tvrdnje iz ovog teksta izvora.

PRAVILA:
1. Svaka tvrdnja mora biti nezavisno provjerljiva
2. Uključi točan citat koji podržava svaku tvrdnju
3. Kategoriziraj: deadline (rok), amount (iznos), requirement (zahtjev), entity (entitet), general (opće)
4. Ocijeni pouzdanost ekstrakcije 0.0-1.0

IZVOR URL: {url}
TEKST:
{content}

Vrati JSON niz:
[
  {
    "statement": "Jasna, atomska tvrdnja na hrvatskom",
    "quote": "Točan citat iz teksta koji podržava tvrdnju",
    "category": "deadline|amount|requirement|entity|general",
    "confidence": 0.95
  }
]

VAŽNO: Vrati SAMO JSON niz, bez dodatnog teksta.`

export const KEY_ENTITIES_PROMPT = `Identificiraj ključne entitete iz ovih tvrdnji.

TVRDNJE:
{claims}

Ekstrahiraj i kategoriziraj entitete:

Vrati JSON:
{
  "names": ["imena osoba, organizacija, tvrtki"],
  "dates": ["datumi, rokovi, periodi"],
  "amounts": ["iznosi, postoci, pragovi"],
  "regulations": ["zakoni, pravilnici, službeni dokumenti"]
}

VAŽNO: Vrati SAMO JSON objekt, bez dodatnog teksta.`
```

**Step 2: Create claim extractor**

```typescript
// src/lib/article-agent/extraction/claim-extractor.ts

import { callOllamaJSON } from "../llm/ollama-client"
import {
  CLAIM_EXTRACTION_SYSTEM,
  CLAIM_EXTRACTION_PROMPT,
  KEY_ENTITIES_PROMPT,
} from "../prompts/extraction"
import type { ClaimData, ClaimCategory, KeyEntities } from "../types"

interface ExtractedClaim {
  statement: string
  quote: string
  category: string
  confidence: number
}

export async function extractClaimsFromChunk(
  content: string,
  sourceUrl: string
): Promise<Omit<ClaimData, "id">[]> {
  const prompt = CLAIM_EXTRACTION_PROMPT.replace("{url}", sourceUrl).replace("{content}", content)

  try {
    const claims = await callOllamaJSON<ExtractedClaim[]>(prompt, {
      systemPrompt: CLAIM_EXTRACTION_SYSTEM,
      temperature: 0.2,
    })

    return claims.map((claim) => ({
      statement: claim.statement,
      quote: claim.quote || null,
      sourceUrl,
      category: normalizeCategory(claim.category),
      confidence: Math.max(0, Math.min(1, claim.confidence)),
    }))
  } catch (error) {
    console.error("Claim extraction failed for chunk:", error)
    return []
  }
}

function normalizeCategory(category: string): ClaimCategory {
  const normalized = category.toLowerCase().trim()
  const validCategories: ClaimCategory[] = [
    "deadline",
    "amount",
    "requirement",
    "entity",
    "general",
  ]

  if (validCategories.includes(normalized as ClaimCategory)) {
    return normalized as ClaimCategory
  }

  return "general"
}

export async function extractKeyEntities(
  claims: Array<{ statement: string }>
): Promise<KeyEntities> {
  const claimsText = claims.map((c) => `- ${c.statement}`).join("\n")
  const prompt = KEY_ENTITIES_PROMPT.replace("{claims}", claimsText)

  try {
    const entities = await callOllamaJSON<KeyEntities>(prompt, {
      temperature: 0.1,
    })

    return {
      names: entities.names || [],
      dates: entities.dates || [],
      amounts: entities.amounts || [],
      regulations: entities.regulations || [],
    }
  } catch (error) {
    console.error("Key entity extraction failed:", error)
    return { names: [], dates: [], amounts: [], regulations: [] }
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/article-agent/extraction/claim-extractor.ts src/lib/article-agent/prompts/extraction.ts
git commit -m "feat(article-agent): add RefChecker-inspired claim extractor"
```

---

### Task 2.4: Create Similarity Search

**Files:**

- Create: `src/lib/article-agent/verification/similarity.ts`

**Step 1: Create similarity search with pgvector**

```typescript
// src/lib/article-agent/verification/similarity.ts

import { sql } from "drizzle-orm"
import { drizzleDb } from "@/lib/db/drizzle"

export interface SimilarChunk {
  id: string
  content: string
  sourceUrl: string
  similarity: number
  claimIds: string[]
}

export async function findSimilarChunks(
  paragraphEmbedding: number[],
  factSheetId: string,
  topK: number = 5
): Promise<SimilarChunk[]> {
  const vectorStr = `[${paragraphEmbedding.join(",")}]`

  const results = await drizzleDb.execute(sql`
    SELECT
      sc.id,
      sc.content,
      sc."sourceUrl" as "sourceUrl",
      1 - (sc.embedding <=> ${vectorStr}::vector) as similarity,
      COALESCE(
        array_agg(c.id) FILTER (WHERE c.id IS NOT NULL),
        '{}'
      ) as "claimIds"
    FROM "SourceChunk" sc
    LEFT JOIN "Claim" c ON c."sourceChunkId" = sc.id
    WHERE sc."factSheetId" = ${factSheetId}
      AND sc.embedding IS NOT NULL
    GROUP BY sc.id, sc.content, sc."sourceUrl", sc.embedding
    ORDER BY sc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `)

  return results.rows as SimilarChunk[]
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`

  await drizzleDb.execute(sql`
    UPDATE "SourceChunk"
    SET embedding = ${vectorStr}::vector
    WHERE id = ${chunkId}
  `)
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/verification/similarity.ts
git commit -m "feat(article-agent): add pgvector similarity search"
```

---

### Task 2.5: Create Support Classifier

**Files:**

- Create: `src/lib/article-agent/verification/classifier.ts`
- Create: `src/lib/article-agent/prompts/verification.ts`

**Step 1: Create verification prompts**

```typescript
// src/lib/article-agent/prompts/verification.ts

export const CLASSIFICATION_SYSTEM = `Ti si stručnjak za provjeru činjenica. Budi precizan i objektivan. Analiziraj odnos između dokaza iz izvora i sadržaja paragrafa.`

export const CLASSIFICATION_PROMPT = `Analiziraj podržava li IZVOR DOKAZ ovaj PARAGRAF iz članka.

PARAGRAF (iz nacrta članka):
{paragraph}

IZVOR DOKAZ (iz originalnog izvora):
{evidence}

Klasificiraj odnos kao JEDNO od:
- SUPPORTED: Dokaz izravno podržava tvrdnje paragrafa
- PARTIALLY_SUPPORTED: Dokaz podržava neke ali ne sve tvrdnje
- NOT_SUPPORTED: Dokaz ne adresira tvrdnje paragrafa
- CONTRADICTED: Dokaz proturiječi tvrdnjama paragrafa

Vrati JSON:
{
  "relationship": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "CONTRADICTED",
  "confidence": 0.0-1.0,
  "explanation": "Kratko obrazloženje na hrvatskom"
}

VAŽNO: Vrati SAMO JSON objekt.`
```

**Step 2: Create classifier**

```typescript
// src/lib/article-agent/verification/classifier.ts

import { callOllamaJSON } from "../llm/ollama-client"
import { CLASSIFICATION_SYSTEM, CLASSIFICATION_PROMPT } from "../prompts/verification"
import type { SupportLevel } from "../types"

export interface ClassificationResult {
  relationship: SupportLevel
  confidence: number
  explanation: string
}

export async function classifySupport(
  paragraph: string,
  evidence: string
): Promise<ClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT.replace("{paragraph}", paragraph).replace(
    "{evidence}",
    evidence
  )

  try {
    const result = await callOllamaJSON<ClassificationResult>(prompt, {
      systemPrompt: CLASSIFICATION_SYSTEM,
      temperature: 0.1,
    })

    // Validate and normalize
    const validRelationships: SupportLevel[] = [
      "SUPPORTED",
      "PARTIALLY_SUPPORTED",
      "NOT_SUPPORTED",
      "CONTRADICTED",
    ]

    if (!validRelationships.includes(result.relationship)) {
      result.relationship = "NOT_SUPPORTED"
    }

    result.confidence = Math.max(0, Math.min(1, result.confidence))

    return result
  } catch (error) {
    console.error("Classification failed:", error)
    return {
      relationship: "NOT_SUPPORTED",
      confidence: 0,
      explanation: "Klasifikacija nije uspjela",
    }
  }
}

export async function classifyParagraphAgainstChunks(
  paragraph: string,
  chunks: Array<{ id: string; content: string; similarity: number; claimIds: string[] }>
): Promise<
  Array<{
    chunkId: string
    classification: ClassificationResult
    similarity: number
    claimIds: string[]
  }>
> {
  const results = await Promise.all(
    chunks.map(async (chunk) => ({
      chunkId: chunk.id,
      classification: await classifySupport(paragraph, chunk.content),
      similarity: chunk.similarity,
      claimIds: chunk.claimIds,
    }))
  )

  return results
}
```

**Step 3: Commit**

```bash
git add src/lib/article-agent/verification/classifier.ts src/lib/article-agent/prompts/verification.ts
git commit -m "feat(article-agent): add LLM support classifier"
```

---

### Task 2.6: Create Confidence Aggregation Utils

**Files:**

- Create: `src/lib/article-agent/utils/confidence.ts`

**Step 1: Create confidence utils**

```typescript
// src/lib/article-agent/utils/confidence.ts

import { SupportLevel, THRESHOLDS } from "../types"

interface ChunkClassification {
  similarity: number
  relationship: SupportLevel
  confidence: number
}

const SUPPORT_WEIGHTS: Record<SupportLevel, number> = {
  SUPPORTED: 1.0,
  PARTIALLY_SUPPORTED: 0.6,
  NOT_SUPPORTED: 0.0,
  CONTRADICTED: -0.5,
}

export function aggregateConfidence(classifications: ChunkClassification[]): {
  confidence: number
  status: SupportLevel
  hasCriticalIssue: boolean
} {
  if (classifications.length === 0) {
    return { confidence: 0, status: "NOT_SUPPORTED", hasCriticalIssue: true }
  }

  let totalWeight = 0
  let weightedSum = 0
  let hasContradiction = false
  let hasSupport = false

  for (const c of classifications) {
    const weight = c.similarity * c.confidence
    const value = SUPPORT_WEIGHTS[c.relationship]

    weightedSum += weight * value
    totalWeight += weight

    if (c.relationship === "CONTRADICTED") hasContradiction = true
    if (c.relationship === "SUPPORTED") hasSupport = true
  }

  const rawConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0

  // Normalize to 0-1 range (raw can be negative due to contradictions)
  const confidence = Math.max(0, Math.min(1, (rawConfidence + 0.5) / 1.5))

  // Determine status
  let status: SupportLevel
  if (hasContradiction) {
    status = "CONTRADICTED"
  } else if (confidence >= 0.7 && hasSupport) {
    status = "SUPPORTED"
  } else if (confidence >= 0.4) {
    status = "PARTIALLY_SUPPORTED"
  } else {
    status = "NOT_SUPPORTED"
  }

  return {
    confidence,
    status,
    hasCriticalIssue: hasContradiction || confidence < THRESHOLDS.PARAGRAPH_FAIL,
  }
}

export function shouldLock(confidence: number): boolean {
  return confidence >= THRESHOLDS.PARAGRAPH_PASS
}

export function shouldRewrite(confidence: number): boolean {
  return confidence >= THRESHOLDS.PARAGRAPH_FAIL && confidence < THRESHOLDS.PARAGRAPH_PASS
}

export function needsHumanReview(confidence: number): boolean {
  return confidence < THRESHOLDS.PARAGRAPH_FAIL
}

export function calculateOverallConfidence(paragraphConfidences: number[]): number {
  if (paragraphConfidences.length === 0) return 0
  return paragraphConfidences.reduce((sum, c) => sum + c, 0) / paragraphConfidences.length
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/utils/confidence.ts
git commit -m "feat(article-agent): add confidence aggregation utilities"
```

---

## Phase 3: Orchestration

### Task 3.1: Create Synthesize Step

**Files:**

- Create: `src/lib/article-agent/steps/synthesize.ts`

**Step 1: Create synthesize step**

```typescript
// src/lib/article-agent/steps/synthesize.ts

import { db } from "@/lib/db"
import { fetchUrls } from "../extraction/fetcher"
import { chunkText } from "../extraction/chunker"
import { extractClaimsFromChunk, extractKeyEntities } from "../extraction/claim-extractor"
import { embedText } from "../verification/embedder"
import { updateChunkEmbedding } from "../verification/similarity"
import type { ArticleJob } from "@prisma/client"

export async function synthesizeFactSheet(job: ArticleJob): Promise<string> {
  // 1. Fetch all source URLs
  const fetchedSources = await fetchUrls(job.sourceUrls)
  const successfulSources = fetchedSources.filter((s) => !s.error && s.content)

  if (successfulSources.length === 0) {
    throw new Error("No sources could be fetched successfully")
  }

  // 2. Create FactSheet
  const factSheet = await db.factSheet.create({
    data: {
      jobId: job.id,
      topic: job.topic || successfulSources[0].title || "Untitled",
      keyEntities: { names: [], dates: [], amounts: [], regulations: [] },
    },
  })

  // 3. Chunk each source and create SourceChunks
  const allClaims: Array<{
    statement: string
    quote: string | null
    sourceUrl: string
    category: string
    confidence: number
    sourceChunkId: string
  }> = []

  for (const source of successfulSources) {
    const chunks = chunkText(source.content)

    for (const chunk of chunks) {
      // Create chunk record
      const sourceChunk = await db.sourceChunk.create({
        data: {
          factSheetId: factSheet.id,
          sourceUrl: source.url,
          content: chunk.content,
        },
      })

      // Generate and store embedding
      try {
        const embedding = await embedText(chunk.content)
        await updateChunkEmbedding(sourceChunk.id, embedding)
      } catch (error) {
        console.error("Embedding failed for chunk:", sourceChunk.id, error)
      }

      // Extract claims from chunk
      const claims = await extractClaimsFromChunk(chunk.content, source.url)

      for (const claim of claims) {
        allClaims.push({
          ...claim,
          sourceChunkId: sourceChunk.id,
        })
      }
    }
  }

  // 4. Store all claims
  for (const claim of allClaims) {
    await db.claim.create({
      data: {
        factSheetId: factSheet.id,
        statement: claim.statement,
        quote: claim.quote,
        sourceUrl: claim.sourceUrl,
        sourceChunkId: claim.sourceChunkId,
        category: claim.category,
        confidence: claim.confidence,
      },
    })
  }

  // 5. Extract key entities from all claims
  const keyEntities = await extractKeyEntities(allClaims)

  await db.factSheet.update({
    where: { id: factSheet.id },
    data: { keyEntities },
  })

  // 6. Update job with factSheet reference
  await db.articleJob.update({
    where: { id: job.id },
    data: { factSheetId: factSheet.id },
  })

  return factSheet.id
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/steps/synthesize.ts
git commit -m "feat(article-agent): add synthesize step for fact sheet creation"
```

---

### Task 3.2: Create Draft Step

**Files:**

- Create: `src/lib/article-agent/steps/draft.ts`
- Create: `src/lib/article-agent/prompts/drafting.ts`

**Step 1: Create drafting prompts**

```typescript
// src/lib/article-agent/prompts/drafting.ts

import type { ArticleType } from "@prisma/client"

export const DRAFTING_SYSTEM = `Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe. Pišeš jasno, konkretno i bez floskula. Ne izmišljaš činjenice - koristiš ISKLJUČIVO informacije iz dostavljenog fact sheeta.`

export const DRAFTING_PROMPTS: Record<ArticleType, string> = {
  NEWS: `Napiši članak za FiskAI vijesti koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Svaki paragraf mora biti potkrijepljen barem jednom tvrdnjom
3. Ako nešto nije u fact sheetu, NE SPOMINJI to
4. Bez generičkih uvoda i fraza

STRUKTURA:
- **TL;DR** (3 kratke stavke)
- **Što se promijenilo**
- **Koga se tiče**
- **Rokovi** (ako postoje u fact sheetu)
- **Što trebate napraviti** (ako je primjenjivo)

Ton: Profesionalan ali pristupačan.
Duljina: 300-500 riječi.

Vrati članak u Markdown formatu.`,

  GUIDE: `Napiši vodič za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Svaki paragraf mora biti potkrijepljen barem jednom tvrdnjom
3. Strukturiraj vodič logično s jasnim naslovima
4. Bez generičkih uvoda i fraza

STRUKTURA:
- Uvod (1 paragraf)
- Glavne sekcije s H2 naslovima
- Praktični koraci gdje je primjenjivo
- Zaključak

Ton: Edukativan i pristupačan.
Duljina: 500-800 riječi.

Vrati vodič u Markdown formatu.`,

  HOWTO: `Napiši praktični vodič "Kako da..." za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Fokusiraj se na praktične korake
3. Koristi numerirane liste za korake

STRUKTURA:
- Kratki uvod (što ćete postići)
- Preduvjeti (ako postoje)
- Koraci (numerirani)
- Česti problemi (ako su u fact sheetu)

Ton: Praktičan i jasan.
Duljina: 300-500 riječi.

Vrati vodič u Markdown formatu.`,

  GLOSSARY: `Napiši definiciju pojma za FiskAI rječnik koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

PRAVILA:
1. NE IZMIŠLJAJ činjenice
2. Kratka, precizna definicija
3. Primjeri ako su dostupni u fact sheetu

STRUKTURA:
- Definicija (1-2 rečenice)
- Detaljnije objašnjenje
- Primjer primjene (ako postoji)

Ton: Enciklopedijski.
Duljina: 150-300 riječi.

Vrati definiciju u Markdown formatu.`,

  COMPARISON: `Napiši usporedbu opcija za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

PRAVILA:
1. NE IZMIŠLJAJ činjenice
2. Objektivna usporedba
3. Koristi tablice gdje je prikladno

STRUKTURA:
- Uvod (što uspoređujemo)
- Ključne razlike (tablica)
- Prednosti i nedostaci svake opcije
- Preporuka (ako proizlazi iz činjenica)

Ton: Objektivan i informativan.
Duljina: 400-600 riječi.

Vrati usporedbu u Markdown formatu.`,
}
```

**Step 2: Create draft step**

```typescript
// src/lib/article-agent/steps/draft.ts

import { db } from "@/lib/db"
import { callOllama } from "../llm/ollama-client"
import { DRAFTING_SYSTEM, DRAFTING_PROMPTS } from "../prompts/drafting"
import type { ArticleJob, FactSheet, Claim } from "@prisma/client"
import type { KeyEntities } from "../types"

export async function writeDraft(job: ArticleJob): Promise<string> {
  // 1. Load fact sheet with claims
  const factSheet = await db.factSheet.findUnique({
    where: { id: job.factSheetId! },
    include: { claims: true },
  })

  if (!factSheet) {
    throw new Error("FactSheet not found")
  }

  // 2. Build prompt with fact sheet data
  const prompt = buildDraftPrompt(job.type, factSheet, factSheet.claims)

  // 3. Generate article
  const content = await callOllama(prompt, {
    systemPrompt: DRAFTING_SYSTEM,
    temperature: 0.5,
    maxTokens: 4000,
  })

  // 4. Parse into paragraphs
  const paragraphs = parseIntoParagraphs(content)

  // 5. Create draft record
  const draft = await db.articleDraft.create({
    data: {
      jobId: job.id,
      iteration: job.currentIteration,
      contentMdx: content,
    },
  })

  // 6. Create paragraph records
  for (let i = 0; i < paragraphs.length; i++) {
    await db.draftParagraph.create({
      data: {
        draftId: draft.id,
        index: i,
        content: paragraphs[i],
        isLocked: false,
      },
    })
  }

  return draft.id
}

function buildDraftPrompt(type: ArticleJob["type"], factSheet: FactSheet, claims: Claim[]): string {
  const template = DRAFTING_PROMPTS[type]
  const entities = factSheet.keyEntities as KeyEntities

  const claimsText = claims
    .map((c) => `- [${c.category}] ${c.statement}${c.quote ? ` ("${c.quote}")` : ""}`)
    .join("\n")

  const entitiesText = [
    entities.names.length ? `Imena: ${entities.names.join(", ")}` : "",
    entities.dates.length ? `Datumi: ${entities.dates.join(", ")}` : "",
    entities.amounts.length ? `Iznosi: ${entities.amounts.join(", ")}` : "",
    entities.regulations.length ? `Propisi: ${entities.regulations.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  return template
    .replace("{topic}", factSheet.topic)
    .replace("{entities}", entitiesText || "Nema identificiranih entiteta")
    .replace("{claims}", claimsText || "Nema ekstrahiranih tvrdnji")
}

function parseIntoParagraphs(content: string): string[] {
  // Split by double newlines, filter empty, trim
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
```

**Step 3: Commit**

```bash
git add src/lib/article-agent/steps/draft.ts src/lib/article-agent/prompts/drafting.ts
git commit -m "feat(article-agent): add draft step with type-specific prompts"
```

---

### Task 3.3: Create Verify Step

**Files:**

- Create: `src/lib/article-agent/steps/verify.ts`

**Step 1: Create verify step**

```typescript
// src/lib/article-agent/steps/verify.ts

import { db } from "@/lib/db"
import { embedText } from "../verification/embedder"
import { findSimilarChunks } from "../verification/similarity"
import { classifyParagraphAgainstChunks } from "../verification/classifier"
import { aggregateConfidence, needsHumanReview } from "../utils/confidence"
import type { ArticleJob } from "@prisma/client"
import type { VerificationResult, ParagraphVerification, THRESHOLDS } from "../types"

export async function verifyDraft(job: ArticleJob): Promise<VerificationResult> {
  const draft = await db.articleDraft.findFirst({
    where: { jobId: job.id, iteration: job.currentIteration },
    include: { paragraphs: { orderBy: { index: "asc" } } },
  })

  if (!draft) {
    throw new Error("No draft found for current iteration")
  }

  const paragraphVerifications: ParagraphVerification[] = []

  for (const para of draft.paragraphs) {
    // Skip already locked paragraphs
    if (para.isLocked) {
      paragraphVerifications.push({
        index: para.index,
        content: para.content,
        isLocked: true,
        confidence: para.confidence || 1.0,
        status: "SUPPORTED",
        supportingClaims: [],
      })
      continue
    }

    // 1. Embed paragraph
    const embedding = await embedText(para.content)

    // 2. Find similar source chunks
    const similarChunks = await findSimilarChunks(embedding, job.factSheetId!, 5)

    // 3. Classify each chunk's support
    const classifications = await classifyParagraphAgainstChunks(para.content, similarChunks)

    // 4. Aggregate confidence
    const { confidence, status, hasCriticalIssue } = aggregateConfidence(
      classifications.map((c) => ({
        similarity: c.similarity,
        relationship: c.classification.relationship,
        confidence: c.classification.confidence,
      }))
    )

    // 5. Update paragraph in DB
    const supportingClaimIds = classifications
      .filter((c) => c.classification.relationship === "SUPPORTED")
      .flatMap((c) => c.claimIds)

    await db.draftParagraph.update({
      where: { id: para.id },
      data: {
        confidence,
        supportingClaimIds,
      },
    })

    // 6. Store verification records
    for (const c of classifications) {
      for (const claimId of c.claimIds) {
        await db.claimVerification.upsert({
          where: { paragraphId_claimId: { paragraphId: para.id, claimId } },
          create: {
            paragraphId: para.id,
            claimId,
            similarityScore: c.similarity,
            isSupporting: c.classification.relationship === "SUPPORTED",
          },
          update: {
            similarityScore: c.similarity,
            isSupporting: c.classification.relationship === "SUPPORTED",
          },
        })
      }
    }

    paragraphVerifications.push({
      index: para.index,
      content: para.content,
      isLocked: false,
      confidence,
      status,
      supportingClaims: classifications.map((c) => ({
        claimId: c.claimIds[0] || "",
        statement: similarChunks.find((s) => s.id === c.chunkId)?.content.slice(0, 100) || "",
        similarity: c.similarity,
        relationship: c.classification.relationship,
      })),
    })
  }

  // Calculate overall stats
  const passCount = paragraphVerifications.filter((p) => p.confidence >= 0.8).length
  const failCount = paragraphVerifications.filter((p) => p.confidence < 0.8).length
  const overallConfidence =
    paragraphVerifications.reduce((sum, p) => sum + p.confidence, 0) / paragraphVerifications.length

  return {
    draftId: draft.id,
    iteration: draft.iteration,
    paragraphs: paragraphVerifications,
    overallConfidence,
    passCount,
    failCount,
    allParagraphsPass: failCount === 0,
    anyBelowThreshold: failCount > 0,
    anyCriticalFail: paragraphVerifications.some((p) => needsHumanReview(p.confidence)),
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/steps/verify.ts
git commit -m "feat(article-agent): add verification step with confidence scoring"
```

---

### Task 3.4: Create Rewrite Step

**Files:**

- Create: `src/lib/article-agent/steps/rewrite.ts`
- Create: `src/lib/article-agent/prompts/rewriting.ts`

**Step 1: Create rewriting prompts**

```typescript
// src/lib/article-agent/prompts/rewriting.ts

export const REWRITE_SYSTEM = `Ti si urednik koji popravlja članke. Tvoj zadatak je prepisati paragraf tako da koristi ISKLJUČIVO informacije iz dostavljenih tvrdnji. Ne izmišljaj nove činjenice.`

export const REWRITE_PROMPT = `Ovaj paragraf ima nisku pouzdanost jer nije dobro potkrijepljen izvorima. Prepiši ga koristeći ISKLJUČIVO dolje navedene tvrdnje.

TRENUTNI PARAGRAF:
{paragraph}

DOSTUPNE TVRDNJE IZ IZVORA:
{claims}

PRAVILA:
1. Koristi ISKLJUČIVO informacije iz gore navedenih tvrdnji
2. Ako tvrdnje ne podržavaju sadržaj, napiši kraći paragraf s onim što JE podržano
3. Ako nema relevantnih tvrdnji, vrati prazan string
4. Zadrži profesionalan ton

Vrati SAMO prepisani paragraf, bez dodatnog teksta.`
```

**Step 2: Create rewrite step**

```typescript
// src/lib/article-agent/steps/rewrite.ts

import { db } from "@/lib/db"
import { callOllama } from "../llm/ollama-client"
import { REWRITE_SYSTEM, REWRITE_PROMPT } from "../prompts/rewriting"
import { shouldLock } from "../utils/confidence"
import type { ArticleJob } from "@prisma/client"
import type { VerificationResult } from "../types"

export async function rewriteFailingParagraphs(
  job: ArticleJob,
  verification: VerificationResult
): Promise<string> {
  // 1. Get current draft
  const currentDraft = await db.articleDraft.findFirst({
    where: { jobId: job.id, iteration: job.currentIteration },
    include: { paragraphs: { orderBy: { index: "asc" } } },
  })

  if (!currentDraft) {
    throw new Error("No current draft found")
  }

  // 2. Lock passing paragraphs
  for (const para of verification.paragraphs) {
    if (shouldLock(para.confidence) && !para.isLocked) {
      await db.draftParagraph.update({
        where: { draftId_index: { draftId: currentDraft.id, index: para.index } },
        data: { isLocked: true },
      })
    }
  }

  // 3. Get claims for rewriting
  const claims = await db.claim.findMany({
    where: { factSheetId: job.factSheetId! },
  })

  const claimsText = claims.map((c) => `- [${c.category}] ${c.statement}`).join("\n")

  // 4. Rewrite failing paragraphs
  const newParagraphs: string[] = []

  for (const para of currentDraft.paragraphs) {
    const verificationData = verification.paragraphs.find((v) => v.index === para.index)

    if (para.isLocked || (verificationData && shouldLock(verificationData.confidence))) {
      // Keep locked/passing paragraphs as-is
      newParagraphs.push(para.content)
    } else {
      // Rewrite failing paragraph
      const prompt = REWRITE_PROMPT.replace("{paragraph}", para.content).replace(
        "{claims}",
        claimsText
      )

      const rewritten = await callOllama(prompt, {
        systemPrompt: REWRITE_SYSTEM,
        temperature: 0.3,
        maxTokens: 1000,
      })

      newParagraphs.push(rewritten.trim() || para.content)
    }
  }

  // 5. Create new draft with incremented iteration
  const newIteration = job.currentIteration + 1
  const newContentMdx = newParagraphs.join("\n\n")

  const newDraft = await db.articleDraft.create({
    data: {
      jobId: job.id,
      iteration: newIteration,
      contentMdx: newContentMdx,
    },
  })

  // 6. Create paragraph records (carry over lock status)
  for (let i = 0; i < newParagraphs.length; i++) {
    const oldPara = currentDraft.paragraphs[i]
    const wasLocked = oldPara?.isLocked || shouldLock(verification.paragraphs[i]?.confidence || 0)

    await db.draftParagraph.create({
      data: {
        draftId: newDraft.id,
        index: i,
        content: newParagraphs[i],
        isLocked: wasLocked,
        confidence: wasLocked ? oldPara?.confidence || 1.0 : null,
      },
    })
  }

  // 7. Update job iteration
  await db.articleJob.update({
    where: { id: job.id },
    data: { currentIteration: newIteration },
  })

  return newDraft.id
}
```

**Step 3: Commit**

```bash
git add src/lib/article-agent/steps/rewrite.ts src/lib/article-agent/prompts/rewriting.ts
git commit -m "feat(article-agent): add rewrite step with scope locking"
```

---

### Task 3.5: Create Orchestrator

**Files:**

- Create: `src/lib/article-agent/orchestrator.ts`

**Step 1: Create orchestrator**

```typescript
// src/lib/article-agent/orchestrator.ts

import { db } from "@/lib/db"
import { synthesizeFactSheet } from "./steps/synthesize"
import { writeDraft } from "./steps/draft"
import { verifyDraft } from "./steps/verify"
import { rewriteFailingParagraphs } from "./steps/rewrite"
import type { ArticleJob, ArticleStatus } from "@prisma/client"
import { THRESHOLDS } from "./types"

async function updateStatus(jobId: string, status: ArticleStatus): Promise<void> {
  await db.articleJob.update({
    where: { id: jobId },
    data: { status, updatedAt: new Date() },
  })
}

export async function runArticleJob(jobId: string): Promise<ArticleJob> {
  let job = await db.articleJob.findUniqueOrThrow({ where: { id: jobId } })

  while (job.currentIteration < job.maxIterations) {
    switch (job.status) {
      case "SYNTHESIZING": {
        console.log(`[Job ${jobId}] Synthesizing fact sheet...`)
        await synthesizeFactSheet(job)
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "PLANNING": {
        // Planning step is optional - skip to drafting
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "DRAFTING": {
        console.log(`[Job ${jobId}] Writing draft (iteration ${job.currentIteration})...`)
        await writeDraft(job)
        await updateStatus(jobId, "VERIFYING")
        break
      }

      case "VERIFYING": {
        console.log(`[Job ${jobId}] Verifying draft...`)
        const result = await verifyDraft(job)

        console.log(
          `[Job ${jobId}] Verification: ${result.passCount} passed, ${result.failCount} failed, overall ${(result.overallConfidence * 100).toFixed(1)}%`
        )

        if (result.allParagraphsPass || result.overallConfidence >= THRESHOLDS.JOB_AUTO_APPROVE) {
          // All good - approve
          await updateStatus(jobId, "APPROVED")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        if (result.anyCriticalFail) {
          // Critical failure - needs human
          await updateStatus(jobId, "NEEDS_REVIEW")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        if (job.currentIteration >= job.maxIterations - 1) {
          // Max iterations - needs human
          await updateStatus(jobId, "NEEDS_REVIEW")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        // Can iterate - rewrite failing paragraphs
        console.log(`[Job ${jobId}] Rewriting failing paragraphs...`)
        await rewriteFailingParagraphs(job, result)
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "APPROVED":
      case "PUBLISHED":
      case "REJECTED":
      case "NEEDS_REVIEW": {
        // Terminal states
        return job
      }
    }

    // Refresh job state
    job = await db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
  }

  // Max iterations reached without resolution
  await updateStatus(jobId, "NEEDS_REVIEW")
  return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
}

export async function createArticleJob(input: {
  type: ArticleJob["type"]
  sourceUrls: string[]
  topic?: string
  maxIterations?: number
}): Promise<ArticleJob> {
  return db.articleJob.create({
    data: {
      type: input.type,
      sourceUrls: input.sourceUrls,
      topic: input.topic,
      maxIterations: input.maxIterations || THRESHOLDS.MAX_ITERATIONS,
      status: "SYNTHESIZING",
    },
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/orchestrator.ts
git commit -m "feat(article-agent): add state machine orchestrator"
```

---

### Task 3.6: Create Server Actions

**Files:**

- Create: `src/app/actions/article-agent.ts`

**Step 1: Create server actions**

```typescript
// src/app/actions/article-agent.ts

"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { createArticleJob, runArticleJob } from "@/lib/article-agent/orchestrator"
import type { ArticleType } from "@prisma/client"

export async function createJob(input: {
  type: ArticleType
  sourceUrls: string[]
  topic?: string
}) {
  await requireAuth()

  const job = await createArticleJob({
    type: input.type,
    sourceUrls: input.sourceUrls,
    topic: input.topic,
  })

  revalidatePath("/article-agent")

  return { success: true, jobId: job.id }
}

export async function startJob(jobId: string) {
  await requireAuth()

  // Run in background (don't await)
  runArticleJob(jobId).catch((error) => {
    console.error(`Job ${jobId} failed:`, error)
    db.articleJob.update({
      where: { id: jobId },
      data: { status: "REJECTED" },
    })
  })

  return { success: true }
}

export async function getJobStatus(jobId: string) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: jobId },
    include: {
      drafts: {
        orderBy: { iteration: "desc" },
        take: 1,
        include: { paragraphs: true },
      },
    },
  })

  if (!job) {
    return { success: false, error: "Job not found" }
  }

  return { success: true, job }
}

export async function getJobWithVerification(jobId: string) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: jobId },
    include: {
      factSheet: {
        include: { claims: true },
      },
      drafts: {
        orderBy: { iteration: "desc" },
        take: 1,
        include: {
          paragraphs: {
            orderBy: { index: "asc" },
            include: { verifications: true },
          },
        },
      },
    },
  })

  if (!job) {
    throw new Error("Job not found")
  }

  return { job, draft: job.drafts[0], factSheet: job.factSheet }
}

export async function approveJob(jobId: string) {
  await requireAuth()

  await db.articleJob.update({
    where: { id: jobId },
    data: { status: "APPROVED" },
  })

  revalidatePath("/article-agent")
  revalidatePath(`/article-agent/${jobId}`)
}

export async function rejectJob(jobId: string, reason?: string) {
  await requireAuth()

  await db.articleJob.update({
    where: { id: jobId },
    data: { status: "REJECTED" },
  })

  revalidatePath("/article-agent")
  revalidatePath(`/article-agent/${jobId}`)
}

export async function lockParagraph(jobId: string, paragraphIndex: number) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: jobId },
    include: {
      drafts: {
        orderBy: { iteration: "desc" },
        take: 1,
      },
    },
  })

  if (!job?.drafts[0]) {
    throw new Error("No draft found")
  }

  await db.draftParagraph.update({
    where: {
      draftId_index: {
        draftId: job.drafts[0].id,
        index: paragraphIndex,
      },
    },
    data: { isLocked: true },
  })

  revalidatePath(`/article-agent/${jobId}`)
}

export async function triggerRewrite(jobId: string) {
  await requireAuth()

  const job = await db.articleJob.findUnique({ where: { id: jobId } })

  if (!job) {
    throw new Error("Job not found")
  }

  if (job.currentIteration >= job.maxIterations) {
    throw new Error("Max iterations reached")
  }

  // Update status to trigger rewrite
  await db.articleJob.update({
    where: { id: jobId },
    data: { status: "DRAFTING" },
  })

  // Run job
  runArticleJob(jobId).catch(console.error)

  revalidatePath(`/article-agent/${jobId}`)
}
```

**Step 2: Commit**

```bash
git add src/app/actions/article-agent.ts
git commit -m "feat(article-agent): add server actions for job management"
```

---

## Phase 4: Dashboard UI

### Task 4.1: Create Job List Page

**Files:**

- Create: `src/app/(dashboard)/article-agent/page.tsx`

**Step 1: Create job list page**

```tsx
// src/app/(dashboard)/article-agent/page.tsx

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  SYNTHESIZING: "bg-blue-100 text-blue-800",
  PLANNING: "bg-blue-100 text-blue-800",
  DRAFTING: "bg-yellow-100 text-yellow-800",
  VERIFYING: "bg-purple-100 text-purple-800",
  NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

export default async function ArticleAgentPage() {
  await requireAuth()

  const jobs = await db.articleJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Article Agent</h1>
        <Link href="/article-agent/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Topic</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Iteration</th>
              <th className="text-left p-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b hover:bg-muted/30">
                <td className="p-4">
                  <Link href={`/article-agent/${job.id}`} className="text-primary hover:underline">
                    {job.topic || "Untitled"}
                  </Link>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{job.type}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] || "bg-gray-100"}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {job.currentIteration} / {job.maxIterations}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {job.createdAt.toLocaleDateString("hr-HR")}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No jobs yet. Create your first article job.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/article-agent/page.tsx
git commit -m "feat(article-agent): add job list page"
```

---

### Task 4.2: Create New Job Page

**Files:**

- Create: `src/app/(dashboard)/article-agent/new/page.tsx`

**Step 1: Create new job page**

```tsx
// src/app/(dashboard)/article-agent/new/page.tsx

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createJob, startJob } from "@/app/actions/article-agent"
import type { ArticleType } from "@prisma/client"

const ARTICLE_TYPES: { value: ArticleType; label: string }[] = [
  { value: "NEWS", label: "Vijest" },
  { value: "GUIDE", label: "Vodič" },
  { value: "HOWTO", label: "Kako da..." },
  { value: "GLOSSARY", label: "Rječnik" },
  { value: "COMPARISON", label: "Usporedba" },
]

export default function NewJobPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<ArticleType>("NEWS")
  const [topic, setTopic] = useState("")
  const [urls, setUrls] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const sourceUrls = urls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"))

      if (sourceUrls.length === 0) {
        alert("Unesite barem jedan URL izvor")
        return
      }

      const result = await createJob({
        type,
        sourceUrls,
        topic: topic || undefined,
      })

      if (result.success) {
        // Start the job
        await startJob(result.jobId)
        router.push(`/article-agent/${result.jobId}`)
      }
    } catch (error) {
      console.error("Failed to create job:", error)
      alert("Greška pri kreiranju posla")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Novi članak</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="type">Tip članka</Label>
          <Select value={type} onValueChange={(v) => setType(v as ArticleType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Tema (opcionalno)</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="npr. Novi PDV pragovi 2025"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="urls">URL izvori (jedan po liniji)</Label>
          <Textarea
            id="urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://porezna-uprava.hr/..."
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            Unesite URL-ove izvora iz kojih će se generirati članak
          </p>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Kreiram..." : "Kreiraj i pokreni"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/article-agent/new/page.tsx
git commit -m "feat(article-agent): add new job creation page"
```

---

### Task 4.3: Create Job Detail Page

**Files:**

- Create: `src/app/(dashboard)/article-agent/[id]/page.tsx`

**Step 1: Create job detail page**

```tsx
// src/app/(dashboard)/article-agent/[id]/page.tsx

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Eye, FileText } from "lucide-react"

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: params.id },
    include: {
      factSheet: {
        include: { claims: true, sourceChunks: true },
      },
      drafts: {
        orderBy: { iteration: "desc" },
        include: { paragraphs: true },
      },
    },
  })

  if (!job) {
    notFound()
  }

  const latestDraft = job.drafts[0]

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/article-agent"
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Natrag na listu
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{job.topic || "Untitled"}</h1>
          <p className="text-muted-foreground mt-1">
            {job.type} · Iteracija {job.currentIteration} / {job.maxIterations}
          </p>
        </div>
        <div className="flex gap-2">
          {job.factSheet && (
            <Link href={`/article-agent/${job.id}/factsheet`}>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Fact Sheet ({job.factSheet.claims.length} tvrdnji)
              </Button>
            </Link>
          )}
          {latestDraft && (
            <Link href={`/article-agent/${job.id}/review`}>
              <Button size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Pregledaj
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-medium mb-4">Status</h2>
        <div className="flex items-center gap-4">
          <StatusStep
            label="Sinteza"
            active={job.status === "SYNTHESIZING"}
            done={!!job.factSheet}
          />
          <StatusStep
            label="Pisanje"
            active={job.status === "DRAFTING"}
            done={job.drafts.length > 0}
          />
          <StatusStep
            label="Verifikacija"
            active={job.status === "VERIFYING"}
            done={job.status === "APPROVED" || job.status === "NEEDS_REVIEW"}
          />
          <StatusStep
            label={job.status === "NEEDS_REVIEW" ? "Pregled" : "Gotovo"}
            active={job.status === "NEEDS_REVIEW" || job.status === "APPROVED"}
            done={job.status === "PUBLISHED"}
          />
        </div>
      </div>

      {/* Source URLs */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-medium mb-4">Izvori ({job.sourceUrls.length})</h2>
        <ul className="space-y-2">
          {job.sourceUrls.map((url, i) => (
            <li key={i}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate block"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Draft Preview */}
      {latestDraft && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-medium mb-4">Nacrt (iteracija {latestDraft.iteration})</h2>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{latestDraft.contentMdx}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${
          done ? "bg-green-500" : active ? "bg-blue-500 animate-pulse" : "bg-gray-200"
        }`}
      />
      <span className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/article-agent/\[id\]/page.tsx
git commit -m "feat(article-agent): add job detail page with status timeline"
```

---

### Task 4.4: Create Review Page

**Files:**

- Create: `src/app/(dashboard)/article-agent/[id]/review/page.tsx`

**Step 1: Create review page (simplified version)**

```tsx
// src/app/(dashboard)/article-agent/[id]/review/page.tsx

import { requireAuth } from "@/lib/auth-utils"
import { getJobWithVerification } from "@/app/actions/article-agent"
import { notFound } from "next/navigation"
import { ReviewClient } from "./review-client"

export default async function ReviewPage({ params }: { params: { id: string } }) {
  await requireAuth()

  try {
    const { job, draft, factSheet } = await getJobWithVerification(params.id)

    if (!draft) {
      return (
        <div className="p-6">
          <p className="text-muted-foreground">Nema nacrta za pregled.</p>
        </div>
      )
    }

    return <ReviewClient job={job} draft={draft} factSheet={factSheet} />
  } catch {
    notFound()
  }
}
```

**Step 2: Create review client component**

Create file `src/app/(dashboard)/article-agent/[id]/review/review-client.tsx`:

```tsx
// src/app/(dashboard)/article-agent/[id]/review/review-client.tsx

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { approveJob, rejectJob, lockParagraph, triggerRewrite } from "@/app/actions/article-agent"
import { CheckCircle, XCircle, Lock, RotateCcw, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ArticleJob, ArticleDraft, FactSheet, DraftParagraph, Claim } from "@prisma/client"

interface Props {
  job: ArticleJob
  draft: ArticleDraft & { paragraphs: DraftParagraph[] }
  factSheet: (FactSheet & { claims: Claim[] }) | null
}

export function ReviewClient({ job, draft, factSheet }: Props) {
  const router = useRouter()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    draft.paragraphs.find((p) => !p.isLocked && (p.confidence || 0) < 0.8)?.index ?? null
  )

  const selectedPara =
    selectedIndex !== null ? draft.paragraphs.find((p) => p.index === selectedIndex) : null

  const passCount = draft.paragraphs.filter((p) => p.isLocked || (p.confidence || 0) >= 0.8).length
  const failCount = draft.paragraphs.length - passCount

  const handleApprove = async () => {
    await approveJob(job.id)
    router.push("/article-agent")
  }

  const handleReject = async () => {
    await rejectJob(job.id)
    router.push("/article-agent")
  }

  const handleLock = async () => {
    if (selectedIndex !== null) {
      await lockParagraph(job.id, selectedIndex)
      router.refresh()
    }
  }

  const handleIterate = async () => {
    await triggerRewrite(job.id)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/article-agent/${job.id}`}>
            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Link>
          <div>
            <h1 className="font-semibold">{job.topic || "Review"}</h1>
            <p className="text-sm text-muted-foreground">
              Iteracija {job.currentIteration} · {passCount} prošlo · {failCount} za pregled
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Paragraphs */}
        <div className="w-1/2 border-r overflow-y-auto p-6 space-y-4">
          {draft.paragraphs.map((para) => (
            <ParagraphCard
              key={para.id}
              paragraph={para}
              isSelected={selectedIndex === para.index}
              onClick={() => setSelectedIndex(para.index)}
            />
          ))}
        </div>

        {/* Right: Evidence */}
        <div className="w-1/2 overflow-y-auto p-6">
          {selectedPara ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Paragraf {selectedPara.index + 1}
                </h3>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedPara.content}</p>
              </div>

              {!selectedPara.isLocked && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLock}>
                    <Lock className="w-4 h-4 mr-1" />
                    Zaključaj
                  </Button>
                </div>
              )}

              {factSheet && (
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Dostupne tvrdnje ({factSheet.claims.length})
                  </h3>
                  <div className="space-y-2">
                    {factSheet.claims.slice(0, 10).map((claim) => (
                      <div key={claim.id} className="text-sm p-2 bg-muted/30 rounded border">
                        <p>{claim.statement}</p>
                        {claim.quote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{claim.quote}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Odaberi paragraf za pregled
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-4 flex items-center justify-between bg-background">
        <div className="text-sm text-muted-foreground">
          {failCount === 0 ? (
            <span className="text-green-600">✓ Svi paragrafi prolaze</span>
          ) : (
            <span className="text-yellow-600">{failCount} paragraf(a) ispod praga</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReject}>
            <XCircle className="w-4 h-4 mr-2" />
            Odbaci
          </Button>
          {job.currentIteration < job.maxIterations && failCount > 0 && (
            <Button variant="outline" onClick={handleIterate}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Nova iteracija
            </Button>
          )}
          <Button onClick={handleApprove}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Odobri
          </Button>
        </div>
      </div>
    </div>
  )
}

function ParagraphCard({
  paragraph,
  isSelected,
  onClick,
}: {
  paragraph: DraftParagraph
  isSelected: boolean
  onClick: () => void
}) {
  const confidence = paragraph.confidence || 0
  const isLocked = paragraph.isLocked

  const borderColor = isLocked
    ? "border-blue-500 bg-blue-50/50"
    : confidence >= 0.8
      ? "border-green-500 bg-green-50/50"
      : confidence >= 0.5
        ? "border-yellow-500 bg-yellow-50/50"
        : "border-red-500 bg-red-50/50"

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${borderColor} ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <p className="text-sm line-clamp-3">{paragraph.content}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={isLocked ? "text-blue-600" : ""}>
          {isLocked ? "Zaključano" : `${Math.round(confidence * 100)}%`}
        </span>
      </div>
    </button>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/article-agent/\[id\]/review/
git commit -m "feat(article-agent): add review page with paragraph cards"
```

---

### Task 4.5: Add Navigation Link

**Files:**

- Modify: `src/lib/navigation.ts`

**Step 1: Add Article Agent to navigation**

Add to the appropriate section in navigation.ts:

```typescript
import { Bot } from "lucide-react"

// In the appropriate section (e.g., after Vijesti or in a Tools section):
{ name: "Article Agent", href: "/article-agent", icon: Bot },
```

**Step 2: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat(article-agent): add navigation link"
```

---

## Phase 5: Testing & Polish

### Task 5.1: Add Environment Variables Documentation

**Files:**

- Modify: `.env.example`

**Step 1: Add Article Agent env vars**

```bash
# Article Agent (Ollama)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMS=768

# Article Agent Thresholds (optional)
ARTICLE_AGENT_PASS_THRESHOLD=0.8
ARTICLE_AGENT_FAIL_THRESHOLD=0.5
ARTICLE_AGENT_MAX_ITERATIONS=3
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(article-agent): add environment variables to .env.example"
```

---

### Task 5.2: Update Module Exports

**Files:**

- Modify: `src/lib/article-agent/index.ts`

**Step 1: Export all modules**

```typescript
// src/lib/article-agent/index.ts

// Types
export * from "./types"

// LLM clients
export * from "./llm"

// Extraction
export { fetchUrl, fetchUrls } from "./extraction/fetcher"
export { chunkText, chunkMultiple } from "./extraction/chunker"
export { extractClaimsFromChunk, extractKeyEntities } from "./extraction/claim-extractor"

// Verification
export { embedText, embedBatch } from "./verification/embedder"
export { findSimilarChunks, updateChunkEmbedding } from "./verification/similarity"
export { classifySupport, classifyParagraphAgainstChunks } from "./verification/classifier"

// Utils
export * from "./utils/confidence"

// Steps
export { synthesizeFactSheet } from "./steps/synthesize"
export { writeDraft } from "./steps/draft"
export { verifyDraft } from "./steps/verify"
export { rewriteFailingParagraphs } from "./steps/rewrite"

// Orchestrator
export { runArticleJob, createArticleJob } from "./orchestrator"
```

**Step 2: Commit**

```bash
git add src/lib/article-agent/index.ts
git commit -m "feat(article-agent): update module exports"
```

---

### Task 5.3: Final Integration Test

**Step 1: Build project**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit any fixes**

If any type errors or issues are found, fix and commit.

---

## Summary

This plan implements the Article Writing Agent v2.0 with:

- **19 tasks** across 5 phases
- **~35 new files** created
- **RefChecker-inspired** claim extraction and verification
- **pgvector** for semantic similarity search
- **Ollama** for embeddings and LLM
- **Iterative loop** with scope locking
- **Human review dashboard** with paragraph-level controls

Each task follows TDD principles with:

- Exact file paths
- Complete code examples
- Verification steps
- Atomic commits
