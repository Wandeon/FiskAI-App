# APPENDIX: Article Worker Audit

> **Version:** 1.0.0
> **Last Updated:** 2026-01-14
> **Audit Type:** Comprehensive Stakeholder-Grade
> **Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overview and Purpose](#2-overview-and-purpose)
3. [Article Generation Process](#3-article-generation-process)
4. [LLM Integration](#4-llm-integration)
5. [Inputs: Trigger Mechanisms](#5-inputs-trigger-mechanisms)
6. [Outputs: Generated Artifacts](#6-outputs-generated-artifacts)
7. [Dependencies](#7-dependencies)
8. [Configuration](#8-configuration)
9. [Prompt Engineering Details](#9-prompt-engineering-details)
10. [Error Handling and Recovery](#10-error-handling-and-recovery)
11. [Quality Control Mechanisms](#11-quality-control-mechanisms)
12. [Known Limitations](#12-known-limitations)
13. [Recommended Improvements](#13-recommended-improvements)
14. [File Reference](#14-file-reference)

---

## 1. Executive Summary

The **Article Worker** is a BullMQ-based background worker responsible for orchestrating LLM-powered article generation within FiskAI's Regulatory Truth Layer (RTL). It implements a sophisticated fact-first content pipeline that synthesizes regulatory information from source URLs into verified, publication-ready articles in Croatian.

### Key Characteristics

| Attribute      | Value                     |
| -------------- | ------------------------- |
| Worker Type    | LLM-dependent             |
| Container Name | `fiskai-worker-article`   |
| Queue Name     | `article`                 |
| Concurrency    | 1 (sequential processing) |
| Lock Duration  | 15 minutes (900,000ms)    |
| Memory Limit   | 1GB                       |
| Rate Limit     | 2 jobs per minute         |

### Critical Design Decisions

1. **Fact-First Architecture**: Articles are generated from extracted, verifiable claims rather than free-form LLM generation
2. **Iterative Verification**: Multi-pass verification with automatic rewriting of low-confidence paragraphs
3. **Scope Locking**: High-confidence paragraphs are locked to prevent regression during rewrites
4. **Human Escalation**: Unresolvable issues escalate to human review queue

---

## 2. Overview and Purpose

### 2.1 Mission Statement

The Article Worker transforms regulatory source content into structured, factually accurate articles for Croatian entrepreneurs and accountants. It serves as the content generation engine for:

- News articles (`/vijesti`) - Regulatory updates and changes
- Knowledge hub guides (`/vodici`) - Educational content
- How-to guides (`/kako-da`) - Practical step-by-step instructions
- Glossary entries (`/rjecnik`) - Term definitions
- Comparisons (`/usporedbe`) - Option analysis

### 2.2 Position in RTL Pipeline

```
                          ┌─────────────────────────────────┐
                          │      RTL CONTENT PIPELINE       │
                          └─────────────────────────────────┘
                                         │
    ┌────────────────────────────────────┼────────────────────────────────────┐
    │                                    │                                    │
    ▼                                    ▼                                    ▼
┌───────────┐                    ┌───────────────┐                    ┌───────────────┐
│ SENTINEL  │                    │   EXTRACTOR   │                    │    ARTICLE    │
│ (scrape)  │                    │ (fact extract)│                    │   (generate)  │
└───────────┘                    └───────────────┘                    └───────────────┘
    │                                    │                                    │
    ▼                                    ▼                                    ▼
  Evidence                        RegulatoryRule                      Published Article
  Records                            Records                           (MDX/Database)
```

### 2.3 Key Responsibilities

1. **Job Coordination**: Process article generation jobs from the BullMQ queue
2. **Pipeline Orchestration**: Manage the multi-step synthesis-draft-verify loop
3. **Quality Assurance**: Ensure generated content meets confidence thresholds
4. **State Management**: Track iteration progress and paragraph lock status
5. **Error Recovery**: Handle failures gracefully with retry logic and DLQ escalation

---

## 3. Article Generation Process

### 3.1 High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARTICLE WRITING AGENT v2.0                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Source URLs                                                       │
│       │                                                             │
│       ▼                                                             │
│   ┌──────────────┐                                                  │
│   │ SYNTHESIZING │  Fetch → Extract claims → Build Fact Sheet      │
│   └──────┬───────┘                                                  │
│          │                                                          │
│          ▼                                                          │
│   ┌──────────────┐                                                  │
│   │   DRAFTING   │  Fact Sheet → MDX paragraphs                    │
│   └──────┬───────┘                                                  │
│          │                                                          │
│          ▼                                                          │
│   ┌──────────────┐     ┌─────────────────┐                         │
│   │  VERIFYING   │────▶│ Confidence < 80% │──┐                     │
│   └──────┬───────┘     └─────────────────┘  │                      │
│          │                                   │                      │
│          │ All pass                          │ iteration++          │
│          ▼                                   │                      │
│   ┌──────────────┐                          │                      │
│   │   APPROVED   │◀── Lock verified ◀───────┘                      │
│   └──────┬───────┘    paragraphs                                   │
│          │                                                          │
│          ▼                                                          │
│   ┌──────────────┐                                                  │
│   │  PUBLISHED   │  → MDX file / Database                          │
│   └──────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Status State Machine

| Status         | Description                                              | Next States                            |
| -------------- | -------------------------------------------------------- | -------------------------------------- |
| `SYNTHESIZING` | Fetching sources, extracting claims, building fact sheet | `DRAFTING`                             |
| `PLANNING`     | (Optional) Outline generation - currently skipped        | `DRAFTING`                             |
| `DRAFTING`     | LLM generates article from fact sheet                    | `VERIFYING`                            |
| `VERIFYING`    | Embedding + similarity search + confidence scoring       | `APPROVED`, `NEEDS_REVIEW`, `DRAFTING` |
| `NEEDS_REVIEW` | Human intervention required                              | `APPROVED`, `REJECTED`                 |
| `APPROVED`     | Ready for publication                                    | `PUBLISHED`                            |
| `PUBLISHED`    | Live content                                             | Terminal                               |
| `REJECTED`     | Discarded                                                | Terminal                               |

### 3.3 Detailed Step Breakdown

#### Step 1: SYNTHESIZING (`synthesize.ts`)

1. **URL Fetching**: Fetches all source URLs using Mozilla Readability for clean text extraction
2. **Text Chunking**: Splits content into overlapping chunks (1000 chars, 200 char overlap)
3. **Claim Extraction**: LLM extracts atomic, verifiable claims from each chunk
4. **Embedding Generation**: Creates vector embeddings for similarity search
5. **Key Entity Extraction**: Identifies names, dates, amounts, and regulations
6. **FactSheet Creation**: Stores all extracted data in database

**Output**: `FactSheet` record with associated `Claim` and `SourceChunk` records

#### Step 2: DRAFTING (`draft.ts`)

1. **Fact Sheet Loading**: Retrieves fact sheet and claims from database
2. **Prompt Construction**: Builds article-type-specific prompt with fact data
3. **LLM Generation**: Generates article content using Ollama
4. **Source Attribution**: Appends inline citations and source references
5. **Paragraph Parsing**: Splits content into individual paragraphs
6. **Draft Storage**: Creates `ArticleDraft` and `DraftParagraph` records

**Output**: `ArticleDraft` record with parsed `DraftParagraph` entries

#### Step 3: VERIFYING (`verify.ts`)

1. **Paragraph Embedding**: Generates vector for each paragraph
2. **Similarity Search**: Finds top-5 similar source chunks via pgvector
3. **Support Classification**: LLM classifies each chunk's relationship to paragraph
4. **Confidence Aggregation**: Calculates weighted confidence score
5. **Verification Recording**: Stores `ClaimVerification` records
6. **Decision Logic**:
   - All paragraphs >= 80%: `APPROVED`
   - Any paragraph < 50%: `NEEDS_REVIEW`
   - Some paragraphs 50-80%: Rewrite and iterate

**Output**: `VerificationResult` with paragraph-level confidence scores

#### Step 4: REWRITING (`rewrite.ts`)

1. **Lock High-Confidence**: Paragraphs >= 80% are locked
2. **Identify Failures**: Find paragraphs below threshold
3. **Targeted Rewrite**: LLM rewrites only failing paragraphs using available claims
4. **New Draft Creation**: Creates new draft preserving locked content
5. **Iteration Update**: Increments `currentIteration` counter

**Output**: New `ArticleDraft` with improved paragraphs

### 3.4 Iteration Logic

```typescript
// From orchestrator.ts
while (job.currentIteration < job.maxIterations) {
  // Process current state
  switch (job.status) {
    case "VERIFYING":
      // Check thresholds
      if (result.allParagraphsPass || result.overallConfidence >= 0.85) {
        // Auto-approve
        await updateStatus(jobId, "APPROVED")
        return job
      }
      if (result.anyCriticalFail || job.currentIteration >= job.maxIterations - 1) {
        // Escalate to human
        await updateStatus(jobId, "NEEDS_REVIEW")
        return job
      }
      // Rewrite and iterate
      await rewriteFailingParagraphs(job, result)
      break
    // ... other states
  }
}
```

---

## 4. LLM Integration

### 4.1 Ollama Configuration

The Article Worker uses Ollama for all LLM operations with the following configuration:

```typescript
// From llm/ollama-client.ts
export function getOllamaConfig(): OllamaConfig {
  return {
    endpoint: process.env.OLLAMA_ENDPOINT || "https://ollama.com",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    embedDims: parseInt(process.env.OLLAMA_EMBED_DIMS || "768"),
    apiKey: process.env.OLLAMA_API_KEY,
  }
}
```

### 4.2 Split Configuration Strategy

| Function        | Endpoint                | Model                                   | Purpose                                            |
| --------------- | ----------------------- | --------------------------------------- | -------------------------------------------------- |
| Text Generation | `OLLAMA_ENDPOINT`       | `OLLAMA_MODEL` (llama3.1)               | Article drafting, claim extraction, classification |
| Embeddings      | `OLLAMA_EMBED_ENDPOINT` | `OLLAMA_EMBED_MODEL` (nomic-embed-text) | Vector similarity search                           |

### 4.3 API Communication

**Chat API** (for generation):

```typescript
const response = await fetch(`${config.endpoint}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  },
  body: JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    stream: false,
    options: { temperature, num_predict: maxTokens },
  }),
})
```

**Embed API** (for vectors):

```typescript
const response = await fetch(`${config.endpoint}/api/embed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: config.model,
    input: text,
  }),
})
```

### 4.4 Temperature Settings

| Operation                | Temperature | Rationale                          |
| ------------------------ | ----------- | ---------------------------------- |
| Claim Extraction         | 0.2         | High precision for fact extraction |
| Key Entity Extraction    | 0.1         | Very deterministic                 |
| Article Drafting         | 0.5         | Balanced creativity/accuracy       |
| Paragraph Classification | 0.1         | Deterministic classification       |
| Rewriting                | 0.3         | Controlled variation               |

### 4.5 Retry Logic

```typescript
// Exponential backoff with 3 retries
for (let attempt = 0; attempt < retries; attempt++) {
  try {
    // Make API call
  } catch (error) {
    if (error instanceof OllamaError && error.statusCode === 401) {
      throw error // Don't retry auth failures
    }
    if (attempt < retries - 1) {
      const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

---

## 5. Inputs: Trigger Mechanisms

### 5.1 Job Types

The Article Worker processes two job actions:

| Action     | Description                             | Required Fields      |
| ---------- | --------------------------------------- | -------------------- |
| `generate` | Create new article job and run pipeline | `type`, `sourceUrls` |
| `process`  | Run existing job through pipeline       | `jobId`              |

### 5.2 Job Data Interface

```typescript
export interface ArticleJobData {
  action: "generate" | "process"
  jobId?: string // For 'process' action
  type?: ArticleType // NEWS, GUIDE, HOWTO, GLOSSARY, COMPARISON
  sourceUrls?: string[] // Source URLs to synthesize
  topic?: string // Optional topic override
  maxIterations?: number // Override default (3)
  metadata?: {
    triggeredBy?: string // "news-cron", "rtl-release", "manual"
    newsItemId?: string // Reference to news item
    ruleId?: string // Reference to regulatory rule
  }
}
```

### 5.3 Trigger Sources

1. **News Cron** (`news-cron`)
   - Triggered by high-impact news detection
   - Passes `newsItemId` in metadata

2. **RTL Rule Releases** (`rtl-release`)
   - Triggered when new regulatory rules are published
   - Passes `ruleId` in metadata

3. **Manual Queue Submissions** (`manual`)
   - Admin-triggered via API or dashboard
   - User-specified sources and topic

### 5.4 Queue Configuration

```typescript
// From queues.ts
export const articleQueue = createQueue("article", {
  max: 2, // Max 2 jobs per minute
  duration: 60000, // 60 second window
})
```

---

## 6. Outputs: Generated Artifacts

### 6.1 Database Records

| Model               | Description                                       |
| ------------------- | ------------------------------------------------- |
| `ArticleJob`        | Master job record tracking status and iterations  |
| `FactSheet`         | Synthesized fact data with topic and key entities |
| `Claim`             | Individual extracted claims with confidence       |
| `SourceChunk`       | Text chunks with vector embeddings                |
| `ArticleDraft`      | Generated article content per iteration           |
| `DraftParagraph`    | Individual paragraphs with lock status            |
| `ClaimVerification` | Paragraph-claim relationship records              |

### 6.2 Article Output Format

Generated articles follow the FiskAI MDX convention:

```markdown
## TL;DR

- Key point 1 [^1]
- Key point 2 [^2]
- Key point 3

## Sto se promijenilo

Content explaining changes with inline citations [^1].

## Koga se tice

Target audience description [^2].

## Rokovi

- Deadline 1: YYYY-MM-DD
- Deadline 2: YYYY-MM-DD

## Sto trebate napraviti

1. Action step 1
2. Action step 2

## Izvori

[^1]: [source.hr](https://source.hr/article)

[^2]: [porezna.hr](https://porezna.hr/info)
```

### 6.3 Job Result Structure

```typescript
// Worker returns
{
  success: true,
  duration: 45000,  // ms
  data: {
    articleJobId: "cuid123",
    status: "APPROVED",
    iteration: 2,
    metadata: {
      triggeredBy: "news-cron",
      newsItemId: "news456"
    }
  }
}
```

---

## 7. Dependencies

### 7.1 Service Dependencies

| Service        | Purpose                               | Connection              |
| -------------- | ------------------------------------- | ----------------------- |
| PostgreSQL     | Article job persistence, fact storage | `DATABASE_URL`          |
| Redis          | BullMQ job queue                      | `REDIS_URL`             |
| Ollama (LLM)   | Text generation, classification       | `OLLAMA_ENDPOINT`       |
| Ollama (Embed) | Vector embeddings                     | `OLLAMA_EMBED_ENDPOINT` |

### 7.2 Code Dependencies

| Module                 | Purpose              |
| ---------------------- | -------------------- |
| `bullmq`               | Job queue processing |
| `@prisma/client`       | Database ORM         |
| `drizzle-orm`          | pgvector queries     |
| `jsdom`                | HTML parsing         |
| `@mozilla/readability` | Content extraction   |
| `prom-client`          | Metrics collection   |

### 7.3 Internal Dependencies

```
article.worker.ts
    ├── ./base (createWorker, setupGracefulShutdown)
    ├── ./queues (articleQueue)
    ├── ./metrics (jobsProcessed, jobDuration)
    ├── @/lib/db (Prisma client)
    └── @/lib/article-agent/orchestrator
        ├── ./steps/synthesize
        ├── ./steps/draft
        ├── ./steps/verify
        ├── ./steps/rewrite
        ├── ./llm/ollama-client
        ├── ./extraction/* (fetcher, chunker, claim-extractor)
        ├── ./verification/* (embedder, similarity, classifier)
        ├── ./prompts/* (extraction, drafting, verification, rewriting)
        └── ./utils/confidence
```

---

## 8. Configuration

### 8.1 Environment Variables

| Variable                       | Default                  | Description              |
| ------------------------------ | ------------------------ | ------------------------ |
| `OLLAMA_ENDPOINT`              | `https://ollama.com`     | LLM API endpoint         |
| `OLLAMA_MODEL`                 | `llama3.1`               | Model for generation     |
| `OLLAMA_API_KEY`               | -                        | API authentication       |
| `OLLAMA_EMBED_ENDPOINT`        | `http://localhost:11434` | Embedding endpoint       |
| `OLLAMA_EMBED_MODEL`           | `nomic-embed-text`       | Embedding model          |
| `OLLAMA_EMBED_DIMS`            | `768`                    | Vector dimensions        |
| `ARTICLE_AGENT_PASS_THRESHOLD` | `0.8`                    | Paragraph pass threshold |
| `ARTICLE_AGENT_FAIL_THRESHOLD` | `0.5`                    | Paragraph fail threshold |
| `ARTICLE_AGENT_MAX_ITERATIONS` | `3`                      | Max rewrite iterations   |
| `WORKER_CONCURRENCY`           | `1`                      | Concurrent jobs          |

### 8.2 Docker Compose Configuration

```yaml
# From docker-compose.workers.yml
worker-article:
  <<: *worker-common
  container_name: fiskai-worker-article
  command: ["node", "dist/workers/lib/regulatory-truth/workers/article.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT}
    OLLAMA_API_KEY: ${OLLAMA_API_KEY}
    OLLAMA_MODEL: ${OLLAMA_MODEL}
    WORKER_TYPE: article
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 1G
```

### 8.3 Worker Parameters

```typescript
// From article.worker.ts
const worker = createWorker<ArticleJobData>("article", processArticleJob, {
  name: "article",
  concurrency: 1, // Sequential processing
  lockDuration: 900000, // 15 minutes
  stalledInterval: 120000, // Check every 2 minutes
})
```

### 8.4 Threshold Configuration

Thresholds are managed via unified feature configuration:

```typescript
// From config/features.ts
export const ArticleAgentConfigSchema = z.object({
  passThreshold: z.number().min(0).max(1).default(0.8),
  failThreshold: z.number().min(0).max(1).default(0.5),
  maxIterations: z.number().min(1).max(10).default(3),
  jobAutoApprove: z.number().min(0).max(1).default(0.85),
  minSupportingClaims: z.number().min(0).default(1),
  topKChunks: z.number().min(1).default(5),
})
```

---

## 9. Prompt Engineering Details

### 9.1 System Prompts

All prompts are in Croatian to ensure natural language output.

**Drafting System Prompt:**

```
Ti si urednik FiskAI portala za hrvatske poduzetnike i racunovode.
Pises jasno, konkretno i bez floskula. Ne izmisljas cinjenice -
koristis ISKLJUCIVO informacije iz dostavljenog fact sheeta.
```

**Verification System Prompt:**

```
Ti si strucnjak za provjeru cinjenica. Budi precizan i objektivan.
Analiziraj odnos izmedu dokaza iz izvora i sadrzaja paragrafa.
```

**Rewriting System Prompt:**

```
Ti si urednik koji popravlja clanke. Tvoj zadatak je prepisati paragraf
tako da koristi ISKLJUCIVO informacije iz dostavljenih tvrdnji.
Ne izmisljaj nove cinjenice.
```

### 9.2 Article Type Templates

| Type       | Structure                                                              | Word Count |
| ---------- | ---------------------------------------------------------------------- | ---------- |
| NEWS       | TL;DR, Sto se promijenilo, Koga se tice, Rokovi, Sto trebate napraviti | 300-500    |
| GUIDE      | Uvod, H2 sections, Praktični koraci, Zakljucak                         | 500-800    |
| HOWTO      | Kratki uvod, Preduvjeti, Numerirani koraci, Cesti problemi             | 300-500    |
| GLOSSARY   | Definicija, Detaljnije objasnjenje, Primjer primjene                   | 150-300    |
| COMPARISON | Uvod, Kljucne razlike (tablica), Prednosti/nedostaci, Preporuka        | 400-600    |

### 9.3 Claim Extraction Prompt

```
Ekstrahiraj atomske cinjenicne tvrdnje iz ovog teksta izvora.

PRAVILA:
1. Svaka tvrdnja mora biti nezavisno provjerljiva
2. Ukljuci tocan citat koji podrzava svaku tvrdnju
3. Kategoriziraj: deadline (rok), amount (iznos), requirement (zahtjev),
   entity (entitet), general (opce)
4. Ocijeni pouzdanost ekstrakcije 0.0-1.0

Vrati JSON niz: [{ statement, quote, category, confidence }]
```

### 9.4 Classification Prompt

```
Analiziraj podrzava li IZVOR DOKAZ ovaj PARAGRAF iz clanka.

Klasificiraj odnos kao JEDNO od:
- SUPPORTED: Dokaz izravno podrzava tvrdnje paragrafa
- PARTIALLY_SUPPORTED: Dokaz podrzava neke ali ne sve tvrdnje
- NOT_SUPPORTED: Dokaz ne adresira tvrdnje paragrafa
- CONTRADICTED: Dokaz proturijeci tvrdnjama paragrafa

Vrati JSON: { relationship, confidence, explanation }
```

---

## 10. Error Handling and Recovery

### 10.1 Error Categories

| Category             | Handling                        | Recovery              |
| -------------------- | ------------------------------- | --------------------- |
| LLM API Timeout      | Exponential backoff             | 3 retries             |
| LLM 401 Unauthorized | Immediate fail                  | No retry, log error   |
| LLM Rate Limit (429) | Backoff + metrics               | Auto-retry            |
| Source Fetch Failure | Continue with available sources | Skip failed URL       |
| Database Error       | Throw to queue                  | BullMQ retry          |
| Embedding Failure    | Log and continue                | Verification may fail |

### 10.2 Job Validation

```typescript
// From article.worker.ts
if (action === "generate") {
  if (!type || !sourceUrls || sourceUrls.length === 0) {
    return {
      success: false,
      duration: 0,
      error: "Generate action requires type and sourceUrls",
    }
  }
}

if (action === "process") {
  if (!jobId) {
    return {
      success: false,
      duration: 0,
      error: "Process action requires jobId",
    }
  }
  const existingJob = await db.articleJob.findUnique({ where: { id: jobId } })
  if (!existingJob) {
    return {
      success: false,
      duration: 0,
      error: "Article job not found: " + jobId,
    }
  }
}
```

### 10.3 BullMQ Retry Configuration

```typescript
// From queues.ts
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
}
```

### 10.4 Dead Letter Queue

Failed jobs after all retries are moved to DLQ:

```typescript
// From base.ts
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

### 10.5 Graceful Shutdown

```typescript
// From article.worker.ts
setupGracefulShutdown([worker])

// From base.ts
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`)
  await Promise.all(workers.map((w) => w.close()))
  await closeRedis()
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
```

---

## 11. Quality Control Mechanisms

### 11.1 Confidence Scoring System

**Support Level Weights:**

| Level                 | Weight | Description                    |
| --------------------- | ------ | ------------------------------ |
| `SUPPORTED`           | 1.0    | Claim directly backs paragraph |
| `PARTIALLY_SUPPORTED` | 0.6    | Partial backing                |
| `NOT_SUPPORTED`       | 0.0    | No relevant evidence           |
| `CONTRADICTED`        | -0.5   | Evidence contradicts           |

**Confidence Calculation:**

```typescript
// From utils/confidence.ts
const rawConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0
const confidence = Math.max(0, Math.min(1, (rawConfidence + 0.5) / 1.5))
```

### 11.2 Threshold Actions

| Confidence  | Action                                 |
| ----------- | -------------------------------------- |
| >= 0.80     | Lock paragraph (preserved in rewrites) |
| 0.50 - 0.79 | Rewrite paragraph                      |
| < 0.50      | Critical fail - human review           |

### 11.3 Scope Locking

Paragraphs that pass verification are locked to prevent regression:

```typescript
// From steps/rewrite.ts
for (const para of verification.paragraphs) {
  if (shouldLock(para.confidence) && !para.isLocked) {
    await db.draftParagraph.update({
      where: { draftId_index: { draftId, index: para.index } },
      data: { isLocked: true },
    })
  }
}
```

### 11.4 Exit Conditions

1. **Auto-Approve**: All paragraphs >= 80% OR overall confidence >= 85%
2. **Human Review**: Any critical fail OR max iterations reached
3. **Max Iterations**: Hard cap at 3 (configurable) prevents infinite loops

### 11.5 Source Attribution

All generated content includes inline citations:

- Claims tagged with source URLs during extraction
- Drafting prompt includes source reference markers `[^N]`
- Sources section automatically generated from claim sources

### 11.6 Metrics Collection

```typescript
// From article.worker.ts
jobsProcessed.inc({ worker: "article", status: "success", queue: "article" })
jobDuration.observe({ worker: "article", queue: "article" }, duration / 1000)
```

---

## 12. Known Limitations

### 12.1 Technical Limitations

| Limitation         | Impact                      | Mitigation                        |
| ------------------ | --------------------------- | --------------------------------- |
| Single concurrency | Sequential processing only  | Prevents LLM rate limits          |
| 15-minute lock     | Long-running jobs may stall | Stalled job detection every 2 min |
| 1GB memory limit   | Large sources may OOM       | Chunking with 1000 char limit     |
| No streaming       | Full response required      | Acceptable for batch processing   |

### 12.2 Content Limitations

| Limitation            | Impact                  | Mitigation                      |
| --------------------- | ----------------------- | ------------------------------- |
| Croatian-only prompts | No multilingual support | Designed for Croatian market    |
| Limited article types | 5 predefined structures | Extensible via ArticleType enum |
| No image handling     | Text-only content       | Future: image extraction        |
| No PDF support        | Only HTML sources       | Use OCR worker for PDFs         |

### 12.3 Quality Limitations

| Limitation             | Impact                             | Mitigation                            |
| ---------------------- | ---------------------------------- | ------------------------------------- |
| LLM hallucination risk | Inaccurate claims possible         | Verification loop with source check   |
| Embedding accuracy     | Similar but wrong chunks retrieved | Top-5 chunks with classification      |
| Classification errors  | Support level misclassified        | Low temperature (0.1) for determinism |
| 3 iteration limit      | Some content may not converge      | Human review escalation               |

### 12.4 Operational Limitations

| Limitation     | Impact                     | Mitigation                            |
| -------------- | -------------------------- | ------------------------------------- |
| No unit tests  | Limited automated testing  | Feature config tests cover thresholds |
| No E2E tests   | Integration gaps           | Manual testing, monitoring            |
| Single model   | No fallback LLM            | Future: multi-model support           |
| Fixed chunking | May split sentences poorly | Sentence boundary detection           |

---

## 13. Recommended Improvements

### 13.1 High Priority

| Improvement                   | Rationale                       | Effort |
| ----------------------------- | ------------------------------- | ------ |
| **Add unit tests**            | Critical for refactoring safety | Medium |
| **Add integration tests**     | Validate full pipeline          | High   |
| **Implement circuit breaker** | Prevent cascading LLM failures  | Low    |
| **Add OpenTelemetry tracing** | Observability for debugging     | Medium |

### 13.2 Medium Priority

| Improvement                   | Rationale                            | Effort |
| ----------------------------- | ------------------------------------ | ------ |
| **Multi-model fallback**      | Resilience when primary LLM down     | Medium |
| **Streaming responses**       | Faster perceived performance         | Medium |
| **Parallel chunk processing** | Faster synthesis phase               | Medium |
| **Semantic caching**          | Reduce LLM calls for similar content | High   |

### 13.3 Low Priority

| Improvement               | Rationale             | Effort |
| ------------------------- | --------------------- | ------ |
| **Image extraction**      | Richer content output | High   |
| **PDF source support**    | Broader input types   | Medium |
| **Multilingual prompts**  | Market expansion      | High   |
| **A/B testing framework** | Prompt optimization   | High   |

### 13.4 Architecture Improvements

1. **Separate Synthesis Worker**: Extract fact synthesis into dedicated worker for parallelism
2. **Verification Cache**: Cache embedding results to avoid recomputation
3. **Progressive Verification**: Verify paragraphs as they're written, not all at once
4. **Human-in-the-Loop UI**: Build review dashboard for NEEDS_REVIEW status

### 13.5 Monitoring Improvements

1. **Per-step duration metrics**: Identify bottleneck steps
2. **Confidence distribution histograms**: Track quality trends
3. **Source fetch success rates**: Monitor external dependency health
4. **Iteration distribution**: Understand convergence patterns

---

## 14. File Reference

### 14.1 Core Files

| File                                                 | Purpose                         |
| ---------------------------------------------------- | ------------------------------- |
| `src/lib/regulatory-truth/workers/article.worker.ts` | Main worker entry point         |
| `src/lib/article-agent/orchestrator.ts`              | Pipeline orchestration          |
| `src/lib/article-agent/types.ts`                     | Type definitions and thresholds |

### 14.2 Step Implementations

| File                                        | Purpose                 |
| ------------------------------------------- | ----------------------- |
| `src/lib/article-agent/steps/synthesize.ts` | Fact sheet generation   |
| `src/lib/article-agent/steps/draft.ts`      | Article drafting        |
| `src/lib/article-agent/steps/verify.ts`     | Verification pipeline   |
| `src/lib/article-agent/steps/rewrite.ts`    | Paragraph rewriting     |
| `src/lib/article-agent/steps/publish.ts`    | Publication (if exists) |

### 14.3 LLM Integration

| File                                         | Purpose            |
| -------------------------------------------- | ------------------ |
| `src/lib/article-agent/llm/ollama-client.ts` | Ollama API client  |
| `src/lib/article-agent/llm/index.ts`         | LLM module exports |

### 14.4 Extraction Pipeline

| File                                                  | Purpose              |
| ----------------------------------------------------- | -------------------- |
| `src/lib/article-agent/extraction/fetcher.ts`         | URL content fetching |
| `src/lib/article-agent/extraction/chunker.ts`         | Text chunking        |
| `src/lib/article-agent/extraction/claim-extractor.ts` | Claim extraction     |

### 14.5 Verification Pipeline

| File                                               | Purpose                |
| -------------------------------------------------- | ---------------------- |
| `src/lib/article-agent/verification/embedder.ts`   | Text embedding         |
| `src/lib/article-agent/verification/similarity.ts` | pgvector queries       |
| `src/lib/article-agent/verification/classifier.ts` | Support classification |

### 14.6 Prompts

| File                                            | Purpose                  |
| ----------------------------------------------- | ------------------------ |
| `src/lib/article-agent/prompts/extraction.ts`   | Claim extraction prompts |
| `src/lib/article-agent/prompts/drafting.ts`     | Article drafting prompts |
| `src/lib/article-agent/prompts/verification.ts` | Classification prompts   |
| `src/lib/article-agent/prompts/rewriting.ts`    | Rewriting prompts        |

### 14.7 Utilities

| File                                        | Purpose               |
| ------------------------------------------- | --------------------- |
| `src/lib/article-agent/utils/confidence.ts` | Confidence scoring    |
| `src/lib/config/features.ts`                | Unified configuration |

### 14.8 Infrastructure

| File                                          | Purpose                 |
| --------------------------------------------- | ----------------------- |
| `src/lib/regulatory-truth/workers/base.ts`    | Worker factory          |
| `src/lib/regulatory-truth/workers/queues.ts`  | Queue definitions       |
| `src/lib/regulatory-truth/workers/metrics.ts` | Prometheus metrics      |
| `docker-compose.workers.yml`                  | Container configuration |

---

## Appendix A: Database Schema

```prisma
model ArticleJob {
  id               String        @id @default(cuid())
  type             ArticleType   // NEWS, GUIDE, HOWTO, GLOSSARY, COMPARISON
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
}

model FactSheet {
  id          String   @id @default(cuid())
  jobId       String   @unique
  topic       String
  keyEntities Json     // { names, dates, amounts, regulations }
  createdAt   DateTime @default(now())
}

model Claim {
  id            String  @id @default(cuid())
  factSheetId   String
  statement     String
  quote         String?
  sourceUrl     String
  sourceChunkId String?
  confidence    Float
  category      String? // deadline, amount, requirement, entity, general
}

model SourceChunk {
  id          String                        @id @default(cuid())
  factSheetId String
  sourceUrl   String
  content     String
  embedding   Unsupported("vector(768)")?
  fetchedAt   DateTime                      @default(now())
}

model ArticleDraft {
  id         String   @id @default(cuid())
  jobId      String
  iteration  Int
  contentMdx String
  createdAt  DateTime @default(now())
  @@unique([jobId, iteration])
}

model DraftParagraph {
  id                 String   @id @default(cuid())
  draftId            String
  index              Int
  content            String
  isLocked           Boolean  @default(false)
  confidence         Float?
  supportingClaimIds String[]
  @@unique([draftId, index])
}

model ClaimVerification {
  id              String   @id @default(cuid())
  paragraphId     String
  claimId         String
  similarityScore Float
  isSupporting    Boolean
  createdAt       DateTime @default(now())
  @@unique([paragraphId, claimId])
}

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

---

## Appendix B: Metrics Reference

| Metric                         | Type      | Labels                | Description               |
| ------------------------------ | --------- | --------------------- | ------------------------- |
| `worker_jobs_processed_total`  | Counter   | worker, status, queue | Total jobs processed      |
| `worker_job_duration_seconds`  | Histogram | worker, queue         | Job processing duration   |
| `worker_queue_depth`           | Gauge     | queue                 | Jobs waiting in queue     |
| `worker_active_jobs`           | Gauge     | worker                | Jobs currently processing |
| `worker_llm_calls_total`       | Counter   | worker, status        | LLM API calls             |
| `worker_rate_limit_hits_total` | Counter   | worker, domain        | Rate limit encounters     |

---

## Appendix C: Deployment Checklist

- [ ] `OLLAMA_ENDPOINT` configured and accessible
- [ ] `OLLAMA_API_KEY` set and valid
- [ ] `OLLAMA_MODEL` available on endpoint
- [ ] `OLLAMA_EMBED_ENDPOINT` configured (can differ from main endpoint)
- [ ] `OLLAMA_EMBED_MODEL` available
- [ ] `DATABASE_URL` points to PostgreSQL with pgvector extension
- [ ] `REDIS_URL` points to running Redis instance
- [ ] pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Vector index created on SourceChunk table
- [ ] Memory limit (1GB) appropriate for expected workload
- [ ] Monitoring dashboards configured for article metrics

---

_Document generated as part of FiskAI Regulatory Truth Layer worker audit series._
