// apps/web/src/lib/oib-lookup.ts

import { validateOib } from "@fiskai/shared"

/**
 * Result of OIB lookup operation
 */
export interface OibLookupResult {
  success: boolean
  name?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
  source?: "vies" | "sudski-registar" | "manual"
  error?: string
}

/**
 * VIES API response structure
 */
interface ViesResponse {
  isValid: boolean
  requestDate: string
  userError?: string
  name?: string
  address?: string
  requestIdentifier?: string
  vatNumber?: string
}

/**
 * Sudski Registar OAuth token response
 */
interface SudskiRegistarTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * Sudski Registar subject data response
 */
interface SudskiRegistarSubjectResponse {
  oib?: string
  mbs?: string
  naziv?: string
  skraceniNaziv?: string
  sjediste?: {
    ulica?: string
    kucniBroj?: string
    naselje?: string
    opcina?: string
    zupanija?: string
    postanskiBroj?: string
  }
  pravniOblik?: string
  datumOsnivanja?: string
  statusSubjekta?: string
}

// OAuth token cache for Sudski Registar
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Common Croatian city to postal code mapping
 */
const CITY_POSTAL_CODES: Record<string, string> = {
  "ZAGREB": "10000",
  "SPLIT": "21000",
  "RIJEKA": "51000",
  "OSIJEK": "31000",
  "ZADAR": "23000",
  "PULA": "52100",
  "SLAVONSKI BROD": "35000",
  "KARLOVAC": "47000",
  "VARAZDIN": "42000",
  "VARAŽDIN": "42000",
  "SIBENIK": "22000",
  "ŠIBENIK": "22000",
  "SISAK": "44000",
  "DUBROVNIK": "20000",
  "BJELOVAR": "43000",
  "KOPRIVNICA": "48000",
  "VINKOVCI": "32100",
  "VUKOVAR": "32000",
  "POZEGA": "34000",
  "POŽEGA": "34000",
  "CAKOVEC": "40000",
  "ČAKOVEC": "40000",
  "GOSPIC": "53000",
  "GOSPIĆ": "53000",
  "VIROVITICA": "33000",
  "KRAPINA": "49000",
  "PAZIN": "52000",
}

/**
 * Parse address string to extract street, city, and postal code
 */
export function parseAddress(address: string | undefined): {
  street?: string
  city?: string
  postalCode?: string
} {
  if (!address) return {}

  // Clean up address
  const cleaned = address.trim().replace(/\s+/g, " ")

  // Try to match Croatian postal code pattern (5 digits)
  const postalMatch = cleaned.match(/(\d{5})\s+([A-ZČĆŽŠĐ][A-ZČĆŽŠĐa-zčćžšđ\s]+)/i)
  if (postalMatch && postalMatch[1] && postalMatch[2] && postalMatch.index !== undefined) {
    const postalCode = postalMatch[1]
    const afterPostal = postalMatch[2].trim()
    const beforePostal = cleaned.substring(0, postalMatch.index).trim()

    return {
      street: beforePostal || undefined,
      postalCode,
      city: afterPostal || undefined,
    }
  }

  // Try to match city name at end without postal code
  const cityMatch = cleaned.match(/,\s*([A-ZČĆŽŠĐ][A-ZČĆŽŠĐa-zčćžšđ\s]+)$/i)
  if (cityMatch && cityMatch[1] && cityMatch.index !== undefined) {
    const city = cityMatch[1].trim().toUpperCase()
    const street = cleaned.substring(0, cityMatch.index).trim()
    const postalCode = CITY_POSTAL_CODES[city]

    return {
      street: street || undefined,
      city: cityMatch[1].trim(),
      postalCode,
    }
  }

  // Just return the whole thing as address
  return { street: cleaned }
}

/**
 * Extract and normalize company name
 * Removes common suffixes/prefixes and normalizes formatting
 */
export function normalizeCompanyName(name: string | undefined): string | undefined {
  if (!name) return undefined

  return name
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    // Normalize d.o.o. variants
    .replace(/d\.?\s*o\.?\s*o\.?/gi, "d.o.o.")
    // Normalize j.d.o.o. variants
    .replace(/j\.?\s*d\.?\s*o\.?\s*o\.?/gi, "j.d.o.o.")
    // Normalize obrt variants
    .replace(/\bobrt\b/gi, "obrt")
}

/**
 * Get cached OAuth token for Sudski Registar or fetch new one
 */
async function getSudskiRegistarToken(): Promise<string | null> {
  const clientId = process.env.SUDSKI_REGISTAR_CLIENT_ID
  const clientSecret = process.env.SUDSKI_REGISTAR_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  // Check cached token with 60 second buffer before expiry
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token
  }

  const tokenUrl = "https://sudreg-api.pravosudje.hr/oauth/token"

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error("Sudski Registar token error:", response.status)
      return null
    }

    const data: SudskiRegistarTokenResponse = await response.json()

    // Cache token with actual expiry time
    cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    }

    return data.access_token
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Sudski Registar token request timed out")
    } else {
      console.error("Sudski Registar token error:", error)
    }
    return null
  }
}

/**
 * Lookup OIB in EU VIES (VAT Information Exchange System)
 * Works for VAT-registered entities
 */
export async function lookupVies(oib: string): Promise<OibLookupResult> {
  if (!validateOib(oib)) {
    return {
      success: false,
      error: "Neispravan OIB format",
    }
  }

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/HR/vat/${oib}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "OIB nije pronađen u VIES bazi",
        }
      }
      return {
        success: false,
        error: "VIES servis nije dostupan",
      }
    }

    const data: ViesResponse = await response.json()

    if (!data.isValid) {
      return {
        success: false,
        error: data.userError || "OIB nije validan u VIES sustavu",
      }
    }

    // Parse address from VIES response
    const addressParts = parseAddress(data.address)

    return {
      success: true,
      name: normalizeCompanyName(data.name),
      address: addressParts.street,
      city: addressParts.city,
      postalCode: addressParts.postalCode,
      vatNumber: data.vatNumber ? `HR${oib}` : undefined,
      source: "vies",
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "VIES zahtjev je istekao",
      }
    }
    return {
      success: false,
      error: "Greška pri povezivanju s VIES servisom",
    }
  }
}

/**
 * Lookup OIB in Croatian Court Registry (Sudski Registar)
 * Works for d.o.o., j.d.o.o. and other registered entities
 */
export async function lookupSudskiRegistar(oib: string): Promise<OibLookupResult> {
  if (!validateOib(oib)) {
    return {
      success: false,
      error: "Neispravan OIB format",
    }
  }

  const token = await getSudskiRegistarToken()
  if (!token) {
    return {
      success: false,
      error: "Sudski Registar autentifikacija nije konfigurirana",
    }
  }

  const url = `https://sudreg-api.pravosudje.hr/javni/subjekt_detalji?oib=${oib}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "OIB nije pronađen u Sudskom registru",
        }
      }
      if (response.status === 401) {
        // Invalidate cached token
        cachedToken = null
        return {
          success: false,
          error: "Sudski Registar autentifikacija nije uspjela",
        }
      }
      return {
        success: false,
        error: "Sudski Registar servis nije dostupan",
      }
    }

    const data: SudskiRegistarSubjectResponse = await response.json()

    // Build address from structured data
    let address: string | undefined
    if (data.sjediste) {
      const parts = [data.sjediste.ulica, data.sjediste.kucniBroj].filter(Boolean)
      address = parts.join(" ") || undefined
    }

    // Get city and postal code
    const city = data.sjediste?.naselje || data.sjediste?.opcina
    const postalCode = data.sjediste?.postanskiBroj

    return {
      success: true,
      name: normalizeCompanyName(data.naziv || data.skraceniNaziv),
      address,
      city,
      postalCode,
      vatNumber: `HR${oib}`,
      source: "sudski-registar",
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Sudski Registar zahtjev je istekao",
      }
    }
    return {
      success: false,
      error: "Greška pri povezivanju sa Sudskim registrom",
    }
  }
}

/**
 * Main OIB lookup function
 * Tries VIES first (faster, covers VAT-registered entities)
 * Falls back to Sudski Registar for d.o.o./j.d.o.o.
 */
export async function lookupOib(oib: string): Promise<OibLookupResult> {
  // Validate OIB format first
  if (!validateOib(oib)) {
    return {
      success: false,
      error: "Neispravan OIB - kontrolna znamenka ne odgovara",
    }
  }

  // Try VIES first (usually faster and covers most business entities)
  const viesResult = await lookupVies(oib)
  if (viesResult.success) {
    return viesResult
  }

  // Fall back to Sudski Registar
  const sudskiResult = await lookupSudskiRegistar(oib)
  if (sudskiResult.success) {
    return sudskiResult
  }

  // If both failed, return a generic error suggesting manual entry
  return {
    success: false,
    error: "Podaci nisu pronađeni. Unesite podatke ručno.",
    source: "manual",
  }
}
