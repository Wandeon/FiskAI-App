# FiskAI Module Analysis & Strategic Roadmap

**Generated:** 2024-12-14
**Purpose:** Map current implementation to client needs and prioritize development

---

## The Module Matrix vs Current Implementation

| Module                 | What it does               | Paušalni     | Obrt (Dohodak) | d.o.o.       | **Current Status**   |
| ---------------------- | -------------------------- | ------------ | -------------- | ------------ | -------------------- |
| 1. CORE: Invoicing     | PDF, Barcode 2D, Email     | ✅           | ✅             | ✅           | **80% Complete**     |
| 2. CORE: Fiscalization | CIS connection             | ✅ (If cash) | ✅ (If cash)   | ✅ (If cash) | **60% Complete**     |
| 3. TRACK: KPR          | Knjiga Prometa             | ✅           | ❌             | ❌           | **100% Complete** ✅ |
| 4. TRACK: KPI          | Knjiga Primitaka/Izdataka  | ❌           | ✅             | ❌           | **0% - NOT STARTED** |
| 5. REPORT: PO-SD       | Annual tax form (Paušalni) | ✅           | ❌             | ❌           | **100% Complete** ✅ |
| 6. REPORT: PDV         | VAT forms (PDV, PDV-S, ZP) | ❌           | ✅ (If VAT)    | ✅           | **40% Partial**      |
| 7. REPORT: JOPPD       | Payroll & Non-taxable      | ❌           | ✅             | ✅           | **0% - NOT STARTED** |
| 8. URA/IRA             | Invoice Books              | ❌           | ✅             | ✅           | **30% Partial**      |
| 9. TRAVEL: Locco       | Putni Nalozi, km tracking  | Optional     | Optional       | Optional     | **0% - NOT STARTED** |
| 10. ASSETS: DI         | Dugotrajna Imovina         | ❌           | ✅             | ✅           | **0% - NOT STARTED** |

---

## Client Readiness Analysis

### 🟢 Paušalni Obrt - **READY FOR BETA**

Required modules: Invoicing, KPR, PO-SD, Fiscalization (if cash)

| Module        | Status  | Notes                                           |
| ------------- | ------- | ----------------------------------------------- |
| Invoicing     | ✅ 80%  | PDF works, email works, 2D barcode works        |
| KPR           | ✅ 100% | Full implementation with CSV export             |
| PO-SD         | ✅ 100% | XML generation for ePorezna, tax calculation    |
| Fiscalization | ⚠️ 60%  | Mock + IE-Računi ready, needs FINA cert support |

**Verdict:** Can launch for Paušalni clients who don't need cash fiscalization, or use IE-Računi.

---

### 🟡 Obrt (Dohodak) - **40% READY**

Required modules: Invoicing, KPI, URA/IRA, Assets, JOPPD, PDV (if VAT), Fiscalization (if cash)

| Module        | Status | Blocker?                         |
| ------------- | ------ | -------------------------------- |
| Invoicing     | ✅ 80% | No                               |
| KPI           | ❌ 0%  | **YES - Critical**               |
| URA/IRA       | ⚠️ 30% | **YES - Needs report generator** |
| Assets (DI)   | ❌ 0%  | **YES - Critical**               |
| JOPPD         | ❌ 0%  | YES - If has employees           |
| PDV           | ⚠️ 40% | YES - If VAT registered          |
| Fiscalization | ⚠️ 60% | If cash                          |

**Verdict:** Cannot serve Obrt Dohodak clients yet. Missing KPI, URA/IRA reports, and Asset tracking.

---

### 🔴 d.o.o. / j.d.o.o. - **35% READY**

Required modules: Invoicing, URA/IRA, Assets, Travel, PDV, JOPPD, Fiscalization (if cash)

| Module         | Status | Blocker?                      |
| -------------- | ------ | ----------------------------- |
| Invoicing      | ✅ 80% | No                            |
| URA/IRA        | ⚠️ 30% | **YES - Critical**            |
| Assets (DI)    | ❌ 0%  | **YES - Critical**            |
| Travel (Locco) | ❌ 0%  | YES - Premium feature         |
| PDV            | ⚠️ 40% | **YES - Critical for d.o.o.** |
| JOPPD          | ❌ 0%  | YES - If has employees        |
| Fiscalization  | ⚠️ 60% | If cash                       |

**Verdict:** Cannot serve d.o.o. clients yet. Missing URA/IRA, Assets, full PDV, and JOPPD.

---

## Detailed Gap Analysis

### 1. CORE: Invoicing (80% Complete)

**What Works:**

- Invoice CRUD with line items and VAT
- PDF generation with React-PDF
- 2D Barcode (EPC QR for SEPA payments)
- Email sending via Resend
- Quote → Invoice conversion
- Credit/Debit notes
- E-Invoice (UBL format)
- Invoice numbering (Croatian format)

**What's Missing:**

- [ ] Verify PDF download API works in production
- [ ] Email delivery confirmation tracking
- [ ] "Not in VAT system" clause auto-addition for non-VAT

**Priority:** LOW - Mostly polish

---

### 2. CORE: Fiscalization (60% Complete)

**What Works:**

- ZKI calculation (SHA256 demo, RSA production-ready)
- JIR generation
- Mock provider for development
- IE-Računi provider template
- Business premises & payment device management
- Status tracking (PENDING → FISCALIZED)

**What's Missing:**

- [ ] **FINA certificate upload & storage** (Critical)
- [ ] **Direct CIS connection** (vs. going through IE-Računi)
- [ ] Certificate password encryption
- [ ] Production CIS sandbox testing
- [ ] Retry mechanism for failed fiscalization

**Priority:** MEDIUM - IE-Računi works for now

---

### 3. TRACK: KPR (100% Complete) ✅

**What Works:**

- Full KPR report generation from fiscalized invoices
- VAT breakdown by rate
- Monthly/daily summaries
- CSV export
- Payment method tracking

**Priority:** NONE - Done

---

### 4. TRACK: KPI (0% - NOT STARTED) 🔴

**What's Needed:**

- [ ] "Knjiga Primitaka" (Income Book) - from issued invoices
- [ ] "Knjiga Izdataka" (Expense Book) - from expenses
- [ ] Combined KPI report generation
- [ ] Payment method categorization
- [ ] Date-based filtering
- [ ] Running totals
- [ ] CSV/XML export
- [ ] Tax authority format compliance

**Foundation Available:**

- Expense model exists with categories
- Invoice model with payment tracking
- Bank transaction matching

**Priority:** HIGH - Blocks Obrt Dohodak clients

---

### 5. REPORT: PO-SD (100% Complete) ✅

**What Works:**

- Annual tax return calculation
- Progressive tax brackets (12%, 20%, 30%)
- Social contributions
- Quarterly summaries
- XML generation for ePorezna

**Priority:** NONE - Done

---

### 6. REPORT: PDV (40% Partial)

**What Works:**

- VAT threshold tracking (40,000 EUR)
- Basic VAT summary
- VAT calculation by rate

**What's Missing:**

- [ ] **PDV-RR form** (quarterly VAT return)
- [ ] **PDV-S form** (simplified quarterly)
- [ ] **ZP form** (VAT exemption)
- [ ] Invoice-level VAT breakdown
- [ ] Input vs Output VAT calculation
- [ ] XML export for ePorezna
- [ ] VAT recovery tracking (from expenses)

**Priority:** HIGH - Critical for d.o.o. and VAT-registered Obrt

---

### 7. REPORT: JOPPD (0% - NOT STARTED) 🔴

**What's Needed:**

- [ ] Employee/payroll data model
- [ ] Salary calculation with contributions
- [ ] JOPPD form generation (A, B pages)
- [ ] Non-taxable receipts tracking (travel, per-diem)
- [ ] Monthly submission tracking
- [ ] XML generation for ePorezna

**Priority:** MEDIUM - Only needed for businesses with employees

---

### 8. URA/IRA (30% Partial)

**What Works:**

- Invoice direction tracking (INBOUND/OUTBOUND)
- Inbound e-invoice receipt
- Unified document querying

**What's Missing:**

- [ ] **URA report generator** (Incoming Invoice Book)
- [ ] **IRA report generator** (Outgoing Invoice Book)
- [ ] Monthly summaries by supplier/customer
- [ ] VAT recovery calculation
- [ ] Tax authority format (columns: date, number, supplier, base, VAT...)
- [ ] CSV/XML export

**Priority:** HIGH - Critical for Obrt Dohodak and d.o.o.

---

### 9. TRAVEL: Locco (0% - NOT STARTED) 🔴

**What's Needed:**

- [ ] Travel Order (Putni Nalog) model
- [ ] Travel order creation workflow
- [ ] KM distance tracking (2€/km deductible)
- [ ] Per-diem calculation
- [ ] Destination tracking
- [ ] Approval workflow
- [ ] Travel expense integration
- [ ] Vehicle tracking (company vs private)
- [ ] Monthly travel summary

**Priority:** LOW - Premium feature, optional for all client types

---

### 10. ASSETS: DI (0% - NOT STARTED) 🔴

**What's Needed:**

- [ ] Fixed Asset model (name, purchase date, value, category)
- [ ] Asset categories (vehicles, equipment, furniture, IT)
- [ ] Useful life tracking (by category)
- [ ] Depreciation methods:
  - [ ] Straight-line (most common)
  - [ ] Declining balance
- [ ] Monthly depreciation calculation
- [ ] Asset disposal tracking
- [ ] Tax depreciation vs Accounting depreciation
- [ ] Asset register report
- [ ] Depreciation schedule export

**Priority:** HIGH - Critical for Obrt Dohodak and d.o.o.

---

## Recommended Development Roadmap

### Phase 1: Paušalni Polish (Current Sprint)

**Goal:** Launch-ready for Paušalni Obrt

- [ ] Verify invoicing end-to-end (PDF download, email)
- [ ] Test IE-Računi fiscalization in production
- [ ] Add "Not in VAT" invoice clause
- [ ] Polish onboarding for Paušalni path
- **Timeline:** 1-2 weeks

### Phase 2: URA/IRA + KPI (Next Sprint)

**Goal:** Unlock Obrt Dohodak

- [ ] Build URA/IRA report generators
- [ ] Build KPI (Knjiga Primitaka/Izdataka)
- [ ] Link expenses to KPI
- [ ] Add CSV/XML export
- **Timeline:** 2-3 weeks

### Phase 3: Assets (DI)

**Goal:** Complete Obrt Dohodak, start d.o.o.

- [ ] Build Fixed Asset module
- [ ] Implement depreciation calculation
- [ ] Build asset register UI
- [ ] Integrate with expenses (asset purchases)
- **Timeline:** 2 weeks

### Phase 4: Full PDV Forms

**Goal:** Complete d.o.o. requirements

- [ ] Build PDV-RR form generator
- [ ] Build PDV-S form generator
- [ ] Input/Output VAT calculation
- [ ] XML export for ePorezna
- **Timeline:** 2 weeks

### Phase 5: Premium Features (JOPPD + Travel)

**Goal:** Premium tier for d.o.o.

- [ ] JOPPD form generation
- [ ] Travel order module (Locco)
- [ ] Employee/payroll basics
- **Timeline:** 4-6 weeks

---

## Onboarding Flow Recommendation

Current onboarding asks basic company info. Should be enhanced to:

### Question 1: Legal Form?

```
[A] Paušalni Obrt     → Enable: Invoicing, KPR, PO-SD
[B] Obrt (Dohodak)    → Enable: Invoicing, KPI, URA/IRA, Assets
[C] d.o.o. / j.d.o.o. → Enable: Invoicing, URA/IRA, Assets, Travel
```

### Question 2: Are you in VAT (PDV)?

```
[Yes] → Enable: PDV module, add VAT column to invoices
[No]  → Disable: PDV module, add "Nije u sustavu PDV-a" to invoices
```

### Question 3: Do you take Cash?

```
[Yes] → Enable: Fiscalization (prompt for IE-Računi or FINA cert)
[No]  → Disable: Fiscalization, hide cash payment options
```

---

## Conclusion

**Current State:** FiskAI is ~90% ready for Paušalni clients and ~40% ready for other client types.

**Biggest Gaps:**

1. KPI (Knjiga Primitaka/Izdataka) - Blocks Obrt Dohodak
2. URA/IRA Reports - Blocks Obrt Dohodak and d.o.o.
3. Assets (DI) - Blocks Obrt Dohodak and d.o.o.
4. Full PDV Forms - Blocks d.o.o.

**Quick Wins:**

1. Launch for Paušalni-only with current features
2. Add URA/IRA reports (mostly formatting existing data)
3. KPI is similar to KPR, can reuse logic

**Revenue Path:**

- Month 1: Paušalni clients (simplest, widest audience)
- Month 3: Add Obrt Dohodak (KPI + URA/IRA + Assets)
- Month 6: Add d.o.o. (Full PDV + JOPPD + Travel)
