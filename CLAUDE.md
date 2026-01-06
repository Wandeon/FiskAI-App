# FiskAI Project Notes

> Canonical document - reviewed 2025-12-28
>
> This file provides AI assistants with project context. For full documentation, see [docs/](./docs/).

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

| Portal       | URL               | Audience             | Purpose                 |
| ------------ | ----------------- | -------------------- | ----------------------- |
| Marketing    | `fiskai.hr`       | Public               | Landing, guides, auth   |
| Client App   | `app.fiskai.hr`   | Clients              | Business dashboard      |
| Staff Portal | `staff.fiskai.hr` | Internal accountants | Multi-client workspace  |
| Admin Portal | `admin.fiskai.hr` | Platform owner       | Tenant/staff management |

**SystemRole Enum:** `USER` | `STAFF` | `ADMIN` (separate from per-company roles)

## Deployment

**Server:** `152.53.146.3` (Hetzner ARM64)

**Coolify Dashboard:** https://ci.fiskai.hr (or http://152.53.146.3:8000)

**Application UUID:** `bsswgo8ggwgkw8c88wo8wcw8`

**Deploy API (trigger deployment):**

```bash
curl -X POST "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/start" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Check deployment status:**

```bash
curl -s "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" | jq '.status'
```

**Update environment variables:**

```bash
curl -X PATCH "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/envs" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY_NAME", "value": "value"}'
```

See `.claude/skills/coolify-deployment/SKILL.md` for complete API documentation.

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

- `/content/vodici/` - MDX guides
- `/content/usporedbe/` - MDX comparisons
- `/docs/plans/` - Implementation plans
- `/src/lib/modules/` - Module definitions & access control
- `/src/lib/middleware/` - Subdomain routing
- `/src/app/(marketing)/` - Public pages, auth
- `/src/app/(app)/` - Client dashboard
- `/src/app/(staff)/` - Staff portal
- `/src/app/(admin)/` - Admin portal

## Component Architecture

4-layer component system with ESLint-enforced import boundaries:

```
ui/ + motion/  →  patterns/  →  sections/  →  templates/  →  pages
```

- `src/components/ui/` - Primitives (Button, Card, Badge)
- `src/components/motion/` - Animation behaviors (Reveal, Stagger)
- `src/components/patterns/` - Composed primitives (SectionHeading, FeatureCard)
- `src/components/sections/` - Page sections (HeroSection, FeatureGrid)
- `src/components/templates/` - Portal-scoped templates (MarketingPageTemplate)

**Rule:** Each layer can only import from layers to its left. ESLint blocks upward imports.

See `docs/03_ARCHITECTURE/COMPONENT_LAYERS_MIGRATION.md` for migration guide.

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

## Environment Variables (Coolify)

Key variables configured:

- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_URL` - https://fiskai.hr
- `NEXTAUTH_SECRET` - Auth encryption key
- `NEXT_PUBLIC_APP_URL` - https://fiskai.hr
- `RESEND_API_KEY` - Email service
- `RESEND_FROM_EMAIL` - FiskAI <noreply@fiskai.hr>

## Integration Vault

- `INTEGRATION_VAULT_KEY` - Master encryption key for IntegrationAccount secrets (32-byte hex = 64 characters)

Generate with: `openssl rand -hex 32`

## AI API Key Security

**CRITICAL: AI API keys must remain server-side only.**

All AI API keys (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `OLLAMA_API_KEY`) are accessed exclusively via `process.env` in server-side code. This is by design.

**Security Rules:**

1. **Never prefix AI keys with `NEXT_PUBLIC_`** - This would expose them to the browser
2. **All AI code runs server-side** - Located in `/src/lib/ai/` and `/src/lib/assistant/`
3. **Lazy-load pattern** - OpenAI client uses `getOpenAI()` to avoid build-time errors
4. **No client-side AI calls** - All AI operations go through API routes

**Verified Locations:**

- `/src/lib/ai/extract.ts` - Server-side `getOpenAI()`
- `/src/lib/ai/ocr.ts` - Server-side `getOpenAI()`
- `/src/lib/ai/deepseek.ts` - Server-side `DEEPSEEK_API_KEY`
- `/src/lib/assistant/query-engine/answer-synthesizer.ts` - Server-side `getOpenAI()`

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

**Workers:** `docker-compose.workers.yml`

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-ocr --tail 50
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

## Documentation Structure

```
docs/
├── product-bible/       # Product Bible (modular chapters)
│   ├── 00-INDEX.md      # Master index with version history
│   ├── 01-VISION-ARCHITECTURE.md
│   ├── 02-USERS-JOURNEYS.md
│   ├── 03-LEGAL-COMPLIANCE.md
│   ├── 04-ACCESS-CONTROL.md
│   ├── 05-UI-EXPERIENCE.md
│   ├── 06-INTEGRATIONS.md
│   ├── 07-DATA-API.md
│   ├── 08-APPENDIXES.md
│   └── 09-GUIDANCE-SYSTEM.md    # NEW: Adaptive help system
├── 01_ARCHITECTURE/     # System architecture
│   └── REGULATORY_TRUTH_LAYER.md  # Complete RTL architecture
├── 02_FEATURES/         # Feature specifications
│   └── FEATURE_REGISTRY.md        # Master feature list with status
├── 03_ARCHITECTURE/     # Component architecture
│   └── AI_ASSISTANT.md            # AI Assistant system architecture
├── 04_OPERATIONS/       # Operations runbooks
├── 05_REGULATORY/       # Regulatory Truth Layer
├── 07_AUDITS/           # Audit reports
├── _meta/               # Meta-documentation
└── plans/               # Implementation plans
```

**Product Bible:** For complete product specification (vision, personas, compliance, modules, UI flows, API), see [docs/product-bible/00-INDEX.md](./docs/product-bible/00-INDEX.md).

**Architecture Docs:**

- [RTL Architecture](./docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md) - Complete Regulatory Truth Layer specification
- [AI Assistant](./docs/03_ARCHITECTURE/AI_ASSISTANT.md) - AI Assistant system architecture

See [docs/DOC-MAP.md](./docs/DOC-MAP.md) for complete documentation structure.
