# Backfill V1 Staged Rollout Plan

> Created: 2026-01-11T17:30:00Z

## Executive Summary

Phased rollout plan for backfill discovery capability. Start small, verify, then expand.

## Source Status

| Source         | Mode       | Status                | URLs Available | Notes                        |
| -------------- | ---------- | --------------------- | -------------- | ---------------------------- |
| fina           | PAGINATION | ✅ READY              | ~360           | Validated in first run       |
| hzzo           | PAGINATION | ✅ READY              | ~154           | Validated in dry-run         |
| porezna-uprava | PAGINATION | 🔧 CONFIG BUG         | Unknown        | URL uses wrong `www.` prefix |
| narodne-novine | SITEMAP    | ⏱️ NEEDS OPTIMIZATION | ~9551 sitemaps | Too large for current parser |

## Phase 1: Initial Rollout (Current Week)

### Target

- Complete processing of 50 FINA URLs already in pipeline
- Add 100 more URLs from FINA

### Commands

```bash
# Monitor existing items
PGPASSWORD=fiskai_secret_2025 psql -h 100.64.123.81 -p 5434 -U fiskai -d fiskai -c \
  "SELECT status, count(*) FROM \"DiscoveredItem\" WHERE \"discoveryMethod\" = 'BACKFILL' GROUP BY status;"

# Add 100 more when current batch is at least 50% PROCESSED
BACKFILL_ENABLED=true DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source fina --mode pagination --max-urls 100
```

### Success Criteria

- [ ] All 50 initial items reach PROCESSED status
- [ ] No errors in worker logs
- [ ] No duplicate Evidence records created

## Phase 2: HZZO Expansion (Week 2)

### Target

- Add 150 HZZO URLs alongside FINA

### Commands

```bash
BACKFILL_ENABLED=true DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source fina --source hzzo --mode pagination --max-urls 150
```

### Success Criteria

- [ ] Both sources processed without errors
- [ ] Cross-source deduplication working (if any overlap)
- [ ] Queue depths not significantly impacted

## Phase 3: Bug Fixes (Week 2-3)

### Fix porezna-uprava URL

Create PR to update `source-backfill-config.ts`:

```typescript
// Before (broken)
domain: "www.porezna-uprava.gov.hr"
archiveUrl: "https://www.porezna-uprava.gov.hr/HR/Stranice/Arhiva.aspx"

// After (fixed)
domain: "porezna-uprava.gov.hr"
archiveUrl: "https://porezna-uprava.gov.hr/HR/Stranice/Arhiva.aspx"
```

### Optimize narodne-novine sitemap

Options (pick one):

1. **Streaming parser**: Process sitemap URLs as they're found, stop early when enough
2. **Pre-filter by year**: Only fetch child sitemaps from recent years based on filename pattern
3. **Alternative mode**: Use pagination/archive if available

## Phase 4: Full Rollout (Week 4+)

### Target

- All 4 sources enabled
- Larger batch sizes (500+ URLs per run)

### Monitoring SQL

```sql
-- Overall progress
SELECT
  "discoveryMethod",
  status,
  count(*)
FROM "DiscoveredItem"
GROUP BY "discoveryMethod", status
ORDER BY "discoveryMethod", status;

-- Backfill run history
SELECT
  id,
  sources,
  status,
  "discoveredCount",
  "queuedCount",
  "skippedCount",
  "createdAt"
FROM "BackfillRun"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Recent errors
SELECT
  id,
  sources,
  "errorLog"
FROM "BackfillRun"
WHERE "errorCount" > 0
ORDER BY "createdAt" DESC
LIMIT 5;
```

## Rollback Procedures

### Cancel Running Backfill

```sql
UPDATE "BackfillRun" SET status = 'CANCELLED' WHERE status = 'RUNNING';
```

### Delete Items from Specific Run

```sql
-- Get run ID first
SELECT id FROM "BackfillRun" ORDER BY "createdAt" DESC LIMIT 5;

-- Delete discovered items (cascade will handle relations)
DELETE FROM "DiscoveredItem" WHERE "backfillRunId" = '<run-id>';

-- Update run stats
UPDATE "BackfillRun" SET
  "queuedCount" = 0,
  "skippedCount" = 0,
  status = 'CANCELLED'
WHERE id = '<run-id>';
```

### Emergency Kill Switch

```bash
# Remove BACKFILL_ENABLED from environment
# All subsequent backfill attempts will fail
```

## Risk Mitigation

| Risk                  | Mitigation                                   |
| --------------------- | -------------------------------------------- |
| Queue overload        | Hard caps (--max-urls), monitor queue depths |
| Rate limiting         | Per-source delays with jitter                |
| Duplicate processing  | Idempotent upsert with unique constraint     |
| Bad URLs in DB        | Backfill items traceable via discoveryMethod |
| Worker resource spike | Existing workers unaffected, same pipeline   |

## Dependencies

- [ ] Redis memory monitoring (currently at 57% capacity)
- [ ] Queue depth monitoring (6.4M existing jobs)
- [ ] Worker health checks

---

**Plan Owner:** Operations Team
**Review Date:** 2026-01-18 (Week 2)
