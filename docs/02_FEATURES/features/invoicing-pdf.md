# Feature: Invoice PDF Generation

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Generates professional, fiscally compliant PDF invoices with barcode support for payment. The feature transforms invoice data from the database into a formatted PDF document using React-based templating, including Croatian fiscal codes (JIR/ZKI), payment barcodes (EPC QR), and proper formatting for business invoices. PDFs can be downloaded directly or attached to emails.

## User Entry Points

| Type   | Path                      | Evidence                                         |
| ------ | ------------------------- | ------------------------------------------------ |
| API    | /api/invoices/:id/pdf     | `src/app/api/invoices/[id]/pdf/route.ts:11`      |
| Action | Download PDF button       | `src/app/(dashboard)/invoices/[id]/page.tsx:101` |
| Action | Email with PDF attachment | `src/app/actions/e-invoice.ts:348-445`           |

## Core Flow

1. User clicks "Preuzmi PDF" button on invoice detail page → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:106`
2. Client makes GET request to `/api/invoices/${id}/pdf` → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:61`
3. API route validates user authentication and company ownership → `src/app/api/invoices/[id]/pdf/route.ts:26-43`
4. System fetches invoice with all relations (buyer, seller, lines) → `src/app/api/invoices/[id]/pdf/route.ts:48-60`
5. Invoice data normalized and prepared for template → `src/app/api/invoices/[id]/pdf/route.ts:81-128`
6. If barcode enabled and IBAN present, generate EPC QR code → `src/app/api/invoices/[id]/pdf/route.ts:131-141`
7. React PDF template rendered with invoice data → `src/app/api/invoices/[id]/pdf/route.ts:144-145`
8. PDF buffer generated using @react-pdf/renderer → `src/app/api/invoices/[id]/pdf/route.ts:145`
9. Response returned with attachment disposition and proper filename → `src/app/api/invoices/[id]/pdf/route.ts:151-157`
10. Browser triggers download with sanitized filename → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:67-77`

## Key Modules

| Module                        | Purpose                               | Location                                                |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------- |
| PDF Route Handler             | API endpoint for PDF generation       | `src/app/api/invoices/[id]/pdf/route.ts`                |
| InvoicePDFTemplate            | React component defining PDF layout   | `src/lib/pdf/invoice-template.tsx`                      |
| InvoicePDFDocument            | Export wrapper for template component | `src/lib/pdf/invoice-template.tsx:464-466`              |
| InvoiceActions                | UI component with download button     | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx` |
| generateInvoiceBarcodeDataUrl | Creates EPC QR code for payment       | `src/lib/barcode.ts:115-125`                            |
| validateIban                  | IBAN validation using ISO 13616       | `src/lib/barcode.ts:4-62`                               |
| buildEpcQrPayload             | Constructs SEPA payment QR data       | `src/lib/barcode.ts:81-113`                             |
| sendInvoiceEmail              | Server action for email with PDF      | `src/app/actions/e-invoice.ts:348-445`                  |

## Data

- **Primary Table**: `eInvoice` → `prisma/schema.prisma`
- **Required Fields**:
  - `id` (String): Invoice identifier
  - `invoiceNumber` (String): Display number for invoice
  - `issueDate` (DateTime): Date of issuance
  - `currency` (String): Currency code (EUR, HRK, etc.)
  - `netAmount` (Decimal): Amount before VAT
  - `vatAmount` (Decimal): VAT amount
  - `totalAmount` (Decimal): Total including VAT
- **Optional Fields**:
  - `dueDate` (DateTime): Payment due date
  - `notes` (String): Additional notes for invoice
  - `jir` (String): JIR fiscal code from CIS
  - `zki` (String): ZKI protection code
  - `bankAccount` (String): IBAN for payment
  - `includeBarcode` (Boolean): Whether to generate QR code
- **Relations**:
  - `buyer` (Contact): Invoice recipient details
  - `seller` (Contact): Issuer details (optional, falls back to company)
  - `lines` (InvoiceLine[]): Line items with quantities, prices, VAT
  - `company` (Company): Owner company (for IBAN, defaults)

## PDF Template Structure

The PDF template (`src/lib/pdf/invoice-template.tsx`) uses @react-pdf/renderer and includes:

### Layout Sections

1. **Header** (lines 268-281)
   - Company name and branding
   - Seller address and contact information
   - OIB (tax identification number)

2. **Invoice Title** (lines 283-285)
   - "RAČUN" heading
   - Invoice number display

3. **Invoice Dates** (lines 287-301)
   - Issue date (Datum izdavanja)
   - Due date if present (Rok plaćanja)

4. **Parties Section** (lines 303-342)
   - Seller information box (left column)
   - Buyer information box (right column)
   - Formatted addresses and OIB

5. **Line Items Table** (lines 344-377)
   - Table header: #, Opis, Kol., Jed., Cijena, PDV, Iznos
   - Alternating row colors for readability
   - Formatted currency amounts

6. **Totals Section** (lines 379-401)
   - Net amount (Osnovica)
   - VAT amount (PDV)
   - Total amount (UKUPNO) with emphasis

7. **Notes** (lines 403-409)
   - Optional notes section with yellow background
   - Displayed only if notes present

8. **Fiscal Information** (lines 411-427)
   - JIR and ZKI codes if fiscalized
   - Gray background with monospace font
   - Displayed only for fiscalized invoices

9. **Footer** (lines 429-458)
   - Payment instructions with IBAN
   - Payment reference model (HR01)
   - EPC QR code for payment if enabled

### Styling

The template uses StyleSheet from @react-pdf/renderer → `src/lib/pdf/invoice-template.tsx:63-245`

- **Typography**: Helvetica font family, sizes 8-24pt
- **Colors**: Professional grayscale with accent backgrounds
- **Layout**: Responsive widths using percentages
- **Spacing**: Consistent padding and margins

## PDF Generation Library

- **Library**: `@react-pdf/renderer` v4.3.1 → `package.json:42`
- **Rendering Method**: `renderToBuffer()` → `src/app/api/invoices/[id]/pdf/route.ts:6,145`
- **Output Format**: PDF buffer converted to Buffer for HTTP response
- **Template Engine**: React JSX components compiled to PDF primitives

## Barcode/QR Code Features

### EPC QR Code Generation

The system generates SEPA-compliant QR codes for bank payments:

- **Standard**: EPC QR (European Payments Council) → `src/lib/barcode.ts:81-113`
- **Library**: `qrcode` v1.5.4 → `package.json:66`
- **Format**: BCD version 001, UTF-8, SCT (SEPA Credit Transfer)
- **Data included**:
  - Creditor name (up to 70 chars)
  - Creditor IBAN (validated)
  - Amount with currency
  - Invoice number as reference
  - Due date in remittance info
- **Error correction**: Medium level ('M')
- **Output**: Data URL (base64 PNG) → `src/lib/barcode.ts:124`

### IBAN Validation

Before generating QR codes, IBANs are validated:

- **Algorithm**: ISO 13616 mod-97 → `src/lib/barcode.ts:4-62`
- **Format check**: 2 letters + 2 digits + up to 30 alphanumeric
- **Country-specific length**: Validates for HR (21), DE (22), etc.
- **Checksum validation**: Full mod-97 calculation on rearranged IBAN

### Barcode Positioning

- **Location**: Bottom right of footer → `src/lib/pdf/invoice-template.tsx:450-455`
- **Size**: 120x120pt box with 4pt padding
- **Display**: Only shown if `includeBarcode=true` and IBAN present

## Download vs Preview Behavior

### Download (Current Implementation)

- **Content-Disposition**: `attachment` → `src/app/api/invoices/[id]/pdf/route.ts:154`
- **Filename**: `racun-${invoiceNumber}.pdf` (sanitized, slashes replaced)
- **Behavior**: Browser triggers immediate download
- **Client handling**: Creates blob URL, triggers click, cleans up → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:67-77`

### Preview (Alternative Pattern)

Other endpoints in the codebase use `inline` disposition for browser preview:

- **Example**: Receipt viewer → `src/app/api/receipts/view/route.ts:55`
- **Pattern**: `Content-Disposition: inline; filename="..."`
- **Note**: Invoice PDF currently does not support preview mode

## Email Integration

PDFs can be attached to emails sent to invoice recipients:

### Email Flow

1. User clicks "Pošalji e-mailom" button → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:113-120`
2. Server action `sendInvoiceEmail()` called → `src/app/actions/e-invoice.ts:348-445`
3. System validates invoice status (must be FISCALIZED/SENT/DELIVERED) → `src/app/actions/e-invoice.ts:372-375`
4. PDF generated by fetching internal API endpoint → `src/app/actions/e-invoice.ts:378-393`
5. Email template rendered with invoice details → `src/app/actions/e-invoice.ts:396-423`
6. Email sent via Resend with PDF attachment → `src/lib/email.ts:37-43`
7. Tracking metadata stored (sentAt, emailMessageId) → `src/app/actions/e-invoice.ts:430-436`

### Email Template

The invoice email (`src/lib/email/templates/invoice-email.tsx`) includes:

- Invoice number and company name in subject
- Personalized greeting with buyer name
- Invoice details table (number, dates, amount, JIR)
- B2B notice for companies (if buyer has OIB)
- Payment instructions
- Professional footer with company name
- PDF attached with same filename pattern

## Security & Validation

### Authentication

- **User authentication**: Required via NextAuth session → `src/app/api/invoices/[id]/pdf/route.ts:26-30`
- **Company validation**: User must have associated company → `src/app/api/invoices/[id]/pdf/route.ts:34-37`
- **Tenant isolation**: Invoice must belong to user's company → `src/app/api/invoices/[id]/pdf/route.ts:48-52`

### Context Management

- **Request tracking**: Request ID and duration logged → `src/app/api/invoices/[id]/pdf/route.ts:15-16,147-148`
- **Tenant context**: Set for all database queries → `src/app/api/invoices/[id]/pdf/route.ts:40-43`
- **Structured logging**: Success/error events with metadata → `src/app/api/invoices/[id]/pdf/route.ts:148,162`

### Data Sanitization

- **Filename sanitization**: Forward slashes replaced with hyphens → `src/app/api/invoices/[id]/pdf/route.ts:154`
- **Decimal conversion**: All money amounts converted to Number → `src/app/api/invoices/[id]/pdf/route.ts:88-90`
- **Null safety**: Fallbacks for missing seller/buyer data → `src/app/api/invoices/[id]/pdf/route.ts:67-76`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication and authorization
  - [[tenant-isolation]] - Company-based data filtering
  - Barcode generation (QRCode library, IBAN validation)
  - Email service (Resend) for PDF delivery
- **Depended by**:
  - [[invoicing-email-delivery]] - Uses PDF generation for attachments
  - [[invoice-details-page]] - Provides download action

## Integrations

### @react-pdf/renderer

- **Package**: `@react-pdf/renderer@4.3.1` → `package.json:42`
- **Import**: `renderToBuffer` method → `src/app/api/invoices/[id]/pdf/route.ts:6`
- **Components**: Document, Page, View, Text, Image, StyleSheet
- **Output**: Buffer suitable for HTTP streaming

### QRCode Library

- **Package**: `qrcode@1.5.4` → `package.json:66`
- **Method**: `QRCode.toDataURL()` → `src/lib/barcode.ts:124`
- **Format**: Data URL (base64-encoded PNG)
- **Configuration**: Error correction M, margin 1, scale 6

### Resend Email Service

- **Package**: `resend@6.6.0` → `package.json:72`
- **Email sending**: `src/lib/email.ts:25-64`
- **Attachment support**: PDF buffer passed as attachment
- **Configuration**: RESEND_API_KEY, RESEND_FROM_EMAIL env vars

### Database (Prisma)

- **Tables**: eInvoice, Contact, Company, InvoiceLine
- **Query**: Includes buyer, seller, lines relations
- **Extensions**: Tenant context middleware applied

## Error Handling

| Scenario                   | Behavior                                           | Evidence                                                   |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| User not authenticated     | Returns 401 Unauthorized                           | `src/app/api/invoices/[id]/pdf/route.ts:28-30`             |
| Company not found          | Returns 404 Company not found                      | `src/app/api/invoices/[id]/pdf/route.ts:35-37`             |
| Invoice not found          | Returns 404 Invoice not found                      | `src/app/api/invoices/[id]/pdf/route.ts:62-64`             |
| Invoice from wrong company | Returns 404 (filtered by tenant context)           | `src/app/api/invoices/[id]/pdf/route.ts:50-52`             |
| Invalid IBAN               | Throws error, prevents QR generation               | `src/lib/barcode.ts:117-120`                               |
| PDF generation failure     | Logged and error thrown with details               | `src/app/api/invoices/[id]/pdf/route.ts:160-164`           |
| Download failure (client)  | Toast error message "Greška pri preuzimanju PDF-a" | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:82` |
| Email sending failure      | Returns error, no invoice metadata updated         | `src/app/actions/e-invoice.ts:425-443`                     |

## Performance Considerations

### PDF Rendering

- **Buffer size**: Typical invoice PDFs are 20-100KB
- **Rendering time**: ~100-300ms for simple invoices
- **Logging**: Duration tracked for monitoring → `src/app/api/invoices/[id]/pdf/route.ts:16,147-148`

### QR Code Generation

- **Generation time**: ~10-50ms per QR code
- **Caching**: Not implemented, generated fresh each time
- **Size**: 110x110px PNG, ~2-5KB when base64 encoded

### Database Query

- **Relations loaded**: buyer, seller, lines (all in one query)
- **Index usage**: Primary key lookup on eInvoice.id
- **Tenant filtering**: Applied automatically via middleware

## Currency & Localization

### Formatting

- **Currency format**: Uses `Intl.NumberFormat` with 'hr-HR' locale → `src/lib/pdf/invoice-template.tsx:248-254`
- **Date format**: Croatian locale 'hr-HR' → `src/lib/pdf/invoice-template.tsx:257-259`
- **Decimal places**: Always 2 decimal places for currency

### Supported Currencies

- **Default**: EUR (Euro)
- **Legacy**: HRK (Croatian Kuna, pre-2023)
- **Other**: Any ISO 4217 currency code supported by Intl API

### Labels

- **Language**: Croatian (all labels in Croatian)
- **Examples**: "RAČUN", "Izdavatelj", "Kupac", "Ukupno", etc.

## UI/UX Details

### Download Button

- **Label**: "Preuzmi PDF" (Download PDF)
- **Loading state**: "Preuzimanje..." (Downloading...)
- **Variant**: Outline button style
- **Position**: Invoice detail page action bar

### Success Feedback

- **Download success**: Toast message "PDF preuzet"
- **Email success**: Toast message "E-mail uspješno poslan"
- **Automatic file naming**: Browser uses suggested filename

### Loading States

- **Button disabled**: During PDF generation/download
- **Visual feedback**: Button text changes to loading state
- **Error recovery**: Toast error allows retry

## Verification Checklist

- [x] Authenticated users can download invoice PDFs
- [x] PDF contains all invoice data (header, items, totals)
- [x] Seller information displays correctly (company or custom seller)
- [x] Buyer information displays correctly (or placeholder if null)
- [x] Line items display with correct calculations
- [x] Currency formatting uses Croatian locale
- [x] Date formatting uses Croatian locale (DD.MM.YYYY)
- [x] Fiscal codes (JIR/ZKI) display when present
- [x] EPC QR code generates for valid IBAN
- [x] IBAN validation prevents invalid QR codes
- [x] Barcode includes correct payment data
- [x] PDF filename sanitized and descriptive
- [x] Content-Disposition triggers download
- [x] PDFs can be attached to emails
- [x] Tenant isolation prevents cross-company access

## Evidence Links

1. `src/app/api/invoices/[id]/pdf/route.ts:11-167` - Main PDF generation API route
2. `src/lib/pdf/invoice-template.tsx:1-456` - PDF template with React components
3. `src/lib/barcode.ts:4-125` - IBAN validation and EPC QR code generation
4. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:57-86` - Download button handler
5. `src/app/actions/e-invoice.ts:348-445` - Email sending with PDF attachment
6. `src/lib/email/templates/invoice-email.tsx:1-226` - Email template for invoice delivery
7. `src/lib/email.ts:25-64` - Email service with attachment support
8. `package.json:42` - @react-pdf/renderer dependency
9. `package.json:66` - qrcode dependency
10. `package.json:72` - resend dependency
11. `src/app/api/invoices/[id]/pdf/route.ts:154` - Content-Disposition header for download
12. `src/lib/barcode.ts:81-113` - EPC QR payload builder
13. `src/lib/pdf/invoice-template.tsx:248-259` - Currency and date formatters
14. `src/app/api/invoices/[id]/pdf/route.ts:131-141` - Barcode generation conditional logic
15. `src/app/(dashboard)/invoices/[id]/page.tsx:101` - Invoice actions integration
