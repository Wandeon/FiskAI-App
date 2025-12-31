"use client"

import { ReactNode } from "react"

interface ComparisonRowProps {
  label: string
  tooltip?: string
  children: ReactNode
}

export function ComparisonRow({ label, tooltip, children }: ComparisonRowProps) {
  return (
    <tr className="border-b border-white/10 hover:bg-surface/5">
      <td className="sticky left-0 z-20 bg-surface-elevated/90 p-3 font-medium text-white shadow-[2px_0_4px_rgba(0,0,0,0.2)]">
        {label}
        {tooltip && (
          <span className="ml-1 cursor-help text-xs text-white/50" title={tooltip}>
            ?
          </span>
        )}
      </td>
      {children}
    </tr>
  )
}
