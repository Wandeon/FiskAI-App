'use client'

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileActionBarProps {
  children: ReactNode
  className?: string
}

export function MobileActionBar({ children, className }: MobileActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] p-4 safe-bottom md:hidden",
        "shadow-[0_-4px_6px_-1px_rgb(0_0_0_/_0.1)]",
        className
      )}
    >
      <div className="flex gap-3">
        {children}
      </div>
    </div>
  )
}
