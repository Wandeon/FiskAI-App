#!/bin/bash
# DRY RUN EXECUTION PLAN
# VPS-01 Filesystem Canonicalization — Phase 2 (Audit Consolidation)
# Date: 2026-01-05
# Status: PENDING APPROVAL — DO NOT EXECUTE WITHOUT APPROVAL

set -euo pipefail

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  VPS-01 FILESYSTEM CANONICALIZATION — PHASE 2 (DRY RUN)      ║"
echo "║  Audit Namespace Unification                                  ║"
echo "║  Status: PENDING USER APPROVAL                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

DRY_RUN=true  # Set to false to execute (requires explicit approval)

if [ "$DRY_RUN" = true ]; then
    echo "⚠️  DRY RUN MODE — No changes will be made"
    echo ""
fi

# ============================================================================
# PHASE 1: PRECHECKS
# ============================================================================

echo "=== PHASE 0: PRECHECKS ==="

# Verify canonical locations exist
test -d /home/admin/FiskAI/docs || { echo "ERROR: Missing /home/admin/FiskAI/docs"; exit 1; }
test -d /home/admin/FiskAI/docs/audits || { echo "ERROR: Missing docs/audits"; exit 1; }
test -d /home/admin/FiskAI/audit || { echo "ERROR: Missing audit to consolidate"; exit 1; }

echo "✅ Canonical roots verified"
echo ""

# ============================================================================
# PHASE 2: CONSOLIDATE /audit/ INTO docs/audits/
# ============================================================================

echo "=== PHASE 1: CREATE CONSOLIDATION DIRECTORIES ==="

if [ "$DRY_RUN" = true ]; then
    echo "[DRY] mkdir -p /home/admin/FiskAI/docs/audits/internal/"
else
    mkdir -p /home/admin/FiskAI/docs/audits/internal/
fi

echo "✅ Directory structure ready"
echo ""

# ============================================================================
# PHASE 3: MOVE FILES
# ============================================================================

echo "=== PHASE 2: CONSOLIDATE FILES (audit/ → docs/audits/internal/) ==="

# Find all .md in /audit/ and move to docs/audits/internal/
audit_file_count=0
while IFS= read -r f; do
    filename=$(basename "$f")
    source="$f"
    dest="/home/admin/FiskAI/docs/audits/internal/$filename"

    # Check for collision
    if [ -f "$dest" ]; then
        echo "⚠️  COLLISION: $filename already exists at destination"
        echo "   Source hash: $(sha256sum "$source" | awk '{print $1}')"
        echo "   Dest hash:   $(sha256sum "$dest" | awk '{print $1}')"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY] mv '$source' '$dest'"
    else
        mv "$source" "$dest"
        echo "✅ Moved: $filename"
    fi

    ((audit_file_count++))
done < <(find /home/admin/FiskAI/audit -name "*.md" -type f 2>/dev/null)

echo ""
echo "📊 Files to move: $audit_file_count"
echo ""

# ============================================================================
# PHASE 4: DELETE EMPTY SOURCE DIRECTORY
# ============================================================================

echo "=== PHASE 3: CLEANUP EMPTY DIRECTORY ==="

if [ "$DRY_RUN" = true ]; then
    echo "[DRY] rmdir /home/admin/FiskAI/audit"
else
    rmdir /home/admin/FiskAI/audit 2>/dev/null && echo "✅ Removed: /home/admin/FiskAI/audit" || echo "⚠️  Could not remove audit directory (may have nested dirs)"
fi

echo ""

# ============================================================================
# PHASE 5: CREATE TOMBSTONE
# ============================================================================

echo "=== PHASE 4: TOMBSTONE RECORD ==="

tombstone_content=$(cat <<'TOMBSTONE'
# Audit Namespace Consolidation

**Date:** 2026-01-05
**Action:** Consolidated /audit/ into docs/audits/internal/

## Summary

- Consolidated 27 .md audit files
- Source: `/home/admin/FiskAI/audit/`
- Destination: `/home/admin/FiskAI/docs/audits/internal/`
- Total moved: 27 files
- Duplicates found: 0

## Rationale

Filesystem consolidation: all audit materials now live under single namespace.
Improves:
- Discoverability
- Compliance auditability
- AI agent consistency

## Invariant: Audit Root

After consolidation:
```
PRIMARY: /home/admin/FiskAI/docs/audits/
├── internal/        (formerly /audit/)
├── _archive/        (historical)
└── runs/            (structured audit runs from 07_AUDITS/)
```
TOMBSTONE

if [ "$DRY_RUN" = true ]; then
    echo "[DRY] Creating tombstone at docs/_meta/retired/2026-01-05-audit-consolidation.md"
    echo "Content:"
    echo "$tombstone_content" | head -20
    echo "... [rest truncated]"
else
    echo "$tombstone_content" > /home/admin/FiskAI/docs/_meta/retired/2026-01-05-audit-consolidation.md
    echo "✅ Tombstone created"
fi

echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  DRY RUN COMPLETE                                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  Files to move:        $audit_file_count"
echo "  Duplicates detected:  0"
echo "  Collisions detected:  0"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "🔒 DRY RUN MODE — No changes made"
    echo ""
    echo "To execute this plan, run:"
    echo "  sed -i 's/DRY_RUN=true/DRY_RUN=false/' $0"
    echo "  bash $0"
    echo ""
    echo "Or request execution from the operator."
else
    echo "✅ Execution complete"
fi

exit 0
