# Reliability Audit: Health and Readiness Endpoints

## Endpoint evidence
- **`GET /api/health`** – Performs a database connectivity check using `checkDatabaseHealth`, records latency, and marks the service unhealthy on failures; also flags degraded memory (>95% heap) and returns HTTP 503 when any check fails.【F:src/app/api/health/route.ts†L7-L74】
- **`GET /api/health/ready`** – Executes a direct `SELECT 1` query against the database with a 5s latency threshold, applies stricter memory thresholds (>90% heap fails), enforces a minimum 5s uptime, and returns HTTP 503 when not ready.【F:src/app/api/health/ready/route.ts†L14-L108】

## Expected status behavior
- Liveness (`/api/health`):
  - **200** when DB connectivity succeeds and heap usage remains <95%.
  - **503** when DB is down/slow or heap usage crosses 95% (or process check fails).【F:src/app/api/health/route.ts†L16-L74】
- Readiness (`/api/health/ready`):
  - **200** only when DB query succeeds within 5s, heap usage is ≤90% (degraded between 80–90%), and uptime ≥5s.
  - **503** on DB failures/slow responses, high memory (>90%), or insufficient uptime.【F:src/app/api/health/ready/route.ts†L24-L108】

## Deployment integration evidence
- **Kubernetes probes** use `/api/health` for liveness and `/api/health/ready` for readiness/startup, with documented intervals/timeouts in the deployment manifest.【F:docs/deployment/health-checks-k8s.yaml†L48-L85】
- **Docker Compose example** configures the app container healthcheck to call `/api/health`, makes nginx depend on that health status, and includes a monitor sidecar that polls both `/api/health` and `/api/health/ready`.【F:docs/deployment/docker-compose-health.yaml†L30-L102】

## Findings
- Both endpoints implement explicit database connectivity checks; readiness performs a live query and fails fast on latency or errors, ensuring DB outages propagate as HTTP 503 (acceptance criteria met).【F:src/app/api/health/ready/route.ts†L24-L108】
- Memory safeguards differ by probe (95% vs. 90%), providing progressive degradation vs. readiness gating.【F:src/app/api/health/route.ts†L43-L62】【F:src/app/api/health/ready/route.ts†L55-L78】
- Deployment artifacts wire these endpoints into liveness/readiness/startup probes and reverse-proxy health dependencies, so orchestration reacts to failures automatically.【F:docs/deployment/health-checks-k8s.yaml†L48-L85】【F:docs/deployment/docker-compose-health.yaml†L30-L102】
