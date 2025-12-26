// src/lib/regulatory-truth/taxonomy/seed-taxonomy.ts
import { db } from "@/lib/db"

interface TaxonomySeed {
  slug: string
  nameHr: string
  nameEn?: string
  parentSlug?: string
  synonyms?: string[]
  hyponyms?: string[]
  legalCategory?: string
  vatCategory?: string
  searchTerms?: string[]
}

const INITIAL_TAXONOMY: TaxonomySeed[] = [
  // === VAT RATES HIERARCHY ===
  {
    slug: "pdv-stopa",
    nameHr: "PDV stopa",
    nameEn: "VAT rate",
    searchTerms: ["vat", "pdv", "porez na dodanu vrijednost"],
  },
  {
    slug: "pdv-stopa-25",
    nameHr: "Standardna stopa PDV-a 25%",
    nameEn: "Standard VAT rate 25%",
    parentSlug: "pdv-stopa",
    legalCategory: "standardna-stopa",
    vatCategory: "25%",
    synonyms: ["puna stopa", "redovna stopa"],
    searchTerms: ["25%", "dvadeset pet posto"],
  },
  {
    slug: "pdv-stopa-13",
    nameHr: "Snižena stopa PDV-a 13%",
    nameEn: "Reduced VAT rate 13%",
    parentSlug: "pdv-stopa",
    legalCategory: "snižena-stopa",
    vatCategory: "13%",
    synonyms: ["srednja stopa"],
    searchTerms: ["13%", "trinaest posto"],
  },
  {
    slug: "pdv-stopa-5",
    nameHr: "Snižena stopa PDV-a 5%",
    nameEn: "Reduced VAT rate 5%",
    parentSlug: "pdv-stopa",
    legalCategory: "snižena-stopa-5",
    vatCategory: "5%",
    searchTerms: ["5%", "pet posto"],
  },
  {
    slug: "pdv-oslobodeno",
    nameHr: "Oslobođeno PDV-a",
    nameEn: "VAT exempt",
    parentSlug: "pdv-stopa",
    legalCategory: "oslobodeno",
    vatCategory: "0%",
    synonyms: ["bez pdv", "nulta stopa"],
    searchTerms: ["0%", "oslobođenje"],
  },

  // === PRODUCT CATEGORIES ===
  {
    slug: "hrana",
    nameHr: "Hrana",
    nameEn: "Food",
    legalCategory: "prehrambeni-proizvodi",
    vatCategory: "5%",
    synonyms: ["namirnice", "prehrambeni proizvodi"],
    searchTerms: ["food", "hrana"],
  },
  {
    slug: "pice",
    nameHr: "Piće",
    nameEn: "Beverage",
    parentSlug: "hrana",
    legalCategory: "pića",
    searchTerms: ["drink", "piće", "napitak"],
  },
  {
    slug: "bezalkoholno-pice",
    nameHr: "Bezalkoholno piće",
    nameEn: "Non-alcoholic beverage",
    parentSlug: "pice",
    legalCategory: "bezalkoholno-piće",
    vatCategory: "5%",
    synonyms: ["soft drink", "osvježavajuće piće"],
    hyponyms: ["sok", "voda", "čaj"],
    searchTerms: ["soft drink", "bezalkoholno"],
  },
  {
    slug: "sok",
    nameHr: "Sok",
    nameEn: "Juice",
    parentSlug: "bezalkoholno-pice",
    legalCategory: "voćni-sok",
    vatCategory: "5%",
    synonyms: ["juice", "voćni sok", "prirodni sok"],
    hyponyms: ["jabučni sok", "narančin sok", "sok od naranče"],
    searchTerms: ["juice", "sok", "voćni"],
  },
  {
    slug: "alkoholno-pice",
    nameHr: "Alkoholno piće",
    nameEn: "Alcoholic beverage",
    parentSlug: "pice",
    legalCategory: "alkoholno-piće",
    vatCategory: "25%",
    synonyms: ["alkohol", "alcoholic drink"],
    hyponyms: ["pivo", "vino", "žestoko piće"],
    searchTerms: ["alcohol", "alkohol", "alkoholno"],
  },
  {
    slug: "pivo",
    nameHr: "Pivo",
    nameEn: "Beer",
    parentSlug: "alkoholno-pice",
    legalCategory: "pivo",
    vatCategory: "25%",
    synonyms: ["beer", "lager", "ale"],
    searchTerms: ["beer", "pivo"],
  },
  {
    slug: "vino",
    nameHr: "Vino",
    nameEn: "Wine",
    parentSlug: "alkoholno-pice",
    legalCategory: "vino",
    vatCategory: "25%",
    synonyms: ["wine", "grape wine"],
    hyponyms: ["crno vino", "bijelo vino", "rose"],
    searchTerms: ["wine", "vino"],
  },

  // === TAXPAYER TYPES ===
  {
    slug: "porezni-obveznik",
    nameHr: "Porezni obveznik",
    nameEn: "Taxpayer",
    searchTerms: ["taxpayer", "porezni obveznik", "obveznik"],
  },
  {
    slug: "pausalni-obrt",
    nameHr: "Paušalni obrt",
    nameEn: "Lump-sum business",
    parentSlug: "porezni-obveznik",
    legalCategory: "paušalno-oporezivanje",
    synonyms: ["pausalni obrtnik", "pausalist"],
    searchTerms: ["pausalni", "lump sum", "flat rate"],
  },
  {
    slug: "doo",
    nameHr: "Društvo s ograničenom odgovornošću",
    nameEn: "Limited liability company",
    parentSlug: "porezni-obveznik",
    legalCategory: "doo",
    synonyms: ["d.o.o.", "LLC"],
    searchTerms: ["doo", "d.o.o.", "LLC", "društvo"],
  },

  // === TAX DOMAINS ===
  {
    slug: "pdv-domena",
    nameHr: "PDV",
    nameEn: "VAT",
    synonyms: ["vat", "value added tax", "porez na dodanu vrijednost"],
    searchTerms: ["pdv", "vat", "ddv"],
  },
  {
    slug: "dohodak-domena",
    nameHr: "Porez na dohodak",
    nameEn: "Income tax",
    synonyms: ["income tax", "personal income tax"],
    searchTerms: ["dohodak", "income tax", "porez na dohodak"],
  },
  {
    slug: "doprinosi-domena",
    nameHr: "Doprinosi",
    nameEn: "Contributions",
    synonyms: ["social contributions", "insurance contributions"],
    searchTerms: ["doprinosi", "contributions", "osiguranje"],
  },
]

/**
 * Seed the initial Croatian regulatory taxonomy
 */
export async function seedTaxonomy(): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0

  // First pass: create all concepts without parents
  for (const seed of INITIAL_TAXONOMY) {
    const existing = await db.conceptNode.findUnique({
      where: { slug: seed.slug },
    })

    if (existing) {
      // Update existing
      await db.conceptNode.update({
        where: { slug: seed.slug },
        data: {
          nameHr: seed.nameHr,
          nameEn: seed.nameEn,
          synonyms: seed.synonyms ?? [],
          hyponyms: seed.hyponyms ?? [],
          legalCategory: seed.legalCategory,
          vatCategory: seed.vatCategory,
          searchTerms: seed.searchTerms ?? [],
        },
      })
      updated++
    } else {
      // Create new
      await db.conceptNode.create({
        data: {
          slug: seed.slug,
          nameHr: seed.nameHr,
          nameEn: seed.nameEn,
          synonyms: seed.synonyms ?? [],
          hyponyms: seed.hyponyms ?? [],
          legalCategory: seed.legalCategory,
          vatCategory: seed.vatCategory,
          searchTerms: seed.searchTerms ?? [],
        },
      })
      created++
    }
  }

  // Second pass: set parent relationships
  for (const seed of INITIAL_TAXONOMY) {
    if (seed.parentSlug) {
      const parent = await db.conceptNode.findUnique({
        where: { slug: seed.parentSlug },
      })

      if (parent) {
        await db.conceptNode.update({
          where: { slug: seed.slug },
          data: { parentId: parent.id },
        })
      }
    }
  }

  console.log(`[seed-taxonomy] Created ${created}, updated ${updated} concepts`)
  return { created, updated }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  seedTaxonomy()
    .then((result) => {
      console.log(`Seeding complete: ${result.created} created, ${result.updated} updated`)
      process.exit(0)
    })
    .catch((error) => {
      console.error("Seeding failed:", error)
      process.exit(1)
    })
}
