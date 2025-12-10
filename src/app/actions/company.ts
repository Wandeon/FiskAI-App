"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { companySchema, companySettingsSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCompany(formData: z.input<typeof companySchema>) {
  const user = await requireAuth()

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const data = validatedFields.data

  // Check if OIB already exists
  const existingCompany = await db.company.findUnique({
    where: { oib: data.oib },
  })

  if (existingCompany) {
    return { error: "A company with this OIB already exists" }
  }

  // Create company and link to user as owner
  const company = await db.company.create({
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
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
  redirect("/dashboard")
}

export async function updateCompany(
  companyId: string,
  formData: z.input<typeof companySchema>
) {
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

  await db.company.update({
    where: { id: companyId },
    data: validatedFields.data,
  })

  revalidatePath("/settings")
  return { success: "Settings updated" }
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
