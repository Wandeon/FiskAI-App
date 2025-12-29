# RTL Semantic Search Implementation

> **Status:** Implemented (2025-12-29)
> **Issue:** [#169](https://github.com/Wandeon/FiskAI/issues/169)

## Overview

This document describes the vector embedding and semantic search implementation for the Regulatory Truth Layer (RTL). The implementation enables the AI assistant to find relevant regulatory content based on semantic meaning, not just keyword matching.

## Problem Statement

The original AI assistant used token-based exact matching via `concept-matcher.ts`:

```typescript
// HARD GATE: Only include matches above threshold
if (score >= MINIMUM_SCORE_THRESHOLD && matchedTokens.length > 0) {
  matches.push({ ... })
}
```

### Limitations

1. **No semantic understanding** - Query "Do I need to register for VAT?" may not match "pdv-prag" concept
2. **No synonym handling** - "fiskalna kasa" vs "naplatni uredaj" treated as different
3. **Croatian language variations** - Diacritics, case, and word forms not handled semantically
4. **Limited coverage** - Only 12 published rules available, strict matching misses relevant content

## Solution Architecture

### Three-Component System

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VECTOR EMBEDDING PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. EMBEDDING GENERATION                                           │
│     • Extractor agent generates embeddings on creation             │
│     • Backfill script for existing SourcePointers                  │
│     • Uses Ollama nomic-embed-text (768 dimensions)                │
│                                                                     │
│  2. VECTOR STORAGE                                                 │
│     • PostgreSQL + pgvector extension                              │
│     • SourcePointer.embedding column (vector(768))                 │
│     • IVFFlat index for fast similarity search                     │
│                                                                     │
│  3. SEMANTIC SEARCH                                                │
│     • Cosine similarity ranking                                    │
│     • Hybrid search (keyword + semantic)                           │
│     • Integrated into AI assistant query engine                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### Migration: `20251229000000_add_source_pointer_embedding`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE "SourcePointer" ADD COLUMN "embedding" vector(768);

-- Add similarity search index
CREATE INDEX "source_pointer_embedding_idx" ON "SourcePointer"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
```

### Prisma Schema Update

```prisma
model SourcePointer {
  // ... existing fields ...

  // Vector embedding for semantic search (nomic-embed-text, 768 dims)
  // Generated from exactQuote + contextBefore + contextAfter
  // Enables semantic similarity search beyond keyword matching
  embedding Unsupported("vector(768)")?

  // ... rest of model ...
}
```

## Implementation Components

### 1. Embedding Generation (`rtl-embedder.ts`)

**Location:** `src/lib/regulatory-truth/utils/rtl-embedder.ts`

**Key Functions:**

```typescript
// Build embedding text from SourcePointer
buildEmbeddingText(pointer: {
  exactQuote: string
  contextBefore?: string | null
  contextAfter?: string | null
}): string

// Generate embedding for single pointer
generatePointerEmbedding(pointerId: string): Promise<number[]>

// Batch generation (more efficient)
generatePointerEmbeddingsBatch(pointerIds: string[]): Promise<Map<string, number[]>>

// Stats and backfill helpers
getEmbeddingStats(): Promise<{ total, withEmbedding, withoutEmbedding, percentage }>
findPointersWithoutEmbeddings(limit: number): Promise<Array<{ id, exactQuote }>>
```

**Design Decisions:**

- **Context inclusion:** Embeddings generated from `exactQuote + contextBefore + contextAfter` for richer semantic understanding
- **Batch processing:** Supports batch API calls to reduce latency and API costs
- **Non-blocking updates:** Uses raw SQL (`$executeRaw`) since Prisma doesn't support vector type directly
- **Fail-soft:** Missing embeddings don't block pointer creation (can backfill later)

### 2. Extractor Agent Integration

**Location:** `src/lib/regulatory-truth/agents/extractor.ts`

**Changes:**

```typescript
// After creating SourcePointers
if (sourcePointerIds.length > 0) {
  console.log(`[extractor] Generating embeddings for ${sourcePointerIds.length} pointers...`)
  try {
    const embeddings = await generatePointerEmbeddingsBatch(sourcePointerIds)
    console.log(`[extractor] ✓ Generated ${embeddings.size} embeddings`)
  } catch (embeddingError) {
    // Log but don't fail - embeddings can be backfilled later
    console.warn(`[extractor] Failed to generate embeddings: ${embeddingError}`)
  }
}
```

**Behavior:**

- Embeddings generated automatically for new SourcePointers
- Non-blocking: extraction succeeds even if embedding generation fails
- Logged for monitoring and debugging

### 3. Backfill Script

**Location:** `src/lib/regulatory-truth/scripts/backfill-embeddings.ts`

**Usage:**

```bash
# Dry run (see what would be done)
npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts --dry-run

# Backfill with default batch size (50)
npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts

# Custom batch size
npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts --batch-size 100
```

**Features:**

- Processes pointers in batches to avoid API rate limits
- Progress reporting and statistics
- Rate limiting between batches (2 seconds)
- Error handling with continuation on failure
- Dry-run mode for preview

**Output Example:**

```
🚀 RTL Embedding Backfill
============================================================

📊 Initial Statistics:
   Total SourcePointers: 342
   With Embeddings: 0
   Without Embeddings: 342
   Coverage: 0.00%

🔄 Starting backfill (batch size: 50)...

📦 Batch 1: Processing 50 pointers...
   ✓ Generated 50 embeddings
   ⏸ Waiting 2 seconds before next batch...

📊 Final Statistics:
   Total SourcePointers: 342
   With Embeddings: 342
   Without Embeddings: 0
   Coverage: 100.00%

🎉 All SourcePointers now have embeddings!
```

### 4. Semantic Search API

**Location:** `src/lib/regulatory-truth/retrieval/semantic-search.ts`

**Key Functions:**

```typescript
// Primary semantic search
semanticSearch(
  query: string,
  options?: {
    limit?: number
    minSimilarity?: number
    domain?: string
    minConfidence?: number
    publishedRulesOnly?: boolean
    asOfDate?: Date
  }
): Promise<SemanticSearchResult[]>

// Hybrid search (semantic + concept extraction)
hybridSearch(
  query: string,
  options?: SemanticSearchOptions
): Promise<{
  semanticResults: SemanticSearchResult[]
  suggestedConcepts: string[]
}>

// Find similar content
findSimilarPointers(
  pointerId: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResult[]>
```

**Search Strategy:**

1. Embed user query using Ollama nomic-embed-text
2. Find similar SourcePointers using cosine similarity
3. Filter by similarity threshold (default: 0.7)
4. Fetch associated RegulatoryRules
5. Filter by rule status, effective dates, confidence
6. Return ranked results with citation data

**SQL Query (Simplified):**

```sql
SELECT
  sp.id,
  1 - (sp.embedding <=> $queryEmbedding::vector) as similarity,
  sp."exactQuote",
  -- ... other fields ...
FROM "SourcePointer" sp
INNER JOIN "Evidence" e ON e.id = sp."evidenceId"
WHERE sp.embedding IS NOT NULL
  AND sp.confidence >= $minConfidence
  AND sp."deletedAt" IS NULL
ORDER BY sp.embedding <=> $queryEmbedding::vector ASC
LIMIT $limit
```

### 5. AI Assistant Integration

**Location:** `src/lib/assistant/query-engine/semantic-concept-matcher.ts`

**Enhanced Concept Matching:**

```typescript
matchConceptsWithSemantics(
  keywords: string[],
  query: string,
  options?: {
    enableSemanticFallback?: boolean
    keywordScoreThreshold?: number
    semanticSimilarityThreshold?: number
    maxResults?: number
  }
): Promise<EnhancedConceptMatch[]>
```

**Strategy:**

1. **First:** Try keyword-based concept matching (fast, precise)
2. **Check:** If best keyword match score < threshold (default: 0.4)
3. **Fallback:** Use semantic search to find relevant concepts
4. **Combine:** Merge keyword and semantic matches
5. **Rank:** Sort by score/similarity descending

**Example Flow:**

```
User Query: "Trebam li registrirati fiskalnu blagajnu?"
           ("Do I need to register a fiscal cash register?")

1. Keyword Matching:
   - Extracts: ["registrirati", "fiskalnu", "blagajnu"]
   - Matches: None (concept uses "naplatni uredaj")
   - Best score: 0.0 (below threshold)

2. Semantic Fallback:
   - Embeds full query
   - Finds similar pointers about fiskalizacija
   - Extracts concept: "fiskalizacija-naplatni-uredaji"
   - Similarity: 0.82

3. Result:
   - Returns semantic match with high confidence
   - AI assistant proceeds with rule selection
```

## Environment Configuration

### Required Variables

```bash
# Ollama Configuration (already in .env.example)
OLLAMA_ENDPOINT=https://your-ollama-cloud.example.com
OLLAMA_API_KEY=your_api_key_here
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMS=768
```

### Feature Flags

```typescript
// Check if semantic search is available
import { isSemanticSearchAvailable } from "@/lib/assistant/query-engine"

if (isSemanticSearchAvailable()) {
  // Use semantic search
} else {
  // Fall back to keyword only
}
```

## Performance Characteristics

### Index Performance

| Operation               | Performance | Notes                            |
| ----------------------- | ----------- | -------------------------------- |
| Exact match             | < 1ms       | Direct B-tree lookup             |
| Semantic search (small) | 10-50ms     | IVFFlat index, < 1000 vectors    |
| Semantic search (large) | 50-200ms    | IVFFlat index, > 10000 vectors   |
| Embedding generation    | 100-300ms   | Ollama API call (single)         |
| Batch embedding (50)    | 500-1000ms  | Ollama API call (batch)          |

### Optimization Strategies

1. **IVFFlat Index:** Configured with `lists = 100` for balance between speed and accuracy
2. **Batch Processing:** Generate embeddings in batches of 50-100
3. **Lazy Loading:** Embeddings generated asynchronously, don't block extraction
4. **Caching:** Consider adding embedding cache for common queries (future)
5. **Hybrid Search:** Use keyword matching first, semantic only as fallback

## Testing Strategy

### Unit Tests

```bash
# Test embedding generation
npx tsx -e "
import { buildEmbeddingText } from './src/lib/regulatory-truth/utils/rtl-embedder'
console.log(buildEmbeddingText({
  exactQuote: 'PDV stopa je 25%',
  contextBefore: 'Prema Zakonu o PDV-u',
  contextAfter: 'za sve usluge.'
}))
"

# Test semantic search
npx tsx -e "
import { semanticSearch } from './src/lib/regulatory-truth/retrieval/semantic-search'
semanticSearch('Kolika je PDV stopa?', { limit: 3 }).then(console.log)
"
```

### Integration Tests

1. **Backfill Test:** Run backfill on staging with small dataset
2. **Search Quality:** Compare semantic vs keyword results for known queries
3. **Performance Test:** Measure search latency under load
4. **Failure Modes:** Test behavior when Ollama API is unavailable

### Quality Metrics

| Metric                  | Target | Measurement                             |
| ----------------------- | ------ | --------------------------------------- |
| Embedding Coverage      | > 95%  | Percentage of SourcePointers with vector |
| Semantic Precision      | > 80%  | Relevant results in top 5               |
| Semantic Recall         | > 70%  | Known matches found in top 10           |
| Query Latency (p95)     | < 500ms| Including embedding + search             |
| Fallback Success Rate   | > 90%  | Keyword fallback when semantic fails    |

## Deployment Checklist

- [x] Prisma schema updated
- [x] Database migration created
- [x] Embedding utility implemented
- [x] Extractor agent integrated
- [x] Backfill script created
- [x] Semantic search API implemented
- [x] AI assistant integration
- [x] Documentation completed
- [ ] Run migration on staging
- [ ] Backfill staging embeddings
- [ ] Test semantic search on staging
- [ ] Run migration on production
- [ ] Backfill production embeddings (gradual)
- [ ] Monitor performance and accuracy
- [ ] Enable semantic search in production

## Migration Steps

### Staging

```bash
# 1. Deploy code with migration
git push origin fix/issue-169

# 2. Run migration
npx prisma migrate deploy

# 3. Backfill embeddings
npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts --batch-size 50

# 4. Verify
npx tsx -e "
import { getEmbeddingStats } from './src/lib/regulatory-truth/utils/rtl-embedder'
getEmbeddingStats().then(console.log)
"
```

### Production

```bash
# 1. Deploy code (migration included)
# (via Coolify deployment)

# 2. Run migration
docker exec fiskai-app npx prisma migrate deploy

# 3. Backfill embeddings (gradual, monitor load)
docker exec fiskai-app npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts --batch-size 25

# 4. Monitor
# - Check Ollama API rate limits
# - Monitor database CPU/memory
# - Check search latency
```

## Monitoring

### Key Metrics

```sql
-- Embedding coverage
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embedding,
  COUNT(*) - COUNT(embedding) as without_embedding,
  (COUNT(embedding)::float / COUNT(*)) * 100 as coverage_pct
FROM "SourcePointer"
WHERE "deletedAt" IS NULL;

-- Search performance (add to application logs)
-- Log: semantic_search_duration_ms, results_count, min_similarity
```

### Alerts

- **Low coverage:** < 90% of SourcePointers have embeddings
- **High latency:** p95 search latency > 1000ms
- **High error rate:** > 5% of semantic searches fail
- **API errors:** Ollama API returning 429 or 500 errors

## Future Enhancements

1. **Query Caching:** Cache embeddings for common queries
2. **HNSW Index:** Upgrade from IVFFlat to HNSW for better performance
3. **Multi-language:** Support English queries with translation
4. **Feedback Loop:** Track which results users find helpful
5. **Adaptive Thresholds:** Tune similarity thresholds based on query type
6. **Semantic Reranking:** Use LLM to rerank semantic results for relevance

## References

- **Issue:** [#169 - RTL: No Vector Embeddings for Semantic Search](https://github.com/Wandeon/FiskAI/issues/169)
- **pgvector docs:** https://github.com/pgvector/pgvector
- **Ollama embed API:** https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
- **nomic-embed-text:** https://huggingface.co/nomic-ai/nomic-embed-text-v1

## Authors

- Claude Opus 4.5 (Implementation)
- Wandeon (Issue audit and requirements)

---

**Last Updated:** 2025-12-29
