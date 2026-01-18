import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Postavljanje pausalnog obrta | FiskAI",
  description: "Postavite svoj pausalni obrt u 3 jednostavna koraka",
}

interface PausalniOnboardingLayoutProps {
  children: React.ReactNode
}

/**
 * Minimal layout for pausalni obrt onboarding flow
 * Reduced chrome to focus user attention on the onboarding steps
 */
export default function PausalniOnboardingLayout({ children }: PausalniOnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Minimal header */}
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <span className="text-heading-sm font-semibold text-foreground">FiskAI</span>
          <span className="text-body-sm text-muted ml-2">Pausalni obrt</span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 py-8 md:py-12">{children}</main>

      {/* Minimal footer */}
      <footer className="border-t border-border bg-surface px-4 py-4 mt-auto">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-body-xs text-muted">
            Vasi podaci se automatski spremaju tijekom unosa
          </p>
        </div>
      </footer>
    </div>
  )
}
