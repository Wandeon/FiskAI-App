# AI Assistant Architecture

> Canonical document - reviewed 2024-12-28
>
> Comprehensive architecture documentation for the FiskAI AI Assistant system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Query Processing Pipeline](#query-processing-pipeline)
3. [Reasoning Pipeline](#reasoning-pipeline)
4. [Component Responsibilities Matrix](#component-responsibilities-matrix)
5. [Integration with Regulatory Truth Layer](#integration-with-regulatory-truth-layer)
6. [Streaming Architecture](#streaming-architecture)
7. [Error Handling & Refusal Policy](#error-handling--refusal-policy)
8. [Client Integration](#client-integration)
9. [API Reference](#api-reference)

---

## System Overview

The AI Assistant is a **fail-closed, evidence-backed** question-answering system for Croatian regulatory content. It processes user queries through a multi-stage pipeline that ensures every answer is grounded in verifiable sources.

### Core Design Principles

| Principle                   | Implementation                                         |
| --------------------------- | ------------------------------------------------------ |
| **Fail-Closed**             | System refuses answers rather than hallucinate         |
| **Evidence-Backed**         | Every answer requires citations with source provenance |
| **Multi-Gate Validation**   | Multiple checkpoints filter low-quality responses      |
| **Progressive Enhancement** | Supports legacy JSON, NDJSON streaming, and SSE        |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  useAssistantController    useReasoningStream    useCTAEligibility      │
│  (State Machine)           (SSE Parser)          (Business Logic)        │
└──────────────────┬─────────────────┬─────────────────┬──────────────────┘
                   │                 │                 │
                   ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  POST /api/assistant/chat          JSON Response (legacy)                │
│  POST /api/assistant/chat/stream   NDJSON Streaming                     │
│  POST /api/assistant/chat/reasoning SSE Streaming (new pipeline)         │
└──────────────────┬─────────────────┬────────────────────────────────────┘
                   │                 │
        ┌──────────┴──────────┐      │
        ▼                     ▼      ▼
┌───────────────────┐  ┌─────────────────────────────────────────────────┐
│  LEGACY PIPELINE  │  │            NEW REASONING PIPELINE                │
├───────────────────┤  ├─────────────────────────────────────────────────┤
│  Query Engine     │  │  Generator-based event emission                  │
│  (buildAnswer)    │  │  13 stages with terminal outcomes                │
│                   │  │  Multiple sinks (SSE, Audit, Metrics)            │
└───────────────────┘  └─────────────────────────────────────────────────┘
                   │                 │
                   └────────┬────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REGULATORY TRUTH LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Concepts → Rules → Evidence                                             │
│  (Prisma DB with temporal validity + conditional applicability)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Directories

```
/src/lib/assistant/
├── query-engine/           # Legacy query processing
│   ├── query-interpreter.ts
│   ├── text-utils.ts
│   ├── concept-matcher.ts
│   ├── rule-selector.ts
│   ├── rule-eligibility.ts
│   ├── conflict-detector.ts
│   ├── citation-builder.ts
│   └── answer-builder.ts
├── reasoning/              # New reasoning pipeline
│   ├── pipeline.ts
│   ├── reasoning-pipeline.ts
│   ├── decision-coverage.ts
│   ├── refusal-policy.ts
│   ├── shadow-runner.ts
│   ├── feature-flags.ts
│   ├── stages/
│   │   ├── context-resolution.ts
│   │   └── source-discovery.ts
│   └── sinks/
│       ├── sse-sink.ts
│       ├── audit-sink.ts
│       ├── metrics-sink.ts
│       └── consumer.ts
├── hooks/                  # React client integration
│   ├── useAssistantController.ts
│   ├── useReasoningStream.ts
│   ├── useCTAEligibility.ts
│   └── useCTADismissal.ts
└── types.ts               # Core type definitions
```

---

## Query Processing Pipeline

The legacy query engine implements a **3-stage fail-closed pipeline** that transforms user queries into regulatory answers.

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUERY                                │
│                 "Koji je prag za PDV u Hrvatskoj?"               │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: QUERY INTERPRETATION                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Tokenize & normalize diacritics                          │ │
│  │ • Classify topic: REGULATORY | PRODUCT | SUPPORT           │ │
│  │ • Detect intent: EXPLAIN | CALCULATE | DEADLINE | ...      │ │
│  │ • Identify jurisdiction: HR | EU | OTHER                   │ │
│  │ • Extract entities: [PDV, VAT_THRESHOLD]                   │ │
│  │ • Calculate confidence score (0.0-0.95)                    │ │
│  │ • Detect gibberish/nonsense (vowel/consonant analysis)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  GATE: confidence < 0.6 → NEEDS_CLARIFICATION                    │
│  GATE: nonsenseRatio > 0.6 → OUT_OF_SCOPE                        │
│  GATE: foreign jurisdiction → UNSUPPORTED_JURISDICTION           │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: RETRIEVAL & RULE SELECTION                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2.1 CONCEPT MATCHING                                       │ │
│  │   • Extract keywords from query                            │ │
│  │   • Match against regulatory concepts (strict token match) │ │
│  │   • Filter by match score >= 0.25                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2.2 RULE ELIGIBILITY                                       │ │
│  │   • Check temporal validity (effectiveFrom/Until)          │ │
│  │   • Evaluate appliesWhen DSL predicates                    │ │
│  │   • Validate context completeness                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2.3 RULE SELECTION                                         │ │
│  │   • Fetch PUBLISHED rules for matched concepts             │ │
│  │   • Apply eligibility gate                                 │ │
│  │   • Sort by authority: LAW > REGULATION > GUIDANCE         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  GATE: no concept matches → NEEDS_CLARIFICATION                  │
│  GATE: no eligible rules → NO_CITABLE_RULES                      │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: ANSWER CONSTRUCTION                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3.1 CONFLICT DETECTION                                     │ │
│  │   • Group rules by conceptSlug:valueType                   │ │
│  │   • Attempt resolution by authority hierarchy              │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3.2 CITATION BUILDING                                      │ │
│  │   • Extract primary citation (first rule)                  │ │
│  │   • Add up to 3 supporting citations                       │ │
│  │   • Include evidence provenance (URL, quote, fetchedAt)    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3.3 ANSWER ASSEMBLY                                        │ │
│  │   • Build headline + directAnswer                          │ │
│  │   • Attach obligation metadata                             │ │
│  │   • Generate related questions                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  GATE: unresolved conflicts → UNRESOLVED_CONFLICT → REFUSAL      │
│  GATE: missing citations → NO_CITABLE_RULES → REFUSAL            │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FINAL RESPONSE                             │
│               kind: "ANSWER" | "REFUSAL"                         │
└─────────────────────────────────────────────────────────────────┘
```

### Confidence Thresholds

| Threshold                      | Value | Action                                 |
| ------------------------------ | ----- | -------------------------------------- |
| `CONFIDENCE_THRESHOLD_CLARIFY` | 0.6   | Below → always NEEDS_CLARIFICATION     |
| `CONFIDENCE_THRESHOLD_STRICT`  | 0.75  | Between 0.6-0.75 → require 2+ entities |
| `NONSENSE_RATIO_THRESHOLD`     | 0.6   | Above → OUT_OF_SCOPE                   |

### Authority Ranking

Rules are sorted by authority hierarchy when resolving conflicts:

```
LAW (1) > REGULATION (2) > GUIDANCE (3) > PRACTICE (4)
```

---

## Reasoning Pipeline

The new reasoning pipeline is a **generator-based, event-driven** system that provides visibility into each processing stage.

### State Machine

```
                                    ┌──────────────────┐
                                    │ QUESTION_INTAKE  │
                                    └────────┬─────────┘
                                             ▼
                                    ┌──────────────────┐
                                    │CONTEXT_RESOLUTION│
                                    └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              │              │
                     ┌─────────────┐         │              │
                     │CLARIFICATION│◄────────┤              │
                     │ (awaiting)  │  conf<0.9              │
                     └──────┬──────┘         │              │
                            │                │              │
                            ▼                ▼              │
                     ┌──────────────────────────┐           │
                     │         SOURCES          │           │
                     └────────────┬─────────────┘           │
                                  │                         │
                     ┌────────────┼─────────────┐           │
                     │ no sources │             │           │
                     ▼            ▼             │           │
              ┌──────────┐ ┌──────────────┐     │           │
              │ REFUSAL  │ │  RETRIEVAL   │     │           │
              └──────────┘ └──────┬───────┘     │           │
                                  │             │           │
                     ┌────────────┼─────────────┐           │
                     │ no rules   │             │           │
                     ▼            ▼             │           │
              ┌──────────┐ ┌──────────────┐     │           │
              │ REFUSAL  │ │APPLICABILITY │     │           │
              └──────────┘ └──────┬───────┘     │           │
                                  │             │           │
                                  ▼             │           │
                         ┌──────────────┐       │           │
                         │  CONFLICTS   │       │           │
                         └──────┬───────┘       │           │
                                │               │           │
                     ┌──────────┼───────────┐   │           │
                     │ unresolved│           │   │           │
                     ▼           ▼           │   │           │
              ┌──────────┐ ┌──────────────┐  │   │           │
              │ REFUSAL  │ │  ANALYSIS    │  │   │           │
              └──────────┘ └──────┬───────┘  │   │           │
                                  │          │   │           │
                                  ▼          │   │           │
                         ┌──────────────┐    │   │           │
                         │  CONFIDENCE  │    │   │           │
                         └──────┬───────┘    │   │           │
                                │            │   │           │
                   ┌────────────┼────────────┼───┤           │
                   │            │            │   │           │
                   ▼            ▼            ▼   ▼           ▼
           ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐
           │  ANSWER  │ │CONDITIONAL │ │ REFUSAL  │ │   ERROR   │
           │          │ │  ANSWER    │ │          │ │           │
           └──────────┘ └────────────┘ └──────────┘ └───────────┘
                              TERMINAL STATES
```

### Reasoning Stages (13 Total)

| Stage                | Purpose                                   | Status Types                    |
| -------------------- | ----------------------------------------- | ------------------------------- |
| `QUESTION_INTAKE`    | Parse and normalize query                 | started → complete              |
| `CONTEXT_RESOLUTION` | Determine domain, jurisdiction, risk tier | started → complete              |
| `CLARIFICATION`      | Request missing information (optional)    | awaiting_input                  |
| `SOURCES`            | Identify applicable regulations           | started → progress → complete   |
| `RETRIEVAL`          | Fetch relevant rules                      | started → complete              |
| `APPLICABILITY`      | Filter by context, calculate coverage     | started → complete              |
| `CONFLICTS`          | Resolve conflicting rules                 | started → complete              |
| `ANALYSIS`           | Deep analysis with checkpoints            | started → checkpoint → complete |
| `CONFIDENCE`         | Calculate confidence scores               | started → complete              |
| `ANSWER`             | Generate answer (terminal)                | complete                        |
| `CONDITIONAL_ANSWER` | Multiple branches (terminal)              | complete                        |
| `REFUSAL`            | Cannot answer (terminal)                  | complete                        |
| `ERROR`              | Pipeline failure (terminal)               | complete                        |

### Risk Tier Classification

| Tier | Keywords             | Description                          |
| ---- | -------------------- | ------------------------------------ |
| T0   | kazna, rok, obveza   | Critical: Legal deadlines, penalties |
| T1   | pdv, porez, doprinos | High: Tax obligations, VAT           |
| T2   | prag, limit, granica | Medium: Thresholds, limits           |
| T3   | (default)            | Low: Informational                   |

### Decision Coverage

The pipeline uses **dimension-based coverage** to determine answer eligibility:

```typescript
interface DimensionRequirement {
  dimension: string
  required: boolean | { dependsOn: string; value: string }
  possibleValues?: string[]
  defaultValue?: string
  defaultSource?: "jurisdiction" | "temporal" | "profile"
}

// Example: VAT Rate Dimensions
{
  topic: "vat-rate",
  dimensions: [
    { dimension: "Item", required: true },
    { dimension: "Date", required: true, defaultValue: "today" },
    { dimension: "Place", required: true, defaultValue: "HR" },
    { dimension: "BuyerType", required: false },
    { dimension: "VAT_ID", required: { dependsOn: "BuyerType", value: "B2B" } }
  ]
}
```

**Coverage Scoring:**

- `requiredScore = requiredResolved / requiredCount` (must be 1.0 for ANSWER)
- `totalScore = totalResolved / totalCount` (includes optional)

**Terminal Outcome Determination:**

- `requiredScore < 1.0` → REFUSAL
- `requiredScore = 1.0 AND totalScore < 1.0` → CONDITIONAL_ANSWER
- `requiredScore = 1.0 AND totalScore = 1.0` → ANSWER

---

## Component Responsibilities Matrix

### Query Engine Components

| Component             | File                   | Responsibility                                                               |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| **Query Interpreter** | `query-interpreter.ts` | Classify topic, intent, jurisdiction; detect gibberish; calculate confidence |
| **Text Utils**        | `text-utils.ts`        | Normalize diacritics, tokenize, extract keywords                             |
| **Concept Matcher**   | `concept-matcher.ts`   | Match query keywords to regulatory concepts (strict token matching)          |
| **Rule Eligibility**  | `rule-eligibility.ts`  | Check temporal validity, evaluate appliesWhen predicates                     |
| **Rule Selector**     | `rule-selector.ts`     | Fetch and filter PUBLISHED rules, sort by authority                          |
| **Conflict Detector** | `conflict-detector.ts` | Detect and resolve conflicting rules                                         |
| **Citation Builder**  | `citation-builder.ts`  | Format citations with evidence provenance                                    |
| **Answer Builder**    | `answer-builder.ts`    | Orchestrate full pipeline, manage all gates                                  |

### Reasoning Pipeline Components

| Component              | File                           | Responsibility                                  |
| ---------------------- | ------------------------------ | ----------------------------------------------- |
| **Pipeline**           | `reasoning-pipeline.ts`        | Main generator, orchestrates all stages         |
| **Context Resolution** | `stages/context-resolution.ts` | Determine domain, jurisdiction, risk tier       |
| **Source Discovery**   | `stages/source-discovery.ts`   | Find applicable regulatory sources              |
| **Decision Coverage**  | `decision-coverage.ts`         | Calculate dimension coverage, determine outcome |
| **Refusal Policy**     | `refusal-policy.ts`            | Determine refusal codes and messages            |
| **Shadow Runner**      | `shadow-runner.ts`             | Run both pipelines for gradual migration        |
| **Feature Flags**      | `feature-flags.ts`             | Mode selection (off/shadow/live)                |
| **SSE Sink**           | `sinks/sse-sink.ts`            | Convert events to SSE format                    |
| **Audit Sink**         | `sinks/audit-sink.ts`          | Persist traces for analysis                     |
| **Metrics Sink**       | `sinks/metrics-sink.ts`        | Collect performance metrics                     |
| **Consumer**           | `sinks/consumer.ts`            | Multiplex generator to all sinks                |

### React Hooks

| Hook                       | File                        | Responsibility                            |
| -------------------------- | --------------------------- | ----------------------------------------- |
| **useAssistantController** | `useAssistantController.ts` | Main state machine for chat lifecycle     |
| **useReasoningStream**     | `useReasoningStream.ts`     | SSE streaming and event parsing           |
| **useCTAEligibility**      | `useCTAEligibility.ts`      | Determine when to show marketing CTAs     |
| **useCTADismissal**        | `useCTADismissal.ts`        | Manage CTA dismissal with 7-day cooldown  |
| **useAssistantAnalytics**  | `useAssistantAnalytics.ts`  | Event tracking for analytics              |
| **useFocusManagement**     | `useFocusManagement.ts`     | Auto-focus headline/input based on status |
| **useReducedMotion**       | `useReducedMotion.ts`       | Respect browser motion preferences        |
| **useRovingTabindex**      | `useRovingTabindex.ts`      | ARIA keyboard navigation                  |

---

## Integration with Regulatory Truth Layer

The AI Assistant consumes data from the Regulatory Truth Layer through Prisma:

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGULATORY TRUTH LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Evidence Table                 Concept Table                    │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │ id              │           │ id              │              │
│  │ sourceUrl       │           │ slug            │              │
│  │ rawContent      │◄──────────│ nameHr          │              │
│  │ fetchedAt       │           │ keywords[]      │              │
│  │ pdfClassification│          └────────┬────────┘              │
│  └─────────────────┘                    │                       │
│           │                             │                       │
│           │                             ▼                       │
│           │              ┌─────────────────────────┐            │
│           │              │   RegulatoryRule Table  │            │
│           │              ├─────────────────────────┤            │
│           └──────────────│ id                      │            │
│                          │ conceptSlug             │            │
│                          │ evidenceId (provenance) │            │
│                          │ titleHr, bodyHr         │            │
│                          │ authority               │            │
│                          │ effectiveFrom/Until     │            │
│                          │ appliesWhen (DSL)       │            │
│                          │ confidence              │            │
│                          │ status: PUBLISHED       │            │
│                          └─────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI ASSISTANT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  concept-matcher.ts                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ prisma.concept.findMany()                                  │ │
│  │ → Match query keywords to concept.keywords[]               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                  │                               │
│                                  ▼                               │
│  rule-selector.ts                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ prisma.regulatoryRule.findMany({                           │ │
│  │   where: {                                                 │ │
│  │     conceptSlug: { in: matchedSlugs },                     │ │
│  │     status: "PUBLISHED"                                    │ │
│  │   },                                                       │ │
│  │   include: { evidence: true }                              │ │
│  │ })                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                  │                               │
│                                  ▼                               │
│  rule-eligibility.ts                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Check effectiveFrom <= asOf < effectiveUntil             │ │
│  │ • Evaluate appliesWhen via DSL interpreter                 │ │
│  │   import { evaluate } from "@/lib/regulatory-truth/dsl"    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AppliesWhen DSL Integration

The `rule-eligibility.ts` evaluates conditional predicates using the Regulatory Truth DSL:

```typescript
// Example rule with appliesWhen
{
  appliesWhen: {
    and: [
      { eq: ["entity.type", "OBRT"] },
      { eq: ["entity.obrtSubtype", "PAUSALNI"] },
      { lt: ["counters.revenueYtd", 39816.84] },
    ]
  }
}

// Evaluation context
interface EvaluationContext {
  asOf: string // ISO date
  entity: {
    type: "DOO" | "JDOO" | "OBRT" | "UDRUGA" | "OTHER"
    obrtSubtype?: "PAUSALNI" | "DOHODAS" | "DOBITAS"
    vat: { status: "IN_VAT" | "OUTSIDE_VAT" | "UNKNOWN" }
    activityNkd?: string
    location: { country: "HR"; county?: string }
  }
  counters?: { revenueYtd?: number }
  txn?: { kind; paymentMethod; amount; b2b }
}
```

---

## Streaming Architecture

The AI Assistant supports three response modes:

### 1. JSON Response (Legacy)

**Endpoint:** `POST /api/assistant/chat`

```
Client ──POST──▶ Server ──JSON──▶ Client
         │                    │
    Single request       Complete response
```

### 2. NDJSON Streaming

**Endpoint:** `POST /api/assistant/chat/stream`

```
Client ──POST──▶ Server
                   │
                   ├─▶ {"schemaVersion":"1.0.0","kind":"ANSWER",...}
                   ├─▶ {"citations":{"primary":{...}}}
                   ├─▶ {"headline":"PDV stopa","directAnswer":"25%"}
                   └─▶ {"_done":true}
```

**Critical Invariant:** Citations MUST come BEFORE content for REGULATORY topics.

### 3. Server-Sent Events (New Pipeline)

**Endpoint:** `POST /api/assistant/chat/reasoning`

```
Client ──POST──▶ Server
                   │
                   ├─▶ event: reasoning
                   │   data: {"v":1,"stage":"CONTEXT_RESOLUTION","status":"started"}
                   │
                   ├─▶ event: reasoning
                   │   data: {"v":1,"stage":"SOURCES","status":"progress","progress":{"current":2,"total":5}}
                   │
                   ├─▶ event: heartbeat
                   │   data: {"ts":"2024-12-28T10:00:00Z"}
                   │
                   └─▶ event: terminal
                       data: {"v":1,"stage":"ANSWER","status":"complete","data":{...}}
```

### SSE Event Format

```typescript
interface ReasoningEvent {
  v: 1 // Schema version
  id: string // Format: `${requestId}_${seq}`
  requestId: string
  seq: number // Sequence counter
  ts: string // ISO timestamp
  stage: ReasoningStage
  status: "started" | "progress" | "checkpoint" | "complete" | "awaiting_input"
  message?: string
  severity?: "info" | "warning" | "critical"
  progress?: { current: number; total?: number }
  data?: StagePayload
}
```

### Sink Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    REASONING GENERATOR                          │
│                    (async generator*)                           │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    CONSUMER (consumeReasoning)                  │
│                    Multiplexes events to all sinks              │
└───────────────────────────┬────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│    SSE SINK      │ │  AUDIT SINK  │ │  METRICS SINK    │
│  mode: nonBlocking│ │ mode: buffered│ │ mode: nonBlocking│
├──────────────────┤ ├──────────────┤ ├──────────────────┤
│ Streams to client │ │ Collects all │ │ Records metrics  │
│ via controller    │ │ events, writes│ │ inline (no       │
│                   │ │ on flush      │ │ buffering)       │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

**Sink Modes:**

- `nonBlocking`: Fire-and-forget, never blocks response
- `buffered`: Collects events, writes all at once on flush
- `criticalAwait`: Only awaits critical-severity events

---

## Error Handling & Refusal Policy

### Fail-Closed Philosophy

The system **refuses answers rather than hallucinate**. Every response must pass multiple validation gates.

### Refusal Codes

| Code                         | Trigger                                | Message                                      |
| ---------------------------- | -------------------------------------- | -------------------------------------------- |
| `NEEDS_CLARIFICATION`        | Confidence < 0.6 or no concept matches | "Molimo pojasnite vaše pitanje"              |
| `NO_CITABLE_RULES`           | No eligible rules found                | "Nismo pronašli relevantne propise"          |
| `OUT_OF_SCOPE`               | Gibberish or PRODUCT/SUPPORT topic     | "Ovo pitanje nije u našem području"          |
| `UNSUPPORTED_JURISDICTION`   | Non-Croatian jurisdiction              | "Podržavamo samo hrvatsko zakonodavstvo"     |
| `MISSING_CLIENT_DATA`        | Personalization needed but no context  | "Trebamo više podataka o vašem poslovanju"   |
| `UNRESOLVED_CONFLICT`        | Conflicting rules at same authority    | "Pronašli smo proturječne propise"           |
| `GRAY_ZONE`                  | Ambiguous interpretation               | "Ovo područje zahtijeva stručni savjet"      |
| `FUTURE_LAW_UNCERTAIN`       | Future effective date                  | "Propisi koji stupaju na snagu nisu konačni" |
| `MISSING_REQUIRED_DIMENSION` | Coverage score < 1.0                   | "Nedostaju ključni podaci za odgovor"        |

### Validation Points

1. **Request Validation** (400 errors)
   - Missing/invalid query
   - Invalid surface parameter

2. **Response Validation** (FAIL-CLOSED)
   - Empty citations for REGULATORY → REFUSAL
   - Missing primary.url → REFUSAL
   - Missing evidenceId → REFUSAL

3. **Citation Validation**
   - `primary.quote` required
   - `primary.url` required
   - `primary.evidenceId` required
   - `primary.fetchedAt` required

### Response Length Limits

```typescript
const LIMITS = {
  headline: 120, // chars
  directAnswer: 240, // chars
  citationsMax: 4, // count
  totalResponse: 3500, // chars
}
```

---

## Client Integration

### Controller State Machine

```typescript
type ControllerStatus =
  | "IDLE"             // Ready for input
  | "LOADING"          // Request in flight
  | "STREAMING"        // Receiving events
  | "COMPLETE"         // Answer received
  | "PARTIAL_COMPLETE" // Answer received, missing clientContext
  | "ERROR"            // Request failed

// State transitions
IDLE ──submit()──▶ LOADING ──stream_start──▶ STREAMING
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                           COMPLETE    PARTIAL_COMPLETE       ERROR
                              │                │                │
                              └────────────────┴────────────────┘
                                               │
                                               ▼
                                             IDLE
```

### CTA Eligibility Rules

| Condition                                                   | CTA Type          |
| ----------------------------------------------------------- | ----------------- |
| 1+ successful REGULATORY answers + personalization keywords | `personalization` |
| 2+ successful REGULATORY answers (no personalization)       | `contextual`      |
| APP surface                                                 | Never show        |
| Recently dismissed (7-day cooldown)                         | Don't show        |

### Analytics Events

```typescript
// Query lifecycle
"assistant.query.submit"
"assistant.query.complete"
"assistant.query.refusal"
"assistant.query.error"

// Interactions
"assistant.drawer.expand"
"assistant.feedback.submit"
"assistant.suggestion.click"

// Marketing (MARKETING surface only)
"marketing.cta.shown"
"marketing.cta.click"
"marketing.cta.dismiss"
```

---

## API Reference

### POST /api/assistant/chat

Standard JSON response endpoint.

**Request:**

```typescript
{
  query: string
  surface: "MARKETING" | "APP"
  companyId?: string  // Required for APP surface
}
```

**Response:**

```typescript
{
  schemaVersion: "1.0.0"
  requestId: string
  traceId: string
  kind: "ANSWER" | "REFUSAL"
  topic: "REGULATORY" | "PRODUCT" | "SUPPORT" | "OFFTOPIC"
  surface: "MARKETING" | "APP"
  createdAt: string
  headline: string
  directAnswer: string
  citations?: {
    primary: SourceCard
    supporting: SourceCard[]
  }
  confidence?: { level: string, score: number }
  refusalReason?: RefusalReason
  relatedQuestions?: string[]
}
```

### POST /api/assistant/chat/stream

NDJSON streaming endpoint.

**Response:** Same structure as `/chat`, delivered as newline-delimited JSON chunks.

### POST /api/assistant/chat/reasoning

SSE streaming endpoint with reasoning stages.

**Response:** Server-Sent Events with `ReasoningEvent` payloads.

### GET /api/assistant/reasoning/health

Health check endpoint.

**Response:**

```typescript
{
  status: "healthy" | "degraded" | "unhealthy"
  mode: "off" | "shadow" | "live"
  checks: {
    database: boolean
    recentTraces: number
    errorRate: number
    avgDurationMs: number
  }
  timestamp: string
}
```

---

## Feature Flags & Deployment Modes

### Environment Variables

| Variable                    | Values                      | Description                 |
| --------------------------- | --------------------------- | --------------------------- |
| `REASONING_MODE`            | `off` \| `shadow` \| `live` | Global pipeline mode        |
| `REASONING_UX_ENABLED`      | `true` \| `false`           | Show reasoning UI           |
| `REASONING_BETA_PERCENTAGE` | `0-100`                     | Per-user rollout percentage |

### Mode Behavior

| Mode     | Legacy Pipeline | New Pipeline      | Response                  |
| -------- | --------------- | ----------------- | ------------------------- |
| `off`    | Runs            | Skipped           | Legacy                    |
| `shadow` | Runs            | Runs (background) | Legacy                    |
| `live`   | Skipped         | Runs              | New (with compat wrapper) |

### Shadow Mode

Enables gradual migration by running both pipelines:

```
                    ┌──────────────────────────────────────┐
                    │           SHADOW RUNNER              │
                    └─────────────┬────────────────────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               ▼                                     ▼
    ┌──────────────────────┐            ┌──────────────────────┐
    │   LEGACY PIPELINE    │            │   NEW PIPELINE       │
    │   (serves response)  │            │   (logs trace only)  │
    └──────────────────────┘            └──────────────────────┘
               │                                     │
               ▼                                     ▼
    ┌──────────────────────┐            ┌──────────────────────┐
    │   User Response      │            │   ReasoningTrace DB  │
    │   (immediate)        │            │   (for metrics)      │
    └──────────────────────┘            └──────────────────────┘
```

---

## Related Documentation

- [Regulatory Truth Layer Overview](../05_REGULATORY/OVERVIEW.md)
- [Two-Layer Model](../01_ARCHITECTURE/two-layer-model.md)
- [Trust Guarantees](../01_ARCHITECTURE/trust-guarantees.md)
- [Operations Runbook](../04_OPERATIONS/OPERATIONS_RUNBOOK.md)
