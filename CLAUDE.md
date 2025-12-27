# FiskAI Project Notes

> Canonical document - reviewed 2024-12-24
>
> This file provides AI assistants with project context. For full documentation, see [docs/](./docs/).

## ⛔ CRITICAL: Branch Protection Policy

**NEVER push directly to `main` branch. All changes MUST go through Pull Requests.**

This policy exists because:

- Direct pushes bypass code review and can introduce breaking changes
- PRs provide audit trail and allow rollback
- CI/CD runs on PR merge, not on every push
- Multiple developers/agents may be working simultaneously

**AI Agents: When you need to commit changes:**

1. Create a feature branch: `git checkout -b fix/descriptive-name`
2. Make your commits on the feature branch
3. Push the branch: `git push -u origin fix/descriptive-name`
4. Create a PR: `gh pr create --title "..." --body "..."`
5. Return the PR URL to the user for review

**DO NOT** attempt to bypass this by:

- Disabling the pre-push hook
- Force pushing
- Modifying git config

A pre-push hook enforces this locally. Violations will be rejected.

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

**Coolify Dashboard:** https://ci.fiskai.hr (or http://152.53.146.3:8000)

**Application UUID:** `bsswgo8ggwgkw8c88wo8wcw8`

**Deploy API (trigger deployment):**

```bash
curl -X POST "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/start" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Check deployment status:**

```bash
curl -s "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" | jq '.status'
```

**Update environment variables:**

```bash
curl -X PATCH "http://152.53.146.3:8000/api/v1/applications/bsswgo8ggwgkw8c88wo8wcw8/envs" \
  -H "Authorization: Bearer $(grep COOLIFY_API_TOKEN .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY_NAME", "value": "value"}'
```

See `.claude/skills/coolify-deployment/SKILL.md` for complete API documentation.

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

## Regulatory Truth Layer

Two-layer execution model for processing Croatian regulatory content:

**Layer A: Daily Discovery** (Scheduled)

- Sentinel scans regulatory endpoints (Narodne novine, Porezna uprava, FINA, etc.)
- Creates Evidence records with immutable source content
- Classifies PDFs: PDF_TEXT (has text layer) or PDF_SCANNED (needs OCR)

**Layer B: 24/7 Processing** (Continuous)

- OCR Worker: Tesseract + Vision fallback for scanned PDFs
- Extractor: LLM-based fact extraction with confidence scoring
- Composer: Aggregates facts into regulatory rules
- Reviewer: Automated quality checks
- Arbiter: Conflict resolution
- Releaser: Publication to production

**Key Invariants:**

- Every rule has evidence-backed source pointers
- No hallucinations - LLM outputs verified against sources
- Fail-closed - ambiguous content goes to human review
- Evidence.rawContent is immutable

**Workers:** `docker-compose.workers.yml`

```bash
# Check queue status
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-ocr --tail 50
```

## Development Workflow

**CRITICAL: Never rebuild Docker images for testing code changes!**

Docker builds take 10-15 minutes. Instead:

1. **Test workers locally with npx tsx:**

   ```bash
   # Run a worker directly (uses .env.local for DATABASE_URL)
   npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts [evidenceId]
   npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch
   ```

2. **Test individual agents:**

   ```bash
   npx tsx src/lib/regulatory-truth/scripts/run-composer.ts [pointerId]
   npx tsx src/lib/regulatory-truth/scripts/run-reviewer.ts [ruleId]
   ```

3. **Only rebuild Docker when changes are verified working:**
   ```bash
   docker compose -f docker-compose.workers.yml build worker-extractor
   docker compose -f docker-compose.workers.yml up -d worker-extractor
   ```

## Documentation Structure

```
docs/
├── 01_ARCHITECTURE/     # System architecture
├── 02_FEATURES/         # Feature specifications
├── 04_OPERATIONS/       # Operations runbooks
├── 05_REGULATORY/       # Regulatory Truth Layer
├── 07_AUDITS/           # Audit reports
├── _meta/               # Meta-documentation
└── plans/               # Implementation plans
```

See [docs/DOC-MAP.md](./docs/DOC-MAP.md) for complete documentation structure.
