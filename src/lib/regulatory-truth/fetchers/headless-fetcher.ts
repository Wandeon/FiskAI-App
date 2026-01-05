// src/lib/regulatory-truth/fetchers/headless-fetcher.ts
// Headless browser fetcher for JS-rendered sites (e.g., HGK)
// Uses Playwright to render JavaScript content before extraction

import { chromium, type Browser, type BrowserContext, type Page } from "playwright"

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

// Headless fetching is more resource-intensive, so we use stricter limits:
// - concurrency = 1 per domain
// - max 5 req/min per domain (= 12 seconds between requests)
// - render timeout = 30 seconds

interface HeadlessRateLimitConfig {
  requestDelayMs: number // 12000ms = 5 req/min
  maxConcurrentRequests: number // 1
  renderTimeoutMs: number // 30000ms
}

const HEADLESS_CONFIG: HeadlessRateLimitConfig = {
  requestDelayMs: 12000, // 5 requests per minute = 12 seconds between requests
  maxConcurrentRequests: 1,
  renderTimeoutMs: 30000, // 30 seconds render timeout
}

interface DomainStats {
  lastRequestAt: number
  activeRequests: number
}

class HeadlessRateLimiter {
  private domainStats: Map<string, DomainStats> = new Map()
  private config: HeadlessRateLimitConfig

  constructor(config: HeadlessRateLimitConfig = HEADLESS_CONFIG) {
    this.config = config
  }

  private getStats(domain: string): DomainStats {
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        lastRequestAt: 0,
        activeRequests: 0,
      })
    }
    return this.domainStats.get(domain)!
  }

  async waitForSlot(domain: string): Promise<void> {
    const stats = this.getStats(domain)

    // Check concurrency limit
    while (stats.activeRequests >= this.config.maxConcurrentRequests) {
      await this.delay(1000) // Poll every second
    }

    // Wait for rate limit delay
    const timeSinceLastRequest = Date.now() - stats.lastRequestAt
    if (timeSinceLastRequest < this.config.requestDelayMs) {
      const waitTime = this.config.requestDelayMs - timeSinceLastRequest
      console.log(`[headless-fetcher] Rate limit: waiting ${waitTime}ms for ${domain}`)
      await this.delay(waitTime)
    }

    // Mark slot as taken
    stats.lastRequestAt = Date.now()
    stats.activeRequests++
  }

  releaseSlot(domain: string): void {
    const stats = this.getStats(domain)
    stats.activeRequests = Math.max(0, stats.activeRequests - 1)
  }

  getConfig(): HeadlessRateLimitConfig {
    return { ...this.config }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton rate limiter for headless fetching
const headlessRateLimiter = new HeadlessRateLimiter()

/**
 * Get the headless rate limiter instance (for testing)
 */
export function getHeadlessRateLimiter(): HeadlessRateLimiter {
  return headlessRateLimiter
}

// =============================================================================
// HEADLESS FETCHER
// =============================================================================

export interface HeadlessFetchResult {
  ok: boolean
  html?: string
  error?: string
  url: string
  renderTimeMs?: number
}

/**
 * Fetch a URL using headless browser rendering.
 * Returns the fully rendered HTML after JavaScript execution.
 *
 * Rate limited to 5 req/min per domain with concurrency of 1.
 * Render timeout enforced at 30 seconds.
 */
export async function fetchWithHeadless(url: string): Promise<HeadlessFetchResult> {
  const startTime = Date.now()
  const domain = new URL(url).hostname

  let browser: Browser | null = null

  try {
    // Wait for rate limit slot
    await headlessRateLimiter.waitForSlot(domain)

    console.log(`[headless-fetcher] Launching browser for ${url}`)

    // Launch browser
    browser = await chromium.launch({
      headless: true,
    })

    // Create context with custom user agent
    const context: BrowserContext = await browser.newContext({
      userAgent: "FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr) HeadlessFetcher",
      locale: "hr-HR",
      timezoneId: "Europe/Zagreb",
    })

    // Create page and navigate
    const page: Page = await context.newPage()

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: HEADLESS_CONFIG.renderTimeoutMs,
    })

    // Wait for full load state
    await page.waitForLoadState("domcontentloaded")

    // Get rendered HTML
    const html = await page.content()

    // Cleanup
    await page.close()
    await context.close()
    await browser.close()

    const renderTimeMs = Date.now() - startTime
    console.log(`[headless-fetcher] Rendered ${url} in ${renderTimeMs}ms`)

    return {
      ok: true,
      html,
      url,
      renderTimeMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[headless-fetcher] Error fetching ${url}: ${errorMessage}`)

    // Always close browser on error
    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore close errors
      }
    }

    return {
      ok: false,
      error: errorMessage,
      url,
      renderTimeMs: Date.now() - startTime,
    }
  } finally {
    // Release rate limit slot
    headlessRateLimiter.releaseSlot(domain)
  }
}

// =============================================================================
// ENDPOINT HELPER
// =============================================================================

interface EndpointWithMetadata {
  id: string
  domain: string
  path: string
  metadata: Record<string, unknown> | null
}

/**
 * Check if an endpoint requires headless browser fetching.
 * Returns true if endpoint.metadata.requiresHeadless === true
 */
export function shouldUseHeadless(endpoint: EndpointWithMetadata): boolean {
  if (!endpoint.metadata) {
    return false
  }

  return endpoint.metadata.requiresHeadless === true
}
