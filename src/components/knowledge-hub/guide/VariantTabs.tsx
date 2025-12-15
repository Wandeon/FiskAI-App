"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const activeTab = searchParams.get("varijanta") || defaultTab || tabs[0]?.id

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("varijanta", tabId)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content - render all, show active */}
      <div>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return null
          const tabId = tabs[index]?.id
          return <div className={cn(activeTab === tabId ? "block" : "hidden")}>{child}</div>
        })}
      </div>
    </div>
  )
}

// Tab panel component for MDX usage
export function TabPanel({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
