// src/lib/news/image-cache.ts
/**
 * Image caching module for news images.
 * Downloads external images to local storage to prevent hotlinking issues.
 *
 * Fixes GitHub Issue #299 - Image Attribution Hotlinking Risk
 */

import { createHash } from "crypto"
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readdirSync, statSync } from "fs"
import { join, extname } from "path"

// Directory for cached news images (relative to public folder)
const CACHE_DIR = "images/news-cache"
const PUBLIC_DIR = process.cwd() + "/public"
const FULL_CACHE_PATH = join(PUBLIC_DIR, CACHE_DIR)

// Max age for cached images (30 days in milliseconds)
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000

// Max image size to download (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

// Supported image extensions
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]

/**
 * Ensure the cache directory exists
 */
function ensureCacheDir(): void {
  if (!existsSync(FULL_CACHE_PATH)) {
    mkdirSync(FULL_CACHE_PATH, { recursive: true })
  }
}

/**
 * Generate a consistent filename from a URL
 */
function generateCacheFilename(url: string, contentType?: string): string {
  const hash = createHash("sha256").update(url).digest("hex").substring(0, 16)

  // Try to extract extension from URL or content-type
  let ext = extname(new URL(url).pathname).toLowerCase()

  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    // Infer from content-type
    if (contentType) {
      const mimeMap: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
      }
      ext = mimeMap[contentType] || ".jpg"
    } else {
      ext = ".jpg" // Default fallback
    }
  }

  return `${hash}${ext}`
}

/**
 * Check if image is already cached and return local path if so
 */
export function getCachedImagePath(url: string): string | null {
  ensureCacheDir()

  // Check for any extension variant
  const hash = createHash("sha256").update(url).digest("hex").substring(0, 16)

  for (const ext of SUPPORTED_EXTENSIONS) {
    const filename = `${hash}${ext}`
    const fullPath = join(FULL_CACHE_PATH, filename)
    if (existsSync(fullPath)) {
      return `/${CACHE_DIR}/${filename}`
    }
  }

  return null
}

/**
 * Download and cache an image from a URL
 * Returns the local path (relative to public/) or null on failure
 */
export async function cacheImage(url: string): Promise<string | null> {
  // Check if already cached
  const existing = getCachedImagePath(url)
  if (existing) {
    return existing
  }

  ensureCacheDir()

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      console.warn(`[IMAGE_CACHE] Invalid protocol: ${url}`)
      return null
    }

    // Download with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*",
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[IMAGE_CACHE] Failed to fetch ${url}: ${response.status}`)
      return null
    }

    // Check content type
    const contentType = response.headers.get("content-type") || ""
    if (!contentType.startsWith("image/")) {
      console.warn(`[IMAGE_CACHE] Not an image: ${url} (${contentType})`)
      return null
    }

    // Check content length
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10)
    if (contentLength > MAX_IMAGE_SIZE) {
      console.warn(`[IMAGE_CACHE] Image too large: ${url} (${contentLength} bytes)`)
      return null
    }

    // Read the image data
    const buffer = await response.arrayBuffer()
    const data = Buffer.from(buffer)

    // Double-check size after download
    if (data.length > MAX_IMAGE_SIZE) {
      console.warn(`[IMAGE_CACHE] Image too large after download: ${url} (${data.length} bytes)`)
      return null
    }

    // Generate filename and save
    const filename = generateCacheFilename(url, contentType)
    const fullPath = join(FULL_CACHE_PATH, filename)

    writeFileSync(fullPath, data)
    console.log(`[IMAGE_CACHE] Cached: ${url} -> ${filename}`)

    return `/${CACHE_DIR}/${filename}`
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[IMAGE_CACHE] Timeout fetching: ${url}`)
    } else {
      console.error(`[IMAGE_CACHE] Error caching ${url}:`, error)
    }
    return null
  }
}

/**
 * Cache multiple images in parallel (with concurrency limit)
 */
export async function cacheImages(
  urls: string[],
  concurrency: number = 5
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const localPath = await cacheImage(url)
        return { url, localPath }
      })
    )

    for (const { url, localPath } of batchResults) {
      results.set(url, localPath)
    }
  }

  return results
}

/**
 * Clean up old cached images
 */
export function cleanupOldImages(): { deleted: number; kept: number } {
  ensureCacheDir()

  const now = Date.now()
  let deleted = 0
  let kept = 0

  try {
    const files = readdirSync(FULL_CACHE_PATH)

    for (const file of files) {
      const fullPath = join(FULL_CACHE_PATH, file)
      const stats = statSync(fullPath)

      if (now - stats.mtimeMs > MAX_CACHE_AGE_MS) {
        unlinkSync(fullPath)
        deleted++
      } else {
        kept++
      }
    }

    if (deleted > 0) {
      console.log(`[IMAGE_CACHE] Cleanup: deleted ${deleted}, kept ${kept}`)
    }
  } catch (error) {
    console.error("[IMAGE_CACHE] Error during cleanup:", error)
  }

  return { deleted, kept }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalFiles: number
  totalSizeBytes: number
  oldestFile: Date | null
  newestFile: Date | null
} {
  ensureCacheDir()

  let totalFiles = 0
  let totalSizeBytes = 0
  let oldestTime = Infinity
  let newestTime = 0

  try {
    const files = readdirSync(FULL_CACHE_PATH)

    for (const file of files) {
      const fullPath = join(FULL_CACHE_PATH, file)
      const stats = statSync(fullPath)

      totalFiles++
      totalSizeBytes += stats.size
      oldestTime = Math.min(oldestTime, stats.mtimeMs)
      newestTime = Math.max(newestTime, stats.mtimeMs)
    }
  } catch (error) {
    console.error("[IMAGE_CACHE] Error getting stats:", error)
  }

  return {
    totalFiles,
    totalSizeBytes,
    oldestFile: oldestTime === Infinity ? null : new Date(oldestTime),
    newestFile: newestTime === 0 ? null : new Date(newestTime),
  }
}
