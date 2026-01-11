# Domain Ownership

> **Status**: Active
> **Last Updated**: 2026-01-11
> **Owner**: Platform Team

## Overview

This document defines the canonical domain architecture for FiskAI. It establishes which domains are active, which are forbidden, and the routing rules that apply.

## Canonical Domains

| Domain          | Purpose                   | Hosted On              | Status       |
| --------------- | ------------------------- | ---------------------- | ------------ |
| `app.fiskai.hr` | Application (all portals) | Coolify/VPS-01         | **ACTIVE**   |
| `www.fiskai.hr` | Marketing site            | Cloudflare Pages       | **ACTIVE**   |
| `fiskai.hr`     | Apex redirect             | Cloudflare (301 → www) | **REDIRECT** |

## Forbidden Domains (DO NOT CREATE)

These subdomains have been permanently retired. DNS records do not exist and must never be created.

| Domain              | Reason                     | Replacement           |
| ------------------- | -------------------------- | --------------------- |
| `admin.fiskai.hr`   | Security surface reduction | `app.fiskai.hr/admin` |
| `staff.fiskai.hr`   | Security surface reduction | `app.fiskai.hr/staff` |
| `api.fiskai.hr`     | Not needed                 | `app.fiskai.hr/api`   |
| `staging.fiskai.hr` | Use separate environment   | N/A                   |

## Routing Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Cloudflare DNS            │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              fiskai.hr      www.fiskai.hr    app.fiskai.hr
                    │               │               │
                    │               │               │
              ┌─────┴─────┐         │               │
              │           │         │               │
              ▼           │         ▼               ▼
         301 Redirect     │   Cloudflare       Coolify/VPS-01
         to www ──────────┘     Pages          (Next.js App)
                                    │               │
                                    ▼               ▼
                              Marketing        Application
                                Site           ├── /auth
                                               ├── /admin/*
                                               ├── /staff/*
                                               └── /*
```

## Path-Based Portal Routing

All application portals are served from `app.fiskai.hr` with path prefixes:

| Path       | Portal           | Access             |
| ---------- | ---------------- | ------------------ |
| `/`        | Client dashboard | USER, STAFF, ADMIN |
| `/admin/*` | Admin portal     | ADMIN only         |
| `/staff/*` | Staff portal     | STAFF, ADMIN       |
| `/auth`    | Authentication   | Public             |
| `/api/*`   | API endpoints    | Various            |

## DNS Records (Cloudflare)

### Required Records

```
A     fiskai.hr        → Cloudflare (proxied)
A     www.fiskai.hr    → Cloudflare Pages (proxied)
A     app.fiskai.hr    → 152.53.146.3 (proxied)
```

### Forbidden Records

The following DNS records must NOT exist:

- `admin.fiskai.hr` - NXDOMAIN
- `staff.fiskai.hr` - NXDOMAIN
- `api.fiskai.hr` - NXDOMAIN
- `*.fiskai.hr` (wildcard) - NEVER

## Cloudflare Configuration

### Page Rules / Redirect Rules

1. **Apex to WWW redirect**:
   - Match: `fiskai.hr/*`
   - Action: 301 Redirect to `https://www.fiskai.hr/$1`

### SSL/TLS

- Mode: Full (strict)
- Always Use HTTPS: Enabled
- Automatic HTTPS Rewrites: Enabled

## Coolify Configuration

### Application: fiskai-app-image

- **UUID**: `tgg4gkcco8k8s0wwg08cck40`
- **FQDN**: `https://app.fiskai.hr` (ONLY)
- **Image**: `ghcr.io/wandeon/fiskai-app:<sha>` (pinned to commit SHA)
- **Build Pack**: Docker Image (NOT Dockerfile)

### Traefik Labels

The application should only have routing rules for `app.fiskai.hr`. No other Host() rules should exist.

## Verification Commands

```bash
# Verify DNS records
dig +short app.fiskai.hr A      # Should return Cloudflare IPs
dig +short admin.fiskai.hr A    # Should return empty (NXDOMAIN)
dig +short staff.fiskai.hr A    # Should return empty (NXDOMAIN)

# Verify routing
curl -sI https://fiskai.hr/           # Should 301 → www.fiskai.hr
curl -sI https://app.fiskai.hr/api/health  # Should 200 OK
curl -sI https://admin.fiskai.hr/    # Should fail (no DNS)

# Verify Coolify config
curl -s "http://localhost:8000/api/v1/applications/<uuid>" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" | jq '.fqdn'
# Should return: "https://app.fiskai.hr"
```

## Code References

### Portal URL Generation

All cross-portal URLs are generated via `src/lib/portal-urls.ts`:

```typescript
// Correct usage
getAdminUrl("/tenants") // → https://app.fiskai.hr/admin/tenants
getStaffUrl("/clients") // → https://app.fiskai.hr/staff/clients
getAppUrl("/dashboard") // → https://app.fiskai.hr/dashboard
```

### Middleware

The middleware at `src/middleware.ts` handles:

- Authentication redirects to `/auth`
- Role-based access control for `/admin/*` and `/staff/*` paths
- Public path exceptions (`/auth`, `/login`, `/api/health`, etc.)

## Historical Context

### Why Legacy Subdomains Were Removed (2026-01)

1. **Security**: Each subdomain is an attack surface (SSL certs, cookie scope, CORS)
2. **Complexity**: Managing multiple Traefik rules and DNS records
3. **Cost**: SSL certificate management for multiple subdomains
4. **Confusion**: Users bookmarking different URLs for same content

### Migration Path

1. DNS records for `admin.fiskai.hr` and `staff.fiskai.hr` deleted
2. Middleware updated to redirect legacy subdomains (while DNS existed)
3. Portal URL helpers updated to generate path-based URLs
4. Coolify FQDN list reduced to single domain

## Compliance

This domain architecture supports:

- GDPR (single cookie domain simplifies consent)
- Croatian fiscalization requirements (single origin for API calls)
- SOC 2 (reduced attack surface)

## Related Documents

- [MARKETING_SEPARATION.md](../operations/MARKETING_SEPARATION.md) - Marketing site separation
- [BUILD_AUTHORITY.md](../operations/BUILD_AUTHORITY.md) - Build and deployment process
- [RESTORE_COOLIFY_AUTHORITY.md](../operations/RESTORE_COOLIFY_AUTHORITY.md) - Coolify configuration
