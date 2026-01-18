import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Postavljanje tvrtke | FiskAI",
  description: "Postavite svoju tvrtku u nekoliko jednostavnih koraka",
}

interface OnboardingLayoutProps {
  children: React.ReactNode
}

/**
 * Minimal layout for general onboarding flow
 * Reduced chrome to focus user attention on the onboarding steps
 * No sidebar, no full navigation - just the essentials
 */
export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Minimal header */}
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <span className="text-heading-sm font-semibold text-foreground">FiskAI</span>
          <span className="text-body-sm text-muted ml-2">Postavljanje</span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 py-8 md:py-12">{children}</main>

      {/* Minimal footer */}
      <footer className="border-t border-border bg-surface px-4 py-4 mt-auto">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-body-xs text-muted">
            Vaši podaci se automatski spremaju tijekom unosa
          </p>
        </div>
      </footer>
    </div>
  )
}
