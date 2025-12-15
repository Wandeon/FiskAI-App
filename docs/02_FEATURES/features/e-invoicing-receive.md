# Feature: Receive E-Invoice (F027)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 18

## Purpose

The Receive E-Invoice feature enables FiskAI to accept incoming electronic invoices from external systems and e-invoice providers via a REST API endpoint. The feature handles JSON-formatted invoice data, validates incoming invoices, prevents duplicates through provider reference tracking, automatically creates supplier contacts if needed, stores invoices with INBOUND direction and DELIVERED status, and provides filtering and querying capabilities for received invoices. This forms the core inbound invoice processing workflow in FiskAI's e-invoicing system.

## User Entry Points

| Type     | Path                    | Evidence                                      |
| -------- | ----------------------- | --------------------------------------------- |
| API POST | /api/e-invoices/receive | `src/app/api/e-invoices/receive/route.ts:51`  |
| API GET  | /api/e-invoices/receive | `src/app/api/e-invoices/receive/route.ts:226` |
| API GET  | /api/e-invoices/inbox   | `src/app/api/e-invoices/inbox/route.ts:16`    |
| API POST | /api/e-invoices/inbox   | `src/app/api/e-invoices/inbox/route.ts:57`    |

## Core Flow

1. External system POSTs invoice JSON to /api/e-invoices/receive → `src/app/api/e-invoices/receive/route.ts:51`
2. System validates user authentication with requireAuth() → `src/app/api/e-invoices/receive/route.ts:53`
3. System retrieves company context with requireCompany() → `src/app/api/e-invoices/receive/route.ts:54`
4. System parses and validates incoming JSON with Zod schema → `src/app/api/e-invoices/receive/route.ts:56-57`
5. System checks for duplicate invoice using providerRef → `src/app/api/e-invoices/receive/route.ts:79-103`
6. If duplicate found, return 409 Conflict with existing invoice ID → `src/app/api/e-invoices/receive/route.ts:95-101`
7. System searches for existing buyer contact by OIB → `src/app/api/e-invoices/receive/route.ts:107-113`
8. If buyer not found, create new contact with type SUPPLIER → `src/app/api/e-invoices/receive/route.ts:117-129`
9. System generates internal reference from invoice number and year → `src/app/api/e-invoices/receive/route.ts:138,218-223`
10. System creates EInvoice with direction=INBOUND and status=DELIVERED → `src/app/api/e-invoices/receive/route.ts:133-184`
11. System creates nested EInvoiceLines in single transaction → `src/app/api/e-invoices/receive/route.ts:166-178`
12. System stores optional XML data in ublXml field → `src/app/api/e-invoices/receive/route.ts:163`
13. System logs successful creation with structured logging → `src/app/api/e-invoices/receive/route.ts:186-193`
14. System returns created invoice with lines and buyer relations → `src/app/api/e-invoices/receive/route.ts:195-199`

## Key Modules

| Module                       | Purpose                                       | Location                                        |
| ---------------------------- | --------------------------------------------- | ----------------------------------------------- |
| POST /api/e-invoices/receive | Main endpoint for receiving external invoices | `src/app/api/e-invoices/receive/route.ts:51`    |
| GET /api/e-invoices/receive  | Query received invoices with filters          | `src/app/api/e-invoices/receive/route.ts:226`   |
| GET /api/e-invoices/inbox    | Fetch inbox invoices (DELIVERED status)       | `src/app/api/e-invoices/inbox/route.ts:16`      |
| POST /api/e-invoices/inbox   | Accept or reject inbox invoice                | `src/app/api/e-invoices/inbox/route.ts:57`      |
| incomingInvoiceSchema        | Zod validation schema for incoming invoices   | `src/app/api/e-invoices/receive/route.ts:11-49` |
| generateInternalReference    | Creates year-prefixed internal reference      | `src/app/api/e-invoices/receive/route.ts:218`   |
| logger                       | Structured logging for invoice operations     | `src/lib/logger.ts:9-36`                        |

## Request Validation

### Incoming Invoice Schema

The API validates incoming invoice data with a comprehensive Zod schema → `src/app/api/e-invoices/receive/route.ts:11-49`

**Required Fields:**

- invoiceNumber: string → `src/app/api/e-invoices/receive/route.ts:12`
- issueDate: ISO date string → `src/app/api/e-invoices/receive/route.ts:13`
- buyer: object with name (required), optional OIB/address → `src/app/api/e-invoices/receive/route.ts:16-23`
- seller: object with name (required), optional OIB/address → `src/app/api/e-invoices/receive/route.ts:24-31`
- lines: array of line items (min 1) → `src/app/api/e-invoices/receive/route.ts:32-41`
- netAmount: number → `src/app/api/e-invoices/receive/route.ts:42`
- vatAmount: number → `src/app/api/e-invoices/receive/route.ts:43`
- totalAmount: number → `src/app/api/e-invoices/receive/route.ts:44`

**Optional Fields:**

- dueDate: ISO date string → `src/app/api/e-invoices/receive/route.ts:14`
- currency: defaults to "EUR" → `src/app/api/e-invoices/receive/route.ts:15`
- providerRef: external provider reference → `src/app/api/e-invoices/receive/route.ts:45`
- xmlData: original UBL/XML data → `src/app/api/e-invoices/receive/route.ts:46`
- direction: defaults to "INBOUND" → `src/app/api/e-invoices/receive/route.ts:47`
- type: defaults to "INVOICE" → `src/app/api/e-invoices/receive/route.ts:48`

**Line Item Fields:**

- description: string (required) → `src/app/api/e-invoices/receive/route.ts:33`
- quantity: number (required) → `src/app/api/e-invoices/receive/route.ts:34`
- unit: string, defaults to "C62" → `src/app/api/e-invoices/receive/route.ts:35`
- unitPrice: number (required) → `src/app/api/e-invoices/receive/route.ts:36`
- netAmount: number (required) → `src/app/api/e-invoices/receive/route.ts:37`
- vatRate: 0-100, defaults to 25 → `src/app/api/e-invoices/receive/route.ts:38`
- vatCategory: defaults to "S" (Standard) → `src/app/api/e-invoices/receive/route.ts:39`
- vatAmount: number (required) → `src/app/api/e-invoices/receive/route.ts:40`

## Duplicate Prevention

The system prevents duplicate invoice imports using provider reference tracking:

1. **Provider Reference Check** → `src/app/api/e-invoices/receive/route.ts:79-103`
   - Searches for existing invoice by providerRef + companyId
   - Only checks if providerRef is provided in request
   - Returns 409 Conflict if duplicate found

2. **Duplicate Response** → `src/app/api/e-invoices/receive/route.ts:95-101`
   - Error message: "Invoice already exists"
   - Includes existing invoiceId for reference
   - Logs warning with providerRef and operation details

3. **Logging** → `src/app/api/e-invoices/receive/route.ts:88-93`
   - Structured log with userId, companyId, providerRef
   - Operation tag: "duplicate_invoice_received"
   - Warning level for monitoring

## Contact Auto-Creation

The system automatically creates supplier contacts for new invoice senders:

1. **Contact Lookup by OIB** → `src/app/api/e-invoices/receive/route.ts:107-113`
   - Searches by buyer.oib + companyId (tenant-filtered)
   - Only if OIB provided in incoming data
   - Prevents duplicate contacts

2. **Auto-Create Contact** → `src/app/api/e-invoices/receive/route.ts:117-129`
   - Creates Contact with type="SUPPLIER"
   - Maps all address fields (name, OIB, address, city, postal, country)
   - Links to current company for tenant isolation

3. **Contact Linking** → `src/app/api/e-invoices/receive/route.ts:140`
   - Sets buyerId to created or found contact
   - Nullable field - invoice can exist without contact link
   - Enables buyer name display and filtering

## Storage and Status

### Invoice Creation

The system stores received invoices with specific direction and status values:

1. **Direction: INBOUND** → `src/app/api/e-invoices/receive/route.ts:136`
   - Marks invoice as received (vs OUTBOUND for sent)
   - Enables filtering of received invoices
   - Schema enum: EInvoiceDirection → `prisma/schema.prisma:798-801`

2. **Status: DELIVERED** → `src/app/api/e-invoices/receive/route.ts:155`
   - Indicates invoice received but not yet accepted/rejected
   - Appears in inbox for user action
   - Schema enum: EInvoiceStatus → `prisma/schema.prisma:803-813`

3. **Provider Tracking** → `src/app/api/e-invoices/receive/route.ts:158-160`
   - providerRef: External system reference
   - providerStatus: Set to "RECEIVED"
   - providerError: null on success

4. **Internal Reference** → `src/app/api/e-invoices/receive/route.ts:138,218-223`
   - Format: "{year}/{invoiceNumber}"
   - Example: "2025/INV-001"
   - Used for internal tracking

5. **XML Preservation** → `src/app/api/e-invoices/receive/route.ts:163`
   - Stores original XML in ublXml field if provided
   - Enables re-processing or validation
   - Optional field

### Database Transaction

The system creates invoice and lines in a single atomic transaction:

1. **Nested Create** → `src/app/api/e-invoices/receive/route.ts:133-184`
   - Creates EInvoice with embedded lines
   - Single database roundtrip
   - Automatic rollback on failure

2. **Line Item Mapping** → `src/app/api/e-invoices/receive/route.ts:166-178`
   - Maps array index to lineNumber (1-indexed)
   - Preserves all financial fields
   - Ordered by lineNumber on return

3. **Include Relations** → `src/app/api/e-invoices/receive/route.ts:180-183`
   - Returns invoice with lines (ordered)
   - Includes buyer contact details
   - Ready for display or processing

## Query and Filtering

### GET /api/e-invoices/receive

The GET endpoint provides filtering for received invoices → `src/app/api/e-invoices/receive/route.ts:226-286`

**Query Parameters:**

- status: Filter by invoice status → `src/app/api/e-invoices/receive/route.ts:232,242-244`
- fromDate: Issue date >= filter → `src/app/api/e-invoices/receive/route.ts:233,246-248`
- toDate: Issue date <= filter → `src/app/api/e-invoices/receive/route.ts:234,250-252`
- provider: Search providerRef (contains) → `src/app/api/e-invoices/receive/route.ts:235,254-256`

**Default Filters:**

- direction: INBOUND (hardcoded) → `src/app/api/e-invoices/receive/route.ts:239`
- companyId: Current company (tenant isolation) → `src/app/api/e-invoices/receive/route.ts:238`

**Response:**

- invoices: Array of EInvoice with lines and buyer → `src/app/api/e-invoices/receive/route.ts:258-265`
- count: Total matching invoices → `src/app/api/e-invoices/receive/route.ts:276`
- Ordered by createdAt DESC → `src/app/api/e-invoices/receive/route.ts:264`

### GET /api/e-invoices/inbox

The inbox endpoint returns invoices awaiting action → `src/app/api/e-invoices/inbox/route.ts:16-55`

**Filters:**

- direction: INBOUND only → `src/app/api/e-invoices/inbox/route.ts:25`
- status: DELIVERED only (not accepted/rejected) → `src/app/api/e-invoices/inbox/route.ts:26`
- companyId: Current company → `src/app/api/e-invoices/inbox/route.ts:24`

**Purpose:** Shows invoices requiring user decision (accept/reject)

## Invoice Acceptance/Rejection

### POST /api/e-invoices/inbox

The inbox POST endpoint processes user decisions on received invoices → `src/app/api/e-invoices/inbox/route.ts:57-152`

**Request:**

- Query param: invoiceId → `src/app/api/e-invoices/inbox/route.ts:63`
- Body: { accept: boolean, reason?: string } → `src/app/api/e-invoices/inbox/route.ts:11-14,99`

**Validation:**

- Invoice must exist and belong to company → `src/app/api/e-invoices/inbox/route.ts:73-80`
- Invoice must be INBOUND direction → `src/app/api/e-invoices/inbox/route.ts:77`
- Invoice must be DELIVERED status → `src/app/api/e-invoices/inbox/route.ts:78`
- Returns 404 if not found or already processed → `src/app/api/e-invoices/inbox/route.ts:82-86`

**Accept Action:**

- Sets status to ACCEPTED → `src/app/api/e-invoices/inbox/route.ts:106`
- Sets providerStatus to "ACCEPTED" → `src/app/api/e-invoices/inbox/route.ts:107`
- Appends acceptance note → `src/app/api/e-invoices/inbox/route.ts:118-120`

**Reject Action:**

- Sets status to REJECTED → `src/app/api/e-invoices/inbox/route.ts:109`
- Sets providerStatus to "REJECTED" → `src/app/api/e-invoices/inbox/route.ts:110`
- Stores rejection reason in providerError → `src/app/api/e-invoices/inbox/route.ts:121`
- Appends rejection note with reason → `src/app/api/e-invoices/inbox/route.ts:118-120`

## Logging and Monitoring

The feature uses structured logging for operational visibility:

1. **Validation Failures** → `src/app/api/e-invoices/receive/route.ts:60-65`
   - Warning level with full validation errors
   - Includes userId, companyId for debugging
   - Operation: "incoming_invoice_validation_failed"

2. **Duplicate Detection** → `src/app/api/e-invoices/receive/route.ts:88-93`
   - Warning level with providerRef
   - Operation: "duplicate_invoice_received"
   - Helps identify integration issues

3. **Successful Creation** → `src/app/api/e-invoices/receive/route.ts:186-193`
   - Info level with invoice details
   - Includes invoiceNumber and providerRef
   - Operation: "incoming_invoice_created"

4. **Query Operations** → `src/app/api/e-invoices/receive/route.ts:267-272`
   - Info level with result count
   - Operation: "received_invoices_fetched"
   - Performance monitoring

5. **Inbox Operations** → `src/app/api/e-invoices/inbox/route.ts:129-136`
   - Info level with accept/reject action
   - Includes reason if provided
   - Operation: "inbox_invoice_processed"

## Data

### Database Tables

- **EInvoice** → `prisma/schema.prisma:191-259`
  - Primary invoice record with direction and status
  - Key fields for receiving:
    - direction: EInvoiceDirection (INBOUND) → `prisma/schema.prisma:194`
    - status: EInvoiceStatus (DELIVERED) → `prisma/schema.prisma:205`
    - providerRef: External reference (unique check) → `prisma/schema.prisma:212`
    - providerStatus: Provider-specific status → `prisma/schema.prisma:213`
    - providerError: Rejection reason storage → `prisma/schema.prisma:214`
    - ublXml: Original XML data → `prisma/schema.prisma:211`
    - internalReference: Year/number format → `prisma/schema.prisma:229`
    - receivedAt: Timestamp (optional) → `prisma/schema.prisma:220`

- **EInvoiceLine** → `prisma/schema.prisma:261-276`
  - Line items for received invoices
  - All financial fields preserved from source
  - Cascade delete when invoice deleted

- **Contact** → `prisma/schema.prisma:148-171`
  - Auto-created for new suppliers
  - Type set to SUPPLIER for received invoices
  - Enables filtering and reporting by supplier

### Enums

- **EInvoiceDirection** → `prisma/schema.prisma:798-801`
  - OUTBOUND: Sent invoices
  - INBOUND: Received invoices

- **EInvoiceStatus** → `prisma/schema.prisma:803-813`
  - DELIVERED: Received, awaiting action
  - ACCEPTED: User approved invoice
  - REJECTED: User rejected invoice
  - Other statuses for outbound flow

- **InvoiceType** → `prisma/schema.prisma:815-822`
  - INVOICE, E_INVOICE, QUOTE, PROFORMA, CREDIT_NOTE, DEBIT_NOTE
  - Defaults to INVOICE for received invoices

## Authentication & Security

### Multi-Layer Security

1. **Authentication** → `src/app/api/e-invoices/receive/route.ts:53`
   - requireAuth() validates user session
   - Implementation: `src/lib/auth-utils.ts:12-18`

2. **Company Context** → `src/app/api/e-invoices/receive/route.ts:54`
   - requireCompany() ensures user has company
   - Provides company for tenant isolation

3. **Tenant Isolation** → `src/app/api/e-invoices/receive/route.ts:82-84,110-112`
   - All queries include companyId filter
   - Prevents cross-company data access
   - Contact and invoice lookups scoped to company

4. **Input Validation** → `src/app/api/e-invoices/receive/route.ts:57-74`
   - Zod schema validates all incoming data
   - Returns 400 with validation details on failure
   - Type-safe after validation

## Error Handling

The API provides detailed error responses:

1. **Validation Error (400)** → `src/app/api/e-invoices/receive/route.ts:67-73`
   - Error: "Invalid invoice data"
   - Details: Zod validation issues array
   - Helps API consumers fix requests

2. **Duplicate Invoice (409)** → `src/app/api/e-invoices/receive/route.ts:95-101`
   - Error: "Invoice already exists"
   - Includes: existing invoiceId
   - Prevents duplicate processing

3. **Server Error (500)** → `src/app/api/e-invoices/receive/route.ts:201-214`
   - Error: "Failed to process incoming e-invoice"
   - Details: Error message if available
   - Logged for debugging

4. **Not Found (404)** → `src/app/api/e-invoices/inbox/route.ts:82-86`
   - Error: "Invoice not found or already processed"
   - For inbox processing only
   - Prevents duplicate accept/reject

## Verification Checklist

- [ ] API endpoint /api/e-invoices/receive accepts POST requests
- [ ] User authentication required for all requests
- [ ] Company context validated before processing
- [ ] Incoming JSON validated against Zod schema
- [ ] Required fields enforced (invoiceNumber, dates, amounts, lines)
- [ ] Duplicate invoices rejected via providerRef check
- [ ] Supplier contacts auto-created when OIB provided
- [ ] Invoices stored with direction=INBOUND
- [ ] Invoices stored with status=DELIVERED
- [ ] Internal reference generated in {year}/{number} format
- [ ] Original XML data preserved in ublXml field
- [ ] Invoice lines created in single transaction
- [ ] GET endpoint filters by status, date range, provider
- [ ] Inbox endpoint shows only DELIVERED invoices
- [ ] Accept/reject updates status and providerStatus
- [ ] Rejection reason stored in providerError
- [ ] All operations logged with structured logging
- [ ] Tenant isolation prevents cross-company access
- [ ] Error responses include actionable details

## Evidence Links

1. POST receive endpoint → `src/app/api/e-invoices/receive/route.ts:51`
2. GET receive endpoint with filters → `src/app/api/e-invoices/receive/route.ts:226`
3. Incoming invoice Zod schema → `src/app/api/e-invoices/receive/route.ts:11`
4. Authentication requirement → `src/app/api/e-invoices/receive/route.ts:53`
5. Company context retrieval → `src/app/api/e-invoices/receive/route.ts:54`
6. Duplicate check by providerRef → `src/app/api/e-invoices/receive/route.ts:79`
7. Contact auto-creation logic → `src/app/api/e-invoices/receive/route.ts:117`
8. Invoice creation with INBOUND/DELIVERED → `src/app/api/e-invoices/receive/route.ts:133`
9. Internal reference generation → `src/app/api/e-invoices/receive/route.ts:218`
10. Structured logging → `src/app/api/e-invoices/receive/route.ts:186`
11. GET inbox endpoint → `src/app/api/e-invoices/inbox/route.ts:16`
12. POST inbox accept/reject → `src/app/api/e-invoices/inbox/route.ts:57`
13. EInvoice schema definition → `prisma/schema.prisma:191`
14. EInvoiceDirection enum → `prisma/schema.prisma:798`
15. EInvoiceStatus enum → `prisma/schema.prisma:803`
16. Logger implementation → `src/lib/logger.ts:9`
17. Query filters implementation → `src/app/api/e-invoices/receive/route.ts:237`
18. Error handling → `src/app/api/e-invoices/receive/route.ts:201`
