// src/stores/visitor-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Persona = "pocinjem" | "imam-firmu" | "dodatni-prihod"

export type BusinessType =
  | "obrt"
  | "doo"
  | "pausal"
  | "slobodno-zanimanje"
  | "udruga"
  | "jdoo"
  | null

export type Stage =
  | "landing"
  | "wizard"
  | "recommendation"
  | "registration"
  | "onboarding"
  | "dashboard"

export interface WizardAnswers {
  hasEmployees?: boolean
  expectedRevenue?: string
  needsVat?: boolean
  isHighRisk?: boolean
  needsPartners?: boolean
  [key: string]: any
}

interface VisitorState {
  // State
  persona: Persona | null
  businessType: BusinessType
  stage: Stage
  wizardAnswers: WizardAnswers
  recommendedType: BusinessType

  // Actions
  setPersona: (persona: Persona) => void
  setBusinessType: (type: BusinessType) => void
  setStage: (stage: Stage) => void
  saveWizardAnswers: (answers: Partial<WizardAnswers>) => void
  setRecommendedType: (type: BusinessType) => void
  reset: () => void
}

const initialState = {
  persona: null,
  businessType: null,
  stage: "landing" as Stage,
  wizardAnswers: {},
  recommendedType: null,
}

export const useVisitorStore = create<VisitorState>()(
  persist(
    (set) => ({
      ...initialState,

      setPersona: (persona) => set({ persona }),

      setBusinessType: (type) => set({ businessType: type }),

      setStage: (stage) => set({ stage }),

      saveWizardAnswers: (answers) =>
        set((state) => ({
          wizardAnswers: { ...state.wizardAnswers, ...answers },
        })),

      setRecommendedType: (type) => set({ recommendedType: type }),

      reset: () => set(initialState),
    }),
    {
      name: "fiskai-visitor",
    }
  )
)
