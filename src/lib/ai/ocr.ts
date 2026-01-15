import { ExtractionResult, ExtractedReceipt } from "./types"
import { trackAIUsage } from "./usage-tracking"
import { extractedReceiptSchema } from "./schemas"
import { vision, OllamaError } from "./ollama-client"

const OCR_PROMPT = `Extract receipt data from this image. Return JSON:
{
  "vendor": "business name",
  "vendorOib": "OIB if visible",
  "date": "YYYY-MM-DD",
  "items": [{"description": "", "quantity": 1, "unitPrice": 0, "total": 0, "vatRate": 25}],
  "subtotal": 0,
  "vatAmount": 0,
  "total": 0,
  "paymentMethod": "cash|card|transfer",
  "currency": "EUR",
  "confidence": 0.0-1.0
}
Croatian: PDV=VAT, Ukupno=Total, Gotovina=Cash, Kartica=Card`

export async function extractFromImage(
  imageBase64: string,
  companyId?: string
): Promise<ExtractionResult<ExtractedReceipt>> {
  const model = process.env.OLLAMA_VISION_MODEL || "llava"
  const startTime = Date.now()

  try {
    const content = await vision(imageBase64, OCR_PROMPT, {
      jsonMode: true,
      operation: "ocr_receipt",
      companyId,
    })
    const durationMs = Date.now() - startTime

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          durationMs,
          provider: "ollama",
        })
      }
      return { success: false, error: "No JSON in response", rawText: content }
    }

    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          durationMs,
          provider: "ollama",
        })
      }
      return {
        success: false,
        error: "Invalid JSON format in response",
        rawText: content,
      }
    }

    // Validate against schema
    const validationResult = extractedReceiptSchema.safeParse(parsedData)
    if (!validationResult.success) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          durationMs,
          provider: "ollama",
        })
      }
      return {
        success: false,
        error: `Invalid extraction format: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        rawText: content,
      }
    }

    const data = validationResult.data

    return { success: true, data }
  } catch (error) {
    const durationMs = Date.now() - startTime
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        durationMs,
        provider: "ollama",
      })
    }

    // Provide user-friendly error message
    const errorMessage =
      error instanceof OllamaError
        ? "AI features temporarily unavailable. Please enter receipt details manually."
        : error instanceof Error
          ? error.message
          : "OCR failed"

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function extractFromImageUrl(
  imageUrl: string,
  companyId?: string
): Promise<ExtractionResult<ExtractedReceipt>> {
  const model = process.env.OLLAMA_VISION_MODEL || "llava"
  const startTime = Date.now()

  try {
    // Fetch the image and convert to base64
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64")

    // Use the base64 version
    return extractFromImage(imageBase64, companyId)
  } catch (error) {
    const durationMs = Date.now() - startTime
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        durationMs,
        provider: "ollama",
      })
    }

    // Provide user-friendly error message
    const errorMessage =
      error instanceof OllamaError
        ? "AI features temporarily unavailable. Please enter receipt details manually."
        : error instanceof Error
          ? error.message
          : "OCR failed"

    return {
      success: false,
      error: errorMessage,
    }
  }
}
