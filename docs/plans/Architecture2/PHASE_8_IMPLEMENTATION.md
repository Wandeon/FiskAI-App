# Phase 8: Lock-Down - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 7)
**Depends On:** Phase 7 Completion (Full test coverage)
**Duration Estimate:** 1-2 focused sessions
**Goal:** Finalize system integrity and remove all legacy allowances

---

## 0. Phase 8 Objectives

1. Remove all legacy code paths
2. Flip all ESLint warnings to errors
3. Remove legacy TypeScript config
4. Enforce zero architectural violations
5. Document final architecture
6. Lock down change control

---

## 1. Remove Legacy Code

### 1.1 Identify Remaining Legacy Files

After Phases 0-7, audit for any remaining:

- Files still using floats for money
- Files still importing DB from UI
- Files with manual validation
- Files in `src/lib/` that should be in domain/application/infrastructure

```bash
# Find remaining violations
grep -r 'parseFloat\|Number(\|\.toFixed(' src/lib/ src/app/
grep -r '@prisma/client\|from "@/lib/db"' src/components/ src/app/
```

### 1.2 Delete or Migrate Each File

For each legacy file:

1. If functionality is replaced by domain code → **DELETE**
2. If functionality is still needed → **MIGRATE** to correct layer
3. Document the migration in git commit

### 1.3 Remove Legacy Type Aliases

Delete `src/lib/invoicing/models.ts` and similar anemic type files that just re-export Prisma types.

---

## 2. Flip ESLint Warnings to Errors

### 2.1 Update `.eslintrc.json`

Change all `"warn"` to `"error"`:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "fisk-design-system/no-hardcoded-colors": "error"
  }
}
```

### 2.2 Remove Override Exceptions

Remove any file-level overrides that were allowing legacy patterns:

```json
{
  "overrides": [
    // DELETE this entire block if it exists:
    // {
    //   "files": ["src/lib/legacy/**"],
    //   "rules": { ... }
    // }
  ]
}
```

---

## 3. Single TypeScript Configuration

### 3.1 Remove Legacy Config

If `tsconfig.legacy.json` exists, delete it.

### 3.2 Enforce Strict Mode

**`tsconfig.json`:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

### 3.3 Verify Zero Errors

```bash
npx tsc --noEmit
# Must return 0 errors
```

---

## 4. Final CI Configuration

### 4.1 All Jobs Blocking

**`.github/workflows/ci.yml`:**

```yaml
typecheck:
  name: TypeScript Check
  runs-on: ubuntu-latest
  # NO continue-on-error

test-integration:
  name: Integration Tests
  runs-on: ubuntu-latest
  # NO if: false

build:
  name: Build
  runs-on: ubuntu-latest
  needs: [lint, typecheck, test, test-integration, test-property, test-golden, security]
  # ALL jobs required
```

### 4.2 Add Architecture Check Job

```yaml
architecture-check:
  name: Architecture Compliance
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci --legacy-peer-deps

    - name: Check no UI imports DB
      run: |
        if grep -r '@prisma/client\|from "@/lib/db"' src/components/ src/app/; then
          echo "FAIL: UI importing database"
          exit 1
        fi

    - name: Check no floats in domain
      run: |
        if grep -r 'parseFloat\|Number(\|\.toFixed(' src/domain/ src/application/; then
          echo "FAIL: Float operations in domain/application"
          exit 1
        fi

    - name: Check domain has no infra imports
      run: |
        if grep -r '@prisma/client\|from "@/lib/db"\|from "next' src/domain/; then
          echo "FAIL: Domain importing infrastructure"
          exit 1
        fi
```

---

## 5. Document Final Architecture

### 5.1 Update CLAUDE.md

Add architecture section:

```markdown
## Architecture (DDD + Clean Architecture)
```

src/
├── domain/ # Pure business logic (no dependencies)
│ ├── shared/ # Value objects (Money, Quantity, VatRate)
│ ├── invoicing/ # Invoice aggregate
│ ├── tax/ # VAT calculations
│ ├── fiscalization/ # Fiscal state machine
│ ├── banking/ # Bank transactions
│ ├── compliance/ # Deadlines, compliance checks
│ └── identity/ # Tenant, permissions
│
├── application/ # Use cases (imports domain only)
│ ├── invoicing/ # CreateInvoice, IssueInvoice, etc.
│ ├── tax/ # CalculateVat, etc.
│ └── ...
│
├── infrastructure/ # DB, external services
│ ├── persistence/ # Prisma repositories
│ ├── fiscal/ # XML building, signing, Porezna client
│ ├── banking/ # CSV parsers, GoCardless
│ └── mappers/ # DB ↔ Domain conversion
│
└── interfaces/ # API routes, server actions
├── api/ # REST endpoints
└── actions/ # Server actions

```

### Rules (Enforced by ESLint + CI)
- Domain has NO external dependencies
- Application imports from domain only
- Infrastructure implements domain interfaces
- UI calls interfaces only, never domain/application directly
```

### 5.2 Create Architecture Decision Record

**`docs/adr/001-ddd-clean-architecture.md`:**

```markdown
# ADR-001: Domain-Driven Design with Clean Architecture

## Status

Accepted (Phase 8 Complete)

## Context

FiskAI is a regulated financial system requiring auditability,
correctness, and maintainability.

## Decision

Adopt DDD with Clean/Onion Architecture:

- 4 layers with strict dependency direction
- Pure domain layer with no framework dependencies
- Money as value object (no floats)
- Rich aggregates with business verbs
- 100% Zod validation at boundaries

## Consequences

- Higher initial development cost
- Lower long-term maintenance cost
- Easier testing
- Regulatory compliance
- AI-safe codebase
```

---

## 6. Lock Down Change Control

### 6.1 CODEOWNERS

**`.github/CODEOWNERS`:**

```
# Domain layer requires senior review
/src/domain/ @senior-dev @tech-lead

# Infrastructure requires platform review
/src/infrastructure/ @platform-team

# Architecture documents require ADR
/docs/plans/Architecture2/ @tech-lead
```

### 6.2 Branch Protection

Ensure GitHub branch protection rules:

- ✅ Require PR reviews (2 approvers for domain)
- ✅ Require status checks (all CI jobs)
- ✅ Require up-to-date branches
- ✅ No force pushes
- ✅ No deletions

---

## 7. Final Checklist

### Architecture Compliance

- [ ] No files in `src/lib/` with business logic (moved to domain)
- [ ] No UI components importing Prisma/DB
- [ ] No domain code importing infrastructure
- [ ] No float operations in domain/application
- [ ] No manual validation (all Zod)

### CI/CD

- [ ] TypeScript blocking (0 errors)
- [ ] ESLint blocking (0 errors)
- [ ] All test suites passing
- [ ] Golden tests locked
- [ ] Architecture check job added

### Documentation

- [ ] CLAUDE.md updated with architecture
- [ ] ADR for architecture decision
- [ ] All phase plans complete
- [ ] CODEOWNERS configured

---

## 8. Exit Criteria

Phase 8 is complete when:

- [ ] Zero legacy code paths remain
- [ ] Zero ESLint warnings (all errors)
- [ ] Zero TypeScript errors
- [ ] Single strict tsconfig
- [ ] All CI jobs blocking
- [ ] Architecture check job passing
- [ ] CODEOWNERS configured
- [ ] Documentation complete

---

## 9. Migration Complete

When all exit criteria are met:

1. **Tag release**: `git tag v2.0.0-architecture-complete`
2. **Announce**: Notify team that architecture migration is complete
3. **Monitor**: Watch for regressions in first 2 weeks
4. **Celebrate**: The system is now compliant

---

### End of Phase 8

**This completes the FiskAI Architecture Remediation.**

The system is now:

- Domain-Driven with Clean Architecture
- Float-free for all money operations
- 100% validated at boundaries
- Fully tested with property-based tests
- Locked down with CI enforcement
- Safe for AI-generated contributions
