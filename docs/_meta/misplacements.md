# Misplacement & Duplication Findings

**Date:** 2026-01-05
**Scope:** /home/admin (user home only)
**Status:** After Phase 5 cleanup (previous task)

---

## Summary

| Category                   | Count | Status                    |
| -------------------------- | ----- | ------------------------- |
| FiskAI .md outside docs/   | 0     | ✅ CLEAN                  |
| Orphan FiskAI docs         | 0     | ✅ MIGRATED               |
| Duplicate audit namespaces | 2     | ⚠️ INTERNAL               |
| Duplicate folders          | 1     | ⚠️ INTENTIONAL (worktree) |

---

## Duplicate Audit Namespaces (INTERNAL TO FISKAI)

### Finding 1: `audit/` vs `audits/` vs `07_AUDITS/`

**Locations:**

```
/home/admin/FiskAI/audit/                    [27 .md files]
/home/admin/FiskAI/docs/audits/              [~30 .md files]
/home/admin/FiskAI/docs/07_AUDITS/           [~65 .md files]
```

**Content Analysis:**

- `audit/` — Current active audits (UI/UX, performance, security, etc.)
- `docs/audits/` — Regulatory + compliance audits + phase summaries
- `docs/07_AUDITS/` — Structured audit runs with evidence bundles

**Recommendation:**

```
Phase 2 Consolidation: Merge /audit/ into docs/audits/
  - Move /audit/*.md → docs/audits/internal/
  - Delete /audit/ directory
  - Update cross-references
```

**Risk:** Medium (27 files, need to verify no duplicate names)

---

## Duplicate Folder Trees (INTENTIONAL)

### Finding 2: architecture-erp Worktree

**Location:** `/home/admin/FiskAI/architecture-erp`
**Type:** Git worktree (intentional, active development)
**Status:** LEAVE ALONE
**Files:** 512 .md (diverged copy of main docs)

---

## Files That Were Orphan (NOW FIXED)

### Previously Found, Migrated in Phase 5

| File                                  | Old Location              | New Location            | Status   |
| ------------------------------------- | ------------------------- | ----------------------- | -------- |
| 2025-12-20-device-security-audit.md   | `/home/admin/docs/plans/` | `docs/plans/archived/`  | ✅ MOVED |
| 2026-01-02-operation-shatter-audit.md | `/home/admin/docs/plans/` | `docs/plans/archived/`  | ✅ MOVED |
| BUILD_ERRORS_ANALYSIS.md              | `/home/admin/`            | `docs/audits/_archive/` | ✅ MOVED |
| security-audit-report.md              | `/home/admin/`            | `docs/audits/_archive/` | ✅ MOVED |

---

## Consolidated Status

✅ **All orphan documentation consolidated into canonical locations.**
⚠️ **Remaining: Unify internal audit namespaces (audit/ vs audits/).**

No FiskAI .md files exist outside `/home/admin/FiskAI/docs/`.
