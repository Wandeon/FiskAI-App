# Feature: Audit Log (F071)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Provides a comprehensive, read-only view of all user and system actions performed within a company's FiskAI account. The audit log automatically tracks CREATE, UPDATE, DELETE, VIEW, EXPORT, LOGIN, and LOGOUT operations on critical business entities, enabling compliance monitoring, security auditing, and troubleshooting. Each entry captures the action type, entity details, timestamp, user information, and optionally the before/after state changes. The feature supports filtering by action type and entity, pagination, and displays change details in an expandable JSON format for detailed investigation.

## User Entry Points

| Type       | Path                                   | Evidence                                             |
| ---------- | -------------------------------------- | ---------------------------------------------------- |
| Navigation | `/settings/audit-log`                  | `src/app/(dashboard)/settings/audit-log/page.tsx:28` |
| Settings   | `/settings` (sidebar)                  | `src/app/(dashboard)/settings/page.tsx:118-123`      |
| Settings   | `/settings?tab=compliance` (card link) | `src/app/(dashboard)/settings/page.tsx:239-246`      |

## Core Flow

### Audit Log List View Flow

1. User accesses `/settings/audit-log` route -> `src/app/(dashboard)/settings/audit-log/page.tsx:28-34`
2. System validates authentication and company context -> `src/app/(dashboard)/settings/audit-log/page.tsx:33-39`
3. System parses query parameters (page, action, entity) -> `src/app/(dashboard)/settings/audit-log/page.tsx:41-44`
4. Build filter conditions with tenant isolation -> `src/app/(dashboard)/settings/audit-log/page.tsx:46-60`
5. Query audit logs with user and company information -> `src/app/(dashboard)/settings/audit-log/page.tsx:63-76`
6. Fetch unique entities for filter dropdown -> `src/app/(dashboard)/settings/audit-log/page.tsx:78-82`
7. Display logs in data table with pagination (50 per page) -> `src/app/(dashboard)/settings/audit-log/page.tsx:86-206`
8. Show timestamp, action badge, entity, entity ID, and changes -> `src/app/(dashboard)/settings/audit-log/page.tsx:86-129`
9. Render pagination controls if multiple pages exist -> `src/app/(dashboard)/settings/audit-log/page.tsx:209-231`

### Filter Flow

1. User selects filter criteria (action type or entity) -> `src/app/(dashboard)/settings/audit-log/page.tsx:147-192`
2. Action filter shows all available AuditAction types -> `src/app/(dashboard)/settings/audit-log/page.tsx:150-165`
3. Entity filter shows all unique entities from company logs -> `src/app/(dashboard)/settings/audit-log/page.tsx:167-182`
4. Form submits via GET request with query parameters -> `src/app/(dashboard)/settings/audit-log/page.tsx:148`
5. System rebuilds query with new filters -> `src/app/(dashboard)/settings/audit-log/page.tsx:46-60`
6. Page resets to 1 when filters change

### Changes Detail View

1. Each log entry displays changes in collapsible details element -> `src/app/(dashboard)/settings/audit-log/page.tsx:118-128`
2. Click "Prikaži" to expand JSON changes -> `src/app/(dashboard)/settings/audit-log/page.tsx:120`
3. Changes formatted as JSON with 2-space indentation -> `src/app/(dashboard)/settings/audit-log/page.tsx:122`
4. Shows empty dash if no changes recorded -> `src/app/(dashboard)/settings/audit-log/page.tsx:126`

### Automatic Audit Logging Flow

1. User performs CREATE/UPDATE/DELETE operation on audited model -> `src/lib/prisma-extensions.ts:218-256`
2. Prisma extension intercepts operation and executes it -> `src/lib/prisma-extensions.ts:218-257`
3. System captures result and queues audit log entry -> `src/lib/prisma-extensions.ts:137-165`
4. Audit queue processes asynchronously (fire-and-forget) -> `src/lib/prisma-extensions.ts:108-135`
5. Log entry created with companyId, userId, action, entity, entityId, changes -> `src/lib/prisma-extensions.ts:118-127`
6. Errors logged but do not affect main operation -> `src/lib/prisma-extensions.ts:128-130`

## Key Modules

| Module                  | Purpose                                         | Location                                                 |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| AuditLogPage            | Main audit log list page with filtering         | `src/app/(dashboard)/settings/audit-log/page.tsx`        |
| DataTable               | Generic table component for displaying logs     | `src/components/ui/data-table.tsx`                       |
| logAudit                | Manual audit logging helper function            | `src/lib/audit.ts:24-42`                                 |
| createChanges           | Helper to diff before/after for UPDATE actions  | `src/lib/audit.ts:48-66`                                 |
| getIpFromHeaders        | Extract IP address from request headers         | `src/lib/audit.ts:72-79`                                 |
| getUserAgentFromHeaders | Extract user agent from request headers         | `src/lib/audit.ts:84-86`                                 |
| prisma-extensions       | Automatic audit via Prisma query interception   | `src/lib/prisma-extensions.ts:79-165`                    |
| auditMiddleware         | Alternative Prisma middleware for audit logging | `src/lib/prisma-audit-middleware.ts:86-158`              |
| contextStore            | AsyncLocalStorage for user context tracking     | `src/lib/context.ts:11-25`                               |
| AdminAuditExportAPI     | Admin-only CSV export endpoint                  | `src/app/api/admin/companies/[companyId]/audit/route.ts` |

## Data

### Database Tables

#### AuditLog Table

Primary audit event storage -> `prisma/schema.prisma:278-294`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:280`
- `userId` (String?): User who performed action (null for system) -> `prisma/schema.prisma:281`
- `action` (AuditAction): Type of action performed -> `prisma/schema.prisma:282`
- `entity` (String): Entity model name (e.g., "EInvoice", "Contact") -> `prisma/schema.prisma:283`
- `entityId` (String): ID of affected entity -> `prisma/schema.prisma:284`
- `changes` (Json?): Before/after state for changes -> `prisma/schema.prisma:285`
- `ipAddress` (String?): Request IP address -> `prisma/schema.prisma:286`
- `userAgent` (String?): Request user agent string -> `prisma/schema.prisma:287`
- `timestamp` (DateTime): When action occurred, defaults to now() -> `prisma/schema.prisma:288`

Relations:

- `company` (Company): Company reference -> `prisma/schema.prisma:289`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:291`
- `entity, entityId`: Entity-specific queries -> `prisma/schema.prisma:292`
- `timestamp`: Time-based queries and ordering -> `prisma/schema.prisma:293`

#### AuditAction Enum

Action types for audit logging -> `prisma/schema.prisma:824-832`

Values:

- `CREATE`: Entity creation
- `UPDATE`: Entity modification
- `DELETE`: Entity deletion
- `VIEW`: Entity viewing (manual logging only)
- `EXPORT`: Data export operations (manual logging only)
- `LOGIN`: User authentication (manual logging only)
- `LOGOUT`: User sign-out (manual logging only)

### Query Patterns

#### Audit Log List Query

Fetches audit logs with filtering and pagination -> `src/app/(dashboard)/settings/audit-log/page.tsx:63-76`

```typescript
const [logs, total] = await Promise.all([
  db.auditLog.findMany({
    where: {
      companyId: company.id,
      ...(action && { action: action as AuditAction }),
      ...(entity && { entity }),
    },
    orderBy: { timestamp: "desc" },
    take: pageSize,
    skip: (page - 1) * pageSize,
    include: {
      company: { select: { name: true } },
    },
  }),
  db.auditLog.count({ where }),
])
```

#### Entity Filter Query

Get unique entities for filter dropdown -> `src/app/(dashboard)/settings/audit-log/page.tsx:79-82`

```typescript
const entities = await db.auditLog.groupBy({
  by: ["entity"],
  where: { companyId: company.id },
})
```

#### Manual Audit Log Creation

Create audit entry manually via helper -> `src/lib/audit.ts:26-37`

```typescript
await db.auditLog.create({
  data: {
    companyId: params.companyId,
    userId: params.userId ?? null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    changes: params.changes ? (params.changes as Prisma.InputJsonValue) : undefined,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  },
})
```

### Audited Models

Models tracked automatically via Prisma extension -> `src/lib/prisma-extensions.ts:79-92`

```typescript
const AUDITED_MODELS = [
  "Contact",
  "Product",
  "EInvoice",
  "Company",
  "BankAccount",
  "Expense",
  "ExpenseCategory",
  "RecurringExpense",
  "BusinessPremises",
  "PaymentDevice",
  "InvoiceSequence",
  "SupportTicket",
]
```

### Action Labels

Croatian translations for action types -> `src/app/(dashboard)/settings/audit-log/page.tsx:8-16`

```typescript
const ACTION_LABELS: Record<string, string> = {
  CREATE: "Kreiranje",
  UPDATE: "Izmjena",
  DELETE: "Brisanje",
  VIEW: "Pregled",
  EXPORT: "Izvoz",
  LOGIN: "Prijava",
  LOGOUT: "Odjava",
}
```

Action color coding -> `src/app/(dashboard)/settings/audit-log/page.tsx:18-26`

```typescript
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  VIEW: "bg-gray-100 text-gray-800",
  EXPORT: "bg-purple-100 text-purple-800",
  LOGIN: "bg-yellow-100 text-yellow-800",
  LOGOUT: "bg-orange-100 text-orange-800",
}
```

## Dependencies

### Depends On

- **Authentication System**: User context for userId tracking -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Prisma Extensions**: Automatic audit via query interception -> `src/lib/prisma-extensions.ts:withTenantIsolation`
- **AsyncLocalStorage**: Context propagation for userId -> `src/lib/context.ts:contextStore`
- **DataTable Component**: Generic table display -> `src/components/ui/data-table.tsx`

### Depended By

- **Compliance Monitoring**: Security teams review user actions
- **Troubleshooting**: Support teams investigate data changes
- **Admin Export**: CSV export for analysis -> `src/app/api/admin/companies/[companyId]/audit/route.ts`

## Integrations

### Internal Integrations

#### Settings Navigation

Settings sidebar link -> `src/app/(dashboard)/settings/page.tsx:118-123`

```typescript
<Link href="/settings/audit-log">
  <span>Revizijski dnevnik</span>
  <ArrowUpRight className="h-4 w-4 text-[var(--muted)]" />
</Link>
```

Settings compliance tab card -> `src/app/(dashboard)/settings/page.tsx:239-246`

```typescript
<Link href="/settings/audit-log">
  <Card className="cursor-pointer">
    <CardHeader>
      <CardTitle>Revizijski dnevnik</CardTitle>
      <CardDescription>Pregledajte aktivnosti korisnika i AI asistenta</CardDescription>
    </CardHeader>
  </Card>
</Link>
```

#### Automatic Logging Integration

Prisma extension intercepts all CUD operations -> `src/lib/prisma-extensions.ts:218-256`

- CREATE operations: Log after successful insert with `{ after: result }`
- UPDATE operations: Log after successful update with `{ after: result }`
- DELETE operations: Log after successful delete with `{ before: result }`
- Queue-based processing prevents blocking main operations
- Errors in audit logging do not affect business operations

#### Manual Logging Helpers

IP address extraction -> `src/lib/audit.ts:72-79`

```typescript
export function getIpFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    null
  )
}
```

Changes diff creation -> `src/lib/audit.ts:48-66`

```typescript
export function createChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const excludeFields = ["updatedAt", "createdAt", "id", "companyId"]
  const changedBefore: Record<string, unknown> = {}
  const changedAfter: Record<string, unknown> = {}

  for (const key of Object.keys(after)) {
    if (excludeFields.includes(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key]
      changedAfter[key] = after[key]
    }
  }

  return { before: changedBefore, after: changedAfter }
}
```

### External Integrations

#### Admin CSV Export

Global admin-only endpoint for audit data export -> `src/app/api/admin/companies/[companyId]/audit/route.ts:6-48`

Features:

- Requires global admin authentication
- Exports up to 1000 logs (configurable via `limit` query param)
- CSV format with timestamp, action, entity, entityId, userId, ipAddress, userAgent
- Downloads as `audit-{companyId}.csv`
- Ordered by timestamp descending

Example usage:

```
GET /api/admin/companies/{companyId}/audit?limit=500
```

## Verification Checklist

### List View

- [ ] User can access audit log via `/settings/audit-log`
- [ ] All logs are filtered by company ID (tenant isolation)
- [ ] Pagination displays 50 logs per page
- [ ] Filters work: action type, entity type
- [ ] Logs ordered by timestamp descending (newest first)
- [ ] Empty state displays when no logs found
- [ ] Back link to settings page works
- [ ] Stats display shows "Prikazano X od Y zapisa"

### Log Display

- [ ] Timestamp displays in Croatian format (hr-HR locale)
- [ ] Action badge shows with correct color for each action type
- [ ] Action labels display in Croatian
- [ ] Entity name displays correctly
- [ ] Entity ID shows first 8 characters with ellipsis in monospace
- [ ] Changes column shows "Prikaži" link when changes exist
- [ ] Changes column shows "-" when no changes recorded
- [ ] Expandable details shows formatted JSON
- [ ] JSON formatting uses 2-space indentation

### Action Badges

- [ ] CREATE shows green badge "Kreiranje"
- [ ] UPDATE shows blue badge "Izmjena"
- [ ] DELETE shows red badge "Brisanje"
- [ ] VIEW shows gray badge "Pregled"
- [ ] EXPORT shows purple badge "Izvoz"
- [ ] LOGIN shows yellow badge "Prijava"
- [ ] LOGOUT shows orange badge "Odjava"

### Filtering

- [ ] Action filter dropdown shows all AuditAction types
- [ ] Entity filter dropdown shows all unique entities from logs
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Filter form preserves values after submission
- [ ] Pagination resets to page 1 when filters change
- [ ] "Sve akcije" and "Svi entiteti" clear respective filters

### Automatic Logging

- [ ] CREATE operations logged automatically for audited models
- [ ] UPDATE operations logged automatically for audited models
- [ ] DELETE operations logged automatically for audited models
- [ ] Logged entries include correct companyId
- [ ] Logged entries include correct userId (from context)
- [ ] Logged entries include correct action type
- [ ] Logged entries include correct entity and entityId
- [ ] Changes recorded with before/after state
- [ ] Audit failures do not affect main operations
- [ ] Queue processes logs asynchronously

### Manual Logging

- [ ] logAudit() helper creates audit entries
- [ ] createChanges() correctly diffs before/after
- [ ] getIpFromHeaders() extracts IP from proxy headers
- [ ] getUserAgentFromHeaders() extracts user agent
- [ ] Fire-and-forget design prevents blocking
- [ ] Errors logged to console but not thrown

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Timestamp stored with timezone
- [ ] Changes stored as JSON
- [ ] Optional fields allow null (userId, ipAddress, userAgent, changes)
- [ ] Entity ID index enables fast entity-specific lookups
- [ ] Timestamp index enables fast time-range queries
- [ ] Foreign key to Company table enforced

### Admin Export

- [ ] CSV export requires global admin authentication
- [ ] Export respects limit parameter (10-1000 range)
- [ ] CSV includes all relevant columns
- [ ] User agent quotes escaped correctly
- [ ] Filename includes companyId
- [ ] Content-Type header set to text/csv
- [ ] Content-Disposition header triggers download

## Evidence Links

1. `src/app/(dashboard)/settings/audit-log/page.tsx:28-234` - Main audit log page with filtering and pagination
2. `prisma/schema.prisma:278-294` - AuditLog table schema with fields and indexes
3. `prisma/schema.prisma:824-832` - AuditAction enum definition
4. `src/lib/audit.ts:24-86` - Manual audit logging helpers (logAudit, createChanges, getIpFromHeaders)
5. `src/lib/prisma-extensions.ts:79-165` - Automatic audit via Prisma extension with queue processing
6. `src/lib/prisma-audit-middleware.ts:5-158` - Alternative Prisma middleware for audit logging
7. `src/lib/context.ts:11-25` - AsyncLocalStorage for context propagation
8. `src/app/(dashboard)/settings/page.tsx:118-123` - Settings sidebar navigation link
9. `src/app/(dashboard)/settings/page.tsx:239-246` - Settings compliance tab card link
10. `src/components/ui/data-table.tsx:1-77` - Generic data table component
11. `src/app/api/admin/companies/[companyId]/audit/route.ts:6-48` - Admin CSV export endpoint
12. `prisma/migrations/20251211_add_audit_log/migration.sql:1-30` - Database migration for audit log
13. `src/lib/navigation.ts:74` - Settings navigation menu entry
14. `src/lib/db.ts:1-22` - Database client with Prisma extensions
