# Feature: Connect Bank Account

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 18

## Purpose

Enables automatic bank account synchronization via PSD2-compliant Account Information Services (AIS) providers. The feature initiates OAuth-based bank connections through GoCardless Bank Account Data API, handles secure authorization redirects, processes callback authentication, and establishes persistent connections for automated transaction synchronization. Supports Croatian banks with 90-day consent periods, includes intelligent deduplication, and provides automatic daily synchronization via background cron jobs.

## User Entry Points

| Type   | Path               | Evidence                                                        |
| ------ | ------------------ | --------------------------------------------------------------- |
| Page   | /banking           | `src/app/(dashboard)/banking/page.tsx:12`                       |
| Button | "Poveži banku"     | `src/app/(dashboard)/banking/components/connect-button.tsx:106` |
| API    | /api/bank/connect  | `src/app/api/bank/connect/route.ts:9`                           |
| API    | /api/bank/callback | `src/app/api/bank/callback/route.ts:8`                          |

## Core Flow

1. User views banking page with existing bank accounts → `src/app/(dashboard)/banking/page.tsx:12-269`
2. System displays connection status badge for each account → `src/app/(dashboard)/banking/components/connection-badge.tsx:8-43`
3. User clicks "Poveži banku" button for MANUAL or EXPIRED account → `src/app/(dashboard)/banking/components/connect-button.tsx:22-45`
4. Client sends POST request with bankAccountId → `src/app/(dashboard)/banking/components/connect-button.tsx:25-29`
5. Server validates authentication and company ownership → `src/app/api/bank/connect/route.ts:11-13`
6. System checks provider configuration exists → `src/app/api/bank/connect/route.ts:15-20`
7. Server fetches bank account and validates status → `src/app/api/bank/connect/route.ts:32-48`
8. Provider retrieves institution ID from bank name → `src/app/api/bank/connect/route.ts:51-59`
9. GoCardless requisition created with redirect URL → `src/app/api/bank/connect/route.ts:62-69`
10. BankConnection record upserted with provider details → `src/app/api/bank/connect/route.ts:75-92`
11. User redirected to bank's OAuth authorization page → `src/app/(dashboard)/banking/components/connect-button.tsx:39`
12. User authenticates with bank and grants 90-day consent → `src/lib/bank-sync/providers/gocardless.ts:178-180`
13. Bank redirects to callback endpoint with reference → `src/app/api/bank/callback/route.ts:8-14`
14. Server handles callback and retrieves linked accounts → `src/app/api/bank/callback/route.ts:28-31`
15. System matches account by IBAN → `src/app/api/bank/callback/route.ts:33-45`
16. Connection and bank account updated to CONNECTED status → `src/app/api/bank/callback/route.ts:51-70`
17. Initial transaction sync triggered (90 days history) → `src/app/api/bank/callback/route.ts:72-84`
18. Transactions processed with deduplication engine → `src/app/api/bank/callback/route.ts:79-83`
19. Current balance fetched and updated → `src/app/api/bank/callback/route.ts:86-95`
20. User redirected back to banking page with success message → `src/app/api/bank/callback/route.ts:101`

## Key Modules

| Module                       | Purpose                                          | Location                                                      |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| ConnectButton                | UI component for initiating/managing connections | `src/app/(dashboard)/banking/components/connect-button.tsx`   |
| ConnectionBadge              | Visual indicator of connection status            | `src/app/(dashboard)/banking/components/connection-badge.tsx` |
| BankingPage                  | Main dashboard displaying accounts and status    | `src/app/(dashboard)/banking/page.tsx:12-269`                 |
| connectRoute                 | API handler for initiating connection            | `src/app/api/bank/connect/route.ts:9-102`                     |
| callbackRoute                | OAuth callback handler for authorization         | `src/app/api/bank/callback/route.ts:8-106`                    |
| disconnectRoute              | API handler for removing connection              | `src/app/api/bank/disconnect/route.ts:8-59`                   |
| BankSyncProvider             | Provider abstraction interface                   | `src/lib/bank-sync/provider.ts:11-50`                         |
| gocardlessProvider           | GoCardless API implementation                    | `src/lib/bank-sync/providers/gocardless.ts:91-260`            |
| getProvider                  | Provider factory and configuration checker       | `src/lib/bank-sync/providers/index.ts:10-30`                  |
| processTransactionsWithDedup | Deduplication engine for transactions            | `src/lib/bank-sync/dedup.ts:131-184`                          |
| bank-sync cron               | Daily synchronization background job             | `src/app/api/cron/bank-sync/route.ts:8-118`                   |

## Data

- **Tables**: `BankAccount`, `BankConnection`, `BankTransaction`, `PotentialDuplicate` → `prisma/schema.prisma:430-529`
- **BankAccount fields**:
  - `syncProvider` (SyncProvider, nullable): Provider enum (GOCARDLESS/PLAID/SALTEDGE) → `prisma/schema.prisma:444`
  - `syncProviderAccountId` (String, nullable): Provider's account identifier → `prisma/schema.prisma:445`
  - `connectionStatus` (ConnectionStatus): MANUAL/CONNECTED/EXPIRED → `prisma/schema.prisma:446`
  - `connectionExpiresAt` (DateTime, nullable): 90-day consent expiration → `prisma/schema.prisma:447`
  - `lastSyncAt` (DateTime, nullable): Last successful sync timestamp → `prisma/schema.prisma:438`
  - `currentBalance` (Decimal): Synced balance from provider → `prisma/schema.prisma:437`
- **BankConnection fields**:
  - `provider` (SyncProvider): Provider enum → `prisma/schema.prisma:500`
  - `providerConnectionId` (String): Provider's requisition/connection ID → `prisma/schema.prisma:501`
  - `institutionId` (String): Bank institution identifier → `prisma/schema.prisma:502`
  - `institutionName` (String): Bank display name → `prisma/schema.prisma:503`
  - `status` (ConnectionStatus): Connection lifecycle state → `prisma/schema.prisma:505`
  - `authorizedAt` (DateTime, nullable): User authorization timestamp → `prisma/schema.prisma:506`
  - `expiresAt` (DateTime, nullable): Consent expiration date → `prisma/schema.prisma:507`
  - `lastError` (String, nullable): Most recent error message → `prisma/schema.prisma:508`
- **BankTransaction fields**:
  - `externalId` (String, nullable): Provider transaction ID for dedup → `prisma/schema.prisma:481`
  - `source` (TransactionSource): MANUAL or AIS_SYNC → `prisma/schema.prisma:482`
- **Relations**: BankConnection belongs to BankAccount (1:1), Company (many:1)
- **Indexes**: `connectionStatus`, `providerConnectionId`, `externalId` → `prisma/schema.prisma:458, 516-518, 492`

## OAuth Flow

### GoCardless Authorization

The feature implements PSD2-compliant OAuth 2.0 flow via GoCardless Bank Account Data API:

1. **Token Acquisition**: Server obtains access token using secret credentials → `src/lib/bank-sync/providers/gocardless.ts:18-51`
   - In-memory token caching with 1-minute safety margin → `src/lib/bank-sync/providers/gocardless.ts:16, 19-21`
   - POST to `/token/new/` with secret_id and secret_key → `src/lib/bank-sync/providers/gocardless.ts:30-36`
   - Token auto-refresh when expired → `src/lib/bank-sync/providers/gocardless.ts:19-21`

2. **Requisition Creation**: Server initiates bank connection → `src/lib/bank-sync/providers/gocardless.ts:126-145`
   - POST to `/requisitions/` with institution, redirect, reference → `src/lib/bank-sync/providers/gocardless.ts:131-139`
   - Returns requisition ID and authorization link → `src/lib/bank-sync/providers/gocardless.ts:141-144`
   - User language set to Croatian (HR) → `src/lib/bank-sync/providers/gocardless.ts:137`

3. **User Authorization**: Browser redirects to bank OAuth page → `src/app/(dashboard)/banking/components/connect-button.tsx:39`
   - User authenticates with bank credentials (outside FiskAI)
   - User grants 90-day read access consent → `src/lib/bank-sync/providers/gocardless.ts:178-180`
   - Bank redirects back to callback URL with reference parameter

4. **Callback Handling**: Server processes authorization → `src/app/api/bank/callback/route.ts:8-45`
   - Retrieves requisition status via GET `/requisitions/{id}/` → `src/lib/bank-sync/providers/gocardless.ts:147-156`
   - Validates status is "LN" (linked) → `src/lib/bank-sync/providers/gocardless.ts:154-156`
   - Fetches linked account details and IBAN → `src/lib/bank-sync/providers/gocardless.ts:159-175`
   - Matches account by IBAN → `src/app/api/bank/callback/route.ts:33-45`

5. **Connection Establishment**: Database updated with connection → `src/app/api/bank/callback/route.ts:51-70`
   - Connection status set to CONNECTED → `src/app/api/bank/callback/route.ts:55`
   - Authorization and expiration timestamps recorded → `src/app/api/bank/callback/route.ts:56-57`
   - Bank account updated with provider details → `src/app/api/bank/callback/route.ts:62-67`

### Redirect URLs

- **Base URL**: Configured via `NEXT_PUBLIC_APP_URL` environment variable → `src/app/api/bank/connect/route.ts:62`
- **Callback Endpoint**: `${baseUrl}/api/bank/callback` → `src/app/api/bank/connect/route.ts:63`
- **Reference Parameter**: Uses bankAccountId for connection lookup → `src/app/api/bank/connect/route.ts:68`

## Provider Integration

### Provider Interface

All providers implement standard interface → `src/lib/bank-sync/provider.ts:11-50`:

- `name`: Provider identifier string
- `getInstitutionId(bankName)`: Map Croatian bank name to institution ID
- `createConnection(institutionId, redirectUrl, reference)`: Initiate OAuth flow
- `handleCallback(connectionId)`: Process authorization and retrieve accounts
- `fetchTransactions(providerAccountId, since)`: Pull transaction history
- `fetchBalance(providerAccountId)`: Get current account balance
- `isConnectionValid(connectionId)`: Verify connection status

### GoCardless Implementation

Primary provider for Croatian banks → `src/lib/bank-sync/providers/gocardless.ts:91-260`:

- **Base URL**: `https://bankaccountdata.gocardless.com/api/v2` → `src/lib/bank-sync/providers/gocardless.ts:13`
- **Authentication**: Bearer token with automatic refresh → `src/lib/bank-sync/providers/gocardless.ts:53-71`
- **Institution Mapping**: Croatian banks mapped to GoCardless IDs → `src/lib/bank-sync/providers/gocardless.ts:74-89`
  - Zagrebačka banka: `ZAGREBACKA_BANKA_ZABAHR2X` → `src/lib/bank-sync/providers/gocardless.ts:75-76`
  - Privredna banka Zagreb: `PBZ_PBZGHR2X` → `src/lib/bank-sync/providers/gocardless.ts:77-78`
  - Erste Bank: `ERSTE_BANK_GIBAHR2X` → `src/lib/bank-sync/providers/gocardless.ts:79-80`
  - Raiffeisen Bank: `RBA_RZBHHR2X` → `src/lib/bank-sync/providers/gocardless.ts:81-83`
  - OTP Banka: `OTP_BANKA_OTPVHR2X` → `src/lib/bank-sync/providers/gocardless.ts:84-85`
  - Addiko Bank: `ADDIKO_BANK_HAABHR22` → `src/lib/bank-sync/providers/gocardless.ts:86`
  - Hrvatska poštanska banka: `HPB_HABORHR2X` → `src/lib/bank-sync/providers/gocardless.ts:87-88`
- **Fallback Search**: API institution search if not in map → `src/lib/bank-sync/providers/gocardless.ts:110-123`
- **Transaction Fetching**: Booked transactions with date filter → `src/lib/bank-sync/providers/gocardless.ts:184-225`
- **Balance Types**: Prefers `interimAvailable` over `expected` → `src/lib/bank-sync/providers/gocardless.ts:236-238`

### Provider Configuration

- **Environment Variables**: → `.env.example:32-36`
  - `BANK_SYNC_PROVIDER=gocardless` (default provider)
  - `GOCARDLESS_SECRET_ID=your_secret_id` (required)
  - `GOCARDLESS_SECRET_KEY=your_secret_key` (required)
  - `GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2` (optional)
- **Configuration Check**: `isProviderConfigured()` validates credentials → `src/lib/bank-sync/providers/index.ts:22-30`
- **Provider Factory**: `getProvider()` returns configured provider → `src/lib/bank-sync/providers/index.ts:10-20`

## Transaction Synchronization

### Initial Sync

Triggered immediately after successful connection → `src/app/api/bank/callback/route.ts:72-99`:

1. **History Window**: Fetches last 90 days of transactions → `src/app/api/bank/callback/route.ts:73-74`
2. **Transaction Fetch**: Provider pulls booked transactions → `src/app/api/bank/callback/route.ts:77`
3. **Deduplication Processing**: Intelligent duplicate detection → `src/app/api/bank/callback/route.ts:79-83`
4. **Balance Update**: Current balance synced → `src/app/api/bank/callback/route.ts:86-94`
5. **Error Handling**: Sync errors logged but don't fail connection → `src/app/api/bank/callback/route.ts:96-99`

### Daily Synchronization

Background cron job runs daily at 5 AM UTC → `vercel.json:3-6`, `src/app/api/cron/bank-sync/route.ts:8-118`:

1. **Authorization Check**: Validates cron secret → `src/app/api/cron/bank-sync/route.ts:10-15`
2. **Account Discovery**: Finds all CONNECTED accounts → `src/app/api/cron/bank-sync/route.ts:26-29`
3. **Expiration Handling**: → `src/app/api/cron/bank-sync/route.ts:38-53`
   - Marks expired connections as EXPIRED → `src/app/api/cron/bank-sync/route.ts:39-46`
   - Logs warning for connections expiring in <7 days → `src/app/api/cron/bank-sync/route.ts:49-52`
4. **Transaction Sync**: Fetches new transactions since lastSyncAt → `src/app/api/cron/bank-sync/route.ts:64-67`
5. **Balance Refresh**: Updates current balance → `src/app/api/cron/bank-sync/route.ts:77-85`
6. **Error Recovery**: Logs errors but continues processing other accounts → `src/app/api/cron/bank-sync/route.ts:92-99`

### Deduplication Engine

Multi-tier duplicate detection → `src/lib/bank-sync/dedup.ts:131-184`:

**Tier 1: Strict Duplicate Check** (auto-skip) → `src/lib/bank-sync/dedup.ts:49-70`:

- Match by `externalId` (provider transaction ID) → `src/lib/bank-sync/dedup.ts:58`
- Match by exact date + amount + reference → `src/lib/bank-sync/dedup.ts:60-64`
- Skipped count tracked → `src/lib/bank-sync/dedup.ts:145-146`

**Tier 2: Fuzzy Duplicate Detection** (review queue) → `src/lib/bank-sync/dedup.ts:75-126`:

- Date window: ±2 days → `src/lib/bank-sync/dedup.ts:81-84`
- Amount tolerance: ±0.01 EUR → `src/lib/bank-sync/dedup.ts:91-94`
- Description similarity: >70% using Jaccard bigrams → `src/lib/bank-sync/dedup.ts:18-44, 99-101`
- Creates `PotentialDuplicate` record for manual review → `src/lib/bank-sync/dedup.ts:113-122`
- Avoids duplicate flags → `src/lib/bank-sync/dedup.ts:103-110`

**Transaction Insertion**: → `src/lib/bank-sync/dedup.ts:150-165`

- Source marked as `AIS_SYNC` → `src/lib/bank-sync/dedup.ts:162`
- ExternalId stored for future dedup → `src/lib/bank-sync/dedup.ts:161`
- Amount stored as absolute value → `src/lib/bank-sync/dedup.ts:156`
- Counterparty details preserved → `src/lib/bank-sync/dedup.ts:159-160`

## Disconnection

User can terminate automatic synchronization → `src/app/(dashboard)/banking/components/connect-button.tsx:47-73`:

1. **UI Confirmation**: Prompts user before disconnecting → `src/app/(dashboard)/banking/components/connect-button.tsx:48-50`
2. **API Request**: POST to `/api/bank/disconnect` → `src/app/(dashboard)/banking/components/connect-button.tsx:54-58`
3. **Server Validation**: Verifies account ownership → `src/app/api/bank/disconnect/route.ts:23-33`
4. **Database Update**: Atomic transaction → `src/app/api/bank/disconnect/route.ts:36-49`
   - Deletes BankConnection record → `src/app/api/bank/disconnect/route.ts:37-39`
   - Resets BankAccount sync fields to null → `src/app/api/bank/disconnect/route.ts:40-47`
   - Sets connectionStatus to MANUAL → `src/app/api/bank/disconnect/route.ts:45`
5. **UI Refresh**: Page reload shows updated status → `src/app/(dashboard)/banking/components/connect-button.tsx:67`

Note: Disconnection does NOT delete historical transactions synced before disconnect.

## Status Management

### Connection Status Lifecycle

Status progression → `prisma/schema.prisma:940-944`:

1. **MANUAL**: No provider connection, manual uploads only (default)
2. **CONNECTED**: Active connection with valid consent
3. **EXPIRED**: 90-day consent period ended, requires re-authorization

### Status Display

Visual indicators → `src/app/(dashboard)/banking/components/connection-badge.tsx:8-43`:

- **CONNECTED**: Green badge with dot, shows days until expiry if <14 days → `src/app/(dashboard)/banking/components/connection-badge.tsx:9-27`
- **EXPIRED**: Amber badge with dot, "Isteklo" label → `src/app/(dashboard)/banking/components/connection-badge.tsx:29-36`
- **MANUAL**: Gray badge, "Ručni uvoz" label → `src/app/(dashboard)/banking/components/connection-badge.tsx:38-42`

### Button States

Connection button adapts to status → `src/app/(dashboard)/banking/components/connect-button.tsx:75-112`:

- **CONNECTED**: Shows "Prekini vezu" (disconnect) with Unlink icon → `src/app/(dashboard)/banking/components/connect-button.tsx:76-92`
- **EXPIRED**: Shows "Obnovi vezu" (renew) with default variant → `src/app/(dashboard)/banking/components/connect-button.tsx:97, 107`
- **MANUAL**: Shows "Poveži banku" (connect) with outline variant → `src/app/(dashboard)/banking/components/connect-button.tsx:97, 107`
- **Loading**: Spinner replaces icon during operation → `src/app/(dashboard)/banking/components/connect-button.tsx:83-85, 102-104`

## Error Handling

### Connection Errors

| Scenario                | Behavior                              | Evidence                                   |
| ----------------------- | ------------------------------------- | ------------------------------------------ |
| Provider not configured | HTTP 503, "Provider not configured"   | `src/app/api/bank/connect/route.ts:16-19`  |
| Missing bankAccountId   | HTTP 400, "bankAccountId is required" | `src/app/api/bank/connect/route.ts:25-28`  |
| Bank account not found  | HTTP 404, "Bank account not found"    | `src/app/api/bank/connect/route.ts:37-40`  |
| Already connected       | HTTP 400, "Already connected"         | `src/app/api/bank/connect/route.ts:44-47`  |
| Bank not supported      | HTTP 400, "Bank not supported"        | `src/app/api/bank/connect/route.ts:55-58`  |
| Provider API error      | HTTP 500, error message from provider | `src/app/api/bank/connect/route.ts:96-100` |

### Callback Errors

| Scenario                    | Behavior                                        | Evidence                                            |
| --------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Missing reference parameter | Redirect to `/banking?error=missing_ref`        | `src/app/api/bank/callback/route.ts:12-14`          |
| Unknown connection          | Redirect to `/banking?error=unknown_connection` | `src/app/api/bank/callback/route.ts:24`             |
| Requisition not linked      | Error thrown, callback fails                    | `src/lib/bank-sync/providers/gocardless.ts:154-156` |
| IBAN not found              | Redirect to `/banking?error=iban_not_found`     | `src/app/api/bank/callback/route.ts:44`             |
| Callback processing error   | Redirect to `/banking?error=callback_failed`    | `src/app/api/bank/callback/route.ts:104`            |

### Sync Errors

Cron job error handling → `src/app/api/cron/bank-sync/route.ts:92-99`:

- **Per-Account Isolation**: Errors don't stop processing other accounts
- **Error Logging**: Console output with account ID and message → `src/app/api/cron/bank-sync/route.ts:93`
- **Result Tracking**: Each account returns status and error → `src/app/api/cron/bank-sync/route.ts:94-98`
- **Automatic Retry**: Next cron run attempts sync again

### User Feedback

Toast notifications for user actions → `src/app/(dashboard)/banking/components/connect-button.tsx:34, 41, 62, 66, 69`:

- **Connection failure**: "Povezivanje nije uspjelo" → `src/app/(dashboard)/banking/components/connect-button.tsx:34, 41`
- **Disconnect success**: "Veza prekinuta" → `src/app/(dashboard)/banking/components/connect-button.tsx:66`
- **Disconnect failure**: "Prekid veze nije uspio" → `src/app/(dashboard)/banking/components/connect-button.tsx:62, 69`

## Security

### Authentication

Multi-layer authorization → `src/app/api/bank/connect/route.ts:11-13`:

- **User Session**: `requireAuth()` validates authenticated user → `src/app/api/bank/connect/route.ts:11`
- **Company Context**: `requireCompany()` ensures user belongs to company → `src/app/api/bank/connect/route.ts:12`
- **Tenant Context**: `setTenantContext()` enforces data isolation → `src/app/api/bank/connect/route.ts:13`

### Ownership Validation

Bank account access control → `src/app/api/bank/connect/route.ts:32-40`:

- **Company Scoping**: Query filtered by `companyId` → `src/app/api/bank/connect/route.ts:33`
- **404 on Mismatch**: Returns not found if account doesn't belong to company → `src/app/api/bank/connect/route.ts:36-40`

### Credential Protection

Provider credentials never exposed to client:

- **Server-Side Only**: All GoCardless API calls from backend → `src/lib/bank-sync/providers/gocardless.ts:53-71`
- **Environment Variables**: Credentials stored in secure environment → `.env.example:34-35`
- **Token Caching**: In-memory only, not persisted to database → `src/lib/bank-sync/providers/gocardless.ts:16`

### OAuth Security

- **State Parameter**: BankAccountId used as reference for connection lookup → `src/app/api/bank/connect/route.ts:68`
- **Redirect Validation**: Callback only processes known references → `src/app/api/bank/callback/route.ts:18-24`
- **HTTPS Required**: OAuth redirects require secure base URL → `src/app/api/bank/connect/route.ts:62`

### Cron Protection

Background job authorization → `src/app/api/cron/bank-sync/route.ts:10-15`:

- **Bearer Token**: Requires `Authorization: Bearer ${CRON_SECRET}` header → `src/app/api/cron/bank-sync/route.ts:13`
- **401 Unauthorized**: Rejects requests without valid secret → `src/app/api/cron/bank-sync/route.ts:14`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication and company context
  - [[banking-accounts]] - Bank account management
  - GoCardless Bank Account Data API (external)
  - PSD2-compliant bank OAuth endpoints (external)
- **Depended by**:
  - [[banking-transactions]] - Synced transaction display
  - [[banking-reconciliation]] - Automatic transaction matching
  - [[banking-import]] - Coexists with manual imports

## Integrations

### GoCardless Bank Account Data API

- **Base URL**: `https://bankaccountdata.gocardless.com/api/v2` → `src/lib/bank-sync/providers/gocardless.ts:13`
- **Authentication**: JWT bearer token from secret credentials → `src/lib/bank-sync/providers/gocardless.ts:18-51`
- **Endpoints**:
  - `POST /token/new/`: Obtain access token → `src/lib/bank-sync/providers/gocardless.ts:30`
  - `GET /institutions/?country=HR`: List Croatian banks → `src/lib/bank-sync/providers/gocardless.ts:111-112`
  - `POST /requisitions/`: Create bank connection → `src/lib/bank-sync/providers/gocardless.ts:131`
  - `GET /requisitions/{id}/`: Check requisition status → `src/lib/bank-sync/providers/gocardless.ts:152`
  - `GET /accounts/{id}/`: Get account details → `src/lib/bank-sync/providers/gocardless.ts:166`
  - `GET /accounts/{id}/transactions/`: Fetch transactions → `src/lib/bank-sync/providers/gocardless.ts:206`
  - `GET /accounts/{id}/balances/`: Get current balance → `src/lib/bank-sync/providers/gocardless.ts:234`
- **Consent Period**: 90 days from authorization → `src/lib/bank-sync/providers/gocardless.ts:178-180`
- **Rate Limits**: Respected by daily sync schedule

### Vercel Cron

- **Schedule**: Daily at 5:00 AM UTC → `vercel.json:3-6`
- **Endpoint**: `/api/cron/bank-sync` → `src/app/api/cron/bank-sync/route.ts:8`
- **Authentication**: Bearer token with `CRON_SECRET` → `src/app/api/cron/bank-sync/route.ts:11-15`
- **Timeout**: 60 seconds max (Vercel default for cron)

## User Experience

### Loading States

- **Button Loading**: Spinner with disabled state during API calls → `src/app/(dashboard)/banking/components/connect-button.tsx:20, 83-85, 102-104`
- **Text Feedback**: "Slanje..." or similar loading indicators

### Success States

- **Connection Success**: Redirect to `/banking?success=connected` → `src/app/api/bank/callback/route.ts:101`
- **Badge Update**: Shows green CONNECTED badge with expiry countdown → `src/app/(dashboard)/banking/components/connection-badge.tsx:9-27`
- **Initial Sync**: Transactions immediately visible after connection
- **Balance Refresh**: Current balance updated on banking page

### Error States

- **Connection Errors**: Toast notification with error message → `src/app/(dashboard)/banking/components/connect-button.tsx:34, 41`
- **URL Parameters**: Error codes in redirect URL for callback failures → `src/app/api/bank/callback/route.ts:13, 24, 44, 104`
- **Retry Available**: Connect button remains enabled for retry attempts

### Expiration Warnings

- **7-Day Warning**: Badge shows days remaining if <14 days → `src/app/(dashboard)/banking/components/connection-badge.tsx:20-24`
- **Expired State**: Amber badge with "Isteklo" label → `src/app/(dashboard)/banking/components/connection-badge.tsx:29-36`
- **Reconnect Button**: "Obnovi vezu" button for expired connections → `src/app/(dashboard)/banking/components/connect-button.tsx:107`

## Environment Configuration

Required environment variables:

```env
# Application base URL for OAuth redirects
NEXT_PUBLIC_APP_URL=https://your-app.example.com

# Bank sync provider configuration
BANK_SYNC_PROVIDER=gocardless
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2

# Cron job authentication
CRON_SECRET=generate_with_openssl_rand_hex_32
```

Configuration in `.env.example:12, 32-40`

## Verification Checklist

- [x] User can initiate bank connection from banking page
- [x] Connect button only shown for MANUAL or EXPIRED accounts
- [x] System validates provider configuration before connection
- [x] System checks bank account ownership before connection
- [x] Bank name mapped to GoCardless institution ID
- [x] OAuth requisition created with correct redirect URL
- [x] BankConnection record created with provider details
- [x] User redirected to bank authorization page
- [x] OAuth callback processes authorization successfully
- [x] System matches account by IBAN after authorization
- [x] Connection status updated to CONNECTED
- [x] Authorization and expiration timestamps recorded
- [x] Initial sync fetches 90 days of transaction history
- [x] Transactions processed through deduplication engine
- [x] Strict duplicates skipped by externalId or date+amount+reference
- [x] Fuzzy duplicates flagged for manual review
- [x] Current balance fetched and updated
- [x] Daily cron job syncs all connected accounts at 5 AM
- [x] Expired connections marked as EXPIRED status
- [x] Expiring connections (<7 days) logged for notification
- [x] Per-account errors isolated in cron processing
- [x] Connection badge shows status with expiry countdown
- [x] Connect button adapts to connection status
- [x] User can disconnect and reset to MANUAL mode
- [x] Disconnection requires user confirmation
- [x] Toast notifications provide user feedback
- [x] Error codes passed via URL parameters
- [x] Tenant isolation enforced for all operations
- [x] Provider credentials never exposed to client
- [x] Cron endpoint protected with bearer token

## Evidence Links

1. `src/app/api/bank/connect/route.ts:9-102` - Connection initiation API endpoint
2. `src/app/api/bank/callback/route.ts:8-106` - OAuth callback handler and initial sync
3. `src/app/api/bank/disconnect/route.ts:8-59` - Disconnection API endpoint
4. `src/app/(dashboard)/banking/components/connect-button.tsx:1-112` - Connection UI component
5. `src/app/(dashboard)/banking/components/connection-badge.tsx:1-43` - Status badge component
6. `src/app/(dashboard)/banking/page.tsx:1-269` - Banking dashboard page
7. `src/lib/bank-sync/provider.ts:1-50` - Provider abstraction interface
8. `src/lib/bank-sync/providers/gocardless.ts:1-260` - GoCardless implementation
9. `src/lib/bank-sync/providers/index.ts:1-30` - Provider factory and configuration
10. `src/lib/bank-sync/dedup.ts:1-224` - Deduplication engine with fuzzy matching
11. `src/lib/bank-sync/types.ts:1-33` - TypeScript interfaces for providers
12. `src/app/api/cron/bank-sync/route.ts:1-118` - Daily synchronization cron job
13. `prisma/schema.prisma:430-519` - BankAccount and BankConnection models
14. `prisma/schema.prisma:934-949` - SyncProvider and ConnectionStatus enums
15. `.env.example:12, 32-40` - Environment variable configuration
16. `vercel.json:1-12` - Cron job schedule configuration
17. `src/lib/auth-utils.ts:1-47` - Authentication and authorization utilities
18. `docs/plans/2024-12-14-bank-sync-ais-design.md:1-200` - Architecture and design documentation
