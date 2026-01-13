// src/lib/premises/premises-utils.ts
// Utility functions for premises management (no server actions)

export interface BulkImportRow {
  code: number
  name: string
  address?: string
  isDefault?: boolean
}

/**
 * Parse CSV content for premises import
 * Expected columns: code, name, address (optional), isDefault (optional)
 */
export function parsePremisesCsv(csvContent: string): {
  rows: BulkImportRow[]
  errors: string[]
} {
  const lines = csvContent.trim().split("\n")
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV datoteka je prazna ili nema podataka"] }
  }

  // Parse header - support both Croatian and English column names
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))
  const codeIndex = header.findIndex((h) => h === "kod" || h === "code")
  const nameIndex = header.findIndex((h) => h === "naziv" || h === "name")
  const addressIndex = header.findIndex((h) => h === "adresa" || h === "address")
  const defaultIndex = header.findIndex(
    (h) => h === "zadani" || h === "isdefault" || h === "default"
  )

  if (codeIndex === -1) {
    return { rows: [], errors: ["CSV mora sadrzavati stupac 'kod' ili 'code'"] }
  }
  if (nameIndex === -1) {
    return { rows: [], errors: ["CSV mora sadrzavati stupac 'naziv' ili 'name'"] }
  }

  const rows: BulkImportRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV parsing - handle quoted values
    const values = parseCSVLine(line)

    const codeStr = values[codeIndex]?.trim()
    const code = parseInt(codeStr, 10)

    if (isNaN(code) || code < 1) {
      errors.push(`Red ${i + 1}: Neispravan kod '${codeStr}' - mora biti pozitivan broj`)
      continue
    }

    const name = values[nameIndex]?.trim().replace(/"/g, "")
    if (!name) {
      errors.push(`Red ${i + 1}: Naziv je obavezan`)
      continue
    }

    rows.push({
      code,
      name,
      address:
        addressIndex !== -1
          ? values[addressIndex]?.trim().replace(/"/g, "") || undefined
          : undefined,
      isDefault:
        defaultIndex !== -1
          ? ["da", "yes", "true", "1"].includes(values[defaultIndex]?.toLowerCase().trim() ?? "")
          : false,
    })
  }

  return { rows, errors }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Generate CSV template for premises import
 */
export function generatePremisesTemplate(): string {
  return `kod,naziv,adresa,zadani
1,Glavni ured,"Ilica 123, Zagreb",da
2,Poslovnica Centar,"Trg bana Jelacica 1, Zagreb",ne
3,Poslovnica Split,"Riva 5, Split",ne`
}
