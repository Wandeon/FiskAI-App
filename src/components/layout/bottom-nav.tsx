'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, Users, Settings, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Početna" },
  { href: "/e-invoices", icon: FileText, label: "Računi" },
  { href: "/e-invoices/new", icon: Plus, label: "Novo", isAction: true },
  { href: "/contacts", icon: Users, label: "Kontakti" },
  { href: "/settings", icon: Settings, label: "Postavke" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] safe-bottom md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
                  <Icon className="h-6 w-6" />
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 touch-target",
                isActive ? "text-brand-600" : "text-[var(--muted)]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
