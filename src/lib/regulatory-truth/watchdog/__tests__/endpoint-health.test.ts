// src/lib/regulatory-truth/watchdog/__tests__/endpoint-health.test.ts
// Unit tests for endpoint health monitoring

import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    discoveryEndpoint: {
      findMany: vi.fn(),
    },
    watchdogAlert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock rate limiter
vi.mock("../../utils/rate-limiter", () => ({
  rateLimiter: {
    getHealthStatus: vi.fn(() => ({
      domains: {},
      overallHealthy: true,
    })),
  },
}))

// Mock Slack
vi.mock("../slack", () => ({
  sendSlackMessage: vi.fn(() => Promise.resolve(true)),
  sendCriticalAlert: vi.fn(() => Promise.resolve(true)),
}))

// Mock email
vi.mock("../email", () => ({
  sendCriticalEmail: vi.fn(() => Promise.resolve()),
}))

vi.mock("../resend-email", () => ({
  sendCriticalAlertResend: vi.fn(() => Promise.resolve()),
}))

import { db } from "@/lib/db"
import { rateLimiter } from "../../utils/rate-limiter"
import { computeEndpointHealth, getCircuitBreakerStatus } from "../endpoint-health"

describe("computeEndpointHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should identify SLA breach when lastScrapedAt is null (never scraped)", async () => {
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: null,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].isSlaBreached).toBe(true)
    expect(result[0].hasConsecutiveErrors).toBe(false)
    expect(result[0].hoursSinceSuccess).toBe(null)
  })

  it("should identify SLA breach when lastScrapedAt > 24h ago", async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000)
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: thirtyHoursAgo,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].isSlaBreached).toBe(true)
    expect(result[0].hoursSinceSuccess).toBeGreaterThanOrEqual(30)
  })

  it("should NOT identify SLA breach when lastScrapedAt < 24h ago", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: twoHoursAgo,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].isSlaBreached).toBe(false)
    expect(result[0].hoursSinceSuccess).toBeLessThan(24)
  })

  it("should identify consecutive errors when >= 3", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: oneHourAgo,
        consecutiveErrors: 3,
        lastError: "HTTP 500",
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].isSlaBreached).toBe(false)
    expect(result[0].hasConsecutiveErrors).toBe(true)
    expect(result[0].consecutiveErrors).toBe(3)
  })

  it("should NOT identify consecutive errors when < 3", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: oneHourAgo,
        consecutiveErrors: 2,
        lastError: "HTTP 500",
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].hasConsecutiveErrors).toBe(false)
  })

  it("should identify healthy endpoint (no SLA breach, no errors)", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const mockEndpoints = [
      {
        id: "ep1",
        domain: "test.hr",
        path: "/news",
        name: "Test Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: oneHourAgo,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(1)
    expect(result[0].isSlaBreached).toBe(false)
    expect(result[0].hasConsecutiveErrors).toBe(false)
  })

  it("should handle multiple endpoints with mixed health states", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000)

    const mockEndpoints = [
      {
        id: "ep1",
        domain: "healthy.hr",
        path: "/news",
        name: "Healthy Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: oneHourAgo,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
      {
        id: "ep2",
        domain: "stale.hr",
        path: "/news",
        name: "Stale Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: thirtyHoursAgo,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
      {
        id: "ep3",
        domain: "error.hr",
        path: "/news",
        name: "Error Endpoint",
        priority: "CRITICAL",
        lastScrapedAt: oneHourAgo,
        consecutiveErrors: 5,
        lastError: "Connection refused",
        isActive: true,
      },
      {
        id: "ep4",
        domain: "never.hr",
        path: "/news",
        name: "Never Scraped",
        priority: "CRITICAL",
        lastScrapedAt: null,
        consecutiveErrors: 0,
        lastError: null,
        isActive: true,
      },
    ]

    vi.mocked(db.discoveryEndpoint.findMany).mockResolvedValue(mockEndpoints as never)

    const result = await computeEndpointHealth("CRITICAL")

    expect(result).toHaveLength(4)

    // Healthy
    const healthy = result.find((e) => e.id === "ep1")!
    expect(healthy.isSlaBreached).toBe(false)
    expect(healthy.hasConsecutiveErrors).toBe(false)

    // Stale (SLA breach)
    const stale = result.find((e) => e.id === "ep2")!
    expect(stale.isSlaBreached).toBe(true)
    expect(stale.hasConsecutiveErrors).toBe(false)

    // Error (consecutive errors)
    const error = result.find((e) => e.id === "ep3")!
    expect(error.isSlaBreached).toBe(false)
    expect(error.hasConsecutiveErrors).toBe(true)

    // Never scraped (SLA breach)
    const never = result.find((e) => e.id === "ep4")!
    expect(never.isSlaBreached).toBe(true)
    expect(never.hasConsecutiveErrors).toBe(false)
  })
})

describe("getCircuitBreakerStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should report open circuit breakers", () => {
    vi.mocked(rateLimiter.getHealthStatus).mockReturnValue({
      domains: {
        "broken.hr": {
          isHealthy: false,
          successRate: 0,
          consecutiveErrors: 5,
          isCircuitBroken: true,
          lastError: "Connection refused",
        },
        "healthy.hr": {
          isHealthy: true,
          successRate: 1,
          consecutiveErrors: 0,
          isCircuitBroken: false,
        },
      },
      overallHealthy: false,
    })

    const status = getCircuitBreakerStatus()

    expect(status).toHaveLength(2)
    const broken = status.find((s) => s.domain === "broken.hr")!
    expect(broken.isOpen).toBe(true)
    expect(broken.consecutiveErrors).toBe(5)

    const healthy = status.find((s) => s.domain === "healthy.hr")!
    expect(healthy.isOpen).toBe(false)
  })
})
