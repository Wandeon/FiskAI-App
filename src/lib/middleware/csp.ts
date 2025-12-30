/**
 * Content Security Policy (CSP) Middleware Utilities
 *
 * Provides nonce-based CSP for enhanced security without relying on unsafe-inline/unsafe-eval.
 * The nonce is generated per-request in middleware and passed to components via headers.
 */

/**
 * Generate a CSP header value with the provided nonce
 *
 * @param nonce - Base64-encoded nonce for this request
 * @returns CSP header value
 */
export function generateCSP(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",
    // Script CSP with nonce and strict-dynamic for compatibility
    // strict-dynamic allows scripts loaded by nonce-tagged scripts to run
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Style CSP with nonce for inline styles (used by Next.js and Tailwind)
    `style-src 'self' 'nonce-${nonce}'`,
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
