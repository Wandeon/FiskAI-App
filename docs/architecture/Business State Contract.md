# Business State Contract

**System:** FiskAI  
**Version:** 1.0  
**Status:** Canonical, Non-Negotiable  
**Audience:** Engineering, Product, AI, Data, Architecture  
**Purpose:** Define the single, authoritative model for how FiskAI understands a business.

---

## 1. Purpose of the Business State

The Business State represents FiskAI’s **current, shared understanding of a company as a living system**.

It answers, at any moment:

- What is true about this business right now?
- What is expected to happen next?
- What obligations exist?
- What risks are emerging?
- What decisions can be made safely?

The Business State is **not** a report.  
It is **not** a UI artifact.  
It is **not** an AI inference.

It is a **deterministic, auditable, versioned snapshot** derived from business events.

---

## 2. Core Principles (Hard Invariants)

These rules are absolute. Violating any of them invalidates the system.

### 2.1 Events Are the Only Source of Truth

- All facts enter the system as immutable events
- Events are append-only
- Corrections are new events, never edits

### 2.2 Business State Is Derived, Never Authored

- Business State is computed from events
- It may be deleted and recomputed at any time
- It is never manually edited

### 2.3 Projections Are Hypothetical

- Projections never overwrite state
- All assumptions must be explicit
- Multiple scenarios may coexist

### 2.4 AI Is Read-Only Over Truth

- AI cannot mutate events
- AI cannot mutate state
- AI cannot perform core calculations
- AI may only explain, compare, summarize, or request recomputation

### 2.5 Uncertainty Must Be Visible

- Unknowns are surfaced, not hidden
- Partial understanding is allowed
- Silent assumptions are forbidden

---

## 3. Layered System Model

The system is strictly divided into four layers.

### Layer 1: Business Events (Truth Intake)

Captures what happened in reality.

Examples:

- Invoice issued
- Payment received
- Expense recorded
- Payroll run completed
- Inventory moved
- Tax obligation created

Rules:

- Immutable
- Timestamped
- Richly attributed
- Minimal interpretation

---

### Layer 2: Business State (Understanding)

Represents the current posture of the business.

- Deterministic
- Reproducible
- Versioned
- Auditable

This is the **core product**.

---

### Layer 3: Projections (What-If)

Explores possible futures based on assumptions.

- Scenario-based
- Never authoritative
- Explicitly hypothetical

---

### Layer 4: Interpretation (AI + UI)

Explains the system to humans.

- Narrative
- Comparative
- Contextual
- Non-authoritative

---

## 4. Business State Definition

### 4.1 Business State Snapshot

A Business State Snapshot is a **point-in-time understanding** of a company.

Each snapshot MUST include:

- Company identity
- Time boundary
- Input watermark
- Computation version
- Confidence profile
- Derived sections
- Provenance references

---

### 4.2 Business State Snapshot Fields (Conceptual)

BusinessStateSnapshot {  
companyId  
asOfTimestamp  
inputWatermark  
computeVersion  
stateSchemaVersion  
stateHash  
understandingLevel  
confidenceProfile  
sections  
provenanceIndex  
}

---

## 5. Understanding Levels

Understanding Level communicates **how well FiskAI understands this business**.

This is a first-class concept.

### Levels

- **Level 0** – Raw data only
- **Level 1** – Current financial posture known
- **Level 2** – Cashflow and obligations understood
- **Level 3** – Margins, clients, payroll understood
- **Level 4** – Projections reliable
- **Level 5** – Recommendations trustworthy

Features and answers must declare the minimum level required.

---

## 6. Business State Sections (MVP)

Only sections required to answer high-value questions exist initially.

### 6.1 Cash Position

- Opening balance
- Current balance
- Available balance (if known)
- Accounts included
- Currency

Purpose:

- Answer “Where is my money now?”

---

### 6.2 Receivables Posture

- Total receivables
- Aging buckets
- Due dates
- Expected inflow timing
- Uncertainty flags

Purpose:

- Answer “What money is coming?”

---

### 6.3 Payables & Obligations

- Recurring expenses
- One-off obligations
- Tax obligations
- Due dates
- Certainty level (known / estimated / unknown)

Purpose:

- Answer “What money is going out?”

---

### 6.4 Cashflow Outlook (Base State)

- Next 30 days expected inflows
- Next 30 days expected outflows
- Net cash movement
- Risk indicators

Purpose:

- Answer “When do I get into trouble?”

---

### 6.5 Client Metrics (Minimal)

- Revenue contribution
- Payment speed
- Reliability score (deterministic)

Purpose:

- Answer “Who matters most to my cash?”

---

## 7. Projections Contract

### 7.1 Projection Definition

A Projection is a **recomputed future state** based on assumptions.

It must include:

- Base snapshot reference
- Time horizon
- Scenario label
- Assumptions
- Results
- Confidence band

Projections NEVER mutate state.

---

### 7.2 Projection Rules

- All assumptions are explicit
- No hidden heuristics
- Results must be explainable
- Projections may be deleted freely

---

## 8. Answerability Contract

Before answering any question, the system must evaluate **answerability**.

### Answerability Status

- ANSWERABLE
- PARTIAL
- NOT_ANSWERABLE

Each includes:

- Missing inputs
- Confidence score
- Required user actions

This prevents hallucination and builds trust.

---

## 9. Provenance & Traceability

Every derived number must be traceable to:

- Input events
- Formula identifier
- Formula version
- Exclusions
- Assumptions

Nothing may exist without provenance.

---

## 10. Change & Evolution Rules

The system must evolve safely.

Allowed:

- New event types
- New state sections
- New formulas
- New projections

Forbidden:

- Silent behavior changes
- Breaking historical answers
- Overwriting truth

All improvements must be additive.

---

## 11. Failure Conditions (Explicit)

The system is considered broken if:

- Numbers change without explanation
- AI generates calculations
- Assumptions are implicit
- State cannot be recomputed
- Users cannot understand why an answer exists

---

## 12. Canonical Doctrine Statement

> The Business State is FiskAI’s shared, evolving understanding of a business,  
> designed to make decisions safer, clearer, and more confident over time.

If a future decision contradicts this, it must be rejected.

---

## 13. Final Rule

If forced to choose between:

- being fast
- being impressive
- being correct
- being understandable

The system must always choose:

> **Understandable and evolvable over impressive.**

---

END OF CONTRACT
