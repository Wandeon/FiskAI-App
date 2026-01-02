// src/lib/assistant/hooks/useReasoningStream.ts
"use client"

import { useState, useCallback, useRef } from "react"
import type { ReasoningEvent, TerminalPayload, UserContext } from "@/lib/assistant/reasoning/types"

interface UseReasoningStreamOptions {
  onEvent?: (event: ReasoningEvent) => void
  onComplete?: (terminal: TerminalPayload) => void
  onError?: (error: Error) => void
}

interface UseReasoningStreamReturn {
  events: ReasoningEvent[]
  terminal: TerminalPayload | null
  isStreaming: boolean
  error: Error | null
  startStream: (query: string, context?: UserContext) => Promise<void>
  cancelStream: () => void
}

export function useReasoningStream(options?: UseReasoningStreamOptions): UseReasoningStreamReturn {
  const [events, setEvents] = useState<ReasoningEvent[]>([])
  const [terminal, setTerminal] = useState<TerminalPayload | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const startStream = useCallback(
    async (query: string, context?: UserContext) => {
      // Reset state
      setEvents([])
      setTerminal(null)
      setError(null)
      setIsStreaming(true)

      // Create abort controller
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/assistant/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, context }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE events from buffer
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Keep incomplete line in buffer

          let eventType = ""
          let eventData = ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith("data:")) {
              eventData = line.slice(5).trim()
            } else if (line === "" && eventData) {
              // End of event
              try {
                const event = JSON.parse(eventData) as ReasoningEvent

                setEvents((prev) => [...prev, event])
                options?.onEvent?.(event)

                if (eventType === "terminal") {
                  setTerminal(event.data as TerminalPayload)
                  options?.onComplete?.(event.data as TerminalPayload)
                }
              } catch (e) {
                console.error("Failed to parse SSE event:", e)
              }

              eventType = ""
              eventData = ""
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled by user
          return
        }

        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        options?.onError?.(error)
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [options]
  )

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return {
    events,
    terminal,
    isStreaming,
    error,
    startStream,
    cancelStream,
  }
}
