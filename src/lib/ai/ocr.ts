import OpenAI from "openai"
import { ExtractionResult, ExtractedReceipt } from "./types"
import { trackAIUsage } from "./usage-tracking"
import { extractedReceiptSchema } from "./schemas"

// Lazy-load OpenAI client to avoid build errors when API key is not set
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured")
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function extractFromImage(
  imageBase64: string,
  companyId?: string
): Promise<ExtractionResult<ExtractedReceipt>> {
  const model = "gpt-4o"
  let success = false
  let inputTokens = 0
  let outputTokens = 0

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract receipt data from this image. Return JSON:
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
Croatian: PDV=VAT, Ukupno=Total, Gotovina=Cash, Kartica=Card`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    // Track token usage
    inputTokens = response.usage?.prompt_tokens || 0
    outputTokens = response.usage?.completion_tokens || 0

    const content = response.choices[0]?.message?.content || ""
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return { success: false, error: "No JSON in response", rawText: content }
    }    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
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
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: `Invalid extraction format: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        rawText: content,
      }
    }

    const data = validationResult.data
    success = true

    // Track successful usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens,
        outputTokens,
        success: true,
      })
    }

    return { success: true, data }
  } catch (error) {
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens,
        outputTokens,
        success: false,
      })
    }

    // Provide user-friendly error message for missing API key
    const errorMessage =
      error instanceof Error && error.message === "OpenAI API key not configured"
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
  const model = "gpt-4o"
  let inputTokens = 0
  let outputTokens = 0

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract receipt data from this image. Return JSON:
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
Croatian: PDV=VAT, Ukupno=Total, Gotovina=Cash, Kartica=Card`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    // Track token usage
    inputTokens = response.usage?.prompt_tokens || 0
    outputTokens = response.usage?.completion_tokens || 0

    const content = response.choices[0]?.message?.content || ""
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return { success: false, error: "No JSON in response", rawText: content }
    }    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "ocr_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
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
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: `Invalid extraction format: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        rawText: content,
      }
    }

    const data = validationResult.data

    // Track successful usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens,
        outputTokens,
        success: true,
      })
    }

    return { success: true, data }
  } catch (error) {
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "ocr_receipt",
        model,
        inputTokens,
        outputTokens,
        success: false,
      })
    }

    // Provide user-friendly error message for missing API key
    const errorMessage =
      error instanceof Error && error.message === "OpenAI API key not configured"
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
