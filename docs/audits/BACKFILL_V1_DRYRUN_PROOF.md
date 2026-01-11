# Backfill V1 Dry-Run Proof

> Timestamp: 2026-01-11T17:20:00Z

## Summary

Dry-run proof completed for all 4 configured sources. Fix PR #1402 was required to allow dry-runs without `BACKFILL_ENABLED=true`.

| Source         | Mode       | Result       | Discovered | Duration | Notes                                   |
| -------------- | ---------- | ------------ | ---------- | -------- | --------------------------------------- |
| fina           | PAGINATION | ✅ SUCCESS   | 360 URLs   | 184s     | 30 pages crawled                        |
| hzzo           | PAGINATION | ✅ SUCCESS   | 154 URLs   | 178s     | 30 pages crawled                        |
| porezna-uprava | PAGINATION | ❌ DNS ERROR | 0 URLs     | 0.5s     | Config bug: `www.` prefix doesn't exist |
| narodne-novine | SITEMAP    | ⏱️ TIMEOUT   | N/A        | >5min    | 9551 child sitemaps - too large         |

## Fix Required: PR #1402

The original code had a kill switch check that blocked dry-runs:

```typescript
// Original (backfill-discover.worker.ts:48-51)
if (!isBackfillEnabled()) {
  throw new Error("Backfill disabled. Set BACKFILL_ENABLED=true to enable.")
}
```

Fixed to respect dry-run mode:

```typescript
// Fixed
if (!config.dryRun && !isBackfillEnabled()) {
  throw new Error("Backfill disabled. Set BACKFILL_ENABLED=true to enable.")
}
```

## Detailed Results

### FINA (pagination)

```
Run ID: cmk9zpv9300004jwi1ebu771i
Status: SUCCESS
Duration: 184.0s

Statistics:
  Discovered: 360
  Queued: 25 (max-urls limit)
  Skipped: 0
  Errors: 0

Sample URLs discovered:
- https://www.fina.hr/novosti/novi-registar-drzavnih-potpora-i-potpora-male-vrijednosti
- https://www.fina.hr/novosti/uspjesno-zapocela-razmjena-e-racuna
- https://www.fina.hr/novosti/fiskalizacija-2.0
```

### HZZO (pagination)

```
Run ID: cmk9zu51p00009uwi6skp2rsn
Status: SUCCESS
Duration: 178.3s

Statistics:
  Discovered: 154
  Queued: 25 (max-urls limit)
  Skipped: 0
  Errors: 0

Sample URLs discovered:
- https://hzzo.hr/novosti/ostalo/elijekovi-integrirani-informaticki-sustav-za-upravljanje-lijekovima
- https://hzzo.hr/novosti/hzzo-produzio-ugovorno-razdoblje-za-cijelu-2026-godinu
- https://hzzo.hr/novosti/novi-lijekovi-i-ortopedska-pomagala-na-listama-hzzo
```

### Porezna Uprava (DNS error)

```
Run ID: cmk9zy4be00002lwig93u1ze6
Status: FAILED (DNS)
Error: getaddrinfo ENOTFOUND www.porezna-uprava.gov.hr
```

**Root cause**: The configured URL uses `www.porezna-uprava.gov.hr` but the domain doesn't have a `www` subdomain. The correct domain is `porezna-uprava.gov.hr`.

**Action required**: Update `source-backfill-config.ts` to use correct domain without `www.` prefix.

### Narodne Novine (sitemap too large)

```
Run ID: cmk9zdgfu0000xtwidiik2mub
Status: TIMEOUT (>5 minutes)
```

**Root cause**: The sitemap index contains 9,551 child sitemaps spanning from 1990 to 2026. The current implementation fetches ALL sitemaps before filtering by date, which is impractical for this source.

**Action required**:

1. Implement streaming/lazy sitemap parsing for large sitemaps
2. Or: Pre-filter sitemap URLs by year before fetching children
3. Or: Use pagination mode for this source instead

## Verification

All dry-runs created BackfillRun records in the database with `dryRun=true`:

```sql
SELECT id, sources, mode, "dryRun", status, "discoveredCount", "queuedCount"
FROM "BackfillRun"
ORDER BY "createdAt" DESC LIMIT 5;
```

## Next Steps

1. ✅ Fix PR #1402 merged - dry-runs now work without BACKFILL_ENABLED
2. ⏳ Step 5: First real run with 50 URLs using FINA source
3. 🔧 Future: Fix porezna-uprava URL configuration
4. 🔧 Future: Optimize narodne-novine sitemap handling

---

**Status:** DRY-RUN PROOF COMPLETE (2/4 sources functional)
