"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import type { LegalForm } from "@/lib/capabilities"
import type { CompetenceLevel } from "@/lib/visibility/rules"
import { DEFAULT_ENTITLEMENTS, getEntitlementsForLegalForm } from "@/lib/modules/definitions"

// Onboarding data schema matching what the wizard collects
export interface OnboardingData {
  // Step 1: Basic Info
  name: string
  oib: string
  legalForm: LegalForm | null

  // Step 2: Competence Level (stored in featureFlags)
  competence: CompetenceLevel | null

  // Step 3: Address
  address: string
  postalCode: string
  city: string
  country: string

  // Step 4: Contact & Tax
  email: string | null
  phone: string | null
  iban: string | null
  isVatPayer: boolean

  // Step 5: Paušalni Profile (only for OBRT_PAUSAL, stored in featureFlags)
  acceptsCash?: boolean
  hasEmployees?: boolean
  employedElsewhere?: boolean
  hasEuVatId?: boolean
  taxBracket?: string
}

/**
 * Get current company data formatted for onboarding wizard
 * Returns null if user has no company yet
 */
export async function getOnboardingData(): Promise<OnboardingData | null> {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
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
    // Paušalni profile fields from featureFlags
    acceptsCash: featureFlags?.acceptsCash as boolean | undefined,
    hasEmployees: featureFlags?.hasEmployees as boolean | undefined,
    employedElsewhere: featureFlags?.employedElsewhere as boolean | undefined,
    hasEuVatId: featureFlags?.hasEuVatId as boolean | undefined,
    taxBracket: featureFlags?.taxBracket as string | undefined,
  }
}

const saveOnboardingSchema = z.object({
  name: z.string().min(1),
  oib: z.string().regex(/^\d{11}$/),
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"]),
  competence: z.enum(["beginner", "average", "pro"]).optional(),
  address: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  iban: z.string().min(1),
  isVatPayer: z.boolean(),
})

const minimalCompanySchema = z.object({
  name: z.string().min(1),
  oib: z.string().regex(/^\d{11}$/),
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
      await db.company.update({
        where: { id: existingCompany.id },
        data: {
          name: data.name,
          oib: data.oib,
          legalForm: data.legalForm,
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

      if (userMembership || isOrphaned) {
        // Update existing company
        await db.company.update({
          where: { id: oibExists.id },
          data: {
            name: data.name,
            legalForm: data.legalForm,
          },
        })

        // Link user if not already linked
        if (!userMembership) {
          await db.companyUser.create({
            data: {
              userId: user.id!,
              companyId: oibExists.id,
              role: "OWNER",
              isDefault: true,
            },
          })
        }

        revalidatePath("/dashboard")
        revalidatePath("/onboarding")
        return { success: true, companyId: oibExists.id }
      } else {
        return {
          error: "Tvrtka s ovim OIB-om je već registrirana. Ako ste zaposlenik, zamolite administratora za pozivnicu.",
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
  } catch (error: any) {
    console.error("[Onboarding] createMinimalCompany failed:", error)
    return { error: "Došlo je do greške pri kreiranju tvrtke. Molimo pokušajte ponovno." }
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

  // Get existing featureFlags and merge competence
  const existingFlags = (company.featureFlags as Record<string, unknown>) || {}
  const featureFlags = {
    ...existingFlags,
    competence: data.competence,
  }

  await db.company.update({
    where: { id: company.id },
    data: {
      name: data.name,
      oib: data.oib,
      legalForm: data.legalForm,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      email: data.email,
      phone: data.phone || null,
      iban: data.iban,
      isVatPayer: data.isVatPayer,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
      featureFlags,
    },
  })

  revalidatePath("/dashboard")
  revalidatePath("/onboarding")
  return { success: true }
}
