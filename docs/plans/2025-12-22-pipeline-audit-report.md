# Pipeline Audit Report

**Date:** 2025-12-22
**Status:** Critical issues identified

## Executive Summary

The overnight pipeline run at 2025-12-22T13:48 revealed **11 domains failed composition** due to schema validation errors. The root cause is the `z.preprocess` for `applies_when` not executing correctly.

Additionally, **16 TypeScript errors** in the regulatory-truth module are preventing clean builds.

---

## Critical Failures (Blocking Pipeline)

### 1. Composer Schema Validation Failing

**Location:** `src/lib/regulatory-truth/schemas/composer.ts:28-31`

**Symptom:** LLM returns `applies_when` as object, z.preprocess should stringify it, but validation still fails with "expected string, received object".

**Affected domains:** doprinosi, rokovi, pdv, fiskalizacija, porez_dohodak (all 11 domains)

**Root cause analysis:**

- The z.preprocess is defined correctly
- However, Zod preprocess may fail silently if JSON.stringify throws
- The preprocess lacks error handling
- May also have issues with complex nested objects

**Fix required:**

```typescript
const appliesWhenSchema = z.preprocess((val) => {
  if (typeof val === "string") return val
  if (val === null || val === undefined) return ""
  try {
    return JSON.stringify(val)
  } catch {
    return String(val)
  }
}, z.string().min(1))
```

### 2. Missing Scheduler Exports

**Location:** `src/lib/regulatory-truth/scheduler/cron.ts`

**Symptom:** Build fails with "has no exported member" errors

**Missing exports:**

- `stopScheduler` - never defined
- `getSchedulerStatus` - never defined
- `triggerManualRun` - defined as `runManually` but not exported under correct name

**Affected files:**

- `src/lib/regulatory-truth/index.ts:76-78`
- `src/app/api/regulatory/status/route.ts:9`
- `src/app/api/regulatory/trigger/route.ts:45`

---

## Type Errors (Blocking Build)

### 3. Missing AuditAction Types

**Location:** `src/lib/regulatory-truth/utils/audit-log.ts:5-14`

**Missing values:**

- `CONFLICT_ESCALATED` (used in `arbiter.ts:175`)
- `CONCEPT_CREATED` (used in `knowledge-graph.ts:417`)

### 4. Nullable Type Mismatches

| File           | Line | Issue                                                                            |
| -------------- | ---- | -------------------------------------------------------------------------------- |
| `extractor.ts` | 87   | `display_value` can be null but field expects string                             |
| `arbiter.ts`   | 478  | `getPendingConflicts` return type says itemA/itemB required but they're nullable |
| `audit-log.ts` | 36   | `metadata` type mismatch with Prisma Json type                                   |

### 5. Bootstrap Script Type Errors

**Location:** `src/lib/regulatory-truth/scripts/bootstrap.ts`

**Issues:**

- Line 109: `SentinelResult` has no `evidenceId` property
- Line 128: `SentinelResult.error` should be `SentinelResult.errors`

### 6. Extractor Schema Default Issue

**Location:** `src/lib/regulatory-truth/schemas/extractor.ts:54`

**Issue:** `.default({})` on an object with `.optional()` causing type inference issues

---

## Recommended Fix Order

1. **HIGH** - Composer z.preprocess (blocking all rule creation)
2. **HIGH** - Scheduler exports (blocking status API and manual triggers)
3. **MEDIUM** - AuditAction types (blocking conflict escalation)
4. **MEDIUM** - Nullable type fixes (blocking clean build)
5. **LOW** - Bootstrap script fixes (demo script only)

---

## Test Commands

```bash
# Verify TypeScript
npx tsc --noEmit 2>&1 | grep regulatory-truth

# Test composer preprocess
node -e "const z = require('zod'); const s = z.preprocess(v => typeof v === 'object' ? JSON.stringify(v) : v, z.string()); console.log(s.safeParse({a:1}))"

# Run overnight pipeline (after fixes)
cd /home/admin/FiskAI && node scripts/run-overnight.ts
```

---

## Files to Modify

1. `src/lib/regulatory-truth/schemas/composer.ts` - Fix preprocess
2. `src/lib/regulatory-truth/scheduler/cron.ts` - Add missing exports
3. `src/lib/regulatory-truth/utils/audit-log.ts` - Add missing AuditAction types
4. `src/lib/regulatory-truth/agents/extractor.ts` - Handle nullable display_value
5. `src/lib/regulatory-truth/agents/arbiter.ts` - Fix return type of getPendingConflicts
6. `src/lib/regulatory-truth/scripts/bootstrap.ts` - Fix SentinelResult usage
7. `src/lib/regulatory-truth/schemas/extractor.ts` - Fix default type issue
