# Regulatory Discovery Endpoint Audit

> **Generated:** 2026-01-05
> **Auditor:** Discovery & Evidence Sentinel Auditor
> **Scope:** Croatian regulatory sources for RTL evidence pipeline

---

## PART A: CURRENT_CONFIG_ENDPOINTS

### Summary Statistics

| Metric                              | Count |
| ----------------------------------- | ----- |
| Configured DiscoveryEndpoints       | 56    |
| Configured RegulatorySource records | 67    |
| Unique domains with endpoints       | 11    |
| CRITICAL priority endpoints         | 17    |
| HIGH priority endpoints             | 21    |
| MEDIUM priority endpoints           | 14    |
| LOW priority endpoints              | 4     |

### Configured Endpoints by Domain

| Domain                    | Path                                                                                         | Name                                        | Type           | Priority | Frequency    | Strategy    |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------- | -------- | ------------ | ----------- |
| **narodne-novine.nn.hr**  | `/sitemap.xml`                                                                               | Narodne novine - Main Sitemap               | SITEMAP_INDEX  | CRITICAL | EVERY_RUN    | SITEMAP_XML |
| **hzzo.hr**               | `/novosti`                                                                                   | HZZO - Novosti                              | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **hzzo.hr**               | `/pravni-akti`                                                                               | HZZO - Pravni akti                          | LEGAL_ACTS     | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **hzzo.hr**               | `/e-zdravstveno/novosti`                                                                     | HZZO - e-Zdravstveno novosti                | NEWS_LISTING   | HIGH     | DAILY        | HTML_LIST   |
| **hzzo.hr**               | `/poslovni-subjekti/hzzo-za-partnere/sifrarnici-hzzo-0`                                      | HZZO - Sifrarnici                           | CODE_LISTS     | HIGH     | DAILY        | HTML_LIST   |
| **hzzo.hr**               | `/zdravstvena-zastita/objavljene-liste-lijekova`                                             | HZZO - Liste lijekova                       | TECHNICAL_DOCS | HIGH     | DAILY        | HTML_LIST   |
| **hzzo.hr**               | `/natjecaji`                                                                                 | HZZO - Natjecaji                            | ANNOUNCEMENTS  | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hzzo.hr**               | `/o-nama/upravno-vijece/odluke-uv`                                                           | HZZO - Odluke upravnog vijeca               | LEGAL_ACTS     | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hzzo.hr**               | `/pravo-na-pristup-informacijama/savjetovanje-s-javnoscu-o-nacrtima-zakona-i-drugih-propisa` | HZZO - Savjetovanja s javnoscu              | CONSULTATIONS  | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hzzo.hr**               | `/lijecnicki-pregledi/uputnice-i-potvrde`                                                    | HZZO - Uputnice i potvrde                   | TECHNICAL_DOCS | LOW      | WEEKLY       | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/vijesti/114`                                                                            | HZMO - Vijesti                              | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **mirovinsko.hr**         | `/hr/priopcenja-204/204`                                                                     | HZMO - Priopcenja                           | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **mirovinsko.hr**         | `/hr/propisi/54`                                                                             | HZMO - Propisi                              | LEGAL_ACTS     | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/doplatak-za-djecu/12`                                                                   | HZMO - Doplatak za djecu                    | LEGAL_ACTS     | HIGH     | DAILY        | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/statistika/860`                                                                         | HZMO - Statistika                           | STATISTICS     | HIGH     | DAILY        | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/tiskanice-1098/1098`                                                                    | HZMO - Tiskanice                            | FORMS          | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/prijave-i-odjave-na-osiguranje/234`                                                     | HZMO - Prijave i odjave                     | LEGAL_ACTS     | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **mirovinsko.hr**         | `/hr/misljenja-ministarstva/56`                                                              | HZMO - Misljenja ministarstva               | LEGAL_ACTS     | LOW      | WEEKLY       | HTML_LIST   |
| **porezna-uprava.gov.hr** | `/HR_o_nama/Stranice/mapa-weba.aspx`                                                         | Porezna Uprava - Sitemap/Web Map            | SITEMAP_INDEX  | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **porezna-uprava.gov.hr** | `/hr/vijesti/8`                                                                              | Porezna - Vijesti                           | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **porezna-uprava.gov.hr** | `/hr/misljenja-su/3951`                                                                      | Porezna - Misljenja SU                      | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **porezna-uprava.gov.hr** | `/hr/propisi-3950/3950`                                                                      | Porezna - Propisi                           | LEGAL_ACTS     | HIGH     | DAILY        | HTML_LIST   |
| **porezna-uprava.gov.hr** | `/hr/pitanja-i-odgovori-vezani-uz-zakon-o-fiskalizaciji-8031/8031`                           | Porezna - Fiskalizacija FAQ                 | ANNOUNCEMENTS  | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **porezna-uprava.gov.hr** | `/hr/propisani-obrasci/3955`                                                                 | Porezna - Propisani obrasci                 | FORMS          | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **porezna-uprava.gov.hr** | `/hr/porezni-sustav/3954`                                                                    | Porezna - Porezni sustav                    | TECHNICAL_DOCS | LOW      | WEEKLY       | HTML_LIST   |
| **fina.hr**               | `/obavijesti/fina-e-racun`                                                                   | FINA - e-Racun obavijesti                   | ANNOUNCEMENTS  | CRITICAL | EVERY_RUN    | PAGINATION  |
| **fina.hr**               | `/novosti`                                                                                   | FINA - Novosti                              | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **fina.hr**               | `/obavijesti/e-racun-u-javnoj-nabavi`                                                        | FINA - e-Racun javna nabava                 | ANNOUNCEMENTS  | HIGH     | DAILY        | PAGINATION  |
| **fina.hr**               | `/obavijesti/digitalni-certifikati`                                                          | FINA - Digitalni certifikati                | ANNOUNCEMENTS  | HIGH     | DAILY        | PAGINATION  |
| **fina.hr**               | `/digitalizacija-poslovanja/e-racun`                                                         | FINA - e-Racun info                         | TECHNICAL_DOCS | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **fina.hr**               | `/poslovne-informacije/bon`                                                                  | FINA - BON informacije                      | TECHNICAL_DOCS | LOW      | WEEKLY       | HTML_LIST   |
| **mfin.gov.hr**           | `/vijesti/8`                                                                                 | Ministarstvo financija - Vijesti            | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **mfin.gov.hr**           | `/istaknute-teme/zakoni-i-propisi/523`                                                       | Ministarstvo financija - Zakoni i propisi   | LEGAL_ACTS     | HIGH     | DAILY        | HTML_LIST   |
| **mfin.gov.hr**           | `/istaknute-teme/javne-konzultacije/524`                                                     | Ministarstvo financija - Javne konzultacije | CONSULTATIONS  | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **mrosp.gov.hr**          | `/vijesti/8`                                                                                 | MRMS - Vijesti                              | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **hnb.hr**                | `/javnost-rada/priopcenja`                                                                   | HNB - Priopcenja                            | NEWS_LISTING   | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **hnb.hr**                | `/statistika/statisticka-priopcenja`                                                         | HNB - Statisticka priopcenja                | STATISTICS     | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **hnb.hr**                | `/devizni-tecajevi/referentni-tecajevi-esb-a`                                                | HNB - Devizni tecajevi                      | STATISTICS     | CRITICAL | EVERY_RUN    | HTML_LIST   |
| **hnb.hr**                | `/redovne-publikacije/bilten`                                                                | HNB - Bilten                                | TECHNICAL_DOCS | HIGH     | DAILY        | HTML_LIST   |
| **hnb.hr**                | `/redovne-publikacije/financijska-stabilnost`                                                | HNB - Izvjesce o financijskoj stabilnosti   | TECHNICAL_DOCS | HIGH     | DAILY        | HTML_LIST   |
| **hnb.hr**                | `/statistika/kalendar-objava`                                                                | HNB - Kalendar objava                       | ANNOUNCEMENTS  | HIGH     | DAILY        | HTML_LIST   |
| **hnb.hr**                | `/javnost-rada/novosti`                                                                      | HNB - Novosti                               | NEWS_LISTING   | HIGH     | DAILY        | HTML_LIST   |
| **hnb.hr**                | `/redovne-publikacije/bilten-o-bankama`                                                      | HNB - Bilten o bankama                      | TECHNICAL_DOCS | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hnb.hr**                | `/platni-sustav`                                                                             | HNB - Platni sustav                         | TECHNICAL_DOCS | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hnb.hr**                | `/bankarski-sustav/propisi`                                                                  | HNB - Bankarski propisi                     | LEGAL_ACTS     | MEDIUM   | TWICE_WEEKLY | HTML_LIST   |
| **hnb.hr**                | `/redovne-publikacije/godisnje-izvjesce`                                                     | HNB - Godisnje izvjesce                     | TECHNICAL_DOCS | LOW      | WEEKLY       | HTML_LIST   |
| **dzs.hr**                | `/hr/novosti`                                                                                | DZS - Novosti                               | NEWS_LISTING   | HIGH     | DAILY        | HTML_LIST   |
| **dzs.hr**                | `/hr/publikacije`                                                                            | DZS - Publikacije i statisticki podaci      | STATISTICS     | HIGH     | DAILY        | HTML_LIST   |
| **hok.hr**                | `/novosti/novosti-iz-hok`                                                                    | HOK - Novosti iz HOK-a                      | NEWS_LISTING   | CRITICAL | EVERY_RUN    | PAGINATION  |
| **hok.hr**                | `/aktualno`                                                                                  | HOK - Aktualno                              | ANNOUNCEMENTS  | HIGH     | DAILY        | HTML_LIST   |
| **hok.hr**                | `/medunarodna-suradnja-i-eu/novosti-i-dogadanja`                                             | HOK - Novosti i dogadanja                   | NEWS_LISTING   | HIGH     | DAILY        | HTML_LIST   |
| **eur-lex.europa.eu**     | `/EN/display-rss.do?lang=HR&eurovoc=8471`                                                    | EUR-Lex - VAT & Taxation (HR)               | LEGAL_ACTS     | HIGH     | DAILY        | RSS_FEED    |
| **eur-lex.europa.eu**     | `/EN/display-rss.do?lang=HR&eurovoc=8464`                                                    | EUR-Lex - Invoicing & E-invoicing (HR)      | LEGAL_ACTS     | HIGH     | DAILY        | RSS_FEED    |
| **eur-lex.europa.eu**     | `/EN/display-rss.do?lang=HR&type_doc=DIR&type_doc=REG`                                       | EUR-Lex - Croatian EU Law Updates           | LEGAL_ACTS     | MEDIUM   | DAILY        | RSS_FEED    |
| **eur-lex.europa.eu**     | `/EN/display-rss.do?lang=HR&eurovoc=1954`                                                    | EUR-Lex - Social Security (HR)              | LEGAL_ACTS     | MEDIUM   | TWICE_WEEKLY | RSS_FEED    |

### Listing Strategy Distribution

| Strategy    | Count | Use Case                            |
| ----------- | ----- | ----------------------------------- |
| HTML_LIST   | 35    | General news/announcements pages    |
| PAGINATION  | 14    | Paginated news listings             |
| RSS_FEED    | 4     | EUR-Lex RSS feeds                   |
| SITEMAP_XML | 2     | Narodne novine sitemap              |
| CRAWL       | 0     | Site-wide crawling (not configured) |

---

## PART B: CODE_PATHS_AND_ENTRYPOINTS

### Discovery System Architecture

```
src/lib/regulatory-truth/
├── agents/
│   ├── sentinel.ts           # Main discovery agent (1547 lines)
│   ├── sitemap-scanner.ts    # Sitemap-specific scanner
│   └── site-crawler.ts       # Recursive site crawler
├── parsers/
│   ├── sitemap-parser.ts     # XML sitemap parsing
│   ├── rss-parser.ts         # RSS/Atom feed parsing
│   └── html-list-parser.ts   # HTML news list parsing
├── scripts/
│   ├── seed-endpoints.ts     # Endpoint configuration (657 lines)
│   ├── run-sentinel.ts       # CLI runner
│   └── baseline-backfill.ts  # Historical backfill
├── data/
│   └── sources.ts            # RegulatorySource definitions (67 sources)
└── utils/
    ├── rate-limiter.ts       # Per-domain rate limiting
    ├── adaptive-sentinel.ts  # Velocity-based scan scheduling
    └── content-hash.ts       # Change detection
```

### Key Entry Points

| Entry Point              | File                      | Purpose                 |
| ------------------------ | ------------------------- | ----------------------- |
| `runSentinel()`          | `agents/sentinel.ts:845`  | Main discovery cycle    |
| `fetchDiscoveredItems()` | `agents/sentinel.ts:1385` | Fetch pending items     |
| `runAdaptiveSentinel()`  | `agents/sentinel.ts:1492` | Velocity-based re-scan  |
| `processEndpoint()`      | `agents/sentinel.ts:532`  | Process single endpoint |

### Parser Functions

| Function                 | File                              | Input           | Output           |
| ------------------------ | --------------------------------- | --------------- | ---------------- |
| `parseSitemap()`         | `parsers/sitemap-parser.ts:24`    | XML string      | `SitemapEntry[]` |
| `parseRSSFeed()`         | `parsers/rss-parser.ts:112`       | RSS/Atom string | `RSSItem[]`      |
| `parseHtmlList()`        | `parsers/html-list-parser.ts:55`  | HTML string     | `ListItem[]`     |
| `extractDocumentLinks()` | `parsers/html-list-parser.ts:125` | HTML string     | `ListItem[]`     |

### Database Models

| Model               | Database             | Purpose                |
| ------------------- | -------------------- | ---------------------- |
| `DiscoveryEndpoint` | Core (`db`)          | Endpoint configuration |
| `DiscoveredItem`    | Core (`db`)          | URL tracking & status  |
| `RegulatorySource`  | Regulatory (`dbReg`) | Source metadata        |
| `Evidence`          | Regulatory (`dbReg`) | Fetched content        |

---

## PART C: PROPOSED_ENDPOINTS_BY_SOURCE

### Source Coverage Analysis

| #   | Source                     | Domain                | Configured Endpoints | Key Missing Surfaces     |
| --- | -------------------------- | --------------------- | -------------------- | ------------------------ |
| 1   | **Narodne novine**         | narodne-novine.nn.hr  | 1 (sitemap)          | RSS feed, search API     |
| 2   | **Porezna uprava**         | porezna-uprava.gov.hr | 6                    | e-Porezna portal, API    |
| 3   | **HZZO**                   | hzzo.hr               | 10                   | RSS feed, API            |
| 4   | **HZMO**                   | mirovinsko.hr         | 8                    | RSS feed                 |
| 5   | **HOK**                    | hok.hr                | 3                    | Obrazovni programi       |
| 6   | **HGK**                    | hgk.hr                | 0                    | **NOT CONFIGURED**       |
| 7   | **DZS**                    | dzs.hr                | 2                    | Statistical releases     |
| 8   | **FINA**                   | fina.hr               | 6                    | API documentation        |
| 9   | **HNB**                    | hnb.hr                | 11                   | RSS feed, API            |
| 10  | **MRMS**                   | mrosp.gov.hr          | 1                    | Legal acts, forms        |
| 11  | **EUR-Lex**                | eur-lex.europa.eu     | 4                    | Additional eurovoc codes |
| 12  | **e-Savjetovanja**         | savjetovanja.gov.hr   | 0                    | **NOT CONFIGURED**       |
| 13  | **Ministarstvo financija** | mfin.gov.hr           | 3                    | Budget documents         |

### Proposed New Endpoints

#### CRITICAL Priority (Should be added immediately)

| Domain                  | Path                    | Name                      | Strategy    | Rationale                                  |
| ----------------------- | ----------------------- | ------------------------- | ----------- | ------------------------------------------ |
| **hgk.hr**              | `/novosti`              | HGK - Novosti             | PAGINATION  | Chamber of Commerce - business regulations |
| **hgk.hr**              | `/vijesti`              | HGK - Vijesti             | HTML_LIST   | Official announcements                     |
| **hgk.hr**              | `/propisi`              | HGK - Propisi             | HTML_LIST   | Legal framework                            |
| **savjetovanja.gov.hr** | `/Savjetovanje/Pregled` | e-Savjetovanja - Otvorena | HTML_LIST   | Active public consultations                |
| **savjetovanja.gov.hr** | `/Savjetovanje/Arhiva`  | e-Savjetovanja - Arhiva   | HTML_LIST   | Closed consultations                       |
| **zakon.hr**            | `/sitemap.xml`          | Zakon.hr - Sitemap        | SITEMAP_XML | Consolidated legislation                   |

#### HIGH Priority (Should be added within 30 days)

| Domain                   | Path                         | Name              | Strategy  | Rationale                    |
| ------------------------ | ---------------------------- | ----------------- | --------- | ---------------------------- |
| **narodne-novine.nn.hr** | `/rss/feed`                  | NN - RSS Feed     | RSS_FEED  | Faster change detection      |
| **mrosp.gov.hr**         | `/propisi/pravilnici`        | MRMS - Pravilnici | HTML_LIST | Employment regulations       |
| **mrosp.gov.hr**         | `/obrasci`                   | MRMS - Obrasci    | HTML_LIST | Employment forms             |
| **dzs.hr**               | `/hr/kalendar-objavljivanja` | DZS - Kalendar    | HTML_LIST | Release schedule             |
| **azop.hr**              | `/novosti`                   | AZOP - Novosti    | HTML_LIST | Data protection authority    |
| **hanfa.hr**             | `/publikacije/novosti`       | HANFA - Novosti   | HTML_LIST | Financial services regulator |

#### MEDIUM Priority (Should be added within 90 days)

| Domain                | Path                                     | Name                  | Strategy  | Rationale            |
| --------------------- | ---------------------------------------- | --------------------- | --------- | -------------------- |
| **hakom.hr**          | `/novosti`                               | HAKOM - Novosti       | HTML_LIST | Telecom regulator    |
| **hera.hr**           | `/novosti`                               | HERA - Novosti        | HTML_LIST | Energy regulator     |
| **arkod.hr**          | `/obavijesti`                            | ARKOD - Obavijesti    | HTML_LIST | Agriculture registry |
| **sudovi.hr**         | `/RSS/Novosti`                           | Sudovi - RSS          | RSS_FEED  | Court announcements  |
| **eur-lex.europa.eu** | `/EN/display-rss.do?lang=HR&eurovoc=560` | EUR-Lex - Company Law | RSS_FEED  | Company regulations  |
| **eur-lex.europa.eu** | `/EN/display-rss.do?lang=HR&eurovoc=889` | EUR-Lex - Employment  | RSS_FEED  | Employment law       |

---

## PART D: GAPS_AND_RISKS

### Critical Gaps

| Gap ID  | Source         | Gap Description             | Impact                                                             | Risk Level   |
| ------- | -------------- | --------------------------- | ------------------------------------------------------------------ | ------------ |
| GAP-001 | HGK            | **No endpoints configured** | Missing Chamber of Commerce regulations affecting 100k+ businesses | **CRITICAL** |
| GAP-002 | e-Savjetovanja | **No endpoints configured** | Missing public consultations - 30-day feedback windows             | **CRITICAL** |
| GAP-003 | Zakon.hr       | **No endpoints configured** | Missing consolidated legislation text                              | **HIGH**     |
| GAP-004 | AZOP           | **No endpoints configured** | Missing GDPR/data protection updates                               | **HIGH**     |
| GAP-005 | HANFA          | **No endpoints configured** | Missing financial services regulations                             | **HIGH**     |

### Coverage Risks

| Risk ID  | Area             | Description                                 | Mitigation                     |
| -------- | ---------------- | ------------------------------------------- | ------------------------------ |
| RISK-001 | PDF Detection    | Scanned PDFs may fail OCR silently          | Add OCR health monitoring      |
| RISK-002 | Rate Limiting    | No per-source circuit breaker visualization | Add admin dashboard            |
| RISK-003 | NN Volume        | Sitemap has 10k+ entries per issue          | Already handled by depth limit |
| RISK-004 | HZZO Changes     | Site redesign may break HTML selectors      | Add selector health checks     |
| RISK-005 | RSS Availability | EUR-Lex RSS may change endpoints            | Monitor feed availability      |

### Selector Fragility Assessment

| Domain                | Selector Risk | Last Verified | Notes                                  |
| --------------------- | ------------- | ------------- | -------------------------------------- |
| hzzo.hr               | MEDIUM        | Never         | Multiple selector fallbacks configured |
| mirovinsko.hr         | MEDIUM        | Never         | Uses Drupal views-row pattern          |
| porezna-uprava.gov.hr | HIGH          | Never         | SharePoint/custom CMS                  |
| fina.hr               | LOW           | Never         | Standard patterns                      |
| hnb.hr                | LOW           | Never         | Clean HTML structure                   |
| hok.hr                | MEDIUM        | Never         | Pagination pattern untested            |

### Missing Monitoring

| Area                      | Status          | Recommendation                                  |
| ------------------------- | --------------- | ----------------------------------------------- |
| Endpoint health dashboard | NOT IMPLEMENTED | Create admin UI showing endpoint status         |
| Failed fetch alerting     | NOT IMPLEMENTED | Add Slack/email alerts for consecutive failures |
| Content change velocity   | IMPLEMENTED     | Already tracked via `changeFrequency` field     |
| OCR queue depth           | PARTIAL         | Queue exists but no monitoring UI               |

---

## PART E: BACKLOG_NEXT_STEPS

### Immediate Actions (This Week)

1. **Add HGK endpoints** - Create 3 endpoints for hgk.hr (novosti, vijesti, propisi)
2. **Add e-Savjetovanja endpoints** - Create 2 endpoints for savjetovanja.gov.hr
3. **Add zakon.hr endpoint** - Create sitemap endpoint for consolidated laws
4. **Verify all CRITICAL endpoints** - Run manual test on each to confirm working

### Short-Term (Next 30 Days)

5. **Add AZOP endpoint** - Data protection authority news
6. **Add HANFA endpoint** - Financial services regulator
7. **Add MRMS additional endpoints** - Pravilnici and obrasci
8. **Create selector verification script** - Automated check that selectors still work
9. **Add NN RSS endpoint** - Faster change detection than sitemap

### Medium-Term (Next 90 Days)

10. **Add remaining regulators** - HAKOM, HERA, ARKOD
11. **Add sudovi.hr RSS** - Court announcements
12. **Add additional EUR-Lex feeds** - Company law, employment
13. **Build endpoint health dashboard** - Admin UI for monitoring
14. **Implement selector auto-recovery** - Fallback selector chains

### Seed Script Update Required

```typescript
// Add to seed-endpoints.ts - HGK (GAP-001)
{
  domain: "hgk.hr",
  path: "/novosti",
  name: "HGK - Novosti",
  endpointType: "NEWS_LISTING" as const,
  priority: "CRITICAL" as const,
  scrapeFrequency: "EVERY_RUN" as const,
  listingStrategy: "PAGINATION" as const,
  metadata: { domain: "obrt", focus: "business regulations" },
},

// Add to seed-endpoints.ts - e-Savjetovanja (GAP-002)
{
  domain: "savjetovanja.gov.hr",
  path: "/Savjetovanje/Pregled",
  name: "e-Savjetovanja - Otvorena savjetovanja",
  endpointType: "CONSULTATIONS" as const,
  priority: "CRITICAL" as const,
  scrapeFrequency: "DAILY" as const,
  listingStrategy: "HTML_LIST" as const,
  metadata: { domain: "zakonodavstvo", focus: "active public consultations" },
},
```

---

## Verification Commands

```bash
# Check configured endpoints count
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT COUNT(*) FROM \"DiscoveryEndpoint\" WHERE \"isActive\" = true;"

# Check endpoints by domain
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT domain, COUNT(*) as count FROM \"DiscoveryEndpoint\" GROUP BY domain ORDER BY count DESC;"

# Check endpoint health (errors in last 24h)
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT domain, name, \"consecutiveErrors\", \"lastError\"
   FROM \"DiscoveryEndpoint\"
   WHERE \"consecutiveErrors\" > 0
   ORDER BY \"consecutiveErrors\" DESC;"

# Run seed script
npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts
```

---

## Appendix: RegulatorySource Inventory (data/sources.ts)

The system has 67 RegulatorySource records across 24 priority groups:

| Priority Group | Sources                                        |
| -------------- | ---------------------------------------------- |
| 1              | ustav-rh                                       |
| 2              | zakon-o-racunovodstvu, zakon-o-fiskalizaciji   |
| 3              | narodne-novine, opci-porezni-zakon             |
| 4              | zakoni-poslovni                                |
| 5              | hzzo-pravila, hzmo-propisi                     |
| 6              | porezna-uprava-misljenja, porezna-uprava-upute |
| 7              | hzzo-upute, hzmo-upute                         |
| ...            | (remaining 60 sources)                         |

Each source maps to 0-11 discovery endpoints based on the publishing surfaces available.

---

**End of Audit Report**
