# RTL Pipeline Monitoring

> Document version: 2026-01-13
>
> SQL queries for monitoring RTL pipeline health, throughput, and spend.
> Run these against the production database.

## Quick Health Check

### Pipeline Throughput (Last 24 Hours)

```sql
-- Agent runs by outcome in last 24 hours
SELECT
  "agentType",
  outcome,
  COUNT(*) as count,
  ROUND(AVG("durationMs")::numeric, 0) as avg_duration_ms,
  SUM("tokensUsed") as total_tokens
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType", outcome
ORDER BY "agentType", count DESC;
```

### Pipeline Bottlenecks

```sql
-- Queue depth by stage (pending jobs)
SELECT
  "queueName",
  COUNT(*) FILTER (WHERE outcome IS NULL) as pending,
  COUNT(*) FILTER (WHERE outcome = 'SUCCESS_APPLIED') as success,
  COUNT(*) FILTER (WHERE outcome IN ('RETRY_EXHAUSTED', 'TIMEOUT', 'PARSE_FAILED')) as failed
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "queueName"
ORDER BY pending DESC;
```

---

## LLM Spend Monitoring

### Daily Token Usage

```sql
-- Token usage by agent type (last 7 days)
SELECT
  DATE("createdAt") as date,
  "agentType",
  SUM("tokensUsed") as tokens,
  COUNT(*) as runs,
  ROUND(AVG("tokensUsed")::numeric, 0) as avg_tokens_per_run
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
  AND "tokensUsed" IS NOT NULL
GROUP BY DATE("createdAt"), "agentType"
ORDER BY date DESC, tokens DESC;
```

### Cache Savings

```sql
-- Cache hit rate and savings
SELECT
  "agentType",
  COUNT(*) FILTER (WHERE "cacheHit" = true) as cache_hits,
  COUNT(*) FILTER (WHERE "cacheHit" = false) as cache_misses,
  ROUND(
    COUNT(*) FILTER (WHERE "cacheHit" = true)::numeric * 100 /
    NULLIF(COUNT(*), 0),
    1
  ) as hit_rate_pct,
  -- Estimated savings (cache hits avoid LLM call)
  SUM("tokensUsed") FILTER (WHERE "cacheHit" = true) as tokens_saved
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType"
ORDER BY cache_hits DESC;
```

### Cost Estimation

```sql
-- Estimated cost (adjust price per 1K tokens for your provider)
WITH token_costs AS (
  SELECT
    DATE("createdAt") as date,
    "agentType",
    SUM("tokensUsed") as tokens
  FROM "AgentRun"
  WHERE "createdAt" > NOW() - INTERVAL '30 days'
    AND "tokensUsed" IS NOT NULL
  GROUP BY DATE("createdAt"), "agentType"
)
SELECT
  date,
  SUM(tokens) as total_tokens,
  -- Adjust price per your provider: $0.002 per 1K tokens is typical for Ollama
  ROUND(SUM(tokens)::numeric / 1000 * 0.002, 2) as estimated_cost_usd
FROM token_costs
GROUP BY date
ORDER BY date DESC;
```

---

## Pipeline Health Metrics

### Success Rate by Stage

```sql
-- Success rate per agent type (last 24 hours)
SELECT
  "agentType",
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE outcome IN ('SUCCESS_APPLIED', 'SUCCESS_NO_CHANGE', 'DUPLICATE_CACHED')) as success,
  COUNT(*) FILTER (WHERE outcome IN ('RETRY_EXHAUSTED', 'TIMEOUT', 'PARSE_FAILED')) as failed,
  ROUND(
    COUNT(*) FILTER (WHERE outcome IN ('SUCCESS_APPLIED', 'SUCCESS_NO_CHANGE', 'DUPLICATE_CACHED'))::numeric * 100 /
    NULLIF(COUNT(*), 0),
    1
  ) as success_rate_pct
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType"
ORDER BY success_rate_pct ASC;
```

### itemsProduced Validation

```sql
-- CRITICAL: Find SUCCESS_APPLIED runs with itemsProduced = 0
-- This violates the contract invariant
SELECT
  id,
  "agentType",
  "createdAt",
  "evidenceId",
  "itemsProduced",
  outcome
FROM "AgentRun"
WHERE outcome = 'SUCCESS_APPLIED'
  AND "itemsProduced" = 0
  AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Error Breakdown

```sql
-- Error types by agent (last 24 hours)
SELECT
  "agentType",
  outcome,
  SUBSTRING(error, 1, 100) as error_preview,
  COUNT(*) as count
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND outcome IN ('RETRY_EXHAUSTED', 'TIMEOUT', 'PARSE_FAILED', 'VALIDATION_REJECTED')
GROUP BY "agentType", outcome, SUBSTRING(error, 1, 100)
ORDER BY count DESC
LIMIT 20;
```

---

## Entity Progress Tracking

### Evidence Processing Status

```sql
-- Evidence processing funnel
SELECT
  "contentClass",
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE id IN (
    SELECT DISTINCT "evidenceId" FROM "AgentRun" WHERE "agentType" = 'EXTRACTOR'
  )) as extracted,
  COUNT(*) FILTER (WHERE id IN (
    SELECT DISTINCT "evidenceId" FROM "AgentRun"
    WHERE "agentType" = 'EXTRACTOR'
    AND outcome = 'SUCCESS_APPLIED'
  )) as successfully_extracted
FROM "Evidence"
WHERE "fetchedAt" > NOW() - INTERVAL '7 days'
GROUP BY "contentClass"
ORDER BY total DESC;
```

### CandidateFact Pipeline (PHASE-D)

```sql
-- CandidateFact status distribution
SELECT
  status,
  "suggestedDomain" as domain,
  COUNT(*) as count,
  ROUND(AVG("overallConfidence")::numeric, 2) as avg_confidence
FROM "CandidateFact"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY status, "suggestedDomain"
ORDER BY count DESC;
```

### Rule Status Distribution

```sql
-- Rule lifecycle status
SELECT
  status,
  "riskTier",
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE "approvedBy" IS NOT NULL) as human_approved
FROM "RegulatoryRule"
GROUP BY status, "riskTier"
ORDER BY status, "riskTier";
```

---

## Downstream Progress Checks

### Extract → Compose Flow

```sql
-- Check if extractions are flowing to compose
-- Expected: If extractor succeeds, compose should follow
WITH extract_runs AS (
  SELECT
    "evidenceId",
    outcome,
    "createdAt" as extract_time
  FROM "AgentRun"
  WHERE "agentType" = 'EXTRACTOR'
    AND "createdAt" > NOW() - INTERVAL '24 hours'
)
SELECT
  e.outcome as extract_outcome,
  COUNT(*) as extract_count,
  COUNT(c.id) as compose_jobs_found
FROM extract_runs e
LEFT JOIN "AgentRun" c ON c."agentType" = 'COMPOSER'
  AND c."createdAt" > e.extract_time
  AND c."createdAt" < e.extract_time + INTERVAL '1 hour'
GROUP BY e.outcome
ORDER BY extract_count DESC;
```

### Orphaned Items Check

```sql
-- Evidence without any AgentRun (never processed)
SELECT
  e.id,
  e.url,
  e."contentClass",
  e."fetchedAt"
FROM "Evidence" e
LEFT JOIN "AgentRun" ar ON ar."evidenceId" = e.id
WHERE ar.id IS NULL
  AND e."fetchedAt" > NOW() - INTERVAL '7 days'
ORDER BY e."fetchedAt" DESC
LIMIT 50;
```

---

## Error Classification

### Rate Limit Errors

```sql
-- Rate limit (429) errors
SELECT
  "agentType",
  "sourceSlug",
  COUNT(*) as rate_limit_errors,
  MAX("createdAt") as last_error
FROM "AgentRun"
WHERE error LIKE '%429%'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType", "sourceSlug"
ORDER BY rate_limit_errors DESC;
```

### Timeout Distribution

```sql
-- Timeout analysis by agent
SELECT
  "agentType",
  ROUND(AVG("durationMs")::numeric, 0) as avg_duration_ms,
  MAX("durationMs") as max_duration_ms,
  COUNT(*) FILTER (WHERE outcome = 'TIMEOUT') as timeout_count,
  COUNT(*) as total_count
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType"
ORDER BY timeout_count DESC;
```

### Parse Failures

```sql
-- Parse failures with error details
SELECT
  "agentType",
  LEFT(error, 200) as error_sample,
  COUNT(*) as count
FROM "AgentRun"
WHERE outcome = 'PARSE_FAILED'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType", LEFT(error, 200)
ORDER BY count DESC
LIMIT 20;
```

---

## Rejection Analysis

### ExtractionRejected Dead-Letter

```sql
-- Rejected extractions by type
SELECT
  "rejectionType",
  DATE("createdAt") as date,
  COUNT(*) as count
FROM "ExtractionRejected"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "rejectionType", DATE("createdAt")
ORDER BY date DESC, count DESC;
```

### Low Confidence Extractions

```sql
-- Extractions rejected for low confidence
SELECT
  "suggestedDomain",
  "suggestedValueType",
  COUNT(*) as count,
  ROUND(AVG("overallConfidence")::numeric, 2) as avg_confidence,
  MIN("overallConfidence") as min_confidence
FROM "CandidateFact"
WHERE "overallConfidence" < 0.7
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "suggestedDomain", "suggestedValueType"
ORDER BY count DESC;
```

---

## Conflict Monitoring

### Open Conflicts

```sql
-- Unresolved conflicts
SELECT
  id,
  "conflictType",
  status,
  "requiresHumanReview",
  "createdAt",
  EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 as hours_open
FROM "RegulatoryConflict"
WHERE status IN ('OPEN', 'ESCALATED')
ORDER BY "createdAt" ASC;
```

### Conflict Resolution Rate

```sql
-- Conflict resolution metrics
SELECT
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600)::numeric, 1) as avg_hours_to_resolve
FROM "RegulatoryConflict"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;
```

---

## Human Review Queue

### Pending Reviews

```sql
-- Human review requests pending
SELECT
  "entityType",
  status,
  COUNT(*) as count,
  MIN("createdAt") as oldest
FROM "HumanReviewRequest"
WHERE status = 'PENDING'
GROUP BY "entityType", status
ORDER BY count DESC;
```

### Review SLA

```sql
-- Time to human review
SELECT
  "entityType",
  DATE("completedAt") as date,
  COUNT(*) as reviews,
  ROUND(AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 3600)::numeric, 1) as avg_hours
FROM "HumanReviewRequest"
WHERE "completedAt" IS NOT NULL
  AND "completedAt" > NOW() - INTERVAL '30 days'
GROUP BY "entityType", DATE("completedAt")
ORDER BY date DESC;
```

---

## Alerting Thresholds

Use these queries for alerting systems:

### Critical Alerts

```sql
-- SUCCESS_APPLIED with itemsProduced = 0 (contract violation)
SELECT COUNT(*) as violations
FROM "AgentRun"
WHERE outcome = 'SUCCESS_APPLIED'
  AND "itemsProduced" = 0
  AND "createdAt" > NOW() - INTERVAL '1 hour';
-- Alert if > 0

-- High timeout rate
SELECT
  COUNT(*) FILTER (WHERE outcome = 'TIMEOUT')::numeric /
  NULLIF(COUNT(*), 0) as timeout_rate
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '1 hour';
-- Alert if > 0.1 (10%)

-- Evidence backlog growing
SELECT COUNT(*) as unprocessed
FROM "Evidence" e
LEFT JOIN "AgentRun" ar ON ar."evidenceId" = e.id
WHERE ar.id IS NULL
  AND e."fetchedAt" > NOW() - INTERVAL '24 hours';
-- Alert if > 100
```

### Warning Alerts

```sql
-- Cache hit rate dropping
SELECT
  COUNT(*) FILTER (WHERE "cacheHit" = true)::numeric /
  NULLIF(COUNT(*), 0) as cache_rate
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '1 hour';
-- Warn if < 0.3 (30%)

-- Error rate by agent
SELECT
  "agentType",
  COUNT(*) FILTER (WHERE outcome IN ('RETRY_EXHAUSTED', 'TIMEOUT', 'PARSE_FAILED'))::numeric /
  NULLIF(COUNT(*), 0) as error_rate
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "agentType"
HAVING COUNT(*) > 10;
-- Warn if any > 0.2 (20%)
```
