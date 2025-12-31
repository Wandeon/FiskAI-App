"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

export async function switchCompany(companyId: string) {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId: companyId,
    },
  })

  if (!companyUser) {
    return { error: "Nemate pristup ovoj tvrtki" }
  }

  // Update default company
  await db.$transaction([
    // Remove default from all user's companies
    db.companyUser.updateMany({
      where: { userId: user.id! },
      data: { isDefault: false },
    }),
    // Set new default
    db.companyUser.update({
      where: { id: companyUser.id },
      data: { isDefault: true },
    }),
  ])

  revalidatePath("/")
  return { success: true }
}

export async function getUserCompanies() {
  const user = await requireAuth()

  const companies = await db.companyUser.findMany({
    where: { userId: user.id! },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          oib: true,
        },
      },
    },
    orderBy: { company: { name: "asc" } },
  })

  return companies.map((cu) => ({
    id: cu.company.id,
    name: cu.company.name,
    oib: cu.company.oib,
    isDefault: cu.isDefault,
    role: cu.role,
  }))
}
