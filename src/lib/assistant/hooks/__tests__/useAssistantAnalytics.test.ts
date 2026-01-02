// src/lib/assistant/hooks/__tests__/useAssistantAnalytics.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAssistantAnalytics } from "../useAssistantAnalytics"
import type { AssistantResponse, Surface } from "../../types"
import { SCHEMA_VERSION } from "../../types"

// Mock analytics provider
const mockTrack = vi.fn()
vi.mock("@/lib/analytics", () => ({
  trackEvent: (name: string, payload: any) => mockTrack(name, payload),
}))

const mockAnswer: AssistantResponse = {
  schemaVersion: SCHEMA_VERSION,
  requestId: "req_123",
  traceId: "trace_456",
  kind: "ANSWER",
  topic: "REGULATORY",
  surface: "MARKETING",
  createdAt: new Date().toISOString(),
  headline: "VAT is 25%",
  directAnswer: "Standard rate.",
  citations: {
    primary: {
      id: "src_1",
      title: "Law",
      authority: "LAW",
      url: "https://example.com",
      effectiveFrom: "2024-01-01",
      confidence: 0.95,
    },
    supporting: [],
  },
}

describe("useAssistantAnalytics", () => {
  beforeEach(() => {
    mockTrack.mockClear()
  })

  describe("trackQuerySubmit", () => {
    it("fires assistant.query.submit event", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackQuerySubmit({
          query: "What is VAT rate?",
          suggestionUsed: false,
          fromHistory: false,
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.query.submit", {
        surface: "MARKETING",
        queryLength: 17,
        suggestionUsed: false,
        fromHistory: false,
      })
    })
  })

  describe("trackQueryComplete", () => {
    it("fires assistant.query.complete event with correct payload", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackQueryComplete({
          response: mockAnswer,
          latencyMs: 1234,
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.query.complete", {
        surface: "MARKETING",
        topic: "REGULATORY",
        kind: "ANSWER",
        latencyMs: 1234,
        citationCount: 1,
      })
    })
  })

  describe("trackQueryRefusal", () => {
    it("fires assistant.query.refusal event", () => {
      const refusalAnswer: AssistantResponse = {
        ...mockAnswer,
        kind: "REFUSAL",
        refusalReason: "OUT_OF_SCOPE",
      }

      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackQueryRefusal({ response: refusalAnswer })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.query.refusal", {
        surface: "MARKETING",
        topic: "REGULATORY",
        refusalReason: "OUT_OF_SCOPE",
      })
    })
  })

  describe("trackQueryError", () => {
    it("fires assistant.query.error event", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackQueryError({
          errorType: "NETWORK_FAILURE",
          latencyMs: 5000,
          retryCount: 1,
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.query.error", {
        errorType: "NETWORK_FAILURE",
        latencyMs: 5000,
        surface: "MARKETING",
        retryCount: 1,
      })
    })
  })

  describe("trackDrawerExpand", () => {
    it("fires assistant.drawer.expand event", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackDrawerExpand({ drawer: "why" })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.drawer.expand", {
        drawer: "why",
      })
    })
  })

  describe("trackSuggestionClick", () => {
    it("fires assistant.suggestion.click event", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackSuggestionClick({
          type: "initial",
          suggestionText: "VAT thresholds",
          position: 0,
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("assistant.suggestion.click", {
        type: "initial",
        suggestionText: "VAT thresholds",
        position: 0,
      })
    })
  })

  describe("trackCTAShown", () => {
    it("fires marketing.cta.shown event", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackCTAShown({
          location: "contextual",
          variant: "default",
          topic: "REGULATORY",
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("marketing.cta.shown", {
        location: "contextual",
        variant: "default",
        topic: "REGULATORY",
      })
    })
  })

  describe("trackCTAClick", () => {
    it("fires marketing.cta.click event with query count", () => {
      const { result } = renderHook(() => useAssistantAnalytics({ surface: "MARKETING" }))

      act(() => {
        result.current.trackCTAClick({
          location: "contextual",
          variant: "default",
          topic: "REGULATORY",
          queriesInSession: 3,
        })
      })

      expect(mockTrack).toHaveBeenCalledWith("marketing.cta.click", {
        location: "contextual",
        variant: "default",
        topic: "REGULATORY",
        queriesInSession: 3,
      })
    })
  })
})
