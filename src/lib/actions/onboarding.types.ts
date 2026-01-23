import type { LegalForm } from "@/lib/capabilities"
import type { CompetenceLevel } from "@/lib/visibility/rules"

// Onboarding data schema matching what the wizard collects
export interface OnboardingData {
  // Step 1: Basic Info
  name: string | null
  oib: string | null
  legalForm: LegalForm | null

  // Step 2: Competence Level (stored in featureFlags)
  competence: CompetenceLevel | null

  // Step 3: Address
  address: string | null
  postalCode: string | null
  city: string | null
  country: string

  // Step 4: Contact & Tax
  email: string | null
  phone: string | null
  iban: string | null
  isVatPayer: boolean

  // Step 5: Pausalni Profile (only for OBRT_PAUSAL, stored in featureFlags)
  acceptsCash?: boolean
  hasEmployees?: boolean
  employedElsewhere?: boolean
  hasEuVatId?: boolean
  taxBracket?: number
  prirezRate?: number
}
