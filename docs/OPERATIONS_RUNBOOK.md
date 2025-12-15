# Operations Runbook

## Quick Reference

| Issue | Check | Action |
|-------|-------|--------|
| App down | `/api/health` returns 503 | Check database, restart pod |
| High latency | `/api/health/ready` slow | Check DB connections, scale up |
| Disk full | Health check warning | Clean logs, archive old data |
| Data export needed | N/A | Use `/reports/export` or API |

---

## Health Check Endpoints

### Liveness: GET /api/health
- **Purpose**: Is the app alive?
- **Check frequency**: Every 30s
- **Timeout**: 10s
- **Failure action**: Restart container

### Readiness: GET /api/health/ready
- **Purpose**: Can the app receive traffic?
- **Check frequency**: Every 5s
- **Timeout**: 3s
- **Failure action**: Remove from load balancer (don't restart)

### Status: GET /api/status
- **Purpose**: Detailed metrics for monitoring
- **Contains**: Version, uptime, system metrics, database stats

---

## Incident Response

### P0: Application Down

**Symptoms**: 503 errors, health checks failing

**Diagnosis**:
```bash
# Check application logs
docker logs fiskai-app --tail 100

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check disk space
df -h

# Check memory
free -m
```

**Resolution**:
1. If database down: Restart database, check connection pool
2. If memory exhausted: Restart app, investigate memory leak
3. If disk full: Clear `/tmp`, archive old logs, clean uploads

### P1: High Latency

**Symptoms**: Slow responses, health/ready returning 503

**Diagnosis**:
```bash
# Check database latency
curl -w "@curl-timing.txt" http://localhost:3000/api/health

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"
```

**Resolution**:
1. If DB latency high: Check indexes, optimize queries, increase pool size
2. If too many connections: Restart app to reset pool
3. If sustained load: Scale horizontally

### P2: Disk Space Warning

**Symptoms**: Health check shows >80% disk usage

**Resolution**:
```bash
# Find large files
du -sh /var/log/* | sort -rh | head -10

# Clean old logs
find /var/log -name "*.log" -mtime +30 -delete

# Archive old uploads (if applicable)
# Note: Invoices must be retained for 11 years per Croatian law
```

---

## Backup Procedures

### Manual Data Export

Users can export their data via:
- Dashboard: `/reports/export`
- API: `GET /api/exports/season-pack?from=YYYY-MM-DD&to=YYYY-MM-DD`

Export includes:
- Invoices (CSV + PDF)
- Expenses (CSV)
- KPR (Knjiga Primitaka i Izdataka)
- Summary with totals

### Database Backup

**Daily automated backup** (configure in production):
```bash
# Backup command
pg_dump $DATABASE_URL --format=custom --file=backup-$(date +%Y%m%d).dump

# Retention: 30 days
find /backups -name "*.dump" -mtime +30 -delete
```

**Restore from backup**:
```bash
# Restore (CAUTION: overwrites existing data)
pg_restore --clean --if-exists -d $DATABASE_URL backup-YYYYMMDD.dump
```

### Backup Verification

Monthly restore drill:
1. Create test database
2. Restore latest backup
3. Verify row counts match production
4. Run sanity checks on restored data
5. Document results

---

## Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Fiscalized invoices | 11 years | Croatian law |
| Non-fiscal invoices | 7 years | Accounting standards |
| Expenses | 7 years | Tax documentation |
| Audit logs | 3 years | Compliance |
| Session data | 30 days | Security |
| Temp files | 24 hours | Cleanup |

---

## Security Incidents

### Suspected Data Breach

1. **Contain**: Disable affected user accounts
2. **Investigate**: Check audit logs for unauthorized access
3. **Notify**: GDPR requires notification within 72 hours
4. **Remediate**: Reset credentials, patch vulnerability
5. **Document**: Full incident report

### Audit Log Queries

```sql
-- Recent changes by user
SELECT * FROM "AuditLog"
WHERE "userId" = 'xxx'
ORDER BY "createdAt" DESC
LIMIT 100;

-- Changes to specific record
SELECT * FROM "AuditLog"
WHERE "entityType" = 'EInvoice'
AND "entityId" = 'xxx';

-- Failed actions (if tracked)
SELECT * FROM "AuditLog"
WHERE action LIKE '%failed%'
AND "createdAt" > NOW() - INTERVAL '24 hours';
```

---

## Monitoring Alerts

### Recommended Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | >2s | >5s |
| Error rate | >1% | >5% |
| Database latency | >500ms | >2000ms |
| Disk usage | >80% | >90% |
| Memory usage | >80% | >95% |
| Failed logins (per IP) | >5/min | >20/min |

### Setting Up Alerts

Configure in your monitoring system (Prometheus, Datadog, etc.):

```yaml
# Example Prometheus alert
groups:
  - name: fiskai
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

---

## Contact Information

- **On-call**: [Configure escalation policy]
- **Database issues**: [DBA contact]
- **Security incidents**: security@fiskai.hr
- **GDPR requests**: gdpr@fiskai.hr

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Initial runbook created | Claude |
