// src/stores/compliance-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ComplianceStep =
  | "oib-registration"
  | "bank-account"
  | "fina-certificate"
  | "vat-registration"
  | "employee-registration"
  | "fiscal-device"
  | "first-invoice"
  | string

export interface ComplianceChecklist {
  id: string
  title: string
  steps: ComplianceStep[]
  businessType?: string
}

export interface AcknowledgedDeadline {
  id: string
  deadlineDate: string
  acknowledgedAt: string
}

interface ComplianceState {
  // State
  completedSteps: ComplianceStep[]
  currentChecklist: ComplianceChecklist | null
  acknowledgedDeadlines: AcknowledgedDeadline[]
  lastDeadlineCheck: string | null
  complianceScore: number

  // Actions
  markStepComplete: (step: ComplianceStep) => void
  unmarkStep: (step: ComplianceStep) => void
  setChecklist: (checklist: ComplianceChecklist | null) => void
  acknowledgeDeadline: (deadlineId: string, deadlineDate: string) => void
  updateLastCheck: () => void
  calculateScore: () => void
  reset: () => void
}

const initialState = {
  completedSteps: [],
  currentChecklist: null,
  acknowledgedDeadlines: [],
  lastDeadlineCheck: null,
  complianceScore: 0,
}

export const useComplianceStore = create<ComplianceState>()(
  persist(
    (set, get) => ({
      ...initialState,

      markStepComplete: (step) =>
        set((state) => {
          if (state.completedSteps.includes(step)) {
            return state
          }
          return {
            completedSteps: [...state.completedSteps, step],
          }
        }),

      unmarkStep: (step) =>
        set((state) => ({
          completedSteps: state.completedSteps.filter((s) => s !== step),
        })),

      setChecklist: (checklist) => set({ currentChecklist: checklist }),

      acknowledgeDeadline: (deadlineId, deadlineDate) =>
        set((state) => {
          const existing = state.acknowledgedDeadlines.find((d) => d.id === deadlineId)
          if (existing) {
            return state
          }
          return {
            acknowledgedDeadlines: [
              ...state.acknowledgedDeadlines,
              {
                id: deadlineId,
                deadlineDate,
                acknowledgedAt: new Date().toISOString(),
              },
            ],
          }
        }),

      updateLastCheck: () => set({ lastDeadlineCheck: new Date().toISOString() }),

      calculateScore: () =>
        set((state) => {
          const checklist = state.currentChecklist
          if (!checklist || !checklist.steps.length) {
            return { complianceScore: 0 }
          }
          const completed = state.completedSteps.filter((step) =>
            checklist.steps.includes(step)
          ).length
          const total = checklist.steps.length
          const score = Math.round((completed / total) * 100)
          return { complianceScore: score }
        }),

      reset: () => set(initialState),
    }),
    {
      name: "fiskai-compliance",
    }
  )
)

// Helper function to get traffic light color based on compliance score
export function getTrafficLightColor(score: number): "red" | "yellow" | "green" {
  if (score >= 80) return "green"
  if (score >= 50) return "yellow"
  return "red"
}
