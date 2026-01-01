import { describe, it, expect } from "vitest"
import { InvoiceStatus, canTransition, isTerminal, getValidTransitions } from "../InvoiceStatus"

describe("InvoiceStatus", () => {
  describe("canTransition", () => {
    describe("DRAFT transitions", () => {
      it("allows DRAFT -> PENDING_FISCALIZATION", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.PENDING_FISCALIZATION)).toBe(true)
      })

      it("allows DRAFT -> CANCELED", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.CANCELED)).toBe(true)
      })

      it("disallows DRAFT -> FISCALIZED", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.FISCALIZED)).toBe(false)
      })

      it("disallows DRAFT -> SENT", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.SENT)).toBe(false)
      })

      it("disallows DRAFT -> DELIVERED", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.DELIVERED)).toBe(false)
      })

      it("disallows DRAFT -> ACCEPTED", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.ACCEPTED)).toBe(false)
      })

      it("disallows DRAFT -> ARCHIVED", () => {
        expect(canTransition(InvoiceStatus.DRAFT, InvoiceStatus.ARCHIVED)).toBe(false)
      })
    })

    describe("PENDING_FISCALIZATION transitions", () => {
      it("allows PENDING_FISCALIZATION -> FISCALIZED", () => {
        expect(canTransition(InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.FISCALIZED)).toBe(
          true
        )
      })

      it("allows PENDING_FISCALIZATION -> DRAFT (rollback)", () => {
        expect(canTransition(InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.DRAFT)).toBe(true)
      })

      it("disallows PENDING_FISCALIZATION -> SENT", () => {
        expect(canTransition(InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.SENT)).toBe(false)
      })

      it("disallows PENDING_FISCALIZATION -> CANCELED", () => {
        expect(canTransition(InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.CANCELED)).toBe(
          false
        )
      })
    })

    describe("FISCALIZED transitions", () => {
      it("allows FISCALIZED -> SENT", () => {
        expect(canTransition(InvoiceStatus.FISCALIZED, InvoiceStatus.SENT)).toBe(true)
      })

      it("disallows FISCALIZED -> DRAFT", () => {
        expect(canTransition(InvoiceStatus.FISCALIZED, InvoiceStatus.DRAFT)).toBe(false)
      })

      it("disallows FISCALIZED -> PENDING_FISCALIZATION", () => {
        expect(canTransition(InvoiceStatus.FISCALIZED, InvoiceStatus.PENDING_FISCALIZATION)).toBe(
          false
        )
      })

      it("disallows FISCALIZED -> DELIVERED", () => {
        expect(canTransition(InvoiceStatus.FISCALIZED, InvoiceStatus.DELIVERED)).toBe(false)
      })

      it("disallows FISCALIZED -> CANCELED", () => {
        expect(canTransition(InvoiceStatus.FISCALIZED, InvoiceStatus.CANCELED)).toBe(false)
      })
    })

    describe("SENT transitions", () => {
      it("allows SENT -> DELIVERED", () => {
        expect(canTransition(InvoiceStatus.SENT, InvoiceStatus.DELIVERED)).toBe(true)
      })

      it("allows SENT -> ACCEPTED", () => {
        expect(canTransition(InvoiceStatus.SENT, InvoiceStatus.ACCEPTED)).toBe(true)
      })

      it("disallows SENT -> DRAFT", () => {
        expect(canTransition(InvoiceStatus.SENT, InvoiceStatus.DRAFT)).toBe(false)
      })

      it("disallows SENT -> FISCALIZED", () => {
        expect(canTransition(InvoiceStatus.SENT, InvoiceStatus.FISCALIZED)).toBe(false)
      })

      it("disallows SENT -> ARCHIVED", () => {
        expect(canTransition(InvoiceStatus.SENT, InvoiceStatus.ARCHIVED)).toBe(false)
      })
    })

    describe("DELIVERED transitions", () => {
      it("allows DELIVERED -> ACCEPTED", () => {
        expect(canTransition(InvoiceStatus.DELIVERED, InvoiceStatus.ACCEPTED)).toBe(true)
      })

      it("disallows DELIVERED -> SENT", () => {
        expect(canTransition(InvoiceStatus.DELIVERED, InvoiceStatus.SENT)).toBe(false)
      })

      it("disallows DELIVERED -> ARCHIVED", () => {
        expect(canTransition(InvoiceStatus.DELIVERED, InvoiceStatus.ARCHIVED)).toBe(false)
      })
    })

    describe("ACCEPTED transitions", () => {
      it("allows ACCEPTED -> ARCHIVED", () => {
        expect(canTransition(InvoiceStatus.ACCEPTED, InvoiceStatus.ARCHIVED)).toBe(true)
      })

      it("disallows ACCEPTED -> CANCELED", () => {
        expect(canTransition(InvoiceStatus.ACCEPTED, InvoiceStatus.CANCELED)).toBe(false)
      })

      it("disallows ACCEPTED -> DRAFT", () => {
        expect(canTransition(InvoiceStatus.ACCEPTED, InvoiceStatus.DRAFT)).toBe(false)
      })
    })

    describe("CANCELED transitions (terminal state)", () => {
      it("disallows CANCELED -> DRAFT", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.DRAFT)).toBe(false)
      })

      it("disallows CANCELED -> PENDING_FISCALIZATION", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.PENDING_FISCALIZATION)).toBe(
          false
        )
      })

      it("disallows CANCELED -> FISCALIZED", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.FISCALIZED)).toBe(false)
      })

      it("disallows CANCELED -> SENT", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.SENT)).toBe(false)
      })

      it("disallows CANCELED -> DELIVERED", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.DELIVERED)).toBe(false)
      })

      it("disallows CANCELED -> ACCEPTED", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.ACCEPTED)).toBe(false)
      })

      it("disallows CANCELED -> ARCHIVED", () => {
        expect(canTransition(InvoiceStatus.CANCELED, InvoiceStatus.ARCHIVED)).toBe(false)
      })
    })

    describe("ARCHIVED transitions (terminal state)", () => {
      it("disallows ARCHIVED -> DRAFT", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.DRAFT)).toBe(false)
      })

      it("disallows ARCHIVED -> PENDING_FISCALIZATION", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.PENDING_FISCALIZATION)).toBe(
          false
        )
      })

      it("disallows ARCHIVED -> FISCALIZED", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.FISCALIZED)).toBe(false)
      })

      it("disallows ARCHIVED -> SENT", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.SENT)).toBe(false)
      })

      it("disallows ARCHIVED -> DELIVERED", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.DELIVERED)).toBe(false)
      })

      it("disallows ARCHIVED -> ACCEPTED", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.ACCEPTED)).toBe(false)
      })

      it("disallows ARCHIVED -> CANCELED", () => {
        expect(canTransition(InvoiceStatus.ARCHIVED, InvoiceStatus.CANCELED)).toBe(false)
      })
    })
  })

  describe("isTerminal", () => {
    it("returns true for CANCELED", () => {
      expect(isTerminal(InvoiceStatus.CANCELED)).toBe(true)
    })

    it("returns true for ARCHIVED", () => {
      expect(isTerminal(InvoiceStatus.ARCHIVED)).toBe(true)
    })

    it("returns false for DRAFT", () => {
      expect(isTerminal(InvoiceStatus.DRAFT)).toBe(false)
    })

    it("returns false for PENDING_FISCALIZATION", () => {
      expect(isTerminal(InvoiceStatus.PENDING_FISCALIZATION)).toBe(false)
    })

    it("returns false for FISCALIZED", () => {
      expect(isTerminal(InvoiceStatus.FISCALIZED)).toBe(false)
    })

    it("returns false for SENT", () => {
      expect(isTerminal(InvoiceStatus.SENT)).toBe(false)
    })

    it("returns false for DELIVERED", () => {
      expect(isTerminal(InvoiceStatus.DELIVERED)).toBe(false)
    })

    it("returns false for ACCEPTED", () => {
      expect(isTerminal(InvoiceStatus.ACCEPTED)).toBe(false)
    })
  })

  describe("getValidTransitions", () => {
    it("returns correct transitions for DRAFT", () => {
      const transitions = getValidTransitions(InvoiceStatus.DRAFT)
      expect(transitions).toEqual([InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.CANCELED])
    })

    it("returns correct transitions for PENDING_FISCALIZATION", () => {
      const transitions = getValidTransitions(InvoiceStatus.PENDING_FISCALIZATION)
      expect(transitions).toEqual([InvoiceStatus.FISCALIZED, InvoiceStatus.DRAFT])
    })

    it("returns correct transitions for FISCALIZED", () => {
      const transitions = getValidTransitions(InvoiceStatus.FISCALIZED)
      expect(transitions).toEqual([InvoiceStatus.SENT])
    })

    it("returns correct transitions for SENT", () => {
      const transitions = getValidTransitions(InvoiceStatus.SENT)
      expect(transitions).toEqual([InvoiceStatus.DELIVERED, InvoiceStatus.ACCEPTED])
    })

    it("returns correct transitions for DELIVERED", () => {
      const transitions = getValidTransitions(InvoiceStatus.DELIVERED)
      expect(transitions).toEqual([InvoiceStatus.ACCEPTED])
    })

    it("returns correct transitions for ACCEPTED", () => {
      const transitions = getValidTransitions(InvoiceStatus.ACCEPTED)
      expect(transitions).toEqual([InvoiceStatus.ARCHIVED])
    })

    it("returns empty array for CANCELED (terminal)", () => {
      const transitions = getValidTransitions(InvoiceStatus.CANCELED)
      expect(transitions).toEqual([])
    })

    it("returns empty array for ARCHIVED (terminal)", () => {
      const transitions = getValidTransitions(InvoiceStatus.ARCHIVED)
      expect(transitions).toEqual([])
    })

    it("returns a copy of the array, not the original", () => {
      const transitions1 = getValidTransitions(InvoiceStatus.DRAFT)
      const transitions2 = getValidTransitions(InvoiceStatus.DRAFT)
      expect(transitions1).not.toBe(transitions2)
      expect(transitions1).toEqual(transitions2)
    })
  })
})
