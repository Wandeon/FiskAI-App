"use client"

import { ReactNode } from "react"

interface ComparisonRowProps {
  label: string
  tooltip?: string
  children: ReactNode
}

export function ComparisonRow({ label, tooltip, children }: ComparisonRowProps) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3 font-medium text-gray-700 bg-gray-50 sticky left-0">
        {label}
        {tooltip && (
          <span className="ml-1 text-gray-400 cursor-help text-xs" title={tooltip}>
            ?
          </span>
        )}
      </td>
      {children}
    </tr>
  )
}
