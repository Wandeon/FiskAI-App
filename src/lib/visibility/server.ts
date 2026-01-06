// src/lib/visibility/server.ts
// Server-side visibility utilities for use in Server Components, API routes, and middleware

import { db } from "@/lib/db"
import { getGuidancePreferences } from "@/lib/guidance/preferences"
import { COMPETENCE_LEVELS } from "@/lib/db/schema/guidance"
import type { LegalForm } from "@/lib/capabilities"
import type { ElementId } from "./elements"
import {
  type CompetenceLevel,
  type ProgressionStage,
  calculateActualStage,
  getEffectiveStage,
  isHiddenByBusinessType,
  isHiddenByCompetence,
  isLockedByProgression,
  getUnlockHintForElement,
} from "./rules"

// ============================================================================
// Types
// ============================================================================

export interface ServerVisibilityData {
  legalForm: LegalForm
  competence: CompetenceLevel
  counts: {
    contacts: number
    products: number
    invoices: number
    statements: number
  }
  hasCompletedOnboarding: boolean
  actualStage: ProgressionStage
  effectiveStage: ProgressionStage
}

export interface ServerVisibilityResult {
  isVisible: (id: ElementId) => boolean
  isLocked: (id: ElementId) => boolean
  getUnlockHint: (id: ElementId) => string | null
  data: ServerVisibilityData
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch all data needed for visibility calculations
 */
export async function getVisibilityData(
  userId: string,
  companyId: string
): Promise<ServerVisibilityData> {
  // Fetch company and counts in parallel
  const [company, contacts, products, invoices, statements, preferences] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        legalForm: true,
        isVatPayer: true,
        oib: true,
        address: true,
        city: true,
        iban: true,
        email: true,
      },
    }),
    db.contact.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.eInvoice.count({ where: { companyId } }),
    db.bankTransaction.count({ where: { companyId } }),
    getGuidancePreferences(userId),
  ])

  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  // Determine legal form (default to OBRT_PAUSAL if not set)
  const legalForm = (company.legalForm as LegalForm) || "OBRT_PAUSAL"

  // Determine competence level from guidance preferences
  // Use globalLevel if set, otherwise default to "beginner"
  const competence = mapCompetenceLevel(preferences.globalLevel || COMPETENCE_LEVELS.BEGINNER)

  // Check if onboarding is complete (has all critical fields from the 4-step flow)
  const hasCompletedOnboarding = Boolean(
    company.oib && company.address && company.city && company.iban && company.email
  )

  const counts = {
    contacts,
    products,
    invoices,
    statements,
  }

  const actualStage = calculateActualStage({
    ...counts,
    hasCompletedOnboarding,
    isVatPayer: company.isVatPayer,
  })

  const effectiveStage = getEffectiveStage(actualStage, competence)

  return {
    legalForm,
    competence,
    counts,
    hasCompletedOnboarding,
    actualStage,
    effectiveStage,
  }
}

/**
 * Map existing guidance competence levels to visibility competence levels
 */
function mapCompetenceLevel(level: string): CompetenceLevel {
  const normalized = level.toLowerCase()
  if (normalized.includes("pro") || normalized.includes("expert")) return "pro"
  if (normalized.includes("average") || normalized.includes("intermediate")) return "average"
  return "beginner"
}

// ============================================================================
// Server-side Visibility Check
// ============================================================================

/**
 * Get visibility functions for server-side use
 */
export async function getServerVisibility(
  userId: string,
  companyId: string
): Promise<ServerVisibilityResult> {
  const data = await getVisibilityData(userId, companyId)

  return {
    isVisible: (id: ElementId) => {
      if (isHiddenByBusinessType(id, data.legalForm)) return false
      if (isHiddenByCompetence(id, data.competence)) return false
      return true
    },
    isLocked: (id: ElementId) => {
      return isLockedByProgression(id, data.effectiveStage)
    },
    getUnlockHint: (id: ElementId) => {
      return getUnlockHintForElement(id, data.effectiveStage)
    },
    data,
  }
}

// ============================================================================
// Props Generation for VisibilityProvider
// ============================================================================

/**
 * Generate props for VisibilityProvider from server data
 */
export async function getVisibilityProviderProps(
  userId: string,
  companyId: string
): Promise<{
  legalForm: LegalForm
  competence: CompetenceLevel
  counts: ServerVisibilityData["counts"]
  hasCompletedOnboarding: boolean
}> {
  const data = await getVisibilityData(userId, companyId)

  return {
    legalForm: data.legalForm,
    competence: data.competence,
    counts: data.counts,
    hasCompletedOnboarding: data.hasCompletedOnboarding,
  }
}

// ============================================================================
// Route Protection Helper
// ============================================================================

export interface RouteProtectionResult {
  allowed: boolean
  reason?: "hidden" | "locked"
  hint?: string
  redirectTo?: string
}

/**
 * Check if a page route is accessible
 */
export async function checkRouteAccess(
  userId: string,
  companyId: string,
  elementId: ElementId
): Promise<RouteProtectionResult> {
  const visibility = await getServerVisibility(userId, companyId)

  if (!visibility.isVisible(elementId)) {
    return {
      allowed: false,
      reason: "hidden",
      redirectTo: "/?blocked=feature-unavailable",
    }
  }

  if (visibility.isLocked(elementId)) {
    const hint = visibility.getUnlockHint(elementId)
    return {
      allowed: false,
      reason: "locked",
      hint: hint || undefined,
      redirectTo: `/?locked=${encodeURIComponent(hint || "")}`,
    }
  }

  return { allowed: true }
}
