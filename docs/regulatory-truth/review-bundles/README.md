# Daily Review Bundles

This directory contains daily review bundles for T0/T1 regulatory rules that require human approval.

## Overview

T0 and T1 risk tier rules **NEVER** get auto-approved. They require human review due to their high business impact:

- **T0**: Critical rules (exchange rates, deadlines, core tax thresholds)
- **T1**: High-impact rules (benefits, major regulatory changes)

## Workflow

### 1. Generate Daily Bundle

Generate a review bundle for pending T0/T1 rules:

```bash
npx tsx src/lib/regulatory-truth/scripts/generate-review-bundle.ts
```

This creates a dated markdown file (e.g., `2025-12-23-review-bundle.md`) with:

- Summary statistics (total items, breakdown by risk tier and domain)
- Individual rule details (title, value, confidence, sources, quotes)
- Bulk and individual approval commands

**Options:**

- `--max N` - Maximum items to include (default: 20)
- `--prioritize MODE` - Prioritization: "risk" or "age" (default: risk)
- `--output-only` - Only output to console, don't save file

### 2. Review Rules

Open the generated bundle and review each rule:

1. Check the rule value against source quotes
2. Verify confidence score is reasonable
3. Ensure source URLs are authoritative
4. Look for any red flags in the extracted data

### 3. Approve or Reject

**Approve individual rule:**

```bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123"
```

**Approve multiple rules:**

```bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123,cm5def456,cm5ghi789"
```

**Approve and release immediately:**

```bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123" --release
```

**Reject a rule:**

```bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123" --reject --reason "Insufficient evidence"
```

### 4. Target Time

The entire workflow (generate + review + approve) should take **< 30 seconds** for a typical bundle of 10-20 rules.

- Generation: ~2-5 seconds
- Review: ~10-20 seconds (visual scan)
- Approval: ~5-10 seconds (copy-paste command)

## Audit Trail

All approvals and rejections are logged in the `RegulatoryAuditLog` table:

```sql
SELECT action, "entityId", "performedBy", "performedAt", metadata
FROM "RegulatoryAuditLog"
WHERE action IN ('RULE_APPROVED', 'RULE_REJECTED')
ORDER BY "performedAt" DESC;
```

## Automation Policy

- **T2/T3 rules**: Auto-approved after grace period (currently 0 hours for drain)
- **T0/T1 rules**: ALWAYS require human review (implemented in this workflow)

This ensures critical business rules are never auto-approved without human oversight.

## File Naming

Bundles are saved with date prefix: `YYYY-MM-DD-review-bundle.md`

This allows for:

- Easy chronological sorting
- Historical audit trail
- Multiple reviews per day (if needed)
