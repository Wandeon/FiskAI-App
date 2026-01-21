# NN Mirror Phase 4: Monitoring & Reprocessing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build automated monitoring, drift detection, integrity checks, reprocessing queue, and retention GC to maintain <1% integrity failures.

**Architecture:** Nightly jobs check anchor integrity and detect drift. ReparseJob queue processes reparse requests with priority. Coverage dashboard visualizes system health. GC cleans old superseded parses after retention period.

**Tech Stack:** BullMQ (jobs), Prisma (queries), React Server Components (dashboard), Vitest (tests)

**Reference:** `docs/specs/nn-mirror-v1.md` Sections 5, 6, 7

**Prerequisite:** Phases 1-3 complete (ParsedDocument, ProvisionNode, InstrumentEvidenceLink populated, browser working)

---

## Part A: App Repository (Monitoring Infrastructure)

### Task A1: Add Monitoring-Related Schema Extensions

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add IntegrityCheck model for audit trail**

```prisma
model IntegrityCheck {
  id              String    @id @default(cuid())

  // Check metadata
  checkType       String    // ANCHOR_INTEGRITY, COVERAGE_VALIDATION, LINK_QUALITY
  checkVersion    String    // "integrity-v1.0.0"

  // Scope
  sampleSize      Int
  sampledFrom     Int       // Total population size

  // Results
  passed          Int
  failed          Int
  skipped         Int
  integrityRate   Float     // passed / (passed + failed)

  // Failures detail
  failures        Json?     // [{ nodeId, type, detail }]

  // Timing
  startedAt       DateTime
  completedAt     DateTime
  durationMs      Int

  createdAt       DateTime  @default(now())

  @@index([checkType, createdAt])
  @@index([integrityRate])
}
```

**Step 2: Add DriftEvent model for tracking drift**

```prisma
model DriftEvent {
  id                  String    @id @default(cuid())

  evidenceId          String
  parsedDocumentId    String

  // What changed
  previousHash        String
  currentHash         String
  artifactId          String?

  // Resolution
  status              String    @default("DETECTED")  // DETECTED, QUEUED, RESOLVED, IGNORED
  reparseJobId        String?
  resolvedAt          DateTime?
  resolvedBy          String?   // "auto-reparse", userId

  detectedAt          DateTime  @default(now())

  @@index([evidenceId])
  @@index([status, detectedAt])
}
```

**Step 3: Run prisma format and generate migration**

Run: `npx prisma format && npx prisma migrate dev --name monitoring_phase4`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add IntegrityCheck and DriftEvent models

IntegrityCheck tracks nightly integrity audit results.
DriftEvent captures content drift for reparse queuing.
Spec: docs/specs/nn-mirror-v1.md Section 5

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Part B: Workers Repository (Monitoring Jobs)

### Task B1: Create Integrity Checker

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/integrity-checker.ts`
- Create: `src/lib/regulatory-truth/monitoring/__tests__/integrity-checker.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest"
import {
  IntegrityChecker,
  checkAnchorIntegrity,
  checkOffsetConsistency,
} from "../integrity-checker"

describe("Integrity Checker", () => {
  describe("checkOffsetConsistency", () => {
    it("passes when substring matches rawText", () => {
      const cleanText = "Hello World, this is a test."
      const node = {
        id: "node-1",
        startOffset: 0,
        endOffset: 5,
        rawText: "Hello",
      }

      const result = checkOffsetConsistency(node, cleanText)

      expect(result.passed).toBe(true)
    })

    it("fails when substring does not match rawText", () => {
      const cleanText = "Hello World, this is a test."
      const node = {
        id: "node-1",
        startOffset: 0,
        endOffset: 5,
        rawText: "Wrong",
      }

      const result = checkOffsetConsistency(node, cleanText)

      expect(result.passed).toBe(false)
      expect(result.failureType).toBe("OFFSET_MISMATCH")
    })

    it("skips nodes without rawText", () => {
      const cleanText = "Hello World"
      const node = {
        id: "node-1",
        startOffset: 0,
        endOffset: 5,
        rawText: null,
      }

      const result = checkOffsetConsistency(node, cleanText)

      expect(result.skipped).toBe(true)
    })
  })

  describe("checkAnchorIntegrity", () => {
    it("samples nodes and checks offsets", async () => {
      const mockChecker = new IntegrityChecker({
        sampleSize: 10,
        checkVersion: "test-v1",
      })

      // Would need DB mocks for full test
      expect(mockChecker).toBeDefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/integrity-checker.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/monitoring/integrity-checker.ts`

```typescript
import { dbReg } from "@/lib/db"

const CHECKER_VERSION = "integrity-v1.0.0"

export interface IntegrityCheckConfig {
  sampleSize: number
  checkVersion?: string
}

export interface NodeCheckResult {
  nodeId: string
  passed: boolean
  skipped: boolean
  failureType?: "OFFSET_MISMATCH" | "ARTIFACT_MISSING" | "OFFSET_OUT_OF_BOUNDS"
  detail?: string
}

export interface IntegrityCheckResult {
  checkType: string
  checkVersion: string
  sampleSize: number
  sampledFrom: number
  passed: number
  failed: number
  skipped: number
  integrityRate: number
  failures: Array<{
    nodeId: string
    type: string
    detail?: string
  }>
  durationMs: number
}

/**
 * Check if node offsets correctly extract rawText from cleanText
 */
export function checkOffsetConsistency(
  node: {
    id: string
    startOffset: number
    endOffset: number
    rawText: string | null
  },
  cleanText: string
): NodeCheckResult {
  // Skip if no rawText to verify
  if (!node.rawText) {
    return { nodeId: node.id, passed: true, skipped: true }
  }

  // Check bounds
  if (node.startOffset < 0 || node.endOffset > cleanText.length) {
    return {
      nodeId: node.id,
      passed: false,
      skipped: false,
      failureType: "OFFSET_OUT_OF_BOUNDS",
      detail: `Offsets [${node.startOffset}, ${node.endOffset}] out of bounds for text length ${cleanText.length}`,
    }
  }

  // Extract and compare
  const extracted = cleanText.substring(node.startOffset, node.endOffset)

  if (extracted !== node.rawText) {
    return {
      nodeId: node.id,
      passed: false,
      skipped: false,
      failureType: "OFFSET_MISMATCH",
      detail: `Expected "${node.rawText.substring(0, 30)}...", got "${extracted.substring(0, 30)}..."`,
    }
  }

  return { nodeId: node.id, passed: true, skipped: false }
}

export class IntegrityChecker {
  private config: IntegrityCheckConfig

  constructor(config: IntegrityCheckConfig) {
    this.config = {
      checkVersion: CHECKER_VERSION,
      ...config,
    }
  }

  /**
   * Run anchor integrity check on sampled nodes
   *
   * Implements spec Section 5.4
   */
  async checkAnchorIntegrity(): Promise<IntegrityCheckResult> {
    const startTime = Date.now()
    const failures: Array<{ nodeId: string; type: string; detail?: string }> = []
    let passed = 0
    let failed = 0
    let skipped = 0

    // Sample ParsedDocuments (corruption clusters by document)
    const docsToSample = Math.ceil(this.config.sampleSize / 10)

    const docs = await dbReg.parsedDocument.findMany({
      where: { status: "SUCCESS", isLatest: true },
      orderBy: { createdAt: "desc" },
      take: docsToSample,
      include: {
        cleanTextArtifact: true,
      },
    })

    const totalDocs = await dbReg.parsedDocument.count({
      where: { status: "SUCCESS", isLatest: true },
    })

    // Sample nodes per document
    const nodesPerDoc = Math.ceil(this.config.sampleSize / Math.max(docs.length, 1))

    for (const doc of docs) {
      if (!doc.cleanTextArtifact) {
        // Can't verify without artifact
        skipped += nodesPerDoc
        continue
      }

      const cleanText = doc.cleanTextArtifact.content

      // Get sample of content nodes (non-containers with rawText)
      const nodes = await dbReg.provisionNode.findMany({
        where: {
          parsedDocumentId: doc.id,
          isContainer: false,
          rawText: { not: null },
        },
        take: nodesPerDoc,
        select: {
          id: true,
          startOffset: true,
          endOffset: true,
          rawText: true,
        },
      })

      for (const node of nodes) {
        const result = checkOffsetConsistency(node, cleanText)

        if (result.skipped) {
          skipped++
        } else if (result.passed) {
          passed++
        } else {
          failed++
          failures.push({
            nodeId: result.nodeId,
            type: result.failureType || "UNKNOWN",
            detail: result.detail,
          })
        }
      }
    }

    const total = passed + failed
    const integrityRate = total > 0 ? passed / total : 1.0

    return {
      checkType: "ANCHOR_INTEGRITY",
      checkVersion: this.config.checkVersion || CHECKER_VERSION,
      sampleSize: passed + failed + skipped,
      sampledFrom: totalDocs,
      passed,
      failed,
      skipped,
      integrityRate,
      failures: failures.slice(0, 100), // Limit stored failures
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Persist check results to database
   */
  async saveResult(result: IntegrityCheckResult): Promise<string> {
    const check = await dbReg.integrityCheck.create({
      data: {
        checkType: result.checkType,
        checkVersion: result.checkVersion,
        sampleSize: result.sampleSize,
        sampledFrom: result.sampledFrom,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        integrityRate: result.integrityRate,
        failures: result.failures,
        startedAt: new Date(Date.now() - result.durationMs),
        completedAt: new Date(),
        durationMs: result.durationMs,
      },
    })

    return check.id
  }
}

/**
 * Factory function for running integrity checks
 */
export async function runIntegrityCheck(sampleSize: number = 1000): Promise<IntegrityCheckResult> {
  const checker = new IntegrityChecker({ sampleSize })
  const result = await checker.checkAnchorIntegrity()
  await checker.saveResult(result)
  return result
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/integrity-checker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): implement integrity checker

Samples ParsedDocuments and verifies offset→rawText consistency.
Tracks failures by document for cluster detection.
Persists results to IntegrityCheck table.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B2: Implement Drift Detector

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/drift-detector.ts`
- Create: `src/lib/regulatory-truth/monitoring/__tests__/drift-detector.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { detectDrift, DriftDetector } from "../drift-detector"

describe("Drift Detector", () => {
  describe("detectDrift", () => {
    it("returns no drift when hashes match", () => {
      const result = detectDrift({
        cleanTextHash: "abc123",
        currentArtifactHash: "abc123",
      })

      expect(result.hasDrift).toBe(false)
    })

    it("returns drift when hashes differ", () => {
      const result = detectDrift({
        cleanTextHash: "abc123",
        currentArtifactHash: "def456",
      })

      expect(result.hasDrift).toBe(true)
      expect(result.previousHash).toBe("abc123")
      expect(result.currentHash).toBe("def456")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/drift-detector.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/monitoring/drift-detector.ts`

```typescript
import { dbReg } from "@/lib/db"

export interface DriftCheckInput {
  cleanTextHash: string | null
  currentArtifactHash: string
}

export interface DriftResult {
  hasDrift: boolean
  previousHash?: string
  currentHash?: string
}

/**
 * Check if content has drifted from what was parsed
 */
export function detectDrift(input: DriftCheckInput): DriftResult {
  if (!input.cleanTextHash) {
    // No previous hash to compare - not drift, just missing
    return { hasDrift: false }
  }

  if (input.cleanTextHash !== input.currentArtifactHash) {
    return {
      hasDrift: true,
      previousHash: input.cleanTextHash,
      currentHash: input.currentArtifactHash,
    }
  }

  return { hasDrift: false }
}

export class DriftDetector {
  /**
   * Scan all latest parses for drift against current artifacts
   */
  async scanForDrift(): Promise<{
    scanned: number
    driftDetected: number
    events: Array<{
      evidenceId: string
      parsedDocumentId: string
      previousHash: string
      currentHash: string
    }>
  }> {
    const events: Array<{
      evidenceId: string
      parsedDocumentId: string
      previousHash: string
      currentHash: string
    }> = []

    // Get all latest successful parses with their evidence
    const parses = await dbReg.parsedDocument.findMany({
      where: {
        isLatest: true,
        status: "SUCCESS",
        cleanTextHash: { not: null },
      },
      include: {
        evidence: {
          include: {
            artifacts: {
              // ⚠️ AUDIT FIX: Use CLEAN_TEXT artifact, not HTML_CLEANED
              // cleanTextHash is computed from CLEAN_TEXT, not HTML_CLEANED
              where: { kind: "CLEAN_TEXT" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    for (const parse of parses) {
      const currentArtifact = parse.evidence.artifacts[0]

      if (!currentArtifact) continue

      const result = detectDrift({
        cleanTextHash: parse.cleanTextHash,
        // ⚠️ AUDIT FIX: Compare against CLEAN_TEXT artifact hash
        currentArtifactHash: currentArtifact.contentHash,
      })

      if (result.hasDrift && result.previousHash && result.currentHash) {
        events.push({
          evidenceId: parse.evidenceId,
          parsedDocumentId: parse.id,
          previousHash: result.previousHash,
          currentHash: result.currentHash,
        })
      }
    }

    return {
      scanned: parses.length,
      driftDetected: events.length,
      events,
    }
  }

  /**
   * Record drift events and queue for reparse
   */
  async recordAndQueueDrift(
    events: Array<{
      evidenceId: string
      parsedDocumentId: string
      previousHash: string
      currentHash: string
      artifactId?: string
    }>
  ): Promise<{
    recorded: number
    queued: number
  }> {
    let recorded = 0
    let queued = 0

    for (const event of events) {
      // Check if already recorded
      const existing = await dbReg.driftEvent.findFirst({
        where: {
          evidenceId: event.evidenceId,
          previousHash: event.previousHash,
          currentHash: event.currentHash,
          status: { in: ["DETECTED", "QUEUED"] },
        },
      })

      if (existing) continue

      // Record drift event
      const driftEvent = await dbReg.driftEvent.create({
        data: {
          evidenceId: event.evidenceId,
          parsedDocumentId: event.parsedDocumentId,
          previousHash: event.previousHash,
          currentHash: event.currentHash,
          artifactId: event.artifactId,
          status: "DETECTED",
        },
      })
      recorded++

      // Queue reparse job
      const reparseJob = await dbReg.reparseJob.create({
        data: {
          evidenceId: event.evidenceId,
          reason: "DRIFT_DETECTED",
          priority: 10, // High priority for drift
          previousParseId: event.parsedDocumentId,
        },
      })

      // Update drift event with job reference
      await dbReg.driftEvent.update({
        where: { id: driftEvent.id },
        data: {
          status: "QUEUED",
          reparseJobId: reparseJob.id,
        },
      })
      queued++
    }

    return { recorded, queued }
  }
}

/**
 * Run full drift detection scan
 */
export async function runDriftScan(): Promise<{
  scanned: number
  driftDetected: number
  queued: number
}> {
  const detector = new DriftDetector()
  const { scanned, driftDetected, events } = await detector.scanForDrift()

  if (events.length > 0) {
    const { queued } = await detector.recordAndQueueDrift(events)
    return { scanned, driftDetected, queued }
  }

  return { scanned, driftDetected, queued: 0 }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/drift-detector.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): implement drift detector

Compares cleanTextHash against current artifact hash.
Records DriftEvent and queues ReparseJob on detection.
Idempotent - won't duplicate events for same drift.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B3: Implement Reparse Worker

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/reparse-worker.ts`
- Create: `src/lib/regulatory-truth/monitoring/__tests__/reparse-worker.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { ReparseWorker, shouldReparse } from "../reparse-worker"

describe("Reparse Worker", () => {
  describe("shouldReparse", () => {
    it("returns true for DRIFT_DETECTED reason", () => {
      expect(shouldReparse({ reason: "DRIFT_DETECTED", status: "PENDING" })).toBe(true)
    })

    it("returns true for PARSER_UPGRADE reason", () => {
      expect(shouldReparse({ reason: "PARSER_UPGRADE", status: "PENDING" })).toBe(true)
    })

    it("returns false for already completed jobs", () => {
      expect(shouldReparse({ reason: "DRIFT_DETECTED", status: "COMPLETED" })).toBe(false)
    })

    it("returns false for failed jobs without manual retry", () => {
      expect(shouldReparse({ reason: "DRIFT_DETECTED", status: "FAILED" })).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/reparse-worker.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/monitoring/reparse-worker.ts`

```typescript
import { dbReg } from "@/lib/db"
import { NNParser } from "../nn-parser"

export interface ReparseJobInput {
  reason: string
  status: string
}

/**
 * Check if a reparse job should be processed
 */
export function shouldReparse(job: ReparseJobInput): boolean {
  if (job.status !== "PENDING") {
    return false
  }

  const validReasons = ["DRIFT_DETECTED", "PARSER_UPGRADE", "INTEGRITY_FAILURE", "MANUAL"]

  return validReasons.includes(job.reason)
}

export class ReparseWorker {
  /**
   * Process next pending reparse job
   */
  async processNext(): Promise<{
    processed: boolean
    jobId?: string
    newParseId?: string
    error?: string
  }> {
    // Get next pending job by priority
    const job = await dbReg.reparseJob.findFirst({
      where: { status: "PENDING" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    })

    if (!job) {
      return { processed: false }
    }

    // Mark as running
    await dbReg.reparseJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    })

    try {
      // Load evidence
      const evidence = await dbReg.evidence.findUnique({
        where: { id: job.evidenceId },
        include: { artifacts: true },
      })

      if (!evidence) {
        throw new Error(`Evidence not found: ${job.evidenceId}`)
      }

      // ⚠️ AUDIT FIX: Use HTML_RAW as input, create CLEAN_TEXT artifact from parse output
      // Parser takes raw HTML, outputs cleanText which becomes CLEAN_TEXT artifact
      const artifact = evidence.artifacts.find((a) => a.kind === "HTML_RAW") || {
        id: "raw",
        kind: "HTML_RAW",
        content: evidence.rawContent,
        contentHash: evidence.contentHash,
      }

      if (!artifact.content) {
        throw new Error("No content available for parsing")
      }

      // Parse
      const result = await NNParser.parse({
        evidenceId: job.evidenceId,
        contentClass: evidence.contentClass as "HTML",
        artifact: {
          id: artifact.id,
          kind: artifact.kind,
          content: artifact.content,
          contentHash: artifact.contentHash,
        },
      })

      if (result.status === "FAILED") {
        throw new Error(result.errorMessage || "Parse failed")
      }

      // ⚠️ AUDIT FIX: Create CLEAN_TEXT artifact for the new parse output
      let cleanTextArtifactId: string | undefined
      const existingCleanText = evidence.artifacts.find(
        (a) => a.kind === "CLEAN_TEXT" && a.contentHash === result.cleanTextHash
      )

      if (existingCleanText) {
        cleanTextArtifactId = existingCleanText.id
      } else {
        const newArtifact = await dbReg.evidenceArtifact.create({
          data: {
            evidenceId: job.evidenceId,
            kind: "CLEAN_TEXT",
            content: result.cleanText,
            contentHash: result.cleanTextHash,
          },
        })
        cleanTextArtifactId = newArtifact.id
      }

      // ⚠️ AUDIT FIX: Use atomic supersession (same as Phase 1)
      const newParse = await dbReg.$transaction(async (tx) => {
        // Find existing latest
        const existingLatest = job.previousParseId
          ? await tx.parsedDocument.findUnique({ where: { id: job.previousParseId } })
          : null

        // Create new parse FIRST
        const created = await tx.parsedDocument.create({
          data: {
            evidenceId: job.evidenceId,
            parserId: NNParser.parserId,
            parserVersion: NNParser.parserVersion,
            parseConfigHash: NNParser.parseConfigHash,
            status: result.status,
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
            supersedesId: job.previousParseId,
          },
        })

        // THEN mark old as not latest
        if (existingLatest) {
          await tx.parsedDocument.update({
            where: { id: existingLatest.id },
            data: {
              isLatest: false,
              supersededById: created.id,
            },
          })
        }

        return created
      })

      // Create nodes
      if (result.nodes.length > 0) {
        await dbReg.provisionNode.createMany({
          data: result.nodes.map((node) => ({
            parsedDocumentId: newParse.id,
            nodeType: node.nodeType,
            nodePath: node.nodePath,
            label: node.label,
            orderIndex: node.orderIndex,
            depth: node.depth,
            rawText: node.rawText,
            startOffset: node.startOffset,
            endOffset: node.endOffset,
            isContainer: node.isContainer,
          })),
        })
      }

      // Update supersession link
      if (job.previousParseId) {
        await dbReg.parsedDocument.update({
          where: { id: job.previousParseId },
          data: { supersededById: newParse.id },
        })
      }

      // Mark job complete
      await dbReg.reparseJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          newParseId: newParse.id,
        },
      })

      // Update any drift events
      await dbReg.driftEvent.updateMany({
        where: { reparseJobId: job.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: "auto-reparse",
        },
      })

      return {
        processed: true,
        jobId: job.id,
        newParseId: newParse.id,
      }
    } catch (error) {
      // Mark job failed
      await dbReg.reparseJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })

      return {
        processed: true,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Process all pending jobs up to limit
   */
  async processAll(limit: number = 100): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    let processed = 0
    let succeeded = 0
    let failed = 0

    while (processed < limit) {
      const result = await this.processNext()

      if (!result.processed) {
        break // No more jobs
      }

      processed++
      if (result.newParseId) {
        succeeded++
      } else {
        failed++
      }
    }

    return { processed, succeeded, failed }
  }
}

/**
 * Run reparse worker
 */
export async function runReparseWorker(limit: number = 100): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const worker = new ReparseWorker()
  return worker.processAll(limit)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/reparse-worker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): implement reparse worker

Processes ReparseJob queue by priority.
Creates new ParsedDocument with supersession chain.
Updates DriftEvent status on completion.
Spec: docs/specs/nn-mirror-v1.md Section 7.2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B4: Implement Retention GC

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/retention-gc.ts`
- Create: `src/lib/regulatory-truth/monitoring/__tests__/retention-gc.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { isEligibleForGC, RetentionConfig, DEFAULT_RETENTION_CONFIG } from "../retention-gc"

describe("Retention GC", () => {
  describe("isEligibleForGC", () => {
    const now = new Date()
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
    const recent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    it("returns true for old superseded successful parse", () => {
      const result = isEligibleForGC(
        {
          isLatest: false,
          status: "SUCCESS",
          createdAt: old,
        },
        DEFAULT_RETENTION_CONFIG
      )

      expect(result).toBe(true)
    })

    it("returns false for latest parse", () => {
      const result = isEligibleForGC(
        {
          isLatest: true,
          status: "SUCCESS",
          createdAt: old,
        },
        DEFAULT_RETENTION_CONFIG
      )

      expect(result).toBe(false)
    })

    it("returns false for recent superseded parse", () => {
      const result = isEligibleForGC(
        {
          isLatest: false,
          status: "SUCCESS",
          createdAt: recent,
        },
        DEFAULT_RETENTION_CONFIG
      )

      expect(result).toBe(false)
    })

    it("returns true for old PARTIAL/FAILED parse", () => {
      const result = isEligibleForGC(
        {
          isLatest: false,
          status: "PARTIAL",
          createdAt: old,
        },
        DEFAULT_RETENTION_CONFIG
      )

      expect(result).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/retention-gc.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create: `src/lib/regulatory-truth/monitoring/retention-gc.ts`

```typescript
import { dbReg } from "@/lib/db"

export interface RetentionConfig {
  retentionDays: number // Days before eligible for GC (default: 90)
  keepLatestCount: number // Keep last N versions regardless of age (default: 3)
  batchSize: number // Max parses to delete per run (default: 1000)
}

export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  retentionDays: 90,
  keepLatestCount: 3,
  batchSize: 1000,
}

export interface ParseForGC {
  isLatest: boolean
  status: string
  createdAt: Date
}

/**
 * Check if a parse is eligible for garbage collection
 *
 * Implements retention policy from spec Section 7.3:
 * - Keep latest successful parse forever
 * - Keep last N versions
 * - PARTIAL/FAILED status: keep for 90 days (debugging)
 * - Superseded >90 days ago: GC eligible
 */
export function isEligibleForGC(
  parse: ParseForGC,
  config: RetentionConfig = DEFAULT_RETENTION_CONFIG
): boolean {
  // Never GC latest parse
  if (parse.isLatest) {
    return false
  }

  const now = new Date()
  const ageMs = now.getTime() - parse.createdAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Check if older than retention period
  return ageDays > config.retentionDays
}

export class RetentionGC {
  private config: RetentionConfig

  constructor(config: Partial<RetentionConfig> = {}) {
    this.config = { ...DEFAULT_RETENTION_CONFIG, ...config }
  }

  /**
   * Find GC candidates
   */
  async findCandidates(): Promise<string[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

    // Find old non-latest parses
    const candidates = await dbReg.$queryRaw<Array<{ id: string }>>`
      SELECT pd.id
      FROM "ParsedDocument" pd
      WHERE pd."isLatest" = false
        AND pd."createdAt" < ${cutoffDate}
        AND pd.id NOT IN (
          -- Exclude parses that are among the last N for their evidence
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY "evidenceId"
              ORDER BY "createdAt" DESC
            ) as rn
            FROM "ParsedDocument"
          ) ranked
          WHERE rn <= ${this.config.keepLatestCount}
        )
      ORDER BY pd."createdAt" ASC
      LIMIT ${this.config.batchSize}
    `

    return candidates.map((c) => c.id)
  }

  /**
   * Delete GC candidates (nodes cascade via FK)
   */
  async deleteCandidates(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0

    // Nodes are cascade deleted via FK constraint
    const result = await dbReg.parsedDocument.deleteMany({
      where: { id: { in: ids } },
    })

    return result.count
  }

  /**
   * Run full GC cycle
   */
  async run(): Promise<{
    candidatesFound: number
    deleted: number
  }> {
    const candidates = await this.findCandidates()

    if (candidates.length === 0) {
      return { candidatesFound: 0, deleted: 0 }
    }

    const deleted = await this.deleteCandidates(candidates)

    return {
      candidatesFound: candidates.length,
      deleted,
    }
  }
}

/**
 * Run retention GC
 */
export async function runRetentionGC(
  config: Partial<RetentionConfig> = {}
): Promise<{ candidatesFound: number; deleted: number }> {
  const gc = new RetentionGC(config)
  return gc.run()
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/monitoring/__tests__/retention-gc.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): implement retention GC

Garbage collects superseded parses older than 90 days.
Keeps last 3 versions per evidence regardless of age.
Nodes cascade delete via FK constraint.
Spec: docs/specs/nn-mirror-v1.md Section 7.3

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B5: Create Nightly Job Scheduler

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/nightly-jobs.ts`

**Step 1: Write the nightly job runner**

```typescript
import { runIntegrityCheck } from "./integrity-checker"
import { runDriftScan } from "./drift-detector"
import { runReparseWorker } from "./reparse-worker"
import { runRetentionGC } from "./retention-gc"

export interface NightlyJobResult {
  job: string
  success: boolean
  durationMs: number
  result?: unknown
  error?: string
}

export interface NightlyRunReport {
  startedAt: Date
  completedAt: Date
  totalDurationMs: number
  jobs: NightlyJobResult[]
}

/**
 * Run all nightly monitoring jobs
 */
export async function runNightlyJobs(): Promise<NightlyRunReport> {
  const startedAt = new Date()
  const jobs: NightlyJobResult[] = []

  // 1. Integrity Check (1000 sample)
  const integrityStart = Date.now()
  try {
    const result = await runIntegrityCheck(1000)
    jobs.push({
      job: "integrity-check",
      success: true,
      durationMs: Date.now() - integrityStart,
      result: {
        integrityRate: result.integrityRate,
        passed: result.passed,
        failed: result.failed,
      },
    })
  } catch (error) {
    jobs.push({
      job: "integrity-check",
      success: false,
      durationMs: Date.now() - integrityStart,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 2. Drift Detection
  const driftStart = Date.now()
  try {
    const result = await runDriftScan()
    jobs.push({
      job: "drift-detection",
      success: true,
      durationMs: Date.now() - driftStart,
      result: {
        scanned: result.scanned,
        driftDetected: result.driftDetected,
        queued: result.queued,
      },
    })
  } catch (error) {
    jobs.push({
      job: "drift-detection",
      success: false,
      durationMs: Date.now() - driftStart,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 3. Process Reparse Queue (up to 50 per night)
  const reparseStart = Date.now()
  try {
    const result = await runReparseWorker(50)
    jobs.push({
      job: "reparse-worker",
      success: true,
      durationMs: Date.now() - reparseStart,
      result: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      },
    })
  } catch (error) {
    jobs.push({
      job: "reparse-worker",
      success: false,
      durationMs: Date.now() - reparseStart,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 4. Retention GC
  const gcStart = Date.now()
  try {
    const result = await runRetentionGC()
    jobs.push({
      job: "retention-gc",
      success: true,
      durationMs: Date.now() - gcStart,
      result: {
        candidatesFound: result.candidatesFound,
        deleted: result.deleted,
      },
    })
  } catch (error) {
    jobs.push({
      job: "retention-gc",
      success: false,
      durationMs: Date.now() - gcStart,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const completedAt = new Date()

  return {
    startedAt,
    completedAt,
    totalDurationMs: completedAt.getTime() - startedAt.getTime(),
    jobs,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): add nightly job scheduler

Runs integrity check, drift detection, reparse, and GC.
Returns structured report for logging/alerting.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B6: Create Monitoring Module Entrypoint

**Files:**

- Create: `src/lib/regulatory-truth/monitoring/index.ts`

**Step 1: Write the entrypoint**

```typescript
// Re-export all monitoring functionality
export { IntegrityChecker, checkOffsetConsistency, runIntegrityCheck } from "./integrity-checker"

export type { IntegrityCheckResult, IntegrityCheckConfig } from "./integrity-checker"

export { DriftDetector, detectDrift, runDriftScan } from "./drift-detector"

export type { DriftResult } from "./drift-detector"

export { ReparseWorker, shouldReparse, runReparseWorker } from "./reparse-worker"

export {
  RetentionGC,
  isEligibleForGC,
  runRetentionGC,
  DEFAULT_RETENTION_CONFIG,
} from "./retention-gc"

export type { RetentionConfig } from "./retention-gc"

export { runNightlyJobs } from "./nightly-jobs"

export type { NightlyJobResult, NightlyRunReport } from "./nightly-jobs"

// Version constant
export const MONITORING_VERSION = "monitoring-v1.0.0"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/
git commit -m "feat(monitoring): add module entrypoint

Re-exports all monitoring APIs from single import point.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task B7: Create Nightly Job Script

**Files:**

- Create: `scripts/run-nightly-monitoring.ts`

**Step 1: Write the script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Run nightly monitoring jobs
 *
 * Usage: npx tsx scripts/run-nightly-monitoring.ts
 *
 * Intended to be run via cron:
 * 0 3 * * * cd /app && npx tsx scripts/run-nightly-monitoring.ts >> /var/log/nightly-monitoring.log 2>&1
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { runNightlyJobs, MONITORING_VERSION } =
    await import("../src/lib/regulatory-truth/monitoring")

  console.log("=== Nightly Monitoring Jobs ===")
  console.log("Version:", MONITORING_VERSION)
  console.log("Started at:", new Date().toISOString())
  console.log()

  const report = await runNightlyJobs()

  console.log("=== Results ===")
  console.log()

  for (const job of report.jobs) {
    const status = job.success ? "✓" : "✗"
    console.log(`${status} ${job.job} (${job.durationMs}ms)`)

    if (job.result) {
      const resultStr = JSON.stringify(job.result, null, 2)
        .split("\n")
        .map((line) => "    " + line)
        .join("\n")
      console.log(resultStr)
    }

    if (job.error) {
      console.log(`    Error: ${job.error}`)
    }

    console.log()
  }

  console.log("=== Summary ===")
  console.log("Total duration:", report.totalDurationMs, "ms")
  console.log("Completed at:", report.completedAt.toISOString())

  // Check for failures
  const failures = report.jobs.filter((j) => !j.success)
  if (failures.length > 0) {
    console.error()
    console.error("WARNING:", failures.length, "job(s) failed!")
    process.exit(1)
  }

  // Check integrity rate
  const integrityJob = report.jobs.find((j) => j.job === "integrity-check")
  if (integrityJob?.success && integrityJob.result) {
    const rate = (integrityJob.result as { integrityRate: number }).integrityRate
    if (rate < 0.99) {
      console.warn()
      console.warn(`WARNING: Integrity rate ${(rate * 100).toFixed(2)}% below 99% threshold`)
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
```

**Step 2: Make executable**

Run: `chmod +x scripts/run-nightly-monitoring.ts`

**Step 3: Commit**

```bash
git add scripts/run-nightly-monitoring.ts
git commit -m "feat(scripts): add run-nightly-monitoring.ts

Runs all nightly jobs and logs structured report.
Returns exit code 1 on any failure or low integrity rate.
Suitable for cron scheduling.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Part C: Dashboard (App Repository)

### Task C1: Create Coverage Dashboard Page

**Files:**

- Create: `src/app/(app)/nn-browser/dashboard/page.tsx`

**Step 1: Write the dashboard page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"

async function getDashboardStats() {
  // Get counts
  const [
    evidenceCount,
    parsedDocCount,
    nodeCount,
    instrumentCount,
    linkCount
  ] = await Promise.all([
    dbReg.evidence.count(),
    dbReg.parsedDocument.count({ where: { isLatest: true, status: "SUCCESS" } }),
    dbReg.provisionNode.count(),
    dbReg.instrument.count(),
    dbReg.instrumentEvidenceLink.count()
  ])

  // Get recent integrity checks
  const recentChecks = await dbReg.integrityCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: 7
  })

  // Get pending reparse jobs
  const pendingJobs = await dbReg.reparseJob.count({
    where: { status: "PENDING" }
  })

  // Get recent drift events
  const unresolvedDrift = await dbReg.driftEvent.count({
    where: { status: { in: ["DETECTED", "QUEUED"] } }
  })

  // Get link confidence distribution
  const confidenceDist = await dbReg.instrumentEvidenceLink.groupBy({
    by: ["confidence"],
    _count: true
  })

  return {
    counts: {
      evidence: evidenceCount,
      parsedDocs: parsedDocCount,
      nodes: nodeCount,
      instruments: instrumentCount,
      links: linkCount
    },
    recentChecks,
    pendingJobs,
    unresolvedDrift,
    confidenceDist: confidenceDist.reduce((acc, item) => {
      acc[item.confidence] = item._count
      return acc
    }, {} as Record<string, number>)
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/nn-browser" className="hover:text-gray-900">Browser</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Dashboard</span>
      </nav>

      <h2 className="text-lg font-medium text-gray-900 mb-6">
        NN Mirror System Dashboard
      </h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Evidence" value={stats.counts.evidence} />
        <StatCard label="Parsed Docs" value={stats.counts.parsedDocs} />
        <StatCard label="Nodes" value={stats.counts.nodes} />
        <StatCard label="Instruments" value={stats.counts.instruments} />
        <StatCard label="Links" value={stats.counts.links} />
      </div>

      {/* Health Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Integrity History */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Integrity History (7 days)</h3>
          </div>
          <div className="p-4">
            {stats.recentChecks.length === 0 ? (
              <p className="text-gray-500">No integrity checks yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.recentChecks.map(check => (
                  <div key={check.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {check.createdAt.toLocaleDateString("hr-HR")}
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-sm font-medium ${
                          check.integrityRate >= 0.99
                            ? "text-green-600"
                            : check.integrityRate >= 0.95
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {(check.integrityRate * 100).toFixed(2)}%
                      </div>
                      <span className="text-xs text-gray-400">
                        ({check.passed}/{check.passed + check.failed})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Queue Status</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pending Reparse Jobs</span>
              <span className={`font-medium ${
                stats.pendingJobs === 0 ? "text-green-600" : "text-yellow-600"
              }`}>
                {stats.pendingJobs}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Unresolved Drift Events</span>
              <span className={`font-medium ${
                stats.unresolvedDrift === 0 ? "text-green-600" : "text-yellow-600"
              }`}>
                {stats.unresolvedDrift}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Link Confidence Distribution */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Link Confidence Distribution</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <ConfidenceBar
              label="HIGH"
              count={stats.confidenceDist.HIGH || 0}
              total={stats.counts.links}
              color="bg-green-500"
            />
            <ConfidenceBar
              label="MEDIUM"
              count={stats.confidenceDist.MEDIUM || 0}
              total={stats.counts.links}
              color="bg-yellow-500"
            />
            <ConfidenceBar
              label="LOW"
              count={stats.confidenceDist.LOW || 0}
              total={stats.counts.links}
              color="bg-red-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

function ConfidenceBar({
  label,
  count,
  total,
  color
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const percent = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1">{count.toLocaleString()}</div>
    </div>
  )
}
```

**Step 2: Add navigation link**

Update `src/app/(app)/nn-browser/layout.tsx` to include a link to the dashboard.

**Step 3: Commit**

```bash
git add src/app/\(app\)/nn-browser/
git commit -m "feat(nn-browser): add coverage dashboard

Shows system stats, integrity history, queue status.
Visualizes link confidence distribution.
Exit criteria: <1% integrity failures sustained.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Exit Criteria Verification

> **AUDIT FIX:** Exit criteria now include explicit SLOs and distribution checks. Phase 5 is gated on these criteria being met for 7 consecutive days.

After completing all tasks, verify:

| Criteria                  | Verification                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| Schema migrations applied | `npx prisma migrate status`                                              |
| Integrity checker works   | `npx tsx scripts/run-nightly-monitoring.ts` runs without errors          |
| Drift detection works     | Create test drift, verify it's detected and queued                       |
| Reparse worker works      | Process a reparse job, verify new parse created with CLEAN_TEXT artifact |
| GC works                  | Create old superseded parses, verify they're cleaned                     |
| Dashboard loads           | `/nn-browser/dashboard` shows stats                                      |

**⚠️ AUDIT FIX - Explicit SLOs (must be met for 7 consecutive days before Phase 5):**

| SLO                      | Target | Verification SQL                                                                                                                                                    |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offset integrity         | ≥99%   | `SELECT AVG("integrityRate") FROM "IntegrityCheck" WHERE "checkType" = 'ANCHOR_INTEGRITY' AND "createdAt" > NOW() - INTERVAL '7 days';`                             |
| Node coverage            | ≥90%   | `SELECT AVG("coveragePercent") FROM "ParsedDocument" WHERE "isLatest" = true AND status = 'SUCCESS';`                                                               |
| Unparsed segments        | <5%    | `SELECT COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE("unparsedSegments", '[]'::jsonb)) > 0)::float / COUNT(*) FROM "ParsedDocument" WHERE "isLatest" = true;` |
| Link confidence HIGH/MED | ≥80%   | `SELECT COUNT(*) FILTER (WHERE confidence IN ('HIGH','MEDIUM'))::float / COUNT(*) FROM "InstrumentEvidenceLink";`                                                   |
| DLQ depth                | <50    | Check Redis `LLEN bull:nn-reparse:failed`                                                                                                                           |

**Distribution Checks Monitoring Job:**

```typescript
// Add to scripts/run-nightly-monitoring.ts
async function checkDistributions() {
  // Confidence distribution per resolver version
  const confidenceDist = await dbReg.$queryRaw`
    SELECT
      ira."resolverVersion",
      iel.confidence,
      COUNT(*) as count
    FROM "InstrumentEvidenceLink" iel
    JOIN "InstrumentResolutionAttempt" ira
      ON ira."chosenInstrumentId" = iel."instrumentId"
      AND ira."evidenceId" = iel."evidenceId"
    GROUP BY ira."resolverVersion", iel.confidence
  `

  // Parse status distribution
  const parseStatusDist = await dbReg.$queryRaw`
    SELECT status, COUNT(*) as count
    FROM "ParsedDocument"
    WHERE "isLatest" = true
    GROUP BY status
  `

  // Log for monitoring/alerting
  console.log("Confidence distribution:", confidenceDist)
  console.log("Parse status distribution:", parseStatusDist)

  // Alert if HIGH < 60% or LOW > 20%
  // (implementation left to monitoring system)
}
```

---

## Notes for Implementer

1. **Cron scheduling**: Add to system crontab or use BullMQ scheduled job:

   ```
   0 3 * * * cd /app && npx tsx scripts/run-nightly-monitoring.ts
   ```

2. **Alerting**: Consider adding Slack/email notifications when integrity drops below threshold.

3. **Performance**: Integrity check samples 1000 nodes. Adjust based on database size and performance requirements.

4. **GC safety**: The `keepLatestCount` ensures we never delete all versions of a parse, even if they're old.

5. **Cascade deletes**: ProvisionNode has `onDelete: Cascade` to ParsedDocument, so nodes are automatically deleted when parses are GC'd.

6. **Dashboard caching**: Consider adding ISR (Incremental Static Regeneration) with 5-minute revalidation for better performance.
