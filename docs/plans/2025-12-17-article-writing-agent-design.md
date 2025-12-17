# Article Writing Agent v2.0 Design Document

**Date:** 2025-12-17
**Status:** Draft
**Author:** Claude + Human collaboration

## Overview

A fact-first article generation system with source synthesis, iterative verification, scope locking, and confidence scoring. Generates content for:

- News articles (`/vijesti`)
- Knowledge hub guides (`/vodici`, `/kako-da`, `/rjecnik`, `/usporedbe`)
- Future content types (extensible via `ArticleType` enum)

## Architecture

### Core Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARTICLE WRITING AGENT v2.0                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Source URLs                                                        │
│       │                                                              │
│       ▼                                                              │
│   ┌──────────────┐                                                   │
│   │ SYNTHESIZE   │  Fetch → Extract claims → Build Fact Sheet       │
│   └──────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌──────────────┐                                                   │
│   │    PLAN      │  Fact Sheet → Article outline                    │
│   └──────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌──────────────┐                                                   │
│   │    DRAFT     │  Outline → MDX paragraphs                        │
│   └──────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌──────────────┐     ┌─────────────────┐                          │
│   │   VERIFY     │────▶│ Confidence < 80% │──┐                      │
│   └──────┬───────┘     └─────────────────┘  │                       │
│          │                                   │                       │
│          │ All pass                          │ iteration++           │
│          ▼                                   │                       │
│   ┌──────────────┐                          │                       │
│   │   APPROVE    │◀── Lock verified ◀───────┘                       │
│   └──────┬───────┘    paragraphs                                    │
│          │                                                           │
│          ▼                                                           │
│   ┌──────────────┐                                                   │
│   │   PUBLISH    │  → MDX file / Database                           │
│   └──────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Iteration Logic

- **Max iterations:** 3 (configurable)
- **Exit conditions:**
  1. All paragraphs ≥ 80% confidence → auto-approve
  2. Max iterations reached with some < 80% → human review queue
  3. Any paragraph < 50% after iteration → flag as critical

### Scope Locking

Paragraphs that pass verification (≥ 80%) get "locked":

- Locked content preserved during rewrites
- Only unlocked (failing) paragraphs get rewritten
- Prevents verified facts from being corrupted

## Technology Stack

| Component            | Technology                                 |
| -------------------- | ------------------------------------------ |
| Embeddings           | Ollama `nomic-embed-text` (768 dims)       |
| LLM (writing)        | Ollama (swappable: Llama 3, Mistral, etc.) |
| LLM (classification) | Same Ollama model                          |
| Vector store         | PostgreSQL + pgvector extension            |
| Database             | Prisma (main) + Drizzle (pgvector queries) |
| Orchestration        | Prisma status field + while loop           |

### Why These Choices

- **Ollama over DeepSeek:** Better Croatian language support, self-hostable
- **pgvector over Pinecone:** Already using PostgreSQL, no additional service
- **No LangGraph:** Simple state machine sufficient, less complexity
- **RefChecker pattern:** Proven claim extraction + verification approach

## Database Schema

### New Models

```prisma
model ArticleJob {
  id              String          @id @default(cuid())
  type            ArticleType     // NEWS, GUIDE, HOWTO, GLOSSARY, COMPARISON
  status          ArticleStatus   @default(SYNTHESIZING)

  // Input
  sourceUrls      String[]
  topic           String?

  // Iteration tracking
  currentIteration Int            @default(0)
  maxIterations    Int            @default(3)

  // Output
  factSheetId     String?         @unique
  finalContentMdx String?
  finalSlug       String?

  // Audit
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  publishedAt     DateTime?

  factSheet       FactSheet?      @relation(fields: [factSheetId], references: [id])
  drafts          ArticleDraft[]

  @@index([status])
  @@index([type])
}

model FactSheet {
  id              String          @id @default(cuid())
  jobId           String          @unique

  topic           String
  keyEntities     Json            // { names, dates, amounts, regulations }

  createdAt       DateTime        @default(now())

  job             ArticleJob?
  claims          Claim[]
  sourceChunks    SourceChunk[]
}

model Claim {
  id              String          @id @default(cuid())
  factSheetId     String

  statement       String
  quote           String?
  sourceUrl       String
  sourceChunkId   String?

  confidence      Float
  category        String?         // deadline, amount, requirement, entity, general

  factSheet       FactSheet       @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  sourceChunk     SourceChunk?    @relation(fields: [sourceChunkId], references: [id])
  verifications   ClaimVerification[]

  @@index([factSheetId])
}

model SourceChunk {
  id              String          @id @default(cuid())
  factSheetId     String

  sourceUrl       String
  content         String
  embedding       Unsupported("vector(768)")?

  fetchedAt       DateTime        @default(now())

  factSheet       FactSheet       @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  claims          Claim[]

  @@index([factSheetId])
}

model ArticleDraft {
  id              String          @id @default(cuid())
  jobId           String
  iteration       Int

  contentMdx      String

  createdAt       DateTime        @default(now())

  job             ArticleJob      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  paragraphs      DraftParagraph[]

  @@unique([jobId, iteration])
}

model DraftParagraph {
  id              String          @id @default(cuid())
  draftId         String

  index           Int
  content         String
  isLocked        Boolean         @default(false)

  confidence      Float?
  supportingClaimIds String[]

  draft           ArticleDraft    @relation(fields: [draftId], references: [id], onDelete: Cascade)
  verifications   ClaimVerification[]

  @@unique([draftId, index])
}

model ClaimVerification {
  id              String          @id @default(cuid())
  paragraphId     String
  claimId         String

  similarityScore Float
  isSupporting    Boolean

  createdAt       DateTime        @default(now())

  paragraph       DraftParagraph  @relation(fields: [paragraphId], references: [id], onDelete: Cascade)
  claim           Claim           @relation(fields: [claimId], references: [id], onDelete: Cascade)

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

### pgvector Setup

```sql
-- Migration
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX source_chunk_embedding_idx
ON "SourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## File Structure

```
src/lib/article-agent/
├── index.ts                    # Public API exports
├── types.ts                    # Shared types & interfaces
│
├── orchestrator.ts             # State machine loop
│
├── steps/
│   ├── synthesize.ts           # Step 0: URLs → FactSheet
│   ├── plan.ts                 # Step 1: FactSheet → Outline
│   ├── draft.ts                # Step 2: Outline → MDX
│   ├── verify.ts               # Step 3: Paragraphs → Scores
│   └── rewrite.ts              # Step 4: Rewrite failing paragraphs
│
├── extraction/
│   ├── fetcher.ts              # URL → clean text
│   ├── chunker.ts              # Text → overlapping chunks
│   └── claim-extractor.ts      # RefChecker-style extraction
│
├── verification/
│   ├── embedder.ts             # Text → Ollama embedding
│   ├── similarity.ts           # pgvector queries
│   └── classifier.ts           # LLM support classification
│
├── llm/
│   └── ollama-client.ts        # Ollama API client
│
├── prompts/
│   ├── extraction.ts           # Claim extraction prompts
│   ├── planning.ts             # Outline prompts
│   ├── drafting.ts             # Writing prompts (per type)
│   ├── verification.ts         # Classification prompts
│   └── rewriting.ts            # Targeted rewrite prompts
│
└── utils/
    ├── confidence.ts           # Score aggregation
    ├── locking.ts              # Lock/unlock logic
    └── mdx.ts                  # MDX parsing/serialization
```

## API Surface

### Server Actions

```typescript
// src/app/actions/article-agent.ts

createArticleJob(input: CreateJobInput): Promise<ArticleJob>
getJobStatus(jobId: string): Promise<JobStatusResponse>
getJobWithVerification(jobId: string): Promise<JobWithVerificationResponse>
approveJob(jobId: string): Promise<void>
rejectJob(jobId: string, reason: string): Promise<void>
lockParagraph(jobId: string, paragraphIndex: number): Promise<void>
triggerRewrite(jobId: string): Promise<void>
triggerParagraphRewrite(jobId: string, index: number, guidance?: string): Promise<void>
```

### API Routes

```
POST   /api/article-agent/jobs              Create new job
GET    /api/article-agent/jobs              List all jobs
GET    /api/article-agent/jobs/[id]         Get job status
DELETE /api/article-agent/jobs/[id]         Cancel job
POST   /api/article-agent/jobs/[id]/run     Trigger orchestrator
POST   /api/article-agent/jobs/[id]/approve Manual approve
GET    /api/article-agent/factsheets/[id]   View extracted claims
GET    /api/article-agent/drafts/[id]       View draft with verification
```

## Verification Flow

### 4-Stage Pipeline

1. **Embed** - Convert paragraph to vector using Ollama
2. **Search** - Query pgvector for top-5 similar source chunks
3. **Classify** - LLM determines support level for each chunk
4. **Aggregate** - Calculate weighted confidence score

### Support Levels

| Level               | Meaning                        | Weight |
| ------------------- | ------------------------------ | ------ |
| SUPPORTED           | Claim directly backs paragraph | 1.0    |
| PARTIALLY_SUPPORTED | Partial backing                | 0.6    |
| NOT_SUPPORTED       | No relevant evidence           | 0.0    |
| CONTRADICTED        | Evidence contradicts           | -0.5   |

### Confidence Calculation

```
confidence = weighted_avg(similarity * support_weight * llm_confidence)
normalized to 0.0 - 1.0 range
```

### Thresholds

| Threshold        | Value | Action                    |
| ---------------- | ----- | ------------------------- |
| PARAGRAPH_PASS   | 0.80  | Lock paragraph            |
| PARAGRAPH_FAIL   | 0.50  | Flag for human review     |
| JOB_AUTO_APPROVE | 0.85  | Auto-publish              |
| MAX_ITERATIONS   | 3     | Stop and queue for review |

## Dashboard UI

### Pages

```
/article-agent                  Job list overview
/article-agent/new              Create job wizard
/article-agent/[id]             Job overview + timeline
/article-agent/[id]/factsheet   View extracted claims
/article-agent/[id]/review      Main review interface
/article-agent/[id]/history     Iteration diffs
```

### Review Interface Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Job title, iteration count, confidence meter            │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                    │
│  Paragraph Cards           │  Evidence Panel                    │
│  (color-coded by           │  - Selected paragraph content      │
│   confidence)              │  - Lock/Rewrite actions            │
│                            │  - Supporting claims list          │
│  [Green] Passed            │  - Source quotes with links        │
│  [Yellow] Needs work       │                                    │
│  [Red] Critical            │                                    │
│  [Blue] Locked             │                                    │
│                            │                                    │
├────────────────────────────┴────────────────────────────────────┤
│ Action Bar: [Reject] [Run Another Iteration] [Approve & Publish]│
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

```bash
# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1                    # Writing/classification
OLLAMA_EMBED_MODEL=nomic-embed-text      # Embeddings
OLLAMA_EMBED_DIMS=768                    # Vector dimensions

# Thresholds (optional overrides)
ARTICLE_AGENT_PASS_THRESHOLD=0.8
ARTICLE_AGENT_FAIL_THRESHOLD=0.5
ARTICLE_AGENT_MAX_ITERATIONS=3
```

## Integration with Existing Systems

### Reuse from News Pipeline

- `src/lib/news/fetcher.ts` - URL fetching logic
- `src/lib/news/pipeline/deepseek-client.ts` - Pattern for LLM client (adapt for Ollama)

### Output Formats

Generated articles follow existing MDX conventions:

```mdx
---
title: Article Title
description: Short description
lastUpdated: 2025-12-17
lastReviewed: 2025-12-17
reviewer: Article Agent v2.0
sources:
  - name: Source Name
    url: https://example.com
faq:
  - q: Question?
    a: Answer.
---

<QuickStatsBar ... />

## Section 1

Content...
```

## Open Source References

| Library    | Use Case                            | URL                                  |
| ---------- | ----------------------------------- | ------------------------------------ |
| RefChecker | Claim extraction pattern            | github.com/amazon-science/RefChecker |
| Graphiti   | Future: Cross-article entity memory | github.com/getzep/graphiti           |
| pgvector   | Vector similarity search            | github.com/pgvector/pgvector         |

## Implementation Phases

### Phase 1: Foundation

- [ ] Add pgvector extension to PostgreSQL
- [ ] Create Prisma schema migrations
- [ ] Set up Drizzle for vector queries
- [ ] Implement Ollama client (embeddings + chat)

### Phase 2: Core Pipeline

- [ ] Implement synthesize step (fetch, chunk, extract claims)
- [ ] Implement plan step (outline generation)
- [ ] Implement draft step (article writing)
- [ ] Implement verify step (embedding + similarity + classification)
- [ ] Implement rewrite step (targeted paragraph rewriting)

### Phase 3: Orchestration

- [ ] Build state machine orchestrator
- [ ] Add locking logic
- [ ] Implement iteration loop with exit conditions
- [ ] Create server actions

### Phase 4: Dashboard

- [ ] Job list page
- [ ] Create job wizard
- [ ] Review interface with evidence panel
- [ ] History/diff view

### Phase 5: Polish

- [ ] Prompt tuning for Croatian language
- [ ] Performance optimization (batch embeddings)
- [ ] Monitoring and logging
- [ ] Error recovery and retry logic

## Success Metrics

- **Accuracy:** >90% of published articles have no factual errors
- **Efficiency:** <3 iterations average to reach approval
- **Human time:** <5 minutes average review time per article
- **Throughput:** Process 10+ articles/day with single reviewer

## Risks and Mitigations

| Risk                          | Mitigation                                          |
| ----------------------------- | --------------------------------------------------- |
| Ollama model poor at Croatian | Test multiple models, fall back to cloud API        |
| pgvector performance at scale | Monitor query times, tune index parameters          |
| Infinite rewrite loops        | Hard cap at 3 iterations, human escalation          |
| Source fetch failures         | Retry logic, graceful degradation, manual URL input |

---

**Next Steps:**

1. Review and approve this design
2. Create implementation plan with detailed tasks
3. Set up git worktree for development
4. Begin Phase 1 implementation
