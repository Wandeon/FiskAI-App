import { auth } from "@/lib/auth"
import { db, runWithTenant } from "@/lib/db"
import { redirect } from "next/navigation"
import type { User, Company } from "@prisma/client"

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

/**
 * Require company with tenant context helper.
 *
 * This helper function:
 * 1. Calls requireCompany() to get the user's company
 * 2. Fetches the full user record from the database
 * 3. Wraps the callback in runWithTenant() for automatic tenant isolation
 *
 * Usage:
 * ```typescript
 * export async function myAction() {
 *   return requireCompanyWithContext(userId, async (company, user) => {
 *     // All db operations here automatically filtered by companyId
 *     const contacts = await db.contact.findMany()
 *     return { success: true, data: contacts }
 *   })
 * }
 * ```
 *
 * @param userId - The user ID to authenticate
 * @param fn - Callback function that receives company and user, returns Promise<T>
 * @returns Promise<T> - Returns the result of the callback function
 * @throws Redirects to /login if user not found, /onboarding if no company
 */
export async function requireCompanyWithContext<T>(
  userId: string,
  fn: (company: Company, user: User) => Promise<T>
): Promise<T> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    redirect("/login")
  }

  const company = await requireCompany(userId)

  return runWithTenant({ companyId: company.id, userId }, async () => {
    return fn(company, user)
  })
}
