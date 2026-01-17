# FiskAI Monorepo Split Design

> Created: 2026-01-17
> Status: Draft
> Author: AI-assisted planning

## Overview

Split the FiskAI monorepo into two separate repositories:

- **fiskai-app**: Next.js application, einvoice polling, AI assistant
- **fiskai-workers**: RTL knowledge base system (regulatory truth layer workers)

## Rationale

1. **Independent deployment cycles** - Workers evolve separately from the app
2. **Architecture alignment** - Workers run on x86_64 VPS, app on ARM64 VPS-01
3. **Build isolation** - Workers built locally on VPS, app built by Coolify
4. **Team boundaries** - Clear ownership separation
5. **Reduced CI time** - Smaller repos = faster builds

---

## Repository Structure

### fiskai-app (App Repository)

```
fiskai-app/
├── src/
│   ├── app/                    # Next.js pages & routes
│   ├── components/             # React components
│   ├── domain/                 # Business logic (DDD)
│   ├── application/            # Use cases
│   ├── infrastructure/         # External services
│   ├── interfaces/             # API routes & actions
│   └── lib/
│       ├── auth/               # Authentication
│       ├── assistant/          # AI assistant
│       ├── invoicing/          # Invoice management
│       ├── banking/            # Bank reconciliation
│       ├── fiscal/             # Fiscal submission
│       ├── fiscalization/      # Fiscalization logic
│       ├── compliance/         # Compliance deadlines
│       ├── e-invoice/
│       │   └── providers/      # E-invoice providers (outbound)
│       ├── knowledge-hub/      # Knowledge hub UI
│       ├── email/              # Email templates
│       ├── admin/              # Admin utilities
│       ├── tenancy/            # Multi-tenancy
│       ├── modules/            # Module system
│       ├── validations/        # Zod schemas (app)
│       ├── types/              # TypeScript types (app)
│       ├── config/             # Configuration
│       ├── db/                 # Database client (core only)
│       ├── news/               # News display (reads from RTL)
│       └── [other app libs]
├── prisma/
│   └── schema.prisma           # Core database schema
├── scripts/
│   ├── deploy-to-vps01.sh
│   ├── backup-database.sh
│   └── [app scripts]
├── Dockerfile                  # Next.js app image
├── docker-compose.yml
├── tsconfig.json
├── next.config.ts
└── package.json
```

### fiskai-workers (Workers Repository)

```
fiskai-workers/
├── src/
│   ├── lib/
│   │   ├── regulatory-truth/   # Complete RTL system
│   │   │   ├── workers/        # 15 worker implementations
│   │   │   ├── agents/         # LLM agents
│   │   │   ├── pipeline/       # Orchestration
│   │   │   ├── services/       # Core services
│   │   │   ├── schemas/        # Zod validation
│   │   │   ├── dsl/            # Rule evaluation DSL
│   │   │   ├── parsers/        # Document parsers
│   │   │   ├── fetchers/       # Source fetchers
│   │   │   ├── quality/        # Quality gates
│   │   │   ├── utils/          # RTL utilities
│   │   │   └── [other RTL dirs]
│   │   ├── e-invoice/
│   │   │   └── workers/        # einvoice-inbound-poller
│   │   ├── ai/                 # Ollama client
│   │   ├── db/                 # Database clients (both)
│   │   ├── logging/            # Pino logger
│   │   └── cache/              # Redis client
│   └── generated/
│       └── regulatory-client/  # Prisma regulatory client
├── prisma/
│   └── regulatory.prisma       # Regulatory database schema
├── scripts/
│   ├── build-workers.sh
│   ├── deploy-workers.sh
│   ├── queue-status.ts
│   ├── trigger-pipeline.ts
│   └── [worker scripts]
├── Dockerfile.worker           # Worker image
├── docker-compose.workers.yml
├── tsconfig.workers.json
└── package.json
```

---

## Database Strategy

### Schemas

| Schema          | Repository     | Connection                |
| --------------- | -------------- | ------------------------- |
| `public` (core) | fiskai-app     | `DATABASE_URL`            |
| `regulatory`    | fiskai-workers | `REGULATORY_DATABASE_URL` |

### Access Patterns

**App repo needs:**

- Full access to `public` schema (read/write)
- Read-only access to `regulatory` schema (for rule queries)

**Workers repo needs:**

- Read-only access to `public` schema (company context, tenancy)
- Full access to `regulatory` schema (read/write)

### Prisma Configuration

**fiskai-app:**

```typescript
// prisma/schema.prisma - Core schema only
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
// All app models (User, Company, Invoice, etc.)
```

**fiskai-workers:**

```typescript
// prisma/regulatory.prisma - Regulatory schema
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/regulatory-client"
}

datasource db {
  provider = "postgresql"
  url      = env("REGULATORY_DATABASE_URL")
  schemas  = ["regulatory"]
}
// All RTL models (Evidence, RegulatoryRule, etc.)
```

---

## Communication Between Repos

### Queue Communication (BullMQ)

Both repos connect to the same Redis instance:

- Queue prefix: `fiskai:`
- App can enqueue jobs for workers (optional)
- Workers process all queues

```
┌─────────────┐    Redis    ┌──────────────┐
│  fiskai-app │ ──────────▶ │fiskai-workers│
│  (optional) │  BullMQ     │  (processes) │
└─────────────┘             └──────────────┘
```

### API Communication

For app to query regulatory data:

**Option A: Direct database read (current)**

- App has read-only access to regulatory schema
- Simpler, lower latency
- Requires shared Prisma types

**Option B: HTTP API (future)**

- Workers expose `/api/rules/*` endpoints
- Better isolation
- Higher latency

**Recommendation:** Start with Option A, migrate to B if needed.

---

## Shared Code Strategy

### Approach: Copy, Don't Share

Instead of a shared package, copy necessary code:

| Code           | App Repo       | Workers Repo      |
| -------------- | -------------- | ----------------- |
| DB client init | ✅ (core only) | ✅ (both clients) |
| Pino logger    | ✅ Copy        | ✅ Copy           |
| Zod schemas    | App-specific   | RTL-specific      |
| Types          | App-specific   | RTL-specific      |

### Why Copy Over Share?

1. **Simplicity** - No package publishing/versioning
2. **Independence** - Each repo evolves freely
3. **Build speed** - No cross-repo dependencies
4. **Clarity** - Each repo has what it needs

### Shared Types (Minimal)

Only queue job payloads need to match:

```typescript
// Both repos define compatible job types
interface ExtractorJobPayload {
  evidenceId: string
  priority?: number
}
```

---

## Build & Deployment

### fiskai-app

| Aspect         | Configuration                |
| -------------- | ---------------------------- |
| Build          | Coolify on VPS-01            |
| Image          | `ghcr.io/wandeon/fiskai-app` |
| Architecture   | ARM64                        |
| Deploy trigger | Push to main                 |

### fiskai-workers

| Aspect         | Configuration                         |
| -------------- | ------------------------------------- |
| Build          | Local on VPS (x86_64)                 |
| Image          | `ghcr.io/wandeon/fiskai-worker[-ocr]` |
| Architecture   | AMD64                                 |
| Deploy trigger | Manual or CI webhook                  |

### CI/CD Split

**fiskai-app (.github/workflows/):**

- `ci.yml` - Tests, lint, type-check
- `build-and-deploy.yml` - Coolify deployment

**fiskai-workers (.github/workflows/):**

- `ci.yml` - Tests, lint, type-check
- `notify-vps.yml` - Webhook to trigger local build

---

## Environment Variables

### fiskai-app

```env
# Core
DATABASE_URL=postgresql://...
REGULATORY_DATABASE_URL=postgresql://... (read-only)
NEXTAUTH_URL=https://fiskai.hr
NEXTAUTH_SECRET=...

# Integrations
RESEND_API_KEY=...
STRIPE_API_KEY=...
GOCARDLESS_SECRET_ID=...

# App-specific
NEXT_PUBLIC_APP_URL=https://fiskai.hr
```

### fiskai-workers

```env
# Databases
DATABASE_URL=postgresql://... (read-only for core)
REGULATORY_DATABASE_URL=postgresql://... (full access)

# Queue
REDIS_URL=redis://fiskai-redis:6379
BULLMQ_PREFIX=fiskai

# LLM
OLLAMA_EXTRACT_ENDPOINT=...
OLLAMA_EXTRACT_MODEL=gemma-3-27b
OLLAMA_EMBED_ENDPOINT=...
OLLAMA_EMBED_MODEL=nomic-embed-text

# Workers
WORKER_CONCURRENCY=2
WATCHDOG_ENABLED=true
GITHUB_TOKEN=... (content sync)
```

---

## Migration Plan

### Phase 1: Prepare (Day 1)

1. Create `fiskai-workers` repository
2. Set up basic structure (package.json, tsconfig.workers.json)
3. Copy shared utilities (db client, logger, cache)

### Phase 2: Move Workers (Day 2-3)

1. Copy entire `src/lib/regulatory-truth/` directory
2. Copy `src/lib/e-invoice/workers/` (inbound poller only)
3. Copy `src/lib/ai/ollama-client.ts`
4. Copy `prisma/regulatory.prisma`
5. Copy worker Docker files and compose
6. Copy worker scripts

### Phase 3: Clean App Repo (Day 4)

1. Remove RTL code from app repo
2. Remove worker-specific dependencies
3. Update imports for regulatory read-only access
4. Remove worker Docker files

### Phase 4: Verify (Day 5)

1. Test app deployment independently
2. Test worker deployment independently
3. Verify queue communication
4. Verify database access patterns

### Phase 5: Documentation (Day 6)

1. Update CLAUDE.md in both repos
2. Update deployment runbooks
3. Document cross-repo dependencies

---

## Risk Mitigation

### Risk: Breaking changes during migration

**Mitigation:**

- Keep both versions running during transition
- Feature flag for regulatory queries
- Rollback plan: revert to monorepo

### Risk: Database access complexity

**Mitigation:**

- Use connection pooling (PgBouncer)
- Separate read-only credentials for cross-schema access
- Monitor query patterns

### Risk: Queue compatibility

**Mitigation:**

- Version job payloads
- Backwards-compatible job processing
- Queue draining before migration

---

## Success Criteria

1. **Independence** - Either repo can be deployed without the other
2. **Performance** - No regression in API response times
3. **Reliability** - Workers process jobs without errors
4. **Clarity** - Clear ownership and documentation
5. **Build time** - Both repos build faster than monorepo

---

## Files to Move Summary

### To fiskai-workers (MOVE)

```
src/lib/regulatory-truth/           # Entire directory
src/lib/e-invoice/workers/          # Inbound poller only
src/lib/ai/ollama-client.ts         # LLM client
src/lib/db/regulatory.ts            # Regulatory DB client
src/generated/regulatory-client/    # Generated Prisma client
prisma/regulatory.prisma            # Regulatory schema
prisma.config.regulatory.ts         # Prisma config
Dockerfile.worker                   # Worker image
docker-compose.workers*.yml         # Worker compose files
tsconfig.workers.json               # Worker TS config
scripts/build-workers.sh
scripts/deploy-workers.sh
scripts/queue-status.ts
scripts/trigger-pipeline.ts
scripts/backfill-*.ts               # RTL backfill scripts
scripts/check-regulatory-*.ts       # RTL check scripts
docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
docs/operations/WORKER_BUILD_AUTHORITY.md
```

### Stays in fiskai-app (KEEP)

```
src/app/                            # All Next.js
src/components/                     # All React components
src/domain/                         # Business logic
src/application/                    # Use cases
src/infrastructure/                 # External services
src/lib/assistant/                  # AI assistant
src/lib/invoicing/                  # Invoicing
src/lib/banking/                    # Banking
src/lib/e-invoice/providers/        # E-invoice outbound
src/lib/knowledge-hub/              # Knowledge hub UI
[all other app libs]
prisma/schema.prisma                # Core schema
Dockerfile                          # App image
docker-compose.yml                  # App compose
next.config.ts
tsconfig.json
```

---

## Appendix: Package.json Split

### fiskai-app package.json (trimmed)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "@prisma/client": "^7.x",
    "next-auth": "5.x",
    "@tanstack/react-query": "^5.x"
    // No bullmq, no ollama deps
  }
}
```

### fiskai-workers package.json (trimmed)

```json
{
  "scripts": {
    "worker:sentinel": "tsx src/lib/regulatory-truth/workers/sentinel.worker.ts",
    "worker:extractor": "tsx src/lib/regulatory-truth/workers/extractor.worker.ts",
    "build:workers": "tsc -p tsconfig.workers.json",
    "workers:start": "docker compose -f docker-compose.workers.yml up -d"
  },
  "dependencies": {
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "@prisma/client": "^7.x",
    "pino": "^9.x",
    "zod": "^3.x"
    // No next, no react, no tailwind
  }
}
```
