# FiskAI V1 Gap-Closing Design Specification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create detailed implementation tasks for each phase.

**Date:** 2025-12-27
**Status:** Approved for Implementation
**Authors:** Claude Opus 4.5 + Product Review
**Scope:** Close gaps between current implementation and V1 specification

---

## Executive Summary

This design closes five critical gaps between the current FiskAI implementation and the V1 Regulatory Intelligence Platform specification:

| Gap          | Current State         | Target State                         |
| ------------ | --------------------- | ------------------------------------ |
| **Layer 8**  | 7 Knowledge Shapes    | 8 Shapes (+ ComparisonMatrix)        |
| **Coverage** | Content-type based    | Dimension-based DecisionCoverage     |
| **Answers**  | Binary (answer/error) | Ternary (ANSWER/CONDITIONAL/REFUSAL) |
| **UX**       | Instant response      | 7-Stage Visible Reasoning            |
| **Safety**   | Implicit              | Explicit RefusalPolicy with codes    |

**Philosophy:** "FiskAI will always tell you what is known, what applies, and what is missing, and it will never pretend."

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER QUERY                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REASONING PIPELINE (NEW)                            │
│              src/lib/assistant/reasoning/                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 7-Stage     │→ │ Decision    │→ │ Terminal Outcome        │  │
│  │ Orchestrator│  │ Coverage    │  │ Generator               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │              │                      │                  │
│         │         dimensions          ┌───────┴───────┐          │
│         │         resolved?           │               │          │
│         ▼              │              ▼               ▼          │
│  ┌─────────────┐       │       ┌──────────┐   ┌────────────┐    │
│  │ Refusal     │◄──────┘       │ ANSWER   │   │ CONDITIONAL│    │
│  │ Policy      │ <100%         │ 100%     │   │ 50-99%     │    │
│  └─────────────┘               └──────────┘   └────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REGULATORY-TRUTH (EXISTING + NEW)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Query Router → 6 Engines (Logic, Process, Reference,     │   │
│  │                          Asset, Temporal, Strategy NEW)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 8 Knowledge Shapes:                                       │   │
│  │ AtomicClaim, ConceptNode, GraphEdge, RegulatoryProcess,  │   │
│  │ ReferenceTable, RegulatoryAsset, TransitionalProvision,  │   │
│  │ ComparisonMatrix (NEW)                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Additions:**

1. `ComparisonMatrix` — 8th knowledge shape for strategic comparisons
2. `strategy-engine` — 6th retrieval engine for STRATEGY intent
3. `reasoning-pipeline` — 7-stage orchestrator with streaming
4. `DecisionCoverage` — dimension-based completeness check
5. `RefusalPolicy` — code-based safety enforcement

---

## 2. ComparisonMatrix (Layer 8)

### Purpose

Handle strategic questions like "Should I open a j.d.o.o. or a trade?" that require multi-dimensional comparison, not single-rule retrieval.

### Schema

```typescript
interface ComparisonMatrix {
  id: string
  slug: string // "pausalni-vs-doo"
  titleHr: string
  titleEn?: string

  // Contextual Anchor for retrieval
  appliesWhen?: string // "IF user_type == 'freelancer' OR revenue < 40000"
  domainTags: string[] // ["STARTING_BUSINESS", "TAX_REGIME"]

  // Options being compared
  options: ComparisonOption[]

  // Criteria for comparison
  criteria: ComparisonCriterion[]

  // The matrix cells
  cells: ComparisonCell[]

  // Optional conclusion
  conclusion?: string

  // Provenance
  evidenceId: string
  createdAt: DateTime
  updatedAt: DateTime
}

interface ComparisonOption {
  slug: string // "pausalni"
  conceptId: string // Link to ConceptNode taxonomy
  nameHr: string
  nameEn?: string
  description?: string
}

interface ComparisonCriterion {
  slug: string // "liability"
  conceptId: string // Link to ConceptNode taxonomy
  nameHr: string
  nameEn?: string
  weight?: number // For scoring (optional)
}

interface ComparisonCell {
  optionSlug: string
  criterionSlug: string
  value: string // "Unlimited" or "25%"
  sentiment: "positive" | "negative" | "neutral"
  explanation?: string
}
```

### Prisma Model

```prisma
model ComparisonMatrix {
  id          String   @id @default(cuid())
  slug        String   @unique
  titleHr     String
  titleEn     String?

  appliesWhen String?
  domainTags  String[]

  options     Json     // ComparisonOption[]
  criteria    Json     // ComparisonCriterion[]
  cells       Json     // ComparisonCell[]

  conclusion  String?  @db.Text

  evidenceId  String?
  evidence    Evidence? @relation(fields: [evidenceId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([domainTags])
}
```

### Extraction

Detection patterns for `comparison-extractor.ts`:

- "Pros and Cons" / "Prednosti i nedostaci"
- "X vs Y" / "X ili Y" / "X nasuprot Y"
- "Comparison" / "Usporedba"
- HTML tables with option columns
- Lists with comparative structure

---

## 3. Decision Coverage Calculator

### Purpose

Replace content-type based coverage with dimension-based completeness checking at query time.

### Core Concepts

```typescript
// Dimension requirement with conditional logic
interface DimensionRequirement {
  dimension: string // "ServiceContext", "Date", "Place"
  required:
    | boolean
    | {
        // Conditional requirement
        dependsOn: string // "BuyerType"
        value: string // "B2B"
      }
  possibleValues?: string[] // From ConceptNode taxonomy
  defaultValue?: string // Used if not provided
  defaultSource?: string // "jurisdiction" | "temporal" | "profile"
}

// Topic-specific dimension requirements
interface TopicDimensions {
  topic: string // "vat-rate", "oss-threshold"
  dimensions: DimensionRequirement[]
}

// Example: VAT Rate determination
const VAT_RATE_DIMENSIONS: TopicDimensions = {
  topic: "vat-rate",
  dimensions: [
    { dimension: "Item", required: true },
    {
      dimension: "ServiceContext",
      required: false,
      possibleValues: ["on-premises", "takeaway", "delivery"],
    },
    { dimension: "Date", required: true, defaultValue: "today", defaultSource: "temporal" },
    { dimension: "Place", required: true, defaultValue: "HR", defaultSource: "jurisdiction" },
    { dimension: "BuyerType", required: false, possibleValues: ["b2b", "b2c"] },
    { dimension: "VAT_ID", required: { dependsOn: "BuyerType", value: "B2B" } },
  ],
}
```

### Resolution Flow

1. **Identify Topic** from Query Classification
2. **Load Required Dimensions** for topic
3. **Resolve Dimensions** from sources (priority order):
   - User query entities
   - User context/profile
   - Temporal defaults (today)
   - Jurisdiction defaults (HR)
4. **Compute Coverage Score**:
   - `requiredScore`: resolved required / total required (must be 1.0)
   - `totalScore`: all resolved / all dimensions
5. **Determine Terminal Outcome**:
   - Required 100% + Optional 100% → `ANSWER`
   - Required 100% + Optional <100% → `CONDITIONAL_ANSWER`
   - Required <100% → `REFUSAL`

### Output Interface

```typescript
interface DecisionCoverageResult {
  topic: string
  requiredScore: number // 0-1, must be 1.0 for answer
  totalScore: number // 0-1, including optional

  resolved: ResolvedDimension[]
  unresolved: UnresolvedDimension[]

  terminalOutcome: "ANSWER" | "CONDITIONAL_ANSWER" | "REFUSAL"

  // For CONDITIONAL_ANSWER: branches to present
  branches?: ConditionalBranch[]
}

interface ResolvedDimension {
  dimension: string
  value: string
  source: "query" | "profile" | "default"
  confidence: number
}

interface UnresolvedDimension {
  dimension: string
  required: boolean
  possibleValues?: string[]
}

interface ConditionalBranch {
  condition: string // "If consumed on premises"
  dimensionValue: string // "on-premises"
  conceptId: string // Links to taxonomy
  resultingRule?: string // The rule that would apply
}
```

---

## 4. Refusal Policy System

### Purpose

Deterministic, code-based refusal for safety-critical decisions.

### Refusal Codes

```typescript
enum RefusalCode {
  // Coverage-based refusals
  NO_RULES_FOUND = "NO_RULES_FOUND",
  MISSING_REQUIRED_DIMENSION = "MISSING_REQUIRED_DIMENSION",

  // Content-based refusals
  GRAY_ZONE = "GRAY_ZONE",
  UNRESOLVED_CONFLICT = "UNRESOLVED_CONFLICT",

  // Capability-based refusals
  MISSING_STRATEGY_DATA = "MISSING_STRATEGY_DATA",
  UNSUPPORTED_JURISDICTION = "UNSUPPORTED_JURISDICTION",
  OUT_OF_SCOPE = "OUT_OF_SCOPE",

  // Temporal refusals
  FUTURE_LAW_UNCERTAIN = "FUTURE_LAW_UNCERTAIN",
}
```

### Template Structure

```typescript
interface RefusalTemplate {
  code: RefusalCode
  severity: "info" | "warning" | "critical"
  messageHr: string
  messageEn: string
  nextSteps: NextStep[]
  requiresHumanReview: boolean
}

interface NextStep {
  type: "CLARIFY" | "CONTACT_ADVISOR" | "TRY_DIFFERENT_QUESTION" | "PROVIDE_CONTEXT"
  prompt?: string
  conceptId?: string
}

interface RefusalPayload {
  template: RefusalTemplate
  context?: {
    missingDimensions?: string[]
    conflictingRules?: string[]
    grayZoneTopic?: string
  }
}
```

### Decision Tree

```
DecisionCoverage.requiredScore < 1.0?
├─ YES → REFUSAL(MISSING_REQUIRED_DIMENSION)
│        context: { missingDimensions: [...] }
│
└─ NO → Rules found?
        ├─ NO → REFUSAL(NO_RULES_FOUND)
        │
        └─ YES → Conflicts detected?
                 ├─ UNRESOLVABLE → REFUSAL(UNRESOLVED_CONFLICT)
                 │
                 └─ RESOLVABLE or NONE → Coverage 100%?
                                         ├─ YES → ANSWER
                                         └─ NO → CONDITIONAL_ANSWER
```

---

## 5. Visible Reasoning Pipeline (7-Stage Streaming)

### The 7 Stages

| #   | Stage                 | Streaming Mode                | User Sees                                |
| --- | --------------------- | ----------------------------- | ---------------------------------------- |
| 1   | QUESTION_INTAKE       | Buffered                      | "Analysing your question..."             |
| 2   | CONTEXT_RESOLUTION    | Buffered + Clarification Gate | Domain, jurisdiction, risk level         |
| 3   | SOURCE_DISCOVERY      | **True Progressive**          | Sources streamed live                    |
| 4   | RULE_RETRIEVAL        | Buffered                      | Concepts matched, rules retrieved        |
| 5   | APPLICABILITY_CHECK   | Buffered                      | Rules filtered with explanations         |
| 6   | ANALYSIS              | Hybrid                        | Checkpoints: "Comparing X vs Y..."       |
| 7   | CONFIDENCE_AND_ANSWER | Buffered + Pause              | Confidence, then answer after 600-1000ms |

### Event Schema

```typescript
interface ReasoningEvent {
  v: 1 // Schema version
  id: string // Unique event ID
  requestId: string // Correlation ID
  seq: number // Monotonic per request
  ts: string // ISO timestamp
  stage: ReasoningStage
  status: "started" | "progress" | "checkpoint" | "complete" | "awaiting_input"
  message?: string // User-facing copy
  severity?: "info" | "warning" | "critical"
  progress?: { current: number; total?: number }
  data?: StagePayload
}

type ReasoningStage =
  | "QUESTION_INTAKE"
  | "CONTEXT_RESOLUTION"
  | "CLARIFICATION"
  | "SOURCES"
  | "RETRIEVAL"
  | "APPLICABILITY"
  | "ANALYSIS"
  | "CONFIDENCE"
  | "ANSWER"
  | "CONDITIONAL_ANSWER"
  | "REFUSAL"
  | "ERROR"
```

### Generator Pattern

```typescript
export async function* buildAnswerWithReasoning(
  requestId: string,
  query: string,
  userContext?: UserContext
): AsyncGenerator<ReasoningEvent, TerminalPayload> {
  // Stage 1: Question Intake
  yield emit({ stage: "QUESTION_INTAKE", status: "started" })
  const parsed = parseQuery(query)
  yield emit({ stage: "QUESTION_INTAKE", status: "complete" })

  // Stage 2: Context Resolution
  yield emit({ stage: "CONTEXT_RESOLUTION", status: "started" })
  const resolution = await resolveContext(parsed, userContext)

  if (resolution.confidence < 0.9) {
    yield emit({
      stage: "CLARIFICATION",
      status: "awaiting_input",
      data: buildClarificationQuestion(resolution),
    })
    // Pipeline pauses until clarification received
  }

  yield emit({ stage: "CONTEXT_RESOLUTION", status: "complete", data: resolution })

  // Stage 3: Source Discovery (progressive)
  yield emit({ stage: "SOURCES", status: "started" })
  for await (const source of discoverSources(resolution.concepts)) {
    yield emit({ stage: "SOURCES", status: "progress", message: `Found: ${source.name}` })
  }
  yield emit({ stage: "SOURCES", status: "complete" })

  // Stage 4: Rule Retrieval
  yield emit({ stage: "RETRIEVAL", status: "started" })
  const routerResult = await routeQuery(query, resolution)
  yield emit({ stage: "RETRIEVAL", status: "complete", data: routerResult })

  // Stage 5: Applicability
  yield emit({ stage: "APPLICABILITY", status: "started" })
  const coverage = await calculateDecisionCoverage(routerResult, resolution)
  yield emit({ stage: "APPLICABILITY", status: "complete", data: coverage })

  // Stage 6: Analysis
  yield emit({ stage: "ANALYSIS", status: "started" })
  yield emit({ stage: "ANALYSIS", status: "checkpoint", message: "Comparing sources..." })
  const analysis = await analyzeRules(coverage.eligibleRules)
  yield emit({ stage: "ANALYSIS", status: "complete", data: analysis })

  // Stage 7: Confidence & Terminal
  const confidence = computeConfidence(analysis, coverage)
  yield emit({ stage: "CONFIDENCE", status: "complete", data: confidence })

  // THE PAUSE (deliberate delay for trust)
  await sleep(700)

  // Determine terminal outcome
  const terminal = determineTerminal(coverage, analysis, confidence)
  yield emit({ stage: terminal.outcome, status: "complete", data: terminal })

  return terminal
}
```

### SSE Wire Format

```
event: reasoning
id: req_abc123_001
data: {"v":1,"stage":"QUESTION_INTAKE","status":"started","ts":"..."}

event: reasoning
id: req_abc123_002
data: {"v":1,"stage":"SOURCES","status":"progress","message":"Found: Zakon o PDV-u"}

event: terminal
id: req_abc123_final
data: {"v":1,"stage":"ANSWER","status":"complete","data":{...}}
```

---

## 6. Ingestion Pipeline Updates

### 3-Pass Model

**Pass 1: Structural Segmentation** (Existing)

- Input: HTML/PDF
- Output: EvidenceBlocks with content hashes
- Location: `sentinel.ts`, `html-parser.ts`

**Pass 2: 8-Model Extraction** (Updated)

| Detection        | Extractor                         | Output                |
| ---------------- | --------------------------------- | --------------------- |
| IF/THEN logic    | claim-extractor.ts                | AtomicClaim           |
| Step 1, Step 2   | process-extractor.ts              | RegulatoryProcess     |
| Table of Codes   | reference-extractor.ts            | ReferenceTable        |
| Form/Download    | asset-extractor.ts                | RegulatoryAsset       |
| Transitional     | transitional-extractor.ts         | TransitionalProvision |
| **Pros/Cons/vs** | **comparison-extractor.ts (NEW)** | **ComparisonMatrix**  |

**Pass 3: Taxonomy Linkage** (Existing)

- Link entities to ConceptNode taxonomy
- Map colloquial → legal terms
- Build OVERRIDES edges
- Location: `taxonomy/`, `precedence-builder.ts`

---

## 7. File Structure

```
src/lib/
├── assistant/
│   └── reasoning/                    # NEW: Reasoning Pipeline
│       ├── reasoning-pipeline.ts     # 7-stage orchestrator
│       ├── decision-coverage.ts      # Dimension-based coverage
│       ├── refusal-policy.ts         # RefusalCode templates
│       ├── terminal-generator.ts     # ANSWER/CONDITIONAL/REFUSAL
│       ├── types.ts                  # ReasoningEvent, etc.
│       └── __tests__/
│
└── regulatory-truth/
    ├── agents/
    │   └── comparison-extractor.ts   # NEW: ComparisonMatrix extraction
    │
    ├── retrieval/
    │   └── strategy-engine.ts        # NEW: STRATEGY intent handler
    │
    ├── schemas/
    │   ├── comparison-matrix.ts      # NEW: ComparisonMatrix schema
    │   └── query-intent.ts           # UPDATE: Add STRATEGY intent
    │
    └── taxonomy/
        └── topic-dimensions.ts       # NEW: Dimension requirements per topic
```

---

## 8. Implementation Phases

### Phase 1: ComparisonMatrix (Layer 8)

- Add Prisma model
- Create comparison-extractor.ts
- Add STRATEGY intent to QueryRouter
- Create strategy-engine.ts

### Phase 2: Decision Coverage

- Define TopicDimensions for core topics (VAT, OSS, etc.)
- Implement dimension resolution waterfall
- Create DecisionCoverageResult computation

### Phase 3: Refusal Policy

- Define RefusalCode enum and templates
- Implement decision tree logic
- Add RefusalPayload context

### Phase 4: Reasoning Pipeline

- Create 7-stage generator
- Implement SSE streaming endpoint
- Add clarification pause logic
- Implement "The Pause" (600-1000ms)

### Phase 5: Frontend Integration

- ReasoningStepper component
- Conditional answer branch UI
- Refusal with next-steps UI

---

## 9. Success Metrics

| Metric                                 | Current | Target           |
| -------------------------------------- | ------- | ---------------- |
| Strategic queries answered             | 0%      | >80%             |
| Conditional answers (partial coverage) | 0%      | Track            |
| Explicit refusals with next-steps      | ~10%    | >90% of failures |
| User trust rating ("feels researched") | N/A     | ≥4.0/5.0         |
| Hallucination on statutory facts       | Unknown | **0%**           |

---

## Appendix: Terminal Outcomes

| Outcome              | Condition                               | User Experience                        |
| -------------------- | --------------------------------------- | -------------------------------------- |
| `ANSWER`             | Required 100%, Optional 100%            | Confident answer with citations        |
| `CONDITIONAL_ANSWER` | Required 100%, Optional <100%           | Branching: "If X: A. If Y: B."         |
| `REFUSAL`            | Required <100% OR no rules OR gray zone | Clear message with next steps          |
| `ERROR`              | Infrastructure failure                  | Apologetic message with correlation ID |

---

_Document generated: 2025-12-27_
_Status: Approved for Implementation_
