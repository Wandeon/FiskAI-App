# Feature: Fiscal Certificate Management

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 24

## Purpose

Enables multi-tenant Croatian fiscalization (Fiskalizacija 1.0) by allowing companies to upload, manage, and securely store FINA certificates containing their OIB for signing cash and B2C invoices. The feature implements envelope encryption for certificate security, PFX/P12 parsing for certificate extraction, expiry tracking with visual warnings, and automatic certificate usage tracking. Supports separate TEST and PROD environments with OIB validation, certificate status management, and integration with the fiscal request queue for automated invoice fiscalization.

## User Entry Points

| Type | Path                        | Evidence                                                                      |
| ---- | --------------------------- | ----------------------------------------------------------------------------- |
| Page | /settings/fiscalisation     | `src/app/(dashboard)/settings/fiscalisation/page.tsx:7`                       |
| UI   | Certificate Upload Dialog   | `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:32` |
| UI   | Certificate Card            | `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:18`          |
| UI   | Fiscal Status Panel         | `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:77`       |
| API  | Validate Certificate Action | `src/app/actions/fiscal-certificate.ts:26`                                    |
| API  | Save Certificate Action     | `src/app/actions/fiscal-certificate.ts:71`                                    |
| API  | Delete Certificate Action   | `src/app/actions/fiscal-certificate.ts:147`                                   |

## Core Flow

### Certificate Upload Flow

1. User navigates to fiscalisation settings page → `src/app/(dashboard)/settings/fiscalisation/page.tsx:7-59`
2. System displays TEST and PROD certificate cards with current status → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:18-229`
3. User clicks "Upload Certificate" button for environment → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:181-186`
4. Certificate upload dialog opens with 3-step wizard → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:32-437`
5. User drags/drops P12/PFX file (max 50KB) → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:62-91`
6. System validates file extension (.p12 or .pfx) → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:72-77`
7. User enters certificate password → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:286-297`
8. User clicks "Next" to validate certificate → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:93-137`
9. Client converts file to base64 using ArrayBuffer → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:22-30, 104-108`
10. Server parses P12 using node-forge → `src/lib/fiscal/certificate-parser.ts:17-60`
11. System extracts OIB from certificate subject fields → `src/lib/fiscal/certificate-parser.ts:62-85`
12. System validates certificate dates and OIB checksum → `src/lib/fiscal/certificate-parser.ts:87-119`
13. Server returns certificate details (subject, OIB, serial, validity) → `src/app/actions/fiscal-certificate.ts:50-61`
14. Dialog displays certificate information for verification → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:310-341`
15. User confirms certificate details via checkbox → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:343-356`
16. User clicks "Save Certificate" → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:139-183`
17. System generates random data key for envelope encryption → `src/lib/fiscal/envelope-encryption.ts:15-54`
18. System encrypts P12 and password with AES-256-GCM → `src/lib/fiscal/envelope-encryption.ts:26-31`
19. System encrypts data key with master key → `src/lib/fiscal/envelope-encryption.ts:34-40`
20. Certificate record upserted to database with encrypted data → `src/app/actions/fiscal-certificate.ts:87-120`
21. Audit log created for certificate upload operation → `src/app/actions/fiscal-certificate.ts:122-137`
22. Page revalidated to show updated certificate → `src/app/actions/fiscal-certificate.ts:139`
23. Success toast displayed to user → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:164`
24. Dialog transitions to "Done" step with confirmation → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:369-379`

### Certificate Usage Flow

1. Invoice finalized with cash payment method → `src/lib/fiscal/should-fiscalize.ts:1-131`
2. System checks if fiscalization enabled for company → `src/lib/fiscal/should-fiscalize.ts:1-131`
3. System validates payment method requires fiscalization → `src/lib/fiscal/should-fiscalize.ts:1-131`
4. System finds active certificate for environment → `src/lib/fiscal/should-fiscalize.ts:1-131`
5. Fiscal request queued with certificate ID → `src/lib/fiscal/should-fiscalize.ts:1-131`
6. Cron processor acquires request with row locking → Via external cron job (not in codebase)
7. Pipeline loads and decrypts certificate → `src/lib/fiscal/fiscal-pipeline.ts:23-48`
8. System parses P12 and extracts private key → `src/lib/fiscal/certificate-parser.ts:17-60`
9. XML invoice request built with certificate OIB → `src/lib/fiscal/fiscal-pipeline.ts:64-82`
10. XML signed using certificate private key → `src/lib/fiscal/xml-signer.ts:10-43`
11. Signed XML submitted to Porezna endpoint → `src/lib/fiscal/fiscal-pipeline.ts:101`
12. Certificate lastUsedAt timestamp updated → `src/lib/fiscal/fiscal-pipeline.ts:110-113`
13. JIR received and stored in request and invoice → `src/lib/fiscal/fiscal-pipeline.ts:115-121`

### Certificate Deletion Flow

1. User clicks "Delete" button on certificate card → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:160-165`
2. Confirmation dialog displayed with warning → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:200-226`
3. System checks for pending fiscal requests → `src/app/actions/fiscal-certificate.ts:154-167`
4. If pending requests exist, deletion blocked with error → `src/app/actions/fiscal-certificate.ts:162-167`
5. Certificate record deleted from database → `src/app/actions/fiscal-certificate.ts:169-176`
6. Audit log created for deletion → `src/app/actions/fiscal-certificate.ts:178-190`
7. Page revalidated to update UI → `src/app/actions/fiscal-certificate.ts:192`

## Key Modules

| Module                    | Purpose                                         | Location                                                                          |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| FiscalisationSettingsPage | Main settings page with certificate overview    | `src/app/(dashboard)/settings/fiscalisation/page.tsx:7-59`                        |
| CertificateCard           | Certificate status display and management       | `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:18-291`          |
| CertificateUploadDialog   | 3-step wizard for certificate upload            | `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:32-437` |
| FiscalStatusPanel         | Recent requests table and stats dashboard       | `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:77-241`       |
| validateCertificateAction | Server action to parse and validate certificate | `src/app/actions/fiscal-certificate.ts:26-69`                                     |
| saveCertificateAction     | Server action to encrypt and store certificate  | `src/app/actions/fiscal-certificate.ts:71-145`                                    |
| deleteCertificateAction   | Server action to remove certificate             | `src/app/actions/fiscal-certificate.ts:147-198`                                   |
| retryFiscalRequestAction  | Server action to retry failed fiscal request    | `src/app/actions/fiscal-certificate.ts:200-251`                                   |
| manualFiscalizeAction     | Server action to manually queue fiscalization   | `src/app/actions/fiscal-certificate.ts:253-343`                                   |
| parseP12Certificate       | Parse PFX/P12 and extract certificate details   | `src/lib/fiscal/certificate-parser.ts:17-60`                                      |
| validateCertificate       | Validate certificate dates and OIB              | `src/lib/fiscal/certificate-parser.ts:87-106`                                     |
| encryptWithEnvelope       | Envelope encryption with random data key        | `src/lib/fiscal/envelope-encryption.ts:15-54`                                     |
| decryptWithEnvelope       | Decrypt certificate using master key            | `src/lib/fiscal/envelope-encryption.ts:56-87`                                     |
| executeFiscalRequest      | Full pipeline: decrypt, sign, submit            | `src/lib/fiscal/fiscal-pipeline.ts:19-128`                                        |
| signXML                   | XMLDSIG signing with certificate                | `src/lib/fiscal/xml-signer.ts:10-43`                                              |
| shouldFiscalizeInvoice    | Decision logic for fiscalization requirements   | `src/lib/fiscal/should-fiscalize.ts:1-131`                                        |

## Data

### Database Tables

- **Tables**: `FiscalCertificate`, `FiscalRequest`, `Company`, `EInvoice` → `prisma/schema.prisma:1007-1063`

### FiscalCertificate Model

Location: `prisma/schema.prisma:1007-1031`

Core fields:

- `id` (String, CUID): Primary key → `prisma/schema.prisma:1008`
- `companyId` (String): Company owner → `prisma/schema.prisma:1009`
- `environment` (FiscalEnv): TEST or PROD → `prisma/schema.prisma:1010`
- `provider` (String): Always "DIRECT" for FINA certificates → `prisma/schema.prisma:1011`
- `certSubject` (String): Certificate subject DN → `prisma/schema.prisma:1012`
- `certSerial` (String): Certificate serial number → `prisma/schema.prisma:1013`
- `certNotBefore` (DateTime): Validity start date → `prisma/schema.prisma:1014`
- `certNotAfter` (DateTime): Expiry date → `prisma/schema.prisma:1015`
- `oibExtracted` (String): OIB from certificate subject → `prisma/schema.prisma:1016`
- `certSha256` (String): Certificate fingerprint → `prisma/schema.prisma:1017`
- `encryptedP12` (Text): AES-256-GCM encrypted P12 data → `prisma/schema.prisma:1018`
- `encryptedDataKey` (String): Master-key encrypted data key → `prisma/schema.prisma:1019`
- `status` (CertStatus): PENDING/ACTIVE/EXPIRED/REVOKED → `prisma/schema.prisma:1020`
- `lastUsedAt` (DateTime, nullable): Last signing timestamp → `prisma/schema.prisma:1021`

Relations:

- `company` → Many-to-one with Company → `prisma/schema.prisma:1025`
- `fiscalRequests` → One-to-many with FiscalRequest → `prisma/schema.prisma:1026`

Constraints:

- Unique: `(companyId, environment)` → `prisma/schema.prisma:1028`
- Index: `companyId` → `prisma/schema.prisma:1029`
- Index: `status` → `prisma/schema.prisma:1030`

### FiscalRequest Model

Location: `prisma/schema.prisma:1033-1063`

Core fields:

- `id` (String, CUID): Primary key → `prisma/schema.prisma:1034`
- `companyId` (String): Company owner → `prisma/schema.prisma:1035`
- `certificateId` (String): Certificate used for signing → `prisma/schema.prisma:1036`
- `invoiceId` (String, nullable): Related invoice → `prisma/schema.prisma:1037`
- `messageType` (FiscalMessageType): RACUN/STORNO/PROVJERA → `prisma/schema.prisma:1038`
- `status` (FiscalStatus): QUEUED/PROCESSING/COMPLETED/FAILED/DEAD → `prisma/schema.prisma:1039`
- `attemptCount` (Int): Retry counter (default 0) → `prisma/schema.prisma:1040`
- `maxAttempts` (Int): Max retries (default 5) → `prisma/schema.prisma:1041`
- `nextRetryAt` (DateTime): Scheduled retry time → `prisma/schema.prisma:1042`
- `lockedAt` (DateTime, nullable): Row lock timestamp → `prisma/schema.prisma:1043`
- `lockedBy` (String, nullable): Worker ID holding lock → `prisma/schema.prisma:1044`
- `jir` (String, nullable): Jedinstveni Identifikator Računa → `prisma/schema.prisma:1045`
- `zki` (String, nullable): Zaštitni Kod Izdavatelja → `prisma/schema.prisma:1046`
- `errorCode` (String, nullable): Porezna error code → `prisma/schema.prisma:1047`
- `errorMessage` (String, nullable): Error description → `prisma/schema.prisma:1048`
- `lastHttpStatus` (Int, nullable): Last HTTP response code → `prisma/schema.prisma:1049`
- `requestXml` (Text, nullable): Built XML before signing → `prisma/schema.prisma:1050`
- `signedXml` (Text, nullable): Signed XML with XMLDSIG → `prisma/schema.prisma:1051`
- `responseXml` (Text, nullable): Porezna response XML → `prisma/schema.prisma:1052`

Relations:

- `company` → Many-to-one with Company → `prisma/schema.prisma:1056`
- `certificate` → Many-to-one with FiscalCertificate → `prisma/schema.prisma:1057`
- `invoice` → Many-to-one with EInvoice (nullable) → `prisma/schema.prisma:1058`

Constraints:

- Unique: `(companyId, invoiceId, messageType)` for idempotency → `prisma/schema.prisma:1060`
- Index: `(status, nextRetryAt)` for queue processing → `prisma/schema.prisma:1061`
- Index: `companyId` → `prisma/schema.prisma:1062`
- Index: `invoiceId` → `prisma/schema.prisma:1063`

### Enums

Location: `prisma/schema.prisma:981-1005`

**FiscalEnv** (Environment selector):

- `TEST`: FINA test environment → `prisma/schema.prisma:982`
- `PROD`: Production environment → `prisma/schema.prisma:983`

**CertStatus** (Certificate lifecycle):

- `PENDING`: Uploaded but not yet verified → `prisma/schema.prisma:987`
- `ACTIVE`: Valid and ready for use → `prisma/schema.prisma:988`
- `EXPIRED`: Past expiry date → `prisma/schema.prisma:989`
- `REVOKED`: Manually revoked → `prisma/schema.prisma:990`

**FiscalStatus** (Request queue state):

- `QUEUED`: Waiting for processing → `prisma/schema.prisma:994`
- `PROCESSING`: Currently being handled → `prisma/schema.prisma:995`
- `COMPLETED`: Successfully fiscalized → `prisma/schema.prisma:996`
- `FAILED`: Retriable error occurred → `prisma/schema.prisma:997`
- `DEAD`: Permanent failure, no retry → `prisma/schema.prisma:998`

**FiscalMessageType** (Fiscalization message):

- `RACUN`: Standard invoice → `prisma/schema.prisma:1002`
- `STORNO`: Cancellation invoice → `prisma/schema.prisma:1003`
- `PROVJERA`: Verification request → `prisma/schema.prisma:1004`

### Company Fields

Added fiscal configuration → `prisma/schema.prisma:87-90`:

- `fiscalEnabled` (Boolean): Fiscalization feature toggle → `prisma/schema.prisma:87`
- `fiscalEnvironment` (FiscalEnv): TEST or PROD (default PROD) → `prisma/schema.prisma:88`
- `premisesCode` (String): Business premises code (default "1") → `prisma/schema.prisma:89`
- `deviceCode` (String): POS device code (default "1") → `prisma/schema.prisma:90`

### EInvoice Fields

Added fiscal tracking → `prisma/migrations/20251215081318_add_fiscal_certificates/migration.sql:19-21`:

- `fiscalStatus` (String, nullable): PENDING/COMPLETED/FAILED
- `operatorOib` (String, nullable): Operator OIB for invoice

## Certificate Parsing

### P12/PFX Format

The system supports PKCS#12 format certificates → `src/lib/fiscal/certificate-parser.ts:17-60`:

**Parsing Process**:

1. Convert buffer to ASN.1 DER format → `src/lib/fiscal/certificate-parser.ts:22`
2. Parse PKCS#12 with password → `src/lib/fiscal/certificate-parser.ts:23`
3. Extract certificate bag → `src/lib/fiscal/certificate-parser.ts:26-29`
4. Extract private key bag → `src/lib/fiscal/certificate-parser.ts:27-30`
5. Validate both certificate and key exist → `src/lib/fiscal/certificate-parser.ts:32-34`

**OIB Extraction** → `src/lib/fiscal/certificate-parser.ts:62-85`:

Tries multiple certificate fields in order:

1. serialNumber field (OID 2.5.4.5) - most common → `src/lib/fiscal/certificate-parser.ts:64-68`
2. CN (Common Name) field → `src/lib/fiscal/certificate-parser.ts:71-75`
3. OU (Organizational Unit) field → `src/lib/fiscal/certificate-parser.ts:78-82`

Extracts first 11-digit sequence matching OIB pattern → `src/lib/fiscal/certificate-parser.ts:66, 73, 80`

**OIB Validation** → `src/lib/fiscal/certificate-parser.ts:108-119`:

Implements MOD-11 checksum algorithm:

- Must be exactly 11 digits → `src/lib/fiscal/certificate-parser.ts:109`
- Calculates checksum using weighted sum → `src/lib/fiscal/certificate-parser.ts:111-116`
- Validates last digit matches calculated control → `src/lib/fiscal/certificate-parser.ts:118`

**Certificate Fingerprint** → `src/lib/fiscal/certificate-parser.ts:46-47`:

SHA-256 hash of certificate DER encoding:

- Converts certificate to ASN.1 DER → `src/lib/fiscal/certificate-parser.ts:46`
- Computes SHA-256 hash → `src/lib/fiscal/certificate-parser.ts:47`
- Used for certificate uniqueness verification

**PEM Conversion** → `src/lib/fiscal/certificate-parser.ts:130-138`:

Converts node-forge objects to PEM format:

- Private key to PEM → `src/lib/fiscal/certificate-parser.ts:135`
- Certificate to PEM → `src/lib/fiscal/certificate-parser.ts:136`
- Required for XML signing → `src/lib/fiscal/xml-signer.ts:10-43`

## Encryption Architecture

### Envelope Encryption

Implements two-layer encryption for defense in depth → `src/lib/fiscal/envelope-encryption.ts:15-87`:

**Layer 1: Data Encryption**

- Random 32-byte data key generated per certificate → `src/lib/fiscal/envelope-encryption.ts:22`
- Random 12-byte IV for AES-256-GCM → `src/lib/fiscal/envelope-encryption.ts:23`
- P12 + password encrypted with data key → `src/lib/fiscal/envelope-encryption.ts:26-31`
- Auth tag generated for integrity → `src/lib/fiscal/envelope-encryption.ts:31`
- Format: `{iv}:{ciphertext}:{tag}` → `src/lib/fiscal/envelope-encryption.ts:43-47`

**Layer 2: Key Encryption**

- Master key loaded from environment variable → `src/lib/fiscal/envelope-encryption.ts:7-13`
- Data key encrypted with master key → `src/lib/fiscal/envelope-encryption.ts:34-40`
- Separate IV and auth tag for key encryption → `src/lib/fiscal/envelope-encryption.ts:34, 40`
- Format: `{iv}:{encryptedKey}:{tag}` → `src/lib/fiscal/envelope-encryption.ts:48-52`

**Decryption Process** → `src/lib/fiscal/envelope-encryption.ts:56-87`:

1. Parse encrypted data key components → `src/lib/fiscal/envelope-encryption.ts:63`
2. Decrypt data key using master key → `src/lib/fiscal/envelope-encryption.ts:64-73`
3. Parse encrypted data components → `src/lib/fiscal/envelope-encryption.ts:76`
4. Decrypt certificate data using data key → `src/lib/fiscal/envelope-encryption.ts:77-86`

**Security Properties**:

- Each certificate has unique data key (key rotation) → `src/lib/fiscal/envelope-encryption.ts:22`
- Master key never touches database → `src/lib/fiscal/envelope-encryption.ts:7-13`
- AES-256-GCM provides authenticated encryption → `src/lib/fiscal/envelope-encryption.ts:5`
- IV randomization prevents pattern analysis → `src/lib/fiscal/envelope-encryption.ts:23, 34`

### Master Key Management

Environment variable: `FISCAL_CERT_KEY` → `src/lib/fiscal/envelope-encryption.ts:4`

Requirements:

- Must be exactly 64 hexadecimal characters → `src/lib/fiscal/envelope-encryption.ts:9`
- Represents 32 bytes (256 bits) → `src/lib/fiscal/envelope-encryption.ts:10`
- Generated via: `openssl rand -hex 32` → `docs/plans/2025-12-15-fiscal-certificates.md:279`

Error handling:

- Throws if missing or wrong length → `src/lib/fiscal/envelope-encryption.ts:8-11`
- Prevents startup with invalid configuration

## Certificate Status Management

### Status Transitions

Valid transitions → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:235-250`:

1. **PENDING** → Never used in current implementation, defaults to ACTIVE → `src/app/actions/fiscal-certificate.ts:106`
2. **ACTIVE** → Normal operational state → `src/app/actions/fiscal-certificate.ts:106, 117`
3. **EXPIRED** → Automatically determined by date check → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:245`
4. **REVOKED** → Not currently implemented (reserved for future)

### Status Display

Visual indicators → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:252-264`:

**Active Certificate**:

- Green shield check icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:255`
- "ACTIVE" badge (green) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:64-69`

**Expiring Soon** (≤30 days):

- Yellow shield alert icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:257`
- "EXPIRING-SOON" badge (yellow) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:70`
- Days remaining counter → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:124-128`

**Expired Certificate**:

- Red shield alert icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:259`
- "EXPIRED" badge (red) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:65`
- Days since expiry counter → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:129-133`

**Revoked Certificate**:

- Red shield alert icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:260`
- "REVOKED" badge (red) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:65`

**No Certificate**:

- Gray shield icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:262`
- Upload prompt displayed → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:169-187`

### Expiry Calculation

Days until expiry → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:286-291`:

- Calculates millisecond difference from now → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:289`
- Converts to days using `Math.ceil` → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:290`
- Negative values indicate expired certificate

Expiry thresholds:

- **30 days**: Triggers "expiring soon" warning → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:246`
- **0 days**: Certificate expired, unusable → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:245`

## Validation & Security

### Upload Validation

Client-side checks → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:62-81`:

- File size limit: 50KB maximum → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:67-70`
- File extension: .p12 or .pfx only → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:73-77`
- MIME type: application/x-pkcs12 → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:86`

Server-side validation → `src/app/actions/fiscal-certificate.ts:35-44`:

- Size limit re-checked (50KB) → `src/app/actions/fiscal-certificate.ts:35-37`
- P12 parsing with password → `src/app/actions/fiscal-certificate.ts:39`
- Certificate validation (dates, OIB) → `src/app/actions/fiscal-certificate.ts:41-44`

### Certificate Validation

Validation rules → `src/lib/fiscal/certificate-parser.ts:87-106`:

**Expiry Check**:

- Reject if `notAfter < now` → `src/lib/fiscal/certificate-parser.ts:93-95`
- Prevents use of expired certificates

**Not Yet Valid Check**:

- Reject if `notBefore > now` → `src/lib/fiscal/certificate-parser.ts:97-99`
- Prevents premature certificate use

**OIB Validation**:

- Must pass MOD-11 checksum → `src/lib/fiscal/certificate-parser.ts:101-103`
- Ensures OIB is mathematically valid

**Environment Validation**:

- Parameter passed but not currently enforced → `src/lib/fiscal/certificate-parser.ts:89`
- Reserved for future TEST/PROD cert type validation

### OIB Mismatch Handling

Warning displayed when certificate OIB ≠ company OIB → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:84-95`:

- Yellow warning banner → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:85`
- Shows both OIBs for comparison → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:90`
- Warns fiscalization will fail → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:91`
- Does NOT block upload (allows testing) → `src/app/actions/fiscal-certificate.ts:46-48`
- Logs warning to console → `src/app/actions/fiscal-certificate.ts:47`

### Runtime Validation

Pre-signing checks → `src/lib/fiscal/fiscal-pipeline.ts:23-37`:

**Certificate Existence**:

- Throws if certificate not found → `src/lib/fiscal/fiscal-pipeline.ts:27-29`
- Error code: `p001`

**Certificate Status**:

- Must be ACTIVE → `src/lib/fiscal/fiscal-pipeline.ts:31-33`
- Error code: `p002`

**Certificate Expiry**:

- Checked again before each use → `src/lib/fiscal/fiscal-pipeline.ts:35-37`
- Error code: `p003`

## Fiscal Request Lifecycle

### Request States

State machine → `prisma/schema.prisma:993-999`:

**QUEUED**: Initial state, waiting for worker → `prisma/schema.prisma:994`

- Created when invoice finalized
- `nextRetryAt` set to now for immediate processing
- No lock held

**PROCESSING**: Currently being handled by worker → `prisma/schema.prisma:995`

- `lockedAt` timestamp set
- `lockedBy` contains worker ID
- Prevents concurrent processing

**COMPLETED**: Successfully fiscalized → `prisma/schema.prisma:996`

- `jir` field populated
- `responseXml` contains success response
- Lock released

**FAILED**: Retriable error occurred → `prisma/schema.prisma:997`

- `attemptCount` incremented
- `nextRetryAt` calculated with exponential backoff
- `errorCode` and `errorMessage` populated
- Lock released for retry

**DEAD**: Permanent failure, no more retries → `prisma/schema.prisma:998`

- `attemptCount` reached `maxAttempts`
- Or non-retriable error (validation failure)
- Manual intervention required

### Retry Logic

Exponential backoff strategy (planned for cron processor):

- **Attempt 1**: 30 seconds → `docs/plans/2025-12-15-fiscal-certificates.md:1530-1532`
- **Attempt 2**: 2 minutes (30s × 4)
- **Attempt 3**: 8 minutes (30s × 16)
- **Attempt 4**: 32 minutes (30s × 64)
- **Attempt 5**: 2 hours (max cap)

Jitter: ±10% random variation → `docs/plans/2025-12-15-fiscal-certificates.md:1536`

### Manual Retry

User-initiated retry → `src/app/actions/fiscal-certificate.ts:200-251`:

**Conditions**:

- Request must be in FAILED or DEAD status → `src/app/actions/fiscal-certificate.ts:215-217`
- User must own the company → `src/app/actions/fiscal-certificate.ts:207-213`

**Reset Process**:

- Status set to QUEUED → `src/app/actions/fiscal-certificate.ts:222`
- `attemptCount` reset to 0 → `src/app/actions/fiscal-certificate.ts:223`
- `nextRetryAt` set to now → `src/app/actions/fiscal-certificate.ts:224`
- Error fields cleared → `src/app/actions/fiscal-certificate.ts:225-226`
- Lock released → `src/app/actions/fiscal-certificate.ts:227-228`

**UI Feedback**:

- Retry button shown for FAILED/DEAD requests → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:203-222`
- Loading spinner during retry → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:211-214`
- Toast notification on success/failure → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:85-87`

## XML Signing

### XMLDSIG Implementation

Uses xml-crypto library for signing → `src/lib/fiscal/xml-signer.ts:10-43`:

**Signature Configuration**:

- Algorithm: RSA-SHA256 → `src/lib/fiscal/xml-signer.ts:14`
- Canonicalization: Exclusive C14N → `src/lib/fiscal/xml-signer.ts:15`
- Private key from certificate → `src/lib/fiscal/xml-signer.ts:12`
- Public cert embedded in signature → `src/lib/fiscal/xml-signer.ts:13`

**Reference Configuration** → `src/lib/fiscal/xml-signer.ts:25-32`:

- XPath: `//*[@Id='RacunZahtjev']` → `src/lib/fiscal/xml-signer.ts:26`
- Digest: SHA256 → `src/lib/fiscal/xml-signer.ts:27`
- Transforms:
  - Enveloped signature → `src/lib/fiscal/xml-signer.ts:29`
  - Exclusive C14N → `src/lib/fiscal/xml-signer.ts:30`

**KeyInfo Element** → `src/lib/fiscal/xml-signer.ts:17-21`:

- Contains X509Certificate
- Certificate base64 extracted from PEM → `src/lib/fiscal/xml-signer.ts:45-50`
- Allows Porezna to verify signature

**Signature Placement** → `src/lib/fiscal/xml-signer.ts:35-39`:

- Appended to RacunZahtjev element
- Uses XPath to locate insertion point

### Certificate to PEM

PEM format required for signing → `src/lib/fiscal/certificate-parser.ts:130-138`:

**Private Key PEM**:

- Extracted from P12 key bag → `src/lib/fiscal/certificate-parser.ts:32-34`
- Converted using node-forge → `src/lib/fiscal/certificate-parser.ts:135`
- Format: `-----BEGIN RSA PRIVATE KEY-----`

**Certificate PEM**:

- Extracted from P12 cert bag → `src/lib/fiscal/certificate-parser.ts:29`
- Converted using node-forge → `src/lib/fiscal/certificate-parser.ts:136`
- Format: `-----BEGIN CERTIFICATE-----`

**Certificate Base64** → `src/lib/fiscal/xml-signer.ts:45-50`:

- Strips PEM headers and footers
- Removes whitespace
- Used for X509Certificate element in signature

## Fiscal Status Monitoring

### Status Panel

Real-time monitoring dashboard → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:77-241`:

**Statistics Summary** → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:119-141`:

- Card for each status (QUEUED, PROCESSING, COMPLETED, FAILED, DEAD)
- Count derived from aggregated stats → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:111-114`
- Color-coded icons → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:39-75`
- Background colors match status severity

**Status Icons** → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:39-75`:

- QUEUED: Clock (yellow) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:40-46`
- PROCESSING: Loader2 spinning (blue) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:47-53`
- COMPLETED: CheckCircle2 (green) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:54-60`
- FAILED: XCircle (red) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:61-67`
- DEAD: Skull (gray) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:68-74`

### Recent Requests Table

Displays last 20 requests → `src/app/(dashboard)/settings/fiscalisation/page.tsx:18-23`:

**Columns**:

- Invoice number → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:169-171`
- Message type (RACUN/STORNO/PROVJERA) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:172-176`
- Status badge → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:177-182`
- JIR (truncated to 8 chars) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:183-191`
- Attempt count / max attempts → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:192-196`
- Updated timestamp → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:197-201`
- Actions (retry button for FAILED/DEAD) → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:202-232`

**Error Display**:

- Error message shown below actions → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:224-230`
- Truncated to 50 characters → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:226-227`
- Red text color → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:225`

### Data Loading

Parallel queries for efficiency → `src/app/(dashboard)/settings/fiscalisation/page.tsx:11-29`:

**Certificates**:

- TEST certificate lookup → `src/app/(dashboard)/settings/fiscalisation/page.tsx:12-14`
- PROD certificate lookup → `src/app/(dashboard)/settings/fiscalisation/page.tsx:15-17`
- Uses compound unique key `(companyId, environment)`

**Recent Requests**:

- Last 20 requests ordered by createdAt DESC → `src/app/(dashboard)/settings/fiscalisation/page.tsx:18-23`
- Includes invoice number for display
- Scoped to current company

**Statistics**:

- Grouped by status → `src/app/(dashboard)/settings/fiscalisation/page.tsx:24-28`
- Count per status
- Scoped to current company

## Integration Points

### Invoice Finalization

Fiscalization trigger → `src/lib/fiscal/should-fiscalize.ts:1-131`:

**Decision Criteria** (all must be true):

1. Company has fiscalization enabled → `src/lib/fiscal/should-fiscalize.ts:1-131`
2. Payment method is cash-equivalent (CASH, CARD, G, K) → `src/lib/fiscal/should-fiscalize.ts:1-131`
3. Invoice not already fiscalized (no JIR) → `src/lib/fiscal/should-fiscalize.ts:1-131`
4. No pending request exists → `src/lib/fiscal/should-fiscalize.ts:1-131`
5. Active certificate exists for environment → `src/lib/fiscal/should-fiscalize.ts:1-131`

**Queue Creation** → `src/lib/fiscal/should-fiscalize.ts:1-131`:

- Upsert to prevent duplicates → `src/lib/fiscal/should-fiscalize.ts:1-131`
- Unique constraint on `(companyId, invoiceId, messageType)` → `src/lib/fiscal/should-fiscalize.ts:1-131`
- Sets status to QUEUED → `src/lib/fiscal/should-fiscalize.ts:304, 310`
- Resets attempt counter → `src/lib/fiscal/should-fiscalize.ts:305, 311`
- Schedules for immediate processing → `src/lib/fiscal/should-fiscalize.ts:307, 313`

### Pipeline Execution

End-to-end processing → `src/lib/fiscal/fiscal-pipeline.ts:19-128`:

**Phase 1: Certificate Loading** → `src/lib/fiscal/fiscal-pipeline.ts:23-48`:

1. Load certificate from database → `src/lib/fiscal/fiscal-pipeline.ts:23-25`
2. Validate certificate status and expiry → `src/lib/fiscal/fiscal-pipeline.ts:27-37`
3. Decrypt P12 and password → `src/lib/fiscal/fiscal-pipeline.ts:40-44`
4. Parse P12 to extract keys → `src/lib/fiscal/fiscal-pipeline.ts:47`
5. Convert to PEM format → `src/lib/fiscal/fiscal-pipeline.ts:48`

**Phase 2: Invoice Loading** → `src/lib/fiscal/fiscal-pipeline.ts:51-64`:

1. Load invoice with lines and company → `src/lib/fiscal/fiscal-pipeline.ts:51-57`
2. Map to fiscal invoice structure → `src/lib/fiscal/fiscal-pipeline.ts:64, 130-165`
3. Extract VAT breakdown from line items → `src/lib/fiscal/fiscal-pipeline.ts:132-146`

**Phase 3: XML Building** → `src/lib/fiscal/fiscal-pipeline.ts:67-89`:

1. Build RACUN or STORNO XML → `src/lib/fiscal/fiscal-pipeline.ts:68-81`
2. Calculate ZKI (protective code) → Via xml-builder module
3. Store request XML → `src/lib/fiscal/fiscal-pipeline.ts:86-89`

**Phase 4: XML Signing** → `src/lib/fiscal/fiscal-pipeline.ts:92-98`:

1. Sign XML with certificate → `src/lib/fiscal/fiscal-pipeline.ts:92`
2. Store signed XML → `src/lib/fiscal/fiscal-pipeline.ts:95-98`

**Phase 5: Submission** → `src/lib/fiscal/fiscal-pipeline.ts:101-127`:

1. Submit to Porezna endpoint → `src/lib/fiscal/fiscal-pipeline.ts:101`
2. Store response XML → `src/lib/fiscal/fiscal-pipeline.ts:104-107`
3. Update certificate lastUsedAt → `src/lib/fiscal/fiscal-pipeline.ts:110-113`
4. Return JIR on success → `src/lib/fiscal/fiscal-pipeline.ts:115-121`
5. Throw with error code on failure → `src/lib/fiscal/fiscal-pipeline.ts:123-127`

## User Experience

### Upload Wizard

3-step process with progress indicator → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:210-245`:

**Step Indicator**:

- Visual progress circles → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:213-230`
- Active step highlighted in blue → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:217-218`
- Completed steps show green checkmark → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:225-227`
- Connecting lines between steps → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:231-241`

**Step 1: Upload** → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:248-306`:

- Drag & drop zone with hover effect → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:251-270`
- File validation on drop → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:62-81`
- Selected file preview with size → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:273-283`
- Password input field → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:286-297`
- Error display for validation failures → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:300-305`

**Step 2: Verify** → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:309-365`:

- Certificate details in read-only fields → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:312-341`
- Subject, OIB, Serial, Validity dates, Issuer
- Confirmation checkbox → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:344-355`
- Back button to edit file/password → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:403-414`

**Step 3: Done** → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:368-379`:

- Success icon (green checkmark) → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:371-373`
- Confirmation message → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:374-377`
- Close button → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:428-432`

### Certificate Display

Card layout for each environment → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:43-229`:

**Header Section**:

- Status icon (colored shield) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:48-60`
- Environment title (Test/Production) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:51-53`
- Environment description → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:54-58`
- Status badge → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:61-76`

**OIB Mismatch Warning** (if applicable):

- Yellow banner with alert icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:85-94`
- Shows both certificate and company OIB → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:90`

**Certificate Details**:

- Subject → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:99-102`
- OIB (monospace font) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:104-107`
- Serial number (monospace, small) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:109-112`
- Valid from date → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:114-117`
- Expiry date with countdown → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:119-136`
- Last used timestamp (if available) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:138-143`

**Action Buttons**:

- Replace button → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:148-156`
- Delete button (destructive) → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:157-165`

**Empty State** (no certificate):

- File key icon → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:171-173`
- Prompt message → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:175-177`
- Upload button → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:178-186`

### Loading States

Feedback during async operations:

**Upload Validation**:

- Spinner during certificate parsing → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:389-393`
- "Validating..." text → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:392`
- Disabled buttons and inputs → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:90, 385, 388`

**Certificate Save**:

- Spinner during encryption and save → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:417-420`
- "Saving..." text → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:419`
- Disabled form → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:415, 422`

**Delete Operation**:

- "Deleting..." button text → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:221`
- Disabled buttons during delete → `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:212, 219`

**Retry Request**:

- Spinner icon in button → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:212`
- "Retrying..." text → `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:214`

### Error Handling

User-friendly error messages:

**Upload Errors**:

- File too large → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:68`
- Invalid file type → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:75`
- Failed to read file → `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:129`

**Validation Errors**:

- Invalid password → `src/app/actions/fiscal-certificate.ts:64-66`
- Certificate expired → `src/lib/fiscal/certificate-parser.ts:93-95`
- Certificate not yet valid → `src/lib/fiscal/certificate-parser.ts:97-99`
- Invalid OIB checksum → `src/lib/fiscal/certificate-parser.ts:101-103`
- Failed to parse → `src/app/actions/fiscal-certificate.ts:67`

**Delete Errors**:

- Pending requests exist → `src/app/actions/fiscal-certificate.ts:162-167`
- Generic failure → `src/app/actions/fiscal-certificate.ts:196`

**Retry Errors**:

- Request not found → `src/app/actions/fiscal-certificate.ts:212-214`
- Invalid status for retry → `src/app/actions/fiscal-certificate.ts:215-217`

## Security Considerations

### Certificate Storage

Defense in depth approach:

**Database Layer**:

- Encrypted P12 stored as TEXT → `prisma/schema.prisma:1018`
- Encrypted data key stored separately → `prisma/schema.prisma:1019`
- Password never stored separately (bundled with P12)

**Encryption Layer**:

- Unique 256-bit data key per certificate → `src/lib/fiscal/envelope-encryption.ts:22`
- AES-256-GCM authenticated encryption → `src/lib/fiscal/envelope-encryption.ts:5`
- Random IV prevents pattern analysis → `src/lib/fiscal/envelope-encryption.ts:23, 34`
- Auth tags ensure integrity → `src/lib/fiscal/envelope-encryption.ts:31, 40`

**Key Management**:

- Master key in environment variable → `src/lib/fiscal/envelope-encryption.ts:4`
- Never persisted to disk or database
- Required at runtime for decryption
- Validated on startup → `src/lib/fiscal/envelope-encryption.ts:8-11`

### Access Control

Multi-layer authorization:

**Page Level**:

- Requires authenticated user → `src/app/(dashboard)/settings/fiscalisation/page.tsx:8`
- Requires company membership → `src/app/(dashboard)/settings/fiscalisation/page.tsx:9`

**Action Level**:

- All actions verify user auth → `src/app/actions/fiscal-certificate.ts:30, 75, 151, 204, 257`
- All actions verify company ownership → `src/app/actions/fiscal-certificate.ts:31, 76, 152, 205, 258`

**Data Scoping**:

- Certificates filtered by companyId → `src/app/(dashboard)/settings/fiscalisation/page.tsx:13, 16`
- Requests filtered by companyId → `src/app/(dashboard)/settings/fiscalisation/page.tsx:19, 25`

### Audit Logging

All certificate operations logged → `src/app/actions/fiscal-certificate.ts:122-137, 178-190`:

**Upload Event**:

- Action: CREATE → `src/app/actions/fiscal-certificate.ts:126`
- Entity: FiscalCertificate → `src/app/actions/fiscal-certificate.ts:127`
- Changes include: environment, serial, OIB, expiry → `src/app/actions/fiscal-certificate.ts:129-135`

**Delete Event**:

- Action: DELETE → `src/app/actions/fiscal-certificate.ts:182`
- Entity: FiscalCertificate → `src/app/actions/fiscal-certificate.ts:183`
- Changes include: environment → `src/app/actions/fiscal-certificate.ts:185-188`

**Retry Event**:

- Action: UPDATE → `src/app/actions/fiscal-certificate.ts:236`
- Entity: FiscalRequest → `src/app/actions/fiscal-certificate.ts:237`
- Metadata: REQUEST_RETRY operation → `src/app/actions/fiscal-certificate.ts:239-241`

### Runtime Security

Validation before certificate use:

**Pre-signing Checks** → `src/lib/fiscal/fiscal-pipeline.ts:27-37`:

- Certificate must exist in database
- Status must be ACTIVE
- Current date must be within validity period

**OIB Validation**:

- Extracted OIB validated with MOD-11 → `src/lib/fiscal/certificate-parser.ts:108-119`
- Company OIB mismatch logged → `src/app/actions/fiscal-certificate.ts:46-48`

**Decryption Safety**:

- Invalid master key prevents startup → `src/lib/fiscal/envelope-encryption.ts:8-11`
- Auth tag verification prevents tampering → `src/lib/fiscal/envelope-encryption.ts:69, 82`
- Decryption failure throws exception

## Dependencies

**Depends on**:

- [[auth-session]] - User authentication and company context → `src/app/(dashboard)/settings/fiscalisation/page.tsx:8-9`
- [[company-management]] - Company configuration and OIB → `prisma/schema.prisma:1009, 1025`
- [[e-invoicing]] - Invoice data for fiscalization → `prisma/schema.prisma:1037, 1058`
- node-forge - P12/PFX parsing and key extraction → `src/lib/fiscal/certificate-parser.ts:2`
- xml-crypto - XMLDSIG signing → `src/lib/fiscal/xml-signer.ts:2`

**Depended by**:

- [[fiscal-processing]] - Request queue processing (planned)
- [[invoice-fiscalization]] - Automatic fiscalization on finalize → `src/lib/fiscal/should-fiscalize.ts:1-131`
- [[fiscal-reporting]] - Certificate usage statistics (future)

## Environment Configuration

Required environment variables:

```env
# Master key for envelope encryption (32 bytes as 64 hex chars)
# Generate with: openssl rand -hex 32
FISCAL_CERT_KEY=<64-character-hex-string>
```

Configuration in: `.env.example` (planned)

## Future Enhancements

Planned but not yet implemented:

1. **Certificate Expiry Notifications**
   - Email alerts when certificate expires in <30 days
   - Dashboard warnings for expiring certificates

2. **Automatic Certificate Status Updates**
   - Background job to mark expired certificates
   - Auto-update status based on validity dates

3. **Certificate Renewal Reminders**
   - Proactive notifications before expiry
   - Renewal workflow guidance

4. **Multi-Premises Support**
   - Multiple premises codes per company
   - Certificate per premises/device

5. **Certificate Provider Integration**
   - Automatic download from FINA
   - Cloud HSM integration for enterprise

6. **Certificate Rotation**
   - Seamless transition to new certificate
   - Overlap period for old/new certs

## Evidence Links

1. `src/app/(dashboard)/settings/fiscalisation/page.tsx:7-59` - Main fiscalisation settings page
2. `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx:18-291` - Certificate display and management component
3. `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx:32-437` - 3-step upload wizard
4. `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx:77-241` - Request monitoring dashboard
5. `src/app/actions/fiscal-certificate.ts:26-69` - Validate certificate server action
6. `src/app/actions/fiscal-certificate.ts:71-145` - Save certificate server action
7. `src/app/actions/fiscal-certificate.ts:147-198` - Delete certificate server action
8. `src/app/actions/fiscal-certificate.ts:200-251` - Retry fiscal request server action
9. `src/app/actions/fiscal-certificate.ts:253-343` - Manual fiscalize server action
10. `src/lib/fiscal/certificate-parser.ts:17-60` - P12 certificate parsing
11. `src/lib/fiscal/certificate-parser.ts:62-85` - OIB extraction from certificate
12. `src/lib/fiscal/certificate-parser.ts:87-119` - Certificate validation and OIB checksum
13. `src/lib/fiscal/envelope-encryption.ts:15-54` - Envelope encryption with data key
14. `src/lib/fiscal/envelope-encryption.ts:56-87` - Envelope decryption
15. `src/lib/fiscal/fiscal-pipeline.ts:19-128` - End-to-end fiscalization pipeline
16. `src/lib/fiscal/xml-signer.ts:10-43` - XMLDSIG signature generation
17. `src/lib/fiscal/should-fiscalize.ts:1-131` - Fiscalization decision logic
18. `src/lib/fiscal/should-fiscalize.ts:1-131` - Queue fiscal request
19. `prisma/schema.prisma:1007-1031` - FiscalCertificate model definition
20. `prisma/schema.prisma:1033-1063` - FiscalRequest model definition
21. `prisma/schema.prisma:981-1005` - Fiscal enums (FiscalEnv, CertStatus, FiscalStatus, FiscalMessageType)
22. `prisma/migrations/20251215081318_add_fiscal_certificates/migration.sql:1-104` - Database migration
23. `docs/plans/2025-12-15-fiscal-certificates.md:1-2016` - Implementation plan and architecture
24. `src/lib/fiscal/utils.ts:1-21` - Fiscal utility functions
