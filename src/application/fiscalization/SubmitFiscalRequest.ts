import { FiscalRequest, FiscalRequestRepository } from "@/domain/fiscalization"

export interface FiscalService {
  submit(request: FiscalRequest): Promise<string> // Returns JIR
}

export interface SubmitFiscalRequestInput {
  invoiceId: string
  commandId: string // Idempotency key - client provides this
  zki: string
}

export interface SubmitFiscalRequestOutput {
  requestId: string
  jir?: string
  status: string
  isNew: boolean // False if returning cached result (idempotent)
}

export class SubmitFiscalRequest {
  constructor(
    private readonly repo: FiscalRequestRepository,
    private readonly fiscalService: FiscalService
  ) {}

  async execute(input: SubmitFiscalRequestInput): Promise<SubmitFiscalRequestOutput> {
    // Check for existing request with same commandId (idempotency)
    const existing = await this.repo.findByCommandId(input.commandId)
    if (existing) {
      // Return existing result - idempotent
      return {
        requestId: existing.id,
        jir: existing.jir,
        status: existing.status,
        isNew: false,
      }
    }

    // Create new request
    const request = FiscalRequest.create(input.invoiceId, input.commandId, input.zki)
    await this.repo.save(request)

    // Submit to fiscal service
    try {
      request.markSubmitting()
      await this.repo.save(request)

      const jir = await this.fiscalService.submit(request)
      request.recordSuccess(jir)
      await this.repo.save(request)

      return {
        requestId: request.id,
        jir: request.jir,
        status: request.status,
        isNew: true,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      request.recordFailure("SUBMIT_ERROR", message)
      await this.repo.save(request)

      return {
        requestId: request.id,
        status: request.status,
        isNew: true,
      }
    }
  }
}
