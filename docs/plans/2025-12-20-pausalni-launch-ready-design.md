# Paušalni Launch-Ready Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation tasks from this design.

**Goal:** Make FiskAI ready for first Paušalni Obrt customers with complete onboarding, guidance, compliance demonstration, and admin visibility.

**Timeline:** 6+ weeks (Premium Launch)

**Target Users:** Paušalni Obrt (mix of cash and non-cash businesses)

---

## Design Decisions Summary

| Aspect         | Decision                                                        |
| -------------- | --------------------------------------------------------------- |
| **Target**     | Paušalni Obrt (cash + non-cash mix)                             |
| **Compliance** | Full transparency: badges, live dashboard, onboarding checklist |
| **Admin**      | Complete health dashboard: funnel, compliance, support          |
| **Tutorials**  | Inline help + structured tracks, competence-aware               |
| **Timeline**   | 6+ weeks premium launch                                         |

---

## Section 1: Compliance Demonstration System

### 1.1 Compliance Badges (Passive Trust)

- Footer badge: "Fiskalizacija 2.0 Certificirano" with FINA logo
- Dashboard card: Real-time compliance status indicator
- Invoice PDF: QR code + "Ovaj račun je prijavljen Poreznoj upravi"
- Settings page: Links to official Porezna/FINA documentation

### 1.2 Live Compliance Dashboard (`/compliance`)

- **Certificate Status:** Valid until date, days remaining, renewal alert
- **Fiscalization Stats:** Total invoices fiscalized, success rate, last sync
- **JIR Verification:** Click any invoice → see JIR/ZKI codes → link to verify on Porezna portal
- **Audit Trail:** Timestamped log of all fiscal communications

### 1.3 Compliance Onboarding Checklist

For cash businesses:

```
□ Upload FINA certificate (.p12 file)
□ Enter certificate password
□ Register business premises (Poslovni prostor)
□ Test fiscalization (sandbox mode)
✓ Ready for live invoicing
```

Each step has inline explanation of WHY it's required legally.

---

## Section 2: Paušalni Profile Setup (Step 5)

### 2.1 Auto-Fill from Postal Code

- Municipality (Općina)
- County (Županija)
- Surtax rate (Prirez)

### 2.2 Situation Questions

| Question            | Options | Implication               |
| ------------------- | ------- | ------------------------- |
| Cash/card payments? | Da/Ne   | Triggers fiscal cert flow |
| Employees?          | Da/Ne   | JOPPD module needed       |
| Employed elsewhere? | Da/Ne   | MIO exemption applies     |
| EU PDV-ID?          | Da/Ne   | Reverse charge mechanism  |

### 2.3 Tax Bracket Selection

From official Rješenje or estimate:

| Tier | Revenue Range (EUR) | Quarterly Tax |
| ---- | ------------------- | ------------- |
| 1    | 0 - 11,300          | 50.85 EUR     |
| 2    | 11,300 - 15,300     | 68.85 EUR     |
| 3    | 15,300 - 19,900     | 89.55 EUR     |
| 4    | 19,900 - 30,600     | 137.70 EUR    |
| 5    | 30,600 - 40,000     | 180.00 EUR    |
| 6    | 40,000 - 50,000     | 225.00 EUR    |
| 7    | 50,000 - 60,000     | 270.00 EUR    |

_Source: `TAX_RATES.pausal.brackets` from `/src/lib/fiscal-data/data/tax-rates.ts`_

### 2.4 Live Yearly Expense Preview

Shows based on answers:

| Obligation        | Checkbox | Annual Amount          |
| ----------------- | -------- | ---------------------- |
| MIO I (15%)       | [✓]      | Calculated from base   |
| MIO II (5%)       | [✓]      | Calculated from base   |
| HZZO (16.5%)      | [✓]      | Calculated from base   |
| Porez (from tier) | [✓]      | From bracket selection |
| Prirez            | [✓]      | % of porez             |
| HOK               | [✓]      | 136.80 EUR             |
| TZ                | [ ]      | ~0.085% of revenue     |

**All values from `/src/lib/fiscal-data/` - no hardcoding**

### 2.5 Paid Module Upsell

> "📈 **FiskAI Pro:** Praćenje prihoda u realnom vremenu, projekcije razreda, optimizacija poreza"

---

## Section 3: Competence-Based Tutorial System

### 3.1 Competence Levels

| Level      | Croatian      | UI Behavior                                           |
| ---------- | ------------- | ----------------------------------------------------- |
| `beginner` | Početnik      | Max help: tooltips everywhere, step-by-step, warnings |
| `average`  | Prosječan     | Balanced: key hints, optional expansion               |
| `pro`      | Profesionalac | Minimal: clean UI, advanced shortcuts visible         |

### 3.2 Help Density by Competence

| Element              | Beginner   | Average          | Pro            |
| -------------------- | ---------- | ---------------- | -------------- |
| Field tooltips       | All fields | Key fields       | None           |
| Action confirmations | Always     | Destructive only | Never          |
| Success explanations | Detailed   | Brief            | Toast only     |
| Keyboard shortcuts   | Hidden     | Shown on hover   | Always visible |

### 3.3 Structured Tutorial Track: "Paušalni First Week"

```
Day 1: Kontakti
├── [ ] Dodaj prvog kupca
├── [ ] Razumij OIB validaciju
└── [ ] Uvezi kontakte iz CSV (optional)

Day 2: Proizvodi/Usluge
├── [ ] Dodaj svoju glavnu uslugu
├── [ ] Postavi cijenu i PDV status
└── [ ] Razumij "bez PDV-a" za paušalce

Day 3: Prvi račun
├── [ ] Kreiraj račun za kupca
├── [ ] Pregledaj PDF preview
├── [ ] Pošalji e-mailom ili preuzmi
└── [ ] Razumij KPR unos

Day 4: KPR i PO-SD
├── [ ] Otvori Knjiga primitaka
├── [ ] Razumij running total vs 60k
├── [ ] Pregledaj PO-SD wizard
└── [ ] Postavi podsjetnik za 15.1.

Day 5: Doprinosi i rokovi
├── [ ] Pregledaj kalendar obveza
├── [ ] Razumij MIO/HZZO/HOK
├── [ ] Generiraj uplatnicu (Hub3)
└── [ ] Poveži s Google kalendarom (optional)
```

### 3.4 Progress Widget

Dashboard shows completion status with "Nastavi" CTA.

### 3.5 Context-Sensitive Triggers

| User Action           | Help Response                             |
| --------------------- | ----------------------------------------- |
| First invoice created | "Vaš račun je automatski upisan u KPR!"   |
| Approaching 60k       | Warning banner + "Što učiniti?" guide     |
| Missed deadline       | "Propustili ste rok" + late payment guide |
| First bank import     | "Povežite uplate s računima" tutorial     |

---

## Section 4: Fiskalizacija 2.0 Compliance Architecture

### 4.1 What FiskAI Already Has (✅)

| Component                 | Location                                  |
| ------------------------- | ----------------------------------------- |
| FINA Certificate handling | `src/lib/fiscal/certificate-parser.ts`    |
| XML Builder (CIS format)  | `src/lib/fiscal/xml-builder.ts`           |
| XML Signing               | `src/lib/fiscal/xml-signer.ts`            |
| Porezna CIS submission    | `src/lib/fiscal/porezna-client.ts`        |
| JIR/ZKI storage           | `src/lib/fiscal/fiscal-pipeline.ts`       |
| EN16931 Validator         | `src/lib/compliance/en16931-validator.ts` |
| UBL Generator             | `src/lib/e-invoice/ubl-generator.ts`      |
| Business Premises         | `FiscalPremises` type                     |
| Payment Devices           | `FiscalDevice` type                       |

### 4.2 Fiskalizacija 2.0 New Requirements (Jan 2026)

| Requirement                 | FiskAI Status             |
| --------------------------- | ------------------------- |
| B2B E-Invoicing             | ⚠️ Ready (UBL exists)     |
| Bank Transfer Fiscalization | 🚧 Needs update           |
| EN16931 Compliance          | ✅ Validator exists       |
| KPD 2025 Codes              | ❌ Not implemented        |
| QR Code on Invoice          | ⚠️ Partial                |
| Peppol Network              | ❌ Planned                |
| Digital Archive             | ✅ Archive manager exists |

### 4.3 Customer-Facing Compliance Dashboard

New `/compliance` page showing:

- FINA Certificate status (active, expiring, expired)
- Business premises registration
- Fiscalization statistics (count, success rate, timing)
- Recent fiscalized invoices with JIR verification links

### 4.4 QR Code on Invoice PDF

Every fiscalized invoice includes:

- QR code linking to Porezna verification
- JIR (Jedinstveni Identifikator Računa)
- ZKI (Zaštitni Kod Izdavatelja)
- Scan instruction text

### 4.5 Fiscal Setup Checklist (for cash businesses)

```
□ Korak 1: Nabavite FINA certifikat (fina.hr)
□ Korak 2: Učitajte certifikat u FiskAI
□ Korak 3: Registrirajte poslovni prostor
□ Korak 4: Testirajte u sandbox modu
✅ Spremni za produkciju!
```

---

## Section 5: Admin Customer Health Dashboard

### 5.1 Dashboard Overview (`/admin`)

**Key Metrics Cards:**

- Total Tenants
- Active Subscriptions
- This Week Signups
- Need Help (flagged)

**Onboarding Funnel:**

- Started → Step 2 → Step 3 → Step 4 → Completed → 1st Invoice
- Drop-off percentage at each step

**Compliance Health:**

- Certificates: Active / Expiring / Missing
- Fiscalized today / Success rate

### 5.2 Customers Needing Attention

**Automatic Flags:**

- ⚠️ Approaching 60k limit (85%+)
- 🔴 Stuck in onboarding (>7 days)
- 🔴 Fiscal certificate issues
- 📧 Open support tickets

### 5.3 Tenant Detail View (`/admin/tenants/[id]`)

- Profile (OIB, legal form, VAT status)
- Subscription (plan, status, MRR)
- Owner info (email, last login)
- Modules enabled
- Health metrics (onboarding, tutorial progress, competence)
- 60k limit tracker with projection
- Activity last 30 days
- Admin actions (email, gift module, export, flag)

### 5.4 Alert System

| Trigger                  | Alert | Auto-Action          |
| ------------------------ | ----- | -------------------- |
| Onboarding stuck >7 days | 🔴    | Queue reminder email |
| 85% of 60k limit         | ⚠️    | Send threshold guide |
| 95% of 60k limit         | 🔴    | Urgent outreach      |
| Cert expires <30 days    | ⚠️    | Send renewal notice  |
| Cert expired             | 🔴    | Block fiscalization  |
| No login >30 days        | ⚠️    | Re-engagement email  |
| Support ticket >24h      | 🔴    | Escalate to priority |

### 5.5 Weekly Admin Digest

Automated email with:

- New customers & conversion
- Revenue (MRR, churn, upgrades)
- Compliance stats
- Support metrics
- Action items

---

## Implementation Priority

### Phase 1: Core Flows (Weeks 1-2)

- Step 5 Paušalni Profile with live expense calculator
- Tutorial track "Paušalni First Week"
- Inline help by competence level

### Phase 2: Compliance (Weeks 3-4)

- `/compliance` dashboard
- QR code on invoice PDFs
- Fiscal setup checklist
- Certificate status monitoring

### Phase 3: Admin Visibility (Weeks 5-6)

- Admin dashboard redesign
- Tenant detail view
- Alert system
- Weekly digest automation

### Phase 4: Polish (Week 6+)

- Edge case handling
- Performance optimization
- User testing feedback

---

## Data Sources

All fiscal values from `/src/lib/fiscal-data/`:

| Data               | File                      |
| ------------------ | ------------------------- |
| Contribution rates | `data/contributions.ts`   |
| Tax brackets       | `data/tax-rates.ts`       |
| Thresholds         | `data/thresholds.ts`      |
| Chamber fees       | `data/chamber-fees.ts`    |
| Deadlines          | `data/deadlines.ts`       |
| Payment details    | `data/payment-details.ts` |

---

## References

- [Croatia Fiscalization 2.0](https://www.fiscal-requirements.com/news/3656)
- [EU eInvoicing Croatia](https://ec.europa.eu/digital-building-blocks/sites/spaces/einvoicingCFS/pages/881983568/2025+Croatia+2025+eInvoicing+Country+Sheet)
- [QR Code Verification](https://www.fiscal-requirements.com/news/1739)

---

**Design Status:** Approved
**Next Step:** Create implementation plan with superpowers:writing-plans
