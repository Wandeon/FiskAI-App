# Performance Benchmark Plan and SLA Coverage

## Evidence of Existing Tooling and Instrumentation
- **Health endpoint smoke test script**: `scripts/test-health-endpoints.sh` exercises `/api/health`, `/api/health/ready`, and `/api/status`, validating HTTP status and JSON payloads. It is functional but not a load/benchmark harness. 【F:scripts/test-health-endpoints.sh†L1-L73】
- **API request duration logging**: `withApiLogging` wraps API handlers and logs completion with `durationMs`, giving a per-request latency record that can be parsed for percentile calculations. 【F:src/lib/api-logging.ts†L14-L47】
- **Built-in latency checks**: `/api/health` measures database connectivity latency, while `/api/health/ready` applies a 5s readiness threshold and reports latency for DB and memory checks. 【F:src/app/api/health/route.ts†L12-L48】【F:src/app/api/health/ready/route.ts†L18-L65】
- **Metrics endpoint**: `/api/metrics` exposes Prometheus-formatted gauges including `fiskai_db_query_duration_ms`, providing a direct latency sample for DB queries. 【F:src/app/api/metrics/route.ts†L1-L67】
- **Operational timing guidance**: The Operations Runbook documents using `curl -w` templates to inspect endpoint timing during high-latency incidents. 【F:docs/OPERATIONS_RUNBOOK.md†L35-L63】
- **No dedicated load/benchmark tooling located**: Repository review did not find k6/Locust/Artillery/Wrk scripts or automated performance suites. A bespoke benchmark plan is required.

## Proposed Benchmark Plan (do not execute yet)
1. **Environment**: Use the staging environment (`http://erp.metrica.hr:3002`) with production-like data and feature flags mirroring production. Ensure rate limits and auth tokens are configured for the test user.
2. **Tooling outline** (to add):
   - Create a lightweight Node/TypeScript script (e.g., `scripts/perf/bench.ts`) using `undici` or `autocannon` to issue concurrent requests, capture latency histograms, and export JSON/CSV results. Include CLI options for base URL, auth token, concurrency, and duration.
   - Add a `k6` scenario file (e.g., `scripts/perf/bench.k6.js`) for repeatable cloud/local execution with thresholds matching SLAs.
   - Provide a `Makefile` target (`make perf-bench`) that wires environment variables, installs deps, and runs the chosen tool against staging.
3. **Data collection**:
   - Capture raw latency samples from the tool plus response codes and error counts.
   - Collect server-side logs containing `durationMs` emitted by `withApiLogging` during the same window for cross-checking.
   - Scrape `/api/metrics` before and after the run to record `fiskai_db_query_duration_ms` snapshots alongside system uptime/memory from `/api/status`.
4. **Reporting**:
   - Compute P50/P95/P99 per endpoint plus error rate. Flag SLA breaches vs targets.
   - Store results and tool command lines under `docs/07_AUDITS/runs/YYYY-MM-DD-<env>-perf.md` for traceability.

## Endpoints to Measure and Methods
- **List endpoints (target <500ms)**
  - `GET /api/notifications` (messages) and `GET /api/support/tickets` (support tickets). Use authenticated requests with pagination parameters that match typical UI defaults. Measure via concurrent load (5–20 VUs) for 1–3 minutes and verify response JSON size and status codes.
- **Detail endpoints (target <200ms)**
  - `POST /api/notifications/read` (mark read) and `GET /api/receipts/view?id=<id>` (rendered receipt). Issue single-request sequences to avoid batching effects; validate payload correctness and timing.
- **AI extraction (target <30s end-to-end)**
  - `POST /api/ai/extract` with text-only and image payload cases. Include rate-limit headers in the capture and record model turnaround time. Cap payload size to realistic receipts to avoid inflating timing.
- **Monitoring/control**
  - `GET /api/health`, `/api/health/ready`, `/api/status`, `/api/metrics` to verify platform stability before/after load and to correlate DB latency samples.

## Capturing P95 Metrics
- **From application logs**: Parse structured logs emitted by `withApiLogging` to extract `durationMs` per path, then compute P95 using a log processor (e.g., `jq` + `datamash` or a small Node script). Ensure log sampling is disabled during the run for completeness. 【F:src/lib/api-logging.ts†L14-L47】
- **From metrics endpoint**: Sample `fiskai_db_query_duration_ms` before/after each run to contextualize DB latency trends, acknowledging it is a single-query snapshot rather than full histogram. 【F:src/app/api/metrics/route.ts†L12-L66】
- **External APM (if enabled)**: If Sentry/other APM traces are active, configure a dashboard to display transaction duration percentiles per route; otherwise rely on logs + client-side measurements.

## Acceptance Coverage
- Documented existing instrumentation (health checks, metrics, logging) and absence of dedicated load tools.
- Provided a runnable plan with tooling outline, endpoints mapped to SLA targets, and clear P95 capture methods.
