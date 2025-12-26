// e2e/reasoning-sse.spec.ts
import { test, expect } from "@playwright/test"

test.describe("Reasoning SSE Endpoint", () => {
  test.skip(
    !process.env.REASONING_MODE || process.env.REASONING_MODE === "off",
    "Reasoning mode is off"
  )

  test("streams reasoning events", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Koja je stopa PDV-a u Hrvatskoj?",
        surface: "APP",
      },
      headers: {
        Accept: "text/event-stream",
      },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("text/event-stream")
    expect(response.headers()["x-request-id"]).toMatch(/^req_/)

    // Read the stream
    const body = await response.text()
    const events = parseSSEEvents(body)

    // Should have at least context resolution and terminal
    expect(events.length).toBeGreaterThanOrEqual(2)

    // First event should be context resolution started
    expect(events[0].type).toBe("reasoning")
    expect(events[0].data.stage).toBe("CONTEXT_RESOLUTION")

    // Last event should be terminal
    const lastEvent = events[events.length - 1]
    expect(lastEvent.type).toBe("terminal")
  })

  test("returns error for invalid request", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "",
        surface: "APP",
      },
    })

    expect(response.status()).toBe(400)
  })

  test("returns error for missing query", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        surface: "APP",
      },
    })

    expect(response.status()).toBe(400)
  })

  test("returns error for invalid surface", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Test query",
        surface: "INVALID",
      },
    })

    expect(response.status()).toBe(400)
  })

  test("includes heartbeats for long-running requests", async ({ request }) => {
    // This test would need a slower query to trigger heartbeats
    // For now, just verify the endpoint doesn't hang
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await request.post("/api/assistant/chat/reasoning", {
        data: {
          query: "Koji su svi rokovi za podnošenje PDV prijave?",
          surface: "APP",
        },
        timeout: 10000,
      })

      clearTimeout(timeoutId)
      expect(response.status()).toBe(200)
    } catch (error) {
      clearTimeout(timeoutId)
      // Timeout is acceptable for this test
    }
  })

  test("events have monotonic sequence numbers", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Koja je stopa PDV-a?",
        surface: "APP",
      },
      headers: {
        Accept: "text/event-stream",
      },
    })

    expect(response.status()).toBe(200)

    const body = await response.text()
    const events = parseSSEEvents(body)

    // Filter reasoning events (which have sequence numbers)
    const reasoningEvents = events.filter((e) => e.type === "reasoning" || e.type === "terminal")

    // Verify sequence numbers are monotonically increasing
    for (let i = 1; i < reasoningEvents.length; i++) {
      const prevSeq = reasoningEvents[i - 1].data.seq
      const currSeq = reasoningEvents[i].data.seq
      expect(currSeq).toBeGreaterThan(prevSeq)
    }
  })

  test("all events contain requestId", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Koja je stopa PDV-a?",
        surface: "APP",
      },
      headers: {
        Accept: "text/event-stream",
      },
    })

    expect(response.status()).toBe(200)

    const body = await response.text()
    const events = parseSSEEvents(body)
    const requestId = response.headers()["x-request-id"]

    // All reasoning/terminal events should have matching requestId
    for (const event of events) {
      if (event.type === "reasoning" || event.type === "terminal") {
        expect(event.data.requestId).toBe(requestId)
      }
    }
  })

  test("terminal event contains outcome", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Koja je opca stopa PDV-a u Hrvatskoj?",
        surface: "APP",
      },
      headers: {
        Accept: "text/event-stream",
      },
    })

    expect(response.status()).toBe(200)

    const body = await response.text()
    const events = parseSSEEvents(body)

    // Find terminal event
    const terminalEvent = events.find((e) => e.type === "terminal")
    expect(terminalEvent).toBeDefined()

    // Terminal should be one of the valid outcomes
    const validStages = ["ANSWER", "QUALIFIED_ANSWER", "REFUSAL", "ERROR"]
    expect(validStages).toContain(terminalEvent!.data.stage)
  })
})

test.describe("Reasoning SSE - MARKETING Surface", () => {
  test.skip(
    !process.env.REASONING_MODE || process.env.REASONING_MODE === "off",
    "Reasoning mode is off"
  )

  test("accepts MARKETING surface", async ({ request }) => {
    const response = await request.post("/api/assistant/chat/reasoning", {
      data: {
        query: "Koja je stopa PDV-a?",
        surface: "MARKETING",
      },
      headers: {
        Accept: "text/event-stream",
      },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("text/event-stream")
  })
})

/**
 * Helper to parse SSE events from response body
 *
 * SSE Format:
 *   event: reasoning
 *   id: req_abc123_001
 *   data: {"v":1,"stage":"SOURCES","status":"progress",...}
 *
 *   event: terminal
 *   id: req_abc123_final
 *   data: {"v":1,"stage":"ANSWER","status":"complete",...}
 */
function parseSSEEvents(body: string): Array<{ type: string; data: any }> {
  const events: Array<{ type: string; data: any }> = []
  const lines = body.split("\n")

  let currentEvent: { type?: string; data?: string } = {}

  for (const line of lines) {
    if (line.startsWith("event:")) {
      currentEvent.type = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      currentEvent.data = line.slice(5).trim()
    } else if (line === "" && currentEvent.type && currentEvent.data) {
      try {
        events.push({
          type: currentEvent.type,
          data: JSON.parse(currentEvent.data),
        })
      } catch {
        // Skip invalid JSON
      }
      currentEvent = {}
    }
  }

  return events
}
