# Feature: Email Import Rules

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Provides configurable filter rules for automated email attachment import. Users create rules based on sender email, sender domain, subject line, or filename patterns to automatically import bank statements and invoices from connected email accounts. Rules use AND logic (all specified filters must match) to determine which attachments are downloaded, stored in R2, and queued for OCR processing. The feature enables hands-free document ingestion from recurring senders like banks and vendors.

## User Entry Points

| Type | Path                        | Evidence                                                            |
| ---- | --------------------------- | ------------------------------------------------------------------- |
| API  | GET /api/email/rules        | `src/app/api/email/rules/route.ts:8`                                |
| API  | POST /api/email/rules       | `src/app/api/email/rules/route.ts:34`                               |
| API  | PUT /api/email/rules/:id    | `src/app/api/email/rules/[id]/route.ts:8`                           |
| API  | DELETE /api/email/rules/:id | `src/app/api/email/rules/[id]/route.ts:48`                          |
| UI   | Import Rules Section        | `src/app/(dashboard)/settings/email/components/import-rules.tsx:19` |
| Sync | Rule Matching Engine        | `src/lib/email-sync/sync-service.ts:149`                            |

## Core Flow

### Rule Creation Flow

1. User navigates to connected email account -> `src/app/(dashboard)/settings/email/page.tsx:21-28`
2. ImportRulesSection renders for connection -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:108-111`
3. User clicks "+" icon to add new rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:99-101`
4. Rule form displays with four filter fields -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:105-147`
5. User enters filter criteria (sender email, domain, subject, filename) -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:106-142`
6. User submits form -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:32`
7. Client calls POST /api/email/rules with connectionId and filters -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:37-41`
8. Server validates connection belongs to company -> `src/app/api/email/rules/route.ts:51-60`
9. Server validates at least one filter provided -> `src/app/api/email/rules/route.ts:63-68`
10. EmailImportRule created with companyId and filters -> `src/app/api/email/rules/route.ts:70-79`
11. Rule appears in list with toggle and delete controls -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:156-183`
12. Page refreshes to show new rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:50`

### Rule Matching Flow (During Sync)

1. Email sync fetches messages with attachments -> `src/lib/email-sync/sync-service.ts:62-93`
2. For each attachment, check content hash deduplication -> `src/lib/email-sync/sync-service.ts:128-146`
3. Fetch all active import rules for connection -> `src/lib/email-sync/sync-service.ts:149`
4. Evaluate each rule against message metadata -> `src/lib/email-sync/sync-service.ts:149-170`
5. Check senderEmail exact match (case-insensitive) -> `src/lib/email-sync/sync-service.ts:152-154`
6. Check senderDomain match after @ symbol -> `src/lib/email-sync/sync-service.ts:156-159`
7. Check subjectContains substring match -> `src/lib/email-sync/sync-service.ts:161-163`
8. Check filenameContains substring match -> `src/lib/email-sync/sync-service.ts:165-167`
9. If all rule filters match, mark as matching -> `src/lib/email-sync/sync-service.ts:169`
10. Download attachment from email provider -> `src/lib/email-sync/sync-service.ts:173`
11. Upload attachment to R2 storage -> `src/lib/email-sync/sync-service.ts:176-177`
12. Create EmailAttachment record with status PENDING -> `src/lib/email-sync/sync-service.ts:182-198`
13. If PDF or image, create ImportJob for OCR -> `src/lib/email-sync/sync-service.ts:203-217`
14. Update attachment status to IMPORTED -> `src/lib/email-sync/sync-service.ts:219-225`

### Rule Toggle Flow

1. User clicks switch to toggle rule active/inactive -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:169-170`
2. handleToggle function invoked -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:77`
3. Client calls PUT /api/email/rules/:id with isActive -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:79-83`
4. Server validates rule belongs to company -> `src/app/api/email/rules/[id]/route.ts:19-25`
5. Server updates isActive field -> `src/app/api/email/rules/[id]/route.ts:30-38`
6. Page refreshes to show updated toggle state -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:89`

### Rule Deletion Flow

1. User clicks trash icon on rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:175`
2. handleDelete function invoked -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:58`
3. Client calls DELETE /api/email/rules/:id -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:61-63`
4. Server validates rule belongs to company -> `src/app/api/email/rules/[id]/route.ts:59-64`
5. Server deletes EmailImportRule record -> `src/app/api/email/rules/[id]/route.ts:67`
6. Page refreshes to remove rule from list -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:69`

## Key Modules

| Module               | Purpose                                     | Location                                                         |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| ImportRulesSection   | UI for managing filter rules per connection | `src/app/(dashboard)/settings/email/components/import-rules.tsx` |
| Rules API (GET/POST) | Fetch and create import rules               | `src/app/api/email/rules/route.ts`                               |
| Rules API (PUT/DEL)  | Update and delete individual rules          | `src/app/api/email/rules/[id]/route.ts`                          |
| processAttachment    | Evaluates rules during email sync           | `src/lib/email-sync/sync-service.ts:119-230`                     |
| EmailImportRule      | Database model for filter rules             | `prisma/schema.prisma:572-591`                                   |

## Data

### Database Tables

- **EmailImportRule**: Attachment filter criteria -> `prisma/schema.prisma:572-591`
  - Key fields: id, connectionId, companyId
  - Filter fields: senderEmail, senderDomain, subjectContains, filenameContains -> `prisma/schema.prisma:577-580`
  - Status: isActive (default true) -> `prisma/schema.prisma:582`
  - Timestamps: createdAt, updatedAt -> `prisma/schema.prisma:583-584`
  - Relations: connection, company -> `prisma/schema.prisma:586-587`
  - Indexed by: connectionId, companyId -> `prisma/schema.prisma:589-590`

### Filter Types

All filters are optional, but at least one is required per rule:

1. **senderEmail** (String, nullable) - Exact email address match -> `prisma/schema.prisma:577`
   - Example: "statements@bank.com"
   - Matching: Case-insensitive exact match -> `src/lib/email-sync/sync-service.ts:152-154`

2. **senderDomain** (String, nullable) - Domain portion after @ symbol -> `prisma/schema.prisma:578`
   - Example: "bank.com"
   - Matching: Extracts domain from sender email, case-insensitive -> `src/lib/email-sync/sync-service.ts:156-159`

3. **subjectContains** (String, nullable) - Substring in email subject -> `prisma/schema.prisma:579`
   - Example: "statement"
   - Matching: Case-insensitive substring search -> `src/lib/email-sync/sync-service.ts:161-163`

4. **filenameContains** (String, nullable) - Substring in attachment filename -> `prisma/schema.prisma:580`
   - Example: ".pdf"
   - Matching: Case-insensitive substring search -> `src/lib/email-sync/sync-service.ts:165-167`

## Rule Matching Logic

### AND Logic

Rules use AND logic - ALL specified filters must match for rule to trigger:

```typescript
// Example: Rule with senderEmail AND subjectContains
{
  senderEmail: "statements@bank.com",
  subjectContains: "monthly"
}

// Matches: From statements@bank.com, Subject "Your monthly statement"
// Does NOT match: From statements@bank.com, Subject "Annual report" (missing "monthly")
// Does NOT match: From other@bank.com, Subject "Your monthly statement" (wrong sender)
```

Source: `src/lib/email-sync/sync-service.ts:149-170`

### Inactive Rules

Rules with isActive=false are skipped during evaluation:

```typescript
if (!rule.isActive) return false
```

Source: `src/lib/email-sync/sync-service.ts:150`

### Case Insensitivity

All string comparisons are case-insensitive:

```typescript
// Email comparison
message.senderEmail.toLowerCase() !== rule.senderEmail.toLowerCase()

// Domain comparison
domain !== rule.senderDomain.toLowerCase()

// Subject comparison
!message.subject.toLowerCase().includes(rule.subjectContains.toLowerCase())

// Filename comparison
!attachment.filename.toLowerCase().includes(rule.filenameContains.toLowerCase())
```

Source: `src/lib/email-sync/sync-service.ts:152-167`

### Match Results

- **Match found**: Attachment downloaded, stored, ImportJob created if PDF/image
- **No match**: EmailAttachment created with status SKIPPED -> `src/lib/email-sync/sync-service.ts:196`
- **Already processed**: Skipped based on content hash -> `src/lib/email-sync/sync-service.ts:144-146`

## Security Features

### Authorization

- Requires authenticated user -> `src/app/api/email/rules/route.ts:10`
- Requires company membership -> `src/app/api/email/rules/route.ts:11`
- Tenant context isolation -> `src/app/api/email/rules/route.ts:12`
- Connection ownership validated -> `src/app/api/email/rules/route.ts:51-60`
- Rule ownership validated -> `src/app/api/email/rules/[id]/route.ts:19-25`

### Validation

- At least one filter criterion required -> `src/app/api/email/rules/route.ts:63-68`
- ConnectionId required on creation -> `src/app/api/email/rules/route.ts:43-47`
- Connection must belong to company -> `src/app/api/email/rules/route.ts:51-60`
- Rule updates preserve companyId -> `src/app/api/email/rules/[id]/route.ts:33-37`

### Data Isolation

- Rules filtered by companyId on fetch -> `src/app/api/email/rules/route.ts:15`
- Rules always created with companyId -> `src/app/api/email/rules/route.ts:73`
- Update/delete verify companyId match -> `src/app/api/email/rules/[id]/route.ts:20`

## UI Components

### Import Rules Section

Component renders within each email connection card:

```
┌─────────────────────────────────────────────────┐
│ Import Rules                                [+] │
│                                                  │
│ [No import rules configured. Add a rule to      │
│  automatically import matching attachments.]    │
└─────────────────────────────────────────────────┘
```

Source: `src/app/(dashboard)/settings/email/components/import-rules.tsx:96-102,150-154`

### Rule Form

Displays when user clicks "+" button:

```
┌─────────────────────────────────────────────────┐
│ Sender Email           Sender Domain            │
│ ┌───────────────────┐ ┌───────────────────┐    │
│ │statements@bank.com│ │bank.com           │    │
│ └───────────────────┘ └───────────────────┘    │
│                                                  │
│ Subject Contains       Filename Contains        │
│ ┌───────────────────┐ ┌───────────────────┐    │
│ │statement          │ │.pdf               │    │
│ └───────────────────┘ └───────────────────┘    │
│                                                  │
│ [Add Rule]                                       │
└─────────────────────────────────────────────────┘
```

Source: `src/app/(dashboard)/settings/email/components/import-rules.tsx:104-148`

### Rule List Item

Each rule displays with filters, toggle, and delete:

```
┌─────────────────────────────────────────────────┐
│ From: statements@bank.com Domain: @bank.com     │
│ Subject: *statement* File: *.pdf*   [ON] [🗑]  │
└─────────────────────────────────────────────────┘
```

Source: `src/app/(dashboard)/settings/email/components/import-rules.tsx:156-183`

### Empty State

Shows message when no rules configured:

```
No import rules configured. Add a rule to automatically import matching attachments.
```

Source: `src/app/(dashboard)/settings/email/components/import-rules.tsx:150-154`

## API Endpoints

### GET /api/email/rules

Fetch all rules for authenticated company:

**Request:**

```http
GET /api/email/rules
Authorization: Bearer {session-token}
```

**Response:**

```json
{
  "rules": [
    {
      "id": "clx123",
      "connectionId": "clx456",
      "companyId": "clx789",
      "senderEmail": "statements@bank.com",
      "senderDomain": null,
      "subjectContains": "statement",
      "filenameContains": ".pdf",
      "isActive": true,
      "createdAt": "2025-12-15T10:00:00Z",
      "updatedAt": "2025-12-15T10:00:00Z",
      "connection": {
        "emailAddress": "user@example.com",
        "provider": "GMAIL"
      }
    }
  ]
}
```

Source: `src/app/api/email/rules/route.ts:8-32`

### POST /api/email/rules

Create new import rule:

**Request:**

```http
POST /api/email/rules
Content-Type: application/json
Authorization: Bearer {session-token}

{
  "connectionId": "clx456",
  "senderEmail": "statements@bank.com",
  "senderDomain": null,
  "subjectContains": "statement",
  "filenameContains": ".pdf"
}
```

**Validation:**

- connectionId required (400 if missing)
- Connection must belong to company (404 if not found)
- At least one filter required (400 if none provided)

**Response:**

```json
{
  "rule": {
    "id": "clx123",
    "connectionId": "clx456",
    "companyId": "clx789",
    "senderEmail": "statements@bank.com",
    "senderDomain": null,
    "subjectContains": "statement",
    "filenameContains": ".pdf",
    "isActive": true,
    "createdAt": "2025-12-15T10:00:00Z",
    "updatedAt": "2025-12-15T10:00:00Z"
  }
}
```

Source: `src/app/api/email/rules/route.ts:34-89`

### PUT /api/email/rules/:id

Update existing rule:

**Request:**

```http
PUT /api/email/rules/clx123
Content-Type: application/json
Authorization: Bearer {session-token}

{
  "isActive": false
}
```

**Updateable Fields:**

- senderEmail
- senderDomain
- subjectContains
- filenameContains
- isActive

**Response:**

```json
{
  "rule": {
    "id": "clx123",
    "connectionId": "clx456",
    "companyId": "clx789",
    "senderEmail": "statements@bank.com",
    "senderDomain": null,
    "subjectContains": "statement",
    "filenameContains": ".pdf",
    "isActive": false,
    "createdAt": "2025-12-15T10:00:00Z",
    "updatedAt": "2025-12-15T11:00:00Z"
  }
}
```

Source: `src/app/api/email/rules/[id]/route.ts:8-46`

### DELETE /api/email/rules/:id

Delete import rule:

**Request:**

```http
DELETE /api/email/rules/clx123
Authorization: Bearer {session-token}
```

**Response:**

```json
{
  "success": true
}
```

Source: `src/app/api/email/rules/[id]/route.ts:48-74`

## Dependencies

- **Depends on**:
  - Email Connections - Rules require active EmailConnection
  - Email Sync Service - Rules evaluated during sync process
  - R2 Storage - Matched attachments stored in R2
  - Import Jobs - Creates jobs for OCR processing

- **Depended by**:
  - Email Settings - UI for rule management
  - Automated Document Import - Rules drive automation
  - Bank Statement Processing - Filters bank statement PDFs

## Error Handling

- **Missing connectionId**: Returns 400 with error message -> `src/app/api/email/rules/route.ts:44-47`
- **Connection not found**: Returns 404 with error message -> `src/app/api/email/rules/route.ts:56-59`
- **No filter criteria**: Returns 400 with error message -> `src/app/api/email/rules/route.ts:64-67`
- **Rule not found**: Returns 404 with error message -> `src/app/api/email/rules/[id]/route.ts:24,64`
- **Unauthorized access**: Handled by requireAuth/requireCompany -> `src/app/api/email/rules/route.ts:10-11`
- **Database errors**: Returns 500 with generic error -> `src/app/api/email/rules/route.ts:83-87`

## Example Use Cases

### Bank Statement Import

**Scenario**: Automatically import monthly bank statements from specific sender

**Rule Configuration**:

```json
{
  "senderEmail": "statements@mybank.com",
  "subjectContains": "monthly statement",
  "filenameContains": ".pdf"
}
```

**Matches**:

- From: statements@mybank.com
- Subject: "Your monthly statement for December 2025"
- Attachment: "statement-2025-12.pdf"

**Does NOT match**:

- From: alerts@mybank.com (wrong sender)
- Subject: "Annual tax summary" (missing "monthly statement")
- Attachment: "summary.jpg" (missing ".pdf")

### Multi-Vendor Invoice Import

**Scenario**: Import invoices from entire vendor domain

**Rule Configuration**:

```json
{
  "senderDomain": "vendor.com",
  "subjectContains": "invoice",
  "filenameContains": "invoice"
}
```

**Matches**:

- From: billing@vendor.com, noreply@vendor.com, accounts@vendor.com
- Subject: "Invoice #12345", "Your invoice is ready"
- Attachment: "invoice-12345.pdf", "invoice_2025.pdf"

### Generic PDF Import

**Scenario**: Import all PDFs from trusted sender

**Rule Configuration**:

```json
{
  "senderEmail": "documents@accounting.com",
  "filenameContains": ".pdf"
}
```

**Matches**:

- Any PDF attachment from documents@accounting.com
- Subject: (any)
- Attachment: report.pdf, statement.pdf, invoice.pdf

## Verification Checklist

- [x] User can create import rules with multiple filter types
- [x] At least one filter criterion required on creation
- [x] Rules support sender email exact match filtering
- [x] Rules support sender domain filtering
- [x] Rules support subject contains filtering
- [x] Rules support filename contains filtering
- [x] All string comparisons are case-insensitive
- [x] Rules use AND logic (all filters must match)
- [x] User can toggle rules active/inactive
- [x] Inactive rules skipped during sync
- [x] User can delete import rules
- [x] Rules validated against connection ownership
- [x] Matching attachments downloaded to R2
- [x] PDF/image attachments create ImportJobs
- [x] Non-matching attachments marked as SKIPPED
- [x] Deduplication prevents reprocessing

## Related Features

- **Email Settings**: Parent feature providing email connection management
- **Email Sync**: Executes rule matching during scheduled sync
- **Document Import**: Receives ImportJobs from matched attachments
- **Bank Statement Processing**: Primary use case for email rules

## Evidence Links

1. `src/app/api/email/rules/route.ts:1-89` - GET/POST endpoints for rule management
2. `src/app/api/email/rules/[id]/route.ts:1-74` - PUT/DELETE endpoints for individual rules
3. `src/app/(dashboard)/settings/email/components/import-rules.tsx:1-188` - UI for rule CRUD operations
4. `src/lib/email-sync/sync-service.ts:119-230` - Rule matching during sync with AND logic
5. `src/lib/email-sync/sync-service.ts:149-170` - Filter evaluation (senderEmail, senderDomain, subjectContains, filenameContains)
6. `src/app/(dashboard)/settings/email/components/connection-list.tsx:108-111` - ImportRulesSection integration
7. `prisma/schema.prisma:572-591` - EmailImportRule database schema
8. `src/app/(dashboard)/settings/email/page.tsx:21-28` - Email connections with rules loaded
9. `src/lib/email-sync/sync-service.ts:182-198` - EmailAttachment creation with PENDING/SKIPPED status
10. `src/lib/email-sync/sync-service.ts:203-228` - ImportJob creation for matching PDF/image attachments
11. `src/app/api/email/rules/route.ts:63-68` - Validation requiring at least one filter criterion
