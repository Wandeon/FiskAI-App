# Extraction Content Filtering Analysis

> **Date:** 2026-01-07
> **Status:** Analysis Complete - Awaiting Expert Review
> **Issue:** Non-regulatory content consuming LLM API quota

---

## Executive Summary

The extraction pipeline is processing **non-regulatory content** (job postings, press releases) through the expensive LLM extraction step, wasting API tokens. Of 2,187 discovered items, only **62 (2.8%)** are from regulatory sources (Tax Authority). The rest are HR announcements, parliamentary press releases, and health insurance administrative notices.

---

## Problem Statement

### Observed Behavior
1. Extractor calls Ollama Cloud (Gemini 3 Flash) for every Evidence record
2. Most extractions return **0% coverage** (no regulatory facts found)
3. JSON parse errors occurring (LLM returns raw text instead of structured output)
4. API quota being consumed on content that has zero regulatory value

### Impact
- **Wasted API calls:** ~12 calls per 5 minutes on non-regulatory content
- **Cost:** Each call ~15-35 seconds of Gemini processing time
- **No value:** 0 SourcePointers created from this content

---

## Data Analysis

### Evidence Inventory

| Content Class | Total | Has Text | Has Pointers | Status |
|--------------|-------|----------|--------------|--------|
| PDF_TEXT | 57 | 57 | 57 | ✅ Fully extracted |
| PDF_SCANNED | 55 | 55 | 0 | ❌ All job postings |
| HTML | 43 | 0 | 0 | Awaiting processing |
| XLSX | 12 | 0 | 0 | Awaiting processing |
| DOC | 2 | 0 | 0 | Awaiting processing |

### Discovered Items by Category

| Category | Items | % of Total | Regulatory Value |
|----------|-------|------------|------------------|
| HZZO (health insurance) | 1,304 | 59.6% | ❌ Mostly admin/HR |
| Parliament press | 477 | 21.8% | ❌ Press releases |
| HR/Job postings | 239 | 10.9% | ❌ Zero value |
| Other | 105 | 4.8% | ⚠️ Mixed |
| Tax authority | 62 | 2.8% | ✅ High value |

### Successfully Extracted Domains (2,177 SourcePointers)

| Domain | Pointers | Content Type |
|--------|----------|--------------|
| rokovi | 1,139 | Compliance deadlines |
| obrasci | 605 | Tax forms |
| fiskalizacija | 198 | Fiscalization rules |
| doprinosi | 99 | Contribution rates |
| pdv | 52 | VAT regulations |
| porez_dohodak | 40 | Income tax |
| legal-metadata | 17 | Legal references |
| exchange-rate | 13 | HNB exchange rates |

---

## Root Cause Analysis

### Why Non-Regulatory Content Enters Pipeline

1. **Sentinel Discovery is URL-based:** The sentinel crawls configured source URLs (hzzo.hr, sabor.hr, porezna-uprava.gov.hr) and discovers ALL linked documents, not just regulatory ones.

2. **No Content Classification at Discovery:** When a PDF is found, it's marked as "FETCHED" without analyzing whether it's regulatory or administrative.

3. **Drainer Queues Everything:** The continuous-drainer queues ALL fetched Evidence for extraction, regardless of content type.

4. **Extractor Has No Pre-filter:** The extractor sends everything to the LLM, which then returns 0% coverage for non-regulatory content.

### Content Patterns Identified

**Non-Regulatory (Should Skip):**
```
- "OBAVIJEST O REZULTATIMA JAVNOG NATJEČAJA ZA PRIJAM U RADNI ODNOS"
- "OBAVIJEST O OBUSTAVI POSTUPKA DIJELA JAVNOG NATJEČAJA"
- "priopćenja/predsjednik-" (parliamentary press releases)
- Job vacancy announcements
- Business sale notices
```

**Regulatory (Should Extract):**
```
- Tax rate tables and deadlines
- Contribution rates and thresholds
- VAT regulations and exemptions
- Fiscalization requirements
- Legal compliance deadlines
- Official exchange rates
```

---

## Pipeline Architecture (Current)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sentinel  │────▶│  Drainer    │────▶│  Extractor  │────▶│  Composer   │
│  (Discovery)│     │  (Queue)    │     │  (LLM)      │     │  (Rules)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Discovers          Queues ALL          Calls LLM for
   ALL URLs           Evidence            EVERYTHING
   from sources       for extraction      (wasteful!)
```

---

## Proposed Solutions

### Option A: Pre-Extraction Content Classifier (Recommended)

Add a lightweight classification step before LLM extraction:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sentinel  │────▶│ Classifier  │────▶│  Extractor  │────▶│  Composer   │
│  (Discovery)│     │ (Fast/Local)│     │  (LLM)      │     │  (Rules)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                    Skip non-regulatory
                    content (regex/keywords)
```

**Implementation:**
```typescript
// In continuous-drainer.worker.ts or new classifier worker
function isRegulatoryContent(textContent: string): boolean {
  const NON_REGULATORY_PATTERNS = [
    /OBAVIJEST O REZULTATIMA.*NATJEČAJA/i,
    /OBAVIJEST O OBUSTAVI POSTUPKA/i,
    /JAVNOG NATJEČAJA ZA PRIJAM U RADNI ODNOS/i,
    /priopćenje za medije/i,
    /press release/i,
    /natječaj za radno mjesto/i,
  ];

  return !NON_REGULATORY_PATTERNS.some(pattern => pattern.test(textContent));
}
```

**Pros:**
- Fast (regex, no API calls)
- Can run locally
- Easy to extend patterns

**Cons:**
- May miss edge cases
- Needs pattern maintenance

---

### Option B: URL-Based Filtering at Discovery

Filter URLs before fetching based on path patterns:

```typescript
// In sentinel or drainer
const SKIP_URL_PATTERNS = [
  /natjecaj.*radni-odnos/i,
  /rezultati.*natjecaja/i,
  /obavijest.*obustavi/i,
  /press\/priopcenja/i,  // Parliamentary press releases
];

function shouldFetch(url: string): boolean {
  return !SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
}
```

**Pros:**
- Prevents fetching entirely (saves bandwidth)
- Very fast

**Cons:**
- URL doesn't always indicate content
- May block valid regulatory URLs

---

### Option C: Two-Stage Extraction

Use a cheap/fast model for classification, expensive model only for extraction:

```
Stage 1: Local Ollama (llama3.1:8b) - "Is this regulatory content? yes/no"
Stage 2: Gemini 3 Flash (cloud) - Full extraction (only if Stage 1 = yes)
```

**Pros:**
- More accurate than regex
- Local model is free

**Cons:**
- Still uses some compute
- Adds latency

---

### Option D: Domain/Source Whitelisting

Only process content from known regulatory sources:

```typescript
const REGULATORY_SOURCES = [
  'porezna-uprava.gov.hr',
  'narodne-novine.nn.hr',
  'fina.hr/propisi',
  'mfin.gov.hr',
];

// Skip HZZO job postings, Sabor press releases
const SKIP_SOURCES = [
  'hzzo.hr/sites/default/files/*/Obavij*',
  'sabor.hr/press/priopcenja',
];
```

**Pros:**
- Simple to implement
- High precision

**Cons:**
- May miss new regulatory sources
- Requires manual curation

---

## Recommendation

**Implement Option A (Pre-Extraction Classifier) with Option D (Source Whitelisting) as a fallback.**

### Immediate Actions (Quick Win):
1. Add URL pattern filter in `drainFetchedEvidence()` to skip obvious non-regulatory URLs
2. Add content keyword filter before queueing extraction

### Medium-Term:
1. Build a proper content classifier using the patterns above
2. Create a "SKIP" status for Evidence that's been classified as non-regulatory
3. Add metrics to track classification accuracy

### Long-Term:
1. Train a small local classifier on labeled examples
2. Use embedding similarity to known regulatory content
3. Build feedback loop from 0% coverage extractions

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Extraction calls with 0% coverage | ~80% | <10% |
| API calls per regulatory SourcePointer | Unknown | <5 |
| Non-regulatory content blocked | 0% | >90% |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | Add content/URL filtering in `drainFetchedEvidence()` |
| `src/lib/regulatory-truth/utils/content-classifier.ts` | New file: Regulatory content classifier |
| `src/lib/regulatory-truth/workers/extractor.worker.ts` | Optional: Add pre-check before LLM call |

---

## Appendix: Sample Non-Regulatory Content (Should Skip)

```
[Stranica 1]
OBAVIJEST O REZULTATIMA JAVNOG NATJEČAJA
ZA PRIJAM U RADNI ODNOS
(objavljen u Narodnim novinama br. 16 od 31. siječnja 2025. godine...)

[Stranica 1]
OBAVIJEST O OBUSTAVI POSTUPKA DIJELA
JAVNOG NATJEČAJA ZA PRIJAM U RADNI ODNOS
(objavljen u Narodnim novinama br. 89 od 13. lipnja 2025. godine...)

[Stranica 1]
Hrvatski zavod za zdravstveno osiguranje, Margaretska 3, Zagreb,
na temelju Odluke o pokretanju postupka prodaje poslovnog udjela...
```

## Appendix: Sample Regulatory Content (Should Extract)

```
Rokovi za predaju godišnje prijave poreza na dohodak:
- Fizičke osobe: 28. veljače 2025.
- Obrtnici: 31. ožujka 2025.

Stopa PDV-a:
- Opća stopa: 25%
- Snižena stopa: 13% (hrana, lijekovi)
- Super-snižena: 5% (knjige, novine)

Doprinosi za obvezna osiguranja 2025:
- MIO I. stup: 15%
- MIO II. stup: 5%
- Zdravstveno: 16.5%
```
