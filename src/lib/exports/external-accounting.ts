export type ExportTargetSystem = "SYNESIS" | "PANTHEON" | "MINIMAX"

export type ExportValidationIssue = {
  code: "MISSING_MAPPING"
  message: string
  accountId: string
  accountCode: string
  accountName: string
}

export type ExportValidationReport = {
  ok: boolean
  issues: ExportValidationIssue[]
  missingMappings: Array<{
    accountId: string
    accountCode: string
    accountName: string
  }>
}

export type ExportLine = {
  entryDate: Date
  entryNumber: number
  lineNumber: number
  description: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export type AccountMappingLookup = {
  accountId: string
  externalAccountCode: string
  externalAccountName?: string | null
}

const EXPORT_FORMATS: Record<
  ExportTargetSystem,
  {
    filenamePrefix: string
    headers: string[]
    row: (line: ExportLine, mapping: AccountMappingLookup) => Array<string | number>
  }
> = {
  SYNESIS: {
    filenamePrefix: "synesis",
    headers: ["Datum", "Dokument", "Opis", "Konto", "Duguje", "Potražuje"],
    row: (line, mapping) => [
      formatDate(line.entryDate),
      line.entryNumber,
      line.description,
      mapping.externalAccountCode,
      formatAmount(line.debit),
      formatAmount(line.credit),
    ],
  },
  PANTHEON: {
    filenamePrefix: "pantheon",
    headers: ["Datum", "Dokument", "Konto", "Opis", "Duguje", "Potražuje"],
    row: (line, mapping) => [
      formatDate(line.entryDate),
      line.entryNumber,
      mapping.externalAccountCode,
      line.description,
      formatAmount(line.debit),
      formatAmount(line.credit),
    ],
  },
  MINIMAX: {
    filenamePrefix: "minimax",
    headers: ["Datum", "Konto", "Opis", "Dokument", "Duguje", "Potražuje"],
    row: (line, mapping) => [
      formatDate(line.entryDate),
      mapping.externalAccountCode,
      line.description,
      line.entryNumber,
      formatAmount(line.debit),
      formatAmount(line.credit),
    ],
  },
}

export function buildExportValidationReport(
  missingMappings: ExportValidationReport["missingMappings"]
): ExportValidationReport {
  if (missingMappings.length === 0) {
    return { ok: true, issues: [], missingMappings: [] }
  }

  const issues: ExportValidationIssue[] = missingMappings.map((mapping) => ({
    code: "MISSING_MAPPING",
    message: `Missing export mapping for account ${mapping.accountCode} (${mapping.accountName})`,
    accountId: mapping.accountId,
    accountCode: mapping.accountCode,
    accountName: mapping.accountName,
  }))

  return {
    ok: false,
    issues,
    missingMappings,
  }
}

export function buildExternalAccountingCsv(
  system: ExportTargetSystem,
  lines: ExportLine[],
  mappingByAccountId: Map<string, AccountMappingLookup>
): string {
  const format = EXPORT_FORMATS[system]
  const rows = lines.map((line) => {
    const mapping = mappingByAccountId.get(line.accountId)
    if (!mapping) {
      return []
    }
    return format.row(line, mapping).map((value) => escapeCsv(String(value)))
  })

  const csvRows = [format.headers.map(escapeCsv).join(";")]
  rows.forEach((row) => {
    if (row.length > 0) {
      csvRows.push(row.join(";"))
    }
  })

  return csvRows.join("\n")
}

export function getExportFilenamePrefix(system: ExportTargetSystem): string {
  return EXPORT_FORMATS[system].filenamePrefix
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatAmount(value: number): string {
  return value.toFixed(2)
}

function escapeCsv(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
