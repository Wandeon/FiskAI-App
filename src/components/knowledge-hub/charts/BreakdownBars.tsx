"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAnimatedNumber } from "@/hooks/use-animated-number"

export type BreakdownItem = {
  label: string
  value: number
  hint?: string
  colorClassName?: string
}

function CountTo({
  value,
  formatValue,
  durationMs = 650,
}: {
  value: number
  formatValue: (value: number) => string
  durationMs?: number
}) {
  const [target, setTarget] = useState(0)

  useEffect(() => {
    setTarget(value)
  }, [value])

  const animated = useAnimatedNumber(target, { durationMs })
  return <span className="font-mono">{formatValue(animated)}</span>
}

export function BreakdownBars({
  items,
  formatValue,
  className,
}: {
  items: BreakdownItem[]
  formatValue: (value: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()

  const total = useMemo(() => {
    const sum = items
      .map((item) => (Number.isFinite(item.value) ? item.value : 0))
      .reduce((a, b) => a + b, 0)
    return sum > 0 ? sum : 0
  }, [items])

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => {
        const percent = total > 0 ? Math.max(0, Math.min(100, (item.value / total) * 100)) : 0
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-white">{item.label}</p>
                {item.hint && <p className="text-xs text-white/70">{item.hint}</p>}
              </div>
              <CountTo value={item.value} formatValue={formatValue} durationMs={520} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn("h-full rounded-full", item.colorClassName ?? "bg-interactive")}
                initial={reduce ? false : { width: 0 }}
                animate={reduce ? undefined : { width: `${percent}%` }}
                transition={reduce ? undefined : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
