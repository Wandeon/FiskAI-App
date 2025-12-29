// src/components/ui/data-table.tsx
import { ReactNode } from "react"
import { cn } from "@/lib/utils"
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
  sort,
  onSort,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-md border border-gray-200 p-8 text-center text-gray-500"
        role="status"
        aria-label={emptyMessage}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border border-gray-200", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-gray-50">
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
                    "px-4 py-3 text-left font-medium text-gray-700",
                    isSortable && "cursor-pointer hover:bg-gray-100",
                    column.className
                  )}
                  aria-sort={isSorted ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
                  onClick={isSortable ? () => onSort(column.key) : undefined}
                  onKeyDown={isSortable ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSort(column.key)
                    }
                  } : undefined}
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
          {data.map((item) => (
            <tr key={getRowKey(item)} className="border-b last:border-b-0 hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-3", column.className)}>
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
