/**
 * ZP Form Generator - Zbirna Prijava (EU Summary Declaration)
 * Generates XML for ePorezna submission
 *
 * ZP form reports cross-border service transactions with EU vendors
 * Required for paušalni obrt with PDV-ID doing business with EU
 */

import { EU_COUNTRY_NAMES } from "../constants"

/**
 * Individual EU transaction for ZP form
 */
export interface ZpTransaction {
  // Vendor identification
  vendorVatId: string // Full VAT ID (e.g., "DE123456789")
  vendorCountryCode: string // 2-letter code (e.g., "DE")
  vendorName?: string // Optional display name

  // Transaction details
  transactionDate: Date
  amount: number // In EUR
  description?: string

  // Transaction type
  isGoodsDelivery: boolean // true = goods, false = services
  isTriangularTransaction?: boolean // Special EU triangular trade
}

/**
 * ZP form data structure
 */
export interface ZpFormData {
  // Company identification
  companyOib: string // 11-digit OIB
  companyPdvId: string // HR + OIB format (e.g., "HR12345678901")
  companyName: string
  companyAddress: string
  companyCity: string
  companyPostalCode: string

  // Reporting period
  periodMonth: number // 1-12
  periodYear: number

  // Transactions
  transactions: ZpTransaction[]

  // Form metadata
  formDate?: Date // When form was generated
  declarantName?: string // Person responsible
  declarantPhone?: string
}

/**
 * Validate ZP form data before generation
 */
export function validateZpFormData(data: ZpFormData): string[] {
  const errors: string[] = []

  // Validate OIB format (11 digits)
  if (!/^\d{11}$/.test(data.companyOib)) {
    errors.push("OIB mora biti 11 znamenki")
  }

  // Validate PDV-ID format (HR + 11 digits)
  if (!/^HR\d{11}$/.test(data.companyPdvId)) {
    errors.push("PDV-ID mora biti u formatu HR + 11 znamenki")
  }

  // Validate period
  if (data.periodMonth < 1 || data.periodMonth > 12) {
    errors.push("Mjesec mora biti između 1 i 12")
  }

  if (data.periodYear < 2000 || data.periodYear > 2100) {
    errors.push("Godina nije valjana")
  }

  // Validate transactions
  if (!data.transactions || data.transactions.length === 0) {
    errors.push("ZP obrazac mora sadržavati barem jednu transakciju")
  }

  // Validate each transaction
  data.transactions.forEach((tx, index) => {
    if (!tx.vendorVatId || tx.vendorVatId.length < 3) {
      errors.push(`Transakcija ${index + 1}: VAT ID dobavljača je obavezan`)
    }

    if (!tx.vendorCountryCode || tx.vendorCountryCode.length !== 2) {
      errors.push(`Transakcija ${index + 1}: Kod države mora biti 2 slova`)
    }

    if (tx.amount <= 0) {
      errors.push(`Transakcija ${index + 1}: Iznos mora biti veći od 0`)
    }

    if (!tx.transactionDate) {
      errors.push(`Transakcija ${index + 1}: Datum transakcije je obavezan`)
    }
  })

  return errors
}

/**
 * Format amount for XML (EUR with 2 decimals)
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Format date for XML (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Group transactions by vendor VAT ID and country
 */
function groupTransactionsByVendor(transactions: ZpTransaction[]): Map<string, ZpTransaction[]> {
  const grouped = new Map<string, ZpTransaction[]>()

  for (const tx of transactions) {
    const key = `${tx.vendorCountryCode}_${tx.vendorVatId}`

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(tx)
  }

  return grouped
}

/**
 * Calculate totals by vendor
 */
interface VendorTotal {
  vendorVatId: string
  vendorCountryCode: string
  vendorName?: string
  totalGoods: number
  totalServices: number
  totalTriangular: number
  transactionCount: number
}

function calculateVendorTotals(transactions: ZpTransaction[]): VendorTotal[] {
  const grouped = groupTransactionsByVendor(transactions)
  const totals: VendorTotal[] = []

  grouped.forEach((txs, key) => {
    const firstTx = txs[0]

    const total: VendorTotal = {
      vendorVatId: firstTx.vendorVatId,
      vendorCountryCode: firstTx.vendorCountryCode,
      vendorName: firstTx.vendorName,
      totalGoods: 0,
      totalServices: 0,
      totalTriangular: 0,
      transactionCount: txs.length,
    }

    for (const tx of txs) {
      if (tx.isTriangularTransaction) {
        total.totalTriangular += tx.amount
      } else if (tx.isGoodsDelivery) {
        total.totalGoods += tx.amount
      } else {
        total.totalServices += tx.amount
      }
    }

    totals.push(total)
  })

  // Sort by country code, then by VAT ID
  totals.sort((a, b) => {
    if (a.vendorCountryCode !== b.vendorCountryCode) {
      return a.vendorCountryCode.localeCompare(b.vendorCountryCode)
    }
    return a.vendorVatId.localeCompare(b.vendorVatId)
  })

  return totals
}

/**
 * Generate ZP form XML for ePorezna submission
 */
export function generateZpXml(data: ZpFormData): string {
  // Validate data first
  const errors = validateZpFormData(data)
  if (errors.length > 0) {
    throw new Error(`ZP form validation failed:\n${errors.join("\n")}`)
  }

  const formDate = data.formDate || new Date()
  const vendorTotals = calculateVendorTotals(data.transactions)

  // Calculate grand totals
  const grandTotalGoods = vendorTotals.reduce((sum, v) => sum + v.totalGoods, 0)
  const grandTotalServices = vendorTotals.reduce((sum, v) => sum + v.totalServices, 0)
  const grandTotalTriangular = vendorTotals.reduce((sum, v) => sum + v.totalTriangular, 0)
  const grandTotal = grandTotalGoods + grandTotalServices + grandTotalTriangular

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml +=
    '<ZbirnaPrijava xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacZP/v1-0">\n'

  // Header section
  xml += "  <Zaglavlje>\n"
  xml += `    <VrstaPrijave>O</VrstaPrijave>\n` // O = Original (can be O, I = Izmjena/Amendment)
  xml += `    <PdvId>${escapeXml(data.companyPdvId)}</PdvId>\n`
  xml += `    <Oib>${data.companyOib}</Oib>\n`
  xml += `    <NazivPoreznika>${escapeXml(data.companyName)}</NazivPoreznika>\n`
  xml += `    <Adresa>${escapeXml(data.companyAddress)}</Adresa>\n`
  xml += `    <Mjesto>${escapeXml(data.companyCity)}</Mjesto>\n`
  xml += `    <PostanskiBroj>${escapeXml(data.companyPostalCode)}</PostanskiBroj>\n`
  xml += `    <ObracunskoRazdobljeOd>${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}-01</ObracunskoRazdobljeOd>\n`

  // Calculate last day of month
  const lastDay = new Date(data.periodYear, data.periodMonth, 0).getDate()
  xml += `    <ObracunskoRazdobljeDo>${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}</ObracunskoRazdobljeDo>\n`

  xml += `    <DatumSastavljanja>${formatDate(formDate)}</DatumSastavljanja>\n`

  if (data.declarantName) {
    xml += `    <ImePrezimeSastavljaca>${escapeXml(data.declarantName)}</ImePrezimeSastavljaca>\n`
  }

  if (data.declarantPhone) {
    xml += `    <TelefonSastavljaca>${escapeXml(data.declarantPhone)}</TelefonSastavljaca>\n`
  }

  xml += "  </Zaglavlje>\n"

  // Transactions section
  xml += "  <IsporukeUsluga>\n"

  // Add each vendor's totals
  for (let i = 0; i < vendorTotals.length; i++) {
    const vendor = vendorTotals[i]
    const rowNum = i + 1

    xml += "    <Stavka>\n"
    xml += `      <RedniBroj>${rowNum}</RedniBroj>\n`
    xml += `      <OznakaState>${vendor.vendorCountryCode}</OznakaState>\n`

    const countryName = EU_COUNTRY_NAMES[vendor.vendorCountryCode] || vendor.vendorCountryCode
    xml += `      <NazivState>${escapeXml(countryName)}</NazivState>\n`

    xml += `      <PdvIdPrimatelja>${escapeXml(vendor.vendorVatId)}</PdvIdPrimatelja>\n`

    // Amounts (only include if > 0)
    if (vendor.totalGoods > 0) {
      xml += `      <VrijednostIsporukeDobara>${formatAmount(vendor.totalGoods)}</VrijednostIsporukeDobara>\n`
    }

    if (vendor.totalTriangular > 0) {
      xml += `      <VrijednostIsporukeDobaraTrokutne>${formatAmount(vendor.totalTriangular)}</VrijednostIsporukeDobaraTrokutne>\n`
    }

    if (vendor.totalServices > 0) {
      xml += `      <VrijednostIsporukeUsluga>${formatAmount(vendor.totalServices)}</VrijednostIsporukeUsluga>\n`
    }

    xml += "    </Stavka>\n"
  }

  xml += "  </IsporukeUsluga>\n"

  // Summary totals section
  xml += "  <RekapitulacijaUkupno>\n"
  xml += `    <UkupnaBrojStavki>${vendorTotals.length}</UkupnaBrojStavki>\n`

  if (grandTotalGoods > 0) {
    xml += `    <UkupnaVrijednostDobara>${formatAmount(grandTotalGoods)}</UkupnaVrijednostDobara>\n`
  }

  if (grandTotalTriangular > 0) {
    xml += `    <UkupnaVrijednostDobaraTrokutne>${formatAmount(grandTotalTriangular)}</UkupnaVrijednostDobaraTrokutne>\n`
  }

  if (grandTotalServices > 0) {
    xml += `    <UkupnaVrijednostUsluga>${formatAmount(grandTotalServices)}</UkupnaVrijednostUsluga>\n`
  }

  xml += `    <Ukupno>${formatAmount(grandTotal)}</Ukupno>\n`
  xml += "  </RekapitulacijaUkupno>\n"

  xml += "</ZbirnaPrijava>\n"

  return xml
}

/**
 * Generate ZP form summary for display/preview
 */
export interface ZpFormSummary {
  periodLabel: string
  vendorCount: number
  transactionCount: number
  totalGoods: number
  totalServices: number
  totalTriangular: number
  grandTotal: number
  vendors: VendorTotal[]
}

export function generateZpSummary(data: ZpFormData): ZpFormSummary {
  const vendorTotals = calculateVendorTotals(data.transactions)

  const totalGoods = vendorTotals.reduce((sum, v) => sum + v.totalGoods, 0)
  const totalServices = vendorTotals.reduce((sum, v) => sum + v.totalServices, 0)
  const totalTriangular = vendorTotals.reduce((sum, v) => sum + v.totalTriangular, 0)

  const monthNames = [
    "siječanj",
    "veljača",
    "ožujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ]

  return {
    periodLabel: `${monthNames[data.periodMonth - 1]} ${data.periodYear}`,
    vendorCount: vendorTotals.length,
    transactionCount: data.transactions.length,
    totalGoods,
    totalServices,
    totalTriangular,
    grandTotal: totalGoods + totalServices + totalTriangular,
    vendors: vendorTotals,
  }
}

/**
 * Convert EU transactions from database to ZP transactions
 */
export interface EuTransactionRecord {
  id: string
  counterpartyName: string | null
  counterpartyCountry: string | null
  counterpartyVatId: string | null
  transactionDate: Date
  amount: string // Decimal stored as string
  direction: string // "RECEIVED" or "PROVIDED"
  transactionType?: string | null // "SERVICES" or "GOODS"
}

export function convertEuTransactionsToZp(transactions: EuTransactionRecord[]): ZpTransaction[] {
  return transactions
    .filter((tx) => {
      // Only include confirmed EU transactions with VAT ID
      return (
        tx.counterpartyCountry &&
        tx.counterpartyCountry !== "HR" &&
        tx.counterpartyVatId &&
        tx.direction === "RECEIVED" // Services/goods we received (paid for)
      )
    })
    .map((tx) => ({
      vendorVatId: tx.counterpartyVatId!,
      vendorCountryCode: tx.counterpartyCountry!,
      vendorName: tx.counterpartyName || undefined,
      transactionDate: new Date(tx.transactionDate),
      amount: parseFloat(tx.amount),
      // Use transactionType from database, default to SERVICES for backwards compatibility
      isGoodsDelivery: tx.transactionType === "GOODS",
      isTriangularTransaction: false,
    }))
}
