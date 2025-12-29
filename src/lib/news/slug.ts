/**
 * Slug generation utilities for news posts
 *
 * Provides collision-resistant slug generation with retry logic
 */

import { nanoid } from "nanoid"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Generate a unique slug from title with collision detection and retry
 *
 * @param title - The post title
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns A unique slug guaranteed not to exist in the database
 */
export async function generateUniqueSlug(
  title: string,
  maxRetries: number = 5
): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60)

  // Try with short nanoid first (8 chars for readability)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const uniqueId = nanoid(8)
    const slug = `${baseSlug}-${uniqueId}`

    // Check if slug exists
    const existing = await drizzleDb
      .select({ id: newsPosts.id })
      .from(newsPosts)
      .where(eq(newsPosts.slug, slug))
      .limit(1)

    if (existing.length === 0) {
      return slug
    }

    console.warn(`[generateUniqueSlug] Collision detected on attempt ${attempt + 1}: ${slug}`)
  }

  // Fallback: use longer nanoid (21 chars - standard nanoid length)
  const fallbackSlug = `${baseSlug}-${nanoid()}`
  console.warn(`[generateUniqueSlug] Max retries reached, using fallback: ${fallbackSlug}`)
  return fallbackSlug
}

/**
 * Legacy slug generation (timestamp-based) - DEPRECATED
 *
 * @deprecated Use generateUniqueSlug instead for collision resistance
 */
export function generateSlugLegacy(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  const timestamp = Date.now().toString().slice(-6)
  return `${base.substring(0, 60)}-${timestamp}`
}
