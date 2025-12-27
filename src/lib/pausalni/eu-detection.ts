import { drizzleDb } from "@/lib/db/drizzle"
import { euVendor, euTransaction } from "@/lib/db/schema/pausalni"
import { EU_COUNTRY_CODES, PDV_CONFIG } from "./constants"
import { like, eq } from "drizzle-orm"

export interface EuDetectionResult {
  isEu: boolean
  country: string | null
  countryName: string | null
  vendor: {
    id: string
    displayName: string
    vendorType: string
  } | null
  confidence: number
  detectionMethod: "IBAN" | "VENDOR_DB" | "USER_CONFIRMED" | "UNKNOWN"
  requiresUserConfirmation: boolean
}

interface BankTransaction {
  id: string
  counterpartyName: string | null
  counterpartyIban: string | null
  amount: number
  transactionDate: Date
}

/**
 * Detect if a bank transaction is an EU transaction requiring PDV reporting
 */
export async function detectEuTransaction(tx: BankTransaction): Promise<EuDetectionResult> {
  // Layer 1: IBAN Analysis
  if (tx.counterpartyIban) {
    const ibanCountry = tx.counterpartyIban.substring(0, 2).toUpperCase()

    // Skip Croatian IBANs
    if (ibanCountry === "HR") {
      return {
        isEu: false,
        country: "HR",
        countryName: "Hrvatska",
        vendor: null,
        confidence: 100,
        detectionMethod: "IBAN",
        requiresUserConfirmation: false,
      }
    }

    // Check if EU country
    if (EU_COUNTRY_CODES.includes(ibanCountry as any)) {
      const { EU_COUNTRY_NAMES } = await import("./constants")
      return {
        isEu: true,
        country: ibanCountry,
        countryName: EU_COUNTRY_NAMES[ibanCountry] || ibanCountry,
        vendor: null,
        confidence: 95,
        detectionMethod: "IBAN",
        requiresUserConfirmation: false,
      }
    }
  }

  // Layer 2: Vendor Database Matching
  if (tx.counterpartyName) {
    const normalizedName = tx.counterpartyName.toUpperCase().trim()

    // Fetch all vendors and match against patterns
    const vendors = await drizzleDb.select().from(euVendor)

    for (const vendor of vendors) {
      const pattern = new RegExp(vendor.namePattern, "i")
      if (pattern.test(normalizedName)) {
        const { EU_COUNTRY_NAMES } = await import("./constants")
        return {
          isEu: vendor.isEu ?? false,
          country: vendor.countryCode,
          countryName: EU_COUNTRY_NAMES[vendor.countryCode] || vendor.countryCode,
          vendor: {
            id: vendor.id,
            displayName: vendor.displayName,
            vendorType: vendor.vendorType,
          },
          confidence: vendor.confidenceScore ?? 0,
          detectionMethod: "VENDOR_DB",
          requiresUserConfirmation: false,
        }
      }
    }
  }

  // Layer 3: Unknown - needs user confirmation if looks foreign
  const looksLikeForeign =
    tx.counterpartyName &&
    (/\b(LTD|LIMITED|INC|GMBH|B\.?V\.?|S\.?A\.?|PTY|LLC)\b/i.test(tx.counterpartyName) ||
      /[A-Z]{2}\d{10,}/.test(tx.counterpartyIban || "")) // Non-HR IBAN pattern

  return {
    isEu: false,
    country: null,
    countryName: null,
    vendor: null,
    confidence: 0,
    detectionMethod: "UNKNOWN",
    requiresUserConfirmation: !!looksLikeForeign,
  }
}

/**
 * Process bank transactions and create EU transaction records
 */
export async function processTransactionsForEu(
  companyId: string,
  transactions: BankTransaction[]
): Promise<{
  detected: number
  needsConfirmation: number
  skipped: number
}> {
  let detected = 0
  let needsConfirmation = 0
  let skipped = 0

  for (const tx of transactions) {
    // Skip incoming transactions (we're looking for services we PAID FOR)
    if (tx.amount > 0) {
      skipped++
      continue
    }

    const result = await detectEuTransaction(tx)

    if (result.isEu) {
      // Create EU transaction record
      const txDate = new Date(tx.transactionDate)
      const pdvAmount = Math.abs(tx.amount) * (PDV_CONFIG.rate / 100)

      await drizzleDb
        .insert(euTransaction)
        .values({
          companyId,
          bankTransactionId: tx.id,
          direction: "RECEIVED", // We received the service (outgoing payment)
          counterpartyName: tx.counterpartyName ?? undefined,
          counterpartyCountry: result.country ?? undefined,
          transactionDate: tx.transactionDate.toISOString(),
          amount: String(Math.abs(tx.amount)),
          pdvRate: String(PDV_CONFIG.rate),
          pdvAmount: String(pdvAmount),
          reportingMonth: txDate.getMonth() + 1,
          reportingYear: txDate.getFullYear(),
          vendorId: result.vendor?.id ?? undefined,
          detectionMethod: result.detectionMethod,
          confidenceScore: result.confidence,
          userConfirmed: false,
        })
        .onConflictDoNothing()

      detected++
    } else if (result.requiresUserConfirmation) {
      needsConfirmation++
    } else {
      skipped++
    }
  }

  return { detected, needsConfirmation, skipped }
}

/**
 * User confirms a transaction as EU (learns vendor)
 */
export async function confirmEuTransaction(
  transactionId: string,
  isEu: boolean,
  country?: string,
  vendorName?: string
): Promise<void> {
  if (isEu && vendorName && country) {
    // Learn this vendor for future detection
    await drizzleDb
      .insert(euVendor)
      .values({
        namePattern: vendorName.toUpperCase().replace(/[^A-Z0-9\s]/g, ".*"),
        displayName: vendorName,
        countryCode: country,
        vendorType: "OTHER",
        isEu: true,
        confidenceScore: 80, // Lower confidence for learned vendors
        isSystem: false,
      })
      .onConflictDoNothing()
  }

  // Update the EU transaction record
  await drizzleDb
    .update(euTransaction)
    .set({
      userConfirmed: true,
      counterpartyCountry: country,
    })
    .where(eq(euTransaction.id, transactionId))
}
