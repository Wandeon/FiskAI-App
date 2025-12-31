/**
 * Enterprise Route Registry
 *
 * Single source of truth for all routes in FiskAI.
 * Used by: sitemap.ts, navigation, SmartLink, footer, breadcrumbs
 *
 * Architecture:
 * - i18n-ready with path objects (hr/en)
 * - Type-safe RouteId prevents typos
 * - Explicit sitemap inclusion/exclusion
 * - SEO metadata (priority, changeFreq)
 *
 * IMPORTANT: English routes are defined here for future i18n implementation,
 * but are NOT currently implemented. Only Croatian (hr) routes exist.
 * See Issue #185 for tracking English route implementation.
 *
 * Status:
 * - Croatian (hr) routes: ✅ Implemented and working
 * - English (en) routes: ❌ Not implemented (registry only)
 * - Sitemap: English alternates disabled (see sitemap.ts comments)
 * - Layout metadata: English language alternates removed (see layout.tsx)
 */

// =============================================================================
// Types
// =============================================================================

export type Locale = "hr" | "en"

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never"

export interface RouteDef {
  /** Localized paths - Croatian is canonical */
  path: Record<Locale, string>
  /** SEO priority 0.0 - 1.0 */
  priority: number
  /** How often content changes */
  changeFreq: ChangeFrequency
  /** Include in public sitemap.xml */
  sitemap: boolean
  /** Route category for organization */
  category: RouteCategory
  /** Optional: Croatian page title for nav/breadcrumbs */
  title?: string
}

export type RouteCategory =
  | "core" // Homepage, main landing
  | "marketing" // Features, pricing, about
  | "tools" // Free tools (/alati/*)
  | "content" // Guides, comparisons, knowledge base
  | "news" // Blog/news section
  | "legal" // Privacy, terms, DPA
  | "auth" // Login, register, password reset
  | "app" // Authenticated app routes (excluded from sitemap)
  | "internal" // Staff/admin portals

// =============================================================================
// Route IDs - Add new routes here
// =============================================================================

export type RouteId =
  // Core
  | "home"
  // Marketing
  | "features"
  | "pricing"
  | "about"
  | "contact"
  | "security"
  | "status"
  | "fiskalizacija"
  | "prelazak"
  // Landing pages (for specific audiences)
  | "for_pausalni"
  | "for_dooo"
  | "for_accountants"
  // Tools hub
  | "alati"
  | "alati_eracun"
  | "alati_kalendar"
  | "alati_kalkulator_doprinosa"
  | "alati_kalkulator_poreza"
  | "alati_oib_validator"
  | "alati_pdv_kalkulator"
  | "alati_posd_kalkulator"
  | "alati_uplatnice"
  // Content hubs
  | "vodic"
  | "usporedba"
  | "baza_znanja"
  | "rjecnik"
  | "kako_da"
  // News
  | "vijesti"
  // Transparency
  | "metodologija"
  | "urednicka_politika"
  | "izvori"
  // Legal
  | "privacy"
  | "terms"
  | "dpa"
  | "cookies"
  | "ai_data_policy"
  // Auth (excluded from sitemap)
  | "login"
  | "register"
  | "forgot_password"
  | "reset_password"
  | "verify_email"
  | "check_email"
  | "select_role"
  // AI
  | "assistant"
  | "assistant_demo"
  | "wizard"

// =============================================================================
// Route Definitions
// =============================================================================

export const routes: Record<RouteId, RouteDef> = {
  // ---------------------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------------------
  home: {
    path: { hr: "/", en: "/en" },
    priority: 1.0,
    changeFreq: "daily",
    sitemap: true,
    category: "core",
    title: "Početna",
  },

  // ---------------------------------------------------------------------------
  // Marketing
  // ---------------------------------------------------------------------------
  features: {
    path: { hr: "/features", en: "/en/features" },
    priority: 0.9,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Mogućnosti",
  },
  pricing: {
    path: { hr: "/pricing", en: "/en/pricing" },
    priority: 0.9,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Cijene",
  },
  about: {
    path: { hr: "/about", en: "/en/about" },
    priority: 0.7,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "O nama",
  },
  contact: {
    path: { hr: "/contact", en: "/en/contact" },
    priority: 0.7,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Kontakt",
  },
  security: {
    path: { hr: "/security", en: "/en/security" },
    priority: 0.6,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Sigurnost",
  },
  status: {
    path: { hr: "/status", en: "/en/status" },
    priority: 0.5,
    changeFreq: "hourly",
    sitemap: true,
    category: "marketing",
    title: "Status sustava",
  },
  fiskalizacija: {
    path: { hr: "/fiskalizacija", en: "/en/fiscalization" },
    priority: 0.8,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Fiskalizacija 2.0",
  },
  prelazak: {
    path: { hr: "/prelazak", en: "/en/migration" },
    priority: 0.7,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Prelazak na FiskAI",
  },

  // ---------------------------------------------------------------------------
  // Landing pages (audience-specific)
  // ---------------------------------------------------------------------------
  for_pausalni: {
    path: { hr: "/for/pausalni-obrt", en: "/en/for/flat-rate-business" },
    priority: 0.85,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Za paušalni obrt",
  },
  for_dooo: {
    path: { hr: "/for/dooo", en: "/en/for/llc" },
    priority: 0.85,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Za d.o.o.",
  },
  for_accountants: {
    path: { hr: "/for/accountants", en: "/en/for/accountants" },
    priority: 0.85,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "Za računovođe",
  },

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------
  alati: {
    path: { hr: "/alati", en: "/en/tools" },
    priority: 0.8,
    changeFreq: "weekly",
    sitemap: true,
    category: "tools",
    title: "Alati",
  },
  alati_eracun: {
    path: { hr: "/alati/e-racun", en: "/en/tools/e-invoice" },
    priority: 0.75,
    changeFreq: "weekly",
    sitemap: true,
    category: "tools",
    title: "E-Račun Generator",
  },
  alati_kalendar: {
    path: { hr: "/alati/kalendar", en: "/en/tools/calendar" },
    priority: 0.75,
    changeFreq: "weekly",
    sitemap: true,
    category: "tools",
    title: "Kalendar rokova",
  },
  alati_kalkulator_doprinosa: {
    path: {
      hr: "/alati/kalkulator-doprinosa",
      en: "/en/tools/contributions-calculator",
    },
    priority: 0.75,
    changeFreq: "monthly",
    sitemap: true,
    category: "tools",
    title: "Kalkulator doprinosa",
  },
  alati_kalkulator_poreza: {
    path: { hr: "/alati/kalkulator-poreza", en: "/en/tools/tax-calculator" },
    priority: 0.75,
    changeFreq: "monthly",
    sitemap: true,
    category: "tools",
    title: "Kalkulator poreza",
  },
  alati_oib_validator: {
    path: { hr: "/alati/oib-validator", en: "/en/tools/oib-validator" },
    priority: 0.7,
    changeFreq: "yearly",
    sitemap: true,
    category: "tools",
    title: "OIB Validator",
  },
  alati_pdv_kalkulator: {
    path: { hr: "/alati/pdv-kalkulator", en: "/en/tools/vat-calculator" },
    priority: 0.75,
    changeFreq: "monthly",
    sitemap: true,
    category: "tools",
    title: "PDV Prag Kalkulator",
  },
  alati_posd_kalkulator: {
    path: { hr: "/alati/posd-kalkulator", en: "/en/tools/posd-calculator" },
    priority: 0.75,
    changeFreq: "monthly",
    sitemap: true,
    category: "tools",
    title: "PO-SD Kalkulator",
  },
  alati_uplatnice: {
    path: { hr: "/alati/uplatnice", en: "/en/tools/payment-slips" },
    priority: 0.75,
    changeFreq: "monthly",
    sitemap: true,
    category: "tools",
    title: "Generator uplatnica",
  },

  // ---------------------------------------------------------------------------
  // Content hubs (dynamic content fetched separately)
  // ---------------------------------------------------------------------------
  vodic: {
    path: { hr: "/vodic", en: "/en/guide" },
    priority: 0.8,
    changeFreq: "weekly",
    sitemap: true,
    category: "content",
    title: "Vodiči",
  },
  usporedba: {
    path: { hr: "/usporedba", en: "/en/comparison" },
    priority: 0.8,
    changeFreq: "weekly",
    sitemap: true,
    category: "content",
    title: "Usporedbe",
  },
  baza_znanja: {
    path: { hr: "/baza-znanja", en: "/en/knowledge-base" },
    priority: 0.75,
    changeFreq: "weekly",
    sitemap: true,
    category: "content",
    title: "Baza znanja",
  },
  rjecnik: {
    path: { hr: "/rjecnik", en: "/en/glossary" },
    priority: 0.7,
    changeFreq: "weekly",
    sitemap: true,
    category: "content",
    title: "Rječnik pojmova",
  },
  kako_da: {
    path: { hr: "/kako-da", en: "/en/how-to" },
    priority: 0.7,
    changeFreq: "weekly",
    sitemap: true,
    category: "content",
    title: "Kako da...",
  },

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------
  vijesti: {
    path: { hr: "/vijesti", en: "/en/news" },
    priority: 0.8,
    changeFreq: "daily",
    sitemap: true,
    category: "news",
    title: "Vijesti",
  },

  // ---------------------------------------------------------------------------
  // Transparency
  // ---------------------------------------------------------------------------
  metodologija: {
    path: { hr: "/metodologija", en: "/en/methodology" },
    priority: 0.5,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Metodologija",
  },
  urednicka_politika: {
    path: { hr: "/urednicka-politika", en: "/en/editorial-policy" },
    priority: 0.5,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Urednička politika",
  },
  izvori: {
    path: { hr: "/izvori", en: "/en/sources" },
    priority: 0.5,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Službeni izvori",
  },

  // ---------------------------------------------------------------------------
  // Legal
  // ---------------------------------------------------------------------------
  privacy: {
    path: { hr: "/privacy", en: "/en/privacy" },
    priority: 0.3,
    changeFreq: "monthly",
    sitemap: true,
    category: "legal",
    title: "Privatnost",
  },
  terms: {
    path: { hr: "/terms", en: "/en/terms" },
    priority: 0.3,
    changeFreq: "monthly",
    sitemap: true,
    category: "legal",
    title: "Uvjeti korištenja",
  },
  dpa: {
    path: { hr: "/dpa", en: "/en/dpa" },
    priority: 0.3,
    changeFreq: "monthly",
    sitemap: true,
    category: "legal",
    title: "DPA",
  },
  cookies: {
    path: { hr: "/cookies", en: "/en/cookies" },
    priority: 0.3,
    changeFreq: "monthly",
    sitemap: true,
    category: "legal",
    title: "Kolačići",
  },
  ai_data_policy: {
    path: { hr: "/ai-data-policy", en: "/en/ai-data-policy" },
    priority: 0.3,
    changeFreq: "monthly",
    sitemap: true,
    category: "legal",
    title: "AI politika",
  },

  // ---------------------------------------------------------------------------
  // Auth (excluded from sitemap - noindex)
  // ---------------------------------------------------------------------------
  login: {
    path: { hr: "/login", en: "/en/login" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Prijava",
  },
  register: {
    path: { hr: "/register", en: "/en/register" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Registracija",
  },
  forgot_password: {
    path: { hr: "/forgot-password", en: "/en/forgot-password" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Zaboravljena lozinka",
  },
  reset_password: {
    path: { hr: "/reset-password", en: "/en/reset-password" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Nova lozinka",
  },
  verify_email: {
    path: { hr: "/verify-email", en: "/en/verify-email" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Potvrda emaila",
  },
  check_email: {
    path: { hr: "/check-email", en: "/en/check-email" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Provjeri email",
  },
  select_role: {
    path: { hr: "/select-role", en: "/en/select-role" },
    priority: 0,
    changeFreq: "never",
    sitemap: false,
    category: "auth",
    title: "Odaberi ulogu",
  },

  // ---------------------------------------------------------------------------
  // AI features
  // ---------------------------------------------------------------------------
  assistant: {
    path: { hr: "/assistant", en: "/en/assistant" },
    priority: 0.7,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "AI Asistent",
  },
  assistant_demo: {
    path: { hr: "/assistant-demo", en: "/en/assistant-demo" },
    priority: 0.6,
    changeFreq: "weekly",
    sitemap: true,
    category: "marketing",
    title: "AI Asistent Demo",
  },
  wizard: {
    path: { hr: "/wizard", en: "/en/wizard" },
    priority: 0.7,
    changeFreq: "monthly",
    sitemap: true,
    category: "marketing",
    title: "Čarobnjak za odabir",
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the path for a route in a specific locale
 */
export function getRoutePath(routeId: RouteId, locale: Locale = "hr"): string {
  return routes[routeId].path[locale]
}

/**
 * Get all routes that should be in the sitemap
 */
export function getSitemapRoutes(): Array<[RouteId, RouteDef]> {
  return Object.entries(routes).filter(([, def]) => def.sitemap) as Array<[RouteId, RouteDef]>
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: RouteCategory): Array<[RouteId, RouteDef]> {
  return Object.entries(routes).filter(([, def]) => def.category === category) as Array<
    [RouteId, RouteDef]
  >
}

/**
 * Check if a path exists in the registry (for validation)
 */
export function isValidRoute(path: string, locale: Locale = "hr"): boolean {
  return Object.values(routes).some((def) => def.path[locale] === path)
}

/**
 * Get RouteId from a path (reverse lookup)
 */
export function getRouteIdFromPath(path: string, locale: Locale = "hr"): RouteId | null {
  const entry = Object.entries(routes).find(([, def]) => def.path[locale] === path)
  return entry ? (entry[0] as RouteId) : null
}

// =============================================================================
// Environment Safety
// =============================================================================

/**
 * Returns true only in production environment
 * Use this to prevent staging/dev sitemaps from being indexed
 */
export function isProductionSitemap(): boolean {
  const env = process.env.NODE_ENV
  const url = process.env.NEXT_PUBLIC_APP_URL || ""

  // Must be production AND on the canonical domain
  return env === "production" && url.includes("fiskai.hr")
}

/**
 * Get the canonical base URL (only fiskai.hr in production)
 */
export function getCanonicalBaseUrl(): string {
  if (!isProductionSitemap()) {
    // Return empty to signal "don't generate sitemap"
    return ""
  }
  return "https://fiskai.hr"
}
