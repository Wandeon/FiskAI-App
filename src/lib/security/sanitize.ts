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

/**
 * Sanitize IP address for export by masking the last two octets.
 * This reduces PII exposure while maintaining geographic location context.
 * IPv4 addresses are masked to show only the first two octets.
 * IPv6 addresses are masked to show only the first four segments.
 *
 * @param ipAddress - The IP address to sanitize
 * @returns Masked IP address with last segments replaced by 'xxx'
 *
 * @example
 * sanitizeIpAddress('192.168.1.100') // Returns: '192.168.xxx.xxx'
 * sanitizeIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334') // Returns: '2001:0db8:85a3:0000:xxx:xxx:xxx:xxx'
 * sanitizeIpAddress(null) // Returns: ''
 */
export function sanitizeIpAddress(ipAddress: string | null | undefined): string {
  if (!ipAddress) return ""

  // IPv6 detection (contains colons)
  if (ipAddress.includes(":")) {
    const segments = ipAddress.split(":")
    if (segments.length >= 4) {
      // Keep first 4 segments, mask the rest
      return segments.slice(0, 4).join(":") + ":xxx:xxx:xxx:xxx"
    }
    return "xxx:xxx:xxx:xxx:xxx:xxx:xxx:xxx"
  }

  // IPv4 handling
  const octets = ipAddress.split(".")
  if (octets.length === 4) {
    // Keep first two octets, mask last two
    return `${octets[0]}.${octets[1]}.xxx.xxx`
  }

  // Invalid format - mask completely
  return "xxx.xxx.xxx.xxx"
}

/**
 * Sanitize user agent string by extracting only essential browser/OS information
 * and removing detailed version numbers and system identifiers that could be used
 * for fingerprinting.
 *
 * @param userAgent - The user agent string to sanitize
 * @returns Normalized user agent with only browser family and OS type
 *
 * @example
 * sanitizeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
 * // Returns: 'Chrome/Windows'
 *
 * sanitizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)')
 * // Returns: 'Safari/iOS'
 *
 * sanitizeUserAgent(null) // Returns: ''
 */
/**
 * Sanitize Personally Identifiable Information (PII) from text
 * before sending to external AI services.
 *
 * This function redacts common PII patterns to prevent data leakage:
 * - Email addresses
 * - Phone numbers (Croatian and international formats)
 * - OIB (Croatian tax ID - 11 digits)
 * - Credit card numbers
 * - IBAN numbers
 *
 * @param text - The text that may contain PII
 * @returns Text with PII patterns replaced with placeholders
 *
 * @example
 * sanitizePII('Contact me at john@example.com')
 * // Returns: 'Contact me at [EMAIL]'
 *
 * sanitizePII('My OIB is 12345678901')
 * // Returns: 'My OIB is [OIB]'
 */
export function sanitizePII(text: string): string {
  if (!text) return ""

  return text
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    // Croatian phone numbers (mobile and landline)
    .replace(/(\+385|0)[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}/g, "[PHONE]")
    // International phone numbers
    .replace(/\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[PHONE]")
    // OIB (Croatian tax ID - exactly 11 digits, possibly with spaces)
    .replace(/\b\d{11}\b/g, "[OIB]")
    // Credit card numbers (16 digits with optional spaces/dashes)
    .replace(/\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g, "[CARD]")
    // IBAN (starts with 2 letters, then up to 32 alphanumeric)
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/gi, "[IBAN]")
}

export function sanitizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return ""

  // Normalize to lowercase for matching
  const ua = userAgent.toLowerCase()

  // Detect browser family
  let browser = "Other"
  if (ua.includes("edg/")) {
    browser = "Edge"
  } else if (ua.includes("chrome/") || ua.includes("crios/")) {
    browser = "Chrome"
  } else if (ua.includes("firefox/") || ua.includes("fxios/")) {
    browser = "Firefox"
  } else if (ua.includes("safari/") && !ua.includes("chrome")) {
    browser = "Safari"
  } else if (ua.includes("opera/") || ua.includes("opr/")) {
    browser = "Opera"
  }

  // Detect OS family
  let os = "Other"
  if (ua.includes("windows")) {
    os = "Windows"
  } else if (ua.includes("mac os x") || ua.includes("macintosh")) {
    os = "macOS"
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS"
  } else if (ua.includes("android")) {
    os = "Android"
  } else if (ua.includes("linux")) {
    os = "Linux"
  }

  return `${browser}/${os}`
}
