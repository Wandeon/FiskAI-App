# System Registry: Phases 2-4 Design

> Design document for Runtime Reality, Change Intelligence, and Externalization phases.
>
> **Created:** 2025-12-28
> **Status:** Approved for implementation
> **Context:** Phase 1 (Operational Truth & Governance) is complete and enforcing

## Executive Summary

This document defines three phases that build on the System Registry foundation:

| Phase | Name | Priority | ROI Driver |
|-------|------|----------|------------|
| **3** | Change Intelligence | **HIGH** | Developer velocity - "what will I break?" |
| **2** | Runtime Reality | LOW | Operational metadata (not monitoring) |
| **4** | Externalization | MEDIUM | Audit/compliance exports |

**Recommendation:** Implement Phase 3 first. It provides the highest value for a team without senior engineers ("vibecoded" context) by making tribal knowledge explicit at PR time.

---

## Phase 3: Change Intelligence

### Purpose

Answer "What does this PR affect?" before merge, surfacing blast radius and required reviewers automatically.

### Design Principles

1. **Full transitive compute, critical-path weighted display** - Calculate complete dependency graph but only surface what matters
2. **Comment is primary interface** - Human-readable summary with CEO-level clarity
3. **Check is enforcement backstop** - Machine-readable gate with links to details
4. **Progressive enforcement** - WARN first, FAIL after team adapts

### Data Model Additions

```typescript
interface DeclaredComponent {
  // Existing fields (id, type, name, owner, criticality, codeRef, etc.)

  // NEW: Multi-file support
  codeRefs?: string[];           // Additional code locations beyond codeRef

  // Existing but now computed
  dependencies?: string[];       // Components this depends on (declared)
  usedBy?: string[];             // Reverse edges (computed at CI time)
}
```

**Dependency semantics:**
- `dependencies[]`: Declared relationship - "this component depends on X"
- `usedBy[]`: Computed at CI time by inverting all `dependencies[]` edges
- Edge direction: A depends on B means changes to B may break A

### Blast Radius Computation

#### Step 1: Direct Impact Set

Map changed files to components using codeRef matching:

```
changedFiles → prefix match against codeRef/codeRefs → directComponents
```

**Matching rules by component type:**

| Type | Match Pattern |
|------|---------------|
| LIB | `codeRef` prefix (e.g., `src/lib/auth/` matches `src/lib/auth/session.ts`) |
| ROUTE_GROUP | `src/app/api/<group>/...` where group is extracted from id |
| WORKER | Worker TS file path OR docker-compose service stanza |
| INTEGRATION | `codeRef`/`codeRefs` prefix (typically `src/lib/integrations/<name>/`) |
| QUEUE | Queue factory file path (allowlisted constructor paths) |

#### Step 2: Transitive Impact Set

Compute all components that depend on (directly or transitively) the impacted components:

```typescript
function reverseReachable(directComponents: string[], graph: DependencyGraph): TransitiveResult {
  const visited = new Set<string>();
  const result: string[] = [];
  const queue = [...directComponents];

  while (queue.length > 0 && result.length < MAX_NODES_CAP) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;  // Cycle detection
    visited.add(current);
    result.push(current);

    // Add all components that depend on current
    for (const dependent of graph.usedBy[current] ?? []) {
      queue.push(dependent);
    }
  }

  return {
    components: result,
    truncated: result.length >= MAX_NODES_CAP
  };
}
```

**Safety constraints:**
- `MAX_NODES_CAP = 50` to prevent runaway on highly connected graphs
- Cycle detection via visited set
- Return truncation flag so UI can indicate incomplete analysis
- Critical path tagging must run independently of any truncated transitive set (separate bounded BFS that stops on path hits)

#### Step 3: Critical Path Tagging

For each critical path defined in declarations (`CRITICAL_PATHS`), compute distance from direct impact:

```typescript
interface CriticalPathImpact {
  pathName: string;           // e.g., "billing", "fiscalization"
  distance: number;           // 0 = directly touched, N = N hops away
  impactedThrough: string[];  // Components in the path that are affected
}
```

Distance calculation:
- `0` if any direct component is on the critical path
- Otherwise, minimum hop count from any direct component to any path member

### Display Filtering

**Always show:**
- Direct components (files you touched)
- Impacted critical paths (even if transitive)
- Owners of all shown components

**Show transitive components only if:**
- Criticality is CRITICAL or HIGH
- On a defined critical path
- Within 1 hop of direct impact

This prevents information overload while ensuring CRITICAL issues surface.

### Scoring System

```typescript
function computeBlastScore(analysis: BlastAnalysis): Criticality {
  // Base = max criticality of direct components
  let score = maxCriticality(analysis.directComponents);

  // +1 tier if critical path impacted
  if (analysis.criticalPathImpacts.length > 0) {
    score = bumpTier(score);
  }

  // +1 tier if SECURITY-owned component touched
  if (analysis.directComponents.some(c => c.owner === 'team:security')) {
    score = bumpTier(score);
  }

  // +1 tier if governance issues exist
  if (analysis.governanceIssues.length > 0) {
    score = bumpTier(score);
  }

  return score;
}
```

Tier progression: `LOW → MEDIUM → HIGH → CRITICAL`

### PR Comment Format

```markdown
## 🎯 Blast Radius: HIGH

**You touched:** `lib-auth`, `route-group-users`

**This may affect:**
- 🔴 `worker-subscription-sync` (CRITICAL, 1 hop)
- 🟠 `integration-stripe` (HIGH, on billing path)

**Critical paths impacted:** Billing (distance: 1)

**Owners to notify:** @fiskai/security, @fiskai/billing

<details>
<summary>Full impact analysis</summary>

### Direct Impact (2 components)
| Component | Type | Criticality | Owner |
|-----------|------|-------------|-------|
| lib-auth | LIB | CRITICAL | @fiskai/security |
| route-group-users | ROUTE_GROUP | HIGH | @fiskai/platform |

### Transitive Impact (showing 3 of 12)
| Component | Distance | Why Shown |
|-----------|----------|-----------|
| worker-subscription-sync | 1 | CRITICAL |
| integration-stripe | 2 | On billing path |
| lib-billing | 1 | CRITICAL |

[View full drift report →](link-to-check-details)

</details>
```

Owner mentions in PR comments are rendered via a mapping from `team:*` slugs to GitHub teams; registry remains canonical as `team:*`.

### GitHub Check Configuration

**Check name:** `registry/blast-radius`

**Status mapping:**
| Blast Score | Check Status | Enforcement (Sprint 0-1) | Enforcement (Sprint 2+) |
|-------------|--------------|--------------------------|------------------------|
| LOW | success | Pass | Pass |
| MEDIUM | success | Pass | Pass |
| HIGH | neutral | Pass (with annotation) | Pass (with annotation) |
| CRITICAL | neutral | Pass (with warning) | **Fail** |

**Check output includes:**
- Summary line with blast score
- List of required reviewers based on owner overlap
- Link to detailed drift report in `docs/system-registry/`
- Remediation suggestions if governance issues found
- No file/line annotations in v1 (summary only); annotations can be added later with diff parsing

### CI Integration

```yaml
# .github/workflows/registry-check.yml additions
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # needed for git diff between base/head
- name: Compute Blast Radius
  run: |
    npx tsx src/lib/system-registry/scripts/blast-radius.ts \
      --base-sha ${{ github.event.pull_request.base.sha }} \
      --head-sha ${{ github.sha }} \
      --output-format github-check \
      --write-comment

- name: Post PR Comment
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const comment = require('./docs/system-registry/blast-radius-comment.json');
      // Upsert comment logic
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/system-registry/blast-radius.ts` | Core computation logic |
| `src/lib/system-registry/scripts/blast-radius.ts` | CLI entry point |
| `src/lib/system-registry/dependency-graph.ts` | Graph building and traversal |

### Implementation Tasks

1. **Add codeRefs[] support to schema** - Allow components to declare multiple code locations
2. **Build dependency graph module** - Parse dependencies[], compute usedBy[]
3. **Implement direct impact matching** - Map changed files to components
4. **Implement transitive computation** - reverseReachable with safety bounds
5. **Implement critical path tagging** - Distance calculation (from CRITICAL_PATHS, independent BFS)
6. **Implement scoring system** - Tier bumping logic
7. **Create PR comment formatter** - Markdown generation + owner mention mapping
8. **Create GitHub Check reporter** - Status and output
9. **Wire into CI** - GitHub Actions workflow additions
10. **Progressive rollout** - Start with WARN, schedule FAIL date

---

## Phase 2: Runtime Reality

### Purpose

Capture operational metadata (health checks, SLOs, alert routing) in the registry without building monitoring infrastructure.

### Design Principle

The registry is a **source of truth for metadata**, not a monitoring system. It captures:
- Where to check health
- What SLOs are expected
- Where to route alerts

It does NOT:
- Execute health checks
- Verify SLOs
- Route alerts

Those are the jobs of existing infrastructure (Prometheus, PagerDuty, etc.).

### Schema Additions

```typescript
interface DeclaredComponent {
  // Existing fields...

  // NEW: Operational metadata
  healthCheck?: {
    endpoint?: string;      // HTTP endpoint, e.g., "/health", "/api/health"
    command?: string;       // Shell command, e.g., "pg_isready -h localhost"
    interval?: string;      // Suggested check interval, e.g., "30s"
  };

  slo?: {
    availability?: string;  // Target availability, e.g., "99.9%"
    latencyP50?: string;    // p50 latency target, e.g., "100ms"
    latencyP99?: string;    // p99 latency target, e.g., "500ms"
    errorBudget?: string;   // Monthly error budget, e.g., "0.1%"
  };

  alertChannel?: string;    // Alert destination, e.g., "#ops-critical", "pagerduty:billing"
  runbook?: string;         // Link to runbook, e.g., "docs/runbooks/auth-failure.md"
}
```

### Validation Rules

| Rule | Severity | Condition |
|------|----------|-----------|
| `critical-needs-health` | WARN | CRITICAL components SHOULD have healthCheck |
| `service-needs-slo` | WARN | WORKER/INTEGRATION components SHOULD have slo |
| `slo-needs-alert` | FAIL | Components with slo MUST have alertChannel |
| `runbook-exists` | WARN | runbook path SHOULD exist on disk |

### Implementation Tasks

1. **Extend schema.ts** - Add healthCheck, slo, alertChannel, runbook fields
2. **Add validation rules** - New enforcement rules in compute-drift.ts
3. **Update declarations** - Add metadata to existing CRITICAL components
4. **Document patterns** - Add examples to governance.ts comments

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/system-registry/schema.ts` | Add new optional fields |
| `src/lib/system-registry/compute-drift.ts` | Add validation rules |
| `src/lib/system-registry/declarations.ts` | Add metadata to CRITICAL components |

---

## Phase 4: Externalization

### Purpose

Generate audit-ready exports for compliance, regulatory reporting, and external tooling.

### Export Formats

#### 1. Ownership Matrix (CSV)

For spreadsheet analysis and compliance audits:

```csv
component_id,type,name,owner,criticality,codeRef,dependencies,last_verified
lib-auth,LIB,Auth Library,team:security,CRITICAL,src/lib/auth/,"lib-db,lib-config",2025-01-15
integration-stripe,INTEGRATION,Stripe Integration,team:billing,HIGH,src/lib/integrations/stripe/,"lib-billing",2025-01-15
```

**Use cases:**
- Quarterly ownership review
- Compliance audit evidence
- Executive reporting

#### 2. Regulatory Evidence Pack (ZIP)

For regulatory submissions and audits:

```
regulatory-export-2025-01-15/
├── manifest.json           # Export metadata
├── ownership-matrix.csv    # Full ownership data
├── critical-paths.json     # Critical path definitions
├── drift-report.md         # Current drift state
├── governance-config.json  # Governance rules snapshot
└── component-details/      # Per-component detail files
    ├── lib-auth.json
    ├── lib-billing.json
    └── ...
```

**Use cases:**
- Regulatory audit submissions
- Due diligence packages
- SOC 2 evidence collection

#### 3. Drift History (JSON Lines)

For trend analysis and incident correlation:

```jsonl
{"timestamp":"2025-01-15T10:00:00Z","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":false}
{"timestamp":"2025-01-15T10:05:00Z","component":"lib-auth","issue":"owner_missing","severity":"CRITICAL","resolved":true,"resolution":"added team:security"}
{"timestamp":"2025-01-15T11:00:00Z","component":"worker-ocr","issue":"codeRef_invalid","severity":"HIGH","resolved":false}
```

**Use cases:**
- Drift trend analysis
- Incident post-mortems
- Compliance timeline evidence

### CLI Commands

```bash
# Export current state as CSV
npx tsx src/lib/system-registry/scripts/export.ts --format csv

# Generate regulatory evidence pack
npx tsx src/lib/system-registry/scripts/export.ts --format regulatory-pack

# Export drift history since date
npx tsx src/lib/system-registry/scripts/export.ts --format drift-history --since 2025-01-01

# All exports write to docs/system-registry/exports/
```

### Storage Strategy

- Exports written to `docs/system-registry/exports/`
- Drift history stored in `docs/system-registry/drift-history.jsonl` (append-only, committed by scheduled CI)
- Exports git-committed for audit trail when needed (manual, not automatic)
- CI generates on-demand exports via workflow dispatch
- Old exports retained for 1 year minimum

### Implementation Tasks

1. **Create export module** - Core export logic with format handlers
2. **Implement CSV exporter** - Ownership matrix generation
3. **Implement regulatory pack** - ZIP creation with all artifacts
4. **Implement drift history** - JSON Lines with timestamp tracking
5. **Create CLI script** - Command-line interface
6. **Add workflow dispatch** - GitHub Actions for on-demand exports
7. **Add scheduled history capture** - Append drift history to JSONL on main

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/system-registry/export.ts` | Core export logic |
| `src/lib/system-registry/scripts/export.ts` | CLI entry point |
| `src/lib/system-registry/exporters/csv.ts` | CSV format handler |
| `src/lib/system-registry/exporters/regulatory-pack.ts` | ZIP pack handler |
| `src/lib/system-registry/exporters/drift-history.ts` | JSONL handler |

---

## Implementation Order

Based on ROI analysis (developer velocity primary, vibecoded team context):

### Sprint 1: Phase 3 - Change Intelligence (Core)

**Tasks:**
1. Add codeRefs[] to schema
2. Build dependency graph module
3. Implement direct impact matching
4. Implement transitive computation
5. Implement scoring system

**Deliverable:** Local blast radius computation via CLI

### Sprint 2: Phase 3 - Change Intelligence (CI)

**Tasks:**
1. Implement critical path tagging
2. Create PR comment formatter
3. Create GitHub Check reporter
4. Wire into CI (WARN mode)
5. Add required reviewers logic

**Deliverable:** PR comments with blast radius, WARN-only enforcement

### Sprint 3: Phase 3 - Enforcement + Phase 4 Start

**Tasks:**
1. Enable FAIL enforcement for CRITICAL blast
2. Create export module structure
3. Implement CSV exporter
4. Implement regulatory pack exporter

**Deliverable:** Full Phase 3 enforcement, basic exports

### Sprint 4: Phase 2 + Phase 4 Completion

**Tasks:**
1. Add operational metadata to schema
2. Add Phase 2 validation rules
3. Update CRITICAL components with metadata
4. Implement drift history exporter
5. Add workflow dispatch for exports

**Deliverable:** All three phases complete

---

## Success Metrics

### Phase 3: Change Intelligence
- **Adoption:** >80% of PRs have blast radius comment
- **Accuracy:** <5% false positive rate on reviewer suggestions
- **Impact:** Reduce "I didn't know this would break X" incidents by 50%

### Phase 2: Runtime Reality
- **Coverage:** 100% of CRITICAL components have healthCheck
- **Completeness:** All components with SLO have alertChannel

### Phase 4: Externalization
- **Audit readiness:** Can generate evidence pack in <1 minute
- **Trend visibility:** Drift history enables weekly trend review

---

## Appendix: Critical Paths

Critical paths are defined in `src/lib/system-registry/declarations.ts` and represent business-critical flows:

| Path | Components | Why Critical |
|------|------------|--------------|
| billing | lib-billing, integration-stripe, worker-subscription-sync | Revenue |
| fiscalization | lib-fiscal, integration-fina-cis | Legal compliance |
| auth | lib-auth, route-group-auth | Security boundary |
| data | lib-db, queue-* | Data integrity |

Changes affecting critical paths get +1 tier bump in blast scoring.

---

## Appendix: Governance Integration

Phase 3 computation uses governance.ts for:
- Owner validation rules
- Queue constructor allowlist
- Excluded patterns (don't flag as drift)
- Criticality thresholds

Critical paths are sourced from declarations (`CRITICAL_PATHS`).

Any changes to governance.ts require CODEOWNERS approval (@fiskai/platform + @fiskai/security).
