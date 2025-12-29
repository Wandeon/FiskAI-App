// src/app/(dashboard)/banking/components/connection-badge.tsx

interface ConnectionBadgeProps {
  status: "MANUAL" | "CONNECTED" | "EXPIRED"
  expiresAt?: Date | null
}

export function ConnectionBadge({ status, expiresAt }: ConnectionBadgeProps) {
  if (status === "CONNECTED") {
    const daysLeft = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text">
          <span className="w-1.5 h-1.5 bg-success rounded-full mr-1.5" />
          Povezano
        </span>
        {daysLeft !== null && daysLeft <= 14 && (
          <span className="text-xs text-warning-text">
            Ističe za {daysLeft} {daysLeft === 1 ? "dan" : "dana"}
          </span>
        )}
      </div>
    )
  }

  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-bg text-warning-text">
        <span className="w-1.5 h-1.5 bg-warning rounded-full mr-1.5" />
        Isteklo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-1 text-secondary">
      Ručni uvoz
    </span>
  )
}
