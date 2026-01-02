// src/components/capability/DiagnosticsToggle.tsx
/**
 * Diagnostics Toggle
 *
 * Developer toggle to show capability diagnostics.
 *
 * @module components/capability
 * @since Control Center Shells
 */

"use client"

import { useState, createContext, useContext } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface DiagnosticsContextValue {
  showDiagnostics: boolean
  setShowDiagnostics: (value: boolean) => void
}

const DiagnosticsContext = createContext<DiagnosticsContextValue>({
  showDiagnostics: false,
  setShowDiagnostics: () => {},
})

export function useDiagnostics() {
  return useContext(DiagnosticsContext)
}

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  return (
    <DiagnosticsContext.Provider value={{ showDiagnostics, setShowDiagnostics }}>
      {children}
    </DiagnosticsContext.Provider>
  )
}

export function DiagnosticsToggle() {
  const { showDiagnostics, setShowDiagnostics } = useDiagnostics()

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Switch id="diagnostics" checked={showDiagnostics} onCheckedChange={setShowDiagnostics} />
      <Label htmlFor="diagnostics" className="font-mono text-xs">
        Show capability diagnostics
      </Label>
    </div>
  )
}
