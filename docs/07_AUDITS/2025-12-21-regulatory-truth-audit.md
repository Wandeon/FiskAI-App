# Regulatory Truth Audit Findings (2025-12-21)

## Scope

- Regulatory Truth Layer (agents, schemas, DSL, parsers, utils, scheduler, monitoring)
- Admin and public API routes
- Prisma models
- Targeted tests

## Findings

1. High: Extraction phase crashes due to invalid `runExtractor` argument.
   Evidence: `src/app/api/regulatory/trigger/route.ts:33` calls `runExtractor(20)` but `runExtractor` expects a string evidence ID `src/lib/regulatory-truth/agents/extractor.ts:26`.
   Impact: `/api/regulatory/trigger` with `phase=extraction` likely fails, blocking pipeline progression.

2. High: Conflict pipeline is not wired and authority hierarchy defaults for all rules.
   Evidence: Composer returns error on conflicts without creating a `RegulatoryConflict` or invoking arbiter `src/lib/regulatory-truth/agents/composer.ts:87`. Reviewer maps `ESCALATE_ARBITER` to `PENDING_REVIEW` without conflict creation `src/lib/regulatory-truth/agents/reviewer.ts:112`. `RegulatoryRule.authorityLevel` defaults to GUIDANCE and composer never sets it `prisma/schema.prisma:1792`, `src/lib/regulatory-truth/agents/composer.ts:103`.
   Impact: Conflicts never reach arbiter and authority hierarchy does not reflect source reality.

3. High: Release content hash ignores rule content.
   Evidence: `computeContentHash` only hashes `id` and `conceptSlug` `src/lib/regulatory-truth/agents/releaser.ts:60`.
   Impact: Releases can change content without changing hash, undermining audit integrity and change detection.

4. Medium: Rate limiter does not enforce configured request caps.
   Evidence: `maxRequestsPerMinute` and `maxConcurrentRequests` are defined but never enforced `src/lib/regulatory-truth/utils/rate-limiter.ts:3`, `src/lib/regulatory-truth/utils/rate-limiter.ts:46`.
   Impact: The system may exceed intended limits and risk upstream bans despite config claiming protection.

5. Medium: Admin status conflict counts use non-existent statuses.
   Evidence: `status` route counts conflicts with `detected`/`investigating` `src/app/api/admin/regulatory-truth/status/route.ts:140` but the enum only allows OPEN/RESOLVED/ESCALATED `prisma/schema.prisma:1603`.
   Impact: Monitoring dashboards will under-report conflicts.

6. Medium: Overnight runner uses non-existent fields and statuses.
   Evidence: Script queries `releaseId`, status `ACTIVE`, and table `RegulatoryRelease` `src/lib/regulatory-truth/scripts/overnight-run.ts:186`; schema uses `RuleRelease` and status `PUBLISHED` `prisma/schema.prisma:1587`, `prisma/schema.prisma:1850`.
   Impact: Nightly pipeline release and final status queries will error in production.

7. Medium: Release audit trail keys mismatch between writer and UI.
   Evidence: Release writer stores snake_case keys `source_evidence_count` `src/lib/regulatory-truth/agents/releaser.ts:206`, but UI reads camelCase `sourceEvidenceCount` `src/app/(admin)/regulatory/releases/releases-view.tsx:146`.
   Impact: Audit trail appears as zeros in the admin UI.

8. Medium: Sentinel tests fail under documented command.
   Evidence: Sentinel test imports Vitest `src/lib/regulatory-truth/__tests__/sentinel.test.ts:3`; `npx tsx --test` fails with Vitest CJS import error.
   Impact: Tests cannot run as documented, reducing confidence in pipeline validation.

9. Low: Reject route records rejections as approvals.
   Evidence: Rejection sets `approvedBy`/`approvedAt` `src/app/api/admin/regulatory-truth/rules/[id]/reject/route.ts:45`.
   Impact: Audit trail cannot distinguish approvals from rejections.

10. Low: Auto-approve policy constants are unused and mismatched.
    Evidence: `AUTO_APPROVE_THRESHOLDS` sets T3 to 0.9 `src/lib/regulatory-truth/schemas/common.ts:80` but reviewer hardcodes 0.95 `src/lib/regulatory-truth/agents/reviewer.ts:96`.
    Impact: Policy drift and unexpected auto-approve behavior.

## Gaps / Risks

- AppliesWhen `between` allows both bounds to be omitted, making the predicate effectively always true for numeric values `src/lib/regulatory-truth/dsl/applies-when.ts:23`.
- "Public" regulatory status/trigger routes are ADMIN-only (docs mismatch) `src/app/api/regulatory/status/route.ts:9`.
- Composer input schema does not validate domain/confidence against enums/limits `src/lib/regulatory-truth/schemas/composer.ts:12`.

## Recommendations

- Wire conflict creation and arbiter invocation; derive `authorityLevel` from source hierarchy.
- Fix extraction API to operate on evidence IDs or add a batch extractor.
- Include full rule content in release content hashes; align auditTrail field names with UI.
- Enforce configured rate limits and fix overnight-run SQL to match schema.

## Tests

- Arbiter tests: PASS (`npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts`)
- Sentinel tests: FAIL (`npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts`) - Vitest CJS import error
