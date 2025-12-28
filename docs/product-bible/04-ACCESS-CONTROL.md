# Access Control

[<- Back to Index](./00-INDEX.md)

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

**Cross-Subdomain Sessions:**

- Single session cookie shared across `app.fiskai.hr`, `staff.fiskai.hr`, `admin.fiskai.hr`
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

| System Role | Can Access                              | Description           |
| ----------- | --------------------------------------- | --------------------- |
| `USER`      | `app.fiskai.hr`                         | Regular business user |
| `STAFF`     | `app.fiskai.hr`, `staff.fiskai.hr`      | Internal accountant   |
| `ADMIN`     | All portals including `admin.fiskai.hr` | Platform admin        |

```typescript
// src/lib/auth/system-role.ts
export function canAccessSubdomain(systemRole: SystemRole, subdomain: string): boolean {
  switch (subdomain) {
    case "admin":
      return systemRole === "ADMIN"
    case "staff":
      return systemRole === "STAFF" || systemRole === "ADMIN"
    case "app":
      return true // All roles can access app
    case "marketing":
      return true // Public
    default:
      return false
  }
}
```

**Subdomain Routing:**

```typescript
// src/lib/middleware/subdomain.ts
// Automatically routes requests to appropriate Next.js route groups:
// - admin.* -> (admin)
// - staff.* -> (staff)
// - app.* -> (app)
// - root domain -> (marketing)
```

---

## 5. Module System & Entitlements

### 5.1 The 16 Module Keys

Stored in `Company.entitlements[]` as kebab-case strings:

| Module Key         | Description              | Default |
| ------------------ | ------------------------ | ------- |
| `invoicing`        | Manual PDF generation    | FREE    |
| `e-invoicing`      | UBL/XML B2B/B2G          | FREE    |
| `contacts`         | CRM directory            | FREE    |
| `products`         | Product catalog          | FREE    |
| `expenses`         | Expense tracking         | FREE    |
| `banking`          | Bank import & sync       | PAID    |
| `documents`        | Document vault (archive) | FREE    |
| `reports-basic`    | KPR, aging, P&L          | FREE    |
| `fiscalization`    | CIS integration          | PAID    |
| `reconciliation`   | Auto-matching            | PAID    |
| `reports-advanced` | VAT reports, exports     | PAID    |
| `pausalni`         | Pausalni features        | AUTO\*  |
| `vat`              | VAT management           | AUTO\*  |
| `corporate-tax`    | D.O.O./JDOO tax          | AUTO\*  |
| `pos`              | Point of sale            | PAID    |
| `ai-assistant`     | AI chat & extraction     | PAID    |

\*AUTO modules are recommended based on `legalForm` but must be explicitly added to entitlements. The visibility system hides irrelevant modules (e.g., VAT widgets for non-VAT payers) regardless of entitlements.

**Current behavior:** Legal-form-specific features are controlled by the visibility system (`src/lib/visibility/rules.ts`), not by auto-enabling entitlements.

**Planned:** Future versions may auto-add relevant entitlements during onboarding based on legalForm selection.

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
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  fiscalization: {
    key: "fiscalization",
    name: "Fiscalization",
    description: "Fiscal receipts, JIR/ZKI, CIS integration",
    routes: ["/settings/fiscalisation", "/settings/premises"],
    navItems: ["fiscalization"],
    defaultEnabled: false,
  },
  // ... 15 more modules
}
```

### 5.3 Module Access Control

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

### 6.1 The Five Tenant Roles

Per-company roles stored in `CompanyUser.role`:

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

## 9. Visibility & Feature Gating

### 9.1 Three-Layer Visibility System

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
export type CompetenceLevel = "beginner" | "average" | "pro"

export const COMPETENCE_HIDDEN: Record<CompetenceLevel, ElementId[]> = {
  beginner: ["card:advanced-insights", "nav:api-settings"],
  average: ["nav:api-settings"],
  pro: [], // Sees everything
}
```

### 9.2 Element Visibility Registry

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

### 9.3 Visibility Component Usage

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

---

## 10. Security Implementation Status

### 10.1 Implemented Features

| Feature                   | Status | Location                           |
| ------------------------- | ------ | ---------------------------------- |
| JWT Session Management    | Done   | `/src/lib/auth.ts`                 |
| Cross-Subdomain Cookies   | Done   | NextAuth cookie config             |
| Password Hashing (bcrypt) | Done   | `/src/lib/auth.ts`                 |
| WebAuthn/Passkeys         | Done   | `/src/lib/webauthn.ts`             |
| OTP Passwordless Login    | Done   | `/src/lib/auth/otp.ts`             |
| Rate Limiting (Login)     | Done   | `/src/lib/security/rate-limit.ts`  |
| Rate Limiting (API)       | Done   | `/src/lib/security/rate-limit.ts`  |
| Rate Limiting (OTP)       | Done   | `/src/lib/security/rate-limit.ts`  |
| System Role Enforcement   | Done   | `/src/lib/auth/system-role.ts`     |
| Subdomain Routing         | Done   | `/src/lib/middleware/subdomain.ts` |
| RBAC Permission Matrix    | Done   | `/src/lib/rbac.ts`                 |
| Tenant Isolation (Prisma) | Done   | `/src/lib/prisma-extensions.ts`    |
| AsyncLocalStorage Context | Done   | Thread-safe tenant context         |
| Audit Logging             | Done   | Prisma extension (async queue)     |
| Evidence Immutability     | Done   | Prisma extension                   |
| Module Entitlements       | Done   | `/src/lib/modules/`                |
| Visibility Rules          | Done   | `/src/lib/visibility/`             |

### 10.2 Documentation Gaps (To Be Implemented)

| Feature                | Status  | Notes                                                   |
| ---------------------- | ------- | ------------------------------------------------------- |
| Document Integrity     | Planned | SHA-256 hashing mentioned but not in codebase           |
| Merkle Tree Verify     | Planned | Batch verification not yet implemented                  |
| IP/Device Logging      | Partial | Schema supports ipAddress/userAgent, not fully captured |
| FISCALIZE Audit Action | Planned | Enum exists but not logged in current impl              |

---

## Appendix: Code References

| File                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `/src/lib/auth.ts`                            | NextAuth v5 configuration          |
| `/src/lib/auth/system-role.ts`                | System role utilities              |
| `/src/lib/auth/otp.ts`                        | OTP generation and verification    |
| `/src/lib/webauthn.ts`                        | WebAuthn/Passkey implementation    |
| `/src/lib/security/rate-limit.ts`             | Rate limiting utilities            |
| `/src/lib/middleware/subdomain.ts`            | Subdomain routing                  |
| `/src/lib/rbac.ts`                            | Permission matrix and checking     |
| `/src/lib/auth-utils.ts`                      | Auth helper functions              |
| `/src/lib/prisma-extensions.ts`               | Tenant isolation and audit logging |
| `/src/lib/modules/definitions.ts`             | Module definitions                 |
| `/src/lib/modules/access.ts`                  | Module access control              |
| `/src/lib/visibility/rules.ts`                | Visibility rules                   |
| `/src/lib/visibility/elements.ts`             | Element registry                   |
| `/src/lib/__tests__/tenant-isolation.test.ts` | Tenant isolation tests             |
| `/src/lib/__tests__/rbac.test.ts`             | RBAC permission tests              |
