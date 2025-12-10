# FiskAI

Croatian AI-first accounting and invoicing SaaS platform.

## Overview

FiskAI is a cloud-based, modular accounting solution designed for Croatian companies, from paušalni obrt to d.o.o. Built with AI at its core for intelligent automation of accounting tasks.

## Tech Stack

- **Frontend:** Next.js + React + TypeScript
- **Database:** PostgreSQL
- **Auth:** NextAuth.js
- **Deployment:** Coolify on VPS (ARM64) + Cloudflare CDN
- **Architecture:** Modular, multi-tenant (single DB with company_id)

## Modules (Roadmap)

1. **E-Invoicing** - Fiskalizacija 2.0 / e-Račun (MVP)
2. **Invoicing** - Create, send, track invoices
3. **Expenses** - Cost tracking, receipt scanning
4. **Banking** - Bank statement import, reconciliation
5. **Bookkeeping** - Double-entry, kontni plan, temeljnice
6. **VAT/PDV** - VAT calculations, reporting, PDV obrazac
7. **Payroll** - Plaće, JOPPD
8. **Reporting** - Financial reports, analytics, AI insights
9. **Assets** - Fixed asset tracking, depreciation

## AI Capabilities (Phased)

- **Phase 1:** OCR & smart data entry (receipt/invoice scanning)
- **Phase 2:** Intelligent automation (auto-categorization, anomaly detection)
- **Phase 3:** Conversational assistant (natural language queries)

## Documentation

- [Research: Fiskalizacija 2.0](docs/research/fiskalizacija-2.md)
- [Research: E-Invoice Providers](docs/research/e-invoice-providers.md)
- [Research: Open Source Solutions](docs/research/open-source-solutions.md)
- [Architecture Design](docs/design/architecture.md)
- [Infrastructure Notes](docs/infrastructure/vps-01-arm.md)

## License

Proprietary - All rights reserved
