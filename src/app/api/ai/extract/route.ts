import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { extractFromImage } from "@/lib/ai/ocr"
import { extractReceipt } from "@/lib/ai/extract"
import { withApiLogging } from "@/lib/api-logging"
import { logger } from "@/lib/logger"
import { updateContext } from "@/lib/context"
import { db } from "@/lib/db"
import { checkRateLimit } from "@/lib/ai/rate-limiter"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * Schema for document extraction requests
 * - image: base64-encoded image data for OCR (max 10MB base64, ~7.5MB raw)
 * - text: raw text content for extraction (max 50000 chars for long receipts/invoices)
 * At least one of image or text must be provided
 */
const extractRequestSchema = z
  .object({
    image: z.string().max(10_000_000, "Image data must be 10MB or less").optional(),
    text: z.string().max(50_000, "Text must be 50000 characters or less").optional(),
  })
  .refine((data) => data.image || data.text, { message: "Either image or text is required" })

export const POST = withApiLogging(async (req: NextRequest) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  updateContext({ userId: session.user?.id ?? undefined })

  try {
    // Get company ID
    const companyUser = await db.companyUser.findFirst({
      where: { userId: session.user?.id ?? "", isDefault: true },
      include: { company: true },
    })

    if (!companyUser?.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const companyId = companyUser.company.id
    updateContext({ companyId })

    const { image, text } = await parseBody(req, extractRequestSchema)

    // Check rate limits before processing
    const operation = image ? "ocr_receipt" : "extract_receipt"
    const rateLimitCheck = await checkRateLimit(companyId, operation)

    if (!rateLimitCheck.allowed) {
      logger.warn({ companyId, operation, reason: rateLimitCheck.reason }, "Rate limit exceeded")
      return NextResponse.json(
        {
          error: rateLimitCheck.reason || "Rate limit exceeded",
          usage: rateLimitCheck.usage,
          retryAfter: rateLimitCheck.retryAfter,
        },
        { status: 429 }
      )
    }

    // Process the request with companyId for tracking
    if (image) {
      const base64Image = image.replace(/^data:image\/\w+;base64,/, "")
      const result = await extractFromImage(base64Image, companyId)
      return NextResponse.json({
        ...result,
        usage: rateLimitCheck.usage,
      })
    }

    if (text) {
      const result = await extractReceipt(text, companyId)
      return NextResponse.json({
        ...result,
        usage: rateLimitCheck.usage,
      })
    }

    return NextResponse.json({ error: "No input provided" }, { status: 400 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    logger.error({ error }, "AI extraction error")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    )
  }
})
