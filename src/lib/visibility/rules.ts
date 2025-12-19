// src/lib/visibility/rules.ts
// Business type visibility matrix and progression rules

import type { LegalForm } from "@/lib/capabilities"
import type { ElementId } from "./elements"

// ============================================================================
// Competence Levels
// ============================================================================

export type CompetenceLevel = "beginner" | "average" | "pro"

export const COMPETENCE_LABELS: Record<CompetenceLevel, string> = {
  beginner: "Početnik",
  average: "Iskusan",
  pro: "Stručnjak",
}

// ============================================================================
// Progression Stages
// ============================================================================

export type ProgressionStage =
  | "onboarding" // Not yet completed onboarding
  | "needs-customer" // Onboarding done, no contacts
  | "needs-product" // Has contacts, no products
  | "needs-invoice" // Has products, no invoices
  | "needs-statements" // Has invoices, no bank data
  | "complete" // Fully activated

export const STAGE_ORDER: ProgressionStage[] = [
  "onboarding",
  "needs-customer",
  "needs-product",
  "needs-invoice",
  "needs-statements",
  "complete",
]

export const STAGE_LABELS: Record<ProgressionStage, string> = {
  onboarding: "Registracija",
  "needs-customer": "Prvi kupac",
  "needs-product": "Prvi proizvod",
  "needs-invoice": "Prva faktura",
  "needs-statements": "Bankovni izvodi",
  complete: "Sve otključano",
}

export const STAGE_ICONS: Record<ProgressionStage, string> = {
  onboarding: "📝",
  "needs-customer": "👤",
  "needs-product": "📦",
  "needs-invoice": "🧾",
  "needs-statements": "🏦",
  complete: "🎉",
}

// ============================================================================
// Business Type Visibility Rules
// Elements completely hidden based on legal form
// ============================================================================

export const BUSINESS_TYPE_HIDDEN: Record<LegalForm, ElementId[]> = {
  OBRT_PAUSAL: [
    // No PDV for paušalni
    "card:vat-overview",
    "nav:vat",
    "page:vat",
    // No corporate tax
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  OBRT_REAL: [
    // No PDV (unless explicitly VAT registered)
    "card:vat-overview",
    "nav:vat",
    "page:vat",
    // Not paušalni
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    // No corporate tax
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  OBRT_VAT: [
    // Not paušalni
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    // No corporate tax
    "card:corporate-tax",
    "nav:corporate-tax",
    "page:corporate-tax",
  ],
  JDOO: [
    // Not paušalni
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    // No doprinosi (employees have different system)
    "card:doprinosi",
    "nav:doprinosi",
    "page:doprinosi",
    // No PO-SD
    "card:posd-reminder",
  ],
  DOO: [
    // Not paušalni
    "card:pausalni-status",
    "card:checklist-widget",
    "card:insights-widget",
    // No doprinosi
    "card:doprinosi",
    "nav:doprinosi",
    "page:doprinosi",
    // No PO-SD
    "card:posd-reminder",
  ],
}

// ============================================================================
// Progression Rules
// Elements locked until stage is reached
// ============================================================================

export const PROGRESSION_LOCKED: Record<
  ProgressionStage,
  {
    locked: ElementId[]
    unlockHint: string
  }
> = {
  onboarding: {
    // Everything except basic nav is locked during onboarding
    locked: [
      "action:create-invoice",
      "action:create-contact",
      "action:create-product",
      "action:import-statements",
      "action:export-data",
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:recent-activity",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dovršite registraciju",
  },
  "needs-customer": {
    locked: [
      "action:create-product",
      "action:create-invoice",
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:recent-activity",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dodajte prvog kupca",
  },
  "needs-product": {
    locked: [
      "action:create-invoice",
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:recent-activity",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dodajte prvi proizvod ili uslugu",
  },
  "needs-invoice": {
    locked: [
      "card:revenue-trend",
      "card:recent-activity",
      "nav:reports",
      "page:reports",
      "action:export-data",
    ],
    unlockHint: "Kreirajte prvu fakturu",
  },
  "needs-statements": {
    locked: ["card:doprinosi", "card:cash-flow", "card:advanced-insights"],
    unlockHint: "Uvezite bankovne izvode",
  },
  complete: {
    locked: [],
    unlockHint: "",
  },
}

// ============================================================================
// Competence Level Overrides
// ============================================================================

// Which stage each competence level starts at (bypasses earlier stages)
export const COMPETENCE_STARTING_STAGE: Record<CompetenceLevel, ProgressionStage> = {
  beginner: "needs-customer", // Must go through all steps after onboarding
  average: "needs-invoice", // Skips customer/product steps
  pro: "complete", // Everything unlocked immediately
}

// Elements hidden based on competence (complexity reduction for beginners)
export const COMPETENCE_HIDDEN: Record<CompetenceLevel, ElementId[]> = {
  beginner: ["card:advanced-insights", "nav:api-settings"],
  average: ["nav:api-settings"],
  pro: [], // Sees everything
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the actual progression stage based on user data counts
 */
export function calculateActualStage(counts: {
  contacts: number
  products: number
  invoices: number
  statements: number
  hasCompletedOnboarding: boolean
}): ProgressionStage {
  if (!counts.hasCompletedOnboarding) return "onboarding"
  if (counts.contacts === 0) return "needs-customer"
  if (counts.products === 0) return "needs-product"
  if (counts.invoices === 0) return "needs-invoice"
  if (counts.statements === 0) return "needs-statements"
  return "complete"
}

/**
 * Get the effective stage based on actual progress and competence level
 * Competence level can skip earlier stages
 */
export function getEffectiveStage(
  actualStage: ProgressionStage,
  competence: CompetenceLevel
): ProgressionStage {
  // Pro users are always complete
  if (competence === "pro") return "complete"

  const actualIndex = STAGE_ORDER.indexOf(actualStage)
  const startingIndex = STAGE_ORDER.indexOf(COMPETENCE_STARTING_STAGE[competence])

  // Use whichever is further along
  return STAGE_ORDER[Math.max(actualIndex, startingIndex)]
}

/**
 * Check if an element is hidden by business type
 */
export function isHiddenByBusinessType(elementId: ElementId, legalForm: LegalForm): boolean {
  const hiddenElements = BUSINESS_TYPE_HIDDEN[legalForm] || []
  return hiddenElements.includes(elementId)
}

/**
 * Check if an element is hidden by competence level
 */
export function isHiddenByCompetence(elementId: ElementId, competence: CompetenceLevel): boolean {
  const hiddenElements = COMPETENCE_HIDDEN[competence] || []
  return hiddenElements.includes(elementId)
}

/**
 * Check if an element is locked by progression
 */
export function isLockedByProgression(
  elementId: ElementId,
  effectiveStage: ProgressionStage
): boolean {
  const stageRules = PROGRESSION_LOCKED[effectiveStage]
  if (!stageRules) return false
  return stageRules.locked.includes(elementId)
}

/**
 * Get the unlock hint for a locked element
 */
export function getUnlockHintForElement(
  elementId: ElementId,
  effectiveStage: ProgressionStage
): string | null {
  const stageRules = PROGRESSION_LOCKED[effectiveStage]
  if (!stageRules) return null
  if (!stageRules.locked.includes(elementId)) return null
  return stageRules.unlockHint
}

/**
 * Get the next action to take based on current stage
 */
export function getNextAction(effectiveStage: ProgressionStage): {
  href: string
  label: string
  icon: string
} | null {
  const actions: Record<ProgressionStage, { href: string; label: string; icon: string } | null> = {
    onboarding: { href: "/onboarding", label: "Dovršite registraciju", icon: "📝" },
    "needs-customer": { href: "/contacts/new", label: "Dodaj prvog kupca", icon: "👤" },
    "needs-product": { href: "/products/new", label: "Dodaj prvi proizvod", icon: "📦" },
    "needs-invoice": { href: "/invoices/new", label: "Kreiraj prvu fakturu", icon: "🧾" },
    "needs-statements": { href: "/bank/import", label: "Uvezi bankovne izvode", icon: "🏦" },
    complete: null,
  }
  return actions[effectiveStage]
}
