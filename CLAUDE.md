# FiskAI Project Notes

## Domains & Architecture

**Domain:** `fiskai.hr` (Cloudflare-managed, primary)
**Legacy:** `fiskai.eu` (redirects to fiskai.hr)

| Portal       | URL               | Audience             | Purpose                 |
| ------------ | ----------------- | -------------------- | ----------------------- |
| Marketing    | `fiskai.hr`       | Public               | Landing, guides, auth   |
| Client App   | `app.fiskai.hr`   | Clients              | Business dashboard      |
| Staff Portal | `staff.fiskai.hr` | Internal accountants | Multi-client workspace  |
| Admin Portal | `admin.fiskai.hr` | Platform owner       | Tenant/staff management |

**SystemRole Enum:** `USER` | `STAFF` | `ADMIN` (separate from per-company roles)

## Deployment

**Server:** `152.53.146.3` (Hetzner ARM64)

**Coolify Dashboard:** https://git.metrica.hr

**Deploy API:**

```bash
curl -X POST "http://152.53.146.3:8000/api/v1/deploy?uuid=bsswgo8ggwgkw8c88wo8wcw8&force=true" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>"
```

**GitHub Webhook (auto-deploy):**

```
http://152.53.146.3:8000/webhooks/source/github/events/manual
```

**Update environment variables:**

```bash
curl -X PATCH "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/envs" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY_NAME", "value": "value"}'
```

## Database

**Container:** `fiskai-db` (PostgreSQL 16)

**Access:**

```bash
docker exec fiskai-db psql -U fiskai -d fiskai
```

**Set user as ADMIN:**

```bash
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "UPDATE \"User\" SET \"systemRole\" = 'ADMIN' WHERE email = 'user@example.com';"
```

## Tech Stack

- Next.js 15 App Router
- Prisma 7 + PostgreSQL
- NextAuth v5 (Auth.js)
- Tailwind CSS + CVA design system
- Resend for transactional email

## Key Directories

- `/content/vodici/` - MDX guides
- `/content/usporedbe/` - MDX comparisons
- `/docs/plans/` - Implementation plans
- `/src/lib/modules/` - Module definitions & access control
- `/src/lib/middleware/` - Subdomain routing
- `/src/app/(marketing)/` - Public pages, auth
- `/src/app/(app)/` - Client dashboard
- `/src/app/(staff)/` - Staff portal
- `/src/app/(admin)/` - Admin portal

## Module System

16 toggleable modules stored in `Company.entitlements[]`:

- invoicing, e-invoicing, fiscalization, contacts, products, expenses
- banking, reconciliation, reports-basic, reports-advanced
- pausalni, vat, corporate-tax, pos, documents, ai-assistant

## SSL Configuration

Since Cloudflare proxies traffic, Let's Encrypt HTTP-01 challenge fails.

**Options:**

1. Use Cloudflare Origin Certificates (recommended)
2. Set Cloudflare SSL mode to "Full" (not Strict)
3. Use DNS-01 challenge with Cloudflare API token

## Environment Variables (Coolify)

Key variables configured:

- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_URL` - https://fiskai.hr
- `NEXTAUTH_SECRET` - Auth encryption key
- `NEXT_PUBLIC_APP_URL` - https://fiskai.hr
- `RESEND_API_KEY` - Email service
- `RESEND_FROM_EMAIL` - FiskAI <noreply@fiskai.hr>
