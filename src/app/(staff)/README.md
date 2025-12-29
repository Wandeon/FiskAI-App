# Staff Route Group

This route group contains the staff portal pages accessible via the `staff.fiskai.hr` subdomain.

## Implementation Status

- [x] Route group structure created (Task 4.3)
- [x] Layout with placeholder sidebar/header
- [x] Placeholder pages (clients list, overview)
- [x] Middleware-based routing (Phase 3, Task 3.5)
- [ ] Staff components (Phase 5)

## Pages

- `/staff-dashboard` - Staff overview/dashboard (placeholder)
- `/clients` - Assigned clients list (placeholder)
- `/invitations` - Staff invitations management

## Routing

Subdomain-based middleware routing is **active**. The middleware in `/src/middleware.ts`:

1. Detects `staff.fiskai.hr` subdomain via `getSubdomain()`
2. Requires authentication (redirects to login if not authenticated)
3. Validates user has STAFF or ADMIN systemRole via `canAccessSubdomain()`
4. Rewrites requests to the `(staff)` route group

See `/src/lib/middleware/subdomain.ts` for subdomain utilities.
