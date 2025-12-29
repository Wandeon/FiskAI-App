// src/lib/stores/onboarding-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { LegalForm } from "@/lib/capabilities"
import type { CompetenceLevel } from "@/lib/visibility/rules"

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6

export interface OnboardingData {
  // Step 1: Basic Info
  name: string
  oib: string
  legalForm: LegalForm

  // Step 2: Competence Level
  competence: CompetenceLevel

  // Step 3: Address
  address: string
  postalCode: string
  city: string
  country: string

  // Step 4: Contact & Tax
  email: string
  phone: string
  iban: string
  isVatPayer: boolean

  // Step 5: Paušalni Profile (only for OBRT_PAUSAL)
  acceptsCash: boolean
  hasEmployees: boolean
  employedElsewhere: boolean
  hasEuVatId: boolean
  taxBracket: number // 1-7
  municipality: string
  county: string
  prirezRate: number
}

interface OnboardingState {
  currentStep: OnboardingStep
  data: Partial<OnboardingData>
  isHydrated: boolean
  setStep: (step: OnboardingStep) => void
  updateData: (data: Partial<OnboardingData>) => void
  reset: () => void
  isStepValid: (step: OnboardingStep) => boolean
  hydrate: (serverData: Partial<OnboardingData>, startStep?: OnboardingStep) => void
}

const initialData: Partial<OnboardingData> = {
  country: "HR",
  isVatPayer: false,
  acceptsCash: false,
  hasEmployees: false,
  employedElsewhere: false,
  hasEuVatId: false,
  taxBracket: 1,
  prirezRate: 0,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      data: initialData,
      isHydrated: false,

      setStep: (step) => set({ currentStep: step }),

      updateData: (newData) =>
        set((state) => ({
          data: { ...state.data, ...newData },
        })),

      reset: () =>
        set({
          currentStep: 1,
          data: initialData,
          isHydrated: false,
        }),

      isStepValid: (step) => {
        const { data } = get()
        switch (step) {
          case 1:
            return !!(data.name?.trim() && data.oib?.match(/^\d{11}$/) && data.legalForm)
          case 2:
            return !!data.competence
          case 3:
            return !!(
              data.address?.trim() &&
              data.postalCode?.trim() &&
              data.city?.trim() &&
              data.country?.trim()
            )
          case 4:
            return !!(data.email?.includes("@") && data.iban?.trim())
          case 5:
            // Only validate Step 5 for OBRT_PAUSAL legal form
            if (data.legalForm !== "OBRT_PAUSAL") {
              return true // Skip validation for other legal forms
            }
            return !!(
              typeof data.acceptsCash === "boolean" &&
              typeof data.hasEmployees === "boolean" &&
              typeof data.employedElsewhere === "boolean" &&
              typeof data.hasEuVatId === "boolean" &&
              data.taxBracket &&
              data.taxBracket >= 1 &&
              data.taxBracket <= 7 &&
              data.municipality?.trim() &&
              data.county?.trim() &&
              typeof data.prirezRate === "number"
            )
          case 6:
            // Step 6 (Billing) is always valid - it's informational only
            return true
          default:
            return false
        }
      },

      hydrate: (serverData, startStep) => {
        const { isHydrated } = get()
        // Only hydrate once per page load
        if (isHydrated) return

        // Merge server data with defaults (server data takes precedence)
        const mergedData = {
          ...initialData,
          ...serverData,
        }

        set({
          data: mergedData,
          currentStep: startStep || 1,
          isHydrated: true,
        })
      },
    }),
    {
      name: "fiskai-onboarding",
      partialize: (state) => ({
        // Don't persist isHydrated - we want to re-hydrate on each page load
        currentStep: state.currentStep,
        data: state.data,
      }),
    }
  )
)
