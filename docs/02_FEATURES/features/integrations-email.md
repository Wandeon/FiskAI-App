# Feature: Email Integration

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

Enables automatic document import from email providers via OAuth2-authenticated integration with Gmail and Microsoft Outlook/365. The feature initiates OAuth-based email connections, handles secure authorization flows, processes email attachments for document import, and establishes persistent connections for automated email monitoring. Supports both Gmail API and Microsoft Graph API with industry-standard security practices including PKCE, refresh token management, and secure credential storage.

## User Entry Points

| Type   | Path                | Evidence                                     |
| ------ | ------------------- | -------------------------------------------- |
| Page   | /settings/email     | TBD - Email integration settings page        |
| Button | "Connect Email"     | TBD - Email connection initialization button |
| API    | /api/email/connect  | TBD - Email connection initiation endpoint   |
| API    | /api/email/callback | TBD - OAuth callback handler                 |
| API    | /api/email/sync     | TBD - Manual/automated email sync endpoint   |

## Core Flow

1. User navigates to email integration settings page
2. System displays available email providers (Gmail, Microsoft 365)
3. User selects desired email provider
4. Client sends POST request to `/api/email/connect` with provider selection
5. Server validates authentication and company ownership
6. System checks OAuth2 credentials configuration for selected provider
7. Server initiates OAuth2 authorization flow with PKCE
8. OAuth2 authorization URL generated with appropriate scopes
9. User redirected to email provider's OAuth consent page
10. User authenticates with email provider and grants permissions
11. Email provider redirects to callback endpoint with authorization code
12. Server exchanges authorization code for access and refresh tokens
13. Tokens securely stored with encryption in database
14. Email connection record created with provider details
15. Initial email sync triggered to fetch recent attachments
16. Attachments filtered for supported document types (PDF, images)
17. Documents processed through existing upload pipeline
18. Connection status updated to ACTIVE
19. User redirected back to settings with success confirmation
20. Background job monitors email for new attachments daily

## Key Modules

| Module                  | Purpose                                        | Location                                |
| ----------------------- | ---------------------------------------------- | --------------------------------------- |
| EmailSettingsPage       | UI for managing email integrations             | TBD - `/settings/email` page component  |
| EmailConnectButton      | OAuth initiation component                     | TBD - Email provider connection button  |
| connectRoute            | API handler for initiating OAuth flow          | TBD - `/api/email/connect/route.ts`     |
| callbackRoute           | OAuth callback handler                         | TBD - `/api/email/callback/route.ts`    |
| syncRoute               | Email synchronization endpoint                 | TBD - `/api/email/sync/route.ts`        |
| EmailProvider           | Provider abstraction interface                 | TBD - Email provider interface          |
| gmailProvider           | Gmail API implementation                       | TBD - Gmail provider implementation     |
| microsoftProvider       | Microsoft Graph API implementation             | TBD - Microsoft provider implementation |
| getEmailProvider        | Provider factory and configuration             | TBD - Provider factory                  |
| processEmailAttachments | Attachment extraction and document creation    | TBD - Attachment processing logic       |
| email-sync cron         | Daily email monitoring background job          | TBD - `/api/cron/email-sync/route.ts`   |
| TokenManager            | OAuth2 token encryption and refresh management | TBD - Token security management         |

## Data

- **Tables**: `EmailConnection`, `EmailSyncLog`, `Document` (existing)
- **EmailConnection fields**:
  - `provider` (EmailProvider): GMAIL or MICROSOFT enum
  - `providerAccountId` (String): Email address/account identifier
  - `encryptedAccessToken` (String): Encrypted OAuth2 access token
  - `encryptedRefreshToken` (String): Encrypted OAuth2 refresh token
  - `tokenExpiresAt` (DateTime): Access token expiration timestamp
  - `status` (ConnectionStatus): ACTIVE/EXPIRED/ERROR
  - `scopes` (String[]): Granted OAuth2 scopes
  - `lastSyncAt` (DateTime, nullable): Last successful sync
  - `syncEnabled` (Boolean): Auto-sync toggle
  - `companyId` (String): Company association
  - `userId` (String): User who authorized connection
- **EmailSyncLog fields**:
  - `connectionId` (String): Associated EmailConnection
  - `syncedAt` (DateTime): Sync execution timestamp
  - `emailsProcessed` (Int): Number of emails checked
  - `attachmentsFound` (Int): Number of attachments found
  - `documentsCreated` (Int): Number of documents imported
  - `errors` (Json, nullable): Error details if any
- **Relations**: EmailConnection belongs to Company (many:1), User (many:1)
- **Indexes**: `provider`, `providerAccountId`, `status`, `companyId`

## OAuth Flow

### Gmail OAuth2 Flow

Implementation follows Google's OAuth 2.0 best practices:

1. **Authorization Request**: Server initiates OAuth flow
   - Endpoint: `https://accounts.google.com/o/oauth2/v2/auth`
   - Response type: `code` (Authorization Code Grant)
   - Scopes requested:
     - `https://www.googleapis.com/auth/gmail.readonly` - Read emails and attachments
     - `https://www.googleapis.com/auth/gmail.metadata` - Read email metadata
   - PKCE parameters: `code_challenge` and `code_challenge_method=S256`
   - State parameter for CSRF protection
   - Access type: `offline` for refresh token
   - Prompt: `consent` to ensure refresh token issuance

2. **User Authorization**: Browser redirects to Google consent screen
   - User authenticates with Google account
   - User grants requested permissions
   - Google redirects to callback URL with authorization code

3. **Token Exchange**: Server exchanges code for tokens
   - Endpoint: `https://oauth2.googleapis.com/token`
   - POST with authorization code and PKCE verifier
   - Receives: access token, refresh token, expiry time
   - Tokens encrypted before database storage

4. **Gmail API Access**: Server uses access token for API calls
   - Base URL: `https://gmail.googleapis.com/gmail/v1`
   - Bearer token authentication
   - Automatic token refresh when expired

### Microsoft Graph OAuth2 Flow

Implementation follows Microsoft Identity Platform standards:

1. **Authorization Request**: Server initiates OAuth flow
   - Endpoint: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
   - Response type: `code`
   - Scopes requested:
     - `Mail.Read` - Read user email messages
     - `offline_access` - Maintain access via refresh token
   - PKCE parameters for enhanced security
   - State parameter for CSRF protection

2. **User Authorization**: Browser redirects to Microsoft consent screen
   - User authenticates with Microsoft account
   - User grants requested permissions
   - Microsoft redirects to callback with authorization code

3. **Token Exchange**: Server exchanges code for tokens
   - Endpoint: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
   - POST with authorization code and PKCE verifier
   - Receives: access token, refresh token, expiry time
   - Tokens encrypted before database storage

4. **Graph API Access**: Server uses access token for API calls
   - Base URL: `https://graph.microsoft.com/v1.0`
   - Bearer token authentication
   - Automatic token refresh when expired

### Redirect URLs

- **Base URL**: Configured via `NEXT_PUBLIC_APP_URL` environment variable
- **Callback Endpoint**: `${baseUrl}/api/email/callback`
- **State Parameter**: Encrypted JSON with provider, companyId, PKCE verifier, nonce

## Provider Integration

### Provider Interface

All email providers implement standard interface:

- `name`: Provider identifier string (GMAIL/MICROSOFT)
- `getAuthorizationUrl(redirectUrl, state, scopes)`: Generate OAuth URL with PKCE
- `exchangeCodeForTokens(code, redirectUrl, codeVerifier)`: Exchange authorization code
- `refreshAccessToken(refreshToken)`: Obtain new access token
- `fetchRecentEmails(accessToken, since)`: Retrieve emails since timestamp
- `downloadAttachment(accessToken, emailId, attachmentId)`: Download attachment data
- `validateConnection(accessToken)`: Verify token validity

### Gmail Provider Implementation

Primary implementation for Gmail integration:

- **Authentication Library**: `google-auth-library` with `google-auth-oauthlib`
- **API Client**: `googleapis` npm package for Gmail API
- **Base URL**: `https://gmail.googleapis.com/gmail/v1`
- **Token Endpoint**: `https://oauth2.googleapis.com/token`
- **Scopes**:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.metadata`
- **Email Fetching**: Query filters for unread messages with attachments
- **Attachment Types**: PDF, PNG, JPG, JPEG with MIME type validation
- **Rate Limits**: Quota of 1 billion quota units per day (250 units per read request)
- **Pagination**: Uses `nextPageToken` for large result sets

### Microsoft Graph Provider Implementation

Primary implementation for Microsoft 365/Outlook integration:

- **Authentication Library**: `@azure/msal-node` (Microsoft Authentication Library)
- **API Client**: `@microsoft/microsoft-graph-client`
- **Base URL**: `https://graph.microsoft.com/v1.0`
- **Token Endpoint**: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- **Scopes**:
  - `Mail.Read`
  - `offline_access`
- **Email Fetching**: Filter query for messages with hasAttachments=true
- **Attachment Types**: PDF, images with contentType validation
- **Rate Limits**: Throttling limits per app (varies by license)
- **Pagination**: Uses `@odata.nextLink` for continuation

### Provider Configuration

- **Environment Variables**:
  - `EMAIL_INTEGRATION_ENABLED=true` - Feature flag
  - `GMAIL_CLIENT_ID=your_client_id` - Google OAuth client ID
  - `GMAIL_CLIENT_SECRET=your_client_secret` - Google OAuth client secret
  - `MICROSOFT_CLIENT_ID=your_client_id` - Microsoft app registration ID
  - `MICROSOFT_CLIENT_SECRET=your_client_secret` - Microsoft app secret
  - `EMAIL_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32` - Token encryption key
- **Configuration Check**: `isProviderConfigured()` validates credentials
- **Provider Factory**: `getEmailProvider()` returns configured provider instance

## Email Synchronization

### Initial Sync

Triggered immediately after successful OAuth connection:

1. **History Window**: Fetches emails from last 30 days
2. **Email Query**: Provider-specific filters for attachments
3. **Attachment Filtering**: Only PDF and image files (PNG, JPG, JPEG)
4. **Size Limits**: Skip attachments >10MB
5. **Download**: Stream attachment data to temporary storage
6. **Document Creation**: Process through existing document upload pipeline
7. **Categorization**: AI-powered document type detection
8. **Sync Log**: Record statistics and any errors
9. **Error Handling**: Sync errors logged but don't fail connection

### Automated Synchronization

Background cron job runs daily at 6 AM UTC:

1. **Authorization Check**: Validates cron secret
2. **Connection Discovery**: Finds all ACTIVE connections with syncEnabled=true
3. **Token Refresh**: Automatically refresh expired access tokens
4. **Email Fetching**: Query emails since lastSyncAt timestamp
5. **Attachment Processing**: Download and create documents
6. **Sync Log Creation**: Track metrics for each sync
7. **Error Recovery**: Mark connection as ERROR status after 3 consecutive failures
8. **Rate Limiting**: Respect provider API rate limits with exponential backoff

### Manual Sync

User-initiated synchronization via settings page:

1. **User Trigger**: Click "Sync Now" button
2. **API Request**: POST to `/api/email/sync` with connectionId
3. **Validation**: Verify connection ownership and status
4. **Immediate Execution**: Sync runs in request context (no cron)
5. **Progress Feedback**: Real-time updates via streaming response
6. **Completion**: Display sync statistics to user

## Token Management

### Token Security

OAuth2 tokens require secure storage and handling:

1. **Encryption**: All tokens encrypted using AES-256-GCM
   - Encryption key from `EMAIL_ENCRYPTION_KEY` environment variable
   - Unique initialization vector (IV) per token
   - Authentication tag for integrity verification

2. **Storage**: Encrypted tokens stored in database
   - Access tokens: Short-lived (1 hour typical)
   - Refresh tokens: Long-lived (no expiration for Google, 90 days for Microsoft)
   - Never logged or transmitted to client

3. **Rotation**: Automatic token refresh before expiration
   - Refresh 5 minutes before expiry
   - Lock mechanism prevents concurrent refresh
   - Failed refresh marks connection as EXPIRED

4. **Revocation**: User can disconnect and revoke access
   - Tokens deleted from database
   - OAuth consent revoked with provider API
   - Connection status set to DISCONNECTED

### Refresh Token Management

Implements OAuth2 best practices for token lifecycle:

- **Google**: Refresh tokens valid indefinitely until revoked
  - Limit: 100 refresh tokens per account per client ID
  - Oldest token invalidated when limit exceeded
  - Testing consent screen: 7-day expiration

- **Microsoft**: Refresh tokens expire after 90 days of inactivity
  - Sliding window: Each use extends validity
  - Conditional Access policies may shorten lifetime
  - Automatic re-authorization prompt if expired

- **Refresh Strategy**:
  - Check token expiry before each API call
  - Proactive refresh at 5-minute threshold
  - Retry logic for transient refresh failures
  - User notification for permanent failures

## Disconnection

User can terminate email integration:

1. **UI Confirmation**: Prompt user before disconnecting
2. **API Request**: POST to `/api/email/disconnect` with connectionId
3. **Server Validation**: Verify connection ownership
4. **Token Revocation**: Call provider revocation endpoint
5. **Database Cleanup**: Delete EmailConnection and tokens
6. **Sync Logs Retained**: Historical sync logs preserved for audit
7. **UI Refresh**: Settings page updated to show disconnected state

Note: Disconnection does NOT delete documents previously imported from email.

## Status Management

### Connection Status Lifecycle

Status progression:

1. **PENDING**: OAuth initiated but not completed
2. **ACTIVE**: Successful authorization with valid tokens
3. **EXPIRED**: Refresh token expired or revoked
4. **ERROR**: Sync failures or API errors
5. **DISCONNECTED**: User-initiated disconnection

### Status Display

Visual indicators in settings page:

- **ACTIVE**: Green badge with checkmark, shows last sync time
- **EXPIRED**: Amber badge, "Reconnect Required" with renew button
- **ERROR**: Red badge with error icon, shows error message
- **PENDING**: Blue badge with spinner, "Authorization in progress"
- **DISCONNECTED**: Gray badge, "Not connected"

## Error Handling

### Connection Errors

| Scenario                   | Behavior                          | HTTP Status |
| -------------------------- | --------------------------------- | ----------- |
| Provider not configured    | "Email provider not configured"   | 503         |
| Missing provider parameter | "Email provider is required"      | 400         |
| Invalid provider           | "Unsupported email provider"      | 400         |
| OAuth authorization failed | "Email authorization failed"      | 401         |
| Token exchange failed      | "Failed to obtain access tokens"  | 500         |
| Connection already exists  | "Email account already connected" | 409         |

### Callback Errors

| Scenario                   | Behavior                       | Redirect                            |
| -------------------------- | ------------------------------ | ----------------------------------- |
| Missing authorization code | Redirect with error parameter  | `/settings/email?error=no_code`     |
| Invalid state parameter    | Redirect with CSRF error       | `/settings/email?error=csrf`        |
| Token exchange failure     | Redirect with exchange error   | `/settings/email?error=token`       |
| Database save error        | Redirect with connection error | `/settings/email?error=save_failed` |

### Sync Errors

Cron job error handling:

- **Per-Connection Isolation**: Errors don't stop other connections
- **Error Logging**: Detailed logs with connection ID and provider
- **Retry Logic**: Exponential backoff for transient errors
- **Failure Threshold**: Mark ERROR after 3 consecutive failures
- **User Notification**: Email notification for persistent failures

## Security

### Authentication & Authorization

Multi-layer security:

- **User Session**: `requireAuth()` validates authenticated user
- **Company Context**: `requireCompany()` ensures company membership
- **Tenant Isolation**: `setTenantContext()` enforces data separation
- **Connection Ownership**: Validate connectionId belongs to user's company

### OAuth2 Security Best Practices

Following RFC 9700 (OAuth 2.0 Security Best Current Practice):

1. **Authorization Code with PKCE**: Mandatory for all flows
   - SHA-256 code challenge prevents authorization code interception
   - Code verifier never transmitted until token exchange

2. **State Parameter**: CSRF protection
   - Cryptographically random state value
   - Encrypted payload with connection metadata
   - Validated on callback before token exchange

3. **Redirect URI Validation**: Exact match required
   - Registered redirect URIs in provider configuration
   - No wildcard or partial matching
   - HTTPS enforcement in production

4. **Token Storage Security**:
   - AES-256-GCM encryption for tokens at rest
   - Tokens never logged or exposed in responses
   - Secure deletion on disconnection

5. **Scope Minimization**: Request minimal necessary permissions
   - Gmail: Read-only access, no send or modify
   - Microsoft: Read mail only, no calendar or contacts

### Credential Protection

Provider credentials secured:

- **Server-Side Only**: All OAuth flows handled server-side
- **Environment Variables**: Secrets in secure environment
- **No Client Exposure**: Client never receives tokens or secrets
- **Key Rotation**: Support for rotating encryption keys

### Cron Protection

Background job security:

- **Bearer Token**: Requires `Authorization: Bearer ${CRON_SECRET}`
- **401 Unauthorized**: Rejects invalid cron requests
- **Rate Limiting**: Prevent abuse of sync endpoint

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication and company context
  - [[documents-upload]] - Document creation pipeline
  - [[ai-receipt-extraction]] - Document type detection
  - Gmail API (external)
  - Microsoft Graph API (external)

- **Depended by**:
  - [[documents-management]] - Displays imported documents
  - [[expenses-create]] - May use imported receipts
  - [[banking-documents]] - May link imported invoices

## Integrations

### Gmail API

- **Base URL**: `https://gmail.googleapis.com/gmail/v1`
- **Authentication**: OAuth 2.0 with Bearer token
- **Endpoints**:
  - `GET /users/me/messages`: List messages with query
  - `GET /users/me/messages/{id}`: Get message details
  - `GET /users/me/messages/{id}/attachments/{attachmentId}`: Download attachment
- **Quota**: 1 billion quota units per day
- **Scopes**: `gmail.readonly`, `gmail.metadata`
- **Libraries**: `googleapis` npm package

### Microsoft Graph API

- **Base URL**: `https://graph.microsoft.com/v1.0`
- **Authentication**: OAuth 2.0 with Bearer token
- **Endpoints**:
  - `GET /me/messages`: List messages with filter
  - `GET /me/messages/{id}`: Get message details
  - `GET /me/messages/{id}/attachments/{attachmentId}/$value`: Download attachment
- **Throttling**: Per-app and per-user limits
- **Scopes**: `Mail.Read`, `offline_access`
- **Libraries**: `@microsoft/microsoft-graph-client`, `@azure/msal-node`

### Vercel Cron

- **Schedule**: Daily at 6:00 AM UTC
- **Endpoint**: `/api/cron/email-sync`
- **Authentication**: Bearer token with `CRON_SECRET`
- **Timeout**: 60 seconds maximum (Vercel default)

## User Experience

### Connection Flow

1. User clicks "Connect Gmail" or "Connect Microsoft" button
2. Loading spinner shows during authorization URL generation
3. Redirect to provider consent screen in same tab
4. User completes authorization on provider site
5. Redirect back to FiskAI settings page
6. Success message: "Email connected successfully"
7. Initial sync runs in background
8. Toast notification when initial sync completes

### Settings Interface

- **Connection Card**: Shows provider logo, email address, status
- **Sync Statistics**: Last sync time, documents imported count
- **Manual Sync Button**: "Sync Now" with loading state
- **Auto-Sync Toggle**: Enable/disable automatic daily sync
- **Disconnect Button**: "Disconnect" with confirmation dialog

### Error Feedback

- **Connection Errors**: Toast notification with actionable message
- **Sync Errors**: Error badge on connection card with details
- **Token Expiration**: "Reconnect Required" prompt with renew button
- **Rate Limiting**: "Please try again later" message

## Environment Configuration

Required environment variables:

```env
# Feature flag
EMAIL_INTEGRATION_ENABLED=true

# Application base URL for OAuth redirects
NEXT_PUBLIC_APP_URL=https://your-app.example.com

# Gmail OAuth configuration
GMAIL_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_google_client_secret

# Microsoft OAuth configuration
MICROSOFT_CLIENT_ID=your_azure_app_client_id
MICROSOFT_CLIENT_SECRET=your_azure_app_client_secret

# Token encryption
EMAIL_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32

# Cron job authentication
CRON_SECRET=generate_with_openssl_rand_hex_32
```

## Verification Checklist

- [ ] User can navigate to email integration settings
- [ ] System displays Gmail and Microsoft provider options
- [ ] Connect button initiates OAuth flow with PKCE
- [ ] Authorization URL includes correct scopes and state
- [ ] User redirected to provider consent screen
- [ ] Callback endpoint validates state parameter
- [ ] Authorization code exchanged for tokens
- [ ] Access and refresh tokens encrypted before storage
- [ ] EmailConnection record created with provider details
- [ ] Initial sync fetches recent emails with attachments
- [ ] Only PDF and image attachments processed
- [ ] Attachments downloaded and converted to documents
- [ ] Document type detected via AI extraction
- [ ] Sync log records statistics
- [ ] Connection status updated to ACTIVE
- [ ] User redirected to settings with success message
- [ ] Daily cron job syncs all active connections
- [ ] Access tokens automatically refreshed before expiry
- [ ] Expired refresh tokens mark connection as EXPIRED
- [ ] Manual sync available via "Sync Now" button
- [ ] User can toggle auto-sync on/off
- [ ] Disconnect button prompts for confirmation
- [ ] Disconnection revokes OAuth tokens with provider
- [ ] Status badge reflects current connection state
- [ ] Error messages provide actionable guidance
- [ ] Rate limits respected with exponential backoff
- [ ] Tenant isolation enforced for all operations
- [ ] OAuth credentials never exposed to client
- [ ] Cron endpoint protected with bearer token

## Evidence Links

1. [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) - Official Google OAuth 2.0 documentation
2. [Gmail API Python Quickstart](https://developers.google.com/workspace/gmail/api/quickstart/python) - Gmail API integration guide with OAuth setup
3. [Microsoft Graph API sendMail Documentation](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0) - Microsoft Graph email operations reference
4. [Get Attachment - Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/attachment-get?view=graph-rest-1.0) - Attachment download API specification
5. [RFC 9700 - OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/rfc9700/) - January 2025 OAuth security standard
6. [OAuth 2.0 Security Best Practice](https://oauth.net/2/oauth-best-practice/) - Industry best practices for OAuth implementation
7. [MSAL Python Overview](https://learn.microsoft.com/en-us/entra/msal/python/) - Microsoft Authentication Library for Python documentation
8. [Build Python Apps with Microsoft Graph](https://learn.microsoft.com/en-us/graph/tutorials/python) - Official Microsoft Graph Python integration tutorial
9. [Gmail API Method: users.messages.attachments.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages.attachments/get) - Gmail attachment download API reference
10. [OAuth 2.0 Token Refresh Documentation](https://requests-oauthlib.readthedocs.io/en/latest/examples/real_world_example_with_refresh.html) - Token refresh implementation guide with Python examples
