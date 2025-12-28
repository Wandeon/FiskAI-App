# FiskAI Documentation Map

> **Canonical documentation structure. Every concept exists in exactly one file.**
>
> Last updated: 2025-12-28

---

## Canonical Structure

```
docs/
├── 00_INDEX.md                    # Navigation hub (entry point)
├── DOC-MAP.md                     # This file
├── DOC-COVERAGE-MAP.md            # Documentation completeness tracking
│
├── 01_ARCHITECTURE/               # System architecture
│   ├── overview.md                # High-level system design
│   ├── two-layer-model.md         # Discovery + Processing layers
│   ├── trust-guarantees.md        # Evidence, no hallucinations, fail-closed
│   └── REGULATORY_TRUTH_LAYER.md  # Complete RTL architecture (PR #128)
│
├── 02_FEATURES/                   # Feature specifications (109 files)
│   ├── FEATURE_REGISTRY.md        # Master feature list (status granularity PR #124)
│   ├── COMPONENT_LIBRARY.md       # UI component inventory (PR #131)
│   └── features/                  # Individual feature specs
│       └── staff-portal.md        # Staff Portal gap analysis (PR #126)
│
├── 03_ARCHITECTURE/               # Component architecture (NEW)
│   └── AI_ASSISTANT.md            # AI Assistant system architecture (PR #127)
│
├── 03_CODEMAP/                    # Code navigation
│   ├── routes.md                  # App routes by subdomain
│   ├── components.md              # UI component inventory
│   └── apis.md                    # API endpoint reference
│
├── 04_OPERATIONS/                 # Operations and deployment
│   ├── OPERATIONS_RUNBOOK.md      # Canonical operations guide
│   ├── deployment.md              # Deployment procedures
│   ├── monitoring.md              # Monitoring and alerts
│   └── troubleshooting.md         # Common issues and fixes
│
├── 05_REGULATORY/                 # Regulatory Truth Layer
│   ├── OVERVIEW.md                # RTL system overview
│   ├── PIPELINE.md                # Processing pipeline
│   ├── AGENTS.md                  # Agent architecture
│   ├── EVIDENCE.md                # Evidence and citation system
│   └── monitoring/                # RTL monitoring docs
│
├── 06_ROADMAP/                    # Future plans
│   └── typescript-debt.md         # Tech debt tracking
│
├── 07_AUDITS/                     # Audit reports (archive)
│   ├── runs/                      # Individual audit runs
│   └── 2025-12-*/                 # Dated audit reports
│
├── _archive/                      # Historical documents
│   └── plans/                     # Completed implementation plans
│
├── _meta/                         # Meta-documentation
│   ├── audit-playbook.md          # How to run audits
│   ├── evidence-rules.md          # Evidence requirements
│   ├── invariants.md              # System invariants
│   └── inventory/                 # System inventory
│
└── _inventory/                    # Documentation inventory
    └── LEGACY-DOC-INVENTORY.md    # Classification of all docs
```

---

## Canonical Files and Sources

### Root-Level Canonical Files

| Canonical   | Sources Merged                | Status                     |
| ----------- | ----------------------------- | -------------------------- |
| `README.md` | -                             | UPGRADE (entry point only) |
| `CLAUDE.md` | `AGENTS.md`, deployment notes | UPGRADE (AI context)       |

### docs/01_ARCHITECTURE/

| Canonical                    | Sources Merged                                                  | Status |
| ---------------------------- | --------------------------------------------------------------- | ------ |
| `overview.md`                | `docs/design/architecture.md`, `PHASE1_FEATURE_ARCHITECTURE.md` | DONE   |
| `two-layer-model.md`         | `docs/regulatory-truth/` architecture sections                  | DONE   |
| `trust-guarantees.md`        | `docs/_meta/invariants.md` references                           | DONE   |
| `REGULATORY_TRUTH_LAYER.md`  | Scattered RTL docs, PR #128                                     | DONE   |

### docs/03_ARCHITECTURE/ (NEW - Component Architecture)

| Canonical          | Sources Merged                         | Status |
| ------------------ | -------------------------------------- | ------ |
| `AI_ASSISTANT.md`  | 90+ files in `/src/lib/assistant/`, PR #127 | DONE   |

### docs/04_OPERATIONS/

| Canonical               | Sources Merged                                                                            | Status |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------ |
| `OPERATIONS_RUNBOOK.md` | Exists, KEEP                                                                              | KEEP   |
| `deployment.md`         | `docs/DEPLOYMENT.md`, `QUICK_REFERENCE_DEPLOYMENT.md`, `AGENTS.md` deployment section     | MERGE  |
| `monitoring.md`         | `MONITORING_ENDPOINTS.md`, `QUICK_START_MONITORING.md`, `docs/monitoring-architecture.md` | MERGE  |
| `troubleshooting.md`    | Common issues from various docs                                                           | CREATE |

### docs/05_REGULATORY/ (NEW - consolidates regulatory-truth)

| Canonical     | Sources Merged                                                                                                            | Status |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `OVERVIEW.md` | `docs/regulatory_truth/croatian-regulatory-truth-layer.md`, `docs/regulatory_truth/croatian-regulatory-truth-layer-v2.md` | MERGE  |
| `PIPELINE.md` | `docs/plans/2024-12-21-regulatory-truth-agent-pipeline-design.md`, pipeline sections                                      | MERGE  |
| `AGENTS.md`   | `src/lib/regulatory-truth/agents/ARBITER_README.md`, `ARBITER_IMPLEMENTATION.md`                                          | MERGE  |
| `EVIDENCE.md` | `docs/regulatory-truth/evidence-pack-*.md`, citation docs                                                                 | MERGE  |

### docs/07_AUDITS/ (Consolidate all audit directories)

| Canonical         | Sources Merged                              | Status |
| ----------------- | ------------------------------------------- | ------ |
| `docs/07_AUDITS/` | `/audit/*`, `docs/audit/*`, `docs/audits/*` | MERGE  |

---

## Deprecated Files (Pointer Files)

These files will be replaced with deprecation notices pointing to canonical docs:

### Root Level

- `AGENTS.md` → Points to `CLAUDE.md`
- `README-FISCALIZATION.md` → Points to `docs/FISCALIZATION-INTEGRATION.md`
- `DASHBOARD_STRUCTURE.md` → Points to `docs/02_FEATURES/features/dashboard-*.md`
- `DESIGN_TEAM_README.md` → Points to `docs/design/`
- `GEMINI.md` → REMOVE (obsolete)
- `NEXT_STEP_BANK_RECONCILIATION.md` → Points to `docs/bank-reconciliation.md`
- `STATUS_AFTER_BARCODE.md` → REMOVE (obsolete)
- `QUICK_REFERENCE_DEPLOYMENT.md` → Points to `docs/04_OPERATIONS/deployment.md`
- `QUICK_START_BANK_RECONCILIATION.md` → Points to `docs/bank-reconciliation.md`
- `QUICK_START_MONITORING.md` → Points to `docs/04_OPERATIONS/monitoring.md`
- `MONITORING_ENDPOINTS.md` → Points to `docs/04_OPERATIONS/monitoring.md`

### docs/regulatory_truth/ (underscore version)

- All files → Points to `docs/05_REGULATORY/`

### Audit directories

- `/audit/*` → Points to `docs/07_AUDITS/`
- `docs/audit/*` → Points to `docs/07_AUDITS/`
- `docs/audits/*` → Points to `docs/07_AUDITS/`

---

## Archived Files

These are historical documents moved to `docs/_archive/`:

### Implementation Plans

All files in `docs/plans/` with dates before 2024-12-20 are considered archived.

### Phase Documents

- `PHASE-14-CHECKLIST.md`
- `PHASE-15-SUMMARY.md`
- `PHASE_16_IMPLEMENTATION.md`
- `PHASE1_FEATURE_ARCHITECTURE.md`
- `PHASE1_IMPLEMENTATION_CHECKLIST.md`
- `DESIGN_BRIEF_PHASE1_MVP.md`
- `docs/phase-14-summary.md`
- `IMPLEMENTATION-TASK-1.md`
- `TASK_6_IMPLEMENTATION_SUMMARY.md`
- `TASK_8_AI_FEEDBACK_INTEGRATION.md`
- `UNTANGLE_PLAN.md`
- `docs/LAUNCH_GAPS.md`

---

## Files Requiring No Action (KEEP)

These files are accurate and canonical:

### Root

- `CLAUDE.md` - AI context (will be upgraded)
- `MODAL_SYSTEM_USAGE.md` - Modal patterns
- `TENANT_ISOLATION_TESTS.md` - Test documentation
- `FISCALIZATION.md` - Core fiscalization docs

### docs/

- `docs/02_FEATURES/` - All 109 feature specs (FEATURE_REGISTRY.md updated PR #124)
- `docs/06_ROADMAP/` - Roadmap docs
- `docs/_meta/` - Meta documentation
- `docs/PRODUCT_BIBLE.md` - Product documentation
- `docs/RBAC.md` - Access control
- `docs/AI_*.md` - AI documentation
- `docs/BUSINESS_TYPE_MATRIX.md` - Business types
- `docs/COMPLETE_MODULE_MATRIX.md` - Module matrix
- `docs/bank-reconciliation.md` - Bank reconciliation
- `docs/FISCALIZATION-INTEGRATION.md` - Integration guide
- `docs/mobile-*.md` - Mobile documentation
- `docs/news-*.md` - News system documentation
- `docs/visibility-route-protection.md` - Route protection

### src/

- All inline READMEs in source directories

---

## Recently Added Documentation (2025-12-28)

| PR    | File                                            | Description                          |
| ----- | ----------------------------------------------- | ------------------------------------ |
| #124  | `docs/02_FEATURES/FEATURE_REGISTRY.md`          | Status granularity ([I]/[P]/[S]/[D]) |
| #125  | `docs/product-bible/09-GUIDANCE-SYSTEM.md`      | Guidance System specification        |
| #126  | `docs/02_FEATURES/features/staff-portal.md`     | Staff Portal gap analysis            |
| #127  | `docs/03_ARCHITECTURE/AI_ASSISTANT.md`          | AI Assistant architecture            |
| #128  | `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md`| RTL consolidated architecture        |
| #130  | `docs/02_FEATURES/features/staff-portal.md`     | Staff API reference added            |
| #131  | `docs/02_FEATURES/COMPONENT_LIBRARY.md`         | UI component inventory               |

---

## Verification Checklist

Before Phase 2 execution:

- [ ] Every legacy file has a classification (KEEP/MERGE/DEPRECATE/ARCHIVE)
- [ ] Every concept maps to exactly one canonical file
- [ ] No contradictory documentation exists
- [ ] Sensitive credentials removed from all docs

After Phase 2 execution:

- [ ] All deprecated files contain pointer notices
- [ ] All merged content exists in canonical files
- [ ] All archived files moved to \_archive/
- [ ] DOC-COVERAGE-MAP.md reflects final state
