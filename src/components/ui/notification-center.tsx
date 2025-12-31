"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Bell, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NotificationItem, NotificationType } from "@/types/notifications"

interface NotificationCenterProps {
  items?: NotificationItem[]
  className?: string
  badgeCount?: number
  onOpenChange?: (isOpen: boolean) => void
}

const glow =
  "before:absolute before:-inset-px before:rounded-full before:bg-gradient-to-r before:from-brand-500/60 before:via-chart-1/60 before:to-chart-2/60 before:opacity-0 before:transition before:duration-200 hover:before:opacity-30"

export function NotificationCenter({
  items = [],
  className,
  badgeCount,
  onOpenChange,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = items.length
  const displayCount = typeof badgeCount === "number" ? badgeCount : count

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsOpen(false)
          onOpenChange?.(false)
        }
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen, onOpenChange])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev
            onOpenChange?.(next)
            return next
          })
        }}
        className={cn(
          "relative flex items-center justify-center rounded-full p-2 text-[var(--muted)] transition-colors focus-ring",
          glow
        )}
        aria-label="Obavijesti"
      >
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
          <Bell className="h-5 w-5" />
          {displayCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs font-semibold text-white shadow-lg">
              {displayCount > 9 ? "9+" : displayCount}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-3 w-96 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_25px_80px_rgba(15,23,42,0.45)] animate-scale-in">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Obavijesti</p>
            <p className="text-xs text-[var(--muted)]">Zadnje aktivnosti i upozorenja</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--muted)]">
                Sve je ažurirano 😊
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3 px-5 py-4">
                    <NotificationIcon type={item.type} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-[var(--muted)] mt-1">{item.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                        {item.timestamp && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {item.timestamp}
                          </span>
                        )}
                        {item.action && (
                          <Link
                            href={item.action.href}
                            className="text-link hover:underline font-medium"
                          >
                            {item.action.label}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[var(--border)] px-5 py-3 text-center">
            <Link href="/notifications" className="text-sm font-semibold text-link hover:underline">
              Prikaži sve obavijesti
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const base = "flex h-9 w-9 items-center justify-center rounded-full"
  if (type === "success") {
    return (
      <div className={cn(base, "bg-success-bg text-success-icon")}>
        {" "}
        <CheckCircle2 className="h-4 w-4" />{" "}
      </div>
    )
  }
  if (type === "warning") {
    return (
      <div className={cn(base, "bg-warning-bg text-warning-icon")}>
        {" "}
        <AlertCircle className="h-4 w-4" />{" "}
      </div>
    )
  }
  return (
    <div className={cn(base, "bg-surface-1 text-secondary")}>
      {" "}
      <Bell className="h-4 w-4" />{" "}
    </div>
  )
}
