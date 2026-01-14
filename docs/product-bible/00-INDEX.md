# FiskAI Product Bible

## The Complete System Truth

**Version:** 5.1.0
**Date:** 2026-01-14
**Status:** Canonical - Single Source of Truth (Reality-Audited)
**Scope:** Every flow, every button, every permission, every scenario
**Audit Method:** Codebase audit via parallel haiku subagents (2026-01-05)

---

## Document Status Legend

Throughout this document:

- ✅ **Implemented** - In production, working, verified in codebase
- ⚠️ **Partially Implemented** - Core functionality working, some features pending
- 🚧 **In Development** - Actively being built, code exists
- 📋 **Planned** - Designed but not started, no code
- 🗑️ **Deprecated** - Being phased out
- ❌ **Removed** - No longer in codebase

---

## System Reality Snapshot (2026-01-14)

| Metric             | Count | Notes                                        |
| ------------------ | ----- | -------------------------------------------- |
| Prisma Models      | 184   | Multi-tenant with companyId isolation        |
| Enums              | 148   | Including SystemRole, CompanyRole, LegalForm |
| Modules            | 17    | platform-core through ai-assistant           |
| API Route Files    | 242   | Under src/app/api/                           |
| HTTP Endpoints     | ~242  | Across auth, invoicing, banking, admin, AI   |
| RTL Workers        | 15    | BullMQ-based pipeline workers                |
| Marketing Pages    | ~45   | Public site at fiskai.hr                     |
| Client App Pages   | ~85   | app.fiskai.hr                                |
| Staff Portal Pages | 12    | app.fiskai.hr/staff                          |
| Admin Portal Pages | ~22   | app.fiskai.hr/admin                          |

---

## Version Alignment

| Component              | Bible Version | Code Reality                        | Status     |
| ---------------------- | ------------- | ----------------------------------- | ---------- |
| Core Architecture      | 5.1.0         | Next.js 15, Prisma 7                | ✅ Aligned |
| Module System          | 5.1.0         | 17 modules in definitions.ts        | ✅ Aligned |
| Visibility System      | 5.1.0         | CompetenceLevel + ProgressionStage  | ✅ Aligned |
| Guidance System        | 5.1.0         | Drizzle-based, checklist system     | ✅ Aligned |
| Pricing Tiers          | 5.1.0         | 4 tiers in subscriptionPlans.ts     | ✅ Aligned |
| Staff Portal           | 5.1.0         | 12 pages, basic functionality       | ⚠️ Partial |
| Admin Portal           | 5.1.0         | ~22 pages, management features      | ✅ Aligned |
| Regulatory Truth Layer | 5.1.0         | 15 workers, 7-stage pipeline        | ✅ Aligned |
| Integrations           | 5.1.0         | Porezna CIS, ePoslovanje v2         | ✅ Aligned |
| Infrastructure         | 5.1.0         | Split: VPS-01 (app) + VPS (workers) | ✅ Aligned |

---

## Table of Contents

### Core Chapters

1. **[Vision & Architecture](./01-VISION-ARCHITECTURE.md)**
   - Vision & Non-Negotiables
   - Architecture Overview (Tech Stack, Directory Structure, Request Flow)

2. **[Users & Journeys](./02-USERS-JOURNEYS.md)**
   - The Five Personas (Marko, Ana, Ivan, Petra, Admin)
   - Journey Matrix (Persona × Stage)

3. **[Legal & Compliance](./03-LEGAL-COMPLIANCE.md)**
   - Croatian Business Types
   - Module Requirements by Legal Form
   - The 20 Scenarios Matrix
   - Tax & Regulatory Data (Thresholds, Rates, Contributions, Deadlines)

4. **[Access Control](./04-ACCESS-CONTROL.md)**
   - Module System & Entitlements
   - Permission Matrix (RBAC)
   - Visibility & Feature Gating

5. **[UI & Experience](./05-UI-EXPERIENCE.md)**
   - Dashboard & Progressive Disclosure
   - UI Components & Behaviors
   - Complete User Flows

6. **[Integrations](./06-INTEGRATIONS.md)**
   - External Systems
   - E-Invoice Providers
   - Bank Import Formats
   - Proactive AI Agents

7. **[Data & API](./07-DATA-API.md)**
   - Monetization & Pricing
   - Implementation Status Matrix
   - Data Models (Prisma & Drizzle)
   - Complete API Reference
   - Server Actions

8. **[Appendixes](./08-APPENDIXES.md)**
   - Appendix A: Glossary
   - Appendix B: File Locations
   - Appendix 1: Strategic Technical Specification
   - Appendix 2: Improvement Ledger

9. **[Guidance System](./09-GUIDANCE-SYSTEM.md)** _(New)_
   - System Purpose & Architecture
   - Preference Model (Competence Levels, Categories)
   - Help Density Configuration
   - Checklist System (Aggregation, Urgency, Interactions)
   - Pattern Insights (AI-Powered Suggestions)
   - Relationship with Visibility System
   - API Reference
   - UI Component Inventory

---

## Document History

| Version | Date       | Author        | Changes                                                           |
| ------- | ---------- | ------------- | ----------------------------------------------------------------- |
| 5.1.0   | 2026-01-14 | Claude Sonnet | January 2026 updates: infrastructure split, worker count, metrics |
| 5.0.0   | 2026-01-05 | Claude Opus   | Complete reality audit & reconstruction                           |
| 4.3.0   | 2025-12-29 | Claude        | System Registry, RTL Content Sync, HCL updates                    |
| 4.2.1   | 2025-12-28 | Claude        | Added Chapter 9: Guidance System specification                    |
| 4.2.0   | 2025-12-20 | Antigravity   | Updated 2025/2026 Tax Thresholds & E-Invoice Mandate              |
| 4.1.0   | 2025-12-20 | Claude        | Critical fixes & alignment                                        |
| 4.0.0   | 2025-12-19 | Claude        | Complete rewrite - unified bible                                  |
| 3.1.0   | 2025-12-19 | Gemini        | V3.1 Expansion                                                    |
| 2.0.0   | 2025-12-19 | Codex         | V2 Rewrite                                                        |
| 1.0.0   | 2025-12-19 | Gemini        | Initial draft                                                     |

### v5.1.0 Changes (2026-01-14) - January 2026 Updates

**Infrastructure Evolution:**

- **Distributed Architecture:** Infrastructure split across three servers
  - VPS-01 (152.53.146.3): Primary application server (ARM64)
  - VPS (152.53.179.101): Background workers + Redis (x86_64)
  - GPU-01 (Tailscale only): LLM inference with Ollama
  - All inter-service communication over Tailscale VPN

- **Marketing Site Separation:** fiskai.hr moved to separate static deployment
  - Static export on SiteGround hosting
  - Separate repository (fiskai-marketing)
  - Zero runtime dependencies on main application
  - Survives complete backend outages

**System Metrics Updated:**

- Prisma Models: 182 → 184 (added 2 models)
- Enums: 80+ → 148 (full count from schema)
- API Route Files: 241 → 242
- HTTP Endpoints: ~216 → ~242
- RTL Workers: 14 → 15 (added worker-einvoice-inbound)

**Worker Pipeline Enhancements:**

- Added 15th worker: `worker-einvoice-inbound` for ePoslovanje polling
- LLM provider health checks with circuit breaker (in progress)
- Watchdog alerts for mid-pipeline progress gates
- Unified GHCR image delivery for app and workers

**Operational Improvements:**

- Docker cache optimization for faster builds
- Route group URL encoding fixes
- Schema drift fixes and worker startup logging
- Migration for RULE_REVOKED enum value
- Pino packages added to serverExternalPackages

**Documentation Updates:**

- Infrastructure topology documented in CLAUDE.md
- Multi-server deployment procedures
- Marketing separation architecture
- Worker deployment scripts standardized

---

### v5.0.0 Changes (2026-01-05) - Reality Audit

**Audit Methodology:**

- 7 parallel haiku subagents audited codebase reality
- Canonical Rule Hierarchy: Runtime > Source > Schema > Migrations > Config > Tests > Docs
- Status labels applied to ALL features per actual implementation state

**Database Reality (182 models):**

- Prisma 7 with 182 models, 80+ enums
- Multi-tenant isolation via AsyncLocalStorage + Prisma middleware
- Soft-delete limited to SourcePointer and FeatureFlag only
- SystemRole enum: USER, STAFF, ADMIN
- CompanyRole enum: OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER

**Module System (17 modules):**

- Corrected count from 16 to 17 modules
- Added: platform-core (always enabled, core routes)
- Entitlements v2 format with permission granularity
- Trial support infrastructure in schema

**Portal Reality:**

- Marketing: ~45 pages (public, MDX guides, comparisons, tools)
- Client App: ~85 pages (full business dashboard)
- Staff Portal: 12 pages (basic, multi-client pending)
- Admin Portal: ~22 pages (tenant/user management, RTL admin)

**RTL Pipeline (15 workers):**

- Sentinel → OCR → Extractor → Composer → Reviewer → Arbiter → Releaser
- Additional: Content-Sync, Evidence-Embedding, Article, Consolidator
- Continuous drainer for 24/7 processing
- Dead letter queue with admin visibility

**Integration Status Updates:**

- ePoslovanje v2: ✅ Implemented (production)
- Porezna CIS: ✅ Implemented (fiscalization)
- GoCardless: ✅ Implemented (PSD2 banking)
- Stripe: ✅ Implemented (billing + Terminal)
- IE-Racuni: 📋 Planned (stub exists)

**Access Control Verified:**

- RequiresModule, RequiresPlan, RequiresEntitlement components
- canPerform() RBAC checks in server actions
- Tenant isolation via setCompanyContext() + Prisma extensions

---

### v4.3.0 Changes (2025-12-29)

**System Registry (16 commits):**

- Blast radius computation for PRs
- CI enforcement via GitHub workflows
- Operational metadata on CRITICAL components
- Progressive enforcement rollout

**RTL Content Sync (PR #140):**

- BullMQ worker for content synchronization
- Concept registry for RTL-to-content mapping
- Frontmatter patcher for MDX files

**System Status Human Control Layer (PR #142):**

- Admin page for system status monitoring
- Dead letter queue handling

---

**This document is the single source of truth for FiskAI product definition.**
