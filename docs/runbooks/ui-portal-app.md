# Client App Portal Failure Runbook

## Component
- **ID:** ui-portal-app
- **Type:** UI
- **Owner:** team:frontend

## Health Check
- **Endpoint:** /api/health/app
- **Expected:** 200 OK

## Common Issues

### Issue 1: Portal Unreachable (502/503)
**Symptoms:** Users cannot access app.fiskai.hr, browser shows 502 Bad Gateway or 503 Service Unavailable
**Resolution:**
1. Check Next.js server status: `docker logs fiskai-app --tail 100`
2. Verify Cloudflare proxy status at Cloudflare dashboard
3. Check nginx/traefik reverse proxy configuration
4. Restart application container if needed: `docker restart fiskai-app`

### Issue 2: Authentication Failures
**Symptoms:** Users redirected to login repeatedly, session not persisting
**Resolution:**
1. Verify NextAuth configuration and NEXTAUTH_SECRET
2. Check lib-auth component health
3. Verify PostgreSQL session table connectivity
4. Check cookie domain settings for app.fiskai.hr

### Issue 3: Slow Page Loads
**Symptoms:** Pages taking >3s to load, high TTFB
**Resolution:**
1. Check database connection pool exhaustion
2. Review server-side rendering performance
3. Check Redis cache hit rates
4. Monitor memory usage in container

## Escalation
- Primary: team:frontend
- Backup: #ops-critical

## References
- Architecture: docs/product-bible/05-UI-EXPERIENCE.md
- Code: src/app/(app)/
- Dependencies: lib-auth, lib-modules, lib-visibility, store-postgresql
