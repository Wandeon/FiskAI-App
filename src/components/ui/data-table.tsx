// src/components/ui/data-table.tsx
"use client"

import { ReactNode, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useListNavigation } from "@/hooks/use-keyboard-shortcuts"

export interface Column<T> {
  key: string
  header: string
  cell: (item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  caption: string
  emptyMessage?: string
  className?: string
  getRowKey: (item: T) => string
  /** Callback when a row is activated (Enter key or double-click) */
  onRowActivate?: (item: T) => void
  /** Enable keyboard navigation */
  keyboardNavigation?: boolean
}

export function DataTable<T>({
  columns,
  data,
  caption,
  emptyMessage = "Nema podataka",
  className,
  getRowKey,
  onRowActivate,
  keyboardNavigation = true,
}: DataTableProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const handleActivate = useCallback(
    (index: number) => {
      if (onRowActivate && data[index]) {
        onRowActivate(data[index])
      }
    },
    [onRowActivate, data]
  )

  // Enable keyboard navigation for lists
  useListNavigation({
    itemCount: data.length,
    selectedIndex,
    onSelect: setSelectedIndex,
    onActivate: onRowActivate ? handleActivate : undefined,
    enabled: keyboardNavigation && data.length > 0,
  })

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={cn("overflow-x-auto rounded-md border border-gray-200", className)}
      role="grid"
      aria-label={caption}
      tabIndex={keyboardNavigation ? 0 : undefined}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("px-4 py-3 text-left font-medium text-gray-700", column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={getRowKey(item)}
              className={cn(
                "border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors",
                selectedIndex === index && "bg-blue-50 ring-2 ring-inset ring-blue-200"
              )}
              onClick={() => setSelectedIndex(index)}
              onDoubleClick={() => handleActivate(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleActivate(index)
                }
              }}
              tabIndex={selectedIndex === index ? 0 : -1}
              role="row"
              aria-selected={selectedIndex === index}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-3", column.className)} role="gridcell">
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
