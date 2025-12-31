"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
}

interface VariantTabsProps {
  tabs: Tab[]
  defaultTab?: string
  children: React.ReactNode
}

export function VariantTabs({ tabs, defaultTab, children }: VariantTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reduce = useReducedMotion()
  const tabsId = React.useId()
  const activeTab = searchParams.get("varijanta") || defaultTab || tabs[0]?.id
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const panels = React.Children.toArray(children).filter((child): child is React.ReactElement =>
    React.isValidElement(child)
  )

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("varijanta", tabId)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const key = event.key
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return
    if (!tabs.length) return

    event.preventDefault()
    const activeIndex = Math.max(
      0,
      tabs.findIndex((t) => t.id === activeTab)
    )

    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? tabs.length - 1
          : key === "ArrowRight"
            ? (activeIndex + 1) % tabs.length
            : (activeIndex - 1 + tabs.length) % tabs.length

    const next = tabs[nextIndex]
    if (!next) return
    handleTabChange(next.id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="not-prose">
      {/* Tab buttons */}
      <div
        role="tablist"
        aria-label="Varijante"
        onKeyDown={handleKeyDown}
        className="scrollbar-hide mb-6 flex overflow-x-auto border-b border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            id={`${tabsId}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tabsId}-panel-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "relative flex min-h-[44px] items-center whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30 sm:px-6",
              activeTab === tab.id
                ? "text-white"
                : "text-white/60 hover:text-white/90 active:bg-surface/5"
            )}
          >
            {activeTab === tab.id && (
              <motion.span
                layoutId={`${tabsId}-indicator`}
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-interactive to-accent-light"
                transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-0">
        {panels.map((child, index) => {
          const tabId = tabs[index]?.id
          if (!tabId) return null
          const isActive = activeTab === tabId
          return (
            <motion.section
              key={tabId}
              role="tabpanel"
              id={`${tabsId}-panel-${tabId}`}
              aria-labelledby={`${tabsId}-tab-${tabId}`}
              aria-hidden={!isActive}
              data-variant-tab-panel={tabId}
              initial={false}
              animate={
                isActive
                  ? { opacity: 1, y: 0, height: "auto", pointerEvents: "auto" }
                  : { opacity: 0, y: 8, height: 0, pointerEvents: "none" }
              }
              transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className={cn(isActive ? "py-1" : "py-0")}>{child}</div>
            </motion.section>
          )
        })}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

// Tab panel component for MDX usage
export function TabPanel({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
