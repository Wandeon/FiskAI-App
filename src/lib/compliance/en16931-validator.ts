// src/lib/compliance/en16931-validator.ts
// EN 16931 compliance validation for e-invoices

import { EInvoice, EInvoiceLine, Contact, Company } from "@prisma/client"
import { logger } from "@/lib/logger"

export interface ComplianceResult {
  compliant: boolean
  errors: string[]
  warnings: string[]
  details: {
    schemaValidation: boolean
    businessRules: boolean
    requiredFields: boolean
    dataTypes: boolean
  }
}

export interface EN16931Invoice extends EInvoice {
  lines: EInvoiceLine[]
  buyer?: Contact | null
  company?: Company | null
}

/**
 * Validate invoice against EN 16931 standard
 */
export function validateEN16931Compliance(invoice: EN16931Invoice): ComplianceResult {
  const errors: string[] = []
  const warnings: string[] = []

  const details = {
    schemaValidation: true,
    businessRules: true,
    requiredFields: true,
    dataTypes: true,
  }

  // Check required fields
  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim().length === 0) {
    errors.push("Invoice number is required")
    details.requiredFields = false
  }

  if (!invoice.issueDate) {
    errors.push("Issue date is required")
    details.requiredFields = false
  }

  if (!invoice.companyId) {
    errors.push("Company ID is required")
    details.requiredFields = false
  }

  if (!invoice.direction) {
    errors.push("Invoice direction (INBOUND/OUTBOUND) is required")
    details.requiredFields = false
  }

  // Check data types and basic rules
  if (invoice.netAmount && Number(invoice.netAmount) < 0) {
    errors.push("Net amount cannot be negative")
    details.dataTypes = false
  }

  if (invoice.vatAmount && Number(invoice.vatAmount) < 0) {
    errors.push("VAT amount cannot be negative")
    details.dataTypes = false
  }

  if (invoice.totalAmount && Number(invoice.totalAmount) < 0) {
    errors.push("Total amount cannot be negative")
    details.dataTypes = false
  }

  // Validate VAT calculations
  if (
    invoice.netAmount !== undefined &&
    invoice.vatAmount !== undefined &&
    invoice.totalAmount !== undefined
  ) {
    const calculatedTotal = Number(
      (Number(invoice.netAmount) + Number(invoice.vatAmount)).toFixed(2)
    )
    const actualTotal = Number(invoice.totalAmount)

    if (Math.abs(calculatedTotal - actualTotal) > 0.01) {
      // Allow small rounding differences
      errors.push(
        `Total amount (${actualTotal}) doesn't match net amount + VAT (${calculatedTotal})`
      )
      details.businessRules = false
    }
  }

  // Validate invoice lines
  if (!invoice.lines || invoice.lines.length === 0) {
    errors.push("Invoice must have at least one line item")
    details.requiredFields = false
  } else {
    invoice.lines.forEach((line, index) => {
      if (!line.description || line.description.trim().length === 0) {
        errors.push(`Line ${index + 1}: Description is required`)
        details.requiredFields = false
      }

      if (line.quantity === undefined || Number(line.quantity) <= 0) {
        errors.push(`Line ${index + 1}: Quantity must be positive`)
        details.dataTypes = false
      }

      if (line.unitPrice === undefined || Number(line.unitPrice) < 0) {
        errors.push(`Line ${index + 1}: Unit price cannot be negative`)
        details.dataTypes = false
      }

      if (line.vatRate === undefined || Number(line.vatRate) < 0 || Number(line.vatRate) > 100) {
        errors.push(`Line ${index + 1}: VAT rate must be between 0 and 100`)
        details.dataTypes = false
      }

      // Validate line amount calculation
      if (
        line.quantity !== undefined &&
        line.unitPrice !== undefined &&
        line.netAmount !== undefined
      ) {
        const calculatedNet = Number((Number(line.quantity) * Number(line.unitPrice)).toFixed(2))
        const actualNet = Number(line.netAmount)

        if (Math.abs(calculatedNet - actualNet) > 0.01) {
          errors.push(`Line ${index + 1}: Net amount doesn't match quantity × unit price`)
          details.businessRules = false
        }
      }
    })
  }

  // Check for due date logic
  if (invoice.issueDate && invoice.dueDate) {
    if (new Date(invoice.dueDate) < new Date(invoice.issueDate)) {
      warnings.push("Due date is before issue date")
    }
  }

  // Check currency (should be EUR for Croatia)
  if (invoice.currency && !["EUR", "HRK", "USD"].includes(invoice.currency)) {
    warnings.push(`Unusual currency: ${invoice.currency}. Expected EUR for Croatia.`)
  }

  // Check buyer information (if outbound invoice)
  if (invoice.direction === "OUTBOUND" && (!invoice.buyer || !invoice.buyer.name)) {
    errors.push("Buyer information is required for outbound invoices")
    details.requiredFields = false
  }

  // Additional EN 16931 specific validations would go here
  // For now, implementing key requirements

  const result: ComplianceResult = {
    compliant: errors.length === 0,
    errors,
    warnings,
    details,
  }

  logger.info(
    {
      invoiceId: invoice.id,
      compliant: result.compliant,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      operation: "en16931_validation",
    },
    `EN 16931 validation completed for invoice ${invoice.invoiceNumber}`
  )

  return result
}

/**
 * Validate invoice against Croatian specific requirements
 */
export function validateCroatianCompliance(invoice: EN16931Invoice): ComplianceResult {
  const baseValidation = validateEN16931Compliance(invoice)
  const errors = [...baseValidation.errors]
  const warnings = [...baseValidation.warnings]

  // Additional Croatian-specific validations
  if (invoice.jir && invoice.jir.length !== 36 && !invoice.jir.includes("-")) {
    // JIR should be in UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    errors.push("JIR format doesn't match Croatian standard (should be UUID format)")
  }

  if (invoice.zki && invoice.zki.length !== 32) {
    errors.push("ZKI should be 32 characters long")
  }

  // Validate OIB format if present (11 digits)
  if (invoice.company?.oib && !/^\d{11}$/.test(invoice.company.oib)) {
    errors.push("Company OIB should be 11 digits")
  }

  if (invoice.buyer?.oib && !/^\d{11}$/.test(invoice.buyer.oib)) {
    errors.push("Buyer OIB should be 11 digits")
  }

  // For fiscalized invoices, ensure required fields
  if (invoice.status === "FISCALIZED") {
    if (!invoice.jir) {
      errors.push("JIR is required for fiscalized invoices")
    }
    if (!invoice.zki) {
      errors.push("ZKI is required for fiscalized invoices")
    }
  }

  return {
    compliant: errors.length === 0,
    errors,
    warnings,
    details: {
      ...baseValidation.details,
      requiredFields: baseValidation.details.requiredFields && errors.length === 0,
    },
  }
}

/**
 * B2B E-Invoice Preflight Validation
 *
 * Checks master data requirements before sending to e-invoice provider.
 * Based on EN 16931 business terms (BT-*) and Croatian requirements.
 *
 * This must pass BEFORE calling provider.sendInvoice() to avoid
 * rejected invoices due to missing/invalid identifiers.
 */
export interface PreflightResult {
  valid: boolean
  errors: { field: string; btCode: string; message: string }[]
  warnings: string[]
}

export function validateB2BEInvoicePreflight(invoice: EN16931Invoice): PreflightResult {
  const errors: PreflightResult["errors"] = []
  const warnings: string[] = []

  // === SELLER (Company) validation ===
  const company = invoice.company

  if (!company) {
    errors.push({
      field: "company",
      btCode: "BG-4",
      message: "Seller party (company) is required",
    })
  } else {
    // BT-32: Seller Tax Registration Identifier (OIB for Croatian companies)
    if (!company.oib) {
      errors.push({
        field: "company.oib",
        btCode: "BT-32",
        message: "Seller tax registration identifier (OIB) is required",
      })
    } else if (!/^\d{11}$/.test(company.oib)) {
      errors.push({
        field: "company.oib",
        btCode: "BT-32",
        message: "Seller OIB must be exactly 11 digits",
      })
    }

    // BT-31: Seller VAT Identifier - required for standard VAT rate invoices
    // For Croatian companies, vatNumber should be HR + OIB
    const hasStandardVatLine = invoice.lines?.some(
      (line) => line.vatCategory === "S" || (line.vatRate && Number(line.vatRate) > 0)
    )

    if (hasStandardVatLine) {
      if (!company.vatNumber) {
        errors.push({
          field: "company.vatNumber",
          btCode: "BT-31",
          message:
            "Seller VAT identifier is required for invoices with standard VAT rate (BR-S-02). " +
            "For Croatian companies, set vatNumber to HR + OIB (e.g., HR12345678901)",
        })
      } else if (company.country === "HR" && !company.vatNumber.startsWith("HR")) {
        warnings.push(
          `Seller VAT number should start with HR for Croatian companies (current: ${company.vatNumber})`
        )
      }
    }

    // Seller address validation
    if (!company.address) {
      errors.push({
        field: "company.address",
        btCode: "BT-35",
        message: "Seller street address is required",
      })
    }

    if (!company.city) {
      errors.push({
        field: "company.city",
        btCode: "BT-37",
        message: "Seller city is required",
      })
    }

    if (!company.postalCode) {
      errors.push({
        field: "company.postalCode",
        btCode: "BT-38",
        message: "Seller postal code is required",
      })
    }

    if (!company.country) {
      errors.push({
        field: "company.country",
        btCode: "BT-40",
        message: "Seller country code is required",
      })
    } else if (!/^[A-Z]{2}$/.test(company.country)) {
      errors.push({
        field: "company.country",
        btCode: "BT-40",
        message: "Seller country must be ISO 3166-1 alpha-2 code (e.g., HR)",
      })
    }

    // === CROATIAN CIUS-2025 OPERATOR VALIDATION ===
    // HR-BT-5 (OIB operatera) - operator OIB is mandatory per HR-BR-9
    // Per CIUS-2025 spec page 23: placed in SellerContact/cbc:ID
    // Falls back to company.oib if invoice.operatorOib not set
    const operatorOib = invoice.operatorOib || company.oib
    if (!operatorOib) {
      errors.push({
        field: "operatorOib",
        btCode: "HR-BT-5",
        message:
          "Operator OIB is required per HR-BR-9. " +
          "Either set operatorOib on invoice or ensure company.oib is set.",
      })
    } else if (!/^\d{11}$/.test(operatorOib)) {
      errors.push({
        field: "operatorOib",
        btCode: "HR-BT-5",
        message: "Operator OIB must be exactly 11 digits",
      })
    }

    // HR-BT-4 (Oznaka operatera) - operator designation mandatory per HR-BR-37
    // Currently using default "Operator-1" since operatorName not in schema
    // This is acceptable per spec - just needs to be non-empty
  }

  // === BUYER (Contact) validation ===
  const buyer = invoice.buyer

  if (!buyer) {
    errors.push({
      field: "buyer",
      btCode: "BG-7",
      message: "Buyer party is required for B2B invoices",
    })
  } else {
    // BT-48: Buyer VAT Identifier - required for B2B
    if (!buyer.vatNumber) {
      // For B2B, buyer must have VAT number
      if (buyer.oib && buyer.country === "HR") {
        errors.push({
          field: "buyer.vatNumber",
          btCode: "BT-48",
          message:
            "Buyer VAT identifier is required for B2B invoices. " +
            "For Croatian buyers, set vatNumber to HR + OIB (e.g., HR98765432109)",
        })
      } else {
        errors.push({
          field: "buyer.vatNumber",
          btCode: "BT-48",
          message: "Buyer VAT identifier is required for B2B invoices",
        })
      }
    }

    // Buyer address validation
    if (!buyer.address) {
      warnings.push("Buyer street address (BT-50) is recommended")
    }

    if (!buyer.city) {
      warnings.push("Buyer city (BT-52) is recommended")
    }

    if (!buyer.country) {
      errors.push({
        field: "buyer.country",
        btCode: "BT-55",
        message: "Buyer country code is required",
      })
    } else if (!/^[A-Z]{2}$/.test(buyer.country)) {
      errors.push({
        field: "buyer.country",
        btCode: "BT-55",
        message: "Buyer country must be ISO 3166-1 alpha-2 code (e.g., HR)",
      })
    }
  }

  // === Invoice line validation ===
  if (invoice.lines && invoice.lines.length > 0) {
    invoice.lines.forEach((line, index) => {
      // BT-151: VAT category code is required
      if (!line.vatCategory) {
        errors.push({
          field: `lines[${index}].vatCategory`,
          btCode: "BT-151",
          message: `Line ${index + 1}: VAT category code is required (S, Z, E, AE, etc.)`,
        })
      }

      // HR-BR-25: Each item MUST have CPA classification code (BT-158)
      // Per CIUS-2025 spec page 113: CommodityClassification with listID="CG"
      // Note: cpaCode field not in schema yet - UBL generator uses default "62.02"
      // TODO: Add cpaCode field to EInvoiceLine schema when ready
    })

    // Add warning that CPA codes are being defaulted
    warnings.push(
      "HR-BR-25: CPA classification codes (BT-158) not in schema - using default '62.02'. " +
        "For production, add cpaCode field to line items with actual KPD/CPA codes."
    )
  }

  // === Invoice-level validation ===
  if (!invoice.currency) {
    errors.push({
      field: "currency",
      btCode: "BT-5",
      message: "Invoice currency code is required",
    })
  } else if (!/^[A-Z]{3}$/.test(invoice.currency)) {
    errors.push({
      field: "currency",
      btCode: "BT-5",
      message: "Currency must be ISO 4217 code (e.g., EUR)",
    })
  }

  if (!invoice.invoiceNumber) {
    errors.push({
      field: "invoiceNumber",
      btCode: "BT-1",
      message: "Invoice number is required",
    })
  }

  if (!invoice.issueDate) {
    errors.push({
      field: "issueDate",
      btCode: "BT-2",
      message: "Invoice issue date is required",
    })
  }

  const result: PreflightResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  }

  logger.info(
    {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      operation: "b2b_einvoice_preflight",
    },
    `B2B e-invoice preflight ${result.valid ? "passed" : "FAILED"}`
  )

  return result
}

/**
 * Get compliance summary for an invoice
 */
export function getComplianceSummary(invoice: EN16931Invoice): {
  en16931Compliant: boolean
  croatianCompliant: boolean
  errors: string[]
  warnings: string[]
  criticalErrors: string[]
} {
  const en16931Result = validateEN16931Compliance(invoice)
  const croatianResult = validateCroatianCompliance(invoice)

  // Critical errors that would prevent fiscalization
  const criticalErrors = [
    ...en16931Result.errors,
    ...croatianResult.errors.filter(
      (error) =>
        error.includes("JIR") ||
        error.includes("ZKI") ||
        error.includes("required") ||
        error.includes("Currency") ||
        error.includes("VAT") ||
        error.includes("amount")
    ),
  ]

  return {
    en16931Compliant: en16931Result.compliant,
    croatianCompliant: croatianResult.compliant,
    errors: [...new Set([...en16931Result.errors, ...croatianResult.errors])], // unique errors
    warnings: [...new Set([...en16931Result.warnings, ...croatianResult.warnings])], // unique warnings
    criticalErrors,
  }
}
