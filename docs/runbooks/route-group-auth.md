# Auth API Failure Runbook

## Component
- **ID:** route-group-auth
- **Type:** ROUTE_GROUP
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/auth
- **Expected:** 200 OK

## Common Issues

### Issue 1: Login Failures (401/500)
**Symptoms:** Users unable to log in, receiving 401 Unauthorized or 500 errors
**Resolution:**
1. Check NextAuth configuration in environment variables
2. Verify NEXTAUTH_SECRET is set and consistent across deployments
3. Check database connectivity for session storage
4. Review auth provider (credentials/OAuth) configuration

### Issue 2: Session Expiration Issues
**Symptoms:** Users logged out unexpectedly, session not persisting
**Resolution:**
1. Check session cookie settings (domain, secure, sameSite)
2. Verify session table in PostgreSQL is not corrupted
3. Review JWT expiration settings if using JWT strategy
4. Check for clock drift between servers

### Issue 3: OAuth Provider Failures
**Symptoms:** Social login not working, OAuth callbacks failing
**Resolution:**
1. Verify OAuth client ID and secret are valid
2. Check callback URL configuration matches provider settings
3. Review CORS and redirect URI whitelist
4. Check provider API status (Google, GitHub, etc.)

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/app/api/auth/
- Dependencies: lib-auth, store-postgresql
- Critical Path: path-authentication
- SLO: 99.99% uptime, <500ms login latency
