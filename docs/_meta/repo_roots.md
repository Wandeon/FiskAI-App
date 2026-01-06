# Repository & Worktree Detection Report

**Date:** 2026-01-05
**Scope:** FiskAI and visible filesystem roots

## Primary Repository

- **Path:** `/home/admin/FiskAI`
- **Origin:** git@github.com:Wandeon/FiskAI.git
- **Branch:** main
- **HEAD:** 6fa6b81b (most recent: doc v5.0.0 reconstruction)
- **Type:** Primary production repo

## Active Worktrees

```
/home/admin/FiskAI                   6fa6b81b [main]
/home/admin/FiskAI/architecture-erp  3ec5e49b [architecture-erp]
```

**Note:** architecture-erp is INTENTIONAL (active development), left untouched.

## Other Git Roots

None detected outside FiskAI.

## Tool Configs (Non-git, documented exceptions)

| Path                   | Purpose           | Notes                    |
| ---------------------- | ----------------- | ------------------------ |
| `/home/admin/.claude/` | Claude CLI        | Credentials + debug logs |
| `/home/admin/.codex/`  | Codex/Superpowers | Plugin system            |
| `/home/admin/.gemini/` | Gemini CLI        | 13 config .md files      |
| `/home/admin/.jules/`  | Jules             | Minimal cache            |
| `/home/admin/.qwen/`   | Qwen              | Config directory         |

**Status:** All ALLOWED (tool-specific, not FiskAI).

---

## Canonical Document Roots

| Root          | Purpose              | Path                    | Files |
| ------------- | -------------------- | ----------------------- | ----- |
| Product Bible | Source of truth      | `docs/product-bible/`   | 9     |
| Audits        | Compliance evidence  | `docs/audits/`          | ~30   |
| Plans         | Implementation plans | `docs/plans/`           | ~130  |
| Architecture  | System design        | `docs/01_ARCHITECTURE/` | 4     |
| Features      | Feature specs        | `docs/02_FEATURES/`     | ~110  |

**Status:** ✅ All canonical roots accounted for.
