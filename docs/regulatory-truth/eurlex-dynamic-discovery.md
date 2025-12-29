# EUR-Lex Dynamic Discovery Implementation

**Issue:** [#155] Missing EUR-Lex Dynamic Discovery - Only Static CELEX List
**Date:** 2025-12-29
**Status:** Implemented

## Problem Statement

The Regulatory Truth Layer (RTL) previously used a static, hardcoded list of CELEX document identifiers for EUR-Lex content. This approach had several limitations:

1. **Manual Maintenance:** Required manually updating the CELEX list for every new regulation
2. **No Discovery:** Could not automatically discover new or updated EU regulations
3. **Limited Coverage:** Only tracked 5 pre-selected directives
4. **Croatian Filtering:** No language or topic-based filtering for Croatian-relevant content

## Solution: RSS Feed Integration

EUR-Lex provides RSS/Atom feeds that can be filtered by:

- Language (e.g., `lang=HR` for Croatian)
- Document type (e.g., `type_doc=DIR&type_doc=REG` for directives and regulations)
- EuroVoc subject codes (e.g., `eurovoc=8471` for VAT taxation)

### Implementation Components

#### 1. RSS Feed Parser (`src/lib/regulatory-truth/parsers/rss-parser.ts`)

New parser supporting both RSS 2.0 and Atom 1.0 feeds with filtering capabilities:

```typescript
export interface RSSItem {
  url: string
  title: string | null
  date: string | null
  description?: string | null
}

// Parse feed and extract items
parseRSSFeed(content: string): Promise<RSSItem[]>

// Filter by date range
filterRSSByDate(items: RSSItem[], startDate?: Date, endDate?: Date): RSSItem[]

// Filter by URL pattern
filterRSSByPattern(items: RSSItem[], pattern: RegExp): RSSItem[]
```

#### 2. Prisma Schema Update

Added `RSS_FEED` to the `ListingStrategy` enum:

```prisma
enum ListingStrategy {
  SITEMAP_XML
  HTML_LIST
  HTML_TABLE
  PAGINATION
  DATE_FILTERED
  CRAWL
  RSS_FEED // New: RSS/Atom feed parsing
}
```

Migration: `prisma/migrations/20251229_add_rss_feed_listing_strategy/migration.sql`

#### 3. Discovery Endpoints

Added 4 EUR-Lex RSS endpoints in `seed-endpoints.ts`:

| Endpoint                     | Purpose                      | Priority | Frequency    |
| ---------------------------- | ---------------------------- | -------- | ------------ |
| VAT & Taxation (HR)          | `eurovoc=8471`               | HIGH     | Daily        |
| Invoicing & E-invoicing (HR) | `eurovoc=8464`               | HIGH     | Daily        |
| Croatian EU Law Updates      | All directives & regulations | MEDIUM   | Daily        |
| Social Security (HR)         | `eurovoc=1954`               | MEDIUM   | Twice weekly |

Each endpoint includes metadata for domain classification and description.

#### 4. Sentinel Integration

Updated `src/lib/regulatory-truth/agents/sentinel.ts` to handle RSS feeds:

```typescript
if (endpoint.listingStrategy === "RSS_FEED") {
  let items = await parseRSSFeed(content)

  // Apply URL pattern filter if specified
  if (feedMeta?.urlPattern) {
    items = filterRSSByPattern(items, new RegExp(feedMeta.urlPattern))
  }

  // Apply date range filter if specified
  if (feedMeta?.startDate || feedMeta?.endDate) {
    items = filterRSSByDate(items, startDate, endDate)
  }

  discoveredUrls = items.map((item) => ({
    url: item.url,
    title: item.title,
    date: item.date,
  }))
}
```

## EUR-Lex RSS Feed URLs

EUR-Lex RSS feeds follow this pattern:

```
https://eur-lex.europa.eu/EN/display-rss.do?lang={LANG}&eurovoc={CODE}
```

### Parameters

- `lang`: Language code (e.g., `HR` for Croatian, `EN` for English)
- `eurovoc`: EuroVoc subject code for topic filtering
- `type_doc`: Document type filter (e.g., `DIR` for directive, `REG` for regulation)

### Key EuroVoc Codes for Croatian Compliance

- `8471`: VAT and taxation
- `8464`: Invoicing and accounting
- `1954`: Social security and contributions
- `2826`: Company law and business regulations
- `1348`: Labor law and employment

## Comparison: Static vs. Dynamic Approach

### Before (Static CELEX List)

```typescript
export const KEY_EU_LEGISLATION = [
  {
    celex: "32006L0112",
    title: "VAT Directive (Council Directive 2006/112/EC)",
    domain: "vat",
    effectiveFrom: "2007-01-01",
  },
  // ... only 5 manually curated items
]
```

**Limitations:**

- ❌ Manual curation required
- ❌ No automatic discovery
- ❌ No update notifications
- ❌ Limited to 5 pre-selected regulations

### After (Dynamic RSS Discovery)

```typescript
{
  domain: "eur-lex.europa.eu",
  path: "/EN/display-rss.do?lang=HR&eurovoc=8471",
  name: "EUR-Lex - VAT & Taxation (HR)",
  listingStrategy: "RSS_FEED",
  priority: "HIGH",
  scrapeFrequency: "DAILY",
}
```

**Benefits:**

- ✅ Automatic discovery of new regulations
- ✅ Daily updates via RSS polling
- ✅ Croatian language filtering
- ✅ Topic-based categorization
- ✅ Scales to thousands of documents

## Discovery Workflow

```
┌─────────────────────┐
│  EUR-Lex RSS Feed   │
│  (daily scrape)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sentinel Agent     │
│  - Parse RSS feed   │
│  - Filter by topic  │
│  - Extract URLs     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  DiscoveredItem     │
│  (PENDING status)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Fetch & Evidence   │
│  - Download content │
│  - Create Evidence  │
│  - Queue extract    │
└─────────────────────┘
```

## Testing the Implementation

### 1. Seed EUR-Lex Endpoints

```bash
npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts
```

This will create 4 EUR-Lex discovery endpoints in the database.

### 2. Run Sentinel Discovery

```bash
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --priority HIGH
```

This will:

- Fetch EUR-Lex RSS feeds
- Parse and extract document URLs
- Create DiscoveredItem records for each regulation

### 3. Verify Discovery

Query the database to see discovered EUR-Lex items:

```sql
SELECT
  di.url,
  di.title,
  di.publishedAt,
  di.status,
  de.name as endpoint_name
FROM "DiscoveredItem" di
JOIN "DiscoveryEndpoint" de ON di."endpointId" = de.id
WHERE de.domain = 'eur-lex.europa.eu'
ORDER BY di."publishedAt" DESC
LIMIT 10;
```

### 4. Check Evidence Creation

```sql
SELECT
  e.url,
  e."contentType",
  e."contentClass",
  rs.name as source_name
FROM "Evidence" e
JOIN "RegulatorySource" rs ON e."sourceId" = rs.id
WHERE rs.slug = 'eur-lex'
ORDER BY e."fetchedAt" DESC
LIMIT 10;
```

## EUR-Lex API Limitations

Based on EUR-Lex documentation research:

1. **SOAP Webservice:**
   - Requires registration
   - Expert search queries in specific syntax
   - 10,000 result limit per search (from Jan 2026)
   - Returns CELLAR IDs, not direct content

2. **RSS Feeds (Chosen Approach):**
   - ✅ No registration required
   - ✅ Simple HTTP GET requests
   - ✅ Built-in filtering by language/topic
   - ✅ Direct URLs to regulations
   - ⚠️ Limited to recent publications (typically last 6-12 months)

3. **CELLAR API:**
   - Advanced REST API for bulk data
   - Requires separate registration
   - More complex integration
   - Overkill for our needs

**Decision:** RSS feeds provide the optimal balance of:

- Ease of integration
- Automatic discovery
- No authentication overhead
- Sufficient coverage for active regulations

## Deprecation of Static CELEX List

The static CELEX list in `eurlex-fetcher.ts` is now **deprecated** but retained for:

1. **Backward Compatibility:** Existing code may reference `KEY_EU_LEGISLATION`
2. **One-off Lookups:** Manual CELEX identifier queries
3. **Historical Reference:** Documents the initial 5 core regulations

A deprecation notice has been added to the file header pointing developers to the RSS-based approach.

## Future Enhancements

1. **CELEX Extraction:** Parse CELEX identifiers from RSS feed URLs for metadata
2. **Translation Detection:** Detect when Croatian translations become available
3. **Relationship Mapping:** Link directives to implementing regulations
4. **Retroactive Discovery:** Use SOAP API to backfill historical regulations
5. **Custom Alerts:** User-defined RSS feed subscriptions for specific topics

## References

**EUR-Lex Documentation:**

- [Predefined RSS Alerts](https://eur-lex.europa.eu/content/help/search/predefined-rss.html)
- [Webservice Documentation](https://eur-lex.europa.eu/content/help/data-reuse/webservice.html)
- [Web Service User Manual (PDF)](https://eur-lex.europa.eu/content/tools/webservices/SearchWebServiceUserManual_v2.00.pdf)

**EuroVoc Thesaurus:**

- [EuroVoc Search](https://op.europa.eu/en/web/eu-vocabularies/th-concept-scheme/-/resource/eurovoc/100141)

## Conclusion

The transition from static CELEX lists to dynamic RSS discovery provides:

- **Scalability:** Handles thousands of regulations automatically
- **Currency:** Daily updates ensure fresh content
- **Relevance:** Croatian language and topic filtering
- **Maintainability:** No manual list curation required

This implementation aligns with FiskAI's "Living Truth" principle where regulatory content is continuously discovered and updated, not manually maintained.
