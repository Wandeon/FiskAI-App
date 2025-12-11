import { db } from './db'

/**
 * Croatian fiscalization invoice number format:
 * Legal format: {broj}-{poslovni_prostor}-{naplatni_uređaj}
 * Example: 43-1-1
 *
 * Internal reference format (for accounting):
 * {year}/{broj}-{poslovni_prostor}-{naplatni_uređaj}
 * Example: 2025/43-1-1
 */

export interface InvoiceNumber {
  /** Legal format: "43-1-1" */
  invoiceNumber: string
  /** Internal reference with year: "2025/43-1-1" */
  internalReference: string
  /** Sequential number within the year */
  sequentialNumber: number
  /** Business premises code */
  premisesCode: number
  /** Payment device code */
  deviceCode: number
  /** Year */
  year: number
}

/**
 * Get the next invoice number for a company.
 * Uses database-level locking to ensure sequential numbers with no gaps.
 *
 * @param companyId - Company ID
 * @param businessPremisesId - Optional premises ID (uses default if not provided)
 * @param paymentDeviceId - Optional device ID (uses default for premises if not provided)
 * @returns Invoice number components
 */
export async function getNextInvoiceNumber(
  companyId: string,
  businessPremisesId?: string,
  paymentDeviceId?: string
): Promise<InvoiceNumber> {
  const currentYear = new Date().getFullYear()

  // Get or create default business premises
  let premises = businessPremisesId
    ? await db.businessPremises.findUnique({ where: { id: businessPremisesId } })
    : await db.businessPremises.findFirst({
        where: { companyId, isDefault: true, isActive: true },
      })

  if (!premises) {
    // Create default premises if none exists
    premises = await db.businessPremises.create({
      data: {
        companyId,
        code: 1,
        name: 'Glavni ured',
        isDefault: true,
        isActive: true,
      },
    })
  }

  // Get or create default payment device
  let device = paymentDeviceId
    ? await db.paymentDevice.findUnique({ where: { id: paymentDeviceId } })
    : await db.paymentDevice.findFirst({
        where: {
          companyId,
          businessPremisesId: premises.id,
          isDefault: true,
          isActive: true
        },
      })

  if (!device) {
    // Create default device if none exists
    device = await db.paymentDevice.create({
      data: {
        companyId,
        businessPremisesId: premises.id,
        code: 1,
        name: 'Naplatni uređaj 1',
        isDefault: true,
        isActive: true,
      },
    })
  }

  // Get next sequential number using atomic increment
  // This uses upsert to handle the case where sequence doesn't exist yet
  const sequence = await db.invoiceSequence.upsert({
    where: {
      businessPremisesId_year: {
        businessPremisesId: premises.id,
        year: currentYear,
      },
    },
    update: {
      lastNumber: { increment: 1 },
    },
    create: {
      companyId,
      businessPremisesId: premises.id,
      year: currentYear,
      lastNumber: 1,
    },
  })

  const sequentialNumber = sequence.lastNumber
  const premisesCode = premises.code
  const deviceCode = device.code

  // Format: broj-poslovni_prostor-naplatni_uređaj
  const invoiceNumber = `${sequentialNumber}-${premisesCode}-${deviceCode}`
  const internalReference = `${currentYear}/${invoiceNumber}`

  return {
    invoiceNumber,
    internalReference,
    sequentialNumber,
    premisesCode,
    deviceCode,
    year: currentYear,
  }
}

/**
 * Parse an invoice number string into its components.
 *
 * @param invoiceNumber - Invoice number string (e.g., "43-1-1")
 * @returns Parsed components or null if invalid format
 */
export function parseInvoiceNumber(invoiceNumber: string): {
  sequentialNumber: number
  premisesCode: number
  deviceCode: number
} | null {
  const parts = invoiceNumber.split('-')
  if (parts.length !== 3) return null

  const sequentialNumber = parseInt(parts[0], 10)
  const premisesCode = parseInt(parts[1], 10)
  const deviceCode = parseInt(parts[2], 10)

  if (isNaN(sequentialNumber) || isNaN(premisesCode) || isNaN(deviceCode)) {
    return null
  }

  return { sequentialNumber, premisesCode, deviceCode }
}

/**
 * Parse an internal reference string into its components.
 *
 * @param internalReference - Internal reference string (e.g., "2025/43-1-1")
 * @returns Parsed components or null if invalid format
 */
export function parseInternalReference(internalReference: string): {
  year: number
  sequentialNumber: number
  premisesCode: number
  deviceCode: number
} | null {
  const yearParts = internalReference.split('/')
  if (yearParts.length !== 2) return null

  const year = parseInt(yearParts[0], 10)
  if (isNaN(year)) return null

  const invoiceComponents = parseInvoiceNumber(yearParts[1])
  if (!invoiceComponents) return null

  return { year, ...invoiceComponents }
}

/**
 * Validate that an invoice number follows the Croatian format.
 *
 * @param invoiceNumber - Invoice number to validate
 * @returns True if valid Croatian format
 */
export function isValidCroatianInvoiceNumber(invoiceNumber: string): boolean {
  const parsed = parseInvoiceNumber(invoiceNumber)
  if (!parsed) return false

  // All parts must be positive integers
  return (
    parsed.sequentialNumber > 0 &&
    parsed.premisesCode > 0 &&
    parsed.deviceCode > 0
  )
}
