/**
 * E-Invoice Library
 *
 * A comprehensive library for Croatian e-invoicing with UBL 2.1 XML generation,
 * OIB validation, and invoice validation.
 *
 * @module einvoice
 *
 * @example
 * ```typescript
 * import { validateInvoice, generateUBLInvoice, validateOIB } from '@/lib/einvoice';
 *
 * // Validate an OIB
 * const isValid = validateOIB('12345678901');
 *
 * // Validate an invoice
 * const result = validateInvoice(myInvoice);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 *
 * // Generate UBL XML
 * const xml = generateUBLInvoice(myInvoice);
 * ```
 */

// Export all types
export type {
  EInvoice,
  Party,
  Address,
  InvoiceLine,
  TaxCategoryCode,
  TaxCategory,
  TaxTotal,
  TaxSubtotal,
  MonetaryTotal,
} from "./types"

export { CROATIAN_VAT_RATES } from "./types"

// Export validation functions and types
export type { ValidationError, ValidationResult } from "./validators"

export {
  validateOIB,
  validateParty,
  validateLines,
  validateTotals,
  validateInvoice,
} from "./validators"

// Export generator functions and types
export type { GeneratorOptions } from "./generator"

export { generateUBLInvoice, generateMinimalUBLInvoice } from "./generator"
