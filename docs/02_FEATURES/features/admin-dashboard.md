# Feature: Admin Dashboard

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

The Admin Dashboard (Tenant Control Center) is a super-admin interface that provides system administrators with comprehensive oversight of all registered companies, users, system statistics, and audit logs. It enables platform-level monitoring, tenant management, and support operations.

## User Entry Points

| Type   | Path              | Evidence                                |
| ------ | ----------------- | --------------------------------------- |
| Page   | /admin            | `src/app/admin/page.tsx:7`              |
| Page   | /admin/:companyId | `src/app/admin/[companyId]/page.tsx:17` |
| Page   | /admin-login      | `src/app/admin-login/page.tsx:11`       |
| Layout | /admin            | `src/app/admin/layout.tsx:13`           |

## Core Flow

### Admin Authentication Flow

1. Admin navigates to /admin → `src/app/admin/layout.tsx:14-18`
2. System checks for admin authentication cookie → `src/app/admin/layout.tsx:8-11`
3. If not authenticated, redirects to /admin-login → `src/app/admin/layout.tsx:16-18`
4. Admin enters password → `src/app/admin-login/page.tsx:56-80`
5. System validates against ADMIN_PASSWORD env variable → `src/app/api/admin/auth/route.ts:4-21`
6. On success, sets secure HTTP-only cookie (24hr expiry) → `src/app/api/admin/auth/route.ts:13-19`
7. Admin accesses Tenant Control Center → `src/app/admin/layout.tsx:26`

### Company Management Flow

1. Admin views company list (up to 100 companies) → `src/app/admin/page.tsx:8-20`
2. System displays: name, OIB, legal form, VAT status, modules, registration date → `src/app/admin/page.tsx:36-78`
3. Admin clicks "Otvori" to view company details → `src/app/admin/page.tsx:80-85`
4. System loads company-specific page with 3 card sections → `src/app/admin/[companyId]/page.tsx:26-43`
5. System fetches users, audit logs, and statistics in parallel → `src/app/admin/[companyId]/page.tsx:54-70`
6. Admin can filter audit logs by action and entity → `src/app/admin/[companyId]/page.tsx:279-318`
7. Admin can download audit logs as CSV → `src/app/admin/[companyId]/page.tsx:114-119`

## Key Modules

| Module              | Purpose                                     | Location                                                 |
| ------------------- | ------------------------------------------- | -------------------------------------------------------- |
| AdminLayout         | Authentication wrapper and header           | `src/app/admin/layout.tsx`                               |
| AdminPage           | Company list dashboard                      | `src/app/admin/page.tsx`                                 |
| AdminCompanyPage    | Individual company detail view              | `src/app/admin/[companyId]/page.tsx`                     |
| AdminLoginPage      | Admin authentication page                   | `src/app/admin-login/page.tsx`                           |
| AdminAuthAPI        | Password validation and session management  | `src/app/api/admin/auth/route.ts`                        |
| AuditLogAPI         | CSV export of company audit logs            | `src/app/api/admin/companies/[companyId]/audit/route.ts` |
| SupportDashboardAPI | Support ticket statistics and metrics       | `src/app/api/admin/support/dashboard/route.ts`           |
| AdminUtils          | Global admin checks and entitlement helpers | `src/lib/admin.ts`                                       |

## Admin Dashboard Components

### 1. Authentication Layer

**Login Page** → `src/app/admin-login/page.tsx:43-88`

- Dedicated /admin-login route separate from user authentication
- Password-only authentication (no email/2FA)
- Shield icon and branded admin messaging → `src/app/admin-login/page.tsx:46-53`
- Error handling with AlertCircle feedback → `src/app/admin-login/page.tsx:58-61`

**Auth API** → `src/app/api/admin/auth/route.ts:7-30`

- POST /api/admin/auth - Validates password and sets cookie → `src/app/api/admin/auth/route.ts:7-24`
- DELETE /api/admin/auth - Logout endpoint → `src/app/api/admin/auth/route.ts:26-30`
- Cookie: fiskai_admin_auth, HttpOnly, 24hr expiry → `src/app/api/admin/auth/route.ts:13-19`

**Layout Guard** → `src/app/admin/layout.tsx:13-18`

- Checks admin authentication on every page load
- Redirects to /admin-login if not authenticated
- Header displays "Tenant Control Center" branding → `src/app/admin/layout.tsx:26`
- Logout button in header → `src/app/admin/layout.tsx:28-36`

### 2. Company List Dashboard

**Main View** → `src/app/admin/page.tsx:22-94`

- Displays up to 100 most recent companies → `src/app/admin/page.tsx:18-20`
- Table columns: Name, OIB, Legal Form, VAT Status, Modules, Registered, Actions
- Total company count badge → `src/app/admin/page.tsx:29-31`

**Module Display** → `src/app/admin/page.tsx:60-74`

- Parses entitlements JSON field → `src/lib/admin.ts:16-20`
- Displays module badges with human-readable labels → `src/lib/admin.ts:7-14`
- Color-coded: brand-50 background, brand-700 text → `src/app/admin/page.tsx:68`

### 3. Company Detail Page

**Identity Card** → `src/app/admin/[companyId]/page.tsx:126-160`

- Company name, OIB, VAT number, address, country
- Legal form and VAT payer status badges
- Creation date display → `src/app/admin/[companyId]/page.tsx:132-134`

**Plan & Modules Card** → `src/app/admin/[companyId]/page.tsx:162-217`

- Active module count and list → `src/app/admin/[companyId]/page.tsx:168-188`
- Feature flags display (JSON object) → `src/app/admin/[companyId]/page.tsx:72-75`
- Links to tenant settings and dashboard → `src/app/admin/[companyId]/page.tsx:190-202`

**Activity Statistics Card** → `src/app/admin/[companyId]/page.tsx:219-233`

- Real-time counts: Users, Contacts, Products, E-Invoices, Expenses
- Fetched in parallel via fetchStats() → `src/app/admin/[companyId]/page.tsx:360-370`

**Users Table** → `src/app/admin/[companyId]/page.tsx:236-269`

- Lists all company members with user details
- Columns: Name, Email, Role, Date Added → `src/app/admin/[companyId]/page.tsx:244-248`
- Includes CompanyUser join to User table → `src/app/admin/[companyId]/page.tsx:55-59`

**Audit Logs Table** → `src/app/admin/[companyId]/page.tsx:271-355`

- Filterable by action (CREATE, UPDATE, DELETE, etc.) → `src/app/admin/[companyId]/page.tsx:50-67`
- Filterable by entity (EInvoice, Contact, etc.)
- Configurable limit (10-200 records) → `src/app/admin/[companyId]/page.tsx:52`
- Displays: Action, Entity, User, Timestamp → `src/app/admin/[companyId]/page.tsx:327-330`
- CSV export link (up to 500 records) → `src/app/admin/[companyId]/page.tsx:114-119`

## Data

### Database Tables

- **Company** → `prisma/schema.prisma:68`
  - Fields: name, oib, vatNumber, legalForm, isVatPayer, entitlements, featureFlags → `prisma/schema.prisma:70-87`
  - Entitlements stored as JSON array → `prisma/schema.prisma:86`
  - Feature flags stored as JSON object → `prisma/schema.prisma:87`

- **CompanyUser** → `prisma/schema.prisma:132`
  - Join table linking users to companies → `prisma/schema.prisma:134-135`
  - Fields: userId, companyId, role, isDefault → `prisma/schema.prisma:133-137`

- **User** → `prisma/schema.prisma:9`
  - Fields: email, name, emailVerified, image → `prisma/schema.prisma:11-14`

- **AuditLog** → `prisma/schema.prisma:278`
  - Fields: companyId, userId, action, entity, entityId, timestamp → `prisma/schema.prisma:280-283`
  - Indexed for efficient filtering → `prisma/schema.prisma:278`

- **SupportTicket** → `src/app/api/admin/support/dashboard/route.ts:42-50`
  - Used by support dashboard API for ticket statistics
  - Fields: status, priority, title, companyId, createdAt, updatedAt

### Statistics Queries

**Company-Level Stats** → `src/app/admin/[companyId]/page.tsx:360-370`

```typescript
Promise.all([
  db.contact.count({ where: { companyId } }),
  db.product.count({ where: { companyId } }),
  db.eInvoice.count({ where: { companyId } }),
  db.expense.count({ where: { companyId } }),
  db.companyUser.count({ where: { companyId } }),
])
```

**System-Level Metrics** → `src/lib/monitoring/system-health.ts:236-268`

- User count, company count, invoice count, expense count, contact count
- Exposed via /api/metrics endpoint → `src/app/api/metrics/route.ts:12-27`

## Security

### Authorization Model

**Global Admin Check** → `src/lib/admin.ts:1-5`

- Uses ADMIN_EMAILS environment variable (comma-separated)
- Email-based allowlist (case-insensitive)
- Used in both UI and API endpoints

**Admin Routes Protection** → `src/app/admin/[companyId]/page.tsx:18-21`

- Server-side requireAuth() check → `src/app/admin/[companyId]/page.tsx:18`
- isGlobalAdmin() validation → `src/app/admin/[companyId]/page.tsx:19`
- Redirects non-admins to /dashboard → `src/app/admin/[companyId]/page.tsx:20-21`

**API Endpoint Protection** → `src/app/api/admin/companies/[companyId]/audit/route.ts:10-13`

- Session-based auth check → `src/app/api/admin/companies/[companyId]/audit/route.ts:10`
- Global admin email verification → `src/app/api/admin/companies/[companyId]/audit/route.ts:11`
- 403 Forbidden response for unauthorized access → `src/app/api/admin/companies/[companyId]/audit/route.ts:12`

### Session Management

- Cookie name: fiskai_admin_auth → `src/app/admin/layout.tsx:6`
- HTTP-only flag prevents XSS → `src/app/api/admin/auth/route.ts:14`
- Secure flag in production → `src/app/api/admin/auth/route.ts:15`
- SameSite: lax for CSRF protection → `src/app/api/admin/auth/route.ts:16`
- 24-hour expiry → `src/app/api/admin/auth/route.ts:17`

## Support Dashboard API

**Endpoint** → `src/app/api/admin/support/dashboard/route.ts:32-129`

- GET /api/admin/support/dashboard
- Returns comprehensive support ticket metrics

**Metrics Provided** → `src/app/api/admin/support/dashboard/route.ts:10-30`

- Total tickets, open tickets, in-progress, resolved, closed counts
- Breakdown by priority (LOW, NORMAL, HIGH, URGENT) → `src/app/api/admin/support/dashboard/route.ts:60-69`
- Breakdown by status → `src/app/api/admin/support/dashboard/route.ts:72-77`
- Average resolution time (placeholder) → `src/app/api/admin/support/dashboard/route.ts:80-81`
- Oldest open ticket ID → `src/app/api/admin/support/dashboard/route.ts:84-88`
- Companies with open tickets count → `src/app/api/admin/support/dashboard/route.ts:90-95`
- Recent activity (last 10 updated tickets) → `src/app/api/admin/support/dashboard/route.ts:98-106`

## Dependencies

- **Depends on**:
  - Environment variable ADMIN_PASSWORD for authentication → `src/app/api/admin/auth/route.ts:4`
  - Environment variable ADMIN_EMAILS for authorization → `src/lib/admin.ts:3`
  - NextAuth session for API endpoint protection → `src/app/api/admin/companies/[companyId]/audit/route.ts:10`
  - Prisma ORM for database queries

- **Depended by**:
  - Support team workflows for customer assistance
  - Operations team for system monitoring
  - Development team for debugging tenant-specific issues

## Integrations

None - This is a pure internal admin interface with no external API integrations.

## Verification Checklist

- [x] Admin can login with password at /admin-login
- [x] Non-authenticated users are redirected to /admin-login
- [x] Company list displays up to 100 companies with correct data
- [x] Module badges display human-readable labels
- [x] Company detail page shows identity, plan, and activity stats
- [x] Audit logs can be filtered by action and entity
- [x] Audit logs can be exported as CSV
- [x] Users table displays all company members
- [x] Feature flags are displayed when present
- [x] Logout button clears admin session
- [x] Non-admin users cannot access /admin routes
- [x] API endpoints verify global admin status
- [x] Support dashboard API returns ticket metrics
- [x] Session cookie expires after 24 hours

## Evidence Links

1. `src/app/admin/page.tsx:7-95` - Main admin dashboard with company list
2. `src/app/admin/[companyId]/page.tsx:17-379` - Company detail page with stats and audit logs
3. `src/app/admin/layout.tsx:13-45` - Admin layout with authentication guard
4. `src/app/admin-login/page.tsx:11-89` - Admin login interface
5. `src/app/api/admin/auth/route.ts:7-30` - Admin authentication API endpoints
6. `src/app/api/admin/companies/[companyId]/audit/route.ts:6-48` - Audit log CSV export API
7. `src/app/api/admin/support/dashboard/route.ts:32-129` - Support dashboard metrics API
8. `src/lib/admin.ts:1-20` - Admin utility functions and module labels
9. `prisma/schema.prisma:68-92` - Company model with entitlements and feature flags
10. `prisma/schema.prisma:132-141` - CompanyUser model for user-company relationships
11. `prisma/schema.prisma:278-291` - AuditLog model for audit trail
12. `docs/_meta/inventory/routes.json:48-70` - Admin route registrations
13. `docs/_meta/inventory/api-endpoints.json:5-18` - Admin API endpoint registrations
14. `src/lib/monitoring/system-health.ts:236-268` - System metrics collection
