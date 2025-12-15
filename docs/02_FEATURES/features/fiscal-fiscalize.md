# Feature: Fiscalize Invoice

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 24

## Purpose

Enables automatic and manual fiscalization of invoices through Croatian Tax Authority (CIS - Centralni Informacijski Sustav) for cash and card payments. The feature manages digital certificates, generates fiscally-compliant XML messages with ZKI (Protective Code of Issuer), signs documents with RSA-SHA256, submits to Porezna Uprava endpoints, handles JIR (Unique Invoice Identifier) responses, and processes async requests with comprehensive retry logic and error classification.

## User Entry Points

| Type   | Path                       | Evidence                                                        |
| ------ | -------------------------- | --------------------------------------------------------------- |
| Page   | /invoices/:id              | `src/app/(dashboard)/invoices/[id]/page.tsx`                    |
| Button | "Fiskaliziraj"             | `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:129` |
| Action | manualFiscalizeAction      | `src/app/actions/fiscal-certificate.ts:233-278`                 |
| Auto   | After e-invoice send       | `src/app/actions/e-invoice.ts:199-216`                          |
| Cron   | /api/cron/fiscal-processor | `src/app/api/cron/fiscal-processor/route.ts:10-227`             |

## Core Flow

### Automatic Fiscalization (Post E-Invoice Send)

1. User sends e-invoice via "Pošalji račun" button → `src/app/actions/e-invoice.ts:129-220`
2. Invoice transmitted to provider successfully → `src/app/actions/e-invoice.ts:168`
3. Invoice updated with SENT status → `src/app/actions/e-invoice.ts:182-196`
4. System evaluates fiscalization decision criteria → `src/lib/fiscal/should-fiscalize.ts:15-92`
5. Company fiscalization enabled check → `src/lib/fiscal/should-fiscalize.ts:21-23`
6. Payment method validation (CASH/CARD only) → `src/lib/fiscal/should-fiscalize.ts:27-33`
7. Certificate availability verified → `src/lib/fiscal/should-fiscalize.ts:56-77`
8. Fiscal request queued with QUEUED status → `src/lib/fiscal/should-fiscalize.ts:94-131`
9. Invoice fiscalStatus updated to PENDING → `src/app/actions/e-invoice.ts:207-210`
10. Background processor picks up request → `src/app/api/cron/fiscal-processor/route.ts:28-65`
11. Request status changed to PROCESSING → `src/app/api/cron/fiscal-processor/route.ts:33`
12. Certificate loaded and decrypted → `src/lib/fiscal/fiscal-pipeline.ts:23-48`
13. ZKI calculated with RSA-SHA256 signature → `src/lib/e-invoice/zki.ts:33-55`
14. Fiscal XML built (RacunZahtjev) → `src/lib/fiscal/xml-builder.ts:42-156`
15. XML digitally signed with certificate → `src/lib/fiscal/xml-signer.ts:10-43`
16. SOAP envelope created and submitted to CIS → `src/lib/fiscal/porezna-client.ts:25-71`
17. Response parsed for JIR or error codes → `src/lib/fiscal/porezna-client.ts:82-155`
18. On success: Invoice updated with JIR/ZKI → `src/app/api/cron/fiscal-processor/route.ts:88-97`
19. On error: Request classified and retry scheduled → `src/app/api/cron/fiscal-processor/route.ts:102-132`

### Manual Fiscalization

1. User views invoice detail page → `src/app/(dashboard)/invoices/[id]/page.tsx`
2. Fiscal status badge displayed → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:19-166`
3. User clicks "Fiskaliziraj" button → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:129`
4. Confirmation dialog shown → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:153`
5. Server action validates ownership and invoice status → `src/app/actions/fiscal-certificate.ts:237-245`
6. Payment method required validation → `src/app/actions/fiscal-certificate.ts:251-253`
7. Fiscal decision evaluated → `src/app/actions/fiscal-certificate.ts:255-259`
8. Request queued if criteria met → `src/app/actions/fiscal-certificate.ts:261-270`
9. Success toast: "Fiskalizacija je dodana u red čekanja" → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:160`
10. Page refreshed to show PENDING status → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:161`
11. Background processor executes request (same as auto flow steps 10-19)

## Key Modules

| Module                    | Purpose                                        | Location                                                    |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| FiscalStatusBadge         | UI component showing fiscal status and actions | `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx` |
| manualFiscalizeAction     | Server action for manual fiscalization         | `src/app/actions/fiscal-certificate.ts:233-278`             |
| shouldFiscalizeInvoice    | Decision engine for fiscalization criteria     | `src/lib/fiscal/should-fiscalize.ts:15-92`                  |
| queueFiscalRequest        | Idempotent fiscal request queue manager        | `src/lib/fiscal/should-fiscalize.ts:94-131`                 |
| executeFiscalRequest      | Core pipeline for certificate-based signing    | `src/lib/fiscal/fiscal-pipeline.ts:19-128`                  |
| buildRacunRequest         | Fiscal XML builder (RacunZahtjev)              | `src/lib/fiscal/xml-builder.ts:42-156`                      |
| calculateZKI              | ZKI calculation with RSA-SHA256                | `src/lib/e-invoice/zki.ts:33-55`                            |
| signXML                   | Digital signature with X509 certificate        | `src/lib/fiscal/xml-signer.ts:10-43`                        |
| submitToPorezna           | SOAP client for CIS endpoints                  | `src/lib/fiscal/porezna-client.ts:25-71`                    |
| fiscal-processor          | Background cron job for async processing       | `src/app/api/cron/fiscal-processor/route.ts:10-227`         |
| parseP12Certificate       | P12 certificate parser and validator           | `src/lib/fiscal/certificate-parser.ts`                      |
| encryptWithEnvelope       | Envelope encryption for certificate storage    | `src/lib/fiscal/envelope-encryption.ts`                     |
| FiscalisationSettingsPage | Certificate management UI                      | `src/app/(dashboard)/settings/fiscalisation/page.tsx`       |

## Data

### FiscalRequest Table

Tracks fiscalization requests with retry and locking → `prisma/schema.prisma:1033-1063`:

- **Core Fields**:
  - `id` (String): Unique identifier
  - `companyId` (String): Tenant isolation
  - `certificateId` (String): Reference to fiscal certificate
  - `invoiceId` (String, nullable): Invoice being fiscalized
  - `messageType` (FiscalMessageType): RACUN or STORNO
  - `status` (FiscalStatus): QUEUED → PROCESSING → COMPLETED/FAILED/DEAD
- **Retry Management**:
  - `attemptCount` (Int): Current retry attempt (0-5)
  - `maxAttempts` (Int): Maximum retries (default 5)
  - `nextRetryAt` (DateTime): Scheduled retry time with exponential backoff
  - `lockedAt` (DateTime, nullable): Worker lock timestamp
  - `lockedBy` (String, nullable): Worker ID for debugging
- **Result Fields**:
  - `jir` (String, nullable): Unique fiscal identifier from CIS
  - `zki` (String, nullable): Protective security code
  - `errorCode` (String, nullable): Porezna error code (p001, t001, etc.)
  - `errorMessage` (String, nullable): Human-readable error description
  - `lastHttpStatus` (Int, nullable): Last HTTP response code
- **XML Storage**:
  - `requestXml` (Text, nullable): Generated fiscal XML before signing
  - `signedXml` (Text, nullable): Digitally signed XML sent to CIS
  - `responseXml` (Text, nullable): Raw SOAP response from Porezna

### FiscalCertificate Table

Stores encrypted P12 certificates → `prisma/schema.prisma:1007-1031`:

- **Core Fields**:
  - `id` (String): Unique identifier
  - `companyId` (String): Tenant isolation
  - `environment` (FiscalEnv): TEST or PROD
  - `provider` (String): DIRECT (default for CIS)
  - `status` (CertStatus): PENDING/ACTIVE/EXPIRED/REVOKED
- **Certificate Info**:
  - `certSubject` (String): Certificate subject DN
  - `certSerial` (String): Certificate serial number
  - `certNotBefore` (DateTime): Validity start date
  - `certNotAfter` (DateTime): Expiration date
  - `oibExtracted` (String): OIB extracted from certificate
  - `certSha256` (String): Certificate fingerprint
- **Encrypted Storage**:
  - `encryptedP12` (Text): P12 certificate encrypted with data key
  - `encryptedDataKey` (String): Data key encrypted with env secret
- **Audit**:
  - `lastUsedAt` (DateTime, nullable): Last fiscalization timestamp

### EInvoice Fiscal Fields

Invoice fiscalization tracking → `prisma/schema.prisma:191-259`:

- `jir` (String, nullable): Fiscal unique identifier from CIS → line 206
- `zki` (String, nullable): Protective security code (HMAC) → line 207
- `fiscalizedAt` (DateTime, nullable): Fiscalization timestamp → line 208
- `fiscalStatus` (String, nullable): PENDING/COMPLETED/FAILED → line 209
- `paymentMethod` (PaymentMethod, nullable): CASH/CARD/TRANSACTION → line 235

### Indexes and Relations

- **FiscalRequest indexes**:
  - `[status, nextRetryAt]`: Efficient job queue queries → line 1061
  - `[companyId]`: Tenant filtering → line 1062
  - `[invoiceId]`: Invoice lookup → line 1063
- **Unique constraint**: `[companyId, invoiceId, messageType]` prevents duplicates → line 1060
- **Relations**:
  - FiscalRequest → FiscalCertificate (certificateId)
  - FiscalRequest → EInvoice (invoiceId)
  - FiscalRequest → Company (companyId)

## Fiscalization Decision Logic

Croatian law requires fiscalization for cash/card payments → `src/lib/fiscal/should-fiscalize.ts:15-92`:

### Decision Criteria (All Must Pass)

1. **Company Enabled**: `company.fiscalEnabled = true` → line 21-23
2. **Payment Method**: CASH or CARD only (TRANSACTION exempt) → line 27-33
3. **Not Already Fiscalized**: `invoice.jir` must be null → line 36-38
4. **No Pending Request**: Idempotency check for QUEUED/PROCESSING → line 41-51
5. **Certificate Available**: TEST or PROD certificate exists → line 56-63
6. **Certificate Active**: Status = ACTIVE → line 72-76
7. **Certificate Valid**: Not expired (`certNotAfter` > now) → line 79-84

### Return Values

Success case → line 86-91:

```typescript
{
  shouldFiscalize: true,
  reason: 'Meets fiscalisation criteria',
  certificateId: certificate.id,
  environment: 'TEST' | 'PROD'
}
```

Failure cases with specific reason strings for observability.

## ZKI Calculation

Zaštitni Kod Izdavatelja (Protective Code of Issuer) → `src/lib/e-invoice/zki.ts:1-125`:

### Input Format

```typescript
{
  oib: string // 11-digit company OIB
  dateTime: Date // Invoice date/time
  invoiceNumber: string // Sequential invoice number
  premisesCode: string // Business premises code
  deviceCode: string // Payment device code
  totalAmount: number // Total in cents (EUR * 100)
}
```

### Calculation Process

1. **Format DateTime**: `dd.MM.yyyyHH:mm:ss` (Croatian format) → line 61-71
2. **Format Amount**: Convert cents to decimal with comma separator (`100,00`) → line 78-83
3. **Build Data String**: `OIB + DateTime + InvoiceNumber + PremisesCode + DeviceCode + TotalAmount` → line 38
4. **Sign with RSA-SHA256**: Private key signature → line 43-46
5. **Hash with MD5**: MD5 of signature bytes → line 46
6. **Result**: 32-character hexadecimal ZKI code

### Production vs Demo Mode

- **Production** (with privateKey): RSA-SHA256 signature → MD5 hash → line 40-50
- **Demo** (without privateKey): SHA256 hash only (first 32 chars) → line 54

### Validation

Validates all input fields before calculation → line 88-125:

- OIB must be exactly 11 digits
- Invoice number required
- Premises/device codes required
- Amount must be positive
- Valid Date object required

## Fiscal XML Structure

Croatian fiscalization XML standard → `src/lib/fiscal/xml-builder.ts:1-193`:

### Namespace and Schema

- **Namespace**: `http://www.apis-it.hr/fin/2012/types/f73` → line 6
- **Schema Location**: `FiskalizacijaSchema.xsd` → line 7
- **Root Element**: `tns:RacunZahtjev` with `Id="RacunZahtjev"` → line 64-68

### XML Structure (RacunZahtjev)

#### Zaglavlje (Header) → line 71-73

- `IdPoruke`: UUID message identifier
- `DatumVrijeme`: ISO timestamp of request

#### Racun (Invoice) → line 76-149

**Basic Info** → line 78-81:

- `Oib`: Company OIB (11 digits)
- `USustPdv`: VAT registered flag (true/false)
- `DatVrijeme`: Invoice date/time
- `OznSlijed`: Sequence marking (N = on premises level)

**BrRac (Invoice Number)** → line 84-87:

- `BrOznRac`: Sequential number
- `OznPosPr`: Premises code
- `OznNapUr`: Device code

**Pdv (VAT)** → line 90-98:

- Multiple `Porez` elements per VAT rate
- `Stopa`: VAT rate percentage
- `Osnovica`: Base amount (net)
- `Iznos`: VAT amount

**Pnp (Consumption Tax)** → line 101-109:

- Optional consumption tax breakdown
- Same structure as VAT

**Amounts** → line 112-127:

- `IznosOslobodjen`: VAT-exempt amount
- `IznosMarza`: Margin scheme amount
- `IznosNePodlijeze`: Non-taxable amount
- `IznosUkupno`: Total amount (mandatory)

**Payment and Operator** → line 130-133:

- `NacinPlac`: Payment method code (G=Cash, K=Card, T=Transfer)
- `OibOper`: Operator OIB

**Fiscal Codes** → line 136:

- `ZastKod`: ZKI protective code

**Flags** → line 139-148:

- `NaknadnaDost`: Subsequent delivery (true/false)
- `ParagonBrRac`: Paragon block number (optional)
- `SpecNamjena`: Specific purpose (e.g., "STORNO {JIR}")

### Payment Method Mapping → line 158-172

| Input            | CIS Code | Description                |
| ---------------- | -------- | -------------------------- |
| CASH, G          | G        | Gotovina (Cash)            |
| CARD, K          | K        | Kartica (Card)             |
| BANK_TRANSFER, T | T        | Transakcijski račun (Bank) |
| CHECK, C         | C        | Ček (Check)                |
| OTHER, O         | O        | Ostalo (Other)             |

### Storno (Reversal) → line 174-193

Negative amounts with reference to original JIR:

- All amounts negated → line 183-188
- `SpecNamjena` set to `"STORNO {originalJir}"` → line 189

## Digital Signature

XML signing with X.509 certificate → `src/lib/fiscal/xml-signer.ts:1-50`:

### Signature Configuration → line 10-22

- **Algorithm**: RSA-SHA256 (`http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`)
- **Canonicalization**: Exclusive C14N (`http://www.w3.org/2001/10/xml-exc-c14n#`)
- **KeyInfo**: X509Certificate embedded in signature
- **Certificate Format**: Base64-encoded X.509 certificate (without headers)

### Reference → line 25-32

- **XPath**: `//*[@Id='RacunZahtjev']` targets root element
- **Digest**: SHA-256
- **Transforms**:
  1. Enveloped signature (excludes signature from digest)
  2. Exclusive C14N (canonicalization)

### Signature Placement → line 35-40

- **Location**: Appended as child of `RacunZahtjev` element
- **Action**: append (last child)

## CIS Communication

SOAP client for Croatian Tax Authority → `src/lib/fiscal/porezna-client.ts:1-160`:

### Endpoints → line 4-7

- **TEST**: `https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest`
- **PROD**: `https://cis.porezna-uprava.hr:8449/FiskalizacijaService`

### SOAP Request → line 25-71

**Headers** → line 38-41:

- `Content-Type`: `application/soap+xml; charset=utf-8`
- `SOAPAction`: `http://www.apis-it.hr/fin/2012/types/f73/FiskalizacijaService/Racun`

**Envelope** → line 73-79:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    {signedXml}
  </soap:Body>
</soap:Envelope>
```

**Timeout**: 30 seconds with AbortController → line 32-33

### Response Parsing → line 82-155

#### SOAP Fault → line 94-102

- `Code.Value`: Fault code
- `Reason.Text`: Error description
- Returns `success: false` with errorCode/errorMessage

#### RacunOdgovor (Invoice Response) → line 105-126

**Error Case** (Greske element present) → line 116-126:

- `SifraGreske`: Porezna error code (e.g., `p001`, `t001`)
- `PorukaGreske`: Error message in Croatian
- Multiple errors supported (array handling)

**Success Case** (JIR present) → line 129-146:

- `Jir`: Unique fiscal identifier (UUID format)
- `ZastKod`: ZKI echoed back from request
- Missing JIR treated as error → line 132-138

#### Parse Error → line 147-154

- XML parsing failures
- Returns `errorCode: 'PARSE_ERROR'`

### Namespace Stripping → line 157-160

Helper function removes XML namespace prefixes for simpler parsing.

## Background Processing

Async fiscal request processor → `src/app/api/cron/fiscal-processor/route.ts:1-226`:

### Job Acquisition → line 28-45

**Row-Level Locking**:

```sql
UPDATE "FiscalRequest"
SET "lockedAt" = NOW(), "lockedBy" = :workerId, "status" = 'PROCESSING'
WHERE id IN (
  SELECT id FROM "FiscalRequest"
  WHERE "status" IN ('QUEUED', 'FAILED')
    AND "nextRetryAt" <= NOW()
    AND "attemptCount" < "maxAttempts"
    AND ("lockedAt" IS NULL OR "lockedAt" < :staleCutoff)
  ORDER BY "nextRetryAt" ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :batchSize
)
RETURNING *
```

**Features**:

- `FOR UPDATE SKIP LOCKED`: Prevents concurrent worker conflicts → line 41
- Stale lock recovery: 60-second timeout → line 18, 21
- Batch size: 10 concurrent requests → line 17
- Worker ID: UUID-based identification → line 19

### Job Processing → line 68-133

**Success Path** → line 73-100:

1. Execute fiscal pipeline (certificate → sign → submit)
2. Update request status to COMPLETED
3. Store JIR and responseXml
4. Clear locks (`lockedAt = null, lockedBy = null`)
5. Update invoice with JIR/ZKI and fiscalStatus = COMPLETED

**Error Path** → line 101-132:

1. Classify error (retriable vs non-retriable)
2. Increment attemptCount
3. Set status to FAILED (retriable) or DEAD (permanent)
4. Store errorCode and errorMessage
5. Calculate next retry time with exponential backoff
6. Update invoice fiscalStatus to PENDING or FAILED

### Error Classification → line 135-198

#### Network Errors (Retriable) → line 144-150

- `ECONNREFUSED`: Connection refused
- `ETIMEDOUT`: Request timeout
- `ENOTFOUND`: DNS resolution failure
- `timeout`: Generic timeout

#### HTTP Errors → line 154-180

- **5xx Server Errors**: Retriable → line 157-163
- **429 Rate Limiting**: Retriable → line 166-172
- **4xx Client Errors**: Non-retriable (VALIDATION_ERROR) → line 175-180

#### Porezna Error Codes → line 184-194

- **t001-t099**: Temporary errors → Retriable (starts with 't')
- **p001-p999**: Permanent errors → Non-retriable
- Code extracted from error object `poreznaCode` property

#### Unknown Errors → line 197

- All other errors treated as non-retriable

### Retry Strategy → line 200-210

**Exponential Backoff**:

- Base delay: 30 seconds → line 202
- Backoff factor: 4x per attempt → line 203
- Schedule: 30s, 2m, 8m, 32m, 2h (capped) → line 204
- Jitter: ±10% randomization → line 207
- Max attempts: 5 retries → `maxAttempts` field

**Calculation**:

```typescript
baseDelay = 30s
delaySeconds = baseDelay * 4^(attemptCount - 1)
actualDelay = min(delaySeconds, 7200s)
jitter = actualDelay * 0.1 * (random[-1, 1])
nextRetryAt = now + (actualDelay + jitter)
```

### Stale Lock Recovery → line 212-227

**Automatic Recovery**:

- Threshold: 5 minutes → line 213
- Status: PROCESSING → FAILED
- Clears locks for crashed workers
- Error message: "Lock expired - worker may have crashed"

**Use Case**: Worker crashes mid-processing, lock prevents other workers from picking up job, recovery ensures eventual processing.

## Certificate Management

Digital certificate lifecycle → `src/app/actions/fiscal-certificate.ts` and `src/lib/fiscal/certificate-parser.ts`:

### Certificate Upload → line 70-145

**Validation** → line 25-68:

1. File size limit: 50KB → line 34-36
2. P12 parsing with password → line 38
3. Environment validation (TEST/PROD) → line 40-43
4. OIB matching (warning only) → line 45-47

**Encryption** → line 80-84:

- Payload: `{ p12: base64, password: string }` serialized as JSON
- Envelope encryption: Data encrypted with unique data key
- Data key encrypted with `FISCAL_CERT_KEY` env variable
- Both stored in database

**Upsert** → line 86-127:

- Unique constraint: `[companyId, environment]`
- Updates existing certificate for environment
- Stores certificate metadata (subject, serial, validity, OIB)
- Status set to ACTIVE
- Audit log created

### Certificate Deletion → line 147-198

**Safety Check** → line 154-167:

- Prevents deletion if pending requests exist
- Counts QUEUED/PROCESSING requests
- Returns error with count

**Cascade**:

- FiscalRequests NOT deleted (keep history)
- Audit log created

### Manual Fiscalization Action → line 233-278

**Validation**:

1. User authentication and company context
2. Invoice ownership check
3. Invoice not already fiscalized
4. Payment method required (CASH/CARD)
5. Fiscal decision criteria

**Queue Request**:

- Idempotent upsert by `[companyId, invoiceId, messageType]`
- Resets failed requests (attemptCount = 0)
- Immediate scheduling (`nextRetryAt = now`)

### Retry Request Action → line 200-232

**Use Case**: Manual retry after FAILED/DEAD status

**Process**:

1. Find request by ID and company
2. Validate status (FAILED or DEAD only)
3. Reset request:
   - Status → QUEUED
   - attemptCount → 0
   - Clear error fields
   - Clear locks
   - Schedule immediately

## UI Components

### Fiscal Status Badge → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:1-165`

**Display States**:

#### Fiscalized (JIR present) → line 26-46

- Badge: Green, "Fiskalizirano" with CheckCircle2 icon
- Details: JIR (monospace), ZKI (truncated), fiscalizedAt timestamp
- No actions (final state)

#### Queued → line 50-62

- Badge: Secondary, "U redu čekanja" with Clock icon
- Message: "Čeka fiskalizaciju..."
- No user action (wait for processor)

#### Processing → line 64-76

- Badge: Secondary, "Procesira se" with spinning Clock
- Message: "Fiskalizacija u tijeku..."
- No user action (in progress)

#### Failed/Dead → line 78-107

- Badge: Destructive red, "Neuspjela fiskalizacija" with XCircle
- Details: Error message, error code, attempt count
- Button: "Pokušaj ponovno" triggers retry action

#### Not Fiscalized (Manual Available) → line 115-133

- Badge: Outline, "Nije fiskalizirano" with AlertCircle
- Button: "Fiskaliziraj" triggers manual fiscalization
- Conditions: Has certificate, not DRAFT, no JIR

#### Not Fiscalized (No Certificate) → line 136-148

- Badge: Outline, "Nije fiskalizirano" with AlertCircle
- Message: "Certifikat nije konfiguriran"
- No action available

**User Actions**:

- Manual fiscalization confirmation dialog → line 153
- Success toast + page refresh → line 160-161
- Error toast with message → line 163

### Fiscalisation Settings Page → `src/app/(dashboard)/settings/fiscalisation/page.tsx:1-59`

**Layout**:

1. Header: Title and description
2. Certificate cards: TEST and PROD environments side-by-side
3. Status panel: Recent requests and statistics

**Data Loading** → line 11-29:

- TEST certificate
- PROD certificate
- Recent 20 fiscal requests with invoice numbers
- Request counts grouped by status

**Certificate Cards** → line 41-51:

- Environment label (TEST/PROD)
- Certificate details if uploaded
- Upload dialog for new certificate
- Delete action if no pending requests

**Status Panel**:

- Recent request history (invoice number, status, timestamp, error)
- Status statistics (QUEUED, PROCESSING, COMPLETED, FAILED, DEAD counts)

## Error Handling

### Decision Errors

| Scenario             | Behavior                          | Evidence                                   |
| -------------------- | --------------------------------- | ------------------------------------------ |
| Company disabled     | Skip fiscalization, reason logged | `src/lib/fiscal/should-fiscalize.ts:21-23` |
| No payment method    | Skip fiscalization                | `src/lib/fiscal/should-fiscalize.ts:27-29` |
| TRANSACTION payment  | Skip fiscalization (non-cash)     | `src/lib/fiscal/should-fiscalize.ts:31-33` |
| Already fiscalized   | Skip fiscalization (JIR exists)   | `src/lib/fiscal/should-fiscalize.ts:36-38` |
| Pending request      | Skip fiscalization (idempotency)  | `src/lib/fiscal/should-fiscalize.ts:41-51` |
| No certificate       | Skip fiscalization                | `src/lib/fiscal/should-fiscalize.ts:56-69` |
| Certificate inactive | Skip fiscalization                | `src/lib/fiscal/should-fiscalize.ts:72-76` |
| Certificate expired  | Skip fiscalization                | `src/lib/fiscal/should-fiscalize.ts:79-84` |

### Pipeline Errors

| Error Type            | Porezna Code | Description                      | Retriable | Evidence                                  |
| --------------------- | ------------ | -------------------------------- | --------- | ----------------------------------------- |
| Certificate not found | p001         | Certificate missing from DB      | No        | `src/lib/fiscal/fiscal-pipeline.ts:27-29` |
| Certificate inactive  | p002         | Certificate status not ACTIVE    | No        | `src/lib/fiscal/fiscal-pipeline.ts:31-33` |
| Certificate expired   | p003         | Certificate past expiration date | No        | `src/lib/fiscal/fiscal-pipeline.ts:35-37` |
| Invoice not found     | p004         | Invoice ID invalid               | No        | `src/lib/fiscal/fiscal-pipeline.ts:59-61` |

### Network Errors

| Error Code   | Description           | Retriable | Backoff | Evidence                                         |
| ------------ | --------------------- | --------- | ------- | ------------------------------------------------ |
| ECONNREFUSED | Connection refused    | Yes       | Exp     | `src/app/api/cron/fiscal-processor/route.ts:145` |
| ETIMEDOUT    | Request timeout       | Yes       | Exp     | `src/app/api/cron/fiscal-processor/route.ts:146` |
| ENOTFOUND    | DNS resolution failed | Yes       | Exp     | `src/app/api/cron/fiscal-processor/route.ts:147` |
| timeout      | Generic timeout       | Yes       | Exp     | `src/app/api/cron/fiscal-processor/route.ts:148` |

### HTTP Errors

| Status Code | Type          | Retriable | Evidence                                             |
| ----------- | ------------- | --------- | ---------------------------------------------------- |
| 500-599     | Server errors | Yes       | `src/app/api/cron/fiscal-processor/route.ts:157-163` |
| 429         | Rate limiting | Yes       | `src/app/api/cron/fiscal-processor/route.ts:166-172` |
| 400-499     | Client errors | No        | `src/app/api/cron/fiscal-processor/route.ts:175-180` |

### Porezna Error Codes

**Format**:

- `t001-t099`: Temporary errors (retriable)
- `p001-p999`: Permanent errors (non-retriable)

**Classification** → `src/app/api/cron/fiscal-processor/route.ts:184-194`:

- Check if error code starts with 't'
- Temporary → FAILED status with retry
- Permanent → DEAD status, manual intervention required

### Error Recovery

**Stale Locks** → line 212-227:

- Workers that crash leave locks
- Recovery: Status → FAILED after 5 minutes
- Automatic retry scheduled

**Manual Retry** → `src/app/actions/fiscal-certificate.ts:200-232`:

- User-triggered retry for FAILED/DEAD requests
- Resets attempt count to 0
- Clears error fields
- Schedules immediately

## Security

### Certificate Encryption

**Envelope Encryption** → `src/lib/fiscal/envelope-encryption.ts`:

1. Generate random 32-byte data key
2. Encrypt P12 + password with data key (AES-256-GCM)
3. Encrypt data key with `FISCAL_CERT_KEY` environment secret
4. Store both encrypted values in database
5. Private key never exposed in plaintext

**Decryption** → `src/lib/fiscal/fiscal-pipeline.ts:40-48`:

1. Decrypt data key with env secret
2. Decrypt P12 payload with data key
3. Parse P12 to extract private key and certificate
4. Use for single request only
5. Memory cleared after use

### Tenant Isolation

**Company-Level Scoping**:

- All requests filtered by `companyId` → `prisma/schema.prisma:1062`
- Certificate unique per `[companyId, environment]` → line 1028
- Server actions require `requireCompany()` → `src/app/actions/fiscal-certificate.ts:30, 75, 152, 205, 238`
- Cron processor enforces company context → `src/app/api/cron/fiscal-processor/route.ts:56-58`

### Authentication

**Cron Endpoint** → `src/app/api/cron/fiscal-processor/route.ts:12-15`:

- Bearer token authentication
- `CRON_SECRET` environment variable
- 401 Unauthorized if missing/invalid

**User Actions**:

- `requireAuth()` validates session → `src/app/actions/fiscal-certificate.ts:29, 74, 151, 204, 237`
- `requireCompany()` validates company membership → line 30, 75, 152, 205, 238

### Certificate Validation

**Upload Validation** → `src/lib/fiscal/certificate-parser.ts`:

- P12 parsing with password
- X.509 certificate extraction
- OIB extraction from subject DN
- Validity period check
- Environment-specific validation (TEST vs PROD issuers)

**Runtime Validation** → `src/lib/fiscal/fiscal-pipeline.ts:31-37`:

- Status must be ACTIVE
- Not expired (`certNotAfter > now`)
- Checked before every fiscalization

### Audit Trail

**Operations Logged** → `src/app/actions/fiscal-certificate.ts`:

- Certificate upload → line 119-137
- Certificate deletion → line 178-190
- Manual fiscalization → line 270-275

**Audit Fields**:

- `companyId`: Tenant context
- `userId`: User who performed action
- `action`: Operation type (CREATE/DELETE)
- `entity`: FiscalCertificate or FiscalRequest
- `changes`: JSON metadata (operation, environment, certSerial, etc.)

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication and company context
  - [[invoicing-create]] - Invoice creation before fiscalization
  - [[e-invoicing-send]] - Automatic fiscalization trigger
  - CIS infrastructure (Croatian Tax Authority endpoints)
  - Certificate Authority (for P12 digital certificates)
  - Cron scheduler (Vercel Cron or similar)
- **Depended by**:
  - [[invoicing-view]] - Display fiscal status and JIR/ZKI
  - [[invoicing-pdf]] - Include fiscal codes on PDF
  - [[reports-vat]] - VAT reporting with fiscalization data
  - [[dashboard-recent-activity]] - Show fiscal events

## Integrations

### Croatian Tax Authority (CIS)

**Endpoints**:

- TEST: `cistest.apis-it.hr:8449/FiskalizacijaServiceTest`
- PROD: `cis.porezna-uprava.hr:8449/FiskalizacijaService`

**Protocol**: SOAP 1.2 over HTTPS

**Authentication**: X.509 certificate (mutual TLS)

**Message Types**:

- RacunZahtjev (Invoice Request)
- RacunOdgovor (Invoice Response)
- StornoZahtjev (Reversal Request - uses RacunZahtjev with negative amounts)

**Response Codes**:

- JIR: Jedinstveni Identifikator Računa (Unique Invoice Identifier)
- Error codes: `t001-t099` (temporary), `p001-p999` (permanent)

### Cron Infrastructure

**Scheduling**:

- External cron job calls `/api/cron/fiscal-processor`
- Recommended: Every 1-5 minutes
- Vercel Cron example: `0 * * * *` (every minute)

**Endpoint**:

- Path: `/api/cron/fiscal-processor`
- Method: GET
- Auth: Bearer token with `CRON_SECRET`
- Timeout: 60 seconds

**Worker Coordination**:

- Multiple workers supported
- Row-level locking prevents conflicts
- Worker ID for debugging
- Stale lock recovery

### Certificate Providers

**Digital Certificates**:

- Issued by Croatian Financial Agency (FINA)
- Format: PKCS#12 (.p12 or .pfx)
- Contains: RSA private key + X.509 certificate
- Password-protected

**Validation**:

- OIB embedded in certificate subject DN
- Environment-specific issuers (TEST vs PROD)
- Expiration monitoring

## User Experience

### Loading States

**Manual Fiscalization** → `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:21, 154`:

- Button disabled during request
- Text: "Slanje..." while processing
- Prevents double-submission

**Status Polling**:

- No active polling (relies on page refresh)
- User can manually refresh to see updates
- Background processor updates status async

### Success States

**After Queue** → line 160-161:

- Toast: "Fiskalizacija je dodana u red čekanja"
- Page refresh shows PENDING status
- Status badge updates to "U redu čekanja"

**After Completion**:

- Status badge shows green "Fiskalizirano"
- JIR and ZKI displayed
- Timestamp shown
- No further actions available

### Error States

**Failed Fiscalization** → line 78-107:

- Red badge: "Neuspjela fiskalizacija"
- Error message displayed
- Error code shown (if available)
- Attempt count: "2/5"
- Retry button enabled

**No Certificate** → line 136-148:

- Outline badge: "Nije fiskalizirano"
- Message: "Certifikat nije konfiguriran"
- No action button
- Link to settings implied

### Confirmation Dialogs

**Manual Fiscalization** → line 153:

- Dialog: "Fiskalizirati ovaj račun?"
- OK/Cancel options
- Prevents accidental fiscalization

**Certificate Deletion**:

- Dialog: "Jeste li sigurni?"
- Blocked if pending requests
- Shows count of pending requests

## Environment Configuration

Required environment variables:

```env
# Fiscal Certificate Encryption Key
FISCAL_CERT_KEY=generate_with_openssl_rand_hex_32

# Cron Job Authentication
CRON_SECRET=generate_with_openssl_rand_hex_32

# Fiscal Environment (per company setting)
# Stored in Company.fiscalEnvironment: TEST | PROD
```

Configuration locations:

- Certificate key: `.env.example` (referenced in encryption module)
- Cron secret: `.env.example:39-40`
- Fiscal environment: Database per-company setting

## Performance

### Batch Processing

- Batch size: 10 concurrent requests → `src/app/api/cron/fiscal-processor/route.ts:17`
- Row-level locking: `FOR UPDATE SKIP LOCKED` → line 41
- Multiple workers supported (horizontal scaling)

### Timeout Management

- CIS request timeout: 30 seconds → `src/lib/fiscal/porezna-client.ts:33`
- Cron route timeout: 60 seconds → `src/app/api/cron/fiscal-processor/route.ts:8`
- Stale lock recovery: 5 minutes → line 213

### Query Optimization

- Index on `[status, nextRetryAt]` for job queue → `prisma/schema.prisma:1061`
- Index on `[companyId]` for tenant filtering → line 1062
- Index on `[invoiceId]` for invoice lookup → line 1063

## Verification Checklist

- [x] Company can enable fiscalization
- [x] Certificate upload validates P12 and password
- [x] Certificate stored with envelope encryption
- [x] Private key never exposed in plaintext
- [x] TEST and PROD environments separate
- [x] Certificate expiration validated before use
- [x] CASH payment method queues fiscal request
- [x] CARD payment method queues fiscal request
- [x] TRANSACTION payment method skips fiscalization
- [x] Idempotency prevents duplicate requests
- [x] ZKI calculated with RSA-SHA256 signature
- [x] Fiscal XML includes all required fields
- [x] XML digitally signed with X.509 certificate
- [x] SOAP envelope submitted to CIS endpoint
- [x] JIR extracted from successful response
- [x] Error codes classified as retriable/permanent
- [x] Exponential backoff for retriable errors
- [x] Network errors trigger automatic retry
- [x] Server errors (5xx) are retriable
- [x] Client errors (4xx) are non-retriable
- [x] Porezna temporary errors (t0XX) retriable
- [x] Porezna permanent errors (p0XX) non-retriable
- [x] Max 5 retry attempts enforced
- [x] Stale locks recovered after 5 minutes
- [x] Invoice updated with JIR after success
- [x] Invoice fiscalStatus synchronized
- [x] Fiscal status badge shows current state
- [x] Manual fiscalization button available
- [x] Retry button for failed requests
- [x] Error messages displayed to user
- [x] Confirmation dialog for manual fiscalization
- [x] Settings page shows certificates
- [x] Recent requests displayed with status
- [x] Tenant isolation enforced throughout
- [x] Cron endpoint requires authentication
- [x] Audit log created for certificate operations
- [x] Certificate deletion blocked if pending requests

## Evidence Links

1. `src/lib/fiscal/should-fiscalize.ts:1-131` - Fiscalization decision engine and queue management
2. `src/lib/fiscal/fiscal-pipeline.ts:1-165` - Core pipeline: certificate → sign → submit → parse
3. `src/lib/fiscal/xml-builder.ts:1-193` - Fiscal XML generation (RacunZahtjev and Storno)
4. `src/lib/e-invoice/zki.ts:1-125` - ZKI calculation with RSA-SHA256 signature
5. `src/lib/fiscal/xml-signer.ts:1-50` - Digital signature with X.509 certificate
6. `src/lib/fiscal/porezna-client.ts:1-160` - SOAP client for CIS endpoints
7. `src/app/api/cron/fiscal-processor/route.ts:1-226` - Background processor with retry logic
8. `src/app/actions/fiscal-certificate.ts:1-278` - Certificate management and manual fiscalization
9. `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:1-165` - UI component for fiscal status
10. `src/app/(dashboard)/settings/fiscalisation/page.tsx:1-59` - Certificate settings page
11. `src/app/actions/e-invoice.ts:199-216` - Automatic fiscalization after e-invoice send
12. `prisma/schema.prisma:1033-1063` - FiscalRequest table schema
13. `prisma/schema.prisma:1007-1031` - FiscalCertificate table schema
14. `prisma/schema.prisma:191-259` - EInvoice fiscal fields
15. `src/lib/fiscal/envelope-encryption.ts` - Certificate encryption implementation
16. `src/lib/fiscal/certificate-parser.ts` - P12 parsing and validation
17. `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx` - Certificate card UI
18. `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx` - Status panel UI
19. `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx` - Upload dialog UI
20. `src/app/(dashboard)/invoices/[id]/page.tsx` - Invoice detail page with fiscal status
21. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx` - Invoice actions component
22. `docs/FISCALIZATION-INTEGRATION.md:1-150` - Integration guide and examples
23. `src/lib/fiscal/utils.ts` - Utility functions for amount/date formatting
24. `.env.example` - Environment variable configuration template
