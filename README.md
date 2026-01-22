# FiskAI-App

Croatian AI-first accounting and invoicing SaaS platform - Application Repository.

## Overview

FiskAI-App is the web application for the FiskAI platform. It provides a cloud-based, modular accounting solution designed for Croatian companies, from paušalni obrt to d.o.o.

### Platform Architecture

| Repository            | Purpose                                        | URL            |
| --------------------- | ---------------------------------------------- | -------------- |
| **FiskAI-App** (this) | Accounting web application                     | app.fiskai.hr  |
| fiskai-intelligence   | Intelligence API + RTL workers + regulatory DB | iapi.fiskai.hr |
| fiskai-marketing      | Marketing landing pages                        | fiskai.hr      |

### Key Capabilities

- **E-Invoicing & Fiscalization** - Fiskalizacija 2.0, e-Račun, UBL/EN 16931 compliance
- **Regulatory Compliance** - Rule resolution via Intelligence API (external service)
- **Multi-Tenant Architecture** - Single database with company-level isolation
- **AI-Powered Automation** - OCR, categorization, anomaly detection

### Architectural Boundaries

This repository contains **only the accounting/ERP application**:

- ✅ Web UI (Client, Staff, Admin portals)
- ✅ API routes and server actions
- ✅ Core database schema
- ✅ Intelligence API client (HTTP calls only)

Regulatory processing is **external**:

- ❌ No NN Mirror parsing (→ fiskai-intelligence)
- ❌ No regulatory truth layer (→ fiskai-intelligence)
- ❌ No background workers (→ fiskai-intelligence)
- ❌ No regulatory database schema (→ fiskai-intelligence)

## Quick Links

| Resource                                         | Purpose                        |
| ------------------------------------------------ | ------------------------------ |
| [CLAUDE.md](./CLAUDE.md)                         | AI context and quick reference |
| [docs/](./docs/)                                 | Full documentation             |
| [docs/PRODUCT_BIBLE.md](./docs/PRODUCT_BIBLE.md) | Product specifications         |

## Documentation

### Architecture

- [System Overview](docs/01_ARCHITECTURE/overview.md) - High-level architecture
- [Two-Layer Model](docs/01_ARCHITECTURE/two-layer-model.md) - Discovery + processing layers
- [Trust Guarantees](docs/01_ARCHITECTURE/trust-guarantees.md) - Evidence and verification

### Features

- [Feature Registry](docs/02_FEATURES/FEATURE_REGISTRY.md) - All product features
- [Module Matrix](docs/COMPLETE_MODULE_MATRIX.md) - Module capabilities

### Regulatory Truth

- [Overview](docs/05_REGULATORY/OVERVIEW.md) - Regulatory processing system
- [Pipeline](docs/05_REGULATORY/PIPELINE.md) - Processing stages

### Operations

- [Operations Runbook](docs/04_OPERATIONS/OPERATIONS_RUNBOOK.md) - Operational procedures
- [Deployment](docs/DEPLOYMENT.md) - Deployment guide

### Research

- [Fiskalizacija 2.0](docs/research/fiskalizacija-2.md) - Croatian fiscalization
- [E-Invoice Providers](docs/research/e-invoice-providers.md) - Provider analysis

## Browser Support

The application supports the following browsers:

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | Last 2 versions |
| Firefox | Last 2 versions |
| Safari  | Last 2 versions |
| Edge    | Last 2 versions |

We target browsers with >0.5% global usage, excluding Opera Mini and discontinued browsers. See `browserslist` in `package.json` for the exact configuration.

## Tech Stack

| Layer    | Technology                    |
| -------- | ----------------------------- |
| Frontend | Next.js 15, React, TypeScript |
| Database | PostgreSQL 16, Prisma 7       |
| Auth     | NextAuth v5 (Auth.js)         |
| Queue    | BullMQ + Redis                |
| AI/LLM   | Ollama, OpenRouter            |
| Deploy   | Coolify on Hetzner ARM64      |

## Portals

| Portal       | URL                 | Audience       |
| ------------ | ------------------- | -------------- |
| Marketing    | fiskai.hr           | Public         |
| Client App   | app.fiskai.hr       | Clients        |
| Staff Portal | app.fiskai.hr/staff | Accountants    |
| Admin Portal | app.fiskai.hr/admin | Platform owner |

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

Proprietary - All rights reserved
