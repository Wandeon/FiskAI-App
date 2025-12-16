/**
 * E-Invoice Validators
 *
 * This module provides validation functions for Croatian e-invoicing,
 * including OIB validation, party validation, and invoice structure validation.
 */

import type { EInvoice, Party, InvoiceLine, TaxCategoryCode } from "./types"

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field path or identifier where the error occurred */
  field: string

  /** Error message */
  message: string

  /** Error code for programmatic handling */
  code?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean

  /** Array of validation errors (empty if valid) */
  errors: ValidationError[]
}

/**
 * Validates Croatian OIB (Osobni identifikacijski broj)
 * using ISO 7064, MOD 11-10 algorithm
 *
 * @param oib - The OIB to validate (11 digits)
 * @returns true if valid, false otherwise
 */
export function validateOIB(oib: string): boolean {
  // Remove whitespace and check format
  const cleaned = oib.replace(/\s/g, "")

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(cleaned)) {
    return false
  }

  // ISO 7064, MOD 11-10 algorithm
  let controlNumber = 10

  for (let i = 0; i < 10; i++) {
    const digit = parseInt(cleaned.charAt(i), 10)
    controlNumber = (controlNumber + digit) % 10

    // If remainder is 0, set to 10
    if (controlNumber === 0) {
      controlNumber = 10
    }

    // Multiply by 2, mod 11
    controlNumber = (controlNumber * 2) % 11
  }

  // Calculate check digit
  let checkDigit = 11 - controlNumber
  if (checkDigit === 10) {
    checkDigit = 0
  }

  // Compare with the last digit
  const lastDigit = parseInt(cleaned.charAt(10), 10)
  return checkDigit === lastDigit
}

/**
 * Validates a party (seller or buyer)
 *
 * @param party - The party to validate
 * @param role - The role of the party ('seller' or 'buyer')
 * @returns Array of validation errors
 */
export function validateParty(party: Party, role: "seller" | "buyer"): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = role

  // Validate name
  if (!party.name || party.name.trim().length === 0) {
    errors.push({
      field: `${prefix}.name`,
      message: `${role === "seller" ? "Seller" : "Buyer"} name is required`,
      code: "REQUIRED",
    })
  }

  // Validate OIB
  if (!party.oib) {
    errors.push({
      field: `${prefix}.oib`,
      message: `${role === "seller" ? "Seller" : "Buyer"} OIB is required`,
      code: "REQUIRED",
    })
  } else if (!validateOIB(party.oib)) {
    errors.push({
      field: `${prefix}.oib`,
      message: `Invalid OIB: ${party.oib}`,
      code: "INVALID_OIB",
    })
  }

  // Validate address
  if (!party.address) {
    errors.push({
      field: `${prefix}.address`,
      message: `${role === "seller" ? "Seller" : "Buyer"} address is required`,
      code: "REQUIRED",
    })
  } else {
    if (!party.address.streetName || party.address.streetName.trim().length === 0) {
      errors.push({
        field: `${prefix}.address.streetName`,
        message: "Street name is required",
        code: "REQUIRED",
      })
    }

    if (!party.address.city || party.address.city.trim().length === 0) {
      errors.push({
        field: `${prefix}.address.city`,
        message: "City is required",
        code: "REQUIRED",
      })
    }

    if (!party.address.postalCode || party.address.postalCode.trim().length === 0) {
      errors.push({
        field: `${prefix}.address.postalCode`,
        message: "Postal code is required",
        code: "REQUIRED",
      })
    }

    if (!party.address.country || party.address.country.trim().length === 0) {
      errors.push({
        field: `${prefix}.address.country`,
        message: "Country code is required",
        code: "REQUIRED",
      })
    } else if (!/^[A-Z]{2}$/.test(party.address.country)) {
      errors.push({
        field: `${prefix}.address.country`,
        message: "Country code must be a valid ISO 3166-1 alpha-2 code (e.g., HR, DE)",
        code: "INVALID_FORMAT",
      })
    }
  }

  // Validate VAT number format if provided
  if (party.vatNumber && party.vatNumber.trim().length > 0) {
    // Basic validation - should start with country code
    if (!/^[A-Z]{2}/.test(party.vatNumber)) {
      errors.push({
        field: `${prefix}.vatNumber`,
        message: "VAT number should start with country code (e.g., HR12345678901)",
        code: "INVALID_FORMAT",
      })
    }
  }

  return errors
}

/**
 * Validates invoice lines
 *
 * @param lines - The invoice lines to validate
 * @returns Array of validation errors
 */
export function validateLines(lines: InvoiceLine[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (!lines || lines.length === 0) {
    errors.push({
      field: "lines",
      message: "At least one invoice line is required",
      code: "REQUIRED",
    })
    return errors
  }

  lines.forEach((line, index) => {
    const prefix = `lines[${index}]`

    // Validate line ID
    if (!line.id || line.id.trim().length === 0) {
      errors.push({
        field: `${prefix}.id`,
        message: `Line ${index + 1}: ID is required`,
        code: "REQUIRED",
      })
    }

    // Validate description
    if (!line.description || line.description.trim().length === 0) {
      errors.push({
        field: `${prefix}.description`,
        message: `Line ${index + 1}: Description is required`,
        code: "REQUIRED",
      })
    }

    // Validate quantity
    if (line.quantity === undefined || line.quantity === null) {
      errors.push({
        field: `${prefix}.quantity`,
        message: `Line ${index + 1}: Quantity is required`,
        code: "REQUIRED",
      })
    } else if (line.quantity <= 0) {
      errors.push({
        field: `${prefix}.quantity`,
        message: `Line ${index + 1}: Quantity must be greater than 0`,
        code: "INVALID_VALUE",
      })
    }

    // Validate unit code
    if (!line.unitCode || line.unitCode.trim().length === 0) {
      errors.push({
        field: `${prefix}.unitCode`,
        message: `Line ${index + 1}: Unit code is required`,
        code: "REQUIRED",
      })
    }

    // Validate unit price
    if (line.unitPrice === undefined || line.unitPrice === null) {
      errors.push({
        field: `${prefix}.unitPrice`,
        message: `Line ${index + 1}: Unit price is required`,
        code: "REQUIRED",
      })
    } else if (line.unitPrice < 0) {
      errors.push({
        field: `${prefix}.unitPrice`,
        message: `Line ${index + 1}: Unit price cannot be negative`,
        code: "INVALID_VALUE",
      })
    }

    // Validate tax category
    if (!line.taxCategory) {
      errors.push({
        field: `${prefix}.taxCategory`,
        message: `Line ${index + 1}: Tax category is required`,
        code: "REQUIRED",
      })
    } else {
      if (!line.taxCategory.code) {
        errors.push({
          field: `${prefix}.taxCategory.code`,
          message: `Line ${index + 1}: Tax category code is required`,
          code: "REQUIRED",
        })
      }

      if (line.taxCategory.percent === undefined || line.taxCategory.percent === null) {
        errors.push({
          field: `${prefix}.taxCategory.percent`,
          message: `Line ${index + 1}: Tax percentage is required`,
          code: "REQUIRED",
        })
      } else if (line.taxCategory.percent < 0 || line.taxCategory.percent > 100) {
        errors.push({
          field: `${prefix}.taxCategory.percent`,
          message: `Line ${index + 1}: Tax percentage must be between 0 and 100`,
          code: "INVALID_VALUE",
        })
      }
    }

    // Validate line total
    if (line.lineTotal === undefined || line.lineTotal === null) {
      errors.push({
        field: `${prefix}.lineTotal`,
        message: `Line ${index + 1}: Line total is required`,
        code: "REQUIRED",
      })
    } else {
      // Check if line total matches quantity * unitPrice (with small tolerance for rounding)
      const expectedTotal = line.quantity * line.unitPrice
      const tolerance = 0.01 // 1 cent tolerance
      if (Math.abs(line.lineTotal - expectedTotal) > tolerance) {
        errors.push({
          field: `${prefix}.lineTotal`,
          message: `Line ${index + 1}: Line total (${line.lineTotal}) does not match quantity × unit price (${expectedTotal})`,
          code: "CALCULATION_MISMATCH",
        })
      }
    }
  })

  return errors
}

/**
 * Validates invoice totals and tax calculations
 *
 * @param invoice - The invoice to validate
 * @returns Array of validation errors
 */
export function validateTotals(invoice: EInvoice): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate tax total
  if (!invoice.taxTotal) {
    errors.push({
      field: "taxTotal",
      message: "Tax total is required",
      code: "REQUIRED",
    })
    return errors
  }

  // Validate monetary total
  if (!invoice.legalMonetaryTotal) {
    errors.push({
      field: "legalMonetaryTotal",
      message: "Legal monetary total is required",
      code: "REQUIRED",
    })
    return errors
  }

  const tolerance = 0.01 // 1 cent tolerance for rounding

  // Calculate expected line extension amount
  const expectedLineExtension = invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0)

  if (
    Math.abs(invoice.legalMonetaryTotal.lineExtensionAmount - expectedLineExtension) > tolerance
  ) {
    errors.push({
      field: "legalMonetaryTotal.lineExtensionAmount",
      message: `Line extension amount (${invoice.legalMonetaryTotal.lineExtensionAmount}) does not match sum of line totals (${expectedLineExtension})`,
      code: "CALCULATION_MISMATCH",
    })
  }

  // Validate tax subtotals sum
  const taxSubtotalSum = invoice.taxTotal.taxSubtotals.reduce(
    (sum, subtotal) => sum + subtotal.taxAmount,
    0
  )

  if (Math.abs(invoice.taxTotal.taxAmount - taxSubtotalSum) > tolerance) {
    errors.push({
      field: "taxTotal.taxAmount",
      message: `Tax total amount (${invoice.taxTotal.taxAmount}) does not match sum of tax subtotals (${taxSubtotalSum})`,
      code: "CALCULATION_MISMATCH",
    })
  }

  // Validate tax exclusive amount
  const expectedTaxExclusive =
    invoice.legalMonetaryTotal.lineExtensionAmount +
    (invoice.legalMonetaryTotal.chargeTotalAmount || 0) -
    (invoice.legalMonetaryTotal.allowanceTotalAmount || 0)

  if (Math.abs(invoice.legalMonetaryTotal.taxExclusiveAmount - expectedTaxExclusive) > tolerance) {
    errors.push({
      field: "legalMonetaryTotal.taxExclusiveAmount",
      message: `Tax exclusive amount (${invoice.legalMonetaryTotal.taxExclusiveAmount}) does not match expected calculation`,
      code: "CALCULATION_MISMATCH",
    })
  }

  // Validate tax inclusive amount
  const expectedTaxInclusive =
    invoice.legalMonetaryTotal.taxExclusiveAmount + invoice.taxTotal.taxAmount

  if (Math.abs(invoice.legalMonetaryTotal.taxInclusiveAmount - expectedTaxInclusive) > tolerance) {
    errors.push({
      field: "legalMonetaryTotal.taxInclusiveAmount",
      message: `Tax inclusive amount (${invoice.legalMonetaryTotal.taxInclusiveAmount}) does not match tax exclusive + tax (${expectedTaxInclusive})`,
      code: "CALCULATION_MISMATCH",
    })
  }

  // Validate payable amount
  const expectedPayable =
    invoice.legalMonetaryTotal.taxInclusiveAmount - (invoice.legalMonetaryTotal.prepaidAmount || 0)

  if (Math.abs(invoice.legalMonetaryTotal.payableAmount - expectedPayable) > tolerance) {
    errors.push({
      field: "legalMonetaryTotal.payableAmount",
      message: `Payable amount (${invoice.legalMonetaryTotal.payableAmount}) does not match tax inclusive - prepaid (${expectedPayable})`,
      code: "CALCULATION_MISMATCH",
    })
  }

  return errors
}

/**
 * Validates a complete e-invoice
 *
 * @param invoice - The invoice to validate
 * @returns Validation result with any errors found
 */
export function validateInvoice(invoice: EInvoice): ValidationResult {
  const errors: ValidationError[] = []

  // Validate invoice number
  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim().length === 0) {
    errors.push({
      field: "invoiceNumber",
      message: "Invoice number is required",
      code: "REQUIRED",
    })
  }

  // Validate issue date
  if (!invoice.issueDate || invoice.issueDate.trim().length === 0) {
    errors.push({
      field: "issueDate",
      message: "Issue date is required",
      code: "REQUIRED",
    })
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issueDate)) {
    errors.push({
      field: "issueDate",
      message: "Issue date must be in ISO 8601 format (YYYY-MM-DD)",
      code: "INVALID_FORMAT",
    })
  }

  // Validate due date
  if (!invoice.dueDate || invoice.dueDate.trim().length === 0) {
    errors.push({
      field: "dueDate",
      message: "Due date is required",
      code: "REQUIRED",
    })
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate)) {
    errors.push({
      field: "dueDate",
      message: "Due date must be in ISO 8601 format (YYYY-MM-DD)",
      code: "INVALID_FORMAT",
    })
  }

  // Validate currency code
  if (!invoice.currencyCode || invoice.currencyCode.trim().length === 0) {
    errors.push({
      field: "currencyCode",
      message: "Currency code is required",
      code: "REQUIRED",
    })
  } else if (!/^[A-Z]{3}$/.test(invoice.currencyCode)) {
    errors.push({
      field: "currencyCode",
      message: "Currency code must be a valid ISO 4217 code (e.g., EUR, USD)",
      code: "INVALID_FORMAT",
    })
  }

  // Validate seller
  errors.push(...validateParty(invoice.seller, "seller"))

  // Validate buyer
  errors.push(...validateParty(invoice.buyer, "buyer"))

  // Validate lines
  errors.push(...validateLines(invoice.lines))

  // Validate totals (only if lines are valid to avoid cascading errors)
  if (invoice.lines && invoice.lines.length > 0) {
    errors.push(...validateTotals(invoice))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
