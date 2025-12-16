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
        {showTitle && <span className="font-semibold text-gray-900 mr-4">{title}</span>}
        <div className="flex flex-wrap gap-4 md:gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm" title={stat.tooltip}>
              <span className="text-gray-500">{stat.label}:</span>
              <span className="font-medium text-gray-900">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile View - 2x2 Grid */}
      <div className="sm:hidden">
        {showTitle && <div className="font-semibold text-gray-900 mb-3 text-sm">{title}</div>}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-1 bg-white sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 min-h-[44px] justify-center"
              title={stat.tooltip}
            >
              <span className="text-xs text-gray-500">{stat.label}</span>
              <span className="font-medium text-gray-900 text-sm">{stat.value}</span>
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
      <div className="relative bg-gray-50 border-y border-gray-200">
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
              "fixed left-0 right-0 z-30 border-b border-[var(--border)] bg-[var(--glass-surface)] backdrop-blur shadow-sm",
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
