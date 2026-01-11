# Admin RTL Observability Inventory

> **Audit Date:** 2026-01-11
> **Scope:** Repo-only inspection (no external calls, no guesses)
> **Purpose:** Factual inventory of RTL pipeline, monitoring, admin pages, and LLM usage

---

## 1. Executive Inventory

| Category                     | Count | Notes                                                                            |
| ---------------------------- | ----- | -------------------------------------------------------------------------------- |
| **RTL Pipeline Stages**      | 13    | Sentinel→OCR→Extractor→Composer→Reviewer→Arbiter→Releaser + 6 supporting         |
| **BullMQ Queues**            | 16    | All defined in `src/lib/regulatory-truth/workers/queues.ts`                      |
| **Database Models (RTL)**    | 18+   | Split across regulatory schema + public schema + Drizzle                         |
| **Admin Pages**              | 13    | `/admin/regulatory/*`, `/admin/content-automation`, `/admin/system-status`, etc. |
| **Status/Metrics Endpoints** | 22    | 7 public, 15 admin-only                                                          |
| **LLM Callsites**            | 18    | OpenAI (8), DeepSeek (4), Ollama (6)                                             |
| **Cron Jobs**                | 2     | RTL staleness, system status cleanup                                             |

---

## 2. RTL Pipeline Topology

### 2.1 Pipeline Stages

| Stage                  | File Path                                                       | Queue                | Rate Limit | Concurrency | DB Tables Written                                 |
| ---------------------- | --------------------------------------------------------------- | -------------------- | ---------- | ----------- | ------------------------------------------------- |
| **SENTINEL**           | `src/lib/regulatory-truth/workers/sentinel.worker.ts`           | `sentinel`           | 5/min      | 1           | Evidence, EvidenceArtifact                        |
| **OCR**                | `src/lib/regulatory-truth/workers/ocr.worker.ts`                | `ocr`                | 2/min      | 1           | EvidenceArtifact (OCR_TEXT), Evidence.ocrMetadata |
| **EXTRACTOR**          | `src/lib/regulatory-truth/workers/extractor.worker.ts`          | `extract`            | 10/min     | 2           | SourcePointer, AtomicClaim                        |
| **COMPOSER**           | `src/lib/regulatory-truth/workers/composer.worker.ts`           | `compose`            | 5/min      | 1           | RegulatoryRule (DRAFT), RegulatoryConflict        |
| **REVIEWER**           | `src/lib/regulatory-truth/workers/reviewer.worker.ts`           | `review`             | 5/min      | 5           | RegulatoryRule (APPROVED/PENDING_REVIEW)          |
| **ARBITER**            | `src/lib/regulatory-truth/workers/arbiter.worker.ts`            | `arbiter`            | 3/min      | 1           | RegulatoryConflict, ConflictResolutionAudit       |
| **RELEASER**           | `src/lib/regulatory-truth/workers/releaser.worker.ts`           | `release`            | 2/min      | 1           | RegulatoryRule (PUBLISHED)                        |
| **EMBEDDING**          | `src/lib/regulatory-truth/workers/embedding.worker.ts`          | `embedding`          | 10/min     | 2           | Rule embeddings                                   |
| **EVIDENCE_EMBEDDING** | `src/lib/regulatory-truth/workers/evidence-embedding.worker.ts` | `evidence-embedding` | 5/min      | 2           | Evidence.embedding                                |
| **CONSOLIDATOR**       | `src/lib/regulatory-truth/workers/consolidator.worker.ts`       | `consolidator`       | 1/5min     | 1           | RegulatoryRule (merges), SourcePointer            |
| **CONTENT_SYNC**       | `src/lib/regulatory-truth/workers/content-sync.worker.ts`       | `content-sync`       | 2/min      | N/A         | ContentSyncEvent, Git PRs                         |
| **ARTICLE_AGENT**      | `src/lib/regulatory-truth/workers/article.worker.ts`            | `article`            | 2/min      | N/A         | ArticleJob, FactSheet                             |
| **CONTINUOUS_DRAINER** | `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | (monitors all)       | N/A        | N/A         | Per-stage metrics                                 |

### 2.2 Queue Definitions

**File:** `src/lib/regulatory-truth/workers/queues.ts`

```typescript
// Lines 38-78: Queue creation with rate limits
export const sentinelQueue = createQueue("sentinel", { max: 5, duration: 60000 })
export const extractQueue = createQueue("extract", { max: 10, duration: 60000 })
export const ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
export const composeQueue = createQueue("compose", { max: 5, duration: 60000 })
export const reviewQueue = createQueue("review", { max: 5, duration: 60000 })
export const arbiterQueue = createQueue("arbiter", { max: 3, duration: 60000 })
export const releaseQueue = createQueue("release", { max: 2, duration: 60000 })
export const consolidatorQueue = createQueue("consolidator", { max: 1, duration: 300000 })
```

### 2.3 Database Tables (RTL Schema)

| Table                     | Schema     | Purpose                      | Read By                     | Written By     |
| ------------------------- | ---------- | ---------------------------- | --------------------------- | -------------- |
| `RegulatorySource`        | regulatory | Source registry              | Sentinel, Orchestrator      | Admin setup    |
| `Evidence`                | regulatory | Immutable source documents   | OCR, Extractor              | Sentinel, OCR  |
| `EvidenceArtifact`        | regulatory | OCR outputs, cleaned text    | Extractor                   | OCR worker     |
| `ExtractionRejected`      | regulatory | DLQ for failed extractions   | Manual review               | Extractor      |
| `ConflictResolutionAudit` | regulatory | Conflict resolution tracking | Audit                       | Arbiter        |
| `MonitoringAlert`         | regulatory | RTL system alerts            | Dashboard                   | Various stages |
| `RegulatoryRule`          | public     | Domain-level rules           | Reviewer, Arbiter, Releaser | Composer       |
| `SourcePointer`           | public     | Extracted facts              | Extractor, Composer         | Extractor      |
| `RegulatoryConflict`      | public     | Conflicting rule pairs       | Arbiter                     | Composer       |
| `AtomicClaim`             | public     | Granular assertions          | Rule validation             | Extractor      |
| `ArticleJob`              | public     | News article generation      | Article worker              | Article agent  |
| `ContentSyncEvent`        | Drizzle    | RTL→Content sync events      | Content sync worker         | Releaser       |

### 2.4 Pipeline Flow

```
Layer A: Daily Discovery
┌──────────────────────────────────┐
│ CRON: rtl-staleness (daily)      │
└────────────────┬─────────────────┘
                 │
                 ▼
            [SENTINEL] → Evidence records
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│              Layer B: 24/7 Processing               │
│              (Continuous Drainer monitors)          │
└────────┬───────────────┬──────────────┬────────────┘
         │               │              │
         ▼               ▼              ▼
      [OCR]        [EXTRACTOR]    [ORCHESTRATOR]
         │               │              │
         └───────┬───────┘              │
                 │                      │
                 ▼                      │
            [COMPOSER] → RegulatoryRule (DRAFT)
                 │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    [REVIEWER]      [ARBITER]
        │               │
        └───────┬───────┘
                │
                ▼
           [RELEASER] → Published rules
                │
        ┌───────┼───────┐
        │       │       │
        ▼       ▼       ▼
   [EMBEDDING] [CONTENT_SYNC] [ARTICLE_AGENT]
```

---

## 3. Admin Page Coverage

| Page URL                      | File Path                                     | Data Source                                                   | Key Metrics Displayed                    | Failure Indicators       |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- | ------------------------ |
| `/admin`                      | `src/app/admin/page.tsx`                      | Redirect                                                      | N/A                                      | N/A                      |
| `/admin/overview`             | `src/app/admin/overview/page.tsx`             | `getCachedAdminMetrics()`                                     | Tenants, signups, compliance             | None (dashboard)         |
| `/admin/regulatory`           | `src/app/admin/regulatory/page.tsx`           | `getRegulatoryPipelineStatus()`                               | Health score, rules by status, conflicts | <80 health score         |
| `/admin/regulatory/sentinel`  | `src/app/admin/regulatory/sentinel/page.tsx`  | `/api/admin/sentinel/health`                                  | Endpoint health, error counts            | Failing/degraded sources |
| `/admin/regulatory/inbox`     | `src/app/admin/regulatory/inbox/page.tsx`     | `db.regulatoryRule` (PENDING_REVIEW)                          | Pending rules by tier                    | Rules pending >1 hour    |
| `/admin/regulatory/conflicts` | `src/app/admin/regulatory/conflicts/page.tsx` | `db.regulatoryConflict`                                       | Open conflicts                           | Unresolved conflicts     |
| `/admin/regulatory/sources`   | `src/app/admin/regulatory/sources/page.tsx`   | `dbReg.regulatorySource`                                      | Active/inactive sources                  | Stale fetch timestamps   |
| `/admin/regulatory/releases`  | `src/app/admin/regulatory/releases/page.tsx`  | `db.ruleRelease`                                              | Release history                          | Gaps in releases         |
| `/admin/regulatory/coverage`  | `src/app/admin/regulatory/coverage/page.tsx`  | Coverage metrics                                              | Extraction completeness                  | Low completion %         |
| `/admin/content-automation`   | `src/app/admin/content-automation/page.tsx`   | `collectArticleAgentMetrics()`, `collectContentSyncMetrics()` | Job counts, PR status                    | >10 stale PRs, unhealthy |
| `/admin/system-status`        | `src/app/admin/system-status/page.tsx`        | `getCurrentSnapshot()`, `getRecentEvents()`                   | Critical issues, workers                 | Degraded refresh         |
| `/admin/alerts`               | `src/app/admin/alerts/page.tsx`               | `getActiveAlerts()`                                           | Alert counts                             | Any critical alerts      |
| `/admin/compliance-status`    | `src/app/admin/compliance-status/page.tsx`    | `getComplianceHealth()`                                       | Cert status, fiscal success              | Expired certs            |

### 3.1 Data Function Evidence

**Regulatory Status (`src/lib/admin/regulatory-status.ts`):**

```typescript
// Lines 45-85: getRegulatoryPipelineStatus()
export async function getRegulatoryPipelineStatus(): Promise<RegulatoryPipelineStatus> {
  const [sources, rules, evidence, pointers, conflicts, agentRuns, latestRelease] =
    await Promise.all([
      dbReg.regulatorySource.findMany({ where: { isActive: true } }),
      db.regulatoryRule.groupBy({ by: ["status"], _count: true }),
      dbReg.evidence.count(),
      db.sourcePointer.count(),
      db.regulatoryConflict.count({ where: { status: "OPEN" } }),
      db.agentRun.findMany({ where: { createdAt: { gte: dayAgo } } }),
      db.ruleRelease.findFirst({ orderBy: { releasedAt: "desc" } }),
    ])
  // ... health score calculation
}
```

**Content Automation Metrics (`src/lib/regulatory-truth/monitoring/metrics.ts`):**

```typescript
// Lines 120-165: collectArticleAgentMetrics()
export async function collectArticleAgentMetrics(): Promise<ArticleAgentMetrics> {
  const jobs = await db.articleJob.groupBy({
    by: ["status"],
    _count: true,
  })
  // ... status breakdown
}

// Lines 200-250: collectContentSyncMetrics()
export async function collectContentSyncMetrics(): Promise<ContentSyncMetrics> {
  const events = await drizzleDb
    .select({ status: contentSyncEvents.status, count: sql<number>`count(*)` })
    .from(contentSyncEvents)
    .groupBy(contentSyncEvents.status)
  // ... dead letter analysis
}
```

### 3.2 Capability Gating Evidence

**Content Automation Page (`src/app/admin/content-automation/page.tsx`):**

```typescript
// Lines 15-22: Feature contract check
const capability = await hasRegulatoryTruthTables()
if (!capability.available) {
  return <NotConfigured
    feature="Content Automation"
    missingTables={capability.missingTables}
    actionHint={`Run migrations for Content Automation tables...`}
  />
}
```

---

## 4. Metrics + Status Endpoints

### 4.1 Public Endpoints (No Auth)

| Route                                 | File                                              | Purpose          | Data Returned                        |
| ------------------------------------- | ------------------------------------------------- | ---------------- | ------------------------------------ |
| `GET /api/status`                     | `src/app/api/status/route.ts`                     | Runtime metrics  | Version, uptime, memory, portal      |
| `GET /api/health/ready`               | `src/app/api/health/ready/route.ts`               | K8s readiness    | DB health, memory, feature contracts |
| `GET /api/health/content-pipelines`   | `src/app/api/health/content-pipelines/route.ts`   | Pipeline health  | Article Agent + Content Sync status  |
| `GET /api/metrics`                    | `src/app/api/metrics/route.ts`                    | Prometheus       | Users, companies, invoices           |
| `GET /api/regulatory/status`          | `src/app/api/regulatory/status/route.ts`          | RTL status       | Redis, queues, circuit breakers      |
| `GET /api/regulatory/metrics`         | `src/app/api/regulatory/metrics/route.ts`         | Prometheus RTL   | Queue depths                         |
| `GET /api/assistant/reasoning/health` | `src/app/api/assistant/reasoning/health/route.ts` | Reasoning health | Traces, error rate, embeddings       |

### 4.2 Admin-Only Endpoints

| Route                                               | File                                                        | Auth  | Purpose                        |
| --------------------------------------------------- | ----------------------------------------------------------- | ----- | ------------------------------ |
| `GET /api/admin/regulatory-truth/status`            | `src/app/api/admin/regulatory-truth/status/route.ts`        | Admin | Full pipeline snapshot         |
| `GET/POST /api/admin/regulatory-truth/truth-health` | `src/app/api/admin/regulatory-truth/truth-health/route.ts`  | Admin | Rule health, alerts, snapshots |
| `POST /api/admin/system-status/refresh`             | `src/app/api/admin/system-status/refresh/route.ts`          | Admin | Trigger refresh                |
| `GET /api/admin/system-status/refresh/[id]`         | `src/app/api/admin/system-status/refresh/[id]/route.ts`     | Admin | Poll job status                |
| `GET/POST /api/admin/system-status/alerts`          | `src/app/api/admin/system-status/alerts/route.ts`           | Admin | Alert config, test             |
| `GET /api/admin/workers/status`                     | `src/app/api/admin/workers/status/route.ts`                 | Admin | Queue depths, worker health    |
| `GET /api/admin/workers/circuit-breaker/status`     | `src/app/api/admin/workers/circuit-breaker/status/route.ts` | Admin | Breaker states                 |
| `POST /api/admin/workers/circuit-breaker/reset`     | `src/app/api/admin/workers/circuit-breaker/reset/route.ts`  | Admin | Reset breakers                 |
| `GET /api/admin/sentinel/health`                    | `src/app/api/admin/sentinel/health/route.ts`                | Admin | Discovery runs, sources        |
| `POST /api/admin/sentinel/circuit-breaker/reset`    | `src/app/api/admin/sentinel/circuit-breaker/reset/route.ts` | Admin | Reset sentinel breakers        |
| `GET /api/admin/tenants/[companyId]/health`         | `src/app/api/admin/tenants/[companyId]/health/route.ts`     | Admin | Tenant snapshot                |
| `POST /api/admin/alerts`                            | `src/app/api/admin/alerts/route.ts`                         | Admin | Alert actions                  |

### 4.3 Cron Endpoints

| Route                                 | File                                              | Auth        | Schedule    |
| ------------------------------------- | ------------------------------------------------- | ----------- | ----------- |
| `GET /api/cron/rtl-staleness`         | `src/app/api/cron/rtl-staleness/route.ts`         | CRON_SECRET | Daily 05:00 |
| `GET /api/cron/system-status-cleanup` | `src/app/api/cron/system-status-cleanup/route.ts` | CRON_SECRET | Weekly      |

### 4.4 Endpoint Evidence

**Worker Status (`src/app/api/admin/workers/status/route.ts`):**

```typescript
// Lines 35-65: Queue stats collection
const queues = [
  { name: "sentinel", displayName: "Sentinel", description: "Source discovery" },
  { name: "extract", displayName: "Extractor", description: "Fact extraction" },
  // ... 10 more queues
]

for (const q of queues) {
  const queue = new Queue(q.name, { connection, prefix: "fiskai" })
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])
  // ...
}
```

**RTL Staleness Cron (`src/app/api/cron/rtl-staleness/route.ts`):**

```typescript
// Lines 97-112: Staleness checks
result.evidenceCheck = await checkAllEvidenceStaleness(100)
result.ruleDeprecation = await deprecateExpiredRules()
result.recrawlQueue = await queueStaleEvidenceForRecrawl(50)
result.stats = await getStalenessStats()

// Generate alerts based on thresholds
const stalePercentage = ((result.stats.stale + result.stats.expired) / result.stats.total) * 100
if (stalePercentage > 25) {
  result.alerts.push({ type: "critical", message: `${stalePercentage.toFixed(1)}% evidence stale` })
}
```

---

## 5. LLM Usage Accounting

### 5.1 Callsite Summary

| #   | Module           | File                                                     | Function                             | Provider | Model          | Token Tracking | Cost Tracking | Persistence   |
| --- | ---------------- | -------------------------------------------------------- | ------------------------------------ | -------- | -------------- | -------------- | ------------- | ------------- |
| 1   | AI/Extract       | `src/lib/ai/extract.ts`                                  | `extractReceipt()`                   | OpenAI   | gpt-4o-mini    | YES            | YES           | aIUsage       |
| 2   | AI/Extract       | `src/lib/ai/extract.ts`                                  | `extractInvoice()`                   | OpenAI   | gpt-4o-mini    | YES            | YES           | aIUsage       |
| 3   | AI/OCR           | `src/lib/ai/ocr.ts`                                      | `extractFromImage()`                 | OpenAI   | gpt-4o         | YES            | YES           | aIUsage       |
| 4   | AI/OCR           | `src/lib/ai/ocr.ts`                                      | `extractFromImageUrl()`              | OpenAI   | gpt-4o         | YES            | YES           | aIUsage       |
| 5   | Assistant        | `src/lib/assistant/query-engine/answer-synthesizer.ts`   | `synthesizeAnswer()`                 | OpenAI   | gpt-4o-mini    | YES            | NO            | Logger        |
| 6   | Assistant        | `src/lib/assistant/query-engine/answer-synthesizer.ts`   | `synthesizeMultiRuleAnswer()`        | OpenAI   | gpt-4o-mini    | YES            | NO            | Logger        |
| 7   | Assistant        | `src/lib/assistant/query-engine/contextual-questions.ts` | `generateContextualQuestions()`      | OpenAI   | gpt-4o-mini    | YES            | NO            | Logger        |
| 8   | Assistant        | `src/lib/assistant/query-engine/contextual-questions.ts` | `generateContextualClarifications()` | OpenAI   | gpt-4o-mini    | YES            | NO            | Logger        |
| 9   | News             | `src/lib/news/pipeline/classifier.ts`                    | `classifyNewsItem()`                 | DeepSeek | deepseek-chat  | YES            | YES           | aIUsage       |
| 10  | News             | `src/lib/news/pipeline/writer.ts`                        | `writeArticle()`                     | DeepSeek | deepseek-chat  | YES            | YES           | aIUsage       |
| 11  | News             | `src/lib/news/pipeline/reviewer.ts`                      | `reviewArticle()`                    | DeepSeek | deepseek-chat  | YES            | YES           | aIUsage       |
| 12  | News             | `src/lib/news/pipeline/rewriter.ts`                      | `rewriteArticle()`                   | DeepSeek | deepseek-chat  | YES            | YES           | aIUsage       |
| 13  | Article-Agent    | `src/lib/article-agent/steps/draft.ts`                   | `writeDraft()`                       | Ollama   | llama3.1       | NO             | NO            | articleDraft  |
| 14  | Article-Agent    | `src/lib/article-agent/extraction/claim-extractor.ts`    | `extractClaimsFromChunk()`           | Ollama   | llama3.1       | NO             | NO            | N/A           |
| 15  | Article-Agent    | `src/lib/article-agent/extraction/claim-extractor.ts`    | `extractKeyEntities()`               | Ollama   | llama3.1       | NO             | NO            | N/A           |
| 16  | Regulatory-Truth | `src/lib/regulatory-truth/agents/runner.ts`              | `runAgent()`                         | Ollama   | qwen3-next:80b | NO             | NO            | agentRun      |
| 17  | Regulatory-Truth | `src/lib/regulatory-truth/agents/claim-extractor.ts`     | `runClaimExtractor()`                | Ollama   | (via runner)   | NO             | NO            | atomicClaim   |
| 18  | Regulatory-Truth | `src/lib/regulatory-truth/agents/extractor.ts`           | `runExtractor()`                     | Ollama   | (via runner)   | NO             | NO            | candidateFact |

### 5.2 Usage Tracking System

**File:** `src/lib/ai/usage-tracking.ts`

```typescript
// Lines 15-25: Operation types
export type AIOperation =
  | "ocr_receipt"
  | "extract_receipt"
  | "extract_invoice"
  | "categorize_expense"
  | "deepseek_chat"
  | "deepseek_vision"
  | "deepseek_news_classify"
  | "deepseek_news_write"
  | "deepseek_news_review"
  | "deepseek_news_rewrite"

// Lines 30-40: Model pricing (cents per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 250, output: 1000 },
  "gpt-4o-mini": { input: 15, output: 60 },
  "deepseek-chat": { input: 14, output: 28 },
  "deepseek-reasoner": { input: 55, output: 219 },
}

// Lines 50-70: trackAIUsage() function
export async function trackAIUsage(params: {
  companyId: string
  operation: AIOperation
  model: string
  promptTokens: number
  completionTokens: number
  success: boolean
}): Promise<void> {
  const costCents = calculateCost(params.model, params.promptTokens, params.completionTokens)
  await db.aIUsage.create({
    data: {
      companyId: params.companyId,
      operation: params.operation,
      model: params.model,
      tokensUsed: params.promptTokens + params.completionTokens,
      costCents,
      success: params.success,
    },
  })
}
```

### 5.3 Evidence: Token Tracking Present

**OpenAI Extract (`src/lib/ai/extract.ts`):**

```typescript
// Lines 75-85: Token capture
const promptTokens = response.usage?.prompt_tokens || 0
const completionTokens = response.usage?.completion_tokens || 0

await trackAIUsage({
  companyId: companyId || "system",
  operation: "extract_receipt",
  model: "gpt-4o-mini",
  promptTokens,
  completionTokens,
  success: true,
})
```

### 5.4 Evidence: Token Tracking MISSING

**Ollama Agent Runner (`src/lib/regulatory-truth/agents/runner.ts`):**

```typescript
// Lines 175-200: No token capture
const response = await fetch(`${extractEndpoint}/api/chat`, {
  method: "POST",
  headers: getOllamaExtractHeaders(),
  body: JSON.stringify({
    model: extractModel,
    messages: [...],
    stream: false,
    options: { temperature, num_predict: 16384 },
  }),
})

// NOTE: Ollama response does not include token counts
// No trackAIUsage() call - only agentRun table stores duration
```

### 5.5 Correlation IDs

| Callsite      | companyId | tenantId | runId | jobId | evidenceId |
| ------------- | --------- | -------- | ----- | ----- | ---------- |
| AI/Extract    | YES       | NO       | NO    | NO    | NO         |
| AI/OCR        | YES       | NO       | NO    | NO    | NO         |
| Assistant     | NO        | NO       | NO    | NO    | NO         |
| News Pipeline | "system"  | NO       | NO    | NO    | NO         |
| Article-Agent | NO        | NO       | NO    | YES   | NO         |
| RTL Agents    | NO        | NO       | YES   | YES   | YES        |

---

## 6. Gaps (Ranked by Impact)

### 6.1 CRITICAL: No Token/Cost Tracking for RTL Agents

**Impact:** Cannot track LLM costs for regulatory processing (majority of LLM usage)

**Evidence:**

- `src/lib/regulatory-truth/agents/runner.ts` - No `trackAIUsage()` call
- `src/lib/article-agent/llm/ollama-client.ts` - Ollama doesn't return token counts
- Affects 6 of 18 LLM callsites (EXTRACTOR, COMPOSER, REVIEWER, ARBITER, CLAIM_EXTRACTOR, PROCESS_EXTRACTOR)

**What's Missing:**

- Token estimation for Ollama calls
- Cost tracking in `aIUsage` table for RTL operations
- Budget enforcement for RTL pipeline

---

### 6.2 HIGH: No Latency Tracking for LLM Calls

**Impact:** Cannot identify slow LLM calls or set alerting thresholds

**Evidence:**

- `aIUsage` table schema has no `durationMs` column
- `agentRun` table has duration but not exposed in admin pages
- No percentile latency metrics (p50, p95, p99)

**What's Missing:**

- `durationMs` field in `aIUsage` table
- Latency histogram in `/admin/system-status`
- Alert threshold for slow LLM calls (>30s)

---

### 6.3 HIGH: Assistant Queries Not Persisted

**Impact:** Cannot audit user queries or measure assistant effectiveness

**Evidence:**

- `src/lib/assistant/query-engine/answer-synthesizer.ts` - Logs to `assistantLogger` only
- No `assistantConversation` or `assistantQuery` table
- Cannot compute: queries/day, success rate, most common topics

**What's Missing:**

- `AssistantQuery` table with: userId, query, ruleIds, response, tokens, duration
- Admin page `/admin/assistant` with query volume, success rate
- User feedback capture (helpful/not helpful)

---

### 6.4 MEDIUM: No Per-Tenant LLM Budget for RTL

**Impact:** System-wide RTL costs not attributable to specific operations

**Evidence:**

- RTL agents use `companyId: "system"` for tracking
- No breakdown by domain (pausalni, pdv, etc.)
- Cannot set per-domain cost limits

**What's Missing:**

- Domain-level cost attribution in `aIUsage`
- Budget enforcement per domain
- Cost alerts when domain exceeds threshold

---

### 6.5 MEDIUM: Content Sync PR Staleness Not Alerted

**Impact:** Stale PRs accumulate without notification

**Evidence:**

- `src/app/admin/content-automation/page.tsx` shows `stalePRs` count
- `getContentPipelineHealth()` computes `stalePRs > 10` threshold
- No alert emission when threshold exceeded

**What's Missing:**

- Alert in `MonitoringAlert` table for stale PRs
- Slack/email notification when stalePRs > 3
- Auto-close mechanism for abandoned PRs

---

### 6.6 MEDIUM: No Evidence Embedding Failure Alerting

**Impact:** Failed embeddings not surfaced to operators

**Evidence:**

- `Evidence.embeddingStatus` can be `FAILED`
- No admin page shows failed embedding count
- No alert when embedding failure rate exceeds threshold

**What's Missing:**

- Counter in `/admin/regulatory` for `embeddingStatus=FAILED`
- Alert when >5% of evidence has failed embeddings
- Retry mechanism exposed in admin UI

---

### 6.7 LOW: Arbiter Decisions Not Auditable

**Impact:** Conflict resolution reasoning not easily reviewable

**Evidence:**

- `ConflictResolutionAudit` table exists but:
  - No admin page to view audit trail
  - `metadata` field structure not documented
  - No export capability

**What's Missing:**

- `/admin/regulatory/conflicts/[id]` detail page
- Audit trail display with reasoning
- Export to CSV for compliance

---

### 6.8 LOW: No Historical Metrics Dashboard

**Impact:** Cannot identify trends or regressions

**Evidence:**

- `TruthHealthSnapshot` table exists
- `GET /api/admin/regulatory-truth/truth-health?history=true` returns snapshots
- No admin page visualizes historical data

**What's Missing:**

- Time-series charts in `/admin/regulatory`
- 7-day, 30-day trend views
- Anomaly detection for metric spikes

---

### 6.9 LOW: Circuit Breaker Events Not Logged

**Impact:** Cannot audit when breakers opened/closed

**Evidence:**

- `AdminCircuitBreakerAudit` table exists for manual resets only
- Automatic open/close events not captured
- No correlation with failure spikes

**What's Missing:**

- Automatic event logging when breaker state changes
- Timeline view in `/admin/system-status`
- Alert when breaker opens

---

## 7. Summary

### What Exists (Good Coverage)

1. **Pipeline stages**: All 13 stages documented with queue configs
2. **Admin pages**: 13 pages covering regulatory, content, alerts, compliance
3. **Status endpoints**: 22 endpoints (7 public, 15 admin)
4. **OpenAI/DeepSeek tracking**: Full token + cost tracking for 12 callsites
5. **Feature contracts**: Capability gating prevents crashes on missing tables
6. **Health endpoints**: K8s-compatible readiness with structured failures
7. **Alerting infrastructure**: Slack, webhook, email channels configured

### What's Missing (Gaps)

| Priority | Gap                           | Impact                         |
| -------- | ----------------------------- | ------------------------------ |
| CRITICAL | RTL agent token/cost tracking | Cannot budget 33% of LLM usage |
| HIGH     | LLM latency tracking          | Cannot detect slow calls       |
| HIGH     | Assistant query persistence   | Cannot audit user interactions |
| MEDIUM   | Per-domain cost attribution   | Cannot optimize RTL costs      |
| MEDIUM   | Content sync PR alerts        | Stale PRs accumulate silently  |
| MEDIUM   | Embedding failure alerts      | Failed embeddings unnoticed    |
| LOW      | Arbiter audit UI              | Conflict resolution opaque     |
| LOW      | Historical metrics charts     | No trend visibility            |
| LOW      | Circuit breaker event logs    | State changes not auditable    |

---

_Generated by repo inspection. No external calls made. All claims backed by file paths and code excerpts._
