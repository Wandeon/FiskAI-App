// src/lib/assistant/reasoning/sinks/sse-sink.ts
import type { ReasoningSink } from "./types"
import type { ReasoningEvent } from "../types"
import { isTerminal } from "../types"

const encoder = new TextEncoder()

export function createSSESink(
  controller: ReadableStreamDefaultController<Uint8Array>
): ReasoningSink {
  return {
    mode: "nonBlocking",

    write(event: ReasoningEvent): void {
      const eventType = isTerminal(event) ? "terminal" : "reasoning"
      const data = JSON.stringify(event)

      const sseMessage = `event: ${eventType}\nid: ${event.id}\ndata: ${data}\n\n`
      controller.enqueue(encoder.encode(sseMessage))
    },

    async flush(): Promise<void> {
      // SSE sink doesn't buffer, nothing to flush
    },
  }
}

export function sendHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>): void {
  const heartbeat = `event: heartbeat\ndata: {"ts":"${new Date().toISOString()}"}\n\n`
  controller.enqueue(encoder.encode(heartbeat))
}
