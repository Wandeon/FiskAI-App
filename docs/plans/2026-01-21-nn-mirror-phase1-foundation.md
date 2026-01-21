# NN Mirror Phase 1: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish canonical parsed layer with schema migrations and basic HTML parser for Narodne Novine documents.

**Architecture:** ParsedDocument records parse attempts with version tracking. ProvisionNode stores tree structure with offset-anchored spans. Parser validates invariants (unique paths, offset consistency, no sibling overlap).

**Tech Stack:** Prisma 7 (migrations), TypeScript (parser), Vitest (tests)

**Reference:** `docs/specs/nn-mirror-v1.md`

---

## Part A: App Repository (Schema & Migrations)

### Task A1: Add ParseStatus and ProvisionNodeType Enums

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Write the enum definitions**

Add after existing enums:

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
```

**Step 2: Run prisma format to validate**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ParseStatus, ProvisionNodeType, OffsetUnit enums

Part of NN Mirror Phase 1 - canonical parsed layer foundation.
Spec: docs/specs/nn-mirror-v1.md Section 2.1

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A2: Add ParsedDocument Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the ParsedDocument model**

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
  evidence            Evidence    @relation(fields: [evidenceId], references: [id])
  cleanTextArtifact   EvidenceArtifact? @relation("ParsedDocCleanText", fields: [cleanTextArtifactId], references: [id])
  nodes               ProvisionNode[]
  supersedes          ParsedDocument? @relation("ParseSupersession", fields: [supersedesId], references: [id])
  supersededBy        ParsedDocument? @relation("ParseSupersession")

  @@unique([evidenceId, parserId, parserVersion, parseConfigHash])
  @@index([evidenceId])
  @@index([evidenceId, parserId, isLatest])
  @@index([parserId, status, createdAt])
  @@index([status])
}
```

**Step 2: Add relation to Evidence model**

Find the Evidence model and add:

```prisma
  parsedDocuments     ParsedDocument[]
```

**Step 3: Add relation to EvidenceArtifact model**

Find EvidenceArtifact model and add:

```prisma
  parsedDocCleanText  ParsedDocument[] @relation("ParsedDocCleanText")
```

**Step 4: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ParsedDocument model for canonical parse layer

Tracks parser versions, config hashes, and supersession chain.
Supports drift detection via cleanTextHash comparison.
Spec: docs/specs/nn-mirror-v1.md Section 2.4

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A3: Add ProvisionNode Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the ProvisionNode model**

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
  parsedDocument    ParsedDocument    @relation(fields: [parsedDocumentId], references: [id], onDelete: Cascade)
  parent            ProvisionNode?    @relation("NodeTree", fields: [parentId], references: [id])
  children          ProvisionNode[]   @relation("NodeTree")

  @@unique([parsedDocumentId, nodePath])
  @@index([parsedDocumentId, parentId, orderIndex])
  @@index([parsedDocumentId, nodeType])
  @@index([parsedDocumentId, startOffset])
}
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ProvisionNode model for provision tree structure

Offset-anchored spans with stable nodePath derived from numbering.
Supports container vs content node semantics.
Spec: docs/specs/nn-mirror-v1.md Section 2.5

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A4: Add ArtifactKind Enum Values

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Check if ArtifactKind enum exists and update**

If ArtifactKind enum exists, ensure it has these values:

```prisma
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
```

If it doesn't exist, add it.

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add/update ArtifactKind enum for parsed artifacts

Supports HTML_CLEANED for parser input layer.
Spec: docs/specs/nn-mirror-v1.md Section 2.1

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A5: Add Evidence.sourceKey Field

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add sourceKey to Evidence model**

Find the Evidence model and add the sourceKey field after sourceId:

```prisma
  // Stable identity (survives URL format changes)
  sourceKey           String?   // "nn:item:2024:152:2505" or ELI
```

Also add the index:

```prisma
  @@index([sourceKey])
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Evidence.sourceKey for stable identity

Survives URL format changes, enables idempotent fetch deduplication.
Spec: docs/specs/nn-mirror-v1.md Section 2.2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A6: Generate and Run Migration

**Files:**

- Create: `prisma/migrations/YYYYMMDDHHMMSS_nn_mirror_phase1/migration.sql` (auto-generated)

**Step 1: Generate the migration**

Run: `npx prisma migrate dev --name nn_mirror_phase1 --create-only`
Expected: Migration file created in `prisma/migrations/`

**Step 2: Review the generated SQL**

Read the generated migration file and verify:

- Enums are created: ParseStatus, ProvisionNodeType, OffsetUnit
- Tables created: ParsedDocument, ProvisionNode
- All indexes present
- Foreign keys with correct cascade rules

**Step 3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: Migration applied successfully

**Step 4: Generate Prisma client**

Run: `npx prisma generate`
Expected: Client regenerated with new types

**Step 5: Commit**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat(db): apply nn_mirror_phase1 migration

Creates ParsedDocument and ProvisionNode tables with indexes.
Adds ParseStatus, ProvisionNodeType, OffsetUnit enums.
Spec: docs/specs/nn-mirror-v1.md

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A7: Add ReparseJob Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the ReparseJob model**

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

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: No errors

**Step 3: Generate and apply migration**

Run: `npx prisma migrate dev --name add_reparse_job`
Expected: Migration applied

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add ReparseJob model for reprocessing queue

Tracks reparse requests with priority and status.
Spec: docs/specs/nn-mirror-v1.md Section 2.10

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Part B: Workers Repository (Parser Implementation)

### Task B1: Create Parser Types and Interfaces

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/types.ts`

**Step 1: Write the failing test**

Create: `src/lib/regulatory-truth/nn-parser/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import type {
  ParseInput,
  ParseOutput,
  NodeOutput,
  Warning,
  UnparsedSegment,
  NNParserContract,
} from "../types"
import { ProvisionNodeType, ParseStatus, OffsetUnit } from "@prisma/client"

describe("Parser Types", () => {
  it("ParseInput has required fields", () => {
    const input: ParseInput = {
      evidenceId: "test-123",
      contentClass: "HTML",
      artifact: {
        id: "artifact-123",
        kind: "HTML_RAW",
        content: "<html>test</html>",
        contentHash: "abc123",
      },
    }
    expect(input.evidenceId).toBe("test-123")
  })

  it("NodeOutput enforces required fields", () => {
    const node: NodeOutput = {
      nodeType: ProvisionNodeType.CLANAK,
      nodePath: "/članak:1",
      orderIndex: 0,
      depth: 1,
      startOffset: 0,
      endOffset: 100,
      isContainer: false,
    }
    expect(node.nodePath).toBe("/članak:1")
  })

  it("Warning has proper structure", () => {
    const warning: Warning = {
      code: "MISSING_ARTICLE_NUMBER",
      message: "Article has no number",
    }
    expect(warning.code).toBe("MISSING_ARTICLE_NUMBER")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

**Step 3: Write the types file**

Create: `src/lib/regulatory-truth/nn-parser/types.ts`

```typescript
import { ProvisionNodeType, ParseStatus, OffsetUnit, ArtifactKind } from "@prisma/client"

/**
 * Parser contract as defined in nn-mirror-v1.md Section 4.1
 */
export interface NNParserContract {
  parserId: string
  parserVersion: string
  parseConfigHash: string
  supportedContentClasses: ContentClass[]
  parse(input: ParseInput): Promise<ParseOutput>
}

export type ContentClass = "HTML" | "PDF_TEXT" | "PDF_SCANNED"

export interface ParseInput {
  evidenceId: string
  contentClass: ContentClass
  artifact: {
    id: string
    kind: ArtifactKind | string // Allow string for flexibility
    content: string
    contentHash: string
  }
}

export interface ParseOutput {
  status: "SUCCESS" | "PARTIAL" | "FAILED"
  errorMessage?: string

  warnings: Warning[]
  unparsedSegments: UnparsedSegment[]

  docMeta: DocumentMetadata

  cleanText: string
  cleanTextHash: string

  nodes: NodeOutput[]

  stats: ParseStats
}

export interface Warning {
  code: string // MISSING_ARTICLE_NUMBER, AMBIGUOUS_STRUCTURE, etc.
  message: string
  nodePath?: string
  offsets?: { start: number; end: number }
}

export interface UnparsedSegment {
  startOffset: number
  endOffset: number
  rawText: string // First 200 chars
  reason: string // NO_STRUCTURE_MARKERS, NESTED_TABLE, etc.
}

export interface DocumentMetadata {
  eli?: string
  nnYear?: number
  nnIssue?: number
  nnItem?: number
  title?: string
  textType?: string // "zakon", "pravilnik", "uredba", etc.
  publishedAt?: Date
  effectiveFrom?: Date
}

export interface NodeOutput {
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

export interface ParseStats {
  nodeCount: number
  maxDepth: number
  byType: Partial<Record<ProvisionNodeType, number>>
  coverageChars: number
  coveragePercent: number
}

// Invariant validation result
export interface InvariantCheckResult {
  passed: boolean
  violations: InvariantViolation[]
}

export interface InvariantViolation {
  invariantId: string // PARSE-INV-001, etc.
  message: string
  nodePath?: string
  details?: Record<string, unknown>
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): add parser types and interfaces

Implements contract from nn-mirror-v1.md Section 4.1.
Includes ParseInput, ParseOutput, NodeOutput, Warning types.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B2: Implement HTML Cleaner Utility

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/html-cleaner.ts`
- Create: `src/lib/regulatory-truth/nn-parser/__tests__/html-cleaner.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { cleanHtml, extractText } from "../html-cleaner"

describe("HTML Cleaner", () => {
  describe("cleanHtml", () => {
    it("removes script and style tags", () => {
      const html =
        "<html><head><script>alert(1)</script><style>body{}</style></head><body>Content</body></html>"
      const result = cleanHtml(html)
      expect(result).not.toContain("<script>")
      expect(result).not.toContain("<style>")
      expect(result).toContain("Content")
    })

    it("normalizes whitespace", () => {
      const html = "<p>Hello     World</p>"
      const result = cleanHtml(html)
      expect(result).toContain("Hello World")
    })

    it("preserves article structure markers", () => {
      const html = "<p>Članak 1.</p><p>(1) First paragraph</p>"
      const result = cleanHtml(html)
      expect(result).toContain("Članak 1.")
      expect(result).toContain("(1)")
    })
  })

  describe("extractText", () => {
    it("extracts plain text from HTML", () => {
      const html = "<p>Hello <b>World</b></p>"
      const result = extractText(html)
      expect(result).toBe("Hello World")
    })

    it("handles line breaks correctly", () => {
      const html = "<p>Line 1</p><p>Line 2</p>"
      const result = extractText(html)
      expect(result).toContain("Line 1")
      expect(result).toContain("Line 2")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/html-cleaner.test.ts`
Expected: FAIL with "Cannot find module '../html-cleaner'"

**Step 3: Write the implementation**

```typescript
import * as cheerio from "cheerio"

/**
 * Clean HTML for parsing - removes scripts, styles, normalizes whitespace
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false })

  // Remove unwanted elements
  $("script, style, noscript, iframe, object, embed").remove()

  // Remove comments
  $("*")
    .contents()
    .filter(function () {
      return this.type === "comment"
    })
    .remove()

  // Normalize whitespace in text nodes (but preserve structure)
  $("*")
    .contents()
    .filter(function () {
      return this.type === "text"
    })
    .each(function () {
      const text = $(this).text()
      const normalized = text.replace(/[ \t]+/g, " ")
      $(this).replaceWith(normalized)
    })

  return $.html()
}

/**
 * Extract plain text from HTML, preserving line structure
 */
export function extractText(html: string): string {
  const $ = cheerio.load(html)

  // Replace block elements with newlines
  $("p, div, br, h1, h2, h3, h4, h5, h6, li, tr").each(function () {
    $(this).append("\n")
  })

  // Get text and normalize
  let text = $.text()

  // Normalize whitespace
  text = text
    .replace(/[ \t]+/g, " ") // Multiple spaces to single
    .replace(/\n[ \t]+/g, "\n") // Trim line starts
    .replace(/[ \t]+\n/g, "\n") // Trim line ends
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .trim()

  return text
}

/**
 * Extract clean text while tracking character offsets
 * Returns the clean text and a mapping from clean positions to original HTML positions
 */
export interface TextWithOffsets {
  cleanText: string
  // Map from clean text position to original HTML position (for provenance)
  offsetMap?: Map<number, number>
}

export function extractTextWithOffsets(html: string): TextWithOffsets {
  // For v1, we don't need offset mapping - just extract clean text
  // Offset mapping can be added in v2 if needed for HTML anchor linking
  return {
    cleanText: extractText(html),
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/html-cleaner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): add HTML cleaner utility

Removes scripts/styles, normalizes whitespace, extracts plain text.
Foundation for clean text layer required by parser.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B3: Implement NodePath Builder

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/node-path.ts`
- Create: `src/lib/regulatory-truth/nn-parser/__tests__/node-path.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { buildNodePath, parseArticleNumber, parseStavakNumber, parseTockaLabel } from "../node-path"

describe("NodePath Builder", () => {
  describe("parseArticleNumber", () => {
    it('parses "Članak 1."', () => {
      expect(parseArticleNumber("Članak 1.")).toBe("1")
    })

    it('parses "Članak 28."', () => {
      expect(parseArticleNumber("Članak 28.")).toBe("28")
    })

    it('parses "Članak 1.a"', () => {
      expect(parseArticleNumber("Članak 1.a")).toBe("1a")
    })

    it("returns null for non-article text", () => {
      expect(parseArticleNumber("Some text")).toBeNull()
    })
  })

  describe("parseStavakNumber", () => {
    it('parses "(1)"', () => {
      expect(parseStavakNumber("(1) Text here")).toBe("1")
    })

    it('parses "(15)"', () => {
      expect(parseStavakNumber("(15) More text")).toBe("15")
    })

    it("returns null for non-stavak text", () => {
      expect(parseStavakNumber("Plain text")).toBeNull()
    })
  })

  describe("parseTockaLabel", () => {
    it('parses "a)"', () => {
      expect(parseTockaLabel("a) First item")).toBe("a")
    })

    it('parses "1."', () => {
      expect(parseTockaLabel("1. First item")).toBe("1")
    })

    it('parses "–" bullet', () => {
      expect(parseTockaLabel("– Item text")).toBe("bullet")
    })
  })

  describe("buildNodePath", () => {
    it("builds article path", () => {
      expect(buildNodePath({ article: "28" })).toBe("/članak:28")
    })

    it("builds article + stavak path", () => {
      expect(buildNodePath({ article: "28", stavak: "1" })).toBe("/članak:28/stavak:1")
    })

    it("builds full nested path", () => {
      expect(
        buildNodePath({
          article: "28",
          stavak: "1",
          tocka: "a",
          podtocka: "1",
        })
      ).toBe("/članak:28/stavak:1/točka:a/podtočka:1")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/node-path.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
/**
 * NodePath builder - creates stable paths from numbering tokens
 *
 * Format: /članak:N/stavak:N/točka:X/podtočka:N/alineja:N
 *
 * PARSE-INV-002: nodePath derived from numbering tokens, not content
 */

export interface NodePathComponents {
  doc?: string // Root document (optional, usually omitted)
  glava?: string // Chapter (Glava)
  dio?: string // Part (Dio)
  title?: string // Section title (Naslov)
  article?: string // Article number (Članak)
  stavak?: string // Paragraph number (Stavak)
  tocka?: string // Point (Točka)
  podtocka?: string // Subpoint (Podtočka)
  alineja?: string // Bullet (Alineja)
  prilog?: string // Annex (Prilog)
}

/**
 * Parse article number from text like "Članak 28." or "Članak 1.a"
 */
export function parseArticleNumber(text: string): string | null {
  // Match: "Članak" + space + number + optional letter + period
  const match = text.match(/Članak\s+(\d+\.?[a-z]?)\.?/i)
  if (!match) return null

  // Clean up: remove trailing dot, keep letter suffix
  return match[1].replace(/\.$/, "")
}

/**
 * Parse stavak (paragraph) number from text like "(1)" at start
 */
export function parseStavakNumber(text: string): string | null {
  // Match: opening paren + number + closing paren at start of text
  const match = text.match(/^\s*\((\d+)\)/)
  if (!match) return null
  return match[1]
}

/**
 * Parse točka (point) label from text like "a)", "1.", "–"
 */
export function parseTockaLabel(text: string): string | null {
  const trimmed = text.trim()

  // Letter with closing paren: "a)", "b)", etc.
  const letterMatch = trimmed.match(/^([a-z])\)/i)
  if (letterMatch) return letterMatch[1].toLowerCase()

  // Number with period: "1.", "2.", etc.
  const numMatch = trimmed.match(/^(\d+)\./)
  if (numMatch) return numMatch[1]

  // Bullet characters: "–", "-", "•"
  if (/^[–\-•]/.test(trimmed)) return "bullet"

  return null
}

/**
 * Parse podtočka (subpoint) label
 */
export function parsePodtockaLabel(text: string): string | null {
  // Typically nested numbers or double letters
  const match = text.trim().match(/^(\d+)\)/)
  if (match) return match[1]

  const doubleMatch = text.trim().match(/^([a-z]{2})\)/i)
  if (doubleMatch) return doubleMatch[1].toLowerCase()

  return null
}

/**
 * Build a nodePath from components
 * PARSE-INV-002: Path derived from numbering, stable across content changes
 */
export function buildNodePath(components: NodePathComponents): string {
  const parts: string[] = []

  // Build path in hierarchical order
  if (components.dio) parts.push(`dio:${components.dio}`)
  if (components.glava) parts.push(`glava:${components.glava}`)
  if (components.title) parts.push(`naslov:${components.title}`)
  if (components.prilog) parts.push(`prilog:${components.prilog}`)
  if (components.article) parts.push(`članak:${components.article}`)
  if (components.stavak) parts.push(`stavak:${components.stavak}`)
  if (components.tocka) parts.push(`točka:${components.tocka}`)
  if (components.podtocka) parts.push(`podtočka:${components.podtocka}`)
  if (components.alineja) parts.push(`alineja:${components.alineja}`)

  return "/" + parts.join("/")
}

/**
 * Get parent path from a nodePath
 */
export function getParentPath(nodePath: string): string | null {
  const parts = nodePath.split("/").filter(Boolean)
  if (parts.length <= 1) return null
  return "/" + parts.slice(0, -1).join("/")
}

/**
 * Get the depth of a nodePath (number of components)
 */
export function getNodeDepth(nodePath: string): number {
  return nodePath.split("/").filter(Boolean).length
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/node-path.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): add NodePath builder for stable paths

Parses Croatian legal numbering: Članak, Stavak, Točka, Podtočka.
Implements PARSE-INV-002: paths from numbering tokens, not content.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B4: Implement Invariant Validator

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/invariants.ts`
- Create: `src/lib/regulatory-truth/nn-parser/__tests__/invariants.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { validateInvariants } from "../invariants"
import type { ParseOutput, NodeOutput } from "../types"
import { ProvisionNodeType } from "@prisma/client"

describe("Invariant Validator", () => {
  const makeNode = (overrides: Partial<NodeOutput>): NodeOutput => ({
    nodeType: ProvisionNodeType.CLANAK,
    nodePath: "/članak:1",
    orderIndex: 0,
    depth: 1,
    startOffset: 0,
    endOffset: 100,
    isContainer: false,
    ...overrides,
  })

  describe("PARSE-INV-001: unique nodePath", () => {
    it("passes with unique paths", () => {
      const nodes: NodeOutput[] = [
        makeNode({ nodePath: "/članak:1" }),
        makeNode({ nodePath: "/članak:2" }),
      ]
      const result = validateInvariants(nodes, "test content")
      expect(result.passed).toBe(true)
    })

    it("fails with duplicate paths", () => {
      const nodes: NodeOutput[] = [
        makeNode({ nodePath: "/članak:1" }),
        makeNode({ nodePath: "/članak:1" }), // Duplicate
      ]
      const result = validateInvariants(nodes, "test content")
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-001")).toBe(true)
    })
  })

  describe("PARSE-INV-003: offset validity", () => {
    it("passes with valid offsets", () => {
      const content = "Hello World"
      const nodes: NodeOutput[] = [makeNode({ startOffset: 0, endOffset: 5, rawText: "Hello" })]
      const result = validateInvariants(nodes, content)
      expect(result.passed).toBe(true)
    })

    it("fails when substring does not match rawText", () => {
      const content = "Hello World"
      const nodes: NodeOutput[] = [makeNode({ startOffset: 0, endOffset: 5, rawText: "Wrong" })]
      const result = validateInvariants(nodes, content)
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-003")).toBe(true)
    })
  })

  describe("PARSE-INV-007: no sibling overlap for content nodes", () => {
    it("passes with non-overlapping siblings", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 10,
          isContainer: false,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:2",
          startOffset: 10,
          endOffset: 20,
          isContainer: false,
        }),
      ]
      const result = validateInvariants(nodes, "test content here for validation")
      expect(result.passed).toBe(true)
    })

    it("fails with overlapping content siblings", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 15,
          isContainer: false,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:2",
          startOffset: 10,
          endOffset: 20,
          isContainer: false,
        }),
      ]
      const result = validateInvariants(nodes, "test content here for validation")
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-007")).toBe(true)
    })

    it("allows container node overlap", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1",
          startOffset: 0,
          endOffset: 100,
          isContainer: true,
          nodeType: ProvisionNodeType.CLANAK,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 50,
          isContainer: false,
        }),
      ]
      const result = validateInvariants(nodes, "test ".repeat(20))
      expect(result.passed).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/invariants.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
import type { NodeOutput, InvariantCheckResult, InvariantViolation } from "./types"
import { getParentPath } from "./node-path"

/**
 * Validate parser output against invariants from nn-mirror-v1.md Section 4.2
 */
export function validateInvariants(nodes: NodeOutput[], cleanText: string): InvariantCheckResult {
  const violations: InvariantViolation[] = []

  // PARSE-INV-001: nodePath unique within ParsedDocument
  checkUniqueNodePaths(nodes, violations)

  // PARSE-INV-003: cleanText.substring(startOffset, endOffset) reconstructs node text
  checkOffsetConsistency(nodes, cleanText, violations)

  // PARSE-INV-004: Child offsets within parent offsets (for content nodes)
  checkChildWithinParent(nodes, violations)

  // PARSE-INV-005: Sibling orderIndex values unique and sequential
  checkSiblingOrder(nodes, violations)

  // PARSE-INV-007: Content node siblings must not overlap
  checkNoSiblingOverlap(nodes, violations)

  return {
    passed: violations.length === 0,
    violations,
  }
}

/**
 * PARSE-INV-001: nodePath unique within document
 */
function checkUniqueNodePaths(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  const seen = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.nodePath)) {
      violations.push({
        invariantId: "PARSE-INV-001",
        message: `Duplicate nodePath: ${node.nodePath}`,
        nodePath: node.nodePath,
      })
    }
    seen.add(node.nodePath)
  }
}

/**
 * PARSE-INV-003: Offset extraction must match rawText
 */
function checkOffsetConsistency(
  nodes: NodeOutput[],
  cleanText: string,
  violations: InvariantViolation[]
): void {
  for (const node of nodes) {
    // Only check nodes that have rawText stored
    if (!node.rawText) continue

    const extracted = cleanText.substring(node.startOffset, node.endOffset)
    if (extracted !== node.rawText) {
      violations.push({
        invariantId: "PARSE-INV-003",
        message: `Offset extraction mismatch at ${node.nodePath}`,
        nodePath: node.nodePath,
        details: {
          expected: node.rawText.substring(0, 50),
          actual: extracted.substring(0, 50),
          startOffset: node.startOffset,
          endOffset: node.endOffset,
        },
      })
    }
  }
}

/**
 * PARSE-INV-004: Child offsets within parent offsets
 */
function checkChildWithinParent(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  const nodeByPath = new Map(nodes.map((n) => [n.nodePath, n]))

  for (const node of nodes) {
    const parentPath = getParentPath(node.nodePath)
    if (!parentPath) continue

    const parent = nodeByPath.get(parentPath)
    if (!parent) continue // Parent might be implied

    // Only enforce for content nodes
    if (node.isContainer) continue

    if (node.startOffset < parent.startOffset || node.endOffset > parent.endOffset) {
      violations.push({
        invariantId: "PARSE-INV-004",
        message: `Child ${node.nodePath} offsets outside parent ${parentPath}`,
        nodePath: node.nodePath,
        details: {
          childStart: node.startOffset,
          childEnd: node.endOffset,
          parentStart: parent.startOffset,
          parentEnd: parent.endOffset,
        },
      })
    }
  }
}

/**
 * PARSE-INV-005: Sibling orderIndex unique and sequential
 */
function checkSiblingOrder(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  // Group nodes by parent path
  const siblingGroups = new Map<string, NodeOutput[]>()

  for (const node of nodes) {
    const parentPath = getParentPath(node.nodePath) || "/"
    const siblings = siblingGroups.get(parentPath) || []
    siblings.push(node)
    siblingGroups.set(parentPath, siblings)
  }

  for (const [parentPath, siblings] of siblingGroups) {
    const indices = siblings.map((s) => s.orderIndex).sort((a, b) => a - b)
    const seenIndices = new Set<number>()

    for (let i = 0; i < indices.length; i++) {
      if (seenIndices.has(indices[i])) {
        violations.push({
          invariantId: "PARSE-INV-005",
          message: `Duplicate orderIndex ${indices[i]} among siblings of ${parentPath}`,
          nodePath: parentPath,
          details: { indices },
        })
        break
      }
      seenIndices.add(indices[i])
    }
  }
}

/**
 * PARSE-INV-007: Content node siblings must not overlap
 */
function checkNoSiblingOverlap(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  // Group content nodes by parent path
  const siblingGroups = new Map<string, NodeOutput[]>()

  for (const node of nodes) {
    // Only check content nodes (non-containers)
    if (node.isContainer) continue

    const parentPath = getParentPath(node.nodePath) || "/"
    const siblings = siblingGroups.get(parentPath) || []
    siblings.push(node)
    siblingGroups.set(parentPath, siblings)
  }

  for (const [parentPath, siblings] of siblingGroups) {
    // Sort by startOffset
    const sorted = [...siblings].sort((a, b) => a.startOffset - b.startOffset)

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (current.endOffset > next.startOffset) {
        violations.push({
          invariantId: "PARSE-INV-007",
          message: `Overlapping siblings: ${current.nodePath} and ${next.nodePath}`,
          nodePath: current.nodePath,
          details: {
            first: { path: current.nodePath, start: current.startOffset, end: current.endOffset },
            second: { path: next.nodePath, start: next.startOffset, end: next.endOffset },
          },
        })
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/invariants.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): add invariant validator

Validates PARSE-INV-001 through PARSE-INV-007 from spec.
Checks unique paths, offset consistency, sibling order, no overlap.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B5: Implement Core HTML Parser

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/html-parser.ts`
- Create: `src/lib/regulatory-truth/nn-parser/__tests__/html-parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { parseHtml } from "../html-parser"
import { ProvisionNodeType } from "@prisma/client"

describe("HTML Parser", () => {
  it("parses simple article structure", () => {
    const html = `
      <html><body>
        <p class="clanak">Članak 1.</p>
        <p>This is the content of article 1.</p>
        <p class="clanak">Članak 2.</p>
        <p>(1) First paragraph of article 2.</p>
        <p>(2) Second paragraph of article 2.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.status).toBe("SUCCESS")
    expect(result.nodes.some((n) => n.nodePath === "/članak:1")).toBe(true)
    expect(result.nodes.some((n) => n.nodePath === "/članak:2")).toBe(true)
    expect(result.nodes.some((n) => n.nodePath === "/članak:2/stavak:1")).toBe(true)
  })

  it("extracts document metadata", () => {
    const html = `
      <html><head><title>Pravilnik o paušalnom oporezivanju</title></head>
      <body>
        <p class="clanak">Članak 1.</p>
        <p>Content here.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.docMeta.title).toContain("Pravilnik")
  })

  it("computes coverage stats", () => {
    const html = `
      <html><body>
        <p class="clanak">Članak 1.</p>
        <p>(1) Full paragraph content here.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.stats.nodeCount).toBeGreaterThan(0)
    expect(result.stats.coveragePercent).toBeGreaterThan(0)
  })

  it("validates invariants and reports issues", () => {
    const html = `<html><body><p>No structure here</p></body></html>`

    const result = parseHtml(html)

    // Should still succeed but with warnings about no articles found
    expect(["SUCCESS", "PARTIAL"]).toContain(result.status)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/html-parser.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
import * as cheerio from "cheerio"
import { createHash } from "crypto"
import { ProvisionNodeType } from "@prisma/client"
import type {
  ParseOutput,
  NodeOutput,
  DocumentMetadata,
  Warning,
  UnparsedSegment,
  ParseStats,
} from "./types"
import { extractText } from "./html-cleaner"
import {
  buildNodePath,
  parseArticleNumber,
  parseStavakNumber,
  parseTockaLabel,
  getNodeDepth,
} from "./node-path"
import { validateInvariants } from "./invariants"

// Container node types (can span children)
const CONTAINER_TYPES = new Set<ProvisionNodeType>([
  ProvisionNodeType.DOC,
  ProvisionNodeType.TITLE,
  ProvisionNodeType.CHAPTER,
  ProvisionNodeType.PART,
])

export function parseHtml(html: string): ParseOutput {
  const startTime = Date.now()
  const warnings: Warning[] = []
  const unparsedSegments: UnparsedSegment[] = []

  const $ = cheerio.load(html)

  // Extract clean text
  const cleanText = extractText(html)
  const cleanTextHash = createHash("sha256").update(cleanText).digest("hex")

  // Extract metadata
  const docMeta = extractMetadata($)

  // Parse nodes
  const nodes = parseNodes($, cleanText, warnings)

  // Validate invariants
  const validation = validateInvariants(nodes, cleanText)

  // Add validation violations as warnings
  for (const violation of validation.violations) {
    warnings.push({
      code: violation.invariantId,
      message: violation.message,
      nodePath: violation.nodePath,
    })
  }

  // Compute stats
  const stats = computeStats(nodes, cleanText.length)

  // Determine status
  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS"
  if (validation.violations.length > 0) {
    status = "PARTIAL"
  }
  if (nodes.length === 0) {
    status = "FAILED"
    warnings.push({
      code: "NO_STRUCTURE",
      message: "No parseable structure found in document",
    })
  }

  return {
    status,
    warnings,
    unparsedSegments,
    docMeta,
    cleanText,
    cleanTextHash,
    nodes,
    stats,
  }
}

function extractMetadata($: cheerio.CheerioAPI): DocumentMetadata {
  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    undefined

  // Try to determine text type from title
  let textType: string | undefined
  if (title) {
    const lowerTitle = title.toLowerCase()
    if (lowerTitle.includes("zakon")) textType = "zakon"
    else if (lowerTitle.includes("pravilnik")) textType = "pravilnik"
    else if (lowerTitle.includes("uredba")) textType = "uredba"
    else if (lowerTitle.includes("odluka")) textType = "odluka"
  }

  return { title, textType }
}

function parseNodes($: cheerio.CheerioAPI, cleanText: string, warnings: Warning[]): NodeOutput[] {
  const nodes: NodeOutput[] = []

  // State tracking
  let currentArticle: string | null = null
  let currentStavak: string | null = null
  let articleOrderIndex = 0
  let stavakOrderIndex = 0
  let tockaOrderIndex = 0

  // Find all text blocks
  const textBlocks = findTextBlocks($)

  for (const block of textBlocks) {
    const text = block.text.trim()
    if (!text) continue

    // Find position in cleanText
    const position = findTextPosition(cleanText, text, block.approximatePosition)
    if (position === null) {
      warnings.push({
        code: "TEXT_NOT_FOUND",
        message: `Could not locate text in clean output: "${text.substring(0, 50)}..."`,
      })
      continue
    }

    // Check if this is an article header
    const articleNum = parseArticleNumber(text)
    if (articleNum) {
      currentArticle = articleNum
      currentStavak = null
      stavakOrderIndex = 0
      tockaOrderIndex = 0

      nodes.push({
        nodeType: ProvisionNodeType.CLANAK,
        nodePath: buildNodePath({ article: articleNum }),
        label: `Članak ${articleNum}.`,
        orderIndex: articleOrderIndex++,
        depth: 1,
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText: text,
      })
      continue
    }

    // Check if this is a stavak
    const stavakNum = parseStavakNumber(text)
    if (stavakNum && currentArticle) {
      currentStavak = stavakNum
      tockaOrderIndex = 0

      nodes.push({
        nodeType: ProvisionNodeType.STAVAK,
        nodePath: buildNodePath({ article: currentArticle, stavak: stavakNum }),
        label: `(${stavakNum})`,
        orderIndex: stavakOrderIndex++,
        depth: 2,
        parentPath: buildNodePath({ article: currentArticle }),
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText: text,
      })
      continue
    }

    // Check if this is a točka
    const tockaLabel = parseTockaLabel(text)
    if (tockaLabel && currentArticle && currentStavak) {
      nodes.push({
        nodeType: ProvisionNodeType.TOCKA,
        nodePath: buildNodePath({
          article: currentArticle,
          stavak: currentStavak,
          tocka: tockaLabel,
        }),
        label: tockaLabel === "bullet" ? "–" : `${tockaLabel})`,
        orderIndex: tockaOrderIndex++,
        depth: 3,
        parentPath: buildNodePath({ article: currentArticle, stavak: currentStavak }),
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText: text,
      })
    }
  }

  return nodes
}

interface TextBlock {
  text: string
  approximatePosition: number
  selector?: string
}

function findTextBlocks($: cheerio.CheerioAPI): TextBlock[] {
  const blocks: TextBlock[] = []
  let position = 0

  // Find paragraph-like elements
  $("p, div.clanak, div.stavak, li, h1, h2, h3, h4, td").each((_, el) => {
    const text = $(el).text().trim()
    if (text) {
      blocks.push({
        text,
        approximatePosition: position,
        selector: generateSelector(el),
      })
      position += text.length + 1 // Approximate position tracking
    }
  })

  return blocks
}

function generateSelector(el: cheerio.Element): string {
  // Generate a CSS selector for the element (for future HTML anchor linking)
  const tagName = el.tagName?.toLowerCase() || "unknown"
  const id = el.attribs?.id
  const className = el.attribs?.class?.split(" ")[0]

  if (id) return `#${id}`
  if (className) return `${tagName}.${className}`
  return tagName
}

interface TextPosition {
  start: number
  end: number
}

function findTextPosition(
  cleanText: string,
  searchText: string,
  hint: number
): TextPosition | null {
  // Normalize for matching
  const normalizedSearch = searchText.replace(/\s+/g, " ").trim()
  const normalizedClean = cleanText.replace(/\s+/g, " ")

  // Try exact match first
  let index = normalizedClean.indexOf(normalizedSearch)
  if (index === -1) {
    // Try with more aggressive normalization
    const looseSearch = normalizedSearch.substring(0, Math.min(50, normalizedSearch.length))
    index = normalizedClean.indexOf(looseSearch)
  }

  if (index === -1) return null

  return {
    start: index,
    end: index + normalizedSearch.length,
  }
}

function computeStats(nodes: NodeOutput[], cleanTextLength: number): ParseStats {
  const byType: Partial<Record<ProvisionNodeType, number>> = {}
  let maxDepth = 0
  let coverageChars = 0

  // Track covered intervals for non-overlapping coverage
  const intervals: Array<{ start: number; end: number }> = []

  for (const node of nodes) {
    // Count by type
    byType[node.nodeType] = (byType[node.nodeType] || 0) + 1

    // Track max depth
    maxDepth = Math.max(maxDepth, node.depth)

    // Add to coverage (content nodes only)
    if (!node.isContainer) {
      intervals.push({ start: node.startOffset, end: node.endOffset })
    }
  }

  // Merge overlapping intervals for accurate coverage
  coverageChars = computeMergedCoverage(intervals)

  const coveragePercent = cleanTextLength > 0 ? (coverageChars / cleanTextLength) * 100 : 0

  return {
    nodeCount: nodes.length,
    maxDepth,
    byType,
    coverageChars,
    coveragePercent,
  }
}

function computeMergedCoverage(intervals: Array<{ start: number; end: number }>): number {
  if (intervals.length === 0) return 0

  // Sort by start
  const sorted = [...intervals].sort((a, b) => a.start - b.start)

  // Merge overlapping
  const merged: Array<{ start: number; end: number }> = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (current.start <= last.end) {
      // Overlapping - extend
      last.end = Math.max(last.end, current.end)
    } else {
      // Non-overlapping - add new
      merged.push(current)
    }
  }

  // Sum merged intervals
  return merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/html-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): implement core HTML parser

Parses Croatian legal structure: članak, stavak, točka.
Computes non-overlapping coverage with interval union.
Validates all invariants on parse output.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B6: Create Parser Entrypoint with Version Tracking

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/index.ts`
- Create: `src/lib/regulatory-truth/nn-parser/__tests__/index.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { NNParser, getParserVersion, getParserConfigHash } from "../index"

describe("NNParser", () => {
  describe("metadata", () => {
    it("has parserId", () => {
      expect(NNParser.parserId).toBe("nn-parser")
    })

    it("has parserVersion", () => {
      expect(NNParser.parserVersion).toMatch(/^\d+\.\d+\.\d+$|^[a-f0-9]{7,}$/)
    })

    it("has parseConfigHash", () => {
      expect(NNParser.parseConfigHash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe("parse", () => {
    it("parses HTML content", async () => {
      const result = await NNParser.parse({
        evidenceId: "test-123",
        contentClass: "HTML",
        artifact: {
          id: "artifact-123",
          kind: "HTML_RAW",
          content: '<html><body><p class="clanak">Članak 1.</p><p>Content</p></body></html>',
          contentHash: "abc123",
        },
      })

      expect(result.status).toBe("SUCCESS")
      expect(result.cleanText).toContain("Članak 1")
    })
  })

  describe("version helpers", () => {
    it("getParserVersion returns consistent value", () => {
      expect(getParserVersion()).toBe(getParserVersion())
    })

    it("getParserConfigHash changes with config", () => {
      const hash1 = getParserConfigHash({ someOption: true })
      const hash2 = getParserConfigHash({ someOption: false })
      expect(hash1).not.toBe(hash2)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/index.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
import { createHash } from "crypto"
import type { NNParserContract, ParseInput, ParseOutput, ContentClass } from "./types"
import { parseHtml } from "./html-parser"

// Re-export types
export * from "./types"
export { parseHtml } from "./html-parser"
export { validateInvariants } from "./invariants"
export { buildNodePath, parseArticleNumber, parseStavakNumber } from "./node-path"
export { cleanHtml, extractText } from "./html-cleaner"

/**
 * Current parser version - update when parser logic changes
 */
const PARSER_VERSION = "0.1.0"

/**
 * Default parser configuration
 */
const DEFAULT_CONFIG = {
  offsetUnit: "UTF16",
  strictMode: false,
  extractRawText: true,
  maxDepth: 10,
}

/**
 * Get the parser version (semver or git SHA)
 */
export function getParserVersion(): string {
  // In production, this could read from git SHA or package.json
  return process.env.NN_PARSER_VERSION || PARSER_VERSION
}

/**
 * Compute config hash for parser configuration
 */
export function getParserConfigHash(config: Record<string, unknown> = DEFAULT_CONFIG): string {
  const sorted = JSON.stringify(config, Object.keys(config).sort())
  return createHash("sha256").update(sorted).digest("hex")
}

/**
 * NN Parser implementation
 *
 * Implements NNParserContract from nn-mirror-v1.md Section 4.1
 */
export const NNParser: NNParserContract = {
  parserId: "nn-parser",
  parserVersion: getParserVersion(),
  parseConfigHash: getParserConfigHash(DEFAULT_CONFIG),

  supportedContentClasses: ["HTML"] as ContentClass[],

  async parse(input: ParseInput): Promise<ParseOutput> {
    const { contentClass, artifact } = input

    if (contentClass !== "HTML") {
      return {
        status: "FAILED",
        errorMessage: `Unsupported content class: ${contentClass}. Only HTML is supported in v0.1.`,
        warnings: [],
        unparsedSegments: [],
        docMeta: {},
        cleanText: "",
        cleanTextHash: "",
        nodes: [],
        stats: {
          nodeCount: 0,
          maxDepth: 0,
          byType: {},
          coverageChars: 0,
          coveragePercent: 0,
        },
      }
    }

    return parseHtml(artifact.content)
  },
}

/**
 * Create a parser instance with custom config
 */
export function createParser(config: Partial<typeof DEFAULT_CONFIG> = {}): NNParserContract {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  return {
    ...NNParser,
    parseConfigHash: getParserConfigHash(mergedConfig),
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/
git commit -m "feat(nn-parser): add parser entrypoint with version tracking

Implements NNParserContract with parserId, version, configHash.
Supports custom config for different parse modes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B7: Create First Test Fixtures

**Files:**

- Create: `fixtures/nn-parser/manifest.json`
- Create: `fixtures/nn-parser/simple-laws/nn-2020-001-001/input.html`
- Create: `fixtures/nn-parser/simple-laws/nn-2020-001-001/expected-meta.json`
- Create: `fixtures/nn-parser/simple-laws/nn-2020-001-001/expected-nodes.json`

**Step 1: Create fixture directory structure**

Run: `mkdir -p fixtures/nn-parser/simple-laws/nn-2020-001-001`
Expected: Directory created

**Step 2: Create manifest**

Create `fixtures/nn-parser/manifest.json`:

```json
{
  "version": "1.0.0",
  "description": "NN Parser test fixtures",
  "categories": {
    "simple-laws": {
      "description": "Basic structure, 5-15 articles",
      "count": 1
    }
  },
  "fixtures": [
    {
      "id": "nn-2020-001-001",
      "category": "simple-laws",
      "source": "Pravilnik o paušalnom oporezivanju",
      "nnYear": 2020,
      "nnIssue": 1,
      "nnItem": 1,
      "expectedArticles": 13
    }
  ]
}
```

**Step 3: Create sample input HTML**

Create `fixtures/nn-parser/simple-laws/nn-2020-001-001/input.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Pravilnik o paušalnom oporezivanju samostalnih djelatnosti</title>
  </head>
  <body>
    <h1>Pravilnik o paušalnom oporezivanju samostalnih djelatnosti</h1>

    <p class="clanak">Članak 1.</p>
    <p>Ovim se Pravilnikom uređuje paušalno oporezivanje dohotka od samostalne djelatnosti.</p>

    <p class="clanak">Članak 2.</p>
    <p>
      (1) Porezni obveznici koji dohodak od samostalne djelatnosti mogu utvrđivati u paušalnom
      iznosu su:
    </p>
    <p>a) fizičke osobe koje obavljaju samostalnu djelatnost,</p>
    <p>b) nositelji i supoduzetnici zajedničke djelatnosti.</p>
    <p>(2) Ukupni godišnji primici iz stavka 1. ne smiju prelaziti 300.000,00 kuna.</p>

    <p class="clanak">Članak 3.</p>
    <p>(1) Godišnji paušalni dohodak utvrđuje se kako slijedi:</p>
    <p>1. do 85.000,00 kuna primitaka - paušalni dohodak 12.750,00 kuna</p>
    <p>2. od 85.000,01 do 115.000,00 kuna - paušalni dohodak 17.250,00 kuna</p>
    <p>(2) Porezna stopa iznosi 12%.</p>
  </body>
</html>
```

**Step 4: Create expected metadata**

Create `fixtures/nn-parser/simple-laws/nn-2020-001-001/expected-meta.json`:

```json
{
  "title": "Pravilnik o paušalnom oporezivanju samostalnih djelatnosti",
  "textType": "pravilnik"
}
```

**Step 5: Create expected nodes (subset for validation)**

Create `fixtures/nn-parser/simple-laws/nn-2020-001-001/expected-nodes.json`:

```json
{
  "requiredPaths": [
    "/članak:1",
    "/članak:2",
    "/članak:2/stavak:1",
    "/članak:2/stavak:2",
    "/članak:3",
    "/članak:3/stavak:1",
    "/članak:3/stavak:2"
  ],
  "minNodeCount": 7,
  "minCoveragePercent": 50
}
```

**Step 6: Commit**

```bash
git add fixtures/nn-parser/
git commit -m "feat(fixtures): add first NN parser test fixture

Pravilnik o paušalnom oporezivanju (NN 1/2020).
Includes expected paths and coverage thresholds.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B8: Create Fixture Test Runner

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/__tests__/fixtures.test.ts`

**Step 1: Write the fixture test**

```typescript
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { NNParser } from "../index"

const FIXTURES_DIR = join(process.cwd(), "fixtures/nn-parser")

interface FixtureManifest {
  version: string
  fixtures: Array<{
    id: string
    category: string
    expectedArticles?: number
  }>
}

interface ExpectedNodes {
  requiredPaths: string[]
  minNodeCount: number
  minCoveragePercent: number
}

describe("NN Parser Fixtures", () => {
  // Skip if fixtures don't exist
  if (!existsSync(FIXTURES_DIR)) {
    it.skip("fixtures directory does not exist", () => {})
    return
  }

  const manifest = JSON.parse(
    readFileSync(join(FIXTURES_DIR, "manifest.json"), "utf-8")
  ) as FixtureManifest

  for (const fixture of manifest.fixtures) {
    describe(`Fixture: ${fixture.id}`, () => {
      const fixtureDir = join(FIXTURES_DIR, fixture.category, fixture.id)

      if (!existsSync(fixtureDir)) {
        it.skip(`fixture directory missing: ${fixtureDir}`, () => {})
        return
      }

      const inputPath = join(fixtureDir, "input.html")
      const expectedNodesPath = join(fixtureDir, "expected-nodes.json")
      const expectedMetaPath = join(fixtureDir, "expected-meta.json")

      it("parses successfully", async () => {
        const html = readFileSync(inputPath, "utf-8")

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        expect(result.status).toMatch(/SUCCESS|PARTIAL/)
      })

      it("extracts expected metadata", async () => {
        if (!existsSync(expectedMetaPath)) {
          return // Skip if no expected meta
        }

        const html = readFileSync(inputPath, "utf-8")
        const expectedMeta = JSON.parse(readFileSync(expectedMetaPath, "utf-8"))

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        if (expectedMeta.title) {
          expect(result.docMeta.title).toContain(expectedMeta.title.substring(0, 20))
        }
        if (expectedMeta.textType) {
          expect(result.docMeta.textType).toBe(expectedMeta.textType)
        }
      })

      it("produces expected node structure", async () => {
        if (!existsSync(expectedNodesPath)) {
          return // Skip if no expected nodes
        }

        const html = readFileSync(inputPath, "utf-8")
        const expected = JSON.parse(readFileSync(expectedNodesPath, "utf-8")) as ExpectedNodes

        const result = await NNParser.parse({
          evidenceId: fixture.id,
          contentClass: "HTML",
          artifact: {
            id: "test",
            kind: "HTML_RAW",
            content: html,
            contentHash: "test",
          },
        })

        // Check required paths
        const actualPaths = new Set(result.nodes.map((n) => n.nodePath))
        for (const requiredPath of expected.requiredPaths) {
          expect(actualPaths.has(requiredPath), `Missing path: ${requiredPath}`).toBe(true)
        }

        // Check min node count
        expect(result.stats.nodeCount).toBeGreaterThanOrEqual(expected.minNodeCount)

        // Check min coverage
        expect(result.stats.coveragePercent).toBeGreaterThanOrEqual(expected.minCoveragePercent)
      })
    })
  }
})
```

**Step 2: Run the fixture tests**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/fixtures.test.ts`
Expected: Tests pass (or some may fail indicating parser needs improvement)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/__tests__/
git commit -m "feat(nn-parser): add fixture test runner

Validates parser against fixture manifest.
Checks required paths, node count, coverage thresholds.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B9: Create Parse Pipeline Script

**Files:**

- Create: `scripts/run-nn-parser.ts`

**Step 1: Write the script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Run NN Parser on an Evidence record
 *
 * Usage: npx tsx scripts/run-nn-parser.ts <evidenceId>
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")
  const { NNParser, getParserVersion, getParserConfigHash } =
    await import("../src/lib/regulatory-truth/nn-parser")
  const { ProvisionNodeType, ParseStatus } = await import("@prisma/client")

  const evidenceId = process.argv[2]
  if (!evidenceId) {
    console.error("Usage: npx tsx scripts/run-nn-parser.ts <evidenceId>")
    process.exit(1)
  }

  console.log("=== NN Parser ===")
  console.log("Evidence ID:", evidenceId)
  console.log("Parser:", NNParser.parserId, NNParser.parserVersion)

  // 1. Load Evidence
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      artifacts: true,
    },
  })

  if (!evidence) {
    console.error("Evidence not found:", evidenceId)
    process.exit(1)
  }

  console.log("Content class:", evidence.contentClass)
  console.log("Content length:", evidence.rawContent?.length || 0, "chars")

  // 2. Check for existing parse
  const existingParse = await dbReg.parsedDocument.findFirst({
    where: {
      evidenceId,
      parserId: NNParser.parserId,
      parserVersion: NNParser.parserVersion,
      parseConfigHash: NNParser.parseConfigHash,
      status: "SUCCESS",
    },
  })

  if (existingParse) {
    console.log("\nExisting successful parse found:", existingParse.id)
    console.log("Use --force to reparse")

    if (!process.argv.includes("--force")) {
      await dbReg.$disconnect()
      return
    }
    console.log("--force specified, reparsing...")
  }

  // 3. Get primary artifact (HTML_CLEANED or fall back to rawContent)
  let content = evidence.rawContent
  let artifactId: string | undefined

  const cleanedArtifact = evidence.artifacts.find((a) => a.kind === "HTML_CLEANED")
  if (cleanedArtifact) {
    content = cleanedArtifact.content
    artifactId = cleanedArtifact.id
    console.log("Using HTML_CLEANED artifact:", artifactId)
  } else {
    console.log("Using rawContent (no HTML_CLEANED artifact)")
  }

  if (!content) {
    console.error("No content to parse")
    process.exit(1)
  }

  // 4. Parse
  console.log("\nParsing...")
  const startTime = Date.now()

  const result = await NNParser.parse({
    evidenceId,
    contentClass: evidence.contentClass as "HTML",
    artifact: {
      id: artifactId || "raw",
      kind: "HTML_RAW",
      content,
      contentHash: evidence.contentHash,
    },
  })

  const durationMs = Date.now() - startTime
  console.log("Parse completed in", durationMs, "ms")
  console.log("Status:", result.status)
  console.log("Nodes:", result.stats.nodeCount)
  console.log("Coverage:", result.stats.coveragePercent.toFixed(1) + "%")

  if (result.warnings.length > 0) {
    console.log("\nWarnings:")
    for (const w of result.warnings.slice(0, 5)) {
      console.log(`  - [${w.code}] ${w.message}`)
    }
    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more`)
    }
  }

  // 5. Store results
  console.log("\nStoring results...")

  // Create clean text artifact if not exists
  let cleanTextArtifactId: string | undefined
  const existingCleanText = evidence.artifacts.find(
    (a) => a.kind === "HTML_CLEANED" && a.contentHash === result.cleanTextHash
  )

  if (existingCleanText) {
    cleanTextArtifactId = existingCleanText.id
  } else {
    const newArtifact = await dbReg.evidenceArtifact.create({
      data: {
        evidenceId,
        kind: "HTML_CLEANED",
        content: result.cleanText,
        contentHash: result.cleanTextHash,
      },
    })
    cleanTextArtifactId = newArtifact.id
    console.log("Created clean text artifact:", cleanTextArtifactId)
  }

  // Mark existing parses as not latest
  await dbReg.parsedDocument.updateMany({
    where: {
      evidenceId,
      parserId: NNParser.parserId,
      isLatest: true,
    },
    data: { isLatest: false },
  })

  // Create ParsedDocument
  const parsedDoc = await dbReg.parsedDocument.create({
    data: {
      evidenceId,
      parserId: NNParser.parserId,
      parserVersion: NNParser.parserVersion,
      parseConfigHash: NNParser.parseConfigHash,
      status: result.status as ParseStatus,
      errorMessage: result.errorMessage,
      warnings: result.warnings,
      unparsedSegments: result.unparsedSegments,
      docMeta: result.docMeta,
      cleanTextArtifactId,
      cleanTextLength: result.cleanText.length,
      cleanTextHash: result.cleanTextHash,
      offsetUnit: "UTF16",
      nodeCount: result.stats.nodeCount,
      maxDepth: result.stats.maxDepth,
      statsByType: result.stats.byType,
      coverageChars: result.stats.coverageChars,
      coveragePercent: result.stats.coveragePercent,
      isLatest: true,
      parseDurationMs: durationMs,
    },
  })

  console.log("Created ParsedDocument:", parsedDoc.id)

  // Create ProvisionNodes
  if (result.nodes.length > 0) {
    const nodeData = result.nodes.map((node) => ({
      parsedDocumentId: parsedDoc.id,
      nodeType: node.nodeType,
      nodePath: node.nodePath,
      label: node.label,
      orderIndex: node.orderIndex,
      depth: node.depth,
      rawText: node.rawText,
      normalizedText: node.normalizedText,
      startOffset: node.startOffset,
      endOffset: node.endOffset,
      isContainer: node.isContainer,
      htmlSelector: node.htmlSelector,
    }))

    await dbReg.provisionNode.createMany({
      data: nodeData,
    })

    console.log("Created", nodeData.length, "ProvisionNodes")
  }

  // Summary
  console.log("\n=== Parse Complete ===")
  console.log("ParsedDocument ID:", parsedDoc.id)
  console.log("Status:", result.status)
  console.log("Node count:", result.stats.nodeCount)
  console.log("Coverage:", result.stats.coveragePercent.toFixed(1) + "%")

  console.log("\nNode breakdown:")
  for (const [type, count] of Object.entries(result.stats.byType)) {
    console.log(`  ${type}: ${count}`)
  }

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
```

**Step 2: Make executable and test**

Run: `chmod +x scripts/run-nn-parser.ts`
Expected: Script is executable

**Step 3: Commit**

```bash
git add scripts/run-nn-parser.ts
git commit -m "feat(scripts): add run-nn-parser.ts pipeline script

Parses Evidence records, stores ParsedDocument + ProvisionNodes.
Handles artifact management and parse versioning.
Usage: npx tsx scripts/run-nn-parser.ts <evidenceId>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B10: Integration Test - End to End

**Files:**

- Create: `src/lib/regulatory-truth/nn-parser/__tests__/integration.db.test.ts`

**Step 1: Write the integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { dbReg } from "@/lib/db"
import { NNParser } from "../index"
import { ParseStatus, ProvisionNodeType } from "@prisma/client"
import { createHash } from "crypto"

// This is a DB test - only runs in integration environment
describe.skipIf(!process.env.REGULATORY_DATABASE_URL)("NN Parser Integration", () => {
  const testSourceId = "test-source-" + Date.now()
  const testEvidenceId = "test-evidence-" + Date.now()

  const testHtml = `
    <html>
    <head><title>Test Pravilnik</title></head>
    <body>
      <h1>Pravilnik o testiranju</h1>
      <p class="clanak">Članak 1.</p>
      <p>Ovaj pravilnik uređuje testiranje.</p>
      <p class="clanak">Članak 2.</p>
      <p>(1) Prvi stavak članka 2.</p>
      <p>(2) Drugi stavak članka 2.</p>
    </body>
    </html>
  `
  const contentHash = createHash("sha256").update(testHtml).digest("hex")

  beforeAll(async () => {
    // Create test source
    await dbReg.regulatorySource.create({
      data: {
        id: testSourceId,
        name: "Test Source",
        slug: "test-source-" + Date.now(),
        url: "https://test.example.com",
        isActive: true,
        scrapeFrequency: "daily",
        priority: 1,
      },
    })

    // Create test evidence
    await dbReg.evidence.create({
      data: {
        id: testEvidenceId,
        sourceId: testSourceId,
        url: "https://test.example.com/doc",
        rawContent: testHtml,
        contentHash,
        contentType: "html",
        contentClass: "HTML",
        stalenessStatus: "FRESH",
      },
    })
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await dbReg.provisionNode.deleteMany({
      where: { parsedDocument: { evidenceId: testEvidenceId } },
    })
    await dbReg.parsedDocument.deleteMany({
      where: { evidenceId: testEvidenceId },
    })
    await dbReg.evidenceArtifact.deleteMany({
      where: { evidenceId: testEvidenceId },
    })
    await dbReg.evidence.delete({
      where: { id: testEvidenceId },
    })
    await dbReg.regulatorySource.delete({
      where: { id: testSourceId },
    })
  })

  it("parses evidence and stores results", async () => {
    // Parse
    const result = await NNParser.parse({
      evidenceId: testEvidenceId,
      contentClass: "HTML",
      artifact: {
        id: "test",
        kind: "HTML_RAW",
        content: testHtml,
        contentHash,
      },
    })

    expect(result.status).toBe("SUCCESS")
    expect(result.nodes.length).toBeGreaterThan(0)

    // Store artifact
    const artifact = await dbReg.evidenceArtifact.create({
      data: {
        evidenceId: testEvidenceId,
        kind: "HTML_CLEANED",
        content: result.cleanText,
        contentHash: result.cleanTextHash,
      },
    })

    // Store parsed document
    const parsedDoc = await dbReg.parsedDocument.create({
      data: {
        evidenceId: testEvidenceId,
        parserId: NNParser.parserId,
        parserVersion: NNParser.parserVersion,
        parseConfigHash: NNParser.parseConfigHash,
        status: ParseStatus.SUCCESS,
        docMeta: result.docMeta,
        cleanTextArtifactId: artifact.id,
        cleanTextLength: result.cleanText.length,
        cleanTextHash: result.cleanTextHash,
        offsetUnit: "UTF16",
        nodeCount: result.stats.nodeCount,
        maxDepth: result.stats.maxDepth,
        statsByType: result.stats.byType,
        coverageChars: result.stats.coverageChars,
        coveragePercent: result.stats.coveragePercent,
        isLatest: true,
      },
    })

    expect(parsedDoc.id).toBeDefined()

    // Store nodes
    const nodeData = result.nodes.map((node) => ({
      parsedDocumentId: parsedDoc.id,
      nodeType: node.nodeType,
      nodePath: node.nodePath,
      label: node.label,
      orderIndex: node.orderIndex,
      depth: node.depth,
      rawText: node.rawText,
      startOffset: node.startOffset,
      endOffset: node.endOffset,
      isContainer: node.isContainer,
    }))

    await dbReg.provisionNode.createMany({ data: nodeData })

    // Verify storage
    const storedNodes = await dbReg.provisionNode.findMany({
      where: { parsedDocumentId: parsedDoc.id },
    })

    expect(storedNodes.length).toBe(result.nodes.length)
    expect(storedNodes.some((n) => n.nodePath === "/članak:1")).toBe(true)
    expect(storedNodes.some((n) => n.nodePath === "/članak:2")).toBe(true)
  })

  it("enforces unique nodePath within document", async () => {
    // This tests the DB constraint
    const parsedDoc = await dbReg.parsedDocument.findFirst({
      where: { evidenceId: testEvidenceId },
    })

    if (!parsedDoc) {
      throw new Error("ParsedDocument not found - run previous test first")
    }

    // Try to create duplicate nodePath
    await expect(
      dbReg.provisionNode.create({
        data: {
          parsedDocumentId: parsedDoc.id,
          nodeType: ProvisionNodeType.CLANAK,
          nodePath: "/članak:1", // Duplicate!
          orderIndex: 99,
          depth: 1,
          startOffset: 0,
          endOffset: 10,
          isContainer: false,
        },
      })
    ).rejects.toThrow()
  })
})
```

**Step 2: Run the test (requires database)**

Run: `npx vitest run src/lib/regulatory-truth/nn-parser/__tests__/integration.db.test.ts`
Expected: PASS (or SKIP if no database)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/nn-parser/__tests__/
git commit -m "feat(nn-parser): add integration test for full pipeline

Tests Evidence → ParsedDocument → ProvisionNode flow.
Validates DB constraints and cleanup.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Exit Criteria Verification

After completing all tasks, verify:

| Criteria                  | Verification                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| Schema migrations applied | `npx prisma migrate status` shows all migrations applied            |
| Parser unit tests pass    | `npx vitest run src/lib/regulatory-truth/nn-parser/` all green      |
| Fixture tests pass        | At least 1 fixture passes all checks                                |
| Integration test passes   | DB test creates and queries records successfully                    |
| Parse 50 diverse items    | Run `scripts/run-nn-parser.ts` on 50 Evidence records, >95% success |

---

## Notes for Implementer

1. **Prisma schema location**: The regulatory database may use a separate schema file. Check if `prisma/schema-regulatory.prisma` exists.

2. **Cheerio dependency**: Ensure `cheerio` is installed: `npm install cheerio @types/cheerio`

3. **Test isolation**: DB tests use unique IDs with timestamps to avoid conflicts.

4. **Parser version**: Update `PARSER_VERSION` when making breaking changes to parse logic.

5. **Coverage calculation**: Uses interval union algorithm to avoid double-counting overlapping nodes.
