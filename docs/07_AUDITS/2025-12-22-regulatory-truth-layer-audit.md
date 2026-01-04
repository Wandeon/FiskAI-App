# Regulatory Truth Layer Audit (Rerun)

Date: 2025-12-22
Version: 1.1
Scope: Regulatory truth layer backend (agents, pipeline, storage, APIs, monitoring, audit logging)

## Executive Summary

Overall assessment: NOT production ready.

Go/No-Go recommendation: NO-GO until Critical findings are addressed.

Key themes:

- Composer conflict handling is still broken: SOURCE_CONFLICT now writes SourcePointer IDs into rule conflict fields, which violates the RegulatoryRule foreign key and prevents Arbiter/Admin resolution.
- Operational control improved (pipeline trigger now runs real phases, monitoring signature fixed), but the source-specific check endpoint remains a placeholder.
- Audit trail coverage improved for evidence fetches and human approvals, but conflict creation in Reviewer and manual conflict resolution still lack audit events.

Severity counts:

- Critical: 1
- High: 0
- Medium: 6
- Low: 2

## Scope and Methodology

- Static code review of regulatory-truth layer, agents, utilities, database schema, and API routes.
- Focus on functional correctness, data integrity, auditability, and operational readiness.
- No live data or production infrastructure access.
- No external source crawling or manual legal validation against Croatian regulations.

### Tests Executed

- npx tsx --test src/lib/regulatory-truth/**tests**/arbiter.test.ts (pass)
- npx tsx --test src/lib/regulatory-truth/**tests**/sentinel.test.ts (pass)
- RESEND_API_KEY=dummy npm run build (pass)

## Resolved Since Previous Audit

- AppliesWhen DSL now aligns with evaluator JSON format.
- Sentinel re-queues previously fetched URLs and tracks content changes.
- Monitoring script uses the correct runSentinel signature.
- Audit logging added for evidence creation and rule approve/reject actions.
- Agent runner now has request timeouts (AbortController).
- Release approvals now use actual approver IDs from rules.
- Search endpoint validates enums and applies rate limiting.
- Evaluate endpoint has rate limiting and a guardrail max rule limit.

## Detailed Findings

### Critical Findings

CRIT-01: Composer SOURCE_CONFLICT writes SourcePointer IDs into rule conflict fields

- Evidence:
  - Composer uses sourcePointerIds for itemAId/itemBId in src/lib/regulatory-truth/agents/composer.ts:90-101.
  - RegulatoryConflict itemAId/itemBId reference RegulatoryRule in prisma/schema.prisma:1896-1913.
  - Arbiter requires itemA/itemB rules in src/lib/regulatory-truth/agents/arbiter.ts:94-143.
  - Admin conflict resolution validates rule IDs in src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts:24-60.
- Impact: Conflict creation can fail with foreign key violations or create unresolvable conflicts; Arbiter/Admin cannot process SOURCE_CONFLICT entries.
- Recommendation: Keep itemAId/itemBId null for SOURCE_CONFLICT and store SourcePointer IDs in metadata, or add explicit SourcePointer relations and update Arbiter/Admin to support pointer-level conflicts.

### Medium Findings

MED-01: Source-specific check endpoint remains a placeholder

- Evidence:
  - src/app/api/admin/regulatory-truth/sources/[id]/check/route.ts:35-55.
- Impact: Operators cannot manually re-check a single source without running broader phases.
- Recommendation: Invoke Sentinel for the specified source or enqueue a targeted job.

MED-02: Audit log missing reviewer conflict creation and manual conflict resolution

- Evidence:
  - Reviewer creates conflicts without audit log in src/lib/regulatory-truth/agents/reviewer.ts:136-156.
  - Admin conflict resolve route updates status without audit log in src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts:76-85.
- Impact: Conflict decisions are not fully traceable for legal defense.
- Recommendation: Log CONFLICT_CREATED and CONFLICT_RESOLVED with actor metadata for reviewer/admin actions.

MED-03: Authority derivation still ignores RegulatorySource.hierarchy in composer

- Evidence:
  - Composer uses deriveAuthorityLevel (slug heuristic) in src/lib/regulatory-truth/agents/composer.ts:137-142.
  - Async hierarchy mapping exists but is unused in src/lib/regulatory-truth/utils/authority.ts:25-46.
- Impact: Authority levels may be misclassified, affecting conflict precedence and rule ordering.
- Recommendation: Use deriveAuthorityLevelAsync or map hierarchy in composer.

MED-04: Rate limiter does not enforce maxRequestsPerMinute or maxConcurrentRequests

- Evidence:
  - src/lib/regulatory-truth/utils/rate-limiter.ts:3-71.
- Impact: Sources may be over-polled, risking rate limits or bans.
- Recommendation: Implement per-minute counters and concurrency gating.

MED-05: Evaluate endpoint caps rule evaluation at 1000

- Evidence:
  - src/app/api/rules/evaluate/route.ts:49-79.
- Impact: When published rules exceed 1000, evaluation may skip relevant rules.
- Recommendation: Paginate or pre-filter rules by metadata to avoid skipping.

MED-06: AppliesWhen between allows missing bounds

- Evidence:
  - src/lib/regulatory-truth/dsl/applies-when.ts:71-76 and 213-222.
- Impact: A between predicate with no bounds can evaluate true for any numeric value.
- Recommendation: Require at least one bound or reject invalid predicates.

### Low Findings

LOW-01: Invalid appliesWhen predicates are skipped silently

- Evidence:
  - src/app/api/rules/evaluate/route.ts:95-111.
- Impact: Users receive incomplete results without explicit warnings.
- Recommendation: Return a warning list of invalid rule IDs in the response.

LOW-02: AI provider mismatch vs audit request

- Evidence:
  - Agent runner uses OLLAMA\_\* env vars in src/lib/regulatory-truth/agents/runner.ts:9-23.
  - Audit request specifies Anthropic Claude.
- Impact: Documentation drift and operational confusion.
- Recommendation: Align docs with implementation or implement Anthropic client.

## Readiness and Roadmap

Immediate fixes before production:

1. Fix Composer SOURCE_CONFLICT to avoid invalid itemAId/itemBId and support pointer-level conflicts.
2. Add audit logging for reviewer-created conflicts and admin conflict resolution.
3. Implement source-specific manual checks (or a job queue) for operational recovery.

Near-term improvements:

- Use RegulatorySource.hierarchy for authority derivation.
- Enforce rate limit configuration (maxRequestsPerMinute/maxConcurrentRequests).
- Replace the 1000-rule cap with pagination or filtered evaluation.
- Require bounds for AppliesWhen between.

## Risk Registry

See docs/07_AUDITS/2025-12-22-regulatory-truth-layer-risk-registry.csv for current status.

## Open Questions

- Should SOURCE_CONFLICTs be represented using SourcePointer relations instead of Rule relations?
- What is the intended operational behavior for source-specific checks (sync vs job queue)?
- Should appliesWhen be stored as JSON object instead of JSON string for consistency?

## Appendix: Files Reviewed

- src/lib/regulatory-truth/agents/\*
- src/lib/regulatory-truth/dsl/\*
- src/lib/regulatory-truth/utils/\*
- src/lib/regulatory-truth/scripts/\*
- src/app/api/rules/\*
- src/app/api/admin/regulatory-truth/\*
- prisma/schema.prisma
