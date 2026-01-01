export enum PaymentMethod {
  CASH = "G", // Gotovina
  CARD = "K", // Kartica
  TRANSFER = "T", // Transakcijski racun
  CHECK = "C", // Cek
  OTHER = "O", // Ostalo
}

export interface FiscalizationContext {
  paymentMethod: PaymentMethod
  isFiscalizationEnabled: boolean
  hasCertificate: boolean
  isCertificateValid: boolean
}

/**
 * Pure domain logic to determine if an invoice requires fiscalization.
 * Per Croatian law, only CASH and CARD payments require fiscalization.
 */
export function shouldFiscalize(ctx: FiscalizationContext): boolean {
  if (!ctx.isFiscalizationEnabled) {
    return false
  }

  if (ctx.paymentMethod !== PaymentMethod.CASH && ctx.paymentMethod !== PaymentMethod.CARD) {
    return false
  }

  if (!ctx.hasCertificate || !ctx.isCertificateValid) {
    return false
  }

  return true
}

/**
 * Returns reason why fiscalization is not required.
 */
export function getFiscalizationSkipReason(ctx: FiscalizationContext): string | null {
  if (!ctx.isFiscalizationEnabled) {
    return "Fiscalization not enabled for company"
  }
  if (ctx.paymentMethod !== PaymentMethod.CASH && ctx.paymentMethod !== PaymentMethod.CARD) {
    return `Payment method ${ctx.paymentMethod} does not require fiscalization`
  }
  if (!ctx.hasCertificate) {
    return "No fiscalization certificate configured"
  }
  if (!ctx.isCertificateValid) {
    return "Fiscalization certificate is expired or invalid"
  }
  return null
}
