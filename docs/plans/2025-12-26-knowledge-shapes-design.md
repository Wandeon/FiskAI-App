# Neuro-Symbolic Knowledge Architecture: 7 Shapes Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create detailed implementation plans for each phase.

**Date:** 2025-12-26
**Status:** Approved for Implementation
**Author:** Claude Opus 4.5 + Product Review

---

## Executive Summary

Transform FiskAI's regulatory pipeline from a "Text Search" model to a "Neuro-Symbolic Interpretation Graph" model. The current system extracts flat facts (key:value pairs) which causes "Semantic Blindness" - correct citations but wrong situational answers.

**Root Causes Identified:**

1. **Flat Fact Fallacy** - Extracts values without logic context
2. **Taxonomy Gap** - No synonym/hypernym mapping ("juice" → "non-alcoholic beverage")
3. **Hierarchy Blindness** - No lex specialis modeling (specific overrides general)
4. **Missing Shapes** - No support for workflows, lookups, documents, or transitions

**Solution:** Implement 7 distinct knowledge shapes to handle the complete universe of regulatory questions.

---

## The 7 Knowledge Shapes

| #   | Shape          | User Question Example                         | Data Model                            |
| --- | -------------- | --------------------------------------------- | ------------------------------------- |
| 1   | **Logic**      | "Do I owe VAT if I sold €5,000?"              | `AtomicClaim` with conditions         |
| 2   | **Taxonomy**   | "Is juice taxed at reduced rate?"             | `ConceptNode` with synonyms/hypernyms |
| 3   | **Precedence** | "Food rate vs alcohol exception?"             | `GraphEdge` with OVERRIDES relation   |
| 4   | **Workflow**   | "How do I register for OSS?"                  | `RegulatoryProcess` + `ProcessStep`   |
| 5   | **Reference**  | "What is the IBAN for Split?"                 | `ReferenceTable` + `ReferenceEntry`   |
| 6   | **Document**   | "Where is the PDV form?"                      | `RegulatoryAsset`                     |
| 7   | **Temporal**   | "Which rate for June invoice, July delivery?" | `TransitionalProvision`               |

---

## Schema Design

### Shape 1: Atomic Claims (Logic)

Replaces flat `SourcePointer` extractions with full logic frames.

```prisma
model AtomicClaim {
  id              String   @id @default(cuid())

  // WHO - Subject
  subjectType     SubjectType  // TAXPAYER, EMPLOYER, COMPANY, INDIVIDUAL, ALL
  subjectQualifiers String[]   // ["pausalni-obrt", "exceeds-threshold"]

  // WHEN - Condition
  triggerExpr     String?      // "sales > 10000 EUR"
  temporalExpr    String?      // "from 2025-01-01"
  jurisdiction    String       @default("HR")

  // WHAT - Assertion
  assertionType   AssertionType // OBLIGATION, PROHIBITION, PERMISSION, DEFINITION
  logicExpr       String        // "tax_place = destination"
  value           String?
  valueType       String?

  // Extensibility
  parameters      Json?        // Coefficients, formula constants

  // Provenance
  exactQuote      String   @db.Text
  articleNumber   String?
  lawReference    String?
  evidenceId      String
  confidence      Float    @default(0.8)

  // Relations
  evidence        Evidence @relation(fields: [evidenceId], references: [id])
  rule            RegulatoryRule? @relation(fields: [ruleId], references: [id])
  ruleId          String?
  exceptions      ClaimException[]

  @@index([subjectType])
  @@index([assertionType])
  @@index([jurisdiction])
}

model ClaimException {
  id              String   @id @default(cuid())
  claimId         String
  condition       String   // "IF alcohol_content > 0"
  overridesTo     String   // concept slug of overriding rule
  sourceArticle   String   // "Art 38(4)"

  claim           AtomicClaim @relation(fields: [claimId], references: [id])
}

enum SubjectType {
  TAXPAYER
  EMPLOYER
  COMPANY
  INDIVIDUAL
  ALL
}

enum AssertionType {
  OBLIGATION      // Must do X
  PROHIBITION     // Must not do X
  PERMISSION      // May do X
  DEFINITION      // X means Y
}
```

### Shape 2: Taxonomy (Concept Graph)

Extends existing `Concept` model with proper taxonomy support.

```prisma
model ConceptNode {
  id              String   @id @default(cuid())
  slug            String   @unique
  nameHr          String
  nameEn          String?

  // Taxonomy relations
  parentId        String?
  parent          ConceptNode?  @relation("ConceptHierarchy", fields: [parentId], references: [id])
  children        ConceptNode[] @relation("ConceptHierarchy")

  // Synonyms & hyponyms
  synonyms        String[]      // ["sok", "juice", "voćni sok"]
  hyponyms        String[]      // More specific terms

  // Legal categorization
  legalCategory   String?       // "bezalkoholno piće" (the legal term)
  vatCategory     String?       // Links to VAT rate concept

  // Search optimization
  searchTerms     String[]      // All terms that should match

  @@index([legalCategory])
  @@index([vatCategory])
}
```

### Shape 3: Precedence (Override Edges)

Uses existing `GraphEdge` model with explicit OVERRIDES relation.

```prisma
enum GraphEdgeType {
  AMENDS
  INTERPRETS
  REQUIRES
  EXEMPTS
  DEPENDS_ON
  SUPERSEDES
  OVERRIDES      // NEW: Lex specialis - specific overrides general
}

// Usage: Create edge from specific rule → general rule
// Example: "alcohol-25%" OVERRIDES "food-5%"
// Resolution: When both match, take the rule with no outgoing OVERRIDES edge
```

### Shape 4: Workflow (Process Graph)

```prisma
model RegulatoryProcess {
  id              String   @id @default(cuid())
  slug            String   @unique
  titleHr         String
  titleEn         String?
  jurisdiction    String   @default("HR")

  // Process metadata
  processType     ProcessType  // REGISTRATION, FILING, APPEAL, CLOSURE
  estimatedTime   String?      // "3-5 radnih dana"

  // Prerequisites
  prerequisites   Json         // { "requires": ["digital-certificate"] }

  // Relations
  steps           ProcessStep[]
  assets          RegulatoryAsset[]
  evidenceId      String?
  evidence        Evidence? @relation(fields: [evidenceId], references: [id])

  @@index([processType])
  @@index([jurisdiction])
}

model ProcessStep {
  id              String   @id @default(cuid())
  processId       String
  orderNum        Int              // Display ordering

  // Step content
  actionHr        String
  actionEn        String?

  // Dependencies (by ID for loose coupling)
  requiresStepIds String[]
  requiresAssets  String[]

  // Branching
  onSuccessStepId String?
  onFailureStepId String?
  failureAction   String?

  process         RegulatoryProcess @relation(fields: [processId], references: [id])

  @@unique([processId, orderNum])
}

enum ProcessType {
  REGISTRATION
  FILING
  APPEAL
  CLOSURE
  AMENDMENT
  INQUIRY
}
```

### Shape 5: Reference (Lookup Tables)

```prisma
model ReferenceTable {
  id              String   @id @default(cuid())
  category        ReferenceCategory
  name            String
  jurisdiction    String   @default("HR")

  // Table metadata
  keyColumn       String       // "city", "code"
  valueColumn     String       // "iban", "description"

  // Data
  entries         ReferenceEntry[]

  // Provenance
  sourceUrl       String?
  lastUpdated     DateTime
  evidenceId      String?

  @@unique([category, name, jurisdiction])
}

model ReferenceEntry {
  id              String   @id @default(cuid())
  tableId         String

  key             String       // "Split", "6201.11"
  value           String       // "HR1234...", "Računalne usluge"
  metadata        Json?        // { "model": "21" }

  table           ReferenceTable @relation(fields: [tableId], references: [id])

  @@index([tableId, key])
}

enum ReferenceCategory {
  IBAN
  CN_CODE
  TAX_OFFICE
  INTEREST_RATE
  EXCHANGE_RATE
  FORM_CODE
  DEADLINE_CALENDAR
}
```

### Shape 6: Document (Asset Repository)

```prisma
model RegulatoryAsset {
  id              String   @id @default(cuid())

  // Identity
  formCode        String?      // "PDV-P", "JOPPD"
  officialName    String
  description     String?

  // Access
  downloadUrl     String
  format          AssetFormat
  fileSize        Int?

  // Context
  assetType       AssetType
  usedInProcess   RegulatoryProcess? @relation(fields: [processId], references: [id])
  processId       String?
  stepNumber      Int?

  // Validity
  validFrom       DateTime?
  validUntil      DateTime?
  version         String?

  // Provenance
  sourceUrl       String
  evidenceId      String?

  @@index([formCode])
  @@index([assetType])
}

enum AssetFormat { PDF, XML, XLS, XLSX, DOC, DOCX, HTML }
enum AssetType { FORM, TEMPLATE, GUIDE, INSTRUCTION, REGULATION_TEXT }
```

### Shape 7: Temporal (Transitional Provisions)

```prisma
model TransitionalProvision {
  id              String   @id @default(cuid())

  // What's transitioning
  fromRule        String       // concept slug of old rule
  toRule          String       // concept slug of new rule

  // Transition logic
  cutoffDate      DateTime
  logicExpr       String       // "IF invoice_date < cutoff AND delivery_date >= cutoff"
  appliesRule     String       // Which rule applies

  // Explanation
  explanationHr   String   @db.Text
  explanationEn   String?  @db.Text

  // Pattern
  pattern         TransitionPattern

  // Provenance
  sourceArticle   String
  evidenceId      String
  evidence        Evidence @relation(fields: [evidenceId], references: [id])

  @@index([cutoffDate])
  @@index([fromRule])
}

enum TransitionPattern {
  INVOICE_DATE
  DELIVERY_DATE
  PAYMENT_DATE
  EARLIER_EVENT
  LATER_EVENT
  TAXPAYER_CHOICE
}
```

---

## Implementation Phases

### Phase 1: Schema Migration (Week 1)

| Task | Description                                           | Effort |
| ---- | ----------------------------------------------------- | ------ |
| S-1  | Create AtomicClaim + ClaimException models            | 2d     |
| S-2  | Extend Concept → ConceptNode with taxonomy fields     | 2d     |
| S-3  | Create Process, Reference, Asset, Transitional models | 2d     |

### Phase 2: Multi-Shape Extraction (Week 2-3)

| Task | Description                                           | Effort |
| ---- | ----------------------------------------------------- | ------ |
| E-1  | ContentClassifier - route to appropriate extractor    | 2d     |
| E-2  | ClaimFrame extractor with subject/condition/assertion | 3d     |
| E-3  | Process extractor for numbered lists/procedures       | 2d     |
| E-4  | Reference extractor for tables/lookups                | 2d     |
| E-5  | Asset extractor for form links                        | 1d     |
| E-6  | Transitional extractor for "Prijelazne odredbe"       | 2d     |

### Phase 3: Taxonomy + Precedence (Week 3)

| Task | Description                                           | Effort |
| ---- | ----------------------------------------------------- | ------ |
| T-1  | expandQueryConcepts() with synonym/hypernym traversal | 1d     |
| T-2  | legalCategory matching in query engine                | 1d     |
| T-3  | Seed initial Croatian regulatory taxonomy             | 2d     |
| P-1  | Create OVERRIDES edges from ClaimException            | 2d     |
| P-2  | Arbiter resolution using precedence edges             | 1d     |
| P-3  | Query engine returns most specific rule               | 1d     |

### Phase 4: Retrieval Router (Week 4)

| Task | Description                                                | Effort |
| ---- | ---------------------------------------------------------- | ------ |
| R-1  | Query intent classifier (LOGIC/PROCESS/REFERENCE/DOCUMENT) | 2d     |
| R-2  | ProcessEngine for "how do I" queries                       | 2d     |
| R-3  | ReferenceEngine for exact lookups                          | 1d     |
| R-4  | AssetEngine for document requests                          | 1d     |
| R-5  | TemporalEngine for transition queries                      | 2d     |

### Phase 5: Coverage Gate (Week 4)

| Task | Description                                   | Effort |
| ---- | --------------------------------------------- | ------ |
| C-1  | CoverageReport schema tracking all 7 shapes   | 1d     |
| C-2  | Reviewer gate blocking incomplete extractions | 2d     |
| C-3  | Admin dashboard for coverage visibility       | 1d     |

---

## Success Metrics

| Metric                                      | Current | Target |
| ------------------------------------------- | ------- | ------ |
| Threshold logic queries answered correctly  | ~20%    | >90%   |
| Taxonomy queries answered correctly         | ~15%    | >85%   |
| Precedence conflicts resolved automatically | ~10%    | >80%   |
| Workflow queries return step-by-step        | 0%      | >90%   |
| Reference lookups exact match               | ~50%    | >99%   |
| Document requests return download link      | ~30%    | >95%   |
| Temporal queries explain both rules         | 0%      | >85%   |

---

## File Structure

```
src/lib/regulatory-truth/
├── schemas/
│   ├── atomic-claim.ts        # NEW: ClaimFrame schema
│   ├── process.ts             # NEW: Process/Step schemas
│   ├── reference.ts           # NEW: Reference table schemas
│   ├── asset.ts               # NEW: Asset schemas
│   └── transitional.ts        # NEW: Transitional provision schemas
├── agents/
│   ├── extractor.ts           # MODIFY: Add content classification
│   ├── claim-extractor.ts     # NEW: AtomicClaim extraction
│   ├── process-extractor.ts   # NEW: Process extraction
│   ├── reference-extractor.ts # NEW: Reference table extraction
│   ├── asset-extractor.ts     # NEW: Asset extraction
│   └── transitional-extractor.ts # NEW: Transitional extraction
├── taxonomy/
│   ├── concept-graph.ts       # NEW: Taxonomy traversal
│   ├── query-expansion.ts     # NEW: Synonym/hypernym expansion
│   └── seed-taxonomy.ts       # NEW: Initial taxonomy data
├── retrieval/
│   ├── query-router.ts        # NEW: Intent classification + routing
│   ├── logic-engine.ts        # NEW: AtomicClaim resolution
│   ├── process-engine.ts      # NEW: Workflow retrieval
│   ├── reference-engine.ts    # NEW: Lookup table queries
│   ├── asset-engine.ts        # NEW: Document retrieval
│   └── temporal-engine.ts     # NEW: Transition resolution
└── quality/
    ├── coverage-gate.ts       # NEW: Extraction completeness check
    └── coverage-report.ts     # NEW: Coverage metrics
```

---

## Appendix: Example Transformations

### Before (Flat Fact)

```json
{
  "domain": "pdv",
  "value_type": "threshold",
  "extracted_value": "10000",
  "exact_quote": "Prag u iznosu od 10.000,00 eura..."
}
```

### After (Atomic Claim)

```json
{
  "subjectType": "TAXPAYER",
  "subjectQualifiers": ["eu-seller", "cross-border"],
  "triggerExpr": "annual_eu_sales > 10000 EUR",
  "temporalExpr": "per_calendar_year",
  "assertionType": "OBLIGATION",
  "logicExpr": "tax_place = destination_country",
  "exceptions": [
    {
      "condition": "annual_eu_sales <= 10000 EUR",
      "overridesTo": "origin-taxation-rule",
      "sourceArticle": "Art 58(1)"
    }
  ],
  "exactQuote": "Prag u iznosu od 10.000,00 eura koji se primjenjuje na...",
  "articleNumber": "58",
  "lawReference": "Zakon o PDV-u (NN 73/13)"
}
```

---

## Next Steps

1. Run `superpowers:writing-plans` to create detailed implementation tasks
2. Create git worktree for isolated development
3. Begin with Phase 1: Schema Migration
