# Users & Journeys

[← Back to Index](./00-INDEX.md)

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
> **Version:** 3.1.0
>
> Comprehensive update: Control Center journeys, marketing separation impact, and new portal structures documented.

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

**Petra's Portal (app.fiskai.hr/staff):**

**NEW Architecture (2026-01-03):** Path-based access, not subdomain

```
Staff Portal (app.fiskai.hr/staff)
├── Staff Control Center (/staff/staff-control-center) - Primary entry point
│   ├── Queue: Assigned Clients (with pending items)
│   ├── Queue: Period Lock Requests (placeholder Phase 2)
│   ├── Queue: Client Invitations (placeholder)
│   └── Capability-driven actions per queue item
│
├── Legacy Staff Dashboard (/staff/staff-dashboard) - Being phased out
│   ├── Assigned Clients count
│   ├── Pending Tickets count
│   ├── Items Need Attention count
│   └── Recent Activity list
│
├── Clients (/staff/clients) - Client list with filters
│   └── Client Detail (/staff/clients/[clientId])
│       ├── Client Overview
│       ├── Reports (/reports)
│       ├── E-Invoices (/e-invoices)
│       ├── Documents (/documents)
│       └── Messages (/messages)
│
├── Bulk Operations (/staff/bulk-operations) - Multi-client actions
├── Staff Documents (/staff/staff-documents) - Cross-client view
├── Staff Settings (/staff/staff-settings) - Profile and preferences
│
├── Stub Pages (planned, not implemented):
│   ├── Calendar (/staff/calendar) - shared deadlines view
│   ├── Tasks (/staff/tasks) - assigned work items
│   ├── Tickets (/staff/tickets) - support tickets
│   └── Invitations (/staff/invitations) - client invitations
```

**Access Control:**

- Requires `systemRole === "STAFF"` or `systemRole === "ADMIN"`
- Path-based: `/staff/*` routes protected by middleware
- Uses `StaffClientProvider` for client context switching
- Staff can switch between clients and work in client context

**Per-Client Context:**

- Click client → enters client context at `/staff/clients/[clientId]`
- Same UI components as client app
- Role: ACCOUNTANT (read + export)
- Special: "Pregledano" (Reviewed) button on documents

**Planned Features (not yet implemented):**

- Calendar, Tasks, Tickets pages (currently stubs)
- Pending Actions aggregate view
- Bulk export across clients
- Quick deadline overview

---

#### Persona 5: Admin (Platform Owner)

| Attribute        | Value                 |
| ---------------- | --------------------- |
| **SystemRole**   | `ADMIN`               |
| **Portal**       | `app.fiskai.hr/admin` |
| **Capabilities** | Everything            |

**Admin Portal (app.fiskai.hr/admin):**

**NEW Architecture (2026-01-03):** Path-based access, not subdomain

**Current Implementation:**

```
Admin Portal (app.fiskai.hr/admin)
├── Admin Control Center (/admin/admin-control-center) - Primary entry point
│   ├── Queue: Platform Alerts (system health, errors)
│   ├── Queue: Regulatory Conflicts (RTL conflicts needing review)
│   ├── Queue: Pending News Posts (AI-generated news awaiting approval)
│   ├── Queue: Failed Jobs (background job failures)
│   └── Capability-driven actions per queue item
│
├── Overview Dashboard (/admin/overview) - Legacy dashboard
│   ├── Admin Metrics (cached)
│   ├── Onboarding Funnel (cached)
│   ├── Compliance Health (cached)
│   └── Recent Signups
│
├── Tenant Management
│   ├── Tenants (/admin/tenants)
│   │   ├── List with filters (legalForm, subscriptionStatus, flags, hasAlerts)
│   │   ├── Sorting and Pagination
│   │   └── Search functionality
│   └── Tenant Detail (/admin/tenants/[companyId])
│       ├── Company Overview
│       ├── Subscription Status
│       ├── Module Entitlements
│       └── Audit Trail
│
├── Staff Management (/admin/staff)
│   ├── Staff User List
│   ├── Staff Assignments
│   └── Role Management
│
├── Content Management
│   ├── News (/admin/news) - AI-powered news pipeline [IMPLEMENTED]
│   │   ├── News List with status (pending, draft, reviewing, published)
│   │   ├── News Detail/Edit (/admin/news/[id])
│   │   ├── Cron job triggers (fetch-classify, review, publish)
│   │   └── Impact level tracking
│   ├── Alerts (/admin/alerts) - platform-wide alerts [IMPLEMENTED]
│   ├── Digest Preview (/admin/digest) - weekly digest email [IMPLEMENTED]
│   └── Content Automation (/admin/content-automation) - article generation
│
├── Regulatory Truth Layer (/admin/regulatory) [IMPLEMENTED]
│   ├── Dashboard - health score, rules, evidence stats
│   ├── Sources (/admin/regulatory/sources) - endpoint management
│   ├── Sentinel (/admin/regulatory/sentinel) - discovery monitoring
│   ├── Inbox (/admin/regulatory/inbox) - rules awaiting review
│   ├── Conflicts (/admin/regulatory/conflicts) - conflict resolution
│   ├── Releases (/admin/regulatory/releases) - rule publication
│   └── Coverage (/admin/regulatory/coverage) - coverage dashboard
│
├── System Monitoring
│   ├── System Status (/admin/system-status) - health checks
│   ├── Compliance Status (/admin/compliance-status) - tenant compliance
│   └── Platform Settings (/admin/platform-settings)
│
├── Stub Pages (planned, not implemented):
│   ├── Subscriptions (/admin/subscriptions) - Stripe management
│   ├── Services (/admin/services) - feature flag management
│   ├── Platform Support (/admin/platform-support) - ticket management
│   ├── Audit Log (/admin/audit) - system-wide activity
│   └── Feature Flags (/admin/feature-flags) - feature toggles
```

**Access Control:**

- Requires `systemRole === "ADMIN"` (exclusive)
- Path-based: `/admin/*` routes protected by middleware
- Full platform management capabilities
- Can access all portals (admin, staff, app) via role selection

**Key Features:**

1. **Control Center First**: Primary entry point is task-oriented, not overview
2. **Regulatory Truth Layer**: Complete management of RTL pipeline
3. **AI Content Pipeline**: Manage news generation, classification, and publishing
4. **Tenant Management**: Full CRUD on companies, subscriptions, entitlements
5. **System Health**: Monitor platform metrics, worker status, job queues

**Planned Features (not yet implemented):**

- Subscriptions, Services, Support, Audit Log pages (currently stubs)
- Tenant impersonation (login as tenant)
- Support ticket escalation workflows
- Advanced feature flag management

---

### 3.2 Marketing to Application Journey

**Critical Update (2026-01-09):** Marketing pages have been moved to a **separate repository** (`fiskai-marketing`) and are deployed as static HTML on SiteGround. This architectural change impacts the user journey from discovery to application.

#### 3.2.0 Marketing Split Architecture

| Component      | URL                 | Deployment       | Repository       | Purpose                 |
| -------------- | ------------------- | ---------------- | ---------------- | ----------------------- |
| Marketing Site | fiskai.hr           | SiteGround       | fiskai-marketing | Static landing pages    |
| Authentication | app.fiskai.hr/auth  | Coolify (VPS-01) | FiskAI           | Login, register, verify |
| Client App     | app.fiskai.hr       | Coolify (VPS-01) | FiskAI           | Business dashboard      |
| Staff Portal   | app.fiskai.hr/staff | Coolify (VPS-01) | FiskAI           | Multi-client workspace  |
| Admin Portal   | app.fiskai.hr/admin | Coolify (VPS-01) | FiskAI           | Platform administration |

**Critical Journey Impact:**

1. **Marketing → App Transition**:
   - Marketing pages are static HTML on SiteGround
   - Auth pages redirect to `app.fiskai.hr/auth`
   - User completes login/register on app subdomain
   - After auth, redirected to appropriate portal based on systemRole

2. **Discovery Path:**

   ```
   Google → fiskai.hr (marketing) → /login redirect → app.fiskai.hr/auth → onboarding or dashboard
   ```

3. **Role Selection:**
   - After login, users with multiple roles see `/select-role` page
   - ADMIN: Can choose admin, staff, or app portal
   - STAFF: Can choose staff or app portal
   - USER: Redirected directly to app dashboard

---

#### 3.2.1 Persona-Specific Landing Pages

**Location:** Marketing repository (`fiskai-marketing`), deployed to fiskai.hr

| Route                | Target Persona   | Key Value Props                                                 | CTA                                                |
| -------------------- | ---------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| `/for/pausalni-obrt` | Marko (Paušalni) | Time savings (5-10h → 1-2h/month), error reduction, easy export | 14-day free trial, 39 EUR/month                    |
| `/for/dooo`          | Ivan (D.O.O.)    | VAT processing, e-invoices, team access, JOPPD                  | 30-day trial, Standard 99 EUR / Enterprise 199 EUR |
| `/for/accountants`   | Petra (Staff)    | 70% time reduction, clean exports, free access for accountants  | Free registration for certified accountants        |

#### 3.2.2 Marketing Site Structure

**Repository:** `fiskai-marketing` (separate from main application)
**Deployment:** Static HTML export to SiteGround via GitHub Actions
**URL:** fiskai.hr, www.fiskai.hr

```
Marketing Site (fiskai.hr) - Static Export
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
│   └── Wizard (/wizard) - interactive business form selector
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
└── Authentication (Redirects to app.fiskai.hr)
    ├── Login (/login) → REDIRECT to app.fiskai.hr/auth
    ├── Register (/register) → REDIRECT to app.fiskai.hr/auth
    ├── Forgot Password (/forgot-password) → REDIRECT to app.fiskai.hr/forgot-password
    └── Reset Password (/reset-password) → REDIRECT to app.fiskai.hr/reset-password
```

**Key Architectural Rules:**

- Marketing site is **static HTML** - no database, no auth, no server actions
- All authentication handled by `app.fiskai.hr/auth`
- Marketing CTA buttons link to `app.fiskai.hr/auth?mode=signup`
- Enforced by ESLint rules + CI checks (see `docs/marketing/BOUNDARY_CONTRACT.md`)

#### 3.2.3 Authentication Flow

**Location:** Main application repository, `app.fiskai.hr/auth`

```
Authentication Journey (app.fiskai.hr)
├── Entry Points
│   ├── app.fiskai.hr/auth - unified auth page
│   ├── Redirect from marketing /login
│   └── Redirect from marketing /register
│
├── Authentication Methods
│   ├── Email + Password
│   ├── Magic Link (email)
│   └── OTP verification
│
├── Post-Authentication
│   ├── If no company → /onboarding
│   ├── If USER role → /dashboard (app.fiskai.hr)
│   ├── If STAFF/ADMIN with multiple roles → /select-role
│   ├── If STAFF role (single) → /staff/staff-control-center
│   └── If ADMIN role (single) → /admin/admin-control-center
│
└── Email Verification
    ├── /check-email → waiting for verification
    ├── /verify-email → token validation
    ├── /forgot-password → password reset request
    └── /reset-password → new password entry
```

#### 3.2.4 Role Selection Flow

**Location:** `app.fiskai.hr/select-role`

For users with `systemRole === "STAFF"` or `systemRole === "ADMIN"`:

1. User authenticates at `app.fiskai.hr/auth`
2. System checks `hasMultipleRoles(systemRole)`
3. If true, redirect to `/select-role`
4. User sees available portal cards:
   - **ADMIN users see**: Admin Portal, Staff Portal, Client Dashboard
   - **STAFF users see**: Staff Portal, Client Dashboard
   - **USER users**: Skip this step (no choice needed)
5. User clicks portal card → navigates to appropriate path:
   - Admin Portal → `/admin/admin-control-center`
   - Staff Portal → `/staff/staff-control-center`
   - Client Dashboard → `/dashboard` or `/cc` (Control Center)

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

After onboarding, the authenticated user enters the main application. FiskAI provides two primary entry points:

#### 3.4.1 Control Center (/cc) - Task-Oriented Entry Point

**NEW (2026-01-03):** Control Center is a capability-driven task queue interface.

```
Control Center (/cc) - "What Needs Attention"
├── Queue-based interface powered by Capability Resolution API
├── Shows only actionable items (no empty queues)
├── Each item displays:
│   ├── Entity status (DRAFT, PENDING, etc.)
│   ├── Timestamp
│   └── Available capabilities (actions)
│
└── Typical Queues:
    ├── Draft Invoices (requires completion)
    ├── Pending Fiscalization (requires submission)
    ├── Unmatched Bank Transactions (requires reconciliation)
    └── Pending Expenses (requires categorization)
```

**Journey:**

1. User logs in → redirected to `/cc` if they have pending tasks
2. Sees queue cards with counts and items
3. Clicks item → redirected to entity page with pre-resolved capabilities
4. Completes action → returns to `/cc` with updated queue

**Implementation:**

- Server components call `/api/capabilities/resolve`
- No business logic in UI
- Blockers displayed with clear explanations
- Example: Can't fiscalize invoice without certificate → shows certificate setup link

#### 3.4.2 Classic Dashboard (/dashboard) - Overview Entry Point

After onboarding, users can also access the traditional dashboard view:

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

### 3.6 Complete Authentication & Onboarding Flow

**Updated 2026-01-14:** Reflects marketing split and Control Center architecture

```
Complete User Journey: Discovery → Authentication → Onboarding → Application
│
├── STAGE 1: DISCOVERY (Marketing Site)
│   ├── User lands on fiskai.hr (Google, social, direct)
│   ├── Browses: Features, Pricing, Knowledge Hub, Calculators
│   ├── Decides to register
│   └── Clicks "Registriraj se" CTA
│
├── STAGE 2: AUTHENTICATION (app.fiskai.hr/auth)
│   ├── Redirected to app.fiskai.hr/auth
│   ├── Authentication Methods:
│   │   ├── Email + Password
│   │   ├── Magic Link (email)
│   │   └── OTP verification
│   ├── Email Verification Flow:
│   │   ├── /check-email → waiting for verification
│   │   ├── /verify-email → token validation
│   │   └── Email confirmed → proceed
│   └── Password Reset Flow:
│       ├── /forgot-password → request reset
│       └── /reset-password → set new password
│
├── STAGE 3: ONBOARDING (app.fiskai.hr/onboarding)
│   ├── Check: Does user have company?
│   ├── If NO → Start onboarding flow
│   │   ├── Step 1: Basic Info (OIB, name, legal form) [REQUIRED]
│   │   ├── Step 2: Competence Level (beginner/average/pro) [OPTIONAL]
│   │   ├── Step 3: Address [OPTIONAL]
│   │   ├── Step 4: Contact & Tax (email, IBAN, VAT status) [OPTIONAL]
│   │   ├── Step 5: Paušalni Profile (only for OBRT_PAUSAL) [OPTIONAL]
│   │   └── Step 6: Billing (plan selection) [INFORMATIONAL]
│   └── If YES → Skip to portal selection
│
├── STAGE 4: PORTAL SELECTION (app.fiskai.hr/select-role)
│   ├── Check: hasMultipleRoles(systemRole)?
│   ├── If USER → Redirect directly to /cc or /dashboard
│   ├── If STAFF → Show: Staff Portal or Client Dashboard
│   ├── If ADMIN → Show: Admin Portal, Staff Portal, or Client Dashboard
│   └── User selects portal → navigate to entry point
│
└── STAGE 5: APPLICATION ENTRY
    ├── Client (USER role) → /cc (Control Center) or /dashboard
    ├── Staff (STAFF role) → /staff/staff-control-center
    └── Admin (ADMIN role) → /admin/admin-control-center
```

**Critical Rules:**

1. **Marketing is static** - No auth happens on fiskai.hr
2. **Auth is centralized** - All login/register at app.fiskai.hr/auth
3. **Onboarding is optional** - Only Step 1 (Basic Info) is required
4. **Control Center is primary** - Task-oriented entry, not overview dashboards
5. **Path-based access** - No separate subdomains for admin/staff (was removed 2026-01-09)

---

### 3.7 Identified Gaps & Incomplete Journeys

**Last Review:** 2026-01-14

#### 3.7.1 Staff Portal Gaps

| Feature                | Status              | Location                   | Notes                              |
| ---------------------- | ------------------- | -------------------------- | ---------------------------------- |
| Calendar page          | **Stub**            | `/staff/calendar`          | Route exists but no implementation |
| Tasks page             | **Stub**            | `/staff/tasks`             | Route exists but no implementation |
| Tickets page           | **Stub**            | `/staff/tickets`           | Route exists but no implementation |
| Staff Documents page   | **Stub**            | `/staff/staff-documents`   | Route exists but no implementation |
| Deadline tracking      | **TODO**            | Staff Control Center       | Marked in code comments            |
| Bulk operations        | **Partial**         | `/staff/bulk-operations`   | Page exists, limited functionality |
| Period Lock Requests   | **Placeholder**     | Staff Control Center queue | Phase 2 planned                    |
| Multi-client reporting | **Not implemented** | -                          | Documented as planned              |

#### 3.7.2 Admin Portal Gaps

| Feature              | Status              | Location                  | Notes                        |
| -------------------- | ------------------- | ------------------------- | ---------------------------- |
| Subscriptions page   | **Stub**            | `/admin/subscriptions`    | Navigation link exists       |
| Services page        | **Stub**            | `/admin/services`         | Navigation link exists       |
| Platform Support     | **Stub**            | `/admin/platform-support` | Navigation link exists       |
| Audit Log page       | **Stub**            | `/admin/audit`            | Navigation link exists       |
| Feature Flags        | **Stub**            | `/admin/feature-flags`    | Navigation link exists       |
| Tenant impersonation | **Not implemented** | -                         | Documented as planned        |
| Worker management    | **Partial**         | System Status page        | Monitor only, no restart/etc |
| Queue management     | **Placeholder**     | Admin Control Center      | Phase 2 planned              |

#### 3.7.3 Client Portal Gaps

| Feature               | Status              | Location                           | Notes                                 |
| --------------------- | ------------------- | ---------------------------------- | ------------------------------------- |
| Control Center queues | **Partial**         | `/cc`                              | Basic queues working, needs expansion |
| Capability blockers   | **Implemented**     | Various pages                      | Shows blockers with explanations      |
| Invoice workflow      | **Partial**         | `/invoices/new`, `/e-invoices/new` | Capability checks added               |
| POS integration       | **Stub**            | `/pos`                             | Page exists, limited functionality    |
| Corporate tax         | **Stub**            | `/corporate-tax`                   | Page exists, no calculations          |
| Asset registry        | **Not implemented** | -                                  | Not started                           |
| JOPPD                 | **Not implemented** | -                                  | Not started                           |

#### 3.7.4 Documented but Missing Persona-Specific Journeys

| Journey                    | Persona  | Documentation      | Implementation Status                           |
| -------------------------- | -------- | ------------------ | ----------------------------------------------- |
| Ana (Obrt Real) onboarding | Ana      | Persona definition | Generic onboarding, no OBRT_REAL specific steps |
| Ivan (D.O.O.) onboarding   | Ivan     | Persona definition | Generic onboarding, no DOO specific steps       |
| KPI setup for Obrt Real    | Ana      | Journey matrix     | Not implemented                                 |
| Asset tracking             | Ana/Ivan | Journey matrix     | Not implemented                                 |
| JOPPD preparation          | Ivan     | Journey matrix     | Not implemented                                 |
| "Consider D.O.O.?" prompt  | Marko    | Strategic stage    | Not implemented                                 |
| Employee prep flow         | Ana      | Strategic stage    | Not implemented                                 |
| Paušalni limit warnings    | Marko    | Persona definition | Partially implemented (basic warning)           |

#### 3.7.5 Implemented but Previously Undocumented Features

**Now Documented (2026-01-14):**

| Feature                 | Route                         | Status          | Notes                              |
| ----------------------- | ----------------------------- | --------------- | ---------------------------------- |
| Control Center (Client) | `/cc`                         | **NEW**         | Task-oriented entry point          |
| Control Center (Staff)  | `/staff/staff-control-center` | **NEW**         | Multi-client oversight             |
| Control Center (Admin)  | `/admin/admin-control-center` | **NEW**         | Platform health monitoring         |
| Article Agent           | `/article-agent`              | **Implemented** | AI-powered article generation      |
| Regulatory Truth Layer  | `/admin/regulatory/*`         | **Implemented** | Complete RTL management UI         |
| News Pipeline           | `/admin/news/*`               | **Implemented** | AI content pipeline with cron jobs |
| Alerts Management       | `/admin/alerts`               | **Implemented** | Platform-wide alerts               |
| Digest Preview          | `/admin/digest`               | **Implemented** | Weekly digest email preview        |
| Content Automation      | `/admin/content-automation`   | **Implemented** | AI article generation              |
| System Status           | `/admin/system-status`        | **Implemented** | Health checks and monitoring       |
| Compliance Status       | `/admin/compliance-status`    | **Implemented** | Tenant compliance tracking         |

**Marketing Site Features (in separate repo):**

| Feature              | Route          | Status          | Notes                              |
| -------------------- | -------------- | --------------- | ---------------------------------- |
| Business Form Wizard | `/wizard`      | **Implemented** | Interactive business type selector |
| Free Calculators     | `/alati/*`     | **Implemented** | Multiple calculators and tools     |
| Knowledge Hub        | `/baza-znanja` | **Implemented** | Guides, glossary, how-tos          |
| Comparison Pages     | `/usporedba/*` | **Implemented** | Business form comparisons          |

---

### 3.8 Control Center Architecture (NEW)

**Introduced:** 2026-01-03
**Status:** Phase 1 implemented, Phase 2-4 planned

Control Center is FiskAI's new task-oriented interface paradigm, replacing traditional dashboard-first navigation with a queue-based workflow system.

#### 3.8.1 Design Philosophy

**Problem:** Traditional dashboards show metrics and charts, but users still ask "what do I need to do next?"

**Solution:** Control Center shows **only actionable items** with clear next steps.

**Core Principles:**

1. **Queue-based**: Work items grouped by entity type and status
2. **Capability-driven**: Actions determined by Capability Resolution API
3. **Zero business logic in UI**: All rules in backend, UI displays state
4. **Blockers explained**: If action unavailable, system explains why + how to fix
5. **No empty queues**: Only show queues with items (reduces noise)

#### 3.8.2 Three Control Centers

| Portal         | Route                         | User  | Purpose                                                         |
| -------------- | ----------------------------- | ----- | --------------------------------------------------------------- |
| **Client**     | `/cc`                         | USER  | "What needs my attention?" - invoices, expenses, reconciliation |
| **Accountant** | `/staff/staff-control-center` | STAFF | "Which clients need review?" - multi-client oversight           |
| **Admin**      | `/admin/admin-control-center` | ADMIN | "What's broken?" - platform health, conflicts, alerts           |

#### 3.8.3 Implementation Phases

**Phase 1: Control Center Shells** ✅ Complete (2026-01-03)

- Three control center pages created
- Basic queue rendering
- Capability resolution integration
- Blocker display components

**Phase 2: Minimal Entity Editors** 🔄 In Progress

- Inline editing for queue items
- Quick actions (mark paid, approve, etc.)
- State refresh after action

**Phase 3: Workflow Completion UX** 📋 Planned

- Completion animations
- "What's next?" suggestions
- Queue item removal on completion

**Phase 4: Visual Refinement** 📋 Planned

- Polish UI/UX
- Keyboard shortcuts
- Batch operations

#### 3.8.4 Example: Client Control Center Journey

```
User logs in → Redirected to /cc
│
├── Queue: Draft Invoices (3 items)
│   ├── Invoice #2025-001 - Status: DRAFT
│   │   └── Actions: [Edit], [Delete], [Mark as Sent]
│   ├── Invoice #2025-002 - Status: DRAFT
│   │   └── Actions: [Edit], [Delete]
│   └── Invoice #2025-003 - Status: DRAFT
│       └── Actions: BLOCKED
│           └── Blocker: Missing buyer OIB
│               └── Fix: [Add buyer info]
│
├── Queue: Pending Fiscalization (1 item)
│   └── Invoice #2025-004 - Status: PENDING_FISCALIZATION
│       └── Actions: BLOCKED
│           └── Blocker: No fiscal certificate
│               └── Fix: [Setup fiscalization] → /settings/fiscalisation
│
└── Queue: Unmatched Transactions (5 items)
    ├── Transaction: "Payment from Client A" - €150.00
    │   └── Actions: [Match to invoice], [Ignore]
    └── ... (4 more)
```

**User clicks "Setup fiscalization":**

1. Redirected to `/settings/fiscalisation`
2. Completes certificate setup
3. Returns to `/cc`
4. Invoice #2025-004 now shows: Actions: [Fiscalize]

#### 3.8.5 Architecture Decision Records

**Why not use Visibility System?**

- Visibility system is toxic (hardcoded rules, not extensible)
- Control Center uses Capability Resolution API (single source of truth)
- Enables dynamic rules based on tenant state, not just static config

**Why queue-based, not dashboard-based?**

- Users want tasks, not metrics
- Reduces cognitive load (only show actionable items)
- Clear completion state (empty queue = all done)

**Why three separate Control Centers?**

- Different roles have different mental models
- Client: "My work"
- Accountant: "My clients"
- Admin: "Platform health"

---

### 3.9 System Roles & Access Matrix

**Updated 2026-01-14:** Path-based access (no subdomains)

#### 3.9.1 SystemRole Access Matrix

| SystemRole | Marketing (fiskai.hr) | App Paths | Staff Paths (`/staff/*`) | Admin Paths (`/admin/*`) |
| ---------- | --------------------- | --------- | ------------------------ | ------------------------ |
| `USER`     | Yes (public)          | Yes       | No                       | No                       |
| `STAFF`    | Yes (public)          | Yes       | Yes                      | No                       |
| `ADMIN`    | Yes (public)          | Yes       | Yes                      | Yes                      |

**Access Control Implementation:**

- **Marketing**: Public static site, no authentication
- **App paths**: Requires authentication, any systemRole
- **Staff paths** (`/staff/*`): Requires `systemRole === "STAFF"` OR `"ADMIN"`
- **Admin paths** (`/admin/*`): Requires `systemRole === "ADMIN"` (exclusive)
- **Enforcement**: Middleware checks path + systemRole (see `src/lib/middleware/subdomain.ts`)

**Role Assignment:**

- Default registration: `USER`
- Staff promotion: Admin sets via `/admin/staff`
- Admin access: Database update required (see CLAUDE.md)
- Role stored in: `User.systemRole` (enum: USER, STAFF, ADMIN)

**Legacy Note:** Prior to 2026-01-09, admin and staff used separate subdomains (`admin.fiskai.hr`, `staff.fiskai.hr`). These have been removed. All access is now path-based on `app.fiskai.hr`.

#### 3.9.2 Per-Company Roles (CompanyRole enum)

These roles control access **within a specific company**, separate from systemRole.

| Role       | Description         | Capabilities                   | CompanyUser.role |
| ---------- | ------------------- | ------------------------------ | ---------------- |
| OWNER      | Company founder     | Full access including billing  | `OWNER`          |
| ADMIN      | Trusted manager     | Manage resources, invite users | `ADMIN`          |
| MEMBER     | Employee            | Create/edit, limited delete    | `MEMBER`         |
| ACCOUNTANT | External accountant | Read + exports                 | `ACCOUNTANT`     |
| VIEWER     | Investor/advisor    | Read-only access               | `VIEWER`         |

**Storage:** `CompanyUser.role` links User to Company with specific role

**Example:**

- User John has `systemRole = "USER"`
- John is linked to Company A as `CompanyUser.role = "OWNER"`
- John is linked to Company B as `CompanyUser.role = "ACCOUNTANT"`
- Result: John can manage Company A fully, but only view/export from Company B

**See Also:** [04-ACCESS-CONTROL.md](./04-ACCESS-CONTROL.md) for full permission matrix.

#### 3.9.3 Multi-Portal Access Flow

For users with elevated systemRole (STAFF, ADMIN):

1. User logs in at `app.fiskai.hr/auth`
2. System checks `systemRole`:
   - If `USER`: Direct to `/cc` or `/dashboard`
   - If `STAFF`: Show role selection (Staff Portal or Client Dashboard)
   - If `ADMIN`: Show role selection (Admin, Staff, or Client)
3. User selects portal → navigates to corresponding path
4. Middleware enforces access based on path + systemRole
5. User can switch portals anytime via role selector
