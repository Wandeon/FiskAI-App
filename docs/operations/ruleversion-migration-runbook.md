# RuleVersion Migration Runbook

> PR#10: Migrate RuleVersion Bundle to Regulatory Database

## Overview

This runbook covers the migration of RuleVersion bundle tables from core to regulatory database:

- RuleTable
- RuleVersion
- RuleSnapshot
- RuleCalculation

## Prerequisites

- [ ] PR#9 merged (RuleVersion relations removed from PayoutLine/JoppdSubmissionLine)
- [ ] PR#10 deployed (models in regulatory.prisma, store, scripts)
- [ ] `REGULATORY_DATABASE_URL` set in target environment
- [ ] Database backup taken

## Safety Rails

**Before you begin:**

1. **Run on staging first** - Never go straight to production
2. **Take a DB snapshot/backup before copy** - For rollback capability
3. **Keep rollback path available** - Flag back to `core` if issues arise
4. **Do NOT drop old tables** - That's a separate PR after stability window

## Expected Runtime

| Dataset Size | Copy Duration | Parity Check |
| ------------ | ------------- | ------------ |
| < 1,000 rows | < 10 seconds  | < 5 seconds  |
| 1,000-10,000 | < 1 minute    | < 30 seconds |
| 10,000+      | 2-5 minutes   | 1-2 minutes  |

---

## Step 1: Apply Schema Migration (Staging)

```bash
# Ensure regulatory schema has the new tables
npx prisma db push --schema=prisma/regulatory.prisma

# Verify tables exist
docker exec fiskai-db psql -U fiskai -d fiskai_regulatory -c "\dt"
```

Expected output should include:

- `rule_table`
- `rule_version`
- `rule_snapshot`
- `rule_calculation`

## Step 2: Dry Run Copy Script

```bash
# Preview what would be copied
npx tsx scripts/copy-ruleversion-to-regulatory.ts --dry-run
```

Expected output:

```
=== Copy RuleVersion Bundle to Regulatory DB ===
Mode: DRY RUN (no changes)
...
DRY RUN complete. No data was modified.
```

Verify:

- [ ] RuleTable count matches expected
- [ ] RuleVersion count matches expected
- [ ] No errors during dry run

## Step 3: Execute Copy

```bash
# Perform the actual copy
npx tsx scripts/copy-ruleversion-to-regulatory.ts
```

Expected output:

```
=== Copy Complete ===

Mode: LIVE
Duration: X.XXs

| Table            | Scanned | Inserted | Skipped |
|------------------|---------|----------|---------|
| RuleTable        |       X |        X |       0 |
| RuleVersion      |       X |        X |       0 |
| RuleSnapshot     |       X |        X |       0 |
| RuleCalculation  |       X |        X |       0 |

Copy complete. Run verify-ruleversion-parity.ts to verify parity.
```

## Step 4: Verify Parity

```bash
# Run deterministic parity verification
npx tsx scripts/verify-ruleversion-parity.ts
```

Expected output:

```
=== Parity Verification Summary ===

| Table            | Status | Core Count | Reg Count |
|------------------|--------|------------|-----------|
| RuleTable        | PASS   |          X |         X |
| RuleVersion      | PASS   |          X |         X |
| RuleSnapshot     | PASS   |          X |         X |
| RuleCalculation  | PASS   |          X |         X |

All parity checks PASSED.
```

**If any check FAILS:**

1. Do NOT proceed to dual mode
2. Investigate the mismatch
3. Re-run copy script (it's idempotent)
4. Re-verify parity

## Step 5: Enable Dual Mode (Staging)

Set environment variable:

```bash
# In Coolify or .env
RULE_VERSION_SOURCE=dual
```

Restart the application to pick up the change.

**Monitor logs for parity mismatches:**

```bash
# Look for parity warnings
grep "PARITY MISMATCH" /path/to/app.log
```

Expected: No parity mismatches during normal operation.

**Run smoke tests:**

- [ ] Create a payout with PayoutLines
- [ ] Verify `ruleVersionId` and `appliedRuleSnapshotId` are set
- [ ] Call `GET /api/joppd/submissions/:id/audit`
- [ ] Verify `appliedRuleSnapshot.snapshotData` is present

## Step 6: Flip to Regulatory (Staging)

After 24-48h with no issues in dual mode:

```bash
# In Coolify or .env
RULE_VERSION_SOURCE=regulatory
```

Restart the application.

**Monitor for errors:**

- [ ] Application starts without errors
- [ ] Rule resolution works (create payouts, check calculations)
- [ ] No 500 errors related to RuleVersion

## Step 7: Production Rollout

Repeat Steps 1-6 for production:

1. Take production DB backup
2. Apply schema migration
3. Dry run copy
4. Execute copy
5. Verify parity
6. Enable dual mode (24-48h observation)
7. Flip to regulatory

---

## Rollback Procedure

If issues arise at any point:

### Rollback from Dual/Regulatory to Core

```bash
# Set flag back to core
RULE_VERSION_SOURCE=core
```

Restart the application. All reads will go back to core DB.

### If Data Was Corrupted

1. Restore from DB backup taken before copy
2. Set `RULE_VERSION_SOURCE=core`
3. Investigate root cause before retrying

---

## Post-Migration Cleanup (Separate PR)

**Only after stability window (1-2 weeks in production):**

1. Drop old tables from core schema
2. Remove `core` mode from ruleversion-store
3. Update `RULE_VERSION_SOURCE` default to `regulatory`

This is PR#11, not part of PR#10.

---

## Troubleshooting

### Copy script fails with FK error

```
Missing tableId mapping for core RuleTable.id=xxx
```

**Cause:** RuleTable copy didn't complete properly.
**Fix:** Re-run copy script from the beginning (it's idempotent).

### Parity check fails on RuleVersion

```
FAIL: X missing, Y extra
```

**Cause:** Copy was interrupted or regulatory had pre-existing data.
**Fix:**

1. Check if regulatory was seeded independently
2. Clear regulatory tables if safe: `TRUNCATE rule_version, rule_snapshot, rule_calculation CASCADE;`
3. Re-run copy

### Application errors after flipping to regulatory

**Cause:** Missing data in regulatory or schema mismatch.
**Fix:**

1. Immediately set `RULE_VERSION_SOURCE=core`
2. Check parity script output
3. Re-run copy if needed

### Performance degradation in dual mode

**Cause:** Dual mode reads from both DBs, doubling query load.
**Fix:** This is expected. Dual mode is for verification only. Keep it short (24-48h).

---

## Contacts

- Database issues: [DBA contact]
- Application issues: [On-call engineer]
- Regulatory compliance: [Compliance team]
