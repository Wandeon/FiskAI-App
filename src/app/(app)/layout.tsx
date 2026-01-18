import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardBackground } from "@/components/layout/DashboardBackground"
// REMOVED: Legacy AssistantPopup - replaced by assistant-v2 at /asistent route
// import { AssistantPopup } from "@/components/assistant/AssistantPopup"
import { VisibilityProvider } from "@/lib/visibility"
import { GuidanceProvider } from "@/contexts"
import { getVisibilityProviderProps } from "@/lib/visibility/server"
import { DashboardSkipLinks } from "@/components/a11y/skip-link"
import { WhatsNewModal } from "@/components/announcements/WhatsNewModal"
import { OnboardingHeader } from "@/components/layout/onboarding-header"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Check if we're on an onboarding route - hide chrome for focused experience
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || ""
  const isOnboardingRoute = pathname.includes("/onboarding")
  const session = await auth()

  if (!session?.user) {
    redirect("/auth")
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

  // For onboarding routes, render minimal layout without sidebar
  if (isOnboardingRoute) {
    return (
      <GuidanceProvider>
        <div className="min-h-screen bg-surface">
          <OnboardingHeader />
          <main className="px-4 py-8 md:py-12">{children}</main>
          <footer className="border-t border-border bg-surface px-4 py-4 mt-auto">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-body-xs text-muted">
                Vaši podaci se automatski spremaju tijekom unosa
              </p>
            </div>
          </footer>
        </div>
      </GuidanceProvider>
    )
  }

  // Prepare the content that needs to be wrapped by VisibilityProvider
  const content = (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block" id="primary-nav">
        <Sidebar
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
          company={
            currentCompany
              ? {
                  name: currentCompany.name,
                  eInvoiceProvider: currentCompany.eInvoiceProvider,
                  isVatPayer: currentCompany.isVatPayer,
                  legalForm: currentCompany.legalForm,
                  entitlements: currentCompany.entitlements as string[] | undefined,
                }
              : undefined
          }
        />
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        companyName={currentCompany?.name}
        userName={session.user.name || session.user.email || undefined}
      />

      {/* Main Content - add bottom padding for mobile FAB */}
      <main id="main-content" className="flex-1 p-4 md:p-6 pb-24 md:pb-6" tabIndex={-1}>
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </>
  )

  return (
    <GuidanceProvider>
      <div className="flex min-h-screen flex-col relative">
        <DashboardSkipLinks />
        <DashboardBackground />
        <Header />
        <div className="flex flex-1">
          {visibilityProps ? (
            <VisibilityProvider {...visibilityProps}>{content}</VisibilityProvider>
          ) : (
            content
          )}
        </div>

        {/* REMOVED: Legacy AssistantPopup - users now use /asistent route for v2 assistant */}

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* What's New modal for feature announcements */}
        <WhatsNewModal />
      </div>
    </GuidanceProvider>
  )
}
