import { describe, it, expect } from "vitest"
import {
  shouldFiscalize,
  getFiscalizationSkipReason,
  PaymentMethod,
  type FiscalizationContext,
} from "../ShouldFiscalize"

describe("ShouldFiscalize", () => {
  const validContext: FiscalizationContext = {
    paymentMethod: PaymentMethod.CASH,
    isFiscalizationEnabled: true,
    hasCertificate: true,
    isCertificateValid: true,
  }

  describe("shouldFiscalize", () => {
    it("returns true for CASH payment with valid certificate", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.CASH,
      }

      expect(shouldFiscalize(ctx)).toBe(true)
    })

    it("returns true for CARD payment with valid certificate", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.CARD,
      }

      expect(shouldFiscalize(ctx)).toBe(true)
    })

    it("returns false for TRANSFER payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.TRANSFER,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false for CHECK payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.CHECK,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false for OTHER payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.OTHER,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false when fiscalization not enabled", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        isFiscalizationEnabled: false,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false when no certificate", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        hasCertificate: false,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false when certificate invalid", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        isCertificateValid: false,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })

    it("returns false when both hasCertificate and isCertificateValid are false", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        hasCertificate: false,
        isCertificateValid: false,
      }

      expect(shouldFiscalize(ctx)).toBe(false)
    })
  })

  describe("getFiscalizationSkipReason", () => {
    it("returns null when fiscalization is required", () => {
      expect(getFiscalizationSkipReason(validContext)).toBe(null)
    })

    it("returns reason when fiscalization not enabled", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        isFiscalizationEnabled: false,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe("Fiscalization not enabled for company")
    })

    it("returns reason for TRANSFER payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.TRANSFER,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe(
        `Payment method ${PaymentMethod.TRANSFER} does not require fiscalization`
      )
    })

    it("returns reason for CHECK payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.CHECK,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe(
        `Payment method ${PaymentMethod.CHECK} does not require fiscalization`
      )
    })

    it("returns reason for OTHER payment", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        paymentMethod: PaymentMethod.OTHER,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe(
        `Payment method ${PaymentMethod.OTHER} does not require fiscalization`
      )
    })

    it("returns reason when no certificate", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        hasCertificate: false,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe("No fiscalization certificate configured")
    })

    it("returns reason when certificate invalid", () => {
      const ctx: FiscalizationContext = {
        ...validContext,
        isCertificateValid: false,
      }

      expect(getFiscalizationSkipReason(ctx)).toBe(
        "Fiscalization certificate is expired or invalid"
      )
    })

    it("returns first applicable reason (fiscalization disabled takes priority)", () => {
      const ctx: FiscalizationContext = {
        paymentMethod: PaymentMethod.TRANSFER,
        isFiscalizationEnabled: false,
        hasCertificate: false,
        isCertificateValid: false,
      }

      // Fiscalization disabled should be checked first
      expect(getFiscalizationSkipReason(ctx)).toBe("Fiscalization not enabled for company")
    })
  })

  describe("PaymentMethod enum", () => {
    it("has correct values for Croatian fiscalization", () => {
      expect(PaymentMethod.CASH).toBe("G") // Gotovina
      expect(PaymentMethod.CARD).toBe("K") // Kartica
      expect(PaymentMethod.TRANSFER).toBe("T") // Transakcijski racun
      expect(PaymentMethod.CHECK).toBe("C") // Cek
      expect(PaymentMethod.OTHER).toBe("O") // Ostalo
    })
  })
})
