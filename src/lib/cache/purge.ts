/**
 * Cache Purge Utility
 *
 * Provides functions to purge cached content by tags or URLs.
 * Used to invalidate CDN/edge caches when content is updated.
 */

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export type CacheTag =
  | "kb_guides"
  | "kb_glossary"
  | "kb_faq"
  | "kb_howto"
  | "kb_comparisons"
  | "kb_news"
  | "marketing"
  | "kb_all"

export interface PurgeResult {
  success: boolean
  error?: string
}

/**
 * Purge cached content by cache tags.
 *
 * @param tags - Array of cache tags to purge
 * @returns PurgeResult indicating success or failure with error message
 */
export async function purgeContentCache(tags: CacheTag[]): Promise<PurgeResult> {
  try {
    const response = await fetch(`${ORIGIN}/api/cache/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CACHE_PURGE_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Purge cached content by specific URLs.
 * Relative URLs will be converted to absolute using ORIGIN.
 *
 * @param urls - Array of URLs to purge (can be relative or absolute)
 * @returns PurgeResult indicating success or failure with error message
 */
export async function purgeByUrls(urls: string[]): Promise<PurgeResult> {
  try {
    // Convert relative URLs to absolute
    const absoluteUrls = urls.map((url) => {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url
      }
      return `${ORIGIN}${url.startsWith("/") ? url : `/${url}`}`
    })

    const response = await fetch(`${ORIGIN}/api/cache/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CACHE_PURGE_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls: absoluteUrls }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
