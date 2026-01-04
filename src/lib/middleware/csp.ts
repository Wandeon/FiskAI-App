/**
 * Content Security Policy (CSP) Middleware Utilities
 *
 * Provides nonce-based CSP for enhanced security without relying on unsafe-inline/unsafe-eval.
 * The nonce is generated per-request in middleware and passed to components via headers.
 *
 * CSP Strategy for Marketing Pages:
 * - script-src: nonce-based with strict-dynamic for Next.js compatibility
 * - script-src-attr: 'none' to block inline event handlers (onclick, etc.)
 * - style-src: 'self' only for <style> tags (external stylesheets)
 * - style-src-elem: nonce-based for inline <style> elements (Next.js/Tailwind)
 * - style-src-attr: 'unsafe-inline' to allow element.style.* (Framer Motion animations)
 *
 * This allows Framer Motion runtime style manipulation while keeping scripts secure.
 */

/**
 * Generate a CSP header value with the provided nonce
 *
 * @param nonce - Base64-encoded nonce for this request
 * @returns CSP header value
 */
export function generateCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"

  const cspDirectives = [
    "default-src 'self'",
    // Script CSP with nonce and strict-dynamic for compatibility
    // strict-dynamic allows scripts loaded by nonce-tagged scripts to run
    // In development, allow 'unsafe-eval' for Next.js hot reloading
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Explicitly set script-src-elem to match script-src for <script> tags
    `script-src-elem 'self' 'nonce-${nonce}'`,
    // Block inline event handlers (onclick, onload, etc.) for security
    "script-src-attr 'none'",
    // Style CSP: 'self' for external stylesheets only
    "style-src 'self'",
    // Style elements (<style> tags): require nonce in production, allow unsafe-inline in dev
    `style-src-elem 'self'${isDev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    // Style attributes (element.style.*): allow for Framer Motion animations
    // This is necessary for runtime style manipulation by animation libraries
    "style-src-attr 'unsafe-inline'",
    // Allow images from self, data URIs, and HTTPS sources
    "img-src 'self' data: https:",
    // Allow fonts from self and data URIs
    "font-src 'self' data:",
    // Allow connections to self and HTTPS endpoints (for API calls)
    "connect-src 'self' https:",
    // Prevent framing (clickjacking protection)
    "frame-ancestors 'none'",
    // Restrict base URI to prevent base tag injection
    "base-uri 'self'",
    // Restrict form submissions to same origin
    "form-action 'self'",
    // Block plugins (Flash, Java, etc.)
    "object-src 'none'",
    // Upgrade insecure requests to HTTPS in production
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ]

  return cspDirectives.join("; ")
}

/**
 * Generate a cryptographically secure nonce for CSP
 *
 * @returns Base64-encoded nonce
 */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64")
}
