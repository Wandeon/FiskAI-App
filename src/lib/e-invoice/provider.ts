import {
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "./types"

export interface EInvoiceProvider {
  readonly name: string

  sendInvoice(
    invoice: EInvoiceWithRelations,
    ublXml: string
  ): Promise<SendInvoiceResult>

  fetchIncomingInvoices(): Promise<IncomingInvoice[]>

  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>

  archiveInvoice(
    invoice: EInvoiceWithRelations
  ): Promise<ArchiveResult>

  testConnection(): Promise<boolean>
}

export function createEInvoiceProvider(
  providerName: string,
  config: ProviderConfig
): EInvoiceProvider {
  switch (providerName) {
    case "mock":
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MockProvider } = require("./providers/mock")
      return new MockProvider(config)
    case "ie-racuni":
      throw new Error("IE Računi provider not yet implemented")
    case "fina":
      throw new Error("Fina provider not yet implemented")
    default:
      throw new Error(`Unknown provider: ${providerName}`)
  }
}
