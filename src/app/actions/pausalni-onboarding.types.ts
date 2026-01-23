import type { z } from "zod"

/**
 * Shape of the onboardingDraft JSON stored on User
 * This holds all onboarding data until the final Company creation
 */
export interface OnboardingDraft {
  // Step 1: Identity
  name?: string
  oib?: string
  address?: string
  city?: string
  postalCode?: string
  foundingDate?: string
  // Step 2: Situation
  employedElsewhere?: boolean
  acceptsCash?: boolean
  isVatPayer?: boolean
  expectedIncomeRange?: "under30" | "30to60" | "60to100" | "over100"
  // Step 3: Setup
  email?: string
  iban?: string
  hasFiscalizationCert?: boolean
  // Metadata
  lastStepCompleted?: 0 | 1 | 2 | 3
}

// Step data types - these match the zod schemas in the main file
export interface Step1Data {
  name: string
  oib: string
  address: string
  city: string
  postalCode: string
  foundingDate?: string
}

export interface Step2Data {
  employedElsewhere: boolean
  acceptsCash: boolean
  isVatPayer: boolean
  expectedIncomeRange: "under30" | "30to60" | "60to100" | "over100"
}

export interface Step3Data {
  iban?: string
  hasFiscalizationCert?: boolean
  email: string
}

export interface PausalniOnboardingData {
  // Step 1
  name: string | null
  oib: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  foundingDate?: string
  // Step 2
  employedElsewhere?: boolean
  acceptsCash?: boolean
  isVatPayer: boolean
  expectedIncomeRange?: string
  // Step 3
  email: string | null
  iban: string | null
  hasFiscalizationCert?: boolean
  // Source indicator
  source: "company" | "draft"
}
