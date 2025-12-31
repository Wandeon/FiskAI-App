// src/components/ui/data-table.tsx
"use client"

import { ReactNode, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useListNavigation } from "@/hooks/use-keyboard-shortcuts"
import { getSortAriaLabel } from "@/lib/a11y"

export interface Column<T> {
  key: string
  header: string
  cell: (item: T) => ReactNode
  className?: string
  /** Mark column as sortable for accessibility */
  sortable?: boolean
}

export interface SortState {
  field: string
  order: "asc" | "desc"
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
  /** Current sort state for accessibility labels */
  sort?: SortState
  /** Callback when sortable header is clicked */
  onSort?: (field: string) => void
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
  sort,
  onSort,
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
      <div
        className="rounded-md border border-default p-8 text-center text-secondary"
        role="status"
        aria-label={emptyMessage}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={cn("overflow-x-auto rounded-md border border-default", className)}
      role="grid"
      aria-label={caption}
      tabIndex={keyboardNavigation ? 0 : undefined}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-surface-1">
            {columns.map((column) => {
              const isSortable = column.sortable && onSort
              const isSorted = sort?.field === column.key
              const sortAriaLabel = isSortable
                ? getSortAriaLabel(column.header, sort, column.key, "hr")
                : undefined

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left font-medium text-secondary",
                    isSortable && "cursor-pointer hover:bg-surface-2",
                    column.className
                  )}
                  aria-sort={
                    isSorted ? (sort.order === "asc" ? "ascending" : "descending") : undefined
                  }
                  onClick={isSortable ? () => onSort(column.key) : undefined}
                  onKeyDown={
                    isSortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onSort(column.key)
                          }
                        }
                      : undefined
                  }
                  tabIndex={isSortable ? 0 : undefined}
                  role={isSortable ? "button" : undefined}
                  aria-label={sortAriaLabel}
                >
                  {column.header}
                  {isSorted && (
                    <span aria-hidden="true" className="ml-1">
                      {sort.order === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={getRowKey(item)}
              className={cn(
                "border-b last:border-b-0 hover:bg-surface-1 cursor-pointer transition-colors",
                selectedIndex === index &&
                  "bg-interactive-secondary ring-2 ring-inset ring-border-focus"
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
