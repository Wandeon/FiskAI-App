// src/lib/visibility/route-protection.tsx
// Server-side route protection utilities for protected pages

import { redirect } from "next/navigation"
import { getAuthState, getRedirectDestination, getCurrentCompany } from "@/lib/auth-utils"
import { checkRouteAccess } from "./server"
import type { ElementId } from "./elements"

/**
 * Protect a page route with visibility checks
 * Use this at the top of your page component to ensure the user has access
 *
 * Uses the canonical redirect state machine:
 * 1. Not authenticated? -> /auth
 * 2. Authenticated, no CompanyUser? -> /onboarding
 * 3. Authenticated, has CompanyUser? -> check visibility rules
 *
 * @example
 * ```tsx
 * export default async function VatPage() {
 *   await protectRoute("page:vat")
 *   return <div>VAT content</div>
 * }
 * ```
 */
export async function protectRoute(elementId: ElementId): Promise<void> {
  // Execute the redirect state machine
  const authState = await getAuthState()
  const destination = getRedirectDestination(authState, "/")

  if (destination) {
    redirect(destination)
  }

  // At this point, we know user is authenticated and has a CompanyUser
  // Get user's company for visibility checks
  const company = await getCurrentCompany(authState.userId!)

  if (!company) {
    // Edge case: CompanyUser exists but no default company
    // This shouldn't happen, but handle gracefully
    redirect("/onboarding")
  }

  // Check route access via visibility system
  const accessResult = await checkRouteAccess(authState.userId!, company.id, elementId)

  if (!accessResult.allowed) {
    // Redirect to the suggested location (root -> middleware handles control-center)
    redirect(accessResult.redirectTo || "/")
  }
}

/**
 * Get route access information without redirecting
 * Useful for conditional rendering or showing locked states
 *
 * Uses the canonical redirect state machine for auth/company checks.
 */
export async function getRouteAccess(elementId: ElementId) {
  const authState = await getAuthState()

  if (!authState.isAuthenticated) {
    return {
      allowed: false,
      reason: "unauthenticated" as const,
      redirectTo: "/auth",
    }
  }

  if (!authState.hasCompanyUser) {
    return {
      allowed: false,
      reason: "no-company" as const,
      redirectTo: "/onboarding",
    }
  }

  const company = await getCurrentCompany(authState.userId!)

  if (!company) {
    return {
      allowed: false,
      reason: "no-company" as const,
      redirectTo: "/onboarding",
    }
  }

  return checkRouteAccess(authState.userId!, company.id, elementId)
}
