# Bank Sync AIS Integration Design

**Created:** 2024-12-14
**Status:** Approved
**Author:** Claude + Human collaboration

---

## Overview

Integrate automatic bank transaction syncing via PSD2-compliant Account Information Services (AIS). Primary provider: GoCardless Bank Account Data (formerly Nordigen). Architecture supports future provider swaps (Plaid, Salt Edge, etc.).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coexistence with manual import | Parallel systems | Flexibility - user can sync AND upload manually |
| Deduplication | Hybrid (strict auto + fuzzy review) | Auto-handles obvious cases, surfaces edge cases |
| Sync frequency | Daily cron at 6 AM | Simple, respects rate limits, fits accountant workflow |
| Expiration handling | Proactive alerts (7 days + on expiry) | Not annoying but ensures continuity |
| Bank selection | Auto-detect from existing IBAN | User already has bank account with IBAN in app |
| Multi-account from bank | Match by IBAN only | Keep it focused, don't auto-create accounts |

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FiskAI                                  │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ BankAccount  │───▶│    Bank      │───▶│ BankTransaction  │  │
│  │ (has IBAN)   │    │  Connection  │    │ (deduplicated)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                     ▲            │
│         │                   │                     │            │
│         ▼                   ▼                     │            │
│  ┌──────────────┐    ┌──────────────┐    ┌───────┴──────────┐  │
│  │ Manual       │    │ Daily Cron   │    │ Dedup Engine     │  │
│  │ Import       │───▶│ (6 AM)       │───▶│ (strict + fuzzy) │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │   BankSyncProvider        │
                │   (Abstract Interface)    │
                └───────────────────────────┘
                     │              │
                     ▼              ▼
              ┌───────────┐  ┌───────────┐
              │ GoCardless│  │  Future   │
              │ Provider  │  │ Providers │
              └───────────┘  └───────────┘
```

### Provider Abstraction

```typescript
interface BankSyncProvider {
  name: string

  // Get institution ID for a bank name
  getInstitutionId(bankName: string): Promise<string | null>

  // Create a connection (returns redirect URL)
  createConnection(
    bankAccountId: string,
    institutionId: string,
    redirectUrl: string
  ): Promise<{ connectionId: string; redirectUrl: string }>

  // Handle callback after user auth
  handleCallback(
    connectionId: string,
    callbackParams: Record<string, string>
  ): Promise<{ accounts: ProviderAccount[]; expiresAt: Date }>

  // Fetch transactions for an account
  fetchTransactions(
    providerAccountId: string,
    since: Date
  ): Promise<ProviderTransaction[]>

  // Check connection status
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>
}
```

---

## Database Schema Changes

### BankAccount (extend existing)

```prisma
model BankAccount {
  // ... existing fields ...

  // Sync provider fields
  syncProvider          SyncProvider?     // GOCARDLESS | PLAID | SALTEDGE
  syncProviderAccountId String?           // Provider's account ID
  connectionStatus      ConnectionStatus  @default(MANUAL)
  connectionExpiresAt   DateTime?
  lastSyncAt            DateTime?

  connection            BankConnection?
}

enum SyncProvider {
  GOCARDLESS
  PLAID
  SALTEDGE
}

enum ConnectionStatus {
  MANUAL              // No provider, manual upload only
  CONNECTED           // Active provider sync
  EXPIRED             // Consent expired, needs re-auth
}
```

### BankConnection (new)

```prisma
model BankConnection {
  id                    String   @id @default(cuid())
  companyId             String
  bankAccountId         String   @unique

  // Provider info
  provider              SyncProvider
  providerConnectionId  String            // requisitionId for GoCardless
  institutionId         String
  institutionName       String

  // Status
  status                ConnectionStatus
  authorizedAt          DateTime?
  expiresAt             DateTime?
  lastError             String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  company               Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  bankAccount           BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([status])
}
```

### BankTransaction (extend existing)

```prisma
model BankTransaction {
  // ... existing fields ...

  // Provider tracking
  externalId            String?           // Provider's transaction ID (for dedup)
  source                TransactionSource @default(MANUAL)

  @@index([externalId])
}

enum TransactionSource {
  MANUAL          // Uploaded via CSV/PDF/etc
  AIS_SYNC        // From bank sync provider
}
```

### PotentialDuplicate (new)

```prisma
model PotentialDuplicate {
  id                String   @id @default(cuid())
  companyId         String

  transactionAId    String   // The new transaction
  transactionBId    String   // The existing transaction

  similarityScore   Float    // 0.0 - 1.0
  reason            String   // Human-readable reason

  status            DuplicateStatus @default(PENDING)
  resolvedAt        DateTime?
  resolvedBy        String?
  resolution        DuplicateResolution?

  createdAt         DateTime @default(now())

  company           Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([status])
}

enum DuplicateStatus {
  PENDING
  RESOLVED
}

enum DuplicateResolution {
  KEEP_BOTH       // Not duplicates
  MERGE           // Merge into one
  DELETE_NEW      // Discard the new one
}
```

---

## Deduplication Logic

### Tier 1: Strict Auto-Merge

Runs on every sync/import. Transaction is duplicate if ALL match:
- Same `bankAccountId`
- Same `date` (exact day)
- Same `amount` (exact, to cent)
- Same `reference` OR same `externalId`

**Action:** Skip insert silently.

### Tier 2: Fuzzy Detection

Flags for human review. Potential duplicate if:
- Same `bankAccountId`
- Date within ±2 days
- Amount within ±0.01 EUR
- Description similarity > 70% (Levenshtein on normalized strings)
- NOT already strict-matched

**Action:** Create `PotentialDuplicate` record, show in UI.

---

## Connection Flow

### User Initiates Connection

1. User clicks "Poveži automatski sync" on existing BankAccount card
2. `POST /api/bank/connect` with `{ bankAccountId }`
3. Backend:
   - Looks up `bankAccount.bankName`
   - Maps to provider's `institutionId`
   - Creates `BankConnection` record (status: PENDING)
   - Calls `provider.createConnection()`
   - Returns `{ redirectUrl }`
4. Frontend redirects to bank's auth page

### Bank Callback

1. User completes auth at bank
2. Bank redirects to `GET /api/bank/callback?ref=...`
3. Backend:
   - Finds `BankConnection` by `providerConnectionId`
   - Calls `provider.handleCallback()`
   - Receives list of accounts with IBANs
   - Matches IBAN to find the right account
   - Updates `BankAccount` with `syncProviderAccountId`
   - Sets `connectionStatus = CONNECTED`
   - Sets `connectionExpiresAt` (90 days from now)
   - Triggers initial transaction sync
4. Redirects to `/banking?success=connected`

---

## Daily Sync Job

**Endpoint:** `POST /api/cron/bank-sync`
**Schedule:** 6:00 AM daily
**Protection:** `CRON_SECRET` header

### Process

```
For each BankAccount where connectionStatus = CONNECTED:

1. Check expiration
   - If expires in <= 7 days → send warning notification
   - If expired → mark EXPIRED, skip sync, send final notice

2. Fetch transactions
   - Call provider.fetchTransactions(since: lastSyncAt)
   - Default lookback: 90 days if never synced

3. Process transactions
   - Run strict dedup → skip exact matches
   - Run fuzzy detection → create PotentialDuplicate records
   - Insert new transactions with source = AIS_SYNC

4. Update account
   - Set lastSyncAt = now()
   - Update currentBalance if provider returns it
```

---

## Expiration Notifications

| Trigger | Channel | Content |
|---------|---------|---------|
| 7 days before expiry | Email + In-app | Warning with reconnect link |
| On expiry day | Email + Banner | Final notice, status → EXPIRED |

**Email Template:**
```
Subject: Vaša veza s [Bank] bankom ističe [za 7 dana / danas]

Automatska sinkronizacija transakcija za račun [IBAN]
ističe [za 7 dana / danas].

[Obnovi vezu jednim klikom]

Ako ne obnovite vezu, morat ćete ručno uploadati izvode.
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/bank/connect` | Initiate connection for a bank account |
| GET | `/api/bank/callback` | Handle provider redirect after auth |
| POST | `/api/bank/sync` | Manual sync trigger (optional future) |
| POST | `/api/bank/disconnect` | Remove connection, revert to manual |
| GET | `/api/bank/institutions` | List supported banks (admin/debug) |
| POST | `/api/cron/bank-sync` | Daily sync job |

---

## File Structure

```
src/
├── lib/
│   └── bank-sync/
│       ├── provider.ts              # BankSyncProvider interface
│       ├── providers/
│       │   ├── gocardless.ts        # GoCardless implementation
│       │   └── index.ts             # Provider factory
│       ├── institution-map.ts       # Bank name → institution ID mapping
│       ├── dedup.ts                 # Deduplication engine
│       └── notifications.ts         # Expiration alert logic
│
├── app/
│   ├── api/
│   │   ├── bank/
│   │   │   ├── connect/route.ts
│   │   │   ├── callback/route.ts
│   │   │   ├── sync/route.ts
│   │   │   ├── disconnect/route.ts
│   │   │   └── institutions/route.ts
│   │   └── cron/
│   │       └── bank-sync/route.ts
│   │
│   └── (dashboard)/
│       └── banking/
│           └── components/
│               ├── connect-button.tsx
│               ├── connection-badge.tsx
│               ├── duplicate-review.tsx
│               └── expiration-banner.tsx
│
└── emails/
    └── bank-connection-expiring.tsx
```

---

## Environment Variables

```env
# Provider selection (allows swapping without code changes)
BANK_SYNC_PROVIDER=gocardless

# GoCardless credentials (from Bank Account Data portal)
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2

# Cron job protection
CRON_SECRET=your_cron_secret

# App URL for callbacks
NEXT_PUBLIC_APP_URL=https://app.fiskai.hr
```

---

## Croatian Bank Mapping

Initial mapping (to be validated against GoCardless API):

| Bank Name | GoCardless Institution ID |
|-----------|---------------------------|
| Zagrebačka banka | ZAGREBACKA_BANKA_ZABAHR2X |
| Privredna banka Zagreb | PBZ_PBZGHR2X |
| Erste Bank | ERSTE_BANK_GIBAHR2X |
| Raiffeisen Bank | RBA_RZBHHR2X |
| OTP banka | OTP_BANKA_OTPVHR2X |
| Addiko Bank | ADDIKO_BANK_HAABHR22 |
| HPB | HPB_HABORHR2X |
| Slatinska banka | SLATINSKA_BANKA_SLSPHR2X |
| Agram banka | AGRAM_BANKA_AGRAHR2X |

*Note: Exact IDs will be fetched from `/institutions/?country=HR` endpoint.*

---

## Security Considerations

1. **Credentials storage:** GoCardless secrets in environment variables only, never in code/DB
2. **Callback validation:** Verify connection exists and belongs to requesting company
3. **IBAN matching:** Only link accounts where IBAN exactly matches
4. **Rate limiting:** Respect provider rate limits (some banks: 4 calls/day)
5. **Token refresh:** Handle token expiration gracefully
6. **Cron protection:** Require `CRON_SECRET` header for sync endpoint

---

## Future Enhancements (Out of Scope)

- Real-time webhooks (if GoCardless adds support)
- Multiple accounts per connection (auto-create option)
- Balance alerts
- Cash flow predictions from transaction patterns
- Alternative providers (Plaid, Salt Edge)

---

## References

- [GoCardless Quick Start Guide](https://developer.gocardless.com/bank-account-data/quick-start-guide)
- [GoCardless API Overview](https://developer.gocardless.com/bank-account-data/overview/)
- [GoCardless Transactions Reference](https://developer.gocardless.com/bank-account-data/transactions)
- [NordigenApiClient (C# reference)](https://github.com/RobinTTY/NordigenApiClient)
