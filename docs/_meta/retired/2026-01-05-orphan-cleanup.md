# Filesystem Cleanup Record

**Date:** 2026-01-05  
**Executor:** Systems Librarian (AI)  
**Approver:** Human operator

## Files Moved

| Source                                                         | Destination                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/home/admin/docs/plans/2025-12-20-device-security-audit.md`   | `docs/plans/archived/`                                            |
| `/home/admin/docs/plans/2026-01-02-operation-shatter-audit.md` | `docs/plans/archived/`                                            |
| `/home/admin/BUILD_ERRORS_ANALYSIS.md`                         | `docs/audits/_archive/2025-12-13-build-errors-analysis.md`        |
| `/home/admin/security-audit-report.md`                         | `docs/audits/_archive/2025-12-20-device-security-audit-report.md` |

## Files Deleted

| File                                                  | Reason                                  |
| ----------------------------------------------------- | --------------------------------------- |
| `/home/admin/docs/audit/public-pages-master-audit.md` | Duplicate of canonical at `docs/audit/` |
| `/home/admin/node_modules/`                           | 175MB orphan npm installation           |
| `/home/admin/package.json`                            | Orphan manifest                         |
| `/home/admin/package-lock.json`                       | Orphan lockfile                         |

## Directories Removed

- `/home/admin/docs/` (orphan documentation root)

## Rationale

Filesystem drift creates institutional memory rot. All documentation must live under `/home/admin/FiskAI/docs/` for:

- Discoverability by tooling
- Auditability under compliance review
- Consistency for AI agent operations

## Invariants Enforced

1. Exactly one Product Bible directory (excluding worktrees)
2. No `.md` files outside FiskAI except tool configs
3. No orphan npm installations at user root
