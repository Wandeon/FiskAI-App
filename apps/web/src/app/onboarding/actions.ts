"use server"

import { auth } from "@/lib/auth"
import { prisma, Prisma } from "@fiskai/db"
import { z } from "zod"
import { oibSchema, ibanOptionalSchema } from "@fiskai/shared"
import { revalidatePath } from "next/cache"

// Validation schema matching OnboardingData
const companySchema = z.object({
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "DOO", "JDOO"]),
  oib: oibSchema,
  name: z.string().min(2, "Naziv mora imati najmanje 2 znaka"),
  address: z.string().min(3, "Adresa je obavezna"),
  city: z.string().min(2, "Grad je obavezan"),
  zipCode: z.string().regex(/^\d{5}$/, "Poštanski broj mora imati 5 znamenki"),

  isVatPayer: z.boolean(),
  vatNumber: z.string().optional(),
  acceptsCash: z.boolean(),

  email: z.string().email("Neispravan email").optional().or(z.literal("")),
  phone: z.string().optional(),
  iban: ibanOptionalSchema,

  premisesName: z.string().min(1, "Naziv poslovnice je obavezan"),
  premisesCode: z.string().min(1, "Oznaka poslovnice je obavezna"),

  dataSource: z.enum([
    "MANUAL",
    "OCR_OBRTNICA",
    "OCR_SUDSKO",
    "VIES",
    "SUDSKI_REGISTAR",
  ]),

  // Pausalni-specific (stored in featureFlags)
  employedElsewhere: z.boolean().optional(),
  expectedIncomeRange: z.string().optional(),
})

export type CreateCompanyInput = z.infer<typeof companySchema>

export interface CreateCompanyResult {
  success: boolean
  companyId?: string
  error?: string
}

export async function createCompany(
  input: CreateCompanyInput
): Promise<CreateCompanyResult> {
  try {
    // Verify user is authenticated
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Niste prijavljeni" }
    }

    // Validate input
    const parsed = companySchema.safeParse(input)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return { success: false, error: firstError?.message || "Neispravni podaci" }
    }

    const data = parsed.data

    // Check if OIB is already registered
    const existingCompany = await prisma.company.findUnique({
      where: { oib: data.oib },
    })

    if (existingCompany) {
      return { success: false, error: "Tvrtka s ovim OIB-om već postoji" }
    }

    // Create company and business premises in transaction
    const company = await prisma.$transaction(async (tx) => {
      // Create company
      const newCompany = await tx.company.create({
        data: {
          name: data.name,
          oib: data.oib,
          legalForm: data.legalForm,
          address: data.address,
          city: data.city,
          zipCode: data.zipCode,
          country: "HR",
          isVatPayer: data.isVatPayer,
          vatNumber: data.vatNumber || null,
          acceptsCash: data.acceptsCash,
          fiscalEnabled: data.acceptsCash,
          email: data.email || null,
          phone: data.phone || null,
          iban: data.iban || null,
          onboardingStep: 4,
          onboardingComplete: true,
          dataSource: data.dataSource,
          featureFlags:
            data.legalForm === "OBRT_PAUSAL"
              ? {
                  employedElsewhere: data.employedElsewhere,
                  expectedIncomeRange: data.expectedIncomeRange,
                }
              : Prisma.JsonNull,
          members: {
            create: {
              userId: session.user.id,
              role: "OWNER",
            },
          },
        },
      })

      // Create default business premises
      await tx.businessPremises.create({
        data: {
          companyId: newCompany.id,
          name: data.premisesName,
          code: data.premisesCode,
          address: data.address,
          isActive: true,
        },
      })

      return newCompany
    })

    revalidatePath("/dashboard")
    return { success: true, companyId: company.id }
  } catch (error) {
    console.error("Create company error:", error)
    return { success: false, error: "Greška pri stvaranju tvrtke" }
  }
}
