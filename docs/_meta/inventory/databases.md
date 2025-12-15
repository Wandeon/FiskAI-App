# Database Inventory

Last updated: 2025-12-15

## Summary

FiskAI uses **PostgreSQL** with **Prisma ORM**, containing **38 models** and **32 enums**.

## Database Configuration

| Property   | Value              | Evidence                 |
| ---------- | ------------------ | ------------------------ |
| Database   | PostgreSQL         | `prisma/schema.prisma:3` |
| ORM        | Prisma Client      | `src/lib/db.ts:1`        |
| Adapter    | @prisma/adapter-pg | `src/lib/db.ts:2`        |
| Connection | Pooled             | `src/lib/db.ts:11`       |

## Models (38 total)

### Authentication & Users

| Model              | Purpose              | Line                       |
| ------------------ | -------------------- | -------------------------- |
| User               | User accounts        | `prisma/schema.prisma:9`   |
| Account            | OAuth accounts       | `prisma/schema.prisma:25`  |
| Session            | Active sessions      | `prisma/schema.prisma:43`  |
| VerificationToken  | Email verification   | `prisma/schema.prisma:51`  |
| PasswordResetToken | Password reset flows | `prisma/schema.prisma:59`  |
| WebAuthnCredential | Passkey storage      | `prisma/schema.prisma:771` |

### Companies & Contacts

| Model       | Purpose             | Line                       |
| ----------- | ------------------- | -------------------------- |
| Company     | Business entities   | `prisma/schema.prisma:68`  |
| CompanyUser | Company memberships | `prisma/schema.prisma:132` |
| Contact     | Customers/suppliers | `prisma/schema.prisma:148` |
| Product     | Product catalog     | `prisma/schema.prisma:173` |

### Invoicing

| Model           | Purpose            | Line                       |
| --------------- | ------------------ | -------------------------- |
| EInvoice        | All invoice types  | `prisma/schema.prisma:191` |
| EInvoiceLine    | Invoice line items | `prisma/schema.prisma:261` |
| InvoiceSequence | Number generation  | `prisma/schema.prisma:331` |

### Fiscalization

| Model             | Purpose          | Line                        |
| ----------------- | ---------------- | --------------------------- |
| BusinessPremises  | Fiscal premises  | `prisma/schema.prisma:296`  |
| PaymentDevice     | Fiscal devices   | `prisma/schema.prisma:314`  |
| FiscalCertificate | P12 certificates | `prisma/schema.prisma:1007` |
| FiscalRequest     | CRS requests     | `prisma/schema.prisma:1033` |

### Expenses

| Model            | Purpose            | Line                       |
| ---------------- | ------------------ | -------------------------- |
| Expense          | Expense records    | `prisma/schema.prisma:345` |
| ExpenseCategory  | Categorization     | `prisma/schema.prisma:376` |
| RecurringExpense | Recurring expenses | `prisma/schema.prisma:392` |

### Banking

| Model              | Purpose             | Line                       |
| ------------------ | ------------------- | -------------------------- |
| BankAccount        | Connected accounts  | `prisma/schema.prisma:430` |
| BankTransaction    | Synced transactions | `prisma/schema.prisma:461` |
| BankConnection     | GoCardless links    | `prisma/schema.prisma:495` |
| BankImport         | Import batches      | `prisma/schema.prisma:626` |
| PotentialDuplicate | Duplicate detection | `prisma/schema.prisma:521` |

### Email Import

| Model           | Purpose             | Line                       |
| --------------- | ------------------- | -------------------------- |
| EmailConnection | Gmail/Outlook links | `prisma/schema.prisma:544` |
| EmailImportRule | Import filters      | `prisma/schema.prisma:572` |
| EmailAttachment | Stored attachments  | `prisma/schema.prisma:593` |

### Document Processing

| Model         | Purpose                | Line                       |
| ------------- | ---------------------- | -------------------------- |
| ImportJob     | Document imports       | `prisma/schema.prisma:641` |
| Statement     | Bank statements        | `prisma/schema.prisma:670` |
| StatementPage | Statement pages        | `prisma/schema.prisma:701` |
| Transaction   | Statement transactions | `prisma/schema.prisma:718` |

### Support

| Model                | Purpose         | Line                       |
| -------------------- | --------------- | -------------------------- |
| SupportTicket        | Support tickets | `prisma/schema.prisma:741` |
| SupportTicketMessage | Ticket messages | `prisma/schema.prisma:760` |

### AI Features

| Model      | Purpose             | Line                        |
| ---------- | ------------------- | --------------------------- |
| AIFeedback | Extraction feedback | `prisma/schema.prisma:1066` |
| AIUsage    | Usage tracking      | `prisma/schema.prisma:1086` |

### Audit & Reports

| Model       | Purpose            | Line                       |
| ----------- | ------------------ | -------------------------- |
| AuditLog    | Action logging     | `prisma/schema.prisma:278` |
| SavedReport | Report definitions | `prisma/schema.prisma:413` |

## Enums (32 total)

### User & Auth

| Enum | Values                                   | Line                       |
| ---- | ---------------------------------------- | -------------------------- |
| Role | OWNER, ADMIN, ACCOUNTANT, MEMBER, VIEWER | `prisma/schema.prisma:784` |

### Contacts & Invoicing

| Enum              | Values                                                                                                    | Line                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| ContactType       | CUSTOMER, SUPPLIER, BOTH                                                                                  | `prisma/schema.prisma:792` |
| EInvoiceDirection | OUTBOUND, INBOUND                                                                                         | `prisma/schema.prisma:798` |
| EInvoiceStatus    | DRAFT, PENDING_FISCALIZATION, FISCALIZED, SENT, DELIVERED, ACCEPTED, REJECTED, ARCHIVED, ERROR            | `prisma/schema.prisma:803` |
| InvoiceType       | INVOICE, E_INVOICE, QUOTE, PROFORMA, CREDIT_NOTE, DEBIT_NOTE                                              | `prisma/schema.prisma:815` |
| AuditAction       | CREATE, UPDATE, DELETE, FISCALIZE, SEND, CONVERT, PAYMENT, LOGIN, LOGOUT, EXPORT, IMPORT, SETTINGS_CHANGE | `prisma/schema.prisma:824` |

### Expenses

| Enum          | Values                                    | Line                       |
| ------------- | ----------------------------------------- | -------------------------- |
| ExpenseStatus | DRAFT, APPROVED, PAID, CANCELLED          | `prisma/schema.prisma:834` |
| PaymentMethod | CASH, CARD, BANK_TRANSFER, OTHER          | `prisma/schema.prisma:841` |
| Frequency     | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY | `prisma/schema.prisma:848` |

### Reports

| Enum           | Values                                                              | Line                       |
| -------------- | ------------------------------------------------------------------- | -------------------------- |
| ReportType     | INCOME, EXPENSE, PROFIT_LOSS, VAT, CASH_FLOW, BALANCE_SHEET, CUSTOM | `prisma/schema.prisma:855` |
| ReportSchedule | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, MANUAL                   | `prisma/schema.prisma:865` |

### Banking

| Enum                | Values                                        | Line                       |
| ------------------- | --------------------------------------------- | -------------------------- |
| MatchStatus         | UNMATCHED, MATCHED, PARTIALLY_MATCHED, MANUAL | `prisma/schema.prisma:872` |
| ImportFormat        | CSV, MT940, CAMT053, PDF, OTHER               | `prisma/schema.prisma:879` |
| TransactionSource   | BANK_SYNC, MANUAL, IMPORT                     | `prisma/schema.prisma:946` |
| DuplicateStatus     | PENDING, CONFIRMED, DISMISSED                 | `prisma/schema.prisma:951` |
| DuplicateResolution | KEEP_BOTH, KEEP_FIRST, KEEP_SECOND, MERGE     | `prisma/schema.prisma:956` |

### Jobs & Documents

| Enum         | Values                                                         | Line                       |
| ------------ | -------------------------------------------------------------- | -------------------------- |
| JobStatus    | PENDING, PROCESSING, NEEDS_REVIEW, APPROVED, COMPLETED, FAILED | `prisma/schema.prisma:885` |
| TierType     | FREE, STARTER, PAUSALNI, STANDARD, PRO, ENTERPRISE             | `prisma/schema.prisma:896` |
| DocumentType | INVOICE, BANK_STATEMENT, RECEIPT, CONTRACT, OTHER              | `prisma/schema.prisma:902` |
| PageStatus   | PENDING, EXTRACTED, VERIFIED, ERROR                            | `prisma/schema.prisma:908` |
| TxDirection  | INFLOW, OUTFLOW                                                | `prisma/schema.prisma:915` |

### Support

| Enum                  | Values                              | Line                       |
| --------------------- | ----------------------------------- | -------------------------- |
| SupportTicketStatus   | OPEN, IN_PROGRESS, RESOLVED, CLOSED | `prisma/schema.prisma:920` |
| SupportTicketPriority | LOW, NORMAL, HIGH, URGENT           | `prisma/schema.prisma:927` |

### Sync & Connections

| Enum                  | Values                                   | Line                       |
| --------------------- | ---------------------------------------- | -------------------------- |
| SyncProvider          | GOCARDLESS, PLAID, MANUAL                | `prisma/schema.prisma:934` |
| ConnectionStatus      | PENDING, ACTIVE, EXPIRED, REVOKED, ERROR | `prisma/schema.prisma:940` |
| EmailProvider         | GMAIL, MICROSOFT, IMAP                   | `prisma/schema.prisma:962` |
| EmailConnectionStatus | PENDING, ACTIVE, EXPIRED, ERROR          | `prisma/schema.prisma:967` |
| AttachmentStatus      | PENDING, PROCESSED, IGNORED, ERROR       | `prisma/schema.prisma:974` |

### Fiscalization

| Enum              | Values                                        | Line                        |
| ----------------- | --------------------------------------------- | --------------------------- |
| FiscalEnv         | PRODUCTION, TEST                              | `prisma/schema.prisma:981`  |
| CertStatus        | ACTIVE, EXPIRED, REVOKED                      | `prisma/schema.prisma:986`  |
| FiscalStatus      | PENDING, SUBMITTED, ACCEPTED, REJECTED, ERROR | `prisma/schema.prisma:993`  |
| FiscalMessageType | RACUN, POSLOVNI_PROSTOR, NAPLATNI_UREDAJ      | `prisma/schema.prisma:1001` |

## Key Indexes

All tables have indexes on:

- `id` (primary key)
- `companyId` (tenant isolation)
- `createdAt` (sorting)

Additional indexes:

- `EInvoice`: status, invoiceNumber, direction, type
- `BankTransaction`: date, matchStatus
- `Contact`: oib, name
- `ImportJob`: status

## Multi-tenant Design

Every business table includes:

```prisma
model Example {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
}
```

Data isolation enforced at:

1. ORM level via `runWithTenant()`
2. Query level via `where: { companyId }`
3. Cascade delete on company removal

**Evidence**: `src/lib/db.ts`, `src/lib/prisma-extensions.ts`

## Migrations

Location: `prisma/migrations/`

Run migrations:

```bash
npx prisma migrate deploy  # Production
npx prisma migrate dev     # Development
```
