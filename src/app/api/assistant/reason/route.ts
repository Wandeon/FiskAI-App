// src/app/api/assistant/reason/route.ts
import { NextRequest } from "next/server"
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "@/lib/assistant/reasoning/reasoning-pipeline"
import type { UserContext } from "@/lib/assistant/reasoning/types"

export const dynamic = "force-dynamic"

/**
 * SSE streaming endpoint for reasoning pipeline
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const body = await request.json()
    const { query, context } = body as { query: string; context?: UserContext }

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const requestId = `req_${nanoid(12)}`

    const stream = new ReadableStream({
      async start(controller) {
        const generator = buildAnswerWithReasoning(requestId, query, context)

        try {
          for await (const event of generator) {
            // Format as SSE
            const eventType =
              event.stage === "ANSWER" ||
              event.stage === "CONDITIONAL_ANSWER" ||
              event.stage === "REFUSAL" ||
              event.stage === "ERROR"
                ? "terminal"
                : "reasoning"

            const sseMessage = [
              `event: ${eventType}`,
              `id: ${event.id}`,
              `data: ${JSON.stringify(event)}`,
              "",
              "",
            ].join("\n")

            controller.enqueue(encoder.encode(sseMessage))
          }
        } catch (error) {
          const errorEvent = {
            v: 1,
            id: `${requestId}_error`,
            requestId,
            seq: 999,
            ts: new Date().toISOString(),
            stage: "ERROR",
            status: "complete",
            data: {
              correlationId: requestId,
              message: error instanceof Error ? error.message : "Unknown error",
              retriable: true,
            },
          }

          const sseMessage = [
            "event: terminal",
            `id: ${errorEvent.id}`,
            `data: ${JSON.stringify(errorEvent)}`,
            "",
            "",
          ].join("\n")

          controller.enqueue(encoder.encode(sseMessage))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
