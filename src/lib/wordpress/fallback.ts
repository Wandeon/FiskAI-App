/**
 * JSON fallback for when WordPress is unavailable
 * Reads from content/news.json - NEVER throws
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

let cachedData: FallbackData | null = null

function loadFallback(): FallbackData {
  if (cachedData) return cachedData

  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      const raw = fs.readFileSync(FALLBACK_PATH, "utf-8")
      cachedData = JSON.parse(raw)
      return cachedData!
    }
  } catch (e) {
    console.warn("Failed to load fallback data:", e)
  }

  // Return empty data - never throw
  return { posts: [], categories: [], generatedAt: new Date().toISOString() }
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
