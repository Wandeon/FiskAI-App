import { ExtractedReceipt, ExtractedInvoice, ExtractionResult } from "./types"
import { trackAIUsage } from "./usage-tracking"
import { extractedReceiptSchema, extractedInvoiceSchema } from "./schemas"
import { chat, OllamaError } from "./ollama-client"

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
  const model = process.env.OLLAMA_MODEL || "llama3.2"
  const startTime = Date.now()

  try {
    const content = await chat(text, {
      systemPrompt: RECEIPT_PROMPT,
      jsonMode: true,
      operation: "extract_receipt",
      companyId,
    })
    const durationMs = Date.now() - startTime

    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(content)
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_receipt",
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
        rawText: text,
      }
    }

    const data = validationResult.data

    return { success: true, data, rawText: text }
  } catch (error) {
    const durationMs = Date.now() - startTime
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_receipt",
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
  const model = process.env.OLLAMA_MODEL || "llama3.2"
  const startTime = Date.now()

  try {
    const content = await chat(text, {
      systemPrompt: INVOICE_PROMPT,
      jsonMode: true,
      operation: "extract_invoice",
      companyId,
    })
    const durationMs = Date.now() - startTime

    // Parse and validate JSON response
    let parsedData: unknown
    try {
      parsedData = JSON.parse(content)
    } catch (parseError) {
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation: "extract_invoice",
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
        rawText: text,
      }
    }

    const data = validationResult.data

    return { success: true, data, rawText: text }
  } catch (error) {
    const durationMs = Date.now() - startTime
    // Track failed usage
    if (companyId) {
      await trackAIUsage({
        companyId,
        operation: "extract_invoice",
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
