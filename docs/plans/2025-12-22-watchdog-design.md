# Watchdog System Design - Self-Aware Autonomous Regulatory Monitoring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this design.

**Goal:** Create a self-aware autonomous monitoring system that orchestrates the regulatory truth pipeline with staggered timing, self-monitoring, automatic escalation, and random quality audits.

**Architecture:** Watchdog Daemon pattern with phased execution (Scout → Scrape → Process → Audit), health monitors running after each phase, and multi-channel alerting (Email + Dashboard + Slack).

**Tech Stack:** Node.js, node-cron, Prisma, Slack Webhooks, Nodemailer

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WATCHDOG DAEMON                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ SCOUT PHASE  │→ │ SCRAPE PHASE │→ │PROCESS PHASE │          │
│  │   (06:00)    │  │   (06:30)    │  │   (after)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                │                  │                   │
│         ▼                ▼                  ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              HEALTH MONITORS                             │   │
│  │  • Stale source detector    • Quality degradation       │   │
│  │  • Scraper failure rate     • Pipeline health           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│  │   EMAIL    │    │ DASHBOARD  │    │   SLACK    │           │
│  │  (digest)  │    │  (realtime)│    │  (alerts)  │           │
│  └────────────┘    └────────────┘    └────────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              RANDOM AUDIT SYSTEM                         │   │
│  │  • Daily 1-2 random runs    • Trace source→DB           │   │
│  │  • Score quality            • Report to Slack           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AUTO-RECOVERY                               │   │
│  │  • Retry failed fetches     • Skip broken sources       │   │
│  │  • Suspend after 5 fails    • Never modify data         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase Execution & Timing

### Scout Phase (06:00)

```
┌─────────────────────────────────────────────────────────┐
│  SCOUT PHASE - 06:00 Europe/Zagreb                      │
├─────────────────────────────────────────────────────────┤
│  for each endpoint in priority_order:                   │
│    delay = random(50, 70) seconds                       │
│    await sleep(delay)                                   │
│    result = sentinel.checkEndpoint(endpoint)            │
│    record(result)                                       │
│                                                         │
│  timeout: 06:30 (hard cutoff)                          │
│  on_timeout: log incomplete, continue to scrape phase   │
└─────────────────────────────────────────────────────────┘
```

### Scrape Phase (06:30 or after scouts complete)

```
┌─────────────────────────────────────────────────────────┐
│  SCRAPE PHASE - Sequential with random delays           │
├─────────────────────────────────────────────────────────┤
│  discovered_urls = get_pending_items()                  │
│                                                         │
│  for each url in discovered_urls:                       │
│    delay = random(20, 30) seconds                       │
│    await sleep(delay)                                   │
│    content = fetch_and_extract(url)                     │
│    if content.valid:                                    │
│      queue_for_processing(content)                      │
│    else:                                                │
│      mark_failed(url, reason)                           │
│                                                         │
│  timeout: 08:00 (hard cutoff for scraping)             │
└─────────────────────────────────────────────────────────┘
```

### Processing Phase (after scrape)

- Runs existing pipeline: Extract → Compose → Review → Auto-Approve → Release
- Uses existing AGENT_RATE_LIMIT_MS (3 seconds) between AI calls
- No additional random delays needed (already rate-limited)

### Audit Phase (random time, daily)

- Triggered independently, 1-2 times per day
- Picks random completed run from last 7 days
- Traces full path: Evidence → SourcePointer → Rule → Release

---

## 3. Content Processing & Rate Limiting

### Content Chunking Strategy

```
┌─────────────────────────────────────────────────────────┐
│  CONTENT PROCESSOR                                      │
├─────────────────────────────────────────────────────────┤
│  Input: raw HTML/PDF from scraper                       │
│                                                         │
│  1. Clean & normalize (remove nav, ads, scripts)        │
│  2. Measure token count                                 │
│                                                         │
│  if tokens <= 4000:                                     │
│    process_single(content)                              │
│  else:                                                  │
│    chunks = split_at_paragraphs(content, max=4000,      │
│                                 overlap=500)            │
│    for chunk in chunks:                                 │
│      pointers = extract(chunk)                          │
│    deduplicate(all_pointers)                            │
│                                                         │
│  3. Generate summary (for vector store)                 │
│  4. Create embeddings per chunk                         │
└─────────────────────────────────────────────────────────┘
```

### Variable Rate Limiting

```typescript
// Per-domain configuration
const DOMAIN_DELAYS: Record<string, { base: number; maxJitter: number }> = {
  "narodne-novine.nn.hr": { base: 3000, maxJitter: 1500 },
  "porezna-uprava.gov.hr": { base: 4000, maxJitter: 2000 },
  "hzzo.hr": { base: 5000, maxJitter: 2500 },
  "mirovinsko.hr": { base: 4000, maxJitter: 2000 },
  "fina.hr": { base: 3000, maxJitter: 1500 },
  "mfin.gov.hr": { base: 4000, maxJitter: 2000 },
}

function getDelay(domain: string): number {
  const config = DOMAIN_DELAYS[domain] ?? { base: 3000, maxJitter: 1500 }
  const jitter = Math.random() * config.maxJitter
  const longPause = Math.random() < 0.1 ? config.base : 0 // 10% chance
  return config.base + jitter + longPause
}
// Result: 3-4.5s normal, occasionally 6-9s
```

---

## 4. Health Monitoring & Self-Awareness

### Health Monitor Checks

```
┌─────────────────────────────────────────────────────────┐
│  HEALTH MONITORS (run after each pipeline execution)    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STALE SOURCE DETECTOR                                  │
│  ─────────────────────                                  │
│  for each active source:                                │
│    days_since_discovery = now - last_new_item_date      │
│    if days_since_discovery > 7:                         │
│      alert(WARNING, "Source {name} stale for {days}d")  │
│    if days_since_discovery > 14:                        │
│      alert(CRITICAL, "Source {name} possibly broken")   │
│                                                         │
│  SCRAPER FAILURE DETECTOR                               │
│  ────────────────────────                               │
│  failure_rate = failed_fetches / total_fetches (24h)    │
│  if failure_rate > 0.3:                                 │
│    alert(WARNING, "High failure rate: {rate}%")         │
│  if failure_rate > 0.5:                                 │
│    alert(CRITICAL, "Scraping critically failing")       │
│                                                         │
│  QUALITY DEGRADATION DETECTOR                           │
│  ────────────────────────────                           │
│  avg_confidence = mean(rule.confidence) for last 7 days │
│  if avg_confidence < 0.85:                              │
│    alert(WARNING, "Rule quality declining: {conf}")     │
│  rejection_rate = rejected / (approved + rejected)      │
│  if rejection_rate > 0.4:                               │
│    alert(WARNING, "High rejection rate: {rate}%")       │
│                                                         │
│  PIPELINE HEALTH                                        │
│  ───────────────                                        │
│  if phase_duration > expected * 2:                      │
│    alert(WARNING, "Phase {name} running slow")          │
│  if phase_failed:                                       │
│    alert(CRITICAL, "Phase {name} failed: {error}")      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Health Status Table

```sql
CREATE TABLE "WatchdogHealth" (
  id            TEXT PRIMARY KEY,
  checkType     TEXT,        -- STALE_SOURCE, SCRAPER_FAILURE, etc.
  entityId      TEXT,        -- source ID, phase name, etc.
  status        TEXT,        -- HEALTHY, WARNING, CRITICAL
  lastChecked   TIMESTAMP,
  lastHealthy   TIMESTAMP,
  metric        DECIMAL,     -- the measured value
  threshold     DECIMAL,     -- the threshold that triggered
  message       TEXT
);
```

### Thresholds Summary

| Check              | WARNING     | CRITICAL    |
| ------------------ | ----------- | ----------- |
| Source stale       | 7 days      | 14 days     |
| Fetch failure rate | 30%         | 50%         |
| Avg confidence     | <0.85       | <0.75       |
| Rejection rate     | 40%         | 60%         |
| Phase duration     | 2x expected | 3x expected |

---

## 5. Alerting & Escalation

### Alert Flow

```
┌─────────────────────────────────────────────────────────┐
│  ALERT LIFECYCLE                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Health Monitor detects issue                           │
│           ↓                                             │
│  Create/Update WatchdogAlert record                     │
│           ↓                                             │
│  ┌─────────────────────────────────────┐               │
│  │ Deduplication Check:                │               │
│  │ - Same type + entity in last 24h?   │               │
│  │ - If yes: increment count, skip     │               │
│  │ - If no: create new alert           │               │
│  └─────────────────────────────────────┘               │
│           ↓                                             │
│  Route by severity:                                     │
│                                                         │
│  INFO     → Dashboard only (no notification)            │
│  WARNING  → Dashboard + Daily digest email (08:00)      │
│  CRITICAL → Dashboard + Immediate email + Slack         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Alert Table

```sql
CREATE TABLE "WatchdogAlert" (
  id            TEXT PRIMARY KEY,
  severity      TEXT,        -- INFO, WARNING, CRITICAL
  type          TEXT,        -- STALE_SOURCE, SCRAPER_FAILURE, etc.
  entityId      TEXT,        -- what triggered it
  message       TEXT,
  details       JSONB,       -- full context for debugging
  occurredAt    TIMESTAMP,
  acknowledgedAt TIMESTAMP,  -- user clicked "acknowledge"
  resolvedAt    TIMESTAMP,   -- issue fixed (auto or manual)
  notifiedAt    TIMESTAMP,   -- when email was sent
  occurrenceCount INT DEFAULT 1  -- for deduplication
);
```

### Notification Routing

```
Alert Type          Email    Dashboard    Slack
─────────────────────────────────────────────────
INFO                 -          ✓           -
WARNING              digest     ✓           -
CRITICAL             immediate  ✓           ✓
AUDIT PASS           -          ✓           ✓
AUDIT PARTIAL        digest     ✓           ✓
AUDIT FAIL           immediate  ✓           ✓
```

### Email Templates

**CRITICAL (Immediate):**

```
Subject: [FiskAI CRITICAL] {type}: {message}

Regulatory Truth Pipeline Alert

Severity: CRITICAL
Type: {type}
Entity: {entityId}
Time: {occurredAt}

Details:
{details}

Dashboard: https://fiskai.hr/admin/watchdog
```

**DAILY DIGEST (08:00):**

```
Subject: [FiskAI] Daily Watchdog Report - {date}

Pipeline Status: {overall_status}

Warnings (last 24h):
• {warning_1}
• {warning_2}

Health Summary:
- Sources checked: {n}
- Items discovered: {n}
- Rules created: {n}
- Avg confidence: {n}%

Dashboard: https://fiskai.hr/admin/watchdog
```

### Slack Message Format

```
AUDIT PASS:
┌────────────────────────────────────────┐
│ ✅ Audit Passed                        │
│ Run: 2025-12-22 06:00                  │
│ Score: 94%                             │
│ Rules checked: 5/5 passed              │
│ [View Details]                         │
└────────────────────────────────────────┘

AUDIT FAIL:
┌────────────────────────────────────────┐
│ 🚨 Audit Failed                        │
│ Run: 2025-12-22 06:00                  │
│ Score: 62%                             │
│ Issues:                                │
│ • Rule pdv-stopa-2025: quote missing   │
│ • Rule rok-joppd: URL 404              │
│ [View Details] [Acknowledge]           │
└────────────────────────────────────────┘
```

---

## 6. Random Audit System

### Audit Purpose

Independently verify that the pipeline is producing accurate rules by randomly sampling completed runs and tracing the full path from source to database.

### Audit Flow

```
┌─────────────────────────────────────────────────────────┐
│  RANDOM AUDIT (1-2x daily, random time)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. SELECT RANDOM RUN                                   │
│     - Pick 1 run from last 7 days                       │
│     - Weighted toward recent (50% last 2 days)          │
│                                                         │
│  2. SELECT RANDOM SAMPLES                               │
│     - Pick 3-5 rules from that run                      │
│     - Include mix: 1 high-confidence, 1 low-confidence  │
│                                                         │
│  3. TRACE EACH RULE                                     │
│     Rule → SourcePointers → Evidence → Original URL     │
│                                                         │
│  4. VERIFY CHAIN                                        │
│     ┌─────────────────────────────────────────┐        │
│     │ For each rule:                          │        │
│     │ a. Re-fetch original URL (if available) │        │
│     │ b. Compare stored evidence hash         │        │
│     │ c. Verify exactQuote exists in content  │        │
│     │ d. Check extractedValue matches rule    │        │
│     │ e. Validate effective dates make sense  │        │
│     └─────────────────────────────────────────┘        │
│                                                         │
│  5. SCORE & REPORT                                      │
│     - Pass: all checks green                            │
│     - Partial: some minor discrepancies                 │
│     - Fail: broken chain or wrong data                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Audit Checks

```typescript
interface AuditCheck {
  name: string
  weight: number // importance 1-10
  check: (rule: Rule, evidence: Evidence) => AuditResult
}

const AUDIT_CHECKS: AuditCheck[] = [
  {
    name: "evidence_exists",
    weight: 10,
    check: (rule) => rule.sourcePointers.length > 0,
  },
  {
    name: "quote_in_content",
    weight: 8,
    check: (rule, evidence) => evidence.content.includes(rule.sourcePointers[0].exactQuote),
  },
  {
    name: "content_hash_matches",
    weight: 7,
    check: (rule, evidence) => hash(evidence.content) === evidence.contentHash,
  },
  {
    name: "url_still_accessible",
    weight: 5,
    check: async (rule, evidence) => (await fetch(evidence.url)).ok,
  },
  {
    name: "dates_logical",
    weight: 6,
    check: (rule) => rule.effectiveFrom <= (rule.effectiveUntil ?? new Date("2100-01-01")),
  },
  {
    name: "value_extractable",
    weight: 9,
    check: (rule, evidence) =>
      evidence.content.includes(String(rule.value)) || canDeriveValue(evidence.content, rule.value),
  },
]
```

### Audit Report Table

```sql
CREATE TABLE "WatchdogAudit" (
  id            TEXT PRIMARY KEY,
  runDate       DATE,           -- which pipeline run was audited
  auditedAt     TIMESTAMP,
  rulesAudited  INT,
  rulesPassed   INT,
  rulesFailed   INT,
  overallScore  DECIMAL,        -- 0-100%
  findings      JSONB,          -- detailed per-rule results
  alertsRaised  TEXT[]          -- alert IDs if issues found
);
```

### Audit Scoring

```
Score = Σ(check.weight × check.passed) / Σ(check.weight) × 100

90-100%  → PASS (green)
70-89%   → PARTIAL (yellow) → WARNING alert
<70%     → FAIL (red) → CRITICAL alert
```

---

## 7. Self-Healing & Auto-Recovery

### Recovery Actions (Safe Mode)

```
┌─────────────────────────────────────────────────────────┐
│  AUTO-RECOVERY ACTIONS                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FETCH FAILURES                                         │
│  ──────────────                                         │
│  Retry strategy:                                        │
│    Attempt 1: immediate                                 │
│    Attempt 2: +60 seconds                               │
│    Attempt 3: +5 minutes                                │
│    Attempt 4: +1 hour (in next run)                     │
│    After 4 fails: mark SKIPPED, alert WARNING           │
│                                                         │
│  SOURCE APPEARS BROKEN                                  │
│  ────────────────────                                   │
│  if consecutive_failures >= 5:                          │
│    source.status = SUSPENDED                            │
│    alert(CRITICAL, "Source auto-suspended")             │
│    # Human must manually re-enable                      │
│                                                         │
│  LLM EXTRACTION FAILS                                   │
│  ────────────────────                                   │
│  Retry with:                                            │
│    1. Same content, fresh prompt                        │
│    2. Chunked content (if too long)                     │
│    3. Skip item, alert WARNING                          │
│  Never: modify source data, guess values                │
│                                                         │
│  SCHEMA VALIDATION FAILS                                │
│  ───────────────────────                                │
│  Already handled by z.preprocess for known issues       │
│  New patterns: log full output, alert WARNING           │
│  Queue for human review, don't create bad rule          │
│                                                         │
│  PHASE TIMEOUT                                          │
│  ─────────────                                          │
│  if phase exceeds timeout:                              │
│    log incomplete items                                 │
│    continue to next phase                               │
│    alert WARNING with "incomplete" list                 │
│    retry incomplete items in next run                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recovery State Machine

```
           ┌─────────┐
           │ HEALTHY │
           └────┬────┘
                │ failure
                ▼
           ┌─────────┐
      ┌────│ RETRY_1 │
      │    └────┬────┘
      │         │ fail again
      │         ▼
      │    ┌─────────┐
      │    │ RETRY_2 │
      │    └────┬────┘
      │         │ fail again
      │         ▼
      │    ┌─────────┐
      │    │ RETRY_3 │
      │    └────┬────┘
      │         │ fail again
      │         ▼
      │    ┌─────────┐
      │    │ SKIPPED │──────► alert WARNING
      │    └────┬────┘
      │         │ 5 consecutive
      │         ▼
      │    ┌───────────┐
      │    │ SUSPENDED │──────► alert CRITICAL
      │    └───────────┘        (human must re-enable)
      │
      │ success at any point
      └──────────────────────► back to HEALTHY
```

### What We NEVER Auto-Do

- Delete or modify existing rules
- Approve rules without confidence check
- Re-enable suspended sources
- Change thresholds or configuration
- Retry indefinitely (max 4 attempts per item per day)

---

## 8. Complete System Overview

### Daily Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│  WATCHDOG DAILY SCHEDULE (Europe/Zagreb)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  06:00  ─── SCOUT PHASE ───────────────────────────────────     │
│         │   Check all 11+ endpoints for new items               │
│         │   Random 50-70s delay between each                    │
│         │   Timeout: 06:30                                      │
│         ▼                                                       │
│  06:30  ─── SCRAPE PHASE ──────────────────────────────────     │
│         │   Fetch discovered URLs                               │
│         │   Random 20-30s delay + per-domain jitter             │
│         │   Chunk large content (>4000 tokens)                  │
│         │   Timeout: 08:00                                      │
│         ▼                                                       │
│  ~07:00 ─── PROCESS PHASE ─────────────────────────────────     │
│         │   Extract → Compose → Review → Auto-Approve           │
│         │   3-4.5s rate limit with 10% long pauses              │
│         │   Build knowledge graph                               │
│         ▼                                                       │
│  ~07:30 ─── HEALTH CHECK ──────────────────────────────────     │
│         │   Run all health monitors                             │
│         │   Update WatchdogHealth table                         │
│         │   Raise alerts if thresholds breached                 │
│         ▼                                                       │
│  08:00  ─── DAILY DIGEST EMAIL ────────────────────────────     │
│              Summary of warnings, health status                 │
│                                                                 │
│  Random ─── AUDIT (1-2x daily) ────────────────────────────     │
│              Pick random run, trace 3-5 rules                   │
│              Score and report to Slack                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### New Database Tables

```
WatchdogHealth   - Current health status per check type
WatchdogAlert    - Alert history with acknowledgment
WatchdogAudit    - Audit run results and findings
```

### New Files to Create

```
src/lib/regulatory-truth/
├── watchdog/
│   ├── orchestrator.ts      # Main daemon, phase coordination
│   ├── health-monitors.ts   # All health check implementations
│   ├── alerting.ts          # Email + Slack notification logic
│   ├── audit.ts             # Random audit system
│   ├── recovery.ts          # Auto-recovery state machine
│   └── rate-limiter.ts      # Per-domain variable delays
├── scheduler/
│   └── cron.ts              # Updated with new schedule
```

### Environment Variables

```env
# Watchdog Configuration
WATCHDOG_ENABLED=true
WATCHDOG_TIMEZONE=Europe/Zagreb

# Timing
SCOUT_START_HOUR=6
SCOUT_TIMEOUT_MINUTES=30
SCRAPE_TIMEOUT_HOUR=8

# Alerting
ADMIN_ALERT_EMAIL=admin@fiskai.hr
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SLACK_CHANNEL=#fiskai-alerts

# Thresholds
STALE_SOURCE_WARNING_DAYS=7
STALE_SOURCE_CRITICAL_DAYS=14
FAILURE_RATE_WARNING=0.3
FAILURE_RATE_CRITICAL=0.5
```

---

## Design Decisions Summary

1. **Staggered Timing**: Random delays (50-70s scouts, 20-30s scrape) prevent IP bans
2. **Per-Domain Rate Limits**: Different delays per government site with 10% long pauses
3. **Content Chunking**: Split at 4000 tokens with 500 overlap for LLM extraction
4. **Three-Tier Alerts**: INFO (dashboard), WARNING (digest), CRITICAL (immediate)
5. **Slack Integration**: Audit results and critical alerts go to Slack
6. **Safe Recovery**: Retry 4x, then skip - never modify data automatically
7. **Daily Audits**: 1-2 random runs traced source-to-DB with quality scoring

---

_Design validated: 2025-12-22_
_Ready for implementation planning_
