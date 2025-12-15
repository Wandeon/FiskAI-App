# Feature: Send E-Invoice

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Enables transmission of e-invoices via PEPPOL/UBL 2.1 standard to business customers through configured access point providers. The feature generates EN16931-compliant UBL XML, transmits via selected provider (IE Računi, Fina, or PEPPOL access point), handles fiscalization integration for Croatian cash/card payments, and tracks delivery status with comprehensive error handling and automatic retry logic.

## User Entry Points

| Type   | Path            | Evidence                                                     |
| ------ | --------------- | ------------------------------------------------------------ |
| Page   | /e-invoices/:id | `src/app/(dashboard)/e-invoices/[id]/page.tsx:36`            |
| Button | "Pošalji račun" | `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:109` |
| Action | sendEInvoice    | `src/app/actions/e-invoice.ts:129`                           |

## Core Flow

1. User views draft e-invoice detail page → `src/app/(dashboard)/e-invoices/[id]/page.tsx:36-299`
2. System validates invoice status (DRAFT or ERROR only) → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:95`
3. System checks provider configuration exists → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:24-27`
4. User clicks "Pošalji račun" button → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:108-112`
5. Confirmation dialog shown → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:29-31`
6. Server action validates ownership and status → `src/app/actions/e-invoice.ts:133-149`
7. UBL 2.1 XML generated with EN16931 compliance → `src/app/actions/e-invoice.ts:152`
8. Provider API key decrypted from secure storage → `src/app/actions/e-invoice.ts:158-163`
9. Provider instance created and invoice transmitted → `src/app/actions/e-invoice.ts:165-168`
10. Invoice updated with transmission metadata (providerRef, JIR, ZKI) → `src/app/actions/e-invoice.ts:182-196`
11. Fiscalization decision evaluated for cash/card payments → `src/app/actions/e-invoice.ts:199-216`
12. Fiscal request queued if payment method requires it → `src/lib/fiscal/should-fiscalize.ts:94-131`
13. Background processor executes fiscal requests with retry → `src/app/api/cron/fiscal-processor/route.ts:28-65`
14. Invoice status updated to SENT, FISCALIZED, or ERROR → `src/app/actions/e-invoice.ts:191`

## Key Modules

| Module                 | Purpose                                   | Location                                                     |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| InvoiceDetailActions   | UI component with send button             | `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx`     |
| sendEInvoice           | Server action for e-invoice transmission  | `src/app/actions/e-invoice.ts:129-220`                       |
| generateUBLInvoice     | UBL 2.1 XML generator (EN16931 compliant) | `src/lib/e-invoice/ubl-generator.ts:97-190`                  |
| EInvoiceProvider       | Provider abstraction interface            | `src/lib/e-invoice/provider.ts:10-27`                        |
| MockProvider           | Development/testing provider              | `src/lib/e-invoice/providers/mock.ts:11-70`                  |
| shouldFiscalizeInvoice | Fiscal decision engine                    | `src/lib/fiscal/should-fiscalize.ts:15-92`                   |
| queueFiscalRequest     | Fiscal request queue manager              | `src/lib/fiscal/should-fiscalize.ts:94-131`                  |
| executeFiscalRequest   | Fiscal pipeline executor                  | `src/lib/fiscal/fiscal-pipeline.ts:19-128`                   |
| fiscal-processor       | Background cron job for fiscal processing | `src/app/api/cron/fiscal-processor/route.ts:10-227`          |
| EInvoiceSettingsForm   | Provider configuration UI                 | `src/app/(dashboard)/settings/einvoice-settings-form.tsx:48` |

## Data

- **Tables**: `EInvoice`, `FiscalRequest`, `FiscalCertificate` → `prisma/schema.prisma:191-259`
- **E-Invoice fields**:
  - `status` (EInvoiceStatus): Lifecycle state (DRAFT → SENT → DELIVERED → ACCEPTED) → `prisma/schema.prisma:205`
  - `ublXml` (String, nullable): Generated UBL 2.1 XML payload → `prisma/schema.prisma:211`
  - `providerRef` (String, nullable): Provider's transaction reference → `prisma/schema.prisma:212`
  - `providerStatus` (String, nullable): Provider-reported delivery status → `prisma/schema.prisma:213`
  - `providerError` (String, nullable): Provider error message if failed → `prisma/schema.prisma:214`
  - `jir` (String, nullable): Fiscal unique identifier from CIS system → `prisma/schema.prisma:206`
  - `zki` (String, nullable): Fiscal security code (HMAC signature) → `prisma/schema.prisma:207`
  - `fiscalizedAt` (DateTime, nullable): Fiscal receipt timestamp → `prisma/schema.prisma:208`
  - `fiscalStatus` (String, nullable): PENDING/COMPLETED/FAILED → `prisma/schema.prisma:209`
  - `sentAt` (DateTime, nullable): Transmission timestamp → `prisma/schema.prisma:219`
  - `paymentMethod` (PaymentMethod, nullable): CASH/CARD/TRANSACTION → `prisma/schema.prisma:235`
- **Relations**: Belongs to `Company` with provider configuration
- **Indexes**: `status`, `providerRef`, `fiscalStatus` → `prisma/schema.prisma:253-257`

## UBL 2.1 Generation

### EN16931 Compliance

The UBL generator (`src/lib/e-invoice/ubl-generator.ts`) produces EN16931-compliant invoices:

- **CustomizationID**: `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0` → `src/lib/e-invoice/ubl-generator.ts:10-11`
- **ProfileID**: `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` → `src/lib/e-invoice/ubl-generator.ts:12`
- **OASIS UBL 2.1 namespaces**: Invoice-2, CommonAggregateComponents-2, CommonBasicComponents-2 → `src/lib/e-invoice/ubl-generator.ts:4-8`

### XML Structure

Generated XML includes:

- **Invoice Header**: ID, IssueDate, DueDate, InvoiceTypeCode (380), DocumentCurrencyCode → `src/lib/e-invoice/ubl-generator.ts:137-141`
- **Party Information**:
  - AccountingSupplierParty with OIB endpoint → `src/lib/e-invoice/ubl-generator.ts:39-41`
  - AccountingCustomerParty with postal address → `src/lib/e-invoice/ubl-generator.ts:48-54`
  - PartyTaxScheme for VAT-registered entities → `src/lib/e-invoice/ubl-generator.ts:57-64`
- **Payment Means**: Code 30 (IBAN credit transfer) → `src/lib/e-invoice/ubl-generator.ts:150-155`
- **Tax Breakdown**: TaxTotal with subtotals per VAT rate → `src/lib/e-invoice/ubl-generator.ts:159-177`
- **Monetary Totals**: LineExtension, TaxExclusive, TaxInclusive, PayableAmount → `src/lib/e-invoice/ubl-generator.ts:179-184`
- **Invoice Lines**: Quantity, Price, Tax, Item classification → `src/lib/e-invoice/ubl-generator.ts:75-94`

### XML Safety

- **XML Escaping**: All user content escaped (&, <, >, ", ') → `src/lib/e-invoice/ubl-generator.ts:14-21`
- **Decimal Formatting**: Consistent 2-decimal precision for amounts → `src/lib/e-invoice/ubl-generator.ts:27-29`
- **Date Formatting**: ISO 8601 YYYY-MM-DD format → `src/lib/e-invoice/ubl-generator.ts:23-25`
- **VAT Grouping**: Lines grouped by rate for tax subtotals → `src/lib/e-invoice/ubl-generator.ts:104-129`

## Provider Integration

### Provider Interface

All providers implement standard interface → `src/lib/e-invoice/provider.ts:10-27`:

- `sendInvoice(invoice, ublXml)`: Transmit invoice, returns providerRef/JIR/ZKI
- `fetchIncomingInvoices()`: Poll for received invoices
- `getInvoiceStatus(providerRef)`: Check delivery status
- `archiveInvoice(invoice)`: Long-term archival
- `testConnection()`: Configuration validation

### Supported Providers

Configuration via settings page → `src/app/(dashboard)/settings/einvoice-settings-form.tsx:21-46`:

1. **IE Računi**: Croatian fiscal integration, Porezna Uprava connection
2. **Fina**: National clearing system, secure B2B transmission
3. **DDD Invoices**: International PEPPOL access point for EU
4. **Mock**: Development testing, simulates transmission → `src/lib/e-invoice/providers/mock.ts:11-70`

### Provider Configuration

- **API Key Storage**: Encrypted with envelope encryption → `src/app/actions/e-invoice.ts:158-163`
- **Decryption**: `decryptOptionalSecret()` with error handling → `src/app/actions/e-invoice.ts:160`
- **Test Connection**: Mock delays, real providers validate credentials → `src/app/(dashboard)/settings/einvoice-settings-form.tsx:90-107`
- **Provider Selection**: Stored in `company.eInvoiceProvider` → `src/app/actions/e-invoice.ts:155`

### Mock Provider Behavior

For development and testing → `src/lib/e-invoice/providers/mock.ts:16-36`:

- **Simulated Network Delay**: 500ms transmission latency
- **Mock Fiscal Codes**: Generates JIR/ZKI with timestamp and random suffix
- **Success Response**: Always succeeds with providerRef
- **Logging**: Console output for debugging XML transmission

## Fiscalization Integration

### Decision Logic

Croatian law requires fiscalization for cash/card payments → `src/lib/fiscal/should-fiscalize.ts:15-92`:

1. **Company Enabled**: Check `company.fiscalEnabled` flag → `src/lib/fiscal/should-fiscalize.ts:21-23`
2. **Payment Method**: CASH or CARD only (TRANSACTION exempt) → `src/lib/fiscal/should-fiscalize.ts:27-33`
3. **Not Already Fiscalized**: Skip if JIR exists → `src/lib/fiscal/should-fiscalize.ts:36-38`
4. **No Pending Request**: Idempotency check → `src/lib/fiscal/should-fiscalize.ts:41-51`
5. **Certificate Available**: PROD or TEST environment → `src/lib/fiscal/should-fiscalize.ts:56-77`
6. **Certificate Valid**: ACTIVE status, not expired → `src/lib/fiscal/should-fiscalize.ts:72-84`

### Fiscal Request Queue

Background processing with retry → `src/lib/fiscal/should-fiscalize.ts:94-131`:

- **Upsert Pattern**: Idempotent queue creation
- **Status**: QUEUED → PROCESSING → COMPLETED/FAILED/DEAD
- **Retry Config**: Max 5 attempts with exponential backoff
- **Immediate Scheduling**: `nextRetryAt` set to current time

### Fiscal Pipeline

Certificate-based signing and submission → `src/lib/fiscal/fiscal-pipeline.ts:19-128`:

1. **Certificate Loading**: Fetch active certificate from database → `src/lib/fiscal/fiscal-pipeline.ts:23-37`
2. **Decryption**: Envelope encryption with data key → `src/lib/fiscal/fiscal-pipeline.ts:40-43`
3. **P12 Parsing**: Extract private key and certificate → `src/lib/fiscal/fiscal-pipeline.ts:47-48`
4. **XML Building**: RACUN or STORNO message with ZKI calculation → `src/lib/fiscal/fiscal-pipeline.ts:67-82`
5. **XML Signing**: Digital signature with private key → `src/lib/fiscal/fiscal-pipeline.ts:92`
6. **CIS Submission**: HTTPS POST to Porezna Uprava → `src/lib/fiscal/fiscal-pipeline.ts:101`
7. **Response Parsing**: Extract JIR or error codes → `src/lib/fiscal/fiscal-pipeline.ts:115-127`

### Background Processor

Cron job for async processing → `src/app/api/cron/fiscal-processor/route.ts:10-227`:

- **Batch Size**: 10 concurrent requests
- **Row Locking**: `FOR UPDATE SKIP LOCKED` prevents conflicts → `src/app/api/cron/fiscal-processor/route.ts:41`
- **Stale Lock Recovery**: 5-minute timeout for crashed workers → `src/app/api/cron/fiscal-processor/route.ts:212-227`
- **Worker ID**: UUID-based identification for debugging → `src/app/api/cron/fiscal-processor/route.ts:19`
- **Status Updates**: Invoice.fiscalStatus synchronized → `src/app/api/cron/fiscal-processor/route.ts:88-97, 122-128`

## Error Handling

### Transmission Errors

| Scenario                    | Behavior                             | Evidence                                                       |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| No provider configured      | Button disabled, warning message     | `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:24-27` |
| Invoice not DRAFT/ERROR     | Send button hidden                   | `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:95`    |
| Invoice not found           | Error: "E-Invoice not found"         | `src/app/actions/e-invoice.ts:147-149`                         |
| API key decryption fails    | Error: "Failed to decrypt API key"   | `src/app/actions/e-invoice.ts:162`                             |
| Provider transmission fails | Status → ERROR, providerError stored | `src/app/actions/e-invoice.ts:171-178`                         |
| UBL generation error        | Exception thrown, invoice unchanged  | `src/lib/e-invoice/ubl-generator.ts:98-100`                    |
| Missing buyer               | Error: "Invoice must have a buyer"   | `src/lib/e-invoice/ubl-generator.ts:98-100`                    |

### Fiscal Errors

Error classification with retry logic → `src/app/api/cron/fiscal-processor/route.ts:135-198`:

1. **Network Errors**: ECONNREFUSED, ETIMEDOUT, ENOTFOUND → Retriable
2. **Server Errors**: HTTP 500-599 → Retriable with backoff
3. **Rate Limiting**: HTTP 429 → Retriable with exponential delay
4. **Validation Errors**: HTTP 400-499 → Non-retriable, marked DEAD
5. **Porezna Codes**: `t0XX` (temporary) → Retriable, others → DEAD

### Retry Strategy

Exponential backoff with jitter → `src/app/api/cron/fiscal-processor/route.ts:200-210`:

- **Base Delay**: 30 seconds
- **Backoff Factor**: 4x per attempt
- **Schedule**: 30s, 2m, 8m, 32m, 2h (max)
- **Jitter**: ±10% randomization to prevent thundering herd
- **Max Attempts**: 5 retries before DEAD status

### Error Display

User-facing error information → `src/app/(dashboard)/e-invoices/[id]/page.tsx:256-264`:

- **Error Card**: Red border, red text for visibility
- **Provider Error**: Shows `providerError` field content
- **Fiscal Status**: Separate badge shows PENDING/FAILED
- **Retry Available**: ERROR status allows re-send attempt

## Status Tracking

### Invoice Status Lifecycle

Status progression → `prisma/schema.prisma:205`:

1. **DRAFT**: Initial creation, editing allowed
2. **SENT**: Successfully transmitted, awaiting delivery confirmation
3. **DELIVERED**: Provider confirms receipt by buyer
4. **ACCEPTED**: Buyer accepts invoice (payment intent)
5. **REJECTED**: Buyer rejects invoice
6. **ERROR**: Transmission or fiscal failure
7. **FISCALIZED**: Croatian fiscal system processed (alternative to SENT for CASH/CARD)
8. **ARCHIVED**: Long-term storage

### Fiscal Status Tracking

Separate from delivery status → `prisma/schema.prisma:209`:

- **PENDING**: Fiscal request queued or processing
- **COMPLETED**: JIR received, invoice fiscalized
- **FAILED**: Retriable error, will retry
- **DEAD**: Non-retriable error, manual intervention required

### Status Display

Visual indicators → `src/app/(dashboard)/e-invoices/[id]/page.tsx:12-34`:

- **Croatian Labels**: Status translated to Croatian
- **Color Coding**: Gray (draft), blue (sent), green (delivered/accepted), red (error/rejected), yellow (pending)
- **Badge Style**: Rounded pill with appropriate background
- **Fiscal Badge**: Separate indicator for fiscal status

## Security

### API Key Protection

Multi-layer encryption → `src/app/actions/e-invoice.ts:158-163`:

- **Envelope Encryption**: Data encrypted with unique data key
- **Data Key Encryption**: Data key encrypted with environment secret
- **Storage**: Only encrypted values stored in database
- **Decryption**: Server-side only, never sent to client
- **Error Handling**: Generic error message, no key exposure

### Tenant Isolation

Provider configuration scoped to company:

- **Company-Level**: `company.eInvoiceProvider` and encrypted API key
- **Automatic Filtering**: `requireCompanyWithContext()` enforces isolation → `src/app/actions/e-invoice.ts:132`
- **Invoice Validation**: Ownership checked before send → `src/app/actions/e-invoice.ts:133-149`
- **Certificate Scoping**: Fiscal certificates belong to company → `src/lib/fiscal/should-fiscalize.ts:56-63`

### Fiscal Certificate Security

FIPS-level certificate protection:

- **Envelope Encryption**: P12 certificate and password encrypted
- **Certificate Validation**: Expiry and status checked before use → `src/lib/fiscal/fiscal-pipeline.ts:30-37`
- **Private Key**: Never exposed, only used for signing → `src/lib/fiscal/fiscal-pipeline.ts:47-48`
- **Audit Trail**: `lastUsedAt` tracked for compliance → `src/lib/fiscal/fiscal-pipeline.ts:110-113`

## Dependencies

- **Depends on**:
  - [[invoicing-create]] - E-invoice creation before sending
  - [[auth-session]] - User authentication and company context
  - [[fiscal-certificates]] - Certificate management for fiscalization
  - Provider infrastructure (IE Računi, Fina, PEPPOL)
  - CIS system (Croatian fiscal authority)
- **Depended by**:
  - [[e-invoice-receive]] - Incoming invoice handling
  - [[invoicing-view]] - Status display and actions
  - [[invoicing-email]] - Email notification after send

## Integrations

### Provider APIs

- **IE Računi**: Croatian provider with fiscal integration (not yet implemented) → `src/lib/e-invoice/provider.ts:38-39`
- **Fina**: National clearing system (not yet implemented) → `src/lib/e-invoice/provider.ts:40-41`
- **Mock Provider**: Development and testing → `src/lib/e-invoice/providers/mock.ts:11-70`
- **Configuration**: Environment variables for API keys → `.env.example:13`

### Croatian Fiscal System (CIS)

- **Pipeline**: Full certificate-based signing and submission → `src/lib/fiscal/fiscal-pipeline.ts:19-128`
- **Environments**: TEST and PROD with separate certificates
- **Message Types**: RACUN (invoice), STORNO (reversal)
- **Response Codes**: JIR (success) or error codes (tXXX, pXXX)

### Cron Infrastructure

- **Endpoint**: `/api/cron/fiscal-processor` → `src/app/api/cron/fiscal-processor/route.ts:10`
- **Authentication**: Bearer token with `CRON_SECRET` → `src/app/api/cron/fiscal-processor/route.ts:12-15`
- **Schedule**: External cron job (e.g., Vercel Cron, Cloudflare Workers)
- **Timeout**: 60 seconds max duration → `src/app/api/cron/fiscal-processor/route.ts:8`

## User Experience

### Loading States

- "Slanje..." indicator during transmission → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:110`
- Button disabled while processing → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:109`
- Action state tracked separately (send/markPaid/delete) → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:21`

### Success States

- Toast: "E-račun poslan" with fiscalization note → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:45`
- Page refresh to show updated status → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:46`
- Status badge updates to SENT or PENDING_FISCALIZATION
- Sent timestamp displayed → `src/app/(dashboard)/e-invoices/[id]/page.tsx:277-281`

### Error States

- Toast notification with specific error message → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:39`
- Error card on detail page with provider error → `src/app/(dashboard)/e-invoices/[id]/page.tsx:256-264`
- Status badge shows ERROR with red styling
- Send button remains enabled for retry

### Confirmation

- Confirmation dialog before send → `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:29-31`
- Clear action description: "Jeste li sigurni da želite poslati ovaj račun?"
- Cancel option prevents accidental sends

## Environment Configuration

Required environment variables:

```env
# E-Invoice Provider API Keys (encrypted in DB)
EINVOICE_KEY_SECRET=replace_with_long_random_string

# Fiscal Certificate Encryption
FISCAL_CERT_KEY=generate_with_openssl_rand_hex_32

# Cron Job Authentication
CRON_SECRET=generate_with_openssl_rand_hex_32
```

Configuration in `.env.example:13, 55-57, 39-40`

## Verification Checklist

- [x] User can send e-invoice from detail page
- [x] Send button only visible for DRAFT or ERROR status
- [x] Provider configuration required before sending
- [x] Confirmation dialog prevents accidental sends
- [x] UBL 2.1 XML generated with EN16931 compliance
- [x] XML includes all party information (OIB, address, VAT)
- [x] XML includes payment means (IBAN) if available
- [x] XML includes correct VAT breakdown and totals
- [x] Provider API key encrypted in database
- [x] API key decrypted only on server side
- [x] Provider transmission updates status to SENT
- [x] Provider reference stored for tracking
- [x] Mock provider generates JIR/ZKI for testing
- [x] Fiscalization decision evaluates payment method
- [x] CASH/CARD payments queue fiscal request
- [x] TRANSACTION payments skip fiscalization
- [x] Fiscal request includes certificate ID and environment
- [x] Background processor executes fiscal requests
- [x] Row locking prevents duplicate processing
- [x] Exponential backoff for retriable errors
- [x] Network errors trigger automatic retry
- [x] Server errors (500-599) are retriable
- [x] Validation errors (400-499) are non-retriable
- [x] Max 5 retry attempts before DEAD status
- [x] Invoice updated with JIR after fiscalization
- [x] Fiscal status synchronized with request status
- [x] Error card displays provider errors
- [x] Status badge shows fiscal status
- [x] Send button allows retry after ERROR
- [x] Tenant isolation enforced for all operations
- [x] Certificate validation before fiscal submission

## Evidence Links

1. `src/app/actions/e-invoice.ts:129-220` - Server action for e-invoice transmission with fiscalization
2. `src/lib/e-invoice/ubl-generator.ts:1-190` - UBL 2.1 XML generation with EN16931 compliance
3. `src/lib/e-invoice/provider.ts:1-43` - Provider abstraction and factory
4. `src/lib/e-invoice/providers/mock.ts:1-70` - Mock provider for testing
5. `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:1-136` - UI component with send button
6. `src/app/(dashboard)/e-invoices/[id]/page.tsx:1-299` - E-invoice detail page with status display
7. `src/lib/fiscal/should-fiscalize.ts:1-131` - Fiscal decision engine and queue management
8. `src/lib/fiscal/fiscal-pipeline.ts:1-165` - Certificate-based fiscal pipeline
9. `src/app/api/cron/fiscal-processor/route.ts:1-226` - Background fiscal processor with retry
10. `src/app/(dashboard)/settings/einvoice-settings-form.tsx:1-197` - Provider configuration UI
11. `prisma/schema.prisma:191-259` - EInvoice model with status tracking
12. `.env.example:13, 39-40, 55-57` - Environment variable configuration
13. `src/lib/e-invoice/index.ts:1-9` - E-invoice module exports
14. `src/lib/e-invoice/types.ts:1-45` - TypeScript interfaces for providers
