# Product Bible Restructure Plan

**Date:** 2025-12-27
**Status:** Proposed
**Goal:** Split PRODUCT_BIBLE.md (3200+ lines) into 8 manageable chapters

---

## Current State

The `docs/PRODUCT_BIBLE.md` is a monolithic document with:
- 17 main sections
- 4 appendixes
- ~41,000 tokens (too large for single-file AI processing)
- Version 4.2.0 (last updated 2025-12-20)

### Current Structure

```
1. Vision & Non-Negotiables
2. Architecture Overview
3. User Personas & Journey Matrix
4. Legal Forms & Compliance Requirements
5. Module System & Entitlements
6. Permission Matrix (RBAC)
7. Visibility & Feature Gating
8. Dashboard & Progressive Disclosure
9. UI Components & Behaviors
10. Complete User Flows
11. Tax & Regulatory Data
12. Integration Ecosystem
13. Monetization & Pricing
14. Implementation Status Matrix
15. Data Models
16. API Reference (Legacy)
17. Complete API Reference
Appendix A: Glossary
Appendix B: File Locations
Appendix 1: Strategic Technical Specification
Appendix 2: Improvement Ledger
Document History
```

---

## Proposed Structure

### Directory: `docs/product-bible/`

```
docs/product-bible/
├── 00-INDEX.md                  # Master index with links, version, changelog
├── 01-VISION-ARCHITECTURE.md    # Vision, tech stack, directory structure
├── 02-USERS-JOURNEYS.md         # Personas, journey matrix, stages
├── 03-LEGAL-COMPLIANCE.md       # Legal forms, tax rates, deadlines
├── 04-ACCESS-CONTROL.md         # Modules, RBAC, visibility
├── 05-UI-EXPERIENCE.md          # Dashboard, components, user flows
├── 06-INTEGRATIONS.md           # External systems, AI agents
├── 07-DATA-API.md               # Data models, API, server actions
└── 08-APPENDIXES.md             # Glossary, file locations, audit
```

---

## Chapter Mapping

### 01-VISION-ARCHITECTURE.md
**Source Sections:** 1, 2
**Content:**
- What FiskAI Is (Core Promise)
- Non-Negotiables Table
- The Three Portals
- Tech Stack (Next.js, Prisma, Drizzle, etc.)
- Directory Structure
- Request Flow Diagram

**Estimated Size:** ~200 lines

---

### 02-USERS-JOURNEYS.md
**Source Sections:** 3
**Content:**
- Persona 1: Marko (Paušalni Freelancer)
- Persona 2: Ana (Growing Obrt)
- Persona 3: Ivan (D.O.O. Owner)
- Persona 4: Petra (Accountant/Staff)
- Persona 5: Admin (Platform Owner)
- Journey Matrix (Persona × Stage)
- Stage Triggers (onboarding → setup → active → strategic)

**Estimated Size:** ~350 lines

---

### 03-LEGAL-COMPLIANCE.md
**Source Sections:** 4, 11
**Content:**
- Croatian Business Types Table
- Module Requirements by Legal Form
- The 20 Scenarios Matrix
- Invoice Requirements by VAT Status
- Fiscalization Requirements
- Key Thresholds (2025)
- Tax Rates (Income, Corporate, VAT, Paušalni brackets)
- Contribution Rates
- Payment IBANs
- Deadlines Calendar

**Estimated Size:** ~400 lines

---

### 04-ACCESS-CONTROL.md
**Source Sections:** 5, 6, 7
**Content:**
- The 16 Module Keys
- Module Definition Structure
- Entitlement Checking
- The Five Tenant Roles
- Permission Matrix (CRUD by role)
- Audit Logging & Document Integrity
- Three-Layer Visibility System
- Element Visibility Registry
- Visibility Component Usage

**Estimated Size:** ~500 lines

---

### 05-UI-EXPERIENCE.md
**Source Sections:** 8, 9, 10
**Content:**
- The Four Dashboard Stages (Onboarding → Setup → Active → Strategic)
- Dashboard Element Catalog
- Layout Components (Header, Sidebar, Mobile Nav)
- Form Components (Invoice, Onboarding)
- Modal & Dialog Behaviors
- Empty States
- Toast Notifications
- Notification System
- Email Integration
- Authentication Flows
- Invoice Creation Flow
- Bank Reconciliation Flow
- Paušalni Monthly Flow
- VAT Return Flow
- Fiscal Certificate Management
- POS Terminal Operations

**Estimated Size:** ~700 lines

---

### 06-INTEGRATIONS.md
**Source Sections:** 12
**Content:**
- External Systems Table (FINA, Gocardless, Stripe, etc.)
- E-Invoice Providers
- Bank Import Formats
- AI Agent: The Watchdog (Regulatory Guardian)
- AI Agent: The Clerk (OCR & Categorization)
- AI Agent: The Matcher (Bank Reconciliation)

**Estimated Size:** ~350 lines

---

### 07-DATA-API.md
**Source Sections:** 13, 14, 15, 16, 17
**Content:**
- Tier Structure (Free/Paušalni/Pro/Business/Enterprise)
- Module-to-Tier Mapping
- Stripe Integration
- Implementation Status Matrix
- Core Data Models (User, Company, CompanyUser)
- Invoice Model
- Drizzle ORM Models
- Missing Models (To Be Implemented)
- Route Groups
- Complete API Endpoints (119 total)
- Server Actions Reference

**Estimated Size:** ~600 lines

---

### 08-APPENDIXES.md
**Source Sections:** Appendix A, B, 1, 2, Document History
**Content:**
- Glossary (Croatian terms)
- File Locations Reference
- Strategic Technical Specification (Gaps + Proof)
- Improvement Ledger (Audit + Fixes)
- Document History & Changelog

**Estimated Size:** ~500 lines

---

### 00-INDEX.md
**New File**
**Content:**
- Product Bible Overview
- Version & Status Alignment Table
- Quick Links to All Chapters
- How to Update This Documentation
- Changelog (moved from individual chapters)

**Estimated Size:** ~100 lines

---

## Migration Steps

### Phase 1: Create Structure
1. Create `docs/product-bible/` directory
2. Create `00-INDEX.md` with overview and links
3. Split content into 8 chapter files

### Phase 2: Content Migration
1. Copy relevant sections to each chapter
2. Update internal links (cross-references between chapters)
3. Add chapter-specific headers and navigation
4. Remove redundant content

### Phase 3: Cleanup
1. Keep `docs/PRODUCT_BIBLE.md` as redirect/deprecated notice
2. Update `CLAUDE.md` to reference new structure
3. Update any other docs that reference the bible

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Maintainability** | Update only the relevant chapter after a PR |
| **AI-Friendly** | Each chapter fits in context windows (~400-600 lines) |
| **Discoverability** | Clear naming makes finding content easier |
| **Parallel Work** | Multiple people can update different chapters |
| **Git History** | Cleaner diffs per-chapter vs monolithic file |
| **Version Control** | Track versions per-chapter if needed |

---

## Open Questions

1. Should we keep `PRODUCT_BIBLE.md` as a redirect or delete it entirely?
2. Should chapters include their own version numbers or inherit from index?
3. Should we create a CI check to validate cross-chapter links?

---

## Next Steps

- [ ] Review and approve this plan
- [ ] Execute Phase 1 (create structure)
- [ ] Execute Phase 2 (migrate content)
- [ ] Execute Phase 3 (cleanup)
- [ ] Update documentation references
