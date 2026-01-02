import { NextRequest, NextResponse } from "next/server"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { validateResponse } from "@/lib/assistant/validation"
import { SCHEMA_VERSION, type Surface, type AssistantResponse } from "@/lib/assistant/types"
import { nanoid } from "nanoid"
import { getReasoningMode } from "@/lib/assistant/reasoning/feature-flags"
import { runShadowMode } from "@/lib/assistant/reasoning/shadow-runner"
import { buildAnswerCompat } from "@/lib/assistant/reasoning/compat"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * Schema for chat requests
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
 * FAIL-CLOSED API ROUTE
 *
 * Supports three modes based on REASONING_MODE env var:
 * - off: Legacy pipeline only
 * - shadow: Both pipelines, legacy serves
 * - live: New reasoning pipeline
 *
 * If validation fails, we MUST return a proper REFUSAL response,
 * not a 500 error. This ensures the client always receives a valid
 * AssistantResponse that can be rendered safely.
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`

  try {
    const body = await parseBody(request, chatRequestSchema)

    // Determine which pipeline to use
    const mode = getReasoningMode()
    let response: AssistantResponse

    switch (mode) {
      case "shadow":
        // Run both pipelines, return legacy
        response = await runShadowMode(body.query.trim(), body.surface, body.companyId)
        break

      case "live":
        // Use new reasoning pipeline with compat wrapper
        response = await buildAnswerCompat(body.query.trim(), body.surface, body.companyId)
        break

      case "off":
      default:
        // Use legacy pipeline only
        response = await buildAnswer(body.query.trim(), body.surface, body.companyId)
        break
    }

    // FAIL-CLOSED: Validate response before sending
    const validation = validateResponse(response)
    if (!validation.valid) {
      // Structured logging for audit trail
      console.error("[Assistant API] FAIL-CLOSED triggered", {
        requestId: response.requestId,
        traceId: response.traceId,
        errors: validation.errors,
        query: body.query.substring(0, 100),
        surface: body.surface,
        mode,
      })

      // Return a valid REFUSAL response, not a 500 error
      const refusalResponse: AssistantResponse = {
        schemaVersion: SCHEMA_VERSION,
        requestId: response.requestId || requestId,
        traceId: response.traceId || traceId,
        kind: "REFUSAL",
        topic: response.topic || "REGULATORY",
        surface: body.surface,
        createdAt: new Date().toISOString(),
        headline: "Nije moguće potvrditi odgovor",
        directAnswer: "",
        refusalReason: "NO_CITABLE_RULES",
        refusal: {
          message:
            "Nismo pronašli dovoljno pouzdane izvore za ovaj odgovor. Molimo pokušajte s drugačijim pitanjem.",
          relatedTopics: ["porez na dohodak", "PDV", "doprinosi", "fiskalizacija"],
        },
      }

      return NextResponse.json(refusalResponse)
    }

    return NextResponse.json(response)
  } catch (error) {
    // Handle validation errors with proper format
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }

    console.error("[Assistant API] Internal error", {
      requestId,
      traceId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    // Even on error, return a valid REFUSAL response
    const errorResponse: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId,
      traceId,
      kind: "REFUSAL",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Došlo je do pogreške",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES",
      refusal: {
        message: "Privremena pogreška sustava. Molimo pokušajte ponovo.",
      },
    }

    return NextResponse.json(errorResponse)
  }
}
