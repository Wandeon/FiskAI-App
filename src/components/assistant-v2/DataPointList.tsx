import React from "react"
import type { DataPoint } from "@/lib/assistant"
import { cn } from "@/lib/utils"

interface DataPointListProps {
  dataPoints: DataPoint[]
  className?: string
}

export function DataPointList({ dataPoints, className }: DataPointListProps) {
  if (dataPoints.length === 0) return null

  return (
    <div className={className}>
      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Data used</h4>
      <ul role="list" className="space-y-2">
        {dataPoints.map((point, i) => (
          <li key={i} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{point.label}</p>
              <p className="text-xs text-muted-foreground">
                {point.source}
                {point.asOfDate && <span> • {new Date(point.asOfDate).toLocaleDateString()}</span>}
              </p>
            </div>
            <p className="font-medium text-right shrink-0">{point.value}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
