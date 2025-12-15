# Feature: Disconnect Bank Account

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

Allows users to disconnect a bank account from automatic synchronization (AIS - Account Information Services) and revert it to manual import mode. When disconnected, the feature removes the bank connection record, clears sync provider credentials, and resets the connection status to MANUAL. This preserves all existing transactions and account data while stopping automatic transaction imports from the bank's open banking API.

## User Entry Points

| Type | Path                 | Evidence                                                          |
| ---- | -------------------- | ----------------------------------------------------------------- |
| Page | /banking             | `src/app/(dashboard)/banking/page.tsx:1`                          |
| UI   | ConnectButton        | `src/app/(dashboard)/banking/components/connect-button.tsx:47-73` |
| API  | /api/bank/disconnect | `src/app/api/bank/disconnect/route.ts:8-59`                       |

## Core Flow

### Disconnect Bank Account Flow

1. User views connected bank accounts at /banking -> `src/app/(dashboard)/banking/page.tsx:22-25`
2. System displays ConnectButton for each account -> `src/app/(dashboard)/banking/page.tsx:155-159`
3. For accounts with connectionStatus='CONNECTED', button shows "Prekini vezu" -> `src/app/(dashboard)/banking/components/connect-button.tsx:75-93`
4. User clicks disconnect button -> `src/app/(dashboard)/banking/components/connect-button.tsx:80`
5. Browser displays confirmation dialog "Jeste li sigurni da želite prekinuti automatsku sinkronizaciju?" -> `src/app/(dashboard)/banking/components/connect-button.tsx:48`
6. If user cancels, operation aborts -> `src/app/(dashboard)/banking/components/connect-button.tsx:49`
7. Client sends POST to /api/bank/disconnect with bankAccountId -> `src/app/(dashboard)/banking/components/connect-button.tsx:54-58`
8. Server validates authentication and company ownership -> `src/app/api/bank/disconnect/route.ts:10-12`
9. Server verifies bank account exists and belongs to company -> `src/app/api/bank/disconnect/route.ts:24-33`
10. Server executes transaction to delete connections and reset account -> `src/app/api/bank/disconnect/route.ts:36-49`
11. BankConnection records deleted via deleteMany -> `src/app/api/bank/disconnect/route.ts:37-39`
12. BankAccount fields reset: syncProvider=null, connectionStatus='MANUAL' -> `src/app/api/bank/disconnect/route.ts:40-48`
13. Server returns success response -> `src/app/api/bank/disconnect/route.ts:51`
14. Client shows success toast "Veza prekinuta" -> `src/app/(dashboard)/banking/components/connect-button.tsx:66`
15. Page reloads to reflect updated connection status -> `src/app/(dashboard)/banking/components/connect-button.tsx:67`

## Key Modules

| Module               | Purpose                                     | Location                                                      |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Disconnect API Route | Handles bank disconnection requests         | `src/app/api/bank/disconnect/route.ts`                        |
| ConnectButton        | UI component for connect/disconnect actions | `src/app/(dashboard)/banking/components/connect-button.tsx`   |
| ConnectionBadge      | Visual indicator of connection status       | `src/app/(dashboard)/banking/components/connection-badge.tsx` |
| Banking Dashboard    | Main page displaying connected accounts     | `src/app/(dashboard)/banking/page.tsx`                        |
| Bank Accounts Page   | Detailed account management interface       | `src/app/(dashboard)/banking/accounts/page.tsx`               |

## Data

### Database Tables

- **BankAccount**: Bank account details and connection state -> `prisma/schema.prisma:430-459`
  - Key fields: id, companyId, name, iban, bankName, currentBalance
  - Connection fields: syncProvider, syncProviderAccountId, connectionStatus, connectionExpiresAt -> `prisma/schema.prisma:444-447`
  - Status field: connectionStatus (ConnectionStatus enum) -> `prisma/schema.prisma:446`
  - Relations: connection (BankConnection, 1:1 optional) -> `prisma/schema.prisma:454`

- **BankConnection**: Stores sync provider connection metadata -> `prisma/schema.prisma:495-519`
  - Key fields: id, companyId, bankAccountId (unique)
  - Provider fields: provider, providerConnectionId, institutionId, institutionName -> `prisma/schema.prisma:500-503`
  - Status fields: status, authorizedAt, expiresAt, lastError -> `prisma/schema.prisma:505-508`
  - Cascade delete: When BankAccount deleted, BankConnection auto-deleted -> `prisma/schema.prisma:514`

- **BankTransaction**: Preserves transaction history after disconnect -> `prisma/schema.prisma:461-493`
  - Transactions remain in database after disconnection
  - Source field indicates origin: MANUAL vs AIS_SYNC -> `prisma/schema.prisma:482`
  - No cascade delete on disconnect (transactions preserved)

### Connection Status Enum

```typescript
enum ConnectionStatus {
  MANUAL      // No automatic sync, manual import only
  CONNECTED   // Active connection to bank API
  EXPIRED     // Connection expired, needs renewal
}
```

Source: `prisma/schema.prisma:940-944`

### Sync Provider Enum

```typescript
enum SyncProvider {
  GOCARDLESS  // GoCardless open banking integration
  PLAID       // Plaid financial data platform
  SALTEDGE    // Salt Edge banking API
}
```

Source: `prisma/schema.prisma:934-938`

### Transaction Source Enum

```typescript
enum TransactionSource {
  MANUAL      // Manually imported from CSV/statement
  AIS_SYNC    // Automatically synced via bank API
}
```

Source: `prisma/schema.prisma:946-949`

## Data Cleanup

### What Gets Deleted

- **BankConnection**: All connection records for the bank account -> `src/app/api/bank/disconnect/route.ts:37-39`
  - Connection metadata (provider, institution details)
  - Authorization tokens and expiry dates
  - Error logs and sync history

### What Gets Preserved

- **BankAccount**: Account record remains with reset fields -> `src/app/api/bank/disconnect/route.ts:40-48`
  - Account details: name, IBAN, bank name, currency
  - Current balance and last sync timestamp
  - All historical transaction data

- **BankTransaction**: All transactions remain unchanged
  - Previously synced transactions keep source='AIS_SYNC' marker
  - Matched invoices and expenses remain linked
  - Transaction history fully preserved for audit trail

### Fields Reset on Disconnect

```typescript
{
  syncProvider: null,              // Clears GOCARDLESS/PLAID/SALTEDGE
  syncProviderAccountId: null,     // Removes external account reference
  connectionStatus: 'MANUAL',      // Reverts to manual import mode
  connectionExpiresAt: null        // Clears expiration timestamp
}
```

Source: `src/app/api/bank/disconnect/route.ts:43-46`

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/api/bank/disconnect/route.ts:10`
- Requires company context via requireCompany -> `src/app/api/bank/disconnect/route.ts:11`
- Tenant context isolation -> `src/app/api/bank/disconnect/route.ts:12`
- Ownership validation: Verifies bankAccountId belongs to company -> `src/app/api/bank/disconnect/route.ts:24-26`

### Permission Requirements

- **Disconnect**: Standard company context, no special permission required
- **View**: Must be member of company owning the bank account
- **Access**: Tenant middleware prevents cross-company access

### Data Integrity

- Atomic transaction ensures consistent state -> `src/app/api/bank/disconnect/route.ts:36`
- Connection deletion and status reset happen together
- On failure, both operations rollback (transaction boundary)
- Existing transactions never modified or deleted

### User Confirmation

- Confirmation dialog prevents accidental disconnection -> `src/app/(dashboard)/banking/components/connect-button.tsx:48`
- Croatian message: "Jeste li sigurni da želite prekinuti automatsku sinkronizaciju?"
- Dialog can be cancelled to abort operation

## UI Components

### ConnectButton Component

- **Purpose**: Toggle between connect/disconnect based on status -> `src/app/(dashboard)/banking/components/connect-button.tsx:15-112`
- **Props**: bankAccountId, connectionStatus, bankName -> `src/app/(dashboard)/banking/components/connect-button.tsx:9-13`
- **States**:
  - CONNECTED: Shows "Prekini vezu" with Unlink icon -> `src/app/(dashboard)/banking/components/connect-button.tsx:75-93`
  - EXPIRED: Shows "Obnovi vezu" in default variant -> `src/app/(dashboard)/banking/components/connect-button.tsx:107`
  - MANUAL: Shows "Poveži banku" in outline variant -> `src/app/(dashboard)/banking/components/connect-button.tsx:107`
- **Loading State**: Displays spinner during API call -> `src/app/(dashboard)/banking/components/connect-button.tsx:84`

### ConnectionBadge Component

- **Purpose**: Visual status indicator -> `src/app/(dashboard)/banking/components/connection-badge.tsx:1-44`
- **CONNECTED**: Green badge with dot, shows days until expiry if <14 days -> `src/app/(dashboard)/banking/components/connection-badge.tsx:9-27`
- **EXPIRED**: Amber badge with warning -> `src/app/(dashboard)/banking/components/connection-badge.tsx:29-36`
- **MANUAL**: Gray badge "Ručni uvoz" -> `src/app/(dashboard)/banking/components/connection-badge.tsx:38-42`

### Button Styling

- **Disconnect**: Outline variant, small size -> `src/app/(dashboard)/banking/components/connect-button.tsx:78-79`
- **Icon**: Unlink icon (lucide-react) -> `src/app/(dashboard)/banking/components/connect-button.tsx:87`
- **Disabled**: When loading=true -> `src/app/(dashboard)/banking/components/connect-button.tsx:81`

## Error Handling

- **Missing bankAccountId**: Returns 400 "bankAccountId is required" -> `src/app/api/bank/disconnect/route.ts:16-21`
- **Account not found**: Returns 404 "Bank account not found" -> `src/app/api/bank/disconnect/route.ts:28-33`
- **Server error**: Returns 500 "Disconnect failed" -> `src/app/api/bank/disconnect/route.ts:52-57`
- **Client error**: Shows error toast "Prekid veze nije uspio" -> `src/app/(dashboard)/banking/components/connect-button.tsx:62,69`
- **Transaction failure**: Database transaction ensures atomic rollback
- **Console logging**: Errors logged with [bank/disconnect] prefix -> `src/app/api/bank/disconnect/route.ts:53`

## Post-Disconnect Behavior

### Manual Import Mode

After disconnection, account reverts to manual import:

- Users can upload CSV/XML bank statements -> Via /banking/import page
- Transactions imported with source='MANUAL' marker
- No automatic synchronization occurs
- Account can be reconnected later via "Poveži banku" button

### Reconnection Flow

- ConnectButton automatically shows "Poveži banku" after disconnect
- Clicking connect initiates new bank authorization flow
- Creates fresh BankConnection with new credentials
- Resumes automatic transaction synchronization

### Data Continuity

- All previous transactions remain visible and searchable
- Matched invoices/expenses remain linked
- Balance and account details unchanged
- Historical sync data preserved via transaction source markers

## Dependencies

- **Depends on**:
  - Bank Connect (F038) - Creates connections that can be disconnected
  - Bank Account Management - Requires existing bank accounts
  - Authentication System - User and company verification

- **Depended by**:
  - Bank Sync Services - Must handle disconnected state gracefully
  - Transaction Import - Falls back to manual import after disconnect
  - Reconciliation - Works with both manual and synced transactions

## Integrations

### Prisma ORM

- Database transaction for atomic operations -> `src/app/api/bank/disconnect/route.ts:36`
- deleteMany for batch connection deletion -> `src/app/api/bank/disconnect/route.ts:37`
- Tenant context filtering via middleware -> `src/app/api/bank/disconnect/route.ts:12`

### Next.js Features

- API Route Handler (POST method) -> `src/app/api/bank/disconnect/route.ts:8`
- Server-side authentication with requireAuth -> `src/app/api/bank/disconnect/route.ts:10`
- Client component with 'use client' directive -> `src/app/(dashboard)/banking/components/connect-button.tsx:2`

### Toast Notifications

- Success message via sonner toast -> `src/app/(dashboard)/banking/components/connect-button.tsx:66`
- Error messages for failed operations -> `src/app/(dashboard)/banking/components/connect-button.tsx:62,69`

### Page Reload Pattern

- Hard refresh after disconnect to update UI -> `src/app/(dashboard)/banking/components/connect-button.tsx:67`
- Alternative: Could use revalidatePath for softer refresh
- Ensures ConnectionBadge reflects new MANUAL status

## Verification Checklist

- [x] User can view connected bank accounts on banking dashboard
- [x] ConnectButton shows "Prekini vezu" for CONNECTED accounts
- [x] Confirmation dialog prevents accidental disconnection
- [x] API validates authentication and company ownership
- [x] Bank account ownership verified before disconnect
- [x] Database transaction ensures atomic state changes
- [x] BankConnection records deleted completely
- [x] BankAccount fields reset to MANUAL status
- [x] Existing transactions preserved after disconnect
- [x] Success toast displayed on completion
- [x] Page reloads to show updated status
- [x] Error handling for missing/invalid accounts
- [x] Tenant isolation prevents cross-company access

## Related Features

- **Bank Connect**: `src/app/api/bank/connect/route.ts` (F038)
- **Bank Account Management**: `src/app/(dashboard)/banking/accounts/page.tsx` (F037)
- **Bank Transaction Import**: `src/app/(dashboard)/banking/import/page.tsx` (F040)
- **Banking Dashboard**: `src/app/(dashboard)/banking/page.tsx` (F036)

## Evidence Links

1. `src/app/api/bank/disconnect/route.ts:1-59` - Complete disconnect API endpoint implementation
2. `src/app/(dashboard)/banking/components/connect-button.tsx:47-73` - Disconnect handler with confirmation dialog
3. `src/app/(dashboard)/banking/page.tsx:155-159` - ConnectButton integration in banking dashboard
4. `src/app/(dashboard)/banking/components/connection-badge.tsx:1-44` - Connection status badge component
5. `prisma/schema.prisma:430-459` - BankAccount model with connection fields
6. `prisma/schema.prisma:495-519` - BankConnection model and cascade delete relationship
7. `prisma/schema.prisma:940-944` - ConnectionStatus enum definition
8. `src/app/api/bank/disconnect/route.ts:36-49` - Database transaction for atomic disconnect operation
9. `src/app/(dashboard)/banking/components/connect-button.tsx:48` - User confirmation dialog text
10. `docs/plans/2024-12-14-bank-sync-implementation.md:1307-1387` - Original implementation plan and design decisions
