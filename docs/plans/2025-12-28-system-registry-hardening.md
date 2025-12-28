# System Registry Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the System Registry so observation and governance cannot be bypassed via CI scope gaps, invalid owners, or harvester blind spots.

**Architecture:** Tighten enforcement rules and owner validation in drift computation, harden harvesters for deterministic coverage with explicit exclusions, and make CI fail on any harvester error. Close repo bypasses by expanding CI scope and CODEOWNERS coverage for registry-critical files.

**Tech Stack:** TypeScript, Node.js test runner (`node:test` + `tsx`), GitHub Actions.

**Skills:** @superpowers:test-driven-development

---

### Task 1: Enforcement Tests (Owner Validity + Route Group Coverage)

**Files:**
- Create: `src/lib/__tests__/system-registry-enforcement.test.ts`
- Modify (later): `src/lib/system-registry/compute-drift.ts`
- Modify (later): `src/lib/system-registry/schema.ts`

**Step 1: Write the failing test**

```ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeDrift, enforceRules } from "../system-registry/compute-drift"

describe("System Registry enforcement", () => {
  it("treats invalid owners as missing owners for CRITICAL components", () => {
    const observed = [
      {
        componentId: "module-test",
        type: "MODULE",
        name: "Test Module",
        observedAt: ["src/lib/test"],
        discoveryMethod: "directory-exists",
      },
    ]
    const declared = [
      {
        componentId: "module-test",
        type: "MODULE",
        name: "Test Module",
        status: "STABLE",
        criticality: "CRITICAL",
        owner: "team:not-real",
        docsRef: "docs/README.md",
        codeRef: "src",
        dependencies: [],
      },
    ]

    const drift = computeDrift(observed, declared, process.cwd())
    const gaps = drift.metadataGaps.find((g) => g.componentId === "module-test")

    assert.ok(gaps)
    assert.ok(gaps?.gaps?.includes("NO_OWNER"))

    const enforcement = enforceRules(drift)
    assert.ok(enforcement.failures.some((f) => f.componentId === "module-test"))
  })

  it("fails when ANY observed route group is not declared", () => {
    const observed = [
      {
        componentId: "route-group-foo",
        type: "ROUTE_GROUP",
        name: "Foo API",
        observedAt: ["src/app/api/foo"],
        discoveryMethod: "route-scan",
      },
    ]
    const declared: any[] = []

    const drift = computeDrift(observed, declared, process.cwd())
    const enforcement = enforceRules(drift)

    assert.ok(enforcement.failures.some((f) => f.componentId === "route-group-foo"))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/system-registry-enforcement.test.ts`  
Expected: FAIL (invalid owner not treated as missing; route-group rule not enforced for MEDIUM)

**Step 3: Write minimal implementation**

Implement in `src/lib/system-registry/compute-drift.ts` and `src/lib/system-registry/schema.ts` per Tasks 2.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/system-registry-enforcement.test.ts`  
Expected: PASS

---

### Task 2: Enforcement Implementation (Owner Validity + Route Group Coverage)

**Files:**
- Modify: `src/lib/system-registry/compute-drift.ts`
- Modify: `src/lib/system-registry/schema.ts`

**Step 1: Update enforcement rule for route groups**

In `src/lib/system-registry/schema.ts`, change ROUTE_GROUP rule to cover all criticalities:

```ts
{
  types: ["ROUTE_GROUP"],
  criticalities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
  check: "MUST_BE_DECLARED",
  action: "FAIL",
  description: "All API route groups must be declared in registry",
},
```

**Step 2: Enforce owner validity in drift**

In `src/lib/system-registry/compute-drift.ts`:
- Treat invalid owners as missing owners (add `NO_OWNER` gap)
- Record invalid owners in a dedicated list for reporting (optional but recommended)

Minimal code shape:

```ts
if (decl.owner) {
  const ownerValidation = validateOwner(decl.owner)
  if (!ownerValidation.valid) {
    invalidOwners.push({ componentId: decl.componentId, owner: decl.owner })
  }
  if (ownerValidation.deprecated) { /* existing behavior */ }
}

const ownerMissing = !decl.owner || (decl.owner && !ownerValidation?.valid)
if (ownerMissing && (decl.criticality === "CRITICAL" || decl.criticality === "HIGH")) {
  gaps.push("NO_OWNER")
}
```

**Step 3: Run enforcement test**

Run: `node --import tsx --test src/lib/__tests__/system-registry-enforcement.test.ts`  
Expected: PASS

---

### Task 3: Queue Harvester Tests (Full Scan + Constructor Guard)

**Files:**
- Create: `src/lib/__tests__/system-registry-queues.test.ts`
- Modify (later): `src/lib/system-registry/harvesters/harvest-queues.ts`
- Modify (later): `src/lib/system-registry/governance.ts`

**Step 1: Write the failing test**

```ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestQueues } from "../system-registry/harvesters/harvest-queues"

describe("Queue harvester", () => {
  it("detects queues in any .ts file, not just queue-named files", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-queues-"))
    const libDir = join(root, "src/lib")
    mkdirSync(libDir, { recursive: true })
    writeFileSync(join(libDir, "alpha.ts"), "createQueue('alpha')", "utf8")

    const result = await harvestQueues(root)
    assert.ok(result.components.some((c) => c.componentId === "queue-alpha"))
  })

  it("flags new Queue usage outside allowed factory files", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-queues-"))
    const libDir = join(root, "src/lib")
    mkdirSync(libDir, { recursive: true })
    writeFileSync(join(libDir, "beta.ts"), "new Queue('beta')", "utf8")

    const result = await harvestQueues(root)
    assert.ok(result.errors.length > 0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/system-registry-queues.test.ts`  
Expected: FAIL (no queue detected in alpha.ts; no errors for beta.ts)

---

### Task 4: Queue Harvester Implementation (Full Scan + Constructor Guard)

**Files:**
- Modify: `src/lib/system-registry/harvesters/harvest-queues.ts`
- Modify: `src/lib/system-registry/governance.ts`

**Step 1: Add allowed queue-constructor allowlist**

In `src/lib/system-registry/governance.ts`, add:

```ts
export const ALLOWED_QUEUE_CONSTRUCTOR_PATHS = [
  "src/lib/regulatory-truth/workers/queues.ts",
] as const
```

**Step 2: Scan all .ts/.tsx files under src/lib**

In `harvest-queues.ts`:
- Always scan `src/lib` recursively (no filename filter)
- Sort file list for deterministic ordering
- Add a scan cap; if exceeded, push a non-recoverable error

**Step 3: Enforce queue constructor location**

In `harvest-queues.ts`:
- For each scanned file, if `new Queue(` appears and file not in allowlist, add a harvester error.

**Step 4: Run queue tests**

Run: `node --import tsx --test src/lib/__tests__/system-registry-queues.test.ts`  
Expected: PASS

---

### Task 5: Worker Harvester Tests (Full Enumeration + Exclusions)

**Files:**
- Create: `src/lib/__tests__/system-registry-workers.test.ts`
- Modify (later): `src/lib/system-registry/harvesters/harvest-workers.ts`
- Modify (later): `src/lib/system-registry/governance.ts`

**Step 1: Write the failing test**

```ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestWorkers } from "../system-registry/harvesters/harvest-workers"

describe("Worker harvester", () => {
  it("enumerates all compose services except governed exclusions", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-workers-"))
    const compose = [
      "services:",
      "  redis:",
      "    image: redis:7",
      "  api-service:",
      "    image: busybox",
      "  worker-foo:",
      "    image: busybox",
    ].join(\"\\n\")
    writeFileSync(join(root, "docker-compose.workers.yml"), compose, "utf8")

    const result = await harvestWorkers(root)
    const ids = result.components.map((c) => c.componentId)

    assert.ok(ids.includes("worker-api-service"))
    assert.ok(ids.includes("worker-foo"))
    assert.ok(!ids.includes("worker-redis"))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/system-registry-workers.test.ts`  
Expected: FAIL (api-service not detected)

---

### Task 6: Worker Harvester Implementation (Exclusions + Enumeration)

**Files:**
- Modify: `src/lib/system-registry/harvesters/harvest-workers.ts`
- Modify: `src/lib/system-registry/governance.ts`

**Step 1: Add governed worker exclusions**

Add to `governance.ts`:

```ts
export const WORKER_SERVICE_EXCLUSIONS: ExclusionEntry[] = [
  {
    name: "redis",
    reason: "Shared Redis service (store), not a worker process",
    owner: "team:platform",
    expiresAt: "2026-03-15",
    issueLink: "https://github.com/Wandeon/FiskAI/issues/<id>",
  },
]
```

Also extend `validateGovernance()` to validate this list.

**Step 2: Enumerate all compose services**

In `harvest-workers.ts`:
- Remove name-based filtering
- Skip services listed in `WORKER_SERVICE_EXCLUSIONS`
- Keep the existing name normalization (`fiskai-` and `worker-` prefixes)

**Step 3: Run worker tests**

Run: `node --import tsx --test src/lib/__tests__/system-registry-workers.test.ts`  
Expected: PASS

---

### Task 7: Harvester Error Tests (Scan Caps + Registry Check)

**Files:**
- Create: `src/lib/__tests__/system-registry-harvester-errors.test.ts`
- Modify (later): `src/lib/system-registry/harvesters/harvest-libs.ts`
- Create (later): `src/lib/system-registry/scripts/registry-check-utils.ts`

**Step 1: Write the failing test**

```ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestLibs } from "../system-registry/harvesters/harvest-libs"
import { shouldFailRegistryCheck } from "../system-registry/scripts/registry-check-utils"

describe("Harvester error handling", () => {
  it("flags scan-cap overflow in lib harvesting", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-libs-"))
    const libDir = join(root, "src/lib/biglib")
    mkdirSync(libDir, { recursive: true })
    for (let i = 0; i < 200; i++) {
      writeFileSync(join(libDir, `file-${i}.ts`), "export const x = 1", "utf8")
    }

    const result = await harvestLibs(root)
    assert.ok(result.errors.length > 0)
  })

  it("fails registry-check when harvester errors exist", () => {
    const failed = shouldFailRegistryCheck({
      harvesterErrors: [{ path: "x", message: "err", recoverable: false }],
      enforcement: { passed: true, failures: [], warnings: [] },
      failOnWarn: false,
    })
    assert.equal(failed, true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/system-registry-harvester-errors.test.ts`  
Expected: FAIL (no scan-cap error; helper not implemented)

---

### Task 8: Harvester Error Implementation (Scan Caps + CI Failure)

**Files:**
- Modify: `src/lib/system-registry/harvesters/harvest-libs.ts`
- Create: `src/lib/system-registry/scripts/registry-check-utils.ts`
- Modify: `src/lib/system-registry/scripts/registry-check.ts`

**Step 1: Add scan-cap error reporting to harvest-libs**

Implement a scan-state object that sets `hitLimit`/`error` flags, and push a non-recoverable error if either is hit.

**Step 2: Add registry-check failure helper**

Create:

```ts
export function shouldFailRegistryCheck({
  harvesterErrors,
  enforcement,
  failOnWarn,
}: {
  harvesterErrors: { path: string; message: string; recoverable: boolean }[]
  enforcement: { passed: boolean; failures: unknown[]; warnings: unknown[] }
  failOnWarn: boolean
}) {
  if (harvesterErrors.length > 0) return true
  if (failOnWarn) return !enforcement.passed || enforcement.warnings.length > 0
  return !enforcement.passed
}
```

**Step 3: Wire helper into registry-check**

In `registry-check.ts`, replace the final `failed` calculation with the helper and log harvester errors before exit.

**Step 4: Run harvester error tests**

Run: `node --import tsx --test src/lib/__tests__/system-registry-harvester-errors.test.ts`  
Expected: PASS

---

### Task 9: Close Repo-Level Bypasses (CODEOWNERS + CI Scope)

**Files:**
- Modify: `.github/CODEOWNERS`
- Modify: `.github/workflows/registry-check.yml`

**Step 1: Protect canonical registry + enforcement entry points**

Add explicit CODEOWNERS entries:

```
/src/lib/system-registry/declarations.ts  @fiskai/platform @fiskai/security
/package.json                            @fiskai/platform @fiskai/security
/.github/workflows/registry-check.yml    @fiskai/platform @fiskai/security
```

**Step 2: Run registry check on all PRs**

Remove path filters in `.github/workflows/registry-check.yml` so it runs on every PR and push to `main`.

**Step 3: (Manual) Require status check in branch protection**

Document that `System Registry Check` must be required in branch protection.

---

### Task 10: Full Test Run

Run: `node --import tsx --test src/lib/__tests__/system-registry-*.test.ts`  
Expected: PASS

---

**Plan complete and saved to `docs/plans/2025-12-28-system-registry-hardening.md`. Two execution options:**

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
