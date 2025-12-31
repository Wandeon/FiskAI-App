import Link from "next/link"
import { auth } from "@/lib/auth"
import { getUserCompanies } from "@/lib/actions/company-switch"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "./company-switcher"
import { QuickActions, Notifications, UserMenu, CompanyStatus } from "./header-actions"
import { CommandPalette } from "@/components/ui/command-palette"
import { getNotificationCenterFeed, countUnreadNotifications } from "@/lib/notifications"
import { db } from "@/lib/db"
import { OnboardingProgressPill } from "./onboarding-progress-pill"
import { deriveCapabilities } from "@/lib/capabilities"
import { PlanBadge } from "./plan-badge"
import { QuickLevelToggle } from "@/components/guidance"
import { FiskAILogo } from "@/components/ui/LogoSymbol"

export async function Header() {
  const session = await auth()
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = []
  let currentCompany: Awaited<ReturnType<typeof getCurrentCompany>> | null = null

  if (session?.user?.id) {
    try {
      companies = await getUserCompanies()
      currentCompany = await getCurrentCompany(session.user.id)
    } catch {
      // User not fully set up yet
    }
  }

  let notificationItems: Awaited<ReturnType<typeof getNotificationCenterFeed>>["items"] = []
  let notificationUnreadCount = 0
  let onboardingProgress: { completed: number; total: number } | null = null
  let capabilities = deriveCapabilities(null)

  if (session?.user?.id && currentCompany) {
    const [feed, companyUser] = await Promise.all([
      getNotificationCenterFeed({
        userId: session.user.id,
        company: {
          id: currentCompany.id,
          name: currentCompany.name,
          eInvoiceProvider: currentCompany.eInvoiceProvider,
        },
      }),
      db.companyUser.findFirst({
        where: { userId: session.user.id, companyId: currentCompany.id },
        select: { notificationSeenAt: true },
      }),
    ])
    notificationItems = feed.items
    notificationUnreadCount = countUnreadNotifications(
      feed.items,
      companyUser?.notificationSeenAt ?? null
    )

    // Track the 4-step onboarding wizard completion, not business milestones
    // Step 1: Basic Info (name, oib, legalForm)
    // Step 2: Competence Level (featureFlags.competence)
    // Step 3: Address (address, postalCode, city)
    // Step 4: Contact & Tax (email, iban)
    const featureFlags = currentCompany.featureFlags as Record<string, unknown> | null
    const hasCompetence = !!featureFlags?.competence

    const wizardSteps = [
      Boolean(currentCompany.name && currentCompany.oib && currentCompany.legalForm), // Step 1
      hasCompetence, // Step 2
      Boolean(currentCompany.address && currentCompany.postalCode && currentCompany.city), // Step 3
      Boolean(currentCompany.email && currentCompany.iban), // Step 4
    ]

    onboardingProgress = {
      completed: wizardSteps.filter(Boolean).length,
      total: wizardSteps.length,
    }

    capabilities = deriveCapabilities(currentCompany)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/50 bg-[var(--surface)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--surface)]/60">
      <div className="mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3 md:gap-4 pl-12 md:pl-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <FiskAILogo className="h-8 w-8 text-accent transition-all duration-300 group-hover:brightness-110" />
            <span className="hidden sm:inline text-lg font-bold text-[var(--foreground)]">
              Fisk<span className="text-accent">AI</span>
            </span>
          </Link>

          {/* Company Switcher (Desktop) */}
          {currentCompany && companies.length > 0 && (
            <div className="hidden lg:block">
              <CompanySwitcher companies={companies} currentCompanyId={currentCompany.id} />
            </div>
          )}

          {/* Company Status Pill (Tablet) */}
          {currentCompany && (
            <div className="hidden md:block lg:hidden">
              <CompanyStatus
                companyName={currentCompany.name}
                isConnected={!!currentCompany.eInvoiceProvider}
                draftCount={0}
              />
            </div>
          )}

          {onboardingProgress && (
            <OnboardingProgressPill
              completed={onboardingProgress.completed}
              total={onboardingProgress.total}
              className="hidden lg:flex"
            />
          )}

          <PlanBadge capabilities={capabilities} className="hidden xl:flex" />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-3">
          {session?.user ? (
            <>
              <QuickLevelToggle className="hidden md:flex" />
              <CommandPalette />
              {/* Quick Actions (Hidden on mobile - use FAB instead) */}
              <QuickActions className="hidden sm:block" />

              {/* Notifications */}
              <Notifications
                initialItems={notificationItems}
                initialUnreadCount={notificationUnreadCount}
              />

              {/* User Menu */}
              <UserMenu
                user={{
                  name: session.user.name,
                  email: session.user.email,
                  image: session.user.image,
                }}
              />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Prijava
                </Button>
              </Link>
              <Link href="/register" className="hidden sm:inline">
                <Button size="sm">Registracija</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
