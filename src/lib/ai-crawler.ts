/**
 * AI Crawler Detection Module
 *
 * Detects AI bot traffic (GPTBot, ClaudeBot, PerplexityBot, etc.)
 * and emits PostHog events for observability.
 */

const AI_BOT_PATTERNS: Record<string, RegExp> = {
  GPTBot: /GPTBot|ChatGPT-User|OAI-SearchBot/i,
  ClaudeBot: /ClaudeBot|anthropic-ai/i,
  PerplexityBot: /PerplexityBot/i,
  GoogleExtended: /Google-Extended/i,
  CCBot: /CCBot/i,
  OtherBot: /bot|crawler|spider/i,
}

// Deduplication cache (6 hour TTL) - simple in-memory for edge runtime
const recentHits = new Map<string, number>()
const DEDUPE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Detect if user agent matches a known AI bot pattern
 * @returns Bot name if detected, null otherwise
 */
export function detectAIBot(userAgent: string): string | null {
  for (const [name, pattern] of Object.entries(AI_BOT_PATTERNS)) {
    if (pattern.test(userAgent)) {
      return name
    }
  }
  return null
}

/**
 * Check if path should be skipped for crawler tracking
 * (static assets, API routes, etc.)
 */
export function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|avif)$/i.test(pathname)
  )
}

/**
 * Check if this crawl should be tracked (handles deduplication)
 * Returns true if we should track, false if it's a duplicate within TTL
 */
export function shouldTrackCrawl(botName: string, pathname: string): boolean {
  const key = `${botName}:${pathname}`
  const lastHit = recentHits.get(key)
  const now = Date.now()

  if (lastHit && now - lastHit < DEDUPE_TTL_MS) {
    return false // Skip duplicate
  }

  recentHits.set(key, now)

  // Cleanup old entries periodically
  if (recentHits.size > 10000) {
    for (const [k, v] of recentHits) {
      if (now - v > DEDUPE_TTL_MS) recentHits.delete(k)
    }
  }

  return true
}

export interface CrawlEventProperties {
  bot_name: string
  path: string
  method: string
  content_type: "html" | "json" | "asset"
}

/**
 * Build event properties for a crawler hit
 */
export function buildCrawlEvent(
  botName: string,
  pathname: string,
  method: string
): CrawlEventProperties {
  const contentType = pathname.endsWith(".json") ? "json" : "html"
  return {
    bot_name: botName,
    path: pathname,
    method,
    content_type: contentType,
  }
}

/**
 * Fire and forget event to PostHog
 * Does not block the request - errors are silently ignored
 */
export async function trackCrawlerHit(properties: CrawlEventProperties): Promise<void> {
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  if (!posthogHost || !posthogKey) return

  try {
    await fetch(`${posthogHost}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "ai_crawler_hit",
        properties,
        distinct_id: `bot:${properties.bot_name}`,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Fire and forget - don't block request
  }
}
