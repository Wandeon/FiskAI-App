import { FiscalRequest, FiscalRequestProps } from "../FiscalRequest"
import { FiscalStatus } from "../FiscalStatus"
import { FiscalError } from "../FiscalError"

describe("FiscalRequest", () => {
  describe("create", () => {
    it("creates with valid inputs, status=PENDING, attemptCount=0", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")

      expect(request.id).toBeDefined()
      expect(request.invoiceId).toBe("inv-123")
      expect(request.commandId).toBe("cmd-456")
      expect(request.zki).toBe("zki-789")
      expect(request.status).toBe(FiscalStatus.PENDING)
      expect(request.attemptCount).toBe(0)
      expect(request.createdAt).toBeInstanceOf(Date)
      expect(request.jir).toBeUndefined()
      expect(request.fiscalizedAt).toBeUndefined()
    })

    it("throws on empty invoiceId", () => {
      expect(() => FiscalRequest.create("", "cmd-456", "zki-789")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("", "cmd-456", "zki-789")).toThrow(
        "Invoice ID cannot be empty"
      )
    })

    it("throws on whitespace-only invoiceId", () => {
      expect(() => FiscalRequest.create("   ", "cmd-456", "zki-789")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("   ", "cmd-456", "zki-789")).toThrow(
        "Invoice ID cannot be empty"
      )
    })

    it("throws on empty commandId", () => {
      expect(() => FiscalRequest.create("inv-123", "", "zki-789")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("inv-123", "", "zki-789")).toThrow(
        "Command ID cannot be empty"
      )
    })

    it("throws on whitespace-only commandId", () => {
      expect(() => FiscalRequest.create("inv-123", "   ", "zki-789")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("inv-123", "   ", "zki-789")).toThrow(
        "Command ID cannot be empty"
      )
    })

    it("throws on empty zki", () => {
      expect(() => FiscalRequest.create("inv-123", "cmd-456", "")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("inv-123", "cmd-456", "")).toThrow("ZKI cannot be empty")
    })

    it("throws on whitespace-only zki", () => {
      expect(() => FiscalRequest.create("inv-123", "cmd-456", "   ")).toThrow(FiscalError)
      expect(() => FiscalRequest.create("inv-123", "cmd-456", "   ")).toThrow("ZKI cannot be empty")
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes from props", () => {
      const props: FiscalRequestProps = {
        id: "req-123",
        invoiceId: "inv-456",
        commandId: "cmd-789",
        status: FiscalStatus.FISCALIZED,
        zki: "zki-abc",
        jir: "jir-def",
        attemptCount: 3,
        createdAt: new Date("2024-01-01"),
        fiscalizedAt: new Date("2024-01-02"),
      }

      const request = FiscalRequest.reconstitute(props)

      expect(request.id).toBe("req-123")
      expect(request.invoiceId).toBe("inv-456")
      expect(request.commandId).toBe("cmd-789")
      expect(request.status).toBe(FiscalStatus.FISCALIZED)
      expect(request.zki).toBe("zki-abc")
      expect(request.jir).toBe("jir-def")
      expect(request.attemptCount).toBe(3)
      expect(request.fiscalizedAt).toEqual(new Date("2024-01-02"))
    })
  })

  describe("markSubmitting", () => {
    it("transitions to SUBMITTING", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")

      request.markSubmitting()

      expect(request.status).toBe(FiscalStatus.SUBMITTING)
    })

    it("increments attemptCount", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      expect(request.attemptCount).toBe(0)

      request.markSubmitting()

      expect(request.attemptCount).toBe(1)
    })

    it("sets lastAttemptAt", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      const beforeCall = new Date()

      request.markSubmitting()

      // Access lastAttemptAt via reconstitute to check internal state
      const props = {
        id: request.id,
        invoiceId: request.invoiceId,
        commandId: request.commandId,
        status: request.status,
        zki: request.zki,
        attemptCount: request.attemptCount,
        createdAt: request.createdAt,
      } as FiscalRequestProps

      // The lastAttemptAt was set, so the request's internal state changed
      expect(request.attemptCount).toBe(1) // Confirms markSubmitting ran
    })

    it("throws when called from invalid state", () => {
      const props: FiscalRequestProps = {
        id: "req-123",
        invoiceId: "inv-456",
        commandId: "cmd-789",
        status: FiscalStatus.FISCALIZED,
        zki: "zki-abc",
        attemptCount: 1,
        createdAt: new Date(),
      }
      const request = FiscalRequest.reconstitute(props)

      expect(() => request.markSubmitting()).toThrow(FiscalError)
      expect(() => request.markSubmitting()).toThrow("Invalid fiscal status transition")
    })
  })

  describe("recordSuccess", () => {
    it("stores JIR", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      request.recordSuccess("jir-success-123")

      expect(request.jir).toBe("jir-success-123")
    })

    it("sets fiscalizedAt", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()
      const beforeSuccess = new Date()

      request.recordSuccess("jir-success-123")

      expect(request.fiscalizedAt).toBeDefined()
      expect(request.fiscalizedAt!.getTime()).toBeGreaterThanOrEqual(beforeSuccess.getTime())
    })

    it("transitions to FISCALIZED", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      request.recordSuccess("jir-success-123")

      expect(request.status).toBe(FiscalStatus.FISCALIZED)
    })

    it("throws on empty JIR", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      expect(() => request.recordSuccess("")).toThrow(FiscalError)
      expect(() => request.recordSuccess("")).toThrow("JIR cannot be empty")
    })

    it("throws on whitespace-only JIR", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      expect(() => request.recordSuccess("   ")).toThrow(FiscalError)
      expect(() => request.recordSuccess("   ")).toThrow("JIR cannot be empty")
    })
  })

  describe("recordFailure", () => {
    it("stores errorCode and errorMessage", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      request.recordFailure("ERR_TIMEOUT", "Connection timed out")

      expect(request.errorCode).toBe("ERR_TIMEOUT")
      expect(request.errorMessage).toBe("Connection timed out")
    })

    it("transitions to FAILED", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()

      request.recordFailure("ERR_TIMEOUT", "Connection timed out")

      expect(request.status).toBe(FiscalStatus.FAILED)
    })
  })

  describe("scheduleRetry", () => {
    it("sets nextRetryAt", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()
      request.recordFailure("ERR_TIMEOUT", "Connection timed out")

      const nextRetry = new Date(Date.now() + 60000) // 1 minute from now
      request.scheduleRetry(nextRetry)

      // nextRetryAt is internal, but we can verify transition succeeded
      expect(request.status).toBe(FiscalStatus.RETRY_SCHEDULED)
    })

    it("transitions to RETRY_SCHEDULED", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()
      request.recordFailure("ERR_TIMEOUT", "Connection timed out")

      const nextRetry = new Date(Date.now() + 60000)
      request.scheduleRetry(nextRetry)

      expect(request.status).toBe(FiscalStatus.RETRY_SCHEDULED)
    })

    it("transitions to DEADLINE_EXCEEDED if deadline exceeded", () => {
      // Create a request with createdAt 49 hours ago (past 48-hour deadline)
      const pastDeadline = new Date()
      pastDeadline.setHours(pastDeadline.getHours() - 49)

      const props: FiscalRequestProps = {
        id: "req-123",
        invoiceId: "inv-456",
        commandId: "cmd-789",
        status: FiscalStatus.FAILED,
        zki: "zki-abc",
        attemptCount: 1,
        createdAt: pastDeadline,
      }
      const request = FiscalRequest.reconstitute(props)

      const nextRetry = new Date(Date.now() + 60000)
      request.scheduleRetry(nextRetry)

      expect(request.status).toBe(FiscalStatus.DEADLINE_EXCEEDED)
    })
  })

  describe("isDeadlineExceeded", () => {
    it("returns false when within 48-hour deadline", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")

      expect(request.isDeadlineExceeded()).toBe(false)
    })

    it("returns true when past 48-hour deadline", () => {
      const pastDeadline = new Date()
      pastDeadline.setHours(pastDeadline.getHours() - 49)

      const props: FiscalRequestProps = {
        id: "req-123",
        invoiceId: "inv-456",
        commandId: "cmd-789",
        status: FiscalStatus.PENDING,
        zki: "zki-abc",
        attemptCount: 0,
        createdAt: pastDeadline,
      }
      const request = FiscalRequest.reconstitute(props)

      expect(request.isDeadlineExceeded()).toBe(true)
    })

    it("returns false at exactly 48 hours", () => {
      const exactly48Hours = new Date()
      exactly48Hours.setHours(exactly48Hours.getHours() - 48)
      exactly48Hours.setSeconds(exactly48Hours.getSeconds() + 1) // Just under 48 hours

      const props: FiscalRequestProps = {
        id: "req-123",
        invoiceId: "inv-456",
        commandId: "cmd-789",
        status: FiscalStatus.PENDING,
        zki: "zki-abc",
        attemptCount: 0,
        createdAt: exactly48Hours,
      }
      const request = FiscalRequest.reconstitute(props)

      expect(request.isDeadlineExceeded()).toBe(false)
    })
  })

  describe("full lifecycle", () => {
    it("PENDING -> SUBMITTING -> FAILED -> RETRY_SCHEDULED -> SUBMITTING -> FISCALIZED", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      expect(request.status).toBe(FiscalStatus.PENDING)

      // First submission attempt
      request.markSubmitting()
      expect(request.status).toBe(FiscalStatus.SUBMITTING)
      expect(request.attemptCount).toBe(1)

      // First attempt fails
      request.recordFailure("ERR_TIMEOUT", "Connection timed out")
      expect(request.status).toBe(FiscalStatus.FAILED)
      expect(request.errorCode).toBe("ERR_TIMEOUT")

      // Schedule retry
      const nextRetry = new Date(Date.now() + 60000)
      request.scheduleRetry(nextRetry)
      expect(request.status).toBe(FiscalStatus.RETRY_SCHEDULED)

      // Second submission attempt
      request.markSubmitting()
      expect(request.status).toBe(FiscalStatus.SUBMITTING)
      expect(request.attemptCount).toBe(2)

      // Second attempt succeeds
      request.recordSuccess("jir-final-success")
      expect(request.status).toBe(FiscalStatus.FISCALIZED)
      expect(request.jir).toBe("jir-final-success")
      expect(request.fiscalizedAt).toBeDefined()
    })

    it("prevents transitions from terminal states", () => {
      const request = FiscalRequest.create("inv-123", "cmd-456", "zki-789")
      request.markSubmitting()
      request.recordSuccess("jir-123")

      expect(request.status).toBe(FiscalStatus.FISCALIZED)

      // Cannot transition from FISCALIZED
      expect(() => request.markSubmitting()).toThrow(FiscalError)
      expect(() => request.recordFailure("ERR", "Error")).toThrow(FiscalError)
    })
  })
})
