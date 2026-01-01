# Phase 5: Compliance & Identity - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 4)
**Depends On:** Phase 4 Completion
**Duration Estimate:** 2-3 focused sessions
**Goal:** Complete bounded context coverage for compliance and identity

---

## 0. Phase 5 Objectives

1. Extract compliance rules into domain layer
2. Model deadlines and penalties explicitly
3. Clean up identity/tenant logic
4. Add authorization rules in application layer
5. Ensure no cross-context logic leakage

---

## 1. Current Compliance Code Locations

| Current Location        | Content                 | Target                         |
| ----------------------- | ----------------------- | ------------------------------ |
| `src/lib/compliance/`   | EN16931 validator, data | `src/domain/compliance/`       |
| `src/lib/deadlines/`    | Deadline definitions    | `src/domain/compliance/`       |
| `src/lib/auth/`         | Auth config, utils      | `src/infrastructure/identity/` |
| `src/lib/auth-utils.ts` | Session helpers         | `src/application/identity/`    |

---

## 2. Create Compliance Domain

### 2.1 Create `src/domain/compliance/Deadline.ts`

```typescript
// src/domain/compliance/Deadline.ts

export enum DeadlineType {
  VAT_RETURN = "VAT_RETURN",
  CORPORATE_TAX = "CORPORATE_TAX",
  PAYROLL_CONTRIBUTIONS = "PAYROLL_CONTRIBUTIONS",
  ANNUAL_ACCOUNTS = "ANNUAL_ACCOUNTS",
  JOPPD_SUBMISSION = "JOPPD_SUBMISSION",
}

export enum DeadlineFrequency {
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  ANNUAL = "ANNUAL",
}

export interface DeadlineDefinition {
  type: DeadlineType
  frequency: DeadlineFrequency
  dayOfMonth: number // e.g., 20 for "by 20th"
  description: string
  penaltyInfo?: string
}

export class Deadline {
  private constructor(
    public readonly type: DeadlineType,
    public readonly dueDate: Date,
    public readonly description: string,
    public readonly penaltyInfo?: string
  ) {}

  static forPeriod(definition: DeadlineDefinition, periodEnd: Date): Deadline {
    const dueDate = this.calculateDueDate(definition, periodEnd)

    return new Deadline(definition.type, dueDate, definition.description, definition.penaltyInfo)
  }

  isOverdue(): boolean {
    return new Date() > this.dueDate
  }

  daysUntilDue(): number {
    const now = new Date()
    const ms = this.dueDate.getTime() - now.getTime()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }

  urgency(): "critical" | "warning" | "normal" {
    const days = this.daysUntilDue()
    if (days < 0) return "critical"
    if (days <= 7) return "warning"
    return "normal"
  }

  private static calculateDueDate(def: DeadlineDefinition, periodEnd: Date): Date {
    const dueDate = new Date(periodEnd)

    switch (def.frequency) {
      case DeadlineFrequency.MONTHLY:
        dueDate.setMonth(dueDate.getMonth() + 1)
        dueDate.setDate(def.dayOfMonth)
        break
      case DeadlineFrequency.QUARTERLY:
        dueDate.setMonth(dueDate.getMonth() + 1)
        dueDate.setDate(def.dayOfMonth)
        break
      case DeadlineFrequency.ANNUAL:
        dueDate.setFullYear(dueDate.getFullYear() + 1)
        dueDate.setMonth(0) // January
        dueDate.setDate(def.dayOfMonth)
        break
    }

    return dueDate
  }
}
```

### 2.2 Create `src/domain/compliance/ComplianceStatus.ts`

```typescript
// src/domain/compliance/ComplianceStatus.ts

export enum ComplianceState {
  COMPLIANT = "COMPLIANT",
  WARNING = "WARNING",
  NON_COMPLIANT = "NON_COMPLIANT",
}

export interface ComplianceCheck {
  name: string
  state: ComplianceState
  message: string
  deadline?: Date
}

export class ComplianceStatus {
  private checks: ComplianceCheck[] = []

  addCheck(check: ComplianceCheck): void {
    this.checks.push(check)
  }

  overallState(): ComplianceState {
    if (this.checks.some((c) => c.state === ComplianceState.NON_COMPLIANT)) {
      return ComplianceState.NON_COMPLIANT
    }
    if (this.checks.some((c) => c.state === ComplianceState.WARNING)) {
      return ComplianceState.WARNING
    }
    return ComplianceState.COMPLIANT
  }

  getChecks(): readonly ComplianceCheck[] {
    return [...this.checks]
  }

  criticalIssues(): ComplianceCheck[] {
    return this.checks.filter((c) => c.state === ComplianceState.NON_COMPLIANT)
  }

  warnings(): ComplianceCheck[] {
    return this.checks.filter((c) => c.state === ComplianceState.WARNING)
  }
}
```

### 2.3 Create Croatian Deadline Definitions

```typescript
// src/domain/compliance/CroatianDeadlines.ts
import { DeadlineDefinition, DeadlineType, DeadlineFrequency } from "./Deadline"

export const CROATIAN_DEADLINES: DeadlineDefinition[] = [
  {
    type: DeadlineType.VAT_RETURN,
    frequency: DeadlineFrequency.MONTHLY,
    dayOfMonth: 20,
    description: "PDV prijava za prethodni mjesec",
    penaltyInfo: "Kazna do 50.000 HRK za zakašnjenje",
  },
  {
    type: DeadlineType.PAYROLL_CONTRIBUTIONS,
    frequency: DeadlineFrequency.MONTHLY,
    dayOfMonth: 15,
    description: "Doprinosi za prethodni mjesec",
    penaltyInfo: "Zatezne kamate od dana dospijeća",
  },
  {
    type: DeadlineType.JOPPD_SUBMISSION,
    frequency: DeadlineFrequency.MONTHLY,
    dayOfMonth: 15,
    description: "JOPPD obrazac za prethodni mjesec",
  },
  {
    type: DeadlineType.CORPORATE_TAX,
    frequency: DeadlineFrequency.ANNUAL,
    dayOfMonth: 30, // April 30
    description: "Godišnja prijava poreza na dobit",
    penaltyInfo: "Kazna i zatezne kamate",
  },
]
```

---

## 3. Create Identity Domain

### 3.1 Create `src/domain/identity/Tenant.ts`

```typescript
// src/domain/identity/Tenant.ts

export interface TenantProps {
  id: string
  name: string
  oib: string
  vatNumber?: string
  entitlements: string[] // Module access
  subscriptionTier: SubscriptionTier
  isActive: boolean
  createdAt: Date
}

export enum SubscriptionTier {
  FREE = "FREE",
  STARTER = "STARTER",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export class Tenant {
  private props: TenantProps

  private constructor(props: TenantProps) {
    this.props = props
  }

  static create(params: Omit<TenantProps, "id" | "createdAt">): Tenant {
    return new Tenant({
      ...params,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    })
  }

  static reconstitute(props: TenantProps): Tenant {
    return new Tenant(props)
  }

  get id(): string {
    return this.props.id
  }
  get name(): string {
    return this.props.name
  }
  get oib(): string {
    return this.props.oib
  }

  hasEntitlement(moduleId: string): boolean {
    return this.props.entitlements.includes(moduleId)
  }

  addEntitlement(moduleId: string): void {
    if (!this.props.entitlements.includes(moduleId)) {
      this.props.entitlements.push(moduleId)
    }
  }

  removeEntitlement(moduleId: string): void {
    this.props.entitlements = this.props.entitlements.filter((e) => e !== moduleId)
  }

  deactivate(): void {
    this.props.isActive = false
  }

  activate(): void {
    this.props.isActive = true
  }
}
```

### 3.2 Create `src/domain/identity/Permission.ts`

```typescript
// src/domain/identity/Permission.ts

export enum SystemRole {
  USER = "USER",
  STAFF = "STAFF",
  ADMIN = "ADMIN",
}

export enum CompanyRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  ACCOUNTANT = "ACCOUNTANT",
  VIEWER = "VIEWER",
}

export interface Permission {
  action: string
  resource: string
}

const ROLE_PERMISSIONS: Record<CompanyRole, Permission[]> = {
  [CompanyRole.OWNER]: [{ action: "*", resource: "*" }],
  [CompanyRole.ADMIN]: [
    { action: "read", resource: "*" },
    { action: "write", resource: "*" },
    { action: "delete", resource: "invoices" },
    { action: "delete", resource: "expenses" },
  ],
  [CompanyRole.ACCOUNTANT]: [
    { action: "read", resource: "*" },
    { action: "write", resource: "invoices" },
    { action: "write", resource: "expenses" },
    { action: "write", resource: "reports" },
  ],
  [CompanyRole.VIEWER]: [{ action: "read", resource: "*" }],
}

export function hasPermission(role: CompanyRole, action: string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[role]

  return permissions.some(
    (p) =>
      (p.action === "*" || p.action === action) && (p.resource === "*" || p.resource === resource)
  )
}
```

---

## 4. Application Authorization

### 4.1 Create `src/application/identity/AuthorizationService.ts`

```typescript
// src/application/identity/AuthorizationService.ts
import { hasPermission, CompanyRole, SystemRole } from "@/domain/identity/Permission"
import { Tenant } from "@/domain/identity/Tenant"

export interface AuthContext {
  userId: string
  systemRole: SystemRole
  companyId?: string
  companyRole?: CompanyRole
}

export class AuthorizationService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async canAccess(ctx: AuthContext, action: string, resource: string): Promise<boolean> {
    // System admins can do anything
    if (ctx.systemRole === SystemRole.ADMIN) {
      return true
    }

    // Must have company context for company resources
    if (!ctx.companyId || !ctx.companyRole) {
      return false
    }

    // Check role permissions
    if (!hasPermission(ctx.companyRole, action, resource)) {
      return false
    }

    // Check tenant is active
    const tenant = await this.tenantRepository.findById(ctx.companyId)
    if (!tenant || !tenant.isActive) {
      return false
    }

    return true
  }

  async canAccessModule(ctx: AuthContext, moduleId: string): Promise<boolean> {
    if (!ctx.companyId) {
      return false
    }

    const tenant = await this.tenantRepository.findById(ctx.companyId)
    if (!tenant) {
      return false
    }

    return tenant.hasEntitlement(moduleId)
  }
}
```

---

## 5. Exit Criteria

Phase 5 is complete when:

- [ ] `src/domain/compliance/Deadline.ts` models deadlines explicitly
- [ ] `src/domain/compliance/ComplianceStatus.ts` tracks compliance state
- [ ] `src/domain/identity/Tenant.ts` manages tenant state
- [ ] `src/domain/identity/Permission.ts` defines role-based access
- [ ] `src/application/identity/AuthorizationService.ts` enforces access
- [ ] No cross-context imports (compliance doesn't import invoicing directly)
- [ ] Authorization checks in all use cases

---

**Next Document:** Phase 6 Implementation Plan (Validation Hardening)
