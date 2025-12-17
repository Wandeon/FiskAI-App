"use client"

import { ReactNode } from "react"

interface ComparisonRowProps {
  label: string
  tooltip?: string
  children: ReactNode
}

export function ComparisonRow({ label, tooltip, children }: ComparisonRowProps) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-secondary)]/40">
      <td className="sticky left-0 z-20 bg-[var(--surface-secondary)] p-3 font-medium text-[var(--foreground)] shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
        {label}
        {tooltip && (
          <span className="ml-1 cursor-help text-xs text-[var(--muted)]" title={tooltip}>
            ?
          </span>
        )}
      </td>
      {children}
    </tr>
  )
}
