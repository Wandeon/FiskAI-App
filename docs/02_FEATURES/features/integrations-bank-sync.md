# Feature: Bank Sync Integration

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Provides secure integration with leading open banking providers (GoCardless/Nordigen, Plaid, SaltEdge) to enable automated bank account synchronization via PSD2-compliant Account Information Services (AIS). The feature establishes OAuth-based connections with financial institutions, retrieves transaction history up to 24 months, maintains automatic daily synchronization, and implements intelligent deduplication with fuzzy matching. Supports 5,000+ banks across Europe and beyond, with 90-day consent periods, webhook notifications, and enterprise-grade security including AES-256 encryption and quantum-resistant cryptography considerations.

## User Entry Points

| Type    | Path                    | Description                                      |
| ------- | ----------------------- | ------------------------------------------------ |
| API     | /api/bank/connect       | OAuth flow initiation for bank connections       |
| API     | /api/bank/callback      | Authorization callback handler                   |
| API     | /api/bank/sync          | Manual synchronization trigger                   |
| Webhook | /api/webhooks/bank-sync | Provider webhook handler for transaction updates |

## Core Flow

1. User initiates bank connection via banking dashboard
2. System validates provider configuration and credentials
3. Server creates link token with required scopes and redirect URL
4. User redirected to provider's OAuth authorization interface
5. User authenticates with bank credentials (outside FiskAI)
6. User grants account information access consent (90-180 days)
7. Bank redirects to callback endpoint with authorization code
8. Server exchanges authorization code for permanent access token
9. System securely stores access token with encryption
10. Initial sync fetches historical transactions (up to 24 months)
11. Transactions processed through multi-tier deduplication engine
12. Current account balances retrieved and updated
13. Connection status set to CONNECTED with expiration timestamp
14. Daily cron job maintains synchronization automatically
15. Webhook notifications trigger real-time transaction updates
16. Expired connections automatically marked for re-authorization
17. User can disconnect and revoke access at any time

## Key Modules

| Module                  | Purpose                                        | Technology                             |
| ----------------------- | ---------------------------------------------- | -------------------------------------- |
| GoCardless Provider     | PSD2-compliant AIS for European banks          | Bank Account Data API v2               |
| Plaid Provider          | Bank connectivity for US and European markets  | Plaid Link + API                       |
| SaltEdge Provider       | Open banking gateway with global coverage      | Account Information API v6             |
| Token Manager           | OAuth token lifecycle and refresh management   | JWT with automatic renewal             |
| Transaction Sync Engine | Intelligent data retrieval and processing      | Date-based incremental sync            |
| Deduplication Service   | Multi-tier duplicate detection and prevention  | Fuzzy matching with Jaccard similarity |
| Webhook Handler         | Real-time transaction event processing         | OAuth 2.0 secured endpoints            |
| Balance Reconciliation  | Account balance synchronization and validation | Preferred balance type selection       |
| Error Recovery          | Resilient error handling with automatic retry  | Exponential backoff strategy           |

## Provider Comparison

### GoCardless (formerly Nordigen)

**Coverage**: 2,300+ banks across 31 European countries

**Pricing Model**: Freemium

- Free tier: 50 active connections per month
- Pay-as-you-go: Beyond 50 connections
- Enterprise: Custom pricing for high-volume usage

**Key Features**:

- 100% PSD2 compliant
- Up to 24 months transaction history
- 90-day consent period
- Free access to basic account information
- Croatian bank support (Zagrebacka, PBZ, Erste, Raiffeisen, OTP, Addiko, HPB)
- Freemium model ideal for startups and SMBs

**API Details**:

- Base URL: `https://bankaccountdata.gocardless.com/api/v2`
- Authentication: JWT bearer tokens with automatic refresh
- Rate limits: 4 API calls per day per account (bank-dependent)
- Transaction types: Booked transactions with pending support
- Balance types: interimAvailable, expected, closingBooked

**Best For**: European fintech companies, Croatian market, budget-conscious startups

### Plaid

**Coverage**: 12,000+ financial institutions (US-focused with European expansion)

**Pricing Model**: Pay-per-use

- Varies by product and institution type
- Higher costs for premium institutions
- Volume discounts available
- Free sandbox environment

**Key Features**:

- Widespread US adoption (nearly 50% of US adults)
- ISO 27001, ISO 27701, SOC 2 compliant
- Advanced fraud detection with machine learning
- Tokenization for enhanced security
- Same-day ACH support
- Real-time balance checks
- Investment account support
- Multi-factor authentication handling

**API Details**:

- Link token-based initialization (public_key deprecated 2025)
- Access tokens never expire (but may require updates)
- Public tokens expire after 30 minutes
- Link tokens expire after 4 hours
- Webhook-driven transaction updates (INITIAL_UPDATE, HISTORICAL_UPDATE)
- Processor token support for payment processors

**Best For**: US market focus, investment accounts, payment initiation, established fintech companies

### SaltEdge

**Coverage**: 5,000+ banks worldwide with international reach

**Pricing Model**: Enterprise-focused

- Custom pricing based on volume
- Partner API for institutions without licenses
- Sandbox environment for testing
- Production access requires compliance review

**Key Features**:

- Global coverage beyond Europe
- Partner API for non-licensed institutions
- Direct API for ISO 27001 certified parties
- 2048-bit encryption for sensitive data
- Asymmetric encryption for credentials
- Sandbox and fake providers for testing
- Pagination support for large datasets
- Connect widget for easy integration

**API Details**:

- Base URL: `https://www.saltedge.com/api/v6`
- Authentication: App ID and Secret
- Multiple API versions (v5, v6)
- Customer-based connection model
- Requisition-based flow
- Comprehensive error codes
- Direct API requires manual activation

**Best For**: Global operations, institutional clients, regulated entities, high-volume enterprise use

## OAuth Implementation

### Link Token Creation (Plaid Flow)

**Step 1: Generate Link Token**

```
POST /link/token/create
{
  "client_id": "YOUR_CLIENT_ID",
  "secret": "YOUR_SECRET",
  "user": {
    "client_user_id": "unique-user-id"
  },
  "client_name": "FiskAI",
  "products": ["transactions", "auth"],
  "country_codes": ["HR", "US", "GB"],
  "language": "hr",
  "redirect_uri": "https://app.fiskai.com/api/bank/callback",
  "webhook": "https://app.fiskai.com/api/webhooks/bank-sync"
}

Response:
{
  "link_token": "link-sandbox-abc123...",
  "expiration": "2025-12-15T10:00:00Z"
}
```

**Step 2: Initialize Link**
Client-side integration using link_token to open Plaid Link interface. User selects institution, authenticates, and grants consent.

**Step 3: Exchange Public Token**

```
POST /item/public_token/exchange
{
  "client_id": "YOUR_CLIENT_ID",
  "secret": "YOUR_SECRET",
  "public_token": "public-sandbox-xyz789..."
}

Response:
{
  "access_token": "access-sandbox-permanent-token...",
  "item_id": "item-unique-id",
  "request_id": "request-tracking-id"
}
```

### Requisition Flow (GoCardless/SaltEdge)

**Step 1: Authenticate Provider**

```
POST /api/v2/token/new/
{
  "secret_id": "YOUR_SECRET_ID",
  "secret_key": "YOUR_SECRET_KEY"
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "access_expires": 86400,
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_expires": 2592000
}
```

**Step 2: Create Requisition**

```
POST /api/v2/requisitions/
Headers: Authorization: Bearer {access_token}
{
  "institution_id": "ZAGREBACKA_BANKA_ZABAHR2X",
  "redirect": "https://app.fiskai.com/api/bank/callback",
  "reference": "bank-account-uuid",
  "user_language": "HR",
  "agreement": "90-day-agreement-id"
}

Response:
{
  "id": "requisition-uuid",
  "status": "CR",
  "link": "https://ob.gocardless.com/psd2/start/...",
  "accounts": [],
  "reference": "bank-account-uuid"
}
```

**Step 3: Process Callback**
After user authorization, check requisition status and retrieve linked accounts.

```
GET /api/v2/requisitions/{id}/
Response:
{
  "id": "requisition-uuid",
  "status": "LN",
  "accounts": ["account-id-1", "account-id-2"],
  "reference": "bank-account-uuid"
}
```

### Webhook Security

**OAuth 2.0 Webhook Authentication**
Providers send webhooks with OAuth 2.0 bearer tokens:

```
POST /api/webhooks/bank-sync
Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json

Payload:
{
  "event_type": "TRANSACTIONS_UPDATED",
  "item_id": "item-unique-id",
  "account_id": "account-unique-id",
  "timestamp": "2025-12-15T09:30:00Z"
}
```

**JWT Verification (Enable Banking)**
Webhooks secured with signed JWT tokens:

```
Headers:
  Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...

JWT Header:
{
  "alg": "RS256",
  "x5u": "https://api.enablebanking.com/public-key.pem"
}

Verification Steps:
1. Extract JWT from Authorization header
2. Fetch public key from x5u URL
3. Verify signature using RS256 algorithm
4. Validate token expiration
5. Process webhook payload
```

## Transaction Synchronization

### Initial Sync Strategy

**History Window Selection**:

- GoCardless: Up to 24 months of transaction history
- Plaid: Up to 24 months (institution-dependent)
- SaltEdge: Varies by institution (typically 12-24 months)

**Sync Process**:

1. Calculate date range from connectionAuthorizedAt minus history window
2. Fetch transactions in batches with pagination
3. Process each transaction through deduplication pipeline
4. Store with source marker (AIS_SYNC) and externalId
5. Update lastSyncAt timestamp on success
6. Fetch and store current account balance
7. Log sync statistics (inserted, skipped, flagged)

### Incremental Sync

**Daily Cron Job** (5:00 AM UTC):

```
Workflow:
1. Query all CONNECTED bank accounts
2. Check connection expiration status
   - If expired: Mark as EXPIRED, skip sync
   - If expires < 7 days: Log warning for notification
3. For each active connection:
   a. Fetch transactions since lastSyncAt
   b. Process through deduplication engine
   c. Update account balance
   d. Update lastSyncAt timestamp
   e. Log sync results
4. Handle errors with isolation (continue processing others)
5. Return summary with success/failure counts
```

**Webhook-Triggered Sync**:

```
Webhook Events:
- INITIAL_UPDATE: First transaction data ready
- HISTORICAL_UPDATE: Historical data processing complete
- DEFAULT_UPDATE: New transactions available
- TRANSACTIONS_REMOVED: Transactions deleted by bank

Handler Logic:
1. Verify webhook authenticity (JWT signature)
2. Extract item_id/account_id from payload
3. Lookup connection in database
4. Trigger immediate sync for affected account
5. Process new/updated transactions only
6. Send real-time notification to user (optional)
```

### Deduplication Engine

**Tier 1: Strict Duplicate Detection** (Auto-skip)

Criteria for exact match:

- Match by externalId (provider transaction ID)
- OR exact date + amount + reference match
- OR exact date + amount + counterparty match

Action: Skip insertion, increment skipped counter

**Tier 2: Fuzzy Duplicate Detection** (Review queue)

Criteria for potential duplicate:

- Date within ±2 days window
- Amount within ±0.01 EUR tolerance
- Description similarity >70% (Jaccard bigram algorithm)

Jaccard Bigram Calculation:

```
Function: calculateSimilarity(str1, str2)
1. Convert strings to lowercase
2. Generate bigrams (character pairs)
   "hello" -> ["he", "el", "ll", "lo"]
3. Calculate Jaccard coefficient:
   similarity = intersection(bigrams1, bigrams2) / union(bigrams1, bigrams2)
4. Return percentage: similarity * 100
```

Action: Create PotentialDuplicate record for manual review

**Tier 3: Insert New Transaction**

Store transaction with:

- source: AIS_SYNC
- externalId: Provider transaction ID
- amount: Absolute value
- type: INCOME or EXPENSE (derived from amount sign)
- counterparty: Bank account holder or merchant name
- reference: Payment reference or description
- transactionDate: Booking date from provider
- valueDate: Value date (when funds available)

## Balance Reconciliation

**Balance Type Priority**:

GoCardless:

1. interimAvailable (preferred) - Real-time available balance
2. expected - Expected balance after pending
3. closingBooked - End-of-day balance

Plaid:

1. available - Current available balance (preferred)
2. current - Current balance including pending
3. limit - Credit limit (for credit accounts)

SaltEdge:

1. interimAvailable (preferred)
2. expected
3. closingBooked

**Reconciliation Process**:

1. Fetch balance from provider API
2. Select balance type based on priority
3. Compare with stored currentBalance
4. If difference > threshold (e.g., 0.10 EUR):
   - Log discrepancy for investigation
   - Update balance with provider value
   - Flag for manual review if large difference
5. Store balanceLastUpdated timestamp

## Connection Status Management

**Status Lifecycle**:

1. **MANUAL**: Initial state, no provider connection
   - User uploads transactions manually
   - No automatic synchronization
   - Connect button shows "Poveži banku"

2. **PENDING**: Connection initiated, awaiting authorization
   - Requisition created, user redirected
   - Temporary state during OAuth flow
   - Badge shows "U tijeku..."

3. **CONNECTED**: Active connection with valid consent
   - Automatic daily synchronization enabled
   - Green badge with expiry countdown
   - Disconnect button available

4. **EXPIRED**: Consent period ended (90 days)
   - Synchronization disabled
   - Amber badge with "Isteklo" label
   - Reconnect button shows "Obnovi vezu"

5. **ERROR**: Connection failed or provider error
   - Red badge with error indicator
   - Last error message stored
   - Retry button available

**Expiration Handling**:

- Daily cron checks expiresAt for all connections
- Connections with expiresAt < now marked as EXPIRED
- Connections with expiresAt < now + 7 days logged for user notification
- Email notification sent at 7 days, 3 days, 1 day before expiry
- User can re-authorize via "Obnovi vezu" button

## Security Best Practices

### Encryption Standards

**Data at Rest**:

- Access tokens encrypted with AES-256 before database storage
- Encryption keys stored in secure key management system (AWS KMS, Azure Key Vault)
- Regular key rotation (quarterly recommended)
- Bank account numbers masked in UI (show last 4 digits only)

**Data in Transit**:

- TLS 1.3 required for all provider API communication
- HTTPS enforced for OAuth redirects (no HTTP fallback)
- Certificate pinning for critical API endpoints
- Perfect forward secrecy (PFS) enabled

### Authentication & Authorization

**Multi-Factor Authentication**:

- User session validation via requireAuth()
- Company ownership verification via requireCompany()
- Tenant context isolation via setTenantContext()
- Bank account access control by companyId

**Provider Credentials**:

- Stored in environment variables (never in code)
- Separate credentials per environment (dev, staging, prod)
- Credentials never exposed to client-side code
- Token refresh handled server-side only

### Webhook Validation

**Security Measures**:

1. Verify webhook signature using provider's public key
2. Validate JWT token expiration timestamp
3. Check webhook source IP against provider whitelist
4. Implement replay attack prevention (nonce/timestamp check)
5. Rate limit webhook endpoint (prevent DoS)
6. Log all webhook events for audit trail

### Quantum-Resistant Cryptography

**2025 Considerations**:

- Assess current encryption algorithms for quantum vulnerabilities
- Plan migration to post-quantum cryptography (PQC) algorithms
- NIST-approved algorithms: CRYSTALS-Kyber, CRYSTALS-Dilithium
- Target: Quantum-ready by 2030, quantum-resistant by 2035
- Hybrid approach: Classical + PQC during transition period

### Compliance

**Regulatory Adherence**:

- PSD2 compliance for European operations
- GDPR compliance for personal financial data
- PCI DSS for payment card data (if applicable)
- CCPA compliance for California users
- SOC 2 Type II audit recommendations
- ISO 27001 certification alignment

**Data Privacy**:

- User consent required before bank connection
- Clear disclosure of data collection and usage
- Right to disconnect and delete synced data
- Data retention policy (default: 7 years for tax purposes)
- Anonymization of data for analytics

## Error Handling

### Provider API Errors

| Error Type              | HTTP Code | Handling Strategy                               |
| ----------------------- | --------- | ----------------------------------------------- |
| Invalid credentials     | 401       | Log error, notify admin, disable provider       |
| Rate limit exceeded     | 429       | Exponential backoff, retry after delay          |
| Institution unavailable | 503       | Retry up to 3 times, flag for manual check      |
| Invalid token           | 401       | Attempt token refresh, re-authenticate if fails |
| Account not found       | 404       | Mark connection as error, notify user           |
| Consent expired         | 403       | Mark connection as EXPIRED, prompt re-auth      |
| Network timeout         | 504       | Retry with exponential backoff (max 3 attempts) |

### User-Facing Errors

**Connection Errors**:

- Provider not configured: "Bank sync trenutno nije dostupan"
- Bank not supported: "Ova banka nije podržana. Kontaktirajte podršku."
- Already connected: "Račun već povezan. Prekinite vezu prije ponovnog povezivanja."
- Authorization failed: "Povezivanje nije uspjelo. Pokušajte ponovno."

**Sync Errors**:

- Temporary failure: Silent retry on next cron run
- Persistent failure (3+ attempts): Email notification to user
- Data inconsistency: Flag transaction for manual review
- Balance mismatch: Log discrepancy, use provider value

### Error Recovery

**Automatic Retry Logic**:

```
Strategy: Exponential Backoff
- Attempt 1: Immediate
- Attempt 2: Wait 30 seconds
- Attempt 3: Wait 2 minutes
- Attempt 4: Wait 10 minutes
- Attempt 5: Wait 1 hour
- Max attempts: 5 within 24 hours

After max attempts:
- Mark connection with ERROR status
- Store last error message
- Send notification to user
- Admin dashboard alert for investigation
```

## Provider-Specific Implementation

### GoCardless Integration

**Configuration**:

```env
BANK_SYNC_PROVIDER=gocardless
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2
```

**Croatian Bank Mapping**:

- Zagrebačka banka: ZAGREBACKA_BANKA_ZABAHR2X
- Privredna banka Zagreb: PBZ_PBZGHR2X
- Erste Bank: ERSTE_BANK_GIBAHR2X
- Raiffeisen Bank: RBA_RZBHHR2X
- OTP Banka: OTPVHR2X
- Addiko Bank: HAABHR22
- Hrvatska poštanska banka: HPB_HABORHR2X

**Key Features**:

- Freemium model (50 free connections/month)
- 90-day consent period
- Croatian bank focus
- PSD2 compliant
- No longer accepting new registrations (as of July 2025)

### Plaid Integration

**Configuration**:

```env
BANK_SYNC_PROVIDER=plaid
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox|development|production
PLAID_WEBHOOK_URL=https://app.fiskai.com/api/webhooks/bank-sync
```

**Link Initialization**:

```javascript
const linkToken = await plaidClient.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: "FiskAI",
  products: ["transactions", "auth"],
  country_codes: ["HR", "US"],
  language: "hr",
  redirect_uri: process.env.NEXT_PUBLIC_APP_URL + "/api/bank/callback",
  webhook: process.env.PLAID_WEBHOOK_URL,
})
```

**Transaction Sync**:

```javascript
const response = await plaidClient.transactionsSync({
  access_token: accessToken,
  cursor: lastCursor,
  count: 500,
})

// Process: response.added, response.modified, response.removed
// Update cursor for next sync: response.next_cursor
```

### SaltEdge Integration

**Configuration**:

```env
BANK_SYNC_PROVIDER=saltedge
SALTEDGE_APP_ID=your_app_id
SALTEDGE_SECRET=your_secret
SALTEDGE_BASE_URL=https://www.saltedge.com/api/v6
```

**Connection Flow**:

```javascript
// Step 1: Create customer
const customer = await saltEdgeClient.createCustomer({
  identifier: userId,
})

// Step 2: Create connection with Salt Edge Connect
const connection = await saltEdgeClient.createConnection({
  customer_id: customer.id,
  country_code: "HR",
  provider_code: "zagrebacka_banka_hr",
  consent: {
    scopes: ["account_details", "transactions_details"],
    from_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
  return_to: process.env.NEXT_PUBLIC_APP_URL + "/api/bank/callback",
})

// User redirected to: connection.connect_url
```

## Performance Optimization

**Caching Strategy**:

- Provider access tokens cached in-memory (with 1-minute safety margin)
- Institution mappings cached for 24 hours
- Transaction deduplication cache (last 90 days) for faster lookups
- Balance updates cached for 1 hour (avoid excessive API calls)

**Batch Processing**:

- Transaction fetching: 500 transactions per API call (paginated)
- Deduplication processing: Batch database queries for candidate matches
- Database inserts: Bulk insert transactions (up to 100 at a time)
- Cron job: Process accounts in parallel (max 5 concurrent)

**Rate Limit Management**:

- Track API call count per account per day
- Implement adaptive sync frequency based on transaction volume
- Reduce sync frequency for low-activity accounts (weekly instead of daily)
- Priority queue: Active accounts synced before inactive ones

## Monitoring & Observability

**Key Metrics**:

- Connection success rate (target: >98%)
- Average connection time (target: <10 seconds)
- Sync success rate (target: >99%)
- Average sync duration (target: <5 seconds per account)
- Deduplication accuracy (strict: 100%, fuzzy: >95%)
- API error rate by provider (target: <1%)
- Webhook delivery success rate (target: >99%)

**Logging**:

- Connection events (initiated, authorized, expired, disconnected)
- Sync events (started, completed, failed) with statistics
- Deduplication results (inserted, skipped, flagged)
- Provider API errors with full request/response details
- Webhook events with payload and processing result

**Alerting**:

- Provider API downtime >5 minutes
- Sync failure rate >5% for 1 hour
- Connection expiration rate >10% daily
- Balance discrepancy >1% of account balance
- Webhook processing delay >5 minutes

## Testing Strategy

**Unit Tests**:

- Provider interface implementation for each provider
- OAuth token management (creation, refresh, expiration)
- Deduplication algorithms (strict and fuzzy matching)
- Balance reconciliation logic
- Error handling and retry logic

**Integration Tests**:

- End-to-end OAuth flow with sandbox providers
- Transaction synchronization with test bank accounts
- Webhook delivery and processing
- Connection expiration and renewal
- Provider failover scenarios

**Test Bank Accounts**:

- GoCardless: "Fake Bank Simple" (sandbox)
- Plaid: "Tartan Bank", "Houndstooth Bank" (sandbox)
- SaltEdge: "Fake Bank with SMS", "Fake Bank Simple" (sandbox)

## User Experience

**Loading States**:

- Connection button: Spinner during OAuth flow
- Sync status: "Sinkronizacija u tijeku..." with progress indicator
- Transaction list: Skeleton loaders during fetch

**Success Feedback**:

- Connection success: Green toast + redirect to banking page
- Sync complete: Badge update + transaction count notification
- Balance updated: Smooth transition with highlight animation

**Error Feedback**:

- Connection failed: Red toast with clear error message + retry button
- Sync warning: Amber notification icon with details on hover
- Expired connection: Prominent banner with "Obnovi vezu" CTA

## Future Enhancements

**Roadmap**:

1. Multi-account selection during connection (single OAuth flow for multiple accounts)
2. Investment account support (stocks, bonds, mutual funds)
3. Credit card synchronization with statement parsing
4. Loan account tracking with payment schedules
5. Real-time transaction notifications via push/email
6. Smart categorization using AI/ML based on sync history
7. Budget alerts based on synced transaction patterns
8. Multi-currency account support with exchange rate handling
9. Open Banking payment initiation (PIS) integration
10. Scheduled payment automation based on recurring transactions

## Dependencies

- **Depends on**:
  - Authentication system (user sessions, company context)
  - Bank account management (account CRUD operations)
  - Transaction management (storage and display)
  - Encryption service (token encryption/decryption)
  - Email notification system (expiration warnings)
  - Background job scheduler (cron jobs)

- **Depended by**:
  - Banking dashboard (displays sync status)
  - Transaction list (shows synced transactions)
  - Reconciliation module (uses synced data)
  - Reports (includes synced transaction data)
  - Analytics (tracks bank account trends)

## Environment Configuration

**Required Variables**:

```env
# Application
NEXT_PUBLIC_APP_URL=https://app.fiskai.com

# Provider Selection (choose one)
BANK_SYNC_PROVIDER=gocardless|plaid|saltedge

# GoCardless
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox|development|production
PLAID_WEBHOOK_URL=

# SaltEdge
SALTEDGE_APP_ID=
SALTEDGE_SECRET=
SALTEDGE_BASE_URL=https://www.saltedge.com/api/v6

# Encryption
ENCRYPTION_KEY=generate_with_openssl_rand_hex_32

# Cron
CRON_SECRET=generate_with_openssl_rand_hex_32
```

## Verification Checklist

- [x] Provider abstraction interface supports multiple providers
- [x] OAuth flow completes successfully for test bank
- [x] Link token creation includes all required parameters
- [x] Access token securely stored with encryption
- [x] Initial sync fetches historical transactions correctly
- [x] Transaction deduplication prevents exact duplicates
- [x] Fuzzy matching flags potential duplicates for review
- [x] Balance reconciliation handles multiple balance types
- [x] Daily cron job syncs all connected accounts
- [x] Connection expiration detected and marked appropriately
- [x] Webhook endpoint validates signatures correctly
- [x] Webhook events trigger immediate sync
- [x] Error handling includes automatic retry logic
- [x] Provider API errors logged with full details
- [x] User receives clear feedback on connection status
- [x] Disconnect flow revokes access and clears tokens
- [x] Multi-tenant isolation enforced for all operations
- [x] Rate limits respected for each provider
- [x] Performance metrics tracked and logged
- [x] Security best practices implemented (TLS 1.3, AES-256)

## Evidence Links

1. [GoCardless Bank Account Data API Overview](https://developer.gocardless.com/bank-account-data/overview/)
2. [GoCardless Quickstart Guide](https://developer.gocardless.com/bank-account-data/quick-start-guide)
3. [GoCardless Account Transactions Documentation](https://developer.gocardless.com/bank-account-data/transactions)
4. [Plaid API Documentation](https://plaid.com/docs/api/)
5. [Plaid Link Overview](https://plaid.com/docs/link/)
6. [Plaid Auth Product Documentation](https://plaid.com/docs/api/products/auth/)
7. [Salt Edge Account Information API v5](https://docs.saltedge.com/account_information/v5/)
8. [Salt Edge API Reference v6](https://docs.saltedge.com/v6/api_reference/)
9. [Open Banking API Aggregators Directory](https://www.openbankingtracker.com/api-aggregators)
10. [PSD2 and Open Banking Guide 2025](https://blog.finexer.com/guide-to-psd2-regulation-for-open-banking/)
11. [Bank Sync Webhook Security Strategies](https://www.hooklistener.com/learn/webhook-authentication-strategies)
12. [Plaid Transactions Sync Documentation](https://plaid.com/blog/transactions-sync/)
13. [Financial Data Encryption Best Practices](https://www.phoenixstrategy.group/blog/financial-data-encryption-compliance-best-practices)
14. [Bank Account Aggregation Security Guide](https://fastercapital.com/content/Guarding-Your-Finances--Prioritizing-Data-Security-in-Account-Aggregation.html)
