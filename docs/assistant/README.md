# FiskAI Assistant - Technical Documentation

> **Canonical source** - Updated 2024-12-24
>
> This document is the single source of truth for the FiskAI Assistant implementation.

## Overview

The FiskAI Assistant provides evidence-backed answers to Croatian regulatory questions. It follows a **fail-closed** design: if an answer cannot be properly cited, the system returns a REFUSAL rather than an uncitable answer.

## Core Principle: Fail-Closed

The assistant's core promise is **evidence-backed answers**. This is enforced at multiple levels:

1. **Type Level**: `PrimarySourceCard` requires `quote`, `url`, `evidenceId`, `fetchedAt`
2. **Validation Level**: `validateResponse()` returns errors (not warnings) for missing fields
3. **Runtime Level**: `buildAnswer()` returns `REFUSAL` if citations cannot be built

```typescript
// This invariant is enforced at validation time:
// If topic=REGULATORY and kind=ANSWER, then:
//   - citations.primary MUST exist
//   - citations.primary.url MUST be non-empty
//   - citations.primary.quote MUST be non-empty
//   - citations.primary.evidenceId MUST be non-empty
//   - citations.primary.fetchedAt MUST be non-empty
// Violation → validation.valid = false → API returns REFUSAL
```

## Architecture

```
┌─────────────────┐     ┌────────────────────┐
│  Marketing Page │────▶│ /api/assistant/chat│
│  (/assistant)   │     │    POST handler    │
└─────────────────┘     └────────┬───────────┘
                                 │
┌─────────────────┐              ▼
│    App Page     │     ┌────────────────────┐
│ (/app/assistant)│────▶│   buildAnswer()    │
└─────────────────┘     │  Query Engine Core │
                        └────────┬───────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐     ┌───────────────────┐     ┌───────────────┐
│ extractKeywords│    │  matchConcepts()   │    │ selectRules() │
│ text-utils.ts │     │concept-matcher.ts  │    │rule-selector.ts│
└───────────────┘     └───────────────────┘     └───────────────┘
                                                       │
                                 ┌─────────────────────┤
                                 ▼                     ▼
                        ┌───────────────────┐ ┌───────────────┐
                        │detectConflicts()  │ │buildCitations()│
                        │conflict-detector.ts│ │citation-builder│
                        └───────────────────┘ └───────────────┘
```

## Surfaces

| Surface     | URL              | Features                      |
| ----------- | ---------------- | ----------------------------- |
| `MARKETING` | `/assistant`     | Public, no client data        |
| `APP`       | `/app/assistant` | Authenticated, client context |

## Response Types

### ANSWER (kind="ANSWER")

Returned when:

- Query matches regulatory concepts
- Published rules found
- No unresolved conflicts
- Citations can be built with required fields

### REFUSAL (kind="REFUSAL")

Returned when ANY of these fail:

- `NO_CITABLE_RULES` - No rules found or citations incomplete
- `OUT_OF_SCOPE` - Non-regulatory query (product, support, etc.)
- `UNRESOLVED_CONFLICT` - Conflicting rules that cannot be resolved
- `MISSING_CLIENT_DATA` - APP surface needs data user hasn't connected

## Query Engine Pipeline

1. **extractKeywords(query)** - Croatian-aware tokenization, diacritics normalization
2. **classifyTopic(keywords)** - Returns REGULATORY, PRODUCT, SUPPORT, or OFFTOPIC
3. **matchConcepts(keywords)** - Matches against Concept slugs and aliases
4. **selectRules(conceptSlugs)** - Finds PUBLISHED rules, filters by date
5. **detectConflicts(rules)** - Checks for overlapping rules with different values
6. **buildCitations(rules)** - Creates CitationBlock with evidence provenance

## Streaming

NDJSON streaming available at `/api/assistant/chat/stream`:

```javascript
// Client usage:
import { fetchAssistantStream, createStreamParser } from "@/lib/assistant"

await fetchAssistantStream(query, "MARKETING", {
  onChunk: (state) => updateUI(state.response),
  onComplete: (response) => finalizeUI(response),
  onError: (error) => showError(error),
})
```

Chunk order:

1. Metadata (schemaVersion, requestId, kind, topic, surface)
2. Content (headline, directAnswer, confidence)
3. Citations (if present)
4. Refusal details (if present)
5. Related questions
6. Done signal (`{_done: true}`)

## Types

### SourceCard

```typescript
interface SourceCard {
  id: string
  title: string
  authority: AuthorityLevel // LAW > REGULATION > GUIDANCE > PRACTICE
  reference?: string
  quote?: string
  url: string
  effectiveFrom: string
  confidence: number
  // Evidence provenance (required for primary)
  evidenceId?: string
  fetchedAt?: string
}
```

### PrimarySourceCard (stricter)

```typescript
interface PrimarySourceCard extends SourceCard {
  quote: string // REQUIRED
  evidenceId: string // REQUIRED
  fetchedAt: string // REQUIRED
}
```

### AssistantResponse

See `src/lib/assistant/types.ts` for the complete schema.

## Validation

```typescript
import { validateResponse } from "@/lib/assistant"

const result = validateResponse(response)
if (!result.valid) {
  // Convert to REFUSAL with NO_CITABLE_RULES
}
```

## Quality Gates

Tests in `src/lib/assistant/__tests__/quality-gates.test.ts` enforce:

- REGULATORY ANSWER without citations → INVALID
- REGULATORY ANSWER without primary.url → INVALID
- REGULATORY ANSWER without primary.quote → INVALID
- REGULATORY ANSWER without primary.evidenceId → INVALID
- REGULATORY ANSWER without primary.fetchedAt → INVALID
- PRODUCT/SUPPORT/OFFTOPIC with citations → INVALID

## Directory Structure

```
src/lib/assistant/
├── types.ts              # Schema, types, constants
├── validation.ts         # Response validation with fail-closed enforcement
├── streaming.ts          # NDJSON stream parser
├── analytics.ts          # Analytics event tracking
├── citations.ts          # Citation ordering utilities
├── fixtures/             # Demo fixtures for testing
├── query-engine/
│   ├── text-utils.ts     # Croatian text processing
│   ├── concept-matcher.ts # Keyword → Concept matching
│   ├── rule-selector.ts  # Rule selection and filtering
│   ├── conflict-detector.ts # Conflict detection and resolution
│   ├── citation-builder.ts # Citation construction
│   └── answer-builder.ts # Main orchestrator
└── hooks/
    ├── useAssistantController.ts
    ├── useFocusManagement.ts
    ├── useRovingTabindex.ts
    ├── useReducedMotion.ts
    ├── useCTAEligibility.ts
    ├── useCTADismissal.ts
    └── useAssistantAnalytics.ts

src/components/assistant-v2/
├── AssistantContainer.tsx
├── AssistantInput.tsx
├── SuggestionChips.tsx
├── HistoryBar.tsx
├── AnswerSection.tsx
├── AnswerCard.tsx
├── ConfidenceBadge.tsx
├── ActionButtons.tsx
├── WhyDrawer.tsx
├── RelatedQuestions.tsx
├── RefusalCard.tsx
├── ConflictBanner.tsx
├── ErrorCard.tsx
├── EvidencePanel.tsx
├── AuthorityBadge.tsx
├── SourceCard.tsx
├── SupportingSources.tsx
├── ClientDataPanel.tsx
├── DataPointList.tsx
├── CTABlock.tsx
├── PersonalizationPanel.tsx
├── EmptyState.tsx
├── AnswerSkeleton.tsx
└── Announcer.tsx

src/app/api/assistant/chat/
├── route.ts              # Non-streaming endpoint
└── stream/
    └── route.ts          # NDJSON streaming endpoint
```

## Testing

```bash
# Run all assistant tests
npx vitest run src/lib/assistant/

# Run quality gates only
npx vitest run src/lib/assistant/__tests__/quality-gates.test.ts

# Run with coverage
npx vitest run src/lib/assistant/ --coverage
```

## Changelog

### 2024-12-24

- Implemented fail-closed validation (errors, not warnings)
- Added evidenceId and fetchedAt to SourceCard
- Created NDJSON streaming client parser
- Added quality gate tests for all required citation fields
