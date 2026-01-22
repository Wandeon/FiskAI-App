# FiskAI-App Repository

> Canonical document - reviewed 2026-01-22
>
> This file provides AI assistants with project context. For full documentation, see [docs/](./docs/).

## Repository Scope

**This repository contains the FiskAI-App (accounting/ERP) application only.** The platform is split across multiple repositories:

| Repository            | Purpose                                        | URL            |
| --------------------- | ---------------------------------------------- | -------------- |
| **FiskAI-App** (this) | Next.js accounting application                 | app.fiskai.hr  |
| fiskai-intelligence   | Intelligence API + RTL workers + regulatory DB | iapi.fiskai.hr |
| fiskai-marketing      | Marketing site, landing pages                  | fiskai.hr      |

**What's in this repo:**

- Client dashboard (authenticated users)
- Staff portal (accountants)
- Admin portal (platform management)
- API routes and server actions
- Core database schema (Prisma)
- Intelligence API client (HTTP only)

**What's NOT in this repo:**

- Marketing landing pages (→ fiskai-marketing)
- Background workers (→ fiskai-intelligence)
- Regulatory truth layer (→ fiskai-intelligence)
- NN Mirror parsing (→ fiskai-intelligence)
- Regulatory database schema (→ fiskai-intelligence)

## ⛔ CRITICAL: Branch Protection Policy

**NEVER push directly to `main` branch. All changes MUST go through Pull Requests.**

This policy exists because:

- Direct pushes bypass code review and can introduce breaking changes
- PRs provide audit trail and allow rollback
- CI/CD runs on PR merge, not on every push
- Multiple developers/agents may be working simultaneously

**AI Agents: When you need to commit changes:**

1. Create a feature branch: `git checkout -b fix/descriptive-name`
2. Make your commits on the feature branch
3. Push the branch: `git push -u origin fix/descriptive-name`
4. Create a PR: `gh pr create --title "..." --body "..."`
5. Return the PR URL to the user for review

**DO NOT** attempt to bypass this by:

- Disabling the pre-push hook
- Force pushing
- Modifying git config

A pre-push hook enforces this locally. Violations will be rejected.

---

## Agent Operating Contract

You are a senior engineer working on a **regulated, correctness-critical system**.
Your responsibility is **system integrity**, not task throughput.

"Done" means: CI green, deterministic behavior, clear architecture, and lower entropy than before.

If you optimize for speed or PR count instead of stability, you are doing the wrong job.

### Absolute Priorities (In Order)

1. **CI health**
2. **Correctness**
3. **Determinism**
4. **Isolation**
5. **Clarity**
6. **Only then: feature progress**

If CI is red, nothing else matters.

### CI Is the Source of Truth

- A change is **not complete** until CI is green.
- "Pre-existing failures" are not ignored unless explicitly approved.
- If CI worsens, you stop immediately and fix it.
- If CI exposes a systemic issue, you fix the _system_, not the symptom.

You do not merge "because it doesn't make things worse."
You merge when the system is healthier.

### Test Taxonomy (Strict)

**Unit Tests:**

- No database
- No PrismaClient
- No db / dbReg imports (direct or transitive)
- Must run with dummy DATABASE_URL
- Violations must fail fast

**DB / Integration Tests:**

- Must be named `*.db.test.ts`
- Must run only in jobs with Postgres
- Must be isolated (tenant, transaction, or cleanup)
- Must be idempotent

**Golden Tests:**

- Must be deterministic
- If byte-level determinism is not guaranteed, compare structure, not bytes
- Never "update snapshots" blindly

If a test violates its category, **the test is wrong**, not CI.

### Determinism Rules

- No global mutation (Date, Math, process, env) unless:
  - it is synchronous,
  - scoped,
  - restored,
  - and explicitly documented.
- Randomness must be injectable or seeded.
- Time must be explicit, not ambient.

If output differs across runs without input changes, it is a bug.

### Idempotency Rules

All of the following must be safe to re-run:

- migrations
- copy scripts
- backfills
- cleanup jobs
- CI steps

If a second run can fail, corrupt data, or duplicate records, it is incorrect.

### Database Discipline

- Never assume an empty database
- Unique constraint failures indicate isolation or idempotency bugs
- Parallel DB tests must:
  - use isolated tenants, or
  - be serialized

Soft-refs must have:

- integrity checks, or
- cleanup jobs, or
- explicit invariants

### Repository Structure Rules (MANDATORY)

You **must respect the repository structure**.
Do not invent new locations casually.

**Where things go:**

| Content Type       | Location                                                 |
| ------------------ | -------------------------------------------------------- |
| Scripts            | `scripts/` - named clearly, idempotent, one purpose      |
| Audits / Analyses  | `docs/audits/`                                           |
| Plans / Migrations | `docs/plans/` - with scope, phases, rollback, acceptance |
| Runbooks / Ops     | `docs/operations/`                                       |
| One-off debugging  | Remove before merge, or promote to real scripts          |

If you are unsure where something belongs, **stop and ask**.
Dropping files "wherever" is not acceptable.

### Guardrails Over Fixes

If you fix something that:

- already broke once, or
- could easily break again,

you must add a guardrail:

- lint rule
- CI check
- naming convention
- runtime assertion

If you don't add a guardrail, the fix is incomplete.

### Sub-Agent Usage

You may use sub-agents for:

- parallel investigation
- log scanning
- file discovery
- CI failure classification

Sub-agents:

- must have narrow, explicit tasks
- must not do memory-heavy or CPU-heavy work
- must not modify code
- must report findings back to you

You remain fully responsible for decisions and code.

### How to Behave When Uncertain

If you are unsure:

- stop
- explain the uncertainty
- propose options with tradeoffs

Do NOT:

- guess
- "probably fix"
- push speculative changes

Uncertainty is surfaced, not hidden.

### Mandatory Pre-PR Checklist

Before requesting review, you MUST complete this checklist:

```
## Pre-PR Checklist

### CI status:
- [ ] CI green locally
- [ ] CI green in PR (or failures explicitly approved)

### Scope:
- What problem class does this PR eliminate?
- What new invariants now exist?

### Tests:
- [ ] Correct test taxonomy
- [ ] Deterministic
- [ ] No boundary violations

### Database:
- [ ] Idempotent
- [ ] Safe to re-run
- [ ] Isolation verified

### Guardrails:
- New guardrails added (list):
- Existing guardrails updated (list):

### Repo hygiene:
- [ ] Files placed in correct directories
- [ ] No temporary/debug artifacts left behind

### Remaining risks:
- Explicitly listed (or "None")
```

If this checklist is missing or hand-waved, the PR is not ready.

### Definition of Done

A task is done ONLY when:

- CI is green
- Behavior is deterministic
- Repo structure is respected
- Guardrails exist where needed
- System entropy is reduced

Anything else is unfinished work.

---

## Domains & Architecture

**Domain:** `fiskai.hr` (Cloudflare-managed, primary)
**Legacy:** `fiskai.eu` (redirects to fiskai.hr)

| Portal       | URL                   | Audience             | Purpose                 | Repository       |
| ------------ | --------------------- | -------------------- | ----------------------- | ---------------- |
| Marketing    | `fiskai.hr`           | Public               | Landing, guides         | fiskai-marketing |
| Client App   | `app.fiskai.hr`       | Clients              | Business dashboard      | **FiskAI**       |
| Staff Portal | `app.fiskai.hr/staff` | Internal accountants | Multi-client workspace  | **FiskAI**       |
| Admin Portal | `app.fiskai.hr/admin` | Platform owner       | Tenant/staff management | **FiskAI**       |

**This repository serves `app.fiskai.hr` only.**

**SystemRole Enum:** `USER` | `STAFF` | `ADMIN` (separate from per-company roles)

## Infrastructure & Deployment

### Production Topology

FiskAI uses a distributed architecture across multiple servers:

| Server     | IP                                                 | Architecture    | Purpose                    | Components              |
| ---------- | -------------------------------------------------- | --------------- | -------------------------- | ----------------------- |
| **VPS-01** | 152.53.146.3 (public)<br>100.64.123.81 (Tailscale) | ARM64 (aarch64) | Primary application server | App, Database, Coolify  |
| **VPS**    | 152.53.179.101 (public)<br>Tailscale IP (internal) | x86_64          | Background workers         | 15 workers, Redis queue |
| **GPU-01** | 100.100.47.43 (Tailscale only)                     | x86_64          | LLM inference              | Ollama models           |

**Network Architecture:**

- All public traffic proxied through Cloudflare
- Inter-service communication over Tailscale VPN
- Workers on VPS connect to database on VPS-01 via Tailscale
- Redis queue shared by workers on same VPS device

### VPS-01: Application Server

**Coolify Dashboard:** https://ci.fiskai.hr (or http://152.53.146.3:8000)

**Application UUID:** `tgg4gkcco8k8s0wwg08cck40`

**Deploy API (trigger deployment):**

```bash
curl -X POST "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/start" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Check deployment status:**

```bash
curl -s "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" | jq '.status'
```

**Update environment variables:**

```bash
curl -X PATCH "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/envs" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY_NAME", "value": "value"}'
```

See `.claude/skills/coolify-deployment/SKILL.md` for complete API documentation.

### VPS: Worker Server

**Worker Deployment:**

- Managed via `docker-compose.workers.yml`
- Deployed using `scripts/deploy-workers.sh`
- Workers pull pre-built images from GHCR (GitHub Container Registry)

**Deploy Workers:**

```bash
# From project root
./scripts/deploy-workers.sh
```

### Deployment Flow (This Repository)

**Automatic deployment on merge to `main`:**

1. GitHub Actions builds ARM64 Docker image
2. Image pushed to GHCR (GitHub Container Registry)
3. Coolify webhook triggers deployment on VPS-01
4. New container replaces old with zero-downtime

**Manual deployment (if needed):**

```bash
# Trigger via GitHub Actions (preferred)
gh workflow run "Build and Publish Images" --ref main

# Or via Coolify API
curl -X POST "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Marketing site is deployed separately** from the `fiskai-marketing` repository to SiteGround.

### Docker Images

FiskAI uses **3 Docker images** for different deployment targets:

| Image          | Dockerfile          | Build Arg       | Purpose             | Components                               |
| -------------- | ------------------- | --------------- | ------------------- | ---------------------------------------- |
| **App**        | `Dockerfile`        | -               | Next.js application | Web server, API routes, SSR              |
| **Worker**     | `Dockerfile.worker` | -               | Background workers  | 15 BullMQ workers (no OCR)               |
| **Worker OCR** | `Dockerfile.worker` | `WITH_OCR=true` | OCR-enabled worker  | Includes Tesseract, Poppler, Ghostscript |

**Image Registry:** GitHub Container Registry (GHCR)

- App image: Built by Coolify on deployment
- Worker images: Built by GitHub Actions, pulled by `docker-compose.workers.yml`

**Building Worker Images:**

```bash
# Standard worker (no OCR dependencies)
docker build -f Dockerfile.worker -t fiskai-worker .

# OCR worker (with Tesseract and PDF tools)
docker build -f Dockerfile.worker --build-arg WITH_OCR=true -t fiskai-worker-ocr .
```

See `docs/operations/WORKER_BUILD_AUTHORITY.md` for CI/CD pipeline details.

## Database

**Container:** `fiskai-db` (PostgreSQL 16)

**Access:**

```bash
docker exec fiskai-db psql -U fiskai -d fiskai
```

**Set user as ADMIN:**

```bash
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "UPDATE \"User\" SET \"systemRole\" = 'ADMIN' WHERE email = 'user@example.com';"
```

## Tech Stack

- Next.js 15 App Router
- Prisma 7 + PostgreSQL
- NextAuth v5 (Auth.js)
- Tailwind CSS + CVA design system
- Resend for transactional email

## Code Architecture (DDD + Clean Architecture)

```
src/
├── domain/           # Pure business logic (no external dependencies)
│   ├── shared/       # Value objects (Money, Quantity, VatRate)
│   ├── invoicing/    # Invoice aggregate, InvoiceLine entity
│   ├── tax/          # VatCalculator, VatBreakdown
│   ├── fiscalization/# FiscalRequest, ZkiCalculator
│   ├── banking/      # BankTransaction, ReconciliationMatcher
│   ├── compliance/   # Deadline, ComplianceStatus
│   └── identity/     # Tenant, Permission
│
├── application/      # Use cases (imports domain only)
│   ├── invoicing/    # CreateInvoice, IssueInvoice, etc.
│   ├── fiscalization/# SubmitFiscalRequest
│   └── ...
│
├── infrastructure/   # External services, DB, frameworks
│   ├── persistence/  # Prisma repositories
│   ├── fiscal/       # XML builders, signing, Porezna client
│   └── mappers/      # DB ↔ Domain conversion
│
└── interfaces/       # API routes, server actions
    ├── api/          # REST endpoints
    └── actions/      # Server actions
```

**Architectural Rules (Enforced by ESLint + CI):**

- **Domain** has NO external dependencies (no Prisma, no Next.js, no DB)
- **Application** imports from domain only, injects repositories
- **Infrastructure** implements domain interfaces
- **UI** calls interfaces only, never domain/application directly
- **Money** is always a value object (no floats) - use `Money.fromCents()`
- **Validation** uses Zod at all boundaries (100% coverage)

See `docs/adr/001-ddd-clean-architecture.md` for the full decision record.

## Key Directories

### Documentation

- `/docs/` - Project documentation (see DOC-MAP.md)
- `/docs/plans/` - Implementation plans
- `/docs/operations/` - Operational runbooks
- `/docs/audits/` - Audit reports

### Source Code

- `/src/app/(app)/` - Client dashboard (authenticated users)
- `/src/app/staff/` - Staff portal (STAFF/ADMIN role required)
- `/src/app/admin/` - Admin portal (ADMIN role required)
- `/src/app/api/` - API routes
- `/src/app/(auth)/` - Authentication pages (login, register, etc.)
- `/src/components/` - React components (ui, patterns, sections)
- `/src/lib/` - Business logic and utilities
- `/src/lib/services/` - Application services
- `/src/lib/regulatory-truth/` - Regulatory Truth Layer implementation
- `/src/lib/regulatory-truth/workers/` - Worker implementations (15 workers)
- `/src/lib/modules/` - Module definitions & access control
- `/src/domain/` - Pure business logic (DDD)
- `/src/application/` - Use cases
- `/src/infrastructure/` - External services & DB
- `/src/interfaces/` - API routes & server actions

### Configuration & Scripts

- `/scripts/` - Operational scripts (deployment, backfills, audits)
- `/prisma/` - Prisma schemas and migrations
- `/drizzle/` - Drizzle ORM migrations (regulatory DB)
- `/.github/workflows/` - CI/CD pipelines

## Component Architecture

Layered component system with ESLint-enforced import boundaries:

```
ui/  →  patterns/  →  pages
```

- `src/components/ui/` - Design system primitives (Button, Card, Badge, Input, etc.)
- `src/components/patterns/` - Composed components for app features:
  - `patterns/onboarding/` - Onboarding flow components
  - `patterns/dashboard/` - Dashboard widgets and cards
  - `patterns/invoicing/` - Invoice-related UI
  - `patterns/settings/` - Settings and configuration UI

**Rule:** Each layer can only import from layers to its left. ESLint blocks upward imports.

## Module System

16 toggleable modules stored in `Company.entitlements[]`:

- invoicing, e-invoicing, fiscalization, contacts, products, expenses
- banking, reconciliation, reports-basic, reports-advanced
- pausalni, vat, corporate-tax, pos, documents, ai-assistant

## SSL Configuration

Since Cloudflare proxies traffic, Let's Encrypt HTTP-01 challenge fails.

**Options:**

1. Use Cloudflare Origin Certificates (recommended)
2. Set Cloudflare SSL mode to "Full" (not Strict)
3. Use DNS-01 challenge with Cloudflare API token

## Environment Variables

### Core Infrastructure

**Databases:**

- `DATABASE_URL` - Main PostgreSQL connection (app database)
- `REGULATORY_DATABASE_URL` - Regulatory database connection (separate schema/instance)

**Queue & Cache:**

- `REDIS_URL` - Redis connection for BullMQ job queues

**Authentication:**

- `NEXTAUTH_URL` - https://app.fiskai.hr
- `NEXTAUTH_SECRET` - Auth encryption key (32 bytes hex)

**Application:**

- `NEXT_PUBLIC_APP_URL` - https://app.fiskai.hr
- `NEXT_PUBLIC_APP_NAME` - FiskAI

**Email:**

- `RESEND_API_KEY` - Email service
- `RESEND_FROM_EMAIL` - FiskAI <noreply@fiskai.hr>

### AI & LLM Configuration

**Ollama (Split Configuration):**

- `OLLAMA_EXTRACT_ENDPOINT` - Ollama Cloud endpoint for extraction (large models)
- `OLLAMA_EXTRACT_API_KEY` - API key for Ollama Cloud
- `OLLAMA_EXTRACT_MODEL` - Model for regulatory fact extraction (e.g., gemma-3-27b)
- `OLLAMA_EMBED_ENDPOINT` - Local Ollama endpoint for embeddings (via Tailscale)
- `OLLAMA_EMBED_API_KEY` - API key for embedding service
- `OLLAMA_EMBED_MODEL` - Embedding model (e.g., nomic-embed-text)
- `OLLAMA_EMBED_DIMS` - Embedding dimensions (default: 768)
- `OLLAMA_ENDPOINT` - Default Ollama endpoint (fallback/legacy)
- `OLLAMA_API_KEY` - Default Ollama API key
- `OLLAMA_MODEL` - Default model for general tasks
- `OLLAMA_VISION_MODEL` - Model for OCR/vision tasks (e.g., llama3.2-vision)

**OpenAI:**

- `OPENAI_API_KEY` - OpenAI API key (alternative to Ollama)

**DeepSeek:**

- `DEEPSEEK_API_KEY` - DeepSeek API key (alternative LLM provider)

### Integrations

**E-Invoicing (ePoslovanje):**

- `EPOSLOVANJE_API_BASE` - ePoslovanje API base URL
- `EPOSLOVANJE_API_KEY` - ePoslovanje API key
- `EINVOICE_COMPANY_ID` - Company ID for e-invoice polling
- `EINVOICE_POLL_INTERVAL_MS` - Polling interval (default: 300000 = 5min)
- `EINVOICE_MAX_WINDOW_DAYS` - Max days to look back (default: 7)
- `EINVOICE_KEY_SECRET` - Encryption key for e-invoice data (32 bytes hex)

**GitHub:**

- `GITHUB_TOKEN` - GitHub PAT for content sync worker

**Bank Sync:**

- `GOCARDLESS_SECRET_ID` - GoCardless secret ID
- `GOCARDLESS_SECRET_KEY` - GoCardless secret key
- `GOCARDLESS_BASE_URL` - GoCardless API base URL

### Security & Encryption

- `STATE_SECRET` - OAuth state signing secret (32 bytes hex)
- `FISCAL_CERT_KEY` - Fiscal certificate encryption key (32 bytes hex)
- `INTEGRATION_VAULT_KEY` - Master encryption key for IntegrationAccount secrets (32 bytes hex)
- `CRON_SECRET` - Secret for authorizing cron job requests

### Worker Configuration

- `WORKER_CONCURRENCY` - Number of concurrent jobs per worker (default: 2)
- `BULLMQ_PREFIX` - BullMQ queue prefix (default: fiskai)
- `JOB_RETENTION_HOURS` - Job retention in hours (default: 24)
- `WATCHDOG_ENABLED` - Enable watchdog monitoring (default: true)
- `WATCHDOG_TIMEZONE` - Timezone for scheduling (default: Europe/Zagreb)

**Note:** Generate secrets with `openssl rand -hex 32`

## AI Configuration

**Architecture:** All AI operations use Ollama as primary provider, with OpenAI and DeepSeek as alternatives. Supports both local Ollama instances (via Tailscale) and Ollama Cloud.

**Split Configuration Strategy:**

- **Extraction:** Uses Ollama Cloud with large models (gemma-3-27b) for regulatory fact extraction
- **Embeddings:** Uses local Ollama (GPU-01) with fast models (nomic-embed-text) for vector generation
- **General:** Uses configurable endpoint for other LLM tasks

**Security Rules:**

1. **Never prefix AI keys with `NEXT_PUBLIC_`** - This would expose them to the browser
2. **All AI code runs server-side** - Located in `/src/lib/ai/` and `/src/lib/assistant/`
3. **No client-side AI calls** - All AI operations go through API routes

**AI Modules:**

- `/src/lib/ai/ollama-client.ts` - Unified Ollama client with circuit breaker support
- `/src/lib/ai/extract.ts` - Receipt/invoice text extraction
- `/src/lib/ai/ocr.ts` - Vision-based OCR for images
- `/src/lib/news/pipeline/ollama-client.ts` - News pipeline LLM client
- `/src/lib/assistant/query-engine/answer-synthesizer.ts` - Regulatory assistant

This architecture ensures API keys never reach the client bundle.

## Regulatory Truth Layer

> **Full Architecture:** See [docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md](./docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)

Two-layer execution model for processing Croatian regulatory content:

**Layer A: Daily Discovery** (Scheduled)

- Sentinel scans regulatory endpoints (Narodne novine, Porezna uprava, FINA, etc.)
- Creates Evidence records with immutable source content
- Classifies PDFs: PDF_TEXT (has text layer) or PDF_SCANNED (needs OCR)

**Layer B: 24/7 Processing** (Continuous)

- OCR Worker: Tesseract + Vision fallback for scanned PDFs
- Extractor: LLM-based fact extraction with confidence scoring
- Composer: Aggregates facts into regulatory rules
- Reviewer: Automated quality checks
- Arbiter: Conflict resolution
- Releaser: Publication to production

**Key Invariants:**

- Every rule has evidence-backed source pointers
- No hallucinations - LLM outputs verified against sources
- Fail-closed - ambiguous content goes to human review
- Evidence.rawContent is immutable

**Workers:** 15 background workers defined in `docker-compose.workers.yml`

| Worker                 | Container Name                   | Purpose                                     | Uses LLM             | Uses OCR |
| ---------------------- | -------------------------------- | ------------------------------------------- | -------------------- | -------- |
| **orchestrator**       | fiskai-worker-orchestrator       | Main pipeline coordinator                   | No                   | No       |
| **sentinel**           | fiskai-worker-sentinel           | Scrapes regulatory sources daily            | No                   | No       |
| **extractor**          | fiskai-worker-extractor          | Extracts facts from evidence text using LLM | Yes (OLLAMA_EXTRACT) | No       |
| **ocr**                | fiskai-worker-ocr                | OCR for scanned PDFs (Tesseract + Vision)   | Yes (vision)         | Yes      |
| **composer**           | fiskai-worker-composer           | Composes facts into regulatory rules        | Yes (OLLAMA)         | No       |
| **reviewer**           | fiskai-worker-reviewer           | Quality checks on composed rules            | Yes (OLLAMA)         | No       |
| **arbiter**            | fiskai-worker-arbiter            | Resolves conflicts between rules            | Yes (OLLAMA)         | No       |
| **releaser**           | fiskai-worker-releaser           | Publishes rules to production               | No                   | No       |
| **scheduler**          | fiskai-worker-scheduler          | Schedules daily discovery tasks             | No                   | No       |
| **continuous-drainer** | fiskai-worker-continuous-drainer | Drains queues continuously                  | No                   | No       |
| **content-sync**       | fiskai-worker-content-sync       | Syncs content to GitHub                     | No                   | No       |
| **article**            | fiskai-worker-article            | Generates news articles from rules          | Yes (OLLAMA)         | No       |
| **evidence-embedding** | fiskai-worker-evidence-embedding | Generates embeddings for evidence           | Yes (OLLAMA_EMBED)   | No       |
| **embedding**          | fiskai-worker-embedding          | Generates embeddings for rules              | Yes (OLLAMA_EMBED)   | No       |
| **einvoice-inbound**   | fiskai-worker-einvoice-inbound   | Polls ePoslovanje for inbound e-invoices    | No                   | No       |

**Worker Operations:**

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-ocr --tail 50
docker logs fiskai-worker-extractor --tail 50

# Deploy all workers (on VPS)
./scripts/deploy-workers.sh
```

## Development Workflow

**CRITICAL: Never rebuild Docker images for testing code changes!**

Docker builds take 10-15 minutes. Instead:

1. **Test workers locally with npx tsx:**

   ```bash
   # Run a worker directly (uses .env.local for DATABASE_URL)
   npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts [evidenceId]
   npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch
   ```

2. **Test individual agents:**

   ```bash
   npx tsx src/lib/regulatory-truth/scripts/run-composer.ts [pointerId]
   npx tsx src/lib/regulatory-truth/scripts/run-reviewer.ts [ruleId]
   ```

3. **Only rebuild Docker when changes are verified working:**
   ```bash
   docker compose -f docker-compose.workers.yml build worker-extractor
   docker compose -f docker-compose.workers.yml up -d worker-extractor
   ```

### Available Scripts

**Deployment (usually automatic via GitHub Actions on merge to main):**

- `scripts/deploy-workers.sh` - Deploy workers to VPS
- `scripts/build-workers.sh` - Build worker Docker images

**Database:**

- `scripts/backup-database.sh` - Backup PostgreSQL to S3/R2
- `scripts/restore-database.sh` - Restore from backup

**Workers & Queues:**

- `scripts/queue-status.ts` - Check BullMQ queue depths
- `scripts/test-pipeline.ts` - Test full RTL pipeline
- `scripts/trigger-pipeline.ts` - Manually trigger pipeline
- `scripts/drain-content-sync.ts` - Drain content sync queue

**Audits & Checks:**

- `scripts/check-db-counts.ts` - Verify database record counts
- `scripts/check-integration-invariants.ts` - Verify integration data integrity
- `scripts/check-regulatory-integrity.ts` - Check regulatory DB consistency
- `scripts/check-test-db-boundary.ts` - Verify unit tests don't use DB
- `scripts/check-secrets-drift.ts` - Compare secrets across environments

**Backfills:**

- `scripts/backfill-run.ts` - Generic backfill runner
- `scripts/backfill-evidence-embeddings.ts` - Generate embeddings for evidence
- `scripts/backfill-integration-accounts.ts` - Provision integration accounts

**E-Invoicing:**

- `scripts/eposlovanje-ping.ts` - Test ePoslovanje API connection
- `scripts/lane2-inbound-poll-once.ts` - Manually poll for inbound e-invoices
- `scripts/lane2-outbound-dry-run.ts` - Test outbound e-invoice submission

**Utilities:**

- `scripts/set-admin-role.ts` - Grant ADMIN role to user
- `scripts/validate-env.sh` - Verify environment variables
- `scripts/smoke-portals.sh` - Test all portal endpoints
- `scripts/test-ai.ts` - Test AI/LLM connections

See `scripts/README.md` for complete script documentation.

## Documentation Structure

```
docs/
├── product-bible/       # Product Bible (modular chapters)
│   ├── 00-INDEX.md      # Master index with version history
│   └── ...              # Vision, users, compliance, UI, integrations
├── 01_ARCHITECTURE/     # System architecture
│   └── REGULATORY_TRUTH_LAYER.md  # Complete RTL architecture
├── 02_FEATURES/         # Feature specifications
│   └── FEATURE_REGISTRY.md        # Master feature list with status
├── 03_ARCHITECTURE/     # Component architecture
│   └── AI_ASSISTANT.md            # AI Assistant system architecture
├── operations/          # Operations runbooks
├── audits/              # Audit reports
└── plans/               # Implementation plans (design docs)
```

**Key Documents:**

- [Product Bible](./docs/product-bible/00-INDEX.md) - Complete product specification
- [RTL Architecture](./docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md) - Regulatory Truth Layer
- [Feature Registry](./docs/02_FEATURES/FEATURE_REGISTRY.md) - Feature list with status

See [docs/DOC-MAP.md](./docs/DOC-MAP.md) for complete documentation structure.
