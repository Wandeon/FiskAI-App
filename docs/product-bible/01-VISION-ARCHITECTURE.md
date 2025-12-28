# Vision & Architecture

[← Back to Index](./00-INDEX.md)

> **Last Audit:** 2025-12-28 | **Auditor:** Claude Opus 4.5
>
> This chapter has been updated to reflect current implementation status across all merged PRs through #119.

---

## 1. Vision & Non-Negotiables

### 1.1 What FiskAI Is

FiskAI is not a dashboard. It is a **Financial Cockpit** - a single command center where Croatian business owners see everything they need to run their business legally and efficiently.

**Core Promise:** "Never miss a deadline, never overpay taxes, never wonder what to do next."

### 1.2 Non-Negotiables

| Rule                       | Enforcement                                                            | Status      | Why                                                       |
| -------------------------- | ---------------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| **Zero Data Leakage**      | Prisma query extensions with AsyncLocalStorage tenant isolation        | Implemented | Multi-tenant SaaS - one company cannot see another's data |
| **Regulatory First**       | Croatian legal requirements hardcoded + Regulatory Truth Layer         | Implemented | Fiskalizacija, 11-year archive, PDV rules are law         |
| **Experience-Clean**       | No empty states without clear "Step 1" CTA                             | Implemented | Users should never feel lost or abandoned                 |
| **One Truth**              | Single module registry, single key system, single visibility engine    | Implemented | No conflicting logic paths                                |
| **Progressive Disclosure** | Visibility system with competence levels + progression stages          | Implemented | Don't overwhelm beginners                                 |
| **Document Integrity**     | SHA-256 hashing + audit logging + Evidence immutability protection     | Implemented | 11-year archive must prove documents unaltered            |
| **Evidence Immutability**  | Prisma extensions block Evidence.rawContent modification post-creation | Implemented | Regulatory chain integrity (PR #115)                      |

### 1.3 The Three Portals

| Portal           | URL               | SystemRole | Purpose                           | Status      |
| ---------------- | ----------------- | ---------- | --------------------------------- | ----------- |
| **Client App**   | `app.fiskai.hr`   | `USER`     | Business owner's cockpit          | Implemented |
| **Staff Portal** | `staff.fiskai.hr` | `STAFF`    | Accountant multi-client workspace | Implemented |
| **Admin Portal** | `admin.fiskai.hr` | `ADMIN`    | Platform management               | Implemented |

**Marketing Site:** `fiskai.hr` (public, no auth required)

---

## 2. Architecture Overview

### 2.1 Tech Stack

| Layer       | Technology               | Purpose                                | Status      |
| ----------- | ------------------------ | -------------------------------------- | ----------- |
| Framework   | Next.js 15 App Router    | Server components, streaming, routing  | Implemented |
| Database    | PostgreSQL 16 + Prisma 7 | Primary data persistence, multi-tenant | Implemented |
| Database    | Drizzle ORM              | Guidance, news, paušalni tables        | Implemented |
| Auth        | NextAuth v5 (Auth.js)    | Session management, OAuth, Passkeys    | Implemented |
| Styling     | Tailwind CSS + CVA       | Design system, component variants      | Implemented |
| Validation  | Zod                      | Schema validation everywhere           | Implemented |
| Email       | Resend                   | Transactional email                    | Implemented |
| Storage     | Cloudflare R2            | Encrypted document archive             | Implemented |
| Payments    | Stripe                   | Subscriptions, Terminal                | Implemented |
| Banking     | Gocardless/SaltEdge      | PSD2 bank connections                  | Implemented |
| Fiscal      | FINA CIS                 | Croatian fiscalization                 | Implemented |
| Queue       | Redis + BullMQ           | Worker job queues                      | Implemented |
| AI/LLM      | Ollama (local)           | Extraction, composition, review        | Implemented |
| Bot Defense | Cloudflare Turnstile     | Auth form protection                   | Implemented |

### 2.2 Directory Structure

```
/src
├── app/
│   ├── (marketing)/     # Public pages (fiskai.hr)
│   ├── (app)/           # Client dashboard (app.fiskai.hr)
│   ├── (staff)/         # Staff portal (staff.fiskai.hr)
│   ├── (admin)/         # Admin portal (admin.fiskai.hr)
│   ├── (auth)/          # Authentication flows
│   └── api/             # API routes
├── components/
│   ├── ui/              # Design system primitives
│   ├── layout/          # Header, sidebar, navigation
│   ├── dashboard/       # Dashboard widgets
│   ├── onboarding/      # Wizard steps
│   ├── guidance/        # Help system
│   └── [feature]/       # Feature-specific components
├── design-system/       # Token architecture (PR #107)
│   ├── tokens/          # Semantic tokens (surfaces, text, status)
│   ├── css/             # CSS variables
│   └── eslint/          # Enforcement rules
├── lib/
│   ├── modules/         # Module definitions & gating
│   ├── visibility/      # Progressive disclosure rules
│   ├── regulatory-truth/ # Regulatory Truth Layer (PRs #85-95, #115)
│   │   ├── agents/      # Sentinel, Extractor, Composer, etc.
│   │   ├── workers/     # Queue-based worker services
│   │   ├── dsl/         # AppliesWhen predicate DSL
│   │   ├── graph/       # Cycle detection for rule dependencies
│   │   └── taxonomy/    # Concept classification
│   ├── assistant/       # AI Assistant query engine
│   │   ├── query-engine/ # Text processing, rule selection
│   │   └── reasoning/   # Answer composition
│   ├── rbac.ts          # Permission matrix
│   ├── fiscal-data/     # Tax rates, thresholds, deadlines
│   ├── pausalni/        # Paušalni obrt logic
│   ├── e-invoice/       # UBL/XML generation
│   ├── cache/           # Cloudflare cache purge utilities
│   ├── turnstile.ts     # Bot protection verification
│   └── db/
│       ├── drizzle.ts   # Drizzle client
│       └── schema/      # Drizzle table definitions
└── content/             # MDX guides & tools
```

### 2.3 Request Flow

```
User Request
    ↓
middleware.ts (subdomain routing)
    ↓
Route Group Layout (portal check)
    ↓
Page Component (auth + company check)
    ↓
Visibility Provider (feature gating)
    ↓
Server Action (RBAC check)
    ↓
Prisma Extensions (AsyncLocalStorage tenant context)
    ↓
PostgreSQL
```

---

## 3. Regulatory Truth Layer

> **Status:** Implemented (PRs #85-95, #115, #119)
>
> **Reference:** See [docs/05_REGULATORY/OVERVIEW.md](../05_REGULATORY/OVERVIEW.md)

The Regulatory Truth Layer is a **living regulatory operating system** that synthesizes Croatian law, interpretation, procedure, and enforcement reality into a defensible, time-aware, versioned source of truth.

### 3.1 Architecture

| Component          | Purpose                             | Implementation        |
| ------------------ | ----------------------------------- | --------------------- |
| **Evidence Store** | Immutable source snapshots          | PostgreSQL + SHA-256  |
| **Rule Graph**     | Synthesized truth with versioning   | `RegulatoryRule` + FK |
| **Vector Store**   | Semantic search (non-authoritative) | PostgreSQL pgvector   |

### 3.2 Processing Pipeline

```
Discovery → OCR → Extraction → Composition → Review → Arbiter → Release
    ↓         ↓         ↓            ↓          ↓        ↓         ↓
Sentinel   Tesseract   LLM      Rule Draft   QA Check  Conflicts  Publish
           +Vision              (Composer)   (Reviewer)
```

**Workers:** Defined in `docker-compose.workers.yml`

- `worker-orchestrator` - Pipeline coordination
- `worker-sentinel` - Source discovery (Adaptive, topology-aware - PR #111)
- `worker-ocr` - Tesseract + Vision fallback (temporal filtering, cycle detection - PR #119)
- `worker-extractor` - LLM-based fact extraction (2 replicas)
- `worker-composer` - Rule aggregation
- `worker-reviewer` - Quality checks
- `worker-arbiter` - Conflict resolution
- `worker-releaser` - Publication to production
- `worker-scheduler` - Cron-based scheduling
- `worker-continuous-drainer` - 24/7 queue processing

### 3.3 Trust Guarantees

1. **Evidence-Backed:** Every rule links to source evidence via `RuleSourcePointer`
2. **No Hallucination:** LLM outputs verified against source text with quoted excerpts
3. **Fail-Closed:** Ambiguous content routes to human review queue
4. **Immutable History:** `Evidence.rawContent` protected at Prisma extension level
5. **Deterministic:** Same input produces same output

---

## 4. Design System Token Architecture

> **Status:** Implemented (PR #107)
>
> **Reference:** See [src/design-system/TOKENS.md](../../src/design-system/TOKENS.md)

### 4.1 Token Layers

```
LAYER 0: PRIMITIVES (primitives.ts)
└── Raw color values - NEVER import directly

LAYER 1: SEMANTIC (semantic/*.ts)
├── surfaces.ts  - Surface ladder (base → surface → elevated)
├── text.ts      - Text hierarchy (primary, secondary, tertiary)
├── borders.ts   - Border tokens
├── interactive.ts - Interactive states
└── colors.ts    - Status colors (success, warning, danger, info)

LAYER 2: LAYOUT (layout/*.ts)
├── spacing.ts   - 4px base spacing
├── radius.ts    - Border radius
└── elevation.ts - Shadows & z-index

LAYER 3: SPECIALIZED
├── typography.ts - Text styles
├── motion.ts     - Animation
└── data-vis.ts   - Chart colors
```

### 4.2 Enforcement

| Path                     | Level | Rule                   |
| ------------------------ | ----- | ---------------------- |
| `src/app/(app)/**`       | ERROR | Block hardcoded colors |
| `src/app/(admin)/**`     | ERROR | Block hardcoded colors |
| `src/app/(staff)/**`     | ERROR | Block hardcoded colors |
| `src/components/**`      | ERROR | Block hardcoded colors |
| `src/app/(marketing)/**` | WARN  | Warn about hardcoded   |

---

## 5. Authority-First Performance

> **Status:** Designed (PR #117), Implementation In Progress
>
> **Reference:** See [docs/plans/2025-12-27-authority-first-performance-design.md](../plans/2025-12-27-authority-first-performance-design.md)

### 5.1 Philosophy

> **Speed makes us usable; Authority makes us inevitable.**

### 5.2 Four-Phase Architecture

| Phase | Focus        | Goal                          | Status   |
| ----- | ------------ | ----------------------------- | -------- |
| A     | Edge & Trust | Sub-50ms TTFB, bot protection | Partial  |
| B     | Authority    | AI engines cite our content   | Designed |
| C     | Performance  | Perfect Core Web Vitals       | Designed |
| D     | App Feel     | PWA, network resilience       | Designed |

### 5.3 Key Decisions

- **Cloudflare Cache Tags:** Low-cardinality tags (`kb_guides`, `kb_news`, `marketing`)
- **Turnstile Scope:** Auth + public contact forms only (tools must feel instant)
- **Resource Hints:** Preconnect for analytics (PostHog, Sentry)

---

## 6. Module System

> **Status:** Implemented
>
> **Reference:** See [src/lib/modules/definitions.ts](../../src/lib/modules/definitions.ts)

### 6.1 Module Registry

16 toggleable modules stored in `Company.entitlements[]`:

| Module             | Default | Description                                |
| ------------------ | ------- | ------------------------------------------ |
| `invoicing`        | On      | Create and manage invoices                 |
| `e-invoicing`      | On      | UBL/XML electronic invoices                |
| `fiscalization`    | Off     | Fiscal receipts, JIR/ZKI, CIS              |
| `contacts`         | On      | Customer and supplier management           |
| `products`         | On      | Product catalog and pricing                |
| `expenses`         | On      | Expense tracking and categories            |
| `banking`          | Off     | Bank accounts, transactions, imports       |
| `reconciliation`   | Off     | Auto-matching and statement reconciliation |
| `reports-basic`    | On      | Aging, KPR, profit/loss                    |
| `reports-advanced` | Off     | VAT reports, exports, custom               |
| `pausalni`         | Off     | Paušalni obrt tax management               |
| `vat`              | Off     | VAT management and submissions             |
| `corporate-tax`    | Off     | DOO/JDOO tax features                      |
| `pos`              | Off     | Point of sale and Stripe Terminal          |
| `documents`        | On      | Document storage and attachments           |
| `ai-assistant`     | Off     | AI-powered help and document analysis      |

---

## 7. Visibility System

> **Status:** Implemented
>
> **Reference:** See [src/lib/visibility/](../../src/lib/visibility/)

### 7.1 Core Concepts

| Concept               | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| **Competence Level**  | User expertise (BEGINNER, INTERMEDIATE, ADVANCED) |
| **Progression Stage** | Business lifecycle stage                          |
| **Business Type**     | Entity type gating (obrt vs d.o.o.)               |
| **Element Rules**     | Per-element visibility predicates                 |

### 7.2 Components

- `<Visible elementId="..." />` - Conditional rendering
- `<VisibleNavItem />` - Navigation item with gating
- `<VisibleButton />` - Button with visibility + lock state
- `useElementStatus()` - Hook for visibility + unlock hints

---

## 8. RBAC Permission System

> **Status:** Implemented
>
> **Reference:** See [src/lib/rbac.ts](../../src/lib/rbac.ts)

### 8.1 Roles

| Role         | Scope   | Capabilities                    |
| ------------ | ------- | ------------------------------- |
| `OWNER`      | Company | Full access, billing, user mgmt |
| `ADMIN`      | Company | Most operations except billing  |
| `MEMBER`     | Company | Day-to-day operations           |
| `ACCOUNTANT` | Company | Read-only + reports + settings  |
| `VIEWER`     | Company | Read-only access                |

### 8.2 Permission Categories

- `invoice:*` - Create, read, update, delete
- `expense:*` - Create, read, update, delete
- `contact:*` - Create, read, update, delete
- `product:*` - Create, read, update, delete
- `settings:*` - Read, update company settings
- `users:*` - Invite, remove, update roles
- `reports:*` - Read, export
- `bank_account:*` - CRUD for bank accounts
- `fiscal:manage` - Fiscal certificate management
- `expense_category:*` - Category management

---

## 9. Infrastructure

> **Status:** Implemented
>
> **Reference:** See [CLAUDE.md](../../CLAUDE.md)

### 9.1 Deployment

| Component | Location                     | Notes                  |
| --------- | ---------------------------- | ---------------------- |
| Server    | Hetzner ARM64 (152.53.146.3) | Coolify-managed        |
| Database  | PostgreSQL 16 (Docker)       | Container: `fiskai-db` |
| Redis     | Redis 7 Alpine (Docker)      | BullMQ job queues      |
| CDN       | Cloudflare                   | SSL, caching, DDoS     |
| DNS       | Cloudflare                   | Primary: fiskai.hr     |

### 9.2 Docker Compose Files

| File                         | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `docker-compose.yml`         | Base database configuration            |
| `docker-compose.dev.yml`     | Development overrides                  |
| `docker-compose.prod.yml`    | Production configuration               |
| `docker-compose.workers.yml` | Regulatory Truth Layer workers + Redis |

### 9.3 Branch Protection

**CRITICAL:** All changes MUST go through Pull Requests. Direct pushes to `main` are blocked by pre-push hook (PR #109).

---

## 10. Gaps & Future Work

### 10.1 Documented but Not Yet Implemented

| Feature                   | Status   | Notes                           |
| ------------------------- | -------- | ------------------------------- |
| Authority-First Phase B-D | Designed | Answer blocks, CWV optimization |
| PWA Manifest              | Designed | Phase D of Authority-First      |
| Speculation Rules         | Designed | Prefetch for navigation         |

### 10.2 Implemented but Not Documented (Now Added)

| Feature                          | PR   | Notes                          |
| -------------------------------- | ---- | ------------------------------ |
| Design System Token Architecture | #107 | Self-enforcing with ESLint     |
| Adaptive Sentinel                | #111 | Topology-aware crawler         |
| Living Truth Infrastructure      | #115 | Evidence immutability          |
| OCR Temporal Filtering           | #119 | Cycle detection                |
| Authority-First Design           | #117 | Full performance specification |

### 10.3 Known Technical Debt

- Bull Board disabled (no ARM64 support) - use `scripts/queue-status.ts`
- Some AI features depend on Ollama local deployment

---

## Changelog

| Date       | Change                                    | PR/Commit |
| ---------- | ----------------------------------------- | --------- |
| 2025-12-28 | Full chapter audit and update             | Audit     |
| 2025-12-27 | Authority-First Performance design merged | #117      |
| 2025-12-26 | Living Truth Infrastructure merged        | #115      |
| 2025-12-25 | OCR processing improvements merged        | #119      |
| 2025-12-24 | Adaptive Sentinel merged                  | #111      |
| 2025-12-22 | Regulatory Truth Layer audits             | #85-95    |
| 2025-12-21 | Design System Token Architecture          | #107      |
| 2025-12-20 | Branch protection policy                  | #109      |
