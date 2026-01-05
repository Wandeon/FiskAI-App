# FiskAI Sales Doctrine

> **Version:** 1.0.0
> **Date:** 2026-01-05
> **Status:** Reality-Audited
>
> This document defines what FiskAI can sell today based on actual implementation status.

---

## Executive Summary

FiskAI is a Croatian business compliance platform targeting paušalni obrt owners, with expansion capability to other business types. The platform provides invoicing, e-invoicing, fiscalization, banking, and regulatory compliance features.

---

## Target Market Prioritization

### Tier 1: Primary Target (Launch-Ready)

**Paušalni Obrt (Freelancers & Small Sole Proprietors)**

- Revenue: < 60,000 EUR/year
- No VAT registration required
- Simple compliance: KPR + PO-SD annual form
- Cash payments optional

**Why Tier 1:**

- ✅ Pausalni module fully implemented (95%)
- ✅ KPR (daily sales log) complete
- ✅ Contribution tracking implemented
- ✅ E-invoicing via ePoslovanje v2 production-ready
- ✅ Fiscalization 60% (needs cert upload polish)

### Tier 2: Secondary Target (Near-Ready)

**Obrt na Dohodak (Income-Based Sole Proprietors)**

- Revenue: 60k - 150k EUR/year
- May or may not be VAT registered
- Requires: KPI (income/expense book), URA/IRA

**Why Tier 2:**

- ⚠️ KPI not implemented (0%)
- ⚠️ URA/IRA partial (30%)
- ✅ Banking and expense tracking implemented

### Tier 3: Future Target (Not Ready)

**D.O.O. / J.D.O.O. (Limited Liability Companies)**

- Double-entry accounting required
- Corporate tax calculations
- Full VAT compliance

**Why Tier 3:**

- ❌ Corporate tax module planned only (10%)
- ❌ URA/IRA incomplete
- ❌ Asset registry not implemented
- ❌ General Ledger not implemented

---

## Product Capabilities by Status

### Fully Implemented (Ready to Sell)

| Capability          | Module        | Evidence                        |
| ------------------- | ------------- | ------------------------------- |
| Invoice Creation    | invoicing     | `/src/app/(app)/invoices/`      |
| E-Invoice (UBL/XML) | e-invoicing   | ePoslovanje v2 production       |
| Contact Management  | contacts      | CRUD + OIB lookup               |
| Product Catalog     | products      | Pricing + variants              |
| Expense Tracking    | expenses      | Categories + recurring          |
| Document Storage    | documents     | Cloudflare R2 + 11-year archive |
| Basic Reports       | reports-basic | KPR, aging, P&L                 |
| Bank Import         | banking       | GoCardless PSD2 + CSV formats   |
| Pausalni Management | pausalni      | Contributions, tax brackets     |
| AI Assistant        | ai-assistant  | Chat + extraction               |

### Partially Implemented (Sell with Caveats)

| Capability       | Status | Gap                    |
| ---------------- | ------ | ---------------------- |
| Fiscalization    | 60%    | Certificate upload UX  |
| VAT Module       | 40%    | Submissions incomplete |
| Reports-Advanced | 40%    | PDV forms incomplete   |
| POS/Terminal     | 30%    | Stripe Terminal WIP    |
| Reconciliation   | 75%    | AI matching needed     |

### Not Yet Implemented (Do Not Sell)

| Capability     | Status | Reason            |
| -------------- | ------ | ----------------- |
| Corporate Tax  | 10%    | Calculations only |
| Asset Registry | 0%     | Not started       |
| KPI Book       | 0%     | Not started       |
| URA/IRA        | 30%    | Incomplete        |
| JOPPD Payroll  | 0%     | Not started       |

---

## Pricing Tiers

### Current Production Tiers

| Tier             | Price     | Target         | Modules Included                                                  |
| ---------------- | --------- | -------------- | ----------------------------------------------------------------- |
| **Free**         | 0 EUR     | Evaluation     | Invoicing, Contacts, Products, Expenses, Basic Reports, Documents |
| **Starter**      | 9 EUR/mo  | Paušalni basic | Free + Banking                                                    |
| **Professional** | 39 EUR/mo | Paušalni full  | Starter + Pausalni, Fiscalization, AI Assistant                   |
| **Enterprise**   | Custom    | Multi-user     | Professional + Staff assignments, Advanced Reports                |

### Module-to-Tier Matrix

| Module           | Free | Starter | Pro | Enterprise |
| ---------------- | ---- | ------- | --- | ---------- |
| platform-core    | ✅   | ✅      | ✅  | ✅         |
| invoicing        | ✅   | ✅      | ✅  | ✅         |
| e-invoicing      | ✅   | ✅      | ✅  | ✅         |
| contacts         | ✅   | ✅      | ✅  | ✅         |
| products         | ✅   | ✅      | ✅  | ✅         |
| expenses         | ✅   | ✅      | ✅  | ✅         |
| documents        | ✅   | ✅      | ✅  | ✅         |
| reports-basic    | ✅   | ✅      | ✅  | ✅         |
| banking          | -    | ✅      | ✅  | ✅         |
| pausalni         | -    | -       | ✅  | ✅         |
| fiscalization    | -    | -       | ✅  | ✅         |
| ai-assistant     | -    | -       | ✅  | ✅         |
| reconciliation   | -    | -       | -   | ✅         |
| reports-advanced | -    | -       | -   | ✅         |

---

## Sales Positioning

### Value Proposition

**For Paušalni Obrt:**

> "Spend 1-2 hours per month on compliance, not 5-10. Know your VAT threshold status, never miss a contribution payment, generate your annual PO-SD with one click."

**Key Differentiators:**

1. **Regulatory Truth Layer** - Automated compliance updates from 60+ Croatian sources
2. **ePoslovanje Integration** - Production e-invoicing, not just PDF generation
3. **Paušalni-First Design** - Purpose-built for the most common Croatian business type
4. **Fair Pricing** - Free tier with real functionality, paid tiers under 40 EUR/month

### Competitive Landscape

| Competitor | Strength        | FiskAI Advantage             |
| ---------- | --------------- | ---------------------------- |
| Minimax    | Market leader   | Paušalni-specific, modern UX |
| Reviso     | Full accounting | Lower price, faster setup    |
| Excel      | Free            | Compliance automation        |

---

## Sales Qualification Checklist

Before closing a deal, confirm:

| Question                       | For Tier                  |
| ------------------------------ | ------------------------- |
| "Are you a paušalni obrt?"     | All                       |
| "Do you accept cash payments?" | Pro (needs fiscalization) |
| "Are you VAT registered?"      | Disqualify for now if yes |
| "Do you have employees?"       | Disqualify for now if yes |
| "Revenue under 60k EUR?"       | Must be yes for paušalni  |

### Disqualification Criteria (v1.0)

Do NOT sell to prospects who:

- Need full VAT compliance (PDV forms, URA/IRA)
- Have employees (JOPPD payroll)
- Are d.o.o./j.d.o.o. needing corporate tax
- Need asset depreciation tracking
- Need KPI income/expense book

---

## Support Boundaries

### What We Support

- Invoice creation and sending
- E-invoice via ePoslovanje
- Bank statement import (CSV, CAMT.053)
- Expense categorization
- Contribution calculations
- KPR daily sales log
- Basic reports (aging, P&L)

### What We Don't Support (Yet)

- Full VAT reporting and submissions
- Corporate tax calculations
- Employee payroll (JOPPD)
- Asset registry and depreciation
- Double-entry accounting
- Multi-company staff workspace

---

## Roadmap for Sales Expansion

### Q1 2026: Obrt Dohodak Ready

- Complete URA/IRA
- Implement KPI book
- Add DOH form generation

### Q2 2026: VAT Ready

- Complete PDV forms
- VAT submissions
- EU reverse charge

### Q3 2026: D.O.O. Ready

- Corporate tax module
- Asset registry
- General Ledger foundation

---

## Document History

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| 1.0.0   | 2026-01-05 | Initial creation from codebase audit |
