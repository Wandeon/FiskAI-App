// src/lib/visibility/route-protection.tsx
// Server-side route protection utilities for protected pages

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCurrentCompany } from "@/lib/auth-utils"
import { checkRouteAccess } from "./server"
import type { ElementId } from "./elements"

/**
 * Protect a page route with visibility checks
 * Use this at the top of your page component to ensure the user has access
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
  // Get user session
  const session = await auth()

  if (!session?.user?.id) {
    // Not authenticated - redirect to login
    redirect("/auth")
  }

  // Get user's company
  const company = await getCurrentCompany(session.user.id)

  if (!company) {
    // No company yet - redirect to onboarding
    redirect("/onboarding")
  }

  // Check route access via visibility system
  const accessResult = await checkRouteAccess(session.user.id, company.id, elementId)

  if (!accessResult.allowed) {
    // Redirect to the suggested location (root -> middleware handles control-center)
    redirect(accessResult.redirectTo || "/")
  }
}

/**
 * Get route access information without redirecting
 * Useful for conditional rendering or showing locked states
 */
export async function getRouteAccess(elementId: ElementId) {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      allowed: false,
      reason: "unauthenticated" as const,
      redirectTo: "/login",
    }
  }

  const company = await getCurrentCompany(session.user.id)

  if (!company) {
    return {
      allowed: false,
      reason: "no-company" as const,
      redirectTo: "/onboarding",
    }
  }

  return checkRouteAccess(session.user.id, company.id, elementId)
}
