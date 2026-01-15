# APPENDIX: Content-Sync Worker Audit

> **Document Version:** 1.0
> **Last Updated:** 2026-01-14
> **Status:** Comprehensive Stakeholder Audit
> **Worker Type:** content-sync
> **Container Name:** fiskai-worker-content-sync

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Overview and Purpose](#overview-and-purpose)
3. [Architecture Position](#architecture-position)
4. [Content Being Synced](#content-being-synced)
5. [GitHub Integration Details](#github-integration-details)
6. [Input Triggers](#input-triggers)
7. [Output Artifacts](#output-artifacts)
8. [Dependencies](#dependencies)
9. [Configuration](#configuration)
10. [Processing Flow](#processing-flow)
11. [Error Handling and Recovery](#error-handling-and-recovery)
12. [Volume Mounts and File Access](#volume-mounts-and-file-access)
13. [Database Schema](#database-schema)
14. [Concept Registry](#concept-registry)
15. [Test Coverage](#test-coverage)
16. [Known Limitations](#known-limitations)
17. [Security Considerations](#security-considerations)
18. [Monitoring and Observability](#monitoring-and-observability)
19. [Recommended Improvements](#recommended-improvements)
20. [Appendix: Code References](#appendix-code-references)

---

## Executive Summary

The **content-sync worker** is a critical component of FiskAI's Regulatory Truth Layer (RTL) that bridges the gap between regulatory rule changes and user-facing content. When regulatory rules are released or updated in the RTL, this worker automatically propagates those changes to MDX content files, creating GitHub pull requests for human review before publication.

**Key Characteristics:**

- **Concurrency:** Single-threaded (1 job at a time) to prevent git conflicts
- **Retry Strategy:** 8 attempts with exponential backoff (30s initial, ~30min max)
- **Error Classification:** PERMANENT errors dead-letter immediately; TRANSIENT errors retry
- **Human-in-the-Loop:** All changes require PR approval before merging
- **Idempotency:** Deterministic event IDs prevent duplicate processing

---

## Overview and Purpose

### What It Does

The content-sync worker synchronizes regulatory changes from the Regulatory Truth Layer (RTL) database to the content management system (MDX guides). When a regulatory rule is released, updated, or superseded, this worker:

1. Claims pending sync events from the database (atomic UPDATE)
2. Looks up concept mapping to find target MDX files
3. Patches frontmatter with changelog entries and RTL metadata
4. Creates a git branch, commits changes, and pushes to remote
5. Creates a GitHub Pull Request for human review
6. Marks the event as DONE on success

### Why It Exists

Croatian regulatory content must be:

- **Accurate:** Reflect current law at all times
- **Traceable:** Every change links back to authoritative sources
- **Auditable:** Complete history of when/why content changed
- **Reviewable:** Human oversight before publication

The worker ensures that when the RTL detects a regulatory change (e.g., PDV threshold update from 300,000 HRK to 39,816.84 EUR), all relevant content guides are updated with:

- The new value
- Effective date
- Source evidence (pointers to official documents)
- Confidence level

---

## Architecture Position

```
+------------------+     +-------------------+     +------------------+
|   RTL Pipeline   |     |  Content-Sync     |     |    GitHub        |
|                  |     |     Worker        |     |   Repository     |
|  Releaser Agent  |---->|                   |---->|                  |
|  (emits event)   |     | - Claims events   |     | - Creates branch |
|                  |     | - Patches MDX     |     | - Commits files  |
+------------------+     | - Creates PR      |     | - Opens PR       |
                         +-------------------+     +------------------+
                                  |
                                  v
                         +-------------------+
                         |   PostgreSQL      |
                         | content_sync_     |
                         |    events table   |
                         +-------------------+
```

### Position in RTL Pipeline

The content-sync worker operates in **Layer B (24/7 Processing)** of the RTL:

| Stage              | Worker           | Upstream  | Downstream       |
| ------------------ | ---------------- | --------- | ---------------- |
| Discovery          | Sentinel         | -         | Extractor        |
| Extraction         | Extractor        | Sentinel  | Composer         |
| Composition        | Composer         | Extractor | Reviewer         |
| Review             | Reviewer         | Composer  | Releaser         |
| Release            | Releaser         | Reviewer  | **Content-Sync** |
| **Content Update** | **Content-Sync** | Releaser  | GitHub PR        |

---

## Content Being Synced

### MDX File Types

The worker updates MDX files in the `/content/` directory:

| Directory    | Content Type                | Example Files                                    |
| ------------ | --------------------------- | ------------------------------------------------ |
| `vodici/`    | Comprehensive guides        | `pausalni-obrt.mdx`, `freelancer.mdx`, `doo.mdx` |
| `rjecnik/`   | Glossary/dictionary entries | `pdv.mdx`, `pausal.mdx`, `mio.mdx`               |
| `kako-da/`   | How-to tutorials            | `uci-u-sustav-pdv.mdx`, `ispuniti-po-sd.mdx`     |
| `usporedbe/` | Comparison articles         | `pocinjem-solo.mdx`, `preko-praga.mdx`           |
| `hubovi/`    | Hub pages                   | `fiskalizacija.mdx`                              |

### Frontmatter Changes

The worker patches MDX frontmatter with:

```yaml
---
title: "Existing Title"
description: "Existing description"
lastUpdated: "2026-01-14" # Updated to today's date
rtl:
  conceptId: "pdv-threshold"
  ruleId: "rule_abc123"
changelog:
  - eventId: "evt_sha256hash..."
    date: "2026-01-14"
    severity: "major"
    changeType: "update"
    summary: "Updated from 300000.00 HRK to 39816.84 EUR."
    effectiveFrom: "2026-01-01"
    sourcePointerIds:
      - "ptr_nn_2025_123"
      - "ptr_pu_2025_456"
    primarySourceUrl: "https://narodne-novine.nn.hr/..."
    confidenceLevel: 95
---
```

### Changelog Entry Fields

| Field              | Type       | Description                                |
| ------------------ | ---------- | ------------------------------------------ |
| `eventId`          | string     | Deterministic SHA-256 hash for idempotency |
| `date`             | YYYY-MM-DD | Date the change was recorded               |
| `severity`         | enum       | `breaking`, `major`, `minor`, `info`       |
| `changeType`       | enum       | `create`, `update`, `repeal`               |
| `summary`          | string     | Human-readable description                 |
| `effectiveFrom`    | YYYY-MM-DD | When the regulatory change takes effect    |
| `sourcePointerIds` | string[]   | IDs linking to Evidence records            |
| `primarySourceUrl` | string?    | URL to authoritative source                |
| `confidenceLevel`  | number     | 0-100 confidence score                     |

---

## GitHub Integration Details

### Git Operations

The worker uses the `GitContentRepoAdapter` class which executes git CLI commands:

| Operation     | Command                                                           | Purpose            |
| ------------- | ----------------------------------------------------------------- | ------------------ |
| Create Branch | `git checkout -b "content-sync/YYYY-MM-DD-{conceptId}-{shortId}"` | Isolate changes    |
| Stage Files   | `git add "path/to/file.mdx"`                                      | Prepare for commit |
| Commit        | `git commit -m "docs: sync {conceptId} from RTL event {shortId}"` | Record changes     |
| Push          | `git push -u origin "{branchName}"`                               | Upload to remote   |
| Create PR     | `gh pr create --base "main" --title "..." --body "..."`           | Request review     |

### Branch Naming Convention

```
content-sync/{YYYY-MM-DD}-{conceptId}-{eventIdShort}

Example: content-sync/2026-01-14-pdv-threshold-evt_abc1
```

### Pull Request Format

**Title:**

```
docs: Update pdv-threshold content from RTL
```

**Body:**

```markdown
## RTL Content Sync

This PR was automatically generated by the Regulatory Truth Layer content sync pipeline.

### Event Details

| Field          | Value               |
| -------------- | ------------------- |
| Event ID       | `evt_sha256hash...` |
| Concept        | `pdv-threshold`     |
| Rule ID        | `rule_abc123`       |
| Change Type    | update              |
| Effective From | 2026-01-01          |

### Source Pointers

Evidence trail for this change:

- `ptr_nn_2025_123`
- `ptr_pu_2025_456`

### Primary Source

[https://narodne-novine.nn.hr/...](https://narodne-novine.nn.hr/...)

### Patched Files

- `vodici/pausalni-obrt.mdx`
- `rjecnik/pdv.mdx`

---

> **Note:** This PR requires human review before merging.
> Please verify that the content changes accurately reflect the regulatory update.
```

### GitHub CLI Dependency

The worker requires the `gh` CLI to be installed and authenticated in the container. Authentication is provided via the `GITHUB_TOKEN` environment variable.

---

## Input Triggers

### Event Types

The worker processes events from the `content_sync_events` table with these types:

| Event Type           | Description                          | Trigger Source    |
| -------------------- | ------------------------------------ | ----------------- |
| `RULE_RELEASED`      | New rule published to production     | Releaser Agent    |
| `RULE_SUPERSEDED`    | Rule replaced by newer version       | Releaser Agent    |
| `RULE_EFFECTIVE`     | Rule becomes legally effective       | Scheduler         |
| `SOURCE_CHANGED`     | Underlying evidence updated          | Evidence pipeline |
| `POINTERS_CHANGED`   | Source pointer references changed    | Arbiter Agent     |
| `CONFIDENCE_DROPPED` | Rule confidence fell below threshold | Review pipeline   |

### Claimable Statuses

The worker claims events in these statuses:

| Status     | Description                              |
| ---------- | ---------------------------------------- |
| `PENDING`  | Newly created, not yet processed         |
| `ENQUEUED` | Added to BullMQ queue                    |
| `FAILED`   | Previous attempt failed, ready for retry |

### BullMQ Queue Configuration

```typescript
const contentSyncQueue = createQueue("content-sync", {
  max: 2, // Max 2 jobs per minute
  duration: 60000, // Rate limit window
})
```

### Job Enqueuing

Events are enqueued via `enqueueContentSyncJob(eventId)`:

```typescript
await contentSyncQueue.add(
  "sync",
  { eventId },
  {
    attempts: 8,
    backoff: {
      type: "exponential",
      delay: 30000, // 30s initial
    },
    jobId: eventId, // Deduplication
  }
)
```

---

## Output Artifacts

### Files Created/Modified

| Output       | Location            | Description                        |
| ------------ | ------------------- | ---------------------------------- |
| MDX Files    | `/content/**/*.mdx` | Frontmatter patched with changelog |
| Git Branch   | Remote repository   | Feature branch with changes        |
| Pull Request | GitHub              | Human-reviewable change request    |

### Database Updates

| Column             | Update Condition     | Value             |
| ------------------ | -------------------- | ----------------- |
| `status`           | On success           | `DONE`            |
| `status`           | On skip (idempotent) | `SKIPPED`         |
| `status`           | On permanent failure | `DEAD_LETTERED`   |
| `status`           | On transient failure | `FAILED`          |
| `processedAt`      | On completion        | Current timestamp |
| `prUrl`            | On PR creation       | GitHub PR URL     |
| `prCreatedAt`      | On PR creation       | Current timestamp |
| `attempts`         | On each attempt      | Incremented       |
| `lastAttemptAt`    | On each attempt      | Current timestamp |
| `lastError`        | On failure           | Error message     |
| `deadLetterReason` | On permanent failure | Enum value        |

---

## Dependencies

### External Services

| Dependency | Purpose                            | Required |
| ---------- | ---------------------------------- | -------- |
| PostgreSQL | Event storage and state management | Yes      |
| Redis      | BullMQ job queue                   | Yes      |
| GitHub API | Pull request creation              | Yes      |
| Git CLI    | Branch, commit, push operations    | Yes      |
| `gh` CLI   | GitHub PR creation                 | Yes      |

### Internal Dependencies

| Module                         | Purpose                           |
| ------------------------------ | --------------------------------- |
| `@/lib/db/drizzle`             | Database connection               |
| `@/lib/db/schema/content-sync` | Table schema and types            |
| `gray-matter`                  | Frontmatter parsing/serialization |
| `bullmq`                       | Job queue management              |

### NPM Packages

| Package       | Version | Purpose             |
| ------------- | ------- | ------------------- |
| `bullmq`      | ^5.x    | Job queue           |
| `drizzle-orm` | ^0.30.x | Database ORM        |
| `gray-matter` | ^4.x    | Frontmatter parsing |

---

## Configuration

### Environment Variables

| Variable                  | Required | Default         | Description                              |
| ------------------------- | -------- | --------------- | ---------------------------------------- |
| `DATABASE_URL`            | Yes      | -               | PostgreSQL connection string             |
| `REGULATORY_DATABASE_URL` | Yes      | -               | Regulatory DB connection                 |
| `REDIS_URL`               | Yes      | -               | Redis connection for BullMQ              |
| `GITHUB_TOKEN`            | Yes      | -               | GitHub PAT for API access                |
| `REPO_ROOT`               | No       | `process.cwd()` | Root of git repository                   |
| `CONTENT_DIR`             | No       | `"content"`     | Content directory (relative or absolute) |
| `WORKER_TYPE`             | Yes      | -               | Must be `"content-sync"`                 |
| `WORKER_CONCURRENCY`      | No       | `1`             | Jobs processed concurrently              |

### Path Resolution Logic

```typescript
// REPO_ROOT: defaults to cwd, or explicit path
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd()

// CONTENT_DIR: if absolute, use directly; if relative, join with REPO_ROOT
const CONTENT_DIR = path.isAbsolute(process.env.CONTENT_DIR ?? "")
  ? process.env.CONTENT_DIR!
  : path.join(REPO_ROOT, process.env.CONTENT_DIR ?? "content")
```

### Worker Configuration

```typescript
{
  name: "content-sync",
  concurrency: 1,           // One at a time (git safety)
  lockDuration: 300000,     // 5 minutes (long git ops)
  stalledInterval: 60000,   // 1 minute stall detection
}
```

### Job Configuration

```typescript
{
  attempts: 8,              // Total attempts
  backoff: {
    type: "exponential",
    delay: 30000,           // 30s, 60s, 120s, 240s, 480s, 960s, 1920s
  },
}
```

---

## Processing Flow

### High-Level Flow

```
1. Job Received from BullMQ
         |
         v
2. Claim Event (Atomic UPDATE)
         |
    +----+----+
    |         |
    v         v
 Claimed   Already Claimed
    |         |
    |         v
    |      Return (skipped)
    v
3. Validate Payload
         |
    +----+----+
    |         |
    v         v
  Valid    Invalid
    |         |
    |         v
    |    Dead Letter
    v
4. Look Up Concept Mapping
         |
    +----+----+
    |         |
    v         v
  Found   Not Found
    |         |
    |         v
    |    Dead Letter (UNMAPPED_CONCEPT)
    v
5. Create Git Branch
         |
         v
6. For Each MDX File:
    a. Patch Frontmatter
    b. Write File
         |
    +----+----+
    |         |
    v         v
 Patched  Conflict (eventId exists)
    |         |
    |         v
    |      Skip File
    v
7. Check Patched Count
         |
    +----+----+
    |         |
    v         v
   >0        0
    |         |
    |         v
    |    Mark SKIPPED
    v
8. Stage & Commit
         |
         v
9. Push Branch
         |
         v
10. Create PR
         |
         v
11. Mark DONE with PR URL
```

### Detailed Processing Steps

#### Step 1: Event Claiming

```typescript
async function claimEvent(eventId: string): Promise<ContentSyncEvent | null> {
  const claimableStatuses = ["PENDING", "ENQUEUED", "FAILED"]

  const result = await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "PROCESSING",
      attempts: sql`${contentSyncEvents.attempts} + 1`,
      lastAttemptAt: new Date(),
    })
    .where(sql`event_id = ${eventId} AND status IN (${claimableStatuses})`)
    .returning()

  return result[0] ?? null
}
```

**Key Points:**

- Atomic UPDATE prevents race conditions
- Only claims events in claimable statuses
- Returns null if already claimed by another worker

#### Step 2: Payload Validation

```typescript
if (!isContentSyncEventV1(event.payload)) {
  await markDeadLettered(eventId, "INVALID_PAYLOAD", "Payload does not match schema")
  return { success: false, error: "Invalid payload" }
}
```

#### Step 3: Concept Mapping Lookup

```typescript
const mapping = getConceptMapping(event.conceptId)
if (!mapping) {
  throw new UnmappedConceptError(event.conceptId) // PERMANENT error
}
```

#### Step 4: File Patching

```typescript
for (const filePath of contentPaths) {
  try {
    const patchedContent = await patchFrontmatter(filePath, payload)
    await writeMdxFile(filePath, patchedContent)
    patchedFiles.push(filePath)
  } catch (err) {
    if (err instanceof PatchConflictError) {
      // Already has this eventId - skip but continue
      skippedFiles.push(filePath)
    } else {
      throw err
    }
  }
}
```

#### Step 5: Git Operations

```typescript
repoAdapter.stageFiles(patchedFiles)
repoAdapter.commit(`docs: sync ${conceptId} from RTL event ${eventId.slice(0, 8)}`)
repoAdapter.pushBranch(branchName)
const prUrl = repoAdapter.createPR({ title, body })
```

---

## Error Handling and Recovery

### Error Classification System

The worker classifies errors into two categories:

| Category      | Behavior                | Examples                                         |
| ------------- | ----------------------- | ------------------------------------------------ |
| **PERMANENT** | Dead-letter immediately | Invalid payload, unmapped concept, missing files |
| **TRANSIENT** | Retry with backoff      | Network errors, git conflicts, API rate limits   |

### PERMANENT Errors (Dead Letter)

| Error Class             | Dead Letter Reason        | Cause                        |
| ----------------------- | ------------------------- | ---------------------------- |
| `UnmappedConceptError`  | `UNMAPPED_CONCEPT`        | conceptId not in registry    |
| `InvalidPayloadError`   | `INVALID_PAYLOAD`         | Payload validation failed    |
| `MissingPointersError`  | `MISSING_POINTERS`        | No sourcePointerIds          |
| `ContentNotFoundError`  | `CONTENT_NOT_FOUND`       | MDX file doesn't exist       |
| `FrontmatterParseError` | `FRONTMATTER_PARSE_ERROR` | gray-matter parse failure    |
| `PatchConflictError`    | `PATCH_CONFLICT`          | eventId already in changelog |

### TRANSIENT Errors (Retry)

| Error Class            | Cause                     | Recovery        |
| ---------------------- | ------------------------- | --------------- |
| `RepoWriteFailedError` | Git operation failed      | Automatic retry |
| `DbWriteFailedError`   | Database operation failed | Automatic retry |
| Unknown errors         | Unexpected exceptions     | Automatic retry |

### Retry Strategy

```
Attempt 1: Immediate
Attempt 2: 30 seconds
Attempt 3: 60 seconds
Attempt 4: 120 seconds
Attempt 5: 240 seconds
Attempt 6: 480 seconds
Attempt 7: 960 seconds
Attempt 8: 1920 seconds (~32 minutes)
```

### Git State Cleanup on Failure

```typescript
try {
  repoAdapter.cleanup(branchName)
  // Resets working tree, returns to main, deletes feature branch
} catch (cleanupErr) {
  // Log but continue with retry
}
```

### Dead Letter Queue

When all retries are exhausted, the job moves to the DLQ:

```typescript
interface DeadLetterJobData {
  originalQueue: "content-sync"
  originalJobId: string
  originalJobData: { eventId: string }
  error: string
  stackTrace?: string
  attemptsMade: number
  failedAt: string
}
```

---

## Volume Mounts and File Access

### Docker Compose Configuration

```yaml
worker-content-sync:
  <<: *worker-common
  container_name: fiskai-worker-content-sync
  command: ["node", "dist/workers/lib/regulatory-truth/workers/content-sync.worker.js"]
  environment:
    <<: *worker-env
    GITHUB_TOKEN: ${GITHUB_TOKEN}
    WORKER_TYPE: content-sync
    WORKER_CONCURRENCY: 1
  volumes:
    - ./content:/app/content:rw
  deploy:
    resources:
      limits:
        memory: 512M
```

### Volume Mount Details

| Host Path   | Container Path | Mode | Purpose                        |
| ----------- | -------------- | ---- | ------------------------------ |
| `./content` | `/app/content` | `rw` | Read/write access to MDX files |

### File Access Requirements

| Operation      | Path                    | Permissions |
| -------------- | ----------------------- | ----------- |
| Read MDX       | `/app/content/**/*.mdx` | Read        |
| Write MDX      | `/app/content/**/*.mdx` | Write       |
| Git operations | `/app/` (REPO_ROOT)     | Read/Write  |

### Git Repository Requirements

The container must have:

1. A valid git repository at `REPO_ROOT`
2. Remote `origin` configured
3. Write access to push branches
4. `gh` CLI authenticated with `GITHUB_TOKEN`

---

## Database Schema

### Table: `content_sync_events`

```sql
CREATE TABLE content_sync_events (
  event_id TEXT PRIMARY KEY,           -- SHA-256 hash
  version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
  type content_sync_event_type NOT NULL,
  status content_sync_status NOT NULL DEFAULT 'PENDING',
  rule_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  dead_letter_reason dead_letter_reason,
  dead_letter_note TEXT,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  pr_url TEXT,
  pr_created_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes

| Index Name                               | Columns                | Purpose          |
| ---------------------------------------- | ---------------------- | ---------------- |
| `idx_content_sync_events_status_created` | `(status, created_at)` | Queue processing |
| `idx_content_sync_events_concept_id`     | `(concept_id)`         | Concept lookups  |
| `idx_content_sync_events_rule_id`        | `(rule_id)`            | Rule lookups     |

### Enums

```sql
-- Event types
CREATE TYPE content_sync_event_type AS ENUM (
  'RULE_RELEASED', 'RULE_SUPERSEDED', 'RULE_EFFECTIVE',
  'SOURCE_CHANGED', 'POINTERS_CHANGED', 'CONFIDENCE_DROPPED'
);

-- Processing status
CREATE TYPE content_sync_status AS ENUM (
  'PENDING', 'ENQUEUED', 'PROCESSING', 'DONE',
  'FAILED', 'DEAD_LETTERED', 'SKIPPED'
);

-- Dead letter reasons
CREATE TYPE dead_letter_reason AS ENUM (
  'UNMAPPED_CONCEPT', 'INVALID_PAYLOAD', 'MISSING_POINTERS',
  'CONTENT_NOT_FOUND', 'FRONTMATTER_PARSE_ERROR', 'PATCH_CONFLICT',
  'REPO_WRITE_FAILED', 'DB_WRITE_FAILED', 'UNKNOWN'
);
```

---

## Concept Registry

### Overview

The concept registry maps regulatory concepts to MDX files that reference them. When a concept changes, all mapped files need updates.

### Registry Structure

```typescript
interface ConceptMapping {
  conceptId: string // Unique identifier (e.g., "pdv-threshold")
  description: string // Human-readable description
  mdxPaths: string[] // Paths relative to content/
  toolIds?: string[] // Related calculator/tool IDs
}
```

### Current Concept Count

| Domain          | Concept Count | Example Concepts                                            |
| --------------- | ------------- | ----------------------------------------------------------- |
| PDV/VAT         | 5             | `pdv-threshold`, `pdv-standard-rate`, `reverse-charge-eu`   |
| Pausalni        | 3             | `pausalni-revenue-limit`, `pausalni-tax-rate`               |
| Contributions   | 4             | `zdravstveno-rate`, `mirovinsko-rate`                       |
| Fiscalization   | 2             | `fiskalizacija-required`, `fiskalizacija-exempt-activities` |
| Tax Deadlines   | 3             | `posd-deadline`, `joppd-deadline`, `pdv-obrazac-deadline`   |
| Company Capital | 2             | `jdoo-capital-requirement`, `doo-capital-requirement`       |
| Income Tax      | 3             | `porez-na-dohodak-rates`, `osobni-odbitak`                  |
| Corporate Tax   | 2             | `porez-na-dobit-rate`, `porez-na-dobit-reduced`             |
| E-Invoicing     | 2             | `e-racun-mandatory`, `e-racun-b2g-deadline`                 |
| Other           | 15+           | Various regulatory concepts                                 |

### Sample Mappings

```typescript
{
  conceptId: "pdv-threshold",
  description: "PDV registration threshold (annual revenue limit)",
  mdxPaths: [
    "vodici/pausalni-obrt.mdx",
    "vodici/freelancer.mdx",
    "rjecnik/pdv.mdx",
    "kako-da/uci-u-sustav-pdv.mdx",
    "usporedbe/preko-praga.mdx",
  ],
  toolIds: ["pausalni-calculator", "vat-threshold-checker"],
}
```

### Utility Functions

| Function                            | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `getConceptMapping(id)`             | Get mapping for a concept ID       |
| `resolveContentPaths(mapping, dir)` | Convert relative to absolute paths |
| `getAllConceptIds()`                | List all registered concepts       |
| `getConceptsForFile(path)`          | Find concepts affecting a file     |
| `getConceptsForTool(toolId)`        | Find concepts for a calculator     |

---

## Test Coverage

### Test Files

| Test File                  | Coverage Area                   |
| -------------------------- | ------------------------------- |
| `event-id.test.ts`         | Event ID generation and hashing |
| `errors.test.ts`           | Error classification            |
| `types.test.ts`            | Type guards and validation      |
| `concept-registry.test.ts` | Concept mapping lookup          |
| `repo-adapter.test.ts`     | Git operations                  |
| `emit-event.test.ts`       | Event emission to database      |
| `patcher.test.ts`          | Frontmatter patching            |
| `integration.test.ts`      | End-to-end flow                 |

### Integration Test Coverage

The integration tests verify:

1. **Event ID Generation**
   - 64-character SHA-256 hex format
   - Database storage with PENDING status
   - Correct severity assignment by tier

2. **Concept Registry**
   - pdv-threshold returns valid mapping
   - At least one MDX file exists on disk
   - Unknown concepts return undefined

3. **Frontmatter Patching**
   - RTL section added with conceptId/ruleId
   - Changelog entry with all required fields
   - Original content preserved
   - lastUpdated set to today

### Test Commands

```bash
# Run all content-sync tests
npm test -- content-sync

# Run integration tests (requires database)
DATABASE_URL=... npm test -- integration.test.ts
```

---

## Known Limitations

### 1. Single Concept Per Event

**Limitation:** Each event maps to one concept. If a regulatory change affects multiple concepts, multiple events must be emitted.

**Impact:** Potential for incomplete syncs if related concepts are not all updated.

**Workaround:** Releaser agent should emit events for all affected concepts.

### 2. No Partial Rollback

**Limitation:** If PR creation fails after files are committed, the branch remains on remote.

**Impact:** Manual cleanup may be required.

**Workaround:** Worker attempts cleanup on retry; orphaned branches can be pruned periodically.

### 3. File Must Exist

**Limitation:** The worker cannot create new MDX files; files must pre-exist.

**Impact:** New content types require manual file creation before sync.

**Workaround:** Add placeholder files to the concept registry before regulatory changes are detected.

### 4. Sequential Processing

**Limitation:** Concurrency is 1 to avoid git conflicts.

**Impact:** High-volume periods may cause queue backlog.

**Workaround:** Rate limit upstream event emission; monitor queue depth.

### 5. No Merge Automation

**Limitation:** PRs require manual review and merge.

**Impact:** Changes are not immediately live; requires human intervention.

**Rationale:** This is intentional for regulatory compliance - human oversight is required.

### 6. Branch Name Length

**Limitation:** Branch names may be truncated for very long concept IDs.

**Impact:** Potential for collision on similar long concept IDs.

**Workaround:** Keep concept IDs reasonably short (< 50 chars).

### 7. Single Repository Target

**Limitation:** Worker assumes a single target repository.

**Impact:** Cannot sync to multiple repositories (e.g., different markets).

**Workaround:** Deploy separate worker instances per repository.

---

## Security Considerations

### Sensitive Data

| Data Type            | Location             | Protection                         |
| -------------------- | -------------------- | ---------------------------------- |
| GitHub Token         | Environment variable | Not logged, not in container image |
| Database credentials | Environment variable | Container-scoped, rotatable        |
| Source content       | MDX files            | Version controlled, reviewable     |

### GitHub Token Scope

The `GITHUB_TOKEN` requires:

- `repo` - Full control of repositories (for PR creation)
- `workflow` - If CI is triggered on PR

**Recommendation:** Use a fine-grained PAT scoped to specific repositories.

### File System Security

- Container runs as non-root user
- Volume mount is scoped to `/content/` only
- No write access outside content directory

### Database Security

- Events contain no PII
- Payload includes only regulatory data
- Source pointers reference public documents

---

## Monitoring and Observability

### Logging

The worker logs at these points:

| Log Level | Event          | Message Pattern                                       |
| --------- | -------------- | ----------------------------------------------------- |
| INFO      | Job start      | `[content-sync] Processing job {id}: sync`            |
| INFO      | Event claimed  | `[content-sync] Event {id} claimed`                   |
| INFO      | File skipped   | `[content-sync] Skipping {path}: already has eventId` |
| INFO      | PR created     | `[content-sync] Created PR: {url}`                    |
| INFO      | Job complete   | `[content-sync] Job {id} completed in {ms}ms`         |
| WARN      | Cleanup failed | `[content-sync] Cleanup failed: {error}`              |
| ERROR     | Job failed     | `[content-sync] Job {id} failed: {error}`             |
| ERROR     | Dead lettered  | `[content-sync] Dead-lettered {id}: {reason}`         |

### Metrics to Monitor

| Metric           | Source     | Alert Threshold                           |
| ---------------- | ---------- | ----------------------------------------- |
| Queue depth      | BullMQ     | > 100 pending                             |
| Failed jobs      | BullMQ     | > 5 in 1 hour                             |
| DLQ depth        | BullMQ     | > 10 total                                |
| Processing time  | Job result | > 5 minutes                               |
| PR creation rate | Database   | < 1 per day (may indicate pipeline issue) |

### Health Checks

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-content-sync --tail 100

# Check pending events
psql -c "SELECT status, count(*) FROM content_sync_events GROUP BY status"
```

---

## Recommended Improvements

### High Priority

#### 1. Add Concept Validation Script

**Problem:** New concepts may be added to the registry without corresponding MDX files existing.

**Solution:** Create a CI script that validates all concept mappings resolve to existing files.

```bash
# Proposed: scripts/validate-concept-registry.ts
npx tsx scripts/validate-concept-registry.ts
```

#### 2. Implement PR Status Tracking

**Problem:** Worker doesn't track whether PRs are merged, closed, or still pending.

**Solution:** Add background job to poll PR status and update event records.

```sql
ALTER TABLE content_sync_events ADD COLUMN pr_status TEXT;
ALTER TABLE content_sync_events ADD COLUMN pr_merged_at TIMESTAMPTZ;
```

#### 3. Add Dead Letter Alerting

**Problem:** DLQ accumulation may go unnoticed.

**Solution:** Integrate with Slack/PagerDuty when DLQ exceeds threshold.

### Medium Priority

#### 4. Support Multi-Concept Events

**Problem:** Single event per concept requires multiple events for related changes.

**Solution:** Allow `conceptId` to be an array, process all in single PR.

#### 5. Add Dry-Run Mode

**Problem:** Cannot test without creating real PRs.

**Solution:** Add `DRY_RUN=true` env var that logs changes without pushing.

#### 6. Implement PR Templating

**Problem:** PR body is hardcoded in repo-adapter.

**Solution:** Move to configurable templates stored in repository.

### Low Priority

#### 7. Add Webhook Support

**Problem:** PR creation relies on `gh` CLI.

**Solution:** Use GitHub REST API directly for more control and better error handling.

#### 8. Support Multiple Target Branches

**Problem:** All PRs target `main`.

**Solution:** Allow configurable base branch per concept domain.

#### 9. Add Changelog Rollback

**Problem:** No way to revert a changelog entry if PR is rejected.

**Solution:** Add `RULE_REVERTED` event type that removes changelog entries.

---

## Appendix: Code References

### Source Files

| File                                                        | Purpose                    |
| ----------------------------------------------------------- | -------------------------- |
| `src/lib/regulatory-truth/workers/content-sync.worker.ts`   | Main worker implementation |
| `src/lib/regulatory-truth/content-sync/index.ts`            | Module exports             |
| `src/lib/regulatory-truth/content-sync/types.ts`            | Type definitions           |
| `src/lib/regulatory-truth/content-sync/errors.ts`           | Error classes              |
| `src/lib/regulatory-truth/content-sync/emit-event.ts`       | Event emission             |
| `src/lib/regulatory-truth/content-sync/event-id.ts`         | ID generation              |
| `src/lib/regulatory-truth/content-sync/concept-registry.ts` | Concept mappings           |
| `src/lib/regulatory-truth/content-sync/patcher.ts`          | Frontmatter patching       |
| `src/lib/regulatory-truth/content-sync/repo-adapter.ts`     | Git operations             |
| `src/lib/db/schema/content-sync.ts`                         | Database schema            |
| `src/lib/regulatory-truth/workers/queues.ts`                | Queue definitions          |
| `src/lib/regulatory-truth/workers/base.ts`                  | Worker base class          |

### Configuration Files

| File                         | Purpose                        |
| ---------------------------- | ------------------------------ |
| `docker-compose.workers.yml` | Worker container configuration |
| `.env` / `.env.local`        | Environment variables          |

### Test Files

| File                                                                       | Purpose              |
| -------------------------------------------------------------------------- | -------------------- |
| `src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts`      | Integration tests    |
| `src/lib/regulatory-truth/content-sync/__tests__/patcher.test.ts`          | Patcher unit tests   |
| `src/lib/regulatory-truth/content-sync/__tests__/concept-registry.test.ts` | Registry tests       |
| `src/lib/regulatory-truth/content-sync/__tests__/errors.test.ts`           | Error classification |
| `src/lib/regulatory-truth/content-sync/__tests__/repo-adapter.test.ts`     | Git adapter tests    |

---

## Document History

| Version | Date       | Author          | Changes                     |
| ------- | ---------- | --------------- | --------------------------- |
| 1.0     | 2026-01-14 | Claude Opus 4.5 | Initial comprehensive audit |

---

_This document is part of the FiskAI Product Bible. For related worker audits, see:_

- [APPENDIX-WORKER-ORCHESTRATOR.md](./APPENDIX-WORKER-ORCHESTRATOR.md)
- [APPENDIX-WORKER-RELEASER.md](./APPENDIX-WORKER-RELEASER.md)
- [APPENDIX-WORKER-EXTRACTOR.md](./APPENDIX-WORKER-EXTRACTOR.md)
