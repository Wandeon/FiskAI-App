/**
 * URL Canonicalizer
 *
 * Normalizes URLs to a canonical form for consistent deduplication.
 * Same URL must always produce the same canonical form.
 */

import { createHash } from "crypto"

/**
 * Tracking parameters to strip from URLs
 */
const TRACKING_PARAMS = new Set([
  // Analytics
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  // Facebook
  "fbclid",
  // Google
  "gclid",
  "gclsrc",
  // Session/cache
  "sessionid",
  "session_id",
  "sid",
  "_ga",
  "_gl",
  "cb",
  "cache",
  "cachebuster",
  // Misc
  "ref",
  "source",
  "share",
])

/**
 * Canonicalize a URL to a stable, normalized form.
 *
 * Invariant: canonicalizeUrl(x) === canonicalizeUrl(x) for any x
 *
 * Normalization rules:
 * 1. Parse and reconstruct URL
 * 2. Lowercase protocol and hostname
 * 3. Remove fragment (#...)
 * 4. Remove trailing slash (except for root path)
 * 5. Sort query parameters alphabetically
 * 6. Remove tracking parameters
 * 7. Remove empty query strings
 */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Lowercase protocol and hostname
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()

    // Remove fragment
    parsed.hash = ""

    // Sort and filter query parameters
    const params = new URLSearchParams(parsed.search)
    const sortedParams = new URLSearchParams()
    const keys = [...params.keys()].sort()

    for (const key of keys) {
      const lowerKey = key.toLowerCase()
      if (!TRACKING_PARAMS.has(lowerKey)) {
        sortedParams.set(key, params.get(key) ?? "")
      }
    }

    parsed.search = sortedParams.toString()

    // Remove trailing slash (except for root)
    let pathname = parsed.pathname
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1)
    }
    parsed.pathname = pathname

    return parsed.toString()
  } catch {
    // If URL is invalid, return as-is (will fail later in pipeline)
    return url
  }
}

/**
 * Generate a stable hash for a URL (for job IDs)
 *
 * @param url - URL to hash
 * @returns First 12 characters of SHA-1 hash
 */
export function hashUrl(url: string): string {
  const canonical = canonicalizeUrl(url)
  return createHash("sha1").update(canonical).digest("hex").slice(0, 12)
}

/**
 * Generate a stable job ID for backfill queue deduplication.
 *
 * Format: backfill:<sourceSlug>:<urlHash>
 *
 * @param sourceSlug - Source identifier
 * @param url - URL to process
 * @returns Deterministic job ID
 */
export function getBackfillJobId(sourceSlug: string, url: string): string {
  const urlHash = hashUrl(url)
  return `backfill:${sourceSlug}:${urlHash}`
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

/**
 * Check if URL matches a pattern (for filtering)
 */
export function urlMatchesPattern(url: string, pattern: RegExp): boolean {
  return pattern.test(url)
}
