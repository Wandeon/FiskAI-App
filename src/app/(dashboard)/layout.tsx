import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { BottomNav } from "@/components/layout/bottom-nav"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  let currentCompany: Awaited<ReturnType<typeof getCurrentCompany>> | null = null
  try {
    currentCompany = await getCurrentCompany(session.user.id)
  } catch {
    // User not fully set up
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <Header />
      <div className="flex flex-1">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
            company={currentCompany || undefined}
          />
        </div>

        {/* Mobile Navigation */}
        <MobileNav
          companyName={currentCompany?.name}
          userName={session.user.name || session.user.email || undefined}
        />

        {/* Main Content - add bottom padding for mobile FAB */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>

      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
