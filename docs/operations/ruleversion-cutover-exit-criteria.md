# RuleVersion Migration Exit Criteria

**Purpose:** Define objective criteria for completing the RuleVersion migration from core to regulatory schema.

**Last Updated:** 2026-01-04

## Migration Phases

### Phase 1: Dual Mode (Staging)

| Criterion                   | Requirement                                          | Evidence         |
| --------------------------- | ---------------------------------------------------- | ---------------- |
| Dual mode enabled           | `RULE_VERSION_SOURCE=dual`                           | Coolify env vars |
| Metrics endpoint accessible | `/api/health/ruleversion-dual` returns 200 for ADMIN | Curl response    |
| Staging window start        | Timestamp when dual mode deployed                    | Deployment log   |
| Staging window end          | Minimum 4 hours after start                          | Clock            |
| Mismatches                  | `mismatches.total == 0`                              | Metrics endpoint |
| Missing records             | `missing.inCore == 0 && missing.inRegulatory == 0`   | Metrics endpoint |
| Structured logs clean       | No `parity_mismatch` or `parity_missing` events      | Log search       |

### Phase 2: Dual Mode (Production)

| Criterion               | Requirement                                        | Evidence            |
| ----------------------- | -------------------------------------------------- | ------------------- |
| Dual mode enabled       | `RULE_VERSION_SOURCE=dual`                         | Coolify env vars    |
| Production window start | Timestamp when dual mode deployed                  | Deployment log      |
| Production window end   | Minimum 24 hours after start                       | Clock               |
| Mismatches              | `mismatches.total == 0`                            | Metrics endpoint    |
| Missing records         | `missing.inCore == 0 && missing.inRegulatory == 0` | Metrics endpoint    |
| Real workload executed  | See Required Flows below                           | Manual verification |

### Phase 3: Regulatory Mode (Production)

| Criterion               | Requirement                            | Evidence         |
| ----------------------- | -------------------------------------- | ---------------- |
| Regulatory mode enabled | `RULE_VERSION_SOURCE=regulatory`       | Coolify env vars |
| App stability           | No errors related to RuleVersion reads | Application logs |
| Stability window        | Minimum 48 hours                       | Clock            |

---

## Required Flows Executed

Before flipping to `regulatory` mode, these flows MUST be executed and verified:

- [ ] **Payout Generation** - At least one full payout calculated with tax rules
- [ ] **JOPPD Submission** - At least one JOPPD form generated using rule tables
- [ ] **Tax Preview** - At least one tax calculation preview using effective rules
- [ ] **Audit Endpoint** - `/api/health/ruleversion-dual` queried and shows healthy

---

## Production Rollout Plan

### Step 1: Enable Dual Mode

```bash
# Set env var
RULE_VERSION_SOURCE=dual

# Deploy via Coolify
curl -X POST ".../applications/.../start" -d '{"force": true}'
```

### Step 2: Monitor (24h minimum)

```bash
# Poll metrics every 30 minutes
watch -n 1800 'curl -s https://fiskai.hr/api/health/ruleversion-dual | jq ".healthy, .metrics.mismatches.total"'

# Search logs for parity events
grep -E "parity_mismatch|parity_missing" /var/log/app/*.log
```

### Step 3: Flip to Regulatory

```bash
# Set env var (only after all criteria met)
RULE_VERSION_SOURCE=regulatory

# Deploy
curl -X POST ".../applications/.../start" -d '{"force": true}'
```

### Step 4: Monitor Stability (48h)

- Watch application logs for RuleVersion errors
- Verify all flows still work correctly

---

## Rollback Plan

### Immediate Rollback (< 1 minute)

```bash
# Set env var back to core
RULE_VERSION_SOURCE=core

# Redeploy
curl -X POST ".../applications/.../start" -d '{"force": true}'
```

### Rollback Triggers

- Any `parity_mismatch` events in dual mode
- Any application errors related to RuleVersion reads
- Missing rules causing calculation failures
- User-reported issues with tax calculations

### Rollback Does NOT Require

- Database changes (data exists in both schemas)
- Code changes (compatibility layer handles both)
- Downtime (environment variable change + redeploy)

---

## Cleanup Gate

**PR#11 (Core RuleVersion Retirement) may ONLY be merged when:**

1. Production has been on `RULE_VERSION_SOURCE=regulatory` for at least 48 hours
2. Zero mismatches recorded during entire dual-mode period
3. Zero application errors related to RuleVersion reads
4. All required flows executed successfully
5. Sign-off from platform owner

**PR#11 contains:**

- Removal of core RuleVersion bundle models from `prisma/schema.prisma`
- Removal of `db.ruleVersion` imports outside compatibility store
- CI guardrail preventing regression

---

## Checklist

### Staging Dual Mode

- [ ] `RULE_VERSION_SOURCE=dual` deployed
- [ ] Window start: ****\_\_\_\_****
- [ ] Window end: ****\_\_\_\_****
- [ ] `healthy: true` confirmed
- [ ] `mismatches.total: 0` confirmed
- [ ] Logs clean (no parity events)

### Production Dual Mode

- [ ] `RULE_VERSION_SOURCE=dual` deployed
- [ ] Window start: ****\_\_\_\_****
- [ ] Window end: ****\_\_\_\_****
- [ ] Payout generation verified
- [ ] JOPPD submission verified
- [ ] `healthy: true` confirmed
- [ ] `mismatches.total: 0` confirmed
- [ ] Logs clean (no parity events)

### Production Regulatory Mode

- [ ] `RULE_VERSION_SOURCE=regulatory` deployed
- [ ] Stability window start: ****\_\_\_\_****
- [ ] Stability window end: ****\_\_\_\_****
- [ ] No application errors
- [ ] All flows working

### Cleanup

- [ ] All exit criteria met
- [ ] Platform owner sign-off
- [ ] PR#11 merged
- [ ] Core tables dropped (separate migration)

---

## Contacts

- **Primary:** DevOps Team
- **Escalation:** Backend Engineering Lead
- **Sign-off Authority:** Platform Owner
