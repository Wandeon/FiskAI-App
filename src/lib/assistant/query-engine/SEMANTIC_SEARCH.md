# Semantic Search for AI Assistant

## Overview

This document describes the semantic search integration for the FiskAI AI Assistant, which enhances concept matching beyond keyword-only approaches.

## Problem Statement

Previously, the AI Assistant relied exclusively on **keyword/token matching** to find regulatory concepts:

- **Exact token matches only** - No fuzzy matching, no embeddings
- **Limited recall** - Questions using synonyms may fail (e.g., "turnover" vs "promet")
- **Poor natural language understanding** - Cannot understand context or intent beyond pattern matching

## Solution: Hybrid Search (Keyword + Semantic)

We now support three matching modes:

### 1. Keyword Mode (Legacy)

- Strict token-level matching
- Exact matches only
- Fast but limited recall

### 2. Semantic Mode (New)

- Vector similarity search using pgvector
- Understands synonyms and context
- Better recall, may have lower precision

### 3. Hybrid Mode (Recommended)

- Combines keyword + semantic approaches
- Configurable weights (default: 70% semantic, 30% keyword)
- Best of both worlds

## Architecture

```
User Query: "Koji je prag za PDV?"
     │
     ├─────────────────────────────────────────────────────┐
     │                                                       │
     ▼                                                       ▼
┌──────────────────┐                              ┌──────────────────┐
│ KEYWORD MATCHING │                              │ SEMANTIC SEARCH  │
├──────────────────┤                              ├──────────────────┤
│ 1. Tokenize      │                              │ 1. Embed query   │
│ 2. Filter stops  │                              │    (Ollama API)  │
│ 3. Exact match   │                              │ 2. Vector search │
│ 4. Score         │                              │    (pgvector)    │
└────────┬─────────┘                              └────────┬─────────┘
         │                                                 │
         │                                                 │
         └─────────────┬───────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ HYBRID SCORING  │
              ├─────────────────┤
              │ score = 0.3·K   │
              │       + 0.7·S   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ TOP-K RESULTS   │
              └─────────────────┘
```

## Components

### 1. `semantic-search.ts`

Core semantic search module with three main functions:

- **`semanticSearch(query, options)`** - Pure vector similarity search
- **`hybridSearch(query, keywordMatches, options)`** - Combines keyword + semantic
- **`rerank(matches, context)`** - Re-rank by additional context (future)

### 2. `concept-matcher.ts` (Enhanced)

Updated to support three modes:

```typescript
// Keyword only (legacy)
const matches = await matchConcepts(keywords, { mode: "keyword" })

// Semantic only
const matches = await matchConcepts(keywords, { mode: "semantic" })

// Hybrid (recommended)
const matches = await matchConcepts(keywords, {
  mode: "hybrid",
  weights: { keyword: 0.3, semantic: 0.7 },
})
```

### 3. `ConceptEmbedding` Table

New Prisma model for storing concept embeddings:

```prisma
model ConceptEmbedding {
  id            String   @id @default(cuid())
  conceptId     String   @unique
  embedding     Unsupported("vector(768)")? // pgvector
  embeddingText String   @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  concept       Concept  @relation(...)
}
```

### 4. `generate-concept-embeddings.ts`

Script to populate embeddings:

```bash
npx tsx src/lib/assistant/scripts/generate-concept-embeddings.ts
```

## Database Schema

### Migration: `0014_add_concept_embedding.sql`

Creates:

- `ConceptEmbedding` table with pgvector support
- `ivfflat` index for fast similarity search
- Foreign key constraint to `Concept` table

## Usage

### Default (Hybrid Mode)

```typescript
import { matchConcepts } from "@/lib/assistant/query-engine/concept-matcher"

const keywords = ["prag", "pdv"]
const matches = await matchConcepts(keywords)
// Returns hybrid matches (70% semantic, 30% keyword)
```

### Custom Configuration

```typescript
const matches = await matchConcepts(keywords, {
  mode: "hybrid",
  minScore: 0.4,
  weights: {
    keyword: 0.5,
    semantic: 0.5,
  },
})
```

### Fallback Behavior

If semantic search fails (e.g., embeddings not populated, API error):

- Automatically falls back to keyword-only matching
- Logs warning to console
- Ensures zero downtime

## Deployment Checklist

1. ✅ Run database migration:

   ```bash
   npx prisma migrate deploy
   ```

2. ✅ Generate Prisma client:

   ```bash
   npx prisma generate
   ```

3. ✅ Populate concept embeddings:

   ```bash
   npx tsx src/lib/assistant/scripts/generate-concept-embeddings.ts
   ```

4. ✅ Verify embeddings created:

   ```sql
   SELECT COUNT(*) FROM "ConceptEmbedding";
   ```

5. ✅ Test semantic search:
   ```typescript
   // Should return matches even with synonyms
   const matches = await matchConcepts(["promet"])
   ```

## Performance Considerations

### Vector Index

- Uses `ivfflat` index for approximate nearest neighbor search
- Default: 10 lists (suitable for small-medium datasets)
- Adjust based on concept count:
  - < 1000 concepts: 10 lists
  - 1000-10000: sqrt(rows)
  - > 10000: rows/1000

### Embedding Generation

- Batch processing (50 concepts at a time)
- Uses Ollama Cloud API (nomic-embed-text, 768 dims)
- Approximately 1 second per batch

### Query Performance

- Semantic search: ~10-50ms (with ivfflat index)
- Keyword matching: ~5-20ms (in-memory)
- Hybrid: ~20-70ms (runs both, merges results)

## Future Enhancements

1. **Contextual Re-ranking**
   - Use company context (entity type, VAT status, etc.)
   - Temporal relevance (favor recent regulations)
   - Risk tier weighting

2. **Query Expansion**
   - Automatic synonym expansion
   - Entity linking
   - Multi-hop reasoning

3. **Feedback Loop**
   - Track which matches lead to successful answers
   - Adjust weights based on performance
   - A/B testing framework

4. **Cross-lingual Search**
   - Support English queries
   - Multilingual embeddings

## References

- [GitHub Issue #148](https://github.com/wandeon/fiskai/issues/148)
- [Audit Report: AI Assistant](../../docs/07_AUDITS/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Ollama Embeddings API](https://ollama.com/docs/api#embed)
