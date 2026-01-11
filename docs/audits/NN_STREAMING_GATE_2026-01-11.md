# Narodne Novine Streaming Discovery Gate Test

**Date:** 2026-01-11
**Run by:** Claude Agent

## Command

```bash
DATABASE_URL="postgresql://fiskai:***@localhost:5434/fiskai?schema=public" \
BACKFILL_ENABLED="true" \
npx tsx scripts/backfill-run.ts \
  --source narodne-novine \
  --date-from 2024-01-01 \
  --max-urls 100
```

## First Run

**Run ID:** `cmka8qug5000059wig5q30y08`

**Start:** ~21:45 UTC
**End:** ~21:49 UTC (254.7s duration)

**Checkpoint progression:**

```
child 9006, 11 URLs
child 9007, 11 URLs
child 9008, 11 URLs
child 9009, 58 URLs
child 9010, 58 URLs
child 9011, 58 URLs
child 9012, 82 URLs
child 9013, 82 URLs
child 9014, 82 URLs
child 9015, 95 URLs
child 9016, 95 URLs
child 9017, 95 URLs
```

**Final checkpoint (persisted to DB):**

```json
{
  "urlsEmittedSoFar": 95,
  "lastCompletedChildSitemapUrl": "https://narodne-novine.nn.hr/sitemap_3_2024_5.xml",
  "lastCompletedChildSitemapIndex": 9017
}
```

> **Note on urlsEmittedSoFar vs Discovered count:**
> The checkpoint shows 95 URLs because `onCheckpoint` is called only after each child sitemap **fully completes** (streaming-sitemap-discovery.ts:318).
> When maxUrls=100 was hit mid-child (child 9018), the generator returned early (line 299-304) but did NOT call `onCheckpoint` for the partial child.
> This is **correct resume semantics**: on restart, child 9018 would be re-fetched from the beginning since it wasn't fully processed.
> The "Discovered: 100" count reflects total URLs yielded to the consumer during the run.

**Results:**
| Metric | Count |
|--------|-------|
| Discovered | 100 |
| Queued | 100 |
| Skipped | 0 |
| Errors | 0 |

## Second Run (Idempotency Test)

**Run ID:** `cmka8x38h0000o8wimk410nst`

**Start:** ~21:54 UTC
**End:** ~21:58 UTC (263.6s duration)

**Results:**
| Metric | Count |
|--------|-------|
| Discovered | 100 |
| Queued | 0 |
| Skipped | 100 |
| Errors | 0 |

## DB Counts

| Metric                    | Before | After Run 1 | After Run 2 |
| ------------------------- | ------ | ----------- | ----------- |
| DiscoveredItem (BACKFILL) | 0      | 100         | 100         |
| BackfillRun               | 0      | 1           | 2           |

## Pass Criteria

| Criterion                                                                    | Status |
| ---------------------------------------------------------------------------- | ------ |
| Checkpoint persisted to DB                                                   | PASS   |
| Date prefiltering active (started at child 9006, ~2024 sitemaps)             | PASS   |
| Rate limiting active (8-15s with jitter per source-backfill-config.ts:46-50) | PASS   |
| includeUndatedChildren=false (fail-closed)                                   | PASS   |
| Idempotency: 0 new queued on rerun                                           | PASS   |

## Observations

1. **Date filtering:** Child sitemaps 0-9005 (pre-2024) were skipped via `childSitemapDatePattern`
2. **Checkpoint persistence:** Checkpoints saved after each child sitemap completion
3. **Cumulative counting:** URLs counted cumulatively across checkpoints
4. **Idempotency:** All 100 URLs skipped on second run (unique constraint working)

## Conclusion

**GATE PASSED** - Streaming sitemap discovery with checkpoint persistence is production-ready for narodne-novine.
