/**
 * E-Poslovanje Provider for Croatian E-Invoicing
 *
 * API Documentation: https://doc.eposlovanje.hr
 * Test Environment: https://test.eposlovanje.hr
 * Production: https://eracun.eposlovanje.hr
 */

export interface EPoslovanjeConfig {
  apiKey: string
  apiUrl?: string
  softwareId?: string
}

export interface EPoslovanjeSendRequest {
  document: string
  softwareId: string
  sendAsEmail?: boolean
}

export interface EPoslovanjeSendResponse {
  id: number
  insertedOn: string
  message: string
}

export interface EPoslovanjeStatusResponse {
  id: number
  transportStatus: string
  businessStatus: string
  eReportingStatus: string
  modifiedOn: string
}

export interface EPoslovanjeErrorResponse {
  errorCode: string
  errorMessage: string
}

export class EPoslovanjeProvider {
  readonly name = "e-Poslovanje"
  private apiKey: string
  private apiUrl: string
  private softwareId: string

  constructor(config: EPoslovanjeConfig) {
    this.apiKey = config.apiKey
    this.apiUrl =
      config.apiUrl ||
      process.env.EPOSLOVANJE_API_BASE ||
      "https://test.eposlovanje.hr"
    this.softwareId = config.softwareId || "FISKAI-001"
  }

  /**
   * Test connection to e-Poslovanje API
   */
  async ping(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.apiUrl}/api/v2/ping`, {
      method: "GET",
      headers: {
        Authorization: this.apiKey,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Ping failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Send UBL 2.1 document (Invoice or CreditNote)
   */
  async sendDocument(
    ublXml: string,
    options?: { sendAsEmail?: boolean }
  ): Promise<EPoslovanjeSendResponse> {
    const payload: EPoslovanjeSendRequest = {
      document: ublXml,
      softwareId: this.softwareId,
      sendAsEmail: options?.sendAsEmail,
    }

    const response = await fetch(`${this.apiUrl}/api/v2/document/send`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as EPoslovanjeErrorResponse
      throw new Error(`Send failed: ${error.errorCode} - ${error.errorMessage}`)
    }

    return data as EPoslovanjeSendResponse
  }

  /**
   * Get document status
   */
  async getStatus(id: number): Promise<EPoslovanjeStatusResponse> {
    const response = await fetch(`${this.apiUrl}/api/v2/document/status/${id}`, {
      method: "GET",
      headers: {
        Authorization: this.apiKey,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(
        `Get status failed: ${response.status} ${response.statusText}`
      )
    }

    return response.json()
  }
}
