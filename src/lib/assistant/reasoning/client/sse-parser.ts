// src/lib/assistant/reasoning/client/sse-parser.ts
import type { ReasoningEvent } from "../types"
import type { SSEEventType } from "./types"
import { SSE_EVENT_TYPES } from "./types"

export interface SSEMessage {
  type: SSEEventType
  id?: string
  data: ReasoningEvent | { ts: string }
}

/**
 * Parse a raw SSE message into structured format.
 *
 * SSE format:
 *   event: <type>
 *   id: <id>
 *   data: <json>
 *
 */
export function parseSSEMessage(raw: string): SSEMessage | null {
  const lines = raw.split("\n")

  let eventType: string | undefined
  let id: string | undefined
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith("id:")) {
      id = line.slice(3).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!eventType || dataLines.length === 0) {
    return null
  }

  // Validate event type
  const validTypes = Object.values(SSE_EVENT_TYPES)
  if (!validTypes.includes(eventType as SSEEventType)) {
    return null
  }

  // Parse JSON data
  try {
    const jsonStr = dataLines.join("")
    const data = JSON.parse(jsonStr)

    return {
      type: eventType as SSEEventType,
      id,
      data,
    }
  } catch {
    return null
  }
}

/**
 * Create an SSE event source connection.
 * Returns cleanup function.
 */
export function createSSEConnection(
  url: string,
  body: object,
  handlers: {
    onMessage: (message: SSEMessage) => void
    onError: (error: Error) => void
    onOpen?: () => void
  }
): () => void {
  const controller = new AbortController()

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      handlers.onOpen?.()

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

        // Split on double newline (SSE message delimiter)
        const messages = buffer.split("\n\n")
        buffer = messages.pop() || "" // Keep incomplete message in buffer

        for (const raw of messages) {
          if (raw.trim()) {
            const message = parseSSEMessage(raw + "\n\n")
            if (message) {
              handlers.onMessage(message)
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        handlers.onError(error)
      }
    })

  return () => controller.abort()
}
