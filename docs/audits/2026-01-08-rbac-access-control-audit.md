# RBAC Access Control Audit Report

**Date:** 2026-01-08
**Scope:** Multi-company role-based access control (USER, ACCOUNTANT, STAFF, ADMIN)
**Objective:** Verify role checks include company scope; identify frontend assumptions without backend enforcement

---

## Executive Summary

The FiskAI RBAC system uses a **three-tier hierarchy**:

1. **System Level** - `SystemRole` (USER/STAFF/ADMIN) determines portal access via subdomain routing
2. **Company Level** - `Role` (OWNER/ADMIN/MEMBER/ACCOUNTANT/VIEWER) determines permissions within a company
3. **Feature Level** - Module entitlements + permission actions (view/create/edit/delete/export/admin)

**Overall Assessment:** The system has strong RBAC foundations with company-scoped permission checks enforced via `CompanyUser` lookups and tenant isolation middleware. However, several security gaps were identified that require remediation.

---

## Role Definitions

### System Roles (Platform-Level)
**Location:** `prisma/schema.prisma:2851-2855`, `src/lib/auth/system-role.ts`

| Role | Access |
|------|--------|
| USER | `app.fiskai.hr` only |
| STAFF | `staff.fiskai.hr` + `app.fiskai.hr` (assigned clients only) |
| ADMIN | `admin.fiskai.hr` + `staff.fiskai.hr` + `app.fiskai.hr` (all companies) |

### Company Roles (Company-Level)
**Location:** `prisma/schema.prisma:2843-2849`, `src/lib/rbac.ts`

| Role | Capabilities |
|------|--------------|
| OWNER | Full permissions including billing, ownership transfer |
| ADMIN | Most permissions except billing, user role changes |
| MEMBER | Create/read/update documents |
| ACCOUNTANT | Read-only + special permissions (reports, export) |
| VIEWER | View-only access to reports and data |

---

## Access Control Architecture

### Key Authorization Files

| Component | Location | Functions |
|-----------|----------|-----------|
| System Roles | `src/lib/auth/system-role.ts` | `getSystemRole()`, `canAccessSubdomain()` |
| Company Roles | `src/lib/rbac.ts` | `getUserRole()`, `hasPermission()`, `requirePermission()` |
| Auth Helpers | `src/lib/auth-utils.ts` | `requireAuth()`, `requireAdmin()`, `requireCompanyWithPermission()` |
| Staff Access | `src/lib/auth-utils-additions.ts` | `requireStaffAccess()` |
| Tenant Isolation | `src/lib/prisma-extensions.ts` | `runWithTenant()`, `getTenantContext()` |
| Middleware | `src/middleware.ts` | Subdomain routing, JWT validation |

### Authorization Patterns

**Pattern 1: Server Action with RBAC** (Recommended)
```typescript
// src/lib/auth-utils.ts:211-231
async function requireCompanyWithPermission<T>(
  userId: string,
  permission: Permission,
  fn: (company, user) => Promise<T>
): Promise<T>
```
- Validates authentication
- Gets user's company
- Checks permission in company context
- Runs in tenant isolation (`runWithTenant`)
- Runs with audit context

**Pattern 2: Admin-Only Routes**
```typescript
// src/lib/auth-utils.ts:51-66
async function requireAdmin() {
  const user = await requireAuth()
  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  if (dbUser?.systemRole !== "ADMIN") {
    redirect("/")
  }
  return user
}
```

**Pattern 3: Staff Access Control**
```typescript
// src/lib/auth-utils-additions.ts:29-59
async function requireStaffAccess(userId, systemRole, companyId): Promise<boolean>
// ADMIN: Full access to all companies
// STAFF: Must have StaffAssignment record
// USER: Throws error (not allowed)
```

---

## Audit Findings

### CRITICAL: Article Agent Lacks Authorization

**Location:** `src/app/actions/article-agent.ts`
**Severity:** HIGH
**Impact:** Any authenticated user can create, approve, and publish public content

**Issue:** All 12 functions in this file use only `requireAuth()` without company or permission checks:

```typescript
// Line 43-67: createJob()
await requireAuth()  // Only checks if logged in
const job = await createArticleJob({...})  // No company scope or permission check
```

**Affected Functions:**
- `createJob()` - Create article generation jobs
- `startJob()` - Start processing
- `approveJob()` - Approve for publication
- `publishJob()` - Publish to public site (NEWS type)
- `rejectJob()` - Reject articles
- `deleteJob()` - Delete articles
- `lockParagraph()`, `unlockParagraph()` - Edit controls
- `triggerRewrite()` - Trigger rewrites
- `getJobs()`, `getJobStatus()`, `getJobWithVerification()` - View all jobs

**Risk:** Any authenticated USER can:
1. View ALL article jobs (no ownership check)
2. Approve and publish NEWS articles to the public website
3. Delete other users' article jobs

**Recommendation:** Add `requireAdmin()` or a new editorial permission:
```typescript
// Example fix
export async function publishJob(jobId: unknown) {
  const user = await requireAuth()
  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  if (!["ADMIN", "STAFF"].includes(dbUser?.systemRole ?? "")) {
    return { success: false, error: "Unauthorized" }
  }
  // ... rest of function
}
```

---

### MEDIUM: Bank Callback No Explicit Auth

**Location:** `src/app/api/bank/callback/route.ts`
**Severity:** MEDIUM
**Impact:** Relies on `ref` parameter security, potential for enumeration

**Issue:** The bank OAuth callback has no explicit authentication:

```typescript
// Line 8-14
export async function GET(request: Request) {
  const ref = searchParams.get("ref")
  if (!ref) redirect("/banking?error=missing_ref")

  const connection = await db.bankConnection.findFirst({
    where: { bankAccountId: ref },  // Only checks ref exists
  })
}
```

**Mitigation Factors:**
- `ref` is the bankAccountId (UUID), which is hard to guess
- Connection must exist in database
- This is standard OAuth callback pattern

**Recommendation:** Consider adding:
1. Session validation to ensure callback matches user who initiated
2. Time-limited callback tokens
3. Rate limiting on callback endpoint

---

### MEDIUM: Fiscal Rules Calculate - Public Endpoint

**Location:** `src/app/api/fiscal/rules/calculate/route.ts`
**Severity:** MEDIUM
**Impact:** Internal calculation endpoint exposed without auth

**Issue:** No authentication check on fiscal rule calculation:

```typescript
export const POST = withApiLogging(async (request: NextRequest) => {
  const payload = await request.json()
  if (!payload?.tableKey) {
    return NextResponse.json({ error: "tableKey is required" }, { status: 400 })
  }
  const result = await calculateDeterministicRule(payload)
  return NextResponse.json({ success: true, ...result })
})
```

**Risk:** Allows unauthenticated access to fiscal calculation logic. May expose business rules.

**Recommendation:** Add `requireAuth()` or restrict to internal-only access.

---

### LOW: Assistant Chat Accepts Arbitrary companyId

**Location:** `src/app/api/assistant/chat/route.ts`
**Severity:** LOW
**Impact:** Public endpoint accepts optional `companyId` without validation

**Issue:** The schema accepts `companyId` but doesn't validate ownership:

```typescript
const chatRequestSchema = z.object({
  query: z.string().min(1).max(4000),
  surface: z.enum(["MARKETING", "APP"]),
  companyId: z.string().uuid().optional(),  // Not validated
})
```

**Context:** This is intentionally a public endpoint for the AI assistant. The `companyId` is used for context but doesn't expose sensitive data.

**Recommendation:** Document this as intentional design. If `companyId` is used for personalization, ensure responses don't leak company-specific data to unauthenticated users.

---

## Positive Findings

### Company Scope Properly Enforced

**Import Jobs Route** (`src/app/api/import/jobs/[id]/route.ts:16-27`):
```typescript
const job = await db.importJob.findUnique({ where: { id } })
if (!job || job.companyId !== company.id) {
  return NextResponse.json({ error: "Job not found" }, { status: 404 })
}
```
IDOR protection properly implemented.

**Admin Tenant Management** (`src/app/api/admin/tenants/[companyId]/users/route.ts`):
```typescript
await requireAdmin()  // Proper admin check
// All operations scoped to companyId parameter
```
Proper admin authorization with audit logging.

**Server Actions** (94% with proper authorization):
- Invoice actions: `requireCompanyWithPermission(user.id!, "invoice:*")`
- Expense actions: `requireCompanyWithPermission(user.id!, "expense:*")`
- Banking actions: `requireCompany()` + `runWithTenant()`
- Company actions: Role checks for OWNER/ADMIN operations

**Capability Executor** (`src/lib/capabilities/actions/executor.ts`):
```typescript
const permissions = buildPermissions(user.systemRole, membership.role)
// Capability state checked: BLOCKED, UNAUTHORIZED, MISSING_INPUTS
if (capability.state === "UNAUTHORIZED") {
  return { success: false, error: "Not authorized", code: "UNAUTHORIZED" }
}
```
Proper permission matrix building from both system and company roles.

### Staff Access Properly Isolated

**StaffAssignment Model** enforces that STAFF users can only access assigned companies:
```typescript
async function requireStaffAccess(userId, systemRole, companyId) {
  if (systemRole === "ADMIN") return true
  if (systemRole !== "STAFF") throw new Error("...")

  const assignment = await db.staffAssignment.findUnique({
    where: { staffId_companyId: { staffId: userId, companyId } }
  })
  if (!assignment) throw new Error("Not assigned to this company")
  return true
}
```

### Frontend Role Checks Have Backend Enforcement

The admin tenant detail view (`src/app/(admin)/tenants/[companyId]/tenant-detail-view.tsx`) shows role options in UI, but all operations go through API routes that use `requireAdmin()`.

---

## Summary Statistics

| Category | Count | With Auth | Percentage |
|----------|-------|-----------|------------|
| Server Action Files | 33 | 31 | 94% |
| Server Action Functions | 80+ | ~75 | ~94% |
| API Routes | 120+ | 115+ | ~96% |
| Cron Routes | 18 | 18 | 100% (CRON_SECRET) |
| Admin Routes | 40+ | 40+ | 100% (requireAdmin) |

---

## Recommendations

### Immediate (Critical)

1. **Article Agent Authorization** - Add `requireAdmin()` or editorial permission to all 12 functions in `src/app/actions/article-agent.ts`

### Short-term (High)

2. **Bank Callback Security** - Add session correlation to OAuth callback flow
3. **Fiscal Rules Auth** - Add authentication to `/api/fiscal/rules/calculate`

### Medium-term (Low)

4. **Document Intentional Public Endpoints** - Create explicit documentation for endpoints that are intentionally public (assistant, news API)
5. **Rate Limiting** - Add rate limiting to public-facing endpoints

---

## Audit Methodology

1. **Schema Analysis** - Reviewed Prisma schema for role definitions
2. **Code Search** - Searched for `requireAuth`, `requireAdmin`, `requireCompanyWithPermission`, `requireStaffAccess`
3. **Pattern Analysis** - Identified authorization patterns across server actions and API routes
4. **Gap Analysis** - Identified endpoints missing company scope checks
5. **Frontend Review** - Verified frontend role checks have backend enforcement

**Files Reviewed:**
- `prisma/schema.prisma` (role enums)
- `src/lib/rbac.ts` (permission matrix)
- `src/lib/auth-utils.ts` (auth helpers)
- `src/lib/auth-utils-additions.ts` (staff access)
- `src/lib/capabilities/server.ts` (capability resolution)
- `src/lib/capabilities/actions/executor.ts` (action execution)
- `src/app/actions/*.ts` (33 server action files)
- `src/app/api/**/*.ts` (120+ API routes)
- `src/middleware.ts` (subdomain routing)

---

## Appendix: Permission Matrix

From `src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // Invoice permissions
  "invoice:create": ["OWNER", "ADMIN", "MEMBER"],
  "invoice:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "invoice:update": ["OWNER", "ADMIN", "MEMBER"],
  "invoice:delete": ["OWNER", "ADMIN"],

  // Expense permissions
  "expense:create": ["OWNER", "ADMIN", "MEMBER"],
  "expense:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "expense:update": ["OWNER", "ADMIN", "MEMBER"],
  "expense:delete": ["OWNER", "ADMIN"],

  // Settings
  "settings:read": ["OWNER", "ADMIN", "ACCOUNTANT"],
  "settings:update": ["OWNER", "ADMIN"],
  "billing:manage": ["OWNER"],

  // User management
  "users:invite": ["OWNER", "ADMIN"],
  "users:remove": ["OWNER", "ADMIN"],
  "users:update_role": ["OWNER"],

  // Reports
  "reports:read": ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"],
  "reports:export": ["OWNER", "ADMIN", "ACCOUNTANT"],

  // Fiscal/Certificate management
  "fiscal:manage": ["OWNER", "ADMIN"],
}
```
