"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { pausalniProfile } from "@/lib/db/schema/pausalni"
import { requireAuth } from "@/lib/auth-utils"
import { companySchema, companySettingsSchema, planSettingsSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { encryptSecret } from "@/lib/secrets"

import { DEFAULT_ENTITLEMENTS, getEntitlementsForLegalForm } from "@/lib/modules/definitions"

export async function createCompany(formData: z.input<typeof companySchema>) {
  const user = await requireAuth()

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Neispravni podaci", details: validatedFields.error.flatten() }
  }

  const data = validatedFields.data

  try {
    // Check if OIB already exists
    const existingCompany = await db.company.findUnique({
      where: { oib: data.oib },
      include: { users: true },
    })

    let companyId: string

    if (existingCompany) {
      // SECURITY: Check if user already has access or if company is orphaned
      const userMembership = existingCompany.users.find((u) => u.userId === user.id)
      const isOrphaned = existingCompany.users.length === 0

      if (userMembership) {
        // User already has access, update company details
        // Merge competence into existing featureFlags
        const existingFlags = (existingCompany.featureFlags as Record<string, unknown>) || {}
        const newFeatureFlags = data.competence
          ? { ...existingFlags, competence: data.competence }
          : existingFlags

        // Determine entitlements based on legal form
        const legalForm = data.legalForm || existingCompany.legalForm || "DOO"
        const entitlements =
          existingCompany.entitlements && Array.isArray(existingCompany.entitlements) && existingCompany.entitlements.length > 0
            ? existingCompany.entitlements
            : getEntitlementsForLegalForm(legalForm)

        const updated = await db.company.update({
          where: { id: existingCompany.id },
          data: {
            ...data,
            vatNumber: data.isVatPayer ? `HR${data.oib}` : existingCompany.vatNumber,
            legalForm,
            featureFlags: Object.keys(newFeatureFlags).length > 0 ? newFeatureFlags : undefined,
            entitlements,
          },
        })

        companyId = updated.id
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
    } else {
      // Create new company and link to user as owner
      const legalForm = data.legalForm || "DOO"
      const newCompany = await db.company.create({
        data: {
          ...data,
          vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
          legalForm,
          featureFlags: data.competence ? { competence: data.competence } : undefined,
          entitlements: getEntitlementsForLegalForm(legalForm),
          users: {
            create: {
              userId: user.id!,
              role: "OWNER",
              isDefault: true,
            },
          },
        },
      })
      companyId = newCompany.id
    }

    // Ensure paušalni profile exists if applicable
    if (data.legalForm === "OBRT_PAUSAL") {
      try {
        // We use a raw query or check with drizzle to see if profile exists to avoid duplicates
        const existingProfile = await drizzleDb.query.pausalniProfile.findFirst({
          where: (fields, { eq }) => eq(fields.companyId, companyId),
        })

        if (!existingProfile) {
          await drizzleDb.insert(pausalniProfile).values({
            companyId: companyId,
            hasPdvId: false,
            euActive: false,
            tourismActivity: false,
          })
        }
      } catch (drizzleError) {
        console.error("[Onboarding] Profile sync failed:", drizzleError)
      }
    }

    revalidatePath("/dashboard")
    return { success: true, companyId }
  } catch (error: unknown) {
    console.error("[Onboarding] createCompany failed:", error)
    return { error: "Došlo je do greške pri kreiranju tvrtke. Molimo pokušajte ponovno." }
  }
}

export async function updateCompany(companyId: string, formData: z.input<typeof companySchema>) {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const data = validatedFields.data

  await db.company.update({
    where: { id: companyId },
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
    },
  })

  revalidatePath("/dashboard")
  return { success: "Company updated" }
}

export async function updateCompanySettings(
  companyId: string,
  formData: z.infer<typeof companySettingsSchema>
) {
  const user = await requireAuth()

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  const validatedFields = companySettingsSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const data = validatedFields.data

  await db.company.update({
    where: { id: companyId },
    data: {
      eInvoiceProvider: data.eInvoiceProvider,
      eInvoiceApiKeyEncrypted: data.eInvoiceApiKey ? encryptSecret(data.eInvoiceApiKey) : undefined, // Keep existing if not provided, null clears it
    },
  })

  revalidatePath("/settings")
  return { success: "Settings updated" }
}

export async function updateCompanyPlan(
  companyId: string,
  formData: z.infer<typeof planSettingsSchema>
) {
  const user = await requireAuth()

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  const validated = planSettingsSchema.safeParse(formData)
  if (!validated.success) {
    return { error: "Invalid fields", details: validated.error.flatten() }
  }

  const data = validated.data

  // Get current company data for audit log
  const currentCompany = await db.company.findUnique({
    where: { id: companyId },
    select: {
      legalForm: true,
      isVatPayer: true,
      entitlements: true,
    },
  })

  if (!currentCompany) {
    return { error: "Company not found" }
  }

  // Update company
  await db.company.update({
    where: { id: companyId },
    data: {
      legalForm: data.legalForm,
      isVatPayer: data.isVatPayer,
      entitlements: data.entitlements,
    },
  })

  // Log legal form change to audit log if it changed
  if (currentCompany.legalForm !== data.legalForm) {
    try {
      await db.auditLog.create({
        data: {
          companyId,
          userId: user.id!,
          action: "UPDATE",
          entity: "Company",
          entityId: companyId,
          changes: {
            before: {
              legalForm: currentCompany.legalForm,
            },
            after: {
              legalForm: data.legalForm,
            },
          },
        },
      })
    } catch (error) {
      console.error("[AuditLog] Failed to log legal form change:", error)
      // Don't fail the update if audit log fails
    }
  }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: "Plan updated" }
}

export async function checkCompanyHasHistoricalData(companyId: string) {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  // Check for historical invoices
  const invoiceCount = await db.eInvoice.count({
    where: { companyId },
  })

  // Check for business premises (indicates fiscalization setup)
  const premisesCount = await db.businessPremises.count({
    where: { companyId },
  })

  // Check for contacts (customer/supplier relationships)
  const contactCount = await db.contact.count({
    where: { companyId },
  })

  const hasHistoricalData = invoiceCount > 0 || premisesCount > 0 || contactCount > 5

  return {
    hasHistoricalData,
    details: {
      invoiceCount,
      premisesCount,
      contactCount,
    },
  }
}

export async function switchCompany(companyId: string) {
  const user = await requireAuth()

  // Verify user has access
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  // Set as default
  await db.companyUser.updateMany({
    where: { userId: user.id! },
    data: { isDefault: false },
  })

  await db.companyUser.update({
    where: { id: companyUser.id },
    data: { isDefault: true },
  })

  revalidatePath("/dashboard")
  return { success: "Company switched" }
}

export async function getUserCompanies() {
  const user = await requireAuth()

  return db.companyUser.findMany({
    where: { userId: user.id! },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  })
}
