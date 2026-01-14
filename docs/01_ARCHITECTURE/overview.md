# FiskAI System Architecture

> Canonical document - reviewed 2024-12-24

## Overview

FiskAI is a Croatian AI-first accounting and invoicing SaaS platform. The system processes regulatory content through a two-layer execution model and presents it to users through a multi-tenant web application.

## Tech Stack

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Frontend   | Next.js 15 App Router, React, TypeScript |
| Styling    | Tailwind CSS + CVA design system         |
| Database   | PostgreSQL 16 via Prisma 7               |
| Auth       | NextAuth v5 (Auth.js)                    |
| Queue      | BullMQ + Redis                           |
| AI/LLM     | Ollama (local), OpenRouter (fallback)    |
| Email      | Resend                                   |
| Deployment | Coolify on Hetzner ARM64 VPS             |
| CDN        | Cloudflare                               |

## Domain Architecture

| Portal       | URL                   | Audience       | Purpose                 |
| ------------ | --------------------- | -------------- | ----------------------- |
| Marketing    | `fiskai.hr`           | Public         | Landing, guides, auth   |
| Client App   | `app.fiskai.hr`       | Clients        | Business dashboard      |
| Staff Portal | `app.fiskai.hr/staff` | Accountants    | Multi-client workspace  |
| Admin Portal | `app.fiskai.hr/admin` | Platform owner | Tenant/staff management |

## Multi-Tenancy

Single database with company-level isolation:

- All data models include `companyId` foreign key
- Prisma extensions enforce tenant boundaries
- `SystemRole` enum: `USER` | `STAFF` | `ADMIN`

## Two-Layer Execution Model

See [two-layer-model.md](./two-layer-model.md) for details.

### Layer A: Daily Discovery (Scheduled)

- Runs on cron schedule
- Scans regulatory endpoints for new content
- Creates evidence records from source documents
- Idempotent and catchup-capable

### Layer B: 24/7 Processing (Continuous)

- Queue-based workers run continuously
- Processes: OCR → Extraction → Composition → Review → Release
- Never hallucinates (evidence-backed)
- Fail-closed with human escalation

## Module System

16 toggleable modules in `Company.entitlements[]`:

- invoicing, e-invoicing, fiscalization, contacts, products, expenses
- banking, reconciliation, reports-basic, reports-advanced
- pausalni, vat, corporate-tax, pos, documents, ai-assistant

## Key Directories

```
/src/app/
  ├── (marketing)/     # Public pages, auth
  ├── (app)/           # Client dashboard
  ├── (staff)/         # Staff portal
  └── (admin)/         # Admin portal

/src/lib/
  ├── modules/         # Module definitions & access control
  ├── middleware/      # Subdomain routing
  └── regulatory-truth/ # Regulatory processing pipeline

/content/
  ├── vodici/          # MDX guides
  └── usporedbe/       # MDX comparisons

/docs/                 # Documentation (this)
```

## Related Documentation

- [Two-Layer Model](./two-layer-model.md)
- [Trust Guarantees](./trust-guarantees.md)
- [Regulatory Truth Layer](../05_REGULATORY/OVERVIEW.md)
- [Operations Runbook](../04_OPERATIONS/OPERATIONS_RUNBOOK.md)
