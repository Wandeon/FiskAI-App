import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock sendSystemStatusAlerts
const mockSendAlerts = vi.fn()
vi.mock("@/lib/system-status/alerting", () => ({
  sendSystemStatusAlerts: (...args: unknown[]) => mockSendAlerts(...args),
}))

// Mock logger
const mockLoggerDebug = vi.fn()
const mockLoggerInfo = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerError = vi.fn()
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: (...args: unknown[]) => mockLoggerDebug(...args),
      info: (...args: unknown[]) => mockLoggerInfo(...args),
      warn: (...args: unknown[]) => mockLoggerWarn(...args),
      error: (...args: unknown[]) => mockLoggerError(...args),
    }),
  },
}))

// Import after mocks
import {
  emitContractFailureAlert,
  resetContractFailureThrottle,
  getContractFailureThrottleState,
} from "../alerting"

describe("health/alerting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetContractFailureThrottle()
    vi.stubEnv("NODE_ENV", "production")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("emitContractFailureAlert", () => {
    const failingFeatures = [
      {
        featureId: "news",
        name: "News Feature",
        missingTables: ["news_posts", "news_categories"],
      },
    ]

    it("sends alert on first call", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      const result = await emitContractFailureAlert(failingFeatures, "abc123")

      expect(result).toBe(true)
      expect(mockSendAlerts).toHaveBeenCalledTimes(1)
      expect(mockSendAlerts).toHaveBeenCalledWith([
        expect.objectContaining({
          eventType: "NEW_CRITICAL",
          severity: "CRITICAL",
          componentId: "health/readiness",
          owner: "platform",
        }),
      ])
    })

    it("includes feature names and missing tables in message", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      await emitContractFailureAlert(failingFeatures, "abc123")

      const alertCall = mockSendAlerts.mock.calls[0][0][0]
      expect(alertCall.message).toContain("News Feature")
      expect(alertCall.message).toContain("news_posts, news_categories")
      expect(alertCall.message).toContain("abc123")
    })

    it("includes environment in message", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      await emitContractFailureAlert(failingFeatures, "abc123")

      const alertCall = mockSendAlerts.mock.calls[0][0][0]
      expect(alertCall.message).toContain("[PRODUCTION]")
    })

    it("includes migration command in nextAction", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      await emitContractFailureAlert(failingFeatures, "abc123")

      const alertCall = mockSendAlerts.mock.calls[0][0][0]
      expect(alertCall.nextAction).toContain("npm run prisma:migrate")
      expect(alertCall.nextAction).toContain("npm run db:migrate")
    })

    it("throttles subsequent calls within cooldown window", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      // First call succeeds
      const first = await emitContractFailureAlert(failingFeatures, "abc123")
      expect(first).toBe(true)

      // Second call is throttled
      const second = await emitContractFailureAlert(failingFeatures, "abc123")
      expect(second).toBe(false)

      // Only one alert sent
      expect(mockSendAlerts).toHaveBeenCalledTimes(1)
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.objectContaining({ lastAlert: expect.any(String) }),
        "Contract failure alert throttled"
      )
    })

    it("allows alert after cooldown expires", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      // First call
      await emitContractFailureAlert(failingFeatures, "abc123")
      expect(mockSendAlerts).toHaveBeenCalledTimes(1)

      // Simulate cooldown expiry by resetting
      resetContractFailureThrottle()

      // Second call after reset
      await emitContractFailureAlert(failingFeatures, "def456")
      expect(mockSendAlerts).toHaveBeenCalledTimes(2)
    })

    it("returns false when no channels configured", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 0, failed: 0 })

      const result = await emitContractFailureAlert(failingFeatures, "abc123")

      expect(result).toBe(false)
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ result: { sent: 0, failed: 0 } }),
        "Contract failure alert not sent (no channels configured or all failed)"
      )
    })

    it("does not update throttle when no alerts sent", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 0, failed: 0 })

      await emitContractFailureAlert(failingFeatures, "abc123")

      const state = getContractFailureThrottleState()
      expect(state.lastAlertTime).toBe(0)
      expect(state.isThrottled).toBe(false)
    })

    it("returns false on error", async () => {
      mockSendAlerts.mockRejectedValue(new Error("Network error"))

      const result = await emitContractFailureAlert(failingFeatures, "abc123")

      expect(result).toBe(false)
      expect(mockLoggerError).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        "Failed to send contract failure alert"
      )
    })

    it("handles multiple failing features", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      const multipleFeatures = [
        {
          featureId: "news",
          name: "News Feature",
          missingTables: ["news_posts"],
        },
        {
          featureId: "contentAutomation",
          name: "Content Automation",
          missingTables: ["ArticleJob", "content_sync_events"],
        },
      ]

      await emitContractFailureAlert(multipleFeatures, "abc123")

      const alertCall = mockSendAlerts.mock.calls[0][0][0]
      expect(alertCall.message).toContain("News Feature, Content Automation")
      expect(alertCall.message).toContain("news_posts, ArticleJob, content_sync_events")
    })
  })

  describe("getContractFailureThrottleState", () => {
    it("returns initial state", () => {
      const state = getContractFailureThrottleState()

      expect(state.lastAlertTime).toBe(0)
      expect(state.cooldownMs).toBe(15 * 60 * 1000)
      expect(state.isThrottled).toBe(false)
    })

    it("reflects throttled state after alert", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      await emitContractFailureAlert(
        [{ featureId: "news", name: "News", missingTables: ["t1"] }],
        "v1"
      )

      const state = getContractFailureThrottleState()
      expect(state.lastAlertTime).toBeGreaterThan(0)
      expect(state.isThrottled).toBe(true)
    })
  })

  describe("resetContractFailureThrottle", () => {
    it("clears throttle state", async () => {
      mockSendAlerts.mockResolvedValue({ sent: 1, failed: 0 })

      // Set throttle
      await emitContractFailureAlert(
        [{ featureId: "news", name: "News", missingTables: ["t1"] }],
        "v1"
      )
      expect(getContractFailureThrottleState().isThrottled).toBe(true)

      // Reset
      resetContractFailureThrottle()
      expect(getContractFailureThrottleState().isThrottled).toBe(false)
    })
  })
})
