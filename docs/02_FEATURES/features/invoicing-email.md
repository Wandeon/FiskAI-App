# Feature: Invoice Email Delivery

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Enables automated delivery of invoices to customers via email with PDF attachments. The feature includes professional email templates in Croatian, delivery tracking via webhooks, and comprehensive engagement analytics (delivered, opened, clicked, bounced). Supports both B2C and B2B scenarios with special handling for e-invoices sent via FINA system.

## User Entry Points

| Type   | Path               | Evidence                                                    |
| ------ | ------------------ | ----------------------------------------------------------- |
| Page   | /invoices/:id      | `src/app/(dashboard)/invoices/[id]/page.tsx:1`              |
| Button | "Pošalji e-mailom" | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:119` |
| Action | sendInvoiceEmail   | `src/app/actions/e-invoice.ts:348`                          |

## Core Flow

1. User views invoice detail page → `src/app/(dashboard)/invoices/[id]/page.tsx:32-257`
2. System validates invoice status and buyer email presence → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:23-25`
3. User clicks "Pošalji e-mailom" button → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:113-121`
4. Confirmation dialog shown with recipient email → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:89`
5. Server action validates invoice ownership and status → `src/app/actions/e-invoice.ts:351-375`
6. PDF generated from invoice data via API endpoint → `src/app/actions/e-invoice.ts:379-393`
7. Email template rendered with invoice details → `src/app/actions/e-invoice.ts:397-416`
8. Email sent via Resend with PDF attachment → `src/app/actions/e-invoice.ts:403-423`
9. Invoice record updated with email message ID and timestamp → `src/app/actions/e-invoice.ts:430-436`
10. Resend webhooks track delivery, opens, clicks, bounces → `src/app/api/webhooks/resend/route.ts:80-195`
11. Invoice record updated with engagement timestamps → `src/app/api/webhooks/resend/route.ts:126-185`

## Key Modules

| Module             | Purpose                                 | Location                                                 |
| ------------------ | --------------------------------------- | -------------------------------------------------------- |
| InvoiceActions     | UI button component for email sending   | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx`  |
| sendInvoiceEmail   | Server action to send invoice via email | `src/app/actions/e-invoice.ts:348-445`                   |
| InvoiceEmail       | React Email template for invoice emails | `src/lib/email/templates/invoice-email.tsx`              |
| sendEmail          | Resend integration wrapper              | `src/lib/email.ts:25-64`                                 |
| PDF Generation API | Generates invoice PDF for attachment    | `src/app/api/invoices/[id]/pdf/route.ts:11-167`          |
| Resend Webhook     | Tracks email delivery and engagement    | `src/app/api/webhooks/resend/route.ts:80-195`            |
| InvoicePDFDocument | PDF template for invoice rendering      | Referenced in `src/app/api/invoices/[id]/pdf/route.ts:7` |

## Data

- **Tables**: `EInvoice` → `prisma/schema.prisma:190-258`
- **Key email tracking fields**:
  - `emailMessageId` (String, nullable): Resend message ID for webhook correlation → `prisma/schema.prisma:221`
  - `emailDeliveredAt` (DateTime, nullable): Timestamp when email was delivered → `prisma/schema.prisma:222`
  - `emailOpenedAt` (DateTime, nullable): First time email was opened → `prisma/schema.prisma:223`
  - `emailClickedAt` (DateTime, nullable): First time link was clicked → `prisma/schema.prisma:224`
  - `emailBouncedAt` (DateTime, nullable): Timestamp of bounce event → `prisma/schema.prisma:225`
  - `emailBounceReason` (String, nullable): Reason for bounce or spam complaint → `prisma/schema.prisma:226`
  - `sentAt` (DateTime, nullable): Timestamp when email was sent → `prisma/schema.prisma:218`
- **Relations**: Belongs to `Contact` (buyer) with email field
- **Migration**: `prisma/migrations/20251215130000_add_email_tracking_fields/migration.sql:1-18`

## Email Template Features

The invoice email template (`src/lib/email/templates/invoice-email.tsx`) provides:

### Visual Design

- Clean, professional layout with company branding
- Gray background with white content container
- Responsive design for all email clients
- Professional typography using system fonts

### Content Sections

- **Header**: Invoice number and company name → `src/lib/email/templates/invoice-email.tsx:42`
- **Greeting**: Personalized with buyer name → `src/lib/email/templates/invoice-email.tsx:44`
- **Invoice Details Box**: Highlighted information including:
  - Invoice number → `src/lib/email/templates/invoice-email.tsx:55-56`
  - Issue date (Croatian format) → `src/lib/email/templates/invoice-email.tsx:59-60`
  - Due date (if applicable) → `src/lib/email/templates/invoice-email.tsx:62-67`
  - Total amount with currency → `src/lib/email/templates/invoice-email.tsx:69-73`
  - JIR code for fiscalized invoices → `src/lib/email/templates/invoice-email.tsx:74-79`
- **B2B Warning Box**: Yellow notice for business clients → `src/lib/email/templates/invoice-email.tsx:84-92`
  - Informs that original e-invoice sent via FINA system
  - This is a copy for their records
- **Instructions**: Payment guidance → `src/lib/email/templates/invoice-email.tsx:97-102`
- **Footer**: Professional closing with company name → `src/lib/email/templates/invoice-email.tsx:106-110`
- **Disclaimer**: Automated notification notice → `src/lib/email/templates/invoice-email.tsx:112-114`

### Styling

- Consistent color scheme matching brand
- Monospace font for JIR code readability → `src/lib/email/templates/invoice-email.tsx:184-190`
- Responsive spacing and padding
- Clear visual hierarchy

## PDF Attachment

### Generation Process

- PDF generated on-the-fly via API endpoint → `src/app/api/invoices/[id]/pdf/route.ts:11-167`
- Uses React-PDF renderer → `src/app/api/invoices/[id]/pdf/route.ts:6`
- Includes complete invoice data with line items
- Contains fiscal codes (JIR, ZKI) if fiscalized
- Optional barcode for Croatian banking standard → `src/app/api/invoices/[id]/pdf/route.ts:131-141`

### Attachment Details

- Filename format: `racun-{invoiceNumber}.pdf` → `src/app/actions/e-invoice.ts:419`
- Forward slashes in invoice numbers replaced with hyphens
- Attached as Buffer content → `src/app/actions/e-invoice.ts:417-422`

## Email Delivery Tracking

### Resend Webhook Integration

The system tracks email engagement through Resend webhooks → `src/app/api/webhooks/resend/route.ts:80-195`

#### Security Features

- **Signature Verification**: Svix-format HMAC validation → `src/app/api/webhooks/resend/route.ts:44-78`
- **Replay Protection**: 5-minute timestamp tolerance → `src/app/api/webhooks/resend/route.ts:95-101`
- **Secret Key**: `RESEND_WEBHOOK_SECRET` environment variable → `src/app/api/webhooks/resend/route.ts:10`

#### Tracked Events

1. **email.delivered**: Email successfully delivered to recipient → `src/app/api/webhooks/resend/route.ts:131-134`
2. **email.opened**: First time recipient opened email → `src/app/api/webhooks/resend/route.ts:136-142`
3. **email.clicked**: First time recipient clicked a link → `src/app/api/webhooks/resend/route.ts:144-153`
4. **email.bounced**: Email bounced (hard or soft) → `src/app/api/webhooks/resend/route.ts:155-162`
5. **email.complained**: Recipient marked as spam → `src/app/api/webhooks/resend/route.ts:164-169`
6. **email.delivery_delayed**: Temporary delivery delay → `src/app/api/webhooks/resend/route.ts:171-173`

#### Event Processing

- Finds invoice by email message ID → `src/app/api/webhooks/resend/route.ts:115-124`
- Updates invoice with engagement timestamps → `src/app/api/webhooks/resend/route.ts:179-185`
- Records first open/click only (prevents duplicate tracking) → `src/app/api/webhooks/resend/route.ts:138-140, 146-147`
- Logs all events for debugging → `src/app/api/webhooks/resend/route.ts:113, 133, 140, 150, 160, 168, 172`

## Validation Rules

### Pre-Send Validation

The system validates several conditions before allowing email send:

1. **Invoice Status**: Must be FISCALIZED, SENT, or DELIVERED → `src/app/actions/e-invoice.ts:372-375`
2. **Buyer Email**: Contact must have valid email address → `src/app/actions/e-invoice.ts:366-369`
3. **Invoice Ownership**: Tenant isolation ensures user owns invoice → `src/app/actions/e-invoice.ts:353-360`
4. **PDF Generation**: Must successfully generate PDF → `src/app/actions/e-invoice.ts:389-391`

### UI Validation

Button is only enabled when all conditions met → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:23-25`:

- Buyer has email address
- Invoice status is FISCALIZED, SENT, or DELIVERED

## B2B Special Handling

### Business Client Detection

- Checks if buyer has 11-digit OIB (business identifier) → `src/app/actions/e-invoice.ts:400`
- Business clients receive special notice in email → `src/lib/email/templates/invoice-email.tsx:84-92`

### E-Invoice Integration Notice

For B2B invoices, email includes yellow warning box explaining:

- Original e-invoice sent via FINA electronic system
- Email copy is for their records only
- Reduces confusion about duplicate invoices

## Dependencies

- **Depends on**:
  - [[invoicing-pdf-generation]] - PDF rendering for attachments
  - [[auth-session]] - User authentication and tenant context
  - Email service infrastructure (Resend)
  - Database for tracking and storage
- **Depended by**:
  - [[invoicing-view]] - Invoice detail page with send button

## Integrations

### Resend Email Service

- **API Client**: `src/lib/email.ts:1-65`
- **Configuration**:
  - `RESEND_API_KEY`: API authentication → `.env.example:23`
  - `RESEND_FROM_EMAIL`: Sender address (default: noreply@fiskai.app) → `.env.example:24`
  - `RESEND_WEBHOOK_SECRET`: Webhook signature verification → `.env.example:26`
- **Features Used**:
  - Email sending with React components
  - File attachments (PDF invoices)
  - Webhook event tracking
  - Delivery analytics

### React Email

- **Package**: `@react-email/components` → `package.json:39`
- **Render**: `@react-email/render` → `package.json:40`
- **Usage**: Server-side rendering of email templates
- **Benefits**: Type-safe, component-based email design

### Prisma Database

- **Model**: `EInvoice` with email tracking fields
- **Index**: `emailMessageId` for fast webhook lookups → `prisma/schema.prisma:257`
- **Cascade**: Email tracking data deleted with invoice

## Error Handling

| Scenario                  | Behavior                              | Evidence                                                      |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| No buyer email            | Button disabled, prevents send        | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:23-25` |
| Invalid invoice status    | Error message returned                | `src/app/actions/e-invoice.ts:372-375`                        |
| Invoice not found         | Error message returned                | `src/app/actions/e-invoice.ts:362-364`                        |
| PDF generation fails      | Error message returned                | `src/app/actions/e-invoice.ts:389-391`                        |
| Email service unavailable | Error message with details            | `src/app/actions/e-invoice.ts:425-427`                        |
| Resend API error          | Error logged and returned             | `src/lib/email.ts:45-50`                                      |
| Missing Resend API key    | Warning logged, email not sent        | `src/lib/email.ts:26-32`                                      |
| Invalid webhook signature | 401 Unauthorized response             | `src/app/api/webhooks/resend/route.ts:103-106`                |
| Expired webhook timestamp | 401 Unauthorized response             | `src/app/api/webhooks/resend/route.ts:98-101`                 |
| Unknown email message ID  | Webhook acknowledged, logged as debug | `src/app/api/webhooks/resend/route.ts:120-124`                |

## User Experience

### Loading States

- "Šaljem..." indicator during email send → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:119`
- Button disabled while sending → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:116`

### Success States

- Toast notification: "E-mail uspješno poslan" → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:96`
- Page refresh to show updated timestamp → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:97`

### Error States

- Toast notification with error message → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:99`
- Specific error messages for different failure scenarios

### Confirmation

- Confirmation dialog before sending → `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:89`
- Shows recipient email address for verification

## Environment Configuration

Required environment variables (`.env.example:22-26`):

```env
# Email sending (Resend)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
# Webhook secret for email tracking (get from Resend dashboard)
RESEND_WEBHOOK_SECRET=whsec_your_resend_webhook_secret
```

## Verification Checklist

- [x] User can send invoice email from detail page
- [x] Button only enabled for fiscalized/sent invoices with buyer email
- [x] Confirmation dialog shows recipient email
- [x] Email contains correct invoice details in Croatian
- [x] PDF attachment generated correctly
- [x] B2B clients receive special notice about FINA e-invoice
- [x] Email tracking records message ID in database
- [x] Webhooks update delivery status
- [x] Webhooks track email opens (first open only)
- [x] Webhooks track link clicks
- [x] Webhooks record bounce events and reasons
- [x] Webhook signature verification prevents spoofing
- [x] Invoice shows sent timestamp after email delivery
- [x] Error messages are user-friendly

## Evidence Links

1. `src/app/actions/e-invoice.ts:348-445` - Server action for sending invoice email
2. `src/lib/email/templates/invoice-email.tsx:1-226` - React Email template with styling
3. `src/lib/email.ts:1-65` - Resend email service integration
4. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:1-136` - UI component with send button
5. `src/app/api/webhooks/resend/route.ts:1-195` - Webhook handler for email tracking
6. `src/app/api/invoices/[id]/pdf/route.ts:1-165` - PDF generation API endpoint
7. `prisma/schema.prisma:190-258` - EInvoice model with email tracking fields
8. `prisma/migrations/20251215130000_add_email_tracking_fields/migration.sql:1-18` - Database migration for tracking
9. `.env.example:22-26` - Environment variable configuration
10. `package.json:39-40, 71` - Email package dependencies (React Email, Resend)
11. `src/app/(dashboard)/invoices/[id]/page.tsx:1-257` - Invoice detail page with actions
12. `docs/02_FEATURES/FEATURE_REGISTRY.md:34` - Feature registry entry
