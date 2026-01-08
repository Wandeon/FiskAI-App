# Worker Deployment Integrity

> **Status:** Canonical
> **Last Updated:** 2026-01-08
> **Owner:** Platform Engineering

## Overview

This document describes the worker deployment integrity system implemented to prevent workers from running stale code.

### Background: December 2024 Incident

In December 2024, production workers continued running old code after a deployment because:

1. Docker images were tagged with `:latest`
2. `docker compose up -d` reused existing containers
3. No mechanism existed to detect version mismatches
4. Workers silently processed jobs with outdated logic

**Impact:** Regulatory data was processed with incorrect extraction rules for 3+ days before discovery.

**Resolution:** Implement a multi-layer version enforcement system that crashes workers immediately if they detect version mismatches, before any work can be processed.

---

## Core Principle: Fail-Fast Version Enforcement

Workers enforce version at startup **BEFORE connecting to Redis**:

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKER STARTUP                           │
├─────────────────────────────────────────────────────────────┤
│  1. tsx Guard      → crash if running via tsx in prod       │
│  2. Unknown Guard  → crash if GIT_SHA is "unknown" in prod  │
│  3. Mismatch Guard → crash if GIT_SHA != EXPECTED_GIT_SHA   │
│                                                              │
│  ↓ (all guards pass)                                         │
│                                                              │
│  4. Connect to Redis                                         │
│  5. Register version info (monitoring only)                  │
│  6. Start processing jobs                                    │
└─────────────────────────────────────────────────────────────┘
```

### Guard 1: tsx Guard

Workers **must not** run via `tsx` (TypeScript execution) in production. This guard detects if `tsx` is in the process arguments and crashes immediately.

**Why:** tsx execution bypasses the compilation step, meaning workers could run uncompiled source code that differs from what was tested/approved.

**Code location:** `src/lib/regulatory-truth/workers/utils/version-guard.ts`

```typescript
export function assertNotTsx(): void {
  const isProduction = process.env.NODE_ENV === "production"
  const hasTsx = process.argv.some((arg) => arg.includes("tsx"))

  if (isProduction && hasTsx) {
    console.error("[version] FATAL: Running via tsx in production!")
    console.error("[version] Workers must be compiled to JS and run with node.")
    process.exit(1)
  }
}
```

### Guard 2: Unknown SHA Guard

Workers crash if `GIT_SHA` is `"unknown"` in production. This indicates the Docker image was built without the `--build-arg GIT_SHA` argument.

**Why:** An image without a known SHA cannot be verified against expectations and may contain arbitrary code.

```typescript
if (info.gitSha === "unknown") {
  console.error("[version] FATAL: GIT_SHA is 'unknown' in production!")
  console.error("[version] Image was built without --build-arg GIT_SHA")
  console.error("[version] This worker CANNOT run - may be stale code.")
  process.exit(1)
}
```

### Guard 3: Mismatch Guard

When `EXPECTED_GIT_SHA` is set (recommended in production), workers crash if their baked-in `GIT_SHA` does not match.

**Why:** This detects when an old image is accidentally deployed or when `docker compose up` reuses a stale container.

```typescript
if (info.expectedSha && info.gitSha !== info.expectedSha) {
  console.error("[version] FATAL: Version mismatch!")
  console.error(`[version]   Image SHA:    ${info.gitSha}`)
  console.error(`[version]   Expected SHA: ${info.expectedSha}`)
  console.error("[version] This worker is running STALE code. Exiting.")
  process.exit(1)
}
```

---

## Image Tagging Strategy

### Naming Convention

| Image Name                | Purpose                                               | OCR Support |
| ------------------------- | ----------------------------------------------------- | ----------- |
| `fiskai-worker:<sha>`     | Base worker (orchestrator, sentinel, extractor, etc.) | No          |
| `fiskai-worker-ocr:<sha>` | OCR worker with Tesseract + poppler                   | Yes         |

### Tagging Rules

1. **Always tag with git SHA** - use the short SHA (7 characters) from `git rev-parse --short HEAD`
2. **Never use `:latest` in production** - it defeats version tracking
3. **Build script creates both SHA and latest tags** - but only use SHA tags in compose files

### Build Command

```bash
# Build both worker images with version info
./scripts/build-workers.sh
```

This script:

1. Gets current `GIT_SHA` from git
2. Gets `BUILD_DATE` in ISO format
3. Builds `fiskai-worker:<sha>` (base worker, no OCR)
4. Builds `fiskai-worker-ocr:<sha>` (with Tesseract OCR)
5. Tags both with `:latest` for convenience (but don't use in prod)

**Manual build (if needed):**

```bash
GIT_SHA=$(git rev-parse HEAD)
GIT_SHA_SHORT=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Base worker
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=false \
  -t fiskai-worker:${GIT_SHA_SHORT} .

# OCR worker
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=true \
  -t fiskai-worker-ocr:${GIT_SHA_SHORT} .
```

---

## Deployment Workflow

### Step 1: Build and Tag Images

```bash
# Ensure you're on the correct commit
git pull origin main
git log -1 --oneline  # verify SHA

# Build images
./scripts/build-workers.sh

# Note the SHA printed by the build script
# Example: GIT_SHA: a1b2c3d4e5f6...
```

### Step 2: Update Environment Variables

Set both `GIT_SHA` and `EXPECTED_GIT_SHA` in the environment:

```bash
# In .env or via Coolify dashboard
GIT_SHA=a1b2c3d4e5f6...
EXPECTED_GIT_SHA=a1b2c3d4e5f6...
```

**Note:** `GIT_SHA` is baked into the image at build time. `EXPECTED_GIT_SHA` is set at deploy time and workers validate against it.

### Step 3: Update docker-compose.workers.yml

Update image tags to reference the SHA:

```yaml
services:
  worker-orchestrator:
    image: fiskai-worker:a1b2c3d # Use short SHA
    # ... rest of config
    environment:
      - EXPECTED_GIT_SHA=${EXPECTED_GIT_SHA}
      # ... other env vars
```

### Step 4: Deploy Workers

```bash
# Force recreate to ensure new images are used
docker compose -f docker-compose.workers.yml up -d --force-recreate

# Watch logs for version guard output
docker compose -f docker-compose.workers.yml logs -f --tail=50
```

### Step 5: Verify Deployment

```bash
# Using the verification script
EXPECTED_GIT_SHA=$GIT_SHA npx tsx scripts/verify-worker-versions.ts
```

Expected output:

```
Expected GIT_SHA: a1b2c3d4e5f6...

Workers:
  [OK] orchestrator
      SHA: a1b2c3d4e5f6...
      Started: 2026-01-08T12:00:00.000Z
  [OK] sentinel
      SHA: a1b2c3d4e5f6...
      Started: 2026-01-08T12:00:00.000Z
  [OK] extractor
      SHA: a1b2c3d4e5f6...
      Started: 2026-01-08T12:00:00.000Z

[OK] All workers running expected version
```

---

## Environment Variables Reference

| Variable             | Purpose                                          | Required    | Set By                     |
| -------------------- | ------------------------------------------------ | ----------- | -------------------------- |
| `GIT_SHA`            | Git commit SHA baked into image at build time    | Yes         | Docker build args          |
| `BUILD_DATE`         | ISO timestamp when image was built               | Optional    | Docker build args          |
| `EXPECTED_GIT_SHA`   | Expected SHA that workers validate against       | Production  | Deploy environment         |
| `NODE_ENV`           | Must be `"production"` for guards to enforce     | Yes in prod | Deploy environment         |
| `WORKER_TYPE`        | Worker identifier (orchestrator, sentinel, etc.) | Yes         | docker-compose.workers.yml |
| `WORKER_CONCURRENCY` | Number of concurrent jobs per worker             | Optional    | docker-compose.workers.yml |
| `REDIS_URL`          | Redis connection string                          | Yes         | docker-compose.workers.yml |

### How Variables Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    BUILD TIME                                │
├─────────────────────────────────────────────────────────────┤
│  ./scripts/build-workers.sh                                  │
│    ↓                                                         │
│  docker build --build-arg GIT_SHA="abc123" ...              │
│    ↓                                                         │
│  Dockerfile: ENV GIT_SHA=${GIT_SHA}                         │
│    ↓                                                         │
│  GIT_SHA baked into image layer                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DEPLOY TIME                               │
├─────────────────────────────────────────────────────────────┤
│  .env: EXPECTED_GIT_SHA=abc123                              │
│    ↓                                                         │
│  docker compose up -d                                        │
│    ↓                                                         │
│  Container reads EXPECTED_GIT_SHA from environment          │
│    ↓                                                         │
│  Worker compares GIT_SHA (from image) with EXPECTED_GIT_SHA │
└─────────────────────────────────────────────────────────────┘
```

---

## Redis Registration (Monitoring Only)

After passing all guards, workers register their version info in Redis. **This is for monitoring only, NOT enforcement** - enforcement happens before Redis connection.

### Key Format

```
fiskai:worker:<worker-type>:version
```

Examples:

- `fiskai:worker:orchestrator:version`
- `fiskai:worker:sentinel:version`
- `fiskai:worker:extractor:version`
- `fiskai:worker:ocr:version`

### Fields

| Field       | Description                   | Example                |
| ----------- | ----------------------------- | ---------------------- |
| `gitSha`    | Full git commit SHA           | `a1b2c3d4e5f6789...`   |
| `buildDate` | ISO timestamp of build        | `2026-01-08T12:00:00Z` |
| `startedAt` | ISO timestamp of worker start | `2026-01-08T12:05:00Z` |
| `pid`       | Process ID within container   | `1`                    |

### TTL

Keys expire after **24 hours** (86400 seconds). Workers refresh on restart.

### Query Examples

```bash
# List all registered workers
docker exec fiskai-redis redis-cli KEYS "fiskai:worker:*:version"

# Get specific worker info
docker exec fiskai-redis redis-cli HGETALL "fiskai:worker:extractor:version"

# Check all workers at once
docker exec fiskai-redis redis-cli --scan --pattern "fiskai:worker:*:version" | \
  while read key; do
    echo "=== $key ==="
    docker exec fiskai-redis redis-cli HGETALL "$key"
  done
```

---

## Verification Commands

### Automated Verification

```bash
# Set expected SHA and run verification
EXPECTED_GIT_SHA=$GIT_SHA npx tsx scripts/verify-worker-versions.ts

# Or with explicit SHA
EXPECTED_GIT_SHA=a1b2c3d npx tsx scripts/verify-worker-versions.ts
```

### Manual Redis Checks

```bash
# List all worker version keys
docker exec fiskai-redis redis-cli KEYS "fiskai:worker:*:version"

# Get detailed info for a specific worker
docker exec fiskai-redis redis-cli HGETALL "fiskai:worker:extractor:version"

# Quick SHA check for all workers
docker exec fiskai-redis redis-cli --scan --pattern "fiskai:worker:*:version" | \
  xargs -I {} docker exec fiskai-redis redis-cli HGET {} gitSha
```

### Container Inspection

```bash
# Check environment variables in running container
docker inspect fiskai-worker-orchestrator | jq '.[0].Config.Env'

# Check logs for version guard output
docker logs fiskai-worker-orchestrator 2>&1 | grep "\[version\]"
```

---

## Troubleshooting

### Worker crashes with "GIT_SHA is 'unknown'"

**Cause:** Image was built without the `GIT_SHA` build argument.

**Fix:**

1. Rebuild the image with proper arguments:
   ```bash
   ./scripts/build-workers.sh
   ```
2. Or manually:
   ```bash
   docker build -f Dockerfile.worker \
     --build-arg GIT_SHA=$(git rev-parse HEAD) \
     --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
     -t fiskai-worker:$(git rev-parse --short HEAD) .
   ```

### Worker crashes with "Version mismatch"

**Cause:** The `EXPECTED_GIT_SHA` environment variable does not match the `GIT_SHA` baked into the running image.

**Possible scenarios:**

1. Old image is still running (container not recreated)
2. `EXPECTED_GIT_SHA` was updated but new images weren't built
3. Wrong image tag in docker-compose.workers.yml

**Fix:**

1. Verify the expected SHA:
   ```bash
   echo $EXPECTED_GIT_SHA
   ```
2. Check what SHA is in the running image:
   ```bash
   docker exec fiskai-worker-orchestrator printenv GIT_SHA
   ```
3. Either:
   - Update `EXPECTED_GIT_SHA` to match the running image, OR
   - Rebuild and redeploy with matching images:
     ```bash
     ./scripts/build-workers.sh
     docker compose -f docker-compose.workers.yml up -d --force-recreate
     ```

### Worker crashes with "Running via tsx in production"

**Cause:** Worker is being executed with `npx tsx` instead of compiled JavaScript.

**This should not happen with Docker images** since they run the compiled `dist/` files. If it does:

1. Check the command in docker-compose.workers.yml:

   ```yaml
   # Correct:
   command: ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]

   # Wrong:
   command: ["npx", "tsx", "src/lib/regulatory-truth/workers/orchestrator.worker.ts"]
   ```

2. Verify `dist/` directory exists in container:
   ```bash
   docker exec fiskai-worker-orchestrator ls -la dist/
   ```

### Workers not registering in Redis

**Cause:** Workers are crashing before Redis registration (which happens after guards pass).

**Fix:**

1. Check container logs for guard failures:
   ```bash
   docker logs fiskai-worker-orchestrator 2>&1 | head -30
   ```
2. Look for `[version] FATAL:` messages
3. Address the version mismatch or build issue

### Verification script shows "[STALE]" workers

**Cause:** Some workers are running with a different SHA than expected.

**Fix:**

1. Identify which workers are stale from the script output
2. Rebuild images:
   ```bash
   ./scripts/build-workers.sh
   ```
3. Force recreate stale workers:
   ```bash
   docker compose -f docker-compose.workers.yml up -d --force-recreate worker-extractor
   ```
4. Re-run verification:
   ```bash
   EXPECTED_GIT_SHA=$GIT_SHA npx tsx scripts/verify-worker-versions.ts
   ```

---

## Related Documentation

- [Dockerfile.worker](/Dockerfile.worker) - Worker image definition
- [scripts/build-workers.sh](/scripts/build-workers.sh) - Build script
- [scripts/verify-worker-versions.ts](/scripts/verify-worker-versions.ts) - Verification script
- [src/lib/regulatory-truth/workers/utils/version-guard.ts](/src/lib/regulatory-truth/workers/utils/version-guard.ts) - Guard implementation
- [docker-compose.workers.yml](/docker-compose.workers.yml) - Worker service definitions
