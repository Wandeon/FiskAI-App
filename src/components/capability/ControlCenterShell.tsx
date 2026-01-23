// src/components/capability/ControlCenterShell.tsx
/**
 * Control Center Shell
 *
 * Shared layout for all Control Centers.
 * Provides diagnostics context and consistent structure.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { DiagnosticsProvider, DiagnosticsToggle } from "./DiagnosticsToggle"

interface Props {
  /** Page title */
  title: string
  /** Role indicator */
  role: string
  /** Subtitle override - if not provided, uses default */
  subtitle?: string
  /** Queue sections to render */
  children: React.ReactNode
}

export function ControlCenterShell({ title, role, subtitle, children }: Props) {
  return (
    <DiagnosticsProvider>
      <div className="space-y-4 md:space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {subtitle || `${role} kontrolni centar`}
            </p>
          </div>
          <DiagnosticsToggle />
        </header>

        <main className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {children}
        </main>
      </div>
    </DiagnosticsProvider>
  )
}
