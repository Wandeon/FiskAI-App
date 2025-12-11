import Link from "next/link"
import { auth } from "@/lib/auth"
import { getUserCompanies } from "@/app/actions/company-switch"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "./company-switcher"
import { QuickActions, Notifications, UserMenu, CompanyStatus } from "./header-actions"
import { CommandPalette } from "@/components/ui/command-palette"
import { getNotificationCenterFeed, countUnreadNotifications } from "@/lib/notifications"
import { db } from "@/lib/db"
import { OnboardingProgressPill } from "./onboarding-progress-pill"

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

  if (session?.user?.id && currentCompany) {
    const [
      feed,
      companyUser,
      contactCount,
      productCount,
      eInvoiceCount,
    ] = await Promise.all([
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
      db.contact.count({ where: { companyId: currentCompany.id } }),
      db.product.count({ where: { companyId: currentCompany.id } }),
      db.eInvoice.count({ where: { companyId: currentCompany.id } }),
    ])
    notificationItems = feed.items
    notificationUnreadCount = countUnreadNotifications(feed.items, companyUser?.notificationSeenAt ?? null)

    const steps = [
      Boolean(currentCompany.oib && currentCompany.address),
      Boolean(currentCompany.eInvoiceProvider),
      contactCount > 0,
      productCount > 0,
      eInvoiceCount > 0,
    ]

    onboardingProgress = {
      completed: steps.filter(Boolean).length,
      total: steps.length,
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3 md:gap-4 pl-12 md:pl-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              F
            </div>
            <span className="hidden sm:inline text-lg font-bold text-[var(--foreground)]">
              FiskAI
            </span>
          </Link>

          {/* Company Switcher (Desktop) */}
          {currentCompany && companies.length > 0 && (
            <div className="hidden lg:block">
              <CompanySwitcher
                companies={companies}
                currentCompanyId={currentCompany.id}
              />
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
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-3">
          {session?.user ? (
            <>
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
