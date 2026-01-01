# Infrastructure Layer

Technical implementations of domain interfaces and external integrations.

## Purpose

Contains all technical details: database access, external API clients, file system
operations, and other I/O concerns. This layer implements the interfaces defined
in the domain and application layers.

## Import Rules

- **CAN import:** Domain layer (`src/domain/*`), Application layer interfaces
- **CANNOT import:** Interfaces layer (`src/interfaces/*`)
- **CAN use:** `@prisma/client`, external API clients, file system, environment variables

## Structure

- `persistence/` - Prisma repositories implementing domain repository interfaces
- `fiscal/` - XML building, certificate signing, Porezna (Croatian Tax Authority) client
- `banking/` - CSV parsers for bank statements, GoCardless integration
- `mappers/` - Bidirectional conversion between DB models and domain entities

## Principles

1. **Implement Domain Interfaces**: Repositories defined in domain are implemented here
2. **Adapter Pattern**: Wrap external APIs behind clean interfaces
3. **Mappers**: Keep DB schema separate from domain model
4. **Error Translation**: Convert external errors to domain exceptions
5. **Configuration**: Read environment variables, connection strings here

## Example

```typescript
// src/infrastructure/persistence/PrismaInvoiceRepository.ts
import { PrismaClient } from "@prisma/client"
import { Invoice } from "../../domain/invoicing/Invoice"
import { InvoiceRepository } from "../../application/invoicing/CreateInvoiceUseCase"
import { InvoiceMapper } from "../mappers/InvoiceMapper"

export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async nextId(): Promise<string> {
    // Generate a unique ID (could use UUID, ULID, or database sequence)
    return `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async save(invoice: Invoice): Promise<void> {
    const data = InvoiceMapper.toPersistence(invoice)

    await this.prisma.invoice.upsert({
      where: { id: invoice.id },
      create: data,
      update: data,
    })
  }

  async findById(id: string): Promise<Invoice | null> {
    const record = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!record) return null

    return InvoiceMapper.toDomain(record)
  }
}
```

```typescript
// src/infrastructure/mappers/InvoiceMapper.ts
import { Invoice, InvoiceItem } from "../../domain/invoicing/Invoice"
import { Money } from "../../domain/shared/Money"
import { VatRate } from "../../domain/shared/VatRate"
import { Prisma } from "@prisma/client"

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>

export class InvoiceMapper {
  static toDomain(record: InvoiceWithItems): Invoice {
    const items: InvoiceItem[] = record.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Money.fromCents(item.unitPriceCents),
      vatRate: VatRate.fromPercent(item.vatRatePercent),
    }))

    return Invoice.reconstitute(record.id, items, record.issuedAt)
  }

  static toPersistence(invoice: Invoice): Prisma.InvoiceCreateInput {
    return {
      id: invoice.id,
      issuedAt: invoice.issuedAt,
      totalNetCents: Math.round(invoice.totalNet.toNumber() * 100),
      totalVatCents: Math.round(invoice.totalVat.toNumber() * 100),
      totalGrossCents: Math.round(invoice.totalGross.toNumber() * 100),
      items: {
        create: invoice.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: Math.round(item.unitPrice.toNumber() * 100),
          vatRatePercent: item.vatRate.percent,
        })),
      },
    }
  }
}
```

```typescript
// src/infrastructure/fiscal/PoreznaClient.ts
import { FiscalService } from "../../application/fiscalization/SubmitFiscalRequestUseCase"
import { FiscalRequest } from "../../domain/fiscalization/FiscalRequest"
import { FiscalXmlBuilder } from "./FiscalXmlBuilder"
import { CertificateSigner } from "./CertificateSigner"

export class PoreznaClient implements FiscalService {
  constructor(
    private readonly xmlBuilder: FiscalXmlBuilder,
    private readonly signer: CertificateSigner,
    private readonly endpoint: string
  ) {}

  async submit(request: FiscalRequest): Promise<{ jir: string } | { error: string }> {
    try {
      // Build XML
      const xml = this.xmlBuilder.build(request)

      // Sign with certificate
      const signedXml = await this.signer.sign(xml)

      // Send to Porezna
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: signedXml,
      })

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` }
      }

      const jir = this.extractJir(await response.text())
      return { jir }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  private extractJir(xml: string): string {
    // Parse XML and extract JIR
    // ...implementation
    return ""
  }
}
```

```typescript
// src/infrastructure/banking/CsvBankStatementParser.ts
import { BankTransaction } from "../../domain/banking/BankTransaction"
import { Money } from "../../domain/shared/Money"

export interface BankStatementParser {
  parse(csvContent: string): BankTransaction[]
}

export class PbzCsvParser implements BankStatementParser {
  parse(csvContent: string): BankTransaction[] {
    const lines = csvContent.split("\n").slice(1) // Skip header

    return lines
      .filter((line) => line.trim())
      .map((line) => {
        const [date, description, amountStr, ...rest] = line.split(";")
        return BankTransaction.create({
          date: new Date(date),
          description: description.trim(),
          amount: Money.fromDecimal(parseFloat(amountStr.replace(",", "."))),
        })
      })
  }
}
```

## Testing

Infrastructure tests may require test databases or mock external services.

```typescript
describe("PrismaInvoiceRepository", () => {
  let prisma: PrismaClient
  let repository: PrismaInvoiceRepository

  beforeAll(async () => {
    prisma = new PrismaClient()
    repository = new PrismaInvoiceRepository(prisma)
  })

  it("saves and retrieves an invoice", async () => {
    const invoice = Invoice.create("test-1", [
      {
        description: "Item",
        quantity: 1,
        unitPrice: Money.fromCents(1000),
        vatRate: VatRate.standard(),
      },
    ])

    await repository.save(invoice)
    const retrieved = await repository.findById("test-1")

    expect(retrieved?.id).toBe(invoice.id)
    expect(retrieved?.totalGross.toNumber()).toBe(invoice.totalGross.toNumber())
  })
})
```
