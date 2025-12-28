# System Registry Verification - Engineering Feedback

> **Date:** 2025-12-28
> **Auditor:** Claude Opus 4.5 (Deterministic Harvester)
> **Scope:** Full codebase audit

---

## 1) Observed Inventory Summary

* **Total observed components:** 110
* **By type:**
  - UI: 4
  - MODULE: 16
  - ROUTE_GROUP: 37
  - WORKER: 10
  - JOB: 12
  - QUEUE: 10
  - STORE: 3
  - INTEGRATION: 6
  - LIB: 12

* **Where inventory is incomplete and why:**
  - **Runtime endpoints not scanned:** Health/metrics endpoints exist but runtime observation not performed (v1 is code-only)
  - **SaltEdge integration:** Referenced in docs but no code wrapper found - may be deprecated or merged with GoCardless
  - **Email templates:** Templates exist in `src/lib/email/templates/` but not inventoried as separate components

---

## 2) Drift Summary

### ObservedNotDeclared (highest risk)

| componentId | discovered at | owner guess | why it matters |
|-------------|---------------|-------------|----------------|
| route-group-auth | src/app/api/auth/ | Unknown | Security boundary - authentication endpoints |
| route-group-billing | src/app/api/billing/ | Unknown | Money movement - Stripe integration |
| route-group-webauthn | src/app/api/webauthn/ | Unknown | Authentication - passkey management |
| lib-auth | src/lib/auth/ | Unknown | Core security library |
| lib-fiscal | src/lib/fiscal/ | Unknown | Fiscalization logic - legal requirement |
| lib-billing | src/lib/billing/ | Unknown | Billing/subscription logic |
| job-fiscal-processor | src/app/api/cron/fiscal-processor/ | Unknown | Fiscal batch processing |
| job-certificate-check | src/app/api/cron/certificate-check/ | Unknown | Fiscal certificate expiry monitoring |
| queue-release | src/lib/regulatory-truth/workers/queues.ts | Unknown | Final step in regulatory publication |
| All 37 API route groups | src/app/api/*/ | Unknown | Entire API surface is undeclared |

### DeclaredNotObserved (rot risk)

* **NONE** - All declared components have corresponding code.

### Metadata gaps

* **No owner:** 40 (100% of declared components)
* **No docs link:** 17 components
* **No codeRef:** 3 components (integration-gocardless, integration-ollama, lib-billing)
* **No dependencies defined:** 15 components

---

## 3) "Forgotten Implementations"

List of things that exist but no one explicitly owns or documents:

| Component | Location | What it does | Risk |
|-----------|----------|--------------|------|
| `lib-billing` | src/lib/billing/ | Stripe subscription management, plan enforcement | CRITICAL |
| `lib-cache` | src/lib/cache/ | Caching layer, unclear usage | MEDIUM |
| `lib-middleware` | src/lib/middleware/ | Subdomain routing, critical for portal separation | HIGH |
| `job-bank-sync` | src/app/api/cron/bank-sync/ | Automatic bank transaction sync | HIGH |
| `job-email-sync` | src/app/api/cron/email-sync/ | Email inbox sync for expense extraction | MEDIUM |
| `queue-deadletter` | queues.ts | Failed job handling - no monitoring | HIGH |
| `worker-scheduler` | docker-compose.workers.yml | Schedules RTL jobs, not in declared registry | HIGH |
| `route-group-sandbox` | src/app/api/sandbox/ | Unknown purpose - test endpoint? | LOW |
| All 12 cron jobs | src/app/api/cron/*/ | Background automation with no declared ownership | VARIES |

---

## 4) "Duplicate Systems"

Same responsibility implemented twice:

| Responsibility | Implementation 1 | Implementation 2 | Resolution |
|----------------|------------------|------------------|------------|
| Bank connectivity | `route-group-bank` (3 endpoints) | `route-group-banking` (7 endpoints) | Appears intentional: bank = connection setup, banking = transaction management. **Recommend:** Merge or clearly document separation |
| AI endpoints | `route-group-ai` (4 endpoints) | `route-group-assistant` (5 endpoints) | Appears intentional: ai = extraction/suggestions, assistant = Q&A. **Recommend:** Document boundary |
| News processing | `job-fetch-news` | `job-news-fetch-classify` | May be duplicate. **Investigate** |

---

## 5) Recommendation: Registry Authority

**Choice: [x] TS is source of truth, DB stores obs/history**

**Justification:**

1. **Existing pattern:** FiskAI already uses TS config files as authority (module definitions, feature registry). Keeping consistency reduces cognitive load.

2. **Git auditability:** TS files in git provide natural audit trail for declaration changes. DB changes would need separate audit logging.

3. **CI enforcement:** Easier to enforce "must be in registry" checks against a TS file in CI than against DB state.

4. **v1 simplicity:** No new DB migrations required. Can ship faster.

5. **Migration path:** TS source of truth can migrate to DB later if needed. Starting with DB is harder to reverse.

**Commitment for v1:**
- Drift detection script runs in CI
- Audit trail via git history
- Admin UI shows drift report
- Enforcement on MODULE and WORKER types

---

## 6) Minimum scope for v1

What we can ship in 1 week that meets non-negotiables:

### Day 1-2: Registry Definition
- [ ] Create `src/lib/system-registry/schema.ts` with component types
- [ ] Create `src/lib/system-registry/declarations.ts` with all 110 components declared
- [ ] Add owner field (can be "unassigned" initially)

### Day 3-4: Harvesters
- [ ] `harvest-modules.ts` - Scan module definitions
- [ ] `harvest-routes.ts` - Scan API route groups
- [ ] `harvest-workers.ts` - Scan docker-compose.workers.yml
- [ ] `harvest-cron.ts` - Scan cron route directories
- [ ] `compute-drift.ts` - Compare declared vs observed

### Day 5: CI Integration
- [ ] Add `npm run registry:check` script
- [ ] Add CI step that fails if new module/worker not declared
- [ ] Add GitHub Action for drift report on PR

### Day 6-7: Admin UI
- [ ] Create `/admin/registry` route
- [ ] Overview tab: counts by type/status
- [ ] Drift tab: ObservedNotDeclared, MetadataGaps
- [ ] Component detail: metadata + dependencies

---

## 7) Risks / blockers

| Risk | Mitigation |
|------|------------|
| **No assigned owners** | Accept "unassigned" as valid status for v1, require assignment for CRITICAL components |
| **37 route groups to declare** | Generate initial declarations from observed inventory, bulk import |
| **Team may resist registration overhead** | Start enforcement with only MODULE and WORKER types, expand gradually |
| **Dependency graph incomplete** | Accept partial graph in v1, flag missing deps as metadata gap |
| **Runtime observation not in v1** | Explicitly mark as "code-only" observation, add runtime in v2 |

---

## Decision Points (Answers)

### 1. Authority model

**Decision:** TS canonical

- `src/lib/system-registry/declarations.ts` is source of truth
- DB stores: observation history, audit log, health snapshots
- Admin UI reads from both: declarations (TS via import) + observations (DB)

### 2. Component ID strategy

**Decision:** Slug format with type prefix

Pattern: `{type}-{name-kebab}`

Examples:
- `module-invoicing`
- `route-group-admin`
- `worker-sentinel`
- `job-fiscal-processor`
- `queue-deadletter`
- `store-postgresql`
- `integration-stripe`
- `lib-auth`

**Ownership:** Registry maintainer (to be assigned) owns naming. PR review enforces consistency.

### 3. Dependency capture

**Decision:** Manual in v1, with partial inference hints

- All dependencies manually declared in registry
- CI script can warn if obvious deps missing (e.g., worker references queue but no dep declared)
- Full inference deferred to v2

### 4. Runtime observation

**Decision:** Code-only in v1

- Harvesters scan files only
- No `/api/health` or `/api/metrics` polling
- Add runtime observation in v2 with health endpoint aggregation

---

## Artifacts Produced

| File | Purpose |
|------|---------|
| `docs/system-registry/observed-inventory.json` | Deterministic code scan output |
| `docs/system-registry/declared-registry.json` | Current declared state (needs expansion) |
| `docs/system-registry/drift-report.md` | Human-readable drift analysis |
| `docs/system-registry/drift-report.json` | Machine-readable drift data |
| `docs/system-registry/ENGINEERING_FEEDBACK.md` | This document |

---

## Next Steps

1. **Review this feedback** - Confirm decisions on authority model, component ID strategy
2. **Assign owners** - At minimum for CRITICAL components
3. **Expand declarations** - Add all 70 observed-not-declared components
4. **Implement harvesters** - Deterministic, no LLM heuristics
5. **Build Admin UI** - Drift visibility is non-negotiable
6. **Add CI enforcement** - Start with MODULE and WORKER types

---

**Policy to adopt immediately:**

> "If it's observed and not declared, it is treated as production risk until triaged."

This single policy stops the "forgotten system" problem.
