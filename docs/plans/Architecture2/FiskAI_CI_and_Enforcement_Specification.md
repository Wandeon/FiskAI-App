# FiskAI CI & Enforcement Specification

**Status:** Canonical  
**Scope:** Entire repository  
**Depends On:**

- FiskAI Architecture Constitution
- FiskAI Correctness & Safety Standards

**Purpose:** Make architectural and correctness rules unavoidable.

---

## 0. Objective

This document defines **how rules are enforced**, not what they are.

Anything not enforced by tooling is considered **optional** and therefore invalid for FiskAI.

CI, linting, and repository configuration are the **final authority**.

---

## 1. Enforcement Layers

Rules are enforced at four levels:

1. Editor / Linter (fast feedback)
2. CI Pipeline (merge blocking)
3. Repository Rules (branch protection)
4. Runtime Guards (fail-closed behavior)

All four must exist.

---

## 2. Repository-Level Enforcement (Git)

### 2.1 Branch Protection (Mandatory)

Protected branches:

- `main`
- `release/*`

Rules:

- Pull requests required
- CODEOWNERS review required
- All required CI checks must pass
- No force pushes
- No direct pushes

---

### 2.2 CODEOWNERS (Mandatory)

Ownership is defined by **bounded context**.

Example:

```
/src/domain/invoicing/        @invoicing-owner
/src/domain/tax/              @tax-owner
/src/domain/fiscalization/    @fiscal-owner
/src/infrastructure/          @platform-owner
/prisma/                      @data-owner
```

No PR touching these paths may merge without owner approval.

---

## 3. TypeScript Enforcement (Ratchet Strategy)

### 3.1 Split TypeScript Projects

Create **three TypeScript configurations**:

1. `tsconfig.base.json` – shared config
2. `tsconfig.strict.json` – **blocking**
3. `tsconfig.legacy.json` – temporary tolerance

#### Strict Project (Blocking)

Includes:

- `src/domain/**`
- `src/application/**`

Rules:

- `strict: true`
- no `any`
- no implicit `undefined`
- no unused locals
- no suppressed errors without comment

CI **fails** on any error here.

#### Legacy Project (Non-Blocking, Measured)

Includes:

- remaining code

Rules:

- Errors allowed temporarily
- Error count must **monotonically decrease**

---

### 3.2 Typecheck CI Jobs

Required jobs:

- `typecheck:strict` (blocking)
- `typecheck:legacy` (report-only)

Merging is blocked if:

- strict typecheck fails
- legacy error count increases

---

## 4. ESLint Architecture Firewall

### 4.1 Layer Boundary Enforcement

Use `no-restricted-imports` and `import/no-restricted-paths`.

#### Mandatory Rules

- `src/domain/**` cannot import from:
  - `src/application/**`
  - `src/infrastructure/**`
  - `src/interfaces/**`
  - `next/**`
  - `react/**`
  - `@prisma/**`
  - `@/lib/db`

- `src/application/**` cannot import from:
  - `src/interfaces/**`
  - `next/**`
  - `react/**`
  - DB or Prisma

- `src/components/**` and `src/app/**` cannot import:
  - Prisma
  - DB clients
  - infrastructure code

Violations are **errors**, not warnings.

---

### 4.2 Async Safety Rules

Mandatory ESLint rules:

- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-misused-promises`

Initially warnings for legacy code, errors for strict paths.

---

### 4.3 Money Safety Rules

In `src/domain/**` and `src/application/**`:

Forbidden:

- `parseFloat`
- `Number()`
- `.toFixed()`

Enforced using `no-restricted-syntax`.

---

## 5. Validation Enforcement

### 5.1 Boundary Validation Check

CI must fail if:

- a new API route or server action
- does not invoke a Zod schema

Enforced by:

- lint rule pattern checks
- PR checklist verification

---

## 6. Test Enforcement

### 6.1 Required Test Jobs

CI must run:

- Unit tests (Vitest)
- Integration tests (DB-backed)
- Property tests (fast-check)
- Golden tests (regulated outputs)

### 6.2 Merge Blocking Rules

Merge is blocked if:

- domain code changed without tests
- regulated output changed without fixture update
- tests are skipped or disabled

---

## 7. Forbidden Pattern Detection Jobs

Add CI jobs that fail on:

- UI importing DB or Prisma
- domain importing infrastructure
- float money operations in business paths

These jobs are **explicit fail gates**.

---

## 8. Metrics & Ratchets

Track and report:

- Number of TS errors (legacy)
- Number of UI→DB violations
- Number of float money ops
- Zod validation coverage

Rules:

- Metrics must never increase
- Decrease required per milestone

---

## 9. Runtime Guards (Minimum)

Even with CI:

- Domain invariants must throw
- Validation failures must reject requests
- Idempotency must be enforced

CI does not replace runtime correctness.

---

## 10. CI Is Law

If CI fails:

- the change does not exist
- the PR is incorrect
- no override is allowed

Human judgment does not bypass CI.

---

## 11. Change Control

Any change to enforcement rules requires:

- ADR
- justification
- rollout plan

Until approved, enforcement stands.

---

### End of Document 3

**Next document:** Migration & Execution Plan
