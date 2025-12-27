"use client"

// src/lib/assistant/reasoning/client/useReasoningStream.ts
import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { ReasoningEvent, RiskTier, ContextResolutionPayload } from "../types"
import { isTerminal } from "../types"
import type { Surface } from "../../types"
import type { StreamState, UseReasoningStreamReturn, ReasoningStreamActions } from "./types"
import { createSelectors } from "./selectors"
import { createSSEConnection, type SSEMessage } from "./sse-parser"
import { SSE_EVENT_TYPES } from "./types"

interface UseReasoningStreamOptions {
  surface: Surface
  endpoint?: string
  onEvent?: (event: ReasoningEvent) => void
  onTerminal?: (event: ReasoningEvent) => void
  onError?: (error: Error) => void
}

const DEFAULT_ENDPOINT = "/api/assistant/chat/reasoning"

export function useReasoningStream(options: UseReasoningStreamOptions): UseReasoningStreamReturn {
  const { surface, endpoint = DEFAULT_ENDPOINT, onEvent, onTerminal, onError } = options

  // State
  const [requestId, setRequestId] = useState<string | null>(null)
  const [events, setEvents] = useState<ReasoningEvent[]>([])
  const [streamState, setStreamState] = useState<StreamState>("idle")
  const [error, setError] = useState<Error | null>(null)
  const [riskTier, setRiskTier] = useState<RiskTier | null>(null)

  // Cleanup ref
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  // Handle incoming SSE message
  const handleMessage = useCallback(
    (message: SSEMessage) => {
      if (message.type === SSE_EVENT_TYPES.HEARTBEAT) {
        // Ignore heartbeats for now
        return
      }

      const event = message.data as ReasoningEvent

      // Extract request ID from first event
      if (event.requestId) {
        setRequestId((prevId) => prevId || event.requestId)
      }

      // Extract risk tier from context resolution
      if (event.stage === "CONTEXT_RESOLUTION" && event.status === "complete") {
        const data = event.data as ContextResolutionPayload
        if (data?.riskTier) {
          setRiskTier(data.riskTier as RiskTier)
        }
      }

      // Check for awaiting input
      if (event.status === "awaiting_input") {
        setStreamState("awaiting_input")
      }

      // Accumulate event
      setEvents((prev) => [...prev, event])

      // Callbacks
      onEvent?.(event)

      // Check for terminal
      if (isTerminal(event)) {
        setStreamState("ended")
        onTerminal?.(event)
      }
    },
    [onEvent, onTerminal]
  )

  // Handle SSE error
  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      setStreamState("error")
      onError?.(err)
    },
    [onError]
  )

  // Submit action
  const submit = useCallback(
    (query: string) => {
      // Cancel any existing connection
      cleanupRef.current?.()

      // Reset state
      setEvents([])
      setError(null)
      setRiskTier(null)
      setRequestId(null)
      setStreamState("connecting")

      // Create connection
      const cleanup = createSSEConnection(
        endpoint,
        { query, surface },
        {
          onMessage: handleMessage,
          onError: handleError,
          onOpen: () => setStreamState("streaming"),
        }
      )

      cleanupRef.current = cleanup
    },
    [endpoint, surface, handleMessage, handleError]
  )

  // Cancel action
  const cancel = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setStreamState("idle")
  }, [])

  // Reset action
  const reset = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setRequestId(null)
    setEvents([])
    setStreamState("idle")
    setError(null)
    setRiskTier(null)
  }, [])

  // Answer clarification action
  const answerClarification = useCallback((answer: string) => {
    // For now, this would need to be implemented with a callback mechanism
    // The pipeline would need to support receiving clarification answers
    console.log("Clarification answer:", answer)
    setStreamState("streaming")
  }, [])

  // Actions object
  const actions: ReasoningStreamActions = useMemo(
    () => ({
      submit,
      cancel,
      reset,
      answerClarification,
    }),
    [submit, cancel, reset, answerClarification]
  )

  // Selectors (memoized)
  const selectors = useMemo(() => createSelectors(events), [events])

  return {
    requestId,
    events,
    streamState,
    error,
    riskTier,
    actions,
    selectors,
  }
}
