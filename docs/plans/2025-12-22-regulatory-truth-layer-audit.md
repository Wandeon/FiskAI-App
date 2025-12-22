# Regulatory Truth Layer Audit (2025-12-22) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Perform a comprehensive audit of the Regulatory Truth Layer per `docs/audits/2025-12-22-regulatory-truth-layer-audit-request.md`, producing evidence-backed findings, a risk registry, and a GitHub issue.

**Architecture:** Use a structured read-through of core library, prompts, schemas, APIs, and Prisma models, then validate with targeted tests and static analysis. Capture gaps across functional correctness, data integrity, AI reliability, security, knowledge graph integrity, and failure modes.

**Tech Stack:** TypeScript, Next.js (App Router), Prisma, PostgreSQL, Zod, Node.js, tsx test runner.

**Required Skills:** @superpowers:executing-plans, @superpowers:verification-before-completion

**Conditional Skills:** @superpowers:subagent-driven-development (if executing in-session)

### Task 1: Scope the audit and enumerate target files

**Files:**

- Read: `docs/audits/2025-12-22-regulatory-truth-layer-audit-request.md`
- Read: `src/lib/regulatory-truth/`
- Read: `src/app/api/rules/`
- Read: `src/app/api/admin/regulatory-truth/`
- Read: `prisma/schema.prisma`

**Step 1: Read the audit request**

Run: `sed -n '1,260p' docs/audits/2025-12-22-regulatory-truth-layer-audit-request.md`
Expected: Audit scope, functional checklist, and deliverables.

**Step 2: Enumerate core directories**

Run: `rg --files src/lib/regulatory-truth src/app/api/rules src/app/api/admin/regulatory-truth prisma/schema.prisma`
Expected: Full list of agents, prompts, schemas, APIs, and models.

### Task 2: Review schemas and DSL strictness

**Files:**

- Read: `src/lib/regulatory-truth/schemas/`
- Read: `src/lib/regulatory-truth/dsl/`

**Step 1: Inspect shared types and enums**

Run: `sed -n '1,220p' src/lib/regulatory-truth/schemas/common.ts`
Expected: Strict enums for tiers, types, and URL/date validation.

**Step 2: Inspect agent input/output schemas**

Run: `for f in src/lib/regulatory-truth/schemas/*.ts; do echo "\n## $f"; sed -n '1,260p' "$f"; done`
Expected: Consistent validation for each agent stage.

**Step 3: Evaluate DSL validators and evaluators**

Run: `sed -n '1,260p' src/lib/regulatory-truth/dsl/applies-when.ts`
Expected: Operator coverage, handling of malformed predicates, and complexity limits.

Run: `sed -n '1,220p' src/lib/regulatory-truth/dsl/outcome.ts`
Expected: Outcome types and deadline semantics.

### Task 3: Review agent pipeline logic and runner behavior

**Files:**

- Read: `src/lib/regulatory-truth/agents/*.ts`
- Read: `src/lib/regulatory-truth/utils/audit-log.ts`
- Read: `src/lib/regulatory-truth/utils/authority.ts`
- Read: `src/lib/regulatory-truth/agents/runner.ts`

**Step 1: Inspect discovery and extraction**

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/sentinel.ts`
Expected: Robust discovery, change detection, retries, and alerts.

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/extractor.ts`
Expected: Evidence fetching, extraction validation, error handling.

**Step 2: Inspect composition, review, arbitration, release**

Run: `sed -n '1,320p' src/lib/regulatory-truth/agents/composer.ts`
Expected: Conflict detection, concept linking, and source citations.

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/reviewer.ts`
Expected: Risk-tier policy enforcement and human escalation rules.

Run: `sed -n '1,340p' src/lib/regulatory-truth/agents/arbiter.ts`
Expected: Authority hierarchy enforcement and escalation logic.

Run: `sed -n '1,240p' src/lib/regulatory-truth/agents/releaser.ts`
Expected: Release content hashing, versioning, and audit trail integrity.

**Step 3: Inspect agent runner for timeouts and retry strategy**

Run: `sed -n '1,260p' src/lib/regulatory-truth/agents/runner.ts`
Expected: Input/output validation, retry with backoff, and logging of failures.

### Task 4: Review parsers, rate limiting, scheduler, and monitoring

**Files:**

- Read: `src/lib/regulatory-truth/parsers/`
- Read: `src/lib/regulatory-truth/utils/`
- Read: `src/lib/regulatory-truth/monitoring/metrics.ts`
- Read: `src/lib/regulatory-truth/scheduler/cron.ts`

**Step 1: Inspect parsers**

Run: `sed -n '1,220p' src/lib/regulatory-truth/parsers/sitemap-parser.ts`
Expected: XML parsing resilience and error handling.

Run: `sed -n '1,220p' src/lib/regulatory-truth/parsers/html-list-parser.ts`
Expected: Selector robustness and pagination safety.

**Step 2: Inspect rate limiter and content hash**

Run: `sed -n '1,220p' src/lib/regulatory-truth/utils/rate-limiter.ts`
Expected: Backoff, circuit breaker, and cap enforcement.

Run: `sed -n '1,160p' src/lib/regulatory-truth/utils/content-hash.ts`
Expected: Stable normalization and hash integrity.

**Step 3: Inspect monitoring and scheduler**

Run: `sed -n '1,200p' src/lib/regulatory-truth/monitoring/metrics.ts`
Expected: Coverage for pipeline health and errors.

Run: `sed -n '1,200p' src/lib/regulatory-truth/scheduler/cron.ts`
Expected: Non-overlapping runs and timezone correctness.

### Task 5: Review prompts and AI guardrails

**Files:**

- Read: `src/lib/regulatory-truth/prompts/*.md`

**Step 1: Inspect all agent prompts**

Run: `for f in src/lib/regulatory-truth/prompts/*.md; do echo "\n## $f"; sed -n '1,240p' "$f"; done`
Expected: Clear output schemas, citation requirements, and anti-hallucination guidance.

### Task 6: Review API routes and access controls

**Files:**

- Read: `src/app/api/rules/`
- Read: `src/app/api/admin/regulatory-truth/`

**Step 1: Inspect public rules APIs**

Run: `rg --files src/app/api/rules | xargs -n 1 sed -n '1,220p'`
Expected: Input validation, safe query handling, and auth policies.

**Step 2: Inspect admin routes**

Run: `rg --files src/app/api/admin/regulatory-truth | xargs -n 1 sed -n '1,220p'`
Expected: ADMIN auth checks and error handling.

### Task 7: Review Prisma models and data integrity constraints

**Files:**

- Read: `prisma/schema.prisma`

**Step 1: Inspect regulatory-truth models**

Run: `rg -n "RegulatorySource|Evidence|SourcePointer|RegulatoryRule|RegulatoryConflict|RuleRelease|AgentRun|DiscoveryEndpoint|DiscoveredItem|Concept|GraphEdge|RegulatoryAuditLog" prisma/schema.prisma`
Expected: All core models present with constraints and indexes.

**Step 2: Review model definitions in full**

Run: `sed -n '1600,1980p' prisma/schema.prisma`
Expected: Correct enums, relations, and on-delete behavior.

### Task 8: Run targeted tests and build checks

**Files:**

- Read: `src/lib/regulatory-truth/__tests__/arbiter.test.ts`
- Read: `src/lib/regulatory-truth/__tests__/sentinel.test.ts`

**Step 1: Run arbiter tests**

Run: `npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts`
Expected: PASS.

**Step 2: Run sentinel tests**

Run: `npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts`
Expected: PASS; note failures and root cause if not.

**Step 3: Run build (if env allows)**

Run: `npm run build`
Expected: PASS; document missing env if it fails.

### Task 9: Compile findings, risk registry, and report

**Files:**

- Create: `docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md`
- Create: `docs/07_AUDITS/2025-12-22-regulatory-truth-layer-risk-registry.csv`

**Step 1: Draft audit report**

Run: `cat <<'REPORT' > docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md

# Regulatory Truth Layer Audit Findings (2025-12-22)

## Scope

- Regulatory Truth Layer (agents, schemas, DSL, parsers, utils, scheduler, monitoring)
- Prompting and AI guardrails
- API routes and access controls
- Prisma models and data integrity
- Targeted tests and build checks

## Findings

- [ ] Finding 1 (severity): evidence and file references

## Gaps / Risks

- [ ] Gap 1: evidence

## Recommendations

- [ ] Recommendation 1

## Tests

- Arbiter tests: PASS/FAIL (output summary)
- Sentinel tests: PASS/FAIL (output summary)
- Build: PASS/FAIL (output summary)
  REPORT`
  Expected: Report template created for audit writeup.

**Step 2: Draft risk registry CSV**

Run: `cat <<'CSV' > docs/07_AUDITS/2025-12-22-regulatory-truth-layer-risk-registry.csv
id,risk,likelihood,impact,mitigation,owner
R1,Placeholder risk,Medium,High,Mitigation TBD,TBD
CSV`
Expected: CSV template created.

### Task 10: Prepare GitHub issue draft

**Files:**

- Read: `docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md`

**Step 1: Summarize findings for issue body**

Run: `sed -n '1,200p' docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md`
Expected: Extracted summary for GitHub issue body.

**Step 2: Create GitHub issue (if configured)**

Run: `gh issue create --title "Regulatory Truth Layer audit findings (2025-12-22)" --body-file docs/07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md`
Expected: Issue URL returned. If `gh` not configured, provide a manual issue draft in response.
