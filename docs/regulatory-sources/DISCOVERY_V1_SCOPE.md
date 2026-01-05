# Discovery v1 Scope Declaration

> **Frozen:** 2026-01-05
> **Tag:** `discovery-v1-locked`

## Coverage Statement

Discovery v1 provides automated detection and ingestion of regulatory updates from Croatian government sources. For included sources, updates are detected and evidence is created **within 24 hours** of publication.

**Key architectural property:** Evidence creation is independent of embedding success. Embedding failures do not block evidence ingestion.

---

## LOCKED Sources (Production SLA)

These sources are fully operational with worker-driven discovery and evidence creation:

| Source                 | Domain                | Priority | Evidence Rate |
| ---------------------- | --------------------- | -------- | ------------- |
| Narodne novine         | narodne-novine.nn.hr  | CRITICAL | 100%          |
| Porezna uprava         | porezna-uprava.gov.hr | CRITICAL | 100%          |
| Ministarstvo financija | mfin.gov.hr           | CRITICAL | 100%          |
| HZMO                   | mirovinsko.hr         | CRITICAL | 100%          |
| HZZO                   | hzzo.hr               | CRITICAL | 100%          |
| FINA                   | fina.hr               | CRITICAL | 100%          |
| Vlada RH               | vlada.gov.hr          | CRITICAL | 100%          |
| HANFA                  | hanfa.hr              | HIGH     | 100%          |
| Sabor                  | sabor.hr              | HIGH     | Unblocked\*   |

\*Sabor: 476 items discovered, evidence creation working but queue-limited by older items from other sources. Not a correctness issue.

---

## EXCLUDED Sources (Known Reasons)

### HNB (hnb.hr)

**Status:** Requires custom parser
**Reason:** Uses Liferay CMS with non-standard DOM structure. Standard HTML selectors don't match. RSS feeds return empty content ("No any content - implement method").
**Endpoints:** 6 broken 404 endpoints disabled; 5 active endpoints remain non-functional pending parser work.

### HGK (hgk.hr)

**Status:** Requires anti-bot handling
**Reason:** Bot detection returns non-content responses. Needs headless browser or API access.

### EUR-Lex

**Status:** Requires separate ingestion lane
**Reason:** Different API structure, EU-level content. Not part of Croatian government source scope.

---

## Technical Notes

### Evidence vs Embeddings

- Evidence records (rawContent, contentHash) are created immediately on fetch
- Embeddings are queued separately and may fail (e.g., Ollama 401)
- Evidence is valid and usable without embeddings
- This decoupling prevents total ingestion outages

### Discovery Flow

1. Sentinel scans endpoints based on priority and scrape frequency
2. New URLs discovered via site-specific parsers
3. Content fetched and Evidence created (immutable)
4. Embedding queued (optional enrichment)
5. Content bridge triggers alerts if changes detected

### Endpoint Configuration

- Site-specific CSS selectors in `src/lib/regulatory-truth/parsers/html-list-parser.ts`
- Endpoint definitions in database (`DiscoveryEndpoint` table)
- Priority levels: CRITICAL, HIGH, MEDIUM, LOW

---

## Verification

To verify discovery is operational:

```bash
# Check evidence counts by source
docker exec fiskai-db psql -U fiskai -d fiskai -c "
SELECT
  CASE
    WHEN url LIKE '%nn.hr%' THEN 'Narodne novine'
    WHEN url LIKE '%porezna%' THEN 'Porezna uprava'
    WHEN url LIKE '%mfin%' THEN 'Ministarstvo financija'
    WHEN url LIKE '%mirovinsko%' THEN 'HZMO'
    WHEN url LIKE '%hzzo%' THEN 'HZZO'
    WHEN url LIKE '%fina%' THEN 'FINA'
    WHEN url LIKE '%vlada%' THEN 'Vlada'
    WHEN url LIKE '%hanfa%' THEN 'HANFA'
    WHEN url LIKE '%sabor%' THEN 'Sabor'
    ELSE 'Other'
  END as source,
  COUNT(*) as evidence_count
FROM \"Evidence\"
GROUP BY 1
ORDER BY evidence_count DESC;
"

# Run sentinel manually
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts CRITICAL
```

---

## Change Log

- **2026-01-05:** Initial v1 freeze
  - Decoupled evidence from embeddings
  - Fixed vlada.gov.hr and hanfa.hr link extraction
  - Disabled broken HNB 404 endpoints
  - Declared HNB, HGK, EUR-Lex as excluded
