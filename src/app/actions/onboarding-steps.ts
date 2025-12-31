"use server"

import { db } from "@/lib/db"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

export async function getValidatedOnboardingStep(): Promise<number> {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)
  if (!company) return 1
  return company.onboardingStep || 1
}

async function validateStep(company: any, step: number): Promise<boolean> {
  const featureFlags = company.featureFlags as Record<string, unknown> | null
  switch (step) {
    case 1:
      return !!(company.name?.trim() && company.oib?.match(/^\d{11}$/) && company.legalForm)
    case 2:
      return true
    case 3:
      return true
    case 4:
      return !!company.email?.includes("@")
    case 5:
      if (company.legalForm !== "OBRT_PAUSAL") return true
      return !!(
        typeof featureFlags?.acceptsCash === "boolean" &&
        typeof featureFlags?.hasEmployees === "boolean" &&
        typeof featureFlags?.employedElsewhere === "boolean" &&
        typeof featureFlags?.hasEuVatId === "boolean" &&
        featureFlags?.taxBracket
      )
    case 6:
      return true
    default:
      return false
  }
}

export async function advanceOnboardingStep(
  targetStep: number
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)
  if (!company) return { success: false, error: "No company found" }
  const currentStep = company.onboardingStep || 1
  if (targetStep > currentStep + 1) return { success: false, error: "Cannot skip steps" }
  if (targetStep <= currentStep) return { success: true }
  const isCurrentStepValid = await validateStep(company, currentStep)
  if (!isCurrentStepValid) return { success: false, error: "Current step is not complete" }
  await db.company.update({ where: { id: company.id }, data: { onboardingStep: targetStep } })
  revalidatePath("/onboarding")
  return { success: true }
}
