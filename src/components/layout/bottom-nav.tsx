"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useCapabilities } from "@/hooks/use-capabilities"
import { useTicketSummary } from "@/hooks/use-ticket-summary"
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Plus,
  Receipt,
  Package,
  LifeBuoy,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Početna", module: "platform-core" },
  { href: "/e-invoices", icon: FileText, label: "Računi", module: "invoicing" },
  { href: "/support", icon: LifeBuoy, label: "Support", module: "platform-core" },
  { href: "/contacts", icon: Users, label: "Kontakti" },
  { href: "/settings", icon: Settings, label: "Postavke", module: "platform-core" },
]

const quickActions = [
  { href: "/e-invoices/new", label: "E-račun", icon: Receipt, module: "invoicing" },
  { href: "/invoices/new", label: "Dokument", icon: FileText, module: "invoicing" },
  { href: "/contacts/new", label: "Kontakt", icon: Users },
  { href: "/products/new", label: "Proizvod", icon: Package },
]

export function BottomNav() {
  const pathname = usePathname()
  const [isQuickOpen, setIsQuickOpen] = useState(false)
  const capabilities = useCapabilities()
  const { summary } = useTicketSummary()

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden",
          isQuickOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsQuickOpen(false)}
        aria-hidden="true"
      />

      {/* Quick actions drawer */}
      <div
        className={cn(
          "fixed bottom-20 left-0 right-0 z-50 px-4 md:hidden transition-all duration-250 ease-out",
          isQuickOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <div className="rounded-3xl surface-glass border border-white/20 shadow-glow p-4 space-y-3 safe-bottom animate-slide-up">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Brze akcije</p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions
              .filter((action) =>
                action.module
                  ? capabilities.modules[action.module as keyof typeof capabilities.modules]
                      ?.enabled !== false
                  : true
              )
              .map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setIsQuickOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-white/10"
                >
                  <action.icon className="icon-md text-[var(--muted)]" />
                  {action.label}
                </Link>
              ))}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur safe-bottom md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems
            .filter((item) =>
              item.module
                ? capabilities.modules[item.module as keyof typeof capabilities.modules]
                    ?.enabled !== false
                : true
            )
            .slice(0, 2)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                activePath={pathname}
                badge={
                  item.href === "/support"
                    ? summary?.unread || summary?.openCount || undefined
                    : undefined
                }
              />
            ))}

          <button
            onClick={() => setIsQuickOpen((prev) => !prev)}
            className={cn(
              "flex h-14 w-14 -mt-8 items-center justify-center rounded-full shadow-glow transition-all focus-ring",
              isQuickOpen ? "bg-[var(--surface)] text-brand-600" : "bg-brand-600 text-white"
            )}
            aria-label={isQuickOpen ? "Zatvori brze akcije" : "Otvori brze akcije"}
          >
            <Plus className="h-6 w-6" />
          </button>

          {navItems
            .filter((item) =>
              item.module
                ? capabilities.modules[item.module as keyof typeof capabilities.modules]
                    ?.enabled !== false
                : true
            )
            .slice(2)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                activePath={pathname}
                badge={
                  item.href === "/support"
                    ? summary?.unread || summary?.openCount || undefined
                    : undefined
                }
              />
            ))}
        </div>
      </nav>
    </>
  )
}

function NavLink({
  item,
  activePath,
  badge,
}: {
  item: (typeof navItems)[number]
  activePath: string
  badge?: number
}) {
  const isActive = activePath === item.href || activePath.startsWith(item.href + "/")
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2 px-2 text-xs font-medium",
        isActive ? "text-brand-600" : "text-[var(--muted)]"
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5" />
        {badge && badge > 0 && (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <span>{item.label}</span>
    </Link>
  )
}
