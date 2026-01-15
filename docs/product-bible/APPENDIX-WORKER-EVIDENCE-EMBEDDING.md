# Appendix: Evidence Embedding Worker - Stakeholder Audit

> Version: 1.0.0
> Last Updated: 2026-01-14
> Status: Comprehensive Stakeholder-Grade Audit
> GitHub Issue: #828 (Evidence embedding generation is fire-and-forget without retry)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Implementation](#2-technical-implementation)
3. [Embedding Generation Process](#3-embedding-generation-process)
4. [Inputs](#4-inputs)
5. [Outputs](#5-outputs)
6. [Dependencies](#6-dependencies)
7. [Configuration](#7-configuration)
8. [Chunking Strategy](#8-chunking-strategy)
9. [Error Handling and Recovery](#9-error-handling-and-recovery)
10. [Monitoring and Observability](#10-monitoring-and-observability)
11. [Performance Considerations](#11-performance-considerations)
12. [Known Limitations](#12-known-limitations)
13. [Recommended Improvements](#13-recommended-improvements)
14. [Data Flow Diagram](#14-data-flow-diagram)
15. [Appendix A: Schema Definitions](#appendix-a-schema-definitions)
16. [Appendix B: Semantic Similarity Queries](#appendix-b-semantic-similarity-queries)

---

## 1. Overview

### 1.1 Purpose

The **Evidence Embedding Worker** generates vector embeddings for Evidence records to enable semantic duplicate detection within the Regulatory Truth Layer (RTL). This worker addresses a critical gap where traditional content-hash-based deduplication fails to detect semantically similar content from different sources.

**Core Value Proposition:**

- Detect duplicate Evidence from different sources (e.g., same law published on multiple regulatory websites)
- Identify content variations (HTML vs PDF versions, consolidated vs original text)
- Link semantically similar content that exact hash matching would miss
- Enable semantic search across the Evidence corpus

### 1.2 Role in Layer B (Processing)

The Evidence Embedding Worker operates as a **parallel auxiliary service** to the main RTL pipeline:

```
Layer A: Daily Discovery
    Sentinel -> Evidence Records
                      |
                      +--> [EVIDENCE EMBEDDING WORKER] (parallel)
                      |              |
                      v              v
Layer B: 24/7 Processing          Embeddings stored in Evidence.embedding
    OCR -> Extractor -> Composer -> Reviewer -> Arbiter -> Releaser
```

**Position in Pipeline:**

- **Upstream:** Sentinel (creates Evidence records with embeddingStatus=PENDING)
- **Downstream:** Semantic search queries, duplicate detection workflows
- **Parallel to:** OCR Worker, Extractor Worker (does not block main pipeline)

### 1.3 What "Evidence Embedding" Means

An **evidence embedding** is a dense vector representation of an Evidence record's content that captures semantic meaning:

| Component             | Description                         | Example                     |
| --------------------- | ----------------------------------- | --------------------------- |
| **Source Content**    | Normalized rawContent from Evidence | Regulatory document text    |
| **Vector Dimensions** | 768-dimensional float array         | [0.123, -0.456, 0.789, ...] |
| **Embedding Model**   | nomic-embed-text via Ollama         | Open-source embedding model |
| **Similarity Metric** | Cosine similarity                   | 0.95 = highly similar       |
| **Storage Format**    | PostgreSQL pgvector                 | vector(768) column type     |

**Key Principle:** Embeddings enable similarity-based matching where documents with semantically equivalent content (even if worded differently) will have high cosine similarity scores (>0.85).

---

## 2. Technical Implementation

### 2.1 Entry Point

**File:** `src/lib/regulatory-truth/workers/evidence-embedding.worker.ts`

```typescript
// Worker initialization
const worker = createWorker<EvidenceEmbeddingJobData>(
  "evidence-embedding",
  processEvidenceEmbeddingJob,
  {
    name: "evidence-embedding",
    concurrency: 2, // Process 2 evidence records in parallel
  }
)
```

### 2.2 Job Processing Flow

```
1. Receive Job (evidenceId, runId, attempt)
         |
         v
2. Update Evidence.embeddingStatus = "PROCESSING"
         |
         v
3. Fetch Evidence Record (id, rawContent, contentType)
         |
         v
4. Build Embedding Text
   +-- Normalize HTML content (remove noise)
   +-- Truncate to MAX_EMBEDDING_LENGTH (4000 chars)
         |
         v
5. Generate Embedding (embedText via Ollama)
   +-- POST to OLLAMA_EMBED_ENDPOINT/api/embed
   +-- Model: nomic-embed-text
   +-- Returns: 768-dimensional float array
         |
         v
6. Store Embedding in Database
   +-- UPDATE Evidence SET embedding = vector
   +-- Update embeddingStatus = "COMPLETED"
         |
         v
7. Record Metrics (jobsProcessed, jobDuration)
         |
         v
8. Return Result (embeddingDimensions)
```

### 2.3 Core Processing Function

```typescript
async function processEvidenceEmbeddingJob(job: Job<EvidenceEmbeddingJobData>): Promise<JobResult> {
  const { evidenceId } = job.data
  const attempt = job.attemptsMade + 1

  // Mark as processing
  await dbReg.evidence.update({
    where: { id: evidenceId },
    data: {
      embeddingStatus: "PROCESSING",
      embeddingAttempts: attempt,
      embeddingUpdatedAt: new Date(),
      embeddingError: null,
    },
  })

  // Generate the embedding
  const embedding = await generateEvidenceEmbedding(evidenceId)

  // Mark as completed
  await dbReg.evidence.update({
    where: { id: evidenceId },
    data: {
      embeddingStatus: "COMPLETED",
      embeddingUpdatedAt: new Date(),
    },
  })

  return {
    success: true,
    duration: Date.now() - start,
    data: { evidenceId, embeddingDimensions: embedding.length },
  }
}
```

### 2.4 Evidence Embedder Utility

**File:** `src/lib/regulatory-truth/utils/evidence-embedder.ts`

The embedding logic is encapsulated in a dedicated utility module:

```typescript
/**
 * Generate embedding for a single Evidence record
 */
export async function generateEvidenceEmbedding(evidenceId: string): Promise<number[]> {
  // 1. Fetch evidence
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, rawContent: true, contentType: true },
  })

  // 2. Build embedding text (normalize + truncate)
  const text = buildEvidenceEmbeddingText(evidence)

  // 3. Generate embedding via Ollama
  const embedding = await embedText(text)

  // 4. Store as pgvector
  await dbReg.$executeRaw`
    UPDATE "regulatory"."Evidence"
    SET "embedding" = ${JSON.stringify(embedding)}::vector
    WHERE "id" = ${evidenceId}
  `

  return embedding
}
```

---

## 3. Embedding Generation Process

### 3.1 Ollama Embedding Model: nomic-embed-text

The worker uses **nomic-embed-text**, an open-source embedding model with the following characteristics:

| Property         | Value                          |
| ---------------- | ------------------------------ |
| **Model Name**   | nomic-embed-text               |
| **Dimensions**   | 768                            |
| **Max Context**  | 8192 tokens                    |
| **Architecture** | Transformer-based              |
| **License**      | Apache 2.0                     |
| **Deployment**   | Local Ollama instance (GPU-01) |
| **API Endpoint** | /api/embed                     |

### 3.2 Embedding API Request

**File:** `src/lib/article-agent/verification/embedder.ts`

```typescript
export async function embedText(text: string): Promise<number[]> {
  const config = getEmbedConfig()

  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (config.apiKey && config.apiKey !== "local") {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: text,
    }),
  })

  const data = await response.json()
  // Returns: { embeddings: [[0.123, -0.456, ...]] }
  return data.embeddings[0]
}
```

### 3.3 Batch Embedding Support

For efficiency, the utility supports batch embedding generation:

```typescript
export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Ollama embed API supports batch input
  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: texts, // Array of texts
    }),
  })

  const data = await response.json()
  return data.embeddings // Array of embedding arrays
}
```

---

## 4. Inputs

### 4.1 Job Payload Schema

```typescript
export interface EvidenceEmbeddingJobData {
  evidenceId: string // UUID of Evidence record to embed
  runId: string // Correlation ID for tracking
  attempt?: number // Current retry attempt (1-3)
}
```

### 4.2 Evidence Record Requirements

The worker expects Evidence records with:

| Field             | Type     | Required | Description                      |
| ----------------- | -------- | -------- | -------------------------------- |
| `id`              | string   | Yes      | Evidence UUID                    |
| `rawContent`      | text     | Yes      | Full document content            |
| `contentType`     | string   | No       | MIME type hint (html, pdf, json) |
| `embeddingStatus` | string   | Yes      | Must be PENDING for new jobs     |
| `deletedAt`       | datetime | No       | Must be NULL (not soft-deleted)  |

### 4.3 Triggering Mechanisms

**1. Backfill Script (Manual):**

```bash
npx tsx scripts/backfill-evidence-embeddings.ts [--dry-run]
```

**2. Pipeline Trigger (Automatic):**
Jobs are queued when new Evidence records are created with `embeddingStatus=PENDING`.

**3. Queue Configuration:**

```typescript
// From queues.ts
export const evidenceEmbeddingQueue = createQueue("evidence-embedding", {
  max: 5,
  duration: 60000, // Rate limit: 5 jobs per 60 seconds
})
```

---

## 5. Outputs

### 5.1 Primary Output: Evidence.embedding

The worker updates the Evidence record with a 768-dimensional vector:

```sql
-- Storage format (PostgreSQL pgvector)
UPDATE "regulatory"."Evidence"
SET "embedding" = '[0.123, -0.456, 0.789, ...]'::vector(768)
WHERE "id" = 'evidence-uuid';
```

### 5.2 Status Fields Updated

| Field                | Type     | Success Value     | Failure Value         |
| -------------------- | -------- | ----------------- | --------------------- |
| `embeddingStatus`    | string   | "COMPLETED"       | "FAILED" or "PENDING" |
| `embeddingError`     | string   | null              | Error message         |
| `embeddingAttempts`  | int      | attempt count     | attempt count         |
| `embeddingUpdatedAt` | datetime | current timestamp | current timestamp     |

### 5.3 Job Result Schema

```typescript
interface JobResult {
  success: boolean
  duration: number // Processing time in milliseconds
  data: {
    evidenceId: string
    embeddingDimensions: number // Should be 768
  }
}
```

### 5.4 Metrics Emitted

```typescript
// Prometheus metrics
jobsProcessed.inc({
  worker: "evidence-embedding",
  status: "success" | "failed",
  queue: "evidence-embedding",
})

jobDuration.observe({ worker: "evidence-embedding", queue: "evidence-embedding" }, durationSeconds)
```

---

## 6. Dependencies

### 6.1 Service Dependencies

| Service          | Type     | Purpose                            | Failure Impact       |
| ---------------- | -------- | ---------------------------------- | -------------------- |
| **Ollama Embed** | External | Vector embedding generation        | Jobs fail with retry |
| **PostgreSQL**   | Database | Evidence records, pgvector storage | Complete failure     |
| **Redis**        | Queue    | BullMQ job management              | Worker cannot start  |

### 6.2 Internal Module Dependencies

```
evidence-embedding.worker.ts
    |
    +-- base.ts (createWorker, setupGracefulShutdown, JobResult)
    +-- metrics.ts (jobsProcessed, jobDuration)
    +-- @/lib/db (dbReg - regulatory database client)
    +-- ../utils/evidence-embedder.ts
            |
            +-- embedText, embedBatch (from article-agent/verification/embedder.ts)
            +-- normalizeHtmlContent (from ./content-hash.ts)
```

### 6.3 Database Schema Dependencies

**Required Extensions:**

- `pgvector` - PostgreSQL vector similarity extension

**Schema:** `regulatory`

**Table:** `Evidence` with columns:

- `embedding` - `vector(768)` type
- `embeddingStatus` - enum (PENDING, PROCESSING, COMPLETED, FAILED)
- `embeddingError` - text
- `embeddingAttempts` - integer
- `embeddingUpdatedAt` - timestamp

---

## 7. Configuration

### 7.1 Environment Variables

| Variable                  | Default                | Description                        |
| ------------------------- | ---------------------- | ---------------------------------- |
| `OLLAMA_EMBED_ENDPOINT`   | http://localhost:11434 | Ollama API endpoint for embeddings |
| `OLLAMA_EMBED_API_KEY`    | (none)                 | API key (optional for local)       |
| `OLLAMA_EMBED_MODEL`      | nomic-embed-text       | Embedding model name               |
| `OLLAMA_EMBED_DIMS`       | 768                    | Expected embedding dimensions      |
| `WORKER_CONCURRENCY`      | 2                      | Parallel job processing            |
| `REDIS_URL`               | (required)             | Redis connection for BullMQ        |
| `REGULATORY_DATABASE_URL` | (required)             | PostgreSQL connection              |

### 7.2 Docker Compose Configuration

**From:** `docker-compose.workers.yml`

```yaml
worker-evidence-embedding:
  <<: *worker-common
  container_name: fiskai-worker-evidence-embedding
  command: ["node", "dist/workers/lib/regulatory-truth/workers/evidence-embedding.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_EMBED_ENDPOINT: ${OLLAMA_EMBED_ENDPOINT}
    OLLAMA_EMBED_API_KEY: ${OLLAMA_EMBED_API_KEY}
    OLLAMA_EMBED_MODEL: ${OLLAMA_EMBED_MODEL:-nomic-embed-text}
    OLLAMA_EMBED_DIMS: ${OLLAMA_EMBED_DIMS:-768}
    WORKER_TYPE: evidence-embedding
    WORKER_CONCURRENCY: 2
  deploy:
    resources:
      limits:
        memory: 512M
```

### 7.3 Queue Configuration

```typescript
// From queues.ts
export const evidenceEmbeddingQueue = createQueue("evidence-embedding", {
  max: 5, // Max 5 jobs
  duration: 60000, // Per 60 seconds
})

// Default job options (from queues.ts)
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

---

## 8. Chunking Strategy

### 8.1 Content Truncation Approach

The worker uses a **truncation-based strategy** rather than true chunking:

```typescript
// From evidence-embedder.ts
const MAX_EMBEDDING_LENGTH = 4000 // Characters

export function buildEvidenceEmbeddingText(evidence: {
  rawContent: string
  contentType?: string
}): string {
  // Normalize HTML/text content to remove noise
  let text = normalizeHtmlContent(evidence.rawContent)

  // Truncate to max length if needed
  if (text.length > MAX_EMBEDDING_LENGTH) {
    text = text.substring(0, MAX_EMBEDDING_LENGTH)
  }

  return text.trim()
}
```

### 8.2 Rationale for Truncation

| Factor                  | Rationale                                           |
| ----------------------- | --------------------------------------------------- |
| **Document Essence**    | First 4000 chars capture title, intro, key sections |
| **Embedding Quality**   | Embedding models work best with focused text        |
| **API Efficiency**      | Reduces API costs and processing time               |
| **Semantic Similarity** | Document similarity primarily determined by intro   |

### 8.3 Normalization Process

**From:** `src/lib/regulatory-truth/utils/content-hash.ts`

```typescript
export function normalizeHtmlContent(content: string): string {
  return (
    content
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove style tags
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove common dynamic elements
      .replace(/\b\d{10,13}\b/g, "") // Unix timestamps
      .replace(/[a-f0-9]{32,}/gi, "") // Session IDs / hashes
      .trim()
  )
}
```

### 8.4 Chunking Limitations

**Current Approach Does NOT:**

- Chunk large documents into multiple embeddings
- Use overlapping windows for context preservation
- Weight different document sections differently
- Handle multi-page PDFs with page-aware chunking

These are documented as recommended improvements in [Section 13](#13-recommended-improvements).

---

## 9. Error Handling and Recovery

### 9.1 Retry Mechanism

```typescript
const MAX_ATTEMPTS = 3

// On failure:
const isFinalAttempt = attempt >= MAX_ATTEMPTS
await dbReg.evidence.update({
  where: { id: evidenceId },
  data: {
    embeddingStatus: isFinalAttempt ? "FAILED" : "PENDING",
    embeddingError: errorMessage,
    embeddingUpdatedAt: new Date(),
  },
})

// Throw to trigger BullMQ retry
throw error
```

### 9.2 BullMQ Retry Configuration

```typescript
// Exponential backoff: 10s -> 20s -> 40s
backoff: {
  type: "exponential",
  delay: 10000,
}
```

### 9.3 Status State Machine

```
                      +------------------+
                      |     PENDING      |
                      +--------+---------+
                               |
                    Job picked up by worker
                               |
                               v
                      +--------+---------+
                      |    PROCESSING    |
                      +--------+---------+
                               |
              +----------------+----------------+
              |                                 |
         Success                            Failure
              |                                 |
              v                                 v
    +---------+---------+            +----------+---------+
    |     COMPLETED     |            |  attempt < 3?      |
    +-------------------+            +----------+---------+
                                               |
                                  +------------+------------+
                                  |                         |
                                 Yes                        No
                                  |                         |
                                  v                         v
                         +--------+--------+       +--------+--------+
                         |     PENDING     |       |      FAILED     |
                         | (re-queue)      |       +--------+--------+
                         +-----------------+                |
                                                            v
                                                   Dead Letter Queue
```

### 9.4 Dead Letter Queue Integration

From `base.ts`:

```typescript
// Handle permanently failed jobs (all retries exhausted)
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

### 9.5 Error Categories

| Error Type             | Handling              | Recovery Path        |
| ---------------------- | --------------------- | -------------------- |
| **Evidence Not Found** | Job fails permanently | Manual investigation |
| **Empty Content**      | Job fails permanently | Data quality issue   |
| **Ollama Timeout**     | Retry with backoff    | Auto-retry (3x)      |
| **Ollama Rate Limit**  | Retry with backoff    | Auto-retry (3x)      |
| **Network Error**      | Retry with backoff    | Auto-retry (3x)      |
| **Invalid Response**   | Retry with backoff    | Auto-retry (3x)      |
| **Database Error**     | Retry with backoff    | Auto-retry (3x)      |

---

## 10. Monitoring and Observability

### 10.1 Prometheus Metrics

**From:** `src/lib/regulatory-truth/workers/metrics.ts`

```typescript
// Jobs processed counter
jobsProcessed.inc({
  worker: "evidence-embedding",
  status: "success" | "failed",
  queue: "evidence-embedding",
})

// Job duration histogram
jobDuration.observe({ worker: "evidence-embedding", queue: "evidence-embedding" }, duration / 1000)
```

### 10.2 Console Logging

```typescript
// On job start
console.log(
  `[evidence-embedding-worker] Processing embedding job for evidence ${evidenceId} (attempt ${attempt}/${MAX_ATTEMPTS})`
)

// On success
console.log(
  `[evidence-embedding-worker] Successfully generated embedding for evidence ${evidenceId} (${embedding.length} dimensions)`
)

// On failure
console.error(
  `[evidence-embedding-worker] Failed to generate embedding for evidence ${evidenceId}: ${errorMessage}`
)
```

### 10.3 Embedding Statistics

The utility provides aggregate statistics:

```typescript
export async function getEmbeddingStats(): Promise<{
  total: number
  withEmbedding: number
  withoutEmbedding: number
  percentage: number
}> {
  const result = await dbReg.$queryRaw`
    SELECT
      COUNT(*) as total,
      COUNT("embedding") as with_embedding,
      COUNT(*) - COUNT("embedding") as without_embedding
    FROM "regulatory"."Evidence"
    WHERE "deletedAt" IS NULL
  `
  // ...
}
```

### 10.4 Queue Health Checks

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-evidence-embedding --tail 50
```

---

## 11. Performance Considerations

### 11.1 Resource Profile

| Metric                  | Value           | Notes                      |
| ----------------------- | --------------- | -------------------------- |
| **Memory Limit**        | 512 MB          | Docker container limit     |
| **Concurrency**         | 2 jobs parallel | Per worker instance        |
| **Rate Limit**          | 5 jobs / 60s    | Queue-level rate limiting  |
| **Avg Processing Time** | ~2-5 seconds    | Depends on network latency |

### 11.2 Bottlenecks

| Bottleneck                | Impact                              | Mitigation               |
| ------------------------- | ----------------------------------- | ------------------------ |
| **Ollama API Latency**    | Single largest time consumer        | GPU-01 via Tailscale     |
| **Database Updates**      | 2 writes per job (start + complete) | Batching (future)        |
| **Content Normalization** | CPU-bound for large docs            | Truncation at 4000 chars |
| **Network Overhead**      | Remote Ollama endpoint              | Local GPU via Tailscale  |

### 11.3 Throughput Calculation

```
Max Throughput = (5 jobs / 60s) * 60 = 300 jobs/hour
                                     = 7,200 jobs/day

Realistic Throughput (with ~3s avg processing):
  = 2 concurrent * (60s / 3s) * 60 min = 2,400 jobs/hour
```

### 11.4 Backfill Performance

For initial backfill of existing Evidence records:

```bash
# Dry run to check pending count
npx tsx scripts/backfill-evidence-embeddings.ts --dry-run

# Full backfill
npx tsx scripts/backfill-evidence-embeddings.ts
```

Estimated backfill time: `(evidence_count / 300) hours`

---

## 12. Known Limitations

### 12.1 Chunking Limitations

| Limitation                        | Impact                                   | Workaround           |
| --------------------------------- | ---------------------------------------- | -------------------- |
| **4000 char truncation**          | Long documents may lose key information  | None currently       |
| **No overlapping chunks**         | Context loss at truncation boundary      | Increase limit       |
| **Single embedding per Evidence** | Cannot find similar sections within docs | Multi-chunk approach |
| **No page-aware processing**      | PDF page structure not preserved         | Future enhancement   |

### 12.2 Semantic Similarity Limitations

| Limitation                      | Impact                                            |
| ------------------------------- | ------------------------------------------------- |
| **Model bias**                  | nomic-embed-text trained on English corpus        |
| **Croatian language**           | May not capture Croatian-specific semantics       |
| **Legal terminology**           | Specialized terms may not embed well              |
| **Similarity threshold (0.85)** | May miss legitimate duplicates at lower threshold |

### 12.3 Operational Limitations

| Limitation                    | Impact                                     |
| ----------------------------- | ------------------------------------------ |
| **No automatic re-embedding** | Content updates don't trigger re-embedding |
| **No embedding versioning**   | Model changes invalidate old embeddings    |
| **Single worker instance**    | Limited horizontal scalability             |
| **No batch job support**      | Each evidence processed individually       |

### 12.4 Database Limitations

| Limitation                        | Impact                                   |
| --------------------------------- | ---------------------------------------- |
| **No HNSW index**                 | Linear scan for similarity (O(n))        |
| **No vector normalization check** | Assumes unit vectors from Ollama         |
| **Raw SQL for vector operations** | Prisma doesn't support pgvector natively |

---

## 13. Recommended Improvements

### 13.1 High Priority

| Improvement                        | Benefit                              | Effort |
| ---------------------------------- | ------------------------------------ | ------ |
| **Add HNSW index**                 | O(log n) similarity search           | Low    |
| **Implement re-embedding trigger** | Keep embeddings current on updates   | Medium |
| **Batch embedding API**            | Reduce API calls, improve throughput | Medium |
| **Croatian-optimized model**       | Better semantic understanding        | High   |

### 13.2 Medium Priority

| Improvement                | Benefit                      | Effort |
| -------------------------- | ---------------------------- | ------ |
| **Multi-chunk embeddings** | Full document similarity     | Medium |
| **Embedding versioning**   | Track model changes          | Medium |
| **Auto-dedup workflow**    | Automatic duplicate flagging | Medium |
| **Horizontal scaling**     | Multiple worker instances    | Low    |

### 13.3 Low Priority / Future

| Improvement                       | Benefit                         | Effort    |
| --------------------------------- | ------------------------------- | --------- |
| **Hybrid search (BM25 + vector)** | Better recall for exact matches | High      |
| **Fine-tuned embedding model**    | Domain-specific embeddings      | Very High |
| **Cross-evidence clustering**     | Automatic topic grouping        | High      |
| **Embedding compression**         | Reduced storage costs           | Medium    |

### 13.4 Specific Code Improvements

**1. Add HNSW Index:**

```sql
CREATE INDEX idx_evidence_embedding_hnsw
ON regulatory."Evidence"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**2. Re-embedding Trigger:**

```typescript
// In sentinel or evidence update logic:
if (contentChanged) {
  await evidenceEmbeddingQueue.add("re-embed", {
    evidenceId: evidence.id,
    runId: `re-embed-${Date.now()}`,
  })
}
```

**3. Batch Processing:**

```typescript
// Process multiple evidence records together
const BATCH_SIZE = 10
const pending = await findEvidenceWithoutEmbeddings(BATCH_SIZE)
const texts = pending.map((e) => buildEvidenceEmbeddingText(e))
const embeddings = await embedBatch(texts)
// Update all in single transaction
```

---

## 14. Data Flow Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │           EVIDENCE CREATION             │
                                    │   (Sentinel discovers new content)      │
                                    └─────────────────┬───────────────────────┘
                                                      │
                                                      │ embeddingStatus = "PENDING"
                                                      │
                                    ┌─────────────────▼───────────────────────┐
                                    │        BACKFILL SCRIPT / TRIGGER        │
                                    │   scripts/backfill-evidence-embeddings  │
                                    └─────────────────┬───────────────────────┘
                                                      │
                                                      │ Queue: evidence-embedding
                                                      │
                    ┌─────────────────────────────────▼─────────────────────────────────┐
                    │                     EVIDENCE EMBEDDING WORKER                      │
                    │              evidence-embedding.worker.ts                          │
                    ├──────────────────────────────────────────────────────────────────────┤
                    │                                                                      │
                    │  1. Update Status ────► embeddingStatus = "PROCESSING"              │
                    │         │                                                            │
                    │         ▼                                                            │
                    │  2. Fetch Evidence                                                   │
                    │         │                                                            │
                    │         ▼                                                            │
                    │  3. Build Embedding Text                                             │
                    │     ├── normalizeHtmlContent()                                       │
                    │     └── truncate to 4000 chars                                       │
                    │         │                                                            │
                    │         ▼                                                            │
                    │  4. Generate Embedding ─────────────────────────────────────────────┼────┐
                    │         │                                                            │    │
                    │         ▼                                                            │    │
                    │  5. Store Vector ───► Evidence.embedding = vector(768)              │    │
                    │         │                                                            │    │
                    │         ▼                                                            │    │
                    │  6. Update Status ────► embeddingStatus = "COMPLETED"               │    │
                    │                                                                      │    │
                    └──────────────────────────────────────────────────────────────────────┘    │
                                                                                                │
                                    ┌───────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────────────────────────────────────┐
                    │                        OLLAMA EMBED SERVICE                         │
                    │                    (GPU-01 via Tailscale)                           │
                    ├──────────────────────────────────────────────────────────────────────┤
                    │                                                                      │
                    │  Endpoint: OLLAMA_EMBED_ENDPOINT/api/embed                          │
                    │  Model:    nomic-embed-text                                          │
                    │  Input:    { model: "nomic-embed-text", input: "text..." }          │
                    │  Output:   { embeddings: [[0.123, -0.456, ...]] }                   │
                    │                                                                      │
                    └─────────────────────────────────────────────────────────────────────┘



                    ┌─────────────────────────────────────────────────────────────────────┐
                    │                     DOWNSTREAM CONSUMERS                             │
                    ├──────────────────────────────────────────────────────────────────────┤
                    │                                                                      │
                    │  1. findSimilarEvidence(evidenceId, minSimilarity)                  │
                    │     └── Cosine similarity search using pgvector                      │
                    │                                                                      │
                    │  2. findSimilarEvidenceByContent(content, minSimilarity)            │
                    │     └── Pre-ingest duplicate detection                               │
                    │                                                                      │
                    │  3. Semantic Search UI (future)                                      │
                    │     └── Evidence exploration by similarity                           │
                    │                                                                      │
                    └─────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Schema Definitions

### A.1 Evidence Table (Embedding Fields)

**From:** `prisma/regulatory.prisma`

```prisma
model Evidence {
  // ... other fields ...

  // Semantic similarity support for duplicate detection
  embedding          Unsupported("vector(768)")? // Vector embedding
  embeddingStatus    String  @default("PENDING")  // PENDING, PROCESSING, COMPLETED, FAILED
  embeddingError     String?                      // Error message if failed
  embeddingAttempts  Int     @default(0)          // Attempt count
  embeddingUpdatedAt DateTime?                    // Last status update

  @@index([embeddingStatus]) // For retry queue queries
  @@schema("regulatory")
}
```

### A.2 Job Data Interface

```typescript
export interface EvidenceEmbeddingJobData {
  evidenceId: string // Evidence record UUID
  runId: string // Correlation ID
  attempt?: number // Current attempt (1-3)
}
```

### A.3 Embedding Configuration

```typescript
export function getEmbedConfig() {
  return {
    endpoint: process.env.OLLAMA_EMBED_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    dims: parseInt(process.env.OLLAMA_EMBED_DIMS || "768"),
    apiKey: process.env.OLLAMA_EMBED_API_KEY,
  }
}
```

---

## Appendix B: Semantic Similarity Queries

### B.1 Find Similar Evidence by ID

```typescript
export async function findSimilarEvidence(
  evidenceId: string,
  minSimilarity: number = 0.85,
  limit: number = 10
): Promise<
  Array<{
    id: string
    url: string
    contentHash: string
    similarity: number
    sourceId: string
  }>
> {
  // Get the evidence embedding
  const evidence = await dbReg.$queryRaw`
    SELECT "embedding"::text as embedding
    FROM "regulatory"."Evidence"
    WHERE "id" = ${evidenceId}
      AND "embedding" IS NOT NULL
  `

  // Find similar using cosine distance
  const results = await dbReg.$queryRaw`
    SELECT
      "id", "url", "contentHash", "sourceId",
      1 - ("embedding" <=> ${queryEmbedding}::vector) as similarity
    FROM "regulatory"."Evidence"
    WHERE "id" != ${evidenceId}
      AND "embedding" IS NOT NULL
      AND "deletedAt" IS NULL
      AND 1 - ("embedding" <=> ${queryEmbedding}::vector) >= ${minSimilarity}
    ORDER BY "embedding" <=> ${queryEmbedding}::vector ASC
    LIMIT ${limit}
  `
  return results
}
```

### B.2 Find Similar Evidence by Content

```typescript
export async function findSimilarEvidenceByContent(
  content: string,
  contentType?: string,
  minSimilarity: number = 0.85,
  limit: number = 10
): Promise<
  Array<{
    id: string
    url: string
    contentHash: string
    similarity: number
    sourceId: string
  }>
> {
  // Build embedding text and generate embedding
  const text = buildEvidenceEmbeddingText({ rawContent: content, contentType })
  const embedding = await embedText(text)

  // Find similar using cosine distance
  const results = await dbReg.$queryRaw`
    SELECT
      "id", "url", "contentHash", "sourceId",
      1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "regulatory"."Evidence"
    WHERE "embedding" IS NOT NULL
      AND "deletedAt" IS NULL
      AND 1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) >= ${minSimilarity}
    ORDER BY "embedding" <=> ${JSON.stringify(embedding)}::vector ASC
    LIMIT ${limit}
  `
  return results
}
```

### B.3 Embedding Statistics Query

```sql
SELECT
  COUNT(*) as total,
  COUNT("embedding") as with_embedding,
  COUNT(*) - COUNT("embedding") as without_embedding,
  ROUND(COUNT("embedding")::numeric / COUNT(*)::numeric * 100, 2) as percentage
FROM "regulatory"."Evidence"
WHERE "deletedAt" IS NULL;
```

---

## Document History

| Version | Date       | Author                  | Changes                   |
| ------- | ---------- | ----------------------- | ------------------------- |
| 1.0.0   | 2026-01-14 | Claude Opus 4.5 (Audit) | Initial stakeholder audit |

---

_End of Document_
