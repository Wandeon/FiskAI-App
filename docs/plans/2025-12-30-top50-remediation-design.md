# Top 50 Production Issues Remediation Design

**Goal:** Fix the remaining high-priority issues from the top-50 triage list in a single branch, excluding infra-only tasks.

## Scope

**In scope**

- All remaining P0 and P1 issues from `docs/reports/2025-12-30-open-issues-triage.md`.
- Selected P2 security/compliance/data-integrity issues from the same report.
- A short re-verification step to drop issues already closed or superseded since the report was generated.

**Out of scope (deferred)**

- Infra-only tasks requiring operational changes:
  - #587 credential rotation (secrets in git history)
  - #675 storage retention lifecycle policy (11-year retention)
  - #628 malware/virus scanning pipeline

## Approach

- **Order:** P0 first, then P1, then selected P2 items.
- **Isolation:** One issue per commit, with the issue number in the commit message.
- **Fix strategy:** Prefer adding/adjusting tests for reproducible failures; otherwise add precise guards/validation with manual verification notes.
- **Security fixes:** Enforce tenant scoping, authorization checks, and signature verification; reduce bypass conditions.
- **Data integrity:** Add or correct constraints/indexes; tighten validation and concurrency control.
- **Fiscalization:** Correct validation and race conditions; add defensive checks around external dependencies.
- **Billing:** Add idempotency, authorization checks, and consistent state transitions.

## Verification

- Run targeted tests or scripts for each subsystem as changes are made.
- Add minimal new tests where gaps are the direct cause of the defect.
- Document manual verification steps when tests are not feasible.

## Deliverables

- Single branch containing all in-scope fixes.
- Issue comments with a short summary and verification evidence.
- Final status report listing fixed vs deferred items.

## Risks and Mitigations

- **Large change surface:** Use one-issue commits for easy review and rollback.
- **Interdependent changes:** Re-run relevant tests after each subsystem block.
- **Unclear reproduction:** Add defensive checks and document manual verification.
