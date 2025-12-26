# Knowledge Shapes Phase 1: Schema Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the Prisma schema with all 7 knowledge shape models and run migrations.

**Architecture:** Add new models (AtomicClaim, ConceptNode, RegulatoryProcess, ProcessStep, ReferenceTable, ReferenceEntry, RegulatoryAsset, TransitionalProvision) alongside existing RegulatoryRule. Extend existing Concept model. Add new enums. Create relations to Evidence.

**Tech Stack:** Prisma 7, PostgreSQL, TypeScript, Zod

**Prerequisites:** Read `docs/plans/2025-12-26-knowledge-shapes-design.md` for full context.

---

## Task 1: Add New Enums to Schema

**Files:**

- Modify: `prisma/schema.prisma` (add after line ~1660, after existing enums)

**Step 1: Add the new enums**

Add these enums to `prisma/schema.prisma` after the existing `ObligationType` enum:

```prisma
// ============================================================================
// KNOWLEDGE SHAPES ENUMS
// ============================================================================

enum SubjectType {
  TAXPAYER
  EMPLOYER
  COMPANY
  INDIVIDUAL
  ALL
}

enum AssertionType {
  OBLIGATION
  PROHIBITION
  PERMISSION
  DEFINITION
}

enum ProcessType {
  REGISTRATION
  FILING
  APPEAL
  CLOSURE
  AMENDMENT
  INQUIRY
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

enum AssetFormat {
  PDF
  XML
  XLS
  XLSX
  DOC
  DOCX
  HTML
}

enum AssetType {
  FORM
  TEMPLATE
  GUIDE
  INSTRUCTION
  REGULATION_TEXT
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

**Step 2: Also add OVERRIDES to GraphEdgeType**

Find the `GraphEdgeType` enum (around line 1627) and add OVERRIDES:

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
```

**Step 3: Verify schema syntax**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add knowledge shapes enums"
```

---

## Task 2: Create AtomicClaim Model

**Files:**

- Modify: `prisma/schema.prisma` (add after RegulatoryRule model, around line 1878)

**Step 1: Add AtomicClaim and ClaimException models**

```prisma
// ============================================================================
// SHAPE 1: ATOMIC CLAIMS (Logic Frames)
// ============================================================================

model AtomicClaim {
  id                String        @id @default(cuid())

  // WHO - Subject
  subjectType       SubjectType
  subjectQualifiers String[]      // ["pausalni-obrt", "exceeds-threshold"]

  // WHEN - Condition
  triggerExpr       String?       // "sales > 10000 EUR"
  temporalExpr      String?       // "from 2025-01-01"
  jurisdiction      String        @default("HR")

  // WHAT - Assertion
  assertionType     AssertionType
  logicExpr         String        // "tax_place = destination"
  value             String?
  valueType         String?

  // Extensibility
  parameters        Json?         // Coefficients, formula constants

  // Provenance
  exactQuote        String        @db.Text
  articleNumber     String?
  lawReference      String?
  confidence        Float         @default(0.8)

  // Relations
  evidenceId        String
  evidence          Evidence      @relation(fields: [evidenceId], references: [id])
  ruleId            String?
  rule              RegulatoryRule? @relation(fields: [ruleId], references: [id])
  exceptions        ClaimException[]

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([subjectType])
  @@index([assertionType])
  @@index([jurisdiction])
  @@index([evidenceId])
  @@index([ruleId])
}

model ClaimException {
  id              String   @id @default(cuid())
  claimId         String
  condition       String   // "IF alcohol_content > 0"
  overridesTo     String   // concept slug of overriding rule
  sourceArticle   String   // "Art 38(4)"

  claim           AtomicClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@index([claimId])
}
```

**Step 2: Add relation to Evidence model**

Find the `Evidence` model and add the relation. Look for the relations section and add:

```prisma
  // In Evidence model, add:
  atomicClaims      AtomicClaim[]
```

**Step 3: Add relation to RegulatoryRule model**

Find the `RegulatoryRule` model and add:

```prisma
  // In RegulatoryRule model, add after existing relations:
  atomicClaims      AtomicClaim[]
```

**Step 4: Verify schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add AtomicClaim and ClaimException models"
```

---

## Task 3: Create ConceptNode Model (Enhanced Taxonomy)

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Create ConceptNode model**

Add after AtomicClaim (or replace/extend existing Concept model):

```prisma
// ============================================================================
// SHAPE 2: TAXONOMY (Concept Graph)
// ============================================================================

model ConceptNode {
  id              String   @id @default(cuid())
  slug            String   @unique
  nameHr          String
  nameEn          String?

  // Taxonomy relations
  parentId        String?
  parent          ConceptNode?  @relation("ConceptNodeHierarchy", fields: [parentId], references: [id])
  children        ConceptNode[] @relation("ConceptNodeHierarchy")

  // Synonyms & hyponyms
  synonyms        String[]      // ["sok", "juice", "voćni sok"]
  hyponyms        String[]      // More specific terms

  // Legal categorization
  legalCategory   String?       // "bezalkoholno piće" (the legal term)
  vatCategory     String?       // Links to VAT rate concept

  // Search optimization
  searchTerms     String[]      // All terms that should match this concept

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([legalCategory])
  @@index([vatCategory])
  @@index([parentId])
}
```

**Step 2: Verify schema**

Run: `npx prisma validate`
Expected: Valid

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ConceptNode model for taxonomy"
```

---

## Task 4: Create Process Models (Workflow)

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add RegulatoryProcess and ProcessStep models**

```prisma
// ============================================================================
// SHAPE 4: WORKFLOW (Process Graph)
// ============================================================================

model RegulatoryProcess {
  id              String      @id @default(cuid())
  slug            String      @unique
  titleHr         String
  titleEn         String?
  jurisdiction    String      @default("HR")

  // Process metadata
  processType     ProcessType
  estimatedTime   String?     // "3-5 radnih dana"

  // Prerequisites as JSON
  prerequisites   Json?       // { "requires": ["digital-certificate"] }

  // Relations
  steps           ProcessStep[]
  assets          RegulatoryAsset[]
  evidenceId      String?
  evidence        Evidence?   @relation(fields: [evidenceId], references: [id])

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([processType])
  @@index([jurisdiction])
  @@index([evidenceId])
}

model ProcessStep {
  id              String   @id @default(cuid())
  processId       String
  orderNum        Int

  // Step content
  actionHr        String   @db.Text
  actionEn        String?  @db.Text

  // Dependencies (by ID for loose coupling)
  requiresStepIds String[]
  requiresAssets  String[]

  // Branching
  onSuccessStepId String?
  onFailureStepId String?
  failureAction   String?

  process         RegulatoryProcess @relation(fields: [processId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())

  @@unique([processId, orderNum])
  @@index([processId])
}
```

**Step 2: Add relation to Evidence**

```prisma
  // In Evidence model, add:
  processes         RegulatoryProcess[]
```

**Step 3: Verify and commit**

```bash
npx prisma validate
git add prisma/schema.prisma
git commit -m "feat(schema): add RegulatoryProcess and ProcessStep models"
```

---

## Task 5: Create Reference Models (Lookup Tables)

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add ReferenceTable and ReferenceEntry models**

```prisma
// ============================================================================
// SHAPE 5: REFERENCE (Lookup Tables)
// ============================================================================

model ReferenceTable {
  id              String            @id @default(cuid())
  category        ReferenceCategory
  name            String
  jurisdiction    String            @default("HR")

  // Table metadata
  keyColumn       String            // "city", "code"
  valueColumn     String            // "iban", "description"

  // Data
  entries         ReferenceEntry[]

  // Provenance
  sourceUrl       String?
  lastUpdated     DateTime          @default(now())
  evidenceId      String?
  evidence        Evidence?         @relation(fields: [evidenceId], references: [id])

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([category, name, jurisdiction])
  @@index([category])
  @@index([jurisdiction])
}

model ReferenceEntry {
  id              String   @id @default(cuid())
  tableId         String

  key             String   // "Split", "6201.11"
  value           String   // "HR1234...", "Računalne usluge"
  metadata        Json?    // { "model": "21" }

  table           ReferenceTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())

  @@index([tableId, key])
  @@index([tableId])
}
```

**Step 2: Add relation to Evidence**

```prisma
  // In Evidence model, add:
  referenceTables   ReferenceTable[]
```

**Step 3: Verify and commit**

```bash
npx prisma validate
git add prisma/schema.prisma
git commit -m "feat(schema): add ReferenceTable and ReferenceEntry models"
```

---

## Task 6: Create Asset Model (Document Repository)

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add RegulatoryAsset model**

```prisma
// ============================================================================
// SHAPE 6: DOCUMENT (Asset Repository)
// ============================================================================

model RegulatoryAsset {
  id              String      @id @default(cuid())

  // Identity
  formCode        String?     // "PDV-P", "JOPPD"
  officialName    String
  description     String?     @db.Text

  // Access
  downloadUrl     String
  format          AssetFormat
  fileSize        Int?

  // Context
  assetType       AssetType
  processId       String?
  process         RegulatoryProcess? @relation(fields: [processId], references: [id])
  stepNumber      Int?

  // Validity
  validFrom       DateTime?
  validUntil      DateTime?
  version         String?

  // Provenance
  sourceUrl       String
  evidenceId      String?
  evidence        Evidence?   @relation(fields: [evidenceId], references: [id])

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([formCode])
  @@index([assetType])
  @@index([processId])
}
```

**Step 2: Add relation to Evidence**

```prisma
  // In Evidence model, add:
  assets            RegulatoryAsset[]
```

**Step 3: Verify and commit**

```bash
npx prisma validate
git add prisma/schema.prisma
git commit -m "feat(schema): add RegulatoryAsset model"
```

---

## Task 7: Create TransitionalProvision Model (Temporal)

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add TransitionalProvision model**

```prisma
// ============================================================================
// SHAPE 7: TEMPORAL (Transitional Provisions)
// ============================================================================

model TransitionalProvision {
  id              String            @id @default(cuid())

  // What's transitioning
  fromRule        String            // concept slug of old rule
  toRule          String            // concept slug of new rule

  // Transition logic
  cutoffDate      DateTime
  logicExpr       String            // "IF invoice_date < cutoff AND delivery_date >= cutoff"
  appliesRule     String            // Which rule applies

  // Explanation
  explanationHr   String            @db.Text
  explanationEn   String?           @db.Text

  // Pattern
  pattern         TransitionPattern

  // Provenance
  sourceArticle   String
  evidenceId      String
  evidence        Evidence          @relation(fields: [evidenceId], references: [id])

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([cutoffDate])
  @@index([fromRule])
  @@index([toRule])
  @@index([evidenceId])
}
```

**Step 2: Add relation to Evidence**

```prisma
  // In Evidence model, add:
  transitionalProvisions TransitionalProvision[]
```

**Step 3: Verify and commit**

```bash
npx prisma validate
git add prisma/schema.prisma
git commit -m "feat(schema): add TransitionalProvision model"
```

---

## Task 8: Run Database Migration

**Files:**

- Creates: `prisma/migrations/YYYYMMDDHHMMSS_add_knowledge_shapes/migration.sql`

**Step 1: Generate migration**

Run: `npx prisma migrate dev --name add_knowledge_shapes`

Expected output:

```
Applying migration `YYYYMMDDHHMMSS_add_knowledge_shapes`
The following migration(s) have been created and applied...
```

**Step 2: Verify migration applied**

Run: `npx prisma migrate status`

Expected: All migrations applied

**Step 3: Generate Prisma client**

Run: `npx prisma generate`

Expected: "Generated Prisma Client"

**Step 4: Commit migration**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "feat(schema): run knowledge shapes migration"
```

---

## Task 9: Create Zod Schemas for New Models

**Files:**

- Create: `src/lib/regulatory-truth/schemas/atomic-claim.ts`
- Create: `src/lib/regulatory-truth/schemas/process.ts`
- Create: `src/lib/regulatory-truth/schemas/reference.ts`
- Create: `src/lib/regulatory-truth/schemas/asset.ts`
- Create: `src/lib/regulatory-truth/schemas/transitional.ts`
- Modify: `src/lib/regulatory-truth/schemas/index.ts`

**Step 1: Create atomic-claim.ts**

```typescript
// src/lib/regulatory-truth/schemas/atomic-claim.ts
import { z } from "zod"

export const SubjectTypeSchema = z.enum(["TAXPAYER", "EMPLOYER", "COMPANY", "INDIVIDUAL", "ALL"])

export const AssertionTypeSchema = z.enum(["OBLIGATION", "PROHIBITION", "PERMISSION", "DEFINITION"])

export const ClaimExceptionSchema = z.object({
  condition: z.string().min(1),
  overridesTo: z.string().min(1),
  sourceArticle: z.string().min(1),
})

export const AtomicClaimSchema = z.object({
  // WHO
  subjectType: SubjectTypeSchema,
  subjectQualifiers: z.array(z.string()).default([]),

  // WHEN
  triggerExpr: z.string().nullable().default(null),
  temporalExpr: z.string().nullable().default(null),
  jurisdiction: z.string().default("HR"),

  // WHAT
  assertionType: AssertionTypeSchema,
  logicExpr: z.string().min(1),
  value: z.string().nullable().default(null),
  valueType: z.string().nullable().default(null),

  // Extensibility
  parameters: z.record(z.unknown()).nullable().default(null),

  // Provenance
  exactQuote: z.string().min(1),
  articleNumber: z.string().nullable().default(null),
  lawReference: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.8),

  // Exceptions
  exceptions: z.array(ClaimExceptionSchema).default([]),
})

export type AtomicClaim = z.infer<typeof AtomicClaimSchema>
export type ClaimException = z.infer<typeof ClaimExceptionSchema>
export type SubjectType = z.infer<typeof SubjectTypeSchema>
export type AssertionType = z.infer<typeof AssertionTypeSchema>
```

**Step 2: Create process.ts**

```typescript
// src/lib/regulatory-truth/schemas/process.ts
import { z } from "zod"

export const ProcessTypeSchema = z.enum([
  "REGISTRATION",
  "FILING",
  "APPEAL",
  "CLOSURE",
  "AMENDMENT",
  "INQUIRY",
])

export const ProcessStepSchema = z.object({
  orderNum: z.number().int().min(1),
  actionHr: z.string().min(1),
  actionEn: z.string().nullable().default(null),
  requiresStepIds: z.array(z.string()).default([]),
  requiresAssets: z.array(z.string()).default([]),
  onSuccessStepId: z.string().nullable().default(null),
  onFailureStepId: z.string().nullable().default(null),
  failureAction: z.string().nullable().default(null),
})

export const RegulatoryProcessSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  titleHr: z.string().min(1),
  titleEn: z.string().nullable().default(null),
  jurisdiction: z.string().default("HR"),
  processType: ProcessTypeSchema,
  estimatedTime: z.string().nullable().default(null),
  prerequisites: z.record(z.unknown()).nullable().default(null),
  steps: z.array(ProcessStepSchema).min(1),
})

export type RegulatoryProcess = z.infer<typeof RegulatoryProcessSchema>
export type ProcessStep = z.infer<typeof ProcessStepSchema>
export type ProcessType = z.infer<typeof ProcessTypeSchema>
```

**Step 3: Create reference.ts**

```typescript
// src/lib/regulatory-truth/schemas/reference.ts
import { z } from "zod"

export const ReferenceCategorySchema = z.enum([
  "IBAN",
  "CN_CODE",
  "TAX_OFFICE",
  "INTEREST_RATE",
  "EXCHANGE_RATE",
  "FORM_CODE",
  "DEADLINE_CALENDAR",
])

export const ReferenceEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  metadata: z.record(z.unknown()).nullable().default(null),
})

export const ReferenceTableSchema = z.object({
  category: ReferenceCategorySchema,
  name: z.string().min(1),
  jurisdiction: z.string().default("HR"),
  keyColumn: z.string().min(1),
  valueColumn: z.string().min(1),
  entries: z.array(ReferenceEntrySchema).min(1),
  sourceUrl: z.string().url().nullable().default(null),
})

export type ReferenceTable = z.infer<typeof ReferenceTableSchema>
export type ReferenceEntry = z.infer<typeof ReferenceEntrySchema>
export type ReferenceCategory = z.infer<typeof ReferenceCategorySchema>
```

**Step 4: Create asset.ts**

```typescript
// src/lib/regulatory-truth/schemas/asset.ts
import { z } from "zod"

export const AssetFormatSchema = z.enum(["PDF", "XML", "XLS", "XLSX", "DOC", "DOCX", "HTML"])

export const AssetTypeSchema = z.enum([
  "FORM",
  "TEMPLATE",
  "GUIDE",
  "INSTRUCTION",
  "REGULATION_TEXT",
])

export const RegulatoryAssetSchema = z.object({
  formCode: z.string().nullable().default(null),
  officialName: z.string().min(1),
  description: z.string().nullable().default(null),
  downloadUrl: z.string().url(),
  format: AssetFormatSchema,
  fileSize: z.number().int().positive().nullable().default(null),
  assetType: AssetTypeSchema,
  stepNumber: z.number().int().positive().nullable().default(null),
  validFrom: z.string().datetime().nullable().default(null),
  validUntil: z.string().datetime().nullable().default(null),
  version: z.string().nullable().default(null),
  sourceUrl: z.string().url(),
})

export type RegulatoryAsset = z.infer<typeof RegulatoryAssetSchema>
export type AssetFormat = z.infer<typeof AssetFormatSchema>
export type AssetType = z.infer<typeof AssetTypeSchema>
```

**Step 5: Create transitional.ts**

```typescript
// src/lib/regulatory-truth/schemas/transitional.ts
import { z } from "zod"

export const TransitionPatternSchema = z.enum([
  "INVOICE_DATE",
  "DELIVERY_DATE",
  "PAYMENT_DATE",
  "EARLIER_EVENT",
  "LATER_EVENT",
  "TAXPAYER_CHOICE",
])

export const TransitionalProvisionSchema = z.object({
  fromRule: z.string().min(1),
  toRule: z.string().min(1),
  cutoffDate: z.string().datetime(),
  logicExpr: z.string().min(1),
  appliesRule: z.string().min(1),
  explanationHr: z.string().min(1),
  explanationEn: z.string().nullable().default(null),
  pattern: TransitionPatternSchema,
  sourceArticle: z.string().min(1),
})

export type TransitionalProvision = z.infer<typeof TransitionalProvisionSchema>
export type TransitionPattern = z.infer<typeof TransitionPatternSchema>
```

**Step 6: Update index.ts**

Add to `src/lib/regulatory-truth/schemas/index.ts`:

```typescript
// Add these exports
export * from "./atomic-claim"
export * from "./process"
export * from "./reference"
export * from "./asset"
export * from "./transitional"
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/lib/regulatory-truth/schemas/
git commit -m "feat(schemas): add Zod schemas for all 7 knowledge shapes"
```

---

## Task 10: Write Schema Tests

**Files:**

- Create: `src/lib/regulatory-truth/schemas/__tests__/knowledge-shapes.test.ts`

**Step 1: Write tests for all schemas**

```typescript
// src/lib/regulatory-truth/schemas/__tests__/knowledge-shapes.test.ts
import { describe, it, expect } from "vitest"
import {
  AtomicClaimSchema,
  RegulatoryProcessSchema,
  ReferenceTableSchema,
  RegulatoryAssetSchema,
  TransitionalProvisionSchema,
} from "../index"

describe("AtomicClaimSchema", () => {
  it("validates a complete atomic claim", () => {
    const claim = {
      subjectType: "TAXPAYER",
      subjectQualifiers: ["pausalni-obrt"],
      triggerExpr: "sales > 10000 EUR",
      temporalExpr: "per_calendar_year",
      jurisdiction: "HR",
      assertionType: "OBLIGATION",
      logicExpr: "tax_place = destination",
      value: "10000",
      valueType: "currency_eur",
      exactQuote: "Prag u iznosu od 10.000,00 eura...",
      articleNumber: "58",
      lawReference: "Zakon o PDV-u",
      confidence: 0.9,
      exceptions: [
        {
          condition: "sales <= 10000 EUR",
          overridesTo: "origin-taxation",
          sourceArticle: "Art 58(1)",
        },
      ],
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(true)
  })

  it("requires exactQuote", () => {
    const claim = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "must_pay = true",
      // missing exactQuote
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(false)
  })
})

describe("RegulatoryProcessSchema", () => {
  it("validates a process with steps", () => {
    const process = {
      slug: "oss-registration",
      titleHr: "Registracija za OSS",
      processType: "REGISTRATION",
      steps: [
        {
          orderNum: 1,
          actionHr: "Prijavite se na ePorezna",
        },
        {
          orderNum: 2,
          actionHr: "Ispunite obrazac OSS-1",
          requiresStepIds: [],
        },
      ],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(true)
  })

  it("requires at least one step", () => {
    const process = {
      slug: "empty-process",
      titleHr: "Prazan postupak",
      processType: "FILING",
      steps: [],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(false)
  })
})

describe("ReferenceTableSchema", () => {
  it("validates an IBAN reference table", () => {
    const table = {
      category: "IBAN",
      name: "Uplatni računi porezne uprave",
      keyColumn: "city",
      valueColumn: "iban",
      entries: [
        { key: "Zagreb", value: "HR1234567890123456789" },
        { key: "Split", value: "HR9876543210987654321" },
      ],
    }

    const result = ReferenceTableSchema.safeParse(table)
    expect(result.success).toBe(true)
  })
})

describe("RegulatoryAssetSchema", () => {
  it("validates a form asset", () => {
    const asset = {
      formCode: "PDV-P",
      officialName: "Prijava poreza na dodanu vrijednost",
      downloadUrl: "https://porezna.gov.hr/forms/pdv-p.pdf",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://porezna.gov.hr/forms",
    }

    const result = RegulatoryAssetSchema.safeParse(asset)
    expect(result.success).toBe(true)
  })
})

describe("TransitionalProvisionSchema", () => {
  it("validates a transitional provision", () => {
    const provision = {
      fromRule: "vat-rate-25-old",
      toRule: "vat-rate-25-new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "IF invoice_date < cutoff AND delivery_date >= cutoff",
      appliesRule: "vat-rate-25-new",
      explanationHr: "Za račune izdane prije 1.1.2025. primjenjuje se stara stopa...",
      pattern: "DELIVERY_DATE",
      sourceArticle: "Čl. 45 Prijelazne odredbe",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(true)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/regulatory-truth/schemas/__tests__/knowledge-shapes.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/schemas/__tests__/
git commit -m "test(schemas): add tests for knowledge shapes schemas"
```

---

## Phase 1 Complete

**Summary of changes:**

- 8 new enums added to Prisma schema
- 8 new models: AtomicClaim, ClaimException, ConceptNode, RegulatoryProcess, ProcessStep, ReferenceTable, ReferenceEntry, RegulatoryAsset, TransitionalProvision
- Relations added to Evidence model
- OVERRIDES added to GraphEdgeType
- 5 new Zod schema files
- Test coverage for all schemas

**Next Phase:** Phase 2 - Multi-Shape Extraction (create extractors for each knowledge shape)
