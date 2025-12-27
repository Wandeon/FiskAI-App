// src/lib/compliance/en16931-validator.ts
// EN 16931 compliance validation for e-invoices

import { EInvoice, EInvoiceLine, Contact, Company, Decimal } from "@prisma/client"
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
