/**
 * OIB Lookup Service
 * Provides smart lookup for Croatian company data using:
 * 1. VIES API (EU VAT information)
 * 2. Sudski Registar API (Croatian court registry)
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
    address?: string
    city?: string
    postalCode?: string
    vatNumber?: string
  }>
  error?: string
}

export interface OibSearchResult {
  success: boolean
  results?: Array<{
    name: string
    oib?: string
    address?: string
    city?: string
    postalCode?: string
    vatNumber?: string
  }>
  error?: string
}

/**
 * Validates OIB format and checksum
 * OIB is 11 digits with ISO 7064, MOD 11-10 checksum
 */
export function validateOib(oib: string): boolean {
  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(oib)) {
    return false
  }

  // Calculate ISO 7064, MOD 11-10 checksum
  let sum = 10
  for (let i = 0; i < 10; i++) {
    sum = (sum + parseInt(oib[i], 10)) % 10
    if (sum === 0) sum = 10
    sum = (sum * 2) % 11
  }

  const checkDigit = (11 - sum) % 10
  return checkDigit === parseInt(oib[10], 10)
}

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
        "Accept": "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // VIES returns 200 even for invalid, so non-200 means API error
      return {
        success: false,
        error: "VIES API nedostupan",
      }
    }

    const data = await response.json()

    if (!data.valid) {
      return {
        success: false,
        error: "OIB nije pronađen u VIES sustavu",
      }
    }

    // Parse address (VIES returns single address string)
    const addressParts = parseAddress(data.address || "")

    return {
      success: true,
      name: data.name || "",
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
        error: "VIES API timeout (predugo čekanje)",
      }
    }
    return {
      success: false,
      error: "Greška pri pozivanju VIES API-ja",
    }
  }
}

/**
 * Lookup company data via Sudski Registar API
 * Currently implemented without API key (can be added later)
 * Only works for d.o.o./j.d.o.o., not obrt
 */
async function lookupSudskiRegistar(oib: string): Promise<OibLookupResult> {
  try {
    void oib
    // Note: Sudski Registar API requires authentication
    // For now, return "not implemented" gracefully
    // When API key is available, implement the actual lookup
    
    return {
      success: false,
      error: "Sudski Registar API zahtijeva ključ (nije konfigurirano)",
    }

    /* Implementation template for when API key is available:
    const url = `https://sudreg-data.gov.hr/api/javni/subjekt?oib=${oib}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${process.env.SUDSKI_REGISTAR_API_KEY}`,
      },
    })

    if (!response.ok) {
      return { success: false, error: "Sudski Registar API greška" }
    }

    const data = await response.json()
    
    return {
      success: true,
      name: data.tvrtka || "",
      address: data.adresa || "",
      city: data.grad || "",
      postalCode: data.postanskiBroj || "",
      vatNumber: data.pdvBroj || `HR${oib}`,
      source: "sudski-registar",
    }
    */
  } catch {
    return {
      success: false,
      error: "Greška pri pozivanju Sudski Registar API-ja",
    }
  }
}

/**
 * Parse address string into components
 * VIES typically returns: "Street Number, PostalCode City"
 */
function parseAddress(addressString: string): {
  street: string
  city: string
  postalCode: string
} {
  // Try to match pattern: "Street Number, PostalCode City"
  const match = addressString.match(/^(.+?),\s*(\d{5})\s+(.+)$/)
  
  if (match) {
    return {
      street: match[1].trim(),
      postalCode: match[2].trim(),
      city: match[3].trim(),
    }
  }

  // Try alternative pattern: "Street Number\nPostalCode City"
  const match2 = addressString.match(/^(.+?)\n(\d{5})\s+(.+)$/)
  
  if (match2) {
    return {
      street: match2[1].trim(),
      postalCode: match2[2].trim(),
      city: match2[3].trim(),
    }
  }

  // Fallback: try to extract postal code at least
  const postalMatch = addressString.match(/\b(\d{5})\b/)
  if (postalMatch) {
    const postalCode = postalMatch[1]
    const parts = addressString.split(postalCode)
    return {
      street: parts[0].trim().replace(/,\s*$/, ""),
      postalCode,
      city: parts[1]?.trim() || "",
    }
  }

  // Last resort: return as-is
  return {
    street: addressString,
    city: "",
    postalCode: "",
  }
}

/**
 * Main lookup function
 * Tries VIES first, then Sudski Registar as fallback
 */
export async function lookupOib(oib: string): Promise<OibLookupResult> {
  // Validate OIB format
  if (!validateOib(oib)) {
    return {
      success: false,
      error: "Neispravan format OIB-a ili kontrolna znamenka",
    }
  }

  // Try VIES first (covers both d.o.o. and obrt if VAT registered)
  const viesResult = await lookupVies(oib)
  if (viesResult.success) {
    return viesResult
  }

  // Fallback to Sudski Registar (only d.o.o./j.d.o.o.)
  const sudskiResult = await lookupSudskiRegistar(oib)
  if (sudskiResult.success) {
    return sudskiResult
  }

  // Both failed
  return {
    success: false,
    error: "OIB nije pronađen ni u jednom sustavu. Unesite podatke ručno.",
    source: "manual",
  }
}

export async function searchCompaniesByName(query: string): Promise<OibSearchResult> {
  void query
  if (!process.env.SUDSKI_REGISTAR_API_KEY) {
    return {
      success: false,
      error: "Sudski registar nije konfiguriran",
    }
  }

  // Placeholder: replace with real Sudski Registar search implementation once API key/process is available.
  return {
    success: false,
    error: "Pretraga po nazivu nije implementirana (Sudski registar API potreban)",
  }
}
