// src/lib/regulatory-truth/watchdog/rate-limiter.ts

import { DOMAIN_DELAYS, type DomainDelayConfig } from "./types"

const DEFAULT_DELAY: DomainDelayConfig = { base: 3000, maxJitter: 1500 }

/**
 * Get a randomized delay for a given domain
 * Includes base delay + random jitter + 10% chance of long pause
 */
export function getDelayForDomain(domain: string): number {
  const config = DOMAIN_DELAYS[domain] ?? DEFAULT_DELAY
  const jitter = Math.random() * config.maxJitter
  const longPause = Math.random() < 0.1 ? config.base : 0 // 10% chance of 2x delay
  return Math.round(config.base + jitter + longPause)
}

/**
 * Get a random delay within a range (for scout/scrape phases)
 */
export function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs))
}

/**
 * Sleep for a given number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sleep with domain-specific delay
 */
export async function sleepForDomain(domain: string): Promise<number> {
  const delay = getDelayForDomain(domain)
  await sleep(delay)
  return delay
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return "unknown"
  }
}
