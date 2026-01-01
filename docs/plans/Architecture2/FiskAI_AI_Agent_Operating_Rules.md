# FiskAI AI Agent Operating Rules

**Status:** Canonical  
**Audience:** All AI coding assistants (Cursor, Copilot, Claude, Windsurf, custom agents)  
**Scope:** Entire repository  
**Depends On:**

- FiskAI Architecture Constitution
- FiskAI Correctness & Safety Standards
- FiskAI CI & Enforcement Specification

**Purpose:** Prevent AI-generated code from violating architecture, correctness, or regulatory constraints.

This document is **binding**. If an AI-generated change violates any rule below, it is incorrect by definition and must be rejected.

---

## 0. Prime Directive

**AI assists, it does not decide.**  
AI may propose code. The system’s rules decide whether it is allowed.

AI must prefer **clarity, determinism, and auditability** over cleverness or speed.

---

## 1. Where AI May Add or Modify Code

### Allowed Locations

- `src/domain/**` (pure domain logic only)
- `src/application/**` (use cases only)
- `src/infrastructure/**` (adapters and mappers only)
- `src/interfaces/**` (thin adapters only)
- Test directories associated with the above

### Forbidden Locations (unless explicitly instructed)

- `src/lib/**` for business logic
- UI components for business rules
- Configuration files unrelated to the task

If uncertain, **do not add code**. Ask for clarification.

---

## 2. Dependency Rules (Absolute)

### Domain Layer (`src/domain/**`)

- ❌ No imports from:
  - Prisma
  - database clients
  - Next.js / React
  - Node APIs (fs, crypto, process)
  - application, infrastructure, or interfaces
- ✅ Only pure TypeScript and domain code

### Application Layer (`src/application/**`)

- ❌ No imports from:
  - interfaces
  - UI
  - Prisma or DB clients
- ✅ Imports from domain only

### Infrastructure Layer (`src/infrastructure/**`)

- ✅ May import Prisma, DB clients, SDKs
- ❌ Must not contain business rules

### Interfaces & UI

- ❌ No DB or Prisma imports
- ❌ No money or tax calculations
- ✅ Validate input, call use cases, format output

---

## 3. Money & Math Rules (Critical)

- ❌ Never use `number` for money
- ❌ Never use `parseFloat`, `Number()`, `.toFixed()` for calculations
- ❌ Never calculate VAT or totals outside domain
- ✅ Always use `Money` value object
- ✅ All money math lives in domain

Violations here are **financial correctness defects**.

---

## 4. Aggregate & State Rules

- ❌ Do not mutate state directly
- ❌ Do not expose mutable collections
- ❌ Do not add setters

**Required pattern:**

```ts
invoice.addLine(...)
invoice.issue()
invoice.fiscalize(commandId)
```

Aggregates enforce invariants. AI must not bypass them.

---

## 5. Validation Rules

- ❌ No manual validation (`if (!x)`)
- ❌ No trusting request bodies
- ✅ Always validate with Zod at boundaries
- ✅ Parsed data only crosses layers

If validation is missing, **do not proceed**.

---

## 6. Async & Side Effects

- ❌ No floating promises
- ❌ No swallowed errors
- ❌ No external calls inside domain
- ✅ Await all async work
- ✅ Mark intentional fire-and-forget explicitly with `void` and logging

---

## 7. Tests Required Per Change

AI must add or update tests when:

- domain logic changes → unit + property tests
- money logic changes → property tests
- regulated output changes → golden tests
- API changes → integration tests

If tests are not added, the change is incomplete.

---

## 8. Regulated Output Discipline

- ❌ Do not change VAT XML, fiscal payloads, or reports without updating fixtures
- ❌ Do not “fix” outputs by tweaking formatting
- ✅ Outputs are versioned and tested

---

## 9. Error Handling Rules

- ❌ No string-only errors
- ❌ No throwing generic `Error` for domain failures
- ✅ Use typed domain errors with codes
- ✅ Include context and correlation IDs

---

## 10. When AI Must Refuse

AI must refuse to proceed if:

- asked to bypass validation
- asked to introduce floats for money
- asked to access DB from UI
- asked to ignore CI failures
- asked to “just make it work” against rules

Refusal is correct behavior.

---

## 11. Output Expectations

AI output must be:

- deterministic
- minimal
- explicit
- aligned with existing patterns
- accompanied by tests when required

No speculative abstractions. No hidden behavior.

---

## 12. Reminder

**If CI would fail, the answer is wrong.**

---

### End of Document 5

**Next document:** Reference Implementation Pack
