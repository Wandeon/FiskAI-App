// src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts
import { describe, it, expect } from "vitest"
import { parseSSEMessage, SSEMessage } from "../sse-parser"

describe("parseSSEMessage", () => {
  it("parses reasoning event", () => {
    const raw = `event: reasoning
id: req_test_001
data: {"v":1,"stage":"SOURCES","status":"started"}

`
    const message = parseSSEMessage(raw)

    expect(message).not.toBeNull()
    expect(message?.type).toBe("reasoning")
    expect(message?.id).toBe("req_test_001")
    expect(message?.data.stage).toBe("SOURCES")
  })

  it("parses terminal event", () => {
    const raw = `event: terminal
id: req_test_final
data: {"v":1,"stage":"ANSWER","status":"complete"}

`
    const message = parseSSEMessage(raw)

    expect(message?.type).toBe("terminal")
    expect(message?.data.stage).toBe("ANSWER")
  })

  it("parses heartbeat", () => {
    const raw = `event: heartbeat
data: {"ts":"2025-12-26T10:00:00Z"}

`
    const message = parseSSEMessage(raw)

    expect(message?.type).toBe("heartbeat")
    expect(message?.data.ts).toBeDefined()
  })

  it("returns null for invalid message", () => {
    const raw = "invalid message"
    const message = parseSSEMessage(raw)

    expect(message).toBeNull()
  })

  it("handles multiline data", () => {
    const raw = `event: reasoning
id: req_test_001
data: {"v":1,"stage":"ANALYSIS","status":"checkpoint",
data: "message":"Comparing sources..."}

`
    // Note: SSE spec says data lines are concatenated with newlines
    // Our parser should handle this
    const message = parseSSEMessage(raw)

    expect(message).not.toBeNull()
  })
})
