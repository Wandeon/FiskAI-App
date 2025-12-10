import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function getCurrentCompany(userId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    include: {
      company: true,
    },
  })

  if (!companyUser) {
    // Get first company if no default
    const firstCompany = await db.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    })
    return firstCompany?.company ?? null
  }

  return companyUser.company
}

export async function requireCompany(userId: string) {
  const company = await getCurrentCompany(userId)
  if (!company) {
    redirect("/onboarding")
  }
  return company
}
