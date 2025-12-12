// Lightweight helper for Croatian postal code ↔ city suggestions.
// Not exhaustive, but covers the most common destinations to speed up entry.
const HR_POSTAL_MAP: Record<string, string> = {
  "10000": "Zagreb",
  "10110": "Zagreb",
  "10290": "Zaprešić",
  "10360": "Sesvete",
  "20000": "Dubrovnik",
  "21000": "Split",
  "21220": "Trogir",
  "21300": "Makarska",
  "22000": "Šibenik",
  "23000": "Zadar",
  "31000": "Osijek",
  "31500": "Našice",
  "32000": "Vukovar",
  "33000": "Virovitica",
  "34000": "Požega",
  "35000": "Slavonski Brod",
  "40000": "Čakovec",
  "42000": "Varaždin",
  "42220": "Novi Marof",
  "43000": "Bjelovar",
  "44000": "Sisak",
  "47000": "Karlovac",
  "48000": "Koprivnica",
  "49000": "Krapina",
  "51000": "Rijeka",
  "52100": "Pula",
  "53000": "Gospić",
}

export function lookupCityByPostalCode(postalCode?: string): string | undefined {
  if (!postalCode) return undefined
  const normalized = postalCode.trim()
  return HR_POSTAL_MAP[normalized]
}

export function lookupPostalByCity(city?: string): string | undefined {
  if (!city) return undefined
  const normalized = city.trim().toLowerCase()
  const entry = Object.entries(HR_POSTAL_MAP).find(
    ([, cityName]) => cityName.toLowerCase() === normalized
  )
  return entry?.[0]
}
