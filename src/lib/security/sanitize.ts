// src/lib/security/sanitize.ts
// Content sanitization utilities for user-generated content (UGC)
// Provides defense-in-depth against XSS and HTML injection attacks

import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitize user-generated content by stripping all HTML tags and attributes.
 * This is the strictest sanitization mode - use for plain text content like
 * ticket titles, message bodies, comments, etc.
 *
 * @param content - Raw user input that may contain HTML
 * @returns Sanitized plain text with all HTML stripped
 *
 * @example
 * sanitizeUserContent('<script>alert("xss")</script>Hello')
 * // Returns: 'Hello'
 *
 * sanitizeUserContent('<b>Bold</b> and <i>italic</i>')
 * // Returns: 'Bold and italic'
 */
export function sanitizeUserContent(content: string): string {
  if (!content) return ""

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  })
}

/**
 * Sanitize content that may contain safe formatting HTML.
 * Allows basic formatting tags but strips potentially dangerous elements.
 * Use for rich text content where some formatting is acceptable.
 *
 * @param content - Raw user input that may contain HTML
 * @returns Sanitized HTML with only safe formatting tags
 *
 * @example
 * sanitizeRichContent('<b>Bold</b><script>alert("xss")</script>')
 * // Returns: '<b>Bold</b>'
 */
export function sanitizeRichContent(content: string): string {
  if (!content) return ""

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "br", "p", "ul", "ol", "li"],
    ALLOWED_ATTR: [], // No attributes allowed even on safe tags
  })
}

/**
 * Escape HTML entities without using DOMPurify.
 * Useful for contexts where DOMPurify is overkill or not available.
 * This is a lightweight alternative that converts HTML special characters
 * to their entity equivalents.
 *
 * @param content - Raw string that may contain HTML characters
 * @returns String with HTML special characters escaped
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(content: string): string {
  if (!content) return ""

  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  }

  return content.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char)
}
