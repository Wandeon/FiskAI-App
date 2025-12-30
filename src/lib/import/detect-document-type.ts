import { DocumentType } from "@prisma/client"

export interface DetectionResult {
  type: DocumentType
  confidence: number // 0-1
  reason: string
}

const BANK_KEYWORDS = [
  "izvod",
  "stanje",
  "promet",
  "saldo",
  "iban",
  "swift",
  "bic",
  "transakcij",
  "uplat",
  "isplat",
  "banka",
  "račun",
]

const INVOICE_KEYWORDS = [
  "račun",
  "faktura",
  "invoice",
  "pdv",
  "vat",
  "oib",
  "iznos",
  "ukupno",
  "total",
  "dobavljač",
  "kupac",
  "dospijeće",
]

export function detectDocumentType(
  fileName: string,
  mimeType: string,
  textContent?: string
): DetectionResult {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const nameLower = fileName.toLowerCase()

  if (nameLower.includes("primka")) {
    return {
      type: DocumentType.PRIMKA,
      confidence: 0.9,
      reason: "Filename contains 'primka'",
    }
  }

  if (nameLower.includes("izdatnica")) {
    return {
      type: DocumentType.IZDATNICA,
      confidence: 0.9,
      reason: "Filename contains 'izdatnica'",
    }
  }

  // XML files are almost always bank statements (CAMT.053)
  if (ext === "xml") {
    return {
      type: DocumentType.BANK_STATEMENT,
      confidence: 0.95,
      reason: "XML format typically used for CAMT.053 bank statements",
    }
  }

  // CSV files are typically bank exports
  if (ext === "csv") {
    return {
      type: DocumentType.BANK_STATEMENT,
      confidence: 0.85,
      reason: "CSV format typically used for bank transaction exports",
    }
  }

  // Image files are typically invoices/receipts
  if (["jpg", "jpeg", "png", "heic", "webp"].includes(ext)) {
    return {
      type: DocumentType.INVOICE,
      confidence: 0.8,
      reason: "Image format typically used for scanned invoices",
    }
  }

  // For PDFs, check filename and content
  if (ext === "pdf") {
    // Check for common Croatian bank statement patterns
    // FSTM = Fina bank statements, commonly used format
    if (/^fstm\d+/i.test(nameLower) || /izvod.*\d{4}/i.test(nameLower)) {
      return {
        type: DocumentType.BANK_STATEMENT,
        confidence: 0.95,
        reason: "Filename matches bank statement format (FSTM/Fina)",
      }
    }

    // Common bank statement filename patterns
    if (
      nameLower.includes("izvod") ||
      nameLower.includes("statement") ||
      nameLower.includes("promet") ||
      /bank.*\d{6,}/.test(nameLower) ||
      /\d{4}-\d{2}.*banka/.test(nameLower)
    ) {
      return {
        type: DocumentType.BANK_STATEMENT,
        confidence: 0.9,
        reason: "Filename suggests bank statement",
      }
    }

    // Invoice patterns
    if (
      nameLower.includes("racun") ||
      nameLower.includes("faktura") ||
      nameLower.includes("invoice")
    ) {
      return {
        type: DocumentType.INVOICE,
        confidence: 0.9,
        reason: "Filename suggests invoice",
      }
    }

    // Check text content if available
    if (textContent) {
      const textLower = textContent.toLowerCase()
      const bankScore = BANK_KEYWORDS.filter((k) => textLower.includes(k)).length
      const invoiceScore = INVOICE_KEYWORDS.filter((k) => textLower.includes(k)).length

      if (bankScore > invoiceScore && bankScore >= 3) {
        return {
          type: DocumentType.BANK_STATEMENT,
          confidence: Math.min(0.5 + bankScore * 0.1, 0.9),
          reason: `Found ${bankScore} bank-related keywords`,
        }
      }
      if (invoiceScore > bankScore && invoiceScore >= 2) {
        return {
          type: DocumentType.INVOICE,
          confidence: Math.min(0.5 + invoiceScore * 0.1, 0.9),
          reason: `Found ${invoiceScore} invoice-related keywords`,
        }
      }
    }

    // Default PDF to invoice (more common use case)
    return {
      type: DocumentType.INVOICE,
      confidence: 0.5,
      reason: "PDF defaulting to invoice - please verify",
    }
  }

  // Fallback
  return {
    type: DocumentType.INVOICE,
    confidence: 0.3,
    reason: "Unknown format - defaulting to invoice",
  }
}

export function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    xml: "application/xml",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
  }
  return mimeMap[ext] || "application/octet-stream"
}

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "text/csv": [".csv"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/webp": [".webp"],
}

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".xml",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".webp",
]
