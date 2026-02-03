import type { Capabilities } from "./capabilities"

export interface InvoiceVisibility {
  showVatFields: boolean
  requireOib: boolean
}

/** Accepts full Capabilities or serializable version (without `can` function) */
export function getInvoiceVisibility(
  capabilities: Pick<Capabilities, "visibility">
): InvoiceVisibility {
  return {
    showVatFields: capabilities.visibility.requireVatFields,
    requireOib: capabilities.visibility.requireOib,
  }
}
