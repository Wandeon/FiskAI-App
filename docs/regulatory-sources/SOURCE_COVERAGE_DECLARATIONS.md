# Source Coverage Declarations

> Generated: 2026-01-05
> Status: v1.0 - Discovery Scope Frozen
> Last verified: 2026-01-05 19:09 UTC

This document is the **authoritative contract** for regulatory source coverage. It declares what we monitor, our detection SLA, and known blind spots.

**If it's not in this document, we don't monitor it.**

---

## Coverage Summary

| Status     | Count | Sources                                                                                        |
| ---------- | ----- | ---------------------------------------------------------------------------------------------- |
| COMPLETE   | 14    | NN, Porezna, HZZO, HZMO, HNB, FINA, MFin, MRMS, HOK, Vlada, Sabor, e-Savjetovanja, HANFA, AZOP |
| PARTIAL    | 2     | DZS (news only), HGK (headless enabled, stability pending)                                     |
| INCOMPLETE | 1     | EUR-Lex (RSS removed, access method unresolved)                                                |

---

## Source Declarations

### 1. Narodne novine (Official Gazette)

**Slug:** `nn`
**Domain:** `narodne-novine.nn.hr`
**Scope:** COMPLETE for new publications via sitemap

| Endpoint       | Type          | SLA | Strategy    |
| -------------- | ------------- | --- | ----------- |
| `/sitemap.xml` | SITEMAP_INDEX | 1h  | SITEMAP_XML |

**Update SLA:** Detect within 1 hour (EVERY_RUN)
**Change detection:** Sitemap diff
**Known blind spots:** Historical acts pre-sitemap not crawled
**Notes:** Primary source of truth for Croatian legislation

---

### 2. Porezna uprava (Tax Administration)

**Slug:** `porezna`
**Domain:** `porezna-uprava.gov.hr`
**Scope:** COMPLETE for news, opinions, regulations, forms

| Endpoint                             | Type           | SLA | Strategy   |
| ------------------------------------ | -------------- | --- | ---------- |
| `/hr/vijesti/8`                      | NEWS_LISTING   | 1h  | PAGINATION |
| `/hr/misljenja-su/3951`              | NEWS_LISTING   | 1h  | PAGINATION |
| `/HR_o_nama/Stranice/mapa-weba.aspx` | SITEMAP_INDEX  | 1h  | HTML_LIST  |
| `/hr/propisi-3950/3950`              | LEGAL_ACTS     | 24h | HTML_LIST  |
| `/hr/propisani-obrasci/3955`         | FORMS          | 48h | HTML_LIST  |
| `/hr/fiskalizacija-faq/8031`         | ANNOUNCEMENTS  | 48h | HTML_LIST  |
| `/hr/porezni-sustav/3954`            | TECHNICAL_DOCS | 7d  | HTML_LIST  |

**Update SLA:** CRITICAL surfaces within 1h, others within 24-48h
**Change detection:** Content hash, pagination scan
**Known blind spots:** None identified

---

### 3. HZZO (Health Insurance Fund)

**Slug:** `hzzo`
**Domain:** `hzzo.hr`
**Scope:** COMPLETE for news, legal acts, drug lists, code lists

| Endpoint                                                      | Type           | SLA | Strategy    |
| ------------------------------------------------------------- | -------------- | --- | ----------- |
| `/novosti`                                                    | NEWS_LISTING   | 1h  | PAGINATION  |
| `/pravni-akti`                                                | LEGAL_ACTS     | 1h  | HTML_LIST   |
| `/e-zdravstveno/novosti`                                      | NEWS_LISTING   | 24h | HTML_LIST   |
| `/poslovni-subjekti/hzzo-za-partnere/sifrarnici-hzzo-0`       | CODE_LISTS     | 24h | HTML_LIST   |
| `/zdravstvena-zastita/objavljene-liste-lijekova`              | TECHNICAL_DOCS | 24h | HTML_LIST   |
| `/sitemap.xml`                                                | SITEMAP_INDEX  | 24h | SITEMAP_XML |
| `/natjecaji`                                                  | ANNOUNCEMENTS  | 48h | HTML_LIST   |
| `/o-nama/upravno-vijece/odluke-uv`                            | LEGAL_ACTS     | 48h | HTML_LIST   |
| `/pravo-na-pristup-informacijama/savjetovanje-s-javnoscu-...` | CONSULTATIONS  | 48h | HTML_LIST   |
| `/lijecnicki-pregledi/uputnice-i-potvrde`                     | TECHNICAL_DOCS | 7d  | HTML_LIST   |

**Update SLA:** News/legal within 1h, supporting docs within 24-48h
**Change detection:** Content hash, sitemap diff
**Known blind spots:** None identified

---

### 4. HZMO (Pension Insurance Fund)

**Slug:** `hzmo`
**Domain:** `mirovinsko.hr`
**Scope:** COMPLETE for news, regulations, statistics, forms

| Endpoint                                 | Type         | SLA | Strategy   |
| ---------------------------------------- | ------------ | --- | ---------- |
| `/hr/vijesti/114`                        | NEWS_LISTING | 1h  | PAGINATION |
| `/hr/priopcenja-204/204`                 | NEWS_LISTING | 1h  | PAGINATION |
| `/hr/propisi/54`                         | LEGAL_ACTS   | 1h  | HTML_LIST  |
| `/hr/doplatak-za-djecu/12`               | LEGAL_ACTS   | 24h | HTML_LIST  |
| `/hr/statistika/860`                     | STATISTICS   | 24h | HTML_LIST  |
| `/hr/prijave-i-odjave-na-osiguranje/234` | LEGAL_ACTS   | 48h | HTML_LIST  |
| `/hr/tiskanice-1098/1098`                | FORMS        | 48h | HTML_LIST  |
| `/hr/misljenja-ministarstva/56`          | LEGAL_ACTS   | 7d  | HTML_LIST  |

**Update SLA:** News/regulations within 1h, forms within 48h
**Change detection:** Content hash, pagination scan
**Known blind spots:** None identified

---

### 5. HNB (Croatian National Bank)

**Slug:** `hnb`
**Domains:** `hnb.hr`, `www.hnb.hr`
**Scope:** COMPLETE for announcements, statistics, exchange rates, publications

| Endpoint                                                    | Type           | SLA | Strategy  |
| ----------------------------------------------------------- | -------------- | --- | --------- |
| `/javnost-rada/priopcenja`                                  | NEWS_LISTING   | 1h  | HTML_LIST |
| `/statistika/statisticka-priopcenja`                        | STATISTICS     | 1h  | HTML_LIST |
| `www.hnb.hr/.../devizni-tecajevi/referentni-tecajevi-esb-a` | STATISTICS     | 1h  | HTML_LIST |
| `/javnost-rada/novosti`                                     | NEWS_LISTING   | 24h | HTML_LIST |
| `/redovne-publikacije/bilten`                               | TECHNICAL_DOCS | 24h | HTML_LIST |
| `/redovne-publikacije/financijska-stabilnost`               | TECHNICAL_DOCS | 24h | HTML_LIST |
| `/statistika/kalendar-objava`                               | ANNOUNCEMENTS  | 24h | HTML_LIST |
| `/bankarski-sustav/propisi`                                 | LEGAL_ACTS     | 48h | HTML_LIST |
| `/platni-sustav`                                            | TECHNICAL_DOCS | 48h | HTML_LIST |
| `/redovne-publikacije/bilten-o-bankama`                     | TECHNICAL_DOCS | 48h | HTML_LIST |
| `/redovne-publikacije/godisnje-izvjesce`                    | TECHNICAL_DOCS | 7d  | HTML_LIST |

**Update SLA:** Announcements/exchange rates within 1h
**Change detection:** Content hash
**Known blind spots:** Some deep statistical data not monitored

---

### 6. FINA (Financial Agency)

**Slug:** `fina`
**Domain:** `fina.hr`
**Scope:** COMPLETE for news, e-invoice announcements, certificates

| Endpoint                              | Type           | SLA | Strategy   |
| ------------------------------------- | -------------- | --- | ---------- |
| `/novosti`                            | NEWS_LISTING   | 1h  | PAGINATION |
| `/obavijesti/fina-e-racun`            | ANNOUNCEMENTS  | 1h  | PAGINATION |
| `/obavijesti/digitalni-certifikati`   | ANNOUNCEMENTS  | 24h | PAGINATION |
| `/obavijesti/e-racun-u-javnoj-nabavi` | ANNOUNCEMENTS  | 24h | PAGINATION |
| `/digitalizacija-poslovanja/e-racun`  | TECHNICAL_DOCS | 48h | HTML_LIST  |
| `/poslovne-informacije/bon`           | TECHNICAL_DOCS | 7d  | HTML_LIST  |

**Update SLA:** News within 1h, technical docs within 48h
**Change detection:** Content hash, pagination scan
**Known blind spots:** None identified

---

### 7. Ministarstvo financija (Ministry of Finance)

**Slug:** `mfin`
**Domain:** `mfin.gov.hr`
**Scope:** COMPLETE for news, legislation, consultations

| Endpoint                                 | Type          | SLA | Strategy   |
| ---------------------------------------- | ------------- | --- | ---------- |
| `/vijesti/8`                             | NEWS_LISTING  | 1h  | PAGINATION |
| `/istaknute-teme/zakoni-i-propisi/523`   | LEGAL_ACTS    | 24h | HTML_LIST  |
| `/istaknute-teme/javne-konzultacije/524` | CONSULTATIONS | 48h | HTML_LIST  |

**Update SLA:** News within 1h, legislation within 24h
**Change detection:** Content hash, pagination scan
**Known blind spots:** None identified

---

### 8. MRMS (Ministry of Labour and Pension System)

**Slug:** `mrms`
**Domain:** `mrosp.gov.hr`
**Scope:** COMPLETE for news

| Endpoint     | Type         | SLA | Strategy   |
| ------------ | ------------ | --- | ---------- |
| `/vijesti/8` | NEWS_LISTING | 1h  | PAGINATION |

**Update SLA:** News within 1h
**Change detection:** Content hash, pagination scan
**Known blind spots:** Legislation pages not yet mapped

---

### 9. HOK (Croatian Chamber of Trades)

**Slug:** `hok`
**Domain:** `www.hok.hr`
**Scope:** COMPLETE for news, announcements

| Endpoint                                         | Type          | SLA | Strategy   |
| ------------------------------------------------ | ------------- | --- | ---------- |
| `/novosti/novosti-iz-hok`                        | NEWS_LISTING  | 1h  | PAGINATION |
| `/aktualno`                                      | ANNOUNCEMENTS | 24h | HTML_LIST  |
| `/medunarodna-suradnja-i-eu/novosti-i-dogadanja` | NEWS_LISTING  | 24h | HTML_LIST  |

**Update SLA:** News within 1h, announcements within 24h
**Change detection:** Content hash, pagination scan
**Known blind spots:** None identified
**Notes:** Domain requires `www.` prefix

---

### 10. Vlada (Government of Croatia)

**Slug:** `vlada`
**Domain:** `vlada.gov.hr`
**Scope:** COMPLETE for government news

| Endpoint     | Type         | SLA | Strategy   |
| ------------ | ------------ | --- | ---------- |
| `/vijesti/8` | NEWS_LISTING | 1h  | PAGINATION |

**Update SLA:** News within 1h
**Change detection:** Content hash, pagination scan
**Known blind spots:** Session decisions not directly monitored (published via NN)

---

### 11. Sabor (Croatian Parliament)

**Slug:** `sabor`
**Domain:** `sabor.hr`
**Scope:** COMPLETE for press releases

| Endpoint               | Type         | SLA | Strategy   |
| ---------------------- | ------------ | --- | ---------- |
| `/hr/press/priopcenja` | NEWS_LISTING | 24h | PAGINATION |

**Update SLA:** Press releases within 24h
**Change detection:** Content hash, pagination scan
**Known blind spots:** Legislative tracking done via NN, not Sabor directly

---

### 12. e-Savjetovanja (Public Consultations Portal)

**Slug:** `esavjetovanja`
**Domain:** `esavjetovanja.gov.hr`
**Scope:** COMPLETE for open consultations discovery

| Endpoint          | Type          | SLA | Strategy  |
| ----------------- | ------------- | --- | --------- |
| `/ECon/Dashboard` | CONSULTATIONS | 24h | HTML_LIST |

**Update SLA:** New consultations within 24h
**Change detection:** Content hash
**Known blind spots:**

- Full participation requires login (discovery is public)
- Use `/ECon/Dashboard` NOT `/ECon/MainScreen`

---

### 13. HANFA (Financial Services Supervisory Agency)

**Slug:** `hanfa`
**Domain:** `hanfa.hr`
**Scope:** COMPLETE for news

| Endpoint    | Type         | SLA | Strategy  |
| ----------- | ------------ | --- | --------- |
| `/vijesti/` | NEWS_LISTING | 24h | HTML_LIST |

**Update SLA:** News within 24h
**Change detection:** Content hash
**Known blind spots:** Regulations section not yet mapped

---

### 14. AZOP (Data Protection Agency)

**Slug:** `azop`
**Domain:** `azop.hr`
**Scope:** COMPLETE for news

| Endpoint    | Type         | SLA | Strategy  |
| ----------- | ------------ | --- | --------- |
| `/novosti/` | NEWS_LISTING | 24h | HTML_LIST |

**Update SLA:** News within 24h
**Change detection:** Content hash
**Known blind spots:** Decisions/opinions section not yet mapped

---

### 15. DZS (Croatian Bureau of Statistics)

**Slug:** `dzs`
**Domain:** `dzs.gov.hr`
**Scope:** PARTIAL - news only

| Endpoint     | Type         | SLA | Strategy   |
| ------------ | ------------ | --- | ---------- |
| `/vijesti/8` | NEWS_LISTING | 24h | PAGINATION |

**Update SLA:** News within 24h
**Change detection:** Content hash, pagination scan
**Known blind spots:**

- Statistical releases require manual extraction
- Data portal not monitored

---

## INCOMPLETE Sources

### EUR-Lex (European Union Law)

**Slug:** `eurlex`
**Domain:** `eur-lex.europa.eu`
**Status:** INCOMPLETE - access method unresolved

**Reason:** All 4 configured RSS endpoints returned HTTP 404. The RSS URL format was incorrect.

**Required action:**

1. Research correct EUR-Lex API/feed access
2. Minimal v1: Official Journal "L" series + metadata
3. Then expand to CELEX-based retrieval

**Until resolved:** EU law coverage is explicitly MISSING. Do not claim coverage.

---

### 16. HGK (Croatian Chamber of Economy)

**Slug:** `hgk`
**Domain:** `hgk.hr`
**Scope:** PARTIAL - headless lane enabled, stability verification pending

| Endpoint   | Type         | SLA | Strategy  |
| ---------- | ------------ | --- | --------- |
| `/vijesti` | NEWS_LISTING | 24h | HTML_LIST |

**Status:** PARTIAL - capability exists, operational proof pending

**Update SLA:** News within 24h (once stability verified)
**Change detection:** Content hash (post-JS-render)

**Constraints:**

- Headless browser only (Playwright)
- Strict rate limits: concurrency=1 per domain, 5 req/min, 30s render timeout
- Single surface: `/vijesti` only (no pagination/load-more yet)

**Known blind spots:**

- Pagination/load-more not implemented (latest page only)
- Category filters not crawled
- Sub-pages not followed

**Stability verification required (72-hour gate):**

1. 3 consecutive scheduled runs complete without timeout
2. HGK endpoint: lastSuccessAt updated, consecutiveErrors=0
3. DiscoveredItems created on first run
4. Evidence snapshots exist for listing HTML
5. No endpoint alerts triggered

**Notes:** Uses `metadata.requiresHeadless=true`. Will be promoted to COMPLETE after stability gate passes.

---

## Rate Limiting Contract

All fetches go through `fetchWithRateLimit()` which enforces:

| Parameter                            | Value                           |
| ------------------------------------ | ------------------------------- |
| Delay between requests (per domain)  | 2000ms                          |
| Max requests per minute (per domain) | 20                              |
| Max concurrent requests (per domain) | 1                               |
| Circuit breaker threshold            | 5 consecutive errors            |
| Circuit breaker reset                | 1 hour                          |
| Request timeout                      | 30 seconds                      |
| Retry attempts                       | 3                               |
| Retry strategy                       | Exponential backoff with jitter |

**robots.txt compliance:** All sources checked 2026-01-05, no blocking rules found.

---

## Alerting Contract (TODO)

To achieve the "detect within 24h" SLA, these alerts must be implemented:

1. **CRITICAL endpoint failure** - Alert when consecutiveErrors >= 3
2. **SLA breach** - Alert when lastScrapedAt exceeds 24h for CRITICAL/HIGH
3. **Discovery stall** - Alert when no new items for 7 days

Status: Not yet implemented. Required for Phase 3.

---

## Version History

| Date       | Version | Changes                                                                                 |
| ---------- | ------- | --------------------------------------------------------------------------------------- |
| 2026-01-05 | 1.1     | HGK headless lane enabled (PARTIAL). 57 endpoints across 16 sources. Stability pending. |
| 2026-01-05 | 1.0     | Initial coverage freeze. 56 endpoints across 15 sources.                                |
