# NN Mirror Phase 5: Snapshots and Cleared Texts

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build consolidated "cleared text" snapshots with full provenance, enabling "as-of date" browsing and version diffs that compete with zakoni.hr but with audit-grade traceability.

**Architecture:** InstrumentSnapshot stores point-in-time consolidated texts. ConsolidationEngine applies amendment directives to base texts. Every character in a snapshot traces back to specific Evidence via SnapshotProvenance.

**Tech Stack:** Prisma (App), TypeScript workers, Next.js pages, `diff` package for line-based text comparison (⚠️ AUDIT FIX: Changed from diff-match-patch to `diff` for simplicity; `npm install diff @types/diff`)

**Reference:** `docs/specs/nn-mirror-v1.md` Section 8 Phase 5

> **⚠️ AUDIT FIX - Phase 4 Exit Criteria Gate:**
> Phase 5 MUST NOT begin until Phase 4 exit criteria are met for 7 consecutive days:
>
> - Offset integrity ≥99%
> - Node coverage ≥90%
> - Unparsed segments <5%
> - Link confidence HIGH/MEDIUM ≥80%
> - DLQ depth <50
>
> Verify with: `SELECT AVG("integrityRate") FROM "IntegrityCheck" WHERE "checkType" = 'ANCHOR_INTEGRITY' AND "createdAt" > NOW() - INTERVAL '7 days';`

---

## Part A: App Repository (Schema + UI)

### Task 1: Snapshot Status and Change Type Enums

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Write the enum definitions**

Add after `ResolutionFailReason` enum:

```prisma
enum SnapshotStatus {
  PENDING       // Queued for computation
  COMPUTING     // Currently being built
  VALID         // Successfully computed, current
  SUPERSEDED    // Replaced by newer snapshot
  FAILED        // Computation failed
}

enum ProvenanceChangeType {
  ORIGINAL      // From original instrument text
  INSERTED      // Added by amendment
  MODIFIED      // Changed by amendment
  DELETED       // Removed by amendment (tombstone)
  RENUMBERED    // Same content, different path
}

enum AmendmentDirectiveType {
  REPLACE_ARTICLE     // "Članak X. mijenja se i glasi:"
  REPLACE_STAVAK      // "Stavak X. mijenja se i glasi:"
  INSERT_AFTER        // "Iza članka X. dodaje se članak Xa."
  INSERT_BEFORE       // "Ispred članka X. dodaje se..."
  DELETE              // "Članak X. briše se."
  RENUMBER            // "Članci X-Y postaju članci Z-W"
  REPLACE_WORDS       // "Riječi '...' zamjenjuju se riječima '...'"
  ADD_STAVAK          // "Dodaje se stavak X."
  ADD_TOCKA           // "Dodaje se točka X."
}

enum DirectiveConfidence {
  HIGH          // Unambiguous directive parsed
  MEDIUM        // Some inference required
  LOW           // Best-effort interpretation
  MANUAL        // Human-verified
}
```

**Step 2: Run prisma format**

Run: `npx prisma format`
Expected: Schema formatted successfully

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add snapshot and amendment directive enums"
```

---

### Task 2: InstrumentSnapshot Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add InstrumentSnapshot model**

Add after `InstrumentCoverage` model:

```prisma
model InstrumentSnapshot {
  id              String          @id @default(cuid())
  instrumentId    String

  // Timeline position
  effectiveAt     DateTime        // When this version became effective
  validFrom       DateTime        // Start of validity window
  validUntil      DateTime?       // End of validity (null = current)

  // Snapshot content
  consolidatedText String         @db.Text
  textHash        String          // SHA256 for change detection

  // Tree structure (JSON of provision nodes with provenance)
  provisionTree   Json            // [{ nodePath, text, provenance: { evidenceId, changeType } }]
  treeHash        String          // Hash of structure for comparison

  // Stats
  articleCount    Int             @default(0)
  totalNodes      Int             @default(0)

  // Contributing evidence (amendment chain)
  contributingEvidenceIds String[] // Ordered list of Evidence IDs

  // Computation metadata
  status          SnapshotStatus  @default(PENDING)
  computedAt      DateTime?
  computedBy      String?         // "consolidation-engine-v1.2.3"
  computeDurationMs Int?
  errorMessage    String?

  // ⚠️ AUDIT FIX: Track inputs for reproducibility
  inputsHash      String?         // Hash of (contributingEvidenceIds + their cleanTextHashes)
  engineVersion   String?         // e.g., "consolidation-engine-v1.2.3"

  // Versioning
  version         Int             @default(1)  // Increment on recompute
  previousSnapshotId String?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  instrument      Instrument      @relation(fields: [instrumentId], references: [id])
  previousSnapshot InstrumentSnapshot? @relation("SnapshotChain", fields: [previousSnapshotId], references: [id])
  nextSnapshots   InstrumentSnapshot[] @relation("SnapshotChain")
  provenance      SnapshotProvenance[]

  @@unique([instrumentId, effectiveAt])
  @@index([instrumentId, status])
  @@index([instrumentId, validFrom, validUntil])
  @@index([status, createdAt])
}
```

**Step 2: Add relation to Instrument**

Find the Instrument model and add:

```prisma
model Instrument {
  // ... existing fields ...

  snapshots       InstrumentSnapshot[]
}
```

**Step 3: Run prisma format**

Run: `npx prisma format`
Expected: Schema formatted successfully

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add InstrumentSnapshot model for consolidated texts"
```

---

### Task 3: SnapshotProvenance Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add SnapshotProvenance model**

This maps every span in the consolidated text back to source Evidence:

```prisma
model SnapshotProvenance {
  id              String                @id @default(cuid())
  snapshotId      String

  // Position in consolidated text
  nodePath        String                // /članak:28/stavak:1
  startOffset     Int                   // UTF-16 offset in consolidatedText
  endOffset       Int

  // Source tracing
  sourceEvidenceId String               // Evidence this came from
  sourceNodePath  String?               // Original nodePath in source
  sourceStartOffset Int?                // Original offset in source cleanText
  sourceEndOffset Int?

  // Change tracking
  changeType      ProvenanceChangeType
  changedAt       DateTime              // When this change was published
  changedByEvidenceId String?           // Amendment that made this change

  // For MODIFIED: what was replaced
  previousText    String?               @db.Text

  createdAt       DateTime              @default(now())

  snapshot        InstrumentSnapshot    @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  sourceEvidence  Evidence              @relation("ProvenanceSource", fields: [sourceEvidenceId], references: [id])
  changedByEvidence Evidence?           @relation("ProvenanceChanger", fields: [changedByEvidenceId], references: [id])

  @@index([snapshotId, nodePath])
  @@index([snapshotId, startOffset])
  @@index([sourceEvidenceId])
}
```

**Step 2: Add relations to Evidence**

Find Evidence model and add:

```prisma
model Evidence {
  // ... existing fields ...

  provenanceAsSource  SnapshotProvenance[] @relation("ProvenanceSource")
  provenanceAsChanger SnapshotProvenance[] @relation("ProvenanceChanger")
}
```

**Step 3: Run prisma format and commit**

```bash
npx prisma format
git add prisma/schema.prisma
git commit -m "feat(schema): add SnapshotProvenance for audit-grade traceability"
```

---

### Task 4: AmendmentDirective Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add AmendmentDirective model**

Parsed amendment instructions extracted from amendment gazette items:

```prisma
model AmendmentDirective {
  id                  String                  @id @default(cuid())

  // Source
  amendingEvidenceId  String                  // The amendment gazette item
  amendingNodePath    String?                 // Where in amendment this directive is

  // Target
  targetInstrumentId  String
  targetNodePath      String                  // /članak:28 or /članak:28/stavak:1

  // Directive details
  directiveType       AmendmentDirectiveType
  directiveText       String                  @db.Text  // Raw text of the directive
  newText             String?                 @db.Text  // Replacement text (if applicable)

  // For REPLACE_WORDS
  searchPattern       String?                 // Words to find
  replaceWith         String?                 // Words to replace with

  // For INSERT_AFTER/BEFORE
  insertionNodePath   String?                 // New nodePath for inserted content

  // Confidence
  confidence          DirectiveConfidence     @default(MEDIUM)
  parserVersion       String

  // Application tracking
  appliedInSnapshotId String?                 // Which snapshot applied this
  appliedAt           DateTime?

  // Manual review
  reviewedAt          DateTime?
  reviewedBy          String?
  reviewNotes         String?

  createdAt           DateTime                @default(now())

  amendingEvidence    Evidence                @relation("DirectiveSource", fields: [amendingEvidenceId], references: [id])
  targetInstrument    Instrument              @relation(fields: [targetInstrumentId], references: [id])
  appliedInSnapshot   InstrumentSnapshot?     @relation(fields: [appliedInSnapshotId], references: [id])

  @@index([amendingEvidenceId])
  @@index([targetInstrumentId, targetNodePath])
  @@index([confidence])
  @@index([appliedInSnapshotId])
}
```

**Step 2: Add relations**

Add to Evidence:

```prisma
  amendmentDirectives AmendmentDirective[] @relation("DirectiveSource")
```

Add to Instrument:

```prisma
  amendmentDirectives AmendmentDirective[]
```

Add to InstrumentSnapshot:

```prisma
  appliedDirectives   AmendmentDirective[]
```

**Step 3: Commit**

```bash
npx prisma format
git add prisma/schema.prisma
git commit -m "feat(schema): add AmendmentDirective for parsed amendment instructions"
```

---

### Task 5: SnapshotComputeJob Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add SnapshotComputeJob model**

Queue for computing/recomputing snapshots:

```prisma
model SnapshotComputeJob {
  id              String    @id @default(cuid())
  instrumentId    String

  // Target
  targetDate      DateTime? // Compute snapshot as of this date (null = latest)

  // Trigger
  reason          String    // NEW_AMENDMENT, DIRECTIVE_CORRECTION, REPARSE, MANUAL
  triggeredBy     String?   // Evidence ID or user ID
  priority        Int       @default(0)

  // Status
  status          String    @default("PENDING")  // PENDING, RUNNING, COMPLETED, FAILED, SKIPPED

  // Result
  resultSnapshotId String?

  // Timing
  createdAt       DateTime  @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  errorMessage    String?

  @@index([status, priority, createdAt])
  @@index([instrumentId])
}
```

**Step 2: Commit**

```bash
npx prisma format
git add prisma/schema.prisma
git commit -m "feat(schema): add SnapshotComputeJob for consolidation queue"
```

---

### Task 6: Generate and Run Migration

**Files:**

- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_snapshot_models/migration.sql`

**Step 1: Generate migration**

Run: `npx prisma migrate dev --name add_snapshot_models --create-only`
Expected: Migration file created

**Step 2: Review migration**

Run: `cat prisma/migrations/*add_snapshot_models*/migration.sql | head -100`
Verify: Creates all 4 new tables with correct columns and indexes

**Step 3: Apply migration**

Run: `npx prisma migrate dev`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "chore(db): migration for snapshot and amendment directive models"
```

---

### Task 7: As-Of Date Browser Page

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/as-of/page.tsx`

**Step 1: Write the failing test**

Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/as-of/__tests__/page.test.tsx`

```typescript
import { render, screen } from "@testing-library/react"
import AsOfPage from "../page"

// Mock prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    instrument: { findUnique: jest.fn() },
    instrumentSnapshot: { findMany: jest.fn(), findFirst: jest.fn() },
  },
}))

describe("AsOfPage", () => {
  it("renders date picker and snapshot content", async () => {
    const { prisma } = require("@/lib/db")
    prisma.instrument.findUnique.mockResolvedValue({
      id: "inst-1",
      title: "Zakon o PDV-u",
    })
    prisma.instrumentSnapshot.findMany.mockResolvedValue([
      { id: "snap-1", effectiveAt: new Date("2024-01-01"), validUntil: null },
      { id: "snap-2", effectiveAt: new Date("2023-01-01"), validUntil: new Date("2024-01-01") },
    ])
    prisma.instrumentSnapshot.findFirst.mockResolvedValue({
      id: "snap-1",
      consolidatedText: "Članak 1.\nPorezi se plaćaju.",
      provisionTree: [],
      effectiveAt: new Date("2024-01-01"),
    })

    const page = await AsOfPage({
      params: { instrumentId: "inst-1" },
      searchParams: {},
    })
    render(page)

    expect(screen.getByText("Zakon o PDV-u")).toBeInTheDocument()
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- as-of/page.test.tsx`
Expected: FAIL (component not found)

**Step 3: Write the page component**

```typescript
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { hr } from 'date-fns/locale'
import { AsOfDatePicker } from './components/date-picker'
import { SnapshotViewer } from './components/snapshot-viewer'

interface Props {
  params: { instrumentId: string }
  searchParams: { date?: string }
}

export default async function AsOfPage({ params, searchParams }: Props) {
  const instrument = await prisma.instrument.findUnique({
    where: { id: params.instrumentId },
  })

  if (!instrument) notFound()

  // Get all snapshots for timeline
  const snapshots = await prisma.instrumentSnapshot.findMany({
    where: {
      instrumentId: params.instrumentId,
      status: 'VALID',
    },
    orderBy: { effectiveAt: 'desc' },
    select: {
      id: true,
      effectiveAt: true,
      validFrom: true,
      validUntil: true,
      articleCount: true,
    },
  })

  // Parse target date or use today
  const targetDate = searchParams.date
    ? new Date(searchParams.date)
    : new Date()

  // Find snapshot valid at target date
  const snapshot = await prisma.instrumentSnapshot.findFirst({
    where: {
      instrumentId: params.instrumentId,
      status: 'VALID',
      validFrom: { lte: targetDate },
      OR: [
        { validUntil: null },
        { validUntil: { gt: targetDate } },
      ],
    },
    include: {
      provenance: {
        orderBy: { startOffset: 'asc' },
      },
    },
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{instrument.title}</h1>
          <p className="text-muted-foreground">
            Pročišćeni tekst na dan {format(targetDate, 'd. MMMM yyyy.', { locale: hr })}
          </p>
        </div>
        <AsOfDatePicker
          currentDate={targetDate}
          snapshots={snapshots}
          instrumentId={params.instrumentId}
        />
      </div>

      {snapshot ? (
        <SnapshotViewer
          snapshot={snapshot}
          showProvenance={true}
        />
      ) : (
        <div className="bg-muted p-8 rounded-lg text-center">
          <p className="text-muted-foreground">
            Nema dostupnog pročišćenog teksta za odabrani datum.
          </p>
          {snapshots.length > 0 && (
            <p className="mt-2">
              Najraniji dostupni datum: {format(snapshots[snapshots.length - 1].effectiveAt, 'd.M.yyyy.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- as-of/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add as-of date snapshot viewer page"
```

---

### Task 8: Snapshot Viewer Component with Provenance

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/as-of/components/snapshot-viewer.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { InstrumentSnapshot, SnapshotProvenance } from '@prisma/client'
import { ProvenancePopover } from './provenance-popover'

interface Props {
  snapshot: InstrumentSnapshot & {
    provenance: SnapshotProvenance[]
  }
  showProvenance?: boolean
}

export function SnapshotViewer({ snapshot, showProvenance = false }: Props) {
  const [selectedProvenance, setSelectedProvenance] = useState<SnapshotProvenance | null>(null)

  // ⚠️ AUDIT FIX: Use range-based interval rendering, NOT per-character iteration
  // Previous O(n) per-char approach is too slow for large texts.
  // Provenance records already have (startOffset, endOffset) ranges.

  // Sort provenance by startOffset for sequential rendering
  const sortedProvenance = useMemo(() => {
    return [...snapshot.provenance].sort((a, b) => a.startOffset - b.startOffset)
  }, [snapshot.provenance])

  // Render text with provenance highlighting - O(m) where m = provenance records
  const renderTextWithProvenance = () => {
    const text = snapshot.consolidatedText
    const segments: JSX.Element[] = []
    let lastEnd = 0

    for (const p of sortedProvenance) {
      // Add any gap before this provenance range
      if (p.startOffset > lastEnd) {
        segments.push(
          <span key={`gap-${lastEnd}`}>
            {text.slice(lastEnd, p.startOffset)}
          </span>
        )
      }

      // Add the provenance-highlighted segment
      const segmentText = text.slice(p.startOffset, p.endOffset)
      segments.push(
        <span
          key={p.id}
          className={cn(
            'cursor-pointer transition-colors',
            p.changeType === 'MODIFIED' && 'bg-yellow-100 hover:bg-yellow-200',
            p.changeType === 'INSERTED' && 'bg-green-100 hover:bg-green-200',
            p.changeType === 'DELETED' && 'bg-red-100 line-through',
            selectedProvenance?.id === p.id && 'ring-2 ring-primary'
          )}
          onClick={() => setSelectedProvenance(p)}
          title={`${p.changeType} from ${p.sourceEvidenceId}`}
        >
          {segmentText}
        </span>
      )

      lastEnd = p.endOffset
    }

    // Add any remaining text after last provenance
    if (lastEnd < text.length) {
      segments.push(
        <span key={`tail-${lastEnd}`}>
          {text.slice(lastEnd)}
        </span>
      )
    }

    return segments
  }

  return (
    <div className="relative">
      <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {showProvenance ? renderTextWithProvenance() : snapshot.consolidatedText}
      </div>

      {selectedProvenance && (
        <ProvenancePopover
          provenance={selectedProvenance}
          onClose={() => setSelectedProvenance(null)}
        />
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-100 rounded" /> Izmijenjeno
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-100 rounded" /> Dodano
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-100 rounded" /> Brisano
        </span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add SnapshotViewer with provenance highlighting"
```

---

### Task 9: Provenance Popover Component

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/as-of/components/provenance-popover.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SnapshotProvenance } from '@prisma/client'
import Link from 'next/link'
import { format } from 'date-fns'
import { hr } from 'date-fns/locale'

interface Props {
  provenance: SnapshotProvenance
  onClose: () => void
}

interface EvidenceInfo {
  id: string
  sourceKey: string | null
  url: string
}

export function ProvenancePopover({ provenance, onClose }: Props) {
  const [sourceEvidence, setSourceEvidence] = useState<EvidenceInfo | null>(null)
  const [changerEvidence, setChangerEvidence] = useState<EvidenceInfo | null>(null)

  useEffect(() => {
    // Fetch evidence info
    fetch(`/api/nn-browser/evidence/${provenance.sourceEvidenceId}`)
      .then(r => r.json())
      .then(setSourceEvidence)

    if (provenance.changedByEvidenceId) {
      fetch(`/api/nn-browser/evidence/${provenance.changedByEvidenceId}`)
        .then(r => r.json())
        .then(setChangerEvidence)
    }
  }, [provenance])

  const changeTypeLabels: Record<string, string> = {
    ORIGINAL: 'Izvorni tekst',
    INSERTED: 'Dodano',
    MODIFIED: 'Izmijenjeno',
    DELETED: 'Brisano',
    RENUMBERED: 'Prenumerirano',
  }

  return (
    <Card className="absolute right-4 top-4 w-80 shadow-lg z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Izvor teksta</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <div>
          <span className="text-muted-foreground">Vrsta promjene:</span>
          <span className="ml-2 font-medium">
            {changeTypeLabels[provenance.changeType] || provenance.changeType}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Datum promjene:</span>
          <span className="ml-2">
            {format(provenance.changedAt, 'd. MMMM yyyy.', { locale: hr })}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Izvorni dokument:</span>
          {sourceEvidence && (
            <Link
              href={`/nn-browser/evidence/${sourceEvidence.id}`}
              className="block text-primary hover:underline truncate"
            >
              {sourceEvidence.sourceKey || sourceEvidence.id}
            </Link>
          )}
        </div>

        {provenance.sourceNodePath && (
          <div>
            <span className="text-muted-foreground">Izvorna pozicija:</span>
            <code className="ml-2 text-xs bg-muted px-1 rounded">
              {provenance.sourceNodePath}
            </code>
          </div>
        )}

        {changerEvidence && (
          <div>
            <span className="text-muted-foreground">Izmjena objavljena u:</span>
            <Link
              href={`/nn-browser/evidence/${changerEvidence.id}`}
              className="block text-primary hover:underline truncate"
            >
              {changerEvidence.sourceKey || changerEvidence.id}
            </Link>
          </div>
        )}

        {provenance.previousText && (
          <div>
            <span className="text-muted-foreground block mb-1">Prethodni tekst:</span>
            <div className="bg-red-50 p-2 rounded text-xs font-mono line-through">
              {provenance.previousText.slice(0, 200)}
              {provenance.previousText.length > 200 && '...'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add ProvenancePopover for source tracing"
```

---

### Task 10: Version Changelog Page

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/changelog/page.tsx`

**Step 1: Write the page**

```typescript
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { hr } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  params: { instrumentId: string }
}

export default async function ChangelogPage({ params }: Props) {
  const instrument = await prisma.instrument.findUnique({
    where: { id: params.instrumentId },
    include: {
      evidenceLinks: {
        where: { confidence: { in: ['HIGH', 'MEDIUM'] } },
        orderBy: { publishedAt: 'desc' },
        include: {
          evidence: {
            select: {
              id: true,
              sourceKey: true,
              url: true,
            },
          },
        },
      },
      snapshots: {
        where: { status: 'VALID' },
        orderBy: { effectiveAt: 'desc' },
        select: {
          id: true,
          effectiveAt: true,
          articleCount: true,
          version: true,
        },
      },
    },
  })

  if (!instrument) notFound()

  const eventTypeLabels: Record<string, string> = {
    ORIGINAL: 'Izvorni tekst',
    AMENDMENT: 'Izmjene i dopune',
    CONSOLIDATED: 'Pročišćeni tekst',
    CORRECTION: 'Ispravak',
    DECISION: 'Odluka',
    INTERPRETATION: 'Tumačenje',
    REPEAL: 'Prestanak važenja',
    UNKNOWN: 'Nepoznato',
  }

  const eventTypeBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ORIGINAL: 'default',
    AMENDMENT: 'secondary',
    CORRECTION: 'outline',
    REPEAL: 'destructive',
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{instrument.title}</h1>
        <p className="text-muted-foreground">Povijest izmjena</p>
      </div>

      <div className="grid gap-4">
        {instrument.evidenceLinks.map((link) => {
          const snapshot = instrument.snapshots.find(
            s => s.effectiveAt <= (link.effectiveFrom || link.publishedAt!)
          )

          return (
            <Card key={link.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {link.publishedAt && format(link.publishedAt, 'd. MMMM yyyy.', { locale: hr })}
                  </CardTitle>
                  <Badge variant={eventTypeBadgeVariant[link.eventType] || 'outline'}>
                    {eventTypeLabels[link.eventType] || link.eventType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Objavljeno u:</span>
                  <Link
                    href={`/nn-browser/evidence/${link.evidence.id}`}
                    className="text-primary hover:underline"
                  >
                    {link.evidence.sourceKey || 'NN dokument'}
                  </Link>
                </div>

                {link.effectiveFrom && (
                  <div>
                    <span className="text-muted-foreground">Stupa na snagu:</span>
                    <span className="ml-2">
                      {format(link.effectiveFrom, 'd. MMMM yyyy.', { locale: hr })}
                    </span>
                  </div>
                )}

                {snapshot && (
                  <div className="pt-2 flex gap-2">
                    <Link
                      href={`/nn-browser/instruments/${params.instrumentId}/as-of?date=${snapshot.effectiveAt.toISOString().split('T')[0]}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Pogledaj pročišćeni tekst →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {instrument.evidenceLinks.length === 0 && (
        <div className="bg-muted p-8 rounded-lg text-center">
          <p className="text-muted-foreground">
            Nema povezanih dokumenata za ovaj propis.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add instrument changelog page"
```

---

### Task 11: Version Diff Page

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/diff/page.tsx`

**Step 1: Write the page**

```typescript
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { hr } from 'date-fns/locale'
import { DiffViewer } from './components/diff-viewer'
import { SnapshotSelector } from './components/snapshot-selector'

interface Props {
  params: { instrumentId: string }
  searchParams: { from?: string; to?: string }
}

export default async function DiffPage({ params, searchParams }: Props) {
  const instrument = await prisma.instrument.findUnique({
    where: { id: params.instrumentId },
  })

  if (!instrument) notFound()

  const snapshots = await prisma.instrumentSnapshot.findMany({
    where: {
      instrumentId: params.instrumentId,
      status: 'VALID',
    },
    orderBy: { effectiveAt: 'desc' },
    select: {
      id: true,
      effectiveAt: true,
      consolidatedText: true,
      articleCount: true,
      version: true,
    },
  })

  if (snapshots.length < 2) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">{instrument.title}</h1>
        <div className="bg-muted p-8 rounded-lg text-center">
          <p className="text-muted-foreground">
            Za usporedbu verzija potrebne su najmanje 2 verzije pročišćenog teksta.
          </p>
        </div>
      </div>
    )
  }

  const fromSnapshot = searchParams.from
    ? snapshots.find(s => s.id === searchParams.from)
    : snapshots[1] // Second most recent

  const toSnapshot = searchParams.to
    ? snapshots.find(s => s.id === searchParams.to)
    : snapshots[0] // Most recent

  if (!fromSnapshot || !toSnapshot) notFound()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{instrument.title}</h1>
        <p className="text-muted-foreground">Usporedba verzija</p>
      </div>

      <div className="flex items-center gap-4">
        <SnapshotSelector
          label="Od"
          snapshots={snapshots}
          selected={fromSnapshot.id}
          instrumentId={params.instrumentId}
          paramName="from"
          otherParam={toSnapshot.id}
        />
        <span className="text-muted-foreground">→</span>
        <SnapshotSelector
          label="Do"
          snapshots={snapshots}
          selected={toSnapshot.id}
          instrumentId={params.instrumentId}
          paramName="to"
          otherParam={fromSnapshot.id}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Usporedba: {format(fromSnapshot.effectiveAt, 'd.M.yyyy.', { locale: hr })}
        {' → '}
        {format(toSnapshot.effectiveAt, 'd.M.yyyy.', { locale: hr })}
      </div>

      <DiffViewer
        fromText={fromSnapshot.consolidatedText}
        toText={toSnapshot.consolidatedText}
        fromDate={fromSnapshot.effectiveAt}
        toDate={toSnapshot.effectiveAt}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add version diff comparison page"
```

---

### Task 12: Diff Viewer Component

**Files:**

- Create: `src/app/(staff)/nn-browser/instruments/[instrumentId]/diff/components/diff-viewer.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useMemo } from 'react'
import { diffLines, Change } from 'diff'
import { cn } from '@/lib/utils'

interface Props {
  fromText: string
  toText: string
  fromDate: Date
  toDate: Date
}

export function DiffViewer({ fromText, toText }: Props) {
  const diff = useMemo(() => {
    return diffLines(fromText, toText, { newlineIsToken: true })
  }, [fromText, toText])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    for (const part of diff) {
      if (part.added) added += part.count || 0
      if (part.removed) removed += part.count || 0
    }
    return { added, removed }
  }, [diff])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-green-600">+{stats.added} dodano</span>
        <span className="text-red-600">-{stats.removed} uklonjeno</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-2 border-b text-sm font-medium">
          Razlike
        </div>
        <div className="p-4 font-mono text-sm overflow-x-auto">
          {diff.map((part, index) => (
            <div
              key={index}
              className={cn(
                'whitespace-pre-wrap',
                part.added && 'bg-green-50 text-green-800',
                part.removed && 'bg-red-50 text-red-800 line-through'
              )}
            >
              {part.value.split('\n').map((line, lineIndex) => (
                <div key={lineIndex} className="flex">
                  <span className="w-6 text-muted-foreground select-none">
                    {part.added ? '+' : part.removed ? '-' : ' '}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(staff\)/nn-browser/instruments/
git commit -m "feat(browser): add DiffViewer component for version comparison"
```

---

## Part B: Workers Repository (Consolidation Engine)

### Task 13: Consolidation Types

**Files:**

- Create: `src/lib/regulatory-truth/consolidation/types.ts`

**Step 1: Write type definitions**

```typescript
import type {
  AmendmentDirectiveType,
  DirectiveConfidence,
  ProvenanceChangeType,
} from "@prisma/client"

export interface ParsedDirective {
  directiveType: AmendmentDirectiveType
  targetNodePath: string
  directiveText: string
  newText?: string
  searchPattern?: string
  replaceWith?: string
  insertionNodePath?: string
  confidence: DirectiveConfidence
  sourceOffset: {
    start: number
    end: number
  }
}

export interface DirectiveParseResult {
  directives: ParsedDirective[]
  unparsedSegments: Array<{
    text: string
    startOffset: number
    endOffset: number
    reason: string
  }>
  warnings: string[]
}

export interface ConsolidatedNode {
  nodePath: string
  text: string
  startOffset: number
  endOffset: number
  provenance: NodeProvenance
  children: ConsolidatedNode[]
}

export interface NodeProvenance {
  sourceEvidenceId: string
  sourceNodePath?: string
  sourceStartOffset?: number
  sourceEndOffset?: number
  changeType: ProvenanceChangeType
  changedAt: Date
  changedByEvidenceId?: string
  previousText?: string
}

export interface ConsolidationResult {
  success: boolean
  consolidatedText: string
  textHash: string
  provisionTree: ConsolidatedNode[]
  treeHash: string
  provenance: Array<{
    nodePath: string
    startOffset: number
    endOffset: number
    provenance: NodeProvenance
  }>
  articleCount: number
  totalNodes: number
  contributingEvidenceIds: string[]
  errors: string[]
  warnings: string[]
}

export interface ConsolidationEngineConfig {
  parserVersion: string
  strictMode: boolean // Fail on any ambiguous directive
  maxAmendmentChain: number // Max number of amendments to apply
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/consolidation/
git commit -m "feat(consolidation): add type definitions for consolidation engine"
```

---

### Task 14: Amendment Directive Parser

**Files:**

- Create: `src/lib/regulatory-truth/consolidation/directive-parser.ts`
- Create: `src/lib/regulatory-truth/consolidation/__tests__/directive-parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { parseAmendmentDirectives } from "../directive-parser"

describe("parseAmendmentDirectives", () => {
  it("parses REPLACE_ARTICLE directive", () => {
    const text = `Članak 5. mijenja se i glasi:

"Članak 5.

(1) Porez se plaća po stopi od 25%.

(2) Iznimno, stopa od 13% primjenjuje se na..."`

    const result = parseAmendmentDirectives(text)

    expect(result.directives).toHaveLength(1)
    expect(result.directives[0]).toMatchObject({
      directiveType: "REPLACE_ARTICLE",
      targetNodePath: "/članak:5",
      confidence: "HIGH",
    })
    expect(result.directives[0].newText).toContain("Porez se plaća")
  })

  it("parses INSERT_AFTER directive", () => {
    const text = `Iza članka 12. dodaje se članak 12.a koji glasi:

"Članak 12.a

Posebne odredbe primjenjuju se na..."`

    const result = parseAmendmentDirectives(text)

    expect(result.directives).toHaveLength(1)
    expect(result.directives[0]).toMatchObject({
      directiveType: "INSERT_AFTER",
      targetNodePath: "/članak:12",
      insertionNodePath: "/članak:12a",
      confidence: "HIGH",
    })
  })

  it("parses DELETE directive", () => {
    const text = `Članak 8. briše se.`

    const result = parseAmendmentDirectives(text)

    expect(result.directives).toHaveLength(1)
    expect(result.directives[0]).toMatchObject({
      directiveType: "DELETE",
      targetNodePath: "/članak:8",
      confidence: "HIGH",
    })
  })

  it("parses REPLACE_WORDS directive", () => {
    const text = `U članku 15. stavku 2. riječi "tri godine" zamjenjuju se riječima "pet godina".`

    const result = parseAmendmentDirectives(text)

    expect(result.directives).toHaveLength(1)
    expect(result.directives[0]).toMatchObject({
      directiveType: "REPLACE_WORDS",
      targetNodePath: "/članak:15/stavak:2",
      searchPattern: "tri godine",
      replaceWith: "pet godina",
      confidence: "HIGH",
    })
  })

  it("parses multiple directives", () => {
    const text = `Članak 2.

U članku 5. stavku 1. riječ "deset" zamjenjuje se riječju "dvadeset".

Članak 3.

Članak 10. briše se.

Članak 4.

Iza članka 15. dodaje se članak 15.a koji glasi:
...`

    const result = parseAmendmentDirectives(text)

    expect(result.directives.length).toBeGreaterThanOrEqual(3)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- directive-parser.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the directive parser**

```typescript
import type { AmendmentDirectiveType, DirectiveConfidence } from "@prisma/client"
import type { ParsedDirective, DirectiveParseResult } from "./types"

// Croatian amendment directive patterns
const DIRECTIVE_PATTERNS = {
  REPLACE_ARTICLE: [
    /Članak\s+(\d+[a-z]?)\.?\s+mijenja\s+se\s+i\s+glasi\s*:/gi,
    /U\s+članku\s+(\d+[a-z]?)\.?\s+tekst\s+se\s+mijenja\s+i\s+glasi\s*:/gi,
  ],
  REPLACE_STAVAK: [
    /U\s+članku\s+(\d+[a-z]?)\.?\s+stavak\s+(\d+)\.?\s+mijenja\s+se\s+i\s+glasi\s*:/gi,
    /Stavak\s+(\d+)\.?\s+članka\s+(\d+[a-z]?)\.?\s+mijenja\s+se\s+i\s+glasi\s*:/gi,
  ],
  INSERT_AFTER: [
    /Iza\s+članka\s+(\d+[a-z]?)\.?\s+dodaje\s+se\s+članak\s+(\d+[a-z]?)\.?\s+koji\s+glasi\s*:/gi,
    /Iza\s+članka\s+(\d+[a-z]?)\.?\s+dodaju\s+se\s+članci\s+(\d+[a-z]?)\.?\s+do\s+(\d+[a-z]?)\.?\s+koji\s+glase\s*:/gi,
  ],
  INSERT_BEFORE: [
    /Ispred\s+članka\s+(\d+[a-z]?)\.?\s+dodaje\s+se\s+članak\s+(\d+[a-z]?)\.?\s+koji\s+glasi\s*:/gi,
  ],
  DELETE: [
    /Članak\s+(\d+[a-z]?)\.?\s+briše\s+se\.?/gi,
    /Članci\s+(\d+[a-z]?)\.?\s+do\s+(\d+[a-z]?)\.?\s+brišu\s+se\.?/gi,
    /U\s+članku\s+(\d+[a-z]?)\.?\s+stavak\s+(\d+)\.?\s+briše\s+se\.?/gi,
  ],
  REPLACE_WORDS: [
    /U\s+članku\s+(\d+[a-z]?)\.?(?:\s+stavku\s+(\d+)\.?)?\s+riječ(?:i)?\s+"([^"]+)"\s+zamjenjuj(?:e|u)\s+se\s+riječ(?:ima|ju)?\s+"([^"]+)"\.?/gi,
    /U\s+članku\s+(\d+[a-z]?)\.?(?:\s+stavku\s+(\d+)\.?)?\s+broj\s+"([^"]+)"\s+zamjenjuje\s+se\s+brojem\s+"([^"]+)"\.?/gi,
  ],
  ADD_STAVAK: [
    /U\s+članku\s+(\d+[a-z]?)\.?\s+dodaje\s+se\s+stavak\s+(\d+)\.?\s+koji\s+glasi\s*:/gi,
    /U\s+članku\s+(\d+[a-z]?)\.?\s+iza\s+stavka\s+(\d+)\.?\s+dodaje\s+se\s+stavak\s+(\d+)\.?\s+koji\s+glasi\s*:/gi,
  ],
  ADD_TOCKA: [
    /U\s+članku\s+(\d+[a-z]?)\.?\s+stavku\s+(\d+)\.?\s+dodaje\s+se\s+točka\s+([a-z\d]+)\)?\s+koja\s+glasi\s*:/gi,
  ],
}

export function parseAmendmentDirectives(text: string): DirectiveParseResult {
  const directives: ParsedDirective[] = []
  const unparsedSegments: DirectiveParseResult["unparsedSegments"] = []
  const warnings: string[] = []

  // Track which parts of text we've parsed
  const parsedRanges: Array<{ start: number; end: number }> = []

  for (const [directiveType, patterns] of Object.entries(DIRECTIVE_PATTERNS)) {
    for (const pattern of patterns) {
      // Reset regex state
      pattern.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = pattern.exec(text)) !== null) {
        const directive = parseMatch(directiveType as AmendmentDirectiveType, match, text)

        if (directive) {
          directives.push(directive)
          parsedRanges.push({
            start: match.index,
            end: match.index + match[0].length + (directive.newText?.length || 0),
          })
        }
      }
    }
  }

  // Sort directives by position in text
  directives.sort((a, b) => a.sourceOffset.start - b.sourceOffset.start)

  // Find unparsed segments (potential missed directives)
  const mergedRanges = mergeOverlappingRanges(parsedRanges)
  let lastEnd = 0

  for (const range of mergedRanges) {
    if (range.start > lastEnd) {
      const segment = text.slice(lastEnd, range.start).trim()
      if (segment.length > 50 && looksLikeDirective(segment)) {
        unparsedSegments.push({
          text: segment.slice(0, 200),
          startOffset: lastEnd,
          endOffset: range.start,
          reason: "POTENTIAL_DIRECTIVE_NOT_PARSED",
        })
      }
    }
    lastEnd = range.end
  }

  return { directives, unparsedSegments, warnings }
}

function parseMatch(
  directiveType: AmendmentDirectiveType,
  match: RegExpExecArray,
  fullText: string
): ParsedDirective | null {
  const sourceOffset = { start: match.index, end: match.index + match[0].length }

  switch (directiveType) {
    case "REPLACE_ARTICLE": {
      const articleNum = match[1]
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${articleNum}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    case "REPLACE_STAVAK": {
      const [, articleNum, stavakNum] = match
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${articleNum}/stavak:${stavakNum}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    case "INSERT_AFTER": {
      const [, afterArticle, newArticle] = match
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${afterArticle}`,
        insertionNodePath: `/članak:${newArticle}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    case "INSERT_BEFORE": {
      const [, beforeArticle, newArticle] = match
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${beforeArticle}`,
        insertionNodePath: `/članak:${newArticle}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    case "DELETE": {
      const articleNum = match[1]
      const stavakNum = match[2]
      const targetPath = stavakNum
        ? `/članak:${articleNum}/stavak:${stavakNum}`
        : `/članak:${articleNum}`
      return {
        directiveType,
        targetNodePath: targetPath,
        directiveText: match[0],
        confidence: "HIGH",
        sourceOffset,
      }
    }

    case "REPLACE_WORDS": {
      const [, articleNum, stavakNum, searchPattern, replaceWith] = match
      const targetPath = stavakNum
        ? `/članak:${articleNum}/stavak:${stavakNum}`
        : `/članak:${articleNum}`
      return {
        directiveType,
        targetNodePath: targetPath,
        directiveText: match[0],
        searchPattern,
        replaceWith,
        confidence: "HIGH",
        sourceOffset,
      }
    }

    case "ADD_STAVAK": {
      const [, articleNum, , newStavakNum] = match
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${articleNum}`,
        insertionNodePath: `/članak:${articleNum}/stavak:${newStavakNum || match[2]}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    case "ADD_TOCKA": {
      const [, articleNum, stavakNum, tockaId] = match
      const newText = extractQuotedBlock(fullText, match.index + match[0].length)
      return {
        directiveType,
        targetNodePath: `/članak:${articleNum}/stavak:${stavakNum}`,
        insertionNodePath: `/članak:${articleNum}/stavak:${stavakNum}/točka:${tockaId}`,
        directiveText: match[0],
        newText,
        confidence: newText ? "HIGH" : "MEDIUM",
        sourceOffset,
      }
    }

    default:
      return null
  }
}

function extractQuotedBlock(text: string, startIndex: number): string | undefined {
  // Look for text enclosed in quotes after the directive
  const remaining = text.slice(startIndex)

  // Pattern: optional whitespace, then quoted block
  const match = remaining.match(/^\s*"([^"]*(?:"[^"]*"[^"]*)*)"/)

  if (match) {
    return match[1].trim()
  }

  // Alternative: look for text until next directive or end
  const nextDirective = remaining.search(/(?:Članak|U članku|Iza članka|Ispred članka)\s+\d+/i)

  if (nextDirective > 0) {
    const block = remaining.slice(0, nextDirective).trim()
    // Remove leading quote if present
    return block.replace(/^"/, "").replace(/"$/, "").trim() || undefined
  }

  return undefined
}

function mergeOverlappingRanges(ranges: Array<{ start: number; end: number }>) {
  if (ranges.length === 0) return []

  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push(current)
    }
  }

  return merged
}

function looksLikeDirective(text: string): boolean {
  const keywords = [
    "mijenja",
    "briše",
    "dodaje",
    "zamjenjuje",
    "glasi",
    "stavak",
    "točka",
    "članak",
    "članci",
  ]
  const lowerText = text.toLowerCase()
  return keywords.some((k) => lowerText.includes(k))
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- directive-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/consolidation/
git commit -m "feat(consolidation): add amendment directive parser"
```

---

### Task 15: Consolidation Engine Core

**Files:**

- Create: `src/lib/regulatory-truth/consolidation/engine.ts`
- Create: `src/lib/regulatory-truth/consolidation/__tests__/engine.test.ts`

**Step 1: Write the failing test**

```typescript
import { ConsolidationEngine } from "../engine"

describe("ConsolidationEngine", () => {
  const engine = new ConsolidationEngine({
    parserVersion: "test-v1",
    strictMode: false,
    maxAmendmentChain: 100,
  })

  it("consolidates original text without amendments", async () => {
    const baseText = `Članak 1.

Ovaj Zakon uređuje oporezivanje.

Članak 2.

Porez se plaća po stopi od 25%.`

    const result = await engine.consolidate({
      instrumentId: "inst-1",
      baseEvidence: {
        id: "ev-1",
        publishedAt: new Date("2020-01-01"),
        cleanText: baseText,
        nodes: [
          {
            nodePath: "/članak:1",
            startOffset: 0,
            endOffset: 45,
            text: "Članak 1.\n\nOvaj Zakon uređuje oporezivanje.",
          },
          {
            nodePath: "/članak:2",
            startOffset: 47,
            endOffset: 88,
            text: "Članak 2.\n\nPorez se plaća po stopi od 25%.",
          },
        ],
      },
      amendments: [],
    })

    expect(result.success).toBe(true)
    expect(result.articleCount).toBe(2)
    expect(result.contributingEvidenceIds).toEqual(["ev-1"])
  })

  it("applies REPLACE_ARTICLE amendment", async () => {
    const baseText = `Članak 1.

Stopa poreza je 20%.`

    const amendmentText = `Članak 1.

Stopa poreza je 25%.`

    const result = await engine.consolidate({
      instrumentId: "inst-1",
      baseEvidence: {
        id: "ev-1",
        publishedAt: new Date("2020-01-01"),
        cleanText: baseText,
        nodes: [
          {
            nodePath: "/članak:1",
            startOffset: 0,
            endOffset: 30,
            text: "Članak 1.\n\nStopa poreza je 20%.",
          },
        ],
      },
      amendments: [
        {
          evidenceId: "ev-2",
          publishedAt: new Date("2021-01-01"),
          directives: [
            {
              directiveType: "REPLACE_ARTICLE",
              targetNodePath: "/članak:1",
              newText: amendmentText,
              confidence: "HIGH",
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.consolidatedText).toContain("25%")
    expect(result.consolidatedText).not.toContain("20%")
    expect(result.contributingEvidenceIds).toContain("ev-2")
  })

  it("applies DELETE amendment", async () => {
    const baseText = `Članak 1.

Prva odredba.

Članak 2.

Druga odredba.

Članak 3.

Treća odredba.`

    const result = await engine.consolidate({
      instrumentId: "inst-1",
      baseEvidence: {
        id: "ev-1",
        publishedAt: new Date("2020-01-01"),
        cleanText: baseText,
        nodes: [
          {
            nodePath: "/članak:1",
            startOffset: 0,
            endOffset: 25,
            text: "Članak 1.\n\nPrva odredba.",
          },
          {
            nodePath: "/članak:2",
            startOffset: 27,
            endOffset: 54,
            text: "Članak 2.\n\nDruga odredba.",
          },
          {
            nodePath: "/članak:3",
            startOffset: 56,
            endOffset: 83,
            text: "Članak 3.\n\nTreća odredba.",
          },
        ],
      },
      amendments: [
        {
          evidenceId: "ev-2",
          publishedAt: new Date("2021-01-01"),
          directives: [
            {
              directiveType: "DELETE",
              targetNodePath: "/članak:2",
              confidence: "HIGH",
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.consolidatedText).toContain("Prva odredba")
    expect(result.consolidatedText).not.toContain("Druga odredba")
    expect(result.consolidatedText).toContain("Treća odredba")
    expect(result.articleCount).toBe(2)
  })

  it("tracks provenance for each node", async () => {
    const result = await engine.consolidate({
      instrumentId: "inst-1",
      baseEvidence: {
        id: "ev-1",
        publishedAt: new Date("2020-01-01"),
        cleanText: "Članak 1.\n\nTekst.",
        nodes: [
          { nodePath: "/članak:1", startOffset: 0, endOffset: 18, text: "Članak 1.\n\nTekst." },
        ],
      },
      amendments: [],
    })

    expect(result.provenance).toHaveLength(1)
    expect(result.provenance[0]).toMatchObject({
      nodePath: "/članak:1",
      provenance: {
        sourceEvidenceId: "ev-1",
        changeType: "ORIGINAL",
      },
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- consolidation/engine.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the consolidation engine**

```typescript
import { createHash } from "crypto"
import type {
  AmendmentDirectiveType,
  DirectiveConfidence,
  ProvenanceChangeType,
} from "@prisma/client"
import type {
  ConsolidationResult,
  ConsolidationEngineConfig,
  ConsolidatedNode,
  NodeProvenance,
} from "./types"

interface EvidenceInput {
  id: string
  publishedAt: Date
  cleanText: string
  nodes: Array<{
    nodePath: string
    startOffset: number
    endOffset: number
    text: string
  }>
}

interface AmendmentInput {
  evidenceId: string
  publishedAt: Date
  directives: Array<{
    directiveType: AmendmentDirectiveType
    targetNodePath: string
    newText?: string
    searchPattern?: string
    replaceWith?: string
    insertionNodePath?: string
    confidence: DirectiveConfidence
  }>
}

interface ConsolidateInput {
  instrumentId: string
  baseEvidence: EvidenceInput
  amendments: AmendmentInput[]
}

export class ConsolidationEngine {
  constructor(private config: ConsolidationEngineConfig) {}

  async consolidate(input: ConsolidateInput): Promise<ConsolidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const contributingEvidenceIds: string[] = [input.baseEvidence.id]

    // Start with base nodes
    let nodes = new Map<string, ConsolidatedNode>()

    for (const node of input.baseEvidence.nodes) {
      nodes.set(node.nodePath, {
        nodePath: node.nodePath,
        text: node.text,
        startOffset: node.startOffset,
        endOffset: node.endOffset,
        provenance: {
          sourceEvidenceId: input.baseEvidence.id,
          sourceNodePath: node.nodePath,
          sourceStartOffset: node.startOffset,
          sourceEndOffset: node.endOffset,
          changeType: "ORIGINAL",
          changedAt: input.baseEvidence.publishedAt,
        },
        children: [],
      })
    }

    // Sort amendments by publication date
    const sortedAmendments = [...input.amendments].sort(
      (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
    )

    // Apply each amendment in order
    for (const amendment of sortedAmendments) {
      if (sortedAmendments.indexOf(amendment) >= this.config.maxAmendmentChain) {
        warnings.push(`Stopped at ${this.config.maxAmendmentChain} amendments (config limit)`)
        break
      }

      contributingEvidenceIds.push(amendment.evidenceId)

      for (const directive of amendment.directives) {
        const result = this.applyDirective(
          nodes,
          directive,
          amendment.evidenceId,
          amendment.publishedAt
        )

        if (!result.success) {
          if (this.config.strictMode) {
            errors.push(result.error!)
          } else {
            warnings.push(result.error!)
          }
        }
      }
    }

    // Build consolidated text from remaining nodes
    const sortedNodes = Array.from(nodes.values()).sort((a, b) =>
      this.compareNodePaths(a.nodePath, b.nodePath)
    )

    let consolidatedText = ""
    const provenance: ConsolidationResult["provenance"] = []
    let currentOffset = 0

    for (const node of sortedNodes) {
      if (node.provenance.changeType === "DELETED") continue

      const nodeText = node.text + "\n\n"

      provenance.push({
        nodePath: node.nodePath,
        startOffset: currentOffset,
        endOffset: currentOffset + node.text.length,
        provenance: node.provenance,
      })

      consolidatedText += nodeText
      currentOffset += nodeText.length
    }

    consolidatedText = consolidatedText.trim()

    // Count articles
    const articleCount = Array.from(nodes.values()).filter(
      (n) => n.nodePath.match(/^\/članak:\d+[a-z]?$/) && n.provenance.changeType !== "DELETED"
    ).length

    const textHash = createHash("sha256").update(consolidatedText).digest("hex")
    const treeHash = this.computeTreeHash(sortedNodes)

    return {
      success: errors.length === 0,
      consolidatedText,
      textHash,
      provisionTree: sortedNodes.filter((n) => n.provenance.changeType !== "DELETED"),
      treeHash,
      provenance,
      articleCount,
      totalNodes: nodes.size,
      contributingEvidenceIds,
      errors,
      warnings,
    }
  }

  private applyDirective(
    nodes: Map<string, ConsolidatedNode>,
    directive: AmendmentInput["directives"][0],
    amendingEvidenceId: string,
    changedAt: Date
  ): { success: boolean; error?: string } {
    const targetNode = nodes.get(directive.targetNodePath)

    switch (directive.directiveType) {
      case "REPLACE_ARTICLE":
      case "REPLACE_STAVAK": {
        if (!targetNode) {
          return {
            success: false,
            error: `Target ${directive.targetNodePath} not found for REPLACE`,
          }
        }
        if (!directive.newText) {
          return { success: false, error: `No replacement text for ${directive.targetNodePath}` }
        }

        const previousText = targetNode.text
        targetNode.text = directive.newText
        targetNode.provenance = {
          sourceEvidenceId: amendingEvidenceId,
          changeType: "MODIFIED",
          changedAt,
          changedByEvidenceId: amendingEvidenceId,
          previousText,
        }
        return { success: true }
      }

      case "DELETE": {
        if (!targetNode) {
          return {
            success: false,
            error: `Target ${directive.targetNodePath} not found for DELETE`,
          }
        }

        targetNode.provenance = {
          ...targetNode.provenance,
          changeType: "DELETED",
          changedAt,
          changedByEvidenceId: amendingEvidenceId,
          previousText: targetNode.text,
        }
        return { success: true }
      }

      case "INSERT_AFTER":
      case "INSERT_BEFORE": {
        if (!directive.insertionNodePath || !directive.newText) {
          return { success: false, error: `Missing insertion path or text for INSERT` }
        }

        nodes.set(directive.insertionNodePath, {
          nodePath: directive.insertionNodePath,
          text: directive.newText,
          startOffset: 0, // Will be recalculated
          endOffset: directive.newText.length,
          provenance: {
            sourceEvidenceId: amendingEvidenceId,
            changeType: "INSERTED",
            changedAt,
            changedByEvidenceId: amendingEvidenceId,
          },
          children: [],
        })
        return { success: true }
      }

      case "REPLACE_WORDS": {
        if (!targetNode) {
          return {
            success: false,
            error: `Target ${directive.targetNodePath} not found for REPLACE_WORDS`,
          }
        }
        if (!directive.searchPattern || !directive.replaceWith) {
          return { success: false, error: `Missing search/replace pattern for REPLACE_WORDS` }
        }

        if (!targetNode.text.includes(directive.searchPattern)) {
          return {
            success: false,
            error: `Pattern "${directive.searchPattern}" not found in ${directive.targetNodePath}`,
          }
        }

        const previousText = targetNode.text
        targetNode.text = targetNode.text.replace(directive.searchPattern, directive.replaceWith)
        targetNode.provenance = {
          sourceEvidenceId: amendingEvidenceId,
          changeType: "MODIFIED",
          changedAt,
          changedByEvidenceId: amendingEvidenceId,
          previousText,
        }
        return { success: true }
      }

      case "ADD_STAVAK":
      case "ADD_TOCKA": {
        if (!directive.insertionNodePath || !directive.newText) {
          return { success: false, error: `Missing insertion path or text for ADD` }
        }

        nodes.set(directive.insertionNodePath, {
          nodePath: directive.insertionNodePath,
          text: directive.newText,
          startOffset: 0,
          endOffset: directive.newText.length,
          provenance: {
            sourceEvidenceId: amendingEvidenceId,
            changeType: "INSERTED",
            changedAt,
            changedByEvidenceId: amendingEvidenceId,
          },
          children: [],
        })
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown directive type: ${directive.directiveType}` }
    }
  }

  private compareNodePaths(a: string, b: string): number {
    // Parse node paths and compare segment by segment
    const partsA = this.parseNodePath(a)
    const partsB = this.parseNodePath(b)

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      if (i >= partsA.length) return -1
      if (i >= partsB.length) return 1

      const cmp = this.comparePathSegment(partsA[i], partsB[i])
      if (cmp !== 0) return cmp
    }

    return 0
  }

  private parseNodePath(path: string): Array<{ type: string; num: string }> {
    return path
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        const [type, num] = segment.split(":")
        return { type, num }
      })
  }

  private comparePathSegment(
    a: { type: string; num: string },
    b: { type: string; num: string }
  ): number {
    // Compare types first
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type)
    }

    // Compare numbers (handle suffixes like 12a, 12b)
    const numA = parseInt(a.num)
    const numB = parseInt(b.num)

    if (numA !== numB) return numA - numB

    // Same number, compare suffix
    const suffixA = a.num.replace(/^\d+/, "")
    const suffixB = b.num.replace(/^\d+/, "")

    return suffixA.localeCompare(suffixB)
  }

  private computeTreeHash(nodes: ConsolidatedNode[]): string {
    const data = nodes.map((n) => `${n.nodePath}:${n.text.length}`).join("|")
    return createHash("sha256").update(data).digest("hex")
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- consolidation/engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/consolidation/
git commit -m "feat(consolidation): add ConsolidationEngine for applying amendments"
```

---

### Task 16: Consolidation Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/consolidation.worker.ts`

**Step 1: Write the worker**

```typescript
import { Worker, Job } from "bullmq"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { ConsolidationEngine } from "../consolidation/engine"
import { parseAmendmentDirectives } from "../consolidation/directive-parser"
import { createHash } from "crypto"

const QUEUE_NAME = "consolidation"
const CONCURRENCY = 2

interface ConsolidationJobData {
  instrumentId: string
  targetDate?: string
  reason: string
  triggeredBy?: string
}

const engine = new ConsolidationEngine({
  parserVersion: process.env.CONSOLIDATION_VERSION || "v1.0.0",
  strictMode: false,
  maxAmendmentChain: 100,
})

async function processConsolidationJob(job: Job<ConsolidationJobData>) {
  const { instrumentId, targetDate, reason } = job.data

  await job.updateProgress(10)

  // Get instrument with evidence links
  const instrument = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    include: {
      evidenceLinks: {
        where: { confidence: { in: ["HIGH", "MEDIUM"] } },
        orderBy: { publishedAt: "asc" },
        include: {
          evidence: {
            include: {
              parsedDocuments: {
                where: { isLatest: true, status: "SUCCESS" },
                include: { nodes: true },
              },
            },
          },
        },
      },
    },
  })

  if (!instrument) {
    throw new Error(`Instrument ${instrumentId} not found`)
  }

  if (instrument.evidenceLinks.length === 0) {
    throw new Error(`Instrument ${instrumentId} has no evidence links`)
  }

  await job.updateProgress(20)

  // Find the original (base) text
  const originalLink =
    instrument.evidenceLinks.find(
      (l) => l.eventType === "ORIGINAL" || l.eventType === "CONSOLIDATED"
    ) || instrument.evidenceLinks[0]

  const baseParse = originalLink.evidence.parsedDocuments[0]
  if (!baseParse) {
    throw new Error(`No parsed document for base evidence ${originalLink.evidenceId}`)
  }

  // Get clean text artifact
  const cleanTextArtifact = baseParse.cleanTextArtifactId
    ? await prisma.evidenceArtifact.findUnique({
        where: { id: baseParse.cleanTextArtifactId },
      })
    : null

  const baseCleanText = cleanTextArtifact?.content || ""

  await job.updateProgress(30)

  // Collect amendments
  const amendments: Array<{
    evidenceId: string
    publishedAt: Date
    directives: any[]
  }> = []

  for (const link of instrument.evidenceLinks) {
    if (link.id === originalLink.id) continue
    if (link.eventType !== "AMENDMENT") continue

    // Filter by target date if specified
    if (targetDate && link.publishedAt && link.publishedAt > new Date(targetDate)) {
      continue
    }

    const parse = link.evidence.parsedDocuments[0]
    if (!parse) continue

    const artifact = parse.cleanTextArtifactId
      ? await prisma.evidenceArtifact.findUnique({
          where: { id: parse.cleanTextArtifactId },
        })
      : null

    if (!artifact) continue

    // Parse amendment directives from text
    const directiveResult = parseAmendmentDirectives(artifact.content)

    // Store directives in database for audit
    for (const directive of directiveResult.directives) {
      await prisma.amendmentDirective.upsert({
        where: {
          id: `${link.evidenceId}-${directive.targetNodePath}-${directive.directiveType}`,
        },
        create: {
          id: `${link.evidenceId}-${directive.targetNodePath}-${directive.directiveType}`,
          amendingEvidenceId: link.evidenceId,
          targetInstrumentId: instrumentId,
          targetNodePath: directive.targetNodePath,
          directiveType: directive.directiveType,
          directiveText: directive.directiveText,
          newText: directive.newText,
          searchPattern: directive.searchPattern,
          replaceWith: directive.replaceWith,
          insertionNodePath: directive.insertionNodePath,
          confidence: directive.confidence,
          parserVersion: engine["config"].parserVersion,
        },
        update: {},
      })
    }

    if (directiveResult.directives.length > 0) {
      amendments.push({
        evidenceId: link.evidenceId,
        publishedAt: link.publishedAt!,
        directives: directiveResult.directives,
      })
    }
  }

  await job.updateProgress(50)

  // Run consolidation
  const result = await engine.consolidate({
    instrumentId,
    baseEvidence: {
      id: originalLink.evidenceId,
      publishedAt: originalLink.publishedAt!,
      cleanText: baseCleanText,
      nodes: baseParse.nodes.map((n) => ({
        nodePath: n.nodePath,
        startOffset: n.startOffset,
        endOffset: n.endOffset,
        text: n.rawText || "",
      })),
    },
    amendments,
  })

  await job.updateProgress(70)

  if (!result.success && result.errors.length > 0) {
    // Create failed snapshot record
    await prisma.instrumentSnapshot.create({
      data: {
        instrumentId,
        effectiveAt: targetDate ? new Date(targetDate) : new Date(),
        validFrom: targetDate ? new Date(targetDate) : new Date(),
        consolidatedText: "",
        textHash: "",
        provisionTree: [],
        treeHash: "",
        status: "FAILED",
        errorMessage: result.errors.join("\n"),
        computedAt: new Date(),
        computedBy: engine["config"].parserVersion,
      },
    })

    throw new Error(`Consolidation failed: ${result.errors.join(", ")}`)
  }

  await job.updateProgress(80)

  // Determine validity window
  const effectiveAt = targetDate ? new Date(targetDate) : new Date()

  // Find if there's a later snapshot
  const laterSnapshot = await prisma.instrumentSnapshot.findFirst({
    where: {
      instrumentId,
      effectiveAt: { gt: effectiveAt },
      status: "VALID",
    },
    orderBy: { effectiveAt: "asc" },
  })

  // Mark previous snapshot as superseded
  await prisma.instrumentSnapshot.updateMany({
    where: {
      instrumentId,
      status: "VALID",
      effectiveAt: { lt: effectiveAt },
      validUntil: null,
    },
    data: {
      validUntil: effectiveAt,
    },
  })

  // Create snapshot
  const snapshot = await prisma.instrumentSnapshot.create({
    data: {
      instrumentId,
      effectiveAt,
      validFrom: effectiveAt,
      validUntil: laterSnapshot?.effectiveAt || null,
      consolidatedText: result.consolidatedText,
      textHash: result.textHash,
      provisionTree: result.provisionTree as any,
      treeHash: result.treeHash,
      articleCount: result.articleCount,
      totalNodes: result.totalNodes,
      contributingEvidenceIds: result.contributingEvidenceIds,
      status: "VALID",
      computedAt: new Date(),
      computedBy: engine["config"].parserVersion,
    },
  })

  await job.updateProgress(90)

  // Create provenance records
  for (const p of result.provenance) {
    await prisma.snapshotProvenance.create({
      data: {
        snapshotId: snapshot.id,
        nodePath: p.nodePath,
        startOffset: p.startOffset,
        endOffset: p.endOffset,
        sourceEvidenceId: p.provenance.sourceEvidenceId,
        sourceNodePath: p.provenance.sourceNodePath,
        sourceStartOffset: p.provenance.sourceStartOffset,
        sourceEndOffset: p.provenance.sourceEndOffset,
        changeType: p.provenance.changeType,
        changedAt: p.provenance.changedAt,
        changedByEvidenceId: p.provenance.changedByEvidenceId,
        previousText: p.provenance.previousText,
      },
    })
  }

  // Update compute job
  await prisma.snapshotComputeJob.updateMany({
    where: {
      instrumentId,
      status: "RUNNING",
    },
    data: {
      status: "COMPLETED",
      resultSnapshotId: snapshot.id,
      completedAt: new Date(),
    },
  })

  await job.updateProgress(100)

  return {
    snapshotId: snapshot.id,
    articleCount: result.articleCount,
    warnings: result.warnings,
  }
}

export function startConsolidationWorker() {
  const worker = new Worker<ConsolidationJobData>(QUEUE_NAME, processConsolidationJob, {
    connection: redis,
    concurrency: CONCURRENCY,
  })

  worker.on("completed", (job, result) => {
    console.log(`[consolidation] Job ${job.id} completed: snapshot ${result.snapshotId}`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[consolidation] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/
git commit -m "feat(workers): add consolidation worker for computing snapshots"
```

---

### Task 17: Snapshot Compute Job Scheduler

**Files:**

- Create: `src/lib/regulatory-truth/scripts/schedule-consolidation.ts`

**Step 1: Write the scheduler script**

```typescript
import { prisma } from "@/lib/db"
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

const consolidationQueue = new Queue("consolidation", { connection: redis })

async function scheduleConsolidation() {
  console.log("Checking for instruments needing consolidation...")

  // Find instruments with new amendments that don't have current snapshots
  const instrumentsNeedingUpdate = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT DISTINCT i.id, i.title
    FROM "Instrument" i
    JOIN "InstrumentEvidenceLink" iel ON iel."instrumentId" = i.id
    LEFT JOIN "InstrumentSnapshot" snap ON snap."instrumentId" = i.id AND snap.status = 'VALID'
    WHERE iel."eventType" = 'AMENDMENT'
      AND iel.confidence IN ('HIGH', 'MEDIUM')
      AND (
        snap.id IS NULL
        OR iel."publishedAt" > snap."computedAt"
      )
  `

  console.log(`Found ${instrumentsNeedingUpdate.length} instruments needing consolidation`)

  for (const instrument of instrumentsNeedingUpdate) {
    // Check if job already exists
    const existingJob = await prisma.snapshotComputeJob.findFirst({
      where: {
        instrumentId: instrument.id,
        status: { in: ["PENDING", "RUNNING"] },
      },
    })

    if (existingJob) {
      console.log(`  Skipping ${instrument.title} - job already pending`)
      continue
    }

    // Create job record
    const job = await prisma.snapshotComputeJob.create({
      data: {
        instrumentId: instrument.id,
        reason: "NEW_AMENDMENT",
        priority: 0,
        status: "PENDING",
      },
    })

    // Queue for processing
    await consolidationQueue.add(
      "consolidate",
      {
        instrumentId: instrument.id,
        reason: "NEW_AMENDMENT",
      },
      {
        jobId: job.id,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      }
    )

    console.log(`  Queued consolidation for ${instrument.title}`)
  }

  // Also check for manual recompute requests
  const manualJobs = await prisma.snapshotComputeJob.findMany({
    where: {
      status: "PENDING",
      reason: "MANUAL",
    },
  })

  for (const job of manualJobs) {
    await consolidationQueue.add(
      "consolidate",
      {
        instrumentId: job.instrumentId,
        targetDate: job.targetDate?.toISOString(),
        reason: job.reason,
        triggeredBy: job.triggeredBy || undefined,
      },
      {
        jobId: job.id,
        priority: 10, // Higher priority for manual requests
        attempts: 3,
      }
    )

    await prisma.snapshotComputeJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    })

    console.log(`  Queued manual consolidation job ${job.id}`)
  }

  console.log("Done scheduling consolidation jobs")
}

// Run if called directly
if (require.main === module) {
  scheduleConsolidation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to schedule consolidation:", err)
      process.exit(1)
    })
}

export { scheduleConsolidation }
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/scripts/
git commit -m "feat(scripts): add consolidation job scheduler"
```

---

### Task 18: Integration Test

**Files:**

- Create: `src/lib/regulatory-truth/consolidation/__tests__/integration.db.test.ts`

**Step 1: Write the integration test**

```typescript
import { prisma } from "@/lib/db"
import { ConsolidationEngine } from "../engine"
import { parseAmendmentDirectives } from "../directive-parser"

describe("Consolidation Integration", () => {
  const engine = new ConsolidationEngine({
    parserVersion: "test-v1",
    strictMode: false,
    maxAmendmentChain: 100,
  })

  let testInstrumentId: string
  let testEvidenceIds: string[] = []

  beforeAll(async () => {
    // Create test instrument
    const instrument = await prisma.instrument.create({
      data: {
        canonicalId: `test-${Date.now()}`,
        title: "Zakon o porezu na dodanu vrijednost (test)",
      },
    })
    testInstrumentId = instrument.id

    // Create test evidence (original)
    const originalEvidence = await prisma.evidence.create({
      data: {
        sourceId: "test-source",
        sourceKey: `nn:test:${Date.now()}:1`,
        url: "https://example.com/test",
        rawContent: "<html>Original</html>",
        contentHash: "hash1",
      },
    })
    testEvidenceIds.push(originalEvidence.id)

    // Create test evidence (amendment)
    const amendmentEvidence = await prisma.evidence.create({
      data: {
        sourceId: "test-source",
        sourceKey: `nn:test:${Date.now()}:2`,
        url: "https://example.com/test-amend",
        rawContent: "<html>Amendment</html>",
        contentHash: "hash2",
      },
    })
    testEvidenceIds.push(amendmentEvidence.id)

    // Link evidence to instrument
    await prisma.instrumentEvidenceLink.create({
      data: {
        instrumentId: instrument.id,
        evidenceId: originalEvidence.id,
        method: "MANUAL",
        confidence: "HIGH",
        eventType: "ORIGINAL",
        publishedAt: new Date("2020-01-01"),
      },
    })

    await prisma.instrumentEvidenceLink.create({
      data: {
        instrumentId: instrument.id,
        evidenceId: amendmentEvidence.id,
        method: "MANUAL",
        confidence: "HIGH",
        eventType: "AMENDMENT",
        publishedAt: new Date("2021-01-01"),
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.snapshotProvenance.deleteMany({
      where: { snapshot: { instrumentId: testInstrumentId } },
    })
    await prisma.instrumentSnapshot.deleteMany({
      where: { instrumentId: testInstrumentId },
    })
    await prisma.amendmentDirective.deleteMany({
      where: { targetInstrumentId: testInstrumentId },
    })
    await prisma.instrumentEvidenceLink.deleteMany({
      where: { instrumentId: testInstrumentId },
    })
    await prisma.instrument.delete({
      where: { id: testInstrumentId },
    })
    await prisma.evidence.deleteMany({
      where: { id: { in: testEvidenceIds } },
    })
  })

  it("creates snapshot with provenance", async () => {
    const result = await engine.consolidate({
      instrumentId: testInstrumentId,
      baseEvidence: {
        id: testEvidenceIds[0],
        publishedAt: new Date("2020-01-01"),
        cleanText: "Članak 1.\n\nPorezi se plaćaju.",
        nodes: [
          {
            nodePath: "/članak:1",
            startOffset: 0,
            endOffset: 30,
            text: "Članak 1.\n\nPorezi se plaćaju.",
          },
        ],
      },
      amendments: [],
    })

    expect(result.success).toBe(true)
    expect(result.consolidatedText).toContain("Porezi se plaćaju")
    expect(result.provenance).toHaveLength(1)
    expect(result.provenance[0].provenance.changeType).toBe("ORIGINAL")
  })

  it("parses Croatian amendment directives", () => {
    const amendmentText = `
Članak 2.

U članku 5. stavku 1. riječi "deset dana" zamjenjuju se riječima "petnaest dana".

Članak 3.

Članak 10. briše se.
    `

    const result = parseAmendmentDirectives(amendmentText)

    expect(result.directives.length).toBeGreaterThanOrEqual(2)

    const replaceWords = result.directives.find((d) => d.directiveType === "REPLACE_WORDS")
    expect(replaceWords).toBeDefined()
    expect(replaceWords?.searchPattern).toBe("deset dana")
    expect(replaceWords?.replaceWith).toBe("petnaest dana")

    const deleteDirective = result.directives.find((d) => d.directiveType === "DELETE")
    expect(deleteDirective).toBeDefined()
    expect(deleteDirective?.targetNodePath).toBe("/članak:10")
  })
})
```

**Step 2: Run the integration test**

Run: `npm test -- consolidation/integration.db.test.ts`
Expected: PASS (may need database setup)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/consolidation/
git commit -m "test(consolidation): add integration test for snapshot creation"
```

---

## Exit Criteria Verification

> **⚠️ AUDIT FIX:** Exit criteria now include inputsHash storage and range provenance verification.

| Criteria                                             | Verification                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Phase 4 gate passed**                              | Phase 4 SLOs met for 7 consecutive days before starting Phase 5                                     |
| InstrumentSnapshot model with provenance             | `SELECT COUNT(*) FROM "InstrumentSnapshot"` returns > 0 after running consolidation                 |
| Amendment directive parser handles Croatian patterns | Unit tests pass for REPLACE_ARTICLE, INSERT_AFTER, DELETE, REPLACE_WORDS                            |
| Consolidation engine applies amendments in order     | Engine test shows correct text after applying amendments                                            |
| **Provenance uses ranges, not per-char**             | SnapshotProvenance records have (startOffset, endOffset) ranges; rendering is O(m)                  |
| **inputsHash and engineVersion stored**              | `SELECT id, "inputsHash", "engineVersion" FROM "InstrumentSnapshot" LIMIT 5;` shows non-null values |
| As-of date browsing works                            | Navigate to `/nn-browser/instruments/{id}/as-of?date=2023-01-01`                                    |
| Version diff shows changes                           | Navigate to `/nn-browser/instruments/{id}/diff` with two snapshots                                  |
| Changelog lists all amendments                       | Navigate to `/nn-browser/instruments/{id}/changelog`                                                |
| **CONSOLIDATED baseline used**                       | Initial snapshots built from CONSOLIDATED event type, not ORIGINAL                                  |

---

## Dependency Order

```
Task 1-5 (Schema) → Task 6 (Migration) → Task 13-15 (Engine) → Task 16-17 (Worker)
                                       ↘
                                         Task 7-12 (UI) ← depends on schema only
```

UI tasks (7-12) can run in parallel with engine tasks (13-17) after migration completes.

---

## Notes for Implementer

1. **⚠️ AUDIT FIX - Phase 4 Gate**: DO NOT start Phase 5 until Phase 4 exit criteria (offset integrity ≥99%, node coverage ≥90%, etc.) have been met for 7 consecutive days. This ensures the foundation is stable before building snapshots.

2. **⚠️ AUDIT FIX - Use CONSOLIDATED baseline**: When building initial snapshots, prefer CONSOLIDATED event type (pročišćeni tekst) as the baseline rather than ORIGINAL + amendments. This reduces amendment application complexity and starts from a known-good state.

   ```typescript
   // In findBaselineEvidence():
   const consolidated = links.find((l) => l.eventType === "CONSOLIDATED")
   if (consolidated) {
     return consolidated // Prefer consolidated as baseline
   }
   return links.find((l) => l.eventType === "ORIGINAL") // Fallback to original
   ```

3. **⚠️ AUDIT FIX - Diff package**: Install `diff` package (not `diff-match-patch`): `npm install diff @types/diff`. The plan uses `diffLines` from `diff` package.

4. **⚠️ AUDIT FIX - inputsHash computation**: Compute inputsHash as hash of sorted (evidenceId, cleanTextHash) pairs. This ensures reproducibility - same inputs should produce same snapshot.

   ```typescript
   function computeInputsHash(evidence: Array<{ id: string; cleanTextHash: string }>): string {
     const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id))
     const input = sorted.map((e) => `${e.id}:${e.cleanTextHash}`).join("|")
     return createHash("sha256").update(input).digest("hex")
   }
   ```

5. **⚠️ AUDIT FIX - Range provenance rendering**: The SnapshotViewer uses O(m) range-based rendering where m = number of provenance records, not O(n) per-character. This is critical for large texts.

6. **Amendment directive coverage**: Current implementation covers REPLACE_ARTICLE, INSERT_AFTER, DELETE. Tables and annexes amendments (⚠️ AUDIT: mentioned as needing expanded coverage) should be added in a follow-up iteration.
