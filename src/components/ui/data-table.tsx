// src/components/ui/data-table.tsx
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

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
}

export function DataTable<T>({
  columns,
  data,
  caption,
  emptyMessage = "Nema podataka",
  className,
  getRowKey,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 p-8 text-center text-gray-500">
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
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-left font-medium text-gray-700",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={getRowKey(item)}
              className="border-b last:border-b-0 hover:bg-gray-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-4 py-3", column.className)}
                >
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
