"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Stat {
  label: string
  value: string
  tooltip?: string
}

interface QuickStatsBarProps {
  stats: Stat[]
  title: string
}

function StatsContent({
  stats,
  title,
  showTitle,
}: {
  stats: Stat[]
  title: string
  showTitle: boolean
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-3 md:px-6">
      {/* Desktop/Tablet View */}
      <div className="hidden sm:flex items-center justify-between flex-wrap gap-2">
        {showTitle && <span className="mr-4 font-semibold text-white">{title}</span>}
        <div className="flex flex-wrap gap-4 md:gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm" title={stat.tooltip}>
              <span className="text-white/70">{stat.label}:</span>
              <span className="font-medium text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile View - 2x2 Grid */}
      <div className="sm:hidden">
        {showTitle && <div className="mb-3 text-sm font-semibold text-white">{title}</div>}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="flex min-h-[44px] flex-col justify-center gap-1 rounded border border-white/10 bg-surface/5 p-3 sm:border-0 sm:bg-transparent sm:p-0"
              title={stat.tooltip}
            >
              <span className="text-xs text-white/70">{stat.label}</span>
              <span className="text-sm font-medium text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function QuickStatsBar({ stats, title }: QuickStatsBarProps) {
  const [isSticky, setIsSticky] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="not-prose">
      <div className="relative border-y border-white/10 bg-surface/5">
        <StatsContent stats={stats} title={title} showTitle={false} />
      </div>

      <AnimatePresence>
        {isSticky && (
          <motion.div
            key="sticky"
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed left-0 right-0 z-30 border-b border-white/10 bg-surface-elevated/80 backdrop-blur shadow-sm",
              "top-[var(--header-height)]"
            )}
          >
            <StatsContent stats={stats} title={title} showTitle />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
