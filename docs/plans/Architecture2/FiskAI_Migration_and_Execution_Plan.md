# FiskAI Migration & Execution Plan

**Status:** Canonical  
**Scope:** Entire system  
**Depends On:**

- FiskAI Architecture Constitution
- FiskAI Correctness & Safety Standards
- FiskAI CI & Enforcement Specification

**Purpose:** Define the only allowed path from the current system to a fully compliant FiskAI.

This document answers **how we move**, not what we believe.

---

## 0. Core Principle

Migration must:

- never freeze development
- never allow new architectural debt
- always reduce risk, never increase it
- be reversible where possible
- end in a **locked-down, compliant system**

Skipping phases or reordering them is forbidden.

---

## 1. Phase Overview

| Phase | Name                     | Goal                                |
| ----: | ------------------------ | ----------------------------------- |
|     0 | Containment              | Stop new damage immediately         |
|     1 | Domain Primitives        | Eliminate money correctness risk    |
|     2 | Vertical Slice (Invoice) | Prove architecture end-to-end       |
|     3 | Fiscalization & Tax      | Regulated core correctness          |
|     4 | Banking & Reconciliation | External money safety               |
|     5 | Compliance & Identity    | Full bounded context coverage       |
|     6 | Validation Hardening     | 100% boundary correctness           |
|     7 | Testing Expansion        | Prove invariants formally           |
|     8 | Lock-Down                | Remove legacy and tighten all gates |

---

## 2. Phase 0 – Containment (MANDATORY FIRST)

### Goal

Prevent any new violations from entering the system.

### Actions

1. Enable strict blocking CI for:
   - `src/domain/**`
   - `src/application/**`
2. Add ESLint firewalls:
   - UI cannot import DB/Prisma
   - Domain cannot import infra/frameworks
3. Enable async lint rules:
   - warnings first
4. Enable integration tests in CI (minimum smoke)

### Exit Criteria

- No new UI→DB imports possible
- New domain/application code is fully strict
- CI blocks architectural violations

---

## 3. Phase 1 – Domain Primitives (Money First)

### Goal

Remove the single highest financial risk: float-based money logic.

### Actions

1. Create pure value objects in `src/domain/shared/`:
   - `Money`
   - `Quantity`
   - `VatRate`
2. Implement Decimal-based math (no Prisma, no formatting)
3. Add repository mappers for DB ↔ domain conversion
4. Replace float usage in:
   - VAT calculation
   - Invoice totals
   - Banking imports

### Forbidden

- Schema migrations
- UI changes
- New features

### Exit Criteria

- No float operations in business paths
- Money value object used everywhere in domain/application
- CI bans float reintroduction

---

## 4. Phase 2 – Vertical Slice: Invoice

### Goal

Demonstrate the full architecture on the most critical domain.

### Actions

1. Create `invoicing` bounded context across all layers
2. Implement:
   - Invoice aggregate
   - State machine
   - Idempotent commands
3. Add:
   - Use cases
   - Repository + mapper
   - Thin API adapter
4. Add:
   - Unit tests
   - Property tests
   - Integration tests

### Forbidden

- Touching other domains
- Rewriting legacy invoicing yet

### Exit Criteria

- One end-to-end compliant invoice flow
- No DB access outside infrastructure
- All invariants enforced

---

## 5. Phase 3 – Fiscalization & Tax

### Goal

Bring regulated logic under strict control.

### Actions

1. Model fiscalization state machine explicitly
2. Implement VAT calculator in domain
3. Add golden tests for:
   - Fiscal XML
   - VAT reports
4. Add idempotency to all submissions

### Exit Criteria

- Deterministic fiscalization
- Auditable VAT outputs
- Golden tests passing in CI

---

## 6. Phase 4 – Banking & Reconciliation

### Goal

Ensure external money flows cannot corrupt state.

### Actions

1. Move bank import logic into domain/application
2. Enforce Money usage everywhere
3. Add reconciliation invariants
4. Add idempotency for imports

### Exit Criteria

- No float parsing in banking paths
- Duplicate imports impossible
- Reconciliation deterministic

---

## 7. Phase 5 – Compliance & Identity

### Goal

Complete bounded context coverage.

### Actions

1. Extract compliance rules into domain
2. Model deadlines and penalties explicitly
3. Clean identity/tenant logic
4. Add authorization rules in application layer

### Exit Criteria

- No cross-context logic leakage
- Ownership boundaries enforced

---

## 8. Phase 6 – Validation Hardening

### Goal

Achieve 100% boundary correctness.

### Actions

1. Add Zod validation to every:
   - API route
   - Server action
   - Import handler
2. Remove manual validation
3. Standardize error responses

### Exit Criteria

- No unvalidated entry points
- Consistent error model

---

## 9. Phase 7 – Testing Expansion

### Goal

Prove correctness, not assume it.

### Actions

1. Add property-based tests for:
   - Money
   - VAT
   - State transitions
2. Add E2E tests for critical flows
3. Enforce golden tests for regulated outputs

### Exit Criteria

- All regulated logic covered by invariants
- CI blocks missing tests

---

## 10. Phase 8 – Lock-Down

### Goal

Finalize system integrity.

### Actions

1. Remove legacy code paths
2. Flip all warnings to errors
3. Remove legacy TS config
4. Enforce zero architectural violations

### Exit Criteria

- Single strict TS config
- No legacy exemptions
- Fully compliant system

---

## 11. Governance Rules

- Phases cannot overlap
- Emergency fixes must still respect containment
- Any deviation requires ADR

---

## 12. Completion Definition

Migration is complete only when:

- All phases exited successfully
- All enforcement rules active
- No legacy bypasses remain

Until then, the system is **in transition** and must be treated as such.

---

### End of Document 4

**Next document:** AI Agent Operating Rules
