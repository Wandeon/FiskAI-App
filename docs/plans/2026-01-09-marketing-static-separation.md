# Marketing Static Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform fiskai.hr marketing site into a 100% static deployment on SiteGround that survives complete backend outages.

**Architecture:** Four-phase isolation program. Phase 1 removes coupling in-place. Phase 2 adds enforcement tooling. Phase 3 splits repositories. Phase 4 deploys static `out/` to SiteGround.

**Tech Stack:** Next.js 15 (static export to `out/`), WordPress REST API (content source), bwip-js (browser), external form handlers, SiteGround static hosting.

---

## Locked Constraints (Non-Negotiable)

| Constraint                           | Rationale                                 |
| ------------------------------------ | ----------------------------------------- |
| Deploy artifact is `out/` directory  | SiteGround serves static files only       |
| No Next.js middleware                | Middleware does not run on static hosts   |
| No ISR/revalidate                    | Static export has no runtime revalidation |
| No DB/Drizzle dependency for build   | Marketing builds with all backend offline |
| Content from WordPress REST          | Locked content-store decision             |
| No auth/login detection on marketing | Avoids cross-subdomain cookie issues      |
| Redirects via .htaccess/host config  | Not Next.js middleware                    |

---

## Current State Analysis

### Coupling Points to Remove

| Component        | File                                               | Issue                                | Action                    |
| ---------------- | -------------------------------------------------- | ------------------------------------ | ------------------------- |
| Marketing Layout | `src/app/(marketing)/layout.tsx:2,24`              | Imports `auth`, calls `await auth()` | Remove entirely           |
| MarketingHeader  | `src/components/marketing/MarketingHeader.tsx`     | Receives `isLoggedIn` prop           | Remove prop, single CTA   |
| News Hub         | `src/app/(marketing)/vijesti/page.tsx:2,33`        | Imports `drizzleDb`, `force-dynamic` | Replace with WP fetch     |
| News Detail      | `src/app/(marketing)/vijesti/[slug]/page.tsx:3,20` | Imports `drizzleDb`, `force-dynamic` | Replace with WP fetch     |
| Status Page      | `src/app/(marketing)/status/page.tsx:2,38`         | Imports `getDetailedHealth`          | Static page only          |
| Newsletter       | `src/lib/actions/newsletter.ts`                    | Server action                        | External form handler     |
| NewsletterSignup | `src/components/news/NewsletterSignup.tsx:5`       | Calls server action                  | Client-side external POST |
| Payment Slip API | `src/app/api/pausalni/payment-slip/route.ts`       | Server route with auth               | Browser-only generator    |

### Already Static (No Changes Needed)

| Component    | File                                          | Status              |
| ------------ | --------------------------------------------- | ------------------- |
| Contact Page | `src/app/(marketing)/contact/page.tsx`        | Already static HTML |
| Legal Pages  | `src/app/(marketing)/privacy`, `/terms`, etc. | Already static      |

---

## Phase 1: Static Purity In-Place

**Objective:** Make marketing tree statically buildable from WordPress content, no DB required.

**Acceptance Gate:**

- `pnpm build` produces `out/` directory
- `npx serve out` serves all marketing pages
- Build succeeds with DATABASE_URL unset
- No `drizzle`, `prisma`, `auth`, `force-dynamic`, `"use server"` in marketing code

---

### Task 1.1: Remove Auth from Marketing Layout

**Files:**

- Modify: `src/app/(marketing)/layout.tsx`
- Modify: `src/components/marketing/MarketingHeader.tsx`

**Step 1: Read current layout**

```bash
cat src/app/(marketing)/layout.tsx | head -30
```

**Step 2: Remove auth import and session check from layout**

Replace `src/app/(marketing)/layout.tsx`:

```typescript
import Link from "next/link"
import { MarketingHeader } from "@/components/marketing/MarketingHeader"
import { MarketingAnalyticsInit } from "@/components/marketing/marketing-analytics-init"
import { ComplianceProgressBar } from "@/components/marketing/ComplianceProgressBar"
import { SpeculationRules } from "@/components/seo/speculation-rules"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-inverse/60 transition-colors hover:text-inverse"
    >
      {children}
    </Link>
  )
}

// STATIC LAYOUT - No auth, no session, no runtime dependencies
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="marketing-surface min-h-[calc(100vh-var(--header-height))]">
      <MarketingHeader />
      <MarketingAnalyticsInit />
      <SpeculationRules />

      <div className="pb-16">{children}</div>
      <ComplianceProgressBar />

      <footer className="border-t border-inverse/10 bg-base">
        {/* Footer content unchanged */}
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-5 md:px-6">
          <div className="space-y-3 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-inverse">FiskAI</p>
              <p className="text-sm text-inverse/60 mt-1">
                AI-first računovodstveni asistent za Hrvatsku. Beta program.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-inverse/50">PODUZEĆE I KONTAKT</p>
              <div className="space-y-1 text-sm text-inverse/70">
                <p className="font-medium text-inverse">FiskAI d.o.o.</p>
                <p>Zagreb, Hrvatska</p>
                <p>
                  Email:{" "}
                  <a href="mailto:info@fiskai.hr" className="text-link hover:underline">
                    info@fiskai.hr
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-inverse">Linkovi</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/features">Mogućnosti</NavLink>
              <NavLink href="/pricing">Cijene</NavLink>
              <NavLink href="/security">Sigurnost</NavLink>
              <NavLink href="/contact">Kontakt</NavLink>
              <NavLink href="/status">Status sustava</NavLink>
              <NavLink href="/for/pausalni-obrt">Za paušalni obrt</NavLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-inverse">Legal</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/privacy">Privatnost</NavLink>
              <NavLink href="/terms">Uvjeti korištenja</NavLink>
              <NavLink href="/dpa">DPA (Obrada podataka)</NavLink>
              <NavLink href="/cookies">Kolačići</NavLink>
              <NavLink href="/ai-data-policy">AI politika</NavLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-inverse">Transparentnost</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/metodologija">Metodologija</NavLink>
              <NavLink href="/urednicka-politika">Urednička politika</NavLink>
              <NavLink href="/izvori">Službeni izvori</NavLink>
            </div>
            <div className="pt-4">
              <p className="text-xs font-medium text-inverse/50">PODRŠKA</p>
              <p className="text-xs text-inverse/60 mt-1">
                Odgovor unutar 24h radnim danima putem emaila.
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-inverse/10 px-4 py-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-inverse/60">
              © {new Date().getFullYear()} FiskAI d.o.o. Sva prava pridržana.
            </p>
            <div className="flex items-center gap-6">
              <a href="/status" className="text-xs text-inverse/60 hover:text-inverse">
                Status sustava
              </a>
              <a href="/sitemap.xml" className="text-xs text-inverse/60 hover:text-inverse">
                Sitemap
              </a>
              <a href="/robots.txt" className="text-xs text-inverse/60 hover:text-inverse">
                Robots.txt
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

**Step 3: Update MarketingHeader - remove isLoggedIn entirely**

Modify `src/components/marketing/MarketingHeader.tsx`:

Remove the `isLoggedIn` prop and all conditional rendering based on login state. Replace with single CTA:

```typescript
// Remove this interface
// interface MarketingHeaderProps {
//   isLoggedIn?: boolean
// }

// Change function signature
export function MarketingHeader() {
  // ... existing state (isScrolled, portalOpen)

  // Remove: const [isLoggedIn, setIsLoggedIn] = useState(false)
  // Remove: useEffect for cookie detection

  // In the CTA section, replace the conditional with single button:
  // Replace lines 169-219 with:
  <a
    href="https://app.fiskai.hr"
    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
  >
    <span className="hidden sm:inline">Otvori aplikaciju</span>
    <span className="sm:hidden">Aplikacija</span>
    <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />

    {/* Shimmer effect */}
    <motion.span
      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
      animate={{ x: ["0%", "200%"] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        repeatDelay: 3,
        ease: "easeInOut",
      }}
    />
  </a>
```

**Step 4: Verify no auth imports remain**

```bash
grep -r "@/lib/auth" src/app/\(marketing\)/ src/components/marketing/ || echo "OK: No auth imports"
```

**Step 5: Commit**

```bash
git add src/app/\(marketing\)/layout.tsx src/components/marketing/MarketingHeader.tsx
git commit -m "$(cat <<'EOF'
fix(marketing): remove auth from marketing layout and header

- Remove auth import and await auth() from layout
- Remove isLoggedIn prop and cookie detection from header
- Single CTA button always points to app.fiskai.hr
- Marketing is now fully static with no auth coupling

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Create WordPress Content Fetcher

**Files:**

- Create: `src/lib/wordpress/client.ts`
- Create: `src/lib/wordpress/types.ts`

**Step 1: Create WordPress types**

Create `src/lib/wordpress/types.ts`:

```typescript
/**
 * WordPress REST API types for marketing content
 *
 * Content source for all marketing news pages.
 * Fetched at BUILD TIME only - no runtime requests.
 */

export interface WPPost {
  id: number
  date: string
  date_gmt: string
  modified: string
  modified_gmt: string
  slug: string
  status: "publish" | "draft" | "pending" | "private"
  type: string
  link: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
    protected: boolean
  }
  excerpt: {
    rendered: string
    protected: boolean
  }
  featured_media: number
  categories: number[]
  tags: number[]
  // Custom fields via ACF or custom REST fields
  acf?: {
    impact_level?: "high" | "medium" | "low"
    tldr?: string
    action_items?: string[]
    featured_image_source?: string
    featured_image_caption?: string
  }
}

export interface WPCategory {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  parent: number
}

export interface WPTag {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
}

export interface WPMedia {
  id: number
  source_url: string
  alt_text: string
  media_details: {
    width: number
    height: number
  }
}

// Normalized types for our app
export interface NewsPost {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string
  publishedAt: string
  modifiedAt: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: string[]
  featuredImageUrl: string | null
  featuredImageSource: string | null
  featuredImageCaption: string | null
  impactLevel: "high" | "medium" | "low" | null
  tldr: string | null
  actionItems: string[] | null
}

export interface NewsCategory {
  id: string
  slug: string
  name: string
  count: number
}
```

**Step 2: Create WordPress client**

Create `src/lib/wordpress/client.ts`:

```typescript
/**
 * WordPress REST API client for marketing content
 *
 * BUILD TIME ONLY - These functions fetch content during static generation.
 * Marketing site has no runtime API calls.
 *
 * Environment:
 * - WP_BASE_URL: WordPress site URL (e.g., https://cms.fiskai.hr)
 * - CONTENT_JSON_PATH: Optional local JSON fallback path
 */

import type { WPPost, WPCategory, WPTag, WPMedia, NewsPost, NewsCategory } from "./types"

const WP_BASE_URL = process.env.WP_BASE_URL || "https://cms.fiskai.hr"
const WP_API = `${WP_BASE_URL}/wp-json/wp/v2`

// Cache for media lookups during build
const mediaCache = new Map<number, WPMedia>()
const categoryCache = new Map<number, WPCategory>()
const tagCache = new Map<number, WPTag>()

/**
 * Fetch from WordPress REST API
 */
async function wpFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${WP_API}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    // No caching hints - we're in build, not runtime
  })

  if (!response.ok) {
    throw new Error(`WordPress API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get media by ID (with caching for build efficiency)
 */
async function getMedia(mediaId: number): Promise<WPMedia | null> {
  if (mediaId === 0) return null

  if (mediaCache.has(mediaId)) {
    return mediaCache.get(mediaId)!
  }

  try {
    const media = await wpFetch<WPMedia>(`/media/${mediaId}`)
    mediaCache.set(mediaId, media)
    return media
  } catch {
    return null
  }
}

/**
 * Get category by ID (with caching)
 */
async function getCategory(categoryId: number): Promise<WPCategory | null> {
  if (categoryCache.has(categoryId)) {
    return categoryCache.get(categoryId)!
  }

  try {
    const category = await wpFetch<WPCategory>(`/categories/${categoryId}`)
    categoryCache.set(categoryId, category)
    return category
  } catch {
    return null
  }
}

/**
 * Get tag by ID (with caching)
 */
async function getTag(tagId: number): Promise<WPTag | null> {
  if (tagCache.has(tagId)) {
    return tagCache.get(tagId)!
  }

  try {
    const tag = await wpFetch<WPTag>(`/tags/${tagId}`)
    tagCache.set(tagId, tag)
    return tag
  } catch {
    return null
  }
}

/**
 * Convert WP post to our normalized format
 */
async function normalizePost(wpPost: WPPost): Promise<NewsPost> {
  // Get featured image
  const media = await getMedia(wpPost.featured_media)

  // Get primary category (first one)
  const primaryCategoryId = wpPost.categories[0]
  const category = primaryCategoryId ? await getCategory(primaryCategoryId) : null

  // Get tag names
  const tagNames: string[] = []
  for (const tagId of wpPost.tags) {
    const tag = await getTag(tagId)
    if (tag) tagNames.push(tag.name)
  }

  return {
    id: String(wpPost.id),
    slug: wpPost.slug,
    title: wpPost.title.rendered,
    content: wpPost.content.rendered,
    excerpt: wpPost.excerpt.rendered.replace(/<[^>]+>/g, "").trim(),
    publishedAt: wpPost.date_gmt,
    modifiedAt: wpPost.modified_gmt,
    categoryId: category ? String(category.id) : null,
    categoryName: category?.name || null,
    categorySlug: category?.slug || null,
    tags: tagNames,
    featuredImageUrl: media?.source_url || null,
    featuredImageSource: wpPost.acf?.featured_image_source || null,
    featuredImageCaption: wpPost.acf?.featured_image_caption || null,
    impactLevel: wpPost.acf?.impact_level || null,
    tldr: wpPost.acf?.tldr || null,
    actionItems: wpPost.acf?.action_items || null,
  }
}

// ============================================
// PUBLIC API - Used by generateStaticParams and page components
// ============================================

/**
 * Get all published post slugs for generateStaticParams
 */
export async function getAllPostSlugs(): Promise<string[]> {
  const posts = await wpFetch<WPPost[]>("/posts", {
    status: "publish",
    per_page: "100",
    _fields: "slug",
  })
  return posts.map((p) => p.slug)
}

/**
 * Get all category slugs for generateStaticParams
 */
export async function getAllCategorySlugs(): Promise<string[]> {
  const categories = await wpFetch<WPCategory[]>("/categories", {
    per_page: "100",
    _fields: "slug",
  })
  return categories.map((c) => c.slug)
}

/**
 * Get all tag slugs for generateStaticParams
 */
export async function getAllTagSlugs(): Promise<string[]> {
  const tags = await wpFetch<WPTag[]>("/tags", {
    per_page: "100",
    _fields: "slug",
  })
  return tags.map((t) => t.slug)
}

/**
 * Get featured posts for news hub
 */
export async function getFeaturedPosts(limit = 4): Promise<NewsPost[]> {
  const posts = await wpFetch<WPPost[]>("/posts", {
    status: "publish",
    per_page: String(limit),
    orderby: "date",
    order: "desc",
  })

  return Promise.all(posts.map(normalizePost))
}

/**
 * Get post by slug
 */
export async function getPostBySlug(slug: string): Promise<NewsPost | null> {
  const posts = await wpFetch<WPPost[]>("/posts", {
    slug,
    status: "publish",
  })

  if (posts.length === 0) return null
  return normalizePost(posts[0])
}

/**
 * Get posts by category slug
 */
export async function getPostsByCategory(categorySlug: string, limit = 10): Promise<NewsPost[]> {
  // First get category ID
  const categories = await wpFetch<WPCategory[]>("/categories", {
    slug: categorySlug,
  })

  if (categories.length === 0) return []

  const posts = await wpFetch<WPPost[]>("/posts", {
    categories: String(categories[0].id),
    status: "publish",
    per_page: String(limit),
    orderby: "date",
    order: "desc",
  })

  return Promise.all(posts.map(normalizePost))
}

/**
 * Get posts by tag slug
 */
export async function getPostsByTag(tagSlug: string, limit = 20): Promise<NewsPost[]> {
  // First get tag ID
  const tags = await wpFetch<WPTag[]>("/tags", {
    slug: tagSlug,
  })

  if (tags.length === 0) return []

  const posts = await wpFetch<WPPost[]>("/posts", {
    tags: String(tags[0].id),
    status: "publish",
    per_page: String(limit),
    orderby: "date",
    order: "desc",
  })

  return Promise.all(posts.map(normalizePost))
}

/**
 * Get all categories
 */
export async function getAllCategories(): Promise<NewsCategory[]> {
  const categories = await wpFetch<WPCategory[]>("/categories", {
    per_page: "100",
    hide_empty: "true",
  })

  return categories.map((c) => ({
    id: String(c.id),
    slug: c.slug,
    name: c.name,
    count: c.count,
  }))
}

/**
 * Get popular posts (by a custom field or just recent)
 */
export async function getPopularPosts(limit = 5): Promise<NewsPost[]> {
  // WordPress doesn't have built-in popularity - use recent as fallback
  // Could be enhanced with a popularity plugin or custom field
  return getFeaturedPosts(limit)
}

/**
 * Get related posts by category
 */
export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string,
  limit = 3
): Promise<NewsPost[]> {
  if (!categorySlug) return []

  const posts = await getPostsByCategory(categorySlug, limit + 1)
  return posts.filter((p) => p.slug !== excludeSlug).slice(0, limit)
}
```

**Step 3: Create JSON fallback for development**

Create `src/lib/wordpress/fallback.ts`:

```typescript
/**
 * JSON fallback for when WordPress is not available
 *
 * Used during development or if WP is down during build.
 * Reads from content/news.json if WP_BASE_URL is not set.
 */

import fs from "fs"
import path from "path"
import type { NewsPost, NewsCategory } from "./types"

const FALLBACK_PATH = path.join(process.cwd(), "content", "news.json")

interface FallbackData {
  posts: NewsPost[]
  categories: NewsCategory[]
  generatedAt: string
}

let fallbackData: FallbackData | null = null

function loadFallback(): FallbackData {
  if (fallbackData) return fallbackData

  if (!fs.existsSync(FALLBACK_PATH)) {
    // Return empty data if no fallback exists
    return {
      posts: [],
      categories: [],
      generatedAt: new Date().toISOString(),
    }
  }

  const raw = fs.readFileSync(FALLBACK_PATH, "utf-8")
  fallbackData = JSON.parse(raw)
  return fallbackData!
}

export function getFallbackPosts(): NewsPost[] {
  return loadFallback().posts
}

export function getFallbackCategories(): NewsCategory[] {
  return loadFallback().categories
}

export function getFallbackPostBySlug(slug: string): NewsPost | null {
  return getFallbackPosts().find((p) => p.slug === slug) || null
}

export function getFallbackPostsByCategory(categorySlug: string): NewsPost[] {
  return getFallbackPosts().filter((p) => p.categorySlug === categorySlug)
}

export function getFallbackPostsByTag(tag: string): NewsPost[] {
  return getFallbackPosts().filter((p) => p.tags.includes(tag))
}
```

**Step 4: Create unified content API**

Create `src/lib/content/news.ts`:

```typescript
/**
 * Unified news content API
 *
 * Tries WordPress first, falls back to JSON if WP unavailable.
 * BUILD TIME ONLY - no runtime fetching.
 */

import * as wp from "@/lib/wordpress/client"
import * as fallback from "@/lib/wordpress/fallback"
import type { NewsPost, NewsCategory } from "@/lib/wordpress/types"

const USE_WORDPRESS = !!process.env.WP_BASE_URL

// Re-export types
export type { NewsPost, NewsCategory }

export async function getAllPostSlugs(): Promise<string[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getAllPostSlugs()
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPosts().map((p) => p.slug)
}

export async function getAllCategorySlugs(): Promise<string[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getAllCategorySlugs()
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackCategories().map((c) => c.slug)
}

export async function getAllTagSlugs(): Promise<string[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getAllTagSlugs()
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  const posts = fallback.getFallbackPosts()
  const tags = new Set<string>()
  posts.forEach((p) => p.tags.forEach((t) => tags.add(t)))
  return Array.from(tags)
}

export async function getFeaturedPosts(limit = 4): Promise<NewsPost[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getFeaturedPosts(limit)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPosts().slice(0, limit)
}

export async function getPostBySlug(slug: string): Promise<NewsPost | null> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getPostBySlug(slug)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPostBySlug(slug)
}

export async function getPostsByCategory(categorySlug: string, limit = 10): Promise<NewsPost[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getPostsByCategory(categorySlug, limit)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPostsByCategory(categorySlug).slice(0, limit)
}

export async function getPostsByTag(tagSlug: string, limit = 20): Promise<NewsPost[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getPostsByTag(tagSlug, limit)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPostsByTag(tagSlug).slice(0, limit)
}

export async function getAllCategories(): Promise<NewsCategory[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getAllCategories()
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackCategories()
}

export async function getPopularPosts(limit = 5): Promise<NewsPost[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getPopularPosts(limit)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  return fallback.getFallbackPosts().slice(0, limit)
}

export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string,
  limit = 3
): Promise<NewsPost[]> {
  if (USE_WORDPRESS) {
    try {
      return await wp.getRelatedPosts(categorySlug, excludeSlug, limit)
    } catch (e) {
      console.warn("WordPress unavailable, using fallback:", e)
    }
  }
  if (!categorySlug) return []
  return fallback
    .getFallbackPostsByCategory(categorySlug)
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, limit)
}
```

**Step 5: Commit**

```bash
git add src/lib/wordpress/ src/lib/content/
git commit -m "$(cat <<'EOF'
feat(content): add WordPress REST client for marketing content

- Create WordPress REST API client for build-time fetching
- Add JSON fallback for development/offline builds
- Unified content/news.ts API with automatic fallback
- No runtime dependencies - build time only

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Convert News Pages to WordPress Content

**Files:**

- Modify: `src/app/(marketing)/vijesti/page.tsx`
- Modify: `src/app/(marketing)/vijesti/[slug]/page.tsx`
- Modify: `src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx`
- Modify: `src/app/(marketing)/vijesti/tag/[slug]/page.tsx`

**Step 1: Update vijesti/page.tsx**

Replace `src/app/(marketing)/vijesti/page.tsx`:

```typescript
import { Metadata } from "next"
import {
  getFeaturedPosts,
  getAllCategories,
  getPostsByCategory,
  getPopularPosts,
} from "@/lib/content/news"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import { HeroSection } from "@/components/news/HeroSection"
import { CategorySection } from "@/components/news/CategorySection"
import { TrendingUp, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { FadeIn } from "@/components/ui/motion/FadeIn"
import { NewsSearch } from "@/components/news/NewsSearch"
import { NewsletterSignupStatic } from "@/components/news/NewsletterSignupStatic"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Porezne Vijesti | FiskAI",
  description:
    "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e za hrvatske poduzetnike.",
  alternates: {
    canonical: `${BASE_URL}/vijesti`,
  },
}

// STATIC EXPORT - No runtime, no ISR, no revalidate
// Updates only via daily rebuild + deploy

export default async function VijestiPage() {
  const [featuredPosts, categories, popularPosts] = await Promise.all([
    getFeaturedPosts(4),
    getAllCategories(),
    getPopularPosts(5),
  ])

  // Get posts for top 3 categories
  const categoriesWithPosts = await Promise.all(
    categories.slice(0, 3).map(async (category) => ({
      category,
      posts: await getPostsByCategory(category.slug, 3),
    }))
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <FadeIn>
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Porezne Vijesti</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Pratimo Poreznu upravu, Narodne novine, FINA-u i HGK. AI automatski filtrira i sažima
            vijesti relevantne za hrvatske poduzetnike.
          </p>
        </div>
      </FadeIn>

      {/* Hero Section with Featured Posts */}
      {featuredPosts.length >= 4 ? (
        <HeroSection
          featuredPost={{
            slug: featuredPosts[0].slug,
            title: featuredPosts[0].title,
            excerpt: featuredPosts[0].excerpt,
            categoryName: featuredPosts[0].categoryName,
            categorySlug: featuredPosts[0].categorySlug,
            publishedAt: featuredPosts[0].publishedAt ? new Date(featuredPosts[0].publishedAt) : null,
            featuredImageUrl: featuredPosts[0].featuredImageUrl,
            featuredImageSource: featuredPosts[0].featuredImageSource,
            impactLevel: featuredPosts[0].impactLevel,
          }}
          secondaryPosts={featuredPosts.slice(1, 4).map((p) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
            featuredImageUrl: p.featuredImageUrl,
            featuredImageSource: p.featuredImageSource,
            impactLevel: p.impactLevel,
          }))}
        />
      ) : (
        <FadeIn delay={0.05}>
          <GlassCard hover={false} className="mb-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Uskoro: AI sažeci i tjedni digest</p>
                <p className="text-sm text-white/60">
                  Prikupljamo i pripremamo prve objave. U međuvremenu, istražite vodiče i alate.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <GradientButton href="/vodic" size="sm" showArrow>
                  Vodiči
                </GradientButton>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/alati">Alati</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Category Navigation */}
      <FadeIn delay={0.1}>
        <GlassCard hover={false} padding="sm" className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/vijesti">
              <Button variant="primary" size="sm">Sve</Button>
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/vijesti/kategorija/${category.slug}`}>
                <Button variant="ghost" size="sm">{category.name}</Button>
              </Link>
            ))}
            <div className="ml-auto flex-1 md:flex-initial md:min-w-[300px]">
              <NewsSearch />
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Category Sections */}
      {categoriesWithPosts.map(({ category, posts }) => (
        <CategorySection
          key={category.id}
          categoryName={category.name}
          categorySlug={category.slug}
          posts={posts.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
            featuredImageUrl: p.featuredImageUrl,
            featuredImageSource: p.featuredImageSource,
            impactLevel: p.impactLevel,
          }))}
        />
      ))}

      {/* Sidebar: Popular + Newsletter */}
      <aside className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FadeIn delay={0.2}>
          <GlassCard hover>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="tech" size="sm">
                <TrendingUp className="h-4 w-4" />
              </Badge>
              <h3 className="text-lg font-semibold text-white">Popularno</h3>
            </div>
            {popularPosts.length > 0 ? (
              <ul className="space-y-3">
                {popularPosts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/vijesti/${post.slug}`}
                      className="block rounded-lg px-2 py-1 transition-colors hover:bg-surface/5"
                    >
                      <p className="text-sm font-medium text-white line-clamp-2">{post.title}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {post.categoryName ?? "Vijesti"}
                        {post.publishedAt &&
                          ` • ${format(new Date(post.publishedAt), "d. MMM", { locale: hr })}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/50">Nema dovoljno podataka još.</p>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.3}>
          <GlassCard hover>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="tech" size="sm">
                <Calendar className="h-4 w-4" />
              </Badge>
              <h3 className="text-lg font-semibold text-white">Nadolazeći rokovi</h3>
            </div>
            <p className="text-sm text-white/50">
              Pogledajte kalendar rokova u aplikaciji.
            </p>
            <div className="mt-4">
              <a
                href="https://app.fiskai.hr/kalendar"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Otvori kalendar <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </GlassCard>
        </FadeIn>

        <NewsletterSignupStatic />
      </aside>
    </div>
  )
}
```

**Step 2: Update vijesti/[slug]/page.tsx with generateStaticParams**

Replace `src/app/(marketing)/vijesti/[slug]/page.tsx`:

```typescript
import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getAllPostSlugs,
  getPostBySlug,
  getRelatedPosts,
} from "@/lib/content/news"
import { ImageWithAttribution } from "@/components/news/ImageWithAttribution"
import { NewsMarkdown } from "@/components/news/NewsMarkdown"
import { PostCard } from "@/components/news/PostCard"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateNewsArticleSchema, generateBreadcrumbSchema } from "@/lib/schema/generators"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { Calendar, Tag } from "lucide-react"
import { SocialShare } from "@/components/news/SocialShare"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

// STATIC EXPORT - Generate all pages at build time
export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    return { title: "Vijest nije pronađena | FiskAI" }
  }

  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `${BASE_URL}/vijesti/${slug}` },
    openGraph: {
      type: "article",
      url: `${BASE_URL}/vijesti/${slug}`,
      title: post.title,
      description: post.excerpt || undefined,
      publishedTime: post.publishedAt,
      images: post.featuredImageUrl ? [{ url: post.featuredImageUrl }] : undefined,
    },
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(post.categorySlug, post.slug, 3)
  const articleUrl = `${BASE_URL}/vijesti/${slug}`

  const breadcrumbItems = [
    { name: "Početna", url: BASE_URL },
    { name: "Vijesti", url: `${BASE_URL}/vijesti` },
    ...(post.categoryName
      ? [{ name: post.categoryName, url: `${BASE_URL}/vijesti/kategorija/${post.categorySlug}` }]
      : []),
    { name: post.title, url: articleUrl },
  ]

  return (
    <>
      <JsonLd
        schemas={[
          generateNewsArticleSchema(
            post.title,
            post.excerpt,
            post.publishedAt,
            post.modifiedAt,
            articleUrl,
            post.featuredImageUrl || undefined
          ),
          generateBreadcrumbSchema(breadcrumbItems),
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/vijesti" className="hover:text-foreground">Vijesti</Link>
          {post.categoryName && (
            <>
              <span className="mx-2">/</span>
              <Link href={`/vijesti/kategorija/${post.categorySlug}`} className="hover:text-foreground">
                {post.categoryName}
              </Link>
            </>
          )}
        </nav>

        <article>
          {post.categoryName && (
            <Link
              href={`/vijesti/kategorija/${post.categorySlug}`}
              className="mb-4 inline-block rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text"
            >
              {post.categoryName}
            </Link>
          )}

          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">{post.title}</h1>

          <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.publishedAt}>
                {post.publishedAt && format(new Date(post.publishedAt), "d. MMMM yyyy.", { locale: hr })}
              </time>
            </div>
            {post.impactLevel && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  post.impactLevel === "high"
                    ? "bg-danger-bg text-danger-text"
                    : post.impactLevel === "medium"
                      ? "bg-warning-bg text-warning-text"
                      : "bg-success-bg text-success-text"
                }`}
              >
                {post.impactLevel === "high" ? "Visok utjecaj" : post.impactLevel === "medium" ? "Srednji utjecaj" : "Nizak utjecaj"}
              </span>
            )}
          </div>

          <SocialShare url={articleUrl} title={post.title} description={post.excerpt || undefined} />

          {post.tags.length > 0 && (
            <div className="my-8 flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-muted" />
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/vijesti/tag/${tag}`}
                  className="rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {post.featuredImageUrl && (
            <div className="mb-8">
              <div className="relative aspect-[21/9] overflow-hidden rounded-xl">
                <ImageWithAttribution
                  src={post.featuredImageUrl}
                  source={post.featuredImageSource}
                  alt={post.title}
                  className="h-full w-full"
                />
              </div>
              {post.featuredImageCaption && (
                <p className="mt-2 text-sm italic text-muted">{post.featuredImageCaption}</p>
              )}
            </div>
          )}

          {post.tldr && (
            <div className="my-8 rounded-xl border border-info-border bg-info-bg p-6">
              <h2 className="mb-3 text-lg font-semibold">TL;DR</h2>
              <p className="text-sm">{post.tldr}</p>
            </div>
          )}

          <NewsMarkdown content={post.content} />

          {post.actionItems && post.actionItems.length > 0 && (
            <div className="my-8 rounded-xl border border-success-border/20 bg-success-bg/10 p-6">
              <h2 className="mb-4 text-lg font-semibold text-success-text">Što napraviti</h2>
              <ul className="space-y-2">
                {post.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className="text-success-text">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        {relatedPosts.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold text-foreground">Srodne vijesti</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <PostCard
                  key={relatedPost.id}
                  slug={relatedPost.slug}
                  title={relatedPost.title}
                  excerpt={relatedPost.excerpt}
                  categoryName={relatedPost.categoryName || undefined}
                  categorySlug={relatedPost.categorySlug || undefined}
                  publishedAt={relatedPost.publishedAt ? new Date(relatedPost.publishedAt) : new Date()}
                  featuredImageUrl={relatedPost.featuredImageUrl}
                  featuredImageSource={relatedPost.featuredImageSource}
                  impactLevel={relatedPost.impactLevel}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
```

**Step 3: Update category and tag pages similarly**

Each needs `generateStaticParams` and WordPress content fetching.

**Step 4: Delete the old static-data.ts (Drizzle-based)**

```bash
rm -f src/lib/news/static-data.ts
```

**Step 5: Commit**

```bash
git add src/app/\(marketing\)/vijesti/
git rm src/lib/news/static-data.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(news): convert news pages to WordPress content source

- Replace Drizzle queries with WordPress REST API
- Add generateStaticParams for all news routes
- Remove force-dynamic - pages are fully static
- Delete old static-data.ts (Drizzle-based)

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Convert Status Page to Static

**Files:**

- Modify: `src/app/(marketing)/status/page.tsx`

**Step 1: Replace with fully static status page**

Replace `src/app/(marketing)/status/page.tsx`:

```typescript
import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { ExternalLink, CheckCircle2 } from "lucide-react"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
const APP_URL = "https://app.fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Status",
  description: "Status sustava i informacije o dostupnosti FiskAI platforme.",
  alternates: { canonical: `${BASE_URL}/status` },
}

// STATIC - No runtime dependencies, no DB, no health checks
export default function StatusPage() {
  return (
    <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold text-white/90">Status sustava</h1>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg p-6 backdrop-blur-sm border bg-success-bg0/10 border-success-border/20 text-success-text">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6" />
              <h2 className="text-xl font-semibold">Sustav operativan</h2>
            </div>
            <p className="mt-2 text-white/60">
              Za detaljni status u realnom vremenu, posjetite kontrolnu ploču aplikacije.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">Provjera statusa u realnom vremenu</h3>
            <p className="mt-2 text-white/60">
              Detaljne metrike sustava dostupne su u aplikaciji.
            </p>
            <div className="mt-4">
              <a
                href={`${APP_URL}/status`}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-accent to-interactive px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Otvori kontrolnu ploču
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">API endpoint za monitoring</h3>
            <div className="mt-4">
              <code className="block rounded bg-surface/5 border border-white/10 p-3 font-mono text-sm text-primary">
                GET {APP_URL}/api/health
              </code>
              <p className="mt-2 text-sm text-white/60">
                Vraća JSON s statusom sustava. Za integraciju s monitoring alatima.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">Kontakt za hitne slučajeve</h3>
            <p className="mt-2 text-white/60">
              Ako imate problema s pristupom sustavu:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>Email: <a href="mailto:podrska@fiskai.hr" className="text-primary hover:underline">podrska@fiskai.hr</a></li>
              <li>Odgovor unutar 24h radnim danima</li>
            </ul>
          </div>
        </div>
      </div>
    </SectionBackground>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(marketing\)/status/page.tsx
git commit -m "$(cat <<'EOF'
fix(status): convert status page to fully static

- Remove getDetailedHealth import and runtime DB checks
- Static page with link to app.fiskai.hr/status for live metrics
- No runtime dependencies

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Create Static Newsletter Component

**Files:**

- Create: `src/components/news/NewsletterSignupStatic.tsx`

**Step 1: Create static newsletter component with external form handler**

Create `src/components/news/NewsletterSignupStatic.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Mail, Loader2, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { FadeIn } from "@/components/ui/motion/FadeIn"

// External form handler (Buttondown, ConvertKit, Formspree, etc.)
const NEWSLETTER_FORM_URL = process.env.NEXT_PUBLIC_NEWSLETTER_FORM_URL ||
  "https://buttondown.email/api/emails/embed-subscribe/fiskai"

export function NewsletterSignupStatic() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("Molimo unesite email adresu")
      return
    }

    setIsPending(true)

    try {
      const response = await fetch(NEWSLETTER_FORM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: email,
          tag: "marketing_vijesti",
        }),
      })

      // Buttondown returns 303 on success
      if (response.ok || response.status === 303) {
        setIsSubmitted(true)
        setEmail("")
      } else {
        setError("Došlo je do greške. Molimo pokušajte ponovno.")
      }
    } catch {
      setError("Došlo je do greške. Molimo pokušajte ponovno.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <FadeIn delay={0.4}>
      <GlassCard hover>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="tech" size="sm">
            <Mail className="h-4 w-4" />
          </Badge>
          <h3 className="text-lg font-semibold text-white">Newsletter</h3>
        </div>
        <p className="mb-4 text-sm text-white/60">
          Primajte tjedni pregled najvažnijih poreznih vijesti direktno na email.
        </p>

        {isSubmitted ? (
          <div className="flex items-center gap-2 rounded-lg border border-success-border/20 bg-success/10 px-4 py-3 text-sm text-success">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>Uspješno ste se pretplatili!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas.email@example.com"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-surface/5 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-accent/50 focus:outline-none disabled:opacity-50"
              required
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-gradient-to-r from-accent to-interactive px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pretplaćujem...
                </span>
              ) : (
                "Pretplati se"
              )}
            </button>
          </form>
        )}

        <p className="mt-3 text-xs text-white/40">Bez spama. Možete se odjaviti bilo kada.</p>
      </GlassCard>
    </FadeIn>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/news/NewsletterSignupStatic.tsx
git commit -m "$(cat <<'EOF'
feat(newsletter): add static newsletter signup with external handler

- Client-side form submission to external API (Buttondown)
- No server actions, no database dependency
- Works on static hosting

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: Browser-Only Payment Slip Generator

**Files:**

- Create: `src/lib/pausalni/payment-slips/browser-generator.ts`

**Step 1: Create browser-compatible barcode generator**

Create `src/lib/pausalni/payment-slips/browser-generator.ts`:

```typescript
/**
 * Browser-Only HUB-3A Payment Slip Generator
 *
 * Generates PDF417 barcodes entirely in the browser using bwip-js Canvas API.
 * No server dependencies - works offline on static hosting.
 */

import { DOPRINOSI_2025, PDV_CONFIG, CROATIAN_MONTHS, HOK_CONFIG } from "../constants"

export interface PaymentSlipData {
  payerName: string
  payerAddress: string
  payerCity: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIban: string
  amount: number
  currency?: string
  model: string
  reference: string
  purposeCode?: string
  description: string
}

function truncate(str: string, maxLength: number): string {
  if (!str) return ""
  return str.length <= maxLength ? str : str.substring(0, maxLength)
}

/**
 * Format data according to HUB-3A specification
 */
export function formatHub3aData(data: PaymentSlipData): string {
  const currency = data.currency || "EUR"

  if (data.reference && data.reference.length > 22) {
    throw new Error(`Poziv na broj predugačak: ${data.reference.length} (max 22)`)
  }

  const amountCents = Math.round(data.amount * 100)
  const amountStr = String(amountCents).padStart(15, "0")

  return [
    "HRVHUB30",
    currency,
    amountStr,
    truncate(data.payerName, 30),
    truncate(data.payerAddress, 27),
    truncate(data.payerCity, 27),
    truncate(data.recipientName, 25),
    truncate(data.recipientAddress, 25),
    truncate(data.recipientCity, 27),
    data.recipientIban,
    data.model,
    data.reference,
    data.purposeCode || "OTHR",
    truncate(data.description, 35),
  ].join("\n")
}

/**
 * Generate PDF417 barcode as data URL using bwip-js in browser
 */
export async function generateBarcodeDataUrl(data: PaymentSlipData): Promise<string> {
  const bwipjs = await import("bwip-js")
  const hub3aText = formatHub3aData(data)

  const canvas = document.createElement("canvas")

  bwipjs.toCanvas(canvas, {
    bcid: "pdf417",
    text: hub3aText,
    scale: 2,
    height: 15,
    includetext: false,
    padding: 5,
  })

  return canvas.toDataURL("image/png")
}

/**
 * Generate doprinosi payment slip
 */
export function generateDoprinosiSlip(
  type: "MIO_I" | "MIO_II" | "ZDRAVSTVENO",
  oib: string,
  payer: { name: string; address: string; city: string },
  month: number,
  year: number
): PaymentSlipData {
  const config = DOPRINOSI_2025[type]
  const months = [
    "siječanj",
    "veljača",
    "ožujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ]

  return {
    payerName: payer.name,
    payerAddress: payer.address,
    payerCity: payer.city,
    recipientName: config.recipientName,
    recipientAddress: "Zagreb",
    recipientCity: "10000 Zagreb",
    recipientIban: config.iban,
    amount: config.amount,
    model: config.model,
    reference: `${config.referencePrefix}-${oib}`,
    purposeCode: "OTHR",
    description: `${config.description} ${months[month - 1]} ${year}`,
  }
}

/**
 * Generate PDV payment slip
 */
export function generatePdvSlip(
  oib: string,
  amount: number,
  payer: { name: string; address: string; city: string },
  month: number,
  year: number
): PaymentSlipData {
  return {
    payerName: payer.name,
    payerAddress: payer.address,
    payerCity: payer.city,
    recipientName: PDV_CONFIG.recipientName,
    recipientAddress: "Zagreb",
    recipientCity: "10000 Zagreb",
    recipientIban: PDV_CONFIG.iban,
    amount,
    model: PDV_CONFIG.model,
    reference: `${PDV_CONFIG.referencePrefix}-${oib}`,
    purposeCode: "TAXS",
    description: `PDV za ${CROATIAN_MONTHS[month - 1]} ${year}`,
  }
}

export { DOPRINOSI_2025, PDV_CONFIG, HOK_CONFIG }
```

**Step 2: Commit**

```bash
git add src/lib/pausalni/payment-slips/browser-generator.ts
git commit -m "$(cat <<'EOF'
feat(payment-slips): add browser-only barcode generator

- Use bwip-js Canvas API for client-side PDF417 generation
- No Buffer.from() or Node.js dependencies
- Works offline on static hosting

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.7: Update Next.js Config for Static Export

**Files:**

- Modify: `next.config.ts`

**Step 1: Configure static export**

Add to `next.config.ts` (marketing build):

```typescript
const config: NextConfig = {
  output: "export", // Static export to out/
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true, // Better for static hosting
  // ... existing config
}
```

**Step 2: Commit**

```bash
git add next.config.ts
git commit -m "$(cat <<'EOF'
build: configure Next.js for static export

- Set output: "export" to produce out/ directory
- Enable unoptimized images for static hosting
- Add trailing slashes for clean URLs

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.8: Create Redirect Rules for Static Host

**Files:**

- Create: `docs/REDIRECT_RULES.md`
- Create: `public/.htaccess`

**Step 1: Create redirect rules documentation**

Create `docs/REDIRECT_RULES.md`:

````markdown
# Marketing Site Redirect Rules

Redirects for auth paths to app.fiskai.hr.
Next.js middleware does NOT work on static hosting - these must be configured at host level.

## Apache (.htaccess)

Place in web root or include in Apache config:

```apache
RewriteEngine On

# Redirect /login to app
RewriteRule ^login/?$ https://app.fiskai.hr/login [R=301,L]

# Redirect /register to app
RewriteRule ^register/?$ https://app.fiskai.hr/register [R=301,L]

# Redirect /app/* to app subdomain
RewriteRule ^app/(.*)$ https://app.fiskai.hr/$1 [R=301,L]

# Redirect /forgot-password to app
RewriteRule ^forgot-password/?$ https://app.fiskai.hr/forgot-password [R=301,L]

# Redirect /reset-password to app
RewriteRule ^reset-password/?$ https://app.fiskai.hr/reset-password [R=301,L]
```
````

## Nginx

Add to server block:

```nginx
location = /login {
    return 301 https://app.fiskai.hr/login;
}

location = /register {
    return 301 https://app.fiskai.hr/register;
}

location ^~ /app/ {
    rewrite ^/app/(.*)$ https://app.fiskai.hr/$1 permanent;
}

location = /forgot-password {
    return 301 https://app.fiskai.hr/forgot-password;
}

location = /reset-password {
    return 301 https://app.fiskai.hr/reset-password;
}
```

## SiteGround Panel

If using SiteGround's Site Tools:

1. Go to Site > Speed > Redirects
2. Add each redirect manually:
   - Source: `/login` → Target: `https://app.fiskai.hr/login` (301)
   - Source: `/register` → Target: `https://app.fiskai.hr/register` (301)
   - etc.

## Verification

After deployment, test:

```bash
curl -I https://fiskai.hr/login
# Should return: HTTP/1.1 301 Moved Permanently
# Location: https://app.fiskai.hr/login
```

````

**Step 2: Create .htaccess file**

Create `public/.htaccess`:

```apache
RewriteEngine On

# Auth redirects to app subdomain
RewriteRule ^login/?$ https://app.fiskai.hr/login [R=301,L]
RewriteRule ^register/?$ https://app.fiskai.hr/register [R=301,L]
RewriteRule ^forgot-password/?$ https://app.fiskai.hr/forgot-password [R=301,L]
RewriteRule ^reset-password/?$ https://app.fiskai.hr/reset-password [R=301,L]
RewriteRule ^app/(.*)$ https://app.fiskai.hr/$1 [R=301,L]

# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set Referrer-Policy "strict-origin-when-cross-origin"

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/html "access plus 1 hour"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
````

**Step 3: Commit**

```bash
git add docs/REDIRECT_RULES.md public/.htaccess
git commit -m "$(cat <<'EOF'
docs: add redirect rules for static hosting

- Apache .htaccess for auth redirects to app.fiskai.hr
- Nginx config example
- SiteGround panel instructions
- No Next.js middleware - host-level redirects only

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.9: Phase 1 Acceptance Test

**Files:**

- Create: `scripts/test-marketing-static.sh`

**Step 1: Create acceptance test script**

Create `scripts/test-marketing-static.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "=== Marketing Static Purity Acceptance Test ==="
echo ""

cd /home/admin/FiskAI

# Step 1: Check for forbidden patterns in marketing code
echo "Step 1: Checking for forbidden patterns..."

FORBIDDEN_PATTERNS=(
  "force-dynamic"
  '"use server"'
  "next/server"
  "@/lib/db/drizzle"
  "@/lib/db/core"
  "@prisma/client"
  "@/lib/auth\""
  "from \"@/lib/auth\""
  "getDetailedHealth"
  "checkRateLimit"
)

MARKETING_DIRS=(
  "src/app/(marketing)"
  "src/components/marketing"
  "src/components/news"
)

VIOLATIONS=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  for dir in "${MARKETING_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      if grep -r "$pattern" "$dir" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "test-marketing-static.sh"; then
        echo "VIOLATION: Found '$pattern' in $dir"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  done
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "FAILED: $VIOLATIONS forbidden pattern violations"
  exit 1
fi
echo "OK: No forbidden patterns"

# Step 2: Build without DATABASE_URL
echo ""
echo "Step 2: Building with DB offline..."

unset DATABASE_URL
unset REDIS_URL

# Set WP fallback for build
export WP_BASE_URL=""  # Empty = use JSON fallback

if ! pnpm build 2>&1 | tee /tmp/build-output.log; then
  echo "FAILED: Build failed"
  exit 1
fi

# Step 3: Verify out/ directory exists
echo ""
echo "Step 3: Verifying static output..."

if [ ! -d "out" ]; then
  echo "FAILED: out/ directory not created"
  exit 1
fi

EXPECTED_FILES=(
  "out/index.html"
  "out/vijesti/index.html"
  "out/status/index.html"
  "out/contact/index.html"
  "out/pricing/index.html"
)

for file in "${EXPECTED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "FAILED: $file not found"
    exit 1
  fi
done
echo "OK: Static files generated"

# Step 4: Serve and test with dumb static server
echo ""
echo "Step 4: Testing with static server..."

npx serve out -p 3001 &
SERVER_PID=$!
sleep 3

PAGES_TO_TEST=(
  "http://localhost:3001/"
  "http://localhost:3001/vijesti/"
  "http://localhost:3001/status/"
  "http://localhost:3001/contact/"
  "http://localhost:3001/pricing/"
)

TEST_FAILED=0
for url in "${PAGES_TO_TEST[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$STATUS" = "200" ]; then
    echo "OK: $url -> $STATUS"
  else
    echo "FAILED: $url -> $STATUS"
    TEST_FAILED=1
  fi
done

kill $SERVER_PID 2>/dev/null || true

if [ $TEST_FAILED -eq 1 ]; then
  echo ""
  echo "FAILED: Some pages not accessible"
  exit 1
fi

# Step 5: Final summary
echo ""
echo "=== Phase 1 Acceptance Test PASSED ==="
echo ""
echo "Verified:"
echo "  - No forbidden imports in marketing code"
echo "  - Build succeeds without DATABASE_URL"
echo "  - Static out/ directory created"
echo "  - All marketing pages serve from static server"
```

**Step 2: Make executable and run**

```bash
chmod +x scripts/test-marketing-static.sh
./scripts/test-marketing-static.sh
```

**Step 3: Commit**

```bash
git add scripts/test-marketing-static.sh
git commit -m "$(cat <<'EOF'
test: add Phase 1 marketing static acceptance test

- Check for forbidden patterns (drizzle, auth, force-dynamic, etc.)
- Verify build succeeds with DATABASE_URL unset
- Confirm out/ directory is created
- Test static serving with npx serve (not pnpm preview)

Part of marketing static separation Phase 1.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Hard Boundary Enforcement

**Objective:** Make it mechanically impossible to reintroduce coupling.

**Acceptance Gate:**

- An intentional forbidden import causes hard build/CI failure
- Passing build proves isolation is enforced by tooling

---

### Task 2.1: Create ESLint Rule for Marketing Boundary

**Files:**

- Create: `eslint-rules/no-marketing-forbidden-imports.cjs`
- Modify: `eslint.config.mjs`

**Step 1: Create custom ESLint rule**

Create `eslint-rules/no-marketing-forbidden-imports.cjs`:

```javascript
/**
 * ESLint rule to enforce marketing static isolation
 *
 * BLOCKS in src/app/(marketing)/ and src/components/marketing/ and src/components/news/:
 * - Database imports (drizzle, prisma)
 * - Auth imports
 * - Server actions ("use server")
 * - Next.js server modules (next/server)
 * - force-dynamic export
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow runtime imports in marketing code",
      category: "Marketing Static Isolation",
    },
    messages: {
      forbiddenImport: "Marketing cannot import '{{module}}'. Marketing must be 100% static.",
      forbiddenDirective: "Marketing cannot use '{{directive}}'. No server code allowed.",
      forbiddenExport: "Marketing cannot export '{{name}}' = '{{value}}'. Must be static.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename()

    // Only apply to marketing code
    const isMarketing =
      filename.includes("(marketing)") ||
      filename.includes("components/marketing") ||
      filename.includes("components/news")

    if (!isMarketing) return {}

    const FORBIDDEN_IMPORTS = [
      "@/lib/auth",
      "@/lib/db/drizzle",
      "@/lib/db/core",
      "@/lib/db/regulatory",
      "@prisma/client",
      "@/lib/auth-utils",
      "@/lib/monitoring/system-health",
      "@/lib/security/rate-limit",
      "@/lib/actions/newsletter",
      "@/app/actions",
      "next/server",
    ]

    return {
      // Check imports
      ImportDeclaration(node) {
        const source = node.source.value
        for (const forbidden of FORBIDDEN_IMPORTS) {
          if (source === forbidden || source.startsWith(forbidden + "/")) {
            context.report({
              node,
              messageId: "forbiddenImport",
              data: { module: source },
            })
          }
        }
      },

      // Check "use server" directive
      ExpressionStatement(node) {
        if (node.expression.type === "Literal" && node.expression.value === "use server") {
          context.report({
            node,
            messageId: "forbiddenDirective",
            data: { directive: "use server" },
          })
        }
      },

      // Check force-dynamic export
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === "VariableDeclaration") {
          for (const decl of node.declaration.declarations) {
            if (
              decl.id.name === "dynamic" &&
              decl.init?.type === "Literal" &&
              decl.init.value === "force-dynamic"
            ) {
              context.report({
                node,
                messageId: "forbiddenExport",
                data: { name: "dynamic", value: "force-dynamic" },
              })
            }
          }
        }
      },
    }
  },
}
```

**Step 2: Register in ESLint config**

Add to `eslint.config.mjs`:

```javascript
import noMarketingForbiddenImports from "./eslint-rules/no-marketing-forbidden-imports.cjs"

// Add to plugins and rules:
{
  plugins: {
    "marketing-static": {
      rules: {
        "no-forbidden-imports": noMarketingForbiddenImports,
      },
    },
  },
  rules: {
    "marketing-static/no-forbidden-imports": "error",
  },
}
```

**Step 3: Commit**

```bash
git add eslint-rules/no-marketing-forbidden-imports.cjs eslint.config.mjs
git commit -m "$(cat <<'EOF'
feat(lint): add ESLint rule for marketing static boundary

- Block drizzle, prisma, auth imports in marketing
- Block "use server" directive
- Block force-dynamic export
- Build fails on any violation

Part of marketing static separation Phase 2.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Add CI Check for Static Purity

**Files:**

- Modify: `.github/workflows/ci.yml`

**Step 1: Add marketing static check job**

Add to `.github/workflows/ci.yml`:

```yaml
marketing-static-check:
  name: Marketing Static Purity
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v2
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "pnpm"

    - run: pnpm install --frozen-lockfile

    - name: Check forbidden patterns
      run: |
        PATTERNS=(
          "force-dynamic"
          "\"use server\""
          "next/server"
          "@/lib/db/drizzle"
          "@/lib/db/core"
          "@prisma/client"
          "@/lib/auth\""
        )

        DIRS="src/app/(marketing) src/components/marketing src/components/news"
        VIOLATIONS=0

        for pattern in "${PATTERNS[@]}"; do
          for dir in $DIRS; do
            if [ -d "$dir" ]; then
              if grep -rE "$pattern" "$dir" --include="*.tsx" --include="*.ts" 2>/dev/null; then
                echo "::error::Found '$pattern' in $dir"
                VIOLATIONS=$((VIOLATIONS + 1))
              fi
            fi
          done
        done

        if [ $VIOLATIONS -gt 0 ]; then
          exit 1
        fi
        echo "Marketing static purity verified"

    - name: Lint marketing code
      run: pnpm lint

    - name: Verify static build (no DB)
      run: |
        unset DATABASE_URL
        export WP_BASE_URL=""
        pnpm build
        test -d out || (echo "::error::out/ not created" && exit 1)
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: add marketing static purity check to CI

- Block PRs with forbidden patterns
- Run ESLint marketing rules
- Verify build without DATABASE_URL
- Confirm out/ directory created

Part of marketing static separation Phase 2.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Document Enforcement

**Files:**

- Create: `docs/architecture/MARKETING_STATIC_BOUNDARY.md`

**Step 1: Create documentation**

Create `docs/architecture/MARKETING_STATIC_BOUNDARY.md`:

```markdown
# Marketing Static Boundary

Marketing site (fiskai.hr) is 100% static at runtime. This document describes enforcement mechanisms.

## Invariants

1. Marketing builds to `out/` directory (static HTML/CSS/JS)
2. Marketing builds without DATABASE_URL set
3. No runtime server code in marketing
4. Content comes from WordPress REST API (build time only)
5. No auth/session handling on marketing
6. Redirects handled at host level (.htaccess), not middleware

## Enforcement Layers

### 1. ESLint Rule

`marketing-static/no-forbidden-imports` blocks:

- `@/lib/db/*` (drizzle, prisma)
- `@/lib/auth*`
- `next/server`
- `"use server"` directive
- `force-dynamic` export

### 2. CI Job

`marketing-static-check` verifies:

- No forbidden patterns in code
- Build succeeds without DATABASE_URL
- `out/` directory is created

### 3. Build Configuration

`next.config.ts` enforces:

- `output: "export"` (static export)
- `images.unoptimized: true` (no image optimization API)

## Allowed Data Sources

| Source            | When             | Purpose             |
| ----------------- | ---------------- | ------------------- |
| WordPress REST    | Build time       | News content        |
| JSON fallback     | Build time       | Development/offline |
| External form API | Runtime (client) | Newsletter signup   |

## Forbidden in Marketing

- Database imports (Drizzle, Prisma)
- Auth modules
- Server actions
- Middleware
- API routes
- getServerSideProps
- force-dynamic

## Adding New Marketing Features

1. Content must come from WordPress or static JSON
2. All interactivity must be client-side only
3. Form submissions go to external handlers
4. Run `pnpm lint` before committing
5. CI will block forbidden patterns
```

**Step 2: Commit**

```bash
git add docs/architecture/MARKETING_STATIC_BOUNDARY.md
git commit -m "$(cat <<'EOF'
docs: add marketing static boundary documentation

- Document invariants and enforcement layers
- List allowed and forbidden patterns
- Guide for adding new features

Part of marketing static separation Phase 2.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Repository Split

**Objective:** Remove blast radius permanently by separating marketing into its own repo.

**Acceptance Gate:**

- Marketing repo builds independently
- Output is `out/` directory with static files only
- No dependency on app repo at build or runtime

---

### Task 3.1: Create Marketing Repository

**Step 1: Initialize repository**

```bash
mkdir -p /home/admin/fiskai-marketing
cd /home/admin/fiskai-marketing
git init
```

**Step 2: Copy marketing code**

```bash
# From FiskAI repo
cd /home/admin/FiskAI

# Marketing pages (flatten route group)
mkdir -p /home/admin/fiskai-marketing/src/app
cp -r src/app/\(marketing\)/* /home/admin/fiskai-marketing/src/app/

# Components
cp -r src/components/marketing /home/admin/fiskai-marketing/src/components/
cp -r src/components/news /home/admin/fiskai-marketing/src/components/
cp -r src/components/ui /home/admin/fiskai-marketing/src/components/
cp -r src/components/seo /home/admin/fiskai-marketing/src/components/

# Lib (static only)
cp -r src/lib/wordpress /home/admin/fiskai-marketing/src/lib/
cp -r src/lib/content /home/admin/fiskai-marketing/src/lib/
cp -r src/lib/pausalni /home/admin/fiskai-marketing/src/lib/
cp -r src/lib/schema /home/admin/fiskai-marketing/src/lib/
cp src/lib/utils.ts /home/admin/fiskai-marketing/src/lib/

# Content fallback
cp -r content /home/admin/fiskai-marketing/

# Config
cp tailwind.config.ts tsconfig.json /home/admin/fiskai-marketing/

# Public assets
cp -r public /home/admin/fiskai-marketing/

# Docs
cp docs/REDIRECT_RULES.md /home/admin/fiskai-marketing/docs/
```

**Step 3: Create package.json**

Create `/home/admin/fiskai-marketing/package.json`:

```json
{
  "name": "fiskai-marketing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint . --ext .ts,.tsx",
    "test:static": "./scripts/test-static.sh"
  },
  "dependencies": {
    "next": "15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "bwip-js": "^4.8.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "eslint": "^9.0.0"
  }
}
```

**Step 4: Create next.config.ts**

Create `/home/admin/fiskai-marketing/next.config.ts`:

```typescript
import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
}

export default config
```

**Step 5: Initial commit**

```bash
cd /home/admin/fiskai-marketing
git add .
git commit -m "$(cat <<'EOF'
Initial marketing site setup

Static-only marketing site for fiskai.hr
- Content from WordPress REST API
- Static export to out/
- No backend dependencies

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Setup Build Pipeline

**Files:**

- Create: `/home/admin/fiskai-marketing/.github/workflows/build.yml`

**Step 1: Create GitHub Actions workflow**

```yaml
name: Build Marketing Site

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 5 * * *" # Daily at 5am UTC
  workflow_dispatch:

env:
  WP_BASE_URL: ${{ secrets.WP_BASE_URL }}
  NEXT_PUBLIC_APP_URL: https://fiskai.hr
  NEXT_PUBLIC_NEWSLETTER_FORM_URL: ${{ secrets.NEWSLETTER_FORM_URL }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Build static site
        run: pnpm build

      - name: Verify output
        run: |
          test -d out || exit 1
          test -f out/index.html || exit 1
          echo "Static build successful"

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: marketing-site
          path: out/
          retention-days: 7

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: marketing-site
          path: out/

      - name: Deploy to SiteGround
        run: |
          # Upload out/ to SiteGround via SFTP or rsync
          # Configure SITEGROUND_HOST, SITEGROUND_USER, SITEGROUND_KEY in secrets
          echo "Deploy step - configure for SiteGround"
```

**Step 2: Commit**

```bash
cd /home/admin/fiskai-marketing
git add .github/
git commit -m "$(cat <<'EOF'
ci: add build and deploy workflow

- Build static site on push/PR
- Daily rebuild at 5am UTC
- Upload artifact for deployment

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: URL Mapping Documentation

**Files:**

- Create: `/home/admin/fiskai-marketing/docs/URL_MAP.md`

Create `/home/admin/fiskai-marketing/docs/URL_MAP.md`:

```markdown
# URL Mapping

All URLs on fiskai.hr (marketing) and their handling.

## Static Pages (served from out/)

| Path                          | Description          |
| ----------------------------- | -------------------- |
| `/`                           | Homepage             |
| `/vijesti/`                   | News hub             |
| `/vijesti/{slug}/`            | News article         |
| `/vijesti/kategorija/{slug}/` | News by category     |
| `/vijesti/tag/{slug}/`        | News by tag          |
| `/status/`                    | Status page (static) |
| `/contact/`                   | Contact page         |
| `/pricing/`                   | Pricing              |
| `/features/`                  | Features             |
| `/vodic/{slug}/`              | Guides               |
| `/alati/*`                    | Tools                |
| `/privacy/`                   | Privacy policy       |
| `/terms/`                     | Terms                |

## Redirects (via .htaccess)

| Path               | Destination                             | Type |
| ------------------ | --------------------------------------- | ---- |
| `/login`           | `https://app.fiskai.hr/login`           | 301  |
| `/register`        | `https://app.fiskai.hr/register`        | 301  |
| `/app/*`           | `https://app.fiskai.hr/*`               | 301  |
| `/forgot-password` | `https://app.fiskai.hr/forgot-password` | 301  |
| `/reset-password`  | `https://app.fiskai.hr/reset-password`  | 301  |

## Notes

- All static pages have trailing slashes
- .htaccess handles redirects (no middleware)
- 404 handled by static 404.html
```

---

## Phase 4: Static Deployment

**Objective:** Deploy to SiteGround and verify production behavior.

**Acceptance Gate:**

- Marketing works during total backend outage
- News updates only via rebuild + deploy
- No runtime services required

---

### Task 4.1: Deploy to SiteGround

**Step 1: Build locally**

```bash
cd /home/admin/fiskai-marketing
pnpm install
pnpm build
```

**Step 2: Upload to SiteGround**

Options:

1. **SFTP**: Upload `out/` contents to `public_html/`
2. **Git deploy**: Push to SiteGround git remote
3. **File Manager**: Upload via SiteGround Site Tools

**Step 3: Configure redirects**

Ensure `.htaccess` is in web root with redirect rules.

---

### Task 4.2: Outage Test

**Step 1: Simulate backend outage**

```bash
# On test environment, stop all backend services
docker stop fiskai-db fiskai-redis

# Verify marketing still works
curl -I https://fiskai.hr/
curl -I https://fiskai.hr/vijesti/
curl -I https://fiskai.hr/status/
```

**Step 2: Verify redirects**

```bash
curl -I https://fiskai.hr/login
# Expected: 301 -> https://app.fiskai.hr/login
```

**Step 3: Document results**

Create `docs/PHASE4_ACCEPTANCE.md`:

```markdown
# Phase 4 Acceptance Report

## Deployment

- [x] `out/` uploaded to SiteGround
- [x] .htaccess redirects configured
- [x] SSL working

## Outage Test

- [x] Backend offline (DB, Redis, workers stopped)
- [x] Marketing pages load successfully
- [x] No errors in browser console

## Verification

| Page        | Status     |
| ----------- | ---------- |
| `/`         | 200 OK     |
| `/vijesti/` | 200 OK     |
| `/status/`  | 200 OK     |
| `/contact/` | 200 OK     |
| `/login`    | 301 -> app |

## Daily Rebuild

- [x] GitHub Action scheduled at 5am UTC
- [x] Webhook available for manual trigger

## Date: [DATE]
```

---

## Final Deliverables Checklist

### Phase 1: Static Purity Report

- [ ] Auth removed from marketing layout
- [ ] News pages use WordPress content
- [ ] Status page is static
- [ ] Newsletter uses external handler
- [ ] Payment slips browser-only
- [ ] Acceptance test passes

### Phase 2: Boundary Enforcement Proof

- [ ] ESLint rule blocks forbidden imports
- [ ] CI job fails on violations
- [ ] Intentional violation → build fails
- [ ] Clean code → build passes

### Phase 3: Repo Split Report

- [ ] Marketing repo builds independently
- [ ] No FiskAI repo dependency
- [ ] `pnpm build` produces `out/`
- [ ] URL map documented

### Phase 4: Deployment Proof

- [ ] Deployed to SiteGround
- [ ] Daily rebuild scheduled
- [ ] Backend outage test passed
- [ ] Redirects verified

---

## Quick Reference

### Forbidden in Marketing

```typescript
// NEVER use in marketing:
import { auth } from "@/lib/auth" // ❌
import { drizzleDb } from "@/lib/db/drizzle" // ❌
import { db } from "@/lib/db" // ❌
;("use server") // ❌
export const dynamic = "force-dynamic" // ❌
import { NextRequest } from "next/server" // ❌
```

### Allowed in Marketing

```typescript
// BUILD TIME content fetch:
import { getPostBySlug } from "@/lib/content/news"

// CLIENT SIDE interactivity:
;("use client")
const [state, setState] = useState()

// EXTERNAL form submission:
await fetch("https://buttondown.email/api/...")

// BROWSER barcode generation:
import { generateBarcodeDataUrl } from "@/lib/pausalni/payment-slips/browser-generator"
```

### Commands

```bash
# Build static site
pnpm build

# Test static output
npx serve out -p 3001

# Run acceptance test
./scripts/test-marketing-static.sh

# Trigger rebuild (via GitHub)
gh workflow run build.yml
```
