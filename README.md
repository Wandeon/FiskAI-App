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
- [Coolify Deployment Guide](docs/infrastructure/coolify-setup.md)

## Maintenance Log

- **2025-02-15** – Notification Center bell now consumes real e-invoice/audit data via `src/lib/notifications.ts`, refreshes every 60s through `/api/notifications`, and tracks unread state per company user (`notificationSeenAt` migration + `/api/notifications/read`). See `audit/work-log-2025-02-14.md`.
- **2025-12-10** – Introduced global command palette (`⌘K`), header search affordance, mobile bottom navigation, enhanced multi-step e-invoice composer, and a redesigned dashboard hero/trend visualization (see `audit/ui-ux-refresh-2025-12-10-v2.md`).
- **2025-02-14** – Added GitHub Actions CI workflow, baseline accessibility fixes (Croatian document locale, ARIA-aware inputs, labeled buyer select, invoice table caption/scope), tenant-safety updates (Prisma unique constraints + migration, buyer-company validation), and secret management improvements (`.env.example`, docker-compose variable substitution, removed `AUTH_TRUST_HOST`). See `audit/work-log-2025-02-14.md` for details.

## License

Proprietary - All rights reserved
