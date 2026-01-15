# Vision & Architecture

[← Back to Index](./00-INDEX.md)

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
>
> Comprehensive update: Infrastructure split documented, Docker build process clarified, module count corrected (17 not 18), DDD architecture detailed, tech stack versions added.

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
| **System Registry**        | Component criticality tracking with blast radius + CI enforcement      | Implemented | Governance of CRITICAL components (PR #138)               |

### 1.3 The Four Environments

| Environment        | URL                   | SystemRole | Purpose                           | Repository         | Status      |
| ------------------ | --------------------- | ---------- | --------------------------------- | ------------------ | ----------- |
| **Marketing Site** | `fiskai.hr`           | Public     | Landing, guides, news             | `fiskai-marketing` | Implemented |
| **Client App**     | `app.fiskai.hr`       | `USER`     | Business owner's cockpit          | `FiskAI`           | Implemented |
| **Staff Portal**   | `app.fiskai.hr/staff` | `STAFF`    | Accountant multi-client workspace | `FiskAI`           | Partial     |
| **Admin Portal**   | `app.fiskai.hr/admin` | `ADMIN`    | Platform management               | `FiskAI`           | Implemented |

> **Marketing Site:** Completely separate repository (`fiskai-marketing`). Static Next.js export served from CDN. Survives backend outages. No database, no auth, no server actions.
>
> **Staff Portal Note:** Basic dashboard and client list only. Multi-client workspace features pending.
> See [docs/02_FEATURES/features/staff-portal.md](../02_FEATURES/features/staff-portal.md) for detailed gap analysis.

---

## 2. Architecture Overview

### 2.1 Tech Stack

| Layer       | Technology            | Version       | Purpose                                | Status      |
| ----------- | --------------------- | ------------- | -------------------------------------- | ----------- |
| Runtime     | Node.js               | 22 (Alpine)   | JavaScript runtime environment         | Implemented |
| Framework   | Next.js App Router    | 15.5.0        | Server components, streaming, routing  | Implemented |
| UI Library  | React                 | 19.0.0        | Component-based UI                     | Implemented |
| Database    | PostgreSQL + Prisma   | 16 + 7.1.0    | Primary data persistence, multi-tenant | Implemented |
| Database    | Drizzle ORM           | 0.45.1        | Guidance, news, paušalni tables        | Implemented |
| Auth        | NextAuth v5 (Auth.js) | 5.0.0-beta.30 | Session management, OAuth, Passkeys    | Implemented |
| Styling     | Tailwind CSS + CVA    | 3.4.1         | Design system, component variants      | Implemented |
| Validation  | Zod                   | 4.1.13        | Schema validation everywhere           | Implemented |
| Email       | Resend                | 6.6.0         | Transactional email                    | Implemented |
| Storage     | Cloudflare R2         | -             | Encrypted document archive             | Implemented |
| Payments    | Stripe                | 20.0.0        | Subscriptions, Terminal                | Implemented |
| Banking     | Gocardless/SaltEdge   | -             | PSD2 bank connections                  | Implemented |
| Fiscal      | FINA CIS              | -             | Croatian fiscalization                 | Implemented |
| Queue       | Redis + BullMQ        | 7 + 5.66.2    | Worker job queues                      | Implemented |
| AI/LLM      | Ollama                | -             | Extraction, composition, review        | Implemented |
| Bot Defense | Cloudflare Turnstile  | -             | Auth form protection                   | Implemented |
| Monitoring  | Sentry                | 10.30.0       | Error tracking and performance         | Implemented |
| Analytics   | PostHog               | 1.304.0       | Product analytics and feature flags    | Implemented |

### 2.2 Directory Structure

```
/src
├── app/
│   ├── (app)/           # Client dashboard (app.fiskai.hr)
│   ├── (staff)/         # Staff portal (app.fiskai.hr/staff)
│   ├── (admin)/         # Admin portal (app.fiskai.hr/admin)
│   ├── (auth)/          # Authentication flows
│   ├── admin/           # Legacy admin routes
│   ├── staff/           # Legacy staff routes
│   └── api/             # API routes
├── components/
│   ├── ui/              # Design system primitives
│   ├── motion/          # Animation behaviors (Reveal, Stagger)
│   ├── patterns/        # Composed primitives (SectionHeading, FeatureCard)
│   ├── sections/        # Page sections (HeroSection, FeatureGrid)
│   ├── templates/       # Portal-scoped templates
│   ├── layout/          # Header, sidebar, navigation
│   ├── dashboard/       # Dashboard widgets
│   ├── onboarding/      # Wizard steps
│   └── [feature]/       # Feature-specific components
├── domain/              # Pure business logic (DDD - no external deps)
│   ├── shared/          # Value objects (Money, Quantity, VatRate)
│   ├── invoicing/       # Invoice aggregate, InvoiceLine entity
│   ├── tax/             # VatCalculator, VatBreakdown
│   ├── fiscalization/   # FiscalRequest, ZkiCalculator
│   ├── banking/         # BankTransaction, ReconciliationMatcher
│   ├── compliance/      # Deadline, ComplianceStatus
│   └── identity/        # Tenant, Permission
├── application/         # Use cases (imports domain only)
│   ├── invoicing/       # CreateInvoice, IssueInvoice
│   ├── fiscalization/   # SubmitFiscalRequest
│   ├── banking/         # Bank operations
│   ├── compliance/      # Compliance workflows
│   └── tax/             # Tax calculations
├── infrastructure/      # External services, DB, frameworks
│   ├── persistence/     # Prisma repositories
│   ├── fiscal/          # XML builders, signing, Porezna client
│   └── mappers/         # DB ↔ Domain conversion
├── interfaces/          # API routes, server actions
│   ├── api/             # REST endpoints
│   └── actions/         # Server actions
├── design-system/       # Token architecture (PR #107)
│   ├── tokens/          # Semantic tokens (surfaces, text, status)
│   ├── css/             # CSS variables
│   └── eslint/          # Enforcement rules
└── lib/
    ├── modules/         # Module definitions & gating
    ├── visibility/      # Progressive disclosure rules
    ├── regulatory-truth/ # Regulatory Truth Layer (PRs #85-95, #115)
    │   ├── agents/      # Sentinel, Extractor, Composer, etc.
    │   ├── workers/     # Queue-based worker services
    │   ├── dsl/         # AppliesWhen predicate DSL
    │   ├── graph/       # Cycle detection for rule dependencies
    │   └── taxonomy/    # Concept classification
    ├── assistant/       # AI Assistant query engine
    │   ├── query-engine/ # Text processing, rule selection
    │   └── reasoning/   # Answer composition
    ├── ai/              # Ollama client and AI utilities
    ├── rbac.ts          # Permission matrix
    ├── fiscal-data/     # Tax rates, thresholds, deadlines
    ├── pausalni/        # Paušalni obrt logic
    ├── e-invoice/       # UBL/XML generation
    ├── knowledge-hub/   # Content management
    ├── cache/           # Cloudflare cache purge utilities
    ├── turnstile.ts     # Bot protection verification
    ├── system-registry/ # Component criticality tracking
    └── db/
        ├── drizzle.ts   # Drizzle client
        └── schema/      # Drizzle table definitions

/content                 # MDX content (deprecated - moved to fiskai-marketing)
└── (legacy guides)      # Now maintained in separate marketing repo
```

### 2.3 DDD & Clean Architecture

FiskAI follows **Domain-Driven Design (DDD)** and **Clean Architecture** principles with strict layer boundaries:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (Next.js)                    │
│              src/app/**, src/components/**               │
└────────────────────────┬─────────────────────────────────┘
                         │ calls
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Interfaces Layer                        │
│         src/interfaces/api/**, actions/**                │
│              (API routes, Server Actions)                │
└────────────────────────┬─────────────────────────────────┘
                         │ orchestrates
                         ↓
┌─────────────────────────────────────────────────────────┐
│                Application Layer (Use Cases)             │
│              src/application/invoicing/**                │
│         CreateInvoice, IssueInvoice, etc.                │
│              (imports domain only)                       │
└────────────────────────┬─────────────────────────────────┘
                         │ uses
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Domain Layer (Business Logic)               │
│         src/domain/shared/**, invoicing/**, tax/**       │
│    Value Objects: Money, VatRate, Quantity               │
│    Entities: Invoice, InvoiceLine, FiscalRequest         │
│    Services: VatCalculator, ZkiCalculator                │
│              (NO external dependencies)                  │
└─────────────────────────────────────────────────────────┘
                         ↑
                         │ implements
┌─────────────────────────────────────────────────────────┐
│               Infrastructure Layer                       │
│         src/infrastructure/persistence/**                │
│         Prisma repositories, XML builders                │
│         External service clients (Porezna, Banks)        │
└─────────────────────────────────────────────────────────┘
```

**Architectural Rules (Enforced by ESLint + CI):**

1. **Domain** has NO external dependencies (no Prisma, no Next.js, no DB)
2. **Application** imports from domain only, injects repositories via interfaces
3. **Infrastructure** implements domain interfaces
4. **UI** calls interfaces only, never domain/application directly
5. **Money** is always a value object - use `Money.fromCents()`, never floats
6. **Validation** uses Zod at all boundaries (100% coverage)

> **Reference:** See [CLAUDE.md](../../CLAUDE.md) section "Code Architecture (DDD + Clean Architecture)"

### 2.4 Request Flow

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
Application Use Case (business logic)
    ↓
Domain Entities/Services (pure logic)
    ↓
Infrastructure Repository (Prisma)
    ↓
Prisma Extensions (AsyncLocalStorage tenant context)
    ↓
PostgreSQL
```

### 2.5 Component Architecture

FiskAI uses a **4-layer component system** with ESLint-enforced import boundaries:

```
ui/ + motion/  →  patterns/  →  sections/  →  templates/  →  pages
```

| Layer         | Path                        | Purpose                                  | Can Import From         |
| ------------- | --------------------------- | ---------------------------------------- | ----------------------- |
| **UI**        | `src/components/ui/`        | Design system primitives (Button, Card)  | Nothing                 |
| **Motion**    | `src/components/motion/`    | Animation behaviors (Reveal, Stagger)    | ui/                     |
| **Patterns**  | `src/components/patterns/`  | Composed primitives (SectionHeading)     | ui/, motion/            |
| **Sections**  | `src/components/sections/`  | Page sections (HeroSection, FeatureGrid) | ui/, motion/, patterns/ |
| **Templates** | `src/components/templates/` | Portal-scoped templates                  | All layers              |
| **Pages**     | `src/app/**/page.tsx`       | Route pages                              | All layers              |

**Rule:** Each layer can only import from layers to its left. ESLint blocks upward imports.

> **Reference:** See [docs/03_ARCHITECTURE/COMPONENT_LAYERS_MIGRATION.md](../03_ARCHITECTURE/COMPONENT_LAYERS_MIGRATION.md)

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

**Primary Workers (Regulatory Truth Layer):** Defined in `docker-compose.workers.yml`

| Worker                 | Purpose                                           | Concurrency | Memory | Special Features                                             |
| ---------------------- | ------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------ |
| **orchestrator**       | Pipeline coordination, job routing                | 1           | 512M   | State machine coordination                                   |
| **sentinel**           | Source discovery (Narodne novine, Porezna, FINA)  | 1           | 512M   | Adaptive, topology-aware (PR #111)                           |
| **ocr**                | PDF processing: Tesseract + Vision fallback       | 1           | 2G     | Temporal filtering, cycle detection (PR #119), Tesseract OCR |
| **extractor**          | LLM-based fact extraction with confidence scoring | 1           | 1G     | Uses Ollama extract endpoint                                 |
| **composer**           | Aggregates facts into regulatory rules            | 1           | 512M   | Rule synthesis with evidence links                           |
| **reviewer**           | Automated quality checks, ambiguity detection     | 1           | 512M   | Fail-closed design                                           |
| **arbiter**            | Conflict resolution between competing rules       | 1           | 512M   | LLM-assisted arbitration                                     |
| **releaser**           | Publication to production, versioning             | 1           | 512M   | Atomic rule publishing                                       |
| **scheduler**          | Cron-based job scheduling (daily sentinel runs)   | -           | 512M   | Europe/Zagreb timezone                                       |
| **continuous-drainer** | 24/7 queue processing, ensures no jobs stuck      | -           | 256M   | Watchdog pattern                                             |

**Supporting Workers:**

| Worker                 | Purpose                                       | Concurrency | Memory |
| ---------------------- | --------------------------------------------- | ----------- | ------ |
| **content-sync**       | GitHub content synchronization for MDX guides | 1           | 512M   |
| **article**            | Article generation and rewriting              | 1           | 1G     |
| **evidence-embedding** | Generate embeddings for evidence search       | 2           | 512M   |
| **embedding**          | Generate embeddings for general content       | 2           | 512M   |
| **einvoice-inbound**   | Poll e-Poslovanje API for incoming e-invoices | -           | 256M   |

**Total:** 15 worker containers + 1 Redis instance

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

> **Status:** ✅ Implemented
>
> **Reference:** See [src/lib/modules/definitions.ts](../../src/lib/modules/definitions.ts)

### 6.1 Module Registry

17 toggleable modules stored in `Company.entitlements[]`:

| Module             | Default | Description                                 | Status         |
| ------------------ | ------- | ------------------------------------------- | -------------- |
| `platform-core`    | On      | Core platform access (dashboards, settings) | ✅ Implemented |
| `invoicing`        | On      | Create and manage invoices                  | ✅ Implemented |
| `e-invoicing`      | On      | UBL/XML electronic invoices                 | ✅ Implemented |
| `fiscalization`    | Off     | Fiscal receipts, JIR/ZKI, CIS               | ✅ Implemented |
| `contacts`         | On      | Customer and supplier management            | ✅ Implemented |
| `products`         | On      | Product catalog and pricing                 | ✅ Implemented |
| `expenses`         | On      | Expense tracking and categories             | ✅ Implemented |
| `banking`          | Off     | Bank accounts, transactions, imports        | ✅ Implemented |
| `reconciliation`   | Off     | Auto-matching and statement reconciliation  | ✅ Implemented |
| `reports-basic`    | On      | Aging, KPR, profit/loss                     | ✅ Implemented |
| `reports-advanced` | Off     | VAT reports, exports, custom                | ⚠️ Partial     |
| `pausalni`         | Off     | Paušalni obrt tax management                | ✅ Implemented |
| `vat`              | Off     | VAT management and submissions              | ⚠️ Partial     |
| `corporate-tax`    | Off     | DOO/JDOO tax features                       | 📋 Planned     |
| `pos`              | Off     | Point of sale and Stripe Terminal           | ⚠️ Partial     |
| `documents`        | On      | Document storage and attachments            | ✅ Implemented |
| `ai-assistant`     | Off     | AI-powered help and document analysis       | ✅ Implemented |

### 6.2 Legal Form Auto-Assignment

Modules are auto-assigned based on business type selection:

| Legal Form  | Auto-Assigned Modules                                       |
| ----------- | ----------------------------------------------------------- |
| OBRT_PAUSAL | base + pausalni                                             |
| OBRT_REAL   | base + expenses                                             |
| OBRT_VAT    | base + vat, expenses                                        |
| JDOO        | base + vat, corporate-tax, reports-advanced                 |
| DOO         | base + vat, corporate-tax, reports-advanced, reconciliation |

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

### 9.1 Infrastructure Split

**Current Architecture:** FiskAI operates on a split infrastructure model:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudflare CDN                               │
│                  (DNS, SSL, DDoS Protection)                         │
└────────────┬──────────────────────────────┬─────────────────────────┘
             │                              │
             │                              │
   ┌─────────▼──────────┐        ┌─────────▼─────────────────┐
   │   Marketing Site   │        │      VPS-01 (ARM64)       │
   │  fiskai-marketing  │        │   152.53.146.3            │
   │                    │        │                           │
   │  Static HTML/CSS/JS│        │  ┌─────────────────────┐  │
   │  Next.js Export    │        │  │  Coolify (Docker)   │  │
   │  CDN-Served        │        │  │                     │  │
   │                    │        │  │  ┌───────────────┐  │  │
   │  100% Public Pages │        │  │  │  Next.js App  │  │  │
   │  - Landing         │        │  │  │  (app.fiskai) │  │  │
   │  - Guides          │        │  │  └───────────────┘  │  │
   │  - News            │        │  │                     │  │
   │  - Login Redirect  │        │  │  ┌───────────────┐  │  │
   └────────────────────┘        │  │  │  PostgreSQL   │  │  │
                                 │  │  │  (fiskai-db)  │  │  │
                                 │  │  └───────────────┘  │  │
                                 │  └─────────────────────┘  │
                                 └───────────────────────────┘
                                              │
                                              │ Database Connection
                                              │
                                 ┌────────────▼──────────────┐
                                 │   VPS (Worker Server)     │
                                 │   152.53.179.101          │
                                 │                           │
                                 │  ┌─────────────────────┐  │
                                 │  │  Redis 7 Alpine     │  │
                                 │  │  (BullMQ Queues)    │  │
                                 │  └─────────────────────┘  │
                                 │                           │
                                 │  ┌─────────────────────┐  │
                                 │  │  15 Worker Services │  │
                                 │  │                     │  │
                                 │  │  - Orchestrator     │  │
                                 │  │  - Sentinel         │  │
                                 │  │  - OCR (Tesseract)  │  │
                                 │  │  - Extractor (LLM)  │  │
                                 │  │  - Composer         │  │
                                 │  │  - Reviewer         │  │
                                 │  │  - Arbiter          │  │
                                 │  │  - Releaser         │  │
                                 │  │  - Scheduler        │  │
                                 │  │  - Cont. Drainer    │  │
                                 │  │  - Content Sync     │  │
                                 │  │  - Article          │  │
                                 │  │  - Evidence Embed   │  │
                                 │  │  - Embedding        │  │
                                 │  │  - E-Invoice In     │  │
                                 │  └─────────────────────┘  │
                                 └───────────────────────────┘
```

| Environment   | Location                                 | Purpose                                    | Status     |
| ------------- | ---------------------------------------- | ------------------------------------------ | ---------- |
| **VPS-01**    | Hetzner ARM64 (152.53.146.3)             | Application server only                    | Production |
| **VPS**       | Hetzner x86_64 (152.53.179.101)          | Workers and Redis                          | Production |
| **Marketing** | Separate repository (`fiskai-marketing`) | Static marketing site (100% static export) | Production |

**Key Changes:**

1. **Marketing Split** - Marketing pages moved to separate static repository
   - Repository: `fiskai-marketing` (Next.js static export)
   - Deployment: CDN-served static HTML
   - Survives backend outages
   - WordPress integration with JSON fallback

2. **VPS-01 Focus** - Now dedicated to application only
   - Next.js application (app.fiskai.hr)
   - PostgreSQL database
   - Coolify orchestration

3. **Workers Consolidation** - Workers and Redis on same device
   - VPS (152.53.179.101)
   - 15 worker containers + Redis
   - Separate images: `fiskai-worker` and `fiskai-worker-ocr`

### 9.2 Deployment Architecture

| Component  | Location              | Notes                                 |
| ---------- | --------------------- | ------------------------------------- |
| App Server | VPS-01 (152.53.146.3) | Coolify-managed Next.js               |
| Database   | VPS-01 (Docker)       | PostgreSQL 16, container: `fiskai-db` |
| Workers    | VPS (Docker)          | 15 worker containers                  |
| Redis      | VPS (Docker)          | Redis 7 Alpine, BullMQ queues         |
| CDN        | Cloudflare            | SSL, caching, DDoS                    |
| DNS        | Cloudflare            | Primary: fiskai.hr                    |

### 9.3 Docker Build Process

**Three Separate Images:**

1. **App Image** (`Dockerfile`)
   - Base: `node:22-alpine`
   - Multi-stage build with BuildKit cache mounts
   - Prisma client generation (core + regulatory)
   - Next.js standalone output
   - Health check: `/api/health`

2. **Worker Image** (`Dockerfile.worker`)
   - Base: `node:20-alpine`
   - Compiled TypeScript workers (dist/)
   - Used by: all workers except OCR
   - Registry: `ghcr.io/wandeon/fiskai-worker`

3. **Worker OCR Image** (`Dockerfile.worker` with `WITH_OCR=true`)
   - Base: `node:20-alpine`
   - Additional packages: Tesseract, poppler-utils, ghostscript
   - Language data: Croatian (hrv) + English (eng)
   - Registry: `ghcr.io/wandeon/fiskai-worker-ocr`

**Build Args:**

- `GIT_SHA` - Commit hash for version tracking
- `BUILD_DATE` - Build timestamp
- `WITH_OCR` - Enable OCR dependencies (worker-ocr only)

### 9.4 Docker Compose Files

| File                             | Purpose                      |
| -------------------------------- | ---------------------------- |
| `docker-compose.yml`             | Base database configuration  |
| `docker-compose.dev.yml`         | Development overrides        |
| `docker-compose.prod.yml`        | Production configuration     |
| `docker-compose.workers.yml`     | 15 worker services + Redis   |
| `docker-compose.workers.dev.yml` | Development worker overrides |

### 9.5 Worker Services

**15 Worker Containers** (all use pre-built GHCR images):

| Worker             | Container Name                     | Image Type | Concurrency | Memory |
| ------------------ | ---------------------------------- | ---------- | ----------- | ------ |
| Orchestrator       | `fiskai-worker-orchestrator`       | worker     | 1           | 512M   |
| Sentinel           | `fiskai-worker-sentinel`           | worker     | 1           | 512M   |
| OCR                | `fiskai-worker-ocr`                | worker-ocr | 1           | 2G     |
| Extractor          | `fiskai-worker-extractor`          | worker     | 1           | 1G     |
| Composer           | `fiskai-worker-composer`           | worker     | 1           | 512M   |
| Reviewer           | `fiskai-worker-reviewer`           | worker     | 1           | 512M   |
| Arbiter            | `fiskai-worker-arbiter`            | worker     | 1           | 512M   |
| Releaser           | `fiskai-worker-releaser`           | worker     | 1           | 512M   |
| Scheduler          | `fiskai-worker-scheduler`          | worker     | -           | 512M   |
| Continuous Drainer | `fiskai-worker-continuous-drainer` | worker     | -           | 256M   |
| Content Sync       | `fiskai-worker-content-sync`       | worker     | 1           | 512M   |
| Article            | `fiskai-worker-article`            | worker     | 1           | 1G     |
| Evidence Embedding | `fiskai-worker-evidence-embedding` | worker     | 2           | 512M   |
| Embedding          | `fiskai-worker-embedding`          | worker     | 2           | 512M   |
| E-Invoice Inbound  | `fiskai-worker-einvoice-inbound`   | worker     | -           | 256M   |

**Redis Configuration:**

- Image: `redis:7-alpine`
- Persistence: Append-only file (AOF)
- Memory: 2GB max with `noeviction` policy
- Networks: `default` + `coolify`

### 9.6 Branch Protection

**CRITICAL:** All changes MUST go through Pull Requests. Direct pushes to `main` are blocked by pre-push hook (PR #109).

---

## 10. Gaps & Future Work

### 10.1 Features Not Yet Implemented

| Feature                      | Status     | Notes                           |
| ---------------------------- | ---------- | ------------------------------- |
| Authority-First Phase B-D    | 📋 Planned | Answer blocks, CWV optimization |
| PWA Manifest                 | 📋 Planned | Phase D of Authority-First      |
| Speculation Rules            | 📋 Planned | Prefetch for navigation         |
| IE-Racuni Integration        | 📋 Planned | Stub exists, not connected      |
| Corporate Tax Module         | 📋 Planned | DOO/JDOO specific tax features  |
| Multi-client Staff Workspace | 📋 Planned | Staff portal basic only         |

### 10.2 Partially Implemented

| Feature          | Status     | Notes                                |
| ---------------- | ---------- | ------------------------------------ |
| VAT Module       | ⚠️ Partial | Basic reporting, submissions pending |
| Reports-Advanced | ⚠️ Partial | VAT threshold, export partial        |
| POS Module       | ⚠️ Partial | Stripe Terminal integration pending  |

### 10.3 Known Technical Debt

- Bull Board disabled (no ARM64 support) - use `scripts/queue-status.ts`
- Some AI features depend on Ollama local deployment
- 2 soft-delete models only (SourcePointer, FeatureFlag) - no cascade soft-delete

---

## Changelog

| Date       | Change                                                                                                                                | PR/Commit |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 2026-01-14 | Comprehensive update: Infrastructure split, Docker builds, module count correction (17 not 18), DDD architecture, tech stack versions | v6.0.0    |
| 2026-01-05 | Reality audit: status labels                                                                                                          | v5.0.0    |
| 2025-12-29 | Added System Registry, RTL Content Sync                                                                                               | #138-#142 |
| 2025-12-28 | Staff Portal status corrected to Partial                                                                                              | Audit     |
| 2025-12-28 | Full chapter audit and update                                                                                                         | Audit     |
| 2025-12-27 | Authority-First Performance design merged                                                                                             | #117      |
| 2025-12-26 | Living Truth Infrastructure merged                                                                                                    | #115      |
| 2025-12-25 | OCR processing improvements merged                                                                                                    | #119      |
| 2025-12-24 | Adaptive Sentinel merged                                                                                                              | #111      |
| 2025-12-22 | Regulatory Truth Layer audits                                                                                                         | #85-95    |
| 2025-12-21 | Design System Token Architecture                                                                                                      | #107      |
| 2025-12-20 | Branch protection policy                                                                                                              | #109      |
