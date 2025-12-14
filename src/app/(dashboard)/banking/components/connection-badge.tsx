// src/app/(dashboard)/banking/components/connection-badge.tsx

interface ConnectionBadgeProps {
  status: 'MANUAL' | 'CONNECTED' | 'EXPIRED'
  expiresAt?: Date | null
}

export function ConnectionBadge({ status, expiresAt }: ConnectionBadgeProps) {
  if (status === 'CONNECTED') {
    const daysLeft = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
          Povezano
        </span>
        {daysLeft !== null && daysLeft <= 14 && (
          <span className="text-xs text-amber-600">
            Ističe za {daysLeft} {daysLeft === 1 ? 'dan' : 'dana'}
          </span>
        )}
      </div>
    )
  }

  if (status === 'EXPIRED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5" />
        Isteklo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Ručni uvoz
    </span>
  )
}
