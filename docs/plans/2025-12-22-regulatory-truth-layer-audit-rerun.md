# Regulatory Truth Layer Audit Rerun Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-audit the Regulatory Truth Layer after recent fixes and update the audit report, risk registry, and GitHub issue with current findings.

**Architecture:** Perform a focused diff-driven re-review of the regulatory-truth pipeline (agents, DSL, monitoring, APIs, data models), validate tests/build, and update audit deliverables with current evidence.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, tsx tests, Node.js.

---

### Task 1: Identify change set since last audit

**Files:**

- Review: `git log`, `git show` outputs

**Step 1: List recent commits**

Run:

```bash
git log --oneline -10
```

Expected: recent commit list including regulatory-truth fixes.

**Step 2: Inspect recent regulatory-truth changes**

Run:

```bash
git show --name-only HEAD
```

Expected: file list for latest commit to scope re-review.

---

### Task 2: Re-audit AppliesWhen DSL alignment and evaluator

**Files:**

- Review: `src/lib/regulatory-truth/dsl/applies-when.ts`
- Review: `src/lib/regulatory-truth/prompts/index.ts`
- Review: `src/app/api/rules/evaluate/route.ts`

**Step 1: Inspect DSL schema and evaluator**

Run:

```bash
nl -ba src/lib/regulatory-truth/dsl/applies-when.ts | sed -n '1,240p'
```

Expected: schema and evaluation logic visible with line references.

**Step 2: Inspect prompt DSL format**

Run:

```bash
nl -ba src/lib/regulatory-truth/prompts/index.ts | sed -n '100,190p'
```

Expected: applies-when instructions in prompt.

**Step 3: Inspect evaluate endpoint behavior**

Run:

```bash
nl -ba src/app/api/rules/evaluate/route.ts | sed -n '1,140p'
```

Expected: parse/evaluate logic and invalid predicate handling.

---

### Task 3: Re-audit Sentinel discovery and change detection

**Files:**

- Review: `src/lib/regulatory-truth/agents/sentinel.ts`
- Review: `prisma/schema.prisma` (DiscoveredItem/Evidence)

**Step 1: Inspect discovery + fetch flow**

Run:

```bash
nl -ba src/lib/regulatory-truth/agents/sentinel.ts | sed -n '1,360p'
```

Expected: discovery, fetchDiscoveredItems, change detection.

**Step 2: Inspect DiscoveredItem/Evidence schema**

Run:

```bash
nl -ba prisma/schema.prisma | sed -n '1700,1755p'
```

Expected: unique constraints and evidence fields.

---

### Task 4: Re-audit conflict creation/resolution paths

**Files:**

- Review: `src/lib/regulatory-truth/agents/composer.ts`
- Review: `src/lib/regulatory-truth/agents/reviewer.ts`
- Review: `src/lib/regulatory-truth/agents/arbiter.ts`
- Review: `src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts`

**Step 1: Inspect composer conflict creation**

Run:

```bash
nl -ba src/lib/regulatory-truth/agents/composer.ts | sed -n '80,200p'
```

Expected: conflict creation data includes item IDs or pointer handling.

**Step 2: Inspect reviewer conflict creation**

Run:

```bash
nl -ba src/lib/regulatory-truth/agents/reviewer.ts | sed -n '120,210p'
```

Expected: conflict creation with itemA/itemB.

**Step 3: Inspect arbiter requirements**

Run:

```bash
nl -ba src/lib/regulatory-truth/agents/arbiter.ts | sed -n '90,170p'
```

Expected: conflict data expectations.

**Step 4: Inspect admin conflict resolution route**

Run:

```bash
nl -ba src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts | sed -n '1,140p'
```

Expected: resolution logic for item IDs.

---

### Task 5: Re-audit manual triggers and monitoring

**Files:**

- Review: `src/app/api/admin/regulatory-truth/trigger/route.ts`
- Review: `src/app/api/admin/regulatory-truth/sources/[id]/check/route.ts`
- Review: `src/lib/regulatory-truth/scripts/monitor.ts`

**Step 1: Inspect trigger endpoints**

Run:

```bash
nl -ba src/app/api/admin/regulatory-truth/trigger/route.ts | sed -n '1,120p'
```

Expected: actual pipeline execution or placeholders.

**Step 2: Inspect source check endpoint**

Run:

```bash
nl -ba src/app/api/admin/regulatory-truth/sources/[id]/check/route.ts | sed -n '1,120p'
```

Expected: actual sentinel invocation or placeholders.

**Step 3: Inspect monitoring script**

Run:

```bash
nl -ba src/lib/regulatory-truth/scripts/monitor.ts | sed -n '110,200p'
```

Expected: correct runSentinel signature usage.

---

### Task 6: Re-audit authority derivation, rate limiting, audit logging

**Files:**

- Review: `src/lib/regulatory-truth/utils/authority.ts`
- Review: `src/lib/regulatory-truth/utils/rate-limiter.ts`
- Review: `src/lib/regulatory-truth/utils/audit-log.ts`
- Review: `prisma/schema.prisma` (RegulatorySource hierarchy)

**Step 1: Inspect authority derivation logic**

Run:

```bash
nl -ba src/lib/regulatory-truth/utils/authority.ts | sed -n '1,120p'
```

Expected: hierarchy mapping or slug heuristic.

**Step 2: Inspect rate limiter enforcement**

Run:

```bash
nl -ba src/lib/regulatory-truth/utils/rate-limiter.ts | sed -n '1,200p'
```

Expected: per-minute and concurrency enforcement if implemented.

**Step 3: Inspect audit logging coverage**

Run:

```bash
nl -ba src/lib/regulatory-truth/utils/audit-log.ts | sed -n '1,120p'
```

Expected: audit event actions and usage references.

**Step 4: Inspect RegulatorySource hierarchy field**

Run:

```bash
nl -ba prisma/schema.prisma | sed -n '1650,1675p'
```

Expected: hierarchy field used or mapped in code.

---

### Task 7: Re-audit release approval integrity

**Files:**

- Review: `src/lib/regulatory-truth/agents/releaser.ts`

**Step 1: Inspect release approval fields**

Run:

```bash
nl -ba src/lib/regulatory-truth/agents/releaser.ts | sed -n '170,260p'
```

Expected: approvedBy sourced from real user approvals.

---

### Task 8: Re-run tests/build for verification

**Files:**

- Test: `src/lib/regulatory-truth/__tests__/arbiter.test.ts`
- Test: `src/lib/regulatory-truth/__tests__/sentinel.test.ts`

**Step 1: Arbiter tests**

Run:

```bash
npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts
```

Expected: PASS.

**Step 2: Sentinel tests**

Run:

```bash
npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts
```

Expected: PASS.

**Step 3: Build**

Run:

```bash
RESEND_API_KEY=dummy npm run build
```

Expected: PASS; note if any env dependencies required.

---

### Task 9: Update audit report, risk registry, and GitHub issue

**Files:**

- Modify: `docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md`
- Modify: `docs/07_AUDITS/2025-12-22-regulatory-truth-layer-risk-registry.csv`
- Update issue: GitHub issue in `Wandeon/FiskAI`

**Step 1: Update audit report with new findings and resolved items**

Edit:

- Update severity counts
- Mark resolved items
- Add new findings (if any)

**Step 2: Update risk registry**

Edit:

- Update status/notes for resolved risks
- Add any new risks

**Step 3: Update GitHub issue**

Run:

```bash
gh issue comment 80 --body "<summary of updated findings + report path>"
```

Expected: issue comment posted with updated summary.
