# System Invariants (Contract)

Last updated: 2025-12-15

## Purpose

This document defines the invariants (rules that must always hold true) for FiskAI. Violating these invariants indicates a bug or security issue.

---

## 1. Multi-Tenant Isolation

### INV-001: Data Isolation by Company

**Rule**: All business data MUST be filtered by `companyId`. No user should ever see data belonging to another company.

**Enforcement**:

- Every business table has `companyId` column
- Queries use `runWithTenant()` wrapper
- RLS-like filtering at ORM level

**Evidence**: `src/lib/db.ts`, `src/lib/prisma-extensions.ts`

**Test**: Query any table without companyId filter should fail or return empty.

### INV-002: User-Company Membership

**Rule**: A user can only access companies they are a member of via `CompanyUser` relation.

**Enforcement**:

- `requireCompany()` checks membership
- Company switcher only shows member companies
- API routes validate company access

**Evidence**: `src/lib/auth-utils.ts:requireCompany`

---

## 2. Authentication & Authorization

### INV-003: Authentication Required

**Rule**: All `/api/*` routes (except auth, webhooks, health) require valid session.

**Enforcement**:

- `auth()` check at route start
- 401 response if unauthenticated
- Middleware protects dashboard routes

**Evidence**: `src/middleware.ts`, all API routes

### INV-004: Role-Based Access

**Rule**: Users can only perform actions allowed by their role in the company.

**Roles** (descending permissions):

1. OWNER - Full access
2. ADMIN - All except ownership transfer
3. ACCOUNTANT - Financial operations
4. MEMBER - Standard operations
5. VIEWER - Read-only

**Evidence**: `src/lib/rbac.ts`, `prisma/schema.prisma:784-790`

### INV-005: Cron Job Authorization

**Rule**: Cron endpoints require valid `CRON_SECRET` bearer token.

**Enforcement**: `Authorization: Bearer {CRON_SECRET}` header check

**Evidence**: `src/app/api/cron/*/route.ts`

---

## 3. Fiscalization (Croatian Tax Compliance)

### INV-006: JIR Immutability

**Rule**: Once an invoice has a JIR (Jedinstveni Identifikator Računa), the invoice data MUST NOT be modified.

**Enforcement**:

- FISCALIZED status prevents edits
- Audit log tracks all changes
- Only DRAFT invoices are editable

**Evidence**: `src/app/actions/e-invoice.ts`

### INV-007: ZKI Calculation

**Rule**: ZKI (Zaštitni Kod Izdavatelja) must be calculated from invoice data using the certificate private key before CRS submission.

**Components**: OIB + date + sequence + premises + device + total

**Evidence**: `src/lib/e-invoice/zki.ts`

### INV-008: Fiscal Certificate Security

**Rule**: P12 certificates must be encrypted at rest using `FISCAL_CERT_KEY`.

**Enforcement**:

- AES-256-GCM encryption
- Never stored in plaintext
- Key rotation supported

**Evidence**: `src/lib/secrets.ts`

---

## 4. Financial Integrity

### INV-009: Invoice Total Calculation

**Rule**: Invoice `totalAmount` MUST equal sum of line items: `netAmount + vatAmount`.

**Enforcement**: Server-side calculation, not client-provided

**Evidence**: `src/app/actions/e-invoice.ts`

### INV-010: VAT Rate Validity

**Rule**: VAT rates must be valid Croatian rates: 0%, 5%, 13%, 25%.

**Evidence**: `src/lib/constants/vat-rates.ts`

### INV-011: Currency Consistency

**Rule**: All amounts within an invoice must use the same currency.

**Default**: EUR (Croatian adoption 2023)

**Evidence**: `prisma/schema.prisma:200`

---

## 5. Data Integrity

### INV-012: Cascade Deletes

**Rule**: Deleting a company cascades to all related data (invoices, contacts, etc.).

**Enforcement**: `onDelete: Cascade` in Prisma schema

**Evidence**: All relations in `prisma/schema.prisma`

### INV-013: Unique Invoice Numbers

**Rule**: Invoice numbers must be unique within a company.

**Enforcement**: `InvoiceSequence` generates sequential numbers

**Evidence**: `prisma/schema.prisma:331-344`

### INV-014: OIB Format

**Rule**: Croatian OIB must be exactly 11 digits and pass MOD 11 validation.

**Enforcement**: Zod validation, OIB lookup verification

**Evidence**: `src/lib/oib-lookup.ts`

---

## 6. Security

### INV-015: No Plaintext Secrets

**Rule**: Sensitive data (certificates, tokens, passwords) must be encrypted or hashed.

**Applies to**:

- User passwords (bcrypt)
- Fiscal certificates (AES-256-GCM)
- OAuth tokens (encrypted)

**Evidence**: `src/lib/secrets.ts`, NextAuth configuration

### INV-016: HTTPS Only (Production)

**Rule**: All production traffic must use HTTPS.

**Enforcement**: Vercel/reverse proxy handles TLS

### INV-017: Rate Limiting

**Rule**: AI extraction endpoints must enforce rate limits per subscription tier.

**Limits**:

- FREE: 20/month
- STARTER: 100/month
- PAUSALNI: 500/month
- STANDARD: 2000/month
- PRO: 5000/month
- ENTERPRISE: Unlimited

**Evidence**: `src/lib/ai/rate-limiter.ts`

---

## 7. Audit Trail

### INV-018: Audit Logging

**Rule**: All significant business actions must be logged to `AuditLog`.

**Actions**: CREATE, UPDATE, DELETE, FISCALIZE, SEND, CONVERT, PAYMENT, LOGIN, LOGOUT, EXPORT, IMPORT, SETTINGS_CHANGE

**Evidence**: `src/lib/audit.ts`, `prisma/schema.prisma:278-295`

### INV-019: Retention Periods

**Rule**: Financial records must be retained per Croatian law:

- Invoices: 11 years
- Fiscal requests: 11 years
- Audit logs: 7 years

---

## 8. API Contracts

### INV-020: Consistent Error Format

**Rule**: All API errors must return JSON with `error` field.

```typescript
{ error: string, details?: unknown }
```

### INV-021: Pagination Limits

**Rule**: List endpoints default to 20 items, max 100.

**Evidence**: `src/lib/documents/unified-query.ts`

---

## Violation Handling

When an invariant is violated:

1. **Log** - Record full context via Pino/Sentry
2. **Alert** - Notify development team
3. **Block** - Prevent operation from completing
4. **Audit** - Add to audit log with ERROR action
5. **Fix** - Prioritize fix based on severity

## Severity Levels

| Level    | Description              | Example                    |
| -------- | ------------------------ | -------------------------- |
| Critical | Security breach possible | INV-001, INV-015 violation |
| High     | Data integrity at risk   | INV-006, INV-009 violation |
| Medium   | Compliance issue         | INV-010, INV-014 violation |
| Low      | Inconsistency            | INV-021 violation          |
