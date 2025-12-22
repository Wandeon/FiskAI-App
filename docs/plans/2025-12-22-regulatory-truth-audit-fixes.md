# Regulatory Truth Layer - Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Critical and High priority audit findings to make system production-ready.

**Architecture:** 17 discrete fixes across 4 phases, targeting reliability, logic, security, and performance.

**Tech Stack:** Next.js 15, Prisma 7, PostgreSQL, TypeScript

---

## Phase 1: Reliability & Data Integrity

### Task 1: Add Agent Timeout

**Files:**

- Modify: `src/lib/regulatory-truth/agents/runner.ts`

**Step 1: Add timeout constant and AbortController**

At line 10, add:

```typescript
const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS || "300000") // 5 minutes
```

**Step 2: Wrap fetch with abort signal**

Replace the fetch call (around line 113) with:

```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

try {
  const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: "POST",
    headers: getOllamaHeaders(),
    signal: controller.signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nCRITICAL: Your response must be ONLY valid JSON. No thinking, no explanation, no markdown code blocks, just the raw JSON object.",
        },
        { role: "user", content: userMessage },
      ],
      stream: false,
      options: {
        temperature,
        num_predict: 16384,
      },
    }),
  })
  clearTimeout(timeoutId)
```

**Step 3: Handle abort error**

In the catch block, add abort detection:

```typescript
} catch (error) {
  clearTimeout(timeoutId)
  lastError = error as Error

  // Check if aborted due to timeout
  if (lastError?.name === 'AbortError') {
    lastError = new Error(`Agent timed out after ${AGENT_TIMEOUT_MS}ms`)
  }
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/agents/runner.ts
git commit -m "fix: add timeout to agent runs (5 min default)"
```

---

### Task 2: Create Backfill Script for Knowledge Graph

**Files:**

- Create: `src/lib/regulatory-truth/scripts/backfill-concepts.ts`

**Step 1: Create the backfill script**

```typescript
// src/lib/regulatory-truth/scripts/backfill-concepts.ts

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

import { db } from "@/lib/db"

async function backfillConcepts() {
  console.log("[backfill] Starting Knowledge Graph backfill...")

  // Find rules without concepts
  const rulesWithoutConcepts = await db.regulatoryRule.findMany({
    where: { conceptId: null },
    select: {
      id: true,
      conceptSlug: true,
      titleHr: true,
      titleEn: true,
      explanationHr: true,
      riskTier: true,
      authorityLevel: true,
    },
  })

  console.log(`[backfill] Found ${rulesWithoutConcepts.length} rules without concepts`)

  let created = 0
  let linked = 0

  for (const rule of rulesWithoutConcepts) {
    try {
      // Upsert concept
      const concept = await db.concept.upsert({
        where: { slug: rule.conceptSlug },
        create: {
          slug: rule.conceptSlug,
          nameHr: rule.titleHr,
          nameEn: rule.titleEn || rule.titleHr,
          description: rule.explanationHr,
          tags: [rule.riskTier, rule.authorityLevel].filter(Boolean),
        },
        update: {
          // Update if names are longer/better
          nameHr: rule.titleHr,
          nameEn: rule.titleEn || undefined,
        },
      })

      // Check if this was a new concept
      const existingConcept = await db.concept.findUnique({
        where: { slug: rule.conceptSlug },
      })
      if (existingConcept?.id === concept.id) {
        created++
      }

      // Link rule to concept
      await db.regulatoryRule.update({
        where: { id: rule.id },
        data: { conceptId: concept.id },
      })
      linked++

      console.log(`[backfill] ✓ Linked rule ${rule.id} to concept ${concept.slug}`)
    } catch (error) {
      console.error(`[backfill] ✗ Failed for rule ${rule.id}:`, error)
    }
  }

  console.log(`[backfill] Complete: ${created} concepts created, ${linked} rules linked`)
}

backfillConcepts()
  .catch(console.error)
  .finally(() => process.exit(0))
```

**Step 2: Run the backfill**

```bash
npx tsx src/lib/regulatory-truth/scripts/backfill-concepts.ts
```

**Step 3: Verify results**

```sql
SELECT COUNT(*) FROM "Concept";
SELECT COUNT(*) FROM "RegulatoryRule" WHERE "conceptId" IS NULL;
```

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/scripts/backfill-concepts.ts
git commit -m "feat: add backfill script for Knowledge Graph concepts"
```

---

### Task 3: Implement Trigger Endpoint

**Files:**

- Modify: `src/app/api/admin/regulatory-truth/trigger/route.ts`

**Step 1: Replace placeholder with actual implementation**

```typescript
// src/app/api/admin/regulatory-truth/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { runSentinelBatch } from "@/lib/regulatory-truth/agents/sentinel"
import { runExtractorBatch } from "@/lib/regulatory-truth/agents/extractor"
import { runComposerBatch } from "@/lib/regulatory-truth/agents/composer"
import { runReviewerBatch } from "@/lib/regulatory-truth/agents/reviewer"

type PipelinePhase = "discovery" | "extraction" | "composition" | "review" | "all"

/**
 * POST /api/admin/regulatory-truth/trigger
 *
 * Trigger regulatory pipeline phases
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const phase = (body.phase as PipelinePhase) || "all"

    const results: Record<string, unknown> = {
      triggeredBy: user.id,
      triggeredAt: new Date().toISOString(),
      phase,
    }

    // Execute requested phase(s)
    if (phase === "discovery" || phase === "all") {
      console.log("[trigger] Running discovery phase...")
      const discoveryResult = await runSentinelBatch()
      results.discovery = discoveryResult
    }

    if (phase === "extraction" || phase === "all") {
      console.log("[trigger] Running extraction phase...")
      const extractionResult = await runExtractorBatch()
      results.extraction = extractionResult
    }

    if (phase === "composition" || phase === "all") {
      console.log("[trigger] Running composition phase...")
      const compositionResult = await runComposerBatch()
      results.composition = compositionResult
    }

    if (phase === "review" || phase === "all") {
      console.log("[trigger] Running review phase...")
      const reviewResult = await runReviewerBatch()
      results.review = reviewResult
    }

    return NextResponse.json({
      success: true,
      message: `Pipeline phase '${phase}' completed`,
      results,
    })
  } catch (error) {
    console.error("[trigger] Error:", error)
    return NextResponse.json(
      { error: "Failed to trigger pipeline", details: String(error) },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/admin/regulatory-truth/trigger/route.ts
git commit -m "feat: implement actual pipeline trigger endpoint"
```

---

### Task 4: Mark Stuck Agent Runs as Failed

**Files:**

- Create: `src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts`

**Step 1: Create cleanup script**

```typescript
// src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts

import { config } from "dotenv"
import { resolve } from "path"

const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

import { db } from "@/lib/db"

const STUCK_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

async function cleanupStuckRuns() {
  console.log("[cleanup] Checking for stuck agent runs...")

  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS)

  const stuckRuns = await db.agentRun.findMany({
    where: {
      status: "running",
      startedAt: { lt: stuckThreshold },
    },
  })

  console.log(`[cleanup] Found ${stuckRuns.length} stuck runs`)

  for (const run of stuckRuns) {
    const runningMinutes = Math.round((Date.now() - run.startedAt.getTime()) / 60000)

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: `Marked as failed: stuck in running state for ${runningMinutes} minutes`,
        completedAt: new Date(),
      },
    })

    console.log(`[cleanup] ✓ Marked run ${run.id} (${run.agentType}) as failed`)
  }

  console.log(`[cleanup] Complete: ${stuckRuns.length} runs cleaned up`)
}

cleanupStuckRuns()
  .catch(console.error)
  .finally(() => process.exit(0))
```

**Step 2: Run cleanup**

```bash
npx tsx src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/scripts/cleanup-stuck-runs.ts
git commit -m "feat: add cleanup script for stuck agent runs"
```

---

## Phase 2: Logic & Correctness

### Task 5: Fix AppliesWhen DSL in Prompts

**Files:**

- Modify: `src/lib/regulatory-truth/prompts/index.ts`

**Step 1: Replace the APPLIES_WHEN section in COMPOSER_PROMPT**

Find the `APPLIES_WHEN DSL REFERENCE` section and replace with:

```typescript
APPLIES_WHEN DSL FORMAT:
The appliesWhen field must be a valid JSON predicate. Use these operators:

1. Comparison: { "op": "cmp", "field": "path.to.field", "cmp": "eq"|"neq"|"gt"|"gte"|"lt"|"lte", "value": <value> }
2. Logical AND: { "op": "and", "args": [<predicate>, <predicate>, ...] }
3. Logical OR: { "op": "or", "args": [<predicate>, <predicate>, ...] }
4. Logical NOT: { "op": "not", "arg": <predicate> }
5. In list: { "op": "in", "field": "path.to.field", "values": [<value1>, <value2>] }
6. Exists: { "op": "exists", "field": "path.to.field" }
7. Between: { "op": "between", "field": "path.to.field", "gte": <min>, "lte": <max> }
8. Always true: { "op": "true" }

FIELD PATHS:
- entity.type: "OBRT" | "DOO" | "JDOO" | "UDRUGA" | "OTHER"
- entity.obrtSubtype: "PAUSALNI" | "DOHODAS" | "DOBITAS"
- entity.vat.status: "IN_VAT" | "OUTSIDE_VAT" | "UNKNOWN"
- counters.revenueYtd: number
- txn.kind: "SALE" | "PURCHASE" | "PAYMENT" | "PAYROLL"

EXAMPLE - Pausalni obrt outside VAT:
{
  "op": "and",
  "args": [
    { "op": "cmp", "field": "entity.type", "cmp": "eq", "value": "OBRT" },
    { "op": "cmp", "field": "entity.obrtSubtype", "cmp": "eq", "value": "PAUSALNI" },
    { "op": "cmp", "field": "entity.vat.status", "cmp": "eq", "value": "OUTSIDE_VAT" }
  ]
}

EXAMPLE - Revenue threshold:
{
  "op": "cmp",
  "field": "counters.revenueYtd",
  "cmp": "gt",
  "value": 39816.84
}

EXAMPLE - Always applies:
{ "op": "true" }
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/prompts/index.ts
git commit -m "fix: update AppliesWhen DSL syntax in prompts to match evaluator"
```

---

### Task 6: Fix Conflict Creation with itemAId/itemBId

**Files:**

- Modify: `src/lib/regulatory-truth/agents/composer.ts`

**Step 1: Update conflict creation (around line 92)**

Replace the conflict creation block with:

```typescript
// Check if conflicts were detected
if (result.output.conflicts_detected) {
  // Get first two conflicting source pointers for itemA/itemB
  const [itemAId, itemBId] = sourcePointerIds.slice(0, 2)

  // Create a conflict record for Arbiter to resolve later
  const conflict = await db.regulatoryConflict.create({
    data: {
      conflictType: "SOURCE_CONFLICT",
      status: "OPEN",
      itemAId: itemAId || null,
      itemBId: itemBId || null,
      description:
        result.output.conflicts_detected.description ||
        "Conflicting values detected in source pointers",
      metadata: {
        sourcePointerIds: sourcePointerIds,
        detectedBy: "COMPOSER",
        conflictDetails: result.output.conflicts_detected,
      },
    },
  })

  // Log audit event for conflict creation
  await logAuditEvent({
    action: "CONFLICT_CREATED",
    entityType: "CONFLICT",
    entityId: conflict.id,
    metadata: {
      conflictType: "SOURCE_CONFLICT",
      sourcePointerCount: sourcePointerIds.length,
      itemAId,
      itemBId,
    },
  })

  console.log(`[composer] Created conflict ${conflict.id} for Arbiter resolution`)
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/agents/composer.ts
git commit -m "fix: populate itemAId/itemBId when creating conflicts"
```

---

### Task 7: Fix Monitoring Script Signature

**Files:**

- Modify: `src/lib/regulatory-truth/scripts/monitor.ts`

**Step 1: Check and fix runSentinel call**

Read the file and update the function call to match the actual signature.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/scripts/monitor.ts
git commit -m "fix: correct runSentinel call signature in monitor script"
```

---

### Task 8: Use RegulatorySource.hierarchy for Authority

**Files:**

- Modify: `src/lib/regulatory-truth/utils/authority.ts`

**Step 1: Update authority derivation to use database hierarchy**

```typescript
// src/lib/regulatory-truth/utils/authority.ts

import { db } from "@/lib/db"

export type AuthorityLevel = "LAW" | "GUIDANCE" | "PROCEDURE" | "PRACTICE"

const HIERARCHY_MAP: Record<string, AuthorityLevel> = {
  zakon: "LAW",
  law: "LAW",
  ustav: "LAW",
  podzakonski: "GUIDANCE",
  pravilnik: "GUIDANCE",
  guidance: "GUIDANCE",
  uputa: "PROCEDURE",
  procedure: "PROCEDURE",
  misljenje: "PRACTICE",
  practice: "PRACTICE",
}

/**
 * Derive authority level from source slugs, checking database hierarchy first
 */
export async function deriveAuthorityLevelAsync(sourceSlugs: string[]): Promise<AuthorityLevel> {
  // Try to get hierarchy from database first
  if (sourceSlugs.length > 0) {
    const sources = await db.regulatorySource.findMany({
      where: { slug: { in: sourceSlugs } },
      select: { hierarchy: true },
    })

    // Use highest authority from sources
    const hierarchies = sources.map((s) => s.hierarchy).filter(Boolean) as AuthorityLevel[]
    if (hierarchies.length > 0) {
      const order: AuthorityLevel[] = ["LAW", "GUIDANCE", "PROCEDURE", "PRACTICE"]
      return hierarchies.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
    }
  }

  // Fallback to slug-based detection
  return deriveAuthorityLevel(sourceSlugs)
}

/**
 * Derive authority level from source slugs (synchronous fallback)
 */
export function deriveAuthorityLevel(sourceSlugs: string[]): AuthorityLevel {
  for (const slug of sourceSlugs) {
    const lowerSlug = slug.toLowerCase()

    // Check for known hierarchy keywords
    for (const [keyword, level] of Object.entries(HIERARCHY_MAP)) {
      if (lowerSlug.includes(keyword)) {
        return level
      }
    }

    // Specific source patterns
    if (lowerSlug.includes("narodne-novine") || lowerSlug.includes("nn")) {
      return "LAW"
    }
    if (lowerSlug.includes("porezna") || lowerSlug.includes("mfin")) {
      return "GUIDANCE"
    }
    if (lowerSlug.includes("hzzo") || lowerSlug.includes("hzmo") || lowerSlug.includes("fina")) {
      return "PROCEDURE"
    }
  }

  return "PRACTICE" // Default to lowest
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/utils/authority.ts
git commit -m "fix: use RegulatorySource.hierarchy for authority derivation"
```

---

## Phase 3: Security & Audit

### Task 9: Add ReDoS Protection

**Files:**

- Modify: `src/lib/regulatory-truth/dsl/applies-when.ts`

**Step 1: Add safe regex execution**

At the top of the file, add:

```typescript
const MAX_REGEX_LENGTH = 100
const REGEX_TIMEOUT_MS = 50

function safeRegexTest(pattern: string, value: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    console.warn(`[applies-when] Regex pattern too long: ${pattern.length} chars`)
    return false
  }

  try {
    const regex = new RegExp(pattern)
    // Simple patterns should complete quickly
    const start = Date.now()
    const result = regex.test(value)
    const elapsed = Date.now() - start

    if (elapsed > REGEX_TIMEOUT_MS) {
      console.warn(`[applies-when] Slow regex: ${elapsed}ms for pattern "${pattern}"`)
    }

    return result
  } catch {
    return false
  }
}
```

**Step 2: Update the matches case**

Replace the `case "matches"` block:

```typescript
case "matches": {
  const value = getFieldValue(context, predicate.field)
  if (typeof value !== "string") return false
  return safeRegexTest(predicate.pattern, value)
}
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/dsl/applies-when.ts
git commit -m "security: add ReDoS protection for regex patterns"
```

---

### Task 10: Add Missing Audit Log Events

**Files:**

- Modify: `src/lib/regulatory-truth/agents/sentinel.ts`
- Modify: `src/app/api/admin/regulatory-truth/rules/[id]/approve/route.ts`
- Modify: `src/app/api/admin/regulatory-truth/rules/[id]/reject/route.ts`

**Step 1: Add EVIDENCE_FETCHED to sentinel.ts**

After creating evidence record, add:

```typescript
await logAuditEvent({
  action: "EVIDENCE_FETCHED",
  entityType: "EVIDENCE",
  entityId: evidence.id,
  metadata: {
    sourceId: source.id,
    url: source.url,
    contentHash: contentHash,
  },
})
```

**Step 2: Add RULE_APPROVED to approve/route.ts**

After updating the rule, add:

```typescript
await logAuditEvent({
  action: "RULE_APPROVED",
  entityType: "RULE",
  entityId: id,
  performedBy: user.id,
  metadata: {
    riskTier: rule.riskTier,
    previousStatus: "PENDING_REVIEW",
  },
})
```

**Step 3: Add RULE_REJECTED to reject/route.ts**

After updating the rule, add:

```typescript
await logAuditEvent({
  action: "RULE_REJECTED",
  entityType: "RULE",
  entityId: id,
  performedBy: user.id,
  metadata: {
    reason: body.reason,
    previousStatus: rule.status,
  },
})
```

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/agents/sentinel.ts
git add src/app/api/admin/regulatory-truth/rules/[id]/approve/route.ts
git add src/app/api/admin/regulatory-truth/rules/[id]/reject/route.ts
git commit -m "feat: add missing audit log events for evidence and rule actions"
```

---

### Task 11: Fix Release approvedBy

**Files:**

- Modify: `src/lib/regulatory-truth/agents/releaser.ts`

**Step 1: Get actual approvers from rules**

In the releaser, replace LLM-sourced approvedBy with:

```typescript
// Get actual approvers from the rules being released
const approverIds = [
  ...new Set(
    rules.map((r) => r.approvedBy).filter((id): id is string => id !== null && id !== undefined)
  ),
]
```

**Step 2: Use in release creation**

```typescript
approvedBy: approverIds,
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/agents/releaser.ts
git commit -m "fix: use actual approver IDs from rules instead of LLM output"
```

---

### Task 12: Change Cascade Delete to Soft Delete

**Files:**

- Modify: `prisma/schema.prisma`
- Create migration

**Step 1: Add deletedAt to Evidence and SourcePointer**

```prisma
model Evidence {
  // ... existing fields
  deletedAt DateTime?
}

model SourcePointer {
  // ... existing fields
  deletedAt DateTime?
}
```

**Step 2: Change onDelete to SetNull**

Find `onDelete: Cascade` on SourcePointer → Evidence relation and change to `onDelete: SetNull`.

**Step 3: Create migration**

```bash
npx prisma migrate dev --name soft-delete-evidence-pointers
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add soft delete for Evidence and SourcePointer"
```

---

## Phase 4: Performance & Polish

### Task 13: Replace 2-Minute Sleep

**Files:**

- Modify: `src/lib/regulatory-truth/scripts/overnight-run.ts`

**Step 1: Change RATE_LIMIT_DELAY**

Find the constant and replace:

```typescript
const RATE_LIMIT_DELAY = parseInt(process.env.AGENT_RATE_LIMIT_MS || "3000") // 3 seconds
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/scripts/overnight-run.ts
git commit -m "perf: reduce rate limit delay from 2 minutes to 3 seconds"
```

---

### Task 14: Rewrite Tests to Import Real Code

**Files:**

- Modify: `src/lib/regulatory-truth/__tests__/arbiter.test.ts`

**Step 1: Check if functions are exported from arbiter.ts**

If not, export them:

```typescript
export function getAuthorityScore(level: string): number { ... }
export function checkEscalationCriteria(input: ArbiterInput): { shouldEscalate: boolean; reason: string } { ... }
```

**Step 2: Update tests to import real functions**

```typescript
import { getAuthorityScore, checkEscalationCriteria } from "../agents/arbiter"
```

**Step 3: Remove getMockFunctions helper**

**Step 4: Run tests**

```bash
npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/agents/arbiter.ts
git add src/lib/regulatory-truth/__tests__/arbiter.test.ts
git commit -m "test: rewrite arbiter tests to use real code instead of mocks"
```

---

### Task 15: Add API Rate Limiting

**Files:**

- Create: `src/lib/regulatory-truth/utils/rate-limit.ts`
- Modify: `src/app/api/rules/search/route.ts`
- Modify: `src/app/api/rules/evaluate/route.ts`

**Step 1: Create rate limiter utility**

```typescript
// src/lib/regulatory-truth/utils/rate-limit.ts

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "unknown"
}
```

**Step 2: Add to search route**

At the start of GET handler:

```typescript
import { checkRateLimit, getClientIP } from "@/lib/regulatory-truth/utils/rate-limit"

// ... in handler:
const ip = getClientIP(request)
const rateLimit = checkRateLimit(`search:${ip}`, 60)

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      },
    }
  )
}
```

**Step 3: Add to evaluate route similarly**

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/utils/rate-limit.ts
git add src/app/api/rules/search/route.ts
git add src/app/api/rules/evaluate/route.ts
git commit -m "security: add rate limiting to public API endpoints"
```

---

### Task 16: Fix URL Update Re-fetch Logic

**Files:**

- Modify: `src/lib/regulatory-truth/agents/sentinel.ts`

**Step 1: Update DiscoveredItem creation logic**

Change the logic to:

1. Check for existing item with same URL
2. Compare content hash
3. Only create new record if hash differs

```typescript
// Check for existing item
const existingItem = await db.discoveredItem.findFirst({
  where: { url: source.url },
  orderBy: { discoveredAt: "desc" },
})

// Skip if content unchanged
if (existingItem && existingItem.contentHash === contentHash) {
  console.log(`[sentinel] Content unchanged for ${source.url}`)
  return { success: true, changed: false }
}

// Create new discovered item (content changed or first time)
const item = await db.discoveredItem.create({
  data: {
    url: source.url,
    contentHash,
    // ... rest of fields
  },
})
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/agents/sentinel.ts
git commit -m "fix: allow re-fetching URLs when content changes"
```

---

### Task 17: Final Build and Test

**Step 1: Run full build**

```bash
npm run build
```

**Step 2: Run all tests**

```bash
npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts
npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts
```

**Step 3: Verify database state**

```sql
SELECT
  (SELECT COUNT(*) FROM "RegulatoryRule" WHERE "conceptId" IS NOT NULL) as rules_with_concepts,
  (SELECT COUNT(*) FROM "AgentRun" WHERE status = 'running' AND "startedAt" < NOW() - INTERVAL '30 minutes') as stuck_runs;
```

**Step 4: Push all changes**

```bash
git push origin main
```

---

## Summary

| Phase   | Tasks       | Focus                        |
| ------- | ----------- | ---------------------------- |
| Phase 1 | Tasks 1-4   | Reliability & Data Integrity |
| Phase 2 | Tasks 5-8   | Logic & Correctness          |
| Phase 3 | Tasks 9-12  | Security & Audit             |
| Phase 4 | Tasks 13-17 | Performance & Polish         |

**Total: 17 tasks**

After completion, re-run audit to verify all findings are resolved.
