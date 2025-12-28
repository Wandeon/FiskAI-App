# FiskAI Product Bible

## The Complete System Truth

**Version:** 4.2.1
**Date:** 2025-12-28
**Status:** Canonical - Single Source of Truth
**Scope:** Every flow, every button, every permission, every scenario

---

## Document Status Legend

Throughout this document:

- ✅ **Implemented** - In production, working
- ⚠️ **Partial** - Some features working, others in progress
- 🚧 **In Development** - Actively being built
- 📋 **Planned** - Designed but not started
- ❌ **Not Planned** - Out of scope

---

## Version Alignment

| Component         | Bible Version | Code Version | Status     |
| ----------------- | ------------- | ------------ | ---------- |
| Core Architecture | 4.1.0         | Current      | ✅ Aligned |
| Module System     | 4.1.0         | Current      | ✅ Aligned |
| Visibility System | 4.1.0         | Current      | ✅ Aligned |
| Guidance System   | 4.2.1         | Current      | ✅ Aligned |
| Pricing Tiers     | 4.1.0         | Stripe       | ⚠️ Partial |
| Staff Portal      | 4.1.0         | Current      | ⚠️ Partial |
| Admin Portal      | 4.1.0         | Current      | ⚠️ Partial |

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

9. **[Guidance System](./09-GUIDANCE-SYSTEM.md)** *(New)*
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

| Version | Date       | Author      | Changes                                              |
| ------- | ---------- | ----------- | ---------------------------------------------------- |
| 4.2.1   | 2025-12-28 | Claude      | Added Chapter 9: Guidance System specification       |
| 4.2.0   | 2025-12-20 | Antigravity | Updated 2025/2026 Tax Thresholds & E-Invoice Mandate |
| 4.1.0   | 2025-12-20 | Claude      | Critical fixes & alignment                           |
| 4.0.0   | 2025-12-19 | Claude      | Complete rewrite - unified bible                     |
| 3.1.0   | 2025-12-19 | Gemini      | V3.1 Expansion                                       |
| 2.0.0   | 2025-12-19 | Codex       | V2 Rewrite                                           |
| 1.0.0   | 2025-12-19 | Gemini      | Initial draft                                        |

### v4.1.0 Changes

**Critical Fixes:**

- Fixed all 40k thresholds to 60k EUR (paušalni/PDV exit threshold per 2025 Croatian Tax Reform)
- Corrected competence terminology: "Foundation" and "Growth" (removed outdated "standard"/"expert" references)
- Updated asset capitalization threshold to 1,000.00 EUR (previously 665 EUR)
- Fixed paušalni income tiers to 7-tier structure (0-60k EUR range)
- Corrected minimal wage to 970 EUR and contribution base to 719.20 EUR
- Updated Income Tax threshold to 60,000 EUR (previously 50,400 EUR)

**New Sections:**

- Section 16: API Reference (Legacy) - documented actual API routes vs server actions
- Section 17: Server Actions Reference - comprehensive CRUD operations inventory
- Section 18: Drizzle ORM & Database Schema - migration from Prisma documentation
- Section 19: AI Agents & Automation - Watchdog, Matcher, and Legal Archive specs
- Section 20: Mobile Navigation & Responsive Design - sidebar behavior documentation

**Alignments:**

- Sidebar navigation aligned with actual implementation (dynamic visibility, mobile behavior)
- Module system aligned with code (defaultEnabled flags, entitlement logic)
- Visibility components documented (RequiresModule, RequiresPlan, etc.)
- Mobile navigation patterns standardized
- Pricing tier documentation updated to match Stripe configuration
- Bank sync and e-invoice provider status clarified

---

**This document is the single source of truth for FiskAI product definition.**
