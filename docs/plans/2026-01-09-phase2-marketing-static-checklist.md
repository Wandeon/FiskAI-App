# Phase 2: Marketing Static Separation - Checklist

> **Status:** Phase 1 complete (PR #1378). Phase 2 ready for implementation.

## Overview

Phase 2 focuses on:

1. Making excluded dynamic routes static-compatible
2. SiteGround deployment configuration
3. Daily rebuild automation
4. Production cutover

---

## Checklist

### 2.1 Fix Remaining Dynamic Routes

These routes were excluded from Phase 1 static export and need to be made static-compatible:

- [ ] **vodic/[slug]** - Currently uses `force-dynamic` due to MDX issues
  - Add `generateStaticParams()`
  - Remove `dynamic = "force-dynamic"`
  - Test MDX rendering at build time

- [ ] **usporedba/[slug]** - Missing `generateStaticParams`
  - Add `generateStaticParams()` with comparison slugs
  - Set `dynamicParams = false`

- [ ] **select-role** - Uses `headers()` for cookie access
  - Convert to static redirect page (like login/register)
  - Remove header dependency

- [ ] **check-email, verify-email** - Depend on server actions
  - Convert to static pages with client-side handling
  - Or redirect to app.fiskai.hr for these flows

### 2.2 Fix OG Image Routes

Currently excluded from static export:

- [ ] **opengraph-image.tsx (root marketing)** - Edge runtime incompatible
  - Change to `runtime = "nodejs"`
  - Verify OG image generation works at build time

- [ ] **logo.png, og-knowledge-hub.png** - Dynamic image routes
  - Add static OG images to public/ folder
  - Remove dynamic generation routes

### 2.3 SiteGround Deployment

- [ ] **Configure SiteGround hosting**
  - Create subdomain or point fiskai.hr to SiteGround
  - Configure HTTPS with Cloudflare origin certificate
  - Set up custom 404 page

- [ ] **Create deploy script**
  - Build static export
  - rsync/sftp to SiteGround
  - Invalidate CDN cache

- [ ] **Configure .htaccess for SiteGround**
  - 301 redirects from app URLs to app.fiskai.hr
  - Security headers (since Next.js headers() not available)
  - GZIP compression
  - Cache-Control headers

### 2.4 Daily Rebuild Automation

- [ ] **GitHub Actions workflow**
  - Schedule daily at 4:00 AM CET
  - Trigger on WordPress webhook (when news published)
  - Build with `STATIC_EXPORT=true`
  - Deploy to SiteGround
  - Post status to Slack/Discord

- [ ] **WordPress webhook integration**
  - On post publish → trigger GitHub workflow
  - Content validation before build

### 2.5 DNS & Cutover

- [ ] **Cloudflare configuration**
  - Point fiskai.hr to SiteGround
  - Keep app.fiskai.hr on Coolify
  - Configure SSL/TLS mode

- [ ] **Cutover checklist**
  - Test all marketing pages on SiteGround staging
  - Verify SEO (canonical URLs, meta tags)
  - Test redirect pages work
  - Monitor for 404s and errors
  - Rollback plan ready

---

## Excluded from Static (Stays on Coolify)

These routes will remain dynamic on app.fiskai.hr:

- `(admin)/*` - Admin portal
- `(app)/*` - Client dashboard
- `(staff)/*` - Staff portal
- `(auth)/*` - Authentication flows
- `api/*` - All API routes
- `actions/*` - Server actions

---

## Success Criteria

- [ ] fiskai.hr marketing site serves 100% static from SiteGround
- [ ] No database/backend dependency at runtime
- [ ] Daily rebuilds update news content automatically
- [ ] Site remains available during full backend outage
- [ ] Auth flows redirect to app.fiskai.hr correctly
- [ ] No SEO regression (rankings, indexing)

---

## Rollback Plan

If issues occur:

1. Point fiskai.hr DNS back to Coolify
2. Disable `STATIC_EXPORT` in production
3. Rebuild with `output: "standalone"`
