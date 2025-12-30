import { formatAmount, formatDateTime } from "@/lib/fiscal/utils"

export interface JoppdLineField {
  name: string
  value: string
}

export interface JoppdLineInput {
  lineNumber: number
  payoutLineId: string
  recipientName?: string | null
  recipientOib?: string | null
  grossAmount?: number | null
  netAmount?: number | null
  taxAmount?: number | null
  originalLineId?: string | null
  lineData?: unknown
}

export interface JoppdFormData {
  submissionId: string
  companyOib: string
  companyName: string
  periodYear: number
  periodMonth: number
  payoutId: string
  payoutDate: Date
  createdAt: Date
  correctionOfSubmissionId?: string | null
  lines: JoppdLineInput[]
}

export function generateJoppdXml(data: JoppdFormData): string {
  const createdAt = formatDateTime(data.createdAt)
  const payoutDate = data.payoutDate.toISOString().slice(0, 10)

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<JOPPD Id="JOPPD">\n'
  xml += "  <Header>\n"
  xml += `    <SubmissionId>${escapeXml(data.submissionId)}</SubmissionId>\n`
  xml += `    <CompanyOib>${escapeXml(data.companyOib)}</CompanyOib>\n`
  xml += `    <CompanyName>${escapeXml(data.companyName)}</CompanyName>\n`
  xml += `    <Period year=\"${data.periodYear}\" month=\"${String(data.periodMonth).padStart(2, "0")}\" />\n`
  xml += `    <PayoutId>${escapeXml(data.payoutId)}</PayoutId>\n`
  xml += `    <PayoutDate>${escapeXml(payoutDate)}</PayoutDate>\n`
  xml += `    <CreatedAt>${escapeXml(createdAt)}</CreatedAt>\n`
  if (data.correctionOfSubmissionId) {
    xml += `    <CorrectionOfSubmissionId>${escapeXml(data.correctionOfSubmissionId)}</CorrectionOfSubmissionId>\n`
  }
  xml += "  </Header>\n"
  xml += "  <Lines>\n"

  for (const line of data.lines) {
    xml += `    <Line number=\"${line.lineNumber}\" payoutLineId=\"${escapeXml(line.payoutLineId)}\">\n`
    if (line.recipientOib) {
      xml += `      <RecipientOib>${escapeXml(line.recipientOib)}</RecipientOib>\n`
    }
    if (line.recipientName) {
      xml += `      <RecipientName>${escapeXml(line.recipientName)}</RecipientName>\n`
    }
    if (line.grossAmount !== null && line.grossAmount !== undefined) {
      xml += `      <GrossAmount>${formatAmount(line.grossAmount)}</GrossAmount>\n`
    }
    if (line.netAmount !== null && line.netAmount !== undefined) {
      xml += `      <NetAmount>${formatAmount(line.netAmount)}</NetAmount>\n`
    }
    if (line.taxAmount !== null && line.taxAmount !== undefined) {
      xml += `      <TaxAmount>${formatAmount(line.taxAmount)}</TaxAmount>\n`
    }
    if (line.originalLineId) {
      xml += `      <OriginalLineId>${escapeXml(line.originalLineId)}</OriginalLineId>\n`
    }

    const fields = normalizeLineFields(line.lineData)
    if (fields.length > 0) {
      xml += "      <Fields>\n"
      for (const field of fields) {
        xml += `        <Field name=\"${escapeXml(field.name)}\">${escapeXml(field.value)}</Field>\n`
      }
      xml += "      </Fields>\n"
    }

    xml += "    </Line>\n"
  }

  xml += "  </Lines>\n"
  xml += "</JOPPD>\n"

  return xml
}

function normalizeLineFields(lineData: unknown): JoppdLineField[] {
  if (!lineData) {
    return []
  }

  if (Array.isArray(lineData)) {
    return lineData
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const { name, value } = entry as { name?: string; value?: unknown }
        if (!name) {
          return null
        }
        return {
          name,
          value: formatFieldValue(value),
        }
      })
      .filter((field): field is JoppdLineField => Boolean(field))
  }

  if (typeof lineData === "object") {
    return Object.entries(lineData as Record<string, unknown>)
      .map(([name, value]) => ({
        name,
        value: formatFieldValue(value),
      }))
      .filter((field) => field.name.length > 0)
  }

  return [{ name: "value", value: formatFieldValue(lineData) }]
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number") {
    return formatAmount(value)
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  return String(value)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
