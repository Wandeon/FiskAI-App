"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, ReactNode } from "react"

interface ComparisonColumn {
  id: string
  name: string
  highlighted?: boolean
}

interface ComparisonRow {
  label: string
  tooltip?: string
  values: Record<string, string | ReactNode>
}

interface ComparisonTableProps {
  columns?: ComparisonColumn[]
  rows?: ComparisonRow[]
  highlightedColumn?: string // from URL params
  children?: ReactNode
}

export function ComparisonTable({
  columns,
  rows,
  highlightedColumn,
  children,
}: ComparisonTableProps) {
  const [showScrollHint, setShowScrollHint] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollHint(false)
    }

    const scrollContainer = document.getElementById("mobile-comparison-scroll")
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { once: true })
      return () => scrollContainer.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // If children are provided, render them directly in a table structure
  if (children) {
    return (
      <div className="my-6">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>{children}</tbody>
          </table>
        </div>

        {/* Mobile Table */}
        <div
          className="md:hidden overflow-x-auto -mx-4 px-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full border-collapse min-w-max">
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    )
  }

  // Original prop-based approach for backwards compatibility
  if (!columns || !rows) {
    return (
      <div className="text-red-500">
        ComparisonTable requires either children or columns/rows props
      </div>
    )
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left bg-gray-50 border-b font-medium">Usporedba</th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "p-3 text-center border-b font-medium",
                    col.highlighted || col.id === highlightedColumn
                      ? "bg-blue-50 text-blue-900"
                      : "bg-gray-50"
                  )}
                >
                  {col.name}
                  {(col.highlighted || col.id === highlightedColumn) && (
                    <span className="block text-xs text-blue-600 font-normal">Preporučeno</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-700">
                  {row.label}
                  {row.tooltip && (
                    <span className="ml-1 text-gray-400 cursor-help" title={row.tooltip}>
                      ⓘ
                    </span>
                  )}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "p-3 text-center",
                      (col.highlighted || col.id === highlightedColumn) && "bg-blue-50/50"
                    )}
                  >
                    {row.values[col.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Horizontal Scroll Table */}
      <div className="md:hidden relative">
        {/* Scroll hint indicator */}
        {showScrollHint && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 flex items-center justify-end pr-2">
            <span className="text-gray-400 text-xs animate-pulse">→</span>
          </div>
        )}

        <div
          id="mobile-comparison-scroll"
          className="overflow-x-auto -mx-4 px-4 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 p-3 text-left bg-gray-50 border-b font-medium shadow-[2px_0_4px_rgba(0,0,0,0.1)] min-w-[120px]">
                  Usporedba
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "p-3 text-center border-b font-medium min-w-[140px]",
                      col.highlighted || col.id === highlightedColumn
                        ? "bg-blue-50 text-blue-900"
                        : "bg-gray-50"
                    )}
                  >
                    <div className="whitespace-nowrap">{col.name}</div>
                    {(col.highlighted || col.id === highlightedColumn) && (
                      <span className="block text-xs text-blue-600 font-normal mt-1">
                        Preporučeno
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="sticky left-0 z-10 p-3 font-medium text-gray-700 bg-white border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] min-h-[44px]">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{row.label}</span>
                      {row.tooltip && (
                        <span className="text-gray-400 cursor-help text-xs" title={row.tooltip}>
                          ⓘ
                        </span>
                      )}
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "p-3 text-center text-sm min-h-[44px]",
                        (col.highlighted || col.id === highlightedColumn) && "bg-blue-50/50"
                      )}
                    >
                      {row.values[col.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Swipe hint text */}
        {showScrollHint && (
          <div className="text-center mt-2 text-xs text-gray-400">Povucite za više opcija</div>
        )}
      </div>
    </div>
  )
}
