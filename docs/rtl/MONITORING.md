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

---

## Token Spend vs Persisted Value

These queries help answer: "Did we spend tokens and get persisted value?"

### Token ROI by Source

```sql
-- Tokens spent vs rules created per source
WITH source_spend AS (
  SELECT
    "sourceSlug",
    SUM("tokensUsed") as tokens_spent,
    COUNT(*) as llm_calls
  FROM "AgentRun"
  WHERE "createdAt" > NOW() - INTERVAL '7 days'
    AND "tokensUsed" > 0
  GROUP BY "sourceSlug"
),
source_rules AS (
  SELECT
    rs.slug as "sourceSlug",
    COUNT(DISTINCT rr.id) as rules_created
  FROM "RegulatorySource" rs
  JOIN "Evidence" e ON e."sourceId" = rs.id
  JOIN "SourcePointer" sp ON sp."evidenceId" = e.id
  JOIN "RegulatoryRule" rr ON rr.id = sp."ruleId"
  WHERE rr."createdAt" > NOW() - INTERVAL '7 days'
  GROUP BY rs.slug
)
SELECT
  s."sourceSlug",
  s.tokens_spent,
  s.llm_calls,
  COALESCE(r.rules_created, 0) as rules_created,
  CASE
    WHEN COALESCE(r.rules_created, 0) > 0
    THEN ROUND(s.tokens_spent::numeric / r.rules_created, 0)
    ELSE NULL
  END as tokens_per_rule
FROM source_spend s
LEFT JOIN source_rules r ON r."sourceSlug" = s."sourceSlug"
ORDER BY tokens_spent DESC;
```

### Token Efficiency Trend

```sql
-- Daily token efficiency (tokens per persisted rule)
WITH daily_spend AS (
  SELECT
    DATE("createdAt") as date,
    SUM("tokensUsed") as tokens_spent
  FROM "AgentRun"
  WHERE "createdAt" > NOW() - INTERVAL '14 days'
    AND "tokensUsed" > 0
  GROUP BY DATE("createdAt")
),
daily_rules AS (
  SELECT
    DATE("createdAt") as date,
    COUNT(*) as rules_created
  FROM "RegulatoryRule"
  WHERE "createdAt" > NOW() - INTERVAL '14 days'
  GROUP BY DATE("createdAt")
)
SELECT
  s.date,
  s.tokens_spent,
  COALESCE(r.rules_created, 0) as rules_created,
  CASE
    WHEN COALESCE(r.rules_created, 0) > 0
    THEN ROUND(s.tokens_spent::numeric / r.rules_created, 0)
    ELSE s.tokens_spent
  END as tokens_per_rule
FROM daily_spend s
LEFT JOIN daily_rules r ON r.date = s.date
ORDER BY s.date DESC;
```

---

## Source Health Score (Adaptive Health System)

> Updated: 2026-01-13 - Now using persistent SourceHealth model

Track which sources are producing value vs wasting budget. The adaptive health system
automatically adjusts routing thresholds and budget allocation based on source performance.

### Source Health Overview

```sql
-- Current health status of all sources
SELECT
  "sourceSlug",
  "healthScore",
  CASE
    WHEN "healthScore" >= 0.8 THEN 'EXCELLENT'
    WHEN "healthScore" >= 0.6 THEN 'GOOD'
    WHEN "healthScore" >= 0.4 THEN 'FAIR'
    WHEN "healthScore" >= 0.2 THEN 'POOR'
    ELSE 'CRITICAL'
  END as health_level,
  "isPaused",
  "pauseReason",
  "minScoutScore",
  "allowCloud",
  "budgetMultiplier",
  "totalAttempts",
  "successCount",
  "emptyCount",
  "errorCount",
  "avgTokensPerItem",
  "lastBatchAt"
FROM "SourceHealth"
ORDER BY "healthScore" DESC;
```

### Paused Sources

```sql
-- Sources currently paused (cannot consume budget)
SELECT
  "sourceSlug",
  "healthScore",
  "pauseReason",
  "pausedAt",
  "pauseExpiresAt",
  EXTRACT(EPOCH FROM ("pauseExpiresAt" - NOW())) / 3600 as hours_until_unpause
FROM "SourceHealth"
WHERE "isPaused" = true
ORDER BY "pausedAt" DESC;
```

### Health Trend by Source

```sql
-- Compare current health to 7-day average (requires PipelineProgress)
WITH recent_health AS (
  SELECT
    "sourceSlug",
    COUNT(*) as recent_attempts,
    COUNT(*) FILTER (WHERE "errorClass" IS NULL AND "producedCount" > 0) as recent_success,
    COUNT(*) FILTER (WHERE "tokensUsed" > 0 AND "producedCount" = 0 AND "errorClass" IS NULL) as recent_empty,
    COUNT(*) FILTER (WHERE "errorClass" IS NOT NULL) as recent_errors
  FROM "PipelineProgress"
  WHERE timestamp > NOW() - INTERVAL '24 hours'
    AND "stageName" IN ('extract', 'compose')
  GROUP BY "sourceSlug"
)
SELECT
  sh."sourceSlug",
  sh."healthScore" as current_health,
  rh.recent_attempts,
  ROUND(rh.recent_success::numeric / NULLIF(rh.recent_attempts, 0), 2) as recent_success_rate,
  ROUND(rh.recent_empty::numeric / NULLIF(rh.recent_attempts, 0), 2) as recent_empty_rate,
  ROUND(rh.recent_errors::numeric / NULLIF(rh.recent_attempts, 0), 2) as recent_error_rate
FROM "SourceHealth" sh
LEFT JOIN recent_health rh ON rh."sourceSlug" = sh."sourceSlug"
WHERE sh."totalAttempts" >= 10
ORDER BY sh."healthScore" DESC;
```

### Budget Efficiency by Health Level

```sql
-- Token efficiency grouped by health level
SELECT
  CASE
    WHEN "healthScore" >= 0.8 THEN 'EXCELLENT'
    WHEN "healthScore" >= 0.6 THEN 'GOOD'
    WHEN "healthScore" >= 0.4 THEN 'FAIR'
    WHEN "healthScore" >= 0.2 THEN 'POOR'
    ELSE 'CRITICAL'
  END as health_level,
  COUNT(*) as source_count,
  SUM("totalAttempts") as total_attempts,
  SUM("totalTokensUsed") as total_tokens,
  SUM("totalItemsProduced") as total_items,
  ROUND(AVG("budgetMultiplier")::numeric, 2) as avg_budget_mult,
  ROUND(
    SUM("totalTokensUsed")::numeric / NULLIF(SUM("totalItemsProduced"), 0),
    0
  ) as tokens_per_item
FROM "SourceHealth"
WHERE "totalAttempts" >= 10
GROUP BY
  CASE
    WHEN "healthScore" >= 0.8 THEN 'EXCELLENT'
    WHEN "healthScore" >= 0.6 THEN 'GOOD'
    WHEN "healthScore" >= 0.4 THEN 'FAIR'
    WHEN "healthScore" >= 0.2 THEN 'POOR'
    ELSE 'CRITICAL'
  END
ORDER BY
  CASE health_level
    WHEN 'EXCELLENT' THEN 1
    WHEN 'GOOD' THEN 2
    WHEN 'FAIR' THEN 3
    WHEN 'POOR' THEN 4
    ELSE 5
  END;
```

### Sources Approaching Threshold Boundaries

```sql
-- Sources near health thresholds (may change behavior soon)
SELECT
  "sourceSlug",
  "healthScore",
  "minScoutScore",
  "allowCloud",
  "budgetMultiplier",
  CASE
    WHEN "healthScore" BETWEEN 0.38 AND 0.42 THEN 'NEAR_FAIR_BOUNDARY'
    WHEN "healthScore" BETWEEN 0.58 AND 0.62 THEN 'NEAR_GOOD_BOUNDARY'
    WHEN "healthScore" BETWEEN 0.78 AND 0.82 THEN 'NEAR_EXCELLENT_BOUNDARY'
    WHEN "healthScore" BETWEEN 0.18 AND 0.22 THEN 'NEAR_POOR_BOUNDARY'
    WHEN "healthScore" BETWEEN 0.08 AND 0.12 THEN 'NEAR_CRITICAL_BOUNDARY'
    ELSE 'STABLE'
  END as threshold_proximity,
  "totalAttempts"
FROM "SourceHealth"
WHERE "healthScore" BETWEEN 0.08 AND 0.12
   OR "healthScore" BETWEEN 0.18 AND 0.22
   OR "healthScore" BETWEEN 0.38 AND 0.42
   OR "healthScore" BETWEEN 0.58 AND 0.62
   OR "healthScore" BETWEEN 0.78 AND 0.82
ORDER BY "healthScore";
```

### Legacy Health Score (from AgentRun)

```sql
-- Legacy calculation for comparison
WITH source_metrics AS (
  SELECT
    "sourceSlug",
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE outcome = 'SUCCESS_APPLIED') as success_count,
    COUNT(*) FILTER (WHERE outcome = 'EMPTY_OUTPUT') as empty_count,
    COUNT(*) FILTER (WHERE outcome IN ('RETRY_EXHAUSTED', 'TIMEOUT')) as error_count,
    SUM("tokensUsed") as total_tokens,
    SUM("itemsProduced") as items_produced
  FROM "AgentRun"
  WHERE "createdAt" > NOW() - INTERVAL '7 days'
    AND "sourceSlug" IS NOT NULL
  GROUP BY "sourceSlug"
)
SELECT
  "sourceSlug",
  total_runs,
  success_count,
  empty_count,
  error_count,
  total_tokens,
  items_produced,
  -- Health score: 0-100
  ROUND(
    (
      (success_count::numeric / NULLIF(total_runs, 0)) * 40 +
      (items_produced::numeric / NULLIF(total_tokens / 1000, 0)) * 40 +
      (1 - empty_count::numeric / NULLIF(total_runs, 0)) * 20
    ),
    1
  ) as health_score
FROM source_metrics
WHERE total_runs >= 5  -- Only sources with enough data
ORDER BY health_score DESC;
```

### Sources in Cooldown

```sql
-- This requires checking PipelineProgress for cooldown events
SELECT
  "sourceSlug",
  COUNT(*) as cooldown_triggers,
  MAX(timestamp) as last_cooldown
FROM "PipelineProgress"
WHERE "skipReason" LIKE '%cooldown%'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY "sourceSlug"
ORDER BY cooldown_triggers DESC;
```

### Low Value Sources

```sql
-- Sources burning tokens with no output
SELECT
  "sourceSlug",
  SUM("tokensUsed") as tokens_burned,
  COUNT(*) as empty_runs,
  ROUND(AVG("tokensUsed")::numeric, 0) as avg_tokens_per_empty
FROM "AgentRun"
WHERE outcome = 'EMPTY_OUTPUT'
  AND "createdAt" > NOW() - INTERVAL '7 days'
  AND "sourceSlug" IS NOT NULL
GROUP BY "sourceSlug"
HAVING SUM("tokensUsed") > 1000  -- At least 1K tokens burned
ORDER BY tokens_burned DESC
LIMIT 20;
```

---

## Tokens Burned with itemsProduced = 0

Critical metric: tokens spent without any persisted value.

### Token Waste Summary

```sql
-- Tokens spent with no items produced
SELECT
  "agentType",
  outcome,
  COUNT(*) as runs,
  SUM("tokensUsed") as tokens_burned,
  ROUND(AVG("tokensUsed")::numeric, 0) as avg_tokens
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND "tokensUsed" > 0
  AND "itemsProduced" = 0
GROUP BY "agentType", outcome
ORDER BY tokens_burned DESC;
```

### Token Waste by Source

```sql
-- Which sources are wasting the most tokens
SELECT
  "sourceSlug",
  COUNT(*) as zero_output_runs,
  SUM("tokensUsed") as tokens_wasted,
  ROUND(SUM("tokensUsed")::numeric / COUNT(*), 0) as avg_tokens_per_run
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
  AND "tokensUsed" > 0
  AND "itemsProduced" = 0
  AND "sourceSlug" IS NOT NULL
GROUP BY "sourceSlug"
HAVING SUM("tokensUsed") > 5000  -- More than 5K tokens wasted
ORDER BY tokens_wasted DESC
LIMIT 20;
```

### Token Burn Rate Trend

```sql
-- Daily token waste trend
SELECT
  DATE("createdAt") as date,
  SUM("tokensUsed") FILTER (WHERE "itemsProduced" = 0) as tokens_wasted,
  SUM("tokensUsed") FILTER (WHERE "itemsProduced" > 0) as tokens_productive,
  ROUND(
    SUM("tokensUsed") FILTER (WHERE "itemsProduced" = 0)::numeric * 100 /
    NULLIF(SUM("tokensUsed"), 0),
    1
  ) as waste_rate_pct
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '14 days'
  AND "tokensUsed" > 0
GROUP BY DATE("createdAt")
ORDER BY date DESC;
```

---

## Pipeline Progress Monitoring (New)

Using the new PipelineProgress table for observability.

### Scout Outcomes

```sql
-- Scout stage results
SELECT
  DATE(timestamp) as date,
  metadata->>'decision' as decision,
  COUNT(*) as count,
  ROUND(AVG((metadata->>'worthItScore')::numeric), 2) as avg_score
FROM "PipelineProgress"
WHERE "stageName" = 'scout'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp), metadata->>'decision'
ORDER BY date DESC, count DESC;
```

### Router Decisions

```sql
-- Routing decision distribution
SELECT
  metadata->>'decision' as routing_decision,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE metadata->>'budgetAllowed' = 'true') as budget_allowed,
  COUNT(*) FILTER (WHERE metadata->>'budgetAllowed' = 'false') as budget_denied
FROM "PipelineProgress"
WHERE "stageName" = 'router'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'decision'
ORDER BY count DESC;
```

### Budget Denial Analysis

```sql
-- Why budget is denying requests
SELECT
  metadata->>'budgetDenialReason' as denial_reason,
  "sourceSlug",
  COUNT(*) as denials
FROM "PipelineProgress"
WHERE "stageName" = 'router'
  AND metadata->>'budgetAllowed' = 'false'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'budgetDenialReason', "sourceSlug"
ORDER BY denials DESC
LIMIT 20;
```

### Skip Reasons Distribution

```sql
-- Why content is being skipped
SELECT
  "stageName",
  "skipReason",
  COUNT(*) as count
FROM "PipelineProgress"
WHERE "skipReason" IS NOT NULL
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY "stageName", "skipReason"
ORDER BY count DESC
LIMIT 30;
```

---

## Budget Governor Alerts

### Budget Cap Approaching

```sql
-- Daily token usage vs cap (500K default)
SELECT
  DATE("createdAt") as date,
  SUM("tokensUsed") as tokens_used,
  500000 as daily_cap,
  ROUND(SUM("tokensUsed")::numeric * 100 / 500000, 1) as usage_pct
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
  AND "tokensUsed" > 0
GROUP BY DATE("createdAt")
ORDER BY date DESC;
-- Alert if usage_pct > 80
```

### Source-Level Budget Usage

```sql
-- Per-source budget usage vs cap (50K default)
SELECT
  "sourceSlug",
  SUM("tokensUsed") as tokens_used,
  50000 as source_cap,
  ROUND(SUM("tokensUsed")::numeric * 100 / 50000, 1) as usage_pct
FROM "AgentRun"
WHERE "createdAt" > NOW() - INTERVAL '1 day'
  AND "tokensUsed" > 0
  AND "sourceSlug" IS NOT NULL
GROUP BY "sourceSlug"
HAVING SUM("tokensUsed") > 25000  -- Over 50% of cap
ORDER BY tokens_used DESC;
```

---

## Stability Guards Monitoring

> Added: 2026-01-13 - For health-state dwell time, explainability, and starvation guards

### Health State Distribution

```sql
-- Current health state distribution with dwell time
SELECT
  "healthState",
  COUNT(*) as source_count,
  ROUND(AVG("healthScore")::numeric, 3) as avg_score,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600)::numeric, 1) as avg_hours_in_state,
  COUNT(*) FILTER (WHERE "isPaused") as paused_count
FROM "SourceHealth"
GROUP BY "healthState"
ORDER BY
  CASE "healthState"
    WHEN 'EXCELLENT' THEN 1
    WHEN 'GOOD' THEN 2
    WHEN 'FAIR' THEN 3
    WHEN 'POOR' THEN 4
    WHEN 'CRITICAL' THEN 5
  END;
```

### Health State Transitions (Last 24 Hours)

```sql
-- Recent state transitions with decision reasons
SELECT
  "sourceSlug",
  "healthState",
  "previousHealthState",
  "healthScore",
  "lastDecisionReason",
  "lastDecisionAt",
  "lastDecisionDetails",
  EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600 as hours_in_current_state
FROM "SourceHealth"
WHERE "lastDecisionAt" > NOW() - INTERVAL '24 hours'
  AND "lastDecisionReason" IN ('HEALTH_UPGRADE', 'HEALTH_DOWNGRADE', 'DWELL_TIME_BLOCKED', 'STEPWISE_BLOCKED')
ORDER BY "lastDecisionAt" DESC;
```

### Dwell Time Blocked Upgrades

```sql
-- Sources blocked from upgrading due to dwell time
SELECT
  "sourceSlug",
  "healthState",
  "healthScore",
  "healthStateEnteredAt",
  EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600 as hours_in_state,
  CASE
    WHEN "healthState" = 'CRITICAL' THEN 24 - EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600
    WHEN "healthState" = 'POOR' THEN 12 - EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600
    ELSE 0
  END as hours_until_upgrade_allowed,
  "lastDecisionReason",
  "lastDecisionDetails"
FROM "SourceHealth"
WHERE "healthState" IN ('POOR', 'CRITICAL')
  AND "lastDecisionReason" = 'DWELL_TIME_BLOCKED'
ORDER BY hours_until_upgrade_allowed ASC;
```

### Stepwise Blocked Upgrades

```sql
-- Sources where rapid improvement was constrained
SELECT
  "sourceSlug",
  "healthState",
  "previousHealthState",
  "healthScore",
  "lastDecisionAt",
  "lastDecisionDetails"->>'previousValue' as from_state_index,
  "lastDecisionDetails"->>'metricValue' as target_state_index,
  "lastDecisionDetails"->>'threshold' as allowed_state_index
FROM "SourceHealth"
WHERE "lastDecisionReason" = 'STEPWISE_BLOCKED'
  AND "lastDecisionAt" > NOW() - INTERVAL '7 days'
ORDER BY "lastDecisionAt" DESC;
```

---

## Decision Audit Trail

### All Decision Events (Last 7 Days)

```sql
-- Complete decision audit trail
SELECT
  DATE("lastDecisionAt") as date,
  "lastDecisionReason",
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT "sourceSlug") as affected_sources
FROM "SourceHealth"
WHERE "lastDecisionAt" > NOW() - INTERVAL '7 days'
GROUP BY DATE("lastDecisionAt"), "lastDecisionReason"
ORDER BY date DESC, count DESC;
```

### Auto-Pause Events

```sql
-- Sources auto-paused due to critical health
SELECT
  "sourceSlug",
  "healthScore",
  "pausedAt",
  "pauseReason",
  "pauseExpiresAt",
  EXTRACT(EPOCH FROM ("pauseExpiresAt" - NOW())) / 3600 as hours_until_unpause,
  "lastDecisionDetails"
FROM "SourceHealth"
WHERE "isPaused" = true
  AND "lastDecisionReason" = 'AUTO_PAUSE'
ORDER BY "pausedAt" DESC;
```

### Auto-Unpause Events

```sql
-- Recent auto-unpause events
SELECT
  "sourceSlug",
  "healthScore",
  "healthState",
  "lastDecisionAt",
  "lastDecisionDetails"
FROM "SourceHealth"
WHERE "lastDecisionReason" = 'AUTO_UNPAUSE'
  AND "lastDecisionAt" > NOW() - INTERVAL '7 days'
ORDER BY "lastDecisionAt" DESC;
```

### Manual Interventions

```sql
-- Manual pause/unpause events (operator actions)
SELECT
  "sourceSlug",
  "lastDecisionReason",
  "lastDecisionAt",
  "isPaused",
  "pauseReason",
  "lastDecisionDetails"
FROM "SourceHealth"
WHERE "lastDecisionReason" IN ('MANUAL_PAUSE', 'MANUAL_UNPAUSE')
  AND "lastDecisionAt" > NOW() - INTERVAL '30 days'
ORDER BY "lastDecisionAt" DESC;
```

---

## Starvation Guard Monitoring

### Starvation Allowance Status

```sql
-- Current starvation allowance status for restricted sources
SELECT
  "sourceSlug",
  "healthState",
  "healthScore",
  "starvationAllowanceCount",
  "lastStarvationAllowanceAt",
  EXTRACT(EPOCH FROM (NOW() - COALESCE("lastStarvationAllowanceAt", "windowStartAt"))) / 3600 as hours_since_last_allowance,
  3 - "starvationAllowanceCount" as allowances_remaining,
  CASE
    WHEN "starvationAllowanceCount" >= 3 THEN 'MAX_REACHED'
    WHEN "lastStarvationAllowanceAt" IS NULL THEN 'ELIGIBLE'
    WHEN EXTRACT(EPOCH FROM (NOW() - "lastStarvationAllowanceAt")) / 3600 < 48 THEN 'INTERVAL_BLOCKED'
    ELSE 'ELIGIBLE'
  END as eligibility_status
FROM "SourceHealth"
WHERE "healthState" IN ('POOR', 'CRITICAL')
ORDER BY "healthScore" ASC;
```

### Starvation Allowance Events

```sql
-- Recent starvation allowance grants
SELECT
  "sourceSlug",
  "healthState",
  "healthScore",
  "lastStarvationAllowanceAt",
  "starvationAllowanceCount",
  "lastDecisionDetails"->>'metricValue' as allowance_number,
  "lastDecisionDetails"->>'threshold' as max_allowances
FROM "SourceHealth"
WHERE "lastDecisionReason" = 'STARVATION_ALLOWANCE'
  AND "lastDecisionAt" > NOW() - INTERVAL '7 days'
ORDER BY "lastDecisionAt" DESC;
```

### Sources Without Evaluation

```sql
-- POOR/CRITICAL sources that haven't been evaluated recently
SELECT
  "sourceSlug",
  "healthState",
  "healthScore",
  "lastBatchAt",
  EXTRACT(EPOCH FROM (NOW() - "lastBatchAt")) / 3600 as hours_since_evaluation,
  "starvationAllowanceCount",
  "lastStarvationAllowanceAt"
FROM "SourceHealth"
WHERE "healthState" IN ('POOR', 'CRITICAL')
  AND ("lastBatchAt" IS NULL OR "lastBatchAt" < NOW() - INTERVAL '72 hours')
ORDER BY hours_since_evaluation DESC NULLS FIRST;
```

---

## Budget Allocation vs Spent

### Budget Multiplier Distribution

```sql
-- How budget multipliers are distributed
SELECT
  "budgetMultiplier",
  COUNT(*) as source_count,
  ROUND(AVG("healthScore")::numeric, 3) as avg_health_score,
  SUM("totalTokensUsed") as total_tokens_consumed
FROM "SourceHealth"
GROUP BY "budgetMultiplier"
ORDER BY "budgetMultiplier" DESC;
```

### Budget Efficiency by Multiplier

```sql
-- Token efficiency at different budget levels
SELECT
  "budgetMultiplier",
  COUNT(*) as source_count,
  SUM("totalTokensUsed") as total_tokens,
  SUM("totalItemsProduced") as total_items,
  ROUND(
    SUM("totalTokensUsed")::numeric / NULLIF(SUM("totalItemsProduced"), 0),
    0
  ) as tokens_per_item,
  ROUND(AVG("avgTokensPerItem")::numeric, 0) as avg_source_efficiency
FROM "SourceHealth"
WHERE "totalAttempts" >= 10
GROUP BY "budgetMultiplier"
ORDER BY "budgetMultiplier" DESC;
```

### Cloud Access Status

```sql
-- Sources by cloud access permission
SELECT
  "allowCloud",
  COUNT(*) as source_count,
  ROUND(AVG("healthScore")::numeric, 3) as avg_health_score,
  SUM("totalTokensUsed") as total_tokens,
  SUM("totalItemsProduced") as total_items
FROM "SourceHealth"
GROUP BY "allowCloud"
ORDER BY "allowCloud" DESC;
```

---

## Health Oscillation Detection (Anti-Flapping)

### Rapid State Changes

```sql
-- Sources with frequent state changes (potential flapping)
WITH state_changes AS (
  SELECT
    "sourceSlug",
    COUNT(*) as changes_7d
  FROM "SourceHealth"
  WHERE "lastDecisionReason" IN ('HEALTH_UPGRADE', 'HEALTH_DOWNGRADE')
    AND "lastDecisionAt" > NOW() - INTERVAL '7 days'
  GROUP BY "sourceSlug"
)
SELECT
  sh."sourceSlug",
  sh."healthState",
  sh."healthScore",
  sc.changes_7d,
  sh."lastDecisionReason",
  sh."lastDecisionAt"
FROM "SourceHealth" sh
JOIN state_changes sc ON sc."sourceSlug" = sh."sourceSlug"
WHERE sc.changes_7d >= 3  -- 3+ state changes in 7 days
ORDER BY sc.changes_7d DESC;
```

### State Stability Report

```sql
-- How long sources stay in each state
SELECT
  "healthState",
  COUNT(*) as source_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600)::numeric, 1) as avg_hours_in_state,
  MIN(EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600) as min_hours,
  MAX(EXTRACT(EPOCH FROM (NOW() - "healthStateEnteredAt")) / 3600) as max_hours
FROM "SourceHealth"
WHERE "healthStateEnteredAt" IS NOT NULL
GROUP BY "healthState"
ORDER BY
  CASE "healthState"
    WHEN 'EXCELLENT' THEN 1
    WHEN 'GOOD' THEN 2
    WHEN 'FAIR' THEN 3
    WHEN 'POOR' THEN 4
    WHEN 'CRITICAL' THEN 5
  END;
```

---

## Observation Mode Monitoring

### Routing Decisions in Observation Mode

```sql
-- Track what would happen if observation mode were off
SELECT
  DATE(timestamp) as date,
  "sourceSlug",
  COUNT(*) as routing_decisions,
  COUNT(*) FILTER (WHERE metadata->>'cloudAllowed' = 'true') as would_allow_cloud,
  COUNT(*) FILTER (WHERE metadata->>'cloudAllowed' = 'false') as would_deny_cloud,
  COUNT(*) FILTER (WHERE metadata->>'observationMode' = 'true') as observation_mode_blocks
FROM "PipelineProgress"
WHERE "stageName" = 'router'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp), "sourceSlug"
ORDER BY date DESC, routing_decisions DESC;
```

### Observation Mode Token Savings

```sql
-- Estimated tokens saved by observation mode
SELECT
  DATE(timestamp) as date,
  SUM(COALESCE((metadata->>'estimatedTokens')::int, 0)) as tokens_would_spend,
  COUNT(*) as decisions_blocked
FROM "PipelineProgress"
WHERE "stageName" = 'router'
  AND metadata->>'observationMode' = 'true'
  AND metadata->>'recommendedProvider' LIKE 'CLOUD%'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```
