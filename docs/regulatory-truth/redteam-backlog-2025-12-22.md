# Regulatory Truth Layer Red-Team Backlog (2025-12-22)

Artifacts: docs/regulatory-truth/audit-artifacts/2025-12-22/

## RT-001 Evidence hash mismatch for JSON sources (INV-1)

Severity: P0
Component: Sentinel/Evidence store
Steps to reproduce:

1. Run: `DATABASE_URL=... npx tsx /home/admin/FiskAI/tmp/evidence-hash-check-ids.ts cmjh7iveg001p56wazm1wofgg`
2. Compare stored vs computed hash.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/evidence_hash_check_two_sources.json
- docs/regulatory-truth/audit-artifacts/2025-12-22/evidence_hash_sample_10.json
- docs/regulatory-truth/audit-artifacts/2025-12-22/hnb_hash_debug.json
  Expected: `contentHash` equals `hash(rawContent)` for every evidence row.
  Actual: HNB and Narodne novine JSON/JSON-LD rows store a hash of minified JSON, but `rawContent` is pretty-printed JSON; hashes diverge.
  Root cause hypothesis: fetchers compute hash on `JSON.stringify(obj)` but store `JSON.stringify(obj, null, 2)`.
  Fix suggestion: compute hash from the exact `rawContent` string (or store canonicalized JSON plus canonicalization metadata and hash the canonical form); add regression test for JSON evidence hashing.
  Acceptance criteria: `computed == stored` for JSON/JSON-LD evidence across a random sample; CI test for HNB + NN ELI passes.

## RT-002 Approved rule without evidence pointers

Severity: P0
Component: Composer/Reviewer Gate
Steps to reproduce:

1. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT id, \"conceptSlug\", status FROM \"RegulatoryRule\" WHERE id='cmjfyu6kj0004e9wa5ndbtxeo';"`
2. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT count(*) FROM \"SourcePointer\" WHERE \"ruleId\"='cmjfyu6kj0004e9wa5ndbtxeo';"`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/rules_without_pointers_current.txt
  Expected: rules cannot be APPROVED without at least one evidence pointer.
  Actual: rule `fiskalizacija-datum-primjene` is APPROVED with zero pointers.
  Root cause hypothesis: reviewer/approval path does not enforce pointer count; composer allowed empty evidence.
  Fix suggestion: block approval if pointer_count == 0; add DB constraint or reviewer gate check; add audit check in release pipeline.
  Acceptance criteria: query returns zero APPROVED/PUBLISHED rules without pointers; approval attempt rejected with clear error.

## RT-003 Assistant provides uncited regulatory claims (INV-6)

Severity: P0
Component: Assistant
Steps to reproduce:

1. Run: `npx tsx /home/admin/FiskAI/tmp/assistant-test-suite.ts --url http://127.0.0.1:3000`
2. Inspect responses for URLs/quotes.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/assistant_test_suite.json
- docs/regulatory-truth/audit-artifacts/2025-12-22/assistant_vat_response.txt
- docs/regulatory-truth/audit-artifacts/2025-12-22/assistant_vat_citation_check.json
  Expected: every answer includes rule id/concept, source URL, exact quote, and last verified date; no uncited regulatory claims.
  Actual: answers provide regulatory rates with no citations; URL compliance 10% and no quotes in most responses.
  Root cause hypothesis: assistant responses are not wired to the evidence/rule retrieval layer or citation enforcement is missing.
  Fix suggestion: enforce evidence retrieval in assistant pipeline; block output unless citations are attached; add automated citation compliance tests.
  Acceptance criteria: citation compliance >= 95% across the test suite; zero uncited regulatory claims.

## RT-004 Assistant reliability: high timeout rate

Severity: P1
Component: Assistant
Steps to reproduce:

1. Run: `npx tsx /home/admin/FiskAI/tmp/assistant-test-suite.ts --url http://127.0.0.1:3000`
2. Count AbortErrors.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/assistant_test_suite.json (24/30 errors)
  Expected: error rate < 5% for assistant requests.
  Actual: 24/30 requests aborted (AbortError).
  Root cause hypothesis: backend latency/timeouts or model call failures; insufficient retry/timeout handling.
  Fix suggestion: instrument request latency and failure reason; add retries with exponential backoff; raise timeout where needed.
  Acceptance criteria: error rate < 5% and p95 latency within agreed SLO.

## RT-005 Conflict detection appears inactive (INV-5)

Severity: P1
Component: Conflict detector / Arbiter
Steps to reproduce:

1. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT count(*) FROM \"RegulatoryConflict\";"`
2. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT count(*) FROM \"AgentRun\" WHERE \"agentType\"='ARBITER' AND \"createdAt\" > now()-interval '7 days';"`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/conflicts_total.txt
- docs/regulatory-truth/audit-artifacts/2025-12-22/arbiter_runs_7d.txt
  Expected: conflicts are created for overlapping sources (LAW vs GUIDANCE) and arbiter runs regularly.
  Actual: 0 conflicts; no arbiter runs in 7 days.
  Root cause hypothesis: conflict triggers disabled or overlap detection missing; arbiter not scheduled.
  Fix suggestion: add deterministic conflict tests with synthetic overlap; schedule arbiter runs; add monitoring for conflict creation rate.
  Acceptance criteria: conflicts created for known overlapping topics; arbiter run count >0 in 7 days.

## RT-006 Evidence quote mismatch for HTML sources

Severity: P1
Component: Extractor/SourcePointer
Steps to reproduce:

1. Run the query in `docs/regulatory-truth/audit-artifacts/2025-12-22/html_quote_mismatch_sample.txt`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/quote_mismatch_rate_all.txt
- docs/regulatory-truth/audit-artifacts/2025-12-22/quote_mismatch_by_contenttype.txt
- docs/regulatory-truth/audit-artifacts/2025-12-22/html_quote_mismatch_sample.txt
  Expected: `exactQuote` must be a substring of `rawContent` after normalization.
  Actual: 10/60 HTML pointers have exactQuote not found in rawContent (sample includes Porezna sources).
  Root cause hypothesis: quote extraction uses cleaned text not aligned with stored raw HTML; missing normalization steps.
  Fix suggestion: store normalized text alongside rawContent and validate quotes against normalized form; block approval if mismatch.
  Acceptance criteria: mismatch rate <1% overall, 0% for APPROVED/PUBLISHED rules.

## RT-007 Monitoring endpoints time out (missing observability)

Severity: P1
Component: Monitoring/Operations
Steps to reproduce:

1. `curl --max-time 10 http://127.0.0.1:3000/api/regulatory/status`
2. `curl --max-time 10 http://127.0.0.1:3000/api/regulatory/metrics`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_status_response.exitcode
- docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_metrics_response.exitcode
- docs/regulatory-truth/audit-artifacts/2025-12-22/app_container_econnrefused_snippet.txt
  Expected: monitoring endpoints respond with status/metrics within 1s.
  Actual: requests time out (exit code 124); logs show ECONNREFUSED.
  Root cause hypothesis: Redis/queue dependency not reachable or monitoring route misconfigured.
  Fix suggestion: harden monitoring endpoints with dependency checks and timeouts; add health check tests in CI.
  Acceptance criteria: endpoints return within 1s and include queue + pipeline stats.

## RT-008 High extractor/composer/releaser failure rates

Severity: P1
Component: Extractor/Composer/Releaser
Steps to reproduce:

1. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT \"agentType\", status, count(*) FROM \"AgentRun\" WHERE \"createdAt\" > now()-interval '24 hours' GROUP BY 1,2 ORDER BY 1,2;"`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/agent_runs_24h_current.txt
  Expected: failure rates <5% per agent type.
  Actual: Extractor failed 66 vs 45 completed; Composer failed 9 vs 12 completed; Releaser failed 3 of 4.
  Root cause hypothesis: systemic pipeline errors; insufficient retries or upstream data issues.
  Fix suggestion: inspect error logs per agent run; add failure categorization and retry policy; alert on failure ratio.
  Acceptance criteria: failure rate <5% over 7 days; actionable error categories with run links.

## RT-009 Source freshness gaps

Severity: P1
Component: Sentinel/Scheduler
Steps to reproduce:

1. `DATABASE_URL=... psql $DATABASE_URL -c "SELECT count(*) FROM \"RegulatorySource\" WHERE \"lastFetched\" IS NULL;"`
2. `DATABASE_URL=... psql $DATABASE_URL -c "SELECT count(*) FROM \"RegulatorySource\" WHERE \"nextCheck\" < now();"`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/sources_null_lastFetched.txt
- docs/regulatory-truth/audit-artifacts/2025-12-22/sources_needing_check.txt
  Expected: all sources have recent lastFetched and scheduled nextCheck.
  Actual: 12 sources have null lastFetched; 16 sources overdue.
  Root cause hypothesis: missing scheduler runs or seed sources not picked up by sentinel.
  Fix suggestion: ensure scheduler loop runs; add alert on stale sources; backfill lastFetched.
  Acceptance criteria: null lastFetched = 0; overdue sources <2.

## RT-010 Discovery latency metrics are unrealistic

Severity: P1
Component: Sentinel/Metadata
Steps to reproduce:

1. Run: `DATABASE_URL=... psql $DATABASE_URL -c "SELECT avg(EXTRACT(EPOCH FROM (\"fetchedAt\"-\"publishedAt\"))/60) as avg_minutes, percentile_cont(0.5) within group (order by EXTRACT(EPOCH FROM (\"fetchedAt\"-\"publishedAt\"))/60) as p50_minutes FROM \"Evidence\" WHERE \"publishedAt\" IS NOT NULL;"`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/discovery_latency.txt
  Expected: median latency hours-to-days for active sources.
  Actual: avg 290,627 minutes; p50 366,707 minutes (likely incorrect publishedAt).
  Root cause hypothesis: publishedAt extraction missing or defaulting to epoch; using wrong timezone.
  Fix suggestion: parse published dates for each source type; add validation and fallback rules; monitor distribution.
  Acceptance criteria: p50 latency < 1 day for active sources; outliers flagged.

## RT-011 appliesWhen parsing invalid for drafts

Severity: P2
Component: Composer
Steps to reproduce:

1. Run: `DATABASE_URL=... npx tsx /home/admin/FiskAI/tmp/check-applies-when.ts`
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/applieswhen_check.json
  Expected: all appliesWhen expressions parse and evaluate.
  Actual: 13 rules have invalid appliesWhen strings (drafts).
  Root cause hypothesis: composer emits malformed DSL for certain inputs.
  Fix suggestion: validate appliesWhen at compose-time; reject/flag invalid DSL.
  Acceptance criteria: invalid count = 0 for new compositions.

## RT-012 Gold dataset coverage gaps

Severity: P2
Component: QA/Test Coverage
Steps to reproduce:

1. Review gold set evaluation results in `gold_date_eval.json` and `quote_value_check.json`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-22/gold_date_eval.json
- docs/regulatory-truth/audit-artifacts/2025-12-22/quote_value_check.json
  Expected: gold set covers numeric rates, thresholds, exceptions, and multi-authority conflicts.
  Actual: gold set covers only date/text fields; numeric extraction accuracy and exception handling are unknown.
  Root cause hypothesis: missing test dataset for numeric/exception cases.
  Fix suggestion: add 10-20 gold examples for PDV rates, thresholds, and exception language; include PDF/JSON cases.
  Acceptance criteria: gold set includes numeric and exception cases; precision/recall reported for each value type.

## RT-013 Review gate enforcement unverified for T0/T1

Severity: P2
Component: Reviewer/Gates
Steps to reproduce:

1. Attempt to publish a release candidate with an unapproved T0 rule and observe gate behavior.
   Evidence:

- No staged release candidate with T0/T1 rules currently published.
  Expected: T0/T1 cannot be published without approvedBy and gate thresholds.
  Actual: Not verifiable on current dataset; missing test scenario.
  Root cause hypothesis: gating logic untested in staging-like conditions.
  Fix suggestion: add automated gate test that tries to publish unapproved T0/T1 rules in CI.
  Acceptance criteria: test fails if gate permits unapproved T0/T1; audit log shows blocked release.

## RT-014 Missing observability inputs (dashboards/config)

Severity: P2
Component: Monitoring/Operations
Steps to reproduce:

1. Request reviewer dashboard and Bull board access plus current schedules/rate limits/model prompts.
   Evidence:

- No provided URLs or credentials for reviewer dashboard/Bull board; no config bundle delivered.
  Expected: operator supplies dashboard URLs and current runtime config for audit defensibility.
  Actual: missing access items; audit relied on DB/scripts only.
  Root cause hypothesis: observability access not part of audit checklist/handshake.
  Fix suggestion: add a required preflight checklist (dashboards, config snapshot, model/prompt versions) before audit starts.
  Acceptance criteria: audit pack includes dashboard links and a config snapshot before testing begins.
