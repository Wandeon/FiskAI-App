import OpenAI from "openai"
import { ExtractedReceipt, ExtractedInvoice, ExtractionResult } from "./types"
import { trackAIUsage } from "./usage-tracking"
import { extractedReceiptSchema, extractedInvoiceSchema } from "./schemas"

// Lazy-load OpenAI client to avoid build errors when API key is not set
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured")
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

const RECEIPT_PROMPT = `Extract the following information from this receipt text. Return JSON only.
{
  "vendor": "business name",
  "vendorOib": "11 digit OIB if visible",
  "date": "YYYY-MM-DD",
  "items": [{ "description": "", "quantity": 1, "unitPrice": 0.00, "total": 0.00, "vatRate": 25 }],
  "subtotal": 0.00,
  "vatAmount": 0.00,
  "total": 0.00,
  "paymentMethod": "cash|card|transfer",
  "currency": "EUR",
  "confidence": 0.0-1.0
}

Croatian context: PDV=VAT, Ukupno=Total, Gotovina=Cash, Kartica=Card
`

const INVOICE_PROMPT = `Extract the following information from this invoice text. Return JSON only.
{
  "invoiceNumber": "invoice number",
  "vendor": "business name",
  "vendorOib": "11 digit OIB if visible",
  "date": "YYYY-MM-DD",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "buyerName": "buyer name if visible",
  "buyerOib": "buyer OIB if visible",
  "items": [{ "description": "", "quantity": 1, "unitPrice": 0.00, "total": 0.00, "vatRate": 25 }],
  "subtotal": 0.00,
  "vatAmount": 0.00,
  "total": 0.00,
  "paymentMethod": "cash|card|transfer",
  "currency": "EUR",
  "confidence": 0.0-1.0
}

Croatian context: PDV=VAT, Ukupno=Total, Račun br.=Invoice no., Datum dospijeća=Due date
`

export async function extractReceipt(
  text: string,
  companyId?: string
): Promise<ExtractionResult<ExtractedReceipt>> {
  const model = "gpt-4o-mini"
  let inputTokens = 0
  let outputTokens = 0

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: RECEIPT_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    })

    // Track token usage
    inputTokens = response.usage?.prompt_tokens || 0
    outputTokens = response.usage?.completion_tokens || 0

    const content = response.choices[0]?.message?.content
    if (!content) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return { success: false, error: "No response from AI" }
    }    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(content)
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: "Invalid JSON format in response",
        rawText: text,
      }
    }

    // Validate against schema
    const validationResult = extractedReceiptSchema.safeParse(parsedData)
    if (!validationResult.success) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_receipt",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: `Invalid extraction format: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        rawText: text,
      }
    }

    const data = validationResult.data

    // Track successful usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_receipt",
        model,
        inputTokens,
        outputTokens,
        success: true,
      })
    }

    return { success: true, data, rawText: text }
  } catch (error) {
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_receipt",
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
          : "Extraction failed"

    return {
      success: false,
      error: errorMessage,
      rawText: text,
    }
  }
}

export async function extractInvoice(
  text: string,
  companyId?: string
): Promise<ExtractionResult<ExtractedInvoice>> {
  const model = "gpt-4o-mini"
  let inputTokens = 0
  let outputTokens = 0

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: INVOICE_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    })

    // Track token usage
    inputTokens = response.usage?.prompt_tokens || 0
    outputTokens = response.usage?.completion_tokens || 0

    const content = response.choices[0]?.message?.content
    if (!content) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_invoice",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return { success: false, error: "No response from AI" }
    }    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(content)
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_invoice",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: "Invalid JSON format in response",
        rawText: text,
      }
    }

    // Validate against schema
    const validationResult = extractedInvoiceSchema.safeParse(parsedData)
    if (!validationResult.success) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_invoice",
          model,
          inputTokens,
          outputTokens,
          success: false,
        })
      }
      return {
        success: false,
        error: `Invalid extraction format: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        rawText: text,
      }
    }

    const data = validationResult.data

    // Track successful usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_invoice",
        model,
        inputTokens,
        outputTokens,
        success: true,
      })
    }

    return { success: true, data, rawText: text }
  } catch (error) {
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_invoice",
        model,
        inputTokens,
        outputTokens,
        success: false,
      })
    }

    // Provide user-friendly error message for missing API key
    const errorMessage =
      error instanceof Error && error.message === "OpenAI API key not configured"
        ? "AI features temporarily unavailable. Please enter invoice details manually."
        : error instanceof Error
          ? error.message
          : "Extraction failed"

    return {
      success: false,
      error: errorMessage,
      rawText: text,
    }
  }
}
