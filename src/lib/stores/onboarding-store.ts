// src/lib/stores/onboarding-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { LegalForm } from "@/lib/capabilities"

export type OnboardingStep = 1 | 2 | 3

export interface OnboardingData {
  // Step 1: Basic Info
  name: string
  oib: string
  legalForm: LegalForm

  // Step 2: Address
  address: string
  postalCode: string
  city: string
  country: string

  // Step 3: Contact & Tax
  email: string
  phone: string
  iban: string
  isVatPayer: boolean
}

interface OnboardingState {
  currentStep: OnboardingStep
  data: Partial<OnboardingData>
  setStep: (step: OnboardingStep) => void
  updateData: (data: Partial<OnboardingData>) => void
  reset: () => void
  isStepValid: (step: OnboardingStep) => boolean
}

const initialData: Partial<OnboardingData> = {
  country: "HR",
  isVatPayer: false,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      data: initialData,

      setStep: (step) => set({ currentStep: step }),

      updateData: (newData) =>
        set((state) => ({
          data: { ...state.data, ...newData },
        })),

      reset: () =>
        set({
          currentStep: 1,
          data: initialData,
        }),

      isStepValid: (step) => {
        const { data } = get()
        switch (step) {
          case 1:
            return !!(data.name?.trim() && data.oib?.match(/^\d{11}$/) && data.legalForm)
          case 2:
            return !!(
              data.address?.trim() &&
              data.postalCode?.trim() &&
              data.city?.trim() &&
              data.country?.trim()
            )
          case 3:
            return !!(data.email?.includes("@") && data.iban?.trim())
          default:
            return false
        }
      },
    }),
    {
      name: "fiskai-onboarding",
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
      }),
    }
  )
)
