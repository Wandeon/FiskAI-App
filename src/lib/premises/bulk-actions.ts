"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

interface ActionResult {
  success: boolean
  error?: string
  data?: unknown
}

interface BulkImportRow {
  code: number
  name: string
  address?: string
  isDefault?: boolean
}

interface BulkImportResult {
  success: boolean
  created: number
  skipped: number
  errors: string[]
}

/**
 * Parse CSV content for premises import
 * Expected columns: code, name, address (optional), isDefault (optional)
 */
export async function parsePremisesCsv(csvContent: string): Promise<{
  rows: BulkImportRow[]
  errors: string[]
}> {
  const lines = csvContent.trim().split("\n")
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV datoteka je prazna ili nema podataka"] }
  }

  // Parse header - support both Croatian and English column names
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))
  const codeIndex = header.findIndex((h) => h === "kod" || h === "code")
  const nameIndex = header.findIndex((h) => h === "naziv" || h === "name")
  const addressIndex = header.findIndex((h) => h === "adresa" || h === "address")
  const defaultIndex = header.findIndex((h) => h === "zadani" || h === "isdefault" || h === "default")

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
      address: addressIndex !== -1 ? values[addressIndex]?.trim().replace(/"/g, "") || undefined : undefined,
      isDefault: defaultIndex !== -1 ? ["da", "yes", "true", "1"].includes(values[defaultIndex]?.toLowerCase().trim() ?? "") : false,
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
 * Bulk import premises from parsed CSV data
 */
export async function bulkImportPremises(
  companyId: string,
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  let created = 0
  let skipped = 0
  const errors: string[] = []

  // Get existing premises codes
  const existing = await db.businessPremises.findMany({
    where: { companyId },
    select: { code: true },
  })
  const existingCodes = new Set(existing.map((p) => p.code))

  // Check if any row wants to be default
  const hasNewDefault = rows.some((r) => r.isDefault)

  // If we have a new default, clear existing defaults
  if (hasNewDefault) {
    await db.businessPremises.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    })
  }

  // Track if we've already set a default in this import
  let defaultSet = false

  for (const row of rows) {
    if (existingCodes.has(row.code)) {
      skipped++
      errors.push(`Kod ${row.code} vec postoji - preskoceno`)
      continue
    }

    try {
      // Only set isDefault for the first row that wants it
      const isDefault = row.isDefault && !defaultSet

      await db.businessPremises.create({
        data: {
          companyId,
          code: row.code,
          name: row.name,
          address: row.address,
          isDefault,
          isActive: true,
        },
      })
      created++
      existingCodes.add(row.code) // Prevent duplicates within same import

      if (isDefault) {
        defaultSet = true
      }
    } catch (error) {
      console.error(`Failed to create premises ${row.code}:`, error)
      errors.push(`Greska pri stvaranju poslovnog prostora ${row.code}`)
    }
  }

  revalidatePath("/settings/premises")
  return { success: errors.length === 0, created, skipped, errors }
}

/**
 * Clone a premises with all its devices
 */
export async function clonePremises(
  premisesId: string,
  newCode: number,
  newName: string
): Promise<ActionResult> {
  try {
    const source = await db.businessPremises.findUnique({
      where: { id: premisesId },
      include: { devices: true },
    })

    if (!source) {
      return { success: false, error: "Izvorni poslovni prostor nije pronaden" }
    }

    // Check if new code already exists
    const existing = await db.businessPremises.findUnique({
      where: {
        companyId_code: {
          companyId: source.companyId,
          code: newCode,
        },
      },
    })

    if (existing) {
      return { success: false, error: `Poslovni prostor s kodom ${newCode} vec postoji` }
    }

    // Create new premises
    const newPremises = await db.businessPremises.create({
      data: {
        companyId: source.companyId,
        code: newCode,
        name: newName,
        address: source.address,
        isDefault: false,
        isActive: true,
      },
    })

    // Clone devices
    for (const device of source.devices) {
      await db.paymentDevice.create({
        data: {
          companyId: source.companyId,
          businessPremisesId: newPremises.id,
          code: device.code,
          name: device.name,
          isDefault: device.isDefault,
          isActive: true,
        },
      })
    }

    revalidatePath("/settings/premises")
    return {
      success: true,
      data: {
        premises: newPremises,
        devicesCloned: source.devices.length,
      },
    }
  } catch (error) {
    console.error("Failed to clone premises:", error)
    return { success: false, error: "Greska pri kloniranju poslovnog prostora" }
  }
}

/**
 * Bulk activate/deactivate premises
 */
export async function bulkTogglePremisesStatus(
  premisesIds: string[],
  isActive: boolean
): Promise<ActionResult> {
  try {
    const result = await db.businessPremises.updateMany({
      where: { id: { in: premisesIds } },
      data: { isActive },
    })

    revalidatePath("/settings/premises")
    return {
      success: true,
      data: { updated: result.count },
    }
  } catch (error) {
    console.error("Failed to bulk toggle premises status:", error)
    return { success: false, error: "Greska pri azuriranju statusa poslovnih prostora" }
  }
}

/**
 * Bulk assign devices to premises
 * Creates multiple devices with sequential codes starting from provided startCode
 */
export async function bulkAssignDevices(
  companyId: string,
  premisesId: string,
  count: number,
  namePrefix: string,
  startCode: number = 1
): Promise<ActionResult> {
  try {
    // Get existing device codes for this premises
    const existingDevices = await db.paymentDevice.findMany({
      where: { businessPremisesId: premisesId },
      select: { code: true },
    })
    const existingCodes = new Set(existingDevices.map((d) => d.code))

    const created: number[] = []
    let currentCode = startCode

    for (let i = 0; i < count; i++) {
      // Find next available code
      while (existingCodes.has(currentCode)) {
        currentCode++
      }

      await db.paymentDevice.create({
        data: {
          companyId,
          businessPremisesId: premisesId,
          code: currentCode,
          name: `${namePrefix} ${currentCode}`,
          isDefault: existingDevices.length === 0 && i === 0, // First device is default if no devices exist
          isActive: true,
        },
      })

      created.push(currentCode)
      existingCodes.add(currentCode)
      currentCode++
    }

    revalidatePath("/settings/premises")
    return {
      success: true,
      data: { created: created.length, codes: created },
    }
  } catch (error) {
    console.error("Failed to bulk assign devices:", error)
    return { success: false, error: "Greska pri stvaranju naplatnih uredaja" }
  }
}

/**
 * Generate CSV template for premises import
 */
export async function generatePremisesTemplate(): Promise<string> {
  return `kod,naziv,adresa,zadani
1,Glavni ured,"Ilica 123, Zagreb",da
2,Poslovnica Centar,"Trg bana Jelacica 1, Zagreb",ne
3,Poslovnica Split,"Riva 5, Split",ne`
}
