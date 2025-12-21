# Regulatory Truth Layer - Quick Start Guide

## Initial Setup

### 1. Run Bootstrap (First Time Only)

```bash
npx tsx src/lib/regulatory-truth/scripts/bootstrap.ts
```

This will:

- Seed all 90+ regulatory sources
- Collect evidence from critical sources
- Extract data points
- Create and review initial rules
- Publish first release

**Expected Duration:** 20-30 minutes

---

## Daily Operations

### Monitor Critical Sources (T0)

```bash
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline
```

Run this **daily** to check:

- VAT thresholds
- Pausalni revenue limits
- Exchange rates (HNB)
- Critical tax deadlines

---

## Weekly Operations

### Monitor High Priority Sources (T1)

```bash
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T1 --pipeline
```

Run this **weekly** (Monday mornings) to check:

- Contribution rates (HZMO, HZZO)
- Fiscalization requirements
- Tax regulations

---

## Monthly Operations

### Monitor Medium/Low Priority Sources (T2/T3)

```bash
npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T2 --pipeline
```

Run this **monthly** (1st of month) to check:

- Tax authority guidance
- Chamber fees
- Interpretations

---

## Monitoring & Health

### Check Pipeline Status

```bash
curl http://localhost:3000/api/admin/regulatory-truth/status \
  -H "Cookie: <your-session-cookie>"
```

Or visit: `https://admin.fiskai.hr/regulatory-truth/status` (when UI is built)

### Key Metrics to Watch

- **Health Score:** Should be ≥ 80 (green)
- **Sources Needing Check:** Should be < 10
- **Agent Failure Rate:** Should be < 5%
- **Pending Reviews:** Check for T0/T1 rules needing human approval

---

## Individual Agent Commands

### Run Sentinel (Evidence Collection)

```bash
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts porezna-pausalno
```

### Run Extractor (Data Point Extraction)

```bash
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts <evidence-id>
```

### Seed Sources

```bash
npx tsx src/lib/regulatory-truth/scripts/seed-sources.ts
```

---

## Cron Setup (Automated)

Add to crontab (`crontab -e`):

```bash
# Daily T0 critical sources at 6 AM
0 6 * * * cd /home/admin/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline >> /var/log/fiskai/monitor-t0.log 2>&1

# Weekly T1 high priority at 7 AM Monday
0 7 * * 1 cd /home/admin/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T1 --pipeline >> /var/log/fiskai/monitor-t1.log 2>&1

# Monthly T2/T3 at 8 AM on 1st
0 8 1 * * cd /home/admin/FiskAI && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T2 --pipeline >> /var/log/fiskai/monitor-t2.log 2>&1
```

---

## Troubleshooting

### Check Recent Agent Runs

```sql
SELECT "agentType", status, COUNT(*)
FROM "AgentRun"
WHERE "startedAt" > NOW() - INTERVAL '24 hours'
GROUP BY "agentType", status;
```

### Check Sources Needing Review

```sql
SELECT COUNT(*) FROM "RegulatorySource"
WHERE "isActive" = true
  AND "lastFetchedAt" < NOW() - ("fetchIntervalHours" || ' hours')::INTERVAL;
```

### Check Pending Rules

```sql
SELECT "riskTier", COUNT(*)
FROM "RegulatoryRule"
WHERE status IN ('DRAFT', 'PENDING_REVIEW')
GROUP BY "riskTier";
```

### View Latest Release

```sql
SELECT version, "releasedAt",
       (SELECT COUNT(*) FROM "RegulatoryRule" WHERE "releaseId" = r.id) as rules_count
FROM "RuleRelease" r
ORDER BY "releasedAt" DESC
LIMIT 1;
```

---

## Priority Reference

| Priority | Interval       | When to Run       | Auto-Approve?               |
| -------- | -------------- | ----------------- | --------------------------- |
| **T0**   | Daily (24h)    | Every day 6 AM    | Never - always human review |
| **T1**   | Weekly (168h)  | Monday 7 AM       | Never - always human review |
| **T2**   | Monthly (720h) | 1st of month 8 AM | Yes if confidence ≥ 0.95    |
| **T3**   | Monthly (720h) | 1st of month 8 AM | Yes if confidence ≥ 0.90    |

---

## Command Options

### monitor.ts

```bash
--priority=T0|T1|T2|T3   # Filter by priority
--max=50                  # Limit number of sources
--pipeline                # Run full pipeline (compose, review)
```

---

## Health Score Interpretation

| Score  | Status   | Action Required                        |
| ------ | -------- | -------------------------------------- |
| 80-100 | Healthy  | None - system operating normally       |
| 60-79  | Warning  | Review pending items, check error logs |
| 0-59   | Critical | Immediate attention required           |

---

## File Locations

- **Scripts:** `/home/admin/FiskAI/src/lib/regulatory-truth/scripts/`
- **Agents:** `/home/admin/FiskAI/src/lib/regulatory-truth/agents/`
- **API:** `/home/admin/FiskAI/src/app/api/admin/regulatory-truth/`
- **Docs:** `/home/admin/FiskAI/docs/regulatory-truth-*.md`
- **Logs:** `/var/log/fiskai/` (recommended)

---

## Support

For detailed documentation, see:

- `/home/admin/FiskAI/src/lib/regulatory-truth/scripts/README.md`
- `/home/admin/FiskAI/docs/regulatory-truth-monitoring-implementation.md`
