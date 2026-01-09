/**
 * WordPress REST API client - BUILD TIME ONLY
 * Uses WP_BASE_URL env var. Never throws on failure.
 */

import type { WPPost, WPCategory, NewsPost, NewsCategory } from "./types"

const WP_BASE_URL = process.env.WP_BASE_URL || ""
const WP_API = WP_BASE_URL ? `${WP_BASE_URL}/wp-json/wp/v2` : ""

const categoryCache = new Map<number, WPCategory>()

async function wpFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
  if (!WP_API) return null

  try {
    const url = new URL(`${WP_API}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      console.warn(`WordPress API ${response.status}: ${endpoint}`)
      return null
    }

    return response.json()
  } catch (e) {
    console.warn(`WordPress fetch failed: ${endpoint}`, e)
    return null
  }
}

async function getCategory(categoryId: number): Promise<WPCategory | null> {
  if (categoryCache.has(categoryId)) return categoryCache.get(categoryId)!
  const cat = await wpFetch<WPCategory>(`/categories/${categoryId}`)
  if (cat) categoryCache.set(categoryId, cat)
  return cat
}

async function normalizePost(wpPost: WPPost): Promise<NewsPost> {
  const category = wpPost.categories[0] ? await getCategory(wpPost.categories[0]) : null

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
    tags: [],
    featuredImageUrl: null,
    impactLevel: wpPost.acf?.impact_level || null,
    tldr: wpPost.acf?.tldr || null,
    actionItems: wpPost.acf?.action_items || null,
  }
}

export async function getAllPostSlugs(): Promise<string[] | null> {
  const posts = await wpFetch<WPPost[]>("/posts", {
    status: "publish",
    per_page: "100",
    _fields: "slug",
  })
  return posts ? posts.map((p) => p.slug) : null
}

export async function getAllCategorySlugs(): Promise<string[] | null> {
  const cats = await wpFetch<WPCategory[]>("/categories", { per_page: "100", _fields: "slug" })
  return cats ? cats.map((c) => c.slug) : null
}

export async function getFeaturedPosts(limit = 4): Promise<NewsPost[] | null> {
  const posts = await wpFetch<WPPost[]>("/posts", {
    status: "publish",
    per_page: String(limit),
    orderby: "date",
    order: "desc",
  })
  if (!posts) return null
  return Promise.all(posts.map(normalizePost))
}

export async function getPostBySlug(slug: string): Promise<NewsPost | null> {
  const posts = await wpFetch<WPPost[]>("/posts", { slug, status: "publish" })
  if (!posts || posts.length === 0) return null
  return normalizePost(posts[0])
}

export async function getPostsByCategory(
  categorySlug: string,
  limit = 10
): Promise<NewsPost[] | null> {
  const cats = await wpFetch<WPCategory[]>("/categories", { slug: categorySlug })
  if (!cats || cats.length === 0) return null

  const posts = await wpFetch<WPPost[]>("/posts", {
    categories: String(cats[0].id),
    status: "publish",
    per_page: String(limit),
    orderby: "date",
    order: "desc",
  })
  if (!posts) return null
  return Promise.all(posts.map(normalizePost))
}

export async function getAllCategories(): Promise<NewsCategory[] | null> {
  const cats = await wpFetch<WPCategory[]>("/categories", { per_page: "100", hide_empty: "true" })
  if (!cats) return null
  return cats.map((c) => ({ id: String(c.id), slug: c.slug, name: c.name, count: c.count }))
}

export async function getPopularPosts(limit = 5): Promise<NewsPost[] | null> {
  return getFeaturedPosts(limit)
}

export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string,
  limit = 3
): Promise<NewsPost[] | null> {
  if (!categorySlug) return []
  const posts = await getPostsByCategory(categorySlug, limit + 1)
  if (!posts) return null
  return posts.filter((p) => p.slug !== excludeSlug).slice(0, limit)
}
