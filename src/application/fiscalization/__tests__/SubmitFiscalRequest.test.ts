import { describe, it, expect, vi } from "vitest"
import { SubmitFiscalRequest, FiscalService } from "../SubmitFiscalRequest"
import { FiscalRequest, FiscalStatus, FiscalRequestRepository } from "@/domain/fiscalization"

describe("SubmitFiscalRequest", () => {
  const createMockRepo = (): FiscalRequestRepository => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByCommandId: vi.fn().mockResolvedValue(null),
    findByInvoiceId: vi.fn().mockResolvedValue([]),
    findPendingRetries: vi.fn().mockResolvedValue([]),
  })

  const createMockService = (jir: string): FiscalService => ({
    submit: vi.fn().mockResolvedValue(jir),
  })

  const input = {
    invoiceId: "inv-123",
    commandId: "cmd-456",
    zki: "ABC123DEF456",
  }

  it("creates new request and submits to fiscal service", async () => {
    const repo = createMockRepo()
    const service = createMockService("JIR-789")
    const useCase = new SubmitFiscalRequest(repo, service)

    const result = await useCase.execute(input)

    expect(result.isNew).toBe(true)
    expect(result.jir).toBe("JIR-789")
    expect(result.status).toBe(FiscalStatus.FISCALIZED)
    expect(service.submit).toHaveBeenCalledTimes(1)
    expect(repo.save).toHaveBeenCalledTimes(3) // create, submitting, success
  })

  it("returns existing result for duplicate commandId (idempotent)", async () => {
    const existing = FiscalRequest.create("inv-123", "cmd-456", "ABC123")
    // Simulate already fiscalized
    existing.markSubmitting()
    existing.recordSuccess("EXISTING-JIR")

    const repo = createMockRepo()
    repo.findByCommandId = vi.fn().mockResolvedValue(existing)
    const service = createMockService("NEW-JIR")
    const useCase = new SubmitFiscalRequest(repo, service)

    const result = await useCase.execute(input)

    expect(result.isNew).toBe(false)
    expect(result.jir).toBe("EXISTING-JIR")
    expect(service.submit).not.toHaveBeenCalled()
    expect(repo.save).not.toHaveBeenCalled()
  })

  it("handles fiscal service failure", async () => {
    const repo = createMockRepo()
    const service: FiscalService = {
      submit: vi.fn().mockRejectedValue(new Error("Connection timeout")),
    }
    const useCase = new SubmitFiscalRequest(repo, service)

    const result = await useCase.execute(input)

    expect(result.isNew).toBe(true)
    expect(result.jir).toBeUndefined()
    expect(result.status).toBe(FiscalStatus.FAILED)
    expect(repo.save).toHaveBeenCalledTimes(3) // create, submitting, failure
  })
})
