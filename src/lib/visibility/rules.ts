// src/lib/visibility/rules.ts
// Business type visibility matrix and progression rules

import type { LegalForm } from "@/lib/capabilities"
import type { ElementId } from "./elements"
import { type CompetenceLevel } from "@/lib/types/competence"

// Re-export for backwards compatibility
export type { CompetenceLevel } from "@/lib/types/competence"

// ============================================================================
// Competence Levels
// ============================================================================

export const COMPETENCE_LABELS: Record<CompetenceLevel, string> = {
  beginner: "Početnik",
  average: "Iskusan",
  pro: "Stručnjak",
}

// ============================================================================
// Progression Stages
// ============================================================================

export type ProgressionStage =
  | "onboarding" // Stage 0: Currently in the 4-step wizard
  | "setup" // Stage 1: Profile done, ready for 1st invoice/data
  | "needs-customer" // Substage: needs first customer
  | "needs-product" // Substage: needs first product
  | "needs-invoice" // Substage: needs first invoice
  | "needs-statements" // Substage: needs bank statements
  | "active" // Stage 2: Operational (1+ invoice or statement)
  | "strategic" // Stage 3: Maintenance/Strategic (10+ invoices or VAT)
  | "complete" // Stage 4: All stages complete

export const STAGE_ORDER: ProgressionStage[] = [
  "onboarding",
  "setup",
  "needs-customer",
  "needs-product",
  "needs-invoice",
  "needs-statements",
  "active",
  "strategic",
  "complete",
]

export const STAGE_LABELS: Record<ProgressionStage, string> = {
  onboarding: "Registracija",
  setup: "Postavljanje",
  "needs-customer": "Dodaj kupca",
  "needs-product": "Dodaj proizvod",
  "needs-invoice": "Kreiraj račun",
  "needs-statements": "Uvezi izvode",
  active: "Operativno",
  strategic: "Strateški",
  complete: "Gotovo",
}

export const STAGE_ICONS: Record<ProgressionStage, string> = {
  onboarding: "📝",
  setup: "⚙️",
  "needs-customer": "👤",
  "needs-product": "📦",
  "needs-invoice": "🧾",
  "needs-statements": "🏦",
  active: "🚀",
  strategic: "📈",
  complete: "✅",
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
    locked: [
      "action:create-invoice",
      "action:create-contact",
      "action:create-product",
      "action:import-statements",
      "action:export-data",
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:recent-activity",
      "card:insights",
      "card:advanced-insights",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dovršite registraciju tvrtke",
  },
  setup: {
    // Basic actions are UNLOCKED in setup
    locked: [
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:recent-activity",
      "card:insights",
      "card:advanced-insights",
      "nav:reports",
      "page:reports",
      "action:export-data",
    ],
    unlockHint: "Izradite prvi račun ili uvezite podatke",
  },
  "needs-customer": {
    locked: [
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:insights",
      "card:advanced-insights",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dodajte prvog kupca",
  },
  "needs-product": {
    locked: [
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:insights",
      "card:advanced-insights",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Dodajte prvi proizvod",
  },
  "needs-invoice": {
    locked: [
      "card:invoice-funnel",
      "card:revenue-trend",
      "card:insights",
      "card:advanced-insights",
      "nav:reports",
      "page:reports",
    ],
    unlockHint: "Kreirajte prvu fakturu",
  },
  "needs-statements": {
    locked: ["card:revenue-trend", "card:insights", "card:advanced-insights"],
    unlockHint: "Uvezite bankovne izvode",
  },
  active: {
    locked: ["card:insights", "card:advanced-insights"],
    unlockHint: "Prikupite više podataka za dublje uvide",
  },
  strategic: {
    locked: [],
    unlockHint: "",
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
  beginner: "onboarding",
  average: "setup",
  pro: "active",
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
  isVatPayer?: boolean
}): ProgressionStage {
  if (!counts.hasCompletedOnboarding) return "onboarding"

  // Strategic if 10+ invoices or VAT registered
  if (counts.invoices >= 10 || counts.isVatPayer) return "strategic"

  // Active if at least one invoice or bank statement
  if (counts.invoices > 0 || counts.statements > 0) return "active"

  // Otherwise, we are in setup (profile done, but no transactions)
  return "setup"
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
    setup: { href: "/contacts/new", label: "Počnite s radom", icon: "⚙️" },
    "needs-customer": { href: "/contacts/new", label: "Dodaj prvog kupca", icon: "👤" },
    "needs-product": { href: "/products/new", label: "Dodaj prvi proizvod", icon: "📦" },
    "needs-invoice": { href: "/invoices/new", label: "Kreiraj prvu fakturu", icon: "🧾" },
    "needs-statements": { href: "/bank/import", label: "Uvezi bankovne izvode", icon: "🏦" },
    active: { href: "/dashboard", label: "Nastavi raditi", icon: "🚀" },
    strategic: { href: "/reports", label: "Pregledaj izvještaje", icon: "📈" },
    complete: null,
  }
  return actions[effectiveStage]
}
