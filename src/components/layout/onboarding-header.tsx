/**
 * Minimal header for onboarding flows.
 * Shows just the FiskAI logo and "Postavljanje" label.
 * No sidebar, no navigation, no user menu - keeps focus on onboarding.
 */
export function OnboardingHeader() {
  return (
    <header className="border-b border-border bg-surface px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <span className="text-heading-sm font-semibold text-foreground">FiskAI</span>
        <span className="text-body-sm text-muted ml-2">Postavljanje</span>
      </div>
    </header>
  )
}
