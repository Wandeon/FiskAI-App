# Phase 3: Change Intelligence - Implementation Plan

> Detailed implementation plan for PR blast radius computation and enforcement.
>
> **Design:** [2025-12-28-system-registry-phases-2-4-design.md](./2025-12-28-system-registry-phases-2-4-design.md)
> **Status:** Ready for implementation
> **Estimated Sprints:** 2

---

## Prerequisites

- [ ] Phase 1 complete (registry check passing)
- [ ] Current declarations have accurate codeRef values
- [ ] CI workflow exists for registry-check

---

## Task 1: Add codeRefs[] to Schema

**File:** `src/lib/system-registry/schema.ts`

**Changes:**
1. Add optional `codeRefs?: string[]` field to DeclaredComponent interface
2. Add validation: if codeRefs exists, must be non-empty array of valid paths
3. Document: "Additional code locations beyond codeRef for multi-file components"

**Acceptance criteria:**
- Schema accepts components with codeRefs[]
- Validation fails on empty codeRefs array
- TypeScript types updated

---

## Task 2: Create Dependency Graph Module

**File:** `src/lib/system-registry/dependency-graph.ts`

**Purpose:** Build and query dependency relationships between components.

**Interface:**
```typescript
interface DependencyGraph {
  // Forward edges: component depends on these
  dependsOn: Map<string, string[]>;
  // Reverse edges: these components depend on this one
  usedBy: Map<string, string[]>;
}

function buildGraph(components: DeclaredComponent[]): DependencyGraph;
function reverseReachable(graph: DependencyGraph, startNodes: string[], maxNodes?: number): {
  components: string[];
  truncated: boolean;
};
```

**Implementation:**
1. Build forward edges from `dependencies[]` field
2. Compute reverse edges by iterating all forward edges
3. Implement BFS traversal with visited set (cycle detection)
4. Cap at MAX_NODES (50) and return truncation flag

**Tests:**
- Empty graph returns empty result
- Single node with no deps
- Linear chain A→B→C
- Cycle detection A→B→A
- Max nodes truncation
- Reverse reachable from multiple start nodes

**Acceptance criteria:**
- Graph builds correctly from declarations
- Cycles don't cause infinite loops
- Truncation works correctly

---

## Task 3: Implement Direct Impact Matching

**File:** `src/lib/system-registry/blast-radius.ts`

**Purpose:** Map changed files to affected components using codeRef matching.

**Interface:**
```typescript
interface DirectImpact {
  component: DeclaredComponent;
  matchedFiles: string[];
  matchType: 'codeRef' | 'codeRefs' | 'route_group' | 'worker' | 'integration' | 'queue';
}

function computeDirectImpact(
  changedFiles: string[],
  components: DeclaredComponent[]
): DirectImpact[];
```

**Matching rules:**
1. **LIB/INTEGRATION:** File starts with codeRef or any codeRefs[] prefix (integration root is typically `src/lib/integrations/<name>/`)
2. **ROUTE_GROUP:** File under `src/app/api/<group>/` where group from component id
3. **WORKER:** File matches worker path OR docker-compose service stanza
4. **QUEUE:** File matches allowlisted queue factory path (from governance)

**Tests:**
- Single file matches single component
- File matches multiple components (overlapping codeRefs)
- No matches returns empty
- Route group extraction from id
- codeRefs[] matching

**Acceptance criteria:**
- All component types have working matchers
- Match type is recorded for debugging
- Matched files tracked per component

---

## Task 4: Implement Transitive Impact Computation

**File:** `src/lib/system-registry/blast-radius.ts`

**Purpose:** Compute full transitive closure of affected components.

**Interface:**
```typescript
interface TransitiveImpact {
  component: DeclaredComponent;
  distance: number;  // Hops from direct impact
  pathThrough: string[];  // Component chain showing how reached
}

function computeTransitiveImpact(
  directComponents: string[],
  graph: DependencyGraph,
  maxNodes?: number
): {
  impacts: TransitiveImpact[];
  truncated: boolean;
};
```

**Implementation:**
1. Use reverseReachable from graph module
2. Track distance via BFS level
3. Track path for debugging
4. Apply max nodes cap

**Tests:**
- No transitive deps returns direct only
- Linear chain computes correct distances
- Diamond pattern (A→B, A→C, B→D, C→D) handles correctly
- Path reconstruction is accurate

**Acceptance criteria:**
- Distance calculation is correct
- Paths can be reconstructed
- Truncation works at cap

---

## Task 5: Implement Critical Path Tagging

**File:** `src/lib/system-registry/blast-radius.ts`

**Purpose:** Identify when changes affect defined critical paths.

**Interface:**
```typescript
interface CriticalPathImpact {
  pathName: string;
  distance: number;  // 0 if direct, else min hops
  impactedComponents: string[];
}

function computeCriticalPathImpacts(
  directComponents: string[],
  transitiveImpacts: TransitiveImpact[],
  criticalPaths: CriticalPath[]
): CriticalPathImpact[];
```

**Implementation:**
1. Load critical path definitions from `CRITICAL_PATHS` in declarations
2. Compute critical path hits using a separate bounded BFS (do not rely on truncated transitive sets)
3. Compute minimum distance to any path member
4. List which components in the path are affected

**Tests:**
- No critical path impact returns empty
- Direct touch has distance 0
- Transitive impact has correct distance
- Multiple paths can be impacted

**Acceptance criteria:**
- Critical paths loaded from declarations
- Distance calculation accurate
- All impacted components listed

---

## Task 6: Implement Scoring System

**File:** `src/lib/system-registry/blast-radius.ts`

**Purpose:** Compute overall blast score with tier bumping.

**Interface:**
```typescript
type Criticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface BlastScore {
  score: Criticality;
  baseScore: Criticality;
  bumps: Array<{reason: string; from: Criticality; to: Criticality}>;
}

function computeBlastScore(
  directImpacts: DirectImpact[],
  criticalPathImpacts: CriticalPathImpact[],
  governanceIssues: string[]
): BlastScore;
```

**Bump rules:**
1. Base = max criticality of direct components
2. +1 tier if any critical path impacted
3. +1 tier if team:security is owner of any direct
4. +1 tier if governance issues exist

**Tests:**
- LOW stays LOW with no bumps
- Each bump type works independently
- Multiple bumps accumulate
- CRITICAL is ceiling (can't go higher)

**Acceptance criteria:**
- Scoring matches design spec
- Bump reasons are trackable
- Works with all criticality levels

---

## Task 7: Create PR Comment Formatter

**File:** `src/lib/system-registry/formatters/pr-comment.ts`

**Purpose:** Generate markdown for PR comment.

**Interface:**
```typescript
interface BlastAnalysis {
  directImpacts: DirectImpact[];
  transitiveImpacts: TransitiveImpact[];
  criticalPathImpacts: CriticalPathImpact[];
  score: BlastScore;
  owners: string[];  // canonical team:* slugs
  truncated: boolean;
}

function formatPRComment(analysis: BlastAnalysis): string;
```

**Format (from design):**
```markdown
## 🎯 Blast Radius: {SCORE}

**You touched:** {direct component list}

**This may affect:**
- {filtered transitive with icons and reasons}

**Critical paths impacted:** {paths with distances}

**Owners to notify:** {owner list}

<details>
<summary>Full impact analysis</summary>
{tables and links}
</details>
```

**Display filtering:**
- Always show: direct, critical paths, owners
- Show transitive only if: CRITICAL/HIGH, on critical path, or ≤1 hop

**Tests:**
- Empty analysis produces minimal comment
- All sections render correctly
- Filtering rules applied
- Markdown is valid

**Acceptance criteria:**
- Output matches design format
- Filtering works correctly
- Valid markdown
- Owner mentions rendered via mapping from team:* to @fiskai/<team>

---

## Task 8: Create GitHub Check Reporter

**File:** `src/lib/system-registry/formatters/github-check.ts`

**Purpose:** Generate GitHub Check API payload.

**Interface:**
```typescript
interface CheckOutput {
  name: string;
  status: 'success' | 'neutral' | 'failure';
  conclusion: 'success' | 'neutral' | 'failure';
  title: string;
  summary: string;
  text: string;  // Detailed markdown
  annotations?: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'warning' | 'failure';
    message: string;
  }>;
}

function formatGitHubCheck(
  analysis: BlastAnalysis,
  enforcementMode: 'warn' | 'fail'
): CheckOutput;
```

**Status mapping:**
- LOW/MEDIUM → success
- HIGH → neutral (with annotation)
- CRITICAL → neutral (warn mode) or failure (fail mode)

**Tests:**
- All score levels produce correct status
- Enforcement mode affects CRITICAL handling
- Annotations omitted in v1 (empty or undefined)
- Output is valid GitHub Check format

**Acceptance criteria:**
- Valid GitHub Check API payload
- Enforcement modes work correctly
- Annotations reference correct files

---

## Task 9: Create CLI Entry Point

**File:** `src/lib/system-registry/scripts/blast-radius.ts`

**Usage:**
```bash
npx tsx src/lib/system-registry/scripts/blast-radius.ts \
  --base-sha <sha> \
  --head-sha <sha> \
  --output-format [pr-comment|github-check|json] \
  --enforcement-mode [warn|fail] \
  --write-comment  # Write to docs/system-registry/blast-radius-comment.json
```

**Implementation:**
1. Parse arguments
2. Get changed files from git diff (base/head must be present)
3. Fail with a clear error if base/head is missing or diff is empty due to shallow checkout
4. Load declarations and governance
5. Build dependency graph
6. Compute blast radius
7. Format output
8. Write to file or stdout

**Tests:**
- All output formats work
- Both enforcement modes work
- Writes to correct location
- Error handling for missing shas or shallow history

**Acceptance criteria:**
- CLI works end-to-end
- All options function correctly
- Exit codes reflect blast score

---

## Task 10: Wire into CI Workflow

**File:** `.github/workflows/registry-check.yml`

**Changes:**
1. Add blast-radius step after registry-check
2. Post PR comment using github-script action
3. Report check status

**Workflow additions:**
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # required for base/head diff
- name: Compute Blast Radius
  if: github.event_name == 'pull_request'
  run: |
    npx tsx src/lib/system-registry/scripts/blast-radius.ts \
      --base-sha ${{ github.event.pull_request.base.sha }} \
      --head-sha ${{ github.sha }} \
      --output-format json \
      --enforcement-mode warn \
      --write-comment

- name: Post PR Comment
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const comment = JSON.parse(fs.readFileSync('docs/system-registry/blast-radius-comment.json'));
      // Find and update or create comment
```

**Acceptance criteria:**
- Blast radius runs on PRs
- Comment posted/updated correctly
- Check status reported
- WARN mode active initially

---

## Task 11: Progressive Enforcement Rollout

**Timeline:**
- Sprint 0-1: WARN mode (comment + neutral check)
- Sprint 2: Enable FAIL for CRITICAL (check fails, blocks merge)

**Configuration:**
- Add `BLAST_RADIUS_ENFORCEMENT_MODE` env var
- Default to 'warn'
- CI can override per environment

**Acceptance criteria:**
- Mode can be configured via env
- FAIL mode blocks CRITICAL PRs
- Documentation updated

---

## Definition of Done

- [ ] All 11 tasks completed
- [ ] Tests passing for all modules
- [ ] TypeScript compiles without errors
- [ ] PR comments appearing on test PRs
- [ ] GitHub Check reporting correct status
- [ ] Documentation in docs/system-registry/
- [ ] WARN mode active, FAIL scheduled
