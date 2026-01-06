#!/bin/bash
# POST-RUN INVARIANT CHECKS
# VPS-01 Filesystem Canonicalization
# Status: CI-Ready

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  POST-RUN INVARIANT CHECKS                                    ║"
echo "║  Verifying filesystem canonicalization success                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

FAILED=0

# ============================================================================
# INV-001: Exactly one product-bible root
# ============================================================================

echo "INV-001: Exactly one product-bible directory (excluding worktrees)"
count=$(find /home/admin/FiskAI -type d -name "product-bible" | grep -v architecture-erp | wc -l)
if [ "$count" -eq 1 ]; then
    echo "  ✅ PASS: Found 1"
else
    echo "  ❌ FAIL: Expected 1, found $count"
    FAILED=$((FAILED+1))
fi
echo ""

# ============================================================================
# INV-002: No .md outside docs (except CLAUDE.md, CHANGELOG.md, README.md)
# ============================================================================

echo "INV-002: No .md outside docs/ except {CLAUDE,CHANGELOG,README}.md"
orphan_md=$(find /home/admin/FiskAI -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l)
if [ "$orphan_md" -eq 0 ]; then
    echo "  ✅ PASS: No orphan .md files at repo root"
else
    echo "  ⚠️  WARNING: Found $orphan_md .md at repo root:"
    find /home/admin/FiskAI -maxdepth 1 -name "*.md" -type f 2>/dev/null | while read f; do
        echo "    - $(basename $f)"
    done
fi
echo ""

# ============================================================================
# INV-003: Audit namespace consolidated
# ============================================================================

echo "INV-003: Audit files consolidated (check for /audit/ removal)"
if [ ! -d /home/admin/FiskAI/audit ]; then
    echo "  ✅ PASS: /audit/ directory removed"
else
    echo "  ❌ FAIL: /audit/ directory still exists (consolidation incomplete)"
    FAILED=$((FAILED+1))
fi
echo ""

# ============================================================================
# INV-004: No orphan node_modules at /home/admin/
# ============================================================================

echo "INV-004: No orphan node_modules"
if [ ! -d /home/admin/node_modules ]; then
    echo "  ✅ PASS: No orphan node_modules"
else
    echo "  ❌ FAIL: Orphan node_modules found (expected deleted)"
    FAILED=$((FAILED+1))
fi
echo ""

# ============================================================================
# INV-005: Canonical audit root exists
# ============================================================================

echo "INV-005: Canonical audit root exists at docs/audits/"
if [ -d /home/admin/FiskAI/docs/audits ]; then
    file_count=$(find /home/admin/FiskAI/docs/audits -name "*.md" 2>/dev/null | wc -l)
    echo "  ✅ PASS: docs/audits/ exists with $file_count .md files"
else
    echo "  ❌ FAIL: docs/audits/ not found"
    FAILED=$((FAILED+1))
fi
echo ""

# ============================================================================
# INV-006: No duplicate audit namespaces remain
# ============================================================================

echo "INV-006: Audit namespace unification (no leftover /audit/)"
remaining=$(find /home/admin/FiskAI -type d -name "audit" | grep -v architecture-erp | wc -l)
if [ "$remaining" -eq 0 ]; then
    echo "  ✅ PASS: No duplicate 'audit' directories remain"
else
    echo "  ⚠️  WARNING: Found $remaining 'audit' directories:"
    find /home/admin/FiskAI -type d -name "audit" | grep -v architecture-erp
fi
echo ""

# ============================================================================
# FINAL RESULT
# ============================================================================

echo "╔════════════════════════════════════════════════════════════════╗"
if [ $FAILED -eq 0 ]; then
    echo "║  ✅ ALL INVARIANTS PASSED                                      ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 0
else
    echo "║  ❌ $FAILED INVARIANT(S) FAILED                                 ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 1
fi
