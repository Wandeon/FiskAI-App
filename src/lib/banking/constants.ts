/**
 * Croatian Banks VBDI (Vodeća Banka za Devizno Inozemstvo) mapping
 * 
 * VBDI is the 7-digit bank code embedded in Croatian IBANs at positions 5-11.
 * 
 * Format: HRKK BBBB B00C CCCC CCCC C
 * - HR: Country code
 * - KK: Checksum (2 digits)
 * - BBBB B00: Bank ID (7 digits, where B = bank code, 00 = branch)
 * - CCCC CCCC C: Account number (10 digits)
 */
export const CROATIAN_BANKS: Record<string, string> = {
  "2360000": "Zagrebačka banka d.d.",
  "2340009": "Privredna banka Zagreb d.d.",
  "2402006": "Erste & Steiermärkische Bank d.d.",
  "2407000": "OTP banka d.d.",
  "2390001": "Hrvatska poštanska banka d.d.",
  "2484008": "Raiffeisenbank Austria d.d.",
  "2500009": "Addiko Bank d.d.",
  "2485003": "Croatia banka d.d.",
  "2330003": "Splitska banka d.d.",
  "2411006": "Jadranska banka d.d.",
  "2481000": "Kreditna banka Zagreb d.d.",
  "2381009": "Podravska banka d.d.",
  "2412009": "Slatinska banka d.d.",
  "2380006": "Istarska kreditna banka Umag d.d.",
  "2386002": "Banka Kovanica d.d.",
  "2521004": "KentBank d.d.",
  "2495009": "Nava banka d.d.",
  "2489004": "Agram banka d.d.",
  "2492008": "Imex banka d.d.",
  "2393000": "Slavonska banka d.d.",
  "2423001": "Partner banka d.d.",
  "3206300": "Revolut Bank UAB"
};

/**
 * Extract bank code (VBDI) from Croatian IBAN
 * @param iban - Croatian IBAN string (HR + 19 digits)
 * @returns 7-digit bank code or null if invalid format
 */
export function extractBankCodeFromIban(iban: string): string | null {
  if (!iban) return null;

  // Clean and uppercase
  const cleaned = iban.toUpperCase().replace(/\s/g, '');

  // Must be Croatian IBAN format: HR + 19 digits
  if (!/^HR\d{19}$/.test(cleaned)) {
    return null;
  }

  // Extract positions 5-11 (7-digit bank code)
  // Format: HR KK BBBB B00 CCCC CCCC C
  // Where: HR = country, KK = checksum (2 digits), BBBB B00 = bank code (7 digits)
  return cleaned.substring(4, 11);
}

/**
 * Get bank name from Croatian IBAN
 * @param iban - Croatian IBAN string
 * @returns Bank name or null if not found
 */
export function getBankNameFromIban(iban: string): string | null {
  const bankCode = extractBankCodeFromIban(iban);
  if (!bankCode) return null;
  
  return CROATIAN_BANKS[bankCode] || null;
}

/**
 * Validate Croatian IBAN format and checksum
 * @param iban - IBAN to validate
 * @returns true if valid Croatian IBAN
 */
export function isValidCroatianIban(iban: string): boolean {
  if (!iban) return false;
  
  const cleaned = iban.toUpperCase().replace(/\s/g, '');
  
  // Basic format check
  if (!/^HR\d{19}$/.test(cleaned)) {
    return false;
  }
  
  // Basic IBAN validation (simplified)
  // Note: Full IBAN validation is more complex, this covers most cases
  const countryCode = 'HR';
  const checkDigits = cleaned.substring(2, 4);
  const basicAccountNumber = cleaned.substring(4);
  
  // Convert to numeric check (simplified)
  const rearranged = basicAccountNumber + countryCode + checkDigits;
  const numeric = Array.from(rearranged).map(char => {
    const code = char.charCodeAt(0);
    return (code >= 65 && code <= 90) ? (code - 55).toString() : char;
  }).join('');
  
  // Check if numeric representation mod 97 === 1 (simplified)
  // Note: In production, use a proper IBAN validation library
  try {
    const remainder = Array.from(numeric).reduce((acc, digit) => {
      return (acc * 10 + parseInt(digit, 10)) % 97;
    }, 0);
    return remainder === 1;
  } catch {
    return false;
  }
}

/**
 * Format IBAN with spaces for readability
 * @param iban - Raw IBAN
 * @returns Formatted IBAN (HR12 1234 5678 9012 3456 789)
 */
export function formatIban(iban: string): string {
  if (!iban) return '';
  
  const cleaned = iban.toUpperCase().replace(/\s/g, '');
  
  // Format as HR12 1234 5678 9012 3456 789
  if (cleaned.length === 21) {
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  }
  
  return cleaned;
}

/**
 * Get default currency for Croatian IBAN
 * @param iban - Croatian IBAN
 * @returns 'EUR' for Croatian IBANs
 */
export function getCurrencyFromIban(iban: string): string {
  if (iban.toUpperCase().startsWith('HR')) {
    return 'EUR';
  }
  return 'EUR'; // Default to EUR for non-Croatian
}