# FiskAI Architecture Constitution

**Status:** Canonical  
**Scope:** Entire codebase, all contributors (human and AI)  
**Change Control:** Only via Architecture Decision Record (ADR)

---

## 0. Purpose

This document defines the **non-negotiable architectural laws** of the FiskAI system.

Its purpose is to:

- eliminate ambiguity
- prevent architectural drift
- make correctness enforceable
- make AI-generated code safe by construction
- ensure long-term auditability for a regulated financial system

If any other document conflicts with this one, **this document wins**.

---

## 1. Architectural Model (Hard Law)

FiskAI uses **Domain-Driven Design (DDD)** with **Clean / Onion Architecture**.

The system is divided into **four layers with strict dependency direction**.

```
src/
├── domain/            # Pure business logic
├── application/       # Use cases / orchestration
├── infrastructure/    # DB, external systems
├── interfaces/        # API routes, server actions, adapters
```

### Dependency Direction (MANDATORY)

Dependencies are allowed **only inward**.

| Layer               | May Import From                  |
| ------------------- | -------------------------------- |
| domain              | nothing                          |
| application         | domain                           |
| infrastructure      | domain, application              |
| interfaces          | application, domain (types only) |
| UI (app/components) | interfaces only                  |

Any violation of this table is an **architectural defect**.

---

## 2. Layer Definitions (What Belongs Where)

### 2.1 Domain Layer (`src/domain/**`)

**Purpose:**  
Represent the business truth of the system.

**Contains:**

- Aggregates
- Entities
- Value Objects
- Domain Errors
- Domain Events
- Business invariants
- State machines

**Strict Rules:**

- ❌ NO database access
- ❌ NO Prisma, ORM, SQL, HTTP
- ❌ NO React, Next.js, Node APIs
- ❌ NO formatting, localization, or UI logic
- ❌ NO framework imports of any kind

**Allowed Dependencies:**

- Language primitives
- Pure math / date libraries (no I/O)
- Internal domain code only

The domain must be **pure, deterministic, and testable in isolation**.

---

### 2.2 Application Layer (`src/application/**`)

**Purpose:**  
Coordinate domain behavior to fulfill use cases.

**Contains:**

- Use cases / command handlers
- Application services
- Transaction orchestration
- Authorization checks (business-level, not auth provider)

**Rules:**

- Calls domain methods
- Loads and saves aggregates via repositories (interfaces)
- Emits domain events outward

**Forbidden:**

- ❌ Business rules (they live in domain)
- ❌ Direct DB access
- ❌ HTTP or framework logic

The application layer answers **“what happens”**, not **“how it is stored or exposed”**.

---

### 2.3 Infrastructure Layer (`src/infrastructure/**`)

**Purpose:**  
Implement technical details.

**Contains:**

- Prisma / database access
- External API clients
- File systems
- Queues
- Crypto, certificates
- Mappers between DB ↔ Domain

**Rules:**

- Implements interfaces defined in domain/application
- Converts primitives ↔ value objects
- No business decisions

**Forbidden:**

- ❌ Business rules
- ❌ Validation logic
- ❌ Direct user interaction logic

Infrastructure is **replaceable by definition**.

---

### 2.4 Interfaces Layer (`src/interfaces/**`)

**Purpose:**  
Adapt the outside world to the application layer.

**Contains:**

- API routes
- Server actions
- Webhook handlers
- Input/output DTO mapping

**Rules:**

- Validate all input
- Call exactly one application use case per action
- Convert results to response format

**Forbidden:**

- ❌ Business logic
- ❌ Domain mutation outside use cases
- ❌ DB access

Interfaces are **thin translators**, nothing more.

---

## 3. UI Rules (Special Case)

UI code (`src/app/**`, `src/components/**`) is **presentation only**.

**Absolute Prohibitions:**

- ❌ Importing database clients
- ❌ Importing Prisma
- ❌ Importing infrastructure code
- ❌ Performing calculations involving money, tax, or compliance rules

UI may:

- Call server actions / APIs
- Format values for display
- Handle user interaction only

UI is **never a source of truth**.

---

## 4. Bounded Contexts (Ownership Law)

Every business concept belongs to **exactly one bounded context**.

### Mandatory Contexts (Minimum)

- Invoicing
- Tax (VAT, thresholds, rates)
- Fiscalization
- Banking & Reconciliation
- Compliance & Deadlines
- Identity / Tenant / RBAC
- Regulatory Truth

**Rules:**

- No cross-context business logic
- No shared “utils” across contexts
- Contexts communicate only via:
  - application use cases
  - explicit contracts

If a rule touches two contexts, it is split or elevated, never duplicated.

---

## 5. Aggregates & Rich Domain Models (MANDATORY)

### Aggregate Rules

- Each aggregate has a single root
- All mutations go through the root
- State changes use **business verbs**, not setters

**Forbidden:**

```ts
invoice.status = "ISSUED"
invoice.lines.push(line)
```

**Required:**

```ts
invoice.issue()
invoice.addLine(...)
```

Aggregates **protect invariants by design**.

---

## 6. Value Objects (Non-Optional)

### Required Value Objects

At minimum:

- Money
- Quantity
- VatRate

**Rules:**

- Immutable
- Compared by value
- No IDs
- No framework dependencies

### Money Law (Critical)

- ❌ No floats in business logic
- ❌ No `parseFloat`, `Number()`, `.toFixed()`
- ❌ No currency logic in UI or DB
- ✅ Money math only via `Money` value object
- ✅ Conversion at repository boundary only

Violation of this rule is a **financial correctness defect**.

---

## 7. Validation Boundary Law

All input **must** be validated at system boundaries.

- APIs
- Server actions
- Webhooks
- Imports

**Rules:**

- Zod is mandatory
- No manual `if (!x)` validation
- No partially validated objects crossing layers

Once validated, data is **trusted** inside.

---

## 8. Error & Failure Model

Errors must be:

- Explicit
- Typed
- Predictable

No stringly-typed errors in core flows.

Domain errors represent **business impossibility**, not technical failure.

---

## 9. What Is Explicitly Forbidden (Summary)

If any of the following are found, they must be removed:

- UI importing DB or Prisma
- Domain importing infrastructure or frameworks
- Business logic in routes
- Float arithmetic for money
- Setters on aggregates
- Silent async failures
- Validation skipped at boundaries
- “Temporary” exceptions without ADR

---

## 10. Enforcement Clause

This constitution is enforced by:

- ESLint (restricted imports)
- TypeScript project boundaries
- CI blocking rules
- CODEOWNERS
- AI agent rules

**No human discretion overrides this document.**

---

## 11. Change Control

Any change to this document requires:

- A written ADR
- Explicit justification
- Clear migration strategy

Until then, this document is **final and binding**.
