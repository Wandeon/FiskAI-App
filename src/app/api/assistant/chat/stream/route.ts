import { NextRequest } from "next/server"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { validateResponse } from "@/lib/assistant/validation"
import { SCHEMA_VERSION, type Surface, type AssistantResponse } from "@/lib/assistant/types"
import { nanoid } from "nanoid"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * Schema for streaming chat requests
 * - query: user's question for the AI assistant (max 4000 chars to prevent abuse)
 * - surface: context where the request originates
 * - companyId: optional company context for personalized responses
 */
const chatRequestSchema = z.object({
  query: z.string().min(1, "Query is required").max(4000, "Query must be 4000 characters or less"),
  surface: z.enum(["MARKETING", "APP"], { message: "Invalid surface" }),
  companyId: z.string().uuid("Invalid company ID format").optional(),
})

/**
 * FAIL-CLOSED STREAMING ROUTE
 *
 * CRITICAL INVARIANT: For REGULATORY topics, citations MUST arrive
 * BEFORE answer content. This prevents users from seeing uncited
 * regulatory claims.
 *
 * Streaming order:
 * 1. Metadata (kind, topic, surface, requestId)
 * 2. Citations (REQUIRED for REGULATORY ANSWER - sent BEFORE content)
 * 3. Content (headline, directAnswer, confidence)
 * 4. Refusal details (if REFUSAL)
 * 5. Related questions
 * 6. Done signal
 *
 * If validation fails, we emit a terminal REFUSAL and close the stream.
 */
export async function POST(request: NextRequest) {
  const fallbackRequestId = `req_${nanoid()}`
  const fallbackTraceId = `trace_${nanoid()}`

  let body: z.infer<typeof chatRequestSchema>
  try {
    body = await parseBody(request, chatRequestSchema)
  } catch (error) {
    if (isValidationError(error)) {
      return new Response(JSON.stringify(formatValidationError(error)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Build full answer FIRST (we buffer before streaming)
        const response = await buildAnswer(body.query, body.surface, body.companyId)

        // FAIL-CLOSED: Validate BEFORE streaming anything
        const validation = validateResponse(response)
        if (!validation.valid) {
          // Log structured error for audit trail
          console.error("[Assistant Streaming] FAIL-CLOSED triggered", {
            requestId: response.requestId,
            traceId: response.traceId,
            errors: validation.errors,
            query: body.query.substring(0, 100),
            surface: body.surface,
          })

          // Emit a valid REFUSAL response as a single chunk
          const refusalResponse: AssistantResponse = {
            schemaVersion: SCHEMA_VERSION,
            requestId: response.requestId || fallbackRequestId,
            traceId: response.traceId || fallbackTraceId,
            kind: "REFUSAL",
            topic: response.topic || "REGULATORY",
            surface: body.surface,
            createdAt: new Date().toISOString(),
            headline: "Nije moguće potvrditi odgovor",
            directAnswer: "",
            refusalReason: "NO_CITABLE_RULES",
            refusal: {
              message: "Nismo pronašli dovoljno pouzdane izvore za ovaj odgovor.",
            },
          }

          controller.enqueue(encoder.encode(JSON.stringify(refusalResponse) + "\n"))
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ requestId: refusalResponse.requestId, _done: true }) + "\n"
            )
          )
          controller.close()
          return
        }

        // Chunk 1: Metadata (always first)
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              schemaVersion: response.schemaVersion,
              requestId: response.requestId,
              traceId: response.traceId,
              kind: response.kind,
              topic: response.topic,
              surface: response.surface,
              createdAt: response.createdAt,
            }) + "\n"
          )
        )

        await delay(20)

        // Chunk 2: Citations BEFORE content (CRITICAL for REGULATORY)
        // This ensures users never see uncited regulatory claims
        if (response.citations) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                requestId: response.requestId,
                citations: response.citations,
              }) + "\n"
            )
          )
          await delay(20)
        }

        // Chunk 3: Answer content (AFTER citations for REGULATORY)
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              requestId: response.requestId,
              headline: response.headline,
              directAnswer: response.directAnswer,
              confidence: response.confidence,
            }) + "\n"
          )
        )

        await delay(20)

        // Chunk 4: Refusal details (if present)
        if (response.refusalReason) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                requestId: response.requestId,
                refusalReason: response.refusalReason,
                refusal: response.refusal,
              }) + "\n"
            )
          )
        }

        // Chunk 5: Related questions
        if (response.relatedQuestions) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                requestId: response.requestId,
                relatedQuestions: response.relatedQuestions,
              }) + "\n"
            )
          )
        }

        // Final chunk: done signal (REQUIRED terminal marker)
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              requestId: response.requestId,
              _done: true,
            }) + "\n"
          )
        )

        controller.close()
      } catch (error) {
        console.error("[Assistant Streaming] Internal error", {
          requestId: fallbackRequestId,
          traceId: fallbackTraceId,
          error: error instanceof Error ? error.message : "Unknown error",
        })

        // Even on error, emit a valid REFUSAL
        const errorResponse: AssistantResponse = {
          schemaVersion: SCHEMA_VERSION,
          requestId: fallbackRequestId,
          traceId: fallbackTraceId,
          kind: "REFUSAL",
          topic: "REGULATORY",
          surface: body.surface || "MARKETING",
          createdAt: new Date().toISOString(),
          headline: "Došlo je do pogreške",
          directAnswer: "",
          refusalReason: "NO_CITABLE_RULES",
          refusal: {
            message: "Privremena pogreška sustava. Molimo pokušajte ponovo.",
          },
        }

        controller.enqueue(encoder.encode(JSON.stringify(errorResponse) + "\n"))
        controller.enqueue(
          encoder.encode(JSON.stringify({ requestId: fallbackRequestId, _done: true }) + "\n")
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
