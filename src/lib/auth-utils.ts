import { auth } from "@/lib/auth"
import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { redirect } from "next/navigation"
import type { User, Company } from "@prisma/client"
import { requirePermission, type Permission } from "@/lib/rbac"

/**
 * Valid legal forms for Croatian businesses.
 * User must choose one of these during onboarding.
 */
const VALID_LEGAL_FORMS = ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"] as const

// =============================================================================
// REDIRECT STATE MACHINE
// =============================================================================
//
// This implements the canonical redirect state machine for the app:
//
// 1. Not authenticated? → /auth
// 2. Authenticated, no CompanyUser? → /onboarding
// 3. Authenticated, has CompanyUser? → /cc (or requested route)
//
// Internal /onboarding state is handled by the onboarding page itself.
// =============================================================================

/**
 * Possible redirect destinations in the app
 */
export type RedirectDestination = "/auth" | "/onboarding" | "/cc" | null

/**
 * User auth state for redirect decisions
 */
export interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  hasCompanyUser: boolean
  companyId: string | null
}

/**
 * Get the current user's auth state for redirect decisions.
 * This is a lightweight check that doesn't load full company data.
 */
export async function getAuthState(): Promise<AuthState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      isAuthenticated: false,
      userId: null,
      hasCompanyUser: false,
      companyId: null,
    }
  }

  // Check if user has any CompanyUser relationship (lightweight query)
  const companyUser = await db.companyUser.findFirst({
    where: { userId: session.user.id, isDefault: true },
    select: { companyId: true },
  })

  // If no default, check for any membership
  if (!companyUser) {
    const anyMembership = await db.companyUser.findFirst({
      where: { userId: session.user.id },
      select: { companyId: true },
    })

    return {
      isAuthenticated: true,
      userId: session.user.id,
      hasCompanyUser: !!anyMembership,
      companyId: anyMembership?.companyId ?? null,
    }
  }

  return {
    isAuthenticated: true,
    userId: session.user.id,
    hasCompanyUser: true,
    companyId: companyUser.companyId,
  }
}

/**
 * Determine where to redirect based on auth state.
 *
 * Canonical State Machine:
 * 1. Not authenticated? → /auth
 * 2. Authenticated, no CompanyUser? → /onboarding
 * 3. Authenticated, has CompanyUser? → null (allow access)
 *
 * @param authState - The user's current auth state
 * @param currentPath - The current request path (for smart routing)
 * @returns The redirect destination, or null if no redirect needed
 */
export function getRedirectDestination(
  authState: AuthState,
  currentPath: string = "/"
): RedirectDestination {
  // State 1: Not authenticated → /auth
  if (!authState.isAuthenticated) {
    return "/auth"
  }

  // State 2: Authenticated, no CompanyUser → /onboarding
  if (!authState.hasCompanyUser) {
    return "/onboarding"
  }

  // State 3: Authenticated, has CompanyUser → allow access
  // Root path should go to /cc
  if (currentPath === "/") {
    return "/cc"
  }

  return null
}

/**
 * Execute the redirect state machine.
 * Call this at the start of protected routes/layouts.
 *
 * @param currentPath - Optional current path for smart routing
 * @returns The auth state if no redirect is needed
 */
export async function executeRedirectStateMachine(currentPath: string = "/"): Promise<AuthState> {
  const authState = await getAuthState()
  const destination = getRedirectDestination(authState, currentPath)

  if (destination) {
    redirect(destination)
  }

  return authState
}

/**
 * Check if a company has completed the minimum required onboarding fields.
 * A company is considered to have completed onboarding if it has:
 * - Basic info (name, OIB) - required
 * - Valid legalForm (business type chosen) - required
 * - Email address - required for dashboard access
 *
 * Address is optional but recommended. Without email, users should be
 * redirected back to onboarding to complete the flow.
 */
export function isOnboardingComplete(company: {
  name: string | null
  oib: string | null
  legalForm: string | null
  email: string | null
}): boolean {
  // Step 1: Basic info must be complete
  const hasBasicInfo = !!(company.name?.trim() && company.oib?.match(/^\d{11}$/))

  if (!hasBasicInfo) return false

  // Business type must be a valid choice (not null, not invalid)
  const hasValidLegalForm =
    company.legalForm !== null &&
    VALID_LEGAL_FORMS.includes(company.legalForm as (typeof VALID_LEGAL_FORMS)[number])

  if (!hasValidLegalForm) return false

  // Email is required for dashboard access
  const hasEmail = !!company.email?.includes("@")

  return hasEmail
}

/**
 * Get the appropriate onboarding route based on company's legal form.
 * OBRT_PAUSAL users get the specialized paušalni wizard.
 * Other business types use the generic onboarding flow.
 */
export function getOnboardingRoute(company: { legalForm: string | null } | null): string {
  if (!company?.legalForm) {
    return "/onboarding" // No company or no legal form yet
  }

  // Paušalni users get the specialized wizard
  if (company.legalForm === "OBRT_PAUSAL") {
    return "/pausalni/onboarding"
  }

  // All other business types use generic onboarding
  return "/onboarding"
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth")
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
    // Redirect to root - middleware handles routing to control-center
    redirect("/")
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
          checksum: true,
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
          stockValuationMethod: true,
          onboardingStep: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  return companyUser?.company ?? null
}

/**
 * Require a company for the current user.
 *
 * This function enforces the redirect state machine at the company level:
 * - No company membership at all -> /onboarding
 * - Has membership but no default -> /onboarding/choose-company
 * - Has company but incomplete onboarding -> appropriate onboarding route
 *
 * Note: This assumes authentication has already been verified.
 * Use executeRedirectStateMachine() for full auth + company checks.
 */
export async function requireCompany(userId: string) {
  const company = await getCurrentCompany(userId)
  if (!company) {
    const hasMembership = await db.companyUser.findFirst({
      where: { userId },
      select: { id: true },
    })
    if (hasMembership) {
      // Has membership but no default company selected
      redirect("/onboarding/choose-company")
    }
    // No company membership at all -> start onboarding
    redirect("/onboarding")
  }
  // Check if onboarding is complete - redirect to appropriate wizard if incomplete
  // This prevents a redirect loop where dashboard shows incomplete state
  if (!isOnboardingComplete(company)) {
    redirect(getOnboardingRoute(company))
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
 * \`\`\`typescript
 * export async function myAction() {
 *   return requireCompanyWithContext(userId, async (company, user) => {
 *     // All db operations here automatically filtered by companyId
 *     const contacts = await db.contact.findMany()
 *     return { success: true, data: contacts }
 *   })
 * }
 * \`\`\`
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
    redirect("/auth")
  }

  const company = await requireCompany(userId)

  return runWithTenant({ companyId: company.id, userId }, async () =>
    runWithAuditContext({ actorId: userId, reason: "user_request" }, async () => {
      return fn(company, user)
    })
  )
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
 * \`\`\`typescript
 * export async function deleteInvoice(id: string) {
 *   return requireCompanyWithPermission(userId, 'invoice:delete', async (company, user) => {
 *     // User has permission, proceed with deletion
 *     await db.eInvoice.delete({ where: { id } })
 *     return { success: true }
 *   })
 * }
 * \`\`\`
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
    redirect("/auth")
  }

  const company = await requireCompany(userId)

  // Check permission before executing the callback
  await requirePermission(userId, company.id, permission)

  return runWithTenant({ companyId: company.id, userId }, async () =>
    runWithAuditContext({ actorId: userId, reason: "user_request" }, async () => {
      return fn(company, user)
    })
  )
}
