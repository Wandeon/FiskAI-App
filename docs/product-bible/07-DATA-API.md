# Data & API

[← Back to Index](./00-INDEX.md)

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

**Tier 1 (Launch for Paušalni):**

- [ ] Fiscalization polish (60% → 90%)
- [ ] Payment Hub3 generator
- [ ] HOK/contribution reminders

**Tier 2 (Unlock Obrt Dohodak):**

- [ ] KPI module
- [ ] URA/IRA reports
- [ ] Assets (DI) module

**Tier 3 (Full D.O.O.):**

> **Prerequisite:** General Ledger Engine required for double-entry accounting.
> See [GL Engine Spec](../plans/2025-01-GL-ENGINE-SPEC.md) for implementation plan.

- [ ] General Ledger Engine (Chart of Accounts, Journal Entries, Posting)
- [ ] Complete PDV forms
- [ ] Enhanced URA/IRA
- [ ] Corporate tax calculation

**Tier 4 (Premium):**

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
| `tutorials.ts`  | `tutorial_progress`                                                                                                  | User tutorial tracking                 |

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

| Group      | Base Path           | Purpose                   |
| ---------- | ------------------- | ------------------------- |
| Auth       | `/api/auth/*`       | Authentication            |
| Billing    | `/api/billing/*`    | Stripe integration        |
| Invoices   | `/api/invoices/*`   | Invoice CRUD              |
| E-Invoices | `/api/e-invoices/*` | E-invoice operations      |
| Banking    | `/api/banking/*`    | Bank sync & import        |
| Expenses   | `/api/expenses/*`   | Expense management        |
| Reports    | `/api/reports/*`    | Report generation         |
| Pausalni   | `/api/pausalni/*`   | Paušalni features         |
| Admin      | `/api/admin/*`      | Platform management       |
| Cron       | `/api/cron/*`       | Scheduled jobs            |
| Assistant  | `/api/assistant/*`  | AI chat & reasoning       |
| Regulatory | `/api/regulatory/*` | Regulatory Truth pipeline |
| Rules      | `/api/rules/*`      | Rule search & evaluation  |

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

**Total API Routes:** 129 endpoints (see Section 19 for additional Regulatory Truth endpoints)

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

## 18. Regulatory Truth Layer Data Models

The Regulatory Truth Layer is a comprehensive system for processing Croatian regulatory content with full audit trail. These models are defined in `/prisma/schema.prisma`.

### 18.1 Source & Discovery Models

```prisma
model RegulatorySource {
  id                String    @id @default(cuid())
  slug              String    @unique  // e.g., "porezna-pausalni"
  name              String
  url               String
  hierarchy         Int       @default(5)  // 1=Ustav, 2=Zakon...
  fetchIntervalHours Int      @default(24)
  lastFetchedAt     DateTime?
  lastContentHash   String?
  isActive          Boolean   @default(true)
}

model DiscoveryEndpoint {
  id                String                @id
  domain            String                // e.g., "hzzo.hr"
  path              String                // e.g., "/novosti"
  endpointType      DiscoveryEndpointType // SITEMAP_INDEX, NEWS_LISTING, etc.
  priority          DiscoveryPriority     // CRITICAL, HIGH, MEDIUM, LOW
  scrapeFrequency   ScrapeFrequency       // EVERY_RUN, DAILY, WEEKLY
  listingStrategy   ListingStrategy       // SITEMAP_XML, HTML_LIST, PAGINATION
}

model DiscoveredItem {
  id            String               @id
  endpointId    String
  url           String
  title         String?
  status        DiscoveredItemStatus // PENDING, FETCHED, PROCESSED
  // Topology fields (PR #111)
  nodeType      NodeType             // HUB, LEAF, ASSET
  nodeRole      NodeRole?            // ARCHIVE, INDEX, NEWS_FEED, REGULATION
  parentUrl     String?
  depth         Int                  @default(0)
  // Velocity fields (PR #111 - EWMA: 0.0=static, 1.0=volatile)
  changeFrequency  Float             @default(0.5)
  lastChangedAt    DateTime?
  scanCount        Int               @default(0)
  freshnessRisk    FreshnessRisk     // CRITICAL, HIGH, MEDIUM, LOW
  nextScanDue      DateTime          @default(now())
}
```

### 18.2 Evidence & Extraction Models

```prisma
model Evidence {
  id              String   @id @default(cuid())
  sourceId        String
  fetchedAt       DateTime @default(now())
  contentHash     String
  rawContent      String   @db.Text  // Full HTML/PDF text
  contentType     String   @default("html")
  url             String
  hasChanged      Boolean  @default(false)
  // OCR support fields (PR #119)
  contentClass            String   @default("HTML")  // HTML, PDF_TEXT, PDF_SCANNED
  ocrMetadata             Json?
  primaryTextArtifactId   String?
}

model EvidenceArtifact {
  id          String   @id @default(cuid())
  evidenceId  String
  kind        String   // PDF_TEXT, OCR_TEXT, OCR_HOCR, HTML_CLEANED, TABLE_JSON
  content     String   @db.Text
  contentHash String
  pageMap     Json?    // Per-page metadata: [{page, confidence, method}]
}

model SourcePointer {
  id              String   @id @default(cuid())
  evidenceId      String
  domain          String   // pausalni, pdv, doprinosi, fiskalizacija
  valueType       String   // currency, percentage, date, threshold, text
  extractedValue  String
  displayValue    String
  exactQuote      String   @db.Text
  contextBefore   String?  @db.Text
  contextAfter    String?  @db.Text
  // Article-level anchoring
  articleNumber   String?
  paragraphNumber String?
  lawReference    String?
  confidence      Float    @default(0.8)
}
```

### 18.3 Rule & Concept Models

```prisma
model Concept {
  id          String   @id @default(cuid())
  slug        String   @unique  // e.g., "pausalni-obrt"
  nameHr      String
  nameEn      String?
  aliases     String[] // Alternative names
  tags        String[] // Categorization tags
  description String?  @db.Text
  parentId    String?
}

model RegulatoryRule {
  id                String           @id @default(cuid())
  conceptSlug       String
  conceptId         String?
  titleHr           String
  titleEn           String?
  riskTier          RiskTier         // T0, T1, T2, T3
  authorityLevel    AuthorityLevel   // LAW, GUIDANCE, PROCEDURE, PRACTICE
  automationPolicy  AutomationPolicy // ALLOW, CONFIRM, BLOCK
  ruleStability     RuleStability    // STABLE, VOLATILE
  obligationType    ObligationType   // OBLIGATION, NO_OBLIGATION, CONDITIONAL
  appliesWhen       String           @db.Text  // DSL expression
  value             String
  valueType         String
  effectiveFrom     DateTime
  effectiveUntil    DateTime?
  supersedesId      String?
  status            RuleStatus       // DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED
  confidence        Float            @default(0.8)
  meaningSignature  String?          // SHA256 hash for deduplication
}
```

### 18.4 Knowledge Shapes (PR #111, PR #115)

**Shape 1: Atomic Claims (Logic Frames)**

```prisma
model AtomicClaim {
  id                String        @id
  // WHO - Subject
  subjectType       SubjectType   // TAXPAYER, EMPLOYER, COMPANY, INDIVIDUAL, ALL
  subjectQualifiers String[]
  // WHEN - Condition
  triggerExpr       String?       // "sales > 10000 EUR"
  temporalExpr      String?       // "from 2025-01-01"
  jurisdiction      String        @default("HR")
  // WHAT - Assertion
  assertionType     AssertionType // OBLIGATION, PROHIBITION, PERMISSION, DEFINITION
  logicExpr         String        // "tax_place = destination"
  value             String?
  valueType         String?
  // Provenance
  exactQuote        String        @db.Text
  articleNumber     String?
  lawReference      String?
  confidence        Float         @default(0.8)
}

model ClaimException {
  id              String   @id
  claimId         String
  condition       String   // "IF alcohol_content > 0"
  overridesTo     String   // concept slug of overriding rule
  sourceArticle   String   // "Art 38(4)"
}
```

**Shape 2: Taxonomy (Concept Graph)**

```prisma
model ConceptNode {
  id              String   @id
  slug            String   @unique
  nameHr          String
  nameEn          String?
  parentId        String?
  synonyms        String[]      // ["sok", "juice"]
  hyponyms        String[]
  legalCategory   String?       // Legal term
  vatCategory     String?
  searchTerms     String[]
}
```

**Shape 4: Workflow (Process Graph)**

```prisma
model RegulatoryProcess {
  id              String      @id
  slug            String      @unique
  titleHr         String
  processType     ProcessType // REGISTRATION, FILING, APPEAL, CLOSURE
  estimatedTime   String?
  prerequisites   Json?
}

model ProcessStep {
  id              String   @id
  processId       String
  orderNum        Int
  actionHr        String   @db.Text
  requiresStepIds String[]
  requiresAssets  String[]
  onSuccessStepId String?
  onFailureStepId String?
}
```

**Shape 5: Reference (Lookup Tables)**

```prisma
model ReferenceTable {
  id              String            @id
  category        ReferenceCategory // IBAN, CN_CODE, TAX_OFFICE, INTEREST_RATE
  name            String
  jurisdiction    String            @default("HR")
  keyColumn       String
  valueColumn     String
}

model ReferenceEntry {
  id              String   @id
  tableId         String
  key             String   // "Split", "6201.11"
  value           String   // "HR1234...", "Računalne usluge"
  metadata        Json?
}
```

**Shape 6: Document (Asset Repository)**

```prisma
model RegulatoryAsset {
  id              String      @id
  formCode        String?     // "PDV-P", "JOPPD"
  officialName    String
  downloadUrl     String
  format          AssetFormat // PDF, XML, XLS, XLSX, DOC, DOCX, HTML
  assetType       AssetType   // FORM, TEMPLATE, GUIDE, INSTRUCTION
  validFrom       DateTime?
  validUntil      DateTime?
}
```

**Shape 7: Temporal (Transitional Provisions)**

```prisma
model TransitionalProvision {
  id              String            @id
  fromRule        String            // concept slug of old rule
  toRule          String            // concept slug of new rule
  cutoffDate      DateTime
  logicExpr       String            // "IF invoice_date < cutoff..."
  appliesRule     String
  pattern         TransitionPattern // INVOICE_DATE, DELIVERY_DATE, TAXPAYER_CHOICE
}
```

**Shape 8: Comparison Matrix (PR #115)**

```prisma
model ComparisonMatrix {
  id          String   @id
  slug        String   @unique
  titleHr     String
  appliesWhen String?  @db.Text  // DSL expression
  domainTags  String[]           // ["STARTING_BUSINESS", "TAX_REGIME"]
  options     Json               // ComparisonOption[]
  criteria    Json               // ComparisonCriterion[]
  cells       Json               // ComparisonCell[]
  conclusion  String?  @db.Text
}
```

### 18.5 Agent & Pipeline Models

```prisma
model AgentRun {
  id              String    @id
  agentType       AgentType // SENTINEL, EXTRACTOR, COMPOSER, REVIEWER, etc.
  status          String    // running, completed, failed
  input           Json
  output          Json?
  rawOutput       Json?     // For debugging
  error           String?
  tokensUsed      Int?
  durationMs      Int?
  confidence      Float?
}

model RegulatoryConflict {
  id                String         @id
  conflictType      ConflictType   // SOURCE_CONFLICT, TEMPORAL_CONFLICT
  status            ConflictStatus // OPEN, RESOLVED, ESCALATED
  itemAId           String?
  itemBId           String?
  description       String         @db.Text
  resolution        Json?
  requiresHumanReview Boolean      @default(false)
}

model RuleRelease {
  id              String   @id
  version         String   @unique // semver: "1.0.0"
  releaseType     String   // major, minor, patch
  effectiveFrom   DateTime
  contentHash     String
  changelogHr     String?  @db.Text
  auditTrail      Json?
}
```

### 18.6 Monitoring & Health Models

```prisma
model TruthHealthSnapshot {
  id                        String   @id
  timestamp                 DateTime @default(now())
  totalRules                Int
  publishedRules            Int
  unlinkedPointers          Int
  multiSourceRules          Int      @default(0)
  singleSourceRules         Int      @default(0)
  alertsTriggered           String[]
}

model WatchdogHealth {
  id          String               @id
  checkType   WatchdogCheckType    // STALE_SOURCE, DRAINER_PROGRESS, QUEUE_BACKLOG
  entityId    String
  status      WatchdogHealthStatus // HEALTHY, WARNING, CRITICAL
  lastChecked DateTime
  metric      Decimal?
  threshold   Decimal?
}

model WatchdogAlert {
  id              String           @id
  severity        WatchdogSeverity // INFO, WARNING, CRITICAL
  type            WatchdogAlertType
  message         String
  occurredAt      DateTime
  resolvedAt      DateTime?
}

model ExtractionRejected {
  id            String   @id
  evidenceId    String
  rejectionType String   // INVALID_PERCENTAGE, QUOTE_NOT_IN_EVIDENCE
  rawOutput     Json
  errorDetails  String
  attemptCount  Int      @default(1)
}

model CoverageReport {
  id              String   @id
  evidenceId      String   @unique
  claimsCount           Int   @default(0)
  processesCount        Int   @default(0)
  referenceTablesCount  Int   @default(0)
  assetsCount           Int   @default(0)
  coverageScore         Float @default(0)
  isComplete            Boolean @default(false)
}

model ReasoningTrace {
  id                  String   @id
  requestId           String   @unique
  events              Json     // Full typed ReasoningEvent[]
  userContextSnapshot Json
  outcome             String   // ANSWER, QUALIFIED_ANSWER, REFUSAL, ERROR
  confidence          Float?
  durationMs          Int?
}
```

---

## 19. Regulatory Truth Layer API Endpoints

### 19.1 Admin Regulatory Truth APIs

| Endpoint                                             | Method | Purpose                           |
| ---------------------------------------------------- | ------ | --------------------------------- |
| `/api/admin/regulatory-truth/sources`                | GET    | List regulatory sources           |
| `/api/admin/regulatory-truth/sources/[id]/toggle`    | POST   | Enable/disable source             |
| `/api/admin/regulatory-truth/sources/[id]/check`     | POST   | Force check source for updates    |
| `/api/admin/regulatory-truth/bootstrap`              | POST   | Initialize regulatory sources     |
| `/api/admin/regulatory-truth/trigger`                | POST   | Manually trigger pipeline         |
| `/api/admin/regulatory-truth/status`                 | GET    | Pipeline status                   |
| `/api/admin/regulatory-truth/truth-health`           | GET    | Get truth health metrics          |
| `/api/admin/regulatory-truth/coverage`               | GET    | Get extraction coverage stats     |
| `/api/admin/regulatory-truth/revalidation`           | POST   | Trigger rule revalidation         |
| `/api/admin/regulatory-truth/rules/[id]/approve`     | POST   | Approve rule for publication      |
| `/api/admin/regulatory-truth/rules/[id]/reject`      | POST   | Reject rule with reason           |
| `/api/admin/regulatory-truth/rules/check-pointers`   | POST   | Validate source pointer integrity |
| `/api/admin/regulatory-truth/conflicts/[id]/resolve` | POST   | Resolve conflict manually         |
| `/api/admin/regulatory-truth/releases/[id]/verify`   | POST   | Verify release integrity          |

### 19.2 Public Regulatory APIs

| Endpoint                  | Method | Purpose                      |
| ------------------------- | ------ | ---------------------------- |
| `/api/regulatory/trigger` | POST   | Trigger regulatory pipeline  |
| `/api/regulatory/status`  | GET    | Get pipeline status          |
| `/api/regulatory/metrics` | GET    | Get regulatory metrics       |
| `/api/regulatory/tier1`   | GET    | Get Tier 1 (high-risk) rules |
| `/api/rules/search`       | GET    | Search regulatory rules      |
| `/api/rules/evaluate`     | POST   | Evaluate rules against input |

### 19.3 AI Assistant APIs (Extended)

| Endpoint                          | Method | Purpose                   |
| --------------------------------- | ------ | ------------------------- |
| `/api/assistant/chat`             | POST   | AI assistant chat         |
| `/api/assistant/chat/stream`      | POST   | Streaming chat response   |
| `/api/assistant/chat/reasoning`   | POST   | Chat with reasoning trace |
| `/api/assistant/reason`           | POST   | Direct reasoning query    |
| `/api/assistant/reasoning/health` | GET    | Reasoning system health   |

### 19.4 Additional Cron Jobs

| Endpoint                      | Trigger | Purpose                    |
| ----------------------------- | ------- | -------------------------- |
| `/api/cron/fiscal-retry`      | 6h      | Retry failed fiscalization |
| `/api/cron/certificate-check` | Daily   | Check cert expiry          |
| `/api/cron/weekly-digest`     | Weekly  | Weekly user digest         |

**Updated Total API Routes:** 148 endpoints

---

## 20. Zod Schemas (Regulatory Truth)

Located in `/src/lib/regulatory-truth/schemas/`:

### 20.1 Schema Index

| Schema File             | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `common.ts`             | Shared enums (RiskTier, AgentType, etc.) |
| `sentinel.ts`           | Sentinel agent input/output              |
| `extractor.ts`          | Extractor agent with value types         |
| `composer.ts`           | Draft rule composition with DSL          |
| `reviewer.ts`           | Review decision schemas                  |
| `releaser.ts`           | Release packaging schemas                |
| `arbiter.ts`            | Conflict resolution schemas              |
| `content-classifier.ts` | Content type classification              |
| `atomic-claim.ts`       | Logic frame extraction (Shape 1)         |
| `process.ts`            | Process workflow extraction (Shape 4)    |
| `reference.ts`          | Lookup table extraction (Shape 5)        |
| `asset.ts`              | Document asset extraction (Shape 6)      |
| `transitional.ts`       | Transitional provision (Shape 7)         |
| `comparison-matrix.ts`  | Comparison matrix extraction (Shape 8)   |
| `query-intent.ts`       | User query classification                |

### 20.2 Key Type Definitions

```typescript
// Domain categories
type Domain =
  | "pausalni"
  | "pdv"
  | "porez_dohodak"
  | "doprinosi"
  | "fiskalizacija"
  | "rokovi"
  | "obrasci"

// Value types for extracted data
type ValueType =
  | "currency"
  | "percentage"
  | "date"
  | "threshold"
  | "text"
  | "currency_hrk"
  | "currency_eur"
  | "count"

// Risk tiers with confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  T0: 0.99, // Critical: Tax rates, legal deadlines
  T1: 0.95, // High: Thresholds, contribution bases
  T2: 0.9, // Medium: Procedural requirements
  T3: 0.85, // Low: UI labels, help text
}
```

---

## 21. Knowledge Hub Types

Located in `/src/lib/knowledge-hub/types.ts`:

### 21.1 Changelog Schema (PR #115)

```typescript
export type ChangelogSeverity = "breaking" | "critical" | "major" | "info"

export interface ChangelogEntry {
  id: string // Stable slug: "2025-01-15-pdv-threshold"
  date: string // ISO date
  severity: ChangelogSeverity
  summary: string // Human-readable, Croatian
  affectedSections?: string[] // Links to RegulatorySection ids
  sourceRef?: string // Canonical reference
  sourceEvidenceId?: string // Links to Evidence table
  sourcePending?: boolean // True if evidence not yet linked
}
```

### 21.2 Business Type Mappings

```typescript
export type BusinessType =
  | "pausalni-obrt"
  | "pausalni-obrt-uz-zaposlenje"
  | "pausalni-obrt-umirovljenik"
  | "obrt-dohodak"
  | "obrt-dohodak-uz-zaposlenje"
  | "obrt-dobit"
  | "jdoo"
  | "jdoo-uz-zaposlenje"
  | "doo-jednoclan"
  | "doo-viseclano"
  | "doo-direktor-bez-place"
  | "doo-direktor-s-placom"
  | "slobodna-profesija"
  | "opg"
  | "udruga"
  | "zadruga"
  | "sezonski-obrt"
  | "pausalni-pdv"
  | "it-freelancer"
  | "ugostiteljstvo"
```

---

## 22. Drizzle ORM Models (Extended)

Additional Drizzle tables not previously documented:

| Schema File    | Tables              | Purpose                |
| -------------- | ------------------- | ---------------------- |
| `tutorials.ts` | `tutorial_progress` | User tutorial tracking |

```typescript
// src/lib/db/schema/tutorials.ts
export const tutorialProgress = pgTable("tutorial_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  companyId: text("company_id").notNull(),
  trackId: text("track_id").notNull(),
  completedTasks: jsonb("completed_tasks").$type<string[]>().default([]),
  currentDay: text("current_day").default("1"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
})
```

---

## 23. EInvoice Model Updates

The EInvoice model has been extended with email tracking fields:

```prisma
model EInvoice {
  // ... existing fields ...

  // Email tracking (added)
  operatorOib       String?
  paymentMethod     PaymentMethod?
  emailMessageId    String?
  emailDeliveredAt  DateTime?
  emailOpenedAt     DateTime?
  emailClickedAt    DateTime?
  emailBouncedAt    DateTime?
  emailBounceReason String?
}
```

---

## 24. Data Flow Architecture

### 24.1 Regulatory Truth Pipeline

```
Discovery → Sentinel → Evidence → Extractor → SourcePointer
                                            ↓
                               Composer → DraftRule → Reviewer
                                            ↓
                               Conflict? → Arbiter → Resolution
                                            ↓
                                    Releaser → RuleRelease
```

### 24.2 Key Invariants

1. **Evidence immutability**: `Evidence.rawContent` is never modified
2. **Source pointer integrity**: Every rule must have at least one SourcePointer
3. **Fail-closed extraction**: Invalid DSL never defaults to "always true"
4. **Audit trail**: All rule state changes logged to RegulatoryAuditLog
