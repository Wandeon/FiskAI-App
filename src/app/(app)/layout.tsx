import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardBackground } from "@/components/layout/DashboardBackground"
import { AssistantPopup } from "@/components/assistant/AssistantPopup"
import { VisibilityProvider } from "@/lib/visibility"
import { getVisibilityProviderProps } from "@/lib/visibility/server"
import { DashboardSkipLinks } from "@/components/a11y/skip-link"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
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

  // Fetch visibility provider props if user has a company
  let visibilityProps = null
  if (currentCompany) {
    try {
      visibilityProps = await getVisibilityProviderProps(session.user.id, currentCompany.id)
    } catch (error) {
      console.error("Failed to fetch visibility props:", error)
      // Continue without visibility system - will use defaults
    }
  }

  return (
    <div className="flex min-h-screen flex-col relative">
      <DashboardSkipLinks />
      <DashboardBackground />
      <Header />
      <div className="flex flex-1">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block" id="primary-nav">
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
        <main id="main-content" className="flex-1 p-4 md:p-6 pb-24 md:pb-6" tabIndex={-1}>
          <div className="mx-auto w-full max-w-6xl">
            {visibilityProps ? (
              <VisibilityProvider {...visibilityProps}>{children}</VisibilityProvider>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Global Assistant Popup */}
      <AssistantPopup />

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
