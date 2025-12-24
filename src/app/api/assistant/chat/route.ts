import { NextRequest, NextResponse } from "next/server"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { validateResponse } from "@/lib/assistant/validation"
import { SCHEMA_VERSION, type Surface, type AssistantResponse } from "@/lib/assistant/types"
import { nanoid } from "nanoid"

interface ChatRequest {
  query: string
  surface: Surface
  companyId?: string
}

/**
 * FAIL-CLOSED API ROUTE
 *
 * If validation fails, we MUST return a proper REFUSAL response,
 * not a 500 error. This ensures the client always receives a valid
 * AssistantResponse that can be rendered safely.
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`

  try {
    const body = (await request.json()) as ChatRequest

    // Validate request
    if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    if (!body.surface || !["MARKETING", "APP"].includes(body.surface)) {
      return NextResponse.json({ error: "Invalid surface" }, { status: 400 })
    }

    // Build answer from rules
    const response = await buildAnswer(body.query.trim(), body.surface, body.companyId)

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
