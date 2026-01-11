# Backfill V1 Proof Documentation

> Verification evidence for the backfill discovery system.
> Created: 2026-01-11

## 1. Unit Test Results

All 62 unit tests pass:

```
✓ url-canonicalizer.test.ts (21 tests)
  - canonicalizeUrl: determinism, query sorting, tracking param removal
  - hashUrl: deterministic 12-char hash
  - getBackfillJobId: format validation, uniqueness
  - extractDomain, urlMatchesPattern

✓ sitemap-parser.test.ts (17 tests)
  - urlset parsing: standard sitemap, all fields, optional fields
  - XML entity decoding, URL canonicalization
  - sitemapindex parsing: detection, location extraction
  - Edge cases: empty, invalid URLs, malformed XML
  - filterEntriesByDate: dateFrom, dateTo, range, no filter

✓ pagination-parser.test.ts (24 tests)
  - buildPaginatedUrl: query params, path params, offset
  - extractLinksFromHtml: absolute, relative, filtering
  - detectNextPage: page patterns, next text, rel=next
  - parsePaginationPage: URL extraction, pattern filtering
  - extractDateFromUrl: various date patterns

Test Command: npx vitest run src/lib/regulatory-truth/backfill/__tests__/
```

## 2. CLI Interface Verification

### Help Output

```
Backfill Run CLI - Historical RTL Discovery

Usage:
  npx tsx scripts/backfill-run.ts [options]

Options:
  --source <slug>      Source slug to backfill (required, can be repeated)
  --mode <mode>        Discovery mode: sitemap, pagination, archive (default: sitemap)
  --max-urls <n>       Maximum URLs to discover (default: 500)
  --delay-ms <n>       Delay between requests in ms (default: 5000)
  --date-from <date>   Only include URLs modified after this date (YYYY-MM-DD)
  --date-to <date>     Only include URLs modified before this date (YYYY-MM-DD)
  --dry-run            Preview what would be discovered without creating records
  --list-sources       List available source configurations
  --help               Show this help message

Environment:
  BACKFILL_ENABLED=true  Required to run (kill switch)
```

### Configured Sources

```
Configured Backfill Sources:

  narodne-novine
    Domain: narodne-novine.nn.hr
    Mode: SITEMAP
    URL: https://narodne-novine.nn.hr/sitemap.xml
    Rate limit: 8000ms - 15000ms

  porezna-uprava
    Domain: porezna-uprava.gov.hr
    Mode: PAGINATION
    URL: https://www.porezna-uprava.gov.hr/HR/Stranice/Arhiva.aspx
    Rate limit: 10000ms - 20000ms

  hzzo
    Domain: hzzo.hr
    Mode: PAGINATION
    URL: https://hzzo.hr/novosti
    Rate limit: 5000ms - 10000ms

  fina
    Domain: fina.hr
    Mode: PAGINATION
    URL: https://www.fina.hr/novosti
    Rate limit: 5000ms - 10000ms
```

## 3. Kill Switch Verification

The backfill system includes a kill switch that prevents accidental runs:

**Code Location:** `src/lib/regulatory-truth/backfill/backfill-discover.worker.ts:53`

```typescript
export function isBackfillEnabled(): boolean {
  return process.env.BACKFILL_ENABLED === "true"
}
```

**Behavior:**

- Without `BACKFILL_ENABLED=true`, real runs fail with clear error message
- `--dry-run` flag works without the kill switch
- Clear instructions provided when disabled

## 4. Deduplication Guarantees

### Level 1: DiscoveredItem Unique Constraint

```prisma
@@unique([sourceSlug, url])
```

Prevents duplicate URL+source combinations.

### Level 2: Evidence Unique Constraint

```prisma
@@unique([url, snapshotDate])
```

Prevents duplicate evidence for same URL+date.

### Level 3: BullMQ Stable JobId

```typescript
// url-canonicalizer.ts
export function getBackfillJobId(sourceSlug: string, url: string): string {
  const hash = hashUrl(url)
  return `backfill:${sourceSlug}:${hash}`
}
```

Same URL always produces same jobId, preventing duplicate queue entries.

**Verified by tests:**

- `hashUrl > produces same hash for equivalent URLs`
- `getBackfillJobId > produces deterministic job ID`

## 5. Idempotency Verification

### URL Canonicalization

```typescript
// Removes tracking params, normalizes case, sorts query params
canonicalizeUrl("https://EXAMPLE.COM/page?b=2&a=1&utm_source=test")
// → "https://example.com/page?a=1&b=2"
```

### Database-Level Idempotency

- `upsert` used for DiscoveredItem creation
- Unique constraints prevent duplicates
- Re-running same backfill produces no new records

## 6. Rate Limiting Verification

Each source has configured rate limits with jitter:

```typescript
// source-backfill-config.ts
rateLimit: {
  minDelayMs: 8000,
  maxDelayMs: 15000,
  maxConcurrent: 1,
}
```

**Implementation:**

- Delay applied between each page/sitemap fetch
- Jitter prevents predictable patterns
- Per-domain limits respected

## 7. Hard Caps Verification

### Per-Run Cap

```typescript
maxUrls: Int @default(1000)
```

Default 1000 URLs per run, configurable via `--max-urls`.

### Per-Source Limit

Each source config has implicit caps via:

- `maxUrls` parameter
- Pagination limits in fetch functions

## 8. Schema Migration

Migration created: `prisma/migrations/20260111170000_add_backfill_models/migration.sql`

### New Entities

- `BackfillRun` model with status tracking
- `DiscoveryMethod` enum (SENTINEL, BACKFILL)
- `BackfillRunStatus` enum (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `BackfillMode` enum (SITEMAP, ARCHIVE, PAGINATION)

### DiscoveredItem Extensions

- `discoveryMethod` field (default: SENTINEL)
- `backfillRunId` foreign key (optional)
- Supporting indexes for efficient queries

## 9. Invariant Compliance Matrix

| Invariant                        | Implementation         | Verification      |
| -------------------------------- | ---------------------- | ----------------- |
| INV-1: Same DiscoveredItem shape | ✅ Uses existing model | Unit tests        |
| INV-2: Stable jobId              | ✅ sha1(url)           | Unit tests        |
| INV-3: Per-domain rate limit     | ✅ Config per source   | Code review       |
| INV-4: Evidence immutable        | ✅ No overwrites       | Upsert logic      |
| INV-5: Hard cap per run          | ✅ maxUrls parameter   | Code review       |
| INV-6: Per-source limit          | ✅ Source configs      | Code review       |
| INV-7: Skip existing URLs        | ✅ Upsert dedup        | Unique constraint |
| INV-8: Kill switch               | ✅ BACKFILL_ENABLED    | Code review       |

## 10. File Inventory

| File                                                                 | Purpose                    |
| -------------------------------------------------------------------- | -------------------------- |
| `prisma/schema.prisma`                                               | BackfillRun model, enums   |
| `prisma/migrations/20260111170000_add_backfill_models/migration.sql` | DB migration               |
| `src/lib/regulatory-truth/backfill/index.ts`                         | Module exports             |
| `src/lib/regulatory-truth/backfill/types.ts`                         | TypeScript types           |
| `src/lib/regulatory-truth/backfill/url-canonicalizer.ts`             | URL normalization, hashing |
| `src/lib/regulatory-truth/backfill/sitemap-parser.ts`                | XML sitemap parsing        |
| `src/lib/regulatory-truth/backfill/pagination-parser.ts`             | HTML pagination parsing    |
| `src/lib/regulatory-truth/backfill/source-backfill-config.ts`        | Source configurations      |
| `src/lib/regulatory-truth/backfill/backfill-discover.worker.ts`      | Main worker logic          |
| `scripts/backfill-run.ts`                                            | Operator CLI               |
| `docs/audits/BACKFILL_V0_CURRENT_FLOW.md`                            | Current flow documentation |
| `docs/audits/BACKFILL_V1_INVARIANTS.md`                              | Design invariants          |

## 11. Operational Notes

### Running a Dry Run

```bash
DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source narodne-novine \
  --max-urls 100 \
  --dry-run
```

### Running a Real Backfill

```bash
BACKFILL_ENABLED=true DATABASE_URL="..." npx tsx scripts/backfill-run.ts \
  --source narodne-novine \
  --mode sitemap \
  --max-urls 500 \
  --date-from 2024-01-01
```

### Monitoring

- BackfillRun records track status and progress
- Error logs stored in `errorLog` JSON field
- Checkpoint fields enable resumability

---

**Document Status:** Complete
**Author:** Backfill Engineer Agent
**Review Required:** Before merge
