# Docker Worker Infrastructure Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent stale worker deployments, reduce image bloat, and establish version enforcement so the December 2024 incident cannot recur.

**Architecture:** Split worker images (base vs OCR), compile TypeScript to JavaScript at build time, implement runtime version drift detection via Redis, and centralize kill switch logic in the drainer.

**Tech Stack:** Docker multi-stage builds, Node.js 20, TypeScript compilation, BullMQ, Redis version tracking

---

## Inspection Summary (Completed)

**Current State:**
- Workers run via `npx tsx` (runtime transpilation, no compilation)
- `Dockerfile.worker` installs OCR deps (tesseract, poppler, ghostscript) in ALL worker images
- Base image is `node:22-alpine` (should be Node 20 for stability)
- BullMQ uses factory pattern with shared prefix `"fiskai"` via `BULLMQ_PREFIX`
- OLLAMA env vars already split: `OLLAMA_EXTRACT_*` (cloud), `OLLAMA_EMBED_*` (local)
- No version enforcement mechanism exists
- No worker healthchecks (correct - workers don't expose HTTP)

**Key Files:**
- `Dockerfile.worker` - Multi-stage build, installs OCR deps to all images
- `docker-compose.workers.yml` - Worker service definitions
- `src/lib/regulatory-truth/workers/base.ts` - BullMQ worker factory
- `src/lib/regulatory-truth/workers/queues.ts` - BullMQ queue factory
- `src/lib/regulatory-truth/workers/redis.ts` - Redis connection management

---

## Task 1: Pin Node 20 Base Image with Digest

**Files:**
- Modify: `Dockerfile.worker:4`

**Step 1: Get current Node 20 Alpine digest**

Run: `docker pull node:20-alpine && docker inspect node:20-alpine --format='{{index .RepoDigests 0}}'`

Expected: Something like `node@sha256:abc123...`

**Step 2: Update Dockerfile base image**

```dockerfile
# Dockerfile.worker line 4
# Before:
FROM node:22-alpine AS base

# After (use actual digest from step 1):
FROM node:20-alpine@sha256:a18eb831fc7bfe3b2ee1b68e4f8ace8acbe5186b72974e6573afd6d96ad8b6df AS base
```

**Step 3: Verify build works**

Run: `docker build -f Dockerfile.worker -t test-node20 --target base .`
Expected: Build succeeds with Node 20

**Step 4: Commit**

```bash
git add Dockerfile.worker
git commit -m "fix: pin Node 20 Alpine base image with digest"
```

---

## Task 2: Add Build Args for Version Tracking

**Files:**
- Modify: `Dockerfile.worker:1-10`

**Step 1: Add build args to Dockerfile**

```dockerfile
# Dockerfile.worker - add after line 1
# Worker image - runs compiled JavaScript

FROM node:20-alpine@sha256:a18eb831fc7bfe3b2ee1b68e4f8ace8acbe5186b72974e6573afd6d96ad8b6df AS base

# Build args for version tracking (set by CI/deploy)
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
```

**Step 2: Bake version info into runner stage**

Add after the `FROM base AS runner` line (around line 29):

```dockerfile
# Bake version info into image
ARG GIT_SHA
ARG BUILD_DATE
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}
```

**Step 3: Test build with args**

Run: `docker build -f Dockerfile.worker --build-arg GIT_SHA=$(git rev-parse HEAD) --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t test-version .`

Expected: Build succeeds

**Step 4: Verify env vars in image**

Run: `docker run --rm test-version printenv GIT_SHA`
Expected: Current git SHA

**Step 5: Commit**

```bash
git add Dockerfile.worker
git commit -m "feat: add GIT_SHA and BUILD_DATE build args to worker image"
```

---

## Task 3: Split Dockerfile into Base and OCR Variants

**Files:**
- Modify: `Dockerfile.worker` (rename OCR section, add build arg)

**Step 1: Add WITH_OCR build arg**

```dockerfile
# After the ARG GIT_SHA line, add:
ARG WITH_OCR=false
```

**Step 2: Make OCR deps conditional in runner stage**

Replace the current OCR installation block (lines 35-43) with:

```dockerfile
# ========== OCR DEPENDENCIES (conditional) ==========
ARG WITH_OCR
RUN if [ "$WITH_OCR" = "true" ]; then \
    apk add --no-cache \
        tesseract-ocr \
        tesseract-ocr-data-hrv \
        tesseract-ocr-data-eng \
        poppler-utils \
        ghostscript; \
    fi
# ====================================================
```

**Step 3: Test build without OCR**

Run: `docker build -f Dockerfile.worker --build-arg WITH_OCR=false -t test-no-ocr .`
Expected: Build succeeds, smaller image

**Step 4: Test build with OCR**

Run: `docker build -f Dockerfile.worker --build-arg WITH_OCR=true -t test-with-ocr .`
Expected: Build succeeds, tesseract available

**Step 5: Verify OCR not in base image**

Run: `docker run --rm test-no-ocr which tesseract`
Expected: No output or error (tesseract not found)

Run: `docker run --rm test-with-ocr which tesseract`
Expected: `/usr/bin/tesseract`

**Step 6: Compare image sizes**

Run: `docker images | grep test-`
Expected: `test-no-ocr` should be ~50-100MB smaller than `test-with-ocr`

**Step 7: Commit**

```bash
git add Dockerfile.worker
git commit -m "feat: make OCR deps conditional via WITH_OCR build arg"
```

---

## Task 4: Add Worker Build Script

**Files:**
- Create: `scripts/build-workers.sh`

**Step 1: Create build script**

```bash
#!/bin/bash
# scripts/build-workers.sh
# Build worker images with proper tagging and version info

set -e

GIT_SHA=$(git rev-parse HEAD)
GIT_SHA_SHORT=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REGISTRY=${REGISTRY:-""}  # Optional registry prefix

echo "Building worker images..."
echo "  GIT_SHA: $GIT_SHA"
echo "  BUILD_DATE: $BUILD_DATE"

# Build base worker (no OCR)
echo ""
echo "=== Building base worker image ==="
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=false \
  -t "${REGISTRY}fiskai-worker:${GIT_SHA_SHORT}" \
  -t "${REGISTRY}fiskai-worker:latest" \
  .

# Build OCR worker
echo ""
echo "=== Building OCR worker image ==="
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=true \
  -t "${REGISTRY}fiskai-worker-ocr:${GIT_SHA_SHORT}" \
  -t "${REGISTRY}fiskai-worker-ocr:latest" \
  .

echo ""
echo "=== Build complete ==="
docker images | grep fiskai-worker | head -5
```

**Step 2: Make executable**

Run: `chmod +x scripts/build-workers.sh`

**Step 3: Test build script**

Run: `./scripts/build-workers.sh`
Expected: Both images built with SHA tags

**Step 4: Commit**

```bash
git add scripts/build-workers.sh
git commit -m "feat: add worker image build script with version tagging"
```

---

## Task 5: Compile Workers to JavaScript

**Files:**
- Create: `tsconfig.workers.json`
- Modify: `package.json` (add build:workers script)

**Step 1: Create workers tsconfig**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/workers",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": false,
    "sourceMap": true
  },
  "include": [
    "src/lib/regulatory-truth/workers/**/*.ts",
    "src/lib/regulatory-truth/agents/**/*.ts",
    "src/lib/regulatory-truth/utils/**/*.ts",
    "src/lib/db/**/*.ts"
  ],
  "exclude": [
    "**/*.test.ts",
    "**/__tests__/**"
  ]
}
```

**Step 2: Add build script to package.json**

Add to `scripts` section:
```json
"build:workers": "tsc -p tsconfig.workers.json"
```

**Step 3: Test compilation**

Run: `npm run build:workers`
Expected: Compiles without errors, creates `dist/workers/`

**Step 4: Verify compiled output**

Run: `ls dist/workers/lib/regulatory-truth/workers/`
Expected: `.js` and `.js.map` files for each worker

**Step 5: Test running compiled worker**

Run: `node dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js`
Expected: Worker starts (may fail on Redis connection, that's OK)

**Step 6: Commit**

```bash
git add tsconfig.workers.json package.json
git commit -m "feat: add TypeScript compilation for workers"
```

---

## Task 6: Update Dockerfile to Compile Workers

**Files:**
- Modify: `Dockerfile.worker` (builder stage)

**Step 1: Add compilation step to builder stage**

In the builder stage, after `COPY . .`, replace the tsc --noEmit line:

```dockerfile
# Before:
RUN npx tsc --noEmit --skipLibCheck || true

# After:
# Compile workers to JavaScript
RUN npm run build:workers
```

**Step 2: Copy compiled workers in runner stage**

Replace the src copy line:

```dockerfile
# Before:
COPY --from=builder --chown=worker:nodejs /app/src ./src

# After:
COPY --from=builder --chown=worker:nodejs /app/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/src ./src
```

**Step 3: Update default CMD**

```dockerfile
# Before:
CMD ["npx", "tsx", "src/lib/regulatory-truth/workers/orchestrator.worker.ts"]

# After:
CMD ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]
```

**Step 4: Test build**

Run: `docker build -f Dockerfile.worker --build-arg WITH_OCR=false -t test-compiled .`
Expected: Build succeeds

**Step 5: Verify compiled workers in image**

Run: `docker run --rm test-compiled ls dist/workers/lib/regulatory-truth/workers/`
Expected: List of `.js` files

**Step 6: Commit**

```bash
git add Dockerfile.worker
git commit -m "feat: compile workers to JS at build time, run with node"
```

---

## Task 7: Update docker-compose.workers.yml Commands

**Files:**
- Modify: `docker-compose.workers.yml` (all worker services)

**Step 1: Update all worker commands from tsx to node**

For each worker service, change the command. Example for orchestrator:

```yaml
# Before:
command: ["npx", "tsx", "src/lib/regulatory-truth/workers/orchestrator.worker.ts"]

# After:
command: ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]
```

**Step 2: Update all workers**

Apply the same pattern to ALL workers:
- `worker-orchestrator` → `dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js`
- `worker-sentinel` → `dist/workers/lib/regulatory-truth/workers/sentinel.worker.js`
- `worker-extractor` → `dist/workers/lib/regulatory-truth/workers/extractor.worker.js`
- `worker-ocr` → `dist/workers/lib/regulatory-truth/workers/ocr.worker.js`
- `worker-composer` → `dist/workers/lib/regulatory-truth/workers/composer.worker.js`
- `worker-reviewer` → `dist/workers/lib/regulatory-truth/workers/reviewer.worker.js`
- `worker-arbiter` → `dist/workers/lib/regulatory-truth/workers/arbiter.worker.js`
- `worker-releaser` → `dist/workers/lib/regulatory-truth/workers/releaser.worker.js`
- `worker-continuous-drainer` → `dist/workers/lib/regulatory-truth/workers/continuous-drainer.worker.js`
- `worker-content-sync` → `dist/workers/lib/regulatory-truth/workers/content-sync.worker.js`
- `worker-article` → `dist/workers/lib/regulatory-truth/workers/article.worker.js`
- `worker-evidence-embedding` → `dist/workers/lib/regulatory-truth/workers/evidence-embedding.worker.js`
- `worker-embedding` → `dist/workers/lib/regulatory-truth/workers/embedding.worker.js`
- `worker-einvoice-inbound` → (different path, check actual location)

**Step 3: Update OCR worker to use OCR image**

```yaml
worker-ocr:
  build:
    context: .
    dockerfile: Dockerfile.worker
    args:
      GIT_SHA: ${GIT_SHA:-unknown}
      BUILD_DATE: ${BUILD_DATE:-unknown}
      WITH_OCR: "true"  # OCR worker needs tesseract
```

**Step 4: Update other workers to use base image (no OCR)**

```yaml
worker-extractor:
  build:
    context: .
    dockerfile: Dockerfile.worker
    args:
      GIT_SHA: ${GIT_SHA:-unknown}
      BUILD_DATE: ${BUILD_DATE:-unknown}
      WITH_OCR: "false"  # No OCR needed
```

**Step 5: Add GIT_SHA to all worker environments**

Add to each worker's environment section:
```yaml
environment:
  # ... existing vars ...
  - GIT_SHA=${GIT_SHA:-unknown}
```

**Step 6: Commit**

```bash
git add docker-compose.workers.yml
git commit -m "feat: run compiled JS workers, split OCR/base images"
```

---

## Task 8: Implement Runtime Version Enforcement (Hard Guard)

**Files:**
- Create: `src/lib/regulatory-truth/workers/utils/version-guard.ts`

**CRITICAL:** This guard runs BEFORE Redis connection and hard-fails on version mismatch.

**Step 1: Write the failing test**

Create: `src/lib/regulatory-truth/workers/__tests__/version-guard.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("version-guard", () => {
  const originalEnv = process.env
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called")
  })

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    mockExit.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("getVersionInfo", () => {
    it("returns version info from environment", async () => {
      process.env.GIT_SHA = "abc123"
      process.env.BUILD_DATE = "2026-01-07T12:00:00Z"
      process.env.WORKER_TYPE = "extractor"

      const { getVersionInfo } = await import("../utils/version-guard")
      const info = getVersionInfo()

      expect(info.gitSha).toBe("abc123")
      expect(info.buildDate).toBe("2026-01-07T12:00:00Z")
      expect(info.workerType).toBe("extractor")
    })
  })

  describe("assertVersionGuard", () => {
    it("passes when GIT_SHA matches EXPECTED_GIT_SHA", async () => {
      process.env.NODE_ENV = "production"
      process.env.GIT_SHA = "abc123"
      process.env.EXPECTED_GIT_SHA = "abc123"

      const { assertVersionGuard } = await import("../utils/version-guard")
      expect(() => assertVersionGuard()).not.toThrow()
    })

    it("crashes when GIT_SHA does not match EXPECTED_GIT_SHA", async () => {
      process.env.NODE_ENV = "production"
      process.env.GIT_SHA = "abc123"
      process.env.EXPECTED_GIT_SHA = "def456"

      const { assertVersionGuard } = await import("../utils/version-guard")
      expect(() => assertVersionGuard()).toThrow("process.exit called")
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it("crashes when GIT_SHA is unknown in production", async () => {
      process.env.NODE_ENV = "production"
      process.env.GIT_SHA = "unknown"
      delete process.env.EXPECTED_GIT_SHA

      const { assertVersionGuard } = await import("../utils/version-guard")
      expect(() => assertVersionGuard()).toThrow("process.exit called")
    })

    it("passes in development even with mismatch", async () => {
      process.env.NODE_ENV = "development"
      process.env.GIT_SHA = "abc123"
      process.env.EXPECTED_GIT_SHA = "def456"

      const { assertVersionGuard } = await import("../utils/version-guard")
      expect(() => assertVersionGuard()).not.toThrow()
    })
  })

  describe("assertNotTsx", () => {
    it("crashes if tsx detected in production", async () => {
      process.env.NODE_ENV = "production"
      const originalArgv = process.argv
      process.argv = ["node", "tsx", "worker.ts"]

      const { assertNotTsx } = await import("../utils/version-guard")
      expect(() => assertNotTsx()).toThrow("process.exit called")

      process.argv = originalArgv
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/regulatory-truth/workers/__tests__/version-guard.test.ts`
Expected: FAIL with "Cannot find module '../utils/version-guard'"

**Step 3: Implement version-guard.ts (Hard Guard)**

Create: `src/lib/regulatory-truth/workers/utils/version-guard.ts`

```typescript
// src/lib/regulatory-truth/workers/utils/version-guard.ts
// CRITICAL: This runs BEFORE Redis connection - no external dependencies

export interface VersionInfo {
  gitSha: string
  buildDate: string
  workerType: string
  expectedSha: string | undefined
  startedAt: string
}

/**
 * Get version info from environment variables (baked into Docker image)
 */
export function getVersionInfo(): VersionInfo {
  return {
    gitSha: process.env.GIT_SHA || "unknown",
    buildDate: process.env.BUILD_DATE || "unknown",
    workerType: process.env.WORKER_TYPE || "unknown",
    expectedSha: process.env.EXPECTED_GIT_SHA,
    startedAt: new Date().toISOString(),
  }
}

/**
 * HARD GUARD: Assert version matches expected in production
 * This MUST run before ANY other initialization (including Redis)
 *
 * Rules:
 * 1. If NODE_ENV=production and EXPECTED_GIT_SHA is set:
 *    - GIT_SHA must exist and must equal EXPECTED_GIT_SHA
 *    - Otherwise: exit(1) immediately
 * 2. If NODE_ENV=production and GIT_SHA is "unknown":
 *    - exit(1) immediately (image built without version info)
 * 3. In development: warn but don't crash
 */
export function assertVersionGuard(): void {
  const info = getVersionInfo()
  const isProduction = process.env.NODE_ENV === "production"

  console.log(`[version] Worker: ${info.workerType}`)
  console.log(`[version] GIT_SHA: ${info.gitSha}`)
  console.log(`[version] EXPECTED_GIT_SHA: ${info.expectedSha || "(not set)"}`)

  if (!isProduction) {
    // Development: warn but allow
    if (info.expectedSha && info.gitSha !== info.expectedSha) {
      console.warn(`[version] WARNING: SHA mismatch in development`)
    }
    return
  }

  // Production checks
  if (info.gitSha === "unknown") {
    console.error("[version] FATAL: GIT_SHA is 'unknown' in production!")
    console.error("[version] Image was built without --build-arg GIT_SHA")
    console.error("[version] This worker CANNOT run - may be stale code.")
    process.exit(1)
  }

  if (info.expectedSha && info.gitSha !== info.expectedSha) {
    console.error("[version] FATAL: Version mismatch!")
    console.error(`[version]   Image SHA:    ${info.gitSha}`)
    console.error(`[version]   Expected SHA: ${info.expectedSha}`)
    console.error("[version] This worker is running STALE code. Exiting.")
    process.exit(1)
  }

  console.log(`[version] Version check passed: ${info.gitSha}`)
}

/**
 * HARD GUARD: Assert not running via tsx in production
 * Prevents accidental runtime transpilation in prod
 */
export function assertNotTsx(): void {
  const isProduction = process.env.NODE_ENV === "production"
  const hasTsx = process.argv.some(arg => arg.includes("tsx"))

  if (isProduction && hasTsx) {
    console.error("[version] FATAL: Running via tsx in production!")
    console.error("[version] Workers must be compiled to JS and run with node.")
    console.error("[version] Use: node dist/workers/... not npx tsx src/...")
    process.exit(1)
  }
}

/**
 * Run all startup guards (call this FIRST in every worker)
 * This runs BEFORE Redis/BullMQ initialization
 */
export function runStartupGuards(): void {
  assertNotTsx()
  assertVersionGuard()
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/regulatory-truth/workers/__tests__/version-guard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/workers/utils/version-guard.ts
git add src/lib/regulatory-truth/workers/__tests__/version-guard.test.ts
git commit -m "feat: add version-guard for runtime version enforcement"
```

---

## Task 9: Integrate Version Guard into Worker Startup

**Files:**
- Modify: `src/lib/regulatory-truth/workers/base.ts`

**Step 1: Add version registration to startup**

At the top of `base.ts`, add import:

```typescript
import { registerWorkerVersion, assertVersionInProduction } from "./utils/version-guard"
```

**Step 2: Add startup log function call**

Find the `logStartup()` function and add version checks:

```typescript
export async function logStartup(workerName: string): Promise<void> {
  // Existing startup log code...

  // Add version enforcement
  assertVersionInProduction()
  await registerWorkerVersion()
}
```

**Step 3: Verify workers call logStartup**

Check that all workers call `logStartup()` on init (they should via the factory pattern)

**Step 4: Test locally**

Run: `WORKER_TYPE=test GIT_SHA=abc123 npx tsx src/lib/regulatory-truth/workers/orchestrator.worker.ts`
Expected: Logs version registration, then starts normally

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/workers/base.ts
git commit -m "feat: register worker version on startup, enforce in production"
```

---

## Task 10: Create Version Verification Script

**Files:**
- Create: `scripts/verify-worker-versions.ts`

**Step 1: Create verification script**

```typescript
#!/usr/bin/env npx tsx
// scripts/verify-worker-versions.ts
// Verify all running workers have the expected GIT_SHA
//
// Expected SHA source (in order of preference):
// 1. EXPECTED_GIT_SHA env var (set by deploy pipeline)
// 2. git rev-parse HEAD (fallback for local dev)

import { execSync } from "child_process"
import Redis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

function getExpectedSha(): string {
  // Prefer EXPECTED_GIT_SHA (set by deploy pipeline)
  if (process.env.EXPECTED_GIT_SHA) {
    return process.env.EXPECTED_GIT_SHA
  }

  // Fallback to git for local dev (may not match deployed version!)
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
    console.log("⚠️  Using git rev-parse HEAD (EXPECTED_GIT_SHA not set)")
    console.log("   On server, set EXPECTED_GIT_SHA for accurate comparison\n")
    return sha
  } catch {
    console.error("ERROR: Cannot determine expected SHA")
    console.error("Set EXPECTED_GIT_SHA or run from a git repo")
    process.exit(1)
  }
}

async function main() {
  const redis = new Redis(REDIS_URL)
  const expectedSha = getExpectedSha()

  console.log(`Expected GIT_SHA: ${expectedSha}\n`)

  // Find all registered workers
  const workerKeys = await redis.keys("fiskai:worker:*:version")

  if (workerKeys.length === 0) {
    console.log("No workers registered in Redis")
    console.log("Workers register on startup - are they running?")
    process.exit(0)
  }

  let hasStale = false
  const results: { worker: string; sha: string; match: boolean; started: string }[] = []

  for (const key of workerKeys) {
    const data = await redis.hgetall(key)
    const workerType = key.split(":")[2]
    const match = data.gitSha === expectedSha

    results.push({
      worker: workerType,
      sha: data.gitSha,
      match,
      started: data.startedAt,
    })

    if (!match) hasStale = true
  }

  // Print results
  console.log("Workers:")
  for (const r of results) {
    const status = r.match ? "✓" : "✗ STALE"
    console.log(`  ${status} ${r.worker}`)
    console.log(`      SHA: ${r.sha}`)
    console.log(`      Started: ${r.started}`)
  }

  await redis.quit()

  if (hasStale) {
    console.log("\n❌ Some workers are running stale code!")
    console.log("   Steps to fix:")
    console.log("   1. Rebuild images: ./scripts/build-workers.sh")
    console.log("   2. Update EXPECTED_GIT_SHA in .env")
    console.log("   3. Restart workers: docker compose -f docker-compose.workers.yml up -d --force-recreate")
    process.exit(1)
  }

  console.log("\n✅ All workers running expected version")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Step 2: Make executable**

Run: `chmod +x scripts/verify-worker-versions.ts`

**Step 3: Test script (after workers are running)**

Run: `npx tsx scripts/verify-worker-versions.ts`
Expected: Lists workers with version status

**Step 4: Commit**

```bash
git add scripts/verify-worker-versions.ts
git commit -m "feat: add worker version verification script"
```

---

## Task 11: Fix Kill Switch - Single Point of Evaluation

**Files:**
- Modify: `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`
- Create: `src/lib/regulatory-truth/workers/utils/feature-flags.ts`

**Step 1: Create feature flags utility**

```typescript
// src/lib/regulatory-truth/workers/utils/feature-flags.ts

/**
 * Feature flags evaluated at drainer level (single source of truth)
 */
export const FeatureFlags = {
  /**
   * When false: drainer queues directly to extraction (legacy behavior)
   * When true: drainer queues to classifier first
   */
  get classificationEnabled(): boolean {
    return process.env.CLASSIFICATION_ENABLED !== "false"
  },
} as const
```

**Step 2: Update drainer to use feature flag**

In `continuous-drainer.worker.ts`, find the `runDrainCycle()` function and modify:

```typescript
import { FeatureFlags } from "./utils/feature-flags"

async function runDrainCycle(): Promise<DrainerStats> {
  const stats: DrainerStats = { /* ... */ }

  // Stage 1: Fetch pending items
  stats.itemsFetched = await drainPendingItems()

  // Stage 1.5: OCR queue
  stats.ocrJobs = await drainPendingOcr()

  // Stage 2: Classification OR direct extraction
  if (FeatureFlags.classificationEnabled) {
    // NEW: Queue to classifier, which routes to extraction
    stats.classifyJobs = await drainForClassification()
  } else {
    // LEGACY: Queue directly to extraction (bypass classification)
    stats.extractJobs = await drainFetchedEvidence()
  }

  // ... rest unchanged
}
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/workers/utils/feature-flags.ts
git add src/lib/regulatory-truth/workers/continuous-drainer.worker.ts
git commit -m "feat: centralize classification kill switch in drainer"
```

---

## Task 12: Fix BullMQ Connection Options

**Files:**
- Modify: `src/lib/regulatory-truth/workers/redis.ts`
- Modify: `src/lib/regulatory-truth/workers/queues.ts`
- Modify: `src/lib/regulatory-truth/workers/base.ts`

**Step 1: Export connection options, not instance**

Update `redis.ts`:

```typescript
// src/lib/regulatory-truth/workers/redis.ts
import Redis, { RedisOptions } from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

/**
 * Redis connection options (NOT a live instance)
 * Pass these to BullMQ Queue/Worker constructors
 */
export const redisConnectionOptions: RedisOptions = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || "6379"),
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
}

/**
 * BullMQ prefix for all queues/workers
 */
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

/**
 * Get BullMQ connection options (for Queue and Worker constructors)
 */
export function getBullMqOptions() {
  return {
    connection: redisConnectionOptions,
    prefix: BULLMQ_PREFIX,
  }
}

// Keep existing redis instance for non-BullMQ use (e.g., version tracking)
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

export function createWorkerConnection(): Redis {
  return new Redis(REDIS_URL, redisConnectionOptions)
}

export async function closeRedis(): Promise<void> {
  await redis.quit()
}
```

**Step 2: Update queues.ts to use options**

```typescript
import { Queue } from "bullmq"
import { getBullMqOptions, BULLMQ_PREFIX } from "./redis"

// Use options helper
const bullOpts = getBullMqOptions()

function createQueue(name: string, limiter?: { max: number; duration: number }) {
  return new Queue(name, {
    ...bullOpts,
    defaultJobOptions,
    ...(limiter && { limiter }),
  })
}
```

**Step 3: Update base.ts to use options**

```typescript
import { Worker, QueueEvents } from "bullmq"
import { getBullMqOptions, createWorkerConnection, BULLMQ_PREFIX } from "./redis"

export function createWorker<T>(/* ... */): Worker<T> {
  const connection = createWorkerConnection()

  const worker = new Worker<T>(queueName, async (job) => { /* ... */ }, {
    connection,
    prefix: BULLMQ_PREFIX,
    concurrency,
    // ... other options
  })

  return worker
}
```

**Step 4: Verify prefix consistency**

Run: `grep -r "prefix:" src/lib/regulatory-truth/workers/ | grep -v test`
Expected: All should use `BULLMQ_PREFIX` constant or `getBullMqOptions()`

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/workers/redis.ts
git add src/lib/regulatory-truth/workers/queues.ts
git add src/lib/regulatory-truth/workers/base.ts
git commit -m "fix: use connection options not shared instance for BullMQ"
```

---

## Task 13: Create Operations Documentation

**Files:**
- Create: `docs/operations/WORKER_DEPLOYMENT_INTEGRITY.md`

**Step 1: Write documentation**

```markdown
# Worker Deployment Integrity

## Overview

This document describes how to ensure workers are running the correct code version after deployments. After the December 2024 incident where workers ran stale code, we implemented hard guards that make drift impossible.

## Core Principle: Stale Workers Cannot Run

Workers enforce version at startup (BEFORE connecting to Redis/queues):

1. **tsx Guard:** Workers crash if running via tsx in production
2. **Unknown SHA Guard:** Workers crash if GIT_SHA is "unknown" in production
3. **Mismatch Guard:** Workers crash if GIT_SHA doesn't match EXPECTED_GIT_SHA

This means stale workers **cannot silently run** - they fail fast with clear error messages.

## Image Tagging Strategy (Immutable Tags)

Worker images MUST be tagged with the git SHA (not "latest"):
- `fiskai-worker:<sha>` - Base worker (no OCR deps)
- `fiskai-worker-ocr:<sha>` - OCR worker (with tesseract)

**CRITICAL:** Never use `:latest` tag in production. Always reference by SHA.

**Build command:**
```bash
./scripts/build-workers.sh
# Creates: fiskai-worker:<sha>, fiskai-worker-ocr:<sha>
```

## Deployment Workflow (Pull-by-Tag)

### 1. Build and Tag Images

```bash
export GIT_SHA=$(git rev-parse HEAD)
./scripts/build-workers.sh
```

### 2. Update Environment

Add to `.env` or Coolify environment:
```bash
GIT_SHA=abc123def456...
EXPECTED_GIT_SHA=abc123def456...  # Same value - workers validate against this
```

### 3. Update docker-compose.workers.yml

Reference images by SHA tag (not latest):
```yaml
worker-extractor:
  image: fiskai-worker:abc123  # Short SHA
  # OR use build with args
  build:
    args:
      GIT_SHA: ${GIT_SHA}
```

### 4. Deploy

```bash
docker compose -f docker-compose.workers.yml up -d --force-recreate
```

### 5. Verify

```bash
EXPECTED_GIT_SHA=$GIT_SHA npx tsx scripts/verify-worker-versions.ts
```

## Version Enforcement Details

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GIT_SHA` | Baked into image at build time | Yes |
| `EXPECTED_GIT_SHA` | Set at deploy time, workers validate against this | Production |
| `BUILD_DATE` | When image was built | Optional |
| `NODE_ENV` | Must be "production" for guards to enforce | Yes in prod |

### Redis Registration (Monitoring Only)

Workers register their version in Redis for monitoring (NOT for enforcement):
- Key: `fiskai:worker:<worker-type>:version`
- Fields: `gitSha`, `buildDate`, `startedAt`, `pid`
- TTL: 24 hours (auto-cleanup if worker dies)

## Verifying Worker Versions

```bash
# Using EXPECTED_GIT_SHA (recommended)
EXPECTED_GIT_SHA=$(git rev-parse HEAD) npx tsx scripts/verify-worker-versions.ts

# Manual Redis check
docker exec fiskai-redis redis-cli KEYS "fiskai:worker:*:version"
docker exec fiskai-redis redis-cli HGETALL "fiskai:worker:extractor:version"
```

## Coolify-Specific Notes

When deploying via Coolify:

1. **Always use "Force Rebuild"** - cached layers can serve old code
2. **Set EXPECTED_GIT_SHA** in Coolify environment variables
3. **Verify after deploy** - workers that fail startup will appear in container logs

## Recovering from Stale Redis Queues

If queues contain jobs for non-existent evidence:

```bash
# Check queue sizes
npx tsx scripts/queue-status.ts

# Purge specific queue (DANGER: data loss)
docker exec fiskai-redis redis-cli DEL "fiskai:extract:wait"

# Or use the cleanup script
npx tsx scripts/redis-cleanup.ts --queue extract --older-than 24h
```

## Troubleshooting

### Worker crashes on startup with "FATAL: GIT_SHA is 'unknown'"

Image was built without version info:
```bash
docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -f Dockerfile.worker .
```

### Worker crashes with "FATAL: Version mismatch!"

Worker image SHA doesn't match EXPECTED_GIT_SHA:
1. Check what EXPECTED_GIT_SHA is set to
2. Rebuild image with matching SHA
3. Restart worker

### Worker crashes with "FATAL: Running via tsx in production!"

Container command is still using `npx tsx`:
```yaml
# Wrong:
command: ["npx", "tsx", "src/.../worker.ts"]

# Correct:
command: ["node", "dist/.../worker.js"]
```

### Workers not registering in Redis

1. Version guard passed (good), but Redis connection failed
2. Check Redis: `docker exec fiskai-redis redis-cli PING`
3. Check logs: `docker logs fiskai-worker-extractor`

### Version mismatch after deploy

1. Container wasn't recreated: `docker compose up -d --force-recreate`
2. Wrong image tag: verify `docker images | grep fiskai-worker`
```

**Step 2: Commit**

```bash
git add docs/operations/WORKER_DEPLOYMENT_INTEGRITY.md
git commit -m "docs: add worker deployment integrity runbook"
```

---

## Task 14: Update docker-compose.workers.yml with Build Args

**Files:**
- Modify: `docker-compose.workers.yml`

**Step 1: Add build args to all worker services**

For each worker service that uses `build:`, add:

```yaml
worker-extractor:
  build:
    context: .
    dockerfile: Dockerfile.worker
    args:
      GIT_SHA: ${GIT_SHA:-unknown}
      BUILD_DATE: ${BUILD_DATE:-unknown}
      WITH_OCR: "false"
```

For OCR worker specifically:
```yaml
worker-ocr:
  build:
    context: .
    dockerfile: Dockerfile.worker
    args:
      GIT_SHA: ${GIT_SHA:-unknown}
      BUILD_DATE: ${BUILD_DATE:-unknown}
      WITH_OCR: "true"
```

**Step 2: Add GIT_SHA to environments**

For each worker, add to environment:
```yaml
environment:
  - GIT_SHA=${GIT_SHA:-unknown}
```

**Step 3: Update memory limits per expert guidance**

```yaml
worker-ocr:
  deploy:
    resources:
      limits:
        memory: 2G

worker-extractor:
  deploy:
    resources:
      limits:
        memory: 1G

worker-classifier:
  deploy:
    resources:
      limits:
        memory: 512M

worker-continuous-drainer:
  deploy:
    resources:
      limits:
        memory: 256M
```

**Step 4: Commit**

```bash
git add docker-compose.workers.yml
git commit -m "feat: add build args and memory limits to all workers"
```

---

## Task 15: Final Integration Test

**Step 1: Build all images**

```bash
export GIT_SHA=$(git rev-parse HEAD)
export BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
./scripts/build-workers.sh
```

**Step 2: Start workers**

```bash
docker compose -f docker-compose.workers.yml up -d
```

**Step 3: Verify version registration**

```bash
# Wait 30 seconds for workers to start
sleep 30

# Check versions
npx tsx scripts/verify-worker-versions.ts
```

Expected: All workers show matching SHA

**Step 4: Verify image sizes**

```bash
docker images | grep fiskai-worker
```

Expected:
- `fiskai-worker` (base): ~200-300MB
- `fiskai-worker-ocr`: ~350-450MB (OCR adds ~100-150MB)

**Step 5: Verify OCR deps isolation**

```bash
# Base image should NOT have tesseract
docker run --rm fiskai-worker:latest which tesseract
# Expected: error/empty

# OCR image SHOULD have tesseract
docker run --rm fiskai-worker-ocr:latest which tesseract
# Expected: /usr/bin/tesseract
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification for worker infrastructure"
```

---

## Verification Checklist

Before creating PR:

- [ ] Node 20 pinned with digest
- [ ] GIT_SHA/BUILD_DATE baked into images
- [ ] OCR deps only in OCR image (WITH_OCR=true)
- [ ] Workers compile to JS (no tsx in prod)
- [ ] Version guard crashes on unknown SHA in production
- [ ] Workers register version in Redis
- [ ] verify-worker-versions.ts script works
- [ ] Kill switch evaluated only in drainer
- [ ] BullMQ uses connection options, not shared instance
- [ ] Documentation in docs/operations/
- [ ] All worker commands updated to `node dist/...`
- [ ] Memory limits per worker type

## Before/After Evidence

Include in PR:
1. Docker image sizes (base vs OCR)
2. Redis keys showing version registration
3. verify-worker-versions.ts output
4. Screenshot of workers running compiled JS
