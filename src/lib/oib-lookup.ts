import { validateOib } from "./validations/oib"

// Re-export validateOib for convenience
export { validateOib } from "./validations/oib"

/**
 * OIB Lookup Service
 * Provides smart lookup for Croatian company data using:
 * 1. VIES API (EU VAT information) - for VAT-registered companies
 * 2. Sudski Registar API (Croatian court registry) - for d.o.o./j.d.o.o.
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

export interface OibSearchResult {
  success: boolean
  results?: Array<{
    name: string
    oib?: string
    mbs?: string
    address?: string
    city?: string
    postalCode?: string
    vatNumber?: string
  }>
  error?: string
}

// Sudski Registar credentials
const SUDSKI_CLIENT_ID = process.env.SUDSKI_REGISTAR_CLIENT_ID || "-pqJEAO_1yMxuAx498tTNw.."
const SUDSKI_CLIENT_SECRET = process.env.SUDSKI_REGISTAR_CLIENT_SECRET || "bHVm9CkAcZTlG1o1Php6Nw.."
const SUDSKI_TOKEN_URL = "https://sudreg-data.gov.hr/api/oauth/token"
const SUDSKI_API_BASE = "https://sudreg-data.gov.hr/api/javni"

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get OAuth token for Sudski Registar API
 */
async function getSudskiToken(): Promise<string | null> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token
  }

  try {
    const credentials = Buffer.from(`${SUDSKI_CLIENT_ID}:${SUDSKI_CLIENT_SECRET}`).toString(
      "base64"
    )

    const response = await fetch(SUDSKI_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    if (!response.ok) {
      console.error("Failed to get Sudski Registar token:", response.status)
      return null
    }

    const data = await response.json()

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    return cachedToken.token
  } catch (error) {
    console.error("Error getting Sudski Registar token:", error)
    return null
  }
}

// validateOib is now imported from ./validations/oib

/**
 * Lookup company data via VIES API
 * Works for VAT-registered companies (both d.o.o. and obrt)
 */
async function lookupVies(oib: string): Promise<OibLookupResult> {
  try {
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/HR/vat/${oib}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        error: "VIES API nedostupan",
      }
    }

    const data = await response.json()

    if (!data.valid) {
      return {
        success: false,
        error: "OIB nije pronaden u VIES sustavu",
      }
    }

    // Parse address (VIES returns single address string)
    const addressParts = parseAddress(data.address || "")

    return {
      success: true,
      name: extractShortName(data.name) || "",
      address: addressParts.street,
      city: addressParts.city,
      postalCode: addressParts.postalCode,
      vatNumber: `HR${oib}`,
      source: "vies",
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "VIES API timeout - pokusajte ponovno",
      }
    }
    return {
      success: false,
      error: "Greska pri dohvatu iz VIES-a",
    }
  }
}

/**
 * Lookup company data via Sudski Registar API
 * Works for d.o.o., j.d.o.o. and other court-registered entities
 */
async function lookupSudskiRegistar(oib: string): Promise<OibLookupResult> {
  try {
    const token = await getSudskiToken()
    if (!token) {
      return {
        success: false,
        error: "Sudski registar autentifikacija nije uspjela",
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const url = `${SUDSKI_API_BASE}/detalji_subjekta?tip_identifikatora=oib&identifikator=${oib}`

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
      const errorData = await response.json().catch(() => ({}))
      if (errorData.error_code === 505 || errorData.error_code === 508) {
        return {
          success: false,
          error: "OIB nije pronaden u Sudskom registru",
        }
      }
      return {
        success: false,
        error: "Sudski registar API greska",
      }
    }

    const data = await response.json()

    // Extract company name
    const name = data.skracena_tvrtka?.ime || extractShortName(data.tvrtka?.ime) || ""

    // Extract address
    const sjediste = data.sjediste || {}
    let street = ""
    if (sjediste.ulica) {
      street = sjediste.ulica
      if (sjediste.kucni_broj) {
        street = street + " " + sjediste.kucni_broj
      }
    }
    const city = sjediste.naziv_naselja || ""

    // Croatian postal codes are 5 digits, based on region
    const postalCode = sjediste.sifra_zupanije
      ? getPostalCodeFromZupanija(sjediste.sifra_zupanije, sjediste.sifra_opcine)
      : ""

    return {
      success: true,
      name,
      address: street,
      city,
      postalCode,
      vatNumber: `HR${oib}`,
      source: "sudski-registar",
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Sudski registar API timeout",
      }
    }
    return {
      success: false,
      error: "Greska pri dohvatu iz Sudskog registra",
    }
  }
}

/**
 * Main lookup function - tries VIES first, then Sudski Registar
 */
export async function lookupOib(oib: string): Promise<OibLookupResult> {
  // Validate OIB format
  if (!validateOib(oib)) {
    return {
      success: false,
      error: "Neispravan OIB - provjerite broj",
    }
  }

  // Try VIES first (covers VAT-registered entities)
  const viesResult = await lookupVies(oib)
  if (viesResult.success) {
    return viesResult
  }

  // Fallback to Sudski Registar (covers d.o.o. not in VAT system)
  const sudskiResult = await lookupSudskiRegistar(oib)
  if (sudskiResult.success) {
    return sudskiResult
  }

  // Both failed
  return {
    success: false,
    error: "OIB nije pronaden - unesite podatke rucno",
  }
}

/**
 * Parse Croatian address string into components
 */
/**
 * Extract short company name from full legal name
 * "INOXMONT-VS - drustvo s ogranicenom odgovornoscu za..." -> "INOXMONT-VS d.o.o."
 */
function extractShortName(fullName: string | undefined): string {
  if (!fullName) return ""

  // Common patterns: "NAME - drustvo s ogranicenom odgovornoscu..." or "NAME d.o.o."
  // Split on " - " which typically separates short name from long legal description
  const dashIndex = fullName.indexOf(" - ")
  if (dashIndex > 0) {
    const shortPart = fullName.substring(0, dashIndex).trim()
    // Append appropriate suffix based on common patterns in description
    const lowerFull = fullName.toLowerCase()
    if (lowerFull.includes("drustvo s ogranicenom") || lowerFull.includes("d.o.o")) {
      return shortPart + " d.o.o."
    }
    if (lowerFull.includes("dionicko drustvo") || lowerFull.includes("d.d")) {
      return shortPart + " d.d."
    }
    if (lowerFull.includes("jednostavno drustvo") || lowerFull.includes("j.d.o.o")) {
      return shortPart + " j.d.o.o."
    }
    return shortPart
  }

  // If no separator, return as-is but truncate if very long
  if (fullName.length > 60) {
    return fullName.substring(0, 57) + "..."
  }
  return fullName
}

function parseAddress(address: string): { street: string; city: string; postalCode: string } {
  if (!address) {
    return { street: "", city: "", postalCode: "" }
  }

  // Croatian address format: "STREET NUMBER\nPOSTAL CITY" or "STREET NUMBER, POSTAL CITY"
  const lines = address
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { street: "", city: "", postalCode: "" }
  }

  const street = lines[0] || ""

  if (lines.length > 1) {
    // Try to extract postal code (5 digits) and city
    const cityLine = lines[lines.length - 1]
    const postalMatch = cityLine.match(/^(\d{5})\s+(.+)$/)

    if (postalMatch) {
      return {
        street,
        postalCode: postalMatch[1],
        city: postalMatch[2],
      }
    }

    return {
      street,
      postalCode: "",
      city: cityLine,
    }
  }

  return { street, city: "", postalCode: "" }
}

/**
 * Get approximate postal code from zupanija and opcina codes
 */
function getPostalCodeFromZupanija(zupanijaId: number, opcinaId?: number): string {
  // Croatian postal codes by zupanija (approximate)
  const zupanijaPostalCodes: Record<number, string> = {
    1: "31000", // Osjecko-baranjska
    2: "33000", // Viroviticko-podravska
    3: "40000", // Medimurska
    4: "42000", // Varazdinska
    5: "43000", // Bjelovarsko-bilogorska
    6: "44000", // Sisacko-moslavacka
    7: "47000", // Karlovacka
    8: "48000", // Koprivnicko-krizevacka
    9: "49000", // Krapinsko-zagorska
    10: "10000", // Zagrebacka
    11: "20000", // Dubrovacko-neretvanska
    12: "21000", // Splitsko-dalmatinska
    13: "22000", // Sibensko-kninska
    14: "23000", // Zadarska
    15: "34000", // Pozesko-slavonska
    16: "35000", // Brodsko-posavska
    17: "51000", // Primorsko-goranska
    18: "52000", // Istarska
    19: "53000", // Licko-senjska
    20: "32000", // Vukovarsko-srijemska
    21: "10000", // Grad Zagreb
  }

  void opcinaId
  return zupanijaPostalCodes[zupanijaId] || ""
}
