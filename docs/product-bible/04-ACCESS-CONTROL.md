# Access Control

[← Back to Index](./00-INDEX.md)

---

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
> **Version:** 4.0.0
>
> Comprehensive update: Added Capability System, V2 Entitlements, Competence-based access, Path-based routing.

---

## 4. Authentication & Security

### 4.1 Authentication Methods

FiskAI supports multiple authentication methods for user convenience and security.

**Credentials Authentication:**

- Email + password login
- Passwords hashed with bcrypt
- Rate-limited login attempts (5 attempts per 15 minutes, 1-hour block on exceed)

**OAuth/SSO:**

- Google OAuth integration (when configured)
- Auto-verifies email for OAuth users

**WebAuthn/Passkey Authentication:**

```typescript
// src/lib/webauthn.ts
// Passkey registration and authentication using @simplewebauthn/server
interface RegisteredCredential {
  credentialId: string
  publicKey: string
  counter: bigint
  transports: string | null
}
```

**Passwordless OTP Login:**

```typescript
// src/lib/auth/otp.ts
// 6-digit cryptographically secure OTP codes
export const OTP_EXPIRY_MINUTES = 10
// Rate limited: 3 codes per email per hour, 5 verification attempts per code
```

### 4.2 Session Management

```typescript
// src/lib/auth.ts - NextAuth v5 configuration
session: { strategy: "jwt" }
cookies: {
  sessionToken: {
    name: "__Secure-next-auth.session-token", // production
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      domain: ".fiskai.hr" // Cross-subdomain support
    }
  }
}
```

**Session Management:**

- Single session cookie for `app.fiskai.hr` (all portals share one domain)
- Path-based routing: `/staff/*` and `/admin/*` paths are protected by middleware
- JWT includes `systemRole` for portal access decisions

### 4.3 Rate Limiting

**Implemented in `/src/lib/security/rate-limit.ts`:**

| Limit Type         | Attempts | Window     | Block Duration |
| ------------------ | -------- | ---------- | -------------- |
| LOGIN              | 5        | 15 minutes | 1 hour         |
| PASSWORD_RESET     | 3        | 15 minutes | 1 hour         |
| EMAIL_VERIFICATION | 3        | 1 hour     | 1 hour         |
| OTP_SEND           | 3        | 1 hour     | 1 hour         |
| OTP_VERIFY         | 5        | 10 minutes | 30 minutes     |
| API_CALLS          | 100      | 15 minutes | 15 minutes     |

```typescript
// Usage
import { checkRateLimit } from "@/lib/security/rate-limit"

const result = checkRateLimit(`login_${email}`, "LOGIN")
if (!result.allowed) {
  // User is blocked until result.blockedUntil
}
```

### 4.4 System Roles (Portal Access)

**Three-tier system role architecture (`User.systemRole`):**

Defined in `prisma/schema.prisma`:

```prisma
enum SystemRole {
  USER
  STAFF
  ADMIN
}
```

| System Role | Can Access Paths                  | Description                    |
| ----------- | --------------------------------- | ------------------------------ |
| `USER`      | `/cc`, `/dashboard`, app features | Regular business user          |
| `STAFF`     | `/staff/*`, plus all USER paths   | Internal accountant            |
| `ADMIN`     | `/admin/*`, plus all STAFF/USER   | Platform admin, tenant manager |

**Path-Based Access Control (replaces legacy subdomain routing):**

```typescript
// src/lib/auth/system-role.ts
export function canAccessPath(systemRole: SystemRole, pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return systemRole === "ADMIN"
  }
  if (pathname.startsWith("/staff")) {
    return systemRole === "STAFF" || systemRole === "ADMIN"
  }
  // All other paths accessible by all authenticated users
  return true
}

export function getAvailablePaths(systemRole: SystemRole): string[] {
  switch (systemRole) {
    case "ADMIN":
      return ["/admin", "/staff", "/dashboard"]
    case "STAFF":
      return ["/staff", "/dashboard"]
    case "USER":
    default:
      return ["/dashboard"]
  }
}
```

**Legacy Subdomain Redirects:**

```typescript
// src/middleware.ts
// admin.fiskai.hr -> app.fiskai.hr/admin (308 permanent redirect)
// staff.fiskai.hr -> app.fiskai.hr/staff (308 permanent redirect)
// All role-based access now enforced at path level, not subdomain level
```

**Middleware Enforcement:**

```typescript
// src/middleware.ts
const systemRole = (token.systemRole as string) || "USER"

// Enforce role-based path restrictions
if (!canAccessPath(systemRole, pathname)) {
  // Redirect to appropriate dashboard for their role
  const dashboardPath = getDashboardPathForRole(systemRole)
  return NextResponse.redirect(dashboardPath)
}
```

---

## 5. Module System & Entitlements

### 5.1 The 17 Module Keys

Stored in `Company.entitlements[]` as kebab-case strings:

| Module Key         | Description              | Default | Status         |
| ------------------ | ------------------------ | ------- | -------------- |
| `platform-core`    | Core dashboards/settings | FREE    | ✅ Implemented |
| `invoicing`        | Manual PDF generation    | FREE    | ✅ Implemented |
| `e-invoicing`      | UBL/XML B2B/B2G          | FREE    | ✅ Implemented |
| `contacts`         | CRM directory            | FREE    | ✅ Implemented |
| `products`         | Product catalog          | FREE    | ✅ Implemented |
| `expenses`         | Expense tracking         | FREE    | ✅ Implemented |
| `banking`          | Bank import & sync       | PAID    | ✅ Implemented |
| `documents`        | Document vault (archive) | FREE    | ✅ Implemented |
| `reports-basic`    | KPR, aging, P&L          | FREE    | ✅ Implemented |
| `fiscalization`    | CIS integration          | PAID    | ✅ Implemented |
| `reconciliation`   | Auto-matching            | PAID    | ✅ Implemented |
| `reports-advanced` | VAT reports, exports     | PAID    | ⚠️ Partial     |
| `pausalni`         | Pausalni features        | AUTO\*  | ✅ Implemented |
| `vat`              | VAT management           | AUTO\*  | ⚠️ Partial     |
| `corporate-tax`    | D.O.O./JDOO tax          | AUTO\*  | 📋 Planned     |
| `pos`              | Point of sale            | PAID    | ⚠️ Partial     |
| `ai-assistant`     | AI chat & extraction     | PAID    | ✅ Implemented |

\*AUTO modules are auto-assigned based on `legalForm` via `getEntitlementsForLegalForm()`.

**Current behavior:** Legal-form-specific features are controlled by both:

1. Module entitlements (feature access)
2. Visibility system (`src/lib/visibility/rules.ts`) - hides irrelevant UI

### 5.2 Module Definition Structure

```typescript
// src/lib/modules/definitions.ts
export interface ModuleDefinition {
  key: ModuleKey
  name: string // English display name
  description: string // English description
  routes: string[] // Protected route patterns
  navItems: string[] // Nav item identifiers
  defaultEnabled: boolean
  depends?: ModuleKey[] // Module dependencies
  featureFlagKey?: string // Optional feature flag
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  "platform-core": {
    key: "platform-core",
    name: "Platform Core",
    description: "Core platform access (dashboards, settings, support)",
    routes: ["/dashboard", "/settings", "/support", "/accountant", "/compliance"],
    navItems: ["dashboard", "settings", "support"],
    defaultEnabled: true,
  },
  "e-invoicing": {
    key: "e-invoicing",
    name: "E-Invoicing",
    description: "Electronic invoices with UBL/XML support",
    routes: ["/e-invoices", "/e-invoices/new", "/e-invoices/[id]"],
    navItems: ["e-invoices"],
    defaultEnabled: true,
    depends: ["invoicing", "contacts"], // Dependency enforcement
  },
  "ai-assistant": {
    key: "ai-assistant",
    name: "AI Assistant",
    description: "AI-powered help and document analysis",
    routes: ["/assistant", "/article-agent"],
    navItems: ["ai-assistant"],
    defaultEnabled: false,
    featureFlagKey: "ai_assistant", // Requires feature flag
  },
  // ... 15 more modules (see src/lib/modules/definitions.ts)
}
```

### 5.3 V2 Entitlements System (Granular Permissions)

**Implemented:** `/src/lib/modules/permissions.ts`

The system supports two formats:

**Legacy (V1):** Array of module keys

```typescript
// Company.entitlements (V1 - legacy)
;["platform-core", "invoicing", "contacts", "products"]
```

**V2 (Current):** Granular permissions per module

```typescript
// src/lib/modules/permissions.ts
export interface ModuleEntitlement {
  moduleKey: ModuleKey
  permissions: PermissionAction[] // ["view", "create", "edit", "delete", "export", "admin"]
  expiresAt?: Date | null // For trial features
  grantedAt: Date
  grantedBy: string
  reason?: string
}

export interface CompanyEntitlements {
  version: 2
  modules: Record<ModuleKey, ModuleEntitlement | null>
  subscriptionPlan?: string // "free" | "starter" | "professional" | "enterprise"
}

// Example V2 entitlements
{
  "version": 2,
  "subscriptionPlan": "professional",
  "modules": {
    "invoicing": {
      "moduleKey": "invoicing",
      "permissions": ["view", "create", "edit", "delete"],
      "grantedAt": "2025-01-01T00:00:00Z",
      "grantedBy": "system",
      "reason": "Default for professional plan"
    },
    "ai-assistant": {
      "moduleKey": "ai-assistant",
      "permissions": ["view", "create"],
      "expiresAt": "2025-02-01T00:00:00Z", // 30-day trial
      "grantedAt": "2025-01-01T00:00:00Z",
      "grantedBy": "user_abc123",
      "reason": "30-day trial"
    }
  }
}
```

**Permission Actions:**

| Action   | Description                             |
| -------- | --------------------------------------- |
| `view`   | Read-only access to module data         |
| `create` | Create new records                      |
| `edit`   | Edit existing records                   |
| `delete` | Delete records (requires OWNER/ADMIN)   |
| `export` | Export data (reports, CSV, etc.)        |
| `admin`  | Module admin (settings, configurations) |

**Subscription Plan Defaults:**

```typescript
// src/lib/modules/permissions.ts
export const PLAN_DEFAULTS = {
  free: {
    modules: ["platform-core", "invoicing", "contacts", "products", "documents"],
    permissions: ["view", "create", "edit", "delete"],
  },
  starter: {
    modules: [...free, "e-invoicing", "expenses", "reports-basic"],
    permissions: ["view", "create", "edit", "delete", "export"],
  },
  professional: {
    modules: [...starter, "banking", "reconciliation", "vat", "reports-advanced"],
    permissions: ["view", "create", "edit", "delete", "export"],
  },
  enterprise: {
    modules: [...all 17 modules],
    permissions: ["view", "create", "edit", "delete", "export", "admin"], // Full access
  },
}
```

**Migration from V1 to V2:**

```typescript
// src/lib/modules/entitlement-service.ts
export async function migrateCompanyEntitlements(
  companyId: string,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  const legacy = ["platform-core", "invoicing"] // V1 format
  const migrated = migrateEntitlements(legacy, context.userId)

  // Logs migration in EntitlementHistory
  await prisma.entitlementHistory.create({
    data: {
      companyId,
      userId: context.userId,
      changeType: "ENTITLEMENTS_MIGRATED",
      previousValue: legacy,
      newValue: migrated,
      reason: "Automated migration to v2 entitlements",
    },
  })

  return migrated
}
```

**Entitlement Management:**

```typescript
// Enable module with custom permissions
await enableModule(companyId, "ai-assistant", ["view", "create"], {
  userId: "user_abc",
  reason: "Upgraded to pro plan",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
})

// Start trial (auto-expires after N days)
await startModuleTrial(companyId, "banking", 30, {
  userId: "user_abc",
  reason: "30-day trial started",
})

// Disable module
await disableModule(companyId, "vat", {
  userId: "user_abc",
  reason: "Downgraded to starter plan",
})
```

**Audit Trail:**

All entitlement changes are logged in `EntitlementHistory`:

```typescript
// Change types tracked
export type EntitlementChangeType =
  | "MODULE_ENABLED"
  | "MODULE_DISABLED"
  | "PERMISSIONS_UPDATED"
  | "TRIAL_STARTED"
  | "TRIAL_EXPIRED"
  | "PLAN_UPGRADED"
  | "PLAN_DOWNGRADED"
  | "ENTITLEMENTS_MIGRATED"
  | "MANUAL_OVERRIDE"

// Query audit history
const history = await getEntitlementHistory(companyId, {
  moduleKey: "ai-assistant",
  limit: 50,
})
```

### 5.4 Module Access Control

**Route-based access checking:**

```typescript
// src/lib/modules/access.ts
export function createModuleAccess(entitlements: string[]): ModuleAccess {
  return {
    hasModule: (moduleKey) => enabledModules.has(moduleKey),
    getEnabledModules: () => Array.from(enabledModules),
    canAccessRoute: (pathname) => {
      const moduleKey = getModuleForRoute(pathname)
      if (!moduleKey) return true // No module protection
      return hasModule(moduleKey)
    },
    getModuleForRoute: (pathname) => /* matches route to module */
  }
}
```

**Sidebar Navigation Check:**

```typescript
// src/components/layout/sidebar.tsx
if (item.module && company && !entitlements.includes(item.module)) {
  return false // Item hidden from navigation
}
```

---

## 6. Permission Matrix (RBAC)

### 6.1 The Five Company Roles

Per-company roles stored in `CompanyUser.role`:

```prisma
// prisma/schema.prisma
model CompanyUser {
  id        String   @id @default(cuid())
  userId    String
  companyId String
  role      Role     @default(MEMBER)
  isDefault Boolean  @default(false)
  // ...
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  ACCOUNTANT
  VIEWER
}
```

| Role         | Description                     | Typical User        |
| ------------ | ------------------------------- | ------------------- |
| `OWNER`      | Full control, including billing | Business founder    |
| `ADMIN`      | Manage resources, invite users  | Trusted manager     |
| `MEMBER`     | Create/edit, no delete          | Employee            |
| `ACCOUNTANT` | Read-only + exports             | External accountant |
| `VIEWER`     | Read-only                       | Investor, advisor   |

### 6.2 Permission Matrix

**Implemented in `/src/lib/rbac.ts`:**

| Permission             | OWNER | ADMIN | MEMBER | ACCOUNTANT | VIEWER   |
| ---------------------- | ----- | ----- | ------ | ---------- | -------- |
| **Invoices**           |       |       |        |            |          |
| `invoice:create`       | Y     | Y     | Y      | -          | -        |
| `invoice:read`         | Y     | Y     | Y      | Y          | Y        |
| `invoice:update`       | Y     | Y     | Y      | -          | -        |
| `invoice:delete`       | Y     | Y     | -      | -          | -        |
| **Expenses**           |       |       |        |            |          |
| `expense:create`       | Y     | Y     | Y      | -          | -        |
| `expense:read`         | Y     | Y     | Y      | Y          | Y        |
| `expense:update`       | Y     | Y     | Y      | -          | -        |
| `expense:delete`       | Y     | Y     | -      | -          | -        |
| **Contacts**           |       |       |        |            |          |
| `contact:create`       | Y     | Y     | Y      | -          | -        |
| `contact:read`         | Y     | Y     | Y      | Y          | Y        |
| `contact:update`       | Y     | Y     | Y      | -          | -        |
| `contact:delete`       | Y     | Y     | -      | -          | -        |
| **Products**           |       |       |        |            |          |
| `product:create`       | Y     | Y     | Y      | -          | -        |
| `product:read`         | Y     | Y     | Y      | Y          | Y        |
| `product:update`       | Y     | Y     | Y      | -          | -        |
| `product:delete`       | Y     | Y     | -      | -          | -        |
| **Settings**           |       |       |        |            |          |
| `settings:read`        | Y     | Y     | -      | Y          | -        |
| `settings:update`      | Y     | Y     | -      | -          | -        |
| `billing:manage`       | Y     | -     | -      | -          | -        |
| **Users**              |       |       |        |            |          |
| `users:invite`         | Y     | Y     | -      | -          | -        |
| `users:remove`         | Y     | Y     | -      | -          | -        |
| `users:update_role`    | Y     | -     | -      | -          | -        |
| **Reports**            |       |       |        |            |          |
| `reports:read`         | Y     | Y     | -      | Y          | Y        |
| `reports:export`       | Y     | Y     | -      | Y          | -        |
| **Bank Accounts**      |       |       |        |            |          |
| `bank_account:create`  | Y     | Y     | -      | -          | -        |
| `bank_account:read`    | Y     | Y     | -      | Y          | Y        |
| `bank_account:update`  | Y     | Y     | -      | -          | -        |
| `bank_account:delete`  | Y     | Y     | -      | -          | -        |
| **Expense Categories** |       |       |        |            |          |
| `expense_category:*`   | Y     | Y     | -      | Y (read)   | Y (read) |
| **Fiscal**             |       |       |        |            |          |
| `fiscal:manage`        | Y     | Y     | -      | -          | -        |

### 6.3 Permission Enforcement

**Server-side enforcement with tenant context:**

```typescript
// src/lib/auth-utils.ts
export async function requireCompanyWithPermission<T>(
  userId: string,
  permission: Permission,
  fn: (company: Company, user: User) => Promise<T>
): Promise<T> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) redirect("/login")

  const company = await requireCompany(userId)

  // Check permission before executing the callback
  await requirePermission(userId, company.id, permission)

  // Wrap in tenant context for automatic isolation
  return runWithTenant({ companyId: company.id, userId }, async () => {
    return fn(company, user)
  })
}
```

**Client-side UI rendering:**

```typescript
// Component usage
import { roleHasPermission } from "@/lib/rbac"

if (roleHasPermission(userRole, 'invoice:delete')) {
  return <DeleteButton />
}
```

---

## 7. Tenant Isolation

### 7.1 Architecture Overview

Multi-tenant isolation is enforced at the database query level using Prisma extensions with AsyncLocalStorage for thread-safe request-scoped context.

**Implementation:** `/src/lib/prisma-extensions.ts`

### 7.2 Tenant Context Management

```typescript
// Thread-safe tenant context using AsyncLocalStorage
export type TenantContext = {
  companyId: string
  userId: string
}

const tenantContextStore = new AsyncLocalStorage<TenantContext>()

// Run database operations with tenant isolation
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return tenantContextStore.run(context, fn)
}

export function getTenantContext(): TenantContext | null {
  return tenantContextStore.getStore() ?? null
}
```

### 7.3 Tenant-Scoped Models

The following models automatically receive `companyId` filtering:

| Model                | Tenant-Scoped | Notes                              |
| -------------------- | ------------- | ---------------------------------- |
| Contact              | Yes           | Customers/suppliers                |
| Product              | Yes           | Product catalog                    |
| EInvoice             | Yes           | Invoices                           |
| EInvoiceLine         | Yes           | Invoice line items                 |
| AuditLog             | Yes           | Activity logs                      |
| BankAccount          | Yes           | Bank accounts                      |
| BankTransaction      | Yes           | Transactions                       |
| BankImport           | Yes           | Import jobs                        |
| ImportJob            | Yes           | Data imports                       |
| Statement            | Yes           | Bank statements                    |
| StatementPage        | Yes           | Statement pages                    |
| Transaction          | Yes           | Financial transactions             |
| Expense              | Yes           | Expenses                           |
| ExpenseCategory      | Yes           | Categories                         |
| RecurringExpense     | Yes           | Recurring costs                    |
| SavedReport          | Yes           | Custom reports                     |
| SupportTicket        | Yes           | Support requests                   |
| SupportTicketMessage | Yes           | Ticket messages                    |
| BusinessPremises     | Yes           | Fiscal premises                    |
| PaymentDevice        | Yes           | POS devices                        |
| InvoiceSequence      | Yes           | Invoice numbering                  |
| User                 | No            | Global (cross-tenant)              |
| Company              | No            | Company itself (not tenant-scoped) |
| CompanyUser          | No            | Filtered by userId, not companyId  |

### 7.4 Query Filtering Implementation

```typescript
// Prisma extension automatically injects companyId
export function withTenantIsolation(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model)) {
            args.where = { ...args.where, companyId: context.companyId }
          }
          return query(args)
        },
        async create({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model)) {
            args.data = { ...args.data, companyId: context.companyId }
          }
          return query(args)
        },
        // Also covers: findFirst, findUnique, update, delete,
        // createMany, updateMany, deleteMany, upsert, count, aggregate, groupBy
      },
    },
  })
}
```

### 7.5 Cross-Tenant Protection

**findUnique verification:**

```typescript
async findUnique({ model, args, query }) {
  const result = await query(args)
  const context = getTenantContext()
  if (context && result && TENANT_MODELS.includes(model)) {
    // Verify companyId after fetch - return null if mismatch
    if (result.companyId !== context.companyId) {
      return null
    }
  }
  return result
}
```

### 7.6 Tenant Isolation Tests

Comprehensive test suite in `/src/lib/__tests__/tenant-isolation.test.ts` verifies:

- Context isolation between concurrent requests
- Automatic `companyId` injection on create operations
- Query filtering on read operations
- Cross-tenant access prevention
- Bulk operation isolation (updateMany, deleteMany)
- Aggregate operation isolation (count, groupBy)

---

## 8. Audit Logging

### 8.1 Audit Log Schema

```prisma
model AuditLog {
  id        String      @id @default(cuid())
  companyId String
  userId    String?
  action    AuditAction
  entity    String
  entityId  String
  changes   Json?
  ipAddress String?
  userAgent String?
  timestamp DateTime    @default(now())

  @@index([companyId])
  @@index([entity, entityId])
  @@index([timestamp])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  VIEW
  EXPORT
  LOGIN
  LOGOUT
}
```

### 8.2 Automatic Audit Logging

**Audited Models:**

- Contact, Product, EInvoice, Company
- BankAccount, Expense, ExpenseCategory, RecurringExpense
- BusinessPremises, PaymentDevice, InvoiceSequence, SupportTicket

**Implementation (async queue to avoid blocking):**

```typescript
// src/lib/prisma-extensions.ts
function queueAuditLog(prismaBase, model, action, result) {
  const companyId = result.companyId
  const entityId = result.id
  const context = getTenantContext()

  if (!companyId || !entityId) return

  const changes = action === "DELETE" ? { before: result } : { after: result }

  auditQueue.push({
    companyId,
    userId: context?.userId ?? null,
    action,
    entity: model,
    entityId,
    changes,
  })

  // Process asynchronously
  setImmediate(() => processAuditQueue(prismaBase))
}
```

### 8.3 Evidence Immutability Protection

For regulatory compliance, Evidence model fields are immutable once created:

```typescript
const EVIDENCE_IMMUTABLE_FIELDS = ["rawContent", "contentHash", "fetchedAt"]

function checkEvidenceImmutability(data: Record<string, unknown>): void {
  for (const field of EVIDENCE_IMMUTABLE_FIELDS) {
    if (field in data) {
      throw new EvidenceImmutabilityError(field)
    }
  }
}
```

### 8.4 Retention Policy

- **11 years** - Croatian legal requirement for tax documents
- **After 11 years:** Documents archived to cold storage, integrity records retained
- **Audit logs:** Retained indefinitely (compressed after 2 years)

---

## 9. Capability Resolution System

### 9.1 Overview

**Implemented:** `/src/lib/capabilities/`

The Capability Resolution System provides machine-readable access control for UI and AI agents. It answers "Can the user do X right now?" with detailed blocker information.

**Architecture:**

```
UI/AI Request → Capability Resolver → Check:
  1. User permissions (RBAC)
  2. Module entitlements
  3. Business logic blockers
  4. Required inputs
→ Return: READY | BLOCKED | MISSING_INPUTS | UNAUTHORIZED
```

### 9.2 Capability States

```typescript
// src/lib/capabilities/types.ts
export type CapabilityState =
  | "READY" // All conditions met, action can be taken
  | "BLOCKED" // External blocker prevents action (e.g., locked period)
  | "MISSING_INPUTS" // Required inputs are not provided
  | "UNAUTHORIZED" // User lacks permission for this action
```

### 9.3 Capability Registry

**Centralized registry:** `/src/lib/capabilities/registry.ts`

```typescript
export const CAPABILITY_REGISTRY: CapabilityMetadata[] = [
  {
    id: "INV-001",
    name: "Create Invoice",
    description: "Create a new sales invoice",
    domain: "invoicing",
    requiredInputs: ["buyerId", "issueDate", "lines"],
    optionalInputs: ["dueDate", "notes", "paymentTerms"],
    requiredPermissions: ["invoicing:write"],
    affectedEntities: ["EInvoice", "EInvoiceLine"],
  },
  {
    id: "INV-003",
    name: "Fiscalize Invoice",
    description: "Submit invoice to tax authority for fiscalization",
    domain: "invoicing",
    requiredInputs: ["invoiceId"],
    requiredPermissions: ["fiscalization:write"],
    affectedEntities: ["EInvoice", "FiscalRequest"],
  },
  {
    id: "BNK-002",
    name: "Match Transaction",
    description: "Match a bank transaction to an invoice or expense",
    domain: "banking",
    requiredInputs: ["transactionId"],
    optionalInputs: ["invoiceId", "expenseId"],
    requiredPermissions: ["banking:write", "reconciliation:write"],
    affectedEntities: ["BankTransaction", "MatchRecord"],
  },
  // ... 50+ capabilities across all domains
]
```

**Domains covered:**

- `invoicing` - Invoice creation, sending, fiscalization
- `expenses` - Expense recording, approval, corrections
- `banking` - Bank imports, matching, reconciliation
- `payroll` - Payouts, JOPPD submissions
- `vat` - VAT reports, submissions
- `pausalni` - Pausalni forms (PO-SD, PO-SP)
- `contacts` - Contact management
- `products` - Product catalog

### 9.4 Capability Resolution Flow

```typescript
// Client-side usage with useCapabilities hook
import { useCapabilities } from "@/hooks/use-capabilities"

function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const capabilities = useCapabilities()

  // Get capability status
  const canFiscalize = capabilities.can("invoicing:fiscalize")

  return (
    <>
      <Button onClick={() => handleSend(invoice)}>Send Invoice</Button>

      {canFiscalize ? (
        <Button onClick={() => handleFiscalize(invoice)}>Fiscalize</Button>
      ) : (
        <Tooltip content="Fiscalization not enabled for your account">
          <Button disabled>Fiscalize</Button>
        </Tooltip>
      )}
    </>
  )
}
```

**Server-side resolution:**

```typescript
// src/lib/capabilities/resolver.ts
import { resolveCapability } from "@/lib/capabilities/resolver"

const result = await resolveCapability({
  capability: "INV-003", // Fiscalize Invoice
  userId: "user_abc",
  companyId: "comp_xyz",
  inputs: {
    invoiceId: "inv_123",
  },
})

// Result structure
{
  capability: "INV-003",
  state: "BLOCKED",
  blockers: [
    {
      type: "MISSING_PREREQUISITE",
      message: "Fiscal certificate not configured",
      resolution: "Configure certificate in Settings > Fiscalization",
      details: { certificatePath: null }
    }
  ],
  inputs: [
    {
      key: "invoiceId",
      required: true,
      provided: true,
      value: "inv_123"
    }
  ],
  actions: [
    {
      id: "fiscalize",
      label: "Fiscalize Now",
      enabled: false,
      disabledReason: "Missing fiscal certificate"
    }
  ]
}
```

### 9.5 Blocker Types

```typescript
export interface CapabilityBlocker {
  type:
    | "PERIOD_LOCKED" // Accounting period is locked
    | "ENTITY_IMMUTABLE" // Entity cannot be modified (e.g., fiscalized invoice)
    | "WORKFLOW_STATE" // Entity in wrong state (e.g., invoice already sent)
    | "MISSING_PREREQUISITE" // Required setup incomplete (e.g., no certificate)
    | "EXTERNAL_DEPENDENCY" // External service unavailable
    | "RATE_LIMITED" // Too many requests

  message: string // Human-readable error
  resolution?: string // How to fix the blocker
  details?: Record<string, unknown> // Machine-readable details
}
```

**Example blockers:**

```typescript
// Period locked
{
  type: "PERIOD_LOCKED",
  message: "January 2025 period is locked",
  resolution: "Contact your accountant to unlock the period",
  details: { periodMonth: 1, periodYear: 2025, lockedBy: "accountant@example.com" }
}

// Entity immutable
{
  type: "ENTITY_IMMUTABLE",
  message: "Invoice has been fiscalized and cannot be modified",
  resolution: "Create a credit note to correct this invoice",
  details: { fiscalizedAt: "2025-01-14T10:00:00Z", jir: "abc-123-def" }
}

// Missing prerequisite
{
  type: "MISSING_PREREQUISITE",
  message: "Bank account not connected",
  resolution: "Connect a bank account in Settings > Banking",
  details: { requiredSetup: "bank_account", setupUrl: "/settings/banking" }
}
```

### 9.6 Integration with RBAC and Entitlements

Capability resolution checks multiple layers:

1. **RBAC Permission:** Does user's role have `invoicing:write`?
2. **Module Entitlement:** Is `invoicing` module enabled?
3. **Module Permission:** Does company have `create` permission for `invoicing`?
4. **Business Logic:** Is invoice in correct state? Is period locked?

```typescript
// Full resolution chain
export async function resolveCapability(request: CapabilityRequest): Promise<CapabilityResponse> {
  const metadata = getCapabilityMetadata(request.capability)

  // 1. Check RBAC permissions
  const userRole = await getUserRole(request.userId, request.companyId)
  const hasPermission = metadata.requiredPermissions.every((perm) =>
    roleHasPermission(userRole, perm)
  )

  if (!hasPermission) {
    return {
      state: "UNAUTHORIZED",
      blockers: [
        {
          type: "MISSING_PREREQUISITE",
          message: `Your role (${userRole}) does not have required permissions`,
        },
      ],
    }
  }

  // 2. Check module entitlements
  const entitlements = await getCompanyEntitlements(request.companyId)
  const hasEntitlement = isModuleEnabled(entitlements, metadata.domain)

  if (!hasEntitlement) {
    return {
      state: "BLOCKED",
      blockers: [
        {
          type: "MISSING_PREREQUISITE",
          message: `Module ${metadata.domain} is not enabled`,
          resolution: "Upgrade your subscription to access this feature",
        },
      ],
    }
  }

  // 3. Check business logic (domain-specific)
  const businessBlockers = await checkBusinessLogic(request)

  if (businessBlockers.length > 0) {
    return {
      state: "BLOCKED",
      blockers: businessBlockers,
    }
  }

  // 4. Validate inputs
  const inputValidation = validateInputs(request.inputs, metadata)

  if (inputValidation.missingRequired.length > 0) {
    return {
      state: "MISSING_INPUTS",
      inputs: inputValidation.inputs,
    }
  }

  // All checks passed
  return {
    state: "READY",
    actions: getAvailableActions(metadata),
  }
}
```

### 9.7 Client-Side Hooks

```typescript
// src/hooks/use-capabilities.ts
import { useCapabilities } from "@/hooks/use-capabilities"

function MyComponent() {
  const capabilities = useCapabilities()

  // Simple check
  const canCreateInvoice = capabilities.can("invoicing:create")

  // Get full module status
  const invoicingModule = capabilities.modules["invoicing"]
  // { enabled: true, permissions: ["view", "create", "edit"], expiresAt: null }

  // Check specific permission
  const canExportReports = capabilities.can("reports-basic", "export")

  return (
    <div>
      {canCreateInvoice && <Button>New Invoice</Button>}
      {invoicingModule.enabled && <InvoiceList />}
    </div>
  )
}
```

---

## 10. Visibility & Feature Gating

### 10.1 Three-Layer Visibility System

**Implementation:** `/src/lib/visibility/`

**Layer 1: Business Type (Legal Form)**

```typescript
// src/lib/visibility/rules.ts
export const BUSINESS_TYPE_HIDDEN: Record<LegalForm, ElementId[]> = {
  OBRT_PAUSAL: [
    "card:vat-overview",
    "nav:vat",
    "page:vat",
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  OBRT_REAL: [
    "card:vat-overview",
    "nav:vat",
    "page:vat",
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  OBRT_VAT: [
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  JDOO: [
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    "card:doprinosi",
    "nav:doprinosi",
    "page:doprinosi",
    "card:posd-reminder",
  ],
  DOO: [
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    "card:doprinosi",
    "nav:doprinosi",
    "page:doprinosi",
    "card:posd-reminder",
  ],
}
```

**Layer 2: Progression Stage**

```typescript
export type ProgressionStage =
  | "onboarding" // Wizard incomplete
  | "setup" // Profile done, 0 invoices
  | "needs-customer"
  | "needs-product"
  | "needs-invoice"
  | "needs-statements"
  | "active" // 1+ invoice OR statement
  | "strategic" // 10+ invoices OR VAT registered
  | "complete"

export function calculateActualStage(counts): ProgressionStage {
  if (!counts.hasCompletedOnboarding) return "onboarding"
  if (counts.invoices >= 10 || counts.isVatPayer) return "strategic"
  if (counts.invoices > 0 || counts.statements > 0) return "active"
  return "setup"
}
```

**Layer 3: Competence Level**

```typescript
// src/lib/types/competence.ts
export const COMPETENCE_LEVELS = {
  BEGINNER: "beginner",
  AVERAGE: "average",
  PRO: "pro",
} as const

export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS]

// src/lib/visibility/rules.ts
export const COMPETENCE_HIDDEN: Record<CompetenceLevel, ElementId[]> = {
  beginner: ["card:advanced-insights", "nav:api-settings"],
  average: ["nav:api-settings"],
  pro: [], // Sees everything
}

export const COMPETENCE_LABELS: Record<CompetenceLevel, string> = {
  beginner: "Beginner",
  average: "Average",
  pro: "Expert",
}

// Competence affects starting stage
export const COMPETENCE_STARTING_STAGE: Record<CompetenceLevel, ProgressionStage> = {
  beginner: "onboarding", // Must complete full onboarding
  average: "setup", // Can skip some hand-holding
  pro: "active", // Jumps straight to active features
}
```

**How Competence Works:**

1. **Determined at onboarding:** User selects competence level during setup
2. **Stored in user preferences:** `UserPreferences.globalLevel`
3. **Affects UI complexity:**
   - Beginners see simplified UI, step-by-step guidance
   - Average users see standard features
   - Experts see advanced features, API settings, full controls
4. **Can be changed:** Users can adjust their competence level in settings

**Integration with Visibility Context:**

```typescript
// src/lib/visibility/context.tsx
export function useVisibility(): VisibilityContextValue {
  const context = useContext(VisibilityContext)

  // isVisible checks both business type and competence
  const isVisible = (id: ElementId): boolean => {
    if (isHiddenByBusinessType(id, legalForm)) return false
    if (isHiddenByCompetence(id, competence)) return false // Competence check
    return true
  }

  return { isVisible, isLocked, getUnlockHint, state, ... }
}
```

### 10.2 Element Visibility Registry

**Complete list from `/src/lib/visibility/elements.ts`:**

#### Dashboard Cards

| Element ID                  | Purpose                |
| --------------------------- | ---------------------- |
| `card:pausalni-status`      | Pausalni limit tracker |
| `card:vat-overview`         | VAT summary            |
| `card:doprinosi`            | Contributions          |
| `card:corporate-tax`        | Corporate tax          |
| `card:invoice-funnel`       | Invoice pipeline       |
| `card:revenue-trend`        | Revenue chart          |
| `card:cash-flow`            | Cash flow              |
| `card:insights`             | Basic insights         |
| `card:advanced-insights`    | Deep analytics         |
| `card:posd-reminder`        | PO-SD annual form      |
| `card:deadline-countdown`   | Next deadline          |
| `card:recent-activity`      | Recent actions         |
| `card:fiscalization-status` | Fiscal status          |
| `card:compliance-status`    | Compliance status      |
| `card:today-actions`        | Action items           |
| `card:hero-banner`          | Welcome message        |
| `card:checklist-widget`     | Setup checklist        |
| `card:insights-widget`      | AI insights widget     |

#### Navigation Items

| Element ID          | Path           |
| ------------------- | -------------- |
| `nav:dashboard`     | /dashboard     |
| `nav:invoices`      | /invoices      |
| `nav:e-invoices`    | /e-invoices    |
| `nav:contacts`      | /contacts      |
| `nav:products`      | /products      |
| `nav:expenses`      | /expenses      |
| `nav:documents`     | /documents     |
| `nav:import`        | /import        |
| `nav:vat`           | /vat           |
| `nav:pausalni`      | /pausalni      |
| `nav:reports`       | /reports       |
| `nav:doprinosi`     | /doprinosi     |
| `nav:corporate-tax` | /corporate-tax |
| `nav:bank`          | /banking       |
| `nav:pos`           | /pos           |
| `nav:compliance`    | /compliance    |
| `nav:settings`      | /settings      |
| `nav:api-settings`  | /settings/api  |
| `nav:checklist`     | /checklist     |

#### Actions

| Element ID                 | Purpose           |
| -------------------------- | ----------------- |
| `action:create-invoice`    | New invoice       |
| `action:create-contact`    | New contact       |
| `action:create-product`    | New product       |
| `action:create-expense`    | New expense       |
| `action:import-statements` | Import statements |
| `action:export-data`       | Export data       |

#### Pages (Route Protection)

| Element ID           | Path           |
| -------------------- | -------------- |
| `page:vat`           | /vat           |
| `page:reports`       | /reports       |
| `page:pos`           | /pos           |
| `page:doprinosi`     | /doprinosi     |
| `page:corporate-tax` | /corporate-tax |
| `page:bank`          | /bank          |

### 10.3 Visibility Component Usage

```tsx
// Using visibility system (checks legal form, stage, competence)
<Visible id="card:pausalni-status">
  <PausalniStatusCard />
</Visible>

// Combining visibility + entitlements
<Visible id="card:ai-insights">
  {entitlements.includes("ai-assistant") && <AIInsightsCard />}
</Visible>
```

**What Visibility Checks:**

1. Legal form (`legalForm`) - e.g., hide VAT widgets for pausalni
2. Progression stage (`stage`) - e.g., hide charts until first invoice
3. Competence level (`competence`) - e.g., hide advanced for beginners
4. **Does NOT check entitlements** (separate system)

**Why Separate Systems?**

- Visibility = "Should this user type see this?"
- Entitlements = "Has this company paid for this?"
- A pausalni user shouldn't see VAT widgets even if they somehow have the `vat` entitlement.

**Server-Side Route Protection:**

```typescript
// src/lib/visibility/route-protection.tsx
export async function protectRoute(elementId: ElementId): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth")

  const company = await getCurrentCompany(session.user.id)
  if (!company) redirect("/onboarding")

  // Check route access via visibility system
  const accessResult = await checkRouteAccess(session.user.id, company.id, elementId)

  if (!accessResult.allowed) {
    redirect(accessResult.redirectTo || "/")
  }
}

// Usage in page component
export default async function VatPage() {
  await protectRoute("page:vat") // Blocks non-VAT users
  return <VatReportContent />
}
```

---

## 11. Security Implementation Status

### 11.1 Implemented Features

| Feature                      | Status | Location                                   |
| ---------------------------- | ------ | ------------------------------------------ |
| JWT Session Management       | Done   | `/src/lib/auth.ts`                         |
| Cross-Subdomain Cookies      | Done   | NextAuth cookie config                     |
| Password Hashing (bcrypt)    | Done   | `/src/lib/auth.ts`                         |
| WebAuthn/Passkeys            | Done   | `/src/lib/webauthn.ts`                     |
| OTP Passwordless Login       | Done   | `/src/lib/auth/otp.ts`                     |
| Rate Limiting (Login)        | Done   | `/src/lib/security/rate-limit.ts`          |
| Rate Limiting (API)          | Done   | `/src/lib/security/rate-limit.ts`          |
| Rate Limiting (OTP)          | Done   | `/src/lib/security/rate-limit.ts`          |
| System Role Enforcement      | Done   | `/src/lib/auth/system-role.ts`             |
| Path-Based Routing           | Done   | `/src/middleware.ts`                       |
| Legacy Subdomain Redirects   | Done   | `/src/middleware.ts` (308 permanent)       |
| RBAC Permission Matrix       | Done   | `/src/lib/rbac.ts`                         |
| Tenant Isolation (Prisma)    | Done   | `/src/lib/prisma-extensions.ts`            |
| AsyncLocalStorage Context    | Done   | Thread-safe tenant context                 |
| Audit Logging                | Done   | Prisma extension (async queue)             |
| Evidence Immutability        | Done   | Prisma extension                           |
| Module Entitlements (V1)     | Done   | `/src/lib/modules/definitions.ts`          |
| Module Entitlements (V2)     | Done   | `/src/lib/modules/permissions.ts`          |
| Entitlement Audit Trail      | Done   | `/src/lib/modules/audit.ts`                |
| Entitlement Service          | Done   | `/src/lib/modules/entitlement-service.ts`  |
| Capability Resolution System | Done   | `/src/lib/capabilities/`                   |
| Capability Registry          | Done   | `/src/lib/capabilities/registry.ts`        |
| Visibility Rules             | Done   | `/src/lib/visibility/`                     |
| Competence-Based Access      | Done   | `/src/lib/types/competence.ts`             |
| Route Protection             | Done   | `/src/lib/visibility/route-protection.tsx` |

### 11.2 Documentation Gaps (To Be Implemented)

| Feature                | Status  | Notes                                                   |
| ---------------------- | ------- | ------------------------------------------------------- |
| Document Integrity     | Planned | SHA-256 hashing mentioned but not in codebase           |
| Merkle Tree Verify     | Planned | Batch verification not yet implemented                  |
| IP/Device Logging      | Partial | Schema supports ipAddress/userAgent, not fully captured |
| FISCALIZE Audit Action | Planned | Enum exists but not logged in current impl              |

---

## Appendix: Code References

### Authentication & Authorization

| File                              | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `/src/lib/auth.ts`                | NextAuth v5 configuration                |
| `/src/lib/auth/system-role.ts`    | System role utilities, path-based access |
| `/src/lib/auth/otp.ts`            | OTP generation and verification          |
| `/src/lib/auth-utils.ts`          | Auth helper functions                    |
| `/src/lib/webauthn.ts`            | WebAuthn/Passkey implementation          |
| `/src/lib/security/rate-limit.ts` | Rate limiting utilities                  |
| `/src/middleware.ts`              | Request routing and authentication       |

### RBAC & Permissions

| File                              | Purpose                        |
| --------------------------------- | ------------------------------ |
| `/src/lib/rbac.ts`                | Permission matrix and checking |
| `/src/lib/__tests__/rbac.test.ts` | RBAC permission tests          |

### Module System

| File                                      | Purpose                        |
| ----------------------------------------- | ------------------------------ |
| `/src/lib/modules/definitions.ts`         | 17 module definitions          |
| `/src/lib/modules/access.ts`              | Route-based access control     |
| `/src/lib/modules/permissions.ts`         | V2 granular permissions        |
| `/src/lib/modules/audit.ts`               | Entitlement audit logging      |
| `/src/lib/modules/entitlement-service.ts` | Entitlement management service |

### Capability System

| File                                | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `/src/lib/capabilities/index.ts`    | Capability exports                   |
| `/src/lib/capabilities/types.ts`    | Type definitions                     |
| `/src/lib/capabilities/registry.ts` | 50+ capability definitions           |
| `/src/lib/capabilities/resolver.ts` | Server-side resolution (not bundled) |
| `/src/hooks/use-capabilities.ts`    | Client-side capability hook          |

### Visibility System

| File                                       | Purpose                       |
| ------------------------------------------ | ----------------------------- |
| `/src/lib/visibility/rules.ts`             | 3-layer visibility rules      |
| `/src/lib/visibility/elements.ts`          | Element registry              |
| `/src/lib/visibility/context.tsx`          | React context provider        |
| `/src/lib/visibility/route-protection.tsx` | Server-side route guards      |
| `/src/lib/visibility/server.ts`            | Server-side visibility checks |
| `/src/lib/types/competence.ts`             | Competence level definitions  |

### Tenant Isolation

| File                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `/src/lib/prisma-extensions.ts`               | Tenant isolation and audit logging |
| `/src/lib/__tests__/tenant-isolation.test.ts` | Tenant isolation tests             |
