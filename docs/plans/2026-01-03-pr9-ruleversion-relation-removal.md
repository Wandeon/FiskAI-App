# PR#9: RuleVersion Relation Removal Design

> Created: 2026-01-03
> Status: Ready for implementation

## Overview

Remove Prisma relations from PayoutLine and JoppdSubmissionLine to RuleVersion, unblocking migration of the RuleVersion bundle to the regulatory schema.

## Scope

**In scope:**

- Remove `PayoutLine.ruleVersion` relation
- Remove `JoppdSubmissionLine.ruleVersion` relation
- Remove inverse relations on `RuleVersion`
- Drop database FK constraints
- Expand ESLint guardrail repo-wide
- Add CI grep script for belt-and-suspenders

**Out of scope:**

- TravelOrder relations (handled by Travel module retirement PR)
- Actual migration of RuleVersion to regulatory schema (PR#10)

---

## Section 1: Schema Changes

### A) Remove Prisma relation fields

```prisma
// PayoutLine - REMOVE:
ruleVersion RuleVersion? @relation("PayoutLineRuleVersion", fields: [ruleVersionId], references: [id], onDelete: SetNull)

// JoppdSubmissionLine - REMOVE:
ruleVersion RuleVersion? @relation("JoppdSubmissionLineRuleVersion", fields: [ruleVersionId], references: [id], onDelete: SetNull)

// RuleVersion - REMOVE inverse relations:
payoutLines          PayoutLine[]          @relation("PayoutLineRuleVersion")
joppdSubmissionLines JoppdSubmissionLine[] @relation("JoppdSubmissionLineRuleVersion")
```

### B) Keep unchanged

- `ruleVersionId String?` columns (soft refs)
- `@@index([ruleVersionId])` indexes

---

## Section 2: ESLint Guardrail (Repo-wide)

### A) Repo-wide override

```json
{
  "files": ["src/**/*.ts", "src/**/*.tsx"],
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Property[key.name='include'] ObjectExpression > Property[key.name='ruleVersion']",
        "message": "Forbidden: include.ruleVersion. Use AppliedRuleSnapshot via snapshot-reader."
      },
      {
        "selector": "Property[key.name='select'] ObjectExpression > Property[key.name='ruleVersion']",
        "message": "Forbidden: select.ruleVersion. Use AppliedRuleSnapshot via snapshot-reader."
      },
      {
        "selector": "MemberExpression[property.name='ruleVersion']",
        "message": "Forbidden: accessing .ruleVersion. Use AppliedRuleSnapshot."
      }
    ]
  }
}
```

### B) Exclude tests only (scripts stay covered)

```json
{
  "files": ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.test.tsx", "src/**/*.spec.tsx"],
  "rules": {
    "no-restricted-syntax": "off"
  }
}
```

### C) Remove old PR#8 directory-scoped override

---

## Section 3: CI Grep Script

**File:** `scripts/check-no-ruleversion-relations.ts`

### Patterns (multiline-safe, bounded)

```typescript
const FORBIDDEN_PATTERNS = [
  // include: { ... ruleVersion: ... } across newlines (bounded)
  /\binclude\s*:\s*\{[\s\S]{0,2000}?\bruleVersion\b\s*:/m,

  // select: { ... ruleVersion: ... } across newlines (bounded)
  /\bselect\s*:\s*\{[\s\S]{0,2000}?\bruleVersion\b\s*:/m,

  // .ruleVersion member access
  /\.\s*ruleVersion\b/m,
]
```

### Scan scope

- Include: `src/**/*.ts`, `src/**/*.tsx`
- Exclude: `src/**/*.test.ts`, `src/**/*.spec.ts`, `src/generated/**`

### Exit codes

- `0` = clean
- `1` = violations found

---

## Section 4: Database Migration (FK Drop)

### Name-proof FK discovery and drop

```sql
DO $$
DECLARE
  r record;
BEGIN
  -- Drop FKs from payout_line referencing rule_version
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'payout_line'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%rule_version%'
  LOOP
    EXECUTE format('ALTER TABLE payout_line DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;

  -- Drop FKs from joppd_submission_line referencing rule_version
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'joppd_submission_line'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%rule_version%'
  LOOP
    EXECUTE format('ALTER TABLE joppd_submission_line DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;
```

### Verification query

```sql
-- Should return zero rows after migration
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid IN ('payout_line'::regclass, 'joppd_submission_line'::regclass)
  AND pg_get_constraintdef(oid) ILIKE '%rule_version%';
```

---

## Section 5: Code Changes

### Explicitly allowed

- `db.ruleVersion.findUnique(...)` in rule resolution code
- `ruleVersionId` string comparisons/logging

### Explicitly forbidden

- `include: { ruleVersion: ... }` from PayoutLine/JoppdSubmissionLine
- `select: { ruleVersion: ... }` from PayoutLine/JoppdSubmissionLine
- `.ruleVersion` property access anywhere in src

---

## Section 6: Test Plan

### A) Build and type safety

- `npm run build`
- `npm run lint`
- `npm test`

### B) Runtime smoke tests (staging)

1. Create payout with PayoutLines (ruleVersionId + appliedRuleSnapshotId set)
2. Create JOPPD submission and correction
3. Hit audit endpoint: `GET /api/joppd/submissions/:id/audit`
4. Verify appliedRuleSnapshot.snapshotData present

### C) DB verification

Confirm FKs are gone using verification query above.

---

## Section 7: Acceptance Criteria

PR#9 is "done" only when:

1. Prisma schema has no ruleVersion relations on payout/joppd lines
2. Database has no FKs from payout/joppd lines to rule_version
3. Repo-wide lint + grep guardrails are active in CI
4. `npm run build` passes
5. Staging smoke tests confirm dual-write + audit endpoint work

---

## Notes

- TravelOrder still has RuleVersion relations - handled by Travel module retirement PR
- This PR unblocks PR#10 (RuleVersion migration to regulatory schema)
