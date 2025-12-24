// src/lib/assistant/streaming.ts
import type { AssistantResponse, Surface } from "./types"

/**
 * NDJSON Streaming Client
 *
 * Parses newline-delimited JSON chunks from /api/assistant/chat/stream
 * and progressively builds AssistantResponse.
 */

export interface StreamChunk {
  requestId?: string
  schemaVersion?: string
  traceId?: string
  kind?: string
  topic?: string
  surface?: string
  createdAt?: string
  headline?: string
  directAnswer?: string
  confidence?: { level: string; score?: number }
  citations?: AssistantResponse["citations"]
  refusalReason?: string
  refusal?: AssistantResponse["refusal"]
  relatedQuestions?: string[]
  _done?: boolean
  error?: string
}

export interface StreamState {
  response: Partial<AssistantResponse>
  isComplete: boolean
  error: string | null
}

export function createStreamParser(): {
  parseChunk: (chunk: string) => StreamChunk | null
  mergeChunk: (state: StreamState, chunk: StreamChunk) => StreamState
  initialState: StreamState
} {
  const initialState: StreamState = {
    response: {},
    isComplete: false,
    error: null,
  }

  function parseChunk(line: string): StreamChunk | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed) as StreamChunk
    } catch {
      return null
    }
  }

  function mergeChunk(state: StreamState, chunk: StreamChunk): StreamState {
    if (chunk.error) {
      return { ...state, error: chunk.error }
    }

    if (chunk._done) {
      return { ...state, isComplete: true }
    }

    // Merge chunk fields into response
    const response = { ...state.response }

    if (chunk.schemaVersion) response.schemaVersion = chunk.schemaVersion as "1.0.0"
    if (chunk.requestId) response.requestId = chunk.requestId
    if (chunk.traceId) response.traceId = chunk.traceId
    if (chunk.kind) response.kind = chunk.kind as AssistantResponse["kind"]
    if (chunk.topic) response.topic = chunk.topic as AssistantResponse["topic"]
    if (chunk.surface) response.surface = chunk.surface as AssistantResponse["surface"]
    if (chunk.createdAt) response.createdAt = chunk.createdAt
    if (chunk.headline) response.headline = chunk.headline
    if (chunk.directAnswer) response.directAnswer = chunk.directAnswer
    if (chunk.confidence) response.confidence = chunk.confidence as AssistantResponse["confidence"]
    if (chunk.citations) response.citations = chunk.citations
    if (chunk.refusalReason)
      response.refusalReason = chunk.refusalReason as AssistantResponse["refusalReason"]
    if (chunk.refusal) response.refusal = chunk.refusal
    if (chunk.relatedQuestions) response.relatedQuestions = chunk.relatedQuestions

    return { ...state, response }
  }

  return { parseChunk, mergeChunk, initialState }
}

export interface StreamOptions {
  onChunk?: (state: StreamState) => void
  onComplete?: (response: Partial<AssistantResponse>) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

/**
 * Fetch and parse NDJSON stream from /api/assistant/chat/stream
 */
export async function fetchAssistantStream(
  query: string,
  surface: Surface,
  options: StreamOptions = {},
  companyId?: string
): Promise<Partial<AssistantResponse>> {
  const { parseChunk, mergeChunk, initialState } = createStreamParser()

  const response = await fetch("/api/assistant/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, surface, companyId }),
    signal: options.signal,
  })

  if (!response.ok) {
    const error = `HTTP ${response.status}: ${response.statusText}`
    options.onError?.(error)
    throw new Error(error)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const error = "No response body"
    options.onError?.(error)
    throw new Error(error)
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let state = initialState

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split("\n")
      buffer = lines.pop() || "" // Keep incomplete line in buffer

      for (const line of lines) {
        const chunk = parseChunk(line)
        if (chunk) {
          state = mergeChunk(state, chunk)
          options.onChunk?.(state)

          if (state.error) {
            options.onError?.(state.error)
            throw new Error(state.error)
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const chunk = parseChunk(buffer)
      if (chunk) {
        state = mergeChunk(state, chunk)
        options.onChunk?.(state)
      }
    }

    options.onComplete?.(state.response)
    return state.response
  } finally {
    reader.releaseLock()
  }
}
