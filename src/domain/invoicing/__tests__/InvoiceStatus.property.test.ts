// src/domain/invoicing/__tests__/InvoiceStatus.property.test.ts
import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { Invoice } from "../Invoice"
import { InvoiceNumber } from "../InvoiceNumber"
import { InvoiceStatus, canTransition, isTerminal, getValidTransitions } from "../InvoiceStatus"
import { InvoiceLine } from "../InvoiceLine"
import { Money, Quantity, VatRate } from "@/domain/shared"

// Helper to create a valid invoice line
function createTestLine(): InvoiceLine {
  return InvoiceLine.create({
    description: "Test Item",
    quantity: Quantity.of(1),
    unitPrice: Money.fromString("100.00"),
    vatRate: VatRate.HR_STANDARD,
  })
}

// Helper to create a test invoice number
function createInvoiceNumber(): InvoiceNumber {
  return InvoiceNumber.create(1, 1, 1, 2025)
}

// Helper to create dates
function createDates(): { issueDate: Date; dueDate: Date } {
  return {
    issueDate: new Date("2025-01-01"),
    dueDate: new Date("2025-01-15"),
  }
}

describe("InvoiceStatus state machine property tests", () => {
  describe("transition matrix invariants", () => {
    it("terminal states have no outgoing transitions", () => {
      const terminalStates = [InvoiceStatus.CANCELED, InvoiceStatus.ARCHIVED]

      fc.assert(
        fc.property(fc.constantFrom(...terminalStates), (terminalStatus) => {
          const transitions = getValidTransitions(terminalStatus)
          expect(transitions).toHaveLength(0)
          expect(isTerminal(terminalStatus)).toBe(true)
        })
      )
    })

    it("non-terminal states have at least one outgoing transition", () => {
      const nonTerminalStates = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.PENDING_FISCALIZATION,
        InvoiceStatus.FISCALIZED,
        InvoiceStatus.SENT,
        InvoiceStatus.DELIVERED,
        InvoiceStatus.ACCEPTED,
      ]

      fc.assert(
        fc.property(fc.constantFrom(...nonTerminalStates), (status) => {
          const transitions = getValidTransitions(status)
          expect(transitions.length).toBeGreaterThan(0)
          expect(isTerminal(status)).toBe(false)
        })
      )
    })

    it("canTransition is consistent with getValidTransitions", () => {
      const allStatuses = Object.values(InvoiceStatus)

      fc.assert(
        fc.property(
          fc.constantFrom(...allStatuses),
          fc.constantFrom(...allStatuses),
          (from, to) => {
            const validTransitions = getValidTransitions(from)
            const can = canTransition(from, to)

            if (validTransitions.includes(to)) {
              expect(can).toBe(true)
            } else {
              expect(can).toBe(false)
            }
          }
        )
      )
    })
  })

  describe("invoice lifecycle invariants", () => {
    it("newly created invoice is always DRAFT with version 1", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (buyerId, sellerId) => {
            const invoice = Invoice.create(buyerId, sellerId)
            expect(invoice.status).toBe(InvoiceStatus.DRAFT)
            expect(invoice.version).toBe(1)
            expect(invoice.getLines()).toHaveLength(0)
          }
        )
      )
    })

    it("version always increments with state transitions", () => {
      // Test that each transition increments version
      const invoice = Invoice.create("buyer", "seller")
      const initialVersion = invoice.version

      invoice.addLine(createTestLine())
      expect(invoice.version).toBe(initialVersion + 1)

      const { issueDate, dueDate } = createDates()
      invoice.issue(createInvoiceNumber(), issueDate, dueDate)
      expect(invoice.version).toBe(initialVersion + 2)

      invoice.fiscalize("JIR-123", "ZKI-456")
      expect(invoice.version).toBe(initialVersion + 3)

      invoice.markSent()
      expect(invoice.version).toBe(initialVersion + 4)

      invoice.accept()
      expect(invoice.version).toBe(initialVersion + 5)

      invoice.archive()
      expect(invoice.version).toBe(initialVersion + 6)
    })

    it("draft-only operations fail after issuing", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      const { issueDate, dueDate } = createDates()
      invoice.issue(createInvoiceNumber(), issueDate, dueDate)

      // All draft-only operations should fail
      expect(() => invoice.addLine(createTestLine())).toThrow()
      expect(() => invoice.updateBuyer("new-buyer")).toThrow()
      expect(() => invoice.cancel()).toThrow()
    })

    it("fiscalized invoice always has JIR and ZKI", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (jir, zki) => {
            // Skip whitespace-only strings
            if (!jir.trim() || !zki.trim()) return

            const invoice = Invoice.create("buyer", "seller")
            invoice.addLine(createTestLine())
            const { issueDate, dueDate } = createDates()
            invoice.issue(createInvoiceNumber(), issueDate, dueDate)
            invoice.fiscalize(jir, zki)

            expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)
            expect(invoice.jir).toBe(jir)
            expect(invoice.zki).toBe(zki)
            expect(invoice.fiscalizedAt).toBeDefined()
          }
        )
      )
    })

    it("empty or whitespace JIR/ZKI are rejected", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("", " ", "  ", "\t", "\n"),
          fc.string({ minLength: 1 }),
          (emptyJir, validZki) => {
            const invoice = Invoice.create("buyer", "seller")
            invoice.addLine(createTestLine())
            const { issueDate, dueDate } = createDates()
            invoice.issue(createInvoiceNumber(), issueDate, dueDate)

            expect(() => invoice.fiscalize(emptyJir, validZki)).toThrow()
          }
        )
      )
    })
  })

  describe("happy path variations", () => {
    it("DRAFT -> PENDING -> FISCALIZED -> SENT -> ACCEPTED -> ARCHIVED is valid", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())

      expect(invoice.status).toBe(InvoiceStatus.DRAFT)

      const { issueDate, dueDate } = createDates()
      invoice.issue(createInvoiceNumber(), issueDate, dueDate)
      expect(invoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)

      invoice.fiscalize("JIR", "ZKI")
      expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)

      invoice.markSent()
      expect(invoice.status).toBe(InvoiceStatus.SENT)

      invoice.accept()
      expect(invoice.status).toBe(InvoiceStatus.ACCEPTED)

      invoice.archive()
      expect(invoice.status).toBe(InvoiceStatus.ARCHIVED)
      expect(isTerminal(invoice.status)).toBe(true)
    })

    it("path through DELIVERED is also valid", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      const { issueDate, dueDate } = createDates()
      invoice.issue(createInvoiceNumber(), issueDate, dueDate)
      invoice.fiscalize("JIR", "ZKI")
      invoice.markSent()

      invoice.markDelivered()
      expect(invoice.status).toBe(InvoiceStatus.DELIVERED)

      invoice.accept()
      expect(invoice.status).toBe(InvoiceStatus.ACCEPTED)

      invoice.archive()
      expect(invoice.status).toBe(InvoiceStatus.ARCHIVED)
    })

    it("DRAFT can be canceled", () => {
      const invoice = Invoice.create("buyer", "seller")
      expect(invoice.status).toBe(InvoiceStatus.DRAFT)

      invoice.cancel()
      expect(invoice.status).toBe(InvoiceStatus.CANCELED)
      expect(isTerminal(invoice.status)).toBe(true)
    })
  })

  describe("calculation invariants", () => {
    it("grossTotal always equals netTotal plus vatTotal", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }),
          (centAmounts) => {
            const invoice = Invoice.create("buyer", "seller")

            for (const cents of centAmounts) {
              invoice.addLine(
                InvoiceLine.create({
                  description: "Item",
                  quantity: Quantity.of(1),
                  unitPrice: Money.fromCents(cents),
                  vatRate: VatRate.HR_STANDARD,
                })
              )
            }

            const net = invoice.netTotal()
            const vat = invoice.vatTotal()
            const gross = invoice.grossTotal()

            expect(net.add(vat).equals(gross)).toBe(true)
          }
        )
      )
    })

    it("empty invoice has zero totals", () => {
      const invoice = Invoice.create("buyer", "seller")
      expect(invoice.netTotal().isZero()).toBe(true)
      expect(invoice.vatTotal().isZero()).toBe(true)
      expect(invoice.grossTotal().isZero()).toBe(true)
    })
  })

  describe("immutability invariants", () => {
    it("getLines returns a defensive copy", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())

      const lines1 = invoice.getLines()
      const lines2 = invoice.getLines()

      // Different array references
      expect(lines1).not.toBe(lines2)
      // But same content
      expect(lines1).toEqual(lines2)
    })
  })
})
