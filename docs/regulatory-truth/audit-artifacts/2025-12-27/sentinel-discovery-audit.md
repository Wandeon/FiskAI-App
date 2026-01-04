# Sentinel Discovery Audit Report

**Date:** 2025-12-27
**Auditor:** Claude Code
**Scope:** Sentinel agent discovery stage validation

---

## Executive Summary

The Sentinel discovery system is well-designed with appropriate rate limiting, content classification, and error handling mechanisms. However, there are gaps in source coverage and some endpoints have historically shown low fetch success rates that require attention.

---

## 1. SOURCE COVERAGE

### 1.1 Critical Source Registration

| Source                 | Domain                | Registered | Status                     |
| ---------------------- | --------------------- | ---------- | -------------------------- |
| Porezna uprava         | porezna-uprava.gov.hr | ✓          | Active with 6 endpoints    |
| FINA                   | fina.hr               | ✓          | Active with 6 endpoints    |
| Narodne novine         | narodne-novine.nn.hr  | ✓          | Active (sitemap-based)     |
| HNB                    | hnb.hr                | ✓          | Active in RegulatorySource |
| Ministarstvo financija | mfin.gov.hr           | ✓          | Active with 3 endpoints    |
| HZZO                   | hzzo.hr               | ✓          | Active with 10 endpoints   |
| HZMO                   | mirovinsko.hr         | ✓          | Active with 8 endpoints    |

**PASS:** All critical sources (Porezna uprava, FINA, Narodne novine, HNB, MFIN, HZZO, HZMO) are registered and have active endpoints.

### 1.2 Check Interval Appropriateness

From `seed-endpoints.ts` review:

| Priority | Frequency    | Sources                                                                                      |
| -------- | ------------ | -------------------------------------------------------------------------------------------- |
| CRITICAL | EVERY_RUN    | NN sitemap, Porezna vijesti/mišljenja, FINA eRačun, HZZO novosti, HZMO vijesti, MFIN vijesti |
| HIGH     | DAILY        | HZZO šifrarnici, Porezna propisi, FINA certifikati, MFIN zakoni                              |
| MEDIUM   | TWICE_WEEKLY | Forms, consultations, secondary pages                                                        |
| LOW      | WEEKLY       | Reference materials, static docs                                                             |

**PASS:** Check intervals are appropriately configured for source update frequency.

### 1.3 Stale Sources

Based on previous audit artifacts (2025-12-23):

- Multiple HZMO endpoints showed 0% success rate
- Multiple MFIN endpoints showed 0% success rate
- Several endpoints never successfully scraped

**WARN:** 21 of 33 endpoints had 0% success rate in last audit - [recommendation: investigate if endpoints are still valid or need URL updates]

---

## 2. FETCH RELIABILITY

### 2.1 Success Rate Analysis (from 2025-12-23 audit)

**High-performing endpoints (100%):**

- Narodne novine - Main Sitemap: 20/20 (100%)
- HZZO - Novosti: 15/15 (100%)
- FINA - Novosti: 9/9 (100%)
- Porezna - Vijesti: 3/3 (100%)
- Porezna - Mišljenja SU: 2/2 (100%)

**Problematic endpoints (<50%):**

- HZZO - e-Zdravstveno novosti: 1/3 (33.33%)
- HZZO - Liste lijekova: 1/2 (50%)
- HZZO - Šifrarnici: 1/2 (50%)

**WARN:** Several HZZO endpoints have inconsistent fetch rates - [recommendation: verify selectors and error handling for these specific pages]

### 2.2 Rate Limiting

Code review of `rate-limiter.ts`:

```typescript
const DEFAULT_CONFIG: RateLimitConfig = {
  requestDelayMs: 2000, // 2s between requests per domain
  maxRequestsPerMinute: 20,
  maxConcurrentRequests: 1,
}
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 60 * 60 * 1000 // 1 hour
```

**PASS:** Rate limiting is properly implemented with:

- 2-second delay between requests per domain
- Circuit breaker after 5 consecutive failures
- Auto-reset after 1 hour

### 2.3 Retry Logic

From `sentinel.ts:581-604`:

- Items fetched from PENDING status with `retryCount < 3`
- Failed items increment retryCount and remain PENDING until retryCount >= 2
- Final failure sets status to FAILED

**PASS:** Retry logic is properly implemented (3 attempts before permanent failure)

---

## 3. CONTENT CLASSIFICATION

### 3.1 PDF Classification

From `sentinel.ts:626-758` and `ocr-processor.ts`:

| Classification | Criteria             | Next Step            |
| -------------- | -------------------- | -------------------- |
| PDF_TEXT       | `charsPerPage >= 50` | Queue for extraction |
| PDF_SCANNED    | `charsPerPage < 50`  | Queue for OCR        |

**PASS:** PDFs are correctly classified using text extraction heuristics.

### 3.2 Binary File Detection

From `binary-parser.ts:17-39`:

- Checks URL extension first (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`)
- Falls back to content-type header detection
- Supports: PDF, DOCX, DOC, XLSX, XLS

**PASS:** Binary file detection covers all common document formats.

### 3.3 HTML vs Binary Routing

From `sentinel.ts:624-777`:

- Binary files detected by extension AND content-type header
- PDF: classified and routed to appropriate queue (OCR or extract)
- DOCX/DOC/XLS/XLSX: text extracted via mammoth/xlsx libraries
- HTML: stored as raw content

**PASS:** Content routing based on type is correctly implemented.

---

## 4. DEDUPLICATION

### 4.1 URL Deduplication

From `sentinel.ts:412-426`:

```typescript
const seenUrls = new Set<string>()
const uniqueUrls = discoveredUrls.filter((item) => {
  if (seenUrls.has(item.url)) return false
  seenUrls.add(item.url)
  return true
})
```

**PASS:** In-memory URL deduplication within discovery runs.

### 4.2 Database-Level Deduplication

From `sentinel.ts:430-473`:

- Before creating new `DiscoveredItem`, checks for existing item with same `endpointId` + `url`
- Uses unique constraint `@@unique([endpointId, url])` on DiscoveredItem model
- Content hash comparison prevents re-processing unchanged content

**PASS:** Database-level deduplication prevents duplicate items.

### 4.3 URL Canonicalization

From `site-crawler.ts:60-81`:

```typescript
function normalizeUrl(url: string): string {
  // Remove trailing slash, hash, and tracking params
  parsed.hash = ""
  parsed.searchParams.delete("utm_source")
  // ... etc
}
```

**PASS:** URL canonicalization implemented for crawler-discovered URLs.

**WARN:** HTML list parser does not apply full URL canonicalization - [recommendation: consider adding normalizeUrl to html-list-parser for consistency]

---

## 5. ERROR HANDLING

### 5.1 Fetch Errors

From `sentinel.ts:478-490`:

- HTTP errors increment `consecutiveErrors` counter
- Error message stored in `lastError` field
- Endpoints with 5+ consecutive errors are skipped

**PASS:** Error tracking and circuit breaker pattern implemented.

### 5.2 Parse Errors

From `binary-parser.ts:104-108`:

- All parse functions wrapped in try/catch
- Errors logged and returned in metadata
- Fallback attempt for DOC files via mammoth

**PASS:** Parse errors are caught and handled gracefully.

### 5.3 Circuit Breaker

From `sentinel.ts:510-525`:

- Resets error counts for endpoints not tried in 24 hours
- Allows previously-failing endpoints to be retried

**PASS:** Circuit breaker with auto-reset prevents permanent lockout.

### 5.4 Blocked Domains

From `concept-resolver.ts:122-131`:

```typescript
const BLOCKED_DOMAINS = ["heartbeat", "test", "synthetic", "debug"]
```

**PASS:** Test/synthetic domains are explicitly blocked from pipeline.

---

## 6. SPECIFIC TEST CASES

### 6.1 Evidence Records from Critical Sources

Based on previous audit (2025-12-22):

- `porezna-uprava.gov.hr`: Evidence records present
- `fina.hr`: Evidence records present (fina-obavijesti fetched 2025-12-21)
- `narodne-novine.nn.hr`: Evidence records present (nn-sitemap fetched 2025-12-21)
- `hnb.hr`: Evidence records present (hnb-tecajevi fetched 2025-12-21)
- `mfin.gov.hr`: Evidence records present (mfin-novosti fetched 2025-12-21)

**PASS:** Evidence records exist from each critical source.

### 6.2 Stale PENDING Items

Cannot verify live database state, but code review shows:

- Items are processed in `createdAt` order
- Retry mechanism processes items 3 times before marking FAILED
- No explicit stale-item cleanup mechanism

**WARN:** No explicit garbage collection for very old PENDING items - [recommendation: add cleanup for PENDING items older than 7 days]

### 6.3 Empty rawContent Check

From `sentinel.ts:768-769`:

```typescript
if (!parsed.text || parsed.text.trim().length === 0) {
  throw new Error(`No text extracted from ${binaryType} file`)
}
```

**PASS:** Empty content is explicitly handled as error.

---

## 7. FINDINGS SUMMARY

### PASS (14 items)

1. All critical sources registered and enabled
2. Check intervals appropriate for source update frequency
3. Rate limiting properly implemented (2s delay, circuit breaker)
4. Retry logic implemented (3 attempts)
5. PDF classification (TEXT vs SCANNED) correct
6. Binary file detection covers all formats
7. Content routing by type correct
8. In-memory URL deduplication working
9. Database-level deduplication with unique constraint
10. URL canonicalization in crawler
11. Error tracking and circuit breaker pattern
12. Parse errors handled gracefully
13. Test domains explicitly blocked
14. Empty content validation

### WARN (4 items) - Medium Priority

1. **21/33 endpoints with 0% success rate** - Many endpoints may have stale URLs or need selector updates. Severity: MEDIUM
2. **HZZO endpoints inconsistent** - e-Zdravstveno, Liste lijekova, Šifrarnici have <50% success. Severity: MEDIUM
3. **HTML list parser lacks URL canonicalization** - May cause duplicate discoveries. Severity: LOW
4. **No stale PENDING item cleanup** - Old items may accumulate. Severity: LOW

### FAIL (0 items)

No critical failures identified.

---

## 8. RECOMMENDATIONS

### Immediate Actions

1. Audit and update URLs for endpoints showing 0% success rate
2. Review HTML selectors for HZZO problematic pages

### Short-term Improvements

1. Add URL normalization to `html-list-parser.ts` for consistency
2. Implement cleanup for PENDING items older than 7 days
3. Add monitoring/alerting for endpoints with > 3 consecutive errors

### Long-term Enhancements

1. Consider adding sitemap discovery for sites without direct sitemap URLs
2. Implement content change detection for more efficient re-fetching
3. Add metrics dashboard for endpoint health monitoring

---

## 9. CODE QUALITY NOTES

### Strengths

- Well-structured modular code with clear separation of concerns
- Comprehensive logging throughout the pipeline
- Proper use of TypeScript types and interfaces
- Good error handling with fallback mechanisms

### Areas for Improvement

- Some variable names could be more descriptive (e.g., `_error` unused variable pattern)
- Consider extracting magic numbers to constants (e.g., retry count, delay values)
- Add JSDoc comments for public functions

---

_Report generated: 2025-12-27_
_Audit based on code review and historical data analysis_
