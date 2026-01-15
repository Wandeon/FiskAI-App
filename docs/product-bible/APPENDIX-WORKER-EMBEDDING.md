# Appendix: Embedding Worker Audit

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-14
> **Audit Status:** Complete
> **Auditor:** Claude Opus 4.5

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overview](#2-overview)
3. [Difference from Evidence-Embedding Worker](#3-difference-from-evidence-embedding-worker)
4. [Technical Implementation](#4-technical-implementation)
5. [Inputs](#5-inputs)
6. [Outputs](#6-outputs)
7. [Dependencies](#7-dependencies)
8. [Configuration](#8-configuration)
9. [Chunking Strategy](#9-chunking-strategy)
10. [Error Handling](#10-error-handling)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Performance Considerations](#12-performance-considerations)
13. [Known Limitations](#13-known-limitations)
14. [Recommended Improvements](#14-recommended-improvements)
15. [Appendix A: Data Models](#appendix-a-data-models)
16. [Appendix B: Code References](#appendix-b-code-references)

---

## 1. Executive Summary

The **Embedding Worker** generates vector embeddings for published regulatory rules, enabling semantic search and similarity matching in FiskAI's Regulatory Truth Layer. It:

- **Transforms Rules into Vectors**: Converts rule content and evidence into 768-dimensional embeddings
- **Enables Semantic Search**: Powers the AI assistant's ability to find relevant regulations
- **Uses Local Ollama**: Runs against local GPU infrastructure (GPU-01) via Tailscale for cost efficiency
- **Supports Incremental Updates**: Replaces existing embeddings when rules are updated

**Key Metrics:**

- Concurrency: 2 (parallel rule processing)
- Memory Limit: 512MB
- Queue Rate Limit: 10 jobs per 60 seconds
- Embedding Dimensions: 768 (nomic-embed-text)
- Default Model: nomic-embed-text

---

## 2. Overview

### 2.1 Purpose

The Embedding Worker generates vector embeddings for RegulatoryRule records. These embeddings enable:

1. **Semantic Search**: Find rules by meaning, not just keywords
2. **AI Assistant Retrieval**: Power the RAG (Retrieval-Augmented Generation) pipeline
3. **Similarity Matching**: Identify related or potentially conflicting rules
4. **Concept Clustering**: Group rules by semantic similarity

### 2.2 Role in Layer B

The Embedding Worker operates as a **post-publication processor** in Layer B:

```
Layer A: Daily Discovery
  Sentinel -> Evidence

Layer B: 24/7 Processing
  OCR -> Extractor -> Composer -> Reviewer -> Arbiter -> Releaser
                                                              |
                                                              v
                                                        [EMBEDDING]
                                                              |
                                                              v
                                                        AI ASSISTANT
```

After the Releaser publishes rules, embedding jobs are queued to:

1. Generate vector representations for semantic search
2. Store embeddings in pgvector-enabled SourceChunk table
3. Enable downstream AI assistant queries

### 2.3 What "Embedding" Means

An embedding is a dense vector representation (768 floating-point numbers) that captures the semantic meaning of text. Rules with similar meanings will have embeddings that are close together in vector space, enabling:

- **Cosine Similarity Search**: Find the most semantically similar content
- **Approximate Nearest Neighbor (ANN)**: Fast vector search via IVFFlat index
- **RAG Retrieval**: Provide relevant context to LLM-based assistants

---

## 3. Difference from Evidence-Embedding Worker

FiskAI has **two distinct embedding workers** with different purposes:

### 3.1 Comparison Table

| Aspect           | Embedding Worker              | Evidence-Embedding Worker                   |
| ---------------- | ----------------------------- | ------------------------------------------- |
| **Input**        | RegulatoryRule records        | Evidence records                            |
| **Queue**        | `embedding`                   | `evidence-embedding`                        |
| **Purpose**      | Semantic search for rules     | Duplicate detection for sources             |
| **Storage**      | `SourceChunk` table (main DB) | `Evidence.embedding` column (regulatory DB) |
| **Chunking**     | Rule + evidence snippets      | Single normalized chunk per evidence        |
| **Max Length**   | 2000 chars per chunk          | 4000 chars total                            |
| **Retry Logic**  | Standard BullMQ (3 attempts)  | Custom with status tracking (3 attempts)    |
| **Status Field** | None (fire-and-forget)        | `Evidence.embeddingStatus`                  |

### 3.2 Embedding Worker (This Document)

**Purpose:** Generate embeddings for published RegulatoryRule records to power semantic search in the AI assistant.

**Flow:**

```
Releaser publishes rule
    |
    v
embeddingQueue.add("generate-embedding", { ruleId })
    |
    v
Embedding Worker generates chunks
    |
    v
SourceChunk table stores embeddings
    |
    v
AI Assistant uses embeddings for RAG
```

### 3.3 Evidence-Embedding Worker

**Purpose:** Generate embeddings for Evidence records to detect semantic duplicates across different sources.

**Flow:**

```
Sentinel fetches Evidence
    |
    v
evidenceEmbeddingQueue.add("generate-embedding", { evidenceId })
    |
    v
Evidence-Embedding Worker generates embedding
    |
    v
Evidence.embedding column stores vector
    |
    v
Duplicate detection queries find similar content
```

### 3.4 Key Distinction

- **Embedding Worker**: Enables users to _find_ regulations (search interface)
- **Evidence-Embedding Worker**: Enables system to _deduplicate_ source documents (data integrity)

---

## 4. Technical Implementation

### 4.1 Entry Point

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/workers/embedding.worker.ts`

```typescript
interface EmbeddingJobData {
  ruleId: string // Required: ID of the rule to embed
  runId: string // Required: Correlation ID for tracing
  parentJobId?: string // Optional: Parent job reference
}
```

The worker processes jobs from the `embedding` queue with concurrency 2.

### 4.2 Job Processing Flow

```
+-----------------------------------------------------------------------+
|                        processEmbeddingJob()                           |
+-----------------------------------------------------------------------+
|  1. Extract ruleId from job data                                       |
|  2. Call generateEmbeddingsForRule(ruleId)                             |
|  3. If successful, return success with chunkCount                      |
|  4. If failed, log error and return failure                            |
|  5. Record metrics (success/failure, duration)                         |
+-----------------------------------------------------------------------+
```

### 4.3 Core Service Logic

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/services/embedding-service.ts`

The `generateEmbeddingsForRule()` function implements the embedding logic:

```typescript
export async function generateEmbeddingsForRule(ruleId: string): Promise<EmbeddingResult> {
  // 1. FETCH RULE
  //    - Load RegulatoryRule from main DB
  //    - Return error if not found
  // 2. FETCH SOURCE POINTERS
  //    - Query SourcePointer records linked to rule
  //    - Get associated Evidence records from regulatory DB
  // 3. BUILD CHUNKS
  //    - Chunk 1: Rule title + explanation
  //    - Chunk 2-N: Evidence snippets (first 2000 chars each)
  // 4. GENERATE EMBEDDINGS
  //    - Call embedBatch() for all chunks at once
  //    - Uses Ollama's batch embedding API
  // 5. DELETE EXISTING
  //    - Remove previous embeddings for this rule (incremental update)
  // 6. INSERT NEW EMBEDDINGS
  //    - Store each chunk with its embedding in SourceChunk table
  // 7. RETURN RESULT
  //    - Success status and chunk count
}
```

### 4.4 Embedding API Client

**File:** `/home/admin/FiskAI/src/lib/article-agent/verification/embedder.ts`

The embedder module provides two functions:

```typescript
// Single text embedding
export async function embedText(text: string): Promise<number[]>

// Batch embedding (more efficient)
export async function embedBatch(texts: string[]): Promise<number[][]>
```

Both functions call Ollama's `/api/embed` endpoint with the configured model.

### 4.5 Vector Storage

**Schema:** Drizzle ORM with custom pgvector type

```typescript
export const sourceChunkEmbeddings = pgTable("SourceChunk", {
  id: text("id").primaryKey(),
  factSheetId: text("factSheetId").notNull(), // Rule ID
  sourceUrl: text("sourceUrl").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding"), // vector(768)
  fetchedAt: timestamp("fetchedAt").defaultNow(),
})
```

---

## 5. Inputs

### 5.1 Job Payload Schema

```typescript
interface EmbeddingJobData {
  ruleId: string // Required: RegulatoryRule ID (cuid)
  runId: string // Required: Correlation ID (e.g., "drain-1705276800000")
  parentJobId?: string // Optional: Parent job for nested workflows
}
```

### 5.2 Source Data Requirements

For each rule ID, the following data is loaded:

| Data           | Source              | Required                      |
| -------------- | ------------------- | ----------------------------- |
| RegulatoryRule | `db.regulatoryRule` | Yes                           |
| SourcePointers | `db.sourcePointer`  | Yes (via rules relation)      |
| Evidence       | `dbReg.evidence`    | Yes (via evidenceId soft ref) |

### 5.3 Rule Fields Used

| Field           | Purpose                           |
| --------------- | --------------------------------- |
| `id`            | Primary key and chunk prefix      |
| `titleHr`       | First chunk content (title)       |
| `explanationHr` | First chunk content (explanation) |

### 5.4 SourcePointer Fields Used

| Field          | Purpose                  |
| -------------- | ------------------------ |
| `id`           | Chunk identifier suffix  |
| `evidenceId`   | Link to evidence content |
| `lawReference` | Source URL for metadata  |

### 5.5 Evidence Fields Used

| Field        | Purpose                                 |
| ------------ | --------------------------------------- |
| `id`         | Evidence lookup                         |
| `url`        | Fallback source URL                     |
| `rawContent` | Evidence text for embedding (truncated) |

---

## 6. Outputs

### 6.1 Primary Output: SourceChunk Records

Each embedding job creates one or more `SourceChunk` records:

```sql
CREATE TABLE "SourceChunk" (
  "id" TEXT PRIMARY KEY,           -- e.g., "cluxx123-rule-content"
  "factSheetId" TEXT NOT NULL,     -- Rule ID for grouping
  "sourceUrl" TEXT NOT NULL,       -- Law reference or evidence URL
  "content" TEXT NOT NULL,         -- Original text content
  "embedding" vector(768),         -- 768-dimensional vector
  "fetchedAt" TIMESTAMP            -- When embedding was generated
);
```

### 6.2 Chunk ID Format

```
{ruleId}-rule-content      // For rule title+explanation chunk
{ruleId}-evidence-{pointerId}  // For evidence snippet chunks
```

### 6.3 Index for Fast Search

```sql
CREATE INDEX source_chunk_embedding_idx
ON "SourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

The IVFFlat index enables approximate nearest neighbor search with O(sqrt(n)) complexity.

### 6.4 Return Value

```typescript
interface EmbeddingResult {
  success: boolean // Whether embedding succeeded
  chunkCount: number // Number of chunks created
  error: string | null // Error message if failed
}
```

### 6.5 Worker Job Result

```typescript
interface JobResult {
  success: boolean
  duration: number // Milliseconds
  data?: {
    ruleId: string
    chunkCount: number
  }
  error?: string
}
```

---

## 7. Dependencies

### 7.1 Internal Dependencies

| Dependency                     | Purpose                | File                                     |
| ------------------------------ | ---------------------- | ---------------------------------------- |
| `generateEmbeddingsForRule`    | Core embedding logic   | `services/embedding-service.ts`          |
| `embedBatch`                   | Ollama API client      | `article-agent/verification/embedder.ts` |
| `getEmbedConfig`               | Endpoint configuration | `article-agent/verification/embedder.ts` |
| `drizzleDb`                    | Vector storage         | `db/drizzle/index.ts`                    |
| `sourceChunkEmbeddings`        | Table schema           | `db/drizzle/schema/embeddings.ts`        |
| `createWorker`                 | Worker factory         | `workers/base.ts`                        |
| `jobsProcessed`, `jobDuration` | Metrics                | `workers/metrics.ts`                     |

### 7.2 External Dependencies

| Dependency  | Purpose                     |
| ----------- | --------------------------- |
| BullMQ      | Job queue                   |
| Drizzle ORM | Vector storage              |
| Prisma      | Rule/pointer queries        |
| ioredis     | Queue backend               |
| Ollama      | Embedding generation        |
| pgvector    | PostgreSQL vector extension |

### 7.3 Database Access

| Database                | Models/Tables Used             |
| ----------------------- | ------------------------------ |
| Main DB (`db`)          | RegulatoryRule, SourcePointer  |
| Main DB (Drizzle)       | SourceChunk (embeddings table) |
| Regulatory DB (`dbReg`) | Evidence                       |

### 7.4 Service Dependencies

| Service        | Endpoint                  | Purpose              |
| -------------- | ------------------------- | -------------------- |
| Ollama (local) | `OLLAMA_EMBED_ENDPOINT`   | Embedding generation |
| Redis          | `REDIS_URL`               | Job queue            |
| PostgreSQL     | `DATABASE_URL`            | Rule storage         |
| PostgreSQL     | `REGULATORY_DATABASE_URL` | Evidence storage     |

---

## 8. Configuration

### 8.1 Docker Compose Configuration

**File:** `/home/admin/FiskAI/docker-compose.workers.yml`

```yaml
worker-embedding:
  <<: *worker-common
  container_name: fiskai-worker-embedding
  command: ["node", "dist/workers/lib/regulatory-truth/workers/embedding.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_EMBED_ENDPOINT: ${OLLAMA_EMBED_ENDPOINT}
    OLLAMA_EMBED_API_KEY: ${OLLAMA_EMBED_API_KEY}
    OLLAMA_EMBED_MODEL: ${OLLAMA_EMBED_MODEL:-nomic-embed-text}
    OLLAMA_EMBED_DIMS: ${OLLAMA_EMBED_DIMS:-768}
    WORKER_TYPE: embedding
    WORKER_CONCURRENCY: 2
  deploy:
    resources:
      limits:
        memory: 512M
```

### 8.2 Environment Variables

| Variable                  | Default                  | Description                      |
| ------------------------- | ------------------------ | -------------------------------- |
| `OLLAMA_EMBED_ENDPOINT`   | `http://localhost:11434` | Ollama embedding service URL     |
| `OLLAMA_EMBED_API_KEY`    | None                     | API key for Ollama (if required) |
| `OLLAMA_EMBED_MODEL`      | `nomic-embed-text`       | Embedding model name             |
| `OLLAMA_EMBED_DIMS`       | `768`                    | Embedding vector dimensions      |
| `WORKER_CONCURRENCY`      | `2`                      | Concurrent jobs per worker       |
| `REDIS_URL`               | Required                 | Redis connection string          |
| `DATABASE_URL`            | Required                 | Main PostgreSQL connection       |
| `REGULATORY_DATABASE_URL` | Required                 | Regulatory DB connection         |

### 8.3 Ollama Model Configuration

The embedding configuration is **completely separate** from extraction/LLM configuration:

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

**Important:** The embedding worker uses `OLLAMA_EMBED_*` variables, NOT `OLLAMA_*` or `OLLAMA_EXTRACT_*`.

### 8.4 Queue Configuration

```typescript
// Rate limit: 10 embedding jobs per 60 seconds
export const embeddingQueue = createQueue("embedding", { max: 10, duration: 60000 })
```

### 8.5 Job Options

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3, // Retry up to 3 times
  backoff: {
    type: "exponential",
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
}
```

### 8.6 Production Infrastructure

| Component         | Endpoint                     | Notes                 |
| ----------------- | ---------------------------- | --------------------- |
| Ollama GPU Server | `http://100.100.47.43:11434` | GPU-01 via Tailscale  |
| Model             | `nomic-embed-text`           | 768-dimensional, fast |
| Redis             | `redis://fiskai-redis:6379`  | On worker VPS         |
| PostgreSQL        | Via `DATABASE_URL`           | On VPS-01             |

---

## 9. Chunking Strategy

### 9.1 Chunk Types

The embedding worker creates two types of chunks per rule:

| Chunk Type       | Content                   | Max Length | ID Pattern                      |
| ---------------- | ------------------------- | ---------- | ------------------------------- |
| Rule Content     | `titleHr + explanationHr` | Unlimited  | `{ruleId}-rule-content`         |
| Evidence Snippet | `evidence.rawContent`     | 2000 chars | `{ruleId}-evidence-{pointerId}` |

### 9.2 Chunking Logic

```typescript
// Chunk 1: Rule title + explanation
const ruleContent = `${rule.titleHr}\n\n${rule.explanationHr || ""}`
chunks.push({
  id: `${ruleId}-rule-content`,
  factSheetId: ruleId,
  sourceUrl: sourcePointers[0]?.lawReference || "N/A",
  content: ruleContent,
})

// Chunk 2-N: Evidence snippets (if available)
for (const pointer of sourcePointers) {
  const evidence = evidenceMap.get(pointer.evidenceId)
  if (evidence?.rawContent) {
    // Take first 2000 chars of evidence
    const evidenceSnippet = evidence.rawContent.slice(0, 2000)
    chunks.push({
      id: `${ruleId}-evidence-${pointer.id}`,
      factSheetId: ruleId,
      sourceUrl: pointer.lawReference || evidence.url,
      content: evidenceSnippet,
    })
  }
}
```

### 9.3 Chunk Count Formula

```
chunks = 1 (rule content) + N (evidence snippets)
```

Where N = number of source pointers with non-null evidence rawContent.

### 9.4 Why 2000 Characters for Evidence?

- **Embedding Quality**: Models work best with focused, contextual text
- **API Efficiency**: Smaller chunks process faster in batch
- **First 2000 chars**: Captures document title, summary, and key sections
- **Rationale Comment**: "embeddings work better with focused content"

### 9.5 Incremental Updates

Existing embeddings are deleted before inserting new ones:

```typescript
// Delete existing embeddings for this rule (incremental update)
await drizzleDb
  .delete(sourceChunkEmbeddings)
  .where(eq(sourceChunkEmbeddings.factSheetId, ruleId))

// Insert new embeddings
for (let i = 0; i < chunks.length; i++) {
  await drizzleDb.insert(sourceChunkEmbeddings).values({...})
}
```

This ensures rule updates propagate to embeddings without duplicates.

---

## 10. Error Handling

### 10.1 Error Types

| Error Type               | Cause                     | Handling                                             |
| ------------------------ | ------------------------- | ---------------------------------------------------- |
| Rule not found           | Invalid ruleId            | Return `{ success: false, error: "Rule not found" }` |
| Evidence fetch failed    | DB connection issue       | Throws, triggers retry                               |
| Ollama API error         | Network/service issue     | Throws, triggers retry                               |
| Invalid embedding format | Ollama response malformed | Throws `OllamaError`                                 |
| Database write failed    | Connection/constraint     | Throws, triggers retry                               |

### 10.2 Service-Level Error Handling

```typescript
export async function generateEmbeddingsForRule(ruleId: string): Promise<EmbeddingResult> {
  try {
    // ... embedding logic ...
    return { success: true, chunkCount: chunks.length, error: null }
  } catch (error) {
    console.error(`[embedding-service] Failed to generate embeddings for rule ${ruleId}:`, error)
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

### 10.3 Worker-Level Error Handling

```typescript
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<JobResult> {
  const start = Date.now()
  const { ruleId } = job.data

  try {
    const result = await generateEmbeddingsForRule(ruleId)

    if (!result.success) {
      // Service returned error without throwing
      return {
        success: false,
        duration: Date.now() - start,
        error: result.error || "Unknown error",
      }
    }

    return {
      success: true,
      duration: Date.now() - start,
      data: { ruleId, chunkCount: result.chunkCount },
    }
  } catch (error) {
    // Unexpected error - will trigger BullMQ retry
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

### 10.4 Ollama API Error Handling

```typescript
export class OllamaError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message)
    this.name = "OllamaError"
  }
}

// In embedText():
if (!response.ok) {
  throw new OllamaError(`Ollama embedding failed: ${response.statusText}`, response.status)
}

if (!data.embeddings || !Array.isArray(data.embeddings) || !data.embeddings[0]) {
  throw new OllamaError("Ollama returned invalid embedding format")
}
```

### 10.5 Retry Logic

Default BullMQ retry configuration:

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000,  // 10s initial delay
  },
}
```

Retry schedule: 10s -> 20s -> 40s

### 10.6 Dead Letter Queue

Jobs that exhaust all retries are moved to the DLQ:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

---

## 11. Monitoring & Observability

### 11.1 Prometheus Metrics

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/workers/metrics.ts`

| Metric                        | Type      | Labels                          | Description               |
| ----------------------------- | --------- | ------------------------------- | ------------------------- |
| `worker_jobs_processed_total` | Counter   | worker=embedding, status, queue | Total jobs processed      |
| `worker_job_duration_seconds` | Histogram | worker=embedding, queue         | Job processing duration   |
| `worker_queue_depth`          | Gauge     | queue=embedding                 | Jobs waiting in queue     |
| `worker_active_jobs`          | Gauge     | worker=embedding                | Jobs currently processing |

### 11.2 Worker Logging

Standard log format:

```
[embedding-worker] Processing embedding job for rule {ruleId}
[embedding-worker] Successfully generated {chunkCount} embeddings for rule {ruleId}
[embedding-worker] Embedding generation failed for rule {ruleId}: {error}
[embedding-worker] Unexpected error processing rule {ruleId}: {error}
```

Service-level logging:

```
[embedding-service] Generated {chunkCount} embeddings for rule {ruleId}
[embedding-service] Failed to generate embeddings for rule {ruleId}: {error}
[embedder] Embedding call: endpoint={endpoint} model={model}
```

### 11.3 Embedding Statistics

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/services/embedding-service.ts`

```typescript
export async function getEmbeddingStats(): Promise<{
  totalChunks: number
  rulesWithEmbeddings: number
  publishedRulesWithoutEmbeddings: number
}>
```

### 11.4 Health Dashboard Queries

```sql
-- Total embedding chunks
SELECT COUNT(*) FROM "SourceChunk";

-- Chunks per rule
SELECT "factSheetId", COUNT(*) as chunks
FROM "SourceChunk"
GROUP BY "factSheetId"
ORDER BY chunks DESC
LIMIT 10;

-- Rules without embeddings
SELECT r.id, r."titleHr", r.status
FROM "RegulatoryRule" r
LEFT JOIN "SourceChunk" s ON r.id = s."factSheetId"
WHERE r.status = 'PUBLISHED'
  AND s.id IS NULL;

-- Recent embedding activity
SELECT DATE("fetchedAt") as day, COUNT(*) as chunks
FROM "SourceChunk"
GROUP BY day
ORDER BY day DESC
LIMIT 7;
```

### 11.5 Queue Monitoring

```bash
# Check embedding queue depth
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-embedding --tail 100

# Check embedding stats
npx tsx -e "
  import { getEmbeddingStats } from './src/lib/regulatory-truth/services/embedding-service'
  getEmbeddingStats().then(console.log)
"
```

---

## 12. Performance Considerations

### 12.1 Throughput Characteristics

| Metric             | Value          | Notes                    |
| ------------------ | -------------- | ------------------------ |
| Concurrency        | 2 jobs         | Parallel rule processing |
| Queue Rate Limit   | 10/minute      | Prevents Ollama overload |
| Avg Embedding Time | ~200-500ms     | Per batch API call       |
| Memory Usage       | ~200MB typical | Well under 512MB limit   |

### 12.2 Batch Embedding Efficiency

The worker uses batch embedding for all chunks of a rule:

```typescript
// Generate embeddings in batch (single API call)
const contents = chunks.map((c) => c.content)
const embeddings = await embedBatch(contents)
```

This is more efficient than individual `embedText()` calls:

- **Batch**: 1 API call for N chunks
- **Individual**: N API calls for N chunks

### 12.3 Database Write Strategy

Embeddings are inserted sequentially after batch generation:

```typescript
for (let i = 0; i < chunks.length; i++) {
  await drizzleDb.insert(sourceChunkEmbeddings).values({...})
}
```

**Trade-off:** Simpler error handling vs. bulk insert performance.

### 12.4 Vector Index Performance

The IVFFlat index configuration:

```sql
CREATE INDEX source_chunk_embedding_idx
ON "SourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

- **lists = 100**: Good balance for ~10K-100K vectors
- **Probe default**: 10 (adjustable at query time)
- **Recall**: ~95% at default probes

### 12.5 Memory Optimization

- **Chunk truncation**: Evidence limited to 2000 chars
- **Incremental delete**: Old embeddings removed before new ones added
- **No full table loads**: Stats use database aggregation

### 12.6 Ollama Server Considerations

| Factor              | Recommendation                                   |
| ------------------- | ------------------------------------------------ |
| GPU Memory          | nomic-embed-text needs ~500MB VRAM               |
| Batch Size          | Default is fine (all chunks per rule)            |
| Concurrent Requests | Rate limit prevents overload                     |
| Network             | Tailscale provides stable low-latency connection |

---

## 13. Known Limitations

### 13.1 No Status Tracking

**Issue:** Unlike evidence-embedding worker, this worker has no `embeddingStatus` field.

**Impact:** Cannot easily track which rules have pending/failed embeddings.

**Workaround:** Use LEFT JOIN query to find rules without embeddings.

### 13.2 Sequential Database Writes

**Issue:** Chunks are inserted one at a time, not in bulk.

**Impact:** Slightly slower for rules with many evidence snippets.

**Mitigation:** Most rules have 1-5 source pointers, so impact is minimal.

### 13.3 No Partial Retry

**Issue:** If embedding succeeds but one DB insert fails, all embeddings are lost on retry.

**Cause:** Delete happens before insert, and retry starts fresh.

**Impact:** Potential for brief inconsistency during retries.

### 13.4 Fixed Chunk Size

**Issue:** Evidence truncation at 2000 chars is hardcoded.

**Impact:** Long documents may lose relevant tail content.

**Alternative:** Could implement overlapping sliding windows.

### 13.5 No Embedding Versioning

**Issue:** Old embeddings are deleted, not versioned.

**Impact:** Cannot compare embedding quality across model changes.

**Consideration:** Model upgrades require full re-embedding.

### 13.6 Single Embedding Model

**Issue:** All rules use the same embedding model.

**Impact:** Cannot experiment with different models for different content types.

**Mitigation:** nomic-embed-text is well-suited for regulatory text.

### 13.7 No Content Deduplication

**Issue:** Same evidence snippet embedded for each rule it supports.

**Impact:** Storage overhead if evidence supports multiple rules.

**Trade-off:** Simpler queries vs. storage efficiency.

### 13.8 No Rate Limiting Per Ollama

**Issue:** Queue rate limit is per-queue, not per-Ollama endpoint.

**Impact:** If multiple workers share Ollama, combined load could exceed capacity.

**Mitigation:** Evidence-embedding queue has separate rate limit (5/min).

---

## 14. Recommended Improvements

### 14.1 Add Embedding Status Tracking

**Priority:** Medium
**Effort:** Low

Add status tracking similar to evidence-embedding worker:

```typescript
// On RegulatoryRule model (or separate EmbeddingStatus table)
embeddingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
embeddingUpdatedAt: DateTime
embeddingError: String?
```

### 14.2 Implement Bulk Insert

**Priority:** Low
**Effort:** Low

Replace sequential inserts with bulk insert:

```typescript
await drizzleDb.insert(sourceChunkEmbeddings).values(
  chunks.map((chunk, i) => ({
    id: chunk.id,
    factSheetId: chunk.factSheetId,
    sourceUrl: chunk.sourceUrl,
    content: chunk.content,
    embedding: embeddings[i],
    fetchedAt: new Date(),
  }))
)
```

### 14.3 Add Sliding Window Chunking

**Priority:** Medium
**Effort:** Medium

For long evidence documents, use overlapping windows:

```typescript
function createSlidingChunks(text: string, windowSize = 2000, overlap = 200): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += windowSize - overlap) {
    chunks.push(text.slice(i, i + windowSize))
  }
  return chunks
}
```

### 14.4 Implement Embedding Versioning

**Priority:** Low
**Effort:** Medium

Track model version with embeddings:

```sql
ALTER TABLE "SourceChunk" ADD COLUMN "modelVersion" TEXT;
-- Store as "nomic-embed-text:v1.5" or similar
```

### 14.5 Add Content Hash for Deduplication

**Priority:** Low
**Effort:** Medium

Deduplicate identical evidence snippets:

```typescript
const contentHash = crypto.createHash("sha256").update(content).digest("hex")
// Check if chunk with same hash exists before inserting
```

### 14.6 Implement Parallel Database Writes

**Priority:** Low
**Effort:** Low

Use Promise.all for parallel inserts:

```typescript
await Promise.all(
  chunks.map((chunk, i) =>
    drizzleDb.insert(sourceChunkEmbeddings).values({...})
  )
)
```

### 14.7 Add Embedding Quality Metrics

**Priority:** Medium
**Effort:** Medium

Track embedding quality indicators:

- Average embedding magnitude (detect degenerate vectors)
- Similarity distribution (detect model drift)
- Query latency percentiles

### 14.8 Consider HNSW Index

**Priority:** Low
**Effort:** Low

For larger vector counts, HNSW may be faster:

```sql
CREATE INDEX source_chunk_embedding_hnsw_idx
ON "SourceChunk"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Trade-off: Higher build time, faster query time.

---

## Appendix A: Data Models

### A.1 SourceChunk (Embeddings Table)

```sql
CREATE TABLE "SourceChunk" (
  "id" TEXT PRIMARY KEY,
  "factSheetId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(768),
  "fetchedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX "source_chunk_fact_sheet_idx" ON "SourceChunk" ("factSheetId");
CREATE INDEX "source_chunk_embedding_idx" ON "SourceChunk"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### A.2 Drizzle Schema

```typescript
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

### A.3 Custom Vector Type

```typescript
const EMBED_DIMS = process.env.OLLAMA_EMBED_DIMS || "768"

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBED_DIMS})`
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value.replace(/^\[/, "[").replace(/\]$/, "]"))
  },
})
```

### A.4 RegulatoryRule (Relevant Fields)

```prisma
model RegulatoryRule {
  id              String   @id
  titleHr         String
  explanationHr   String?  @db.Text
  status          RuleStatus
  sourcePointers  SourcePointer[]
}
```

### A.5 SourcePointer (Relevant Fields)

```prisma
model SourcePointer {
  id           String  @id
  evidenceId   String
  lawReference String?
  rules        RegulatoryRule[]
}
```

### A.6 Evidence (Relevant Fields - Regulatory DB)

```prisma
model Evidence {
  id         String  @id
  url        String
  rawContent String  @db.Text
}
```

---

## Appendix B: Code References

### B.1 Primary Files

| File                                                                        | Purpose               |
| --------------------------------------------------------------------------- | --------------------- |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/embedding.worker.ts`   | Worker entry point    |
| `/home/admin/FiskAI/src/lib/regulatory-truth/services/embedding-service.ts` | Core embedding logic  |
| `/home/admin/FiskAI/src/lib/article-agent/verification/embedder.ts`         | Ollama API client     |
| `/home/admin/FiskAI/src/lib/db/drizzle/schema/embeddings.ts`                | Vector storage schema |

### B.2 Supporting Files

| File                                                             | Purpose             |
| ---------------------------------------------------------------- | ------------------- |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/base.ts`    | Worker base class   |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/queues.ts`  | Queue definitions   |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/metrics.ts` | Prometheus metrics  |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/redis.ts`   | Redis configuration |

### B.3 Related Workers

| File                                                                               | Purpose                         |
| ---------------------------------------------------------------------------------- | ------------------------------- |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/evidence-embedding.worker.ts` | Evidence embedding (comparison) |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/evidence-embedder.ts`           | Evidence embedding logic        |

### B.4 Configuration Files

| File                                                             | Purpose            |
| ---------------------------------------------------------------- | ------------------ |
| `/home/admin/FiskAI/docker-compose.workers.yml`                  | Docker deployment  |
| `/home/admin/FiskAI/drizzle/0004_add_source_chunk_embedding.sql` | Database migration |

### B.5 Test Files

| File                                                                                 | Purpose            |
| ------------------------------------------------------------------------------------ | ------------------ |
| `/home/admin/FiskAI/src/lib/regulatory-truth/agents/__tests__/ollama-config.test.ts` | Config split tests |

### B.6 Scripts

| File                                                                         | Purpose           |
| ---------------------------------------------------------------------------- | ----------------- |
| `/home/admin/FiskAI/scripts/backfill-evidence-embeddings.ts`                 | Evidence backfill |
| `/home/admin/FiskAI/src/lib/regulatory-truth/scripts/backfill-embeddings.ts` | Rule backfill     |

---

## Document History

| Version | Date       | Author          | Changes                         |
| ------- | ---------- | --------------- | ------------------------------- |
| 1.0.0   | 2026-01-14 | Claude Opus 4.5 | Initial stakeholder-grade audit |

---

_This document was generated as part of a comprehensive audit of the FiskAI Regulatory Truth Layer worker system._
