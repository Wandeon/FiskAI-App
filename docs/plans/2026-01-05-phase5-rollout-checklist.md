# Phase 5: Enforcement Rollout Checklist

> **Created:** 2026-01-05
> **Status:** In Progress
> **Owner:** Engineering

## Prerequisites

Before enabling enforcement, ALL of these MUST be verified:

### Database State

- [ ] Run `npx tsx scripts/run-audit-integration-state.ts` - all checks return "READY"
- [ ] No SENT/DELIVERED EInvoices without integrationAccountId
- [ ] No COMPLETED FiscalRequests without integrationAccountId
- [ ] All companies with fiscalization enabled have active FISCALIZATION_CIS account
- [ ] All companies with e-invoicing enabled have active EINVOICE\_\* account

### Feature Flags (Staging)

- [ ] FF_INTEGRATION_ACCOUNT_OUTBOUND=true (active for 7+ days)
- [ ] FF_INTEGRATION_ACCOUNT_INBOUND=true (active for 7+ days)
- [ ] FF_INTEGRATION_ACCOUNT_FISCAL=true (active for 7+ days)

### Feature Flags (Production)

- [ ] FF_INTEGRATION_ACCOUNT_OUTBOUND=true (active for 7+ days)
- [ ] FF_INTEGRATION_ACCOUNT_INBOUND=true (active for 7+ days)
- [ ] FF_INTEGRATION_ACCOUNT_FISCAL=true (active for 7+ days)

### Error Metrics

- [ ] TenantViolationError count = 0 in last 7 days
- [ ] IntegrationNotFoundError count acceptable (< 1% of operations)
- [ ] E-invoice send success rate ≥ 99%
- [ ] Fiscalization success rate ≥ 99%

---

## Rollout Stages

### Stage 1: Staging Enforcement (24-48h)

1. **Enable enforcement in staging:**

   ```bash
   # Coolify or environment config
   FF_ENFORCE_INTEGRATION_ACCOUNT=true
   ```

2. **Monitor for 24-48 hours:**
   - Check logs for IntegrationRequiredError
   - Verify no TenantViolationError
   - Confirm all paths use V2 (integrationAccountId in logs)

3. **Acceptance criteria:**
   - Zero IntegrationRequiredError from legitimate operations
   - All workers successfully route to V2 path
   - E-invoice and fiscalization operations work normally

### Stage 2: Production Shadow Mode (24-48h)

1. **Enable shadow mode logging:**

   ```bash
   # Coolify or environment config
   FF_ENFORCE_INTEGRATION_ACCOUNT=false
   FF_LOG_LEGACY_PATH_USAGE=true
   ```

2. **Shadow mode behavior:**
   - Legacy paths continue to work (no user-facing impact)
   - Structured logs emitted for operations that WOULD have been blocked
   - Allows safe monitoring before enforcement

3. **Structured log format:**

   ```json
   {
     "level": "warn",
     "msg": "integration.legacy_path.would_block",
     "operation": "FISCALIZATION|EINVOICE_SEND|EINVOICE_RECEIVE|WORKER_JOB",
     "companyId": "cmp_xxx",
     "path": "legacy",
     "integrationAccountId": null,
     "reason": "No integrationAccountId provided",
     "shadowMode": true
   }
   ```

4. **Monitor and alert on:**
   - Log query: `msg = "integration.legacy_path.would_block"`
   - Group by: `operation`, `companyId`
   - Alert threshold: Any occurrence (should be zero)

5. **Acceptance criteria:**
   - **Zero** `integration.legacy_path.would_block` logs in 24-48h period
   - All new EInvoice records have integrationAccountId (V2 path)
   - All new FiscalRequest records have integrationAccountId (V2 path)
   - No legacy path fallbacks in worker jobs

6. **If shadow mode shows violations:**
   - Identify affected companies from logs
   - Create missing IntegrationAccounts
   - Backfill integrationAccountId on affected records
   - Re-run shadow mode observation period

### Stage 3: Production Hard-Fail (Permanent)

1. **Enable enforcement in production:**

   ```bash
   # Coolify environment
   FF_ENFORCE_INTEGRATION_ACCOUNT=true
   ```

2. **Immediate verification:**
   - Check error rates for first 15 minutes
   - Verify logs show no IntegrationRequiredError
   - Confirm operations complete successfully

3. **Rollback criteria (if needed):**
   - Any IntegrationRequiredError from legitimate user operations
   - Error rate exceeds 1%
   - TenantViolationError detected

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

If enforcement causes production issues:

1. **Disable enforcement flag:**

   ```bash
   # Coolify environment
   FF_ENFORCE_INTEGRATION_ACCOUNT=false
   ```

2. **Trigger deployment:**

   ```bash
   curl -X POST "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/restart" \
     -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)"
   ```

3. **Verify rollback:**
   - Check logs for legacy path usage (V1)
   - Confirm operations resume normally

### Post-Rollback Investigation

1. Identify which operations failed
2. Check for missing IntegrationAccounts
3. Backfill data if needed
4. Re-attempt enforcement after fix

---

## Monitoring Queries

### Real-time Error Monitoring

```sql
-- IntegrationRequiredError occurrences (check logs)
-- Monitor structured logs for:
-- { "name": "IntegrationRequiredError", "severity": "P0" }

-- Recent V1 vs V2 path usage
SELECT
    DATE_TRUNC('hour', "createdAt") as hour,
    COUNT(*) FILTER (WHERE "integrationAccountId" IS NOT NULL) as v2_path,
    COUNT(*) FILTER (WHERE "integrationAccountId" IS NULL) as v1_path
FROM "EInvoice"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

### Enforcement Readiness Dashboard

Run daily:

```bash
npx tsx scripts/check-integration-invariants.ts
```

Expected output before enforcement:

```
✅ All database invariants satisfied.
```

---

## Success Criteria

Phase 5 is COMPLETE when:

1. **FF_ENFORCE_INTEGRATION_ACCOUNT=true** in production
2. **Zero IntegrationRequiredError** from legitimate operations for 7+ days
3. **All integration operations** use IntegrationAccount (V2 path)
4. **Legacy paths are dead code** (blocked by enforcement)
5. **Tenant isolation enforced** by construction

---

## Sign-Off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Engineering Lead |      |      |           |
| DevOps           |      |      |           |
| Product Owner    |      |      |           |
