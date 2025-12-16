import { Metadata } from "next"
import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, and, lte, desc, or } from "drizzle-orm"
import { PostCard } from "@/components/news/PostCard"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { slug: string }
  searchParams: { page?: string }
}

const POSTS_PER_PAGE = 12

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

  return result[0] || null
}

async function getSubcategories(categoryId: string) {
  const subcategories = await drizzleDb
    .select({
      id: newsCategories.id,
      slug: newsCategories.slug,
      nameHr: newsCategories.nameHr,
      icon: newsCategories.icon,
    })
    .from(newsCategories)
    .where(eq(newsCategories.parentId, categoryId))
    .orderBy(newsCategories.sortOrder)

  return subcategories
}

async function getCategoryPosts(categoryId: string, subcategoryIds: string[], page: number) {
  const offset = (page - 1) * POSTS_PER_PAGE

  // Include posts from this category and all subcategories
  const categoryIds = [categoryId, ...subcategoryIds]

  const posts = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      categoryName: newsCategories.nameHr,
      categorySlug: newsCategories.slug,
      publishedAt: newsPosts.publishedAt,
      featuredImageUrl: newsPosts.featuredImageUrl,
      featuredImageSource: newsPosts.featuredImageSource,
      impactLevel: newsPosts.impactLevel,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date()),
        or(...categoryIds.map((id) => eq(newsPosts.categoryId, id)))
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(POSTS_PER_PAGE)
    .offset(offset)

  // Get total count
  const countResult = await drizzleDb
    .select({
      count: newsPosts.id,
    })
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
    totalCount: countResult.length,
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await getCategory(params.slug)

  if (!category) {
    return {
      title: "Kategorija nije pronađena | FiskAI",
    }
  }

  return {
    title: `${category.nameHr} - Vijesti | FiskAI`,
    description: `Sve vijesti iz kategorije ${category.nameHr}. Pratite najnovije informacije relevantne za vaše poslovanje.`,
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const category = await getCategory(params.slug)

  if (!category) {
    notFound()
  }

  const subcategories = await getSubcategories(category.id)
  const page = parseInt(searchParams.page || "1", 10)

  const { posts, totalCount } = await getCategoryPosts(
    category.id,
    subcategories.map((s) => s.id),
    page
  )

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-white/60">
        <Link href="/vijesti" className="hover:text-white">
          Vijesti
        </Link>
        <span className="mx-2">/</span>
        <span className="text-white">{category.nameHr}</span>
      </nav>

      {/* Category Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          {category.icon && <span className="text-4xl">{category.icon}</span>}
          <h1 className="text-4xl font-bold text-white md:text-5xl">{category.nameHr}</h1>
        </div>
      </div>

      {/* Subcategory Tabs */}
      {subcategories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`/vijesti/kategorija/${category.slug}`}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
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
      )}

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-lg text-white/60">Nema vijesti u ovoj kategoriji.</p>
          <Link
            href="/vijesti"
            className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            Povratak na sve vijesti
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                slug={post.slug}
                title={post.title}
                excerpt={post.excerpt}
                categoryName={post.categoryName || undefined}
                categorySlug={post.categorySlug || undefined}
                publishedAt={post.publishedAt || new Date()}
                featuredImageUrl={post.featuredImageUrl}
                featuredImageSource={post.featuredImageSource}
                impactLevel={post.impactLevel}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/vijesti/kategorija/${params.slug}?page=${page - 1}`}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  Prethodna
                </Link>
              )}
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Link
                    key={pageNum}
                    href={`/vijesti/kategorija/${params.slug}?page=${pageNum}`}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      pageNum === page
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {pageNum}
                  </Link>
                ))}
              </div>
              {page < totalPages && (
                <Link
                  href={`/vijesti/kategorija/${params.slug}?page=${page + 1}`}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  Sljedeća
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
