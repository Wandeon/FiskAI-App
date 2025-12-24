import { describe, it, expect } from "vitest"
import { ANALYTICS_EVENTS, type AnalyticsEvent } from "../analytics"

describe("Analytics Events", () => {
  it("exports all assistant analytics events", () => {
    expect(ANALYTICS_EVENTS).toContain("assistant.query.submit")
    expect(ANALYTICS_EVENTS).toContain("assistant.query.complete")
    expect(ANALYTICS_EVENTS).toContain("assistant.query.refusal")
    expect(ANALYTICS_EVENTS).toContain("assistant.query.error")
    expect(ANALYTICS_EVENTS).toContain("assistant.drawer.expand")
    expect(ANALYTICS_EVENTS).toContain("assistant.feedback.submit")
  })

  it("exports all marketing analytics events", () => {
    expect(ANALYTICS_EVENTS).toContain("marketing.cta.shown")
    expect(ANALYTICS_EVENTS).toContain("marketing.cta.click")
    expect(ANALYTICS_EVENTS).toContain("marketing.cta.dismiss")
  })
})
