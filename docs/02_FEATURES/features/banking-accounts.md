# Feature: View Bank Accounts (F037)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Provides a centralized view for managing company bank accounts, enabling users to add, view, and manage bank accounts with IBAN validation, automatic bank detection, default account designation, and optional automated bank connection. The feature supports manual account management and displays account balances, transaction counts, and connection status for each registered bank account.

## User Entry Points

| Type       | Path                | Evidence                                             |
| ---------- | ------------------- | ---------------------------------------------------- |
| Primary    | `/banking/accounts` | `src/app/(dashboard)/banking/accounts/page.tsx:12`   |
| Navigation | `/banking`          | `src/app/(dashboard)/banking/page.tsx:68-70`         |
| Import     | `/banking/import`   | `src/app/(dashboard)/banking/import/page.tsx:98-100` |
| Dashboard  | `/banking`          | Via banking dashboard                                |

## Core Flow

### Account List View Flow

1. User accesses `/banking/accounts` route -> `src/app/(dashboard)/banking/accounts/page.tsx:12`
2. System fetches all bank accounts for company -> `src/app/(dashboard)/banking/accounts/page.tsx:21-29`
3. Accounts ordered by default status, then creation date -> `src/app/(dashboard)/banking/accounts/page.tsx:23`
4. System includes transaction count for each account -> `src/app/(dashboard)/banking/accounts/page.tsx:24-28`
5. Empty state displays if no accounts exist -> `src/app/(dashboard)/banking/accounts/page.tsx:67-76`
6. Account cards render with details and actions -> `src/app/(dashboard)/banking/accounts/page.tsx:79-152`
7. Default account highlighted with blue ring -> `src/app/(dashboard)/banking/accounts/page.tsx:82`
8. Each card shows IBAN, bank name, currency, balance, and sync status -> `src/app/(dashboard)/banking/accounts/page.tsx:85-129`
9. Action buttons for setting default and deleting accounts -> `src/app/(dashboard)/banking/accounts/page.tsx:130-147`

### Add Account Flow

1. User fills account form at top of page -> `src/app/(dashboard)/banking/accounts/page.tsx:56-62`
2. User enters IBAN in format field -> `src/app/(dashboard)/banking/accounts/account-form.tsx:128-143`
3. System validates Croatian IBAN format and checksum -> `src/lib/banking/constants.ts:76-108`
4. Bank name auto-detected from IBAN -> `src/lib/banking/constants.ts:64-69`
5. Currency auto-selected to EUR for Croatian IBANs -> `src/app/(dashboard)/banking/accounts/account-form.tsx:38-40`
6. User submits form with validated data -> `src/app/(dashboard)/banking/accounts/account-form.tsx:68-105`
7. Server action creates account -> `src/app/(dashboard)/banking/actions.ts:21-88`
8. System sets first account as default automatically -> `src/app/(dashboard)/banking/actions.ts:44-56`
9. Page refreshes with new account displayed -> `src/app/(dashboard)/banking/accounts/account-form.tsx:94`

### Set Default Account Flow

1. User clicks "Postavi kao zadani" button -> `src/app/(dashboard)/banking/accounts/page.tsx:132-137`
2. Server action unsets all existing defaults -> `src/app/(dashboard)/banking/actions.ts:133-136`
3. System sets selected account as default -> `src/app/(dashboard)/banking/actions.ts:139-142`
4. Page revalidates and refreshes -> `src/app/(dashboard)/banking/actions.ts:144-145`
5. Account card displays with blue ring highlighting -> `src/app/(dashboard)/banking/accounts/page.tsx:82`

### Delete Account Flow

1. Delete button only visible for accounts with zero transactions -> `src/app/(dashboard)/banking/accounts/page.tsx:139-146`
2. User clicks delete button on eligible account -> `src/app/(dashboard)/banking/accounts/page.tsx:140-145`
3. Server action checks transaction count -> `src/app/(dashboard)/banking/actions.ts:97-106`
4. System prevents deletion if transactions exist -> `src/app/(dashboard)/banking/actions.ts:101-106`
5. Account deleted if eligible -> `src/app/(dashboard)/banking/actions.ts:108-110`
6. Page revalidates and refreshes -> `src/app/(dashboard)/banking/actions.ts:112-113`

## Key Modules

| Module           | Purpose                                      | Location                                                      |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| BankAccountsPage | Main account list and management page        | `src/app/(dashboard)/banking/accounts/page.tsx`               |
| AccountForm      | Client form for adding new accounts          | `src/app/(dashboard)/banking/accounts/account-form.tsx`       |
| BankingActions   | Server actions for account operations        | `src/app/(dashboard)/banking/actions.ts`                      |
| BankingConstants | IBAN validation and bank detection utilities | `src/lib/banking/constants.ts`                                |
| ConnectionBadge  | Displays bank connection status              | `src/app/(dashboard)/banking/components/connection-badge.tsx` |
| ConnectButton    | Manages automated bank connections           | `src/app/(dashboard)/banking/components/connect-button.tsx`   |
| EmptyState       | Empty state UI component                     | `src/components/ui/empty-state.tsx`                           |

## Data

### Database Tables

#### BankAccount Table

Primary bank account storage table -> `prisma/schema.prisma:430-459`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:432`
- `name` (String): Account display name -> `prisma/schema.prisma:433`
- `iban` (String): International Bank Account Number -> `prisma/schema.prisma:434`
- `bankName` (String): Bank institution name -> `prisma/schema.prisma:435`
- `currency` (String): Account currency, default EUR -> `prisma/schema.prisma:436`
- `currentBalance` (Decimal): Current account balance -> `prisma/schema.prisma:437`
- `lastSyncAt` (DateTime?): Last synchronization timestamp -> `prisma/schema.prisma:438`
- `isDefault` (Boolean): Default account flag, default false -> `prisma/schema.prisma:439`
- `syncProvider` (SyncProvider?): Bank connection provider (GOCARDLESS, PLAID, SALTEDGE) -> `prisma/schema.prisma:444,934-938`
- `syncProviderAccountId` (String?): External account ID -> `prisma/schema.prisma:445`
- `connectionStatus` (ConnectionStatus): MANUAL, CONNECTED, EXPIRED -> `prisma/schema.prisma:446,940-944`
- `connectionExpiresAt` (DateTime?): Connection expiry date -> `prisma/schema.prisma:447`

Relations:

- `company` (Company): Owner company -> `prisma/schema.prisma:449`
- `imports` (BankImport[]): Import history -> `prisma/schema.prisma:450`
- `transactions` (BankTransaction[]): Associated transactions -> `prisma/schema.prisma:451`
- `importJobs` (ImportJob[]): Statement import jobs -> `prisma/schema.prisma:452`
- `statements` (Statement[]): Bank statements -> `prisma/schema.prisma:453`
- `connection` (BankConnection?): Automated connection details -> `prisma/schema.prisma:454`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:457`
- `connectionStatus`: Connection status queries -> `prisma/schema.prisma:458`
- Unique constraint: `[companyId, iban]` -> `prisma/schema.prisma:456`

#### BankConnection Table

Automated bank connection metadata -> `prisma/schema.prisma:495-519`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `bankAccountId` (String, unique): Associated bank account
- `provider` (SyncProvider): GOCARDLESS, PLAID, or SALTEDGE
- `providerConnectionId` (String): External connection ID
- `institutionId` (String): Bank institution ID
- `institutionName` (String): Bank institution name
- `status` (ConnectionStatus): MANUAL, CONNECTED, EXPIRED
- `authorizedAt` (DateTime?): Authorization timestamp
- `expiresAt` (DateTime?): Expiration timestamp
- `lastError` (String?): Last error message

### Query Patterns

#### Account List Query

Fetches all accounts for display -> `src/app/(dashboard)/banking/accounts/page.tsx:21-29`

```typescript
const accounts = await db.bankAccount.findMany({
  where: { companyId: company.id },
  orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  include: {
    _count: {
      select: { transactions: true },
    },
  },
})
```

#### Account Selection for Import

Simplified query for dropdowns -> `src/app/(dashboard)/banking/import/page.tsx:20-29`

```typescript
const accounts = await db.bankAccount.findMany({
  where: { companyId: company.id },
  orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  select: {
    id: true,
    name: true,
    iban: true,
    currency: true,
  },
})
```

#### Banking Dashboard Query

Accounts with summary for main banking page -> `src/app/(dashboard)/banking/page.tsx:22-25`

```typescript
const accounts = await db.bankAccount.findMany({
  where: { companyId: company.id },
  orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
})
```

### IBAN Validation

Croatian IBAN validation with checksum verification -> `src/lib/banking/constants.ts:76-108`

```typescript
export function isValidCroatianIban(iban: string): boolean {
  const cleaned = iban.toUpperCase().replace(/\s/g, "")

  // Basic format check: HR + 19 digits
  if (!/^HR\d{19}$/.test(cleaned)) {
    return false
  }

  // IBAN checksum validation (mod 97)
  const rearranged = basicAccountNumber + countryCode + checkDigits
  const numeric = convertToNumeric(rearranged)
  const remainder = calculateMod97(numeric)
  return remainder === 1
}
```

### Bank Detection

Automatic bank name detection from IBAN -> `src/lib/banking/constants.ts:42-69`

Croatian IBANs contain a 7-digit bank code (VBDI) at positions 5-11:

```typescript
export function extractBankCodeFromIban(iban: string): string | null {
  const cleaned = iban.toUpperCase().replace(/\s/g, "")
  if (!/^HR\d{19}$/.test(cleaned)) return null
  return cleaned.substring(4, 11) // Extract 7-digit bank code
}

export function getBankNameFromIban(iban: string): string | null {
  const bankCode = extractBankCodeFromIban(iban)
  if (!bankCode) return null
  return CROATIAN_BANKS[bankCode] || null
}
```

Supported banks (35 Croatian institutions) -> `src/lib/banking/constants.ts:12-35`

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Banking Constants**: IBAN validation and bank detection -> `src/lib/banking/constants.ts`

### Depended By

- **Banking Dashboard**: Displays account summary -> `src/app/(dashboard)/banking/page.tsx`
- **Statement Import**: Requires account selection -> `src/app/(dashboard)/banking/import/page.tsx`
- **Bank Transactions**: Links to accounts -> `prisma/schema.prisma:BankTransaction`
- **Bank Reconciliation**: Matches transactions to accounts
- **Bank Connection**: Automated sync requires accounts

## Integrations

### Internal Integrations

#### Banking Dashboard Integration

Main banking hub displays account cards -> `src/app/(dashboard)/banking/page.tsx:102-166`

- Quick overview of all accounts in grid layout
- Shows balance, connection status, and sync badges
- "Manage Accounts" button links to full account page
- Calculates total balance across all accounts -> `src/app/(dashboard)/banking/page.tsx:28-31`

#### Statement Import Integration

Import page requires bank account selection -> `src/app/(dashboard)/banking/import/page.tsx:79-100`

- Prevents import if no accounts exist
- Prompts user to add account first
- Account dropdown ordered by default status
- Links to account management page

#### Bank Connection Integration

Optional automated sync with bank APIs -> `src/app/(dashboard)/banking/components/connect-button.tsx:1-112`

- Connection badge shows status: Manual, Connected, Expired
- Connect button initiates OAuth flow with bank
- Disconnect button requires confirmation
- Expiry warnings shown 14 days before expiration -> `src/app/(dashboard)/banking/components/connection-badge.tsx:20-24`

Supported providers -> `prisma/schema.prisma:934-938`:

- GoCardless (European banks)
- Plaid (US/Canada banks)
- Salt Edge (global coverage)

#### Transaction Management Integration

All transactions linked to bank accounts -> `prisma/schema.prisma:461-493`

- Transactions require valid `bankAccountId`
- Cascade delete removes transactions when account deleted
- Transaction count prevents account deletion -> `src/app/(dashboard)/banking/actions.ts:97-106`

### External Integrations

#### Bank API Connections (Optional)

OAuth-based automated transaction sync:

- API endpoint: `/api/bank/connect` -> `src/app/(dashboard)/banking/components/connect-button.tsx:25-44`
- API endpoint: `/api/bank/disconnect` -> `src/app/(dashboard)/banking/components/connect-button.tsx:47-73`
- Redirects to bank authorization flow
- Stores connection metadata in BankConnection table
- Automatically syncs transactions when connected
- Connection expires after provider-defined period

### Data Formatting

#### IBAN Display Formatting

IBANs formatted with spaces for readability -> `src/lib/banking/constants.ts:116-127`

```typescript
export function formatIban(iban: string): string {
  const cleaned = iban.toUpperCase().replace(/\s/g, "")
  if (cleaned.length === 21) {
    return cleaned.match(/.{1,4}/g)?.join(" ") || cleaned
  }
  return cleaned
}
```

Format: `HR12 1234 5678 9012 3456 789`

#### Currency Formatting

Balances displayed with Croatian locale -> `src/app/(dashboard)/banking/accounts/page.tsx:118-121`

```typescript
new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: account.currency,
}).format(Number(account.currentBalance))
```

## Verification Checklist

### Account List View

- [ ] User can access bank accounts via `/banking/accounts`
- [ ] Empty state displays when no accounts exist
- [ ] Empty state shows Landmark icon and helpful message
- [ ] Accounts ordered by default status (default first), then creation date
- [ ] Default account highlighted with blue ring (ring-2 ring-blue-500)
- [ ] Default account shows "Zadani račun" badge
- [ ] Account cards display name, IBAN (monospaced), bank name
- [ ] Account cards show currency and transaction count
- [ ] Current balance displays with Croatian locale formatting
- [ ] Last sync timestamp displays if available
- [ ] Connection status badge shows correct state (Manual/Connected/Expired)
- [ ] Connection expiry warning shows 14 days before expiration

### Add Account Form

- [ ] Form displays at top of page in card
- [ ] Name field accepts custom account names
- [ ] IBAN field auto-prefixes with "HR" for Croatian IBANs
- [ ] IBAN field limits input to 21 characters (HR + 19 digits)
- [ ] IBAN field displays formatted with spaces
- [ ] IBAN validation shows error for invalid format
- [ ] Bank name auto-populated when valid IBAN entered
- [ ] Bank name field highlights blue when auto-detected
- [ ] Currency auto-selects EUR for Croatian IBANs
- [ ] Currency dropdown offers EUR, HRK, USD options
- [ ] "Set as default" checkbox available
- [ ] First account automatically set as default
- [ ] Form validation prevents invalid IBAN submission
- [ ] Success: form resets and page refreshes with new account
- [ ] Error: duplicate IBAN shows "Račun s ovim IBAN-om već postoji"
- [ ] Submit button disabled while processing and shows "Dodavanje..."

### Account Actions

- [ ] "Set as default" button only visible for non-default accounts
- [ ] Setting default unsets all other defaults
- [ ] Page refreshes after setting default
- [ ] Delete button only visible for accounts with zero transactions
- [ ] Delete action prevents removal if transactions exist
- [ ] Error message: "Ne možete obrisati račun koji ima transakcije"
- [ ] Successful delete refreshes page and removes account
- [ ] Navigation link "Natrag na bankarstvo" returns to banking dashboard

### Bank Connection

- [ ] Connection badge shows "Ručni uvoz" for manual accounts
- [ ] Connection badge shows green dot + "Povezano" for connected accounts
- [ ] Connection badge shows amber dot + "Isteklo" for expired connections
- [ ] Expiry countdown shows days remaining when < 14 days
- [ ] Connect button shows "Poveži banku" for manual accounts
- [ ] Connect button shows "Obnovi vezu" for expired connections
- [ ] Disconnect button shows "Prekini vezu" for connected accounts
- [ ] Connect initiates OAuth flow with bank provider
- [ ] Disconnect requires confirmation dialog
- [ ] Loading spinner displays during connection operations

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] IBAN uniqueness enforced per company
- [ ] Croatian IBAN format validated: HR + 19 digits
- [ ] IBAN checksum validated with mod 97 algorithm
- [ ] Bank code extracted from positions 5-11 of IBAN
- [ ] Bank name lookup supports 35 Croatian banks
- [ ] Currency defaults to EUR for Croatian accounts
- [ ] Balance stored as Decimal(12,2)
- [ ] First account automatically becomes default
- [ ] Only one default account allowed per company
- [ ] Transaction cascade prevents orphaned data

## Evidence Links

1. `src/app/(dashboard)/banking/accounts/page.tsx:1-158` - Main bank accounts list page with account cards and actions
2. `src/app/(dashboard)/banking/accounts/account-form.tsx:1-201` - Client form for adding bank accounts with IBAN validation
3. `src/app/(dashboard)/banking/actions.ts:9-156` - Server actions for creating, deleting, and setting default accounts
4. `src/lib/banking/constants.ts:1-138` - IBAN validation, bank detection, and Croatian bank registry
5. `src/app/(dashboard)/banking/components/connection-badge.tsx:1-43` - Connection status badge component
6. `src/app/(dashboard)/banking/components/connect-button.tsx:1-112` - Bank connection/disconnection button component
7. `prisma/schema.prisma:430-459` - BankAccount table schema with fields and relations
8. `prisma/schema.prisma:495-519` - BankConnection table schema for automated sync
9. `src/app/(dashboard)/banking/page.tsx:22-166` - Banking dashboard with account overview
10. `src/app/(dashboard)/banking/import/page.tsx:20-100` - Import page requiring account selection
11. `src/components/ui/empty-state.tsx:1-36` - Empty state component for zero accounts
