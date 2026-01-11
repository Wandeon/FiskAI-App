# Backfill Operator Runbook

> Operational guide for running historical backfill discovery.

## Prerequisites

1. **Kill Switch:** `BACKFILL_ENABLED=true` must be set in environment
2. **Database Access:** `DATABASE_URL` must point to the FiskAI database
3. **Migration Applied:** `20260111170000_add_backfill_models` must be applied

## CLI Usage

### List Available Sources

```bash
DATABASE_URL="..." npx tsx scripts/backfill-run.ts --list-sources
```

### Dry Run (Always do first)

```bash
DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source narodne-novine --max-urls 50 --dry-run
```

### Real Run

```bash
BACKFILL_ENABLED=true DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source narodne-novine --max-urls 50 --date-from 2024-11-01
```

## Parameters

| Parameter     | Required | Default | Description                           |
| ------------- | -------- | ------- | ------------------------------------- |
| `--source`    | Yes      | -       | Source slug to backfill               |
| `--max-urls`  | No       | 500     | Max URLs per run                      |
| `--date-from` | No       | -       | Only URLs modified after (YYYY-MM-DD) |
| `--date-to`   | No       | -       | Only URLs modified before             |
| `--dry-run`   | No       | false   | Preview without DB writes             |

## Safety Features

- **Kill Switch:** Real runs require `BACKFILL_ENABLED=true`
- **Rate Limits:** Per-source min/max delays with jitter
- **Hard Caps:** Via `--max-urls`
- **Idempotency:** Same command twice = 0 new records

## Monitoring

```sql
-- Check BackfillRun status
SELECT id, status, "discoveredCount", "queuedCount", "skippedCount"
FROM "BackfillRun" ORDER BY "createdAt" DESC LIMIT 5;

-- Check new DiscoveredItems
SELECT count(*) FROM "DiscoveredItem"
WHERE "discoveryMethod" = 'BACKFILL';
```

## Rollback

```sql
-- Cancel running backfill
UPDATE "BackfillRun" SET status = 'CANCELLED' WHERE status = 'RUNNING';

-- Delete items from run
DELETE FROM "DiscoveredItem" WHERE "backfillRunId" = '<run-id>';
```

---

**Last Updated:** 2026-01-11
