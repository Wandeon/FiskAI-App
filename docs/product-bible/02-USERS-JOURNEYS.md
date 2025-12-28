# Users & Journeys

[← Back to Index](./00-INDEX.md)

> **Last Updated:** 2025-12-28
> **Version:** 2.1.0

---

## 3. User Personas & Journey Matrix

### 3.1 The Five Personas

#### Persona 1: Marko - The Paušalni Freelancer

| Attribute         | Value                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| **Legal Form**    | `OBRT_PAUSAL`                                                                   |
| **Revenue**       | < 60,000 EUR/year                                                               |
| **VAT Status**    | Not in system                                                                   |
| **Employees**     | None                                                                            |
| **Cash Payments** | Occasionally                                                                    |
| **Competence**    | Beginner                                                                        |
| **Pain Points**   | "What forms do I need?", "When do I pay contributions?", "Am I near the limit?" |

**Marko's Journey:**

```
STAGE 0: ONBOARDING (5 steps for OBRT_PAUSAL, 4 for others)
├── Step 1: Basic Info (OIB, Company Name, Select "Paušalni obrt")
├── Step 2: Competence Level → "beginner" | "average" | "pro"
├── Step 3: Address (address, postalCode, city, country)
├── Step 4: Contact & Tax (email, phone, IBAN, isVatPayer)
└── Step 5: Paušalni Profile (acceptsCash, hasEmployees, employedElsewhere, hasEuVatId, taxBracket)
    [Only shown for OBRT_PAUSAL legal form]

STAGE 1: SETUP (0 invoices)
├── Dashboard: Hero Banner + Setup Checklist
├── Tasks: "Create your first contact", "Create your first invoice"
├── Hidden: Charts, Advanced Reports, AI Insights
├── Visible: Paušalni Status Card (60k limit at 0%)
└── [IMPLEMENTED] Tutorial Progress Widget for Paušalni users

STAGE 2: ACTIVE (1+ invoice)
├── Dashboard: + Recent Activity, Revenue Trend, Invoice Funnel
├── Unlocked: Basic Reports, KPR Export
├── Shown: Contribution Payment Reminders
├── Alert: "You've earned X EUR. Y EUR until VAT threshold."
└── [IMPLEMENTED] Contextual Help Banner with active triggers

STAGE 3: STRATEGIC (10+ invoices OR VAT)
├── Dashboard: + AI Insights, Advanced Deadlines
├── Unlocked: AI Assistant, Advanced Reports
└── Proactive: "You're at 90% of limit. Plan ahead."
```

**What Marko Sees:**

| Element                 | Visible? | Notes                             |
| ----------------------- | -------- | --------------------------------- |
| VAT fields on invoices  | NO       | "Nije u sustavu PDV-a" auto-added |
| PDV reports             | NO       | Not a VAT payer                   |
| Paušalni Status Card    | YES      | Shows 60k limit progress          |
| PO-SD Generator         | YES      | Annual tax form                   |
| HOK Payment Reminder    | YES      | Quarterly chamber fee             |
| Contribution Calculator | YES      | Monthly MIO/HZZO                  |
| Corporate Tax           | NO       | Not applicable                    |
| Asset Registry          | NO       | Not required for paušalni         |

---

#### Persona 2: Ana - The Growing Obrt

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Legal Form**  | `OBRT_REAL` (or `OBRT_VAT` if VAT-registered)                      |
| **Revenue**     | 60,000 - 150,000 EUR/year                                          |
| **VAT Status**  | May or may not be registered                                       |
| **Employees**   | 0-2                                                                |
| **Competence**  | Average                                                            |
| **Pain Points** | "How do I track expenses?", "What can I deduct?", "Do I need VAT?" |

**What Ana Needs (vs Marko):**

| Module                    | Paušalni | Ana's Obrt   |
| ------------------------- | -------- | ------------ |
| KPR (Daily Sales)         | YES      | NO           |
| KPI (Income/Expense Book) | NO       | YES          |
| PO-SD                     | YES      | NO           |
| DOH Form                  | NO       | YES          |
| URA/IRA                   | NO       | YES          |
| Asset Registry            | NO       | YES          |
| PDV Forms                 | NO       | IF VAT       |
| JOPPD                     | NO       | IF EMPLOYEES |

---

#### Persona 3: Ivan - The D.O.O. Owner

| Attribute       | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| **Legal Form**  | `DOO` or `JDOO`                                                |
| **Revenue**     | Any                                                            |
| **VAT Status**  | Always YES                                                     |
| **Employees**   | 0+                                                             |
| **Competence**  | Average/Pro                                                    |
| **Pain Points** | "Corporate tax calculation", "VAT returns", "Employee payroll" |

**What Ivan Needs:**

| Module         | Required     | Purpose                                   |
| -------------- | ------------ | ----------------------------------------- |
| Invoicing      | YES          | Issue invoices (E-Invoice mandatory 2026) |
| URA/IRA        | YES          | Invoice registers (mandatory)             |
| PDV Forms      | YES          | VAT reporting (mandatory)                 |
| Asset Registry | YES          | Depreciation affects tax                  |
| Corporate Tax  | YES          | 10%/18% calculation                       |
| JOPPD          | IF EMPLOYEES | Payroll reporting                         |
| Fiscalization  | IF CASH      | POS/card payments                         |

---

#### Persona 4: Petra - The Accountant (Staff)

| Attribute      | Value                                       |
| -------------- | ------------------------------------------- |
| **SystemRole** | `STAFF`                                     |
| **Manages**    | Multiple client companies                   |
| **Needs**      | Bulk operations, export, multi-company view |

**Petra's Portal (`staff.fiskai.hr`):**

**Current Implementation:**

```
Staff Dashboard (/staff-dashboard)
├── Dashboard
│   ├── Assigned Clients count
│   ├── Pending Tickets count
│   ├── Upcoming Deadlines count (TODO: implement)
│   ├── Items Need Attention count
│   └── Recent Activity list
├── Clients (/clients) - list with status indicators
├── Calendar (/calendar) - shared deadlines view [stub]
├── Tasks (/tasks) - assigned work items [stub]
├── Tickets (/tickets) - support tickets from clients [stub]
├── Documents (/documents) - cross-client document access [stub]
└── Settings (/settings)
```

**Access Control:**

- Requires `systemRole === "STAFF"` or `systemRole === "ADMIN"`
- Uses `StaffClientProvider` for client context switching
- Staff can switch between clients and work in client context

**Per-Client Context:**

- Click client → enters client context
- Same UI as client app
- Role: ACCOUNTANT (read + export)
- Special: "Pregledano" (Reviewed) button

**Planned Features (not yet implemented):**

- Calendar, Tasks, Tickets, Documents pages (currently stubs)
- Pending Actions aggregate view
- Bulk export across clients
- Quick deadline overview

---

#### Persona 5: Admin (Platform Owner)

| Attribute        | Value             |
| ---------------- | ----------------- |
| **SystemRole**   | `ADMIN`           |
| **Portal**       | `admin.fiskai.hr` |
| **Capabilities** | Everything        |

**Admin Portal (`admin.fiskai.hr`):**

**Current Implementation:**

```
Admin Dashboard (/overview)
├── Overview Dashboard
│   ├── Admin Metrics (cached)
│   ├── Onboarding Funnel (cached)
│   └── Compliance Health (cached)
├── Tenants (/tenants)
│   ├── Tenant List with filters (legalForm, subscriptionStatus, flags, hasAlerts)
│   ├── Tenant Detail (/tenants/[companyId])
│   ├── Sorting and Pagination
│   └── Search functionality
├── Staff (/staff) - staff user management
├── Alerts (/alerts) - platform-wide alert management [IMPLEMENTED]
├── Digest Preview (/digest) - weekly digest email preview [IMPLEMENTED]
├── News (/news) - AI-powered news pipeline management [IMPLEMENTED]
│   ├── News List with status (pending, draft, reviewing, published)
│   ├── News Detail/Edit (/news/[id])
│   ├── Cron job triggers (fetch-classify, review, publish)
│   └── Impact level tracking
├── Subscriptions (/subscriptions) - Stripe subscription management [stub]
├── Services (/services) - feature flag management [stub]
├── Support (/support) - ticket management [stub]
├── Audit Log (/audit) - system-wide activity [stub]
├── Regulatory Truth Layer (/regulatory) [IMPLEMENTED]
│   ├── Dashboard - health score, rules, evidence stats
│   ├── Sources (/regulatory/sources) - regulatory endpoint management
│   ├── Inbox (/regulatory/inbox) - rules awaiting review
│   ├── Conflicts (/regulatory/conflicts) - conflict resolution
│   ├── Releases (/regulatory/releases) - rule publication
│   └── Coverage (/regulatory/coverage) - coverage dashboard
└── Settings (/settings)
```

**Access Control:**

- Requires `systemRole === "ADMIN"` (exclusive)
- Full platform management capabilities
- Can access all subdomains (admin, staff, app)

**Planned Features (not yet implemented):**

- Subscriptions, Services, Support, Audit Log pages (currently stubs)
- Tenant impersonation
- Support ticket escalation

---

### 3.2 Pre-Authentication Journeys (Marketing)

These journeys occur before user registration, on the public marketing site (`fiskai.hr`).

#### 3.2.1 Persona-Specific Landing Pages

| Route                | Target Persona   | Key Value Props                                                 | CTA                                                |
| -------------------- | ---------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| `/for/pausalni-obrt` | Marko (Paušalni) | Time savings (5-10h → 1-2h/month), error reduction, easy export | 14-day free trial, 39 EUR/month                    |
| `/for/dooo`          | Ivan (D.O.O.)    | VAT processing, e-invoices, team access, JOPPD                  | 30-day trial, Standard 99 EUR / Enterprise 199 EUR |
| `/for/accountants`   | Petra (Staff)    | 70% time reduction, clean exports, free access for accountants  | Free registration for certified accountants        |

#### 3.2.2 Discovery & Education Journeys

```
Marketing Site (fiskai.hr)
├── Homepage (/) - main landing page
├── Features (/features) - feature overview
├── Pricing (/pricing) - plan comparison
├── About (/about) - company info
├── Contact (/contact) - contact form
│
├── Knowledge Hub
│   ├── Baza Znanja (/baza-znanja) - knowledge base index
│   ├── Vodiči (/vodic) - educational guides
│   │   └── Guide Detail (/vodic/[slug])
│   ├── Rječnik (/rjecnik) - accounting glossary
│   │   └── Term Detail (/rjecnik/[pojam])
│   ├── Kako Da (/kako-da) - how-to articles
│   │   └── Article Detail (/kako-da/[slug])
│   ├── Izvori (/izvori) - source references
│   └── Wizard (/wizard) - interactive business form selector [IMPLEMENTED]
│
├── Comparison Pages
│   ├── Usporedba (/usporedba) - comparison explorer
│   └── Comparison Detail (/usporedba/[slug])
│
├── Tools (Free Calculators)
│   ├── Alati Index (/alati)
│   ├── PO-SD Kalkulator (/alati/posd-kalkulator)
│   ├── PDV Kalkulator (/alati/pdv-kalkulator)
│   ├── Kalkulator Doprinosa (/alati/kalkulator-doprinosa)
│   ├── Kalkulator Poreza (/alati/kalkulator-poreza)
│   ├── Kalendar (/alati/kalendar) - deadline calendar
│   ├── Uplatnice (/alati/uplatnice) - payment slip generator
│   ├── OIB Validator (/alati/oib-validator)
│   └── E-Račun Info (/alati/e-racun)
│
├── News & Updates
│   ├── Vijesti (/vijesti) - news listing
│   ├── News Detail (/vijesti/[slug])
│   └── Category Filter (/vijesti/kategorija/[slug])
│
├── Legal & Compliance
│   ├── Terms (/terms)
│   ├── Privacy (/privacy)
│   ├── Security (/security)
│   ├── Cookies (/cookies)
│   ├── DPA (/dpa)
│   ├── AI Data Policy (/ai-data-policy)
│   ├── Urednička Politika (/urednicka-politika)
│   └── Metodologija (/metodologija)
│
├── Product Features
│   ├── Fiskalizacija (/fiskalizacija)
│   ├── Assistant Demo (/assistant-demo)
│   ├── Assistant (/assistant)
│   ├── Prelazak (/prelazak) - migration guide
│   └── Status (/status) - system status
│
└── Authentication
    ├── Login (/login) → redirects to /auth
    ├── Register (/register) → redirects to /auth
    ├── Check Email (/check-email)
    ├── Verify Email (/verify-email)
    ├── Forgot Password (/forgot-password)
    ├── Reset Password (/reset-password)
    └── Select Role (/select-role) - for STAFF/ADMIN with multiple roles
```

#### 3.2.3 Role Selection Flow

For users with `systemRole === "STAFF"` or `systemRole === "ADMIN"`, after login:

1. User authenticates at `/auth`
2. If `hasMultipleRoles(systemRole)` is true, redirect to `/select-role`
3. User sees available portals:
   - **ADMIN**: admin, staff, app
   - **STAFF**: staff, app
   - **USER**: app only (no selection needed)
4. User clicks portal card → redirected to subdomain dashboard

---

### 3.3 Journey Matrix (Persona × Stage)

| Stage          | Paušalni (Marko)                      | Obrt Real (Ana)               | D.O.O. (Ivan)                   |
| -------------- | ------------------------------------- | ----------------------------- | ------------------------------- |
| **Onboarding** | Basic + Competence + Paušalni Profile | + VAT question                | VAT forced ON                   |
| **Setup**      | KPR tutorial, First invoice           | + KPI setup, Expense tracking | + URA/IRA, PDV setup            |
| **Active**     | Limit monitor, PO-SD                  | + Asset tracking, DOH prep    | + Corporate tax, Full reporting |
| **Strategic**  | "Consider D.O.O.?"                    | + Employee prep               | + JOPPD, Advanced analytics     |

---

### 3.4 Client App Journey (app.fiskai.hr)

After onboarding, the authenticated user enters the main application:

```
Client Dashboard (/dashboard)
├── Hero Banner (personalized greeting, legal form context)
├── Contextual Help Banner (trigger-based)
├── Tutorial Progress Widget (for OBRT_PAUSAL)
├── Checklist Widget (guidance system)
├── Insights Widget
├── Today Actions Card (alerts, stats, tasks)
├── Revenue Trend Card
│
├── Right Sidebar
│   ├── Fiscalization Status Card
│   ├── Compliance Status Card (if fiscalEnabled)
│   ├── Paušalni Status Card (YTD revenue, VAT threshold)
│   ├── Deadline Countdown Card
│   ├── VAT Overview Card
│   ├── Invoice Funnel Card
│   ├── Insights Card
│   └── Recent Activity Card
│
└── Action Cards (quick actions)

Core Modules
├── Invoices (/invoices) - legacy invoice management
├── E-Invoices (/e-invoices) - EN 16931 compliant
│   ├── New E-Invoice (/e-invoices/new)
│   └── E-Invoice Detail (/e-invoices/[id])
├── Contacts (/contacts)
│   ├── New Contact (/contacts/new)
│   └── Contact Detail/Edit (/contacts/[id])
├── Products (/products)
│   ├── New Product (/products/new)
│   └── Product Edit (/products/[id]/edit)
├── Expenses (/expenses)
│   ├── New Expense (/expenses/new)
│   ├── Expense Detail (/expenses/[id])
│   └── Categories (/expenses/categories)
├── Documents (/documents)
│   └── Document Detail (/documents/[id])
├── Banking (/banking)
│   ├── Accounts (/banking/accounts)
│   ├── Transactions (/banking/transactions)
│   ├── Documents (/banking/documents)
│   ├── Import (/banking/import)
│   └── Reconciliation (/banking/reconciliation)
├── Reports (/reports)
│   ├── Profit/Loss (/reports/profit-loss)
│   ├── VAT (/reports/vat)
│   ├── VAT Threshold (/reports/vat-threshold)
│   ├── Aging (/reports/aging)
│   └── Export (/reports/export)
├── Paušalni (/pausalni) [OBRT_PAUSAL only]
│   ├── Overview
│   ├── Forms (/pausalni/forms)
│   ├── PO-SD (/pausalni/po-sd)
│   └── Settings (/pausalni/settings)
├── POS (/pos) - Point of Sale
├── Checklist (/checklist) - "Što moram napraviti?"
├── Import (/import) - data migration
├── Accountant (/accountant) - accountant collaboration
└── Settings (/settings)
    ├── Company Settings
    ├── E-Invoice Settings
    ├── Billing (/settings/billing)
    ├── Audit Log (/settings/audit-log)
    ├── Email (/settings/email)
    ├── Terminal (/settings/terminal)
    ├── Premises (/settings/premises)
    ├── Guidance (/settings/guidance)
    └── Fiscalisation (/settings/fiscalisation)
```

**Visibility System:**
Dashboard cards use `<Visible id="card:*">` components that conditionally render based on:

- Legal form (OBRT_PAUSAL, OBRT_REAL, DOO, etc.)
- Competence level (beginner, average, pro)
- Company stage (invoice count, VAT status)
- Feature flags

---

### 3.5 Performance & User Experience Infrastructure

#### 3.5.1 Web Vitals Monitoring (PR #112)

Core Web Vitals are tracked via PostHog:

- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **INP** (Interaction to Next Paint) - replaced FID in web-vitals v4+
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

Implementation: `/src/lib/web-vitals.ts`

#### 3.5.2 PWA Support

- Service Worker: `/public/sw.js`
- Enables offline caching and faster repeat visits
- Search index pre-cached: `/public/search-index.json`

#### 3.5.3 SEO Infrastructure (PR #108)

Marketing pages include:

- OpenGraph images (auto-generated per page)
- Structured metadata via Next.js Metadata API
- Semantic HTML structure
- Croatian language support

#### 3.5.4 Design System (PR #107)

Self-enforcing design tokens ensure consistent UX:

- Typography tokens in `/src/design-system/tokens/typography.ts`
- CVA-based component variants
- Accessibility features (skip links, ARIA labels, focus management)

---

### 3.6 Authentication Flow

```
User Authentication Journey
├── Entry Points
│   ├── /login → redirects to /auth
│   ├── /register → redirects to /auth
│   └── Direct /auth access
│
├── Authentication Methods
│   ├── Email + Password
│   ├── Magic Link (email)
│   └── OTP verification (/src/lib/auth/otp.ts)
│
├── Post-Authentication
│   ├── If no company → /onboarding
│   ├── If USER role → /dashboard (app.fiskai.hr)
│   ├── If STAFF role → /select-role or /staff-dashboard
│   └── If ADMIN role → /select-role or /overview (admin.fiskai.hr)
│
└── Email Verification
    ├── /check-email → waiting for verification
    ├── /verify-email → token validation
    ├── /forgot-password → password reset request
    └── /reset-password → new password entry
```

---

### 3.7 Identified Gaps & Incomplete Journeys

#### 3.7.1 Staff Portal Gaps

| Feature           | Status              | Notes                              |
| ----------------- | ------------------- | ---------------------------------- |
| Calendar page     | **Stub**            | Route exists but no implementation |
| Tasks page        | **Stub**            | Route exists but no implementation |
| Tickets page      | **Stub**            | Route exists but no implementation |
| Documents page    | **Stub**            | Route exists but no implementation |
| Deadline tracking | **TODO**            | Marked in code comments            |
| Bulk operations   | **Not implemented** | Documented as planned              |

#### 3.7.2 Admin Portal Gaps

| Feature              | Status              | Notes                  |
| -------------------- | ------------------- | ---------------------- |
| Subscriptions page   | **Stub**            | Navigation link exists |
| Services page        | **Stub**            | Navigation link exists |
| Support page         | **Stub**            | Navigation link exists |
| Audit Log page       | **Stub**            | Navigation link exists |
| Tenant impersonation | **Not implemented** | Documented as planned  |

#### 3.7.3 Documented but Missing Journeys

| Journey                    | Documentation         | Implementation                                  |
| -------------------------- | --------------------- | ----------------------------------------------- |
| Ana (Obrt Real) onboarding | Documented in persona | Generic onboarding, no OBRT_REAL specific steps |
| Ivan (D.O.O.) onboarding   | Documented in persona | Generic onboarding, no DOO specific steps       |
| KPI setup for Obrt Real    | Journey matrix        | Not implemented                                 |
| Asset tracking             | Journey matrix        | Not implemented                                 |
| JOPPD preparation          | Journey matrix        | Not implemented                                 |
| "Consider D.O.O.?" prompt  | Strategic stage       | Not implemented                                 |
| Employee prep flow         | Strategic stage       | Not implemented                                 |

#### 3.7.4 Implemented but Undocumented Features

| Feature                | Route            | Notes                               |
| ---------------------- | ---------------- | ----------------------------------- |
| Article Agent          | `/article-agent` | AI-powered article generation       |
| Regulatory Truth Layer | `/regulatory/*`  | Full admin management UI            |
| News Pipeline          | `/news/*`        | AI content pipeline with cron jobs  |
| Alerts Management      | `/alerts`        | Platform-wide alerts                |
| Digest Preview         | `/digest`        | Weekly digest email preview         |
| Business Form Wizard   | `/wizard`        | Interactive business type selector  |
| Multiple free tools    | `/alati/*`       | Calculators, validators, generators |

---

### 3.8 System Roles & Access Matrix

| SystemRole | Marketing | App | Staff | Admin |
| ---------- | --------- | --- | ----- | ----- |
| `USER`     | Yes       | Yes | No    | No    |
| `STAFF`    | Yes       | Yes | Yes   | No    |
| `ADMIN`    | Yes       | Yes | Yes   | Yes   |

**Role Assignment:**

- Default registration: `USER`
- Staff promotion: Admin sets via `/admin/staff`
- Admin access: Database update required (see CLAUDE.md)

**Per-Company Roles (separate from SystemRole):**

- OWNER
- ACCOUNTANT
- EMPLOYEE

These are stored in `CompanyMember.role` and control access within a company context.
