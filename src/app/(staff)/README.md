# Staff Route Group

This route group contains the staff portal pages that will be accessible at the root domain when the user accesses via the `staff.fiskai.hr` subdomain.

## Implementation Status

- [x] Route group structure created (Task 4.3)
- [x] Layout with placeholder sidebar/header
- [x] Placeholder pages (clients list, overview)
- [ ] Middleware-based routing (Phase 3, Task 3.5)
- [ ] Staff components (Phase 5)

## Pages

- `/` - Staff overview/dashboard (placeholder)
- `/clients` - Assigned clients list (placeholder)

## Activation

This route group will be activated in **Phase 3, Task 3.5** when subdomain-based middleware routing is implemented.

Until then, these pages won't be accessible to avoid route conflicts with (marketing) and (app) route groups.
