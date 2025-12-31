// src/lib/knowledge-hub/wizard-to-onboarding.ts
import type { LegalForm } from "@/lib/capabilities"
import type { CompetenceLevel } from "@/lib/visibility/rules"
import type { WizardAnswers } from "@/stores/visitor-store"

/**
 * Maps wizard answers to onboarding data (legal form and competence level)
 * This creates the bridge between marketing wizard and app onboarding
 */
export interface WizardToOnboardingData {
  legalForm?: LegalForm
  competence?: CompetenceLevel
  employedElsewhere?: boolean
}

/**
 * Convert wizard answers to onboarding pre-fill data
 */
export function mapWizardToOnboarding(wizardAnswers: WizardAnswers): WizardToOnboardingData {
  const employment = wizardAnswers.employment
  const intent = wizardAnswers.intent
  const revenue = wizardAnswers.revenue
  const activity = wizardAnswers.activity

  const result: WizardToOnboardingData = {}

  // Determine legal form based on wizard path
  if (employment === "retired" || employment === "student") {
    // Retirees and students -> recommend pausalni obrt
    result.legalForm = "OBRT_PAUSAL"
    result.competence = "beginner"
  } else if (intent === "side") {
    // Additional income alongside employment -> pausalni obrt
    result.legalForm = "OBRT_PAUSAL"
    result.competence = "beginner"
    result.employedElsewhere = true
  } else if (intent === "partners") {
    // Multiple partners -> d.o.o.
    result.legalForm = "DOO"
    result.competence = "beginner"
  } else if (revenue === "high") {
    // High revenue (over 60k EUR) -> can't use pausal, suggest real income or d.o.o.
    // Default to real income obrt for solo entrepreneurs
    result.legalForm = "OBRT_REAL"
    result.competence = "average"
  } else if (revenue === "low" || revenue === "medium") {
    // Low/medium revenue with main income intent -> pausalni obrt is ideal
    result.legalForm = "OBRT_PAUSAL"

    // Determine competence based on activity type
    if (activity === "it" || activity === "kreativa") {
      result.competence = "average" // IT/creative professionals tend to be more tech-savvy
    } else {
      result.competence = "beginner"
    }
  }

  // Handle employed status
  if (employment === "employed") {
    result.employedElsewhere = true
  }

  return result
}

/**
 * Check if wizard data exists and is complete enough to pre-fill onboarding
 */
export function hasValidWizardData(wizardAnswers: WizardAnswers): boolean {
  return !!(wizardAnswers.employment && wizardAnswers.intent)
}
