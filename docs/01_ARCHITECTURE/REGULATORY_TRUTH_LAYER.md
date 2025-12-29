# Regulatory Truth Layer - Consolidated Architecture

> **Canonical Reference** - Last updated: 2025-12-28
>
> This document consolidates RTL architecture from scattered sources into a single reference.

## Table of Contents

1. [System Overview](#system-overview)
2. [Two-Layer Execution Model](#two-layer-execution-model)
3. [Agent Pipeline](#agent-pipeline)
4. [Worker Deployment Architecture](#worker-deployment-architecture)
5. [AppliesWhen DSL Reference](#applieswhen-dsl-reference)
6. [Graph Analysis & Cycle Detection](#graph-analysis--cycle-detection)
7. [Trust Guarantees](#trust-guarantees)
8. [Operational Runbook](#operational-runbook)

---

## System Overview

### Purpose

The Regulatory Truth Layer (RTL) is a **living regulatory operating system** for Croatia that:

- Synthesizes law, interpretation, procedure, and enforcement reality
- Is time-aware, versioned, and explainable
- Safely powers automation and AI assistance
- Provides a defensible "best current enforceable truth"

### Core Reality

Croatian compliance truth is **layered**:

| Layer             | Source           | Nature                      |
| ----------------- | ---------------- | --------------------------- |
| 1. Law            | Narodne novine   | Legally binding, fragmented |
| 2. Interpretation | Porezna uprava   | Enforcement reality         |
| 3. Procedures     | FINA, HZMO, HZZO | Technical requirements      |
| 4. Practice       | Inspections      | What actually passes        |

When law and enforcement diverge, **enforcement usually wins**.

### Architectural Principle

> **Truth is not retrieved. Truth is synthesized, versioned, and governed.**

RAG is a tool. Knowledge graphs are structure. **Governance is the moat.**

### Three-Store Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REGULATORY TRUTH LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   IMMUTABLE     │  │   TIME-AWARE    │  │    VECTOR       │     │
│  │   EVIDENCE      │  │   RULE GRAPH    │  │    STORE        │     │
│  │   STORE         │  │                 │  │                 │     │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤     │
│  │ • Raw snapshots │  │ • Synthesized   │  │ • Recall only   │     │
│  │ • Never edited  │  │   truth         │  │ • Never         │     │
│  │ • Content-hash  │  │ • Versioned     │  │   authoritative │     │
│  │ • Evidence +    │  │ • Conflict      │  │ • Semantic      │     │
│  │   Artifacts     │  │   resolution    │  │   search        │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
/src/lib/regulatory-truth/
├── agents/           # Core processing agents (6 main + specializations)
├── workers/          # BullMQ job processors
├── dsl/              # AppliesWhen predicate language
├── graph/            # Knowledge graph & cycle detection
├── taxonomy/         # Concept hierarchy & precedence rules
├── retrieval/        # Multi-engine query system
├── schemas/          # Zod validation schemas
├── utils/            # 50+ utility modules
├── watchdog/         # Health monitoring & alerting
├── fetchers/         # Specialized fetchers (NN, HNB, EurLex)
├── parsers/          # HTML/Sitemap/Binary parsers
├── quality/          # Coverage gates & health checks
├── data/             # Regulatory source definitions
├── prompts/          # Agent system prompts
├── scripts/          # 35+ operational CLI scripts
├── e2e/              # End-to-end testing framework
└── __tests__/        # Comprehensive test suites
```

---

## Two-Layer Execution Model

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER A                                     │
│                    DAILY DISCOVERY                                  │
│                                                                     │
│   ┌──────────┐     ┌──────────┐     ┌──────────────────────┐       │
│   │ Scheduler│────▶│ Sentinel │────▶│ Evidence Records     │       │
│   │ (Cron)   │     │ Agent    │     │ + Queue Jobs         │       │
│   └──────────┘     └──────────┘     └──────────────────────┘       │
│                                              │                      │
└──────────────────────────────────────────────┼──────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER B                                     │
│                    24/7 PROCESSING                                  │
│                                                                     │
│   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐       │
│   │ OCR │──▶│Extr.│──▶│Comp.│──▶│Rev. │──▶│Arb. │──▶│Rel. │       │
│   └─────┘   └─────┘   └─────┘   └─────┘   └─────┘   └─────┘       │
│                                                                     │
│   Continuous Drainer: Ensures all queues drain 24/7                │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer A: Daily Discovery

**Purpose:** Scan Croatian regulatory endpoints for new or changed content.

**Execution:**
- **Triggers:**
  - Cron schedule (06:00 Europe/Zagreb) - Polling
  - Webhooks/Push notifications - Real-time (NEW)
  - Adaptive re-scanning - Based on change velocity
  - Manual trigger - Via `runManually()`
- **Operator:** Scheduler service, Webhook receiver
- **Idempotency:** Same input produces same output

**Components:**
- **Scheduler Service** (`workers/scheduler.service.ts`) - Cron-based job scheduling
- **Sentinel Agent** (`agents/sentinel.ts`) - Scans discovery endpoints
- **Webhook Receiver** (`api/webhooks/regulatory-truth/route.ts`) - Receives push notifications (NEW)
- **Webhook Processor** (`webhooks/processor.ts`) - Processes webhook events (NEW)

**Discovery Methods:**

1. **Scheduled Polling** (Traditional)
   - Daily cron jobs
   - Adaptive re-scanning based on change velocity
   - Manual triggers

2. **Webhooks & Push Notifications** (NEW)
   - RSS/Atom feed subscriptions
   - Email alerts (forwarded)
   - HTTP webhooks from sources
   - Real-time discovery with <1 minute latency

**Data Flow:**
```
Scheduler → Sentinel → Evidence Records
                ↓
        PDF_SCANNED → OCR Queue
        PDF_TEXT    → Extract Queue
        HTML        → Extract Queue

Webhook → Processor → Evidence Records (same queue routing)
```

### Layer B: 24/7 Processing

**Purpose:** Process discovered evidence into validated regulatory rules.

**Execution:**
- **Trigger:** Queue-based (BullMQ with Redis)
- **Operator:** Worker containers (Docker)
- **Continuous:** Runs 24/7, processing as items arrive

**Key Benefits of Separation:**
- Discovery can run on schedule without blocking processing
- Processing continues 24/7 independent of discovery
- Each layer can scale independently
- Failures in one layer don't affect the other

---

## Agent Pipeline

### Complete Agent State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REGULATORY TRUTH PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DISCOVERY                                                                  │
│  ─────────                                                                  │
│  ┌──────────────┐                                                          │
│  │   SENTINEL   │  Scans regulatory endpoints                              │
│  │              │  Creates Evidence + classifies content                   │
│  └──────┬───────┘                                                          │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                          │
│  │ Evidence     │  rawContent: immutable                                   │
│  │ Record       │  contentClass: HTML | PDF_TEXT | PDF_SCANNED            │
│  └──────┬───────┘                                                          │
│         │                                                                   │
│         ├─────────────────┬──────────────────┐                             │
│         ▼                 ▼                  ▼                              │
│    PDF_SCANNED        PDF_TEXT            HTML                             │
│         │                 │                  │                              │
│         ▼                 │                  │                              │
│  ┌──────────────┐        │                  │                              │
│  │     OCR      │        │                  │                              │
│  │   WORKER     │        │                  │                              │
│  │              │        │                  │                              │
│  │ Tesseract +  │        │                  │                              │
│  │ Vision       │        │                  │                              │
│  │ fallback     │        │                  │                              │
│  └──────┬───────┘        │                  │                              │
│         │                 │                  │                              │
│         └────────────────┴──────────────────┘                              │
│                          │                                                  │
│                          ▼                                                  │
│  EXTRACTION                                                                │
│  ──────────                                                                │
│  ┌──────────────┐                                                          │
│  │  EXTRACTOR   │  LLM-based fact extraction                              │
│  │              │  Creates SourcePointer records                          │
│  │              │  Validates quotes against evidence                      │
│  └──────┬───────┘                                                          │
│         │                                                                   │
│         ▼                                                                   │
│  COMPOSITION                                                               │
│  ───────────                                                               │
│  ┌──────────────┐                                                          │
│  │   COMPOSER   │  Aggregates pointers into rules                         │
│  │              │  Creates RegulatoryRule (DRAFT)                         │
│  │              │  Detects conflicts                                      │
│  └──────┬───────┘                                                          │
│         │                                                                   │
│         ├──────────────────────────────┐                                   │
│         ▼                              ▼                                    │
│  ┌──────────────┐              ┌──────────────┐                            │
│  │   REVIEWER   │              │  Conflict    │                            │
│  │              │              │  Detected    │                            │
│  │ Quality      │              └──────┬───────┘                            │
│  │ checks &     │                     │                                    │
│  │ auto-approve │                     ▼                                    │
│  └──────┬───────┘              ┌──────────────┐                            │
│         │                      │   ARBITER    │                            │
│         │                      │              │                            │
│         │                      │ Conflict     │                            │
│         │                      │ resolution   │                            │
│         │                      └──────┬───────┘                            │
│         │                             │                                    │
│         └─────────────────────────────┘                                    │
│                          │                                                  │
│                          ▼                                                  │
│  PUBLICATION                                                               │
│  ───────────                                                               │
│  ┌──────────────┐                                                          │
│  │   RELEASER   │  Creates versioned Release                              │
│  │              │  Transitions rules to PUBLISHED                         │
│  │              │  Updates knowledge graph                                │
│  └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage 1: Sentinel (Discovery)

**File:** `agents/sentinel.ts`, `workers/sentinel.worker.ts`

**Purpose:** Fetch content from regulatory endpoints

**Process:**
1. Check discovery endpoints for new content
2. Fetch URLs and detect content type
3. Classify as HTML, PDF_TEXT, or PDF_SCANNED
4. Create Evidence record with immutable rawContent
5. Route to appropriate queue

**Configuration:**
```typescript
maxItemsPerRun: 100
maxPagesPerEndpoint: 50
maxSitemapDepth: 3
sitemapDelayMs: 1000
```

**Outputs:**
- `Evidence` record with `contentClass`
- `EvidenceArtifact` for PDF_TEXT (extracted text)
- Queue job for next stage

### Stage 1.5: OCR (Binary Preprocessing)

**File:** `workers/ocr.worker.ts`, `utils/ocr-processor.ts`

**Purpose:** Extract text from scanned PDFs

**Process:**
1. Render PDF pages to images (300 DPI)
2. Run Tesseract OCR with Croatian + English
3. Check confidence scores
4. Fallback to vision model if confidence < 70%
5. Create OCR_TEXT artifact

**Thresholds:**

| Threshold          | Value           | Action                    |
| ------------------ | --------------- | ------------------------- |
| Scanned detection  | < 50 chars/page | Route to OCR              |
| Tesseract accept   | ≥ 70% confidence| Skip vision fallback      |
| Garbage detection  | > 20% non-letters| Trigger vision fallback  |
| Manual review      | < 50% avg conf  | Flag for human review     |

**Outputs:**
- `EvidenceArtifact` with kind=OCR_TEXT
- `Evidence.ocrMetadata` with confidence, method
- `Evidence.primaryTextArtifactId` pointer

### Stage 2: Extractor (LLM Extraction)

**File:** `agents/extractor.ts`, `workers/extractor.worker.ts`

**Purpose:** Extract structured regulatory facts from text

**Shape-Specific Extractors:**
1. **Claim Extractor** - Atomic factual statements (VAT rate = 25%)
2. **Process Extractor** - Step-by-step procedures
3. **Reference Extractor** - Contact info, IBANs, account numbers
4. **Asset Extractor** - Forms, documents, downloadable resources
5. **Transitional Extractor** - Temporal rules (valid until X date)
6. **Comparison Extractor** - Decision matrices

**Output Schema:**
```typescript
{
  evidence_id: string
  extractions: [{
    id: string
    domain: string           // e.g., "pdv", "pausalni", "doprinosi"
    value_type: string       // PERCENTAGE, AMOUNT, DATE, TEXT
    extracted_value: string | number
    exact_quote: string      // MUST be verbatim from evidence
    article_number: string   // e.g., "Article 23, paragraph 2"
    confidence: number       // 0.0-1.0
  }]
}
```

**Key Invariant:** Every extraction must include `exact_quote` that exists verbatim in the source evidence.

### Stage 3: Composer (Rule Composition)

**File:** `agents/composer.ts`, `workers/composer.worker.ts`

**Purpose:** Compose regulatory rules from extracted facts

**Process:**
1. Aggregate related facts by concept
2. Compose draft rule with LLM
3. Create source pointers to evidence
4. Validate AppliesWhen DSL
5. Detect conflicts with existing rules

**Output Schema:**
```typescript
{
  rule: {
    concept_slug: string     // kebab-case (e.g., "pdv-standard-rate")
    title_hr: string
    risk_tier: "T0" | "T1" | "T2" | "T3"
    value: string
    authority_level: "LAW" | "GUIDANCE" | "PROCEDURE" | "PRACTICE"
    applies_when: string     // DSL JSON
    effective_from: string   // ISO date
    effective_until: string | null
    confidence: number
  }
}
```

**Conflict Detection:**
- VALUE_MISMATCH: Same concept, different values, overlapping dates
- DATE_OVERLAP: Temporal conflicts
- AUTHORITY_SUPERSEDE: Higher authority may override lower

### Stage 4: Reviewer (Quality Assurance)

**File:** `agents/reviewer.ts`, `workers/reviewer.worker.ts`

**Purpose:** Automated quality checks and approval decisions

**Auto-Approval Criteria (T2/T3 only):**
- Pending ≥ 24 hours (grace period)
- Confidence ≥ 0.90
- No open conflicts
- **T0/T1 ALWAYS require explicit human review**

**Outputs:**
- APPROVED → eligible for release
- REJECTED → removed from pipeline
- ESCALATE → human review queue

### Stage 5: Arbiter (Conflict Resolution)

**File:** `agents/arbiter.ts`, `workers/arbiter.worker.ts`

**Purpose:** Resolve conflicts between competing rules

**Resolution Strategies:**
```typescript
"RULE_A_PREVAILS"    // Rule A has higher authority
"RULE_B_PREVAILS"    // Rule B has higher authority
"MERGE_RULES"        // Create combined rule with conditions
"ESCALATE_TO_HUMAN"  // Cannot auto-resolve
```

**Authority Hierarchy:**
```
LAW (1) > GUIDANCE (2) > PROCEDURE (3) > PRACTICE (4)
```

**Precedence Principles:**
- Lex Specialis (specific overrides general)
- Lex Posterior (newer overrides older)
- Lex Superiori (higher authority overrides lower)

### Stage 6: Releaser (Publication)

**File:** `agents/releaser.ts`, `workers/releaser.worker.ts`

**Purpose:** Create versioned release bundles

**Versioning Strategy:**
```typescript
T0 (critical) → Major (e.g., 1.0.0 → 2.0.0)
T1 (high)     → Minor (e.g., 1.0.0 → 1.1.0)
T2/T3 (low)   → Patch (e.g., 1.0.0 → 1.0.1)
```

**Publish Gate Checks:**
1. Status = APPROVED (not DRAFT)
2. Has source pointers (evidence-backed)
3. No open conflicts
4. Confidence ≥ 0.70
5. Evidence strength ≥ SINGLE_SOURCE (or LAW authority)

**Outputs:**
- Creates Release + ReleaseRule records
- Transitions rules to PUBLISHED (immutable)
- Builds knowledge graph edges

### Rule Status Flow

```
                    ┌──────────────┐
                    │    DRAFT     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
            ┌───────│PENDING_REVIEW│───────┐
            │       └──────────────┘       │
            ▼                              ▼
     ┌──────────┐                   ┌──────────┐
     │ APPROVED │                   │ REJECTED │
     └────┬─────┘                   └──────────┘
          │
          ▼
     ┌──────────┐
     │PUBLISHED │  ← Immutable (create new rule to change)
     └──────────┘
```

---

## Worker Deployment Architecture

### Docker Compose Configuration

**File:** `docker-compose.workers.yml`

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb

  worker-orchestrator:      # Pipeline coordination
  worker-sentinel:          # Discovery (1 instance)
  worker-extractor:         # LLM extraction (2 replicas)
  worker-ocr:              # OCR processing (1 instance)
  worker-composer:          # Rule composition (1 instance)
  worker-reviewer:          # Quality review (1 instance)
  worker-arbiter:           # Conflict resolution (1 instance)
  worker-releaser:          # Publication (1 instance)
  worker-scheduler:         # Cron scheduling
  worker-continuous-drainer: # 24/7 queue draining
```

### Queue Configuration

| Queue    | Rate Limit | Concurrency | Notes                      |
| -------- | ---------- | ----------- | -------------------------- |
| sentinel | 10/min     | 1           | Respects source servers    |
| ocr      | 2/min      | 1           | CPU-intensive              |
| extract  | 5/min      | 2           | LLM-intensive              |
| compose  | 5/min      | 1           | LLM-intensive              |
| review   | 10/min     | 1           | Fast checks                |
| arbiter  | 5/min      | 1           | Conflict resolution        |
| release  | 10/min     | 1           | Fast publication           |

### Worker Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://fiskai-redis:6379

# LLM (for extractor, composer, reviewer, arbiter)
OLLAMA_ENDPOINT=https://...
OLLAMA_API_KEY=...
OLLAMA_MODEL=llama3.1

# OCR Vision fallback
OLLAMA_VISION_MODEL=llama3.2-vision

# Scheduler
WATCHDOG_TIMEZONE=Europe/Zagreb
```

### Deployment Topology

```
Coolify Server (152.53.146.3:8000)
├── Next.js App (fiskai.hr, app.fiskai.hr, staff.fiskai.hr, admin.fiskai.hr)
├── PostgreSQL (fiskai-db)
├── Redis (worker job queue)
└── Worker Services
    ├── worker-sentinel (1 instance)
    ├── worker-ocr (1 instance)
    ├── worker-extractor (2 replicas)
    ├── worker-composer (1 instance)
    ├── worker-reviewer (1 instance)
    ├── worker-arbiter (1 instance)
    ├── worker-releaser (1 instance)
    ├── worker-scheduler (1 instance)
    └── worker-continuous-drainer (1 instance)
```

---

## AppliesWhen DSL Reference

### Purpose

Defines context-aware applicability of rules. Replaces brittle boolean flags with composable logic.

### Predicate Types

```typescript
type AppliesWhenPredicate =
  | { op: "and"; args: AppliesWhenPredicate[] }
  | { op: "or"; args: AppliesWhenPredicate[] }
  | { op: "not"; arg: AppliesWhenPredicate }
  | { op: "cmp"; field: string; cmp: "eq"|"neq"|"gt"|"gte"|"lt"|"lte"; value: unknown }
  | { op: "in"; field: string; values: unknown[] }
  | { op: "exists"; field: string }
  | { op: "between"; field: string; gte?: unknown; lte?: unknown }
  | { op: "matches"; field: string; pattern: string }  // Regex
  | { op: "date_in_effect"; dateField: string; on?: string }
  | { op: "true" }   // Always applies
  | { op: "false" }  // Never applies
```

### Evaluation Context

```typescript
interface EvaluationContext {
  asOf: string  // ISO datetime
  entity: {
    type: "OBRT" | "DOO" | "JDOO" | "UDRUGA" | "OTHER"
    obrtSubtype?: "PAUSALNI" | "DOHODAS" | "DOBITAS"
    vat: { status: "IN_VAT" | "OUTSIDE_VAT" | "UNKNOWN" }
    activityNkd?: string
    location?: { country: "HR"; county?: string }
  }
  txn?: {
    kind: "SALE" | "PURCHASE" | "PAYMENT" | "PAYROLL" | "OTHER"
    b2b?: boolean
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER"
    amount?: number
    currency?: "EUR"
  }
  counters?: {
    revenueYtd?: number
    invoicesThisMonth?: number
  }
}
```

### Examples

**Rule applies to all pausalni businesses:**
```json
{
  "op": "and",
  "args": [
    { "op": "cmp", "field": "entity.type", "cmp": "eq", "value": "OBRT" },
    { "op": "cmp", "field": "entity.obrtSubtype", "cmp": "eq", "value": "PAUSALNI" }
  ]
}
```

**Rule applies to cash sales over 1000 EUR:**
```json
{
  "op": "and",
  "args": [
    { "op": "cmp", "field": "txn.kind", "cmp": "eq", "value": "SALE" },
    { "op": "in", "field": "txn.paymentMethod", "values": ["CASH", "CARD"] },
    { "op": "cmp", "field": "txn.amount", "cmp": "gt", "value": 1000 }
  ]
}
```

### Helper Functions

```typescript
import { predicates } from '@/lib/regulatory-truth/dsl/applies-when'

predicates.isObrt()           // Entity type = OBRT
predicates.isPausalni()       // OBRT + PAUSALNI subtype
predicates.isOutsideVat()     // VAT status = OUTSIDE_VAT
predicates.isCashSale()       // Sale + CASH or CARD payment
predicates.revenueExceeds(n)  // Revenue YTD > n
predicates.always()           // { op: "true" }
predicates.never()            // { op: "false" }
```

### Security

- **ReDoS protection:** Max regex length 100 chars, 50ms timeout
- **Fail-closed:** Invalid DSL rejects rule (doesn't become "always true")

---

## Graph Analysis & Cycle Detection

### Purpose

Prevent circular references in precedence relationships that would create logical paradoxes.

### Precedence Edge Types (Must Be Acyclic)

```typescript
SUPERSEDES    // Newer rule replaces older (temporal ordering)
OVERRIDES     // Specific rule > general rule (lex specialis)
AMENDS        // Rule modifies another rule
DEPENDS_ON    // Rule depends on another's evaluation
REQUIRES      // Rule requires another to be satisfied
```

### Non-Precedence Edge Types (Allowed Cycles)

```typescript
CITED_IN      // Rule cites another (informational)
INTERPRETS    // Rule interprets another (guidance)
RELATED_TO    // General relationship
```

### Cycle Detection Algorithm

**File:** `graph/cycle-detection.ts`

Uses BFS from target to source:
1. If adding edge A→B, check if path exists from B to A
2. If path exists, adding A→B would create cycle
3. Throws `CycleDetectedError` if detected

```typescript
import { wouldCreateCycle, createEdgeWithCycleCheck } from '@/lib/regulatory-truth/graph/cycle-detection'

// Check before creating
if (await wouldCreateCycle(fromId, toId, 'SUPERSEDES')) {
  // Handle cycle prevention
}

// Or create with automatic check
await createEdgeWithCycleCheck({
  fromRuleId: 'rule-a',
  toRuleId: 'rule-b',
  relation: 'SUPERSEDES',
  validFrom: new Date(),
})
```

### Graph Validation

```typescript
import { validateGraphAcyclicity, findPath } from '@/lib/regulatory-truth/graph/cycle-detection'

// Validate entire graph
const result = await validateGraphAcyclicity()
// { isValid: true/false, cycleNodes?: string[], edgeCount, nodeCount }

// Find path between rules (debugging)
const path = await findPath(fromId, toId)
// ['rule-a', 'rule-b', 'rule-c'] or null
```

---

## Trust Guarantees

### 1. Evidence-Backed Claims

**Guarantee:** Every regulatory claim links to source evidence.

**Implementation:**
- `RuleSourcePointer` links rules to `Evidence` records
- `Evidence.rawContent` contains immutable source material
- Citations include source URL, fetch timestamp, content hash

**Verification:**
- No rule can be published without at least one source pointer
- Orphaned rules trigger arbiter review

### 2. No Hallucination

**Guarantee:** LLM-extracted content is verified against source.

**Implementation:**
- Extractor compares output against evidence text
- `exact_quote` must exist verbatim in source
- Confidence scores below threshold trigger re-extraction
- Human review queue for ambiguous content

### 3. Fail-Closed Operation

**Guarantee:** System fails safely when uncertain.

**Implementation:**
- Unresolvable conflicts → human arbiter queue
- Missing evidence → extraction blocked
- Low confidence OCR → vision fallback → human review
- Invalid AppliesWhen DSL → rule rejected

### 4. Immutable Evidence

**Guarantee:** Source evidence cannot be modified after capture.

**Implementation:**
- `Evidence.rawContent` is never updated after creation
- Derived text stored in separate `EvidenceArtifact` table
- Content hash computed at fetch time
- Re-fetch creates new evidence record if content changed

### 5. Deterministic Processing

**Guarantee:** Same input produces same output.

**Implementation:**
- Idempotent job processing
- Content hash for deduplication
- Stable LLM prompts with structured output
- Deterministic conflict detection

### Trust Metrics

| Metric            | Target | Description                         |
| ----------------- | ------ | ----------------------------------- |
| Source Coverage   | 100%   | All rules have evidence             |
| Citation Accuracy | 100%   | Citations resolve to valid URLs     |
| Confidence Floor  | 70%    | Minimum OCR/extraction confidence   |
| Human Review Rate | <5%    | Items requiring manual intervention |

---

## Operational Runbook

### Starting Workers

```bash
# Start all workers
docker compose -f docker-compose.workers.yml up -d

# Start specific worker
docker compose -f docker-compose.workers.yml up -d worker-extractor

# View logs
docker logs fiskai-worker-extractor --tail 100 -f
```

### Queue Status

```bash
# Check all queue depths
npx tsx src/lib/regulatory-truth/scripts/queue-status.ts

# Database status
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT status, COUNT(*) FROM \"RegulatoryRule\" GROUP BY status"

docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT \"contentClass\", COUNT(*) FROM \"Evidence\" GROUP BY \"contentClass\""
```

### Running Individual Agents

```bash
# Sentinel (discovery)
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch

# Extractor
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts [evidenceId]

# Composer
npx tsx src/lib/regulatory-truth/scripts/run-composer.ts [pointerIds...]

# Reviewer
npx tsx src/lib/regulatory-truth/scripts/run-reviewer.ts [ruleId]

# Arbiter
npx tsx src/lib/regulatory-truth/scripts/run-arbiter.ts [conflictId]

# Releaser
npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts [ruleIds...]
```

### Monitoring & Health

```bash
# Real-time monitoring
npx tsx src/lib/regulatory-truth/scripts/monitor.ts --priority T0

# Coverage metrics
npx tsx src/lib/regulatory-truth/scripts/coverage-cli.ts

# Health gates status
npx tsx src/lib/regulatory-truth/scripts/health-gates.ts

# Verify evidence immutability
npx tsx src/lib/regulatory-truth/scripts/verify-immutability.ts
```

### Troubleshooting

#### Stuck Jobs

```bash
# Clean up stuck runs
npx tsx src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts

# Check for duplicates
npx tsx src/lib/regulatory-truth/scripts/check-duplicates.ts
```

#### OCR Issues

1. Check confidence in `Evidence.ocrMetadata`
2. If confidence < 70%, vision fallback should have triggered
3. For persistent issues, check Vision model availability

```bash
# Test OCR on specific evidence
npx tsx src/lib/regulatory-truth/scripts/run-ocr.ts [evidenceId]
```

#### Extraction Failures

1. Check if evidence has text artifact
2. Verify content cleaner isn't removing too much
3. Check LLM endpoint availability

```bash
# Test content cleaner
npx tsx src/lib/regulatory-truth/scripts/test-content-cleaner.ts [url]
```

#### Pipeline Backlog

```bash
# Run overnight pipeline (full drain)
npx tsx src/lib/regulatory-truth/scripts/overnight-run.ts

# Drain specific stage
npx tsx src/lib/regulatory-truth/scripts/drain-pipeline.ts --stage extract
```

### Manual Triggers

```bash
# Trigger manual digest
npx tsx -e "
import { sendRegulatoryTruthDigest } from './src/lib/regulatory-truth/watchdog/resend-email'
sendRegulatoryTruthDigest().then(console.log)
"

# Trigger health snapshot
npx tsx -e "
import { storeTruthHealthSnapshot } from './src/lib/regulatory-truth/utils/truth-health'
storeTruthHealthSnapshot().then(console.log)
"
```

### Scheduled Jobs

All jobs run in Europe/Zagreb timezone:

| Job                  | Time        | Purpose                           |
| -------------------- | ----------- | --------------------------------- |
| Health Snapshot      | 00:00       | Collect health metrics            |
| Confidence Decay     | 03:00 Sun   | Weekly confidence score decay     |
| Consolidation Audit  | 04:00       | Check for duplicates/leakage      |
| E2E Validation       | 05:00       | Full pipeline validation          |
| Morning Discovery    | 06:00       | Sentinel scans                    |
| Daily Digest         | 07:00       | Email health report               |

### Alert Severity Levels

| Severity | Routing                | Examples                           |
| -------- | ---------------------- | ---------------------------------- |
| CRITICAL | Slack + Email + Resend | Pipeline failure, test data leak   |
| WARNING  | Email digest only      | High unlinked pointers             |
| INFO     | Logged only            | Normal operations                  |

### Webhook Management

**View webhook subscriptions:**

```bash
# List all active subscriptions
npx tsx -e "
import { db } from './src/lib/db'
const subs = await db.webhookSubscription.findMany({
  where: { isActive: true },
  include: { source: true }
})
console.table(subs)
"
```

**Check webhook events:**

```bash
# View recent webhook events
npx tsx -e "
import { db } from './src/lib/db'
const events = await db.webhookEvent.findMany({
  where: { status: 'PENDING' },
  take: 10,
  orderBy: { receivedAt: 'desc' }
})
console.table(events)
"
```

**Process pending webhook events:**

```bash
# Manually process a webhook event
npx tsx -e "
import { processWebhookEvent } from './src/lib/regulatory-truth/webhooks/processor'
await processWebhookEvent('<event-id>')
"
```

**Test webhook endpoint:**

```bash
# Send test webhook
curl -X POST 'https://fiskai.hr/api/webhooks/regulatory-truth?provider=test' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.hr/test.pdf", "title": "Test"}'
```

---

## Related Documentation

- [Pipeline Details](../05_REGULATORY/PIPELINE.md)
- [Monitoring & Alerting](../05_REGULATORY/monitoring-alerting.md)
- [Webhook Setup Guide](../05_REGULATORY/WEBHOOK_SETUP.md) (NEW)
- [Trust Guarantees](./trust-guarantees.md)
- [Two-Layer Model](./two-layer-model.md)
- [System Invariants](../_meta/invariants.md)

---

## Appendix: Core Data Models

### Evidence

```typescript
{
  id: string
  sourceId: string           // RegulatorySource FK
  url: string
  rawContent: string         // IMMUTABLE - original fetched content
  contentHash: string        // SHA256 for deduplication
  contentClass: string       // HTML, PDF_TEXT, PDF_SCANNED
  ocrMetadata?: {
    method: "TESSERACT" | "VISION" | "HYBRID"
    confidence: number
    pageConfidences: number[]
  }
  artifacts: EvidenceArtifact[]
}
```

### RegulatoryRule

```typescript
{
  id: string
  conceptSlug: string        // Unique identifier (kebab-case)
  titleHr: string
  summaryHr: string
  detailsHr: string
  value: string
  valueType: string
  effectiveFrom: Date
  effectiveUntil?: Date
  riskTier: "T0" | "T1" | "T2" | "T3"
  authorityLevel: "LAW" | "GUIDANCE" | "PROCEDURE" | "PRACTICE"
  appliesWhen: string        // JSON DSL
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "REJECTED"
  confidence: number
  sourcePointers: RuleSourcePointer[]
}
```

### RuleSourcePointer

```typescript
{
  id: string
  ruleId: string
  evidenceId: string
  quotedText: string         // Exact text from source
  articleRef?: string        // "Article 23, paragraph 2"
  confidence: number         // 0-100
  extractionMethod: string   // LLM model used
}
```

### GraphEdge

```typescript
{
  id: string
  fromRuleId: string
  toRuleId: string
  relation: GraphEdgeType    // SUPERSEDES, OVERRIDES, AMENDS, etc.
  validFrom: Date
  validTo?: Date
  notes?: string
}
```
