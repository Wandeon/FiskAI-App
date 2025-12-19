# Admin Route Group

This route group contains the admin portal pages that will be accessible at the root domain when the user accesses via the `admin.fiskai.hr` subdomain.

## Implementation Status

- [x] Route group structure created (Task 4.4)
- [x] Layout with placeholder sidebar/header
- [x] Placeholder pages (overview, tenants, staff)
- [ ] Middleware-based routing (Phase 3, Task 3.5)
- [ ] Admin components (Phase 6)

## Pages

- `/` - Admin overview/dashboard (placeholder)
- `/tenants` - Tenant management (existing functionality migrated)
- `/staff` - Staff management (placeholder)

## Activation

This route group will be activated in **Phase 3, Task 3.5** when subdomain-based middleware routing is implemented.

Until then, these pages won't be accessible to avoid route conflicts with (marketing) and (app) route groups.
