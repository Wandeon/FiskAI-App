// src/lib/assistant/__tests__/streaming.test.ts
import { describe, it, expect } from "vitest"
import { createStreamParser, type StreamState } from "../streaming"

describe("createStreamParser", () => {
  const { parseChunk, mergeChunk, initialState } = createStreamParser()

  describe("parseChunk", () => {
    it("parses valid JSON lines", () => {
      const line = '{"requestId":"req_123","headline":"Test"}'
      const result = parseChunk(line)
      expect(result).toEqual({ requestId: "req_123", headline: "Test" })
    })

    it("returns null for empty lines", () => {
      expect(parseChunk("")).toBeNull()
      expect(parseChunk("   ")).toBeNull()
    })

    it("returns null for invalid JSON", () => {
      expect(parseChunk("not json")).toBeNull()
      expect(parseChunk("{broken")).toBeNull()
    })
  })

  describe("mergeChunk", () => {
    it("merges metadata chunk into state", () => {
      const chunk = {
        schemaVersion: "1.0.0",
        requestId: "req_1",
        traceId: "trace_1",
        kind: "ANSWER",
        topic: "REGULATORY",
        surface: "MARKETING",
        createdAt: "2024-01-01T00:00:00Z",
      }

      const state = mergeChunk(initialState, chunk)

      expect(state.response.schemaVersion).toBe("1.0.0")
      expect(state.response.requestId).toBe("req_1")
      expect(state.response.traceId).toBe("trace_1")
      expect(state.response.kind).toBe("ANSWER")
      expect(state.response.topic).toBe("REGULATORY")
      expect(state.isComplete).toBe(false)
    })

    it("merges content chunk into state", () => {
      const chunk = {
        requestId: "req_1",
        headline: "Test Headline",
        directAnswer: "Test Answer",
        confidence: { level: "HIGH", score: 0.95 },
      }

      const state = mergeChunk(initialState, chunk)

      expect(state.response.headline).toBe("Test Headline")
      expect(state.response.directAnswer).toBe("Test Answer")
      expect(state.response.confidence).toEqual({ level: "HIGH", score: 0.95 })
    })

    it("merges citations chunk into state", () => {
      const chunk = {
        requestId: "req_1",
        citations: {
          primary: {
            id: "src_1",
            title: "Test Law",
            authority: "LAW" as const,
            url: "https://example.com",
            quote: "Test quote",
            effectiveFrom: "2024-01-01",
            confidence: 0.95,
          },
          supporting: [],
        },
      }

      const state = mergeChunk(initialState, chunk)

      expect(state.response.citations?.primary.title).toBe("Test Law")
      expect(state.response.citations?.primary.quote).toBe("Test quote")
    })

    it("merges refusal chunk into state", () => {
      const chunk = {
        requestId: "req_1",
        refusalReason: "NO_CITABLE_RULES",
        refusal: {
          message: "No sources found",
        },
      }

      const state = mergeChunk(initialState, chunk)

      expect(state.response.refusalReason).toBe("NO_CITABLE_RULES")
      expect(state.response.refusal?.message).toBe("No sources found")
    })

    it("sets isComplete=true on _done chunk", () => {
      const chunk = { requestId: "req_1", _done: true }

      const state = mergeChunk(initialState, chunk)

      expect(state.isComplete).toBe(true)
    })

    it("sets error on error chunk", () => {
      const chunk = { error: "Internal error" }

      const state = mergeChunk(initialState, chunk)

      expect(state.error).toBe("Internal error")
    })

    it("progressively builds response across multiple chunks", () => {
      let state: StreamState = initialState

      // Chunk 1: Metadata
      state = mergeChunk(state, {
        schemaVersion: "1.0.0",
        requestId: "req_1",
        kind: "ANSWER",
        topic: "REGULATORY",
        surface: "MARKETING",
      })

      expect(state.response.requestId).toBe("req_1")
      expect(state.response.headline).toBeUndefined()

      // Chunk 2: Content
      state = mergeChunk(state, {
        requestId: "req_1",
        headline: "PDV stope",
        directAnswer: "Opća stopa PDV-a je 25%.",
      })

      expect(state.response.requestId).toBe("req_1") // Preserved
      expect(state.response.headline).toBe("PDV stope")
      expect(state.response.directAnswer).toBe("Opća stopa PDV-a je 25%.")

      // Chunk 3: Citations
      state = mergeChunk(state, {
        requestId: "req_1",
        citations: {
          primary: {
            id: "src_1",
            title: "Zakon o PDV-u",
            authority: "LAW" as const,
            url: "https://nn.hr/123",
            quote: "Članak 38. stopa PDV-a iznosi 25%.",
            effectiveFrom: "2024-01-01",
            confidence: 0.98,
          },
          supporting: [],
        },
      })

      expect(state.response.headline).toBe("PDV stope") // Still preserved
      expect(state.response.citations?.primary.title).toBe("Zakon o PDV-u")

      // Chunk 4: Done
      state = mergeChunk(state, { requestId: "req_1", _done: true })

      expect(state.isComplete).toBe(true)
      expect(state.response.headline).toBe("PDV stope") // All fields preserved
    })
  })

  describe("initialState", () => {
    it("starts with empty response", () => {
      expect(initialState.response).toEqual({})
    })

    it("starts with isComplete=false", () => {
      expect(initialState.isComplete).toBe(false)
    })

    it("starts with error=null", () => {
      expect(initialState.error).toBeNull()
    })
  })
})

describe("NDJSON stream parsing", () => {
  it("parses complete NDJSON stream", () => {
    const { parseChunk, mergeChunk, initialState } = createStreamParser()

    const stream = `{"schemaVersion":"1.0.0","requestId":"req_1","kind":"ANSWER","topic":"REGULATORY","surface":"MARKETING"}
{"requestId":"req_1","headline":"Test","directAnswer":"Answer"}
{"requestId":"req_1","citations":{"primary":{"id":"1","title":"Law","authority":"LAW","url":"https://example.com","quote":"Quote","effectiveFrom":"2024-01-01","confidence":0.9},"supporting":[]}}
{"requestId":"req_1","_done":true}
`

    const lines = stream.split("\n").filter((l) => l.trim())
    let state = initialState

    for (const line of lines) {
      const chunk = parseChunk(line)
      if (chunk) {
        state = mergeChunk(state, chunk)
      }
    }

    expect(state.isComplete).toBe(true)
    expect(state.response.schemaVersion).toBe("1.0.0")
    expect(state.response.kind).toBe("ANSWER")
    expect(state.response.headline).toBe("Test")
    expect(state.response.citations?.primary.quote).toBe("Quote")
  })
})
