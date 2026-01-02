# CI Debt Register

> Canonical document for tracking CI failures that are temporarily waived.
> All entries must have an owner and expiry date.

## Active Debt

### 1. Lint & Format: ~90 no-floating-promises errors

| Field              | Value                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **CI Job**         | `Lint & Format`                                                                                 |
| **Error Type**     | `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`             |
| **Status**         | Pre-existing on main (verified 2026-01-02)                                                      |
| **Tracking Issue** | [#1277](https://github.com/Wandeon/FiskAI/issues/1277)                                          |
| **Owner**          | team:platform                                                                                   |
| **Added**          | 2026-01-02                                                                                      |
| **Expiry**         | 2026-01-09 (7 days)                                                                             |
| **Waiver Reason**  | Pre-existing failures discovered during P0 Operational Compliance (PR #1276). Not a regression. |

**Impact:** Build job is skipped because Lint & Format fails.

### 2. Integration Tests (DB): Test isolation failure

| Field              | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **CI Job**         | `Integration Tests (DB)`                                                                                    |
| **Error Type**     | Duplicate key constraint violation in RegulatoryRule                                                        |
| **Status**         | Pre-existing on main (verified 2026-01-02)                                                                  |
| **Tracking Issue** | [#1278](https://github.com/Wandeon/FiskAI/issues/1278)                                                      |
| **Owner**          | team:rtl                                                                                                    |
| **Added**          | 2026-01-02                                                                                                  |
| **Expiry**         | 2026-01-09 (7 days)                                                                                         |
| **Waiver Reason**  | Pre-existing test isolation issue discovered during P0 Operational Compliance (PR #1276). Not a regression. |

**Impact:** Build job is skipped because Integration Tests fails.

---

## Resolved Debt

_None yet._

---

## Policy

1. **No permanent waivers.** Every entry must have an expiry date (max 14 days).
2. **Owner accountability.** Each entry must have an owner who is responsible for resolution.
3. **Issue tracking.** Every entry must link to a GitHub issue with acceptance criteria.
4. **Expiry review.** On expiry date, either fix the issue or explicitly renew with justification.
5. **No new waivers without this register.** All CI debt must be tracked here.

## Review Schedule

- Daily: Check if any entries have expired
- Weekly: Review progress on active debt
- On PR merge: Verify no new untracked debt introduced
