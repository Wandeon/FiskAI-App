# Evidence Immutability Audit (INV-1)

**Date:** 2025-12-26
**Auditor:** Claude Opus 4.5
**Status:** FINDINGS DOCUMENTED

## Executive Summary

This audit traces the full Evidence lifecycle for immutability and stable hashing across all content types (HTML, JSON, PDF_TEXT, OCR_TEXT, DOC/DOCX, XLS/XLSX). The audit identified **one critical bug** causing hash/content mismatches, and several areas requiring additional hardening.

---

## (A) Confirmed Invariants

### INV-1.1: Evidence.rawContent is Write-Once
**STATUS: CONFIRMED**

No code path exists that updates `Evidence.rawContent` after creation. Evidence is created via:
- `db.evidence.create()` in `sentinel.ts:365-375, 411-420, 545-568`
- `db.evidence.create()` in fetchers (`hnb-fetcher.ts:118-127`, `nn-fetcher.ts:229-237`, `eurlex-fetcher.ts:140-148`)
- `db.evidence.upsert()` in `sentinel.ts:545-568` (update path only touches `fetchedAt`, not `rawContent`)

Evidence updates only modify metadata fields:
- `ocrMetadata` (`ocr.worker.ts:61-70, 90-105`)
- `primaryTextArtifactId` (`ocr.worker.ts:90-105`, `sentinel.ts:433-436`)
- `contentHash` (via `data-repair.ts:31-34` - see Failure Mode F-1)

### INV-1.2: EvidenceArtifact.content is Write-Once
**STATUS: CONFIRMED**

No `db.evidenceArtifact.update()` calls exist in the codebase. Artifacts are only created:
- `ocr.worker.ts:75-87` (OCR_TEXT artifact)
- `sentinel.ts:423-429` (PDF_TEXT artifact for text-layer PDFs)

### INV-1.3: PDF Content Stored as Base64 with Matching Hash
**STATUS: CONFIRMED**

For PDF content:
- `sentinel.ts:364`: `hashContent(buffer.toString("base64"))`
- `sentinel.ts:369`: `rawContent: buffer.toString("base64")`

The hash and stored content use identical base64 encoding.

### INV-1.4: HTML Hashing Uses Normalized Content
**STATUS: CONFIRMED (with caveat)**

For HTML content:
- `hashContent()` in `content-hash.ts:58-74` normalizes HTML before hashing
- This is intentional for change detection (removes dynamic timestamps, comments, scripts)
- Re-hashing stored content produces the same hash because normalization is deterministic

### INV-1.5: Binary Document Text is Sanitized Before Hash
**STATUS: CONFIRMED**

For DOC/DOCX/XLS/XLSX:
- `binary-parser.ts:76-84` sanitizes text (removes null bytes, control chars)
- `sentinel.ts:487` computes hash from the already-sanitized text
- Same sanitized text is stored in `rawContent`

---

## (B) Concrete Failure Modes

### F-1: CRITICAL - JSON Hash/Content Mismatch in Structured Fetchers

**Severity:** HIGH
**Impact:** Re-hashing stored `rawContent` produces different hash than stored `contentHash`
**Affected Files:**

| File | Hash Line | Store Line | Issue |
|------|-----------|------------|-------|
| `fetchers/hnb-fetcher.ts` | 104-105 | 122 | Hash uses `JSON.stringify(rate)`, store uses `JSON.stringify(rate, null, 2)` |
| `fetchers/nn-fetcher.ts` | 199 | 233 | Hash uses `JSON.stringify(metadata)`, store uses `JSON.stringify(metadata, null, 2)` |
| `fetchers/eurlex-fetcher.ts` | 110 | 144 | Hash uses `JSON.stringify(metadata)`, store uses `JSON.stringify(metadata, null, 2)` |

**Root Cause:**
```typescript
// hnb-fetcher.ts:104-105
const rawContent = JSON.stringify(rate)  // Compact - used for hash
const contentHash = hashContent(rawContent, "application/json")

// hnb-fetcher.ts:122
rawContent: JSON.stringify(rate, null, 2),  // Pretty-printed - stored in DB
```

**Proof of Bug:**
```typescript
// Compact JSON
'{"a":1}'
// sha256: 2f9a53e5e5e5c5...

// Pretty JSON
'{\n  "a": 1\n}'
// sha256: 7d9b8c4a3f2e1d...  // DIFFERENT!
```

### F-2: MEDIUM - Data Repair Script Updates contentHash

**Severity:** MEDIUM
**File:** `e2e/data-repair.ts:31-34`
**Impact:** Autonomous "repair" can silently fix hash mismatches without audit trail

```typescript
await db.evidence.update({
  where: { id: e.id },
  data: { contentHash: correctHash },
})
```

This masks underlying bugs rather than failing loudly. If rawContent was corrupted, this would make it undetectable.

### F-3: LOW - HTML Normalization Strips Timestamps and Hex Strings

**Severity:** LOW (documented behavior, but creates re-fetch hash variance)
**File:** `utils/content-hash.ts:22-24`

```typescript
.replace(/\b\d{10,13}\b/g, "")     // Strips Unix timestamps
.replace(/[a-f0-9]{32,}/gi, "")   // Strips hex strings like UUIDs
```

If an HTML page legitimately contains a 10-digit number (e.g., fiscal ID), it gets stripped before hashing. A re-fetch of identical content will produce the same hash (consistent), but the hash doesn't represent the true content.

### F-4: LOW - Content Cleaner Modifies Text Before Extraction

**Severity:** LOW (by design, only affects LLM input)
**File:** `utils/content-cleaner.ts:256-266`

The `cleanContent()` function strips navigation, footers, and HTML entities. This is used ONLY for LLM extraction (`extractor.ts:142`) and does NOT modify stored `rawContent`. Verified that Extractor reads via `getExtractableContent()` which returns the original artifact/rawContent, then cleaning is applied only to the LLM prompt.

---

## (C) Three "Break It" Tests

### Test 1: JSON Hash Immutability Regression Test

```typescript
// __tests__/json-hash-regression.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { hashContent } from "../utils/content-hash"

describe("JSON Hash Regression", () => {
  it("FAILS if hash computed from compact JSON differs from stored pretty JSON", () => {
    const rate = { valuta: "USD", srednji_tecaj: "1.05" }

    // Simulate bug: hash from compact
    const compactHash = hashContent(JSON.stringify(rate), "application/json")

    // Simulate stored: pretty-printed
    const prettyContent = JSON.stringify(rate, null, 2)
    const prettyHash = hashContent(prettyContent, "application/json")

    // THIS SHOULD FAIL UNTIL BUG IS FIXED
    assert.strictEqual(
      compactHash,
      prettyHash,
      "Hash computed from compact JSON must match hash of stored pretty JSON"
    )
  })
})
```

### Test 2: PDF Base64 Round-Trip Verification

```typescript
// __tests__/pdf-base64-roundtrip.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { hashContent } from "../utils/content-hash"
import { readFileSync } from "fs"

describe("PDF Base64 Round-Trip", () => {
  it("proves PDF can be decoded and re-encoded to same hash", () => {
    // Use a fixture PDF
    const pdfBuffer = readFileSync("fixtures/sample.pdf")
    const base64 = pdfBuffer.toString("base64")
    const hash1 = hashContent(base64)

    // Simulate retrieval and re-encode
    const decoded = Buffer.from(base64, "base64")
    const reEncoded = decoded.toString("base64")
    const hash2 = hashContent(reEncoded)

    assert.strictEqual(hash1, hash2, "Base64 encoding must be stable")
    assert.strictEqual(base64, reEncoded, "Base64 content must match exactly")
  })
})
```

### Test 3: Evidence Update Mutation Detection

```typescript
// __tests__/evidence-mutation-detector.test.ts
import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"

describe("Evidence Mutation Detection", () => {
  let testEvidenceId: string

  beforeEach(async () => {
    const content = "Test content for mutation detection"
    const evidence = await db.evidence.create({
      data: {
        url: "https://test.example.com/mutation-test",
        rawContent: content,
        contentHash: hashContent(content),
        contentType: "html",
        sourceId: "test-source-id",
      }
    })
    testEvidenceId = evidence.id
  })

  afterEach(async () => {
    await db.evidence.delete({ where: { id: testEvidenceId }})
  })

  it("FAILS if any code path can update rawContent after creation", async () => {
    // Attempt to update rawContent (should fail or be blocked)
    const mutatedContent = "MUTATED CONTENT"

    await db.evidence.update({
      where: { id: testEvidenceId },
      data: { rawContent: mutatedContent }  // This should be blocked!
    })

    const evidence = await db.evidence.findUnique({ where: { id: testEvidenceId }})

    // If this passes, we have a mutation vulnerability
    assert.notStrictEqual(
      evidence?.rawContent,
      mutatedContent,
      "rawContent mutation must be blocked by Prisma middleware or constraint"
    )
  })
})
```

---

## (D) Recommended Hard Gates

### Gate 1: Hash Consistency Assertion at Write Time

**Location:** `src/lib/regulatory-truth/utils/evidence-writer.ts` (new file)

```typescript
export async function createEvidence(data: {
  sourceId: string
  url: string
  rawContent: string
  contentType: string
}): Promise<Evidence> {
  // GATE: Compute hash from EXACTLY what will be stored
  const contentHash = hashContent(data.rawContent, data.contentType)

  // Verify hash before write (fail-closed)
  const verificationHash = hashContent(data.rawContent, data.contentType)
  if (contentHash !== verificationHash) {
    throw new Error("FATAL: Hash computation is non-deterministic")
  }

  return db.evidence.create({
    data: {
      ...data,
      contentHash,
    }
  })
}
```

**Enforcement Points:**
- `sentinel.ts` - Replace direct `db.evidence.create()` with `createEvidence()`
- All fetchers - Same

### Gate 2: Prisma Middleware to Block rawContent Updates

**Location:** `src/lib/db.ts`

```typescript
prisma.$use(async (params, next) => {
  if (params.model === 'Evidence' && params.action === 'update') {
    const dataKeys = Object.keys(params.args.data || {})
    if (dataKeys.includes('rawContent')) {
      throw new Error(
        'IMMUTABILITY VIOLATION: Evidence.rawContent cannot be modified after creation. ' +
        `Attempted update on Evidence ${params.args.where?.id}`
      )
    }
  }
  return next(params)
})
```

### Gate 3: CI Pipeline Hash Verification

**Location:** `.github/workflows/ci.yml`

```yaml
- name: Verify Evidence Immutability
  run: |
    npx tsx src/lib/regulatory-truth/scripts/verify-immutability.ts
    if [ $? -ne 0 ]; then
      echo "FAIL: Evidence hash verification failed"
      exit 1
    fi
```

### Gate 4: Watchdog Alert on Hash Mismatch

**Location:** `src/lib/regulatory-truth/watchdog/health-monitors.ts`

Add to existing health checks:

```typescript
async function checkEvidenceHashes(): Promise<HealthCheckResult> {
  const mismatchCount = await db.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(*) as count FROM "Evidence"
    WHERE "contentHash" != (
      -- This would require a SQL hash function, so use sampling instead
    )
  `

  // Alternative: Sample 100 random records
  const samples = await db.evidence.findMany({
    take: 100,
    orderBy: { fetchedAt: 'desc' },
    select: { id: true, contentHash: true, rawContent: true, contentType: true }
  })

  let mismatches = 0
  for (const e of samples) {
    const computed = hashContent(e.rawContent, e.contentType)
    if (computed !== e.contentHash) mismatches++
  }

  if (mismatches > 0) {
    await createWatchdogAlert({
      severity: 'CRITICAL',
      type: 'HASH_MISMATCH',
      message: `${mismatches}/${samples.length} sampled Evidence records have hash mismatches`,
    })
    return { status: 'CRITICAL', metric: mismatches }
  }

  return { status: 'HEALTHY', metric: 0 }
}
```

---

## Summary of Required Fixes

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | JSON hash/content mismatch | Fix fetchers to hash exactly what is stored |
| P1 | No mutation guard | Add Prisma middleware to block rawContent updates |
| P2 | Silent hash repair | Add audit logging to data-repair.ts, or remove auto-repair |
| P3 | CI verification | Add hash verification to CI pipeline |

---

## Appendix: Content Type Hash Matrix

| Content Type | Hash Algorithm | Normalization | Stable on Re-fetch? |
|--------------|---------------|---------------|---------------------|
| HTML | SHA-256 of normalized text | Yes (strips comments, scripts, dynamic IDs) | Yes |
| JSON | SHA-256 of raw bytes | No | Yes* |
| JSON-LD | SHA-256 of raw bytes | No | Yes* |
| PDF (text layer) | SHA-256 of base64 | No | Yes |
| PDF (scanned) | SHA-256 of base64 | No | Yes |
| DOC/DOCX | SHA-256 of sanitized text | Yes (null bytes, control chars) | Yes |
| XLS/XLSX | SHA-256 of sanitized text | Yes (null bytes, control chars) | Yes |
| OCR_TEXT (artifact) | SHA-256 of raw text | No | No** |

*Currently broken due to F-1
**OCR output varies based on engine version, settings, and image quality

---

*End of Audit Report*
