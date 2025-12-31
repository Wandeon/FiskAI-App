export interface ParsedTransaction {
  date: Date
  reference: string
  amount: number
  description: string
  type: "debit" | "credit"
  currency?: string
  counterpartyName?: string
  counterpartyIban?: string
}

export type SupportedBank =
  | "erste"
  | "raiffeisenbank"
  | "moja-banka"
  | "splitska"
  | "otp"
  | "generic"

export interface CsvParserOptions {
  skipHeaderRows?: number
  dateFormat?: "DD.MM.YYYY" | "YYYY-MM-DD" | "auto"
  decimalSeparator?: "," | "."
  currencySymbol?: string
}

export function parseCSV(
  content: string,
  bankName: SupportedBank,
  options: CsvParserOptions = {}
): ParsedTransaction[] {
  const lines = content.trim().split("\n")
  const skipRows = options.skipHeaderRows ?? 1
  const dataLines = lines.slice(skipRows)

  return dataLines
    .filter((line) => line.trim().length > 0)
    .map((line) => parseRow(line, bankName, options))
    .filter(Boolean) as ParsedTransaction[]
}

function parseRow(line: string, bankName: SupportedBank, options: CsvParserOptions) {
  try {
    switch (bankName) {
      case "erste":
        return parseErste(line, options)
      case "raiffeisenbank":
        return parseRaiffeisenbank(line, options)
      default:
        return parseGeneric(line, options)
    }
  } catch (error) {
    console.warn(`Failed to parse row: ${line}`, error)
    return null
  }
}

function parseErste(line: string, options: CsvParserOptions): ParsedTransaction | null {
  const parts = splitCsv(line)
  if (parts.length < 4) return null

  const [dateStr, description, debitStr, creditStr, currencyStr] = parts
  const date = parseDate(dateStr, options.dateFormat)
  if (!date) return null

  const decimal = options.decimalSeparator || detectDecimalSeparator(debitStr || creditStr)
  const rawAmount = debitStr || creditStr
  const amount = parseAmount(rawAmount, decimal)
  if (amount === null) return null

  const reference = extractInvoiceNumber(description) || description.slice(0, 32)
  return {
    date,
    reference,
    amount: Math.abs(amount),
    description,
    type: debitStr ? "debit" : "credit",
    currency: currencyStr || "EUR",
  }
}

function parseRaiffeisenbank(line: string, options: CsvParserOptions): ParsedTransaction | null {
  const parts = splitCsv(line, ";")
  if (parts.length < 4) return null

  const [dateStr, description, debitStr, creditStr, currencyStr] = parts
  const date = parseDate(dateStr, options.dateFormat)
  if (!date) return null

  const decimal = options.decimalSeparator || detectDecimalSeparator(debitStr || creditStr)
  const rawAmount = debitStr || creditStr
  const amount = parseAmount(rawAmount, decimal)
  if (amount === null) return null

  const reference = extractInvoiceNumber(description) || description.slice(0, 32)
  return {
    date,
    reference,
    amount: Math.abs(amount),
    description,
    type: debitStr ? "debit" : "credit",
    currency: currencyStr || "EUR",
  }
}

function parseGeneric(line: string, options: CsvParserOptions): ParsedTransaction | null {
  const parts = splitCsv(line)
  if (parts.length < 3) return null

  const [dateStr, referenceOrDesc, amountStr, description] = parts
  const date = parseDate(dateStr, options.dateFormat)
  if (!date) return null

  const decimal = options.decimalSeparator || detectDecimalSeparator(amountStr)
  const amount = parseAmount(amountStr, decimal)
  if (amount === null) return null

  const reference = extractInvoiceNumber(referenceOrDesc || description || "")
  return {
    date,
    reference: reference || (referenceOrDesc || "").slice(0, 32),
    amount: Math.abs(amount),
    description: description || referenceOrDesc,
    type: amount < 0 ? "credit" : "debit",
    currency: "EUR",
  }
}

function splitCsv(line: string, delimiter = ",") {
  return line.split(delimiter).map((p) => p.trim())
}

function parseDate(dateStr: string, format?: string): Date | null {
  const formats = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ]

  for (const regex of formats) {
    const match = dateStr.match(regex)
    if (match) {
      let day: number, month: number, year: number
      if (match[1].length === 4) {
        year = parseInt(match[1])
        month = parseInt(match[2])
        day = parseInt(match[3])
      } else {
        day = parseInt(match[1])
        month = parseInt(match[2])
        year = parseInt(match[3])
      }
      const date = new Date(year, month - 1, day)
      if (!Number.isNaN(date.getTime())) return date
    }
  }
  return null
}

function parseAmount(amountStr: string, decimalSeparator: "," | "."): number | null {
  if (!amountStr) return null
  let cleaned = amountStr.replace(/[^\d,\.\-]/g, "").trim()
  if (decimalSeparator === ",") {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    cleaned = cleaned.replace(/,/g, "")
  }
  const amount = parseFloat(cleaned)
  return Number.isFinite(amount) ? amount : null
}

function detectDecimalSeparator(sample: string): "," | "." {
  if (!sample) return "."
  if (sample.includes(",") && !sample.includes(".")) return ","
  if (sample.includes(",") && sample.includes(".")) {
    return sample.lastIndexOf(",") > sample.lastIndexOf(".") ? "," : "."
  }
  return "."
}

function extractInvoiceNumber(text: string): string {
  const patterns = [
    /(?:invoice|racun|račun|inv)[\s#]*[:\-]*\s*([0-9\-\/]+)/i,
    /([0-9]{4}[\-\/][0-9]+)/,
    /\#([0-9]+)/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) return match[1].trim()
  }
  return ""
}
