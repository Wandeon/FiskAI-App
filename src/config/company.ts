/**
 * Centralized Company Configuration
 *
 * This file provides a single source of truth for company registration data
 * displayed across the marketing site (footer, contact page, pricing, etc.)
 *
 * PRODUCTION DEPLOYMENT:
 * Set these environment variables in Coolify to use real company data:
 * - NEXT_PUBLIC_COMPANY_NAME
 * - NEXT_PUBLIC_COMPANY_OIB
 * - NEXT_PUBLIC_COMPANY_IBAN
 * - NEXT_PUBLIC_COMPANY_BANK
 * - NEXT_PUBLIC_COMPANY_VAT_ID
 * - NEXT_PUBLIC_COMPANY_PHONE
 * - NEXT_PUBLIC_COMPANY_PHONE_EMERGENCY
 * - NEXT_PUBLIC_COMPANY_ADDRESS
 * - NEXT_PUBLIC_COMPANY_CITY
 * - NEXT_PUBLIC_COMPANY_EMAIL_CONTACT
 * - NEXT_PUBLIC_COMPANY_EMAIL_SUPPORT
 */

export interface CompanyInfo {
  /** Legal company name (e.g., "FiskAI d.o.o.") */
  name: string
  /** Croatian OIB (11 digits) */
  oib: string
  /** IBAN with bank code */
  iban: string
  /** Bank name abbreviation */
  bank: string
  /** VAT ID (HR + OIB) */
  vatId: string
  /** Main contact phone number */
  phone: string
  /** Emergency support phone number */
  phoneEmergency: string
  /** Street address */
  address: string
  /** City with postal code */
  city: string
  /** Country */
  country: string
  /** General contact email */
  emailContact: string
  /** Technical support email */
  emailSupport: string
  /** Product name */
  productName: string
  /** Product tagline */
  tagline: string
}

/**
 * Real FiskAI company data for production.
 * Values can still be overridden via environment variables if needed.
 */
const FISKAI_OIB = "38472629040"
const FISKAI_IBAN = "HR6523600001102774351"
const FISKAI_PHONE = "+385 1 6326 933"
const FISKAI_PHONE_EMERGENCY = "+385 95 326 9330"

/**
 * Company information used across the marketing site.
 * Values can be overridden via NEXT_PUBLIC_* environment variables.
 */
export const companyInfo: CompanyInfo = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "FiskAI d.o.o.",
  oib: process.env.NEXT_PUBLIC_COMPANY_OIB || FISKAI_OIB,
  iban: process.env.NEXT_PUBLIC_COMPANY_IBAN || FISKAI_IBAN,
  bank: process.env.NEXT_PUBLIC_COMPANY_BANK || "PBZ",
  vatId: process.env.NEXT_PUBLIC_COMPANY_VAT_ID || `HR${FISKAI_OIB}`,
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || FISKAI_PHONE,
  phoneEmergency: process.env.NEXT_PUBLIC_COMPANY_PHONE_EMERGENCY || FISKAI_PHONE_EMERGENCY,
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Ulica grada Vukovara 269a",
  city: process.env.NEXT_PUBLIC_COMPANY_CITY || "10000 Zagreb",
  country: "Hrvatska",
  emailContact: process.env.NEXT_PUBLIC_COMPANY_EMAIL_CONTACT || "info@fiskai.hr",
  emailSupport: process.env.NEXT_PUBLIC_COMPANY_EMAIL_SUPPORT || "podrska@fiskai.hr",
  productName: "FiskAI",
  tagline: "AI-first računovodstvo za Hrvatsku",
}

/**
 * Converts a phone number to a tel: link format (removes spaces).
 */
export function getPhoneLink(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`
}

/**
 * Patterns that indicate placeholder data (for build-time warnings).
 * These patterns match the OLD placeholder values to detect if they accidentally get used.
 */
const PLACEHOLDER_PATTERNS = {
  oib: /^12345678901$/,
  iban: /^HR1234567890123456789$/,
  phone: /^\+385 1 4929 380$/,
}

/**
 * Check if a value appears to be placeholder data.
 */
export function isPlaceholder(field: keyof typeof PLACEHOLDER_PATTERNS, value: string): boolean {
  const pattern = PLACEHOLDER_PATTERNS[field]
  return pattern ? pattern.test(value) : false
}

/**
 * Get full address string.
 */
export function getFullAddress(): string {
  return `${companyInfo.address}, ${companyInfo.city}`
}

/**
 * Build-time validation: logs warnings if placeholder data is detected.
 * This runs during module initialization.
 */
if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  const warnings: string[] = []

  if (isPlaceholder("oib", companyInfo.oib)) {
    warnings.push("OIB appears to be placeholder data")
  }
  if (isPlaceholder("iban", companyInfo.iban)) {
    warnings.push("IBAN appears to be placeholder data")
  }
  if (isPlaceholder("phone", companyInfo.phone)) {
    warnings.push("Phone appears to be placeholder data")
  }

  if (warnings.length > 0) {
    console.warn(
      "[company-config] Placeholder company data detected in production:\n" +
        warnings.map((w) => `  - ${w}`).join("\n") +
        "\n  Set NEXT_PUBLIC_COMPANY_* environment variables to use real data."
    )
  }
}
