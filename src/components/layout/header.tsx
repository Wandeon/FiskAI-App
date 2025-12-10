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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-blue-600">
            FiskAI
          </Link>
          {currentCompany && companies.length > 0 && (
            <CompanySwitcher
              companies={companies}
              currentCompanyId={currentCompany.id}
            />
          )}
        </div>

        <nav className="flex items-center gap-4">
          {session?.user ? (
            <>
              <span className="text-sm text-gray-600">{session.user.email}</span>
              <form action={logout}>
                <Button variant="outline" size="sm" type="submit">
                  Odjava
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
              <Link href="/register">
                <Button size="sm">Registracija</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
