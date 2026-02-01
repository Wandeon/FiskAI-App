# ROADMAP.md - FiskAI Development Roadmap

> Sprint-ready development roadmap with clear gates for each business type.
> Goal: Each business type has a fully working UI and UX that makes the app amazing to use.
> Last updated: 2026-02-01

---

## Current Status

**Active Phase:** Business Type Excellence
**CI Status:** ✅ Green (all tests passing)
**Deployment:** ✅ Production healthy (app.fiskai.hr)
**Tests:** 1,454 passing

---

## Business Types Overview

| Business Type      | Code          | Status    | Onboarding       | Dashboard      | Priority    |
| ------------------ | ------------- | --------- | ---------------- | -------------- | ----------- |
| Paušalni Obrt      | `OBRT_PAUSAL` | ✅ Strong | ✅ 3-step wizard | ✅ Specialized | P0 - Polish |
| Obrt (Real Income) | `OBRT_REAL`   | ⚠️ Basic  | ⚠️ Generic       | ❌ Generic     | P1 - Build  |
| Obrt (VAT)         | `OBRT_VAT`    | ⚠️ Basic  | ⚠️ Generic       | ⚠️ Partial     | P1 - Build  |
| j.d.o.o.           | `JDOO`        | ❌ Gated  | ❌ Waitlist      | ❌ None        | P2 - Enable |
| d.o.o.             | `DOO`         | ❌ Gated  | ❌ Waitlist      | ❌ None        | P2 - Enable |

---

## Architecture (3-Repo Split)

| Repository          | Purpose                        | URL            | Status      |
| ------------------- | ------------------------------ | -------------- | ----------- |
| **FiskAI-App**      | Next.js accounting application | app.fiskai.hr  | ✅ Deployed |
| fiskai-intelligence | Intelligence API + RTL workers | iapi.fiskai.hr | ✅ Deployed |
| fiskai-marketing    | Marketing site                 | fiskai.hr      | ✅ Deployed |

---

## Phase 0: Recovery & Stabilization ✅ COMPLETE

### 0.1 Governance Foundation ✅

- [x] Create ROADMAP.md
- [x] Create CHANGELOG.md
- [x] Create DECISIONS.md
- [x] Create AGENTS.md

### 0.2 CI Green ✅

- [x] Fix fiscal-validator.yml (missing run.ts)
- [x] Fix ActionButton test (i18n assertion)
- [x] Add 8GB heap for lint/typecheck

### 0.3 Module Verification ✅

- [x] All 17 modules verified operational
- [x] Audit report created: `docs/audits/2026-02-01-module-audit.md`

---

## Phase 1: Paušalni Obrt Excellence (P0)

> **Goal:** Make Paušalni Obrt the gold standard - every user feels guided and confident.

### Sprint 1.1: Threshold Intelligence

**Duration:** 1 week

**Features:**

- [ ] Real-time 60,000€ threshold tracker with visual progress bar
- [ ] Smart alerts at 50%, 75%, 90%, 100% of threshold
- [ ] "What happens next" guidance when approaching/exceeding threshold
- [ ] Monthly income projections based on current trajectory

**Gate:** User can see their YTD progress, receives proactive alerts, understands consequences.

**Files to modify:**

- `src/components/dashboard/pausalni-status-card.tsx`
- `src/lib/pausalni/threshold-alerts.ts` (new)
- `src/app/api/pausalni/projections/route.ts` (new)

---

### Sprint 1.2: Tax Obligation Automation

**Duration:** 1 week

**Features:**

- [ ] Doprinosi calculation and payment slip generation
- [ ] PO-SD form pre-filling from app data
- [ ] Quarterly obligation calendar with reminders
- [ ] One-click payment slip downloads

**Gate:** User can generate all required tax documents without manual data entry.

**Files to modify:**

- `src/lib/pausalni/obligation-generator.ts`
- `src/lib/pausalni/forms/po-sd-prefill.ts` (new)
- `src/components/pausalni/obligation-calendar.tsx` (new)

---

### Sprint 1.3: Guided First Week

**Duration:** 1 week

**Features:**

- [ ] Interactive "First Week" checklist with progress tracking
- [ ] Contextual help tooltips throughout the app
- [ ] Video tutorials for key workflows (invoice, expense, KPR)
- [ ] Celebration moments (first invoice, first week complete)

**Gate:** New user completes first week checklist with 90%+ completion rate.

**Files to modify:**

- `src/lib/guidance/checklist.ts`
- `src/components/patterns/onboarding/FirstWeekProgress.tsx` (new)
- `src/components/ui/contextual-help.tsx` (new)

---

### Sprint 1.4: Dashboard Polish

**Duration:** 1 week

**Features:**

- [ ] Unified "Paušalni Hub" dashboard replacing generic dashboard
- [ ] Quick actions: New Invoice, Record Expense, View KPR
- [ ] Status overview: Revenue, Threshold, Next Deadline
- [ ] Recent activity feed with smart insights

**Gate:** Paušalni user dashboard is distinct, focused, and actionable.

**Files to modify:**

- `src/app/(app)/pausalni/page.tsx`
- `src/components/pausalni/quick-actions.tsx` (new)
- `src/components/pausalni/insights-feed.tsx` (new)

---

## Phase 2: Obrt Real Income Excellence (P1)

> **Goal:** Real income Obrt users have specialized tools for expense tracking and tax management.

### Sprint 2.1: Onboarding Specialization

**Duration:** 1 week

**Features:**

- [ ] Dedicated OBRT_REAL onboarding flow (not generic)
- [ ] Explain real income vs paušalni differences
- [ ] Collect business category for expense guidance
- [ ] Set up chart of accounts based on business type

**Gate:** User understands their tax obligations and has a configured expense tracking system.

**Files to modify:**

- `src/components/onboarding/obrt-real-onboarding.tsx` (new)
- `src/lib/chart-of-accounts/templates.ts` (new)

---

### Sprint 2.2: Expense Intelligence

**Duration:** 1 week

**Features:**

- [ ] Smart expense categorization with AI suggestions
- [ ] Deductible vs non-deductible guidance per category
- [ ] Receipt scanning with auto-categorization
- [ ] Monthly expense summary with tax impact

**Gate:** User knows which expenses are deductible and sees tax savings.

**Files to modify:**

- `src/lib/ai/categorize.ts`
- `src/components/expenses/deduction-indicator.tsx` (new)
- `src/lib/expenses/tax-impact.ts` (new)

---

### Sprint 2.3: Profit & Tax Dashboard

**Duration:** 1 week

**Features:**

- [ ] Real-time profit/loss calculation
- [ ] Estimated tax liability (quarterly)
- [ ] Cash flow projection
- [ ] Tax optimization suggestions

**Gate:** User sees their current tax liability and can make informed decisions.

**Files to modify:**

- `src/components/dashboard/obrt-real-dashboard.tsx` (new)
- `src/lib/tax/income-tax-estimator.ts` (new)

---

### Sprint 2.4: Compliance Calendar

**Duration:** 1 week

**Features:**

- [ ] Tax deadline calendar (DOH, doprinosi, PDV if applicable)
- [ ] Form preparation reminders
- [ ] Accountant collaboration features
- [ ] Document checklist for tax filing

**Gate:** User never misses a deadline and knows what to prepare.

**Files to modify:**

- `src/components/compliance/calendar.tsx` (new)
- `src/lib/compliance/obrt-deadlines.ts` (new)

---

## Phase 3: Obrt VAT Excellence (P1)

> **Goal:** VAT-registered Obrts have full VAT management with no manual calculations.

### Sprint 3.1: VAT Dashboard

**Duration:** 1 week

**Features:**

- [ ] VAT summary: Input vs Output VAT
- [ ] Current period liability/refund
- [ ] VAT payment schedule
- [ ] PDV-S form preview

**Gate:** User sees their VAT position at a glance.

**Files to modify:**

- `src/components/dashboard/vat-dashboard.tsx` (new)
- `src/lib/vat/period-calculator.ts` (new)

---

### Sprint 3.2: VAT Return Automation

**Duration:** 1 week

**Features:**

- [ ] One-click PDV-S XML generation
- [ ] Pre-validation against ePorezna requirements
- [ ] Submission readiness checklist
- [ ] Historical returns archive

**Gate:** User can generate valid PDV-S without manual data entry.

**Files to modify:**

- `src/lib/reports/pdv-xml-generator.ts`
- `src/app/(app)/reports/vat/submit/page.tsx` (new)

---

### Sprint 3.3: EU/Intra-community

**Duration:** 1 week

**Features:**

- [ ] Automatic reverse charge detection
- [ ] EU customer VAT validation (VIES)
- [ ] Intrastat reporting (if applicable)
- [ ] ZP form generation

**Gate:** EU transactions are handled correctly with proper documentation.

**Files to modify:**

- `src/lib/vat/reverse-charge.ts` (new)
- `src/lib/pausalni/vies-validation.ts` (expand)

---

## Phase 4: j.d.o.o. Launch (P2)

> **Goal:** Enable j.d.o.o. users with full corporate features.

### Sprint 4.1: Onboarding Enablement

**Duration:** 1 week

**Features:**

- [ ] Remove waitlist gate for j.d.o.o.
- [ ] j.d.o.o. specific onboarding flow
- [ ] Collect: OIB, MBS, founding date, share capital
- [ ] Configure corporate tax settings

**Gate:** j.d.o.o. users can complete onboarding and access the app.

**Files to modify:**

- `src/components/onboarding/drustvo-gating.tsx` → `drustvo-onboarding.tsx`
- `src/app/(app)/onboarding/jdoo/` (new)

---

### Sprint 4.2: Corporate Dashboard

**Duration:** 1 week

**Features:**

- [ ] Profit before tax calculation
- [ ] Corporate tax (18%) liability tracking
- [ ] Dividend distribution planning
- [ ] Director salary optimization

**Gate:** User understands their corporate tax position.

**Files to modify:**

- `src/components/dashboard/corporate-dashboard.tsx` (new)
- `src/lib/tax/corporate-tax-calculator.ts` (new)

---

### Sprint 4.3: Financial Statements

**Duration:** 1 week

**Features:**

- [ ] Balance sheet generation
- [ ] Income statement
- [ ] GFI-POD form generation
- [ ] Annual report preparation

**Gate:** User can generate required financial statements.

**Files to modify:**

- `src/lib/reports/balance-sheet.ts` (new)
- `src/lib/reports/income-statement.ts` (new)

---

### Sprint 4.4: Corporate Compliance

**Duration:** 1 week

**Features:**

- [ ] FINA submission deadlines
- [ ] Sudski registar obligations
- [ ] Quarterly advance payments (predujam)
- [ ] Annual assembly documentation

**Gate:** User has full visibility into corporate compliance requirements.

**Files to modify:**

- `src/lib/compliance/corporate-deadlines.ts` (new)
- `src/components/compliance/corporate-calendar.tsx` (new)

---

## Phase 5: d.o.o. Launch (P2)

> **Goal:** Full d.o.o. support with advanced features.

### Sprint 5.1: d.o.o. Onboarding

**Duration:** 1 week

**Features:**

- [ ] Remove waitlist gate for d.o.o.
- [ ] Multi-director support
- [ ] Share capital structure
- [ ] Beneficial owner declaration

**Gate:** d.o.o. users can complete onboarding.

---

### Sprint 5.2: Bank Reconciliation

**Duration:** 1 week

**Features:**

- [ ] Bank sync via GoCardless
- [ ] Automatic transaction matching
- [ ] Reconciliation dashboard
- [ ] Unmatched transaction queue

**Gate:** Bank transactions are auto-matched with invoices/expenses.

**Files to modify:**

- `src/app/(app)/banking/reconciliation/page.tsx`
- `src/lib/banking/reconciliation-service.ts`

---

### Sprint 5.3: Advanced Reporting

**Duration:** 1 week

**Features:**

- [ ] Custom report builder
- [ ] Multi-period comparison
- [ ] Accountant export (full data package)
- [ ] Audit trail

**Gate:** User can generate any required report.

---

### Sprint 5.4: Multi-user & Permissions

**Duration:** 1 week

**Features:**

- [ ] Team member invitations
- [ ] Role-based access (Owner, Accountant, Viewer)
- [ ] Activity log
- [ ] Approval workflows

**Gate:** Multiple users can collaborate with appropriate permissions.

---

## Phase 6: Cross-cutting Excellence

### Sprint 6.1: Mobile Experience

**Duration:** 1 week

**Features:**

- [ ] Mobile-optimized invoice creation
- [ ] Expense capture with camera
- [ ] Dashboard widgets
- [ ] Push notifications for deadlines

**Gate:** Core workflows work perfectly on mobile (375px).

---

### Sprint 6.2: AI Assistant Enhancement

**Duration:** 1 week

**Features:**

- [ ] Natural language queries ("What's my VAT liability?")
- [ ] Smart suggestions based on user behavior
- [ ] Regulatory Q&A with citations
- [ ] Proactive compliance alerts

**Gate:** AI assistant provides genuinely useful help.

---

### Sprint 6.3: Performance & Polish

**Duration:** 1 week

**Features:**

- [ ] Page load < 2s for all routes
- [ ] Skeleton loading states everywhere
- [ ] Error states with recovery actions
- [ ] Accessibility audit (WCAG 2.1 AA)

**Gate:** App feels fast, polished, and accessible.

---

## Sprint Gates (Definition of Done)

Each sprint must meet these criteria:

### Code Quality

- [ ] All tests passing (unit, integration, E2E)
- [ ] No TypeScript errors
- [ ] Lint passing with no new warnings
- [ ] No TODO/FIXME in new code

### UX Quality

- [ ] Mobile responsive (375px - 1440px)
- [ ] Loading states for async operations
- [ ] Error states with clear messages (Croatian)
- [ ] Empty states with helpful guidance

### Documentation

- [ ] CHANGELOG.md updated
- [ ] Component documentation (if new patterns)
- [ ] API documentation (if new endpoints)

### User Validation

- [ ] Feature matches acceptance criteria
- [ ] No regression in existing functionality
- [ ] Tested with real user scenarios

---

## Success Metrics

### Per Business Type

| Business Type | Target Metric            | Current | Goal           |
| ------------- | ------------------------ | ------- | -------------- |
| OBRT_PAUSAL   | Onboarding completion    | ~70%    | 95%            |
| OBRT_PAUSAL   | First invoice within 24h | ~40%    | 80%            |
| OBRT_REAL     | Dashboard engagement     | N/A     | 3+ visits/week |
| OBRT_VAT      | VAT return self-service  | 0%      | 80%            |
| JDOO          | Onboarding available     | No      | Yes            |
| DOO           | Onboarding available     | No      | Yes            |

### Overall

| Metric                     | Current | Goal  |
| -------------------------- | ------- | ----- |
| NPS Score                  | Unknown | 50+   |
| Support tickets/user/month | Unknown | < 0.5 |
| Feature adoption           | Unknown | 70%+  |

---

## Quick Reference

**Run tests:**

```bash
npx pnpm test
```

**Run build:**

```bash
npx pnpm build
```

**Run lint (with memory):**

```bash
npx pnpm lint
```

**Run typecheck (with memory):**

```bash
npx pnpm typecheck
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

---

_Last updated: 2026-02-01_
