"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import type { LegalForm } from "@/lib/capabilities"
import type { CompetenceLevel } from "@/lib/visibility/rules"
import { getEntitlementsForLegalForm } from "@/lib/modules/definitions"
import { oibSchema } from "@/lib/validations/oib"

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

/**
 * Get current company data formatted for onboarding wizard
 * Returns null if user has no company yet
 */
export async function getOnboardingData(): Promise<OnboardingData | null> {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    // If user selected business type during registration, pre-fill it
    const fullUser = await db.user.findUnique({
      where: { id: user.id! },
      select: { intendedBusinessType: true },
    })

    if (fullUser?.intendedBusinessType) {
      return {
        name: null,
        oib: null,
        legalForm: fullUser.intendedBusinessType as LegalForm,
        competence: null,
        address: null,
        postalCode: null,
        city: null,
        country: "HR",
        email: null,
        phone: null,
        iban: null,
        isVatPayer: false,
      }
    }

    return null
  }

  // Extract competence from featureFlags if it exists
  const featureFlags = company.featureFlags as Record<string, unknown> | null
  const competence = (featureFlags?.competence as CompetenceLevel) || null

  return {
    name: company.name,
    oib: company.oib,
    legalForm: (company.legalForm as LegalForm) || null,
    competence,
    address: company.address,
    postalCode: company.postalCode,
    city: company.city,
    country: company.country,
    email: company.email,
    phone: company.phone,
    iban: company.iban,
    isVatPayer: company.isVatPayer,
    // Pausalni profile fields from featureFlags
    acceptsCash: featureFlags?.acceptsCash as boolean | undefined,
    hasEmployees: featureFlags?.hasEmployees as boolean | undefined,
    employedElsewhere: featureFlags?.employedElsewhere as boolean | undefined,
    hasEuVatId: featureFlags?.hasEuVatId as boolean | undefined,
    taxBracket: featureFlags?.taxBracket as number | undefined,
    prirezRate: featureFlags?.prirezRate as number | undefined,
  }
}

const saveOnboardingSchema = z.object({
  name: z.string().min(1),
  oib: oibSchema,
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"]),
  competence: z.enum(["beginner", "average", "pro"]).optional(),
  address: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  iban: z.string().optional(),
  isVatPayer: z.boolean(),
  // Pausalni profile fields (step 5)
  acceptsCash: z.boolean().optional(),
  hasEmployees: z.boolean().optional(),
  employedElsewhere: z.boolean().optional(),
  hasEuVatId: z.boolean().optional(),
  taxBracket: z.number().optional(),
  prirezRate: z.number().optional(),
})

const minimalCompanySchema = z.object({
  name: z.string().min(1),
  oib: oibSchema,
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"]),
})

/**
 * Create a minimal company record early in onboarding (step 1)
 * This prevents redirect loops by ensuring a company exists before full onboarding
 */
export async function createMinimalCompany(formData: z.input<typeof minimalCompanySchema>) {
  const user = await requireAuth()

  const validated = minimalCompanySchema.safeParse(formData)
  if (!validated.success) {
    return { error: "Invalid fields", details: validated.error.flatten() }
  }

  const data = validated.data

  try {
    // Check if company already exists
    const existingCompany = await getCurrentCompany(user.id!)

    if (existingCompany) {
      // Update existing company with basic info
      // Re-calculate entitlements when legal form changes
      await db.company.update({
        where: { id: existingCompany.id },
        data: {
          name: data.name,
          oib: data.oib,
          legalForm: data.legalForm,
          entitlements: getEntitlementsForLegalForm(data.legalForm),
        },
      })

      revalidatePath("/dashboard")
      revalidatePath("/onboarding")
      return { success: true, companyId: existingCompany.id }
    }

    // Check if OIB already exists in another company
    const oibExists = await db.company.findUnique({
      where: { oib: data.oib },
      include: { users: true },
    })

    if (oibExists) {
      const userMembership = oibExists.users.find((u) => u.userId === user.id)
      const isOrphaned = oibExists.users.length === 0

      if (userMembership) {
        // User already has access, update company details
        await db.company.update({
          where: { id: oibExists.id },
          data: {
            name: data.name,
            legalForm: data.legalForm,
            entitlements: getEntitlementsForLegalForm(data.legalForm),
          },
        })

        revalidatePath("/dashboard")
        revalidatePath("/onboarding")
        return { success: true, companyId: oibExists.id }
      } else if (isOrphaned) {
        // SECURITY: Orphaned company - require admin intervention
        return {
          error:
            "Ova tvrtka već postoji u sustavu ali nema aktivnih korisnika. Molimo kontaktirajte podršku.",
        }
      } else {
        return {
          error:
            "Tvrtka s ovim OIB-om je već registrirana. Ako ste zaposlenik, zamolite administratora za pozivnicu.",
        }
      }
    }

    // Create minimal company with placeholder values
    const newCompany = await db.company.create({
      data: {
        name: data.name,
        oib: data.oib,
        legalForm: data.legalForm,
        address: "", // Placeholder - will be filled in step 3
        postalCode: "", // Placeholder
        city: "", // Placeholder
        country: "HR",
        email: null,
        iban: null,
        isVatPayer: false,
        entitlements: getEntitlementsForLegalForm(data.legalForm),
        users: {
          create: {
            userId: user.id!,
            role: "OWNER",
            isDefault: true,
          },
        },
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/onboarding")
    return { success: true, companyId: newCompany.id }
  } catch (error: unknown) {
    console.error("[Onboarding] createMinimalCompany failed:", error)
    return { error: "Doslo je do greske pri kreiranju tvrtke. Molimo pokusajte ponovno." }
  }
}

/**
 * Save onboarding data (final step)
 * Updates the company with all collected data
 */
export async function saveOnboardingData(formData: z.input<typeof saveOnboardingSchema>) {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    return { error: "No company found" }
  }

  const validated = saveOnboardingSchema.safeParse(formData)
  if (!validated.success) {
    return { error: "Invalid fields", details: validated.error.flatten() }
  }

  const data = validated.data

  // Get existing featureFlags and merge competence + pausalni profile data
  const existingFlags = (company.featureFlags as Record<string, unknown>) || {}
  const featureFlags = {
    ...existingFlags,
    competence: data.competence,
    // Pausalni profile fields
    acceptsCash: data.acceptsCash,
    hasEmployees: data.hasEmployees,
    employedElsewhere: data.employedElsewhere,
    hasEuVatId: data.hasEuVatId,
    taxBracket: data.taxBracket,
    prirezRate: data.prirezRate,
  }

  await db.company.update({
    where: { id: company.id },
    data: {
      name: data.name,
      oib: data.oib,
      legalForm: data.legalForm,
      entitlements: getEntitlementsForLegalForm(data.legalForm),
      address: data.address || company.address,
      postalCode: data.postalCode || company.postalCode,
      city: data.city || company.city,
      country: data.country || company.country,
      email: data.email,
      phone: data.phone || null,
      iban: data.iban || null,
      isVatPayer: data.isVatPayer,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
      featureFlags,
    },
  })

  revalidatePath("/dashboard")
  revalidatePath("/onboarding")
  return { success: true }
}
