// src/lib/assistant/hooks/useAssistantAnalytics.ts
import { useCallback } from "react"
import type { Surface, Topic, ErrorType, RefusalReason, AssistantResponse } from "../types"
import type { AnalyticsEventName } from "../analytics"
import { trackEvent } from "@/lib/analytics"

interface UseAssistantAnalyticsProps {
  surface: Surface
}

export function useAssistantAnalytics({ surface }: UseAssistantAnalyticsProps) {
  const trackQuerySubmit = useCallback(
    (params: { query: string; suggestionUsed: boolean; fromHistory: boolean }) => {
      trackEvent("assistant.query.submit", {
        surface,
        queryLength: params.query.length,
        suggestionUsed: params.suggestionUsed,
        fromHistory: params.fromHistory,
      })
    },
    [surface]
  )

  const trackQueryComplete = useCallback(
    (params: { response: AssistantResponse; latencyMs: number }) => {
      const citationCount =
        (params.response.citations?.supporting?.length || 0) +
        (params.response.citations?.primary ? 1 : 0)

      trackEvent("assistant.query.complete", {
        surface,
        topic: params.response.topic,
        kind: params.response.kind,
        latencyMs: params.latencyMs,
        citationCount,
      })
    },
    [surface]
  )

  const trackQueryRefusal = useCallback(
    (params: { response: AssistantResponse }) => {
      trackEvent("assistant.query.refusal", {
        surface,
        topic: params.response.topic,
        refusalReason: params.response.refusalReason,
      })
    },
    [surface]
  )

  const trackQueryError = useCallback(
    (params: {
      errorType: ErrorType
      httpStatus?: number
      latencyMs: number
      retryCount: number
    }) => {
      trackEvent("assistant.query.error", {
        errorType: params.errorType,
        httpStatus: params.httpStatus,
        latencyMs: params.latencyMs,
        surface,
        retryCount: params.retryCount,
      })
    },
    [surface]
  )

  const trackDrawerExpand = useCallback((params: { drawer: "why" | "sources" | "clientData" }) => {
    trackEvent("assistant.drawer.expand", {
      drawer: params.drawer,
    })
  }, [])

  const trackFeedbackSubmit = useCallback(
    (params: { requestId: string; positive: boolean; comment?: string }) => {
      trackEvent("assistant.feedback.submit", params)
    },
    []
  )

  const trackSuggestionClick = useCallback(
    (params: {
      type: "initial" | "related" | "refusal"
      suggestionText: string
      position: number
    }) => {
      trackEvent("assistant.suggestion.click", params)
    },
    []
  )

  const trackHistoryRestore = useCallback((params: { historyIndex: number }) => {
    trackEvent("assistant.history.restore", params)
  }, [])

  const trackCTAShown = useCallback(
    (params: {
      location: "contextual" | "personalization" | "footer"
      variant: string
      topic: Topic
    }) => {
      trackEvent("marketing.cta.shown", params)
    },
    []
  )

  const trackCTAClick = useCallback(
    (params: {
      location: "contextual" | "personalization" | "footer"
      variant: string
      topic: Topic
      queriesInSession: number
    }) => {
      trackEvent("marketing.cta.click", params)
    },
    []
  )

  const trackCTADismiss = useCallback(
    (params: {
      location: "contextual" | "personalization" | "footer"
      queriesAtDismissal: number
    }) => {
      trackEvent("marketing.cta.dismiss", params)
    },
    []
  )

  return {
    trackQuerySubmit,
    trackQueryComplete,
    trackQueryRefusal,
    trackQueryError,
    trackDrawerExpand,
    trackFeedbackSubmit,
    trackSuggestionClick,
    trackHistoryRestore,
    trackCTAShown,
    trackCTAClick,
    trackCTADismiss,
  }
}
