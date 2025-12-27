import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { calculateNextScan, calculateIntervalHours, describeInterval } from "../scan-scheduler"

describe("calculateIntervalHours", () => {
  it("returns shorter intervals for CRITICAL risk", () => {
    const critical = calculateIntervalHours(0.5, "CRITICAL")
    const medium = calculateIntervalHours(0.5, "MEDIUM")
    expect(critical).toBeLessThan(medium)
  })

  it("returns shorter intervals for higher velocity", () => {
    const highVelocity = calculateIntervalHours(0.9, "MEDIUM")
    const lowVelocity = calculateIntervalHours(0.1, "MEDIUM")
    expect(highVelocity).toBeLessThan(lowVelocity)
  })

  it("respects minimum interval (baseIntervalHours)", () => {
    // Even with max velocity and max risk, should not go below 4h
    const interval = calculateIntervalHours(0.99, "CRITICAL")
    expect(interval).toBeGreaterThanOrEqual(4)
  })

  it("respects maximum interval", () => {
    // Low velocity + low risk should cap at 720h (30 days)
    const interval = calculateIntervalHours(0.01, "LOW")
    expect(interval).toBeLessThanOrEqual(720)
  })

  describe("specific interval values", () => {
    it("CRITICAL + high velocity (0.9) = ~4h (floor)", () => {
      const interval = calculateIntervalHours(0.9, "CRITICAL")
      expect(interval).toBe(4) // Floored
    })

    it("MEDIUM + moderate velocity (0.5) = ~8h", () => {
      const interval = calculateIntervalHours(0.5, "MEDIUM")
      expect(interval).toBe(8)
    })

    it("LOW + low velocity (0.1) = ~80h", () => {
      const interval = calculateIntervalHours(0.1, "LOW")
      expect(interval).toBe(80)
    })
  })
})

describe("calculateNextScan", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns a future date", () => {
    const result = calculateNextScan(0.5, "MEDIUM")
    expect(result.getTime()).toBeGreaterThan(Date.now())
  })

  it("applies jitter (+/- 10%)", () => {
    // Run multiple times and check variance
    const results: number[] = []
    for (let i = 0; i < 10; i++) {
      const result = calculateNextScan(0.5, "MEDIUM")
      results.push(result.getTime())
    }

    const min = Math.min(...results)
    const max = Math.max(...results)
    expect(max - min).toBeGreaterThan(0) // Has variance
  })
})

describe("describeInterval", () => {
  it("describes hours for < 24h", () => {
    expect(describeInterval(4)).toBe("4h")
    expect(describeInterval(12)).toBe("12h")
  })

  it("describes days for 24-168h", () => {
    expect(describeInterval(48)).toBe("2d")
    expect(describeInterval(120)).toBe("5d")
  })

  it("describes weeks for >= 168h", () => {
    expect(describeInterval(168)).toBe("1w")
    expect(describeInterval(336)).toBe("2w")
  })
})
