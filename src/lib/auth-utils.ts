import { auth } from "@/lib/auth"
import { db, runWithTenant } from "@/lib/db"
import { redirect } from "next/navigation"
import type { User, Company } from "@prisma/client"
import { requirePermission, type Permission } from "@/lib/rbac"

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

export async function requireAdmin() {
  const user = await requireAuth()

  // Check if user has ADMIN systemRole
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { systemRole: true },
  })

  if (dbUser?.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  return user
}

export async function getCurrentCompany(userId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    select: {
      company: {
        select: {
          id: true,
          name: true,
          oib: true,
          vatNumber: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
          email: true,
          phone: true,
          iban: true,
          isVatPayer: true,
          eInvoiceProvider: true,
          eInvoiceApiKeyEncrypted: true,
          legalForm: true,
          fiscalEnabled: true,
          fiscalEnvironment: true,
          premisesCode: true,
          deviceCode: true,
          featureFlags: true,
          entitlements: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          trialEndsAt: true,
          subscriptionCurrentPeriodStart: true,
          subscriptionCurrentPeriodEnd: true,
          invoiceLimit: true,
          userLimit: true,
          stripeTerminalLocationId: true,
          stripeTerminalReaderId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!companyUser) {
    // Get first company if no default
    const firstCompany = await db.companyUser.findFirst({
      where: { userId },
      select: {
        company: {
          select: {
            id: true,
            name: true,
            oib: true,
            vatNumber: true,
            address: true,
            city: true,
            postalCode: true,
            country: true,
            email: true,
            phone: true,
            iban: true,
            isVatPayer: true,
            eInvoiceProvider: true,
            eInvoiceApiKeyEncrypted: true,
            legalForm: true,
            fiscalEnabled: true,
            fiscalEnvironment: true,
            premisesCode: true,
            deviceCode: true,
            featureFlags: true,
            entitlements: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            trialEndsAt: true,
            subscriptionCurrentPeriodStart: true,
            subscriptionCurrentPeriodEnd: true,
            invoiceLimit: true,
            userLimit: true,
            stripeTerminalLocationId: true,
            stripeTerminalReaderId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
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

/**
 * Require company with permission checking and tenant context.
 *
 * This helper function:
 * 1. Calls requireCompany() to get the user's company
 * 2. Fetches the full user record from the database
 * 3. Checks if the user has the required permission
 * 4. Wraps the callback in runWithTenant() for automatic tenant isolation
 *
 * Usage:
 * ```typescript
 * export async function deleteInvoice(id: string) {
 *   return requireCompanyWithPermission(userId, 'invoice:delete', async (company, user) => {
 *     // User has permission, proceed with deletion
 *     await db.eInvoice.delete({ where: { id } })
 *     return { success: true }
 *   })
 * }
 * ```
 *
 * @param userId - The user ID to authenticate
 * @param permission - The permission required to execute the callback
 * @param fn - Callback function that receives company and user, returns Promise<T>
 * @returns Promise<T> - Returns the result of the callback function
 * @throws Redirects to /login if user not found, /onboarding if no company
 * @throws Error if user doesn't have the required permission
 */
export async function requireCompanyWithPermission<T>(
  userId: string,
  permission: Permission,
  fn: (company: Company, user: User) => Promise<T>
): Promise<T> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    redirect("/login")
  }

  const company = await requireCompany(userId)

  // Check permission before executing the callback
  await requirePermission(userId, company.id, permission)

  return runWithTenant({ companyId: company.id, userId }, async () => {
    return fn(company, user)
  })
}
