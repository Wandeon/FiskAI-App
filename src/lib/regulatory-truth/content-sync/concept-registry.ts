// src/lib/regulatory-truth/content-sync/concept-registry.ts
/**
 * Concept Registry - Maps regulatory concepts to MDX content files
 *
 * This registry provides the mapping between RTL concepts (from RegulatoryRule)
 * and the MDX content files that need to be updated when those concepts change.
 *
 * All mdxPaths are relative to the content/ directory.
 */

import * as path from "path"

/**
 * Represents a mapping between a regulatory concept and its related content
 */
export interface ConceptMapping {
  /** Unique identifier for the concept (exact match, no regex) */
  conceptId: string
  /** Human-readable description of what this concept represents */
  description: string
  /** Array of MDX file paths relative to content/ directory */
  mdxPaths: string[]
  /** Optional calculator or tool IDs that use this concept */
  toolIds?: string[]
}

/**
 * Core concept registry mapping Croatian regulatory concepts to content files
 *
 * Each concept maps to one or more MDX files that reference or explain
 * the regulatory value. When RTL detects a change in a concept's value,
 * the content-sync system uses this registry to identify which files
 * need review or automatic updates.
 */
export const CONCEPT_REGISTRY: readonly ConceptMapping[] = [
  // === PDV (VAT) Related Concepts ===
  {
    conceptId: "pdv-threshold",
    description: "PDV registration threshold (annual revenue limit for mandatory VAT registration)",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "vodici/freelancer.mdx",
      "rjecnik/pdv.mdx",
      "kako-da/uci-u-sustav-pdv.mdx",
      "usporedbe/preko-praga.mdx",
    ],
    toolIds: ["pausalni-calculator", "vat-threshold-checker"],
  },
  {
    conceptId: "pdv-standard-rate",
    description: "Standard PDV rate (25%)",
    mdxPaths: ["rjecnik/pdv.mdx", "vodici/doo.mdx"],
    toolIds: ["invoice-calculator"],
  },
  {
    conceptId: "pdv-reduced-rate",
    description: "Reduced PDV rate (13%)",
    mdxPaths: ["rjecnik/pdv.mdx"],
  },
  {
    conceptId: "pdv-lower-rate",
    description: "Lower reduced PDV rate (5%)",
    mdxPaths: ["rjecnik/pdv.mdx"],
  },
  {
    conceptId: "reverse-charge-eu",
    description: "EU reverse charge mechanism rules for cross-border B2B services",
    mdxPaths: ["vodici/freelancer.mdx", "rjecnik/pdv.mdx"],
  },

  // === Pausalni Obrt Concepts ===
  {
    conceptId: "pausalni-revenue-limit",
    description: "Pausalni obrt annual revenue limit for flat-rate taxation",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "rjecnik/pausal.mdx",
      "usporedbe/pocinjem-solo.mdx",
      "usporedbe/preko-praga.mdx",
    ],
    toolIds: ["pausalni-calculator"],
  },
  {
    conceptId: "pausalni-tax-rate",
    description: "Pausalni obrt flat tax rate on revenue",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "rjecnik/pausal.mdx",
      "kako-da/godisnji-obracun-pausalca.mdx",
    ],
    toolIds: ["pausalni-calculator"],
  },
  {
    conceptId: "pausalni-contribution-base",
    description: "Base amount for calculating pausalni obrt contributions",
    mdxPaths: ["vodici/pausalni-obrt.mdx", "rjecnik/pausal.mdx", "rjecnik/minimalna-osnovica.mdx"],
    toolIds: ["pausalni-calculator"],
  },

  // === Contribution Rates ===
  {
    conceptId: "zdravstveno-rate",
    description: "Health insurance contribution rate (HZZO)",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "vodici/obrt-dohodak.mdx",
      "rjecnik/hzzo.mdx",
      "kako-da/godisnji-obracun-pausalca.mdx",
    ],
    toolIds: ["pausalni-calculator", "salary-calculator"],
  },
  {
    conceptId: "mirovinsko-rate",
    description: "Pension insurance contribution rate (MIO)",
    mdxPaths: [
      "vodici/pausalni-obrt.mdx",
      "vodici/obrt-dohodak.mdx",
      "rjecnik/mio.mdx",
      "kako-da/godisnji-obracun-pausalca.mdx",
    ],
    toolIds: ["pausalni-calculator", "salary-calculator"],
  },
  {
    conceptId: "mirovinsko-i-stup",
    description: "First pillar pension contribution rate",
    mdxPaths: ["rjecnik/mio.mdx", "vodici/pausalni-obrt.mdx"],
    toolIds: ["salary-calculator"],
  },
  {
    conceptId: "mirovinsko-ii-stup",
    description: "Second pillar pension contribution rate",
    mdxPaths: ["rjecnik/mio.mdx", "vodici/pausalni-obrt.mdx"],
    toolIds: ["salary-calculator"],
  },

  // === Fiscalization ===
  {
    conceptId: "fiskalizacija-required",
    description: "Requirements and rules for fiscalization of invoices",
    mdxPaths: [
      "hubovi/fiskalizacija.mdx",
      "rjecnik/fiskalizacija.mdx",
      "rjecnik/jir.mdx",
      "rjecnik/zki.mdx",
    ],
    toolIds: ["fiscalization-checker"],
  },
  {
    conceptId: "fiskalizacija-exempt-activities",
    description: "Activities exempt from fiscalization requirement",
    mdxPaths: ["hubovi/fiskalizacija.mdx", "rjecnik/fiskalizacija.mdx"],
  },

  // === Tax Form Deadlines ===
  {
    conceptId: "posd-deadline",
    description: "PO-SD form submission deadline for pausalni obrt",
    mdxPaths: [
      "rjecnik/po-sd.mdx",
      "kako-da/ispuniti-po-sd.mdx",
      "kako-da/godisnji-obracun-pausalca.mdx",
    ],
    toolIds: ["deadline-tracker"],
  },
  {
    conceptId: "joppd-deadline",
    description: "JOPPD form submission deadline",
    mdxPaths: ["rjecnik/joppd.mdx", "vodici/doo.mdx"],
    toolIds: ["deadline-tracker"],
  },
  {
    conceptId: "pdv-obrazac-deadline",
    description: "PDV form submission deadline",
    mdxPaths: ["rjecnik/pdv-obrazac.mdx", "kako-da/uci-u-sustav-pdv.mdx"],
    toolIds: ["deadline-tracker"],
  },

  // === Company Capital Requirements ===
  {
    conceptId: "jdoo-capital-requirement",
    description: "Minimum founding capital for j.d.o.o. (simple limited company)",
    mdxPaths: ["rjecnik/jdoo.mdx", "usporedbe/firma.mdx", "usporedbe/pocinjem-solo.mdx"],
  },
  {
    conceptId: "doo-capital-requirement",
    description: "Minimum founding capital for d.o.o. (limited liability company)",
    mdxPaths: [
      "vodici/doo.mdx",
      "rjecnik/doo.mdx",
      "rjecnik/temeljni-kapital.mdx",
      "usporedbe/firma.mdx",
    ],
  },

  // === Income Tax ===
  {
    conceptId: "porez-na-dohodak-rates",
    description: "Personal income tax rates and brackets",
    mdxPaths: [
      "vodici/obrt-dohodak.mdx",
      "rjecnik/dohodak.mdx",
      "rjecnik/porezni-razred.mdx",
      "rjecnik/stopa-poreza.mdx",
    ],
    toolIds: ["income-tax-calculator"],
  },
  {
    conceptId: "osobni-odbitak",
    description: "Personal tax deduction base amount",
    mdxPaths: ["rjecnik/osobni-odbitak.mdx", "vodici/obrt-dohodak.mdx", "rjecnik/dohodak.mdx"],
    toolIds: ["income-tax-calculator"],
  },
  {
    conceptId: "uzdrzavani-odbitak",
    description: "Tax deduction coefficients for dependents",
    mdxPaths: ["rjecnik/osobni-odbitak.mdx"],
    toolIds: ["income-tax-calculator"],
  },

  // === Corporate Tax ===
  {
    conceptId: "porez-na-dobit-rate",
    description: "Corporate profit tax rate",
    mdxPaths: ["vodici/doo.mdx", "rjecnik/dobit.mdx", "usporedbe/firma.mdx"],
    toolIds: ["corporate-tax-calculator"],
  },
  {
    conceptId: "porez-na-dobit-reduced",
    description: "Reduced corporate profit tax rate for small businesses",
    mdxPaths: ["vodici/doo.mdx", "rjecnik/dobit.mdx"],
    toolIds: ["corporate-tax-calculator"],
  },

  // === E-Invoicing ===
  {
    conceptId: "e-racun-mandatory",
    description: "E-invoice mandate requirements and timeline",
    mdxPaths: ["rjecnik/e-racun.mdx", "rjecnik/peppol.mdx", "rjecnik/ubl.mdx"],
    toolIds: ["e-invoice-validator"],
  },
  {
    conceptId: "e-racun-b2g-deadline",
    description: "Deadline for mandatory B2G e-invoicing",
    mdxPaths: ["rjecnik/e-racun.mdx"],
  },

  // === Minimum Wage ===
  {
    conceptId: "minimalna-placa",
    description: "National minimum wage (bruto)",
    mdxPaths: ["vodici/doo.mdx", "rjecnik/minimalna-osnovica.mdx"],
    toolIds: ["salary-calculator"],
  },

  // === Special Business Forms ===
  {
    conceptId: "opg-pdv-threshold",
    description: "OPG (family farm) VAT registration threshold",
    mdxPaths: ["vodici/posebni-oblici.mdx", "rjecnik/pdv.mdx"],
  },
  {
    conceptId: "opg-pausalni-limit",
    description: "OPG flat-rate taxation revenue limit",
    mdxPaths: ["vodici/posebni-oblici.mdx"],
  },

  // === Accounting & Bookkeeping ===
  {
    conceptId: "fiskalna-godina",
    description: "Fiscal year definition and rules",
    mdxPaths: ["rjecnik/fiskalna-godina.mdx", "vodici/doo.mdx"],
  },
  {
    conceptId: "kpr-requirements",
    description: "KPR (business book) requirements for pausalni obrt",
    mdxPaths: ["rjecnik/kpr.mdx", "vodici/pausalni-obrt.mdx"],
  },
  {
    conceptId: "ira-ura-requirements",
    description: "IRA/URA ledger requirements",
    mdxPaths: ["rjecnik/ira.mdx", "rjecnik/ura.mdx", "vodici/obrt-dohodak.mdx"],
  },

  // === Registration & Registries ===
  {
    conceptId: "obrtni-registar-fees",
    description: "Obrtni registar registration fees",
    mdxPaths: ["rjecnik/obrtni-registar.mdx", "rjecnik/obrt.mdx"],
  },
  {
    conceptId: "sudski-registar-fees",
    description: "Sudski registar (court registry) registration fees for companies",
    mdxPaths: ["rjecnik/sudski-registar.mdx", "vodici/doo.mdx"],
  },

  // === Chamber Membership ===
  {
    conceptId: "hok-membership",
    description: "HOK (Croatian Chamber of Trades) membership requirements",
    mdxPaths: ["rjecnik/hok.mdx", "rjecnik/obrt.mdx"],
  },
  {
    conceptId: "hgk-membership",
    description: "HGK (Croatian Chamber of Commerce) membership requirements",
    mdxPaths: ["rjecnik/hgk.mdx", "vodici/doo.mdx"],
  },

  // === Invoice Types ===
  {
    conceptId: "racun-r1-requirements",
    description: "R-1 invoice requirements (for VAT payers)",
    mdxPaths: ["rjecnik/r-1.mdx", "rjecnik/pdv.mdx"],
  },
  {
    conceptId: "racun-r2-requirements",
    description: "R-2 invoice requirements (for non-VAT payers)",
    mdxPaths: ["rjecnik/r-2.mdx", "vodici/pausalni-obrt.mdx"],
  },

  // === Advance Payments ===
  {
    conceptId: "predujam-rules",
    description: "Advance payment (predujam) tax treatment rules",
    mdxPaths: ["rjecnik/predujam.mdx", "rjecnik/akontacija.mdx"],
  },

  // === Local Taxes ===
  {
    conceptId: "prirez-rates",
    description: "Municipal surtax (prirez) rates by city",
    mdxPaths: ["rjecnik/prirez.mdx", "vodici/obrt-dohodak.mdx"],
    toolIds: ["income-tax-calculator", "salary-calculator"],
  },

  // === Residency ===
  {
    conceptId: "rezident-rules",
    description: "Tax residency rules for Croatia",
    mdxPaths: ["rjecnik/rezident.mdx", "rjecnik/nerezident.mdx", "vodici/freelancer.mdx"],
  },

  // === Information Intermediary ===
  {
    conceptId: "informacijski-posrednik",
    description: "Information intermediary (FINA) registration requirements",
    mdxPaths: [
      "rjecnik/informacijski-posrednik.mdx",
      "kako-da/registrirati-informacijskog-posrednika.mdx",
    ],
  },
] as const

/**
 * Retrieves a concept mapping by its ID
 *
 * @param conceptId - The unique identifier of the concept
 * @returns The concept mapping if found, undefined otherwise
 */
export function getConceptMapping(conceptId: string): ConceptMapping | undefined {
  return CONCEPT_REGISTRY.find((mapping) => mapping.conceptId === conceptId)
}

/**
 * Resolves relative MDX paths to absolute paths
 *
 * @param mapping - The concept mapping containing relative paths
 * @param contentDir - Absolute path to the content directory
 * @returns Array of absolute paths to MDX files
 */
export function resolveContentPaths(mapping: ConceptMapping, contentDir: string): string[] {
  return mapping.mdxPaths.map((relativePath) => path.join(contentDir, relativePath))
}

/**
 * Returns all concept IDs in the registry
 *
 * @returns Array of all registered concept IDs
 */
export function getAllConceptIds(): string[] {
  return CONCEPT_REGISTRY.map((mapping) => mapping.conceptId)
}

/**
 * Finds all concepts that affect a given MDX file
 *
 * @param mdxPath - Relative path to MDX file (from content/ directory)
 * @returns Array of concept mappings that include this file
 */
export function getConceptsForFile(mdxPath: string): ConceptMapping[] {
  return CONCEPT_REGISTRY.filter((mapping) => mapping.mdxPaths.includes(mdxPath))
}

/**
 * Finds all concepts associated with a given tool ID
 *
 * @param toolId - The tool/calculator identifier
 * @returns Array of concept mappings that affect this tool
 */
export function getConceptsForTool(toolId: string): ConceptMapping[] {
  return CONCEPT_REGISTRY.filter((mapping) => mapping.toolIds?.includes(toolId))
}
