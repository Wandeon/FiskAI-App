// src/lib/e-invoice/providers/eposlovanje-einvoice.ts
/**
 * ePoslovanje B2B E-Invoice Provider (API v2)
 *
 * Implements EInvoiceProvider interface for ePoslovanje.hr e-invoice intermediary.
 * Uses API v2 endpoints (v1 end-of-support 2026-01-01).
 *
 * API Documentation: https://doc.eposlovanje.hr
 *
 * Environment variables:
 * - EPOSLOVANJE_API_KEY (required) - API key for Authorization header
 * - EPOSLOVANJE_API_BASE (required) - Base URL without path:
 *     TEST: https://test.eposlovanje.hr
 *     PROD: https://eracun.eposlovanje.hr
 * - EPOSLOVANJE_TIMEOUT_MS (optional, default 15000)
 *
 * API v2 Endpoints:
 * - Ping: GET /api/v2/ping
 * - Send document: POST /api/v2/document/send
 */

import crypto from "crypto"
import { EInvoiceProvider } from "../provider"
import {
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  IncomingInvoiceFilter,
  ListIncomingResult,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "../types"
import { logger } from "@/lib/logger"

/**
 * Provider status codes for error mapping
 */
export type EposlovanjeProviderStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_TEMPORARY_FAILURE"
  | "PROVIDER_ERROR"

/**
 * Extended config for ePoslovanje
 */
export interface EposlovanjeConfig extends ProviderConfig {
  apiBase?: string
  timeoutMs?: number
}

/**
 * ePoslovanje v2 API response types
 */
interface EposlovanjeV2SendResponse {
  messageId?: string
  documentId?: string
  status?: string
  message?: string
  error?: string
  details?: string // Additional error details from v2 API
}

/**
 * ePoslovanje v2 send request body
 */
interface EposlovanjeV2SendRequest {
  document: string // UBL XML as string
  softwareId: string
  sendAsEmail?: boolean
}

/**
 * Generate idempotency key for deduplication
 */
export function generateIdempotencyKey(
  companyId: string,
  invoiceId: string,
  ublHash: string
): string {
  const input = `${companyId}:${invoiceId}:${ublHash}`
  return crypto.createHash("sha256").update(input).digest("hex")
}

/**
 * Generate hash of UBL content for idempotency
 */
export function hashUblContent(ublXml: string): string {
  return crypto.createHash("sha256").update(ublXml).digest("hex")
}

/**
 * Map HTTP status to provider status
 */
export function mapHttpStatusToProviderStatus(httpStatus: number): {
  status: EposlovanjeProviderStatus
  retryable: boolean
} {
  switch (httpStatus) {
    case 200:
    case 201:
    case 202:
      return { status: "QUEUED", retryable: false }
    case 400:
      // v2 API uses 400 for validation errors, inactive account, insufficient funds, auth errors
      return { status: "PROVIDER_REJECTED", retryable: false }
    case 401:
    case 403:
      return { status: "PROVIDER_AUTH_FAILED", retryable: false }
    case 409:
      // Duplicate - treat as idempotent success
      return { status: "QUEUED", retryable: false }
    case 429:
      return { status: "PROVIDER_RATE_LIMIT", retryable: true }
    case 500:
    case 502:
    case 503:
    case 504:
      return { status: "PROVIDER_TEMPORARY_FAILURE", retryable: true }
    default:
      return { status: "PROVIDER_ERROR", retryable: false }
  }
}

/**
 * Truncate response body for safe logging/storage
 */
function truncateForStorage(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "...[truncated]"
}

/**
 * Injectable fetch function for testing
 */
export type FetchFunction = typeof fetch

/**
 * Software identifier for ePoslovanje API
 */
const SOFTWARE_ID = "FiskAI"

/**
 * ePoslovanje E-Invoice Provider Implementation (API v2)
 */
export class EposlovanjeEInvoiceProvider implements EInvoiceProvider {
  readonly name = "ePoslovanje"

  private readonly apiKey: string
  private readonly apiBase: string
  private readonly timeoutMs: number
  private readonly fetchFn: FetchFunction

  constructor(config: EposlovanjeConfig, fetchFn: FetchFunction = fetch) {
    this.apiKey = config.apiKey || process.env.EPOSLOVANJE_API_KEY || ""
    // Support both old EPOSLOVANJE_API_URL and new EPOSLOVANJE_API_BASE
    this.apiBase =
      config.apiBase ||
      process.env.EPOSLOVANJE_API_BASE ||
      process.env.EPOSLOVANJE_API_URL?.replace(/\/v1\/?$/, "") ||
      ""
    this.timeoutMs = config.timeoutMs || parseInt(process.env.EPOSLOVANJE_TIMEOUT_MS || "15000", 10)
    this.fetchFn = fetchFn
  }

  /**
   * Build full URL for v2 API endpoint
   */
  private buildUrl(path: string): string {
    // Ensure base has no trailing slash and path starts with /
    const base = this.apiBase.replace(/\/$/, "")
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    return `${base}${cleanPath}`
  }

  /**
   * Check if provider is properly configured
   */
  private isConfigured(): boolean {
    return !!(this.apiKey && this.apiBase)
  }

  /**
   * Get configuration error message
   */
  private getConfigError(): string {
    const missing: string[] = []
    if (!this.apiKey) missing.push("EPOSLOVANJE_API_KEY")
    if (!this.apiBase) missing.push("EPOSLOVANJE_API_BASE")
    return `Missing required configuration: ${missing.join(", ")}`
  }

  /**
   * Test connection to ePoslovanje API using v2 ping endpoint
   *
   * Endpoint: GET /api/v2/ping
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn(
        { provider: this.name, configured: false },
        "ePoslovanje provider not configured for connection test"
      )
      return false
    }

    const pingUrl = this.buildUrl("/api/v2/ping")

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const response = await this.fetchFn(pingUrl, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      logger.info(
        { provider: this.name, status: response.status, endpoint: "/api/v2/ping" },
        "ePoslovanje connection test completed"
      )

      return response.status === 200
    } catch (error) {
      logger.error(
        { provider: this.name, error: error instanceof Error ? error.message : "Unknown error" },
        "ePoslovanje connection test failed"
      )
      return false
    }
  }

  /**
   * Send invoice via ePoslovanje API v2
   *
   * Endpoint: POST /api/v2/document/send
   * Content-Type: application/json
   * Body: { "document": "<UBL XML>", "softwareId": "FiskAI" }
   */
  async sendInvoice(invoice: EInvoiceWithRelations, ublXml: string): Promise<SendInvoiceResult> {
    const logContext = {
      provider: this.name,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      companyId: invoice.companyId,
    }

    // Check configuration
    if (!this.isConfigured()) {
      const error = this.getConfigError()
      logger.warn({ ...logContext, status: "PROVIDER_NOT_CONFIGURED" }, error)
      return {
        success: false,
        error: `PROVIDER_NOT_CONFIGURED: ${error}`,
      }
    }

    // Check idempotency - don't re-send if already sent
    if (
      invoice.providerRef &&
      ["QUEUED", "SENT", "DELIVERED"].includes(invoice.providerStatus || "")
    ) {
      logger.info(
        { ...logContext, providerRef: invoice.providerRef, status: invoice.providerStatus },
        "Invoice already sent - returning existing providerRef"
      )
      return {
        success: true,
        providerRef: invoice.providerRef,
      }
    }

    // Generate idempotency key for client-side deduplication
    const ublHash = hashUblContent(ublXml)
    const idempotencyKey = generateIdempotencyKey(invoice.companyId, invoice.id, ublHash)

    logger.info(
      {
        ...logContext,
        ublLength: ublXml.length,
        idempotencyKey: idempotencyKey.substring(0, 16) + "...",
      },
      "Sending invoice via ePoslovanje v2"
    )

    const sendUrl = this.buildUrl("/api/v2/document/send")

    // Build v2 request body
    const requestBody: EposlovanjeV2SendRequest = {
      document: ublXml,
      softwareId: SOFTWARE_ID,
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const response = await this.fetchFn(sendUrl, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
          // Include idempotency key as custom header for potential server-side deduplication
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      const { status: providerStatus, retryable } = mapHttpStatusToProviderStatus(response.status)

      // Parse response body
      let responseBody: EposlovanjeV2SendResponse | null = null
      let responseText = ""
      try {
        responseText = await response.text()
        if (responseText) {
          responseBody = JSON.parse(responseText)
        }
      } catch {
        // Response is not JSON, keep as text
      }

      // Handle success responses (200, 201, 202)
      if (response.ok) {
        // Extract message/document ID from response
        const providerRef =
          responseBody?.messageId ||
          responseBody?.documentId ||
          `EPO-${Date.now()}-${idempotencyKey.substring(0, 8)}`

        logger.info(
          { ...logContext, providerRef, httpStatus: response.status },
          "Invoice sent successfully via ePoslovanje v2"
        )

        return {
          success: true,
          providerRef,
        }
      }

      // Handle 409 as idempotent success (duplicate submission)
      if (response.status === 409) {
        const providerRef =
          responseBody?.messageId ||
          responseBody?.documentId ||
          invoice.providerRef ||
          `EPO-DUP-${idempotencyKey.substring(0, 16)}`

        logger.info(
          { ...logContext, providerRef, httpStatus: 409 },
          "Invoice already exists on provider (idempotent success)"
        )

        return {
          success: true,
          providerRef,
        }
      }

      // Handle error responses
      // Combine error and details if both present
      let errorMessage =
        responseBody?.message || responseBody?.error || responseText || `HTTP ${response.status}`
      if (responseBody?.details && responseBody?.error) {
        errorMessage = `${responseBody.error}: ${responseBody.details}`
      }
      const boundedError = truncateForStorage(errorMessage)

      logger.error(
        {
          ...logContext,
          httpStatus: response.status,
          providerStatus,
          retryable,
          errorPreview: boundedError.substring(0, 100),
        },
        `ePoslovanje v2 send failed: ${providerStatus}`
      )

      return {
        success: false,
        error: `${providerStatus}: ${boundedError}`,
      }
    } catch (error) {
      // Handle network/timeout errors
      const isTimeout = error instanceof Error && error.name === "AbortError"
      const status: EposlovanjeProviderStatus = isTimeout
        ? "PROVIDER_TEMPORARY_FAILURE"
        : "PROVIDER_ERROR"

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      logger.error(
        {
          ...logContext,
          providerStatus: status,
          isTimeout,
          error: errorMessage,
        },
        `ePoslovanje v2 send exception: ${status}`
      )

      return {
        success: false,
        error: `${status}: ${errorMessage}`,
      }
    }
  }

  /**
   * Fetch incoming invoices from ePoslovanje v2
   *
   * Endpoint: GET /api/v2/document/incoming
   * Returns list of received documents for the authenticated company.
   *
   * @param filter Optional date range and pagination parameters
   * @returns List of incoming invoices with metadata
   */
  async fetchIncomingInvoices(filter?: IncomingInvoiceFilter): Promise<IncomingInvoice[]> {
    if (!this.isConfigured()) {
      logger.warn(
        { provider: this.name, status: "PROVIDER_NOT_CONFIGURED" },
        "Cannot fetch incoming invoices - provider not configured"
      )
      return []
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      // Build URL with query parameters
      const params = new URLSearchParams()
      if (filter?.fromDate) {
        params.set("fromDate", filter.fromDate.toISOString().split("T")[0])
      }
      if (filter?.toDate) {
        params.set("toDate", filter.toDate.toISOString().split("T")[0])
      }
      if (filter?.page) {
        params.set("page", filter.page.toString())
      }
      if (filter?.pageSize) {
        params.set("pageSize", filter.pageSize.toString())
      }

      const queryString = params.toString()
      const url = this.buildUrl(`/api/v2/document/incoming${queryString ? `?${queryString}` : ""}`)

      logger.info(
        {
          provider: this.name,
          fromDate: filter?.fromDate?.toISOString(),
          toDate: filter?.toDate?.toISOString(),
        },
        "Fetching incoming invoices from ePoslovanje v2"
      )

      const response = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        logger.error(
          { provider: this.name, httpStatus: response.status },
          "Failed to fetch incoming invoices from ePoslovanje v2"
        )
        return []
      }

      const data = await response.json()
      const rawInvoices = Array.isArray(data) ? data : []

      // Map API response to IncomingInvoice type
      // Note: Field mapping based on standard e-invoice structure
      const invoices: IncomingInvoice[] = rawInvoices.map((doc: Record<string, unknown>) =>
        this.mapToIncomingInvoice(doc)
      )

      logger.info(
        { provider: this.name, count: invoices.length },
        "Fetched incoming invoices from ePoslovanje v2"
      )

      return invoices
    } catch (error) {
      logger.error(
        {
          provider: this.name,
          error: error instanceof Error ? error.message : "Unknown",
        },
        "Exception fetching incoming invoices from ePoslovanje v2"
      )
      return []
    }
  }

  /**
   * Map ePoslovanje API response to IncomingInvoice type
   *
   * Maps common field names from standard e-invoice APIs.
   * Falls back to sensible defaults for missing fields.
   */
  private mapToIncomingInvoice(doc: Record<string, unknown>): IncomingInvoice {
    // Provider reference - use documentId, messageId, or id
    const providerRef =
      (doc.documentId as string) ||
      (doc.messageId as string) ||
      (doc.id as string) ||
      `unknown-${Date.now()}`

    // Seller info - look for common field patterns
    const sellerOib =
      (doc.sellerOib as string) || (doc.senderOib as string) || (doc.supplierOib as string) || ""

    const sellerName =
      (doc.sellerName as string) || (doc.senderName as string) || (doc.supplierName as string) || ""

    // Invoice details
    const invoiceNumber =
      (doc.invoiceNumber as string) ||
      (doc.documentNumber as string) ||
      (doc.number as string) ||
      providerRef

    // Parse date
    let issueDate: Date
    const rawDate = doc.issueDate || doc.documentDate || doc.date
    if (rawDate instanceof Date) {
      issueDate = rawDate
    } else if (typeof rawDate === "string") {
      issueDate = new Date(rawDate)
    } else {
      issueDate = new Date()
    }

    // Amount
    const totalAmount =
      typeof doc.totalAmount === "number"
        ? doc.totalAmount
        : typeof doc.amount === "number"
          ? doc.amount
          : typeof doc.total === "number"
            ? doc.total
            : 0

    // Currency
    const currency = (doc.currency as string) || (doc.documentCurrency as string) || "EUR"

    // UBL XML - may be included directly or need separate fetch
    const ublXml = (doc.ublXml as string) || (doc.document as string) || ""

    return {
      providerRef,
      sellerOib,
      sellerName,
      invoiceNumber,
      issueDate,
      totalAmount,
      currency,
      ublXml,
    }
  }

  /**
   * List incoming invoices with pagination metadata
   */
  async listIncomingInvoices(filter?: IncomingInvoiceFilter): Promise<ListIncomingResult> {
    const invoices = await this.fetchIncomingInvoices(filter)
    const page = filter?.page || 1
    const pageSize = filter?.pageSize || 100

    return {
      invoices,
      totalCount: invoices.length, // API may provide total in headers/response
      page,
      pageSize,
      hasMore: invoices.length >= pageSize,
    }
  }

  /**
   * Get invoice status from ePoslovanje
   */
  async getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult> {
    if (!this.isConfigured()) {
      return {
        status: "error",
        message: "PROVIDER_NOT_CONFIGURED: Cannot check status",
        updatedAt: new Date(),
      }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      // v2 endpoint for document status - adjust based on actual API
      const url = this.buildUrl(`/api/v2/document/${providerRef}/status`)

      const response = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        logger.info(
          { provider: this.name, providerRef, httpStatus: response.status },
          "ePoslovanje v2 status check returned non-OK"
        )
        return {
          status: "pending",
          message: "Status check not available or not supported",
          updatedAt: new Date(),
        }
      }

      const data = await response.json()
      return {
        status: data.status || "pending",
        message: data.message,
        updatedAt: new Date(data.updatedAt || Date.now()),
      }
    } catch (error) {
      logger.warn(
        {
          provider: this.name,
          providerRef,
          error: error instanceof Error ? error.message : "Unknown",
        },
        "ePoslovanje v2 status check failed"
      )
      return {
        status: "pending",
        message: "Status check failed - will retry",
        updatedAt: new Date(),
      }
    }
  }

  /**
   * Archive invoice via ePoslovanje
   */
  async archiveInvoice(invoice: EInvoiceWithRelations): Promise<ArchiveResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "PROVIDER_NOT_CONFIGURED: Cannot archive invoice",
      }
    }

    if (!invoice.providerRef) {
      return {
        success: false,
        error: "No providerRef - invoice may not have been sent",
      }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      // v2 endpoint for archiving - adjust based on actual API
      const url = this.buildUrl(`/api/v2/document/${invoice.providerRef}/archive`)

      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        const text = await response.text()
        return {
          success: false,
          error: `Archive failed: HTTP ${response.status} - ${truncateForStorage(text, 200)}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        archiveRef: data.archiveRef || `ARCHIVE-${invoice.providerRef}`,
      }
    } catch (error) {
      return {
        success: false,
        error: `Archive failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      }
    }
  }
}
