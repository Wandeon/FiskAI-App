/**
 * Role Selection Page
 *
 * This page allows users with access to multiple portals to choose which one to enter.
 * Currently shown only to STAFF and ADMIN users who can access multiple portals:
 * - ADMIN: Can choose between admin, staff, or app portal
 * - STAFF: Can choose between staff or app portal
 * - USER: Redirected directly to app portal (no choice needed)
 *
 * AUDIT FIX #212: This behavior is intentional. Regular users only have access to one
 * portal, so showing a selection page would be redundant. Future enhancement could
 * show a welcome message or company context for all users.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-utils"
import { getAvailableSubdomains, hasMultipleRoles } from "@/lib/auth/system-role"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Building2, Users, Shield } from "lucide-react"

const SUBDOMAIN_INFO = {
  app: {
    title: "Client Dashboard",
    description: "Access your business dashboard",
    icon: Building2,
    color: "text-primary",
  },
  staff: {
    title: "Staff Portal",
    description: "Manage assigned client accounts",
    icon: Users,
    color: "text-green-500",
  },
  admin: {
    title: "Admin Portal",
    description: "Platform management and oversight",
    icon: Shield,
    color: "text-purple-500",
  },
}

export default async function SelectRolePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const systemRole = user.systemRole || "USER"

  // If user only has one role, redirect directly
  if (!hasMultipleRoles(systemRole)) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const url = new URL(baseUrl)

    // In development, just redirect to /dashboard since subdomains don't work on localhost
    if (process.env.NODE_ENV === "development") {
      redirect("/dashboard")
    }

    // In production, redirect to app subdomain
    const appUrl = baseUrl.replace(
      url.hostname,
      `app.${url.hostname.replace(/^(www\.|app\.|staff\.|admin\.)/, "")}`
    )
    redirect(`${appUrl}/dashboard`)
  }

  const availableSubdomains = getAvailableSubdomains(systemRole)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const url = new URL(baseUrl)
  const baseDomain = url.hostname.replace(/^(www\.|app\.|staff\.|admin\.)/, "")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-surface-1 to-slate-100 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user.name || user.email}
          </h1>
          <p className="text-secondary mt-2">Select which portal you&apos;d like to access</p>
        </div>

        <div className="grid gap-4">
          {availableSubdomains.map((subdomain) => {
            const info = SUBDOMAIN_INFO[subdomain as keyof typeof SUBDOMAIN_INFO]
            if (!info) return null

            const Icon = info.icon

            // In development, use local paths; in production, use subdomains
            let href: string
            if (process.env.NODE_ENV === "development") {
              // For development, just go to /dashboard (subdomain routing handled by middleware)
              href = "/dashboard"
            } else {
              href = `${url.protocol}//${subdomain}.${baseDomain}/dashboard`
            }

            return (
              <a key={subdomain} href={href}>
                <Card className="hover:bg-surface/80 transition-colors cursor-pointer border-default bg-surface">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div
                      className={`h-12 w-12 rounded-full bg-surface-1 flex items-center justify-center ${info.color}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-foreground">{info.title}</CardTitle>
                      <CardDescription className="text-secondary">
                        {info.description}
                      </CardDescription>
                    </div>
                  </CardContent>
                </Card>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
