# NN Mirror v1 Specification

> **Status**: Draft for Review
> **Author**: Claude + Human collaboration
> **Date**: 2026-01-21
> **Implements**: National Gazette Data Lake with Canonical Layer

## 1. Goals and Non-Goals

### Goals

1. **Immutable raw mirror** - Store every NN gazette item exactly as fetched, with full audit trail
2. **Canonical parsed layer** - Deterministic, versioned parse into provision trees with stable nodePaths
3. **Instrument linking** - Connect gazette items to legal instruments with confidence tracking
4. **Audit-grade provenance** - Every derived fact traceable to exact offsets in source
5. **Safe reprocessing** - Reparse everything without losing provenance

### Non-Goals (Deferred)

1. **Consolidated snapshots** - "Law as of date X" comes later as derived cache
2. **Amendment application** - Patch logic for insert/replace/delete deferred
3. **Full-text search** - Product index layer comes after canonical layer is stable
4. **Smart browsing UI** - Build after data model is proven

### Success Criteria

| Metric                          | Target                           |
| ------------------------------- | -------------------------------- |
| Fetch success rate              | >99%                             |
| Parse success rate              | >95%                             |
| Node coverage (non-overlapping) | >90% of cleanText                |
| Critical nodePath stability     | 100% for CLANAK, >95% for STAVAK |
| Anchor integrity                | >99%                             |
| Instrument link coverage        | >80% HIGH/MEDIUM confidence      |

---

## 2. Data Model

### 2.1 Enums

```prisma
enum ParseStatus {
  PENDING
  RUNNING
  SUCCESS
  PARTIAL
  FAILED
}

enum ProvisionNodeType {
  DOC           // Root document node
  TITLE         // Naslov (section heading)
  CHAPTER       // Glava
  PART          // Dio
  CLANAK        // Članak (article)
  STAVAK        // Stavak (paragraph)
  TOCKA         // Točka (point)
  PODTOCKA      // Podtočka (subpoint)
  ALINEJA       // Alineja (bullet)
  PRILOG        // Prilog (annex)
  TABLE         // Tablica
  LIST          // Unstructured list
}

enum OffsetUnit {
  UTF16         // JavaScript/Java string indices (default)
  UTF8          // Byte offsets
  CODEPOINT     // Unicode code points
}

enum ArtifactKind {
  HTML_RAW
  HTML_CLEANED
  PDF_TEXT
  OCR_TEXT
  OCR_HOCR
  TABLE_JSON
  PDF_LAYOUT_JSON   // Reserved: blocks with bounding boxes
  TABLE_EXTRACTED   // Reserved: structured table extraction
  ANNEX_SPLIT       // Reserved: split annexes
}

enum InstrumentEventType {
  ORIGINAL          // Izvorni tekst
  AMENDMENT         // Izmjene i dopune
  CONSOLIDATED      // Pročišćeni tekst
  CORRECTION        // Ispravak
  DECISION          // Odluka
  INTERPRETATION    // Autentično tumačenje
  REPEAL            // Prestanak važenja
  UNKNOWN
}

enum InstrumentLinkMethod {
  ELI               // Matched via ELI URI
  TITLE_FUZZY       // Fuzzy title match
  CANONICAL_KEY     // NN canonical key match
  MANUAL            // Human curation
}

enum InstrumentLinkConfidence {
  HIGH              // ELI match or manual confirmation
  MEDIUM            // Strong title match
  LOW               // Weak match, needs review
}

enum ResolutionFailReason {
  NO_ELI
  LOW_SCORE
  AMBIGUOUS
  MULTI_MATCH
  MISSING_METADATA
  PARSE_FAILED
}
```

### 2.2 Evidence (Raw Mirror Layer)

```prisma
model Evidence {
  id                  String    @id @default(cuid())
  sourceId            String

  // Stable identity (survives URL format changes)
  sourceKey           String?   // "nn:item:2024:152:2505" or ELI

  // Fetch metadata
  url                 String
  fetchedAt           DateTime  @default(now())
  contentHash         String    // SHA256 of rawContent
  rawContent          String    @db.Text
  contentType         String    @default("html")
  contentClass        String    @default("HTML")

  // HTTP metadata
  httpStatus          Int?
  httpHeaders         Json?
  finalUrl            String?   // After redirects

  // Staleness tracking
  stalenessStatus     String    @default("FRESH")
  lastVerifiedAt      DateTime?
  consecutiveFailures Int       @default(0)

  // Relations
  source              RegulatorySource @relation(...)
  artifacts           EvidenceArtifact[]
  parsedDocuments     ParsedDocument[]
  instrumentLinks     InstrumentEvidenceLink[]
  resolutionAttempts  InstrumentResolutionAttempt[]

  // NO unique constraint on [sourceKey, contentHash]
  // Idempotency enforced in fetcher code via NNEnqueuedJob

  @@index([sourceKey])
  @@index([sourceId])
  @@index([contentHash])
  @@index([fetchedAt])
  @@index([stalenessStatus])
}
```

**Idempotency rule**: Fetcher checks `NNEnqueuedJob` for duplicate prevention, then compares `contentHash` against latest Evidence for same `sourceKey`. Skip create if unchanged.

### 2.3 EvidenceArtifact (Derived Text Layers)

```prisma
model EvidenceArtifact {
  id            String       @id @default(cuid())
  evidenceId    String
  kind          ArtifactKind
  content       String       @db.Text
  contentHash   String       // SHA256 of content
  pageMap       Json?        // Per-page metadata for PDFs
  createdAt     DateTime     @default(now())

  evidence      Evidence     @relation(...)

  @@index([evidenceId, kind])
  @@index([createdAt])
}
```

### 2.4 ParsedDocument (Canonical Parse Record)

```prisma
model ParsedDocument {
  id                  String      @id @default(cuid())
  evidenceId          String

  // Parser identity (full tuple for safe reparsing)
  parserId            String      // "nn-parser"
  parserVersion       String      // Git SHA or semver
  parseConfigHash     String      // SHA256 of config JSON

  status              ParseStatus @default(PENDING)
  errorMessage        String?

  // Warnings for PARTIAL status
  warnings            Json?       // [{ code, message, nodePath?, offsets? }]
  unparsedSegments    Json?       // [{ startOffset, endOffset, reason }]

  // Document metadata extracted during parse
  docMeta             Json?       // { eli, nnYear, nnIssue, nnItem, title, textType, publishedAt, effectiveFrom }

  // Clean text artifact reference
  cleanTextArtifactId String?
  cleanTextLength     Int?
  cleanTextHash       String?     // SHA256 for drift detection
  offsetUnit          OffsetUnit  @default(UTF16)

  // Tree stats
  nodeCount           Int         @default(0)
  maxDepth            Int         @default(0)
  statsByType         Json?       // { CLANAK: 15, STAVAK: 48, ... }

  // Coverage (non-overlapping content nodes)
  coverageChars       Int?        // Characters covered by content nodes
  coveragePercent     Float?      // coverageChars / cleanTextLength

  // Deterministic rebuild comparison
  treeHash            String?     // Hash of ordered (nodePath, startOffset, endOffset)

  // Versioning
  isLatest            Boolean     @default(true)
  supersedesId        String?
  supersededById      String?
  driftDetectedAt     DateTime?

  // Timestamps
  createdAt           DateTime    @default(now())
  parseDurationMs     Int?

  // Relations
  evidence            Evidence    @relation(...)
  cleanTextArtifact   EvidenceArtifact? @relation(...)
  nodes               ProvisionNode[]
  supersedes          ParsedDocument? @relation("ParseSupersession", ...)
  supersededBy        ParsedDocument? @relation("ParseSupersession")

  @@unique([evidenceId, parserId, parserVersion, parseConfigHash])
  @@index([evidenceId])
  @@index([evidenceId, parserId, isLatest])
  @@index([parserId, status, createdAt])
  @@index([status])
}
```

### 2.5 ProvisionNode (Parsed Tree)

```prisma
model ProvisionNode {
  id                String            @id @default(cuid())
  parsedDocumentId  String
  parentId          String?

  // Structure
  nodeType          ProvisionNodeType
  nodePath          String            // /članak:28/stavak:1/točka:a
  label             String?           // "Članak 28.", "(1)", "a)"
  orderIndex        Int               // Sibling order (0-based)
  depth             Int               // Tree depth (0 = root)

  // Content - rawText is OPTIONAL (derive from offsets when needed)
  // Store only for leaf content nodes or debugging
  rawText           String?           @db.Text
  normalizedText    String?           @db.Text  // For search

  // Offsets into cleanText (unit defined by ParsedDocument.offsetUnit)
  startOffset       Int
  endOffset         Int

  // Derived flag
  isContainer       Boolean           @default(false)  // DOC, TITLE, CHAPTER, PART

  // Optional HTML anchor for re-linking
  htmlSelector      String?

  // Relations
  parsedDocument    ParsedDocument    @relation(...)
  parent            ProvisionNode?    @relation("NodeTree", ...)
  children          ProvisionNode[]   @relation("NodeTree")

  @@unique([parsedDocumentId, nodePath])
  @@index([parsedDocumentId, parentId, orderIndex])
  @@index([parsedDocumentId, nodeType])
  @@index([parsedDocumentId, startOffset])
}
```

**rawText storage rule**:

- Store rawText only for non-container leaf nodes (CLANAK content, STAVAK content, etc.)
- Container nodes (DOC, TITLE, CHAPTER, PART) have rawText = null
- rawText can always be derived: `cleanText.substring(startOffset, endOffset)`

### 2.6 Instrument (Legal Instrument Identity)

```prisma
model Instrument {
  id              String    @id @default(cuid())
  canonicalId     String    @unique  // Deterministic dedup key
  eliUri          String?   @unique
  nnCanonicalKey  String?            // "zakon-o-pdv-u" fallback
  title           String
  shortTitle      String?

  status          String    @default("TRACKING")  // TRACKING, BASELINED, ARCHIVED

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  evidenceLinks   InstrumentEvidenceLink[]
  coverage        InstrumentCoverage?

  @@index([nnCanonicalKey])
}
```

### 2.7 InstrumentEvidenceLink (Timeline Join)

```prisma
model InstrumentEvidenceLink {
  id              String                    @id @default(cuid())
  instrumentId    String
  evidenceId      String

  // Resolution metadata
  method          InstrumentLinkMethod
  confidence      InstrumentLinkConfidence
  matchedBy       String?                   // "resolver-v1.2.3", userId
  matchMeta       Json?                     // { score, eliCandidate, titleSimilarity }

  // Timeline position
  eventType       InstrumentEventType       @default(UNKNOWN)
  publishedAt     DateTime?                 // From NN metadata
  effectiveFrom   DateTime?                 // "Stupa na snagu..."
  effectiveUntil  DateTime?

  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  instrument      Instrument                @relation(...)
  evidence        Evidence                  @relation(...)

  @@unique([instrumentId, evidenceId])
  @@index([evidenceId])
  @@index([instrumentId, publishedAt])
  @@index([instrumentId, confidence])
}
```

### 2.8 InstrumentResolutionAttempt (Resolver Audit)

```prisma
model InstrumentResolutionAttempt {
  id                  String                    @id @default(cuid())
  evidenceId          String
  sourceKey           String?                   // Snapshot of Evidence.sourceKey

  // Candidates considered
  candidates          Json                      // [{ instrumentId, score, method, matchMeta }]

  // Outcome
  chosenInstrumentId  String?
  confidence          InstrumentLinkConfidence?
  method              InstrumentLinkMethod?

  // If unresolved, why
  failReason          ResolutionFailReason?
  failDetail          String?

  // Resolver identity
  resolverVersion     String

  createdAt           DateTime                  @default(now())

  evidence            Evidence                  @relation(...)

  @@index([evidenceId, createdAt])
  @@index([chosenInstrumentId])
  @@index([failReason])
}
```

### 2.9 InstrumentCoverage (Derived, Recalculable)

```prisma
model InstrumentCoverage {
  id              String              @id @default(cuid())
  instrumentId    String              @unique

  startDate       DateTime?
  endDate         DateTime?
  startEvidenceId String?
  startType       InstrumentEventType @default(UNKNOWN)

  gapNote         String?
  missingIssues   Json?               // [{ nnYear, nnIssue, reason }]

  computedAt      DateTime            @default(now())
  computedBy      String              // "coverage-computer-v1"

  instrument      Instrument          @relation(...)
}
```

### 2.10 ReparseJob (Reprocessing Queue)

```prisma
model ReparseJob {
  id              String    @id @default(cuid())
  evidenceId      String
  reason          String    // PARSER_UPGRADE, DRIFT_DETECTED, INTEGRITY_FAILURE, MANUAL
  priority        Int       @default(0)

  status          String    @default("PENDING")  // PENDING, RUNNING, COMPLETED, FAILED, SKIPPED

  previousParseId String?
  newParseId      String?

  createdAt       DateTime  @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  errorMessage    String?

  @@index([status, priority, createdAt])
  @@index([evidenceId])
}
```

---

## 3. Idempotency and Drift Rules

### 3.1 Fetch Idempotency

```
1. Check NNEnqueuedJob for jobKey
   - If exists: SKIP (already queued)

2. Fetch URL, compute contentHash

3. Find latest Evidence for same sourceKey
   - If exists AND contentHash matches: SKIP (unchanged)
   - If exists AND contentHash differs: CREATE new Evidence (content changed)
   - If not exists: CREATE new Evidence

4. Log NNFetchAuditEvent with decision
```

### 3.2 Parse Idempotency

```
1. Check ParsedDocument for (evidenceId, parserId, parserVersion, parseConfigHash)
   - If exists with SUCCESS: SKIP
   - If exists with PARTIAL/FAILED: consider reparse based on policy
   - If not exists: PARSE

2. Before parsing, check for drift:
   - Get CURRENT best primary artifact for Evidence.contentClass
   - Compare artifact.contentHash to any existing parse's cleanTextHash
   - If differs: mark drift, proceed with parse

3. After successful parse:
   - Mark previous parse isLatest=false
   - Set supersession links
```

### 3.3 Link Idempotency

```
1. Check InstrumentEvidenceLink for (instrumentId, evidenceId)
   - If exists with HIGH confidence: SKIP
   - If exists with lower confidence: UPSERT if new resolution is better
   - If not exists: CREATE

2. Always log InstrumentResolutionAttempt regardless of outcome
```

### 3.4 Drift Detection

```typescript
async function detectDrift(existingParse: ParsedDocument): Promise<DriftResult> {
  const evidence = await getEvidence(existingParse.evidenceId)
  const currentArtifact = selectPrimaryArtifact(evidence)

  if (currentArtifact.contentHash !== existingParse.cleanTextHash) {
    return {
      hasDrift: true,
      previousHash: existingParse.cleanTextHash,
      currentHash: currentArtifact.contentHash,
      artifactId: currentArtifact.id,
    }
  }

  return { hasDrift: false }
}
```

---

## 4. Parser Contract

### 4.1 Interface

```typescript
interface NNParserContract {
  parserId: string // "nn-parser"
  parserVersion: string // Git SHA or semver
  parseConfigHash: string // SHA256 of config

  supportedContentClasses: ContentClass[]

  parse(input: ParseInput): Promise<ParseOutput>
}

interface ParseInput {
  evidenceId: string
  contentClass: ContentClass
  artifact: {
    id: string
    kind: ArtifactKind
    content: string
    contentHash: string
  }
}

interface ParseOutput {
  status: "SUCCESS" | "PARTIAL" | "FAILED"
  errorMessage?: string

  warnings: Warning[]
  unparsedSegments: UnparsedSegment[]

  docMeta: DocumentMetadata

  cleanText: string
  cleanTextHash: string

  nodes: NodeOutput[]

  stats: {
    nodeCount: number
    maxDepth: number
    byType: Record<ProvisionNodeType, number>
    coverageChars: number
    coveragePercent: number
  }
}

interface Warning {
  code: string // MISSING_ARTICLE_NUMBER, AMBIGUOUS_STRUCTURE, etc.
  message: string
  nodePath?: string
  offsets?: { start: number; end: number }
}

interface UnparsedSegment {
  startOffset: number
  endOffset: number
  rawText: string // First 200 chars
  reason: string // NO_STRUCTURE_MARKERS, NESTED_TABLE, etc.
}

interface NodeOutput {
  nodeType: ProvisionNodeType
  nodePath: string
  label?: string
  orderIndex: number
  depth: number
  parentPath?: string

  startOffset: number
  endOffset: number
  isContainer: boolean

  rawText?: string // Only for non-container leaf nodes
  normalizedText?: string
  htmlSelector?: string
}
```

### 4.2 Invariants

| ID                | Invariant                                                            | Enforcement       |
| ----------------- | -------------------------------------------------------------------- | ----------------- |
| **PARSE-INV-001** | `nodePath` unique within ParsedDocument                              | DB constraint     |
| **PARSE-INV-002** | `nodePath` derived from numbering tokens, not content                | Parser logic      |
| **PARSE-INV-003** | `cleanText.substring(startOffset, endOffset)` reconstructs node text | Parser validation |
| **PARSE-INV-004** | Child offsets within parent offsets (for content nodes)              | Parser validation |
| **PARSE-INV-005** | Sibling orderIndex values unique and sequential                      | Parser validation |
| **PARSE-INV-006** | Container nodes (DOC, TITLE, CHAPTER, PART) may span children        | By design         |
| **PARSE-INV-007** | Content node siblings (CLANAK, STAVAK, TOCKA) must not overlap       | Parser validation |
| **PARSE-INV-008** | Offset unit is always UTF-16 code units                              | Parser config     |

### 4.3 Container vs Content Node Semantics

**Container nodes** (`isContainer=true`):

- DOC, TITLE, CHAPTER, PART
- Span covers all descendant nodes
- `rawText` is null (derive from offsets if needed)
- May overlap with children (by design)

**Content nodes** (`isContainer=false`):

- CLANAK, STAVAK, TOCKA, PODTOCKA, ALINEJA, PRILOG, TABLE, LIST
- Represent actual legal text
- `rawText` stored for leaf nodes
- Siblings must not overlap

### 4.4 NodePath Format

```
/članak:28/stavak:1/točka:a/podtočka:1

Components:
- članak:N    - Article number (from "Članak N." token)
- stavak:N    - Paragraph number (from "(N)" or "Stavak N." token)
- točka:X     - Point (from "a)", "1.", etc.)
- podtočka:N  - Subpoint
- alineja:N   - Bullet (when no explicit marker)
- prilog:N    - Annex number
```

**Stability rule**: NodePath is derived from numbering tokens found in text. Same numbering = same path, regardless of content changes.

---

## 5. Metrics Definitions

### 5.1 Coverage Metrics

**Node Coverage** (non-overlapping):

```sql
-- Compute as interval union of content nodes only
WITH content_nodes AS (
  SELECT startOffset, endOffset
  FROM ProvisionNode
  WHERE parsedDocumentId = $1
    AND isContainer = false
),
merged_intervals AS (
  -- Merge overlapping intervals using recursive CTE or app logic
  ...
)
SELECT SUM(endOffset - startOffset) as covered_chars
FROM merged_intervals;

-- Coverage percent
covered_chars / cleanTextLength * 100
```

**Unparsed Percentage**:

```sql
SELECT SUM(endOffset - startOffset) / pd.cleanTextLength * 100
FROM unnest(pd.unparsedSegments) as seg
WHERE pd.id = $1
```

### 5.2 Stability Metrics

**NodePath Stability** (across reparse):

```sql
WITH old_paths AS (
  SELECT nodePath, nodeType FROM ProvisionNode WHERE parsedDocumentId = $old
),
new_paths AS (
  SELECT nodePath, nodeType FROM ProvisionNode WHERE parsedDocumentId = $new
)
SELECT
  nodeType,
  COUNT(*) FILTER (WHERE old.nodePath IS NOT NULL AND new.nodePath IS NOT NULL) as stable,
  COUNT(*) FILTER (WHERE old.nodePath IS NULL) as added,
  COUNT(*) FILTER (WHERE new.nodePath IS NULL) as removed
FROM old_paths old
FULL OUTER JOIN new_paths new USING (nodePath)
GROUP BY nodeType;
```

**Target stability by type**:
| NodeType | Stability Target |
|----------|------------------|
| CLANAK | 100% |
| STAVAK | >95% |
| TOCKA | >90% |
| PODTOCKA | >85% |
| Others | >80% |

### 5.3 Performance Metrics

**Parse Performance** (by contentClass):

| Percentile | HTML   | PDF_TEXT | PDF_SCANNED |
| ---------- | ------ | -------- | ----------- |
| p50        | <300ms | <500ms   | <2s         |
| p95        | <2s    | <5s      | <30s        |
| p99        | <10s   | <30s     | <120s       |

### 5.4 Integrity Metrics

**Anchor Integrity Check**:

```typescript
async function checkAnchorIntegrity(sampleSize: number): Promise<IntegrityReport> {
  // Sample ParsedDocuments first (corruption clusters by document)
  const docs = await db.parsedDocument.findMany({
    where: { status: "SUCCESS", isLatest: true },
    orderBy: { createdAt: "desc" },
    take: Math.ceil(sampleSize / 10),
  })

  // For each doc, sample nodes
  const nodesPerDoc = Math.ceil(sampleSize / docs.length)
  const failures: Failure[] = []

  for (const doc of docs) {
    const artifact = await getArtifact(doc.cleanTextArtifactId)
    const nodes = await db.provisionNode.findMany({
      where: { parsedDocumentId: doc.id, isContainer: false },
      take: nodesPerDoc,
    })

    for (const node of nodes) {
      if (node.rawText) {
        const extracted = artifact.content.substring(node.startOffset, node.endOffset)
        if (extracted !== node.rawText) {
          failures.push({ nodeId: node.id, type: "OFFSET_MISMATCH" })
        }
      }
    }
  }

  return {
    sampled: sampleSize,
    passed: sampleSize - failures.length,
    integrityRate: (sampleSize - failures.length) / sampleSize,
    failures,
  }
}
```

---

## 6. Test Plan

### 6.1 Fixture Categories

| Category     | Count  | Purpose                        |
| ------------ | ------ | ------------------------------ |
| Simple laws  | 10     | Basic structure, 5-15 articles |
| Complex laws | 5      | 100+ articles, deep nesting    |
| Amendments   | 10     | Replace/insert/delete patterns |
| Bylaws       | 10     | Pravilnik, Uredba formats      |
| With annexes | 5      | Prilog extraction              |
| With tables  | 5      | Table preservation             |
| Historical   | 5      | Pre-2010 formatting            |
| **Total**    | **50** |                                |

### 6.2 Fixture Structure

```
fixtures/nn-parser/
├── manifest.json
├── simple-laws/
│   └── nn-2024-001-001/
│       ├── input.html
│       ├── expected-meta.json
│       └── expected-nodes.json
├── amendments/
├── with-tables/
└── ...
```

### 6.3 Test Cases

| Test                   | Pass Criteria                             |
| ---------------------- | ----------------------------------------- |
| **Parser unit tests**  | 100% pass                                 |
| **Fixture regression** | >95% match expected structure             |
| **Offset invariant**   | 100% substring match                      |
| **Tree invariant**     | No overlapping content siblings           |
| **Integration**        | fetch → parse → link succeeds             |
| **Drift detection**    | 100% drift detected when artifact changes |
| **Reparse safety**     | No data loss on supersession              |
| **Performance**        | Within percentile targets                 |

### 6.4 Nightly Checks

1. **Anchor integrity** - Sample 1000 nodes, verify offsets
2. **Coverage report** - Compute per-document coverage stats
3. **Stability report** - Compare latest parse to previous version
4. **Resolver quality** - % of HIGH/MEDIUM confidence links

---

## 7. Reprocessing and Retention

### 7.1 Reparse Triggers

| Trigger             | Scope             | Priority    |
| ------------------- | ----------------- | ----------- |
| Parser version bump | All Evidence      | LOW (batch) |
| Config change       | Affected Evidence | MEDIUM      |
| Drift detected      | Single Evidence   | HIGH        |
| Integrity failure   | Affected nodes    | HIGH        |
| Manual request      | Specified         | HIGHEST     |

### 7.2 Reparse Safety Rules

1. Never delete old ParsedDocument until new one is SUCCESS
2. Set supersession links atomically
3. Mark old parse `isLatest=false` only after new parse succeeds
4. Log all supersessions in audit trail

### 7.3 Retention Policy

| Condition                | Retention                    |
| ------------------------ | ---------------------------- |
| Latest successful parse  | Keep forever                 |
| Previous N versions      | Keep last 3                  |
| PARTIAL/FAILED status    | Keep for 90 days (debugging) |
| Superseded >90 days ago  | GC eligible                  |
| Pinned by incident/audit | Keep until unpinned          |

### 7.4 GC Process

```sql
-- Find GC candidates
SELECT id FROM ParsedDocument
WHERE isLatest = false
  AND status = 'SUCCESS'
  AND createdAt < NOW() - INTERVAL '90 days'
  AND id NOT IN (SELECT pinnedParseId FROM AuditPin)
ORDER BY createdAt ASC
LIMIT 1000;

-- Cascade delete (nodes deleted via FK cascade)
DELETE FROM ParsedDocument WHERE id IN (...);
```

---

## 8. Implementation Phases

### Phase 1: Foundation (This Sprint)

1. Add schema migrations for ParsedDocument, ProvisionNode
2. Implement nn-parser with invariant validation
3. Create 10 initial fixtures
4. Build parse pipeline: Evidence → ParsedDocument → ProvisionNode

**Exit criteria**: Parse 50 diverse NN items with >95% success rate

### Phase 2: Instrument Linking

1. Add InstrumentEvidenceLink, InstrumentResolutionAttempt
2. Implement resolver v1 (ELI match + title fuzzy)
3. Build instrument timeline queries

**Exit criteria**: >80% of Evidence linked with HIGH/MEDIUM confidence

### Phase 3: Clean Browser MVP

1. Browse by Issue → Item → Article tree
2. Stable citation links via nodePath
3. Search within document

**Exit criteria**: Internal dogfooding for 2 weeks

### Phase 4: Monitoring & Reprocessing

1. Nightly integrity checks
2. Drift detection and auto-reparse
3. Retention GC
4. Coverage dashboard

**Exit criteria**: <1% integrity failures sustained

### Phase 5: Snapshots (Future)

1. InstrumentSnapshot model
2. Consolidation engine v1
3. "As of date" queries

**Exit criteria**: Deferred until Phase 1-4 stable

---

## Appendix A: Migration SQL (Partial Unique Index)

If needed for Evidence idempotency (optional):

```sql
-- Partial unique index on sourceKey when not null
CREATE UNIQUE INDEX evidence_sourcekey_contenthash_unique
ON "Evidence" ("sourceKey", "contentHash")
WHERE "sourceKey" IS NOT NULL;
```

---

## Appendix B: Quick Reference

### Key Tables

| Table                  | Purpose                   | Layer         |
| ---------------------- | ------------------------- | ------------- |
| Evidence               | Raw HTML/PDF storage      | A (Raw)       |
| EvidenceArtifact       | Cleaned text, OCR output  | A (Raw)       |
| ParsedDocument         | Parse record with version | B (Canonical) |
| ProvisionNode          | Tree structure            | B (Canonical) |
| Instrument             | Law/regulation identity   | B (Canonical) |
| InstrumentEvidenceLink | Timeline join             | B (Canonical) |
| InstrumentCoverage     | Derived coverage          | C (Product)   |

### Key Invariants

1. Evidence.rawContent is immutable
2. ParsedDocument is append-only per config tuple
3. ProvisionNode offsets match cleanText substrings
4. NodePath is deterministic from numbering tokens
5. Snapshots are derived caches, rebuildable from Evidence

### Key Idempotency Keys

| Step  | Key                                                    |
| ----- | ------------------------------------------------------ |
| Fetch | NNEnqueuedJob.jobKey                                   |
| Parse | (evidenceId, parserId, parserVersion, parseConfigHash) |
| Link  | (instrumentId, evidenceId)                             |
