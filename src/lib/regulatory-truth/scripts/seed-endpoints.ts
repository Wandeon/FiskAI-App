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
    metadata: { types: [1, 2, 3] }, // Include Type 3 (Oglasni) - may contain relevant business content
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
    // FIXED: URL was wrong - verified correct path 2026-01-05
    domain: "www.hnb.hr",
    path: "/statistika/statisticki-podaci/financijski-sektor/sredisnja-banka-hnb/devizni-tecajevi/referentni-tecajevi-esb-a",
    name: "HNB - Devizni tečajevi (ECB referentni)",
    endpointType: "STATISTICS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: { verified: "2026-01-05", note: "ECB reference rates via HNB" },
  },
  {
    domain: "www.hok.hr", // FIXED: hok.hr requires www prefix (verified 2026-01-05)
    path: "/novosti/novosti-iz-hok",
    name: "HOK - Novosti iz HOK-a",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
    paginationPattern: "?page={N}",
    metadata: { domain: "pausalni", focus: "membership fees and craftsmen regulations" },
  },

  // Tier 2: HIGH (daily)
  {
    domain: "www.hok.hr", // FIXED: hok.hr requires www prefix (verified 2026-01-05)
    path: "/aktualno",
    name: "HOK - Aktualno",
    endpointType: "ANNOUNCEMENTS" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: { domain: "pausalni", focus: "current announcements and updates for craftsmen" },
  },
  {
    domain: "www.hok.hr", // FIXED: hok.hr requires www prefix (verified 2026-01-05)
    path: "/medunarodna-suradnja-i-eu/novosti-i-dogadanja",
    name: "HOK - Novosti i događanja",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: { domain: "pausalni", focus: "EU and international cooperation news" },
  },
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
  // DZS - FIXED: dzs.hr redirects to dzs.gov.hr (verified 2026-01-05)
  {
    domain: "dzs.gov.hr",
    path: "/vijesti/8",
    name: "DZS - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "PAGINATION" as const,
    paginationPattern: "?page={N}",
    metadata: { verified: "2026-01-05", totalItems: 586 },
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
  // EUR-Lex: REMOVED - All 4 RSS endpoints return 404 (verified 2026-01-05)
  // Access method needs research - RSS URL format was incorrect
  // Status: INCOMPLETE - EU law coverage blocked until correct API identified
  // ==========================================================================

  // ==========================================================================
  // NEW VERIFIED ENDPOINTS (added 2026-01-05)
  // ==========================================================================

  // Sabor - Parliamentary press releases (VERIFIED: 200, 9380 items)
  {
    domain: "sabor.hr",
    path: "/hr/press/priopcenja",
    name: "Sabor - Priopćenja",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "PAGINATION" as const,
    paginationPattern: "?page={N}",
    metadata: { domain: "zakonodavstvo", totalItems: 9380, verified: "2026-01-05" },
  },

  // Vlada - Government news (VERIFIED: 200)
  {
    domain: "vlada.gov.hr",
    path: "/vijesti/8",
    name: "Vlada - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "EVERY_RUN" as const,
    listingStrategy: "PAGINATION" as const,
    paginationPattern: "?page={N}",
    metadata: { domain: "vlada", focus: "government announcements", verified: "2026-01-05" },
  },

  // e-Savjetovanja - Public consultations (VERIFIED: 200, public view)
  {
    domain: "esavjetovanja.gov.hr",
    path: "/ECon/Dashboard",
    name: "e-Savjetovanja - Otvorena savjetovanja",
    endpointType: "CONSULTATIONS" as const,
    priority: "CRITICAL" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: {
      domain: "zakonodavstvo",
      authRequired: "partial", // public view, login to comment
      note: "Use /ECon/Dashboard NOT /ECon/MainScreen",
      verified: "2026-01-05",
    },
  },

  // HANFA - Financial services regulator (VERIFIED: 200)
  {
    domain: "hanfa.hr",
    path: "/vijesti/",
    name: "HANFA - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: {
      domain: "financije",
      paginationType: "load-more",
      itemsPerPage: 20,
      verified: "2026-01-05",
    },
  },

  // AZOP - Data protection authority (VERIFIED: 200)
  {
    domain: "azop.hr",
    path: "/novosti/",
    name: "AZOP - Novosti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: { domain: "gdpr", sitemap: "/sitemap_index.xml", verified: "2026-01-05" },
  },
  // ==========================================================================
  // HEADLESS-REQUIRED SOURCES (JS-rendered sites requiring Playwright)
  // ==========================================================================

  // HGK - Croatian Chamber of Economy (JS-rendered, requires headless browser)
  // Status: BLOCKED without headless - returns HTTP 500 on direct fetch
  // See: docs/regulatory-sources/SOURCE_COVERAGE_DECLARATIONS.md
  {
    domain: "hgk.hr",
    path: "/vijesti",
    name: "HGK - Vijesti",
    endpointType: "NEWS_LISTING" as const,
    priority: "HIGH" as const,
    scrapeFrequency: "DAILY" as const,
    listingStrategy: "HTML_LIST" as const,
    metadata: {
      requiresHeadless: true,
      verified: "2026-01-05",
      notes: "JS-rendered site, requires Playwright for content extraction",
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

void main()
  .catch(async (error) => {
    console.error("[seed] Error:", error)
    await pool.end()
    process.exit(1)
  })
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
