# Vijesti Homepage Enhancement & News Section Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add news section to homepage, implement functional search, fix pagination, and improve subcategory UX.

**Architecture:** Server-side search with URL params for shareability, client-side progressive enhancement. Homepage uses a compact LatestNews component that fetches 3-4 recent posts. Category pages get proper SQL count queries.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, PostgreSQL full-text search, CVA design system components

---

## Task 1: Homepage News Section Component

**Files:**

- Create: `src/components/news/LatestNewsSection.tsx`
- Modify: `src/components/marketing/MarketingHomeClient.tsx`

**Step 1: Write the LatestNewsSection component**

Create a new component that displays 3-4 latest news posts in a compact format matching the existing design system.

```tsx
// src/components/news/LatestNewsSection.tsx
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { ArrowRight, Newspaper } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"

interface NewsPost {
  slug: string
  title: string
  excerpt: string | null
  categoryName: string | null
  publishedAt: Date | null
}

interface LatestNewsSectionProps {
  posts: NewsPost[]
}

export function LatestNewsSection({ posts }: LatestNewsSectionProps) {
  if (posts.length === 0) return null

  return (
    <section className="bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <Reveal className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-4">
            <Newspaper className="h-4 w-4" />
            Porezne vijesti
          </div>
          <h2 className="text-display text-3xl font-semibold">Najnovije vijesti</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--muted)]">
            Pratimo Poreznu upravu, Narodne novine i FINA-u. AI automatski filtrira i sažima vijesti
            relevantne za vaše poslovanje.
          </p>
        </Reveal>

        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => (
            <StaggerItem key={post.slug}>
              <Link href={`/vijesti/${post.slug}`} className="group block h-full">
                <Card className="card h-full transition-all group-hover:shadow-lg group-hover:border-blue-300 group-hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    {post.categoryName && (
                      <span className="text-xs font-medium text-blue-600 mb-1 block">
                        {post.categoryName}
                      </span>
                    )}
                    <CardTitle className="text-sm leading-tight line-clamp-2">
                      {post.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {post.excerpt && (
                      <p className="text-xs text-[var(--muted)] line-clamp-2 mb-2">
                        {post.excerpt}
                      </p>
                    )}
                    {post.publishedAt && (
                      <time className="text-xs text-[var(--muted)]">
                        {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
                      </time>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-8 text-center">
          <Link
            href="/vijesti"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            Sve vijesti <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Create server action to fetch latest posts**

```tsx
// src/lib/news/queries.ts
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, desc, and, lte } from "drizzle-orm"

export async function getLatestPosts(limit = 4) {
  const posts = await drizzleDb
    .select({
      slug: newsPosts.slug,
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      categoryName: newsCategories.nameHr,
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(limit)

  return posts
}
```

**Step 3: Update homepage to fetch and display news**

Modify `src/app/(marketing)/page.tsx` to be a server component that fetches news:

```tsx
// src/app/(marketing)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { MarketingHomeClient } from "@/components/marketing/MarketingHomeClient"
import { getLatestPosts } from "@/lib/news/queries"

export default async function MarketingHomePage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  const latestNews = await getLatestPosts(4)

  return <MarketingHomeClient latestNews={latestNews} />
}
```

**Step 4: Add LatestNewsSection to MarketingHomeClient**

Insert the news section between "Free Tools Section" and "Testimonials & Trust Section" (around line 493):

```tsx
// In MarketingHomeClient.tsx, add import
import { LatestNewsSection } from "@/components/news/LatestNewsSection"

// Update props interface
interface MarketingHomeClientProps {
  latestNews: Array<{
    slug: string
    title: string
    excerpt: string | null
    categoryName: string | null
    publishedAt: Date | null
  }>
}

// Update component signature
export function MarketingHomeClient({ latestNews }: MarketingHomeClientProps) {
  // Insert after Free Tools section (line ~493), before Testimonials
  /* Latest News Section */
}
;<LatestNewsSection posts={latestNews} />
```

**Step 5: Verify the homepage displays news**

Run: `npm run dev` and visit http://localhost:3000
Expected: News section appears between Free Tools and Testimonials

**Step 6: Commit**

```bash
git add src/components/news/LatestNewsSection.tsx src/lib/news/queries.ts src/app/\\(marketing\\)/page.tsx src/components/marketing/MarketingHomeClient.tsx
git commit -m "feat(homepage): add latest news section"
```

---

## Task 2: News Search API Endpoint

**Files:**

- Modify: `src/app/api/news/posts/route.ts`

**Step 1: Add search parameter to posts API**

Update the API to support a `q` query parameter for full-text search:

```tsx
// src/app/api/news/posts/route.ts
import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema/news"
import { eq, desc, and, sql, lte, or, ilike } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const categorySlug = searchParams.get("category") || undefined
    const type = searchParams.get("type") || undefined
    const query = searchParams.get("q")?.trim() || undefined

    // Build query conditions - only published posts
    const conditions = [eq(newsPosts.status, "published"), lte(newsPosts.publishedAt, new Date())]

    // Add type filter if provided
    if (type === "individual" || type === "digest") {
      conditions.push(eq(newsPosts.type, type))
    }

    // Add search filter if provided
    if (query && query.length >= 2) {
      const searchPattern = `%${query}%`
      conditions.push(
        or(ilike(newsPosts.title, searchPattern), ilike(newsPosts.excerpt, searchPattern))!
      )
    }

    // Add category filter if provided
    if (categorySlug) {
      const category = await drizzleDb
        .select()
        .from(newsCategories)
        .where(eq(newsCategories.slug, categorySlug))
        .limit(1)

      if (category.length > 0) {
        conditions.push(eq(newsPosts.categoryId, category[0].id))
      } else {
        return NextResponse.json({
          posts: [],
          count: 0,
          limit,
          offset,
        })
      }
    }

    // Execute query with category join
    const posts = await drizzleDb
      .select({
        id: newsPosts.id,
        slug: newsPosts.slug,
        type: newsPosts.type,
        title: newsPosts.title,
        excerpt: newsPosts.excerpt,
        categoryId: newsPosts.categoryId,
        categoryName: newsCategories.nameHr,
        categorySlug: newsCategories.slug,
        featuredImageUrl: newsPosts.featuredImageUrl,
        featuredImageSource: newsPosts.featuredImageSource,
        impactLevel: newsPosts.impactLevel,
        publishedAt: newsPosts.publishedAt,
      })
      .from(newsPosts)
      .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
      .where(and(...conditions))
      .orderBy(desc(newsPosts.publishedAt))
      .limit(limit)
      .offset(offset)

    // Get total count with same filters
    const countResult = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(newsPosts)
      .where(and(...conditions))

    const count = Number(countResult[0]?.count || 0)

    return NextResponse.json({
      posts,
      count,
      limit,
      offset,
      query: query || null,
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Step 2: Test the search API**

Run: `curl "http://localhost:3000/api/news/posts?q=porez&limit=5"`
Expected: JSON response with posts matching "porez" in title or excerpt

**Step 3: Commit**

```bash
git add src/app/api/news/posts/route.ts
git commit -m "feat(api): add search query parameter to news posts endpoint"
```

---

## Task 3: News Search UI Component

**Files:**

- Create: `src/components/news/NewsSearch.tsx`
- Modify: `src/app/(marketing)/vijesti/page.tsx`

**Step 1: Create NewsSearch client component**

```tsx
// src/components/news/NewsSearch.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Loader2 } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { Button } from "@/components/ui/primitives/button"
import { PostCard } from "./PostCard"
import { useDebouncedCallback } from "use-debounce"

interface SearchResult {
  id: string
  slug: string
  title: string
  excerpt: string | null
  categoryName: string | null
  categorySlug: string | null
  publishedAt: string | null
  featuredImageUrl: string | null
  featuredImageSource: string | null
  impactLevel: string | null
}

interface NewsSearchProps {
  initialQuery?: string
}

export function NewsSearch({ initialQuery = "" }: NewsSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(!!initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const performSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setTotalCount(0)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: "individual",
        limit: "10",
      })
      const res = await fetch(`/api/news/posts?${params}`)
      const data = await res.json()
      setResults(data.posts || [])
      setTotalCount(data.count || 0)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
    }
  }, 300)

  useEffect(() => {
    if (query) {
      performSearch(query)
    }
  }, [query, performSearch])

  const handleOpenSearch = () => {
    setIsOpen(true)
  }

  const handleCloseSearch = () => {
    setIsOpen(false)
    setQuery("")
    setResults([])
    // Remove query param from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete("q")
    router.push(`/vijesti${params.toString() ? `?${params}` : ""}`)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    // Update URL with search query
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    router.replace(`/vijesti?${params}`, { scroll: false })
  }

  if (!isOpen) {
    return (
      <Button variant="secondary" size="sm" onClick={handleOpenSearch}>
        <Search className="h-4 w-4" />
        Pretraži
      </Button>
    )
  }

  return (
    <div className="w-full">
      {/* Search Input */}
      <GlassCard hover={false} padding="sm" className="mb-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-white/50" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Pretraži vijesti..."
            className="flex-1 bg-transparent text-white placeholder:text-white/50 focus:outline-none"
            autoFocus
          />
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />}
          <button
            onClick={handleCloseSearch}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </GlassCard>

      {/* Search Results */}
      {query.length >= 2 && (
        <div className="mb-8">
          <p className="mb-4 text-sm text-white/60">
            {isLoading ? (
              "Pretraživanje..."
            ) : totalCount > 0 ? (
              <>
                Pronađeno <strong className="text-white">{totalCount}</strong> rezultata za &quot;
                {query}&quot;
              </>
            ) : (
              <>Nema rezultata za &quot;{query}&quot;</>
            )}
          </p>

          {results.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((post) => (
                <PostCard
                  key={post.id}
                  slug={post.slug}
                  title={post.title}
                  excerpt={post.excerpt}
                  categoryName={post.categoryName || undefined}
                  categorySlug={post.categorySlug || undefined}
                  publishedAt={post.publishedAt ? new Date(post.publishedAt) : new Date()}
                  featuredImageUrl={post.featuredImageUrl}
                  featuredImageSource={post.featuredImageSource}
                  impactLevel={post.impactLevel}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Install use-debounce if not present**

Run: `npm list use-debounce || npm install use-debounce`

**Step 3: Update vijesti page to use NewsSearch**

Replace the placeholder search button in `src/app/(marketing)/vijesti/page.tsx` (around line 203-208):

```tsx
// Import NewsSearch at top
import { NewsSearch } from "@/components/news/NewsSearch"

// Replace the search button div (line ~203-208) with:
;<div className="ml-auto flex-1 md:flex-initial md:min-w-[300px]">
  <NewsSearch initialQuery={searchParams?.q} />
</div>
```

Also update the page signature to accept searchParams:

```tsx
interface PageProps {
  searchParams?: { q?: string }
}

export default async function VijestiPage({ searchParams }: PageProps) {
```

**Step 4: Test the search UI**

Run: `npm run dev` and visit http://localhost:3000/vijesti
Expected: Click "Pretraži" opens search input, typing shows results

**Step 5: Commit**

```bash
git add src/components/news/NewsSearch.tsx src/app/\\(marketing\\)/vijesti/page.tsx package.json package-lock.json
git commit -m "feat(vijesti): implement functional search with debounced API calls"
```

---

## Task 4: Fix Category Pagination Count Query

**Files:**

- Modify: `src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx`

**Step 1: Fix the count query to use SQL count**

The current query returns `countResult.length` which just counts returned rows, not actual total. Fix it:

```tsx
// In getCategoryPosts function, replace the count query (lines 85-97):

// Get total count with proper SQL count
const countResult = await drizzleDb
  .select({ count: sql<number>`count(*)` })
  .from(newsPosts)
  .where(
    and(
      eq(newsPosts.status, "published"),
      eq(newsPosts.type, "individual"),
      lte(newsPosts.publishedAt, new Date()),
      or(...categoryIds.map((id) => eq(newsPosts.categoryId, id)))
    )
  )

return {
  posts,
  totalCount: Number(countResult[0]?.count || 0),
}
```

Also add the `sql` import if missing:

```tsx
import { eq, and, lte, desc, or, sql } from "drizzle-orm"
```

**Step 2: Test pagination**

Create test scenario with more than 12 posts in a category to verify pagination appears.

**Step 3: Commit**

```bash
git add src/app/\\(marketing\\)/vijesti/kategorija/\\[slug\\]/page.tsx
git commit -m "fix(vijesti): correct pagination count query using SQL count"
```

---

## Task 5: Improve Subcategory UX with Active State

**Files:**

- Modify: `src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx`

**Step 1: Add parent category detection and active state**

Update the page to show active tab state and parent navigation:

```tsx
// Update getCategory to also fetch parent info
async function getCategory(slug: string) {
  const result = await drizzleDb
    .select({
      id: newsCategories.id,
      slug: newsCategories.slug,
      nameHr: newsCategories.nameHr,
      parentId: newsCategories.parentId,
      icon: newsCategories.icon,
      color: newsCategories.color,
    })
    .from(newsCategories)
    .where(eq(newsCategories.slug, slug))
    .limit(1)

  const category = result[0] || null

  // If this is a subcategory, get parent info
  let parent = null
  if (category?.parentId) {
    const parentResult = await drizzleDb
      .select({
        id: newsCategories.id,
        slug: newsCategories.slug,
        nameHr: newsCategories.nameHr,
      })
      .from(newsCategories)
      .where(eq(newsCategories.id, category.parentId))
      .limit(1)
    parent = parentResult[0] || null
  }

  return { category, parent }
}

// Add function to get siblings (other subcategories of same parent)
async function getSiblingCategories(parentId: string, currentId: string) {
  const siblings = await drizzleDb
    .select({
      id: newsCategories.id,
      slug: newsCategories.slug,
      nameHr: newsCategories.nameHr,
      icon: newsCategories.icon,
    })
    .from(newsCategories)
    .where(eq(newsCategories.parentId, parentId))
    .orderBy(newsCategories.sortOrder)

  return siblings
}
```

**Step 2: Update the breadcrumb and tabs UI**

```tsx
// Enhanced breadcrumb with parent
;<nav className="mb-6 text-sm text-white/60">
  <Link href="/vijesti" className="hover:text-white">
    Vijesti
  </Link>
  {parent && (
    <>
      <span className="mx-2">/</span>
      <Link href={`/vijesti/kategorija/${parent.slug}`} className="hover:text-white">
        {parent.nameHr}
      </Link>
    </>
  )}
  <span className="mx-2">/</span>
  <span className="text-white">{category.nameHr}</span>
</nav>

// Subcategory tabs with active state (for parent categories)
{
  subcategories.length > 0 && (
    <div className="mb-8 flex flex-wrap gap-2">
      <Link
        href={`/vijesti/kategorija/${category.slug}`}
        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
      >
        Sve
      </Link>
      {subcategories.map((subcategory) => (
        <Link
          key={subcategory.id}
          href={`/vijesti/kategorija/${subcategory.slug}`}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          {subcategory.nameHr}
        </Link>
      ))}
    </div>
  )
}

// Sibling tabs (for subcategories showing siblings + parent link)
{
  parent && siblings.length > 0 && (
    <div className="mb-8 flex flex-wrap gap-2">
      <Link
        href={`/vijesti/kategorija/${parent.slug}`}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
      >
        ← {parent.nameHr}
      </Link>
      {siblings.map((sibling) => (
        <Link
          key={sibling.id}
          href={`/vijesti/kategorija/${sibling.slug}`}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            sibling.id === category.id
              ? "bg-cyan-500 text-white"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          )}
        >
          {sibling.nameHr}
        </Link>
      ))}
    </div>
  )
}
```

**Step 3: Add cn import if missing**

```tsx
import { cn } from "@/lib/utils"
```

**Step 4: Test subcategory navigation**

Visit a subcategory page and verify:

- Breadcrumb shows parent
- Sibling tabs show with current tab highlighted
- Can navigate to parent via "← Parent" link

**Step 5: Commit**

```bash
git add src/app/\\(marketing\\)/vijesti/kategorija/\\[slug\\]/page.tsx
git commit -m "feat(vijesti): improve subcategory UX with active states and parent navigation"
```

---

## Task 6: Update llms.txt with News Section

**Files:**

- Modify: `public/llms.txt`

**Step 1: Add news section to llms.txt**

```text
# FiskAI - Croatian Business & Tax Knowledge Base
# https://fisk.ai

# About
FiskAI is the authoritative resource for Croatian entrepreneurs on taxes,
business registration, and compliance. All content is in Croatian (HR).

# Main Sections
/vijesti - Tax news: AI-curated updates from Porezna uprava, Narodne novine, FINA
/rjecnik - Business glossary (50 terms): PDV, OIB, JOPPD, fiskalizacija...
/vodic - Guides: pausalni-obrt, doo, freelancer, obrt-dohodak
/kako-da - How-to guides: PO-SD, PDV registration, e-invoice setup
/usporedba - Business comparisons: obrt vs d.o.o., j.d.o.o. vs d.o.o.
/alati - Calculators: PDV, contributions, PO-SD, tax

# News Section
/vijesti - Daily tax news aggregated from official Croatian sources
/vijesti/kategorija/porezna-uprava - Tax Administration news
/vijesti/kategorija/zakonodavstvo - Legislation changes
/vijesti/kategorija/pdv - VAT-related news
/vijesti/[slug] - Individual news articles with AI summaries

# Key Facts (2025)
- VAT threshold: 60,000 EUR annual revenue
- Pausalni obrt max revenue: 60,000 EUR
- j.d.o.o. max capital: 2,650 EUR
- Contribution rates: MIO I 15%, MIO II 5%, HZZO 16.5%

# Canonical URLs
https://fisk.ai/vijesti - Latest tax news
https://fisk.ai/rjecnik/pdv - What is PDV (VAT)
https://fisk.ai/rjecnik/oib - What is OIB (Personal ID Number)
https://fisk.ai/rjecnik/fiskalizacija - What is fiscalization
https://fisk.ai/vodic/pausalni-obrt - Guide to flat-rate sole proprietorship
https://fisk.ai/vodic/doo - Guide to d.o.o. (LLC)
https://fisk.ai/kako-da/ispuniti-po-sd - How to fill PO-SD form
https://fisk.ai/alati/pdv-kalkulator - VAT Calculator
https://fisk.ai/alati/kalkulator-doprinosa - Contribution Calculator

# Sources
All content verified against official Croatian government sources:
- porezna-uprava.hr (Tax Administration)
- narodne-novine.nn.hr (Official Gazette)
- fina.hr (Financial Agency)
- mfin.gov.hr (Ministry of Finance)

# Contact
info@fisk.ai
```

**Step 2: Commit**

```bash
git add public/llms.txt
git commit -m "docs: add news section to llms.txt for AI discoverability"
```

---

## Task 7: Build Verification and Final Commit

**Step 1: Run build to verify no errors**

Run: `npm run build`
Expected: Build completes successfully

**Step 2: Create final feature commit if needed**

If all tasks committed separately, create a merge commit or tag:

```bash
git log --oneline -10  # Verify all commits
```

**Step 3: Push to remote**

```bash
git push origin main
```

**Step 4: Trigger deployment**

```bash
curl -X POST "https://apps.metrica.hr/api/v1/deploy?uuid=yosgwcswc8w88gg8wocwogok&force=false" \
  -H "Authorization: Bearer m0MdNAKnrmR1UqDL4Q9i0hS9Y7bLgANxLmDPuWHvGdL2bxuJN"
```

---

## Summary

| Task | Description           | Files                                                                |
| ---- | --------------------- | -------------------------------------------------------------------- |
| 1    | Homepage news section | LatestNewsSection.tsx, queries.ts, page.tsx, MarketingHomeClient.tsx |
| 2    | Search API endpoint   | route.ts (posts)                                                     |
| 3    | Search UI component   | NewsSearch.tsx, vijesti/page.tsx                                     |
| 4    | Pagination count fix  | kategorija/[slug]/page.tsx                                           |
| 5    | Subcategory UX        | kategorija/[slug]/page.tsx                                           |
| 6    | llms.txt update       | public/llms.txt                                                      |
| 7    | Build & deploy        | -                                                                    |
