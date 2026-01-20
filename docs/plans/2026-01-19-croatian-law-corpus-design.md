# Croatian Business Law Corpus Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete Croatian law corpus from Narodne Novine to answer ALL business/accounting/tax questions.

**Architecture:** Systematic retrieval of base laws + amendments from NN, automated consolidation into current valid text, evidence-backed rule extraction.

**Tech Stack:** BullMQ workers, Prisma, Ollama LLM, PostgreSQL with pgvector for embeddings.

---

## Part 1: Complete Law Inventory

### 1.1 TIER 0: Core Tax Laws (Highest Priority)

| Law Name                                                           | NN Base   | Latest Amendments                                                                                                | Status   |
| ------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| **Opći porezni zakon** (General Tax Act)                           | NN 115/16 | 98/19, 32/20, 42/20, 114/22, 151/22, 155/23, 152/24                                                              | Active   |
| **Zakon o porezu na dobit** (Corporate Income Tax)                 | NN 177/04 | 90/05, 57/06, 146/08, 80/10, 22/12, 148/13, 143/14, 50/16, 115/16, 106/18, 121/19, 32/20, 138/20, 114/22, 114/23 | Active   |
| **Zakon o porezu na dohodak** (Personal Income Tax)                | NN 115/16 | 106/18, 121/19, 32/20, 138/20, 151/22, 114/23, 152/24                                                            | Active   |
| **Zakon o porezu na dodanu vrijednost** (VAT)                      | NN 73/13  | 99/13, 148/13, 153/13, 143/14, 115/16, 106/18, 121/19, 138/20, 39/22, 113/22, 33/23, 114/23                      | Active   |
| **Zakon o doprinosima** (Contributions)                            | NN 84/08  | 152/08, 94/09, 18/11, 22/12, 144/12, 148/13, 41/14, 143/14, 115/16, 106/18, 33/23, 114/23, 152/24                | Active   |
| **Zakon o lokalnim porezima** (Local Taxes)                        | NN 115/16 | 101/17, 114/22, 114/23, 152/24                                                                                   | Active   |
| **Zakon o trošarinama** (Excise Duties)                            | NN 106/18 | 121/19, 144/21                                                                                                   | Active   |
| **Zakon o porezu na promet nekretnina** (Real Estate Transfer Tax) | NN 115/16 | 106/18                                                                                                           | Active   |
| **Zakon o minimalnom globalnom porezu na dobit** (Pillar Two)      | NN 155/23 | -                                                                                                                | NEW 2024 |
| **Zakon o dodatnom porezu na dobit** (Windfall Tax)                | NN 151/22 | -                                                                                                                | Active   |

### 1.2 TIER 1: Business Organization Laws

| Law Name                                         | NN Base   | Latest Amendments                                                                                                                             | Status |
| ------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Zakon o trgovačkim društvima** (Companies Act) | NN 111/93 | 34/99, 121/99, 52/00, 118/03, 107/07, 146/08, 137/09, 125/11, 152/11 (pročišćeni), 111/12, 68/13, 110/15, 40/19, 34/22, 114/22, 18/23, 136/24 | Active |
| **Zakon o sudskom registru** (Court Registry)    | NN 1/95   | 57/96, 1/98, 30/99, 45/99, 54/05, 40/07, 91/10, 90/11, 148/13, 93/14, 110/15, 40/19, 34/22, 123/23                                            | Active |
| **Zakon o obrtu** (Crafts Act)                   | NN 143/13 | 127/19, 41/20                                                                                                                                 | Active |
| **Zakon o udrugama** (Associations Act)          | NN 74/14  | 70/17, 98/19                                                                                                                                  | Active |
| **Zakon o zadrugama** (Cooperatives Act)         | NN 34/11  | 125/13, 76/14                                                                                                                                 | Active |

### 1.3 TIER 1: Accounting & Financial Reporting

| Law Name                                                                     | NN Base   | Latest Amendments                                                               | Status |
| ---------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- | ------ |
| **Zakon o računovodstvu** (Accounting Act)                                   | NN 78/15  | 134/15, 120/16, 116/18, 42/20, 47/20, 114/22, 82/23, 85/24 (pročišćeni), 145/24 | Active |
| **Zakon o reviziji** (Audit Act)                                             | NN 127/17 | 116/18                                                                          | Active |
| **Zakon o financijskom poslovanju i računovodstvu neprofitnih organizacija** | NN 121/14 | 114/22                                                                          | Active |
| **Zakon o financijskom poslovanju i predstečajnoj nagodbi**                  | NN 108/12 | 144/12, 81/13, 112/13, 78/15, 71/15, 104/17                                     | Active |

### 1.4 TIER 1: Labor & Social Security

| Law Name                                                        | NN Base   | Latest Amendments                                                         | Status |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- | ------ |
| **Zakon o radu** (Labor Act)                                    | NN 93/14  | 127/17, 98/19, 151/22, 64/23                                              | Active |
| **Zakon o mirovinskom osiguranju** (Pension Insurance)          | NN 157/13 | 151/14, 33/15, 93/15, 120/16, 18/18, 62/18, 115/18, 102/19, 84/21, 119/22 | Active |
| **Zakon o obveznom zdravstvenom osiguranju** (Health Insurance) | NN 80/13  | 137/13, 98/19, 33/23, 105/25                                              | Active |
| **Zakon o zaštiti na radu** (Occupational Safety)               | NN 71/14  | 118/14, 94/18, 96/18                                                      | Active |
| **Zakon o tržištu rada** (Labor Market Act)                     | NN 118/18 | 32/20, 18/22, 156/22, 152/24                                              | Active |

### 1.5 TIER 2: Civil & Commercial Law

| Law Name                                             | NN Base   | Latest Amendments                                           | Status |
| ---------------------------------------------------- | --------- | ----------------------------------------------------------- | ------ |
| **Zakon o obveznim odnosima** (Obligations Act)      | NN 35/05  | 41/08, 125/11, 78/15, 29/18, 126/21, 114/22, 156/22, 155/23 | Active |
| **Ovršni zakon** (Enforcement Act)                   | NN 112/12 | 25/13, 93/14, 55/16, 73/17, 131/20, 114/22                  | Active |
| **Stečajni zakon** (Bankruptcy Act)                  | NN 71/15  | 104/17                                                      | Active |
| **Zakon o stečaju potrošača** (Consumer Bankruptcy)  | NN 100/15 | 67/18, 36/22                                                | Active |
| **Zakon o zakupu i kupoprodaji poslovnoga prostora** | NN 125/11 | 64/15, 112/18, 123/24                                       | Active |

### 1.6 TIER 2: Compliance & Regulatory

| Law Name                                                             | NN Base   | Latest Amendments                      | Status   |
| -------------------------------------------------------------------- | --------- | -------------------------------------- | -------- |
| **Zakon o sprječavanju pranja novca i financiranja terorizma** (AML) | NN 108/17 | 39/19, 151/22                          | Active   |
| **Zakon o fiskalizaciji u prometu gotovinom** (Fiscalization)        | NN 133/12 | 115/16, 106/18, 121/19, 138/20, 114/23 | Active   |
| **Zakon o fiskalizaciji** (NEW - 2025)                               | NN 89/25  | -                                      | NEW 2025 |
| **Zakon o zaštiti potrošača** (Consumer Protection)                  | NN 41/14  | 110/15, 14/19                          | Active   |
| **Zakon o elektroničkoj trgovini** (E-Commerce)                      | NN 173/03 | 67/08, 36/09, 130/11, 30/14, 32/19     | Active   |
| **Zakon o Poreznoj upravi** (Tax Administration)                     | NN 115/16 | 98/19, 155/23, 152/24                  | Active   |

### 1.7 TIER 2: Investment & Incentives

| Law Name                                                 | NN Base   | Latest Amendments           | Status |
| -------------------------------------------------------- | --------- | --------------------------- | ------ |
| **Zakon o poticanju ulaganja** (Investment Incentives)   | NN 63/22  | 136/24                      | Active |
| **Zakon o poticanju investicija** (Investment Promotion) | NN 102/15 | 25/18, 114/18, 32/20, 20/21 | Legacy |

### 1.8 TIER 3: Specialized/Sectoral

| Law Name                                             | NN Base  | Latest Amendments                                               | Status |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------- | ------ |
| **Zakon o trgovini** (Trade Act)                     | NN 87/08 | 96/08, 116/08, 76/09, 114/11, 68/13, 30/14, 32/19, 98/19, 32/20 | Active |
| **Zakon o ugostiteljskoj djelatnosti** (Hospitality) | NN 85/15 | 121/16, 99/18, 25/19, 98/19, 32/20, 42/20, 126/21               | Active |
| **Zakon o turističkoj djelatnosti** (Tourism)        | NN 8/96  | many...                                                         | Active |
| **Zakon o deviznom poslovanju** (Foreign Exchange)   | NN 96/03 | 140/05, 132/06, 150/08, 92/09, 133/09, 153/09, 145/10, 76/13    | Active |
| **Zakon o platnom prometu** (Payment Services)       | NN 66/18 | 114/22, 136/24                                                  | Active |

---

## Part 2: Retrieval Strategy

### 2.1 NN URL Patterns

```
# Individual law article
https://narodne-novine.nn.hr/clanci/sluzbeni/{YEAR}_{MONTH}_{ISSUE}_{ARTICLE}.html

# PDF version
https://narodne-novine.nn.hr/eli/sluzbeni/{YEAR}/{ISSUE}/pdf

# Search API
https://narodne-novine.nn.hr/search.aspx?upit={QUERY}&kategorija=1&sortiraj=1
```

### 2.2 Amendment Chain Resolution

For each law:

1. Start with **base law** (e.g., NN 115/16)
2. Fetch **all amendments** in chronological order
3. Apply amendments to produce **consolidated text**
4. Track **effective dates** for temporal queries

### 2.3 ELI (European Legislation Identifier) Support

Croatia uses ELI format: `/eli/sluzbeni/{year}/{issue}/{article}`

Example: `https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505`

---

## Part 3: Consolidation Engine

### 3.1 Amendment Types

| Type              | Croatian          | Pattern                                      |
| ----------------- | ----------------- | -------------------------------------------- |
| Add article       | dodaje se članak  | "Iza članka X dodaje se članak Y"            |
| Replace article   | mijenja se članak | "Članak X mijenja se i glasi"                |
| Delete article    | briše se članak   | "Članak X briše se"                          |
| Replace paragraph | stavak se mijenja | "U članku X stavak Y mijenja se"             |
| Add paragraph     | dodaje se stavak  | "U članku X iza stavka Y dodaje se stavak Z" |

### 3.2 Consolidation Algorithm

```typescript
interface LawVersion {
  baseNn: string // e.g., "NN 115/16"
  amendments: Amendment[] // chronological list
  effectiveDate: Date
  consolidatedText: string
}

interface Amendment {
  nn: string // e.g., "NN 152/24"
  effectiveDate: Date
  operations: Operation[]
}

interface Operation {
  type: "add" | "replace" | "delete"
  target: "article" | "paragraph" | "point"
  articleNum: string
  paragraphNum?: string
  newText?: string
}
```

### 3.3 Database Schema Extension

```prisma
model Law {
  id              String   @id @default(cuid())
  slug            String   @unique  // e.g., "zakon-o-porezu-na-dobit"
  nameHr          String
  nameEn          String?
  tier            Int      // 0, 1, 2, 3
  category        String   // tax, labor, corporate, etc.
  baseNn          String   // e.g., "NN 177/04"
  currentNn       String   // Latest consolidated reference
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  sourceUrl       String

  versions        LawVersion[]
  articles        LawArticle[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model LawVersion {
  id              String   @id @default(cuid())
  lawId           String
  law             Law      @relation(fields: [lawId], references: [id])
  nnReference     String   // e.g., "NN 152/24"
  versionType     String   // 'base', 'amendment', 'consolidated'
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  rawContent      String   @db.Text
  consolidatedContent String? @db.Text
  sourceUrl       String

  createdAt       DateTime @default(now())
}

model LawArticle {
  id              String   @id @default(cuid())
  lawId           String
  law             Law      @relation(fields: [lawId], references: [id])
  articleNumber   String   // e.g., "12.", "12.a"
  title           String?
  content         String   @db.Text
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  amendedBy       String?  // NN reference that amended this

  embedding       Float[]? @db.Vector(768)

  @@unique([lawId, articleNumber, effectiveFrom])
}
```

---

## Part 4: Implementation Plan

### Task 1: Law Registry Setup

**Files:**

- Create: `src/lib/regulatory-truth/laws/law-registry.ts`
- Create: `prisma/migrations/xxx_add_law_tables.sql`

**Steps:**

1. Write migration for Law, LawVersion, LawArticle tables
2. Create law registry with all 50+ laws from inventory
3. Seed initial data with base NN references
4. Add category and tier fields for prioritization

**Commit:** "feat(laws): add law registry schema and seed data"

---

### Task 2: NN Scraper Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/nn-scraper.worker.ts`
- Create: `src/lib/regulatory-truth/services/nn-fetcher.ts`

**Steps:**

1. Build NN URL parser (supports /clanci/ and /eli/ formats)
2. Create HTML parser for law content extraction
3. Handle PDF fallback for documents without HTML
4. Add rate limiting (1 req/2s to be respectful)
5. Queue all laws from registry for initial fetch

**Commit:** "feat(scraper): add Narodne Novine law fetcher"

---

### Task 3: Amendment Chain Resolver

**Files:**

- Create: `src/lib/regulatory-truth/services/amendment-resolver.ts`
- Create: `src/lib/regulatory-truth/utils/amendment-parser.ts`

**Steps:**

1. Parse amendment text patterns (Croatian legal language)
2. Build operation list from amendment text
3. Apply operations to base text to produce consolidated version
4. Track effective dates for each version
5. Handle complex cases (renumbering, splitting articles)

**Commit:** "feat(consolidation): add amendment chain resolver"

---

### Task 4: Article Extractor

**Files:**

- Create: `src/lib/regulatory-truth/services/article-extractor.ts`

**Steps:**

1. Parse law text into individual articles
2. Handle nested structure (paragraphs, points, sub-points)
3. Extract article metadata (number, title, effective dates)
4. Generate embeddings for semantic search
5. Link articles to law versions

**Commit:** "feat(extraction): add law article extractor and embeddings"

---

### Task 5: Law API Endpoints

**Files:**

- Create: `src/lib/regulatory-truth/api/law-routes.ts`

**Steps:**

1. GET /laws - list all laws with filters
2. GET /laws/:slug - get law with current consolidated text
3. GET /laws/:slug/articles - get all articles
4. GET /laws/:slug/versions - get amendment history
5. GET /laws/:slug/article/:num - get specific article with history

**Commit:** "feat(api): add law query endpoints"

---

### Task 6: Integration with RTL Pipeline

**Files:**

- Modify: `src/lib/regulatory-truth/workers/extractor.worker.ts`
- Modify: `src/lib/regulatory-truth/agents/extractor.ts`

**Steps:**

1. Update extractor to reference law articles as evidence
2. Create SourcePointers that link to specific articles
3. Add law context to extraction prompts
4. Enable cross-referencing between laws

**Commit:** "feat(pipeline): integrate law corpus with RTL extraction"

---

### Task 7: Initial Corpus Load

**Files:**

- Create: `scripts/load-law-corpus.ts`

**Steps:**

1. Load all Tier 0 laws (10 core tax laws)
2. Load all Tier 1 laws (business, accounting, labor)
3. Build consolidated versions
4. Generate embeddings
5. Validate completeness

**Commit:** "feat(corpus): initial load of 30 core Croatian laws"

---

## Part 5: Success Metrics

| Metric                     | Target |
| -------------------------- | ------ |
| Laws indexed               | 50+    |
| Articles indexed           | 5,000+ |
| Consolidation accuracy     | 99%+   |
| Query response time        | <500ms |
| Coverage of user questions | 95%+   |

---

## Part 6: Priority Order

| Phase | Laws                           | Impact                  |
| ----- | ------------------------------ | ----------------------- |
| 1     | Tax laws (Tier 0)              | Covers 60% of questions |
| 2     | Business + Accounting (Tier 1) | Covers 25% more         |
| 3     | Labor + Social (Tier 1)        | Covers 10% more         |
| 4     | Specialized (Tier 2-3)         | Edge cases              |

---

## Appendix: Question Coverage Analysis

**Common business questions and which laws answer them:**

| Question Type             | Primary Laws                                           | Secondary Laws                 |
| ------------------------- | ------------------------------------------------------ | ------------------------------ |
| "Koliko poreza plaćam?"   | Zakon o porezu na dobit, Zakon o porezu na dohodak     | Opći porezni zakon             |
| "Kako osnovati d.o.o.?"   | Zakon o trgovačkim društvima, Zakon o sudskom registru | -                              |
| "PDV stope?"              | Zakon o PDV-u                                          | Pravilnik o PDV-u              |
| "Plaće i doprinosi?"      | Zakon o doprinosima, Zakon o radu                      | Zakon o mirovinskom osiguranju |
| "Fiskalizacija?"          | Zakon o fiskalizaciji                                  | Pravilnik o fiskalizaciji      |
| "Računovodstvene obveze?" | Zakon o računovodstvu                                  | Zakon o reviziji               |
| "Ugovori s klijentima?"   | Zakon o obveznim odnosima                              | Zakon o zaštiti potrošača      |
| "Otpuštanje radnika?"     | Zakon o radu                                           | Zakon o zaštiti na radu        |
| "Stečaj?"                 | Stečajni zakon                                         | Zakon o financ. poslovanju     |
| "AML compliance?"         | Zakon o sprječavanju pranja novca                      | -                              |
