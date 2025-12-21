# Croatian Regulatory Truth Layer - Audit Guide

## Overview

This system automatically discovers, extracts, and maintains Croatian regulatory rules from government sources. It uses a 6-agent AI pipeline with human oversight for critical decisions.

**Purpose:** Keep business rules (tax thresholds, deadlines, procedures) up-to-date by monitoring official Croatian government websites.

---

## File Structure

```
src/lib/regulatory-truth/          # Core library
├── agents/                        # 6-agent pipeline
├── schemas/                       # Zod validation schemas
├── dsl/                          # Domain-specific languages
├── parsers/                      # HTML/XML parsers
├── utils/                        # Utilities (rate limiting, hashing)
├── monitoring/                   # Metrics collection
├── scheduler/                    # Cron scheduling
├── scripts/                      # CLI scripts
├── data/                         # Seed data
├── prompts/                      # AI prompts
└── __tests__/                    # Unit tests

src/app/(admin)/regulatory/        # Admin UI pages
src/app/api/admin/regulatory-truth/ # Admin API routes
src/app/api/regulatory/            # Public API routes
```

---

## Core Library Files

### Agents (`src/lib/regulatory-truth/agents/`)

| File           | Purpose                                                   | Lines |
| -------------- | --------------------------------------------------------- | ----- |
| `sentinel.ts`  | Discovers new content from sources (sitemaps, HTML lists) | ~400  |
| `extractor.ts` | Extracts structured data from documents                   | ~200  |
| `composer.ts`  | Drafts regulatory rules from extracted data               | ~250  |
| `reviewer.ts`  | Validates rules for quality and accuracy                  | ~200  |
| `arbiter.ts`   | Resolves conflicts between rules                          | ~400  |
| `releaser.ts`  | Publishes approved rules to releases                      | ~200  |
| `runner.ts`    | Common agent execution framework                          | ~150  |
| `index.ts`     | Exports all agents                                        | ~30   |

**Data Flow:**

```
Sentinel → Extractor → Composer → Reviewer → Releaser
                                      ↓
                                  Arbiter (if conflicts)
```

### Schemas (`src/lib/regulatory-truth/schemas/`)

| File           | Purpose                                |
| -------------- | -------------------------------------- |
| `common.ts`    | Shared types (SourcePointer, RiskTier) |
| `sentinel.ts`  | SentinelInput/Output schemas           |
| `extractor.ts` | ExtractorInput/Output schemas          |
| `composer.ts`  | ComposerInput/Output schemas           |
| `reviewer.ts`  | ReviewerInput/Output schemas           |
| `arbiter.ts`   | ArbiterInput/Output schemas            |
| `releaser.ts`  | ReleaserInput/Output schemas           |
| `index.ts`     | Re-exports all schemas                 |

### DSL (`src/lib/regulatory-truth/dsl/`)

| File              | Purpose                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `applies-when.ts` | Predicate DSL for rule conditions (and, or, cmp, in, exists, between, matches, date_in_effect) |
| `outcome.ts`      | Outcome types (VALUE, OBLIGATION, PROCEDURE) with deadlines                                    |

**Example AppliesWhen:**

```json
{
  "and": [
    { "cmp": ["annual_revenue", "<=", 39816.84] },
    { "in": ["activity_type", ["services", "trade"]] }
  ]
}
```

### Parsers (`src/lib/regulatory-truth/parsers/`)

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `sitemap-parser.ts`   | Parses XML sitemaps (Narodne novine) |
| `html-list-parser.ts` | Parses HTML news/regulation lists    |

### Utilities (`src/lib/regulatory-truth/utils/`)

| File              | Purpose                                 |
| ----------------- | --------------------------------------- |
| `rate-limiter.ts` | Request throttling with circuit breaker |
| `content-hash.ts` | SHA-256 hashing for change detection    |

### Monitoring (`src/lib/regulatory-truth/monitoring/`)

| File         | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `metrics.ts` | Collects pipeline metrics (counts, health, activity) |

### Scheduler (`src/lib/regulatory-truth/scheduler/`)

| File      | Purpose                               |
| --------- | ------------------------------------- |
| `cron.ts` | Daily 06:00 AM Zagreb time scheduling |

### Scripts (`src/lib/regulatory-truth/scripts/`)

| File                    | Purpose                           |
| ----------------------- | --------------------------------- |
| `overnight-run.ts`      | Main overnight pipeline execution |
| `run-sentinel.ts`       | CLI for Sentinel agent            |
| `run-extractor.ts`      | CLI for Extractor agent           |
| `run-composer.ts`       | CLI for Composer agent            |
| `run-reviewer.ts`       | CLI for Reviewer agent            |
| `run-releaser.ts`       | CLI for Releaser agent            |
| `run-arbiter.ts`        | CLI for Arbiter agent             |
| `seed-sources.ts`       | Seeds RegulatorySource table      |
| `seed-endpoints.ts`     | Seeds DiscoveryEndpoint table     |
| `bootstrap.ts`          | Initial system setup              |
| `monitor.ts`            | Real-time monitoring              |
| `verify-fiscal-data.ts` | Data verification                 |

### Tests (`src/lib/regulatory-truth/__tests__/`)

| File               | Purpose                       |
| ------------------ | ----------------------------- |
| `sentinel.test.ts` | Sentinel agent tests          |
| `arbiter.test.ts`  | Arbiter agent tests (6 tests) |

---

## Admin UI Pages (`src/app/(admin)/regulatory/`)

| Path                    | Files                            | Purpose                                  |
| ----------------------- | -------------------------------- | ---------------------------------------- |
| `/regulatory`           | `page.tsx`                       | Main dashboard (health, stats, activity) |
| `/regulatory/inbox`     | `page.tsx`, `inbox-view.tsx`     | Human review queue                       |
| `/regulatory/conflicts` | `page.tsx`, `conflicts-view.tsx` | Conflict resolution                      |
| `/regulatory/sources`   | `page.tsx`, `sources-view.tsx`   | Source management                        |
| `/regulatory/releases`  | `page.tsx`, `releases-view.tsx`  | Release history                          |

**Authentication:** All pages require ADMIN systemRole.

---

## API Routes

### Admin Routes (`src/app/api/admin/regulatory-truth/`)

| Route                     | Method | Purpose                 |
| ------------------------- | ------ | ----------------------- |
| `/status`                 | GET    | Pipeline health status  |
| `/trigger`                | POST   | Manual pipeline trigger |
| `/bootstrap`              | POST   | Initial system setup    |
| `/sources`                | GET    | List all sources        |
| `/sources/[id]/toggle`    | POST   | Enable/disable source   |
| `/sources/[id]/check`     | POST   | Trigger source check    |
| `/rules/[id]/approve`     | POST   | Approve pending rule    |
| `/rules/[id]/reject`      | POST   | Reject pending rule     |
| `/conflicts/[id]/resolve` | POST   | Resolve conflict        |

### Public Routes (`src/app/api/regulatory/`)

| Route      | Method | Purpose                |
| ---------- | ------ | ---------------------- |
| `/status`  | GET    | Public status endpoint |
| `/trigger` | POST   | Trigger (with auth)    |

---

## Database Models (Prisma)

### Core Models

| Model                | Purpose                  |
| -------------------- | ------------------------ |
| `RegulatorySource`   | Government data sources  |
| `Evidence`           | Fetched documents        |
| `SourcePointer`      | Links evidence to rules  |
| `RegulatoryRule`     | Extracted business rules |
| `RegulatoryConflict` | Conflicts between rules  |
| `RuleRelease`        | Published rule versions  |
| `AgentRun`           | Agent execution logs     |

### Discovery Models

| Model               | Purpose                   |
| ------------------- | ------------------------- |
| `DiscoveryEndpoint` | URLs to scrape            |
| `DiscoveredItem`    | Found items pending fetch |

### Key Enums

```prisma
enum RuleStatus {
  DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, DEPRECATED, REJECTED
}

enum AuthorityLevel {
  LAW, GUIDANCE, PROCEDURE, PRACTICE
}

enum AutomationPolicy {
  ALLOW, CONFIRM, BLOCK
}

enum ConflictStatus {
  OPEN, RESOLVED, ESCALATED
}
```

---

## Security Considerations

1. **Authentication:** All admin routes check `getCurrentUser()` and `systemRole === "ADMIN"`
2. **Rate Limiting:** 2-second delays between requests, circuit breaker after 5 failures
3. **Input Validation:** Zod schemas validate all agent inputs/outputs
4. **SQL Injection:** Uses Prisma ORM (parameterized queries)
5. **XSS:** React escapes output by default

---

## Risk Tiers

| Tier | Description          | Automation                   |
| ---- | -------------------- | ---------------------------- |
| T0   | Critical (tax rates) | Human approval required      |
| T1   | High impact          | Human review recommended     |
| T2   | Medium impact        | Auto-approve with monitoring |
| T3   | Low impact           | Full automation              |

---

## Authority Hierarchy

```
1. LAW (Zakon) - Legally binding
2. GUIDANCE (Mišljenje) - Official interpretation
3. PROCEDURE (Uputa) - Execution instructions
4. PRACTICE (Praksa) - What passes inspections
```

Higher authority prevails in conflicts.

---

## Key Files to Audit

**High Priority (business logic):**

1. `agents/arbiter.ts` - Conflict resolution logic
2. `agents/reviewer.ts` - Quality validation
3. `dsl/applies-when.ts` - Rule condition evaluation
4. `schemas/*.ts` - Data validation

**Medium Priority (infrastructure):**

1. `agents/sentinel.ts` - Discovery logic
2. `utils/rate-limiter.ts` - Rate limiting
3. `scheduler/cron.ts` - Scheduling

**API Security:**

1. All files in `src/app/api/admin/regulatory-truth/`

---

## Running Tests

```bash
# Run arbiter tests
npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts

# Run sentinel tests
npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts
```

---

## Environment Variables

| Variable          | Purpose               |
| ----------------- | --------------------- |
| `DATABASE_URL`    | PostgreSQL connection |
| `OLLAMA_API_KEY`  | AI service API key    |
| `OLLAMA_ENDPOINT` | AI service endpoint   |
| `OLLAMA_MODEL`    | Model to use          |

---

## Questions for Auditor

1. Are the Zod schemas sufficiently strict?
2. Is the rate limiting adequate to avoid IP bans?
3. Are there edge cases in AppliesWhen evaluation?
4. Is the authority hierarchy correctly implemented?
5. Are admin routes properly protected?

---

_Generated: 2024-12-21_
