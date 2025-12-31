"use client"

import React from "react"
import { motion } from "framer-motion"
import type { DataPoint } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface DataPointListProps {
  dataPoints: DataPoint[]
  className?: string
  theme?: AssistantVariant
}

export function DataPointList({ dataPoints, className, theme = "light" }: DataPointListProps) {
  if (dataPoints.length === 0) return null

  const isDark = theme === "dark"

  return (
    <div className={className}>
      <h4
        className={cn(
          "text-xs font-medium uppercase mb-2",
          isDark ? "text-tertiary" : "text-muted-foreground"
        )}
      >
        Data used
      </h4>
      <ul role="list" className="space-y-2">
        {dataPoints.map((point, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start justify-between gap-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium", isDark ? "text-white" : "text-foreground")}>
                {point.label}
              </p>
              <p className={cn("text-xs", isDark ? "text-muted" : "text-muted-foreground")}>
                {point.source}
                {point.asOfDate && <span> • {new Date(point.asOfDate).toLocaleDateString()}</span>}
              </p>
            </div>
            <p
              className={cn(
                "font-medium text-right shrink-0",
                isDark ? "text-accent-light" : "text-foreground"
              )}
            >
              {point.value}
            </p>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
