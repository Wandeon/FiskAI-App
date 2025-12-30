/**
 * VIES (VAT Information Exchange System) Validation
 * Validates EU VAT IDs against the EU Commission's VIES service
 */

import { VIES_CONFIG, EU_COUNTRY_CODES } from "./constants"

export interface ViesValidationResult {
  valid: boolean
  countryCode: string
  vatNumber: string
  requestDate: Date
  name?: string
  address?: string
  errorMessage?: string
}

/**
 * Parse a full VAT ID into country code and number
 */
export function parseVatId(vatId: string): { countryCode: string; vatNumber: string } | null {
  if (!vatId || vatId.length < 3) {
    return null
  }

  const normalized = vatId.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const countryCode = normalized.substring(0, 2)
  const vatNumber = normalized.substring(2)

  if (!EU_COUNTRY_CODES.includes(countryCode as (typeof EU_COUNTRY_CODES)[number])) {
    return null
  }

  return { countryCode, vatNumber }
}

/**
 * Build SOAP request for VIES validation
 */
function buildViesSoapRequest(countryCode: string, vatNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${countryCode}</urn:countryCode>
      <urn:vatNumber>${vatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`
}

/**
 * Parse SOAP response from VIES service
 */
function parseViesResponse(xml: string): ViesValidationResult {
  const requestDate = new Date()

  const validMatch = xml.match(/<valid>([^<]+)<\/valid>/i)
  const countryCodeMatch = xml.match(/<countryCode>([^<]+)<\/countryCode>/i)
  const vatNumberMatch = xml.match(/<vatNumber>([^<]+)<\/vatNumber>/i)
  const nameMatch = xml.match(/<name>([^<]+)<\/name>/i)
  const addressMatch = xml.match(/<address>([^<]+)<\/address>/i)
  const faultMatch = xml.match(/<faultstring>([^<]+)<\/faultstring>/i)

  if (faultMatch) {
    return {
      valid: false,
      countryCode: countryCodeMatch?.[1] || "",
      vatNumber: vatNumberMatch?.[1] || "",
      requestDate,
      errorMessage: faultMatch[1],
    }
  }

  return {
    valid: validMatch?.[1]?.toLowerCase() === "true",
    countryCode: countryCodeMatch?.[1] || "",
    vatNumber: vatNumberMatch?.[1] || "",
    requestDate,
    name: nameMatch?.[1] || undefined,
    address: addressMatch?.[1] || undefined,
  }
}

/**
 * Validate a VAT ID against the VIES service
 */
export async function validateVatId(vatId: string): Promise<ViesValidationResult> {
  const parsed = parseVatId(vatId)

  if (!parsed) {
    return {
      valid: false,
      countryCode: "",
      vatNumber: vatId,
      requestDate: new Date(),
      errorMessage: "Neispravan format PDV-ID broja",
    }
  }

  const { countryCode, vatNumber } = parsed

  try {
    const soapRequest = buildViesSoapRequest(countryCode, vatNumber)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), VIES_CONFIG.TIMEOUT_MS)

    const response = await fetch(VIES_CONFIG.SOAP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: soapRequest,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        valid: false,
        countryCode,
        vatNumber,
        requestDate: new Date(),
        errorMessage: `VIES servis vratio grešku: ${response.status}`,
      }
    }

    const xml = await response.text()
    return parseViesResponse(xml)
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.name === "AbortError"
          ? "VIES servis nije odgovorio na vrijeme"
          : `Greška pri provjeri: ${error.message}`
        : "Nepoznata greška pri provjeri PDV-ID"

    return {
      valid: false,
      countryCode,
      vatNumber,
      requestDate: new Date(),
      errorMessage,
    }
  }
}

/**
 * Validate VAT ID format without calling VIES (offline validation)
 */
export function validateVatIdFormat(vatId: string): { valid: boolean; error?: string } {
  const parsed = parseVatId(vatId)

  if (!parsed) {
    return { valid: false, error: "Neispravan format PDV-ID broja" }
  }

  const { countryCode, vatNumber } = parsed

  const formatPatterns: Record<string, RegExp> = {
    AT: /^U\d{8}$/,
    BE: /^\d{10}$/,
    BG: /^\d{9,10}$/,
    CY: /^\d{8}[A-Z]$/,
    CZ: /^\d{8,10}$/,
    DE: /^\d{9}$/,
    DK: /^\d{8}$/,
    EE: /^\d{9}$/,
    ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
    FI: /^\d{8}$/,
    FR: /^[A-Z0-9]{2}\d{9}$/,
    GR: /^\d{9}$/,
    HR: /^\d{11}$/,
    HU: /^\d{8}$/,
    IE: /^[0-9A-Z+*]{8,9}$/,
    IT: /^\d{11}$/,
    LT: /^\d{9,12}$/,
    LU: /^\d{8}$/,
    LV: /^\d{11}$/,
    MT: /^\d{8}$/,
    NL: /^\d{9}B\d{2}$/,
    PL: /^\d{10}$/,
    PT: /^\d{9}$/,
    RO: /^\d{2,10}$/,
    SE: /^\d{12}$/,
    SI: /^\d{8}$/,
    SK: /^\d{10}$/,
  }

  const pattern = formatPatterns[countryCode]

  if (pattern && !pattern.test(vatNumber)) {
    return {
      valid: false,
      error: `Neispravan format PDV-ID za ${countryCode}`,
    }
  }

  return { valid: true }
}
