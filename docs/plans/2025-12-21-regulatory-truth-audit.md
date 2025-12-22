# Regulatory Truth Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit the Croatian Regulatory Truth Layer per `docs/regulatory-truth/AUDIT_GUIDE.md` and produce concrete, evidence-backed findings plus a GitHub issue draft.

**Architecture:** Perform a structured read-through of the core library (agents, schemas, DSL, parsers, utilities, scheduler), API routes, and Prisma models, then corroborate with existing tests and monitoring. Capture gaps in validation, authority hierarchy, conflict resolution, security, and operational controls.

**Tech Stack:** TypeScript, Next.js (app router), Prisma, Zod, Node.js, tsx test runner.

**Required Skills:** @superpowers:executing-plans, @superpowers:verification-before-completion

**Conditional Skills:** @superpowers:subagent-driven-development (if executing in-session)

### Task 1: Scope the audit and enumerate target files

**Files:**

- Read: `docs/regulatory-truth/AUDIT_GUIDE.md`
- Read: `src/lib/regulatory-truth/`
- Read: `src/app/(admin)/regulatory/`
- Read: `src/app/api/admin/regulatory-truth/`
- Read: `src/app/api/regulatory/`

**Step 1: Read audit guide**

Run: `sed -n '1,260p' docs/regulatory-truth/AUDIT_GUIDE.md`
Expected: See system overview, key files, tests, and audit questions.

**Step 2: Enumerate core directories**

Run: `rg --files src/lib/regulatory-truth src/app/api/admin/regulatory-truth src/app/api/regulatory src/app/(admin)/regulatory`
Expected: File list for agent pipeline, schemas, DSL, parsers, utils, scheduler, monitoring, and UI/API routes.

### Task 2: Review schemas and DSL strictness

**Files:**

- Read: `src/lib/regulatory-truth/schemas/common.ts`
- Read: `src/lib/regulatory-truth/schemas/*.ts`
- Read: `src/lib/regulatory-truth/dsl/applies-when.ts`
- Read: `src/lib/regulatory-truth/dsl/outcome.ts`

**Step 1: Inspect common schema types and enums**

Run: `sed -n '1,220p' src/lib/regulatory-truth/schemas/common.ts`
Expected: Zod schemas for shared types (SourcePointer, RiskTier) with constraints.

**Step 2: Inspect all agent input/output schemas**

Run: `for f in src/lib/regulatory-truth/schemas/*.ts; do echo "\n## $f"; sed -n '1,260p' "$f"; done`
Expected: Schema coverage for every agent stage with strict validation and enumerations.

**Step 3: Evaluate AppliesWhen and Outcome DSLs**

Run: `sed -n '1,260p' src/lib/regulatory-truth/dsl/applies-when.ts`
Expected: Evaluation logic and validation for operators, types, and edge cases.

Run: `sed -n '1,220p' src/lib/regulatory-truth/dsl/outcome.ts`
Expected: Outcome structure, deadline rules, and type guard coverage.

### Task 3: Review agent pipeline logic and conflict resolution

**Files:**

- Read: `src/lib/regulatory-truth/agents/sentinel.ts`
- Read: `src/lib/regulatory-truth/agents/extractor.ts`
- Read: `src/lib/regulatory-truth/agents/composer.ts`
- Read: `src/lib/regulatory-truth/agents/reviewer.ts`
- Read: `src/lib/regulatory-truth/agents/arbiter.ts`
- Read: `src/lib/regulatory-truth/agents/releaser.ts`
- Read: `src/lib/regulatory-truth/agents/runner.ts`

**Step 1: Inspect discovery and extraction flow**

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/sentinel.ts`
Expected: Source discovery, fetch, and dedup logic with retries and rate limiting.

Run: `sed -n '1,240p' src/lib/regulatory-truth/agents/extractor.ts`
Expected: Extraction pipeline with validation and error handling.

**Step 2: Inspect rule drafting and review**

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/composer.ts`
Expected: Rule composition with citations and consistent status handling.

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/reviewer.ts`
Expected: Quality gates, risk tier policy enforcement, and schema validation.

**Step 3: Inspect conflict resolution and release**

Run: `sed -n '1,340p' src/lib/regulatory-truth/agents/arbiter.ts`
Expected: Authority hierarchy logic and conflict resolution rules.

Run: `sed -n '1,240p' src/lib/regulatory-truth/agents/releaser.ts`
Expected: Publish path with safeguards and audit logging.

**Step 4: Inspect shared runner framework**

Run: `sed -n '1,220p' src/lib/regulatory-truth/agents/runner.ts`
Expected: Consistent error handling, retries, and tracing metrics.

### Task 4: Review parsers, utilities, scheduler, and monitoring

**Files:**

- Read: `src/lib/regulatory-truth/parsers/sitemap-parser.ts`
- Read: `src/lib/regulatory-truth/parsers/html-list-parser.ts`
- Read: `src/lib/regulatory-truth/utils/rate-limiter.ts`
- Read: `src/lib/regulatory-truth/utils/content-hash.ts`
- Read: `src/lib/regulatory-truth/monitoring/metrics.ts`
- Read: `src/lib/regulatory-truth/scheduler/cron.ts`

**Step 1: Inspect parsers for robustness and edge cases**

Run: `sed -n '1,220p' src/lib/regulatory-truth/parsers/sitemap-parser.ts`
Expected: XML parse error handling, pagination, and malformed XML recovery.

Run: `sed -n '1,220p' src/lib/regulatory-truth/parsers/html-list-parser.ts`
Expected: HTML selector resilience and change tolerance.

**Step 2: Inspect rate limiting and hashing**

Run: `sed -n '1,220p' src/lib/regulatory-truth/utils/rate-limiter.ts`
Expected: Backoff strategy, circuit breaker thresholds, and shared limiter usage.

Run: `sed -n '1,120p' src/lib/regulatory-truth/utils/content-hash.ts`
Expected: Stable hashing and normalization rules.

**Step 3: Inspect monitoring and scheduling**

Run: `sed -n '1,200p' src/lib/regulatory-truth/monitoring/metrics.ts`
Expected: Metric coverage for runs, errors, and latency.

Run: `sed -n '1,200p' src/lib/regulatory-truth/scheduler/cron.ts`
Expected: Proper timezone handling and guardrails for overlapping runs.

### Task 5: Review API routes and UI security constraints

**Files:**

- Read: `src/app/api/admin/regulatory-truth/**/*`
- Read: `src/app/api/regulatory/**/*`
- Read: `src/app/(admin)/regulatory/**/*`

**Step 1: Inspect admin API routes for auth and validation**

Run: `rg --files src/app/api/admin/regulatory-truth | xargs -n 1 sed -n '1,220p'`
Expected: `getCurrentUser()` checks with ADMIN role guards and input validation.

**Step 2: Inspect public API routes**

Run: `rg --files src/app/api/regulatory | xargs -n 1 sed -n '1,220p'`
Expected: Auth requirements for `/trigger`, safe public response for `/status`.

**Step 3: Inspect admin UI access guards**

Run: `rg --files src/app/(admin)/regulatory | xargs -n 1 sed -n '1,220p'`
Expected: Server-side auth or layout guards enforcing ADMIN role.

### Task 6: Review Prisma models and data integrity

**Files:**

- Read: `prisma/schema.prisma`

**Step 1: Locate schema file**

Run: `rg --files -g 'schema.prisma'`
Expected: Path to Prisma schema (typically `prisma/schema.prisma`).

**Step 2: Inspect regulatory-truth models**

Run: `sed -n '1,260p' prisma/schema.prisma`
Expected: Models for sources, evidence, rules, conflicts, releases, agent runs with constraints and indexes.

### Task 7: Run targeted tests

**Files:**

- Read: `src/lib/regulatory-truth/__tests__/arbiter.test.ts`
- Read: `src/lib/regulatory-truth/__tests__/sentinel.test.ts`

**Step 1: Run arbiter tests**

Run: `npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts`
Expected: PASS with all tests.

**Step 2: Run sentinel tests**

Run: `npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts`
Expected: PASS with all tests.

### Task 8: Compile findings and draft report

**Files:**

- Create: `docs/07_AUDITS/2025-12-21-regulatory-truth-audit.md`

**Step 1: Document findings with evidence and risk tiers**

Run: `cat <<'REPORT' > docs/07_AUDITS/2025-12-21-regulatory-truth-audit.md

# Regulatory Truth Audit Findings (2025-12-21)

## Scope

- Regulatory Truth Layer (agents, schemas, DSL, parsers, utils, scheduler, monitoring)
- Admin and public API routes
- Prisma models
- Targeted tests

## Findings

- [ ] Finding 1 (severity): evidence and file references

## Gaps / Risks

- [ ] Gap 1: evidence

## Recommendations

- [ ] Recommendation 1

## Tests

- Arbiter tests: PASS/FAIL (output summary)
- Sentinel tests: PASS/FAIL (output summary)
  REPORT`
  Expected: Markdown report template created for audit writeup.

### Task 9: Prepare GitHub issue draft

**Files:**

- Read: `docs/07_AUDITS/2025-12-21-regulatory-truth-audit.md`

**Step 1: Summarize findings for issue body**

Run: `sed -n '1,200p' docs/07_AUDITS/2025-12-21-regulatory-truth-audit.md`
Expected: Extracted summary to use in GitHub issue.

**Step 2: Create GitHub issue (if configured)**

Run: `gh issue create --title "Regulatory Truth audit findings (2025-12-21)" --body-file docs/07_AUDITS/2025-12-21-regulatory-truth-audit.md`
Expected: Issue created, returning URL. If `gh` not configured, prepare a manual issue draft in the response.
