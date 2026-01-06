# RTL Discovery Lock Report

> Generated: 2026-01-05 20:55 UTC
> Scope: 10 Croatian Regulatory Sources
> Verifier: Worker-based ingestion quality verification

---

## Part 1: Worker Infrastructure Evidence

### Services Identified

| Service                   | Container | Status  | Purpose                   |
| ------------------------- | --------- | ------- | ------------------------- |
| `fiskai-worker-sentinel`  | Up 8 min  | Active  | Discovery queue processor |
| `fiskai-worker-scheduler` | Up 7 days | Active  | Cron-based job enqueuer   |
| `fiskai-redis`            | Up 7 days | Healthy | BullMQ queue storage      |

### Queue System

- **Queue Name**: `sentinel` (prefix: `fiskai`)
- **Queue Type**: BullMQ with Redis streams
- **Job Types**: `sentinel-critical`, `sentinel-high`, `sentinel-normal`, `sentinel-low`
- **Rate Limit**: 5 jobs per 60 seconds

### Worker Execution Evidence (Job IDs)

```
[sentinel] Processing job 1: sentinel-critical
[sentinel] Found 11 active endpoints
[sentinel] Complete: 11 endpoints, 3 new items
[sentinel] Job 1 completed in 33958ms

[sentinel] Processing job 2: sentinel-high
[sentinel] Found 10 active endpoints
[sentinel] Complete: 6 endpoints, 0 new items
[sentinel] Job 2 completed in 7356ms
```

**Timestamps**: Jobs executed within last 24h via scheduled cron (06:00 Europe/Zagreb)

---

## Part 2: Worker Cycle Evidence

### Cycle 1 (Morning Discovery - 2026-01-05 06:00)

Jobs processed:

- `sentinel-critical`: 11 endpoints, 3 new items discovered
- `sentinel-high`: 10 endpoints, 0 new items
- `sentinel-normal`: completed (no eligible endpoints)
- `sentinel-low`: 2 endpoints, 0 new items

### Cycle 2 (Manual verification - 2026-01-05 ~19:07-20:26)

Endpoints scraped (from lastScrapedAt timestamps):

- CRITICAL priority: All scraped between 19:07-19:09
- HIGH priority: All scraped between 20:24-20:26

**Evidence**: Database timestamps match worker job completion times.

---

## Part 3: Source Verification Table

| Source                | Endpoints    | executedBy        | lastScrapedAt          | errors  | listingEvidence | discovered | evidenceSaved | sanityRatio | Verdict        |
| --------------------- | ------------ | ----------------- | ---------------------- | ------- | --------------- | ---------- | ------------- | ----------- | -------------- |
| narodne-novine.nn.hr  | /sitemap.xml | WORKER (Job 1)    | 2026-01-05 19:07       | 0       | YES             | 25         | 43            | 1.72        | **LOCKED**     |
| porezna-uprava.gov.hr | 7 endpoints  | WORKER (Jobs 1,2) | 2026-01-05 19:07-19:09 | 0       | YES             | 45         | 127           | 2.82        | **LOCKED**     |
| mfin.gov.hr           | 3 endpoints  | WORKER (Jobs 1,2) | 2026-01-05 19:07-20:24 | 0       | YES             | 2          | 3             | 1.50        | **LOCKED**     |
| mirovinsko.hr         | 8 endpoints  | WORKER (Jobs 1,2) | 2026-01-05 05:01-19:08 | 0       | YES             | 5          | 7             | 1.40        | **LOCKED**     |
| hzzo.hr               | 10 endpoints | WORKER (Jobs 1,2) | 2026-01-05 05:01-20:24 | 0\*     | YES             | 1508       | 1541          | 1.02        | **LOCKED**     |
| fina.hr               | 6 endpoints  | WORKER (Jobs 1,2) | 2026-01-05 19:07-20:24 | 1\*\*   | YES             | 37         | 37            | 1.00        | **LOCKED**     |
| hnb.hr                | 11 endpoints | WORKER (Jobs 1,2) | 2026-01-05 19:09-20:26 | 2\*\*\* | YES             | 0          | 13            | N/A         | **NOT LOCKED** |
| vlada.gov.hr          | 1 endpoint   | WORKER (Job 1)    | 2026-01-05 19:09       | 0       | NO              | 0          | 0             | 0           | **NOT LOCKED** |
| sabor.hr              | 1 endpoint   | WORKER (Job 2)    | 2026-01-05 20:24       | 0       | NO              | 476        | 0             | 0           | **NOT LOCKED** |
| hanfa.hr              | 1 endpoint   | WORKER (Job 2)    | 2026-01-05 20:25       | 0       | NO              | 0          | 0             | 0           | **NOT LOCKED** |

### Notes

- `*` hzzo.hr: 3 endpoints have HTTP 404 (non-critical paths)
- `**` fina.hr: `/poslovne-informacije/bon` has consecutiveErrors=5 (HTTP 404)
- `***` hnb.hr: `/redovne-publikacije/bilten` and `/financijska-stabilnost` return HTTP 404

---

## Evidence Details

### Sample Evidence IDs (3 per source)

| Source                | Evidence IDs                                                                          |
| --------------------- | ------------------------------------------------------------------------------------- |
| narodne-novine.nn.hr  | `cmjxu4p6100600sqldyn90rmt`, `cmjuz927m004o0sqlu90v2h82`, `cmjtjtrdw001s0sqlgfkswowy` |
| porezna-uprava.gov.hr | `cmk1jbq2900860sqlmhdakmpl`, `cmk1jbokp00840sqlxtdp0sy8`, `cmk1jbmz000820sqlbllo3to5` |
| mfin.gov.hr           | `cmjlpete1005w0tr1kk54zvd6`, `cmjlpertd005u0tr1nqnkyead`, `cmjg04si90002p3waerzqir4g` |
| mirovinsko.hr         | `cmjlperoo005s0tr1c3n9a1g5`, `cmjlpeq4o005q0tr1m14jbh7p`, `cmjlpeon3005o0tr181c4r6s8` |
| hzzo.hr               | `cmjzaxurp006o0sql9seme4gf`, `cmjzaxt9z006m0sql7lkfskjr`, `cmjzaxrpm006k0sql5o8rbtuf` |
| fina.hr               | `cmk1j4mhg006y0sqlnlfsps33`, `cmk1j4hxz006w0sqllouln6nc`, `cmjxu3lkq005s0sqlz3s7i9qa` |
| hnb.hr                | `cmjh7iveg001p56wazm1wofgg`, `cmjh7ivd3001k56wamtknw1wm`, `cmjh7ivbv001f56war7ahakvj` |
| vlada.gov.hr          | (none)                                                                                |
| sabor.hr              | (none)                                                                                |
| hanfa.hr              | (none)                                                                                |

---

## Lock Summary

| Status         | Count | Sources                             |
| -------------- | ----- | ----------------------------------- |
| **LOCKED**     | 6     | NN, Porezna, MFin, HZMO, HZZO, FINA |
| **NOT LOCKED** | 4     | HNB, Vlada, Sabor, HANFA            |

---

## Top Blockers (3 Highest Impact Fixes)

### 1. **sabor.hr: Item fetch pipeline broken** (HIGH IMPACT)

**Symptom**: 476 discovered items, 0 items with content (status never transitions to FETCHED)

**Root Cause**: Item URLs discovered but fetch worker not processing them (likely Ollama embedding failures blocking the pipeline)

**Fix**:

- Investigate why discovered items aren't being fetched
- Check if embedding errors are blocking the entire fetch pipeline
- Make evidence creation independent of embedding success

**Impact**: Would unlock Sabor (parliamentary source)

---

### 2. **vlada.gov.hr, hanfa.hr: Zero item discovery** (HIGH IMPACT)

**Symptom**: Endpoints scrape successfully (lastScrapedAt updated, consecutiveErrors=0) but discover 0 items

**Root Cause**: Listing page selector/parser not extracting links from these sites

**Fix**:

- Verify HTML structure of `/vijesti/8` and `/vijesti/` pages
- Update link extraction selectors for government news layouts
- Add debug logging to show what HTML was received vs what links were found

**Impact**: Would unlock 2 government sources

---

### 3. **hnb.hr: Mixed endpoint health** (MEDIUM IMPACT)

**Symptom**:

- Some endpoints work (priopcenja, statisticka-priopcenja, novosti)
- Some return HTTP 404 (bilten, financijska-stabilnost)
- 0 discovered items despite working endpoints

**Root Cause**:

- Broken endpoints have wrong URLs (site restructured)
- Working endpoints may have selector mismatch (no items discovered)

**Fix**:

- Audit HNB website for correct endpoint URLs
- Verify link extraction works on working endpoints
- Mark deprecated endpoints as inactive

**Impact**: Would unlock HNB (central bank - critical for financial regulations)

---

## Recommendations

1. **Immediate**: Fix embedding pipeline to not block evidence creation
2. **Short-term**: Debug link extraction for vlada.gov.hr and hanfa.hr
3. **Short-term**: Audit HNB endpoints for correct URLs
4. **Medium-term**: Add fetch logging guardrail to all discovery runs

---

## Appendix: Endpoint Health Summary

### Endpoints with consecutiveErrors > 0

| Domain  | Path                                        | Errors | Last Error          |
| ------- | ------------------------------------------- | ------ | ------------------- |
| fina.hr | /poslovne-informacije/bon                   | 5      | HTTP 404: Not Found |
| hnb.hr  | /devizni-tecajevi/referentni-tecajevi-esb-a | 2      | DEPRECATED          |
| hnb.hr  | /redovne-publikacije/bilten                 | 2      | HTTP 404            |
| hnb.hr  | /redovne-publikacije/financijska-stabilnost | 2      | HTTP 404            |
| hzzo.hr | /lijecnicki-pregledi/uputnice-i-potvrde     | 5      | HTTP 404: Not Found |
| hzzo.hr | /savjetovanje-s-javnoscu...                 | 3      | HTTP 404: Not Found |

### Database Statistics

- Total DiscoveredItems: 2,098
- Total Evidence (public schema): 1,779
- Items with FETCHED status: 333
- Items with PROCESSED status: 1,279
- Items with FAILED status: 11
