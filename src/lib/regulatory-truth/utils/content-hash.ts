// src/lib/regulatory-truth/utils/content-hash.ts
import { createHash } from "crypto"

/**
 * Normalize HTML content for consistent hashing.
 * Removes whitespace variations and dynamic content.
 */
export function normalizeContent(content: string): string {
  return (
    content
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove style tags
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove common dynamic elements (timestamps, session IDs)
      .replace(/\b\d{10,13}\b/g, "") // Unix timestamps
      .replace(/[a-f0-9]{32,}/gi, "") // Session IDs / hashes
      // Trim
      .trim()
  )
}

/**
 * Generate SHA-256 hash of content.
 */
export function hashContent(content: string): string {
  const normalized = normalizeContent(content)
  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * Check if content has changed based on hash comparison.
 * Returns { hasChanged, newHash, changePercentage }
 */
export function detectContentChange(
  newContent: string,
  previousHash: string | null
): {
  hasChanged: boolean
  newHash: string
  isSignificant: boolean
} {
  const newHash = hashContent(newContent)
  const hasChanged = previousHash !== newHash

  return {
    hasChanged,
    newHash,
    isSignificant: hasChanged, // For now, any change is significant
  }
}
