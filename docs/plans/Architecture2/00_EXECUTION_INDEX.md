# FiskAI Architecture Remediation - Execution Index

**Status:** VALIDATED AND READY
**Date:** 2025-01-01
**Total Documents:** 9

---

## Document Hierarchy

### Foundation Documents (Unchanged)

These documents define the target state and are architecturally sound:

1. **FiskAI_Architecture_Constitution.md** - Non-negotiable architectural laws
2. **FiskAI_Correctness_and_Safety_Standards.md** - What "correct" means
3. **FiskAI_CI_and_Enforcement_Specification.md** - How rules are enforced
4. **FiskAI_Migration_and_Execution_Plan.md** - Phase overview
5. **FiskAI_AI_Agent_Operating_Rules.md** - Rules for AI-generated code
6. **FiskAI_Reference_Implementation_Pack.md** - Canonical code patterns

### Execution Documents (New - Repo-Specific)

These documents adapt the foundation to the actual FiskAI codebase:

7. **VALIDATION_REPORT.md** - Gap analysis between documents and reality
8. **PHASE_0_IMPLEMENTATION.md** - Containment (stop new damage)
9. **PHASE_1_IMPLEMENTATION.md** - Domain Primitives (Money, Quantity, VatRate)
10. **PHASE_2_IMPLEMENTATION.md** - Vertical Slice: Invoice Aggregate
11. **PHASE_3_IMPLEMENTATION.md** - Fiscalization & Tax Domain
12. **PHASE_4_IMPLEMENTATION.md** - Banking & Reconciliation
13. **PHASE_5_IMPLEMENTATION.md** - Compliance & Identity
14. **PHASE_6_IMPLEMENTATION.md** - Validation Hardening (100% Zod)
15. **PHASE_7_IMPLEMENTATION.md** - Testing Expansion (Property + Golden)
16. **PHASE_8_IMPLEMENTATION.md** - Lock-Down (Final Enforcement)

---

## Current Codebase State Summary

| Metric                    | Target              | Current         | Gap          |
| ------------------------- | ------------------- | --------------- | ------------ |
| 4-Layer Architecture      | `src/domain/`, etc. | `src/lib/` only | **CRITICAL** |
| Money Value Object        | Yes                 | No              | **CRITICAL** |
| Float Money Operations    | 0                   | 505             | **CRITICAL** |
| Decimal.js Usage          | 100%                | 18 instances    | 3.5%         |
| Zod Validation Coverage   | 100%                | 23%             | 77% gap      |
| UI Components with DB     | 0                   | 23              | **HIGH**     |
| TypeScript Errors         | 0                   | 14              | Low          |
| TypeScript Blocking       | Yes                 | No              | **HIGH**     |
| Integration Tests         | Enabled             | Disabled        | **HIGH**     |
| ESLint Architecture Rules | Yes                 | No              | **HIGH**     |

---

## Execution Order

```
Phase 0: Containment
├── Create directory structure (domain/application/infrastructure/interfaces)
├── Fix 14 TypeScript errors
├── Make TypeScript blocking in CI
├── Add ESLint architecture firewall rules
├── Add async safety rules
├── Enable integration tests
└── Remove DB from 23 UI components

Phase 1: Domain Primitives
├── Create Money value object (decimal.js)
├── Create Quantity value object
├── Create VatRate value object
├── Create MoneyMapper
├── Create VatCalculator (domain)
├── Add property-based tests
└── Migrate fiscal-rules/service.ts

Phase 2: Vertical Slice (Invoice)
├── Create Invoice aggregate with state machine
├── Create InvoiceLine entity
├── Create use cases (CreateInvoice, IssueInvoice)
├── Create PrismaInvoiceRepository
└── Prove architecture end-to-end

Phase 3: Fiscalization & Tax
├── Create FiscalRequest domain entity
├── Create ZkiCalculator (pure domain)
├── Create VatBreakdown
├── Move XML building to infrastructure
├── Add golden tests for fiscal XML
└── Add VAT property tests

Phase 4: Banking & Reconciliation
├── Create BankTransaction domain entity
├── Create ReconciliationMatcher
├── Fix 25+ float violations in banking
├── Add import deduplication
└── Use Money everywhere

Phase 5: Compliance & Identity
├── Create Deadline domain
├── Create ComplianceStatus
├── Create Tenant entity
├── Create Permission model
└── Add authorization checks

Phase 6: Validation Hardening
├── Add Zod to all 237 API routes
├── Remove manual if (!x) validation
├── Standardize error responses
└── Create validation coverage metric

Phase 7: Testing Expansion
├── Property tests for Money (5+ invariants)
├── Property tests for VAT (4+ invariants)
├── Golden tests for fiscal/VAT XML
├── E2E tests for invoice flow
└── CI gates for test coverage

Phase 8: Lock-Down
├── Remove all legacy code
├── Flip warnings to errors
├── Single strict tsconfig
├── Architecture check CI job
└── CODEOWNERS configured
```

---

## Phase Exit Criteria Quick Reference

### Phase 0 Exit Criteria

- [ ] Directories: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/interfaces/`
- [ ] TypeScript errors: 0
- [ ] TypeScript CI: blocking
- [ ] Integration tests: enabled
- [ ] ESLint architecture rules: active
- [ ] UI DB imports: 0 (was 23)

### Phase 1 Exit Criteria

- [ ] Money value object: tested
- [ ] Quantity value object: tested
- [ ] VatRate value object: tested
- [ ] MoneyMapper: created
- [ ] VatCalculator: in domain
- [ ] Property tests: passing
- [ ] Float ban rule: active in domain/application
- [ ] fiscal-rules/service.ts: migrated

---

## AI Agent Quick Reference

When working on this codebase, AI agents MUST:

1. **Refuse** to add float money operations (`parseFloat`, `Number()`, `.toFixed()`)
2. **Refuse** to add DB imports to domain or application layers
3. **Refuse** to add business logic to UI components
4. **Always** use Money value object for monetary calculations
5. **Always** validate with Zod at boundaries
6. **Always** add tests when changing domain logic

See **FiskAI_AI_Agent_Operating_Rules.md** for complete rules.

---

## Next Steps

1. **Review** this index and the validation report
2. **Execute Phase 0** following PHASE_0_IMPLEMENTATION.md exactly
3. **Verify** exit criteria before moving to Phase 1
4. **Execute Phase 1** following PHASE_1_IMPLEMENTATION.md exactly
5. **Continue** with Phase 2+ as documented

---

**This completes the validated and repo-specific execution documentation.**
