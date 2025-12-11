import Link from "next/link"
import { auth } from "@/lib/auth"
import { getUserCompanies } from "@/app/actions/company-switch"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "./company-switcher"
import { QuickActions, Notifications, UserMenu, CompanyStatus } from "./header-actions"

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
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-3">
          {session?.user ? (
            <>
              {/* Quick Actions (Hidden on mobile - use FAB instead) */}
              <QuickActions className="hidden sm:block" />

              {/* Notifications */}
              <Notifications count={0} />

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
