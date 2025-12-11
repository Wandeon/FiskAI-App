import Link from "next/link"
import { auth } from "@/lib/auth"
import { logout } from "@/app/actions/auth"
import { getUserCompanies } from "@/app/actions/company-switch"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "./company-switcher"

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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-6 pl-12 md:pl-0">
          <Link href="/" className="text-lg md:text-xl font-bold text-blue-600">
            FiskAI
          </Link>
          {currentCompany && companies.length > 0 && (
            <div className="hidden sm:block">
              <CompanySwitcher
                companies={companies}
                currentCompanyId={currentCompany.id}
              />
            </div>
          )}
        </div>

        <nav className="flex items-center gap-2 md:gap-4">
          {session?.user ? (
            <>
              <span className="hidden md:inline text-sm text-gray-600">
                {session.user.email}
              </span>
              <form action={logout}>
                <Button variant="outline" size="sm" type="submit">
                  <span className="hidden sm:inline">Odjava</span>
                  <span className="sm:hidden">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </span>
                </Button>
              </form>
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
        </nav>
      </div>
    </header>
  )
}
