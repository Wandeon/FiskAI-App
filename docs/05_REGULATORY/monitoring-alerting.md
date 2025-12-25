# Regulatory Truth Layer - Monitoring & Alerting

**Last Updated:** 2025-12-26
**Owner:** Platform Engineering

## Overview

The Regulatory Truth Layer includes comprehensive monitoring, health checks, and alerting to ensure reliable operation of the regulatory content pipeline.

## Scheduled Jobs

All scheduled jobs run in Europe/Zagreb timezone.

| Job                       | Time        | Purpose                                                  |
| ------------------------- | ----------- | -------------------------------------------------------- |
| Health Snapshot           | 00:00       | Collect and store TruthHealthSnapshot metrics            |
| Confidence Decay          | 03:00 Sun   | Weekly decay of rule confidence scores                   |
| Truth Consolidation Audit | 04:00       | Smoke detector - check for duplicates, test data leakage |
| E2E Validation            | 05:00       | Full pipeline validation before discovery                |
| Morning Discovery         | 06:00       | Sentinel scans for new regulatory content                |
| **Daily Digest (Resend)** | **07:00**   | **Comprehensive health digest via Resend**               |
| Legacy Digest (SMTP)      | 08:00       | Backwards-compatible SMTP digest                         |
| Random Audit 1            | 10:00-14:00 | Randomized quality audit                                 |
| Random Audit 2            | 16:00-20:00 | 50% chance secondary audit                               |

## Alert Channels

### Primary Channels

1. **Resend Email** (Primary)
   - Daily digest at 07:00
   - Immediate critical alerts
   - Recipient: `TRUTH_DIGEST_EMAIL` env var (default: wandeon@gmail.com)

2. **Slack** (Secondary)
   - Critical alerts
   - Audit results
   - Webhook: `SLACK_WEBHOOK_URL` env var

3. **SMTP Email** (Legacy)
   - Daily digest at 08:00
   - Critical alerts
   - Uses Nodemailer with `SMTP_*` env vars

### Alert Severity Levels

| Severity | Routing                | Examples                                                   |
| -------- | ---------------------- | ---------------------------------------------------------- |
| CRITICAL | Slack + Email + Resend | Pipeline failure, test data leakage, fail-closed violation |
| WARNING  | Email digest only      | High unlinked pointers, low published coverage             |
| INFO     | Logged only            | Normal operations                                          |

## Alert Deduplication

- **Window:** 60 minutes (configurable via `ALERT_DEDUP_WINDOW_MINUTES`)
- **Behavior:** Duplicate alerts within window increment `occurrenceCount` instead of creating new records
- **Notification:** Only first occurrence triggers notifications; subsequent occurrences update count silently

## Daily Digest Content

The daily digest sent at 07:00 via Resend includes:

### Truth Health Snapshot

- Total rules count
- Published rules count and percentage
- Multi-source vs single-source breakdown
- Single-source blocked (needing corroboration)

### Data Quality Metrics

- Duplicate groups detected
- Orphaned concepts count
- Unlinked pointer percentage

### Alerts Summary

- Critical alerts from last 24 hours
- Warning alerts (top 5)
- Occurrence counts for deduplicated alerts

### Queue Health

- BullMQ queue status (waiting, active, failed, completed)
- Per-queue breakdown

### Consolidator Results

- Latest consolidator check results
- Issues found and resolved

## Environment Variables

### Required

```bash
RESEND_API_KEY=re_xxx           # Resend API key
RESEND_FROM_EMAIL=noreply@fiskai.hr  # From address
```

### Optional

```bash
TRUTH_DIGEST_EMAIL=wandeon@gmail.com  # Digest recipient
WATCHDOG_TIMEZONE=Europe/Zagreb        # Scheduler timezone
ALERT_DEDUP_WINDOW_MINUTES=60          # Dedup window (default: 60)
WATCHDOG_ENABLED=true                  # Enable watchdog scheduler
```

### Legacy SMTP (backwards compatibility)

```bash
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
SMTP_FROM=noreply@fiskai.hr
ADMIN_ALERT_EMAIL=admin@fiskai.hr
```

## Health Metrics Collected

### TruthHealthSnapshot Fields

```typescript
interface TruthHealthMetrics {
  // Rule counts by status
  totalRules: number
  publishedRules: number
  approvedRules: number
  pendingReviewRules: number
  draftRules: number
  rejectedRules: number

  // Pointer coverage
  totalPointers: number
  unlinkedPointers: number
  unlinkedPointersRate: number

  // Evidence quality
  rulesWithMultiplePointers: number
  multiplePointerRate: number
  publishedWithTwoPlus: number
  publishedPointerCoverage: number

  // Consolidation health
  duplicateGroupsDetected: number
  testDataLeakage: number
  aliasResolutionsToday: number

  // Concept health
  totalConcepts: number
  conceptsWithRules: number
  orphanedConcepts: number

  // Evidence strength
  multiSourceRules: number
  singleSourceRules: number
  singleSourceCanPublish: number
  singleSourceBlocked: number

  // Alerts
  alertsTriggered: string[]
}
```

## Alert Types

| Type                     | Severity | Trigger                                            |
| ------------------------ | -------- | -------------------------------------------------- |
| `PIPELINE_FAILURE`       | CRITICAL | Any phase fails                                    |
| `TEST_DATA_LEAKAGE`      | CRITICAL | Test domain pointers in production rules           |
| `DUPLICATES_DETECTED`    | WARNING  | Duplicate rule groups found                        |
| `HIGH_UNLINKED_POINTERS` | WARNING  | >10% pointers not linked to rules                  |
| `LOW_PUBLISHED_COVERAGE` | WARNING  | <50% published rules have 2+ pointers              |
| `SINGLE_SOURCE_BLOCKED`  | WARNING  | Rules blocked from publishing (need corroboration) |
| `HIGH_ORPHANED_CONCEPTS` | WARNING  | >30% concepts have no rules                        |
| `AUDIT_FAIL`             | CRITICAL | Audit score below threshold                        |
| `AUDIT_PARTIAL`          | WARNING  | Audit partial pass                                 |

## API Endpoints

### GET /api/regulatory/truth-health

Returns current truth health metrics.

### POST /api/regulatory/truth-health

Triggers a new health snapshot collection.

### GET /api/admin/watchdog

Returns watchdog dashboard data including recent alerts.

## Manual Triggers

```bash
# Trigger manual digest
npx tsx -e "
import { sendRegulatoryTruthDigest } from './src/lib/regulatory-truth/watchdog/resend-email'
sendRegulatoryTruthDigest().then(console.log)
"

# Trigger health snapshot
npx tsx -e "
import { storeTruthHealthSnapshot } from './src/lib/regulatory-truth/utils/truth-health'
storeTruthHealthSnapshot().then(console.log)
"

# Trigger consolidator health check
npx tsx -e "
import { runConsolidatorHealthCheck } from './src/lib/regulatory-truth/utils/truth-health'
runConsolidatorHealthCheck().then(console.log)
"
```

## Files

### Email Templates

- `src/emails/regulatory-truth-digest.tsx` - React Email template for daily digest

### Alerting Logic

- `src/lib/regulatory-truth/watchdog/alerting.ts` - Alert routing and deduplication
- `src/lib/regulatory-truth/watchdog/resend-email.ts` - Resend-based email sending
- `src/lib/regulatory-truth/watchdog/email.ts` - Legacy SMTP email
- `src/lib/regulatory-truth/watchdog/slack.ts` - Slack integration

### Scheduling

- `src/lib/regulatory-truth/scheduler/cron.ts` - Cron job definitions
- `src/lib/regulatory-truth/workers/scheduler.service.ts` - BullMQ scheduler service

### Health Collection

- `src/lib/regulatory-truth/utils/truth-health.ts` - Metrics collection and storage
- `src/lib/regulatory-truth/utils/evidence-strength.ts` - Evidence strength computation
