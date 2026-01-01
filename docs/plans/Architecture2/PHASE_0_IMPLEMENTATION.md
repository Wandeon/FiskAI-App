# Phase 0: Containment - Implementation Plan

**Status:** READY FOR EXECUTION
**Depends On:** Validation Report
**Duration Estimate:** 2-3 focused sessions
**Goal:** Prevent any new violations from entering the system

---

## 0. Phase 0 Objectives

1. Create the 4-layer directory structure (scaffolding)
2. Fix all TypeScript errors (currently 14)
3. Make TypeScript blocking in CI
4. Add ESLint architecture firewall rules
5. Add ESLint async safety rules
6. Enable integration tests in CI
7. Remove DB imports from UI components (23 files)

---

## 1. Create 4-Layer Directory Structure

### 1.1 Create Directories

```bash
mkdir -p src/domain/shared
mkdir -p src/domain/invoicing
mkdir -p src/domain/tax
mkdir -p src/domain/fiscalization
mkdir -p src/domain/banking
mkdir -p src/domain/compliance
mkdir -p src/domain/identity

mkdir -p src/application/invoicing
mkdir -p src/application/tax
mkdir -p src/application/fiscalization
mkdir -p src/application/banking
mkdir -p src/application/compliance
mkdir -p src/application/identity

mkdir -p src/infrastructure/persistence
mkdir -p src/infrastructure/external
mkdir -p src/infrastructure/mappers

mkdir -p src/interfaces/api
mkdir -p src/interfaces/actions
```

### 1.2 Add Placeholder README Files

Each directory gets a README explaining its purpose and constraints:

**`src/domain/README.md`:**

```markdown
# Domain Layer

This layer contains pure business logic.

## Rules (Enforced by ESLint)

- ❌ NO imports from: @prisma/client, @/lib/db, next/, react/
- ❌ NO infrastructure, application, or interfaces imports
- ✅ Only pure TypeScript and domain code

## Contents

- Value Objects (Money, Quantity, VatRate)
- Aggregates (Invoice, BankAccount)
- Domain Events
- Domain Errors
```

**`src/application/README.md`:**

```markdown
# Application Layer

This layer coordinates domain behavior to fulfill use cases.

## Rules (Enforced by ESLint)

- ✅ May import from domain
- ❌ NO imports from: interfaces, @prisma/client, @/lib/db
- ❌ NO direct database access

## Contents

- Use Cases / Command Handlers
- Application Services
- Transaction Orchestration
```

**`src/infrastructure/README.md`:**

```markdown
# Infrastructure Layer

This layer implements technical details.

## Rules

- ✅ May import from domain and application
- ✅ May use Prisma, external SDKs, file systems
- ❌ NO business rules or validation logic

## Contents

- Repository Implementations (Prisma)
- External API Clients
- Mappers (DB ↔ Domain)
```

**`src/interfaces/README.md`:**

```markdown
# Interfaces Layer

This layer adapts the outside world to the application layer.

## Rules

- ✅ May import from application and domain (types only)
- ❌ NO business logic
- ❌ NO direct database access

## Contents

- API Route Adapters
- Server Action Adapters
- Input/Output DTOs
```

---

## 2. Fix TypeScript Errors

### 2.1 Current Errors (14 total)

All in `src/lib/security/virus-scanner.ts` - syntax errors indicating a corrupted file.

**Action:** Inspect and fix or remove the file.

```bash
# Check the file content
cat src/lib/security/virus-scanner.ts
```

### 2.2 Fix or Remove

If the file is corrupted beyond repair, remove it:

```bash
rm src/lib/security/virus-scanner.ts
```

Or fix the syntax errors if the logic is needed.

### 2.3 Verify

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Must return 0
```

---

## 3. Make TypeScript Blocking in CI

### 3.1 Edit `.github/workflows/ci.yml`

**Current (line 48):**

```yaml
continue-on-error: true
```

**Change to:**

```yaml
continue-on-error: false
```

### 3.2 Update Build Dependencies

**Current (line 210):**

```yaml
needs: [lint, test, security]
```

**Change to:**

```yaml
needs: [lint, test, security, typecheck]
```

### 3.3 Full CI Job Update

```yaml
typecheck:
  name: TypeScript Check
  runs-on: ubuntu-latest
  # CHANGED: Now blocking
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: npm

    - name: Install dependencies
      run: npm ci --legacy-peer-deps

    - name: Generate Prisma client
      run: npx prisma generate

    - name: Type check
      run: npx tsc --noEmit
      env:
        NODE_OPTIONS: "--max-old-space-size=4096"
```

---

## 4. Add ESLint Architecture Firewall

### 4.1 Update `.eslintrc.json`

Add these zones to the existing `import/no-restricted-paths` rule:

```json
{
  "rules": {
    "import/no-restricted-paths": [
      "error",
      {
        "basePath": "./src",
        "zones": [
          // EXISTING COMPONENT LAYER RULES...

          // NEW: ARCHITECTURE LAYER RULES
          {
            "target": "domain/**/*",
            "from": [
              "application/**/*",
              "infrastructure/**/*",
              "interfaces/**/*",
              "lib/db*",
              "lib/prisma*"
            ],
            "message": "Domain layer cannot import from outer layers or database."
          },
          {
            "target": "application/**/*",
            "from": ["interfaces/**/*", "lib/db*", "lib/prisma*"],
            "message": "Application layer cannot import from interfaces or database."
          },
          {
            "target": "components/**/*",
            "from": ["lib/db*", "lib/prisma*"],
            "message": "UI components cannot import database clients."
          },
          {
            "target": "app/**/*",
            "from": ["lib/db.ts"],
            "message": "App routes should use interfaces layer, not direct DB access."
          }
        ]
      }
    ]
  }
}
```

### 4.2 Add Restricted Imports for Domain

Add a new rule to ban framework imports in domain:

```json
{
  "overrides": [
    {
      "files": ["src/domain/**/*"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@prisma/*", "prisma/*"],
                "message": "Domain cannot import Prisma."
              },
              {
                "group": ["next/*", "next"],
                "message": "Domain cannot import Next.js."
              },
              {
                "group": ["react", "react/*"],
                "message": "Domain cannot import React."
              },
              {
                "group": ["@/lib/db*", "@/lib/prisma*"],
                "message": "Domain cannot import database clients."
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## 5. Add Async Safety Rules

### 5.1 Install Required Plugin

```bash
npm install --save-dev @typescript-eslint/eslint-plugin
```

### 5.2 Update ESLint Config

Add to `.eslintrc.json`:

```json
{
  "plugins": ["@typescript-eslint", "fisk-design-system", "import"],
  "rules": {
    "@typescript-eslint/no-floating-promises": "warn",
    "@typescript-eslint/no-misused-promises": "warn"
  },
  "overrides": [
    {
      "files": ["src/domain/**/*", "src/application/**/*"],
      "rules": {
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error"
      }
    }
  ]
}
```

---

## 6. Enable Integration Tests in CI

### 6.1 Edit `.github/workflows/ci.yml`

**Current (line 145-146):**

```yaml
test-integration:
  name: Integration Tests (DB)
  runs-on: ubuntu-latest
  if: false # DISABLED
```

**Change to:**

```yaml
test-integration:
  name: Integration Tests (DB)
  runs-on: ubuntu-latest
  # Enabled for Phase 0
```

### 6.2 Fix Prisma 7 Configuration

Create `prisma.config.ts` if missing:

```typescript
// prisma.config.ts
import { defineConfig } from "prisma"

export default defineConfig({
  earlyAccessFeatures: true,
})
```

### 6.3 Update Build Dependencies

```yaml
build:
  needs: [lint, test, security, typecheck, test-integration]
```

---

## 7. Remove DB Imports from UI Components

### 7.1 Files to Fix (23 total)

| File                                                    | Action                                              |
| ------------------------------------------------------- | --------------------------------------------------- |
| `src/components/documents/documents-client.tsx`         | Move data fetching to server component or API route |
| `src/components/settings/premises-card.tsx`             | Move data fetching to parent                        |
| `src/components/staff/calendar.tsx`                     | Use props from server component                     |
| `src/components/staff/clients-list.tsx`                 | Use props from server component                     |
| `src/components/staff/dashboard.tsx`                    | Use props from server component                     |
| `src/components/staff/invitations-list.tsx`             | Use props from server component                     |
| `src/components/staff/tasks-list.tsx`                   | Use props from server component                     |
| `src/components/staff/tickets-list.tsx`                 | Use props from server component                     |
| `src/components/layout/header.tsx`                      | Use props or context                                |
| `src/components/import/processing-card.tsx`             | Use props from parent                               |
| `src/components/invoice/invoice-pdf-preview.tsx`        | Use props from parent                               |
| `src/components/documents/reports-sidebar.tsx`          | Use props from server component                     |
| `src/components/expenses/expense-inline-status.tsx`     | Use props from parent                               |
| `src/components/import/confirmation-modal.tsx`          | Use props from parent                               |
| `src/components/contacts/contact-card.tsx`              | Use props from parent                               |
| `src/components/admin/admin-header-wrapper.tsx`         | Use props or context                                |
| `src/components/admin/dashboard.tsx`                    | Use props from server component                     |
| `src/components/admin/staff-management.tsx`             | Use props from server component                     |
| `src/components/admin/tenants-list.tsx`                 | Use props from server component                     |
| `src/components/invoice/product-picker.tsx`             | Use props from parent                               |
| `src/components/support/create-support-ticket-form.tsx` | Use props from parent                               |
| `src/components/admin/support-dashboard-client.tsx`     | Use props from parent                               |
| `src/components/admin/support-dashboard.tsx`            | Use props from server component                     |

### 7.2 Pattern for Each Fix

**Before (violating):**

```tsx
import { prisma } from "@/lib/db"

export function StaffDashboard() {
  const data = await prisma.client.findMany()
  return <div>{data.map(...)}</div>
}
```

**After (compliant):**

```tsx
// Server Component (page.tsx)
import { prisma } from "@/lib/db"
import { StaffDashboardClient } from "@/components/staff/dashboard"

export default async function StaffDashboardPage() {
  const data = await prisma.client.findMany()
  return <StaffDashboardClient data={data} />
}

// Client Component (no DB import)
interface Props {
  data: Client[]
}

export function StaffDashboardClient({ data }: Props) {
  return <div>{data.map(...)}</div>
}
```

---

## 8. Verification Checklist

After all changes, run these commands to verify:

```bash
# 1. TypeScript errors must be 0
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Expected: 0

# 2. ESLint must pass
npm run lint
# Expected: No errors (warnings OK for now)

# 3. No UI components import DB
grep -r '@prisma/client\|from "@/lib/db"' src/components/
# Expected: No matches

# 4. Integration tests run
npm run test:integration
# Expected: Tests pass

# 5. Build succeeds
npm run build
# Expected: Success
```

---

## 9. Exit Criteria

Phase 0 is complete when:

- [ ] Directories created: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/interfaces/`
- [ ] TypeScript errors: 0
- [ ] CI typecheck: blocking (`continue-on-error: false`)
- [ ] CI integration tests: enabled
- [ ] ESLint architecture rules: added
- [ ] ESLint async rules: added (`no-floating-promises`, `no-misused-promises`)
- [ ] UI components with DB imports: 0 (was 23)

---

## 10. What Phase 0 Does NOT Include

- No code migration (that's Phase 1+)
- No Money value object (that's Phase 1)
- No new features
- No schema changes
- No refactoring of existing business logic

Phase 0 is pure containment: stop new damage while setting up enforcement for the migration ahead.

---

**Next Document:** Phase 1 Implementation Plan (Domain Primitives)
