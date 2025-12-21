# Regulatory Truth Layer - Monitoring Scripts

This directory contains scripts for running the Regulatory Truth Layer pipeline and continuous monitoring system.

## Scripts Overview

### 1. bootstrap.ts - Full Pipeline Runner

Runs the complete pipeline from source seeding to rule publication.

**Usage:**

```bash
npx tsx src/lib/regulatory-truth/scripts/bootstrap.ts
```

**What it does:**

- Phase 1: Seeds regulatory sources if needed
- Phase 2: Runs Sentinel on all critical sources to collect evidence
- Phase 3: Runs Extractor on new evidence to create source pointers
- Phase 4: Runs Composer to create draft rules from source pointers
- Phase 5: Runs Reviewer to validate and auto-approve rules (T2/T3 only)
- Phase 6: Runs Releaser to publish approved rules as versioned releases

**Output Example:**

```
============================================================
REGULATORY TRUTH LAYER - BOOTSTRAP
============================================================

[Phase 1] Seeding regulatory sources...
[Phase 1] Complete: 3 created, 87 skipped

[Phase 2] Collecting evidence from critical sources...
[Phase 2] Found 25 critical sources to process

[bootstrap] Processing: Porezna uprava - Paušalno oporezivanje
[bootstrap] Fetching evidence...
[bootstrap] ✓ Evidence collected: clxyz123
[bootstrap] Extracting data points...
[bootstrap] ✓ Extracted 12 data points

[Phase 4] Composing rules from source pointers...
[Phase 4] Complete: 8 success, 0 failed, 8 rules created

[Phase 5] Reviewing draft rules...
[Phase 5] Found 8 draft rules to review
[bootstrap] ✓ Rule auto-approved: pausalni-revenue-threshold

[Phase 6] Releasing 6 approved rules...
[Phase 6] ✓ Release created: rel_xyz123 (6 rules published)

============================================================
BOOTSTRAP COMPLETE
============================================================
Sources seeded: 3
Evidence collected: 25
Source pointers created: 234
Rules created: 8
Rules auto-approved: 6
Rules published: 6
Release ID: rel_xyz123
Errors: 0
```

### 2. monitor.ts - Continuous Monitoring

Scheduled checking of sources based on priority with optional pipeline execution.

**Usage:**

```bash
# Check all sources due for update
npx tsx src/lib/regulatory-truth/scripts/monitor.ts

# Check only T0 (critical) sources (daily)
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0

# Check only T1 (high) sources (weekly)
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T1

# Check only T2/T3 (medium/low) sources (monthly)
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T2

# Limit to 50 sources
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --max=50

# Check T0 sources and run full pipeline (compose, review)
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline
```

**Priority Schedule:**

- **T0 (Critical)**: Checked daily (24 hours)
  - Critical thresholds, rates, deadlines
  - Examples: VAT threshold, pausalni revenue limit, exchange rates

- **T1 (High)**: Checked weekly (168 hours)
  - Important regulations, contribution rates
  - Examples: Doprinosi rates, fiscalization rules

- **T2/T3 (Medium/Low)**: Checked monthly (720 hours)
  - General guidance, interpretations, practice
  - Examples: Tax authority guidance, chamber fees

**What it does:**

1. Queries database for sources that haven't been checked within their interval
2. Runs Sentinel agent to fetch and compare content
3. If changes detected, runs Extractor to extract data points
4. If `--pipeline` flag is used:
   - Runs Composer to create draft rules from new data points
   - Runs Reviewer to validate rules
   - Auto-approves T2/T3 rules with high confidence

**Output Example:**

```
============================================================
REGULATORY TRUTH LAYER - MONITORING
============================================================
Priority Filter: T0 (Critical sources - daily)

Found 8 sources due for check (processing 8)

[monitor] Checking source: Porezna uprava - Paušalno oporezivanje
[monitor] ✓ No changes detected

[monitor] Checking source: HNB - Tečajna lista
[monitor] Change detected - extracting data points...
[monitor] ✓ Extracted 3 data points

============================================================
MONITORING COMPLETE
============================================================
Sources checked: 8
Evidence collected: 8
Changes detected: 1
Source pointers created: 3
Errors: 0
```

### 3. seed-sources.ts - Seed Regulatory Sources

Seeds the initial set of regulatory sources into the database.

**Usage:**

```bash
npx tsx src/lib/regulatory-truth/scripts/seed-sources.ts
```

### 4. run-sentinel.ts - Run Sentinel Agent

Runs the Sentinel agent on specific sources or all active sources.

**Usage:**

```bash
# Run on all active sources
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts

# Run on specific source
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts porezna-pausalno
```

### 5. run-extractor.ts - Run Extractor Agent

Runs the Extractor agent on evidence records.

**Usage:**

```bash
# Run on all unprocessed evidence
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts

# Run on specific evidence
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts clxyz123
```

## API Endpoints

### GET /api/admin/regulatory-truth/status

Returns pipeline health status for monitoring dashboard.

**Authentication:** Requires ADMIN role

**Response:**

```json
{
  "timestamp": "2025-12-21T17:30:00.000Z",
  "health": {
    "status": "healthy",
    "score": 87
  },
  "sources": {
    "total": 90,
    "active": 85,
    "inactive": 5,
    "needingCheck": 3,
    "byPriority": {
      "T0": 25,
      "T1": 35,
      "T2": 25
    }
  },
  "rules": {
    "total": 234,
    "byStatus": {
      "DRAFT": 5,
      "PENDING_REVIEW": 8,
      "APPROVED": 12,
      "PUBLISHED": 206,
      "DEPRECATED": 3,
      "REJECTED": 0
    }
  },
  "evidence": {
    "total": 1523,
    "lastCollected": "2025-12-21T16:45:00.000Z"
  },
  "sourcePointers": {
    "total": 3456
  },
  "conflicts": {
    "active": 2
  },
  "agents": {
    "runs24h": 145,
    "byType": {
      "SENTINEL": { "completed": 45, "failed": 2, "running": 0 },
      "EXTRACTOR": { "completed": 38, "failed": 1, "running": 0 },
      "COMPOSER": { "completed": 8, "failed": 0, "running": 0 },
      "REVIEWER": { "completed": 12, "failed": 0, "running": 0 },
      "RELEASER": { "completed": 2, "failed": 0, "running": 0 }
    }
  },
  "latestRelease": {
    "id": "rel_xyz123",
    "version": "2.3.5",
    "releasedAt": "2025-12-21T15:00:00.000Z",
    "rulesCount": 6
  },
  "recentActivity": [
    {
      "id": "run_abc123",
      "type": "RELEASER",
      "completedAt": "2025-12-21T15:00:00.000Z",
      "confidence": 0.96,
      "summary": "Release published"
    }
  ]
}
```

## Cron Schedule Recommendations

### Daily (T0 Critical Sources)

```cron
0 6 * * * cd /path/to/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline
```

### Weekly (T1 High Priority)

```cron
0 7 * * 1 cd /path/to/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T1 --pipeline
```

### Monthly (T2/T3 Medium/Low Priority)

```cron
0 8 1 * * cd /path/to/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T2 --pipeline
```

## Environment Variables

Required environment variables (in `.env.local` and `.env`):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fiskai"

# LLM Provider (Ollama)
OLLAMA_ENDPOINT="https://ollama.com"
OLLAMA_MODEL="llama3.1"
OLLAMA_API_KEY="your-api-key"
```

## Error Handling

All scripts include comprehensive error handling:

- Rate limiting between API calls (2-5 seconds)
- Retry logic for transient failures (in agent runner)
- Detailed error logging with context
- Non-zero exit codes on failure

## Monitoring Pipeline Flow

```
┌─────────────────┐
│  Regulatory     │
│  Sources (90)   │
└────────┬────────┘
         │
         │ Sentinel (monitors)
         ▼
┌─────────────────┐
│  Evidence       │
│  (raw HTML/PDF) │
└────────┬────────┘
         │
         │ Extractor (analyzes)
         ▼
┌─────────────────┐
│  Source         │
│  Pointers (3.5k)│
└────────┬────────┘
         │
         │ Composer (synthesizes)
         ▼
┌─────────────────┐
│  Draft Rules    │
│  (pending)      │
└────────┬────────┘
         │
         │ Reviewer (validates)
         ▼
┌─────────────────┐
│  Approved Rules │
│  (T2/T3 auto)   │
└────────┬────────┘
         │
         │ Releaser (publishes)
         ▼
┌─────────────────┐
│  Rule Releases  │
│  (versioned)    │
└─────────────────┘
```

## Confidence Thresholds

- **T0 (Critical)**: 0.99 confidence required, NEVER auto-approve
- **T1 (High)**: 0.95 confidence required, NEVER auto-approve
- **T2 (Medium)**: 0.90 confidence required, auto-approve at 0.95+
- **T3 (Low)**: 0.85 confidence required, auto-approve at 0.90+

## Release Versioning (Semver)

- **Major (X.0.0)**: T0 (critical) rule changes
- **Minor (x.X.0)**: T1 (high) rule changes
- **Patch (x.x.X)**: T2/T3 (medium/low) rule changes
