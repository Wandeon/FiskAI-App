import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevenuePoint {
  label: string
  value: number
}

interface RevenueTrendCardProps {
  data: RevenuePoint[]
  className?: string
}

export function RevenueTrendCard({ data, className }: RevenueTrendCardProps) {
  const values = data.map((point) => point.value)
  const maxValue = Math.max(...values, 1)
  const lastValue = values[values.length - 1] || 0
  const prevValue = values[values.length - 2] || 0
  const change = prevValue === 0 ? 0 : ((lastValue - prevValue) / prevValue) * 100

  const points = data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100
      const y = 100 - (point.value / maxValue) * 100
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className={cn("card p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">Prihod zadnjih 6 mjeseci</p>
          <p className="text-2xl font-semibold text-[var(--foreground)] mt-1">
            {lastValue.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} €
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium",
            change >= 0 ? "bg-success-bg text-success-text" : "bg-rose-50 text-rose-700"
          )}
        >
          {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {Number.isFinite(change) ? `${change.toFixed(1)}%` : "—"}
        </div>
      </div>

      <div className="mt-6">
        <div className="h-32 w-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="trendGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth="3"
              points={points}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              fill="url(#trendGradient)"
              stroke="none"
              points={`${points} 100,100 0,100`}
              opacity={0.3}
            />
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-6 text-xs text-[var(--muted)]">
          {data.map((point) => (
            <span key={point.label} className="text-center">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
