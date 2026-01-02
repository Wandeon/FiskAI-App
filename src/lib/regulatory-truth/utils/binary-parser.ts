// src/lib/regulatory-truth/utils/binary-parser.ts
// Parses binary files (PDF, DOCX, DOC, XLSX) to extract text content

import pdf from "pdf-parse"
import mammoth from "mammoth"
import ExcelJS from "exceljs"
import WordExtractor from "word-extractor"

// word-extractor instance for old DOC files
const wordExtractor = new WordExtractor()

export type BinaryContentType = "pdf" | "docx" | "doc" | "xlsx" | "xls" | "unknown"

/**
 * Detect content type from URL or content-type header
 */
export function detectBinaryType(url: string, contentType?: string): BinaryContentType {
  const lowerUrl = url.toLowerCase()

  // Check URL extension first
  if (lowerUrl.endsWith(".pdf")) return "pdf"
  if (lowerUrl.endsWith(".docx")) return "docx"
  if (lowerUrl.endsWith(".doc")) return "doc"
  if (lowerUrl.endsWith(".xlsx")) return "xlsx"
  if (lowerUrl.endsWith(".xls")) return "xls"

  // Check content-type header
  if (contentType) {
    const lowerCt = contentType.toLowerCase()
    if (lowerCt.includes("application/pdf")) return "pdf"
    if (lowerCt.includes("application/vnd.openxmlformats-officedocument.wordprocessingml"))
      return "docx"
    if (lowerCt.includes("application/msword")) return "doc"
    if (lowerCt.includes("application/vnd.openxmlformats-officedocument.spreadsheetml"))
      return "xlsx"
    if (lowerCt.includes("application/vnd.ms-excel")) return "xls"
  }

  return "unknown"
}

/**
 * Check if URL points to a binary file
 */
export function isBinaryUrl(url: string): boolean {
  const type = detectBinaryType(url)
  return type !== "unknown"
}

/**
 * Parse binary content and extract text
 */
export async function parseBinaryContent(
  buffer: Buffer,
  type: BinaryContentType
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  switch (type) {
    case "pdf":
      return parsePdf(buffer)
    case "docx":
      return parseDocx(buffer)
    case "doc":
      // Old DOC format - use word-extractor
      return parseDoc(buffer)
    case "xlsx":
    case "xls":
      return parseExcel(buffer)
    default:
      return { text: "", metadata: { skipped: true, reason: "Unknown binary type" } }
  }
}

/**
 * Sanitize text for PostgreSQL - remove null bytes and invalid UTF-8 sequences
 */
function sanitizeText(text: string): string {
  if (!text) return ""
  // Remove null bytes (0x00) which PostgreSQL TEXT columns reject
  // Also remove other control characters except newline, tab, carriage return
  return text
    .replace(/\x00/g, "") // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except \t\n\r
    .trim()
}

/**
 * Parse PDF and extract text
 */
async function parsePdf(
  buffer: Buffer
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  try {
    const data = await pdf(buffer)
    const sanitized = sanitizeText(data.text)
    return {
      text: sanitized,
      metadata: {
        pages: data.numpages,
        info: data.info,
        originalLength: data.text?.length || 0,
        sanitizedLength: sanitized.length,
      },
    }
  } catch (error) {
    console.error("[binary-parser] PDF parse error:", error)
    return { text: "", metadata: { error: String(error) } }
  }
}

/**
 * Parse DOCX and extract text (Office Open XML format)
 */
async function parseDocx(
  buffer: Buffer
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const sanitized = sanitizeText(result.value)
    return {
      text: sanitized,
      metadata: {
        format: "docx",
        messages: result.messages,
        originalLength: result.value?.length || 0,
        sanitizedLength: sanitized.length,
      },
    }
  } catch (error) {
    console.error("[binary-parser] DOCX parse error:", error)
    return { text: "", metadata: { error: String(error) } }
  }
}

/**
 * Parse old DOC format (Microsoft Word 97-2003)
 */
async function parseDoc(
  buffer: Buffer
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  try {
    const doc = await wordExtractor.extract(buffer)

    // Get all text parts
    const body = doc.getBody() || ""
    const headers = doc.getHeaders() || ""
    const footers = doc.getFooters() || ""
    const footnotes = (doc as unknown as Record<string, (() => string) | undefined>).getFootnotes?.() || ""
    const endnotes = (doc as unknown as Record<string, (() => string) | undefined>).getEndnotes?.() || ""

    // Combine all text parts
    const allText = [body, headers, footers, footnotes, endnotes].filter(Boolean).join("\n\n")

    const sanitized = sanitizeText(allText)

    return {
      text: sanitized,
      metadata: {
        format: "doc",
        bodyLength: body.length,
        hasHeaders: headers.length > 0,
        hasFooters: footers.length > 0,
        hasFootnotes: footnotes.length > 0,
        hasEndnotes: endnotes.length > 0,
        originalLength: allText.length,
        sanitizedLength: sanitized.length,
      },
    }
  } catch (error) {
    console.error("[binary-parser] DOC parse error:", error)

    // Fallback: try mammoth in case it's actually a DOCX with wrong extension
    try {
      console.log("[binary-parser] Trying mammoth fallback for DOC file...")
      const result = await mammoth.extractRawText({ buffer })
      if (result.value && result.value.trim().length > 0) {
        const sanitized = sanitizeText(result.value)
        return {
          text: sanitized,
          metadata: {
            format: "doc-via-mammoth-fallback",
            originalLength: result.value.length,
            sanitizedLength: sanitized.length,
          },
        }
      }
    } catch {
      // Mammoth fallback also failed
    }

    return { text: "", metadata: { error: String(error) } }
  }
}

/**
 * Parse Excel (XLS/XLSX) and extract text
 */
async function parseExcel(
  buffer: Buffer
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  try {
    const workbook = new ExcelJS.Workbook()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any)

    const sheets: string[] = []
    const sheetNames: string[] = []

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name
      sheetNames.push(sheetName)

      // Convert to readable text
      const lines: string[] = [`=== Sheet: ${sheetName} ===`]
      worksheet.eachRow((row) => {
        const cells: string[] = []
        row.eachCell((cell) => {
          const value = cell.text || String(cell.value || "")
          if (value.trim()) {
            cells.push(value)
          }
        })
        if (cells.length > 0) {
          lines.push(cells.join(" | "))
        }
      })
      sheets.push(lines.join("\n"))
    })

    const rawText = sheets.join("\n\n")
    const sanitized = sanitizeText(rawText)

    return {
      text: sanitized,
      metadata: {
        sheetNames,
        sheetCount: sheetNames.length,
        originalLength: rawText.length,
        sanitizedLength: sanitized.length,
      },
    }
  } catch (error) {
    console.error("[binary-parser] Excel parse error:", error)
    return { text: "", metadata: { error: String(error) } }
  }
}

/**
 * Fetch and parse a binary URL
 */
export async function fetchAndParseBinary(
  url: string,
  fetchFn: (url: string) => Promise<Response>
): Promise<{
  success: boolean
  text: string
  contentType: BinaryContentType
  metadata?: Record<string, unknown>
  error?: string
}> {
  try {
    const response = await fetchFn(url)
    if (!response.ok) {
      return {
        success: false,
        text: "",
        contentType: "unknown",
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const contentTypeHeader = response.headers.get("content-type") || ""
    const type = detectBinaryType(url, contentTypeHeader)

    if (type === "unknown") {
      return {
        success: false,
        text: "",
        contentType: "unknown",
        error: "Not a recognized binary format",
      }
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { text, metadata } = await parseBinaryContent(buffer, type)

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        text: "",
        contentType: type,
        metadata,
        error: "No text extracted from binary file",
      }
    }

    return {
      success: true,
      text,
      contentType: type,
      metadata,
    }
  } catch (error) {
    return {
      success: false,
      text: "",
      contentType: "unknown",
      error: String(error),
    }
  }
}
