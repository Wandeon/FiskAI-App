# CI Failure Fix Plan

> Generated: 2026-01-03
> Total Failures: 260 TSC + 297 ESLint = 557

## Executive Summary

| Gate       | Current    | Target | Strategy                         |
| ---------- | ---------- | ------ | -------------------------------- |
| TypeScript | 260 errors | 0      | Fix by batch in dependency order |
| ESLint     | 297 errors | 0      | Auto-fix where possible          |
| Registry   | 0 failures | 0      | ✅ Already passing               |

## Batch 1: TypeScript Errors (260 total)

### 1.1 Missing `dbReg` Import (~60 errors)

**Root Cause:** RTL files reference `dbReg` without importing from `src/lib/db-regulatory.ts`

**Fix Pattern:**

```typescript
// Add at top of file:
import { dbReg } from "@/lib/db-regulatory"
```

**Affected Files (by subsystem):**

| Subsystem   | Files                                                                                                                                                                                                 | Errors |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| fetchers/   | eurlex-fetcher.ts, hnb-fetcher.ts, hok-fetcher.ts, mrms-fetcher.ts                                                                                                                                    | 20     |
| agents/     | asset-extractor.ts, claim-extractor.ts, comparison-extractor.ts, arbiter.ts, content-classifier.ts, multi-shape-extractor.ts, process-extractor.ts, reference-extractor.ts, transitional-extractor.ts | 10     |
| workers/    | continuous-drainer.worker.ts, continuous-pipeline.ts, evidence-embedding.worker.ts, orchestrator.worker.ts, sentinel.worker.ts                                                                        | 8      |
| e2e/        | data-repair.ts, invariant-validator.ts, live-runner.ts, synthetic-heartbeat.ts                                                                                                                        | 8      |
| scripts/    | backfill-content-class.ts, drain-pipeline.ts, test-content-cleaner.ts                                                                                                                                 | 5      |
| utils/      | authority.ts, content-provider.ts, coverage-metrics.ts, health-gates.ts                                                                                                                               | 9      |
| watchdog/   | health-monitors.ts, orchestrator.ts                                                                                                                                                                   | 3      |
| monitoring/ | metrics.ts                                                                                                                                                                                            | 2      |
| **tests**/  | fetcher-lifecycle.test.ts                                                                                                                                                                             | 3      |

**Execution:**

```bash
# Subagent task: Add dbReg import to all RTL files
```

---

### 1.2 Evidence/RegulatorySource Import from Wrong Schema (~8 errors)

**Root Cause:** Importing `Evidence`, `RegulatorySource` from `@prisma/client` instead of `@prisma/client-regulatory`

**Fix Pattern:**

```typescript
// BEFORE:
import { Evidence, RegulatorySource } from "@prisma/client"

// AFTER:
import { Evidence, RegulatorySource } from "@prisma/client-regulatory"
```

**Affected Files:**

- src/app/(admin)/regulatory/conflicts/conflicts-view.tsx (2 errors)
- src/app/(admin)/regulatory/sources/sources-view.tsx (2 errors)
- src/lib/regulatory-truth/scripts/content-bridge.ts (1 error)
- src/lib/regulatory-truth/utils/evidence-embedder.ts (3 errors)
- src/lib/regulatory-truth/workers/evidence-embedding.worker.ts (3 errors)

---

### 1.3 SourcePointer.evidence Relation Removed (~22 errors)

**Root Cause:** The FK relation `evidence` was removed from SourcePointer. Code uses `{ include: { evidence: true } }` which no longer works.

**Fix Pattern:**

```typescript
// BEFORE:
const pointer = await db.sourcePointer.findUnique({
  where: { id },
  include: { evidence: true },
})
const source = pointer.evidence.source

// AFTER:
const pointer = await db.sourcePointer.findUnique({ where: { id } })
const evidence = pointer.evidenceId
  ? await dbReg.evidence.findUnique({ where: { id: pointer.evidenceId } })
  : null
const source = evidence?.source
```

**Affected Files:**

- src/lib/regulatory-truth/agents/arbiter.ts (3 include errors + evidence access)
- src/lib/regulatory-truth/agents/composer.ts (2 errors)
- src/lib/regulatory-truth/agents/releaser.ts (1 error)
- src/lib/regulatory-truth/agents/reviewer.ts (1 error)
- src/lib/regulatory-truth/e2e/invariant-validator.ts (1 error)
- src/lib/regulatory-truth/scripts/backfill-pointer-offsets.ts (4 errors)
- src/lib/regulatory-truth/scripts/batch-review-drafts.ts (1 error)
- src/lib/regulatory-truth/services/embedding-service.ts (1 error)
- src/lib/regulatory-truth/services/rule-status-service.ts (1 error)
- src/lib/regulatory-truth/utils/evidence-strength.ts (3 errors)
- src/lib/regulatory-truth/utils/review-bundle.ts (1 error)
- src/lib/regulatory-truth/utils/rule-context.ts (1 error)
- src/lib/regulatory-truth/watchdog/audit.ts (1 error)
- src/app/(admin)/regulatory/conflicts/page.tsx (2 errors)

---

### 1.4 RegulatoryRule.sourcePointers Relation Removed (~18 errors)

**Root Cause:** The FK relation `sourcePointers` was removed from RegulatoryRule.

**Fix Pattern:**

```typescript
// BEFORE:
const rule = await db.regulatoryRule.findUnique({
  where: { id },
  include: { sourcePointers: true }
});
rule.sourcePointers.forEach(sp => ...);

// AFTER:
const rule = await db.regulatoryRule.findUnique({ where: { id } });
const sourcePointers = await db.sourcePointer.findMany({
  where: { rules: { some: { id: rule.id } } }
});
sourcePointers.forEach(sp => ...);
```

**Affected Files:**

- src/lib/regulatory-truth/agents/releaser.ts (6 errors)
- src/lib/regulatory-truth/agents/reviewer.ts (2 errors)
- src/lib/regulatory-truth/e2e/invariant-validator.ts (3 errors)
- src/lib/regulatory-truth/services/embedding-service.ts (2 errors)
- src/lib/regulatory-truth/services/rule-status-service.ts (2 errors)
- src/lib/regulatory-truth/utils/evidence-strength.ts (3 errors)
- src/lib/regulatory-truth/utils/review-bundle.ts (4 errors)
- src/lib/regulatory-truth/utils/rule-context.ts (3 errors)
- src/lib/regulatory-truth/watchdog/audit.ts (5 errors)
- src/lib/regulatory-truth/agents/extractor.ts (1 error - EvidenceWhereInput)

---

### 1.5 Conflict.itemA/itemB Relations Removed (~20 errors)

**Root Cause:** The FK relations `itemA` and `itemB` were removed from ConflictResolutionAudit. Only `itemAId` and `itemBId` remain.

**Fix Pattern:**

```typescript
// BEFORE:
conflict.itemA.extractedValue
conflict.itemB.extractedValue

// AFTER:
const itemA = await db.sourcePointer.findUnique({ where: { id: conflict.itemAId } })
const itemB = await db.sourcePointer.findUnique({ where: { id: conflict.itemBId } })
itemA.extractedValue
itemB.extractedValue
```

**Affected Files:**

- src/lib/regulatory-truth/agents/arbiter.ts (18 errors)
- src/app/(admin)/regulatory/conflicts/page.tsx (4 errors)

---

### 1.6 AppliedRuleSnapshot Missing from Schema (~8 errors)

**Root Cause:** `AppliedRuleSnapshot` model and related fields (`appliedRuleSnapshotId`) were removed from schema but code still references them.

**Fix Options:**

1. **Delete the code** if feature is deprecated
2. **Add model back to schema** if feature is needed
3. **Soft-reference pattern** - store snapshotId as string, query separately

**Affected Files:**

- src/lib/rules/applied-rule-snapshot-service.ts (2 errors)
- src/lib/rules/snapshot-reader.ts (4 errors)
- scripts/backfill-applied-rule-snapshots.ts (4 errors)
- src/lib/prisma-extensions.ts (6 errors referencing AppliedRuleSnapshot)

**Decision Required:** Is AppliedRuleSnapshot feature active? If not, delete the service files.

---

### 1.7 Evidence Type in prisma-extensions.ts (~12 errors)

**Root Cause:** `prisma-extensions.ts` has conditional logic checking for `Evidence` model which moved to regulatory schema.

**Fix Pattern:** Remove Evidence-specific handling from core db client extensions OR add separate extensions for dbReg.

**Affected Lines:**

- Line 2235, 2243, 2740, 3046, 3054, 3157, 3262, 3273 (Evidence/AppliedRuleSnapshot comparisons)

---

### 1.8 Type Mismatches (~25 errors)

**Categories:**

| Type Issue                   | Count | Files                                           |
| ---------------------------- | ----- | ----------------------------------------------- |
| `number` vs `Decimal`        | 12    | fiscal-pipeline.ts, xml-builder.test.ts, pos.ts |
| `number` vs `string`         | 8     | joppd-generator.test.ts, pdv-xml-generator.ts   |
| `JsonValue` vs specific type | 3     | artifacts/service.ts                            |
| Implicit `any`               | 15    | Various RTL files                               |

**Fix Pattern for Decimal:**

```typescript
// BEFORE:
const value: Decimal = 100

// AFTER:
import { Decimal } from "decimal.js"
const value = new Decimal(100)
```

---

### 1.9 Missing Dependencies (~2 errors)

**Package Missing:**

- `@radix-ui/react-checkbox` - Referenced in src/components/ui/checkbox.tsx

**Fix:**

```bash
npm install @radix-ui/react-checkbox
```

---

### 1.10 Test File Issues (~6 errors)

**Vitest `vi` not imported:**

- src/lib/banking/import/**tests**/import-parsed-determinism.test.ts
- src/lib/fixed-assets/**tests**/asset-candidates-determinism.test.ts

**Fix Pattern:**

```typescript
import { vi, describe, it, expect } from "vitest"
```

**Audit test issues:**

- src/lib/audit/**tests**/audit-correlation.test.ts
- src/lib/audit/**tests**/immutability-blocked.test.ts

---

## Batch 2: ESLint Errors (297 total)

Run after TSC passes:

```bash
npx eslint src --ext .ts,.tsx --fix
```

Then manually fix remaining errors.

---

## Execution Order

```
Batch 1.9 → 1.1 → 1.2 → 1.10 → 1.7 → 1.3 → 1.4 → 1.5 → 1.6 → 1.8 → Batch 2
```

**Rationale:**

1. **1.9** (deps) - Must install packages first
2. **1.1** (dbReg import) - Unblocks all RTL files
3. **1.2** (Evidence import) - Fixes type imports
4. **1.10** (test imports) - Quick wins
5. **1.7** (prisma-extensions) - Fixes core db client
6. **1.3-1.5** (relation removals) - Major refactoring
7. **1.6** (AppliedRuleSnapshot) - Needs decision
8. **1.8** (type mismatches) - Final cleanup

---

## Validation Commands

```bash
# After each batch:
npm run ci:quick

# After all batches:
npm run ci:full
```

---

## Files by Error Count (Top 20)

| File                                                | Errors | Primary Issue          |
| --------------------------------------------------- | ------ | ---------------------- |
| src/lib/regulatory-truth/agents/arbiter.ts          | 23     | itemA/itemB + evidence |
| src/lib/prisma-extensions.ts                        | 18     | Evidence type checks   |
| src/lib/regulatory-truth/agents/releaser.ts         | 11     | sourcePointers         |
| src/lib/regulatory-truth/fetchers/hok-fetcher.ts    | 12     | dbReg undefined        |
| src/lib/regulatory-truth/fetchers/mrms-fetcher.ts   | 8      | dbReg undefined        |
| src/lib/regulatory-truth/e2e/invariant-validator.ts | 8      | dbReg + sourcePointers |
| src/lib/regulatory-truth/utils/health-gates.ts      | 6      | dbReg undefined        |
| src/lib/regulatory-truth/utils/evidence-strength.ts | 6      | evidence include       |
| src/app/(admin)/regulatory/conflicts/page.tsx       | 6      | itemA/itemB + evidence |
| scripts/backfill-applied-rule-snapshots.ts          | 4      | appliedRuleSnapshotId  |
| src/lib/rules/snapshot-reader.ts                    | 5      | appliedRuleSnapshotId  |
| src/lib/fiscal/**tests**/xml-builder.test.ts        | 6      | Decimal types          |
| src/lib/reports/pdv-xml-generator.ts                | 6      | string/number types    |
