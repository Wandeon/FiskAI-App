// src/lib/fiscal/porezna-client.ts
import { parseStringPromise } from 'xml2js'

const ENDPOINTS = {
  TEST: 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest',
  PROD: 'https://cis.porezna-uprava.hr:8449/FiskalizacijaService'
}

export interface PoreznaResponse {
  success: boolean
  jir?: string
  zki?: string
  errorCode?: string
  errorMessage?: string
  rawResponse: string
}

export interface PoreznaError {
  httpStatus?: number
  poreznaCode?: string
  message: string
  body?: string
}

export async function submitToPorezna(
  signedXml: string,
  environment: 'TEST' | 'PROD'
): Promise<PoreznaResponse> {
  const endpoint = ENDPOINTS[environment]
  const soapEnvelope = buildSoapEnvelope(signedXml)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.apis-it.hr/fin/2012/types/f73/FiskalizacijaService/Racun'
      },
      body: soapEnvelope,
      signal: controller.signal
    })

    clearTimeout(timeout)
    const responseText = await response.text()

    if (!response.ok) {
      const error: PoreznaError = {
        httpStatus: response.status,
        message: `HTTP ${response.status}`,
        body: responseText
      }
      throw error
    }

    return parsePoreznaResponse(responseText)
  } catch (error) {
    clearTimeout(timeout)

    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError: PoreznaError = {
        message: 'Request timeout after 30s'
      }
      throw timeoutError
    }

    throw error
  }
}

function buildSoapEnvelope(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    ${content}
  </soap:Body>
</soap:Envelope>`
}

async function parsePoreznaResponse(xml: string): Promise<PoreznaResponse> {
  try {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [stripNamespace]
    })

    const envelope = parsed.Envelope
    const body = envelope?.Body

    // Check for SOAP Fault
    if (body?.Fault) {
      const fault = body.Fault
      return {
        success: false,
        errorCode: fault.Code?.Value || 'SOAP_FAULT',
        errorMessage: fault.Reason?.Text || 'Unknown SOAP error',
        rawResponse: xml
      }
    }

    // Check for RacunOdgovor (Invoice Response)
    const odgovor = body?.RacunOdgovor
    if (!odgovor) {
      return {
        success: false,
        errorCode: 'INVALID_RESPONSE',
        errorMessage: 'No RacunOdgovor in response',
        rawResponse: xml
      }
    }

    // Check for errors in response
    const greske = odgovor.Greske?.Greska
    if (greske) {
      const errors = Array.isArray(greske) ? greske : [greske]
      const firstError = errors[0]
      return {
        success: false,
        errorCode: firstError.SifraGreske,
        errorMessage: firstError.PorukaGreske,
        rawResponse: xml
      }
    }

    // Success - extract JIR
    const jir = odgovor.Jir
    const zki = odgovor.ZastKod

    if (!jir) {
      return {
        success: false,
        errorCode: 'NO_JIR',
        errorMessage: 'Response missing JIR',
        rawResponse: xml
      }
    }

    return {
      success: true,
      jir,
      zki,
      rawResponse: xml
    }
  } catch (parseError) {
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: `Failed to parse response: ${parseError}`,
      rawResponse: xml
    }
  }
}

function stripNamespace(name: string): string {
  const idx = name.indexOf(':')
  return idx >= 0 ? name.substring(idx + 1) : name
}
