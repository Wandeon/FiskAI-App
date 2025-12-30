export const MODULE_KEYS = [
  "platform-core",
  "invoicing",
  "e-invoicing",
  "fiscalization",
  "contacts",
  "products",
  "expenses",
  "banking",
  "reconciliation",
  "reports-basic",
  "reports-advanced",
  "pausalni",
  "vat",
  "corporate-tax",
  "pos",
  "documents",
  "ai-assistant",
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface ModuleDefinition {
  key: ModuleKey
  name: string
  description: string
  routes: string[]
  navItems: string[]
  defaultEnabled: boolean
  depends?: ModuleKey[]
  featureFlagKey?: string
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  "platform-core": {
    key: "platform-core",
    name: "Platform Core",
    description: "Core platform access for dashboards, settings, and support",
    routes: ["/dashboard", "/settings", "/support", "/accountant", "/compliance"],
    navItems: ["dashboard", "settings", "support", "accountant", "compliance"],
    defaultEnabled: true,
  },
  invoicing: {
    key: "invoicing",
    name: "Invoicing",
    description: "Create and manage invoices, quotes, proformas",
    routes: ["/invoices", "/invoices/new", "/invoices/[id]"],
    navItems: ["invoices"],
    defaultEnabled: true,
  },
  "e-invoicing": {
    key: "e-invoicing",
    name: "E-Invoicing",
    description: "Electronic invoices with UBL/XML support",
    routes: ["/e-invoices", "/e-invoices/new", "/e-invoices/[id]"],
    navItems: ["e-invoices"],
    defaultEnabled: true,
    depends: ["invoicing", "contacts"],
  },
  fiscalization: {
    key: "fiscalization",
    name: "Fiscalization",
    description: "Fiscal receipts, JIR/ZKI, CIS integration",
    routes: ["/settings/fiscalisation", "/settings/premises"],
    navItems: ["fiscalization"],
    defaultEnabled: false,
    depends: ["invoicing"],
  },
  contacts: {
    key: "contacts",
    name: "Contacts",
    description: "Customer and supplier management",
    routes: ["/contacts", "/contacts/new", "/contacts/[id]"],
    navItems: ["contacts"],
    defaultEnabled: true,
  },
  products: {
    key: "products",
    name: "Products",
    description: "Product catalog and pricing",
    routes: ["/products", "/products/new", "/products/[id]"],
    navItems: ["products"],
    defaultEnabled: true,
  },
  expenses: {
    key: "expenses",
    name: "Expenses",
    description: "Expense tracking and categories",
    routes: ["/expenses", "/expenses/new", "/expenses/[id]", "/expenses/categories"],
    navItems: ["expenses"],
    defaultEnabled: true,
  },
  banking: {
    key: "banking",
    name: "Banking",
    description: "Bank accounts, transactions, imports",
    routes: ["/banking", "/banking/accounts", "/banking/transactions", "/banking/import"],
    navItems: ["banking"],
    defaultEnabled: false,
  },
  reconciliation: {
    key: "reconciliation",
    name: "Reconciliation",
    description: "Auto-matching and statement reconciliation",
    routes: ["/banking/reconciliation"],
    navItems: ["reconciliation"],
    defaultEnabled: false,
    depends: ["banking", "invoicing"],
  },
  "reports-basic": {
    key: "reports-basic",
    name: "Basic Reports",
    description: "Aging, KPR, profit/loss reports",
    routes: ["/reports", "/reports/aging", "/reports/kpr", "/reports/profit-loss"],
    navItems: ["reports-basic"],
    defaultEnabled: true,
  },
  "reports-advanced": {
    key: "reports-advanced",
    name: "Advanced Reports",
    description: "VAT reports, exports, custom reports",
    routes: ["/reports/vat-threshold", "/reports/export"],
    navItems: ["reports-advanced"],
    defaultEnabled: false,
  },
  pausalni: {
    key: "pausalni",
    name: "Paušalni",
    description: "Paušalni obrt tax management",
    routes: ["/pausalni", "/pausalni/forms", "/pausalni/settings", "/pausalni/po-sd"],
    navItems: ["pausalni"],
    defaultEnabled: false,
  },
  vat: {
    key: "vat",
    name: "VAT",
    description: "VAT management and submissions",
    routes: ["/reports/vat"],
    navItems: ["vat"],
    defaultEnabled: false,
  },
  "corporate-tax": {
    key: "corporate-tax",
    name: "Corporate Tax",
    description: "DOO/JDOO tax features",
    routes: ["/corporate-tax"],
    navItems: ["corporate-tax"],
    defaultEnabled: false,
  },
  pos: {
    key: "pos",
    name: "POS",
    description: "Point of sale and Stripe Terminal",
    routes: ["/pos"],
    navItems: ["pos"],
    defaultEnabled: false,
  },
  documents: {
    key: "documents",
    name: "Documents",
    description: "Document storage and attachments",
    routes: ["/documents", "/documents/[id]"],
    navItems: ["documents"],
    defaultEnabled: true,
  },
  "ai-assistant": {
    key: "ai-assistant",
    name: "AI Assistant",
    description: "AI-powered help and document analysis",
    routes: ["/assistant", "/article-agent"],
    navItems: ["ai-assistant"],
    defaultEnabled: false,
    featureFlagKey: "ai_assistant",
  },
}

export const DEFAULT_ENTITLEMENTS: ModuleKey[] = MODULE_KEYS.filter(
  (key) => MODULES[key].defaultEnabled
)

/**
 * Get entitlements for a specific legal form.
 * Auto-assigns modules based on business type selection.
 *
 * @see GitHub Issue #202
 * @see docs/product-bible/04-ACCESS-CONTROL.md
 */
export function getEntitlementsForLegalForm(legalForm: string | null): ModuleKey[] {
  // Base entitlements for all business types
  const base: ModuleKey[] = [
    "platform-core",
    "invoicing",
    "e-invoicing",
    "contacts",
    "products",
    "expenses",
    "documents",
    "reports-basic",
  ]

  // Add specific modules based on legal form
  switch (legalForm) {
    case "OBRT_PAUSAL":
      return [...base, "pausalni"]

    case "OBRT_REAL":
      return [...base, "expenses"]

    case "OBRT_VAT":
      return [...base, "vat", "expenses"]

    case "JDOO":
      return [...base, "vat", "corporate-tax", "reports-advanced"]

    case "DOO":
      return [...base, "vat", "corporate-tax", "reports-advanced", "reconciliation"]

    default:
      // Fallback to default entitlements if legal form is unknown
      return DEFAULT_ENTITLEMENTS
  }
}

/**
 * Get all dependencies for a module (including transitive dependencies)
 */
export function getDependencies(moduleKey: ModuleKey): ModuleKey[] {
  const visited = new Set<ModuleKey>()
  const dependencies: ModuleKey[] = []

  function collectDependencies(key: ModuleKey) {
    if (visited.has(key)) return
    visited.add(key)

    const moduleDef = MODULES[key]
    if (moduleDef.depends) {
      for (const dep of moduleDef.depends) {
        collectDependencies(dep)
        if (!dependencies.includes(dep)) {
          dependencies.push(dep)
        }
      }
    }
  }

  collectDependencies(moduleKey)
  return dependencies
}

/**
 * Get direct dependencies for a module (non-transitive)
 */
export function getDirectDependencies(moduleKey: ModuleKey): ModuleKey[] {
  return MODULES[moduleKey].depends ?? []
}
