# FiskAI Roadmap

> **Active Phase:** Recovery & Stabilization
> **CI Status:** 2 issues (fiscal-validator missing run.ts, OOM on lint/typecheck)
> **Test Status:** 1,457/1,458 passing
> **Deployment:** Production healthy at app.fiskai.hr

See [CHANGELOG.md](./CHANGELOG.md) for detailed changes.

---

## Architecture

FiskAI was split from a monorepo into 3 independent repositories:

| Repository                 | Purpose                    | URL            |
| -------------------------- | -------------------------- | -------------- |
| **FiskAI-App** (this repo) | Next.js application        | app.fiskai.hr  |
| **fiskai-intelligence**    | Intelligence API + workers | iapi.fiskai.hr |
| **fiskai-marketing**       | Marketing site             | fiskai.hr      |

---

## Phase 0: Recovery & Stabilization

### Governance Foundation

- [ ] Create ROADMAP.md (this file)
- [ ] Create CHANGELOG.md
- [ ] Create DECISIONS.md (architecture decision records)
- [ ] Create AGENTS.md (AI agent guidelines)

### CI Green

- [ ] Fix OOM on lint/typecheck (increase Node memory or optimize)
- [ ] Fix fiscal-validator missing `run.ts` entry point
- [ ] Fix ActionButton test (1 failing test)

### Sync Repositories

- [ ] Verify fiskai-intelligence deployment at iapi.fiskai.hr
- [ ] Verify fiskai-marketing deployment at fiskai.hr
- [ ] Document inter-repo communication patterns
- [ ] Set up shared type definitions

---

## Phase 1: Module Verification

### Core Modules

| Module        | Description                         | Status  |
| ------------- | ----------------------------------- | ------- |
| platform-core | Authentication, tenants, settings   | Pending |
| invoicing     | Invoice creation and management     | Pending |
| e-invoicing   | Electronic invoicing (UBL/XML)      | Pending |
| contacts      | Customer and supplier management    | Pending |
| products      | Product and service catalog         | Pending |
| expenses      | Expense tracking and categorization | Pending |
| documents     | Document storage and OCR            | Pending |
| reports-basic | Basic financial reports             | Pending |

### Optional Modules

| Module           | Description                       | Status  |
| ---------------- | --------------------------------- | ------- |
| fiscalization    | Croatian fiscal law compliance    | Pending |
| banking          | Bank account integration          | Pending |
| reconciliation   | Transaction matching              | Pending |
| reports-advanced | Advanced analytics and reporting  | Pending |
| pausalni         | Lump-sum taxation (paušalni obrt) | Pending |
| vat              | VAT calculation and reporting     | Pending |
| corporate-tax    | Corporate tax management          | Pending |
| pos              | Point of sale integration         | Pending |
| ai-assistant     | AI-powered accounting assistant   | Pending |

---

## Phase 2: Feature Development

_Placeholder for future feature development after recovery is complete._

- [ ] Define Q1 feature priorities
- [ ] Establish module ownership
- [ ] Create feature request process

---

## Quick Reference

### Common Commands

```bash
# Run tests
pnpm test

# Build application
pnpm build

# Run linter
pnpm lint

# Type checking
pnpm typecheck

# Run all checks
pnpm test && pnpm lint && pnpm typecheck
```

### CI Troubleshooting

```bash
# Fix OOM issues by increasing Node memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm lint
NODE_OPTIONS="--max-old-space-size=4096" pnpm typecheck
```

---

_Last updated: 2026-02-01_
