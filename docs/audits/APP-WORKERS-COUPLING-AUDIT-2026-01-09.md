# App ↔ Workers Coupling Audit

> **Date:** 2026-01-09
> **Auditor:** Claude Code (read-only)
> **Input:** VPS-01-INSPECTION-2026-01-09.md
> **Purpose:** Extract explicit contracts for deterministic VPS migration

---

## A) Queue Contract Inventory (BullMQ)

### Summary

- **Total Queues:** 16
- **Redis Connection:** `redis://fiskai-redis:6379` (internal Docker network)
- **BullMQ Prefix:** `fiskai`
- **Queue Key Pattern:** `{fiskai}:{queueName}:*`

### Queue Definitions (from `src/lib/regulatory-truth/workers/queues.ts`)

| Queue              | Rate Limit | Job Retention           | Purpose                       |
| ------------------ | ---------- | ----------------------- | ----------------------------- |
| sentinel           | 5/60s      | 1000 complete, 100 fail | Discovery scan jobs           |
| extract            | 10/60s     | 1000 complete, 100 fail | Fact extraction from evidence |
| ocr                | 2/60s      | 1000 complete, 100 fail | PDF OCR processing            |
| compose            | 5/60s      | 1000 complete, 100 fail | Rule composition from facts   |
| review             | 5/60s      | 1000 complete, 100 fail | Automated quality review      |
| arbiter            | 3/60s      | 1000 complete, 100 fail | Conflict resolution           |
| release            | 2/60s      | 1000 complete, 100 fail | Rule publication              |
| consolidator       | 1/300s     | 1000 complete, 100 fail | Rule consolidation            |
| content-sync       | 2/60s      | 1000 complete, 100 fail | MDX content patching          |
| article            | 2/60s      | 1000 complete, 100 fail | Article generation            |
| backup             | 2/60s      | 1000 complete, 100 fail | Company data backups          |
| embedding          | 10/60s     | 1000 complete, 100 fail | Rule embeddings               |
| evidence-embedding | 5/60s      | 1000 complete, 100 fail | Evidence embeddings           |
| scheduled          | none       | 1000 complete, 100 fail | Scheduled control jobs        |
| deadletter         | none       | 5000 complete, 500 fail | Failed job storage            |
| system-status      | none       | 500 complete, 50 fail   | Health monitoring             |

### Producer → Consumer Matrix

| Queue                  | Producers (who adds jobs)                                                            | Consumer (worker)                         |
| ---------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| **sentinel**           | scheduler.service, orchestrator.worker                                               | sentinel.worker                           |
| **extract**            | sentinel (agent), ocr.worker, webhook processor, continuous-drainer, sentinel.worker | extractor.worker                          |
| **ocr**                | sentinel (agent), webhook processor, continuous-drainer                              | ocr.worker                                |
| **compose**            | extractor.worker, continuous-drainer                                                 | composer.worker                           |
| **review**             | composer.worker, continuous-drainer                                                  | reviewer.worker                           |
| **arbiter**            | orchestrator.worker, continuous-drainer                                              | arbiter.worker                            |
| **release**            | reviewer.worker, orchestrator.worker, continuous-drainer                             | releaser.worker                           |
| **consolidator**       | (manual trigger)                                                                     | consolidator.worker                       |
| **content-sync**       | content-sync.worker (self-schedule)                                                  | content-sync.worker                       |
| **article**            | App (article-agent/queue.ts)                                                         | article.worker                            |
| **backup**             | App (lib/backup/export.ts)                                                           | (no dedicated worker - processed in-app?) |
| **embedding**          | releaser (agent)                                                                     | embedding.worker                          |
| **evidence-embedding** | sentinel (agent)                                                                     | evidence-embedding.worker                 |
| **scheduled**          | App (api/regulatory/trigger), scheduler.service                                      | scheduler.service (self-consume)          |
| **deadletter**         | base.ts (all workers on failure)                                                     | dlq-utils.ts (manual requeue)             |
| **system-status**      | App (lib/system-status/worker.ts)                                                    | system-status worker                      |

### Cross-Boundary Producers (App → Worker queues)

| Source Location                              | Queue         | Job Type                |
| -------------------------------------------- | ------------- | ----------------------- |
| `src/app/api/regulatory/trigger/route.ts:17` | scheduled     | Manual pipeline trigger |
| `src/lib/backup/export.ts:338`               | backup        | Company backup job      |
| `src/lib/article-agent/queue.ts:60,110`      | article       | Article generation job  |
| `src/lib/system-status/worker.ts:272`        | system-status | Health check job        |

**COUPLING POINT:** App directly adds jobs to worker queues. Workers cannot be moved without App knowing the new Redis endpoint.

---

## B) DB Write Ownership Matrix

### Schema: `public` (via `db`)

| Table                         | App Actions                             | Cron Jobs                               | Workers                                        |
| ----------------------------- | --------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| **Company**                   | CRUD (company.ts)                       | -                                       | -                                              |
| **CompanyUser**               | CRUD (company.ts)                       | -                                       | -                                              |
| **eInvoice**                  | CRUD (invoice.ts, fiscalize.ts, pos.ts) | update (fiscal-processor, fiscal-retry) | -                                              |
| **eInvoiceLine**              | delete (invoice.ts)                     | -                                       | -                                              |
| **FiscalRequest**             | upsert (fiscal-certificate.ts)          | update (fiscal-processor, fiscal-retry) | -                                              |
| **FiscalResponse**            | -                                       | create (fiscal-processor, fiscal-retry) | -                                              |
| **FiscalCertificate**         | upsert, delete (fiscal-certificate.ts)  | -                                       | -                                              |
| **BankAccount**               | CRUD (banking.ts)                       | update (bank-sync)                      | -                                              |
| **BankTransaction**           | create (banking.ts)                     | -                                       | -                                              |
| **StatementImport**           | create (banking.ts)                     | -                                       | -                                              |
| **MatchRecord**               | create (banking.ts)                     | -                                       | -                                              |
| **Expense**                   | CRUD (expense.ts)                       | create (recurring-expenses)             | -                                              |
| **ExpenseCategory**           | CRUD (expense.ts)                       | -                                       | -                                              |
| **RecurringExpense**          | CRUD (expense.ts)                       | update (recurring-expenses)             | -                                              |
| **SupplierBill**              | upsert (expense.ts)                     | -                                       | -                                              |
| **UraInput**                  | CRUD (expense.ts)                       | -                                       | -                                              |
| **Product**                   | CRUD (product.ts)                       | -                                       | -                                              |
| **BusinessPremises**          | CRUD (premises.ts)                      | -                                       | -                                              |
| **PaymentDevice**             | CRUD (premises.ts)                      | -                                       | -                                              |
| **SupportTicket**             | CRUD (support-ticket.ts)                | update (support-escalation)             | -                                              |
| **SupportTicketMessage**      | create (support-ticket.ts)              | -                                       | -                                              |
| **AuditLog**                  | create (various actions)                | create (fiscal-retry)                   | -                                              |
| **ImportJob**                 | -                                       | delete (cleanup-uploads)                | -                                              |
| **CertificateNotification**   | -                                       | upsert, update (certificate-check)      | -                                              |
| **SystemRegistryStatusEvent** | -                                       | deleteMany (system-status-cleanup)      | -                                              |
| **ArticleJob**                | update, delete (article-agent.ts)       | -                                       | -                                              |
| **DraftParagraph**            | update (article-agent.ts)               | -                                       | -                                              |
| **DiscoveredItem**            | -                                       | -                                       | CRUD (sentinel, site-crawler, sitemap-scanner) |
| **DiscoveryEndpoint**         | -                                       | -                                       | CRUD (sentinel, sitemap-scanner)               |
| **AgentRun**                  | -                                       | -                                       | CRUD (runner.ts)                               |
| **AtomicClaim**               | -                                       | -                                       | create (claim-extractor)                       |
| **ClaimException**            | -                                       | -                                       | create (claim-extractor)                       |
| **CandidateFact**             | -                                       | -                                       | create (extractor)                             |
| **RegulatoryRule**            | -                                       | -                                       | CRUD (composer, reviewer, arbiter, releaser)   |
| **RegulatoryConflict**        | -                                       | -                                       | CRUD (composer, reviewer, arbiter)             |
| **RuleRelease**               | -                                       | -                                       | CRUD (releaser)                                |
| **SourcePointer**             | -                                       | -                                       | updateMany (composer)                          |
| **Concept**                   | -                                       | -                                       | upsert (composer)                              |
| **RegulatoryAsset**           | -                                       | -                                       | CRUD (asset-extractor)                         |
| **ReferenceTable**            | -                                       | -                                       | CRUD (reference-extractor)                     |
| **ReferenceEntry**            | -                                       | -                                       | CRUD (reference-extractor)                     |
| **RegulatoryProcess**         | -                                       | -                                       | create (process-extractor)                     |
| **ProcessStep**               | -                                       | -                                       | create (process-extractor)                     |
| **ComparisonMatrix**          | -                                       | -                                       | upsert (comparison-extractor)                  |
| **TransitionalProvision**     | -                                       | -                                       | create (transitional-extractor)                |

### Schema: `regulatory` (via `dbReg`)

| Table                       | App | Cron | Workers                             |
| --------------------------- | --- | ---- | ----------------------------------- |
| **RegulatorySource**        | -   | -    | create (sentinel)                   |
| **Evidence**                | -   | -    | upsert, update (sentinel)           |
| **EvidenceArtifact**        | -   | -    | create (sentinel)                   |
| **ExtractionRejected**      | -   | -    | create (claim-extractor, extractor) |
| **ConflictResolutionAudit** | -   | -    | create (arbiter)                    |

### Shared Write Tables (COUPLING RISK)

| Table             | Written By                                       | Risk                     |
| ----------------- | ------------------------------------------------ | ------------------------ |
| **eInvoice**      | App actions + Cron fiscal-processor/fiscal-retry | Concurrent update race   |
| **FiscalRequest** | App actions + Cron fiscal-processor/fiscal-retry | State machine races      |
| **Expense**       | App actions + Cron recurring-expenses            | None (cron creates new)  |
| **SupportTicket** | App actions + Cron support-escalation            | Escalation flag races    |
| **BankAccount**   | App actions + Cron bank-sync                     | Balance/sync state races |

---

## C) Cron Ownership and Move Plan

### Current Cron Architecture

All cron jobs run **inside the App container** via Next.js API routes, triggered by external cron daemon calling `localhost:3002`.

### Cron Jobs Inventory (19 endpoints)

| Endpoint                          | Schedule    | DB Schema  | External Deps   | Movable?                  |
| --------------------------------- | ----------- | ---------- | --------------- | ------------------------- |
| `/api/cron/bank-sync`             | 05:00 daily | public     | Bank API        | Yes                       |
| `/api/cron/email-sync`            | 05:00 daily | public     | Email provider  | Yes                       |
| `/api/cron/news/fetch-classify`   | 23:00 daily | public     | Ollama (gpu-01) | Yes                       |
| `/api/cron/news/review`           | 23:30 daily | public     | Ollama (gpu-01) | Yes                       |
| `/api/cron/news/publish`          | 00:00 daily | public     | None            | Yes                       |
| `/api/cron/news/stale-check`      | periodic    | public     | None            | Yes                       |
| `/api/cron/fiscal-processor`      | frequent    | public     | Porezna API     | Yes                       |
| `/api/cron/fiscal-retry`          | periodic    | public     | Porezna API     | Yes                       |
| `/api/cron/certificate-check`     | daily       | public     | None            | Yes                       |
| `/api/cron/recurring-expenses`    | daily       | public     | None            | Yes                       |
| `/api/cron/cleanup-uploads`       | daily       | public     | Filesystem      | Yes                       |
| `/api/cron/rtl-staleness`         | periodic    | regulatory | None            | Yes                       |
| `/api/cron/weekly-digest`         | weekly      | public     | Resend          | **No** (uses React email) |
| `/api/cron/ai-quality-digest`     | daily       | public     | Resend          | **No** (uses React email) |
| `/api/cron/newsletter-send`       | weekly      | public     | Resend          | **No** (uses React email) |
| `/api/cron/checklist-digest`      | daily       | public     | Resend          | **No** (uses React email) |
| `/api/cron/support-escalation`    | periodic    | public     | Resend          | **No** (uses React email) |
| `/api/cron/deadline-reminders`    | daily       | public     | Resend          | **No** (uses React email) |
| `/api/cron/system-status-cleanup` | daily       | public     | None            | Yes                       |

### Move Plan Recommendations

**Phase 1 - Portable (no React email dependency):**

- bank-sync, email-sync
- news/_, fiscal-_, certificate-check
- recurring-expenses, cleanup-uploads
- rtl-staleness, system-status-cleanup

**Phase 2 - Requires App (React email components):**

- weekly-digest, ai-quality-digest
- newsletter-send, checklist-digest
- support-escalation, deadline-reminders

**Alternative:** Extract email templates to separate package, then all crons become movable.

---

## D) Secret & Env Split Plan

### Current State

**App Container (43 env vars - Coolify managed):**

```
DATABASE_URL, REGULATORY_DATABASE_URL
REDIS_URL (implicit via coolify network)
NEXTAUTH_SECRET, NEXTAUTH_URL
CRON_SECRET
RESEND_API_KEY
OLLAMA_* (multiple keys/endpoints)
EPOSLOVANJE_* (e-invoice API)
FISCAL_CERT_KEY, EINVOICE_KEY_SECRET
INTEGRATION_VAULT_KEY
STRIPE_*, CLOUDFLARE_*
```

**Workers (via docker-compose.workers.yml):**

```
DATABASE_URL, REGULATORY_DATABASE_URL (shared with App)
REDIS_URL=redis://fiskai-redis:6379 (internal)
OLLAMA_* (varies by worker)
GITHUB_TOKEN (content-sync only)
EPOSLOVANJE_* (einvoice-inbound only)
```

### Proposed Split

| Secret Category         | App Needs?       | Workers Need?                              | Notes                    |
| ----------------------- | ---------------- | ------------------------------------------ | ------------------------ |
| DATABASE_URL            | Yes              | Yes                                        | Same DB, both schemas    |
| REGULATORY_DATABASE_URL | Yes              | Yes                                        | Same connection          |
| REDIS_URL               | No (via coolify) | Yes                                        | Workers use explicit URL |
| NEXTAUTH\_\*            | Yes              | No                                         | Auth only in App         |
| CRON_SECRET             | Yes              | No                                         | API route protection     |
| RESEND_API_KEY          | Yes              | No                                         | Email sending            |
| OLLAMA*EXTRACT*\*       | No               | Yes (extractor)                            | Extraction model         |
| OLLAMA*VISION*\*        | No               | Yes (ocr)                                  | Vision model             |
| OLLAMA*EMBED*\*         | No               | Yes (embedding, evidence-embedding)        | Embedding model          |
| OLLAMA\_\* (general)    | Yes              | Yes (composer, reviewer, arbiter, article) | Shared model             |
| EPOSLOVANJE\_\*         | Yes              | Yes (einvoice-inbound)                     | E-invoice API            |
| GITHUB_TOKEN            | No               | Yes (content-sync)                         | PR creation              |
| FISCAL_CERT_KEY         | Yes              | No                                         | Certificate decryption   |
| INTEGRATION_VAULT_KEY   | Yes              | No                                         | Integration secrets      |
| STRIPE\_\*              | Yes              | No                                         | Billing                  |
| CLOUDFLARE\_\*          | Yes              | No                                         | DNS management           |

### Migration Secret Groups

**Group A - Shared (must be synchronized):**

- DATABASE_URL, REGULATORY_DATABASE_URL
- OLLAMA_ENDPOINT, OLLAMA_API_KEY, OLLAMA_MODEL

**Group B - App-only:**

- NEXTAUTH\_\*, CRON_SECRET, RESEND_API_KEY
- FISCAL_CERT_KEY, INTEGRATION_VAULT_KEY
- STRIPE*\*, CLOUDFLARE*\*

**Group C - Workers-only:**

- REDIS_URL (can be different endpoint)
- GITHUB_TOKEN
- OLLAMA*EXTRACT*_, OLLAMA*VISION*_, OLLAMA*EMBED*\*
- Worker-specific EPOSLOVANJE\_\* config

---

## E) Deployability Gap Report

### Why Workers Aren't Portable Today

| Gap                             | Impact                                                                                   | Severity |
| ------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| **Source mounts for 3 workers** | extractor, continuous-drainer, evidence-embedding use `npx tsx` with `./src:/app/src:ro` | CRITICAL |
| **Content mount**               | content-sync mounts `./content:/app/content:rw`                                          | HIGH     |
| **Coolify network dependency**  | Workers join `coolify` external network                                                  | MEDIUM   |
| **Redis internal hostname**     | `redis://fiskai-redis:6379` hardcoded                                                    | MEDIUM   |
| **DB hostname in fallback**     | `fiskai-db:5432` in compose defaults                                                     | MEDIUM   |
| **No CI/CD for workers**        | Built on VPS-01 via docker-compose                                                       | LOW      |

### Worker Runtime Analysis

| Worker                 | Runtime           | Portable? | Blocker       |
| ---------------------- | ----------------- | --------- | ------------- |
| orchestrator           | `node dist/...`   | Yes       | None          |
| sentinel               | `node dist/...`   | Yes       | None          |
| **extractor**          | `npx tsx src/...` | **No**    | Source mount  |
| ocr                    | `node dist/...`   | Yes       | None          |
| composer               | `node dist/...`   | Yes       | None          |
| reviewer               | `node dist/...`   | Yes       | None          |
| scheduler              | `node dist/...`   | Yes       | None          |
| releaser               | `node dist/...`   | Yes       | None          |
| arbiter                | `node dist/...`   | Yes       | None          |
| **continuous-drainer** | `npx tsx src/...` | **No**    | Source mount  |
| content-sync           | `node dist/...`   | Partial   | Content mount |
| article                | `node dist/...`   | Yes       | None          |
| **evidence-embedding** | `npx tsx src/...` | **No**    | Source mount  |
| embedding              | `node dist/...`   | Yes       | None          |
| einvoice-inbound       | `node dist/...`   | Yes       | None          |

### Required Fixes for Portability

1. **Compile extractor, continuous-drainer, evidence-embedding** - Change from `npx tsx` to `node dist/...`
2. **Externalize content-sync** - Use Git operations instead of filesystem mount
3. **Parameterize Redis/DB hostnames** - Use environment variables, not defaults
4. **Add worker image CI** - Build worker images in GitHub Actions

---

## F) Coupling Risk List (Top 10)

### Ranked by Migration Impact

| Rank   | Risk                          | Description                                               | Mitigation                                     |
| ------ | ----------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **1**  | Source-mounted workers        | 3 workers require source code at runtime                  | Compile to dist/                               |
| **2**  | App produces to worker queues | 4 locations where App adds jobs to worker-consumed queues | Document & parameterize Redis URL              |
| **3**  | Shared eInvoice writes        | App actions + Cron both write FiscalRequest/eInvoice      | Add optimistic locking or state machine guards |
| **4**  | Redis at maxmemory            | 2GB limit with allkeys-lru eviction may drop jobs         | Increase Redis memory or archive old jobs      |
| **5**  | Coolify network coupling      | Workers depend on external `coolify` network              | Create dedicated worker network                |
| **6**  | Content filesystem mount      | content-sync requires git repo access                     | Switch to Git API operations                   |
| **7**  | Hardcoded internal hostnames  | `fiskai-redis`, `fiskai-db` in compose defaults           | Use env vars exclusively                       |
| **8**  | Cron email dependencies       | 6 cron jobs use React email (tied to App runtime)         | Extract email templates                        |
| **9**  | Ollama endpoint sprawl        | 5 different OLLAMA\_\* endpoint configs                   | Consolidate or document clearly                |
| **10** | No worker build CI            | Workers built locally, no registry                        | Add GitHub Actions workflow                    |

### Migration Sequence Recommendation

```
Phase 0: Fix source-mounted workers (compile to dist/)
Phase 1: Move Redis (update REDIS_URL, test job flow)
Phase 2: Move compiled workers (no App changes needed)
Phase 3: Move PostgreSQL (update DATABASE_URL everywhere)
Phase 4: Move App (update Coolify config)
Phase 5: Move crons (extract email templates first)
```

---

## Summary Statistics

| Metric                       | Count          |
| ---------------------------- | -------------- |
| BullMQ Queues                | 16             |
| Worker Services              | 15             |
| Cron Endpoints               | 19             |
| App → Worker Queue Producers | 4              |
| Shared DB Write Tables       | 5              |
| Non-portable Workers         | 3              |
| Env Vars (App)               | ~43            |
| Env Vars (Workers)           | ~13 per worker |

---

## End of Report

**Generated:** 2026-01-09
**Method:** Static code analysis + runtime inspection
**No mutations performed**
