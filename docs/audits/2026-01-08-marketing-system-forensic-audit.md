# Marketing System Forensic Audit

> **Date:** 2026-01-08
> **Purpose:** Prepare for permanent separation of marketing system
> **Target State:** 100% static at runtime, zero backend coupling

---

## Executive Summary

**Verdict: CONDITIONAL GO - Migration is viable but requires targeted fixes.**

The FiskAI marketing system is **61% static-ready** today. The remaining 39% consists of:

- 1 critical blocker (layout auth check)
- 4 high-severity blockers (news/vijesti system)
- 2 medium-severity issues (sitemap, newsletter)
- 1 feature requiring separate service (payment slip barcode API)

Estimated effort to achieve 100% static: **3-5 days of focused work**.

---

## Part 1: Marketing Audit Report

### 1.1 Route Inventory

| Category                | Count | Static-Safe | Blocking Issues      |
| ----------------------- | ----- | ----------- | -------------------- |
| **MDX Content Routes**  | 12    | 12 (100%)   | None                 |
| **Legal/Policy Pages**  | 11    | 11 (100%)   | None                 |
| **Tool Pages**          | 8     | 7 (87.5%)   | 1 needs barcode API  |
| **Landing Pages**       | 7     | 7 (100%)    | None                 |
| **Auth-Related Pages**  | 8     | 0 (0%)      | All need auth system |
| **News/Vijesti Routes** | 5     | 0 (0%)      | All need database    |
| **Other Dynamic**       | 3     | 0 (0%)      | DB or auth required  |
| **TOTAL**               | 54    | 33 (61%)    | 21 require fixes     |

### 1.2 Static-Safe Routes (33 routes)

These can be deployed as-is on a static CDN:

```
/alati                     /alati/pdv-kalkulator
/alati/kalkulator-doprinosa /alati/kalkulator-poreza
/alati/posd-kalkulator     /alati/kalendar
/alati/oib-validator       /alati/e-racun
/baza-znanja               /vodic
/vodic/[slug]              /usporedba
/usporedba/[slug]          /kako-da
/kako-da/[slug]            /rjecnik
/rjecnik/[pojam]           /hubovi
/hubovi/[hub]              /features
/pricing                   /about
/contact                   /terms
/privacy                   /cookies
/dpa                       /security
/ai-data-policy            /metodologija
/urednicka-politika        /izvori
/wizard                    /fiskalizacija
/prelazak
```

### 1.3 Non-Static Routes (21 routes)

**Critical - Layout-Level Blocker:**

```
src/app/(marketing)/layout.tsx:2: import { auth } from "@/lib/auth"
```

This affects ALL 54 marketing routes.

**High - Database Dependencies:**

```
/                          - getLatestPosts() DB query
/vijesti                   - 7+ Drizzle DB queries
/vijesti/[slug]            - Per-article DB lookup
/vijesti/kategorija/[slug] - Category filter via DB
/vijesti/tag/[slug]        - Tag filter via DB
/status                    - System status DB queries
```

**Medium - Auth System Dependencies:**

```
/login                     - Redirects to auth URL
/register                  - Redirects to auth URL
/check-email               - Uses auth server actions
/verify-email              - Uses auth server actions
/forgot-password           - Uses auth server actions
/reset-password            - Uses auth server actions
/accept-invitation         - Full auth flow
/select-role               - getCurrentUser(), auth checks
```

### 1.4 Data Dependencies Map

```
src/app/(marketing)/
├── layout.tsx
│   └── ❌ @/lib/auth (auth())
├── page.tsx
│   └── ❌ getLatestPosts() - DB query
├── vijesti/
│   ├── page.tsx
│   │   ├── ❌ @/lib/db/drizzle
│   │   ├── ❌ @/lib/db/schema (newsPosts, newsCategories, etc.)
│   │   └── ❌ drizzle-orm (eq, desc, and, etc.)
│   ├── [slug]/page.tsx → Same DB imports
│   ├── kategorija/[slug]/page.tsx → Same DB imports
│   └── tag/[slug]/page.tsx → Same DB imports
├── status/page.tsx
│   └── ❌ Database status queries
└── actions/newsletter.ts
    └── ❌ Server action with DB write
```

### 1.5 Content System Analysis

**MDX Content (66 files) - FULLY STATIC:**

```
content/
├── vodici/          (guides)
├── usporedbe/       (comparisons)
├── kako-da/         (how-tos)
├── rjecnik/         (glossary)
└── hubovi/          (hub pages)
```

**Content Loader:** Custom filesystem-based (`src/lib/knowledge-hub/mdx.ts`)

- Uses gray-matter for frontmatter
- Build-time filesystem I/O only
- No database dependencies
- No external API calls

**Fiscal Data:** Hardcoded constants (`src/lib/fiscal-data/index.ts`)

- Tax rates, thresholds, deadlines
- Used by all calculators
- Requires annual manual updates

### 1.6 Search Implementation

**Technology:** Client-side Fuse.js fuzzy search
**Index:** Static JSON at `/public/search-index.json`
**Generation:** Build-time script `scripts/build-search-index.ts`
**Entries:** 84 total (5 quick actions, 9 tools, 6 nav items, 64 MDX)

**Verdict:** Fully static-compatible. Zero runtime dependencies.

### 1.7 Tools & Calculators

| Tool                         | Static-Safe | Notes                   |
| ---------------------------- | ----------- | ----------------------- |
| PDV Kalkulator               | ✓ YES       | Client-side React       |
| Kalkulator Doprinosa         | ✓ YES       | Client-side React       |
| Kalkulator Poreza            | ✓ YES       | Client-side React       |
| POSD Kalkulator              | ✓ YES       | Client-side React       |
| Kalendar                     | ✓ YES       | Client-side React       |
| OIB Validator                | ✓ YES       | Client-side React       |
| E-Račun Preview              | ✓ YES       | Client-side PDF preview |
| **Uplatnice (Payment Slip)** | ❌ NO       | Needs HUB3 barcode API  |

### 1.8 SEO & Metadata

**Route Registry:** `src/config/routes.ts`

- Type-safe definitions with SEO metadata
- Single source of truth for sitemap/robots

**Sitemap:** `src/app/sitemap.ts`

- Static routes from registry ✓
- MDX slugs from filesystem ✓
- News articles from DB ❌ (has try/catch fallback)

**Structured Data:** JSON-LD schemas for:

- Organization
- WebSite
- BreadcrumbList
- Article/HowTo (per content type)

---

## Part 2: Static Readiness Checklist

### Pre-Migration Checklist

| #   | Item                      | Status     | Action Required                           |
| --- | ------------------------- | ---------- | ----------------------------------------- |
| 1   | Remove layout auth() call | ❌ BLOCKER | Remove or make conditional                |
| 2   | Extract news system       | ❌ BLOCKER | Move to WordPress or remove               |
| 3   | Make home page static     | ❌ BLOCKER | Remove news widget or use static fallback |
| 4   | Make status page static   | ⚠️ MEDIUM  | Move to separate monitoring service       |
| 5   | Move newsletter action    | ⚠️ MEDIUM  | Headless form service (Formspree/etc)     |
| 6   | Move payment slip API     | ⚠️ MEDIUM  | Separate serverless function              |
| 7   | Static sitemap            | ⚠️ LOW     | Generate at build time, omit news         |
| 8   | Auth pages decision       | ❓ DECIDE  | Keep in app or separate auth portal       |
| 9   | MDX content validation    | ✓ READY    | Already static                            |
| 10  | Search index              | ✓ READY    | Already static                            |
| 11  | Calculators               | ✓ READY    | Already client-side                       |
| 12  | Legal pages               | ✓ READY    | Already static                            |
| 13  | Landing pages             | ✓ READY    | Already static                            |

### Post-Migration Verification

- [ ] Build succeeds with `output: 'export'`
- [ ] Zero runtime server functions
- [ ] Zero database imports in marketing bundle
- [ ] Zero auth imports in marketing bundle
- [ ] All pages serve from CDN
- [ ] Site works when backend is down
- [ ] Lighthouse performance score > 90

---

## Part 3: Marketing Boundary Contract

### Allowed Dependencies

```typescript
// Static content
@/lib/knowledge-hub/mdx       // Filesystem MDX loader
@/lib/fiscal-data             // Hardcoded tax constants
@/config/routes               // Route registry
@/config/seo                  // SEO configuration

// UI Components
@/components/ui/*             // Design system primitives
@/components/patterns/*       // Composed components
@/components/sections/*       // Page sections
@/components/calculators/*    // Client-side calculators
@/components/motion/*         // Animation components

// Build-time only
process.env.NEXT_PUBLIC_*     // Inlined at build

// Client-side only
fuse.js                       // Search library
```

### Forbidden Dependencies

```typescript
// Database
@/lib/db/*                    // Any database access
drizzle-orm                   // ORM
prisma                        // ORM (if used)

// Authentication
@/lib/auth                    // Auth system
@/lib/auth-utils              // Auth utilities
@/lib/auth/*                  // Auth subsystems
@/app/actions/auth            // Auth server actions

// Runtime services
@/lib/redis                   // Cache
@/lib/outbox                  // Event system
@/lib/queue                   // Job queue

// Server Actions with state
"use server" + DB operations
```

### Data Contracts

| Data Type     | Source             | Update Mechanism          |
| ------------- | ------------------ | ------------------------- |
| MDX Content   | Git repo           | Build trigger on commit   |
| Search Index  | Generated          | Rebuild on content change |
| Fiscal Data   | Hardcoded          | Manual update annually    |
| News (future) | WordPress REST API | Build-time fetch or ISR   |

### Failure Mode Guarantees

| Backend State   | Marketing Behavior   |
| --------------- | -------------------- |
| DB down         | **No impact**        |
| Redis down      | **No impact**        |
| Auth down       | **No impact**        |
| Workers crashed | **No impact**        |
| API errors      | **No impact**        |
| CDN healthy     | Site serves normally |
| CDN down        | Site unavailable     |

---

## Part 4: Migration Risk Register

### Critical Risks

| Risk                                         | Likelihood | Impact | Mitigation                             |
| -------------------------------------------- | ---------- | ------ | -------------------------------------- |
| Layout auth removal breaks existing behavior | Medium     | High   | Test login state visibility separately |
| News removal loses SEO value                 | Low        | High   | Redirect old URLs to WordPress         |
| Build time increases significantly           | Medium     | Medium | Incremental static regeneration        |
| Content update workflow changes              | High       | Medium | Document new workflow clearly          |

### Technical Debt Identified

1. **TODO in code:** `vodic/[slug]/page.tsx:19` - "Re-enable once MDX rendering is fixed"
2. **Contradictory exports:** Some routes have both `generateStaticParams` and `force-dynamic`
3. **Hardcoded fiscal data:** Works but requires annual updates
4. **Non-standard MDX loader:** Custom implementation vs contentlayer/velite

### Scale Concerns

| Aspect       | Current    | At Scale | Recommendation               |
| ------------ | ---------- | -------- | ---------------------------- |
| MDX files    | 66         | 500+     | Consider headless CMS        |
| Build time   | ~2 min     | ~10 min  | Use ISR for content          |
| Search index | 84 entries | 1000+    | Consider Algolia/Meilisearch |

---

## Part 5: Go/No-Go Decision Matrix

### GO Criteria (All Required)

| #   | Criterion                                 | Status        |
| --- | ----------------------------------------- | ------------- |
| 1   | Layout auth() removed or made conditional | ❌ NOT MET    |
| 2   | Home page news widget removed or static   | ❌ NOT MET    |
| 3   | News system extracted or removed          | ❌ NOT MET    |
| 4   | All 33 static-safe routes verified        | ⚠️ NOT TESTED |
| 5   | Build succeeds with static export         | ⚠️ NOT TESTED |
| 6   | Zero database imports in bundle           | ⚠️ NOT TESTED |

### NO-GO Criteria (Any Blocks)

| #   | Criterion                         | Status                  |
| --- | --------------------------------- | ----------------------- |
| 1   | Database queries in static routes | ✓ CLEAR (for 33 routes) |
| 2   | Auth checks in static routes      | ❌ BLOCKED (layout)     |
| 3   | Server actions in static routes   | ✓ CLEAR                 |
| 4   | Runtime env vars in static routes | ✓ CLEAR                 |

### Current Verdict

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONDITIONAL GO                               │
│                                                                 │
│  Migration is VIABLE but requires 3 MUST-FIX items:             │
│                                                                 │
│  1. Remove layout.tsx auth() call                               │
│  2. Make home page static (remove news query)                   │
│  3. Extract or remove /vijesti/* system                         │
│                                                                 │
│  Estimated effort: 3-5 days                                     │
│                                                                 │
│  Once fixes applied: RE-AUDIT and verify GO criteria            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: File-by-File Static Analysis

### Routes with Database Imports

```
src/app/(marketing)/vijesti/page.tsx
  - drizzleDb, newsPosts, newsCategories, newsPostSources, newsItems, newsSources
  - drizzle-orm: eq, desc, and, lte, isNull, sql, isNotNull

src/app/(marketing)/vijesti/[slug]/page.tsx
  - drizzleDb, newsPosts, newsCategories, newsPostSources, newsItems
  - drizzle-orm: eq, and, lte, desc

src/app/(marketing)/vijesti/[slug]/opengraph-image.tsx
  - drizzleDb, newsPosts, newsCategories
  - drizzle-orm: eq, and, lte

src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx
  - drizzleDb, newsPosts, newsCategories
  - drizzle-orm: eq, and, lte, desc, or, sql

src/app/(marketing)/vijesti/tag/[slug]/page.tsx
  - drizzleDb, newsPosts, newsCategories
  - drizzle-orm: eq, desc, and, lte, sql
```

### Routes with Auth Imports

```
src/app/(marketing)/layout.tsx
  - @/lib/auth: auth

src/app/(marketing)/check-email/page.tsx
  - @/app/actions/auth: resendVerificationEmail

src/app/(marketing)/forgot-password/page.tsx
  - @/app/actions/auth: requestPasswordReset

src/app/(marketing)/verify-email/page.tsx
  - @/app/actions/auth: verifyEmail, resendVerificationEmail

src/app/(marketing)/reset-password/page.tsx
  - @/app/actions/auth: resetPassword, validatePasswordResetToken

src/app/(marketing)/select-role/page.tsx
  - @/lib/auth-utils: getCurrentUser
  - @/lib/auth/system-role: getAvailableSubdomains, hasMultipleRoles
```

### Environment Variables Used

All uses are `NEXT_PUBLIC_*` (safe - inlined at build time):

```
NEXT_PUBLIC_APP_URL - 43 occurrences across marketing routes
NODE_ENV - 2 occurrences (build-time checks)
```

---

## Appendix B: Content Structure

```
content/
├── vodici/           # 25 guides
│   ├── index.mdx
│   └── [slug].mdx
├── usporedbe/        # 15 comparisons
│   └── [slug].mdx
├── kako-da/          # 12 how-tos
│   └── [slug].mdx
├── rjecnik/          # 10 glossary terms
│   └── [pojam].mdx
└── hubovi/           # 4 hub pages
    └── [hub].mdx
```

Total: **66 MDX files**, all filesystem-based, zero runtime dependencies.

---

## Appendix C: Recommended Migration Order

1. **Phase A: Remove Blockers** (3-5 days)
   - Remove/conditionalialize layout auth()
   - Make home page static
   - Extract news to WordPress or remove

2. **Phase B: Extract Services** (2-3 days)
   - Newsletter signup → Formspree/similar
   - Payment slip barcode → Serverless function
   - Status page → Separate monitoring

3. **Phase C: Static Build** (1-2 days)
   - Enable `output: 'export'`
   - Verify all 33+ routes build
   - Test CDN deployment

4. **Phase D: Verification** (1 day)
   - Re-run this audit
   - Verify all GO criteria met
   - Document new content workflow

---

_Audit conducted by Claude Code on 2026-01-08_
_Methodology: Comprehensive codebase analysis using 6 parallel subagents_
