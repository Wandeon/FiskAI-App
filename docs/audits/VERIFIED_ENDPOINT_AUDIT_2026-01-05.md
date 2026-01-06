# Verified Regulatory Endpoint Audit

> **Generated:** 2026-01-05
> **Method:** Live HTTP verification via WebFetch
> **Scope:** Croatian regulatory sources for RTL evidence pipeline

---

## VERIFIED_CURRENT_ENDPOINTS

### Verification Summary

| Status            | Count                             |
| ----------------- | --------------------------------- |
| VERIFIED WORKING  | 17                                |
| FAILED/BROKEN     | 7                                 |
| REQUIRES HEADLESS | 2                                 |
| DOMAIN REDIRECT   | 2                                 |
| NOT VERIFIED      | 30 (remaining from 56 configured) |

### Verified Working Endpoints

| sourceSlug     | configuredUrl                                 | finalUrl                          | status | contentType | robotsAllowed                         | authRequired | listingStrategyConfirmed | notes                                                           |
| -------------- | --------------------------------------------- | --------------------------------- | ------ | ----------- | ------------------------------------- | ------------ | ------------------------ | --------------------------------------------------------------- |
| narodne-novine | `https://narodne-novine.nn.hr/sitemap.xml`    | same                              | 200    | XML         | YES (partial, /clanci/oglasi blocked) | NO           | YES                      | Sitemap index with 1800+ child sitemaps, covers 1990-present    |
| hzzo           | `https://hzzo.hr/novosti`                     | same                              | 200    | HTML        | YES                                   | NO           | YES                      | Paginated news, dates visible, category filters                 |
| hzzo           | `https://hzzo.hr/pravni-akti`                 | same                              | 200    | HTML        | YES                                   | NO           | YES                      | Legal acts listing, links to NN gazette                         |
| porezna-uprava | `https://porezna-uprava.gov.hr/hr/vijesti/8`  | same                              | 200    | HTML        | UNKNOWN (no robots.txt)               | NO           | YES                      | 2619 news items, paginated, filters available                   |
| hzmo           | `https://mirovinsko.hr/hr/vijesti/114`        | same                              | 200    | HTML        | UNKNOWN (404 robots.txt)              | NO           | YES                      | Paginated news with dates                                       |
| fina           | `https://fina.hr/novosti`                     | same                              | 200    | HTML        | YES                                   | NO           | YES                      | 117 pages, paginated                                            |
| fina           | `https://fina.hr/sitemap.xml`                 | `https://www.fina.hr/sitemap.xml` | 200    | XML         | YES (/media blocked)                  | NO           | YES                      | Sitemap index with 3 child sitemaps                             |
| hnb            | `https://hnb.hr/javnost-rada/priopcenja`      | same                              | 200    | HTML        | YES                                   | NO           | YES                      | Announcements page                                              |
| hok            | `https://www.hok.hr/novosti/novosti-iz-hok`   | same                              | 200    | HTML        | YES (fully open)                      | NO           | YES                      | 9 pages, paginated, dates visible                               |
| mfin           | `https://mfin.gov.hr/vijesti/8`               | same                              | 200    | HTML        | UNKNOWN (404 robots.txt)              | NO           | YES                      | 1888 news items, paginated                                      |
| mrosp          | `https://mrosp.gov.hr/vijesti/8`              | same                              | 200    | HTML        | UNKNOWN                               | NO           | YES                      | 1931 news items, paginated                                      |
| dzs            | `https://dzs.gov.hr/vijesti/8`                | same                              | 200    | HTML        | UNKNOWN (404 robots.txt)              | NO           | YES                      | 586 news items, paginated                                       |
| vlada          | `https://vlada.gov.hr/vijesti/8`              | same                              | 200    | HTML        | UNKNOWN                               | NO           | YES                      | Government news, paginated with filters                         |
| sabor          | `https://sabor.hr/hr/press/priopcenja`        | same                              | 200    | HTML        | UNKNOWN                               | NO           | YES                      | 9380 press releases, 188 pages                                  |
| esavjetovanja  | `https://esavjetovanja.gov.hr/ECon/Dashboard` | same                              | 200    | HTML        | UNKNOWN (404 robots.txt)              | PARTIAL      | YES                      | Public view of 38 open consultations, login required to comment |
| hanfa          | `https://hanfa.hr/vijesti/`                   | same                              | 200    | HTML        | UNKNOWN                               | NO           | YES                      | News with load-more pagination (20 items per load)              |
| azop           | `https://azop.hr/novosti/`                    | same                              | 200    | HTML        | YES                                   | NO           | YES                      | News page, sitemap at sitemap_index.xml                         |

### Failed/Broken Endpoints

| sourceSlug    | configuredUrl                                                                   | status    | error                           | action                                            |
| ------------- | ------------------------------------------------------------------------------- | --------- | ------------------------------- | ------------------------------------------------- |
| eur-lex       | `https://eur-lex.europa.eu/EN/display-rss.do?lang=HR&eurovoc=8471`              | 404       | Page not found                  | **REMOVE** - URL format incorrect                 |
| eur-lex       | `https://eur-lex.europa.eu/EN/display-rss.do?lang=HR&eurovoc=8464`              | 404       | Page not found                  | **REMOVE** - URL format incorrect                 |
| eur-lex       | `https://eur-lex.europa.eu/EN/display-rss.do?lang=HR&type_doc=DIR&type_doc=REG` | 404       | Page not found                  | **REMOVE** - URL format incorrect                 |
| eur-lex       | `https://eur-lex.europa.eu/EN/display-rss.do?lang=HR&eurovoc=1954`              | 404       | Page not found                  | **REMOVE** - URL format incorrect                 |
| zakon         | `https://zakon.hr/sitemap.xml`                                                  | 404       | No sitemap exists               | **DO NOT ADD** - secondary source without sitemap |
| hzz           | `https://hzz.hr/*`                                                              | SSL_ERROR | Certificate verification failed | **INVESTIGATE** - may need cert update            |
| esavjetovanja | `https://esavjetovanja.gov.hr/ECon/MainScreen`                                  | 500       | Server error                    | **USE /ECon/Dashboard** instead                   |

### Requires Headless Browser

| sourceSlug | url                          | issue                                 | action                                               |
| ---------- | ---------------------------- | ------------------------------------- | ---------------------------------------------------- |
| hgk        | `https://hgk.hr/*`           | JS-heavy, returns 500 on direct fetch | **REQUIRES HEADLESS** - implement Playwright fetcher |
| hgk        | `https://www.hgk.hr/vijesti` | 500 error                             | **REQUIRES HEADLESS**                                |

### Domain Corrections Required

| incorrect | correct      | action                       |
| --------- | ------------ | ---------------------------- |
| `dzs.hr`  | `dzs.gov.hr` | **UPDATE** seed-endpoints.ts |
| `hok.hr`  | `www.hok.hr` | **UPDATE** seed-endpoints.ts |

---

## VERIFIED_PROPOSED_NEW_ENDPOINTS

### Verified New Endpoints (Ready to Add)

| domain               | path                   | name                      | endpointType  | proposedPriority | proposedFrequency | status | robotsAllowed | authRequired | listingStrategyConfirmed | rationale                               |
| -------------------- | ---------------------- | ------------------------- | ------------- | ---------------- | ----------------- | ------ | ------------- | ------------ | ------------------------ | --------------------------------------- |
| sabor.hr             | `/hr/press/priopcenja` | Sabor - Priopćenja        | NEWS_LISTING  | HIGH             | DAILY             | 200    | UNKNOWN       | NO           | YES                      | 9380 press releases, parliamentary news |
| vlada.gov.hr         | `/vijesti/8`           | Vlada - Vijesti           | NEWS_LISTING  | CRITICAL         | EVERY_RUN         | 200    | UNKNOWN       | NO           | YES                      | Government news, regulatory context     |
| esavjetovanja.gov.hr | `/ECon/Dashboard`      | e-Savjetovanja - Otvorena | CONSULTATIONS | CRITICAL         | DAILY             | 200    | UNKNOWN       | PARTIAL      | YES                      | 38 active consultations, public view    |
| hanfa.hr             | `/vijesti/`            | HANFA - Vijesti           | NEWS_LISTING  | HIGH             | DAILY             | 200    | UNKNOWN       | NO           | YES                      | Financial services regulator news       |
| azop.hr              | `/novosti/`            | AZOP - Novosti            | NEWS_LISTING  | HIGH             | DAILY             | 200    | YES           | NO           | YES                      | Data protection authority news          |

### Cannot Verify - Need Alternative Approach

| domain            | issue                            | recommendation                                  |
| ----------------- | -------------------------------- | ----------------------------------------------- |
| hgk.hr            | JS-rendered, 500 on direct fetch | Implement headless browser fetcher (Playwright) |
| zakon.hr          | No sitemap, secondary source     | Use as reference only, don't add to discovery   |
| eur-lex.europa.eu | RSS URL format incorrect         | Research correct EUR-Lex data access API        |
| hzz.hr            | SSL certificate error            | Fix certificate chain or use alternative domain |

---

## MISSING_ENDPOINTS_TO_ADD

### Immediate Actions (Verified Working)

| #   | domain               | path                   | name                      | priority | strategy              | verified |
| --- | -------------------- | ---------------------- | ------------------------- | -------- | --------------------- | -------- |
| 1   | sabor.hr             | `/hr/press/priopcenja` | Sabor - Priopćenja        | HIGH     | PAGINATION            | YES      |
| 2   | vlada.gov.hr         | `/vijesti/8`           | Vlada - Vijesti           | CRITICAL | PAGINATION            | YES      |
| 3   | esavjetovanja.gov.hr | `/ECon/Dashboard`      | e-Savjetovanja - Otvorena | CRITICAL | HTML_LIST             | YES      |
| 4   | hanfa.hr             | `/vijesti/`            | HANFA - Vijesti           | HIGH     | HTML_LIST (load-more) | YES      |
| 5   | azop.hr              | `/novosti/`            | AZOP - Novosti            | HIGH     | HTML_LIST             | YES      |

### Seed Script Additions

```typescript
// ADD TO seed-endpoints.ts

// Sabor - Parliamentary press releases (VERIFIED)
{
  domain: "sabor.hr",
  path: "/hr/press/priopcenja",
  name: "Sabor - Priopćenja",
  endpointType: "NEWS_LISTING" as const,
  priority: "HIGH" as const,
  scrapeFrequency: "DAILY" as const,
  listingStrategy: "PAGINATION" as const,
  paginationPattern: "?page={N}",
  metadata: { domain: "zakonodavstvo", totalItems: 9380 },
},

// Vlada - Government news (VERIFIED)
{
  domain: "vlada.gov.hr",
  path: "/vijesti/8",
  name: "Vlada - Vijesti",
  endpointType: "NEWS_LISTING" as const,
  priority: "CRITICAL" as const,
  scrapeFrequency: "EVERY_RUN" as const,
  listingStrategy: "PAGINATION" as const,
  paginationPattern: "?page={N}",
  metadata: { domain: "vlada", focus: "government announcements" },
},

// e-Savjetovanja - Public consultations (VERIFIED)
{
  domain: "esavjetovanja.gov.hr",
  path: "/ECon/Dashboard",
  name: "e-Savjetovanja - Otvorena savjetovanja",
  endpointType: "CONSULTATIONS" as const,
  priority: "CRITICAL" as const,
  scrapeFrequency: "DAILY" as const,
  listingStrategy: "HTML_LIST" as const,
  metadata: {
    domain: "zakonodavstvo",
    authRequired: "partial", // public view, login to comment
    note: "Use /ECon/Dashboard NOT /ECon/MainScreen"
  },
},

// HANFA - Financial services regulator (VERIFIED)
{
  domain: "hanfa.hr",
  path: "/vijesti/",
  name: "HANFA - Vijesti",
  endpointType: "NEWS_LISTING" as const,
  priority: "HIGH" as const,
  scrapeFrequency: "DAILY" as const,
  listingStrategy: "HTML_LIST" as const,
  metadata: {
    domain: "financije",
    paginationType: "load-more",
    itemsPerPage: 20
  },
},

// AZOP - Data protection authority (VERIFIED)
{
  domain: "azop.hr",
  path: "/novosti/",
  name: "AZOP - Novosti",
  endpointType: "NEWS_LISTING" as const,
  priority: "HIGH" as const,
  scrapeFrequency: "DAILY" as const,
  listingStrategy: "HTML_LIST" as const,
  metadata: { domain: "gdpr", sitemap: "/sitemap_index.xml" },
},
```

---

## ENDPOINTS_TO_REMOVE_OR_FIX

### Must Remove (Broken)

| endpoint            | reason                     | action                                 |
| ------------------- | -------------------------- | -------------------------------------- |
| EUR-Lex RSS (all 4) | 404 - URL format incorrect | REMOVE from seed, research correct API |

### Must Fix (Wrong Domain)

| current        | correct            | action                             |
| -------------- | ------------------ | ---------------------------------- |
| `dzs.hr` paths | `dzs.gov.hr` paths | UPDATE domain in seed-endpoints.ts |
| `hok.hr` paths | `www.hok.hr` paths | UPDATE domain in seed-endpoints.ts |

### Fix in Seed Script

```typescript
// CHANGE FROM:
{ domain: "dzs.hr", path: "/hr/novosti", ... }
// CHANGE TO:
{ domain: "dzs.gov.hr", path: "/vijesti/8", ... }

// CHANGE FROM:
{ domain: "hok.hr", path: "/novosti/novosti-iz-hok", ... }
// CHANGE TO:
{ domain: "www.hok.hr", path: "/novosti/novosti-iz-hok", ... }
```

---

## HIGH_RISK_MISSES

### Critical Coverage Gaps

| #   | area                     | source             | impact                                        | recommendation                           |
| --- | ------------------------ | ------------------ | --------------------------------------------- | ---------------------------------------- |
| 1   | **Legal Truth**          | Sabor (Parliament) | Missing 9380 press releases on legislation    | **ADD IMMEDIATELY** - verified working   |
| 2   | **Government Policy**    | Vlada (Government) | Missing official government announcements     | **ADD IMMEDIATELY** - verified working   |
| 3   | **Public Consultations** | e-Savjetovanja     | Missing 30-day feedback windows on new laws   | **ADD IMMEDIATELY** - verified working   |
| 4   | **Financial Regulation** | HANFA              | Missing financial services regulatory updates | **ADD** - verified working               |
| 5   | **Data Protection**      | AZOP               | Missing GDPR/privacy regulation updates       | **ADD** - verified working               |
| 6   | **Business Regulations** | HGK                | Chamber of Commerce - cannot verify (JS)      | **INVESTIGATE** - needs headless browser |
| 7   | **EU Law**               | EUR-Lex            | RSS feeds broken - wrong URL format           | **RESEARCH** - find correct API          |

### Risk Assessment

| risk                        | severity | mitigation                                                                           |
| --------------------------- | -------- | ------------------------------------------------------------------------------------ |
| EUR-Lex endpoints broken    | HIGH     | All 4 configured RSS feeds return 404. Research correct data access API.             |
| HGK.hr inaccessible         | HIGH     | JS-heavy site returns 500. Implement Playwright-based fetcher.                       |
| HZZ.hr SSL error            | MEDIUM   | Employment agency site has cert issues. May affect contribution data.                |
| e-Savjetovanja partial auth | LOW      | Public view works, participation requires e-Građani login. Sufficient for discovery. |

---

## BACKLOG_NEXT_STEPS_VERIFIED

### Phase 1: Fix Broken Endpoints (Week 1)

| ID     | Title                               | Acceptance Criteria                                                                                              | Dependencies   | Owner    |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- | -------- |
| EP-001 | Remove broken EUR-Lex RSS endpoints | 4 endpoints removed from seed-endpoints.ts, no 404 errors in sentinel logs                                       | None           | Sentinel |
| EP-002 | Fix dzs.hr domain to dzs.gov.hr     | Endpoint domain corrected, verified 200 response                                                                 | None           | Sentinel |
| EP-003 | Fix hok.hr domain to www.hok.hr     | Endpoint domain corrected, verified 200 response                                                                 | None           | Sentinel |
| EP-004 | Run seed-endpoints.ts after fixes   | All endpoints updated in DB, `npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts` completes successfully | EP-001,002,003 | Infra    |

### Phase 2: Add Verified New Endpoints (Week 1-2)

| ID     | Title                                 | Acceptance Criteria                                                 | Dependencies | Owner    |
| ------ | ------------------------------------- | ------------------------------------------------------------------- | ------------ | -------- |
| EP-005 | Add Sabor priopcenja endpoint         | Endpoint in DB, sentinel discovers press releases, 200 response     | EP-004       | Sentinel |
| EP-006 | Add Vlada vijesti endpoint            | Endpoint in DB, sentinel discovers government news, 200 response    | EP-004       | Sentinel |
| EP-007 | Add e-Savjetovanja dashboard endpoint | Endpoint in DB, sentinel discovers open consultations, 200 response | EP-004       | Sentinel |
| EP-008 | Add HANFA vijesti endpoint            | Endpoint in DB, sentinel discovers financial news, 200 response     | EP-004       | Sentinel |
| EP-009 | Add AZOP novosti endpoint             | Endpoint in DB, sentinel discovers GDPR news, 200 response          | EP-004       | Sentinel |

### Phase 3: Implement Missing Capabilities (Week 2-3)

| ID     | Title                                           | Acceptance Criteria                                                     | Dependencies | Owner    |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------- | ------------ | -------- |
| EP-010 | Implement Playwright-based fetcher for JS sites | New fetcher class that can render JS, tested on hgk.hr                  | None         | Infra    |
| EP-011 | Add HGK endpoints using headless fetcher        | HGK news discovered via Playwright fetcher                              | EP-010       | Sentinel |
| EP-012 | Research EUR-Lex data access options            | Documentation of correct API/RSS URLs, or determination that none exist | None         | Sentinel |
| EP-013 | Investigate HZZ.hr SSL issue                    | Root cause identified, fix implemented or documented as blocked         | None         | Infra    |

### Phase 4: Reliability & Monitoring (Week 3-4)

| ID     | Title                                 | Acceptance Criteria                                               | Dependencies | Owner    |
| ------ | ------------------------------------- | ----------------------------------------------------------------- | ------------ | -------- |
| EP-014 | Add endpoint health dashboard         | Admin UI shows status, last success, error count per endpoint     | EP-001-009   | Admin UI |
| EP-015 | Add selector health verification      | Automated test confirms HTML selectors still work for each domain | EP-001-009   | Sentinel |
| EP-016 | Add alerting for consecutive failures | Slack/email alert when endpoint fails 3+ times consecutively      | EP-014       | Infra    |

---

## Verification Commands

```bash
# Verify endpoint is reachable and returns expected content type
curl -sI "https://sabor.hr/hr/press/priopcenja" | head -20

# Check robots.txt
curl -s "https://sabor.hr/robots.txt"

# Run seed script after updates
npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts

# Check sentinel health for specific domain
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT domain, name, \"consecutiveErrors\", \"lastScrapedAt\"
   FROM \"DiscoveryEndpoint\"
   WHERE domain LIKE '%sabor%';"

# Verify new endpoints added
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT domain, path, name, priority
   FROM \"DiscoveryEndpoint\"
   WHERE \"createdAt\" > NOW() - INTERVAL '1 hour';"
```

---

## Appendix: Robots.txt Summary

| Domain                | Status | Key Rules                                                           |
| --------------------- | ------ | ------------------------------------------------------------------- |
| narodne-novine.nn.hr  | EXISTS | /clanci/oglasi/ blocked, no sitemap ref                             |
| hzzo.hr               | EXISTS | Drupal standard, admin paths blocked                                |
| fina.hr               | EXISTS | /media blocked, sitemap at /sitemap.xml                             |
| hnb.hr                | EXISTS | ?targetExtension blocked, sitemap localhost ref (bug)               |
| hgk.hr                | EXISTS | Fully permissive (empty Disallow)                                   |
| azop.hr               | EXISTS | /wp-content/uploads/wpforms/ blocked, sitemap at /sitemap_index.xml |
| porezna-uprava.gov.hr | 404    | No robots.txt                                                       |
| mirovinsko.hr         | 404    | No robots.txt                                                       |
| mfin.gov.hr           | 404    | No robots.txt                                                       |
| dzs.gov.hr            | 404    | No robots.txt                                                       |
| esavjetovanja.gov.hr  | 404    | No robots.txt                                                       |
| savjetovanja.gov.hr   | 404    | No robots.txt                                                       |

---

**End of Verified Audit Report**
