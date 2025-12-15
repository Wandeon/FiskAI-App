# Feature: Company Management (F090)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Provides a global admin control center for managing and monitoring all companies (tenants) in the FiskAI system. This feature enables system administrators to view company details, inspect user memberships, analyze activity statistics, review audit logs, export compliance data, and manage module entitlements and feature flags. The admin interface is protected by password authentication and email-based allowlist, ensuring only authorized administrators can access sensitive cross-tenant information. This tool is essential for customer support, compliance monitoring, troubleshooting, and system operations.

## User Entry Points

| Type       | Path                                    | Evidence                                                      |
| ---------- | --------------------------------------- | ------------------------------------------------------------- |
| Navigation | `/admin`                                | `src/app/admin/page.tsx:7`                                    |
| Navigation | `/admin/:companyId`                     | `src/app/admin/[companyId]/page.tsx:17`                       |
| Auth       | `/admin-login`                          | `src/app/admin-login/page.tsx:11`                             |
| API        | `/api/admin/auth`                       | `src/app/api/admin/auth/route.ts:7-30`                        |
| API Export | `/api/admin/companies/:companyId/audit` | `src/app/api/admin/companies/[companyId]/audit/route.ts:6-48` |

## Core Flow

### Admin Authentication Flow

1. User accesses `/admin` or `/admin/:companyId` without authentication -> `src/app/admin/layout.tsx:14-17`
2. System checks for admin authentication cookie -> `src/app/admin/layout.tsx:8-10`
3. If not authenticated, redirect to `/admin-login` -> `src/app/admin/layout.tsx:17`
4. User enters admin password on login page -> `src/app/admin-login/page.tsx:17-41`
5. Client sends POST to `/api/admin/auth` with password -> `src/app/admin-login/page.tsx:23-27`
6. Server validates password against `ADMIN_PASSWORD` env var -> `src/app/api/admin/auth/route.ts:7-21`
7. On success, sets `fiskai_admin_auth` cookie (24h expiry) -> `src/app/api/admin/auth/route.ts:13-19`
8. Client redirects to `/admin` dashboard -> `src/app/admin-login/page.tsx:30-31`

### Admin Logout Flow

1. User clicks logout button in admin header -> `src/app/admin/layout.tsx:28-37`
2. Form submits DELETE request to `/api/admin/auth` -> `src/app/admin/layout.tsx:28-29`
3. Server deletes admin authentication cookie -> `src/app/api/admin/auth/route.ts:26-29`
4. User redirected to login page

### Company List View Flow

1. Admin accesses `/admin` dashboard -> `src/app/admin/page.tsx:7`
2. System fetches all companies (limited to 100) -> `src/app/admin/page.tsx:8-20`
3. Companies ordered by creation date descending -> `src/app/admin/page.tsx:18`
4. Display company table with key information -> `src/app/admin/page.tsx:34-92`
5. Show name, OIB, legal form, VAT status, modules, registration date -> `src/app/admin/page.tsx:38-78`
6. Each row has "Otvori" link to detail view -> `src/app/admin/page.tsx:80-85`
7. Module entitlements parsed and displayed as badges -> `src/app/admin/page.tsx:49-73`

### Company Detail View Flow

1. Admin clicks company from list or navigates to `/admin/:companyId` -> `src/app/admin/[companyId]/page.tsx:17`
2. System validates global admin permissions -> `src/app/admin/[companyId]/page.tsx:18-21`
3. If not global admin, redirect to `/dashboard` -> `src/app/admin/[companyId]/page.tsx:20`
4. Fetch company details with full profile -> `src/app/admin/[companyId]/page.tsx:26-43`
5. If company not found, redirect to admin list -> `src/app/admin/[companyId]/page.tsx:45-47`
6. Parse URL query parameters for audit log filters -> `src/app/admin/[companyId]/page.tsx:23-52`
7. Load company users, audit logs, and activity stats in parallel -> `src/app/admin/[companyId]/page.tsx:54-70`
8. Display company identity card with OIB, VAT, address, country -> `src/app/admin/[companyId]/page.tsx:126-160`
9. Display module entitlements and feature flags -> `src/app/admin/[companyId]/page.tsx:162-217`
10. Display activity statistics (users, contacts, products, invoices, expenses) -> `src/app/admin/[companyId]/page.tsx:219-233`
11. Display user membership table with roles -> `src/app/admin/[companyId]/page.tsx:236-269`
12. Display recent audit logs with filtering -> `src/app/admin/[companyId]/page.tsx:271-355`

### Audit Log Filtering Flow

1. Admin selects action filter dropdown (CREATE, UPDATE, DELETE, etc.) -> `src/app/admin/[companyId]/page.tsx:280-290`
2. Admin enters entity filter (e.g., "EInvoice", "Contact") -> `src/app/admin/[companyId]/page.tsx:292-297`
3. Admin adjusts limit (10-200 records) -> `src/app/admin/[companyId]/page.tsx:299-306`
4. Form submits via GET with query parameters -> `src/app/admin/[companyId]/page.tsx:279`
5. System rebuilds query with filters -> `src/app/admin/[companyId]/page.tsx:60-68`
6. Page refreshes with filtered results -> `src/app/admin/[companyId]/page.tsx:323-353`
7. "Očisti" link clears all filters -> `src/app/admin/[companyId]/page.tsx:311-316`

### CSV Export Flow

1. Admin clicks "Preuzmi logove (CSV)" link -> `src/app/admin/[companyId]/page.tsx:114-119`
2. Browser navigates to `/api/admin/companies/:companyId/audit?limit=500` -> `src/app/admin/[companyId]/page.tsx:115`
3. Server validates global admin authentication -> `src/app/api/admin/companies/[companyId]/audit/route.ts:10-13`
4. System fetches audit logs (max 1000, configurable via limit param) -> `src/app/api/admin/companies/[companyId]/audit/route.ts:17-24`
5. Logs converted to CSV format with headers -> `src/app/api/admin/companies/[companyId]/audit/route.ts:26-39`
6. Response sent with CSV content type and download headers -> `src/app/api/admin/companies/[companyId]/audit/route.ts:41-47`
7. Browser downloads file as `audit-{companyId}.csv`

### Activity Statistics Flow

1. Detail page calls `fetchStats` function -> `src/app/admin/[companyId]/page.tsx:69`
2. System counts records across multiple tables in parallel -> `src/app/admin/[companyId]/page.tsx:361-367`
3. Counts contacts, products, invoices, expenses, users per company -> `src/app/admin/[companyId]/page.tsx:361-366`
4. Returns aggregated statistics object -> `src/app/admin/[companyId]/page.tsx:369`
5. Display stats in grid layout with labels -> `src/app/admin/[companyId]/page.tsx:226-232`

## Key Modules

| Module              | Purpose                                     | Location                                                 |
| ------------------- | ------------------------------------------- | -------------------------------------------------------- |
| AdminLayout         | Protected layout with auth check and header | `src/app/admin/layout.tsx`                               |
| AdminPage           | Company list view with table                | `src/app/admin/page.tsx`                                 |
| AdminCompanyPage    | Company detail view with stats and logs     | `src/app/admin/[companyId]/page.tsx`                     |
| AdminLoginPage      | Password authentication form                | `src/app/admin-login/page.tsx`                           |
| AdminAuthAPI        | Authentication endpoint for login/logout    | `src/app/api/admin/auth/route.ts`                        |
| AdminAuditExportAPI | CSV export endpoint for audit logs          | `src/app/api/admin/companies/[companyId]/audit/route.ts` |
| isGlobalAdmin       | Email-based admin authorization helper      | `src/lib/admin.ts:1-5`                                   |
| getEntitlementsList | Parse company entitlements from JSON        | `src/lib/admin.ts:16-20`                                 |
| MODULE_LABELS       | Croatian labels for module names            | `src/lib/admin.ts:7-14`                                  |

## Data

### Database Tables

#### Company Table

Core company data accessed by admin -> `prisma/schema.prisma:68-118`

Key fields for admin:

- `id` (String, CUID): Unique identifier -> `prisma/schema.prisma:69`
- `name` (String): Company name -> `prisma/schema.prisma:70`
- `oib` (String, unique): Croatian tax ID -> `prisma/schema.prisma:71`
- `vatNumber` (String?): VAT registration number -> `prisma/schema.prisma:72`
- `address` (String): Street address -> `prisma/schema.prisma:73`
- `city` (String): City name -> `prisma/schema.prisma:74`
- `postalCode` (String): Postal code -> `prisma/schema.prisma:75`
- `country` (String): Country code, default "HR" -> `prisma/schema.prisma:76`
- `isVatPayer` (Boolean): VAT payer status -> `prisma/schema.prisma:80`
- `legalForm` (String?): Legal entity type -> `prisma/schema.prisma:85`
- `entitlements` (Json?): Enabled modules array -> `prisma/schema.prisma:86`
- `featureFlags` (Json?): Feature flag overrides -> `prisma/schema.prisma:87`
- `createdAt` (DateTime): Registration timestamp -> `prisma/schema.prisma:82`

Relations used by admin:

- `users` (CompanyUser[]): User memberships -> `prisma/schema.prisma:107`
- `auditLogs` (AuditLog[]): Activity history -> `prisma/schema.prisma:104`
- `contacts` (Contact[]): Customer/vendor records -> `prisma/schema.prisma:108`
- `products` (Product[]): Product catalog -> `prisma/schema.prisma:115`
- `eInvoices` (EInvoice[]): Invoice records -> `prisma/schema.prisma:109`
- `expenses` (Expense[]): Expense records -> `prisma/schema.prisma:110`

#### CompanyUser Table

User-company memberships -> `prisma/schema.prisma:132-146`

Key fields:

- `id` (String, CUID): Unique identifier -> `prisma/schema.prisma:133`
- `userId` (String): User reference -> `prisma/schema.prisma:134`
- `companyId` (String): Company reference -> `prisma/schema.prisma:135`
- `role` (Role): User role (OWNER, ADMIN, MEMBER) -> `prisma/schema.prisma:136`
- `isDefault` (Boolean): Default company selection -> `prisma/schema.prisma:137`
- `createdAt` (DateTime): Membership creation date -> `prisma/schema.prisma:138`

Relations:

- `company` (Company): Company record -> `prisma/schema.prisma:140`
- `user` (User): User record -> `prisma/schema.prisma:141`

#### AuditLog Table

Activity tracking for compliance -> `prisma/schema.prisma:278-294`

Key fields:

- `id` (String, CUID): Unique identifier -> `prisma/schema.prisma:279`
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:280`
- `userId` (String?): User who performed action -> `prisma/schema.prisma:281`
- `action` (AuditAction): Action type enum -> `prisma/schema.prisma:282`
- `entity` (String): Model name -> `prisma/schema.prisma:283`
- `entityId` (String): Affected record ID -> `prisma/schema.prisma:284`
- `changes` (Json?): Before/after state -> `prisma/schema.prisma:285`
- `ipAddress` (String?): Request IP -> `prisma/schema.prisma:286`
- `userAgent` (String?): Request user agent -> `prisma/schema.prisma:287`
- `timestamp` (DateTime): Event time -> `prisma/schema.prisma:288`

### Query Patterns

#### Company List Query

Fetch all companies for admin dashboard -> `src/app/admin/page.tsx:8-20`

```typescript
const companies = await db.company.findMany({
  select: {
    id: true,
    name: true,
    oib: true,
    legalForm: true,
    isVatPayer: true,
    entitlements: true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
  take: 100,
})
```

#### Company Detail Query

Fetch single company with full details -> `src/app/admin/[companyId]/page.tsx:26-43`

```typescript
const company = await db.company.findUnique({
  where: { id: companyId },
  select: {
    id: true,
    name: true,
    oib: true,
    vatNumber: true,
    address: true,
    city: true,
    postalCode: true,
    country: true,
    isVatPayer: true,
    legalForm: true,
    entitlements: true,
    featureFlags: true,
    createdAt: true,
  },
})
```

#### Company Users Query

Fetch all users for a company -> `src/app/admin/[companyId]/page.tsx:55-59`

```typescript
const companyUsers = await db.companyUser.findMany({
  where: { companyId: company.id },
  include: { user: true },
  orderBy: { createdAt: "asc" },
})
```

#### Audit Logs Query with Filtering

Fetch filtered audit logs -> `src/app/admin/[companyId]/page.tsx:60-68`

```typescript
const auditLogs = await db.auditLog.findMany({
  where: {
    companyId: company.id,
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(entityFilter ? { entity: entityFilter } : {}),
  },
  orderBy: { timestamp: "desc" },
  take,
})
```

#### Activity Statistics Queries

Parallel count queries for stats -> `src/app/admin/[companyId]/page.tsx:361-367`

```typescript
const [contacts, products, invoices, expenses, users] = await Promise.all([
  db.contact.count({ where: { companyId } }),
  db.product.count({ where: { companyId } }),
  db.eInvoice.count({ where: { companyId } }),
  db.expense.count({ where: { companyId } }),
  db.companyUser.count({ where: { companyId } }),
])
```

### Authorization

#### Global Admin Check

Email-based allowlist authorization -> `src/lib/admin.ts:1-5`

```typescript
export function isGlobalAdmin(email?: string | null) {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
```

Configuration:

- Set `ADMIN_EMAILS` environment variable with comma-separated email addresses
- Example: `ADMIN_EMAILS=admin@example.com,support@example.com`
- Email comparison is case-insensitive

#### Password Authentication

Cookie-based session authentication -> `src/app/api/admin/auth/route.ts:7-21`

```typescript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Adminpass123!"
const ADMIN_COOKIE = "fiskai_admin_auth"

if (password === ADMIN_PASSWORD) {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  })
  return NextResponse.json({ success: true })
}
```

Configuration:

- Set `ADMIN_PASSWORD` environment variable
- Default password: `Adminpass123!` (change in production)
- Cookie expires after 24 hours
- Secure flag enabled in production
- HttpOnly prevents XSS attacks

### Module Entitlements

#### Module Labels

Croatian translations for module names -> `src/lib/admin.ts:7-14`

```typescript
export const MODULE_LABELS: Record<string, string> = {
  invoicing: "Dokumenti",
  eInvoicing: "E-Računi",
  expenses: "Troškovi",
  banking: "Banka",
  reports: "Izvještaji",
  settings: "Postavke",
}
```

#### Entitlements Parser

Extract module list from JSON field -> `src/lib/admin.ts:16-20`

```typescript
export function getEntitlementsList(entitlements: unknown): string[] {
  if (!entitlements) return []
  if (Array.isArray(entitlements)) return entitlements as string[]
  return []
}
```

## Dependencies

### Depends On

- **Authentication System**: User session and email verification -> `src/lib/auth-utils.ts:requireAuth`
- **Database Access**: Prisma client for data queries -> `src/lib/db.ts`
- **AuditLog Feature**: Company activity tracking -> `prisma/schema.prisma:278-294`
- **Next.js Cookies**: Server-side cookie management -> `next/headers:cookies`

### Depended By

- **Customer Support**: Support teams investigate company issues
- **Compliance Monitoring**: Audit company activity and data
- **System Operations**: Monitor system health and usage
- **Troubleshooting**: Debug customer-reported problems

## Integrations

### Internal Integrations

#### Admin Header Navigation

Header with logout button -> `src/app/admin/layout.tsx:22-39`

```typescript
<header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
  <div className="mx-auto flex max-w-6xl items-center justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
      <h1 className="text-xl font-semibold">Tenant Control Center</h1>
    </div>
    <form action="/api/admin/auth" method="POST">
      <input type="hidden" name="_method" value="DELETE" />
      <button type="submit">
        <LogOut className="h-3 w-3" />
        Odjava
      </button>
    </form>
  </div>
</header>
```

#### Breadcrumb Navigation

Company detail breadcrumb -> `src/app/admin/[companyId]/page.tsx:82-88`

```typescript
<div className="flex items-center gap-2 text-sm text-[var(--muted)]">
  <Link href="/admin" className="hover:text-[var(--foreground)]">
    Admin
  </Link>
  <span>/</span>
  <span>{company.name}</span>
</div>
```

#### Quick Action Links

Dashboard and settings links -> `src/app/admin/[companyId]/page.tsx:102-120`

```typescript
<Link href={`/dashboard`}>
  Idi na dashboard (trenutna tvrtka)
</Link>
<Link href={`/admin`}>
  Natrag na popis
</Link>
<a href={`/api/admin/companies/${company.id}/audit?limit=500`}>
  Preuzmi logove (CSV)
</a>
```

### External Integrations

None - this is an internal administrative interface.

## Verification Checklist

### Authentication

- [ ] Admin login page accessible at `/admin-login`
- [ ] Password field is type="password" (masked input)
- [ ] Incorrect password shows error message
- [ ] Correct password sets authentication cookie
- [ ] Cookie expires after 24 hours
- [ ] Cookie is httpOnly and secure in production
- [ ] Unauthenticated access to `/admin` redirects to login
- [ ] Logout button deletes authentication cookie
- [ ] Logout redirects to login page

### Authorization

- [ ] `ADMIN_PASSWORD` environment variable configurable
- [ ] `ADMIN_EMAILS` environment variable configurable
- [ ] Non-admin users cannot access admin pages
- [ ] Global admin check validates email against allowlist
- [ ] Email comparison is case-insensitive
- [ ] Empty ADMIN_EMAILS denies all access

### Company List View

- [ ] List displays up to 100 companies
- [ ] Companies ordered by creation date (newest first)
- [ ] Table shows: name, OIB, legal form, VAT status, modules, registration date
- [ ] OIB displayed in monospace font
- [ ] VAT status shows "PDV obveznik" or "Bez PDV-a" badge
- [ ] Module entitlements displayed as colored badges
- [ ] Module labels shown in Croatian
- [ ] Empty entitlements show "—"
- [ ] "Otvori" button links to company detail page
- [ ] Total count displayed in header

### Company Detail View

- [ ] Company identity card shows all profile fields
- [ ] VAT number shows "—" if null
- [ ] Address formatted with postal code and city
- [ ] Legal form badge displays or shows "Pravna forma nije unesena"
- [ ] VAT payer badge shows correct status
- [ ] Module entitlements listed with Croatian labels
- [ ] Feature flags displayed with key-value pairs
- [ ] Feature flags section hidden if empty
- [ ] Activity stats show correct counts
- [ ] User table displays all company members
- [ ] User roles displayed correctly (OWNER, ADMIN, MEMBER)
- [ ] User creation dates formatted in Croatian locale

### Audit Log Display

- [ ] Recent logs displayed (default 30, max 200)
- [ ] Logs ordered by timestamp descending
- [ ] Action filter dropdown shows all AuditAction types
- [ ] Entity filter accepts text input
- [ ] Limit parameter adjusts result count (10-200)
- [ ] "Primijeni" button submits filter form
- [ ] "Očisti" link clears all filters and returns to base URL
- [ ] Filtered state preserves across page loads
- [ ] Empty state shows "Još nema zabilježenih radnji"
- [ ] Entity ID shows first 8 characters
- [ ] User lookup displays name or email
- [ ] Timestamp formatted in Croatian locale with time

### CSV Export

- [ ] Export link includes limit parameter (default 500)
- [ ] Endpoint requires global admin authentication
- [ ] Non-admin requests return 403 Forbidden
- [ ] CSV includes all relevant columns
- [ ] CSV headers: timestamp, action, entity, entityId, userId, ipAddress, userAgent
- [ ] User agent quotes escaped in CSV
- [ ] Filename format: `audit-{companyId}.csv`
- [ ] Content-Type header is `text/csv; charset=utf-8`
- [ ] Content-Disposition triggers browser download
- [ ] Limit parameter respects 10-1000 range

### Navigation and UX

- [ ] Breadcrumb shows Admin / Company Name
- [ ] "Idi na dashboard" switches to tenant context
- [ ] "Natrag na popis" returns to company list
- [ ] "Otvori plan (tenant)" links to settings
- [ ] All Croatian text displays correctly
- [ ] Responsive layout works on mobile
- [ ] Tables scrollable on narrow screens
- [ ] Badges use consistent color scheme
- [ ] Loading states handled gracefully

## Evidence Links

1. `src/app/admin/page.tsx:7-95` - Company list page with table and module badges
2. `src/app/admin/[companyId]/page.tsx:17-379` - Company detail page with stats, users, and audit logs
3. `src/app/admin/layout.tsx:1-43` - Admin layout with authentication check and header
4. `src/app/admin-login/page.tsx:11-89` - Admin login form with password authentication
5. `src/app/api/admin/auth/route.ts:1-30` - Authentication API for login/logout with cookie management
6. `src/app/api/admin/companies/[companyId]/audit/route.ts:1-47` - CSV export endpoint for audit logs
7. `src/lib/admin.ts:1-20` - Admin utilities: isGlobalAdmin, MODULE_LABELS, getEntitlementsList
8. `prisma/schema.prisma:68-118` - Company table schema with entitlements and feature flags
9. `prisma/schema.prisma:132-146` - CompanyUser table schema for memberships
10. `prisma/schema.prisma:278-294` - AuditLog table schema for activity tracking
11. `docs/_meta/inventory/routes.json:48-70` - Route definitions for /admin and /admin/:companyId
12. `docs/_meta/inventory/api-endpoints.json:6-18` - API endpoint definitions for admin routes
