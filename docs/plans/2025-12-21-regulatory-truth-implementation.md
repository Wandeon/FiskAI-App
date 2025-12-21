# Croatian Regulatory Truth Layer - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready, self-healing, observable regulatory knowledge base from Croatian government sources with a 06:00 AM daily cycle.

**Architecture:** 6-agent pipeline (Sentinel → Extractor → Composer → Reviewer → Releaser + Arbiter) with discovery endpoints, rate limiting, circuit breakers, and admin dashboard. Uses Prisma/PostgreSQL for storage, Ollama for LLM inference, and cron for scheduling.

**Tech Stack:** Next.js 15, Prisma 7, PostgreSQL, Ollama, node-cron, Zod validation

---

## Phase 1: Foundation (Database Schema & Core Infrastructure)

### Task 1.1: Add DiscoveryEndpoint and DiscoveredItem to Prisma Schema

**Files:**

- Modify: `/home/admin/FiskAI/prisma/schema.prisma`

**Step 1: Add enums for discovery system**

Add after line ~1600 (before the Evidence model):

```prisma
enum DiscoveryEndpointType {
  SITEMAP_INDEX
  SITEMAP_ISSUE
  NEWS_LISTING
  LEGAL_ACTS
  CONSULTATIONS
  TECHNICAL_DOCS
  FORMS
  CODE_LISTS
  ANNOUNCEMENTS
  STATISTICS
}

enum DiscoveryPriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ScrapeFrequency {
  EVERY_RUN
  DAILY
  TWICE_WEEKLY
  WEEKLY
  MONTHLY
}

enum ListingStrategy {
  SITEMAP_XML
  HTML_LIST
  HTML_TABLE
  PAGINATION
  DATE_FILTERED
}

enum DiscoveredItemStatus {
  PENDING
  FETCHED
  PROCESSED
  SKIPPED
  FAILED
}
```

**Step 2: Add DiscoveryEndpoint model**

```prisma
model DiscoveryEndpoint {
  id                String                @id @default(cuid())
  domain            String                // e.g., "hzzo.hr"
  path              String                // e.g., "/novosti"
  name              String                // Human-readable name
  endpointType      DiscoveryEndpointType
  priority          DiscoveryPriority
  scrapeFrequency   ScrapeFrequency
  listingStrategy   ListingStrategy
  urlPattern        String?               // Regex for extracting item URLs
  paginationPattern String?               // e.g., "?page={N}"
  lastScrapedAt     DateTime?
  lastContentHash   String?               // SHA-256 of page content
  itemCount         Int                   @default(0)
  errorCount        Int                   @default(0)
  consecutiveErrors Int                   @default(0)
  lastError         String?
  isActive          Boolean               @default(true)
  metadata          Json?                 // Additional endpoint-specific config
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  discoveries       DiscoveredItem[]

  @@unique([domain, path])
  @@index([priority])
  @@index([lastScrapedAt])
}
```

**Step 3: Add DiscoveredItem model**

```prisma
model DiscoveredItem {
  id            String               @id @default(cuid())
  endpointId    String
  url           String
  title         String?
  publishedAt   DateTime?
  contentHash   String?
  status        DiscoveredItemStatus @default(PENDING)
  processedAt   DateTime?
  evidenceId    String?              // Link to Evidence if fetched
  errorMessage  String?
  retryCount    Int                  @default(0)
  createdAt     DateTime             @default(now())

  endpoint      DiscoveryEndpoint    @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@unique([endpointId, url])
  @@index([status])
  @@index([publishedAt])
  @@index([evidenceId])
}
```

**Step 4: Run migration**

Run: `npx prisma migrate dev --name add-discovery-models`
Expected: Migration applies successfully

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(regulatory): add DiscoveryEndpoint and DiscoveredItem models"
```

---

### Task 1.2: Add Concept Model to Prisma Schema

**Files:**

- Modify: `/home/admin/FiskAI/prisma/schema.prisma`

**Step 1: Add Concept model**

Add after SourcePointer model:

```prisma
model Concept {
  id          String   @id @default(cuid())
  slug        String   @unique  // e.g., "pausalni-obrt"
  nameHr      String
  nameEn      String?
  aliases     String[] // Alternative names
  tags        String[] // Categorization tags
  description String?  @db.Text
  parentId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  parent      Concept?  @relation("ConceptHierarchy", fields: [parentId], references: [id])
  children    Concept[] @relation("ConceptHierarchy")
  rules       RegulatoryRule[]

  @@index([parentId])
}
```

**Step 2: Update RegulatoryRule to reference Concept**

Add to RegulatoryRule model:

```prisma
  conceptId     String?
  concept       Concept?  @relation(fields: [conceptId], references: [id])
```

**Step 3: Run migration**

Run: `npx prisma migrate dev --name add-concept-model`
Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(regulatory): add Concept model with hierarchy support"
```

---

### Task 1.3: Add Knowledge Graph Models

**Files:**

- Modify: `/home/admin/FiskAI/prisma/schema.prisma`

**Step 1: Add GraphEdgeType enum**

```prisma
enum GraphEdgeType {
  AMENDS
  INTERPRETS
  REQUIRES
  EXEMPTS
  DEPENDS_ON
  SUPERSEDES
}
```

**Step 2: Add GraphEdge model**

```prisma
model GraphEdge {
  id         String        @id @default(cuid())
  fromRuleId String
  toRuleId   String
  relation   GraphEdgeType
  validFrom  DateTime
  validTo    DateTime?
  notes      String?
  createdAt  DateTime      @default(now())

  fromRule   RegulatoryRule @relation("EdgeFrom", fields: [fromRuleId], references: [id], onDelete: Cascade)
  toRule     RegulatoryRule @relation("EdgeTo", fields: [toRuleId], references: [id], onDelete: Cascade)

  @@unique([fromRuleId, toRuleId, relation])
  @@index([fromRuleId])
  @@index([toRuleId])
}
```

**Step 3: Add relations to RegulatoryRule**

Add to RegulatoryRule model:

```prisma
  outgoingEdges GraphEdge[] @relation("EdgeFrom")
  incomingEdges GraphEdge[] @relation("EdgeTo")
```

**Step 4: Run migration**

Run: `npx prisma migrate dev --name add-knowledge-graph`
Expected: Migration applies successfully

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(regulatory): add GraphEdge model for knowledge graph"
```

---

### Task 1.4: Create Discovery Endpoint Seeding Script

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/scripts/seed-endpoints.ts`

**Step 1: Write the seeding script**

```typescript
// src/lib/regulatory-truth/scripts/seed-endpoints.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
]

async function main() {
  console.log("Seeding discovery endpoints...")

  for (const endpoint of endpoints) {
    await prisma.discoveryEndpoint.upsert({
      where: {
        domain_path: {
          domain: endpoint.domain,
          path: endpoint.path,
        },
      },
      update: endpoint,
      create: endpoint,
    })
    console.log(`  ✓ ${endpoint.domain}${endpoint.path}`)
  }

  console.log(`\nSeeded ${endpoints.length} discovery endpoints`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 2: Run seeding script**

Run: `npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts`
Expected: 30+ endpoints seeded successfully

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/scripts/seed-endpoints.ts
git commit -m "feat(regulatory): add discovery endpoint seeding script"
```

---

### Task 1.5: Create Rate Limiter Infrastructure

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/utils/rate-limiter.ts`

**Step 1: Write the rate limiter**

```typescript
// src/lib/regulatory-truth/utils/rate-limiter.ts

interface RateLimitConfig {
  requestDelayMs: number
  maxRequestsPerMinute: number
  maxConcurrentRequests: number
}

interface DomainStats {
  lastRequestAt: number
  requestsThisMinute: number
  consecutiveErrors: number
  isCircuitBroken: boolean
  circuitBrokenAt?: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  requestDelayMs: 2000, // 2 seconds between requests
  maxRequestsPerMinute: 20,
  maxConcurrentRequests: 1,
}

const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 60 * 60 * 1000 // 1 hour

class DomainRateLimiter {
  private domainStats: Map<string, DomainStats> = new Map()
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private getStats(domain: string): DomainStats {
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        lastRequestAt: 0,
        requestsThisMinute: 0,
        consecutiveErrors: 0,
        isCircuitBroken: false,
      })
    }
    return this.domainStats.get(domain)!
  }

  async waitForSlot(domain: string): Promise<void> {
    const stats = this.getStats(domain)

    // Check circuit breaker
    if (stats.isCircuitBroken) {
      const timeSinceBroken = Date.now() - (stats.circuitBrokenAt || 0)
      if (timeSinceBroken < CIRCUIT_BREAKER_RESET_MS) {
        throw new Error(
          `Circuit breaker open for ${domain}. Resets in ${Math.round((CIRCUIT_BREAKER_RESET_MS - timeSinceBroken) / 1000 / 60)} minutes`
        )
      }
      // Auto-reset circuit breaker
      stats.isCircuitBroken = false
      stats.consecutiveErrors = 0
    }

    // Wait for rate limit delay
    const timeSinceLastRequest = Date.now() - stats.lastRequestAt
    if (timeSinceLastRequest < this.config.requestDelayMs) {
      const waitTime = this.config.requestDelayMs - timeSinceLastRequest
      await this.delay(waitTime)
    }

    stats.lastRequestAt = Date.now()
    stats.requestsThisMinute++
  }

  recordSuccess(domain: string): void {
    const stats = this.getStats(domain)
    stats.consecutiveErrors = 0
  }

  recordError(domain: string): void {
    const stats = this.getStats(domain)
    stats.consecutiveErrors++

    if (stats.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
      stats.isCircuitBroken = true
      stats.circuitBrokenAt = Date.now()
      console.log(
        `[rate-limiter] Circuit breaker OPEN for ${domain} after ${stats.consecutiveErrors} consecutive errors`
      )
    }
  }

  resetCircuitBreaker(domain: string): void {
    const stats = this.getStats(domain)
    stats.isCircuitBroken = false
    stats.consecutiveErrors = 0
    console.log(`[rate-limiter] Circuit breaker RESET for ${domain}`)
  }

  getStatus(domain: string): { isCircuitBroken: boolean; consecutiveErrors: number } {
    const stats = this.getStats(domain)
    return {
      isCircuitBroken: stats.isCircuitBroken,
      consecutiveErrors: stats.consecutiveErrors,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance
export const rateLimiter = new DomainRateLimiter()

// Helper function for fetching with rate limiting
export async function fetchWithRateLimit(url: string, options?: RequestInit): Promise<Response> {
  const domain = new URL(url).hostname

  await rateLimiter.waitForSlot(domain)

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "hr,en;q=0.9",
        ...options?.headers,
      },
    })

    if (response.ok) {
      rateLimiter.recordSuccess(domain)
    } else if (response.status >= 500 || response.status === 429) {
      rateLimiter.recordError(domain)
    }

    return response
  } catch (error) {
    rateLimiter.recordError(domain)
    throw error
  }
}

export { DomainRateLimiter }
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit src/lib/regulatory-truth/utils/rate-limiter.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/utils/rate-limiter.ts
git commit -m "feat(regulatory): add domain-aware rate limiter with circuit breaker"
```

---

### Task 1.6: Create Content Hashing Utility

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/utils/content-hash.ts`

**Step 1: Write the content hashing utility**

```typescript
// src/lib/regulatory-truth/utils/content-hash.ts
import { createHash } from "crypto"

/**
 * Normalize HTML content for consistent hashing.
 * Removes whitespace variations and dynamic content.
 */
export function normalizeContent(content: string): string {
  return (
    content
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove style tags
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove common dynamic elements (timestamps, session IDs)
      .replace(/\b\d{10,13}\b/g, "") // Unix timestamps
      .replace(/[a-f0-9]{32,}/gi, "") // Session IDs / hashes
      // Trim
      .trim()
  )
}

/**
 * Generate SHA-256 hash of content.
 */
export function hashContent(content: string): string {
  const normalized = normalizeContent(content)
  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * Check if content has changed based on hash comparison.
 * Returns { hasChanged, newHash, changePercentage }
 */
export function detectContentChange(
  newContent: string,
  previousHash: string | null
): {
  hasChanged: boolean
  newHash: string
  isSignificant: boolean
} {
  const newHash = hashContent(newContent)
  const hasChanged = previousHash !== newHash

  return {
    hasChanged,
    newHash,
    isSignificant: hasChanged, // For now, any change is significant
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/utils/content-hash.ts
git commit -m "feat(regulatory): add content hashing utility for deduplication"
```

---

## Phase 2: Discovery & Fetching (Sentinel Agent)

### Task 2.1: Create Sitemap Parser for Narodne novine

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/parsers/sitemap-parser.ts`

**Step 1: Write the sitemap parser**

```typescript
// src/lib/regulatory-truth/parsers/sitemap-parser.ts
import { XMLParser } from "fast-xml-parser"

export interface SitemapEntry {
  url: string
  lastmod?: string
  priority?: number
}

export interface NNSitemapMeta {
  type: number // 1=Službeni, 2=Međunarodni, 3=Oglasni
  year: number
  issue: number
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
})

/**
 * Parse a standard sitemap.xml file.
 */
export function parseSitemap(xml: string): SitemapEntry[] {
  const result = parser.parse(xml)

  // Handle sitemapindex (list of sitemaps)
  if (result.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(result.sitemapindex.sitemap)
      ? result.sitemapindex.sitemap
      : [result.sitemapindex.sitemap]

    return sitemaps.map((s: { loc: string; lastmod?: string }) => ({
      url: s.loc,
      lastmod: s.lastmod,
    }))
  }

  // Handle urlset (list of URLs)
  if (result.urlset?.url) {
    const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url]

    return urls.map((u: { loc: string; lastmod?: string; priority?: string }) => ({
      url: u.loc,
      lastmod: u.lastmod,
      priority: u.priority ? parseFloat(u.priority) : undefined,
    }))
  }

  return []
}

/**
 * Parse Narodne novine sitemap filename to extract metadata.
 * Format: sitemap_{type}_{year}_{issue}.xml
 * Example: sitemap_1_2025_145.xml
 */
export function parseNNSitemapFilename(filename: string): NNSitemapMeta | null {
  const match = filename.match(/sitemap_(\d)_(\d{4})_(\d+)\.xml/)
  if (!match) return null

  return {
    type: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
    issue: parseInt(match[3], 10),
  }
}

/**
 * Filter NN sitemaps to only include relevant types.
 * By default, includes Službeni (1) and Međunarodni (2), excludes Oglasni (3).
 */
export function filterNNSitemaps(
  entries: SitemapEntry[],
  allowedTypes: number[] = [1, 2]
): SitemapEntry[] {
  return entries.filter((entry) => {
    const filename = entry.url.split("/").pop() || ""
    const meta = parseNNSitemapFilename(filename)
    return meta && allowedTypes.includes(meta.type)
  })
}

/**
 * Get the latest issue sitemaps from NN main sitemap.
 * Returns sitemaps sorted by issue number (descending).
 */
export function getLatestNNIssueSitemaps(
  entries: SitemapEntry[],
  limit: number = 10
): SitemapEntry[] {
  const withMeta = entries
    .map((entry) => {
      const filename = entry.url.split("/").pop() || ""
      return {
        entry,
        meta: parseNNSitemapFilename(filename),
      }
    })
    .filter((x) => x.meta !== null)
    .sort((a, b) => {
      // Sort by year desc, then issue desc
      if (a.meta!.year !== b.meta!.year) {
        return b.meta!.year - a.meta!.year
      }
      return b.meta!.issue - a.meta!.issue
    })

  return withMeta.slice(0, limit).map((x) => x.entry)
}
```

**Step 2: Install fast-xml-parser if needed**

Run: `npm install fast-xml-parser`

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/parsers/sitemap-parser.ts package.json package-lock.json
git commit -m "feat(regulatory): add sitemap parser for Narodne novine"
```

---

### Task 2.2: Create HTML List Parser

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/parsers/html-list-parser.ts`

**Step 1: Write the HTML list parser**

```typescript
// src/lib/regulatory-truth/parsers/html-list-parser.ts
import { JSDOM } from "jsdom"

export interface ListItem {
  url: string
  title: string | null
  date: string | null
}

export interface ListParserConfig {
  itemSelector: string
  linkSelector?: string
  titleSelector?: string
  dateSelector?: string
  baseUrl: string
}

// Default selectors for common Croatian government sites
const SITE_CONFIGS: Record<string, Partial<ListParserConfig>> = {
  "hzzo.hr": {
    itemSelector: "article, .news-item, .vijest, .view-content .views-row",
    linkSelector: "a",
    titleSelector: "h2, h3, .title, a",
    dateSelector: ".date, time, .field-name-field-date, .datum",
  },
  "mirovinsko.hr": {
    itemSelector: ".views-row, .news-item, article",
    linkSelector: "a",
    titleSelector: "h2, h3, .title, a",
    dateSelector: ".date, time, .field-content",
  },
  "porezna-uprava.gov.hr": {
    itemSelector: ".views-row, article, .news-list-item",
    linkSelector: "a",
    titleSelector: "h2, h3, a",
    dateSelector: ".date, time, .meta",
  },
  "fina.hr": {
    itemSelector: ".news-item, article, .list-item",
    linkSelector: "a",
    titleSelector: "h2, h3, .title",
    dateSelector: ".date, time",
  },
  "mfin.gov.hr": {
    itemSelector: ".views-row, article, .news-item",
    linkSelector: "a",
    titleSelector: "h2, h3, a",
    dateSelector: ".date, time, .meta-date",
  },
}

/**
 * Parse HTML to extract list items (news, regulations, etc.)
 */
export function parseHtmlList(html: string, config: ListParserConfig): ListItem[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const items: ListItem[] = []

  const siteConfig = SITE_CONFIGS[new URL(config.baseUrl).hostname] || {}
  const mergedConfig = { ...siteConfig, ...config }

  const elements = document.querySelectorAll(mergedConfig.itemSelector)

  elements.forEach((element) => {
    // Find link
    const linkElement = mergedConfig.linkSelector
      ? element.querySelector(mergedConfig.linkSelector)
      : element.querySelector("a")

    if (!linkElement) return

    const href = linkElement.getAttribute("href")
    if (!href) return

    // Resolve relative URLs
    const url = new URL(href, config.baseUrl).href

    // Skip external links and anchors
    if (!url.includes(new URL(config.baseUrl).hostname)) return
    if (url.includes("#")) return

    // Find title
    let title: string | null = null
    if (mergedConfig.titleSelector) {
      const titleElement = element.querySelector(mergedConfig.titleSelector)
      title = titleElement?.textContent?.trim() || null
    }
    if (!title) {
      title = linkElement.textContent?.trim() || null
    }

    // Find date
    let date: string | null = null
    if (mergedConfig.dateSelector) {
      const dateElement = element.querySelector(mergedConfig.dateSelector)
      date = dateElement?.textContent?.trim() || null
    }

    // Try to extract date from datetime attribute
    if (!date) {
      const timeElement = element.querySelector("time[datetime]")
      date = timeElement?.getAttribute("datetime") || null
    }

    items.push({ url, title, date })
  })

  // Deduplicate by URL
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

/**
 * Find pagination links in HTML.
 * Returns URLs for next pages.
 */
export function findPaginationLinks(html: string, baseUrl: string, maxPages: number = 5): string[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const links: string[] = []

  // Common pagination selectors
  const paginationSelectors = [
    ".pager a",
    ".pagination a",
    "nav.pager a",
    ".page-numbers a",
    "ul.pagination a",
  ]

  for (const selector of paginationSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      const href = el.getAttribute("href")
      if (!href) return

      const url = new URL(href, baseUrl).href
      if (!links.includes(url) && url !== baseUrl) {
        links.push(url)
      }
    })
  }

  // Also check for ?page=N patterns
  const pageMatch = baseUrl.match(/[?&]page=(\d+)/)
  const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1

  if (currentPage < maxPages) {
    const nextPageUrl = baseUrl.includes("?")
      ? baseUrl.replace(/([?&])page=\d+/, `$1page=${currentPage + 1}`)
      : `${baseUrl}?page=${currentPage + 1}`

    if (!links.includes(nextPageUrl)) {
      links.push(nextPageUrl)
    }
  }

  return links.slice(0, maxPages - 1)
}
```

**Step 2: Install jsdom if needed**

Run: `npm install jsdom && npm install -D @types/jsdom`

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/parsers/html-list-parser.ts package.json package-lock.json
git commit -m "feat(regulatory): add HTML list parser for news and regulations pages"
```

---

### Task 2.3: Create Sentinel Agent

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/agents/sentinel.ts`

**Step 1: Write the Sentinel agent**

```typescript
// src/lib/regulatory-truth/agents/sentinel.ts
import { PrismaClient, DiscoveryPriority, ScrapeFrequency } from "@prisma/client"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { detectContentChange, hashContent } from "../utils/content-hash"
import { parseSitemap, filterNNSitemaps, getLatestNNIssueSitemaps } from "../parsers/sitemap-parser"
import { parseHtmlList, findPaginationLinks } from "../parsers/html-list-parser"

const prisma = new PrismaClient()

interface SentinelConfig {
  maxItemsPerRun: number
  maxPagesPerEndpoint: number
}

const DEFAULT_CONFIG: SentinelConfig = {
  maxItemsPerRun: 500,
  maxPagesPerEndpoint: 5,
}

interface SentinelResult {
  success: boolean
  endpointsChecked: number
  newItemsDiscovered: number
  errors: string[]
}

/**
 * Check if an endpoint should be scraped based on its frequency.
 */
function shouldScrapeEndpoint(
  frequency: ScrapeFrequency,
  lastScrapedAt: Date | null,
  now: Date
): boolean {
  if (!lastScrapedAt) return true

  const hoursSinceScrape = (now.getTime() - lastScrapedAt.getTime()) / (1000 * 60 * 60)

  switch (frequency) {
    case "EVERY_RUN":
      return true
    case "DAILY":
      return hoursSinceScrape >= 24
    case "TWICE_WEEKLY":
      return hoursSinceScrape >= 84 // ~3.5 days
    case "WEEKLY":
      return hoursSinceScrape >= 168
    case "MONTHLY":
      return hoursSinceScrape >= 720
    default:
      return true
  }
}

/**
 * Process a single discovery endpoint.
 */
async function processEndpoint(
  endpoint: {
    id: string
    domain: string
    path: string
    name: string
    listingStrategy: string
    urlPattern: string | null
    paginationPattern: string | null
    lastContentHash: string | null
    metadata: unknown
  },
  config: SentinelConfig
): Promise<{ newItems: number; error?: string }> {
  const baseUrl = `https://${endpoint.domain}${endpoint.path}`
  console.log(`[sentinel] Checking: ${baseUrl}`)

  try {
    const response = await fetchWithRateLimit(baseUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    const { hasChanged, newHash } = detectContentChange(content, endpoint.lastContentHash)

    // Update endpoint with new hash
    await prisma.discoveryEndpoint.update({
      where: { id: endpoint.id },
      data: {
        lastScrapedAt: new Date(),
        lastContentHash: newHash,
        consecutiveErrors: 0,
        lastError: null,
      },
    })

    if (!hasChanged && endpoint.lastContentHash) {
      console.log(`[sentinel] No changes detected for ${endpoint.name}`)
      return { newItems: 0 }
    }

    // Parse content based on strategy
    let discoveredUrls: { url: string; title: string | null; date: string | null }[] = []

    if (endpoint.listingStrategy === "SITEMAP_XML") {
      const entries = parseSitemap(content)

      // For NN, filter to relevant types and get latest issues
      if (endpoint.domain === "narodne-novine.nn.hr") {
        const allowedTypes = (endpoint.metadata as { types?: number[] })?.types || [1, 2]
        const filtered = filterNNSitemaps(entries, allowedTypes)
        const latest = getLatestNNIssueSitemaps(filtered, 20)
        discoveredUrls = latest.map((e) => ({ url: e.url, title: null, date: e.lastmod || null }))
      } else {
        discoveredUrls = entries.map((e) => ({ url: e.url, title: null, date: e.lastmod || null }))
      }
    } else {
      // HTML-based parsing
      const items = parseHtmlList(content, {
        baseUrl,
        itemSelector: "article, .news-item, .views-row",
      })
      discoveredUrls = items

      // Handle pagination
      if (endpoint.listingStrategy === "PAGINATION") {
        const paginationLinks = findPaginationLinks(content, baseUrl, config.maxPagesPerEndpoint)

        for (const pageUrl of paginationLinks) {
          try {
            const pageResponse = await fetchWithRateLimit(pageUrl)
            if (pageResponse.ok) {
              const pageContent = await pageResponse.text()
              const pageItems = parseHtmlList(pageContent, {
                baseUrl: pageUrl,
                itemSelector: "article, .news-item, .views-row",
              })
              discoveredUrls.push(...pageItems)
            }
          } catch (error) {
            console.log(`[sentinel] Failed to fetch page: ${pageUrl}`)
          }
        }
      }
    }

    // Create DiscoveredItem records for new URLs
    let newItemCount = 0
    for (const item of discoveredUrls) {
      try {
        await prisma.discoveredItem.create({
          data: {
            endpointId: endpoint.id,
            url: item.url,
            title: item.title,
            publishedAt: item.date ? new Date(item.date) : null,
            status: "PENDING",
          },
        })
        newItemCount++
      } catch (error) {
        // Likely duplicate (unique constraint violation)
        // This is expected and fine
      }
    }

    console.log(`[sentinel] Discovered ${newItemCount} new items from ${endpoint.name}`)
    return { newItems: newItemCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await prisma.discoveryEndpoint.update({
      where: { id: endpoint.id },
      data: {
        consecutiveErrors: { increment: 1 },
        lastError: errorMessage,
      },
    })

    return { newItems: 0, error: errorMessage }
  }
}

/**
 * Run the Sentinel agent to discover new content.
 */
export async function runSentinel(
  priority?: DiscoveryPriority,
  config: Partial<SentinelConfig> = {}
): Promise<SentinelResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const now = new Date()
  const result: SentinelResult = {
    success: true,
    endpointsChecked: 0,
    newItemsDiscovered: 0,
    errors: [],
  }

  try {
    // Get active endpoints, optionally filtered by priority
    const whereClause: Record<string, unknown> = {
      isActive: true,
      consecutiveErrors: { lt: 5 }, // Skip endpoints with too many errors
    }
    if (priority) {
      whereClause.priority = priority
    }

    const endpoints = await prisma.discoveryEndpoint.findMany({
      where: whereClause,
      orderBy: [
        { priority: "asc" }, // CRITICAL first
        { lastScrapedAt: "asc" }, // Oldest first
      ],
    })

    console.log(`[sentinel] Found ${endpoints.length} active endpoints`)

    for (const endpoint of endpoints) {
      // Check if we should scrape based on frequency
      if (!shouldScrapeEndpoint(endpoint.scrapeFrequency, endpoint.lastScrapedAt, now)) {
        continue
      }

      result.endpointsChecked++
      const { newItems, error } = await processEndpoint(endpoint, mergedConfig)
      result.newItemsDiscovered += newItems

      if (error) {
        result.errors.push(`${endpoint.name}: ${error}`)
      }

      // Safety limit
      if (result.newItemsDiscovered >= mergedConfig.maxItemsPerRun) {
        console.log(`[sentinel] Reached max items limit (${mergedConfig.maxItemsPerRun})`)
        break
      }
    }

    console.log(
      `[sentinel] Complete: ${result.endpointsChecked} endpoints, ${result.newItemsDiscovered} new items`
    )
  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}

/**
 * Fetch content for pending discovered items and create Evidence records.
 */
export async function fetchDiscoveredItems(limit: number = 100): Promise<{
  fetched: number
  failed: number
}> {
  const items = await prisma.discoveredItem.findMany({
    where: {
      status: "PENDING",
      retryCount: { lt: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { endpoint: true },
  })

  let fetched = 0
  let failed = 0

  for (const item of items) {
    try {
      console.log(`[sentinel] Fetching: ${item.url}`)
      const response = await fetchWithRateLimit(item.url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const content = await response.text()
      const contentHash = hashContent(content)

      // Check if we already have this content
      const existingEvidence = await prisma.evidence.findFirst({
        where: { contentHash },
      })

      if (existingEvidence) {
        // Link to existing evidence
        await prisma.discoveredItem.update({
          where: { id: item.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            evidenceId: existingEvidence.id,
            contentHash,
          },
        })
      } else {
        // Find or create source
        const source = await prisma.regulatorySource.findFirst({
          where: {
            url: { contains: item.endpoint.domain },
          },
        })

        if (source) {
          // Create new evidence record
          const evidence = await prisma.evidence.create({
            data: {
              sourceId: source.id,
              url: item.url,
              rawContent: content,
              contentHash,
              contentType: "html",
            },
          })

          await prisma.discoveredItem.update({
            where: { id: item.id },
            data: {
              status: "FETCHED",
              processedAt: new Date(),
              evidenceId: evidence.id,
              contentHash,
            },
          })

          fetched++
        } else {
          console.log(`[sentinel] No source found for ${item.endpoint.domain}`)
          await prisma.discoveredItem.update({
            where: { id: item.id },
            data: { status: "SKIPPED" },
          })
        }
      }
    } catch (error) {
      failed++
      await prisma.discoveredItem.update({
        where: { id: item.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: error instanceof Error ? error.message : String(error),
          status: item.retryCount >= 2 ? "FAILED" : "PENDING",
        },
      })
    }
  }

  console.log(`[sentinel] Fetched: ${fetched}, Failed: ${failed}`)
  return { fetched, failed }
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/agents/sentinel.ts
git commit -m "feat(regulatory): add Sentinel agent for content discovery"
```

---

### Task 2.4: Update Overnight Runner to Include Sentinel Phase

**Files:**

- Modify: `/home/admin/FiskAI/src/lib/regulatory-truth/scripts/overnight-run.ts`

**Step 1: Add Sentinel phase at the beginning**

Replace the imports section and add Phase 0:

```typescript
// src/lib/regulatory-truth/scripts/overnight-run.ts
// Overnight runner for full regulatory truth pipeline with generous rate limiting

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  if (parsed.OLLAMA_API_KEY) process.env.OLLAMA_API_KEY = parsed.OLLAMA_API_KEY
  if (parsed.OLLAMA_ENDPOINT) process.env.OLLAMA_ENDPOINT = parsed.OLLAMA_ENDPOINT
  if (parsed.OLLAMA_MODEL) process.env.OLLAMA_MODEL = parsed.OLLAMA_MODEL
} catch {
  // .env may not exist
}

import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const RATE_LIMIT_DELAY = 120000 // 120 seconds between LLM calls for heavy rate limiting

async function sleep(ms: number) {
  console.log(`[overnight] Waiting ${ms / 1000}s for rate limit...`)
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const { runSentinel, fetchDiscoveredItems } = await import("../agents/sentinel")
  const { runExtractor } = await import("../agents/extractor")
  const { runComposer, groupSourcePointersByDomain } = await import("../agents/composer")
  const { runReviewer } = await import("../agents/reviewer")
  const { runReleaser } = await import("../agents/releaser")

  const client = await pool.connect()

  console.log("\n=== OVERNIGHT REGULATORY TRUTH PIPELINE ===")
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Rate limit delay: ${RATE_LIMIT_DELAY / 1000}s between calls\n`)

  try {
    // Phase 0: Discovery (Sentinel)
    console.log("=== PHASE 0: DISCOVERY ===")

    // Run Sentinel for CRITICAL endpoints
    const criticalResult = await runSentinel("CRITICAL")
    console.log(`[sentinel] CRITICAL: ${criticalResult.endpointsChecked} checked, ${criticalResult.newItemsDiscovered} discovered`)

    // Run Sentinel for HIGH priority (if time permits)
    const highResult = await runSentinel("HIGH")
    console.log(`[sentinel] HIGH: ${highResult.endpointsChecked} checked, ${highResult.newItemsDiscovered} discovered`)

    // Fetch discovered items
    const fetchResult = await fetchDiscoveredItems(100)
    console.log(`[sentinel] Fetch: ${fetchResult.fetched} fetched, ${fetchResult.failed} failed`)

    console.log("\n[discovery] Complete")
    await sleep(RATE_LIMIT_DELAY)

    // Phase 1: Extract from unprocessed evidence
    // ... rest of existing code remains the same
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/scripts/overnight-run.ts
git commit -m "feat(regulatory): add Sentinel phase to overnight runner"
```

---

## Phase 3: AppliesWhen DSL & Outcome Schema

### Task 3.1: Create AppliesWhen DSL Types and Evaluator

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/dsl/applies-when.ts`

**Step 1: Write the DSL types and evaluator**

```typescript
// src/lib/regulatory-truth/dsl/applies-when.ts
import { z } from "zod"

// Field reference (dot path like "entity.type", "txn.amount")
const fieldRefSchema = z.string().min(1)

// Comparison operators
const cmpOpSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"])

// JSON value
const jsonValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

// AppliesWhen predicate types
type AppliesWhenPredicate =
  | { op: "and"; args: AppliesWhenPredicate[] }
  | { op: "or"; args: AppliesWhenPredicate[] }
  | { op: "not"; arg: AppliesWhenPredicate }
  | { op: "cmp"; field: string; cmp: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: unknown }
  | { op: "in"; field: string; values: unknown[] }
  | { op: "exists"; field: string }
  | { op: "between"; field: string; gte?: unknown; lte?: unknown }
  | { op: "matches"; field: string; pattern: string }
  | { op: "date_in_effect"; dateField: string; on?: string }
  | { op: "true" } // Always true
  | { op: "false" } // Always false

// Zod schema for validation (recursive)
const appliesWhenSchema: z.ZodType<AppliesWhenPredicate> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("and"), args: z.array(appliesWhenSchema) }),
    z.object({ op: z.literal("or"), args: z.array(appliesWhenSchema) }),
    z.object({ op: z.literal("not"), arg: appliesWhenSchema }),
    z.object({
      op: z.literal("cmp"),
      field: fieldRefSchema,
      cmp: cmpOpSchema,
      value: jsonValueSchema,
    }),
    z.object({ op: z.literal("in"), field: fieldRefSchema, values: z.array(jsonValueSchema) }),
    z.object({ op: z.literal("exists"), field: fieldRefSchema }),
    z.object({
      op: z.literal("between"),
      field: fieldRefSchema,
      gte: jsonValueSchema.optional(),
      lte: jsonValueSchema.optional(),
    }),
    z.object({ op: z.literal("matches"), field: fieldRefSchema, pattern: z.string() }),
    z.object({
      op: z.literal("date_in_effect"),
      dateField: fieldRefSchema,
      on: z.string().optional(),
    }),
    z.object({ op: z.literal("true") }),
    z.object({ op: z.literal("false") }),
  ])
)

// Context type for evaluation
interface EvaluationContext {
  asOf: string // ISO date-time
  entity: {
    type: "OBRT" | "DOO" | "JDOO" | "UDRUGA" | "OTHER"
    obrtSubtype?: "PAUSALNI" | "DOHODAS" | "DOBITAS"
    vat: { status: "IN_VAT" | "OUTSIDE_VAT" | "UNKNOWN" }
    activityNkd?: string
    location?: { country: "HR"; county?: string }
  }
  txn?: {
    kind: "SALE" | "PURCHASE" | "PAYMENT" | "PAYROLL" | "OTHER"
    b2b?: boolean
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER"
    amount?: number
    currency?: "EUR"
    itemCategory?: string
    date?: string
  }
  counters?: {
    revenueYtd?: number
    invoicesThisMonth?: number
  }
  flags?: {
    isAutomationRequest?: boolean
  }
}

/**
 * Get a value from an object using dot notation path.
 */
function getFieldValue(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Compare two values with a given operator.
 */
function compare(
  left: unknown,
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  right: unknown
): boolean {
  if (left === undefined || left === null) {
    return false // Missing fields always evaluate to false
  }

  switch (op) {
    case "eq":
      return left === right
    case "neq":
      return left !== right
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right
    default:
      return false
  }
}

/**
 * Evaluate an AppliesWhen predicate against a context.
 */
export function evaluateAppliesWhen(
  predicate: AppliesWhenPredicate,
  context: EvaluationContext
): boolean {
  switch (predicate.op) {
    case "true":
      return true

    case "false":
      return false

    case "and":
      return predicate.args.every((arg) => evaluateAppliesWhen(arg, context))

    case "or":
      return predicate.args.some((arg) => evaluateAppliesWhen(arg, context))

    case "not":
      return !evaluateAppliesWhen(predicate.arg, context)

    case "cmp": {
      const value = getFieldValue(context, predicate.field)
      return compare(value, predicate.cmp, predicate.value)
    }

    case "in": {
      const value = getFieldValue(context, predicate.field)
      return predicate.values.includes(value)
    }

    case "exists": {
      const value = getFieldValue(context, predicate.field)
      return value !== undefined && value !== null
    }

    case "between": {
      const value = getFieldValue(context, predicate.field)
      if (typeof value !== "number") return false

      const gteOk =
        predicate.gte === undefined || (typeof predicate.gte === "number" && value >= predicate.gte)
      const lteOk =
        predicate.lte === undefined || (typeof predicate.lte === "number" && value <= predicate.lte)

      return gteOk && lteOk
    }

    case "matches": {
      const value = getFieldValue(context, predicate.field)
      if (typeof value !== "string") return false

      try {
        const regex = new RegExp(predicate.pattern)
        return regex.test(value)
      } catch {
        return false
      }
    }

    case "date_in_effect": {
      const dateValue = getFieldValue(context, predicate.dateField)
      if (typeof dateValue !== "string") return false

      const checkDate = predicate.on || context.asOf
      const fieldDate = new Date(dateValue)
      const asOfDate = new Date(checkDate)

      return fieldDate <= asOfDate
    }

    default:
      return false
  }
}

/**
 * Parse and validate an AppliesWhen predicate from JSON or string.
 */
export function parseAppliesWhen(input: string | unknown): AppliesWhenPredicate {
  const parsed = typeof input === "string" ? JSON.parse(input) : input
  return appliesWhenSchema.parse(parsed)
}

/**
 * Validate an AppliesWhen predicate without throwing.
 */
export function validateAppliesWhen(input: unknown): {
  valid: boolean
  error?: string
} {
  const result = appliesWhenSchema.safeParse(input)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.message }
}

/**
 * Create common predicate helpers.
 */
export const predicates = {
  // Entity type checks
  isObrt: (): AppliesWhenPredicate => ({
    op: "cmp",
    field: "entity.type",
    cmp: "eq",
    value: "OBRT",
  }),

  isPausalni: (): AppliesWhenPredicate => ({
    op: "and",
    args: [
      { op: "cmp", field: "entity.type", cmp: "eq", value: "OBRT" },
      { op: "cmp", field: "entity.obrtSubtype", cmp: "eq", value: "PAUSALNI" },
    ],
  }),

  isOutsideVat: (): AppliesWhenPredicate => ({
    op: "cmp",
    field: "entity.vat.status",
    cmp: "eq",
    value: "OUTSIDE_VAT",
  }),

  // Transaction checks
  isCashSale: (): AppliesWhenPredicate => ({
    op: "and",
    args: [
      { op: "cmp", field: "txn.kind", cmp: "eq", value: "SALE" },
      { op: "in", field: "txn.paymentMethod", values: ["CASH", "CARD"] },
    ],
  }),

  // Threshold checks
  revenueExceeds: (amount: number): AppliesWhenPredicate => ({
    op: "cmp",
    field: "counters.revenueYtd",
    cmp: "gt",
    value: amount,
  }),

  // Always true/false
  always: (): AppliesWhenPredicate => ({ op: "true" }),
  never: (): AppliesWhenPredicate => ({ op: "false" }),
}

export type { AppliesWhenPredicate, EvaluationContext }
export { appliesWhenSchema }
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/dsl/applies-when.ts
git commit -m "feat(regulatory): add AppliesWhen DSL types and evaluator"
```

---

### Task 3.2: Create Outcome Schema Types

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/dsl/outcome.ts`

**Step 1: Write the Outcome schema**

```typescript
// src/lib/regulatory-truth/dsl/outcome.ts
import { z } from "zod"

// Deadline types
const deadlineSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FIXED"),
    date: z.string(), // ISO date
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("RELATIVE"),
    days: z.number(),
    from: z.enum(["txn_date", "month_end", "quarter_end", "year_end", "event"]),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("RECURRING"),
    day: z.number().min(1).max(31),
    frequency: z.enum(["monthly", "quarterly", "yearly"]),
    description: z.string().optional(),
  }),
])

// Step in a procedure
const stepSchema = z.object({
  title: z.string(),
  details: z.string().optional(),
  system: z.string().optional(), // e.g., "e-Porezna", "FINA"
  url: z.string().optional(),
})

// Outcome types
const outcomeSchema = z.discriminatedUnion("kind", [
  // VALUE: A specific regulatory value (rate, threshold, amount)
  z.object({
    kind: z.literal("VALUE"),
    value: z.union([z.string(), z.number(), z.boolean()]),
    unit: z.string().optional(), // e.g., "EUR", "%", "days"
    format: z.string().optional(), // e.g., "currency", "percentage"
  }),

  // OBLIGATION: Something the entity must do
  z.object({
    kind: z.literal("OBLIGATION"),
    obligation: z.object({
      code: z.string(), // e.g., "SUBMIT_PDV", "ISSUE_E_INVOICE"
      description: z.string(),
      deadline: deadlineSchema.optional(),
      steps: z.array(stepSchema).optional(),
      penalty: z.string().optional(),
    }),
  }),

  // PROCEDURE: How to do something
  z.object({
    kind: z.literal("PROCEDURE"),
    procedure: z.object({
      system: z.enum(["FINA", "POREZNA", "HZMO", "HZZO", "SUDSKI_REGISTAR", "OTHER"]),
      action: z.string(),
      url: z.string().optional(),
      payloadSchema: z.unknown().optional(),
      steps: z.array(stepSchema).optional(),
    }),
  }),
])

type Outcome = z.infer<typeof outcomeSchema>
type Deadline = z.infer<typeof deadlineSchema>
type Step = z.infer<typeof stepSchema>

/**
 * Parse and validate an Outcome from JSON.
 */
export function parseOutcome(input: string | unknown): Outcome {
  const parsed = typeof input === "string" ? JSON.parse(input) : input
  return outcomeSchema.parse(parsed)
}

/**
 * Validate an Outcome without throwing.
 */
export function validateOutcome(input: unknown): {
  valid: boolean
  error?: string
} {
  const result = outcomeSchema.safeParse(input)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.message }
}

/**
 * Create common outcome helpers.
 */
export const outcomes = {
  // Value outcomes
  percentage: (value: number): Outcome => ({
    kind: "VALUE",
    value,
    unit: "%",
    format: "percentage",
  }),

  currency: (value: number, unit: "EUR" | "HRK" = "EUR"): Outcome => ({
    kind: "VALUE",
    value,
    unit,
    format: "currency",
  }),

  threshold: (value: number, unit: string): Outcome => ({
    kind: "VALUE",
    value,
    unit,
    format: "number",
  }),

  // Obligation outcomes
  submitForm: (code: string, description: string, deadline?: Deadline): Outcome => ({
    kind: "OBLIGATION",
    obligation: {
      code,
      description,
      deadline,
    },
  }),

  // Procedure outcomes
  procedure: (
    system: "FINA" | "POREZNA" | "HZMO" | "HZZO" | "SUDSKI_REGISTAR" | "OTHER",
    action: string,
    steps?: Step[]
  ): Outcome => ({
    kind: "PROCEDURE",
    procedure: {
      system,
      action,
      steps,
    },
  }),
}

export type { Outcome, Deadline, Step }
export { outcomeSchema, deadlineSchema, stepSchema }
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/dsl/outcome.ts
git commit -m "feat(regulatory): add Outcome schema types (VALUE, OBLIGATION, PROCEDURE)"
```

---

## Phase 4: Scheduled Jobs & Cron

### Task 4.1: Create Cron Scheduler for Daily Pipeline

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/scheduler/cron.ts`

**Step 1: Write the cron scheduler**

```typescript
// src/lib/regulatory-truth/scheduler/cron.ts
import { CronJob } from "cron"

interface SchedulerConfig {
  timezone: string
  enabled: boolean
}

const DEFAULT_CONFIG: SchedulerConfig = {
  timezone: "Europe/Zagreb",
  enabled: process.env.REGULATORY_CRON_ENABLED === "true",
}

let dailyJob: CronJob | null = null

/**
 * Run the overnight pipeline.
 * This is called by the cron job at 06:00 AM Zagreb time.
 */
async function runOvernightPipeline(): Promise<void> {
  console.log(`[scheduler] Starting overnight pipeline at ${new Date().toISOString()}`)

  try {
    // Dynamic import to avoid loading heavy modules at startup
    const { main } = await import("../scripts/overnight-run")
    // Note: overnight-run.ts needs to export main() function

    console.log("[scheduler] Overnight pipeline complete")
  } catch (error) {
    console.error("[scheduler] Overnight pipeline failed:", error)
    // TODO: Send alert notification
  }
}

/**
 * Start the cron scheduler.
 * Schedules:
 * - 06:00 AM Zagreb time: Full overnight pipeline
 */
export function startScheduler(config: Partial<SchedulerConfig> = {}): void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  if (!mergedConfig.enabled) {
    console.log("[scheduler] Cron scheduler disabled")
    return
  }

  // Daily at 06:00 AM Zagreb time
  dailyJob = new CronJob(
    "0 6 * * *", // At 06:00
    runOvernightPipeline,
    null,
    true, // Start immediately
    mergedConfig.timezone
  )

  console.log(`[scheduler] Cron scheduler started (timezone: ${mergedConfig.timezone})`)
  console.log("[scheduler] Next run:", dailyJob.nextDate().toISO())
}

/**
 * Stop the cron scheduler.
 */
export function stopScheduler(): void {
  if (dailyJob) {
    dailyJob.stop()
    dailyJob = null
    console.log("[scheduler] Cron scheduler stopped")
  }
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus(): {
  enabled: boolean
  running: boolean
  nextRun: string | null
  lastRun: string | null
} {
  return {
    enabled: DEFAULT_CONFIG.enabled,
    running: dailyJob?.running ?? false,
    nextRun: dailyJob?.nextDate()?.toISO() ?? null,
    lastRun: dailyJob?.lastDate()?.toISO() ?? null,
  }
}

/**
 * Manually trigger the overnight pipeline.
 */
export async function triggerManualRun(): Promise<void> {
  console.log("[scheduler] Manual run triggered")
  await runOvernightPipeline()
}
```

**Step 2: Install cron package**

Run: `npm install cron && npm install -D @types/cron`

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/scheduler/cron.ts package.json package-lock.json
git commit -m "feat(regulatory): add cron scheduler for daily pipeline"
```

---

### Task 4.2: Create Pipeline Metrics Collection

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/monitoring/metrics.ts`

**Step 1: Write the metrics collection**

```typescript
// src/lib/regulatory-truth/monitoring/metrics.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export interface PipelineMetrics {
  // Discovery metrics
  activeEndpoints: number
  endpointsWithErrors: number
  pendingItems: number
  fetchedItems: number

  // Processing metrics
  evidenceTotal: number
  evidenceUnprocessed: number
  pointersTotal: number
  pointersUngrouped: number

  // Rule metrics
  rulesDraft: number
  rulesApproved: number
  rulesActive: number
  rulesStale: number

  // Conflict metrics
  conflictsOpen: number
  conflictsResolved: number

  // Release metrics
  releasesTotal: number
  latestReleaseVersion: string | null
  latestReleaseDate: Date | null

  // Agent run metrics
  agentRunsToday: number
  agentRunsSuccess: number
  agentRunsFailed: number

  // Timing
  collectedAt: Date
}

/**
 * Collect current pipeline metrics.
 */
export async function collectMetrics(): Promise<PipelineMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    activeEndpoints,
    endpointsWithErrors,
    pendingItems,
    fetchedItems,
    evidenceTotal,
    evidenceUnprocessed,
    pointersTotal,
    pointersUngrouped,
    rulesDraft,
    rulesApproved,
    rulesActive,
    conflictsOpen,
    conflictsResolved,
    releasesTotal,
    latestRelease,
    agentRunsToday,
    agentRunsSuccess,
    agentRunsFailed,
  ] = await Promise.all([
    // Discovery
    prisma.discoveryEndpoint.count({ where: { isActive: true } }),
    prisma.discoveryEndpoint.count({ where: { consecutiveErrors: { gte: 3 } } }),
    prisma.discoveredItem.count({ where: { status: "PENDING" } }),
    prisma.discoveredItem.count({ where: { status: "FETCHED" } }),

    // Evidence
    prisma.evidence.count(),
    prisma.evidence.count({
      where: {
        sourcePointers: { none: {} },
      },
    }),

    // Pointers
    prisma.sourcePointer.count(),
    prisma.sourcePointer.count({
      where: {
        rules: { none: {} },
      },
    }),

    // Rules
    prisma.regulatoryRule.count({ where: { status: "DRAFT" } }),
    prisma.regulatoryRule.count({ where: { status: "APPROVED" } }),
    prisma.regulatoryRule.count({ where: { status: "ACTIVE" } }),

    // Conflicts
    prisma.regulatoryConflict.count({ where: { status: "OPEN" } }),
    prisma.regulatoryConflict.count({ where: { status: "RESOLVED" } }),

    // Releases
    prisma.regulatoryRelease.count(),
    prisma.regulatoryRelease.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { version: true, publishedAt: true },
    }),

    // Agent runs
    prisma.agentRun.count({ where: { startedAt: { gte: today } } }),
    prisma.agentRun.count({ where: { startedAt: { gte: today }, success: true } }),
    prisma.agentRun.count({ where: { startedAt: { gte: today }, success: false } }),
  ])

  return {
    activeEndpoints,
    endpointsWithErrors,
    pendingItems,
    fetchedItems,
    evidenceTotal,
    evidenceUnprocessed,
    pointersTotal,
    pointersUngrouped,
    rulesDraft,
    rulesApproved,
    rulesActive,
    rulesStale: 0, // TODO: Calculate based on effectiveUntil
    conflictsOpen,
    conflictsResolved,
    releasesTotal,
    latestReleaseVersion: latestRelease?.version ?? null,
    latestReleaseDate: latestRelease?.publishedAt ?? null,
    agentRunsToday,
    agentRunsSuccess,
    agentRunsFailed,
    collectedAt: new Date(),
  }
}

/**
 * Get endpoint health summary.
 */
export async function getEndpointHealth(): Promise<
  Array<{
    id: string
    name: string
    domain: string
    status: "healthy" | "degraded" | "failing"
    lastScrapedAt: Date | null
    consecutiveErrors: number
    itemsDiscovered: number
  }>
> {
  const endpoints = await prisma.discoveryEndpoint.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { discoveries: true } },
    },
    orderBy: { priority: "asc" },
  })

  return endpoints.map((ep) => ({
    id: ep.id,
    name: ep.name,
    domain: ep.domain,
    status:
      ep.consecutiveErrors === 0 ? "healthy" : ep.consecutiveErrors < 3 ? "degraded" : "failing",
    lastScrapedAt: ep.lastScrapedAt,
    consecutiveErrors: ep.consecutiveErrors,
    itemsDiscovered: ep._count.discoveries,
  }))
}

/**
 * Get recent agent runs.
 */
export async function getRecentAgentRuns(limit: number = 20): Promise<
  Array<{
    id: string
    agentType: string
    startedAt: Date
    completedAt: Date | null
    success: boolean
    error: string | null
    inputId: string | null
    outputId: string | null
  }>
> {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  })

  return runs.map((run) => ({
    id: run.id,
    agentType: run.agentType,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    success: run.success,
    error: run.error,
    inputId: run.inputId,
    outputId: run.outputId,
  }))
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/metrics.ts
git commit -m "feat(regulatory): add pipeline metrics collection"
```

---

## Phase 5: Admin Dashboard API Routes

### Task 5.1: Create API Route for Pipeline Status

**Files:**

- Create: `/home/admin/FiskAI/src/app/api/regulatory/status/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/regulatory/status/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import {
  collectMetrics,
  getEndpointHealth,
  getRecentAgentRuns,
} from "@/lib/regulatory-truth/monitoring/metrics"
import { getSchedulerStatus } from "@/lib/regulatory-truth/scheduler/cron"

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Collect all status information
    const [metrics, endpointHealth, recentRuns] = await Promise.all([
      collectMetrics(),
      getEndpointHealth(),
      getRecentAgentRuns(20),
    ])

    const schedulerStatus = getSchedulerStatus()

    return NextResponse.json({
      metrics,
      endpointHealth,
      recentRuns,
      scheduler: schedulerStatus,
    })
  } catch (error) {
    console.error("[api/regulatory/status] Error:", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/regulatory/status/route.ts
git commit -m "feat(regulatory): add API route for pipeline status"
```

---

### Task 5.2: Create API Route for Manual Pipeline Trigger

**Files:**

- Create: `/home/admin/FiskAI/src/app/api/regulatory/trigger/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/regulatory/trigger/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { phase } = body as { phase?: string }

    // Trigger appropriate phase
    if (phase === "discovery") {
      const { runSentinel, fetchDiscoveredItems } =
        await import("@/lib/regulatory-truth/agents/sentinel")
      const result = await runSentinel()
      const fetchResult = await fetchDiscoveredItems(50)

      return NextResponse.json({
        success: true,
        phase: "discovery",
        result: {
          ...result,
          fetched: fetchResult.fetched,
        },
      })
    }

    if (phase === "extraction") {
      // TODO: Implement extraction phase trigger
      return NextResponse.json({
        success: true,
        phase: "extraction",
        message: "Extraction triggered",
      })
    }

    // Default: trigger full pipeline
    const { triggerManualRun } = await import("@/lib/regulatory-truth/scheduler/cron")

    // Run in background (don't await)
    triggerManualRun().catch(console.error)

    return NextResponse.json({
      success: true,
      phase: "full",
      message: "Full pipeline triggered in background",
    })
  } catch (error) {
    console.error("[api/regulatory/trigger] Error:", error)
    return NextResponse.json({ error: "Failed to trigger pipeline" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/regulatory/trigger/route.ts
git commit -m "feat(regulatory): add API route for manual pipeline trigger"
```

---

### Task 5.3: Create Index File for Regulatory Truth Module

**Files:**

- Create: `/home/admin/FiskAI/src/lib/regulatory-truth/index.ts`

**Step 1: Write the index file**

```typescript
// src/lib/regulatory-truth/index.ts
// Main export file for the Regulatory Truth module

// Agents
export { runSentinel, fetchDiscoveredItems } from "./agents/sentinel"
export { runExtractor } from "./agents/extractor"
export { runComposer, groupSourcePointersByDomain } from "./agents/composer"
export { runReviewer } from "./agents/reviewer"
export { runReleaser } from "./agents/releaser"

// DSL
export {
  evaluateAppliesWhen,
  parseAppliesWhen,
  validateAppliesWhen,
  predicates,
  type AppliesWhenPredicate,
  type EvaluationContext,
} from "./dsl/applies-when"

export {
  parseOutcome,
  validateOutcome,
  outcomes,
  type Outcome,
  type Deadline,
  type Step,
} from "./dsl/outcome"

// Utilities
export { rateLimiter, fetchWithRateLimit, DomainRateLimiter } from "./utils/rate-limiter"
export { hashContent, normalizeContent, detectContentChange } from "./utils/content-hash"

// Parsers
export {
  parseSitemap,
  parseNNSitemapFilename,
  filterNNSitemaps,
  getLatestNNIssueSitemaps,
} from "./parsers/sitemap-parser"

export { parseHtmlList, findPaginationLinks } from "./parsers/html-list-parser"

// Monitoring
export {
  collectMetrics,
  getEndpointHealth,
  getRecentAgentRuns,
  type PipelineMetrics,
} from "./monitoring/metrics"

// Scheduler
export {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerManualRun,
} from "./scheduler/cron"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/index.ts
git commit -m "feat(regulatory): add index file with all module exports"
```

---

## Summary & Next Steps

### Phase 1 Complete:

- [x] DiscoveryEndpoint and DiscoveredItem Prisma models
- [x] Concept model with hierarchy
- [x] GraphEdge model for knowledge graph
- [x] Discovery endpoint seeding script (30+ endpoints)
- [x] Rate limiter with circuit breaker
- [x] Content hashing utility

### Phase 2 Complete:

- [x] Sitemap parser for Narodne novine
- [x] HTML list parser for news sites
- [x] Sentinel agent for discovery
- [x] Updated overnight runner with discovery phase

### Phase 3 Complete:

- [x] AppliesWhen DSL types and evaluator
- [x] Outcome schema (VALUE, OBLIGATION, PROCEDURE)

### Phase 4 Complete:

- [x] Cron scheduler for daily pipeline
- [x] Pipeline metrics collection

### Phase 5 Complete:

- [x] API route for pipeline status
- [x] API route for manual trigger
- [x] Module index file

### Remaining Work (Future Tasks):

1. Admin Dashboard UI components
2. Conflict detection improvements
3. Impact analysis (graph traversal)
4. Regression tests
5. Prometheus/Grafana integration
6. Daily summary email notifications
7. Reviewer Dashboard full implementation

---

## Running the System

### Development

```bash
# Seed discovery endpoints
npx tsx src/lib/regulatory-truth/scripts/seed-endpoints.ts

# Run overnight pipeline manually
npx tsx src/lib/regulatory-truth/scripts/overnight-run.ts
```

### Production

Set `REGULATORY_CRON_ENABLED=true` in environment to enable automatic 06:00 AM runs.

### Monitoring

Access `/api/regulatory/status` (admin only) for:

- Pipeline metrics
- Endpoint health
- Recent agent runs
- Scheduler status

### Manual Triggers

POST to `/api/regulatory/trigger` with:

- `{ "phase": "discovery" }` - Discovery only
- `{ "phase": "full" }` - Full pipeline
