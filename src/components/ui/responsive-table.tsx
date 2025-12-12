import { ReactNode } from 'react'

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
  return (
    <div className={className}>
      {/* Mobile: Card layout - hidden on md+ screens */}
      <div className="block md:hidden space-y-4">
        {data.map((item, index) => (
          <div key={getRowKey ? getRowKey(item, index) : `mobile-${index}`}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>

      {/* Desktop: Table layout - hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
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
                key={getRowKey ? getRowKey(item, index) : `desktop-${index}`}
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
    </div>
  )
}
