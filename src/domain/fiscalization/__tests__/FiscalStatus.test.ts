import {
  FiscalStatus,
  canTransitionFiscal,
  isTerminalFiscal,
  getValidFiscalTransitions,
} from "../FiscalStatus"

describe("FiscalStatus", () => {
  describe("canTransitionFiscal", () => {
    describe("allowed transitions", () => {
      it("PENDING -> SUBMITTING is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.PENDING, FiscalStatus.SUBMITTING)).toBe(true)
      })

      it("PENDING -> FAILED is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.PENDING, FiscalStatus.FAILED)).toBe(true)
      })

      it("SUBMITTING -> FISCALIZED is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.SUBMITTING, FiscalStatus.FISCALIZED)).toBe(true)
      })

      it("SUBMITTING -> FAILED is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.SUBMITTING, FiscalStatus.FAILED)).toBe(true)
      })

      it("FAILED -> RETRY_SCHEDULED is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.FAILED, FiscalStatus.RETRY_SCHEDULED)).toBe(true)
      })

      it("FAILED -> DEADLINE_EXCEEDED is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.FAILED, FiscalStatus.DEADLINE_EXCEEDED)).toBe(true)
      })

      it("RETRY_SCHEDULED -> SUBMITTING is allowed", () => {
        expect(canTransitionFiscal(FiscalStatus.RETRY_SCHEDULED, FiscalStatus.SUBMITTING)).toBe(
          true
        )
      })
    })

    describe("disallowed transitions from terminal states", () => {
      const allStatuses = Object.values(FiscalStatus)

      it("NOT_REQUIRED -> any is NOT allowed", () => {
        allStatuses.forEach((status) => {
          expect(canTransitionFiscal(FiscalStatus.NOT_REQUIRED, status)).toBe(false)
        })
      })

      it("FISCALIZED -> any is NOT allowed", () => {
        allStatuses.forEach((status) => {
          expect(canTransitionFiscal(FiscalStatus.FISCALIZED, status)).toBe(false)
        })
      })

      it("DEADLINE_EXCEEDED -> any is NOT allowed", () => {
        allStatuses.forEach((status) => {
          expect(canTransitionFiscal(FiscalStatus.DEADLINE_EXCEEDED, status)).toBe(false)
        })
      })
    })
  })

  describe("isTerminalFiscal", () => {
    describe("terminal states", () => {
      it("NOT_REQUIRED is terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.NOT_REQUIRED)).toBe(true)
      })

      it("FISCALIZED is terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.FISCALIZED)).toBe(true)
      })

      it("DEADLINE_EXCEEDED is terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.DEADLINE_EXCEEDED)).toBe(true)
      })
    })

    describe("non-terminal states", () => {
      it("PENDING is NOT terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.PENDING)).toBe(false)
      })

      it("SUBMITTING is NOT terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.SUBMITTING)).toBe(false)
      })

      it("FAILED is NOT terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.FAILED)).toBe(false)
      })

      it("RETRY_SCHEDULED is NOT terminal", () => {
        expect(isTerminalFiscal(FiscalStatus.RETRY_SCHEDULED)).toBe(false)
      })
    })
  })

  describe("getValidFiscalTransitions", () => {
    it("returns valid transitions for PENDING", () => {
      const transitions = getValidFiscalTransitions(FiscalStatus.PENDING)
      expect(transitions).toEqual([FiscalStatus.SUBMITTING, FiscalStatus.FAILED])
    })

    it("returns valid transitions for SUBMITTING", () => {
      const transitions = getValidFiscalTransitions(FiscalStatus.SUBMITTING)
      expect(transitions).toEqual([FiscalStatus.FISCALIZED, FiscalStatus.FAILED])
    })

    it("returns valid transitions for FAILED", () => {
      const transitions = getValidFiscalTransitions(FiscalStatus.FAILED)
      expect(transitions).toEqual([FiscalStatus.RETRY_SCHEDULED, FiscalStatus.DEADLINE_EXCEEDED])
    })

    it("returns valid transitions for RETRY_SCHEDULED", () => {
      const transitions = getValidFiscalTransitions(FiscalStatus.RETRY_SCHEDULED)
      expect(transitions).toEqual([FiscalStatus.SUBMITTING])
    })

    it("returns empty array for terminal states", () => {
      expect(getValidFiscalTransitions(FiscalStatus.NOT_REQUIRED)).toEqual([])
      expect(getValidFiscalTransitions(FiscalStatus.FISCALIZED)).toEqual([])
      expect(getValidFiscalTransitions(FiscalStatus.DEADLINE_EXCEEDED)).toEqual([])
    })

    it("returns a copy, not the original array", () => {
      const transitions1 = getValidFiscalTransitions(FiscalStatus.PENDING)
      const transitions2 = getValidFiscalTransitions(FiscalStatus.PENDING)
      expect(transitions1).not.toBe(transitions2)
      expect(transitions1).toEqual(transitions2)
    })
  })
})
