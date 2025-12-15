# Feature: Email Settings

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Allows users to connect email accounts (Gmail or Microsoft Outlook) to automatically import bank statement attachments via OAuth2. Users configure import rules based on sender email, domain, subject, or filename patterns. Connected emails are synced via scheduled cron jobs that download matching attachments to R2 storage and create import jobs for OCR processing. The feature supports multiple email connections per company with granular rule-based filtering for automated document ingestion.

## User Entry Points

| Type | Path            | Evidence                                                  |
| ---- | --------------- | --------------------------------------------------------- |
| Page | /settings/email | `src/app/(dashboard)/settings/email/page.tsx:1`           |
| API  | Connect Email   | `src/app/api/email/connect/route.ts:8`                    |
| API  | OAuth Callback  | `src/app/api/email/callback/route.ts:8`                   |
| API  | Disconnect      | `src/app/api/email/[connectionId]/disconnect/route.ts:10` |
| API  | Import Rules    | `src/app/api/email/rules/route.ts:8,34`                   |
| Cron | Email Sync      | `src/app/api/cron/email-sync/route.ts:6`                  |

## Core Flow

### Email Connection Flow

1. User navigates to /settings/email -> `src/app/(dashboard)/settings/email/page.tsx:10-59`
2. Server loads existing email connections for company -> `src/app/(dashboard)/settings/email/page.tsx:21-28`
3. EmailConnectionList displays connected accounts with status -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:23-117`
4. User clicks "Connect Email" button -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:15-68`
5. Dropdown shows Gmail and Outlook options -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:50-65`
6. User selects provider (Gmail or Microsoft) -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:52,59`
7. Client calls /api/email/connect with provider -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:21-34`
8. Server validates provider configuration -> `src/app/api/email/connect/route.ts:23-28`
9. Server generates OAuth state with company ID -> `src/app/api/email/connect/route.ts:35-37`
10. Provider returns OAuth authorization URL -> `src/app/api/email/connect/route.ts:39`
11. User redirected to Google/Microsoft OAuth consent screen -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:34`
12. User grants email read permissions -> `src/lib/email-sync/providers/gmail.ts:7,src/lib/email-sync/providers/microsoft.ts:8`
13. OAuth provider redirects to /api/email/callback with code -> `src/app/api/email/callback/route.ts:8-95`
14. Server exchanges code for access/refresh tokens -> `src/app/api/email/callback/route.ts:37`
15. Server fetches user's email address from provider -> `src/app/api/email/callback/route.ts:40-58`
16. EmailConnection record created with encrypted tokens -> `src/app/api/email/callback/route.ts:63-88`
17. User redirected to /settings/email?success=connected -> `src/app/api/email/callback/route.ts:90`

### Import Rules Configuration Flow

1. Connected email displays with import rules section -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:108-111`
2. User clicks "+" to add new import rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:99-101`
3. Rule form displays with filter fields -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:105-147`
4. User configures filters (sender email, domain, subject, filename) -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:106-142`
5. User submits rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:32-56`
6. Client calls /api/email/rules with connectionId and filters -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:37-41`
7. Server validates connection belongs to company -> `src/app/api/email/rules/route.ts:51-60`
8. Server validates at least one filter provided -> `src/app/api/email/rules/route.ts:63-68`
9. EmailImportRule created in database -> `src/app/api/email/rules/route.ts:70-79`
10. Rule displays in list with toggle and delete controls -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:156-183`
11. User can toggle rule active/inactive -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:77-93`
12. User can delete rule -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:58-75`

### Automated Email Sync Flow

1. Vercel cron triggers /api/cron/email-sync daily at 5am -> `vercel.json:8-9`
2. Server validates CRON_SECRET authorization -> `src/app/api/cron/email-sync/route.ts:8-13`
3. syncAllConnections fetches all CONNECTED email accounts -> `src/lib/email-sync/sync-service.ts:233-240`
4. For each connection, syncEmailConnection processes messages -> `src/lib/email-sync/sync-service.ts:19-117`
5. Server checks if access token expired -> `src/lib/email-sync/sync-service.ts:37-55`
6. If expired, refreshes token using refresh token -> `src/lib/email-sync/sync-service.ts:40-54`
7. Provider fetches messages with attachments -> `src/lib/email-sync/sync-service.ts:58-93`
8. For each attachment, calculates content hash for deduplication -> `src/lib/email-sync/sync-service.ts:128-132`
9. Skips if attachment already processed -> `src/lib/email-sync/sync-service.ts:135-146`
10. Checks if attachment matches any active import rule -> `src/lib/email-sync/sync-service.ts:149-170`
11. Downloads attachment content from provider -> `src/lib/email-sync/sync-service.ts:173`
12. Uploads attachment to R2 storage -> `src/lib/email-sync/sync-service.ts:176-177`
13. Creates EmailAttachment record -> `src/lib/email-sync/sync-service.ts:182-198`
14. If matches rule and is PDF/image, creates ImportJob -> `src/lib/email-sync/sync-service.ts:201-228`
15. Updates sync cursor and last sync time -> `src/lib/email-sync/sync-service.ts:89-92,96-102`

### Email Disconnection Flow

1. User clicks trash icon on connected email -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:89`
2. Browser confirms disconnect action -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:28`
3. Client calls DELETE /api/email/{connectionId}/disconnect -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:34`
4. Server validates connection belongs to company -> `src/app/api/email/[connectionId]/disconnect/route.ts:21-30`
5. Server revokes OAuth access token with provider -> `src/app/api/email/[connectionId]/disconnect/route.ts:33-42`
6. Connection status updated to REVOKED -> `src/app/api/email/[connectionId]/disconnect/route.ts:45-52`
7. Tokens cleared but record kept for history -> `src/app/api/email/[connectionId]/disconnect/route.ts:48-50`
8. Page refreshes to show updated connection list -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:43`

## Key Modules

| Module              | Purpose                                         | Location                                                            |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Email Settings Page | Server component that loads connections         | `src/app/(dashboard)/settings/email/page.tsx`                       |
| ConnectEmailButton  | Dropdown to initiate OAuth for Gmail/Outlook    | `src/app/(dashboard)/settings/email/components/connect-button.tsx`  |
| EmailConnectionList | Displays connected emails with status           | `src/app/(dashboard)/settings/email/components/connection-list.tsx` |
| ImportRulesSection  | Manages filter rules for attachments            | `src/app/(dashboard)/settings/email/components/import-rules.tsx`    |
| Connect API         | Generates OAuth URL for provider                | `src/app/api/email/connect/route.ts`                                |
| Callback API        | Exchanges OAuth code for tokens                 | `src/app/api/email/callback/route.ts`                               |
| Disconnect API      | Revokes tokens and marks connection as revoked  | `src/app/api/email/[connectionId]/disconnect/route.ts`              |
| Rules API           | Creates, updates, deletes import rules          | `src/app/api/email/rules/route.ts`                                  |
| Email Sync Cron     | Daily job to sync all connections               | `src/app/api/cron/email-sync/route.ts`                              |
| Sync Service        | Core logic for fetching and processing messages | `src/lib/email-sync/sync-service.ts`                                |
| EmailSyncProvider   | Interface for OAuth and message fetching        | `src/lib/email-sync/provider.ts`                                    |
| Gmail Provider      | Gmail API implementation with OAuth2            | `src/lib/email-sync/providers/gmail.ts`                             |
| Microsoft Provider  | Microsoft Graph API implementation with MSAL    | `src/lib/email-sync/providers/microsoft.ts`                         |
| Provider Registry   | Factory for email provider instances            | `src/lib/email-sync/providers/index.ts`                             |

## Data

### Database Tables

- **EmailConnection**: Email account connections -> `prisma/schema.prisma:544-569`
  - Key fields: id, companyId, provider, emailAddress, status
  - OAuth tokens: accessTokenEnc, refreshTokenEnc, tokenExpiresAt, scopes -> `prisma/schema.prisma:551-554`
  - Sync state: lastSyncAt, syncCursor, lastError -> `prisma/schema.prisma:556-558`
  - Relations: company, importRules, attachments -> `prisma/schema.prisma:563-565`
  - Unique constraint: (companyId, emailAddress) -> `prisma/schema.prisma:567`

- **EmailImportRule**: Attachment filter criteria -> `prisma/schema.prisma:572-591`
  - Key fields: id, connectionId, companyId
  - Filter fields: senderEmail, senderDomain, subjectContains, filenameContains -> `prisma/schema.prisma:577-580`
  - Status: isActive (default true) -> `prisma/schema.prisma:582`
  - Relations: connection, company -> `prisma/schema.prisma:586-587`

- **EmailAttachment**: Downloaded attachment metadata -> `prisma/schema.prisma:593-618`
  - Key fields: id, companyId, connectionId, contentHash
  - Provider refs: providerMessageId, providerAttachmentId -> `prisma/schema.prisma:598-599`
  - Email metadata: receivedAt, senderEmail, subject -> `prisma/schema.prisma:602-604`
  - File metadata: filename, mimeType, sizeBytes -> `prisma/schema.prisma:605-607`
  - Storage: r2Key, status, importJobId -> `prisma/schema.prisma:609-611`
  - Unique constraint: (connectionId, contentHash) for deduplication -> `prisma/schema.prisma:620`

### Enums

```typescript
enum EmailProvider {
  GMAIL      // Google Gmail
  MICROSOFT  // Microsoft Outlook/Office365
}
```

Source: `prisma/schema.prisma:962-965`

```typescript
enum EmailConnectionStatus {
  CONNECTED  // Active and syncing
  EXPIRED    // Token expired
  REVOKED    // User disconnected
  ERROR      // Sync error
}
```

Source: `prisma/schema.prisma:967-972`

```typescript
enum AttachmentStatus {
  PENDING   // Downloaded, awaiting rule evaluation
  IMPORTED  // Import job created
  SKIPPED   // No rules matched
  FAILED    // Processing error
}
```

Source: `prisma/schema.prisma:974-979`

### OAuth Scopes

- **Gmail**: `https://www.googleapis.com/auth/gmail.readonly` -> `src/lib/email-sync/providers/gmail.ts:7`
- **Microsoft**: `Mail.Read`, `offline_access` -> `src/lib/email-sync/providers/microsoft.ts:8`

## Connection Requirements

### Gmail Connection

- Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET -> `src/lib/email-sync/providers/index.ts:23-24`
- OAuth2 with offline access for refresh tokens -> `src/lib/email-sync/providers/gmail.ts:22`
- Fetches messages with "has:attachment" query -> `src/lib/email-sync/providers/gmail.ts:73`
- Downloads attachments via Gmail API -> `src/lib/email-sync/providers/gmail.ts:123-146`

### Microsoft Connection

- Requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET -> `src/lib/email-sync/providers/index.ts:27-28`
- Uses MSAL ConfidentialClientApplication -> `src/lib/email-sync/providers/microsoft.ts:11-17`
- Fetches messages via Microsoft Graph API -> `src/lib/email-sync/providers/microsoft.ts:92-126`
- Downloads attachments via Graph API -> `src/lib/email-sync/providers/microsoft.ts:129-146`

### Environment Variables

```bash
# Email Import - Gmail
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email Import - Microsoft/Outlook
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Cron Protection
CRON_SECRET=
```

Source: `.env.example:42-47,39-40`

## Import Rules

### Rule Matching Logic

Rules are evaluated with AND logic (all specified filters must match):

- **senderEmail**: Exact match (case-insensitive) -> `src/lib/email-sync/sync-service.ts:152-154`
- **senderDomain**: Domain portion after @ (case-insensitive) -> `src/lib/email-sync/sync-service.ts:156-159`
- **subjectContains**: Substring match in subject (case-insensitive) -> `src/lib/email-sync/sync-service.ts:161-163`
- **filenameContains**: Substring match in filename (case-insensitive) -> `src/lib/email-sync/sync-service.ts:165-167`

At least one filter criterion required -> `src/app/api/email/rules/route.ts:63-68`

### Rule Actions

When attachment matches active rule:

1. Download attachment from provider -> `src/lib/email-sync/sync-service.ts:173`
2. Upload to R2 storage -> `src/lib/email-sync/sync-service.ts:176-177`
3. Create EmailAttachment with status PENDING -> `src/lib/email-sync/sync-service.ts:196`
4. If PDF or image, create ImportJob -> `src/lib/email-sync/sync-service.ts:203-217`
5. Update attachment status to IMPORTED -> `src/lib/email-sync/sync-service.ts:219-225`

If no rules match, attachment saved with status SKIPPED -> `src/lib/email-sync/sync-service.ts:196`

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/(dashboard)/settings/email/page.tsx:15-16`
- Requires user to have company -> `src/app/(dashboard)/settings/email/page.tsx:18`
- Tenant context isolation via setTenantContext -> `src/app/(dashboard)/settings/email/page.tsx:19`
- All API routes validate company ownership -> `src/app/api/email/rules/route.ts:51-60`

### OAuth Security

- OAuth state includes companyId to prevent CSRF -> `src/app/api/email/connect/route.ts:35-37`
- State validated on callback -> `src/app/api/email/callback/route.ts:25-30`
- Tokens encrypted before database storage -> `src/app/api/email/callback/route.ts:75-76`
- Access tokens refreshed when expired -> `src/lib/email-sync/sync-service.ts:37-55`
- Token revocation on disconnect -> `src/app/api/email/[connectionId]/disconnect/route.ts:33-42`

### Cron Security

- CRON_SECRET validates scheduled job requests -> `src/app/api/cron/email-sync/route.ts:8-13`
- Only CONNECTED status connections synced -> `src/lib/email-sync/sync-service.ts:235`

### Data Isolation

- Connections filtered by companyId -> `src/app/(dashboard)/settings/email/page.tsx:22`
- Rules filtered by companyId -> `src/app/api/email/rules/route.ts:15,52`
- Attachments stored with companyId -> `src/lib/email-sync/sync-service.ts:184`
- Import jobs created with companyId -> `src/lib/email-sync/sync-service.ts:209`

## Token Management

### Token Storage

- Access tokens encrypted with EINVOICE_KEY_SECRET -> `src/app/api/email/callback/route.ts:75`
- Refresh tokens encrypted with EINVOICE_KEY_SECRET -> `src/app/api/email/callback/route.ts:76`
- Token expiration time stored as DateTime -> `src/app/api/email/callback/route.ts:77`

### Token Refresh

- Checks if access token valid before sync -> `src/lib/email-sync/sync-service.ts:37`
- Refreshes if expired or missing -> `src/lib/email-sync/sync-service.ts:40-54`
- Updates stored tokens after refresh -> `src/lib/email-sync/sync-service.ts:47-54`
- On refresh error, marks connection as EXPIRED -> `src/lib/email-sync/sync-service.ts:111`

### Token Encryption

Uses `encryptSecret` and `decryptSecret` from `src/lib/secrets.ts`:

- Encryption key from EINVOICE_KEY_SECRET environment variable
- Tokens decrypted only when needed for API calls -> `src/lib/email-sync/sync-service.ts:38,41`

## Sync Process

### Deduplication

- Content hash generated from messageId:attachmentId:filename:size -> `src/lib/email-sync/sync-service.ts:128-132`
- Unique constraint on (connectionId, contentHash) -> `prisma/schema.prisma:620`
- Skip processing if hash already exists -> `src/lib/email-sync/sync-service.ts:135-146`

### Cursor-Based Pagination

- syncCursor stored per connection -> `src/lib/email-sync/sync-service.ts:58`
- Updated after each batch -> `src/lib/email-sync/sync-service.ts:89-92`
- Provider returns nextCursor for pagination -> `src/lib/email-sync/sync-service.ts:85-86`

### Error Handling

- Errors collected per attachment -> `src/lib/email-sync/sync-service.ts:77-81`
- Connection lastError updated on failure -> `src/lib/email-sync/sync-service.ts:110`
- Connection status set to ERROR or EXPIRED -> `src/lib/email-sync/sync-service.ts:111`
- Sync continues on attachment errors -> `src/lib/email-sync/sync-service.ts:68-82`

### Cron Schedule

Daily sync at 5:00 AM UTC -> `vercel.json:8-9`

## UI Components

### Settings Page Components

- **EmailConnectionList**: Connection cards with provider, status, attachment count -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:23-117`
- **ConnectEmailButton**: Dropdown menu for Gmail/Outlook -> `src/app/(dashboard)/settings/email/components/connect-button.tsx:15-68`
- **ImportRulesSection**: Rule management with add/toggle/delete -> `src/app/(dashboard)/settings/email/components/import-rules.tsx:19-188`

### Connection Card Layout

```
┌─────────────────────────────────────────────────┐
│ ✉ user@example.com                         [X] │
│   GMAIL - 15 attachments           [CONNECTED]  │
│                                                  │
│   Last synced: 2025-12-15 10:30:00              │
│                                                  │
│   Import Rules                              [+] │
│   ┌──────────────────────────────────────┐      │
│   │ From: statements@bank.com    [✓] [🗑] │      │
│   └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### Empty State

Shows mail icon with message when no connections exist -> `src/app/(dashboard)/settings/email/components/connection-list.tsx:52-64`

### Success/Error Messages

- Green banner on successful connection -> `src/app/(dashboard)/settings/email/page.tsx:44-48`
- Red banner on connection errors -> `src/app/(dashboard)/settings/email/page.tsx:50-54`

## Dependencies

- **Depends on**:
  - R2 Storage - Attachment file storage
  - Import Jobs - Triggers OCR processing of documents
  - Tenant Context - Multi-company data isolation
  - Secrets Management - Token encryption/decryption

- **Depended by**:
  - Document Import - Provides automated document ingestion
  - Bank Statement Processing - Sources bank PDFs for reconciliation

## Integrations

### Google Gmail API

- Uses googleapis npm package -> `src/lib/email-sync/providers/gmail.ts:3`
- OAuth2 with offline access -> `src/lib/email-sync/providers/gmail.ts:22`
- Fetches messages with attachments -> `src/lib/email-sync/providers/gmail.ts:71-76`
- Downloads attachments as base64url -> `src/lib/email-sync/providers/gmail.ts:133-145`

### Microsoft Graph API

- Uses @azure/msal-node for OAuth -> `src/lib/email-sync/providers/microsoft.ts:3`
- Uses @microsoft/microsoft-graph-client for API -> `src/lib/email-sync/providers/microsoft.ts:4`
- Fetches messages with OData filters -> `src/lib/email-sync/providers/microsoft.ts:98-102`
- Downloads attachments as base64 -> `src/lib/email-sync/providers/microsoft.ts:138-146`

### Cloudflare R2

- Uploads attachments to R2 bucket -> `src/lib/email-sync/sync-service.ts:176-177`
- Generates R2 keys with companyId prefix -> `src/lib/email-sync/sync-service.ts:176`
- Stores r2Key for later retrieval -> `src/lib/email-sync/sync-service.ts:195`

### Vercel Cron

- Daily scheduled sync at 5:00 AM -> `vercel.json:8-9`
- Protected by CRON_SECRET header -> `src/app/api/cron/email-sync/route.ts:8-13`

## Error Handling

- **OAuth denied**: Redirects to /settings/email?error=oauth_denied -> `src/app/api/email/callback/route.ts:16`
- **Missing params**: Redirects to /settings/email?error=missing_params -> `src/app/api/email/callback/route.ts:20`
- **Invalid state**: Redirects to /settings/email?error=invalid_state -> `src/app/api/email/callback/route.ts:29`
- **Callback failed**: Redirects to /settings/email?error=callback_failed -> `src/app/api/email/callback/route.ts:93`
- **Provider not configured**: Returns 503 error -> `src/app/api/email/connect/route.ts:24-27`
- **Connection not found**: Returns 404 error -> `src/app/api/email/[connectionId]/disconnect/route.ts:26-29`
- **Rule validation failed**: Returns 400 error -> `src/app/api/email/rules/route.ts:64-67`
- **Unauthorized cron**: Returns 401 error -> `src/app/api/cron/email-sync/route.ts:12`
- **Token refresh error**: Marks connection as EXPIRED -> `src/lib/email-sync/sync-service.ts:111`
- **Attachment processing error**: Logs error, continues sync -> `src/lib/email-sync/sync-service.ts:77-81`

## Verification Checklist

- [x] User can navigate to /settings/email
- [x] User can connect Gmail account via OAuth
- [x] User can connect Microsoft/Outlook account via OAuth
- [x] Connected emails display with provider and status
- [x] User can view attachment count per connection
- [x] User can add import rules with multiple filter types
- [x] Import rules support sender email filtering
- [x] Import rules support sender domain filtering
- [x] Import rules support subject contains filtering
- [x] Import rules support filename contains filtering
- [x] User can toggle rules active/inactive
- [x] User can delete import rules
- [x] User can disconnect email accounts
- [x] OAuth tokens encrypted before storage
- [x] Cron job syncs all connected accounts daily
- [x] Attachments deduplicated by content hash
- [x] Matching attachments create import jobs
- [x] Access tokens refreshed when expired
- [x] Tenant isolation prevents cross-company access

## Related Features

- **Document Import**: EmailAttachment -> ImportJob workflow
- **Bank Statement Sync**: Complements account-based sync with email-based import
- **Settings**: Part of unified settings navigation

## Evidence Links

1. `src/app/(dashboard)/settings/email/page.tsx:1-59` - Email settings page with connection list
2. `src/app/(dashboard)/settings/email/components/connect-button.tsx:1-67` - OAuth initiation for Gmail/Outlook
3. `src/app/(dashboard)/settings/email/components/connection-list.tsx:1-117` - Connected email management UI
4. `src/app/(dashboard)/settings/email/components/import-rules.tsx:1-188` - Import rule configuration UI
5. `src/app/api/email/connect/route.ts:1-47` - OAuth URL generation endpoint
6. `src/app/api/email/callback/route.ts:1-95` - OAuth callback with token exchange
7. `src/app/api/email/rules/route.ts:1-89` - Import rule CRUD operations
8. `src/lib/email-sync/sync-service.ts:1-250` - Core sync logic with deduplication
9. `src/lib/email-sync/providers/gmail.ts:1-151` - Gmail provider implementation
10. `src/lib/email-sync/providers/microsoft.ts:1-154` - Microsoft provider implementation
11. `src/app/api/cron/email-sync/route.ts:1-36` - Daily sync cron job
12. `prisma/schema.prisma:544-618` - EmailConnection, EmailImportRule, EmailAttachment models
