import { EInvoiceProvider } from "../provider"
import {
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "../types"

export class MockProvider implements EInvoiceProvider {
  readonly name = "Mock Provider (Development)"

  constructor(private config: ProviderConfig) {}

  async sendInvoice(
    invoice: EInvoiceWithRelations,
    ublXml: string
  ): Promise<SendInvoiceResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Generate mock fiscalization codes
    const jir = `JIR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const zki = `ZKI-${Math.random().toString(36).substr(2, 20)}`

    console.log(`[MockProvider] Sending invoice ${invoice.invoiceNumber}`)
    console.log(`[MockProvider] UBL XML length: ${ublXml.length} bytes`)

    return {
      success: true,
      providerRef: `MOCK-${Date.now()}`,
      jir,
      zki,
    }
  }

  async fetchIncomingInvoices(): Promise<IncomingInvoice[]> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Return empty array for mock - in real implementation would fetch from API
    return []
  }

  async getInvoiceStatus(): Promise<InvoiceStatusResult> {
    await new Promise((resolve) => setTimeout(resolve, 200))

    return {
      status: "delivered",
      message: "Invoice delivered successfully (mock)",
      updatedAt: new Date(),
    }
  }

  async archiveInvoice(
    invoice: EInvoiceWithRelations
  ): Promise<ArchiveResult> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    return {
      success: true,
      archiveRef: `ARCHIVE-${invoice.id}-${Date.now()}`,
    }
  }

  async testConnection(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return true
  }
}
