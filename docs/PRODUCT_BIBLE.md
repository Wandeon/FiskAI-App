# FiskAI Product Bible

## The Complete System Truth

**Version:** 4.1.0
**Date:** 2025-12-20
**Status:** Canonical - Single Source of Truth
**Scope:** Every flow, every button, every permission, every scenario

---

## Table of Contents

1. [Vision & Non-Negotiables](#1-vision--non-negotiables)
2. [Architecture Overview](#2-architecture-overview)
3. [User Personas & Journey Matrix](#3-user-personas--journey-matrix)
4. [Legal Forms & Compliance Requirements](#4-legal-forms--compliance-requirements)
5. [Module System & Entitlements](#5-module-system--entitlements)
6. [Permission Matrix (RBAC)](#6-permission-matrix-rbac)
7. [Visibility & Feature Gating](#7-visibility--feature-gating)
8. [Dashboard & Progressive Disclosure](#8-dashboard--progressive-disclosure)
9. [UI Components & Behaviors](#9-ui-components--behaviors)
10. [Complete User Flows](#10-complete-user-flows)
11. [Tax & Regulatory Data](#11-tax--regulatory-data)
12. [Integration Ecosystem](#12-integration-ecosystem)
13. [Monetization & Pricing](#13-monetization--pricing)
14. [Implementation Status Matrix](#14-implementation-status-matrix)
15. [Data Models](#15-data-models)
16. [API Reference (Legacy)](#16-api-reference)
17. [Complete API Reference](#17-complete-api-reference)

---

**Appendixes:**

- [Appendix A: Glossary](#appendix-a-glossary)
- [Appendix B: File Locations](#appendix-b-file-locations)
- [Appendix 1: Strategic Technical Specification (Gaps + Proof)](#appendix-1-strategic-technical-specification-gaps--proof)
- [Appendix 2: Improvement Ledger (Audit + Fixes)](#appendix-2-improvement-ledger-audit--fixes)

---

## 1. Vision & Non-Negotiables

### 1.1 What FiskAI Is

FiskAI is not a dashboard. It is a **Financial Cockpit** - a single command center where Croatian business owners see everything they need to run their business legally and efficiently.

**Core Promise:** "Never miss a deadline, never overpay taxes, never wonder what to do next."

### 1.2 Non-Negotiables

| Rule                       | Enforcement                                                         | Why                                                       |
| -------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| **Zero Data Leakage**      | Prisma query extensions enforce tenant isolation at DB level        | Multi-tenant SaaS - one company cannot see another's data |
| **Regulatory First**       | Croatian legal requirements are hardcoded, not configurable         | Fiskalizacija, 11-year archive, PDV rules are law         |
| **Experience-Clean**       | No empty states without clear "Step 1" CTA                          | Users should never feel lost or abandoned                 |
| **One Truth**              | Single module registry, single key system, single visibility engine | No conflicting logic paths                                |
| **Progressive Disclosure** | Show complexity only when user is ready                             | Don't overwhelm beginners                                 |
| **Document Integrity**     | SHA-256 hashing + audit logging for all documents                   | 11-year archive must prove documents unaltered            |

### 1.3 The Three Portals

| Portal           | URL               | SystemRole | Purpose                           |
| ---------------- | ----------------- | ---------- | --------------------------------- |
| **Client App**   | `app.fiskai.hr`   | `USER`     | Business owner's cockpit          |
| **Staff Portal** | `staff.fiskai.hr` | `STAFF`    | Accountant multi-client workspace |
| **Admin Portal** | `admin.fiskai.hr` | `ADMIN`    | Platform management               |

**Marketing Site:** `fiskai.hr` (public, no auth required)

---

## 2. Architecture Overview

### 2.1 Tech Stack

| Layer      | Technology               | Purpose                                |
| ---------- | ------------------------ | -------------------------------------- |
| Framework  | Next.js 15 App Router    | Server components, streaming, routing  |
| Database   | PostgreSQL 16 + Prisma 7 | Primary data persistence, multi-tenant |
| Database   | Drizzle ORM              | Guidance, news, paušalni tables        |
| Auth       | NextAuth v5 (Auth.js)    | Session management, OAuth, Passkeys    |
| Styling    | Tailwind CSS + CVA       | Design system, component variants      |
| Validation | Zod                      | Schema validation everywhere           |
| Email      | Resend                   | Transactional email                    |
| Storage    | Cloudflare R2            | Encrypted document archive             |
| Payments   | Stripe                   | Subscriptions, Terminal                |
| Banking    | Gocardless/SaltEdge      | PSD2 bank connections                  |
| Fiscal     | FINA CIS                 | Croatian fiscalization                 |

### 2.2 Directory Structure

```
/src
├── app/
│   ├── (marketing)/     # Public pages (fiskai.hr)
│   ├── (app)/           # Client dashboard (app.fiskai.hr)
│   ├── (staff)/         # Staff portal (staff.fiskai.hr)
│   ├── (admin)/         # Admin portal (admin.fiskai.hr)
│   ├── (auth)/          # Authentication flows
│   └── api/             # API routes
├── components/
│   ├── ui/              # Design system primitives
│   ├── layout/          # Header, sidebar, navigation
│   ├── dashboard/       # Dashboard widgets
│   ├── onboarding/      # Wizard steps
│   ├── guidance/        # Help system
│   └── [feature]/       # Feature-specific components
├── lib/
│   ├── modules/         # Module definitions & gating
│   ├── visibility/      # Progressive disclosure rules
│   ├── rbac.ts          # Permission matrix
│   ├── fiscal-data/     # Tax rates, thresholds, deadlines
│   ├── pausalni/        # Paušalni obrt logic
│   ├── e-invoice/       # UBL/XML generation
│   └── db/
│       ├── drizzle.ts   # Drizzle client
│       └── schema/      # Drizzle table definitions
└── content/             # MDX guides & tools
```

### 2.3 Request Flow

```
User Request
    ↓
middleware.ts (subdomain routing)
    ↓
Route Group Layout (portal check)
    ↓
Page Component (auth + company check)
    ↓
Visibility Provider (feature gating)
    ↓
Server Action (RBAC check)
    ↓
Prisma (tenant isolation)
    ↓
PostgreSQL
```

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
STAGE 0: ONBOARDING
├── Step 1: Basic Info (OIB, Company Name, Select "Paušalni obrt")
├── Step 2: Competence Level → "Beginner" (shows all help)
├── Step 3: Address (for invoice header)
└── Step 4: Contact & IBAN (for payment slips)

STAGE 1: SETUP (0 invoices)
├── Dashboard: Hero Banner + Setup Checklist
├── Tasks: "Create your first contact", "Create your first invoice"
├── Hidden: Charts, Advanced Reports, AI Insights
└── Visible: Paušalni Status Card (60k limit at 0%)

STAGE 2: ACTIVE (1+ invoice)
├── Dashboard: + Recent Activity, Revenue Trend, Invoice Funnel
├── Unlocked: Basic Reports, KPR Export
├── Shown: Contribution Payment Reminders
└── Alert: "You've earned X EUR. Y EUR until VAT threshold."

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

| Module         | Required     | Purpose                       |
| -------------- | ------------ | ----------------------------- |
| Invoicing      | YES          | Issue invoices                |
| URA/IRA        | YES          | Invoice registers (mandatory) |
| PDV Forms      | YES          | VAT reporting (mandatory)     |
| Asset Registry | YES          | Depreciation affects tax      |
| Corporate Tax  | YES          | 10%/18% calculation           |
| JOPPD          | IF EMPLOYEES | Payroll reporting             |
| Fiscalization  | IF CASH      | POS/card payments             |

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
Staff Dashboard
├── Dashboard (overview of assigned clients)
├── Clients (list with status indicators)
├── Calendar (shared deadlines view)
├── Tasks (assigned work items)
├── Tickets (support tickets from clients)
└── Documents (cross-client document access)
```

**Per-Client Context:**

- Click client → enters client context
- Same UI as client app
- Role: ACCOUNTANT (read + export)
- Special: "Pregledano" (Reviewed) button

**Planned Features (not yet implemented):**

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
Admin Dashboard
├── Dashboard (platform metrics - partial)
├── Tenants (company management)
├── Staff (staff user management)
├── Subscriptions (Stripe subscription management)
├── Services (feature flag management)
├── Support (ticket management)
└── Audit Log (system-wide activity)
```

**Planned Features:**

- News management (create/edit announcements)
- Full metrics dashboard
- Support ticket escalation
- Tenant impersonation

---

### 3.2 Journey Matrix (Persona × Stage)

| Stage          | Paušalni (Marko)            | Obrt Real (Ana)               | D.O.O. (Ivan)                   |
| -------------- | --------------------------- | ----------------------------- | ------------------------------- |
| **Onboarding** | Basic + Competence          | + VAT question                | VAT forced ON                   |
| **Setup**      | KPR tutorial, First invoice | + KPI setup, Expense tracking | + URA/IRA, PDV setup            |
| **Active**     | Limit monitor, PO-SD        | + Asset tracking, DOH prep    | + Corporate tax, Full reporting |
| **Strategic**  | "Consider D.O.O.?"          | + Employee prep               | + JOPPD, Advanced analytics     |

---

## 4. Legal Forms & Compliance Requirements

### 4.1 Croatian Business Types

| Legal Form     | Code          | Min Capital | Tax Regime    | Accounting   | VAT      |
| -------------- | ------------- | ----------- | ------------- | ------------ | -------- |
| Paušalni Obrt  | `OBRT_PAUSAL` | 0 EUR       | Flat-rate 12% | Single-entry | NO       |
| Obrt (Dohodak) | `OBRT_REAL`   | 0 EUR       | Income tax    | Single-entry | Optional |
| Obrt (PDV)     | `OBRT_VAT`    | 0 EUR       | Income + VAT  | Single-entry | YES      |
| j.d.o.o.       | `JDOO`        | 1 EUR       | Corporate     | Double-entry | YES      |
| d.o.o.         | `DOO`         | 2,500 EUR   | Corporate     | Double-entry | YES      |

### 4.2 Module Requirements by Legal Form

| Module               | OBRT_PAUSAL | OBRT_REAL  | OBRT_VAT   | JDOO       | DOO        |
| -------------------- | ----------- | ---------- | ---------- | ---------- | ---------- |
| Invoicing            | ✅          | ✅         | ✅         | ✅         | ✅         |
| KPR (Sales Log)      | ✅          | ❌         | ❌         | ❌         | ❌         |
| KPI (Income/Expense) | ❌          | ✅         | ✅         | ❌         | ❌         |
| PO-SD (Annual Form)  | ✅          | ❌         | ❌         | ❌         | ❌         |
| DOH (Income Tax)     | ❌          | ✅         | ✅         | ❌         | ❌         |
| URA/IRA              | ❌          | ✅         | ✅         | ✅         | ✅         |
| PDV Forms            | ❌          | ⚠️ IF VAT  | ✅         | ✅         | ✅         |
| Assets (DI)          | ❌          | ✅         | ✅         | ✅         | ✅         |
| Corporate Tax        | ❌          | ❌         | ❌         | ✅         | ✅         |
| JOPPD                | ❌          | ⚠️ IF EMP  | ⚠️ IF EMP  | ⚠️ IF EMP  | ⚠️ IF EMP  |
| Fiscalization        | ⚠️ IF CASH  | ⚠️ IF CASH | ⚠️ IF CASH | ⚠️ IF CASH | ⚠️ IF CASH |

### 4.3 The 20 Scenarios Matrix

Every possible combination of legal form × VAT × cash × employees:

| #   | Legal Form | VAT   | Cash | Employees | Required Modules                |
| --- | ---------- | ----- | ---- | --------- | ------------------------------- |
| 1   | Paušalni   | No    | No   | No        | Invoicing, KPR, PO-SD           |
| 2   | Paušalni   | No    | Yes  | No        | + **Fiscalization**             |
| 3   | Paušalni   | Yes\* | No   | No        | + **PDV**                       |
| 4   | Paušalni   | Yes\* | Yes  | No        | + **PDV, Fiscalization**        |
| 5   | Obrt Real  | No    | No   | No        | Invoicing, KPI, URA/IRA, Assets |
| 6   | Obrt Real  | No    | Yes  | No        | + **Fiscalization**             |
| 7   | Obrt Real  | No    | No   | Yes       | + **JOPPD**                     |
| 8   | Obrt Real  | No    | Yes  | Yes       | + **Fiscalization, JOPPD**      |
| 9   | Obrt Real  | Yes   | No   | No        | + **PDV**                       |
| 10  | Obrt Real  | Yes   | Yes  | No        | + **PDV, Fiscalization**        |
| 11  | Obrt Real  | Yes   | No   | Yes       | + **PDV, JOPPD**                |
| 12  | Obrt Real  | Yes   | Yes  | Yes       | + **PDV, Fiscalization, JOPPD** |
| 13  | j.d.o.o.   | Yes   | No   | No        | Invoicing, URA/IRA, Assets, PDV |
| 14  | j.d.o.o.   | Yes   | Yes  | No        | + **Fiscalization**             |
| 15  | j.d.o.o.   | Yes   | No   | Yes       | + **JOPPD**                     |
| 16  | j.d.o.o.   | Yes   | Yes  | Yes       | + **Fiscalization, JOPPD**      |
| 17  | d.o.o.     | Yes   | No   | No        | Invoicing, URA/IRA, Assets, PDV |
| 18  | d.o.o.     | Yes   | Yes  | No        | + **Fiscalization**             |
| 19  | d.o.o.     | Yes   | No   | Yes       | + **JOPPD**                     |
| 20  | d.o.o.     | Yes   | Yes  | Yes       | + **Fiscalization, JOPPD**      |

\*Paušalni with VAT = exceeded 60k threshold

### 4.4 Invoice Requirements by VAT Status

**NOT in VAT system (Paušalni < 60k):**

```
MUST include:
"Porezni obveznik nije u sustavu PDV-a prema čl. 90. st. 2. Zakona o PDV-u"

CANNOT show:
- VAT breakdown
- VAT registration number (HR + OIB)
```

**IN VAT system:**

```
MUST include:
- Seller VAT ID: HR + OIB
- Buyer VAT ID (if B2B)
- VAT breakdown by rate (25%, 13%, 5%, 0%)
- Tax point date
- Sequential invoice number
```

### 4.5 Fiscalization Requirements

**When Required:**
| Payment Method | Fiscalization? |
|----------------|----------------|
| Cash (Gotovina) | YES |
| Card (Kartica) | YES |
| Bank Transfer | NO |
| Mixed | YES (for cash portion) |

**The Flow:**

```
1. Create Invoice
       ↓
2. Calculate ZKI (32-char hex from RSA signature)
       ↓
3. Send to CIS (Tax Authority)
       ↓
4. Receive JIR (36-char UUID)
       ↓
5. Print Invoice with ZKI + JIR + QR Code
```

---

## 5. Module System & Entitlements

### 5.1 The 16 Module Keys

Stored in `Company.entitlements[]` as kebab-case strings:

| Module Key         | Description              | Default |
| ------------------ | ------------------------ | ------- |
| `invoicing`        | Manual PDF generation    | ✅ FREE |
| `e-invoicing`      | UBL/XML B2B/B2G          | ✅ FREE |
| `contacts`         | CRM directory            | ✅ FREE |
| `products`         | Product catalog          | ✅ FREE |
| `expenses`         | Expense tracking         | ✅ FREE |
| `banking`          | Bank import & sync       | PAID    |
| `documents`        | Document vault (archive) | ✅ FREE |
| `reports-basic`    | KPR, aging, P&L          | ✅ FREE |
| `fiscalization`    | CIS integration          | PAID    |
| `reconciliation`   | Auto-matching            | PAID    |
| `reports-advanced` | VAT reports, exports     | PAID    |
| `pausalni`         | Paušalni features        | AUTO\*  |
| `vat`              | VAT management           | AUTO\*  |
| `corporate-tax`    | D.O.O./JDOO tax          | AUTO\*  |
| `pos`              | Point of sale            | PAID    |
| `ai-assistant`     | AI chat & extraction     | PAID    |

\*AUTO modules are recommended based on `legalForm` but must be explicitly added to entitlements. The visibility system hides irrelevant modules (e.g., VAT widgets for non-VAT payers) regardless of entitlements.

**Current behavior:** Legal-form-specific features are controlled by the visibility system (`src/lib/visibility/rules.ts`), not by auto-enabling entitlements.

**Planned:** Future versions may auto-add relevant entitlements during onboarding based on legalForm selection.

### 5.2 Module Definition Structure

```typescript
// src/lib/modules/definitions.ts
interface ModuleDefinition {
  key: ModuleKey
  name: string // Croatian display name
  description: string // Croatian description
  routes: string[] // Protected route patterns
  navItems: string[] // Nav item identifiers (not objects)
  defaultEnabled: boolean
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  invoicing: {
    key: "invoicing",
    name: "Invoicing",
    description: "Create and manage invoices, quotes, proformas",
    routes: ["/invoices", "/invoices/new", "/invoices/[id]"],
    navItems: ["invoices"], // References nav registry
    defaultEnabled: true,
  },
  // ... 15 more modules
}
```

**Note:** The `navItems` array contains identifiers that map to the navigation registry in `/src/lib/navigation.ts`, not full nav item objects. The `requiredFor` field shown in earlier versions does not exist in the current implementation.

### 5.3 Entitlement Checking

**Route Protection (Sidebar):**

```typescript
// src/components/layout/sidebar.tsx
if (item.module && company && !entitlements.includes(item.module)) {
  return false // Item hidden from navigation
}
```

**Component Visibility:**

```tsx
// Using visibility system (checks legal form, stage, competence)
;<Visible id="card:pausalni-status">
  <PausalniStatusCard />
</Visible>

// Direct entitlement check in component
{
  entitlements.includes("ai-assistant") && <AIAssistantButton />
}
```

**Note:** Entitlements are checked separately from the visibility system. Visibility handles legal form, progression stage, and competence level. Entitlements are checked directly in sidebar navigation and individual components.

---

## 6. Permission Matrix (RBAC)

### 6.1 The Five Tenant Roles

| Role         | Description                     | Typical User        |
| ------------ | ------------------------------- | ------------------- |
| `OWNER`      | Full control, including billing | Business founder    |
| `ADMIN`      | Manage resources, invite users  | Trusted manager     |
| `MEMBER`     | Create/edit, no delete          | Employee            |
| `ACCOUNTANT` | Read-only + exports             | External accountant |
| `VIEWER`     | Read-only                       | Investor, advisor   |

### 6.2 Permission Matrix

| Permission          | OWNER | ADMIN | MEMBER | ACCOUNTANT | VIEWER |
| ------------------- | ----- | ----- | ------ | ---------- | ------ |
| **Invoices**        |
| `invoice:create`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `invoice:read`      | ✅    | ✅    | ✅     | ✅         | ✅     |
| `invoice:update`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `invoice:delete`    | ✅    | ✅    | ❌     | ❌         | ❌     |
| **Expenses**        |
| `expense:create`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `expense:read`      | ✅    | ✅    | ✅     | ✅         | ✅     |
| `expense:update`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `expense:delete`    | ✅    | ✅    | ❌     | ❌         | ❌     |
| **Contacts**        |
| `contact:create`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `contact:read`      | ✅    | ✅    | ✅     | ✅         | ✅     |
| `contact:update`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `contact:delete`    | ✅    | ✅    | ❌     | ❌         | ❌     |
| **Products**        |
| `product:create`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `product:read`      | ✅    | ✅    | ✅     | ✅         | ✅     |
| `product:update`    | ✅    | ✅    | ✅     | ❌         | ❌     |
| `product:delete`    | ✅    | ✅    | ❌     | ❌         | ❌     |
| **Settings**        |
| `settings:read`     | ✅    | ✅    | ❌     | ✅         | ❌     |
| `settings:update`   | ✅    | ✅    | ❌     | ❌         | ❌     |
| `billing:manage`    | ✅    | ❌    | ❌     | ❌         | ❌     |
| **Users**           |
| `users:invite`      | ✅    | ✅    | ❌     | ❌         | ❌     |
| `users:remove`      | ✅    | ✅    | ❌     | ❌         | ❌     |
| `users:update_role` | ✅    | ❌    | ❌     | ❌         | ❌     |
| **Reports**         |
| `reports:read`      | ✅    | ✅    | ❌     | ✅         | ✅     |
| `reports:export`    | ✅    | ✅    | ❌     | ✅         | ❌     |
| **Fiscal**          |
| `fiscal:manage`     | ✅    | ✅    | ❌     | ❌         | ❌     |

### 6.3 Usage in Code

```typescript
// Server action
return requireCompanyWithPermission(user.id!, 'invoice:delete', async (company) => {
  await db.eInvoice.delete({ where: { id } })
})

// Component
if (roleHasPermission(userRole, 'invoice:delete')) {
  return <DeleteButton />
}
```

### 6.4 Audit Logging & Document Integrity

Every significant action is logged for compliance and debugging.

**Logged Actions:**

| Action      | What's Recorded                           |
| ----------- | ----------------------------------------- |
| `CREATE`    | Entity type, ID, user, timestamp, company |
| `UPDATE`    | Fields changed, old/new values            |
| `DELETE`    | Soft-delete flag, reason if provided      |
| `VIEW`      | Sensitive data access (financial reports) |
| `EXPORT`    | What was exported, format, recipient      |
| `LOGIN`     | Success/failure, IP, device               |
| `FISCALIZE` | Invoice ID, JIR/ZKI, CIS response         |

**Implementation:**

```typescript
// Prisma middleware enforces logging
prisma.$use(async (params, next) => {
  if (["create", "update", "delete"].includes(params.action)) {
    const result = await next(params)

    await createAuditLog({
      action: params.action.toUpperCase(),
      model: params.model,
      entityId: params.args.where?.id || result?.id,
      userId: getCurrentUserId(),
      companyId: getCurrentCompanyId(),
      changes: params.args.data,
      timestamp: new Date(),
    })

    return result
  }
  return next(params)
})
```

**Document Integrity:**

Every uploaded or generated document is hashed to ensure it cannot be altered.

```typescript
// Document integrity record
interface DocumentIntegrity {
  documentId: string
  sha256Hash: string // Hash of document content
  fileSize: number // File size in bytes
  mimeType: string // application/pdf, image/jpeg, etc.
  createdAt: DateTime // Upload/generation timestamp
  createdBy: string // User ID
  verifiedAt?: DateTime // Last integrity check
  merkleRoot?: string // Periodic Merkle tree root for batch verification
  storageUrl: string // Cloudflare R2 location
}

// On document upload
async function storeDocument(file: File, companyId: string) {
  const buffer = await file.arrayBuffer()
  const hash = crypto.subtle.digest("SHA-256", buffer)
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Upload to R2
  const url = await uploadToR2(buffer, `${companyId}/${hashHex}`)

  // Store integrity record
  await db.documentIntegrity.create({
    data: {
      documentId: generateId(),
      sha256Hash: hashHex,
      fileSize: buffer.byteLength,
      mimeType: file.type,
      createdBy: userId,
      storageUrl: url,
    },
  })

  return { url, hash: hashHex }
}

// Verification (periodic cron job)
async function verifyDocumentIntegrity(documentId: string) {
  const record = await db.documentIntegrity.findUnique({ where: { documentId } })
  const file = await fetchFromR2(record.storageUrl)
  const currentHash = await calculateSHA256(file)

  if (currentHash !== record.sha256Hash) {
    await alertAdmins({
      severity: "CRITICAL",
      message: `Document integrity violation: ${documentId}`,
      expected: record.sha256Hash,
      actual: currentHash,
    })
    return false
  }

  await db.documentIntegrity.update({
    where: { documentId },
    data: { verifiedAt: new Date() },
  })

  return true
}
```

**Retention Policy:**

- **11 years** - Croatian legal requirement for tax documents
- **After 11 years:** Documents archived to cold storage, integrity records retained
- **Audit logs:** Retained indefinitely (compressed after 2 years)

**Compliance Features:**

- Immutable audit trail (append-only)
- No backdated entries
- No deletion of audit logs (soft-delete only for GDPR)
- Periodic integrity verification via cron
- Merkle tree for batch verification efficiency

---

## 7. Visibility & Feature Gating

### 7.1 Three-Layer Visibility System

**Layer 1: Business Type (Legal Form)**

```typescript
// What's hidden based on legalForm
OBRT_PAUSAL: ["vat-fields", "corporate-tax", "asset-registry"]
OBRT_REAL: ["pausalni-widgets", "kpr", "po-sd"]
DOO/JDOO: ["pausalni-widgets", "doprinosi-personal"]
```

**Layer 2: Progression Stage**

```typescript
// calculateActualStage(company)
onboarding  → Wizard incomplete
setup       → Profile complete, 0 invoices
active      → 1+ invoice OR bank statement
strategic   → 10+ invoices OR VAT registered
```

**Layer 3: Competence Level**

```typescript
// User's self-declared expertise
beginner → Hide advanced settings, show all help
average  → Normal UI
pro      → Show everything, minimal hand-holding
```

### 7.2 Element Visibility Registry

**Complete list from `/src/lib/visibility/elements.ts`:**

#### Dashboard Cards

| Element ID                  | Legal Form  | Stage     | Competence | Purpose          |
| --------------------------- | ----------- | --------- | ---------- | ---------------- |
| `card:hero-banner`          | All         | setup+    | All        | Welcome message  |
| `card:checklist-widget`     | All         | setup     | beginner   | Setup guide      |
| `card:recent-activity`      | All         | active+   | average+   | Recent actions   |
| `card:revenue-trend`        | All         | active+   | average+   | Revenue chart    |
| `card:invoice-funnel`       | All         | active+   | average+   | Invoice pipeline |
| `card:pausalni-status`      | OBRT_PAUSAL | setup+    | All        | Limit tracker    |
| `card:vat-overview`         | VAT payers  | active+   | average+   | VAT summary      |
| `card:fiscalization-status` | Cash payers | setup+    | All        | Fiscal status    |
| `card:insights-widget`      | All         | strategic | All        | AI insights      |
| `card:corporate-tax`        | DOO/JDOO    | strategic | pro        | Corp tax         |
| `card:doprinosi`            | OBRT\_\*    | setup+    | All        | Contributions    |
| `card:cash-flow`            | All         | active+   | average+   | Cash flow        |
| `card:posd-reminder`        | OBRT_PAUSAL | active+   | All        | Annual form      |
| `card:deadline-countdown`   | All         | setup+    | All        | Next deadline    |
| `card:today-actions`        | All         | setup+    | All        | Action items     |
| `card:advanced-insights`    | All         | strategic | pro        | Deep analytics   |
| `card:insights`             | All         | active+   | average+   | Basic insights   |

#### Navigation Items

| Element ID          | Purpose         |
| ------------------- | --------------- |
| `nav:dashboard`     | Dashboard       |
| `nav:invoices`      | Invoice list    |
| `nav:e-invoices`    | E-invoice list  |
| `nav:contacts`      | Contacts        |
| `nav:customers`     | Customers       |
| `nav:products`      | Products        |
| `nav:expenses`      | Expenses        |
| `nav:documents`     | Documents       |
| `nav:import`        | Import          |
| `nav:banking`       | Bank accounts   |
| `nav:pos`           | Point of sale   |
| `nav:pausalni`      | Paušalni hub    |
| `nav:vat`           | VAT management  |
| `nav:reports`       | Reports section |
| `nav:doprinosi`     | Contributions   |
| `nav:corporate-tax` | Corporate tax   |
| `nav:settings`      | Settings        |
| `nav:api-settings`  | API settings    |
| `nav:checklist`     | Checklist       |

#### Actions

| Element ID                 | Purpose           |
| -------------------------- | ----------------- |
| `action:create-invoice`    | New invoice       |
| `action:create-contact`    | New contact       |
| `action:create-product`    | New product       |
| `action:create-expense`    | New expense       |
| `action:import-statements` | Import statements |
| `action:export-data`       | Export data       |

#### Pages

| Element ID           | Purpose       |
| -------------------- | ------------- |
| `page:vat`           | VAT dashboard |
| `page:pausalni`      | Paušalni hub  |
| `page:pos`           | POS interface |
| `page:reports`       | Reports       |
| `page:corporate-tax` | Corp tax      |
| `page:doprinosi`     | Contributions |
| `page:bank`          | Banking       |

### 7.3 Visibility Component Usage

```tsx
// In dashboard
<Visible id="card:pausalni-status">
  <PausalniStatusCard />
</Visible>
```

**What Visibility Checks:**

1. ✅ Legal form (`legalForm`) - e.g., hide VAT widgets for paušalni
2. ✅ Progression stage (`stage`) - e.g., hide charts until first invoice
3. ✅ Competence level (`competence`) - e.g., hide advanced for beginners
4. ❌ **Does NOT check entitlements**

**Entitlements Are Checked Separately:**

- Sidebar: Direct array check in `sidebar.tsx`
- Pages: Route protection middleware
- Components: Manual `entitlements.includes()` checks

```tsx
// Combining visibility + entitlements
<Visible id="card:ai-insights">
  {entitlements.includes("ai-assistant") && <AIInsightsCard />}
</Visible>
```

**Why Separate?**

- Visibility = "Should this user type see this?"
- Entitlements = "Has this company paid for this?"
- A paušalni user shouldn't see VAT widgets even if they somehow have the `vat` entitlement.

---

## 8. Dashboard & Progressive Disclosure

### 8.1 The Four Stages

#### Stage 0: Onboarding (Wizard)

**Trigger:** `hasCompletedOnboarding: false` (company missing required fields)

**User Sees:**

- Full-screen 4-step wizard
- NO access to dashboard
- Cannot skip

**Wizard Steps:**
| Step | Fields | Validation |
|------|--------|------------|
| 1. Basic Info | Name, OIB, Legal Form | OIB = 11 digits |
| 2. Competence | Global level, Category levels | At least one selected |
| 3. Address | Street, Postal Code, City | All required |
| 4. Contact & Tax | Email, IBAN, VAT checkbox | Email valid, IBAN valid |

**Completion Logic:**

```typescript
// Actual implementation (src/lib/visibility/server.ts)
const hasCompletedOnboarding = Boolean(
  company.oib && company.address && company.city && company.iban && company.email
)
```

**Required Fields for Completion:**
| Field | Required | Validation |
|-------|----------|------------|
| OIB | ✅ | 11 digits |
| Address | ✅ | Non-empty |
| City | ✅ | Non-empty |
| IBAN | ✅ | Valid format |
| Email | ✅ | Valid email |
| Name | ❌ | Optional |
| PostalCode | ❌ | Optional |
| LegalForm | ❌ | Defaults to DOO |
| Competence | ❌ | Stored in featureFlags, not required |

**Note:** Competence level is collected in wizard Step 2 and stored in `featureFlags.competence`, but is not required for onboarding completion.

---

#### Stage 1: Setup (New User)

**Trigger:** Onboarding complete + 0 invoices + 0 bank statements

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Hero Banner                                            │
│  "Dobrodošli, [Name]! Postavimo vaš poslovni cockpit."  │
├─────────────────────────────────────────────────────────┤
│  Setup Checklist                    │  Today's Actions  │
│  □ Create first contact             │  No pending tasks │
│  □ Create first invoice             │                   │
│  □ Connect bank account             │                   │
│  □ Upload fiscal certificate        │                   │
├─────────────────────────────────────────────────────────┤
│  [Paušalni Status Card]             │  Deadlines        │
│  60k Limit: 0 EUR (0%)              │  Next: MIO 15.01  │
│  "You haven't earned anything yet"  │                   │
└─────────────────────────────────────────────────────────┘
```

**Hidden in Stage 1:**

- Revenue Trend (empty chart is sad)
- Invoice Funnel (no data)
- AI Insights (need context)
- Recent Activity (nothing yet)

---

#### Stage 2: Active (Operational)

**Trigger:** 1+ invoice created OR 1+ bank statement imported

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Hero Banner (condensed)                                │
│  "[Company] • [X] contacts • Provider: [Connected/Not]" │
├─────────────────────────────────────────────────────────┤
│  Revenue Trend (6mo)     │  Invoice Funnel              │
│  ████ 2,500 EUR          │  Draft → Fiscal → Sent →    │
│  ███ 1,800 EUR           │  Delivered → Accepted        │
├─────────────────────────────────────────────────────────┤
│  Recent Activity         │  [Paušalni/VAT Status]       │
│  • Invoice #001 - Sent   │  Limit: 4,300 EUR (10.75%)   │
│  • Invoice #002 - Draft  │  ████░░░░░░░░░░░░░░░░░░░░░░ │
├─────────────────────────────────────────────────────────┤
│  Quick Actions           │  Upcoming Deadlines          │
│  [+ E-Račun] [+ Račun]   │  MIO I: 15.01 (3 days)       │
│  [+ Kontakt] [+ Trošak]  │  HOK: 27.02 (45 days)        │
└─────────────────────────────────────────────────────────┘
```

**Setup Checklist:**

- Moved to sidebar (collapsed)
- Or Settings page
- Not prominent on dashboard

---

#### Stage 3: Strategic (Mature)

**Trigger:** 10+ invoices OR VAT registered

**Additional Elements:**

```
┌─────────────────────────────────────────────────────────┐
│  AI Insights                                            │
│  "Your average invoice is 450 EUR. Consider bundling."  │
│  "You're at 85% of VAT threshold. Plan ahead."          │
├─────────────────────────────────────────────────────────┤
│  VAT Overview            │  Corporate Tax (D.O.O. only) │
│  Paid: 1,250 EUR         │  Estimated: 2,400 EUR        │
│  Pending: 450 EUR        │  Due: 30.04.2025             │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Dashboard Element Catalog

| Element         | Component                     | Module        | Competence | Stage     |
| --------------- | ----------------------------- | ------------- | ---------- | --------- |
| Hero Banner     | `hero-banner.tsx`             | Core          | All        | setup+    |
| Setup Checklist | `ChecklistWidget.tsx`         | Guidance      | beginner   | setup     |
| Recent Activity | `recent-activity.tsx`         | Core          | average+   | active+   |
| Revenue Trend   | `revenue-trend-card.tsx`      | invoicing     | average+   | active+   |
| Invoice Funnel  | `invoice-funnel-card.tsx`     | invoicing     | average+   | active+   |
| Paušalni Status | `pausalni-status-card.tsx`    | pausalni      | All        | setup+    |
| VAT Overview    | `vat-overview-card.tsx`       | vat           | average+   | active+   |
| Fiscal Status   | `fiscalization-status.tsx`    | fiscalization | All        | setup+    |
| AI Insights     | `insights-card.tsx`           | ai-assistant  | All        | strategic |
| Deadlines       | `deadline-countdown-card.tsx` | Core          | All        | setup+    |
| Action Cards    | `action-cards.tsx`            | ai-assistant  | All        | active+   |
| Quick Stats     | `quick-stats.tsx`             | Core          | average+   | active+   |

---

## 9. UI Components & Behaviors

### 9.1 Layout Components

#### Header (`header.tsx`)

| Element             | Visibility                     | Behavior                   |
| ------------------- | ------------------------------ | -------------------------- |
| Logo                | Always                         | Click → /dashboard         |
| Company Switcher    | Desktop, if multiple companies | Dropdown, switch context   |
| Company Status Pill | Tablet                         | Shows e-invoice connection |
| Onboarding Progress | Desktop, if incomplete         | Click → /onboarding        |
| Plan Badge          | XL screens                     | Shows subscription tier    |
| Quick Level Toggle  | Desktop                        | beginner/average/pro       |
| Command Palette     | Always                         | ⌘K to open                 |
| Quick Actions       | Desktop                        | + dropdown                 |
| Notifications       | Always                         | Bell + unread count        |
| User Menu           | Always                         | Profile, Settings, Logout  |

#### Sidebar (`sidebar.tsx`)

**Navigation Sections (from `/src/lib/navigation.ts`):**

1. **Pregled** (Overview)
   - Dashboard

2. **Financije** (Finance)
   - Blagajna (POS) - `module: pos`
   - Dokumenti (Documents) - with category filters
   - Bankarstvo (Banking) - `module: banking`
   - Paušalni Hub - `module: pausalni`
   - Izvještaji (Reports)

3. **Suradnja** (Collaboration)
   - Računovođa (Accountant workspace)
   - Podrška (Support)

4. **Podaci** (Data)
   - Kontakti (Contacts)
   - Proizvodi (Products)
   - Article Agent - `module: ai-assistant` (STAFF only)

5. **Sustav** (System)
   - Postavke (Settings)

**Module Gating:**

```typescript
// src/components/layout/sidebar.tsx:139-151
if (item.module && company && !entitlements.includes(item.module)) {
  return false // Hidden from navigation
}
```

**Visibility Integration:**

- Each nav item can have a `visibilityId` for stage/competence gating
- Items not in entitlements are hidden (not locked)

#### Mobile Navigation (`mobile-nav.tsx`)

**Implementation:** Slide-out drawer + Command Palette FAB

**Hamburger Menu (☰):**

- Opens full navigation drawer from left
- Same structure as desktop sidebar
- Gestures: Swipe right to open, left to close

**Command Palette FAB (+):**

- Fixed position button (bottom-right)
- Opens command palette overlay
- Keyboard shortcut: Not available on mobile

**Quick Actions in Command Palette:**
| Action | Command | Route |
|--------|---------|-------|
| New E-Invoice | "e-račun" | `/e-invoices/new` |
| New Invoice | "račun" | `/invoices/new` |
| New Contact | "kontakt" | `/contacts/new` |
| New Expense | "trošak" | `/expenses/new` |
| Search | "traži" | Opens search |

**Note:** The bottom navigation bar design from earlier mockups was replaced with the command palette approach for more flexibility.

### 9.2 Form Components

#### Invoice Form

**Fields:**
| Field | Type | Validation |
|-------|------|------------|
| Kupac | Contact selector | Required |
| Datum izdavanja | Date picker | Required |
| Datum dospijeća | Date picker | > issue date |
| Stavke | Line item table | Min 1 |
| └─ Opis | Text | Required |
| └─ Količina | Number | > 0 |
| └─ Jedinica | Select | kom/h/dan/mj |
| └─ Cijena | Decimal | >= 0 |
| └─ PDV | Select | 25%/13%/5%/0% |
| Napomena | Textarea | Optional |

**Paušalni Logic:**

- If `legalForm === "OBRT_PAUSAL"` && `!isVatPayer`:
  - PDV column hidden
  - Auto-add footer: "Nije u sustavu PDV-a"

**Line Item Behavior:**

- Add row: Button at bottom
- Remove row: X button (if > 1 row)
- Auto-calculate: Amount = Qty × Price
- Running total: Updates on any change

#### Onboarding Steps

**Step 1 - Basic Info:**

```tsx
<Input name="name" label="Naziv tvrtke" required />
<OIBInput name="oib" label="OIB" required />
<Select name="legalForm" label="Pravni oblik" options={[
  { value: "OBRT_PAUSAL", label: "Paušalni obrt" },
  { value: "OBRT_REAL", label: "Obrt (dohodak)" },
  { value: "OBRT_VAT", label: "Obrt u PDV sustavu" },
  { value: "JDOO", label: "j.d.o.o." },
  { value: "DOO", label: "d.o.o." },
]} />
```

**Step 2 - Competence:**

```tsx
// Three cards, selectable
<CompetenceCard level="beginner"
  title="Početnik"
  description="Pokazuj mi sve savjete i upute" />
<CompetenceCard level="average"
  title="Iskusan"
  description="Standardni prikaz" />
<CompetenceCard level="pro"
  title="Stručnjak"
  description="Minimalne upute, maksimalna kontrola" />
```

**Step 3 - Address:**

```tsx
<Input name="address" label="Adresa" required />
<Input name="postalCode" label="Poštanski broj" required />
<Input name="city" label="Grad" required />
<Select name="country" label="Država" default="HR" />
```

**Step 4 - Contact & Tax:**

```tsx
<Input name="email" type="email" label="Email" required />
<Input name="phone" label="Telefon" optional />
<Input name="iban" label="IBAN" required />
<Checkbox name="isVatPayer" label="U sustavu PDV-a"
  disabled={legalForm === "OBRT_PAUSAL"} />
// Note for paušalni: "Paušalni obrt nije u sustavu PDV-a"
```

### 9.3 Modal & Dialog Behaviors

| Modal              | Trigger             | Content                     | Actions              |
| ------------------ | ------------------- | --------------------------- | -------------------- |
| Confirm Delete     | Delete button click | "Are you sure?" + item name | Cancel, Delete (red) |
| Certificate Upload | Settings → Fiscal   | File dropzone + password    | Cancel, Upload       |
| Payment Slip       | View payment        | Hub3 barcode + details      | Close, Download      |
| Form Generator     | Generate PO-SD      | Year/quarter selection      | Cancel, Generate     |

### 9.4 Empty States

Every list/table has an empty state:

| Page              | Empty State Message           | CTA                     |
| ----------------- | ----------------------------- | ----------------------- |
| Invoices          | "Nemate još nijedan račun"    | "Izradi prvi račun"     |
| Contacts          | "Nemate još nijedan kontakt"  | "Dodaj kontakt"         |
| Products          | "Nemate još nijedan proizvod" | "Dodaj proizvod"        |
| Expenses          | "Nemate još nijedan trošak"   | "Dodaj trošak"          |
| Bank Transactions | "Nema transakcija"            | "Poveži bankovni račun" |

### 9.5 Toast Notifications

| Type    | Icon          | Background | Duration |
| ------- | ------------- | ---------- | -------- |
| Success | CheckCircle   | Green      | 3s       |
| Error   | XCircle       | Red        | 5s       |
| Warning | AlertTriangle | Yellow     | 4s       |
| Info    | Info          | Blue       | 3s       |

**Examples:**

- Success: "Račun uspješno kreiran!"
- Error: "Greška pri spremanju. Pokušajte ponovno."
- Warning: "Blizu ste limita od 60.000 EUR"
- Info: "Novi izvještaj je dostupan"

### 9.6 Notification System

FiskAI has a comprehensive notification system for deadlines, warnings, and updates.

#### Notification Types

| Type       | Icon          | Channel        | Example                  |
| ---------- | ------------- | -------------- | ------------------------ |
| `deadline` | Calendar      | In-app + Email | "MIO I due in 3 days"    |
| `warning`  | AlertTriangle | In-app + Email | "85% of VAT threshold"   |
| `success`  | CheckCircle   | In-app only    | "Invoice #123 paid"      |
| `info`     | Info          | In-app only    | "New feature available"  |
| `system`   | Bell          | In-app only    | "Maintenance scheduled"  |
| `payment`  | CreditCard    | In-app + Email | "Payment obligation due" |

#### Delivery Channels

| Channel  | Trigger                                      | Configuration               |
| -------- | -------------------------------------------- | --------------------------- |
| In-App   | Immediate                                    | Always enabled              |
| Email    | Batched (daily digest) or immediate (urgent) | User preferences            |
| Push     | Future                                       | Not implemented             |
| Calendar | Export/sync                                  | Google Calendar integration |

#### User Preferences

```typescript
interface NotificationPreference {
  userId: string
  channel: "EMAIL" | "PUSH" | "CALENDAR"
  enabled: boolean

  // Email reminders
  remind7Days: boolean // 7 days before deadline
  remind3Days: boolean // 3 days before deadline
  remind1Day: boolean // 1 day before deadline
  remindDayOf: boolean // Day of deadline

  // Calendar integration
  googleCalendarConnected: boolean
  googleCalendarId: string

  // Digest frequency
  emailDigest: "daily" | "weekly" | "never"
  urgentEmail: boolean // Immediate for Level 2 warnings

  categories: {
    deadlines: boolean
    payments: boolean
    invoices: boolean
    system: boolean
  }
}
```

**Implementation:**

```typescript
// Create notification
await db.notification.create({
  data: {
    userId: user.id,
    type: "deadline",
    priority: "medium",
    title: "MIO I doprinosi uskoro dospijevaju",
    message: "Rok: 15. siječnja 2025 (za 3 dana)",
    actionUrl: "/pausalni/obligations",
    metadata: { obligationId: "xxx" },
  },
})

// Send email if preferences allow
const prefs = await getUserNotificationPreferences(user.id)
if (prefs.categories.deadlines && prefs.remind3Days) {
  await sendEmail({
    to: user.email,
    template: "deadline-reminder",
    data: { deadline, daysRemaining: 3 },
  })
}
```

### 9.7 Email Integration

FiskAI can connect to user email accounts to auto-import expense receipts.

#### Supported Providers

| Provider      | OAuth            | Status     |
| ------------- | ---------------- | ---------- |
| Gmail         | Google OAuth 2.0 | Production |
| Microsoft 365 | Microsoft OAuth  | Production |
| Other IMAP    | Not supported    | -          |

#### Import Flow

```
1. User connects email via OAuth (/email/connect)
2. System creates EmailConnection record
3. Cron job (15min) fetches new emails (/api/cron/email-sync)
4. Filter by import rules:
   - Sender whitelist (e.g., "faktura@*")
   - Subject patterns (e.g., "Račun*")
   - Attachment types (PDF, images)
5. Matching attachments → Import queue
6. AI extraction (The Clerk agent)
7. User review and confirm
```

#### Import Rules

```typescript
interface EmailImportRule {
  id: string
  connectionId: string
  senderPattern: string // "invoices@*" or "*@supplier.hr"
  subjectPattern?: string // "Invoice*" or "Račun*"
  attachmentTypes: string[] // ["pdf", "jpg", "png"]
  targetCategory?: string // Auto-assign expense category
  autoConfirm: boolean // Skip review for trusted senders
}
```

**Example Rules:**

```typescript
// Auto-import from accounting firm
{
  senderPattern: "*@racunovodstvo.hr",
  subjectPattern: null,
  attachmentTypes: ["pdf"],
  targetCategory: "professional-services",
  autoConfirm: false
}

// Auto-import utility bills
{
  senderPattern: "noreply@hep.hr",
  subjectPattern: "Račun za*",
  attachmentTypes: ["pdf"],
  targetCategory: "utilities",
  autoConfirm: true  // High confidence vendor
}
```

**API Endpoints:**

- `POST /api/email/connect` - Start OAuth flow
- `GET /api/email/callback` - OAuth callback
- `POST /api/email/[connectionId]/disconnect` - Remove connection
- `GET/POST /api/email/rules` - Manage import rules
- `PUT/DELETE /api/email/rules/[id]` - Update/delete rule

**Security:**

- OAuth tokens stored encrypted
- Read-only access to email
- Only attachments are downloaded, not email content
- User can disconnect at any time
- No access to sent emails

---

## 10. Complete User Flows

### 10.1 Authentication Flows

#### Registration

```
1. /register
   └─ Enter email
2. Check if email exists
   ├─ YES → "Email already registered" → Login link
   └─ NO → Continue
3. Set password (or passkey)
4. Verify email (6-digit OTP)
5. Create User record
6. Redirect → /onboarding
```

#### Login

```
1. /login
   └─ Enter email
2. Check auth methods available
   ├─ Has passkey → Offer passkey login
   ├─ Has password → Show password field
   └─ Has both → Show both options
3. Authenticate
4. Check company setup
   ├─ No company → /onboarding
   └─ Has company → /dashboard
```

#### Password Reset

```
1. /forgot-password
   └─ Enter email
2. Send OTP to email
3. Enter OTP
4. Set new password
5. Redirect → /login
```

### 10.2 Invoice Creation Flow

```
1. Click "+ E-Račun" (or navigate to /e-invoices/new)
2. Select buyer (from contacts)
   ├─ Existing contact → Auto-fill
   └─ "Add new" → Quick contact form
3. Set dates (issue date, due date)
4. Add line items
   ├─ Manual entry
   └─ Select from products → Auto-fill price/VAT
5. Review totals
6. Click "Spremi kao nacrt" OR "Fiskaliziraj i pošalji"
   ├─ Draft → Save, redirect to invoice view
   └─ Fiscalize →
       ├─ Generate ZKI
       ├─ Send to CIS
       ├─ Receive JIR
       ├─ Save with JIR/ZKI
       └─ Option: Send via email
```

### 10.3 Bank Reconciliation Flow

```
1. Navigate to /banking/reconciliation
2. View unmatched transactions
3. For each transaction:
   ├─ System suggests matches (AI)
   │   └─ "This looks like payment for Invoice #001"
   ├─ User actions:
   │   ├─ Accept match → Link transaction to invoice
   │   ├─ Reject match → Mark as ignored
   │   └─ Manual match → Search invoices/expenses
   └─ Create new:
       ├─ "Create expense from this" → Opens expense form
       └─ "Create income from this" → Opens invoice form
4. Transaction status updates:
   UNMATCHED → AUTO_MATCHED → confirmed
   UNMATCHED → MANUAL_MATCHED → confirmed
   UNMATCHED → IGNORED
```

### 10.4 Paušalni Monthly Flow

```
Monthly Contribution Payment:
1. Dashboard shows "Doprinosi dospijevaju za 5 dana"
2. Click → Opens payment details
3. View:
   ├─ MIO I: 107.88 EUR
   ├─ MIO II: 35.96 EUR
   ├─ HZZO: 118.67 EUR
   └─ Total: 262.51 EUR
4. Generate payment slips (Hub3 barcode)
5. Mark as paid when done
```

```
Quarterly Tax Payment:
1. Dashboard shows "Porez na dohodak dospijeva"
2. Click → Opens quarterly calculation
3. System calculates based on revenue bracket
4. Generate payment slip
5. Mark as paid
```

```
Annual PO-SD Submission:
1. January: System prompts "Time for PO-SD"
2. Click "Generate PO-SD"
3. Review auto-filled form
4. Download XML
5. Submit to ePorezna (external)
6. Upload confirmation
```

### 10.5 VAT Return Flow (DOO/JDOO)

```
1. Navigate to /reports/vat
2. Select period (month or quarter)
3. System calculates:
   ├─ Output VAT (from sales invoices)
   ├─ Input VAT (from purchase invoices/expenses)
   └─ Net payable/refund
4. Review URA (incoming) register
5. Review IRA (outgoing) register
6. Generate PDV-RR form
7. Download XML
8. Submit to ePorezna
9. If payable: Generate payment slip
```

### 10.6 Fiscal Certificate Management

Required for businesses accepting cash/card payments (fiscalization).

#### Certificate Upload Flow

```
1. Navigate to /settings/fiscal
2. Click "Upload Certificate"
3. Select .p12 file from FINA
4. Enter certificate password
5. System validates:
   - File format (PKCS#12)
   - Certificate not expired
   - OIB matches company
   - Certificate issuer is FINA
6. Store encrypted in database
7. Mark company as fiscal-enabled
8. Display certificate details (valid from/to, OIB)
```

#### Certificate Lifecycle

| Status     | Meaning                 | Action                               |
| ---------- | ----------------------- | ------------------------------------ |
| `PENDING`  | Uploaded, not validated | Validate password                    |
| `ACTIVE`   | Ready for fiscalization | None                                 |
| `EXPIRING` | <30 days to expiry      | Show renewal warning                 |
| `EXPIRED`  | Cannot fiscalize        | Block cash invoices, upload new cert |
| `REVOKED`  | Manually invalidated    | Upload new cert                      |

#### Multi-Premises Support

```typescript
interface BusinessPremises {
  id: string
  companyId: string
  label: string // "Glavni ured", "Poslovnica 2"
  address: string
  city: string
  postalCode: string
  posDeviceId?: string // Linked POS terminal
  isDefault: boolean
  fiscalEnabled: boolean
}
```

Each premises can have its own fiscal device numbering. When creating a cash invoice, the user selects which premises issued it.

**Server Actions:**

- `uploadCertificate(file, password)` - Upload and validate cert
- `validateCertificate(certId)` - Check if still valid
- `deleteCertificate(certId)` - Remove cert (requires confirmation)

### 10.7 POS Terminal Operations

For retail businesses with Stripe Terminal (in-person card payments).

#### Terminal Setup Flow

```
1. Order Stripe Terminal reader (BBPOS WisePOS E)
2. Navigate to /pos/setup
3. Click "Pair Reader"
4. System generates connection token via /api/terminal/connection-token
5. Reader displays pairing code
6. Enter code in FiskAI
7. Reader linked to premises
8. Test transaction (1.00 EUR)
9. Terminal ready
```

#### Transaction Flow

```
1. Navigate to /pos
2. Create new sale
3. Add items (from Products catalog)
   - Select product
   - Set quantity
   - Adjust price if needed
4. Calculate total (with VAT)
5. Select payment method:
   - Cash → Skip to step 7
   - Card → Continue to step 6
6. If card:
   - Send to reader via /api/terminal/payment-intent
   - Customer taps/inserts card
   - Wait for authorization (3-30 seconds)
   - If declined: Show error, retry or select different method
   - If approved: Continue to step 7
7. Fiscalize invoice to CIS
8. Generate JIR/ZKI
9. Print/email receipt
10. Update inventory (if enabled)
11. Record payment in cash book
```

#### Terminal Statuses

| Status     | Meaning                | Action                    |
| ---------- | ---------------------- | ------------------------- |
| `ONLINE`   | Ready for transactions | None                      |
| `OFFLINE`  | Network issue          | Check internet connection |
| `BUSY`     | Processing transaction | Wait for completion       |
| `UPDATING` | Firmware update        | Wait 5-10 minutes         |
| `ERROR`    | Hardware issue         | Contact support           |

**Implementation:**

```typescript
// Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: total * 100, // cents
  currency: "eur",
  payment_method_types: ["card_present"],
  capture_method: "automatic",
})

// Send to terminal
const result = await stripe.terminal.readers.processPaymentIntent(readerId, {
  payment_intent: paymentIntent.id,
})

if (result.action_required) {
  // Customer needs to take action (insert chip, etc.)
  await waitForCustomerAction(result)
}

if (result.status === "succeeded") {
  // Payment successful, fiscalize
  await fiscalizeInvoice(invoiceId)
}
```

**Refunds:**

- Same-day refunds: Void transaction (no fiscal needed)
- Next-day refunds: Create fiscalized refund invoice (Storno)
- Partial refunds: Create credit note

**Hardware:**

- Recommended: BBPOS WisePOS E (299 EUR)
- Alternative: Stripe Reader M2 (59 EUR, mobile only)
- Connection: WiFi or Ethernet
- Receipt printer: Built-in thermal printer

---

## 11. Tax & Regulatory Data

### 11.1 Key Thresholds (2025)

| Threshold            | Amount        | Consequence                                   |
| -------------------- | ------------- | --------------------------------------------- |
| VAT Registration     | 60,000 EUR    | Must register for VAT within 8 days           |
| Paušalni Limit       | 60,000 EUR    | Must switch to real income basis              |
| Cash B2B Limit       | 700 EUR       | Fines for both parties if exceeded            |
| Asset Capitalization | 665.00 EUR    | Must depreciate over useful life (2025 value) |
| Small Business       | 1,000,000 EUR | Corporate tax 10% vs 18%                      |

### 11.2 Tax Rates

**Income Tax (Porez na dohodak):**
| Bracket | Rate | With Surtax (~18%) |
|---------|------|-------------------|
| 0 - 50,400 EUR | 20% | ~23.6% |
| 50,400+ EUR | 30% | ~35.4% |

**Corporate Tax (Porez na dobit):**
| Revenue | Rate |
|---------|------|
| ≤ 1,000,000 EUR | 10% |
| > 1,000,000 EUR | 18% |

**VAT Rates:**
| Rate | Applies To |
|------|------------|
| 25% | Most goods and services |
| 13% | Hospitality, newspapers |
| 5% | Bread, milk, books, medicines |
| 0% | Exports, financial services |

**Paušalni Tax Brackets (2025):**

Base rate: 12% (excluding municipal surtax)

| Tier | Annual Revenue (EUR)  | Tax Base (EUR) | Quarterly Tax (EUR) |
| ---- | --------------------- | -------------- | ------------------- |
| 1    | 0.00 - 11,300.00      | 1,695.00       | 50.85               |
| 2    | 11,300.01 - 15,300.00 | 2,295.00       | 68.85               |
| 3    | 15,300.01 - 19,900.00 | 2,985.00       | 89.55               |
| 4    | 19,900.01 - 30,600.00 | 4,590.00       | 137.70              |
| 5    | 30,600.01 - 40,000.00 | 6,000.00       | 180.00              |
| 6    | 40,000.01 - 50,000.00 | 7,500.00       | 225.00              |
| 7    | 50,000.01 - 60,000.00 | 9,000.00       | 270.00              |

_Source: Porezna Uprava, effective 2025-01-01_

### 11.3 Contribution Rates (2025)

| Contribution        | Rate      | Minimum Monthly |
| ------------------- | --------- | --------------- |
| MIO I (Pension I)   | 15%       | 107.88 EUR      |
| MIO II (Pension II) | 5%        | 35.96 EUR       |
| HZZO (Health)       | 16.5%     | 118.67 EUR      |
| **Total**           | **36.5%** | **262.51 EUR**  |

Minimum base: 719.2 EUR/month

### 11.4 Payment IBANs

| Payment Type | IBAN                  | Model |
| ------------ | --------------------- | ----- |
| State Budget | HR1210010051863000160 | HR68  |
| MIO II       | HR8724070001007120013 | HR68  |
| HZZO         | HR6510010051550100001 | HR68  |
| HOK          | HR1223400091100106237 | HR68  |

### 11.5 Deadlines Calendar

**Monthly:**
| Day | What | Who |
|-----|------|-----|
| 15th | Contributions (MIO, HZZO) | All |
| 15th | JOPPD | Employers |
| 20th | PDV (monthly filers) | VAT > 800k |

**Quarterly:**
| When | What | Who |
|------|------|-----|
| 20.01/04/07/10 | PDV (quarterly) | Small VAT payers |
| 31.01/04/07/10 | Paušalni tax | Paušalni obrt |
| 27.02/31.05/31.08/30.11 | HOK | All obrts |

**Annual:**
| When | What | Who |
|------|------|-----|
| 15.01 | PO-SD | Paušalni |
| 28.02 | DOH | Obrt dohodak |
| 30.04 | PDO | D.O.O. |

---

## 12. Integration Ecosystem

### 12.1 External Systems

| System        | Purpose                 | Status        | Notes                   |
| ------------- | ----------------------- | ------------- | ----------------------- |
| FINA CIS      | Fiscalization (JIR/ZKI) | ⚠️ 60%        | Core logic ready        |
| IE-Računi     | E-invoice intermediary  | ⚠️ Planned    | API integration pending |
| Gocardless    | PSD2 bank sync          | ✅ Production | Primary bank provider   |
| SaltEdge      | PSD2 bank sync          | ⚠️ Planned    | Secondary provider      |
| Stripe        | Payments + Terminal     | ✅ Production | Subscriptions active    |
| Resend        | Transactional email     | ✅ Production | All email flows         |
| Cloudflare R2 | Document storage        | ✅ Production | 11-year archive         |

### 12.2 E-Invoice Providers

| Provider   | Type         | Status     | Notes                    |
| ---------- | ------------ | ---------- | ------------------------ |
| Mock       | Testing      | ✅ Full    | Development/testing only |
| IE-Računi  | Intermediary | ⚠️ Planned | Q1 2025 target           |
| FINA       | Direct       | ⚠️ Planned | Requires certification   |
| Moj-eRačun | Intermediary | ❌ Not yet | Low priority             |

### 12.3 Bank Import Formats

| Format         | Extension | Status | Notes                  |
| -------------- | --------- | ------ | ---------------------- |
| CSV (generic)  | .csv      | ✅     | Manual column mapping  |
| CAMT.053       | .xml      | ✅     | ISO 20022 standard     |
| Erste CSV      | .csv      | ✅     | Pre-configured mapping |
| Raiffeisen CSV | .csv      | ✅     | Pre-configured mapping |
| PBZ Export     | .csv      | ⚠️ WIP | Parser in development  |
| MT940          | .sta      | ❌     | Not yet implemented    |

### 12.4 Proactive AI Agents

FiskAI uses AI agents that **act proactively**, not just respond to queries.

#### Agent: The Watchdog (Regulatory Guardian)

**Trigger:** Daily cron job + every invoice creation

**Purpose:** Monitor revenue limits and warn before thresholds are breached

**Algorithm:**

```typescript
1. current_revenue = Sum(Invoices.total) WHERE year = current
2. proximity = current_revenue / 60000  // 2025 threshold for paušalni
3. If proximity > 0.85 → Level 1 Warning (Dashboard Banner)
4. If proximity > 0.95 → Level 2 Emergency (Email to User + Accountant)
5. Action: Display link to "Prijelaz na D.O.O." guide
```

**UI Components:**

- `card:pausalni-status` - Shows limit progress bar
- `card:insights-widget` - Displays proactive warnings

**Implementation:**

```typescript
// Runs in /api/cron/deadline-reminders
const revenue = await getYearlyRevenue(companyId)
const threshold = 60000 // EUR
const percentage = (revenue / threshold) * 100

if (percentage > 95) {
  await sendEmail({
    template: "threshold-emergency",
    to: [user.email, accountant?.email],
    data: { revenue, threshold, percentage },
  })
  await createNotification({
    type: "warning",
    priority: "high",
    message: "HITNO: Približavate se limitu paušalnog obrta",
  })
} else if (percentage > 85) {
  await createNotification({
    type: "warning",
    priority: "medium",
    message: `Ostvarili ste ${percentage.toFixed(0)}% paušalnog limita`,
  })
}
```

#### Agent: The Clerk (OCR & Categorization)

**Trigger:** Document upload to Expense Vault

**Purpose:** Extract invoice data and auto-categorize expenses

**Algorithm:**

```typescript
1. Input: JPEG/PNG/PDF from expense upload
2. Extract: Use Claude-3-Haiku via /api/ai/extract for text extraction
3. Parse: Date, Amount, Vendor OIB, VAT amount, Line items
4. Lookup: Check vendor OIB against Contact database
5. If unknown vendor: Search official register (OIB API) → auto-create Contact
6. Categorize: Match description to expense categories using AI
7. VAT check: Verify deductibility via VIES if vendor has VAT ID
8. If amount > 665 EUR: Suggest asset capitalization
```

**Confidence Thresholds:**

- **High (>0.9):** Auto-fill fields, minimal review required
- **Medium (0.7-0.9):** Auto-fill with "Please verify" prompt
- **Low (<0.7):** Manual entry required, show extracted text

**Implementation:**

```typescript
// /api/ai/extract
const extraction = await claude.extract(imageBuffer, {
  fields: ["vendor", "date", "total", "oib", "items"],
  language: "hr",
})

if (extraction.confidence > 0.9) {
  // Auto-create expense draft
  await createExpense({
    vendorId: await findOrCreateVendor(extraction.oib),
    amount: extraction.total,
    date: extraction.date,
    category: await suggestCategory(extraction.items),
    needsReview: false,
  })
} else {
  // Queue for manual review
  await createImportJob({
    status: "NEEDS_REVIEW",
    extractedData: extraction,
    confidence: extraction.confidence,
  })
}
```

#### Agent: The Matcher (Bank Reconciliation)

**Trigger:** Bank transaction import (daily PSD2 sync or manual upload)

**Purpose:** Auto-match bank transactions to invoices

**Algorithm:**

```typescript
1. Input: BankTransaction row from sync
2. Extract: pozivNaBroj (payment reference number) from description
3. Match strategies (in order):
   a. Exact match: transaction.pozivNaBroj === invoice.invoiceNumber
   b. Fuzzy match: transaction.amount === invoice.total (±0.05 EUR tolerance)
   c. Vendor match: transaction.counterparty contains invoice.customer.name
4. If match confidence > 0.9: Auto-mark invoice as PAID
5. Else: Add to reconciliation queue for manual review
6. Create reconciliation record with match confidence
```

**Match Statuses:**

- `UNMATCHED` - New transaction, no invoice found
- `AUTO_MATCHED` - High confidence (>0.9), pending confirmation
- `MANUAL_MATCHED` - User-confirmed match
- `IGNORED` - User marked as non-invoice (e.g., expense, transfer)

**Implementation:**

```typescript
// /api/banking/reconciliation/match
async function autoMatchTransaction(transaction: BankTransaction) {
  // Strategy 1: Reference number match
  if (transaction.reference) {
    const invoice = await findInvoiceByNumber(transaction.reference)
    if (invoice && Math.abs(invoice.total - transaction.amount) < 0.05) {
      return { invoice, confidence: 0.95, method: "reference" }
    }
  }

  // Strategy 2: Amount + date proximity
  const candidates = await findInvoicesByAmount(transaction.amount, 0.05)
  for (const invoice of candidates) {
    const daysDiff = Math.abs(differenceInDays(transaction.date, invoice.issueDate))
    if (daysDiff <= 30) {
      return { invoice, confidence: 0.75, method: "amount-date" }
    }
  }

  // Strategy 3: Vendor name fuzzy match
  const vendorMatch = await fuzzyMatchVendor(transaction.counterparty)
  if (vendorMatch.confidence > 0.8) {
    const invoice = await findRecentInvoice(vendorMatch.vendorId)
    return { invoice, confidence: 0.7, method: "vendor" }
  }

  return { invoice: null, confidence: 0, method: "none" }
}
```

**UI Flow:**

1. User imports bank statement
2. System auto-matches transactions
3. Dashboard shows:
   - Green: X auto-matched (ready to confirm)
   - Yellow: Y suggestions (manual review)
   - Red: Z unmatched (action needed)
4. User reviews suggestions, confirms or rejects
5. Confirmed matches update invoice status to PAID

---

## 13. Monetization & Pricing

### 13.1 Tier Structure

| Tier           | Price     | Status     | Includes                                                                 |
| -------------- | --------- | ---------- | ------------------------------------------------------------------------ |
| **Free**       | 0 EUR     | ✅ Active  | Invoicing, Contacts, Products, Expenses, Basic Reports, Documents        |
| **Paušalni**   | 9 EUR/mo  | ✅ Active  | Free + Paušalni module, Contributions tracking, Banking                  |
| **Pro**        | 19 EUR/mo | ✅ Active  | Paušalni + Fiscalization, Reconciliation, Advanced Reports, AI Assistant |
| **Business**   | 39 EUR/mo | ⚠️ Planned | Pro + VAT, Corporate Tax, Multi-user                                     |
| **Enterprise** | Custom    | ⚠️ Planned | Business + Staff assignments, Custom integrations                        |

**Note:** Business and Enterprise tiers are planned but not yet available in Stripe. Current production supports Free, Paušalni, and Pro.

### 13.2 Module-to-Tier Mapping

| Module           | Free | Paušalni | Pro | Business | Enterprise |
| ---------------- | ---- | -------- | --- | -------- | ---------- |
| invoicing        | ✅   | ✅       | ✅  | ✅       | ✅         |
| e-invoicing      | ✅   | ✅       | ✅  | ✅       | ✅         |
| contacts         | ✅   | ✅       | ✅  | ✅       | ✅         |
| products         | ✅   | ✅       | ✅  | ✅       | ✅         |
| expenses         | ✅   | ✅       | ✅  | ✅       | ✅         |
| banking          | ❌   | ✅       | ✅  | ✅       | ✅         |
| documents        | ✅   | ✅       | ✅  | ✅       | ✅         |
| reports-basic    | ✅   | ✅       | ✅  | ✅       | ✅         |
| pausalni         | ❌   | ✅       | ❌  | ❌       | ✅         |
| fiscalization    | ❌   | ❌       | ✅  | ✅       | ✅         |
| reconciliation   | ❌   | ❌       | ✅  | ✅       | ✅         |
| reports-advanced | ❌   | ❌       | ✅  | ✅       | ✅         |
| vat              | ❌   | ❌       | ❌  | ✅       | ✅         |
| corporate-tax    | ❌   | ❌       | ❌  | ✅       | ✅         |
| ai-assistant     | ❌   | ❌       | ❌  | ✅       | ✅         |
| pos              | ❌   | ❌       | ❌  | ❌       | ✅         |

### 13.3 Stripe Integration

| Feature           | Implementation                    |
| ----------------- | --------------------------------- |
| Checkout          | `/api/billing/checkout`           |
| Customer Portal   | `/api/billing/portal`             |
| Webhooks          | `/api/billing/webhook`            |
| Subscription Sync | `stripeSubscriptionId` on Company |

---

## 14. Implementation Status Matrix

### 14.1 Can We Serve These Scenarios?

| #     | Scenario            | Status | Blockers                  |
| ----- | ------------------- | ------ | ------------------------- |
| 1     | Paušalni, no cash   | ✅ YES | None                      |
| 2     | Paušalni, with cash | ⚠️ 60% | Fiscalization polish      |
| 3-4   | Paušalni, VAT       | ⚠️ 40% | PDV forms                 |
| 5-8   | Obrt Real           | ❌ NO  | KPI, URA/IRA, Assets      |
| 9-12  | Obrt VAT            | ❌ NO  | KPI, URA/IRA, Assets, PDV |
| 13-16 | j.d.o.o.            | ❌ NO  | URA/IRA, Assets, full PDV |
| 17-20 | d.o.o.              | ❌ NO  | URA/IRA, Assets, full PDV |

### 14.2 Module Completion Status

| Module           | Status | Notes                          |
| ---------------- | ------ | ------------------------------ |
| Invoicing        | 80%    | Polish remaining               |
| E-Invoicing      | 90%    | Production ready               |
| Contacts         | 95%    | Minor UX fixes                 |
| Products         | 90%    | Import wizard needed           |
| Expenses         | 85%    | Receipt scanner polish         |
| Banking          | 75%    | Reconciliation AI needed       |
| Documents        | 80%    | Archive complete               |
| Reports Basic    | 90%    | KPR complete                   |
| Reports Advanced | 40%    | PDV/URA/IRA incomplete         |
| Pausalni         | 95%    | Production ready               |
| Fiscalization    | 60%    | FINA cert upload needed        |
| VAT              | 40%    | Forms incomplete               |
| Corporate Tax    | 10%    | Just calculations              |
| AI Assistant     | 70%    | Chat works, extraction partial |
| POS              | 30%    | Stripe Terminal WIP            |
| JOPPD            | 0%     | Not started                    |
| Assets (DI)      | 0%     | Not started                    |
| KPI              | 0%     | Not started                    |
| URA/IRA          | 30%    | Partial implementation         |

### 14.3 Development Priorities

**Tier 1 (Launch for Paušalni):** ~2 weeks

- [ ] Fiscalization polish (60% → 90%)
- [ ] Payment Hub3 generator
- [ ] HOK/contribution reminders

**Tier 2 (Unlock Obrt Dohodak):** ~4 weeks

- [ ] KPI module
- [ ] URA/IRA reports
- [ ] Assets (DI) module

**Tier 3 (Full D.O.O.):** ~4 weeks

- [ ] Complete PDV forms
- [ ] Enhanced URA/IRA
- [ ] Corporate tax calculation

**Tier 4 (Premium):** ~6 weeks

- [ ] JOPPD (Payroll)
- [ ] Travel/Locco
- [ ] Advanced analytics

---

## 15. Data Models

### 15.1 Core Models

```prisma
model User {
  id           String      @id
  email        String      @unique
  name         String?
  systemRole   SystemRole  @default(USER)  // USER, STAFF, ADMIN
  companies    CompanyUser[]
}

model Company {
  id               String    @id
  name             String
  oib              String    @unique
  legalForm        LegalForm // OBRT_PAUSAL, OBRT_REAL, OBRT_VAT, JDOO, DOO
  isVatPayer       Boolean   @default(false)
  vatNumber        String?   // HR + OIB if VAT payer
  address          String
  postalCode       String
  city             String
  email            String
  phone            String?
  iban             String
  entitlements     Json      // ["invoicing", "e-invoicing", ...]
  featureFlags     Json      // { competence: "beginner", ... }
  eInvoiceProvider String?   // "ie-racuni", "fina", "mock"
  fiscalEnabled    Boolean   @default(false)
  users            CompanyUser[]
  invoices         EInvoice[]
  contacts         Contact[]
  products         Product[]
  expenses         Expense[]
  // ... more relations
}

model CompanyUser {
  id        String  @id
  userId    String
  companyId String
  role      Role    // OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER
  isDefault Boolean @default(false)
}
```

### 15.2 Invoice Model

**From `/prisma/schema.prisma`:**

```prisma
model EInvoice {
  id                String            @id @default(cuid())
  companyId         String
  direction         EInvoiceDirection // OUTBOUND, INBOUND
  sellerId          String?
  buyerId           String?
  invoiceNumber     String
  issueDate         DateTime
  dueDate           DateTime?
  currency          String            @default("EUR")
  buyerReference    String?
  netAmount         Decimal           @db.Decimal(10, 2)
  vatAmount         Decimal           @db.Decimal(10, 2)
  totalAmount       Decimal           @db.Decimal(10, 2)
  status            EInvoiceStatus    @default(DRAFT)
  jir               String?
  zki               String?
  fiscalizedAt      DateTime?
  ublXml            String?
  providerRef       String?
  providerStatus    String?
  providerError     String?
  archivedAt        DateTime?
  archiveRef        String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  sentAt            DateTime?
  receivedAt        DateTime?
  type              InvoiceType       @default(E_INVOICE)
  internalReference String?
  notes             String?
  convertedFromId   String?
  paidAt            DateTime?
  bankAccount       String?
  includeBarcode    Boolean           @default(true)
  importJobId       String?           @unique
  paymentModel      String?
  paymentReference  String?
  vendorBankName    String?
  vendorIban        String?
  fiscalStatus      String?
}

enum EInvoiceDirection {
  OUTBOUND
  INBOUND
}

enum EInvoiceStatus {
  DRAFT
  PENDING_FISCALIZATION
  FISCALIZED
  SENT
  DELIVERED
  ACCEPTED
  REJECTED
  ARCHIVED
  ERROR
}

enum InvoiceType {
  INVOICE
  E_INVOICE
  QUOTE
  PROFORMA
  CREDIT_NOTE
  DEBIT_NOTE
}
```

### 15.3 Drizzle ORM Models

These tables are managed by Drizzle (not Prisma) for performance-critical or newer features.

**Location:** `/src/lib/db/schema/`

| Schema File     | Tables                                                                                                               | Purpose                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `guidance.ts`   | `user_guidance_preferences`, `checklist_interactions`                                                                | User competence levels, setup progress |
| `pausalni.ts`   | `pausalni_profile`, `eu_vendor`, `eu_transaction`, `payment_obligation`, `generated_form`, `notification_preference` | Paušalni compliance hub                |
| `news.ts`       | `news_sources`, `news_items`, `news_posts`, `news_categories`, `news_tags`, `news_post_sources`                      | News aggregation system                |
| `newsletter.ts` | `newsletter_subscriptions`                                                                                           | Newsletter subscribers                 |
| `deadlines.ts`  | `compliance_deadlines`                                                                                               | Generated tax deadlines                |

**Example Schema:**

```typescript
// src/lib/db/schema/guidance.ts
export const userGuidancePreferences = pgTable("user_guidance_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Competence levels per category (beginner, average, pro)
  levelFakturiranje: varchar("level_fakturiranje", { length: 20 }).default("beginner"),
  levelFinancije: varchar("level_financije", { length: 20 }).default("beginner"),
  levelEu: varchar("level_eu", { length: 20 }).default("beginner"),

  // Global quick-set
  globalLevel: varchar("global_level", { length: 20 }),

  // Notification preferences
  emailDigest: varchar("email_digest", { length: 20 }).default("weekly"),
  pushEnabled: boolean("push_enabled").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
```

**Paušalni Profile Schema:**

```typescript
// src/lib/db/schema/pausalni.ts
export const pausalniProfile = pgTable("pausalni_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: text("company_id").notNull(),
  hasPdvId: boolean("has_pdv_id").default(false),
  pdvId: varchar("pdv_id", { length: 20 }), // HR12345678901
  pdvIdSince: date("pdv_id_since"),
  euActive: boolean("eu_active").default(false),
  hokMemberSince: date("hok_member_since"),
  tourismActivity: boolean("tourism_activity").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const paymentObligation = pgTable("payment_obligation", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: text("company_id").notNull(),
  obligationType: varchar("obligation_type", { length: 50 }).notNull(),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 20 }).default("PENDING"),
  paidDate: date("paid_date"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
})
```

**News System Schema:**

```typescript
// src/lib/db/schema/news.ts
export const newsPosts = pgTable("news_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull(), // 'individual' | 'digest'
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(), // markdown
  excerpt: varchar("excerpt", { length: 500 }),
  categoryId: varchar("category_id", { length: 50 }),
  tags: jsonb("tags").default([]),
  impactLevel: varchar("impact_level", { length: 20 }), // 'high' | 'medium' | 'low'
  status: varchar("status", { length: 20 }).default("draft"), // 'draft' | 'reviewing' | 'published'
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
```

**Why Both Prisma and Drizzle?**

- **Prisma:** Core business entities (invoices, companies, users) - mature, stable schema
- **Drizzle:** New features and performance-critical tables - faster queries, better PostgreSQL support
- **Migration path:** Gradual migration from Prisma to Drizzle for all tables (planned)

### 15.4 Missing Models (To Be Implemented)

```prisma
// KPI - Income/Expense Book (for Obrt Dohodak)
model KPIEntry {
  id            String   @id
  companyId     String
  date          DateTime
  type          KPIType  // INCOME or EXPENSE
  documentType  String
  documentId    String?
  description   String
  amount        Decimal
  paymentMethod String   // G, K, T, O
  category      String?
}

// Fixed Assets
model FixedAsset {
  id                String   @id
  companyId         String
  name              String
  category          AssetCategory
  acquisitionDate   DateTime
  acquisitionCost   Decimal
  usefulLifeMonths  Int
  depreciationMethod DepreciationMethod
  status            AssetStatus
}

// Employee & Payroll (for JOPPD)
model Employee {
  id            String   @id
  companyId     String
  oib           String
  firstName     String
  lastName      String
  contractType  ContractType
  grossSalary   Decimal
  payrolls      Payroll[]
}

model Payroll {
  id                String   @id
  employeeId        String
  period            DateTime
  grossSalary       Decimal
  pensionI          Decimal
  pensionII         Decimal
  healthInsurance   Decimal
  incomeTax         Decimal
  netSalary         Decimal
}
```

---

## 16. API Reference

### 16.1 Route Groups

| Group      | Base Path           | Purpose              |
| ---------- | ------------------- | -------------------- |
| Auth       | `/api/auth/*`       | Authentication       |
| Billing    | `/api/billing/*`    | Stripe integration   |
| Invoices   | `/api/invoices/*`   | Invoice CRUD         |
| E-Invoices | `/api/e-invoices/*` | E-invoice operations |
| Banking    | `/api/banking/*`    | Bank sync & import   |
| Expenses   | `/api/expenses/*`   | Expense management   |
| Reports    | `/api/reports/*`    | Report generation    |
| Pausalni   | `/api/pausalni/*`   | Paušalni features    |
| Admin      | `/api/admin/*`      | Platform management  |
| Cron       | `/api/cron/*`       | Scheduled jobs       |

### 16.2 Key Endpoints

**Invoices:**

```
POST   /api/invoices           Create invoice
GET    /api/invoices           List invoices
GET    /api/invoices/[id]      Get invoice
PATCH  /api/invoices/[id]      Update invoice
DELETE /api/invoices/[id]      Delete invoice
GET    /api/invoices/[id]/pdf  Generate PDF
POST   /api/invoices/[id]/send Send via email
```

**E-Invoices:**

```
POST   /api/e-invoices              Create e-invoice
POST   /api/e-invoices/[id]/fiscalize  Fiscalize
POST   /api/e-invoices/receive      Receive incoming (webhook)
```

**Banking:**

```
POST   /api/banking/import/upload   Upload file
POST   /api/banking/import/process  Process import
GET    /api/banking/transactions    List transactions
POST   /api/banking/reconciliation/match  Match transaction
```

**Pausalni:**

```
GET    /api/pausalni/forms          List generated forms
POST   /api/pausalni/forms/po-sd    Generate PO-SD
GET    /api/pausalni/obligations    List payment obligations
GET    /api/pausalni/calendar       Tax calendar
```

### 16.3 Server Actions

| File            | Actions                                     |
| --------------- | ------------------------------------------- |
| `company.ts`    | createCompany, updateCompany, switchCompany |
| `invoice.ts`    | createInvoice, updateInvoice, deleteInvoice |
| `expense.ts`    | createExpense, updateExpense, deleteExpense |
| `contact.ts`    | createContact, updateContact, deleteContact |
| `onboarding.ts` | getOnboardingData, saveOnboardingData       |
| `guidance.ts`   | saveCompetenceLevel, getGuidancePreferences |
| `fiscalize.ts`  | uploadCertificate, testConnection           |

---

## 17. Complete API Reference

### 17.1 Authentication & Authorization

| Endpoint                        | Method | Purpose                       |
| ------------------------------- | ------ | ----------------------------- |
| `/api/auth/[...nextauth]`       | ALL    | NextAuth.js handler           |
| `/api/auth/check-email`         | POST   | Check email availability      |
| `/api/auth/register`            | POST   | User registration             |
| `/api/auth/send-code`           | POST   | Send verification code        |
| `/api/auth/verify-code`         | POST   | Verify authentication code    |
| `/api/auth/reset-password`      | POST   | Password reset                |
| `/api/webauthn/register/start`  | POST   | Start passkey registration    |
| `/api/webauthn/register/finish` | POST   | Complete passkey registration |
| `/api/webauthn/login/start`     | POST   | Start passkey login           |
| `/api/webauthn/login/finish`    | POST   | Complete passkey login        |
| `/api/webauthn/passkeys`        | GET    | List user passkeys            |
| `/api/webauthn/passkeys/[id]`   | DELETE | Remove passkey                |
| `/api/admin/auth`               | POST   | Admin authentication          |

### 17.2 Banking & Reconciliation

| Endpoint                               | Method | Purpose                      |
| -------------------------------------- | ------ | ---------------------------- |
| `/api/bank/connect`                    | POST   | Initiate PSD2 connection     |
| `/api/bank/disconnect`                 | POST   | Remove bank connection       |
| `/api/bank/callback`                   | GET    | OAuth callback handler       |
| `/api/banking/import/upload`           | POST   | Upload bank statement        |
| `/api/banking/import/process`          | POST   | Process uploaded statement   |
| `/api/banking/import/jobs/[id]`        | GET    | Get import job status        |
| `/api/banking/import/jobs/[id]/file`   | GET    | Retrieve original file       |
| `/api/banking/import/jobs/[id]/status` | GET    | Check processing status      |
| `/api/banking/reconciliation`          | GET    | List unmatched transactions  |
| `/api/banking/reconciliation/match`    | POST   | Match transaction to invoice |

### 17.3 E-Invoicing & Fiscalization

| Endpoint                  | Method | Purpose                         |
| ------------------------- | ------ | ------------------------------- |
| `/api/e-invoices/inbox`   | GET    | List received e-invoices        |
| `/api/e-invoices/receive` | POST   | Webhook for incoming e-invoices |
| `/api/invoices/[id]/pdf`  | GET    | Generate invoice PDF            |
| `/api/compliance/en16931` | POST   | Validate EN 16931 compliance    |
| `/api/sandbox/e-invoice`  | POST   | Test e-invoice endpoint         |

### 17.4 Billing & Subscriptions

| Endpoint                | Method | Purpose                        |
| ----------------------- | ------ | ------------------------------ |
| `/api/billing/checkout` | POST   | Create Stripe checkout session |
| `/api/billing/portal`   | POST   | Open Stripe customer portal    |
| `/api/billing/webhook`  | POST   | Handle Stripe webhooks         |

### 17.5 Paušalni Features

| Endpoint                                     | Method  | Purpose                     |
| -------------------------------------------- | ------- | --------------------------- |
| `/api/pausalni/profile`                      | GET/PUT | Get/update paušalni profile |
| `/api/pausalni/preferences`                  | PUT     | Update display preferences  |
| `/api/pausalni/obligations`                  | GET     | List payment obligations    |
| `/api/pausalni/obligations/[id]/mark-paid`   | POST    | Mark obligation as paid     |
| `/api/pausalni/income-summary`               | GET     | Get income summary          |
| `/api/pausalni/eu-transactions`              | GET     | List EU transactions        |
| `/api/pausalni/eu-transactions/[id]/confirm` | POST    | Confirm EU transaction      |
| `/api/pausalni/forms`                        | POST    | Generate tax forms          |
| `/api/pausalni/forms/[id]/download`          | GET     | Download generated form     |
| `/api/pausalni/payment-slip`                 | POST    | Generate Hub3 payment slip  |
| `/api/pausalni/calendar/export`              | GET     | Export deadline calendar    |
| `/api/pausalni/calendar/google/sync`         | POST    | Sync to Google Calendar     |

### 17.6 AI Features

| Endpoint                   | Method | Purpose                     |
| -------------------------- | ------ | --------------------------- |
| `/api/ai/extract`          | POST   | Extract data from document  |
| `/api/ai/feedback`         | POST   | Submit extraction feedback  |
| `/api/ai/suggest-category` | POST   | Get category suggestion     |
| `/api/ai/usage`            | GET    | Get AI usage stats          |
| `/api/assistant/chat`      | POST   | AI assistant chat interface |

### 17.7 Email Integration

| Endpoint                               | Method     | Purpose                |
| -------------------------------------- | ---------- | ---------------------- |
| `/api/email/connect`                   | POST       | Start email OAuth flow |
| `/api/email/callback`                  | GET        | OAuth callback         |
| `/api/email/[connectionId]/disconnect` | POST       | Disconnect email       |
| `/api/email/rules`                     | GET/POST   | Manage import rules    |
| `/api/email/rules/[id]`                | PUT/DELETE | Update/delete rule     |

### 17.8 Document Import

| Endpoint                        | Method | Purpose                  |
| ------------------------------- | ------ | ------------------------ |
| `/api/import/upload`            | POST   | Upload document          |
| `/api/import/process`           | POST   | Process document with AI |
| `/api/import/jobs/[id]`         | GET    | Get job details          |
| `/api/import/jobs/[id]/type`    | PUT    | Set document type        |
| `/api/import/jobs/[id]/file`    | GET    | Retrieve file            |
| `/api/import/jobs/[id]/confirm` | POST   | Confirm import           |
| `/api/import/jobs/[id]/reject`  | POST   | Reject import            |
| `/api/receipts/upload`          | POST   | Upload receipt           |
| `/api/receipts/view`            | GET    | View receipt             |

### 17.9 Support & Ticketing

| Endpoint                             | Method   | Purpose                   |
| ------------------------------------ | -------- | ------------------------- |
| `/api/support/tickets`               | GET/POST | List/create tickets       |
| `/api/support/tickets/[id]/status`   | PUT      | Update ticket status      |
| `/api/support/tickets/[id]/messages` | GET/POST | Ticket messages           |
| `/api/support/tickets/summary`       | GET      | Support dashboard summary |
| `/api/admin/support/dashboard`       | GET      | Admin support view        |

### 17.10 Guidance & Notifications

| Endpoint                    | Method | Purpose                  |
| --------------------------- | ------ | ------------------------ |
| `/api/guidance/preferences` | PUT    | Update guidance settings |
| `/api/guidance/checklist`   | GET    | Get setup checklist      |
| `/api/guidance/insights`    | GET    | Get contextual insights  |
| `/api/notifications`        | GET    | List notifications       |
| `/api/notifications/read`   | POST   | Mark as read             |
| `/api/deadlines`            | GET    | List deadlines           |
| `/api/deadlines/upcoming`   | GET    | Upcoming deadlines       |

### 17.11 Cron Jobs

| Endpoint                        | Trigger | Purpose                  |
| ------------------------------- | ------- | ------------------------ |
| `/api/cron/bank-sync`           | Daily   | Sync PSD2 transactions   |
| `/api/cron/fiscal-processor`    | Hourly  | Process fiscal queue     |
| `/api/cron/fiscal-retry`        | 6h      | Retry failed fiscal      |
| `/api/cron/deadline-reminders`  | Daily   | Send deadline emails     |
| `/api/cron/email-sync`          | 15min   | Import email attachments |
| `/api/cron/fetch-news`          | 4h      | Fetch news feeds         |
| `/api/cron/news/fetch-classify` | 4h      | Fetch and classify news  |
| `/api/cron/news/publish`        | Daily   | Publish news posts       |
| `/api/cron/news/review`         | Daily   | Review news items        |
| `/api/cron/checklist-digest`    | Daily   | Send guidance digests    |

### 17.12 News System

| Endpoint                               | Method     | Purpose               |
| -------------------------------------- | ---------- | --------------------- |
| `/api/news`                            | GET        | List news posts       |
| `/api/news/latest`                     | GET        | Latest news           |
| `/api/news/categories`                 | GET        | News categories       |
| `/api/news/posts`                      | GET        | List posts            |
| `/api/news/posts/[slug]`               | GET        | Get post by slug      |
| `/api/admin/news/posts`                | GET/POST   | Admin news management |
| `/api/admin/news/posts/[id]`           | PUT/DELETE | Update/delete post    |
| `/api/admin/news/posts/[id]/reprocess` | POST       | Reprocess with AI     |
| `/api/admin/news/cron/trigger`         | POST       | Manually trigger cron |

### 17.13 Staff Portal

| Endpoint                            | Method     | Purpose                  |
| ----------------------------------- | ---------- | ------------------------ |
| `/api/staff/clients`                | GET        | List assigned clients    |
| `/api/staff/clients/[companyId]`    | GET        | Get client details       |
| `/api/admin/staff-assignments`      | GET/POST   | Manage staff assignments |
| `/api/admin/staff-assignments/[id]` | PUT/DELETE | Update/delete assignment |

### 17.14 Admin Features

| Endpoint                                 | Method | Purpose           |
| ---------------------------------------- | ------ | ----------------- |
| `/api/admin/companies/[companyId]/audit` | GET    | Company audit log |

### 17.15 Reports & Exports

| Endpoint                         | Method | Purpose                          |
| -------------------------------- | ------ | -------------------------------- |
| `/api/reports/kpr`               | GET    | KPR report (Income/Expense book) |
| `/api/reports/kpr/excel`         | GET    | KPR Excel export                 |
| `/api/reports/kpr/pdf`           | GET    | KPR PDF export                   |
| `/api/reports/vat-threshold`     | GET    | VAT threshold monitoring         |
| `/api/reports/accountant-export` | GET    | Accountant export                |
| `/api/exports/company`           | GET    | Full company data export         |
| `/api/exports/expenses`          | GET    | Expense export                   |
| `/api/exports/invoices`          | GET    | Invoice export                   |
| `/api/exports/season-pack`       | GET    | Seasonal compliance pack         |

### 17.16 POS & Terminal

| Endpoint                         | Method | Purpose                 |
| -------------------------------- | ------ | ----------------------- |
| `/api/terminal/connection-token` | POST   | Generate terminal token |
| `/api/terminal/payment-intent`   | POST   | Create payment intent   |
| `/api/terminal/reader-status`    | GET    | Check reader status     |

### 17.17 Products & Inventory

| Endpoint               | Method | Purpose              |
| ---------------------- | ------ | -------------------- |
| `/api/products/import` | POST   | Bulk import products |

### 17.18 Knowledge Hub

| Endpoint                  | Method | Purpose                |
| ------------------------- | ------ | ---------------------- |
| `/api/knowledge-hub/hub3` | GET    | Hub3 payment slip info |

### 17.19 Utilities

| Endpoint               | Method | Purpose               |
| ---------------------- | ------ | --------------------- |
| `/api/health`          | GET    | Basic health check    |
| `/api/health/ready`    | GET    | Readiness probe       |
| `/api/status`          | GET    | Service status        |
| `/api/metrics`         | GET    | System metrics        |
| `/api/oib/lookup`      | GET    | OIB validation/lookup |
| `/api/capabilities`    | GET    | API capabilities      |
| `/api/webhooks/resend` | POST   | Email service webhook |

**Total API Routes:** 119 endpoints

### 17.20 Server Actions

FiskAI uses Next.js Server Actions for most CRUD operations. These are NOT REST endpoints but TypeScript functions called directly from client components.

**Location:** `/src/app/actions/`

| File                        | Purpose                   | Key Functions                                                    |
| --------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `auth.ts`                   | Authentication            | `signIn`, `signOut`, `signUp`                                    |
| `company.ts`                | Company management        | `createCompany`, `updateCompany`, `switchCompany`                |
| `company-switch.ts`         | Company context switching | `switchActiveCompany`                                            |
| `contact.ts`                | Contact CRUD              | `createContact`, `updateContact`, `deleteContact`                |
| `contact-list.ts`           | Contact list management   | `getContacts`, `searchContacts`                                  |
| `product.ts`                | Product management        | `createProduct`, `updateProduct`, `deleteProduct`                |
| `invoice.ts`                | Invoice operations        | `createInvoice`, `updateInvoice`, `deleteInvoice`, `sendInvoice` |
| `expense.ts`                | Expense tracking          | `createExpense`, `updateExpense`, `deleteExpense`                |
| `expense-reconciliation.ts` | Bank matching             | `matchExpense`, `unmatchExpense`, `suggestMatches`               |
| `banking.ts`                | Bank accounts             | `addBankAccount`, `removeBankAccount`, `syncTransactions`        |
| `premises.ts`               | Business premises         | `createPremises`, `updatePremises`, `setPrimaryPremises`         |
| `terminal.ts`               | POS terminals             | `registerTerminal`, `pairReader`, `unpairReader`                 |
| `pos.ts`                    | Point of sale             | `createPOSTransaction`, `voidTransaction`                        |
| `fiscalize.ts`              | Fiscalization             | `fiscalizeInvoice`, `retryFiscalization`, `getFiscalStatus`      |
| `fiscal-certificate.ts`     | Certificates              | `uploadCertificate`, `validateCertificate`, `deleteCertificate`  |
| `support-ticket.ts`         | Support                   | `createTicket`, `addMessage`, `updateTicketStatus`               |
| `onboarding.ts`             | Wizard                    | `saveOnboardingStep`, `completeOnboarding`, `skipOnboarding`     |
| `guidance.ts`               | Preferences               | `updateGuidanceLevel`, `dismissTip`, `saveCompetenceLevel`       |
| `newsletter.ts`             | Newsletter                | `subscribe`, `unsubscribe`, `updatePreferences`                  |
| `article-agent.ts`          | AI articles               | `generateArticle`, `publishArticle`, `reviewArticle`             |

**Usage Pattern:**

```typescript
// In client component
"use client"
import { createInvoice } from "@/app/actions/invoice"

async function handleSubmit(data: InvoiceData) {
  const result = await createInvoice(data)
  if (result.error) {
    toast.error(result.error)
  } else {
    router.push(`/invoices/${result.id}`)
  }
}
```

**Why Server Actions over REST?**

1. Type safety - Full TypeScript types from server to client
2. No API boilerplate - Direct function calls
3. Automatic revalidation - Next.js cache updates
4. Better DX - Single codebase for frontend and backend logic

---

## Appendix A: Glossary

| Term          | Croatian                                     | Meaning                       |
| ------------- | -------------------------------------------- | ----------------------------- |
| OIB           | Osobni identifikacijski broj                 | 11-digit tax ID               |
| PDV           | Porez na dodanu vrijednost                   | VAT                           |
| MIO           | Mirovinsko osiguranje                        | Pension insurance             |
| HZZO          | Hrvatski zavod za zdravstveno osiguranje     | Health insurance              |
| JIR           | Jedinstveni identifikator računa             | Fiscal receipt ID             |
| ZKI           | Zaštitni kod izdavatelja                     | Issuer security code          |
| KPR           | Knjiga prometa                               | Daily sales log (paušalni)    |
| KPI           | Knjiga primitaka i izdataka                  | Income/expense book           |
| PO-SD         | Prijava poreza na dohodak - pojednostavljena | Simplified income tax return  |
| URA           | Ulazni računi                                | Incoming invoices             |
| IRA           | Izlazni računi                               | Outgoing invoices             |
| HOK           | Hrvatska obrtnička komora                    | Croatian Chamber of Trades    |
| FINA          | Financijska agencija                         | Financial Agency              |
| CIS           | Centralni informacijski sustav               | Central Information System    |
| EN16931       | European e-invoicing standard                | XML schema for B2G invoices   |
| UBL           | Universal Business Language                  | XML format for e-invoices     |
| CAMT.053      | Cash Management message                      | ISO 20022 bank statement XML  |
| Hub3          | Croatian payment slip standard               | 2D barcode for payments       |
| R1/R2         | Invoice types                                | R1=standard, R2=cash register |
| VIES          | VAT Information Exchange System              | EU VAT number validation      |
| SEPA          | Single Euro Payments Area                    | EU bank transfer standard     |
| PSD2          | Payment Services Directive 2                 | Open banking regulation       |
| Poziv na broj | Payment reference number                     | Links payment to invoice      |
| Prirez        | Municipal surtax                             | Added to income tax           |
| JOPPD         | Jedinstveni Obrazac Poreza i Prihoda         | Payroll reporting form        |
| Putni nalog   | Travel order                                 | Tax-free expense claim        |
| Dnevnica      | Per diem                                     | Daily travel allowance        |

---

## Appendix B: File Locations

| Purpose                | Path                                           |
| ---------------------- | ---------------------------------------------- |
| **Core Configuration** |                                                |
| Module definitions     | `/src/lib/modules/definitions.ts`              |
| Visibility rules       | `/src/lib/visibility/rules.ts`                 |
| Visibility elements    | `/src/lib/visibility/elements.ts`              |
| Visibility context     | `/src/lib/visibility/context.tsx`              |
| RBAC permissions       | `/src/lib/rbac.ts`                             |
| Capabilities           | `/src/lib/capabilities.ts`                     |
| Navigation registry    | `/src/lib/navigation.ts`                       |
| **Fiscal Data**        |                                                |
| Tax thresholds         | `/src/lib/fiscal-data/data/thresholds.ts`      |
| Tax rates              | `/src/lib/fiscal-data/data/tax-rates.ts`       |
| Contributions          | `/src/lib/fiscal-data/data/contributions.ts`   |
| Deadlines              | `/src/lib/fiscal-data/data/deadlines.ts`       |
| Payment details        | `/src/lib/fiscal-data/data/payment-details.ts` |
| **Feature Modules**    |                                                |
| Paušalni logic         | `/src/lib/pausalni/`                           |
| E-invoice generation   | `/src/lib/e-invoice/`                          |
| Bank sync              | `/src/lib/bank-sync/`                          |
| Banking import         | `/src/lib/banking/`                            |
| Guidance system        | `/src/lib/guidance/`                           |
| **Database**           |                                                |
| Prisma schema          | `/prisma/schema.prisma`                        |
| Drizzle client         | `/src/lib/db/drizzle.ts`                       |
| Drizzle schemas        | `/src/lib/db/schema/`                          |
| **UI Components**      |                                                |
| Dashboard widgets      | `/src/components/dashboard/`                   |
| Onboarding steps       | `/src/components/onboarding/`                  |
| Guidance components    | `/src/components/guidance/`                    |
| Layout components      | `/src/components/layout/`                      |
| Admin components       | `/src/components/admin/`                       |
| Staff components       | `/src/components/staff/`                       |
| **Server Logic**       |                                                |
| Server actions         | `/src/app/actions/`                            |
| API routes             | `/src/app/api/`                                |
| Cron jobs              | `/src/app/api/cron/`                           |
| **Content**            |                                                |
| MDX guides             | `/content/vodici/`                             |
| MDX comparisons        | `/content/usporedbe/`                          |
| Implementation plans   | `/docs/plans/`                                 |

---

## Document History

| Version | Date       | Author | Changes                          |
| ------- | ---------- | ------ | -------------------------------- |
| 4.0.0   | 2025-12-19 | Claude | Complete rewrite - unified bible |
| 3.1.0   | 2025-12-19 | Gemini | V3.1 Expansion                   |
| 2.0.0   | 2025-12-19 | Codex  | V2 Rewrite                       |
| 1.0.0   | 2025-12-19 | Gemini | Initial draft                    |

---

**This document is the single source of truth for FiskAI product definition.**

---

## Appendix 1: Strategic Technical Specification (Gaps + Proof)

**Vision Alignment**

- This appendix serves as the engineering blueprint to bridge the gap between v4.0.0 theory and 2025/2026 production reality.
- Methodology: **Legal Drift Audit** + **Algorithmic Specification** + **Market Gap Analysis**.

### A1.1 Legal Threshold & Regulatory Drift (2025 Updates)

The following mandatory updates must be implemented to keep FiskAI compliant with the 2025 Croatian Tax Reform.

- **Doc refs**: `PRODUCT_BIBLE.md:139` `PRODUCT_BIBLE.md:165` `PRODUCT_BIBLE.md:170` `PRODUCT_BIBLE.md:179` `PRODUCT_BIBLE.md:908` `PRODUCT_BIBLE.md:1059` `PRODUCT_BIBLE.md:1060`
  **Issue**: Legacy income/VAT thresholds.
  **Evidence**: Official Porezna Uprava 2025 update (Thresholds for mandatory entry into VAT and exit from Paušalni).
  **Proof**: The limit has officially increased from 40,000.00 EUR to **60,000.00 EUR**.
  **Fix**: Update global `CONSTANTS` in `lib/fiscal-data`. Recalibrate `card:pausalni-status` progress bar. Trigger "Strategic Stage" at 50k instead of 35k.

- **Doc refs**: `PRODUCT_BIBLE.md:1087` `PRODUCT_BIBLE.md:1088`
  **Issue**: Incomplete Paušalni tax tier table.
  **Evidence**: Law on Income Tax (Zakon o porezu na dohodak) 2025.
  **Proof**: Brackets expanded to 7 tiers.
  **Fix**: Update `src/lib/pausalni/calculator.ts` with the following tiers:
  1. 0 - 11,300.00 EUR (Base: 1,695.00)
  2. 11,300.01 - 15,300.00 EUR (Base: 2,295.00)
  3. 15,300.01 - 19,900.00 EUR (Base: 2,985.00)
  4. 19,900.01 - 30,600.00 EUR (Base: 4,590.00)
  5. 30,600.01 - 40,000.00 EUR (Base: 6,000.00)
  6. 40,000.01 - 50,000.00 EUR (Base: 7,500.00)
  7. 50,000.01 - 60,000.00 EUR (Base: 9,000.00)

- **Doc refs**: `PRODUCT_BIBLE.md:1062` `PRODUCT_BIBLE.md:1249` `PRODUCT_BIBLE.md:1381`
  **Issue**: Legacy asset capitalization threshold.
  **Evidence**: Regulation on Amortization (Pravilnik o amortizaciji) 2025.
  **Proof**: Items are now capitalized at **665.00 EUR** (previously 464.53 EUR).
  **Fix**: Update `Expense Vault` AI logic to trigger "Asset Suggestion" only if `total >= 665.00`.

- **Doc refs**: `PRODUCT_BIBLE.md:1094` `PRODUCT_BIBLE.md:1097` `PRODUCT_BIBLE.md:1401`
  **Issue**: Legacy minimal wage and contribution base.
  **Evidence**: Government Decree on Minimal Wage 2025 (Uredba o visini minimalne plaće).
  **Proof**: Minimal gross wage is now **970.00 EUR**. Contribution base for entrepreneurs is **719.20 EUR**.
  **Fix**: Update `lib/fiscal-data/contributions.ts` and automated payment slip generator (`src/lib/pausalni/obligations.ts`).

- **Doc refs**: `PRODUCT_BIBLE.md:1068` `PRODUCT_BIBLE.md:1071`
  **Issue**: Surtax (Prirez) is obsolete.
  **Evidence**: Local Tax Law (Zakon o lokalnim porezima) abolition of prirez.
  **Proof**: Surtax is 0. Cities now set direct income tax rates (e.g., Zagreb ~23.6% lower tier).
  **Fix**: Remove "Surtax" fields from calculators. Add "Municipality Selection" to Step 3 of Onboarding to resolve local tax rate.

### A1.2 Technical Logic Gaps (AI & Data Flow)

Specifications for autonomous features promised but not detailed in v4.0.0.

- **Doc refs**: `PRODUCT_BIBLE.md:170` `PRODUCT_BIBLE.md:1201` `PRODUCT_BIBLE.md:1246`
  **The Watchdog Agent (Spec)**:
  - Input: `db.eInvoice.sum(totalAmount)` where `year = current`.
  - Logic: Monitor proximity to 60k limit.
  - 85% Trigger: Toast + Dashboard Warning.
  - 95% Trigger: Modal blocking creation of further invoices without "Legal Review" checkbox.
  - Target: Zero unplanned VAT entries for paušalni users.

- **Doc refs**: `PRODUCT_BIBLE.md:982` `PRODUCT_BIBLE.md:1197`
  **The Matcher Agent (Reconciliation)**:
  - Input: Bank CSV/XML Transaction + Unpaid Invoices.
  - Algorithm: Fuzzy match on (1) Amount == Total, (2) Reference Number match, (3) Payer Name == Contact Name.
  - Priority: If `Reference Number` matches exactly, auto-reconcile. If only `Payer Name` matches, suggest match with 70% confidence.

- **Doc refs**: `PRODUCT_BIBLE.md:46` `PRODUCT_BIBLE.md:1147` `PRODUCT_BIBLE.md:1239`
  **Legal Archive Integrity (XAdES)**:
  - Spec: Storing in Cloudflare R2 is insufficient for the 11-year Archive Law (Zakon o računovodstvu).
  - Implementation: Implement **Digital Notarization**. Store a `SHA-256` hash of every final PDF in a write-once ledger. Generate a monthly "Trust Manifest" signed by FiskAI's master certificate.

### A1.3 Market-Ready Feature Roadmap (The 100 Things - Priority P0)

Critical missing compliance features for the Croatian market.

1. **Travel Orders (Putni Nalozi)**:
   - Dependency: Essential for owners to payout tax-free mileage.
   - Requirements: Odometer log, purpose of trip, per diem (30€/15€) calculation.
2. **Locco Driving Log**:
   - Simplified mileage tracker for city travel (under 30km).
3. **Internal Warehouse (Skladište)**:
   - Mandatory for retail `legalForm`. Tracks entry/exit of goods (Primke).
4. **GDPR Data Retention Automator**:
   - Logic: Auto-delete employee personal data 5 years after termination (unless pension relevant), but keep Invoices for 11 years.

### A1.4 Strategic Proof Points

- **Timeline**: B2B E-Invoicing is mandatory starting **Jan 1, 2026** (Fiskalizacija 2.0).
- **Integrity**: Every document issued must include a **QR Code** for verification via the Porezna Uprava portal (even if non-cash).

---

## Appendix 2: Improvement Ledger (Audit + Fixes)

**How to use this appendix**

- Doc refs point to exact lines in `docs/PRODUCT_BIBLE.md` (v4.0.0, pre-append).
- Evidence points to current repo files showing the implemented behavior.
- Each item ends with a concrete fix (doc update, code update, or both).

### A2.1 High-impact mismatches (fix before external launch)

- Doc refs: `docs/PRODUCT_BIBLE.md:1175` `docs/PRODUCT_BIBLE.md:1181` `docs/PRODUCT_BIBLE.md:1185` `docs/PRODUCT_BIBLE.md:1202`
  Issue: Pricing tiers and module-to-tier mapping in the bible do not match Stripe plan config (doc: Free/Paušalni/Pro/Business/Enterprise vs code: pausalni/standard/pro).
  Evidence: `src/lib/billing/stripe.ts:26` `src/lib/billing/stripe.ts:47`.
  Fix: Decide canonical tiers and update both bible + `PLANS` (including entitlements and UI labels).

- Doc refs: `docs/PRODUCT_BIBLE.md:1139` `docs/PRODUCT_BIBLE.md:1144` `docs/PRODUCT_BIBLE.md:1151` `docs/PRODUCT_BIBLE.md:1154`
  Issue: IE-Računi and SaltEdge are marked production-ready but providers are not implemented/available.
  Evidence: `src/lib/e-invoice/provider.ts:33` `src/lib/bank-sync/providers/index.ts:4`.
  Fix: Downgrade status in bible or implement providers; adjust Implementation Status matrix.

- Doc refs: `docs/PRODUCT_BIBLE.md:1424` `docs/PRODUCT_BIBLE.md:1442` `docs/PRODUCT_BIBLE.md:1461`
  Issue: API reference lists invoice CRUD and `/api/banking/transactions`, but only PDF + banking import/reconciliation endpoints exist.
  Evidence: `src/app/api/invoices/[id]/pdf/route.ts:6` `src/app/api/banking/reconciliation/match/route.ts:1` `src/app/api/banking/import/upload/route.ts:1`.
  Fix: Replace API list with actual route inventory and explicitly note server actions for CRUD.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:415`
  Issue: Banking is labeled FREE/default in the bible, but `defaultEnabled` is false in module definitions.
  Evidence: `src/lib/modules/definitions.ts:80` `src/lib/modules/definitions.ts:86`.
  Fix: Decide whether banking should be default-on; align module defaults, doc table, and seed entitlements.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:427`
  Issue: AUTO entitlements (pausalni/vat/corporate-tax) are described as legalForm-based, but code only checks entitlements.
  Evidence: `src/lib/capabilities.ts:51` `src/lib/capabilities.ts:53`.
  Fix: Implement auto-entitlements or update bible to state manual toggles + visibility rules.

- Doc refs: `docs/PRODUCT_BIBLE.md:446` `docs/PRODUCT_BIBLE.md:456`
  Issue: Bible uses `createModuleAccess`/`ModuleGate` for gating; app uses `deriveCapabilities` + visibility components and no ModuleGate exists.
  Evidence: `src/lib/modules/access.ts:10` `src/lib/visibility/components.tsx:32` `src/components/layout/sidebar.tsx:136`.
  Fix: Update gating examples or implement a ModuleGate and use it consistently.

- Doc refs: `docs/PRODUCT_BIBLE.md:139` `docs/PRODUCT_BIBLE.md:159` `docs/PRODUCT_BIBLE.md:350` `docs/PRODUCT_BIBLE.md:908`
  Issue: Mixed 40k/60k thresholds create contradictions across personas, UI copy, and tax data.
  Evidence: `src/lib/fiscal-data/data/thresholds.ts:20` `src/lib/fiscal-data/data/thresholds.ts:35` (60k) vs `src/app/(app)/reports/vat-threshold/page.tsx:31` (40k).
  Fix: Use `THRESHOLDS.pdv/pausalni` everywhere and show effective-year values.

- Doc refs: `docs/PRODUCT_BIBLE.md:1454` `docs/PRODUCT_BIBLE.md:1456`
  Issue: E-invoice endpoints in bible do not match actual inbox/receive routes.
  Evidence: `src/app/api/e-invoices/inbox/route.ts:1` `src/app/api/e-invoices/receive/route.ts:1`.
  Fix: Update API reference and flow narratives to the inbox/receive model.

### A2.2 Module system & entitlements consistency

- Doc refs: `docs/PRODUCT_BIBLE.md:429` `docs/PRODUCT_BIBLE.md:439`
  Issue: Module definition snippet uses `requiredFor` and `navItems` objects; actual ModuleDefinition has `navItems: string[]` and no `requiredFor`.
  Evidence: `src/lib/modules/definitions.ts:22` `src/lib/modules/definitions.ts:27`.
  Fix: Update snippet or extend module definitions to include `requiredFor` and rich nav metadata.

- Doc refs: `docs/PRODUCT_BIBLE.md:406` `docs/PRODUCT_BIBLE.md:408`
  Issue: Entitlements are described as `Company.entitlements[]` but schema stores nullable JSON with no enforced shape.
  Evidence: `prisma/schema.prisma:87` `prisma/schema.prisma:105`.
  Fix: Document JSON array shape + validation, or migrate to `String[]`.

- Doc refs: `docs/PRODUCT_BIBLE.md:410` `docs/PRODUCT_BIBLE.md:417`
  Issue: Default entitlements diverge across code paths (module defaults vs capabilities defaults vs plan settings defaults).
  Evidence: `src/lib/modules/definitions.ts:162` `src/lib/capabilities.ts:27` `src/app/(app)/settings/plan-settings-form.tsx:32`.
  Fix: Create a single source of truth for defaults and reference it in the bible.

- Doc refs: `docs/PRODUCT_BIBLE.md:446` `docs/PRODUCT_BIBLE.md:451`
  Issue: Several pages check non-existent module keys (`reports`, `eInvoicing`, `invoicing` for products).
  Evidence: `src/app/(app)/reports/page.tsx:62` `src/app/(app)/e-invoices/page.tsx:58` `src/app/(app)/products/page.tsx:20`.
  Fix: Update code to use canonical kebab-case module keys from the bible.

### A2.3 Visibility, guidance, onboarding alignment

- Doc refs: `docs/PRODUCT_BIBLE.md:552` `docs/PRODUCT_BIBLE.md:558` `docs/PRODUCT_BIBLE.md:839`
  Issue: Competence levels in bible (beginner/standard/expert) do not match implemented levels (beginner/average/pro).
  Evidence: `src/lib/visibility/rules.ts:11` `src/lib/guidance/constants.ts:5` `src/components/onboarding/step-competence.tsx:17`.
  Fix: Standardize terminology across guidance, onboarding, and docs.

- Doc refs: `docs/PRODUCT_BIBLE.md:606` `docs/PRODUCT_BIBLE.md:612`
  Issue: Onboarding completion logic references `featureFlags?.competence`, but visibility uses only core company fields.
  Evidence: `src/lib/visibility/server.ts:89` `src/components/layout/header.tsx:60`.
  Fix: Clarify which flow controls "onboarding complete" and align doc/logic.

- Doc refs: `docs/PRODUCT_BIBLE.md:576` `docs/PRODUCT_BIBLE.md:587`
  Issue: Doc says `Visible` checks entitlements; actual visibility ignores entitlements.
  Evidence: `src/lib/visibility/context.tsx:136` `src/lib/visibility/context.tsx:142`.
  Fix: Add entitlements to visibility or update the doc to state entitlements are checked separately.

- Doc refs: `docs/PRODUCT_BIBLE.md:561` `docs/PRODUCT_BIBLE.md:575`
  Issue: Element IDs in the bible do not fully match the canonical registry (e.g., `card:insights` exists but is not listed).
  Evidence: `src/lib/visibility/elements.ts:13` `src/lib/visibility/elements.ts:15`.
  Fix: Replace the table with the canonical `ElementId` registry.

- Doc refs: `docs/PRODUCT_BIBLE.md:839` `docs/PRODUCT_BIBLE.md:851`
  Issue: Competence is described as global + category levels in onboarding; only global is collected there.
  Evidence: `src/components/onboarding/step-competence.tsx:10` `src/lib/db/schema/guidance.ts:30`.
  Fix: Document category-level controls in `/settings/guidance` and keep onboarding global-only.

- Doc refs: `docs/PRODUCT_BIBLE.md:917` `docs/PRODUCT_BIBLE.md:939`
  Issue: Passkey login is described, but the UI flow is TODO.
  Evidence: `src/components/auth/AuthFlow.tsx:28`.
  Fix: Mark passkeys as planned or implement the flow.

### A2.4 Navigation & UI alignment

- Doc refs: `docs/PRODUCT_BIBLE.md:753` `docs/PRODUCT_BIBLE.md:767`
  Issue: Sidebar sections in bible do not match the live navigation registry.
  Evidence: `src/lib/navigation.ts:33` `src/lib/navigation.ts:92`.
  Fix: Update sidebar spec to mirror the `navigation` source of truth.

- Doc refs: `docs/PRODUCT_BIBLE.md:770` `docs/PRODUCT_BIBLE.md:773`
  Issue: Doc claims nav hides locked items; actual UI shows locked state with a lock icon.
  Evidence: `src/lib/visibility/components.tsx:134` `src/components/layout/sidebar.tsx:157`.
  Fix: Update doc to reflect locked nav state (or remove lock UI).

- Doc refs: `docs/PRODUCT_BIBLE.md:775` `docs/PRODUCT_BIBLE.md:783`
  Issue: Mobile UI described as bottom navigation; implementation uses a slide-out drawer.
  Evidence: `src/components/layout/mobile-nav.tsx:63`.
  Fix: Update doc or implement the bottom nav.

- Doc refs: `docs/PRODUCT_BIBLE.md:785` `docs/PRODUCT_BIBLE.md:790`
  Issue: Action drawer is not implemented; mobile uses command palette FAB.
  Evidence: `src/components/layout/mobile-nav.tsx:203`.
  Fix: Replace action drawer spec with command palette behavior or build the drawer.

- Doc refs: `docs/PRODUCT_BIBLE.md:738` `docs/PRODUCT_BIBLE.md:747`
  Issue: Header spec mentions Quick Level Toggle without tying it to guidance preferences.
  Evidence: `src/components/layout/header.tsx:128` `src/components/guidance/QuickLevelToggle.tsx:7`.
  Fix: Add guidance preference wiring in the header spec.

### A2.5 Staff & Admin portals

- Doc refs: `docs/PRODUCT_BIBLE.md:247` `docs/PRODUCT_BIBLE.md:254`
  Issue: Staff portal spec focuses on "Pending Actions/Quick Export" while actual navigation is Dashboard/Clients/Calendar/Tasks/Tickets/Documents.
  Evidence: `src/components/staff/sidebar.tsx:17` `src/app/(staff)/clients/page.tsx:1`.
  Fix: Update staff IA in bible or implement the specified features.

- Doc refs: `docs/PRODUCT_BIBLE.md:247` `docs/PRODUCT_BIBLE.md:260`
  Issue: Staff dashboard claims multi-client deadlines/activity, but code has TODOs.
  Evidence: `src/components/staff/dashboard.tsx:22` `src/components/staff/dashboard.tsx:41`.
  Fix: Mark these as planned until implemented.

- Doc refs: `docs/PRODUCT_BIBLE.md:272` `docs/PRODUCT_BIBLE.md:280`
  Issue: Admin portal feature list (News, Metrics) does not match actual admin sidebar (Subscriptions, Services, Audit Log).
  Evidence: `src/components/admin/sidebar.tsx:17` `src/components/admin/dashboard.tsx:45`.
  Fix: Align admin portal spec with nav or build missing sections.

### A2.6 Data models & enums

- Doc refs: `docs/PRODUCT_BIBLE.md:1294` `docs/PRODUCT_BIBLE.md:1307`
  Issue: Company model in bible shows required fields; schema allows nullable `legalForm`, `email`, `iban`, and `entitlements`.
  Evidence: `prisma/schema.prisma:87` `prisma/schema.prisma:105`.
  Fix: Update bible to match schema or explicitly mark as target state.

- Doc refs: `docs/PRODUCT_BIBLE.md:1331` `docs/PRODUCT_BIBLE.md:1344`
  Issue: EInvoice model fields in bible do not match schema field names.
  Evidence: `prisma/schema.prisma:227` `prisma/schema.prisma:240`.
  Fix: Update model snippet and downstream flow docs to use canonical field names.

- Doc refs: `docs/PRODUCT_BIBLE.md:1337` `docs/PRODUCT_BIBLE.md:1339`
  Issue: Status and invoice type enums in bible are incomplete.
  Evidence: `prisma/schema.prisma:1300` `prisma/schema.prisma:1318`.
  Fix: Add `ARCHIVED`, `ERROR`, and `DEBIT_NOTE` to the bible.

- Doc refs: `docs/PRODUCT_BIBLE.md:1365` `docs/PRODUCT_BIBLE.md:1404`
  Issue: "Missing Models" list ignores models already present (StaffAssignment, BankAccount, BankTransaction, Statement, SupportTicket, EmailConnection).
  Evidence: `prisma/schema.prisma:167` `prisma/schema.prisma:464` `prisma/schema.prisma:677` `prisma/schema.prisma:748` `prisma/schema.prisma:563`.
  Fix: Move implemented models into core models; keep only true gaps.

- Doc refs: `docs/PRODUCT_BIBLE.md:1328`
  Issue: Guidance preferences (global + per-category levels) are stored via Drizzle and not documented.
  Evidence: `src/lib/db/drizzle.ts:1` `src/lib/db/schema/guidance.ts:30`.
  Fix: Add a "Guidance Preferences" model subsection.

### A2.7 API & integration inventory

- Doc refs: `docs/PRODUCT_BIBLE.md:1424` `docs/PRODUCT_BIBLE.md:1437`
  Issue: API reference omits several real routes (guidance, deadlines, receipts, compliance).
  Evidence: `src/app/api/guidance/preferences/route.ts:1` `src/app/api/deadlines/route.ts:1` `src/app/api/receipts/upload/route.ts:1` `src/app/api/compliance/en16931/route.ts:1`.
  Fix: Expand API list to include these groups.

- Doc refs: `docs/PRODUCT_BIBLE.md:1439` `docs/PRODUCT_BIBLE.md:1447`
  Issue: Invoice CRUD is documented as REST; actual CRUD is server actions and only PDF is exposed as API.
  Evidence: `src/app/api/invoices/[id]/pdf/route.ts:6` `src/app/actions/invoice.ts:375`.
  Fix: Update API reference and clarify server action usage.

- Doc refs: `docs/PRODUCT_BIBLE.md:1459` `docs/PRODUCT_BIBLE.md:1465`
  Issue: Banking endpoints in doc omit `/api/bank/*` connect/callback and list a non-existent `transactions` endpoint.
  Evidence: `src/app/api/bank/connect/route.ts:1` `src/app/api/banking/reconciliation/route.ts:1`.
  Fix: Split banking API into bank-connect vs bank-import/reconciliation sections.

- Doc refs: `docs/PRODUCT_BIBLE.md:1159` `docs/PRODUCT_BIBLE.md:1167`
  Issue: Bank import formats list includes MT940/PBZ not implemented; actual support is CAMT.053 XML + CSV (Erste/Raiffeisen/generic).
  Evidence: `src/lib/banking/import/processor.ts:87` `src/lib/banking/csv-parser.ts:42`.
  Fix: Update formats list or implement missing parsers.

- Doc refs: `docs/PRODUCT_BIBLE.md:1135` `docs/PRODUCT_BIBLE.md:1158`
  Issue: Compliance API (EN16931/Croatian validation) and sandbox endpoints are not mentioned.
  Evidence: `src/app/api/compliance/en16931/route.ts:1` `src/app/api/sandbox/e-invoice/route.ts:1`.
  Fix: Add compliance + sandbox endpoints under integrations.

### A2.8 Tax & regulatory data governance

- Doc refs: `docs/PRODUCT_BIBLE.md:1055` `docs/PRODUCT_BIBLE.md:1064`
  Issue: Tax data is manually embedded without `lastVerified` or `source`, despite coded fiscal data containing those fields.
  Evidence: `src/lib/fiscal-data/data/thresholds.ts:13` `src/lib/fiscal-data/data/thresholds.ts:15`.
  Fix: Add source + lastVerified to bible and reference `fiscal-data` as canonical.

- Doc refs: `docs/PRODUCT_BIBLE.md:1067` `docs/PRODUCT_BIBLE.md:1088`
  Issue: Income/corporate tax rates should be tied to `fiscal-data` for auto-updates.
  Evidence: `src/lib/fiscal-data/data/tax-rates.ts:16` `src/lib/fiscal-data/data/tax-rates.ts:45`.
  Fix: Add a "data source" callout pointing to `TAX_RATES`.

- Doc refs: `docs/PRODUCT_BIBLE.md:1092` `docs/PRODUCT_BIBLE.md:1099`
  Issue: Contribution rates are correct but should cite the canonical data source and verification date.
  Evidence: `src/lib/fiscal-data/data/contributions.ts:13` `src/lib/fiscal-data/data/contributions.ts:16`.
  Fix: Include `lastVerified` and `source`.

- Doc refs: `docs/PRODUCT_BIBLE.md:1103` `docs/PRODUCT_BIBLE.md:1108`
  Issue: IBAN list should align with `PAYMENT_DETAILS` and include "poziv na broj" format.
  Evidence: `src/lib/fiscal-data/data/payment-details.ts:21` `src/lib/fiscal-data/data/payment-details.ts:58`.
  Fix: Add the `pozivNaBrojFormat` notes.

- Doc refs: `docs/PRODUCT_BIBLE.md:1112` `docs/PRODUCT_BIBLE.md:1124`
  Issue: Deadlines list should reference the canonical `DEADLINES` data (and clarify PDV quarterly dates).
  Evidence: `src/lib/fiscal-data/data/deadlines.ts:12` `src/lib/fiscal-data/data/deadlines.ts:78`.
  Fix: Note that deadlines are generated from `fiscal-data` and should not be hand-edited.

### A2.9 Architecture + documentation coverage gaps

- Doc refs: `docs/PRODUCT_BIBLE.md:65` `docs/PRODUCT_BIBLE.md:70`
  Issue: Stack omits Drizzle usage for guidance tables.
  Evidence: `src/lib/db/drizzle.ts:1`.
  Fix: Add Drizzle to tech stack and explain why (guidance prefs/checklists).

- Doc refs: `docs/PRODUCT_BIBLE.md:80` `docs/PRODUCT_BIBLE.md:105`
  Issue: Directory structure omits major systems (guidance, visibility, admin/staff components, bank-sync, drizzle schema).
  Evidence: `src/lib/visibility/rules.ts:1` `src/components/staff/sidebar.tsx:1` `src/lib/bank-sync/providers/index.ts:1`.
  Fix: Expand directory tree or add "Notable folders" list.

- Doc refs: `docs/PRODUCT_BIBLE.md:1491` `docs/PRODUCT_BIBLE.md:1508`
  Issue: Glossary missing key terms like EN16931, UBL, CAMT.053, Hub3, R1/R2.
  Evidence: `src/app/api/compliance/en16931/route.ts:1` `src/lib/banking/import/processor.ts:87`.
  Fix: Extend glossary to cover compliance + banking terms.

- Doc refs: `docs/PRODUCT_BIBLE.md:1512` `docs/PRODUCT_BIBLE.md:1524`
  Issue: File locations appendix omits `capabilities`, `visibility`, `guidance`, `admin/staff` components, and `drizzle`.
  Evidence: `src/lib/capabilities.ts:1` `src/lib/visibility/context.tsx:1` `src/components/admin/sidebar.tsx:1` `src/lib/db/drizzle.ts:1`.
  Fix: Expand Appendix B to include these paths.

### A2.10 External verification backlog (needs online confirmation)

- Doc refs: `docs/PRODUCT_BIBLE.md:299` `docs/PRODUCT_BIBLE.md:305`
  Issue: Min capital amounts are listed in HRK (pre-euro) and require official EUR update.
  Evidence: No canonical value in repo.
  Fix: Verify via official registry/law and update to EUR values.

- Doc refs: `docs/PRODUCT_BIBLE.md:371` `docs/PRODUCT_BIBLE.md:373`
  Issue: VAT invoice requirements should be cross-checked against current law for 2025 revisions.
  Evidence: No explicit validator in repo for invoice header text.
  Fix: Verify against official sources and update phrasing if needed.
