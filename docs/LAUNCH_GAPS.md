# FiskAI — Gaps & Customer-Readiness Document

This is a living document to track everything missing (product, compliance, trust, UX, ops, go-to-market) before FiskAI can reliably land and retain first customers in Croatia, starting with the easiest segment (paušalni obrt) and expanding toward full ERP.

Last updated: 2025-12-12

---

## How to Use This Doc

- Treat this as the single source of truth for “what’s missing”.
- Each gap should end up with: an issue/ticket, an owner, a deadline, and a definition of done.
- Focus on “time-to-value”: how fast a brand-new user can reach the “first success moment”.

### Priority Legend

- **P0 (Blocker)**: prevents signups, onboarding, compliance, or trust.
- **P1 (High)**: materially improves activation/retention or prevents costly support.
- **P2 (Medium)**: important for scale/efficiency, but not immediate blocker.
- **P3 (Later)**: nice-to-have, polish, or post-PMF.

---

## Snapshot: What’s Currently Visible in Production

Observed from the deployed app behind `erp.metrica.hr`:

- Root (`/`) redirects to `/login` (app-first, no public marketing presence).
- `/pricing`, `/features`, `/about`, `/robots.txt`, `/sitemap.xml` currently return **404**.
- `/api/health` exists (good for monitoring).
- Login UX contains an `/admin-login` affordance in the UI, but production returns **404** (dead link = trust hit).

What’s implemented in the codebase (high level):

- Next.js app with auth, onboarding, invoices/e-invoices, expenses + AI/OCR features, dashboard, settings (including premises), multi-tenant patterns.
- Fiscalization/e-invoicing groundwork exists, but production readiness depends on external intermediary integration and compliance hardening.

---

## Core Launch Principle (Croatia-specific)

To win first customers in Croatia, FiskAI must feel:

1. **Legally safe** (fiskalizacija/e-račun compliance, archiving rules).
2. **Operationally safe** (backups, audit logs, data export, support).
3. **Faster than “Excel + accountant”** (time saved, fewer errors, guided onboarding).
4. **Trustworthy** (clear pricing, company identity, policies, support, references).

---

## Biggest “Land First Customers” Gaps (Executive List)

### Acquisition & Trust Surface (P0)

- **No public landing site** with value prop, ICP, screenshots, pricing, contact, demo booking, and documentation.
- **No visible legal pages**: Terms, Privacy Policy, DPA, cookies, AI data usage policy.
- **No “trust center”**: security posture, data residency/processing, uptime, incident reporting.
- **No customer proof**: testimonials, early adopter program, case studies, “trusted by”.

### Activation & Onboarding (P0/P1)

- **First-run path must be unstoppable**: users should never feel “stuck”.
- **Plan/module gating** exists; if new users encounter locked modules early without clarity, conversion drops.
- **Dead-end link**: `/admin-login` visible but 404 in prod (fix or remove).

### Compliance & Accounting Readiness (P0/P1)

- For **paušalni obrt**, the “basic but complete” feature set is different than for **VAT d.o.o.**.
- For **Fiskalizacija 2.0 (2026)** you will need credible intermediary integration + archiving story.
- **Data export & accountant handoff** is essential even if you aim to replace accounting offices.

### Operational Readiness (P0/P1)

- Backups, restore drills, monitoring/alerting, audit trails, support workflows, and incident handling must be defined.
- Billing/subscription management must be predictable and transparent before you charge real money.

---

## Segment Reality Check (Target = Whole Market)

“Whole market” is the end state. For first customers, you still need a **wedge**.

Recommended phased wedge strategy:

1. **Phase A (first customers): paušalni obrt + small service businesses**  
   Win by: easy invoicing, expense capture, bank import (basic), tax summaries, clean exports for accountants.
2. **Phase B: VAT obrt + small d.o.o.**  
   Win by: VAT handling, recurring invoices, approvals, e-invoices (send/receive), fiscalization automation.
3. **Phase C: full accounting + payroll + inventory**  
   Win by: double-entry, JOPPD/payroll compliance, stock, fixed assets, full ERP workflows.

This doc lists gaps for all phases, but includes a **“First customers (paušalni obrt) definition of done”** section to keep focus.

---

## First Customers (Paušalni Obrt) — Definition of Done

If you want to land the first 5–20 paying customers quickly, the app must reliably deliver the following end-to-end:

### Must-Haves (P0)

- Account creation + login works reliably; password reset works; email deliverability is good.
- Company onboarding captures the right minimum data (and explains why).
- Create & send an invoice (PDF/email) easily, with correct numbering and templates.
- Track paid/unpaid, basic reminders, and basic customer/contact management.
- Enter expenses (manual + receipt scan) and categorize them.
- Export everything for accountant handoff (CSV/Excel + PDF + attachments), including date range filtering.
- Clear pricing + trial + “how to get help” visible.

### Should-Haves (P1)

- Bank statement import (CSV upload at minimum) + semi-automatic matching to invoices/expenses.
- Simple tax/summary views relevant to paušalni obrt (what they need monthly/quarterly/yearly).
- “Your accountant mode”: invite accountant user, or generate a shareable export package.

### Later (P2/P3)

- Full e-invoicing send/receive flow, fiscalization automation, advanced reporting, payroll.

---

## Gap Register (Tracking Template)

Use this table format for new items you discover:

| Area | Gap | Why it matters | Priority | Proposed fix | Definition of done |
|------|-----|----------------|----------|--------------|--------------------|
| Acquisition | No landing page | No one converts | P0 | Add marketing site | Live pages + analytics |

---

## Gaps by Area (Extensive)

### 1) Acquisition, Marketing Site, and Conversion (P0–P1)

**Gaps**

- Missing marketing/SEO pages (`/pricing`, `/features`, `/about`, `/contact`, `/security`, `/docs`, `/blog`).
- No search engine hygiene (`/robots.txt`, `/sitemap.xml`, proper metadata, canonical URLs).
- No conversion funnel: “Book a demo”, “Start trial”, “Talk to sales”, “WhatsApp/phone”.
- No “who is this for” clarity: paušalni obrt vs d.o.o. vs accountants vs retail POS.
- No trust anchors: company name/legal entity, address, VAT ID, support SLA, terms.

**What to add (minimum viable marketing site)**

- Homepage: pain → promise → proof → screenshots → CTA.
- “For” pages: `/for/pausalni-obrt`, `/for/dooo`, `/for/accountants`.
- Pricing: simple tiers aligned to modules; “start free trial”; transparent limits.
- Security/Privacy: plain-language summary + links to full policies.
- Contact + support: email, ticket form, phone, response time expectations.

**Definition of done**

- Public pages exist, non-404, and are linked from login page.
- Analytics + event tracking for signup and demo conversion.
- Single CTA path is obvious and frictionless.

---

### 2) Onboarding & Activation UX (P0–P1)

**Gaps**

- New users must not land in module-gated pages without context.
- Onboarding should be a “guided checklist” that ends with a real success moment.
- Any dead link (e.g., `/admin-login` surfaced in UI but 404 in prod) undermines trust.

**What “great onboarding” looks like**

- One path: “Create company” → “Add customer” → “Create invoice” → “Send” → “Mark paid” → “Export for accountant”.
- In-product help: examples, tooltips, templates, “why we ask for this”, and defaults.
- Data import helpers: import contacts from CSV, optionally from email signature or existing invoices.

**Definition of done**

- A user can reach first invoice sent in < 10 minutes without external help.
- App always provides a “next step” and never leaves user stuck.

---

### 3) Product Packaging, Pricing, Trials, Billing (P0–P1)

**Gaps**

- Without pricing and a trial story, you can’t convert strangers.
- Without a stable billing/subscription model, you can’t scale.

**What to decide**

- Plan tiers: “Starter (paušalni)”, “VAT & e-invoices”, “Team/ERP”.
- Limits: invoices/month, users, companies, storage, OCR scans, integrations.
- Add-ons: extra OCR credits, extra users, accountant seats.

**Operational necessities**

- In-app subscription management, invoices/receipts, VAT-compliant billing for FiskAI itself.
- Grace periods, dunning, failed payment recovery.

**Definition of done**

- A user can self-serve: trial → pay → continue without human intervention.

---

### 4) Core Invoicing (P0)

**Gaps to validate/close**

- Invoice numbering rules and configuration (per year, per premises/device, per series).
- Template customization: logo, bank details, language, footers, payment terms.
- Sending: email delivery, status tracking, re-send, bounce handling.
- Attachments: contracts, time sheets, supporting docs.
- Customer master data: OIB/VAT IDs, address validation, payment terms, currency.

**Definition of done**

- Invoices produced match what customers already do today (or better), without edge-case failures.

---

### 5) Expenses & “Background Accountant” Automation (P0–P1)

You already have a strong base (AI/OCR extraction + categorization), but to be a “background accountant” you need:

**Gaps**

- Clear user control: AI suggestions are explainable and reversible.
- Policy controls: opt-in/out for AI, retention rules for uploaded receipts, PII handling.
- Matching: expenses to bank transactions; vendor memory; recurring expenses.
- Auditability: who changed what, which AI suggested what, what was accepted.

**Definition of done**

- User can scan receipt → confirm → categorized expense saved in < 60 seconds.
- AI never silently changes financial truth without explicit user confirmation.

---

### 6) E-Invoicing + Fiskalizacija 2.0 Readiness (P0–P1)

Your docs/research are strong; the remaining risk is production-grade execution.

**Gaps**

- Real intermediary integration readiness: credentials, onboarding, sandbox testing, monitoring.
- EN 16931 compliance validation pipeline (schema + business rules).
- Receiving e-invoices: inbox, acceptance/rejection workflows, and archiving of original XML.
- 11-year archiving strategy (storage, immutability, export, retention, deletion rules where permitted).
- Evidence/proofs: compliance statements and customer-ready explanations.

**Definition of done**

- End-to-end tested flow in sandbox: send → fiscalize → deliver → receive statuses.
- User-facing explanation + logs for every failure reason (supportable).

---

### 7) Accounting Outputs for Paušalni Obrt (P0–P1)

This is the “serve the easiest ones completely” gap.

**Gaps (to confirm via domain research + accountant interviews)**

- The exact reports/forms a paušalni obrt expects from software (yearly/monthly summaries, exports).
- A simple workflow for income/expense tracking aligned to how they report.
- A “tax season pack” export that accountants can consume quickly.

**Definition of done**

- A paušalni obrt user can run their business and hand off compliant exports with minimal accountant back-and-forth.

---

### 8) Security, Privacy, and Trust Center (P0)

Users won’t entrust accounting data without clear safety signals.

**Gaps**

- Policies: Privacy, Terms, DPA, cookie policy, AI data policy.
- Security posture: encryption, access control, admin access, logging, backups, incident response.
- User rights: data export and deletion request flows (GDPR), account closure.
- Authentication hardening: rate limits, lockouts, MFA/passkeys UX, recovery flows.

**Trust center contents (minimum)**

- What data is stored, where, and for how long.
- Who can access it (including internal admin/support) and under what controls.
- How to export and delete data.
- Uptime + status page link.

**Definition of done**

- Customers can read a plain-language trust page and feel safe proceeding.

---

### 9) Reliability, Backups, and Observability (P0–P1)

Accounting software is “mission critical”.

**Gaps**

- Backup policy: frequency, retention, encryption, restore drills.
- Monitoring: uptime, latency, DB health, queue health, email delivery, 3rd party providers.
- Error tracking: actionable alerts, runbooks, on-call procedures.
- Data migration strategy: safe schema changes, per-tenant isolation, rollback plan.

**Definition of done**

- You can restore production from backups reliably and you have evidence (drills).

---

### 10) Support, Success, and Operations (P0–P1)

First customers will have questions; support quality becomes your moat.

**Gaps**

- In-app help center + searchable docs + “how to do X” guides.
- Support channels: ticketing, chat, SLA, escalation path.
- Guided onboarding: concierge setup for first 10 customers.
- Admin tooling: impersonation (with audit), tenant health, ability to fix data safely.

**Definition of done**

- Every “stuck” moment has a visible help path and the team can resolve issues quickly.

---

### 11) Integrations (P1–P2)

Customers already have data elsewhere.

**Gaps**

- Import contacts/products/invoices from CSV/Excel.
- Export accounting packs (CSV/XML/PDF + attachments).
- Bank imports (CSV first; later PSD2/open banking).
- Email delivery provider + DKIM/SPF/DMARC configured.

**Definition of done**

- A customer can migrate in within 1–2 hours, not days.

---

### 12) UX/Design Polish & Mobile (P1–P2)

The UI foundation looks modern; gaps are mostly conversion and guidance.

**Gaps**

- Stronger “what happens next” guidance in every module.
- Empty states that teach.
- Reduce jargon; explain Croatian compliance terms with tooltips.
- Mobile-first for receipt capture and quick actions.

**Definition of done**

- Users understand what to do without training.

---

### 13) Data Model & Multi-Tenancy Hardening (P0–P2)

Multi-tenancy is a major risk area if any query leaks data across companies.

**Gaps**

- Tenant safety guarantees everywhere (middleware, DB constraints, tests).
- Per-tenant audit logs for every financial mutation.
- Access control model: roles (owner/admin/accountant/employee), least privilege.

**Definition of done**

- Automated tests enforce tenant isolation for all core queries and mutations.

---

### 14) AI-Specific Product Gaps (P0–P2)

To credibly be “AI-first”, the AI must be safe, predictable, and measurable.

**Gaps**

- Clear UX contract: AI suggests; user decides; audit trail records.
- Cost controls: per-tenant budgets, rate limiting, usage meters, fallbacks.
- Quality controls: evaluation set, regression checks, “report bad extraction”.
- Privacy controls: redaction, minimize data sent to providers, retention policy.

**Definition of done**

- AI features are optional, explainable, and never break core workflows.

---

## 30/60/90 Day Recommended Roadmap (Suggested)

### Next 30 Days (P0 heavy)

- Launch marketing site + pricing + contact + policies.
- Fix dead links and first-run flow to ensure first “success moment”.
- Build exports (accountant handoff pack) and improve onboarding checklist.
- Establish backups + monitoring basics + error tracking and runbooks.

### 60 Days (P1)

- Bank CSV import + basic reconciliation.
- Improve invoices: templates, email delivery robustness, reminders.
- Add accountant collaboration (seat or export).
- Begin intermediary sandbox integration hardening for e-invoices.

### 90 Days (P1/P2)

- Receiving e-invoices inbox + archive story + compliance validation.
- Expand reporting/tax summaries for paušalni + VAT users.
- Improve admin/support tooling and documentation depth.

---

## Open Questions (Answer These Before Building Too Much)

- What exact “first ICP” will you target first: service paušalni obrt, VAT d.o.o., trade/retail, agencies?
- Do you want to **replace accountants** or **collaborate with them** initially (most customers will want collaboration first)?
- What is your pricing philosophy: per-company, per-invoice, per-user, per-module?
- How will you handle 11-year archiving and customer exports in a provable way?
- What AI data is allowed to leave your system, and is it opt-in by default?

---

## Next Actions (Suggested)

- Convert this doc into tracked issues (GitHub/Jira/Linear) starting from the P0 list.
- Define “first success moment” for paušalni obrt and instrument it (analytics).
- Run 10 structured interviews (5 paušalni obrt, 3 accountants, 2 VAT d.o.o.) and update the “paušalni outputs” section with exact needs.

