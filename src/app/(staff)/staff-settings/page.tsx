import { requireAuth } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { StaffProfileForm } from "./staff-profile-form"
import { StaffNotificationForm } from "./staff-notification-form"
import Link from "next/link"
import { User, Bell, ChevronRight, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { db } from "@/lib/db"

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export const metadata = {
  title: "Settings | Staff Portal | FiskAI",
  description: "Staff portal settings and preferences",
}

export default async function StaffSettingsPage({ searchParams }: PageProps) {
  const user = await requireAuth()

  // Check for STAFF or ADMIN role
  if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  // Fetch full user data
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      systemRole: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!dbUser) {
    redirect("/login")
  }

  const params = await searchParams
  const requestedTab = params.tab ?? "profile"

  // Define available tabs
  const tabs = [
    {
      id: "profile",
      label: "Profile",
      description: "Personal information and preferences",
      icon: User,
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Email alerts and notification preferences",
      icon: Bell,
    },
    {
      id: "security",
      label: "Security",
      description: "Authentication and access control",
      icon: Shield,
    },
  ] as const

  // Validate tab
  const isTabValid = tabs.some((t) => t.id === requestedTab)
  const activeTab = isTabValid ? requestedTab : "profile"

  // Redirect if trying to access invalid tab
  if (!isTabValid && params.tab) {
    redirect("/settings?tab=profile")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-info-icon">Staff Portal</p>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-tertiary">
          Manage your profile, notification preferences, and security settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px,1fr] max-w-6xl">
        <nav className="space-y-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab
            const Icon = tab.icon
            return (
              <Link
                key={tab.id}
                href={`/settings?tab=${tab.id}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-default p-3 transition-all",
                  isActive ? "bg-surface shadow-sm border-info-border" : "hover:bg-surface-1"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg bg-surface-1 p-2 text-secondary",
                    isActive && "bg-info-bg text-info-icon"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{tab.label}</p>
                  <p className="text-xs text-tertiary mt-0.5">{tab.description}</p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-secondary flex-shrink-0",
                    isActive && "text-info-icon"
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <section className="space-y-6">
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Update your personal information and display preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffProfileForm user={dbUser} />
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure email alerts for new assignments, tickets, and client activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffNotificationForm userId={dbUser.id} />
              </CardContent>
            </Card>
          )}

          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage authentication methods and access control</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-surface-1 p-6 text-center">
                  <Shield className="mx-auto h-10 w-10 text-secondary" />
                  <h3 className="mt-3 text-base font-medium text-foreground">Coming Soon</h3>
                  <p className="mt-1 text-sm text-tertiary">
                    Advanced security features are under development.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
