# P0 Operational Compliance Design

> **Status:** Approved
> **Date:** 2026-01-02
> **Approach:** Fix-Forward

## Overview

Architectural compliance is in place. This design addresses the remaining P0 gaps:

1. Pre-existing CI failures blocking merge credibility
2. Tenant isolation enforcement at runtime
3. Production acceptance tests for regulated flows

## Section 1: Integration Test Fix

**File:** `src/lib/regulatory-truth/__tests__/binary-parser.test.ts`

**Problem:** Imports from `vitest` but CI runs with `node --import tsx --test`.

**Solution:** Convert to node:test format.

**Import Changes:**

```typescript
// Before
import { describe, it, expect, beforeAll } from "vitest"

// After
import { describe, test, before } from "node:test"
import assert from "node:assert/strict"
```

**Mapping Rules:**

| Vitest                                 | node:test                                        |
| -------------------------------------- | ------------------------------------------------ |
| `it("...", ...)`                       | `test("...", ...)`                               |
| `beforeAll`                            | `before` (at top-level describe only)            |
| `expect(x).toBe(y)`                    | `assert.strictEqual(x, y)`                       |
| `expect(x).toEqual(y)`                 | `assert.deepStrictEqual(x, y)`                   |
| `expect(x).toContain(y)`               | `assert.ok(x.includes(y))`                       |
| `expect(x).toBeTruthy()`               | `assert.ok(x)`                                   |
| `await expect(p).rejects.toThrow(...)` | `await assert.rejects(async () => p, /pattern/)` |

**Verification:**

```bash
node --import tsx --test src/lib/regulatory-truth/__tests__/binary-parser.test.ts
```

---

## Section 2: Lint Ratchet

**Problem:** ~15 admin files have `no-explicit-any` errors. Mass-fix is risky.

**Solution:** Scoped ratchet freezing ceiling for legacy paths.

**Baseline file:** `.eslint-baseline.json`

```json
{
  "frozen": "2026-01-02",
  "eslintVersion": "9.x",
  "ratchets": [
    {
      "rule": "@typescript-eslint/no-explicit-any",
      "paths": ["src/app/(admin)/**/*.ts", "src/app/(admin)/**/*.tsx"],
      "ceiling": 23,
      "note": "Legacy admin files - tracked for reduction"
    }
  ]
}
```

**CI step:** (separate from normal lint job)

```yaml
- name: Lint ratchet check
  run: |
    set -euo pipefail

    npx eslint "src/app/(admin)/**/*.ts" "src/app/(admin)/**/*.tsx" \
      --format json \
      --output-file eslint-ratchet-report.json || true

    if [ ! -s eslint-ratchet-report.json ]; then
      echo "::error::ESLint produced no output"
      exit 1
    fi

    ANY_COUNT=$(jq '[.[].messages[] | select(.ruleId == "@typescript-eslint/no-explicit-any")] | length' eslint-ratchet-report.json)
    BASELINE=$(jq -r '.ratchets[] | select(.rule=="@typescript-eslint/no-explicit-any") | .ceiling' .eslint-baseline.json)

    if [ -z "$BASELINE" ]; then
      echo "::error::No baseline found for rule"
      exit 1
    fi

    if [ "$ANY_COUNT" -gt "$BASELINE" ]; then
      echo "::error::Lint ratchet FAILED: $ANY_COUNT > $BASELINE"
      exit 1
    fi

    echo "✅ Lint ratchet passed: $ANY_COUNT <= $BASELINE"
```

**Scoping:** Only `no-explicit-any`, only admin paths. `no-unused-vars` excluded (volatile).

---

## Section 3: Registry Compliance

**Problem:** 70 undeclared components. Can't flip to blocking while failing.

**Execution Sequence:**

1. **This PR:** Declare new outbox components with required metadata
2. **Next PR:** Bulk-declare remaining ~65 until `registry:check` passes
3. **Then:** Flip to blocking
4. **Then:** Add diff-based guard

**Metadata invariants:**

| Status     | Required Fields                                  |
| ---------- | ------------------------------------------------ |
| ACTIVE     | `owner`, `codeRef`, `docsRef`                    |
| DEPRECATED | `owner`, `codeRef`, `replacedBy` OR `sunsetDate` |

**Diff-based guard:**

```yaml
- name: Require registry for new components
  run: |
    set -euo pipefail
    git fetch origin main --depth=1

    NEW_COMPONENTS=$(git diff --name-only origin/main...HEAD | grep -E '(worker|queue|cron|jobs/).*\.ts$' || true)

    if [ -n "$NEW_COMPONENTS" ]; then
      REGISTRY_CHANGED=$(git diff --name-only origin/main...HEAD | grep -c 'src/lib/system-registry/registry.ts' || true)
      if [ "$REGISTRY_CHANGED" -eq 0 ]; then
        echo "::error::New component files require registry update:"
        echo "$NEW_COMPONENTS"
        exit 1
      fi
    fi
```

---

## Section 4: Tenant Isolation

**Problem:** Nothing prevents cross-tenant data access at runtime.

**Solution:** TenantScopedContext created per request, repositories enforce scope.

**TenantScopedContext:**

```typescript
export class TenantScopedContext {
  constructor(
    private readonly identity: TenantIdentity,
    private readonly _prisma: PrismaClient
  ) {}

  get companyId(): string {
    return this.identity.companyId
  }
  get userId(): string {
    return this.identity.userId
  }
  get prisma(): PrismaClient {
    return this._prisma
  }

  invoices(): PrismaInvoiceRepository {
    return new PrismaInvoiceRepository(this)
  }
}
```

**Repository enforcement:**

```typescript
export class PrismaInvoiceRepository {
  constructor(private readonly ctx: TenantScopedContext) {}

  async save(invoice: Invoice): Promise<void> {
    if (invoice.companyId !== this.ctx.companyId) {
      this.auditViolation("save", invoice) // never throws
      throw new TenantScopeMismatchError(...)
    }
    // Use this.ctx.prisma, not global prisma
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const record = await this.ctx.prisma.eInvoice.findFirst({
      where: { id: id.toString(), companyId: this.ctx.companyId }
    })
    return record ? this.toDomain(record) : null
  }

  private auditViolation(op: string, invoice: Invoice): void {
    // Best-effort logging - never throws
    try {
      logSecurityEvent({
        type: "TENANT_SCOPE_VIOLATION",
        actorUserId: this.ctx.userId,
        expectedCompanyId: this.ctx.companyId,
        actualCompanyId: invoice.companyId,
        aggregateType: "Invoice",
        aggregateId: invoice.id.toString(),
        operation: op
      })
    } catch { /* swallow */ }
  }
}
```

**Domain aggregates:** Expose canonical `companyId`, not business fields like `sellerId`.

**Behavior:**

- Reads: return `null` (prevents enumeration)
- Writes: throw + audit

---

## Section 5: Production Acceptance Tests

**Two-tier approach:**

### Tier 1: Deterministic Acceptance (Blocking, every PR)

Uses stubbed external systems, pinned XSDs, fixed fixtures.

**Fiscalization:**

```typescript
describe("Fiscalization Acceptance", () => {
  let stubServer: StubPoreznaServer

  before(async () => {
    // Ephemeral port
    stubServer = await StubPoreznaServer.start({ port: 0 })
  })

  test("fiscal submission flow", async () => {
    // Context with stub baseUrl
    const ctx = createTestContext({
      poreznaBaseUrl: stubServer.baseUrl
    })

    const useCase = new SubmitFiscalRequest(ctx)
    const result = await useCase.execute(...)

    // Verify through application boundary
    const stored = await ctx.fiscalSubmissions().findByInvoiceId(...)
    assert.strictEqual(stored?.jir, result.jir)
  })

  test("XML validates against pinned XSD", async () => {
    const xsd = await fs.readFile("fixtures/xsd/fiskal/v2024-01/RacunZahtjev.xsd")
    const result = validateXml(xml, xsd)
    assert.ok(result.valid)
  })
})
```

**VAT Report:** Pinned XSD, Money math (no floats).

**Reconciliation:** Deterministic fixtures with expected golden results.

### Tier 2: Sandbox Smoke (Nightly, non-blocking)

```yaml
smoke-tests:
  schedule:
    - cron: "0 3 * * *"
  steps:
    - run: npm run test:smoke || scripts/alert-smoke-failure.sh
```

**XSD Management:**

```
fixtures/xsd/
├── fiskal/v2024-01/
│   ├── RacunZahtjev.xsd
│   └── PROVENANCE.md
├── pdv-s/v2025-01/
│   └── PDV-S.xsd
```

**Requirements:**

- Pin XSD validation library in package.json
- PoreznaClient.baseUrl injected from context
- Seeded test DB with transaction rollback isolation

---

## Implementation Order

1. Convert binary-parser.test.ts to node:test
2. Create .eslint-baseline.json + ratchet CI step
3. Declare outbox components in registry
4. Implement TenantScopedContext + repository enforcement
5. Add tenant isolation tests
6. Create acceptance test fixtures + stubbed servers
7. Add acceptance CI job
8. Bulk-declare remaining registry components
9. Flip registry to blocking + add diff guard
10. Add smoke test job (nightly)

---

_Approved via brainstorming session 2026-01-02_
