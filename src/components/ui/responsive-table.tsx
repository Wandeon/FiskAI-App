'use client'

import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-media-query'

export interface Column<T> {
  key: string
  label: string
  render?: (item: T) => ReactNode
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[]
  data: T[]
  renderCard: (item: T, index: number) => ReactNode
  getRowKey?: (item: T, index: number) => string
  className?: string
}

export function ResponsiveTable<T>({
  columns,
  data,
  renderCard,
  getRowKey,
  className = '',
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    // Mobile: Card layout
    return (
      <div className={`space-y-4 ${className}`}>
        {data.map((item, index) => (
          <div key={getRowKey ? getRowKey(item, index) : index}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>
    )
  }

  // Desktop: Table layout
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((item, index) => (
            <tr
              key={getRowKey ? getRowKey(item, index) : index}
              className="hover:bg-gray-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                >
                  {column.render
                    ? column.render(item)
                    : String((item as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
