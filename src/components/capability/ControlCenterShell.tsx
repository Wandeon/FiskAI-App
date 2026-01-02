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
  role: "Client" | "Accountant" | "Admin"
  /** Queue sections to render */
  children: React.ReactNode
}

export function ControlCenterShell({ title, role, children }: Props) {
  return (
    <DiagnosticsProvider>
      <div className="container mx-auto py-6 space-y-6">
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {role} Control Center - Capability-driven view
            </p>
          </div>
          <DiagnosticsToggle />
        </header>

        <main className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{children}</main>
      </div>
    </DiagnosticsProvider>
  )
}
