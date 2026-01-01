# Application Layer

Use cases and application services that orchestrate domain logic.

## Purpose

Contains application-specific business rules and use cases. This layer orchestrates
the flow of data between the outside world and the domain, coordinating the work
needed to fulfill a specific user goal.

## Import Rules

- **CAN import:** Domain layer (`src/domain/*`)
- **CANNOT import:** Infrastructure (`src/infrastructure/*`), Interfaces (`src/interfaces/*`), `@prisma/client`, `next`, `react`

## Structure

- `invoicing/` - Invoice creation, updates, listing use cases
- `tax/` - VAT calculation and reporting use cases
- `fiscalization/` - Fiscal submission and status tracking use cases
- `banking/` - Bank reconciliation and transaction use cases
- `compliance/` - Deadline checking and compliance reporting use cases

## Principles

1. **Use Cases**: Each file represents a single use case (e.g., `CreateInvoiceUseCase`)
2. **Dependency Injection**: Receive repository interfaces, not concrete implementations
3. **Transaction Boundaries**: Define where transactions begin and end
4. **No Framework Dependencies**: Pure TypeScript, no Next.js or React
5. **DTOs**: Define input/output data transfer objects for each use case

## Example

```typescript
// src/application/invoicing/CreateInvoiceUseCase.ts
import { Invoice, InvoiceItem } from "../../domain/invoicing/Invoice"
import { Money } from "../../domain/shared/Money"
import { VatRate } from "../../domain/shared/VatRate"

// Input DTO - what the use case receives
export interface CreateInvoiceInput {
  tenantId: string
  customerId: string
  items: Array<{
    description: string
    quantity: number
    unitPriceCents: number
    vatRatePercent: number
  }>
}

// Output DTO - what the use case returns
export interface CreateInvoiceOutput {
  invoiceId: string
  totalNet: number
  totalVat: number
  totalGross: number
}

// Repository interface - defined here, implemented in infrastructure
export interface InvoiceRepository {
  nextId(): Promise<string>
  save(invoice: Invoice): Promise<void>
}

export class CreateInvoiceUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    // Transform input DTOs to domain objects
    const items: InvoiceItem[] = input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Money.fromCents(item.unitPriceCents),
      vatRate: VatRate.fromPercent(item.vatRatePercent),
    }))

    // Create domain entity
    const invoiceId = await this.invoiceRepository.nextId()
    const invoice = Invoice.create(invoiceId, items)

    // Persist through repository
    await this.invoiceRepository.save(invoice)

    // Return output DTO
    return {
      invoiceId: invoice.id,
      totalNet: invoice.totalNet.toNumber(),
      totalVat: invoice.totalVat.toNumber(),
      totalGross: invoice.totalGross.toNumber(),
    }
  }
}
```

```typescript
// src/application/fiscalization/SubmitFiscalRequestUseCase.ts
import { FiscalRequest, FiscalStatus } from "../../domain/fiscalization/FiscalRequest"

export interface FiscalRequestRepository {
  findById(id: string): Promise<FiscalRequest | null>
  save(request: FiscalRequest): Promise<void>
}

// Port for external fiscal service - interface defined here
export interface FiscalService {
  submit(request: FiscalRequest): Promise<{ jir: string } | { error: string }>
}

export class SubmitFiscalRequestUseCase {
  constructor(
    private readonly fiscalRequestRepository: FiscalRequestRepository,
    private readonly fiscalService: FiscalService
  ) {}

  async execute(requestId: string): Promise<{ success: boolean; jir?: string; error?: string }> {
    const request = await this.fiscalRequestRepository.findById(requestId)
    if (!request) {
      throw new Error(`Fiscal request ${requestId} not found`)
    }

    const result = await this.fiscalService.submit(request)

    if ("jir" in result) {
      request.markAsCompleted(result.jir)
      await this.fiscalRequestRepository.save(request)
      return { success: true, jir: result.jir }
    } else {
      request.markAsFailed(result.error)
      await this.fiscalRequestRepository.save(request)
      return { success: false, error: result.error }
    }
  }
}
```

## Testing

Use cases should be tested with mock repositories and services.

```typescript
describe("CreateInvoiceUseCase", () => {
  it("creates an invoice and returns totals", async () => {
    const mockRepo: InvoiceRepository = {
      nextId: async () => "inv-123",
      save: async () => {},
    }

    const useCase = new CreateInvoiceUseCase(mockRepo)
    const result = await useCase.execute({
      tenantId: "tenant-1",
      customerId: "customer-1",
      items: [{ description: "Widget", quantity: 2, unitPriceCents: 1000, vatRatePercent: 25 }],
    })

    expect(result.invoiceId).toBe("inv-123")
    expect(result.totalNet).toBe(20)
    expect(result.totalVat).toBe(5)
    expect(result.totalGross).toBe(25)
  })
})
```
