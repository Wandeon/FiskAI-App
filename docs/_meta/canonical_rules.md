# Canonicalization Rules

**Date:** 2026-01-05
**Authority:** Systems Librarian
**Governance:** Enforced by CI invariants

---

## FiskAI Canonical Namespaces

### 1. Documentation Root

```
CANONICAL: /home/admin/FiskAI/docs/
RULE: ALL FiskAI documentation must live here
ENFORCEMENT: CI check fails if .md found outside
EXCEPTION: CLAUDE.md, CHANGELOG.md, README.md at repo root only
```

### 2. Product Bible

```
CANONICAL: docs/product-bible/
FILES: 00-INDEX.md, 01-VISION-ARCHITECTURE.md, ..., 08-APPENDIXES.md
RULE: Version-bumped, write-protected except for version updates
STATUS: v5.0.0 (2026-01-05)
```

### 3. Audit Namespace

```
PRIMARY: docs/audits/
SECONDARY: docs/07_AUDITS/ (structured audit runs with evidence subdirs)
RULE: All audit reports here, append-only, date-prefixed (YYYY-MM-DD)
ARCHIVE: docs/audits/_archive/ (deprecated/historical)
CONSOLIDATION: /FiskAI/audit/ should eventually merge into docs/audits/
```

### 4. Plans Namespace

```
CANONICAL: docs/plans/
RULE: Implementation plans only, date-prefixed
ARCHIVE: docs/plans/archived/ (completed plans)
STRUCTURE:
  - active/ (current work)
  - archived/ (completed/superseded)
```

### 5. Architecture Decisions

```
CANONICAL: docs/adr/
RULE: Numbered 001, 002, ... (never delete, only supersede)
STATUS: Always include (active/superseded/deprecated)
```

### 6. Feature Specifications

```
CANONICAL: docs/02_FEATURES/
RULE: FEATURE_REGISTRY.md tracks all features with status
STRUCTURE: features/<feature-name>.md per feature
```

### 7. System Architecture

```
CANONICAL: docs/01_ARCHITECTURE/ (high-level overview)
CANONICAL: docs/03_ARCHITECTURE/ (component layer migration)
RULE: Linked to ADRs
```

---

## Tool Config Exceptions (ALLOWED OUTSIDE docs/)

```
Path: /home/admin/.claude/
Path: /home/admin/.codex/
Path: /home/admin/.gemini/
Path: /home/admin/.jules/
Path: /home/admin/.qwen/

RULE: These are PERMITTED exceptions
REASON: Tool-specific configurations, not FiskAI project docs
ACTION: Do not move or consolidate
```

---

## Non-FiskAI Repositories

```
RULE: Any other git repos on the machine are OUT OF SCOPE
ACTION: Document but do not touch
STATUS: None currently detected
```

---

## Duplicates & Collisions

| Pattern                               | Status                               | Action                 |
| ------------------------------------- | ------------------------------------ | ---------------------- |
| `audit/` vs `audits/` vs `07_AUDITS/` | ⚠️ Unify to `docs/audits/`           | Planned consolidation  |
| `docs/plans/archived/`                | ✅ Active, consolidating old orphans | Monitor for duplicates |
| `docs/_meta/retired/`                 | ✅ Tombstone records                 | Append-only            |

---

## Enforcement Rules (CI Invariants)

1. **INV-001:** Exactly one `product-bible/` directory (excluding worktrees)
2. **INV-002:** No `.md` outside `docs/` except `{CLAUDE,CHANGELOG,README}.md`
3. **INV-003:** All audit files date-prefixed
4. **INV-004:** No orphan `node_modules` at `/home/admin/`
5. **INV-005:** No duplicate audit namespaces (one root)

---

## Migration Path (Future)

```
Phase 1 (DONE):  Consolidate orphan docs into docs/plans/archived/
Phase 2 (TODO):  Unify /FiskAI/audit/ → docs/audits/
Phase 3 (TODO):  Consolidate docs/07_AUDITS/ → docs/audits/runs/
Phase 4 (TODO):  Enforce via CI on every commit
```
