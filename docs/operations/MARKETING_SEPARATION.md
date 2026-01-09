# Marketing Site Separation Operations Runbook

> Last Updated: 2026-01-09

## Architecture Overview

FiskAI uses a split architecture with two separate deployments:

| Component | URL | Hosting | Repository |
|-----------|-----|---------|------------|
| Marketing Site | www.fiskai.hr | SiteGround (static) | fiskai-marketing |
| Application | app.fiskai.hr | Coolify (Docker) | FiskAI |

### Domain Architecture

```
fiskai.hr (root)          → SiteGround (marketing)
www.fiskai.hr             → SiteGround (marketing)
app.fiskai.hr             → Coolify (Next.js app)
  ├─ /admin/*             → Admin portal (ADMIN role)
  ├─ /staff/*             → Staff portal (STAFF role)
  └─ /*                   → Client dashboard (all roles)
```

### Discontinued Subdomains
The following subdomains have been **permanently removed** (DNS records deleted):
- `admin.fiskai.hr` - No longer exists. Use `app.fiskai.hr/admin` instead
- `staff.fiskai.hr` - No longer exists. Use `app.fiskai.hr/staff` instead

**Note**: With DNS deleted, these hostnames will not resolve. Users with old bookmarks will see DNS errors, not redirects. The middleware redirect logic exists only to handle any cached DNS resolution.

## Marketing Site (fiskai-marketing repo)

### Repository
- GitHub: https://github.com/Wandeon/fiskai-marketing
- Static export: `output: "export"` in next.config.ts

### Deployment
- **Platform**: SiteGround via FTP
- **Trigger**: Push to main branch
- **Workflow**: `.github/workflows/deploy.yml`

### FTP Configuration (GitHub Actions Secrets)
```yaml
# .github/workflows/deploy.yml uses these secrets:
server: ${{ secrets.SITEGROUND_SFTP_HOST }}  # SiteGround FTP hostname
username: ${{ secrets.SITEGROUND_SFTP_USER }}  # bot@fiskai.hr
password: ${{ secrets.SITEGROUND_SFTP_PASSWORD }}
port: 21  # Standard FTP, not SFTP
local-dir: ./out/
server-dir: ./fiskai.hr/public_html/
```

**Important**: Secrets are stored in the fiskai-marketing repo's GitHub Settings → Secrets.

### Manual Deployment
```bash
cd /tmp/fiskai-marketing
npm run build
# Result: ./out/ directory with static files
# Upload ./out/* to ./fiskai.hr/public_html/ via FTP
```

### Auth Redirects
Marketing site has stub pages that redirect to app.fiskai.hr for auth:
- `/login` → Redirects to `app.fiskai.hr/login`
- `/register` → Redirects to `app.fiskai.hr/register`
- `/forgot-password` → Redirects to `app.fiskai.hr/forgot-password`

## Main Application (FiskAI repo)

### Repository
- GitHub: https://github.com/Wandeon/FiskAI
- Docker deployment via Coolify

### Deployment
- **Platform**: Coolify at ci.fiskai.hr
- **Application UUID**: `bsswgo8ggwgkw8c88wo8wcw8`
- **Trigger**: Push to main or manual deploy

### Deploy Commands (Local Development Only)

**Note**: These commands require `COOLIFY_API_TOKEN` in your local `.env` file.
Do not use in CI - the token should never be committed or logged.

```bash
# Trigger deployment (run from project root with .env present)
curl -X POST "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# Check deployment status
curl -s "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" | jq '.status'
```

To set the token for a session: `export COOLIFY_API_TOKEN=$(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)`

### Role-Based Access
Access control is path-based, not subdomain-based:

| Path | Required Role | Notes |
|------|---------------|-------|
| `/admin/*` | ADMIN | Platform administration |
| `/staff/*` | STAFF or ADMIN | Multi-client workspace |
| `/*` | Any authenticated | Client dashboard |

Implementation in `src/lib/middleware/subdomain.ts`:
```typescript
export function canAccessPath(systemRole: string, pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return systemRole === "ADMIN"
  }
  if (pathname.startsWith("/staff")) {
    return systemRole === "STAFF" || systemRole === "ADMIN"
  }
  return true // All other paths accessible by all authenticated users
}
```

## Troubleshooting

### Marketing site shows old content
1. Check GitHub Actions for deploy status
2. Verify FTP credentials haven't expired
3. Manually trigger redeploy

### Auth redirect loops
1. Check marketing site's redirect pages are deployed
2. Verify app.fiskai.hr auth routes are working
3. Check NextAuth configuration

### Legacy subdomain access (discontinued)
The legacy subdomains (admin.fiskai.hr, staff.fiskai.hr) have been permanently removed.
- **Expected behavior**: DNS lookup fails, browser shows "site cannot be reached"
- **User impact**: Users with old bookmarks need updated URLs:
  - `admin.fiskai.hr` → `app.fiskai.hr/admin`
  - `staff.fiskai.hr` → `app.fiskai.hr/staff`

If a user reports they can still access legacy subdomains, check for stale DNS caching on their end.

### Application 404s on /admin or /staff
1. Verify pages exist in `src/app/admin/` and `src/app/staff/`
2. Check user has correct `systemRole` in database
3. Verify middleware allows the path

## DNS Records (Cloudflare)

| Name | Type | Value | Proxy |
|------|------|-------|-------|
| @ | A | SiteGround IP | Proxied |
| www | CNAME | @ | Proxied |
| app | A | 152.53.146.3 | Proxied |
| ci | A | 152.53.146.3 | DNS only |

### Deleted Records
- `admin` - Was CNAME to app
- `staff` - Was CNAME to app

## Contacts

- **SiteGround**: Account under main email
- **Coolify**: Self-hosted at ci.fiskai.hr
- **Cloudflare**: DNS management

## Related Documents

- [CLAUDE.md](../../CLAUDE.md) - Project context and deployment commands
- [fiskai-marketing/BOUNDARY_CONTRACT.md](https://github.com/Wandeon/fiskai-marketing/blob/main/BOUNDARY_CONTRACT.md) - Marketing repo contract
