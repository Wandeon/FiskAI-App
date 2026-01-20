# RTL2 Database Writers Map

**Date:** 2026-01-20
**Purpose:** Map all code paths that can write to truth tables (RegulatoryRule, GraphEdge)

---

## Summary of Critical Findings

| Issue                                                       | Severity | Status              |
| ----------------------------------------------------------- | -------- | ------------------- |
| Workers repo `knowledge-graph.ts` can overwrite edges       | CRITICAL | Action Required     |
| `releaser.worker.ts` calls batch edge builder after release | CRITICAL | Action Required     |
| Both repos can write to same tables                         | HIGH     | Architectural Issue |

---

## 1. RegulatoryRule Writers

### Workers Repo (Active in Production)

| File                               | Line                         | Operation       | Category      |
| ---------------------------------- | ---------------------------- | --------------- | ------------- |
| `agents/arbiter.ts`                | 461, 474, 713, 728, 898, 911 | update          | rtl2-approved |
| `agents/composer.ts`               | 408, 453, 1008, 1051         | create, update  | rtl2-approved |
| `agents/releaser.ts`               | 948                          | update (status) | rtl2-approved |
| `agents/reviewer.ts`               | 265, 455                     | update          | rtl2-approved |
| `graph/knowledge-graph.ts`         | 311                          | update          | **LEGACY**    |
| `pipeline/trusted-source-stage.ts` | 139                          | update          | rtl2-approved |
| `services/rule-status-service.ts`  | 347, 502, 689, 782           | update          | rtl2-approved |
| `utils/confidence-decay.ts`        | 71                           | update          | rtl2-approved |
| `utils/consolidator.ts`            | 309, 329, 344, 369           | update          | rtl2-approved |
| `fetchers/hnb-fetcher.ts`          | 180                          | create          | rtl2-approved |

### FiskAI Repo (App Server)

| File                              | Line     | Operation               | Category     |
| --------------------------------- | -------- | ----------------------- | ------------ |
| `graph/graph-rebuild-worker.ts`   | 67, 92   | update (graphStatus)    | **rtl2-new** |
| `scripts/run-graph-rebuild.ts`    | 63       | update (graphStatus)    | **rtl2-new** |
| `services/rule-status-service.ts` | 354, 428 | update (graphStatus)    | **rtl2-new** |
| API routes (admin)                | various  | update (approve/reject) | admin-only   |

### Collision Risk

Both repos have `rule-status-service.ts` but with different code:

- Workers repo: OLD version without graphStatus
- FiskAI repo: NEW version with graphStatus on PUBLISHED

---

## 2. GraphEdge Writers

### Workers Repo (LEGACY - Active!)

| File                       | Line                     | Operation           | Category         |
| -------------------------- | ------------------------ | ------------------- | ---------------- |
| `graph/knowledge-graph.ts` | via `rebuildRelations()` | deleteMany + create | **LEGACY BATCH** |
| `graph/cycle-detection.ts` | 126                      | create              | rtl2-approved    |

**CRITICAL:** `knowledge-graph.ts:buildKnowledgeGraph()` deletes and recreates ALL edges for ALL rules. This is the batch approach that should be removed.

### FiskAI Repo (RTL2 - New)

| File                       | Line          | Operation             | Category      |
| -------------------------- | ------------- | --------------------- | ------------- |
| `graph/edge-builder.ts`    | 113, 196, 255 | deleteMany (per rule) | **rtl2-new**  |
| `graph/cycle-detection.ts` | 126           | create                | rtl2-approved |

**Pattern:** `edge-builder.ts` uses delete+insert per rule (event-driven), while `knowledge-graph.ts` rebuilds everything (batch).

---

## 3. Legacy vs RTL2 Code Paths

### Legacy Path (Currently Active!)

```
releaser.worker.ts
  → runReleaser(ruleIds)
  → if (result.success) await buildKnowledgeGraph()  ← BATCH REBUILD
      → knowledge-graph.ts:buildKnowledgeGraph()
          → rebuildRelations() for ALL rules
          → Deletes and recreates ALL edges
```

### RTL2 Path (Not Yet Deployed)

```
rule-status-service.ts:publishRules()
  → Update status to PUBLISHED, graphStatus to PENDING
  → Post-commit: rebuildEdgesForRule(ruleId)
      → edge-builder.ts (per-rule rebuild)
      → Update graphStatus to CURRENT
```

---

## 4. Writer Category Classification

| Category        | Definition                          | Action            |
| --------------- | ----------------------------------- | ----------------- |
| `rtl2-new`      | New event-driven code in FiskAI     | Deploy to workers |
| `rtl2-approved` | Existing code that doesn't conflict | Keep              |
| `LEGACY`        | Old batch code that conflicts       | Remove or disable |
| `admin-only`    | Admin UI operations                 | Keep (gated)      |

### Writers to Remove/Disable

1. `graph/knowledge-graph.ts:buildKnowledgeGraph()` - Keep function but remove all callers
2. `releaser.worker.ts:23` - Remove `await buildKnowledgeGraph()` call
3. `scheduler.service.ts:485` - Remove scheduled edge rebuild
4. `overnight-run.ts:312` - Remove batch edge rebuild
5. `orchestrator.ts:307` - Remove batch edge rebuild

### Writers to Deploy (from FiskAI)

1. `graph/edge-builder.ts` - Per-rule edge building
2. `graph/graph-rebuild-worker.ts` - Worker that processes queue
3. `scripts/run-graph-rebuild.ts` - Worker entrypoint
4. `services/rule-status-service.ts` - Updated with graphStatus flow

---

## 5. Required Actions

### CRITICAL

1. **Stop calling buildKnowledgeGraph in workers repo**

   ```typescript
   // In releaser.worker.ts, DELETE these lines:
   import { buildKnowledgeGraph } from "../graph/knowledge-graph"
   // ...
   if (result.success) {
     await buildKnowledgeGraph() // DELETE THIS
   }
   ```

2. **Sync edge-builder.ts to workers repo**
   - Copy FiskAI version to workers
   - Includes per-rule delete+insert pattern

3. **Update rule-status-service.ts in workers repo**
   - Add graphStatus handling
   - Add post-commit edge rebuild trigger

### HIGH

4. **Add RTL_LEGACY_DISABLED env var guard**
   ```typescript
   // In knowledge-graph.ts
   if (process.env.RTL_LEGACY_DISABLED === "true") {
     throw new Error("buildKnowledgeGraph is disabled - use event-driven edge building")
   }
   ```

---

## Evidence Commands

```bash
# Find all RegulatoryRule writes
git grep -n "regulatoryRule\.create\|regulatoryRule\.update" -- "*.ts" | grep -v test

# Find all GraphEdge writes
git grep -n "graphEdge\.create\|graphEdge\.deleteMany" -- "*.ts" | grep -v test

# Find buildKnowledgeGraph callers
git grep -n "buildKnowledgeGraph" -- "*.ts" | grep -v "export async function"
```
