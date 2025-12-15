# Storage Locations Inventory

Last updated: 2025-12-15

## Summary

FiskAI stores data in **PostgreSQL** (primary), **Cloudflare R2** (objects), and **local filesystem** (temporary).

## Primary Storage (PostgreSQL)

| Category      | Tables                                                                            | Evidence                            |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| Users & Auth  | User, Account, Session, VerificationToken, PasswordResetToken, WebAuthnCredential | `prisma/schema.prisma:9-67,771-791` |
| Companies     | Company, CompanyUser                                                              | `prisma/schema.prisma:68-147`       |
| Contacts      | Contact                                                                           | `prisma/schema.prisma:148-172`      |
| Products      | Product                                                                           | `prisma/schema.prisma:173-190`      |
| Invoices      | EInvoice, EInvoiceLine                                                            | `prisma/schema.prisma:191-276`      |
| Expenses      | Expense, ExpenseCategory, RecurringExpense                                        | `prisma/schema.prisma:345-411`      |
| Banking       | BankAccount, BankTransaction, BankConnection, BankImport                          | `prisma/schema.prisma:430-640`      |
| Email Import  | EmailConnection, EmailImportRule, EmailAttachment                                 | `prisma/schema.prisma:544-625`      |
| Documents     | ImportJob, Statement, StatementPage, Transaction                                  | `prisma/schema.prisma:641-739`      |
| Support       | SupportTicket, SupportTicketMessage                                               | `prisma/schema.prisma:741-769`      |
| Fiscalization | FiscalCertificate, FiscalRequest                                                  | `prisma/schema.prisma:1007-1064`    |
| AI            | AIFeedback, AIUsage                                                               | `prisma/schema.prisma:1066-1106`    |
| Audit         | AuditLog                                                                          | `prisma/schema.prisma:278-295`      |
| Reports       | SavedReport                                                                       | `prisma/schema.prisma:413-429`      |

## Object Storage (Cloudflare R2)

| Bucket             | Purpose              | Evidence                  |
| ------------------ | -------------------- | ------------------------- |
| `fiskai-documents` | All document uploads | `src/lib/r2-client.ts:14` |

### R2 Key Patterns

| Pattern                                      | Content                | Evidence                             |
| -------------------------------------------- | ---------------------- | ------------------------------------ |
| `{companyId}/receipts/{uuid}.{ext}`          | Receipt images         | `src/lib/r2-client.ts:generateR2Key` |
| `{companyId}/invoices/{uuid}.pdf`            | Generated invoice PDFs | Invoice PDF generation               |
| `{companyId}/imports/{uuid}.{ext}`           | Imported documents     | Import system                        |
| `{companyId}/email-attachments/{uuid}.{ext}` | Email attachments      | Email sync                           |
| `{companyId}/bank-statements/{uuid}.pdf`     | Bank statements        | Bank import                          |

### R2 Configuration

```typescript
// src/lib/r2-client.ts:7-14
const r2Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.R2_BUCKET_NAME || "fiskai-documents"
```

## Temporary/Local Storage

| Path             | Purpose                | Lifetime         | Evidence           |
| ---------------- | ---------------------- | ---------------- | ------------------ |
| `/tmp/uploads/*` | Temporary file uploads | Request duration | Next.js API routes |
| `/tmp/pdf/*`     | PDF generation scratch | Request duration | PDF generation     |

## Upload Endpoints

| Endpoint                    | Storage Target | Evidence                               |
| --------------------------- | -------------- | -------------------------------------- |
| `POST /api/receipts/upload` | R2             | `src/app/api/receipts/upload/route.ts` |
| `POST /api/import/upload`   | R2             | `src/app/api/import/upload/route.ts`   |
| `POST /api/products/import` | Database       | `src/app/api/products/import/route.ts` |

## Download Endpoints

| Endpoint                     | Source    | Evidence                                 |
| ---------------------------- | --------- | ---------------------------------------- |
| `GET /api/receipts/view`     | R2        | `src/app/api/receipts/view/route.ts`     |
| `GET /api/invoices/[id]/pdf` | Generated | `src/app/api/invoices/[id]/pdf/route.ts` |
| `GET /api/reports/kpr/pdf`   | Generated | `src/app/api/reports/kpr/pdf/route.ts`   |
| `GET /api/reports/kpr/excel` | Generated | `src/app/api/reports/kpr/excel/route.ts` |

## Data Retention

| Data Type          | Retention      | Notes             |
| ------------------ | -------------- | ----------------- |
| User data          | Until deletion | GDPR compliant    |
| Invoices           | 11 years       | Croatian tax law  |
| Fiscal requests    | 11 years       | Tax compliance    |
| Audit logs         | 7 years        | Business records  |
| Receipts/documents | Company policy | User-configurable |

## Backup Strategy

| Component  | Method                   | Frequency  |
| ---------- | ------------------------ | ---------- |
| PostgreSQL | pg_dump / managed backup | Daily      |
| R2         | Cross-region replication | Continuous |

## Multi-tenant Isolation

All storage is tenant-isolated via `companyId`:

```typescript
// Every table has companyId for isolation
model EInvoice {
  companyId String
  // ...
  @@index([companyId])
}

// R2 keys prefixed with companyId
const key = `${companyId}/receipts/${uuid}.${ext}`
```

**Evidence**: `prisma/schema.prisma` (@@index on companyId), `src/lib/r2-client.ts`
