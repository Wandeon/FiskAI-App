# Cron Jobs Inventory

Last updated: 2025-12-15

## Summary

FiskAI runs **3 scheduled background jobs** via Vercel Cron.

## Vercel Cron Configuration

**Source**: `vercel.json:1-12`

```json
{
  "crons": [
    {
      "path": "/api/cron/bank-sync",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/email-sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```

## Job Details

### 1. Bank Sync (`/api/cron/bank-sync`)

| Property | Value                                  |
| -------- | -------------------------------------- |
| Schedule | `0 5 * * *` (5:00 AM UTC daily)        |
| Purpose  | Sync bank transactions from GoCardless |
| Handler  | `src/app/api/cron/bank-sync/route.ts`  |
| Auth     | `CRON_SECRET` bearer token             |

**Evidence**: `src/app/api/cron/bank-sync/route.ts:11`

**Flow**:

1. Validates `CRON_SECRET` from Authorization header
2. Fetches all active bank connections
3. For each connection, calls GoCardless API
4. Stores new transactions in database
5. Runs deduplication check

### 2. Email Sync (`/api/cron/email-sync`)

| Property | Value                                         |
| -------- | --------------------------------------------- |
| Schedule | `0 5 * * *` (5:00 AM UTC daily)               |
| Purpose  | Import invoices from connected email accounts |
| Handler  | `src/app/api/cron/email-sync/route.ts`        |
| Auth     | `CRON_SECRET` bearer token                    |

**Evidence**: `src/app/api/cron/email-sync/route.ts:9`

**Flow**:

1. Validates `CRON_SECRET` from Authorization header
2. Fetches all active email connections (Gmail, Outlook)
3. Applies import rules to filter relevant emails
4. Extracts attachments (PDFs, images)
5. Stores to R2 and creates import jobs

### 3. Fiscal Processor (`/api/cron/fiscal-processor`)

| Property | Value                                        |
| -------- | -------------------------------------------- |
| Schedule | Not in vercel.json (manual/on-demand)        |
| Purpose  | Process pending fiscalization requests       |
| Handler  | `src/app/api/cron/fiscal-processor/route.ts` |
| Auth     | `CRON_SECRET` bearer token                   |

**Evidence**: `src/app/api/cron/fiscal-processor/route.ts:13`

**Flow**:

1. Validates `CRON_SECRET` from Authorization header
2. Fetches pending fiscal requests
3. Submits to Croatian Tax Authority (CRS)
4. Updates invoice with JIR/ZKI codes
5. Handles retries for failed requests

## Security

All cron endpoints require authentication via the `CRON_SECRET` environment variable:

```typescript
// src/app/api/cron/bank-sync/route.ts:11
const cronSecret = process.env.CRON_SECRET
if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

## Local Development

To test cron jobs locally:

```bash
# Set CRON_SECRET in .env.local
CRON_SECRET=your-secret-here

# Call endpoint with bearer token
curl -X POST http://localhost:3000/api/cron/bank-sync \
  -H "Authorization: Bearer your-secret-here"
```

## Monitoring

Each cron job logs its execution:

- Start timestamp
- Number of records processed
- Any errors encountered
- Completion timestamp

**Evidence**: Pino logger usage in each handler

## Failure Handling

| Scenario             | Behavior                                        |
| -------------------- | ----------------------------------------------- |
| External API failure | Logged, job continues with next item            |
| Database error       | Logged, transaction rolled back                 |
| Auth failure         | 401 response, no processing                     |
| Timeout              | Vercel terminates after 10s (hobby) / 60s (pro) |
