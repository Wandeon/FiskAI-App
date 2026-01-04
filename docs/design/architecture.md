# FiskAI - Architecture Design Document

**Version**: 1.0
**Date**: December 10, 2025
**Status**: Approved

## Executive Summary

FiskAI is an AI-first, cloud-based accounting and invoicing SaaS platform designed for Croatian businesses. It provides modular, self-standing components that can be sold independently while integrating seamlessly when combined.

## Vision

Build the most intelligent, user-friendly accounting solution for Croatian companies - from paušalni obrt to enterprise d.o.o. - with AI automation at its core.

## Core Principles

1. **AI-First**: Every feature considers AI automation potential
2. **Modular**: Self-standing modules, sellable separately
3. **Compliant**: Full Fiskalizacija 2.0 / EN 16931 compliance
4. **Provider-Agnostic**: No vendor lock-in for e-invoice providers
5. **Simple**: Start simple (paušalni obrt), scale to complex (full d.o.o.)

---

## Technology Stack

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **State**: React Query + Zustand
- **Forms**: React Hook Form + Zod

### Backend

- **Framework**: Next.js API Routes / Server Actions
- **Language**: TypeScript
- **ORM**: Prisma
- **Validation**: Zod

### Database

- **Primary**: PostgreSQL 16
- **Caching**: Redis (optional, for sessions/queues)

### Authentication

- **Library**: NextAuth.js (Auth.js)
- **Methods**: Email/password, Google OAuth
- **Sessions**: JWT + database sessions

### Infrastructure

- **Hosting**: Coolify on VPS-01 (ARM64)
- **CDN**: Cloudflare (free tier)
- **SSL**: Let's Encrypt (via Coolify)
- **DNS**: Cloudflare

### AI Services

- **OCR**: Google Cloud Vision / Tesseract
- **LLM**: OpenAI GPT-4 / Claude API
- **Embeddings**: OpenAI embeddings (for search)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudflare CDN                               │
│                    (SSL, Caching, DDoS Protection)                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VPS-01 (ARM64) + Coolify                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        Next.js Application                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │   Web UI    │  │  API Routes │  │   Server Actions    │   │  │
│  │  │   (React)   │  │   (REST)    │  │   (Mutations)       │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  │                           │                                    │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                    Business Logic                        │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │  │  │
│  │  │  │E-Invoice│ │Invoicing│ │Expenses │ │ Bookkeeping │   │  │  │
│  │  │  │ Module  │ │ Module  │ │ Module  │ │   Module    │   │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                           │                                    │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                      Core Layer                          │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │  │  │
│  │  │  │ Company │ │ Contact │ │ Product │ │    User     │   │  │  │
│  │  │  │  Mgmt   │ │  Mgmt   │ │  Mgmt   │ │   Auth      │   │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │    PostgreSQL    │  │      Redis       │  │  File Storage   │   │
│  │    (Primary DB)  │  │  (Cache/Queue)   │  │  (Invoices/PDF) │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    External Services                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  E-Invoice   │  │   AI/OCR     │  │     Payment Gateways     │  │
│  │  Providers   │  │   Services   │  │   (Stripe, etc.)         │  │
│  │  (IE Računi) │  │  (OpenAI)    │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Model

### Single Database with company_id

```
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Core Tables                       │    │
│  │  users, companies, company_users, contacts, products │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Module Tables (all have company_id)     │    │
│  │  invoices, expenses, transactions, journal_entries   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Row-Level Security Pattern

```sql
-- Every module table includes company_id
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  -- ... other fields
);

-- Index for performance
CREATE INDEX idx_invoices_company ON invoices(company_id);

-- Application-level filtering (Prisma middleware)
-- All queries automatically filtered by company_id from session
```

---

## Module Architecture

### Core Module (Always Required)

Provides shared functionality for all other modules:

```
core/
├── models/
│   ├── User
│   ├── Company
│   ├── CompanyUser (role-based access)
│   ├── Contact (customers, suppliers)
│   └── Product (goods, services)
├── services/
│   ├── AuthService
│   ├── CompanyService
│   └── ContactService
└── api/
    ├── auth/
    ├── companies/
    ├── contacts/
    └── products/
```

### Module Structure (e-Invoicing Example)

```
modules/
└── e-invoicing/
    ├── models/
    │   ├── EInvoice
    │   ├── EInvoiceStatus
    │   └── EInvoiceArchive
    ├── services/
    │   ├── EInvoiceService
    │   ├── UBLGeneratorService
    │   └── FiscalizationService
    ├── providers/
    │   ├── EInvoiceProvider (interface)
    │   ├── IERacuniProvider
    │   └── FinaProvider
    ├── api/
    │   ├── send/
    │   ├── receive/
    │   └── status/
    └── ui/
        ├── EInvoiceList
        ├── EInvoiceSend
        └── EInvoiceReceive
```

### Module Dependencies

```
                    ┌─────────────┐
                    │    Core     │
                    │   Module    │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ E-Invoicing │    │  Invoicing  │    │  Expenses   │
│   Module    │    │   Module    │    │   Module    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Bookkeeping │
                    │   Module    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  VAT/PDV    │ │   Payroll   │ │  Reporting  │
    │   Module    │ │   Module    │ │   Module    │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Database Schema (Core + E-Invoicing MVP)

### Core Tables

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  companies     CompanyUser[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Company {
  id            String    @id @default(cuid())
  name          String
  oib           String    @unique  // Croatian tax ID
  vatNumber     String?   // HR + OIB for VAT registered
  address       String
  city          String
  postalCode    String
  country       String    @default("HR")
  email         String?
  phone         String?
  iban          String?
  isVatPayer    Boolean   @default(false)

  users         CompanyUser[]
  contacts      Contact[]
  products      Product[]
  invoices      Invoice[]
  eInvoices     EInvoice[]

  // E-invoice settings
  eInvoiceProvider    String?   // 'ie-racuni', 'fina', etc.
  eInvoiceApiKey      String?   // Encrypted

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model CompanyUser {
  id            String    @id @default(cuid())
  user          User      @relation(fields: [userId], references: [id])
  userId        String
  company       Company   @relation(fields: [companyId], references: [id])
  companyId     String
  role          Role      @default(MEMBER)

  @@unique([userId, companyId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  ACCOUNTANT
  VIEWER
}

model Contact {
  id            String    @id @default(cuid())
  company       Company   @relation(fields: [companyId], references: [id])
  companyId     String
  type          ContactType
  name          String
  oib           String?
  vatNumber     String?
  address       String?
  city          String?
  postalCode    String?
  country       String    @default("HR")
  email         String?
  phone         String?

  invoices      Invoice[]
  eInvoicesReceived EInvoice[] @relation("EInvoiceBuyer")
  eInvoicesSent     EInvoice[] @relation("EInvoiceSeller")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([companyId])
}

enum ContactType {
  CUSTOMER
  SUPPLIER
  BOTH
}

model Product {
  id            String    @id @default(cuid())
  company       Company   @relation(fields: [companyId], references: [id])
  companyId     String
  name          String
  description   String?
  sku           String?
  unit          String    @default("C62")  // UN/ECE code
  price         Decimal   @db.Decimal(10, 2)
  vatRate       Decimal   @db.Decimal(5, 2) @default(25)
  vatCategory   String    @default("S")  // EN 16931 category

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([companyId])
}
```

### E-Invoicing Tables

```prisma
model EInvoice {
  id              String    @id @default(cuid())
  company         Company   @relation(fields: [companyId], references: [id])
  companyId       String

  // Direction
  direction       EInvoiceDirection

  // Parties
  seller          Contact?  @relation("EInvoiceSeller", fields: [sellerId], references: [id])
  sellerId        String?
  buyer           Contact?  @relation("EInvoiceBuyer", fields: [buyerId], references: [id])
  buyerId         String?

  // Invoice data
  invoiceNumber   String
  issueDate       DateTime
  dueDate         DateTime?
  currency        String    @default("EUR")

  // Amounts
  netAmount       Decimal   @db.Decimal(10, 2)
  vatAmount       Decimal   @db.Decimal(10, 2)
  totalAmount     Decimal   @db.Decimal(10, 2)

  // Status
  status          EInvoiceStatus @default(DRAFT)

  // Fiscalization
  jir             String?   // Jedinstveni identifikator računa
  zki             String?   // Zaštitni kod izdavatelja
  fiscalizedAt    DateTime?

  // XML storage
  ublXml          String?   @db.Text

  // Provider response
  providerRef     String?   // External reference from provider
  providerStatus  String?

  // Archival
  archivedAt      DateTime?
  archiveRef      String?   // Archive storage reference

  // Line items
  lines           EInvoiceLine[]

  // Audit
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  sentAt          DateTime?
  receivedAt      DateTime?

  @@index([companyId])
  @@index([status])
  @@index([invoiceNumber])
}

enum EInvoiceDirection {
  OUTBOUND  // We are sending
  INBOUND   // We are receiving
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

model EInvoiceLine {
  id              String    @id @default(cuid())
  eInvoice        EInvoice  @relation(fields: [eInvoiceId], references: [id])
  eInvoiceId      String

  lineNumber      Int
  description     String
  quantity        Decimal   @db.Decimal(10, 3)
  unit            String    @default("C62")
  unitPrice       Decimal   @db.Decimal(10, 2)
  netAmount       Decimal   @db.Decimal(10, 2)
  vatRate         Decimal   @db.Decimal(5, 2)
  vatCategory     String    @default("S")
  vatAmount       Decimal   @db.Decimal(10, 2)

  @@index([eInvoiceId])
}
```

---

## E-Invoice Provider Adapter Pattern

```typescript
// lib/e-invoice/provider.ts

export interface SendInvoiceResult {
  success: boolean
  providerRef?: string
  jir?: string
  zki?: string
  error?: string
}

export interface EInvoiceProvider {
  name: string

  // Send invoice
  sendInvoice(invoice: EInvoice, ublXml: string): Promise<SendInvoiceResult>

  // Receive invoices
  fetchIncomingInvoices(): Promise<IncomingInvoice[]>

  // Check status
  getInvoiceStatus(providerRef: string): Promise<InvoiceStatus>

  // Archive
  archiveInvoice(invoice: EInvoice): Promise<ArchiveResult>

  // Test connection
  testConnection(): Promise<boolean>
}

// Implementation example
export class IERacuniProvider implements EInvoiceProvider {
  name = "IE Računi"

  constructor(
    private apiKey: string,
    private apiUrl: string
  ) {}

  async sendInvoice(invoice: EInvoice, ublXml: string): Promise<SendInvoiceResult> {
    // Implementation...
  }

  // ... other methods
}

// Factory
export function createEInvoiceProvider(
  providerName: string,
  config: ProviderConfig
): EInvoiceProvider {
  switch (providerName) {
    case "ie-racuni":
      return new IERacuniProvider(config.apiKey, config.apiUrl)
    case "fina":
      return new FinaProvider(config.apiKey, config.apiUrl)
    default:
      throw new Error(`Unknown provider: ${providerName}`)
  }
}
```

---

## AI Integration Architecture

### Phase 1: OCR & Smart Data Entry

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│    OCR      │────▶│   Extract   │
│   Image     │     │  Service    │     │   Fields    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Validate  │
                                        │   & Confirm │
                                        └─────────────┘
```

### Phase 2: Intelligent Automation

```typescript
// AI service for categorization
interface AICategorizationService {
  categorizeExpense(
    description: string,
    amount: number
  ): Promise<{
    category: string
    confidence: number
    accountCode?: string
  }>

  detectAnomalies(transactions: Transaction[]): Promise<Anomaly[]>

  suggestBookingEntry(invoice: Invoice): Promise<JournalEntry[]>
}
```

### Phase 3: Conversational Assistant

```typescript
// Natural language query interface
interface AIAssistant {
  query(prompt: string, context: CompanyContext): Promise<AssistantResponse>

  // Example queries:
  // "Pokaži mi neplaćene račune iz prošlog mjeseca"
  // "Koliki je PDV za ovaj kvartal?"
  // "Napravi račun za klijenta X kao prošli put"
}
```

---

## API Structure

### REST API Routes

```
/api/
├── auth/
│   ├── login
│   ├── register
│   ├── logout
│   └── session
├── companies/
│   ├── [id]/
│   │   ├── settings
│   │   └── users
│   └── switch
├── contacts/
│   ├── [id]
│   └── search
├── products/
│   └── [id]
├── e-invoices/
│   ├── outbound/
│   │   ├── create
│   │   ├── [id]/send
│   │   └── [id]/status
│   ├── inbound/
│   │   ├── fetch
│   │   └── [id]/accept
│   └── [id]/
│       ├── xml
│       └── pdf
└── ai/
    ├── ocr
    ├── categorize
    └── query
```

---

## Security Considerations

### Authentication & Authorization

1. **Session-based auth** via NextAuth.js
2. **Company-level access** verified on every request
3. **Role-based permissions** (Owner, Admin, Member, Accountant, Viewer)
4. **API keys** encrypted at rest for e-invoice providers

### Data Protection

1. **All traffic over HTTPS** (Cloudflare + Let's Encrypt)
2. **Database encryption at rest** (PostgreSQL)
3. **Sensitive fields encrypted** (API keys, credentials)
4. **11-year archival** with integrity verification

### Compliance

1. **GDPR** - data export, deletion rights
2. **Croatian tax law** - proper record keeping
3. **EN 16931** - e-invoice format compliance

---

## Deployment Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   GitHub     │────▶│   Coolify    │────▶│   VPS-01     │
│   (main)     │     │   (Build)    │     │   (Deploy)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    │
       │             ┌──────────────┐            │
       │             │   Docker     │            │
       │             │   ARM64      │            │
       │             └──────────────┘            │
       │                                         │
       └────────────────────────────────────────▶│
                    (Webhook trigger)            │
                                                 ▼
                                          ┌──────────────┐
                                          │  Cloudflare  │
                                          │     CDN      │
                                          └──────────────┘
```

---

## Module Roadmap

| Phase | Module                                     | Priority | Dependencies        |
| ----- | ------------------------------------------ | -------- | ------------------- |
| 1     | Core (Auth, Companies, Contacts, Products) | MVP      | None                |
| 1     | E-Invoicing                                | MVP      | Core                |
| 2     | Invoicing                                  | High     | Core                |
| 2     | Expenses                                   | High     | Core                |
| 3     | Banking Integration                        | Medium   | Invoicing, Expenses |
| 3     | Bookkeeping                                | Medium   | All above           |
| 4     | VAT/PDV Reporting                          | Medium   | Bookkeeping         |
| 4     | Payroll (JOPPD)                            | Medium   | Bookkeeping         |
| 5     | Financial Reporting                        | Medium   | All above           |
| 5     | Assets Management                          | Low      | Bookkeeping         |

---

## Success Metrics

### Technical

- Page load < 2 seconds
- API response < 500ms
- 99.9% uptime
- Zero data loss

### Business

- E-invoice delivery success rate > 99%
- OCR accuracy > 95%
- User onboarding < 10 minutes

---

## Next Steps

1. Set up Next.js project with TypeScript
2. Configure Prisma with PostgreSQL
3. Implement Core module (auth, companies)
4. Build E-Invoicing MVP
5. Integrate first provider (IE Računi or DDD)
6. Deploy to VPS-01 via Coolify
7. Beta test with your two companies

---

_Document approved for implementation._
