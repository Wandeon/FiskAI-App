import {
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "./types"
import { MockProvider } from "./providers/mock"
import { EposlovanjeEInvoiceProvider } from "./providers/eposlovanje-einvoice"

export interface EInvoiceProvider {
  readonly name: string

  sendInvoice(invoice: EInvoiceWithRelations, ublXml: string): Promise<SendInvoiceResult>

  fetchIncomingInvoices(): Promise<IncomingInvoice[]>

  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>

  archiveInvoice(invoice: EInvoiceWithRelations): Promise<ArchiveResult>

  testConnection(): Promise<boolean>
}

/**
 * Factory function to create e-invoice providers.
 *
 * Supported providers:
 * - "mock": Development/testing mock provider
 * - "eposlovanje": ePoslovanje B2B e-invoice intermediary
 * - "ie-racuni": IE Računi provider (uses eposlovanje adapter)
 * - "fina": FINA provider (uses eposlovanje adapter)
 *
 * All providers return proper error states instead of throwing.
 */
export function createEInvoiceProvider(
  providerName: string,
  config: ProviderConfig
): EInvoiceProvider {
  switch (providerName) {
    case "mock":
      return new MockProvider(config)

    case "eposlovanje":
    case "ie-racuni":
    case "fina":
      // All real providers use the eposlovanje adapter (API v2)
      // Provider-specific configuration is handled via environment variables
      return new EposlovanjeEInvoiceProvider({
        ...config,
        // v2 API uses apiBase (base URL without path) rather than apiUrl
        apiBase: process.env.EPOSLOVANJE_API_BASE,
        timeoutMs: parseInt(process.env.EPOSLOVANJE_TIMEOUT_MS || "15000", 10),
      })

    default:
      // Return a stub provider that reports configuration error
      // instead of throwing - this allows proper error state persistence
      return new EposlovanjeEInvoiceProvider({
        apiKey: "", // Empty - will trigger PROVIDER_NOT_CONFIGURED
        apiUrl: "",
      })
  }
}
