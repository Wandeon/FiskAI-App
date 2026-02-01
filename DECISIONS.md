# DECISIONS.md - Architectural Decision Records

> **Master Index**: This document serves as the central registry for all architectural decisions, technical choices, and design rationale for the FiskAI project. All significant decisions should be documented here or linked from this index.

---

## Quick Links

| Document           | Contents                        |
| ------------------ | ------------------------------- |
| CLAUDE.md          | AI assistant instructions       |
| AGENTS.md          | Agent definitions and workflows |
| ROADMAP.md         | Development roadmap             |
| CHANGELOG.md       | Version history                 |
| docs/STATUS.md     | Module implementation status    |
| docs/DEPLOYMENT.md | Deployment procedures           |

---

## Project Overview

| Attribute        | Value                                        |
| ---------------- | -------------------------------------------- |
| **Product**      | FiskAI - Croatian accounting/ERP SaaS        |
| **Domain**       | fiskai.hr (app.fiskai.hr for application)    |
| **Stack**        | Next.js 15, Prisma 7, PostgreSQL, TypeScript |
| **Architecture** | 3-repository split                           |

---

## Key Architecture Decisions

### ADR-001: 3-Repository Architecture

|            |            |
| ---------- | ---------- |
| **Date**   | 2026-01-22 |
| **Status** | Accepted   |

**Context**
The original monorepo architecture became unwieldy as the project grew. Different components had different deployment cadences and the codebase became difficult to navigate.

**Decision**
Split the codebase into three separate repositories:

- **FiskAI-App** - Main application (Next.js frontend + API)
- **fiskai-intelligence** - AI/ML services and regulatory processing
- **fiskai-marketing** - Marketing website and landing pages

**Consequences**

- Cleaner separation of concerns
- Independent deployment cycles for each repository
- HTTPS API calls required between repositories
- Need for clear API contracts between services

---

### ADR-002: Module System

|            |            |
| ---------- | ---------- |
| **Date**   | 2026-01-22 |
| **Status** | Accepted   |

**Context**
Different customers require different feature sets. A modular approach allows flexible pricing and feature gating.

**Decision**
Implement 17 toggleable modules controlled via `Company.entitlements[]` array:

- **8 default modules** - Included in base subscription
- **9 optional modules** - Available as add-ons

**Consequences**

- Flexible feature gating per company
- Module status checked at runtime
- Clear upgrade paths for customers

---

### ADR-003: Domain-Driven Design

|            |            |
| ---------- | ---------- |
| **Date**   | 2026-01-22 |
| **Status** | Accepted   |

**Context**
Accounting and ERP systems have complex business logic that needs clear organization and testability.

**Decision**
Adopt Domain-Driven Design with the following structure:

```
src/
├── domain/          # Pure business logic (entities, value objects)
├── application/     # Use cases and application services
├── infrastructure/  # External services (database, APIs, email)
└── interfaces/      # API routes and controllers
```

**Consequences**

- Business logic isolated and testable
- Clear dependency direction (inward)
- Infrastructure can be swapped without affecting domain

---

### ADR-004: Regulatory Truth Layer

|            |            |
| ---------- | ---------- |
| **Date**   | 2026-01-22 |
| **Status** | Accepted   |

**Context**
Croatian tax and accounting regulations change frequently. The system needs to stay current with regulatory requirements automatically.

**Decision**
Implement a two-layer execution model:

- **Layer A (Discovery)** - Daily scanning for regulatory changes from official sources
- **Layer B (Processing)** - 24/7 processing and application of regulatory updates

**Location**: This functionality now lives in the `fiskai-intelligence` repository.

**Consequences**

- Automated compliance updates
- Reduced manual monitoring burden
- Clear audit trail of regulatory changes

---

## Infrastructure Decisions

| Decision           | Choice                     | Rationale                                              |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| **Hosting**        | Vercel                     | Optimal for Next.js, edge functions, automatic scaling |
| **Database**       | PostgreSQL (Neon/Supabase) | ACID compliance, JSON support, mature ecosystem        |
| **ORM**            | Prisma 7                   | Type safety, migrations, excellent DX                  |
| **Authentication** | NextAuth.js                | Native Next.js integration, multiple providers         |
| **File Storage**   | S3-compatible              | Document storage for invoices, reports                 |
| **Deployment**     | Git-based CI/CD            | Automatic deploys on push to main                      |
| **Monitoring**     | Vercel Analytics + Sentry  | Performance and error tracking                         |

---

## Code Style Decisions

### TypeScript

| Rule                      | Setting                       |
| ------------------------- | ----------------------------- |
| **Strict Mode**           | Enabled (`"strict": true`)    |
| **No Any**                | Enforced via ESLint           |
| **Explicit Return Types** | Required for public functions |
| **Null Checks**           | Strict null checks enabled    |

### Testing

| Type                  | Tool                     | Coverage Target      |
| --------------------- | ------------------------ | -------------------- |
| **Unit Tests**        | Vitest                   | 80% for domain layer |
| **Integration Tests** | Vitest + Testing Library | Critical paths       |
| **E2E Tests**         | Playwright               | Happy paths          |

### Git Workflow

| Aspect              | Convention                                   |
| ------------------- | -------------------------------------------- |
| **Branch Naming**   | `feature/`, `fix/`, `docs/`, `refactor/`     |
| **Commit Messages** | Conventional Commits (feat, fix, docs, etc.) |
| **PRs**             | Required for main branch                     |
| **Reviews**         | At least 1 approval required                 |

---

## Discussion Log

### 2026-02-01: Recovery Initiative

**Context**
Project documentation and structure needed consolidation after rapid development phase.

**Actions Taken**

- Created master documentation index (this file)
- Established ADR format for future decisions
- Linked all key documentation files
- Documented existing architectural decisions retroactively

**Participants**

- Development Team
- AI Assistant (Claude)

**Next Steps**

- Continue documenting decisions as they are made
- Review and update ADRs quarterly
- Ensure all team members reference this index

---

## Adding New Decisions

When adding a new architectural decision:

1. Assign the next ADR number (ADR-XXX)
2. Include: Date, Status, Context, Decision, Consequences
3. Update the Discussion Log with the rationale
4. Commit with message: `docs: add ADR-XXX for [topic]`

**Status Options**: Proposed | Accepted | Deprecated | Superseded

---

_Last Updated: 2026-02-01_
