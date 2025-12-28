# PostgreSQL Database Failure Runbook

## Component
- **ID:** store-postgresql
- **Type:** STORE
- **Owner:** team:platform

## Health Check
- **Command:** pg_isready -h localhost -p 5432
- **Expected:** "accepting connections"

## Common Issues

### Issue 1: Database Unreachable
**Symptoms:** All services failing with connection errors, 500 errors
**Resolution:**
1. Check PostgreSQL container: `docker ps | grep fiskai-db`
2. Check container logs: `docker logs fiskai-db --tail 100`
3. Verify network connectivity to port 5432
4. Restart container if needed: `docker restart fiskai-db`

### Issue 2: Connection Pool Exhaustion
**Symptoms:** Intermittent connection failures, "too many connections" errors
**Resolution:**
1. Check current connections: `SELECT count(*) FROM pg_stat_activity`
2. Review connection pool settings in DATABASE_URL
3. Check for connection leaks in application
4. Increase max_connections if appropriate

### Issue 3: Disk Space Exhaustion
**Symptoms:** Write operations failing, database read-only mode
**Resolution:**
1. Check disk usage: `docker exec fiskai-db df -h`
2. Identify large tables: `SELECT pg_size_pretty(pg_total_relation_size(relid))`
3. Clean up old data if safe
4. Expand disk volume if needed

### Issue 4: Slow Queries
**Symptoms:** Requests timing out, high latency across services
**Resolution:**
1. Check slow query log
2. Review query execution plans with EXPLAIN ANALYZE
3. Add missing indexes
4. Consider query optimization or caching

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: prisma/schema.prisma
- Dependents: Most services depend on PostgreSQL
- Critical Paths: path-authentication, path-fiscalization, path-billing
- Model Count: 82 Prisma models
