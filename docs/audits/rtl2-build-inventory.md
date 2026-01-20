# RTL2 Build Inventory Audit

**Date:** 2026-01-20
**Purpose:** Document what CI builds and pushes, identify legacy build paths

---

## Summary of Critical Findings

| Issue                                                 | Severity | Status              |
| ----------------------------------------------------- | -------- | ------------------- |
| Workers repo builds OLD code with buildKnowledgeGraph | CRITICAL | Action Required     |
| Workers repo missing graph-rebuild-worker.ts          | CRITICAL | Action Required     |
| FiskAI repo no longer builds worker images (correct)  | OK       | Verified            |
| Two separate codebases for RTL (collision source)     | CRITICAL | Architectural Issue |

---

## 1. FiskAI Repo (App Server)

### CI Workflows

| Workflow                       | Purpose                | Builds Workers?  |
| ------------------------------ | ---------------------- | ---------------- |
| `ci.yml`                       | Tests, lint, typecheck | No               |
| `build-and-publish-images.yml` | Build app image        | **No (correct)** |
| `assistant-quality-gates.yml`  | AI quality checks      | No               |
| `fiscal-validator.yml`         | Fiscal compliance      | No               |
| `registry-check.yml`           | Feature registry       | No               |
| `schema-ownership.yml`         | DB schema checks       | No               |

**Evidence:**

```yaml
# From build-and-publish-images.yml
# Note: Worker images are now built from the separate fiskai-workers repo.
echo "**Workers:** Built and deployed from separate fiskai-workers repo"
```

### Worker Code State

FiskAI repo has **NEW** RTL2 code:

- `src/lib/regulatory-truth/graph/edge-builder.ts` - Event-driven edge building
- `src/lib/regulatory-truth/graph/graph-rebuild-worker.ts` - Worker logic
- `src/lib/regulatory-truth/scripts/run-graph-rebuild.ts` - Worker entrypoint
- `src/lib/infra/queues.ts` - Graph-rebuild queue registration

**buildKnowledgeGraph status:**

```
src/lib/regulatory-truth/graph/edge-builder.ts:5:   // Replaces "buildKnowledgeGraph" anti-pattern
src/lib/regulatory-truth/watchdog/orchestrator.ts:9: // NOTE: buildKnowledgeGraph removed
src/lib/regulatory-truth/watchdog/orchestrator.ts:307: // NOTE: Batch buildKnowledgeGraph() removed
```

---

## 2. Workers Repo (fiskai-workers)

### CI Workflow (ci.yml)

| Job                  | Purpose               | Triggers On     |
| -------------------- | --------------------- | --------------- |
| `lint-and-typecheck` | Code quality          | push/PR to main |
| `build`              | Compile TypeScript    | push/PR to main |
| `build-docker`       | Build and push images | **main only**   |
| `deploy`             | SSH deploy to VPS     | **main only**   |

**Docker Images Built:**

- `ghcr.io/wandeon/fiskai-worker:<sha>` (standard worker)
- `ghcr.io/wandeon/fiskai-worker-ocr:<sha>` (with OCR deps)
- `ghcr.io/wandeon/fiskai-worker:latest` (convenience tag)

### Worker Code State (OUTDATED!)

Workers repo has **OLD** RTL code:

- `buildKnowledgeGraph` actively called in 4 places
- No `graph-rebuild-worker.ts`
- No `run-graph-rebuild.ts`
- No event-driven edge building

**Evidence:**

```bash
# Workers repo still calls buildKnowledgeGraph:
src/lib/regulatory-truth/workers/releaser.worker.ts:23:    await buildKnowledgeGraph()
src/lib/regulatory-truth/workers/scheduler.service.ts:485: await buildKnowledgeGraph()
src/lib/regulatory-truth/scripts/overnight-run.ts:312:     await buildKnowledgeGraph()
src/lib/regulatory-truth/watchdog/orchestrator.ts:307:     await buildKnowledgeGraph()
```

---

## 3. Code Divergence Analysis

### Files Only in FiskAI (Need to be synced to workers)

```
src/lib/regulatory-truth/graph/edge-builder.ts        # Event-driven edge building
src/lib/regulatory-truth/graph/graph-rebuild-worker.ts # New worker logic
src/lib/regulatory-truth/scripts/run-graph-rebuild.ts # New worker entrypoint
src/lib/regulatory-truth/eval/rule-store-types.ts     # RuleStore interface
src/lib/regulatory-truth/eval/rule-store.ts          # selectRuleFromDb with graphStatus
prisma/migrations/20260120000000_event_driven_kg_edges/ # GraphStatus enum
```

### Files Modified in FiskAI (Workers version is outdated)

```
src/lib/infra/queues.ts                              # Has graph-rebuild queue
src/lib/regulatory-truth/services/rule-status-service.ts # Event-driven on PUBLISHED
src/lib/regulatory-truth/watchdog/orchestrator.ts    # buildKnowledgeGraph removed
```

### Files in Workers That Need Cleanup

```
src/lib/regulatory-truth/workers/releaser.worker.ts  # Remove buildKnowledgeGraph call
src/lib/regulatory-truth/workers/scheduler.service.ts # Remove buildKnowledgeGraph call
src/lib/regulatory-truth/scripts/overnight-run.ts    # Remove buildKnowledgeGraph call
src/lib/regulatory-truth/graph/knowledge-graph.ts    # Keep but don't call batch method
```

---

## 4. Required Actions

### CRITICAL: Sync Code to Workers Repo

1. **Copy new files from FiskAI to workers:**

   ```bash
   # From FiskAI to fiskai-workers
   cp src/lib/regulatory-truth/graph/edge-builder.ts workers/
   cp src/lib/regulatory-truth/graph/graph-rebuild-worker.ts workers/
   cp src/lib/regulatory-truth/scripts/run-graph-rebuild.ts workers/
   cp src/lib/regulatory-truth/eval/rule-store-types.ts workers/
   ```

2. **Remove buildKnowledgeGraph calls:**
   - Edit `releaser.worker.ts` - remove lines 6 and 22-24
   - Edit `scheduler.service.ts` - remove lines 15 and 485
   - Edit `overnight-run.ts` - remove lines 52 and 312
   - Edit `orchestrator.ts` - remove lines 9 and 307

3. **Update queues.ts in workers repo:**
   - Add `graph-rebuild` queue registration
   - Add `enqueueGraphRebuildJob` function

4. **Rebuild and push new image:**
   ```bash
   # This happens automatically on merge to main
   git push origin main
   # CI will build and deploy
   ```

### MEDIUM: Consider Monorepo

The two-repo split is causing code divergence. Consider:

1. Monorepo with shared packages
2. Or: Automated sync of RTL code between repos

---

## Evidence Commands

```bash
# Check FiskAI CI workflows
ls -la /home/admin/FiskAI/.github/workflows/

# Check workers CI workflow
cat /home/admin/fiskai-workers/.github/workflows/ci.yml

# Find buildKnowledgeGraph in workers
cd /home/admin/fiskai-workers
git grep -n "buildKnowledgeGraph" -- "*.ts"

# Find graph-rebuild in FiskAI
cd /home/admin/FiskAI
git grep -n "graph-rebuild" -- "*.ts"
```
