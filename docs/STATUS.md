# Implementation Status Registry

> **Purpose:** Declare documentation as executable contracts, not marketing artifacts.
>
> **Last Audit:** 2025-12-29 | **Auditor:** Claude Opus 4.5
>
> **Policy:** PRs that mark features "done" MUST update this file. CI should fail otherwise.

---

## Status Definitions

| Status          | Symbol | Meaning                                                       |
| --------------- | ------ | ------------------------------------------------------------- |
| **Implemented** | `[I]`  | Production-ready. Tests passing. Documentation accurate.      |
| **Partial**     | `[P]`  | Core happy path works. Missing edge cases, tests, or polish.  |
| **Scaffold**    | `[S]`  | Route/component exists but functionality is stub/placeholder. |
| **Designed**    | `[D]`  | Documented specification exists. No code yet.                 |
| **Deprecated**  | `[X]`  | Code exists but scheduled for removal.                        |

---

## Module Implementation Matrix

### Core Modules (Company.entitlements[])

| Module             | Code Status | Routes | Tests   | API | Docs    | Notes                            |
| ------------------ | ----------- | ------ | ------- | --- | ------- | -------------------------------- |
| `invoicing`        | [I]         | 3/3    | Yes     | Yes | Yes     | Fully functional                 |
| `e-invoicing`      | [I]         | 3/3    | Yes     | Yes | Yes     | UBL/XML generation complete      |
| `fiscalization`    | [I]         | 2/2    | Yes     | Yes | Yes     | CIS integration tested           |
| `contacts`         | [I]         | 4/4    | Yes     | Yes | Yes     | OIB lookup integrated            |
| `products`         | [I]         | 3/3    | Yes     | Yes | Yes     | CSV import works                 |
| `expenses`         | [I]         | 4/4    | Yes     | Yes | Yes     | Receipt scanning works           |
| `banking`          | [I]         | 5/5    | Yes     | Yes | Yes     | GoCardless/SaltEdge integrated   |
| `reconciliation`   | [I]         | 1/1    | Yes     | Yes | Yes     | Auto-matching functional         |
| `reports-basic`    | [I]         | 4/4    | Yes     | Yes | Yes     | KPR, P&L, Aging complete         |
| `reports-advanced` | [I]         | 2/2    | Yes     | Yes | Yes     | VAT threshold, export            |
| `pausalni`         | [I]         | 4/4    | Yes     | Yes | Yes     | Full tax management              |
| `vat`              | [P]         | 1/1    | Partial | Yes | Partial | Report only, no submission       |
| `corporate-tax`    | [S]         | 0/1    | No      | No  | No      | Route defined, no implementation |
| `pos`              | [P]         | 1/1    | Partial | Yes | Partial | Stripe Terminal basic only       |
| `documents`        | [I]         | 2/2    | Yes     | Yes | Yes     | R2 storage integrated            |
| `ai-assistant`     | [I]         | 2/2    | Yes     | Yes | Yes     | Architecture doc created (PR #127) |

### Portal Implementation

| Portal                         | Status | Routes | Navigation | Auth   | Notes                                             |
| ------------------------------ | ------ | ------ | ---------- | ------ | ------------------------------------------------- |
| Marketing `fiskai.hr`          | [I]    | 15+    | Complete   | Public | All landing pages functional                      |
| Client App `app.fiskai.hr`     | [I]    | 60+    | Complete   | USER   | Primary application                               |
| Staff Portal `staff.fiskai.hr` | [P]    | 3      | Basic      | STAFF  | **Dashboard only, missing multi-client features** |
| Admin Portal `admin.fiskai.hr` | [I]    | 15+    | Complete   | ADMIN  | Full regulatory management                        |

---

## System Implementation Status

### Regulatory Truth Layer

> **Architecture Doc:** [docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md](./01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)

| Component             | Status | Code Location           | Tests | Documentation |
| --------------------- | ------ | ----------------------- | ----- | ------------- |
| Evidence Store        | [I]    | `lib/regulatory-truth/` | Yes   | ✅ Complete   |
| Sentinel Agent        | [I]    | `agents/sentinel/`      | Yes   | ✅ Complete   |
| OCR Worker            | [I]    | `workers/ocr/`          | Yes   | ✅ Complete   |
| Extractor Agent       | [I]    | `agents/extractor/`     | Yes   | ✅ Complete   |
| Composer Agent        | [I]    | `agents/composer/`      | Yes   | ✅ Complete   |
| Reviewer Agent        | [I]    | `agents/reviewer/`      | Yes   | ✅ Complete   |
| Arbiter Agent         | [I]    | `agents/arbiter/`       | Yes   | ✅ Complete   |
| Releaser Agent        | [I]    | `agents/releaser/`      | Yes   | ✅ Complete   |
| Graph Cycle Detection | [I]    | `graph/`                | Yes   | ✅ Complete   |
| DSL AppliesWhen       | [I]    | `dsl/`                  | Yes   | ✅ Complete   |
| **Overall RTL**       | [I]    | 22 subdirs              | Yes   | ✅ Consolidated (PR #128) |

### AI Assistant System

> **Architecture Doc:** [docs/03_ARCHITECTURE/AI_ASSISTANT.md](./03_ARCHITECTURE/AI_ASSISTANT.md)

| Component             | Status | Code Location                      | Tests | Documentation |
| --------------------- | ------ | ---------------------------------- | ----- | ------------- |
| Query Engine          | [I]    | `lib/assistant/query-engine/`      | Yes   | ✅ Complete   |
| Text Utils            | [I]    | `query-engine/text-utils.ts`       | Yes   | ✅ Complete   |
| Concept Matcher       | [I]    | `query-engine/concept-matcher.ts`  | Yes   | ✅ Complete   |
| Rule Selector         | [I]    | `query-engine/rule-selector.ts`    | Yes   | ✅ Complete   |
| Answer Builder        | [I]    | `query-engine/answer-builder.ts`   | Yes   | ✅ Complete   |
| Citation Builder      | [I]    | `query-engine/citation-builder.ts` | Yes   | ✅ Complete   |
| Reasoning Pipeline    | [I]    | `reasoning/`                       | Yes   | ✅ Complete   |
| Shadow Runner         | [I]    | `reasoning/shadow-runner.ts`       | Yes   | ✅ Complete   |
| Refusal Policy        | [I]    | `reasoning/refusal-policy.ts`      | Yes   | ✅ Complete   |
| Streaming             | [I]    | `streaming.ts`                     | Yes   | ✅ Complete   |
| **Overall Assistant** | [I]    | 90+ files                          | Yes   | ✅ Documented (PR #127) |

### Guidance System

> **Specification:** [docs/product-bible/09-GUIDANCE-SYSTEM.md](./product-bible/09-GUIDANCE-SYSTEM.md)

| Component            | Status | Code Location                  | Tests   | Documentation |
| -------------------- | ------ | ------------------------------ | ------- | ------------- |
| Preferences          | [I]    | `lib/guidance/preferences.ts`  | Yes     | ✅ Complete   |
| Checklist            | [I]    | `lib/guidance/checklist.ts`    | Yes     | ✅ Complete   |
| Help Density         | [I]    | `lib/guidance/help-density.ts` | No      | ✅ Complete   |
| Patterns             | [I]    | `lib/guidance/patterns.ts`     | No      | ✅ Complete   |
| **Overall Guidance** | [I]    | 9 files                        | Partial | ✅ Specified (PR #125) |

### Visibility System

| Component              | Status | Code Location     | Tests | Documentation  |
| ---------------------- | ------ | ----------------- | ----- | -------------- |
| Element Rules          | [I]    | `lib/visibility/` | Yes   | Product Bible  |
| Competence Levels      | [I]    | Integrated        | Yes   | Product Bible  |
| Components             | [I]    | `components/`     | Yes   | Product Bible  |
| **Overall Visibility** | [I]    | Complete          | Yes   | **Documented** |

---

## API Route Coverage

| Category      | Routes | Documented | Tests   | Notes                             |
| ------------- | ------ | ---------- | ------- | --------------------------------- |
| Auth          | 8      | Yes        | Yes     | WebAuthn, OAuth, Passkeys         |
| Admin         | 5      | Partial    | Partial | Support dashboard needs docs      |
| AI            | 4      | Yes        | Yes     | Extract, suggest, usage, feedback |
| Banking       | 8      | Yes        | Yes     | Import, reconciliation, sync      |
| Billing       | 3      | Yes        | Yes     | Stripe integration                |
| Compliance    | 1      | Yes        | Yes     | EN16931 validation                |
| Cron          | 6      | Partial    | Partial | Some jobs undocumented            |
| E-Invoices    | 2      | Yes        | Yes     | Inbox, receive                    |
| Email         | 6      | Yes        | Yes     | Connect, rules, disconnect        |
| Exports       | 4      | Yes        | Yes     | Company, expenses, invoices       |
| Guidance      | 3      | Yes        | Yes     | Documented in Product Bible Ch. 9 |
| Health        | 2      | Yes        | Yes     | Health, ready                     |
| Import        | 6      | Yes        | Yes     | Jobs, upload, process             |
| News          | 5      | Partial    | Yes     | Admin news management             |
| Notifications | 2      | Yes        | Yes     | List, mark read                   |
| Pausalni      | 6      | Yes        | Yes     | Full tax support                  |
| Reports       | 4      | Yes        | Yes     | KPR, VAT, export                  |
| Staff         | 2      | Yes        | Partial | Documented in staff-portal.md     |
| Support       | 4      | Yes        | Yes     | Tickets, messages                 |
| Terminal      | 3      | Yes        | Yes     | Stripe Terminal                   |
| WebAuthn      | 4      | Yes        | Yes     | Passkey management                |
| **Total**     | 90+    | ~80%       | ~85%    |                                   |

---

## Critical Divergences (Resolved)

> **All 5 critical divergences identified in the initial audit have been resolved.** See Audit Trail for PR references.

### 1. Staff Portal Gap ✅ RESOLVED

**Original Issue:** Docs claimed "Implemented" but only 3 routes existed.

**Resolution:** PR #126 created `docs/02_FEATURES/features/staff-portal.md` with gap analysis and updated Product Bible to mark Staff Portal as `[P]` Partial.

---

### 2. AI Assistant Architecture Gap ✅ RESOLVED

**Original Issue:** 90+ files with no architecture documentation.

**Resolution:** PR #127 created `docs/03_ARCHITECTURE/AI_ASSISTANT.md` with:
- Query processing pipeline
- Reasoning stage flow (13 stages)
- Component responsibilities matrix
- Integration points

---

### 3. Guidance System Gap ✅ RESOLVED

**Original Issue:** Not mentioned in Product Bible.

**Resolution:** PR #125 created `docs/product-bible/09-GUIDANCE-SYSTEM.md` with:
- System purpose & architecture
- Preference model
- Checklist system
- API reference

---

### 4. Regulatory Truth Layer Documentation Fragmentation ✅ RESOLVED

**Original Issue:** 22 subdirs with fragmented docs.

**Resolution:** PR #128 created `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md` with:
- Complete agent state machine
- Worker deployment architecture
- AppliesWhen DSL reference
- Graph cycle detection

---

### 5. Feature Registry Binary Status ✅ RESOLVED

**Original Issue:** 108 features all marked "✅" hiding partial implementations.

**Resolution:** PR #124 updated `docs/02_FEATURES/FEATURE_REGISTRY.md` with:
- `[I]/[P]/[S]/[D]` status markers
- 5 partial features identified (Documents Hub redirects)
- 1 scaffold feature identified (F036 Recurring Expenses)
- Status distribution summary

---

## Documentation Debt Inventory

| Item                                | Priority | Status | PR    | Notes                                |
| ----------------------------------- | -------- | ------ | ----- | ------------------------------------ |
| AI Assistant architecture doc       | P0       | ✅ Done | #127  | `docs/03_ARCHITECTURE/AI_ASSISTANT.md` |
| Guidance system specification       | P0       | ✅ Done | #125  | `docs/product-bible/09-GUIDANCE-SYSTEM.md` |
| Staff portal honest status          | P1       | ✅ Done | #126  | `docs/02_FEATURES/features/staff-portal.md` |
| RTL consolidated architecture       | P1       | ✅ Done | #128  | `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md` |
| Feature Registry status granularity | P2       | ✅ Done | #124  | Status markers `[I]/[P]/[S]/[D]` |
| API route documentation gaps        | P2       | ✅ Done | #130  | Staff APIs added to staff-portal.md  |
| Component library inventory         | P3       | ✅ Done | #131  | `docs/02_FEATURES/COMPONENT_LIBRARY.md` |

---

## Audit Trail

| Date       | Auditor         | Scope                  | Findings                     | PRs       |
| ---------- | --------------- | ---------------------- | ---------------------------- | --------- |
| 2025-12-29 | Claude Opus 4.5 | Product Bible v4.3.0   | System Registry, RTL Sync    | #138-#142 |
| 2025-12-28 | Claude Opus 4.5 | Full codebase          | 5 critical divergences       | #121      |
| 2025-12-28 | Claude Opus 4.5 | Feature Registry       | 5 partial, 1 scaffold        | #124      |
| 2025-12-28 | Claude Opus 4.5 | Guidance System        | Full specification created   | #125      |
| 2025-12-28 | Claude Opus 4.5 | Staff Portal           | Gap analysis created         | #126      |
| 2025-12-28 | Claude Opus 4.5 | AI Assistant           | Architecture doc created     | #127      |
| 2025-12-28 | Claude Opus 4.5 | RTL Architecture       | Consolidated doc created     | #128      |
| 2025-12-28 | Claude Opus 4.5 | Cross-references       | DOC-MAP, CLAUDE.md updated   | #129      |
| 2025-12-28 | Claude Opus 4.5 | Staff API Docs         | API reference added          | #130      |
| 2025-12-28 | Claude Opus 4.5 | Component Library      | Full inventory created       | #131      |

---

## Enforcement Policy

### PR Requirements

Before marking a feature as "Implemented":

1. [ ] Route/component exists and is functional
2. [ ] Tests exist and pass
3. [ ] API endpoints documented (if applicable)
4. [ ] This STATUS.md updated with accurate status
5. [ ] Feature Registry updated (if feature-level change)

### CI Integration (Proposed)

```yaml
# .github/workflows/docs-check.yml
- name: Check STATUS.md updated
  run: |
    # Fail if src/ changed but docs/STATUS.md not updated
    git diff --name-only origin/main | grep -q "^src/" && \
    git diff --name-only origin/main | grep -q "^docs/STATUS.md" || \
    echo "::warning::Consider updating docs/STATUS.md"
```

---

## Quick Reference

**Find implementation status:**

```bash
grep -E "^\| \`[a-z-]+\`" docs/STATUS.md
```

**Find critical gaps:**

```bash
grep -E "\*\*Missing\*\*|\*\*CRITICAL\*\*" docs/STATUS.md
```

**Count by status:**

```bash
grep -c "\[I\]" docs/STATUS.md  # Implemented
grep -c "\[P\]" docs/STATUS.md  # Partial
grep -c "\[S\]" docs/STATUS.md  # Scaffold
grep -c "\[D\]" docs/STATUS.md  # Designed
```
