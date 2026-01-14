# Appendixes

[← Back to Index](./00-INDEX.md)

---

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
> **Version:** 5.1.0
>
> Comprehensive update: All workers, scripts, package.json scripts, environment variables, and file locations verified against codebase reality.

---

## Documentation Reconstruction Ledger

### v5.1.0 (2026-01-14)

**Audit Date:** 2026-01-14
**Auditor:** Claude Sonnet 4.5
**Scope:** Comprehensive update of appendixes with all workers, scripts, and environment variables

#### Changes Made

1. **Worker Services (Appendix D)** - Expanded from 10 to 15 workers:
   - Added: content-sync, article, evidence-embedding, embedding, einvoice-inbound
   - Documented memory limits, concurrency settings, and purposes
   - Added comprehensive environment variable tables (20+ new variables)
   - Organized workers into RTL, Content, Embedding, and E-Invoice categories

2. **Scripts (Appendix E)** - Expanded from 35 to 100+ scripts:
   - Organized into 11 categories with descriptions
   - Added all shell scripts (deployment, build, backup/restore)
   - Added all backfill, validation, and audit scripts
   - Added usage examples and script conventions

3. **Package.json Scripts (Appendix C)** - Expanded with new scripts:
   - Added Prisma regulatory database scripts
   - Added test variants (unit, db, property, golden, e2e)
   - Added CI/CD scripts (ci:quick, ci:full)
   - Added system registry scripts

4. **File Locations (Appendix B)** - Updated with missing paths:
   - Added Prisma regulatory config
   - Added e-invoice workers directory
   - Added worker OCR Dockerfile
   - Added scripts and marketing audit directories

5. **Environment Variables (Appendix H)** - Comprehensive expansion:
   - Added all Ollama variants (extract, embed endpoints)
   - Added ePoslovanje integration variables
   - Added storage (R2) and feature flag variables
   - Added security notes and variable precedence documentation

#### Statistics

| Category              | Before | After | Change         |
| --------------------- | ------ | ----- | -------------- |
| Workers documented    | 10     | 15    | +5 new workers |
| Scripts listed        | ~35    | 100+  | +65 scripts    |
| Package.json scripts  | 36     | 68    | +32 scripts    |
| Environment variables | ~25    | 60+   | +35 variables  |

#### Verification

All information verified against:

- `/docker-compose.workers.yml` - Worker definitions
- `/package.json` - npm scripts
- `/scripts/` directory listing - All operational scripts
- Worker source files - Purposes and environment variables

---

### v5.0.0 (2026-01-05)

**Audit Date:** 2026-01-05
**Methodology:** 7 parallel haiku subagents audited codebase reality
**Canonical Rule Hierarchy:** Runtime > Source > Schema > Migrations > Config > Tests > Docs

#### Summary of Changes

| Document                  | Key Changes                                                                |
| ------------------------- | -------------------------------------------------------------------------- |
| 00-INDEX.md               | Version 5.0.0, System Reality Snapshot, updated version alignment          |
| 01-VISION-ARCHITECTURE.md | Module count corrected (18), legal form auto-assignment documented         |
| 02-USERS-JOURNEYS.md      | CompanyRole enum corrected (5 roles), portal page counts added             |
| 03-LEGAL-COMPLIANCE.md    | Version/date header updated                                                |
| 04-ACCESS-CONTROL.md      | Module count corrected (18), status labels added, platform-core documented |
| 05-UI-EXPERIENCE.md       | Version/date header updated                                                |
| 06-INTEGRATIONS.md        | ePoslovanje v2 added as production provider                                |
| 07-DATA-API.md            | Version/date header updated                                                |
| 08-APPENDIXES.md          | Change ledger added, version/date header updated                           |

### Discrepancies Found & Resolved

| Item            | Old Documentation         | Actual Codebase                      | Resolution                           |
| --------------- | ------------------------- | ------------------------------------ | ------------------------------------ |
| Module count    | 16                        | 17                                   | Added platform-core, corrected count |
| CompanyRole     | OWNER/ACCOUNTANT/EMPLOYEE | OWNER/ADMIN/MEMBER/ACCOUNTANT/VIEWER | Updated to actual 5-role enum        |
| ePoslovanje     | Not documented            | Production with v2 API               | Added to integrations                |
| Database models | Not specified             | 182 models, 80+ enums                | Added to reality snapshot            |
| Portal pages    | Not specified             | ~45/~85/12/~22                       | Added to reality snapshot            |
| RTL workers     | 10 listed                 | 15 actual                            | Corrected worker count               |

### New Features Documented

- platform-core module (always enabled)
- Legal form auto-assignment via `getEntitlementsForLegalForm()`
- Entitlements v2 format with permission granularity
- ePoslovanje v2 integration as primary e-invoice provider
- 15 RTL workers (vs 10 previously documented)

---

## Appendix A: Glossary

| Term                  | Croatian                                     | Meaning                                  |
| --------------------- | -------------------------------------------- | ---------------------------------------- |
| OIB                   | Osobni identifikacijski broj                 | 11-digit tax ID                          |
| PDV                   | Porez na dodanu vrijednost                   | VAT                                      |
| MIO                   | Mirovinsko osiguranje                        | Pension insurance                        |
| HZZO                  | Hrvatski zavod za zdravstveno osiguranje     | Health insurance                         |
| JIR                   | Jedinstveni identifikator računa             | Fiscal receipt ID                        |
| ZKI                   | Zaštitni kod izdavatelja                     | Issuer security code                     |
| KPR                   | Knjiga prometa                               | Daily sales log (paušalni)               |
| KPI                   | Knjiga primitaka i izdataka                  | Income/expense book                      |
| PO-SD                 | Prijava poreza na dohodak - pojednostavljena | Simplified income tax return             |
| URA                   | Ulazni računi                                | Incoming invoices                        |
| IRA                   | Izlazni računi                               | Outgoing invoices                        |
| HOK                   | Hrvatska obrtnička komora                    | Croatian Chamber of Trades               |
| FINA                  | Financijska agencija                         | Financial Agency                         |
| CIS                   | Centralni informacijski sustav               | Central Information System               |
| EN16931               | European e-invoicing standard                | XML schema for B2G invoices              |
| UBL                   | Universal Business Language                  | XML format for e-invoices                |
| CAMT.053              | Cash Management message                      | ISO 20022 bank statement XML             |
| Hub3                  | Croatian payment slip standard               | 2D barcode for payments                  |
| R1/R2                 | Invoice types                                | R1=standard, R2=cash register            |
| VIES                  | VAT Information Exchange System              | EU VAT number validation                 |
| SEPA                  | Single Euro Payments Area                    | EU bank transfer standard                |
| PSD2                  | Payment Services Directive 2                 | Open banking regulation                  |
| Poziv na broj         | Payment reference number                     | Links payment to invoice                 |
| Prirez                | Municipal surtax                             | Added to income tax                      |
| JOPPD                 | Jedinstveni Obrazac Poreza i Prihoda         | Payroll reporting form                   |
| Putni nalog           | Travel order                                 | Tax-free expense claim                   |
| Dnevnica              | Per diem                                     | Daily travel allowance                   |
| RTL                   | Regulatory Truth Layer                       | Automated regulatory extraction pipeline |
| Sentinel              | Discovery agent                              | Scans regulatory sources for new content |
| Extractor             | Fact extraction agent                        | Extracts atomic facts from evidence      |
| Composer              | Rule composition agent                       | Aggregates facts into regulatory rules   |
| Reviewer              | Quality gate agent                           | Validates rule accuracy and citations    |
| Arbiter               | Conflict resolution agent                    | Resolves conflicting rules               |
| Releaser              | Publication agent                            | Publishes approved rules to production   |
| BullMQ                | Job queue library                            | Distributed task queue for workers       |
| Ollama                | Local LLM inference                          | Self-hosted AI model runner              |
| OCR                   | Optical Character Recognition                | Text extraction from scanned documents   |
| Tesseract             | OCR engine                                   | Open-source OCR for Croatian/English     |
| XAdES                 | XML Advanced Electronic Signatures           | Digital signature standard for XML       |
| AtomicClaim           | Knowledge shape                              | Logic-based fact with conditions         |
| ConceptNode           | Taxonomy node                                | Concept with synonyms/hypernyms          |
| TransitionalProvision | Temporal rule                                | Rules for rate/law transitions           |
| RegulatoryAsset       | Document/form reference                      | Links to official forms                  |
| ReferenceTable        | Lookup table                                 | Key-value reference data (IBANs, codes)  |
| RegulatoryProcess     | Workflow definition                          | Step-by-step procedures                  |
| GraphEdge             | Precedence relation                          | Lex specialis override mapping           |

---

## Appendix B: File Locations

| Purpose                    | Path                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| **Core Configuration**     |                                                                   |
| Module definitions         | `/src/lib/modules/definitions.ts`                                 |
| Visibility rules           | `/src/lib/visibility/rules.ts`                                    |
| Visibility elements        | `/src/lib/visibility/elements.ts`                                 |
| Visibility context         | `/src/lib/visibility/context.tsx`                                 |
| RBAC permissions           | `/src/lib/rbac.ts`                                                |
| Capabilities               | `/src/lib/capabilities.ts`                                        |
| Navigation registry        | `/src/lib/navigation.ts`                                          |
| **Fiscal Data**            |                                                                   |
| Tax thresholds             | `/src/lib/fiscal-data/data/thresholds.ts`                         |
| Tax rates                  | `/src/lib/fiscal-data/data/tax-rates.ts`                          |
| Contributions              | `/src/lib/fiscal-data/data/contributions.ts`                      |
| Deadlines                  | `/src/lib/fiscal-data/data/deadlines.ts`                          |
| Payment details            | `/src/lib/fiscal-data/data/payment-details.ts`                    |
| **Feature Modules**        |                                                                   |
| Paušalni logic             | `/src/lib/pausalni/`                                              |
| E-invoice generation       | `/src/lib/e-invoice/`                                             |
| Bank sync                  | `/src/lib/bank-sync/`                                             |
| Banking import             | `/src/lib/banking/`                                               |
| Guidance system            | `/src/lib/guidance/`                                              |
| **Database**               |                                                                   |
| Prisma schema (core)       | `/prisma/schema.prisma`                                           |
| Prisma config (regulatory) | `/prisma.config.regulatory.ts`                                    |
| Drizzle client             | `/src/lib/db/drizzle.ts`                                          |
| Drizzle schemas            | `/src/lib/db/schema/`                                             |
| **UI Components**          |                                                                   |
| Dashboard widgets          | `/src/components/dashboard/`                                      |
| Onboarding steps           | `/src/components/onboarding/`                                     |
| Guidance components        | `/src/components/guidance/`                                       |
| Layout components          | `/src/components/layout/`                                         |
| Admin components           | `/src/components/admin/`                                          |
| Staff components           | `/src/components/staff/`                                          |
| **Server Logic**           |                                                                   |
| Server actions             | `/src/app/actions/`                                               |
| API routes                 | `/src/app/api/`                                                   |
| Cron jobs                  | `/src/app/api/cron/`                                              |
| **Content**                |                                                                   |
| MDX guides                 | `/content/vodici/`                                                |
| MDX comparisons            | `/content/usporedbe/`                                             |
| Implementation plans       | `/docs/plans/`                                                    |
| **Regulatory Truth Layer** |                                                                   |
| RTL workers                | `/src/lib/regulatory-truth/workers/`                              |
| RTL agents                 | `/src/lib/regulatory-truth/agents/`                               |
| RTL schemas                | `/src/lib/regulatory-truth/schemas/`                              |
| RTL scripts                | `/src/lib/regulatory-truth/scripts/`                              |
| RTL fetchers               | `/src/lib/regulatory-truth/fetchers/`                             |
| RTL watchdog               | `/src/lib/regulatory-truth/watchdog/`                             |
| RTL e2e tests              | `/src/lib/regulatory-truth/e2e/`                                  |
| **Knowledge Shapes**       |                                                                   |
| Shape extractors           | `/src/lib/regulatory-truth/agents/extractors/`                    |
| Taxonomy engine            | `/src/lib/regulatory-truth/retrieval/taxonomy-engine.ts`          |
| Query router               | `/src/lib/regulatory-truth/retrieval/query-router.ts`             |
| **AI Assistant**           |                                                                   |
| Assistant types            | `/src/lib/assistant/types.ts`                                     |
| Query engine               | `/src/lib/assistant/query-engine/`                                |
| Reasoning pipeline         | `/src/lib/assistant/reasoning/`                                   |
| Assistant hooks            | `/src/lib/assistant/hooks/`                                       |
| **E-Invoice Workers**      |                                                                   |
| E-invoice workers          | `/src/lib/e-invoice/workers/`                                     |
| Inbound poller             | `/src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts` |
| **Knowledge Hub**          |                                                                   |
| Hub3 barcode               | `/src/lib/knowledge-hub/hub3.ts`                                  |
| Calculations               | `/src/lib/knowledge-hub/calculations.ts`                          |
| MDX processing             | `/src/lib/knowledge-hub/mdx.ts`                                   |
| **Docker & Workers**       |                                                                   |
| Main Dockerfile            | `/Dockerfile`                                                     |
| Worker Dockerfile          | `/Dockerfile.worker`                                              |
| Worker OCR Dockerfile      | `/Dockerfile.worker-ocr`                                          |
| Workers compose            | `/docker-compose.workers.yml`                                     |
| Production compose         | `/docker-compose.prod.yml`                                        |
| Development compose        | `/docker-compose.dev.yml`                                         |
| **Scripts**                |                                                                   |
| All scripts                | `/scripts/`                                                       |
| Marketing audit scripts    | `/scripts/marketing-content-audit/`                               |
| **Audit Reports**          |                                                                   |
| Audit reports              | `/docs/07_AUDITS/`                                                |
| Audit runs                 | `/docs/07_AUDITS/runs/`                                           |

---

## Appendix C: Package.json Scripts

| Script                          | Description                                      |
| ------------------------------- | ------------------------------------------------ |
| **Development**                 |                                                  |
| `dev`                           | Start Next.js development server                 |
| `prebuild`                      | Build search index (runs before build)           |
| `build`                         | Build production bundle (runs prebuild first)    |
| `start`                         | Start production server                          |
| `lint`                          | Run ESLint                                       |
| `format`                        | Format code with Prettier                        |
| `format:check`                  | Check code formatting                            |
| **Testing**                     |                                                  |
| `test`                          | Run all tests with Vitest                        |
| `test:unit`                     | Run unit tests (exclude DB tests)                |
| `test:db`                       | Run database tests only                          |
| `test:watch`                    | Run tests in watch mode                          |
| `test:property`                 | Run property-based tests                         |
| `test:golden`                   | Run golden/snapshot tests                        |
| `test:e2e`                      | Run Playwright E2E tests                         |
| `test:tenant`                   | Run tenant isolation tests                       |
| `test:knowledge-hub`            | Run knowledge hub tests                          |
| `test:node`                     | Run Node.js test suite                           |
| **Database - Prisma (Core)**    |                                                  |
| `prisma:generate`               | Generate both Prisma clients                     |
| `prisma:generate:core`          | Generate core Prisma client                      |
| `prisma:generate:regulatory`    | Generate regulatory Prisma client                |
| `prisma:push`                   | Push core schema to database                     |
| `prisma:push:regulatory`        | Push regulatory schema to database               |
| `prisma:migrate`                | Run core migrations (production)                 |
| `prisma:migrate:regulatory`     | Run regulatory migrations (production)           |
| `prisma:migrate:dev`            | Run core migrations (development)                |
| `prisma:migrate:dev:regulatory` | Run regulatory migrations (development)          |
| `prisma:studio`                 | Open Prisma Studio for core database             |
| `prisma:studio:regulatory`      | Open Prisma Studio for regulatory database       |
| `db:seed`                       | Seed database                                    |
| **Database - Drizzle**          |                                                  |
| `db:generate`                   | Generate Drizzle migrations                      |
| `db:migrate`                    | Run Drizzle migrations                           |
| `db:push`                       | Push Drizzle schema                              |
| `db:studio`                     | Open Drizzle Studio                              |
| `db:check-features`             | Check feature table consistency                  |
| **Seeding Scripts**             |                                                  |
| `db:seed-news`                  | Seed news sources                                |
| `db:seed-news-categories`       | Seed news categories                             |
| `db:seed-deadlines`             | Seed fiscal deadlines                            |
| `db:rewrite-news`               | Rewrite news posts with AI                       |
| **Worker Commands**             |                                                  |
| `worker:sentinel`               | Run Sentinel worker locally                      |
| `worker:extractor`              | Run Extractor worker locally                     |
| `worker:composer`               | Run Composer worker locally                      |
| `worker:reviewer`               | Run Reviewer worker locally                      |
| `worker:arbiter`                | Run Arbiter worker locally                       |
| `worker:releaser`               | Run Releaser worker locally                      |
| `worker:orchestrator`           | Run Orchestrator worker locally                  |
| `worker:scheduler`              | Run Scheduler service locally                    |
| `bull-board`                    | Start Bull Board dashboard                       |
| **Docker Workers**              |                                                  |
| `build:workers`                 | Build workers TypeScript and copy generated code |
| `workers:start`                 | Start all Docker workers                         |
| `workers:stop`                  | Stop all Docker workers                          |
| `workers:logs`                  | View Docker worker logs                          |
| `workers:status`                | Check Docker worker status                       |
| **Validation**                  |                                                  |
| `validate:routes`               | Validate route definitions                       |
| `validate:content`              | Validate content schemas                         |
| `verify-contrast`               | Verify design system color contrast              |
| **Auditing**                    |                                                  |
| `audit:marketing`               | Run marketing content audit                      |
| **System Registry**             |                                                  |
| `registry:check`                | Check system registry consistency                |
| `registry:harvest`              | Harvest system components into registry          |
| **CI/CD**                       |                                                  |
| `ci:quick`                      | Quick CI check (type-check, lint, registry)      |
| `ci:full`                       | Full CI pipeline (quick + build + test)          |
| `postinstall`                   | Auto-generate Prisma clients after npm install   |
| `prepare`                       | Setup Husky git hooks                            |

---

## Appendix D: Docker Worker Services

### Worker Services Overview

FiskAI runs **15 specialized workers** for background processing, organized into 3 categories:

1. **Regulatory Truth Layer (RTL) Workers** - Process regulatory content
2. **Content & Article Workers** - Generate and sync content
3. **E-Invoice Workers** - Handle inbound e-invoice polling

All workers use BullMQ for job queuing and are deployed via `docker-compose.workers.yml`.

### Service Definitions

| Service                     | Container Name                     | Memory Limit | Concurrency | Description                              |
| --------------------------- | ---------------------------------- | ------------ | ----------- | ---------------------------------------- |
| `redis`                     | `fiskai-redis`                     | 2GB          | N/A         | Redis 7 for BullMQ job queues            |
| **RTL Workers**             |                                    |              |             |                                          |
| `worker-orchestrator`       | `fiskai-worker-orchestrator`       | 512M         | 1           | Pipeline orchestration and coordination  |
| `worker-sentinel`           | `fiskai-worker-sentinel`           | 512M         | 1           | Discovery/scanning of regulatory sources |
| `worker-extractor`          | `fiskai-worker-extractor`          | 1G           | 1           | LLM-based fact extraction from evidence  |
| `worker-ocr`                | `fiskai-worker-ocr`                | 2G           | 1           | OCR processing (Tesseract + Vision)      |
| `worker-composer`           | `fiskai-worker-composer`           | 512M         | 1           | Rule composition from extracted facts    |
| `worker-reviewer`           | `fiskai-worker-reviewer`           | 512M         | 1           | Quality gate validation for rules        |
| `worker-arbiter`            | `fiskai-worker-arbiter`            | 512M         | 1           | Conflict resolution between rules        |
| `worker-releaser`           | `fiskai-worker-releaser`           | 512M         | 1           | Rule publication to production           |
| `worker-scheduler`          | `fiskai-worker-scheduler`          | 512M         | N/A         | Cron scheduling service (Watchdog)       |
| `worker-continuous-drainer` | `fiskai-worker-continuous-drainer` | 256M         | N/A         | 24/7 queue monitoring and processing     |
| **Content Workers**         |                                    |              |             |                                          |
| `worker-content-sync`       | `fiskai-worker-content-sync`       | 512M         | 1           | Syncs RTL rules to MDX content files     |
| `worker-article`            | `fiskai-worker-article`            | 1G           | 1           | AI article generation pipeline           |
| **Embedding Workers**       |                                    |              |             |                                          |
| `worker-evidence-embedding` | `fiskai-worker-evidence-embedding` | 512M         | 2           | Generate embeddings for Evidence records |
| `worker-embedding`          | `fiskai-worker-embedding`          | 512M         | 2           | Generate embeddings for general content  |
| **E-Invoice Workers**       |                                    |              |             |                                          |
| `worker-einvoice-inbound`   | `fiskai-worker-einvoice-inbound`   | 256M         | N/A         | Polls ePoslovanje for incoming invoices  |

### Worker Images

Workers use **2 Docker images** from GHCR:

| Image                               | Workers                | Special Features            |
| ----------------------------------- | ---------------------- | --------------------------- |
| `ghcr.io/wandeon/fiskai-worker`     | All workers except OCR | Standard Node.js runtime    |
| `ghcr.io/wandeon/fiskai-worker-ocr` | `worker-ocr` only      | Includes Tesseract, Poppler |

### Worker Purposes

#### RTL Worker Pipeline (10 workers)

1. **Orchestrator** - Coordinates the entire RTL pipeline, triggers jobs
2. **Sentinel** - Scans regulatory websites (Narodne novine, Porezna, FINA) for new content
3. **Extractor** - Uses LLMs to extract atomic facts from evidence documents
4. **OCR** - Processes scanned PDFs with Tesseract, falls back to Vision LLM
5. **Composer** - Aggregates extracted facts into cohesive regulatory rules
6. **Reviewer** - Validates rule accuracy, citations, and completeness
7. **Arbiter** - Resolves conflicts between rules using lex specialis logic
8. **Releaser** - Publishes approved rules to production database
9. **Scheduler** - Runs scheduled jobs (Watchdog alerts, pipeline triggers)
10. **Continuous Drainer** - Monitors all queues 24/7, processes stalled jobs

#### Content Workers (2 workers)

1. **Content Sync** - Syncs RTL rule changes to MDX files in `/content/`, creates GitHub PRs
2. **Article** - Generates knowledge base articles from regulatory rules and news

#### Embedding Workers (2 workers)

1. **Evidence Embedding** - Generates vector embeddings for Evidence.rawContent (for semantic search)
2. **Embedding** - General-purpose embedding worker for other content types

#### E-Invoice Workers (1 worker)

1. **E-Invoice Inbound** - Polls ePoslovanje API for incoming invoices, stores in database

### Environment Variables

#### Common Variables (All Workers)

| Variable                  | Required | Description                       | Example                       |
| ------------------------- | -------- | --------------------------------- | ----------------------------- |
| `NODE_ENV`                | Yes      | Environment mode                  | `production`                  |
| `REDIS_URL`               | Yes      | Redis connection URL              | `redis://fiskai-redis:6379`   |
| `DATABASE_URL`            | Yes      | Core PostgreSQL connection        | `postgresql://...`            |
| `REGULATORY_DATABASE_URL` | Yes      | Regulatory PostgreSQL connection  | `postgresql://...`            |
| `WORKER_TYPE`             | Yes      | Worker type identifier            | `extractor`, `composer`, etc. |
| `WORKER_CONCURRENCY`      | No       | Concurrent job limit (default: 1) | `1`, `2`                      |

#### LLM-Specific Variables

| Variable                  | Workers Using It                     | Description                          |
| ------------------------- | ------------------------------------ | ------------------------------------ |
| `OLLAMA_ENDPOINT`         | OCR, Composer, Reviewer, Arbiter     | Ollama API endpoint                  |
| `OLLAMA_API_KEY`          | OCR, Composer, Reviewer, Arbiter     | Ollama API key                       |
| `OLLAMA_MODEL`            | Composer, Reviewer, Arbiter, Article | Default LLM model (e.g., llama3.1)   |
| `OLLAMA_VISION_MODEL`     | OCR                                  | Vision model (e.g., llama3.2-vision) |
| `OLLAMA_EXTRACT_ENDPOINT` | Extractor                            | Extraction-specific endpoint         |
| `OLLAMA_EXTRACT_API_KEY`  | Extractor                            | Extraction-specific API key          |
| `OLLAMA_EXTRACT_MODEL`    | Extractor                            | Extraction-specific model            |
| `OLLAMA_EMBED_ENDPOINT`   | Evidence Embedding, Embedding        | Embedding endpoint                   |
| `OLLAMA_EMBED_API_KEY`    | Evidence Embedding, Embedding        | Embedding API key                    |
| `OLLAMA_EMBED_MODEL`      | Evidence Embedding, Embedding        | Embedding model (nomic-embed-text)   |
| `OLLAMA_EMBED_DIMS`       | Evidence Embedding, Embedding        | Embedding dimensions (768)           |

#### Worker-Specific Variables

| Variable                          | Worker            | Description                                  |
| --------------------------------- | ----------------- | -------------------------------------------- |
| `WATCHDOG_TIMEZONE`               | Scheduler         | Timezone for cron jobs (Europe/Zagreb)       |
| `GITHUB_TOKEN`                    | Content Sync      | GitHub API token for PR creation             |
| `EPOSLOVANJE_API_BASE`            | E-Invoice Inbound | ePoslovanje API base URL                     |
| `EPOSLOVANJE_API_KEY`             | E-Invoice Inbound | ePoslovanje API key                          |
| `COMPANY_ID`                      | E-Invoice Inbound | Company ID to poll for                       |
| `POLL_INTERVAL_MS`                | E-Invoice Inbound | Polling interval (default: 300000 = 5 min)   |
| `MAX_WINDOW_DAYS`                 | E-Invoice Inbound | Max lookback window (default: 7 days)        |
| `USE_INTEGRATION_ACCOUNT_INBOUND` | E-Invoice Inbound | Use IntegrationAccount credentials (V2 path) |

---

## Appendix E: Key Scripts in /scripts/

### Overview

The `/scripts/` directory contains **100+ operational scripts** organized by purpose. All TypeScript scripts use `tsx` for execution.

### Script Categories

#### 1. News & Content Management

| Script                      | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `seed-news-sources.ts`      | Seed initial news sources into database   |
| `seed-news-categories.ts`   | Seed news category taxonomy               |
| `seed-deadlines.ts`         | Seed fiscal deadlines for current year    |
| `rewrite-news-posts.ts`     | Rewrite news posts with AI for clarity    |
| `publish-drafts.ts`         | Publish draft articles to production      |
| `process-news-manual.ts`    | Manual news processing and categorization |
| `build-search-index.ts`     | Build Fuse.js search index for content    |
| `verify-news-schema.ts`     | Validate news schema structure            |
| `verify-news-categories.ts` | Verify news category consistency          |
| `test-news-fetch.ts`        | Test news RSS feed fetching               |

#### 2. RTL Pipeline & Queue Management

| Script                      | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `queue-status.ts`           | Check BullMQ queue status (all queues)        |
| `trigger-pipeline.ts`       | Trigger regulatory pipeline for single source |
| `trigger-full-pipeline.ts`  | Trigger full pipeline run across all sources  |
| `trigger-arbiter.ts`        | Trigger arbiter for conflict resolution       |
| `run-full-pipeline-demo.ts` | Demo full pipeline with sample evidence       |
| `test-pipeline.ts`          | Test pipeline end-to-end                      |
| `pipeline-trace.ts`         | Trace pipeline execution for debugging        |
| `test-extract-queue.ts`     | Test extraction queue processing              |
| `test-single-extraction.ts` | Test single evidence extraction               |
| `test-batch-extraction.ts`  | Test batch extraction performance             |
| `baseline-extraction.ts`    | Establish baseline extraction quality         |
| `drain-content-sync.ts`     | Drain content-sync queue                      |
| `test-embedding-sync.ts`    | Test embedding synchronization                |

#### 3. Validation & Integrity Checks

| Script                                | Purpose                                      |
| ------------------------------------- | -------------------------------------------- |
| `validate-routes.ts`                  | Validate Next.js route definitions           |
| `validate-content.ts`                 | Validate content frontmatter and structure   |
| `validate-concept-registry.ts`        | Validate concept taxonomy registry           |
| `check-db-counts.ts`                  | Check database record counts for consistency |
| `check-conflicts.ts`                  | Check for rule conflicts in RTL              |
| `check-docs.ts`                       | Check documentation completeness             |
| `check-container-completeness.ts`     | Verify Docker container setup                |
| `check-secrets-drift.ts`              | Check for secrets drift between environments |
| `check-orphaned-pointers.ts`          | Find orphaned evidence pointers              |
| `check-integration-invariants.ts`     | Validate integration account invariants      |
| `check-legacy-secrets.ts`             | Find legacy secret patterns in code          |
| `check-no-direct-core-ruleversion.ts` | Ensure no direct RuleVersion imports         |
| `check-no-ruleversion-relations.ts`   | Validate RuleVersion relation constraints    |
| `check-regulatory-integrity.ts`       | Comprehensive regulatory DB integrity check  |
| `check-feature-tables.ts`             | Check feature table consistency              |
| `check-test-db-boundary.ts`           | Validate test/DB boundary separation         |
| `verify-enterprise-hardening.ts`      | Verify enterprise security hardening         |

#### 4. Data Fixes & Backfills

| Script                                     | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `fix-applies-when.ts`                      | Fix appliesWhen DSL syntax issues              |
| `fix-json-quotes.ts`                       | Fix JSON quote escaping issues                 |
| `cleanup-duplicate-evidence.ts`            | Remove duplicate evidence records              |
| `cleanup-orphan-subscriptions.ts`          | Clean up orphaned subscription records         |
| `backfill-applied-rule-snapshots.ts`       | Backfill applied rule snapshots                |
| `backfill-candidatefacts.ts`               | Backfill candidate facts from evidence         |
| `backfill-einvoice-integration-account.ts` | Backfill e-invoice integration accounts        |
| `backfill-einvoice-raw.ts`                 | Backfill raw e-invoice data                    |
| `backfill-evidence-embeddings.ts`          | Backfill embeddings for existing evidence      |
| `backfill-integration-accounts.ts`         | Backfill integration account credentials       |
| `backfill-run.ts`                          | Generic backfill runner with progress tracking |
| `promote-candidatefacts.ts`                | Promote candidate facts to published facts     |

#### 5. Testing & Diagnostics

| Script                     | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `test-ai.ts`               | Test AI/LLM integration                 |
| `test-assistant-cli.ts`    | Test AI assistant CLI interface         |
| `test-idempotency.ts`      | Test script idempotency                 |
| `test-category-queries.ts` | Test news category query performance    |
| `test-outcome-taxonomy.ts` | Test outcome taxonomy structure         |
| `diagnose-hashes.ts`       | Diagnose hash collision issues          |
| `debug-matching.ts`        | Debug matching logic for reconciliation |
| `fiscal-dry-run.ts`        | Dry-run fiscal calculations             |

#### 6. E-Invoice Operations

| Script                              | Purpose                                      |
| ----------------------------------- | -------------------------------------------- |
| `lane2-inbound-dry-run.ts`          | Dry-run e-invoice inbound polling            |
| `lane2-inbound-poll-once.ts`        | Poll ePoslovanje once for testing            |
| `lane2-outbound-dry-run.ts`         | Dry-run e-invoice outbound sending           |
| `eposlovanje-ping.ts`               | Test ePoslovanje API connectivity            |
| `provision-integration-accounts.ts` | Provision integration accounts for companies |

#### 7. Auditing & Analysis

| Script                                       | Purpose                             |
| -------------------------------------------- | ----------------------------------- |
| `audit-ocr.ts`                               | Audit OCR processing quality        |
| `audit-reconcile.ts`                         | Reconcile audit findings            |
| `audit-integration-state.sql`                | SQL audit for integration state     |
| `run-audit-integration-state.ts`             | Run integration state audit         |
| `cutover-audit.ts`                           | Audit for production cutover        |
| `phase5-baseline-evidence.ts`                | Phase 5: baseline evidence audit    |
| `phase5-final-audit.ts`                      | Phase 5: final audit before release |
| `dump-audit-sample-update.ts`                | Dump audit sample for updates       |
| `reasoning-rollback-check.ts`                | Check reasoning rollback safety     |
| **Marketing Audit**                          |                                     |
| `marketing-content-audit/run-audit.ts`       | Run marketing content audit         |
| `marketing-content-audit/generate-report.ts` | Generate audit report               |
| `marketing-content-audit/seed-registry.ts`   | Seed audit registry                 |
| `marketing-content-audit/tool-vectors.ts`    | Tool vector analysis for marketing  |

#### 8. Admin & Operations

| Script                       | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `set-admin-role.ts`          | Set user system role to ADMIN           |
| `rollback-release.ts`        | Rollback a rule release in RTL          |
| `seed-ruleversion-bundle.ts` | Seed RuleVersion bundle for testing     |
| `operation-shatter.ts`       | Break down large operations into chunks |
| `generate-concept-stubs.ts`  | Generate concept taxonomy stubs         |
| `list-unmapped-concepts.ts`  | List concepts without mappings          |

#### 9. Build & Deployment (Shell Scripts)

| Script                     | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `build-arm64.sh`           | Build ARM64 Docker images                |
| `build-remote.sh`          | Build Docker images on remote server     |
| `build-limited.sh`         | Build with limited resources             |
| `build-workers.sh`         | Build worker Docker images               |
| `deploy-to-vps01.sh`       | Deploy application to VPS-01             |
| `deploy-workers.sh`        | Deploy workers to VPS                    |
| `coolify-copy-envs.sh`     | Copy environment variables to Coolify    |
| `migrate-to-workers.sh`    | Migrate from single container to workers |
| `backup-database.sh`       | Backup PostgreSQL database               |
| `restore-database.sh`      | Restore PostgreSQL database from backup  |
| `validate-env.sh`          | Validate environment variables           |
| `verify-ai-setup.sh`       | Verify AI/Ollama setup                   |
| `smoke-portals.sh`         | Smoke test all portal endpoints          |
| `test-health-endpoints.sh` | Test health check endpoints              |
| `e2e-verification.sh`      | End-to-end verification suite            |

#### 10. Design System & Code Quality

| Script                       | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `verify-contrast.ts`         | Verify design system color contrast     |
| `check-design-overrides.mjs` | Check for design system overrides       |
| `check-raw-palette.mjs`      | Check for raw color palette usage       |
| `check-schema-ownership.mjs` | Check Prisma schema ownership           |
| `generate-ci-inventory.js`   | Generate CI inventory for documentation |

#### 11. Regulatory Operations

| Script                      | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `verify-worker-versions.ts` | Verify worker version consistency         |
| `create-launch-issues.mjs`  | Create GitHub issues for launch checklist |

### Usage Examples

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# Trigger full RTL pipeline
npx tsx scripts/trigger-full-pipeline.ts

# Validate all routes
npx tsx scripts/validate-routes.ts

# Check database integrity
npx tsx scripts/check-regulatory-integrity.ts

# Deploy workers
./scripts/deploy-workers.sh

# Backup database
./scripts/backup-database.sh
```

### Script Conventions

- **TypeScript scripts** - Use `tsx` for execution
- **Shell scripts** - Marked executable (`chmod +x`)
- **Idempotency** - All scripts should be safe to re-run
- **Dry-run support** - Many scripts support `--dry-run` flag
- **Progress tracking** - Long-running scripts show progress
- **Error handling** - Scripts exit with non-zero on failure

---

## Appendix 1: Strategic Technical Specification (Gaps + Proof)

> **Status:** Most items in this appendix have been incorporated into the main document in v4.1.0. This appendix is retained for audit trail purposes.

**Vision Alignment**

- This appendix serves as the engineering blueprint to bridge the gap between v4.0.0 theory and 2025/2026 production reality.
- Methodology: **Legal Drift Audit** + **Algorithmic Specification** + **Market Gap Analysis**.

### A1.1 Legal Threshold & Regulatory Drift (2025 Updates)

The following mandatory updates must be implemented to keep FiskAI compliant with the 2025 Croatian Tax Reform.

- **Doc refs**: `PRODUCT_BIBLE.md:139` `PRODUCT_BIBLE.md:165` `PRODUCT_BIBLE.md:170` `PRODUCT_BIBLE.md:179` `PRODUCT_BIBLE.md:908` `PRODUCT_BIBLE.md:1059` `PRODUCT_BIBLE.md:1060`
  **Issue**: Legacy income/VAT thresholds.
  **Evidence**: Official Porezna Uprava 2025 update (Thresholds for mandatory entry into VAT and exit from Paušalni).
  **Proof**: The limit has officially increased from 40,000.00 EUR to **60,000.00 EUR**.
  **Fix**: Update global `CONSTANTS` in `lib/fiscal-data`. Recalibrate `card:pausalni-status` progress bar. Trigger "Strategic Stage" at 50k instead of 35k.

- **Doc refs**: `PRODUCT_BIBLE.md:1087` `PRODUCT_BIBLE.md:1088`
  **Issue**: Incomplete Paušalni tax tier table.
  **Evidence**: Law on Income Tax (Zakon o porezu na dohodak) 2025.
  **Proof**: Brackets expanded to 7 tiers.
  **Fix**: Update `src/lib/pausalni/calculator.ts` with the following tiers:
  1. 0 - 11,300.00 EUR (Base: 1,695.00)
  2. 11,300.01 - 15,300.00 EUR (Base: 2,295.00)
  3. 15,300.01 - 19,900.00 EUR (Base: 2,985.00)
  4. 19,900.01 - 30,600.00 EUR (Base: 4,590.00)
  5. 30,600.01 - 40,000.00 EUR (Base: 6,000.00)
  6. 40,000.01 - 50,000.00 EUR (Base: 7,500.00)
  7. 50,000.01 - 60,000.00 EUR (Base: 9,000.00)

- **Doc refs**: `PRODUCT_BIBLE.md:1062` `PRODUCT_BIBLE.md:1249` `PRODUCT_BIBLE.md:1381`
  **Issue**: Legacy asset capitalization threshold.
  **Evidence**: Regulation on Amortization (Pravilnik o amortizaciji) 2025.
  **Proof**: Items are now capitalized at **1,000.00 EUR** (previously 665.00 EUR).
  **Fix**: Update `Expense Vault` AI logic to trigger "Asset Suggestion" only if `total >= 1000.00`.

- **Doc refs**: `PRODUCT_BIBLE.md:1094` `PRODUCT_BIBLE.md:1097` `PRODUCT_BIBLE.md:1401`
  **Issue**: Legacy minimal wage and contribution base.
  **Evidence**: Government Decree on Minimal Wage 2025 (Uredba o visini minimalne plaće).
  **Proof**: Minimal gross wage is now **970.00 EUR**. Contribution base for entrepreneurs is **719.20 EUR**.
  **Fix**: Update `lib/fiscal-data/contributions.ts` and automated payment slip generator (`src/lib/pausalni/obligations.ts`).

- **Doc refs**: `PRODUCT_BIBLE.md:1068` `PRODUCT_BIBLE.md:1071`
  **Issue**: Surtax (Prirez) is obsolete.
  **Evidence**: Local Tax Law (Zakon o lokalnim porezima) abolition of prirez.
  **Proof**: Surtax is 0. Cities now set direct income tax rates (e.g., Zagreb ~23.6% lower tier).
  **Fix**: Remove "Surtax" fields from calculators. Add "Municipality Selection" to Step 3 of Onboarding to resolve local tax rate.

### A1.2 Technical Logic Gaps (AI & Data Flow)

Specifications for autonomous features promised but not detailed in v4.0.0.

- **Doc refs**: `PRODUCT_BIBLE.md:170` `PRODUCT_BIBLE.md:1201` `PRODUCT_BIBLE.md:1246`
  **The Watchdog Agent (Spec)**:
  - Input: `db.eInvoice.sum(totalAmount)` where `year = current`.
  - Logic: Monitor proximity to 60k limit.
  - 85% Trigger: Toast + Dashboard Warning.
  - 95% Trigger: Modal blocking creation of further invoices without "Legal Review" checkbox.
  - Target: Zero unplanned VAT entries for paušalni users.

- **Doc refs**: `PRODUCT_BIBLE.md:982` `PRODUCT_BIBLE.md:1197`
  **The Matcher Agent (Reconciliation)**:
  - Input: Bank CSV/XML Transaction + Unpaid Invoices.
  - Algorithm: Fuzzy match on (1) Amount == Total, (2) Reference Number match, (3) Payer Name == Contact Name.
  - Priority: If `Reference Number` matches exactly, auto-reconcile. If only `Payer Name` matches, suggest match with 70% confidence.

- **Doc refs**: `PRODUCT_BIBLE.md:46` `PRODUCT_BIBLE.md:1147` `PRODUCT_BIBLE.md:1239`
  **Legal Archive Integrity (XAdES)**:
  - Spec: Storing in Cloudflare R2 is insufficient for the 11-year Archive Law (Zakon o računovodstvu).
  - Implementation: Implement **Digital Notarization**. Store a `SHA-256` hash of every final PDF in a write-once ledger. Generate a monthly "Trust Manifest" signed by FiskAI's master certificate.

### A1.3 Market-Ready Feature Roadmap (The 100 Things - Priority P0)

Critical missing compliance features for the Croatian market.

1. **Travel Orders (Putni Nalozi)**:
   - Dependency: Essential for owners to payout tax-free mileage.
   - Requirements: Odometer log, purpose of trip, per diem (30€/15€) calculation.
2. **Locco Driving Log**:
   - Simplified mileage tracker for city travel (under 30km).
3. **Internal Warehouse (Skladište)**:
   - Mandatory for retail `legalForm`. Tracks entry/exit of goods (Primke).
4. **GDPR Data Retention Automator**:
   - Logic: Auto-delete employee personal data 5 years after termination (unless pension relevant), but keep Invoices for 11 years.

### A1.4 Strategic Proof Points

- **Timeline**: B2B E-Invoicing is mandatory starting **Jan 1, 2026** (Fiskalizacija 2.0).
- **Integrity**: Every document issued must include a **QR Code** for verification via the Porezna Uprava portal (even if non-cash).

---

## Appendix 2: Improvement Ledger (Audit + Fixes)

> **Status:** All items in this audit ledger have been reviewed and addressed in v4.1.0. See Document History for change summary.

**How to use this appendix**

- Doc refs point to exact lines in `docs/PRODUCT_BIBLE.md` (v4.0.0, pre-append).
- Evidence points to current repo files showing the implemented behavior.
- Each item ends with a concrete fix (doc update, code update, or both).

### A2.1 High-impact mismatches (fix before external launch)

- Doc refs: `docs/PRODUCT_BIBLE.md:1175` `docs/PRODUCT_BIBLE.md:1181` `docs/PRODUCT_BIBLE.md:1185` `docs/PRODUCT_BIBLE.md:1202`
  Issue: Pricing tiers and module-to-tier mapping in the bible do not match Stripe plan config (doc: Free/Paušalni/Pro/Business/Enterprise vs code: pausalni/standard/pro).
  Evidence: `src/lib/billing/stripe.ts:26` `src/lib/billing/stripe.ts:47`.
  Fix: Decide canonical tiers and update both bible + `PLANS` (including entitlements and UI labels).

- Doc refs: `docs/PRODUCT_BIBLE.md:1139` `docs/PRODUCT_BIBLE.md:1144` `docs/PRODUCT_BIBLE.md:1151` `docs/PRODUCT_BIBLE.md:1154`
  Issue: IE-Računi and SaltEdge are marked production-ready but providers are not implemented/available.
  Evidence: `src/lib/e-invoice/provider.ts:33` `src/lib/bank-sync/providers/index.ts:4`.
  Fix: Downgrade status in bible or implement providers; adjust Implementation Status matrix.

- Doc refs: `docs/PRODUCT_BIBLE.md:1424` `docs/PRODUCT_BIBLE.md:1442` `docs/PRODUCT_BIBLE.md:1461`
  Issue: API reference lists invoice CRUD and `/api/banking/transactions`, but only PDF + banking import/reconciliation endpoints exist.
  Evidence: `src/app/api/invoices/[id]/pdf/route.ts:6` `src/app/api/banking/reconciliation/match/route.ts:1` `src/app/api/banking/import/upload/route.ts:1`.
  Fix: Replace API list with actual route inventory and explicitly note server actions for CRUD.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:415`
  Issue: Banking is labeled FREE/default in the bible, but `defaultEnabled` is false in module definitions.
  Evidence: `src/lib/modules/definitions.ts:80` `src/lib/modules/definitions.ts:86`.
  Fix: Decide whether banking should be default-on; align module defaults, doc table, and seed entitlements.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:427`
  Issue: AUTO entitlements (pausalni/vat/corporate-tax) are described as legalForm-based, but code only checks entitlements.
  Evidence: `src/lib/capabilities.ts:51` `src/lib/capabilities.ts:53`.
  Fix: Implement auto-entitlements or update bible to state manual toggles + visibility rules.

- Doc refs: `docs/PRODUCT_BIBLE.md:446` `docs/PRODUCT_BIBLE.md:456`
  Issue: Bible uses `createModuleAccess`/`ModuleGate` for gating; app uses `deriveCapabilities` + visibility components and no ModuleGate exists.
  Evidence: `src/lib/modules/access.ts:10` `src/lib/visibility/components.tsx:32` `src/components/layout/sidebar.tsx:136`.
  Fix: Update gating examples or implement a ModuleGate and use it consistently.

- Doc refs: `docs/PRODUCT_BIBLE.md:139` `docs/PRODUCT_BIBLE.md:159` `docs/PRODUCT_BIBLE.md:350` `docs/PRODUCT_BIBLE.md:908`
  Issue: Mixed 40k/60k thresholds create contradictions across personas, UI copy, and tax data.
  Evidence: `src/lib/fiscal-data/data/thresholds.ts:20` `src/lib/fiscal-data/data/thresholds.ts:35` (60k) vs `src/app/(app)/reports/vat-threshold/page.tsx:31` (40k).
  Fix: Use `THRESHOLDS.pdv/pausalni` everywhere and show effective-year values.

- Doc refs: `docs/PRODUCT_BIBLE.md:1454` `docs/PRODUCT_BIBLE.md:1456`
  Issue: E-invoice endpoints in bible do not match actual inbox/receive routes.
  Evidence: `src/app/api/e-invoices/inbox/route.ts:1` `src/app/api/e-invoices/receive/route.ts:1`.
  Fix: Update API reference and flow narratives to the inbox/receive model.

### A2.2 Module system & entitlements consistency

- Doc refs: `docs/PRODUCT_BIBLE.md:429` `docs/PRODUCT_BIBLE.md:439`
  Issue: Module definition snippet uses `requiredFor` and `navItems` objects; actual ModuleDefinition has `navItems: string[]` and no `requiredFor`.
  Evidence: `src/lib/modules/definitions.ts:22` `src/lib/modules/definitions.ts:27`.
  Fix: Update snippet or extend module definitions to include `requiredFor` and rich nav metadata.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:408`
  Issue: Entitlements are described as `Company.entitlements[]` but schema stores nullable JSON with no enforced shape.
  Evidence: `prisma/schema.prisma:87` `prisma/schema.prisma:105`.
  Fix: Document JSON array shape + validation, or migrate to `String[]`.

- Doc refs: `docs/PRODUCT_BIBLE.md:410` `docs/PRODUCT_BIBLE.md:417`
  Issue: Default entitlements diverge across code paths (module defaults vs capabilities defaults vs plan settings defaults).
  Evidence: `src/lib/modules/definitions.ts:162` `src/lib/capabilities.ts:27` `src/app/(app)/settings/plan-settings-form.tsx:32`.
  Fix: Create a single source of truth for defaults and reference it in the bible.

- Doc refs: `docs/PRODUCT_BIBLE.md:446` `docs/PRODUCT_BIBLE.md:451`
  Issue: Several pages check non-existent module keys (`reports`, `eInvoicing`, `invoicing` for products).
  Evidence: `src/app/(app)/reports/page.tsx:62` `src/app/(app)/e-invoices/page.tsx:58` `src/app/(app)/products/page.tsx:20`.
  Fix: Update code to use canonical kebab-case module keys from the bible.

### A2.3 Visibility, guidance, onboarding alignment

- Doc refs: `docs/PRODUCT_BIBLE.md:552` `docs/PRODUCT_BIBLE.md:558` `docs/PRODUCT_BIBLE.md:839`
  Issue: Competence levels in bible (beginner/standard/expert) do not match implemented levels (beginner/average/pro).
  Evidence: `src/lib/visibility/rules.ts:11` `src/lib/guidance/constants.ts:5` `src/components/onboarding/step-competence.tsx:17`.
  Fix: Standardize terminology across guidance, onboarding, and docs.

- Doc refs: `docs/PRODUCT_BIBLE.md:606` `docs/PRODUCT_BIBLE.md:612`
  Issue: Onboarding completion logic references `featureFlags?.competence`, but visibility uses only core company fields.
  Evidence: `src/lib/visibility/server.ts:89` `src/components/layout/header.tsx:60`.
  Fix: Clarify which flow controls "onboarding complete" and align doc/logic.

- Doc refs: `docs/PRODUCT_BIBLE.md:576` `docs/PRODUCT_BIBLE.md:587`
  Issue: Doc says `Visible` checks entitlements; actual visibility ignores entitlements.
  Evidence: `src/lib/visibility/context.tsx:136` `src/lib/visibility/context.tsx:142`.
  Fix: Add entitlements to visibility or update the doc to state entitlements are checked separately.

- Doc refs: `docs/PRODUCT_BIBLE.md:561` `docs/PRODUCT_BIBLE.md:575`
  Issue: Element IDs in the bible do not fully match the canonical registry (e.g., `card:insights` exists but is not listed).
  Evidence: `src/lib/visibility/elements.ts:13` `src/lib/visibility/elements.ts:15`.
  Fix: Replace the table with the canonical `ElementId` registry.

- Doc refs: `docs/PRODUCT_BIBLE.md:839` `docs/PRODUCT_BIBLE.md:851`
  Issue: Competence is described as global + category levels in onboarding; only global is collected there.
  Evidence: `src/components/onboarding/step-competence.tsx:10` `src/lib/db/schema/guidance.ts:30`.
  Fix: Document category-level controls in `/settings/guidance` and keep onboarding global-only.

- Doc refs: `docs/PRODUCT_BIBLE.md:917` `docs/PRODUCT_BIBLE.md:939`
  Issue: Passkey login is described, but the UI flow is TODO.
  Evidence: `src/components/auth/AuthFlow.tsx:28`.
  Fix: Mark passkeys as planned or implement the flow.

### A2.4 Navigation & UI alignment

- Doc refs: `docs/PRODUCT_BIBLE.md:753` `docs/PRODUCT_BIBLE.md:767`
  Issue: Sidebar sections in bible do not match the live navigation registry.
  Evidence: `src/lib/navigation.ts:33` `src/lib/navigation.ts:92`.
  Fix: Update sidebar spec to mirror the `navigation` source of truth.

- Doc refs: `docs/PRODUCT_BIBLE.md:770` `docs/PRODUCT_BIBLE.md:773`
  Issue: Doc claims nav hides locked items; actual UI shows locked state with a lock icon.
  Evidence: `src/lib/visibility/components.tsx:134` `src/components/layout/sidebar.tsx:157`.
  Fix: Update doc to reflect locked nav state (or remove lock UI).

- Doc refs: `docs/PRODUCT_BIBLE.md:775` `docs/PRODUCT_BIBLE.md:783`
  Issue: Mobile UI described as bottom navigation; implementation uses a slide-out drawer.
  Evidence: `src/components/layout/mobile-nav.tsx:63`.
  Fix: Update doc or implement the bottom nav.

- Doc refs: `docs/PRODUCT_BIBLE.md:785` `docs/PRODUCT_BIBLE.md:790`
  Issue: Action drawer is not implemented; mobile uses command palette FAB.
  Evidence: `src/components/layout/mobile-nav.tsx:203`.
  Fix: Replace action drawer spec with command palette behavior or build the drawer.

- Doc refs: `docs/PRODUCT_BIBLE.md:738` `docs/PRODUCT_BIBLE.md:747`
  Issue: Header spec mentions Quick Level Toggle without tying it to guidance preferences.
  Evidence: `src/components/layout/header.tsx:128` `src/components/guidance/QuickLevelToggle.tsx:7`.
  Fix: Add guidance preference wiring in the header spec.

### A2.5 Staff & Admin portals

- Doc refs: `docs/PRODUCT_BIBLE.md:247` `docs/PRODUCT_BIBLE.md:254`
  Issue: Staff portal spec focuses on "Pending Actions/Quick Export" while actual navigation is Dashboard/Clients/Calendar/Tasks/Tickets/Documents.
  Evidence: `src/components/staff/sidebar.tsx:17` `src/app/(staff)/clients/page.tsx:1`.
  Fix: Update staff IA in bible or implement the specified features.

- Doc refs: `docs/PRODUCT_BIBLE.md:247` `docs/PRODUCT_BIBLE.md:260`
  Issue: Staff dashboard claims multi-client deadlines/activity, but code has TODOs.
  Evidence: `src/components/staff/dashboard.tsx:22` `src/components/staff/dashboard.tsx:41`.
  Fix: Mark these as planned until implemented.

- Doc refs: `docs/PRODUCT_BIBLE.md:272` `docs/PRODUCT_BIBLE.md:280`
  Issue: Admin portal feature list (News, Metrics) does not match actual admin sidebar (Subscriptions, Services, Audit Log).
  Evidence: `src/components/admin/sidebar.tsx:17` `src/components/admin/dashboard.tsx:45`.
  Fix: Align admin portal spec with nav or build missing sections.

### A2.6 Data models & enums

- Doc refs: `docs/PRODUCT_BIBLE.md:1294` `docs/PRODUCT_BIBLE.md:1307`
  Issue: Company model in bible shows required fields; schema allows nullable `legalForm`, `email`, `iban`, and `entitlements`.
  Evidence: `prisma/schema.prisma:87` `prisma/schema.prisma:105`.
  Fix: Update bible to match schema or explicitly mark as target state.

- Doc refs: `docs/PRODUCT_BIBLE.md:1331` `docs/PRODUCT_BIBLE.md:1344`
  Issue: EInvoice model fields in bible do not match schema field names.
  Evidence: `prisma/schema.prisma:227` `prisma/schema.prisma:240`.
  Fix: Update model snippet and downstream flow docs to use canonical field names.

- Doc refs: `docs/PRODUCT_BIBLE.md:1337` `docs/PRODUCT_BIBLE.md:1339`
  Issue: Status and invoice type enums in bible are incomplete.
  Evidence: `prisma/schema.prisma:1300` `prisma/schema.prisma:1318`.
  Fix: Add `ARCHIVED`, `ERROR`, and `DEBIT_NOTE` to the bible.

- Doc refs: `docs/PRODUCT_BIBLE.md:1365` `docs/PRODUCT_BIBLE.md:1404`
  Issue: "Missing Models" list ignores models already present (StaffAssignment, BankAccount, BankTransaction, Statement, SupportTicket, EmailConnection).
  Evidence: `prisma/schema.prisma:167` `prisma/schema.prisma:464` `prisma/schema.prisma:677` `prisma/schema.prisma:748` `prisma/schema.prisma:563`.
  Fix: Move implemented models into core models; keep only true gaps.

- Doc refs: `docs/PRODUCT_BIBLE.md:1328`
  Issue: Guidance preferences (global + per-category levels) are stored via Drizzle and not documented.
  Evidence: `src/lib/db/drizzle.ts:1` `src/lib/db/schema/guidance.ts:30`.
  Fix: Add a "Guidance Preferences" model subsection.

### A2.7 API & integration inventory

- Doc refs: `docs/PRODUCT_BIBLE.md:1424` `docs/PRODUCT_BIBLE.md:1437`
  Issue: API reference omits several real routes (guidance, deadlines, receipts, compliance).
  Evidence: `src/app/api/guidance/preferences/route.ts:1` `src/app/api/deadlines/route.ts:1` `src/app/api/receipts/upload/route.ts:1` `src/app/api/compliance/en16931/route.ts:1`.
  Fix: Expand API list to include these groups.

- Doc refs: `docs/PRODUCT_BIBLE.md:1439` `docs/PRODUCT_BIBLE.md:1447`
  Issue: Invoice CRUD is documented as REST; actual CRUD is server actions and only PDF is exposed as API.
  Evidence: `src/app/api/invoices/[id]/pdf/route.ts:6` `src/app/actions/invoice.ts:375`.
  Fix: Update API reference and clarify server action usage.

- Doc refs: `docs/PRODUCT_BIBLE.md:1459` `docs/PRODUCT_BIBLE.md:1465`
  Issue: Banking endpoints in doc omit `/api/bank/*` connect/callback and list a non-existent `transactions` endpoint.
  Evidence: `src/app/api/bank/connect/route.ts:1` `src/app/api/banking/reconciliation/route.ts:1`.
  Fix: Split banking API into bank-connect vs bank-import/reconciliation sections.

- Doc refs: `docs/PRODUCT_BIBLE.md:1159` `docs/PRODUCT_BIBLE.md:1167`
  Issue: Bank import formats list includes MT940/PBZ not implemented; actual support is CAMT.053 XML + CSV (Erste/Raiffeisen/generic).
  Evidence: `src/lib/banking/import/processor.ts:87` `src/lib/banking/csv-parser.ts:42`.
  Fix: Update formats list or implement missing parsers.

- Doc refs: `docs/PRODUCT_BIBLE.md:1135` `docs/PRODUCT_BIBLE.md:1158`
  Issue: Compliance API (EN16931/Croatian validation) and sandbox endpoints are not mentioned.
  Evidence: `src/app/api/compliance/en16931/route.ts:1` `src/app/api/sandbox/e-invoice/route.ts:1`.
  Fix: Add compliance + sandbox endpoints under integrations.

### A2.8 Tax & regulatory data governance

- Doc refs: `docs/PRODUCT_BIBLE.md:1055` `docs/PRODUCT_BIBLE.md:1064`
  Issue: Tax data is manually embedded without `lastVerified` or `source`, despite coded fiscal data containing those fields.
  Evidence: `src/lib/fiscal-data/data/thresholds.ts:13` `src/lib/fiscal-data/data/thresholds.ts:15`.
  Fix: Add source + lastVerified to bible and reference `fiscal-data` as canonical.

- Doc refs: `docs/PRODUCT_BIBLE.md:1067` `docs/PRODUCT_BIBLE.md:1088`
  Issue: Income/corporate tax rates should be tied to `fiscal-data` for auto-updates.
  Evidence: `src/lib/fiscal-data/data/tax-rates.ts:16` `src/lib/fiscal-data/data/tax-rates.ts:45`.
  Fix: Add a "data source" callout pointing to `TAX_RATES`.

- Doc refs: `docs/PRODUCT_BIBLE.md:1092` `docs/PRODUCT_BIBLE.md:1099`
  Issue: Contribution rates are correct but should cite the canonical data source and verification date.
  Evidence: `src/lib/fiscal-data/data/contributions.ts:13` `src/lib/fiscal-data/data/contributions.ts:16`.
  Fix: Include `lastVerified` and `source`.

- Doc refs: `docs/PRODUCT_BIBLE.md:1103` `docs/PRODUCT_BIBLE.md:1108`
  Issue: IBAN list should align with `PAYMENT_DETAILS` and include "poziv na broj" format.
  Evidence: `src/lib/fiscal-data/data/payment-details.ts:21` `src/lib/fiscal-data/data/payment-details.ts:58`.
  Fix: Add the `pozivNaBrojFormat` notes.

- Doc refs: `docs/PRODUCT_BIBLE.md:1112` `docs/PRODUCT_BIBLE.md:1124`
  Issue: Deadlines list should reference the canonical `DEADLINES` data (and clarify PDV quarterly dates).
  Evidence: `src/lib/fiscal-data/data/deadlines.ts:12` `src/lib/fiscal-data/data/deadlines.ts:78`.
  Fix: Note that deadlines are generated from `fiscal-data` and should not be hand-edited.

### A2.9 Architecture + documentation coverage gaps

- Doc refs: `docs/PRODUCT_BIBLE.md:65` `docs/PRODUCT_BIBLE.md:70`
  Issue: Stack omits Drizzle usage for guidance tables.
  Evidence: `src/lib/db/drizzle.ts:1`.
  Fix: Add Drizzle to tech stack and explain why (guidance prefs/checklists).

- Doc refs: `docs/PRODUCT_BIBLE.md:80` `docs/PRODUCT_BIBLE.md:105`
  Issue: Directory structure omits major systems (guidance, visibility, admin/staff components, bank-sync, drizzle schema).
  Evidence: `src/lib/visibility/rules.ts:1` `src/components/staff/sidebar.tsx:1` `src/lib/bank-sync/providers/index.ts:1`.
  Fix: Expand directory tree or add "Notable folders" list.

- Doc refs: `docs/PRODUCT_BIBLE.md:1491` `docs/PRODUCT_BIBLE.md:1508`
  Issue: Glossary missing key terms like EN16931, UBL, CAMT.053, Hub3, R1/R2.
  Evidence: `src/app/api/compliance/en16931/route.ts:1` `src/lib/banking/import/processor.ts:87`.
  Fix: Extend glossary to cover compliance + banking terms.

- Doc refs: `docs/PRODUCT_BIBLE.md:1512` `docs/PRODUCT_BIBLE.md:1524`
  Issue: File locations appendix omits `capabilities`, `visibility`, `guidance`, `admin/staff` components, and `drizzle`.
  Evidence: `src/lib/capabilities.ts:1` `src/lib/visibility/context.tsx:1` `src/components/admin/sidebar.tsx:1` `src/lib/db/drizzle.ts:1`.
  Fix: Expand Appendix B to include these paths.

### A2.10 External verification backlog (needs online confirmation)

- Doc refs: `docs/PRODUCT_BIBLE.md:299` `docs/PRODUCT_BIBLE.md:305`
  Issue: Min capital amounts are listed in HRK (pre-euro) and require official EUR update.
  Evidence: No canonical value in repo.
  Fix: Verify via official registry/law and update to EUR values.

- Doc refs: `docs/PRODUCT_BIBLE.md:371` `docs/PRODUCT_BIBLE.md:373`
  Issue: VAT invoice requirements should be cross-checked against current law for 2025 revisions.
  Evidence: No explicit validator in repo for invoice header text.
  Fix: Verify against official sources and update phrasing if needed.

---

## Appendix F: Changelog (December 2024)

> Major features and changes implemented since December 2024 (PRs #51-#119).

### Regulatory Truth Layer (RTL)

| Date       | PR       | Feature                                                                           |
| ---------- | -------- | --------------------------------------------------------------------------------- |
| 2024-12-21 | #85+     | Complete 6-agent pipeline (Sentinel/Extractor/Composer/Reviewer/Arbiter/Releaser) |
| 2024-12-22 | #86-90   | Watchdog alerting, conflict detection, service architecture                       |
| 2024-12-23 | #91-94   | P0/P1 fixes, E2E audit, autonomy closure                                          |
| 2024-12-24 | #95-96   | OCR preprocessing lane, Vision fallback for scanned PDFs                          |
| 2024-12-25 | #97-99   | Assistant E2E verification, sprint summary                                        |
| 2024-12-26 | #100-106 | Knowledge Shapes (7 shapes), taxonomy engine, query router                        |
| 2024-12-27 | #107-112 | Self-enforcing design system, visible reasoning UX                                |
| 2024-12-27 | #113-115 | Living Truth infrastructure, content bridge                                       |
| 2024-12-28 | #116-119 | Product Bible restructure, OCR audit improvements                                 |

### AI Assistant

| Date       | PR   | Feature                                                    |
| ---------- | ---- | ---------------------------------------------------------- |
| 2024-12-24 | #95  | Premium consultation surface with evidence-first responses |
| 2024-12-24 | #95  | Fail-closed architecture (refuses rather than hallucinate) |
| 2024-12-25 | #97  | E2E verification with 20-question audit                    |
| 2024-12-26 | #100 | Visible reasoning with 7-stage pipeline                    |
| 2024-12-26 | #100 | Reasoning stepper UI, SSE streaming                        |
| 2024-12-26 | #100 | Refusal policy system with codes and templates             |

### Knowledge Shapes (Neuro-Symbolic Architecture)

| Shape                 | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| AtomicClaim           | Logic-based facts with WHO/WHEN/WHAT conditions   |
| ClaimException        | Lex specialis overrides                           |
| ConceptNode           | Taxonomy with synonyms and hypernyms              |
| RegulatoryProcess     | Step-by-step workflows                            |
| ReferenceTable        | Lookup tables (IBANs, codes, rates)               |
| RegulatoryAsset       | Official forms and documents                      |
| TransitionalProvision | Temporal rules for rate/law changes               |
| ComparisonMatrix      | Structured comparisons (e.g., tax regime options) |

### Infrastructure & DevOps

| Date       | Feature                                      |
| ---------- | -------------------------------------------- |
| 2024-12-27 | Self-enforcing design system with CVA tokens |
| 2024-12-27 | Custom ESLint rule for hardcoded colors      |
| 2024-12-27 | Enterprise-grade SEO infrastructure          |
| 2024-12-27 | Authority-first performance with caching     |
| 2024-12-27 | Adaptive Sentinel (topology-aware crawler)   |
| 2024-12-27 | Branch protection policy with pre-push hooks |
| 2024-12-28 | Product Bible split into modular chapters    |

### Audits Completed

| Audit                     | Status  | Key Findings                        |
| ------------------------- | ------- | ----------------------------------- |
| Security (OWASP A01-A10)  | PASS    | No critical vulnerabilities         |
| Tenant Isolation          | PASS    | Proper companyId scoping            |
| EN16931 XML Compliance    | PASS    | Valid e-invoice generation          |
| ZKI/JIR Fiscalization     | PARTIAL | Sandbox mode only                   |
| OCR Processing            | PASS    | Tesseract + Vision fallback working |
| Assistant Query Answering | PASS    | Fail-closed, citation-verified      |
| Extractor Accuracy        | PASS    | 85%+ extraction confidence          |
| Composer Rules            | PASS    | Proper aggregation                  |
| Releaser Publication      | PASS    | PUBLISHED-only enforcement          |

---

## Appendix G: Implementation Plans Index

> Reference to major implementation plans in `/docs/plans/`.

### Core Systems

| Plan                                            | Description                          |
| ----------------------------------------------- | ------------------------------------ |
| `2025-12-21-regulatory-truth-implementation.md` | 6-agent RTL pipeline                 |
| `2024-12-24-assistant-implementation-plan.md`   | AI Assistant with reasoning pipeline |
| `2025-12-26-knowledge-shapes-design.md`         | 7 Knowledge Shapes architecture      |
| `2025-12-26-visible-reasoning-ux-design.md`     | Visible reasoning UI                 |

### Feature Modules

| Plan                                            | Description                        |
| ----------------------------------------------- | ---------------------------------- |
| `2025-12-18-adaptive-guidance-system-design.md` | Competence-based guidance system   |
| `2025-12-18-pausalni-compliance-hub-design.md`  | Pausalni obrt compliance dashboard |
| `2025-12-17-pos-fiskalna-blagajna-design.md`    | POS fiscalization module           |
| `2024-12-14-bank-sync-implementation.md`        | Bank sync with CAMT.053/CSV import |
| `2024-12-14-unified-documents-hub.md`           | Universal document management      |

### Infrastructure

| Plan                                             | Description                  |
| ------------------------------------------------ | ---------------------------- |
| `2025-12-22-service-architecture-design.md`      | Microservices architecture   |
| `2025-12-17-design-system-cva.md`                | CVA-based design system      |
| `2025-12-21-marketing-content-governance.md`     | Content governance framework |
| `2025-12-20-product-bible-v41-implementation.md` | Product Bible v4.1 alignment |

---

## Appendix H: Environment Variables Reference

> Comprehensive reference for all environment variables used across the FiskAI platform.

### Core Application

| Variable                  | Description                            | Required | Example                           |
| ------------------------- | -------------------------------------- | -------- | --------------------------------- |
| `DATABASE_URL`            | Core PostgreSQL connection string      | Yes      | `postgresql://user:pass@host/db`  |
| `REGULATORY_DATABASE_URL` | Regulatory PostgreSQL connection (RTL) | For RTL  | `postgresql://user:pass@host/rtl` |
| `NEXTAUTH_URL`            | Base URL for NextAuth                  | Yes      | `https://app.fiskai.hr`           |
| `NEXTAUTH_SECRET`         | Auth encryption key (32+ chars)        | Yes      | (generated secret)                |
| `NEXT_PUBLIC_APP_URL`     | Public app URL (exposed to browser)    | Yes      | `https://app.fiskai.hr`           |
| `NODE_ENV`                | Environment mode                       | Yes      | `development`, `production`       |

### Email & Notifications

| Variable            | Description                          | Required | Example                      |
| ------------------- | ------------------------------------ | -------- | ---------------------------- |
| `RESEND_API_KEY`    | Resend email service API key         | Yes      | `re_...`                     |
| `RESEND_FROM_EMAIL` | From address for transactional email | Yes      | `FiskAI <noreply@fiskai.hr>` |

### AI & LLM (Ollama)

All AI operations use Ollama exclusively (no OpenAI).

#### Core Ollama Variables

| Variable              | Description             | Required | Example                        |
| --------------------- | ----------------------- | -------- | ------------------------------ |
| `OLLAMA_ENDPOINT`     | Ollama API endpoint URL | For RTL  | `http://localhost:11434`       |
| `OLLAMA_API_KEY`      | Ollama API key          | For RTL  | (API key)                      |
| `OLLAMA_MODEL`        | Default LLM model       | For RTL  | `llama3.1`, `gemini-2.5-flash` |
| `OLLAMA_VISION_MODEL` | Vision model for OCR    | For OCR  | `llama3.2-vision`              |

#### Specialized Ollama Endpoints (RTL Workers)

| Variable                  | Used By           | Description                        |
| ------------------------- | ----------------- | ---------------------------------- |
| `OLLAMA_EXTRACT_ENDPOINT` | Extractor worker  | Extraction-specific endpoint       |
| `OLLAMA_EXTRACT_API_KEY`  | Extractor worker  | Extraction API key                 |
| `OLLAMA_EXTRACT_MODEL`    | Extractor worker  | Extraction model                   |
| `OLLAMA_EMBED_ENDPOINT`   | Embedding workers | Embedding endpoint                 |
| `OLLAMA_EMBED_API_KEY`    | Embedding workers | Embedding API key                  |
| `OLLAMA_EMBED_MODEL`      | Embedding workers | Embedding model (nomic-embed-text) |
| `OLLAMA_EMBED_DIMS`       | Embedding workers | Embedding dimensions (768)         |

### Workers & Queues

| Variable             | Description                         | Required         | Example                     |
| -------------------- | ----------------------------------- | ---------------- | --------------------------- |
| `REDIS_URL`          | Redis connection URL (BullMQ)       | For workers      | `redis://fiskai-redis:6379` |
| `WORKER_TYPE`        | Worker type identifier              | For workers      | `extractor`, `composer`     |
| `WORKER_CONCURRENCY` | Concurrent job limit                | For workers      | `1`, `2`                    |
| `WATCHDOG_TIMEZONE`  | Scheduler timezone                  | For scheduler    | `Europe/Zagreb`             |
| `GITHUB_TOKEN`       | GitHub API token (for content sync) | For content-sync | `ghp_...`                   |

### E-Invoice Integration (ePoslovanje)

| Variable                          | Description                             | Required           | Example                      |
| --------------------------------- | --------------------------------------- | ------------------ | ---------------------------- |
| `EPOSLOVANJE_API_BASE`            | ePoslovanje API base URL                | For e-invoicing    | `https://api.eposlovanje.hr` |
| `EPOSLOVANJE_API_KEY`             | ePoslovanje API key                     | For e-invoicing    | (API key)                    |
| `COMPANY_ID`                      | Company ID for inbound polling          | For inbound worker | (UUID)                       |
| `POLL_INTERVAL_MS`                | Polling interval (milliseconds)         | Optional           | `300000` (5 minutes)         |
| `MAX_WINDOW_DAYS`                 | Max lookback window (days)              | Optional           | `7`                          |
| `USE_INTEGRATION_ACCOUNT_INBOUND` | Use IntegrationAccount credentials (V2) | Optional           | `true`                       |

### Deployment & Infrastructure

| Variable            | Description                  | Required    | Example            |
| ------------------- | ---------------------------- | ----------- | ------------------ |
| `COOLIFY_API_TOKEN` | Coolify deployment API token | For deploy  | (API token)        |
| `IMAGE_TAG`         | Docker image tag for workers | For workers | `latest`, `abc123` |

### Integrations & Services

| Variable                 | Description                       | Required    | Example       |
| ------------------------ | --------------------------------- | ----------- | ------------- |
| `STRIPE_SECRET_KEY`      | Stripe payment processing         | For billing | `sk_...`      |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key            | For billing | `pk_...`      |
| `SENTRY_DSN`             | Sentry error tracking             | Optional    | (Sentry DSN)  |
| `POSTHOG_API_KEY`        | PostHog analytics                 | Optional    | (PostHog key) |
| `INTEGRATION_VAULT_KEY`  | Master encryption key for secrets | Yes         | (32-byte hex) |

### Storage & Files

| Variable               | Description              | Required | Example            |
| ---------------------- | ------------------------ | -------- | ------------------ |
| `R2_ACCOUNT_ID`        | Cloudflare R2 account ID | Optional | (account ID)       |
| `R2_ACCESS_KEY_ID`     | Cloudflare R2 access key | Optional | (access key)       |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | Optional | (secret key)       |
| `R2_BUCKET_NAME`       | R2 bucket name           | Optional | `fiskai-documents` |

### Feature Flags & Configuration

| Variable                   | Description                      | Required | Example |
| -------------------------- | -------------------------------- | -------- | ------- |
| `ENABLE_AI_ASSISTANT`      | Enable AI assistant features     | Optional | `true`  |
| `ENABLE_RTL_PIPELINE`      | Enable RTL pipeline              | Optional | `true`  |
| `ENABLE_E_INVOICE_INBOUND` | Enable e-invoice inbound polling | Optional | `true`  |

### Development & Testing

| Variable                  | Description                            | Required | Example |
| ------------------------- | -------------------------------------- | -------- | ------- |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry              | Optional | `1`     |
| `SKIP_ENV_VALIDATION`     | Skip environment validation (dev only) | Optional | `true`  |

### Security Notes

1. **Never prefix AI keys with `NEXT_PUBLIC_`** - This would expose them to the browser
2. **All AI operations are server-side only** - No client-side AI calls
3. **IntegrationAccount secrets** - Encrypted with `INTEGRATION_VAULT_KEY`
4. **Rotate secrets regularly** - Especially API keys and tokens

### Variable Precedence

Environment variables are loaded in this order (last wins):

1. `.env` - Default values (committed to repo, no secrets)
2. `.env.local` - Local overrides (gitignored)
3. `.env.production` - Production values (deployment only)
4. Environment variables - Set in Coolify/Docker (highest priority)

---

[<- Back to Index](./00-INDEX.md)
