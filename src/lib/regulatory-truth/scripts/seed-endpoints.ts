// src/lib/regulatory-truth/scripts/seed-endpoints.ts
import { config } from "dotenv"
import { Pool } from "pg"
import { randomBytes } from "crypto"

// Load environment variables
config({ path: ".env.local" })
config({ path: ".env" })

// Create pool for direct SQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Generate cuid-like ID
function generateId(): string {
  return randomBytes(12).toString("base64url").slice(0, 24)
}

const endpoints = [
  // Tier 1: CRITICAL (every run)
  {
    domain: "narodne-novine.nn.hr",
    path: "/sitemap.xml",
    name: "Narodne novine - Main Sitemap",
    endpointType: "SITEMAP_INDEX" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "SITEMAP_XML" as const,
    urlPattern: "sitemap_\\d_\\d{4}_\\d+\\.xml",
    metadata: { types: [1, 2], skipType3: true },
  },
  {
    domain: "hzzo.hr",
    path: "/novosti",
    name: "HZZO - Novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
    paginationPattern: "?page={N}",
  },
  {
    domain: "hzzo.hr",
    path: "/pravni-akti",
    name: "HZZO - Pravni akti",
    endpointType: "LEGAL_ACTS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/vijesti/114",
    name: "HZMO - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/priopcenja-204/204",
    name: "HZMO - Priopcenja",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/propisi/54",
    name: "HZMO - Propisi",
    endpointType: "LEGAL_ACTS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/HR_o_nama/Stranice/mapa-weba.aspx",
    name: "Porezna Uprava - Sitemap/Web Map",
    endpointType: "SITEMAP_INDEX" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: { comprehensive: true, hierarchical: true },
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/vijesti/8",
    name: "Porezna - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/misljenja-su/3951",
    name: "Porezna - Mišljenja SU",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "fina.hr",
    path: "/obavijesti/fina-e-racun",
    name: "FINA - e-Račun obavijesti",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "fina.hr",
    path: "/novosti",
    name: "FINA - Novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "mfin.gov.hr",
    path: "/vijesti/8",
    name: "Ministarstvo financija - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "mrosp.gov.hr",
    path: "/vijesti/8",
    name: "MRMS - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "hnb.hr",
    path: "/javnost-rada/priopcenja",
    name: "HNB - Priopćenja",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/statistika/statisticka-priopcenja",
    name: "HNB - Statistička priopćenja",
    endpointType: "STATISTICS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/devizni-tecajevi/referentni-tecajevi-esb-a",
    name: "HNB - Devizni tečajevi",
    endpointType: "STATISTICS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
  },

  // Tier 2: HIGH (daily)
  {
    domain: "hzzo.hr",
    path: "/e-zdravstveno/novosti",
    name: "HZZO - e-Zdravstveno novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hzzo.hr",
    path: "/poslovni-subjekti/hzzo-za-partnere/sifrarnici-hzzo-0",
    name: "HZZO - Šifrarnici",
    endpointType: "CODE_LISTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hzzo.hr",
    path: "/zdravstvena-zastita/objavljene-liste-lijekova",
    name: "HZZO - Liste lijekova",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/doplatak-za-djecu/12",
    name: "HZMO - Doplatak za djecu",
    endpointType: "LEGAL_ACTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/statistika/860",
    name: "HZMO - Statistika",
    endpointType: "STATISTICS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/propisi-3950/3950",
    name: "Porezna - Propisi",
    endpointType: "LEGAL_ACTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "fina.hr",
    path: "/obavijesti/e-racun-u-javnoj-nabavi",
    name: "FINA - e-Račun javna nabava",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "fina.hr",
    path: "/obavijesti/digitalni-certifikati",
    name: "FINA - Digitalni certifikati",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "PAGINATION" as const,
  },
  {
    domain: "mfin.gov.hr",
    path: "/istaknute-teme/zakoni-i-propisi/523",
    name: "Ministarstvo financija - Zakoni i propisi",
    endpointType: "LEGAL_ACTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/redovne-publikacije/bilten",
    name: "HNB - Bilten",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/redovne-publikacije/financijska-stabilnost",
    name: "HNB - Izvješće o financijskoj stabilnosti",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/statistika/kalendar-objava",
    name: "HNB - Kalendar objava",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/javnost-rada/novosti",
    name: "HNB - Novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "dzs.hr",
    path: "/hr/novosti",
    name: "DZS - Novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "dzs.hr",
    path: "/hr/publikacije",
    name: "DZS - Publikacije i statistički podaci",
    endpointType: "STATISTICS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
  },

  // Tier 3: MEDIUM (twice weekly)
  {
    domain: "hzzo.hr",
    path: "/natjecaji",
    name: "HZZO - Natječaji",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hzzo.hr",
    path: "/o-nama/upravno-vijece/odluke-uv",
    name: "HZZO - Odluke upravnog vijeća",
    endpointType: "LEGAL_ACTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hzzo.hr",
    path: "/pravo-na-pristup-informacijama/savjetovanje-s-javnoscu-o-nacrtima-zakona-i-drugih-propisa",
    name: "HZZO - Savjetovanja s javnošću",
    endpointType: "CONSULTATIONS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/tiskanice-1098/1098",
    name: "HZMO - Tiskanice",
    endpointType: "FORMS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/prijave-i-odjave-na-osiguranje/234",
    name: "HZMO - Prijave i odjave",
    endpointType: "LEGAL_ACTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/pitanja-i-odgovori-vezani-uz-zakon-o-fiskalizaciji-8031/8031",
    name: "Porezna - Fiskalizacija FAQ",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/propisani-obrasci/3955",
    name: "Porezna - Propisani obrasci",
    endpointType: "FORMS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "fina.hr",
    path: "/digitalizacija-poslovanja/e-racun",
    name: "FINA - e-Račun info",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mfin.gov.hr",
    path: "/istaknute-teme/javne-konzultacije/524",
    name: "Ministarstvo financija - Javne konzultacije",
    endpointType: "CONSULTATIONS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/redovne-publikacije/bilten-o-bankama",
    name: "HNB - Bilten o bankama",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/platni-sustav",
    name: "HNB - Platni sustav",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/bankarski-sustav/propisi",
    name: "HNB - Bankarski propisi",
    endpointType: "LEGAL_ACTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },

  // Tier 4: LOW (weekly)
  {
    domain: "hzzo.hr",
    path: "/lijecnicki-pregledi/uputnice-i-potvrde",
    name: "HZZO - Uputnice i potvrde",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "LOW" as const,
    scrapeFrequency: "WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "mirovinsko.hr",
    path: "/hr/misljenja-ministarstva/56",
    name: "HZMO - Mišljenja ministarstva",
    endpointType: "LEGAL_ACTS" as const,
    priority: "LOW" as const,
    scrapeFrequency: "WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "porezna-uprava.gov.hr",
    path: "/hr/porezni-sustav/3954",
    name: "Porezna - Porezni sustav",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "LOW" as const,
    scrapeFrequency: "WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "fina.hr",
    path: "/poslovne-informacije/bon",
    name: "FINA - BON informacije",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "LOW" as const,
    scrapeFrequency: "WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },
  {
    domain: "hnb.hr",
    path: "/redovne-publikacije/godisnje-izvjesce",
    name: "HNB - Godišnje izvješće",
    endpointType: "TECHNICAL_DOCS" as const,
    priority: "LOW" as const,
    scrapeFrequency: "WEEKLY" as const,
    listingStrategy: "HTML_LIST" as const,
  },

  // ==========================================================================
  // EUR-Lex: EU Legislation RSS Feeds (Croatian-relevant)
  // ==========================================================================
  {
    domain: "eur-lex.europa.eu",
    path: "/EN/display-rss.do?lang=HR&eurovoc=8471", // VAT - Taxation
    name: "EUR-Lex - VAT & Taxation (HR)",
    endpointType: "LEGAL_ACTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "RSS_FEED" as const,
    metadata: {
      domain: "pdv",
      language: "HR",
      eurovoc: "8471", // VAT subject code
      description: "EU VAT directives and regulations relevant to Croatia",
    },
  },
  {
    domain: "eur-lex.europa.eu",
    path: "/EN/display-rss.do?lang=HR&eurovoc=8464", // Invoicing
    name: "EUR-Lex - Invoicing & E-invoicing (HR)",
    endpointType: "LEGAL_ACTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "RSS_FEED" as const,
    metadata: {
      domain: "fiskalizacija",
      language: "HR",
      eurovoc: "8464",
      description: "EU invoicing and e-invoicing directives",
    },
  },
  {
    domain: "eur-lex.europa.eu",
    path: "/EN/display-rss.do?lang=HR&type_doc=DIR&type_doc=REG", // Directives and Regulations only
    name: "EUR-Lex - Croatian EU Law Updates",
    endpointType: "LEGAL_ACTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "RSS_FEED" as const,
    metadata: {
      domain: "pausalni",
      language: "HR",
      description: "General EU directives and regulations applicable to Croatia",
    },
  },
  {
    domain: "eur-lex.europa.eu",
    path: "/EN/display-rss.do?lang=HR&eurovoc=1954", // Social security
    name: "EUR-Lex - Social Security (HR)",
    endpointType: "LEGAL_ACTS" as const,
    priority: "MEDIUM" as const,
    scrapeFrequency: "TWICE_WEEKLY" as const,
    listingStrategy: "RSS_FEED" as const,
    metadata: {
      domain: "doprinosi",
      language: "HR",
      eurovoc: "1954",
      description: "EU social security and contributions regulations",
    },
  },
]

async function main() {
  console.log("Seeding discovery endpoints...")

  const client = await pool.connect()
  try {
    for (const endpoint of endpoints) {
      // Check if endpoint already exists
      const existing = await client.query(
        `SELECT id FROM "DiscoveryEndpoint" WHERE domain = $1 AND path = $2`,
        [endpoint.domain, endpoint.path]
      )

      const now = new Date()
      const metadata = endpoint.metadata ? JSON.stringify(endpoint.metadata) : null

      if (existing.rows.length > 0) {
        // Update existing endpoint
        await client.query(
          `UPDATE "DiscoveryEndpoint"
           SET name = $1,
               "endpointType" = $2,
               priority = $3,
               "scrapeFrequency" = $4,
               "listingStrategy" = $5,
               "urlPattern" = $6,
               "paginationPattern" = $7,
               metadata = $8,
               "updatedAt" = $9
           WHERE domain = $10 AND path = $11`,
          [
            endpoint.name,
            endpoint.endpointType,
            endpoint.priority,
            endpoint.scrapeFrequency,
            endpoint.listingStrategy,
            endpoint.urlPattern || null,
            endpoint.paginationPattern || null,
            metadata,
            now,
            endpoint.domain,
            endpoint.path,
          ]
        )
        console.log(`  ↻ ${endpoint.domain}${endpoint.path}`)
      } else {
        // Create new endpoint
        const id = generateId()
        await client.query(
          `INSERT INTO "DiscoveryEndpoint" (
            id, domain, path, name, "endpointType", priority,
            "scrapeFrequency", "listingStrategy", "urlPattern",
            "paginationPattern", "lastScrapedAt", "lastContentHash",
            "itemCount", "errorCount", "consecutiveErrors", "lastError",
            "isActive", metadata, "createdAt", "updatedAt"
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            id,
            endpoint.domain,
            endpoint.path,
            endpoint.name,
            endpoint.endpointType,
            endpoint.priority,
            endpoint.scrapeFrequency,
            endpoint.listingStrategy,
            endpoint.urlPattern || null,
            endpoint.paginationPattern || null,
            null, // lastScrapedAt
            null, // lastContentHash
            0, // itemCount
            0, // errorCount
            0, // consecutiveErrors
            null, // lastError
            true, // isActive
            metadata,
            now,
            now,
          ]
        )
        console.log(`  ✓ ${endpoint.domain}${endpoint.path}`)
      }
    }

    console.log(`\nSeeded ${endpoints.length} discovery endpoints`)
  } finally {
    client.release()
  }
}

main()
  .catch(async (error) => {
    console.error("[seed] Error:", error)
    await pool.end()
    process.exit(1)
  })
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
