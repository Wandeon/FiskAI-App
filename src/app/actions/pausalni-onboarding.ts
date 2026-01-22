"use server"

import { z } from "zod"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { getEntitlementsForLegalForm } from "@/lib/modules/definitions"
import { oibSchema } from "@/lib/validations/oib"

// =============================================================================
// ONBOARDING DRAFT TYPES
// =============================================================================

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

// =============================================================================
// STEP 1: IDENTITY
// =============================================================================

const step1Schema = z.object({
  name: z.string().min(1, "Ime je obavezno"),
  oib: oibSchema,
  address: z.string().min(1, "Adresa je obavezna"),
  city: z.string().min(1, "Grad je obavezan"),
  postalCode: z.string().min(1, "Poštanski broj je obavezan"),
  foundingDate: z.string().optional(), // ISO date string
})

export type Step1Data = z.infer<typeof step1Schema>

/**
 * Save Step 1 data: Identity (OIB, name, address)
 * Stores data in User.onboardingDraft - does NOT create Company
 */
export async function savePausalniStep1(data: Step1Data) {
  const user = await requireAuth()

  const validated = step1Schema.safeParse(data)
  if (!validated.success) {
    return { error: "Neispravni podaci", details: validated.error.flatten() }
  }

  const formData = validated.data

  try {
    // Check if user already has a company (completed onboarding previously)
    const existingCompany = await getCurrentCompany(user.id!)
    if (existingCompany) {
      // User already has a company - update it instead (backwards compatibility)
      await db.company.update({
        where: { id: existingCompany.id },
        data: {
          name: formData.name,
          oib: formData.oib,
          address: formData.address,
          city: formData.city,
          postalCode: formData.postalCode,
          country: "HR",
          legalForm: "OBRT_PAUSAL",
          entitlements: getEntitlementsForLegalForm("OBRT_PAUSAL"),
          featureFlags: {
            ...(existingCompany.featureFlags as Record<string, unknown>),
            foundingDate: formData.foundingDate,
          },
        },
      })

      revalidatePath("/pausalni/onboarding")
      return { success: true, companyId: existingCompany.id }
    }

    // Check if OIB already exists in another company
    const oibExists = await db.company.findUnique({
      where: { oib: formData.oib },
      include: { users: true },
    })

    if (oibExists) {
      const userMembership = oibExists.users.find((u) => u.userId === user.id)
      if (userMembership) {
        // User already has access to this company - redirect them
        return { error: "Već imate pristup ovoj tvrtki.", redirectTo: "/cc" }
      }
      return {
        error:
          "Tvrtka s ovim OIB-om je već registrirana. Ako ste zaposlenik, zamolite administratora za pozivnicu.",
      }
    }

    // Get current draft and merge with new data
    const fullUser = await db.user.findUnique({
      where: { id: user.id! },
      select: { onboardingDraft: true },
    })

    const existingDraft = (fullUser?.onboardingDraft as OnboardingDraft) || {}
    const newDraft: OnboardingDraft = {
      ...existingDraft,
      name: formData.name,
      oib: formData.oib,
      address: formData.address,
      city: formData.city,
      postalCode: formData.postalCode,
      foundingDate: formData.foundingDate,
      lastStepCompleted: 1,
    }

    // Save draft to User (NOT creating Company yet)
    await db.user.update({
      where: { id: user.id! },
      data: { onboardingDraft: newDraft },
    })

    revalidatePath("/pausalni/onboarding")
    return { success: true }
  } catch (error) {
    console.error("[Pausalni Onboarding] Step 1 failed:", error)
    return { error: "Došlo je do greške. Molimo pokušajte ponovno." }
  }
}

// =============================================================================
// STEP 2: SITUATION
// =============================================================================

const step2Schema = z.object({
  employedElsewhere: z.boolean(),
  acceptsCash: z.boolean(),
  isVatPayer: z.boolean(),
  expectedIncomeRange: z.enum(["under30", "30to60", "60to100", "over100"]),
})

export type Step2Data = z.infer<typeof step2Schema>

/**
 * Save Step 2 data: Situation (employment, cash, VAT, income range)
 * Stores data in User.onboardingDraft - does NOT create Company
 */
export async function savePausalniStep2(data: Step2Data) {
  const user = await requireAuth()

  const validated = step2Schema.safeParse(data)
  if (!validated.success) {
    return { error: "Neispravni podaci", details: validated.error.flatten() }
  }

  const formData = validated.data

  try {
    // Check if user already has a company (backwards compatibility)
    const existingCompany = await getCurrentCompany(user.id!)
    if (existingCompany) {
      // User already has a company - update it instead
      const existingFlags = (existingCompany.featureFlags as Record<string, unknown>) || {}

      await db.company.update({
        where: { id: existingCompany.id },
        data: {
          isVatPayer: formData.isVatPayer,
          vatNumber: formData.isVatPayer ? `HR${existingCompany.oib}` : null,
          featureFlags: {
            ...existingFlags,
            employedElsewhere: formData.employedElsewhere,
            acceptsCash: formData.acceptsCash,
            expectedIncomeRange: formData.expectedIncomeRange,
          },
        },
      })

      revalidatePath("/pausalni/onboarding")
      return { success: true }
    }

    // Get current draft
    const fullUser = await db.user.findUnique({
      where: { id: user.id! },
      select: { onboardingDraft: true },
    })

    const existingDraft = (fullUser?.onboardingDraft as OnboardingDraft) || {}

    // Check if Step 1 was completed
    if (!existingDraft.oib || !existingDraft.name) {
      return { error: "Molimo najprije popunite prvi korak" }
    }

    const newDraft: OnboardingDraft = {
      ...existingDraft,
      employedElsewhere: formData.employedElsewhere,
      acceptsCash: formData.acceptsCash,
      isVatPayer: formData.isVatPayer,
      expectedIncomeRange: formData.expectedIncomeRange,
      lastStepCompleted: 2,
    }

    // Save draft to User (still NOT creating Company)
    await db.user.update({
      where: { id: user.id! },
      data: { onboardingDraft: newDraft },
    })

    revalidatePath("/pausalni/onboarding")
    return { success: true }
  } catch (error) {
    console.error("[Pausalni Onboarding] Step 2 failed:", error)
    return { error: "Došlo je do greške. Molimo pokušajte ponovno." }
  }
}

// =============================================================================
// STEP 3: SETUP (Final) - CREATES COMPANY
// =============================================================================

const step3Schema = z.object({
  iban: z.string().optional(),
  hasFiscalizationCert: z.boolean().optional(),
  email: z.string().email("Neispravan email"),
})

export type Step3Data = z.infer<typeof step3Schema>

/**
 * Finalize onboarding: Create Company + CompanyUser + entitlements in single transaction
 *
 * This is the ONLY place where Company is created for new pausalni users.
 * All conditions must be met:
 * 1. intent = OBRT
 * 2. taxRegime = Pausalni (OBRT_PAUSAL)
 * 3. User confirmed core fields (OIB, name, address)
 * 4. User completed Situacija + Setup steps
 */
export async function finalizeOnboarding(data: Step3Data) {
  const user = await requireAuth()

  const validated = step3Schema.safeParse(data)
  if (!validated.success) {
    return { error: "Neispravni podaci", details: validated.error.flatten() }
  }

  const formData = validated.data

  try {
    // IDEMPOTENCY CHECK: If user already has a CompanyUser, redirect to /cc
    const existingMembership = await db.companyUser.findFirst({
      where: { userId: user.id! },
      include: { company: true },
    })

    if (existingMembership) {
      // User already has a company - either update it (backwards compat) or redirect
      const company = existingMembership.company
      const existingFlags = (company.featureFlags as Record<string, unknown>) || {}

      await db.company.update({
        where: { id: company.id },
        data: {
          email: formData.email,
          iban: formData.iban || null,
          featureFlags: {
            ...existingFlags,
            hasFiscalizationCert: formData.hasFiscalizationCert,
            onboardingCompletedAt: new Date().toISOString(),
          },
          onboardingStep: 3, // Mark as complete
        },
      })

      // Clear draft since onboarding is complete
      await db.user.update({
        where: { id: user.id! },
        data: { onboardingDraft: Prisma.DbNull },
      })

      revalidatePath("/dashboard")
      revalidatePath("/pausalni/onboarding")
      return { success: true, redirectTo: "/cc" }
    }

    // Get the draft data
    const fullUser = await db.user.findUnique({
      where: { id: user.id! },
      select: { onboardingDraft: true, email: true },
    })

    const draft = fullUser?.onboardingDraft as OnboardingDraft | null

    // Validate all required data is present
    if (!draft?.oib || !draft?.name || !draft?.address || !draft?.city || !draft?.postalCode) {
      return { error: "Molimo najprije popunite prvi korak (podaci o obrtu)" }
    }

    if (draft.employedElsewhere === undefined || draft.acceptsCash === undefined) {
      return { error: "Molimo najprije popunite drugi korak (situacija)" }
    }

    // Check OIB doesn't already exist (final check before creation)
    const oibExists = await db.company.findUnique({
      where: { oib: draft.oib },
    })

    if (oibExists) {
      return {
        error:
          "Tvrtka s ovim OIB-om je već registrirana. Ako ste zaposlenik, zamolite administratora za pozivnicu.",
      }
    }

    // ATOMIC TRANSACTION: Create Company + CompanyUser + entitlements
    const company = await db.$transaction(async (tx) => {
      // 1. Clear any existing default CompanyUser flags for this user (safety)
      await tx.companyUser.updateMany({
        where: { userId: user.id! },
        data: { isDefault: false },
      })

      // 2. Create Company with final legalForm
      const newCompany = await tx.company.create({
        data: {
          name: draft.name!,
          oib: draft.oib!,
          legalForm: "OBRT_PAUSAL",
          address: draft.address!,
          city: draft.city!,
          postalCode: draft.postalCode!,
          country: "HR",
          email: formData.email,
          iban: formData.iban || null,
          isVatPayer: draft.isVatPayer || false,
          vatNumber: draft.isVatPayer ? `HR${draft.oib}` : null,
          entitlements: getEntitlementsForLegalForm("OBRT_PAUSAL"),
          featureFlags: {
            foundingDate: draft.foundingDate,
            employedElsewhere: draft.employedElsewhere,
            acceptsCash: draft.acceptsCash,
            expectedIncomeRange: draft.expectedIncomeRange,
            hasFiscalizationCert: formData.hasFiscalizationCert,
            onboardingCompletedAt: new Date().toISOString(),
          },
          onboardingStep: 3, // Mark as complete
        },
      })

      // 3. Create CompanyUser (OWNER role)
      await tx.companyUser.create({
        data: {
          userId: user.id!,
          companyId: newCompany.id,
          role: "OWNER",
          isDefault: true,
        },
      })

      // 4. Clear the onboarding draft now that Company is created
      await tx.user.update({
        where: { id: user.id! },
        data: { onboardingDraft: Prisma.DbNull },
      })

      return newCompany
    })

    revalidatePath("/dashboard")
    revalidatePath("/pausalni/onboarding")
    revalidatePath("/cc")

    return { success: true, companyId: company.id, redirectTo: "/cc" }
  } catch (error) {
    console.error("[Pausalni Onboarding] finalizeOnboarding failed:", error)
    return { error: "Došlo je do greške pri kreiranju tvrtke. Molimo pokušajte ponovno." }
  }
}

/**
 * Legacy wrapper for backwards compatibility
 * @deprecated Use finalizeOnboarding instead
 */
export async function savePausalniStep3(data: Step3Data & { email: string }) {
  return finalizeOnboarding({
    iban: data.iban,
    hasFiscalizationCert: data.hasFiscalizationCert,
    email: data.email,
  })
}

// =============================================================================
// GET CURRENT DATA
// =============================================================================

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

/**
 * Get current onboarding data for the pausalni wizard
 * Returns data from Company if it exists, otherwise from User.onboardingDraft
 */
export async function getPausalniOnboardingData(): Promise<PausalniOnboardingData | null> {
  const user = await requireAuth()

  // First check if user already has a company
  const company = await getCurrentCompany(user.id!)

  if (company) {
    const featureFlags = (company.featureFlags as Record<string, unknown>) || {}

    return {
      // Step 1
      name: company.name,
      oib: company.oib,
      address: company.address,
      city: company.city,
      postalCode: company.postalCode,
      foundingDate: featureFlags.foundingDate as string | undefined,
      // Step 2
      employedElsewhere: featureFlags.employedElsewhere as boolean | undefined,
      acceptsCash: featureFlags.acceptsCash as boolean | undefined,
      isVatPayer: company.isVatPayer,
      expectedIncomeRange: featureFlags.expectedIncomeRange as string | undefined,
      // Step 3
      email: company.email,
      iban: company.iban,
      hasFiscalizationCert: featureFlags.hasFiscalizationCert as boolean | undefined,
      source: "company",
    }
  }

  // No company yet - check for draft data
  const fullUser = await db.user.findUnique({
    where: { id: user.id! },
    select: { onboardingDraft: true, email: true },
  })

  const draft = fullUser?.onboardingDraft as OnboardingDraft | null

  if (!draft) {
    return null
  }

  return {
    // Step 1
    name: draft.name || null,
    oib: draft.oib || null,
    address: draft.address || null,
    city: draft.city || null,
    postalCode: draft.postalCode || null,
    foundingDate: draft.foundingDate,
    // Step 2
    employedElsewhere: draft.employedElsewhere,
    acceptsCash: draft.acceptsCash,
    isVatPayer: draft.isVatPayer || false,
    expectedIncomeRange: draft.expectedIncomeRange,
    // Step 3
    email: draft.email || fullUser?.email || null,
    iban: draft.iban || null,
    hasFiscalizationCert: draft.hasFiscalizationCert,
    source: "draft",
  }
}

/**
 * Check if user has completed onboarding (has a CompanyUser)
 * Used for idempotency check on final step refresh
 */
export async function checkOnboardingComplete(): Promise<{
  complete: boolean
  redirectTo?: string
}> {
  const user = await requireAuth()

  const membership = await db.companyUser.findFirst({
    where: { userId: user.id! },
    select: { id: true },
  })

  if (membership) {
    return { complete: true, redirectTo: "/cc" }
  }

  return { complete: false }
}
