# FiskAI Correctness & Safety Standards

**Status:** Canonical  
**Scope:** Entire codebase, all contributors (human and AI)  
**Depends On:** FiskAI Architecture Constitution  
**Change Control:** Only via Architecture Decision Record (ADR)

---

## 0. Purpose

This document defines **what “correct” means** in FiskAI.

Architecture defines _where_ code lives.  
This document defines _how correctness, safety, and regulatory integrity are enforced_.

Anything that violates these standards is **incorrect by definition**, even if it passes tests or “works in production”.

---

## 1. Correctness Principles (Non-Negotiable)

FiskAI is a **regulated financial system**. Therefore:

- Silent failure is unacceptable
- Approximate results are unacceptable
- Implicit behavior is unacceptable
- Undocumented assumptions are unacceptable

The system must be:

- deterministic
- auditable
- fail-closed
- reproducible

---

## 2. Money & Numerical Correctness (Critical)

### 2.1 Canonical Representation

- All monetary values are represented using the **Money value object**
- The Money object is **pure domain code**
- No floats (`number`) are allowed for money calculations

**Forbidden everywhere except UI formatting:**

- `parseFloat`
- `Number()`
- `.toFixed()`
- implicit numeric coercion

### 2.2 Money Invariants

Money operations must guarantee:

- no precision loss
- no negative VAT amounts
- no currency mixing
- consistent rounding (defined once)

### 2.3 Where Conversion Is Allowed

- Database ↔ Money conversion: **repository / mapper only**
- UI formatting: **interfaces / UI only**
- Business math: **domain only**

Any other conversion is a defect.

---

## 3. Tax & Regulatory Logic

### 3.1 Rule Discipline

All regulatory rules must:

- have a unique rule identifier
- reference legal basis (law, article)
- be versioned
- have an effective date

Rules must not be scattered as ad-hoc `if` statements.

### 3.2 VAT Correctness

VAT logic must guarantee:

- VAT never negative
- base × rate = tax within rounding policy
- totals equal sum of line items
- report totals equal invoice aggregates

Violations must throw **domain errors**, not return partial results.

---

## 4. Validation & Trust Boundaries

### 4.1 Mandatory Validation

All external input must be validated:

- HTTP requests
- Server actions
- Webhooks
- Imports (CSV, XML, JSON)

**Zod is mandatory.**

Manual validation (`if (!x)`) is forbidden.

### 4.2 Trust Model

- Data is untrusted at boundaries
- Data is trusted _only after validation_
- No partially validated objects may cross layers

---

## 5. State Machines & Invariants

### 5.1 Explicit States

Regulated entities must have explicit states:

- Invoice: DRAFT → ISSUED → FISCALIZED → PAID → CANCELED
- Bank import: RECEIVED → PARSED → RECONCILED → FAILED
- Reports: GENERATED → SUBMITTED → ACCEPTED / REJECTED

Implicit state is forbidden.

### 5.2 Invariant Enforcement

Invariants must be enforced:

- inside domain methods
- before persistence
- before side effects

Fail fast. Fail closed.

---

## 6. Idempotency & Concurrency

### 6.1 Idempotency

Any operation that:

- creates external side effects
- changes financial state
- may be retried

**Must require an idempotency key.**

Repeated execution with the same key must:

- not duplicate effects
- return the same result

### 6.2 Concurrency Control

- Optimistic locking or versioning is mandatory for aggregates
- Lost updates are unacceptable
- Conflicts must be explicit

---

## 7. Async Safety

### 7.1 Promise Discipline

- All promises must be awaited
- Fire-and-forget is allowed only if:
  - explicitly marked
  - logged
  - monitored

Silent promise rejection is forbidden.

### 7.2 Background Work

Background jobs must:

- carry correlation IDs
- be idempotent
- persist progress
- surface failures

---

## 8. Error Model (Mandatory)

Errors must be structured.

### 8.1 Error Shape

Every error must include:

- `code` (stable, machine-readable)
- `message` (human-readable)
- `context` (key data)
- `retryable` flag
- `correlationId`

String-only errors are forbidden outside UI.

### 8.2 Domain vs Technical Errors

- Domain errors = business impossibility
- Technical errors = infrastructure failure

Never mix them.

---

## 9. Auditability

### 9.1 Audit Trail Requirements

For regulated actions:

- invoice issue
- fiscalization
- VAT report generation
- bank reconciliation

The system must record:

- who
- when
- what changed
- previous vs new state
- originating request

### 9.2 Immutability

Facts must not be overwritten.
Corrections are new facts, not edits.

---

## 10. Testing as Proof of Correctness

### 10.1 Required Test Types

- Unit tests: domain invariants
- Integration tests: DB + use cases
- Property-based tests: money, tax, state machines
- Golden tests: regulated outputs
- E2E tests: critical user journeys

### 10.2 Property-Based Testing (Mandatory)

Money, VAT, and state transitions must have:

- invariant tests
- randomized input coverage

Absence of property tests in these areas is a correctness gap.

---

## 11. CI Enforcement

A change is **invalid** if:

- typecheck fails
- lint rules fail
- required tests are missing
- regulated output changes without updated golden fixtures

CI is the final arbiter of correctness.

---

## 12. What Is Explicitly Forbidden

- Float math for money
- Skipping validation
- Silent retries
- Ad-hoc regulatory logic
- Implicit state transitions
- UI-derived business truth
- “Temporary” correctness exceptions

---

## 13. Change Control

Any change to these standards requires:

- ADR
- legal/regulatory impact assessment
- migration plan

Until approved, these rules are binding.

---

### End of Document 2

**Next document:** CI & Enforcement Specification
