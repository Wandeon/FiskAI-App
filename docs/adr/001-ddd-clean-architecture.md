# ADR-001: Domain-Driven Design with Clean Architecture

## Status

**Accepted** - Phase 8 Architecture Remediation Complete (2026-01-01)

## Context

FiskAI is a regulated financial system for Croatian businesses handling:

- Fiscalization (real-time tax reporting to Porezna Uprava)
- VAT calculations and reporting
- Invoice management with legal compliance requirements
- Banking reconciliation

The system requires:

1. **Correctness** - Financial calculations must be exact (no floating-point errors)
2. **Auditability** - All operations must be traceable
3. **Maintainability** - Complex business rules must be isolated and testable
4. **Regulatory Compliance** - Must adapt to changing Croatian tax law
5. **AI Safety** - Code must be structured so AI agents cannot introduce violations

## Decision

Adopt Domain-Driven Design (DDD) with Clean/Onion Architecture:

### Layer Structure

```
src/
├── domain/           # Pure business logic
├── application/      # Use cases
├── infrastructure/   # External services
└── interfaces/       # API routes
```

### Key Principles

1. **Pure Domain Layer**
   - No external dependencies (no Prisma, Next.js, or framework imports)
   - Business logic only, no I/O
   - Rich value objects (Money, VatRate, Quantity)
   - Aggregates with business verbs (Invoice.issue(), Invoice.cancel())

2. **Money as Value Object**
   - All monetary values use `Money` class backed by `Decimal.js`
   - No floats allowed in domain or application layers
   - Enforced by ESLint rules and CI checks

3. **Validation at Boundaries**
   - 100% Zod validation at all API routes
   - Fail-closed: invalid requests return structured errors
   - Domain assumes valid input (guards in constructors)

4. **Dependency Direction**
   - Domain depends on nothing
   - Application depends on domain only
   - Infrastructure implements domain interfaces
   - Interfaces depend on application

5. **Repository Pattern**
   - Domain defines repository interfaces
   - Infrastructure provides Prisma implementations
   - Use cases inject repositories (testable)

### Enforcement

- **ESLint** rules prevent cross-layer imports
- **CI architecture-check** job validates on every PR
- **TypeScript strict mode** with `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **Property-based tests** verify domain invariants
- **Golden tests** lock down XML output formats

## Consequences

### Positive

- **Correctness**: Money value object eliminates floating-point bugs
- **Testability**: Pure domain functions are trivial to unit test
- **Maintainability**: Business rules isolated from framework concerns
- **AI Safety**: ESLint + CI prevents AI from violating architecture
- **Regulatory Compliance**: Changes to tax law only affect domain layer

### Negative

- **Initial Complexity**: More files, more indirection
- **Learning Curve**: Team must understand DDD concepts
- **Migration Cost**: Existing code required phased remediation (Phases 0-8)

### Neutral

- **Performance**: No significant impact (value objects are lightweight)
- **Bundle Size**: Minimal increase from Decimal.js (~31KB gzipped)

## Alternatives Considered

1. **Keep Existing Structure** - Rejected due to accumulating technical debt and float bugs
2. **Hexagonal Architecture** - Similar to chosen approach, terminology preference
3. **CQRS/Event Sourcing** - Overkill for current scale, may revisit later

## References

- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design (Eric Evans)](https://www.domainlanguage.com/ddd/)
- [FiskAI Architecture Constitution](../plans/Architecture2/FiskAI_Architecture_Constitution.md)
- [FiskAI Correctness Standards](../plans/Architecture2/FiskAI_Correctness_and_Safety_Standards.md)

## Changelog

| Date       | Author                   | Change                               |
| ---------- | ------------------------ | ------------------------------------ |
| 2026-01-01 | Architecture Remediation | Initial ADR after Phase 8 completion |
