// src/app/api/assistant/chat/reasoning/route.ts
import { NextRequest } from "next/server"
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "@/lib/assistant/reasoning/pipeline"
import {
  createSSESink,
  sendHeartbeat,
  createAuditSink,
  consumeReasoning,
} from "@/lib/assistant/reasoning/sinks"
import { type UserContextSnapshot } from "@/lib/assistant/reasoning/types"
import { type Surface } from "@/lib/assistant/types"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * Schema for reasoning requests
 * - query: user's question for the AI reasoning pipeline (max 4000 chars to prevent abuse)
 * - surface: context where the request originates
 * - companyId: optional company context for personalized responses
 */
const reasoningRequestSchema = z.object({
  query: z.string().min(1, "Query is required").max(4000, "Query must be 4000 characters or less"),
  surface: z.enum(["MARKETING", "APP"], { message: "Invalid surface" }),
  companyId: z.string().uuid("Invalid company ID format").optional(),
})

const HEARTBEAT_INTERVAL_MS = 10000

/**
 * SSE STREAMING REASONING ENDPOINT
 *
 * Streams ReasoningEvents as the pipeline executes:
 * - event: reasoning - intermediate stage events
 * - event: terminal - final ANSWER/QUALIFIED_ANSWER/REFUSAL/ERROR
 * - event: heartbeat - keepalive every 10s
 *
 * Wire format:
 *   event: reasoning
 *   id: req_abc123_001
 *   data: {"v":1,"stage":"SOURCES","status":"progress",...}
 *
 *   event: terminal
 *   id: req_abc123_final
 *   data: {"v":1,"stage":"ANSWER","status":"complete",...}
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${nanoid()}`

  let body: z.infer<typeof reasoningRequestSchema>
  try {
    body = await parseBody(request, reasoningRequestSchema)
  } catch (error) {
    if (isValidationError(error)) {
      return new Response(JSON.stringify(formatValidationError(error)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Create initial user context snapshot
  const userContextSnapshot: UserContextSnapshot = {
    assumedDefaults: ["vatStatus: unknown", "turnoverBand: unknown"],
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Create sinks
      const sseSink = createSSESink(controller)
      const auditSink = createAuditSink(requestId, userContextSnapshot)

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          sendHeartbeat(controller)
        } catch {
          // Controller may be closed
          clearInterval(heartbeatInterval)
        }
      }, HEARTBEAT_INTERVAL_MS)

      try {
        // Create and consume the reasoning pipeline
        const generator = buildAnswerWithReasoning(
          requestId,
          body.query.trim(),
          body.surface,
          undefined // companyContext - would load from companyId
        )

        // Consume with both sinks
        await consumeReasoning(generator, [sseSink, auditSink])
      } catch (error) {
        console.error("[Reasoning API] Pipeline error", { requestId, error })

        // Emit error event
        const errorEvent = {
          v: 1,
          id: `${requestId}_error`,
          requestId,
          seq: 999,
          ts: new Date().toISOString(),
          stage: "ERROR",
          status: "complete",
          severity: "critical",
          data: {
            code: "INTERNAL",
            message: "An unexpected error occurred",
            correlationId: requestId,
            retriable: true,
          },
        }

        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            `event: terminal\nid: ${errorEvent.id}\ndata: ${JSON.stringify(errorEvent)}\n\n`
          )
        )
      } finally {
        clearInterval(heartbeatInterval)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  })
}
