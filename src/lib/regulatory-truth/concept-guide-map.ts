/**
 * Maps regulatory concepts to affected MDX guide slugs.
 * Used by content bridge to determine which guides need updating.
 */
export const CONCEPT_GUIDE_MAP: Record<string, string[]> = {
  // VAT/PDV related
  pdv: ["pdv", "pausalni-pdv", "fiskalizacija"],
  "pdv-threshold": ["pdv", "pausalni-obrt", "obrt-dohodak"],
  "pdv-rates": ["pdv", "fiskalizacija"],

  // Pausalni related
  pausalni: ["pausalni-obrt", "pausalni-obrt-uz-zaposlenje"],
  "pausalni-limit": ["pausalni-obrt", "pausalni-obrt-uz-zaposlenje", "pausalni-obrt-umirovljenik"],

  // Fiskalizacija
  fiskalizacija: ["fiskalizacija", "pos"],
  "fiskal-certificates": ["fiskalizacija"],

  // Contributions/Doprinosi
  doprinosi: ["pausalni-obrt", "obrt-dohodak", "doo", "slobodna-profesija"],
  "mirovinsko-osiguranje": ["pausalni-obrt", "obrt-dohodak"],
  "zdravstveno-osiguranje": ["pausalni-obrt", "obrt-dohodak"],

  // Business forms
  obrt: ["obrt-dohodak", "pausalni-obrt", "sezonski-obrt"],
  doo: ["doo", "jdoo", "doo-direktor-s-placom", "doo-direktor-bez-place"],
  jdoo: ["jdoo"],

  // Deadlines
  "porezna-prijava": ["pausalni-obrt", "obrt-dohodak", "doo"],
  "godisnji-obracun": ["pausalni-obrt", "doo"],
}

/**
 * Get the list of MDX guide slugs affected by a regulatory concept.
 * @param conceptId - The regulatory concept identifier
 * @returns Array of guide slugs that should be updated when this concept changes
 */
export function getAffectedGuides(conceptId: string): string[] {
  return CONCEPT_GUIDE_MAP[conceptId] || []
}

/**
 * Get all regulatory concepts that affect a specific guide.
 * @param guideSlug - The MDX guide slug
 * @returns Array of concept IDs that affect this guide
 */
export function getConceptsForGuide(guideSlug: string): string[] {
  const concepts: string[] = []
  for (const [concept, guides] of Object.entries(CONCEPT_GUIDE_MAP)) {
    if (guides.includes(guideSlug)) {
      concepts.push(concept)
    }
  }
  return concepts
}
