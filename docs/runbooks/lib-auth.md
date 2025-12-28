# Authentication Library Failure Runbook

## Component
- **ID:** lib-auth
- **Type:** LIB
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/auth
- **Expected:** 200 OK with auth status

## Common Issues

### Issue 1: Session Validation Failures
**Symptoms:** Users logged out unexpectedly, session token invalid
**Resolution:**
1. Check NEXTAUTH_SECRET consistency across deployments
2. Verify session table in PostgreSQL
3. Review JWT token expiration settings
4. Check for clock drift between servers

### Issue 2: User Creation/Lookup Failures
**Symptoms:** New users cannot register, existing users not found
**Resolution:**
1. Check database connectivity
2. Review User table constraints
3. Check for email normalization issues
4. Verify unique constraint handling

### Issue 3: Role/Permission Checks Failing
**Symptoms:** Users getting 403 on authorized resources, role mismatch
**Resolution:**
1. Check systemRole assignment (USER, STAFF, ADMIN)
2. Review company-level role assignments
3. Check middleware authorization logic
4. Verify permission cache freshness

### Issue 4: Password Hashing Issues
**Symptoms:** Users cannot log in with correct passwords
**Resolution:**
1. Check bcrypt/argon2 library version
2. Verify hash comparison logic
3. Review password encoding
4. Check for migration issues

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/lib/auth/
- Dependencies: store-postgresql
- Critical Path: path-authentication
