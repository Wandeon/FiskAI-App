# Unified Documents Hub

**Date:** 2024-12-14
**Status:** Approved
**Author:** Claude + Mislav

## Overview

Consolidate all document types (invoices, e-invoices, bank statements, expenses) into a single unified Documents hub at `/documents`. This replaces the fragmented navigation where "Dokumenti" only showed invoices and bank statements were buried under `/banking/documents`.

## Goals

1. Single entry point for all company documents
2. Consistent UX with filter cards and status pills
3. Clean URL structure with backwards compatibility
4. Reduce menu clutter

## Route Structure

### New Routes

| Route             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `/documents`      | Unified documents hub                                      |
| `/documents/[id]` | Smart detail router (redirects to appropriate detail page) |

### Redirects (backwards compatibility)

| Old Route            | Redirects To                         |
| -------------------- | ------------------------------------ |
| `/invoices`          | `/documents?category=invoice`        |
| `/e-invoices`        | `/documents?category=e-invoice`      |
| `/banking/documents` | `/documents?category=bank-statement` |
| `/expenses`          | `/documents?category=expense`        |

### Navigation Menu Update

**Before:**

```
Financije:
  - Dokumenti → /invoices
  - Troškovi → /expenses
  - Banka → /banking
  - Izvještaji → /reports
```

**After:**

```
Financije:
  - Dokumenti → /documents
  - Banka → /banking (accounts & reconciliation only)
  - Izvještaji → /reports
```

## Unified Document Model

All document types are normalized to common fields for display:

| Field          | Invoice/E-Invoice     | Bank Statement   | Expense       |
| -------------- | --------------------- | ---------------- | ------------- |
| `id`           | eInvoice.id           | importJob.id     | expense.id    |
| `date`         | issueDate             | createdAt        | date          |
| `number`       | invoiceNumber         | originalName     | receiptNumber |
| `category`     | "invoice"/"e-invoice" | "bank-statement" | "expense"     |
| `counterparty` | buyer.name            | bankAccount.name | vendor        |
| `amount`       | totalAmount           | transactionCount | amount        |
| `status`       | status                | status           | status        |
| `currency`     | currency              | null             | currency      |

### Document Categories

| Category         | Label (HR)      | Source Table                                                  |
| ---------------- | --------------- | ------------------------------------------------------------- |
| `invoice`        | Računi          | EInvoice (type=INVOICE,QUOTE,PROFORMA,CREDIT_NOTE,DEBIT_NOTE) |
| `e-invoice`      | E-Računi        | EInvoice (type=E_INVOICE)                                     |
| `bank-statement` | Bankovni izvodi | ImportJob                                                     |
| `expense`        | Troškovi        | Expense                                                       |

## UI Components

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Dokumenti                              [Novi dokument ▾]        │
│ Svi dokumenti na jednom mjestu                                  │
└─────────────────────────────────────────────────────────────────┘

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│   47   │ │   12   │ │    8   │ │    7   │ │   20   │
│  Svi   │ │ Računi │ │E-Računi│ │ Izvodi │ │Troškovi│
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘

● Nacrt (5)  ● Obrađeno (20)  ● Greška (2)  ● Dospjelo (5)

┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Pretraži dokumente...                                        │
├───────┬──────────┬───────────────────┬───────────┬─────────────┤
│ Datum │ Vrsta    │ Broj/Naziv        │ Strana    │ Iznos       │
├───────┼──────────┼───────────────────┼───────────┼─────────────┤
│ 14.12 │ Izvod    │ FSTM...20241214   │ PBZ       │ 4 trans     │
│ 13.12 │ E-Račun  │ R-2024-0042       │ ABC d.o.o │ €1.250,00   │
└───────┴──────────┴───────────────────┴───────────┴─────────────┘
```

### New Document Dropdown

```
┌──────────────────────────┐
│ 📄 Novi račun            │ → /invoices/new?type=INVOICE
│ 📧 Novi e-račun          │ → /e-invoices/new
│ 🏦 Uvezi bankovni izvod  │ → /banking/import
│ 🧾 Novi trošak           │ → /expenses/new
└──────────────────────────┘
```

### Table Columns

| Column       | Label      | Content                               |
| ------------ | ---------- | ------------------------------------- |
| date         | Datum      | Formatted date (dd.mm.yyyy)           |
| category     | Vrsta      | Badge with category color             |
| number       | Broj/Naziv | Document number or filename           |
| counterparty | Strana     | Buyer, vendor, or bank account        |
| amount       | Iznos      | Formatted amount or transaction count |
| status       | Status     | Status badge                          |
| actions      | —          | "Pregledaj" link                      |

## Implementation Files

### New Files

| File                                                 | Purpose                         |
| ---------------------------------------------------- | ------------------------------- |
| `src/app/(dashboard)/documents/page.tsx`             | Main unified hub                |
| `src/app/(dashboard)/documents/[id]/page.tsx`        | Smart detail router             |
| `src/lib/documents/unified-query.ts`                 | Query & normalize all doc types |
| `src/components/documents/category-cards.tsx`        | Clickable filter cards          |
| `src/components/documents/new-document-dropdown.tsx` | Dropdown menu                   |

### Modified Files

| File                                             | Changes               |
| ------------------------------------------------ | --------------------- |
| `src/lib/navigation.ts`                          | Update menu structure |
| `src/app/(dashboard)/invoices/page.tsx`          | Add redirect          |
| `src/app/(dashboard)/expenses/page.tsx`          | Add redirect          |
| `src/app/(dashboard)/banking/documents/page.tsx` | Add redirect          |

### Unchanged Files

| File                                           | Reason            |
| ---------------------------------------------- | ----------------- |
| `src/app/(dashboard)/invoices/[id]/page.tsx`   | Keep detail pages |
| `src/app/(dashboard)/e-invoices/[id]/page.tsx` | Keep detail pages |
| `src/app/(dashboard)/banking/import/page.tsx`  | Keep import flow  |

## Query Strategy

```typescript
// Fetch all document types in parallel
const [invoices, bankStatements, expenses] = await Promise.all([
  db.eInvoice.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
  db.importJob.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
  db.expense.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
])

// Normalize to unified format
const documents = [
  ...invoices.map(normalizeInvoice),
  ...bankStatements.map(normalizeBankStatement),
  ...expenses.map(normalizeExpense),
].sort((a, b) => b.date.getTime() - a.date.getTime())
```

## Status Mapping

### Generic Statuses (for mixed view)

| Generic    | Invoice                               | Bank Statement           | Expense  |
| ---------- | ------------------------------------- | ------------------------ | -------- |
| Nacrt      | DRAFT                                 | —                        | PENDING  |
| Obrađeno   | SENT, DELIVERED, ACCEPTED, FISCALIZED | VERIFIED                 | APPROVED |
| Greška     | ERROR, REJECTED                       | FAILED                   | REJECTED |
| Na čekanju | PENDING_FISCALIZATION                 | PROCESSING, NEEDS_REVIEW | —        |

## Future Considerations

1. **Full-text search** - Add search across all document types
2. **Bulk actions** - Select multiple documents for export/delete
3. **Document preview** - Inline preview panel without navigating away
4. **Tags/Labels** - User-defined tags across all document types
