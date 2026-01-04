# Data Audit: Currency Consistency & Invoice Numbering (INV-011, INV-013)

## Evidence

### Invoice schema (currency & totals)

- `EInvoice.currency` defaults to `"EUR"`; monetary totals stored alongside currency and VAT values in the schema. 【F:prisma/schema.prisma†L200-L204】

### Currency handling in invoice actions

- Invoice creation sets `currency` from input, defaulting to `EUR`, and persists totals computed from line items. 【F:src/app/actions/invoice.ts†L62-L110】
- Conversion from proforma/quote preserves the source invoice’s `currency` and totals when issuing a new outbound invoice. 【F:src/app/actions/invoice.ts†L146-L185】
- Updates allow overriding `currency` without validation beyond presence of input. 【F:src/app/actions/invoice.ts†L193-L215】

### Invoice numbering generation

- `getNextInvoiceNumber` ensures default premises/device exist, increments a per-premises/year sequence via upsert, and formats the number `{seq}-{premises}-{device}` with `{year}/` internal reference. 【F:src/lib/invoice-numbering.ts†L28-L125】

### Database constraints for numbering

- Unique index enforces `EInvoice.invoiceNumber` uniqueness per `companyId`, scoping invoice numbers to each company. 【F:prisma/migrations/202502141200_add_tenant_constraints/migration.sql†L4-L5】
- `InvoiceSequence` table holds per-premises, per-year counters with a unique index on `(businessPremisesId, year)` to prevent duplicate sequences. 【F:prisma/migrations/20251211_add_invoice_numbering/migration.sql†L31-L59】

## Findings

1. **Currency defaults captured but mixed-currency prevention absent**: Currency is stored with each invoice and defaults to EUR, but creation, conversion, and update flows do not validate that line items share a currency or that inbound data matches company defaults. Mixed-currency invoices appear allowed. 【F:prisma/schema.prisma†L200-L204】【F:src/app/actions/invoice.ts†L62-L185】
2. **Invoice numbering is company-scoped and sequential per premises/year**: Numbers are generated via `getNextInvoiceNumber` using per-premises/year sequences, and DB constraints enforce uniqueness per company, preventing cross-company clashes while allowing identical numbers in different companies. 【F:src/lib/invoice-numbering.ts†L28-L125】【F:prisma/migrations/202502141200_add_tenant_constraints/migration.sql†L4-L5】【F:prisma/migrations/20251211_add_invoice_numbering/migration.sql†L31-L59】

## Conclusion

- Evidence shows company-scoped unique invoice numbering with structured sequences meeting INV-013 expectations.
- Currency data is persisted with totals, but no guardrails block mixed-currency invoices, highlighting a gap for INV-011 if single-currency enforcement is required.
