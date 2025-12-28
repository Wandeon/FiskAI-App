# RTL → Content Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a control plane that projects Regulatory Truth Layer (RTL) rule changes into MDX content files via automated sync events, ensuring content is always a consumer of truth rather than a parallel source.

**Architecture:** When the Releaser publishes rules, it emits ContentSyncEvents with deterministic IDs (sha256 of signature). A BullMQ worker claims pending events, looks up target MDX files via Concept Registry, patches frontmatter (lastUpdated, rtl.conceptId, changelog), and creates PRs. Never auto-merge; always require human review.

**Tech Stack:** Drizzle ORM (PostgreSQL), BullMQ (Redis), gray-matter (frontmatter), Node.js crypto (sha256), GitHub CLI (PR creation)

---

## Phase 1: Event Infrastructure

### Task 1: Create ContentSyncEvent Drizzle Schema

**Files:**
- Create: `src/lib/db/schema/content-sync.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Write the schema file**

Create `src/lib/db/schema/content-sync.ts`:

```typescript
import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"

// Event types emitted by RTL
export const contentSyncEventType = pgEnum("content_sync_event_type", [
  "RULE_RELEASED",
  "RULE_SUPERSEDED",
  "RULE_EFFECTIVE",
  "SOURCE_CHANGED",
  "POINTERS_CHANGED",
  "CONFIDENCE_DROPPED",
])

// Processing status
export const contentSyncStatus = pgEnum("content_sync_status", [
  "PENDING",
  "ENQUEUED",
  "PROCESSING",
  "DONE",
  "FAILED",
  "DEAD_LETTERED",
  "SKIPPED",
])

// Reasons for permanent failure
export const deadLetterReason = pgEnum("content_sync_dead_letter_reason", [
  "UNMAPPED_CONCEPT",
  "INVALID_PAYLOAD",
  "MISSING_POINTERS",
  "CONTENT_NOT_FOUND",
  "FRONTMATTER_PARSE_ERROR",
  "PATCH_CONFLICT",
  "REPO_WRITE_FAILED",
  "DB_WRITE_FAILED",
  "UNKNOWN",
])

// Main events table
export const contentSyncEvents = pgTable(
  "content_sync_events",
  {
    // Deterministic ID: sha256(signature)
    eventId: text("event_id").primaryKey(),
    version: integer("version").notNull().default(1),
    type: contentSyncEventType("type").notNull(),
    status: contentSyncStatus("status").notNull().default("PENDING"),

    // Rule context
    ruleId: text("rule_id").notNull(),
    conceptId: text("concept_id").notNull(),
    domain: text("domain").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),

    // Processing state
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // Error tracking
    deadLetterReason: deadLetterReason("dead_letter_reason"),
    deadLetterNote: text("dead_letter_note"),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    // Full event payload (ContentSyncEventV1)
    payload: jsonb("payload").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Unique constraint for idempotency
    eventIdUnique: uniqueIndex("content_sync_events_event_id_uq").on(t.eventId),
    // Status + createdAt for queue polling
    statusIdx: index("content_sync_events_status_idx").on(t.status, t.createdAt),
    // ConceptId for registry lookups
    conceptIdx: index("content_sync_events_concept_idx").on(t.conceptId),
    // RuleId for audit trail
    ruleIdx: index("content_sync_events_rule_idx").on(t.ruleId),
  })
)

// TypeScript types
export type ContentSyncEvent = typeof contentSyncEvents.$inferSelect
export type NewContentSyncEvent = typeof contentSyncEvents.$inferInsert
export type ContentSyncEventType = (typeof contentSyncEventType.enumValues)[number]
export type ContentSyncStatus = (typeof contentSyncStatus.enumValues)[number]
export type DeadLetterReason = (typeof deadLetterReason.enumValues)[number]
```

**Step 2: Export from schema index**

Add to `src/lib/db/schema/index.ts`:

```typescript
export * from "./content-sync"
```

**Step 3: Run Drizzle migration**

Run: `npx drizzle-kit generate`
Expected: New migration file created in `drizzle/` directory

Run: `npx drizzle-kit push`
Expected: Tables created in database

**Step 4: Verify migration**

Run: `npx drizzle-kit studio`
Expected: Can see `content_sync_events` table with all columns

**Step 5: Commit**

```bash
git add src/lib/db/schema/content-sync.ts src/lib/db/schema/index.ts drizzle/
git commit -m "feat(rtl): add content_sync_events Drizzle schema"
```

---

### Task 2: Create Event Signature and ID Generation

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/event-id.ts`
- Create: `src/lib/regulatory-truth/content-sync/types.ts`

**Step 1: Write the types file**

Create `src/lib/regulatory-truth/content-sync/types.ts`:

```typescript
import type { ContentSyncEventType } from "@/lib/db/schema/content-sync"

/**
 * Signature fields for deterministic event ID generation.
 * Changing any of these fields produces a new event ID.
 */
export interface ContentSyncEventSignature {
  ruleId: string
  conceptId: string
  type: ContentSyncEventType
  effectiveFrom: string // ISO date YYYY-MM-DD
  newValue?: string
  sourcePointerIdsHash: string // sha256 of sorted sourcePointerIds
}

/**
 * Full event payload stored in content_sync_events.payload
 */
export interface ContentSyncEventV1 {
  version: 1
  id: string // sha256(signature)
  timestamp: string // ISO datetime
  type: ContentSyncEventType
  ruleId: string
  conceptId: string
  domain: "tax" | "business" | "compliance" | "fiscal"
  changeType: "create" | "update" | "repeal"
  effectiveFrom: string // ISO date
  previousValue?: string
  newValue?: string
  valueType?: "currency" | "percentage" | "date" | "threshold" | "text"
  sourcePointerIds: string[] // PRIMARY traceability chain
  evidenceIds?: string[] // Optional convenience
  primarySourceUrl?: string // Derived, not authoritative
  confidenceLevel: number // 0-100
  severity: "breaking" | "major" | "minor" | "info"
  signature: ContentSyncEventSignature
}

/**
 * Domain mapping for content sync
 */
export type ContentDomain = "tax" | "business" | "compliance" | "fiscal"

/**
 * Maps RTL domain strings to ContentDomain
 */
export function mapRtlDomainToContentDomain(rtlDomain: string): ContentDomain {
  const mapping: Record<string, ContentDomain> = {
    pdv: "tax",
    pausalni: "tax",
    doprinosi: "tax",
    porez_na_dobit: "tax",
    fiskalizacija: "fiscal",
    racunovodstvo: "business",
    // Add more mappings as needed
  }
  return mapping[rtlDomain] || "compliance"
}
```

**Step 2: Write the event ID generation file**

Create `src/lib/regulatory-truth/content-sync/event-id.ts`:

```typescript
import { createHash } from "crypto"
import type { ContentSyncEventSignature } from "./types"

/**
 * Generate deterministic event ID from signature.
 * Same inputs always produce same ID (idempotency).
 */
export function generateEventId(signature: ContentSyncEventSignature): string {
  // Canonical JSON serialization (sorted keys)
  const canonical = JSON.stringify(signature, Object.keys(signature).sort())
  return createHash("sha256").update(canonical).digest("hex")
}

/**
 * Generate hash of source pointer IDs for signature.
 * Sorted to ensure determinism regardless of array order.
 */
export function hashSourcePointerIds(ids: string[]): string {
  const sorted = [...ids].sort()
  return createHash("sha256").update(sorted.join(",")).digest("hex")
}

/**
 * Determine event severity based on rule tier and change type.
 */
export function determineSeverity(
  ruleTier: "T0" | "T1" | "T2" | "T3",
  changeType: "create" | "update" | "repeal"
): "breaking" | "major" | "minor" | "info" {
  if (changeType === "repeal") return "breaking"
  if (ruleTier === "T0") return "breaking"
  if (ruleTier === "T1") return "major"
  if (ruleTier === "T2") return "minor"
  return "info"
}
```

**Step 3: Write failing test**

Create `src/lib/regulatory-truth/content-sync/__tests__/event-id.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  generateEventId,
  hashSourcePointerIds,
  determineSeverity,
} from "../event-id"
import type { ContentSyncEventSignature } from "../types"

describe("generateEventId", () => {
  it("produces deterministic ID for same signature", () => {
    const sig: ContentSyncEventSignature = {
      ruleId: "rule_123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2026-01-01",
      newValue: "65000",
      sourcePointerIdsHash: "abc123",
    }

    const id1 = generateEventId(sig)
    const id2 = generateEventId(sig)

    expect(id1).toBe(id2)
    expect(id1).toHaveLength(64) // SHA-256 hex
  })

  it("produces different ID when signature changes", () => {
    const sig1: ContentSyncEventSignature = {
      ruleId: "rule_123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2026-01-01",
      sourcePointerIdsHash: "abc123",
    }

    const sig2: ContentSyncEventSignature = {
      ...sig1,
      newValue: "70000",
    }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })
})

describe("hashSourcePointerIds", () => {
  it("produces same hash regardless of order", () => {
    const ids1 = ["sptr_a", "sptr_b", "sptr_c"]
    const ids2 = ["sptr_c", "sptr_a", "sptr_b"]

    expect(hashSourcePointerIds(ids1)).toBe(hashSourcePointerIds(ids2))
  })

  it("produces different hash for different IDs", () => {
    const ids1 = ["sptr_a", "sptr_b"]
    const ids2 = ["sptr_a", "sptr_c"]

    expect(hashSourcePointerIds(ids1)).not.toBe(hashSourcePointerIds(ids2))
  })
})

describe("determineSeverity", () => {
  it("returns breaking for repeal", () => {
    expect(determineSeverity("T3", "repeal")).toBe("breaking")
  })

  it("returns breaking for T0", () => {
    expect(determineSeverity("T0", "update")).toBe("breaking")
  })

  it("returns major for T1", () => {
    expect(determineSeverity("T1", "create")).toBe("major")
  })

  it("returns minor for T2", () => {
    expect(determineSeverity("T2", "update")).toBe("minor")
  })

  it("returns info for T3", () => {
    expect(determineSeverity("T3", "update")).toBe("info")
  })
})
```

**Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/event-id.test.ts`
Expected: FAIL (files don't exist yet or implementation missing)

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/event-id.test.ts`
Expected: PASS (all tests green)

**Step 6: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/
git commit -m "feat(rtl): add event ID generation with deterministic signatures"
```

---

### Task 3: Create Event Emitter Function

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/emit-event.ts`
- Create: `src/lib/regulatory-truth/content-sync/index.ts`

**Step 1: Write the emitter**

Create `src/lib/regulatory-truth/content-sync/emit-event.ts`:

```typescript
import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import { generateEventId, hashSourcePointerIds, determineSeverity } from "./event-id"
import type { ContentSyncEventV1, ContentDomain } from "./types"
import type { ContentSyncEventType } from "@/lib/db/schema/content-sync"

interface EmitEventParams {
  type: ContentSyncEventType
  ruleId: string
  conceptId: string
  domain: ContentDomain
  effectiveFrom: Date
  changeType: "create" | "update" | "repeal"
  ruleTier: "T0" | "T1" | "T2" | "T3"
  sourcePointerIds: string[]
  evidenceIds?: string[]
  previousValue?: string
  newValue?: string
  valueType?: "currency" | "percentage" | "date" | "threshold" | "text"
  primarySourceUrl?: string
  confidenceLevel: number
}

/**
 * Emit a content sync event. Idempotent - duplicate events are ignored.
 * Returns the event ID (new or existing).
 */
export async function emitContentSyncEvent(
  params: EmitEventParams
): Promise<{ eventId: string; isNew: boolean }> {
  const {
    type,
    ruleId,
    conceptId,
    domain,
    effectiveFrom,
    changeType,
    ruleTier,
    sourcePointerIds,
    evidenceIds,
    previousValue,
    newValue,
    valueType,
    primarySourceUrl,
    confidenceLevel,
  } = params

  // Validate: must have source pointers
  if (sourcePointerIds.length === 0) {
    throw new MissingPointersError(ruleId)
  }

  // Build signature for deterministic ID
  const sourcePointerIdsHash = hashSourcePointerIds(sourcePointerIds)
  const signature = {
    ruleId,
    conceptId,
    type,
    effectiveFrom: effectiveFrom.toISOString().split("T")[0],
    newValue,
    sourcePointerIdsHash,
  }

  const eventId = generateEventId(signature)
  const severity = determineSeverity(ruleTier, changeType)

  // Build full payload
  const payload: ContentSyncEventV1 = {
    version: 1,
    id: eventId,
    timestamp: new Date().toISOString(),
    type,
    ruleId,
    conceptId,
    domain,
    changeType,
    effectiveFrom: effectiveFrom.toISOString().split("T")[0],
    previousValue,
    newValue,
    valueType,
    sourcePointerIds,
    evidenceIds,
    primarySourceUrl,
    confidenceLevel,
    severity,
    signature,
  }

  // Insert with ON CONFLICT DO NOTHING (idempotency)
  const result = await drizzleDb
    .insert(contentSyncEvents)
    .values({
      eventId,
      version: 1,
      type,
      status: "PENDING",
      ruleId,
      conceptId,
      domain,
      effectiveFrom,
      payload,
    })
    .onConflictDoNothing({ target: contentSyncEvents.eventId })
    .returning({ eventId: contentSyncEvents.eventId })

  // If insert returned row, it's new. Otherwise, it existed.
  const isNew = result.length > 0

  return { eventId, isNew }
}

// Custom error for missing pointers
export class MissingPointersError extends Error {
  constructor(public ruleId: string) {
    super(`Event has no sourcePointerIds for rule: ${ruleId}`)
    this.name = "MissingPointersError"
  }
}
```

**Step 2: Create barrel export**

Create `src/lib/regulatory-truth/content-sync/index.ts`:

```typescript
export * from "./types"
export * from "./event-id"
export * from "./emit-event"
```

**Step 3: Write test**

Create `src/lib/regulatory-truth/content-sync/__tests__/emit-event.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import { emitContentSyncEvent, MissingPointersError } from "../emit-event"
import { eq } from "drizzle-orm"

describe("emitContentSyncEvent", () => {
  const testEventId = "test-event-" + Date.now()

  afterEach(async () => {
    // Cleanup test events
    await drizzleDb
      .delete(contentSyncEvents)
      .where(eq(contentSyncEvents.ruleId, "test-rule-123"))
  })

  it("creates event with correct fields", async () => {
    const result = await emitContentSyncEvent({
      type: "RULE_RELEASED",
      ruleId: "test-rule-123",
      conceptId: "pdv-threshold",
      domain: "tax",
      effectiveFrom: new Date("2026-01-01"),
      changeType: "update",
      ruleTier: "T1",
      sourcePointerIds: ["sptr_a", "sptr_b"],
      confidenceLevel: 92,
      newValue: "65000",
      valueType: "currency",
    })

    expect(result.eventId).toHaveLength(64)
    expect(result.isNew).toBe(true)

    // Verify in DB
    const [event] = await drizzleDb
      .select()
      .from(contentSyncEvents)
      .where(eq(contentSyncEvents.eventId, result.eventId))

    expect(event.status).toBe("PENDING")
    expect(event.conceptId).toBe("pdv-threshold")
    expect(event.domain).toBe("tax")
  })

  it("is idempotent - duplicate returns existing", async () => {
    const params = {
      type: "RULE_RELEASED" as const,
      ruleId: "test-rule-123",
      conceptId: "pdv-threshold",
      domain: "tax" as const,
      effectiveFrom: new Date("2026-01-01"),
      changeType: "update" as const,
      ruleTier: "T1" as const,
      sourcePointerIds: ["sptr_a", "sptr_b"],
      confidenceLevel: 92,
    }

    const result1 = await emitContentSyncEvent(params)
    const result2 = await emitContentSyncEvent(params)

    expect(result1.eventId).toBe(result2.eventId)
    expect(result1.isNew).toBe(true)
    expect(result2.isNew).toBe(false)
  })

  it("throws MissingPointersError when no pointers", async () => {
    await expect(
      emitContentSyncEvent({
        type: "RULE_RELEASED",
        ruleId: "test-rule-123",
        conceptId: "pdv-threshold",
        domain: "tax",
        effectiveFrom: new Date("2026-01-01"),
        changeType: "update",
        ruleTier: "T1",
        sourcePointerIds: [], // Empty!
        confidenceLevel: 92,
      })
    ).rejects.toThrow(MissingPointersError)
  })
})
```

**Step 4: Run test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/emit-event.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/
git commit -m "feat(rtl): add idempotent content sync event emitter"
```

---

### Task 4: Integrate Event Emission into Releaser

**Files:**
- Modify: `src/lib/regulatory-truth/agents/releaser.ts`

**Step 1: Find the release success point**

Read `src/lib/regulatory-truth/agents/releaser.ts` and locate where RuleRelease is created (around line 328-348).

**Step 2: Add event emission after successful release**

After the `ruleRelease` is created (around line 348), add:

```typescript
import { emitContentSyncEvent } from "@/lib/regulatory-truth/content-sync"
import { mapRtlDomainToContentDomain } from "@/lib/regulatory-truth/content-sync/types"

// Inside runReleaser, after successful release creation:
// Emit content sync events for each released rule
for (const rule of releasedRules) {
  // Get source pointer IDs from rule
  const sourcePointerIds = rule.sourcePointers.map((sp) => sp.id)
  const evidenceIds = [...new Set(rule.sourcePointers.map((sp) => sp.evidenceId))]

  // Determine change type from release type
  const changeType = rule.status === "REPEALED" ? "repeal" :
    previousVersionExists ? "update" : "create"

  // Get primary source URL from first pointer with lawReference
  const primarySourceUrl = rule.sourcePointers.find((sp) => sp.lawReference)?.lawReference

  try {
    await emitContentSyncEvent({
      type: "RULE_RELEASED",
      ruleId: rule.id,
      conceptId: rule.conceptId, // Must be set on rule
      domain: mapRtlDomainToContentDomain(rule.domain),
      effectiveFrom: rule.effectiveFrom,
      changeType,
      ruleTier: rule.riskTier as "T0" | "T1" | "T2" | "T3",
      sourcePointerIds,
      evidenceIds,
      previousValue: rule.previousValue,
      newValue: rule.currentValue,
      valueType: rule.valueType,
      primarySourceUrl,
      confidenceLevel: Math.round(rule.confidence * 100),
    })
  } catch (error) {
    // Log but don't fail release - content sync is non-blocking
    console.error(`Failed to emit content sync event for rule ${rule.id}:`, error)
  }
}
```

**Step 3: Add conceptId to RegulatoryRule model if missing**

Check Prisma schema for `conceptId` field on RegulatoryRule. If missing, add it:

```prisma
model RegulatoryRule {
  // ... existing fields
  conceptId     String?  // Canonical concept ID for content mapping
  // ...
}
```

Run: `npx prisma migrate dev --name add-concept-id-to-rule`

**Step 4: Test the integration**

Run: `npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts --dry-run`
Expected: Logs show event emission attempts (dry-run won't persist)

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/agents/releaser.ts prisma/
git commit -m "feat(rtl): emit content sync events on rule release"
```

---

### Task 5: Create Content Sync BullMQ Queue

**Files:**
- Modify: `src/lib/regulatory-truth/workers/queues.ts`

**Step 1: Add content-sync queue to queues.ts**

Add after existing queue definitions:

```typescript
// Content sync queue - processes MDX patching jobs
// Lower rate limit since it involves git operations
export const contentSyncQueue = createQueue("content-sync", {
  max: 2,      // 2 jobs per minute
  duration: 60000,
})
```

**Step 2: Export the queue**

Add to exports at bottom of file:

```typescript
export const queues = {
  // ... existing queues
  contentSync: contentSyncQueue,
}
```

**Step 3: Verify queue creation**

Run: `npx tsx -e "import { queues } from './src/lib/regulatory-truth/workers/queues'; console.log(Object.keys(queues))"`
Expected: Lists `contentSync` among queue names

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/workers/queues.ts
git commit -m "feat(rtl): add content-sync BullMQ queue"
```

---

## Phase 2: Concept Registry

### Task 6: Create Concept Registry Types and Structure

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/concept-registry.ts`

**Step 1: Write the registry**

Create `src/lib/regulatory-truth/content-sync/concept-registry.ts`:

```typescript
import path from "path"

/**
 * Mapping from conceptId to content targets.
 * No regex - exact conceptId matching only.
 */
export interface ConceptMapping {
  conceptId: string
  description: string
  mdxPaths: string[] // Relative to content/ directory
  toolIds?: string[] // Calculator or tool IDs to update
}

/**
 * Content sync concept registry.
 * Maps RTL conceptIds to target MDX files.
 *
 * IMPORTANT: Paths are relative to /content/ directory.
 * Example: "vodici/pausalni-obrt.mdx" resolves to /content/vodici/pausalni-obrt.mdx
 */
export const CONCEPT_REGISTRY: ConceptMapping[] = [
  // Tax thresholds
  {
    conceptId: "pdv-threshold",
    description: "PDV registration threshold",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "vodici/freelancer.mdx",
      "rjecnik/pdv.mdx",
      "usporedbe/pocinjem-solo.mdx",
    ],
  },
  {
    conceptId: "pausalni-revenue-limit",
    description: "Paušalni obrt annual revenue limit",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "rjecnik/pausalni-obrt.mdx",
      "usporedbe/pocinjem-solo.mdx",
    ],
  },
  {
    conceptId: "pausalni-tax-rate",
    description: "Paušalni obrt flat tax rate",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "rjecnik/pausalni-porez.mdx",
    ],
  },
  {
    conceptId: "pausalni-contribution-base",
    description: "Paušalni obrt contribution calculation base",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
    ],
  },
  // Contribution rates
  {
    conceptId: "zdravstveno-rate",
    description: "Health insurance contribution rate",
    mdxPaths: [
      "rjecnik/doprinosi.mdx",
      "vodici/pausalni-obrt.mdx",
    ],
  },
  {
    conceptId: "mirovinsko-rate",
    description: "Pension contribution rate",
    mdxPaths: [
      "rjecnik/doprinosi.mdx",
      "vodici/pausalni-obrt.mdx",
    ],
  },
  // Fiscalization
  {
    conceptId: "fiskalizacija-required",
    description: "Fiscalization requirements",
    mdxPaths: [
      "rjecnik/fiskalizacija.mdx",
      "vodici/pausalni-obrt.mdx",
    ],
  },
  // Deadlines
  {
    conceptId: "posd-deadline",
    description: "PO-SD form submission deadline",
    mdxPaths: [
      "kako-da/ispuniti-po-sd.mdx",
      "vodici/pausalni-obrt.mdx",
    ],
  },
  {
    conceptId: "joppd-deadline",
    description: "JOPPD form submission deadline",
    mdxPaths: [
      "rjecnik/joppd.mdx",
    ],
  },
  // Corporate
  {
    conceptId: "jdoo-capital-requirement",
    description: "j.d.o.o. minimum capital requirement",
    mdxPaths: [
      "rjecnik/jdoo.mdx",
      "usporedbe/pocinjem-solo.mdx",
    ],
  },
  {
    conceptId: "doo-capital-requirement",
    description: "d.o.o. minimum capital requirement",
    mdxPaths: [
      "rjecnik/doo.mdx",
      "usporedbe/pocinjem-solo.mdx",
    ],
  },
  // Income tax
  {
    conceptId: "porez-na-dohodak-rates",
    description: "Personal income tax rates and brackets",
    mdxPaths: [
      "rjecnik/porez-na-dohodak.mdx",
    ],
  },
  {
    conceptId: "osobni-odbitak",
    description: "Personal tax deduction amount",
    mdxPaths: [
      "rjecnik/osobni-odbitak.mdx",
    ],
  },
  // Corporate tax
  {
    conceptId: "porez-na-dobit-rate",
    description: "Corporate profit tax rate",
    mdxPaths: [
      "rjecnik/porez-na-dobit.mdx",
    ],
  },
  // E-invoicing
  {
    conceptId: "e-racun-mandatory",
    description: "E-invoice mandate requirements",
    mdxPaths: [
      "rjecnik/e-racun.mdx",
    ],
  },
  // Reverse charge
  {
    conceptId: "reverse-charge-eu",
    description: "EU reverse charge rules",
    mdxPaths: [
      "vodici/freelancer.mdx",
      "rjecnik/reverse-charge.mdx",
    ],
  },
  // Minimum wage
  {
    conceptId: "minimalna-placa",
    description: "Minimum wage amount",
    mdxPaths: [
      "rjecnik/minimalna-placa.mdx",
    ],
  },
  // OPG
  {
    conceptId: "opg-pdv-threshold",
    description: "OPG VAT registration threshold",
    mdxPaths: [
      "rjecnik/opg.mdx",
    ],
  },
  {
    conceptId: "opg-pausalni-limit",
    description: "OPG flat-rate taxation limit",
    mdxPaths: [
      "rjecnik/opg.mdx",
    ],
  },
]

/**
 * Look up concept mapping by ID. Returns undefined if not found.
 */
export function getConceptMapping(conceptId: string): ConceptMapping | undefined {
  return CONCEPT_REGISTRY.find((m) => m.conceptId === conceptId)
}

/**
 * Resolve MDX paths to absolute paths.
 */
export function resolveContentPaths(mapping: ConceptMapping, contentDir: string): string[] {
  return mapping.mdxPaths.map((p) => path.join(contentDir, p))
}

/**
 * Get all registered concept IDs.
 */
export function getAllConceptIds(): string[] {
  return CONCEPT_REGISTRY.map((m) => m.conceptId)
}
```

**Step 2: Write test**

Create `src/lib/regulatory-truth/content-sync/__tests__/concept-registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  getConceptMapping,
  resolveContentPaths,
  getAllConceptIds,
  CONCEPT_REGISTRY,
} from "../concept-registry"

describe("concept-registry", () => {
  it("finds mapping by conceptId", () => {
    const mapping = getConceptMapping("pdv-threshold")
    expect(mapping).toBeDefined()
    expect(mapping!.mdxPaths).toContain("vodici/pausalni-obrt.mdx")
  })

  it("returns undefined for unknown conceptId", () => {
    const mapping = getConceptMapping("unknown-concept")
    expect(mapping).toBeUndefined()
  })

  it("resolves paths to absolute", () => {
    const mapping = getConceptMapping("pdv-threshold")!
    const resolved = resolveContentPaths(mapping, "/home/user/project/content")
    expect(resolved[0]).toBe("/home/user/project/content/vodici/pausalni-obrt.mdx")
  })

  it("has no duplicate conceptIds", () => {
    const ids = getAllConceptIds()
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it("has at least 20 concepts registered", () => {
    expect(CONCEPT_REGISTRY.length).toBeGreaterThanOrEqual(20)
  })

  it("all mdxPaths end with .mdx", () => {
    for (const mapping of CONCEPT_REGISTRY) {
      for (const p of mapping.mdxPaths) {
        expect(p).toMatch(/\.mdx$/)
      }
    }
  })
})
```

**Step 3: Run test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/concept-registry.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/concept-registry.ts
git add src/lib/regulatory-truth/content-sync/__tests__/concept-registry.test.ts
git commit -m "feat(rtl): add concept registry with 20 core mappings"
```

---

### Task 7: Create Concept Registry Validation Script

**Files:**
- Create: `scripts/validate-concept-registry.ts`

**Step 1: Write validation script**

Create `scripts/validate-concept-registry.ts`:

```typescript
#!/usr/bin/env npx tsx

import fs from "fs"
import path from "path"
import { CONCEPT_REGISTRY, getAllConceptIds } from "../src/lib/regulatory-truth/content-sync/concept-registry"

const CONTENT_DIR = path.join(process.cwd(), "content")

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalConcepts: number
    totalPaths: number
    missingPaths: number
    duplicateIds: number
  }
}

function validateRegistry(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const allPaths = new Set<string>()
  let missingPaths = 0

  // Check for duplicate IDs
  const ids = getAllConceptIds()
  const idCounts = new Map<string, number>()
  for (const id of ids) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1)
  }
  const duplicateIds = [...idCounts.entries()].filter(([_, count]) => count > 1)
  if (duplicateIds.length > 0) {
    for (const [id, count] of duplicateIds) {
      errors.push(`Duplicate conceptId: "${id}" appears ${count} times`)
    }
  }

  // Validate each mapping
  for (const mapping of CONCEPT_REGISTRY) {
    // Check conceptId format
    if (!/^[a-z0-9-]+$/.test(mapping.conceptId)) {
      errors.push(`Invalid conceptId format: "${mapping.conceptId}" (use lowercase with hyphens)`)
    }

    // Check description
    if (!mapping.description || mapping.description.length < 10) {
      warnings.push(`Concept "${mapping.conceptId}" has short/missing description`)
    }

    // Check paths exist
    for (const mdxPath of mapping.mdxPaths) {
      allPaths.add(mdxPath)
      const fullPath = path.join(CONTENT_DIR, mdxPath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing MDX file: ${mdxPath} (concept: ${mapping.conceptId})`)
        missingPaths++
      }
    }

    // Check for empty paths
    if (mapping.mdxPaths.length === 0) {
      warnings.push(`Concept "${mapping.conceptId}" has no MDX paths`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalConcepts: CONCEPT_REGISTRY.length,
      totalPaths: allPaths.size,
      missingPaths,
      duplicateIds: duplicateIds.length,
    },
  }
}

// Run validation
console.log("Validating Concept Registry...\n")

const result = validateRegistry()

console.log("Stats:")
console.log(`  Concepts: ${result.stats.totalConcepts}`)
console.log(`  Unique paths: ${result.stats.totalPaths}`)
console.log(`  Missing paths: ${result.stats.missingPaths}`)
console.log(`  Duplicate IDs: ${result.stats.duplicateIds}`)
console.log()

if (result.warnings.length > 0) {
  console.log("Warnings:")
  for (const w of result.warnings) {
    console.log(`  ⚠️  ${w}`)
  }
  console.log()
}

if (result.errors.length > 0) {
  console.log("Errors:")
  for (const e of result.errors) {
    console.log(`  ❌ ${e}`)
  }
  console.log()
  process.exit(1)
}

console.log("✅ Concept registry is valid!")
```

**Step 2: Run validation**

Run: `npx tsx scripts/validate-concept-registry.ts`
Expected: Lists stats, shows any missing files as errors

**Step 3: Fix any missing MDX paths**

If validation shows missing files, either:
- Create the missing MDX files, OR
- Remove the paths from concept-registry.ts

**Step 4: Commit**

```bash
git add scripts/validate-concept-registry.ts
git commit -m "feat(rtl): add concept registry validation script"
```

---

## Phase 3: MDX Patching Worker

### Task 8: Create Custom Error Classes

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/errors.ts`

**Step 1: Write error classes**

Create `src/lib/regulatory-truth/content-sync/errors.ts`:

```typescript
import type { DeadLetterReason } from "@/lib/db/schema/content-sync"

// Base class for content sync errors
export abstract class ContentSyncError extends Error {
  abstract readonly kind: "PERMANENT" | "TRANSIENT"
  abstract readonly deadLetterReason?: DeadLetterReason
}

// PERMANENT errors - dead letter immediately

export class UnmappedConceptError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "UNMAPPED_CONCEPT" as const

  constructor(public conceptId: string) {
    super(`Unmapped conceptId: ${conceptId}`)
    this.name = "UnmappedConceptError"
  }
}

export class InvalidPayloadError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "INVALID_PAYLOAD" as const

  constructor(public details: string) {
    super(`Invalid payload: ${details}`)
    this.name = "InvalidPayloadError"
  }
}

export class MissingPointersError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "MISSING_POINTERS" as const

  constructor(public ruleId: string) {
    super(`Event has no sourcePointerIds for rule: ${ruleId}`)
    this.name = "MissingPointersError"
  }
}

export class ContentNotFoundError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "CONTENT_NOT_FOUND" as const

  constructor(public filePath: string) {
    super(`Content not found: ${filePath}`)
    this.name = "ContentNotFoundError"
  }
}

export class FrontmatterParseError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "FRONTMATTER_PARSE_ERROR" as const

  constructor(
    public filePath: string,
    public parseError: string
  ) {
    super(`Frontmatter parse failed: ${filePath} - ${parseError}`)
    this.name = "FrontmatterParseError"
  }
}

export class PatchConflictError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "PATCH_CONFLICT" as const

  constructor(
    public filePath: string,
    public reason: string
  ) {
    super(`Patch conflict: ${filePath} (${reason})`)
    this.name = "PatchConflictError"
  }
}

// TRANSIENT errors - retry with backoff

export class RepoWriteFailedError extends ContentSyncError {
  readonly kind = "TRANSIENT" as const
  readonly deadLetterReason = undefined

  constructor(message: string) {
    super(`Repo write failed: ${message}`)
    this.name = "RepoWriteFailedError"
  }
}

export class DbWriteFailedError extends ContentSyncError {
  readonly kind = "TRANSIENT" as const
  readonly deadLetterReason = undefined

  constructor(message: string) {
    super(`DB write failed: ${message}`)
    this.name = "DbWriteFailedError"
  }
}

/**
 * Classify an error for worker handling.
 */
export function classifyError(err: unknown): {
  kind: "PERMANENT" | "TRANSIENT"
  deadLetterReason?: DeadLetterReason
  message: string
} {
  if (err instanceof ContentSyncError) {
    return {
      kind: err.kind,
      deadLetterReason: err.deadLetterReason,
      message: err.message,
    }
  }

  // Unknown errors are transient (retry)
  return {
    kind: "TRANSIENT",
    message: err instanceof Error ? err.message : String(err),
  }
}
```

**Step 2: Write test**

Create `src/lib/regulatory-truth/content-sync/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  UnmappedConceptError,
  InvalidPayloadError,
  RepoWriteFailedError,
  classifyError,
} from "../errors"

describe("classifyError", () => {
  it("classifies UnmappedConceptError as PERMANENT", () => {
    const err = new UnmappedConceptError("unknown-concept")
    const result = classifyError(err)

    expect(result.kind).toBe("PERMANENT")
    expect(result.deadLetterReason).toBe("UNMAPPED_CONCEPT")
  })

  it("classifies InvalidPayloadError as PERMANENT", () => {
    const err = new InvalidPayloadError("missing required field")
    const result = classifyError(err)

    expect(result.kind).toBe("PERMANENT")
    expect(result.deadLetterReason).toBe("INVALID_PAYLOAD")
  })

  it("classifies RepoWriteFailedError as TRANSIENT", () => {
    const err = new RepoWriteFailedError("git push failed")
    const result = classifyError(err)

    expect(result.kind).toBe("TRANSIENT")
    expect(result.deadLetterReason).toBeUndefined()
  })

  it("classifies unknown errors as TRANSIENT", () => {
    const err = new Error("some random error")
    const result = classifyError(err)

    expect(result.kind).toBe("TRANSIENT")
  })
})
```

**Step 3: Run test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/errors.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/errors.ts
git add src/lib/regulatory-truth/content-sync/__tests__/errors.test.ts
git commit -m "feat(rtl): add content sync error classes with classification"
```

---

### Task 9: Create Frontmatter Patcher

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/patcher.ts`

**Step 1: Write the patcher**

Create `src/lib/regulatory-truth/content-sync/patcher.ts`:

```typescript
import fs from "fs"
import matter from "gray-matter"
import type { ContentSyncEventV1 } from "./types"
import {
  ContentNotFoundError,
  FrontmatterParseError,
  PatchConflictError,
} from "./errors"

/**
 * Changelog entry in frontmatter
 */
export interface ChangelogEntry {
  eventId: string
  date: string // YYYY-MM-DD
  severity: "breaking" | "major" | "minor" | "info"
  changeType: "create" | "update" | "repeal"
  summary: string
  effectiveFrom: string
  sourcePointerIds: string[]
  primarySourceUrl?: string
  confidenceLevel: number
}

/**
 * RTL section in frontmatter
 */
export interface RtlFrontmatter {
  conceptId: string
  ruleId: string
}

/**
 * Read and parse MDX file frontmatter
 */
export function readMdxFrontmatter(filePath: string): {
  data: Record<string, unknown>
  content: string
  raw: string
} {
  if (!fs.existsSync(filePath)) {
    throw new ContentNotFoundError(filePath)
  }

  const raw = fs.readFileSync(filePath, "utf-8")

  try {
    const { data, content } = matter(raw)
    return { data, content, raw }
  } catch (err) {
    throw new FrontmatterParseError(
      filePath,
      err instanceof Error ? err.message : String(err)
    )
  }
}

/**
 * Generate changelog summary from event
 */
export function generateChangelogSummary(event: ContentSyncEventV1): string {
  const { changeType, previousValue, newValue, valueType } = event

  if (changeType === "repeal") {
    return `Rule repealed.`
  }

  if (changeType === "create") {
    if (newValue && valueType) {
      return `New ${valueType}: ${newValue}.`
    }
    return `New rule created.`
  }

  // update
  if (previousValue && newValue) {
    return `Updated from ${previousValue} to ${newValue}.`
  }
  if (newValue) {
    return `Updated to ${newValue}.`
  }
  return `Rule updated.`
}

/**
 * Create changelog entry from event
 */
export function createChangelogEntry(event: ContentSyncEventV1): ChangelogEntry {
  return {
    eventId: event.id,
    date: new Date().toISOString().split("T")[0],
    severity: event.severity,
    changeType: event.changeType,
    summary: generateChangelogSummary(event),
    effectiveFrom: event.effectiveFrom,
    sourcePointerIds: event.sourcePointerIds,
    primarySourceUrl: event.primarySourceUrl,
    confidenceLevel: event.confidenceLevel,
  }
}

/**
 * Patch frontmatter with event data.
 * Returns the new file content.
 */
export function patchFrontmatter(
  filePath: string,
  event: ContentSyncEventV1
): string {
  const { data, content } = readMdxFrontmatter(filePath)

  // Update lastUpdated
  data.lastUpdated = new Date().toISOString().split("T")[0]

  // Set/update rtl section
  data.rtl = {
    conceptId: event.conceptId,
    ruleId: event.ruleId,
  } as RtlFrontmatter

  // Initialize changelog if missing
  if (!Array.isArray(data.changelog)) {
    data.changelog = []
  }

  const changelog = data.changelog as ChangelogEntry[]

  // Check for duplicate eventId (idempotency)
  const existingIndex = changelog.findIndex((e) => e.eventId === event.id)
  if (existingIndex !== -1) {
    // Already processed - skip
    throw new PatchConflictError(filePath, `eventId ${event.id} already in changelog`)
  }

  // Add new entry at the beginning (newest first)
  const newEntry = createChangelogEntry(event)
  changelog.unshift(newEntry)

  // Keep changelog sorted by date descending
  changelog.sort((a, b) => b.date.localeCompare(a.date))

  data.changelog = changelog

  // Serialize back to frontmatter + content
  return matter.stringify(content, data)
}

/**
 * Write patched content to file
 */
export function writeMdxFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, "utf-8")
}
```

**Step 2: Write test**

Create `src/lib/regulatory-truth/content-sync/__tests__/patcher.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import {
  readMdxFrontmatter,
  patchFrontmatter,
  createChangelogEntry,
  generateChangelogSummary,
} from "../patcher"
import type { ContentSyncEventV1 } from "../types"
import { ContentNotFoundError, PatchConflictError } from "../errors"

const testEvent: ContentSyncEventV1 = {
  version: 1,
  id: "abc123def456",
  timestamp: "2026-01-01T12:00:00Z",
  type: "RULE_RELEASED",
  ruleId: "rule_123",
  conceptId: "pdv-threshold",
  domain: "tax",
  changeType: "update",
  effectiveFrom: "2026-01-01",
  previousValue: "60000",
  newValue: "65000",
  valueType: "currency",
  sourcePointerIds: ["sptr_a", "sptr_b"],
  primarySourceUrl: "https://narodne-novine.nn.hr/clanci/123",
  confidenceLevel: 92,
  severity: "major",
  signature: {
    ruleId: "rule_123",
    conceptId: "pdv-threshold",
    type: "RULE_RELEASED",
    effectiveFrom: "2026-01-01",
    newValue: "65000",
    sourcePointerIdsHash: "hash123",
  },
}

describe("generateChangelogSummary", () => {
  it("generates update summary with values", () => {
    const summary = generateChangelogSummary(testEvent)
    expect(summary).toBe("Updated from 60000 to 65000.")
  })

  it("generates repeal summary", () => {
    const event = { ...testEvent, changeType: "repeal" as const }
    const summary = generateChangelogSummary(event)
    expect(summary).toBe("Rule repealed.")
  })

  it("generates create summary", () => {
    const event = {
      ...testEvent,
      changeType: "create" as const,
      previousValue: undefined,
    }
    const summary = generateChangelogSummary(event)
    expect(summary).toBe("New currency: 65000.")
  })
})

describe("createChangelogEntry", () => {
  it("creates valid changelog entry", () => {
    const entry = createChangelogEntry(testEvent)

    expect(entry.eventId).toBe("abc123def456")
    expect(entry.severity).toBe("major")
    expect(entry.changeType).toBe("update")
    expect(entry.sourcePointerIds).toEqual(["sptr_a", "sptr_b"])
    expect(entry.confidenceLevel).toBe(92)
  })
})

describe("patchFrontmatter", () => {
  let tempDir: string
  let testFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "patcher-test-"))
    testFile = path.join(tempDir, "test.mdx")

    const initialContent = `---
title: Test Document
description: A test MDX file
lastUpdated: 2025-01-01
---

# Test Content

Some markdown here.
`
    fs.writeFileSync(testFile, initialContent)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true })
  })

  it("patches frontmatter with event data", () => {
    const patched = patchFrontmatter(testFile, testEvent)

    expect(patched).toContain("conceptId: pdv-threshold")
    expect(patched).toContain("ruleId: rule_123")
    expect(patched).toContain("eventId: abc123def456")
    expect(patched).toContain("# Test Content")
  })

  it("throws ContentNotFoundError for missing file", () => {
    expect(() => patchFrontmatter("/nonexistent/file.mdx", testEvent)).toThrow(
      ContentNotFoundError
    )
  })

  it("throws PatchConflictError for duplicate eventId", () => {
    // First patch
    const patched1 = patchFrontmatter(testFile, testEvent)
    fs.writeFileSync(testFile, patched1)

    // Second patch with same event should fail
    expect(() => patchFrontmatter(testFile, testEvent)).toThrow(PatchConflictError)
  })

  it("preserves existing content", () => {
    const patched = patchFrontmatter(testFile, testEvent)
    expect(patched).toContain("title: Test Document")
    expect(patched).toContain("Some markdown here.")
  })
})
```

**Step 3: Run test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/patcher.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/patcher.ts
git add src/lib/regulatory-truth/content-sync/__tests__/patcher.test.ts
git commit -m "feat(rtl): add frontmatter patcher with changelog management"
```

---

### Task 10: Create Content Repo Adapter

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/repo-adapter.ts`

**Step 1: Write the adapter**

Create `src/lib/regulatory-truth/content-sync/repo-adapter.ts`:

```typescript
import { execSync } from "child_process"
import path from "path"
import { RepoWriteFailedError } from "./errors"

export interface ContentRepoAdapter {
  /**
   * Create a new branch for content changes
   */
  createBranch(branchName: string): void

  /**
   * Stage files for commit
   */
  stageFiles(files: string[]): void

  /**
   * Commit staged changes
   */
  commit(message: string): void

  /**
   * Push branch to remote
   */
  pushBranch(branchName: string): void

  /**
   * Create PR using GitHub CLI
   */
  createPR(params: {
    title: string
    body: string
    base?: string
  }): string // Returns PR URL

  /**
   * Get current branch name
   */
  getCurrentBranch(): string
}

/**
 * Git-based content repo adapter
 */
export class GitContentRepoAdapter implements ContentRepoAdapter {
  constructor(private repoRoot: string) {}

  private exec(command: string): string {
    try {
      return execSync(command, {
        cwd: this.repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new RepoWriteFailedError(message)
    }
  }

  createBranch(branchName: string): void {
    // Create and checkout new branch from main
    this.exec(`git checkout main`)
    this.exec(`git pull origin main`)
    this.exec(`git checkout -b ${branchName}`)
  }

  stageFiles(files: string[]): void {
    for (const file of files) {
      const relativePath = path.relative(this.repoRoot, file)
      this.exec(`git add "${relativePath}"`)
    }
  }

  commit(message: string): void {
    // Use heredoc for multiline commit message
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`)
  }

  pushBranch(branchName: string): void {
    this.exec(`git push -u origin ${branchName}`)
  }

  createPR(params: { title: string; body: string; base?: string }): string {
    const base = params.base || "main"
    const escapedTitle = params.title.replace(/"/g, '\\"')
    const escapedBody = params.body.replace(/"/g, '\\"')

    const result = this.exec(
      `gh pr create --title "${escapedTitle}" --body "${escapedBody}" --base ${base}`
    )

    // gh pr create returns the PR URL
    return result
  }

  getCurrentBranch(): string {
    return this.exec("git branch --show-current")
  }
}

/**
 * Generate branch name for content sync
 */
export function generateBranchName(eventId: string, conceptId: string): string {
  const shortId = eventId.slice(0, 8)
  const date = new Date().toISOString().split("T")[0]
  return `content-sync/${date}-${conceptId}-${shortId}`
}

/**
 * Generate PR title
 */
export function generatePRTitle(
  conceptId: string,
  changeType: "create" | "update" | "repeal"
): string {
  const verb =
    changeType === "create"
      ? "Add"
      : changeType === "repeal"
        ? "Remove"
        : "Update"
  return `docs: ${verb} ${conceptId} content from RTL`
}

/**
 * Generate PR body
 */
export function generatePRBody(params: {
  eventId: string
  conceptId: string
  ruleId: string
  changeType: string
  effectiveFrom: string
  sourcePointerIds: string[]
  primarySourceUrl?: string
  patchedFiles: string[]
}): string {
  const { eventId, conceptId, ruleId, changeType, effectiveFrom, sourcePointerIds, primarySourceUrl, patchedFiles } = params

  return `## RTL Content Sync

This PR was automatically generated by the RTL Content Sync system.

### Event Details
- **Event ID:** \`${eventId}\`
- **Concept:** \`${conceptId}\`
- **Rule ID:** \`${ruleId}\`
- **Change Type:** ${changeType}
- **Effective From:** ${effectiveFrom}

### Source Evidence
${sourcePointerIds.map((id) => `- \`${id}\``).join("\n")}
${primarySourceUrl ? `\n**Primary Source:** ${primarySourceUrl}` : ""}

### Files Changed
${patchedFiles.map((f) => `- \`${f}\``).join("\n")}

---
*This PR requires human review before merging.*

Generated by [RTL Content Sync](https://fiskai.hr)
`
}
```

**Step 2: Write test**

Create `src/lib/regulatory-truth/content-sync/__tests__/repo-adapter.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  generateBranchName,
  generatePRTitle,
  generatePRBody,
} from "../repo-adapter"

describe("generateBranchName", () => {
  it("creates valid branch name", () => {
    const branch = generateBranchName("abc123def456789", "pdv-threshold")

    expect(branch).toMatch(/^content-sync\/\d{4}-\d{2}-\d{2}-pdv-threshold-abc123de$/)
  })
})

describe("generatePRTitle", () => {
  it("generates Add for create", () => {
    const title = generatePRTitle("pdv-threshold", "create")
    expect(title).toBe("docs: Add pdv-threshold content from RTL")
  })

  it("generates Update for update", () => {
    const title = generatePRTitle("pdv-threshold", "update")
    expect(title).toBe("docs: Update pdv-threshold content from RTL")
  })

  it("generates Remove for repeal", () => {
    const title = generatePRTitle("pdv-threshold", "repeal")
    expect(title).toBe("docs: Remove pdv-threshold content from RTL")
  })
})

describe("generatePRBody", () => {
  it("generates complete PR body", () => {
    const body = generatePRBody({
      eventId: "abc123",
      conceptId: "pdv-threshold",
      ruleId: "rule_123",
      changeType: "update",
      effectiveFrom: "2026-01-01",
      sourcePointerIds: ["sptr_a", "sptr_b"],
      primarySourceUrl: "https://narodne-novine.nn.hr/123",
      patchedFiles: ["content/vodici/pausalni-obrt.mdx"],
    })

    expect(body).toContain("Event ID:** `abc123`")
    expect(body).toContain("pdv-threshold")
    expect(body).toContain("sptr_a")
    expect(body).toContain("https://narodne-novine.nn.hr/123")
    expect(body).toContain("pausalni-obrt.mdx")
  })
})
```

**Step 3: Run test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/repo-adapter.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/repo-adapter.ts
git add src/lib/regulatory-truth/content-sync/__tests__/repo-adapter.test.ts
git commit -m "feat(rtl): add content repo adapter for git operations"
```

---

### Task 11: Create Content Sync Worker

**Files:**
- Create: `src/lib/regulatory-truth/workers/content-sync.worker.ts`

**Step 1: Write the worker**

Create `src/lib/regulatory-truth/workers/content-sync.worker.ts`:

```typescript
import { Job } from "bullmq"
import { eq, inArray, sql } from "drizzle-orm"
import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import type { ContentSyncEvent, ContentSyncStatus, DeadLetterReason } from "@/lib/db/schema/content-sync"
import { createWorker } from "./base"
import { queues } from "./queues"
import { getConceptMapping, resolveContentPaths } from "../content-sync/concept-registry"
import { patchFrontmatter, writeMdxFile } from "../content-sync/patcher"
import {
  GitContentRepoAdapter,
  generateBranchName,
  generatePRTitle,
  generatePRBody,
} from "../content-sync/repo-adapter"
import { classifyError, UnmappedConceptError, PatchConflictError } from "../content-sync/errors"
import type { ContentSyncEventV1 } from "../content-sync/types"
import path from "path"

// BullMQ job data
interface ContentSyncJobData {
  eventId: string
}

// Retry configuration (8 attempts, exponential backoff)
const JOB_OPTIONS = {
  attempts: 8,
  backoff: {
    type: "exponential" as const,
    delay: 30000, // 30s initial, max ~30min
  },
}

// Content directory (relative to repo root)
const CONTENT_DIR = path.join(process.cwd(), "content")
const REPO_ROOT = process.cwd()

/**
 * Claim an event for processing using atomic UPDATE.
 * Returns null if event cannot be claimed.
 */
async function claimEvent(eventId: string): Promise<ContentSyncEvent | null> {
  const claimableStatuses: ContentSyncStatus[] = ["PENDING", "ENQUEUED", "FAILED"]

  const result = await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "PROCESSING",
      attempts: sql`${contentSyncEvents.attempts} + 1`,
      lastAttemptAt: new Date(),
    })
    .where(
      sql`${contentSyncEvents.eventId} = ${eventId}
          AND ${contentSyncEvents.status} = ANY(${claimableStatuses})`
    )
    .returning()

  return result[0] || null
}

/**
 * Mark event as completed
 */
async function markDone(eventId: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "DONE",
      processedAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark event as failed (for retry)
 */
async function markFailed(eventId: string, error: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "FAILED",
      lastError: error,
      lastErrorAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark event as dead-lettered (permanent failure)
 */
async function markDeadLettered(
  eventId: string,
  reason: DeadLetterReason,
  note: string
): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "DEAD_LETTERED",
      deadLetterReason: reason,
      deadLetterNote: note,
      lastError: note,
      lastErrorAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark event as skipped (e.g., already processed)
 */
async function markSkipped(eventId: string, note: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "SKIPPED",
      deadLetterNote: note,
      processedAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Process a content sync job
 */
async function processContentSyncJob(job: Job<ContentSyncJobData>) {
  const { eventId } = job.data

  // Transaction A: Claim event
  const event = await claimEvent(eventId)
  if (!event) {
    // Already processed or claimed by another worker
    console.log(`[content-sync] Event ${eventId} already claimed or processed`)
    return { success: true, skipped: true }
  }

  const payload = event.payload as ContentSyncEventV1

  try {
    // Look up concept mapping
    const mapping = getConceptMapping(event.conceptId)
    if (!mapping) {
      throw new UnmappedConceptError(event.conceptId)
    }

    // Resolve content paths
    const contentPaths = resolveContentPaths(mapping, CONTENT_DIR)
    const patchedFiles: string[] = []
    const skippedFiles: string[] = []

    // Transaction B: Patch files (file system operations)
    const repoAdapter = new GitContentRepoAdapter(REPO_ROOT)
    const branchName = generateBranchName(eventId, event.conceptId)

    // Create branch for changes
    repoAdapter.createBranch(branchName)

    for (const filePath of contentPaths) {
      try {
        const patchedContent = patchFrontmatter(filePath, payload)
        writeMdxFile(filePath, patchedContent)
        patchedFiles.push(filePath)
      } catch (err) {
        if (err instanceof PatchConflictError) {
          // Already has this eventId - skip
          console.log(`[content-sync] Skipping ${filePath}: ${err.message}`)
          skippedFiles.push(filePath)
        } else {
          throw err
        }
      }
    }

    // If no files were patched, skip
    if (patchedFiles.length === 0) {
      await markSkipped(eventId, `All ${contentPaths.length} files already had eventId`)
      return { success: true, skipped: true }
    }

    // Stage and commit
    repoAdapter.stageFiles(patchedFiles)
    repoAdapter.commit(
      `docs: sync ${event.conceptId} from RTL event ${eventId.slice(0, 8)}`
    )

    // Push branch
    repoAdapter.pushBranch(branchName)

    // Create PR
    const prUrl = repoAdapter.createPR({
      title: generatePRTitle(event.conceptId, payload.changeType),
      body: generatePRBody({
        eventId,
        conceptId: event.conceptId,
        ruleId: event.ruleId,
        changeType: payload.changeType,
        effectiveFrom: payload.effectiveFrom,
        sourcePointerIds: payload.sourcePointerIds,
        primarySourceUrl: payload.primarySourceUrl,
        patchedFiles: patchedFiles.map((p) => path.relative(REPO_ROOT, p)),
      }),
    })

    console.log(`[content-sync] Created PR: ${prUrl}`)

    // Transaction C: Mark done
    await markDone(eventId)

    return {
      success: true,
      prUrl,
      patchedFiles: patchedFiles.length,
      skippedFiles: skippedFiles.length,
    }
  } catch (err) {
    const classification = classifyError(err)

    if (classification.kind === "PERMANENT") {
      // Dead-letter immediately
      await markDeadLettered(
        eventId,
        classification.deadLetterReason || "UNKNOWN",
        classification.message
      )
      console.error(`[content-sync] Dead-lettered ${eventId}: ${classification.message}`)
      return { success: false, deadLettered: true, error: classification.message }
    } else {
      // Mark failed for retry
      await markFailed(eventId, classification.message)
      console.error(`[content-sync] Failed ${eventId} (will retry): ${classification.message}`)
      throw err // Re-throw for BullMQ retry
    }
  }
}

// Create the worker
const worker = createWorker<ContentSyncJobData>("content-sync", processContentSyncJob, {
  name: "content-sync",
  concurrency: 1, // One at a time to avoid git conflicts
  lockDuration: 300000, // 5 minutes
  stalledInterval: 60000,
})

export { worker as contentSyncWorker }

/**
 * Enqueue a content sync job
 */
export async function enqueueContentSyncJob(eventId: string): Promise<void> {
  await queues.contentSync.add(
    "sync",
    { eventId },
    {
      ...JOB_OPTIONS,
      jobId: eventId, // Dedup by eventId
    }
  )

  // Update status to ENQUEUED
  await drizzleDb
    .update(contentSyncEvents)
    .set({ status: "ENQUEUED" })
    .where(eq(contentSyncEvents.eventId, eventId))
}
```

**Step 2: Update index export**

Add to `src/lib/regulatory-truth/content-sync/index.ts`:

```typescript
export * from "./errors"
export * from "./concept-registry"
export * from "./patcher"
export * from "./repo-adapter"
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/workers/content-sync.worker.ts
git add src/lib/regulatory-truth/content-sync/index.ts
git commit -m "feat(rtl): add content sync BullMQ worker with PR creation"
```

---

### Task 12: Create Queue Drain Script for Content Sync

**Files:**
- Create: `scripts/drain-content-sync.ts`

**Step 1: Write the drain script**

Create `scripts/drain-content-sync.ts`:

```typescript
#!/usr/bin/env npx tsx

import { eq } from "drizzle-orm"
import { drizzleDb } from "../src/lib/db/drizzle"
import { contentSyncEvents } from "../src/lib/db/schema/content-sync"
import { enqueueContentSyncJob } from "../src/lib/regulatory-truth/workers/content-sync.worker"

async function drainPendingEvents() {
  console.log("Draining pending content sync events...\n")

  // Find all PENDING events
  const pending = await drizzleDb
    .select()
    .from(contentSyncEvents)
    .where(eq(contentSyncEvents.status, "PENDING"))
    .orderBy(contentSyncEvents.createdAt)

  console.log(`Found ${pending.length} pending events\n`)

  for (const event of pending) {
    console.log(`Enqueueing: ${event.eventId} (${event.conceptId})`)
    await enqueueContentSyncJob(event.eventId)
  }

  console.log("\nDone!")
}

drainPendingEvents().catch(console.error)
```

**Step 2: Run to verify**

Run: `npx tsx scripts/drain-content-sync.ts`
Expected: Lists pending events (or "Found 0 pending events" if none exist)

**Step 3: Commit**

```bash
git add scripts/drain-content-sync.ts
git commit -m "feat(rtl): add content sync queue drain script"
```

---

### Task 13: Update Frontmatter Validation

**Files:**
- Modify: `src/lib/knowledge-hub/validate-frontmatter.ts`
- Modify: `scripts/validate-content.ts`

**Step 1: Add RTL frontmatter validation**

Update `src/lib/knowledge-hub/validate-frontmatter.ts`:

```typescript
// Add new interfaces
export interface RtlFrontmatter {
  conceptId: string
  ruleId: string
}

export interface ChangelogEntry {
  eventId: string
  date: string
  severity: "breaking" | "critical" | "major" | "info"
  changeType?: "create" | "update" | "repeal"
  summary?: string
  affectedSections?: string[]
  effectiveFrom?: string
  sourcePointerIds?: string[]
  primarySourceUrl?: string
  confidenceLevel?: number
}

// Add RTL validation
export function validateRtlFrontmatter(rtl: unknown): ValidationResult {
  const errors: string[] = []

  if (!rtl || typeof rtl !== "object") {
    return { valid: true, errors: [] } // RTL is optional
  }

  const { conceptId, ruleId } = rtl as Record<string, unknown>

  if (conceptId && typeof conceptId !== "string") {
    errors.push("rtl.conceptId must be a string")
  }

  if (ruleId && typeof ruleId !== "string") {
    errors.push("rtl.ruleId must be a string")
  }

  // If one is set, both should be set
  if ((conceptId && !ruleId) || (!conceptId && ruleId)) {
    errors.push("rtl.conceptId and rtl.ruleId must both be set or both be unset")
  }

  return { valid: errors.length === 0, errors }
}

// Update existing validateChangelog to handle new fields
export function validateChangelog(changelog: ChangelogEntry[]): ValidationResult {
  const errors: string[] = []

  // Existing validation...

  // Add eventId uniqueness check
  const eventIds = changelog
    .filter((e) => e.eventId)
    .map((e) => e.eventId)
  const uniqueEventIds = new Set(eventIds)
  if (eventIds.length !== uniqueEventIds.size) {
    errors.push("Changelog contains duplicate eventIds")
  }

  // Validate sourcePointerIds if present
  for (const entry of changelog) {
    if (entry.sourcePointerIds && !Array.isArray(entry.sourcePointerIds)) {
      errors.push(`Changelog entry ${entry.eventId || entry.date}: sourcePointerIds must be an array`)
    }
    if (entry.confidenceLevel !== undefined) {
      if (typeof entry.confidenceLevel !== "number" || entry.confidenceLevel < 0 || entry.confidenceLevel > 100) {
        errors.push(`Changelog entry ${entry.eventId || entry.date}: confidenceLevel must be 0-100`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
```

**Step 2: Update validate-content.ts**

Add RTL validation to `scripts/validate-content.ts`:

```typescript
import { validateRtlFrontmatter } from "../src/lib/knowledge-hub/validate-frontmatter"

// In the validation loop, add:
if (data.rtl) {
  const rtlResult = validateRtlFrontmatter(data.rtl)
  if (!rtlResult.valid) {
    for (const err of rtlResult.errors) {
      errors.push(`${file}: ${err}`)
    }
  }
}
```

**Step 3: Run validation**

Run: `npx tsx scripts/validate-content.ts`
Expected: PASS (or shows validation errors to fix)

**Step 4: Commit**

```bash
git add src/lib/knowledge-hub/validate-frontmatter.ts scripts/validate-content.ts
git commit -m "feat(rtl): update frontmatter validation for RTL fields"
```

---

### Task 14: Add Worker to Docker Compose

**Files:**
- Modify: `docker-compose.workers.yml`

**Step 1: Add content-sync worker service**

Add to `docker-compose.workers.yml`:

```yaml
  worker-content-sync:
    build:
      context: .
      dockerfile: Dockerfile.workers
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - WORKER_TYPE=content-sync
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
```

**Step 2: Verify compose file**

Run: `docker compose -f docker-compose.workers.yml config`
Expected: Valid YAML, no errors

**Step 3: Commit**

```bash
git add docker-compose.workers.yml
git commit -m "feat(rtl): add content-sync worker to docker compose"
```

---

### Task 15: Create Integration Test

**Files:**
- Create: `src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts`

**Step 1: Write integration test**

Create `src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import { emitContentSyncEvent } from "../emit-event"
import { getConceptMapping } from "../concept-registry"
import { patchFrontmatter } from "../patcher"
import { generateEventId, hashSourcePointerIds } from "../event-id"
import { eq } from "drizzle-orm"

describe("RTL Content Sync Integration", () => {
  const testRuleId = `test-rule-${Date.now()}`

  afterEach(async () => {
    // Cleanup test events
    await drizzleDb
      .delete(contentSyncEvents)
      .where(eq(contentSyncEvents.ruleId, testRuleId))
  })

  it("emits event with correct ID generation", async () => {
    const result = await emitContentSyncEvent({
      type: "RULE_RELEASED",
      ruleId: testRuleId,
      conceptId: "pdv-threshold",
      domain: "tax",
      effectiveFrom: new Date("2026-01-01"),
      changeType: "update",
      ruleTier: "T1",
      sourcePointerIds: ["sptr_test_1", "sptr_test_2"],
      confidenceLevel: 92,
      newValue: "65000",
      valueType: "currency",
    })

    // Verify event was created
    expect(result.isNew).toBe(true)
    expect(result.eventId).toHaveLength(64)

    // Verify in database
    const [event] = await drizzleDb
      .select()
      .from(contentSyncEvents)
      .where(eq(contentSyncEvents.eventId, result.eventId))

    expect(event.status).toBe("PENDING")
    expect(event.conceptId).toBe("pdv-threshold")

    const payload = event.payload as { severity: string; sourcePointerIds: string[] }
    expect(payload.severity).toBe("major") // T1 = major
    expect(payload.sourcePointerIds).toHaveLength(2)
  })

  it("concept registry maps to valid MDX files", () => {
    const mapping = getConceptMapping("pdv-threshold")
    expect(mapping).toBeDefined()
    expect(mapping!.mdxPaths.length).toBeGreaterThan(0)

    // At least one path should exist
    const contentDir = path.join(process.cwd(), "content")
    const existingPaths = mapping!.mdxPaths.filter((p) =>
      fs.existsSync(path.join(contentDir, p))
    )
    expect(existingPaths.length).toBeGreaterThan(0)
  })

  it("patcher creates valid frontmatter with changelog", () => {
    // Create temp file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rtl-test-"))
    const testFile = path.join(tempDir, "test.mdx")

    fs.writeFileSync(
      testFile,
      `---
title: Test
lastUpdated: 2025-01-01
---

Content here.
`
    )

    const event = {
      version: 1 as const,
      id: "test123",
      timestamp: new Date().toISOString(),
      type: "RULE_RELEASED" as const,
      ruleId: testRuleId,
      conceptId: "pdv-threshold",
      domain: "tax" as const,
      changeType: "update" as const,
      effectiveFrom: "2026-01-01",
      previousValue: "60000",
      newValue: "65000",
      valueType: "currency" as const,
      sourcePointerIds: ["sptr_1"],
      confidenceLevel: 92,
      severity: "major" as const,
      signature: {
        ruleId: testRuleId,
        conceptId: "pdv-threshold",
        type: "RULE_RELEASED" as const,
        effectiveFrom: "2026-01-01",
        newValue: "65000",
        sourcePointerIdsHash: hashSourcePointerIds(["sptr_1"]),
      },
    }

    const patched = patchFrontmatter(testFile, event)

    expect(patched).toContain("rtl:")
    expect(patched).toContain("conceptId: pdv-threshold")
    expect(patched).toContain("changelog:")
    expect(patched).toContain("eventId: test123")
    expect(patched).toContain("Content here.")

    // Cleanup
    fs.rmSync(tempDir, { recursive: true })
  })
})
```

**Step 2: Run integration test**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts
git commit -m "test(rtl): add content sync integration tests"
```

---

## Final Verification

### Task 16: Run Full Test Suite

**Step 1: Run all content-sync tests**

Run: `npx vitest run src/lib/regulatory-truth/content-sync/`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run type check**

Run: `npm run type-check` or `npx tsc --noEmit`
Expected: No type errors

**Step 4: Validate concept registry**

Run: `npx tsx scripts/validate-concept-registry.ts`
Expected: "Concept registry is valid!"

**Step 5: Validate content**

Run: `npx tsx scripts/validate-content.ts`
Expected: No validation errors

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(rtl): complete RTL → Content sync implementation"
```

**Step 7: Push and create PR**

```bash
git push -u origin feature/rtl-content-sync
gh pr create --title "feat: RTL → Content Sync Control Plane" --body "$(cat <<'EOF'
## Summary

Implements the RTL → Content sync control plane that automatically projects regulatory rule changes into MDX content files.

### Features
- Drizzle schema for `content_sync_events` with idempotent event storage
- Deterministic event ID generation via sha256(signature)
- Concept registry mapping 20 core regulatory concepts to MDX files
- Frontmatter patcher that updates lastUpdated, rtl section, and changelog
- BullMQ worker with error classification (PERMANENT → dead-letter, TRANSIENT → retry)
- Automatic PR creation for human review (never auto-merge)

### Architecture
```
Releaser → emitContentSyncEvent() → content_sync_events table
                                           ↓
                              BullMQ content-sync queue
                                           ↓
                              ContentSyncWorker claims event
                                           ↓
                              Concept Registry → MDX paths
                                           ↓
                              Patcher updates frontmatter
                                           ↓
                              Git commit → Push → PR
```

### Testing
- Unit tests for event ID, patcher, errors, repo adapter
- Integration tests for end-to-end flow
- Validation scripts for concept registry and content

## Test Plan
- [ ] Run `npx vitest run src/lib/regulatory-truth/content-sync/`
- [ ] Run `npx tsx scripts/validate-concept-registry.ts`
- [ ] Run `npx tsx scripts/validate-content.ts`
- [ ] Verify Drizzle migration applies cleanly
- [ ] Test manual event emission with `npx tsx` script

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

This plan implements the RTL → Content sync control plane in 3 phases:

**Phase 1 (Tasks 1-5):** Event infrastructure
- Drizzle schema for content_sync_events
- Event ID generation with deterministic signatures
- Event emitter with idempotency
- Releaser integration
- BullMQ queue setup

**Phase 2 (Tasks 6-7):** Concept registry
- 20 core concept mappings
- Validation script

**Phase 3 (Tasks 8-16):** MDX patching worker
- Error classes with classification
- Frontmatter patcher
- Git repo adapter
- BullMQ worker with PR creation
- Integration tests
- Docker compose update
