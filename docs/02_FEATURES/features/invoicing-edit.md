# Feature: Edit Invoice

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Allows users to modify existing invoice details (buyer, dates, line items, notes) while the invoice is in DRAFT status. Once an invoice is fiscalized or in any non-DRAFT status, editing is disabled to maintain fiscal compliance and audit integrity.

## User Entry Points

| Type | Path                 | Evidence                                         |
| ---- | -------------------- | ------------------------------------------------ |
| Page | /invoices/:id        | `src/app/(dashboard)/invoices/[id]/page.tsx:1`   |
| Page | /documents/:id       | `src/app/(dashboard)/documents/[id]/page.tsx:31` |
| API  | updateInvoice action | `src/app/actions/invoice.ts:193-267`             |

## Core Flow

### Invoice Edit Flow

1. User navigates to invoice list at /invoices or /documents -> `src/app/(dashboard)/invoices/page.tsx:18`
2. System redirects to unified documents hub -> `src/app/(dashboard)/documents/page.tsx:37`
3. User clicks on an invoice to view details -> `src/app/(dashboard)/documents/[id]/page.tsx:22-33`
4. System routes to invoice detail page based on type -> `src/app/(dashboard)/invoices/[id]/page.tsx:32-257`
5. Invoice detail page displays with current data -> `src/app/(dashboard)/invoices/[id]/page.tsx:46-59`
6. InvoiceActions component renders action buttons -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:15-136`
7. System checks if invoice can be edited (status === 'DRAFT') -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:22`
8. If DRAFT: Delete and Convert actions are available (no dedicated edit UI yet)
9. User calls updateInvoice server action to modify invoice -> `src/app/actions/invoice.ts:193-267`
10. Server validates invoice is in DRAFT status -> `src/app/actions/invoice.ts:201-207`
11. Server updates invoice data and recalculates totals -> `src/app/actions/invoice.ts:209-251`
12. Cache revalidation triggers UI refresh -> `src/app/actions/invoice.ts:259-260`

### Edit Restrictions Enforcement

1. System checks invoice status before any modification -> `src/app/actions/invoice.ts:202`
2. Only invoices with status='DRAFT' can be edited -> `src/app/actions/invoice.ts:202`
3. Once fiscalized (status='FISCALIZED'), editing is blocked -> `src/app/actions/fiscalize.ts:41-43`
4. UI conditionally hides edit/delete buttons for non-DRAFT invoices -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:22,129`
5. Similar restrictions apply to e-invoices -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:96-97`

## Key Modules

| Module               | Purpose                                         | Location                                                    |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Invoice Detail Page  | Displays invoice data with actions              | `src/app/(dashboard)/invoices/[id]/page.tsx`                |
| InvoiceActions       | Action buttons (edit/delete/convert)            | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx`     |
| updateInvoice action | Server action to update invoice                 | `src/app/actions/invoice.ts:193-267`                        |
| deleteInvoice action | Server action to delete DRAFT invoices          | `src/app/actions/invoice.ts:269-306`                        |
| Document Router      | Routes document IDs to appropriate detail pages | `src/app/(dashboard)/documents/[id]/page.tsx`               |
| FiscalStatusBadge    | Displays fiscalization status                   | `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx` |
| Invoice Editor       | Client component for editing invoice data       | `src/components/import/invoice-editor.tsx:1-366`            |

## Data

### Database Tables

- **EInvoice**: Main invoice table -> `prisma/schema.prisma:183-259`
  - Key fields: id, invoiceNumber, status, type, buyerId, issueDate, dueDate
  - Status field controls edit permissions -> `prisma/schema.prisma:205`
  - Fiscal fields: jir, zki, fiscalizedAt, operatorOib -> `prisma/schema.prisma:206-210`

- **EInvoiceLine**: Invoice line items -> `prisma/schema.prisma:261-276`
  - Key fields: eInvoiceId, lineNumber, description, quantity, unitPrice, vatRate
  - Deleted and recreated during updates -> `src/app/actions/invoice.ts:220`

- **FiscalRequest**: Fiscalization audit trail -> `prisma/schema.prisma` (referenced)
  - Tracks fiscalization attempts
  - Prevents editing after successful fiscalization

### Status Enum

```typescript
enum EInvoiceStatus {
  DRAFT                 // Editable, can be deleted
  PENDING_FISCALIZATION // Read-only, fiscalization in progress
  FISCALIZED            // Read-only, fiscally registered
  SENT                  // Read-only, sent to customer
  DELIVERED             // Read-only, email delivered
  ACCEPTED              // Read-only, customer accepted
  REJECTED              // Read-only, customer rejected
  ARCHIVED              // Read-only, archived
  ERROR                 // May allow retry, but not edit
}
```

Source: `prisma/schema.prisma:803-813`

## Edit Restrictions

### Status-Based Rules

- **DRAFT**: Full editing allowed -> `src/app/actions/invoice.ts:202`
- **FISCALIZED**: Cannot edit -> `src/app/actions/fiscalize.ts:41-43`
- **All other statuses**: Cannot edit -> `src/app/actions/invoice.ts:206`

### UI Conditional Rendering

- Delete button only shown for DRAFT invoices -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:22,129-133`
- Convert button shown for QUOTE and PROFORMA types -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:21,123-127`
- E-Invoice edit button only for DRAFT -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:96,102-106`

### Server-Side Validation

```typescript
const existing = await db.eInvoice.findFirst({
  where: { id, status: "DRAFT" },
})

if (!existing) {
  return { success: false, error: "Dokument nije pronađen ili nije nacrt" }
}
```

Source: `src/app/actions/invoice.ts:201-207`

### Converted Invoices

- Invoices converted from quotes/proforma cannot be deleted -> `src/app/actions/invoice.ts:283-289`
- Maintains audit trail through convertedFromId field -> `prisma/schema.prisma:231`

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/actions/invoice.ts:198`
- Tenant context isolation -> `src/app/actions/invoice.ts:200`
- Company ownership validation via RLS -> `src/lib/prisma-extensions` (implicit)

### Permission Requirements

- Delete requires 'invoice:delete' permission -> `src/app/actions/invoice.ts:273`
- Update uses standard company context validation -> `src/app/actions/invoice.ts:200`

### Data Integrity

- Line items deleted and recreated atomically -> `src/app/actions/invoice.ts:220-241`
- Totals recalculated on every update using Decimal -> `src/app/actions/invoice.ts:243-249`
- Status validation prevents editing locked invoices -> `src/app/actions/invoice.ts:202`

## Dependencies

- **Depends on**:
  - Create Invoice (F015) - Uses same data structures
  - View Invoices (F016) - Entry point for editing
  - Fiscalize Invoice (F064) - Status changes prevent editing

- **Depended by**:
  - Convert to Invoice (F022) - Creates new invoices from editable drafts
  - Invoice PDF Generation (F018) - Generates PDF from edited data

## Integrations

### Prisma ORM

- Transaction support for atomic line item updates -> `src/app/actions/invoice.ts:220-250`
- Decimal type for precise monetary calculations -> `src/app/actions/invoice.ts:10,223-241`
- Tenant context filtering -> `src/lib/prisma-extensions` (RLS)

### Next.js Cache

- revalidatePath for real-time UI updates -> `src/app/actions/invoice.ts:259-260`
- Invalidates both list and detail views -> `src/app/actions/invoice.ts:259-260`

### Invoice Numbering

- Preserves original invoice number during edits -> `src/app/actions/invoice.ts:209-215`
- Only generates new number on creation -> `src/lib/invoice-numbering.ts`

## UI Components

### Detail Page Components

- **Card, CardHeader, CardTitle, CardContent**: Layout containers
- **Button**: Action triggers with variant styles
- **InvoiceActions**: Action button group -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx`
- **FiscalStatusBadge**: Status indicator -> `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx`

### Editor Components

- **InvoiceEditor**: Full editor for invoice data -> `src/components/import/invoice-editor.tsx:1-366`
  - Line item editing with inline validation
  - Real-time total calculations
  - Vendor and payment info editing

### Status Badges

```typescript
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  SENT: "Poslano",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  // ... more statuses
}
```

Source: `src/app/(dashboard)/invoices/[id]/page.tsx:20-30`

## Error Handling

- **Invoice not found**: Returns 404 via notFound() -> `src/app/(dashboard)/invoices/[id]/page.tsx:61-63`
- **Not DRAFT status**: Returns error "Dokument nije pronađen ili nije nacrt" -> `src/app/actions/invoice.ts:206`
- **Permission denied**: Returns error for delete without permission -> `src/app/actions/invoice.ts:300-302`
- **Converted invoice deletion**: Prevents with specific error message -> `src/app/actions/invoice.ts:287`
- **Client-side validation**: Form validation before submit -> `src/app/(dashboard)/invoices/new/invoice-form.tsx:90-98`

## Verification Checklist

- [x] User can view invoice details at /invoices/:id
- [x] DRAFT invoices show edit/delete actions
- [x] FISCALIZED invoices hide edit/delete actions
- [x] updateInvoice validates DRAFT status
- [x] Line items are updated atomically
- [x] Totals are recalculated correctly
- [x] Cache invalidation refreshes UI
- [x] Permission check for delete action
- [x] Converted invoices cannot be deleted
- [x] Status badge reflects current state
- [x] Tenant isolation prevents cross-company edits
- [x] Error messages are clear and localized

## Related Features

- **Create Invoice**: `src/app/actions/invoice.ts:35-115` (F015)
- **View Invoices**: `src/app/(dashboard)/documents/page.tsx` (F016)
- **Delete Invoice**: `src/app/actions/invoice.ts:269-306` (part of edit feature)
- **Convert to Invoice**: `src/app/actions/invoice.ts:117-191` (F022)
- **Fiscalize Invoice**: `src/app/actions/fiscalize.ts:1-289` (F064)

## Evidence Links

1. `src/app/(dashboard)/invoices/[id]/page.tsx:1-257` - Main invoice detail page with status-based UI
2. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:1-136` - Action buttons with canDelete/canEdit logic
3. `src/app/actions/invoice.ts:193-267` - updateInvoice server action with DRAFT validation
4. `src/app/actions/invoice.ts:201-207` - Status check preventing non-DRAFT edits
5. `src/app/actions/invoice.ts:218-250` - Line item deletion and recreation with totals recalculation
6. `src/app/actions/invoice.ts:259-260` - Cache revalidation for UI updates
7. `src/app/actions/invoice.ts:269-306` - deleteInvoice with DRAFT validation
8. `src/app/actions/fiscalize.ts:41-43` - Fiscalization check preventing edits
9. `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:96-97` - E-invoice edit restrictions
10. `src/app/(dashboard)/documents/[id]/page.tsx:22-33` - Document routing to invoice detail
11. `prisma/schema.prisma:183-259` - EInvoice model with status field
12. `prisma/schema.prisma:261-276` - EInvoiceLine model
13. `prisma/schema.prisma:803-813` - EInvoiceStatus enum definition
14. `src/components/import/invoice-editor.tsx:1-366` - Client-side invoice editor component
15. `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:1-73` - Fiscal status display component
