/**
 * Unified news content API
 * Tries WordPress first, falls back to JSON. NEVER throws.
 * BUILD TIME ONLY.
 */

import * as wp from "@/lib/wordpress/client"
import * as fallback from "@/lib/wordpress/fallback"
import type { NewsPost, NewsCategory } from "@/lib/wordpress/types"

export type { NewsPost, NewsCategory }

export async function getAllPostSlugs(): Promise<string[]> {
  const slugs = await wp.getAllPostSlugs()
  if (slugs !== null) return slugs
  console.log("Using JSON fallback for post slugs")
  return fallback.getFallbackPosts().map((p) => p.slug)
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const slugs = await wp.getAllCategorySlugs()
  if (slugs !== null) return slugs
  console.log("Using JSON fallback for category slugs")
  return fallback.getFallbackCategories().map((c) => c.slug)
}

export async function getFeaturedPosts(limit = 4): Promise<NewsPost[]> {
  const posts = await wp.getFeaturedPosts(limit)
  if (posts !== null) return posts
  console.log("Using JSON fallback for featured posts")
  return fallback.getFallbackPosts().slice(0, limit)
}

export async function getPostBySlug(slug: string): Promise<NewsPost | null> {
  const post = await wp.getPostBySlug(slug)
  if (post !== null) return post
  console.log(`Using JSON fallback for post: ${slug}`)
  return fallback.getFallbackPostBySlug(slug)
}

export async function getPostsByCategory(categorySlug: string, limit = 10): Promise<NewsPost[]> {
  const posts = await wp.getPostsByCategory(categorySlug, limit)
  if (posts !== null) return posts
  console.log(`Using JSON fallback for category: ${categorySlug}`)
  return fallback.getFallbackPostsByCategory(categorySlug).slice(0, limit)
}

export async function getAllCategories(): Promise<NewsCategory[]> {
  const cats = await wp.getAllCategories()
  if (cats !== null) return cats
  console.log("Using JSON fallback for categories")
  return fallback.getFallbackCategories()
}

export async function getPopularPosts(limit = 5): Promise<NewsPost[]> {
  const posts = await wp.getPopularPosts(limit)
  if (posts !== null) return posts
  return fallback.getFallbackPosts().slice(0, limit)
}

export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string,
  limit = 3
): Promise<NewsPost[]> {
  if (!categorySlug) return []
  const posts = await wp.getRelatedPosts(categorySlug, excludeSlug, limit)
  if (posts !== null) return posts
  return fallback
    .getFallbackPostsByCategory(categorySlug)
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, limit)
}
